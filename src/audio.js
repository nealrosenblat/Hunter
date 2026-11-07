// Everything you hear is synthesized live with the Web Audio API:
// an original 80s TV-cop score (drum machine, synth bass, "sax" lead, brass, DX-style e-piano)
// plus sound effects. No samples, no copyrighted music.

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Parse "A4 - - . C5 -" into 16-step events [{step, midi, len}] */
function parseLine(str) {
  const toks = str.trim().split(/\s+/);
  const ev = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '-' || t === '.') continue;
    let len = 1;
    while (toks[i + len] === '-') len++;
    const notes = t.split('+').map(midi);
    ev.push({ step: i, notes, len });
  }
  return ev;
}
function pump(root, oct = 2, pattern = 'R . R . O . R . R . R . O . R R') {
  return pattern.replace(/R/g, root + oct).replace(/O/g, root + (oct + 1));
}
const chord = (s) => s.split(' ');

// ------------------------------------------------------------------ songs
const SONGS = {
  theme: {
    bpm: 122, bars: 8,
    kick: ['x.......x.x.....'], snare: ['....x.......x...'], hat: ['x.x.x.x.x.x.x.xo'],
    bass: ['A', 'F', 'G', 'E', 'A', 'F', 'G', 'E'].map((r) => pump(r)),
    lead: [
      'A4 - - - C5 - E5 - - - D5 - C5 - D5 -',
      'E5 - - - - - - - . . C5 - D5 - E5 -',
      'G5 - - - F5 - E5 - - - D5 - - - B4 -',
      'E5 - - - - - - - - - - - . . . .',
      'A4 - - - C5 - E5 - - - A5 - - - G5 -',
      'F5 - - - E5 - C5 - - - A4 - C5 - F5 -',
      'G5 - - - - - D5 - G5 - - - A5 - B5 -',
      'G#5 - - - - - - - - - - - . . E5 -',
    ],
    pad: [chord('A3 C4 E4'), chord('F3 A3 C4'), chord('G3 B3 D4'), chord('E3 G3 B3'), chord('A3 C4 E4'), chord('F3 A3 C4'), chord('G3 B3 D4'), chord('E3 G#3 B3')],
    padRhythm: 'x - - - - - - - - - - - - - - -',
    stab: [chord('A4 C5 E5'), null, chord('G4 B4 D5'), null, chord('A4 C5 E5'), null, chord('G4 B4 D5'), chord('E4 G#4 B4')],
    stabRhythm: 'x . . x . . x . . . . . . . . .',
  },
  office: {
    bpm: 88, bars: 4,
    kick: ['x.........x.....'], snare: ['....o.......o...'], hat: ['x.xxx.xxx.xxx.xx'], hatVol: 0.45,
    bass: [
      'D2 - - - - - A2 - - - D3 - C3 - A2 -',
      'G2 - - - - - D3 - - - G2 - A2 - B2 -',
      'C3 - - - - - G2 - - - E2 - G2 - B2 -',
      'A2 - - - - - E2 - - - A2 - C3 - E3 -',
    ],
    ep: [chord('F3 A3 C4 E4'), chord('F3 B3 E4 G4'), chord('E3 G3 B3 D4'), chord('C3 E3 G3 B3')],
    epRhythm: 'x - - . . . x - . . x - - - . .',
    lead: [
      '. . . . . . . . A4 - C5 - D5 - E5 -',
      'F5 - - - E5 - D5 - - - . . . . . .',
      '. . . . . . . . G4 - B4 - D5 - E5 -',
      'C5 - - - - - - - - - . . . . . .',
    ],
    leadVol: 0.55,
  },
  chase: {
    bpm: 146, bars: 4,
    kick: ['x...x...x...x...'], snare: ['....x.......x..x'], hat: ['xxxxxxxxxxxxxxxx'], hatVol: 0.5,
    bass: ['E', 'C', 'D', 'B'].map((r) => pump(r, 2, 'R R O R R R O R R R O R R R O R')),
    lead: [
      'E5 - . E5 . G5 - . F#5 - . E5 . D5 - .',
      'E5 - - - . . G5 - - - A5 - G5 - E5 -',
      'F#5 - . F#5 . A5 - . G5 - . F#5 . E5 - .',
      'D#5 - - - F#5 - - - B5 - - - A5 - F#5 -',
    ],
    pad: [chord('E3 G3 B3'), chord('C3 E3 G3'), chord('D3 F#3 A3'), chord('B2 D#3 F#3')],
    padRhythm: 'x - - - - - - - - - - - - - - -',
    stab: [chord('E4 G4 B4'), chord('C4 E4 G4'), chord('D4 F#4 A4'), chord('B3 D#4 F#4')],
    stabRhythm: 'x . . x . . x . . . . . . . . .',
  },
  warehouse: {
    bpm: 112, bars: 4,
    kick: ['x.....x...x.....'], snare: ['....x.......x...'], hat: ['x.x.x.x.x.x.x.x.'], hatVol: 0.6,
    bass: [
      'D2 . . D2 . . D2 . F2 . . E2 . . C2 .',
      'D2 . . D2 . . D2 . F2 . . G2 . . A2 .',
      'A#1 . . A#1 . . A#1 . D2 . . C2 . . A#1 .',
      'A1 . . A1 . . A1 . C#2 . . E2 . . A2 .',
    ],
    pad: [chord('D3 F3 A3'), chord('D3 F3 A3'), chord('A#2 D3 F3'), chord('A2 C#3 E3')],
    padRhythm: 'x - - - - - - - - - - - - - - -',
    stab: [chord('D4 F4 A4'), null, chord('A#3 D4 F4'), chord('A3 C#4 E4')],
    stabRhythm: 'x . . x . . x . . . . . . . . .',
  },
  disco: {
    bpm: 124, bars: 8,
    kick: ['x...x...x...x...'], snare: ['....x.......x...'], hat: ['x.o.x.o.x.o.x.o.'],
    bass: ['A', 'D', 'A', 'D', 'F', 'E', 'A', 'E'].map((r) => pump(r, 1, 'R . O . R . O . R . O . R . O .')),
    lead: [
      'E5 - G5 - A5 - - - G5 - E5 - . . . .',
      'F#5 - E5 - D5 - - - E5 - F#5 - A5 - . .',
    ],
    stab: [chord('G4 C5 E5'), chord('F#4 C5 E5'), chord('G4 C5 E5'), chord('F#4 C5 E5'), chord('A4 C5 E5'), chord('G#4 D5 E5'), chord('G4 C5 E5'), chord('G#4 B4 E5')],
    stabRhythm: '. . x . . . x . . . x . . . x .',
    stabVol: 0.7,
  },
};
for (const s of Object.values(SONGS)) {
  for (const k of ['bass', 'lead']) if (s[k]) s[k + 'Ev'] = s[k].map(parseLine);
  for (const k of ['padRhythm', 'stabRhythm', 'epRhythm']) if (s[k]) s[k + 'Ev'] = parseLine(s[k].replace(/x/g, 'C4'));
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.song = null;
    this.engineOn = false;
    this.muted = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    // reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(1.6, 2.6);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.5;
    this.verbIn.connect(this.verb).connect(this.master);
    // noise
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.timer = setInterval(() => this.schedule(), 25);
    if (this.pending) { const p = this.pending; this.pending = null; this.playSong(p); }
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = b.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.t, 0.05);
  }

  // ---------------------------------------------------------- building blocks
  env(g, t, a, peak, dec, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(sus, t + a, dec);
    g.gain.setTargetAtTime(0.0001, end, rel);
  }
  osc(type, f, t, stop) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.start(t); o.stop(stop);
    return o;
  }
  noise(t, stop) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.start(t, Math.random()); s.stop(stop);
    return s;
  }
  filt(type, f, q = 1) {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }
  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  // ---------------------------------------------------------- instruments
  kick(t, v, out) {
    const o = this.osc('sine', 150, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.95 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(out);
  }
  snare(t, v, out) {
    const n = this.noise(t, t + 0.3);
    const f = this.filt('highpass', 1300);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.45 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(f).connect(g);
    g.connect(out); g.connect(this.verbIn);
    const o = this.osc('triangle', 185, t, t + 0.15);
    const g2 = this.gain(0);
    g2.gain.setValueAtTime(0.35 * v, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g2).connect(out);
  }
  hat(t, v, open, out) {
    const n = this.noise(t, t + 0.4);
    const f = this.filt('highpass', 7200);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.13 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.045));
    n.connect(f).connect(g).connect(out);
  }
  bass(t, m, dur, v, out) {
    const f = mtof(m), end = t + dur;
    const o = this.osc('sawtooth', f, t, end + 0.2);
    const o2 = this.osc('square', f * 0.5, t, end + 0.2);
    const lp = this.filt('lowpass', 300, 6);
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.16);
    const g = this.gain(0);
    this.env(g, t, 0.005, 0.32 * v, 0.1, 0.22 * v, 0.03, end);
    const g2 = this.gain(0.35);
    o.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(g).connect(out);
  }
  lead(t, m, dur, v, out) {
    const f = mtof(m), end = t + dur;
    const o = this.osc('sawtooth', f, t, end + 0.3);
    const o2 = this.osc('square', f * 1.004, t, end + 0.3);
    const lfo = this.osc('sine', 5.6, t, end + 0.3);
    const lg = this.gain(f * 0.007);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const lp = this.filt('lowpass', 1800, 2.5);
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2800, t + 0.06);
    lp.frequency.setTargetAtTime(1700, t + 0.06, 0.15);
    const g = this.gain(0);
    this.env(g, t, 0.025, 0.16 * v, 0.2, 0.12 * v, 0.06, end);
    const mix = this.gain(0.5);
    o.connect(lp); o2.connect(mix).connect(lp);
    lp.connect(g); g.connect(out);
    const send = this.gain(0.35); g.connect(send).connect(this.verbIn);
  }
  pad(t, notes, dur, v, out) {
    const end = t + dur;
    for (const m of notes) {
      for (const det of [-8, 8]) {
        const o = this.osc('sawtooth', mtof(m), t, end + 1);
        o.detune.value = det;
        const lp = this.filt('lowpass', 900, 0.7);
        const g = this.gain(0);
        this.env(g, t, 0.3, 0.035 * v, 0.5, 0.03 * v, 0.35, end);
        o.connect(lp).connect(g).connect(out);
      }
    }
  }
  brass(t, notes, dur, v, out) {
    const end = t + Math.max(dur, 0.12);
    for (const m of notes) {
      const o = this.osc('sawtooth', mtof(m), t, end + 0.4);
      o.detune.value = (Math.random() - 0.5) * 12;
      const lp = this.filt('lowpass', 500, 1.5);
      lp.frequency.setValueAtTime(400, t);
      lp.frequency.linearRampToValueAtTime(3200, t + 0.04);
      lp.frequency.setTargetAtTime(1100, t + 0.05, 0.12);
      const g = this.gain(0);
      this.env(g, t, 0.015, 0.09 * v, 0.12, 0.05 * v, 0.07, end);
      o.connect(lp).connect(g);
      g.connect(out);
      const s = this.gain(0.4); g.connect(s).connect(this.verbIn);
    }
  }
  ep(t, notes, dur, v, out) {
    const end = t + dur;
    for (const m of notes) {
      const f = mtof(m);
      const car = this.osc('sine', f, t, end + 1.2);
      const mod = this.osc('sine', f * 1, t, end + 1.2);
      const mg = this.gain(0);
      mg.gain.setValueAtTime(f * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.2, t + 0.5);
      mod.connect(mg).connect(car.frequency);
      const g = this.gain(0);
      this.env(g, t, 0.004, 0.07 * v, 0.5, 0.025 * v, 0.3, end);
      car.connect(g).connect(out);
      const s = this.gain(0.3); g.connect(s).connect(this.verbIn);
    }
  }

  // ---------------------------------------------------------- sequencer
  playSong(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.song && this.song.name === name) return;
    this.stopMusic(0.6);
    const def = SONGS[name];
    if (!def) return;
    const out = this.gain(0.0001);
    out.connect(this.master);
    out.gain.setTargetAtTime(0.55, this.t, 0.15);
    this.song = { name, def, out, step: 0, next: this.t + 0.08 };
  }
  stopMusic(fade = 0.5) {
    this.pending = null;
    if (!this.song) return;
    const out = this.song.out;
    out.gain.setTargetAtTime(0.0001, this.t, fade / 3);
    setTimeout(() => out.disconnect(), fade * 1000 + 600);
    this.song = null;
  }
  schedule() {
    const s = this.song;
    if (!s || !this.ctx) return;
    const stepDur = 60 / s.def.bpm / 4;
    while (s.next < this.t + 0.12) {
      this.playStep(s, s.step, s.next, stepDur);
      s.next += stepDur;
      s.step++;
    }
  }
  playStep(s, step, t, sd) {
    const d = s.def, out = s.out;
    const bar = Math.floor(step / 16) % d.bars, i = step % 16;
    const at = (arr) => arr[bar % arr.length];
    const k = at(d.kick)[i], sn = at(d.snare)[i], h = at(d.hat)[i];
    if (k === 'x') this.kick(t, 1, out);
    if (sn === 'x') this.snare(t, 1, out);
    if (sn === 'o') this.snare(t, 0.45, out);
    if (h === 'x') this.hat(t, d.hatVol ?? 0.8, false, out);
    if (h === 'o') this.hat(t, d.hatVol ?? 0.8, true, out);
    const play = (evs, fn, vol = 1) => {
      for (const e of evs) if (e.step === i) for (const n of e.notes) fn.call(this, t, n, e.len * sd * 0.95, vol, out);
    };
    if (d.bassEv) play(at(d.bassEv), this.bass);
    if (d.leadEv) play(at(d.leadEv), this.lead, d.leadVol ?? 1);
    const chordAt = (list, rhythm, fn, vol) => {
      const c = list && at(list);
      if (!c || !rhythm) return;
      for (const e of rhythm) if (e.step === i) fn.call(this, t, c.map(midi), e.len * sd * 0.95, vol, out);
    };
    chordAt(d.pad, d.padRhythmEv, this.pad, 1);
    chordAt(d.stab, d.stabRhythmEv, this.brass, d.stabVol ?? 1);
    chordAt(d.ep, d.epRhythmEv, this.ep, 1);
  }

  // ---------------------------------------------------------- sound effects
  sfx(name, vol = 1) {
    if (!this.ctx || this.muted) return;
    const fn = SFX[name];
    if (fn) fn.call(this, this.t + 0.005, vol, this.sfxBus);
  }

  blip(pitch, wave = 'square') {
    if (!this.ctx) return;
    const t = this.t;
    const f = pitch * [1, 1.12, 1.26, 0.94, 1.5][Math.floor(Math.random() * 5)];
    const o = this.osc(wave, f, t, t + 0.08);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(this.sfxBus);
  }

  engineStart() {
    if (!this.ctx || this.engineOn) return;
    const t = this.t;
    this.eng = {
      o1: this.osc('sawtooth', 50, t, t + 3600),
      o2: this.osc('square', 25, t, t + 3600),
      lp: this.filt('lowpass', 500, 3),
      g: this.gain(0),
    };
    const e = this.eng;
    const mix = this.gain(0.4);
    e.o1.connect(e.lp); e.o2.connect(mix).connect(e.lp);
    e.lp.connect(e.g).connect(this.sfxBus);
    e.g.gain.setTargetAtTime(0.09, t, 0.2);
    this.engineOn = true;
  }
  engineSet(speed01, throttle) {
    if (!this.engineOn) return;
    const gears = 4;
    const g = Math.min(gears - 1, Math.floor(speed01 * gears));
    const frac = speed01 * gears - g;
    const f = 42 + frac * 52 + g * 9 + throttle * 6;
    const t = this.t;
    this.eng.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.eng.lp.frequency.setTargetAtTime(380 + throttle * 700 + speed01 * 500, t, 0.08);
    this.eng.g.gain.setTargetAtTime(this.muted ? 0 : 0.06 + throttle * 0.05, t, 0.1);
  }
  engineStop() {
    if (!this.engineOn) return;
    const e = this.eng, t = this.t;
    e.g.gain.setTargetAtTime(0.0001, t, 0.15);
    e.o1.stop(t + 1); e.o2.stop(t + 1);
    this.engineOn = false;
  }
}

