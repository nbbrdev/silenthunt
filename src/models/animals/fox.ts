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
 * NBB-166 (AV7-A): the fox's skeleton in its rest pose (meters, facing +Z, paws on the ground):
 * about 0.38 m at the shoulder and 0.7 m from nose to rump, the long tail behind. The same bone
 * names as the deer's, so its poses read alike. NBB-167: the hostile animals are built on it,
 * scaled (see quadruped.ts).
 */
export function foxBones(): BoneDef[] {
  const bones: BoneDef[] = [
    { name: "root", parent: null, head: v(0, 0, 0), tail: v(0, 0.05, 0) },
    { name: "pelvis", parent: "root", head: v(0, 0.36, -0.22), tail: v(0, 0.35, -0.05) },
    { name: "spine", parent: "pelvis", head: v(0, 0.35, -0.05), tail: v(0, 0.36, 0.12) },
    { name: "chest", parent: "spine", head: v(0, 0.36, 0.12), tail: v(0, 0.38, 0.2) },
    { name: "neck", parent: "chest", head: v(0, 0.38, 0.2), tail: v(0, 0.46, 0.29) },
    { name: "head", parent: "neck", head: v(0, 0.46, 0.29), tail: v(0, 0.41, 0.45) },
    { name: "tail", parent: "pelvis", head: v(0, 0.37, -0.3), tail: v(0, 0.24, -0.66) },
  ];
  for (const [side, s] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    bones.push(
      {
        name: `ear${side}`,
        parent: "head",
        head: v(0.035 * s, 0.5, 0.3),
        tail: v(0.05 * s, 0.59, 0.29),
      },
      {
        name: `upperArm${side}`,
        parent: "chest",
        head: v(0.055 * s, 0.33, 0.17),
        tail: v(0.055 * s, 0.22, 0.15),
      },
      {
        name: `forearm${side}`,
        parent: `upperArm${side}`,
        head: v(0.055 * s, 0.22, 0.15),
        tail: v(0.05 * s, 0.1, 0.17),
      },
      {
        name: `frontCannon${side}`,
        parent: `forearm${side}`,
        head: v(0.05 * s, 0.1, 0.17),
        tail: v(0.05 * s, 0.03, 0.17),
      },
      {
        name: `frontHoof${side}`,
        parent: `frontCannon${side}`,
        head: v(0.05 * s, 0.03, 0.17),
        tail: v(0.05 * s, 0, 0.2),
      },
      {
        name: `thigh${side}`,
        parent: "pelvis",
        head: v(0.06 * s, 0.34, -0.22),
        tail: v(0.065 * s, 0.22, -0.14),
      },
      {
        name: `shin${side}`,
        parent: `thigh${side}`,
        head: v(0.065 * s, 0.22, -0.14),
        tail: v(0.055 * s, 0.12, -0.27),
      },
      {
        name: `hindCannon${side}`,
        parent: `shin${side}`,
        head: v(0.055 * s, 0.12, -0.27),
        tail: v(0.05 * s, 0.03, -0.24),
      },
      {
        name: `hindHoof${side}`,
        parent: `hindCannon${side}`,
        head: v(0.05 * s, 0.03, -0.24),
        tail: v(0.05 * s, 0, -0.2),
      },
    );
  }
  return bones;
}

const FUR_TILE = CONFIG.surfaces.furTileMeters * 0.5;

/**
 * NBB-166 (AV1-A, AV7-A): the red fox: slim, red-orange, a white chest and throat, dark socks and
 * ear backs, a long bushy tail with a white tip. One skinned mesh on the deer's kind of skeleton.
 */
