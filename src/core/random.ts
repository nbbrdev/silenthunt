/**
 * Deterministic pseudo-random generator (mulberry32): the same seed always gives the same
 * sequence. Used by the procedural models and, later, by the world generation.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random number in [min, max) taken from `random`. */
export function randomRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

/** Random value in a [min, max] range given as a pair (e.g. from CONFIG.models). */
export function randomInRange(random: () => number, range: readonly [number, number]): number {
  return randomRange(random, range[0], range[1]);
}

/** Random whole number from min to max, both included. */
export function randomInt(random: () => number, range: readonly [number, number]): number {
  return range[0] + Math.floor(random() * (range[1] - range[0] + 1));
}

/**
 * Deterministic value in [0, 1) for a point in space: the same (x, y, z, seed) always gives the
 * same value. Used so vertices that share a position move and color together (no cracks).
 */
export function hashPosition(x: number, y: number, z: number, seed: number): number {
  const xi = Math.round(x * 1000);
  const yi = Math.round(y * 1000);
  const zi = Math.round(z * 1000);
  let h =
    (seed ^ Math.imul(xi, 0x27d4eb2d) ^ Math.imul(yi, 0x165667b1) ^ Math.imul(zi, 0x9e3779b1)) >>>
    0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
