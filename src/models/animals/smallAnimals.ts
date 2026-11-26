import {
  Animation,
  AnimationGroup,
  type Color3,
  MeshBuilder,
  TransformNode,
  type InstancedMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, bake, paint, toColor } from "../lowPoly";
import { getPlainMaterial } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/**
 * NBB-166 (AV7-A): the small animals (birds, fish, frogs). Each is a few simple parts on nodes
 * that the game moves by itself (wings beating, a tail waving, legs kicking). The parts' shapes
 * are made once per scene and every animal shows them as instances, so a flock or a school costs
 * almost nothing to draw.
 */

function part(
  mesh: Mesh,
  color: Color3 | ((x: number, y: number, z: number) => Color3),
  seed: number,
): Mesh {
  bake(mesh);
  paint(mesh, color, seed);
  return mesh;
}

/** Joins parts into one hidden source mesh, to be shown through instances. */
function source(name: string, parts: Mesh[], scene: Scene): Mesh {
  const mesh = assemble(name, parts, getPlainMaterial(scene));
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}

function show(mesh: Mesh, name: string, parent: TransformNode): InstancedMesh {
  const instance = mesh.createInstance(name);
  instance.parent = parent;
  instance.isPickable = false;
  return instance;
}

// --- Bird ------------------------------------------------------------------------------------

interface BirdSources {
  body: Mesh;
  head: Mesh;
  wing: Mesh;
}

const birdSources = new WeakMap<Scene, BirdSources>();

function getBirdSources(scene: Scene): BirdSources {
  const existing = birdSources.get(scene);
  if (existing) {
    return existing;
  }
  const palette = CONFIG.palette;
  const brown = toColor(palette.birdBody);
  const breast = toColor(palette.birdBreast);
  const dark = toColor(palette.animalDark);

  const torso = MeshBuilder.CreateSphere("birdTorso", { diameter: 1, segments: 4 }, scene);
  torso.scaling.set(0.07, 0.065, 0.12);
  torso.position.set(0, 0.07, 0);
  const tail = MeshBuilder.CreateSphere("birdTail", { diameter: 1, segments: 3 }, scene);
  tail.scaling.set(0.03, 0.006, 0.07);
  tail.position.set(0, 0.08, -0.075);
  tail.rotation.x = -0.25;
  const legs = [-1, 1].map((s) => {
    const leg = MeshBuilder.CreateCylinder(
      "birdLeg",
      { height: 0.04, diameter: 0.006, tessellation: 3 },
      scene,
    );
    leg.position.set(0.015 * s, 0.02, 0.01);
    return leg;
  });
  const body = source(
    "birdBody",
    [
      part(torso, (_x, y) => (y < 0.06 ? breast : brown), 1),
      part(tail, brown.scale(0.8), 2),
      ...legs.map((leg, i) => part(leg, dark, 3 + i)),
    ],
    scene,
  );

  // The head, around its own pivot (the neck), with a short dark beak.
  const skull = MeshBuilder.CreateSphere("birdSkull", { diameter: 0.05, segments: 4 }, scene);
  skull.position.set(0, 0.01, 0.01);
  const beak = MeshBuilder.CreateCylinder(
    "birdBeak",
    { height: 0.025, diameterTop: 0, diameterBottom: 0.012, tessellation: 4 },
    scene,
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.008, 0.042);
  const head = source("birdHead", [part(skull, brown, 5), part(beak, dark, 6)], scene);

  // One wing from the shoulder outward along +X (the right one is mirrored by its node): a thin
  // rounded blade, so the folded wing hugs the body instead of sticking out like a plank.
  const wingShape = MeshBuilder.CreateSphere("birdWing", { diameter: 1, segments: 4 }, scene);
  wingShape.scaling.set(0.11, 0.008, 0.05);
  wingShape.position.set(0.05, 0, -0.008);
  const wing = source("birdWingSource", [part(wingShape, brown.scale(0.75), 7)], scene);

  const sources = { body, head, wing };
  birdSources.set(scene, sources);
  return sources;
}

/** A bird's nodes, for the game to move: the whole bird, its head and its two wings. */
export interface BirdRig {
  root: TransformNode;
  head: TransformNode;
  wingL: TransformNode;
  wingR: TransformNode;
}

/** Folded wings lie along the body; spread ones beat (see `flap`). */
export function createBird(scene: Scene, name: string): BirdRig {
  const sources = getBirdSources(scene);
  const root = new TransformNode(name, scene);
  show(sources.body, `${name}-body`, root);
  const head = new TransformNode(`${name}-head`, scene);
  head.parent = root;
  head.position.set(0, 0.09, 0.05);
  show(sources.head, `${name}-skull`, head);
  const wingL = new TransformNode(`${name}-wingL`, scene);
  wingL.parent = root;
  wingL.position.set(0.03, 0.085, 0.01);
  show(sources.wing, `${name}-wingL`, wingL);
  const wingR = new TransformNode(`${name}-wingR`, scene);
  wingR.parent = root;
  wingR.position.set(-0.03, 0.085, 0.01);
  wingR.scaling.x = -1;
  show(sources.wing, `${name}-wingR`, wingR);
  fold(wingL, wingR);
  return { root, head, wingL, wingR };
}

