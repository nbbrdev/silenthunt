/** Everything the player can carry (RF-50, RF-57). */
export type ItemId =
  | "knife"
  | "bow"
  | "shotgun"
  | "arrow"
  | "cartridge"
  | "branch"
  | "stone"
  | "fiber"
  | "fat"
  | "leather"
  | "rawMeat"
  | "cookedMeat";

/** The item names shown to the player (O4-A: pt-BR). */
export const ITEM_LABELS: Record<ItemId, string> = {
  knife: "Faca",
  bow: "Arco",
  shotgun: "Espingarda",
  arrow: "Flecha",
  cartridge: "Cartucho",
  branch: "Galho",
  stone: "Pedra",
  fiber: "Fibra",
  fat: "Gordura",
  leather: "Couro",
  rawMeat: "Carne crua",
  cookedMeat: "Carne cozida",
};

/** Every item, in a fixed order (icons, development tools). */
export const ALL_ITEMS = Object.keys(ITEM_LABELS) as ItemId[];

/** What the player holds: an item from the quick bar, or nothing. */
export type Held = ItemId | "hand";

/** Food eaten with the left button (IN2-A). */
export function isFood(item: Held): item is "rawMeat" | "cookedMeat" {
  return item === "rawMeat" || item === "cookedMeat";
}
