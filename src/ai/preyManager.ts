import type { TransformNode } from "@babylonjs/core";
import { CONFIG } from "../config";
import { createRandom, hashPosition, randomInRange, randomInt } from "../core/random";
import { deer } from "../models/animals/deer";
import { rabbit } from "../models/animals/rabbit";
import type { ChunkInfo } from "../world/chunks";
import { PreyBrainBehavior, type PreyKind, type PreySenses } from "./preyBrain";

interface Animal {
  root: TransformNode;
  brain: PreyBrainBehavior;
}

/**
 * Spreads the prey over the world (PR1): when a chunk loads, it may get a few rabbits and a small
 * group of deer, always the same for the same chunk; when it unloads, they go away. Animals are
 * kept in a pool and reused, so walking around does not keep building new models. A dead animal
 * stays dead for the rest of the session (the save comes in NBB-147).
 */
export class PreyManager {
  private readonly senses: PreySenses;
  private readonly seed: number;
  private readonly pool: Record<PreyKind, Animal[]> = { rabbit: [], deer: [] };
  private readonly byChunk = new Map<string, Animal[]>();
  private readonly killed = new Set<string>();
  private created = 0;

  constructor(senses: PreySenses, seed: number) {
    this.senses = senses;
    this.seed = seed;
    const { chunks } = senses;
    chunks.onChunkLoaded.add((chunk) => this.populate(chunk));
    chunks.onChunkUnloaded.add((chunk) => this.release(chunk));
    for (const chunk of chunks.loadedChunks()) {
      this.populate(chunk);
    }
  }

  /** NBB-147: the animals killed ("chunkKey:index"), which do not come back. */
  get killedIds(): string[] {
    return [...this.killed];
  }

  /** NBB-147: animals killed in a saved game; those already standing around are taken away. */
  restoreKilled(ids: readonly string[]): void {
    for (const id of ids) {
      this.killed.add(id);
    }
    for (const [key, animals] of this.byChunk) {
      const alive = animals.filter((animal) => {
        if (!this.killed.has(animal.brain.id)) {
          return true;
        }
        animal.brain.sleep();
        this.pool[animal.brain.kind].push(animal);
        return false;
      });
      this.byChunk.set(key, alive);
    }
  }

  /** Every animal in the world right now (debugging, and the weapons later). */
  animals(): PreyBrainBehavior[] {
    return [...this.byChunk.values()].flat().map((animal) => animal.brain);
  }

  private populate(chunk: ChunkInfo): void {
    const settings = CONFIG.prey;
    const { chunkSize } = CONFIG.world;
    const random = createRandom(
      Math.floor(hashPosition(chunk.cx, chunk.cz, 7, this.seed) * 2 ** 31),
    );
    const originX = chunk.cx * chunkSize;
    const originZ = chunk.cz * chunkSize;
    const animals: Animal[] = [];
    let index = 0;
    const place = (kind: PreyKind, x: number, z: number): Animal | undefined => {
      const id = `${chunk.key}:${index++}`;
      if (this.killed.has(id)) {
        return undefined;
      }
      const animal = this.take(kind);
      animal.brain.spawn(id, x, z, random() * Math.PI * 2);
      animals.push(animal);
      return animal;
    };

    if (random() < settings.rabbitChance) {
      const count = randomInt(random, settings.rabbitsPerChunk);
      for (let i = 0; i < count; i++) {
        place("rabbit", originX + random() * chunkSize, originZ + random() * chunkSize);
      }
    }
    if (random() < settings.deerChance) {
      const count = randomInt(random, settings.deerPerGroup);
      const centerX = originX + random() * chunkSize;
      const centerZ = originZ + random() * chunkSize;
      const group: PreyBrainBehavior[] = [];
      for (let i = 0; i < count; i++) {
        const spread = settings.groupSpread;
        const member = place(
          "deer",
          centerX + randomInRange(random, [-spread, spread]),
          centerZ + randomInRange(random, [-spread, spread]),
        );
        if (member) {
          group.push(member.brain);
        }
      }
      for (const member of group) {
        member.group = group;
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

  /** A sleeping animal from the pool, or a new one. */
  private take(kind: PreyKind): Animal {
    const reused = this.pool[kind].pop();
    if (reused) {
      return reused;
    }
    const generator = kind === "rabbit" ? rabbit : deer;
    const model = generator.create(this.senses.scene, this.seed);
    // Each animal has its own random timing, so a group does not move in lockstep.
    this.created++;
    const brain = new PreyBrainBehavior(
      kind,
      this.senses,
      model.animations,
      this.seed + this.created,
    );
    model.root.addBehavior(brain);
    brain.onKilled.add((victim) => this.killed.add(victim.id));
    return { root: model.root, brain };
  }
}
