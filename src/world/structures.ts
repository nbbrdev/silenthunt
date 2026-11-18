import {
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  PhysicsShapeContainer,
  Quaternion,
  TransformNode,
  Vector3,
  type Mesh,
  type PhysicsShape,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import {
  createDoorModel,
  createFoundationMesh,
  createRoofMesh,
  createWallMesh,
} from "../models/structures/buildPieces";
import type { Interaction, InteractionSystem } from "../systems/interactions";
import type { ChunkManager, Obstacle } from "./chunks";
import type { Terrain } from "./terrain";

/** The four pieces (RF-52). */
export type PieceKind = "foundation" | "wall" | "door" | "roof";

/**
 * Where a piece stands. Foundations and roofs fill a cell (i, j): the square from (2i, 2j) to
 * (2i + 2, 2j + 2). Walls and doors stand on an edge: "x" edges run along X at z = 2j (between
 * cells (i, j − 1) and (i, j)); "z" edges run along Z at x = 2i (between cells (i − 1, j) and
 * (i, j)).
 */
export interface Slot {
  kind: PieceKind;
  i: number;
  j: number;
  /** Walls and doors: which way the edge runs. */
  axis?: "x" | "z";
}

/** A piece as the save keeps it (NBB-147). */
export interface SavedPiece {
  kind: PieceKind;
  i: number;
  j: number;
  axis?: "x" | "z";
  y: number;
  turn: number;
  open?: boolean;
}

/** A piece the player could place, and whether it can go there now (RF-53, CN3). */
export interface Plan {
  slot: Slot;
  /** Its base: the floor for foundations and walls, the top of the walls for roofs. */
  position: Vector3;
  rotationY: number;
  /** Why it cannot go there (a short pt-BR text), or undefined if it can. */
  problem: string | undefined;
}

interface Piece {
  slot: Slot;
  key: string;
  y: number;
  /** Quarter turns chosen with R: the door's swing side, the roof's slope. */
  turn: number;
  node: TransformNode;
  body: PhysicsBody;
  shapes: PhysicsShape[];
  /** Doors: the leaf, its body (only while closed), and how open it is (0 to 1). */
  leaf?: Mesh;
  leafBody?: PhysicsBody;
  leafShapes?: PhysicsShape[];
  open?: boolean;
  opening?: number;
}

const key = (slot: Slot) =>
  `${slot.kind === "door" ? "wall" : slot.kind}:${slot.axis ?? ""}:${slot.i}:${slot.j}`;

/**
 * The player's buildings (NBB-145, RF-52 to RF-54, CN3 to CN6): pieces on the 2 m grid, with
 * their support rules, their collisions (walls and closed doors also stop the creature, arrows and
 * shots, and its strike, CN5-A), and the doors that E opens and closes.
 */
export class StructureManager {
  private readonly scene: Scene;
  private readonly terrain: Terrain;
  private readonly pieces = new Map<string, Piece>();
  private readonly templates: Record<"foundation" | "wall" | "roof", Mesh>;
  private readonly doorTemplate: { frame: Mesh; leaf: Mesh; hinge: Vector3 };

  constructor(
    scene: Scene,
    terrain: Terrain,
    chunks: ChunkManager,
    interactions: InteractionSystem,
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.templates = {
      foundation: createFoundationMesh(scene),
      wall: createWallMesh(scene),
      roof: createRoofMesh(scene),
    };
    this.doorTemplate = createDoorModel(scene);
    for (const mesh of [
      ...Object.values(this.templates),
      this.doorTemplate.frame,
      this.doorTemplate.leaf,
    ]) {
      mesh.setEnabled(false);
    }
    chunks.obstacleProviders.push((x, z, radius) => this.obstaclesNear(x, z, radius));
    interactions.add(() => this.doorInteraction());
    scene.onBeforeRenderObservable.add(() => {
      this.animateDoors(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** How many pieces stand (development). */
  get count(): number {
    return this.pieces.size;
  }

  /** The pieces standing, as "kind i,j" (development). */
  list(): string[] {
    return [...this.pieces.values()].map(
      ({ slot }) => `${slot.kind}${slot.axis ? `-${slot.axis}` : ""} ${slot.i},${slot.j}`,
    );
  }

  /** NBB-147: every piece, for the save. */
  get saved(): SavedPiece[] {
    return [...this.pieces.values()].map((piece) => ({
      kind: piece.slot.kind,
      i: piece.slot.i,
      j: piece.slot.j,
      axis: piece.slot.axis,
      y: piece.y,
      turn: piece.turn,
      open: piece.open,
    }));
  }

  /** NBB-147: builds a saved game's pieces again, where they stood. */
  restore(saved: readonly SavedPiece[]): void {
    const { cell } = CONFIG.building;
    // Foundations first: the others stand on them.
    const order: PieceKind[] = ["foundation", "wall", "door", "roof"];
    const sorted = [...saved].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const piece of sorted) {
      const slot: Slot = { kind: piece.kind, i: piece.i, j: piece.j, axis: piece.axis };
      if (this.pieces.has(key(slot))) {
        continue;
      }
      let position: Vector3;
      let rotationY: number;
      if (piece.kind === "foundation" || piece.kind === "roof") {
        position = new Vector3((piece.i + 0.5) * cell, piece.y, (piece.j + 0.5) * cell);
        rotationY = piece.kind === "roof" ? (piece.turn * Math.PI) / 2 : 0;
      } else {
        const { from, to } = edgeEnds(slot);
        position = from.add(to).scale(0.5);
        position.y = piece.y;
        rotationY = (piece.axis === "z" ? Math.PI / 2 : 0) + (piece.turn % 2) * Math.PI;
      }
      this.place({ slot, position, rotationY, problem: undefined }, piece.turn);
      const placed = this.pieces.get(key(slot));
      if (placed && piece.open) {
        this.toggleDoor(placed);
      }
    }
  }

  /** The top of the foundation at (x, z), if there is one (the player aims at floors too). */
  floorAt(x: number, z: number): number | undefined {
    const { cell } = CONFIG.building;
    const slot: Slot = { kind: "foundation", i: Math.floor(x / cell), j: Math.floor(z / cell) };
    return this.pieces.get(key(slot))?.y;
  }

  /**
   * CN3: where a piece of this kind would go for a point the player looks at (`target`), and
   * whether it can: support, slope and what is in the way. `turn` is the R rotation.
   */
  plan(
    kind: PieceKind,
    target: Vector3,
    turn: number,
    player: Vector3,
    blockedByNature: (x: number, z: number) => boolean,
  ): Plan | undefined {
    const { cell, maxSlope, floorLift, wallHeight } = CONFIG.building;
    const i = Math.floor(target.x / cell);
    const j = Math.floor(target.z / cell);
    if (kind === "foundation") {
      const slot: Slot = { kind, i, j };
      const center = new Vector3((i + 0.5) * cell, 0, (j + 0.5) * cell);
      let low = Infinity;
      let high = -Infinity;
      for (const dx of [-0.95, 0, 0.95]) {
        for (const dz of [-0.95, 0, 0.95]) {
          const ground = this.terrain.heightAt(center.x + dx, center.z + dz);
          low = Math.min(low, ground);
          high = Math.max(high, ground);
        }
      }
      center.y = high + floorLift;
      let problem: string | undefined;
      if (this.pieces.has(key(slot))) {
        problem = "Já tem uma peça aqui";
      } else if (high - low > maxSlope) {
        problem = "O chão é inclinado demais";
      } else if (blockedByNature(center.x, center.z)) {
        problem = "Algo no caminho";
      } else if (
        Math.abs(player.x - center.x) < cell / 2 + 0.35 &&
        Math.abs(player.z - center.z) < cell / 2 + 0.35
      ) {
        problem = "Você está no caminho";
      }
      return { slot, position: center, rotationY: 0, problem };
    }

    if (kind === "roof") {
      const slot: Slot = { kind, i, j };
      const walls = this.cellWalls(i, j);
      const center = new Vector3((i + 0.5) * cell, 0, (j + 0.5) * cell);
      center.y = walls.length > 0 ? Math.max(...walls.map((wall) => wall.y)) + wallHeight : 0;
      let problem: string | undefined;
      if (this.pieces.has(key(slot))) {
        problem = "Já tem uma peça aqui";
      } else if (!this.roofSupported(i, j)) {
        problem = "Precisa de paredes";
      }
      return { slot, position: center, rotationY: (turn * Math.PI) / 2, problem };
    }

    // Walls and doors: the edge of this cell nearest to where the player looks, on a foundation.
    const edges: Slot[] = [
      { kind, i, j, axis: "x" },
      { kind, i, j: j + 1, axis: "x" },
      { kind, i, j, axis: "z" },
      { kind, i: i + 1, j, axis: "z" },
    ];
    let best: { slot: Slot; distance: number } | undefined;
    for (const slot of edges) {
      if (this.edgeFloor(slot) === undefined) {
        continue;
      }
      const { from, to } = edgeEnds(slot);
      const distance = distanceToSegment(target.x, target.z, from, to);
      if (!best || distance < best.distance) {
        best = { slot, distance };
      }
    }
    if (!best) {
      // No foundation here: show it on the nearest edge, in red.
      const fallback = edges[0];
      if (!fallback) {
        return undefined;
      }
      const { from, to } = edgeEnds(fallback);
      const middle = from.add(to).scale(0.5);
      middle.y = this.terrain.heightAt(middle.x, middle.z);
      return { slot: fallback, position: middle, rotationY: 0, problem: "Precisa de uma fundação" };
    }
    const { slot } = best;
    const { from, to } = edgeEnds(slot);
    const middle = from.add(to).scale(0.5);
    middle.y = this.edgeFloor(slot) ?? 0;
    let problem: string | undefined;
    if (this.pieces.has(key(slot))) {
      problem = "Já tem uma peça aqui";
    } else if (distanceToSegment(player.x, player.z, from, to) < 0.45) {
      problem = "Você está no caminho";
    }
    const rotationY = slot.axis === "z" ? Math.PI / 2 : 0;
    return { slot, position: middle, rotationY: rotationY + (turn % 2) * Math.PI, problem };
  }

  /** Builds the planned piece (its cost is the caller's business). */
  place(plan: Plan, turn: number): void {
    const { slot, position, rotationY } = plan;
    const node = new TransformNode(`piece-${key(slot)}`, this.scene);
    node.position.copyFrom(position);
    node.rotation.y = rotationY;
    const piece: Piece = {
      slot,
      key: key(slot),
      y: position.y,
      turn,
      node,
      body: new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene),
      shapes: [],
    };
    if (slot.kind === "door") {
      const frame = this.doorTemplate.frame.createInstance(`doorFrame-${piece.key}`);
      frame.parent = node;
      frame.setEnabled(true);
      // Each door gets its own leaf: it turns on its own.
      const leaf = this.doorTemplate.leaf.clone(`doorLeaf-${piece.key}`);
      leaf.setEnabled(true);
      leaf.parent = node;
      leaf.position = this.doorTemplate.hinge.clone();
      piece.leaf = leaf;
      piece.open = false;
      piece.opening = 0;
    } else {
      const mesh = this.templates[slot.kind].createInstance(`${slot.kind}-${piece.key}`);
      mesh.parent = node;
      mesh.setEnabled(true);
    }
    this.buildColliders(piece);
    this.pieces.set(piece.key, piece);
  }

  /** The piece nearest to the view ray, within reach (CN2-A: the one to take apart). */
  pieceAlong(eye: Vector3, direction: Vector3, reach: number): Slot | undefined {
    let best: { piece: Piece; distance: number } | undefined;
    for (const piece of this.pieces.values()) {
      const distance = this.rayHit(piece, eye, direction);
      if (distance !== undefined && distance <= reach && (!best || distance < best.distance)) {
        best = { piece, distance };
      }
    }
    return best?.piece.slot;
  }

  /** How far along the ray it meets the piece's box (in the piece's own space), if it does. */
  private rayHit(piece: Piece, eye: Vector3, direction: Vector3): number | undefined {
    const { cell, wallHeight, wallThickness } = CONFIG.building;
    const half = cell / 2;
    const box =
      piece.slot.kind === "foundation"
        ? { center: new Vector3(0, -0.1, 0), size: new Vector3(half, 0.12, half) }
        : piece.slot.kind === "roof"
          ? { center: new Vector3(0, 0.12, 0), size: new Vector3(half + 0.15, 0.2, half + 0.15) }
          : {
              center: new Vector3(0, wallHeight / 2, 0),
              size: new Vector3(half, wallHeight / 2, wallThickness / 2 + 0.05),
            };
    const toLocal = piece.node.computeWorldMatrix(true).clone().invert();
    const origin = Vector3.TransformCoordinates(eye, toLocal).subtract(box.center);
    const way = Vector3.TransformNormal(direction, toLocal);
    let near = 0;
    let far = Infinity;
    for (const axis of ["x", "y", "z"] as const) {
      const start = origin[axis];
      const step = way[axis];
      const extent = box.size[axis];
      if (Math.abs(step) < 1e-9) {
        if (Math.abs(start) > extent) {
          return undefined;
        }
        continue;
      }
      let t1 = (-extent - start) / step;
      let t2 = (extent - start) / step;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
      }
      near = Math.max(near, t1);
      far = Math.min(far, t2);
      if (near > far) {
        return undefined;
      }
    }
    return near;
  }

  /** True if another piece needs this one to stand (it cannot be taken apart yet). */
  hasDependents(slot: Slot): boolean {
    const removedKey = key(slot);
    if (slot.kind === "foundation") {
      // A wall on its edges with no other foundation under it.
      return this.cellEdges(slot.i, slot.j).some((edge) => {
        const piece = this.pieces.get(key(edge));
        return piece !== undefined && this.edgeFloor(edge, removedKey) === undefined;
      });
    }
    // Walls and roofs: a roof nearby that would no longer stand.
    const cells =
      slot.kind === "roof"
        ? [
            [slot.i + 1, slot.j],
            [slot.i - 1, slot.j],
            [slot.i, slot.j + 1],
            [slot.i, slot.j - 1],
          ]
        : slot.axis === "x"
          ? [
              [slot.i, slot.j],
              [slot.i, slot.j - 1],
            ]
          : [
              [slot.i, slot.j],
              [slot.i - 1, slot.j],
            ];
    return cells.some(([ci, cj]) => {
      const roof = this.pieces.get(key({ kind: "roof", i: ci ?? 0, j: cj ?? 0 }));
      return roof !== undefined && !this.roofSupported(ci ?? 0, cj ?? 0, removedKey);
    });
  }

  /** Takes a piece apart (its refund is the caller's business). */
  remove(slot: Slot): PieceKind | undefined {
    const piece = this.pieces.get(key(slot));
    if (!piece) {
      return undefined;
    }
    this.pieces.delete(piece.key);
    this.disposeBodies(piece);
    piece.node.dispose(false, false);
    return piece.slot.kind;
  }

  /**
   * CN5-A: true if a wall or a closed door stands between two points (seen from above): the
   * creature's strike does not go through.
   */
  blocksLine(ax: number, az: number, bx: number, bz: number): boolean {
    for (const segment of this.blockingSegments()) {
      if (
        segmentsCross(ax, az, bx, bz, segment.from.x, segment.from.z, segment.to.x, segment.to.z)
      ) {
        return true;
      }
    }
    return false;
  }

  // --- Support rules (RF-52) ---

  /** The floor height for a wall on this edge: the highest foundation beside it, if any. */
  private edgeFloor(slot: Slot, ignoreKey?: string): number | undefined {
    const cells =
      slot.axis === "x"
        ? [
            [slot.i, slot.j - 1],
            [slot.i, slot.j],
          ]
        : [
            [slot.i - 1, slot.j],
            [slot.i, slot.j],
          ];
    let floor: number | undefined;
    for (const [ci, cj] of cells) {
      const found = this.pieces.get(key({ kind: "foundation", i: ci ?? 0, j: cj ?? 0 }));
      if (found && found.key !== ignoreKey) {
        floor = Math.max(floor ?? -Infinity, found.y);
      }
    }
    return floor;
  }

  private cellEdges(i: number, j: number): Slot[] {
    return [
      { kind: "wall", i, j, axis: "x" },
      { kind: "wall", i, j: j + 1, axis: "x" },
      { kind: "wall", i, j, axis: "z" },
      { kind: "wall", i: i + 1, j, axis: "z" },
    ];
  }

  private cellWalls(i: number, j: number, ignoreKey?: string): Piece[] {
    return this.cellEdges(i, j)
      .map((edge) => this.pieces.get(key(edge)))
      .filter((piece): piece is Piece => piece !== undefined && piece.key !== ignoreKey);
  }

  /** RF-52: a roof needs two walls around its cell, or one wall and a roof beside it. */
  private roofSupported(i: number, j: number, ignoreKey?: string): boolean {
    const walls = this.cellWalls(i, j, ignoreKey).length;
    if (walls >= 2) {
      return true;
    }
    if (walls < 1) {
      return false;
    }
    return [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ].some(([ci, cj]) => {
      const roof = this.pieces.get(key({ kind: "roof", i: ci ?? 0, j: cj ?? 0 }));
      return roof !== undefined && roof.key !== ignoreKey;
    });
  }

  // --- Collisions and obstacles ---

  private buildColliders(piece: Piece): void {
    const { cell, wallHeight, wallThickness, doorWidth, doorHeight } = CONFIG.building;
    const container = new PhysicsShapeContainer(this.scene);
    piece.shapes.push(container);
    const box = (center: Vector3, size: Vector3) => {
      const shape = new PhysicsShapeBox(center, Quaternion.Identity(), size, this.scene);
      container.addChild(shape);
      piece.shapes.push(shape);
    };
    switch (piece.slot.kind) {
      case "foundation":
        box(new Vector3(0, -0.6, 0), new Vector3(cell, 1.2, cell));
        break;
      case "wall":
        box(new Vector3(0, wallHeight / 2, 0), new Vector3(cell, wallHeight, wallThickness));
        break;
      case "door": {
        const side = (cell - doorWidth) / 2;
        for (const sign of [-1, 1]) {
          box(
            new Vector3(sign * (doorWidth / 2 + side / 2), wallHeight / 2, 0),
            new Vector3(side, wallHeight, wallThickness),
          );
        }
        box(
          new Vector3(0, (doorHeight + wallHeight) / 2, 0),
          new Vector3(doorWidth, wallHeight - doorHeight, wallThickness),
        );
        this.setLeafCollider(piece, true);
        break;
      }
      case "roof":
        box(new Vector3(0, 0.12, 0), new Vector3(cell + 0.3, 0.15, cell + 0.3));
        break;
    }
    piece.body.shape = container;
  }

  /** CN6: the closed door blocks the way; the open one does not. */
  private setLeafCollider(piece: Piece, closed: boolean): void {
    piece.leafBody?.dispose();
    for (const shape of piece.leafShapes ?? []) {
      shape.dispose();
    }
    piece.leafBody = undefined;
    piece.leafShapes = undefined;
    if (!closed) {
      return;
    }
    const { doorWidth, doorHeight } = CONFIG.building;
    const holder = new TransformNode(`doorLeafBody-${piece.key}`, this.scene);
    holder.parent = piece.node;
    holder.computeWorldMatrix(true);
    const shape = new PhysicsShapeBox(
      new Vector3(0, doorHeight / 2, 0),
      Quaternion.Identity(),
      new Vector3(doorWidth, doorHeight, 0.08),
      this.scene,
    );
    const body = new PhysicsBody(holder, PhysicsMotionType.STATIC, false, this.scene);
    body.shape = shape;
    piece.leafBody = body;
    piece.leafShapes = [shape];
  }

  private disposeBodies(piece: Piece): void {
    piece.body.dispose();
    for (const shape of piece.shapes) {
      shape.dispose();
    }
    this.setLeafCollider(piece, false);
  }

  /** Walls and closed doors as segments seen from above (the open doorway left out). */
  private blockingSegments(): { from: Vector3; to: Vector3 }[] {
    const { doorWidth } = CONFIG.building;
    const segments: { from: Vector3; to: Vector3 }[] = [];
    for (const piece of this.pieces.values()) {
      const { kind } = piece.slot;
      if (kind !== "wall" && kind !== "door") {
        continue;
      }
      const { from, to } = edgeEnds(piece.slot);
      if (kind === "wall" || !piece.open) {
        segments.push({ from, to });
        continue;
      }
      // An open door: only the parts beside the doorway block.
      const middle = from.add(to).scale(0.5);
      const along = to
        .subtract(from)
        .normalize()
        .scale(doorWidth / 2);
      segments.push({ from, to: middle.subtract(along) }, { from: middle.add(along), to });
    }
    return segments;
  }

  /** The walls and closed doors near (x, z), as circles, for steering, arrows and shots. */
  private obstaclesNear(x: number, z: number, radius: number): Obstacle[] {
    const found: Obstacle[] = [];
    const { wallHeight } = CONFIG.building;
    for (const segment of this.blockingSegments()) {
      if (distanceToSegment(x, z, segment.from, segment.to) > radius + 0.3) {
        continue;
      }
      const length = Vector3.Distance(segment.from, segment.to);
      const steps = Math.max(1, Math.round(length / 0.4));
      for (let k = 0; k <= steps; k++) {
        const point = Vector3.Lerp(segment.from, segment.to, k / steps);
        if ((point.x - x) ** 2 + (point.z - z) ** 2 > (radius + 0.2) ** 2) {
          continue;
        }
        const ground = this.terrain.heightAt(point.x, point.z);
        const top = (this.wallAt(segment.from, segment.to)?.y ?? ground) + wallHeight;
        found.push({ x: point.x, z: point.z, radius: 0.2, height: top - ground, structure: true });
      }
    }
    return found;
  }

  private wallAt(from: Vector3, to: Vector3): Piece | undefined {
    const middle = from.add(to).scale(0.5);
    for (const piece of this.pieces.values()) {
      const { kind } = piece.slot;
      if (kind !== "wall" && kind !== "door") {
        continue;
      }
      const ends = edgeEnds(piece.slot);
      if (distanceToSegment(middle.x, middle.z, ends.from, ends.to) < 0.05) {
        return piece;
      }
    }
    return undefined;
  }

  // --- Doors (CN6) ---

  private doorInteraction(): Interaction | undefined {
    const eye = this.scene.activeCamera?.globalPosition;
    if (!eye) {
      return undefined;
    }
    let best: Interaction | undefined;
    for (const piece of this.pieces.values()) {
      if (piece.slot.kind !== "door") {
        continue;
      }
      const position = piece.node.position;
      const distance = Math.hypot(position.x - eye.x, position.z - eye.z);
      if (distance <= 2 && (!best || distance < best.distance)) {
        best = {
          label: piece.open ? "Fechar porta" : "Abrir porta",
          distance,
          act: () => this.toggleDoor(piece),
        };
      }
    }
    return best;
  }

  private toggleDoor(piece: Piece): void {
    piece.open = !piece.open;
    // Opening frees the way at once; closing blocks it once the door is shut.
    if (piece.open) {
      this.setLeafCollider(piece, false);
    }
  }

  private animateDoors(seconds: number): void {
    const step = seconds / CONFIG.building.doorSeconds;
    for (const piece of this.pieces.values()) {
      if (!piece.leaf || piece.opening === undefined) {
        continue;
      }
      const target = piece.open ? 1 : 0;
      if (piece.opening === target) {
        continue;
      }
      piece.opening = Math.max(
        0,
        Math.min(1, piece.opening + (target > piece.opening ? step : -step)),
      );
      // R chose the side it swings to.
      const side = piece.turn % 2 === 0 ? -1 : 1;
      piece.leaf.rotation.y = side * piece.opening * 1.75;
      if (piece.opening === 0 && !piece.open) {
        this.setLeafCollider(piece, true);
      }
    }
  }
}

/** The two ends of a wall's edge, on the ground plane. */
function edgeEnds(slot: Slot): { from: Vector3; to: Vector3 } {
  const { cell } = CONFIG.building;
  if (slot.axis === "x") {
    return {
      from: new Vector3(slot.i * cell, 0, slot.j * cell),
      to: new Vector3((slot.i + 1) * cell, 0, slot.j * cell),
    };
  }
  return {
    from: new Vector3(slot.i * cell, 0, slot.j * cell),
    to: new Vector3(slot.i * cell, 0, (slot.j + 1) * cell),
  };
}

function distanceToSegment(x: number, z: number, from: Vector3, to: Vector3): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared > 0
      ? Math.max(0, Math.min(1, ((x - from.x) * dx + (z - from.z) * dz) / lengthSquared))
      : 0;
  return Math.hypot(x - (from.x + t * dx), z - (from.z + t * dz));
}

/** True if segment A crosses segment B (seen from above). */
function segmentsCross(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const cross = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) =>
    (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = cross(cx, cz, dx, dz, ax, az);
  const d2 = cross(cx, cz, dx, dz, bx, bz);
  const d3 = cross(ax, az, bx, bz, cx, cz);
  const d4 = cross(ax, az, bx, bz, dx, dz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
