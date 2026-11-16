import {
  Color4,
  DefaultRenderingPipeline,
  GlowLayer,
  ImageProcessingConfiguration,
  type Camera,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";

/**
 * Screen effects of G14 / DN4: light film grain and a moderate vignette (darker screen edges).
 */
export function setupPostProcessing(scene: Scene, camera: Camera): DefaultRenderingPipeline {
  const settings = CONFIG.postProcessing;
  const pipeline = new DefaultRenderingPipeline("screenEffects", false, scene, [camera]);

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = settings.grainIntensity;
  pipeline.grain.animated = true;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = settings.vignetteWeight;
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
  pipeline.imageProcessing.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
  return pipeline;
}

const glowByScene = new WeakMap<Scene, GlowLayer>();

/**
 * Glow for the few things that should shine through the dark (G14): the creature's eyes
 * (NBB-135) and fire (NBB-132, NBB-146). Created on first use, because an unused glow layer
 * still costs an extra render pass. A mesh glows through its material's emissive color; add the
 * eyes and the fire with `addIncludedOnlyMesh`, so that nothing else ever glows by accident.
 */
export function getGlowLayer(scene: Scene): GlowLayer {
  const existing = glowByScene.get(scene);
  if (existing) {
    return existing;
  }
  const glow = new GlowLayer("glow", scene);
  glow.intensity = CONFIG.postProcessing.glowIntensity;
  glowByScene.set(scene, glow);
  return glow;
}
