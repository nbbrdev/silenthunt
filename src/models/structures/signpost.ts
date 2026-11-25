import {
  Color3,
  DynamicTexture,
  Material,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../../config";
import { createRandom, randomRange } from "../../core/random";
import { assemble, bake, jitter, paint, toColor } from "../lowPoly";
import { getModelMaterials } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

const writingByScene = new WeakMap<Scene, StandardMaterial>();

/**
 * NBB-171 (PL3-A): the sign's writing, painted by hand in dark paint, drawn by code: "Cabana",
 * slanting a little, the paint thinner in places.
 */
function getWritingMaterial(scene: Scene): StandardMaterial {
  const existing = writingByScene.get(scene);
  if (existing) {
    return existing;
  }
  const width = 512;
  const height = 128;
  const texture = new DynamicTexture("signWriting", { width, height }, scene, true);
  // The browser's own 2D context (Babylon's type leaves out text alignment and compositing).
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2 + 6);
  context.rotate(-0.04);
  context.font = `italic 600 92px "${CONFIG.hud.fontFamily}", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(24, 16, 10, 0.92)";
  context.fillText(CONFIG.signposts.text, 0, 0);
  context.restore();
  // Worn paint: small gaps scratched out of the letters.
  const random = createRandom(4949);
  context.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 140; i++) {
    context.fillStyle = `rgba(0, 0, 0, ${randomRange(random, 0.3, 0.9)})`;
    context.fillRect(random() * width, random() * height, randomRange(random, 2, 9), 2);
  }
  context.globalCompositeOperation = "source-over";
  texture.update();
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  const material = new StandardMaterial("signWriting", scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.35;
  material.specularColor = Color3.Black();
  writingByScene.set(scene, material);
  return material;
}

/**
 * NBB-171 (PL3-A): an old wooden signpost, leaning a little, with an arrow-shaped board nailed
 * near its top pointing along its own +X, "Cabana" painted by hand on both faces. The game turns
 * it so the arrow points at the cabin.
 */
export function createSignpostModel(scene: Scene, seed: number): TransformNode {
  const random = createRandom(seed);
  const settings = CONFIG.models.signpost;
  const root = new TransformNode("signpost", scene);
  const materials = getModelMaterials(scene);
  const wood = toColor(CONFIG.palette.oldWood);

  // The post: a squared timber, its foot sunk in the ground.
  const post = MeshBuilder.CreateBox(
    "signpostPost",
    { width: 0.13, height: settings.height + 0.3, depth: 0.13 },
    scene,
  );
  post.position.y = (settings.height + 0.3) / 2 - 0.3;
  bake(post);
  jitter(post, 0.01, seed);
  paint(post, wood.scale(0.85), seed);

  // The arrow: a board and its point, a little lighter than the post.
  const boardY = settings.height - 0.25;
  const length = settings.boardLength;
  const board = MeshBuilder.CreateBox(
    "signpostBoard",
    { width: length, height: 0.22, depth: 0.04 },
    scene,
  );
  board.position.set(length / 2 - 0.05, boardY, 0.085);
  bake(board);
  const point = MeshBuilder.CreateCylinder(
    "signpostPoint",
    { height: 0.04, diameter: 0.34, tessellation: 3 },
    scene,
  );
  // A triangle, flat like the board, its tip toward +X.
  point.rotation.x = Math.PI / 2;
  point.position.set(length - 0.05 + 0.07, boardY, 0.085);
  bake(point);
  const boardColor = wood.scale(randomRange(random, 1.05, 1.25));
  paint(board, boardColor, seed + 1);
  paint(point, boardColor, seed + 2);
  const parts: Mesh[] = [post, board, point];
  const body = assemble("signpost", parts, materials.fallenWood);
  body.parent = root;

  // The writing on both faces (the back one turned, so it reads from behind too).
  const writing = getWritingMaterial(scene);
  for (const side of [1, -1]) {
    const face = MeshBuilder.CreatePlane(
      "signpostWriting",
      { width: length * 0.8, height: 0.2 },
      scene,
    );
    face.position.set(length * 0.42, boardY, 0.085 + side * 0.022);
    face.rotation.y = side === 1 ? Math.PI : 0;
    face.material = writing;
    face.isPickable = false;
    face.parent = root;
  }

  // Old and leaning: tipped a little, and the board a little crooked.
  root.rotation.z = randomRange(random, -settings.lean, settings.lean);
  root.rotation.x = randomRange(random, -settings.lean, settings.lean);
  return root;
}

/** The gallery's signpost (PL3-A). */
export const signpost: ModelGenerator = {
  id: "signpost",
  label: "Poste com placa",
  create(scene: Scene, seed: number): GeneratedModel {
    return { root: createSignpostModel(scene, seed), animations: [] };
  },
};
