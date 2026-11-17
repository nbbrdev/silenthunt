import { MeshBuilder, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom } from "../../core/random";
import { CABIN_SIZE } from "../../world/cabinSites";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { tube } from "../rig/skin";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Logs: their radius and the height between one row and the next (meters). */
const LOG_RADIUS = 0.12;
const LOG_STEP = 0.24;
/** The walls go below the floor, hiding the cabin's base on uneven ground. */
const WALL_BOTTOM = -0.75;
const RIDGE_HEIGHT = CABIN_SIZE.ridgeHeight;
const EAVE_HEIGHT = 2.0;
const ROOF_OVERHANG = 0.4;

export interface CabinModel {
  /** Walls, roof, floor and table (one mesh), standing on its floor at y = 0, door toward +Z. */
  body: Mesh;
  /** The chest (base) and its lid, which turns open on its hinge. */
  chest: Mesh;
  lid: Mesh;
  /** Where the lid's hinge is, and the middle of the chest and of the table top. */
  lidHinge: Vector3;
  chestCenter: Vector3;
  tableTop: Vector3;
}

/** Where the furniture stands inside (cabin space). */
const TABLE = v(-1.1, 0, -0.85);
const CHEST = v(1.15, 0, -0.95);

/**
 * An abandoned log cabin (NBB-141, ES1): small, weathered, half ruined (a hole in the roof,
 * missing logs at the back, a door gap without a door, a window), with a table and a chest.
 */
