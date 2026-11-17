import { Bone, Matrix, Skeleton, TransformNode, Vector3, type Scene } from "@babylonjs/core";

/** One bone in the rest pose: from `head` (the joint) to `tail` (where it points). */
export interface BoneDef {
  name: string;
  parent: string | null;
  head: Vector3;
  tail: Vector3;
}

export interface BuiltSkeleton {
  skeleton: Skeleton;
  /** One node per bone, mirroring the bone tree: animations rotate these nodes. */
  nodes: Map<string, TransformNode>;
  /** Bone index (as used in the skin weights) per bone name. */
  indexOf: Map<string, number>;
}

/**
 * Builds a Babylon skeleton (A5-B) for the creature and the animals. Each bone is linked to a
 * TransformNode (the way glTF models work): animating a node's rotation moves its bone, and
 * anything parented to a node (the creature's eyes) follows it. Nodes are named
 * `${name}Bone-${bone}`.
 */
export function buildSkeleton(
  scene: Scene,
  name: string,
  defs: BoneDef[],
  parent: TransformNode,
): BuiltSkeleton {
  const skeleton = new Skeleton(`${name}Skeleton`, `${name}Skeleton`, scene);
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

    const node = new TransformNode(`${name}Bone-${def.name}`, scene);
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
