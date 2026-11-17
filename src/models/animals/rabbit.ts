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
 * The rabbit's skeleton in its rest pose, crouched on all fours (meters, facing +Z). CO2: about
 * 40 cm long. The long hind feet lie flat on the ground, heel at the back.
 */
function rabbitBones(): BoneDef[] {
  const bones: BoneDef[] = [
    { name: "root", parent: null, head: v(0, 0, 0), tail: v(0, 0.05, 0) },
    { name: "pelvis", parent: "root", head: v(0, 0.13, -0.08), tail: v(0, 0.14, 0.02) },
    { name: "spine", parent: "pelvis", head: v(0, 0.14, 0.02), tail: v(0, 0.15, 0.09) },
    { name: "chest", parent: "spine", head: v(0, 0.15, 0.09), tail: v(0, 0.17, 0.13) },
    { name: "head", parent: "chest", head: v(0, 0.2, 0.13), tail: v(0, 0.18, 0.22) },
    { name: "tail", parent: "pelvis", head: v(0, 0.15, -0.16), tail: v(0, 0.16, -0.19) },
  ];
  for (const [side, s] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    bones.push(
      {
        name: `ear${side}`,
        parent: "head",
        head: v(0.02 * s, 0.25, 0.14),
        tail: v(0.04 * s, 0.37, 0.1),
      },
      {
        name: `upperArm${side}`,
        parent: "chest",
        head: v(0.04 * s, 0.12, 0.1),
        tail: v(0.04 * s, 0.06, 0.11),
      },
      {
        name: `forearm${side}`,
        parent: `upperArm${side}`,
        head: v(0.04 * s, 0.06, 0.11),
        tail: v(0.04 * s, 0.015, 0.12),
      },
      {
        name: `frontPaw${side}`,
        parent: `forearm${side}`,
        head: v(0.04 * s, 0.015, 0.12),
        tail: v(0.04 * s, 0.006, 0.15),
      },
      {
        name: `thigh${side}`,
        parent: "pelvis",
        head: v(0.06 * s, 0.13, -0.08),
        tail: v(0.07 * s, 0.07, -0.01),
      },
      {
        name: `shin${side}`,
        parent: `thigh${side}`,
        head: v(0.07 * s, 0.07, -0.01),
        tail: v(0.07 * s, 0.025, -0.12),
      },
      {
        name: `hindFoot${side}`,
        parent: `shin${side}`,
        head: v(0.07 * s, 0.025, -0.12),
        tail: v(0.07 * s, 0.008, -0.01),
      },
    );
  }
  return bones;
}

const FUR_TILE = CONFIG.surfaces.furTileMeters * 0.4;

/**
 * The rabbit (NBB-137, M6-B): a wild gray-brown rabbit with a light belly and a white tail (CO4),
 * long ears and big hind feet, from the user's references (CO1). One skinned mesh on a 20-bone
 * skeleton (A5-B).
 */
export const rabbit: ModelGenerator = {
  id: "rabbit",
  label: "Coelho",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("rabbit", scene);
    const defs = rabbitBones();
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, "rabbit", defs, root);
    const { bone, skinBone } = boneLookup(defs, indexOf);
    const fur = toColor(CONFIG.palette.rabbitFur);
    const light = toColor(CONFIG.palette.rabbitLight);
    const dark = toColor(CONFIG.palette.animalDark);
    const parts: Mesh[] = [];

    // Light belly and chin, slightly lighter feet, darker ear tips.
    const colorAt = (_x: number, y: number, z: number): Color3 => {
      if (y < 0.035) return Color3.Lerp(fur, light, 0.35);
      if (y < 0.08 && z > -0.12) return Color3.Lerp(fur, light, 0.55);
      if (y > 0.34) return fur.scale(0.7);
      return fur;
    };
    const add = (mesh: Mesh, bones: string[], seedOffset: number, color = colorAt) => {
      skinTo(mesh, bones.map(skinBone));
      paint(mesh, color, seed + seedOffset);
      parts.push(mesh);
    };

    // --- Body: a big round rump narrowing to the chest.
    const torso = tube(
      scene,
      "rabbitTorso",
      [
        v(0, 0.12, -0.17),
        bone("pelvis").head,
        bone("spine").head,
        bone("chest").head,
        v(0, 0.17, 0.13),
      ],
      (t) => piecewise(t, [0.045, 0.095, 0.08, 0.06, 0.05]),
      8,
      FUR_TILE,
      2,
    );
    add(narrow(torso, 0.9), ["pelvis", "spine", "chest"], 1);

    const head = tube(
      scene,
      "rabbitHead",
      [v(0, 0.2, 0.1), v(0, 0.21, 0.14), v(0, 0.195, 0.19), v(0, 0.18, 0.225)],
      (t) => piecewise(t, [0.04, 0.05, 0.04, 0.02]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(head, 0.85), ["chest", "head"], 2);

    // White cotton tail (CO4).
    add(blob(scene, "rabbitTail", v(0, 0.16, -0.175), 0.05, 4), ["tail"], 3, () => light);

    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const earBone = bone(`ear${side}`);
      add(
        ear(scene, `rabbitEar${side}`, earBone.head, earBone.tail, 0.045, 0.012),
        [`ear${side}`],
        4,
      );
      add(
        blob(scene, `rabbitEye${side}`, v(0.033 * s, 0.215, 0.175), 0.018),
        ["head"],
        5,
        () => dark,
      );

      const front = tube(
        scene,
        `rabbitFrontLeg${side}`,
        [
          v(0.035 * s, 0.14, 0.09),
          bone(`upperArm${side}`).head,
          bone(`forearm${side}`).head,
          bone(`frontPaw${side}`).head,
          bone(`frontPaw${side}`).tail,
        ],
        (t) => piecewise(t, [0.025, 0.018, 0.014, 0.013, 0.012]),
        5,
        FUR_TILE,
        2,
      );
      add(front, ["chest", `upperArm${side}`, `forearm${side}`, `frontPaw${side}`], 6);

      const hind = tube(
        scene,
        `rabbitHindLeg${side}`,
        [
          v(0.05 * s, 0.14, -0.07),
          bone(`thigh${side}`).head,
          bone(`shin${side}`).head,
          bone(`hindFoot${side}`).head,
          bone(`hindFoot${side}`).tail,
        ],
        (t) => piecewise(t, [0.05, 0.048, 0.03, 0.018, 0.016]),
        6,
        FUR_TILE,
        2,
      );
      add(hind, ["pelvis", `thigh${side}`, `shin${side}`, `hindFoot${side}`], 7);
    }

    const body = assemble("rabbitBody", parts, getFurMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    body.alwaysSelectAsActiveMesh = true;

    return { root, animations: buildRabbitAnimations(scene, nodes) };
  },
};

