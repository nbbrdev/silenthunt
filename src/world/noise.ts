import { hashPosition } from "../core/random";

/**
 * Smooth 2D noise in [0, 1] that never repeats: random values on a grid of whole numbers, blended
 * smoothly in between. The same (x, z, seed) always gives the same value, so the infinite world
 * is the same every time for the same seed.
 */
export function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const a = hashPosition(x0, z0, 0, seed);
  const b = hashPosition(x0 + 1, z0, 0, seed);
  const c = hashPosition(x0, z0 + 1, 0, seed);
  const d = hashPosition(x0 + 1, z0 + 1, 0, seed);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/** Fractal noise: several layers of `valueNoise`, each smaller and fainter. Result in [0, 1]. */
export function fractalNoise(x: number, z: number, seed: number, octaves = 4): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise(x * frequency, z * frequency, seed + octave * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
