import { Mesh, MeshBuilder, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import {
  createRandom,
  hashPosition,
  randomInRange,
  randomInt,
  randomRange,
} from "../../core/random";
import { directionAt, pointAt } from "../branching";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

const MAIN_POINTS = 5;

/**
 * Dry branch lying on the ground (W1, revised with the user's references): a crooked, knobbly
 * stick with 0–2 short forks. It is the branch that snaps when stepped on (RF-11).
 */
export const groundBranch: ModelGenerator = {
  id: "ground-branch",
  label: "Galho seco",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.groundBranch;
    const length = randomInRange(random, settings.length);
    const radius = randomRange(random, 0.022, 0.035);

    const path: Vector3[] = [];
    for (let i = 0; i < MAIN_POINTS; i++) {
      const t = i / (MAIN_POINTS - 1);
      // A gentle bow plus small noise: crooked like a real stick, not a zigzag.
      const bow = Math.sin(t * Math.PI) * length * 0.06;
      path.push(new Vector3((t - 0.5) * length, radius, bow + randomRange(random, -0.012, 0.012)));
    }
    // Knobs: the radius bumps up and down along the stick.
    const main = MeshBuilder.CreateTube(
      "groundBranchMain",
      {
        path,
        radiusFunction: (i) => {
          const t = i / (MAIN_POINTS - 1);
          const knob = 1 + (hashPosition(i, seed, 0, 17) - 0.5) * 0.5;
          return radius * (1 - t * 0.4) * knob;
        },
        tessellation: 6,
        cap: Mesh.CAP_ALL,
      },
      scene,
    );
    const parts: Mesh[] = [main];

    const forkCount = randomInt(random, settings.forks);
    for (let f = 0; f < forkCount; f++) {
      const t = randomRange(random, 0.3, 0.75);
      const start = pointAt(path, t);
      const along = directionAt(path, t);
      const side = random() < 0.5 ? -1 : 1;
      const angle = side * randomRange(random, 0.5, 0.9);
      const direction = new Vector3(
        along.x * Math.cos(angle) - along.z * Math.sin(angle),
        0,
        along.x * Math.sin(angle) + along.z * Math.cos(angle),
      );
      const forkLength = length * randomRange(random, 0.15, 0.35);
      const forkRadius = radius * 0.55;
      parts.push(
        MeshBuilder.CreateTube(
          `groundBranchFork${f}`,
          {
            path: [
              start,
              start.add(direction.scale(forkLength * 0.5)),
              start.add(direction.scale(forkLength)).add(new Vector3(0, -forkRadius * 0.3, 0)),
            ],
            radiusFunction: (i) => forkRadius * (1 - i * 0.3),
            tessellation: 5,
            cap: Mesh.CAP_END,
          },
          scene,
        ),
      );
    }

    const rotation = random() * Math.PI;
    const wood = toColor(CONFIG.palette.deadWood).scale(0.8);
    for (const part of parts) {
      part.rotation.y = rotation;
      part.bakeCurrentTransformIntoVertices();
      paint(part, wood, seed);
    }

    const model = assemble("groundBranch", parts, getModelMaterials(scene).solid);
    return { root: model, animations: [] };
  },
};
