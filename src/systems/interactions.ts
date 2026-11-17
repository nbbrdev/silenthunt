import type { Scene } from "@babylonjs/core";
import { Control, Rectangle, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { Player } from "../player/player";

/** Something the player can do with E right now (G2: "Interagir"). */
export interface Interaction {
  /** What E does, shown as a hint ("[E] Pegar flecha"). */
  label: string;
  /** How far it is: the nearest one wins. */
  distance: number;
  /** What E does. Without it the hint is only a notice ("Precisa da faca", CA2-A). */
  act?: () => void;
  /**
   * CA1-B: E has to be held this long, standing still, with a progress bar; letting go or moving
   * cancels it. Without it, a press is enough.
   */
  holdSeconds?: number;
  /** Tells holds apart: holding on to one thing and then reaching another starts over. */
  id?: string;
}

/** Offers an interaction for where the player is now, or nothing. */
export type InteractionProvider = () => Interaction | undefined;

/**
 * E (G2): picks the nearest thing the player can interact with (an arrow on the ground, a
 * chest, the shotgun on the table, a carcass...), shows "[E] ..." under the center of the
 * screen and does it when E is pressed, or held (CA1-B). Also shows short messages, like what a
 * chest held (ES5).
 */
export class InteractionSystem {
  private readonly providers: InteractionProvider[] = [];
  private readonly hint: TextBlock;
  private readonly message: TextBlock;
  private readonly progressFrame: Rectangle;
  private readonly progressFill: Rectangle;
  private messageLeft = 0;
  private holdId: string | undefined;
  private holdSeconds = 0;
  /** After a hold finishes, E must be let go before another one starts. */
  private waitForRelease = false;

  constructor(scene: Scene, input: Input, player: Player, ui: AdvancedDynamicTexture) {
    this.hint = new TextBlock("interactionHint", "");
    this.hint.color = "white";
    this.hint.alpha = 0.7;
    this.hint.fontSize = 16;
    this.hint.height = "24px";
    this.hint.top = "60px";
    this.hint.isVisible = false;
    ui.addControl(this.hint);

    // CA1-B: a thin bar under the hint while E is held.
    this.progressFrame = new Rectangle("interactionProgress");
    this.progressFrame.width = "140px";
    this.progressFrame.height = "4px";
    this.progressFrame.top = "80px";
    this.progressFrame.thickness = 0;
    this.progressFrame.background = "rgba(255, 255, 255, 0.15)";
    this.progressFrame.isVisible = false;
    ui.addControl(this.progressFrame);
    this.progressFill = new Rectangle("interactionProgressFill");
    this.progressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.progressFill.thickness = 0;
    this.progressFill.background = "white";
    this.progressFill.alpha = 0.7;
    this.progressFrame.addControl(this.progressFill);

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
      if (!input.isDown("KeyE")) {
        this.waitForRelease = false;
      }
      if (!nearest?.act) {
        this.resetHold();
        if (nearest) {
          this.hint.text = nearest.label;
        }
        return;
      }
      this.hint.text = `[E] ${nearest.label}`;
      if (nearest.holdSeconds === undefined) {
        this.resetHold();
        if (input.wasPressed("KeyE")) {
          nearest.act();
        }
        return;
      }
      this.hold(nearest, input.isDown("KeyE") && player.gait === "still", seconds);
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

  /** CA1-B: fills the bar while E is held on the same thing; when full, it is done. */
  private hold(interaction: Interaction, held: boolean, seconds: number): void {
    const total = interaction.holdSeconds ?? 0;
    if (!held || this.waitForRelease) {
      this.resetHold();
      return;
    }
    if (this.holdId !== interaction.id) {
      this.holdId = interaction.id;
      this.holdSeconds = 0;
    }
    this.holdSeconds += seconds;
    this.progressFrame.isVisible = true;
    this.progressFill.width = `${Math.round(Math.min(1, this.holdSeconds / total) * 140)}px`;
    if (this.holdSeconds >= total) {
      this.resetHold();
      this.waitForRelease = true;
      interaction.act?.();
    }
  }

  private resetHold(): void {
    this.holdId = undefined;
    this.holdSeconds = 0;
    this.progressFrame.isVisible = false;
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
