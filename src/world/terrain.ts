import { CONFIG } from "../config";
import { cabinsNear } from "./cabinSites";
import { fractalNoise } from "./noise";

/** Ground types of RF-03. The noise system (NBB-131) asks which one is under the player. */
export type GroundType = "dirt" | "moss" | "leaves" | "twigs";

/**
 * Everything about the land at any point of the infinite world, from the seed alone. Pure
 * functions: no meshes, so other systems (noise, AI, spawning) can ask about any position.
 */
export class Terrain {
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Ground height in meters at (x, z) (MW1: gentle hills, RF-02). Around a cabin the ground is
   * flat (ES1), blending back into the hills a few meters away.
   */
  heightAt(x: number, z: number): number {
    let height = this.hillsAt(x, z);
    const { flatRadius, blendRadius } = CONFIG.cabins;
    for (const site of cabinsNear(x, z, this.seed)) {
      const distance = Math.hypot(x - site.x, z - site.z);
      if (distance >= blendRadius) {
        continue;
      }
      const t = Math.max(0, (distance - flatRadius) / (blendRadius - flatRadius));
      const flat = 1 - t * t * (3 - 2 * t);
      height += (this.hillsAt(site.x, site.z) - height) * flat;
    }
    return height;
  }

  private hillsAt(x: number, z: number): number {
    const { hillHeight, hillSpacing } = CONFIG.world;
    const hills = fractalNoise(x / hillSpacing, z / hillSpacing, this.seed, 4);
    return (hills - 0.5) * 2 * hillHeight;
  }

  /** Ground type at (x, z) (RF-03, MW6): patches of moss, dry leaves, dry twigs and bare dirt. */
  groundTypeAt(x: number, z: number): GroundType {
    const spacing = CONFIG.world.groundPatchSpacing;
    const twigs = fractalNoise(x / (spacing * 0.6), z / (spacing * 0.6), this.seed + 7001, 2);
    if (twigs > 0.7) {
      return "twigs";
    }
    const moisture = fractalNoise(x / spacing, z / spacing, this.seed + 7002, 3);
    if (moisture > 0.58) {
      return "moss";
    }
    const litter = fractalNoise(x / spacing, z / spacing, this.seed + 7003, 3);
    return litter > 0.5 ? "leaves" : "dirt";
  }

  /**
   * How many trees grow here, as a multiplier of the average (MW2): about 0.1 in clearings,
   * 1.5 in dense woods, 1 elsewhere, and 0 around the starting point.
   */
  treeDensityAt(x: number, z: number): number {
    const { regionSpacing, clearingTrees, denseTrees, spawnClearRadius } = CONFIG.world;
    if (x * x + z * z < spawnClearRadius * spawnClearRadius) {
      return 0;
    }
    const region = fractalNoise(x / regionSpacing, z / regionSpacing, this.seed + 7004, 2);
    if (region < 0.38) {
      return clearingTrees;
    }
    if (region > 0.62) {
      return denseTrees;
    }
    return 1;
  }
}
