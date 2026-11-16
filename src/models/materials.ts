import {
  Color3,
  MaterialPluginBase,
  StandardMaterial,
  type Material,
  type MaterialDefines,
  type Scene,
  type UniformBuffer,
} from "@babylonjs/core";
import { CONFIG } from "../config";

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
  /** Matte, vertex-colored, no wind: rocks, fallen branches. */
  solid: StandardMaterial;
  /** Same look, with wind and visible from both sides: trees, bushes, grass. */
  foliage: StandardMaterial;
}

const materialsByScene = new WeakMap<Scene, ModelMaterials>();

/** Shared materials for the procedural models (one pair per scene, reused by every model). */
export function getModelMaterials(scene: Scene): ModelMaterials {
  const existing = materialsByScene.get(scene);
  if (existing) {
    return existing;
  }

  const solid = createMatteMaterial("modelSolid", scene);
  const foliage = createMatteMaterial("modelFoliage", scene);
  foliage.backFaceCulling = false;
  new WindPlugin(foliage);

  const materials = { solid, foliage };
  materialsByScene.set(scene, materials);
  return materials;
}

function createMatteMaterial(name: string, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  // The color comes from the vertices; white diffuse keeps it unchanged.
  material.diffuseColor = Color3.White();
  // Matte low-poly look (C4-A): no shiny highlight.
  material.specularColor = Color3.Black();
  return material;
}
