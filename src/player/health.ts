import { Observable } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";

/**
 * The player's health (RF-40, NBB-136): 0 to 100. Healing only happens by day (VD7-B: at night
 * the body does not heal, which is what makes the creature deadly), with hunger above 50, and
 * starts a few seconds after the last hit (VD3-B).
 */
export class PlayerHealth {
  /** Fired on every hit, with the damage taken. */
  readonly onDamaged = new Observable<number>();
  readonly onDied = new Observable<void>();

  private readonly clock: DayClock;
  private readonly hunger: () => number;
  private current: number = CONFIG.player.health.max;
  private secondsSinceDamage = Infinity;

  /** @param hunger current hunger (0–100, RF-41). */
  constructor(clock: DayClock, hunger: () => number = () => 100) {
    this.clock = clock;
    this.hunger = hunger;
  }

  get value(): number {
    return this.current;
  }

  /** 0 (dead) to 1 (full). */
  get fraction(): number {
    return this.current / CONFIG.player.health.max;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  damage(amount: number): void {
    if (this.isDead || amount <= 0) {
      return;
    }
    this.current = Math.max(0, this.current - amount);
    this.secondsSinceDamage = 0;
    this.onDamaged.notifyObservers(amount);
    if (this.isDead) {
      this.onDied.notifyObservers();
    }
  }

  /**
   * RF-41: hunger at 0 wears the body down. Unlike a hit, it has no flash or shake (it would
   * fire every 2 s) and it does not delay healing (which needs hunger above 50 anyway).
   */
  starve(amount: number): void {
    if (this.isDead || amount <= 0) {
      return;
    }
    this.current = Math.max(0, this.current - amount);
    if (this.isDead) {
      this.onDied.notifyObservers();
    }
  }

  /** NBB-147: the health of a saved game. */
  restore(value: number): void {
    this.current = Math.max(1, Math.min(CONFIG.player.health.max, value));
  }

  /** VD5: back to full health when respawning. */
  revive(): void {
    this.current = CONFIG.player.health.max;
    this.secondsSinceDamage = Infinity;
  }

  update(seconds: number): void {
    if (this.isDead) {
      return;
    }
    const settings = CONFIG.player.health;
    this.secondsSinceDamage += seconds;
    const canHeal =
      this.clock.phase !== "night" &&
      this.hunger() > settings.hungerToHeal &&
      this.secondsSinceDamage >= settings.regenDelaySeconds;
    if (canHeal) {
      this.current = Math.min(settings.max, this.current + settings.regenPerSecond * seconds);
    }
  }
}
