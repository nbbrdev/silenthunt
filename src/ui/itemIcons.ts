import {
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  Scene,
  Tools,
  TransformNode,
  Vector3,
  type Engine,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { createItemModel } from "../models/items/itemModels";
import { ALL_ITEMS, type ItemId } from "../player/items";

/**
 * The inventory icons (IN7-A): a small picture of each item's own 3D model, taken once when the
 * game starts, in a scene of its own (no fog, soft light, transparent background). Each item lies
 * flat with its long side along the picture's diagonal, seen a little from above, and fills the
 * picture. Returns an image (data URL) per item.
 */
export async function createItemIcons(engine: Engine): Promise<Record<ItemId, string>> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const sky = new HemisphericLight("iconSky", new Vector3(0, 1, 0), scene);
  sky.intensity = 1.3;
  sky.groundColor = new Color3(0.45, 0.42, 0.4);
  const sun = new DirectionalLight("iconSun", new Vector3(-0.4, -1, 0.5), scene);
  sun.intensity = 1.4;
  // Looking toward +Z and down 35°; orthographic, so it can be framed exactly.
  const camera = new ArcRotateCamera("iconCamera", -Math.PI / 2, 0.6, 5, Vector3.Zero(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.01;
  camera.maxZ = 20;

  const size = CONFIG.inventory.iconPx;
  const icons = {} as Record<ItemId, string>;
  for (const item of ALL_ITEMS) {
    const holder = new TransformNode(`icon-${item}`, scene);
    const model = createItemModel(scene, item);
    model.parent = holder;
    // The long side along X (the bow stands upright, the knife points along Z)...
    const box = model.getHierarchyBoundingVectors(true);
    const extent = box.max.subtract(box.min);
    if (extent.y >= extent.x && extent.y >= extent.z) {
      model.rotation.z = Math.PI / 2;
    } else if (extent.z > extent.x) {
      model.rotation.y = Math.PI / 2;
    }
    // ...then turned to lie along the picture's diagonal.
    holder.rotation.y = -Math.PI / 4;

    const { min, max } = holder.getHierarchyBoundingVectors(true);
    camera.target = min.add(max).scale(0.5);
    camera.radius = 5;
    const view = camera.getViewMatrix(true);
    let half = 0;
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) {
          const seen = Vector3.TransformCoordinates(new Vector3(x, y, z), view);
          half = Math.max(half, Math.abs(seen.x), Math.abs(seen.y));
        }
      }
    }
    half *= 1.08;
    camera.orthoLeft = -half;
    camera.orthoRight = half;
    camera.orthoTop = half;
    camera.orthoBottom = -half;

    icons[item] = await Tools.CreateScreenshotUsingRenderTargetAsync(
      engine,
      camera,
      { width: size, height: size },
      "image/png",
      4,
      true,
    );
    // The materials are shared by the models of this scene: they go with the scene, at the end.
    holder.dispose(false, false);
  }
  scene.dispose();
  return icons;
}
