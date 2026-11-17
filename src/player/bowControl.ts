import { Vector3, type Scene } from "@babylonjs/core";
import { Control, Ellipse, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { ArrowSystem } from "../systems/arrows";
import type { NoiseSystem } from "../systems/noise";
import type { Equipment } from "./equipment";
import type { PlayerHands } from "./hands";
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
  private readonly hint: TextBlock;
  private arrowsLeft: number = CONFIG.bow.startArrows;
  private drawing = false;
  private drawSeconds = 0;
  private aim = 0;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    hands: PlayerHands,
    arrows: ArrowSystem,
    noise: NoiseSystem,
    equipment: Equipment,
    ui: AdvancedDynamicTexture,
  ) {
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

    // AR5: how to pick up an arrow, shown only when one is in reach.
    this.hint = new TextBlock("arrowHint", "[E] Pegar flecha");
    this.hint.color = "white";
    this.hint.alpha = 0.7;
    this.hint.fontSize = 16;
    this.hint.height = "24px";
    this.hint.top = "60px";
    this.hint.isVisible = false;
    ui.addControl(this.hint);

    scene.onBeforeRenderObservable.add(() => {
      this.update(input, Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /**
   * Development only: stands in for the mouse buttons (the headless browser used for automated
   * checks cannot capture the mouse). `undefined` gives control back to the real buttons.
   */
  debugButtons: { draw: boolean; aim: boolean } | undefined;

  /** Arrows left (development console, and the inventory later). */
  get arrowCount(): number {
    return this.arrowsLeft;
  }

  private update(input: Input, seconds: number): void {
    const settings = CONFIG.bow;
    const holdingBow = this.equipment.current === "bow";
    const canAct = holdingBow && this.player.controlsEnabled;

    // AR5: picking up arrows works whatever is in hand.
    const reach = this.arrows.nearestStuck(this.player.position, settings.pickupDistance);
    this.hint.isVisible = reach !== undefined && this.player.controlsEnabled;
    if (reach && this.player.controlsEnabled && input.wasPressed("KeyE")) {
      if (this.arrows.pickUp(this.player.position, settings.pickupDistance)) {
        this.arrowsLeft++;
      }
    }

    // AR2: drawing with the left button, shooting on release.
    const drawHeld = this.debugButtons?.draw ?? input.isDown("Mouse0");
    const aimHeld = this.debugButtons?.aim ?? input.isDown("Mouse2");
    if (canAct && this.arrowsLeft > 0 && drawHeld) {
      this.drawing = true;
      this.drawSeconds = Math.min(this.drawSeconds + seconds, settings.fullDrawSeconds);
    } else if (this.drawing) {
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
    const camera = this.player.camera;
    camera.fov = this.baseFov + (settings.aimFov - this.baseFov) * this.aim;

    const draw = this.drawSeconds / settings.fullDrawSeconds;
    this.hands.setBowPose(draw, Math.max(this.aim, draw > 0 ? 0.6 : 0), this.arrowsLeft > 0);
    this.dot.isVisible = holdingBow && (this.aim > 0.5 || this.drawing);
    this.counter.isVisible = holdingBow;
    this.counter.text = `Flechas: ${this.arrowsLeft}`;
  }

  /** AR3-A: the arrow leaves from just in front of the eyes, toward the center of the view. */
  private shoot(draw: number): void {
    const { minSpeed, maxSpeed } = CONFIG.bow;
    const camera = this.player.camera;
    const direction = camera.getDirection(Vector3.Forward());
    const origin = camera.globalPosition.add(direction.scale(0.5));
    this.arrows.fire(origin, direction, minSpeed + (maxSpeed - minSpeed) * draw);
    this.arrowsLeft--;
    this.noise.emit(this.player.feet, CONFIG.noise.radius.bow, "bow");
  }
}
