import type { Scene } from "@babylonjs/core";
import { CONFIG } from "../config";

/**
 * Toggles the Babylon Inspector with a key (I2-A). Development only: import this module dynamically
 * inside an `import.meta.env.DEV` check (see main.ts), or the Inspector ends up in the build.
 */
export function enableInspectorToggle(scene: Scene): void {
  let inspector: { dispose(): void } | undefined;
  let loading = false;

  window.addEventListener("keydown", (event) => {
    if (event.key !== CONFIG.debug.inspectorKey || loading) {
      return;
    }
    event.preventDefault();

    if (inspector) {
      inspector.dispose();
      inspector = undefined;
      return;
    }

    loading = true;
    void import("@babylonjs/inspector")
      .then(({ ShowInspector }) => {
        inspector = ShowInspector(scene);
      })
      .finally(() => {
        loading = false;
      });
  });
}
