import type { Engine } from "@babylonjs/core";
import { CONFIG } from "../config";

/** Formats the frame rate for the on-screen counter, e.g. 59.7 → "60 FPS". */
export function formatFps(fps: number): string {
  if (!Number.isFinite(fps) || fps < 0) {
    return "-- FPS";
  }
  return `${Math.round(fps)} FPS`;
}

/** Keeps `element` showing the engine's current frame rate. */
export function attachFpsCounter(engine: Engine, element: HTMLElement): void {
  window.setInterval(() => {
    element.textContent = formatFps(engine.getFps());
  }, CONFIG.debug.fpsRefreshMs);
}
