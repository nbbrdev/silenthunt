import { MeshBuilder, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomRange } from "../../core/random";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Dry branch lying on the ground (W1): the branch that snaps (RF-11). ~24 tris. */
export const groundBranch: ModelGenerator = {
  id: "ground-branch",
  label: "Galho seco",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const length = randomInRange(random, CONFIG.models.groundBranch.length);
    const radius = randomRange(random, 0.02, 0.03);

    const path = [
      new Vector3(-length / 2, radius, 0),
      new Vector3(0, radius, randomRange(random, -0.08, 0.08)),
      new Vector3(length / 2, radius, randomRange(random, -0.1, 0.1)),
    ];
    const branch = MeshBuilder.CreateTube(
      "groundBranchBody",
      { path, radiusFunction: (i) => radius * (1 - i * 0.3), tessellation: 4 },
      scene,
    );
    branch.rotation.y = random() * Math.PI;
    branch.bakeCurrentTransformIntoVertices();
    paint(branch, toColor(CONFIG.palette.deadWood).scale(0.8), seed);

    const model = assemble("groundBranch", [branch], getModelMaterials(scene).solid);
    return { root: model, animations: [] };
  },
};
