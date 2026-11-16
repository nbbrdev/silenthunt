import type { AnimationGroup, Scene, TransformNode } from "@babylonjs/core";

/** What a procedural model generator returns. */
export interface GeneratedModel {
  /** Root of the model; every mesh of the model is this node or one of its children. */
  root: TransformNode;
  /** Named animations the model can play (empty for static models). */
  animations: AnimationGroup[];
}

/** A procedural model that can be shown in the gallery (and used by the game). */
export interface ModelGenerator {
  id: string;
  /** Name shown in the gallery (pt-BR). */
  label: string;
  /** Builds the model. The same seed must always build the same model. */
  create(scene: Scene, seed: number): GeneratedModel;
}
