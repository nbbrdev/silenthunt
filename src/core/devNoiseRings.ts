import { Color3, MeshBuilder, Vector3, type LinesMesh, type Scene } from "@babylonjs/core";
import type { NoiseSystem } from "../systems/noise";
import type { Input } from "./input";

const RING_SECONDS = 1.5;
const RING_POINTS = 48;

/**
 * NO5 (development only): the N key toggles circles on the ground showing the radius of every
 * noise event, so the reach of steps, landings and snapping branches can be seen while testing.
 */
export function enableNoiseRings(scene: Scene, noise: NoiseSystem, input: Input): void {
  let enabled = false;
  const rings: { mesh: LinesMesh; age: number }[] = [];

  scene.onBeforeRenderObservable.add(() => {
    if (input.wasPressed("KeyN")) {
      enabled = !enabled;
    }
    const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      if (!ring) {
        continue;
      }
      ring.age += seconds;
      ring.mesh.alpha = 1 - ring.age / RING_SECONDS;
      if (ring.age >= RING_SECONDS) {
        ring.mesh.dispose();
        rings.splice(i, 1);
      }
    }
  });

  noise.onNoise.add((event) => {
    if (!enabled) {
      return;
    }
    const points: Vector3[] = [];
    for (let i = 0; i <= RING_POINTS; i++) {
      const angle = (i / RING_POINTS) * Math.PI * 2;
      points.push(
        event.position.add(
          new Vector3(Math.cos(angle) * event.radius, 0.15, Math.sin(angle) * event.radius),
        ),
      );
    }
    const mesh = MeshBuilder.CreateLines("noiseRing", { points }, scene);
    mesh.color =
      event.source === "branch"
        ? new Color3(1, 0.3, 0.2)
        : event.source === "landing"
          ? new Color3(1, 0.8, 0.2)
          : new Color3(0.4, 0.9, 1);
    rings.push({ mesh, age: 0 });
  });
}
