import { Color3, StandardMaterial, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, paint, toColor } from "../lowPoly";
import { piecewise, tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The knife (NBB-139, MA2): an ~18 cm worn steel blade and a dark wooden handle. Built along +Z
 * from the end of the handle, so the hand holds it near the origin and the blade points ahead.
 */
export function createKnifeMesh(scene: Scene): Mesh {
  const { bladeLength, handleLength } = CONFIG.knife;
  const parts: Mesh[] = [];

  // Blade: a tapered four-sided tube squashed flat, so it has an edge and a point.
  const blade = tube(
    scene,
    "knifeBlade",
    [
      v(0, 0, handleLength),
      v(0, 0.002, handleLength + bladeLength * 0.6),
      v(0, 0.006, handleLength + bladeLength),
    ],
    (t) => piecewise(t, [0.016, 0.015, 0.0005]),
    4,
    0.2,
    3,
  );
  blade.scaling.x = 0.18;
  blade.bakeCurrentTransformIntoVertices();
  paint(blade, toColor(CONFIG.palette.knifeBlade), 1);
  parts.push(blade);

  const guard = tube(
    scene,
    "knifeGuard",
    [v(0, -0.022, handleLength), v(0, 0.022, handleLength)],
    () => 0.006,
    5,
    0.2,
    1,
  );
  paint(guard, toColor(CONFIG.palette.knifeBlade).scale(0.7), 2);
  parts.push(guard);

  const handle = tube(
    scene,
    "knifeHandle",
    [v(0, 0, 0), v(0, 0, handleLength * 0.5), v(0, 0, handleLength)],
    (t) => piecewise(t, [0.012, 0.014, 0.012]),
    6,
    0.2,
    1,
  );
  handle.scaling.x = 0.8;
  handle.bakeCurrentTransformIntoVertices();
  paint(handle, toColor(CONFIG.palette.knifeHandle), 3);
  parts.push(handle);

  return assemble("knife", parts, getKnifeMaterial(scene));
}

const materialByScene = new WeakMap<Scene, StandardMaterial>();

/** Vertex colors with a little shine, so the blade catches the torchlight. */
function getKnifeMaterial(scene: Scene): StandardMaterial {
  const existing = materialByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("knife", scene);
  material.specularColor = new Color3(0.35, 0.35, 0.35);
  material.specularPower = 48;
  materialByScene.set(scene, material);
  return material;
}

/** The knife in the gallery (A2-C). */
export const knife: ModelGenerator = {
  id: "knife",
  label: "Faca",
  create(scene: Scene): GeneratedModel {
    const mesh = createKnifeMesh(scene);
    return { root: mesh, animations: [] };
  },
};
