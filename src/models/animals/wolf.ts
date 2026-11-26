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

/** The fox stretched to a wolf: ~0.8 m at the shoulder, ~1.3 m from nose to rump. */
const STRETCH: Stretch = [2, 2.1, 1.85];
/** Thicknesses are given in the fox's measures and grow this much. */
const GROW = 2;
const FUR_TILE = CONFIG.surfaces.furTileMeters;
const f = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * NBB-167 (AH7-A): the wolf: grey and lean, a darker saddle on the back, pale belly, legs and
 * muzzle, short ears, a deep chest with a ruff at the neck and a bushy tail carried low.
 */
export const wolf: ModelGenerator = {
  id: "wolf",
  label: "Lobo",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("wolf", scene);
    const defs = quadrupedBones(STRETCH, {
      earL: { head: f(0.035, 0.5, 0.3), tail: f(0.045, 0.565, 0.29) },
      earR: { head: f(-0.035, 0.5, 0.3), tail: f(-0.045, 0.565, 0.29) },
      tail: { head: f(0, 0.37, -0.3), tail: f(0, 0.2, -0.56) },
    });
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, "wolf", defs, root);
    const { bone, skinBone } = boneLookup(defs, indexOf);
    const p = stretched(STRETCH);
    const r = (values: number[]) => (t: number) => piecewise(t, values) * GROW;
    const palette = CONFIG.palette;
    const fur = toColor(palette.wolfFur);
    const saddle = toColor(palette.wolfDark);
    const light = toColor(palette.wolfLight);
    const dark = toColor(palette.animalDark);
    const parts: Mesh[] = [];
    // Colors are chosen in the fox's measures.
    const fy = (y: number) => y / STRETCH[1];
    const fz = (z: number) => z / STRETCH[2];

    const bodyColor = (_x: number, y: number, z: number): Color3 => {
      if (fy(y) > 0.405 && fz(z) < 0.15) return saddle;
      if (fy(y) < 0.31) return light;
      return fur;
    };
    const legColor = (_x: number, y: number): Color3 =>
      fy(y) < 0.2 ? Color3.Lerp(fur, light, 0.6) : fur;
    const headColor = (_x: number, y: number, z: number): Color3 => {
      if (fz(z) > 0.445) return dark;
      if (fy(y) < 0.435 && fz(z) > 0.33) return light;
      return fur;
    };
    const tailColor = (_x: number, _y: number, z: number): Color3 => (fz(z) < -0.5 ? saddle : fur);
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

    // A deep chest and a tucked-up waist.
    const torso = tube(
      scene,
      "wolfTorso",
      // (starting just behind the rump, thin, so the rump is rounded)
      [p(0, 0.36, -0.33), p(0, 0.37, -0.28), p(0, 0.35, -0.12), p(0, 0.36, 0.05), p(0, 0.37, 0.2)],
      r([0.03, 0.07, 0.08, 0.095, 0.1]),
      9,
      FUR_TILE,
    );
    add(narrow(torso, 0.75), ["pelvis", "spine", "chest"], 1, bodyColor);

    // A thick ruff at the neck.
    const neck = tube(
      scene,
      "wolfNeck",
      [p(0, 0.37, 0.16), bone("neck").head, bone("head").head],
      r([0.08, 0.07, 0.055]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(neck, 0.85), ["chest", "neck", "head"], 2, bodyColor);

    // A broad skull and a long, blunt muzzle.
    const head = tube(
      scene,
      "wolfHead",
      [p(0, 0.47, 0.27), p(0, 0.465, 0.32), p(0, 0.44, 0.39), p(0, 0.425, 0.45)],
      r([0.045, 0.05, 0.03, 0.018]),
      7,
      FUR_TILE,
      2,
    );
    add(narrow(head, 0.9), ["head"], 3, headColor);
    add(blob(scene, "wolfNose", p(0, 0.428, 0.455), 0.04), ["head"], 0, dark);

    // The bushy tail, carried low.
    const tail = tube(
      scene,
      "wolfTail",
      [bone("tail").head, p(0, 0.33, -0.38), p(0, 0.26, -0.48), bone("tail").tail],
      r([0.025, 0.045, 0.04, 0.006]),
      7,
      FUR_TILE,
      2,
    );
    add(tail, ["tail"], 4, tailColor);

    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const earBone = bone(`ear${side}`);
      add(
        ear(scene, `wolfEar${side}`, earBone.head, earBone.tail, 0.065, 0.02),
        [`ear${side}`],
        5,
        fur,
      );
      add(blob(scene, `wolfEye${side}`, p(0.028 * s, 0.48, 0.355), 0.03), ["head"], 0, dark);

      const front = tube(
        scene,
        `wolfFrontLeg${side}`,
        [
          p(0.045 * s, 0.35, 0.16),
          bone(`upperArm${side}`).head,
          bone(`forearm${side}`).head,
          bone(`frontCannon${side}`).head,
          bone(`frontHoof${side}`).head,
          bone(`frontHoof${side}`).tail,
        ],
        r([0.035, 0.03, 0.02, 0.015, 0.015, 0.016]),
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
        `wolfHindLeg${side}`,
        [
          p(0.05 * s, 0.37, -0.22),
          bone(`thigh${side}`).head,
          bone(`shin${side}`).head,
          bone(`hindCannon${side}`).head,
          bone(`hindHoof${side}`).head,
          bone(`hindHoof${side}`).tail,
        ],
        r([0.048, 0.042, 0.026, 0.016, 0.015, 0.016]),
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

    const body = assemble("wolfBody", parts, getFurMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    body.alwaysSelectAsActiveMesh = true;

    return { root, animations: buildWolfAnimations(scene, nodes) };
  },
};

/** Ears laid back (the left ear −z, the right one +z). */
const EARS_BACK: Pose = { earL: [0.4, 0, -0.3], earR: [0.4, 0, 0.3] };

/** Head low and forward, ears back, front legs braced, shaking a little (1 s per cycle). */
function growlKeys(): Key[] {
  const low: Pose = blend(EARS_BACK, {
    neck: [0.45, 0, 0],
    head: [-0.35, 0, 0],
    upperArmL: [0.15, 0, 0],
    upperArmR: [0.15, 0, 0],
    forearmL: [-0.15, 0, 0],
    forearmR: [-0.15, 0, 0],
    thighL: [-0.15, 0, 0],
    thighR: [-0.15, 0, 0],
    tail: [-0.3, 0, 0],
  });
  return [
    { frame: 0, pose: low, hipDrop: -0.06 },
    { frame: 8, pose: blend(low, { head: [-0.06, 0.04, 0] }), hipDrop: -0.07 },
    { frame: 16, pose: blend(low, { head: [0.02, -0.04, 0] }), hipDrop: -0.06 },
    { frame: 30, pose: low, hipDrop: -0.06 },
  ];
}

/** Sitting back on the haunches, the snout raised to the sky (2.5 s per cycle). */
function howlKeys(): Key[] {
  const up: Pose = {
    neck: [-0.85, 0, 0],
    head: [-0.45, 0, 0],
    thighL: [-0.7, 0, 0],
    thighR: [-0.7, 0, 0],
    shinL: [0.9, 0, 0],
    shinR: [0.9, 0, 0],
    pelvis: [-0.35, 0, 0],
    tail: [0.5, 0, 0],
  };
  return [
    { frame: 0, pose: {} },
    { frame: 15, pose: up, hipDrop: -0.2 },
    { frame: 45, pose: blend(up, { head: [-0.1, 0.05, 0] }), hipDrop: -0.2 },
    { frame: 60, pose: up, hipDrop: -0.2 },
    { frame: 75, pose: {} },
  ];
}

/** A crouch, a lunge with the jaws up, the snap, and back (0.6 s). */
function biteKeys(): Key[] {
  const crouch: Pose = blend(EARS_BACK, {
    neck: [0.3, 0, 0],
    thighL: [-0.35, 0, 0],
    thighR: [-0.35, 0, 0],
    shinL: [0.3, 0, 0],
    shinR: [0.3, 0, 0],
  });
  const lunge: Pose = blend(EARS_BACK, {
    neck: [-0.15, 0, 0],
    head: [-0.35, 0, 0],
    upperArmL: [-0.7, 0, 0],
    upperArmR: [-0.6, 0, 0],
    thighL: [0.4, 0, 0],
    thighR: [0.4, 0, 0],
  });
  const snap: Pose = blend(lunge, { head: [0.6, 0, 0] });
  return [
    { frame: 0, pose: crouch, hipDrop: -0.08 },
    { frame: 6, pose: lunge, hips: [0, 0.05, 0.25] },
    { frame: 10, pose: snap, hips: [0, 0.02, 0.28] },
    { frame: 18, pose: {} },
  ];
}

function buildWolfAnimations(scene: Scene, nodes: Map<string, TransformNode>) {
  const clips: [string, Key[]][] = [
    ["Andar", walkKeys(28)],
    ["Correr", gallopKeys(12, {}, 0.08)],
    ["Rosnar", growlKeys()],
    ["Uivar", howlKeys()],
    ["Morder", biteKeys()],
    ["Morrer", collapseKeys(0.5)],
  ];
  return buildPoseAnimations(scene, nodes, clips, "pelvis", ["Morrer"]);
}
