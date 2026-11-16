import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { getGlowLayer } from "../../core/postProcessing";
import { createRandom } from "../../core/random";
import { branchTubes, growBranches } from "../branching";
import { assemble, paint, toColor } from "../lowPoly";
import { getSurfaceTextures, tileUVs } from "../surfaceTextures";
import type { GeneratedModel, ModelGenerator } from "../types";
import { buildCreatureAnimations } from "./animations";
import { buildSkeleton, creatureBones, type BoneDef } from "./skeleton";

/** A bone segment that vertices can be bound to (for the skin weights). */
interface SkinBone {
  index: number;
  a: Vector3;
  b: Vector3;
}

const SKIN_TILE = 0.5;
/** The deer skull is bigger than a real one: it dominates the silhouette, as in the references. */
const SKULL_SCALE = 1.5;

/**
 * The creature (NBB-133). From G15 and the user's references (wendigo-like folklore creature):
 * tall, emaciated, ribs showing, very long arms with claws, deer-like backward knees, a bleached
 * deer skull with antlers for a head (CR4: no face, no expression, "soulless") and glowing
 * yellowish-white eyes deep in the sockets. One skinned mesh on a 23-bone skeleton (A5-B).
 */
export const creature: ModelGenerator = {
  id: "creature",
  label: "Criatura",
  create(scene: Scene, seed: number): GeneratedModel {
    const root = new TransformNode("creature", scene);
    const defs = creatureBones();
    const { nodes, indexOf, skeleton } = buildSkeleton(scene, defs, root);
    const bone = (name: string): BoneDef => {
      const def = defs.find((candidate) => candidate.name === name);
      if (!def) {
        throw new Error(`Unknown creature bone: ${name}`);
      }
      return def;
    };
    const skinBone = (name: string): SkinBone => {
      const def = bone(name);
      return { index: indexOf.get(name) ?? 0, a: def.head, b: def.tail };
    };

    const skin = toColor(CONFIG.palette.creatureSkin);
    const parts: Mesh[] = [];

    // --- Torso: wide hips, thin waist, a ribcage with visible ribs, narrow shoulders.
    const pelvis = bone("pelvis");
    const torso = tube(
      scene,
      "creatureTorso",
      [
        pelvis.head.add(new Vector3(0, -0.1, 0)),
        pelvis.head,
        bone("spine1").head,
        bone("spine2").head,
        bone("chest").head,
        bone("neck").head,
      ],
      (t) => {
        if (t < 0.15) return 0.12;
        if (t < 0.35) return 0.12 - ((t - 0.15) / 0.2) * 0.045;
        const ribs = t > 0.45 && t < 0.85 ? 0.012 * Math.max(0, Math.sin(t * 60)) : 0;
        if (t < 0.6) return 0.075 + ((t - 0.35) / 0.25) * 0.075 + ribs;
        if (t < 0.88) return 0.15 + ribs;
        return 0.15 - ((t - 0.88) / 0.12) * 0.06;
      },
      10,
    );
    skinTo(torso, ["pelvis", "spine1", "spine2", "chest", "neck"].map(skinBone));
    paint(torso, skin, seed);
    parts.push(torso);

    const neck = tube(
      scene,
      "creatureNeck",
      [bone("neck").head, bone("head").head],
      (t) => 0.06 - t * 0.02,
      7,
    );
    skinTo(neck, ["chest", "neck", "head"].map(skinBone));
    paint(neck, skin, seed + 1);
    parts.push(neck);

    // --- Legs (digitigrade) and arms (reaching the knees), both sides.
    for (const side of ["L", "R"] as const) {
      const s = side === "L" ? 1 : -1;
      const leg = tube(
        scene,
        `creatureLeg${side}`,
        [
          new Vector3(0.11 * s, 1.28, 0),
          bone(`thigh${side}`).head,
          bone(`shin${side}`).head,
          bone(`foot${side}`).head,
          bone(`toe${side}`).head,
          bone(`toe${side}`).tail,
        ],
        (t) => piecewise(t, [0.12, 0.11, 0.06, 0.045, 0.035, 0.012]),
        7,
      );
      skinTo(
        leg,
        ["pelvis", `thigh${side}`, `shin${side}`, `foot${side}`, `toe${side}`].map(skinBone),
      );
      paint(leg, skin, seed + 2);
      parts.push(leg);

      const arm = tube(
        scene,
        `creatureArm${side}`,
        [
          bone(`clavicle${side}`).head,
          bone(`upperArm${side}`).head,
          bone(`forearm${side}`).head,
          bone(`hand${side}`).head,
          bone(`hand${side}`).tail,
        ],
        (t) => piecewise(t, [0.06, 0.07, 0.05, 0.038, 0.032]),
        7,
      );
      skinTo(
        arm,
        ["chest", `clavicle${side}`, `upperArm${side}`, `forearm${side}`, `hand${side}`].map(
          skinBone,
        ),
      );
      paint(arm, skin, seed + 3);
      parts.push(arm);

      // Four long, curled fingers ending in claws.
      const palm = bone(`hand${side}`).tail;
      for (let f = 0; f < 4; f++) {
        const spread = (f - 1.5) * 0.028;
        const base = palm.add(new Vector3(spread * s, 0, spread * 0.4));
        const finger = tube(
          scene,
          `creatureFinger${side}${f}`,
          [
            base,
            base.add(new Vector3(0.01 * s, -0.11, 0.02)),
            base.add(new Vector3(0.015 * s, -0.21, 0.08)),
          ],
          (t) => 0.013 - t * 0.011,
          4,
        );
        skinTo(finger, [skinBone(`hand${side}`)]);
        paint(finger, skin.scale(0.8), seed + 4);
        parts.push(finger);
      }
    }

    // --- Head: a bleached deer skull with dark, empty eye sockets (CR4) and antlers.
    const head = bone("head").head;
    // Offsets and sizes below are for a 1× skull; the skull is drawn SKULL_SCALE times bigger.
    const onSkull = (x: number, y: number, z: number) =>
      head.add(new Vector3(x, y, z).scale(SKULL_SCALE));
    const eyes = [-1, 1].map((s) => onSkull(0.055 * s, 0.06, 0.09));
    const boneColor = toColor(CONFIG.palette.creatureBone);
    const socketColor = new Color3(0.02, 0.02, 0.02);
    const paintSkull = (mesh: Mesh) =>
      paint(
        mesh,
        (x, y, z) =>
          eyes.some((eye) => Vector3.Distance(eye, new Vector3(x, y, z)) < 0.05 * SKULL_SCALE)
            ? socketColor
            : boneColor,
        seed + 5,
      );

    const cranium = MeshBuilder.CreateSphere(
      "creatureCranium",
      { diameter: 0.2 * SKULL_SCALE, segments: 8 },
      scene,
    );
    cranium.scaling.set(0.8, 0.75, 1);
    cranium.position = onSkull(0, 0.06, 0.02);
    const snout = MeshBuilder.CreateCylinder(
      "creatureSnout",
      {
        height: 0.3 * SKULL_SCALE,
        diameterTop: 0.05 * SKULL_SCALE,
        diameterBottom: 0.12 * SKULL_SCALE,
        tessellation: 8,
      },
      scene,
    );
    snout.rotation.x = Math.PI / 2 + 0.3;
    snout.position = onSkull(0, 0, 0.17);
    const jaw = MeshBuilder.CreateCylinder(
      "creatureJaw",
      {
        height: 0.24 * SKULL_SCALE,
        diameterTop: 0.035 * SKULL_SCALE,
        diameterBottom: 0.08 * SKULL_SCALE,
        tessellation: 6,
      },
      scene,
    );
    jaw.rotation.x = Math.PI / 2 + 0.5;
    jaw.position = onSkull(0, -0.07, 0.12);
    for (const piece of [cranium, snout, jaw]) {
      piece.bakeCurrentTransformIntoVertices();
      paintSkull(piece);
      tileUVs(piece, 1, 1);
      skinTo(piece, [skinBone("head")]);
      parts.push(piece);
    }

    const random = createRandom(seed);
    for (const s of [-1, 1]) {
      const antler = growBranches(
        random,
        onSkull(0.05 * s, 0.13, 0),
        new Vector3(0.6 * s, 0.85, -0.35),
        0.34,
        0.022,
        {
          maxDepth: 2,
          children: [2, 2],
          spread: [0.45, 0.8],
          lengthFactor: [0.55, 0.75],
          childStart: [0.4, 0.9],
          upward: 0.35,
          twist: 0.08,
          pathPoints: 4,
        },
      );
      for (const piece of branchTubes(antler, scene, "creatureAntler")) {
        paint(piece, toColor(CONFIG.palette.creatureAntler), seed + 6);
        skinTo(piece, [skinBone("head")]);
        parts.push(piece);
      }
    }

    const body = assemble("creatureBody", parts, getCreatureMaterial(scene));
    body.parent = root;
    body.skeleton = skeleton;
    body.numBoneInfluencers = 4;
    // The skin moves away from the rest pose: keep it drawn instead of trusting the rest bounds.
    body.alwaysSelectAsActiveMesh = true;

    // --- Eyes: deep in the sockets, glowing yellowish-white (G15). They follow the head bone.
    const headNode = nodes.get("head");
    const eyeMaterial = getEyeMaterial(scene);
    for (const [index, eye] of eyes.entries()) {
      const ball = MeshBuilder.CreateSphere(
        `creatureEye${index}`,
        { diameter: 0.03, segments: 6 },
        scene,
      );
      ball.material = eyeMaterial;
      ball.parent = headNode ?? root;
      // The head node sits on the head joint, so the eye's local position is relative to it.
      ball.position = eye.subtract(head).add(new Vector3(0, 0, -0.01));
      getGlowLayer(scene).addIncludedOnlyMesh(ball);
    }

    return { root, animations: buildCreatureAnimations(scene, nodes) };
  },
};

