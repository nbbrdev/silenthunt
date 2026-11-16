import type { Material, Mesh } from "@babylonjs/core";
import { assemble } from "./lowPoly";
import type { GeneratedModel } from "./types";

/**
 * Joins the wood parts into one mesh and hangs the leaf cards on it. Wood and leaves use
 * different materials, so they stay two meshes; the leaves are a child of the wood.
 */
export function plantModel(
  name: string,
  woodParts: Mesh[],
  woodMaterial: Material,
  leaves?: { mesh: Mesh; material: Material },
): GeneratedModel {
  const wood = assemble(name, woodParts, woodMaterial);
  if (leaves) {
    leaves.mesh.name = `${name}Leaves`;
    leaves.mesh.material = leaves.material;
    leaves.mesh.parent = wood;
  }
  return { root: wood, animations: [] };
}