/** Wings folded against the body (resting on the ground). */
export function fold(wingL: TransformNode, wingR: TransformNode): void {
  wingL.rotation.set(0, 1.45, -0.2);
  wingR.rotation.set(0, -1.45, 0.2);
}

/** Wings held out still, a little raised (gliding down to land). */
export function glide(wingL: TransformNode, wingR: TransformNode): void {
  wingL.rotation.set(0, 0, 0.2);
  wingR.rotation.set(0, 0, -0.2);
}

/** Wings spread, at a point `phase` of their beat (radians). */
export function flap(wingL: TransformNode, wingR: TransformNode, phase: number): void {
  const lift = Math.sin(phase) * 0.9;
  wingL.rotation.set(0, 0, lift);
  wingR.rotation.set(0, 0, -lift);
}

// --- Fish ------------------------------------------------------------------------------------

interface FishSources {
  body: Mesh;
  tail: Mesh;
}

const fishSources = new WeakMap<Scene, FishSources>();

function getFishSources(scene: Scene): FishSources {
  const existing = fishSources.get(scene);
  if (existing) {
    return existing;
  }
  const dark = toColor(CONFIG.palette.fishBack);
  const shape = MeshBuilder.CreateSphere("fishShape", { diameter: 1, segments: 4 }, scene);
  shape.scaling.set(0.045, 0.06, 0.24);
  const body = source(
    "fishBody",
    [part(shape, (_x, y) => (y < 0 ? dark.scale(1.6) : dark), 11)],
    scene,
  );
  // The tail fin, around its own pivot at the end of the body.
  const fin = MeshBuilder.CreateSphere("fishFin", { diameter: 1, segments: 3 }, scene);
  fin.scaling.set(0.005, 0.065, 0.06);
  fin.position.set(0, 0, -0.03);
  const tail = source("fishTail", [part(fin, dark, 12)], scene);
  const sources = { body, tail };
  fishSources.set(scene, sources);
  return sources;
}

/** A fish's nodes: the fish and its tail (which waves). */
export interface FishRig {
  root: TransformNode;
  tail: TransformNode;
}

export function createFish(scene: Scene, name: string): FishRig {
  const sources = getFishSources(scene);
  const root = new TransformNode(name, scene);
  show(sources.body, `${name}-body`, root);
  const tail = new TransformNode(`${name}-tail`, scene);
  tail.parent = root;
  tail.position.set(0, 0, -0.11);
  show(sources.tail, `${name}-tailFin`, tail);
  return { root, tail };
}

// --- Frog ------------------------------------------------------------------------------------

interface FrogSources {
  body: Mesh;
  leg: Mesh;
}

const frogSources = new WeakMap<Scene, FrogSources>();

function getFrogSources(scene: Scene): FrogSources {
  const existing = frogSources.get(scene);
  if (existing) {
    return existing;
  }
  const palette = CONFIG.palette;
  const skin = toColor(palette.frogSkin);
  const belly = toColor(palette.frogBelly);
  const dark = toColor(palette.animalDark);
  // A squat body, wider at the back, with bulging eyes and short front legs.
  const trunk = MeshBuilder.CreateSphere("frogTrunk", { diameter: 1, segments: 4 }, scene);
  trunk.scaling.set(0.06, 0.035, 0.075);
  trunk.position.set(0, 0.03, 0);
  trunk.rotation.x = -0.2;
  const eyes = [-1, 1].map((s) => {
    const eye = MeshBuilder.CreateSphere("frogEye", { diameter: 0.016, segments: 3 }, scene);
    eye.position.set(0.018 * s, 0.05, 0.025);
    return eye;
  });
  const arms = [-1, 1].map((s) => {
    const arm = MeshBuilder.CreateCylinder(
      "frogArm",
      { height: 0.024, diameter: 0.008, tessellation: 3 },
      scene,
    );
    arm.position.set(0.022 * s, 0.012, 0.025);
    arm.rotation.z = 0.4 * s;
    return arm;
  });
  const body = source(
    "frogBody",
    [
      part(trunk, (_x, y) => (y < 0.022 ? belly : skin), 21),
      ...eyes.map((eye, i) => part(eye, dark, 22 + i)),
      ...arms.map((arm, i) => part(arm, skin, 24 + i)),
    ],
    scene,
  );
  // A folded hind leg, sitting along the body's side: the thigh runs forward from the hip and the
  // long foot lies flat under it (the right leg is mirrored by its node).
  const thigh = MeshBuilder.CreateSphere("frogThigh", { diameter: 1, segments: 3 }, scene);
  thigh.scaling.set(0.016, 0.014, 0.045);
  thigh.rotation.y = 0.25;
  thigh.position.set(0.006, -0.006, 0.016);
  const foot = MeshBuilder.CreateSphere("frogFoot", { diameter: 1, segments: 3 }, scene);
  foot.scaling.set(0.016, 0.006, 0.042);
  foot.rotation.y = 0.15;
  foot.position.set(0.014, -0.017, 0.006);
  const leg = source("frogLeg", [part(thigh, skin, 26), part(foot, skin.scale(0.8), 27)], scene);
  const sources = { body, leg };
  frogSources.set(scene, sources);
  return sources;
}

