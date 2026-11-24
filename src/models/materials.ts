import {
  Color3,
  Material,
  MaterialPluginBase,
  StandardMaterial,
  type MaterialDefines,
  type Scene,
  type UniformBuffer,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { getSurfaceTextures, type SurfaceKind } from "./surfaceTextures";
import { getBirchBarkTexture, getFoliageTexture, type FoliageKind } from "./textures";

/**
 * Sways vertices sideways on the GPU (W3). The offset grows with the square of the vertex height
 * inside the model, so trunks stay still at the base and canopies move. Each model uses its own
 * world position as a phase, so neighbors do not sway in sync.
 */
class WindPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, "Wind", 200, { WIND: false });
    this._enable(true);
  }

  override getClassName(): string {
    return "WindPlugin";
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines["WIND"] = true;
  }

  override getUniforms() {
    return {
      ubo: [
        { name: "windTime", size: 1, type: "float" },
        { name: "windStrength", size: 1, type: "float" },
      ],
      vertex: `
        #ifdef WIND
          uniform float windTime;
          uniform float windStrength;
        #endif
      `,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("windTime", (performance.now() / 1000) * CONFIG.wind.speed);
    uniformBuffer.updateFloat("windStrength", CONFIG.wind.strength);
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== "vertex") {
      return null;
    }
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
        #ifdef WIND
          float windHeight = max(positionUpdated.y, 0.0);
          float windPhase = finalWorld[3].x * 0.13 + finalWorld[3].z * 0.17;
          float windSway = windStrength * windHeight * windHeight;
          worldPos.x += sin(windTime + windPhase) * windSway;
          worldPos.z += sin(windTime * 0.7 + windPhase * 1.3) * windSway * 0.6;
        #endif
      `,
    };
  }
}

interface ModelMaterials {
  /** Rocks: rock texture with relief, no wind. */
  stone: StandardMaterial;
  /** Fallen branches: bark texture with relief, no wind. */
  fallenWood: StandardMaterial;
  /** Trunks and branches of standing plants: bark texture with relief, with wind. */
  wood: StandardMaterial;
  /** BM4-A (NBB-163): the birch's pale bark with its dark marks, with wind. */
  birchWood: StandardMaterial;
  /** Leaf cards: foliage texture with cut-out transparency, wind, visible from both sides. */
  leaves: Record<FoliageKind, StandardMaterial>;
}

const materialsByScene = new WeakMap<Scene, ModelMaterials>();

/** Shared materials for the procedural models (one set per scene, reused by every model). */
export function getModelMaterials(scene: Scene): ModelMaterials {
  const existing = materialsByScene.get(scene);
  if (existing) {
    return existing;
  }

  const stone = createSurfaceMaterial("modelStone", scene, "rock");
  const fallenWood = createSurfaceMaterial("modelFallenWood", scene, "bark");
  const wood = createSurfaceMaterial("modelWood", scene, "bark");
  new WindPlugin(wood);
  // Birch bark is smooth: its drawn marks, no relief.
  const birchWood = createMatteMaterial("modelBirchWood", scene);
  birchWood.diffuseTexture = getBirchBarkTexture(scene);
  new WindPlugin(birchWood);

  const materials = {
    stone,
    fallenWood,
    wood,
    birchWood,
    leaves: {
      broadleaf: createLeafMaterial(scene, "broadleaf"),
      needles: createLeafMaterial(scene, "needles"),
      grass: createLeafMaterial(scene, "grass"),
      reeds: createLeafMaterial(scene, "reeds"),
      tallGrass: createLeafMaterial(scene, "tallGrass"),
      birch: createLeafMaterial(scene, "birch"),
    },
  };
  materialsByScene.set(scene, materials);
  return materials;
}

function createLeafMaterial(scene: Scene, kind: FoliageKind): StandardMaterial {
  const material = createMatteMaterial(`modelLeaves-${kind}`, scene);
  material.diffuseTexture = getFoliageTexture(scene, kind);
  // Alpha test: each pixel is either fully drawn or skipped (cheap, no sorting problems).
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  // Babylon 9 may run the alpha test after all alpha computations; without this flag that alpha
  // ignores the texture and nothing is cut out (the cards rendered as black squares).
  material.useAlphaFromDiffuseTexture = true;
  // Needles are thin: a lower cut-off keeps them from vanishing on distant (shrunk) textures.
  material.alphaCutOff = kind === "needles" ? 0.25 : 0.4;
  material.backFaceCulling = false;
  new WindPlugin(material);
  return material;
}

/** Matte material with a drawn surface texture and its relief (normal map). */
function createSurfaceMaterial(name: string, scene: Scene, kind: SurfaceKind): StandardMaterial {
  const material = createMatteMaterial(name, scene);
  const textures = getSurfaceTextures(scene, kind);
  material.diffuseTexture = textures.color;
  material.bumpTexture = textures.normal;
  return material;
}

/**
 * Forest floor material (one per scene). The ground mesh must have its UVs tiled with
 * `tileUVs(ground, size / CONFIG.surfaces.groundTileMeters, …)` so the texture repeats at the
 * right scale.
 */
export function getGroundMaterial(scene: Scene): StandardMaterial {
  const existing = groundByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = createSurfaceMaterial("forestFloor", scene, "ground");
  groundByScene.set(scene, material);
  return material;
}

const groundByScene = new WeakMap<Scene, StandardMaterial>();

const plainByScene = new WeakMap<Scene, StandardMaterial>();

/** Plain matte material, the color from the vertices (small items: fiber, leather, NBB-143). */
export function getPlainMaterial(scene: Scene): StandardMaterial {
  const existing = plainByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = createMatteMaterial("plain", scene);
  plainByScene.set(scene, material);
  return material;
}

const wetByScene = new WeakMap<Scene, StandardMaterial>();

/** BM4-A (NBB-163): wet mud: dark, with a soft shine where the light catches it (puddles). */
export function getWetMaterial(scene: Scene): StandardMaterial {
  const existing = wetByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = createMatteMaterial("wetMud", scene);
  material.specularColor = new Color3(0.35, 0.35, 0.33);
  material.specularPower = 80;
  wetByScene.set(scene, material);
  return material;
}

const boneByScene = new WeakMap<Scene, StandardMaterial>();

/** Plain, slightly glossy bone (the vertex colors give its tone): remains and meat (NBB-142). */
export function getBoneMaterial(scene: Scene): StandardMaterial {
  const existing = boneByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("bone", scene);
  material.specularColor = new Color3(0.08, 0.08, 0.07);
  boneByScene.set(scene, material);
  return material;
}

function createMatteMaterial(name: string, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  // The color comes from the vertices; white diffuse keeps it unchanged.
  material.diffuseColor = Color3.White();
  // Matte low-poly look (C4-A): no shiny highlight.
  material.specularColor = Color3.Black();
  return material;
}
