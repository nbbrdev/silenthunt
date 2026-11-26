import {
  Color3,
  MeshBuilder,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { HuntKind } from "../../ai/huntable";
import { CONFIG } from "../../config";
import { createRandom } from "../../core/random";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getBoneMaterial } from "../materials";
import { tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";
import { getFurMaterial } from "./parts";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Every animal's remains are the deer's, smaller or bigger. */
const SCALE: Record<HuntKind, number> = {
  deer: 1,
  rabbit: 0.3,
  fox: 0.5,
  wolf: 0.85,
  boar: 0.9,
  bear: 1.3,
};

const FUR: Record<
  HuntKind,
  "deerFur" | "rabbitFur" | "foxFur" | "wolfFur" | "boarFur" | "bearFur"
> = {
  deer: "deerFur",
  rabbit: "rabbitFur",
  fox: "foxFur",
  wolf: "wolfFur",
  boar: "boarFur",
  bear: "bearFur",
};

export interface RemainsModel {
  root: TransformNode;
  /** The pelt (fur material) and the bones (plain material): two meshes to instance. */
  hide: Mesh;
  bones: Mesh;
}

/**
 * What is left of a cleaned carcass (NBB-142, CA3-B): the pelt spread on the ground with a dark
 * stain, the spine with a few ribs curving up, the hip, the skull and some leg bones scattered
 * around. Built in model space for a deer (about 1.4 m) and scaled down for a rabbit.
 */
export function createRemainsModel(scene: Scene, kind: HuntKind, seed: number): RemainsModel {
  const random = createRandom(seed);
  const root = new TransformNode(`remains-${kind}`, scene);
  const fur = toColor(CONFIG.palette[FUR[kind]]);
  const blood = toColor(CONFIG.palette.blood);
  const boneColor = toColor(CONFIG.palette.bone);

  // --- The pelt: a flat, ragged sheet, stained dark in the middle.
  const pelt = MeshBuilder.CreateSphere("remainsHide", { diameter: 1, segments: 6 }, scene);
  pelt.scaling.set(1.3, 0.05, 0.85);
  pelt.position.y = 0.02;
  pelt.bakeCurrentTransformIntoVertices();
  jitter(pelt, 0.07, 5);
  paint(
    pelt,
    (x, _y, z) => {
      const stain = Math.max(0, 1 - Math.hypot(x / 0.45, z / 0.3));
      return Color3.Lerp(fur, blood, Math.min(1, stain * 1.6));
    },
    6,
  );
  const hide = assemble(`remainsHide-${kind}`, [pelt], getFurMaterial(scene));
  hide.parent = root;

  // --- Bones.
  const parts: Mesh[] = [];
  const bone = (points: Vector3[], radius: number, sides = 5) => {
    const mesh = tube(scene, "remainsBone", points, () => radius, sides, 0.3, 1);
    paint(mesh, boneColor.scale(0.88 + random() * 0.12), parts.length);
    parts.push(mesh);
  };
  // Spine, from the hip to the neck.
  bone([v(-0.5, 0.07, 0), v(0, 0.09, 0), v(0.45, 0.08, 0)], 0.022, 6);
  // Ribs curving up like a cage; a few are missing.
  for (const x of [-0.15, -0.05, 0.05, 0.15, 0.25, 0.33]) {
    for (const side of [-1, 1]) {
      if (random() < 0.2) {
        continue;
      }
      const lean = (random() - 0.5) * 0.04;
      bone(
        [
          v(x, 0.09, 0),
          v(x + lean, 0.2, side * 0.13),
          v(x + lean, 0.3, side * 0.1),
          v(x + lean * 2, 0.33, side * 0.04),
        ],
        0.01,
        4,
      );
    }
  }
  // Leg bones thrown around the pelt.
  bone([v(-0.3, 0.03, 0.45), v(0.1, 0.035, 0.52)], 0.018);
  bone([v(0.2, 0.03, -0.45), v(0.55, 0.03, -0.36)], 0.016);
  bone([v(-0.72, 0.03, -0.18), v(-0.6, 0.03, -0.5)], 0.017);

  // Hip and skull.
  const hip = MeshBuilder.CreateSphere("remainsHip", { diameter: 1, segments: 3 }, scene);
  hip.scaling.set(0.16, 0.08, 0.18);
  hip.position.set(-0.55, 0.07, 0);
  hip.bakeCurrentTransformIntoVertices();
  jitter(hip, 0.015, 7);
  paint(hip, boneColor.scale(0.9), 8);
  parts.push(hip);
  const skull = MeshBuilder.CreateSphere("remainsSkull", { diameter: 1, segments: 4 }, scene);
  skull.scaling.set(0.26, 0.1, 0.11);
  skull.rotation.y = 0.35;
  skull.position.set(0.66, 0.06, 0.08);
  skull.bakeCurrentTransformIntoVertices();
  jitter(skull, 0.012, 9);
  paint(skull, boneColor, 10);
  parts.push(skull);
  const bones = assemble(`remainsBones-${kind}`, parts, getBoneMaterial(scene));
  bones.parent = root;

  root.scaling.setAll(SCALE[kind]);
  return { root, hide, bones };
}

/** The deer's and the rabbit's remains side by side, in the gallery (A2-C). */
export const remains: ModelGenerator = {
  id: "remains",
  label: "Restos de carcaça",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("remainsRoot", scene);
    const deerRemains = createRemainsModel(scene, "deer", seed);
    deerRemains.root.parent = root;
    deerRemains.root.position.x = -0.4;
    const rabbitRemains = createRemainsModel(scene, "rabbit", seed);
    rabbitRemains.root.parent = root;
    rabbitRemains.root.position.set(0.75, 0, 0.3);
    return { root, animations: [] };
  },
};
