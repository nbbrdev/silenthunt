import {
  Color3,
  Observable,
  PointLight,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import { createTorchModel, type TorchModel } from "../models/items/torch";
import type { Inventory } from "./inventory";

/**
 * The torch in the player's left hand (NBB-132, MA1). F lights it or puts it away (G2). Lighting
 * one takes a torch from the inventory (TC1-A, NBB-144); it burns for RF-14's 4 minutes while lit
 * and sputters in the last 20 s (TO4). Putting it away keeps the time it has left for next time;
 * once burnt out, F takes a new one.
 */
export class PlayerTorch {
  /** Fired when the torch is lit (true) or put away (false): the left arm shows with it. */
  readonly onLitChanged = new Observable<boolean>();

  private readonly model: TorchModel;
  private readonly light: PointLight;
  private readonly inventory: Inventory;
  private readonly say: (text: string) => void;
  private lit = false;
  private isBlocked = false;
  /** Burning time left on the torch in hand (0: there is none). */
  private secondsLeft = 0;
  private time = 0;

  /**
   * @param hand the left hand that holds it (the arms' "handL" node).
   * @param say shows a short message ("Você não tem tocha").
   */
  constructor(
    scene: Scene,
    hand: TransformNode,
    input: Input,
    inventory: Inventory,
    say: (text: string) => void,
  ) {
    this.inventory = inventory;
    this.say = say;
    this.model = createTorchModel(scene);
    const { heldOffset, heldTilt } = CONFIG.torch;
    this.model.root.parent = hand;
    this.model.root.position = new Vector3(heldOffset.x, heldOffset.y, heldOffset.z);
    // The handle goes through the fist, the head leaning forward and a little inward.
    // (For the left hand, "inward" is toward +x: a negative turn about Z.)
    this.model.root.rotation = new Vector3(heldTilt.forward, 0, -heldTilt.inward);
    // Drawn after the world with its own depth, so it never sinks into trees or the ground.
    for (const mesh of [this.model.root, this.model.flame]) {
      mesh.renderingGroupId = 1;
    }
    this.model.fire.renderingGroupId = 1;

    this.light = new PointLight("torchLight", Vector3.Zero(), scene);
    this.light.parent = this.model.flame;
    const { lightColor } = CONFIG.torch;
    this.light.diffuse = new Color3(lightColor.r, lightColor.g, lightColor.b);
    this.light.specular = Color3.Black();
    this.light.range = CONFIG.torch.lightRange;

    this.setLit(false);
    scene.onBeforeRenderObservable.add(() => {
      if (input.wasPressed("KeyF") && !this.isBlocked) {
        this.toggle();
      }
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /**
   * AR6: with the bow in hand there is no hand free for the torch: it goes out (keeping the time
   * it had left) and F does nothing until the bow is put away.
   */
  set blocked(blocked: boolean) {
    this.isBlocked = blocked;
    if (blocked && this.lit) {
      this.setLit(false);
    }
  }

  /** True while the torch is burning (RF-13: the player is seen from much farther away). */
  get isLit(): boolean {
    return this.lit;
  }

  /** Seconds of burning left on the current torch. */
  get remainingSeconds(): number {
    return this.secondsLeft;
  }

  /** NBB-147: the torch in hand comes back with the time it had left, put away. */
  restore(secondsLeft: number): void {
    this.secondsLeft = secondsLeft;
    if (this.lit) {
      this.setLit(false);
    }
  }

  private toggle(): void {
    if (!this.lit && this.secondsLeft <= 0) {
      // TC1-A: no torch in hand (or it burnt out): take one from the inventory.
      if (!this.inventory.remove("torch", 1)) {
        this.say("Você não tem tocha");
        return;
      }
      this.secondsLeft = CONFIG.torch.burnSeconds;
    }
    this.setLit(!this.lit);
  }

  private setLit(lit: boolean): void {
    this.lit = lit;
    // An unlit torch is put away: nothing in the hand.
    this.model.root.setEnabled(lit);
    this.light.setEnabled(lit);
    if (lit) {
      this.model.fire.start();
    } else {
      this.model.fire.stop();
    }
    this.onLitChanged.notifyObservers(lit);
  }

  private update(seconds: number): void {
    if (!this.lit) {
      return;
    }
    this.time += seconds;
    this.secondsLeft -= seconds;
    if (this.secondsLeft <= 0) {
      this.secondsLeft = 0;
      this.setLit(false);
      return;
    }

    // TO4: 1 while healthy, falling to 0 over the last dyingSeconds.
    const { dyingSeconds, lightIntensity, flicker } = CONFIG.torch;
    const strength = Math.min(1, this.secondsLeft / dyingSeconds);
    // TO3: a soft, irregular tremble (sum of waves); stronger when the torch is dying.
    const t = this.time;
    const wave = Math.sin(t * 13) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 7.3) * 0.2;
    const tremble = flicker * (1 + (1 - strength) * 3);
    const sputter = strength < 1 && Math.sin(t * 41) > 0.85 ? 0.4 : 1;
    this.light.intensity = Math.max(0, lightIntensity * strength * (1 + wave * tremble) * sputter);

    const flameSize = (0.4 + 0.6 * strength) * (1 + wave * 0.08);
    this.model.flame.scaling.set(flameSize, 1.8 * flameSize, flameSize);
    this.model.fire.emitRate = 120 * (0.3 + 0.7 * strength);
  }
}
