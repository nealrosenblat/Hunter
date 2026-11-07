import * as THREE from 'three';
import { tex, texR, faceTex, carSideTex } from './textures.js';
import { pick, rand } from './util.js';

// ------------------------------------------------------------------ materials
const shared = new Map();
/** Cached Lambert material (do not mutate). */
export function M(color, extra = {}) {
  const key = color + '|' + JSON.stringify(extra, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!shared.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color, ...extra });
    m.userData.keep = true;
    shared.set(key, m);
  }
  return shared.get(key);
}
/** Fresh Lambert material (safe to mutate, e.g. hit flashes). */
export const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
export function B(color, extra = {}) {
  const key = 'B' + color + JSON.stringify(extra);
  if (!shared.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color, ...extra });
    m.userData.keep = true;
    shared.set(key, m);
  }
  return shared.get(key);
}
export function texMat(name, rx = 1, ry = 1, extra = {}) {
  return new THREE.MeshLambertMaterial({ map: rx === 1 && ry === 1 ? tex(name) : texR(name, rx, ry), ...extra });
}

const geoCache = new Map();
function G(key, make) {
  if (!geoCache.has(key)) { const g = make(); g.userData.keep = true; geoCache.set(key, g); }
  return geoCache.get(key);
}
export const box = (w, h, d, mat) => new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
export const cyl = (rt, rb, h, seg, mat) => new THREE.Mesh(G(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat);

export function blobShadow(w = 1, d = 1) {
  const m = new THREE.Mesh(
    G('shadowPlane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    B(0xffffff, { map: tex('shadow'), transparent: true, depthWrite: false, opacity: 1 }),
  );
  m.scale.set(w, 1, d);
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}

// ------------------------------------------------------------------ characters
export const SPECS = {
  hammer: {
    scale: 1.07, shoulders: 1.15, skin: 0xd9a07a, hair: 0x4a2c1a, hairStyle: 'mullet',
    jacket: 0x8a6038, shirt: 0xefe6cf, pants: 0x3d3a35, shoes: 0x2a1a10,
    face: { brow: 'heavy', mouth: 'smirk', stubble: true, eye: '#3a5a80' }, gun: 'magnum',
  },
  delgado: {
    scale: 0.96, skin: 0xf2c4a0, hair: 0xf0cf72, hairStyle: 'feathered',
    jacket: 0xd86fae, shirt: 0xffffff, pants: 0xf2eee4, shoes: 0xf2eee4, pads: true,
    face: { lipstick: true, mouth: 'flat', lashes: true, eye: '#2f7a4a', blush: true, shadowLid: true, hairline: 11 }, gun: 'pistol',
  },
  captain: {
    scale: 1.0, girth: 1.22, skin: 0xc98a64, hair: 0x9a9a9a, hairStyle: 'bald',
    jacket: 0xf0efe6, shirt: 0xf0efe6, tie: 0x8a2222, pants: 0x4a4a52, shoes: 0x111111, suspenders: 0x553322,
    face: { mustache: true, brow: 'angry', mouth: 'frown', hairline: false }, gun: null,
  },
  duke: {
    scale: 1.05, girth: 1.05, skin: 0xd2a07c, hair: 0x111111, hairStyle: 'pompadour',
    jacket: 0xf8f6ee, shirt: 0x161616, pants: 0xf8f6ee, shoes: 0xffffff, chain: true, collar: true,
    face: { shades: true, mouth: 'grin', mustache: 'thin' }, gun: 'gold',
  },
  // ---- Episode 2: "Death Wears Leg Warmers"
  vigor: {
    scale: 1.1, shoulders: 1.3, skin: 0xd08a5a, hair: 0xe8c860, hairStyle: 'feathered',
    jacket: 0xd08a5a, shirt: 0x1a1a1a, pants: 0x1c2a8a, shoes: 0xffffff, legWarmers: 0xff3fa4, oneLegWarmer: true, sweatband: 0xffffff, chain: true,
    face: { mouth: 'grin', brow: 'heavy', mustache: 'thin', eye: '#2a6ab0' }, gun: 'gold',
  },
  candi: {
    scale: 0.95, skin: 0xf0c0a0, hair: 0xd8502a, hairStyle: 'feathered',
    jacket: 0xf0c0a0, shirt: 0x14b8b0, pants: 0x14b8b0, shoes: 0xffffff, legWarmers: 0xffd23f, sweatband: 0xff3fa4,
    face: { lipstick: true, mouth: 'smirk', lashes: true, eye: '#2a6ab0', blush: true, shadowLid: true, hairline: 11 }, gun: null,
  },
  delgadoGym: {
    scale: 0.96, skin: 0xf2c4a0, hair: 0xf0cf72, hairStyle: 'feathered',
    jacket: 0xf2c4a0, shirt: 0xd86fae, pants: 0x2a1a4a, shoes: 0xffffff, legWarmers: 0xd86fae, sweatband: 0xffffff,
    face: { lipstick: true, mouth: 'flat', lashes: true, eye: '#2f7a4a', blush: true, shadowLid: true, hairline: 11 }, gun: null,
  },
  hammerGym: {
    scale: 1.07, shoulders: 1.15, skin: 0xd9a07a, hair: 0x4a2c1a, hairStyle: 'mullet',
    jacket: 0x9a9aa2, shirt: 0x9a9aa2, pants: 0x9a9aa2, shoes: 0xffffff, sweatband: 0xff3fa4, stripes: true,
    face: { brow: 'heavy', mouth: 'flat', stubble: true, eye: '#3a5a80' }, gun: null,
  },
  worker: {
    scale: 1.0, skin: 0xc58b62, hair: 0x2a2a2a, hairStyle: 'cap', capColor: 0x2266aa,
    jacket: 0x6b8fb5, shirt: 0x6b8fb5, pants: 0x30353d, face: { mouth: 'frown' }, gun: null,
  },
};

const GOON_LOOKS = [
  { jacket: 0x161616, shirt: 0x7a1d1d, pants: 0x2a2a2e, hairStyle: 'slick', face: { shades: true, mouth: 'flat' } },
  { jacket: 0x1f8f86, shirt: 0xffffff, pants: 0x1f8f86, hairStyle: 'buzz', stripes: true, face: { mouth: 'frown', brow: 'angry' } },
  { jacket: 0x6b2fa3, shirt: 0xffd23f, pants: 0x222244, hairStyle: 'headband', face: { mouth: 'grin', stubble: true } },
  { jacket: 0x8a2424, shirt: 0x111111, pants: 0x3a3a3a, hairStyle: 'cap', capColor: 0x111111, face: { shades: true, mouth: 'smirk', stubble: true } },
  { jacket: 0x3b4a2a, shirt: 0xd9d0b0, pants: 0x55462f, hairStyle: 'buzz', face: { mouth: 'flat', scar: true, brow: 'heavy' } },
];
const GYM_LOOKS = [
  { jacket: 0x1a1a8a, shirt: 0xffffff, pants: 0x1a1a8a, hairStyle: 'buzz', stripes: true, face: { mouth: 'frown', brow: 'angry' } },
  { jacket: 0x8a1a5a, shirt: 0x111111, pants: 0x8a1a5a, hairStyle: 'slick', stripes: true, face: { shades: true, mouth: 'flat' } },
  { jacket: 0xd08a5a, shirt: 0xffd23f, pants: 0x222222, hairStyle: 'headband', face: { mouth: 'grin', stubble: true }, girth: 1.18, shoulders: 1.3 },
  { jacket: 0x0f6a5a, shirt: 0xffffff, pants: 0x0f6a5a, hairStyle: 'cap', capColor: 0xff3fa4, stripes: true, face: { shades: true, mouth: 'smirk' } },
  { jacket: 0xd08a5a, shirt: 0x14b8b0, pants: 0x14b8b0, hairStyle: 'buzz', sweatband: 0xffd23f, legWarmers: 0xff3fa4, face: { mouth: 'flat', brow: 'heavy' }, shoulders: 1.25 },
];
/** Henchmen in tracksuits and tank tops for Rick Vigor's gym. */
export function gymGoonSpec() {
  const look = pick(GYM_LOOKS);
  const skin = pick([0xe0b090, 0xc58b62, 0x9a6a48, 0x7a4e34, 0xf0c8a8]);
  const hair = pick([0x111111, 0x2a1a10, 0x4a3020, 0xd8b860]);
  const sk = look.jacket === 0xd08a5a ? { jacket: skin } : {};
  return { scale: rand(0.98, 1.08), girth: rand(0.95, 1.1), skin, hair, shoes: 0xffffff, gun: 'pistol', ...look, ...sk, face: { ...look.face } };
}

export function goonSpec() {
  const look = pick(GOON_LOOKS);
  const skin = pick([0xe0b090, 0xc58b62, 0x9a6a48, 0x7a4e34, 0xf0c8a8]);
  const hair = pick([0x111111, 0x2a1a10, 0x4a3020, 0x6a5040]);
  return { scale: rand(0.96, 1.06), girth: rand(0.95, 1.12), skin, hair, shoes: 0x111111, gun: 'pistol', ...look, face: { ...look.face } };
}

const POSES = {
  idle: { swing: true, armL: [0, 0, 0.12], armR: [0, 0, -0.12], elL: -0.2, elR: -0.2 },
  aim: { armL: [-1.35, 0, -0.45], armR: [-1.52, 0, 0.04], elL: -0.3, elR: 0, torso: [0, 0.12, 0] },
  aim1: { armL: [0, 0, 0.12], armR: [-1.52, 0, 0.04], elL: -0.2, elR: 0, legSwing: true },
  gunUp: { armL: [0, 0, 0.12], armR: [-0.3, 0, -0.15], elL: -0.2, elR: -2.5 },
  cross: { armL: [-0.45, -1.1, 0.15], armR: [-0.45, 1.1, -0.15], elL: -1.7, elR: -1.7 },
  point: { armL: [0, 0, 0.12], armR: [-1.55, 0, 0], elL: -0.2, elR: 0 },
  slam: { armL: [-1.0, 0, 0.18], armR: [-1.0, 0, -0.18], elL: -0.3, elR: -0.3, torso: [0.35, 0, 0] },
  raise: { armL: [-2.7, 0, 0.35], armR: [-2.7, 0, -0.35], elL: -0.3, elR: -0.3 },
  shrug: { armL: [-0.15, 0, 0.45], armR: [-0.15, 0, -0.45], elL: -1.5, elR: -1.5 },
  hips: { armL: [0.1, -0.9, 0.5], armR: [0.1, 0.9, -0.5], elL: -1.6, elR: -1.6 },
  holdHostage: { armL: [-1.25, 0, -0.75], armR: [-1.1, 0, 0.35], elL: -1.1, elR: -1.2 },
  hostage: { armL: [-0.3, 0, 0.1], armR: [-0.3, 0, -0.1], elL: -0.6, elR: -0.6 },
  elbow: { armL: [-0.3, 0, 0.2], armR: [0.9, 0, -0.25], elL: -0.4, elR: -1.9, torso: [0, 0.7, 0] },
  cuff: { armL: [-1.1, 0, -0.25], armR: [-1.1, 0, 0.25], elL: -0.6, elR: -0.6, torso: [0.5, 0, 0] },
  kick: { armL: [-0.6, 0, 0.5], armR: [-0.3, 0, -0.6], elL: -0.3, elR: -0.3, legR: -1.55, torso: [-0.3, 0, 0] },
  carry: { armL: [-1.3, 0, 0.25], armR: [-1.3, 0, -0.25], elL: -0.5, elR: -0.5 },
  dive: { armL: [-2.9, 0, 0.15], armR: [-2.95, 0, -0.1], elL: 0, elR: 0, legL: 0.15, legR: -0.1 },
  diveAim: { armL: [-2.9, 0, 0.15], armR: [-2.4, 0, -0.1], elL: 0, elR: 0, legL: 0.15, legR: -0.1 },
  lie: { armL: [0, 0, 0.9], armR: [0, 0, -1.1], elL: -0.2, elR: -0.3, legL: 0.1, legR: -0.15 },
  flail: { flail: true, armL: [-1.5, 0, 0.6], armR: [-1.5, 0, -0.6], elL: -0.5, elR: -0.5 },
  wave: { armL: [0, 0, 0.12], armR: [-0.2, 0, -2.5], elL: -0.2, elR: -0.8 },
  phone: { armL: [0, 0, 0.12], armR: [-0.6, 0.6, -0.35], elL: -0.2, elR: -2.4 },
  // aerobics moves (Episode 2)
  aeroUp: { armL: [-2.95, 0, 0.25], armR: [-2.95, 0, -0.25], elL: 0, elR: 0, torso: [-0.08, 0, 0] },
  aeroLeft: { armL: [0, 0, 2.4], armR: [0, 0, -0.9], elL: 0, elR: -0.2, torso: [0, 0, 0.28], legL: -0.25 },
  aeroRight: { armL: [0, 0, 0.9], armR: [0, 0, -2.4], elL: -0.2, elR: 0, torso: [0, 0, -0.28], legR: -0.25 },
  aeroDown: { armL: [-0.9, 0, 0.1], armR: [-0.9, 0, -0.1], elL: 0, elR: 0, torso: [0.85, 0, 0] },
  aeroClap: { armL: [-1.5, -0.5, 0], armR: [-1.5, 0.5, 0], elL: -0.6, elR: -0.6 },
  aeroFlex: { armL: [0, 0, 1.55], armR: [0, 0, -1.55], elL: -2.0, elR: -2.0 },
};

function limb(mat, rTop, rBot, len, seg = 6) {
  const g = new THREE.Group();
  const m = cyl(rTop, rBot, len, seg, mat);
  m.position.y = -len / 2;
  g.add(m);
  return g;
}

export class Rig {
  constructor(spec) {
    this.spec = spec;
    this.t = Math.random() * 10;
    this.phase = 0;
    this.flashT = 0;
    const S = spec.scale ?? 1, W = spec.girth ?? 1, SH = spec.shoulders ?? 1;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const m = (this.mats = {
      skin: L(spec.skin), jacket: L(spec.jacket), shirt: L(spec.shirt), pants: L(spec.pants),
      shoes: L(spec.shoes ?? 0x1e1a18), hair: L(spec.hair ?? 0x222222),
    });
    const legLen = 0.9 * S;
    this.hips = new THREE.Group();
    this.hips.position.y = legLen;
    this.body.add(this.hips);

    const hipW = 0.12 * S * W;
    this.legL = limb(m.pants, 0.105 * S * W, 0.08 * S, legLen - 0.05 * S);
    this.legR = limb(m.pants, 0.105 * S * W, 0.08 * S, legLen - 0.05 * S);
    this.legL.position.x = hipW; this.legR.position.x = -hipW;
    for (const leg of [this.legL, this.legR]) {
      const shoe = box(0.14 * S, 0.09 * S, 0.27 * S, m.shoes);
      shoe.position.set(0, -(legLen - 0.06 * S), 0.05 * S);
      leg.add(shoe);
      if (spec.legWarmers && !(spec.oneLegWarmer && leg === this.legR)) {
        // the clue: big fuzzy leg warmers bunched over the shins
        const lw = cyl(0.1 * S * W, 0.11 * S, 0.36 * S, 7, L(spec.legWarmers));
        lw.position.y = -(legLen - 0.27 * S);
        leg.add(lw);
        for (const yy of [0.12, 0.24]) {
          const ring = cyl(0.112 * S * W, 0.112 * S * W, 0.025 * S, 7, L(spec.legWarmersStripe ?? 0xffffff));
          ring.position.y = -(legLen - yy * S - 0.1 * S);
          leg.add(ring);
        }
      }
      this.hips.add(leg);
    }
    const pantsTop = box(0.42 * S * W, 0.16 * S, 0.25 * S * W, m.pants);
    pantsTop.position.y = 0.02 * S;
    this.hips.add(pantsTop);

    // torso
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const tw = 0.46 * S * W * SH, th = 0.6 * S, td = 0.27 * S * W;
    const chest = box(tw, th, td, m.jacket);
    chest.position.y = th / 2 + 0.06 * S;
    this.torso.add(chest);
    const front = td / 2 + 0.004;
    const shirt = box(0.15 * S, th * 0.82, 0.02, m.shirt);
    shirt.position.set(0, th * 0.58 + 0.06 * S, front);
    this.torso.add(shirt);
    if (spec.tie) {
      const tie = box(0.06 * S, th * 0.62, 0.02, L(spec.tie));
      tie.position.set(0, th * 0.52 + 0.06 * S, front + 0.012);
      this.torso.add(tie);
    }
    if (spec.suspenders) {
      for (const sx of [-1, 1]) {
        const s = box(0.04 * S, th, 0.02, L(spec.suspenders));
        s.position.set(sx * tw * 0.27, th / 2 + 0.06 * S, front + 0.006);
        this.torso.add(s);
      }
    }
    if (spec.stripes) {
      for (const sx of [-1, 1]) {
        const s = box(0.03, th * 0.9, td + 0.01, L(0xffffff));
        s.position.set(sx * (tw / 2 - 0.01), th / 2 + 0.06 * S, 0);
        this.torso.add(s);
      }
    }
    if (spec.chain) {
      const chain = new THREE.Mesh(G('chain', () => new THREE.TorusGeometry(0.09, 0.012, 4, 10)), M(0xffcc33, { emissive: 0x553300 }));
      chain.position.set(0, th * 0.78 + 0.06 * S, front + 0.012);
      this.torso.add(chain);
    }
    if (spec.collar) {
      for (const sx of [-1, 1]) {
        const c = box(0.12 * S, 0.03, 0.16 * S, m.jacket);
        c.position.set(sx * 0.1 * S, th + 0.05 * S, td * 0.25);
        c.rotation.z = sx * 0.5;
        this.torso.add(c);
      }
    }
    if (spec.pads) {
      for (const sx of [-1, 1]) {
        const p = box(0.17 * S, 0.08 * S, td * 1.05, m.jacket);
        p.position.set(sx * (tw / 2 + 0.03), th + 0.03 * S, 0);
        this.torso.add(p);
      }
    }
    const neck = cyl(0.055 * S, 0.06 * S, 0.1 * S, 6, m.skin);
    neck.position.y = th + 0.1 * S;
    this.torso.add(neck);

    // head
    this.head = new THREE.Group();
    this.head.position.y = th + 0.12 * S;
    this.torso.add(this.head);
    const hw = 0.25 * S, hh = 0.29 * S, hd = 0.27 * S;
    const faceMat = new THREE.MeshLambertMaterial({ map: faceTex({ skin: spec.skin, hair: spec.hair, ...spec.face }) });
    const topMat = spec.hairStyle === 'bald' ? m.skin : m.hair;
    const backMat = spec.hairStyle === 'bald' ? m.skin : m.hair;
    const headMesh = new THREE.Mesh(G(`head${hw},${hh},${hd}`, () => new THREE.BoxGeometry(hw, hh, hd)), [m.skin, m.skin, topMat, m.skin, faceMat, backMat]);
    headMesh.position.y = hh / 2;
    this.head.add(headMesh);
    this.mats.face = faceMat;
    this.buildHair(spec, hw, hh, hd, S);
    if (spec.sweatband) {
      const band = box(hw + 0.035, 0.05 * S, hd + 0.035, L(spec.sweatband));
      band.position.y = hh * 0.82;
      this.head.add(band);
    }

    // arms
    const armLen = 0.31 * S, foreLen = 0.28 * S;
    const shX = tw / 2 + 0.055 * S, shY = th + 0.0 * S;
    const mkArm = (side) => {
      const sh = limb(m.jacket, 0.07 * S * (spec.girth ? W * 0.95 : 1), 0.062 * S, armLen);
      sh.position.set(side * shX, shY, 0);
      const el = limb(m.jacket, 0.06 * S, 0.052 * S, foreLen);
      el.position.y = -armLen;
      sh.add(el);
      const hand = box(0.075 * S, 0.1 * S, 0.085 * S, m.skin);
      hand.position.y = -foreLen - 0.04 * S;
      el.add(hand);
      const handPivot = new THREE.Group();
      handPivot.position.y = -foreLen - 0.04 * S;
      el.add(handPivot);
      this.torso.add(sh);
      return { sh, el, hand: handPivot };
    };
    const aL = mkArm(1), aR = mkArm(-1);
    this.armL = aL.sh; this.elL = aL.el; this.armR = aR.sh; this.elR = aR.el;
    this.handR = aR.hand; this.handL = aL.hand;

    // gun (barrel points along -Y of the forearm so it follows the arm)
    this.gun = new THREE.Group();
    this.muzzle = new THREE.Object3D();
    if (spec.gun) this.buildGun(spec.gun, S);
    this.handR.add(this.gun);

    this.shadow = blobShadow(0.9 * S, 0.9 * S);
    this.root.add(this.shadow);

    this.cur = { armL: [0, 0, 0.12], armR: [0, 0, -0.12], elL: -0.2, elR: -0.2, legL: 0, legR: 0, torso: [0, 0, 0] };
  }

  buildHair(spec, hw, hh, hd, S) {
    const hm = this.mats.hair;
    const add = (w, h, d, x, y, z, mat = hm) => { const b = box(w, h, d, mat); b.position.set(x, y, z); this.head.add(b); return b; };
    switch (spec.hairStyle) {
      case 'mullet':
        add(hw + 0.03, 0.07 * S, hd + 0.02, 0, hh + 0.02 * S, -0.005);
        add(hw + 0.02, 0.38 * S, 0.07 * S, 0, hh * 0.35, -hd / 2 - 0.025 * S);
        add(0.03, 0.14 * S, hd * 0.7, hw / 2 + 0.012, hh * 0.72, -0.03 * S);
        add(0.03, 0.14 * S, hd * 0.7, -hw / 2 - 0.012, hh * 0.72, -0.03 * S);
        break;
      case 'feathered':
        add(hw + 0.12 * S, 0.13 * S, hd + 0.08 * S, 0, hh + 0.04 * S, -0.02 * S);
        add(hw + 0.14 * S, 0.44 * S, 0.14 * S, 0, hh * 0.45, -hd / 2 - 0.04 * S);
        add(0.07 * S, 0.36 * S, hd * 0.85, hw / 2 + 0.045 * S, hh * 0.5, -0.03 * S);
        add(0.07 * S, 0.36 * S, hd * 0.85, -hw / 2 - 0.045 * S, hh * 0.5, -0.03 * S);
        add(hw + 0.06 * S, 0.06 * S, 0.05 * S, 0, hh - 0.01 * S, hd / 2 + 0.01 * S);
        break;
      case 'bald':
        add(hw + 0.02, 0.08 * S, hd * 0.5, 0, hh * 0.5, -hd * 0.27);
        add(0.025, 0.08 * S, hd * 0.6, hw / 2 + 0.01, hh * 0.5, -0.02);
        add(0.025, 0.08 * S, hd * 0.6, -hw / 2 - 0.01, hh * 0.5, -0.02);
        break;
      case 'pompadour':
        add(hw + 0.02, 0.17 * S, hd + 0.04 * S, 0, hh + 0.07 * S, 0.03 * S);
        add(hw + 0.02, 0.24 * S, 0.05 * S, 0, hh * 0.62, -hd / 2 - 0.02);
        add(0.03, 0.12 * S, 0.05 * S, hw / 2 + 0.01, hh * 0.45, 0.06 * S);
        add(0.03, 0.12 * S, 0.05 * S, -hw / 2 - 0.01, hh * 0.45, 0.06 * S);
        break;
      case 'slick':
        add(hw + 0.02, 0.05 * S, hd + 0.02, 0, hh + 0.01, -0.01);
        add(hw + 0.02, 0.14 * S, 0.04 * S, 0, hh * 0.72, -hd / 2 - 0.015);
        break;
      case 'buzz':
        add(hw + 0.01, 0.03 * S, hd + 0.01, 0, hh + 0.005, 0);
        break;
      case 'headband': {
        add(hw + 0.04, 0.08 * S, hd + 0.04, 0, hh + 0.03 * S, -0.01);
        add(hw + 0.03, 0.04 * S, hd + 0.03, 0, hh * 0.86, 0, M(0xff3333));
        add(hw + 0.03, 0.25 * S, 0.05 * S, 0, hh * 0.55, -hd / 2 - 0.02);
        break;
      }
      case 'cap': {
        const cm = M(spec.capColor ?? 0x2255aa);
        add(hw + 0.03, 0.09 * S, hd + 0.03, 0, hh + 0.03 * S, 0, cm);
        add(hw + 0.02, 0.02, 0.13 * S, 0, hh + 0.0, hd / 2 + 0.06 * S, cm);
        break;
      }
    }
  }

  buildGun(kind, S) {
    const steel = kind === 'magnum' ? M(0xd6d9de, { emissive: 0x222428 }) : kind === 'gold' ? M(0xffc533, { emissive: 0x553a00 }) : M(0x1c1c20);
    const grip = M(kind === 'magnum' ? 0x5a3418 : 0x111111);
    const len = kind === 'magnum' ? 0.34 : 0.2;
    const g = this.gun;
    const handle = box(0.035, 0.05, 0.1, grip); handle.position.set(0, 0.0, 0.0); g.add(handle);
    const frame = box(0.045, 0.1, 0.07, steel); frame.position.set(0, -0.06, 0.04); g.add(frame);
    const barrel = box(0.032, len, 0.035, steel); barrel.position.set(0, -0.08 - len / 2, 0.055); g.add(barrel);
    if (kind === 'magnum') { const cyl6 = cyl(0.03, 0.03, 0.06, 6, steel); cyl6.position.set(0, -0.08, 0.055); g.add(cyl6); }
    this.muzzle.position.set(0, -0.1 - len, 0.055);
    g.add(this.muzzle);
    g.scale.setScalar(S);
  }

  flash() { this.flashT = 0.16; }

  /**
   * st: { speed 0..1, pose, aim, talk, lookYaw }
   */
  update(dt, st = {}) {
    this.t += dt;
    const poseName = st.pose || (st.aim ? 'aim' : 'idle');
    const P = POSES[poseName] || POSES.idle;
    const sp = st.speed ?? 0;
    if (sp > 0.02) this.phase += dt * (6 + sp * 5);
    const swingAmt = Math.min(1, sp * 1.4);
    const sw = Math.sin(this.phase) * 0.7 * swingAmt;
    const k = 1 - Math.exp(-16 * dt);
    const c = this.cur;
    const tgt = (arr, add = [0, 0, 0]) => [arr[0] + add[0], arr[1] + add[1], arr[2] + add[2]];
    let aL = P.armL, aR = P.armR;
    if (P.swing) { aL = tgt(P.armL, [-sw * 0.8, 0, 0]); aR = tgt(P.armR, [sw * 0.8, 0, 0]); }
    if (poseName === 'aim1') aL = tgt(P.armL, [-sw * 0.8, 0, 0]);
    if (P.flail) {
      const f = Math.sin(this.t * 22);
      aL = tgt(P.armL, [f * 0.8, 0, 0.3 * f]); aR = tgt(P.armR, [-f * 0.8, 0, -0.3 * f]);
    }
    for (let i = 0; i < 3; i++) {
      c.armL[i] += (aL[i] - c.armL[i]) * k;
      c.armR[i] += (aR[i] - c.armR[i]) * k;
      c.torso[i] += ((P.torso ? P.torso[i] : 0) - c.torso[i]) * k;
    }
    c.elL += (P.elL - c.elL) * k;
    c.elR += (P.elR - c.elR) * k;
    const legBase = P === POSES.dive || P === POSES.diveAim || P === POSES.lie;
    c.legL += ((P.legL ?? 0) + (legBase ? 0 : sw) - c.legL) * k;
    c.legR += ((P.legR ?? 0) - (legBase ? 0 : sw) - c.legR) * k;
    this.armL.rotation.set(c.armL[0], c.armL[1], c.armL[2]);
    this.armR.rotation.set(c.armR[0], c.armR[1], c.armR[2]);
    this.elL.rotation.x = c.elL;
    this.elR.rotation.x = c.elR;
    this.legL.rotation.x = c.legL;
    this.legR.rotation.x = c.legR;
    this.torso.rotation.set(c.torso[0], c.torso[1], c.torso[2]);
    if (!st.noBob) this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.05 * swingAmt;
    this.head.rotation.x = st.talk ? Math.sin(this.t * 10) * 0.07 : Math.sin(this.t * 1.3) * 0.015;
    this.head.rotation.y += ((st.lookYaw ?? 0) - this.head.rotation.y) * k;
    if (this.flashT > 0 || this._flashing) {
      this.flashT -= dt;
      const on = this.flashT > 0;
      const e = on ? 0x881111 : 0x000000;
      for (const key of ['jacket', 'pants', 'skin', 'shirt']) this.mats[key].emissive.setHex(e);
      this._flashing = on;
    }
  }
}

// ------------------------------------------------------------------ cars
function extrudeProfile(pts, width, mats) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2, 0, 0);
  return new THREE.Mesh(g, mats);
}
function profileTex(map, minX, maxX, minY, maxY) {
  const t = map.clone();
  t.repeat.set(1 / (maxX - minX), 1 / (maxY - minY));
  t.offset.set(-minX / (maxX - minX), -minY / (maxY - minY));
  t.needsUpdate = true;
  return t;
}
function windowTex(key, pts, minX, maxX, minY, maxY, paint, glassColor = '#1d2b40', pillars = [0.5]) {
  return carSideTex(key, (x, w, h) => {
    x.fillStyle = paint; x.fillRect(0, 0, w, h);
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    x.fillStyle = glassColor;
    x.beginPath();
    pts.forEach((p, i) => {
      const px = ((cx + (p[0] - cx) * 0.86 - minX) / (maxX - minX)) * w;
      const py = h - ((cy + (p[1] - cy) * 0.78 - minY) / (maxY - minY)) * h;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    });
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(w * 0.15, h * 0.3, w * 0.2, 2);
    x.fillStyle = paint;
    for (const p of pillars) x.fillRect(w * p - 4, 0, 8, h);
  });
}
function wheel(r = 0.36, w = 0.26, hubcapColor = 0xd8d8d8) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const tire = new THREE.Mesh(G(`tire${r},${w}`, () => new THREE.CylinderGeometry(r, r, w, 10).rotateZ(Math.PI / 2)), M(0x141414));
  spin.add(tire);
  const hub = new THREE.Mesh(G(`hub${r}`, () => new THREE.CylinderGeometry(r * 0.68, r * 0.68, 0.04, 8).rotateZ(Math.PI / 2)), M(hubcapColor, { emissive: 0x202020 }));
  spin.add(hub);
  const spoke = box(0.045, r * 1.2, 0.08, M(0x777777));
  spin.add(spoke);
  return { g, spin, hub, spoke, w };
}