/** A frog's nodes: the frog and its two hind legs (which kick out when it jumps). */
export interface FrogRig {
  root: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
}

export function createFrog(scene: Scene, name: string): FrogRig {
  const sources = getFrogSources(scene);
  const root = new TransformNode(name, scene);
  show(sources.body, `${name}-body`, root);
  const legL = new TransformNode(`${name}-legL`, scene);
  legL.parent = root;
  legL.position.set(0.026, 0.024, -0.03);
  show(sources.leg, `${name}-legL`, legL);
  const legR = new TransformNode(`${name}-legR`, scene);
  legR.parent = root;
  legR.position.set(-0.026, 0.024, -0.03);
  legR.scaling.x = -1;
  show(sources.leg, `${name}-legR`, legR);
  return { root, legL, legR };
}

/** How far a kicking leg swings around the hip, from folded forward to out behind (radians). */
const KICK_SWING = 2.5;

/** The legs folded along the body (0) or kicked out behind (1). */
export function kick(legL: TransformNode, legR: TransformNode, amount: number): void {
  legL.rotation.y = amount * KICK_SWING;
  legR.rotation.y = -amount * KICK_SWING;
}

// --- Gallery ---------------------------------------------------------------------------------

/** A looping clip of one property of a node, from (frame, value) keys at 30 frames a second. */
function clip(
  group: AnimationGroup,
  node: TransformNode,
  property: string,
  keys: [number, number][],
): void {
  const animation = new Animation(
    `${node.name}-${property}`,
    property,
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  animation.setKeys(keys.map(([frame, value]) => ({ frame, value })));
  group.addTargetedAnimation(animation, node);
}

/** NBB-166 (AV7-A): the gallery's bird: pecking at the ground ("Pousada"), or flying ("Voar"). */
export const bird: ModelGenerator = {
  id: "bird",
  label: "Ave",
  create(scene: Scene): GeneratedModel {
    const rig = createBird(scene, "galleryBird");
    const rest = new AnimationGroup("Pousada", scene);
    clip(rest, rig.head, "rotation.x", [
      [0, 0],
      [8, 0.9],
      [14, 0],
      [40, 0],
      [46, 0.9],
      [52, 0],
      [75, 0],
    ]);
    const fly = new AnimationGroup("Voar", scene);
    clip(fly, rig.wingL, "rotation.y", [
      [0, 0],
      [8, 0],
    ]);
    clip(fly, rig.wingR, "rotation.y", [
      [0, 0],
      [8, 0],
    ]);
    clip(fly, rig.wingL, "rotation.z", [
      [0, 0.9],
      [4, -0.9],
      [8, 0.9],
    ]);
    clip(fly, rig.wingR, "rotation.z", [
      [0, -0.9],
      [4, 0.9],
      [8, -0.9],
    ]);
    return { root: rig.root, animations: [rest, fly] };
  },
};

/** NBB-166 (AV7-A): the gallery's fish, its tail waving ("Nadar"). */
export const fish: ModelGenerator = {
  id: "fish",
  label: "Peixe",
  create(scene: Scene): GeneratedModel {
    const rig = createFish(scene, "galleryFish");
    rig.root.position.y = 0.1;
    const swim = new AnimationGroup("Nadar", scene);
    clip(swim, rig.tail, "rotation.y", [
      [0, 0.5],
      [6, -0.5],
      [12, 0.5],
    ]);
    clip(swim, rig.root, "rotation.y", [
      [0, 0.08],
      [6, -0.08],
      [12, 0.08],
    ]);
    return { root: rig.root, animations: [swim] };
  },
};

/** NBB-166 (AV7-A): the gallery's frog, sitting ("Parado") or jumping ("Pular"). */
export const frog: ModelGenerator = {
  id: "frog",
  label: "Sapo",
  create(scene: Scene): GeneratedModel {
    const rig = createFrog(scene, "galleryFrog");
    const sit = new AnimationGroup("Parado", scene);
    clip(sit, rig.root, "scaling.y", [
      [0, 1],
      [15, 1.06],
      [30, 1],
    ]);
    const jump = new AnimationGroup("Pular", scene);
    clip(jump, rig.root, "position.y", [
      [0, 0],
      [6, 0.12],
      [12, 0],
      [30, 0],
    ]);
    clip(jump, rig.legL, "rotation.y", [
      [0, 0],
      [3, KICK_SWING],
      [10, KICK_SWING * 0.3],
      [12, 0],
      [30, 0],
    ]);
    clip(jump, rig.legR, "rotation.y", [
      [0, 0],
      [3, -KICK_SWING],
      [10, -KICK_SWING * 0.3],
      [12, 0],
      [30, 0],
    ]);
    return { root: rig.root, animations: [sit, jump] };
  },
};
