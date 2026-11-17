import type { Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { InteractionSystem } from "../systems/interactions";
import type { Equipment } from "./equipment";
import type { PlayerHunger } from "./hunger";
import type { Inventory } from "./inventory";
import { isFood } from "./items";
import type { Player } from "./player";

/**
 * IN2-A (RF-57): with meat selected on the quick bar, the left button ("usar item", G2) eats one
 * piece of it: cooked meat fills more than raw (RF-35).
 */
export class Eating {
  private readonly equipment: Equipment;
  private readonly inventory: Inventory;
  private readonly hunger: PlayerHunger;
  private readonly interactions: InteractionSystem;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    equipment: Equipment,
    inventory: Inventory,
    hunger: PlayerHunger,
    interactions: InteractionSystem,
  ) {
    this.equipment = equipment;
    this.inventory = inventory;
    this.hunger = hunger;
    this.interactions = interactions;
    scene.onBeforeRenderObservable.add(() => {
      if (player.controlsEnabled && input.wasPressed("Mouse0")) {
        this.eat();
      }
    });
  }

  /** Eats one piece of the meat in hand, if that is what is held (also for development). */
  eat(): void {
    const held = this.equipment.current;
    if (!isFood(held)) {
      return;
    }
    if (this.hunger.isFull) {
      this.interactions.say("Você está sem fome");
      return;
    }
    if (this.inventory.takeFromSlot(this.inventory.selected) !== held) {
      return;
    }
    const settings = CONFIG.player.hunger;
    this.hunger.eat(held === "cookedMeat" ? settings.cookedMeat : settings.rawMeat);
    this.interactions.say(`Você comeu: ${held === "cookedMeat" ? "carne cozida" : "carne crua"}`);
  }
}
