import { Mesh, MeshBuilder, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

const TRUNK_POINTS = 7;

/** Dead tree (W1): crooked bare trunk with 3–6 dry branches, no leaves. ~200 tris. */
export const deadTree: ModelGenerator = {
  id: "dead-tree",
  label: "Árvore morta",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.deadTree;
    const height = randomInRange(random, settings.height);
    const wood = toColor(CONFIG.palette.deadWood);
    const baseRadius = height * 0.045;
    const topRadius = height * 0.01;

    // The trunk wanders a little more the higher it goes.
    const trunkPath: Vector3[] = [];
    let x = 0;
    let z = 0;
    for (let i = 0; i < TRUNK_POINTS; i++) {
      const t = i / (TRUNK_POINTS - 1);
      x += randomRange(random, -1, 1) * height * 0.04 * t;
      z += randomRange(random, -1, 1) * height * 0.04 * t;
      trunkPath.push(new Vector3(x, t * height, z));
    }
    const trunk = MeshBuilder.CreateTube(
      "deadTrunk",
      {
        path: trunkPath,
        radiusFunction: (i) => baseRadius + (topRadius - baseRadius) * (i / (TRUNK_POINTS - 1)),
        tessellation: 6,
        cap: Mesh.CAP_START,
      },
      scene,
    );
    paint(trunk, wood, seed);
    const parts: Mesh[] = [trunk];

    const branchCount = randomInt(random, settings.branches);
    for (let i = 0; i < branchCount; i++) {
      const along = randomRange(random, 0.4, 0.9) * (TRUNK_POINTS - 1);
      const index = Math.floor(along);
      const from = trunkPath[index] ?? Vector3.Zero();
      const to = trunkPath[Math.min(index + 1, TRUNK_POINTS - 1)] ?? from;
      const start = Vector3.Lerp(from, to, along - index);

      const azimuth = random() * Math.PI * 2;
      const length = height * randomRange(random, 0.15, 0.3);
      const outward = new Vector3(
        Math.cos(azimuth),
        randomRange(random, 0.3, 0.9),
        Math.sin(azimuth),
      );
      outward.normalize();
      const bend = new Vector3(
        randomRange(random, -0.3, 0.3),
        randomRange(random, 0, 0.3),
        randomRange(random, -0.3, 0.3),
      );
      const middle = start.add(outward.scale(length * 0.5));
      const end = start.add(outward.add(bend).normalize().scale(length));
      const branchRadius = baseRadius * 0.35 * (1 - along / TRUNK_POINTS);

      const branch = MeshBuilder.CreateTube(
        `deadBranch${i}`,
        {
          path: [start, middle, end],
          radiusFunction: (point) => branchRadius * (1 - point * 0.45),
          tessellation: 5,
        },
        scene,
      );
      paint(branch, wood, seed + i);
      parts.push(branch);
    }

    const tree = assemble("deadTree", parts, getModelMaterials(scene).foliage);
    return { root: tree, animations: [] };
  },
};
