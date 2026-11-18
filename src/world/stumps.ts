import type { InstancedMesh, Mesh, Scene } from "@babylonjs/core";
import { createStumpMesh } from "../models/nature/stump";
import type { ChunkManager, Choppable } from "./chunks";

/**
 * The stumps of felled trees (NBB-144, MC1-A). They come from each chunk's changes, so a stump is
 * still there when its chunk loads again; each one is a copy of one mesh, scaled to its trunk.
 */
export class StumpField {
  private readonly template: Mesh;
  private readonly byChunk = new Map<string, InstancedMesh[]>();

  constructor(scene: Scene, chunks: ChunkManager) {
    this.template = createStumpMesh(scene);
    this.template.setEnabled(false);
    chunks.onChunkLoaded.add((chunk) => {
      for (const tree of chunks.felledTrees(chunk.key)) {
        this.add(tree);
      }
    });
    chunks.onChunkUnloaded.add((chunk) => {
      for (const stump of this.byChunk.get(chunk.key) ?? []) {
        stump.dispose();
      }
      this.byChunk.delete(chunk.key);
    });
  }

  /** NBB-147: after a saved game is loaded, the stumps of the chunks loaded now. */
  rebuild(chunks: ChunkManager): void {
    for (const stumps of this.byChunk.values()) {
      for (const stump of stumps) {
        stump.dispose();
      }
    }
    this.byChunk.clear();
    for (const chunk of chunks.loadedChunks()) {
      for (const tree of chunks.felledTrees(chunk.key)) {
        this.add(tree);
      }
    }
  }

  /** A stump where this tree stood. */
  add(tree: Choppable): void {
    const stump = this.template.createInstance(`stump-${tree.chunkKey}:${tree.index}`);
    stump.setEnabled(true);
    stump.position.set(tree.x, tree.y + 0.15, tree.z);
    stump.rotation.y = tree.rotation;
    // A little wider than the trunk measured at 1 m high: trunks flare at the base.
    const radius = tree.radius * 1.15;
    stump.scaling.set(radius, 1, radius);
    const list = this.byChunk.get(tree.chunkKey) ?? [];
    list.push(stump);
    this.byChunk.set(tree.chunkKey, list);
  }
}
