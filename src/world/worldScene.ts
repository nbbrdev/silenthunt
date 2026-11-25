import { Scene, Vector3, type Engine, type HavokPlugin } from "@babylonjs/core";
import { CONFIG } from "../config";
import { DayClock } from "../core/dayClock";
import { frameSeconds } from "../core/gameTime";
import { getGroundMaterial } from "../models/materials";
import { Atmosphere } from "./atmosphere";
import { ChunkManager } from "./chunks";
import { Terrain } from "./terrain";
import { VegetationLibrary } from "./vegetation";
import { CanopyShade } from "./canopyShade";
import { LightShafts } from "./lightShafts";
import { WaterfallField } from "./waterfalls";
import { WaterSurfaces } from "./waterSurface";

export interface World {
  scene: Scene;
  terrain: Terrain;
  chunks: ChunkManager;
  clock: DayClock;
  /** NBB-156: its light and fog (the last night turns them red). */
  atmosphere: Atmosphere;
  /** NBB-164: the water's surface. */
  water: WaterSurfaces;
  /** NBB-165: the waterfalls. */
  waterfalls: WaterfallField;
  /** NBB-169: the canopy's shade and the shafts of light. */
  canopy: CanopyShade;
  lightShafts: LightShafts;
}

/** The game world: the infinite forest (NBB-129) with its day and night cycle (NBB-130). */
export function createWorld(engine: Engine, physics: HavokPlugin, seed: number): World {
  const scene = new Scene(engine);
  scene.enablePhysics(new Vector3(0, CONFIG.physics.gravity, 0), physics);

  const clock = new DayClock();
  // A long pause (e.g. another tab) should not skip a whole night: at most 0.1 s per frame. The
  // clock stops while the game is paused (MN3-A).
  scene.onBeforeRenderObservable.add(() => clock.update(frameSeconds(scene)));
  const atmosphere = new Atmosphere(scene, clock);

  const terrain = new Terrain(seed);
  const library = new VegetationLibrary(scene);
  const chunks = new ChunkManager(scene, terrain, library, getGroundMaterial(scene));
  // NBB-164: the rivers' and lakes' surface, built with each chunk (so before the first ones).
  const water = new WaterSurfaces(scene, terrain, chunks, library);
  const { spawn } = CONFIG.player;
  // NBB-165: the waterfalls, also built with each chunk; heard and seen from the active camera.
  const startAt = new Vector3(spawn.x, 0, spawn.z);
  const waterfalls = new WaterfallField(
    scene,
    terrain,
    chunks,
    () => scene.activeCamera?.globalPosition ?? startAt,
  );
  chunks.loadAround(startAt);
  // NBB-169 (FL4-A, FL5-A): the canopy's shade and the shafts of light, around the camera.
  const cameraAt = () => scene.activeCamera?.globalPosition ?? startAt;
  const canopy = new CanopyShade(scene, atmosphere, chunks, cameraAt);
  const lightShafts = new LightShafts(scene, { terrain, chunks, clock, atmosphere, at: cameraAt });

  return { scene, terrain, chunks, clock, atmosphere, water, waterfalls, canopy, lightShafts };
}
