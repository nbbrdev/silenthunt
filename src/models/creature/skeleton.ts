import { Bone, Matrix, Skeleton, TransformNode, Vector3, type Scene } from "@babylonjs/core";

/** One bone in the rest pose: from `head` (the joint) to `tail` (where it points). */
export interface BoneDef {
  name: string;
  parent: string | null;
  head: Vector3;
  tail: Vector3;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The creature's skeleton in its rest pose (meters, facing +Z, feet on the ground). Proportions
 * from G15 and the user's references: about 2.3 m tall standing, long arms reaching the knees,
 * and digitigrade legs (the "knee" bends backwards, like a deer's hind leg).
 */
export function creatureBones(): BoneDef[] {
  const bones: BoneDef[] = [
    { name: "root", parent: null, head: v(0, 0, 0), tail: v(0, 0.1, 0) },
    { name: "pelvis", parent: "root", head: v(0, 1.22, 0), tail: v(0, 1.42, 0.02) },
    { name: "spine1", parent: "pelvis", head: v(0, 1.42, 0.02), tail: v(0, 1.62, 0.06) },
    { name: "spine2", parent: "spine1", head: v(0, 1.62, 0.06), tail: v(0, 1.82, 0.1) },
    { name: "chest", parent: "spine2", head: v(0, 1.82, 0.1), tail: v(0, 2.02, 0.14) },
    { name: "neck", parent: "chest", head: v(0, 2.02, 0.14), tail: v(0, 2.22, 0.26) },
    { name: "head", parent: "neck", head: v(0, 2.22, 0.26), tail: v(0, 2.3, 0.5) },
  ];
  for (const [side, s] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    bones.push(
      {
        name: `thigh${side}`,
        parent: "pelvis",
        head: v(0.13 * s, 1.2, 0),
        tail: v(0.15 * s, 0.74, 0.2),
      },
      {
        name: `shin${side}`,
        parent: `thigh${side}`,
        head: v(0.15 * s, 0.74, 0.2),
        tail: v(0.14 * s, 0.3, -0.14),
      },
      {
        name: `foot${side}`,
        parent: `shin${side}`,
        head: v(0.14 * s, 0.3, -0.14),
        tail: v(0.14 * s, 0.04, 0.04),
      },
      {
        name: `toe${side}`,
        parent: `foot${side}`,
        head: v(0.14 * s, 0.04, 0.04),
        tail: v(0.14 * s, 0.02, 0.22),
      },
      {
        name: `clavicle${side}`,
        parent: "chest",
        head: v(0.05 * s, 1.98, 0.12),
        tail: v(0.24 * s, 1.96, 0.1),
      },
      {
        name: `upperArm${side}`,
        parent: `clavicle${side}`,
        head: v(0.24 * s, 1.96, 0.1),
        tail: v(0.3 * s, 1.34, 0.06),
      },
      {
        name: `forearm${side}`,
        parent: `upperArm${side}`,
        head: v(0.3 * s, 1.34, 0.06),
        tail: v(0.33 * s, 0.72, 0.1),
      },
      {
        name: `hand${side}`,
        parent: `forearm${side}`,
        head: v(0.33 * s, 0.72, 0.1),
        tail: v(0.34 * s, 0.54, 0.14),
      },
    );
  }
  return bones;
}

export interface BuiltSkeleton {
  skeleton: Skeleton;
  /** One node per bone, mirroring the bone tree: animations rotate these nodes. */
  nodes: Map<string, TransformNode>;
  /** Bone index (as used in the skin weights) per bone name. */
  indexOf: Map<string, number>;
}

/**
 * Builds the Babylon skeleton. Each bone is linked to a TransformNode (the way glTF models
 * work): animating a node's rotation moves its bone, and anything parented to a node (the eyes)
 * follows it.
 */
export function buildSkeleton(scene: Scene, defs: BoneDef[], parent: TransformNode): BuiltSkeleton {
  const skeleton = new Skeleton("creatureSkeleton", "creatureSkeleton", scene);
  const bones = new Map<string, Bone>();
  const nodes = new Map<string, TransformNode>();
  const indexOf = new Map<string, number>();
  const headOf = new Map(defs.map((def) => [def.name, def.head]));

  defs.forEach((def, index) => {
    const parentHead = def.parent ? (headOf.get(def.parent) ?? Vector3.Zero()) : Vector3.Zero();
    const local = def.head.subtract(parentHead);
    const parentBone = def.parent ? (bones.get(def.parent) ?? null) : null;
    const bone = new Bone(
      def.name,
      skeleton,
      parentBone,
      Matrix.Translation(local.x, local.y, local.z),
    );

    const node = new TransformNode(`creatureBone-${def.name}`, scene);
    node.parent = def.parent ? (nodes.get(def.parent) ?? parent) : parent;
    node.position = local;
    node.rotationQuaternion = null;
    node.rotation = Vector3.Zero();
    bone.linkTransformNode(node);

    bones.set(def.name, bone);
    nodes.set(def.name, node);
    indexOf.set(def.name, index);
  });
  return { skeleton, nodes, indexOf };
}
