import type { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  ScrollViewer,
  Slider,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { GameAudio } from "../core/audio";
import { setPaused } from "../core/gameTime";
import type { Input } from "../core/input";
import { applyVolumes, saveOptions, type GameOptions } from "../core/options";
import type { Player } from "../player/player";
import { creditLines } from "./credits";

/** What the menus touch in the rest of the game. */
export interface MenuWorld {
  input: Input;
  player: Player;
  /** The game's HUD: hidden while a menu is open. */
  hud: AdvancedDynamicTexture;
  audio: Promise<GameAudio>;
  options: GameOptions;
  /** True if a saved world was loaded ("Continuar" shows). */
  hasSave: boolean;
  /** True if the private music folder has tracks (credited then, MN5-A). */
  hasMusic: () => boolean;
  /** Whether Esc may pause now (not while dead, sleeping or in the inventory). */
  canPause: () => boolean;
  /** Saves the world (before going to the main menu, MN3-A). */
  save: () => Promise<void>;
  /** Forgets the saved world and reloads into a new one (RF-61, SV2-A). */
  newWorld: () => Promise<void>;
  /** NBB-156 (OB12): the objective's progress, shown under "Pausado". */
  progress?: () => string[];
}

type Screen = "main" | "pause" | "options" | "credits" | "confirm" | "start";

/** After "Novo mundo" the page reloads straight into the game (MN2-A). */
const START_NEW_KEY = "silenthunt.startNew";

/**
 * The menus (NBB-150; MN2-A to MN7): the main menu over the forest when the game opens, the pause
 * menu when Esc lets the mouse go, the options (mouse sensitivity and volumes), the credits (read
 * from CREDITS.md) and the confirmation before a new world. While any of them is open the world is
 * frozen (MN3-A), the HUD hidden and the mouse free.
 */
export class GameMenus {
  private readonly scene: Scene;
  private readonly world: MenuWorld;
  private readonly ui: AdvancedDynamicTexture;
  private readonly shade: Rectangle;
  private readonly column: StackPanel;
  private screen: Screen | undefined;
  /** Where "Voltar" in the options and credits goes back to. */
  private back: "main" | "pause" = "main";
  private hasSave: boolean;

  constructor(scene: Scene, world: MenuWorld) {
    this.scene = scene;
    this.world = world;
    this.hasSave = world.hasSave;
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("menus", true, scene);
    this.shade = new Rectangle("menuShade");
    // MN1-C: everything in the menus inherits the game's font from here.
    this.shade.fontFamily = CONFIG.hud.fontFamily;
    this.shade.thickness = 0;
    this.shade.background = CONFIG.menu.shade;
    this.ui.addControl(this.shade);
    this.column = new StackPanel("menuColumn");
    this.column.width = "820px";
    this.column.left = `${CONFIG.menu.left}px`;
    this.column.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.column.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.shade.addControl(this.column);

    world.input.onPointerReleased.add(() => {
      if (this.screen === undefined && world.canPause()) {
        this.open("pause");
      }
    });

    // MN2-A: the main menu when the game opens; straight into the game after "Novo mundo".
    const startNew = sessionStorage.getItem(START_NEW_KEY) === "1";
    sessionStorage.removeItem(START_NEW_KEY);
    this.open(startNew ? "start" : "main");
  }

  /** True while the player is in the game (no menu open). */
  get isPlaying(): boolean {
    return this.screen === undefined;
  }

  /**
   * NBB-159 (CI8-A): true on the main menu and the screens reached from it (options, credits,
   * the new world's confirmation and start): the film plays behind them, not behind the pause.
   */
  get isMainMenu(): boolean {
    return this.screen !== undefined && this.screen !== "pause" && this.back === "main";
  }

  /** Development: which menu is open, if any. */
  get current(): string {
    return this.screen ?? "jogo";
  }

  /** Development: leaves the menus and plays, without capturing the mouse. */
  debugPlay(): void {
    this.resume(false);
  }

  /** The flag that makes the next load go straight into the game (set before "Novo mundo"). */
  static markStartNew(): void {
    sessionStorage.setItem(START_NEW_KEY, "1");
  }

  private open(screen: Screen): void {
    const { input, player, hud } = this.world;
    if (this.screen === undefined) {
      // MN3-A: the world stands still behind any menu.
      setPaused(this.scene, true);
      player.controlsEnabled = false;
      input.pointerLockEnabled = false;
      hud.rootContainer.isVisible = false;
    }
    this.screen = screen;
    if (screen === "main") {
      this.back = "main";
    } else if (screen === "pause") {
      this.back = "pause";
    }
    // CI10-B: the film needs no dark layer over it (its dark edges do that job); the pause does.
    this.shade.background = this.isMainMenu ? "transparent" : CONFIG.menu.shade;
    // MN3-A: the sound stops behind the pause; CI6-A: the main menu has the night's sound.
    void this.world.audio
      .then((audio) => (this.isMainMenu ? audio.engine.resumeAsync() : audio.engine.pauseAsync()))
      .catch(() => undefined);
    this.ui.rootContainer.isVisible = true;
    this.column.clearControls();
    switch (screen) {
      case "main":
        this.back = "main";
        this.buildMain();
        break;
      case "pause":
        this.back = "pause";
        this.buildPause();
        break;
      case "options":
        this.buildOptions();
        break;
      case "credits":
        this.buildCredits();
        break;
      case "confirm":
        this.buildConfirm();
        break;
      case "start":
        this.buildStart();
        break;
    }
  }

  /** Back to the game: the world moves again and the mouse is captured. */
  private resume(capture = true): void {
    const { input, player, hud, audio, options } = this.world;
    this.screen = undefined;
    this.hasSave = true;
    this.ui.rootContainer.isVisible = false;
    hud.rootContainer.isVisible = true;
    setPaused(this.scene, false);
    player.controlsEnabled = true;
    input.pointerLockEnabled = true;
    if (capture) {
      // Inside the click on the button: the browser lets the game capture the mouse.
      input.capturePointer();
    }
    void audio
      .then(async (engine) => {
        applyVolumes(options, engine);
        await engine.engine.resumeAsync();
      })
      .catch(() => undefined);
  }

  private buildMain(): void {
    this.title("Silent Hunt", CONFIG.menu.titleSize);
    if (this.hasSave) {
      this.button("Continuar", () => this.resume());
    }
    // RF-61: a saved world is only erased after confirming; without one, a new world just begins.
    this.button("Novo mundo", () => (this.hasSave ? this.open("confirm") : this.resume()));
    this.button("Opções", () => this.open("options"));
    this.button("Créditos", () => this.open("credits"));
  }

  private buildPause(): void {
    this.title("Pausado", CONFIG.menu.headingSize);
    // OB12: where the way out stands.
    const progress = this.world.progress?.() ?? [];
    for (const line of progress) {
      this.text(line, CONFIG.menu.textSize);
    }
    if (progress.length > 0) {
      this.spacer(12);
    }
    this.button("Voltar ao jogo", () => this.resume());
    this.button("Opções", () => this.open("options"));
    this.button("Menu principal", () => this.goToMain());
  }

  /** Saves and goes to the main menu (MN3-A); also the victory screen's "Menu principal". */
  goToMain(): void {
    if (this.screen === undefined) {
      // From the game (the victory screen): the world stops first, as for any menu.
      this.open("pause");
    }
    void this.world.save().finally(() => {
      this.hasSave = true;
      this.open("main");
    });
  }

  private buildConfirm(): void {
    this.text("Começar um mundo novo? O mundo atual será apagado.", CONFIG.menu.buttonSize);
    this.spacer(16);
    this.button("Apagar e começar", () => {
      GameMenus.markStartNew();
      void this.world.newWorld();
    });
    this.button("Cancelar", () => this.open("main"));
  }

  /** After "Novo mundo": one click starts (the browser only lets a click capture the mouse). */
  private buildStart(): void {
    this.title("Silent Hunt", CONFIG.menu.titleSize);
    this.button("Clique para começar", () => this.resume());
  }

  private buildOptions(): void {
    const { options, player } = this.world;
    this.title("Opções", CONFIG.menu.headingSize);
    const [low, high] = CONFIG.menu.sensitivityRange;
    this.slider("Sensibilidade do mouse", options.sensitivity, low, high, formatScale, (value) => {
      options.sensitivity = value;
      player.sensitivityScale = value;
    });
    const volume = (label: string, key: "master" | "effects" | "ambience" | "music") => {
      this.slider(label, options[key], 0, 1, formatPercent, (value) => {
        options[key] = value;
        void this.world.audio.then((audio) => applyVolumes(options, audio));
      });
    };
    volume("Volume geral", "master");
    volume("Efeitos", "effects");
    volume("Ambiente", "ambience");
    volume("Música", "music");
    this.spacer(12);
    this.button("Voltar", () => {
      saveOptions(options);
      this.open(this.back);
    });
  }

  private buildCredits(): void {
    this.title("Créditos", CONFIG.menu.headingSize);
    const viewer = new ScrollViewer("creditsScroll");
    viewer.width = "780px";
    viewer.height = `${Math.round(this.ui.getSize().height * 0.55)}px`;
    viewer.thickness = 0;
    viewer.barSize = 8;
    viewer.barColor = CONFIG.menu.textColor;
    viewer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    const lines = new StackPanel("creditLines");
    lines.width = "760px";
    lines.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    viewer.addControl(lines);
    const all = creditLines();
    if (this.world.hasMusic()) {
      all.push({ kind: "heading", text: "Música" }, { kind: "text", text: "Epidemic Sound." });
    }
    for (const line of all) {
      const size = line.kind === "heading" ? CONFIG.menu.buttonSize : CONFIG.menu.textSize;
      const block = this.textBlock(line.text, size);
      block.paddingTop = line.kind === "heading" ? "18px" : "4px";
      if (line.kind === "item") {
        block.paddingLeft = "16px";
      }
      lines.addControl(block);
    }
    this.column.addControl(viewer);
    this.spacer(12);
    this.button("Voltar", () => this.open(this.back));
  }

  private title(text: string, size: number): void {
    const block = this.textBlock(text, size);
    block.paddingBottom = "24px";
    this.column.addControl(block);
  }

  private text(text: string, size: number): void {
    this.column.addControl(this.textBlock(text, size));
  }

  private spacer(pixels: number): void {
    const space = new Rectangle();
    space.thickness = 0;
    space.height = `${pixels}px`;
    this.column.addControl(space);
  }

  private textBlock(text: string, size: number): TextBlock {
    const block = new TextBlock(undefined, text);
    block.color = CONFIG.menu.textColor;
    block.fontSize = size;
    block.textWrapping = true;
    block.resizeToFit = true;
    block.width = "760px";
    block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    block.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    return block;
  }

  /** MN6: a text-only button, soft white, the fire's orange under the mouse. */
  private button(text: string, onClick: () => void): void {
    const { textColor, hoverColor, buttonSize } = CONFIG.menu;
    const button = Button.CreateSimpleButton(`menu-${text}`, text);
    button.width = "420px";
    button.height = `${Math.round(buttonSize * 1.7)}px`;
    button.thickness = 0;
    button.color = textColor;
    button.fontSize = buttonSize;
    button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    if (button.textBlock) {
      button.textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    }
    button.onPointerEnterObservable.add(() => {
      button.color = hoverColor;
    });
    button.onPointerOutObservable.add(() => {
      button.color = textColor;
    });
    button.onPointerUpObservable.add(() => onClick());
    this.column.addControl(button);
  }

  /** MN4: a labeled slider with its value beside it. */
  private slider(
    label: string,
    value: number,
    minimum: number,
    maximum: number,
    format: (value: number) => string,
    onChange: (value: number) => void,
  ): void {
    const { textColor, hoverColor, textSize } = CONFIG.menu;
    const row = new StackPanel(`option-${label}`);
    row.isVertical = false;
    row.height = "44px";
    row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    const name = new TextBlock(undefined, label);
    name.width = "260px";
    name.color = textColor;
    name.fontSize = textSize + 4;
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    const shown = new TextBlock(undefined, format(value));
    shown.width = "90px";
    shown.color = textColor;
    shown.fontSize = textSize + 4;
    const slider = new Slider(`slider-${label}`);
    slider.minimum = minimum;
    slider.maximum = maximum;
    slider.value = value;
    slider.width = "300px";
    slider.height = "20px";
    slider.color = hoverColor;
    slider.background = "rgba(255, 255, 255, 0.18)";
    slider.borderColor = "transparent";
    slider.thumbColor = textColor;
    slider.isThumbCircle = true;
    slider.onValueChangedObservable.add((next) => {
      shown.text = format(next);
      onChange(next);
    });
    row.addControl(name);
    row.addControl(slider);
    row.addControl(shown);
    this.column.addControl(row);
  }
}

/** "1,25×" (pt-BR decimal comma). */
function formatScale(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}×`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
