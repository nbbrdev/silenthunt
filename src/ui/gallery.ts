import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Scene,
  Vector3,
  type AnimationGroup,
  type Engine,
  type TransformNode,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Button,
  Control,
  InputText,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import { getGroundMaterial } from "../models/materials";
import { MODEL_REGISTRY } from "../models/registry";
import { tileUVs } from "../models/surfaceTextures";
import type { GeneratedModel, ModelGenerator } from "../models/types";

type LightMode = keyof typeof CONFIG.gallery.lightModes;

const LIGHT_MODE_LABELS: Record<LightMode, string> = {
  day: "Dia",
  night: "Noite",
  fog: "Neblina",
};

const PANEL_WIDTH_PX = 260;
/**
 * Starting camera angle around the model: a 3/4 view from the front. Models face +Z (Babylon's
 * forward), so the old −π/2 showed them from behind.
 */
const START_ALPHA = Math.PI / 2 - 0.6;
const BUTTON_COLOR = "#333333";
const SELECTED_BUTTON_COLOR = "#5a6b4a";

/**
 * Development-only scene for reviewing procedural models (A2-C, G17, NBB-126): pick a model,
 * change its seed, orbit around it, switch day/night/fog and play its animations.
 */
export function createGalleryScene(engine: Engine): Scene {
  const firstGenerator = MODEL_REGISTRY[0];
  if (!firstGenerator) {
    throw new Error("MODEL_REGISTRY is empty: the gallery needs at least one model.");
  }

  const scene = new Scene(engine);
  scene.fogMode = Scene.FOGMODE_EXP2;

  const camera = new ArcRotateCamera(
    "galleryCamera",
    START_ALPHA,
    Math.PI / 2.5,
    5,
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(true);
  camera.lowerRadiusLimit = 0.5;
  // Never orbit below the horizon: the ground is only visible from above.
  camera.upperBetaLimit = Math.PI / 2 - 0.05;
  camera.wheelPrecision = 30;

  // The sun shines from the camera's starting side, so the side you see first is lit.
  const ambient = new HemisphericLight("galleryAmbient", new Vector3(0, 1, 0), scene);
  const sun = new DirectionalLight(
    "gallerySun",
    new Vector3(-Math.cos(START_ALPHA), -1.2, -Math.sin(START_ALPHA)),
    scene,
  );

  const groundSize = CONFIG.gallery.groundSize;
  const ground = MeshBuilder.CreateGround(
    "galleryGround",
    { width: groundSize, height: groundSize },
    scene,
  );
  const groundTiles = groundSize / CONFIG.surfaces.groundTileMeters;
  tileUVs(ground, groundTiles, groundTiles);
  ground.material = getGroundMaterial(scene);

  const state: {
    generator: ModelGenerator;
    seed: number;
    model: GeneratedModel | undefined;
    lightMode: LightMode;
  } = {
    generator: firstGenerator,
    seed: CONFIG.gallery.defaultSeed,
    model: undefined,
    lightMode: "day",
  };

  // --- Interface (Babylon GUI, GL1-B) ---
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("galleryUI", true, scene);

  const panelBackground = new Rectangle("galleryPanel");
  panelBackground.width = `${PANEL_WIDTH_PX}px`;
  panelBackground.height = "100%";
  panelBackground.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panelBackground.background = "rgba(0, 0, 0, 0.7)";
  panelBackground.thickness = 0;
  panelBackground.isPointerBlocker = true;
  ui.addControl(panelBackground);

  const panel = new StackPanel("galleryStack");
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.paddingLeft = "12px";
  panel.paddingRight = "12px";
  panel.paddingTop = "12px";
  panelBackground.addControl(panel);

  panel.addControl(createHeading("Modelo"));
  // Two buttons per row, so the whole list fits on screen with the other controls.
  const modelButtons = new Map<ModelGenerator, Button>();
  let modelRow: StackPanel | undefined;
  MODEL_REGISTRY.forEach((generator, index) => {
    if (index % 2 === 0) {
      modelRow = new StackPanel(`galleryModelRow${index / 2}`);
      modelRow.isVertical = false;
      modelRow.height = "34px";
      modelRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      panel.addControl(modelRow);
    }
    const button = createButton(`model-${generator.id}`, generator.label, () => {
      state.generator = generator;
      showModel();
    });
    button.width = "118px";
    button.paddingRight = "4px";
    button.fontSize = 14;
    modelButtons.set(generator, button);
    modelRow?.addControl(button);
  });

  panel.addControl(createHeading("Semente"));
  const seedInput = new InputText("gallerySeed", String(state.seed));
  seedInput.autoStretchWidth = false;
  seedInput.width = "100%";
  seedInput.height = "32px";
  seedInput.color = "white";
  seedInput.background = "#222222";
  seedInput.focusedBackground = "#333333";
  seedInput.onTextChangedObservable.add(() => {
    const seed = Number.parseInt(seedInput.text, 10);
    if (Number.isFinite(seed) && seed !== state.seed) {
      state.seed = seed;
      showModel();
    }
  });
  panel.addControl(seedInput);

  panel.addControl(createHeading(""));
  const lightRow = new StackPanel("galleryLightRow");
  lightRow.isVertical = false;
  lightRow.height = "36px";
  lightRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  const lightButtons = new Map<LightMode, Button>();
  for (const mode of Object.keys(LIGHT_MODE_LABELS) as LightMode[]) {
    const button = createButton(`light-${mode}`, LIGHT_MODE_LABELS[mode], () => {
      state.lightMode = mode;
      applyLightMode();
    });
    // Horizontal stack panels need widths in pixels: 3 buttons + gaps fit in the panel's 236 px.
    button.width = "76px";
    button.paddingRight = "4px";
    lightButtons.set(mode, button);
    lightRow.addControl(button);
  }
  panel.addControl(lightRow);

  panel.addControl(createHeading("Animações"));
  const animationsPanel = new StackPanel("galleryAnimations");
  panel.addControl(animationsPanel);

  const trianglesText = createHeading("");
  trianglesText.fontWeight = "normal";
  panel.addControl(trianglesText);

  panel.addControl(createHeading(""));
  panel.addControl(
    createButton("backToGame", "Voltar ao jogo", () => {
      window.location.assign(window.location.pathname);
    }),
  );

  // --- Behavior ---
  function showModel(): void {
    if (state.model) {
      for (const group of state.model.animations) {
        group.dispose();
      }
      // Materials are shared by every model (getModelMaterials), so they are kept.
      state.model.root.dispose(false, false);
    }

    const model = state.generator.create(scene, state.seed);
    state.model = model;

    const { min, max } = model.root.getHierarchyBoundingVectors(true);
    // Keep the viewing angles: by default setTarget recomputes them from the old camera position,
    // which put the camera under the ground for tall models.
    camera.setTarget(min.add(max).scale(0.5), false, false, true);
    camera.alpha = START_ALPHA;
    camera.beta = Math.PI / 2.5;
    camera.radius = Math.max(max.subtract(min).length() * 1.5, 2);

    trianglesText.text = `Triângulos: ${countTriangles(model.root).toLocaleString("pt-BR")}`;
    for (const [generator, button] of modelButtons) {
      setSelected(button, generator === state.generator);
    }
    rebuildAnimationButtons(model.animations);
  }

  function rebuildAnimationButtons(animations: AnimationGroup[]): void {
    animationsPanel.clearControls();
    const buttons = new Map<AnimationGroup, Button>();
    const refresh = () => {
      for (const [group, button] of buttons) {
        setSelected(button, group.isPlaying);
      }
    };
    for (const group of animations) {
      const button = createButton(`animation-${group.name}`, group.name, () => {
        const wasPlaying = group.isPlaying;
        for (const other of animations) {
          other.stop();
        }
        if (!wasPlaying) {
          group.play(true);
        }
        refresh();
      });
      buttons.set(group, button);
      animationsPanel.addControl(button);
    }
    refresh();
  }

  function applyLightMode(): void {
    const mode = CONFIG.gallery.lightModes[state.lightMode];
    sun.intensity = mode.sunIntensity;
    ambient.intensity = mode.ambientIntensity;
    ambient.diffuse = new Color3(mode.ambientColor.r, mode.ambientColor.g, mode.ambientColor.b);
    // Light bounced from the ground, so vertical faces are not pitch black.
    ambient.groundColor = ambient.diffuse.scale(0.4);
    const sky = new Color3(mode.skyColor.r, mode.skyColor.g, mode.skyColor.b);
    scene.clearColor = Color4.FromColor3(sky);
    scene.fogColor = sky;
    scene.fogDensity = mode.fogDensity;
    for (const [lightMode, button] of lightButtons) {
      setSelected(button, lightMode === state.lightMode);
    }
  }

  applyLightMode();
  showModel();

  // Lets the browser console (and automated checks) inspect the gallery: silentHunt.gallery().
  Object.assign(window, {
    silentHunt: {
      gallery: () => ({
        meshes: scene.meshes.map((mesh) => `${mesh.name}:${mesh.isEnabled()}:${mesh.isVisible}`),
        camera: camera.position.asArray().map((value) => Math.round(value * 100) / 100),
        target: camera.target.asArray().map((value) => Math.round(value * 100) / 100),
        windInShader:
          scene
            .getMaterialByName("modelWood")
            ?.getEffect()
            ?.vertexSourceCode.includes("windSway") ?? false,
      }),
      /** Points the camera from a given angle (e.g. view(0, 1.55) = side view at ground level). */
      view: (alpha: number, beta: number) => {
        camera.alpha = alpha;
        camera.beta = beta;
      },
      /** Lowest and highest point of the model with the current animation pose applied. */
      posedBounds: (...nodeNames: string[]) => {
        const round = (value: number) => Math.round(value * 100) / 100;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const mesh of state.model?.root.getChildMeshes(false) ?? []) {
          mesh.refreshBoundingInfo({ applySkeleton: true });
          const box = mesh.getBoundingInfo().boundingBox;
          minY = Math.min(minY, box.minimumWorld.y);
          maxY = Math.max(maxY, box.maximumWorld.y);
        }
        // World positions of named nodes (e.g. the creature's joints, "creatureBone-toeL").
        const nodes = Object.fromEntries(
          nodeNames.map((name) => [
            name,
            scene.getTransformNodeByName(name)?.getAbsolutePosition().asArray().map(round),
          ]),
        );
        return { minY: round(minY), maxY: round(maxY), nodes };
      },
    },
  });
  return scene;
}

function createHeading(text: string): TextBlock {
  const heading = new TextBlock(undefined, text);
  heading.height = "30px";
  heading.color = "white";
  heading.fontSize = 16;
  heading.fontWeight = "bold";
  heading.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  return heading;
}

function createButton(name: string, text: string, onClick: () => void): Button {
  const button = Button.CreateSimpleButton(name, text);
  button.height = "34px";
  button.paddingTop = "4px";
  button.color = "white";
  button.background = BUTTON_COLOR;
  button.cornerRadius = 4;
  button.thickness = 0;
  button.onPointerClickObservable.add(onClick);
  return button;
}

function setSelected(button: Button, selected: boolean): void {
  button.background = selected ? SELECTED_BUTTON_COLOR : BUTTON_COLOR;
}

function countTriangles(root: TransformNode): number {
  const meshes = root.getChildMeshes(false);
  if (root instanceof AbstractMesh) {
    meshes.push(root);
  }
  return meshes.reduce((total, mesh) => total + mesh.getTotalIndices() / 3, 0);
}
