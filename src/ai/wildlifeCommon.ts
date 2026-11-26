import type { AbstractMesh, Scene, Vector3 } from "@babylonjs/core";
import type { DayClock } from "../core/dayClock";
import { createRandom, hashPosition } from "../core/random";
import type { Player } from "../player/player";
import type { NoiseSystem } from "../systems/noise";
import type { ChunkInfo, ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";

/** What the small animals perceive and live in (NBB-166). */
export interface WildlifeSenses {
  scene: Scene;
  player: Player;
  terrain: Terrain;
  chunks: ChunkManager;
  clock: DayClock;
  noise: NoiseSystem;
  /** Where the creature is (they hide from it too). */
  creaturePosition: () => Vector3;
  /** Lets a mesh be seen through the water's surface (the fish). */
  showUnderWater: (mesh: AbstractMesh) => void;
}

/** The same random numbers for the same chunk and kind of animal, every time it loads. */
export function chunkRandom(chunk: ChunkInfo, salt: number, seed: number): () => number {
  return createRandom(Math.floor(hashPosition(chunk.cx, chunk.cz, salt, seed) * 2 ** 31));
}

/** Horizontal distance between two points. */
export function flatDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Turns `from` toward `to` (radians) by at most `step`, the short way round. */
export function turnToward(from: number, to: number, step: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-step, Math.min(step, difference));
}
