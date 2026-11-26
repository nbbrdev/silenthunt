import type { Nullable, TransformNode } from "@babylonjs/core";

/** Every animal that can be hunted: the prey (NBB-138, NBB-166) and the hostile ones (NBB-167). */
export type HuntKind = "rabbit" | "deer" | "fox" | "wolf" | "boar" | "bear";

/** What hit it. */
export type Weapon = "knife" | "arrow" | "shotgun";

/**
 * NBB-167: what the weapons and the carcasses need from an animal, prey or hostile: where its
 * body is, whether it is dead, and taking a hit (each kind answers in its own way: a grazing
 * rabbit dies to the knife, a bear takes six stabs).
 */
export interface Huntable {
  readonly kind: HuntKind;
  /** Identifies it in the world ("chunkKey:index"), so a dead one stays dead. */
  readonly id: string;
  readonly isActive: boolean;
  readonly isDead: boolean;
  readonly attachedNode: Nullable<TransformNode>;
  hit(weapon: Weapon): void;
  /** Dies at once (development, and the prey's sure kills). */
  kill(): void;
}
