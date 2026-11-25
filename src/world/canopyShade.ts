import type { Scene, Vector3 } from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { Atmosphere } from "./atmosphere";
import type { ChunkManager } from "./chunks";

/**
 * NBB-169 (FL4-A): the canopy's shade. The more trees stand around the camera, the less daylight
 * reaches it: the dense pine forest and wood are darker, the clearings, the field and the marsh
 * brighter. It eases from one to the other as the player walks.
 */
export class CanopyShade {
  private readonly atmosphere: Atmosphere;
  private readonly chunks: ChunkManager;
  private readonly at: () => Vector3;
  private target = 0;
  private untilCount = 0;

  constructor(scene: Scene, atmosphere: Atmosphere, chunks: ChunkManager, at: () => Vector3) {
    this.atmosphere = atmosphere;
    this.chunks = chunks;
    this.at = at;
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  /** How closed the canopy is where the camera is now (0 to 1, eased). */
  get closed(): number {
    return this.atmosphere.canopy;
  }

  /** How closed the canopy is at a point (0 to 1, not eased). */
  closedAt(x: number, z: number): number {
    const { radius, fullTrees, youngWeight } = CONFIG.canopy;
    let weight = 0;
    for (const tree of this.chunks.treesNear(x, z, radius)) {
      weight += tree.young ? youngWeight : 1;
    }
    return Math.min(1, weight / fullTrees);
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    const { easeSeconds, everySeconds } = CONFIG.canopy;
    this.untilCount -= seconds;
    if (this.untilCount <= 0) {
      this.untilCount = everySeconds;
      const { x, z } = this.at();
      this.target = this.closedAt(x, z);
    }
    const now = this.atmosphere.canopy;
    this.atmosphere.canopy = now + (this.target - now) * Math.min(1, seconds / easeSeconds);
  }
}
