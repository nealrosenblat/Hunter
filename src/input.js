// Keyboard, mouse and gamepad input, mapped to per-player "controls".
// 1 player: every keyboard binding + mouse + every gamepad drive player 1.
// 2 players: P1 = WASD + mouse (+ pad 1 if two pads), P2 = arrows/Enter (+ a pad).

const KB1 = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  turnL: ['KeyQ'], turnR: ['KeyE'],
  fire: ['Space', 'KeyJ'], dive: ['ShiftLeft', 'KeyK'], action: ['KeyF'], reload: ['KeyR'], swap: ['Tab'],
};
const KB2 = {
  up: ['ArrowUp'], down: ['ArrowDown'], left: [], right: [],
  turnL: ['ArrowLeft'], turnR: ['ArrowRight'],
  fire: ['Enter', 'NumpadEnter', 'ControlRight', 'Numpad0'], dive: ['ShiftRight', 'Numpad1'], action: ['Slash', 'Numpad2'], reload: ['Period', 'Numpad3'], swap: [],
};
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote', 'Enter']);

const DEAD = 0.22;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = [false, false, false];
    this.mousePressed = [false, false, false];
    this.pads = [];
    this.prevButtons = new Map();
    this.prevStick = new Map();
    this.locked = false;

    addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = [false, false, false]; });
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; }
    });
    addEventListener('mousedown', (e) => {
      if (e.button < 3) { this.mouseDown[e.button] = true; this.mousePressed[e.button] = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button < 3) this.mouseDown[e.button] = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === game.canvas;
    });
  }

  requestLock() {
    if (this.locked || !this.game.canvas.requestPointerLock) return;
    try {
      const p = this.game.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* iframes may refuse; keyboard turning still works */ }
  }
  releaseLock() { if (this.locked) document.exitPointerLock?.(); }

  update() {
    const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((p) => p && p.connected) : [];
    this.pads = list.map((p) => ({
      id: p.index,
      axes: p.axes.slice(0, 4),
      buttons: p.buttons.map((b) => (typeof b === 'object' ? b.value : b)),
    }));
  }

  endFrame() {
    this.pressed.clear();
    this.mousePressed = [false, false, false];
    this.mouseDX = 0;
    this.mouseDY = 0;
    for (const p of this.pads) {
      this.prevButtons.set(p.id, p.buttons.slice());
      this.prevStick.set(p.id, [p.axes[0] || 0, p.axes[1] || 0]);
    }
  }

  key(code) { return this.keys.has(code); }
  keyPressed(code) { return this.pressed.has(code); }
  anyKey(codes) { return codes.some((c) => this.keys.has(c)); }
  anyPressed(codes) { return codes.some((c) => this.pressed.has(c)); }

  btn(p, i) { return (p.buttons[i] || 0) > 0.5; }
  btnPressed(p, i) {
    const prev = this.prevButtons.get(p.id);
    return this.btn(p, i) && !(prev && (prev[i] || 0) > 0.5);
  }

  /** Which input sources belong to player index pi given the current mode. */
  sources(pi) {
    const mode = this.game.mode;
    const pads = this.pads;
    if (mode === 1) return { maps: [KB1, KB2], mouse: true, pads };
    if (pi === 0) return { maps: [KB1], mouse: true, pads: pads.length >= 2 ? [pads[0]] : [] };
    return { maps: [KB2], mouse: false, pads: pads.length >= 2 ? [pads[1]] : pads.length === 1 ? [pads[0]] : [] };
  }

  controls(pi) {
    const src = this.sources(pi);
    const c = {
      mx: 0, my: 0, turn: 0, look: 0, mouseTurn: 0,
      fire: false, firePressed: false, dive: false, action: false, reload: false, swap: false,
      throttle: 0, brake: 0,
    };
    for (const m of src.maps) {
      c.my += (this.anyKey(m.up) ? 1 : 0) - (this.anyKey(m.down) ? 1 : 0);
      c.mx += (this.anyKey(m.right) ? 1 : 0) - (this.anyKey(m.left) ? 1 : 0);
      c.turn += (this.anyKey(m.turnR) ? 1 : 0) - (this.anyKey(m.turnL) ? 1 : 0);
      c.fire ||= this.anyKey(m.fire);
      c.firePressed ||= this.anyPressed(m.fire);
      c.dive ||= this.anyPressed(m.dive);
      c.action ||= this.anyPressed(m.action);
      c.reload ||= this.anyPressed(m.reload);
      c.swap ||= this.anyPressed(m.swap);
      if (this.anyKey(m.up)) c.throttle = 1;
      if (this.anyKey(m.down)) c.brake = 1;
    }
    if (src.mouse) {
      c.mouseTurn += this.mouseDX * 0.0028;
      c.fire ||= this.mouseDown[0] && this.locked;
      c.firePressed ||= this.mousePressed[0] && this.locked;
    }
    for (const p of src.pads) {
      const ax = p.axes;
      const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
      c.mx += lx; c.my += -ly; c.turn += rx; c.look += -ry;
      if (this.btn(p, 12)) c.my += 1;
      if (this.btn(p, 13)) c.my -= 1;
      if (this.btn(p, 14)) c.mx -= 1;
      if (this.btn(p, 15)) c.mx += 1;
      const fireBtn = this.btn(p, 7) || this.btn(p, 5) || this.btn(p, 0);
      c.fire ||= fireBtn;
      c.firePressed ||= this.btnPressed(p, 7) || this.btnPressed(p, 5) || this.btnPressed(p, 0);
      c.dive ||= this.btnPressed(p, 1);
      c.action ||= this.btnPressed(p, 2);
      c.swap ||= this.btnPressed(p, 3);
      c.reload ||= this.btnPressed(p, 4);
      c.throttle = Math.max(c.throttle, p.buttons[7] || 0, this.btn(p, 0) ? 1 : 0, -ly > 0.3 ? 1 : 0);
      c.brake = Math.max(c.brake, p.buttons[6] || 0, this.btn(p, 1) ? 1 : 0, ly > 0.3 ? 1 : 0);
    }
    c.mx = Math.max(-1, Math.min(1, c.mx));
    c.my = Math.max(-1, Math.min(1, c.my));
    c.turn = Math.max(-1, Math.min(1, c.turn));
    return c;
  }

  // ---------- menu helpers (any device) ----------
  confirmPressed() {
    if (this.anyPressed(['Enter', 'Space', 'NumpadEnter'])) return true;
    if (this.mousePressed[0] && !this.locked) return true;
    return this.pads.some((p) => this.btnPressed(p, 0) || this.btnPressed(p, 9));
  }
  backPressed() {
    if (this.anyPressed(['Escape', 'Backspace'])) return true;
    return this.pads.some((p) => this.btnPressed(p, 1));
  }
  pausePressed() {
    if (this.anyPressed(['Escape', 'KeyP'])) return true;
    return this.pads.some((p) => this.btnPressed(p, 9));
  }
  navPressed() {
    let v = 0;
    if (this.anyPressed(['ArrowUp', 'KeyW'])) v = -1;
    if (this.anyPressed(['ArrowDown', 'KeyS'])) v = 1;
    for (const p of this.pads) {
      if (this.btnPressed(p, 12)) v = -1;
      if (this.btnPressed(p, 13)) v = 1;
      const prev = this.prevStick.get(p.id) || [0, 0];
      const y = p.axes[1] || 0;
      if (y < -0.6 && prev[1] >= -0.6) v = -1;
      if (y > 0.6 && prev[1] <= 0.6) v = 1;
    }
    return v;
  }
}
