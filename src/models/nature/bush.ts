import { Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { branchTubes, type BranchSegment } from "../branching";
import { CardBuilder, randomDirection } from "../cards";
import { paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { plantModel } from "../plant";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Bush (W1, revised with the user's references): a dome of leaf clusters over a few twigs. */
export const bush: ModelGenerator = {
  id: "bush",
  label: "Arbusto",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.bush;
    const height = randomInRange(random, settings.height);
    const center = new Vector3(0, height * 0.5, 0);

    // A few twigs fanning out from the base (mostly hidden, they anchor the leaves).
    const twigs: BranchSegment[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + randomRange(random, -0.4, 0.4);
      const tip = new Vector3(
        Math.cos(angle) * height * 0.4,
        height * randomRange(random, 0.55, 0.85),
        Math.sin(angle) * height * 0.4,
      );
      twigs.push({
        path: [Vector3.Zero(), tip.scale(0.5).add(new Vector3(0, height * 0.05, 0)), tip],
        radiusStart: height * 0.025,
        radiusEnd: height * 0.006,
        depth: 3,
        isTip: true,
      });
    }

    const cards = new CardBuilder();
    const cardCount = randomInt(random, settings.leafCards);
    for (let i = 0; i < cardCount; i++) {
      const direction = randomDirection(random);
      direction.y = Math.abs(direction.y) * 0.9 + 0.1; // Upper half: a dome, not a ball.
      const position = center.add(
        new Vector3(direction.x * 1.3, direction.y * 0.8 - 0.2, direction.z * 1.3).scale(
          height * randomRange(random, 0.15, 0.5),
        ),
      );
      const size = height * randomRange(random, 0.45, 0.7);
      cards.addCard(position, size, size, randomDirection(random), randomDirection(random));
    }

    const woodParts = branchTubes(twigs, scene, "bushTwig");
    const bark = toColor(CONFIG.palette.bark);
    woodParts.forEach((part, i) => paint(part, bark, seed + i));

    const leaves = cards.build("bushLeaves", scene, new Vector3(0, height * 0.3, 0));
    paint(leaves, toColor(CONFIG.palette.oakLeaves), seed + 500);

    const materials = getModelMaterials(scene);
    return plantModel("bush", woodParts, materials.wood, {
      mesh: leaves,
      material: materials.leaves.broadleaf,
    });
  },
};
