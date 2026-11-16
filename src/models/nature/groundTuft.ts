import { Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { CardBuilder } from "../cards";
import { paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Ground foliage tuft (W1, revised): 2–3 crossed upright cards of drawn grass blades. */
export const groundTuft: ModelGenerator = {
  id: "ground-tuft",
  label: "Folhagem do chão",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.groundTuft;
    const height = randomInRange(random, settings.height);
    const cardCount = randomInt(random, settings.cards);

    const cards = new CardBuilder();
    for (let i = 0; i < cardCount; i++) {
      const angle = (i / cardCount) * Math.PI + randomRange(random, -0.25, 0.25);
      cards.addCard(
        new Vector3(0, height / 2, 0),
        height * randomRange(random, 0.8, 1.1),
        height,
        new Vector3(Math.cos(angle), 0, Math.sin(angle)),
        Vector3.Up(),
      );
    }

    // Normals pointing up and out, so the grass is lit like the ground under it.
    const tuft = cards.build("groundTuft", scene, new Vector3(0, -height, 0));
    paint(tuft, toColor(CONFIG.palette.grass), seed);
    tuft.material = getModelMaterials(scene).leaves.grass;
    return { root: tuft, animations: [] };
  },
};
