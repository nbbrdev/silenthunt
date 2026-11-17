import { Observable, type Scene } from "@babylonjs/core";
import type { Input } from "../core/input";

/** What the hands hold. */
export type Tool = "knife" | "bow" | "shotgun";

const KEYS: Record<string, Tool> = { Digit1: "knife", Digit2: "bow", Digit3: "shotgun" };

/**
 * AR1, ES2 (provisional until the inventory and quick bar, NBB-143): 1 takes the knife, 2 the
 * bow and 3 the shotgun, once it has been found. Other systems listen to `onChanged` (the hands,
 * the torch and each weapon).
 */
export class Equipment {
  readonly onChanged = new Observable<Tool>();
  private tool: Tool = "knife";
  private readonly owned = new Set<Tool>(["knife", "bow"]);

  constructor(scene: Scene, input: Input) {
    scene.onBeforeRenderObservable.add(() => {
      for (const [key, tool] of Object.entries(KEYS)) {
        if (input.wasPressed(key)) {
          this.equip(tool);
        }
      }
    });
  }

  get current(): Tool {
    return this.tool;
  }

  /** A tool found in the world (the shotgun, ES2) can be taken from now on. */
  unlock(tool: Tool): void {
    this.owned.add(tool);
  }

  has(tool: Tool): boolean {
    return this.owned.has(tool);
  }

  equip(tool: Tool): void {
    if (tool === this.tool || !this.owned.has(tool)) {
      return;
    }
    this.tool = tool;
    this.onChanged.notifyObservers(tool);
  }
}
