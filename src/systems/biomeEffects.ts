import type { Scene, Vector3 } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Player } from "../player/player";
import { BIOMES, type Biome, type BiomeWeights } from "../world/biomes";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import { fogConditions } from "../world/atmosphere";

/**
 * How each biome changes the play where the player stands (BM1, BM8; NBB-163):
 * - broadleaf wood: dry leaves make the steps 50% noisier;
 * - marsh: off the firm trails the mud halves the speed and each step splashes as loud as a
 *   snapping branch; the fog comes 40% closer (for the creature too); reeds hide like bushes;
 * - open field: standing, the player is seen 50% farther; crouched in the tall grass, only
 *   from closer than 15 m;
 * - ridge: going up a slope steeper than 15° is slower and tiring; the wind covers the steps
 *   (the player's and the creature's carry 30% less far).
 * The weights blend at a border, so the rules fade in and out with the land.
 */
export class BiomeEffects {
  private readonly terrain: Terrain;
  private readonly chunks: ChunkManager;
  private readonly player: Player;
  private weights: BiomeWeights;

  constructor(scene: Scene, terrain: Terrain, chunks: ChunkManager, player: Player) {
    this.terrain = terrain;
    this.chunks = chunks;
    this.player = player;
    this.weights = terrain.biomeWeightsAt(player.position.x, player.position.z);
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** The biome where the player stands (the one with most weight). */
  get biome(): Biome {
    let best: Biome = "pineForest";
    for (const biome of BIOMES) {
      if (this.weights[biome] > this.weights[best]) {
        best = biome;
      }
    }
    return best;
  }

  /** How much louder (or quieter) the player's steps are here. */
  get stepNoiseFactor(): number {
    const { broadleafStepNoise, ridgeNoise } = CONFIG.biomes.rules;
    const w = this.weights;
    return 1 + (broadleafStepNoise - 1) * w.broadleaf + (ridgeNoise - 1) * w.ridge;
  }

  /** BM8: how far the creature's steps carry here (the ridge's wind covers them). */
  get creatureHearingFactor(): number {
    return 1 + (CONFIG.biomes.rules.ridgeNoise - 1) * this.weights.ridge;
  }

  /** In the marsh's mud (off its trails): slow and splashing. */
  get inMud(): boolean {
    const feet = this.player.feet;
    return this.weights.marsh > 0.5 && !this.terrain.isMarshTrail(feet.x, feet.z);
  }

  /** BM8: standing in the open field the player is seen farther; crouched in tall grass, closer. */
  sightDistance(distance: number): number {
    const rules = CONFIG.biomes.rules;
    if (!this.player.isCrouched) {
      return distance * (1 + (rules.fieldSight - 1) * this.weights.field);
    }
    const feet = this.player.feet;
    const inGrass = this.chunks.nearestOf("tallGrass", feet.x, feet.z, rules.tallGrassReach);
    return inGrass ? Math.min(distance, rules.tallGrassSeen) : distance;
  }

  /**
   * BM8: how the ground here changes walking in `direction` (a horizontal unit vector): the
   * marsh's mud halves the speed; a steep climb on the ridge slows and tires.
   */
  groundEffect(direction: Vector3): { speed: number; tiring: boolean } {
    const rules = CONFIG.biomes.rules;
    if (this.inMud) {
      return { speed: rules.mudSpeed, tiring: false };
    }
    if (this.weights.ridge > 0.5) {
      const feet = this.player.feet;
      const ahead = this.terrain.heightAt(feet.x + direction.x, feet.z + direction.z);
      const here = this.terrain.heightAt(feet.x, feet.z);
      if (ahead - here > Math.tan((rules.climbDegrees * Math.PI) / 180)) {
        return { speed: rules.climbSpeed, tiring: true };
      }
    }
    return { speed: 1, tiring: false };
  }

  /** Development: the biome here and its weights. */
  debugState(): object {
    return {
      biome: this.biome,
      inMud: this.inMud,
      stepNoise: Math.round(this.stepNoiseFactor * 100) / 100,
      fog: Math.round(fogConditions.scale * 100) / 100,
    };
  }

  private update(): void {
    const feet = this.player.feet;
    this.weights = this.terrain.biomeWeightsAt(feet.x, feet.z);
    // BM1: the marsh's fog, for everyone's eyes.
    fogConditions.scale = 1 - (1 - CONFIG.biomes.rules.marshFog) * this.weights.marsh;
  }
}
