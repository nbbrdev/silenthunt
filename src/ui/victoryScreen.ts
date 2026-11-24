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
import { frameSeconds } from "../core/gameTime";
import { OBJECTIVE_WORDS } from "../systems/objectiveTexts";

/**
 * The victory screen (NBB-156; OB5-A, OB12): the screen darkens, then the title of the ending
 * (rescue or ritual), the days survived and the deaths, and two buttons: go on playing in the same
 * world, or go to the main menu (the world stays saved).
 */
export class VictoryScreen {
  private readonly cover: Rectangle;
  private readonly content: StackPanel;
  private readonly title: TextBlock;
  private readonly days: TextBlock;
  private readonly deaths: TextBlock;
  private fading = false;
  private open = false;

  constructor(
    ui: AdvancedDynamicTexture,
    scene: Scene,
    actions: { continuePlaying: () => void; mainMenu: () => void },
  ) {
    this.cover = new Rectangle("victoryScreen");
    this.cover.background = "black";
    this.cover.thickness = 0;
    this.cover.alpha = 0;
    this.cover.isVisible = false;
    this.cover.zIndex = 20;
    ui.addControl(this.cover);

    this.content = new StackPanel("victoryContent");
    this.content.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.content.isVisible = false;
    this.cover.addControl(this.content);

    this.title = new TextBlock("victoryTitle", "");
    this.title.color = "#c9c2b8";
    this.title.fontSize = 48;
    this.title.height = "70px";
    this.content.addControl(this.title);
    this.days = this.line("victoryDays");
    this.deaths = this.line("victoryDeaths");

    const button = (name: string, label: string, act: () => void) => {
      const control = Button.CreateSimpleButton(name, label);
      control.width = "220px";
      control.height = "48px";
      control.paddingTop = "8px";
      control.color = "#c9c2b8";
      control.background = "#2a2725";
      control.cornerRadius = 4;
      control.thickness = 0;
      control.onPointerClickObservable.add(() => {
        this.hide();
        act();
      });
      this.content.addControl(control);
    };
    this.content.addControl(this.spacer());
    button("victoryContinue", OBJECTIVE_WORDS.continuePlaying, actions.continuePlaying);
    button("victoryMenu", OBJECTIVE_WORDS.mainMenu, actions.mainMenu);

    scene.onBeforeRenderObservable.add(() => {
      if (!this.fading) {
        return;
      }
      const seconds = frameSeconds(scene);
      this.cover.alpha = Math.min(
        1,
        this.cover.alpha + seconds / CONFIG.objective.victoryFadeSeconds,
      );
      if (this.cover.alpha >= 1) {
        this.fading = false;
        this.content.isVisible = true;
      }
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Darkens the screen, then shows the ending. */
  show(title: string, days: number, deaths: number): void {
    this.title.text = title;
    this.days.text = `Sobreviveu ${days} ${days === 1 ? "dia" : "dias"}`;
    this.deaths.text = `Morreu ${deaths} ${deaths === 1 ? "vez" : "vezes"}`;
    this.cover.alpha = 0;
    this.cover.isVisible = true;
    this.content.isVisible = false;
    this.fading = true;
    this.open = true;
  }

  private hide(): void {
    this.fading = false;
    this.open = false;
    this.cover.isVisible = false;
    this.content.isVisible = false;
  }

  private line(name: string): TextBlock {
    const text = new TextBlock(name, "");
    text.color = "#8f8a83";
    text.fontSize = 20;
    text.height = "32px";
    this.content.addControl(text);
    return text;
  }

  private spacer(): Rectangle {
    const gap = new Rectangle("victoryGap");
    gap.height = "16px";
    gap.thickness = 0;
    return gap;
  }
}
