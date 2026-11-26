import {
  Color3,
  Mesh,
  Vector2,
  VertexData,
  type Scene,
  type ShaderMaterial,
} from "@babylonjs/core";
import { WaterMaterial } from "@babylonjs/materials";
import { CONFIG } from "../config";
import { getSurfaceTextures } from "../models/surfaceTextures";
import type { ChunkInfo, ChunkManager } from "./chunks";
import type { Terrain } from "./terrain";
import type { VegetationLibrary } from "./vegetation";
import { createFlowMaterial } from "./waterFlow";

/**
 * The water's surface (NBB-164; BI6-B, AG8-A): for each loaded chunk, a sheet over its rivers and
 * lakes, at the water's level, drawn with Babylon's water material (waves, reflection and
 * refraction). It reflects the ground and the trees; the banks rise above it, so it ends where
 * the land does.
 */
export class WaterSurfaces {
  private readonly scene: Scene;
  private readonly terrain: Terrain;
  private readonly chunks: ChunkManager;
  readonly material: WaterMaterial;
  private readonly meshes = new Map<string, Mesh>();
  /** The ground meshes in the reflection, by chunk (taken out when their chunk unloads). */
  private readonly grounds = new Map<string, Mesh>();
  /** NBB-172 (AF1-A): the current's layer, by chunk, and its material. */
  private readonly flows = new Map<string, Mesh>();
  private readonly flowMaterial: ShaderMaterial;

  constructor(scene: Scene, terrain: Terrain, chunks: ChunkManager, library: VegetationLibrary) {
    this.scene = scene;
    this.terrain = terrain;
    this.chunks = chunks;
    const settings = CONFIG.waterSurface;
    const size = settings.reflectionSize;
    this.material = new WaterMaterial("water", scene, new Vector2(size, size));
    this.material.bumpTexture = getSurfaceTextures(scene, "water").normal;
    this.material.windForce = settings.windForce;
    this.material.waveHeight = 0;
    this.material.bumpHeight = settings.bumpHeight;
    this.material.waveLength = settings.waveLength;
    this.material.waterColor = toColor(settings.color);
    this.material.colorBlendFactor = settings.colorBlend;
    this.material.backFaceCulling = false;
    this.flowMaterial = createFlowMaterial(scene);
    // The water reflects the ground and the trees (AG8-A).
    for (const mesh of library.treeMeshes()) {
      this.material.addToRenderList(mesh);
    }
    chunks.onChunkLoaded.add((chunk) => this.build(chunk));
    chunks.onChunkUnloaded.add((chunk) => this.remove(chunk.key));
  }

  /** Development: how many chunks have water now. */
  get count(): number {
    return this.meshes.size;
  }

  /** Development (NBB-172): how many chunks have a current's layer, and whether its shader is ready. */
  get flowState(): { layers: number; ready: boolean } {
    const any = [...this.flows.values()][0];
    return { layers: this.flows.size, ready: any ? this.flowMaterial.isReady(any) : false };
  }

