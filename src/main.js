import * as THREE from 'three';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { TouchControls } from './touch.js';
import { preventZoom } from './nozoom.js';
import { newStats } from './stats.js';
import { writeSave, clearSave, SAVE_SCENES } from './save.js';
import { TitleScene } from './scenes/title.js';
import { CreditsScene } from './scenes/credits.js';
import { OfficeScene } from './scenes/office.js';
import { ChaseScene } from './scenes/chase.js';
import { WarehouseScene } from './scenes/warehouse.js';
import { EndingScene } from './scenes/ending.js';
import { AerobicsScene } from './scenes/aerobics.js';
import { GymScene } from './scenes/gym.js';
import { nextScene, EPISODES } from './episodes.js';

const ROUTES = {
  title: { cls: TitleScene },
  credits: { cls: CreditsScene },
  briefing: { cls: OfficeScene, params: { mode: 'briefing' } },
  chase: { cls: ChaseScene, gameplay: true },
  warehouse: { cls: WarehouseScene, gameplay: true },
  verdict: { cls: OfficeScene, params: { mode: 'verdict' } },
  ending: { cls: EndingScene },
  // Episode 2: "Death Wears Leg Warmers"
  credits2: { cls: CreditsScene, params: { ep: 2 } },
  briefing2: { cls: OfficeScene, params: { mode: 'briefing', ep: 2 } },
  aerobics: { cls: AerobicsScene, gameplay: true },
  chase2: { cls: ChaseScene, params: { ep: 2 }, gameplay: true },
  gym: { cls: GymScene, gameplay: true },
  verdict2: { cls: OfficeScene, params: { mode: 'verdict', ep: 2 } },
  ending2: { cls: EndingScene, params: { ep: 2 } },
};

class Events {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] ||= []).push(f); }
  emit(n, ...a) { (this.h[n] || []).forEach((f) => f(...a)); }
  clear() { this.h = {}; }
}

export const CONTROLS_HTML = `
<div class="controls">
  <div><h3>1 PLAYER · KEYBOARD</h3>
    <kbd>W A S D</kbd> move / drive<br>
    <kbd>Mouse</kbd> or <kbd>Q E</kbd> / <kbd>← →</kbd> turn<br>
    <kbd>Click</kbd> / <kbd>Space</kbd> fire · <kbd>R</kbd> reload<br>
    <kbd>Shift</kbd> dramatic dive<br>
    <kbd>F</kbd> kick door / interact<br>
    <kbd>Tab</kbd> swap partner · <kbd>Esc</kbd> pause<br>
    Driving: <kbd>Space</kbd>/<kbd>Click</kbd> fires Gerald out the window · <kbd>F</kbd> horn<br>
    <kbd>Backspace</kbd> skips a cutscene<br>
    Aerobics: <kbd>← ↓ ↑ →</kbd> or <kbd>A S W D</kbd> on the beat</div>
  <div><h3>2 PLAYERS · ONE KEYBOARD</h3>
    <b>P1 Hammer</b>: same as left (WASD + mouse)<br>
    <b>P2 Delgado</b>: <kbd>↑ ↓</kbd> move, <kbd>← →</kbd> turn,<br>
    <kbd>Enter</kbd> fire, <kbd>R-Shift</kbd> dive,<br>
    <kbd>/</kbd> interact, <kbd>.</kbd> reload<br>
    In the chase, P2 aims Delgado's shots with the arrows.</div>
  <div><h3>TOUCH (PHONE / TABLET)</h3>
    Tap to start, choose and advance dialogue.<br>
    Left thumb: move · drag the right side to turn<br>
    Buttons: <b>FIRE</b>, <b>DIVE</b>, <b>KICK</b>, <b>RELOAD</b>, <b>SWAP</b><br>
    Driving: auto-gas, steer with the left thumb, pull back to brake, hold <b>FIRE</b> to shoot<br>    Aerobics: tap the four arrow buttons on the beat<br>
    <b>SKIP ▸▸</b> and <b>☰ MENU</b> appear during dialogue · ❚❚ pauses. Hold your phone sideways.</div>
  <div><h3>GAMEPAD</h3>
    <kbd>L-stick</kbd> move · <kbd>R-stick</kbd> turn<br>
    <kbd>RT</kbd>/<kbd>A</kbd> fire / gas · <kbd>LT</kbd> brake<br>
    <kbd>B</kbd> dive · <kbd>X</kbd> interact · <kbd>LB</kbd> reload<br>
    <kbd>Y</kbd> swap · <kbd>Start</kbd> pause · <kbd>Back</kbd> skip cutscene<br>
    Driving: <kbd>RT</kbd> gas · <kbd>RB</kbd> fire Gerald<br>    Aerobics: d-pad or <kbd>X A Y B</kbd> = ← ↓ ↑ →<br>
    Two pads? Each player gets one.</div>
</div>
<p style="font-size:.85em;opacity:.8">Aim assist is generous, just like 1997. Click the screen in the warehouse to use mouse-look. <kbd>M</kbd> mutes.</p>`;

