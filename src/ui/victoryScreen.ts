import { Observable, type Scene } from "@babylonjs/core";
import {
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { Input } from "../core/input";
import { OBJECTIVE_WORDS } from "../systems/objectiveTexts";
import { MenuChoices, MenuReveal, glowingTitle, spaced, withShadow } from "./menuStyle";

/**
 * The victory screen (NBB-156; OB5-A, OB12): the screen darkens, then the title of the ending
 * (rescue or ritual), the days survived and the deaths, and two choices: go on playing in the same
 * world, or go to the main menu (the world stays saved). NBB-160 (EM8-A): in the menus' style,
 * centered, with the keyboard.
 */
export class VictoryScreen {
  private readonly cover: Rectangle;
  private readonly content: StackPanel;
  private readonly title: TextBlock;
  private readonly days: TextBlock;
  private readonly deaths: TextBlock;
  private readonly choices: MenuChoices;
  private readonly reveal = new MenuReveal();
  private fading = false;
  private open = false;
  /** MF12-A: the ending's text came up (its music starts) and the screen closed (it leaves). */
  readonly onRevealed = new Observable<void>();
  readonly onClosed = new Observable<void>();

  constructor(
    ui: AdvancedDynamicTexture,
    scene: Scene,
    input: Input,
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

    // EM10: the main title's style, smaller and steady.
    this.title = glowingTitle("", CONFIG.menu.victoryTitleSize);
    this.title.paddingBottom = "12px";
    this.content.addControl(this.title);
    this.days = this.line("victoryDays");
    this.deaths = this.line("victoryDeaths");
    this.content.addControl(this.spacer());

    this.choices = new MenuChoices(ui, true);
    const choice = (label: string, act: () => void) => {
      this.content.addControl(
        this.choices.option(label, () => {
          this.hide();
          act();
        }),
      );
    };
    choice(OBJECTIVE_WORDS.continuePlaying, actions.continuePlaying);
    choice(OBJECTIVE_WORDS.mainMenu, actions.mainMenu);

    // EM6-A: ↑/↓ choose and Enter confirms (inside the key: the mouse can be captured there).
    input.onKeyDownNow.add((code) => {
      if (this.open && this.content.isVisible && this.choices.handleKey(code)) {
        input.forgetPress(code);
      }
    });

    scene.onBeforeRenderObservable.add(() => {
      if (!this.open) {
        return;
      }
      const real = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      this.choices.update(real);
      this.reveal.update(real);
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
        // EM7-A: the lines come out of black, one after the other.
        this.choices.chooseFirst();
        this.reveal.start(this.content);
        this.onRevealed.notifyObservers();
      }
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Darkens the screen, then shows the ending. */
  show(title: string, days: number, deaths: number): void {
    this.title.text = spaced(title);
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
    this.onClosed.notifyObservers();
  }

  private line(name: string): TextBlock {
    const text = withShadow(new TextBlock(name, ""));
    text.color = CONFIG.menu.victoryLineColor;
    text.fontSize = CONFIG.menu.textSize;
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
