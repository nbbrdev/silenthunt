import {
  MeshBuilder,
  Quaternion,
  Vector3,
  type Color3,
  type Mesh,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom } from "../../core/random";
import { assemble, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { tileUVs } from "../surfaceTextures";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** The roof's slope (radians): just enough for the rain to run off. */
export const ROOF_TILT = 0.17;

/** The logs of the walls: radius, and the height of one row. */
const LOG_RADIUS = 0.135;
const LOG_ROW = LOG_RADIUS * 2;

/**
 * The building pieces (NBB-145, CN4-A): rustic, like the abandoned cabin. Each one fills one cell
 * of the 2 m grid (RF-52) and stays under 200 triangles (docs/05): logs are plain 5-sided
 * cylinders (20 triangles), planks are boxes (12).
 */
export interface DoorModel {
  /** The frame: the boards on both sides of the door, posts, lintel and the log above. */
  frame: Mesh;
  /** The door itself, built around its hinge (at the left post): turning it opens it. */
  leaf: Mesh;
  /** Where the hinge is, in the frame's space. */
  hinge: Vector3;
}

function logColor(random: () => number): Color3 {
  return toColor(CONFIG.palette.cabinLogs).scale(0.85 + random() * 0.3);
}

function plankColor(random: () => number): Color3 {
  return toColor(CONFIG.palette.cabinRoof).scale(0.85 + random() * 0.3);
}

/** A light log from `from` to `to`: a capped cylinder with few sides. */
function log(
  scene: Scene,
  from: Vector3,
  to: Vector3,
  radius: number,
  color: Color3,
  sides = 5,
): Mesh {
  const along = to.subtract(from);
  const length = along.length();
  const mesh = MeshBuilder.CreateCylinder(
    "log",
    { height: length, diameter: radius * 2, tessellation: sides },
    scene,
  );
  const turn = new Quaternion();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), along.normalize(), turn);
  mesh.rotationQuaternion = turn;
  mesh.position = from.add(to).scale(0.5);
  mesh.bakeCurrentTransformIntoVertices();
  tileUVs(mesh, 1, length / 0.8);
  paint(mesh, color, Math.round(from.y * 100 + from.x * 10));
  return mesh;
}

/** A plank box, painted, ready to merge. */
function plank(scene: Scene, size: Vector3, at: Vector3, color: Color3): Mesh {
  const box = MeshBuilder.CreateBox(
    "plank",
    { width: size.x, height: size.y, depth: size.z },
    scene,
  );
  box.position = at;
  box.bakeCurrentTransformIntoVertices();
  paint(box, color, Math.round(at.x * 100 + at.z * 10 + at.y));
  return box;
}

/**
 * The foundation: a floor of planks on two beams, with log posts at the corners going down 1.3 m
 * (into the ground on the low side, RF-52: up to 1 m of slope). Its top is at y = 0.
 */
export function createFoundationMesh(scene: Scene, seed = 1): Mesh {
  const random = createRandom(seed);
  const half = CONFIG.building.cell / 2;
  const parts: Mesh[] = [];
  const planks = 5;
  const width = (half * 2) / planks;
  for (let i = 0; i < planks; i++) {
    const x = -half + width * (i + 0.5);
    parts.push(plank(scene, v(width * 0.95, 0.08, half * 2), v(x, -0.04, 0), plankColor(random)));
  }
  for (const z of [-half + 0.15, half - 0.15]) {
    parts.push(log(scene, v(-half, -0.17, z), v(half, -0.17, z), 0.09, logColor(random)));
  }
  for (const x of [-half + 0.15, half - 0.15]) {
    for (const z of [-half + 0.15, half - 0.15]) {
      parts.push(log(scene, v(x, -1.3, z), v(x, -0.1, z), 0.1, logColor(random)));
    }
  }
  return assemble("foundation", parts, getModelMaterials(scene).fallenWood);
}

/** A wall of logs along X, 2 m long (a little more, so corners overlap), from y = 0 up. */
export function createWallMesh(scene: Scene, seed = 2): Mesh {
  const random = createRandom(seed);
  const half = CONFIG.building.cell / 2 + 0.1;
  const parts: Mesh[] = [];
  for (let y = LOG_RADIUS; y < CONFIG.building.wallHeight; y += LOG_ROW) {
    parts.push(log(scene, v(-half, y, 0), v(half, y, 0), LOG_RADIUS, logColor(random)));
  }
  return assemble("wall", parts, getModelMaterials(scene).fallenWood);
}

/**
 * A wall with a door: upright boards on both sides of the opening (short logs there would pass
 * the 200-triangle limit), posts, a lintel, logs above, and the plank door.
 */
