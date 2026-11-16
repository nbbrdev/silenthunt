import type { Scene } from "@babylonjs/core";
import {
  Button,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
} from "@babylonjs/gui";
import { CONFIG } from "../config";

/**
 * VD4: the death screen. The screen fades to black, then shows "Você morreu", how many days the
 * player survived and the "Renascer" button.
 */
export class DeathScreen {
  private readonly cover: Rectangle;
  private readonly content: StackPanel;
  private readonly daysText: TextBlock;
  private fading = false;

  constructor(ui: AdvancedDynamicTexture, scene: Scene, onRespawn: () => void) {
    this.cover = new Rectangle("deathScreen");
    this.cover.background = "black";
    this.cover.thickness = 0;
    this.cover.alpha = 0;
    this.cover.isVisible = false;
    ui.addControl(this.cover);

    this.content = new StackPanel("deathContent");
    this.content.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.content.isVisible = false;
    this.cover.addControl(this.content);

    const title = new TextBlock("deathTitle", "Você morreu");
    title.color = "#c9c2b8";
    title.fontSize = 48;
    title.height = "70px";
    this.content.addControl(title);

    this.daysText = new TextBlock("deathDays", "");
    this.daysText.color = "#8f8a83";
    this.daysText.fontSize = 20;
    this.daysText.height = "50px";
    this.content.addControl(this.daysText);

    const button = Button.CreateSimpleButton("respawn", "Renascer");
    button.width = "180px";
    button.height = "44px";
    button.paddingTop = "8px";
    button.color = "#c9c2b8";
    button.background = "#2a2725";
    button.cornerRadius = 4;
    button.thickness = 0;
    button.onPointerClickObservable.add(() => {
      this.hide();
      onRespawn();
    });
    this.content.addControl(button);

    scene.onBeforeRenderObservable.add(() => {
      if (!this.fading) {
        return;
      }
      const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      this.cover.alpha = Math.min(1, this.cover.alpha + seconds / CONFIG.hud.deathFadeSeconds);
      if (this.cover.alpha >= 1) {
        this.fading = false;
        this.content.isVisible = true;
      }
    });
  }

  /** Fades to black and then shows the message (`days` = whole days survived). */
  show(days: number): void {
    this.daysText.text = `Sobreviveu ${days} ${days === 1 ? "dia" : "dias"}`;
    this.cover.alpha = 0;
    this.cover.isVisible = true;
    this.content.isVisible = false;
    this.fading = true;
  }

  private hide(): void {
    this.fading = false;
    this.cover.isVisible = false;
    this.content.isVisible = false;
  }
}
