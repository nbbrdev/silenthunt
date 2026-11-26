import { CONFIG } from "../config";
import type { GameAudio } from "../core/audio";
import type { ChunkInfo } from "../world/chunks";
import { BirdFlocks } from "./birdFlocks";
import { FishSchools } from "./fishSchools";
import { FrogGroups } from "./frogGroups";
import type { WildlifeSenses } from "./wildlifeCommon";

/**
 * NBB-166 (AV2-A to AV6-A): the peaceful small animals that bring the world to life: flocks of
 * birds on the ground by day, schools of fish in the deep water and frogs singing on the marsh's
 * shores. They are not hunted; they warn: a flock taking off or a chorus going silent tells the
 * player something is coming. They live and move only near the player (AV6-A).
 */
export class Wildlife {
  readonly birds: BirdFlocks;
  readonly fish: FishSchools;
  readonly frogs: FrogGroups;

  constructor(senses: WildlifeSenses, seed: number) {
    this.birds = new BirdFlocks(senses, seed);
    this.fish = new FishSchools(senses, seed);
    this.frogs = new FrogGroups(senses, seed);
    for (const chunk of senses.chunks.loadedChunks()) {
      this.load(chunk);
    }
    senses.chunks.onChunkLoaded.add((chunk) => this.load(chunk));
    senses.chunks.onChunkUnloaded.add((chunk) => this.unload(chunk.key));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    await Promise.all([
      this.birds.loadSounds(audio),
      this.fish.loadSounds(audio),
      this.frogs.loadSounds(audio),
    ]);
  }

  /** Development: how many there are around, and the nearest of each kind to (x, z). */
  debugState(x: number, z: number): object {
    return {
      activeDistance: CONFIG.wildlife.activeDistance,
      birds: this.birds.debugState(x, z),
      fish: this.fish.debugState(x, z),
      frogs: this.frogs.debugState(x, z),
    };
  }

  private load(chunk: ChunkInfo): void {
    this.birds.load(chunk);
    this.fish.load(chunk);
    this.frogs.load(chunk);
  }

  private unload(key: string): void {
    this.birds.unload(key);
    this.fish.unload(key);
    this.frogs.unload(key);
  }
}
