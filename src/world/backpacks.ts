import type { InstancedMesh, Mesh, Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import { createBackpackMesh } from "../models/items/backpack";
import type { Inventory, Stack } from "../player/inventory";
import type { Player } from "../player/player";
import type { Interaction, InteractionSystem } from "../systems/interactions";
import type { StructureManager } from "./structures";
import type { Terrain } from "./terrain";

interface Backpack {
  id: number;
  mesh: InstancedMesh;
  stacks: Stack[];
}

/** A backpack as the save keeps it (NBB-147, MO3-A). */
export interface SavedBackpack {
  x: number;
  y: number;
  z: number;
  heading: number;
  stacks: Stack[];
}

/** What the backpacks touch in the rest of the game. */
export interface BackpackWorld {
  terrain: Terrain;
  structures: StructureManager;
  inventory: Inventory;
  interactions: InteractionSystem;
}

/**
 * The backpacks left where the player died (NBB-148; RF-60, M12-A, MO1-A to MO4-A). Each one
 * holds what the player carried. E takes everything that fits; what does not fit stays in it, and
 * an empty one goes away. They never go away on their own and there may be several.
 */
export class BackpackManager {
  private readonly player: Player;
  private readonly world: BackpackWorld;
  private readonly template: Mesh;
  private readonly backpacks: Backpack[] = [];
  private nextId = 1;

  constructor(scene: Scene, player: Player, world: BackpackWorld) {
    this.player = player;
    this.world = world;
    this.template = createBackpackMesh(scene);
    this.template.setEnabled(false);
    world.interactions.add(() => this.interaction());
  }

  /** The backpacks, where they are and how many stacks each holds (development). */
  get list(): { at: number[]; stacks: number }[] {
    return this.backpacks.map(({ mesh, stacks }) => ({
      at: mesh.position.asArray().map((value) => Math.round(value * 10) / 10),
      stacks: stacks.length,
    }));
  }

  /**
   * MO1-A: a backpack with these stacks, on the ground (or the floor) under (x, z). `feetY` is
   * the height of the player's feet: a floor counts only if the player stood on it.
   */
  drop(x: number, feetY: number, z: number, heading: number, stacks: readonly Stack[]): void {
    const kept = stacks.filter((stack) => stack.count > 0).map((stack) => ({ ...stack }));
    if (kept.length === 0) {
      return;
    }
    const floor = this.world.structures.floorAt(x, z);
    const y =
      floor !== undefined && feetY >= floor - 0.3 ? floor : this.world.terrain.heightAt(x, z);
    this.add({ x, y, z, heading, stacks: kept });
  }

  /** NBB-147: the backpacks, for the save. */
  get saved(): SavedBackpack[] {
    return this.backpacks.map(({ mesh, stacks }) => ({
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      heading: mesh.rotation.y,
      stacks: stacks.map((stack) => ({ ...stack })),
    }));
  }

  /** NBB-147: a saved game's backpacks. */
  restore(saved: readonly SavedBackpack[]): void {
    for (const backpack of saved) {
      this.add(backpack);
    }
  }

  private add({ x, y, z, heading, stacks }: SavedBackpack): void {
    const mesh = this.template.createInstance(`backpack${this.nextId}`);
    mesh.setEnabled(true);
    mesh.position.set(x, y, z);
    mesh.rotation.y = heading;
    this.backpacks.push({ id: this.nextId++, mesh, stacks: stacks.map((stack) => ({ ...stack })) });
  }

  private interaction(): Interaction | undefined {
    const feet = this.player.feet;
    let nearest: { backpack: Backpack; distance: number } | undefined;
    for (const backpack of this.backpacks) {
      const at = backpack.mesh.position;
      const distance = Math.hypot(at.x - feet.x, at.z - feet.z);
      if (distance <= CONFIG.backpack.reach && (!nearest || distance < nearest.distance)) {
        nearest = { backpack, distance };
      }
    }
    if (!nearest) {
      return undefined;
    }
    const { backpack, distance } = nearest;
    return {
      label: "Pegar mochila",
      distance,
      id: `backpack${backpack.id}`,
      act: () => this.take(backpack),
    };
  }

  /** MO2-A: everything that fits goes to the inventory; an empty backpack goes away. */
  private take(backpack: Backpack): void {
    const { inventory, interactions } = this.world;
    for (const stack of backpack.stacks) {
      stack.count -= inventory.add(stack.item, stack.count);
    }
    backpack.stacks = backpack.stacks.filter((stack) => stack.count > 0);
    if (backpack.stacks.length > 0) {
      interactions.say("Inventário cheio");
      return;
    }
    backpack.mesh.dispose();
    this.backpacks.splice(this.backpacks.indexOf(backpack), 1);
  }
}
