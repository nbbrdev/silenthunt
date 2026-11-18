import { MeshBuilder, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getPlainMaterial } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/**
 * The bed (NBB-146, CM3; RF-51: 4 fibers, 2 leathers): a leather sleeping bag open on the
 * ground, about 2 m long along Z (the head toward −Z), a fur thrown over it and a fiber pillow.
 * Under 200 triangles.
 */
export function createBedMesh(scene: Scene): Mesh {
  const leather = toColor(CONFIG.palette.leather);
  const fur = toColor(CONFIG.palette.deerFur);
  const fiber = toColor(CONFIG.palette.fiber);

  const bag = MeshBuilder.CreateBox("bedBag", { width: 0.8, height: 0.08, depth: 1.9 }, scene);
  bag.position.y = 0.04;
  bag.bakeCurrentTransformIntoVertices();
  paint(bag, leather, 1);

  // The top flap, folded back from the head.
  const flap = MeshBuilder.CreateBox("bedFlap", { width: 0.78, height: 0.04, depth: 1.1 }, scene);
  flap.position.set(0, 0.1, 0.38);
  flap.rotation.x = 0.04;
  flap.bakeCurrentTransformIntoVertices();
  paint(flap, leather.scale(0.85), 2);

  // A fur thrown over the middle, lumpy.
  const pelt = MeshBuilder.CreateSphere("bedFur", { diameter: 1, segments: 3 }, scene);
  pelt.scaling.set(0.82, 0.1, 0.9);
  pelt.position.set(0.02, 0.13, 0.05);
  pelt.bakeCurrentTransformIntoVertices();
  jitter(pelt, 0.025, 3);
  paint(pelt, (x, _y, z) => (Math.sin(x * 20 + z * 13) > 0.6 ? fur.scale(0.8) : fur), 4);

  // The pillow: a bundle of fiber at the head.
  const pillow = MeshBuilder.CreateSphere("bedPillow", { diameter: 1, segments: 3 }, scene);
  pillow.scaling.set(0.46, 0.13, 0.28);
  pillow.position.set(0, 0.12, -0.78);
  pillow.bakeCurrentTransformIntoVertices();
  jitter(pillow, 0.015, 5);
  paint(pillow, fiber.scale(0.9), 6);

  return assemble("bed", [bag, flap, pelt, pillow], getPlainMaterial(scene));
}

/** The bed rolled up, as an item (IN6-B): a leather roll with fur showing, tied twice. */
export function createBedrollMesh(scene: Scene): Mesh {
  const roll = MeshBuilder.CreateCylinder(
    "bedrollRoll",
    { height: 0.62, diameter: 0.24, tessellation: 10 },
    scene,
  );
  roll.rotation.x = Math.PI / 2;
  roll.bakeCurrentTransformIntoVertices();
  const leather = toColor(CONFIG.palette.leather);
  const fur = toColor(CONFIG.palette.deerFur);
  // The fur shows at the ends of the roll.
  paint(roll, (_x, _y, z) => (Math.abs(z) > 0.29 ? fur : leather), 7);
  const parts: Mesh[] = [roll];
  for (const z of [-0.17, 0.17]) {
    const strap = MeshBuilder.CreateTorus(
      "bedrollStrap",
      { diameter: 0.25, thickness: 0.018, tessellation: 10 },
      scene,
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.z = z;
    strap.bakeCurrentTransformIntoVertices();
    paint(strap, toColor(CONFIG.palette.fiber).scale(0.6), 8);
    parts.push(strap);
  }
  return assemble("bedroll", parts, getPlainMaterial(scene));
}

/** The bed in the gallery (A2-C). */
export const bed: ModelGenerator = {
  id: "bed",
  label: "Cama",
  create(scene: Scene): GeneratedModel {
    return { root: createBedMesh(scene), animations: [] };
  },
};
