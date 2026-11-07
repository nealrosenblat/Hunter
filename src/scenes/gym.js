// Episode 2: "Death Wears Leg Warmers" — the shootout at the Vigor Body Temple (flagship, Beverly Hills).
// Built on the warehouse engine: same footprint (40 x 90, doors at z=30 and z=60), new set dressing,
// tracksuit henchmen, protein tubs instead of oil drums, and Rick Vigor, who throws dumbbells.
import * as THREE from 'three';
import { WarehouseScene, WAREHOUSE_CFG } from './warehouse.js';
import { makeSign } from '../env.js';
import { Rig, SPECS, gymGoonSpec, M, B, box, cyl, texMat, blobShadow } from '../models.js';
import { tex } from '../textures.js';
import { rand, pick, dampAngle } from '../util.js';

const GYM_CFG = {
  ...WAREHOUSE_CFG,
  goonAlert: ["You're not a member!", 'Do you even LIFT, copper?', "Hey! No street shoes on the mats!", 'Cops! Somebody tell Rick!', 'Spot me! SPOT ME!', 'Is that... a MULLET?'],
  goonDie: ['Leg day... was... yesterday...', 'Tell Rick... I hit my protein goal...', 'Not... the abs...', 'I just... renewed... my membership...', 'Feel... the... burn...', 'Worth it!', 'My... gains...', 'I regret NOTHING!'],
  hitLines: {
    hammer: ["That's gonna leave a mark.", 'Ow. Right in the lats.', 'Ruined a perfectly good sport coat.'],
    delgado: ["I'm hit! ...My BLAZER!", 'Ow! Okay. Okay.', 'These shoulder pads are not bulletproof!'],
  },
  downLines: {
    hammer: ["Dee Dee... tell the Captain... I never skipped leg day..."],
    delgado: ["Rex! Partner down! ...It's me. I'm the partner."],
  },
  reviveLines: ['Up. No pain, no gain.', 'Walk it off, partner.', 'On your feet.', 'Feel the burn, Rex.'],
  bossName: 'RICK VIGOR', bossSpeaker: 'vigor',
  bossHelp1: 'SPOTTERS! I need a SPOT!', bossHelp2: 'Somebody get these cops OFF my floor!',
  bossTaunts: ['FEEL THE VIGOR!', 'No pain, no gain!', 'Vigor never quits!', 'And... CURL!', 'Feel the BURN, officers!', 'Two more reps!'],
  barrel: { label: 'PROTEIN TUB', cost: 120 },
  donutToast: 'CONTRABAND DONUT. +35', donutLines: ['Contraband.', 'Finally, real food.', 'Carbs. Sweet, sweet carbs.', "Don't tell Vigor."],
  failTitle: 'BOTH OFFICERS DOWN', failLine: '"Two cops. One gym. And neither of you can do a single pull-up." — Capt. Brannigan',
  clearA: 'Clear. Members-only door, back wall.', clearB: "Clear. Vigor's private studio is through there.",
  objectives: {
    a: (n) => `CLEAR THE LOBBY<small>${n} TRAINER${n === 1 ? '' : 'S'} LEFT</small>`,
    aDone: 'GET IN THE BACK<small>"MEMBERS ONLY" DOOR</small>',
    b: (n) => `CLEAR THE WEIGHT ROOM<small>${n} TRAINER${n === 1 ? '' : 'S'} LEFT</small>`,
    bDone: 'FIND VIGOR<small>"STAFF ONLY" DOOR</small>',
    boss: 'TAKE DOWN RICK VIGOR',
  },
};

const _v = new THREE.Vector3();

export class GymScene extends WarehouseScene {
  config() { return GYM_CFG; }
  goonSpec() { return gymGoonSpec(); }

