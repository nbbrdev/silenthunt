import { Color3, Mesh, VertexBuffer, type Material } from "@babylonjs/core";
import { CONFIG } from "../config";
import { hashPosition } from "../core/random";

type RGB = { readonly r: number; readonly g: number; readonly b: number };

/** Turns a palette entry from CONFIG into a Babylon color. */
export function toColor(rgb: RGB): Color3 {
  return new Color3(rgb.r, rgb.g, rgb.b);
}

/**
 * Bakes the part's position, rotation and scale into its vertices, so it can be deformed and
 * merged in model space.
 */
export function bake(part: Mesh): Mesh {
  part.bakeCurrentTransformIntoVertices();
  return part;
}

/**
 * Moves each vertex by up to `amount` meters in a random direction. Vertices at the same position
 * move together (the offset comes from the position, not the vertex), so the mesh never cracks.
 */
export function jitter(part: Mesh, amount: number, seed: number): Mesh {
  const positions = part.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    return part;
  }
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] ?? 0;
    const y = positions[i + 1] ?? 0;
    const z = positions[i + 2] ?? 0;
    positions[i] = x + (hashPosition(x, y, z, seed) - 0.5) * 2 * amount;
    positions[i + 1] = y + (hashPosition(x, y, z, seed + 1) - 0.5) * 2 * amount;
    positions[i + 2] = z + (hashPosition(x, y, z, seed + 2) - 0.5) * 2 * amount;
  }
  part.updateVerticesData(VertexBuffer.PositionKind, positions);
  return part;
}

/**
 * Paints every vertex. `colorAt` may depend on the vertex position (e.g. moss on top of rocks);
 * a small position-based variation (CONFIG.palette.variation) breaks up flat areas.
 */
export function paint(
  part: Mesh,
  colorAt: Color3 | ((x: number, y: number, z: number) => Color3),
  seed: number,
): Mesh {
  const positions = part.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    return part;
  }
  const variation = CONFIG.palette.variation;
  const colors = new Float32Array((positions.length / 3) * 4);
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3] ?? 0;
    const y = positions[v * 3 + 1] ?? 0;
    const z = positions[v * 3 + 2] ?? 0;
    const base = typeof colorAt === "function" ? colorAt(x, y, z) : colorAt;
    const shift = (hashPosition(x, y, z, seed + 7) - 0.5) * 2 * variation;
    colors[v * 4] = clamp01(base.r + shift);
    colors[v * 4 + 1] = clamp01(base.g + shift);
    colors[v * 4 + 2] = clamp01(base.b + shift);
    colors[v * 4 + 3] = 1;
  }
  part.setVerticesData(VertexBuffer.ColorKind, colors);
  return part;
}

/**
 * Joins the parts into one mesh with flat (faceted) shading: the low-poly look of C4-A.
 * The parts are disposed.
 */
export function assemble(name: string, parts: Mesh[], material: Material): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) {
    throw new Error(`Could not merge the parts of ${name}.`);
  }
  merged.name = name;
  merged.convertToFlatShadedMesh();
  merged.material = material;
  return merged;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
