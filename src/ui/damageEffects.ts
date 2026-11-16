import type { Scene } from "@babylonjs/core";
import { Image, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { PlayerHealth } from "../player/health";
import type { Player } from "../player/player";

/**
 * VD2: what the player feels when hit. Every hit flashes the screen edges red and shakes the
 * view; at low health the edges stay dark red and pulse slowly. The edges are a full-screen image
 * drawn by code (clear in the middle), so they show the same by day and at night.
 */
export function createDamageEffects(
  ui: AdvancedDynamicTexture,
  scene: Scene,
  health: PlayerHealth,
  player: Player,
): void {
  const settings = CONFIG.hud;
  const flash = edgeImage("damageFlash", "rgba(170, 10, 10, 1)");
  const low = edgeImage("lowHealth", "rgba(70, 0, 0, 1)");
  // The low-health edges go under the flash.
  ui.addControl(low);
  ui.addControl(flash);

  let flashLeft = 0;
  let pulseTime = 0;
  health.onDamaged.add(() => {
    flashLeft = settings.damageFlashSeconds;
    player.shake(settings.damageShakeSeconds, settings.damageShakeRadians);
  });

  scene.onBeforeRenderObservable.add(() => {
    const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    flashLeft = Math.max(0, flashLeft - seconds);
    flash.alpha = flashLeft / settings.damageFlashSeconds;
    // Hidden while clear, so the full-screen image is not drawn for nothing.
    flash.isVisible = flashLeft > 0;

    const isLow = !health.isDead && health.value < CONFIG.player.health.lowHealth;
    if (isLow) {
      pulseTime += seconds;
      // A slow heartbeat-like pulse between 50% and 90%.
      const beat = 0.5 + 0.5 * Math.sin((pulseTime / settings.lowHealthPulseSeconds) * Math.PI * 2);
      low.alpha = 0.5 + 0.4 * beat;
    } else {
      pulseTime = 0;
      low.alpha = Math.max(0, low.alpha - seconds);
    }
  });
}

/** A full-screen image: `color` at the edges, fading to clear toward the center. */
function edgeImage(name: string, color: string): Image {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.25,
      size / 2,
      size / 2,
      size * 0.72,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const image = new Image(name, canvas.toDataURL());
  image.stretch = Image.STRETCH_FILL;
  image.width = "100%";
  image.height = "100%";
  image.alpha = 0;
  image.isHitTestVisible = false;
  return image;
}
