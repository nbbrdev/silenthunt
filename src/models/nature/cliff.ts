import { Color3, MeshBuilder, VertexBuffer, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, hashPosition, randomInRange, randomRange } from "../../core/random";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials, getWetMaterial } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

/** Cold gray stone with darker layers across it and lichen where the top catches the light. */
function paintStone(part: Mesh, top: number, seed: number): void {
  const rock = toColor(CONFIG.palette.cliffRock);
  const streak = toColor(CONFIG.palette.cliffStreak);
  const lichen = toColor(CONFIG.palette.lichen);
  paint(
    part,
    (x, y, z) => {
      if (y > top) {
        return Color3.Lerp(rock, lichen, 0.7);
      }
      // Layers of the rock: bands across, some darker.
      const layer = hashPosition(0, Math.floor(y / 0.7), 0, seed);
      const broken = hashPosition(Math.round(x), Math.floor(y / 0.7), Math.round(z), seed + 1);
      return layer > 0.55 && broken > 0.25 ? Color3.Lerp(rock, streak, 0.8) : rock;
    },
    seed,
  );
}

/**
 * Rock wall (BM4-A, NBB-163): a tall, wide slab of layered stone for the ridge's steep steps,
 * with a buttress at one side. Faceted like the rocks. About 500 triangles (limit 600).
 */
export const cliff: ModelGenerator = {
  id: "cliff",
  label: "Paredão",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.cliff;
    const width = randomInRange(random, settings.width);
    const height = randomInRange(random, settings.height);
    const depth = randomInRange(random, settings.depth);

    // Layers of stone stacked like the strata of a rock face, each made of a few blocks of
    // different widths, stepping back a little as they rise. Sunk 0.4 m into the slope.
    const blocks: Mesh[] = [];
    const layers = Math.max(3, Math.round(height / 1.2));
    const layerHeight = height / layers;
    for (let layer = 0; layer < layers; layer++) {
      const pieces = 2 + Math.floor(random() * 3);
      // Higher layers are a little narrower and set back: the face leans into the slope.
      const layerWidth = width * (1 - (layer / layers) * 0.25);
      let x = -layerWidth / 2;
      for (let piece = 0; piece < pieces; piece++) {
        const share =
          piece === pieces - 1
            ? -x + layerWidth / 2
            : (layerWidth / pieces) * randomRange(random, 0.7, 1.3);
        const blockHeight = layerHeight * randomRange(random, 0.9, 1.15);
        const block = MeshBuilder.CreateBox(
          `cliffBlock${layer}-${piece}`,
          {
            width: share * 1.04,
            height: blockHeight,
            depth: depth * randomRange(random, 0.75, 1.05),
          },
          scene,
        );
        block.position.set(
          x + share / 2,
          layer * layerHeight + blockHeight / 2 - 0.4,
          -layer * 0.18 + randomRange(random, -0.25, 0.25),
        );
        block.rotation.y = randomRange(random, -0.06, 0.06);
        bake(block);
        jitter(block, layerHeight * 0.12, seed + layer * 10 + piece);
        paintStone(block, height * 0.9 - 0.4, seed + layer);
        blocks.push(block);
        x += share;
      }
    }
    // A few fallen blocks at its foot.
    for (let i = 0; i < 3; i++) {
      const size = layerHeight * randomRange(random, 0.6, 1);
      const fallen = MeshBuilder.CreateBox(`cliffFallen${i}`, { size }, scene);
      fallen.position.set(
        randomRange(random, -width / 2, width / 2),
        size * 0.3 - 0.2,
        depth * 0.7,
      );
      fallen.rotation.set(
        randomRange(random, -0.4, 0.4),
        random() * Math.PI,
        randomRange(random, -0.4, 0.4),
      );
      bake(fallen);
      jitter(fallen, size * 0.15, seed + 100 + i);
      paintStone(fallen, size, seed + 200);
      blocks.push(fallen);
    }
    const model = assemble("cliff", blocks, getModelMaterials(scene).stone, { flatShaded: true });
    return { root: model, animations: [] };
  },
};

/** Boulder (BM4-A, NBB-163): a big rock of the ridge, for the axe. About 180 triangles (≤ 300). */
export const boulder: ModelGenerator = {
  id: "boulder",
  label: "Pedra grande",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const size = randomInRange(random, CONFIG.models.boulder.size);
    const stone = MeshBuilder.CreateIcoSphere(
      "boulderBody",
      { radius: size / 2, subdivisions: 3, flat: true },
      scene,
    );
    stone.scaling.set(randomRange(random, 0.95, 1.25), randomRange(random, 0.65, 0.85), 1);
    stone.rotation.y = random() * Math.PI;
    stone.position.y = size * 0.2;
    bake(stone);
    jitter(stone, size * 0.1, seed);
    paintStone(stone, size * 0.42, seed);
    const model = assemble("boulder", [stone], getModelMaterials(scene).stone, {
      flatShaded: true,
    });
    return { root: model, animations: [] };
  },
};

/** Mud puddle (BM4-A, NBB-163): a flat, uneven patch of wet mud for the marsh. ~16 triangles. */
export const puddle: ModelGenerator = {
  id: "puddle",
  label: "Poça de lama",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const radius = randomInRange(random, CONFIG.models.puddle.radius);
    const disc = MeshBuilder.CreateDisc("puddle", { radius, tessellation: 16 }, scene);
    disc.rotation.x = Math.PI / 2;
    bake(disc);
    // A soft, uneven edge: the rim bulges in and out in a few slow waves around it; everything
    // just above the ground.
    const phaseA = random() * Math.PI * 2;
    const phaseB = random() * Math.PI * 2;
    const stretch = randomRange(random, 0.6, 0.9);
    const positions = disc.getVerticesData(VertexBuffer.PositionKind) ?? [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] ?? 0;
      const z = positions[i + 2] ?? 0;
      const angle = Math.atan2(z, x);
      const reach =
        0.85 + 0.12 * Math.sin(angle * 2 + phaseA) + 0.08 * Math.sin(angle * 3 + phaseB);
      positions[i] = x * reach;
      positions[i + 1] = 0.03;
      positions[i + 2] = z * reach * stretch;
    }
    disc.setVerticesData(VertexBuffer.PositionKind, positions);
    paint(disc, toColor(CONFIG.palette.mud), seed);
    disc.material = getWetMaterial(scene);
    return { root: disc, animations: [] };
  },
};
