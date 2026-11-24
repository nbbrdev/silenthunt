import {
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
} from "@babylonjs/gui";
import type { Input } from "../core/input";
import type { Player } from "../player/player";
import type { NoteText } from "../systems/objectiveTexts";

/**
 * A note or a diary page on screen (NBB-156; OB12): a sheet of paper with its text, closed with E
 * or Esc. Several found at once are shown one after the other. While a note is open from the
 * world the player stands still; from the inventory screen it just lies on top.
 */
export class NotePanel {
  private readonly player: Player;
  private readonly sheet: Rectangle;
  private readonly title: TextBlock;
  private readonly body: TextBlock;
  private readonly queue: NoteText[] = [];
  private open = false;
  /** Whether the controls were on when the note opened (they come back as they were). */
  private controlsBefore = true;
  /** When the last note closed (Esc also lets the mouse go; the pause should not open then). */
  private closedAt = -Infinity;

  constructor(ui: AdvancedDynamicTexture, input: Input, player: Player) {
    this.player = player;
    this.sheet = new Rectangle("noteSheet");
    this.sheet.width = "520px";
    // A fixed height: the longest note fits, and the size does not jump between notes.
    this.sheet.height = "280px";
    this.sheet.background = "#d6cdb9";
    this.sheet.color = "#8a7f6a";
    this.sheet.thickness = 1;
    this.sheet.cornerRadius = 3;
    this.sheet.isVisible = false;
    this.sheet.zIndex = 10;
    ui.addControl(this.sheet);

    // A column narrower than the sheet (its side margins), with spacers above and below: GUI
    // paddings would shift and clip the text.
    const column = new StackPanel("noteColumn");
    column.width = "460px";
    column.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.sheet.addControl(column);
    column.addControl(spacer("noteTop", 22));

    this.title = new TextBlock("noteTitle", "");
    this.title.width = "460px";
    this.title.color = "#5a4f3e";
    this.title.fontSize = 16;
    this.title.height = "28px";
    this.title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    column.addControl(this.title);

    this.body = new TextBlock("noteBody", "");
    // A fixed width (the sheet's, less its margins): without it the lines do not wrap.
    this.body.width = "460px";
    this.body.color = "#2a241c";
    this.body.fontSize = 20;
    this.body.textWrapping = true;
    this.body.height = "180px";
    this.body.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.body.lineSpacing = "4px";
    this.body.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    column.addControl(this.body);

    column.addControl(spacer("noteGap", 12));
    const hint = new TextBlock("noteHint", "[E] Fechar");
    hint.width = "460px";
    hint.color = "#5a4f3e";
    hint.fontSize = 14;
    hint.height = "22px";
    hint.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    column.addControl(hint);
    column.addControl(spacer("noteBottom", 14));

    input.onKeyDownNow.add((code) => {
      if (this.open && (code === "KeyE" || code === "Escape")) {
        this.next();
      }
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** True just after a note closed (Esc's own release of the mouse must not pause the game). */
  get justClosed(): boolean {
    return performance.now() - this.closedAt < 600;
  }

  /** Shows these notes, one after the other. */
  show(notes: readonly NoteText[]): void {
    if (notes.length === 0) {
      return;
    }
    this.queue.push(...notes);
    if (!this.open) {
      this.open = true;
      this.controlsBefore = this.player.controlsEnabled;
      this.player.controlsEnabled = false;
      this.next();
    }
  }

  /** The next note in line, or closes. */
  private next(): void {
    const note = this.queue.shift();
    if (!note) {
      this.open = false;
      this.sheet.isVisible = false;
      this.player.controlsEnabled = this.controlsBefore;
      this.closedAt = performance.now();
      return;
    }
    this.title.text = note.title;
    this.body.text = note.text;
    this.sheet.isVisible = true;
  }
}

/** Empty space in a column. */
function spacer(name: string, pixels: number): Rectangle {
  const space = new Rectangle(name);
  space.height = `${pixels}px`;
  space.thickness = 0;
  return space;
}
