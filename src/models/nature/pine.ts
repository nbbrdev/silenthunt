import { Mesh, MeshBuilder, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Pine (W1): thin straight trunk with 4–6 stacked, slightly crooked cone "skirts". ~300 tris. */
export const pine: ModelGenerator = {
  id: "pine",
  label: "Pinheiro",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.pine;
    const height = randomInRange(random, settings.height);
    const layerCount = randomInt(random, settings.layers);

    // The trunk stops below the top so its tip never pokes out of the last cone.
    const trunkHeight = height * 0.85;
    const trunk = MeshBuilder.CreateCylinder(
      "pineTrunk",
      { height: trunkHeight, diameterTop: 0.1, diameterBottom: height * 0.035, tessellation: 6 },
      scene,
    );
    trunk.position.y = trunkHeight / 2;
    paint(bake(trunk), toColor(CONFIG.palette.bark), seed);

    const parts: Mesh[] = [trunk];
    const firstLayerY = height * 0.22;
    const span = height - firstLayerY;
    const layerHeight = (span / layerCount) * 1.8; // Layers overlap like real pine branches.
    for (let i = 0; i < layerCount; i++) {
      const t = layerCount === 1 ? 0 : i / (layerCount - 1);
      const radius = (height * 0.22 * (1 - t) + height * 0.07 * t) * randomRange(random, 0.85, 1.1);
      const layer = MeshBuilder.CreateCylinder(
        `pineLayer${i}`,
        {
          height: layerHeight,
          diameterTop: 0,
          diameterBottom: radius * 2,
          tessellation: 8,
          subdivisions: 2,
          cap: Mesh.CAP_START,
        },
        scene,
      );
      const layerBottom = firstLayerY + (span - layerHeight) * t;
      layer.position.y = layerBottom + layerHeight / 2;
      layer.rotation.set(
        randomRange(random, -0.06, 0.06),
        random() * Math.PI,
        randomRange(random, -0.06, 0.06),
      );
      bake(layer);
      jitter(layer, radius * 0.08, seed + i * 13);
      paint(layer, toColor(CONFIG.palette.pineNeedles), seed + i);
      parts.push(layer);
    }

    const tree = assemble("pine", parts, getModelMaterials(scene).foliage);
    return { root: tree, animations: [] };
  },
};
