import type { Scene } from "@babylonjs/core";
import { Control, Rectangle, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import type { Player } from "../player/player";
import { COMPASS_LETTERS } from "../systems/objectiveTexts";

/** Half the strip's width (pixels) and how much of the view it covers to each side (radians). */
const HALF_WIDTH = 160;
const HALF_ANGLE = Math.PI / 2;

/**
 * The compass (NBB-156; OB3-A, OB12): a discreet strip at the top of the screen with N, NE, L,
 * SE, S, SO, O and NO sliding as the player turns. North is fixed in the world (+Z), the same
 * north the notes use for their directions.
 */
export class Compass {
  constructor(ui: AdvancedDynamicTexture, scene: Scene, player: Player) {
    const strip = new Rectangle("compass");
    strip.width = `${HALF_WIDTH * 2}px`;
    strip.height = "26px";
    strip.top = "14px";
    strip.thickness = 0;
    strip.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    strip.isHitTestVisible = false;
    ui.addControl(strip);

    // A small mark at the center: where the player looks.
    const mark = new Rectangle("compassMark");
    mark.width = "2px";
    mark.height = "6px";
    mark.thickness = 0;
    mark.background = "white";
    mark.alpha = 0.5;
    mark.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    strip.addControl(mark);

    const letters = COMPASS_LETTERS.map((letter, index) => {
      const text = new TextBlock(`compass-${letter}`, letter);
      text.color = "white";
      // The four main directions a little larger than the ones in between.
      text.fontSize = index % 2 === 0 ? 16 : 12;
      text.width = "40px";
      text.height = "20px";
      text.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      strip.addControl(text);
      return { text, angle: (index * Math.PI) / 4 };
    });

    scene.onBeforeRenderObservable.add(() => {
      const yaw = player.view.yaw;
      for (const { text, angle } of letters) {
        const offset = Math.atan2(Math.sin(angle - yaw), Math.cos(angle - yaw));
        const x = (offset / HALF_ANGLE) * HALF_WIDTH;
        const edge = Math.abs(x) / HALF_WIDTH;
        text.isVisible = edge < 0.95;
        text.left = `${x}px`;
        // Fades toward the ends of the strip.
        text.alpha = 0.75 * Math.max(0, 1 - edge * edge);
      }
    });
  }
}