export function makeBrougham() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paintHex = '#6e4a2a';
  const paint = M(0x6e4a2a);
  const chrome = M(0xd0d0d0, { emissive: 0x2a2a2a });
  const vinyl = M(0x3a2616);
  const glass = M(0x1d2b40, { emissive: 0x060c18 });
  const lower = [[-2.6, 0.32], [-2.6, 0.86], [-2.45, 0.98], [-1.35, 1.0], [1.2, 0.98], [2.5, 0.93], [2.62, 0.8], [2.62, 0.32]];
  const sideT = carSideTex('broughamSide', (x, w, h) => {
    x.fillStyle = paintHex; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.fillStyle = '#c9c9c9'; x.fillRect(0, h * 0.42, w, 2);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(w * 0.39, h * 0.05, 1, h * 0.9); x.fillRect(w * 0.62, h * 0.05, 1, h * 0.9);
    x.fillStyle = '#7a4a22';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(Math.random() * w, h * (0.6 + Math.random() * 0.35), 5 + Math.random() * 6, 3, 0, 0, 7); x.fill(); }
    x.fillStyle = '#111';
    for (const u of [0.19, 0.81]) { x.beginPath(); x.ellipse(u * w, h * 1.02, w * 0.085, h * 0.62, 0, Math.PI, 0); x.fill(); }
  });
  const sideMat = new THREE.MeshLambertMaterial({ map: profileTex(sideT, -2.62, 2.62, 0.3, 1.02) });
  const lowerMesh = extrudeProfile(lower, 2.0, [sideMat, paint]);
  body.add(lowerMesh);
  const cab = [[-1.45, 0.99], [-1.0, 1.48], [0.55, 1.5], [1.22, 0.99]];
  const cabT = windowTex('broughamCab', cab, -1.45, 1.22, 0.98, 1.5, paintHex, '#1d2b40', [0.56]);
  const cabMat = new THREE.MeshLambertMaterial({ map: profileTex(cabT, -1.45, 1.22, 0.98, 1.5) });
  const cabin = extrudeProfile(cab, 1.82, [cabMat, glass]);
  body.add(cabin);
  const roof = box(1.86, 0.05, 1.6, vinyl);
  roof.position.set(0, 1.51, -0.22);
  body.add(roof);
  const bumperF = box(2.1, 0.18, 0.18, chrome); bumperF.position.set(0, 0.46, 2.68); body.add(bumperF);
  const bumperR = box(2.1, 0.18, 0.18, chrome); bumperR.position.set(0, 0.46, -2.68); body.add(bumperR);
  const grille = box(1.2, 0.28, 0.05, M(0x2a2a2a)); grille.position.set(0, 0.68, 2.635); body.add(grille);
  for (const sx of [-1, 1]) {
    const hl = box(0.3, 0.2, 0.05, B(0xfff1c2)); hl.position.set(sx * 0.78, 0.7, 2.64); body.add(hl);
    const tl = box(0.4, 0.16, 0.05, B(0xb01010)); tl.position.set(sx * 0.72, 0.74, -2.63); body.add(tl);
  }
  // hood & trunk on hinges
  const hood = new THREE.Group(); hood.position.set(0, 0.985, 1.22);
  const hoodP = box(1.92, 0.04, 1.32, paint); hoodP.position.set(0, 0, 0.66); hood.add(hoodP);
  body.add(hood);
  const trunk = new THREE.Group(); trunk.position.set(0, 1.0, -1.36);
  const trunkP = box(1.92, 0.04, 1.12, paint); trunkP.position.set(0, 0, -0.56); trunk.add(trunkP);
  body.add(trunk);
  // the passenger door: mismatched primer, held on with duct tape
  const door = new THREE.Group(); door.position.set(-1.01, 0.66, 0.05);
  const doorP = box(0.04, 0.56, 1.18, M(0x8b9089)); door.add(doorP);
  const tape = box(0.05, 0.07, 0.34, M(0xb8b8b0)); tape.position.set(-0.005, 0.12, 0.55); door.add(tape);
  const tape2 = box(0.05, 0.07, 0.34, M(0xb8b8b0)); tape2.position.set(-0.005, -0.12, 0.58); door.add(tape2);
  body.add(door);
  const mirror = box(0.12, 0.1, 0.06, chrome); mirror.position.set(1.08, 1.08, 0.95); body.add(mirror);
  const antenna = box(0.015, 0.8, 0.015, chrome); antenna.position.set(0.85, 1.35, 2.0); antenna.rotation.x = -0.25; body.add(antenna);
  // wheels
  const wheels = [];
  for (const [x, z] of [[0.9, 1.62], [-0.9, 1.62], [0.9, -1.62], [-0.9, -1.62]]) {
    const w = wheel(0.36, 0.26);
    w.g.position.set(x, 0.36, z);
    w.hub.position.x = Math.sign(x) * 0.135;
    body.add(w.g);
    wheels.push(w);
  }
  const shadow = blobShadow(2.6, 6);
  root.add(shadow);
  return { root, body, wheels, hood, trunk, door, bumperF, bumperR, mirror, antenna };
}

