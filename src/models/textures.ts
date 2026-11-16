import { DynamicTexture, Texture, type ICanvasRenderingContext, type Scene } from "@babylonjs/core";
import { createRandom, randomRange } from "../core/random";

/**
 * Leaf textures drawn by code on a canvas (no image files: the challenge forbids ready-made
 * models, and these are generated like the meshes). They are grayscale with transparency; the
 * green comes from the vertex colors, so the palette stays in CONFIG.
 */
export type FoliageKind = "broadleaf" | "needles" | "grass";

const SIZE = 512;
const texturesByScene = new WeakMap<Scene, Map<FoliageKind, Texture>>();

export function getFoliageTexture(scene: Scene, kind: FoliageKind): Texture {
  let textures = texturesByScene.get(scene);
  if (!textures) {
    textures = new Map();
    texturesByScene.set(scene, textures);
  }
  const existing = textures.get(kind);
  if (existing) {
    return existing;
  }

  const texture = new DynamicTexture(
    `foliage-${kind}`,
    { width: SIZE, height: SIZE },
    scene,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  const context = texture.getContext();
  context.clearRect(0, 0, SIZE, SIZE);
  if (kind === "broadleaf") {
    drawBroadleafCluster(context);
  } else if (kind === "needles") {
    drawNeedleSprays(context);
  } else {
    drawGrassBlades(context);
  }
  texture.update();

  textures.set(kind, texture);
  return texture;
}

function gray(shade: number, alpha = 1): string {
  const value = Math.round(shade);
  return `rgba(${value}, ${value}, ${value}, ${alpha})`;
}

/** A cluster of pointed leaves around thin twigs, radiating from the center. */
function drawBroadleafCluster(context: ICanvasRenderingContext): void {
  const random = createRandom(101);
  const center = SIZE / 2;

  for (let i = 0; i < 6; i++) {
    const angle = random() * Math.PI * 2;
    context.strokeStyle = gray(120);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(center, center);
    context.lineTo(center + Math.cos(angle) * 190, center + Math.sin(angle) * 190);
    context.stroke();
  }

  // Dense enough that a crown of these cards reads as a full canopy, not loose leaves.
  for (let i = 0; i < 48; i++) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 185;
    const x = center + Math.cos(angle) * distance;
    const y = center + Math.sin(angle) * distance;
    const length = randomRange(random, 60, 95);
    const width = length * randomRange(random, 0.35, 0.45);
    const facing = angle - Math.PI / 2 + randomRange(random, -0.6, 0.6);
    drawLeaf(context, x, y, length, width, facing, randomRange(random, 175, 245));
  }
}

function drawLeaf(
  context: ICanvasRenderingContext,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  shade: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.fillStyle = gray(shade);
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(width, length * 0.4, 0, length);
  context.quadraticCurveTo(-width, length * 0.4, 0, 0);
  context.fill();
  // Midrib: a darker line along the leaf.
  context.strokeStyle = gray(shade * 0.7);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(0, length * 0.9);
  context.stroke();
  context.restore();
}

/** Pine sprigs: short stems with thin needles angled forward on both sides. */
function drawNeedleSprays(context: ICanvasRenderingContext): void {
  const random = createRandom(202);
  const center = SIZE / 2;

  // Thick, dense needles: thin lines vanish when the texture is shrunk for distant trees.
  for (let s = 0; s < 10; s++) {
    const angle = (s / 10) * Math.PI * 2 + randomRange(random, -0.25, 0.25);
    const stemLength = randomRange(random, 170, 235);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    context.strokeStyle = gray(130);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(center, center);
    context.lineTo(center + dirX * stemLength, center + dirY * stemLength);
    context.stroke();

    for (let t = 0.05; t < 1; t += 0.035) {
      const baseX = center + dirX * stemLength * t;
      const baseY = center + dirY * stemLength * t;
      const needleLength = randomRange(random, 38, 60) * (1.1 - t * 0.4);
      for (const side of [-1, 1]) {
        const needleAngle = angle + side * randomRange(random, 0.55, 0.95);
        context.strokeStyle = gray(randomRange(random, 175, 235));
        context.lineWidth = 6;
        context.beginPath();
        context.moveTo(baseX, baseY);
        context.lineTo(
          baseX + Math.cos(needleAngle) * needleLength,
          baseY + Math.sin(needleAngle) * needleLength,
        );
        context.stroke();
      }
    }
  }
}

/** Grass blades growing up from the bottom edge (bottom of the canvas = ground). */
function drawGrassBlades(context: ICanvasRenderingContext): void {
  const random = createRandom(303);
  for (let i = 0; i < 16; i++) {
    const baseX = randomRange(random, 150, 362);
    const height = randomRange(random, 280, 490);
    const halfWidth = randomRange(random, 8, 14);
    const bend = randomRange(random, -110, 110);
    context.fillStyle = gray(randomRange(random, 170, 240));
    context.beginPath();
    context.moveTo(baseX - halfWidth, SIZE);
    context.quadraticCurveTo(baseX + bend * 0.3, SIZE - height * 0.6, baseX + bend, SIZE - height);
    context.quadraticCurveTo(
      baseX + bend * 0.3 + halfWidth,
      SIZE - height * 0.55,
      baseX + halfWidth,
      SIZE,
    );
    context.fill();
  }
}
