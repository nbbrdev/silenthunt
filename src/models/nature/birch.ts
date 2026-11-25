import { Color3, Vector3, type Scene } from "@babylonjs/core";
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
 * Birch (BM4-A, NBB-163): a slender white trunk that keeps going up, with short dark marks across
 * the bark (thicker near the base) and a light, airy crown of small hanging leaves. Grows in the
 * broadleaf wood and, sparser, in the marsh.
 */
export const birch: ModelGenerator = {
  id: "birch",
  label: "Bétula",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.birch;
    // FL1-A, FL3-A: grown trees are about twice as tall; a quarter stay young.
    const young = isYoungTree(seed);
    const height = randomInRange(random, young ? settings.youngHeight : settings.height);
    const floor = crownFloor(height, young);

    const segments = growBranches(
      random,
      Vector3.Zero(),
      new Vector3(randomRange(random, -0.05, 0.05), 1, randomRange(random, -0.05, 0.05)),
      height * 0.5,
      height * 0.022,
      {
        maxDepth: settings.depth,
        children: [2, 3],
        spread: [0.3, 0.6],
        lengthFactor: [0.5, 0.7],
        childStart: [0.45, 0.95],
        upward: 0.45,
        twist: 0.08,
        pathPoints: 4,
        // The trunk carries on straight to the top, as a birch's does.
        leader: true,
      },
    );

    const woodParts = branchTubes(segments, scene, "birchBranch");
    // The marks come from the birch's own bark texture; low on the trunk it darkens, as old
    // birches do at the base.
    const bark = toColor(CONFIG.palette.birchBark);
    const marks = toColor(CONFIG.palette.birchMarks);
    woodParts.forEach((part, i) =>
      paint(part, (_x, y) => (y < height * 0.08 ? Color3.Lerp(bark, marks, 0.45) : bark), seed + i),
    );

    // Small leaf cards along the upper twigs: a light, see-through crown.
    const cards = new CardBuilder();
    const crownCenter = Vector3.Zero();
    let crownPoints = 0;
    for (const segment of segments) {
      if (segment.depth < settings.depth - 1) {
        continue;
      }
      const perTwig = young ? settings.leafCardsPerTwig : settings.grownLeafCards;
      const count = segment.isTip ? randomInt(random, perTwig) : 3;
      for (let i = 0; i < count; i++) {
        const size = Math.min(height * randomRange(random, 0.13, 0.19), settings.leafMax);
        const center = pointAt(segment.path, randomRange(random, 0.3, 1)).add(
          randomDirection(random).scale(size * 0.3),
        );
        const normal = randomDirection(random);
        // FL2-A: no leaves hang down into the view.
        if (center.y - size / 2 < floor) {
          continue;
        }
        // Leaves hang: the card's top points up, so the drawn twigs droop down it.
        cards.addCard(center, size, size, normal, Vector3.Up());
        crownCenter.addInPlace(center);
        crownPoints++;
      }
    }
    crownCenter.scaleInPlace(1 / Math.max(crownPoints, 1));
    const leaves = cards.build(
      "birchLeaves",
      scene,
      crownCenter.subtract(new Vector3(0, height * 0.08, 0)),
    );
    paint(leaves, toColor(CONFIG.palette.birchLeaves), seed + 500);

    const materials = getModelMaterials(scene);
    return plantModel("birch", woodParts, materials.birchWood, {
      mesh: leaves,
      material: materials.leaves.birch,
    });
  },
};
