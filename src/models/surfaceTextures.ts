import { DynamicTexture, Texture, VertexBuffer, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import { createRandom, randomRange } from "../core/random";

/**
 * Surface textures drawn by code (no image files): bark, rock and forest floor. Each one has a
 * color texture and a matching normal map (relief), so surfaces stop looking flat and plastic.
 * All of them tile seamlessly.
 */
export interface SurfaceTextures {
  color: Texture;
  normal: Texture;
}

export type SurfaceKind = "bark" | "rock" | "ground";

const SIZE = 512;
const surfacesByScene = new WeakMap<Scene, Map<SurfaceKind, SurfaceTextures>>();

export function getSurfaceTextures(scene: Scene, kind: SurfaceKind): SurfaceTextures {
  let surfaces = surfacesByScene.get(scene);
  if (!surfaces) {
    surfaces = new Map();
    surfacesByScene.set(scene, surfaces);
  }
  const existing = surfaces.get(kind);
  if (existing) {
    return existing;
  }

  const color = createTexture(scene, `surface-${kind}`);
  const context = color.getContext();
  const image = context.getImageData(0, 0, SIZE, SIZE);
  let relief: number;
  if (kind === "bark") {
    paintBark(image.data);
    relief = CONFIG.surfaces.barkRelief;
  } else if (kind === "rock") {
    paintRock(image.data);
    relief = CONFIG.surfaces.rockRelief;
  } else {
    paintGroundBase(image.data);
    relief = CONFIG.surfaces.groundRelief;
  }
  context.putImageData(image, 0, 0);
  if (kind === "ground") {
    drawLeafLitter(color);
  }
  color.update();

  const normal = createTexture(scene, `surface-${kind}-normal`);
  const normalContext = normal.getContext();
  const finalColor = color.getContext().getImageData(0, 0, SIZE, SIZE);
  const normalImage = normalContext.getImageData(0, 0, SIZE, SIZE);
  writeNormalMap(finalColor.data, normalImage.data, relief);
  normalContext.putImageData(normalImage, 0, 0);
  normal.update();

  const textures = { color, normal };
  surfaces.set(kind, textures);
  return textures;
}

/** Multiplies a mesh's texture coordinates, so a texture repeats `uTiles` × `vTiles` times. */
export function tileUVs(mesh: Mesh, uTiles: number, vTiles: number): void {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  if (!uvs) {
    return;
  }
  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i] = (uvs[i] ?? 0) * uTiles;
    uvs[i + 1] = (uvs[i + 1] ?? 0) * vTiles;
  }
  mesh.updateVerticesData(VertexBuffer.UVKind, uvs);
}

