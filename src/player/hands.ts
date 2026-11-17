import { Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import {
  BRACE_HEIGHT,
  DRAW_LENGTH,
  createArrowMesh,
  createBowModel,
  type BowModel,
} from "../models/items/bow";
import { createKnifeMesh } from "../models/items/knife";
import { createShotgunModel, type ShotgunModel } from "../models/items/shotgun";
import { REST_WRIST, createArmsModel, type ArmsModel } from "../models/player/arms";
import type { Tool } from "./equipment";
import type { Player } from "./player";

/** Where the bow's grip sits in the left fist, relative to the wrist (meters). */
const BOW_GRIP = new Vector3(0.005, 0.01, 0.045);
/**
 * With the bow, the left arm reaches forward (a 1.2 m bow close to the eyes would fill the whole
 * screen), and the bow leans right, the way archers cant it.
 */
const BOW_REACH = new Vector3(0.05, 0.05, 0.2);
const BOW_CANT = -0.45;
/** How far the left hand comes in and up while aiming (AR2), in the arms' space. */
const AIM_LIFT = new Vector3(0.1, 0.07, 0.03);
/** The right fist sits just behind the string (its knuckles on it). */
const STRING_HOLD = new Vector3(0, -0.035, -0.07);
/** ES2: the shotgun held low at the hip, or raised to the eye when aiming (arms' space). */
const GUN_HIP = new Vector3(0.15, -0.2, 0.42);
const GUN_AIM = new Vector3(0.0, -0.09, 0.4);
/** Where each wrist goes on the gun: the right one on the grip, the left one on the fore-end. */
const GUN_RIGHT_WRIST = new Vector3(0, -0.05, -0.03);
const GUN_LEFT_WRIST = new Vector3(0, -0.05, 0.26);

/**
 * The player's arms on screen (NBB-139, NBB-140; MA1, MA5, AR6). With the knife, the right hand
 * holds it and the left one shows up only to hold the lit torch. With the bow, the left hand holds
 * the bow and the right one draws the string. The hands breathe when still and sway with each
 * step.
 */
export class PlayerHands {
  readonly arms: ArmsModel;
  readonly knife: Mesh;
  readonly bow: BowModel;
  readonly shotgun: ShotgunModel;

  private readonly player: Player;
  private readonly nockedArrow: Mesh;
  private readonly restRightShoulder: Vector3;
  private readonly restLeftShoulder: Vector3;
  private tool: Tool = "knife";
  private torchLit = false;
  private swayTime = 0;
  private stabbing = false;

  constructor(scene: Scene, player: Player) {
    this.player = player;
    this.arms = createArmsModel(scene, 7);
    this.arms.root.parent = player.camera;
    this.restRightShoulder = this.arms.rightShoulder.position.clone();
    this.restLeftShoulder = this.arms.leftShoulder.position.clone();

    this.knife = createKnifeMesh(scene);
    this.knife.parent = this.arms.rightHand;
    // The handle goes through the fist, the blade pointing ahead and slightly up.
    this.knife.position = new Vector3(0, 0.005, 0.0);
    this.knife.rotation = new Vector3(-0.25, 0, 0);

    this.bow = createBowModel(scene);
    this.bow.root.parent = this.arms.leftHand;
    this.bow.root.position = BOW_GRIP.clone();
    this.bow.root.rotation.z = BOW_CANT;
    // The arrow rests on the bow, its nock on the string.
    this.nockedArrow = createArrowMesh(scene);
    this.nockedArrow.parent = this.bow.root;

    this.shotgun = createShotgunModel(scene);
    this.shotgun.root.parent = this.arms.root;

    // Drawn after the world with its own depth, so the hands never sink into trees or the ground.
    const meshes = [this.arms.right, this.arms.left, this.knife, this.nockedArrow];
    meshes.push(...this.bow.root.getChildMeshes(false).map((mesh) => mesh as Mesh));
    meshes.push(...this.shotgun.root.getChildMeshes(false).map((mesh) => mesh as Mesh));
    for (const mesh of meshes) {
      mesh.renderingGroupId = 1;
    }
    this.equip("knife");
    this.arms.idle?.start(true);

    scene.onBeforeRenderObservable.add(() => {
      this.sway(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** MA1: the left arm shows while it holds the lit torch (or the bow). */
  showLeftHand(torchLit: boolean): void {
    this.torchLit = torchLit;
    this.updateVisibility();
  }

  /** AR1: switches what the hands hold. */
  equip(tool: Tool): void {
    this.tool = tool;
    this.updateVisibility();
    if (tool === "knife") {
      this.arms.leftShoulder.position.copyFrom(this.restLeftShoulder);
      this.arms.idle?.start(true);
    } else {
      this.arms.idle?.stop();
      this.setBowPose(0, 0, true);
      this.setShotgunPose(0, 0, 0);
    }
  }

  /**
   * ES2, ES3: the shotgun pose. `aim` (0–1) raises it to the eye, `recoil` (0–1) kicks it back
   * and up after a shot, `open` (0–1) tips the barrels down to reload. Both hands hold it.
   */
  setShotgunPose(aim: number, recoil: number, open: number): void {
    if (this.tool !== "shotgun") {
      return;
    }
    const gun = Vector3.Lerp(GUN_HIP, GUN_AIM, aim).add(
      new Vector3(0, 0.015 * recoil, -0.07 * recoil),
    );
    this.shotgun.root.position.copyFrom(gun);
    this.shotgun.root.rotation.set(-0.15 * recoil, 0, 0);
    this.shotgun.setOpen(open);
    const right = gun.add(GUN_RIGHT_WRIST);
    // The left hand stays on the fore-end, which drops with the barrels.
    const left = gun.add(GUN_LEFT_WRIST).add(new Vector3(0, -0.13 * open, -0.03 * open));
    this.arms.rightShoulder.position.copyFrom(
      this.restRightShoulder.add(right.subtract(REST_WRIST.R)),
    );
    this.arms.leftShoulder.position.copyFrom(
      this.restLeftShoulder.add(left.subtract(REST_WRIST.L)),
    );
  }

  /**
   * AR2, AR6: the bow pose. `draw` (0–1) pulls the string back, `aim` (0–1) brings the bow in
   * front of the eyes; `arrowReady` shows the arrow on the string.
   */
  setBowPose(draw: number, aim: number, arrowReady: boolean): void {
    if (this.tool !== "bow") {
      return;
    }
    const lift = BOW_REACH.add(AIM_LIFT.scale(aim));
    this.arms.leftShoulder.position.copyFrom(this.restLeftShoulder.add(lift));
    this.bow.setDraw(draw);
    const nockZ = -BRACE_HEIGHT - draw * DRAW_LENGTH;
    this.nockedArrow.setEnabled(arrowReady);
    this.nockedArrow.position.set(-0.012, 0, nockZ);

    // The right fist follows the string: where the nock is, in the arms' space.
    const nock = REST_WRIST.L.add(lift)
      .add(BOW_GRIP)
      .add(new Vector3(0, 0, nockZ));
    const wrist = nock.add(STRING_HOLD);
    this.arms.rightShoulder.position.copyFrom(
      this.restRightShoulder.add(wrist.subtract(REST_WRIST.R)),
    );
  }

  /** MA4: the knife thrust (the hit itself is decided by KnifeAttack). */
  stab(): void {
    const { stab, idle } = this.arms;
    if (!stab || this.stabbing || this.tool !== "knife") {
      return;
    }
    this.stabbing = true;
    stab.start(false, 1);
    idle?.stop();
    stab.onAnimationGroupEndObservable.addOnce(() => {
      this.stabbing = false;
      if (this.tool === "knife") {
        idle?.start(true);
      }
    });
  }

  private updateVisibility(): void {
    const bow = this.tool === "bow";
    const gun = this.tool === "shotgun";
    this.knife.setEnabled(this.tool === "knife");
    this.bow.root.setEnabled(bow);
    this.shotgun.root.setEnabled(gun);
    this.arms.left.setEnabled(bow || gun || this.torchLit);
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
