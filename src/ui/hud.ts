import type { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle } from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { PlayerHealth } from "../player/health";
import type { PlayerHunger } from "../player/hunger";
import type { NoiseSystem } from "../systems/noise";

/**
 * The game's HUD, drawn with Babylon GUI (NO1-A): the noise meter, the health bar and, next to
 * it, the hunger bar.
 */
export function createHud(
  scene: Scene,
  noise: NoiseSystem,
  currentNoiseRadius: () => number,
  health: PlayerHealth,
  hunger: PlayerHunger,
): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);
  createNoiseMeter(ui, scene, noise, currentNoiseRadius);
  createHealthBar(ui, scene, health);
  createHungerBar(ui, scene, hunger);
  return ui;
}

/**
 * MN1-C: gives every text of a UI the game's font. Babylon GUI ignores a font set on the root
 * itself, so it goes on each control at the top (their own children inherit it). Call it once
 * the UI is built.
 */
export function applyGameFont(ui: AdvancedDynamicTexture): void {
  for (const control of ui.rootContainer.children) {
    if (!control.fontFamily) {
      control.fontFamily = CONFIG.hud.fontFamily;
    }
  }
}

/**
 * Hunger bar (FO3-B): amber, right of the health bar, the same size. It only shows below 50,
 * when health stops coming back (RF-40), and pulses slowly below 20.
 */
function createHungerBar(ui: AdvancedDynamicTexture, scene: Scene, hunger: PlayerHunger): void {
  const { healthBarWidthPx, hungerBarColor, hungerBarBelow, hungerBarPulseBelow } = CONFIG.hud;

  const frame = new Rectangle("hungerBar");
  frame.width = `${healthBarWidthPx}px`;
  frame.height = "4px";
  frame.left = `${36 + healthBarWidthPx + 12}px`;
  frame.top = "-36px";
  frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  frame.thickness = 0;
  frame.alpha = 0;
  ui.addControl(frame);

  const track = new Rectangle("hungerBarTrack");
  track.background = "white";
  track.alpha = 0.12;
  track.thickness = 0;
  frame.addControl(track);

  const fill = new Rectangle("hungerBarFill");
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  fill.background = hungerBarColor;
  fill.alpha = 0.85;
  fill.thickness = 0;
  frame.addControl(fill);

  let time = 0;
  scene.onBeforeRenderObservable.add(() => {
    const seconds = frameSeconds(scene);
    time += seconds;
    fill.width = `${Math.round(hunger.fraction * healthBarWidthPx)}px`;
    const visible = hunger.value < hungerBarBelow;
    const pulse =
      hunger.value < hungerBarPulseBelow ? 0.6 + 0.4 * Math.abs(Math.sin(time * 1.5)) : 1;
    const target = visible ? pulse : 0;
    frame.alpha += Math.max(-seconds * 2, Math.min(seconds * 4, target - frame.alpha));
  });
}

/**
 * NBB-164 (AG14): the air bar, pale blue, just above the health bar and the same size. It shows
 * only while the eyes are underwater (and until the air fills up again).
 */
export function createAirBar(
  ui: AdvancedDynamicTexture,
  scene: Scene,
  air: () => { fraction: number; underwater: boolean },
): void {
  const { healthBarWidthPx, airBarColor } = CONFIG.hud;

  const frame = new Rectangle("airBar");
  frame.width = `${healthBarWidthPx}px`;
  frame.height = "4px";
  frame.left = "36px";
  frame.top = "-46px";
  frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  frame.thickness = 0;
  frame.alpha = 0;
  ui.addControl(frame);

  const track = new Rectangle("airBarTrack");
  track.background = "white";
  track.alpha = 0.12;
  track.thickness = 0;
  frame.addControl(track);

  const fill = new Rectangle("airBarFill");
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  fill.background = airBarColor;
  fill.alpha = 0.85;
  fill.thickness = 0;
  frame.addControl(fill);

  scene.onBeforeRenderObservable.add(() => {
    const seconds = frameSeconds(scene);
    const { fraction, underwater } = air();
    fill.width = `${Math.round(fraction * healthBarWidthPx)}px`;
    const target = underwater || fraction < 1 ? 1 : 0;
    frame.alpha += Math.max(-seconds * 2, Math.min(seconds * 4, target - frame.alpha));
  });
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
    const seconds = frameSeconds(scene);
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
    const seconds = frameSeconds(scene);
    pulse = Math.max(0, pulse - seconds * noisePulseFade);
    const radius = Math.max(currentRadius(), pulseRadius * pulse);
    const share = Math.min(radius / noiseMeterMax, 1);
    fill.width = `${Math.round(share * noiseMeterWidthPx)}px`;
    fill.alpha = 0.25 + 0.6 * pulse;
  });
}
