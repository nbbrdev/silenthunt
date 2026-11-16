/**
 * Every tunable value of the game lives here (ADR-08, G16).
 * The values below belong to the NBB-124 demo scene and will be replaced by the real game values.
 */
export const CONFIG = {
  physics: {
    /** Gravity on the Y axis, in m/s². */
    gravity: -9.81,
    /**
     * Longest step the player controller simulates in one frame, in seconds. A very long frame
     * (e.g. coming back from another tab) is cut to this, so the player never tunnels through the
     * ground. Babylon already caps rigid bodies at 0.1 s per step.
     */
    maxPlayerStepSeconds: 1 / 30,
  },
  player: {
    /** Speeds in m/s (J1). */
    walkSpeed: 1.6,
    runSpeed: 4.5,
    crouchSpeed: 0.9,
    /** Eye height above the feet, in meters (J2). */
    eyeHeight: 1.7,
    crouchEyeHeight: 1.0,
    /** Jump height in meters (J2). */
    jumpHeight: 0.6,
    /** Collision capsule: radius, and how far it reaches above the eyes. */
    capsuleRadius: 0.3,
    headroomAboveEyes: 0.1,
    /**
     * Share of the gap between current and desired speed closed each frame (Babylon's controller
     * "acceleration" gain). Higher on the ground for a crisp stop; low in the air so a jump
     * cannot change direction much.
     */
    groundResponse: 0.4,
    airResponse: 0.05,
    /** How far above the ground the player still counts as standing on it, in meters. */
    groundContactTolerance: 0.02,
    /** How fast the view moves between standing and crouching eye heights, in m/s. */
    crouchTransitionSpeed: 4,
    /** Mouse look, in radians per pixel moved (J3). */
    mouseSensitivity: 0.002,
    /** How far up or down the player can look, in radians (about 85°). */
    maxPitch: 1.48,
    /** Where the player starts in the demo scene (J4). */
    spawn: { x: 0, z: -6 },
    stamina: {
      /** RF-42 (G6). */
      max: 100,
      runCostPerSecond: 15,
      recoveryPerSecond: 20,
    },
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
  /** Base colors of the procedural models (W2, inside the G14 palette). RGB from 0 to 1. */
  palette: {
    bark: { r: 0.3, g: 0.25, b: 0.21 },
    pineNeedles: { r: 0.11, g: 0.2, b: 0.19 },
    oakLeaves: { r: 0.25, g: 0.3, b: 0.16 },
    deadWood: { r: 0.52, g: 0.5, b: 0.47 },
    rock: { r: 0.4, g: 0.4, b: 0.38 },
    moss: { r: 0.22, g: 0.3, b: 0.16 },
    grass: { r: 0.28, g: 0.34, b: 0.19 },
    /** How much each face's color may drift from the base color (0 = none). */
    variation: 0.08,
  },
  /** Size ranges of the procedural models, [min, max] (W1). Lengths in meters. */
  models: {
    pine: { height: [8, 14], layers: [4, 6] },
    oak: { height: [6, 10], branches: [2, 3], blobs: [4, 6] },
    deadTree: { height: [5, 9], branches: [3, 6] },
    bush: { height: [0.6, 1.2], blobs: [3, 5] },
    rock: { size: [0.3, 1.5] },
    groundBranch: { length: [0.5, 1] },
    groundTuft: { height: [0.2, 0.5], blades: [3, 5] },
  },
  /** Foliage sway (W3): sideways offset = strength × height² (meters), so the base stays still. */
  wind: {
    strength: 0.0008,
    speed: 1.2,
  },
  gallery: {
    /** Seed used when the gallery opens. */
    defaultSeed: 1,
    groundSize: 40,
    /**
     * Provisional light setups for reviewing models (GL3). The real day/night lighting comes in
     * NBB-130. Colors are RGB from 0 to 1.
     */
    lightModes: {
      day: {
        sunIntensity: 1,
        ambientIntensity: 0.6,
        ambientColor: { r: 1, g: 1, b: 1 },
        skyColor: { r: 0.62, g: 0.68, b: 0.72 },
        fogDensity: 0.01,
      },
      night: {
        sunIntensity: 0.05,
        ambientIntensity: 0.15,
        ambientColor: { r: 0.45, g: 0.55, b: 0.8 },
        skyColor: { r: 0.03, g: 0.04, b: 0.07 },
        fogDensity: 0.03,
      },
      fog: {
        sunIntensity: 0.6,
        ambientIntensity: 0.5,
        ambientColor: { r: 0.9, g: 0.95, b: 1 },
        skyColor: { r: 0.42, g: 0.47, b: 0.5 },
        fogDensity: 0.08,
      },
    },
  },
  debug: {
    /** Key that toggles the Babylon Inspector (development only, I2-A). */
    inspectorKey: "F9",
    /** How often the FPS counter refreshes, in milliseconds. */
    fpsRefreshMs: 250,
  },
} as const;
