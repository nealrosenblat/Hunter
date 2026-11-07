// PLACEHOLDER — the Vigor Body Temple shootout is still being built; this skips ahead.
import { Scene } from '../scene.js';
export class GymScene extends Scene {
  enter() { this.game.ui.fade(0, 0.3); this.run(async () => { await this.wait(0.5); this.game.next(); }); }
}
