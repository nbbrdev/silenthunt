import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { frameSeconds } from "../../core/gameTime";
import { createRandom } from "../../core/random";
import { paint } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { getSoftDotTexture } from "../textures";
import type { GeneratedModel, ModelGenerator } from "../types";

/** A waterfall as the game uses it: the curtain, and its foam and mist (on only when near). */
export interface WaterfallModel {
  root: TransformNode;
  curtain: Mesh;
  foam: ParticleSystem;
  mist: ParticleSystem;
  /** CC3-A: the particles run only for the waterfalls near the player. */
  setParticles(on: boolean): void;
  dispose(): void;
}

const curtainByScene = new WeakMap<Scene, StandardMaterial>();

/**
 * NBB-165 (CC3-A): the falling water's look, shared by every waterfall: light streaks drawn by
 * code on a pale, half-clear sheet, running down without end.
 */
function getCurtainMaterial(scene: Scene): StandardMaterial {
  const existing = curtainByScene.get(scene);
  if (existing) {
    return existing;
  }
  const settings = CONFIG.models.waterfall;
  const width = 128;
  const height = 256;
  const texture = new DynamicTexture("waterfallStreaks", { width, height }, scene, true);
  const context = texture.getContext();
  const random = createRandom(165);
  // A pale veil, a little clearer in places.
  context.fillStyle = "rgba(215, 228, 232, 0.35)";
  context.fillRect(0, 0, width, height);
  for (let i = 0; i < 70; i++) {
    const x = random() * width;
    const lineWidth = 1 + random() * 3;
    const top = random() * height;
    const length = height * (0.3 + random() * 0.7);
    const alpha = 0.25 + random() * 0.55;
    // Each streak fades in and out along its length; drawn twice so it wraps around.
    for (const shift of [0, -height]) {
      const gradient = context.createLinearGradient(0, top + shift, 0, top + shift + length);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(x, top + shift, lineWidth, length);
    }
  }
  texture.update();
  texture.hasAlpha = true;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;

  const material = new StandardMaterial("waterfall", scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = settings.alpha;
  const tint = settings.tint;
  material.diffuseColor = new Color3(tint.r, tint.g, tint.b);
  material.emissiveColor = new Color3(tint.r, tint.g, tint.b).scale(0.12);
  material.specularColor = new Color3(0.2, 0.2, 0.2);
  material.backFaceCulling = false;
  // The streaks run down (paused with the game).
  scene.onBeforeRenderObservable.add(() => {
    texture.vOffset = (texture.vOffset + frameSeconds(scene) * settings.streakSpeed) % 1;
  });
  curtainByScene.set(scene, material);
  return material;
}

/**
 * The curtain's shape, in the waterfall's own frame: the lip across the X axis at the origin,
 * the water coming from −Z and falling toward +Z. It starts flat `lipBack` m before the lip,
 * then curves out and down, widening a little.
 */
function createCurtain(scene: Scene, width: number, height: number): Mesh {
  const settings = CONFIG.models.waterfall;
  const throwOut = settings.throwBase + settings.throwPerMeter * height;
  const across = Math.max(4, Math.round(width));
  const down = 12;
  // The profile: two points on the flat lip, then the fall.
  const profile: { y: number; z: number; spread: number }[] = [
    { y: 0, z: -settings.lipBack, spread: 1 },
    { y: 0, z: 0, spread: 1 },
  ];
  for (let i = 1; i <= down; i++) {
    const t = i / down;
    profile.push({ y: -height * t, z: throwOut * Math.sqrt(t), spread: 1 + settings.spread * t });
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let along = 0;
  profile.forEach((point, row) => {
    const previous = profile[row - 1];
    if (previous) {
      along += Math.hypot(point.y - previous.y, point.z - previous.z);
    }
    for (let col = 0; col <= across; col++) {
      const u = col / across - 0.5;
      // The middle bulges out a little more than the sides.
      const bulge = (1 - 4 * u * u) * 0.12 * Math.min(1, row / 3);
      positions.push(u * width * point.spread, point.y, point.z + bulge);
      uvs.push((u * width) / 2.5, -along / 3);
      // The flat part above the lip fades into the river, and the sides into the banks.
      const lip = row === 0 ? 0 : row === 1 ? 0.6 : 1;
      const side = Math.min(1, (0.5 - Math.abs(u)) / 0.08);
      colors.push(1, 1, 1, lip * side);
    }
  });
  const stride = across + 1;
  for (let row = 0; row < profile.length - 1; row++) {
    for (let col = 0; col < across; col++) {
      const a = row * stride + col;
      indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
    }
  }
  const mesh = new Mesh("waterfallCurtain", scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.uvs = uvs;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh, false);
  mesh.hasVertexAlpha = true;
  mesh.material = getCurtainMaterial(scene);
  mesh.isPickable = false;
  return mesh;
}

/**
 * How lit the scene is now (0 to 1), from its sky and sun lights: the foam and mist are not lit
 * by themselves, so they follow it (pale by day, dim at night).
 */
function sceneBrightness(scene: Scene): number {
  let light = 0;
  for (const source of scene.lights) {
    if (!source.isEnabled()) {
      continue;
    }
    if (source instanceof HemisphericLight || source instanceof DirectionalLight) {
      const { r, g, b } = source.diffuse;
      light += source.intensity * Math.max(r, g, b);
    }
  }
  return Math.min(1, Math.max(0.12, light * 0.8));
}

/**
 * NBB-165 (CC3-A): a waterfall `width` m wide and `height` m tall: the curtain, foam bursting at
 * its foot and a light mist rising from it.
 */
export function createWaterfallModel(scene: Scene, width: number, height: number): WaterfallModel {
  const settings = CONFIG.models.waterfall;
  const root = new TransformNode("waterfall", scene);
  const curtain = createCurtain(scene, width, height);
  curtain.parent = root;

  const throwOut = settings.throwBase + settings.throwPerMeter * height;
  const foot = new TransformNode("waterfallFoot", scene);
  foot.parent = root;
  foot.position.set(0, -height + 0.1, throwOut);
  const half = (width * (1 + settings.spread)) / 2;

  const foam = new ParticleSystem(
    "waterfallFoam",
    Math.ceil(settings.foamPerMeter * width * 1.5),
    scene,
  );
  foam.particleTexture = getSoftDotTexture(scene);
  foam.emitter = foot as unknown as Vector3;
  foam.minEmitBox = new Vector3(-half, 0, -0.4);
  foam.maxEmitBox = new Vector3(half, 0.2, 0.6);
  foam.direction1 = new Vector3(-0.6, 1.4, -0.3);
  foam.direction2 = new Vector3(0.6, 2.6, 1.4);
  foam.gravity = new Vector3(0, -5, 0);
  foam.minSize = 0.35;
  foam.maxSize = 0.9;
  foam.minLifeTime = 0.5;
  foam.maxLifeTime = 1.1;
  foam.emitRate = settings.foamPerMeter * width;
  foam.blendMode = ParticleSystem.BLENDMODE_STANDARD;

  const mist = new ParticleSystem(
    "waterfallMist",
    Math.ceil(settings.mistPerMeter * width * 6),
    scene,
  );
  mist.particleTexture = getSoftDotTexture(scene);
  mist.emitter = foot as unknown as Vector3;
  mist.minEmitBox = new Vector3(-half, 0, -0.5);
  mist.maxEmitBox = new Vector3(half, 0.5, 1.5);
  mist.direction1 = new Vector3(-0.3, 0.3, 0.1);
  mist.direction2 = new Vector3(0.3, 0.8, 0.6);
  mist.gravity = Vector3.Zero();
  // CC9-B: a mist that shows (bigger, denser, less clear).
  mist.minSize = 3;
  mist.maxSize = 6;
  mist.minLifeTime = 3;
  mist.maxLifeTime = 5;
  mist.emitRate = settings.mistPerMeter * width;
  mist.blendMode = ParticleSystem.BLENDMODE_STANDARD;

  // CC9-B: the fog swallows them with distance like the rest of the world (Babylon leaves it off
  // for particles), so the foam no longer shines through it.
  foam.applyFog = true;
  mist.applyFog = true;
  // Their colors follow the light (they are not lit by themselves).
  const observer = scene.onBeforeRenderObservable.add(() => {
    const light = sceneBrightness(scene);
    const tone = (r: number, g: number, b: number, alpha: number) =>
      new Color4(r * light, g * light, b * light, alpha);
    foam.color1 = tone(0.95, 0.97, 1, 0.65);
    foam.color2 = tone(0.85, 0.9, 0.92, 0.45);
    foam.colorDead = tone(0.9, 0.92, 0.94, 0);
    mist.color1 = tone(0.85, 0.9, 0.92, settings.mistAlpha);
    mist.color2 = tone(0.8, 0.85, 0.88, settings.mistAlpha * 0.6);
    mist.colorDead = tone(0.8, 0.85, 0.88, 0);
  });

  let running = false;
  return {
    root,
    curtain,
    foam,
    mist,
    setParticles(on: boolean) {
      if (on === running) {
        return;
      }
      running = on;
      if (on) {
        foam.start();
        mist.start();
      } else {
        foam.stop();
        mist.stop();
      }
    },
    dispose() {
      observer.remove();
      foam.dispose();
      mist.dispose();
      root.dispose();
    },
  };
}

/**
 * The gallery's waterfall (CC3-A): a 6 m wide, 4 m tall fall over a block of rock, into a dark
 * pool, so its look can be judged as in the ridge.
 */
export const waterfall: ModelGenerator = {
  id: "waterfall",
  label: "Cachoeira",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const height = 4 + Math.round(random() * 2);
    const width = 6;
    const model = createWaterfallModel(scene, width, height);
    model.root.position.y = height;
    model.setParticles(true);
    // Only for the gallery: the step of rock it falls from, and the pool.
    const rock = MeshBuilder.CreateBox(
      "waterfallRock",
      { width: width + 6, height, depth: 6 },
      scene,
    );
    rock.position.set(0, height / 2, -3.05);
    rock.bakeCurrentTransformIntoVertices();
    paint(rock, new Color3(0.42, 0.41, 0.4), seed);
    rock.material = getModelMaterials(scene).stone;
    const pool = MeshBuilder.CreateDisc("waterfallPool", { radius: 6, tessellation: 24 }, scene);
    pool.rotation.x = Math.PI / 2;
    pool.position.set(0, 0.02, 5);
    const poolMaterial = new StandardMaterial("waterfallPool", scene);
    poolMaterial.diffuseColor = new Color3(0.05, 0.08, 0.09);
    poolMaterial.specularColor = new Color3(0.4, 0.4, 0.4);
    pool.material = poolMaterial;
    const group = new TransformNode("waterfallGallery", scene);
    model.root.parent = group;
    rock.parent = group;
    pool.parent = group;
    return { root: group, animations: [] };
  },
};
