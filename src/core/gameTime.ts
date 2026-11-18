import type { ParticleSystem, Scene } from "@babylonjs/core";

/**
 * Game time (NBB-150, MN3-A). While the game is paused (the menus), everything stands still: each
 * system's frame time is 0, and physics, animations and particles (the fire) are frozen. The
 * scene keeps drawing, so the menus over it still work.
 */
const state = { paused: false };
const particleSpeeds = new WeakMap<ParticleSystem, number>();

export function isPaused(): boolean {
  return state.paused;
}

/** Seconds since the last frame, at most 0.1 (a slow frame is not a jump); 0 while paused. */
export function frameSeconds(scene: Scene): number {
  return state.paused ? 0 : Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
}

/** Pauses or resumes the world. */
export function setPaused(scene: Scene, paused: boolean): void {
  if (state.paused === paused) {
    return;
  }
  state.paused = paused;
  scene.physicsEnabled = !paused;
  scene.animationsEnabled = !paused;
  for (const system of scene.particleSystems) {
    // Only CPU particle systems have their own speed (all of the game's fires are).
    if (!("updateSpeed" in system)) {
      continue;
    }
    const particles = system as ParticleSystem;
    if (paused) {
      particleSpeeds.set(particles, particles.updateSpeed);
      particles.updateSpeed = 0;
    } else {
      particles.updateSpeed = particleSpeeds.get(particles) ?? particles.updateSpeed;
    }
  }
}
