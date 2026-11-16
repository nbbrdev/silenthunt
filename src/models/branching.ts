import { Mesh, MeshBuilder, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import { randomInt, randomRange } from "../core/random";
import { tileUVs } from "./surfaceTextures";

/** One branch of a grown tree: a curved path that tapers from radiusStart to radiusEnd. */
export interface BranchSegment {
  path: Vector3[];
  radiusStart: number;
  radiusEnd: number;
  depth: number;
  /** True for the outermost twigs (no children): where leaves grow. */
  isTip: boolean;
}

/** How a tree grows. Ranges are [min, max]; angles in radians; lengths relative to the parent. */
export interface GrowthRules {
  /** Levels of splitting after the trunk (0 = trunk only). */
  maxDepth: number;
  children: readonly [number, number];
  /** Angle between a child and its parent's direction. */
  spread: readonly [number, number];
  /** Child length as a fraction of the parent's length. */
  lengthFactor: readonly [number, number];
  /** Where along the parent (0 = base, 1 = tip) children start. */
  childStart: readonly [number, number];
  /** Pull toward the sky (positive) or toward the ground (negative). */
  upward: number;
  /** How crooked each branch is (random wobble per step). */
  twist: number;
  /** Points per branch path (more = smoother curves, more triangles). */
  pathPoints: number;
  /**
   * Fine twigs added at each tip (short, 3-sided, 6 triangles each). They give the bare tips of
   * dead trees their brittle, many-pointed look.
   */
  twigsPerTip?: number;
  /**
   * Whether the first child carries on from the tip almost straight (default true). It makes
   * branches taper smoothly, but also makes the tree taller and narrower: broad crowns turn it off.
   */
  leader?: boolean;
}

/**
 * Grows a tree skeleton recursively (inspired by L-systems): every branch splits into thinner,
 * shorter children with random angles and wobble, so each seed gives a different natural shape.
 */
export function growBranches(
  random: () => number,
  origin: Vector3,
  direction: Vector3,
  length: number,
  radius: number,
  rules: GrowthRules,
): BranchSegment[] {
  const segments: BranchSegment[] = [];

  const grow = (start: Vector3, heading: Vector3, len: number, rad: number, depth: number) => {
    const path = [start.clone()];
    let point = start.clone();
    let dir = heading.normalizeToNew();
    const step = len / (rules.pathPoints - 1);
    for (let i = 1; i < rules.pathPoints; i++) {
      const wobble = new Vector3(
        randomRange(random, -1, 1),
        randomRange(random, -0.5, 0.5),
        randomRange(random, -1, 1),
      ).scale(rules.twist);
      dir = dir
        .add(wobble)
        .add(new Vector3(0, rules.upward * 0.25, 0))
        .normalize();
      point = point.add(dir.scale(step));
      path.push(point.clone());
    }

    const isTip = depth >= rules.maxDepth;
    const radiusEnd = isTip ? rad * 0.12 : rad * 0.6;
    segments.push({ path, radiusStart: rad, radiusEnd, depth, isTip });
    if (isTip) {
      addTwigs(path, rad * 0.12, len, depth);
      return;
    }

    const count = randomInt(random, rules.children);
    const azimuthStart = random() * Math.PI * 2;
    for (let c = 0; c < count; c++) {
      // The first child is the "leader": it carries on from the tip, almost straight, so a branch
      // tapers smoothly instead of ending in a flat cut.
      const isLeader = c === 0 && (rules.leader ?? true);
      const t = isLeader ? 1 : randomRange(random, rules.childStart[0], rules.childStart[1]);
      const along = directionAt(path, t);
      const sideways = perpendicular(
        along,
        azimuthStart + (c / count) * Math.PI * 2 + randomRange(random, -0.5, 0.5),
      );
      const angle = isLeader
        ? randomRange(random, 0.05, 0.3)
        : randomRange(random, rules.spread[0], rules.spread[1]);
      const childDir = along
        .scale(Math.cos(angle))
        .add(sideways.scale(Math.sin(angle)))
        .add(new Vector3(0, rules.upward, 0))
        .normalize();
      const childRadius = isLeader ? radiusEnd : (rad + (radiusEnd - rad) * t) * 0.75;
      const childLength = len * randomRange(random, rules.lengthFactor[0], rules.lengthFactor[1]);
      grow(pointAt(path, t), childDir, childLength, childRadius, depth + 1);
    }
  };

  const addTwigs = (path: Vector3[], radius: number, parentLength: number, depth: number) => {
    for (let i = 0; i < (rules.twigsPerTip ?? 0); i++) {
      const t = randomRange(random, 0.5, 1);
      const along = directionAt(path, t);
      const angle = randomRange(random, 0.4, 0.9);
      const twigDir = along
        .scale(Math.cos(angle))
        .add(perpendicular(along, random() * Math.PI * 2).scale(Math.sin(angle)))
        .normalize();
      const start = pointAt(path, t);
      const length = parentLength * randomRange(random, 0.25, 0.45);
      segments.push({
        path: [start, start.add(twigDir.scale(length))],
        radiusStart: Math.max(radius, 0.004),
        radiusEnd: 0.002,
        depth: depth + 1,
        isTip: false,
      });
    }
  };

  grow(origin, direction, length, radius, 0);
  return segments;
}

/**
 * Turns segments into tapered tubes. Thicker branches get more sides. The bark texture is
 * repeated by each branch's length and girth, so it keeps the same scale on trunk and twigs.
 */
export function branchTubes(segments: BranchSegment[], scene: Scene, name: string): Mesh[] {
  const tile = CONFIG.surfaces.barkTileMeters;
  return segments.map((segment, index) => {
    const last = segment.path.length - 1;
    const sides = [8, 6, 5, 4][segment.depth] ?? 3;
    const tube = MeshBuilder.CreateTube(
      `${name}${index}`,
      {
        path: segment.path,
        radiusFunction: (i) =>
          segment.radiusStart + (segment.radiusEnd - segment.radiusStart) * (i / last),
        tessellation: sides,
        cap: segment.depth === 0 ? Mesh.CAP_START : Mesh.NO_CAP,
      },
      scene,
    );
    let length = 0;
    for (let i = 1; i < segment.path.length; i++) {
      length += Vector3.Distance(
        segment.path[i - 1] ?? Vector3.Zero(),
        segment.path[i] ?? Vector3.Zero(),
      );
    }
    const girth = Math.PI * (segment.radiusStart + segment.radiusEnd);
    // Around the tube the repeat count must be whole, or the texture shows a seam.
    tileUVs(tube, Math.max(1, Math.round(girth / tile)), Math.max(length / tile, 0.25));
    return tube;
  });
}

/** Point at fraction t (0..1) along a path. */
export function pointAt(path: Vector3[], t: number): Vector3 {
  const scaled = Math.min(Math.max(t, 0), 1) * (path.length - 1);
  const index = Math.min(Math.floor(scaled), path.length - 2);
  const from = path[index] ?? Vector3.Zero();
  const to = path[index + 1] ?? from;
  return Vector3.Lerp(from, to, scaled - index);
}

/** Direction of the path around fraction t. */
export function directionAt(path: Vector3[], t: number): Vector3 {
  const scaled = Math.min(Math.max(t, 0), 1) * (path.length - 1);
  const index = Math.min(Math.floor(scaled), path.length - 2);
  const from = path[index] ?? Vector3.Zero();
  const to = path[index + 1] ?? Vector3.Up();
  return to.subtract(from).normalize();
}

/** A unit vector perpendicular to `axis`, turned by `angle` around it. */
export function perpendicular(axis: Vector3, angle: number): Vector3 {
  const reference = Math.abs(axis.y) < 0.9 ? Vector3.Up() : Vector3.Right();
  const u = Vector3.Cross(axis, reference).normalize();
  const v = Vector3.Cross(axis, u).normalize();
  return u.scale(Math.cos(angle)).add(v.scale(Math.sin(angle)));
}
