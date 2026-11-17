import type { Scene } from "@babylonjs/core";
import { Control, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { InteractionSystem } from "../systems/interactions";
import type { PlayerHunger } from "./hunger";
import type { Player } from "./player";

/** What the player carries from the hunt (NBB-142). */
export type Provision = "rawMeat" | "cookedMeat" | "leather";

/**
 * Provisional until the inventory (NBB-143): the meat and leather the player carries, counted in
 * a discreet line at the bottom right (FO1-A), and Q to eat (FO2-A): cooked meat first, raw
 * meat otherwise.
 */
export class Provisions {
  private readonly counts: Record<Provision, number> = { rawMeat: 0, cookedMeat: 0, leather: 0 };
  private readonly counter: TextBlock;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    hunger: PlayerHunger,
    interactions: InteractionSystem,
    ui: AdvancedDynamicTexture,
  ) {
    this.counter = new TextBlock("provisionsCount", "");
    this.counter.color = "white";
    this.counter.alpha = 0.55;
    this.counter.fontSize = 16;
    this.counter.width = "320px";
    this.counter.height = "24px";
    this.counter.left = "-36px";
    // Just above the weapon's counter ("Flechas: N", "Cartuchos: N").
    this.counter.top = `${-30 - CONFIG.hud.counterGapPx}px`;
    this.counter.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.counter.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.counter.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    ui.addControl(this.counter);
    this.refresh();

    scene.onBeforeRenderObservable.add(() => {
      if (player.controlsEnabled && input.wasPressed("KeyQ")) {
        this.eat(hunger, interactions);
      }
    });
  }

  count(item: Provision): number {
    return this.counts[item];
  }

  add(item: Provision, amount = 1): void {
    this.counts[item] += amount;
    this.refresh();
  }

  /** Takes one if there is any; false if there was none. */
  take(item: Provision): boolean {
    if (this.counts[item] <= 0) {
      return false;
    }
    this.counts[item]--;
    this.refresh();
    return true;
  }

  /** FO2-A: eats one piece at once, the cooked meat first. */
  private eat(hunger: PlayerHunger, interactions: InteractionSystem): void {
    const settings = CONFIG.player.hunger;
    if (this.counts.cookedMeat <= 0 && this.counts.rawMeat <= 0) {
      interactions.say("Você não tem carne");
      return;
    }
    if (hunger.isFull) {
      interactions.say("Você está sem fome");
      return;
    }
    if (this.take("cookedMeat")) {
      hunger.eat(settings.cookedMeat);
      interactions.say("Você comeu: carne cozida");
    } else if (this.take("rawMeat")) {
      hunger.eat(settings.rawMeat);
      interactions.say("Você comeu: carne crua");
    }
  }

  private refresh(): void {
    const { rawMeat, cookedMeat, leather } = this.counts;
    const parts: string[] = [];
    if (rawMeat > 0) {
      parts.push(`Carne crua: ${rawMeat}`);
    }
    if (cookedMeat > 0) {
      parts.push(`Carne cozida: ${cookedMeat}`);
    }
    if (leather > 0) {
      parts.push(`Couro: ${leather}`);
    }
    this.counter.text = parts.join(" · ");
    this.counter.isVisible = parts.length > 0;
  }
}
