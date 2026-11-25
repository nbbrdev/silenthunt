import { CONFIG } from "../config";
import { biomeAt, biomeWeights, type Biome, type BiomeWeights } from "./biomes";
import { cabinsNear } from "./cabinSites";
import { fractalNoise } from "./noise";
import { WaterField } from "./water";

/** Ground types of RF-03. The noise system (NBB-131) asks which one is under the player. */
export type GroundType = "dirt" | "moss" | "leaves" | "twigs" | "mud" | "grass";

/**
 * Everything about the land at any point of the infinite world, from the seed alone. Pure
 * functions: no meshes, so other systems (noise, AI, spawning) can ask about any position.
 */
export class Terrain {
  readonly seed: number;
  /** NBB-164 (AG12-A): the rivers and lakes, carved into the land. */
  readonly water: WaterField;

  constructor(seed: number) {
    this.seed = seed;
    this.water = new WaterField(
      seed,
      // CC1-A: the ridge's steps are sheer for the rivers, so they fall there.
      (x, z, sheer) => this.hillsAt(x, z, 1, sheer),
      (x, z) => this.biomeWeightsAt(x, z).marsh,
      (x, z) => this.biomeWeightsAt(x, z).ridge,
    );
  }

  /**
   * Ground height in meters at (x, z) (MW1: gentle hills, RF-02). Around a cabin the ground is
   * flat (ES1), blending back into the hills a few meters away. NBB-164: rivers and lakes carve
   * their beds and banks into it.
   */
  heightAt(x: number, z: number): number {
    return this.water.carve(x, z, this.landAt(x, z));
  }

  /**
   * NBB-164: the water at (x, z): its surface height and how deep it is there (0 on dry land).
   */
  waterAt(x: number, z: number): { level: number; depth: number } {
    const shape = this.water.shapeAt(x, z);
    if (!shape || shape.edge >= 0) {
      return { level: -Infinity, depth: 0 };
    }
    return { level: shape.level, depth: Math.max(0, shape.level - this.heightAt(x, z)) };
  }

  /** The land before the water carves it: the hills, flattened around the cabins. */
  private landAt(x: number, z: number): number {
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

  /** BI2-A (NBB-163): how much of each biome is at (x, z). */
  biomeWeightsAt(x: number, z: number): BiomeWeights {
    return biomeWeights(x, z, this.seed);
  }

  /** BM6-A: the biome with the most weight at (x, z). */
  biomeAt(x: number, z: number): Biome {
    return biomeAt(x, z, this.seed);
  }

  /**
   * MW1, BM8: the land's shape. The pine forest and the broadleaf wood keep the gentle hills; the
   * field is gentler still; the marsh lies low and almost flat; the ridge rises up to ~25 m higher
   * in steps with steep faces. At a border the shapes blend with the biomes.
   */
  private hillsAt(x: number, z: number, octaves = 4, hardSteps = false): number {
    const { hillHeight, hillSpacing } = CONFIG.world;
    const hills =
      (fractalNoise(x / hillSpacing, z / hillSpacing, this.seed, octaves) - 0.5) * 2 * hillHeight;
    const w = this.biomeWeightsAt(x, z);
    const relief = CONFIG.biomes.relief;
    let height = hills * (w.pineForest + w.broadleaf);
    height += hills * relief.fieldHills * w.field;
    height += (hills * relief.marshHills + relief.marshDrop) * w.marsh;
    if (w.ridge > 0) {
      height += (hills + this.ridgeAt(x, z, hardSteps)) * w.ridge;
    }
    return height;
  }

  /**
   * BM8: the ridge's extra height: broad rises cut into steps with steep faces. NBB-165 (CC1-A):
   * `hard` drops the faces to a sheer edge at their top, for the water: a river there falls.
   */
  private ridgeAt(x: number, z: number, hard = false): number {
    const { ridgeHeight, ridgeSpacing, stepHeight, stepSharpness } = CONFIG.biomes.relief;
    const rise = fractalNoise(x / ridgeSpacing, z / ridgeSpacing, this.seed + 9301, 3);
    const raw = (Math.max(0, rise - 0.3) / 0.7) * ridgeHeight;
    // Steps: most of each step is a gentle shelf, the last part a steep face.
    const step = Math.floor(raw / stepHeight);
    const within = raw / stepHeight - step;
    if (hard) {
      return step * stepHeight + within * stepHeight * 0.15;
    }
    const face = Math.max(0, (within - (1 - stepSharpness)) / stepSharpness);
    return (step + face * face * (3 - 2 * face)) * stepHeight + within * stepHeight * 0.15;
  }

  /**
   * BM1, BM8 (NBB-163): the marsh's trails of firm ground: narrow winding bands (~3 m) where a
   * slow noise crosses its middle value.
   */
  isMarshTrail(x: number, z: number): boolean {
    const { trailSpacing, trailBand } = CONFIG.biomes.marsh;
    const trail = fractalNoise(x / trailSpacing, z / trailSpacing, this.seed + 9401, 2);
    return Math.abs(trail - 0.5) < trailBand;
  }

  /** Ground type at (x, z) (RF-03, MW6): patches of moss, dry leaves, dry twigs and bare dirt. */
  groundTypeAt(x: number, z: number): GroundType {
    const spacing = CONFIG.world.groundPatchSpacing;
    const twigs = fractalNoise(x / (spacing * 0.6), z / (spacing * 0.6), this.seed + 7001, 2);
    if (twigs > 0.7) {
      return "twigs";
    }
    // BM1: the broadleaf wood's floor is dry leaves; the marsh's trails are firm moss.
    const weights = this.biomeWeightsAt(x, z);
    if (weights.broadleaf > 0.5) {
      return "leaves";
    }
    // BM10-C, BM11-B: off the marsh's trails, mud; the open field, dry grass.
    if (weights.marsh > 0.5) {
      return this.isMarshTrail(x, z) ? "moss" : "mud";
    }
    if (weights.field > 0.5) {
      return "grass";
    }
    // The ridge is bare: stony dirt, no moss.
    if (weights.ridge > 0.5) {
      return "dirt";
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
