import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  Scene,
  Vector3,
  type Engine,
  type HavokPlugin,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { getGroundMaterial } from "../models/materials";
import { ChunkManager } from "./chunks";
import { Terrain } from "./terrain";
import { VegetationLibrary } from "./vegetation";

export interface World {
  scene: Scene;
  terrain: Terrain;
  chunks: ChunkManager;
}

/**
 * The game world (NBB-129): the infinite forest around the starting point. Light and fog are
 * provisional until the day/night cycle (NBB-130).
 */
export function createWorld(engine: Engine, physics: HavokPlugin, seed: number): World {
  const scene = new Scene(engine);
  const { atmosphere } = CONFIG;

  const fogColor = new Color3(atmosphere.fogColor.r, atmosphere.fogColor.g, atmosphere.fogColor.b);
  scene.clearColor = Color4.FromColor3(fogColor);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = fogColor;
  scene.fogDensity = atmosphere.fogDensity;

  scene.enablePhysics(new Vector3(0, CONFIG.physics.gravity, 0), physics);

  new HemisphericLight("ambient", new Vector3(0, 1, 0), scene).intensity = 0.4;
  new DirectionalLight("sun", new Vector3(-0.5, -1, -0.3), scene).intensity = 0.8;

  const terrain = new Terrain(seed);
  const library = new VegetationLibrary(scene);
  const chunks = new ChunkManager(scene, terrain, library, getGroundMaterial(scene));
  const { spawn } = CONFIG.player;
  chunks.loadAround(new Vector3(spawn.x, 0, spawn.z));

  return { scene, terrain, chunks };
}
