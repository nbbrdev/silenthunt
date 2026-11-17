import { Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import { createKnifeMesh } from "../models/items/knife";
import { createArmsModel, type ArmsModel } from "../models/player/arms";
import type { Player } from "./player";

/**
 * The player's arms on screen (NBB-139, MA1, MA5): the right hand holds the knife (MA3: always,
 * until the inventory exists), the left one shows up only to hold the lit torch. The hands
 * breathe when still, sway with each step and thrust the knife on an attack.
 */
export class PlayerHands {
  readonly arms: ArmsModel;
  readonly knife: Mesh;

  private readonly player: Player;
  private swayTime = 0;
  private stabbing = false;

  constructor(scene: Scene, player: Player) {
    this.player = player;
    this.arms = createArmsModel(scene, 7);
    this.arms.root.parent = player.camera;

    this.knife = createKnifeMesh(scene);
    this.knife.parent = this.arms.rightHand;
    // The handle goes through the fist, the blade pointing ahead and slightly up.
    this.knife.position = new Vector3(0, 0.005, 0.0);
    this.knife.rotation = new Vector3(-0.25, 0, 0);

    // Drawn after the world with its own depth, so the hands never sink into trees or the ground.
    for (const mesh of [this.arms.right, this.arms.left, this.knife]) {
      mesh.renderingGroupId = 1;
    }
    this.showLeftHand(false);
    this.arms.idle?.start(true);

    scene.onBeforeRenderObservable.add(() => {
      this.sway(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** MA1: the left arm only shows while it holds the lit torch. */
  showLeftHand(visible: boolean): void {
    this.arms.left.setEnabled(visible);
  }

  /** MA4: the knife thrust (the hit itself is decided by KnifeAttack). */
  stab(): void {
    const { stab, idle } = this.arms;
    if (!stab || this.stabbing) {
      return;
    }
    this.stabbing = true;
    stab.start(false, 1);
    idle?.stop();
    stab.onAnimationGroupEndObservable.addOnce(() => {
      this.stabbing = false;
      idle?.start(true);
    });
  }

  /** MA5: a gentle sway that follows the steps (one swing left and right per two steps). */
  private sway(seconds: number): void {
    const gait = this.player.gait;
    const { handSway } = CONFIG;
    const { stepInterval } = CONFIG.noise;
    const amount = gait === "still" ? handSway.still : handSway[gait];
    const stepSeconds = gait === "still" ? 2 : stepInterval[gait];
    this.swayTime += (seconds / stepSeconds) * Math.PI;
    const side = Math.sin(this.swayTime) * amount;
    const bob = -Math.abs(Math.cos(this.swayTime)) * amount;
    this.arms.root.position.set(side, bob, 0);
  }
}
