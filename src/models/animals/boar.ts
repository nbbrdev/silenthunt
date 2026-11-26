import { type Color3, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, paint, toColor } from "../lowPoly";
import { blend, buildPoseAnimations, type Key, type Pose } from "../rig/poses";
import { buildSkeleton } from "../rig/skeleton";
import { boneLookup, piecewise, skinTo, tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";
import { blob, ear, getFurMaterial, narrow } from "./parts";
import {
  collapseKeys,
  gallopKeys,
  quadrupedBones,
  stretched,
  walkKeys,
  type Stretch,
} from "./quadruped";

/** The fox stretched to a boar: ~0.75 m at the shoulder, ~1.4 m from snout to rump. */
const STRETCH: Stretch = [2.4, 1.8, 2];
const GROW = 2.2;
const FUR_TILE = CONFIG.surfaces.furTileMeters;
const f = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * NBB-167 (AH7-A): the wild boar: a heavy barrel of a body, higher at the shoulders, with a black
 * bristly mane along the back; a long wedge of a head carried low, ending in a flat snout with
 * two short tusks; small pointed ears, short legs and a thin tail.
 */
export const boar: ModelGenerator = {
  id: "boar",
  label: "Javali",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("boar", scene);
    const defs = quadrupedBones(STRETCH, {
      neck: { head: f(0, 0.38, 0.2), tail: f(0, 0.37, 0.26) },
      head: { head: f(0, 0.37, 0.26), tail: f(0, 0.27, 0.42) },
      earL: { head: f(0.04, 0.41, 0.27), tail: f(0.06, 0.46, 0.25) },
      earR: { head: f(-0.04, 0.41, 0.27), tail: f(-0.06, 0.46, 0.25) },
      tail: { head: f(0, 0.39, -0.3), tail: f(0, 0.3, -0.36) },
    });
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, "boar", defs, root);
    const { bone, skinBone } = boneLookup(defs, indexOf);
    const p = stretched(STRETCH);
    const r = (values: number[]) => (t: number) => piecewise(t, values) * GROW;
    const palette = CONFIG.palette;
    const fur = toColor(palette.boarFur);
    const mane = toColor(palette.boarMane);
    const snout = toColor(palette.boarSnout);
    const tusk = toColor(palette.bone);
    const dark = toColor(palette.animalDark);
    const parts: Mesh[] = [];
    const fy = (y: number) => y / STRETCH[1];
    const fz = (z: number) => z / STRETCH[2];

    const bodyColor = (_x: number, y: number, z: number): Color3 => {
      if (fy(y) > 0.45 && fz(z) > -0.2) return mane;
      if (fy(y) < 0.29) return fur.scale(1.15);
      return fur;
    };
    const legColor = (_x: number, y: number): Color3 => (fy(y) < 0.05 ? dark : fur.scale(0.8));
    const headColor = (_x: number, y: number, z: number): Color3 => {
      if (fz(z) > 0.425) return snout;
      if (fy(y) > 0.41) return mane;
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

    // The barrel of a body, deepest at the shoulders.
    const torso = tube(
      scene,
      "boarTorso",
      // (starting just behind the rump, thin, so the rump is rounded)
      [p(0, 0.35, -0.33), p(0, 0.37, -0.28), p(0, 0.36, -0.12), p(0, 0.37, 0.05), p(0, 0.38, 0.2)],
      r([0.04, 0.1, 0.12, 0.13, 0.135]),
      9,
      FUR_TILE,
    );
    add(narrow(torso, 0.8), ["pelvis", "spine", "chest"], 1, bodyColor);

    // A short, thick neck into the head.
    const neck = tube(
      scene,
      "boarNeck",
      [p(0, 0.37, 0.15), bone("neck").head, bone("head").head],
      r([0.11, 0.1, 0.085]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(neck, 0.85), ["chest", "neck", "head"], 2, bodyColor);

    // The long wedge of the head, sloping down to the snout.
    const head = tube(
      scene,
      "boarHead",
      [p(0, 0.39, 0.24), p(0, 0.36, 0.31), p(0, 0.31, 0.38), p(0, 0.275, 0.44)],
      r([0.08, 0.065, 0.04, 0.03]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(head, 0.85), ["head"], 3, headColor);
    add(blob(scene, "boarSnout", p(0, 0.272, 0.447), 0.13), ["head"], 0, snout);

    // The thin tail with a tuft.
    const tail = tube(
      scene,
      "boarTail",
      [bone("tail").head, p(0, 0.35, -0.33), bone("tail").tail],
      r([0.01, 0.008, 0.013]),
      5,
      FUR_TILE,
      2,
    );
    add(tail, ["tail"], 4, mane);

    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const earBone = bone(`ear${side}`);
      add(
        ear(scene, `boarEar${side}`, earBone.head, earBone.tail, 0.08, 0.02),
        [`ear${side}`],
        5,
        mane,
      );
      add(blob(scene, `boarEye${side}`, p(0.035 * s, 0.37, 0.32), 0.03), ["head"], 0, dark);
      // A short tusk curving up beside the snout.
      const tooth = tube(
        scene,
        `boarTusk${side}`,
        [p(0.03 * s, 0.28, 0.41), p(0.042 * s, 0.295, 0.425), p(0.045 * s, 0.315, 0.43)],
        (t) => piecewise(t, [0.014, 0.01, 0.003]),
        4,
        FUR_TILE,
        1,
      );
      add(tooth, ["head"], 8, tusk);

      const front = tube(
        scene,
        `boarFrontLeg${side}`,
        [
          p(0.045 * s, 0.35, 0.16),
          bone(`upperArm${side}`).head,
          bone(`forearm${side}`).head,
          bone(`frontCannon${side}`).head,
          bone(`frontHoof${side}`).head,
          bone(`frontHoof${side}`).tail,
        ],
        r([0.055, 0.048, 0.028, 0.02, 0.02, 0.021]),
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
        `boarHindLeg${side}`,
        [
          p(0.05 * s, 0.37, -0.22),
          bone(`thigh${side}`).head,
          bone(`shin${side}`).head,
          bone(`hindCannon${side}`).head,
          bone(`hindHoof${side}`).head,
          bone(`hindHoof${side}`).tail,
        ],
        r([0.07, 0.058, 0.032, 0.02, 0.02, 0.021]),
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

    const body = assemble("boarBody", parts, getFurMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    body.alwaysSelectAsActiveMesh = true;

    return { root, animations: buildBoarAnimations(scene, nodes) };
  },
};

/** Snout in the earth, rooting about (2 s per cycle). */
function rootKeys(): Key[] {
  const down: Pose = { neck: [0.55, 0, 0], head: [0.25, 0, 0] };
  return [
    { frame: 0, pose: blend(down, { head: [0.12, 0.12, 0] }) },
    { frame: 15, pose: blend(down, { head: [-0.05, -0.1, 0] }) },
    { frame: 30, pose: blend(down, { head: [0.12, 0.12, 0] }) },
    { frame: 45, pose: blend(down, { head: [-0.05, -0.1, 0] }) },
    { frame: 60, pose: blend(down, { head: [0.12, 0.12, 0] }) },
  ];
}

/** Head low, a front hoof scraping the ground twice (1.2 s per cycle). */
function digKeys(): Key[] {
  const low: Pose = { neck: [0.4, 0, 0], head: [0.15, 0, 0], tail: [-0.6, 0, 0] };
  const forward = blend(low, { upperArmL: [-0.45, 0, 0], forearmL: [0.5, 0, 0] });
  const back = blend(low, { upperArmL: [0.45, 0, 0], forearmL: [0.2, 0, 0] });
  return [
    { frame: 0, pose: forward },
    { frame: 9, pose: back },
    { frame: 18, pose: forward },
    { frame: 27, pose: back },
    { frame: 36, pose: forward },
  ];
}

function buildBoarAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  const clips: [string, Key[]][] = [
    ["Pastar", rootKeys()],
    ["Andar", walkKeys(24)],
    ["Cavar", digKeys()],
    // The charge: a gallop with the head down, tusks first.
    ["Investir", gallopKeys(10, { neck: [0.35, 0, 0], head: [0.15, 0, 0] }, 0.05)],
    ["Morrer", collapseKeys(0.45)],
  ];
  return buildPoseAnimations(scene, nodes, clips, "pelvis", ["Morrer"]);
}
