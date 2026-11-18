/** Everything the player can carry (RF-50, RF-57). */
export type ItemId =
  | "knife"
  | "axe"
  | "torch"
  | "bow"
  | "shotgun"
  | "arrow"
  | "cartridge"
  | "branch"
  | "wood"
  | "stone"
  | "fiber"
  | "fat"
  | "leather"
  | "rawMeat"
  | "cookedMeat"
  | "campfire"
  | "bed";

/** The item names shown to the player (O4-A: pt-BR). */
export const ITEM_LABELS: Record<ItemId, string> = {
  knife: "Faca",
  axe: "Machado",
  torch: "Tocha",
  bow: "Arco",
  shotgun: "Espingarda",
  arrow: "Flecha",
  cartridge: "Cartucho",
  branch: "Galho",
  wood: "Madeira",
  stone: "Pedra",
  fiber: "Fibra",
  fat: "Gordura",
  leather: "Couro",
  rawMeat: "Carne crua",
  cookedMeat: "Carne cozida",
  campfire: "Fogueira",
  bed: "Cama",
};

/** Every item, in a fixed order (icons, development tools). */
export const ALL_ITEMS = Object.keys(ITEM_LABELS) as ItemId[];

/** RF-51: what a recipe makes, from what, and how long it takes (CF2-B). */
export interface Recipe {
  item: ItemId;
  count: number;
  seconds: number;
  cost: [ItemId, number][];
}

/** What the player holds: an item from the quick bar, or nothing. */
export type Held = ItemId | "hand";

/** Food eaten with the left button (IN2-A). */
export function isFood(item: Held): item is "rawMeat" | "cookedMeat" {
  return item === "rawMeat" || item === "cookedMeat";
}