class Game {
  constructor() {
    this.canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.params = new URLSearchParams(location.search);
    this.debug = { auto: this.params.has('auto'), god: this.params.has('god'), fast: this.params.has('fast') };
    this.lines = parseInt(this.params.get('res') || '240', 10);
    this.events = new Events();
    this.input = new Input(this);
    this.audio = new Audio();
    this.ui = new UI(this);
    this.touch = new TouchControls(this);
    preventZoom();
    this.mode = this.params.get('players') === '2' ? 2 : 1;
    this.stats = newStats();
    this.snapshot = newStats();
    this.time = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.timers = [];
    this.paused = false;
    this.failed = false;
    this.scene = null;
    this.resize();
    addEventListener('resize', () => this.resize());
    const unlock = () => this.audio.init();
    // iOS only unlocks audio on touchend/click, so listen to all of them
    for (const ev of ['keydown', 'pointerdown', 'touchend', 'click']) addEventListener(ev, unlock);
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    this.aspect = w / h;
    this.H = this.lines;
    this.W = Math.round(this.H * this.aspect);
    this.renderer.setSize(this.W, this.H, false);
  }

  realWait(sec) { return new Promise((r) => setTimeout(r, sec * 1000)); }
  wait(sec) { return new Promise((r) => this.timers.push({ t: this.time + sec, r })); }
  /** Resolve every pending game-time wait now (used when skipping a cutscene). */
  flushTimers() { const t = this.timers; this.timers = []; t.forEach((x) => x.r()); }
  slowmo(scale, dur) { this.timeScale = scale; this.slowT = dur; }

  goto(name, params = {}) {
    const def = ROUTES[name] || ROUTES.title;
    if (this.scene) this.scene.exit();
    this.timers = [];
    this.events.clear();
    this.ui.clearScene();
    this.paused = false;
    this.failed = false;
    this.timeScale = 1;
    this.slowT = 0;
    this.input.releaseLock();
    this.audio.engineStop();
    this.canvas.classList.remove('freeze');
    if (def.gameplay) this.snapshot = JSON.parse(JSON.stringify(this.stats));
    this.current = { name, params };
    this.scene = new def.cls(this, { ...(def.params || {}), ...params });
    this.scene.enter();
    if (SAVE_SCENES[name]) writeSave(name, this.mode, def.gameplay ? this.snapshot : this.stats);
    if (name.startsWith('ending')) {
      // finished an episode: the save now points at the next one (or is cleared after the last)
      const ep = EPISODES.findIndex((e) => e.scenes.includes(name));
      const following = EPISODES[ep + 1];
      if (following) writeSave(following.scenes[0], this.mode, newStats(following.n));
      else clearSave();
    }
    window.dispatchEvent(new CustomEvent('hd-scene', { detail: name }));
  }

  /** Go to the next scene of the current episode (or the title after the last). */
  next() {
    const n = nextScene(this.current.name);
    this.goto(n || 'title');
  }

  retry() {
    this.stats = JSON.parse(JSON.stringify(this.snapshot));
    this.goto(this.current.name, this.current.params);
  }

