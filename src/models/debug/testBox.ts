import {
  Animation,
  AnimationGroup,
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";
import { createRandom, randomRange } from "../../core/random";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Placeholder model that demonstrates the gallery (GL2-A): size and color vary with the seed. */
export const testBox: ModelGenerator = {
  id: "test-box",
  label: "Caixa de teste",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const size = randomRange(random, 0.6, 1.4);

    const box = MeshBuilder.CreateBox("testBox", { size }, scene);
    box.position.y = size / 2;

    const material = new StandardMaterial("testBoxMaterial", scene);
    material.diffuseColor = new Color3(
      randomRange(random, 0.3, 0.6),
      randomRange(random, 0.2, 0.4),
      randomRange(random, 0.1, 0.3),
    );
    // Matte, like the rest of the low-poly style (C4-A): no shiny highlight washing out the color.
    material.specularColor = Color3.Black();
    box.material = material;

    const spin = new Animation(
      "testBoxSpin",
      "rotation.y",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    spin.setKeys([
      { frame: 0, value: 0 },
      { frame: 60, value: Math.PI * 2 },
    ]);
    const spinGroup = new AnimationGroup("Girar", scene);
    spinGroup.addTargetedAnimation(spin, box);

    return { root: box, animations: [spinGroup] };
  },
};
