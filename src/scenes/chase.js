import * as THREE from 'three';
import { Scene } from '../scene.js';
import { FX } from '../fx.js';
import { sky, skylineRing, palm, building, streetLight, LA_COLORS, makeSign } from '../env.js';
import { makeBrougham, makeSportsCar, makeWagon, Rig, SPECS, M, B, box, cardboardStack, shoppingCart, fruitCart, barrel, tireStack, glassPane } from '../models.js';
import { tex, texR, texFresh } from '../textures.js';
import { clamp, lerp, rand, pick, damp, wrapAngle, fmtMoney } from '../util.js';
import { addCollateral } from '../stats.js';

const FLOOR = 12, SLOPE = 0.7, WALL = 19.2;
const heightAt = (d) => { const a = Math.abs(d); return a <= FLOOR ? 0 : (Math.min(a, 20) - FLOOR) * SLOPE; };
const CAR_HL = 2.55, CAR_HW = 1.0;
const ESCAPE_GAP = 170;

class Track {
  constructor() {
    const pts = [new THREE.Vector3(0, 0, -80), new THREE.Vector3(0, 0, 0)];
    let x = 0, z = 0, h = 0;
    for (let i = 0; i < 22; i++) {
      h = clamp(h + rand(-0.45, 0.45), -1.0, 1.0);
      x += Math.sin(h) * 150; z += Math.cos(h) * 150;
      pts.push(new THREE.Vector3(x, 0, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.length = curve.getLength();
    const N = (this.N = Math.ceil(this.length / 2));
    this.ds = this.length / N;
    const sp = curve.getSpacedPoints(N);
    this.px = new Float32Array(N + 1); this.pz = new Float32Array(N + 1); this.yaw = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { this.px[i] = sp[i].x; this.pz[i] = sp[i].z; }
    for (let i = 0; i <= N; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(N, i + 1)];
      this.yaw[i] = Math.atan2(b.x - a.x, b.z - a.z);
    }
    this._s = { x: 0, z: 0, yaw: 0 };
  }
  sample(s) {
    const f = clamp(s / this.ds, 0, this.N - 1e-4);
    const i = Math.floor(f), t = f - i, o = this._s;
    o.x = lerp(this.px[i], this.px[i + 1], t);
    o.z = lerp(this.pz[i], this.pz[i + 1], t);
    o.yaw = this.yaw[i] + wrapAngle(this.yaw[i + 1] - this.yaw[i]) * t;
    return o;
  }
  /** world position for track coords; returns track yaw */
  world(s, d, out, yOff = 0) {
    const p = this.sample(s);
    out.set(p.x + Math.cos(p.yaw) * d, heightAt(d) + yOff, p.z - Math.sin(p.yaw) * d);
    return p.yaw;
  }
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class ChaseScene extends Scene {
  enter() {
    const g = this.game;
    this.pausable = true;
    this.track = new Track();
    this.buildWorld();
    this.fx = new FX(this.scene, { lights: 2 });
    this.fx.setScale(g.H * 0.85);

    this.car = makeBrougham();
    this.scene.add(this.car.root);
    this.pc = { s: 40, d: -4, psi: 0, v: 0, damage: 0, hitCD: 0, wallCD: 0, ramCD: 0, roll: 0, pitch: 0, steer: 0, broke: new Set() };
    this.dukeCar = makeSportsCar();
    this.scene.add(this.dukeCar.root);
    this.duke = { s: 76, d: 2, v: 0, targetD: 2, psi: 0, grit: 100, weaveT: 2, goonT: 4, spin: 0, wrecked: false };
    this.shots = [];
    this.spawnObstacles();

    this.phase = 'intro';
    this.camMode = 'introDuke';
    this.shake = 0;
    this.escapeT = 0;
    this.aiShootT = 1;
    this.p2 = { rx: 0, ry: 0.1, cd: 0 };
    this.quips = new Set();
    this.screechCD = 0;
    this.camera.fov = 68;
    this.camera.far = 900;
    this.buildHud();
    this.placeCar(this.car, this.pc.s, this.pc.d, this.pc.psi);
    this.placeCar(this.dukeCar, this.duke.s, this.duke.d, 0);
    this.updateCamera(1, true);
    this.run(() => this.intro());
  }

  // ------------------------------------------------------------------ world
  buildWorld() {
    const s = this.scene, T = this.track;
    // day-for-night: obviously daylight, tinted blue, as was the custom
    s.fog = new THREE.Fog(0x4a6a9a, 70, 420);
    sky(s, { top: 0x0e2048, mid: 0x3c5f98, horizon: 0x8aa8cc, bottom: 0x2a3a5a, sun: { dir: new THREE.Vector3(0.4, 0.35, 1), color: 0xe8f0ff, size: 30 } });
    this.skyline = skylineRing(s, { color: 0x6a7aa8 });
    s.add(new THREE.HemisphereLight(0xb0c8ff, 0x3a4058, 1.7));
    const moon = new THREE.DirectionalLight(0xd8e4ff, 1.6);
    moon.position.set(30, 60, 20);
    s.add(moon);

    const prof = [[-44, 6.4], [-20.6, 6.4], [-20, 5.6], [-12, 0], [-3, 0], [3, 0], [12, 0], [20, 5.6], [20.6, 6.4], [44, 6.4]];
    const concrete = new THREE.MeshLambertMaterial({ map: tex('concrete') });
    const dirt = new THREE.MeshLambertMaterial({ map: tex('dirt') });
    this.waterMat = new THREE.MeshLambertMaterial({ map: texR('water', 1, 1), emissive: 0x0a1a1a });
    s.add(this.ribbon(prof.slice(0, 2), dirt, 0, 1 / 10, 1 / 10));
    s.add(this.ribbon(prof.slice(8, 10), dirt, 0, 1 / 10, 1 / 10));
    s.add(this.ribbon(prof.slice(1, 5), concrete, 0, 1 / 8, 1 / 8));
    s.add(this.ribbon(prof.slice(5, 9), concrete, 0, 1 / 8, 1 / 8));
    s.add(this.ribbon(prof.slice(4, 6), this.waterMat, 0.03, 1 / 6, 1 / 8));
    s.add(this.ribbon([[-3, 0.0], [3, 0.0]], concrete, -0.02, 1 / 8, 1 / 8));
    const fence = new THREE.MeshLambertMaterial({ map: tex('fence'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xbbbbbb });
    s.add(this.ribbon([[21.2, 6.4], [21.2, 8.6]], fence, 0, 1 / 2.2, 1 / 2.2));
    s.add(this.ribbon([[-21.2, 6.4], [-21.2, 8.6]], fence, 0, 1 / 2.2, 1 / 2.2));

    // banks: buildings, palms, lights, power towers
    for (let sv = 0; sv < T.length; sv += rand(24, 36)) {
      for (const side of [-1, 1]) {
        const d = side * rand(38, 72);
        const yaw = T.world(sv, d, _v);
        const b = building(rand(12, 26), rand(7, 42), rand(12, 22), pick(LA_COLORS));
        b.position.set(_v.x, 6.4 + b.position.y, _v.z);
        b.rotation.y = yaw;
        s.add(b);
      }
    }
    for (let sv = 10; sv < T.length; sv += rand(30, 55)) {
      for (const side of [-1, 1]) {
        if (Math.random() < 0.35) continue;
        T.world(sv + rand(-5, 5), side * rand(23, 31), _v);
        const p = palm(rand(10, 15));
        p.position.set(_v.x, 6.4, _v.z);
        s.add(p);
      }
    }
    for (let sv = 30; sv < T.length; sv += 80) {
      for (const side of [-1, 1]) {
        const yaw = T.world(sv + (side > 0 ? 40 : 0), side * 22.2, _v);
        const l = streetLight(1);
        l.position.set(_v.x, 6.4, _v.z);
        l.rotation.y = yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        s.add(l);
      }
    }
    // graffiti on the sloped walls
    for (let sv = 120; sv < T.length; sv += rand(60, 120)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const d = side * 15.5;
      const yaw = T.world(sv, d, _v);
      const L = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const n = new THREE.Vector3().addScaledVector(L, -side * 0.57).add(new THREE.Vector3(0, 0.82, 0)).normalize();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshLambertMaterial({ map: texFresh('graffiti'), transparent: true, alphaTest: 0.3, depthWrite: false }));
      m.position.copy(_v).addScaledVector(n, 0.06);
      m.lookAt(_v2.copy(m.position).add(n));
      s.add(m);
    }
    this.bridges = [];
    for (let sv = 330; sv < T.length - 250; sv += rand(380, 480)) this.bridges.push(sv);
  }

  ribbon(prof, mat, yOff, uScale, vScale) {
    const T = this.track, step = 2;
    const rows = [];
    for (let i = 0; i <= T.N; i += step) rows.push(i);
    if (rows[rows.length - 1] !== T.N) rows.push(T.N);
    const nP = prof.length;
    const pos = new Float32Array(rows.length * nP * 3), uv = new Float32Array(rows.length * nP * 2);
    const uArr = [0];
    for (let j = 1; j < nP; j++) uArr[j] = uArr[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]);
    rows.forEach((i, k) => {
      const x = T.px[i], z = T.pz[i], y = T.yaw[i], c = Math.cos(y), sn = Math.sin(y);
      for (let j = 0; j < nP; j++) {
        const [d, h] = prof[j], idx = k * nP + j;
        pos[idx * 3] = x + c * d; pos[idx * 3 + 1] = h + yOff; pos[idx * 3 + 2] = z - sn * d;
        uv[idx * 2] = uArr[j] * uScale; uv[idx * 2 + 1] = i * T.ds * vScale;
      }
    });
    const idx = [];
    for (let k = 0; k < rows.length - 1; k++) for (let j = 0; j < nP - 1; j++) {
      const a = k * nP + j, b = a + 1, c = a + nP, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }

  // ------------------------------------------------------------------ obstacles
  spawnObstacles() {
    const T = this.track;
    this.obs = [];
    for (const sv of this.bridges) {
      const yaw = T.world(sv, 0, _v);
      const deck = box(74, 1.4, 10, M(0x8a857c, { map: tex('concrete') }));
      deck.position.set(_v.x, 9.6, _v.z); deck.rotation.y = yaw;
      this.scene.add(deck);
      for (const off of [-4.6, 4.6]) {
        const rail = box(74, 0.9, 0.3, M(0x6a665e));
        T.world(sv + off, 0, _v);
        rail.position.set(_v.x, 10.75, _v.z); rail.rotation.y = yaw;
        this.scene.add(rail);
      }
      const layout = pick([[-8, 8], [0], [-6, 6], [-10, 0, 10]]);
      for (const d of layout) {
        const p = box(1.8, 9.6, 1.8, M(0x7a766e, { map: tex('concreteDark') }));
        T.world(sv, d, _v);
        p.position.set(_v.x, 4.8, _v.z); p.rotation.y = yaw;
        this.scene.add(p);
        this.obs.push({ type: 'pillar', s: sv, d, r: 1.0, rl: 1.0, alive: true, solid: true, mesh: p });
      }
    }
    const nearBridge = (s) => this.bridges.some((b) => Math.abs(b - s) < 20);
    const specials = [
      [T.length * 0.28, 'fruit'], [T.length * 0.71, 'fruit'],
      [T.length * 0.43, 'glass'], [T.length * 0.86, 'glass'],
    ];
    for (const [s, type] of specials) this.addObs(type, nearBridge(s) ? s + 30 : s, type === 'glass' ? -13 : rand(-6, 6));
    let s = 210;
    while (s < T.length - 260) {
      s += rand(26, 46);
      if (nearBridge(s) || specials.some(([sp]) => Math.abs(sp - s) < 25)) continue;
      const type = pick(['boxes', 'boxes', 'cart', 'barrels', 'wagon', 'wagon', 'tires', 'cart', 'boxes']);
      this.addObs(type, s, rand(-10.5, 10.5));
    }
  }

  addObs(type, s, d) {
    const o = { type, s, d, alive: true, r: 0.7, rl: 0.6, value: 80, label: '', mesh: null, v: 0 };
    switch (type) {
      case 'boxes': o.mesh = cardboardStack(); o.value = 80; o.label = 'CARDBOARD BOXES'; break;
      case 'cart': o.mesh = shoppingCart(); o.r = 0.5; o.value = 120; o.label = 'SHOPPING CART'; break;
      case 'tires': o.mesh = tireStack(); o.r = 0.6; o.value = 60; o.label = 'TIRE STACK'; break;
      case 'barrels': {
        o.mesh = new THREE.Group();
        for (let i = 0; i < 3; i++) { const b = barrel(); b.position.set(rand(-0.6, 0.6), 0, rand(-0.5, 0.5)); o.mesh.add(b); }
        o.r = 0.9; o.value = 300; o.label = 'OIL DRUMS';
        break;
      }
      case 'wagon': {
        const w = makeWagon(pick([0x3a6a9a, 0xc8b88a, 0x7a2a2a, 0x4a6a3a, 0xd0d0c8]));
        o.car = w; o.mesh = w.root; o.r = 1.0; o.rl = 2.6; o.value = 4500; o.label = 'STATION WAGON';
        o.v = rand(14, 19);
        o.d = Math.round(d / 4) * 4;
        break;
      }
      case 'fruit': {
        const f = fruitCart();
        o.fc = f; o.mesh = f.g; o.r = 1.1; o.rl = 0.7; o.value = 1200; o.label = 'FRUIT CART';
        break;
      }
      case 'glass': {
        const g = new THREE.Group();
        const pane = glassPane(); pane.position.y = 1.25; g.add(pane);
        const w1 = new Rig(SPECS.worker), w2 = new Rig({ ...SPECS.worker, capColor: 0xcc3322, jacket: 0xc89a5a });
        w1.root.position.set(1.65, 0, 0); w1.root.rotation.y = -Math.PI / 2;
        w2.root.position.set(-1.65, 0, 0); w2.root.rotation.y = Math.PI / 2;
        g.add(w1.root, w2.root);
        o.mesh = g; o.pane = pane; o.workers = [w1, w2]; o.r = 1.5; o.rl = 0.35; o.value = 650; o.label = 'PLATE GLASS';
        o.state = 'wait'; o.vd = 2.4; o.diveT = 0;
        break;
      }
    }
    this.scene.add(o.mesh);
    this.placeObs(o);
    this.obs.push(o);
    return o;
  }
  placeObs(o) {
    const yaw = this.track.world(o.s, o.d, _v);
    o.mesh.position.copy(_v);
    o.mesh.rotation.y = yaw;
  }

  smash(o, byPlayer) {
    if (!o.alive) return;
    o.alive = false;
    const g = this.game, fx = this.fx;
    const yaw = this.track.world(o.s, o.d, _v);
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const pushV = byPlayer ? this.pc.v : this.duke.v;
    const fling = (obj, up = 6, spread = 4, mult = 0.75) => {
      fx.fling(obj, fwd.clone().multiplyScalar(pushV * mult + rand(-2, 4)).add(new THREE.Vector3(rand(-spread, spread), rand(up * 0.6, up), rand(-spread, spread))),
        new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), { life: rand(3, 5) });
    };
    if (byPlayer) {
      addCollateral(g.stats, o.label, o.value);
      g.ui.toast(`+${fmtMoney(o.value)} · ${o.label}`, 'money');
    }
    const kids = () => [...o.mesh.children].filter((c) => c.isMesh || c.isGroup);
    switch (o.type) {
      case 'boxes': case 'cart': case 'tires':
        g.audio.sfx(o.type === 'cart' ? 'clang' : 'thump');
        for (const k of kids()) fling(k, 7, 3);
        fx.dust(_v, 10);
        o.mesh.removeFromParent();
        break;
      case 'barrels':
        g.audio.sfx('explosion');
        fx.explosion(_v, 1.1);
        for (const k of kids()) fling(k, 14, 5, 0.4);
        o.mesh.removeFromParent();
        this.shake = Math.max(this.shake, 1);
        if (byPlayer) this.damage(5);
        break;
      case 'wagon':
        g.audio.sfx('explosion');
        g.audio.sfx('crunch');
        fx.explosion(_v, 1.6);
        fx.fling(o.mesh, fwd.clone().multiplyScalar(pushV * 0.5 + o.v * 0.5).add(new THREE.Vector3(0, 13, 0)), new THREE.Vector3(rand(-3, 3), rand(-2, 2), rand(-4, 4)), { life: 4, bounce: 0.3 });
        this.shake = Math.max(this.shake, 1.4);
        if (byPlayer) { this.damage(8); this.quip('wagon', [['delgado', 'Was there a FAMILY in that?!'], ['hammer', 'They jumped. Probably.']]); }
        else this.quip('wagonDuke', [['hammer', "That one's not on our tab!"]]);
        break;
      case 'fruit': {
        g.audio.sfx('crunch');
        for (const f of o.fc.fruits) fling(f, 9, 6, 0.6);
        fling(o.fc.umb, 12, 2, 0.5);
        for (const k of kids()) if (!o.fc.fruits.includes(k) && k !== o.fc.umb) fling(k, 5, 3);
        o.mesh.removeFromParent();
        fx.confetti(_v.clone().setY(1.2), 25);
        if (byPlayer) {
          const n = g.stats.items['FRUIT CART'] || 0;
          if (n <= 1) this.quip('fruit1', [['hammer', 'Who keeps putting fruit carts in a RIVER?!']]);
          else this.quip('fruit2', [['delgado', "That's two, Rex. The Captain's going to have a stroke."]]);
        }
        break;
      }
      case 'glass':
        g.audio.sfx('glass');
        for (let i = 0; i < 40; i++) fx.glow.spawn(_v.x + rand(-1.5, 1.5), 1.2 + rand(-0.8, 0.8), _v.z + rand(-1.5, 1.5), fwd.x * pushV * 0.6 + rand(-4, 4), rand(1, 6), fwd.z * pushV * 0.6 + rand(-4, 4), rand(0.4, 1), 0.12, 0.7, 0.9, 1, 1, 14);
        o.pane.removeFromParent();
        if (byPlayer) this.quip('glass' + (g.stats.items['PLATE GLASS'] || 0), [['hammer', pick(['Every time.', 'Who carries glass across a RIVER?', 'Somebody call a glazier.'])]]);
        break;
    }
    if (byPlayer) {
      this.pc.v *= o.type === 'wagon' ? 0.72 : o.type === 'barrels' ? 0.85 : 0.93;
      this.damage(o.type === 'fruit' ? 4 : 2);
    }
  }

  // ------------------------------------------------------------------ car state
  placeCar(car, s, d, psi, roll = 0, pitch = 0, extraYaw = 0) {
    const yaw = this.track.world(s, d, _v);
    car.root.position.copy(_v);
    car.root.rotation.y = yaw + psi + extraYaw;
    car.body.rotation.z = roll;
    car.body.rotation.x = pitch;
    return yaw;
  }

  damage(amount) {
    const pc = this.pc, g = this.game, car = this.car;
    pc.damage = Math.min(100, pc.damage + amount);
    g.stats.carDamage = Math.round(pc.damage);
    g.stats.repair = Math.round(pc.damage * 92 + g.stats.hubcaps * 35);
    const steps = [
      [5, 'cap0'], [13, 'cap3'], [22, 'bumperSag'], [31, 'cap1'], [40, 'hood'], [50, 'door'],
      [60, 'cap2'], [68, 'trunk'], [76, 'bumperF'], [84, 'mirror'], [92, 'bumperR'], [97, 'antenna'],
    ];
    for (const [at, key] of steps) if (pc.damage >= at && !pc.broke.has(key)) { pc.broke.add(key); this.breakPart(key); }
  }
  breakPart(key) {
    const car = this.car, g = this.game;
    const yaw = this.car.root.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const throwIt = (obj, side = 0) => {
      const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      this.fx.fling(obj, fwd.clone().multiplyScalar(this.pc.v * 0.55).add(left.multiplyScalar(side * rand(2, 5))).add(new THREE.Vector3(0, rand(3, 6), 0)),
        new THREE.Vector3(rand(-10, 10), rand(-10, 10), rand(-10, 10)), { life: 5, bounce: 0.5 });
    };
    if (key.startsWith('cap')) {
      const w = car.wheels[+key[3]];
      throwIt(w.hub, Math.sign(w.g.position.x));
      g.stats.hubcaps++;
      g.audio.sfx('clang');
      if (key === 'cap0') this.quip('cap', [['hammer', "That's fine. She had four."]]);
      if (key === 'cap1') this.quip('cap2', [['delgado', 'Rex, the hubcaps are leaving without us.']]);
      return;
    }
    switch (key) {
      case 'bumperSag': car.bumperF.rotation.z = 0.32; car.bumperF.position.y -= 0.12; g.audio.sfx('scrape'); break;
      case 'hood': this.hoodUp = true; g.audio.sfx('clang'); this.quip('hood', [['delgado', "Rex, I can't see the road."], ['hammer', "It's still there. Trust me."]]); break;
      case 'door':
        throwIt(car.door, -1);
        g.stats.doorLost = true;
        g.audio.sfx('crunch');
        this.quip('door', [['delgado', 'REX. MY DOOR.'], ['hammer', 'It was never really your door, Dee Dee.']]);
        break;
      case 'trunk': this.trunkUp = true; g.audio.sfx('clang'); break;
      case 'bumperF': throwIt(car.bumperF, 0); g.audio.sfx('clang'); break;
      case 'mirror': throwIt(car.mirror, 1); break;
      case 'bumperR': throwIt(car.bumperR, 0); g.audio.sfx('clang'); this.quip('bumperR', [['delgado', 'We are now legally a go-kart.']]); break;
      case 'antenna': throwIt(car.antenna, 1); break;
    }
  }

  quip(key, lines) {
    if (this.quips.has(key)) return;
    this.quips.add(key);
    let delay = 0;
    for (const [who, text] of lines) {
      setTimeout(() => { if (!this.dead) this.game.ui.sub(who, text, 3); }, delay);
      delay += 1500;
    }
  }

  // ------------------------------------------------------------------ script
  async intro() {
    const g = this.game, ui = g.ui;
    ui.letterbox(true);
    await this.w(ui.fade(0, 0.8));
    await this.w(ui.locationCard(['THE L.A. RIVER', '9:52 PM'], 1.2));
    ui.toast('(FILMED DAY-FOR-NIGHT)', 'good');
    await this.say('duke', 'So long, coppers! Nobody catches the Disco Duke!');
    this.dukeGo = true;
    g.audio.sfx('screech');
    this.camMode = 'introCar';
    await this.say('delgado', "He's heading downriver!");
    await this.say('hammer', 'Hang on to something.');
    await this.say('delgado', "To what? My door's held on with duct tape.");
    ui.letterbox(false);
    this.camMode = 'chase';
    this.phase = 'drive';
    this.pc.v = Math.max(this.pc.v, 24);
    this.duke.v = Math.max(this.duke.v, 30);
    g.audio.playSong('chase');
    g.audio.engineStart();
    ui.toast('CATCH THE DUKE!', 'big');
    ui.sub('narrator', g.mode === 2 ? 'P1: W/S gas & brake, A/D steer. P2: arrows aim, ENTER shoots.' : 'W/S gas & brake, A/D steer. Ram him! Delgado shoots automatically.', 5);
  }

  async endChase(wrecked) {
    if (this.phase === 'end') return;
    const g = this.game, ui = g.ui;
    this.phase = 'end';
    g.stats.chaseTime = this.t;
    g.stats.dukeWrecked = wrecked;
    if (wrecked) {
      this.duke.wrecked = true;
      g.stats.wfm++;
      g.audio.sfx('screech');
      g.audio.sfx('crunch');
      g.slowmo(0.35, 1.3);
      ui.worksForMe("THE DUKE'S RIDE IS TOTALED");
      g.audio.sfx('wfm');
    }
    this.camMode = 'end';
    await this.wait(1.6);
    g.audio.engineStop();
    ui.letterbox(true);
    if (wrecked) {
      await this.say('delgado', "He's bailing out! He's running for that warehouse on Mission Road!");
      await this.say('hammer', "Disco's dead, Duke.");
      await this.say('delgado', "...That doesn't even make sense, Rex.");
      await this.say('hammer', 'Works for me.');
    } else {
      await this.say('delgado', "He's pulling off at the old Mission Road warehouses!");
      await this.say('hammer', "Then that's where we're going.");
    }
    g.audio.stopMusic(0.6);
    await this.w(ui.fade(1, 0.7));
    g.goto('warehouse');
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    const g = this.game;
    g.ui.L.hud.innerHTML = `
      <div class="hud">
        <div class="tl"><div class="lbl">THE DISCO DUKE</div><div class="bar pink"><i id="grit"></i></div><div class="small">GRIT</div></div>
        <div class="tc"><div class="gap">GAP <b id="gap">0</b> M</div><div class="warn" id="warn">HE'S GETTING AWAY!</div></div>
        <div class="tr"><div class="lbl">COLLATERAL <b id="coll" style="color:var(--gold)">$0</b></div><div class="lbl">REPAIR BILL <b id="rep" style="color:var(--orange)">$0</b></div></div>
        <div class="bl"><div class="lbl">P1 · HAMMER · DRIVING</div><div class="small">${g.mode === 2 ? 'P2 · DELGADO · AIM &amp; SHOOT' : 'DELGADO IS SHOOTING · F = HORN'}</div></div>
        <div class="br"><div class="speedo"><b id="mph">0</b><span>MPH</span></div></div>
        <div class="reticle" id="ret"></div>
      </div>`;
    const q = (id) => g.ui.L.hud.querySelector('#' + id);
    this.hud = { grit: q('grit'), gap: q('gap'), warn: q('warn'), coll: q('coll'), rep: q('rep'), mph: q('mph'), ret: q('ret') };
    this.hudCache = {};
    this.hud.root = g.ui.L.hud.firstElementChild;
  }
  setHud(key, val, fn) {
    if (this.hudCache[key] === val) return;
    this.hudCache[key] = val;
    fn(val);
  }
  updateHud() {
    const h = this.hud, s = this.game.stats;
    const show = this.phase !== 'intro';
    h.root.style.visibility = show ? 'visible' : 'hidden';
    this.setHud('grit', Math.max(0, Math.round(this.duke.grit)), (v) => (h.grit.style.width = v + '%'));
    this.setHud('gap', Math.max(0, Math.round(this.duke.s - this.pc.s)), (v) => (h.gap.textContent = v));
    this.setHud('warn', this.escapeT > 0.2, (v) => h.warn.classList.toggle('on', v));
    this.setHud('coll', s.collateral, (v) => (h.coll.textContent = fmtMoney(v)));
    this.setHud('rep', s.repair, (v) => (h.rep.textContent = fmtMoney(v)));
    this.setHud('mph', Math.round(this.pc.v * 2.237), (v) => (h.mph.textContent = v));
    const p2 = this.game.mode === 2 && this.phase === 'drive';
    h.ret.style.display = p2 ? 'block' : 'none';
    if (p2) { h.ret.style.left = ((this.p2.rx + 1) / 2) * 100 + '%'; h.ret.style.top = ((1 - this.p2.ry) / 2) * 100 + '%'; }
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    const g = this.game, pc = this.pc, duke = this.duke;
    const drive = this.phase === 'drive';
    const c = g.input.controls(0);
    pc.hitCD -= dt; pc.wallCD -= dt; pc.ramCD -= dt; this.screechCD -= dt;

    // ---- player car physics (track space)
    let thr = 0, brk = 0, steer = 0;
    if (drive) {
      thr = c.throttle; brk = c.brake;
      steer = clamp(c.mx + c.turn, -1, 1);
      if (c.action) { g.audio.sfx('horn'); g.stats.horn++; }
    } else if (this.phase === 'end') brk = 0.6;
    pc.steer = damp(pc.steer, steer, 10, dt);
    const vmax = 50 * (1 - pc.damage * 0.0008);
    if (thr > 0) pc.v += 17 * (1 - pc.v / vmax) * thr * dt;
    else pc.v -= 2.5 * dt;
    if (brk > 0) pc.v -= 24 * brk * dt;
    pc.v = clamp(pc.v, 0, vmax + 6);
    const rate = (1.75 * Math.min(1, pc.v / 8)) / (1 + pc.v * 0.012);
    pc.psi += -pc.steer * rate * dt;
    pc.psi = damp(pc.psi, 0, Math.abs(steer) < 0.1 ? 2.4 : 0.5, dt);
    pc.psi = clamp(pc.psi, -0.8, 0.8);
    pc.s += pc.v * Math.cos(pc.psi) * dt;
    pc.d += pc.v * Math.sin(pc.psi) * dt;
    if (Math.abs(pc.d) > WALL) {
      const sg = Math.sign(pc.d);
      pc.d = sg * WALL;
      pc.psi = -sg * Math.abs(pc.psi) * 0.35;
      pc.v *= 0.86;
      if (pc.wallCD <= 0) {
        pc.wallCD = 0.4;
        this.damage(2 + pc.v * 0.05);
        g.audio.sfx('scrape');
        this.track.world(pc.s, pc.d, _v, 0.6);
        this.fx.sparks(_v, 14);
        this.shake = Math.max(this.shake, 0.5);
      }
    }
    if (drive && Math.abs(steer) > 0.8 && pc.v > 32 && this.screechCD <= 0) { this.screechCD = 1.1; g.audio.sfx('screech', 0.6); }

    // ---- duke
    this.updateDuke(dt);

    // ---- obstacles
    for (const o of this.obs) {
      if (!o.alive) continue;
      if (o.type === 'wagon') {
        o.s += o.v * dt;
        this.placeObs(o);
        for (const w of o.car.wheels) w.spin.rotation.x += (o.v / 0.34) * dt;
      }
      if (o.type === 'glass') this.updateGlass(o, dt);
    }
    if (this.phase !== 'intro') this.collide();

    // ---- shooting
    if (drive) {
      this.updateGunner(dt);
      this.updateGoon(dt);
    }

    // ---- car visuals
    const onSlope = Math.abs(pc.d) > FLOOR ? Math.sign(pc.d) * Math.atan(SLOPE) * Math.min(1, (Math.abs(pc.d) - FLOOR) / 1.5) : 0;
    pc.roll = damp(pc.roll, onSlope + pc.steer * 0.05 * (pc.v / 50), 8, dt);
    pc.pitch = damp(pc.pitch, (thr - brk) * -0.025, 5, dt);
    this.placeCar(this.car, pc.s, pc.d, pc.psi, pc.roll, pc.pitch);
    this.car.body.position.y = Math.sin(this.t * 17) * 0.015 * (pc.v / 50) + (pc.damage > 50 ? Math.sin(this.t * 23) * 0.02 : 0);
    for (let i = 0; i < 4; i++) {
      const w = this.car.wheels[i];
      w.spin.rotation.x += (pc.v / 0.36) * dt;
      if (i < 2) w.g.rotation.y = pc.steer * -0.4;
    }
    if (this.hoodUp) this.car.hood.rotation.x = -0.65 + Math.sin(this.t * 21) * 0.12 * (pc.v / 50);
    if (this.trunkUp) this.car.trunk.rotation.x = 0.7 + Math.sin(this.t * 17) * 0.15 * (pc.v / 50);
    if (pc.damage > 45 && Math.random() < dt * 22) {
      this.car.hood.getWorldPosition(_v); _v.y += 0.3;
      this.fx.smoke(_v, 0.45, pc.damage > 80 ? [0.12, 0.12, 0.12] : [0.4, 0.4, 0.42]);
    }
    if (duke.grit < 45 && Math.random() < dt * 20) {
      this.dukeCar.root.getWorldPosition(_v); _v.y += 1.0;
      this.fx.smoke(_v, 0.5, [0.2, 0.2, 0.22]);
    }

    this.waterMat.map.offset.y -= dt * 0.25;
    this.fx.update(dt);
    this.updateCamera(dt);
    if (this.skyline) this.skyline.position.set(this.camera.position.x, 50, this.camera.position.z);
    this.scene.children[0].position.copy(this.camera.position);
    if (g.audio.engineOn) g.audio.engineSet(pc.v / 50, thr);
    this.updateHud();

    // ---- end conditions
    if (drive) {
      if (duke.grit <= 0) this.run(() => this.endChase(true));
      else if (duke.s > this.track.length - 200) this.run(() => this.endChase(false));
      const gap = duke.s - pc.s;
      if (gap > ESCAPE_GAP) this.escapeT += dt; else this.escapeT = Math.max(0, this.escapeT - dt * 2);
      if (this.escapeT > 6) {
        this.phase = 'failed';
        g.fail('HE GOT AWAY!', 'You let a man in a <i>white leisure suit</i> outrun the Brougham.');
      }
    }
  }

  updateDuke(dt) {
    const duke = this.duke, pc = this.pc;
    const gap = duke.s - pc.s;
    let target;
    if (this.phase === 'intro') target = this.dukeGo ? 5 : 0;
    else if (duke.wrecked) target = 0;
    else if (gap < 22) target = 45;
    else if (gap > 120) target = 25;
    else if (gap > 80) target = 31;
    else target = 37 + Math.sin(this.t * 0.4) * 3;
    if (duke.grit < 35 && !duke.wrecked) target -= 3;
    duke.v = damp(duke.v, target, duke.wrecked ? 1.6 : 1.2, dt);
    duke.s += duke.v * dt;
    if (!duke.wrecked) {
      duke.weaveT -= dt;
      if (duke.weaveT <= 0) { duke.weaveT = rand(1.8, 3.6); const cand = rand(-8.5, 8.5); if (!this.conflict(duke.s, cand)) duke.targetD = cand; }
      const o = this.conflict(duke.s, duke.targetD);
      if (o) {
        const shift = o.d >= duke.targetD ? -(o.r + 2.6) : o.r + 2.6;
        let nd = clamp(o.d + shift, -10.5, 10.5);
        if (this.conflict(duke.s, nd)) nd = clamp(o.d - shift, -10.5, 10.5);
        duke.targetD = nd;
      }
    } else {
      duke.targetD = Math.sign(duke.d || 1) * 15.5;
      duke.spin += dt * duke.v * 0.12;
    }
    const step = clamp(duke.targetD - duke.d, -7 * dt, 7 * dt);
    duke.d += step;
    duke.psi = damp(duke.psi, Math.atan2(step / Math.max(dt, 1e-4), Math.max(duke.v, 1)) * 0.8, 6, dt);
    const roll = Math.abs(duke.d) > FLOOR ? Math.sign(duke.d) * Math.atan(SLOPE) * Math.min(1, (Math.abs(duke.d) - FLOOR) / 1.5) : 0;
    this.placeCar(this.dukeCar, duke.s, duke.d, duke.psi, roll, 0, duke.spin);
    for (const w of this.dukeCar.wheels) w.spin.rotation.x += (duke.v / 0.34) * dt;
    // duke plows through junk (not on your tab)
    for (const o of this.obs) {
      if (!o.alive || o.solid) continue;
      const ds = o.s - duke.s;
      if (Math.abs(ds) < CAR_HL + o.rl && Math.abs(o.d - duke.d) < CAR_HW + o.r) this.smash(o, false);
    }
  }
  conflict(s, d) {
    for (const o of this.obs) {
      if (!o.alive || o.type === 'glass') continue;
      const ahead = o.s - s;
      if (ahead > 0 && ahead < 48 && Math.abs(o.d - d) < o.r + 1.9) return o;
    }
    return null;
  }

  updateGlass(o, dt) {
    const pc = this.pc;
    const ahead = o.s - pc.s;
    if (o.state === 'wait' && ahead < 150) o.state = 'cross';
    if (o.state === 'cross') {
      o.d += o.vd * dt;
      if (o.d > 13) o.vd = -Math.abs(o.vd);
      if (o.d < -13) o.vd = Math.abs(o.vd);
      if (ahead < 24 && ahead > 0 && Math.abs(o.d - pc.d) < 6) {
        o.state = 'dive';
        this.game.ui.sub('worker', pick(['WHOA WHOA WHOA!', 'NOT AGAIN!', 'I just got this pane!']), 2);
      }
      this.placeObs(o);
    }
    for (const [i, w] of o.workers.entries()) {
      if (o.state === 'dive') {
        o.diveT += dt * 0.5;
        const side = i === 0 ? 1 : -1;
        w.root.position.x = side * (1.65 + Math.min(1, o.diveT * 2) * 3.5);
        w.root.position.y = Math.sin(Math.min(1, o.diveT * 2) * Math.PI) * 0.8;
        w.body.rotation.x = Math.min(1, o.diveT * 2) * 1.4;
        w.update(dt, { pose: 'dive', noBob: true });
      } else {
        w.update(dt, { pose: 'carry', speed: o.state === 'cross' ? 0.4 : 0 });
      }
    }
  }

  collide() {
    const pc = this.pc, duke = this.duke, g = this.game;
    for (const o of this.obs) {
      if (!o.alive) continue;
      const ds = o.s - pc.s;
      if (ds > 8 || ds < -8) continue;
      if (Math.abs(ds) < CAR_HL + o.rl && Math.abs(o.d - pc.d) < CAR_HW + o.r) {
        if (o.solid) {
          if (pc.hitCD > 0) continue;
          pc.hitCD = 0.5;
          pc.v *= 0.35;
          pc.s = o.s - (CAR_HL + o.rl) - 0.15;
          pc.psi *= -0.5;
          this.damage(14);
          g.audio.sfx('crunch');
          this.track.world(pc.s + 2.5, pc.d, _v, 0.8);
          this.fx.sparks(_v, 20);
          this.fx.dust(_v, 12);
          this.shake = 1.4;
          this.quip('pillar' + Math.floor(this.t / 20), [['delgado', pick(['PILLAR!', '...Pillar.', 'That was a load-bearing pillar, Rex.'])]]);
        } else if (o.type === 'glass' && !o.pane.parent) {
          continue;
        } else {
          this.smash(o, true);
        }
      }
    }
    // ram the duke
    const ds = duke.s - pc.s, dd = duke.d - pc.d;
    if (!duke.wrecked && Math.abs(ds) < 4.9 && Math.abs(dd) < 2.05 && pc.ramCD <= 0) {
      pc.ramCD = 0.6;
      if (ds > 2.0) {
        const rel = Math.max(0, pc.v - duke.v);
        duke.grit -= clamp(5 + rel * 1.3, 5, 18);
        pc.v = Math.max(0, duke.v - 3);
        pc.s = duke.s - 4.95;
        duke.v += 2.5;
      } else {
        const sg = Math.sign(dd) || 1;
        duke.d += sg * 1.2;
        pc.d -= sg * 0.8;
        duke.targetD = clamp(duke.d + sg * 3, -10.5, 10.5);
        duke.grit -= 7;
        pc.psi -= sg * 0.15;
      }
      this.damage(3.5);
      g.audio.sfx('crunch');
      this.track.world((duke.s + pc.s) / 2, (duke.d + pc.d) / 2, _v, 0.8);
      this.fx.sparks(_v, 22);
      this.shake = Math.max(this.shake, 0.9);
      g.ui.toast('RAMMED!', 'good');
      if (Math.random() < 0.4) g.ui.sub('duke', pick(['My PAINT JOB!', 'Watch the fenders, pig!', "Do you know what this car COST?!"]), 2.2);
    }
  }

  windowPos(out) {
    out.set(-1.05, 1.3, 0.35);
    return this.car.root.localToWorld(out);
  }

  updateGunner(dt) {
    const g = this.game, duke = this.duke, pc = this.pc;
    const gap = duke.s - pc.s;
    if (g.mode === 1) {
      this.aiShootT -= dt;
      if (this.aiShootT <= 0 && gap > 5 && gap < 115) {
        this.aiShootT = 0.42;
        const from = this.windowPos(_v);
        this.dukeCar.root.getWorldPosition(_v2);
        _v2.y += 0.8;
        const hit = Math.random() < (gap < 50 ? 0.45 : 0.3);
        if (!hit) _v2.add(_v3.set(rand(-2.5, 2.5), rand(-0.5, 1.5), rand(-2.5, 2.5)));
        this.fx.muzzle(from);
        this.fx.tracer(from, _v2);
        g.audio.sfx('pistol', 0.45);
        g.stats.shots++;
        if (hit) { duke.grit -= 1.0; g.stats.hits++; this.fx.sparks(_v2, 5); g.audio.sfx('impact', 0.5); }
      }
      return;
    }
    // P2 aims a reticle and shoots
    const c = g.input.controls(1);
    const p = this.p2;
    p.rx = clamp(p.rx + (c.mx + c.turn) * 1.3 * dt, -0.92, 0.92);
    p.ry = clamp(p.ry + c.my * 1.1 * dt, -0.85, 0.85);
    p.cd -= dt;
    if (c.fire && p.cd <= 0) {
      p.cd = 0.17;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(p.rx, p.ry), this.camera);
      const targets = [this.dukeCar.root, ...this.obs.filter((o) => o.alive && !o.solid).map((o) => o.mesh)];
      const hits = ray.intersectObjects(targets, true);
      const from = this.windowPos(_v);
      const to = hits.length ? hits[0].point : ray.ray.at(120, new THREE.Vector3());
      this.fx.muzzle(from);
      this.fx.tracer(from, to);
      g.audio.sfx('pistol', 0.6);
      g.stats.shots++;
      if (hits.length) {
        let o = hits[0].object;
        while (o && o !== this.dukeCar.root && !this.obs.some((ob) => ob.mesh === o)) o = o.parent;
        if (o === this.dukeCar.root) { duke.grit -= 1.6; g.stats.hits++; this.fx.sparks(to, 6); g.audio.sfx('impact', 0.6); }
        else if (o) { const ob = this.obs.find((x) => x.mesh === o); if (ob && ob.type !== 'glass') this.smash(ob, true); else this.fx.sparks(to, 4); }
      }
    }
  }

  updateGoon(dt) {
    const g = this.game, duke = this.duke, pc = this.pc;
    const gap = duke.s - pc.s;
    duke.goonT -= dt;
    if (duke.goonT <= 0 && gap > 6 && gap < 90 && !duke.wrecked) {
      duke.goonT = rand(2.2, 4.2);
      this.shots.push(0, 0.13, 0.26);
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      this.shots[i] -= dt;
      if (this.shots[i] > 0) continue;
      this.shots.splice(i, 1);
      const from = this.dukeCar.root.localToWorld(_v.set(-1.0, 1.15, -0.3));
      const to = this.car.root.localToWorld(_v2.set(rand(-1.5, 1.5), rand(0.6, 1.6), rand(-1, 2)));
      const hit = Math.random() < 0.12;
      if (!hit) to.add(_v3.set(rand(-3, 3), rand(0.5, 2.5), rand(-3, 3)));
      this.fx.muzzle(from, 0xffc080);
      this.fx.tracer(from, to, 0xffb080);
      g.audio.sfx('enemyShot', 0.5);
      g.stats.henchShots++;
      if (hit) { g.stats.henchHits++; this.damage(1.2); this.fx.sparks(to, 5); g.audio.sfx('impact', 0.7); }
      else if (Math.random() < 0.35) g.audio.sfx('ricochet', 0.6);
    }
  }

  updateCamera(dt, snap = false) {
    const pc = this.pc, cam = this.camera;
    const yaw = this.car.root.rotation.y;
    const f = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    const carP = this.car.root.position;
    let want = new THREE.Vector3(), look = new THREE.Vector3();
    switch (this.camMode) {
      case 'introDuke': {
        const dp = this.dukeCar.root.position, dy = this.dukeCar.root.rotation.y;
        const df = new THREE.Vector3(Math.sin(dy), 0, Math.cos(dy)), dl = new THREE.Vector3(Math.cos(dy), 0, -Math.sin(dy));
        want.copy(dp).addScaledVector(dl, -6).addScaledVector(df, 4).add(new THREE.Vector3(0, 1.4, 0));
        look.copy(dp).add(new THREE.Vector3(0, 0.9, 0));
        break;
      }
      case 'introCar':
        want.copy(carP).addScaledVector(f, -6.5).add(new THREE.Vector3(0, 2.3, 0));
        look.copy(carP).addScaledVector(f, 6).add(new THREE.Vector3(0, 1.1, 0));
        break;
      case 'end': {
        const dp = this.dukeCar.root.position;
        want.copy(carP).addScaledVector(f, -7).add(new THREE.Vector3(0, 3.2, 0));
        look.copy(dp).add(new THREE.Vector3(0, 0.8, 0));
        break;
      }
      default:
        want.copy(carP).addScaledVector(f, -8.6).add(new THREE.Vector3(0, 3.4, 0));
        look.copy(carP).addScaledVector(f, 9).add(new THREE.Vector3(0, 1.0, 0));
    }
    if (snap) cam.position.copy(want);
    else cam.position.lerp(want, 1 - Math.exp(-(this.camMode === 'chase' ? 7 : 3) * dt));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.shake > 0) cam.position.add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.shake * 0.25));
    cam.lookAt(look);
    const fov = 64 + (pc.v / 50) * 10;
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = damp(cam.fov, fov, 3, dt); cam.updateProjectionMatrix(); }
  }
}
