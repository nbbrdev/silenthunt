import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";
import type { Player } from "../player/player";
import type { PlayerTorch } from "../player/torch";

/**
 * How far away the player can be seen right now (RF-13, M3-B, TO5). Prey (NBB-138) and the
 * creature (NBB-134) compare this with their distance to the player, inside their view cone.
 * Being next to a lit campfire also counts as "lit" (NBB-142).
 */
export class VisibilitySystem {
  /** True while the player stands next to a lit campfire (set by the CampfireManager). */
  nearLitFire: () => boolean = () => false;
  /** NBB-154 (MI1-A): true while the player hides in a bush (set by the HidingSystem). */
  hidden: () => boolean = () => false;

  private readonly clock: DayClock;
  private readonly player: Player;
  private readonly torch: PlayerTorch;

  constructor(clock: DayClock, player: Player, torch: PlayerTorch) {
    this.clock = clock;
    this.player = player;
    this.torch = torch;
  }

  /** Distance in meters at which the player is visible. */
  visibleDistance(): number {
    // MI10: hidden in a bush, nobody sees the player (the creature finds them only up close).
    if (this.hidden()) {
      return 0;
    }
    const { dark, day, lit, crouchFactor } = CONFIG.visibility;
    // Darkness to daylight follows the day clock (dawn and dusk are in between).
    const isLit = this.torch.isLit || this.nearLitFire();
    let distance = isLit ? lit : dark + (day - dark) * this.clock.daylight;
    if (this.player.isCrouched) {
      distance *= crouchFactor;
    }
    // BM1 (NBB-163): the open field shows a standing player farther; its tall grass hides.
    return this.biomeSight(distance);
  }

  /** BM1 (NBB-163): the biome's say on the distance (set by BiomeEffects). */
  biomeSight: (distance: number) => number = (distance) => distance;

  /**
   * MI3-A, MI10: how far the player would be seen standing and without the torch right now (8 m
   * in the dark, up to 20 m by day). Closer than this, the creature saw them go into the bush.
   */
  standingDistance(): number {
    const { dark, day } = CONFIG.visibility;
    return dark + (day - dark) * this.clock.daylight;
  }
}
