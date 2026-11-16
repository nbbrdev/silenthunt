import type { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { NoiseSystem } from "../systems/noise";

/**
 * The game's HUD, drawn with Babylon GUI (NO1-A). For now it holds the noise meter; life,
 * hunger and stamina come in later issues.
 */
export function createHud(
  scene: Scene,
  noise: NoiseSystem,
  currentNoiseRadius: () => number,
): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);
  createNoiseMeter(ui, scene, noise, currentNoiseRadius);
  return ui;
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
