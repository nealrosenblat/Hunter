// Episode 2: undercover at the Vigor Body Temple's 9 PM Power Hour.
// A rhythm game: hit LEFT / DOWN / UP / RIGHT as the arrows reach the top row, in time with the
// workout tape. Miss too many and Rick Vigor gets suspicious (COVER BLOWN).
import * as THREE from 'three';
import { Scene } from '../scene.js';
import { Rig, SPECS, gymGoonSpec, M, B, box, cyl, texMat } from '../models.js';
import { tex } from '../textures.js';
import { makeSign } from '../env.js';
import { clamp, rand, pick } from '../util.js';

const BPM = 120;
const BEAT = 60 / BPM;
const DIRS = ['left', 'down', 'up', 'right'];
const LEAD = 2.0; // seconds an arrow takes to travel up the lane
const PERFECT = 0.09;
const GOOD = 0.19;
const END_BEAT = 180; // ~90 seconds of song

// Poses for a dancer facing the class (Candi): her left is the screen's left.
const POSE_BACK = { left: 'aeroLeft', right: 'aeroRight', up: 'aeroUp', down: 'aeroDown' };
// Dancers facing the camera are mirrored, so "left on screen" is their right.
const POSE_FRONT = { left: 'aeroRight', right: 'aeroLeft', up: 'aeroUp', down: 'aeroDown' };

const KEYS = {
  wasd: { left: ['KeyA'], down: ['KeyS'], up: ['KeyW'], right: ['KeyD'] },
  arrows: { left: ['ArrowLeft'], down: ['ArrowDown'], up: ['ArrowUp'], right: ['ArrowRight'] },
  both: { left: ['KeyA', 'ArrowLeft'], down: ['KeyS', 'ArrowDown'], up: ['KeyW', 'ArrowUp'], right: ['KeyD', 'ArrowRight'] },
};
// d-pad (14 left, 13 down, 12 up, 15 right) and face buttons (X left, A down, Y up, B right)
const PAD_BTNS = { left: [14, 2], down: [13, 0], up: [12, 3], right: [15, 1] };

const PRAISE = ['PERFECT!', 'FEEL THE BURN!', 'TOTALLY TUBULAR!', 'RADICAL!', 'FEEL THE VIGOR!', 'BODACIOUS!'];
const OKAY = ['GOOD!', 'NICE!', 'KEEP IT UP!', 'OKAY!'];
const OOPS = ['MISS', 'WHOOPS', 'OUCH', 'OFF BEAT', 'SUSPICIOUS...'];
const HAMMER_QUIPS = ['My hamstrings are filing a complaint.', 'Is it supposed to hurt THIS much?', 'Nobody told me there\'d be a pop quiz.', 'I think I pulled my mullet.'];

const GRADE_TEXT = {
  A: 'Candi wants you to teach the 6 AM class.',
  B: 'Candi says you have real potential.',
  C: 'Candi says you have... enthusiasm.',
  D: 'Candi has suggested the beginner class.',
  F: 'Candi is praying for you.',
};

/** The routine: beats + moves, getting busier as the tape goes on. Deterministic. */
function makeChart() {
  let seed = 1977;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const PATS = [
    ['left', 'right', 'left', 'right'], ['up', 'down', 'up', 'down'], ['left', 'up', 'right', 'down'],
    ['right', 'up', 'left', 'down'], ['left', 'left', 'right', 'right'], ['up', 'up', 'down', 'down'],
    ['down', 'left', 'down', 'right'], ['up', 'left', 'up', 'right'],
  ];
  const notes = [];
  const add = (beat, dir) => notes.push({ beat, dir });
  const pat = () => PATS[Math.floor(r() * PATS.length)];
  // warm-up: every 2 beats
  for (let b = 8; b < 40; b += 8) { const p = pat(); p.forEach((d, i) => add(b + i * 2, d)); }
  // every beat
  for (let b = 40; b < 88; b += 4) { const p = pat(); p.forEach((d, i) => add(b + i, d)); }
  // every beat, with a quick double every other bar
  for (let b = 88; b < 136; b += 4) {
    const p = pat();
    p.forEach((d, i) => add(b + i, d));
    if ((b / 4) % 2 === 0) add(b + 2.5, p[2] === 'up' ? 'down' : 'up');
  }
  // big finish
  for (let b = 136; b < 172; b += 4) {
    const p = pat();
    p.forEach((d, i) => add(b + i, d));
    if ((b / 4) % 3 === 0) add(b + 1.5, p[1]);
  }
  for (const [b, d] of [[172, 'left'], [173, 'right'], [174, 'left'], [175, 'right'], [176, 'up']]) add(b, d);
  notes.sort((a, b) => a.beat - b.beat);
  return notes.map((n) => ({ ...n, t: n.beat * BEAT }));
}

