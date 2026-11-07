import * as THREE from 'three';
import { Scene } from '../scene.js';
import { buildStreet } from '../env.js';
import { makeBrougham, Rig, SPECS } from '../models.js';
import { FX } from '../fx.js';

const credit = (who, big, as, side = 'left') =>
  `<div class="credit ${side}"><div class="who">${who}</div><div class="big">${big}</div>${as ? `<div class="as">${as}</div>` : ''}</div>`;

export class CreditsScene extends Scene {
  enter() {
    const g = this.game;
    buildStreet(this.scene, { time: 'sunset', zMin: -120, zMax: 320 });
    this.fx = new FX(this.scene, { lights: 0 });
    this.car = makeBrougham();
    this.scene.add(this.car.root);
    this.hammer = new Rig(SPECS.hammer);
    this.delgado = new Rig(SPECS.delgado);
    this.captain = new Rig(SPECS.captain);
    this.scene.add(this.hammer.root, this.delgado.root, this.captain.root);
    this.hammer.root.position.set(-8, 0.16, 60); this.hammer.root.rotation.y = Math.PI / 2;
    this.delgado.root.position.set(7.6, 0.16, 90); this.delgado.root.rotation.y = -Math.PI / 2;
    this.captain.root.position.set(-7.8, 0.16, 120); this.captain.root.rotation.y = Math.PI / 2;
    this.camera.fov = 55;
    g.audio.playSong('theme');
    g.ui.fade(0, 0.8);
    g.ui.L.hud.innerHTML = '<div class="skip">ENTER / A — SKIP</div><div id="credit"></div>';
    this.creditEl = g.ui.L.hud.querySelector('#credit');
    this.shotIdx = -1;
    this.done = false;
    this.cap = null;
    const C = this;
    this.shots = [
      {
        len: 4.6,
        start() { C.setCredit(`<div class="card-center"><div class="logo" style="transform:rotate(-4deg) scale(.8)"><span class="l1">HAMMER</span><span class="l2">&amp;</span><span class="l3">DELGADO</span></div></div>`); C.car.root.position.set(-3, 0, -80); },
        update(t) { C.camera.position.set(2, 0.8 + t * 0.4, -12 + t * 3); C.camera.lookAt(0, 8 + t, 40); },
      },
      {
        len: 4.4,
        start() { C.setCredit(credit('STARRING', 'CHET MANLY', '')); },
        update(t) {
          C.driveCar(-3, -30 + t * 22, 22);
          C.camera.position.set(1.2, 0.55, 42);
          const p = C.car.root.position;
          C.camera.lookAt(p.x, 0.9, p.z);
        },
      },
      {
        len: 3.6,
        start() { C.setCredit(credit('', 'CHET MANLY', 'as Det. Sgt. Rex Hammer')); C.game.audio.sfx('spin', 0.6); },
        update(t) {
          C.camera.position.set(-5.0 - t * 0.25, 1.85, 60.7);
          C.camera.lookAt(-8, 1.85, 60);
        },
      },
      {
        len: 3.6,
        start() { C.setCredit(credit('', 'VALERIE STARR', 'as Sgt. Dee Dee Delgado', 'right')); },
        update(t) {
          C.delgado.root.rotation.y = -Math.PI / 2 + Math.max(0, 0.9 - t * 1.5);
          C.camera.position.set(5.2 - t * 0.2, 1.72, 89.4);
          C.camera.lookAt(7.6, 1.66, 90);
        },
      },
      {
        len: 3.4,
        start() { C.setCredit(credit('WITH', 'BURT KOWALCZYK', 'as Capt. Lester Brannigan')); },
        update(t) {
          C.camera.position.set(-5.3, 1.7, 120.5);
          C.camera.lookAt(-7.8, 1.62, 120);
        },
      },
      {
        len: 4.6,
        start() { C.setCredit(credit('AND INTRODUCING', 'THE BROUGHAM', 'as Itself', 'right')); C.car.root.position.set(-3, 0, 110); },
        update(t) {
          C.driveCar(-3, 112 + t * 17, 17);
          if (t > 1.7 && !C.cap) C.dropHubcap();
          C.camera.position.set(5, 0.8, 148);
          C.camera.lookAt(-2, 0.8, 140);
        },
      },
      {
        len: 4.8,
        start() {
          C.setCredit(C.params.ep === 2
            ? `<div class="card-center"><div class="k">EPISODE 2</div><div class="t">DEATH WEARS LEG WARMERS</div></div>`
            : `<div class="card-center"><div class="k">EPISODE 1</div><div class="t">THE POLYESTER CONNECTION</div></div>`);
          C.hammer.root.position.set(-1.2, 0, 230); C.hammer.root.rotation.y = Math.PI;
          C.delgado.root.position.set(1.2, 0, 230.5); C.delgado.root.rotation.y = Math.PI;
          C.car.root.position.set(-3, 0, 245); C.car.root.rotation.y = 0.3;
        },
        update(t) {
          for (const r of [C.hammer, C.delgado]) r.root.position.z -= 1.0 * (1 / 60) * 60 * C.dt;
          const z = C.hammer.root.position.z;
          C.camera.position.set(0, 1.0, z - 6.5 + t * 0.3);
          C.camera.lookAt(0, 1.6, z);
        },
      },
    ];
    this.total = this.shots.reduce((a, s) => a + s.len, 0);
  }