export const fox: ModelGenerator = {
  id: "fox",
  label: "Raposa",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("fox", scene);
    const defs = foxBones();
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, "fox", defs, root);
    const { bone, skinBone } = boneLookup(defs, indexOf);
    const palette = CONFIG.palette;
    const fur = toColor(palette.foxFur);
    const light = toColor(palette.foxLight);
    const dark = toColor(palette.animalDark);
    const parts: Mesh[] = [];

    // White chest and belly, red back.
    const bodyColor = (_x: number, y: number, z: number): Color3 => {
      if (y < 0.31 && z > 0.05) return light;
      if (y < 0.29) return Color3.Lerp(fur, light, 0.5);
      return fur;
    };
    // Dark "socks" on the lower legs.
    const legColor = (_x: number, y: number): Color3 => (y < 0.14 ? dark.scale(2) : fur);
    // A white throat and lower jaw, a dark nose tip.
    const headColor = (_x: number, y: number, z: number): Color3 => {
      if (z > 0.44) return dark;
      if (y < 0.42) return light;
      return fur;
    };
    // The tail: red, the last fifth white.
    const tailColor = (_x: number, _y: number, z: number): Color3 => (z < -0.58 ? light : fur);
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

    const torso = tube(
      scene,
      "foxTorso",
      [v(0, 0.37, -0.28), v(0, 0.35, -0.12), v(0, 0.35, 0.05), v(0, 0.36, 0.2)],
      (t) => piecewise(t, [0.07, 0.085, 0.08, 0.075]),
      9,
      FUR_TILE,
    );
    add(narrow(torso, 0.8), ["pelvis", "spine", "chest"], 1, bodyColor);

    const neck = tube(
      scene,
      "foxNeck",
      [v(0, 0.36, 0.16), bone("neck").head, bone("head").head],
      (t) => piecewise(t, [0.07, 0.06, 0.05]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(neck, 0.85), ["chest", "neck", "head"], 2, bodyColor);

    // The head narrows to a long, pointed snout.
    const head = tube(
      scene,
      "foxHead",
      [v(0, 0.47, 0.27), v(0, 0.46, 0.33), v(0, 0.43, 0.4), v(0, 0.415, 0.46)],
      (t) => piecewise(t, [0.04, 0.05, 0.025, 0.01]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(head, 0.9), ["head"], 3, headColor);

    // The long, bushy tail, thickest in the middle.
    const tail = tube(
      scene,
      "foxTail",
      [bone("tail").head, v(0, 0.33, -0.42), v(0, 0.28, -0.55), bone("tail").tail],
      (t) => piecewise(t, [0.03, 0.065, 0.06, 0.02]),
      7,
      FUR_TILE,
      2,
    );
    add(tail, ["tail"], 4, tailColor);

    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const earBone = bone(`ear${side}`);
      add(
        ear(scene, `foxEar${side}`, earBone.head, earBone.tail, 0.05, 0.012),
        [`ear${side}`],
        5,
        (_x, y) => (y > 0.56 ? dark.scale(2) : fur),
      );
      add(blob(scene, `foxEye${side}`, v(0.03 * s, 0.475, 0.36), 0.016), ["head"], 0, dark);

      const front = tube(
        scene,
        `foxFrontLeg${side}`,
        [
          v(0.045 * s, 0.35, 0.16),
          bone(`upperArm${side}`).head,
          bone(`forearm${side}`).head,
          bone(`frontCannon${side}`).head,
          bone(`frontHoof${side}`).head,
          bone(`frontHoof${side}`).tail,
        ],
        (t) => piecewise(t, [0.035, 0.032, 0.022, 0.016, 0.016, 0.017]),
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
        `foxHindLeg${side}`,
        [
          v(0.05 * s, 0.37, -0.22),
          bone(`thigh${side}`).head,
          bone(`shin${side}`).head,
          bone(`hindCannon${side}`).head,
          bone(`hindHoof${side}`).head,
          bone(`hindHoof${side}`).tail,
        ],
        (t) => piecewise(t, [0.05, 0.045, 0.028, 0.017, 0.016, 0.017]),
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

    const body = assemble("foxBody", parts, getFurMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    body.alwaysSelectAsActiveMesh = true;

    return { root, animations: buildFoxAnimations(scene, nodes) };
  },
};

/** Ears pricked forward (the left ear +z, the right one −z). */
const EARS_UP: Pose = { earL: [0, 0, 0.25], earR: [0, 0, -0.25] };

/** Nose to the ground, sniffing, the tail low and swaying (2 s per cycle). */
function sniffKeys(): Key[] {
  const down: Pose = { neck: [0.9, 0, 0], head: [0.3, 0, 0], tail: [0.15, 0, 0] };
  return [
    { frame: 0, pose: blend(down, { head: [0.38, 0.1, 0] }) },
    { frame: 15, pose: blend(down, { head: [0.25, -0.1, 0], tail: [0.15, 0.2, 0] }) },
    { frame: 30, pose: blend(down, { head: [0.38, 0.1, 0] }) },
    { frame: 45, pose: blend(down, { head: [0.25, -0.1, 0], tail: [0.15, -0.2, 0] }) },
    { frame: 60, pose: blend(down, { head: [0.38, 0.1, 0] }) },
  ];
}

/** Head up, ears pricked, frozen, glancing one way and the other (2 s per cycle). */
function alertKeys(): Key[] {
  const up: Pose = blend(EARS_UP, { neck: [-0.25, 0, 0], head: [-0.1, 0, 0], tail: [-0.2, 0, 0] });
  return [
    { frame: 0, pose: blend(up, { neck: [0, 0.3, 0] }) },
    { frame: 30, pose: blend(up, { neck: [0, -0.3, 0] }) },
    { frame: 60, pose: blend(up, { neck: [0, 0.3, 0] }) },
  ];
}

/** A low, stretched gallop, the tail streaming behind (0.45 s per cycle). */
function runKeys(): Key[] {
  const stretched: Pose = blend(EARS_UP, {
    neck: [0.25, 0, 0],
    upperArmL: [-0.8, 0, 0],
    upperArmR: [-0.7, 0, 0],
    forearmL: [-0.25, 0, 0],
    forearmR: [-0.25, 0, 0],
    thighL: [0.7, 0, 0],
    thighR: [0.6, 0, 0],
    shinL: [0.3, 0, 0],
    shinR: [0.3, 0, 0],
    tail: [-0.45, 0, 0],
  });
  const gathered: Pose = blend(EARS_UP, {
    neck: [0.1, 0, 0],
    spine: [-0.1, 0, 0],
    upperArmL: [0.55, 0, 0],
    upperArmR: [0.45, 0, 0],
    forearmL: [0.6, 0, 0],
    forearmR: [0.5, 0, 0],
    frontCannonL: [0.8, 0, 0],
    frontCannonR: [0.7, 0, 0],
    thighL: [-0.75, 0, 0],
    thighR: [-0.65, 0, 0],
    shinL: [-0.35, 0, 0],
    shinR: [-0.3, 0, 0],
    hindCannonL: [0.5, 0, 0],
    hindCannonR: [0.45, 0, 0],
    tail: [-0.35, 0, 0],
  });
  return [
    { frame: 0, pose: stretched, hipDrop: 0.04 },
    { frame: 7, pose: gathered, hipDrop: -0.02 },
    { frame: 14, pose: stretched, hipDrop: 0.04 },
  ];
}

/** Legs give way and it rolls onto its side (0.8 s; played once). */
function dieKeys(): Key[] {
  const buckled: Pose = {
    neck: [0.5, 0, 0],
    forearmL: [1.1, 0, 0],
    forearmR: [1.1, 0, 0],
    thighL: [-0.6, 0, 0],
    thighR: [-0.6, 0, 0],
    hindCannonL: [0.8, 0, 0],
    hindCannonR: [0.8, 0, 0],
  };
  const lying: Pose = {
    pelvis: [0, 0, 1.5],
    neck: [0.7, 0.2, 0],
    head: [0.3, 0, 0],
    upperArmL: [-0.35, 0, 0.15],
    upperArmR: [-0.2, 0, -0.1],
    thighL: [0.2, 0, 0.15],
    thighR: [0.35, 0, -0.1],
    tail: [0.2, 0.4, 0],
  };
  return [
    { frame: 0, pose: {} },
    { frame: 10, pose: buckled, hipDrop: -0.14 },
    { frame: 24, pose: lying, hips: [0.05, -0.25, 0] },
    { frame: 40, pose: lying, hips: [0.05, -0.25, 0] },
  ];
}

function buildFoxAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  // The same clip names as the other prey: the brain plays them by name.
  const clips: [string, Key[]][] = [
    ["Pastar", sniffKeys()],
    ["Alerta", alertKeys()],
    ["Correr", runKeys()],
    ["Morrer", dieKeys()],
  ];
  return buildPoseAnimations(scene, nodes, clips, "pelvis", ["Morrer"]);
}
