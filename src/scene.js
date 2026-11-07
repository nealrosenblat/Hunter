import * as THREE from 'three';
import { disposeTree } from './util.js';

export const DEAD = Symbol('scene-dead');
export const SKIP = Symbol('scene-skip');

export class Scene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, game.aspect, 0.1, 1600);
    this.dead = false;
    this.pausable = false;
    this.skippable = false;
    this.skipping = false;
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
    if (this.skipping) throw SKIP;
    return r;
  }
  /**
   * Run a dialogue/cutscene script that the player can skip. On skip, the script is
   * aborted at its next await and onSkip() runs to put the scene in its end state.
   */
  async cut(fn, onSkip) {
    this.skippable = true;
    this.skipping = false;
    try {
      await fn();
    } catch (e) {
      if (e !== SKIP) throw e;
      this.skippable = false;
      this.skipping = false;
      this.game.ui.endSkip();
      if (onSkip) await onSkip();
    } finally {
      this.skippable = false;
      this.skipping = false;
      if (this.game.ui.hurrying) this.game.ui.endSkip();
    }
  }
  canSkip() { return this.skippable && !this.skipping && !this.dead; }
  /** Abort the running cutscene script. Scenes without a script override this. */
  skip() {
    if (!this.canSkip()) return;
    this.skipping = true;
    this.game.ui.hurry();
    this.game.flushTimers();
  }
  wait(s) { return this.w(this.game.wait(s)); }
  say(who, text, opts) { return this.w(this.game.ui.say(who, text, opts)); }
  run(fn) {
    fn().catch((e) => { if (e !== DEAD && e !== SKIP) console.error(e); });
  }
}