export function createDoorModel(scene: Scene, seed = 3): DoorModel {
  const random = createRandom(seed);
  const half = CONFIG.building.cell / 2 + 0.1;
  const { wallHeight, doorWidth, doorHeight } = CONFIG.building;
  const opening = doorWidth / 2;
  const parts: Mesh[] = [];
  const side = half - opening;
  const boardHeight = doorHeight + 0.05;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const x = sign * (opening + side * (i + 0.5) * 0.5);
      parts.push(
        plank(
          scene,
          v(side * 0.48, boardHeight, LOG_RADIUS * 1.6),
          v(x, boardHeight / 2, 0),
          logColor(random).scale(0.95),
        ),
      );
    }
    parts.push(
      plank(
        scene,
        v(0.1, boardHeight, LOG_RADIUS * 1.8),
        v(sign * (opening + 0.05), boardHeight / 2, 0),
        logColor(random).scale(0.8),
      ),
    );
  }
  parts.push(
    plank(
      scene,
      v(doorWidth + 0.3, 0.14, LOG_RADIUS * 1.8),
      v(0, doorHeight + 0.07, 0),
      logColor(random).scale(0.8),
    ),
  );
  for (let y = doorHeight + 0.14 + LOG_RADIUS; y < wallHeight + 0.05; y += LOG_ROW) {
    parts.push(log(scene, v(-half, y, 0), v(half, y, 0), LOG_RADIUS, logColor(random)));
  }
  const frame = assemble("doorFrame", parts, getModelMaterials(scene).fallenWood);

  // The door: three upright planks and two battens, from its hinge at x = 0 to x = doorWidth.
  const leafParts: Mesh[] = [];
  const boards = 3;
  const boardWidth = doorWidth / boards;
  for (let i = 0; i < boards; i++) {
    leafParts.push(
      plank(
        scene,
        v(boardWidth * 0.96, doorHeight - 0.06, 0.05),
        v(boardWidth * (i + 0.5), (doorHeight - 0.06) / 2 + 0.02, 0),
        plankColor(random),
      ),
    );
  }
  for (const y of [0.45, doorHeight - 0.45]) {
    leafParts.push(
      plank(
        scene,
        v(doorWidth * 0.9, 0.12, 0.04),
        v(doorWidth / 2, y, 0.045),
        plankColor(random).scale(0.85),
      ),
    );
  }
  const leaf = assemble("doorLeaf", leafParts, getModelMaterials(scene).fallenWood);
  return { frame, leaf, hinge: v(-opening, 0, 0) };
}

/**
 * The roof of one cell: planks tilted by ROOF_TILT (falling toward −Z) on two rafters, a little
 * wider than the cell so neighbors overlap. Centered on the cell, at the top of the walls.
 */
export function createRoofMesh(scene: Scene, seed = 4): Mesh {
  const random = createRandom(seed);
  const half = CONFIG.building.cell / 2 + 0.15;
  const parts: Mesh[] = [];
  const planks = 5;
  const width = (half * 2) / planks;
  for (let i = 0; i < planks; i++) {
    const x = -half + width * (i + 0.5);
    parts.push(plank(scene, v(width * 0.96, 0.05, half * 2), v(x, 0.12, 0), plankColor(random)));
  }
  for (const x of [-half + 0.3, half - 0.3]) {
    parts.push(
      log(scene, v(x, 0.05, -half + 0.1), v(x, 0.05, half - 0.1), 0.06, logColor(random), 4),
    );
  }
  for (const part of parts) {
    part.rotation.x = -ROOF_TILT;
    part.bakeCurrentTransformIntoVertices();
  }
  return assemble("roof", parts, getModelMaterials(scene).fallenWood);
}

/** Gallery entries (A2-C): each piece on its own; the foundation lifted to be seen. */
function galleryPiece(
  id: string,
  label: string,
  build: (scene: Scene) => TransformNode,
): ModelGenerator {
  return {
    id,
    label,
    create(scene: Scene): GeneratedModel {
      return { root: build(scene), animations: [] };
    },
  };
}

export const foundationPiece = galleryPiece("foundation", "Fundação", (scene) => {
  const mesh = createFoundationMesh(scene);
  mesh.position.y = 1.3;
  return mesh;
});
export const wallPiece = galleryPiece("wall", "Parede", (scene) => createWallMesh(scene));
export const doorPiece = galleryPiece("door", "Porta", (scene) => {
  const door = createDoorModel(scene);
  door.leaf.parent = door.frame;
  door.leaf.position = door.hinge.clone();
  door.leaf.rotation.y = -0.6;
  return door.frame;
});
export const roofPiece = galleryPiece("roof", "Telhado", (scene) => createRoofMesh(scene));
