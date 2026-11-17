import { TransformNode, type Scene } from "@babylonjs/core";
import type { ItemId } from "../../player/items";
import { groundBranch } from "../nature/groundBranch";
import { rock } from "../nature/rock";
import { createArrowMesh, createBowModel } from "./bow";
import { createKnifeMesh } from "./knife";
import { createMeatModel } from "./meat";
import {
  createCartridgeMesh,
  createFatMesh,
  createFiberMesh,
  createLeatherMesh,
} from "./resources";
import { createShotgunModel } from "./shotgun";

/** The world's branch and rock are scaled to a size that fits in a hand (meters, longest side). */
const HAND_SIZE: Partial<Record<ItemId, number>> = { branch: 0.5, stone: 0.11 };

/**
 * The model of any item (NBB-143): for the hand (IN6-B) and the inventory icons (IN7-A). It
 * stands at its real size, centered on the origin.
 */
export function createItemModel(scene: Scene, item: ItemId): TransformNode {
  const root = new TransformNode(`item-${item}`, scene);
  const model = buildModel(scene, item);
  model.parent = root;
  const { min, max } = root.getHierarchyBoundingVectors(true);
  const size = max.subtract(min);
  const target = HAND_SIZE[item];
  const scale = target ? target / Math.max(size.x, size.y, size.z) : 1;
  model.scaling.scaleInPlace(scale);
  // Centered, so it turns around its middle in the hand and fills its icon.
  const center = min.add(max).scale(0.5 * scale);
  model.position.subtractInPlace(center);
  return root;
}

function buildModel(scene: Scene, item: ItemId): TransformNode {
  switch (item) {
    case "knife":
      return createKnifeMesh(scene);
    case "bow":
      return createBowModel(scene).root;
    case "shotgun":
      return createShotgunModel(scene).root;
    case "arrow":
      return createArrowMesh(scene);
    case "cartridge":
      return createCartridgeMesh(scene);
    case "branch":
      return groundBranch.create(scene, 3).root;
    case "stone":
      return rock.create(scene, 5).root;
    case "fiber":
      return createFiberMesh(scene);
    case "fat":
      return createFatMesh(scene);
    case "leather":
      return createLeatherMesh(scene);
    case "rawMeat":
    case "cookedMeat": {
      const meat = createMeatModel(scene, item);
      meat.setCooked(item === "cookedMeat" ? 1 : 0);
      return meat.flesh;
    }
  }
}
