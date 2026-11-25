import { Color3, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { branchTubes, growBranches, type BranchSegment } from "../branching";
import { paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { plantModel } from "../plant";
import type { GeneratedModel, ModelGenerator } from "../types";
import { isYoungTree } from "./treeAge";

/**
 * Dead tree (W1, revised with the user's references): gnarled, twisting bare branches that
 * split again and again into sharp tips, root flares at the base, moss near the ground and,
 * sometimes, a second trunk.
 */
export const deadTree: ModelGenerator = {
  id: "dead-tree",
  label: "Árvore morta",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.deadTree;
    // FL1-A, FL3-A: grown trees are about twice as tall; a quarter stay young.
    const height = randomInRange(
      random,
      isYoungTree(seed) ? settings.youngHeight : settings.height,
    );
    const rules = {
      maxDepth: settings.depth,
      children: [2, 3],
      spread: [0.5, 1.05],
      lengthFactor: [0.55, 0.8],
      childStart: [0.45, 1],
      upward: 0.22,
      twist: 0.22,
      // 4 points per branch keeps the tree under ~1,200 triangles.
      pathPoints: 4,
      twigsPerTip: 2,
    } as const;

    const segments: BranchSegment[] = growBranches(
      random,
      Vector3.Zero(),
      new Vector3(randomRange(random, -0.15, 0.15), 1, randomRange(random, -0.15, 0.15)),
      height * 0.45,
      height * 0.055,
      rules,
    );

    if (random() < settings.secondTrunkChance) {
      const angle = random() * Math.PI * 2;
      segments.push(
        ...growBranches(
          random,
          new Vector3(Math.cos(angle) * height * 0.03, 0, Math.sin(angle) * height * 0.03),
          new Vector3(Math.cos(angle) * 0.35, 1, Math.sin(angle) * 0.35),
          height * 0.3,
          height * 0.035,
          { ...rules, maxDepth: Math.max(settings.depth - 1, 1) },
        ),
      );
    }

    // Root flares: short thick roots spreading out and down into the ground.
    const rootCount = randomInt(random, settings.roots);
    for (let i = 0; i < rootCount; i++) {
      const angle = (i / rootCount) * Math.PI * 2 + randomRange(random, -0.3, 0.3);
      const roots = growBranches(
        random,
        new Vector3(0, height * 0.07, 0),
        new Vector3(Math.cos(angle), -0.55, Math.sin(angle)),
        height * randomRange(random, 0.1, 0.17),
        height * 0.032,
        { ...rules, maxDepth: 0, twist: 0.15, upward: -0.1, pathPoints: 4, twigsPerTip: 0 },
      );
      for (const root of roots) {
        segments.push({ ...root, depth: 1 });
      }
    }

    const woodParts = branchTubes(segments, scene, "deadBranch");
    const wood = toColor(CONFIG.palette.deadWood);
    const moss = toColor(CONFIG.palette.moss);
    const mossTop = height * 0.14;
    woodParts.forEach((part, i) =>
      paint(
        part,
        (_x, y) =>
          y < mossTop ? Color3.Lerp(wood, moss, Math.min(1, (1 - y / mossTop) * 0.85)) : wood,
        seed + i,
      ),
    );

    return plantModel("deadTree", woodParts, getModelMaterials(scene).wood);
  },
};
