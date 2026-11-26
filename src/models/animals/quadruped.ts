import { Vector3 } from "@babylonjs/core";
import { blend, type Key, type Pose } from "../rig/poses";
import type { BoneDef } from "../rig/skeleton";
import { foxBones } from "./fox";

/**
 * NBB-167 (AH7-A): what the wolf, the boar and the bear share. They are built on the fox's
 * skeleton, stretched by `[x, y, z]` (width, height, length), so the same bone names and poses
 * work for all of them; each one moves a few bones to its own shape.
 */
export type Stretch = readonly [number, number, number];

/** A point given in the fox's measures, stretched to the animal's. */
export function stretched(stretch: Stretch): (x: number, y: number, z: number) => Vector3 {
  return (x, y, z) => new Vector3(x * stretch[0], y * stretch[1], z * stretch[2]);
}

/**
 * The fox's bones, stretched; `moved` gives some bones a new head and tail (in the fox's
 * measures, before stretching).
 */
export function quadrupedBones(
  stretch: Stretch,
  moved: Record<string, { head: Vector3; tail: Vector3 }> = {},
): BoneDef[] {
  const at = (point: Vector3) =>
    new Vector3(point.x * stretch[0], point.y * stretch[1], point.z * stretch[2]);
  return foxBones().map((bone) => {
    const own = moved[bone.name];
    return {
      ...bone,
      head: at(own?.head ?? bone.head),
      tail: at(own?.tail ?? bone.tail),
    };
  });
}

/** A walk: diagonal legs together, each lifted as it swings forward (one cycle in `frames`). */
export function walkKeys(frames = 30, extra: Pose = {}): Key[] {
  const step = (front: "L" | "R"): Pose => {
    const back = front === "L" ? "R" : "L";
    return {
      ...extra,
      [`upperArm${front}`]: [-0.3, 0, 0],
      [`upperArm${back}`]: [0.25, 0, 0],
      [`thigh${back}`]: [-0.25, 0, 0],
      [`thigh${front}`]: [0.3, 0, 0],
    };
  };
  const lift = (side: "L" | "R"): Pose => {
    const other = side === "L" ? "R" : "L";
    return {
      ...extra,
      [`forearm${side}`]: [0.5, 0, 0],
      [`frontCannon${side}`]: [0.4, 0, 0],
      [`shin${other}`]: [-0.4, 0, 0],
      [`hindCannon${other}`]: [0.5, 0, 0],
    };
  };
  const quarter = frames / 4;
  return [
    { frame: 0, pose: step("L") },
    { frame: quarter, pose: lift("R"), hipDrop: 0.01 },
    { frame: quarter * 2, pose: step("R") },
    { frame: quarter * 3, pose: lift("L"), hipDrop: 0.01 },
    { frame: frames, pose: step("L") },
  ];
}

/** A stretched gallop (the fox's), with `extra` held on top (one cycle in `frames`). */
export function gallopKeys(frames = 14, extra: Pose = {}, hipDrop = 0.04): Key[] {
  const reaching: Pose = {
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
  };
  const gathered: Pose = {
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
  };
  const half = Math.round(frames / 2);
  return [
    { frame: 0, pose: blend(reaching, extra), hipDrop },
    { frame: half, pose: blend(gathered, extra), hipDrop: -hipDrop / 2 },
    { frame: frames, pose: blend(reaching, extra), hipDrop },
  ];
}

/** Legs give way and it rolls onto its side (played once); `drop` is how far the hips fall. */
export function collapseKeys(drop: number): Key[] {
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
    { frame: 10, pose: buckled, hipDrop: -drop * 0.55 },
    { frame: 24, pose: lying, hips: [drop * 0.2, -drop, 0] },
    { frame: 40, pose: lying, hips: [drop * 0.2, -drop, 0] },
  ];
}