  setCredit(html) { this.creditEl.innerHTML = html; }

  driveCar(x, z, v) {
    this.car.root.position.set(x, 0, z);
    this.car.root.rotation.y = 0;
    this.car.body.position.y = Math.sin(this.t * 13) * 0.02;
    for (const w of this.car.wheels) w.spin.rotation.x += (v / 0.36) * this.dt;
  }

  dropHubcap() {
    const w = this.car.wheels[1];
    const cap = w.hub;
    this.scene.attach(cap);
    this.cap = { m: cap, vx: 6, vz: 9, t: 0 };
    this.game.audio.sfx('clang');
  }

  canSkip() { return !this.done && this.t > 0.5; }
  skip() { this.finish(); }

  finish() {
    if (this.done) return;
    this.done = true;
    this.run(async () => {
      await this.w(this.game.ui.fade(1, 0.7));
      this.game.next();
    });
  }

  update(dt) {
    this.dt = dt;
    let acc = 0, idx = 0;
    for (; idx < this.shots.length; idx++) { if (this.t < acc + this.shots[idx].len) break; acc += this.shots[idx].len; }
    if (idx >= this.shots.length) { this.finish(); idx = this.shots.length - 1; acc = this.total - this.shots[idx].len; }
    if (idx !== this.shotIdx) { this.shotIdx = idx; this.shots[idx].start(); }
    this.shots[idx].update(this.t - acc);
    if (this.cap) {
      const c = this.cap;
      c.t += dt;
      c.m.position.x += c.vx * dt;
      c.m.position.z += c.vz * dt;
      c.vz *= Math.pow(0.4, dt);
      c.m.position.y = 0.25 + Math.abs(Math.sin(c.t * 9)) * 0.08 * Math.max(0, 2 - c.t);
      c.spin = (c.spin || 0) + dt * 14;
      const qw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(c.t * 7) * 0.3);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      const qs = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.spin);
      c.m.quaternion.copy(qw).multiply(qy).multiply(qs);
    }
    const walking = idx === 6;
    this.hammer.update(dt, { pose: walking ? 'idle' : 'gunUp', speed: walking ? 0.45 : 0 });
    this.delgado.update(dt, { pose: walking ? 'idle' : 'hips', speed: walking ? 0.45 : 0 });
    this.captain.update(dt, { pose: Math.floor(this.t * 1.2) % 2 ? 'raise' : 'point', talk: true });
    this.fx.update(dt);
    if (this.game.input.confirmPressed() && this.t > 0.5) this.finish();
  }
}
