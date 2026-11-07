// DOM overlay: dialogue boxes, menus, cards, toasts, subtitles, fades.

export const SPEAKERS = {
  captain: { name: 'CAPT. BRANNIGAN', color: '#c4511f', pitch: 92, wave: 'square' },
  hammer: { name: 'HAMMER', color: '#8a5a2c', pitch: 118, wave: 'square' },
  delgado: { name: 'DELGADO', color: '#d4307f', pitch: 235, wave: 'triangle' },
  duke: { name: 'THE DISCO DUKE', color: '#e0c060', pitch: 160, wave: 'sawtooth' },
  goon: { name: 'HENCHMAN', color: '#4b4b63', pitch: 140, wave: 'square' },
  worker: { name: 'GLASS GUY', color: '#2d6fa8', pitch: 150, wave: 'square' },
  narrator: { name: 'ANNOUNCER', color: '#222', pitch: 100, wave: 'triangle' },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    const names = ['scene', 'hud', 'letterbox', 'sub', 'dialog', 'toast', 'wfm', 'card', 'menu', 'fade'];
    this.root.innerHTML = names.map((n) => `<div id="layer-${n}"></div>`).join('');
    this.L = {};
    for (const n of names) this.L[n] = document.getElementById('layer-' + n);
    this.L.letterbox.id = 'letterbox';
    this.L.letterbox.innerHTML = '<div class="lb top"></div><div class="lb bot"></div>';
    this.L.fade.id = 'fade';
    this.dialog = null;
    this.menuState = null;
    this.subQueue = [];
  }

  get busy() { return !!this.dialog || !!this.menuState; }

  clearScene() {
    for (const n of ['scene', 'hud', 'sub', 'dialog', 'toast', 'wfm', 'card', 'menu']) this.L[n].innerHTML = '';
    this.letterbox(false);
    this.dialog = null;
    this.menuState = null;
  }

  // ---------------------------------------------------------- fades & bars
  fade(to, dur = 0.6) {
    const f = this.L.fade;
    f.style.transitionDuration = dur + 's';
    // force style flush so the transition runs
    void f.offsetWidth;
    f.style.opacity = String(to);
    return this.game.realWait(dur);
  }
  letterbox(on) { this.L.letterbox.classList.toggle('on', !!on); }

  // ---------------------------------------------------------- dialogue
  say(who, text, opts = {}) {
    return new Promise((resolve) => {
      const sp = SPEAKERS[who] || SPEAKERS.narrator;
      const el = document.createElement('div');
      el.className = 'dialog';
      el.innerHTML = `<div class="name" style="background:${sp.color}">${esc(opts.name || sp.name)}</div><div class="text"></div><div class="hint"></div><div class="next">▼</div>`;
      this.L.dialog.innerHTML = '';
      this.L.dialog.appendChild(el);
      this.dialog = { el, textEl: el.querySelector('.text'), next: el.querySelector('.next'), full: text, shown: 0, last: 0, age: 0, sp, resolve, done: false, onType: opts.onType };
      this.dialog.next.style.visibility = 'hidden';
      this.game.events.emit('say', who);
    });
  }
  advance() {
    const d = this.dialog;
    if (!d || d.age < 0.18) return;
    if (!d.done) { d.shown = d.full.length; return; }
    this.dialog = null;
    this.L.dialog.innerHTML = '';
    this.game.audio.sfx('menu', 0.6);
    d.resolve();
  }

  // ---------------------------------------------------------- non-blocking subtitles
  sub(who, text, dur = 3.2) {
    const sp = SPEAKERS[who] || SPEAKERS.narrator;
    const el = document.createElement('div');
    el.className = 'sub';
    el.innerHTML = `<b style="color:${sp.color === '#222' ? '#fff' : sp.color};-webkit-text-stroke:1px #000">${esc(sp.name)}</b>${esc(text)}`;
    this.L.sub.appendChild(el);
    while (this.L.sub.children.length > 3) this.L.sub.firstChild.remove();
    let n = Math.min(10, Math.ceil(text.length / 4));
    const blip = () => { if (n-- > 0 && el.isConnected) { this.game.audio.blip(sp.pitch, sp.wave); setTimeout(blip, 55); } };
    blip();
    setTimeout(() => el.remove(), dur * 1000);
  }

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    this.L.toast.appendChild(el);
    while (this.L.toast.children.length > 5) this.L.toast.firstChild.remove();
    setTimeout(() => el.remove(), 2600);
  }

  worksForMe(sub = '') {
    this.L.wfm.innerHTML = `<div class="wfm">WORKS<br>FOR ME.${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    const el = this.L.wfm.firstChild;
    setTimeout(() => el.remove(), 2100);
  }

  /** Typed location super, bottom-left, like the show's on-screen captions. */
  async locationCard(lines, hold = 2.2) {
    const el = document.createElement('div');
    el.className = 'card-loc';
    this.L.card.appendChild(el);
    const full = lines.join('\n');
    for (let i = 1; i <= full.length; i++) {
      el.textContent = full.slice(0, i);
      if (full[i - 1] !== ' ' && full[i - 1] !== '\n') this.game.audio.blip(900, 'square');
      await this.game.realWait(0.045);
    }
    await this.game.realWait(hold);
    el.remove();
  }

  async centerCard(kicker, title, hold = 2.6) {
    const el = document.createElement('div');
    el.className = 'card-center';
    el.innerHTML = `<div class="k">${esc(kicker)}</div><div class="t">${esc(title)}</div>`;
    this.L.card.appendChild(el);
    await this.game.realWait(hold);
    el.remove();
  }

  // ---------------------------------------------------------- menus
  /** items: [{label, value}] ; returns chosen value */
  menu(items, { title = '', text = '', cls = '', foot = '', html = '' } = {}) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'menu ' + cls;
      el.innerHTML = `${title ? `<h2>${esc(title)}</h2>` : ''}${text ? `<p>${text}</p>` : ''}${html}<div class="items">${items
        .map((it, i) => `<button data-i="${i}">${esc(it.label)}</button>`)
        .join('')}</div>${foot ? `<div class="foot">${foot}</div>` : ''}`;
      this.L.menu.innerHTML = '';
      this.L.menu.appendChild(el);
      const btns = [...el.querySelectorAll('button')];
      const st = (this.menuState = { el, items, btns, sel: 0, age: 0, resolve });
      const refresh = () => btns.forEach((b, i) => b.classList.toggle('sel', i === st.sel));
      st.refresh = refresh;
      refresh();
      btns.forEach((b, i) => {
        b.addEventListener('mouseenter', () => { if (st.sel !== i) { st.sel = i; refresh(); this.game.audio.sfx('menu', 0.5); } });
        b.addEventListener('mousedown', (e) => { e.stopPropagation(); st.sel = i; this.choose(); });
      });
    });
  }
  choose() {
    const st = this.menuState;
    if (!st) return;
    this.menuState = null;
    st.el.remove();
    this.game.audio.sfx('confirm');
    st.resolve(st.items[st.sel].value);
  }
  closeMenu() {
    if (this.menuState) { this.menuState.el.remove(); this.menuState = null; }
  }

  update(dt) {
    const input = this.game.input;
    const d = this.dialog;
    if (d) {
      d.age += dt;
      if (!d.done) {
        d.shown = Math.min(d.full.length, d.shown + dt * 48);
        const n = Math.floor(d.shown);
        if (n !== d.last) {
          for (let i = d.last; i < n; i++) if (i % 2 === 0 && /\w/.test(d.full[i])) this.game.audio.blip(d.sp.pitch, d.sp.wave);
          d.last = n;
          d.textEl.textContent = d.full.slice(0, n);
        }
        if (d.shown >= d.full.length) { d.done = true; d.textEl.textContent = d.full; d.next.style.visibility = 'visible'; }
      }
      const auto = this.game.debug.auto && d.done && d.age > 0.25 + d.full.length * 0.002;
      if (input.confirmPressed() || auto) this.advance();
      else if (d.done && input.pads.some((p) => input.btnPressed(p, 7))) this.advance();
    }
    const m = this.menuState;
    if (m) {
      m.age += dt;
      const nav = input.navPressed();
      if (nav) { m.sel = (m.sel + nav + m.items.length) % m.items.length; m.refresh(); this.game.audio.sfx('menu', 0.5); }
      if (m.age > 0.2 && (input.anyPressed(['Enter', 'Space', 'NumpadEnter']) || input.pads.some((p) => input.btnPressed(p, 0) || input.btnPressed(p, 9)))) this.choose();
    }
  }
}
