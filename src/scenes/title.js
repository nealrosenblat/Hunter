import * as THREE from 'three';
import { Scene } from '../scene.js';
import { buildStreet } from '../env.js';
import { makeBrougham, Rig, SPECS } from '../models.js';
import { newStats } from '../stats.js';

export class TitleScene extends Scene {
  enter() {
    const g = this.game;
    buildStreet(this.scene, { time: 'sunset' });
    this.car = makeBrougham();
    this.car.root.position.set(-2.6, 0, 20);
    this.car.root.rotation.y = 0.15;
    this.scene.add(this.car.root);
    this.hammer = new Rig(SPECS.hammer);
    this.hammer.root.position.set(-0.8, 0, 21.6);
    this.hammer.root.rotation.y = -0.4;
    this.delgado = new Rig(SPECS.delgado);
    this.delgado.root.position.set(-0.6, 0, 19.2);
    this.delgado.root.rotation.y = -0.9;
    this.scene.add(this.hammer.root, this.delgado.root);
    this.camera.fov = 50;

    g.ui.L.scene.innerHTML = `
      <div class="title-wrap">
        <div class="logo"><span class="l1">HAMMER</span><span class="l2">&amp;</span><span class="l3">DELGADO</span></div>
        <div class="tagline">SEASON 1 · EPISODE 1 · "THE POLYESTER CONNECTION"</div>
      </div>
      <div class="press">PRESS START</div>
      <div class="legal">An affectionate parody of 1980s TV cop shows. All characters are fictional. No fruit carts were harmed. (Several were.)</div>`;
    g.ui.fade(0, 1.2);
    this.stage = 'press';
    if (g.audio.ctx) { g.audio.playSong('theme'); this.toMenu(); }
  }

  toMenu() {
    if (this.stage === 'menu') return;
    this.stage = 'menu';
    const press = this.game.ui.L.scene.querySelector('.press');
    if (press) press.remove();
    this.run(() => this.mainMenu());
  }

  async mainMenu() {
    const g = this.game;
    for (;;) {
      const c = await this.w(g.ui.menu(
        [
          { label: '1 PLAYER', value: 1 },
          { label: '2 PLAYERS · CO-OP', value: 2 },
          { label: 'SCENE SELECT', value: 'select' },
          { label: 'CONTROLS', value: 'controls' },
        ],
        { cls: 'low', foot: 'ARROWS / STICK + ENTER / A · MOUSE WORKS TOO' },
      ));
      if (c === 'controls') { await this.w(g.showControls()); continue; }
      if (c === 'select') {
        const sc = await this.w(g.ui.menu(
          [
            { label: 'COLD OPEN & CREDITS', value: 'credits' },
            { label: "THE CAPTAIN'S OFFICE", value: 'briefing' },
            { label: 'THE L.A. RIVER CHASE', value: 'chase' },
            { label: "THE DUKE'S WAREHOUSE", value: 'warehouse' },
            { label: 'BACK', value: null },
          ],
          { cls: 'low', title: 'SCENE SELECT' },
        ));
        if (!sc) continue;
        const pl = await this.w(g.ui.menu([{ label: '1 PLAYER', value: 1 }, { label: '2 PLAYERS · CO-OP', value: 2 }], { cls: 'low' }));
        return this.start(pl, sc);
      }
      return this.start(c, 'credits');
    }
  }

  async start(players, scene) {
    const g = this.game;
    g.mode = players;
    g.stats = newStats();
    await this.w(g.ui.fade(1, 0.6));
    g.goto(scene);
  }

  update(dt) {
    const g = this.game;
    if (this.stage === 'press') {
      const inp = g.input;
      if (inp.pressed.size || inp.mousePressed[0] || inp.pads.some((p) => p.buttons.some((b, i) => inp.btnPressed(p, i)))) {
        g.audio.init();
        g.audio.playSong('theme');
        g.audio.sfx('confirm');
        this.toMenu();
      }
    }
    const a = this.t * 0.12;
    const c = new THREE.Vector3(-1.6, 1.3, 20.4);
    this.camera.position.set(c.x + Math.sin(a) * 9, 2.2 + Math.sin(this.t * 0.3) * 0.3, c.z + Math.cos(a) * 9);
    this.camera.lookAt(c.x, 2.4, c.z);
    this.hammer.update(dt, { pose: 'cross' });
    this.delgado.update(dt, { pose: 'hips' });
  }
}
