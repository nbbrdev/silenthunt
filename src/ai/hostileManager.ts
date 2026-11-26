import type { Observable, TransformNode } from "@babylonjs/core";
import { CONFIG } from "../config";
import { randomInRange, randomInt } from "../core/random";
import { bear } from "../models/animals/bear";
import { boar } from "../models/animals/boar";
import { wolf } from "../models/animals/wolf";
import type { ChunkInfo } from "../world/chunks";
import {
  HostileBrainBehavior,
  type HostileKind,
  type HostileSenses,
  type Pack,
} from "./hostileBrain";
import { chunkRandom } from "./wildlifeCommon";

interface Animal {
  root: TransformNode;
  brain: HostileBrainBehavior;
}

/** Where the kills are remembered (the prey's manager, so the save keeps them). */
export interface KillRecord {
  isKilled: (id: string) => boolean;
  markKilled: (id: string) => void;
  onKillsRestored: Observable<void>;
}

/**
 * NBB-167 (AH6-A): spreads the hostile animals over the world: when a chunk loads, maybe a wolf
 * pack in the field, a few boars in the broadleaf wood or a bear on the ridge, always the same for
 * the same chunk; they go when it unloads. Kept in a pool and reused, like the prey.
 */
export class HostileManager {
  private readonly senses: HostileSenses;
  private readonly seed: number;
  private readonly kills: KillRecord;
  private readonly pool: Record<HostileKind, Animal[]> = { wolf: [], boar: [], bear: [] };
  private readonly byChunk = new Map<string, Animal[]>();
  private created = 0;

  constructor(senses: HostileSenses, seed: number, kills: KillRecord) {
    this.senses = senses;
    this.seed = seed;
    this.kills = kills;
    const { chunks } = senses;
    chunks.onChunkLoaded.add((chunk) => this.populate(chunk));
    chunks.onChunkUnloaded.add((chunk) => this.release(chunk));
    for (const chunk of chunks.loadedChunks()) {
      this.populate(chunk);
    }
    // NBB-147: a saved game's kills: those standing around are taken away.
    kills.onKillsRestored.add(() => {
      for (const [key, animals] of this.byChunk) {
        const alive = animals.filter((animal) => {
          if (!this.kills.isKilled(animal.brain.id)) {
            return true;
          }
          animal.brain.sleep();
          this.pool[animal.brain.kind].push(animal);
          return false;
        });
        this.byChunk.set(key, alive);
      }
    });
  }

  /** Every hostile animal in the world right now. */
  animals(): HostileBrainBehavior[] {
    return [...this.byChunk.values()].flat().map((animal) => animal.brain);
  }

  private populate(chunk: ChunkInfo): void {
    const { chunkSize } = CONFIG.world;
    const { terrain } = this.senses;
    const random = chunkRandom(chunk, 41, this.seed);
    const animals: Animal[] = [];
    let index = 0;
    for (const kind of ["wolf", "boar", "bear"] as const) {
      const spawn = CONFIG.hostile.spawn[kind];
      if (random() >= spawn.chance) {
        continue;
      }
      const centerX = (chunk.cx + random()) * chunkSize;
      const centerZ = (chunk.cz + random()) * chunkSize;
      const count = randomInt(random, spawn.count);
      if (terrain.biomeAt(centerX, centerZ) !== spawn.biome) {
        continue;
      }
      const pack: Pack = { members: [], mode: "idle", time: 0, limit: 0, rest: 0, bearing: 0 };
      for (let i = 0; i < count; i++) {
        const id = `${chunk.key}:h${index++}`;
        const x = centerX + randomInRange(random, [-spawn.spread, spawn.spread]);
        const z = centerZ + randomInRange(random, [-spawn.spread, spawn.spread]);
        const heading = random() * Math.PI * 2;
        if (this.kills.isKilled(id) || terrain.waterAt(x, z).depth > 0) {
          continue;
        }
        const animal = this.take(kind);
        animal.brain.spawn(id, x, z, heading);
        animal.brain.pack = pack;
        pack.members.push(animal.brain);
        animals.push(animal);
      }
    }
    if (animals.length > 0) {
      this.byChunk.set(chunk.key, animals);
    }
  }

  private release(chunk: ChunkInfo): void {
    for (const animal of this.byChunk.get(chunk.key) ?? []) {
      animal.brain.sleep();
      this.pool[animal.brain.kind].push(animal);
    }
    this.byChunk.delete(chunk.key);
  }

  private take(kind: HostileKind): Animal {
    const reused = this.pool[kind].pop();
    if (reused) {
      return reused;
    }
    const generator = { wolf, boar, bear }[kind];
    const model = generator.create(this.senses.scene, this.seed);
    this.created++;
    const brain = new HostileBrainBehavior(
      kind,
      this.senses,
      model.animations,
      this.seed + 1000 + this.created,
    );
    model.root.addBehavior(brain);
    brain.onKilled.add((victim) => this.kills.markKilled(victim.id));
    return { root: model.root, brain };
  }
}
