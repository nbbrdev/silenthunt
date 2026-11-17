import { Mesh, MeshBuilder, Vector3, VertexBuffer, type Scene } from "@babylonjs/core";
import { tileUVs } from "../surfaceTextures";
import type { BoneDef } from "./skeleton";

/** A bone segment that vertices can be bound to (for the skin weights). */
export interface SkinBone {
  index: number;
  a: Vector3;
  b: Vector3;
}

/** Looks bones up by name: their rest position and their skin segment. */
export function boneLookup(
  defs: BoneDef[],
  indexOf: Map<string, number>,
): { bone: (name: string) => BoneDef; skinBone: (name: string) => SkinBone } {
  const bone = (name: string): BoneDef => {
    const def = defs.find((candidate) => candidate.name === name);
    if (!def) {
      throw new Error(`Unknown bone: ${name}`);
    }
    return def;
  };
  const skinBone = (name: string): SkinBone => {
    const def = bone(name);
    return { index: indexOf.get(name) ?? 0, a: def.head, b: def.tail };
  };
  return { bone, skinBone };
}

/**
 * A tapered tube through `points` (each segment split in `subdivisions` rings, so it bends
 * smoothly), radius given along 0..1. The texture repeats every `tileMeters` around and along it.
 */
export function tube(
  scene: Scene,
  name: string,
  points: Vector3[],
  radiusAt: (t: number) => number,
  sides: number,
  tileMeters: number,
  subdivisions = 3,
): Mesh {
  const path: Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i] ?? Vector3.Zero();
    const to = points[i + 1] ?? from;
    for (let step = 0; step < subdivisions; step++) {
      path.push(Vector3.Lerp(from, to, step / subdivisions));
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
    Math.max(1, Math.round((Math.PI * 2 * radiusAt(0.5)) / tileMeters)),
    length / tileMeters,
  );
  return mesh;
}

/** Linear interpolation through evenly spaced values. */
export function piecewise(t: number, values: number[]): number {
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
export function skinTo(mesh: Mesh, bones: SkinBone[]): void {
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
