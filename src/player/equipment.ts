import { Observable, type Scene } from "@babylonjs/core";
import type { Input } from "../core/input";

/** What the right hand holds. */
export type Tool = "knife" | "bow";

/**
 * AR1 (provisional until the inventory and quick bar, NBB-143): 1 takes the knife, 2 takes the
 * bow. Other systems listen to `onChanged` (the hands, the torch, the knife and the bow).
 */
export class Equipment {
  readonly onChanged = new Observable<Tool>();
  private tool: Tool = "knife";

  constructor(scene: Scene, input: Input) {
    scene.onBeforeRenderObservable.add(() => {
      if (input.wasPressed("Digit1")) {
        this.equip("knife");
      } else if (input.wasPressed("Digit2")) {
        this.equip("bow");
      }
    });
  }

  get current(): Tool {
    return this.tool;
  }

  equip(tool: Tool): void {
    if (tool === this.tool) {
      return;
    }
    this.tool = tool;
    this.onChanged.notifyObservers(tool);
  }
}
