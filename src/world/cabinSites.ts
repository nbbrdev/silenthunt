import { CONFIG } from "../config";
import { createRandom, hashPosition } from "../core/random";

/** Where an abandoned cabin stands (ES1). Its door faces local +Z, turned by `rotation`. */
export interface CabinSite {
  /** Identifies the cabin, so an opened chest stays open ("cx,cz:n"). */
  id: string;
  x: number;
  z: number;
  rotation: number;
  /** The first cabin, near the start: the one with the shotgun (RF-34). */
  first: boolean;
  /**
   * NBB-156 (OB2-A, OB12): the cabins on the way out: 0 is the first cabin (the first note), 1 to
   * 3 hold the radio's parts. Undefined for the others.
   */
  step?: number;
}

/**
 * The cabin's size (ES1, meters): walls from x = −halfWidth to +halfWidth and z = −halfDepth to
 * +halfDepth around its center; the door gap is in the +Z wall.
 */
export const CABIN_SIZE = {
  halfWidth: 2,
  halfDepth: 1.5,
  wallHeight: 2.1,
  ridgeHeight: 3.05,
  doorHalfWidth: 0.45,
  doorHeight: 1.9,
};

/**
 * The cabin's walls as circles on the ground (like tree trunks), so the creature and the prey
 * walk around them and arrows and shots stop on them (up to the roof). The door gap is left open.
 */
export function cabinWallCircles(
  site: CabinSite,
): { x: number; z: number; radius: number; height: number }[] {
  const { halfWidth, halfDepth, doorHalfWidth } = CABIN_SIZE;
  const local: [number, number][] = [];
  const step = 0.4;
  for (let x = -halfWidth; x <= halfWidth + 1e-6; x += step) {
    local.push([x, -halfDepth]);
    if (Math.abs(x) > doorHalfWidth) {
      local.push([x, halfDepth]);
    }
  }
  for (let z = -halfDepth + step; z < halfDepth - 1e-6; z += step) {
    local.push([-halfWidth, z], [halfWidth, z]);
  }
  const cos = Math.cos(site.rotation);
  const sin = Math.sin(site.rotation);
  return local.map(([x, z]) => ({
    x: site.x + x * cos + z * sin,
    z: site.z - x * sin + z * cos,
    radius: 0.2,
    height: CABIN_SIZE.ridgeHeight,
  }));
}

const cache = new Map<string, CabinSite[]>();

/**
 * The cabins in chunk (cx, cz), from the seed alone (ES1): the first one sits about 60 m from
 * the start, its door facing it; elsewhere a chunk sometimes has one, never near the start.
 */
export function cabinsInChunk(cx: number, cz: number, seed: number): CabinSite[] {
  const key = `${cx},${cz}:${seed}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const { chunkSize } = CONFIG.world;
  const settings = CONFIG.cabins;
  const sites: CabinSite[] = [];

  for (const site of objectiveCabins(seed)) {
    if (Math.floor(site.x / chunkSize) === cx && Math.floor(site.z / chunkSize) === cz) {
      sites.push(site);
    }
  }

  const random = createRandom(Math.floor(hashPosition(cx, cz, 97, seed) * 2 ** 31));
  // A chunk with a cabin on the way out gets no other.
  if (sites.length === 0 && random() < settings.chancePerChunk) {
    const x = (cx + 0.2 + random() * 0.6) * chunkSize;
    const z = (cz + 0.2 + random() * 0.6) * chunkSize;
    const { spawn } = CONFIG.player;
    if (Math.hypot(x - spawn.x, z - spawn.z) > settings.othersMinDistance) {
      sites.push({ id: `${cx},${cz}:1`, x, z, rotation: random() * Math.PI * 2, first: false });
    }
  }
  cache.set(key, sites);
  return sites;
}

/** The cabins in the chunk of (x, z) and its neighbors. */
export function cabinsNear(x: number, z: number, seed: number): CabinSite[] {
  const { chunkSize } = CONFIG.world;
  const cx = Math.floor(x / chunkSize);
  const cz = Math.floor(z / chunkSize);
  const sites: CabinSite[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      sites.push(...cabinsInChunk(cx + dx, cz + dz, seed));
    }
  }
  return sites;
}

const objectiveCache = new Map<number, CabinSite[]>();

/**
 * NBB-156 (OB2-A, OB12): the cabins on the way out, from the seed alone: the first cabin (ES1,
 * the shotgun's) and the three with the radio's parts, about 150, 300 and 500 m from the start in
 * seeded directions, their doors facing the start.
 */
export function objectiveCabins(seed: number): CabinSite[] {
  const cached = objectiveCache.get(seed);
  if (cached) {
    return cached;
  }
  const { spawn } = CONFIG.player;
  const { cabinDistances, distanceJitter } = CONFIG.objective;
  const { chunkSize } = CONFIG.world;
  const place = (step: number, angle: number, distance: number): CabinSite => {
    const x = spawn.x + Math.sin(angle) * distance;
    const z = spawn.z + Math.cos(angle) * distance;
    const id = `${Math.floor(x / chunkSize)},${Math.floor(z / chunkSize)}:${step === 0 ? 0 : `q${step}`}`;
    const rotation = Math.atan2(spawn.x - x, spawn.z - z);
    return { id, x, z, rotation, first: step === 0, step };
  };
  // ES1: the first cabin keeps the place it always had.
  const sites = [place(0, hashPosition(1, 2, 3, seed) * Math.PI * 2, CONFIG.cabins.firstDistance)];
  cabinDistances.forEach((distance, index) => {
    const angle = hashPosition(5, index, 7, seed) * Math.PI * 2;
    const jitter = 1 + (hashPosition(11, index, 13, seed) * 2 - 1) * distanceJitter;
    sites.push(place(index + 1, angle, distance * jitter));
  });
  objectiveCache.set(seed, sites);
  return sites;
}
