import { CONFIG } from "../../config";

/**
 * NBB-169 (FL3-A): a quarter of the trees are young ones, of the old size and shape. It goes by
 * the model's seed: the world's variations are seeded 1000 + 17 × n, so variations 2 and 6 of
 * each tree are young; in the gallery, seeds 2, 6, 10... show a young one.
 */
export function isYoungTree(seed: number): boolean {
  return seed % 4 === 2;
}

/**
 * FL2-A: the lowest a grown tree's foliage may reach (meters above its foot), so the view stays
 * clear under the crowns. Young trees have none (0).
 */
export function crownFloor(height: number, young: boolean): number {
  const { crownStart, crownFloor: floor } = CONFIG.models.trees;
  return young ? 0 : Math.max(height * crownStart, floor);
}
