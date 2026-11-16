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

  emit(position: Vector3, radius: number, source: string): void {
    if (radius <= 0) {
      return;
    }
    this.onNoise.notifyObservers({ position: position.clone(), radius, source });
  }
}

/** RF-11: movement noise is multiplied by the ground type (moss is quiet, leaves are loud). */
export function movementNoise(baseRadius: number, ground: GroundType): number {
  return baseRadius * CONFIG.noise.groundMultiplier[ground];
}