// Mid-song lines, by beat (non-blocking subtitles)
const LINES = [
  [4, 'candi', 'And FIVE, SIX, SEVEN, EIGHT!'],
  [26, 'candi', 'Reach for the STARS, people!'],
  [40, 'vigor', 'FEEL THE VIGOR!', 'vigor'],
  [54, 'delgado', "Rex. He's only wearing ONE leg warmer."],
  [59, 'hammer', "Maybe he's a trendsetter."],
  [64, 'delgado', "Or the other one's in the evidence locker."],
  [80, 'hammer', null, 'hammer'],
  [100, 'candi', "Grapevine! ...No. Nobody can do the grapevine. Keep going!"],
  [120, 'vigor', 'No pain, no gain!', 'vigor'],
  [136, 'hammer', null],
  [152, 'candi', 'Big finish! Give me VIGOR!'],
  [166, 'vigor', 'Vigor never quits!', 'vigor'],
];

const SHOTS = {
  main: [[0, 3.35, -4.9], [0, 1.15, 4.2]],
  candi: [[0.25, 1.7, 1.05], [0, 1.6, -1.2]],
  vigor: [[0.7, 2.75, 6.7], [0, 2.45, 10.4]],
};
// close-ups relative to a character: [camera offset, look offset]
const REL = {
  delgado: ['del', [0.25, 1.62, -1.65], [0, 1.5, 0]],
  hammer: ['ham', [-0.25, 1.78, -2.1], [0, 1.65, 0]],
  gerald: ['ham', [-0.25, 1.85, -2.7], [0, 0.75, 0.2]],
};

export class AerobicsScene extends Scene {
  enter() {
    const g = this.game;
    this.pausable = true;
    this.phase = 'intro';
    this.songT = -1;
    this.anchor = null;
    this.wasPaused = false;
    this.sus = 0;
    this.lineIdx = 0;
    this.quipIdx = 0;
    this.susWarned = false;
    this.touchQ = [];
    this.stickPrev = new Map();
    this.cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.shotUntil = 0;
    this.camera.fov = 55;
    this.build();
    this.spawn();
    this.setShot('main');
    this.buildHud();
    g.audio.stopMusic(0.4);
    this.run(() => this.intro());
  }

  touchMode() { return null; }

