import * as THREE from 'three';
import { Scene } from '../scene.js';
import { FX } from '../fx.js';
import { makeSign } from '../env.js';
import { Rig, SPECS, goonSpec, M, B, box, cyl, crate, barrel, donut, discoBall, texMat, cardboardStack } from '../models.js';
import { tex, texR } from '../textures.js';
import { clamp, rand, pick, damp, dampAngle, wrapAngle, resolveCircleBox, rayBox, rayCircle } from '../util.js';
import { addCollateral } from '../stats.js';

const WEAPONS = {
  hammer: { name: 'GERALD · .44 MAGNUM', dmg: 100, interval: 0.55, mag: 6, reload: 1.7, spread: 0.015, sfx: 'magnum', cone: 0.45, knock: 9, pips: '●' },
  delgado: { name: '9MM SERVICE PISTOL', dmg: 38, interval: 0.17, mag: 15, reload: 1.0, spread: 0.03, sfx: 'pistol', cone: 0.45, knock: 2.5, pips: '•' },
};
const GOON_ALERT = ["It's the cops!", 'Hey! The guy with the Brougham!', "Get 'em, boys!", 'Somebody tell the Duke!', 'Is that... a MULLET?', "Freeze! Wait, that's your line."];
const GOON_DIE = ['Tell my mother... she was right!', 'Not... the jeans...', 'I was two days from retirement!', 'I should have gone to dental school!', 'Disco... never... dies...', 'Worth it!', 'Ow! My polyester!', 'I regret NOTHING!'];
const HIT_LINES = { hammer: ["It's just a flesh wound. Probably.", 'That one stung.', 'Ruined a perfectly good sport coat.'], delgado: ["I'm hit! ...My BLAZER!", 'Ow! Okay. Okay.', 'These shoulder pads are not bulletproof!'] };
const DOWN_LINES = { hammer: ['Dee Dee... tell the Captain... it was the fruit cart\'s fault...'], delgado: ['Rex! Partner down! ...It\'s me. I\'m the partner.'] };
const REVIVE_LINES = ['Get up. We have a Duke to dethrone.', 'Rub some dirt on it.', 'On your feet, partner.', 'No napping on the job.'];

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

/** Episode 1 text and tuning. Subclasses (e.g. the Ep 2 gym) override config(). */
export const WAREHOUSE_CFG = {
  goonAlert: GOON_ALERT, goonDie: GOON_DIE, hitLines: HIT_LINES, downLines: DOWN_LINES, reviveLines: REVIVE_LINES,
  bossName: 'THE DISCO DUKE', bossSpeaker: 'duke',
  bossHelp1: 'BOYS! A little help here!', bossHelp2: 'Somebody DO something!',
  bossTaunts: ['Feel the BEAT!', 'Do the Hustle, pig!', 'Boogie OOGIE oogie!', "This one's a classic!"],
  barrel: { label: 'OIL DRUM', cost: 300 },
  donutToast: 'GLAZED. +35', donutLines: ['Evidence.', 'For the case file.', 'Still warm.', "Don't tell the Captain."],
  failTitle: 'BOTH OFFICERS DOWN', failLine: '"Two cops. One warehouse. Zero chairs. Unbelievable." — Capt. Brannigan',
  clearA: 'Clear. Door on the far wall.', clearB: "Clear. The Duke's got to be behind that last door.",
  objectives: {
    a: (n) => `CLEAR THE LOADING DOCK<small>${n} HENCHM${n === 1 ? 'AN' : 'EN'} LEFT</small>`,
    aDone: 'KICK IN THE DOOR<small>NORTH WALL · STOCKROOM</small>',
    b: (n) => `CLEAR THE STOCKROOM<small>${n} HENCHM${n === 1 ? 'AN' : 'EN'} LEFT</small>`,
    bDone: 'FIND THE DUKE<small>"EMPLOYEES ONLY" DOOR</small>',
    boss: 'TAKE DOWN THE DISCO DUKE',
  },
};

export class WarehouseScene extends Scene {
  /** Level text/tuning hooks (see WAREHOUSE_CFG). */
  config() { return WAREHOUSE_CFG; }
  /** Look for regular henchmen. */
  goonSpec() { return goonSpec(); }

  enter() {
    const g = this.game;
    this.cfg = this.config();
    this.pausable = true;
    this.colliders = [];
    this.barrels = [];
    this.donuts = [];
    this.enemies = [];
    this.grenades = [];
    this.tweens = [];
    this.killTimes = [];
    this.activeZones = new Set(['A']);
    this.cleared = new Set();
    this.noise = null;
    this.subCD = 0;
    this.wfmCD = 0;
    this.cutscene = true;
    this.over = false;
    this.discoOn = false;
    this.fx = new FX(this.scene, { lights: 2 });
    this.fx.setScale(g.H * 0.85);
    this.build();
    this.spawnPlayers();
    this.spawnEnemies();
    this.cams = [new THREE.PerspectiveCamera(70, 1, 0.1, 200), new THREE.PerspectiveCamera(70, 1, 0.1, 200)];
    this.cutCam = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    for (const c of this.cams) c.position.set(0, 2.4, -1);
    this.buildHud();
    this.onClick = (e) => { if (e.pointerType === 'mouse' && !this.cutscene && !g.paused && !g.failed) g.input.requestLock(); };
    g.canvas.addEventListener('pointerdown', this.onClick);
    this.run(() => this.intro());
  }

  exit() {
    this.game.canvas.removeEventListener('pointerdown', this.onClick);
    super.exit();
  }

  touchMode() { return !this.cutscene && !this.over ? 'shoot' : null; }

