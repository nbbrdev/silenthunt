import {
  Control,
  Rectangle,
  TextBlock,
  type AdvancedDynamicTexture,
  type Container,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import { uiSounds } from "./uiSounds";

/** EM1-A: Babylon GUI has no letter spacing: a thin space between letters, a wide one between words. */
const THIN_SPACE = " ";
const WIDE_SPACE = " ";

/** "Novo mundo" → "N O V O   M U N D O" (EM1-A, EM2-A). */
export function spaced(text: string): string {
  return text
    .toLocaleUpperCase("pt-BR")
    .split(" ")
    .map((word) => [...word].join(THIN_SPACE))
    .join(WIDE_SPACE);
}

/** EM10: the black shadow under the menus' texts. */
export function withShadow<T extends Control>(control: T): T {
  const { color, blur, offsetY } = CONFIG.menu.shadow;
  control.shadowColor = color;
  control.shadowBlur = blur;
  control.shadowOffsetX = 0;
  control.shadowOffsetY = offsetY;
  return control;
}

/** EM1-A: a title in spaced capitals with its cold glow. */
export function glowingTitle(text: string, size: number): TextBlock {
  const { textColor, titleGlow } = CONFIG.menu;
  const block = new TextBlock(undefined, spaced(text));
  block.color = textColor;
  block.fontSize = size;
  block.resizeToFit = true;
  block.shadowColor = titleGlow.color;
  block.shadowBlur = titleGlow.blur;
  block.shadowOffsetX = 0;
  block.shadowOffsetY = 0;
  return block;
}

/** Something the keyboard can choose. */
interface Choice {
  /** Lit (chosen) or dim. */
  light: (on: boolean) => void;
  act?: () => void;
  /** ←/→ on a slider. */
  step?: (direction: -1 | 1) => void;
  /** The text that slides right when chosen. */
  slide?: { label: TextBlock; offset: number };
}

/**
 * The options of one screen (EM2-A, EM6-A): dim, the chosen one lit in the fire's orange with a
 * dash and its text slid right; the mouse and the keys move the same choice.
 */
export class MenuChoices {
  private readonly ui: AdvancedDynamicTexture;
  private readonly centered: boolean;
  private choices: Choice[] = [];
  private chosen = -1;

  /** `centered`: the rows fit their text (the victory screens); otherwise, a left column. */
  constructor(ui: AdvancedDynamicTexture, centered = false) {
    this.ui = ui;
    this.centered = centered;
  }

  clear(): void {
    this.choices = [];
    this.chosen = -1;
  }

  /** EM10: the first option comes chosen (quietly: no click). */
  chooseFirst(): void {
    this.choose(0, false);
  }

  /** A text option; `back` ones ("Voltar", "Cancelar") click softer (FX15). */
  option(text: string, act: () => void, back = false): Rectangle {
    const run = (): void => {
      uiSounds.play(back ? "back" : "confirm");
      act();
    };
    const settings = CONFIG.menu;
    const shown = spaced(text);
    const row = new Rectangle(`option-${text}`);
    row.thickness = 0;
    row.height = `${Math.round(settings.optionSize * 1.8)}px`;
    row.isPointerBlocker = true;
    row.hoverCursor = "pointer";
    const room = settings.optionIndent + settings.slidePixels;
    if (this.centered) {
      // Wide enough for the text and the dash's room on both sides: it stays near the middle.
      row.width = `${Math.ceil(this.measure(shown, settings.optionSize) + room * 2)}px`;
      row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    } else {
      row.width = "560px";
      row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    }

    const dash = new Rectangle("optionDash");
    dash.width = `${settings.dash.width}px`;
    dash.height = `${settings.dash.height}px`;
    dash.thickness = 0;
    dash.background = settings.hoverColor;
    dash.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dash.isVisible = false;
    dash.isHitTestVisible = false;
    row.addControl(dash);

    const label = withShadow(new TextBlock(undefined, shown));
    label.fontSize = settings.optionSize;
    label.color = settings.dimColor;
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.left = `${settings.optionIndent}px`;
    label.isHitTestVisible = false;
    row.addControl(label);

    const index = this.add({
      light: (on) => {
        dash.isVisible = on;
        label.color = on ? settings.hoverColor : settings.dimColor;
      },
      act: run,
      slide: { label, offset: 0 },
    });
    row.onPointerEnterObservable.add(() => this.choose(index));
    row.onPointerUpObservable.add(() => run());
    return row;
  }

  /** A row the keys can choose and move (a slider): `light` colors its name. */
  adjustable(
    hovered: Control[],
    light: (on: boolean) => void,
    step: (direction: -1 | 1) => void,
  ): void {
    const index = this.add({ light, step });
    for (const control of hovered) {
      control.onPointerEnterObservable.add(() => this.choose(index));
    }
  }

  /** EM6-A: ↑/↓ or W/S choose, Enter or Space confirm, ←/→ or A/D move a slider. */
  handleKey(code: string): boolean {
    const count = this.choices.length;
    if (count === 0) {
      return false;
    }
    switch (code) {
      case "ArrowUp":
      case "KeyW":
        this.choose((this.chosen - 1 + count) % count);
        return true;
      case "ArrowDown":
      case "KeyS":
        this.choose((this.chosen + 1) % count);
        return true;
      case "ArrowLeft":
      case "KeyA":
        this.choices[this.chosen]?.step?.(-1);
        return true;
      case "ArrowRight":
      case "KeyD":
        this.choices[this.chosen]?.step?.(1);
        return true;
      case "Enter":
      case "NumpadEnter":
      case "Space":
        this.choices[this.chosen]?.act?.();
        return true;
      default:
        return false;
    }
  }

  /** The chosen text slides right; the others slide back (real seconds). */
  update(seconds: number): void {
    const { optionIndent, slidePixels, slideSeconds } = CONFIG.menu;
    const move = (slidePixels / slideSeconds) * seconds;
    this.choices.forEach((choice, index) => {
      const slide = choice.slide;
      if (!slide) {
        return;
      }
      const target = index === this.chosen ? slidePixels : 0;
      const gap = target - slide.offset;
      slide.offset += Math.sign(gap) * Math.min(Math.abs(gap), move);
      slide.label.left = `${optionIndent + slide.offset}px`;
    });
  }

  private add(choice: Choice): number {
    this.choices.push(choice);
    choice.light(false);
    return this.choices.length - 1;
  }

  private choose(index: number, click = true): void {
    if (index === this.chosen) {
      return;
    }
    this.choices[this.chosen]?.light(false);
    this.chosen = index;
    this.choices[index]?.light(true);
    if (click) {
      // FX15: passing over an option.
      uiSounds.play("hover");
    }
  }

  private measure(text: string, size: number): number {
    const context = this.ui.getContext();
    context.font = `${size}px "${CONFIG.hud.fontFamily}"`;
    return context.measureText(text).width;
  }
}

/**
 * EM7-A: a screen comes out of black, each line a little after the one above; the first one (the
 * title) can be dimmed further, for the main title's flicker.
 */
export class MenuReveal {
  private items: Control[] = [];
  private time = 0;

  start(container: Container): void {
    this.items = [...container.children];
    this.time = 0;
    this.update(0);
  }

  update(seconds: number, firstDim = 1): void {
    const { revealSeconds, revealStagger } = CONFIG.menu;
    this.time += seconds;
    this.items.forEach((item, index) => {
      const shown = Math.min(1, Math.max(0, (this.time - index * revealStagger) / revealSeconds));
      item.alpha = index === 0 ? shown * firstDim : shown;
    });
  }
}

/** EM1-A: the main title fails like a lamp, one or two blinks every 6 to 12 seconds. */
export class TitleFlicker {
  private wait = this.nextWait();
  private blinks: number[] = [];
  private time = 0;

  /** The title's brightness now (1 when steady). */
  update(seconds: number): number {
    const { low, blinkSeconds, gapSeconds } = CONFIG.menu.flicker;
    this.wait -= seconds;
    if (this.wait <= 0 && this.blinks.length === 0) {
      const count = Math.random() < 0.5 ? 1 : 2;
      this.blinks = Array.from({ length: count }, (_, i) => i * (blinkSeconds + gapSeconds));
      this.time = 0;
    }
    if (this.blinks.length === 0) {
      return 1;
    }
    this.time += seconds;
    const last = this.blinks[this.blinks.length - 1] ?? 0;
    if (this.time > last + blinkSeconds) {
      this.blinks = [];
      this.wait = this.nextWait();
      return 1;
    }
    const dark = this.blinks.some(
      (start) => this.time >= start && this.time < start + blinkSeconds,
    );
    return dark ? low : 1;
  }

  private nextWait(): number {
    const [shortest, longest] = CONFIG.menu.flicker.everySeconds;
    return shortest + Math.random() * (longest - shortest);
  }
}
