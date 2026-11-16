import { MeshBuilder, Quaternion, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Oak (W1): thick trunk splitting into 2–3 branches, canopy of 4–6 irregular blobs. ~500 tris. */
export const oak: ModelGenerator = {
  id: "oak",
  label: "Carvalho",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.oak;
    const height = randomInRange(random, settings.height);
    const trunkHeight = height * 0.45;
    const bark = toColor(CONFIG.palette.bark);

    const trunk = MeshBuilder.CreateCylinder(
      "oakTrunk",
      {
        height: trunkHeight,
        diameterTop: height * 0.06,
        diameterBottom: height * 0.09,
        tessellation: 7,
      },
      scene,
    );
    trunk.position.y = trunkHeight / 2;
    paint(bake(trunk), bark, seed);
    const parts: Mesh[] = [trunk];

    const branchCount = randomInt(random, settings.branches);
    const branchLength = height * 0.3;
    for (let i = 0; i < branchCount; i++) {
      const azimuth = (i / branchCount) * Math.PI * 2 + randomRange(random, -0.4, 0.4);
      const lean = randomRange(random, 0.5, 0.8);
      const direction = new Vector3(
        Math.sin(lean) * Math.cos(azimuth),
        Math.cos(lean),
        Math.sin(lean) * Math.sin(azimuth),
      );
      const branch = MeshBuilder.CreateCylinder(
        `oakBranch${i}`,
        {
          height: branchLength,
          diameterTop: height * 0.02,
          diameterBottom: height * 0.04,
          tessellation: 5,
        },
        scene,
      );
      branch.rotationQuaternion = Quaternion.Identity();
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction, branch.rotationQuaternion);
      branch.position = new Vector3(0, trunkHeight * 0.95, 0).add(
        direction.scale(branchLength / 2),
      );
      paint(bake(branch), bark, seed + i);
      parts.push(branch);
    }

    const blobCount = randomInt(random, settings.blobs);
    const canopyCenterY = trunkHeight + height * 0.28;
    for (let i = 0; i < blobCount; i++) {
      const radius = height * randomRange(random, 0.17, 0.24);
      const angle = random() * Math.PI * 2;
      const distance = height * randomRange(random, 0, 0.22);
      const blob = MeshBuilder.CreateIcoSphere(
        `oakBlob${i}`,
        { radius, subdivisions: 2, flat: true },
        scene,
      );
      blob.position.set(
        Math.cos(angle) * distance,
        canopyCenterY + height * randomRange(random, -0.1, 0.12),
        Math.sin(angle) * distance,
      );
      blob.scaling.y = 0.8;
      bake(blob);
      jitter(blob, radius * 0.15, seed + 100 + i);
      paint(blob, toColor(CONFIG.palette.oakLeaves), seed + 200 + i);
      parts.push(blob);
    }

    const tree = assemble("oak", parts, getModelMaterials(scene).foliage);
    return { root: tree, animations: [] };
  },
};
