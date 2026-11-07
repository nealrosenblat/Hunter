// On-screen controls for phones and tablets.
// Left thumb: floating joystick. Right side: drag to turn. Buttons: fire, dive, kick/horn, reload, swap, pause.
// Touch always drives player 1.

const BUTTONS = [
  ['fire', 'FIRE'], ['dive', 'DIVE'], ['action', 'KICK'], ['reload', 'RELOAD'], ['swap', 'SWAP'],
];

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.used = false;
    this.mode = null;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.look = { id: null, lx: 0, dx: 0 };
    this.btn = {};
    this.prev = {};
    this.latch = {}; // presses that started this frame, even if already released
    const layer = (this.layer = document.createElement('div'));
    layer.id = 'layer-touch';
    layer.innerHTML = `
      <div class="tc tz-left"></div>
      <div class="tc tz-right"></div>
      <div class="tstick"><div class="knob"></div></div>
      <div class="tbtns">${BUTTONS.map(([b, l]) => `<button class="tc tb tb-${b}" data-b="${b}">${l}</button>`).join('')}</div>
      <button class="tc tpause" data-b="pause" aria-label="Pause">❚❚</button>
      <div class="thint"></div>`;
    // sit above the HUD, below dialogue and menus
    const ui = game.ui.root;
    ui.insertBefore(layer, ui.querySelector('#letterbox'));
    this.stickEl = layer.querySelector('.tstick');
    this.knob = layer.querySelector('.knob');
    this.hint = layer.querySelector('.thint');
    this.actBtn = layer.querySelector('.tb-action');

    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.used = true; }, { capture: true });

    const left = layer.querySelector('.tz-left');
    left.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null) return;
      left.setPointerCapture?.(e.pointerId);
      Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      this.stickEl.style.left = e.clientX + 'px';
      this.stickEl.style.top = e.clientY + 'px';
      this.stickEl.classList.add('on');
      this.knob.style.transform = '';
    });
    left.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      const R = 56;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.stick.x = dx / R;
      this.stick.y = -dy / R;
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const endStick = (e) => { if (e.pointerId === this.stick.id) this.resetStick(); };
    left.addEventListener('pointerup', endStick);
    left.addEventListener('pointercancel', endStick);

    const right = layer.querySelector('.tz-right');
    right.addEventListener('pointerdown', (e) => {
      if (this.look.id !== null) return;
      right.setPointerCapture?.(e.pointerId);
      this.look.id = e.pointerId;
      this.look.lx = e.clientX;
    });
    right.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.look.id) return;
      this.look.dx += e.clientX - this.look.lx;
      this.look.lx = e.clientX;
    });
    const endLook = (e) => { if (e.pointerId === this.look.id) this.look.id = null; };
    right.addEventListener('pointerup', endLook);
    right.addEventListener('pointercancel', endLook);

    for (const el of layer.querySelectorAll('[data-b]')) {
      const b = el.dataset.b;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); this.btn[b] = true; this.latch[b] = true; el.classList.add('down'); });
      const up = () => { this.btn[b] = false; el.classList.remove('down'); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    }
  }

  resetStick() {
    Object.assign(this.stick, { id: null, x: 0, y: 0 });
    this.stickEl.classList.remove('on');
  }
  reset() {
    this.resetStick();
    this.look.id = null;
    this.look.dx = 0;
    for (const k of Object.keys(this.btn)) this.btn[k] = false;
    for (const el of this.layer.querySelectorAll('.down')) el.classList.remove('down');
  }

  pressed(b) { return !!this.latch[b] || (!!this.btn[b] && !this.prev[b]); }
  held(b) { return !!this.btn[b] || !!this.latch[b]; }

  /** Called once per frame by the game with the scene's wanted mode: null | 'drive' | 'shoot'. */
  setMode(mode) {
    if (!this.used) mode = null;
    if (mode === this.mode) return;
    this.mode = mode;
    this.layer.className = mode || '';
    if (!mode) this.reset();
    this.hint.textContent = mode === 'drive' ? 'AUTO-GAS · LEFT THUMB STEERS · PULL BACK TO BRAKE · HOLD FIRE' : mode === 'shoot' ? 'LEFT THUMB MOVES · DRAG RIGHT SIDE TO TURN' : '';
  }

  endFrame() {
    Object.assign(this.prev, this.btn);
    this.latch = {};
    this.look.dx = 0;
  }
}
