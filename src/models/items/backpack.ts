import { MeshBuilder, VertexBuffer, VertexData, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getPlainMaterial } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** A thin flat box (the straps and the buckle), placed and baked. */
function strip(
  scene: Scene,
  name: string,
  size: { width: number; height: number; depth: number },
  at: { x: number; y: number; z: number },
  turn = 0,
): Mesh {
  const box = MeshBuilder.CreateBox(name, size, scene);
  box.rotation.y = turn;
  box.position.set(at.x, at.y, at.z);
  box.bakeCurrentTransformIntoVertices();
  return box;
}

/**
 * The backpack left where the player died (NBB-148, MO7): light canvas (MO4-A), lying on its
 * back with the top toward +Z, a leather flap with a buckle, a front pocket, the two shoulder
 * straps loose on the ground and a fiber roll tied under it. Under 300 triangles.
 */
export function createBackpackMesh(scene: Scene): Mesh {
  const canvas = toColor(CONFIG.palette.canvas);
  const leather = toColor(CONFIG.palette.leather);
  const fiber = toColor(CONFIG.palette.fiber);

  // The body: a sack with rounded edges (a sphere pushed toward a box), flat where it rests.
  const body = MeshBuilder.CreateSphere("backpackBody", { diameter: 2, segments: 4 }, scene);
  const positions = body.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const half = { x: 0.21, y: 0.13, z: 0.28 };
  const boxy = (value: number) => Math.sign(value) * Math.sqrt(Math.abs(value));
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = boxy(positions[i] ?? 0) * half.x;
    positions[i + 1] = Math.max(-0.11, boxy(positions[i + 1] ?? 0) * half.y) + 0.12;
    positions[i + 2] = boxy(positions[i + 2] ?? 0) * half.z;
  }
  const indices = body.getIndices() ?? [];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  body.updateVerticesData(VertexBuffer.PositionKind, positions);
  body.updateVerticesData(VertexBuffer.NormalKind, normals);
  jitter(body, 0.008, 11);
  // A little darker toward the ground, where it got dirty.
  paint(body, (_x, y) => (y < 0.06 ? canvas.scale(0.82) : canvas), 12);

  // The leather flap: over the top half, folded down over the top end; its buckle.
  const flap = strip(
    scene,
    "backpackFlap",
    { width: 0.34, height: 0.025, depth: 0.3 },
    { x: 0, y: 0.255, z: 0.12 },
  );
  const flapEnd = strip(
    scene,
    "backpackFlapEnd",
    { width: 0.34, height: 0.14, depth: 0.025 },
    { x: 0, y: 0.19, z: 0.28 },
  );
  for (const [index, part] of [flap, flapEnd].entries()) {
    paint(part, leather, 13 + index * 10);
  }
  const buckle = strip(
    scene,
    "backpackBuckle",
    { width: 0.06, height: 0.02, depth: 0.05 },
    { x: 0, y: 0.27, z: -0.02 },
  );
  paint(buckle, toColor(CONFIG.palette.brass).scale(0.8), 14);

  // A front pocket below the flap.
  const pocket = MeshBuilder.CreateBox(
    "backpackPocket",
    { width: 0.26, height: 0.05, depth: 0.16 },
    scene,
  );
  pocket.position.set(0, 0.245, -0.14);
  pocket.bakeCurrentTransformIntoVertices();
  jitter(pocket, 0.006, 15);
  paint(pocket, canvas.scale(0.92), 16);

  // The shoulder straps, loose on the ground on either side (a U of three pieces each).
  const straps: Mesh[] = [];
  const strapSize = { width: 0.045, height: 0.012, depth: 0.42 };
  for (const side of [-1, 1]) {
    const x = side * 0.27;
    straps.push(
      strip(scene, "backpackStrap", strapSize, { x, y: 0.006, z: 0.02 }, side * 0.12),
      strip(
        scene,
        "backpackStrapTop",
        { width: 0.1, height: 0.012, depth: 0.045 },
        { x: side * 0.22, y: 0.01, z: 0.22 },
      ),
      strip(
        scene,
        "backpackStrapBottom",
        { width: 0.1, height: 0.012, depth: 0.045 },
        { x: side * 0.24, y: 0.01, z: -0.18 },
      ),
    );
  }
  for (const [index, strap] of straps.entries()) {
    paint(strap, leather.scale(0.8), 17 + index);
  }

  // The fiber roll tied across the bottom.
  const roll = MeshBuilder.CreateCylinder(
    "backpackRoll",
    { height: 0.46, diameter: 0.14, tessellation: 8 },
    scene,
  );
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.07, -0.33);
  roll.bakeCurrentTransformIntoVertices();
  jitter(roll, 0.008, 25);
  paint(roll, fiber, 26);

  return assemble(
    "backpack",
    [body, flap, flapEnd, buckle, pocket, ...straps, roll],
    getPlainMaterial(scene),
  );
}

/** The backpack in the gallery (A2-C). */
export const backpack: ModelGenerator = {
  id: "backpack",
  label: "Mochila",
  create(scene: Scene): GeneratedModel {
    return { root: createBackpackMesh(scene), animations: [] };
  },
};