export function makeSportsCar(color = 0xf4f2ea, stripe = '#d42020') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = M(color);
  const glass = M(0x111822, { emissive: 0x05080c });
  const lower = [[-2.25, 0.3], [-2.25, 0.84], [-1.2, 0.92], [1.0, 0.86], [2.3, 0.58], [2.36, 0.42], [2.3, 0.3]];
  const sideT = carSideTex('sportSide' + color, (x, w, h) => {
    x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fillRect(0, 0, w, h);
    x.fillStyle = stripe; x.fillRect(0, h * 0.38, w, h * 0.1);
    x.fillStyle = '#ffd23f'; x.fillRect(0, h * 0.5, w, h * 0.04);
    x.fillStyle = '#111';
    for (const u of [0.2, 0.8]) { x.beginPath(); x.ellipse(u * w, h * 1.02, w * 0.08, h * 0.7, 0, Math.PI, 0); x.fill(); }
  });
  const sideMat = new THREE.MeshLambertMaterial({ map: profileTex(sideT, -2.36, 2.36, 0.28, 0.95) });
  body.add(extrudeProfile(lower, 1.96, [sideMat, paint]));
  const cab = [[-1.35, 0.9], [-0.6, 1.24], [0.15, 1.24], [1.05, 0.86]];
  const cabT = windowTex('sportCab' + color, cab, -1.35, 1.05, 0.86, 1.24, '#' + color.toString(16).padStart(6, '0'), '#111822', []);
  body.add(extrudeProfile(cab, 1.6, [new THREE.MeshLambertMaterial({ map: profileTex(cabT, -1.35, 1.05, 0.86, 1.24) }), glass]));
  const spoiler = box(1.9, 0.05, 0.35, paint); spoiler.position.set(0, 1.18, -2.05); body.add(spoiler);
  for (const sx of [-0.7, 0.7]) { const p = box(0.06, 0.28, 0.06, paint); p.position.set(sx, 1.0, -2.05); body.add(p); }
  for (const sx of [-1, 1]) {
    const tl = box(0.6, 0.12, 0.05, B(0xe01818)); tl.position.set(sx * 0.6, 0.7, -2.26); body.add(tl);
    const hl = box(0.4, 0.08, 0.05, B(0xfff6d0)); hl.position.set(sx * 0.62, 0.5, 2.34); body.add(hl);
  }
  const wheels = [];
  for (const [x, z] of [[0.9, 1.45], [-0.9, 1.45], [0.92, -1.45], [-0.92, -1.45]]) {
    const w = wheel(0.34, 0.3, 0xffcc33);
    w.g.position.set(x, 0.34, z);
    w.hub.position.x = Math.sign(x) * 0.155;
    body.add(w.g);
    wheels.push(w);
  }
  root.add(blobShadow(2.6, 5.4));
  return { root, body, wheels };
}

