import { Color3, MeshBuilder, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomRange } from "../../core/random";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Rock (W1): irregular flattened block, partly buried, with moss on top (W2). ~80 tris. */
export const rock: ModelGenerator = {
  id: "rock",
  label: "Pedra",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const size = randomInRange(random, CONFIG.models.rock.size);

    const stone = MeshBuilder.CreateIcoSphere(
      "rockBody",
      { radius: size / 2, subdivisions: 2, flat: true },
      scene,
    );
    stone.scaling.set(randomRange(random, 0.9, 1.2), randomRange(random, 0.55, 0.75), 1);
    stone.rotation.y = random() * Math.PI;
    stone.position.y = size * 0.15; // Partly buried, so it sits in the ground.
    bake(stone);
    jitter(stone, size * 0.12, seed);

    const rockColor = toColor(CONFIG.palette.rock);
    const mossColor = toColor(CONFIG.palette.moss);
    const mossFrom = size * 0.35;
    paint(
      stone,
      (_x, y) => (y > mossFrom ? Color3.Lerp(rockColor, mossColor, 0.75) : rockColor),
      seed,
    );

    // Rocks keep the faceted look: it reads as chipped stone.
    const model = assemble("rock", [stone], getModelMaterials(scene).stone, { flatShaded: true });
    return { root: model, animations: [] };
  },
};