export function createCabinModel(scene: Scene, seed: number): CabinModel {
  const random = createRandom(seed);
  const material = getModelMaterials(scene).fallenWood;
  const logColor = toColor(CONFIG.palette.cabinLogs);
  const roofColor = toColor(CONFIG.palette.cabinRoof);
  const { halfWidth, halfDepth, wallHeight, doorHalfWidth, doorHeight } = CABIN_SIZE;
  const parts: Mesh[] = [];

  const log = (from: Vector3, to: Vector3) => {
    const mesh = tube(scene, "cabinLog", [from, to], () => LOG_RADIUS, 6, 0.8, 1);
    paint(mesh, logColor.scale(0.85 + random() * 0.3), Math.floor(random() * 1000));
    parts.push(mesh);
  };

  // --- Walls: rows of logs, the side walls half a log higher so the corners interlock.
  const overhang = 0.25;
  for (let y = WALL_BOTTOM; y <= wallHeight; y += LOG_STEP) {
    // Front wall (+Z), with the door gap.
    const front = halfDepth;
    if (y > -0.05 && y < doorHeight) {
      log(v(-halfWidth - overhang, y, front), v(-doorHalfWidth, y, front));
      log(v(doorHalfWidth, y, front), v(halfWidth + overhang, y, front));
    } else {
      log(v(-halfWidth - overhang, y, front), v(halfWidth + overhang, y, front));
    }
    // Back wall (−Z): its top two rows have fallen in at one end (ruined).
    const back = -halfDepth;
    const ruined = y > wallHeight - LOG_STEP * 2;
    log(v(-halfWidth - overhang, y, back), v(ruined ? 0.5 : halfWidth + overhang, y, back));

    const side = y + LOG_STEP / 2;
    if (side > wallHeight) {
      continue;
    }
    // Left wall (−X), solid.
    log(v(-halfWidth, side, -halfDepth - overhang), v(-halfWidth, side, halfDepth + overhang));
    // Right wall (+X), with a window.
    if (side > 0.9 && side < 1.55) {
      log(v(halfWidth, side, -halfDepth - overhang), v(halfWidth, side, -0.35));
      log(v(halfWidth, side, 0.35), v(halfWidth, side, halfDepth + overhang));
    } else {
      log(v(halfWidth, side, -halfDepth - overhang), v(halfWidth, side, halfDepth + overhang));
    }
  }
  // Gables: shorter and shorter logs up to the ridge, on both side walls.
  for (let y = wallHeight + LOG_STEP / 2; y < RIDGE_HEIGHT - 0.1; y += LOG_STEP) {
    const half = halfDepth * (1 - (y - wallHeight) / (RIDGE_HEIGHT - wallHeight));
    for (const x of [-halfWidth, halfWidth]) {
      log(v(x, y, -half), v(x, y, half));
    }
  }

  // --- Roof: planks from the eaves to the ridge; a few are missing on the back slope (a hole).
  const plankWidth = 0.32;
  const slopeRun = halfDepth + ROOF_OVERHANG;
  const slopeRise = RIDGE_HEIGHT - EAVE_HEIGHT;
  const slopeLength = Math.hypot(slopeRun, slopeRise);
  const tilt = Math.atan2(slopeRise, slopeRun);
  for (const sideSign of [1, -1]) {
    for (let x = -halfWidth - 0.3; x < halfWidth + 0.3; x += plankWidth) {
      if (sideSign < 0 && x > 0.1 && x < 1.1) {
        continue;
      }
      const plank = MeshBuilder.CreateBox(
        "cabinPlank",
        { width: plankWidth * 0.95, height: 0.05, depth: slopeLength },
        scene,
      );
      plank.rotation.x = tilt * sideSign;
      plank.position = v(
        x + plankWidth / 2,
        (RIDGE_HEIGHT + EAVE_HEIGHT) / 2 + 0.12,
        (sideSign * slopeRun) / 2,
      );
      plank.bakeCurrentTransformIntoVertices();
      paint(plank, roofColor.scale(0.85 + random() * 0.3), Math.floor(random() * 1000));
      parts.push(plank);
    }
  }

  // --- Floor.
  const floor = MeshBuilder.CreateBox(
    "cabinFloor",
    { width: halfWidth * 2, height: 0.08, depth: halfDepth * 2 },
    scene,
  );
  // Its top 2 cm above y = 0, so it does not flicker against the flattened ground.
  floor.position.y = -0.02;
  floor.bakeCurrentTransformIntoVertices();
  paint(floor, logColor.scale(0.7), 7);
  parts.push(floor);

  // --- Table: a top on four legs.
  const tableTop = TABLE.add(v(0, 0.75, 0));
  const top = MeshBuilder.CreateBox("cabinTable", { width: 1.1, height: 0.05, depth: 0.6 }, scene);
  top.position = tableTop.clone();
  top.bakeCurrentTransformIntoVertices();
  paint(top, logColor.scale(0.8), 8);
  parts.push(top);
  for (const [dx, dz] of [
    [-0.48, -0.24],
    [0.48, -0.24],
    [-0.48, 0.24],
    [0.48, 0.24],
  ] as const) {
    const leg = MeshBuilder.CreateBox(
      "cabinTableLeg",
      { width: 0.05, height: 0.75, depth: 0.05 },
      scene,
    );
    leg.position = TABLE.add(v(dx, 0.375, dz));
    leg.bakeCurrentTransformIntoVertices();
    paint(leg, logColor.scale(0.7), 9);
    parts.push(leg);
  }

  const body = assemble("cabin", parts, material);

  // --- Chest: dark wood with iron bands, and a lid that opens.
  const chestWood = toColor(CONFIG.palette.chestWood);
  const iron = toColor(CONFIG.palette.darkMetal);
  const chestParts: Mesh[] = [];
  const base = MeshBuilder.CreateBox("chestBase", { width: 0.8, height: 0.42, depth: 0.46 }, scene);
  base.position = CHEST.add(v(0, 0.21, 0));
  base.bakeCurrentTransformIntoVertices();
  paint(base, chestWood, 10);
  chestParts.push(base);
  for (const dx of [-0.28, 0.28]) {
    const band = MeshBuilder.CreateBox(
      "chestBand",
      { width: 0.05, height: 0.43, depth: 0.47 },
      scene,
    );
    band.position = CHEST.add(v(dx, 0.21, 0));
    band.bakeCurrentTransformIntoVertices();
    paint(band, iron, 11);
    chestParts.push(band);
  }
  const chest = assemble("chest", chestParts, material);

  // The lid is built around its hinge (the top back edge), so turning it opens it.
  const lidHinge = CHEST.add(v(0, 0.42, -0.23));
  const lidParts: Mesh[] = [];
  const lidBoard = MeshBuilder.CreateBox(
    "chestLid",
    { width: 0.82, height: 0.1, depth: 0.48 },
    scene,
  );
  lidBoard.position = v(0, 0.05, 0.24);
  lidBoard.bakeCurrentTransformIntoVertices();
  paint(lidBoard, chestWood.scale(1.1), 12);
  lidParts.push(lidBoard);
  for (const dx of [-0.28, 0.28]) {
    const band = MeshBuilder.CreateBox(
      "chestLidBand",
      { width: 0.05, height: 0.11, depth: 0.49 },
      scene,
    );
    band.position = v(dx, 0.05, 0.24);
    band.bakeCurrentTransformIntoVertices();
    paint(band, iron, 13);
    lidParts.push(band);
  }
  const lid = assemble("chestLid", lidParts, material);

  return {
    body,
    chest,
    lid,
    lidHinge,
    chestCenter: CHEST.add(v(0, 0.21, 0)),
    tableTop: tableTop.add(v(0, 0.03, 0)),
  };
}

/** The cabin in the gallery (A2-C), with the chest closed. */
export const cabin: ModelGenerator = {
  id: "cabin",
  label: "Cabana",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("cabinRoot", scene);
    const model = createCabinModel(scene, seed);
    for (const mesh of [model.body, model.chest, model.lid]) {
      mesh.parent = root;
    }
    model.lid.position = model.lidHinge.clone();
    root.position.y = -WALL_BOTTOM;
    return { root, animations: [] };
  },
};