/**
 * Sign conventions (rotation about X): +x tips the spine, chest and head forward and down; for
 * bones pointing down (legs), −x swings them forward and +x backward. Ears (pointing up): −x
 * lays them back, +x tips them forward. Ears follow the head, so a pose that tilts the body or
 * the head has to make up for it to keep them upright.
 */

/** Nose to the ground, nibbling, ears laid back (1.5 s per cycle). */
function grazeKeys(): Key[] {
  const down: Pose = {
    chest: [0.35, 0, 0],
    head: [0.45, 0, 0],
    earL: [-0.6, 0, 0.1],
    earR: [-0.6, 0, -0.1],
    upperArmL: [-0.2, 0, 0],
    upperArmR: [-0.2, 0, 0],
  };
  return [
    { frame: 0, pose: down },
    { frame: 6, pose: blend(down, { head: [0.1, 0, 0] }) },
    { frame: 12, pose: down },
    { frame: 18, pose: blend(down, { head: [0.1, 0, 0] }) },
    { frame: 45, pose: blend(down, { earL: [0.4, 0, 0] }) },
  ];
}

/** Sits up tall on the hind legs, ears straight up, perfectly still (1 s, held). */
function alertKeys(): Key[] {
  const up: Pose = {
    pelvis: [-0.55, 0, 0],
    chest: [-0.1, 0, 0],
    head: [0.45, 0, 0],
    // The body leans back by 0.2 in total: the ears make up for it and stand straight up.
    earL: [0.35, 0, 0.05],
    earR: [0.35, 0, -0.05],
    upperArmL: [0.4, 0, 0],
    upperArmR: [0.4, 0, 0],
    forearmL: [-0.6, 0, 0],
    forearmR: [-0.6, 0, 0],
    thighL: [0.5, 0, 0],
    thighR: [0.5, 0, 0],
  };
  return [
    { frame: 0, pose: up, hipDrop: 0.01 },
    { frame: 20, pose: blend(up, { head: [0, 0.2, 0] }), hipDrop: 0.01 },
    { frame: 40, pose: up, hipDrop: 0.01 },
  ];
}

/** Hops: gathered, a push of the big hind legs, front paws reaching out (0.4 s per hop). */
function runKeys(): Key[] {
  const ears: Pose = { earL: [-0.7, 0, 0], earR: [-0.7, 0, 0] };
  const gathered: Pose = blend(ears, {
    upperArmL: [0.4, 0, 0],
    upperArmR: [0.4, 0, 0],
    thighL: [-0.3, 0, 0],
    thighR: [-0.3, 0, 0],
  });
  const pushing: Pose = blend(ears, {
    pelvis: [0.25, 0, 0],
    chest: [-0.2, 0, 0],
    upperArmL: [-0.9, 0, 0],
    upperArmR: [-0.8, 0, 0],
    thighL: [1.1, 0, 0],
    thighR: [1.0, 0, 0],
    shinL: [-0.6, 0, 0],
    shinR: [-0.6, 0, 0],
    hindFootL: [0.6, 0, 0],
    hindFootR: [0.6, 0, 0],
  });
  const landing: Pose = blend(ears, {
    pelvis: [-0.15, 0, 0],
    chest: [0.15, 0, 0],
    upperArmL: [-0.3, 0, 0],
    upperArmR: [-0.3, 0, 0],
    thighL: [0.5, 0, 0],
    thighR: [0.5, 0, 0],
  });
  return [
    { frame: 0, pose: gathered },
    { frame: 4, pose: pushing, hipDrop: 0.06 },
    { frame: 8, pose: landing, hipDrop: 0.03 },
    { frame: 12, pose: gathered },
  ];
}

/** Rolls onto its side, legs limp (0.6 s; the game plays it once). */
function dieKeys(): Key[] {
  const lying: Pose = {
    pelvis: [0, 0, 1.5],
    head: [0.3, 0, 0],
    earL: [-0.8, 0, 0],
    earR: [-0.8, 0, 0],
    upperArmL: [-0.5, 0, 0],
    upperArmR: [-0.3, 0, 0],
    thighL: [0.7, 0, 0],
    thighR: [0.5, 0, 0],
  };
  return [
    { frame: 0, pose: {} },
    { frame: 18, pose: lying, hips: [0.05, -0.06, 0] },
    { frame: 30, pose: lying, hips: [0.05, -0.06, 0] },
  ];
}

function buildRabbitAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  const clips: [string, Key[]][] = [
    ["Pastar", grazeKeys()],
    ["Alerta", alertKeys()],
    ["Correr", runKeys()],
    ["Morrer", dieKeys()],
  ];
  return buildPoseAnimations(scene, nodes, clips, "pelvis");
}
