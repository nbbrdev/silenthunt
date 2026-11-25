import { Observable, type Vector3 } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { GroundType } from "../world/terrain";

/** A sound in the world: whoever is within `radius` meters of `position` hears it (RF-10). */
export interface NoiseEvent {
  position: Vector3;
  radius: number;
  /** What made it, e.g. "step", "landing", "branch" (useful for AI reactions and debugging). */
  source: string;
}

/**
 * The noise system (M1-B): actions publish noise events here, and listeners (prey in NBB-138,
 * the creature in NBB-134, the HUD meter) react to them.
 */
export class NoiseSystem {
  readonly onNoise = new Observable<NoiseEvent>();
  /**
   * NBB-165 (CC5-A): how much of a noise made at a point carries (1 = all): next to a waterfall,
   * its roar covers half. Set by the game.
   */
  dampen: (position: Vector3) => number = () => 1;

  emit(position: Vector3, radius: number, source: string): void {
    const reach = radius * this.dampen(position);
    if (reach <= 0) {
      return;
    }
    this.onNoise.notifyObservers({ position: position.clone(), radius: reach, source });
  }
}

/** RF-11: movement noise is multiplied by the ground type (moss is quiet, leaves are loud). */
export function movementNoise(baseRadius: number, ground: GroundType): number {
  return baseRadius * CONFIG.noise.groundMultiplier[ground];
}
