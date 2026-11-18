import { Observable } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { ItemId } from "./items";

/** Some of one item in one slot. */
export interface Stack {
  item: ItemId;
  count: number;
}

/**
 * The player's inventory (NBB-143, RF-57, IN1-A): 6 quick-bar slots (0 to 5) and 18 backpack
 * slots, each holding a stack of one item, up to that item's stack size. When it is full, nothing
 * more fits. One quick-bar slot is selected: its item is what the player holds.
 */
export class Inventory {
  /** Fired whenever a slot or the selection changes. */
  readonly onChanged = new Observable<void>();

  private readonly slots: (Stack | undefined)[];
  private selectedSlot = 0;

  constructor() {
    const { hotbarSlots, backpackSlots } = CONFIG.inventory;
    this.slots = new Array<Stack | undefined>(hotbarSlots + backpackSlots).fill(undefined);
  }

  get size(): number {
    return this.slots.length;
  }

  /** The selected quick-bar slot (0 to 5). */
  get selected(): number {
    return this.selectedSlot;
  }

  /** The item in the selected slot, if any. */
  get selectedItem(): ItemId | undefined {
    return this.slots[this.selectedSlot]?.item;
  }

  select(slot: number): void {
    const { hotbarSlots } = CONFIG.inventory;
    const next = ((slot % hotbarSlots) + hotbarSlots) % hotbarSlots;
    if (next !== this.selectedSlot) {
      this.selectedSlot = next;
      this.onChanged.notifyObservers();
    }
  }

  /** NBB-147: every slot (empty ones as null), for the save. */
  get saved(): (Stack | null)[] {
    return this.slots.map((stack) => (stack ? { ...stack } : null));
  }

  /** NBB-147: a saved game's slots and selected quick-bar slot. */
  restore(slots: readonly (Stack | null)[], selected: number): void {
    for (let index = 0; index < this.slots.length; index++) {
      const stack = slots[index];
      this.slots[index] = stack && stack.count > 0 ? { ...stack } : undefined;
    }
    this.selectedSlot = Math.max(0, Math.min(CONFIG.inventory.hotbarSlots - 1, selected));
    this.onChanged.notifyObservers();
  }

  slot(index: number): Stack | undefined {
    const stack = this.slots[index];
    return stack ? { ...stack } : undefined;
  }

  /** Puts a stack (or nothing) in a slot, as it is (the inventory screen moves items this way). */
  setSlot(index: number, stack: Stack | undefined): void {
    this.slots[index] = stack && stack.count > 0 ? { ...stack } : undefined;
    this.onChanged.notifyObservers();
  }

  count(item: ItemId): number {
    let total = 0;
    for (const stack of this.slots) {
      if (stack?.item === item) {
        total += stack.count;
      }
    }
    return total;
  }

  /** How many more of `item` would fit. */
  spaceFor(item: ItemId): number {
    const max = CONFIG.inventory.stack[item];
    let space = 0;
    for (const stack of this.slots) {
      if (!stack) {
        space += max;
      } else if (stack.item === item) {
        space += max - stack.count;
      }
    }
    return space;
  }

  /** True if all of these fit together (each one taking its own slots). */
  canFit(items: readonly Stack[]): boolean {
    let freeSlots = this.slots.filter((stack) => !stack).length;
    for (const { item, count } of items) {
      const max = CONFIG.inventory.stack[item];
      let left = count;
      for (const stack of this.slots) {
        if (stack?.item === item) {
          left -= max - stack.count;
        }
      }
      if (left > 0) {
        freeSlots -= Math.ceil(left / max);
      }
    }
    return freeSlots >= 0;
  }

  /**
   * Adds up to `count`: first onto stacks of the same item, then into empty slots (the quick bar
   * first). Returns how many were added.
   */
  add(item: ItemId, count: number): number {
    const max = CONFIG.inventory.stack[item];
    let left = count;
    for (const stack of this.slots) {
      if (left <= 0) {
        break;
      }
      if (stack?.item === item && stack.count < max) {
        const moved = Math.min(left, max - stack.count);
        stack.count += moved;
        left -= moved;
      }
    }
    for (let index = 0; index < this.slots.length && left > 0; index++) {
      if (!this.slots[index]) {
        const moved = Math.min(left, max);
        this.slots[index] = { item, count: moved };
        left -= moved;
      }
    }
    if (left < count) {
      this.onChanged.notifyObservers();
    }
    return count - left;
  }

  /** Takes one from a given slot (eating what is in hand, IN2-A). */
  takeFromSlot(index: number): ItemId | undefined {
    const stack = this.slots[index];
    if (!stack) {
      return undefined;
    }
    stack.count--;
    if (stack.count <= 0) {
      this.slots[index] = undefined;
    }
    this.onChanged.notifyObservers();
    return stack.item;
  }

  /** Takes `count` of `item` (from the last slots first); false, taking nothing, if short. */
  remove(item: ItemId, count = 1): boolean {
    if (this.count(item) < count) {
      return false;
    }
    let left = count;
    for (let index = this.slots.length - 1; index >= 0 && left > 0; index--) {
      const stack = this.slots[index];
      if (stack?.item !== item) {
        continue;
      }
      const taken = Math.min(left, stack.count);
      stack.count -= taken;
      left -= taken;
      if (stack.count <= 0) {
        this.slots[index] = undefined;
      }
    }
    this.onChanged.notifyObservers();
    return true;
  }
}
