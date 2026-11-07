// PLACEHOLDER — the undercover-aerobics rhythm scene is still being built; this skips ahead.
import { Scene } from '../scene.js';
export class AerobicsScene extends Scene {
  enter() { this.game.ui.fade(0, 0.3); this.run(async () => { await this.wait(0.5); this.game.next(); }); }
}
