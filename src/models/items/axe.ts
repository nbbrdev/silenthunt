import { MeshBuilder, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The stone axe (NBB-144, RF-51: 2 branches, 2 stones, 1 fiber): a wooden handle about 50 cm long
 * along +Z, a knapped stone head at the far end with its edge facing down (−Y), lashed with fiber.
 */
export function createAxeMesh(scene: Scene): Mesh {
  const handle = tube(
    scene,
    "axeHandle",
    [v(0, 0, -0.14), v(0, 0.004, 0.1), v(0, 0.01, 0.36)],
    () => 0.016,
    6,
    0.3,
    2,
  );
  paint(handle, toColor(CONFIG.palette.bowWood), 1);

  // The head: a wedge, thick at the back (on top of the handle) and thin at the edge (below).
  const head = MeshBuilder.CreateCylinder(
    "axeHead",
    { height: 0.036, diameterTop: 0.17, diameterBottom: 0.17, tessellation: 3 },
    scene,
  );
  head.rotation.z = Math.PI / 2;
  head.scaling.set(1, 1, 0.6);
  head.position.set(0, -0.045, 0.31);
  head.bakeCurrentTransformIntoVertices();
  jitter(head, 0.005, 2);
  paint(head, toColor(CONFIG.palette.axeStone), 3);

  // Fiber lashing around the handle where the head sits.
  const lashing = MeshBuilder.CreateTorus(
    "axeLashing",
    { diameter: 0.04, thickness: 0.009, tessellation: 8 },
    scene,
  );
  lashing.rotation.x = Math.PI / 2;
  lashing.position.set(0, 0.008, 0.31);
  lashing.scaling.set(1, 1, 1.6);
  lashing.bakeCurrentTransformIntoVertices();
  paint(lashing, toColor(CONFIG.palette.fiber).scale(0.75), 4);

  return assemble("axe", [handle, head, lashing], getModelMaterials(scene).fallenWood);
}

/** The axe in the gallery (A2-C). */
export const axe: ModelGenerator = {
  id: "axe",
  label: "Machado",
  create(scene: Scene): GeneratedModel {
    const mesh = createAxeMesh(scene);
    mesh.position.y = 0.12;
    return { root: mesh, animations: [] };
  },
};
