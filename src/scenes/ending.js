import * as THREE from 'three';
import { Scene } from '../scene.js';
import { buildStreet } from '../env.js';
import { makeBrougham, Rig, SPECS } from '../models.js';

export class EndingScene extends Scene {
  enter() {
    const g = this.game;
    buildStreet(this.scene, { time: 'dusk', station: true, zMin: -100, zMax: 220 });
    const car = (this.car = makeBrougham());
    car.root.position.set(-4.4, 0, 14);
    this.scene.add(car.root);
    // the Brougham, as she is now
    const s = g.stats;
    car.wheels.forEach((w, i) => { if (i !== 2) w.hub.visible = false; });
    if (s.doorLost) car.door.visible = false;
    if (s.carDamage > 40) car.hood.rotation.x = -0.5;
    if (s.carDamage > 68) car.trunk.rotation.x = 0.6;
    if (s.carDamage > 76) car.bumperF.visible = false;
    this.ham = new Rig(SPECS.hammer);
    this.ham.root.position.set(-2.3, 0, 16.2); this.ham.root.rotation.y = Math.PI * 0.85;
    this.del = new Rig(SPECS.delgado);
    this.del.root.position.set(-2.0, 0, 13.1); this.del.root.rotation.y = -0.4;
    this.ham.gun.visible = this.del.gun.visible = false;
    this.scene.add(this.ham.root, this.del.root);
    this.poses = { ham: 'cross', del: 'hips' };
    this.talk = null;
    this.camera.fov = 48;
    this.camera.position.set(3.2, 1.6, 21.5);
    this.look = new THREE.Vector3(-3.0, 1.2, 14.2);
    this.frozen = false;
    this.cap = null;
    g.audio.playSong('office');
    this.run(() => this.script());
  }

  async script() {
    const g = this.game, ui = g.ui;
    await this.w(ui.fade(0, 0.9));
    await this.w(ui.locationCard(['OUTSIDE DIVISION 7', 'LATER THAT EVENING'], 1.0));
    this.talk = 'del';
    await this.say('delgado', "The Captain says the department's finally buying you a new car.");
    this.talk = 'ham';
    this.poses.ham = 'shrug';
    await this.say('hammer', "What's wrong with this one?");
    this.talk = null;
    this.poses.ham = 'cross';
    // the last hubcap gives up
    const hub = this.car.wheels[2].hub;
    this.scene.attach(hub);
    this.cap = { m: hub, t: 0 };
    g.audio.sfx('clang');
    await this.wait(1.4);
    this.poses.del = 'point';
    this.del.root.rotation.y = 0.9;
    await this.wait(0.4);
    this.talk = 'del';
    await this.say('delgado', 'Rex.');
    this.talk = 'ham';
    this.poses.ham = 'shrug';
    await this.say('hammer', 'She had four.');
    this.talk = null;
    this.poses = { ham: 'raise', del: 'hips' };
    this.del.root.rotation.y = -0.6;
    await this.wait(0.55);
    // FREEZE FRAME
    this.frozen = true;
    g.canvas.classList.add('freeze');
    g.audio.stopMusic(0.1);
    g.audio.sfx('freeze');
    await this.wait(1.4);
    this.roll();
  }

  roll() {
    const g = this.game, s = g.stats;
    const fruit = s.items['FRUIT CART'] || 0;
    g.ui.L.scene.innerHTML = `<div class="roll" id="roll">
      <div class="h">HAMMER &amp; DELGADO</div>
      <div>starring</div><div><b>CHET MANLY</b> · <b>VALERIE STARR</b></div>
      <div>with <b>BURT KOWALCZYK</b></div>
      <div>and <b>THE BROUGHAM</b> as Itself</div>
      <div class="h">GUEST STAR</div>
      <div>VINCENT "THE DISCO DUKE" MALONE as Himself (Allegedly)</div>
      <div class="h">ALSO FEATURING</div>
      <div>Henchmen #1–16 · Two Guys Carrying Glass · Gerald (a .44 Magnum)</div>
      <div>Fruit Cart Wrangler ........ Sal</div>
      <div>Day-for-Night Consultant ........ The Sun</div>
      <div>Shoulder Pads by ........ Structural Engineering, Inc.</div>
      <div class="h">IN MEMORIAM</div>
      <div>${s.hubcaps} hubcap${s.hubcaps === 1 ? '' : 's'}${s.doorLost ? ' · one passenger door' : ''} · ${fruit} fruit cart${fruit === 1 ? '' : 's'}</div>
      <div style="margin-top:1.4em;opacity:.8">Filmed on location in Los Angeles. No real persons, police departments, or roller rinks were depicted.</div>
      <div class="next">NEXT WEEK: "DEATH WEARS LEG WARMERS"</div>
      <div class="h" style="margin-top:2.2em">THANKS FOR WATCHING</div>
    </div>`;
    this.rollEl = g.ui.L.scene.querySelector('#roll');
    this.rollY = 0;
    g.audio.playSong('theme');
  }

  update(dt) {
    const g = this.game;
    if (this.rollEl) {
      this.rollY += dt * 52;
      const h = this.rollEl.offsetHeight + innerHeight;
      this.rollEl.style.transform = `translateY(${-this.rollY}px)`;
      if (this.rollY > h || (this.rollY > 1 && g.input.confirmPressed())) this.finish();
    }
    if (this.frozen) return;
    if (this.cap) {
      const c = this.cap;
      c.t += dt;
      c.m.position.x += dt * 2.6;
      c.m.position.z += dt * 1.6;
      c.m.position.y = 0.26;
      c.spin = (c.spin || 0) + dt * 10;
      const qw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(c.t * 6) * 0.2);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.0);
      const qs = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.spin);
      c.m.quaternion.copy(qw).multiply(qy).multiply(qs);
    }
    const dir = new THREE.Vector3().subVectors(this.look, this.camera.position).normalize();
    this.camera.position.addScaledVector(dir, dt * 0.12);
    this.camera.lookAt(this.look);
    this.ham.update(dt, { pose: this.poses.ham, talk: this.talk === 'ham' });
    this.del.update(dt, { pose: this.poses.del, talk: this.talk === 'del' });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.run(async () => {
      await this.w(this.game.ui.fade(1, 1));
      this.game.goto('title');
    });
  }
}
