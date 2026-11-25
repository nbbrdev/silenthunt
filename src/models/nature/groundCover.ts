import { Color3, MeshBuilder, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomInRange, randomInt, randomRange } from "../../core/random";
import { CardBuilder } from "../cards";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials, getPlainMaterial } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

type RGB = { readonly r: number; readonly g: number; readonly b: number };

/** One of the palette's colors, picked by the seed. */
function pick(colors: readonly RGB[], random: () => number): Color3 {
  const color = colors[Math.floor(random() * colors.length)] ?? colors[0];
  return color ? toColor(color) : Color3.White();
}

/**
 * NBB-170 (SL1-A): lively grass: a full clump of crossed cards, each of its own shade, from deep
 * green to a little dry.
 */
export const lushGrass: ModelGenerator = {
  id: "lush-grass",
  label: "Grama viva",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.lushGrass;
    const height = randomInRange(random, settings.height);
    const count = randomInt(random, settings.cards);
    const cards = new CardBuilder();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI + randomRange(random, -0.3, 0.3);
      const tall = height * randomRange(random, 0.7, 1.15);
      const offset = new Vector3(
        randomRange(random, -0.08, 0.08),
        0,
        randomRange(random, -0.08, 0.08),
      );
      cards.addCard(
        offset.add(new Vector3(0, tall / 2, 0)),
        tall * randomRange(random, 0.9, 1.3),
        tall,
        new Vector3(Math.cos(angle), 0, Math.sin(angle)),
        Vector3.Up(),
      );
    }
    const palette = CONFIG.palette;
    const fresh = toColor(palette.freshGrass);
    const dry = toColor(palette.dryGrass);
    const base = Color3.Lerp(fresh, dry, randomRange(random, 0, 0.45));
    const clump = cards.build("lushGrass", scene, new Vector3(0, -height, 0));
    // Greener at the foot, a touch lighter at the tips.
    paint(clump, (_x, y) => base.scale(0.85 + 0.35 * Math.min(1, y / height)), seed);
    clump.material = getModelMaterials(scene).leaves.lushGrass;
    return { root: clump, animations: [] };
  },
};

/** NBB-170 (SL1-A): a fern: fronds arching out from the middle, all around. */
export const fern: ModelGenerator = {
  id: "fern",
  label: "Samambaia",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.fern;
    const height = randomInRange(random, settings.height);
    const count = randomInt(random, settings.fronds);
    const cards = new CardBuilder();
    for (let i = 0; i < count; i++) {
      const azimuth = (i / count) * Math.PI * 2 + randomRange(random, -0.3, 0.3);
      // Fronds open wide, arching out low.
      const rise = randomRange(random, 0.3, 0.65);
      const length = height * randomRange(random, 1.0, 1.4);
      // Along the frond (outward and up), and the card's face (up and in).
      const along = new Vector3(
        Math.cos(azimuth) * Math.cos(rise),
        Math.sin(rise),
        Math.sin(azimuth) * Math.cos(rise),
      );
      const face = new Vector3(
        -Math.cos(azimuth) * Math.sin(rise),
        Math.cos(rise),
        -Math.sin(azimuth) * Math.sin(rise),
      );
      cards.addCard(along.scale(length / 2), length * 0.45, length, face, along);
    }
    const frond = cards.build("fern", scene, new Vector3(0, -height, 0));
    const green = toColor(CONFIG.palette.fern).scale(randomRange(random, 0.85, 1.15));
    paint(frond, green, seed);
    frond.material = getModelMaterials(scene).leaves.fern;
    return { root: frond, animations: [] };
  },
};

/** NBB-170 (SL1-A): a little heap of fallen leaves, lying on the ground. */
export const leafPile: ModelGenerator = {
  id: "leaf-pile",
  label: "Folhas caídas",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.leafPile;
    const count = randomInt(random, settings.cards);
    const cards = new CardBuilder();
    for (let i = 0; i < count; i++) {
      const size = randomInRange(random, settings.size);
      const angle = random() * Math.PI * 2;
      const reach = Math.sqrt(random()) * settings.spread;
      // Flat on the ground, tilted a little, slightly heaped in the middle.
      const normal = new Vector3(
        randomRange(random, -0.25, 0.25),
        1,
        randomRange(random, -0.25, 0.25),
      );
      const turn = random() * Math.PI * 2;
      cards.addCard(
        new Vector3(
          Math.cos(angle) * reach,
          0.03 + (settings.spread - reach) * 0.05,
          Math.sin(angle) * reach,
        ),
        size,
        size,
        normal,
        new Vector3(Math.cos(turn), 0, Math.sin(turn)),
      );
    }
    const pile = cards.build("leafPile", scene, new Vector3(0, -1, 0));
    paint(pile, pick(CONFIG.palette.litter, random), seed);
    pile.material = getModelMaterials(scene).leaves.leafLitter;
    return { root: pile, animations: [] };
  },
};

