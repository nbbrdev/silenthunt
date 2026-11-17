import { CONFIG } from "../config";
import type { PlayerHealth } from "./health";

/**
 * The player's hunger (RF-41, NBB-142): 100 (full) to 0, emptying in 2 day-night cycles. Above
 * 50 the body heals by day (RF-40); at 0 it starves, losing health little by little. Eating
 * meat fills it (RF-35).
 */
export class PlayerHunger {
  private readonly health: PlayerHealth;
  private current: number = CONFIG.player.hunger.max;
  private starveSeconds = 0;

  constructor(health: PlayerHealth) {
    this.health = health;
  }

  get value(): number {
    return this.current;
  }

  /** 0 (starving) to 1 (full). */
  get fraction(): number {
    return this.current / CONFIG.player.hunger.max;
  }

  /** True when one more bite would be wasted (Q does nothing). */
  get isFull(): boolean {
    return this.current > CONFIG.player.hunger.fullAbove;
  }

  eat(amount: number): void {
    this.current = Math.min(CONFIG.player.hunger.max, this.current + amount);
  }

  /** Sets the value directly (respawning, FO4-B; development). */
  set(value: number): void {
    this.current = Math.min(CONFIG.player.hunger.max, Math.max(0, value));
  }

  update(seconds: number): void {
    if (this.health.isDead) {
      return;
    }
    const settings = CONFIG.player.hunger;
    this.current = Math.max(0, this.current - (settings.max / settings.emptySeconds) * seconds);
    if (this.current > 0) {
      this.starveSeconds = 0;
      return;
    }
    this.starveSeconds += seconds;
    while (this.starveSeconds >= settings.starveEverySeconds) {
      this.starveSeconds -= settings.starveEverySeconds;
      this.health.starve(settings.starveDamage);
    }
  }
}
