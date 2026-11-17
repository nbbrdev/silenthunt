import { Color3, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, paint, toColor } from "../lowPoly";
import { blend, buildPoseAnimations, type Key, type Pose } from "../rig/poses";
import { buildSkeleton, type BoneDef } from "../rig/skeleton";
import { boneLookup, piecewise, skinTo, tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";
import { blob, ear, getFurMaterial, narrow } from "./parts";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The doe's skeleton in its rest pose (meters, facing +Z, hooves on the ground). CO2: about 1.8 m
 * from nose to tail and 1.1 m at the withers. The hind leg's "knee" (the hock) points backwards.
 */
function deerBones(): BoneDef[] {
  const bones: BoneDef[] = [
    { name: "root", parent: null, head: v(0, 0, 0), tail: v(0, 0.1, 0) },
    { name: "pelvis", parent: "root", head: v(0, 0.9, -0.45), tail: v(0, 0.88, -0.1) },
    { name: "spine", parent: "pelvis", head: v(0, 0.88, -0.1), tail: v(0, 0.88, 0.25) },
    { name: "chest", parent: "spine", head: v(0, 0.88, 0.25), tail: v(0, 0.92, 0.45) },
    { name: "neck", parent: "chest", head: v(0, 0.92, 0.45), tail: v(0, 1.35, 0.66) },
    { name: "head", parent: "neck", head: v(0, 1.35, 0.66), tail: v(0, 1.24, 0.95) },
    { name: "tail", parent: "pelvis", head: v(0, 0.95, -0.66), tail: v(0, 0.82, -0.72) },
  ];
  for (const [side, s] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    bones.push(
      {
        name: `ear${side}`,
        parent: "head",
        head: v(0.05 * s, 1.42, 0.68),
        tail: v(0.17 * s, 1.53, 0.63),
      },
      // Front leg: shoulder, elbow, "knee" (the carpus), fetlock, hoof.
      {
        name: `upperArm${side}`,
        parent: "chest",
        head: v(0.11 * s, 0.8, 0.38),
        tail: v(0.11 * s, 0.58, 0.34),
      },
      {
        name: `forearm${side}`,
        parent: `upperArm${side}`,
        head: v(0.11 * s, 0.58, 0.34),
        tail: v(0.1 * s, 0.32, 0.37),
      },
      {
        name: `frontCannon${side}`,
        parent: `forearm${side}`,
        head: v(0.1 * s, 0.32, 0.37),
        tail: v(0.1 * s, 0.07, 0.37),
      },
      {
        name: `frontHoof${side}`,
        parent: `frontCannon${side}`,
        head: v(0.1 * s, 0.07, 0.37),
        tail: v(0.1 * s, 0, 0.41),
      },
      // Hind leg: hip, stifle (forward), hock (backward), fetlock, hoof.
      {
        name: `thigh${side}`,
        parent: "pelvis",
        head: v(0.11 * s, 0.85, -0.45),
        tail: v(0.12 * s, 0.58, -0.33),
      },
      {
        name: `shin${side}`,
        parent: `thigh${side}`,
        head: v(0.12 * s, 0.58, -0.33),
        tail: v(0.1 * s, 0.38, -0.56),
      },
      {
        name: `hindCannon${side}`,
        parent: `shin${side}`,
        head: v(0.1 * s, 0.38, -0.56),
        tail: v(0.1 * s, 0.07, -0.5),
      },
      {
        name: `hindHoof${side}`,
        parent: `hindCannon${side}`,
        head: v(0.1 * s, 0.07, -0.5),
        tail: v(0.1 * s, 0, -0.46),
      },
    );
  }
  return bones;
}

/** Body thickness: a deer is taller than it is wide. */
const BODY_WIDTH = 0.75;
const FUR_TILE = CONFIG.surfaces.furTileMeters;

/**
 * The deer (NBB-137, M6-B): a doe without antlers (CO3: antlers belong to the creature alone),
 * muted red-brown with a light belly and rump (CO4), from the user's references (CO1). One skinned
 * mesh on a 25-bone skeleton (A5-B).
 */
export const deer: ModelGenerator = {
  id: "deer",
  label: "Cervo",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("deer", scene);
    const defs = deerBones();
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, "deer", defs, root);
    const { bone, skinBone } = boneLookup(defs, indexOf);
    const fur = toColor(CONFIG.palette.deerFur);
    const light = toColor(CONFIG.palette.deerLight);
    const dark = toColor(CONFIG.palette.animalDark);
    const parts: Mesh[] = [];

    // Each part has its own colors: the light belly and rump only on the body, so the tops of the
    // legs do not get light patches; dark hooves and nose; a light muzzle.
    const bodyColor = (_x: number, y: number, z: number): Color3 => {
      if (z < -0.6 && y > 0.78) return light;
      if (y < 0.72) return Color3.Lerp(fur, light, Math.min(1, (0.72 - y) / 0.08));
      return fur;
    };
    const legColor = (_x: number, y: number): Color3 => {
      if (y < 0.05) return dark;
      if (y < 0.45) return fur.scale(0.82);
      return fur;
    };
    const headColor = (_x: number, y: number, z: number): Color3 => {
      if (z > 0.94 && y < 1.3) return dark;
      if (z > 0.84 && y < 1.27) return Color3.Lerp(fur, light, 0.6);
      return fur;
    };
    const add = (
      mesh: Mesh,
      bones: string[],
      seedOffset: number,
      color: Color3 | ((x: number, y: number, z: number) => Color3) = fur,
    ) => {
      skinTo(mesh, bones.map(skinBone));
      paint(mesh, color, seed + seedOffset);
      parts.push(mesh);
    };

    // --- Body: rounded rump, slim waist, deep chest.
    const torso = tube(
      scene,
      "deerTorso",
      [v(0, 0.93, -0.72), v(0, 0.91, -0.45), v(0, 0.92, -0.1), v(0, 0.86, 0.22), v(0, 0.93, 0.5)],
      (t) => piecewise(t, [0.08, 0.2, 0.17, 0.23, 0.14]),
      10,
      FUR_TILE,
    );
    add(narrow(torso, BODY_WIDTH), ["pelvis", "spine", "chest", "neck"], 1, bodyColor);

    const neck = tube(
      scene,
      "deerNeck",
      [v(0, 0.9, 0.36), bone("neck").head, v(0, 1.15, 0.56), bone("head").head],
      (t) => piecewise(t, [0.13, 0.11, 0.08, 0.07]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(neck, 0.8), ["chest", "neck", "head"], 2);

    const head = tube(
      scene,
      "deerHead",
      [v(0, 1.4, 0.62), v(0, 1.37, 0.72), v(0, 1.29, 0.88), v(0, 1.24, 0.97)],
      (t) => piecewise(t, [0.055, 0.07, 0.045, 0.03]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(head, 0.85), ["head"], 3, headColor);

    const tail = tube(
      scene,
      "deerTail",
      [bone("tail").head, bone("tail").tail],
      (t) => piecewise(t, [0.035, 0.028, 0.012]),
      5,
      FUR_TILE,
      2,
    );
    add(tail, ["tail"], 4, light);

    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const earBone = bone(`ear${side}`);
      add(ear(scene, `deerEar${side}`, earBone.head, earBone.tail, 0.07, 0.015), [`ear${side}`], 5);
      add(blob(scene, `deerEye${side}`, v(0.047 * s, 1.37, 0.75), 0.025), ["head"], 0, dark);

      // The tops of the legs start inside the body, so shoulders and hips blend into it.
      const front = tube(
        scene,
        `deerFrontLeg${side}`,
        [
          v(0.07 * s, 0.92, 0.34),
          v(0.09 * s, bone(`upperArm${side}`).head.y, 0.37),
          bone(`forearm${side}`).head,
          bone(`frontCannon${side}`).head,
          bone(`frontHoof${side}`).head,
          bone(`frontHoof${side}`).tail,
        ],
        (t) => piecewise(t, [0.075, 0.07, 0.045, 0.026, 0.025, 0.029]),
        6,
        FUR_TILE,
        2,
      );
      add(
        front,
        ["chest", `upperArm${side}`, `forearm${side}`, `frontCannon${side}`, `frontHoof${side}`],
        6,
        legColor,
      );

      const hind = tube(
        scene,
        `deerHindLeg${side}`,
        [
          v(0.07 * s, 0.97, -0.5),
          v(0.09 * s, bone(`thigh${side}`).head.y, -0.45),
          bone(`shin${side}`).head,
          bone(`hindCannon${side}`).head,
          bone(`hindHoof${side}`).head,
          bone(`hindHoof${side}`).tail,
        ],
        (t) => piecewise(t, [0.1, 0.095, 0.06, 0.032, 0.027, 0.031]),
        6,
        FUR_TILE,
        2,
      );
      add(
        hind,
        ["pelvis", `thigh${side}`, `shin${side}`, `hindCannon${side}`, `hindHoof${side}`],
        7,
        legColor,
      );
    }

    const body = assemble("deerBody", parts, getFurMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    // The skin moves away from the rest pose: keep it drawn instead of trusting the rest bounds.
    body.alwaysSelectAsActiveMesh = true;

    return { root, animations: buildDeerAnimations(scene, nodes) };
  },
};

/**
 * Sign conventions (rotation about X): +x tips the neck and head forward and down; for bones
 * pointing down (legs), −x swings them forward and +x backward. Ears: +z on the left ear and −z
 * on the right one raise them.
 */
const EARS_UP: Pose = { earL: [0, 0, 0.45], earR: [0, 0, -0.45] };

/** Head down to the grass, nibbling, ears relaxed (2 s per cycle). */
function grazeKeys(): Key[] {
  const down: Pose = { spine: [0.05, 0, 0], neck: [1.95, 0, 0], head: [0.45, 0, 0] };
  return [
    { frame: 0, pose: blend(down, { head: [0.08, 0, 0] }) },
    { frame: 15, pose: blend(down, { head: [-0.06, 0, 0], earL: [0, 0, 0.2] }) },
    { frame: 30, pose: blend(down, { head: [0.08, 0, 0] }) },
    { frame: 45, pose: blend(down, { head: [-0.06, 0, 0], earR: [0, 0, -0.2] }) },
    { frame: 60, pose: blend(down, { head: [0.08, 0, 0] }) },
  ];
}

/** Head high, ears up, frozen, slowly looking to one side and the other (2 s per cycle). */
function alertKeys(): Key[] {
  const up: Pose = blend(EARS_UP, { neck: [-0.3, 0, 0], head: [-0.15, 0, 0], tail: [-0.5, 0, 0] });
  return [
    { frame: 0, pose: blend(up, { neck: [0, 0.25, 0] }) },
    { frame: 30, pose: blend(up, { neck: [0, -0.25, 0] }) },
    { frame: 60, pose: blend(up, { neck: [0, 0.25, 0] }) },
  ];
}

/** A bounding gallop: legs stretched out, then gathered under the body (0.6 s per cycle). */
function runKeys(): Key[] {
  const stretched: Pose = blend(EARS_UP, {
    neck: [0.35, 0, 0],
    upperArmL: [-0.75, 0, 0],
    upperArmR: [-0.65, 0, 0],
    forearmL: [-0.25, 0, 0],
    forearmR: [-0.25, 0, 0],
    thighL: [0.65, 0, 0],
    thighR: [0.55, 0, 0],
    shinL: [0.3, 0, 0],
    shinR: [0.3, 0, 0],
    tail: [-0.6, 0, 0],
  });
  const gathered: Pose = blend(EARS_UP, {
    neck: [0.1, 0, 0],
    spine: [-0.08, 0, 0],
    upperArmL: [0.55, 0, 0],
    upperArmR: [0.45, 0, 0],
    forearmL: [0.6, 0, 0],
    forearmR: [0.5, 0, 0],
    frontCannonL: [0.9, 0, 0],
    frontCannonR: [0.8, 0, 0],
    thighL: [-0.7, 0, 0],
    thighR: [-0.6, 0, 0],
    shinL: [-0.35, 0, 0],
    shinR: [-0.3, 0, 0],
    hindCannonL: [0.5, 0, 0],
    hindCannonR: [0.45, 0, 0],
    tail: [-0.6, 0, 0],
  });
  return [
    { frame: 0, pose: stretched, hipDrop: 0.12 },
    { frame: 9, pose: gathered, hipDrop: -0.05 },
    { frame: 18, pose: stretched, hipDrop: 0.12 },
  ];
}

/** Legs give way and the body rolls onto its side (0.8 s; the game plays it once). */
function dieKeys(): Key[] {
  const buckled: Pose = {
    neck: [0.6, 0, 0],
    upperArmL: [0.3, 0, 0],
    upperArmR: [0.3, 0, 0],
    forearmL: [1.2, 0, 0],
    forearmR: [1.2, 0, 0],
    thighL: [-0.6, 0, 0],
    thighR: [-0.6, 0, 0],
    hindCannonL: [0.9, 0, 0],
    hindCannonR: [0.9, 0, 0],
  };
  const lying: Pose = {
    pelvis: [0, 0, 1.5],
    neck: [0.9, 0.2, 0],
    head: [0.3, 0, 0],
    upperArmL: [-0.35, 0, 0.15],
    upperArmR: [-0.2, 0, -0.1],
    forearmL: [0.25, 0, 0],
    thighL: [0.2, 0, 0.15],
    thighR: [0.35, 0, -0.1],
    shinL: [0.2, 0, 0],
    earL: [0, 0, -0.3],
    earR: [0, 0, 0.3],
  };
  return [
    { frame: 0, pose: {} },
    { frame: 10, pose: buckled, hipDrop: -0.35 },
    { frame: 24, pose: lying, hips: [0.12, -0.62, 0] },
    { frame: 40, pose: lying, hips: [0.12, -0.62, 0] },
  ];
}

function buildDeerAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  const clips: [string, Key[]][] = [
    ["Pastar", grazeKeys()],
    ["Alerta", alertKeys()],
    ["Correr", runKeys()],
    ["Morrer", dieKeys()],
  ];
  return buildPoseAnimations(scene, nodes, clips, "pelvis", ["Morrer"]);
}
