import { Mesh, VertexData, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Ground foliage tuft (W1): 3–5 thin crossed blades, seen from both sides. ~5 tris. */
export const groundTuft: ModelGenerator = {
  id: "ground-tuft",
  label: "Folhagem do chão",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.groundTuft;
    const height = randomInRange(random, settings.height);
    const bladeCount = randomInt(random, settings.blades);

    // Each blade is one tall, thin triangle. Blades fan out around the tuft: each starts a little
    // off-center and leans outward, so the tuft reads from every side.
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < bladeCount; i++) {
      const direction = (i / bladeCount) * Math.PI * 2 + randomRange(random, -0.4, 0.4);
      const outX = Math.cos(direction);
      const outZ = Math.sin(direction);
      const halfWidth = randomRange(random, 0.03, 0.05);
      const bladeHeight = height * randomRange(random, 0.7, 1);
      const offset = randomRange(random, 0.01, 0.05);
      const lean = bladeHeight * randomRange(random, 0.25, 0.5);
      const base = positions.length / 3;
      // The base edge is perpendicular to the lean direction, so the blade faces outward.
      positions.push(outX * offset - outZ * halfWidth, 0, outZ * offset + outX * halfWidth);
      positions.push(outX * offset + outZ * halfWidth, 0, outZ * offset - outX * halfWidth);
      positions.push(outX * (offset + lean), bladeHeight, outZ * (offset + lean));
      indices.push(base, base + 1, base + 2);
    }

    const tuft = new Mesh("groundTuftBody", scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    data.uvs = new Array((positions.length / 3) * 2).fill(0);
    data.applyToMesh(tuft, true);
    paint(tuft, toColor(CONFIG.palette.grass), seed);

    const model = assemble("groundTuft", [tuft], getModelMaterials(scene).foliage);
    return { root: model, animations: [] };
  },
};
