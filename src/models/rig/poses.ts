import {
  Animation,
  AnimationGroup,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";

/** Rotation offsets per bone (radians, x/y/z), relative to the rest pose. */
export type Pose = Record<string, readonly [number, number, number]>;

/** One keyframe of a clip. */
export interface Key {
  frame: number;
  pose: Pose;
  /** How much the hips drop (meters, negative = lower). */
  hipDrop?: number;
  /** Full hip offset (meters, x/y/z); overrides `hipDrop`. */
  hips?: readonly [number, number, number];
}

export const POSE_FPS = 30;

/** Merges poses: later ones add to earlier ones bone by bone. */
export function blend(...poses: Pose[]): Pose {
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
 * Turns keyframed poses into AnimationGroups (named for the gallery, in pt-BR) at 30 frames per
 * second: one rotation track per bone node plus the hips' position (`hipsBone`). When a clip stops
 * and no other one took over, the skeleton goes back to its rest pose, except for the clips in
 * `holdLastFrame` ("Morrer"): a dead animal stays down (its carcass, NBB-142).
 */
export function buildPoseAnimations(
  scene: Scene,
  nodes: Map<string, TransformNode>,
  clips: [string, Key[]][],
  hipsBone: string,
  holdLastFrame: readonly string[] = [],
): AnimationGroup[] {
  const hips = nodes.get(hipsBone);
  const hipsRest = hips?.position.clone();
  const groups = clips.map(([name, keys]) => {
    const group = new AnimationGroup(name, scene);
    for (const [boneName, node] of nodes) {
      // The root stays put: the game moves and turns the whole model instead.
      if (boneName === "root") {
        continue;
      }
      const rotation = new Animation(
        `${name}-${boneName}`,
        "rotation",
        POSE_FPS,
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
    if (hips && hipsRest) {
      const rest = hipsRest;
      const position = new Animation(
        `${name}-hips`,
        "position",
        POSE_FPS,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE,
      );
      position.setKeys(
        keys.map((key) => {
          const [x, y, z] = key.hips ?? [0, key.hipDrop ?? 0, 0];
          return { frame: key.frame, value: rest.add(new Vector3(x, y, z)) };
        }),
      );
      group.addTargetedAnimation(position, hips);
    }
    // Back to the rest pose when the animation stops, unless another one took over (the game
    // starts the next animation before stopping the old one, and blends between them).
    group.onAnimationGroupEndObservable.add(() => {
      if (
        holdLastFrame.includes(name) ||
        groups.some((other) => other !== group && other.isPlaying)
      ) {
        return;
      }
      for (const node of nodes.values()) {
        node.rotation.setAll(0);
      }
      if (hips && hipsRest) {
        hips.position.copyFrom(hipsRest);
      }
    });
    return group;
  });
  return groups;
}
