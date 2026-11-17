import { CONFIG } from "../config";
import type { Inventory } from "../player/inventory";
import type { ItemId } from "../player/items";
import type { Player } from "../player/player";
import type { ChunkManager, Pickable } from "../world/chunks";
import type { Interaction, InteractionSystem } from "./interactions";

/** What each thing on the ground gives, and the words for it. */
const GIVES: Record<Pickable["kind"], { item: ItemId; label: string }> = {
  groundBranch: { item: "branch", label: "Pegar galho" },
  rock: { item: "stone", label: "Pegar pedra" },
  bush: { item: "fiber", label: "Colher fibra" },
};

/**
 * Picking things up by hand (NBB-143, RF-58, CL1): E takes a dry branch or a small stone from the
 * ground; holding E on a bush pulls out its fiber. What was taken disappears from the world and
 * is remembered in its chunk's changes.
 */
export class PickupSystem {
  constructor(
    player: Player,
    chunks: ChunkManager,
    inventory: Inventory,
    interactions: InteractionSystem,
  ) {
    interactions.add(() => {
      const settings = CONFIG.inventory;
      const { x, z } = player.feet;
      const nearest = chunks.pickablesNear(x, z, settings.pickupReach)[0];
      if (!nearest) {
        return undefined;
      }
      const { item, label } = GIVES[nearest.kind];
      const count = nearest.kind === "bush" ? settings.fiberPerBush : 1;
      const distance = Math.hypot(nearest.x - x, nearest.z - z);
      if (inventory.spaceFor(item) < count) {
        return { label: "Inventário cheio", distance };
      }
      const take: Interaction = {
        label,
        distance,
        id: `${nearest.chunkKey}:${nearest.index}`,
        act: () => {
          chunks.removePlacement(nearest.chunkKey, nearest.index);
          inventory.add(item, count);
        },
      };
      if (nearest.kind === "bush") {
        take.holdSeconds = settings.fiberSeconds;
      }
      return take;
    });
  }
}
