import { Color3, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
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

/** The fox stretched to a brown bear: ~1 m at the shoulder hump, ~1.8 m from nose to rump. */
const STRETCH: Stretch = [2.8, 2.3, 2.5];
const GROW = 2.7;
const FUR_TILE = CONFIG.surfaces.furTileMeters;
const f = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * NBB-167 (AH7-A): the brown bear: massive and round, a hump over the shoulders, thick legs, a
 * broad head with small round ears and a paler muzzle, a stub of a tail.
 */
export const bear: ModelGenerator = {
  id: "bear",
  label: "Urso",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("bear", scene);
    const defs = quadrupedBones(STRETCH, {
      neck: { head: f(0, 0.38, 0.2), tail: f(0, 0.43, 0.27) },
      head: { head: f(0, 0.43, 0.27), tail: f(0, 0.4, 0.45) },
      earL: { head: f(0.04, 0.48, 0.29), tail: f(0.05, 0.52, 0.28) },
      earR: { head: f(-0.04, 0.48, 0.29), tail: f(-0.05, 0.52, 0.28) },
      tail: { head: f(0, 0.36, -0.3), tail: f(0, 0.33, -0.34) },
    });
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, "bear", defs, root);
    const { bone, skinBone } = boneLookup(defs, indexOf);
    const p = stretched(STRETCH);
    const r = (values: number[]) => (t: number) => piecewise(t, values) * GROW;
    const palette = CONFIG.palette;
    const fur = toColor(palette.bearFur);
    const light = toColor(palette.bearLight);
    const dark = toColor(palette.animalDark);
    const parts: Mesh[] = [];
    const fy = (y: number) => y / STRETCH[1];
    const fz = (z: number) => z / STRETCH[2];

    // The hump a little grizzled, the belly darker.
    const bodyColor = (_x: number, y: number, z: number): Color3 => {
      if (fy(y) > 0.47 && fz(z) > -0.05) return Color3.Lerp(fur, light, 0.35);
      if (fy(y) < 0.3) return fur.scale(0.8);
      return fur;
    };
    const legColor = (): Color3 => fur.scale(0.7);
    const headColor = (_x: number, _y: number, z: number): Color3 => (fz(z) > 0.37 ? light : fur);
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

    // A heavy body rising to the hump over the shoulders.
    const torso = tube(
      scene,
      "bearTorso",
      // (starting just behind the rump, thin, so the rump is rounded)
      [p(0, 0.36, -0.33), p(0, 0.37, -0.28), p(0, 0.37, -0.12), p(0, 0.39, 0.05), p(0, 0.4, 0.18)],
      r([0.05, 0.12, 0.13, 0.14, 0.13]),
      9,
      FUR_TILE,
    );
    add(narrow(torso, 0.85), ["pelvis", "spine", "chest"], 1, bodyColor);

    const neck = tube(
      scene,
      "bearNeck",
      [p(0, 0.38, 0.15), bone("neck").head, bone("head").head],
      r([0.1, 0.09, 0.075]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(neck, 0.9), ["chest", "neck", "head"], 2, bodyColor);

    // A broad, round head and a short muzzle.
    const head = tube(
      scene,
      "bearHead",
      [p(0, 0.45, 0.25), p(0, 0.45, 0.31), p(0, 0.42, 0.38), p(0, 0.4, 0.44)],
      r([0.075, 0.07, 0.04, 0.03]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(head, 0.95), ["head"], 3, headColor);
    add(blob(scene, "bearNose", p(0, 0.402, 0.447), 0.09), ["head"], 0, dark);

    const tail = tube(
      scene,
      "bearTail",
      [bone("tail").head, bone("tail").tail],
      r([0.02, 0.012]),
      5,
      FUR_TILE,
      2,
    );
    add(tail, ["tail"], 4, fur);

    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const earBone = bone(`ear${side}`);
      add(
        ear(scene, `bearEar${side}`, earBone.head, earBone.tail, 0.16, 0.04),
        [`ear${side}`],
        5,
        fur,
      );
      add(blob(scene, `bearEye${side}`, p(0.03 * s, 0.46, 0.33), 0.045), ["head"], 0, dark);

      const front = tube(
        scene,
        `bearFrontLeg${side}`,
        [
          p(0.045 * s, 0.37, 0.16),
          bone(`upperArm${side}`).head,
          bone(`forearm${side}`).head,
          bone(`frontCannon${side}`).head,
          bone(`frontHoof${side}`).head,
          bone(`frontHoof${side}`).tail,
        ],
        r([0.07, 0.065, 0.05, 0.042, 0.04, 0.042]),
        7,
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
        `bearHindLeg${side}`,
        [
          p(0.05 * s, 0.37, -0.22),
          bone(`thigh${side}`).head,
          bone(`shin${side}`).head,
          bone(`hindCannon${side}`).head,
          bone(`hindHoof${side}`).head,
          bone(`hindHoof${side}`).tail,
        ],
        r([0.08, 0.07, 0.05, 0.04, 0.04, 0.042]),
        7,
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

    const body = assemble("bearBody", parts, getFurMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    body.alwaysSelectAsActiveMesh = true;

    return { root, animations: buildBearAnimations(scene, nodes) };
  },
};

/** Nose down, sniffing along the ground (2.5 s per cycle). */
function sniffKeys(): Key[] {
  const down: Pose = { neck: [0.55, 0, 0], head: [0.2, 0, 0] };
  return [
    { frame: 0, pose: blend(down, { neck: [0, 0.15, 0] }) },
    { frame: 38, pose: blend(down, { neck: [0, -0.15, 0] }) },
    { frame: 75, pose: blend(down, { neck: [0, 0.15, 0] }) },
  ];
}

/** Up on its hind legs, front paws hanging, roaring with the head shaking (2.2 s). */
function roarKeys(): Key[] {
  const up: Pose = {
    pelvis: [-1.05, 0, 0],
    thighL: [1.05, 0, 0],
    thighR: [1.05, 0, 0],
    upperArmL: [-0.5, 0, 0.25],
    upperArmR: [-0.5, 0, -0.25],
    forearmL: [0.7, 0, 0],
    forearmR: [0.7, 0, 0],
    neck: [-0.15, 0, 0],
    head: [-0.25, 0, 0],
  };
  return [
    { frame: 0, pose: {} },
    { frame: 18, pose: up, hips: [0, 0.05, -0.15] },
    { frame: 26, pose: blend(up, { head: [-0.15, 0.15, 0] }), hips: [0, 0.05, -0.15] },
    { frame: 34, pose: blend(up, { head: [-0.15, -0.15, 0] }), hips: [0, 0.05, -0.15] },
    { frame: 46, pose: up, hips: [0, 0.05, -0.15] },
    { frame: 66, pose: {} },
  ];
}

/** Weight back, the right paw raised high, then swung down across (0.7 s). */
function swipeKeys(): Key[] {
  const raised: Pose = {
    pelvis: [-0.25, 0, 0],
    thighL: [0.25, 0, 0],
    thighR: [0.25, 0, 0],
    upperArmR: [-1.4, 0, -0.3],
    forearmR: [0.7, 0, 0],
    neck: [-0.1, -0.15, 0],
  };
  const swung: Pose = {
    pelvis: [-0.05, 0, 0],
    upperArmR: [0.4, 0, 0.25],
    forearmR: [0.2, 0, 0],
    neck: [0.15, 0.15, 0],
  };
  return [
    { frame: 0, pose: {} },
    { frame: 8, pose: raised, hips: [0, 0.03, -0.08] },
    { frame: 13, pose: swung, hips: [0, 0, 0.12] },
    { frame: 21, pose: {} },
  ];
}

function buildBearAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  const clips: [string, Key[]][] = [
    ["Pastar", sniffKeys()],
    ["Andar", walkKeys(36)],
    ["Correr", gallopKeys(14, {}, 0.07)],
    ["Rugir", roarKeys()],
    ["Patada", swipeKeys()],
    ["Morrer", collapseKeys(0.75)],
  ];
  return buildPoseAnimations(scene, nodes, clips, "pelvis", ["Morrer"]);
}
