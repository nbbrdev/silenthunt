import {
  Color3,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AnimationGroup,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, paint, toColor } from "../lowPoly";
import { buildPoseAnimations, type Key } from "../rig/poses";
import { buildSkeleton, type BoneDef } from "../rig/skeleton";
import { boneLookup, piecewise, skinTo, tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The player's arms in the camera's space (meters: x right, y up, z forward). The shoulders are
 * behind and below the view; only the forearms and hands show at the bottom of the screen.
 */
function armBones(): BoneDef[] {
  // The right hand holds the knife ahead; the left one holds the torch lower, so the flame stays
  // in the lower left of the screen instead of in the middle of the view.
  const points = {
    R: [v(0.3, -0.36, -0.16), v(0.31, -0.3, 0.18), v(0.24, -0.18, 0.44), v(0.23, -0.16, 0.53)],
    L: [v(-0.3, -0.42, -0.12), v(-0.32, -0.36, 0.22), v(-0.27, -0.25, 0.48), v(-0.26, -0.23, 0.57)],
  };
  const bones: BoneDef[] = [{ name: "root", parent: null, head: v(0, 0, 0), tail: v(0, 0, 0.1) }];
  for (const side of ["R", "L"] as const) {
    const [shoulder, elbow, wrist, knuckles] = points[side].map((point) => point.clone()) as [
      Vector3,
      Vector3,
      Vector3,
      Vector3,
    ];
    bones.push(
      { name: `upperArm${side}`, parent: "root", head: shoulder, tail: elbow },
      { name: `forearm${side}`, parent: `upperArm${side}`, head: elbow, tail: wrist },
      { name: `hand${side}`, parent: `forearm${side}`, head: wrist, tail: knuckles },
    );
  }
  return bones;
}

const TILE = 0.15;

export interface ArmsModel extends GeneratedModel {
  /** The right arm (always visible) and the left arm (only while holding the torch, MA1). */
  right: Mesh;
  left: Mesh;
  /** The hands, to hold the knife (right) and the torch (left). */
  rightHand: TransformNode;
  leftHand: TransformNode;
  idle: AnimationGroup | undefined;
  stab: AnimationGroup | undefined;
}

/**
 * The player's arms (NBB-139, MA1): sleeves of a dark coat and bare hands closed in a fist, on a
 * 7-bone skeleton (A5-B). Two meshes share it, so the left arm can be hidden on its own.
 */
export function createArmsModel(scene: Scene, seed: number): ArmsModel {
  const root = new TransformNode("arms", scene);
  const defs = armBones();
  const { nodes, indexOf, skeleton } = buildSkeleton(scene, "arms", defs, root);
  const { bone, skinBone } = boneLookup(defs, indexOf);
  const coat = toColor(CONFIG.palette.coat);
  const skin = toColor(CONFIG.palette.skin);

  const buildArm = (side: "R" | "L"): Mesh => {
    const s = side === "R" ? 1 : -1;
    const parts: Mesh[] = [];
    const bones = [`upperArm${side}`, `forearm${side}`, `hand${side}`].map(skinBone);
    const shoulder = bone(`upperArm${side}`).head;
    const elbow = bone(`forearm${side}`).head;
    const wrist = bone(`hand${side}`).head;
    const knuckles = bone(`hand${side}`).tail;
    const alongForearm = (t: number) => Vector3.Lerp(elbow, wrist, t);
    const alongHand = (t: number) => Vector3.Lerp(wrist, knuckles, t);

    const sleeve = tube(
      scene,
      `sleeve${side}`,
      [shoulder, elbow, alongForearm(0.9)],
      (t) => piecewise(t, [0.065, 0.055, 0.045]),
      8,
      TILE,
    );
    paint(sleeve, coat, seed);
    skinTo(sleeve, bones);
    parts.push(sleeve);

    // A loose cuff at the wrist.
    const cuff = tube(
      scene,
      `cuff${side}`,
      [alongForearm(0.86), alongForearm(0.97)],
      () => 0.05,
      8,
      TILE,
      1,
    );
    paint(cuff, coat.scale(0.8), seed + 1);
    skinTo(cuff, bones);
    parts.push(cuff);

    // The fist: a short, wide block of a hand, thumb on top.
    const fist = tube(
      scene,
      `fist${side}`,
      [alongForearm(0.95), wrist, alongHand(0.6), knuckles],
      (t) => piecewise(t, [0.022, 0.028, 0.029, 0.023]),
      7,
      TILE,
      2,
    );
    paint(fist, skin, seed + 2);
    skinTo(fist, [skinBone(`forearm${side}`), skinBone(`hand${side}`)]);
    parts.push(fist);

    const up = (point: Vector3, height: number) => point.add(v(-0.012 * s, height, 0));
    const thumb = tube(
      scene,
      `thumb${side}`,
      [up(alongHand(0.15), 0.022), up(alongHand(0.55), 0.03), up(knuckles, 0.026)],
      (t) => piecewise(t, [0.014, 0.012, 0.01]),
      5,
      TILE,
      1,
    );
    paint(thumb, skin.scale(0.95), seed + 3);
    skinTo(thumb, [skinBone(`hand${side}`)]);
    parts.push(thumb);

    const mesh = assemble(`arms${side}`, parts, getArmsMaterial(scene));
    mesh.parent = root;
    mesh.skeleton = skeleton;
    mesh.numBoneInfluencers = 4;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  };

  const right = buildArm("R");
  const left = buildArm("L");
  const animations = buildArmAnimations(scene, nodes);
  const rightHand = nodes.get("handR") ?? root;
  const leftHand = nodes.get("handL") ?? root;
  return {
    root,
    animations,
    right,
    left,
    rightHand,
    leftHand,
    idle: animations.find((group) => group.name === "Segurar"),
    stab: animations.find((group) => group.name === "Golpear"),
  };
}

const armsMaterialByScene = new WeakMap<Scene, StandardMaterial>();

/** Plain vertex colors (coat and skin), matte: textures looked like scratches this close up. */
function getArmsMaterial(scene: Scene): StandardMaterial {
  const existing = armsMaterialByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("playerArms", scene);
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  armsMaterialByScene.set(scene, material);
  return material;
}

/** "Segurar": a slow breath. "Golpear": the right arm draws back, then thrusts forward (0.4 s). */
function buildArmAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  const breath: Key[] = [
    { frame: 0, pose: { upperArmR: [0.015, 0, 0], upperArmL: [0.015, 0, 0] } },
    { frame: 60, pose: { upperArmR: [-0.015, 0, 0], upperArmL: [-0.015, 0, 0] } },
    { frame: 120, pose: { upperArmR: [0.015, 0, 0], upperArmL: [0.015, 0, 0] } },
  ];
  // Rotation about X: −x raises the knife's tip, +x lowers it.
  const stab: Key[] = [
    { frame: 0, pose: {}, hips: [0, 0, 0] },
    { frame: 4, pose: { handR: [0.15, 0, 0] }, hips: [0.01, -0.015, -0.06] },
    { frame: 7, pose: { handR: [-0.1, 0, 0] }, hips: [-0.035, 0.035, 0.2] },
    { frame: 12, pose: {}, hips: [0, 0, 0] },
  ];
  return buildPoseAnimations(
    scene,
    nodes,
    [
      ["Segurar", breath],
      ["Golpear", stab],
    ],
    "upperArmR",
  );
}

/** The arms in the gallery (A2-C). */
export const arms: ModelGenerator = {
  id: "arms",
  label: "Braços",
  create(scene: Scene, seed: number): GeneratedModel {
    const model = createArmsModel(scene, seed);
    // In the game the arms hang below the camera; here they are lifted above the ground.
    model.root.position.y = 0.6;
    model.left.setEnabled(true);
    return { root: model.root, animations: model.animations };
  },
};