function createTexture(scene: Scene, name: string): DynamicTexture {
  const texture = new DynamicTexture(
    name,
    { width: SIZE, height: SIZE },
    scene,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

// --- Noise ---------------------------------------------------------------------------------

/**
 * Tileable fractal noise in [0, 1]: smooth random bumps at several scales, wrapping at the edges.
 * `cellsX`/`cellsY` set the size of the biggest bumps (unequal values stretch them).
 */
function fractalNoise(seed: number, cellsX: number, cellsY: number, octaves: number): Float32Array {
  const random = createRandom(seed);
  const result = new Float32Array(SIZE * SIZE);
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const cx = cellsX * 2 ** octave;
    const cy = cellsY * 2 ** octave;
    const grid = Float32Array.from({ length: cx * cy }, () => random());
    for (let y = 0; y < SIZE; y++) {
      const gy = (y / SIZE) * cy;
      const y0 = Math.floor(gy);
      const ty = smooth(gy - y0);
      for (let x = 0; x < SIZE; x++) {
        const gx = (x / SIZE) * cx;
        const x0 = Math.floor(gx);
        const tx = smooth(gx - x0);
        const a = grid[(y0 % cy) * cx + (x0 % cx)] ?? 0;
        const b = grid[(y0 % cy) * cx + ((x0 + 1) % cx)] ?? 0;
        const c = grid[((y0 + 1) % cy) * cx + (x0 % cx)] ?? 0;
        const d = grid[((y0 + 1) % cy) * cx + ((x0 + 1) % cx)] ?? 0;
        const value = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
        result[y * SIZE + x] = (result[y * SIZE + x] ?? 0) + value * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < result.length; i++) {
    result[i] = (result[i] ?? 0) / total;
  }
  return result;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function setGray(data: Uint8ClampedArray, index: number, value: number): void {
  data[index * 4] = value;
  data[index * 4 + 1] = value;
  data[index * 4 + 2] = value;
  data[index * 4 + 3] = 255;
}

// --- Bark ----------------------------------------------------------------------------------

/**
 * Bark: long streaks along the branch (texture V runs along the tube) with dark fissures.
 * Grayscale: the bark/dead-wood color comes from the vertex colors.
 */
function paintBark(data: Uint8ClampedArray): void {
  const streaks = fractalNoise(11, 24, 3, 4);
  const fissures = fractalNoise(12, 9, 2, 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const crack = Math.max(0, 1 - Math.abs((fissures[i] ?? 0.5) - 0.5) / 0.035);
    const height = (streaks[i] ?? 0.5) - crack * 0.55;
    setGray(data, i, 120 + height * 135);
  }
}

// --- Rock ----------------------------------------------------------------------------------

/** Rock: grainy surface with fine speckles. Grayscale: the color comes from the vertices. */
function paintRock(data: Uint8ClampedArray): void {
  const grain = fractalNoise(21, 6, 6, 5);
  const random = createRandom(22);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const speckle = random() < 0.04 ? randomRange(random, -40, 30) : 0;
    setGray(data, i, 125 + (grain[i] ?? 0.5) * 120 + speckle);
  }
}

// --- Forest floor --------------------------------------------------------------------------

/** Forest floor base: dark dirt with patches of moss and fine variation. Full color. */
function paintGroundBase(data: Uint8ClampedArray): void {
  const patches = fractalNoise(31, 3, 3, 3);
  const fine = fractalNoise(32, 16, 16, 4);
  const { groundDirt, groundMoss } = CONFIG.palette;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const mossAmount = Math.min(1, Math.max(0, ((patches[i] ?? 0.5) - 0.52) / 0.2));
    const shade = 0.7 + (fine[i] ?? 0.5) * 0.6;
    const r = groundDirt.r + (groundMoss.r - groundDirt.r) * mossAmount;
    const g = groundDirt.g + (groundMoss.g - groundDirt.g) * mossAmount;
    const b = groundDirt.b + (groundMoss.b - groundDirt.b) * mossAmount;
    data[i * 4] = r * shade * 255;
    data[i * 4 + 1] = g * shade * 255;
    data[i * 4 + 2] = b * shade * 255;
    data[i * 4 + 3] = 255;
  }
}

/** Fallen leaves and twigs scattered on the floor. Drawn wrapped, so the tiling has no seams. */
function drawLeafLitter(texture: DynamicTexture): void {
  const context = texture.getContext();
  const random = createRandom(33);
  const { groundLitter } = CONFIG.palette;
  const offsets = [-SIZE, 0, SIZE];

  for (let i = 0; i < 70; i++) {
    const x = random() * SIZE;
    const y = random() * SIZE;
    const angle = random() * Math.PI * 2;
    const length = randomRange(random, 20, 50);
    const shade = randomRange(random, 0.4, 0.75);
    context.strokeStyle = `rgb(${Math.round(80 * shade)}, ${Math.round(65 * shade)}, ${Math.round(50 * shade)})`;
    context.lineWidth = randomRange(random, 1.5, 3);
    for (const dx of offsets) {
      for (const dy of offsets) {
        context.beginPath();
        context.moveTo(x + dx, y + dy);
        context.lineTo(x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length);
        context.stroke();
      }
    }
  }

  // Many small, dim leaves: a dark forest floor, not bright autumn confetti.
  for (let i = 0; i < 420; i++) {
    const x = random() * SIZE;
    const y = random() * SIZE;
    const angle = random() * Math.PI * 2;
    const length = randomRange(random, 8, 18);
    const width = length * randomRange(random, 0.35, 0.5);
    const shade = randomRange(random, 0.45, 0.8);
    const r = Math.min(255, groundLitter.r * shade * 255);
    const g = Math.min(255, groundLitter.g * shade * 255);
    const b = Math.min(255, groundLitter.b * shade * 255);
    context.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    for (const dx of offsets) {
      for (const dy of offsets) {
        if (
          x + dx < -length ||
          x + dx > SIZE + length ||
          y + dy < -length ||
          y + dy > SIZE + length
        ) {
          continue;
        }
        context.save();
        context.translate(x + dx, y + dy);
        context.rotate(angle);
        context.beginPath();
        context.moveTo(0, 0);
        context.quadraticCurveTo(width, length * 0.4, 0, length);
        context.quadraticCurveTo(-width, length * 0.4, 0, 0);
        context.fill();
        context.restore();
      }
    }
  }
}

// --- Normal map ----------------------------------------------------------------------------

/**
 * Builds a normal map from the brightness of `color`: brighter = higher. The slope between
 * neighboring pixels becomes the tilt of the surface, which the lighting uses to fake relief.
 */
function writeNormalMap(
  color: Uint8ClampedArray,
  normal: Uint8ClampedArray,
  strength: number,
): void {
  const height = (x: number, y: number) => {
    const index = (((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)) * 4;
    return ((color[index] ?? 0) + (color[index + 1] ?? 0) + (color[index + 2] ?? 0)) / (3 * 255);
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const length = Math.sqrt(dx * dx + dy * dy + 1);
      const index = (y * SIZE + x) * 4;
      normal[index] = ((-dx / length) * 0.5 + 0.5) * 255;
      normal[index + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      normal[index + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normal[index + 3] = 255;
    }
  }
}