  private build(chunk: ChunkInfo): void {
    const ground = this.chunks.terrainMeshOf(chunk.key);
    if (ground) {
      this.material.addToRenderList(ground);
      this.grounds.set(chunk.key, ground);
    }
    const { chunkSize } = CONFIG.world;
    const cell = CONFIG.waterSurface.cell;
    const cells = Math.round(chunkSize / cell);
    const originX = chunk.cx * chunkSize;
    const originZ = chunk.cz * chunkSize;
    // The water's level at each grid corner (undefined where there is no water near).
    const levels: (number | undefined)[] = [];
    let sum = 0;
    let wet = 0;
    for (let row = 0; row <= cells; row++) {
      for (let col = 0; col <= cells; col++) {
        const shape = this.terrain.water.shapeAt(originX + col * cell, originZ + row * cell);
        levels.push(shape?.level);
        if (shape && shape.edge < 0) {
          sum += shape.level;
          wet++;
        }
      }
    }
    if (wet === 0) {
      return;
    }
    // The sheet sits at the chunk's average level (the material's reflection plane), its corners
    // at their own level.
    const base = sum / wet;
    const positions: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const { shoreAlpha, deepAlpha, clearDepth } = CONFIG.waterSurface.clarity;
    const vertexOf = new Map<number, number>();
    const vertex = (row: number, col: number): number => {
      const key = row * (cells + 1) + col;
      const existing = vertexOf.get(key);
      if (existing !== undefined) {
        return existing;
      }
      const index = positions.length / 3;
      const x = originX + col * cell;
      const z = originZ + row * cell;
      positions.push(x, (levels[key] ?? base) - base, z);
      uvs.push(x / 8, z / 8);
      // NBB-166 (AV10-A+B): shallow water lets the bed and the fish show through; deep water
      // keeps its dark reflection.
      const depth = (levels[key] ?? base) - this.terrain.heightAt(x, z);
      const deep = Math.min(1, Math.max(0, depth / clearDepth));
      colors.push(1, 1, 1, shoreAlpha + (deepAlpha - shoreAlpha) * deep);
      vertexOf.set(key, index);
      return index;
    };
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const corners = [
          row * (cells + 1) + col,
          row * (cells + 1) + col + 1,
          (row + 1) * (cells + 1) + col,
          (row + 1) * (cells + 1) + col + 1,
        ];
        // A quad wherever all its corners have water near (the banks hide its edges).
        if (corners.some((key) => levels[key] === undefined)) {
          continue;
        }
        // NBB-165: none across a waterfall's drop (the falling water is drawn there instead).
        const heights = corners.map((key) => levels[key] ?? base);
        if (Math.max(...heights) - Math.min(...heights) > CONFIG.water.falls.minDrop / 2) {
          continue;
        }
        const a = vertex(row, col);
        const b = vertex(row, col + 1);
        const c = vertex(row + 1, col);
        const d = vertex(row + 1, col + 1);
        indices.push(a, b, c, b, d, c);
      }
    }
    if (indices.length === 0) {
      return;
    }
    const mesh = new Mesh(`water-${chunk.key}`, this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.uvs = uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    data.colors = colors;
    data.applyToMesh(mesh, false);
    mesh.hasVertexAlpha = true;
    mesh.position.y = base;
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    this.meshes.set(chunk.key, mesh);
    this.buildFlow(chunk.key, levels, base, cells, originX, originZ);
  }

  /**
   * NBB-172 (AF1-A): the current's layer over this chunk's rivers: the same grid as the water's
   * sheet, a little above it, each corner carrying its current in its color (see waterFlow.ts).
   */
  private buildFlow(
    key: string,
    levels: readonly (number | undefined)[],
    base: number,
    cells: number,
    originX: number,
    originZ: number,
  ): void {
    const cell = CONFIG.waterSurface.cell;
    const lift = CONFIG.waterSurface.flowLayer.lift;
    const maxSpeed = CONFIG.water.flow.maxSpeed;
    const flows = levels.map((level, index) => {
      if (level === undefined) {
        return undefined;
      }
      const col = index % (cells + 1);
      const row = Math.floor(index / (cells + 1));
      return this.terrain.water.flowAt(originX + col * cell, originZ + row * cell);
    });
    if (!flows.some((flow) => flow !== undefined)) {
      return;
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const vertexOf = new Map<number, number>();
    const vertex = (row: number, col: number): number => {
      const index = row * (cells + 1) + col;
      const existing = vertexOf.get(index);
      if (existing !== undefined) {
        return existing;
      }
      const id = positions.length / 3;
      positions.push(
        originX + col * cell,
        (levels[index] ?? base) - base + lift,
        originZ + row * cell,
      );
      const flow = flows[index];
      if (flow) {
        colors.push(
          flow.dirX * 0.5 + 0.5,
          flow.dirZ * 0.5 + 0.5,
          Math.min(1, flow.speed / maxSpeed),
          flow.share,
        );
      } else {
        colors.push(0.5, 0.5, 0, 0);
      }
      vertexOf.set(index, id);
      return id;
    };
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const corners = [
          row * (cells + 1) + col,
          row * (cells + 1) + col + 1,
          (row + 1) * (cells + 1) + col,
          (row + 1) * (cells + 1) + col + 1,
        ];
        if (corners.some((index) => levels[index] === undefined)) {
          continue;
        }
        if (!corners.some((index) => flows[index] !== undefined)) {
          continue;
        }
        const heights = corners.map((index) => levels[index] ?? base);
        if (Math.max(...heights) - Math.min(...heights) > CONFIG.water.falls.minDrop / 2) {
          continue;
        }
        const a = vertex(row, col);
        const b = vertex(row, col + 1);
        const c = vertex(row + 1, col);
        const d = vertex(row + 1, col + 1);
        indices.push(a, b, c, b, d, c);
      }
    }
    if (indices.length === 0) {
      return;
    }
    const mesh = new Mesh(`waterFlow-${key}`, this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    data.applyToMesh(mesh, false);
    mesh.position.y = base;
    mesh.material = this.flowMaterial;
    mesh.isPickable = false;
    mesh.hasVertexAlpha = true;
    mesh.freezeWorldMatrix();
    this.flows.set(key, mesh);
  }

  private remove(key: string): void {
    const ground = this.grounds.get(key);
    if (ground) {
      this.material.removeFromRenderList(ground);
      this.grounds.delete(key);
    }
    const mesh = this.meshes.get(key);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(key);
    }
    this.flows.get(key)?.dispose();
    this.flows.delete(key);
  }
}

function toColor(rgb: { r: number; g: number; b: number }): Color3 {
  return new Color3(rgb.r, rgb.g, rgb.b);
}
