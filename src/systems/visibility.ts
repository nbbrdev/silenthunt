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
    const { dark, day, lit, crouchFactor } = CONFIG.visibility;
    // Darkness to daylight follows the day clock (dawn and dusk are in between).
    const isLit = this.torch.isLit || this.nearLitFire();
    let distance = isLit ? lit : dark + (day - dark) * this.clock.daylight;
    if (this.player.isCrouched) {
      distance *= crouchFactor;
    }
    return distance;
  }
}
