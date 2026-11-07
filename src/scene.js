import * as THREE from 'three';
import { disposeTree } from './util.js';

export const DEAD = Symbol('scene-dead');

export class Scene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, game.aspect, 0.1, 1600);
    this.dead = false;
    this.pausable = false;
    this.t = 0;
  }
  enter() {}
  update() {}
  render() { this.game.renderView(this.scene, this.camera, 0, 0, 1, 1); }
  exit() {
    this.dead = true;
    disposeTree(this.scene);
  }
  /** Await a promise but abort the calling script if this scene has ended. */
  async w(p) {
    const r = await p;
    if (this.dead) throw DEAD;
    return r;
  }
  wait(s) { return this.w(this.game.wait(s)); }
  say(who, text, opts) { return this.w(this.game.ui.say(who, text, opts)); }
  run(fn) {
    fn().catch((e) => { if (e !== DEAD) console.error(e); });
  }
}
