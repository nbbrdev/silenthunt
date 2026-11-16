import type { Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import { movementNoise, type NoiseSystem } from "../systems/noise";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import type { Player } from "./player";

/**
 * The player's footsteps (NBB-131): each step is a noise event whose radius depends on the gait
 * (RF-10) and on the ground under the feet (RF-11). Steps come at the rhythm of NO3, landings
 * after a jump are noisy too, and stepping on a visible dry branch snaps it (NO4-B).
 */
export class Footsteps {
  private readonly player: Player;
  private readonly terrain: Terrain;
  private readonly chunks: ChunkManager;
  private readonly noise: NoiseSystem;
  private stepTimer = 0;

  constructor(
    scene: Scene,
    player: Player,
    terrain: Terrain,
    chunks: ChunkManager,
    noise: NoiseSystem,
  ) {
    this.player = player;
    this.terrain = terrain;
    this.chunks = chunks;
    this.noise = noise;

    player.onLanded.add(() => {
      this.noise.emit(this.player.feet, this.onGround(CONFIG.noise.radius.landing), "landing");
      this.checkBranch();
    });
    scene.onBeforeRenderObservable.add(() =>
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1)),
    );
  }

  /** Radius of the current gait on the current ground: what the HUD meter shows (RF-12). */
  currentRadius(): number {
    const { radius } = CONFIG.noise;
    switch (this.player.gait) {
      case "crouch":
        return this.onGround(radius.crouchStep);
      case "walk":
        return this.onGround(radius.walkStep);
      case "run":
        return this.onGround(radius.runStep);
      default:
        return 0;
    }
  }

  private update(seconds: number): void {
    const gait = this.player.gait;
    if (gait === "still") {
      // The first step comes half an interval after starting to move.
      this.stepTimer = 0.5;
      return;
    }
    const interval = CONFIG.noise.stepInterval[gait];
    this.stepTimer += seconds / interval;
    if (this.stepTimer >= 1) {
      this.stepTimer -= 1;
      this.noise.emit(this.player.feet, this.currentRadius(), "step");
      this.checkBranch();
    }
  }

  private checkBranch(): void {
    const feet = this.player.feet;
    if (this.chunks.stepOnBranch(feet.x, feet.z)) {
      // RF-11: a single loud crack, even when crouching.
      this.noise.emit(feet, CONFIG.noise.branchSnapRadius, "branch");
    }
  }

  private onGround(baseRadius: number): number {
    const feet = this.player.feet;
    return movementNoise(baseRadius, this.terrain.groundTypeAt(feet.x, feet.z));
  }
}