  // ------------------------------------------------------------------ level
  addCollider(minX, maxX, minZ, maxZ, h, extra = {}) {
    const c = { minX, maxX, minZ, maxZ, h, active: true, ...extra };
    this.colliders.push(c);
    return c;
  }
  solidBox(x, z, w, d, h, mat) {
    const m = box(w, h, d, mat);
    m.position.set(x, h / 2, z);
    this.scene.add(m);
    this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
    return m;
  }
  crateAt(x, z, w, d, h) {
    const m = crate(w, h, d);
    m.position.x = x; m.position.z = z;
    m.rotation.y = rand(-0.02, 0.02);
    this.scene.add(m);
    this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x0c0908);
    s.fog = new THREE.Fog(0x15100c, 18, 62);
    s.add(new THREE.HemisphereLight(0xc8b8a0, 0x2a2018, 1.25));
    const dl = new THREE.DirectionalLight(0xffe0b0, 0.8);
    dl.position.set(6, 20, 10);
    s.add(dl);
    const W = 40, D = 90, H = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), texMat('concreteDark', W / 4, D / 4));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, D / 2); s.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(0x4a443c));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, D / 2); s.add(ceil);
    for (let z = 6; z < D; z += 12) { const beam = box(W, 0.5, 0.4, M(0x3a3632)); beam.position.set(0, H - 0.4, z); s.add(beam); }
    const brick = (w, h) => texMat('brick', w / 4, h / 4);
    const wallPlane = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), brick(w, H)); m.position.set(x, H / 2, z); m.rotation.y = ry; s.add(m); };
    wallPlane(W, 0, 0, 0); wallPlane(W, 0, D, Math.PI); wallPlane(D, -W / 2, D / 2, Math.PI / 2); wallPlane(D, W / 2, D / 2, -Math.PI / 2);
    this.addCollider(-W / 2 - 2, W / 2 + 2, -2, 0, H);
    this.addCollider(-W / 2 - 2, W / 2 + 2, D, D + 2, H);
    this.addCollider(-W / 2 - 2, -W / 2, 0, D, H);
    this.addCollider(W / 2, W / 2 + 2, 0, D, H);
    const roll = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshLambertMaterial({ map: texR('rollup', 3, 3) }));
    roll.position.set(0, 2.5, 0.03); s.add(roll);
    const dockSign = makeSign('LOADING DOCK', { w: 4, h: 0.7, bg: '#c9a020', fg: '#111', font: 'bold 44px sans-serif' });
    dockSign.position.set(0, 5.6, 0.04); s.add(dockSign);
    // safety stripes
    for (const x of [-4.2, 4.2]) { const l = box(0.15, 0.01, 88, M(0xc9a020)); l.position.set(x, 0.01, 45); s.add(l); }

    // interior walls with doors
    this.doors = [];
    for (const [z, id, needs, unlocks, label] of [[30, 'A', 'A', 'B', 'STOCKROOM'], [60, 'B', 'B', 'C', 'EMPLOYEES ONLY']]) {
      const wm = texMat('brick', 18.4 / 4, H / 4);
      for (const sx of [-1, 1]) {
        const seg = box(18.4, H, 0.5, wm);
        seg.position.set(sx * (1.6 + 9.2), H / 2, z);
        s.add(seg);
        this.addCollider(sx > 0 ? 1.6 : -20, sx > 0 ? 20 : -1.6, z - 0.25, z + 0.25, H);
      }
      const lintel = box(3.2, H - 3.3, 0.5, wm); lintel.position.set(0, 3.3 + (H - 3.3) / 2, z); s.add(lintel);
      const sign = makeSign(label, { w: 3, h: 0.5, bg: '#7a1010', fg: '#fff', font: 'bold 40px sans-serif' });
      sign.position.set(0, 3.75, z - 0.27); sign.rotation.y = Math.PI; s.add(sign);
      const pivot = new THREE.Group();
      pivot.position.set(-1.5, 0, z);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.25, 0.14), new THREE.MeshLambertMaterial({ map: tex('door') }));
      panel.position.set(1.5, 1.625, 0);
      pivot.add(panel);
      s.add(pivot);
      const col = this.addCollider(-1.6, 1.6, z - 0.25, z + 0.25, H, { door: true });
      this.doors.push({ id, z, needs, unlocks, pivot, panel, col, open: false });
    }

    // zone A: loading dock
    for (const c of [[-12, 9, 2.4, 2.4, 2.4], [-9.5, 9, 2.4, 2.4, 1.2], [8, 11, 2.4, 2.4, 2.4], [10.5, 11, 2.4, 2.4, 2.4], [10.5, 13.5, 2.4, 2.4, 1.2], [-4, 17, 2.4, 1.2, 1.2], [3.5, 18, 2.4, 2.4, 1.2], [-14, 20, 2.4, 2.4, 2.4], [14, 22, 2.4, 2.4, 1.2], [-6, 25, 2.4, 2.4, 2.4], [6, 26, 2.4, 2.4, 2.4], [16.5, 4, 2.4, 2.4, 2.4], [-16.5, 27, 2.4, 2.4, 1.2]]) this.crateAt(...c);
    this.forklift(-3, 10);
    // zone B: stockroom shelving
    for (const x of [-14, -8.5, 8.5, 14]) this.shelf(x, 45, 22);
    for (const c of [[-3, 38, 2.4, 2.4, 1.2], [4, 42, 2.4, 2.4, 2.4], [-4, 48, 2.4, 2.4, 2.4], [2.5, 53, 2.4, 1.2, 1.2], [-5.5, 56.5, 2.4, 2.4, 1.2], [17.5, 33, 2.4, 2.4, 1.2]]) this.crateAt(...c);
    // zone C: the Duke's disco lair
    this.buildLair();

    // barrels
    for (const [x, z] of [[-8.6, 22.6], [-7.7, 23.3], [9.2, 19.6], [6.2, 47], [7.0, 47.7], [-6.5, 40], [-11.5, 66], [11.5, 66]]) this.addBarrel(x, z);
    // donuts
    for (const [x, z] of [[17, 7], [-17.5, 35], [17.5, 57], [-17, 63], [17, 63], [0, 64.5]]) this.addDonut(x, z);

    // hanging lamps
    for (const [x, z, light] of [[0, 10, true], [-10, 20, false], [10, 20, true], [0, 42, true], [-11, 40, false], [11, 52, false], [0, 52, false]]) {
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 8, 1, true), M(0x2a3a2a, { side: THREE.DoubleSide }));
      shade.position.set(x, 6.4, z); s.add(shade);
      const bulb = box(0.3, 0.2, 0.3, B(0xfff0c0)); bulb.position.set(x, 6.2, z); s.add(bulb);
      const cord = box(0.03, 1.4, 0.03, M(0x111111)); cord.position.set(x, 7.3, z); s.add(cord);
      if (light) { const L = new THREE.PointLight(0xffd8a0, 14, 22, 1.5); L.position.set(x, 5.9, z); s.add(L); }
    }
    for (let z = 8; z < 58; z += 14) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshLambertMaterial({ map: tex('poster') }));
      p.position.set(-19.95, 2.4, z); p.rotation.y = Math.PI / 2; s.add(p);
    }
  }

  forklift(x, z) {
    const s = this.scene;
    const g = new THREE.Group();
    const body = box(1.4, 1.1, 2.0, M(0xe0a020)); body.position.y = 0.75; g.add(body);
    const cage = box(1.3, 0.08, 1.2, M(0x222222)); cage.position.set(0, 2.2, -0.2); g.add(cage);
    for (const sx of [-0.6, 0.6]) for (const sz of [-0.7, 0.3]) { const p = box(0.06, 1.1, 0.06, M(0x222222)); p.position.set(sx, 1.65, sz); g.add(p); }
    const mast = box(1.0, 2.6, 0.12, M(0x333333)); mast.position.set(0, 1.3, 1.1); g.add(mast);
    for (const sx of [-0.35, 0.35]) { const f = box(0.12, 0.06, 1.2, M(0x555555)); f.position.set(sx, 0.2, 1.75); g.add(f); }
    g.position.set(x, 0, z); s.add(g);
    this.addCollider(x - 0.75, x + 0.75, z - 1.05, z + 2.3, 2.2);
  }

  shelf(x, z, len) {
    const s = this.scene;
    const g = new THREE.Group();
    const mat = M(0x3a5a8a);
    for (const y of [0.1, 1.5, 2.9, 4.3]) { const b = box(1.4, 0.08, len, M(0x777f88)); b.position.y = y; g.add(b); }
    for (const sz of [-len / 2, -len / 4, 0, len / 4, len / 2]) for (const sx of [-0.65, 0.65]) { const u = box(0.08, 4.4, 0.08, mat); u.position.set(sx, 2.2, sz); g.add(u); }
    const back = box(0.05, 4.3, len, M(0x2a2622)); back.position.y = 2.2; g.add(back);
    const denim = texMat('denim', 2, 1);
    for (const y of [0.14, 1.54, 2.94]) {
      for (let k = -len / 2 + 1; k < len / 2 - 0.5; k += rand(1.0, 1.6)) {
        if (Math.random() < 0.2) continue;
        const card = Math.random() < 0.5;
        const h = rand(0.5, 1.1);
        const b = box(1.1, h, rand(0.6, 1.1), card ? texMat('cardboard') : denim);
        b.position.set(0, y + h / 2 + 0.04, k);
        g.add(b);
      }
    }
    g.position.set(x, 0, z); s.add(g);
    this.addCollider(x - 0.75, x + 0.75, z - len / 2, z + len / 2, 4.4);
  }

  buildLair() {
    const s = this.scene;
    // disco floor (instanced tiles)
    const nx = 8, nz = 7;
    this.tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1.92, 0.06, 1.92), new THREE.MeshBasicMaterial({ color: 0xffffff }), nx * nz);
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      m4.makeTranslation(-7 + a * 2, 0.03, 71 + b * 2);
      this.tiles.setMatrixAt(i, m4);
      this.tiles.setColorAt(i, new THREE.Color(0x221a2a));
      i++;
    }
    s.add(this.tiles);
    this.tileGrid = { nx, nz };
    this.tileT = 0;
    // DJ booth + speakers
    const booth = this.solidBox(0, 87.6, 6, 1.6, 1.3, M(0x1a1a22));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.1), new THREE.MeshBasicMaterial({ map: tex('neon') }));
    front.position.set(0, 0.68, 86.79); front.rotation.y = Math.PI; s.add(front);
    for (const sx of [-1.4, 1.4]) { const tt = cyl(0.35, 0.35, 0.06, 10, M(0x111111)); tt.position.set(sx, 1.34, 87.6); s.add(tt); }
    for (const sx of [-8.5, 8.5]) this.solidBox(sx, 88, 1.6, 1.6, 3.2, M(0x151515));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: tex('neon') }));
    sign.position.set(0, 5.2, 89.95); sign.rotation.y = Math.PI; s.add(sign);
    // jeans racks
    for (const [x, z] of [[-15, 68], [15, 68], [-15, 82], [15, 82]]) this.solidBox(x, z, 1.2, 5, 1.7, texMat('denim', 1, 3));
    // couch
    this.solidBox(-12.5, 75, 1.2, 3.4, 0.9, M(0xa02a6a));
    this.solidBox(12.5, 75, 1.2, 3.4, 0.9, M(0xa02a6a));
    // mirror ball
    this.ball = discoBall(0.9);
    this.ball.position.set(0, 6.3, 77);
    s.add(this.ball);
    const cord = box(0.03, 1.5, 0.03, M(0x111111)); cord.position.set(0, 7.4, 77); s.add(cord);
    this.discoLights = [new THREE.PointLight(0xff3fa4, 0, 22, 1.4), new THREE.PointLight(0x3ef2ff, 0, 22, 1.4), new THREE.PointLight(0xffd23f, 0, 18, 1.4)];
    for (const L of this.discoLights) { L.position.set(0, 4, 77); s.add(L); }
  }

  addBarrel(x, z) {
    const m = barrel();
    m.position.set(x, 0, z);
    this.scene.add(m);
    const col = this.addCollider(x - 0.42, x + 0.42, z - 0.42, z + 0.42, 1.15, { barrel: true });
    this.barrels.push({ x, z, hp: 2, mesh: m, col, alive: true });
  }
  addDonut(x, z) {
    const m = donut();
    m.position.set(x, 0.9, z);
    this.scene.add(m);
    this.donuts.push({ x, z, mesh: m, taken: false });
  }

  // ------------------------------------------------------------------ actors
  spawnPlayers() {
    const mk = (id, x) => {
      const rig = new Rig(SPECS[id]);
      this.scene.add(rig.root);
      const W = WEAPONS[id];
      return {
        id, name: id.toUpperCase(), rig, x, z: 4, yaw: 0, aimYaw: 0, hp: 100, maxHp: 100, r: 0.42,
        down: false, reviveT: 0, diveT: 0, diveV: 0, diveDir: { x: 0, z: 1 }, getupT: 0, cool: 0, aiCool: 0,
        ammo: W.mag, reloadT: 0, aimT: 0, kickT: 0, weapon: W, moving: 0, speed: id === 'hammer' ? 5.0 : 5.6,
        pose: null, flashT: 0,
      };
    };
    this.chars = [mk('hammer', -1.2), mk('delgado', 1.2)];
    this.active = 0;
  }
  ctrlOf(i) {
    if (this.game.mode === 2) return i;
    return i === this.active ? 0 : 'ai';
  }
  /** viewport index for a char (or -1 if not shown) */
  vpOf(i) { return this.game.mode === 2 ? i : i === this.active ? 0 : -1; }

  spawnEnemies() {
    const list = [
      ['A', -10, 24], ['A', 4, 23], ['A', 12, 17], ['A', -2, 27.5],
      ['B', -17, 45], ['B', 17, 40], ['B', -11, 52], ['B', 11, 50], ['B', 0, 50], ['B', 4, 57.5],
      ['C', -10.5, 72], ['C', 10.5, 72],
    ];
    for (const [zone, x, z] of list) this.addGoon(zone, x, z);
    const rig = new Rig(SPECS.duke);
    this.scene.add(rig.root);
    this.boss = { kind: 'boss', rig, x: 0, z: 85, yaw: Math.PI, hp: 1500, maxHp: 1500, r: 0.55, dead: false, active: false, moveT: 0, goal: { x: 0, z: 82 }, fanT: 2.5, grenT: 4.5, spawned1: false, spawned2: false, monologued: false, zone: 'C', alert: true, stunT: 0, pose: null };
    this.placeActor(this.boss);
  }
  addGoon(zone, x, z, alert = false) {
    const rig = new Rig(this.goonSpec());
    this.scene.add(rig.root);
    const e = { kind: 'goon', rig, x, z, yaw: Math.PI + rand(-0.4, 0.4), hp: 100, maxHp: 100, r: 0.45, zone, alert, dead: false, deadT: 0, gone: false, moveT: rand(0, 1), goal: { x, z }, fireT: rand(0.8, 1.8), stunT: 0, dvx: 0, dvz: 0, speed: rand(2.8, 3.6) };
    this.enemies.push(e);
    this.placeActor(e);
    return e;
  }
  placeActor(a, y = 0) {
    a.rig.root.position.set(a.x, y, a.z);
    a.rig.root.rotation.y = a.yaw;
  }

  // ------------------------------------------------------------------ geometry queries
  collide(a) {
    for (const c of this.colliders) if (c.active) resolveCircleBox(a, a.r, c);
  }
  /** first blocking collider distance along ray (ignores barrels unless asked) */
  wallHit(ox, oz, dx, dz, maxT, minH = 0.9) {
    let best = maxT;
    for (const c of this.colliders) {
      if (!c.active || c.barrel || c.h < minH) continue;
      const t = rayBox(ox, oz, dx, dz, c, best);
      if (t >= 0 && t < best) best = t;
    }
    return best;
  }
  los(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    return this.wallHit(a.x, a.z, dx / d, dz / d, d) >= d - 0.3;
  }
  aliveChars() { return this.chars.filter((c) => !c.down); }
  nearestChar(a) {
    let best = null, bd = 1e9;
    for (const c of this.chars) {
      if (c.down) continue;
      const d = Math.hypot(c.x - a.x, c.z - a.z);
      if (d < bd) { bd = d; best = c; }
    }
    return [best, bd];
  }
  zoneAlive(z) { return this.enemies.filter((e) => e.zone === z && !e.dead).length; }

  /** auto-aim target for a player character */
  acquire(ch) {
    const W = ch.weapon;
    let best = null, bs = 1e9;
    const consider = (t, cone, isBarrel) => {
      const dx = t.x - ch.x, dz = t.z - ch.z, d = Math.hypot(dx, dz);
      if (d > 38 || d < 0.3) return;
      const ad = Math.abs(wrapAngle(Math.atan2(dx, dz) - ch.yaw));
      if (ad > cone) return;
      if (!this.los(ch, t)) return;
      const sc = ad * 2 + d * 0.02 + (isBarrel ? 3 : 0);
      if (sc < bs) { bs = sc; best = t; }
    };
    for (const e of this.enemies) if (!e.dead && this.activeZones.has(e.zone)) consider(e, W.cone, false);
    if (this.boss.active && !this.boss.dead) consider(this.boss, W.cone, false);
    if (!best) for (const b of this.barrels) if (b.alive) consider(b, 0.2, true);
    return best;
  }

  // ------------------------------------------------------------------ combat
  tryFire(ch, forced = null, accuracy = 1) {
    if (ch.down || ch.reloadT > 0 || ch.cool > 0 || ch.getupT > 0 || ch.kickT > 0) return false;
    const g = this.game, W = ch.weapon;
    if (ch.ammo <= 0) { this.startReload(ch); return false; }
    ch.ammo--;
    ch.cool = W.interval;
    ch.aimT = 1.2;
    const tgt = forced || this.acquire(ch);
    let ang = tgt ? Math.atan2(tgt.x - ch.x, tgt.z - ch.z) : ch.yaw;
    ch.aimYaw = ang;
    ang += rand(-W.spread, W.spread);
    if (accuracy < 1 && Math.random() > accuracy) ang += rand(0.06, 0.14) * (Math.random() < 0.5 ? -1 : 1);
    const dx = Math.sin(ang), dz = Math.cos(ang);
    let t = this.wallHit(ch.x, ch.z, dx, dz, 60);
    let hitA = null, hitB = null;
    for (const e of [...this.enemies, this.boss]) {
      if (e.dead || (e.kind === 'boss' && !e.active) || (e.kind === 'goon' && !this.activeZones.has(e.zone))) continue;
      const tt = rayCircle(ch.x, ch.z, dx, dz, e.x, e.z, e.r + 0.08, t);
      if (tt >= 0 && tt < t) { t = tt; hitA = e; hitB = null; }
    }
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const tt = rayCircle(ch.x, ch.z, dx, dz, b.x, b.z, 0.48, t);
      if (tt >= 0 && tt < t) { t = tt; hitB = b; hitA = null; }
    }
    ch.rig.root.rotation.y = ch.aimYaw;
    ch.rig.root.updateMatrixWorld(true);
    const from = ch.rig.muzzle.getWorldPosition(new THREE.Vector3());
    const to = new THREE.Vector3(ch.x + dx * t, hitA ? 1.25 : rand(0.9, 1.6), ch.z + dz * t);
    this.fx.muzzle(from);
    this.fx.tracer(from, to);
    g.audio.sfx(W.sfx, 0.7);
    g.stats.shots++;
    this.noise = { x: ch.x, z: ch.z, t: this.t };
    if (hitA) { g.stats.hits++; this.damageEnemy(hitA, W.dmg, ch, dx, dz); this.fx.blood(to); }
    else if (hitB) { g.stats.hits++; this.hitBarrel(hitB, ch); }
    else { this.fx.sparks(to, 6); this.fx.dust(to, 3); }
    if (ch.ammo === 0) this.startReload(ch);
    return true;
  }

  startReload(ch) {
    if (ch.reloadT > 0 || ch.ammo === ch.weapon.mag || ch.down) return;
    ch.reloadT = ch.weapon.reload;
    this.game.audio.sfx(ch.id === 'hammer' ? 'spin' : 'reload', 0.6);
    if (ch.id === 'hammer' && Math.random() < 0.15 && this.ctrlOf(0) !== 'ai') this.sub('hammer', 'Gerald needs a minute.');
  }

  damageEnemy(e, dmg, src, dx, dz) {
    const g = this.game;
    e.hp -= dmg;
    e.rig.flash();
    e.alert = true;
    e.stunT = 0.18;
    if (e.kind === 'boss') { this.bossHurt(); return; }
    if (e.hp <= 0) this.killEnemy(e, src, dx, dz);
    else { e.x += dx * 0.25; e.z += dz * 0.25; }
  }

  killEnemy(e, src, dx = 0, dz = 0) {
    const g = this.game;
    e.dead = true;
    e.deadT = 0;
    const big = src && src.weapon && src.weapon.dmg >= 100;
    e.deathType = big ? 'flyback' : pick(['spin', 'stagger', 'flyback']);
    const k = src && src.weapon ? src.weapon.knock : 6;
    e.dvx = dx * k; e.dvz = dz * k;
    e.yaw = Math.atan2(-dx, -dz);
    g.stats.kills++;
    g.audio.sfx('goonDie');
    if (Math.random() < 0.4) this.sub('goon', pick(this.cfg.goonDie));
    this.killTimes.push(this.t);
    this.killTimes = this.killTimes.filter((t) => this.t - t < 4);
    if (this.killTimes.length >= 3) { this.killTimes = []; this.worksForMe('TRIPLE TAKEDOWN'); }
    else if (src && src.diveT > 0) this.worksForMe('DIVE SHOT');
  }

  hitBarrel(b, src) {
    b.hp--;
    this.fx.sparks(_v.set(b.x, 0.8, b.z), 8);
    if (b.hp <= 0) this.explodeBarrel(b, src);
  }
  explodeBarrel(b, src) {
    if (!b.alive) return;
    const g = this.game;
    b.alive = false;
    b.col.active = false;
    b.mesh.removeFromParent();
    this.fx.explosion(_v.set(b.x, 0, b.z), 1.2);
    g.audio.sfx('explosion');
    this.shakeAll(1.2);
    const bl = this.cfg.barrel;
    addCollateral(g.stats, bl.label, bl.cost);
    g.ui.toast(`+$${bl.cost} · ${bl.label}`, 'money');
    let kills = 0;
    for (const e of this.enemies) {
      if (e.dead || !this.activeZones.has(e.zone)) continue;
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      if (d < 4.6) { e.hp = 0; const dx = (e.x - b.x) / (d || 1), dz = (e.z - b.z) / (d || 1); this.killEnemy(e, { weapon: { knock: 11, dmg: 100 } }, dx, dz); kills++; }
    }
    if (this.boss.active && !this.boss.dead && Math.hypot(this.boss.x - b.x, this.boss.z - b.z) < 4.6) { this.boss.hp -= 150; this.bossHurt(); }
    for (const c of this.chars) {
      const d = Math.hypot(c.x - b.x, c.z - b.z);
      if (d < 4.6) this.hurtChar(c, Math.round(30 * (1 - d / 4.6)) + 5);
    }
    for (const o of this.barrels) if (o.alive && Math.hypot(o.x - b.x, o.z - b.z) < 4.6) this.tweens.push({ t: 0, dur: 0.18, fn: () => {}, done: () => this.explodeBarrel(o, src) });
    if (kills >= 2) this.worksForMe('BARREL OF LAUGHS');
  }

  enemyShoot(e, tgt, { acc = 0.16, dmg = 8, angOff = 0 } = {}) {
    const g = this.game;
    const dist = Math.hypot(tgt.x - e.x, tgt.z - e.z);
    let p = acc;
    if (tgt.moving > 0.3) p *= 0.7;
    if (dist < 6) p *= 1.6;
    if (tgt.diveT > 0 || g.debug.god) p = 0;
    const hit = angOff === 0 && Math.random() < p;
    let ang = Math.atan2(tgt.x - e.x, tgt.z - e.z) + angOff;
    if (!hit && angOff === 0) ang += rand(0.05, 0.16) * (Math.random() < 0.5 ? -1 : 1);
    const dx = Math.sin(ang), dz = Math.cos(ang);
    let t = this.wallHit(e.x, e.z, dx, dz, 50);
    let victim = hit ? tgt : null;
    if (angOff !== 0) {
      for (const c of this.chars) {
        if (c.down || c.diveT > 0) continue;
        const tt = rayCircle(e.x, e.z, dx, dz, c.x, c.z, c.r, t);
        if (tt >= 0 && Math.random() < acc) { victim = c; t = tt; }
      }
    }
    if (victim === tgt && hit) t = Math.min(t, dist);
    e.rig.root.rotation.y = ang;
    e.rig.root.updateMatrixWorld(true);
    const from = e.rig.muzzle.getWorldPosition(new THREE.Vector3());
    const to = new THREE.Vector3(e.x + dx * t, rand(0.9, 1.7), e.z + dz * t);
    this.fx.muzzle(from, 0xffc080);
    this.fx.tracer(from, to, 0xffb080);
    const near = Math.min(...this.chars.map((c) => Math.hypot(c.x - e.x, c.z - e.z)));
    g.audio.sfx('enemyShot', clamp(1 - near / 40, 0.15, 0.7));
    g.stats.henchShots++;
    if (victim) { g.stats.henchHits++; this.hurtChar(victim, dmg); }
    else { this.fx.sparks(to, 4); if (Math.random() < 0.22) g.audio.sfx('ricochet', 0.5); }
  }

  hurtChar(ch, dmg) {
    if (ch.down || this.over) return;
    const g = this.game;
    if (g.debug.god) return;
    ch.hp -= dmg;
    ch.rig.flash();
    g.audio.sfx('hurt');
    const vp = this.vpOf(this.chars.indexOf(ch));
    if (vp >= 0 && this.hud.vps[vp]) { const f = this.hud.vps[vp].flash; f.style.transition = 'none'; f.style.opacity = '1'; void f.offsetWidth; f.style.transition = 'opacity .5s'; f.style.opacity = '0'; }
    if (ch.hp > 0 && Math.random() < 0.12) this.sub(ch.id, pick(this.cfg.hitLines[ch.id]));
    if (ch.hp <= 0) {
      ch.hp = 0;
      ch.down = true;
      ch.reviveT = 0;
      ch.diveT = 0;
      g.stats.downs++;
      g.audio.sfx('down');
      this.sub(ch.id, pick(this.cfg.downLines[ch.id]), 3.5);
      if (this.chars.every((c) => c.down)) {
        this.over = true;
        this.run(async () => {
          await this.wait(1.2);
          g.fail(this.cfg.failTitle, this.cfg.failLine);
        });
      } else if (g.mode === 1 && this.chars.indexOf(ch) === this.active) {
        this.sub('narrator', 'Your partner will try to revive you. Hang in there.', 3);
      }
    }
  }

  worksForMe(sub) {
    if (this.wfmCD > 0) return;
    this.wfmCD = 6;
    const g = this.game;
    g.stats.wfm++;
    g.ui.worksForMe(sub);
    g.audio.sfx('wfm');
    g.slowmo(0.3, 0.7);
  }

  sub(who, text, dur = 2.8) {
    if (this.subCD > 0 && who === 'goon') return;
    if (who === 'goon') this.subCD = 2.2;
    this.game.ui.sub(who, text, dur);
  }

  shakeAll(a) { this.shake = Math.max(this.shake || 0, a); }

  // ------------------------------------------------------------------ boss
  bossHurt() {
    const b = this.boss;
    if (b.dead) return;
    if (b.hp <= 0) { b.hp = 0; b.dead = true; this.run(() => this.finale()); return; }
    if (!b.spawned1 && b.hp < b.maxHp * 0.72) {
      b.spawned1 = true;
      this.sub(this.cfg.bossSpeaker, this.cfg.bossHelp1, 2.5);
      this.addGoon('C', -18.5, 86, true); this.addGoon('C', 18.5, 86, true);
    }
    if (!b.monologued && b.hp < b.maxHp * 0.5) { b.monologued = true; this.run(() => this.monologue()); }
    if (!b.spawned2 && b.hp < b.maxHp * 0.3) {
      b.spawned2 = true;
      this.sub(this.cfg.bossSpeaker, this.cfg.bossHelp2, 2.5);
      this.addGoon('C', -18.5, 70, true); this.addGoon('C', 18.5, 70, true);
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b.active || b.dead) return;
    const [tgt, dist] = this.nearestChar(b);
    b.stunT -= dt;
    b.moveT -= dt;
    if (b.moveT <= 0 || Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 0.5) {
      b.moveT = rand(1.4, 2.6);
      b.goal = { x: rand(-7, 7), z: rand(72, 85) };
    }
    const gx = b.goal.x - b.x, gz = b.goal.z - b.z, gd = Math.hypot(gx, gz);
    b.moving = 0;
    if (gd > 0.3 && b.stunT <= 0) {
      b.x += (gx / gd) * 3.4 * dt; b.z += (gz / gd) * 3.4 * dt;
      b.moving = 1;
    }
    this.collide(b);
    if (tgt) b.yaw = dampAngle(b.yaw, Math.atan2(tgt.x - b.x, tgt.z - b.z), 6, dt);
    b.fanT -= dt;
    if (b.fanT <= 0 && tgt && this.los(b, tgt)) {
      b.fanT = 2.3;
      for (let i = -2; i <= 2; i++) this.enemyShoot(b, tgt, { acc: 0.22, dmg: 7, angOff: i * 0.13 + 0.0001 });
      if (Math.random() < 0.3) this.sub(this.cfg.bossSpeaker, pick(this.cfg.bossTaunts), 2);
    }
    b.grenT -= dt;
    if (b.grenT <= 0 && tgt) { b.grenT = rand(4.5, 6.2); this.throwBall(b, tgt); }
    b.rig.root.position.set(b.x, 0, b.z);
    b.rig.root.rotation.y = b.yaw;
  }

  throwBall(from, tgt) {
    const T = 1.0, g = 18;
    const tx = tgt.x + rand(-1, 1), tz = tgt.z + rand(-1, 1);
    const m = discoBall(0.28);
    m.material = m.material.clone();
    const y0 = 1.7;
    m.position.set(from.x, y0, from.z);
    this.scene.add(m);
    this.grenades.push({ x: from.x, y: y0, z: from.z, vx: (tx - from.x) / T, vz: (tz - from.z) / T, vy: (0.3 - y0 + 0.5 * g * T * T) / T, mesh: m, fuse: 1.25, landed: false, beepT: 0 });
    this.game.audio.sfx('whoosh');
  }

  updateGrenades(dt) {
    const g = this.game;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const n = this.grenades[i];
      if (!n.landed) {
        n.vy -= 18 * dt;
        n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
        if (n.y <= 0.3) { n.y = 0.3; n.landed = true; g.audio.sfx('clang', 0.4); }
      } else {
        n.fuse -= dt;
        n.beepT -= dt;
        if (n.beepT <= 0) { n.beepT = 0.22; g.audio.sfx('beep', 0.6); }
        n.mesh.material.emissive.setHex(Math.floor(n.fuse * 9) % 2 ? 0xff2080 : 0x555555);
        if (n.fuse <= 0) {
          this.fx.explosion(_v.set(n.x, 0, n.z), 0.9);
          this.fx.confetti(_v.set(n.x, 1, n.z), 30);
          g.audio.sfx('explosion', 0.8);
          this.shakeAll(0.8);
          for (const c of this.chars) {
            const d = Math.hypot(c.x - n.x, c.z - n.z);
            if (d < 3.6 && c.diveT <= 0) this.hurtChar(c, Math.round(26 * (1 - d / 3.6)) + 8);
          }
          for (const e of this.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - n.x, e.z - n.z);
            if (d < 3.6) { e.hp = 0; this.killEnemy(e, { weapon: { knock: 8, dmg: 100 } }, (e.x - n.x) / (d || 1), (e.z - n.z) / (d || 1)); }
          }
          n.mesh.removeFromParent();
          n.mesh.material.dispose();
          this.grenades.splice(i, 1);
          continue;
        }
      }
      n.mesh.position.set(n.x, n.y, n.z);
      n.mesh.rotation.y += dt * 8;
    }
  }

  // ------------------------------------------------------------------ goons
  updateGoon(e, dt) {
    const g = this.game;
    if (e.gone) return;
    if (e.dead) { this.animateDeath(e, dt); return; }
    const active = this.activeZones.has(e.zone);
    const [tgt, dist] = this.nearestChar(e);
    e.moving = 0;
    if (!active || !tgt) {
      e.rig.update(dt, { pose: 'idle' });
      this.placeActor(e);
      return;
    }
    const los = this.los(e, tgt);
    if (!e.alert) {
      const heard = this.noise && this.t - this.noise.t < 0.5 && Math.hypot(this.noise.x - e.x, this.noise.z - e.z) < 24;
      if ((dist < 24 && los) || heard) {
        e.alert = true;
        e.fireT = rand(0.7, 1.5);
        if (Math.random() < 0.5) this.sub('goon', pick(this.cfg.goonAlert));
      } else {
        e.rig.update(dt, { pose: 'idle' });
        this.placeActor(e);
        return;
      }
    }
    e.stunT -= dt;
    e.moveT -= dt;
    if (e.moveT <= 0 || Math.hypot(e.goal.x - e.x, e.goal.z - e.z) < 0.5) {
      e.moveT = rand(1.4, 2.8);
      const tx = (tgt.x - e.x) / (dist || 1), tz = (tgt.z - e.z) / (dist || 1);
      const a = rand(0, Math.PI * 2), r = rand(2, 5);
      let gx = e.x + Math.cos(a) * r, gz = e.z + Math.sin(a) * r;
      if (dist > 13 || !los) { gx += tx * 5; gz += tz * 5; }
      else if (dist < 5) { gx -= tx * 3; gz -= tz * 3; }
      const zb = { A: [1, 29], B: [31, 59], C: [61, 89] }[e.zone];
      e.goal = { x: clamp(gx, -19, 19), z: clamp(gz, zb[0], zb[1]) };
    }
    const gx = e.goal.x - e.x, gz = e.goal.z - e.z, gd = Math.hypot(gx, gz);
    if (gd > 0.4 && e.stunT <= 0) {
      const ox = e.x, oz = e.z;
      e.x += (gx / gd) * e.speed * dt; e.z += (gz / gd) * e.speed * dt;
      this.collide(e);
      if (Math.hypot(e.x - ox, e.z - oz) < e.speed * dt * 0.3) e.moveT = 0;
      e.moving = 1;
    }
    e.yaw = dampAngle(e.yaw, Math.atan2(tgt.x - e.x, tgt.z - e.z), 7, dt);
    e.fireT -= dt;
    if (e.fireT <= 0 && los && dist < 32 && e.stunT <= 0) {
      e.fireT = rand(0.9, 1.6);
      this.enemyShoot(e, tgt);
    }
    e.rig.update(dt, { pose: e.moving ? 'aim1' : 'aim', speed: e.moving * 0.7 });
    this.placeActor(e);
  }

  animateDeath(e, dt) {
    e.deadT += dt;
    const T = e.deadT;
    const body = e.rig.body;
    let y = 0;
    if (e.deathType === 'flyback') {
      if (T < 0.55) {
        e.x += e.dvx * dt * (1 - T / 0.55) * 1.6;
        e.z += e.dvz * dt * (1 - T / 0.55) * 1.6;
        this.collide(e);
        y = Math.sin((T / 0.55) * Math.PI) * 0.9;
      }
      body.rotation.x = -Math.min(1, T / 0.45) * Math.PI / 2;
      e.rig.update(dt, { pose: T < 0.5 ? 'flail' : 'lie', noBob: true });
    } else if (e.deathType === 'spin') {
      if (T < 0.75) e.yaw += dt * 15;
      body.rotation.x = -Math.max(0, Math.min(1, (T - 0.6) / 0.35)) * Math.PI / 2;
      e.rig.update(dt, { pose: T < 0.7 ? 'raise' : 'lie', noBob: true });
    } else {
      if (T < 1.1) { e.x -= Math.sin(e.yaw) * dt * 1.2; e.z -= Math.cos(e.yaw) * dt * 1.2; this.collide(e); }
      body.rotation.x = Math.max(0, Math.min(1, (T - 1.0) / 0.35)) * Math.PI / 2;
      e.rig.update(dt, { pose: T < 1.0 ? 'flail' : 'lie', speed: T < 1.0 ? 0.5 : 0, noBob: true });
    }
    body.position.y = Math.min(0.15, T * 0.3);
    this.placeActor(e, y);
    if (T > 5) e.rig.root.visible = Math.floor(T * 12) % 2 === 0;
    if (T > 6.2) { e.gone = true; e.rig.root.removeFromParent(); }
  }

  // ------------------------------------------------------------------ players
  startDive(ch, dirX, dirZ) {
    if (ch.diveT > 0 || ch.getupT > 0 || ch.down) return;
    const d = Math.hypot(dirX, dirZ);
    if (d < 0.1) { dirX = Math.sin(ch.yaw); dirZ = Math.cos(ch.yaw); } else { dirX /= d; dirZ /= d; }
    ch.diveT = 0.62;
    ch.diveV = 9.5;
    ch.diveDir = { x: dirX, z: dirZ };
    this.game.audio.sfx('whoosh');
    if (this.game.mode === 1 && this.ctrlOf(this.chars.indexOf(ch)) === 0) this.game.slowmo(0.5, 0.45);
  }

  moveChar(ch, wx, wz, speed, dt) {
    if (ch.down || ch.getupT > 0 || ch.kickT > 0) { ch.moving = 0; return; }
    if (ch.diveT > 0) {
      ch.x += ch.diveDir.x * ch.diveV * dt;
      ch.z += ch.diveDir.z * ch.diveV * dt;
      ch.diveV = Math.max(2, ch.diveV - 11 * dt);
      ch.moving = 1;
    } else {
      const m = Math.hypot(wx, wz);
      if (m > 1) { wx /= m; wz /= m; }
      ch.x += wx * speed * dt;
      ch.z += wz * speed * dt;
      ch.moving = Math.min(1, m);
    }
    this.collide(ch);
  }

  humanControl(ch, c, dt) {
    ch.yaw -= c.turn * 2.7 * dt + c.mouseTurn;
    const f = { x: Math.sin(ch.yaw), z: Math.cos(ch.yaw) }, r = { x: -Math.cos(ch.yaw), z: Math.sin(ch.yaw) };
    const wx = f.x * c.my + r.x * c.mx, wz = f.z * c.my + r.z * c.mx;
    if (c.dive) this.startDive(ch, wx, wz);
    if (c.reload) this.startReload(ch);
    if (c.fire) this.tryFire(ch);
    if (c.action) this.interact(ch);
    this.moveChar(ch, wx, wz, ch.speed, dt);
  }

  aiControl(ch, leader, dt) {
    if (ch.down) { ch.moving = 0; return; }
    let wx = 0, wz = 0;
    if (leader.down) {
      const dx = leader.x - ch.x, dz = leader.z - ch.z, d = Math.hypot(dx, dz);
      if (d > 1.2) { wx = dx / d; wz = dz / d; }
      ch.yaw = dampAngle(ch.yaw, Math.atan2(dx, dz), 8, dt);
      this.moveChar(ch, wx, wz, ch.speed, dt);
      return;
    }
    // threats
    let tgt = null, td = 26;
    for (const e of [...this.enemies, this.boss]) {
      if (e.dead || (e.kind === 'boss' && !e.active) || (e.kind === 'goon' && (!this.activeZones.has(e.zone) || !e.alert))) continue;
      const d = Math.hypot(e.x - ch.x, e.z - ch.z);
      if (d < td && this.los(ch, e)) { td = d; tgt = e; }
    }
    ch.aiCool -= dt;
    if (tgt) {
      const ang = Math.atan2(tgt.x - ch.x, tgt.z - ch.z);
      ch.yaw = dampAngle(ch.yaw, ang, 10, dt);
      if (Math.abs(wrapAngle(ang - ch.yaw)) < 0.25 && ch.aiCool <= 0) {
        if (this.tryFire(ch, tgt, 0.55)) ch.aiCool = ch.weapon.interval * (ch.id === 'hammer' ? 1.3 : 2.2);
      }
    }
    // dodge disco balls
    for (const n of this.grenades) {
      const nx = n.dodge ? n.tx : n.x, nz = n.dodge ? n.tz : n.z;
      if ((n.landed || n.dodge) && Math.hypot(nx - ch.x, nz - ch.z) < 3.8) { this.startDive(ch, ch.x - nx, ch.z - nz); break; }
    }
    // follow the leader
    const lf = { x: Math.sin(leader.yaw), z: Math.cos(leader.yaw) }, lr = { x: -Math.cos(leader.yaw), z: Math.sin(leader.yaw) };
    const px = leader.x - lf.x * 1.1 - lr.x * 2.3, pz = leader.z - lf.z * 1.1 - lr.z * 2.3;
    const dx = px - ch.x, dz = pz - ch.z, d = Math.hypot(dx, dz);
    if (d > 0.7) { const sp = d > 4 ? 1 : d / 4; wx = (dx / d) * sp; wz = (dz / d) * sp; }
    if (!tgt && d > 0.7) ch.yaw = dampAngle(ch.yaw, Math.atan2(dx, dz), 6, dt);
    else if (!tgt) ch.yaw = dampAngle(ch.yaw, leader.yaw, 3, dt);
    const ld = Math.hypot(leader.x - ch.x, leader.z - ch.z);
    if (ld > 15 && !this.los(ch, leader)) {
      const tx = leader.x - lf.x * 1.5, tz = leader.z - lf.z * 1.5;
      const probe = { x: tx, z: tz, r: ch.r };
      this.collide(probe);
      ch.x = probe.x; ch.z = probe.z;
      this.fx.dust(_v.set(ch.x, 0.5, ch.z), 6);
    }
    if (!tgt && ch.ammo < ch.weapon.mag * 0.5) this.startReload(ch);
    this.moveChar(ch, wx, wz, ch.speed * 0.95, dt);
  }

  interact(ch) {
    for (const door of this.doors) {
      if (door.open) continue;
      const d = Math.hypot(ch.x, ch.z - (door.z - 1.0));
      if (d > 2.8 || ch.z > door.z) continue;
      if (this.zoneAlive(door.needs) > 0) {
        if (!this.lockedCD || this.t > this.lockedCD) { this.lockedCD = this.t + 3; this.sub(ch.id === 'hammer' ? 'delgado' : 'hammer', pick(["We've still got company, Rex.", 'Room first, door second.', "Let's clear this room before we make new friends."])); }
        return;
      }
      this.openDoor(door, ch);
      return;
    }
  }

  openDoor(door, ch) {
    const g = this.game;
    door.open = true;
    door.col.active = false;
    if (ch.id === 'hammer') {
      ch.kickT = 0.45;
      ch.yaw = 0; ch.aimYaw = 0;
      this.tweens.push({ t: 0, dur: 0.16, fn: () => {}, done: () => {
        g.audio.sfx('door');
        this.shakeAll(1);
        this.fx.dust(_v.set(0, 1.5, door.z), 18);
        this.fx.fling(door.pivot, new THREE.Vector3(rand(-1, 1), 5, 15), new THREE.Vector3(rand(-6, -3), rand(-2, 2), rand(-3, 3)), { life: 7, bounce: 0.2 });
      } });
      g.stats.kicked++;
      this.sub('hammer', pick(['Knock knock.', 'Police! Also: hi.', 'Room service.']));
    } else {
      this.tweens.push({ t: 0, dur: 0.7, fn: (k) => { door.pivot.rotation.y = -1.75 * (1 - Math.pow(1 - k, 3)); } });
      g.audio.sfx('creak');
      g.stats.polite++;
      this.sub('delgado', pick(['It was unlocked, Rex.', 'See? Handle.', 'We have doorknobs for a reason.']));
    }
    this.activeZones.add(door.unlocks);
    if (door.unlocks === 'C') this.run(async () => { await this.wait(0.8); await this.bossIntro(); });
  }

  // ------------------------------------------------------------------ cutscenes
  setCut(pos, look) {
    this.cutCam.position.set(...pos);
    this.cutLook = new THREE.Vector3(...look);
    this.cutCam.lookAt(this.cutLook);
  }
  async startCut() {
    this.cutscene = true;
    this.game.input.releaseLock();
    this.game.ui.letterbox(true);
  }
  endCut() {
    this.cutscene = false;
    this.camSnap = true;
    this.game.ui.letterbox(false);
  }

  async intro() {
    const g = this.game, ui = g.ui;
    this.cutscene = true;
    ui.letterbox(true);
    this.setCut([0.2, 1.75, 8.5], [0, 1.6, 4]);
    this.chars[0].pose = 'idle'; this.chars[1].pose = 'cross';
    g.audio.playSong('warehouse');
    await this.cut(async () => {
      await this.w(ui.fade(0, 0.8));
      await this.w(ui.locationCard(['MISSION ROAD WAREHOUSES', '10:04 PM'], 1.0));
      await this.say('delgado', 'The Duke went in through the loading dock.');
      this.chars[0].pose = 'gunUp';
      g.audio.sfx('spin', 0.7);
      await this.say('hammer', 'Then so do we. Gerald, you ready?');
      await this.say('delgado', 'Please stop talking to your gun.');
    }, () => ui.fade(0, 0.2));
    this.chars[0].pose = null; this.chars[1].pose = null;
    this.endCut();
    this.updateCameras(0);
    ui.toast('CLEAR THE LOADING DOCK', 'big');
    if (g.touch.used) ui.sub('narrator', 'Left thumb moves, drag the right side to turn. FIRE has aim assist. DIVE dodges. Tap KICK at doors. Donuts heal.', 6);
    else ui.sub('narrator', g.mode === 2
      ? 'P1 WASD + mouse (click to lock) · P2 arrows + ENTER · dive, reload, F or / to kick doors. Revive your partner by standing close.'
      : 'Click to use the mouse (or Q/E to turn). SPACE/click fires with aim assist. SHIFT dives. TAB swaps partners. Donuts heal.', 6);
  }

  async bossIntro() {
    const g = this.game;
    await this.startCut();
    g.audio.stopMusic(0.5);
    for (const [i, c] of this.chars.entries()) { if (c.down) { c.down = false; c.hp = 40; } c.x = i ? 1.3 : -1.3; c.z = 65.5; c.yaw = 0; c.diveT = 0; c.pose = 'aim'; }
    // the open door into the lair swings to exactly where the camera sits behind the cops
    for (const d of this.doors) if (d.unlocks === 'C') d.pivot.visible = false;
    const b = this.boss;
    b.x = 0; b.z = 85.4; b.yaw = Math.PI;
    b.pose = 'hips';
    this.setCut([0, 2.0, 79.5], [0, 1.8, 85.4]);
    await this.cut(async () => {
      await this.say('duke', "Well, well. Hammer and Delgado. You're just in time for the last dance.");
      this.setCut([0.3, 1.8, 69.5], [0, 1.6, 65.5]);
      await this.say('hammer', "Music's over, Duke.");
      this.setCut([0.5, 1.95, 83.2], [0, 1.95, 85.4]);
      b.pose = 'point';
      await this.say('duke', 'Oh, the music is never over, Hammer.');
      this.discoOn = true;
      g.audio.sfx('dun');
      b.pose = 'raise';
      await this.wait(0.6);
      g.audio.playSong('disco');
      await this.say('duke', 'The music... is FOREVER!');
    }, () => {
      if (!this.discoOn) { this.discoOn = true; g.audio.sfx('dun'); }
      g.audio.playSong('disco');
    });
    b.pose = null;
    for (const c of this.chars) c.pose = null;
    b.active = true;
    for (const e of this.enemies) if (e.zone === 'C') e.alert = true;
    this.endCut();
    g.ui.toast('TAKE DOWN THE DISCO DUKE', 'big');
  }

  async monologue() {
    const g = this.game;
    await this.startCut();
    const b = this.boss;
    const [tgt] = this.nearestChar(b);
    b.pose = 'raise';
    const camFrom = (dist, h) => [b.x + Math.sin(b.yaw) * dist + 0.4, h, b.z + Math.cos(b.yaw) * dist];
    this.setCut(camFrom(3.2, 1.9), [b.x, 1.85, b.z]);
    await this.cut(async () => {
      await this.say('duke', 'You want to know WHY, Hammer? In 1977, I was the king of this town.');
      b.pose = 'shrug';
      await this.say('duke', 'Then disco died. And they LAUGHED. So I made jeans. Cheap, shiny, extremely flammable jeans.');
      b.pose = 'point';
      await this.say('duke', 'Every pair... a tiny piece of the Duke... on every behind in Los Angeles.');
      const d = this.chars[1];
      this.setCut([d.x + Math.sin(d.yaw) * 2.6, 1.7, d.z + Math.cos(d.yaw) * 2.6], [d.x, 1.62, d.z]);
      await this.say('delgado', 'That is the worst plan I have ever heard.');
      this.setCut(camFrom(3.2, 1.9), [b.x, 1.85, b.z]);
      b.pose = 'shrug';
      await this.say('duke', 'And yet... here we are.');
    });
    b.pose = null;
    this.endCut();
  }

  async finale() {
    const g = this.game, ui = g.ui;
    this.over = true;
    g.stats.warehouseTime = this.t;
    g.audio.sfx('dun');
    await this.wait(0.6);
    await this.startCut();
    for (const n of this.grenades) n.mesh.removeFromParent();
    this.grenades = [];
    for (const e of this.enemies) if (!e.gone) { e.gone = true; e.dead = true; e.rig.root.removeFromParent(); }
    const [H, D] = this.chars;
    const b = this.boss;
    for (const c of this.chars) { c.down = false; c.hp = Math.max(c.hp, 1); c.diveT = 0; c.getupT = 0; c.rig.body.rotation.x = 0; c.rig.body.position.y = 0; }
    b.x = 0; b.z = 80; b.yaw = Math.PI; b.pose = 'holdHostage';
    D.x = 0; D.z = 79.3; D.yaw = Math.PI; D.pose = 'hostage';
    H.x = 0; H.z = 74.2; H.yaw = 0; H.pose = 'aim';
    g.audio.stopMusic(1.2);
    const counted = { hostage: false, wfm: false };
    await this.cut(async () => {
      this.setCut([4.4, 1.8, 77.2], [0, 1.6, 78.6]);
      await this.say('duke', 'One more step, Hammer, and the lady gets it!');
      this.setCut([-0.7, 1.95, 71.6], [0, 1.55, 79.4]);
      await this.say('hammer', 'Let her go, Duke.');
      g.stats.hostage++;
      counted.hostage = true;
      this.setCut([0.25, 1.72, 77.2], [0, 1.66, 79.3]);
      await this.say('delgado', `Rex. This is the ${g.stats.hostage === 15 ? 'fifteenth' : g.stats.hostage + 'th'} time this season.`);
      this.setCut([-0.7, 1.95, 71.6], [0, 1.55, 79.4]);
      await this.say('hammer', 'I know.');
      this.setCut([3.2, 1.6, 79.6], [0, 1.4, 79.6]);
      await this.say('delgado', "I'll handle it.");
      D.pose = 'elbow';
      g.audio.sfx('thump');
      b.pose = 'flail';
      this.tweens.push({ t: 0, dur: 0.35, fn: (k) => { b.z = 80 + k * 0.7; } });
      await this.wait(0.45);
      D.yaw = 0; D.pose = 'cuff';
      this.tweens.push({ t: 0, dur: 0.45, fn: (k) => { b.rig.body.rotation.x = -k * Math.PI / 2; b.rig.body.position.y = k * 0.15; } });
      await this.wait(0.45);
      g.audio.sfx('crunch');
      this.shakeAll(0.8);
      b.pose = 'lie';
      await this.wait(0.5);
      g.audio.sfx('cuff');
      this.setCut([1.6, 1.4, 79.2], [0, 0.7, 80.6]);
      await this.say('delgado', 'Vincent Malone, you have the right to remain tacky.');
      H.pose = 'gunUp';
      this.setCut([0.2, 1.85, 76.6], [0, 1.85, 74.2]);
      g.audio.sfx('spin', 0.6);
      await this.wait(0.5);
      await this.say('hammer', '...Works for me.');
      g.stats.wfm++;
      counted.wfm = true;
      ui.worksForMe('CASE CLOSED');
      g.audio.sfx('wfm');
      await this.wait(2.0);
      ui.toast(`PARTNER TAKEN HOSTAGE THIS SEASON: ${g.stats.hostage}`, 'good');
      await this.wait(1.8);
    }, () => {
      if (!counted.hostage) g.stats.hostage++;
      if (!counted.wfm) g.stats.wfm++;
    });
    await this.w(ui.fade(1, 0.8));
    g.next();
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    const g = this.game;
    const two = g.mode === 2;
    const vp = (i, left, width) => `
      <div class="vp" style="left:${left}%;width:${width}%">
        <div class="hitflash"></div>
        <div class="crosshair"></div>
        <div class="lock"></div>
        <div class="prompt"></div>
        <div class="downmsg">DOWN! STAND STILL. HELP IS COMING.</div>
        <div class="pstat"><div class="pname"></div><div class="bar"><i></i></div><div class="ammo"></div><div class="status"></div></div>
        ${two ? '' : '<div class="partner"><span class="pn"></span><div class="bar"><i></i></div></div>'}
      </div>`;
    g.ui.L.hud.innerHTML = `<div class="hud" id="wh">${two ? vp(0, 0, 50) + vp(1, 50, 50) : vp(0, 0, 100)}
      <div class="objective"></div>
      <div class="bossbar"><div class="lbl">${this.cfg.bossName}</div><div class="bar pink"><i></i></div></div></div>`;
    const root = g.ui.L.hud.querySelector('#wh');
    this.hud = {
      root,
      obj: root.querySelector('.objective'),
      boss: root.querySelector('.bossbar'),
      bossBar: root.querySelector('.bossbar i'),
      vps: [...root.querySelectorAll('.vp')].map((el) => ({
        el, flash: el.querySelector('.hitflash'), lock: el.querySelector('.lock'), prompt: el.querySelector('.prompt'),
        down: el.querySelector('.downmsg'), name: el.querySelector('.pname'), hp: el.querySelector('.pstat .bar'), hpI: el.querySelector('.pstat .bar i'),
        ammo: el.querySelector('.ammo'), status: el.querySelector('.status'), cross: el.querySelector('.crosshair'),
        partner: el.querySelector('.partner'), pn: el.querySelector('.partner .pn'), pI: el.querySelector('.partner .bar i'),
        cache: {},
      })),
    };
  }
  set(v, key, val, fn) { if (v.cache[key] !== val) { v.cache[key] = val; fn(val); } }

  updateHud() {
    const g = this.game, H = this.hud;
    H.root.style.visibility = this.cutscene ? 'hidden' : 'visible';
    if (this.cutscene) return;
    const two = g.mode === 2;
    H.vps.forEach((v, vi) => {
      const ci = two ? vi : this.active;
      const ch = this.chars[ci];
      const keyName = two ? (vi === 0 ? 'F' : '/') : 'F';
      this.set(v, 'name', `${two ? 'P' + (vi + 1) + ' · ' : ''}${ch.name} · ${ch.weapon.name}`, (x) => (v.name.textContent = x));
      const hp = Math.round((ch.hp / ch.maxHp) * 100);
      this.set(v, 'hp', hp, (x) => { v.hpI.style.width = x + '%'; v.hp.classList.toggle('low', x < 35); });
      const ammo = ch.reloadT > 0 ? 'RELOADING…' : ch.weapon.pips.repeat(ch.ammo) + '<span style="opacity:.3">' + ch.weapon.pips.repeat(ch.weapon.mag - ch.ammo) + '</span>';
      this.set(v, 'ammo', ammo, (x) => (v.ammo.innerHTML = x));
      const partner = this.chars[1 - ci];
      let status = '';
      if (partner.down) status = ch.down ? '' : `PARTNER DOWN · GET CLOSE TO REVIVE ${partner.reviveT > 0 ? Math.round((partner.reviveT / 1.6) * 100) + '%' : ''}`;
      if (ch.down && ch.reviveT > 0) status = `BEING REVIVED ${Math.round((ch.reviveT / 1.6) * 100)}%`;
      this.set(v, 'status', status, (x) => (v.status.textContent = x));
      this.set(v, 'down', ch.down, (x) => v.down.classList.toggle('on', x));
      if (v.partner) {
        this.set(v, 'pn', partner.name + (partner.down ? ' · DOWN' : ' · AI'), (x) => (v.pn.textContent = x));
        this.set(v, 'php', Math.round((partner.hp / partner.maxHp) * 100), (x) => (v.pI.style.width = x + '%'));
      }
      // door prompt
      let prompt = '';
      for (const door of this.doors) {
        if (door.open || ch.down) continue;
        if (Math.hypot(ch.x, ch.z - (door.z - 1.0)) < 2.8 && ch.z < door.z) {
          prompt = this.zoneAlive(door.needs) > 0 ? 'CLEAR THE ROOM FIRST' : `[${keyName}] ${ch.id === 'hammer' ? 'KICK IN THE DOOR' : 'OPEN THE DOOR (POLITELY)'}`;
        }
      }
      this.set(v, 'prompt', prompt, (x) => { v.prompt.textContent = x; v.prompt.classList.toggle('on', !!x); });
      // lock-on bracket
      const tgt = ch.down ? null : this.acquire(ch);
      if (tgt) {
        _v.set(tgt.x, tgt.kind ? 1.25 : 0.6, tgt.z).project(this.cams[vi]);
        v.lock.style.display = Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1 && _v.z < 1 ? 'block' : 'none';
        v.lock.style.left = ((_v.x + 1) / 2) * 100 + '%';
        v.lock.style.top = ((1 - _v.y) / 2) * 100 + '%';
      } else v.lock.style.display = 'none';
    });
    // objective
    const [dA, dB] = this.doors;
    const O = this.cfg.objectives;
    let obj;
    if (!dA.open) { const n = this.zoneAlive('A'); obj = n ? O.a(n) : O.aDone; }
    else if (!dB.open) { const n = this.zoneAlive('B'); obj = n ? O.b(n) : O.bDone; }
    else obj = O.boss;
    if (this.hudObj !== obj) { this.hudObj = obj; H.obj.innerHTML = obj; }
    const showBoss = this.boss.active && !this.boss.dead;
    H.boss.classList.toggle('on', showBoss);
    H.obj.style.display = showBoss ? 'none' : 'block';
    if (showBoss) H.bossBar.style.width = (this.boss.hp / this.boss.maxHp) * 100 + '%';
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    const g = this.game;
    this.subCD -= dt;
    this.wfmCD -= dt;
    // tweens run even in cutscenes
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.done?.(); }
    }
    if (!this.cutscene && !this.over) this.updateGameplay(dt);
    this.updateRigs(dt);
    this.updateLair(dt);
    for (const d of this.donuts) if (!d.taken) { d.mesh.rotation.y += dt * 2; d.mesh.position.y = 0.9 + Math.sin(this.t * 3 + d.x) * 0.1; }
    this.fx.update(dt);
    this.updateCameras(dt);
    this.updateHud();
  }

  updateGameplay(dt) {
    const g = this.game;
    const two = g.mode === 2;
    // swap (1P)
    if (!two) {
      const c0 = g.input.controls(0);
      if (c0.swap && !this.chars[1 - this.active].down) {
        this.active = 1 - this.active;
        const nc = this.chars[this.active];
        g.audio.sfx('menu');
        g.ui.toast(`NOW PLAYING: ${nc.name}`, 'good');
      }
    }
    for (let i = 0; i < 2; i++) {
      const ch = this.chars[i];
      ch.cool -= dt;
      ch.aimT -= dt;
      ch.kickT -= dt;
      if (ch.reloadT > 0) { ch.reloadT -= dt; if (ch.reloadT <= 0) { ch.reloadT = 0; ch.ammo = ch.weapon.mag; g.audio.sfx('reload', 0.5); } }
      if (ch.diveT > 0) { ch.diveT -= dt; if (ch.diveT <= 0) ch.getupT = 0.32; }
      else if (ch.getupT > 0) ch.getupT -= dt;
      const ctrl = this.ctrlOf(i);
      if (ch.down) { ch.moving = 0; continue; }
      if (ctrl === 'ai') this.aiControl(ch, this.chars[1 - i], dt);
      else this.humanControl(ch, g.input.controls(ctrl), dt);
    }
    // revive
    for (let i = 0; i < 2; i++) {
      const ch = this.chars[i], other = this.chars[1 - i];
      if (!ch.down) continue;
      if (!other.down && Math.hypot(other.x - ch.x, other.z - ch.z) < 1.9) {
        ch.reviveT += dt;
        if (ch.reviveT >= 1.6) {
          ch.down = false; ch.hp = 45; ch.getupT = 0.5; ch.reviveT = 0;
          g.audio.sfx('pickup');
          this.sub(other.id, pick(this.cfg.reviveLines));
        }
      } else ch.reviveT = Math.max(0, ch.reviveT - dt * 0.5);
    }
    // donuts
    for (const d of this.donuts) {
      if (d.taken) continue;
      for (const ch of this.chars) {
        if (ch.down || ch.hp >= ch.maxHp) continue;
        if (Math.hypot(ch.x - d.x, ch.z - d.z) < 1.1) {
          d.taken = true; d.mesh.removeFromParent();
          ch.hp = Math.min(ch.maxHp, ch.hp + 35);
          g.stats.donuts++;
          g.audio.sfx('pickup');
          g.ui.toast(this.cfg.donutToast, 'good');
          if (Math.random() < 0.5) this.sub(ch.id, pick(this.cfg.donutLines));
          break;
        }
      }
    }
    // enemies
    for (const e of this.enemies) this.updateGoon(e, dt);
    this.updateBoss(dt);
    this.updateGrenades(dt);
    // separation between live bodies
    const bodies = [...this.chars.filter((c) => !c.down), ...this.enemies.filter((e) => !e.dead), ...(this.boss.active && !this.boss.dead ? [this.boss] : [])];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
      if (d < m && d > 1e-4) { const p = (m - d) / 2; a.x -= (dx / d) * p; a.z -= (dz / d) * p; b.x += (dx / d) * p; b.z += (dz / d) * p; }
    }
    // zone clear callouts
    for (const z of ['A', 'B']) {
      if (!this.cleared.has(z) && this.activeZones.has(z) && this.zoneAlive(z) === 0) {
        this.cleared.add(z);
        g.ui.toast('ROOM CLEAR', 'good');
        this.sub(z === 'A' ? 'hammer' : 'delgado', z === 'A' ? this.cfg.clearA : this.cfg.clearB);
      }
    }
  }

  updateRigs(dt) {
    for (const ch of this.chars) {
      const r = ch.rig;
      let pose = ch.pose;
      if (!pose) {
        if (ch.down) pose = 'lie';
        else if (ch.diveT > 0) pose = 'diveAim';
        else if (ch.kickT > 0) pose = 'kick';
        else if (ch.reloadT > 0) pose = 'gunUp';
        else if (ch.aimT > 0) pose = 'aim';
        else pose = 'aim1';
      }
      r.update(dt, { pose, speed: ch.diveT > 0 || ch.down ? 0 : ch.moving * (ch.getupT > 0 ? 0 : 1), noBob: ch.down || ch.diveT > 0 });
      let y = 0;
      if (ch.down) {
        r.body.rotation.x = damp(r.body.rotation.x, -Math.PI / 2, 10, dt);
        r.body.position.y = 0.15;
      } else if (ch.diveT > 0) {
        const k = 1 - ch.diveT / 0.62;
        r.body.rotation.x = damp(r.body.rotation.x, 1.35, 18, dt);
        y = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.75 + 0.15;
      } else {
        r.body.rotation.x = damp(r.body.rotation.x, 0, ch.getupT > 0 ? 8 : 14, dt);
        if (ch.getupT > 0) r.body.position.y = 0.1;
      }
      r.root.position.set(ch.x, y, ch.z);
      r.root.rotation.y = ch.aimT > 0 && !ch.pose ? ch.aimYaw : ch.yaw;
      if (ch.reloadT > 0 && ch.id === 'hammer') r.gun.rotation.y += dt * 25; else r.gun.rotation.y = 0;
    }
    const b = this.boss;
    if (!b.dead || b.pose) {
      b.rig.update(dt, { pose: b.pose || (b.active ? (b.moving ? 'aim1' : 'aim') : 'hips'), speed: b.active && !this.cutscene ? (b.moving || 0) * 0.7 : 0, talk: this.cutscene });
      b.rig.root.position.set(b.x, 0, b.z);
      b.rig.root.rotation.y = b.yaw;
    }
    if (this.cutscene) for (const e of this.enemies) if (!e.dead && !e.gone) e.rig.update(dt, { pose: 'idle' });
  }

  updateLair(dt) {
    this.ball.rotation.y += dt * 0.8;
    this.tileT -= dt;
    if (this.tileT <= 0) {
      this.tileT = this.discoOn ? 60 / 124 / 2 : 1;
      const c = new THREE.Color();
      const pal = [0xff3fa4, 0x3ef2ff, 0xffd23f, 0x7dff6a, 0xb07aff, 0xff7a2a];
      const phase = Math.floor(this.t * 4);
      for (let i = 0; i < this.tileGrid.nx * this.tileGrid.nz; i++) {
        if (this.discoOn) c.setHex(pal[(i + phase + Math.floor(i / 7)) % pal.length]).multiplyScalar((i + phase) % 3 === 0 ? 1 : 0.35);
        else c.setHex(0x221a2a);
        this.tiles.setColorAt(i, c);
      }
      this.tiles.instanceColor.needsUpdate = true;
    }
    this.discoLights.forEach((L, i) => {
      L.intensity = this.discoOn ? 26 : 0;
      const a = this.t * (0.9 + i * 0.4) + i * 2;
      L.position.set(Math.cos(a) * 6, 3.5, 77 + Math.sin(a) * 5);
    });
  }

  updateCameras(dt) {
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.5);
    const sh = () => (this.shake > 0 ? rand(-1, 1) * this.shake * 0.15 : 0);
    if (this.cutscene) {
      this.cutCam.position.x += sh();
      this.cutCam.lookAt(this.cutLook);
      return;
    }
    const two = this.game.mode === 2;
    for (let vi = 0; vi < (two ? 2 : 1); vi++) {
      const ch = this.chars[two ? vi : this.active];
      const cam = this.cams[vi];
      const f = { x: Math.sin(ch.yaw), z: Math.cos(ch.yaw) }, r = { x: -Math.cos(ch.yaw), z: Math.sin(ch.yaw) };
      let dist = ch.down ? 3.2 : 4.4;
      const sideOff = 0.55;
      const bx = -f.x * dist + r.x * sideOff, bz = -f.z * dist + r.z * sideOff;
      const bl = Math.hypot(bx, bz);
      const t = this.wallHit(ch.x, ch.z, bx / bl, bz / bl, bl, 2.6);
      const k = Math.max(0.25, (t - 0.35) / bl);
      const want = new THREE.Vector3(ch.x + bx * k, ch.down ? 3.2 : 2.35, ch.z + bz * k);
      if (this.camSnap || cam.position.distanceTo(want) > 12) cam.position.copy(want);
      else cam.position.lerp(want, 1 - Math.exp(-12 * dt));
      cam.position.x += sh(); cam.position.y += sh();
      cam.lookAt(ch.x + f.x * 6 + r.x * 0.3, ch.down ? 0.4 : 1.3, ch.z + f.z * 6 + r.z * 0.3);
    }
  }

  render() {
    const g = this.game;
    this.camSnap = false;
    if (this.cutscene) return g.renderView(this.scene, this.cutCam, 0, 0, 1, 1);
    if (g.mode === 2) {
      g.renderView(this.scene, this.cams[0], 0, 0, 0.5, 1);
      g.renderView(this.scene, this.cams[1], 0.5, 0, 0.5, 1);
    } else g.renderView(this.scene, this.cams[0], 0, 0, 1, 1);
  }
}
