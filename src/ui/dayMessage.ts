import type { Scene } from "@babylonjs/core";
import { Control, StackPanel, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { glowingTitle, spaced, withShadow } from "./menuStyle";

/**
 * NBB-161 (MF13-B, MF14-B, MF16): a message at the top of the screen at dawn ("VOCÊ SOBREVIVEU",
 * "AMANHECER") and at dusk ("A NOITE CHEGA"), in the menus' style: it comes in over 1 s, stays
 * 3 s and leaves over 1.5 s (game time: it waits behind the pause).
 */
export class DayMessage {
  private readonly panel: StackPanel;
  private readonly title: TextBlock;
  private readonly line: TextBlock;
  /** Seconds since it appeared (undefined when hidden). */
  private time: number | undefined;

  constructor(ui: AdvancedDynamicTexture, scene: Scene) {
    const settings = CONFIG.dayMessage;
    this.panel = new StackPanel("dayMessage");
    this.panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.top = `${settings.top * 100}%`;
    this.panel.isHitTestVisible = false;
    this.panel.isVisible = false;
    ui.addControl(this.panel);

    this.title = glowingTitle("", settings.titleSize);
    this.panel.addControl(this.title);
    this.line = withShadow(new TextBlock("dayMessageLine", ""));
    this.line.color = CONFIG.menu.victoryLineColor;
    this.line.fontSize = settings.lineSize;
    this.line.height = `${Math.round(settings.lineSize * 1.8)}px`;
    this.panel.addControl(this.line);

    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  show(title: string, line: string): void {
    this.title.text = spaced(title);
    this.line.text = line;
    this.line.isVisible = line !== "";
    this.time = 0;
    this.panel.alpha = 0;
    this.panel.isVisible = true;
  }

  private update(seconds: number): void {
    if (this.time === undefined) {
      return;
    }
    const { fadeInSeconds, holdSeconds, fadeOutSeconds } = CONFIG.dayMessage;
    this.time += seconds;
    const t = this.time;
    if (t < fadeInSeconds) {
      this.panel.alpha = t / fadeInSeconds;
    } else if (t < fadeInSeconds + holdSeconds) {
      this.panel.alpha = 1;
    } else if (t < fadeInSeconds + holdSeconds + fadeOutSeconds) {
      this.panel.alpha = 1 - (t - fadeInSeconds - holdSeconds) / fadeOutSeconds;
    } else {
      this.time = undefined;
      this.panel.isVisible = false;
    }
  }
}