/** A tapered tube through `points` (smoothed by subdividing), radius given along 0..1. */
function tube(
  scene: Scene,
  name: string,
  points: Vector3[],
  radiusAt: (t: number) => number,
  sides: number,
): Mesh {
  const path: Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i] ?? Vector3.Zero();
    const to = points[i + 1] ?? from;
    for (let step = 0; step < 3; step++) {
      path.push(Vector3.Lerp(from, to, step / 3));
    }
  }
  path.push(points[points.length - 1] ?? Vector3.Zero());
  const last = path.length - 1;
  const mesh = MeshBuilder.CreateTube(
    name,
    { path, radiusFunction: (i) => radiusAt(i / last), tessellation: sides, cap: Mesh.CAP_ALL },
    scene,
  );
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += Vector3.Distance(path[i - 1] ?? Vector3.Zero(), path[i] ?? Vector3.Zero());
  }
  tileUVs(
    mesh,
    Math.max(1, Math.round((Math.PI * 2 * radiusAt(0.5)) / SKIN_TILE)),
    length / SKIN_TILE,
  );
  return mesh;
}

/** Linear interpolation through evenly spaced values. */
function piecewise(t: number, values: number[]): number {
  const scaled = Math.min(Math.max(t, 0), 1) * (values.length - 1);
  const index = Math.min(Math.floor(scaled), values.length - 2);
  const a = values[index] ?? 0;
  const b = values[index + 1] ?? a;
  return a + (b - a) * (scaled - index);
}