/** NBB-170 (SL1-A): a small cluster of mushrooms, each a pale stem under a round cap. */
export const mushrooms: ModelGenerator = {
  id: "mushrooms",
  label: "Cogumelos",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.mushrooms;
    const count = randomInt(random, settings.count);
    const capColor = pick(CONFIG.palette.mushroomCaps, random);
    const stemColor = toColor(CONFIG.palette.mushroomStem);
    const parts: Mesh[] = [];
    for (let i = 0; i < count; i++) {
      const height = randomInRange(random, settings.height);
      const x = randomRange(random, -0.15, 0.15);
      const z = randomRange(random, -0.15, 0.15);
      const lean = randomRange(random, -0.2, 0.2);
      const stem = MeshBuilder.CreateCylinder(
        "mushroomStem",
        { height, diameterTop: height * 0.22, diameterBottom: height * 0.3, tessellation: 6 },
        scene,
      );
      stem.position.set(x, height / 2, z);
      stem.rotation.z = lean;
      bake(stem);
      paint(stem, stemColor, seed + i);
      // A low dome: a short cone, wide at the bottom, nearly closed at the top (few triangles).
      const width = height * randomRange(random, 0.8, 1.2);
      const cap = MeshBuilder.CreateCylinder(
        "mushroomCap",
        { height: width * 0.35, diameterTop: width * 0.3, diameterBottom: width, tessellation: 7 },
        scene,
      );
      cap.position.set(x - Math.sin(lean) * height, height * 0.95, z);
      bake(cap);
      paint(cap, capColor.scale(randomRange(random, 0.85, 1.1)), seed + 50 + i);
      parts.push(stem, cap);
    }
    const cluster = assemble("mushrooms", parts, getPlainMaterial(scene));
    return { root: cluster, animations: [] };
  },
};

/** NBB-170 (SL1-A): a few small wild flowers on thin stems, white, yellow or violet. */
export const flowers: ModelGenerator = {
  id: "flowers",
  label: "Flores",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.flowers;
    const count = randomInt(random, settings.stems);
    const stems = new CardBuilder();
    const blooms = new CardBuilder();
    for (let i = 0; i < count; i++) {
      const height = randomInRange(random, settings.height);
      const x = randomRange(random, -0.2, 0.2);
      const z = randomRange(random, -0.2, 0.2);
      const angle = random() * Math.PI;
      stems.addCard(
        new Vector3(x, height / 2, z),
        height * 0.35,
        height,
        new Vector3(Math.cos(angle), 0, Math.sin(angle)),
        Vector3.Up(),
      );
      const size = randomRange(random, 0.05, 0.09);
      const turn = random() * Math.PI * 2;
      blooms.addCard(
        // On the tallest blades of its stem card (the drawn blades stop short of the card's top).
        new Vector3(x, height * 0.75, z),
        size,
        size,
        new Vector3(randomRange(random, -0.4, 0.4), 1, randomRange(random, -0.4, 0.4)),
        new Vector3(Math.cos(turn), 0, Math.sin(turn)),
      );
    }
    const materials = getModelMaterials(scene);
    const stemMesh = stems.build("flowerStems", scene, new Vector3(0, -1, 0));
    paint(stemMesh, toColor(CONFIG.palette.freshGrass), seed);
    stemMesh.material = materials.leaves.lushGrass;
    const bloomMesh = blooms.build("flowerBlooms", scene, new Vector3(0, -1, 0));
    paint(bloomMesh, pick(CONFIG.palette.petals, random), seed + 1);
    bloomMesh.material = materials.leaves.petals;
    bloomMesh.parent = stemMesh;
    return { root: stemMesh, animations: [] };
  },
};

/** NBB-170 (SL1-A): a scatter of small flat stones (the ridge's gravel). */
export const pebbles: ModelGenerator = {
  id: "pebbles",
  label: "Pedrinhas",
  create(scene: Scene, seed: number): GeneratedModel {
    const random = createRandom(seed);
    const settings = CONFIG.models.pebbles;
    const count = randomInt(random, settings.count);
    const parts: Mesh[] = [];
    const rock = toColor(CONFIG.palette.rock);
    for (let i = 0; i < count; i++) {
      const size = randomInRange(random, settings.size);
      const stone = MeshBuilder.CreateIcoSphere(
        "pebble",
        { radius: size / 2, subdivisions: 1 },
        scene,
      );
      stone.scaling.set(randomRange(random, 0.9, 1.4), randomRange(random, 0.4, 0.6), 1);
      stone.rotation.y = random() * Math.PI;
      stone.position.set(
        randomRange(random, -0.4, 0.4),
        size * 0.12,
        randomRange(random, -0.4, 0.4),
      );
      bake(stone);
      jitter(stone, size * 0.12, seed + i);
      paint(stone, rock.scale(randomRange(random, 0.75, 1.15)), seed + i);
      parts.push(stone);
    }
    const scatter = assemble("pebbles", parts, getModelMaterials(scene).stone, {
      flatShaded: true,
    });
    return { root: scatter, animations: [] };
  },
};
