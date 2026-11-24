import type { Scene } from "@babylonjs/core";
import { Control, Rectangle, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
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
  /**
   * NBB-157 (MP4-A, MP8): the map's destination, if any: a diamond in its direction with the
   * distance under it, or an arrow at the strip's end when it lies outside the strip.
   */
  destination: () => { x: number; z: number } | undefined = () => undefined;

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

    const marker = new Rectangle("compassDestination");
    marker.width = "9px";
    marker.height = "9px";
    marker.thickness = 0;
    marker.background = CONFIG.map.colors.mark;
    marker.rotation = Math.PI / 4;
    marker.top = "18px";
    marker.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    marker.isVisible = false;
    ui.addControl(marker);
    const arrow = new TextBlock("compassDestinationArrow", "");
    arrow.color = CONFIG.map.colors.mark;
    arrow.fontSize = 22;
    arrow.width = "20px";
    arrow.height = "26px";
    arrow.top = "14px";
    arrow.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    arrow.isVisible = false;
    ui.addControl(arrow);
    const distance = new TextBlock("compassDestinationDistance", "");
    distance.color = "white";
    distance.alpha = 0.75;
    distance.fontSize = 12;
    distance.width = "60px";
    distance.height = "16px";
    distance.top = "40px";
    distance.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    distance.isVisible = false;
    ui.addControl(distance);

    scene.onBeforeRenderObservable.add(() => {
      const yaw = player.view.yaw;
      const target = this.destination();
      marker.isVisible = false;
      arrow.isVisible = false;
      distance.isVisible = target !== undefined;
      if (target) {
        const feet = player.feet;
        const angle = Math.atan2(target.x - feet.x, target.z - feet.z);
        const offset = Math.atan2(Math.sin(angle - yaw), Math.cos(angle - yaw));
        const x = (offset / HALF_ANGLE) * HALF_WIDTH;
        const inside = Math.abs(x) <= HALF_WIDTH;
        const left = inside ? x : Math.sign(x) * (HALF_WIDTH + 12);
        marker.isVisible = inside;
        marker.left = `${left}px`;
        arrow.isVisible = !inside;
        arrow.text = x < 0 ? "‹" : "›";
        arrow.left = `${left}px`;
        distance.left = `${left}px`;
        distance.text = `${Math.round(Math.hypot(target.x - feet.x, target.z - feet.z))} m`;
      }
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
