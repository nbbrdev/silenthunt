import {
  Color3,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { getSurfaceTextures } from "../surfaceTextures";

const furMaterialByScene = new WeakMap<Scene, StandardMaterial>();

/** Fur (NBB-137): the fur texture and its relief, tinted by each animal's vertex colors. */
export function getFurMaterial(scene: Scene): StandardMaterial {
  const existing = furMaterialByScene.get(scene);
  if (existing) {
    return existing;
  }
  const material = new StandardMaterial("animalFur", scene);
  const fur = getSurfaceTextures(scene, "fur");
  material.diffuseTexture = fur.color;
  material.bumpTexture = fur.normal;
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  furMaterialByScene.set(scene, material);
  return material;
}

/**
 * Squashes a part sideways around x = 0 (bodies and heads are taller than wide). Done before the
 * skin weights, so the bones follow the final shape.
 */
export function narrow(mesh: Mesh, factor: number): Mesh {
  mesh.scaling.x *= factor;
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

/** A flat, leaf-shaped ear from `base` to `tip`, `width` wide and `thickness` thick. */
export function ear(
  scene: Scene,
  name: string,
  base: Vector3,
  tip: Vector3,
  width: number,
  thickness: number,
): Mesh {
  const along = tip.subtract(base);
  const length = along.length();
  const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 4 }, scene);
  mesh.scaling.set(width, length, thickness);
  const turn = new Quaternion();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), along.normalize(), turn);
  mesh.rotationQuaternion = turn;
  mesh.position = base.add(tip).scale(0.5);
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

/** A small sphere (eyes, noses, a rabbit's tail). */
export function blob(
  scene: Scene,
  name: string,
  center: Vector3,
  diameter: number,
  segments = 3,
): Mesh {
  const mesh = MeshBuilder.CreateSphere(name, { diameter, segments }, scene);
  mesh.position = center;
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}
