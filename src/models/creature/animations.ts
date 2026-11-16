import {
  Animation,
  AnimationGroup,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";

/** Rotation offsets per bone (radians, x/y/z), relative to the rest pose. */
type Pose = Record<string, readonly [number, number, number]>;

interface Key {
  frame: number;
  pose: Pose;
  /** How much the hips drop (meters, negative = lower), for crouched gaits. */
  hipDrop?: number;
}

const FPS = 30;

/**
 * Sign conventions (rotation about X): +x tilts the spine/neck forward; for bones pointing down
 * (legs, arms), −x swings them forward and +x backward.
 *
 * The arms hang from the chest, so they tilt along with the spine: a chest leaning forward by
 * `t` radians throws the arms backward by `t`, and the upper arm needs −t more to hang down again.
 */

/** Hunched upright posture shared by the walk (CR3: "em pé, curvada"). Chest tilt: 0.47. */
const HUNCH: Pose = {
  spine1: [0.22, 0, 0],
  spine2: [0.15, 0, 0],
  chest: [0.1, 0, 0],
  neck: [-0.15, 0, 0],
  head: [-0.12, 0, 0],
  upperArmL: [-0.45, 0, 0],
  upperArmR: [-0.45, 0, 0],
  forearmL: [-0.2, 0, 0],
  forearmR: [-0.2, 0, 0],
};

/**
 * Low, nearly horizontal body on all fours (CR3: "espreitar" and "recuar"). Chest tilt: 1.5, so
 * the arms swing forward by 2.05 to reach the ground ahead of the shoulders, and the neck lifts
 * the skull back to level.
 */
const LOW: Pose = {
  spine1: [0.95, 0, 0],
  spine2: [0.35, 0, 0],
  chest: [0.2, 0, 0],
  neck: [-0.95, 0, 0],
  head: [-0.55, 0, 0],
  thighL: [-0.75, 0, 0],
  thighR: [-0.75, 0, 0],
  shinL: [1.25, 0, 0],
  shinR: [1.25, 0, 0],
  footL: [-0.5, 0, 0],
  footR: [-0.5, 0, 0],
  upperArmL: [-2.05, 0, 0],
  upperArmR: [-2.05, 0, 0],
  forearmL: [-0.35, 0, 0],
  forearmR: [-0.35, 0, 0],
  // Hands flat on the ground with the claws forward, instead of digging in.
  handL: [-0.3, 0, 0],
  handR: [-0.3, 0, 0],
};

/** Merges poses: later ones add to earlier ones bone by bone. */
function blend(...poses: Pose[]): Pose {
  const result: Record<string, [number, number, number]> = {};
  for (const pose of poses) {
    for (const [bone, [x, y, z]] of Object.entries(pose)) {
      const current = result[bone] ?? [0, 0, 0];
      result[bone] = [current[0] + x, current[1] + y, current[2] + z];
    }
  }
  return result;
}

/**
 * One step of a gait: legs and arms swing in opposite pairs, `phase` = 1 or −1. On all fours
 * (`onAllFours`), the arm swinging back bends its elbow so the hand stays on the ground instead of
 * sinking into it (a straighter arm reaches lower), and the wrist turns back to keep the hand flat.
 */
function stride(
  phase: number,
  legSwing: number,
  armSwing: number,
  lift: number,
  onAllFours = false,
): Pose {
  const elbow = onAllFours ? -1.4 * armSwing : 0;
  const pose: Record<string, [number, number, number]> = {
    thighL: [-legSwing * phase, 0, 0],
    thighR: [legSwing * phase, 0, 0],
    shinL: [phase > 0 ? lift * 0.3 : lift, 0, 0],
    shinR: [phase > 0 ? lift : lift * 0.3, 0, 0],
    upperArmL: [armSwing * phase, 0, 0],
    upperArmR: [-armSwing * phase, 0, 0],
  };
  // phase 1: the left arm swings back; phase −1: the right one.
  const backSide = phase > 0 ? "L" : "R";
  pose[`forearm${backSide}`] = [elbow, 0, 0];
  pose[`hand${backSide}`] = [-elbow, 0, 0];
  return pose;
}

/** CR3 "andar": upright and hunched, long slow steps (1.4 s per cycle). */
function walkKeys(): Key[] {
  return [
    { frame: 0, pose: blend(HUNCH, stride(1, 0.45, 0.3, 0.35), { chest: [0, 0.06, 0.03] }) },
    { frame: 21, pose: blend(HUNCH, stride(-1, 0.45, 0.3, 0.35), { chest: [0, -0.06, -0.03] }) },
    { frame: 42, pose: blend(HUNCH, stride(1, 0.45, 0.3, 0.35), { chest: [0, 0.06, 0.03] }) },
  ];
}

/** CR3 "espreitar": low on all fours, slow and careful (2 s per cycle). */
function stalkKeys(): Key[] {
  return [
    { frame: 0, pose: blend(LOW, stride(1, 0.25, 0.3, 0.15, true)), hipDrop: -0.52 },
    { frame: 30, pose: blend(LOW, stride(-1, 0.25, 0.3, 0.15, true)), hipDrop: -0.52 },
    { frame: 60, pose: blend(LOW, stride(1, 0.25, 0.3, 0.15, true)), hipDrop: -0.52 },
  ];
}

/**
 * CR3 "atacar": rears back with the right arm raised overhead, then lunges and slashes it down
 * and across, at the height of the player's chest (1 s).
 */
function attackKeys(): Key[] {
  const windUp = blend(HUNCH, {
    spine1: [-0.25, 0, 0],
    upperArmR: [-2.4, 0, -0.5],
    forearmR: [-0.6, 0, 0],
    thighL: [-0.3, 0, 0],
    thighR: [0.3, 0, 0],
  });
  // Chest tilt 0.87: the right arm ends pointing forward and slightly down.
  const strike = blend(HUNCH, {
    spine1: [0.4, 0, 0],
    spine2: [0.2, 0.2, 0],
    neck: [-0.35, 0, 0],
    head: [-0.2, 0, 0],
    upperArmR: [-1.42, 0, 0.3],
    forearmR: [-0.1, 0, 0],
    upperArmL: [-0.42, 0, 0],
    thighL: [-0.6, 0, 0],
    shinL: [0.6, 0, 0],
    thighR: [0.4, 0, 0],
  });
  return [
    { frame: 0, pose: HUNCH },
    { frame: 10, pose: windUp },
    { frame: 15, pose: strike, hipDrop: -0.08 },
    { frame: 22, pose: strike, hipDrop: -0.08 },
    { frame: 30, pose: HUNCH },
  ];
}

/** CR3 "recuar": fast flight on all fours (0.6 s per cycle); turning around is the AI's job. */
function retreatKeys(): Key[] {
  return [
    { frame: 0, pose: blend(LOW, stride(1, 0.6, 0.7, 0.25, true)), hipDrop: -0.62 },
    { frame: 9, pose: blend(LOW, stride(-1, 0.6, 0.7, 0.25, true)), hipDrop: -0.55 },
    { frame: 18, pose: blend(LOW, stride(1, 0.6, 0.7, 0.25, true)), hipDrop: -0.62 },
  ];
}

/** Builds the creature's four animations (CR3) as AnimationGroups named for the gallery (pt-BR). */
export function buildCreatureAnimations(
  scene: Scene,
  nodes: Map<string, TransformNode>,
): AnimationGroup[] {
  const clips: [string, Key[]][] = [
    ["Andar", walkKeys()],
    ["Espreitar", stalkKeys()],
    ["Atacar", attackKeys()],
    ["Recuar", retreatKeys()],
  ];
  const groups = clips.map(([name, keys]) => {
    const group = new AnimationGroup(name, scene);
    for (const [boneName, node] of nodes) {
      if (boneName === "root") {
        continue;
      }
      const rotation = new Animation(
        `${name}-${boneName}`,
        "rotation",
        FPS,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE,
      );
      rotation.setKeys(
        keys.map((key) => {
          const [x, y, z] = key.pose[boneName] ?? [0, 0, 0];
          return { frame: key.frame, value: new Vector3(x, y, z) };
        }),
      );
      group.addTargetedAnimation(rotation, node);
    }
    const pelvis = nodes.get("pelvis");
    const pelvisRest = pelvis?.position.clone();
    if (pelvis && pelvisRest) {
      const rest = pelvisRest;
      const hips = new Animation(
        `${name}-hips`,
        "position",
        FPS,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE,
      );
      hips.setKeys(
        keys.map((key) => ({
          frame: key.frame,
          value: rest.add(new Vector3(0, key.hipDrop ?? 0, 0)),
        })),
      );
      group.addTargetedAnimation(hips, pelvis);
    }
    // Back to the rest pose when the animation stops, unless another one took over (the game
    // starts the next animation before stopping the old one, and blends between them).
    group.onAnimationGroupEndObservable.add(() => {
      if (groups.some((other) => other !== group && other.isPlaying)) {
        return;
      }
      for (const node of nodes.values()) {
        node.rotation.setAll(0);
      }
      if (pelvis && pelvisRest) {
        pelvis.position.copyFrom(pelvisRest);
      }
    });
    return group;
  });
  return groups;
}
