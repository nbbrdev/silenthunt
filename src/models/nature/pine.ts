import { Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { branchTubes, directionAt, pointAt, type BranchSegment } from "../branching";
import { CardBuilder } from "../cards";
import { paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { plantModel } from "../plant";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Golden angle: spreads branches evenly around the trunk, like real conifers. */
const GOLDEN_ANGLE = 2.39996;

/**
 * Pine (W1, revised with the user's references): straight trunk with spiraling side branches
 * that droop more at the bottom, covered in needle cards, narrowing to a pointed top.
 */
export const pine: ModelGenerator = {
  id: "pine",
  label: "Pinheiro",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.pine;
    const height = randomInRange(random, settings.height);

    const trunkPath: Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      trunkPath.push(
        new Vector3(
          randomRange(random, -0.04, 0.04) * height * t,
          t * height,
          randomRange(random, -0.04, 0.04) * height * t,
        ),
      );
    }
    const segments: BranchSegment[] = [
      { path: trunkPath, radiusStart: height * 0.025, radiusEnd: 0.02, depth: 0, isTip: false },
    ];

    const cards = new CardBuilder();
    const branchCount = randomInt(random, settings.branches);
    for (let i = 0; i < branchCount; i++) {
      const t = 0.18 + (i / branchCount) * 0.78 + randomRange(random, -0.02, 0.02);
      const azimuth = i * GOLDEN_ANGLE + randomRange(random, -0.3, 0.3);
      const length = (1 - t) * height * 0.32 + 0.35;
      // Low branches droop, high ones point slightly up.
      const droop = -0.35 + t * 0.5;
      const direction = new Vector3(Math.cos(azimuth), droop, Math.sin(azimuth)).normalize();
      const start = pointAt(trunkPath, t);
      const middle = start.add(direction.scale(length * 0.5));
      const end = start.add(direction.scale(length)).add(new Vector3(0, -length * 0.15, 0));
      const radius = height * 0.012 * (1 - t) + 0.015;
      const branchPath = [start, middle, end];
      segments.push({
        path: branchPath,
        radiusStart: radius,
        radiusEnd: radius * 0.25,
        depth: 3,
        isTip: true,
      });

      // Needle cards lie mostly flat along the branch, building up the layered look.
      const cardCount = randomInt(random, settings.needleCardsPerBranch);
      for (let c = 0; c < cardCount; c++) {
        const along = randomRange(random, 0.3, 1);
        const size = length * randomRange(random, 0.65, 0.95);
        const normal = new Vector3(
          randomRange(random, -0.4, 0.4),
          1,
          randomRange(random, -0.4, 0.4),
        );
        cards.addCard(
          pointAt(branchPath, along).add(new Vector3(0, -size * 0.1, 0)),
          size,
          size,
          normal,
          directionAt(branchPath, along),
        );
      }
    }

    // A small cluster closes the pointed top.
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI;
      cards.addCard(
        new Vector3(0, height * 0.96, 0),
        height * 0.09,
        height * 0.12,
        new Vector3(Math.cos(angle), 0, Math.sin(angle)),
        Vector3.Up(),
      );
    }

    const woodParts = branchTubes(segments, scene, "pineBranch");
    const bark = toColor(CONFIG.palette.bark);
    woodParts.forEach((part, i) => paint(part, bark, seed + i));

    const needles = cards.build("pineNeedles", scene, new Vector3(0, height * 0.45, 0));
    paint(needles, toColor(CONFIG.palette.pineNeedles), seed + 500);

    const materials = getModelMaterials(scene);
    return plantModel("pine", woodParts, materials.wood, {
      mesh: needles,
      material: materials.leaves.needles,
    });
  },
};
