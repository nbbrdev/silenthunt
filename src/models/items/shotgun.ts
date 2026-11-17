import { TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { narrow } from "../animals/parts";
import { piecewise, tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Where the barrels hinge on the action (they tip down to reload). */
const HINGE = v(0, -0.012, 0.12);
/** The end of the barrels (the muzzle), in the gun's space. */
export const MUZZLE = v(0, 0, 0.8);

export interface ShotgunModel {
  /** The gun, with the right hand's grip at the origin, pointing toward +Z. */
  root: TransformNode;
  /** The barrels and the fore-end, turning on the hinge. */
  barrels: TransformNode;
  /** Opens the gun to reload (0 closed, 1 fully open). */
  setOpen(open: number): void;
}

/**
 * The double-barrel shotgun (NBB-141, ES2): a wooden stock, a dark steel action and two barrels
 * side by side, with a wooden fore-end under them. The barrels tip down on their hinge to load.
 */
export function createShotgunModel(scene: Scene): ShotgunModel {
  const material = getModelMaterials(scene).fallenWood;
  const wood = toColor(CONFIG.palette.gunWood);
  const steel = toColor(CONFIG.palette.gunSteel);
  const root = new TransformNode("shotgun", scene);

  const stock = tube(
    scene,
    "shotgunStock",
    [v(0, -0.045, -0.36), v(0, -0.02, -0.12), v(0, -0.004, 0.0), v(0, 0, 0.05)],
    (t) => piecewise(t, [0.034, 0.024, 0.017, 0.017]),
    6,
    0.3,
    2,
  );
  narrow(stock, 0.6);
  paint(stock, wood, 1);
  const action = tube(
    scene,
    "shotgunAction",
    [v(0, 0, 0.04), v(0, 0, 0.13)],
    () => 0.024,
    6,
    0.3,
    1,
  );
  narrow(action, 0.85);
  paint(action, steel, 2);
  const guard = tube(
    scene,
    "shotgunGuard",
    [v(0, -0.03, 0.02), v(0, -0.034, 0.07), v(0, -0.02, 0.1)],
    () => 0.004,
    4,
    0.3,
    1,
  );
  paint(guard, steel, 3);
  const body = assemble("shotgunBody", [stock, action, guard], material);
  body.parent = root;

  const barrels = new TransformNode("shotgunHinge", scene);
  barrels.parent = root;
  barrels.position = HINGE.clone();
  const barrelParts: Mesh[] = [];
  for (const x of [-0.012, 0.012]) {
    const barrel = tube(
      scene,
      "shotgunBarrel",
      [v(x, 0.012, 0.12), v(x, 0.012, MUZZLE.z)].map((point) => point.subtract(HINGE)),
      () => 0.011,
      6,
      0.3,
      1,
    );
    paint(barrel, steel, 4);
    barrelParts.push(barrel);
  }
  const foreEnd = tube(
    scene,
    "shotgunForeEnd",
    [v(0, -0.01, 0.16), v(0, -0.012, 0.4)].map((point) => point.subtract(HINGE)),
    (t) => piecewise(t, [0.02, 0.017]),
    6,
    0.3,
    1,
  );
  narrow(foreEnd, 0.8);
  paint(foreEnd, wood, 5);
  barrelParts.push(foreEnd);
  const barrelMesh = assemble("shotgunBarrels", barrelParts, material);
  barrelMesh.parent = barrels;

  return {
    root,
    barrels,
    setOpen(open: number) {
      barrels.rotation.x = open * 0.6;
    },
  };
}

/** The shotgun in the gallery (A2-C). */
export const shotgun: ModelGenerator = {
  id: "shotgun",
  label: "Espingarda",
  create(scene: Scene): GeneratedModel {
    const model = createShotgunModel(scene);
    model.root.position.y = 0.5;
    return { root: model.root, animations: [] };
  },
};
