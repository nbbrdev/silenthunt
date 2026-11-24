import { CONFIG } from "../config";
import { hashPosition } from "../core/random";
import { cabinsNear } from "./cabinSites";
import { fractalNoise } from "./noise";

/** BI1 (NBB-163): the five biomes. */
export type Biome = "pineForest" | "broadleaf" | "marsh" | "field" | "ridge";

export const BIOMES: readonly Biome[] = ["pineForest", "broadleaf", "marsh", "field", "ridge"];

/** BM6-A: each biome's name, as the player reads it. */
export const BIOME_NAMES: Record<Biome, string> = {
  pineForest: "Pinheiral",
  broadleaf: "Bosque",
  marsh: "Pântano",
  field: "Campo aberto",
  ridge: "Serra",
};

/** How much of each biome a point has (they add up to 1; two at most, at a border). */
export type BiomeWeights = Record<Biome, number>;

function only(biome: Biome): BiomeWeights {
  const weights: BiomeWeights = { pineForest: 0, broadleaf: 0, marsh: 0, field: 0, ridge: 0 };
  weights[biome] = 1;
  return weights;
}

/** The biome a cell of the grid draws from the seed, by the shares of BM2-A. */
function cellBiome(gx: number, gz: number, seed: number): Biome {
  const roll = hashPosition(gx, gz, 0, seed + 9201);
  const { shares } = CONFIG.biomes;
  let sum = 0;
  for (const biome of BIOMES) {
    sum += shares[biome];
    if (roll < sum) {
      return biome;
    }
  }
  return "pineForest";
}

/**
 * BI2-A, BM8 (NBB-163): which biome is at (x, z). The world is split into irregular cells (each
 * point belongs to the nearest of some scattered centers, with wandering borders); each cell draws
 * its biome from the seed. Near a border two biomes blend over 40 m. The start and the cabins keep
 * firm, wooded ground (BM3-A). Pure: the same seed always gives the same world.
 */
export function biomeWeights(x: number, z: number, seed: number): BiomeWeights {
  const settings = CONFIG.biomes;
  const size = settings.cellSize;
  // The borders wander: the point looked up is pushed around by a slow noise.
  const warp = settings.borderWarp;
  const wx = x + (fractalNoise(x / 300, z / 300, seed + 9101, 2) - 0.5) * 2 * warp;
  const wz = z + (fractalNoise(x / 300, z / 300, seed + 9102, 2) - 0.5) * 2 * warp;
  const gx = Math.floor(wx / size);
  const gz = Math.floor(wz / size);

  let nearest = Infinity;
  let second = Infinity;
  let first: Biome = "pineForest";
  let other: Biome = "pineForest";
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx;
      const cz = gz + dz;
      const px = (cx + 0.15 + 0.7 * hashPosition(cx, cz, 1, seed + 9202)) * size;
      const pz = (cz + 0.15 + 0.7 * hashPosition(cx, cz, 2, seed + 9202)) * size;
      const distance = Math.hypot(wx - px, wz - pz);
      if (distance < nearest) {
        second = nearest;
        other = first;
        nearest = distance;
        first = cellBiome(cx, cz, seed);
      } else if (distance < second) {
        second = distance;
        other = cellBiome(cx, cz, seed);
      }
    }
  }

  // At a border the two nearest cells blend (the distance gap is twice the way to the border).
  let weights = only(first);
  const gap = (second - nearest) / settings.blendMeters;
  if (other !== first && gap < 1) {
    const share = 0.5 + 0.5 * smooth(gap);
    weights = only(first);
    weights[first] = share;
    weights[other] = 1 - share;
  }

  // BM8: pine forest around the start; BM3-A: wooded ground around each cabin.
  const fromStart = Math.hypot(x, z);
  weights = force(weights, "pineForest", fromStart, settings.startRadius);
  for (const site of cabinsNear(x, z, seed)) {
    const keep: Biome = weights.broadleaf > weights.pineForest ? "broadleaf" : "pineForest";
    weights = force(weights, keep, Math.hypot(x - site.x, z - site.z), settings.cabinRadius);
  }
  return weights;
}

/** The biome with the most weight at (x, z). */
export function biomeAt(x: number, z: number, seed: number): Biome {
  const weights = biomeWeights(x, z, seed);
  let best: Biome = "pineForest";
  for (const biome of BIOMES) {
    if (weights[biome] > weights[best]) {
      best = biome;
    }
  }
  return best;
}

/** Inside `radius`, all `biome`; then it blends back over `forceBlend` meters. */
function force(
  weights: BiomeWeights,
  biome: Biome,
  distance: number,
  radius: number,
): BiomeWeights {
  const blend = CONFIG.biomes.forceBlend;
  if (distance >= radius + blend) {
    return weights;
  }
  const strength = distance <= radius ? 1 : 1 - smooth((distance - radius) / blend);
  const result = { ...weights };
  for (const each of BIOMES) {
    result[each] = weights[each] * (1 - strength);
  }
  result[biome] += strength;
  return result;
}

function smooth(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}
