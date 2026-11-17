import { Observable, type Scene } from "@babylonjs/core";
import type { Input } from "../core/input";
import type { Inventory } from "./inventory";
import type { Held } from "./items";

const SLOT_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"];

/**
 * What the hands hold (NBB-143, G2, RF-57): the item in the selected quick-bar slot, picked with
 * 1 to 6 or the mouse wheel. Other systems listen to `onChanged` (the hands, the torch and each
 * weapon).
 */
export class Equipment {
  readonly onChanged = new Observable<Held>();
  private held: Held;
  private readonly inventory: Inventory;

  constructor(scene: Scene, input: Input, inventory: Inventory) {
    this.inventory = inventory;
    this.held = inventory.selectedItem ?? "hand";
    inventory.onChanged.add(() => this.refresh());
    scene.onBeforeRenderObservable.add(() => {
      SLOT_KEYS.forEach((key, slot) => {
        if (input.wasPressed(key)) {
          inventory.select(slot);
        }
      });
      const wheel = input.consumeWheel();
      if (wheel !== 0) {
        inventory.select(inventory.selected + wheel);
      }
    });
  }

  get current(): Held {
    return this.held;
  }

  /** Development only: selects the first quick-bar slot holding `item`. */
  equip(item: Held): void {
    for (let slot = 0; slot < 6; slot++) {
      if ((this.inventory.slot(slot)?.item ?? "hand") === item) {
        this.inventory.select(slot);
        return;
      }
    }
  }

  private refresh(): void {
    const held = this.inventory.selectedItem ?? "hand";
    if (held !== this.held) {
      this.held = held;
      this.onChanged.notifyObservers(held);
    }
  }
}
