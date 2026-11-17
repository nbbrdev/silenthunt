import { Observable, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Inventory } from "./inventory";
import { ITEM_LABELS, type Recipe } from "./items";

/**
 * Making things (NBB-144, RF-51, RF-59, CF1-A, CF2-B): a recipe takes its time (2 to 3 s) while
 * the world goes on; the materials are used up when it is done. It stops if the materials run
 * out on the way, or if the inventory screen closes.
 */
export class Crafting {
  /** Fired when something starts, finishes or stops. */
  readonly onChanged = new Observable<void>();

  private readonly inventory: Inventory;
  private readonly say: (text: string) => void;
  private current: { recipe: Recipe; seconds: number } | undefined;

  constructor(scene: Scene, inventory: Inventory, say: (text: string) => void) {
    this.inventory = inventory;
    this.say = say;
    scene.onBeforeRenderObservable.add(() => {
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  get recipes(): readonly Recipe[] {
    return CONFIG.crafting.recipes;
  }

  /** What is being made and how far along (0 to 1), if anything. */
  get progress(): { recipe: Recipe; fraction: number } | undefined {
    if (!this.current) {
      return undefined;
    }
    const { recipe, seconds } = this.current;
    return { recipe, fraction: Math.min(1, seconds / recipe.seconds) };
  }

  /** True if the materials are there and the result fits. */
  canMake(recipe: Recipe): boolean {
    return (
      recipe.cost.every(([item, count]) => this.inventory.count(item) >= count) &&
      this.inventory.spaceFor(recipe.item) >= recipe.count
    );
  }

  start(recipe: Recipe): void {
    if (this.current || !this.canMake(recipe)) {
      return;
    }
    this.current = { recipe, seconds: 0 };
    this.onChanged.notifyObservers();
  }

  stop(): void {
    if (this.current) {
      this.current = undefined;
      this.onChanged.notifyObservers();
    }
  }

  private update(seconds: number): void {
    const current = this.current;
    if (!current) {
      return;
    }
    const { recipe } = current;
    if (!this.canMake(recipe)) {
      this.stop();
      return;
    }
    current.seconds += seconds;
    if (current.seconds < recipe.seconds) {
      return;
    }
    for (const [item, count] of recipe.cost) {
      this.inventory.remove(item, count);
    }
    this.inventory.add(recipe.item, recipe.count);
    this.current = undefined;
    const name = ITEM_LABELS[recipe.item];
    this.say(`Você fez: ${recipe.count > 1 ? `${name} (${recipe.count})` : name}`);
    this.onChanged.notifyObservers();
  }
}
