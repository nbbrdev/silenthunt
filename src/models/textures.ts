import { DynamicTexture, Texture, type ICanvasRenderingContext, type Scene } from "@babylonjs/core";
import { createRandom, randomRange } from "../core/random";

const dotByScene = new WeakMap<Scene, Texture>();

/**
 * Soft round dot (white center fading to transparent), drawn by code: the torch's fire particles
 * and the halo around the creature's eyes.
 */
export function getSoftDotTexture(scene: Scene): Texture {
  const existing = dotByScene.get(scene);
  if (existing) {
    return existing;
  }
  const size = 64;
  const texture = new DynamicTexture("softDot", { width: size, height: size }, scene, false);
  const context = texture.getContext();
  const image = context.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const alpha = Math.max(0, 1 - distance) ** 2;
      const index = (y * size + x) * 4;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = alpha * 255;
    }
  }
  context.putImageData(image, 0, 0);
  texture.hasAlpha = true;
  texture.update();
  dotByScene.set(scene, texture);
  return texture;
}

const birchBarkByScene = new WeakMap<Scene, Texture>();

/**
 * BM4-A (NBB-163): birch bark: pale, with short dark marks across it (the lenticels) and a few
 * larger dark patches, drawn by code. The bark's color comes from the vertices, as the other trees.
 */
export function getBirchBarkTexture(scene: Scene): Texture {
  const existing = birchBarkByScene.get(scene);
  if (existing) {
    return existing;
  }
  const size = 256;
  const texture = new DynamicTexture("birchBark", { width: size, height: size }, scene, true);
  const context = texture.getContext();
  const random = createRandom(707);
  context.fillStyle = gray(235);
  context.fillRect(0, 0, size, size);
  // Faint streaks along the trunk.
  for (let i = 0; i < 40; i++) {
    context.fillStyle = gray(randomRange(random, 205, 225));
    context.fillRect(random() * size, 0, randomRange(random, 1, 3), size);
  }
  // The marks across the trunk; drawn twice when they cross the edge, so the texture repeats.
  for (let i = 0; i < 46; i++) {
    const x = random() * size;
    const y = random() * size;
    const width = randomRange(random, 14, 70);
    const height = randomRange(random, 2, 7);
    context.fillStyle = gray(randomRange(random, 35, 80));
    for (const shift of [0, -size]) {
      context.fillRect(x + shift, y, width, height);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = random() * size;
    const y = random() * size;
    context.fillStyle = gray(randomRange(random, 50, 90));
    for (const shift of [0, -size]) {
      context.fillRect(x + shift, y, randomRange(random, 30, 60), randomRange(random, 10, 22));
    }
  }
  texture.update();
  birchBarkByScene.set(scene, texture);
  return texture;
}

/**
 * Leaf textures drawn by code on a canvas (no image files: the challenge forbids ready-made
 * models, and these are generated like the meshes). They are grayscale with transparency; the
 * green comes from the vertex colors, so the palette stays in CONFIG.
 */
export type FoliageKind = "broadleaf" | "needles" | "grass" | "reeds" | "tallGrass" | "birch";

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
  } else if (kind === "birch") {
    drawBirchLeaves(context);
  } else if (kind === "needles") {
    drawNeedleSprays(context);
  } else if (kind === "reeds") {
    drawReeds(context);
  } else if (kind === "tallGrass") {
    drawTallGrass(context);
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

/**
 * BM4-A (NBB-163): birch leaves: small rounded leaves hanging loose from thin drooping twigs, so a
 * birch crown reads lighter and airier than an oak's.
 */
function drawBirchLeaves(context: ICanvasRenderingContext): void {
  const random = createRandom(404);
  for (let t = 0; t < 7; t++) {
    const startX = randomRange(random, 80, 432);
    let x = startX;
    let y = randomRange(random, 20, 120);
    context.strokeStyle = gray(110);
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, y);
    const sway = randomRange(random, -40, 40);
    // A twig hanging down in a soft curve, leaves all along it.
    for (let step = 0; step < 9; step++) {
      const nextX = x + sway / 9 + randomRange(random, -6, 6);
      const nextY = y + randomRange(random, 34, 44);
      context.lineTo(nextX, nextY);
      x = nextX;
      y = nextY;
    }
    context.stroke();
    for (let leaf = 0; leaf < 14; leaf++) {
      const along = random();
      const leafX = startX + sway * along + randomRange(random, -22, 22);
      const leafY = 40 + along * 360 + randomRange(random, -16, 16);
      const size = randomRange(random, 24, 36);
      drawLeaf(context, leafX, leafY, size, size * 0.7, randomRange(random, -0.8, 0.8), 210);
    }
  }
}

/**
 * BM4-A (NBB-163): reeds: tall, narrow blades rising from the bottom edge, a few of them topped
 * by the dark brown head of a cattail (darker in the grayscale, so the color tints it darker).
 */
function drawReeds(context: ICanvasRenderingContext): void {
  const random = createRandom(505);
  for (let i = 0; i < 14; i++) {
    const baseX = randomRange(random, 110, 402);
    const height = randomRange(random, 380, 500);
    const halfWidth = randomRange(random, 4, 8);
    const bend = randomRange(random, -50, 50);
    context.fillStyle = gray(randomRange(random, 175, 235));
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
  for (let i = 0; i < 3; i++) {
    const x = randomRange(random, 170, 340);
    const top = randomRange(random, 30, 90);
    context.strokeStyle = gray(150);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, SIZE);
    context.lineTo(x, top);
    context.stroke();
    // The cattail's sausage-shaped head, a little below the stem's tip.
    context.fillStyle = gray(70);
    fillEllipse(context, x, top + 70, 11, 42);
  }
}

/** A filled ellipse (Babylon's canvas type has no `ellipse`: a scaled circle does the same). */
function fillEllipse(
  context: ICanvasRenderingContext,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
): void {
  context.save();
  context.translate(x, y);
  context.scale(radiusX, radiusY);
  context.beginPath();
  context.arc(0, 0, 1, 0, Math.PI * 2);
  context.restore();
  context.fill();
}

/**
 * BM4-A (NBB-163): tall grass of the open field: many thin blades and a few seed heads, dense
 * enough that a crouching player disappears into it.
 */
function drawTallGrass(context: ICanvasRenderingContext): void {
  const random = createRandom(606);
  for (let i = 0; i < 34; i++) {
    const baseX = randomRange(random, 60, 452);
    const height = randomRange(random, 260, 500);
    const halfWidth = randomRange(random, 3, 6);
    const bend = randomRange(random, -90, 90);
    context.fillStyle = gray(randomRange(random, 165, 240));
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
    if (random() < 0.3) {
      // A seed head: a few light grains at the blade's tip.
      context.fillStyle = gray(245);
      for (let grain = 0; grain < 6; grain++) {
        fillEllipse(
          context,
          baseX + bend + randomRange(random, -6, 6),
          SIZE - height + grain * 9,
          3,
          6,
        );
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
