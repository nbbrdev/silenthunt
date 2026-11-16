import type { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { PlayerHealth } from "../player/health";
import type { NoiseSystem } from "../systems/noise";

/**
 * The game's HUD, drawn with Babylon GUI (NO1-A): the noise meter and the health bar. Hunger and
 * stamina come in later issues, next to the health bar.
 */
export function createHud(
  scene: Scene,
  noise: NoiseSystem,
  currentNoiseRadius: () => number,
  health: PlayerHealth,
): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);
  createNoiseMeter(ui, scene, noise, currentNoiseRadius);
  createHealthBar(ui, scene, health);
  return ui;
}

/**
 * Health bar (VD1-C): thin, at the bottom left, in the noise meter's style. It only shows while
 * health is not full and fades out a few seconds after it fills up again.
 */
function createHealthBar(ui: AdvancedDynamicTexture, scene: Scene, health: PlayerHealth): void {
  const { healthBarWidthPx, healthBarHideAfterSeconds, healthBarColor } = CONFIG.hud;

  const frame = new Rectangle("healthBar");
  frame.width = `${healthBarWidthPx}px`;
  frame.height = "4px";
  frame.left = "36px";
  frame.top = "-36px";
  frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  frame.thickness = 0;
  frame.alpha = 0;
  ui.addControl(frame);

  const track = new Rectangle("healthBarTrack");
  track.background = "white";
  track.alpha = 0.12;
  track.thickness = 0;
  frame.addControl(track);

  const fill = new Rectangle("healthBarFill");
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  fill.background = healthBarColor;
  fill.alpha = 0.85;
  fill.thickness = 0;
  frame.addControl(fill);

  let secondsFull = Infinity;
  scene.onBeforeRenderObservable.add(() => {
    const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    fill.width = `${Math.round(health.fraction * healthBarWidthPx)}px`;
    secondsFull = health.fraction >= 1 ? secondsFull + seconds : 0;
    // Visible while hurt; after healing, waits a moment and fades out in half a second.
    const target = secondsFull < healthBarHideAfterSeconds ? 1 : 0;
    frame.alpha += Math.max(-seconds * 2, Math.min(seconds * 4, target - frame.alpha));
  });
}

/**
 * Noise meter (M2-A, RF-12, NO2): a thin, faint bar at the bottom center. It shows the radius
 * of the current gait on the current ground and pulses on every noise the player makes.
 * Almost invisible when standing still.
 */
function createNoiseMeter(
  ui: AdvancedDynamicTexture,
  scene: Scene,
  noise: NoiseSystem,
  currentRadius: () => number,
): void {
  const { noiseMeterMax, noiseMeterWidthPx, noisePulseFade } = CONFIG.hud;

  // A frame holds the faint track and the fill, so the fill grows from the left edge.
  const frame = new Rectangle("noiseMeter");
  frame.width = `${noiseMeterWidthPx}px`;
  frame.height = "4px";
  frame.top = "-36px";
  frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  frame.thickness = 0;
  ui.addControl(frame);

  const track = new Rectangle("noiseMeterTrack");
  track.background = "white";
  track.alpha = 0.12;
  track.thickness = 0;
  frame.addControl(track);

  const fill = new Rectangle("noiseMeterFill");
  fill.width = "0px";
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  fill.background = "white";
  fill.thickness = 0;
  frame.addControl(fill);

  let pulse = 0;
  let pulseRadius = 0;
  noise.onNoise.add((event) => {
    pulse = 1;
    pulseRadius = event.radius;
  });

  scene.onBeforeRenderObservable.add(() => {
    const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    pulse = Math.max(0, pulse - seconds * noisePulseFade);
    const radius = Math.max(currentRadius(), pulseRadius * pulse);
    const share = Math.min(radius / noiseMeterMax, 1);
    fill.width = `${Math.round(share * noiseMeterWidthPx)}px`;
    fill.alpha = 0.25 + 0.6 * pulse;
  });
}