export function makeWagon(color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = M(color);
  const lowerB = box(1.9, 0.62, 5.0, paint); lowerB.position.y = 0.62; body.add(lowerB);
  for (const sx of [-1, 1]) {
    const wood = box(0.02, 0.36, 4.2, texMat('panel', 6, 1)); wood.position.set(sx * 0.96, 0.66, -0.1); body.add(wood);
  }
  const cab = box(1.78, 0.56, 3.2, M(0x1d2b40, { emissive: 0x060c18 })); cab.position.set(0, 1.2, -0.5); body.add(cab);
  const roof = box(1.82, 0.06, 3.3, paint); roof.position.set(0, 1.5, -0.5); body.add(roof);
  const rack = box(1.5, 0.05, 2.4, M(0x888888)); rack.position.set(0, 1.58, -0.6); body.add(rack);
  for (const sx of [-1, 1]) { const tl = box(0.3, 0.14, 0.04, B(0xb01010)); tl.position.set(sx * 0.7, 0.7, -2.52); body.add(tl); }
  const wheels = [];
  for (const [x, z] of [[0.88, 1.6], [-0.88, 1.6], [0.88, -1.6], [-0.88, -1.6]]) {
    const w = wheel(0.34, 0.24);
    w.g.position.set(x, 0.34, z);
    w.hub.position.x = Math.sign(x) * 0.125;
    body.add(w.g);
    wheels.push(w);
  }
  root.add(blobShadow(2.5, 5.6));
  return { root, body, wheels };
}

