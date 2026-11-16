import { MeshBuilder, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Bush (W1): 3–5 small irregular blobs. 240–400 tris. */
export const bush: ModelGenerator = {
  id: "bush",
  label: "Arbusto",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.bush;
    const height = randomInRange(random, settings.height);
    const blobCount = randomInt(random, settings.blobs);

    const parts: Mesh[] = [];
    for (let i = 0; i < blobCount; i++) {
      const radius = height * randomRange(random, 0.35, 0.5);
      const angle = random() * Math.PI * 2;
      const distance = height * randomRange(random, 0, 0.35);
      const blob = MeshBuilder.CreateIcoSphere(
        `bushBlob${i}`,
        // Subdivision 1 (20 faces) looked like crystals; 2 (80 faces) reads as foliage.
        { radius, subdivisions: 2, flat: true },
        scene,
      );
      blob.position.set(
        Math.cos(angle) * distance,
        height - radius * randomRange(random, 0.9, 1.3),
        Math.sin(angle) * distance,
      );
      blob.scaling.y = 0.8;
      bake(blob);
      jitter(blob, radius * 0.18, seed + i);
      paint(blob, toColor(CONFIG.palette.oakLeaves), seed + 50 + i);
      parts.push(blob);
    }

    const model = assemble("bush", parts, getModelMaterials(scene).foliage);
    return { root: model, animations: [] };
  },
};
