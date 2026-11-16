import type { Obstacle } from "../world/chunks";

/** A point or direction on the ground (x and z; height is the terrain's business). */
export interface FlatVector {
  x: number;
  z: number;
}

/**
 * IA1 (steering): bends the wanted walking direction around the obstacles close ahead, the way
 * someone walking through a forest sidesteps trunks without planning the whole path. Returns a
 * unit direction. `desired` must be a unit direction.
 */
export function avoidObstacles(
  position: FlatVector,
  desired: FlatVector,
  obstacles: readonly Obstacle[],
  bodyRadius: number,
  avoidDistance: number,
): FlatVector {
  let steerX = 0;
  let steerZ = 0;
  for (const obstacle of obstacles) {
    const offsetX = obstacle.x - position.x;
    const offsetZ = obstacle.z - position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const clearance = distance - obstacle.radius - bodyRadius;
    if (clearance > avoidDistance) {
      continue;
    }
    // How far ahead the obstacle is along the wanted direction; ignore the ones behind.
    const ahead = offsetX * desired.x + offsetZ * desired.z;
    if (ahead < -obstacle.radius) {
      continue;
    }
    // Sideways away from the obstacle (perpendicular to the wanted direction).
    let awayX = -(offsetX - desired.x * ahead);
    let awayZ = -(offsetZ - desired.z * ahead);
    let awayLength = Math.hypot(awayX, awayZ);
    if (awayLength < 1e-3) {
      // Dead ahead: always dodge to the same side, so it does not hesitate between the two.
      awayX = desired.z;
      awayZ = -desired.x;
      awayLength = 1;
    }
    const urgency = 2 * (1 - Math.max(clearance, 0) / avoidDistance);
    steerX += (awayX / awayLength) * urgency;
    steerZ += (awayZ / awayLength) * urgency;
  }
  return normalized(desired.x + steerX, desired.z + steerZ, desired);
}

/** Moves `position` out of any obstacle it ended up inside (a safety net after moving). */
export function pushOutOfObstacles(
  position: FlatVector,
  obstacles: readonly Obstacle[],
  bodyRadius: number,
): FlatVector {
  let { x, z } = position;
  for (const obstacle of obstacles) {
    const offsetX = x - obstacle.x;
    const offsetZ = z - obstacle.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const minimum = obstacle.radius + bodyRadius;
    if (distance < minimum && distance > 1e-6) {
      x = obstacle.x + (offsetX / distance) * minimum;
      z = obstacle.z + (offsetZ / distance) * minimum;
    }
  }
  return { x, z };
}

/** Unit vector of (x, z), or `fallback` when it is too short to have a direction. */
export function normalized(x: number, z: number, fallback: FlatVector): FlatVector {
  const length = Math.hypot(x, z);
  return length < 1e-6 ? fallback : { x: x / length, z: z / length };
}
