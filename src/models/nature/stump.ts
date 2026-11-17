import { MeshBuilder, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/**
 * What is left of a felled tree (NBB-144, MC1-A): a short stump, its sides in bark and its cut
 * top in light fresh wood with darker rings. Built with a radius of 1 m: each one is scaled to the
 * tree's trunk.
 */
export function createStumpMesh(scene: Scene): Mesh {
  const height = CONFIG.axe.stumpHeight;
  const stump = MeshBuilder.CreateCylinder(
    "stump",
    { height, diameterTop: 2, diameterBottom: 2.4, tessellation: 9 },
    scene,
  );
  // Sunk a little, so it sits on slopes.
  stump.position.y = height / 2 - 0.08;
  stump.bakeCurrentTransformIntoVertices();
  jitter(stump, 0.06, 7);
  const bark = toColor(CONFIG.palette.bark);
  const wood = toColor(CONFIG.palette.cutWood);
  const top = height - 0.12;
  paint(
    stump,
    (x, y, z) => {
      if (y < top) {
        return bark;
      }
      // Growth rings on the cut.
      const ring = Math.sin(Math.hypot(x, z) * 14) > 0.6 ? 0.82 : 1;
      return wood.scale(ring);
    },
    8,
  );
  return assemble("stump", [stump], getModelMaterials(scene).fallenWood);
}

/** A stump in the gallery (A2-C), at the size of a pine's trunk. */
export const stump: ModelGenerator = {
  id: "stump",
  label: "Toco",
  create(scene: Scene): GeneratedModel {
    const mesh = createStumpMesh(scene);
    mesh.scaling.set(0.2, 1, 0.2);
    return { root: mesh, animations: [] };
  },
};
