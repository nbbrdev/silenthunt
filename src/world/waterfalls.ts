import {
  CreateSoundAsync,
  CreateSoundBufferAsync,
  TransformNode,
  type Scene,
  type StaticSound,
  type Vector3,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { createWaterfallModel, type WaterfallModel } from "../models/nature/waterfall";
import type { ChunkInfo, ChunkManager } from "./chunks";
import type { Terrain } from "./terrain";
import type { Waterfall } from "./water";

interface Placed {
  fall: Waterfall;
  model: WaterfallModel;
}

/** One of the few roaring loops, following the waterfall nearest to the player it is given. */
interface Roar {
  sound: StaticSound;
  emitter: TransformNode;
  fall: Waterfall | undefined;
}

/**
 * NBB-165 (CC1-A to CC5-A): the waterfalls in the world. Each loaded chunk gets the waterfalls
 * whose lip lies in it (curtain, foam and mist); only those near the player run their particles
 * (CC3-A) and roar (CC4-A); their roar covers the noise near them (CC5-A).
 */
export class WaterfallField {
  private readonly scene: Scene;
  private readonly terrain: Terrain;
  private readonly ears: () => Vector3;
  private readonly placed = new Map<string, Placed[]>();
  private roars: Roar[] = [];

  constructor(scene: Scene, terrain: Terrain, chunks: ChunkManager, ears: () => Vector3) {
    this.scene = scene;
    this.terrain = terrain;
    this.ears = ears;
    chunks.onChunkLoaded.add((chunk) => this.build(chunk));
    chunks.onChunkUnloaded.add((chunk) => this.remove(chunk.key));
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** CC4-A: a few roaring loops, handed to the waterfalls nearest to the player. */
  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.waterfalls;
    const buffer = await CreateSoundBufferAsync(soundUrl(settings.sound), {}, audio.engine);
    const roars: Roar[] = [];
    for (let i = 0; i < settings.roarCount; i++) {
      const emitter = new TransformNode(`waterfallRoar${i}`, this.scene);
      const sound = await CreateSoundAsync(
        `waterfallRoar${i}`,
        buffer,
        {
          loop: true,
          volume: settings.volume,
          outBus: audio.ambience,
          spatialEnabled: true,
          spatialDistanceModel: "linear",
          spatialMinDistance: 2,
          spatialMaxDistance: settings.hearingDistance,
        },
        audio.engine,
      );
      sound.spatial.attach(emitter);
      roars.push({ sound, emitter, fall: undefined });
    }
    this.roars = roars;
  }

  /**
   * CC5-A: how much of a noise made at `position` carries, near a waterfall (1 = all; within
   * `maskDistance` of one, `maskFactor`).
   */
  dampen(position: { x: number; z: number }): number {
    const { maskDistance, maskFactor } = CONFIG.waterfalls;
    return this.terrain.water.fallsNear(position.x, position.z, maskDistance).length > 0
      ? maskFactor
      : 1;
  }

  /** Development: the waterfalls near (x, z), nearest first. */
  near(x: number, z: number, radius: number): Waterfall[] {
    return this.terrain.water
      .fallsNear(x, z, radius)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }

  private build(chunk: ChunkInfo): void {
    const { chunkSize } = CONFIG.world;
    const minX = chunk.cx * chunkSize;
    const minZ = chunk.cz * chunkSize;
    const falls = this.terrain.water
      .fallsNear(minX + chunkSize / 2, minZ + chunkSize / 2, chunkSize)
      .filter(
        (fall) =>
          fall.x >= minX &&
          fall.x < minX + chunkSize &&
          fall.z >= minZ &&
          fall.z < minZ + chunkSize,
      );
    if (falls.length === 0) {
      return;
    }
    const placed = falls.map((fall) => {
      const width = fall.width + CONFIG.waterfalls.extraWidth;
      const model = createWaterfallModel(this.scene, width, fall.top - fall.bottom);
      model.root.position.set(fall.x, fall.top + 0.02, fall.z);
      // The model falls toward its own +Z.
      model.root.rotation.y = Math.atan2(fall.dirX, fall.dirZ);
      return { fall, model };
    });
    this.placed.set(chunk.key, placed);
  }

  private remove(key: string): void {
    for (const { model } of this.placed.get(key) ?? []) {
      model.dispose();
    }
    this.placed.delete(key);
  }

  private update(): void {
    const settings = CONFIG.waterfalls;
    const ears = this.ears();
    const all = [...this.placed.values()].flat();
    // CC3-A: the particles only for those near.
    for (const { fall, model } of all) {
      model.setParticles(Math.hypot(fall.x - ears.x, fall.z - ears.z) < settings.particleDistance);
    }
    if (this.roars.length === 0) {
      return;
    }
    // CC4-A: the nearest ones roar.
    const heard = all
      .map(({ fall }) => ({ fall, distance: Math.hypot(fall.x - ears.x, fall.z - ears.z) }))
      .filter(({ distance }) => distance < settings.hearingDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.roars.length)
      .map(({ fall }) => fall);
    for (const roar of this.roars) {
      if (roar.fall && heard.includes(roar.fall)) {
        continue;
      }
      const next = heard.find((fall) => !this.roars.some((other) => other.fall === fall));
      roar.fall = next;
      if (next) {
        // From the middle of the drop.
        roar.emitter.position.set(next.x, (next.top + next.bottom) / 2, next.z);
        roar.sound.play({ startOffset: Math.random() * 20 });
      } else {
        roar.sound.stop();
      }
    }
  }
}
