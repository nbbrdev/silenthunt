import type { Scene } from "@babylonjs/core";
import { TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { Player } from "../player/player";

/** Something the player can do with E right now (G2: "Interagir"). */
export interface Interaction {
  /** What E does, shown as a hint ("[E] Pegar flecha"). */
  label: string;
  /** How far it is: the nearest one wins. */
  distance: number;
  act: () => void;
}

/** Offers an interaction for where the player is now, or nothing. */
export type InteractionProvider = () => Interaction | undefined;

/**
 * E (G2): picks the nearest thing the player can interact with (an arrow on the ground, a
 * chest, the shotgun on the table...), shows "[E] ..." under the center of the screen and does
 * it when E is pressed. Also shows short messages, like what a chest held (ES5).
 */
export class InteractionSystem {
  private readonly providers: InteractionProvider[] = [];
  private readonly hint: TextBlock;
  private readonly message: TextBlock;
  private messageLeft = 0;

  constructor(scene: Scene, input: Input, player: Player, ui: AdvancedDynamicTexture) {
    this.hint = new TextBlock("interactionHint", "");
    this.hint.color = "white";
    this.hint.alpha = 0.7;
    this.hint.fontSize = 16;
    this.hint.height = "24px";
    this.hint.top = "60px";
    this.hint.isVisible = false;
    ui.addControl(this.hint);

    this.message = new TextBlock("interactionMessage", "");
    this.message.color = "white";
    this.message.fontSize = 18;
    this.message.height = "28px";
    this.message.top = "100px";
    this.message.isVisible = false;
    ui.addControl(this.message);

    scene.onBeforeRenderObservable.add(() => {
      const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      this.messageLeft = Math.max(0, this.messageLeft - seconds);
      this.message.isVisible = this.messageLeft > 0;
      this.message.alpha = Math.min(1, this.messageLeft * 2) * 0.85;

      const nearest = player.controlsEnabled ? this.nearest() : undefined;
      this.hint.isVisible = nearest !== undefined;
      if (!nearest) {
        return;
      }
      this.hint.text = `[E] ${nearest.label}`;
      if (input.wasPressed("KeyE")) {
        nearest.act();
      }
    });
  }

  add(provider: InteractionProvider): void {
    this.providers.push(provider);
  }

  /** ES5: a short message in the middle of the screen ("Você encontrou: ..."). */
  say(text: string): void {
    this.message.text = text;
    this.messageLeft = CONFIG.cabins.messageSeconds;
  }

  private nearest(): Interaction | undefined {
    let nearest: Interaction | undefined;
    for (const provider of this.providers) {
      const interaction = provider();
      if (interaction && (!nearest || interaction.distance < nearest.distance)) {
        nearest = interaction;
      }
    }
    return nearest;
  }
}