// ------------------------------------------------------------------ sfx recipes
function burst(a, t, vol, out, { type = 'lowpass', f0 = 3000, f1 = 300, dur = 0.3, q = 1, peak = 0.6, verb = 0.3 }) {
  const n = a.noise(t, t + dur + 0.1);
  const f = a.filt(type, f0, q);
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = a.gain(0);
  g.gain.setValueAtTime(peak * vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f).connect(g).connect(out);
  if (verb) { const s = a.gain(verb); g.connect(s).connect(a.verbIn); }
}
function tone(a, t, vol, out, { type = 'sine', f0 = 440, f1 = null, dur = 0.2, peak = 0.3, verb = 0 }) {
  const o = a.osc(type, f0, t, t + dur + 0.05);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.gain(0);
  g.gain.setValueAtTime(peak * vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  if (verb) { const s = a.gain(verb); g.connect(s).connect(a.verbIn); }
}

const SFX = {
  magnum(t, v, o) {
    burst(this, t, v, o, { f0: 4500, f1: 200, dur: 0.45, peak: 0.9, verb: 0.6 });
    tone(this, t, v, o, { f0: 120, f1: 35, dur: 0.3, peak: 0.9 });
  },
  pistol(t, v, o) {
    burst(this, t, v, o, { f0: 6000, f1: 600, dur: 0.18, peak: 0.55, verb: 0.35 });
    tone(this, t, v, o, { f0: 180, f1: 60, dur: 0.1, peak: 0.4 });
  },
  enemyShot(t, v, o) {
    burst(this, t, v, o, { type: 'bandpass', f0: 2600, f1: 900, dur: 0.14, q: 0.8, peak: 0.4, verb: 0.3 });
  },
  ricochet(t, v, o) {
    tone(this, t, v, o, { type: 'sine', f0: 2600 + Math.random() * 1200, f1: 700, dur: 0.32, peak: 0.12, verb: 0.4 });
  },
  impact(t, v, o) {
    burst(this, t, v, o, { type: 'bandpass', f0: 1800, f1: 600, dur: 0.06, q: 1.5, peak: 0.25, verb: 0 });
  },
  explosion(t, v, o) {
    burst(this, t, v, o, { f0: 1600, f1: 60, dur: 1.4, peak: 1.1, verb: 0.7 });
    tone(this, t, v, o, { f0: 80, f1: 25, dur: 0.9, peak: 0.9 });
  },
  crunch(t, v, o) {
    burst(this, t, v, o, { type: 'bandpass', f0: 600, f1: 200, dur: 0.3, q: 0.9, peak: 0.9, verb: 0.2 });
    tone(this, t, v, o, { type: 'square', f0: 90, f1: 40, dur: 0.2, peak: 0.25 });
  },
  clang(t, v, o) {
    for (const f of [523, 1187, 1730, 2410]) tone(this, t, v, o, { type: 'sine', f0: f * (0.97 + Math.random() * 0.06), dur: 0.6, peak: 0.07, verb: 0.3 });
  },
  glass(t, v, o) {
    burst(this, t, v, o, { type: 'highpass', f0: 5000, f1: 3000, dur: 0.5, peak: 0.5, verb: 0.4 });
    for (let i = 0; i < 9; i++) tone(this, t + Math.random() * 0.35, v, o, { f0: 2500 + Math.random() * 3500, dur: 0.15, peak: 0.06 });
  },
  scrape(t, v, o) { burst(this, t, v, o, { type: 'bandpass', f0: 1500, f1: 900, dur: 0.35, q: 2, peak: 0.35, verb: 0 }); },
  screech(t, v, o) {
    const n = this.noise(t, t + 1);
    const f = this.filt('bandpass', 2600, 9);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35 * v, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    n.connect(f).connect(g).connect(o);
  },
  horn(t, v, o) {
    for (const [f, d] of [[311, 0], [370, 0]]) {
      const os = this.osc('square', f, t, t + 0.75);
      os.frequency.setValueAtTime(f, t + 0.25);
      os.frequency.linearRampToValueAtTime(f * 0.84, t + 0.7);
      const lp = this.filt('lowpass', 1500);
      const g = this.gain(0);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.linearRampToValueAtTime(0.08 * v, t + 0.02);
      g.gain.setValueAtTime(0.08 * v, t + 0.2);
      g.gain.linearRampToValueAtTime(0.02 * v, t + 0.25);
      g.gain.linearRampToValueAtTime(0.08 * v, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
      os.connect(lp).connect(g).connect(o);
    }
  },
  door(t, v, o) {
    tone(this, t, v, o, { f0: 110, f1: 40, dur: 0.25, peak: 0.9 });
    burst(this, t, v, o, { f0: 2500, f1: 200, dur: 0.35, peak: 0.7, verb: 0.6 });
  },
  creak(t, v, o) {
    const os = this.osc('sawtooth', 180, t, t + 0.8);
    os.frequency.linearRampToValueAtTime(260, t + 0.7);
    const bp = this.filt('bandpass', 900, 8);
    const g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12 * v, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    os.connect(bp).connect(g).connect(o);
  },
  reload(t, v, o) {
    for (let i = 0; i < 3; i++) burst(this, t + i * 0.09, v, o, { type: 'bandpass', f0: 3500, f1: 2500, dur: 0.03, q: 3, peak: 0.25, verb: 0 });
  },
  spin(t, v, o) {
    for (let i = 0; i < 10; i++) burst(this, t + i * 0.05, v, o, { type: 'bandpass', f0: 4200, f1: 3800, dur: 0.02, q: 4, peak: 0.15, verb: 0 });
    burst(this, t + 0.6, v, o, { type: 'bandpass', f0: 2000, f1: 1500, dur: 0.05, q: 2, peak: 0.35, verb: 0 });
  },
  empty(t, v, o) { burst(this, t, v, o, { type: 'bandpass', f0: 3000, f1: 2800, dur: 0.03, q: 5, peak: 0.25, verb: 0 }); },
  hurt(t, v, o) { tone(this, t, v, o, { type: 'square', f0: 220, f1: 110, dur: 0.16, peak: 0.12 }); },
  down(t, v, o) { tone(this, t, v, o, { type: 'sawtooth', f0: 300, f1: 70, dur: 0.7, peak: 0.15 }); },
  goonDie(t, v, o) { tone(this, t, v, o, { type: 'square', f0: 330 + Math.random() * 120, f1: 90, dur: 0.45, peak: 0.08 }); },
  whoosh(t, v, o) { burst(this, t, v, o, { type: 'bandpass', f0: 500, f1: 2400, dur: 0.35, q: 1.2, peak: 0.35, verb: 0 }); },
  pickup(t, v, o) { [0, 4, 7, 12].forEach((s, i) => tone(this, t + i * 0.06, v, o, { type: 'square', f0: mtof(72 + s), dur: 0.1, peak: 0.07 })); },
  beep(t, v, o) { tone(this, t, v, o, { type: 'square', f0: 1760, dur: 0.06, peak: 0.06 }); },
  menu(t, v, o) { tone(this, t, v, o, { type: 'square', f0: 880, dur: 0.05, peak: 0.05 }); },
  confirm(t, v, o) { [0, 7].forEach((s, i) => tone(this, t + i * 0.07, v, o, { type: 'square', f0: mtof(76 + s), dur: 0.09, peak: 0.07 })); },
  thump(t, v, o) { tone(this, t, v, o, { f0: 90, f1: 40, dur: 0.18, peak: 0.8 }); burst(this, t, v, o, { f0: 1200, f1: 200, dur: 0.12, peak: 0.4, verb: 0.2 }); },
  splash(t, v, o) { burst(this, t, v, o, { f0: 3000, f1: 400, dur: 0.6, peak: 0.4, verb: 0.2 }); },
  cuff(t, v, o) { burst(this, t, v, o, { type: 'bandpass', f0: 4000, f1: 3000, dur: 0.05, q: 4, peak: 0.4, verb: 0.2 }); burst(this, t + 0.12, v, o, { type: 'bandpass', f0: 4200, f1: 3200, dur: 0.05, q: 4, peak: 0.4, verb: 0.2 }); },
  wfm(t, v, o) {
    // the "Works for me" sting: big brass stab + snare
    this.brass(t, [57, 64, 69, 73, 76], 0.5, 1.6, o);
    this.snare(t, 1.2, o);
    this.kick(t, 1, o);
  },
  dun(t, v, o) {
    // dramatic "dun dun DUNNN"
    this.brass(t, [50, 57, 62], 0.18, 1.4, o);
    this.brass(t + 0.3, [50, 57, 62], 0.18, 1.4, o);
    this.brass(t + 0.6, [49, 56, 61], 1.2, 1.7, o);
    this.kick(t + 0.6, 1, o);
  },
  freeze(t, v, o) {
    burst(this, t, v, o, { type: 'bandpass', f0: 2000, f1: 1500, dur: 0.06, q: 2, peak: 0.5, verb: 0.3 });
    this.brass(t + 0.05, [57, 61, 64, 69, 73], 1.6, 1.4, o);
    this.snare(t + 0.05, 1.2, o);
  },
  sadTrombone(t, v, o) {
    const notes = [[58, 0.35], [57, 0.35], [56, 0.35], [55, 1.3]];
    let tt = t;
    for (const [m, d] of notes) {
      const os = this.osc('sawtooth', mtof(m), tt, tt + d + 0.2);
      if (d > 1) {
        const l = this.osc('sine', 6, tt, tt + d + 0.2), lg = this.gain(mtof(m) * 0.03);
        l.connect(lg).connect(os.frequency);
      }
      const lp = this.filt('lowpass', 900, 1);
      const g = this.gain(0);
      this.env(g, tt, 0.04, 0.12 * v, 0.2, 0.09 * v, 0.08, tt + d);
      os.connect(lp).connect(g).connect(o);
      tt += d;
    }
  },
};
