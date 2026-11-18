import type { Engine } from "@babylonjs/core";
import type { Input } from "./input";

/** What the panel shows, read each time it refreshes. */
export interface DevPanelSources {
  /** Game time: the day, the phase and the seconds since dawn. */
  clock: () => { day: number; phase: string; seconds: number };
  health: () => number;
  hunger: () => number;
  stamina: () => number;
  creature: () => { state: string; distance: number };
}

const PHASES: Record<string, string> = {
  dawn: "amanhecer",
  day: "dia",
  dusk: "entardecer",
  night: "noite",
};

/**
 * EQ2-A (NBB-151, development only): F2 shows a small panel in the top left corner with the
 * game time, health, hunger and stamina in numbers, the creature's state and distance, and the
 * FPS, so test sessions can be reported precisely. Never in the build (imported only in DEV).
 */
export function enableDevPanel(engine: Engine, input: Input, sources: DevPanelSources): void {
  const panel = document.createElement("div");
  panel.style.cssText = [
    "position: fixed",
    "top: 8px",
    "left: 12px",
    "padding: 6px 10px",
    "font: 13px/1.5 monospace",
    "color: rgba(255, 255, 255, 0.85)",
    "background: rgba(0, 0, 0, 0.45)",
    "pointer-events: none",
    "user-select: none",
    "white-space: pre",
    "display: none",
  ].join(";");
  document.body.appendChild(panel);

  let visible = false;
  input.onKeyDownNow.add((code) => {
    if (code === "F2") {
      visible = !visible;
      panel.style.display = visible ? "block" : "none";
    }
  });

  const minutes = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  window.setInterval(() => {
    if (!visible) {
      return;
    }
    const clock = sources.clock();
    const creature = sources.creature();
    panel.textContent = [
      `Dia ${clock.day} · ${PHASES[clock.phase] ?? clock.phase} · ${minutes(clock.seconds)}`,
      `Vida ${sources.health().toFixed(0)} · Fome ${sources.hunger().toFixed(0)} · Fôlego ${sources.stamina().toFixed(0)}`,
      `Criatura: ${creature.state} a ${creature.distance.toFixed(0)} m`,
      `FPS ${engine.getFps().toFixed(0)}`,
    ].join("\n");
  }, 250);
}