  renderView(scene, cam, fx, fy, fw, fh) {
    const r = this.renderer;
    const x = Math.round(fx * this.W), y = Math.round(fy * this.H);
    const w = Math.round(fw * this.W), h = Math.round(fh * this.H);
    r.setViewport(x, y, w, h);
    r.setScissor(x, y, w, h);
    r.setScissorTest(true);
    const asp = w / h;
    if (Math.abs(cam.aspect - asp) > 1e-4) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    r.render(scene, cam);
  }

  async pause() {
    if (this.paused || this.failed) return;
    const s = this.scene;
    this.paused = true;
    this.input.releaseLock();
    this.audio.sfx('menu');
    const items = [{ label: 'RESUME', value: 'resume' }];
    if (s && s.canSkip()) items.push({ label: 'SKIP SCENE ▸▸', value: 'skip' });
    if (s && s.pausable) items.push({ label: 'RESTART SCENE', value: 'restart' });
    items.push({ label: 'CONTROLS', value: 'controls' }, { label: 'QUIT TO TITLE', value: 'quit' });
    const choice = await this.ui.menu(items, {
      title: "WE'LL BE RIGHT BACK", text: 'Stay tuned for more <i>Hammer &amp; Delgado</i>.', cls: 'bars', foot: 'ESC / START TO RESUME', back: 'resume',
    });
    if (!this.paused || s !== this.scene) return;
    if (choice === 'controls') { await this.showControls(); this.paused = false; return this.pause(); }
    if (choice === 'restart') return this.retry();
    if (choice === 'quit') return this.goto('title');
    this.paused = false;
    if (choice === 'skip') s.skip();
  }

  showControls() {
    return this.ui.menu([{ label: 'BACK', value: 'back' }], { title: 'CONTROLS', html: CONTROLS_HTML, back: 'back' });
  }

  async fail(title, line) {
    if (this.failed) return;
    this.failed = true;
    this.input.releaseLock();
    this.audio.stopMusic(0.3);
    this.audio.engineStop();
    this.audio.sfx('sadTrombone');
    await this.realWait(0.8);
    const c = await this.ui.menu(
      [{ label: 'TRY AGAIN', value: 'retry' }, { label: 'QUIT TO TITLE', value: 'quit' }],
      { title: "YOU'RE OFF THE CASE!", text: `<b>${title}</b><br>${line}`, cls: 'offcase' },
    );
    if (c === 'retry') this.retry();
    else this.goto('title');
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    const rdt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.input.update();
    if (this.input.keyPressed('KeyM')) this.audio.setMuted(!this.audio.muted);
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.timeScale = 1; }
    const s = this.scene;
    if (s) {
      if (this.paused) {
        if (this.input.pausePressed() && this.ui.menuState && this.ui.menuState.age > 0.2) { this.ui.closeMenu(); this.paused = false; }
      } else if (!this.failed && !this.ui.menuState && (s.canSkip() || (s.pausable && !this.ui.dialog)) && this.input.pausePressed()) {
        this.pause();
      } else if (s.canSkip() && !this.ui.menuState && this.input.skipPressed()) {
        this.audio.sfx('confirm');
        s.skip();
      }
      if (!this.paused && !this.failed) {
        const dt = rdt * this.timeScale * (this.debug.fast ? 3 : 1);
        this.time += dt;
        if (this.timers.length) {
          const due = this.timers.filter((t) => t.t <= this.time);
          if (due.length) { this.timers = this.timers.filter((t) => t.t > this.time); due.forEach((t) => t.r()); }
        }
        s.t += dt;
        s.update(dt, rdt);
      }
      s.render();
    }
    this.touch.setMode(s && !this.paused && !this.failed && !this.ui.busy && s.touchMode ? s.touchMode() : null);
    this.ui.update(rdt);
    this.input.endFrame();
  }
}

// offline / home-screen support (only where the manifest is present, i.e. not in the single-file build)
if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]') && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const game = new Game();
window.game = game;
{
  // debug jump: start with the right episode's case file
  const first = game.params.get('scene') || 'title';
  const ep = EPISODES.find((e) => e.scenes.includes(first));
  if (ep) game.stats = newStats(ep.n);
  game.goto(first);
}
