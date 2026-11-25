import {
  Color3,
  DynamicTexture,
  Effect,
  ShaderMaterial,
  Texture,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { createRandom, randomRange } from "../core/random";
import { sceneBrightness } from "../models/nature/waterfall";

/**
 * NBB-172 (AF1-A): the current's layer over the rivers. Each vertex carries its current in its
 * color (r, g: the direction; b: the speed; a: how much shows). The shader carries specks of foam
 * along with the current (a flow map: two phases half a cycle apart, crossfaded so the restart
 * never shows) and smears each speck back along the current into a short streak. Nothing turns
 * the world's coordinates, so the pattern stays steady however far the river is from the origin.
 * The fog swallows it with distance, like the rest of the world.
 */
Effect.ShadersStore["waterFlowVertexShader"] = `
precision highp float;
attribute vec3 position;
attribute vec4 color;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vWorld;
varying vec4 vFlow;
void main(void) {
  vec4 worldPosition = world * vec4(position, 1.0);
  vWorld = worldPosition.xyz;
  vFlow = color;
  gl_Position = viewProjection * worldPosition;
}
`;

Effect.ShadersStore["waterFlowFragmentShader"] = `
precision highp float;
varying vec3 vWorld;
varying vec4 vFlow;
uniform sampler2D specks;
uniform float time;
uniform float tileMeters;
uniform float period;
uniform float smear;
uniform float maxSpeed;
uniform float opacity;
uniform float light;
uniform vec3 foamColor;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec3 eye;

// The specks at 'uv', smeared back along the current into a streak.
float streak(vec2 uv, vec2 back) {
  float foam = 0.0;
  for (int i = 0; i < 4; i++) {
    foam = max(foam, texture2D(specks, uv + back * float(i)).a * (1.0 - 0.18 * float(i)));
  }
  return foam;
}

// One layer of specks carried by the current, at a given size (meters per texture).
float carried(vec2 p, vec2 velocity, vec2 back, float size, vec2 shift) {
  float phaseA = fract(time / period);
  float phaseB = fract(time / period + 0.5);
  float weightA = 1.0 - abs(2.0 * phaseA - 1.0);
  vec2 uvA = (p - velocity * phaseA * period) / size;
  vec2 uvB = (p - velocity * phaseB * period) / size + shift;
  return streak(uvA, back / size) * weightA + streak(uvB, back / size) * (1.0 - weightA);
}

void main(void) {
  vec2 dir = vFlow.xy * 2.0 - 1.0;
  float len = length(dir);
  if (len < 0.05 || vFlow.a < 0.01) {
    discard;
  }
  dir /= len;
  float speed = vFlow.z * maxSpeed;
  vec2 velocity = dir * speed;
  // Each speck trails a little upstream of itself (longer in a faster current).
  vec2 back = -dir * smear * (0.4 + speed);
  vec2 p = vWorld.xz;
  float foam = max(
    carried(p, velocity, back, tileMeters, vec2(0.37, 0.61)),
    carried(p + vec2(13.1, 7.7), velocity * 1.25, back * 0.7, tileMeters * 0.55, vec2(0.71, 0.19)) * 0.7
  );
  float alpha = foam * opacity * vFlow.a * (0.45 + 0.55 * vFlow.z);
  float distance = length(eye - vWorld);
  float clear = exp(-pow(fogDensity * distance, 2.0));
  vec3 color = mix(fogColor, foamColor * light, clear);
  gl_FragColor = vec4(color, alpha * (0.25 + 0.75 * clear));
}
`;

/** Specks and small flecks of foam, round (no direction of their own), wrapping on both sides. */
function createSpeckTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const texture = new DynamicTexture("waterFlowSpecks", { width: size, height: size }, scene, true);
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  context.clearRect(0, 0, size, size);
  const random = createRandom(1729);
  for (let i = 0; i < 160; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = randomRange(random, 1, i < 25 ? 6 : 3);
    const alpha = randomRange(random, 0.35, 0.9);
    // Drawn at its place and wrapped copies, so the texture tiles without seams.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const gradient = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  texture.update();
  texture.hasAlpha = true;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

/** The current's material, one per scene, its time and light kept up to date. */
export function createFlowMaterial(scene: Scene): ShaderMaterial {
  const settings = CONFIG.waterSurface.flowLayer;
  const material = new ShaderMaterial(
    "waterFlow",
    scene,
    { vertex: "waterFlow", fragment: "waterFlow" },
    {
      attributes: ["position", "color"],
      uniforms: [
        "world",
        "viewProjection",
        "time",
        "tileMeters",
        "period",
        "smear",
        "maxSpeed",
        "opacity",
        "light",
        "foamColor",
        "fogColor",
        "fogDensity",
        "eye",
      ],
      samplers: ["specks"],
      needAlphaBlending: true,
    },
  );
  material.setTexture("specks", createSpeckTexture(scene));
  material.setFloat("tileMeters", settings.tileMeters);
  material.setFloat("period", settings.periodSeconds);
  material.setFloat("smear", settings.smearMeters);
  material.setFloat("maxSpeed", CONFIG.water.flow.maxSpeed);
  material.setFloat("opacity", settings.opacity);
  const foam = settings.foamColor;
  material.setColor3("foamColor", new Color3(foam.r, foam.g, foam.b));
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  let time = 0;
  scene.onBeforeRenderObservable.add(() => {
    time += frameSeconds(scene);
    material.setFloat("time", time);
    material.setFloat("light", sceneBrightness(scene));
    material.setColor3("fogColor", scene.fogColor);
    material.setFloat("fogDensity", scene.fogDensity);
    const camera = scene.activeCamera;
    if (camera) {
      material.setVector3("eye", camera.globalPosition);
    }
  });
  return material;
}
