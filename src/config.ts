/**
 * Every tunable value of the game lives here (ADR-08, G16).
 * The values below belong to the NBB-124 demo scene and will be replaced by the real game values.
 */
export const CONFIG = {
  physics: {
    /** Gravity on the Y axis, in m/s². */
    gravity: -9.81,
  },
  demo: {
    fogColor: { r: 0.42, g: 0.47, b: 0.5 },
    /** Exponential fog density: higher means thicker fog. */
    fogDensity: 0.04,
    groundSize: 50,
    boxSize: 1,
    boxDropHeight: 8,
    boxRestitution: 0.3,
  },
  debug: {
    /** Key that toggles the Babylon Inspector (development only, I2-A). */
    inspectorKey: "F9",
    /** How often the FPS counter refreshes, in milliseconds. */
    fpsRefreshMs: 250,
  },
} as const;