// ------------------------------------------------------------------ props
export function crate(w, h, d) {
  const t = Math.max(1, Math.round(w / 1.2)), u = Math.max(1, Math.round(h / 1.2));
  const m = box(w, h, d, texMat('crate', t, u));
  m.position.y = h / 2;
  return m;
}
export function barrel() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(G('barrel', () => new THREE.CylinderGeometry(0.42, 0.42, 1.15, 10)), [new THREE.MeshLambertMaterial({ map: tex('barrel') }), M(0x8a1a14), M(0x8a1a14)]);
  b.position.y = 0.575;
  g.add(b);
  g.add(blobShadow(1.1, 1.1));
  return g;
}
export function cardboardStack() {
  const g = new THREE.Group();
  const m = texMat('cardboard');
  const sizes = [[1.0, 0.8, 0.9, 0, 0.4, 0, 0.1], [0.9, 0.7, 0.8, 0.05, 1.15, 0.05, -0.2], [0.7, 0.55, 0.6, -0.05, 1.77, 0, 0.3]];
  for (const [w, h, d, x, y, z, r] of sizes) { const b = box(w, h, d, m); b.position.set(x, y, z); b.rotation.y = r; g.add(b); }
  return g;
}
export function shoppingCart() {
  const g = new THREE.Group();
  const wire = new THREE.MeshLambertMaterial({ map: tex('fence'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xcccccc });
  const basket = box(0.6, 0.5, 0.9, wire); basket.position.y = 0.75; g.add(basket);
  const frame = M(0x999999);
  const handle = box(0.62, 0.04, 0.04, M(0xc02020)); handle.position.set(0, 1.05, -0.5); g.add(handle);
  for (const [x, z] of [[0.25, 0.4], [-0.25, 0.4], [0.25, -0.4], [-0.25, -0.4]]) { const l = box(0.03, 0.5, 0.03, frame); l.position.set(x, 0.25, z); g.add(l); }
  g.rotation.y = rand(-1, 1);
  return g;
}
export function fruitCart() {
  const g = new THREE.Group();
  const base = box(2.0, 0.6, 1.1, texMat('wood')); base.position.y = 0.75; g.add(base);
  const fruits = [];
  const fg = G('fruit', () => new THREE.IcosahedronGeometry(0.13, 0));
  for (let i = 0; i < 26; i++) {
    const f = new THREE.Mesh(fg, M(pick([0xff8a1a, 0xd61f1f, 0xffe03a, 0x6acb2a])));
    f.position.set(rand(-0.85, 0.85), 1.12 + rand(0, 0.12), rand(-0.42, 0.42));
    g.add(f); fruits.push(f);
  }
  const pole = box(0.05, 1.6, 0.05, M(0x777777)); pole.position.y = 1.8; g.add(pole);
  const umb = new THREE.Mesh(G('umb', () => new THREE.ConeGeometry(1.3, 0.5, 8, 1, true)), M(0xff3fa4, { side: THREE.DoubleSide }));
  umb.position.y = 2.65; g.add(umb);
  for (const sx of [-0.8, 0.8]) { const w = cyl(0.25, 0.25, 0.08, 8, M(0x333333)); w.rotation.x = Math.PI / 2; w.rotation.z = Math.PI / 2; w.position.set(sx, 0.25, 0.58); g.add(w); }
  return { g, fruits, umb };
}
export function tireStack() {
  const g = new THREE.Group();
  const tg = G('tireT', () => new THREE.TorusGeometry(0.38, 0.15, 6, 10).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(tg, M(0x161616)); t.position.y = 0.15 + i * 0.29; t.position.x = rand(-0.05, 0.05); g.add(t); }
  return g;
}
export function donut() {
  const g = new THREE.Group();
  const dough = new THREE.Mesh(G('dough', () => new THREE.TorusGeometry(0.2, 0.09, 6, 12).rotateX(Math.PI / 2)), M(0xd99a4a));
  const icing = new THREE.Mesh(G('icing', () => new THREE.TorusGeometry(0.2, 0.08, 6, 12).rotateX(Math.PI / 2)), M(0xff7ac0, { emissive: 0x331022 }));
  icing.position.y = 0.035; icing.scale.set(1.02, 0.7, 1.02);
  g.add(dough, icing);
  return g;
}
export function discoBall(r = 0.8) {
  return new THREE.Mesh(
    G('disco' + r, () => new THREE.IcosahedronGeometry(r, 1)),
    new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0x555555, flatShading: true }),
  );
}
export function glassPane() {
  return new THREE.Mesh(
    G('pane', () => new THREE.PlaneGeometry(3.0, 1.8)),
    new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
}
