import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type LinesMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, paint, toColor } from "../lowPoly";
import { piecewise, tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** How far behind the grip the string sits when the bow is at rest (brace height, meters). */
export const BRACE_HEIGHT = 0.12;
/**
 * How far back the string comes at full draw, in the hands' space (meters). Shorter than a real
 * draw: a hand pulled all the way to the cheek would cover the screen.
 */
export const DRAW_LENGTH = 0.14;

export interface BowModel {
  /** The bow, with its grip at the origin, standing along Y, shooting toward +Z. */
  root: TransformNode;
  /** Moves the string to `draw` (0 = at rest, 1 = fully drawn). */
  setDraw(draw: number): void;
}

/**
 * The bow (NBB-140, AR6): a ~1.2 m stave of dark wood, thick at the grip and thin at the tips,
 * which curve back toward the archer, and a pale string. Built around the grip, so the left fist
 * holds it at the origin.
 */
export function createBowModel(scene: Scene): BowModel {
  const root = new TransformNode("bow", scene);
  const half = CONFIG.bow.bowLength / 2;
  const points: Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const y = -half + t * half * 2;
    points.push(v(0, y, -BRACE_HEIGHT * (y / half) ** 2));
  }
  const stave = tube(
    scene,
    "bowStave",
    points,
    (t) => piecewise(t, [0.008, 0.013, 0.017, 0.02, 0.022, 0.02, 0.017, 0.013, 0.008]),
    6,
    0.2,
    1,
  );
  paint(
    stave,
    (_x, y) =>
      Math.abs(y) < 0.07
        ? toColor(CONFIG.palette.bowWood).scale(0.55)
        : toColor(CONFIG.palette.bowWood),
    1,
  );
  const mesh = assemble("bowStave", [stave], getItemMaterial(scene));
  mesh.parent = root;

  const top = v(0, half, -BRACE_HEIGHT);
  const bottom = v(0, -half, -BRACE_HEIGHT);
  const nock = v(0, 0, -BRACE_HEIGHT);
  let string: LinesMesh = MeshBuilder.CreateLines(
    "bowString",
    { points: [top, nock, bottom], updatable: true },
    scene,
  );
  string.color = toColor(CONFIG.palette.bowString);
  string.parent = root;

  return {
    root,
    setDraw(draw: number) {
      nock.z = -BRACE_HEIGHT - draw * DRAW_LENGTH;
      string = MeshBuilder.CreateLines("bowString", {
        points: [top, nock, bottom],
        instance: string,
      });
    },
  };
}

/**
 * The arrow (AR6): a ~70 cm shaft with a stone tip and three feathers, built along +Z from the
 * nock. One mesh is created and every arrow in the world is an instance of it.
 */
export function createArrowMesh(scene: Scene): Mesh {
  const length = CONFIG.bow.arrowLength;
  const parts: Mesh[] = [];
  const shaft = tube(
    scene,
    "arrowShaft",
    [v(0, 0, 0), v(0, 0, length - 0.05)],
    () => 0.0045,
    5,
    0.2,
    1,
  );
  paint(shaft, toColor(CONFIG.palette.arrowShaft), 1);
  parts.push(shaft);

  const tip = tube(
    scene,
    "arrowTip",
    [v(0, 0, length - 0.06), v(0, 0, length - 0.03), v(0, 0, length)],
    (t) => piecewise(t, [0.006, 0.012, 0.0005]),
    4,
    0.2,
    1,
  );
  tip.scaling.y = 0.4;
  tip.bakeCurrentTransformIntoVertices();
  paint(tip, toColor(CONFIG.palette.arrowTip), 2);
  parts.push(tip);

  for (let i = 0; i < 3; i++) {
    const feather = tube(
      scene,
      `arrowFeather${i}`,
      [v(0, 0, 0.02), v(0, 0, 0.12)],
      (t) => piecewise(t, [0.004, 0.016, 0.01]),
      4,
      0.2,
      1,
    );
    feather.scaling.x = 0.12;
    feather.rotation.z = (i * Math.PI * 2) / 3;
    feather.bakeCurrentTransformIntoVertices();
    paint(feather, toColor(CONFIG.palette.arrowFeathers), 3 + i);
    parts.push(feather);
  }
  return assemble("arrow", parts, getItemMaterial(scene));
}

const materialByScene = new WeakMap<Scene, StandardMaterial>();

/** Plain vertex colors, slightly matte (wood, stone, feathers). */
function getItemMaterial(scene: Scene): StandardMaterial {
  const existing = materialByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("huntingItem", scene);
  material.specularColor = new Color3(0.06, 0.06, 0.06);
  materialByScene.set(scene, material);
  return material;
}

/** The bow in the gallery (A2-C), drawn halfway. */
export const bow: ModelGenerator = {
  id: "bow",
  label: "Arco",
  create(scene: Scene): GeneratedModel {
    const model = createBowModel(scene);
    model.setDraw(0.5);
    model.root.position.y = 0.8;
    return { root: model.root, animations: [] };
  },
};

/** The arrow in the gallery (A2-C). */
export const arrow: ModelGenerator = {
  id: "arrow",
  label: "Flecha",
  create(scene: Scene): GeneratedModel {
    const mesh = createArrowMesh(scene);
    mesh.position.y = 0.3;
    return { root: mesh, animations: [] };
  },
};
