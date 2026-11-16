import { CONFIG } from "../config";

/**
 * Stamina rules (RF-42, G6): running costs stamina; standing, walking or crouching recovers it.
 * Without stamina the player cannot run.
 */
export function canRun(stamina: number): boolean {
  return stamina > 0;
}

/** Stamina after `seconds`, given whether the player actually ran during that time. */
export function updateStamina(stamina: number, isRunning: boolean, seconds: number): number {
  const { max, runCostPerSecond, recoveryPerSecond } = CONFIG.player.stamina;
  const change = isRunning ? -runCostPerSecond * seconds : recoveryPerSecond * seconds;
  return Math.min(max, Math.max(0, stamina + change));
}
