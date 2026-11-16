import {
  Color3,
  Color4,
  DynamicTexture,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
  type Texture,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { getGlowLayer } from "../../core/postProcessing";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { tileUVs } from "../surfaceTextures";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Height of the flame's center above the bottom of the handle (meters). */
const FLAME_HEIGHT = 0.52;

export interface TorchModel {
  /** Handle and wrapped head (one mesh); the flame hangs from it. */
  root: Mesh;
  /** Glowing flame core: scale it to make the fire bigger or smaller. */
  flame: Mesh;
  /** Sparks and flickering fire around the flame. */
  fire: ParticleSystem;
}

/**
 * Procedural torch (NBB-132, TO2): a stick with bark, a dark wrapped head and a flame made of a
 * glowing core plus fire particles. The flame glows through the fog (G14).
 */
export function createTorchModel(scene: Scene): TorchModel {
  const handle = MeshBuilder.CreateCylinder(
    "torchHandle",
    { height: 0.46, diameterTop: 0.04, diameterBottom: 0.034, tessellation: 7 },
    scene,
  );
  handle.position.y = 0.23;
  handle.bakeCurrentTransformIntoVertices();
  paint(handle, toColor(CONFIG.palette.deadWood).scale(0.7), 7);
  tileUVs(handle, 1, 0.6);

  const wrap = MeshBuilder.CreateCylinder(
    "torchWrap",
    { height: 0.1, diameterTop: 0.06, diameterBottom: 0.07, tessellation: 8 },
    scene,
  );
  wrap.position.y = 0.45;
  wrap.bakeCurrentTransformIntoVertices();
  paint(wrap, new Color3(0.16, 0.12, 0.1), 8);

  const root = assemble("torch", [handle, wrap], getModelMaterials(scene).fallenWood);

  // A small bright core; the particles around it give the fire its shape.
  const flame = MeshBuilder.CreateSphere("torchFlame", { diameter: 0.04, segments: 6 }, scene);
  flame.scaling.y = 1.8;
  flame.position.y = FLAME_HEIGHT;
  flame.material = getFlameMaterial(scene);
  flame.parent = root;
  getGlowLayer(scene).addIncludedOnlyMesh(flame);

  const fire = new ParticleSystem("torchFire", 120, scene);
  fire.particleTexture = getSoftDotTexture(scene);
  fire.emitter = flame;
  fire.isLocal = true;
  fire.minEmitBox = new Vector3(-0.02, -0.02, -0.02);
  fire.maxEmitBox = new Vector3(0.02, 0.02, 0.02);
  const flameColor = CONFIG.torch.flameColor;
  fire.color1 = new Color4(flameColor.r, flameColor.g, flameColor.b, 1);
  fire.color2 = new Color4(1, 0.3, 0.05, 1);
  fire.colorDead = new Color4(0.15, 0.05, 0, 0);
  fire.minSize = 0.04;
  fire.maxSize = 0.12;
  fire.minLifeTime = 0.2;
  fire.maxLifeTime = 0.5;
  fire.emitRate = 120;
  fire.blendMode = ParticleSystem.BLENDMODE_ADD;
  fire.direction1 = new Vector3(-0.15, 1, -0.15);
  fire.direction2 = new Vector3(0.15, 1, 0.15);
  fire.minEmitPower = 0.15;
  fire.maxEmitPower = 0.35;
  fire.gravity = new Vector3(0, 0.6, 0);
  fire.start();

  return { root, flame, fire };
}

/** The torch in the gallery (A2-C). */
export const torch: ModelGenerator = {
  id: "torch",
  label: "Tocha",
  create(scene: Scene): GeneratedModel {
    return { root: createTorchModel(scene).root, animations: [] };
  },
};

const flameByScene = new WeakMap<Scene, StandardMaterial>();

/** Self-lit orange material: the flame shines without needing any light. */
function getFlameMaterial(scene: Scene): StandardMaterial {
  const existing = flameByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("flame", scene);
  material.emissiveColor = toColor(CONFIG.torch.flameColor);
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  // The fire stays bright in the fog: that is how the player is seen from far away (RF-13).
  material.fogEnabled = false;
  flameByScene.set(scene, material);
  return material;
}

const dotByScene = new WeakMap<Scene, Texture>();

/** Soft round dot (white center fading to transparent) for fire particles, drawn by code. */
function getSoftDotTexture(scene: Scene): Texture {
  const existing = dotByScene.get(scene);
  if (existing) {
    return existing;
  }
  const size = 64;
  const texture = new DynamicTexture("softDot", { width: size, height: size }, scene, false);
  const context = texture.getContext();
  const image = context.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const alpha = Math.max(0, 1 - distance) ** 2;
      const index = (y * size + x) * 4;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = alpha * 255;
    }
  }
  context.putImageData(image, 0, 0);
  texture.hasAlpha = true;
  texture.update();
  dotByScene.set(scene, texture);
  return texture;
}