/**
 * Skin weights: each vertex follows the two nearest bones of `bones`, weighted by how close it
 * is to each one, so the skin bends smoothly at the joints (A5-B).
 */
function skinTo(mesh: Mesh, bones: SkinBone[]): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const count = positions.length / 3;
  const indices = new Float32Array(count * 4);
  const weights = new Float32Array(count * 4);
  const point = new Vector3();
  for (let v = 0; v < count; v++) {
    point.set(positions[v * 3] ?? 0, positions[v * 3 + 1] ?? 0, positions[v * 3 + 2] ?? 0);
    const ranked = bones
      .map((candidate) => ({
        index: candidate.index,
        distance: distanceToSegment(point, candidate.a, candidate.b),
      }))
      .sort((first, second) => first.distance - second.distance);
    const nearest = ranked.slice(0, 2);
    const raw = nearest.map((entry) => 1 / (entry.distance ** 4 + 1e-8));
    const total = raw.reduce((sum, value) => sum + value, 0);
    nearest.forEach((entry, slot) => {
      indices[v * 4 + slot] = entry.index;
      weights[v * 4 + slot] = (raw[slot] ?? 0) / total;
    });
  }
  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, indices, false, 4);
  mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, weights, false, 4);
}

function distanceToSegment(point: Vector3, a: Vector3, b: Vector3): number {
  const ab = b.subtract(a);
  const t = Math.min(Math.max(Vector3.Dot(point.subtract(a), ab) / ab.lengthSquared(), 0), 1);
  return Vector3.Distance(point, a.add(ab.scale(t)));
}

const skinMaterialByScene = new WeakMap<Scene, StandardMaterial>();

/** Dry, cracked dark skin (CR2): the bark texture and its relief, tinted by vertex colors. */
function getCreatureMaterial(scene: Scene): StandardMaterial {
  const existing = skinMaterialByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("creatureSkin", scene);
  const bark = getSurfaceTextures(scene, "bark");
  material.diffuseTexture = bark.color;
  material.bumpTexture = bark.normal;
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  skinMaterialByScene.set(scene, material);
  return material;
}

const eyeMaterialByScene = new WeakMap<Scene, StandardMaterial>();

function getEyeMaterial(scene: Scene): StandardMaterial {
  const existing = eyeMaterialByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("creatureEyes", scene);
  material.emissiveColor = toColor(CONFIG.palette.creatureEyes);
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  eyeMaterialByScene.set(scene, material);
  return material;
}
