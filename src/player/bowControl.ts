import { Vector3, type Scene } from "@babylonjs/core";
import { Control, Ellipse, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { Input } from "../core/input";
import type { ArrowSystem } from "../systems/arrows";
import type { InteractionSystem } from "../systems/interactions";
import type { NoiseSystem } from "../systems/noise";
import type { SoundEffects } from "../systems/soundEffects";
import type { Equipment } from "./equipment";
import type { PlayerHands } from "./hands";
import type { Inventory } from "./inventory";
import type { Player } from "./player";

/**
 * Shooting the bow (NBB-140, RF-33, AR1–AR8). Hold the left button to draw (up to 1 s), release
 * to shoot; hold the right one to aim (a slight zoom). E picks up an arrow lying close by. While
 * the bow is in hand, a small dot marks the center when aiming or drawing, and a discreet counter
 * shows the arrows left.
 */
export class BowControl {
  private readonly player: Player;
  private readonly hands: PlayerHands;
  private readonly arrows: ArrowSystem;
  private readonly noise: NoiseSystem;
  private readonly equipment: Equipment;
  private readonly baseFov: number;
  private readonly dot: Ellipse;
  private readonly counter: TextBlock;
  private readonly inventory: Inventory;
  private drawing = false;
  private drawSeconds = 0;
  private aim = 0;
  /** NBB-149 (FE1, FE2): drawing and shooting are heard. */
  sounds: SoundEffects | undefined;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    hands: PlayerHands,
    arrows: ArrowSystem,
    noise: NoiseSystem,
    equipment: Equipment,
    ui: AdvancedDynamicTexture,
    interactions: InteractionSystem,
    inventory: Inventory,
  ) {
    this.inventory = inventory;
    this.player = player;
    this.hands = hands;
    this.arrows = arrows;
    this.noise = noise;
    this.equipment = equipment;
    this.baseFov = player.camera.fov;

    // AR7: a small, faint dot at the center.
    this.dot = new Ellipse("aimDot");
    this.dot.width = "5px";
    this.dot.height = "5px";
    this.dot.thickness = 0;
    this.dot.background = "white";
    this.dot.alpha = 0.55;
    this.dot.isVisible = false;
    ui.addControl(this.dot);

    // AR8: the arrows left, bottom right.
    this.counter = new TextBlock("arrowCount", "");
    this.counter.color = "white";
    this.counter.alpha = 0.55;
    this.counter.fontSize = 16;
    this.counter.width = "160px";
    this.counter.height = "24px";
    this.counter.left = "-36px";
    this.counter.top = "-30px";
    this.counter.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.counter.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.counter.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    ui.addControl(this.counter);

    // AR5: E picks up an arrow lying close by, whatever is in hand.
    interactions.add(() => {
      if (!this.player.controlsEnabled) {
        return undefined;
      }
      const reach = CONFIG.bow.pickupDistance;
      const arrow = this.arrows.nearestStuck(this.player.position, reach);
      if (!arrow) {
        return undefined;
      }
      const { x, z } = this.player.position;
      const distance = Math.hypot(arrow.position.x - x, arrow.position.z - z);
      if (this.inventory.spaceFor("arrow") <= 0) {
        return { label: "Inventário cheio", distance };
      }
      return {
        label: "Pegar flecha",
        distance,
        sound: "pickup",
        act: () => {
          if (this.arrows.pickUp(this.player.position, reach)) {
            this.inventory.add("arrow", 1);
          }
        },
      };
    });

    scene.onBeforeRenderObservable.add(() => {
      this.update(input, frameSeconds(scene));
    });
  }

  /**
   * Development only: stands in for the mouse buttons (the headless browser used for automated
   * checks cannot capture the mouse). `undefined` gives control back to the real buttons.
   */
  debugButtons: { draw: boolean; aim: boolean } | undefined;

  /** Arrows in the inventory (RF-57). */
  get arrowCount(): number {
    return this.inventory.count("arrow");
  }

  private update(input: Input, seconds: number): void {
    const settings = CONFIG.bow;
    const holdingBow = this.equipment.current === "bow";
    const canAct = holdingBow && this.player.controlsEnabled;
    const arrowsLeft = this.arrowCount;

    // AR2: drawing with the left button, shooting on release.
    const drawHeld = this.debugButtons?.draw ?? input.isDown("Mouse0");
    const aimHeld = this.debugButtons?.aim ?? input.isDown("Mouse2");
    if (canAct && arrowsLeft > 0 && drawHeld) {
      if (!this.drawing) {
        // FE1-A, FE7: the string creaks while it is drawn.
        this.sounds?.play("bowDraw");
      }
      this.drawing = true;
      this.drawSeconds = Math.min(this.drawSeconds + seconds, settings.fullDrawSeconds);
    } else if (this.drawing) {
      this.sounds?.stop("bowDraw");
      const draw = this.drawSeconds / settings.fullDrawSeconds;
      if (canAct && draw >= settings.minDraw) {
        this.shoot(draw);
      }
      this.drawing = false;
      this.drawSeconds = 0;
    }

    // AR2: aiming with the right button eases in a slight zoom.
    const aimTarget = canAct && aimHeld ? 1 : 0;
    this.aim += Math.max(-seconds * 5, Math.min(seconds * 5, aimTarget - this.aim));
    // Only while the bow is in hand (or letting go of the aim): the shotgun zooms too.
    if (holdingBow || this.aim > 0) {
      const camera = this.player.camera;
      camera.fov = this.baseFov + (settings.aimFov - this.baseFov) * this.aim;
    }

    const draw = this.drawSeconds / settings.fullDrawSeconds;
    this.hands.setBowPose(draw, Math.max(this.aim, draw > 0 ? 0.6 : 0), arrowsLeft > 0);
    this.dot.isVisible = holdingBow && (this.aim > 0.5 || this.drawing);
    this.counter.isVisible = holdingBow;
    this.counter.text = `Flechas: ${arrowsLeft}`;
  }

  /** AR3-A: the arrow leaves from just in front of the eyes, toward the center of the view. */
  private shoot(draw: number): void {
    const { minSpeed, maxSpeed } = CONFIG.bow;
    const camera = this.player.camera;
    const direction = camera.getDirection(Vector3.Forward());
    const origin = camera.globalPosition.add(direction.scale(0.5));
    if (!this.inventory.remove("arrow", 1)) {
      return;
    }
    this.arrows.fire(origin, direction, minSpeed + (maxSpeed - minSpeed) * draw);
    this.sounds?.play("bowRelease");
    // FX14: and the arrow flies off.
    this.sounds?.play("arrowFly");
    this.noise.emit(this.player.feet, CONFIG.noise.radius.bow, "bow");
  }
}
