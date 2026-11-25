import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";

/**
 * With exponential-squared fog, things fade to 5% visibility at `FOG_REACH / density` meters.
 * Used to turn G11's visibility distances into fog densities.
 */
const FOG_REACH = Math.sqrt(-Math.log(0.05));

/**
 * G11: how far one sees through the fog (meters), from night (0) to full daylight (1). The
 * creature uses it too: it stalks at the edge of the fog (IA3) and its eyes fade there (OL1-B).
 */
export function fogVisibility(daylight: number): number {
  const { dayVisibility, nightVisibility } = CONFIG.dayNight;
  return (nightVisibility + (dayVisibility - nightVisibility) * daylight) * fogConditions.scale;
}

/**
 * BM1 (NBB-163): the place's own fog. The marsh's is denser: visibility is multiplied by `scale`
 * (1 = as usual), for the player's eyes and the creature's alike. Set each frame by BiomeEffects.
 */
export const fogConditions = { scale: 1, underwater: false };

type RGB = { readonly r: number; readonly g: number; readonly b: number };

/**
 * Light and fog of the world, following the day clock (NBB-130). There is no sky (DN1-A): the
 * fog color is the sky. Visibility follows G11; nights are dark and bluish (DN2); fog color
 * shifts through the day (DN3).
 */
export class Atmosphere {
  private readonly scene: Scene;
  private readonly clock: DayClock;
  private readonly ambient: HemisphericLight;
  private readonly sun: DirectionalLight;
  private readonly moon: DirectionalLight;
  /** NBB-156 (OB4-A, OB12): how red the last night is, 0 (as usual) to 1. */
  redness = 0;
  /** NBB-159 (CI9): the menu's lighter, bluish fog, 0 (as usual) to 1. */
  menuFog = 0;

  constructor(scene: Scene, clock: DayClock) {
    this.scene = scene;
    this.clock = clock;
    scene.fogMode = Scene.FOGMODE_EXP2;

    this.ambient = new HemisphericLight("skyLight", Vector3.Up(), scene);
    this.sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.3), scene);
    this.moon = new DirectionalLight("moon", new Vector3(0.4, -1, -0.5), scene);
    this.moon.diffuse = toColor(CONFIG.dayNight.moonColor);
    this.moon.specular = Color3.Black();
    this.sun.specular = Color3.Black();

    this.apply();
    scene.onBeforeRenderObservable.add(() => this.apply());
  }

  private apply(): void {
    const settings = CONFIG.dayNight;
    const daylight = this.clock.daylight;
    const warmth = this.clock.warmth;

    // Fog and sky color: night → day, pulled toward the dusk tint at dawn and dusk.
    const fog = Color3.Lerp(toColor(settings.nightFog), toColor(settings.dayFog), daylight);
    const dusk = Color3.Lerp(fog, toColor(settings.duskFog), warmth * 0.6);
    // OB4-A: the last night's fog pulls toward a dark red.
    const lastNight = CONFIG.objective.lastNight;
    const red = Color3.Lerp(dusk, toColor(lastNight.fog), this.redness);
    const tinted = Color3.Lerp(red, toColor(CONFIG.cinematic.fogColor), this.menuFog);
    this.scene.fogColor = tinted;
    this.scene.clearColor = Color4.FromColor3(tinted);

    // G11: visibility in meters becomes fog density.
    this.scene.fogDensity = FOG_REACH / fogVisibility(daylight);
    // NBB-164 (AG14): under the water, a close green-blue murk (darker at night).
    if (fogConditions.underwater) {
      const { underwaterFog, underwaterVisibility } = CONFIG.swimming;
      const murk = toColor(underwaterFog).scale(0.35 + 0.65 * daylight);
      this.scene.fogColor = murk;
      this.scene.clearColor = Color4.FromColor3(murk);
      this.scene.fogDensity = FOG_REACH / underwaterVisibility;
    }

    // Soft light from the sky.
    const { dayAmbient, nightAmbient } = settings;
    this.ambient.intensity =
      nightAmbient.intensity + (dayAmbient.intensity - nightAmbient.intensity) * daylight;
    this.ambient.diffuse = Color3.Lerp(
      Color3.Lerp(toColor(nightAmbient.color), toColor(lastNight.ambient), this.redness),
      toColor(dayAmbient.color),
      daylight,
    );
    this.ambient.groundColor = this.ambient.diffuse.scale(0.35);

    // The sun crosses the sky during the day; warmer and lower at dawn and dusk.
    const angle = this.clock.sunProgress * Math.PI;
    this.sun.direction = new Vector3(-Math.cos(angle), -Math.max(Math.sin(angle), 0.2), 0.35);
    this.sun.intensity = settings.sunIntensity * daylight;
    this.sun.diffuse = Color3.Lerp(
      toColor(settings.sunColor),
      toColor(settings.duskSunColor),
      warmth,
    );

    // DN2: faint bluish moonlight, only at night.
    this.moon.intensity = settings.moonIntensity * (1 - daylight);
  }
}

function toColor(rgb: RGB): Color3 {
  return new Color3(rgb.r, rgb.g, rgb.b);
}
