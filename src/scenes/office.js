import * as THREE from 'three';
import { Scene } from '../scene.js';
import { Rig, SPECS, M, B, box, cyl, texMat } from '../models.js';
import { tex } from '../textures.js';
import { makeSign } from '../env.js';
import { grade, GRADE_LINES, GRADE_LINES_2 } from '../stats.js';
import { fmtMoney, fmtTime } from '../util.js';

const SHOTS = {
  wide: [[0, 2.15, 3.3], [0, 1.25, -1.8]],
  captain: [[0.05, 1.68, 1.0], [0, 1.6, -2.9]],
  closeCap: [[0.1, 1.66, -1.0], [0, 1.62, -2.9]],
  hammer: [[-0.15, 1.78, -1.3], [-0.75, 1.86, 0.3]],
  delgado: [[0.15, 1.66, -1.3], [0.75, 1.66, 0.3]],
  duo: [[0, 1.62, -1.75], [0, 1.6, 0.3]],
};

export class OfficeScene extends Scene {
  enter() {
    const g = this.game;
    this.build();
    this.cap = new Rig(SPECS.captain);
    this.cap.root.position.set(0, 0, -2.9);
    this.ham = new Rig(SPECS.hammer);
    this.ham.root.position.set(-0.75, 0, 0.3); this.ham.root.rotation.y = Math.PI;
    this.del = new Rig(SPECS.delgado);
    this.del.root.position.set(0.75, 0, 0.3); this.del.root.rotation.y = Math.PI;
    this.scene.add(this.cap.root, this.ham.root, this.del.root);
    this.ham.gun.visible = false; this.del.gun.visible = false;
    this.rigs = { captain: this.cap, hammer: this.ham, delgado: this.del };
    this.poses = { captain: 'idle', hammer: 'idle', delgado: 'cross' };
    this.talking = null;
    this.camera.fov = 52;
    this.setShot('wide');
    this.pausable = true;
    this.ep = this.params.ep === 2 ? 2 : 1;
    if (this.ep === 2) {
      // Accounting gave ONE chair back. It goes to whoever closes the case.
      const seat = box(0.55, 0.08, 0.5, M(0x7a2a2a)); seat.position.set(0, 0.48, -0.8); this.scene.add(seat);
      const back = box(0.55, 0.6, 0.08, M(0x7a2a2a)); back.position.set(0, 0.8, -1.03); this.scene.add(back);
      for (const [x, z] of [[-0.23, -0.6], [0.23, -0.6], [-0.23, -1.0], [0.23, -1.0]]) { const leg = box(0.04, 0.46, 0.04, M(0x333333)); leg.position.set(x, 0.23, z); this.scene.add(leg); }
    }
    g.audio.playSong('office');
    this.run(() => (this.params.mode === 'verdict' ? this.verdict() : this.briefing()));
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x120c08);
    s.add(new THREE.HemisphereLight(0xffe2c0, 0x4a3020, 1.6));
    const win = new THREE.DirectionalLight(0xffa860, 1.8);
    win.position.set(0.5, 2.5, -6);
    s.add(win);
    const lamp = new THREE.PointLight(0xfff0d0, 6, 9, 1.4);
    lamp.position.set(0, 2.8, 0);
    s.add(lamp);
    const W = 8, D = 7, H = 3;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), texMat('carpet', 6, 5));
    floor.rotation.x = -Math.PI / 2; s.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), texMat('ceiling', 8, 7));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; s.add(ceil);
    const light = box(1.2, 0.04, 0.6, B(0xfff6dd)); light.position.set(0, H - 0.03, 0); s.add(light);
    const wall = (w, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), texMat('panel', w / 2, 1.5));
      m.position.set(x, H / 2, z); m.rotation.y = ry; s.add(m); return m;
    };
    wall(W, 0, -D / 2, 0); wall(W, 0, D / 2, Math.PI); wall(D, -W / 2, 0, Math.PI / 2); wall(D, W / 2, 0, -Math.PI / 2);
    // window with blinds behind the captain
    const blinds = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), new THREE.MeshBasicMaterial({ map: tex('blinds') }));
    blinds.position.set(0, 1.75, -D / 2 + 0.02); s.add(blinds);
    const sill = box(3.6, 0.08, 0.2, M(0x4a2c14)); sill.position.set(0, 0.98, -D / 2 + 0.1); s.add(sill);
    // desk
    const desk = box(2.5, 0.08, 1.15, texMat('wood')); desk.position.set(0, 0.8, -2.05); s.add(desk);
    const front = box(2.5, 0.76, 0.06, texMat('wood')); front.position.set(0, 0.4, -1.5); s.add(front);
    for (const sx of [-1.2, 1.2]) { const side = box(0.06, 0.76, 1.1, texMat('wood')); side.position.set(sx, 0.4, -2.05); s.add(side); }
    const plate = makeSign('CAPT. L. BRANNIGAN', { w: 0.7, h: 0.12, bg: '#2a1a0a', fg: '#e8c870', font: 'bold 26px serif' });
    plate.position.set(0, 0.92, -1.56); plate.rotation.x = -0.3; s.add(plate);
    const phone = box(0.26, 0.1, 0.2, M(0xb01a1a)); phone.position.set(-0.85, 0.89, -1.9); s.add(phone);
    const lampBase = cyl(0.08, 0.1, 0.04, 8, M(0x8a6a2a)); lampBase.position.set(0.95, 0.86, -2.3); s.add(lampBase);
    const lampPole = cyl(0.015, 0.015, 0.36, 4, M(0x8a6a2a)); lampPole.position.set(0.95, 1.04, -2.3); s.add(lampPole);
    const shade = box(0.42, 0.1, 0.16, M(0x1a6a3a, { emissive: 0x0a2a14 })); shade.position.set(0.95, 1.24, -2.2); s.add(shade);
    const papers = box(0.5, 0.06, 0.36, M(0xf2efe2)); papers.position.set(0.2, 0.87, -1.85); papers.rotation.y = 0.2; s.add(papers);
    const folder = box(0.38, 0.03, 0.28, M(0xd8b870)); folder.position.set(-0.35, 0.86, -1.75); folder.rotation.y = -0.3; s.add(folder);
    const mug = cyl(0.05, 0.05, 0.11, 8, M(0xffffff)); mug.position.set(0.55, 0.9, -1.7); s.add(mug);
    const ashtray = cyl(0.09, 0.07, 0.03, 8, M(0x777777)); ashtray.position.set(-0.55, 0.85, -2.35); s.add(ashtray);
    // chair behind desk
    const chair = box(0.7, 1.1, 0.12, M(0x2a1a10)); chair.position.set(0, 1.05, -3.25); s.add(chair);
    // filing cabinets, plant, board, flag-ish
    for (const sx of [-3.4, 3.4]) {
      const fc = box(0.6, 1.4, 0.7, M(0x6a7066)); fc.position.set(sx, 0.7, -2.9); s.add(fc);
      for (let i = 0; i < 3; i++) { const h = box(0.18, 0.04, 0.02, M(0xcccccc)); h.position.set(sx, 0.3 + i * 0.45, -2.54); s.add(h); }
    }
    const pot = cyl(0.22, 0.18, 0.4, 8, M(0x9a5a2a)); pot.position.set(-3.5, 0.2, 3.0); s.add(pot);
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), M(0x3a7a2a, { flatShading: true })); plant.position.set(-3.5, 0.95, 3.0); plant.scale.y = 1.4; s.add(plant);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshLambertMaterial({ map: tex('wantedBoard') }));
    board.position.set(-W / 2 + 0.02, 1.7, -0.5); board.rotation.y = Math.PI / 2; s.add(board);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshLambertMaterial({ map: tex('frame') }));
    frame.position.set(W / 2 - 0.02, 1.8, -1.2); frame.rotation.y = -Math.PI / 2; s.add(frame);
    const cooler = box(0.4, 1.2, 0.4, M(0xdedede)); cooler.position.set(3.4, 0.6, 2.6); s.add(cooler);
    const jug = cyl(0.17, 0.17, 0.42, 8, M(0x8ac8ff, { transparent: true, opacity: 0.7 })); jug.position.set(3.4, 1.42, 2.6); s.add(jug);
  }

  setShot(name) {
    const [p, l] = SHOTS[name];
    this.camera.position.set(...p);
    this.look = new THREE.Vector3(...l);
    this.shotName = name;
    this.shotT = 0;
  }

  async line(who, text, shot, poses = {}, sfx = null) {
    if (shot) this.setShot(shot);
    Object.assign(this.poses, poses);
    if (sfx) this.game.audio.sfx(sfx);
    this.talking = who;
    await this.say(who, text);
    this.talking = null;
  }

  async briefing() {
    const g = this.game;
    await this.cut(() => this.briefingLines(), async () => {
      g.audio.stopMusic(0.4);
      await this.w(g.ui.fade(1, 0.4));
      g.next();
    });
  }

  async briefingLines() {
    if (this.ep === 2) return this.briefingLines2();
    const g = this.game;
    await this.w(g.ui.fade(0, 0.8));
    await this.w(g.ui.locationCard(['METRO POLICE · DIVISION 7', "CAPTAIN BRANNIGAN'S OFFICE", '8:15 PM']));
    await this.line('captain', 'Hammer. Delgado. Sit down.', 'wide');
    await this.line('hammer', "We'll stand, Captain.", 'duo');
    await this.line('captain', "You'll stand because there ARE no chairs. Accounting sold them to cover your last car chase.", 'captain', { captain: 'point' });
    await this.line('captain', 'Somebody is flooding this city with counterfeit designer jeans. Fake labels. Real polyester.', 'captain', { captain: 'idle' });
    await this.line('delgado', "Vincent Malone. \"The Disco Duke.\" He runs the Starlight Roller Palace on Figueroa.", 'delgado', { delgado: 'hips' });
    await this.line('captain', 'Downtown wants him. Downtown wants him CLEAN. No shootouts. No explosions. No property damage.', 'closeCap', { captain: 'slam' }, 'thump');
    this.poses.captain = 'idle';
    await this.line('hammer', "...Define 'property.'", 'hammer', { hammer: 'shrug' });
    await this.line('captain', "ONE more fruit cart, Hammer, and it's your BADGE!", 'captain', { captain: 'raise', hammer: 'idle' });
    await this.line('hammer', 'That fruit cart came out of nowhere.', 'hammer', { captain: 'idle' });
    await this.line('captain', 'IT WAS INSIDE A MALL.', 'closeCap', { captain: 'slam' }, 'thump');
    await this.line('delgado', "Captain, our informant says the Duke is moving a shipment tonight. If we leave now, we can catch him at the rink.", 'delgado', { captain: 'idle', delgado: 'cross' });
    await this.line('captain', "Then go. And take the Brougham. Motor pool won't give you anything else.", 'captain', { captain: 'point' });
    await this.line('delgado', "They specifically said \"anything.\"", 'delgado');
    this.poses.hammer = 'gunUp';
    this.ham.gun.visible = true;
    this.setShot('hammer');
    g.audio.sfx('spin', 0.7);
    await this.wait(0.7);
    await this.line('hammer', 'Works for me.', 'hammer');
    g.audio.sfx('wfm');
    g.ui.worksForMe();
    await this.wait(1.6);
    g.audio.stopMusic(0.6);
    await this.w(g.ui.fade(1, 0.6));
    g.next();
  }

  async verdict() {
    const g = this.game;
    await this.cut(() => this.verdictLines(), () => {
      g.ui.fade(0, 0.2);
      this.poses.captain = 'idle';
      this.poses.hammer = 'idle';
      this.talking = null;
    });
    const gr = grade(g.stats);
    this.setShot('wide');
    await this.showCard(gr);
    g.audio.stopMusic(0.8);
    await this.w(g.ui.fade(1, 0.7));
    g.next();
  }

  async briefingLines2() {
    const g = this.game;
    await this.w(g.ui.fade(0, 0.8));
    await this.w(g.ui.locationCard(['METRO POLICE · DIVISION 7', "CAPTAIN BRANNIGAN'S OFFICE", '7:40 PM']));
    await this.line('captain', 'Sit down.', 'wide');
    await this.line('delgado', '...Captain. There is a chair.', 'duo', { delgado: 'point' });
    await this.line('captain', 'Accounting gave me back ONE chair. It goes to whoever closes this case.', 'captain', { captain: 'point', delgado: 'cross' });
    await this.line('hammer', "I'll stand. Builds character.", 'hammer', { captain: 'idle', hammer: 'cross' });
    await this.line('captain', 'Morty Feldman. Accountant. Found this morning in the sauna of the Vigor Body Temple, Venice Beach.', 'captain');
    await this.line('captain', 'Strangled. With a LEG WARMER.', 'closeCap', { captain: 'slam' }, 'thump');
    this.poses.captain = 'idle';
    await this.line('hammer', '...What color?', 'hammer', { hammer: 'idle' });
    await this.line('captain', 'PINK, Hammer. Does it MATTER?', 'captain', { captain: 'raise' });
    await this.line('hammer', 'It matters to the leg warmer.', 'hammer', { captain: 'idle', hammer: 'shrug' });
    await this.line('delgado', "Feldman kept the books for Rick Vigor. 'Feel the Vigor.' He sells lifetime memberships on TV at three in the morning.", 'delgado', { delgado: 'hips', hammer: 'idle' });
    await this.line('captain', "Downtown thinks Vigor's washing mob money through those memberships. Nine thousand dollars apiece. Nobody ever shows up to use them.", 'captain', { captain: 'point' });
    await this.line('delgado', 'Vigor runs a Power Hour class tonight. I go in undercover.', 'delgado', { captain: 'idle', delgado: 'cross' });
    await this.line('captain', 'Good. Hammer goes with you.', 'captain', { captain: 'point' });
    await this.line('hammer', 'Undercover. In an aerobics class.', 'hammer', { hammer: 'shrug' });
    await this.line('captain', 'In SWEATPANTS, Hammer. And leave the cannon at home.', 'closeCap', { captain: 'raise', hammer: 'idle' });
    this.poses.captain = 'idle';
    this.poses.hammer = 'gunUp';
    this.ham.gun.visible = true;
    g.audio.sfx('spin', 0.7);
    await this.line('hammer', 'Gerald goes where I go.', 'hammer');
    await this.line('delgado', 'Rex. Where exactly are you going to hide a .44 Magnum in a pair of sweatpants?', 'delgado', { delgado: 'hips' });
    this.setShot('hammer');
    await this.wait(0.7);
    await this.line('hammer', 'Works for me.', 'hammer');
    g.audio.sfx('wfm');
    g.ui.worksForMe();
    await this.wait(1.6);
    g.audio.stopMusic(0.6);
    await this.w(g.ui.fade(1, 0.6));
    g.next();
  }

  async verdictLines2() {
    const g = this.game;
    const s = g.stats;
    const fruit = s.items['FRUIT CART'] || 0;
    await this.w(g.ui.fade(0, 0.8));
    await this.w(g.ui.locationCard(['METRO POLICE · DIVISION 7', 'THE NEXT MORNING']));
    await this.line('captain', 'Sit down. ...Not you, Hammer.', 'wide');
    await this.line('captain', 'Rick Vigor is in custody. Murder one, money laundering, and fourteen counts of false advertising.', 'captain');
    const dg = s.danceGrade || 'C';
    await this.line('captain', `I also have a report from a Miss Candi Kane, aerobics instructor. She gave your class performance a ${dg}.`, 'closeCap', { captain: 'point' });
    if (dg <= 'B') await this.line('captain', 'She wants to know if Delgado teaches on weekends.', 'captain', { captain: 'idle' });
    else await this.line('captain', "She says, and I quote, 'the big one moves like a filing cabinet falling down a staircase.'", 'captain', { captain: 'idle' });
    await this.line('hammer', 'I was undercover.', 'hammer', { hammer: 'shrug' });
    this.poses.hammer = 'idle';
    if (fruit > 0) {
      await this.line('captain', `${fmtMoney(s.collateral)} in damages. Including ${fruit === 1 ? 'ONE FRUIT CART' : fruit + ' FRUIT CARTS'}. ON A BEACH.`, 'closeCap', { captain: 'raise' });
      await this.line('hammer', 'Technically it was a boardwalk.', 'hammer', { captain: 'idle', hammer: 'cross' });
    } else if (s.collateral > 2500) {
      await this.line('captain', `${fmtMoney(s.collateral)} in damages, Hammer. Surfboards. Hot dogs. A palm tree that was older than I am.`, 'captain', { captain: 'point' });
      await this.line('hammer', 'It had a good run.', 'hammer', { captain: 'idle' });
    } else {
      await this.line('captain', `Only ${fmtMoney(s.collateral)} in damages. Delgado, was he driving?`, 'captain');
      await this.line('delgado', 'He was, Captain. I was surprised too.', 'delgado');
    }
    await this.line('captain', `The Brougham needs ${fmtMoney(s.repair)} in repairs. AGAIN.`, 'captain');
    await this.line('delgado', s.doorLost ? 'The new door fell off, Captain. The NEW one.' : "She's still got the primer door. It's growing on me.", 'delgado', { delgado: 'cross' });
    await this.line('captain', `And Delgado. Taken hostage. Again. That's ${s.hostage}.`, 'captain', { captain: 'point' });
    await this.line('delgado', "At this point it's basically cardio.", 'delgado', { delgado: 'hips' });
    await this.line('captain', 'Delgado. The chair is yours.', 'closeCap', { captain: 'idle' });
    await this.line('hammer', 'What do I get?', 'hammer', { hammer: 'shrug' });
    const hot = s.items['HOT DOG STAND'];
    await this.line('captain', hot ? 'You get the bill for the hot dog stand.' : 'You get to stand. Builds character.', 'captain', { captain: 'point', hammer: 'idle' });
    const gr = grade(s);
    await this.line('captain', GRADE_LINES_2[gr.letter], 'captain', { captain: gr.letter <= 'B' ? 'idle' : 'raise' });
    this.poses.captain = 'idle';
  }

  async verdictLines() {
    if (this.ep === 2) return this.verdictLines2();
    const g = this.game;
    const s = g.stats;
    const fruit = s.items['FRUIT CART'] || 0;
    await this.w(g.ui.fade(0, 0.8));
    await this.w(g.ui.locationCard(['METRO POLICE · DIVISION 7', 'THE NEXT MORNING']));
    await this.line('captain', 'Sit down.', 'wide');
    await this.line('delgado', 'There are still no chairs, Captain.', 'duo');
    await this.line('captain', 'I KNOW there are no chairs, Delgado.', 'closeCap', { captain: 'slam' }, 'thump');
    this.poses.captain = 'idle';
    await this.line('captain', 'The Disco Duke is in custody. Twelve thousand pairs of counterfeit jeans are off the street. Downtown is... pleased.', 'captain');
    if (fruit > 0) {
      await this.line('captain', `I also have a bill here for ${fmtMoney(s.collateral)} in damages. Including, and I want you to really hear me, ${fruit === 1 ? 'ONE FRUIT CART' : fruit + ' FRUIT CARTS'}.`, 'closeCap', { captain: 'raise' });
      await this.line('hammer', 'In my defense, Captain, that one was in a river.', 'hammer', { captain: 'idle', hammer: 'shrug' });
    } else if (s.collateral > 2500) {
      await this.line('captain', `I also have a bill here for ${fmtMoney(s.collateral)} in damages. No fruit carts, at least. Small mercies.`, 'captain', { captain: 'point' });
      await this.line('hammer', "I'm pacing myself.", 'hammer', { captain: 'idle' });
    } else {
      await this.line('captain', `And only ${fmtMoney(s.collateral)} in property damage. Hammer, are you feeling all right?`, 'captain');
      await this.line('hammer', 'Must be coming down with something.', 'hammer');
    }
    this.poses.hammer = 'idle';
    await this.line('captain', `Motor pool says the Brougham needs ${fmtMoney(s.repair)} in repairs.`, 'captain');
    await this.line('hammer', "She's fine. She's got character.", 'hammer', { hammer: 'cross' });
    await this.line('captain', s.doorLost ? 'She has NO PASSENGER DOOR, Hammer.' : "She's got smoke coming out of the GLOVEBOX.", 'closeCap', { captain: 'raise' });
    this.poses.captain = 'idle';
    await this.line('captain', `And Delgado. You were taken hostage. Again. That's ${s.hostage} times this season.`, 'captain', { captain: 'point' });
    await this.line('delgado', "I'm aware, Captain. I'm handling it.", 'delgado', { delgado: 'hips' });
    const gr = grade(s);
    await this.line('captain', GRADE_LINES[gr.letter], 'captain', { captain: gr.letter <= 'B' ? 'idle' : 'raise' });
    this.poses.captain = 'idle';
  }

  showCard(gr) {
    const s = this.game.stats;
    const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
    const items = Object.entries(s.items).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => `<tr><td>&nbsp;&nbsp;· ${k.toLowerCase()}</td><td>×${v}</td></tr>`).join('');
    const total = s.chaseTime + s.warehouseTime;
    this.game.ui.L.scene.innerHTML = `
      <div class="verdict">
        <div class="stamp">${gr.letter}</div>
        <h2>CASE FILE #${this.ep === 2 ? '86-0522' : '86-0417'}</h2>
        <div class="case">${this.ep === 2 ? '"DEATH WEARS LEG WARMERS" · PEOPLE v. RICHARD "RICK" VIGOR' : '"THE POLYESTER CONNECTION" · PEOPLE v. VINCENT "THE DISCO DUKE" MALONE'}</div>
        <table>
          <tr><td>Time on the case</td><td>${fmtTime(total)}</td></tr>
          <tr><td>Shots fired (accuracy)</td><td>${s.shots} (${acc}%)</td></tr>
          <tr><td>Henchmen "apprehended"</td><td>${s.kills}</td></tr>
          <tr><td>Henchman shots fired at you / that hit</td><td>${s.henchShots} / ${s.henchHits}</td></tr>
          <tr><td>Collateral damage</td><td>${fmtMoney(s.collateral)}</td></tr>
          ${items}
          <tr><td>Brougham repair bill</td><td>${fmtMoney(s.repair)}</td></tr>
          ${this.ep === 2 ? `<tr><td>Aerobics class grade (C. Kane)</td><td>${s.danceGrade || '—'} · best combo ${s.danceBest || 0}</td></tr>` : ''}
          <tr><td>${this.ep === 2 ? "Vigor's car wrecked" : "Duke's car wrecked"}</td><td>${s.dukeWrecked ? 'YES' : 'NO'}</td></tr>
          <tr><td>"Works for me" moments</td><td>${s.wfm}</td></tr>
          <tr><td>Donuts eaten (evidence)</td><td>${s.donuts}</td></tr>
          <tr><td>Doors kicked / opened politely</td><td>${s.kicked} / ${s.polite}</td></tr>
          <tr><td>Times an officer went down</td><td>${s.downs}</td></tr>
          <tr><td>Partner taken hostage this season</td><td>${s.hostage}</td></tr>
          <tr><td>Horn honks (unnecessary)</td><td>${s.horn}</td></tr>
        </table>
        <div class="quote">Captain's grade: ${gr.letter}. "${(this.ep === 2 ? GRADE_LINES_2 : GRADE_LINES)[gr.letter]}"</div>
        <div class="cont">PRESS ENTER / A</div>
      </div>`;
    this.game.audio.sfx('thump');
    return this.w(new Promise((r) => { this.confirmAt = this.t + 0.8; this._confirm = r; }));
  }

  update(dt) {
    if (this._confirm && this.t > this.confirmAt && this.game.input.confirmPressed()) {
      const r = this._confirm; this._confirm = null;
      this.game.ui.L.scene.innerHTML = '';
      this.game.audio.sfx('confirm');
      r();
    }
    this.shotT += dt;
    // slow TV push-in on every shot
    const dir = new THREE.Vector3().subVectors(this.look, this.camera.position).normalize();
    this.camera.position.addScaledVector(dir, dt * 0.06);
    this.camera.lookAt(this.look);
    for (const [k, r] of Object.entries(this.rigs)) {
      r.update(dt, { pose: this.poses[k], talk: this.talking === k });
    }
    if (this.poses.captain === 'slam' && this.shotT > 0.25) this.cap.torso.rotation.x = 0.35 + Math.sin(this.t * 30) * 0.02;
  }
}
