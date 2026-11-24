import { Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { CardBuilder } from "../cards";
import { paint, toColor, type RGB } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { FoliageKind } from "../textures";
import type { GeneratedModel, ModelGenerator } from "../types";

/**
 * A clump of tall upright cards spread over a small patch, all crossing, so it looks full from
 * every side (the reeds and the tall grass, BM4-A).
 */
function clump(
  scene: Scene,
  seed: number,
  name: string,
  settings: { height: readonly [number, number]; cards: readonly [number, number] },
  color: RGB,
  foliage: FoliageKind,
  spread: number,
): GeneratedModel {
  const random = createRandom(seed);
  const height = randomInRange(random, settings.height);
  const cardCount = randomInt(random, settings.cards);

  const cards = new CardBuilder();
  for (let i = 0; i < cardCount; i++) {
    const angle = (i / cardCount) * Math.PI + randomRange(random, -0.3, 0.3);
    const cardHeight = height * randomRange(random, 0.85, 1.1);
    cards.addCard(
      new Vector3(
        randomRange(random, -spread, spread),
        cardHeight / 2,
        randomRange(random, -spread, spread),
      ),
      cardHeight * randomRange(random, 0.7, 0.95),
      cardHeight,
      new Vector3(Math.cos(angle), 0, Math.sin(angle)),
      Vector3.Up(),
    );
  }
  // Normals pointing up and out, so the clump is lit like the ground under it.
  const mesh = cards.build(name, scene, new Vector3(0, -height, 0));
  paint(mesh, toColor(color), seed);
  mesh.material = getModelMaterials(scene).leaves[foliage];
  return { root: mesh, animations: [] };
}

/** Reeds (BM4-A, NBB-163): a clump of marsh reeds with a few cattails, taller than a crouch. */
export const reeds: ModelGenerator = {
  id: "reeds",
  label: "Juncos",
  create(scene: Scene, seed: number): GeneratedModel {
    return clump(scene, seed, "reeds", CONFIG.models.reeds, CONFIG.palette.reeds, "reeds", 0.35);
  },
};

/** Tall grass (BM4-A, NBB-163): a clump of the open field's dry grass, up to a crouch's eyes. */
export const tallGrass: ModelGenerator = {
  id: "tall-grass",
  label: "Capim alto",
  create(scene: Scene, seed: number): GeneratedModel {
    return clump(
      scene,
      seed,
      "tallGrass",
      CONFIG.models.tallGrass,
      CONFIG.palette.tallGrass,
      "tallGrass",
      0.5,
    );
  },
};
