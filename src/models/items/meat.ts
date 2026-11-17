import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getBoneMaterial } from "../materials";
import { tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

export interface MeatModel {
  /** The flesh (its own material, so it can cook at its own pace); the bone is its child. */
  flesh: Mesh;
  /** Sets how cooked it looks: 0 raw red, 1 cooked brown (CZ2-A). */
  setCooked(cooked: number): void;
}

/**
 * A piece of meat (NBB-142, CZ3): a lumpy chunk of a leg, about 15 cm, with a pale strip of fat
 * and the bone sticking out of one end. The flesh's vertices are painted light and its material
 * gives the color, so the same mesh goes from raw to cooked; the bone keeps its own color.
 */
export function createMeatModel(scene: Scene, name = "meat"): MeatModel {
  const body = MeshBuilder.CreateSphere(`${name}Body`, { diameter: 1, segments: 4 }, scene);
  body.scaling.set(0.13, 0.075, 0.085);
  body.bakeCurrentTransformIntoVertices();
  jitter(body, 0.007, 3);
  paint(body, new Color3(0.9, 0.9, 0.9), 1);

  const fat = MeshBuilder.CreateSphere(`${name}Fat`, { diameter: 1, segments: 3 }, scene);
  fat.scaling.set(0.1, 0.03, 0.03);
  fat.position.set(-0.005, 0.024, 0.026);
  fat.bakeCurrentTransformIntoVertices();
  // Lighter vertices: under the meat's tint it stays paler than the rest.
  paint(fat, toColor(CONFIG.palette.meatFat).scale(1.6), 2);

  const material = new StandardMaterial(`${name}Material`, scene);
  // A little shine: raw meat is wet.
  material.specularColor = new Color3(0.12, 0.1, 0.1);
  material.specularPower = 24;
  const flesh = assemble(name, [body, fat], material);

  const boneColor = toColor(CONFIG.palette.bone);
  const shaft = tube(
    scene,
    `${name}Bone`,
    [v(0.04, 0, 0), v(0.11, 0.004, 0)],
    () => 0.011,
    5,
    0.3,
    1,
  );
  paint(shaft, boneColor, 3);
  const knob = MeshBuilder.CreateSphere(`${name}Knob`, { diameter: 0.032, segments: 3 }, scene);
  knob.position.set(0.115, 0.004, 0);
  knob.bakeCurrentTransformIntoVertices();
  paint(knob, boneColor, 4);
  const bone = assemble(`${name}Bone`, [shaft, knob], getBoneMaterial(scene));
  bone.parent = flesh;

  const setCooked = (cooked: number) => {
    material.diffuseColor = meatColor(cooked);
  };
  setCooked(0);
  return { flesh, setCooked };
}

/** The meat's color, from raw (0) to cooked (1). */
export function meatColor(cooked: number): Color3 {
  const t = Math.min(1, Math.max(0, cooked));
  return Color3.Lerp(toColor(CONFIG.palette.meatRaw), toColor(CONFIG.palette.meatCooked), t);
}

/** Raw and cooked meat side by side, in the gallery (A2-C). */
export const meat: ModelGenerator = {
  id: "meat",
  label: "Carne",
  create(scene: Scene): GeneratedModel {
    const root = new TransformNode("meatRoot", scene);
    const raw = createMeatModel(scene, "meatRaw");
    raw.flesh.parent = root;
    raw.flesh.position = v(-0.06, 0.04, -0.09);
    const cooked = createMeatModel(scene, "meatCooked");
    cooked.flesh.parent = root;
    cooked.flesh.position = v(-0.06, 0.04, 0.09);
    cooked.setCooked(1);
    return { root, animations: [] };
  },
};