  // ------------------------------------------------------------------ level
  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x120a1a);
    s.fog = new THREE.Fog(0x1a0f24, 20, 68);
    s.add(new THREE.HemisphereLight(0xf0e0f0, 0x3a2030, 1.35));
    const dl = new THREE.DirectionalLight(0xffe8f0, 0.75);
    dl.position.set(-6, 20, 10);
    s.add(dl);
    const W = 40, D = 90, H = 6;
    // floors: lobby tile / rubber / sprung wood
    for (const [name, z0, z1, rx, ry] of [['lobbyTile', 0, 30, 10, 7.5], ['rubberFloor', 30, 60, 10, 7.5], ['wood', 60, 90, 8, 6]]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(W, z1 - z0), texMat(name, rx, ry));
      f.rotation.x = -Math.PI / 2; f.position.set(0, 0, (z0 + z1) / 2); s.add(f);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(0xd8d0d8, { emissive: 0x3a2e3a }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, D / 2); s.add(ceil);
    for (let z = 6; z < D; z += 8) for (const x of [-10, 0, 10]) { const p = box(3, 0.06, 1.0, B(0xfff6ee)); p.position.set(x, H - 0.04, z); s.add(p); }
    const wallMat = (w) => texMat('gymWall', w / 6, 1);
    const wallPlane = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat(w)); m.position.set(x, H / 2, z); m.rotation.y = ry; s.add(m); };
    wallPlane(W, 0, 0, 0); wallPlane(W, 0, D, Math.PI); wallPlane(D, -W / 2, D / 2, Math.PI / 2); wallPlane(D, W / 2, D / 2, -Math.PI / 2);
    this.addCollider(-W / 2 - 2, W / 2 + 2, -2, 0, H);
    this.addCollider(-W / 2 - 2, W / 2 + 2, D, D + 2, H);
    this.addCollider(-W / 2 - 2, -W / 2, 0, D, H);
    this.addCollider(W / 2, W / 2 + 2, 0, D, H);

    // front: glass doors onto the night street, neon sign above
    for (const x of [-1.6, 1.6]) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.2), B(0x1a2a5a, { transparent: true, opacity: 0.85 }));
      glass.position.set(x, 1.6, 0.03); s.add(glass);
      const bar = box(2.4, 0.08, 0.06, M(0xc8c8d0)); bar.position.set(x, 1.1, 0.08); s.add(bar);
    }
    for (const x of [-3.2, 0, 3.2]) { const post = box(0.12, 3.3, 0.1, M(0xc8c8d0)); post.position.set(x, 1.65, 0.05); s.add(post); }
    const head = box(6.6, 0.12, 0.1, M(0xc8c8d0)); head.position.set(0, 3.25, 0.05); s.add(head);
    const neon = makeSign('VIGOR BODY TEMPLE', { w: 9, h: 1.1, bg: '#12082e', fg: '#ff3fa4', font: 'bold 34px sans-serif', glow: '#ff3fa4' });
    neon.position.set(0, 4.5, 0.06); s.add(neon);
    const tag = makeSign('FEEL THE VIGOR!', { w: 4.5, h: 0.6, bg: '#12082e', fg: '#3ef2ff', font: 'italic bold 30px sans-serif', glow: '#3ef2ff' });
    tag.position.set(10, 3.6, 0.06); s.add(tag);

    // interior walls with doors
    this.doors = [];
    for (const [z, id, needs, unlocks, label, bg] of [[30, 'A', 'A', 'B', 'MEMBERS ONLY', '#14b8b0'], [60, 'B', 'B', 'C', 'STAFF ONLY', '#ff3fa4']]) {
      const wm = texMat('gymWall', 18.4 / 6, 1);
      for (const sx of [-1, 1]) {
        const seg = box(18.4, H, 0.5, wm);
        seg.position.set(sx * (1.6 + 9.2), H / 2, z);
        s.add(seg);
        this.addCollider(sx > 0 ? 1.6 : -20, sx > 0 ? 20 : -1.6, z - 0.25, z + 0.25, H);
      }
      const lintel = box(3.2, H - 3.3, 0.5, wm); lintel.position.set(0, 3.3 + (H - 3.3) / 2, z); s.add(lintel);
      const sign = makeSign(label, { w: 3, h: 0.5, bg, fg: '#fff', font: 'bold 40px sans-serif' });
      sign.position.set(0, 3.75, z - 0.27); sign.rotation.y = Math.PI; s.add(sign);
      const pivot = new THREE.Group();
      pivot.position.set(-1.5, 0, z);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.25, 0.14), new THREE.MeshLambertMaterial({ map: tex('door'), color: 0xffd0e8 }));
      panel.position.set(1.5, 1.625, 0);
      pivot.add(panel);
      s.add(pivot);
      const col = this.addCollider(-1.6, 1.6, z - 0.25, z + 0.25, H, { door: true });
      this.doors.push({ id, z, needs, unlocks, pivot, panel, col, open: false });
    }

    this.buildLobby();
    this.buildWeightRoom();
    this.buildLair();

    // protein tubs (they burst like the oil drums did)
    for (const [x, z] of [[-8.6, 22.6], [-7.7, 23.3], [9.2, 19.6], [6.2, 46], [7.0, 46.7], [-6.5, 41.5], [-11.5, 66], [11.5, 66]]) this.addBarrel(x, z);
    // contraband donuts
    for (const [x, z] of [[17.5, 6], [-17.5, 35], [17, 57], [-17, 63], [17, 63], [0, 64.5]]) this.addDonut(x, z);

    // a few lights (phone-friendly)
    for (const [x, z, c, i] of [[0, 12, 0xfff0f6, 12], [0, 45, 0xe8f6ff, 12], [0, 75, 0xffd8ee, 8]]) {
      const L = new THREE.PointLight(c, i, 26, 1.4); L.position.set(x, H - 0.6, z); s.add(L);
    }
  }

  /** cover block that stops bullets */
  coverBox(x, z, w, d, h, mat) { return this.solidBox(x, z, w, d, h, mat); }

  fern(x, z) {
    const s = this.scene;
    const pot = cyl(0.42, 0.34, 0.75, 8, M(0xf2f2f2)); pot.position.set(x, 0.375, z); s.add(pot);
    const band = cyl(0.43, 0.43, 0.1, 8, M(0xff3fa4)); band.position.set(x, 0.6, z); s.add(band);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), M(0x2f8a3a, { flatShading: true }));
    leaves.position.set(x, 1.45, z); leaves.scale.set(1, 1.1, 1); s.add(leaves);
    this.addCollider(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 1.6);
  }

  poster(x, z, ry) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshLambertMaterial({ map: tex('gymPoster') }));
    p.position.set(x, 2.1, z); p.rotation.y = ry; this.scene.add(p);
  }

  buildLobby() {
    const s = this.scene;
    // reception desk
    this.coverBox(-10, 12, 6, 1.3, 1.15, M(0xff3fa4));
    const top = box(6.3, 0.08, 1.6, M(0xf4f0ea)); top.position.set(-10, 1.19, 12); s.add(top);
    const monitor = box(0.6, 0.45, 0.5, M(0xe8e0c8)); monitor.position.set(-11.5, 1.46, 12.1); s.add(monitor);
    const screen = box(0.46, 0.32, 0.02, B(0x2aff7a)); screen.position.set(-11.5, 1.48, 11.84); s.add(screen);
    const deskSign = makeSign('MEMBERSHIPS\nTODAY ONLY $9,999', { w: 2.2, h: 0.7, bg: '#14b8b0', fg: '#fff', font: 'bold 26px sans-serif' });
    deskSign.position.set(-9, 0.62, 11.33); deskSign.rotation.y = Math.PI; s.add(deskSign);
    // turnstile
    for (const x of [3.2, 5.4]) { const post = box(0.3, 1.0, 0.3, M(0xc8c8d0)); post.position.set(x, 0.5, 8); s.add(post); this.addCollider(x - 0.15, x + 0.15, 7.85, 8.15, 1.0); }
    const arm = box(1.9, 0.06, 0.06, M(0xc8c8d0)); arm.position.set(4.3, 0.85, 8); s.add(arm);
    // juice bar
    this.coverBox(14.6, 20, 1.4, 9, 1.15, M(0x14b8b0));
    const bt = box(1.7, 0.08, 9.3, M(0xf4f0ea)); bt.position.set(14.6, 1.19, 20); s.add(bt);
    for (let i = 0; i < 4; i++) {
      const z = 16.6 + i * 2.2;
      const base = box(0.3, 0.18, 0.3, M(0x222222)); base.position.set(14.6, 1.32, z); s.add(base);
      const jar = cyl(0.13, 0.11, 0.42, 7, M(pick([0x7aff6a, 0xff7a2a, 0xff3fa4, 0xb07aff]), { transparent: true, opacity: 0.85 })); jar.position.set(14.6, 1.62, z); s.add(jar);
    }
    for (let i = 0; i < 4; i++) { const st = cyl(0.25, 0.25, 0.08, 8, M(0xff3fa4)); st.position.set(13.2, 0.8, 16.8 + i * 2.2); s.add(st); const leg = cyl(0.04, 0.04, 0.8, 4, M(0xc8c8d0)); leg.position.set(13.2, 0.4, 16.8 + i * 2.2); s.add(leg); }
    const menu = makeSign('JUICE BAR\nWHEATGRASS · CAROB\nPROTEIN BLAST', { w: 3.6, h: 1.4, bg: '#1a1030', fg: '#ffd23f', font: 'bold 26px sans-serif' });
    menu.position.set(19.95, 2.9, 20); menu.rotation.y = -Math.PI / 2; s.add(menu);
    // ferns, lounge, stacked mats as cover
    for (const [x, z] of [[-17.5, 3], [-4.5, 18], [7, 25.5], [-15.5, 27.5], [17.5, 27.5]]) this.fern(x, z);
    this.coverBox(-16.5, 18.5, 1.3, 3.6, 0.9, M(0x8a2a8a));
    for (const [x, z] of [[2.5, 17.5], [-6, 26], [11, 11]]) this.coverBox(x, z, 2.2, 1.3, 1.2, M(0x2a5ab0));
    for (const [x, z, ry] of [[-19.95, 8, Math.PI / 2], [-19.95, 22, Math.PI / 2], [19.95, 10, -Math.PI / 2]]) this.poster(x, z, ry);
  }

  treadmill(x, z) {
    const s = this.scene;
    const base = box(1.0, 0.3, 2.2, M(0x2a2a30)); base.position.set(x, 0.15, z); s.add(base);
    const belt = box(0.8, 0.02, 1.9, M(0x111114)); belt.position.set(x, 0.31, z); s.add(belt);
    for (const sx of [-0.45, 0.45]) { const r = box(0.06, 1.1, 0.06, M(0xc8c8d0)); r.position.set(x + sx, 0.85, z + 0.9); s.add(r); }
    const con = box(1.0, 0.35, 0.3, M(0x3a3a44)); con.position.set(x, 1.45, z + 0.95); s.add(con);
    const lcd = box(0.5, 0.15, 0.02, B(0xff3030)); lcd.position.set(x, 1.47, z + 0.79); s.add(lcd);
    this.addCollider(x - 0.5, x + 0.5, z - 1.1, z + 1.1, 1.6);
  }
  bike(x, z) {
    const s = this.scene;
    const frame = box(0.25, 0.9, 1.3, M(0xff3fa4)); frame.position.set(x, 0.55, z); s.add(frame);
    const seat = box(0.3, 0.08, 0.4, M(0x111111)); seat.position.set(x, 1.05, z - 0.4); s.add(seat);
    const bars = box(0.6, 0.06, 0.06, M(0xc8c8d0)); bars.position.set(x, 1.25, z + 0.55); s.add(bars);
    const fly = cyl(0.32, 0.32, 0.1, 10, M(0x2a2a30)); fly.rotation.z = Math.PI / 2; fly.position.set(x, 0.42, z + 0.4); s.add(fly);
    this.addCollider(x - 0.35, x + 0.35, z - 0.7, z + 0.7, 1.3);
  }
  dumbbellMesh(scale = 1) {
    const g = new THREE.Group();
    const bar = cyl(0.04 * scale, 0.04 * scale, 0.55 * scale, 6, M(0xc8c8d0));
    bar.rotation.z = Math.PI / 2; g.add(bar);
    for (const sx of [-1, 1]) { const p = cyl(0.15 * scale, 0.15 * scale, 0.12 * scale, 8, M(0x1c1c22)); p.rotation.z = Math.PI / 2; p.position.x = sx * 0.24 * scale; g.add(p); }
    return g;
  }
  squatRack(x, z) {
    const s = this.scene;
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.6, 0.6]) { const p = box(0.1, 2.4, 0.1, M(0x1c1c22)); p.position.set(x + sx, 1.2, z + sz); s.add(p); }
    for (const sx of [-0.9, 0.9]) { const t = box(0.1, 0.1, 1.3, M(0x1c1c22)); t.position.set(x + sx, 2.4, z); s.add(t); }
    const bar = cyl(0.035, 0.035, 2.6, 6, M(0xc8c8d0)); bar.rotation.z = Math.PI / 2; bar.position.set(x, 1.5, z - 0.4); s.add(bar);
    for (const sx of [-1.15, 1.15]) { const pl = cyl(0.36, 0.36, 0.12, 10, M(0x1c1c22)); pl.rotation.z = Math.PI / 2; pl.position.set(x + sx, 1.5, z - 0.4); s.add(pl); }
    this.addCollider(x - 1.0, x + 1.0, z - 0.7, z + 0.7, 2.4);
  }
  bench(x, z) {
    const s = this.scene;
    const pad = box(0.5, 0.15, 1.6, M(0xff3fa4)); pad.position.set(x, 0.55, z); s.add(pad);
    const leg = box(0.3, 0.5, 1.2, M(0x1c1c22)); leg.position.set(x, 0.25, z); s.add(leg);
    for (const sx of [-0.4, 0.4]) { const u = box(0.06, 1.2, 0.06, M(0x1c1c22)); u.position.set(x + sx, 0.6, z + 0.85); s.add(u); }
    const bar = cyl(0.03, 0.03, 2.2, 6, M(0xc8c8d0)); bar.rotation.z = Math.PI / 2; bar.position.set(x, 1.18, z + 0.85); s.add(bar);
    for (const sx of [-0.95, 0.95]) { const pl = cyl(0.28, 0.28, 0.1, 10, M(0x1c1c22)); pl.rotation.z = Math.PI / 2; pl.position.set(x + sx, 1.18, z + 0.85); s.add(pl); }
    this.addCollider(x - 1.1, x + 1.1, z - 0.8, z + 1.0, 1.25);
  }
  dumbbellRack(x, z, len) {
    const s = this.scene;
    const rack = box(1.1, 0.9, len, M(0x1c1c22)); rack.position.set(x, 0.45, z); s.add(rack);
    for (let k = -len / 2 + 0.5; k < len / 2; k += 0.75) {
      const d = this.dumbbellMesh(0.8 + Math.random() * 0.4);
      d.rotation.y = Math.PI / 2;
      d.position.set(x, 1.02, z + k);
      s.add(d);
    }
    this.addCollider(x - 0.55, x + 0.55, z - len / 2, z + len / 2, 1.1);
  }

  buildWeightRoom() {
    const s = this.scene;
    for (const x of [-13, -10, -7]) this.treadmill(x, 37.5);
    for (const x of [7, 9.5, 12]) this.bike(x, 37.5);
    this.squatRack(-13.5, 48); this.squatRack(13.5, 48);
    this.bench(-4.5, 51.5); this.bench(4.5, 51.5);
    this.dumbbellRack(-18.9, 47, 14); this.dumbbellRack(18.9, 47, 14);
    this.coverBox(0, 42.5, 2.4, 1.2, 1.2, M(0x2a5ab0));
    // mirrors along the side walls
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.4), new THREE.MeshLambertMaterial({ map: tex('mirror'), emissive: 0x1a2030 }));
      m.position.set(sx * 19.95, 2.3, 45); m.rotation.y = -sx * Math.PI / 2; s.add(m);
    }
    const sign = makeSign('NO PAIN · NO GAIN', { w: 8, h: 0.9, bg: '#1a1030', fg: '#ffd23f', font: 'bold 34px sans-serif', glow: '#ffd23f' });
    sign.position.set(0, 4.6, 59.7); sign.rotation.y = Math.PI; s.add(sign);
    // kettlebells / medicine balls
    for (const [x, z, c] of [[-2, 34, 0xff3fa4], [3, 56, 0x14b8b0], [-9, 56, 0xffd23f], [15, 33, 0xb07aff]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), M(c, { flatShading: true })); b.position.set(x, 0.3, z); s.add(b);
    }
  }

  buildLair() {
    const s = this.scene;
    // the back wall is one big mirror, with the neon promise above it
    const back = new THREE.Mesh(new THREE.PlaneGeometry(36, 3.2), new THREE.MeshLambertMaterial({ map: tex('mirror'), emissive: 0x1a2030 }));
    back.position.set(0, 2.0, 89.94); back.rotation.y = Math.PI; s.add(back);
    const neon = makeSign('FEEL THE VIGOR!', { w: 10, h: 1.4, bg: '#12082e', fg: '#ff3fa4', font: 'italic bold 36px sans-serif', glow: '#ff3fa4' });
    neon.position.set(0, 4.6, 89.93); neon.rotation.y = Math.PI; s.add(neon);
    // instructor stage (decor, low)
    const stage = box(10, 0.18, 4, M(0x6b2fa3)); stage.position.set(0, 0.09, 86.5); s.add(stage);
    const edge = box(10, 0.04, 0.06, B(0x3ef2ff)); edge.position.set(0, 0.2, 84.5); s.add(edge);
    const boom = box(1.0, 0.5, 0.3, M(0x222228)); boom.position.set(3.8, 0.43, 88); s.add(boom);
    for (const sx of [-0.28, 0.28]) { const sp = cyl(0.15, 0.15, 0.04, 10, M(0x888890)); sp.rotation.x = Math.PI / 2; sp.position.set(3.8 + sx, 0.45, 87.84); s.add(sp); }
    // hot tub
    const tub = cyl(1.8, 1.8, 0.9, 14, M(0x14b8b0)); tub.position.set(-13.5, 0.45, 80); s.add(tub);
    this.tubWater = new THREE.Mesh(new THREE.CircleGeometry(1.6, 14), new THREE.MeshBasicMaterial({ color: 0x7ae8ff }));
    this.tubWater.rotation.x = -Math.PI / 2; this.tubWater.position.set(-13.5, 0.86, 80); s.add(this.tubWater);
    this.addCollider(-15.3, -11.7, 78.2, 81.8, 0.9);
    // Vigor's desk: the cooked books and the cash
    this.coverBox(13.5, 83.5, 3.2, 1.4, 1.05, M(0xf4f0ea));
    const cashMat = new THREE.MeshLambertMaterial({ map: tex('cash') });
    for (let i = 0; i < 7; i++) { const st = box(0.42, 0.14 + Math.random() * 0.2, 0.22, cashMat); st.position.set(12.4 + (i % 4) * 0.5, 1.15 + (i > 3 ? 0.18 : 0), 83.2 + (i > 3 ? 0.35 : 0)); s.add(st); }
    const ledger = box(0.5, 0.08, 0.36, M(0xa01a1a)); ledger.position.set(15, 1.1, 83.6); ledger.rotation.y = 0.3; s.add(ledger);
    const safe = box(1.6, 1.8, 0.8, M(0x3a3a44)); safe.position.set(17.8, 0.9, 88.8); s.add(safe);
    const dial = cyl(0.14, 0.14, 0.05, 10, M(0xc8c8d0)); dial.rotation.x = Math.PI / 2; dial.position.set(17.8, 1.1, 88.38); s.add(dial);
    this.addCollider(17.0, 18.6, 88.4, 89.2, 1.8);
    // exercise balls & step platforms as cover
    for (const [x, z] of [[-15, 68], [15, 68], [-8, 74], [8, 74]]) this.coverBox(x, z, 1.8, 0.8, 1.0, M(0x2a5ab0));
    for (const [x, z, c] of [[-17.5, 86, 0xff3fa4], [-16, 87.5, 0x14b8b0], [9, 88.5, 0xffd23f]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), M(c, { flatShading: true })); b.position.set(x, 0.55, z); s.add(b);
    }
    // the boss-fight lights
    this.pumpOn = false;
    this.discoLights = [new THREE.PointLight(0xff3fa4, 0, 24, 1.4), new THREE.PointLight(0x3ef2ff, 0, 24, 1.4)];
    for (const L of this.discoLights) { L.position.set(0, 4, 77); s.add(L); }
  }

  addBarrel(x, z) {
    const g = new THREE.Group();
    const tub = cyl(0.42, 0.42, 1.15, 10, M(0xf4f4f4)); tub.position.y = 0.575; g.add(tub);
    const band = cyl(0.43, 0.43, 0.4, 10, M(0xff3fa4)); band.position.y = 0.6; g.add(band);
    const lid = cyl(0.44, 0.44, 0.1, 10, M(0x14b8b0)); lid.position.y = 1.2; g.add(lid);
    g.add(blobShadow(1.1, 1.1));
    g.position.set(x, 0, z);
    this.scene.add(g);
    const col = this.addCollider(x - 0.42, x + 0.42, z - 0.42, z + 0.42, 1.15, { barrel: true });
    this.barrels.push({ x, z, hp: 2, mesh: g, col, alive: true });
  }
  explodeBarrel(b, src) {
    if (b.alive) this.fx.dust(_v.set(b.x, 1, b.z), 30, [0.95, 0.93, 0.88]);
    super.explodeBarrel(b, src);
  }

  // ------------------------------------------------------------------ actors
  spawnEnemies() {
    const list = [
      ['A', -10, 24], ['A', 4, 22.5], ['A', 11.5, 16], ['A', -2, 27.5],
      ['B', -16, 43], ['B', 16, 41], ['B', -10, 55], ['B', 10, 54.5], ['B', 0, 47], ['B', 4, 57.5],
      ['C', -10.5, 72], ['C', 10.5, 72],
    ];
    for (const [zone, x, z] of list) this.addGoon(zone, x, z);
    const rig = new Rig(SPECS.vigor);
    this.scene.add(rig.root);
    this.boss = { kind: 'boss', rig, x: 0, z: 85.6, yaw: Math.PI, hp: 1500, maxHp: 1500, r: 0.6, dead: false, active: false, moveT: 0, goal: { x: 0, z: 82 }, fanT: 2.5, grenT: 3.5, spawned1: false, spawned2: false, monologued: false, zone: 'C', alert: true, stunT: 0, pose: null, burst: 0, burstT: 0, poseT: 0 };
    this.placeActor(this.boss);
  }

  // ------------------------------------------------------------------ boss
  updateBoss(dt) {
    const b = this.boss;
    if (!b.active || b.dead) return;
    const [tgt] = this.nearestChar(b);
    b.stunT -= dt;
    b.moveT -= dt;
    if (b.poseT > 0) { b.poseT -= dt; if (b.poseT <= 0) b.pose = null; }
    if (b.moveT <= 0 || Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 0.5) {
      b.moveT = rand(1.3, 2.4);
      b.goal = { x: rand(-8, 8), z: rand(71, 85) };
    }
    const gx = b.goal.x - b.x, gz = b.goal.z - b.z, gd = Math.hypot(gx, gz);
    b.moving = 0;
    if (gd > 0.3 && b.stunT <= 0 && b.poseT <= 0) {
      b.x += (gx / gd) * 3.6 * dt; b.z += (gz / gd) * 3.6 * dt;
      b.moving = 1;
    }
    this.collide(b);
    if (tgt) b.yaw = dampAngle(b.yaw, Math.atan2(tgt.x - b.x, tgt.z - b.z), 6, dt);
    // gold pistol: three-round bursts
    b.fanT -= dt;
    if (b.fanT <= 0 && tgt && this.los(b, tgt)) {
      b.fanT = 2.1;
      b.burst = 3; b.burstT = 0;
      if (Math.random() < 0.3) this.sub('vigor', pick(this.cfg.bossTaunts), 2);
    }
    if (b.burst > 0 && tgt) {
      b.burstT -= dt;
      if (b.burstT <= 0) { b.burst--; b.burstT = 0.15; this.enemyShoot(b, tgt, { acc: 0.24, dmg: 8 }); }
    }
    // dumbbells
    b.grenT -= dt;
    if (b.grenT <= 0 && tgt) {
      const angry = b.hp < b.maxHp * 0.5;
      b.grenT = angry ? rand(2.8, 3.8) : rand(3.4, 4.6);
      this.throwBall(b, tgt);
      const other = this.chars.find((c) => c !== tgt && !c.down);
      if (angry) this.tweens.push({ t: 0, dur: 0.35, fn: () => {}, done: () => { if (!b.dead && b.active) this.throwBall(b, other || tgt); } });
      b.pose = 'raise'; b.poseT = 0.4;
      if (Math.random() < 0.35) this.sub('vigor', pick(['And... CURL!', 'Catch!', 'Twenty-pounders, officers!', 'Spot THIS!']), 1.8);
    }
    b.rig.root.position.set(b.x, 0, b.z);
    b.rig.root.rotation.y = b.yaw;
  }

  /** Vigor lobs a dumbbell: a telegraphed arc with a warning ring where it will land. */
  throwBall(from, tgt) {
    const T = 1.15, grav = 18;
    const tx = tgt.x + rand(-0.8, 0.8), tz = tgt.z + rand(-0.8, 0.8);
    const m = this.dumbbellMesh(1.35);
    const y0 = 2.0;
    m.position.set(from.x, y0, from.z);
    this.scene.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.4, 20), new THREE.MeshBasicMaterial({ color: 0xff2050, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(tx, 0.04, tz);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0xff2050, transparent: true, opacity: 0.5, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2; dot.position.set(tx, 0.045, tz);
    this.scene.add(ring, dot);
    this.grenades.push({
      x: from.x, y: y0, z: from.z, vx: (tx - from.x) / T, vz: (tz - from.z) / T, vy: (0.15 - y0 + 0.5 * grav * T * T) / T,
      mesh: m, ring, dot, tx, tz, dodge: true, landed: false, bounced: false, restT: 0, spin: rand(8, 12),
    });
    this.game.audio.sfx('whoosh');
  }

  updateGrenades(dt) {
    const g = this.game;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const n = this.grenades[i];
      if (!n.landed || !n.bounced) {
        n.vy -= 18 * dt;
        n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
        n.mesh.rotation.x += dt * n.spin;
        if (n.ring) { const k = 0.5 + 0.5 * Math.sin(this.t * 18); n.ring.material.opacity = 0.45 + k * 0.4; }
        if (n.y <= 0.15) {
          n.y = 0.15;
          if (!n.landed) { n.landed = true; n.dodge = false; this.impact(n); n.vy = 3.2; n.vx *= 0.25; n.vz *= 0.25; }
          else { n.bounced = true; g.audio.sfx('clang', 0.35); n.mesh.rotation.x = 0; }
        }
      } else {
        n.restT += dt;
        if (n.restT > 3) n.mesh.visible = Math.floor(n.restT * 12) % 2 === 0;
        if (n.restT > 4) { n.mesh.removeFromParent(); this.grenades.splice(i, 1); continue; }
      }
      n.mesh.position.set(n.x, n.y, n.z);
    }
  }

  impact(n) {
    const g = this.game;
    for (const m of [n.ring, n.dot]) { if (m) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); } }
    n.ring = n.dot = null;
    g.audio.sfx('dumbbell');
    this.shakeAll(0.9);
    this.fx.dust(_v.set(n.x, 0.2, n.z), 16);
    this.fx.sparks(_v.set(n.x, 0.2, n.z), 6);
    for (const c of this.chars) {
      const d = Math.hypot(c.x - n.x, c.z - n.z);
      if (d < 2.4 && c.diveT <= 0 && !c.down) {
        this.hurtChar(c, Math.round(24 * (1 - d / 2.4)) + 8);
        if (!c.down) c.getupT = Math.max(c.getupT, 0.45);
      }
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - n.x, e.z - n.z);
      if (d < 2.2) { e.hp = 0; this.killEnemy(e, { weapon: { knock: 8, dmg: 100 } }, (e.x - n.x) / (d || 1), (e.z - n.z) / (d || 1)); }
    }
  }

  updateLair(dt) {
    if (this.tubWater) this.tubWater.material.color.setHSL(0.53, 0.8, 0.68 + Math.sin(this.t * 3) * 0.04);
    this.discoLights.forEach((L, i) => {
      L.intensity = this.pumpOn ? 22 : 0;
      const a = this.t * (1.2 + i * 0.5) + i * 3;
      L.position.set(Math.cos(a) * 7, 3.2, 78 + Math.sin(a) * 6);
    });
  }

  // ------------------------------------------------------------------ cutscenes
  async intro() {
    const g = this.game, ui = g.ui;
    this.cutscene = true;
    ui.letterbox(true);
    this.setCut([0.8, 1.8, 10.5], [0, 1.55, 4]);
    this.chars[0].pose = 'idle'; this.chars[1].pose = 'hips';
    g.audio.playSong('warehouse');
    await this.cut(async () => {
      await this.w(ui.fade(0, 0.8));
      await this.w(ui.locationCard(['THE VIGOR BODY TEMPLE · FLAGSHIP', 'BEVERLY HILLS · 11:02 PM'], 1.0));
      await this.say('delgado', 'Closed for the night.');
      this.chars[0].pose = 'gunUp';
      g.audio.sfx('spin', 0.7);
      await this.say('hammer', 'Not for us.');
      g.audio.sfx('beep', 0.5);
      await this.say('vigor', "Attention, officers. The Temple is CLOSED. ...Unless you'd like to purchase a LIFETIME MEMBERSHIP.");
      this.chars[1].pose = 'cross';
      await this.say('delgado', "Rex, his entire security team is personal trainers.");
      await this.say('hammer', "Then let's give 'em a workout.");
    }, () => ui.fade(0, 0.2));
    this.chars[0].pose = null; this.chars[1].pose = null;
    this.endCut();
    this.updateCameras(0);
    ui.toast('CLEAR THE LOBBY', 'big');
    if (g.touch.used) ui.sub('narrator', 'Left thumb moves, drag the right side to turn. FIRE has aim assist. DIVE dodges dumbbells. Tap KICK at doors. Donuts heal.', 6);
    else ui.sub('narrator', g.mode === 2
      ? 'P1 WASD + mouse (click to lock) · P2 arrows + ENTER · dive, reload, F or / to kick doors. Revive your partner by standing close.'
      : 'Click to use the mouse (or Q/E to turn). SPACE/click fires with aim assist. SHIFT dives. TAB swaps partners. Donuts heal.', 6);
  }

  async bossIntro() {
    const g = this.game;
    await this.startCut();
    g.audio.stopMusic(0.5);
    for (const [i, c] of this.chars.entries()) { if (c.down) { c.down = false; c.hp = 40; } c.x = i ? 1.3 : -1.3; c.z = 65.5; c.yaw = 0; c.diveT = 0; c.pose = 'aim'; }
    // a kicked-in door can land right in the shot; tidy it away
    // and the door into this room swings to exactly where the camera sits behind the cops
    for (const d of this.doors) if ((d.open && Math.abs(d.pivot.position.z - d.z) > 0.5) || d.unlocks === 'C') d.pivot.visible = false;
    const b = this.boss;
    b.x = 0; b.z = 86.2; b.yaw = Math.PI;
    b.pose = 'aeroFlex';
    this.setCut([0.4, 1.9, 80.6], [0, 1.9, 86.2]);
    await this.cut(async () => {
      await this.say('vigor', 'Hammer. Delgado. You missed the nine o\'clock class.');
      this.setCut([0.3, 1.8, 69.5], [0, 1.6, 65.5]);
      await this.say('hammer', "We're here for the eleven o'clock. Murder One.");
      this.setCut([-1.2, 0.7, 83.8], [0, 0.45, 86.2]);
      b.pose = 'hips';
      await this.say('delgado', 'Nice leg warmer, Rick. Just the one?');
      this.setCut([0.5, 1.95, 83.4], [0, 1.95, 86.2]);
      b.pose = 'point';
      await this.say('vigor', 'It is a LOOK.');
      this.pumpOn = true;
      g.audio.sfx('dun');
      b.pose = 'raise';
      await this.wait(0.6);
      g.audio.playSong('pump');
      await this.say('vigor', 'Now... FEEL... THE VIGOR!');
    }, () => {
      if (!this.pumpOn) { this.pumpOn = true; g.audio.sfx('dun'); }
      g.audio.playSong('pump');
    });
    b.pose = null;
    for (const c of this.chars) c.pose = null;
    b.active = true;
    for (const e of this.enemies) if (e.zone === 'C') e.alert = true;
    this.endCut();
    g.ui.toast('TAKE DOWN RICK VIGOR', 'big');
  }

  async monologue() {
    await this.startCut();
    const b = this.boss;
    b.pose = 'hips';
    b.burst = 0;
    const camFrom = (dist, h) => [b.x + Math.sin(b.yaw) * dist + 0.4, h, b.z + Math.cos(b.yaw) * dist];
    this.setCut(camFrom(3.2, 1.95), [b.x, 1.9, b.z]);
    await this.cut(async () => {
      await this.say('vigor', 'You want to know WHY, Hammer? Morty wanted to cancel his membership.');
      b.pose = 'raise';
      await this.say('vigor', "NOBODY cancels a LIFETIME membership. It's in the NAME.");
      const d = this.chars[1];
      this.setCut([d.x + Math.sin(d.yaw) * 2.6, 1.7, d.z + Math.cos(d.yaw) * 2.6], [d.x, 1.62, d.z]);
      await this.say('delgado', 'So you strangled him. With your own leg warmer.');
      this.setCut(camFrom(3.2, 1.95), [b.x, 1.9, b.z]);
      b.pose = 'shrug';
      await this.say('vigor', 'I was mid-workout! It was the closest thing I had!');
      const h = this.chars[0];
      this.setCut([h.x + Math.sin(h.yaw) * 2.6, 1.85, h.z + Math.cos(h.yaw) * 2.6], [h.x, 1.8, h.z]);
      await this.say('hammer', 'Should have stretched first.');
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
    for (const n of this.grenades) { n.mesh.removeFromParent(); n.ring?.removeFromParent(); n.dot?.removeFromParent(); }
    this.grenades = [];
    for (const e of this.enemies) if (!e.gone) { e.gone = true; e.dead = true; e.rig.root.removeFromParent(); }
    const [H, D] = this.chars;
    const b = this.boss;
    for (const c of this.chars) { c.down = false; c.hp = Math.max(c.hp, 1); c.diveT = 0; c.getupT = 0; c.rig.body.rotation.x = 0; c.rig.body.position.y = 0; }
    b.x = 0; b.z = 80; b.yaw = Math.PI; b.pose = 'holdHostage';
    D.x = 0; D.z = 79.3; D.yaw = Math.PI; D.pose = 'hostage';
    H.x = 0; H.z = 74.2; H.yaw = 0; H.pose = 'aim';
    g.audio.stopMusic(1.2);
    this.pumpOn = false;
    const counted = { hostage: false, wfm: false };
    await this.cut(async () => {
      this.setCut([4.4, 1.8, 77.2], [0, 1.6, 78.6]);
      await this.say('vigor', 'One more step, Hammer, and your partner feels the BURN!');
      this.setCut([-0.7, 1.95, 71.6], [0, 1.55, 79.4]);
      await this.say('hammer', 'Let her go, Vigor.');
      g.stats.hostage++;
      counted.hostage = true;
      this.setCut([0.25, 1.72, 77.2], [0, 1.66, 79.3]);
      await this.say('delgado', `Rex. That's ${g.stats.hostage === 16 ? 'sixteen' : g.stats.hostage} times this season.`);
      this.setCut([-0.7, 1.95, 71.6], [0, 1.55, 79.4]);
      await this.say('hammer', 'I know.');
      this.setCut([2.6, 0.9, 79.0], [0, 0.4, 80]);
      await this.say('delgado', "I'll handle it.");
      // she steps on the dangling leg warmer and sweeps his feet
      D.pose = 'kick';
      g.audio.sfx('whoosh');
      b.pose = 'flail';
      await this.wait(0.3);
      g.audio.sfx('thump');
      this.tweens.push({ t: 0, dur: 0.5, fn: (k) => { b.rig.body.rotation.x = -k * Math.PI / 2; b.rig.body.position.y = Math.sin(k * Math.PI) * 0.5 + k * 0.15; b.z = 80 + k * 0.8; } });
      await this.wait(0.55);
      g.audio.sfx('dumbbell');
      this.shakeAll(0.8);
      b.pose = 'lie';
      D.yaw = 0; D.pose = 'cuff';
      await this.wait(0.5);
      g.audio.sfx('cuff');
      this.setCut([3.4, 1.75, 77.4], [0, 0.85, 80.3]);
      await this.say('delgado', 'Rick Vigor, you have the right to remain sweaty.');
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
}