  // ------------------------------------------------------------------ set
  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x1a0f28);
    s.fog = new THREE.Fog(0x1a0f28, 14, 30);
    s.add(new THREE.HemisphereLight(0xfff0f6, 0x4a2a3a, 1.55));
    const key = new THREE.DirectionalLight(0xffe8d0, 0.7);
    key.position.set(-3, 8, -6);
    s.add(key);
    const pink = new THREE.PointLight(0xff3fa4, 9, 16, 1.5); pink.position.set(-4, 3.4, 4); s.add(pink);
    const teal = new THREE.PointLight(0x3ef2ff, 7, 16, 1.5); teal.position.set(4, 3.4, 7); s.add(teal);
    this.discoLights = [pink, teal];
    const W = 12, D = 18, H = 4.4, Z0 = -5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), texMat('studioFloor', 4, 6));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, Z0 + D / 2); s.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(0x2a2236));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, Z0 + D / 2); s.add(ceil);
    for (let z = -2; z < 12; z += 4) { const strip = box(6, 0.05, 0.4, B(0xfff4e8)); strip.position.set(0, H - 0.03, z); s.add(strip); }
    // mirrored side walls with a barre
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(D, H), texMat('mirror', D / 3, 1));
      m.position.set(sx * W / 2, H / 2, Z0 + D / 2); m.rotation.y = -sx * Math.PI / 2; s.add(m);
      const barre = cyl(0.04, 0.04, D - 1, 6, M(0xd8d8e0)); barre.rotation.x = Math.PI / 2; barre.position.set(sx * (W / 2 - 0.25), 1.05, Z0 + D / 2); s.add(barre);
      for (const [y, c] of [[3.6, 0xff3fa4], [3.8, 0x3ef2ff]]) { const n = box(0.04, 0.06, D, B(c)); n.position.set(sx * (W / 2 - 0.03), y, Z0 + D / 2); s.add(n); }
    }
    // back wall: Vigor's platform + office window + neon
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), M(0x3a2a4a));
    back.position.set(0, H / 2, Z0 + D); back.rotation.y = Math.PI; s.add(back);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), M(0x3a2a4a));
    front.position.set(0, H / 2, Z0); s.add(front);
    const plat = box(5.2, 0.9, 2.4, M(0x2a2a3a)); plat.position.set(0, 0.45, 10.6); s.add(plat);
    const edge = box(5.2, 0.05, 0.06, B(0xff3fa4)); edge.position.set(0, 0.9, 9.42); s.add(edge);
    for (const sx of [-2.5, -1.25, 0, 1.25, 2.5]) { const p = cyl(0.03, 0.03, 0.9, 5, M(0xd0d0d8)); p.position.set(sx, 1.35, 9.5); s.add(p); }
    const rail = cyl(0.03, 0.03, 5.1, 5, M(0xd0d0d8)); rail.rotation.z = Math.PI / 2; rail.position.set(0, 1.8, 9.5); s.add(rail);
    for (let i = 0; i < 4; i++) { const st = box(1.0, 0.22 * (i + 1), 0.3, M(0x2a2a3a)); st.position.set(3.2, 0.11 * (i + 1), 9.6 + i * 0.3); s.add(st); }
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ map: tex('blinds') }));
    win.position.set(0, 2.6, Z0 + D - 0.03); win.rotation.y = Math.PI; s.add(win);
    const sign = makeSign('FEEL THE VIGOR', { w: 5, h: 0.8, bg: '#14062a', fg: '#ff3fa4', glow: '#ff3fa4', font: 'bold 34px sans-serif' });
    sign.position.set(0, 3.75, Z0 + D - 0.04); sign.rotation.y = Math.PI; s.add(sign);
    const sign2 = makeSign('VIGOR BODY TEMPLE', { w: 3.4, h: 0.5, bg: '#082a2a', fg: '#3ef2ff', glow: '#3ef2ff', font: 'bold 30px sans-serif' });
    sign2.position.set(-W / 2 + 0.05, 3.0, 8); sign2.rotation.y = Math.PI / 2; s.add(sign2);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), new THREE.MeshLambertMaterial({ map: tex('door') }));
    door.position.set(W / 2 - 0.05, 2.0, 10.6); door.rotation.y = -Math.PI / 2; s.add(door);
    const exit = makeSign('EXIT', { w: 0.6, h: 0.22, bg: '#7a0000', fg: '#fff' });
    exit.position.set(W / 2 - 0.06, 3.3, 10.6); exit.rotation.y = -Math.PI / 2; s.add(exit);
    // Candi's riser and the boombox
    const riser = box(2.4, 0.22, 1.6, M(0x14b8b0)); riser.position.set(0, 0.11, -1.3); s.add(riser);
    const bb = new THREE.Group();
    const body = box(0.9, 0.42, 0.25, M(0x222226)); body.position.y = 0.21; bb.add(body);
    for (const sx of [-0.27, 0.27]) { const spk = cyl(0.14, 0.14, 0.03, 10, M(0x777780)); spk.rotation.x = Math.PI / 2; spk.position.set(sx, 0.21, 0.13); bb.add(spk); }
    const handle = box(0.7, 0.04, 0.04, M(0xbbbbbb)); handle.position.y = 0.5; bb.add(handle);
    bb.position.set(-1.6, 0, -1.1); bb.rotation.y = 0.4; s.add(bb);
    // mats, water bottles, a towel
    for (let i = 0; i < 6; i++) { const mat = box(0.7, 0.02, 1.6, M(pick([0x14b8b0, 0xff3fa4, 0x6b2fa3, 0xffd23f]))); mat.position.set(-4.6 + (i % 2) * 0.9, 0.01, 1 + Math.floor(i / 2) * 2.2); s.add(mat); }
    for (const [x, z] of [[4.8, 1.2], [5.0, 1.5], [4.7, 4.2]]) { const b = cyl(0.05, 0.05, 0.22, 6, M(0xe8f4ff)); b.position.set(x, 0.11, z); s.add(b); }
  }

  spawn() {
    const g = this.game, s = this.scene;
    const mk = (spec, x, z, yaw) => {
      const r = new Rig(spec);
      r.root.position.set(x, 0, z);
      r.root.rotation.y = yaw;
      r.gun.visible = false;
      s.add(r.root);
      return r;
    };
    this.candi = mk(SPECS.candi, 0, -1.3, 0);
    this.candi.root.position.y = 0.22;
    this.vigor = mk(SPECS.vigor, 0, 10.4, Math.PI);
    this.vigor.root.position.y = 0.9;
    this.vigorPose = 'cross';
    const two = g.mode === 2;
    // (camera looks down +z, so -x is screen right) keep the cops clear of the arrow lanes
    this.del = mk(SPECS.delgadoGym, two ? -0.75 : -2.6, 2, Math.PI);
    this.ham = mk(SPECS.hammerGym, two ? 0.75 : 1.9, two ? 2 : 6, Math.PI);
    // the class
    const LEOS = [0xff3fa4, 0x14b8b0, 0xffd23f, 0x6b2fa3, 0xff8a3d, 0x3ef2ff];
    const spots = two
      ? [[-4.2, 2], [-2.4, 2.1], [2.4, 2], [4.2, 2.1], [-2.6, 4], [-0.6, 4.1], [1.0, 4], [2.9, 4], [-3.0, 6], [-1.0, 6.1], [1.8, 6], [3.4, 6.2]]
      : [[-4.4, 2.1], [-0.7, 2.2], [1.0, 2], [3.2, 2], [-3.0, 4], [-1.0, 4.1], [0.7, 4], [3.0, 4], [-3.2, 6], [-1.0, 6.1], [3.6, 6.2]];
    this.dancers = spots.map(([x, z], i) => {
      let spec;
      if (i % 3 === 2) spec = gymGoonSpec();
      else {
        const c = pick(LEOS);
        spec = { ...SPECS.candi, scale: rand(0.93, 1.02), skin: pick([0xf0c0a0, 0xc58b62, 0x9a6a48, 0xe0b090]), hair: pick([0x111111, 0xd8502a, 0xf0cf72, 0x4a3020]), shirt: c, pants: pick([c, 0x222244, 0x111111]), legWarmers: pick(LEOS), sweatband: pick(LEOS), face: { ...SPECS.candi.face, lipstick: Math.random() < 0.7 } };
      }
      const r = mk(spec, x, z, Math.PI);
      return { rig: r, lag: rand(0.02, 0.12), pose: 'idle', poseT: 0, faceHam: false };
    });
    // Gerald, hidden for now
    this.gerald = this.makeMagnum();
    this.gerald.visible = false;
    s.add(this.gerald);
    this.geraldFall = null;
    this.vigorRun = false;
    // "that's you" markers over the undercover cops
    this.markers = [];
    for (const [rig, col] of g.mode === 2 ? [[this.ham, 0x3ef2ff], [this.del, 0xff3fa4]] : [[this.del, 0xff3fa4]]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), B(col));
      m.rotation.x = Math.PI;
      m.visible = false;
      s.add(m);
      this.markers.push({ m, rig });
    }
  }

  makeMagnum() {
    const gun = new THREE.Group();
    const steel = M(0x3a3a40), grip = M(0x5a3518);
    const barrel = box(0.05, 0.05, 0.32, steel); barrel.position.set(0, 0.04, 0.16); gun.add(barrel);
    const cylMesh = cyl(0.045, 0.045, 0.09, 8, steel); cylMesh.rotation.x = Math.PI / 2; cylMesh.position.set(0, 0.03, -0.02); gun.add(cylMesh);
    const frame = box(0.05, 0.08, 0.12, steel); frame.position.set(0, 0.02, -0.06); gun.add(frame);
    const g = box(0.05, 0.14, 0.07, grip); g.position.set(0, -0.07, -0.12); g.rotation.x = -0.35; gun.add(g);
    return gun;
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    const g = this.game;
    const two = g.mode === 2;
    const arrow = (d, cls = '') => `<div class="arw arw-${d} ${cls}"></div>`;
    const lane = (pi, name) => `
      <div class="aero-lane ${two ? 'p' + pi : ''}" data-p="${pi}">
        <div class="aero-name">${name}</div>
        <div class="aero-hw">
          ${DIRS.map((d, i) => `<div class="aero-col" style="left:${i * 25}%"></div>`).join('')}
          <div class="aero-tgts">${DIRS.map((d, i) => `<div class="aero-tgt" style="left:${i * 25 + 12.5}%">${arrow(d, 'ghost')}</div>`).join('')}</div>
          <div class="aero-notes"></div>
        </div>
        <div class="aero-judge"></div>
        <div class="aero-combo"></div>
      </div>`;
    g.ui.L.hud.innerHTML = `
      <div class="aero" style="visibility:hidden">
        <div class="aero-sus"><div class="lbl">VIGOR'S SUSPICION</div><div class="bar"><i></i></div></div>
        <div class="aero-prog"><i></i></div>
        ${two ? lane(0, 'P1 · HAMMER') + lane(1, 'P2 · DELGADO') : lane(0, 'DELGADO')}
        <div class="aero-count"></div>
        <div class="aero-pad left">${['left', 'down'].map((d) => `<button class="tc aero-btn" data-d="${d}">${arrow(d)}</button>`).join('')}</div>
        <div class="aero-pad right">${['up', 'right'].map((d) => `<button class="tc aero-btn" data-d="${d}">${arrow(d)}</button>`).join('')}</div>
        <button class="tc aero-pause" aria-label="Pause">❚❚</button>
      </div>`;
    const root = (this.hudRoot = g.ui.L.hud.querySelector('.aero'));
    this.susBar = root.querySelector('.aero-sus i');
    this.susBox = root.querySelector('.aero-sus');
    this.progBar = root.querySelector('.aero-prog i');
    this.countEl = root.querySelector('.aero-count');
    const touch = g.touch.used || matchMedia('(pointer: coarse)').matches;
    root.classList.toggle('touch', touch);
    for (const b of root.querySelectorAll('.aero-btn')) {
      const d = b.dataset.d;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.touchQ.push(d); b.classList.add('down'); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
    root.querySelector('.aero-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (this.phase === 'play') g.pause(); });
    // lanes: P1 is Hammer in co-op, otherwise you are Delgado
    const laneEls = [...root.querySelectorAll('.aero-lane')];
    this.lanes = laneEls.map((el, pi) => ({
      pi, el,
      who: two ? (pi === 0 ? 'hammer' : 'delgado') : 'delgado',
      rig: two ? (pi === 0 ? this.ham : this.del) : this.del,
      notesEl: el.querySelector('.aero-notes'),
      tgts: [...el.querySelectorAll('.aero-tgt')],
      judgeEl: el.querySelector('.aero-judge'),
      comboEl: el.querySelector('.aero-combo'),
      notes: makeChart().map((n) => ({ ...n, done: false, el: null })),
      first: 0, combo: 0, best: 0, perfect: 0, good: 0, miss: 0,
      pose: 'idle', poseT: 0,
    }));
  }

  showHud(on) { this.hudRoot.style.visibility = on ? 'visible' : 'hidden'; }

  // ------------------------------------------------------------------ camera
  setShot(name, hold = 0) {
    if (REL[name]) {
      const [who, po, lo] = REL[name];
      const at = this[who].root.position;
      this.cam.pos.set(at.x + po[0], po[1], at.z + po[2]);
      this.cam.look.set(at.x + lo[0], lo[1], at.z + lo[2]);
    } else {
      const [p, l] = SHOTS[name];
      this.cam.pos.set(...p);
      this.cam.look.set(...l);
    }
    this.shotName = name;
    this.shotUntil = hold ? this.t + hold : 0;
  }

  // ------------------------------------------------------------------ music clock
  /** (Re)start the workout tape so that song-time S lines up with the audio clock. */
  startMusic(S) {
    const a = this.game.audio;
    this.anchor = null;
    if (!a.ctx) return;
    a.stopMusic(0.05);
    a.playSong('aerobics');
    const song = a.song;
    if (!song) return;
    const sd = BEAT / 4;
    const step = Math.max(0, Math.ceil(S / sd - 1e-6));
    song.step = step;
    song.next = a.t + 0.06 + (step * sd - S);
    this.anchor = song.next - step * sd;
  }

  render() {
    const g = this.game;
    const p = g.paused || g.failed;
    if (p !== this.wasPaused) {
      this.wasPaused = p;
      if (this.phase === 'play') {
        if (p) g.audio.stopMusic(0.08);
        else this.startMusic(this.songT);
      }
    }
    super.render();
  }

  // ------------------------------------------------------------------ script
  async line(who, text, shot) {
    if (shot) this.setShot(shot);
    this.talking = who;
    await this.say(who, text);
    this.talking = null;
  }

  async intro() {
    const g = this.game, ui = g.ui;
    ui.letterbox(true);
    await this.cut(async () => {
      await this.w(ui.fade(0, 0.8));
      await this.w(ui.locationCard(['VIGOR BODY TEMPLE · VENICE BEACH', 'THE 9 PM POWER HOUR'], 1.0));
      this.candiPose = 'raise';
      await this.line('candi', 'Welcome to the Power Hour, people! Are we ready to SWEAT?', 'candi');
      this.candiPose = 'hips';
      this.vigorPose = 'raise';
      await this.line('vigor', 'Welcome to the Temple. Leave your weakness at the door.', 'vigor');
      this.vigorPose = 'cross';
      await this.line('vigor', 'And remember... Vigor never quits.', 'vigor');
      if (g.mode === 2) {
        await this.line('delgado', 'Rex. Try to blend in.', 'delgado');
        await this.line('hammer', "I'm wearing a headband, Dee Dee. I AM blending.", 'hammer');
      } else {
        await this.line('delgado', 'Rex, stay in the back row. And try to blend in.', 'delgado');
        await this.line('hammer', "I'm wearing a headband, Dee Dee. I AM blending.", 'hammer');
      }
      await this.line('delgado', 'Is that Gerald in your sweatpants?', 'delgado');
      await this.line('hammer', 'He goes where I go.', 'hammer');
    }, () => ui.fade(0, 0.2));
    this.candiPose = null;
    this.vigorPose = 'cross';
    ui.letterbox(false);
    this.setShot('main');
    this.showHud(true);
    if (g.mode === 2) ui.sub('narrator', 'P1 Hammer: W A S D · P2 Delgado: arrow keys. Hit each arrow as it reaches the top row!', 6);
    else if (g.touch.used) ui.sub('narrator', 'Tap the arrow buttons as the arrows reach the top row. Left thumb ◀ ▼ · right thumb ▲ ▶. Miss too many and Vigor gets suspicious!', 6);
    else ui.sub('narrator', 'Press the arrow keys (or W A S D) as the arrows reach the top row. Miss too many and Vigor gets suspicious!', 6);
    this.songT = 0;
    this.phase = 'play';
    this.startMusic(0);
  }

  async outro() {
    const g = this.game, ui = g.ui, s = g.stats;
    this.phase = 'outro';
    // case-file stats
    let p = 0, gd = 0, m = 0, best = 0, total = 0;
    for (const L of this.lanes) { p += L.perfect; gd += L.good; m += L.miss; best = Math.max(best, L.best); total += L.notes.length; }
    const acc = total ? (p + gd * 0.6) / total : 0;
    const letter = acc >= 0.9 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : acc >= 0.45 ? 'D' : 'F';
    s.danceHits = p + gd; s.danceMisses = m; s.danceBest = best; s.danceGrade = letter;
    this.showHud(false);
    ui.sub('candi', 'And... COOL DOWN! Beautiful, people!', 2.5);
    let wfmDone = false;
    await this.cut(async () => {
      await this.wait(1.0);
      await this.w(ui.centerCard(`CLASS GRADE: ${letter}`, `"${GRADE_TEXT[letter]}"`, 2.6));
      ui.letterbox(true);
      // the moment of truth
      const two = g.mode === 2;
      this.setShot('gerald');
      this.hamPose = 'aeroUp';
      await this.wait(0.5);
      this.dropGerald();
      g.audio.sfx('clang', 0.9);
      await this.wait(0.25);
      g.audio.stopMusic(0.05);
      g.audio.sfx('scratch');
      g.audio.sfx('clang', 0.5);
      for (const d of this.dancers) d.faceHam = true;
      this.candiPose = 'idle';
      await this.wait(0.9);
      g.audio.sfx('gasp', 0.8);
      this.vigorPose = 'point';
      await this.line('vigor', '...Is that a .44 MAGNUM in your sweatpants?', 'vigor');
      this.hamPose = 'shrug';
      await this.line('hammer', "...I'm just happy to be here.", 'hammer');
      this.pickUpGerald();
      this.hamPose = 'gunUp';
      g.audio.sfx('spin', 0.7);
      await this.line('hammer', 'Police! Nobody move. Except to stretch.', 'hammer');
      this.vigorRun = true;
      this.setShot('vigor');
      g.audio.sfx('door', 0.8);
      await this.wait(0.9);
      await this.line('delgado', "He's running for the parking lot!", 'delgado');
      await this.line('hammer', 'Works for me.', 'hammer');
      s.wfm++; wfmDone = true;
      ui.worksForMe('CLASS DISMISSED');
      g.audio.sfx('wfm');
      await this.wait(1.8);
    }, () => {
      if (!wfmDone) s.wfm++;
      g.audio.stopMusic(0.1);
    });
    await this.w(ui.fade(1, 0.7));
    g.next();
  }

  dropGerald() {
    const h = this.ham.root.position;
    this.gerald.visible = true;
    this.gerald.position.set(h.x - 0.12, 0.85, h.z - 0.05);
    this.gerald.rotation.set(0.3, 0.6, 0.2);
    this.geraldFall = { vy: 0.6, vx: -0.5, vz: -0.9, bounces: 0 };
  }
  pickUpGerald() {
    this.geraldFall = null;
    this.ham.handR.add(this.gerald);
    this.gerald.position.set(0, -0.02, 0);
    this.gerald.rotation.set(Math.PI / 2, 0, 0);
  }

  // ------------------------------------------------------------------ gameplay
  laneInputs(lane) {
    const g = this.game, inp = g.input, two = g.mode === 2;
    const out = [];
    const keys = !two ? KEYS.both : lane.pi === 0 ? KEYS.wasd : KEYS.arrows;
    for (const d of DIRS) if (inp.anyPressed(keys[d])) out.push(d);
    let pads = inp.pads;
    if (two) pads = lane.pi === 0 ? (pads.length >= 2 ? [pads[0]] : []) : (pads.length >= 2 ? [pads[1]] : pads.slice(0, 1));
    for (const p of pads) {
      for (const d of DIRS) if (PAD_BTNS[d].some((i) => inp.btnPressed(p, i))) out.push(d);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const prev = this.stickPrev.get(p.index) || [0, 0];
      if (ax < -0.6 && prev[0] >= -0.6) out.push('left');
      if (ax > 0.6 && prev[0] <= 0.6) out.push('right');
      if (ay < -0.6 && prev[1] >= -0.6) out.push('up');
      if (ay > 0.6 && prev[1] <= 0.6) out.push('down');
    }
    if (lane.pi === 0) { out.push(...this.touchQ); }
    return out;
  }

  press(lane, dir) {
    let best = null, bd = 1e9;
    for (let i = lane.first; i < lane.notes.length; i++) {
      const n = lane.notes[i];
      if (n.t - this.songT > GOOD) break;
      if (n.done || n.dir !== dir) continue;
      const d = Math.abs(n.t - this.songT);
      if (d <= GOOD && d < bd) { best = n; bd = d; }
    }
    // you always do the move, even off the beat
    lane.pose = POSE_FRONT[dir];
    lane.poseT = 0.35;
    if (!best) return;
    this.hit(lane, best, bd <= PERFECT);
  }

  hit(lane, n, perfect) {
    n.done = true;
    if (n.el) { n.el.remove(); n.el = null; }
    lane.combo++;
    lane.best = Math.max(lane.best, lane.combo);
    if (perfect) { lane.perfect++; this.sus = Math.max(0, this.sus - 2.5); } else { lane.good++; this.sus = Math.max(0, this.sus - 1); }
    lane.pose = POSE_FRONT[n.dir];
    lane.poseT = 0.35;
    this.judge(lane, perfect ? pick(PRAISE) : pick(OKAY), perfect ? 'perfect' : 'good');
    const t = lane.tgts[DIRS.indexOf(n.dir)];
    t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit');
    if (perfect) this.game.audio.sfx('step', 0.6);
  }

  miss(lane, n) {
    n.done = true;
    if (n.el) { n.el.remove(); n.el = null; }
    lane.miss++;
    lane.combo = 0;
    lane.pose = 'flail';
    lane.poseT = 0.4;
    this.sus += this.game.mode === 2 ? 6.5 : 8.5;
    this.judge(lane, pick(OOPS), 'miss');
    this.game.audio.sfx('flub', 0.7);
    this.susBox.classList.remove('bump'); void this.susBox.offsetWidth; this.susBox.classList.add('bump');
  }

  judge(lane, text, cls) {
    const j = lane.judgeEl;
    j.textContent = text;
    j.className = 'aero-judge ' + cls;
    void j.offsetWidth;
    j.classList.add('pop');
    lane.comboEl.textContent = lane.combo >= 4 ? `${lane.combo} COMBO` : '';
  }

  updatePlay(dt) {
    const g = this.game;
    this.songT += dt;
    // stay locked to the tape (unless we're running at debug speed)
    // (judged against what you actually hear, so allow for the device's output latency)
    if (this.anchor !== null && g.audio.song && g.audio.song.name === 'aerobics' && !g.debug.fast) {
      const ctx = g.audio.ctx;
      const lat = Math.min(0.15, (ctx.outputLatency || 0) + (ctx.baseLatency || 0));
      const err = g.audio.t - lat - this.anchor - this.songT;
      if (Math.abs(err) < 0.5) this.songT += err * Math.min(1, dt * 20);
    }
    const T = this.songT;
    const beat = T / BEAT;
    for (const L of this.lanes) {
      for (const d of this.laneInputs(L)) this.press(L, d);
      for (let i = L.first; i < L.notes.length; i++) {
        const n = L.notes[i];
        if (n.t - T > LEAD) break;
        if (n.done) { if (i === L.first) L.first++; continue; }
        if (g.debug.auto && T >= n.t) { this.hit(L, n, true); continue; }
        if (T - n.t > GOOD) { this.miss(L, n); continue; }
        if (!n.el) {
          n.el = document.createElement('div');
          n.el.className = 'aero-note';
          n.el.style.left = DIRS.indexOf(n.dir) * 25 + 12.5 + '%';
          n.el.innerHTML = `<div class="arw arw-${n.dir}"></div>`;
          L.notesEl.appendChild(n.el);
        }
        n.el.style.top = 7 + ((n.t - T) / LEAD) * 93 + '%';
      }
    }
    this.touchQ.length = 0;
    // cover meter
    this.sus = clamp(this.sus, 0, 100);
    this.susBar.style.width = this.sus + '%';
    this.susBox.classList.toggle('hot', this.sus > 60);
    this.progBar.style.width = clamp(beat / END_BEAT, 0, 1) * 100 + '%';
    if (this.sus > 60 && !this.susWarned) {
      this.susWarned = true;
      g.ui.sub('vigor', 'Hey. You. Have we met?', 2.5);
      setTimeout(() => { if (!this.dead) g.ui.sub('delgado', 'Just... feeling the burn!', 2.5); }, 1300);
    }
    if (this.sus >= 100) {
      this.phase = 'failed';
      this.showHud(false);
      g.fail('COVER BLOWN', "Rick Vigor has never seen anyone do a grapevine that badly. He knows you're cops.");
      return;
    }
    // count-in
    const cb = Math.floor(beat);
    const ct = cb >= 4 && cb < 8 ? ['5', '6', '7', '8!'][cb - 4] : '';
    if (ct !== this.countShown) {
      this.countShown = ct;
      this.countEl.textContent = ct;
      this.countEl.classList.remove('pop'); void this.countEl.offsetWidth; if (ct) this.countEl.classList.add('pop');
    }
    // mid-song moments
    while (this.lineIdx < LINES.length && beat >= LINES[this.lineIdx][0]) {
      const [, who, text, shot] = LINES[this.lineIdx++];
      const t = text || HAMMER_QUIPS[this.quipIdx++ % HAMMER_QUIPS.length];
      g.ui.sub(who, t, 3);
      if (who === 'vigor') this.vigorPose = 'raise';
      if (shot) this.setShot(shot, 1.7);
    }
    if (this.shotUntil && this.t > this.shotUntil) { this.shotUntil = 0; this.setShot('main'); this.vigorPose = 'cross'; }
    const last = this.lanes[0].notes[this.lanes[0].notes.length - 1];
    if (T > last.t + BEAT * 3) this.run(() => this.outro());
  }

  /** Which move the class is doing right now (they follow the routine, the cue is Candi). */
  classMove(T, lag = 0) {
    const notes = this.lanes[0].notes;
    let cur = null;
    for (let i = Math.max(0, this.lanes[0].first - 3); i < notes.length; i++) {
      const n = notes[i];
      if (n.t > T - lag) break;
      if (T - lag - n.t < 0.35) cur = n;
    }
    return cur ? cur.dir : null;
  }

  update(dt) {
    const g = this.game;
    if (this.phase === 'play') this.updatePlay(dt);
    const playing = this.phase === 'play';
    const T = this.songT;
    const bounce = playing ? Math.abs(Math.sin((Math.PI * T) / BEAT)) * 0.045 : 0;
    // Candi leads: she hits each move right on the beat
    const cm = playing ? this.classMove(T) : null;
    this.candi.update(dt, { pose: this.candiPose || (cm ? POSE_BACK[cm] : playing ? 'aeroClap' : 'hips'), talk: this.talking === 'candi' });
    if (playing) this.candi.body.position.y = bounce;
    for (const d of this.dancers) {
      if (d.faceHam) {
        const h = this.ham.root.position, r = d.rig.root;
        const want = Math.atan2(h.x - r.position.x, h.z - r.position.z);
        r.rotation.y += Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y)) * Math.min(1, dt * 6);
        d.rig.update(dt, { pose: 'idle' });
        continue;
      }
      const m = playing ? this.classMove(T, d.lag) : null;
      d.rig.update(dt, { pose: m ? POSE_FRONT[m] : 'idle' });
      if (playing) d.rig.body.position.y = bounce;
    }
    // the cops
    for (const L of this.lanes) {
      L.poseT -= dt;
      if (L.poseT <= 0) L.pose = 'idle';
    }
    const two = g.mode === 2;
    const delLane = this.lanes.find((L) => L.who === 'delgado');
    const hamLane = this.lanes.find((L) => L.who === 'hammer');
    this.del.update(dt, { pose: playing ? delLane.pose : 'hips', talk: this.talking === 'delgado' });
    if (playing) this.del.body.position.y = bounce;
    let hamPose = this.hamPose || 'idle';
    if (playing) {
      if (hamLane) hamPose = hamLane.pose;
      else {
        // AI Hammer: late, often wrong, frequently flailing
        const m = this.classMove(T, 0.3);
        if (m !== this.hamLast) { this.hamLast = m; this.hamWrong = Math.random() < 0.3 ? pick(DIRS) : null; this.hamFlail = Math.random() < 0.18; }
        hamPose = this.hamFlail && m ? 'flail' : m ? POSE_FRONT[this.hamWrong || m] : 'idle';
      }
    }
    this.ham.update(dt, { pose: hamPose, talk: this.talking === 'hammer' });
    if (playing) this.ham.body.position.y = bounce * (hamLane ? 1 : 0.6);
    // Vigor on his platform (and later, leaving in a hurry)
    if (this.vigorRun) {
      const r = this.vigor.root;
      if (r.position.x < 6.5) { r.position.x += dt * 4.2; r.rotation.y = Math.PI / 2; } else r.visible = false;
      this.vigor.update(dt, { pose: 'idle', speed: 1.4 });
    } else this.vigor.update(dt, { pose: this.vigorPose, talk: this.talking === 'vigor' });
    // Gerald hits the floor
    if (this.geraldFall) {
      const f = this.geraldFall, m = this.gerald;
      f.vy -= 9.8 * dt;
      m.position.x += f.vx * dt; m.position.z += f.vz * dt; m.position.y += f.vy * dt;
      m.rotation.z += dt * 6 * (f.bounces < 2 ? 1 : 0);
      if (m.position.y < 0.05) {
        m.position.y = 0.05;
        if (f.bounces < 2) { f.vy = 1.6 / (f.bounces + 1); f.bounces++; } else { f.vx = f.vz = f.vy = 0; m.rotation.set(0, 0.8, Math.PI / 2); }
      }
    }
    for (const mk of this.markers) {
      mk.m.visible = playing;
      const p = mk.rig.root.position;
      mk.m.position.set(p.x, 2.45 + Math.sin(this.t * 5) * 0.06, p.z);
      mk.m.rotation.y += dt * 2;
    }
    // neon pulse on the beat
    const pulse = playing ? 0.6 + Math.abs(Math.sin((Math.PI * T) / BEAT)) * 0.6 : 1;
    this.discoLights[0].intensity = 9 * pulse;
    this.discoLights[1].intensity = 7 * (playing ? 1.8 - pulse : 1);
    // camera with a gentle TV sway
    const c = this.camera;
    const sway = this.shotName === 'main' ? Math.sin(this.t * 0.35) * 0.25 : Math.sin(this.t * 0.6) * 0.04;
    c.position.set(this.cam.pos.x + sway, this.cam.pos.y, this.cam.pos.z);
    c.lookAt(this.cam.look);
  }
}
