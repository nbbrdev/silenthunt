import { Color3, MeshBuilder, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom } from "../../core/random";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getBoneMaterial, getModelMaterials, getPlainMaterial } from "../materials";
import { tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * A bundle of plant fiber (NBB-143, IN6-B): a dozen thin strands about 26 cm long, pulled from a
 * bush, tied in the middle. Lies along Z.
 */
export function createFiberMesh(scene: Scene, seed = 1): Mesh {
  const random = createRandom(seed);
  const color = toColor(CONFIG.palette.fiber);
  const parts: Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const spread = () => (random() - 0.5) * 0.05;
    const mid = v(spread() * 0.3, spread() * 0.3, 0);
    const strand = tube(
      scene,
      "fiberStrand",
      [v(spread(), spread(), -0.13), mid, v(spread(), spread(), 0.13 + random() * 0.02)],
      () => 0.0025,
      3,
      0.3,
      2,
    );
    paint(strand, color.scale(0.8 + random() * 0.35), i);
    parts.push(strand);
  }
  // The knot holding it together.
  const knot = MeshBuilder.CreateTorus(
    "fiberKnot",
    { diameter: 0.022, thickness: 0.006, tessellation: 8 },
    scene,
  );
  knot.rotation.x = Math.PI / 2;
  knot.bakeCurrentTransformIntoVertices();
  paint(knot, color.scale(0.6), 20);
  parts.push(knot);
  return assemble("fiber", parts, getPlainMaterial(scene));
}

/** A lump of animal fat (PG2-A, IN6-B): pale, soft and a little glossy, about 8 cm. */
export function createFatMesh(scene: Scene): Mesh {
  const lump = MeshBuilder.CreateSphere("fatLump", { diameter: 1, segments: 4 }, scene);
  lump.scaling.set(0.085, 0.045, 0.065);
  lump.bakeCurrentTransformIntoVertices();
  jitter(lump, 0.008, 4);
  const fat = toColor(CONFIG.palette.fat);
  const blood = toColor(CONFIG.palette.meatRaw);
  // A few pinkish streaks where it was cut off.
  paint(lump, (x, y) => (Math.sin(x * 90 + y * 60) > 0.7 ? Color3.Lerp(fat, blood, 0.35) : fat), 5);
  return assemble("fat", [lump], getBoneMaterial(scene));
}

/** A rolled-up hide (CA4-A, IN6-B): tanned leather tied with a strap, about 24 cm. Lies along Z. */
export function createLeatherMesh(scene: Scene): Mesh {
  const leather = toColor(CONFIG.palette.leather);
  const roll = MeshBuilder.CreateCylinder(
    "leatherRoll",
    { height: 0.24, diameterTop: 0.075, diameterBottom: 0.085, tessellation: 9 },
    scene,
  );
  roll.rotation.x = Math.PI / 2;
  roll.bakeCurrentTransformIntoVertices();
  jitter(roll, 0.006, 6);
  paint(roll, leather, 7);
  // The loose edge of the hide, lying along the roll.
  const flap = MeshBuilder.CreateBox(
    "leatherFlap",
    { width: 0.05, height: 0.006, depth: 0.22 },
    scene,
  );
  flap.position.set(0.035, -0.03, 0);
  flap.rotation.z = -0.5;
  flap.bakeCurrentTransformIntoVertices();
  paint(flap, leather.scale(0.85), 8);
  const strap = MeshBuilder.CreateTorus(
    "leatherStrap",
    { diameter: 0.088, thickness: 0.008, tessellation: 10 },
    scene,
  );
  strap.rotation.x = Math.PI / 2;
  strap.bakeCurrentTransformIntoVertices();
  paint(strap, leather.scale(0.55), 9);
  return assemble("leather", [roll, flap, strap], getPlainMaterial(scene));
}

/** A shotgun cartridge (RF-34, IN6-B): red shell with a brass base, about 7 cm. Lies along Z. */
export function createCartridgeMesh(scene: Scene): Mesh {
  const shell = MeshBuilder.CreateCylinder(
    "cartridgeShell",
    { height: 0.058, diameter: 0.019, tessellation: 10 },
    scene,
  );
  shell.rotation.x = Math.PI / 2;
  shell.position.z = 0.008;
  shell.bakeCurrentTransformIntoVertices();
  paint(shell, toColor(CONFIG.palette.cartridgeShell), 10);
  const base = MeshBuilder.CreateCylinder(
    "cartridgeBase",
    { height: 0.016, diameter: 0.021, tessellation: 10 },
    scene,
  );
  base.rotation.x = Math.PI / 2;
  base.position.z = -0.029;
  base.bakeCurrentTransformIntoVertices();
  paint(base, toColor(CONFIG.palette.brass), 11);
  return assemble("cartridge", [shell, base], getBoneMaterial(scene));
}

/**
 * A piece of split wood (NBB-144, MC2): a log quarter about 40 cm long along Z, bark on the round
 * side and light fresh wood on the split faces and the ends.
 */
export function createWoodMesh(scene: Scene): Mesh {
  // A three-sided prism reads as a split quarter of a log.
  const piece = MeshBuilder.CreateCylinder(
    "woodPiece",
    { height: 0.4, diameter: 0.13, tessellation: 5, arc: 0.35, enclose: true },
    scene,
  );
  piece.rotation.x = Math.PI / 2;
  piece.bakeCurrentTransformIntoVertices();
  jitter(piece, 0.004, 12);
  const bark = toColor(CONFIG.palette.bark);
  const wood = toColor(CONFIG.palette.cutWood);
  // The bark is only on the outside of the round side; the rest is cut wood.
  paint(piece, (x, y, z) => (Math.hypot(x, y) > 0.055 && Math.abs(z) < 0.19 ? bark : wood), 13);
  return assemble("wood", [piece], getModelMaterials(scene).fallenWood);
}

/** Gallery entries (A2-C): one per new item, lifted a little off the ground. */
function galleryItem(id: string, label: string, build: (scene: Scene) => Mesh): ModelGenerator {
  return {
    id,
    label,
    create(scene: Scene): GeneratedModel {
      const mesh = build(scene);
      mesh.position.y = 0.06;
      return { root: mesh, animations: [] };
    },
  };
}

export const fiber = galleryItem("fiber", "Fibra", (scene) => createFiberMesh(scene));
export const fat = galleryItem("fat", "Gordura", createFatMesh);
export const leather = galleryItem("leather", "Couro", createLeatherMesh);
export const cartridge = galleryItem("cartridge", "Cartucho", createCartridgeMesh);
export const wood = galleryItem("wood", "Madeira", createWoodMesh);
