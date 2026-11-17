import {
  Color3,
  Color4,
  MeshBuilder,
  ParticleSystem,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom } from "../../core/random";
import { getGlowLayer } from "../../core/postProcessing";
import { getFlameMaterial } from "../items/torch";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import { tube } from "../rig/skin";
import { getSoftDotTexture } from "../textures";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** The crossbar of the spit: its height and how far the forked sticks stand from the center. */
const SPIT_HEIGHT = 0.72;
const SPIT_HALF = 0.62;

export interface CampfireModel {
  root: TransformNode;
  /** Where the flames are, for the light. */
  flameCenter: Vector3;
  /** The glowing flame cores: scale them to make the fire breathe. */
  cores: Mesh[];
  fire: ParticleSystem;
  /** CZ2-A: where each piece of meat hangs from the spit (model space). */
  spitSlots: Vector3[];
}

/**
 * The campfire (NBB-142, CZ1-A, CZ3): a ring of stones, charred logs leaning together over the
 * ash and a spit on two forked sticks. The flames are the torch's (glowing cores plus fire
 * particles), only bigger.
 */
export function createCampfireModel(scene: Scene, seed: number): CampfireModel {
  const random = createRandom(seed);
  const materials = getModelMaterials(scene);
  const root = new TransformNode("campfire", scene);

  // --- Stones in a ring.
  const stoneColor = toColor(CONFIG.palette.rock);
  const stones: Mesh[] = [];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + random() * 0.2;
    const size = 0.16 + random() * 0.08;
    const stone = MeshBuilder.CreateSphere("campfireStone", { diameter: 1, segments: 2 }, scene);
    stone.scaling.set(size * 1.2, size * 0.7, size);
    stone.rotation.y = random() * Math.PI;
    stone.position.set(Math.cos(angle) * 0.46, size * 0.22, Math.sin(angle) * 0.46);
    stone.bakeCurrentTransformIntoVertices();
    jitter(stone, size * 0.12, i + 1);
    // Soot on the side facing the fire.
    const shade = 0.85 + random() * 0.15;
    paint(stone, (x, _y, z) => stoneColor.scale(shade * (Math.hypot(x, z) < 0.44 ? 0.55 : 1)), i);
    stones.push(stone);
  }
  assemble("campfireStones", stones, materials.stone, { flatShaded: true }).parent = root;

  // --- Ash bed and logs.
  const ash = MeshBuilder.CreateCylinder(
    "campfireAsh",
    { height: 0.03, diameterTop: 0.62, diameterBottom: 0.7, tessellation: 10 },
    scene,
  );
  ash.position.y = 0.015;
  ash.bakeCurrentTransformIntoVertices();
  jitter(ash, 0.01, 9);
  paint(ash, toColor(CONFIG.palette.ash), 11);

  const bark = toColor(CONFIG.palette.bark);
  const charcoal = toColor(CONFIG.palette.charcoal);
  const logs: Mesh[] = [ash];
  const logCount = 5;
  for (let i = 0; i < logCount; i++) {
    const angle = (i / logCount) * Math.PI * 2 + random() * 0.4;
    const foot = v(Math.cos(angle) * 0.34, 0.03, Math.sin(angle) * 0.34);
    const top = v(Math.cos(angle) * 0.04, 0.34 + random() * 0.06, Math.sin(angle) * 0.04);
    const log = tube(scene, "campfireLog", [foot, top], () => 0.035, 6, 0.4, 1);
    // Charred toward the flames.
    paint(log, (_x, y) => Color3.Lerp(bark, charcoal, Math.min(1, y / 0.25)), 20 + i);
    logs.push(log);
  }
  assemble("campfireLogs", logs, materials.fallenWood).parent = root;

  // --- The spit: two forked sticks and a crossbar.
  const stickColor = toColor(CONFIG.palette.deadWood).scale(0.7);
  const sticks: Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * SPIT_HALF;
    sticks.push(
      tube(
        scene,
        "campfireStick",
        [v(x, 0, 0), v(x, SPIT_HEIGHT + 0.02, 0)],
        () => 0.016,
        5,
        0.4,
        1,
      ),
      tube(
        scene,
        "campfireFork",
        [v(x, SPIT_HEIGHT - 0.05, 0), v(x + side * 0.04, SPIT_HEIGHT + 0.07, 0.02)],
        () => 0.01,
        4,
        0.4,
        1,
      ),
    );
  }
  sticks.push(
    tube(
      scene,
      "campfireBar",
      [v(-SPIT_HALF - 0.08, SPIT_HEIGHT + 0.01, 0), v(SPIT_HALF + 0.08, SPIT_HEIGHT + 0.01, 0)],
      () => 0.012,
      5,
      0.4,
      1,
    ),
  );
  for (const stick of sticks) {
    paint(stick, stickColor, 30);
  }
  assemble("campfireSpit", sticks, materials.fallenWood).parent = root;

  // --- Flames: a few glowing cores among the logs, and the fire particles around them.
  const flameCenter = v(0, 0.22, 0);
  const flameMaterial = getFlameMaterial(scene);
  const cores: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const core = MeshBuilder.CreateSphere("campfireCore", { diameter: 0.1, segments: 6 }, scene);
    const angle = (i / 3) * Math.PI * 2;
    core.position = flameCenter.add(
      v(Math.cos(angle) * 0.05, -0.04 + i * 0.03, Math.sin(angle) * 0.05),
    );
    core.scaling.y = 1.8;
    core.material = flameMaterial;
    core.parent = root;
    getGlowLayer(scene).addIncludedOnlyMesh(core);
    cores.push(core);
  }

  // A tiny hidden box carries the particles (an emitter must be a mesh).
  const emitter = MeshBuilder.CreateBox("campfireEmitter", { size: 0.01 }, scene);
  emitter.isVisible = false;
  emitter.parent = root;
  emitter.position = flameCenter.clone();
  const fire = new ParticleSystem("campfireFire", 400, scene);
  fire.particleTexture = getSoftDotTexture(scene);
  fire.emitter = emitter;
  fire.isLocal = true;
  fire.minEmitBox = v(-0.14, -0.08, -0.14);
  fire.maxEmitBox = v(0.14, 0.02, 0.14);
  const flameColor = CONFIG.torch.flameColor;
  fire.color1 = new Color4(flameColor.r, flameColor.g, flameColor.b, 1);
  fire.color2 = new Color4(1, 0.3, 0.05, 1);
  fire.colorDead = new Color4(0.15, 0.05, 0, 0);
  fire.minSize = 0.1;
  fire.maxSize = 0.28;
  fire.minLifeTime = 0.3;
  fire.maxLifeTime = 0.7;
  fire.emitRate = 260;
  fire.blendMode = ParticleSystem.BLENDMODE_ADD;
  fire.direction1 = v(-0.12, 1, -0.12);
  fire.direction2 = v(0.12, 1, 0.12);
  fire.minEmitPower = 0.3;
  fire.maxEmitPower = 0.6;
  fire.gravity = v(0, 0.8, 0);
  fire.start();

  const spitSlots = [-0.3, -0.1, 0.1, 0.3].map((x) => v(x, SPIT_HEIGHT - 0.06, 0));
  return { root, flameCenter, cores, fire, spitSlots };
}

/** The campfire in the gallery (A2-C), burning. */
export const campfire: ModelGenerator = {
  id: "campfire",
  label: "Fogueira",
  create(scene: Scene, seed: number): GeneratedModel {
    return { root: createCampfireModel(scene, seed).root, animations: [] };
  },
};
