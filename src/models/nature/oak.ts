import { Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { branchTubes, growBranches, pointAt } from "../branching";
import { CardBuilder, randomDirection } from "../cards";
import { paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { plantModel } from "../plant";
import type { GeneratedModel, ModelGenerator } from "../types";
import { crownFloor, isYoungTree } from "./treeAge";

/**
 * Oak (W1, revised with the user's references): a trunk that forks into limbs, recursively, with
 * clusters of leaf cards on the outer twigs forming a broad crown.
 */
export const oak: ModelGenerator = {
  id: "oak",
  label: "Carvalho",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.oak;
    // FL1-A, FL3-A: grown trees are about twice as tall; a quarter stay young.
    const young = isYoungTree(seed);
    const height = randomInRange(random, young ? settings.youngHeight : settings.height);
    const floor = crownFloor(height, young);

    const segments = growBranches(
      random,
      Vector3.Zero(),
      new Vector3(randomRange(random, -0.08, 0.08), 1, randomRange(random, -0.08, 0.08)),
      // FL2-A: a grown oak's trunk is longer and forks near its top, so the crown stays high.
      height * (young ? 0.38 : settings.grownTrunk),
      height * 0.05,
      {
        maxDepth: settings.depth,
        children: [2, 3],
        spread: [0.35, 0.8],
        lengthFactor: [0.62, 0.82],
        childStart: young ? [0.6, 1] : settings.grownForkAt,
        upward: 0.3,
        twist: 0.12,
        pathPoints: 4,
        // No leader: limbs fork apart into a broad crown, like the references.
        leader: false,
      },
    );

    const woodParts = branchTubes(segments, scene, "oakBranch");
    const bark = toColor(CONFIG.palette.bark);
    woodParts.forEach((part, i) => paint(part, bark, seed + i));

    // Leaf clusters along the outer twigs and the branches just before them.
    const cards = new CardBuilder();
    const crownCenter = Vector3.Zero();
    let crownPoints = 0;
    for (const segment of segments) {
      if (segment.depth < settings.depth - 1) {
        continue;
      }
      const perTwig = young ? settings.leafCardsPerTwig : settings.grownLeafCards;
      const count = segment.isTip ? randomInt(random, perTwig) : 4;
      for (let i = 0; i < count; i++) {
        const size = Math.min(height * randomRange(random, 0.17, 0.25), settings.leafMax);
        const center = pointAt(segment.path, randomRange(random, 0.35, 1)).add(
          randomDirection(random).scale(size * 0.35),
        );
        const normal = randomDirection(random);
        const up = randomDirection(random);
        // FL2-A: no leaves hang down into the view.
        if (center.y - size / 2 < floor) {
          continue;
        }
        cards.addCard(center, size, size, normal, up);
        crownCenter.addInPlace(center);
        crownPoints++;
      }
    }
    crownCenter.scaleInPlace(1 / Math.max(crownPoints, 1));

    const leaves = cards.build(
      "oakLeaves",
      scene,
      crownCenter.subtract(new Vector3(0, height * 0.1, 0)),
    );
    paint(leaves, toColor(CONFIG.palette.oakLeaves), seed + 500);

    const materials = getModelMaterials(scene);
    return plantModel("oak", woodParts, materials.wood, {
      mesh: leaves,
      material: materials.leaves.broadleaf,
    });
  },
};
