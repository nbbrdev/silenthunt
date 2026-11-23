import { Color3, MeshBuilder, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { CONFIG } from "../../config";
import { assemble, jitter, paint, toColor } from "../lowPoly";
import { getBoneMaterial } from "../materials";
import type { GeneratedModel, ModelGenerator } from "../types";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Bakes a part's transform into its vertices and paints it one color. */
function finish(mesh: Mesh, color: Color3, seed: number): Mesh {
  mesh.bakeCurrentTransformIntoVertices();
  paint(mesh, color, seed);
  return mesh;
}

/**
 * The battery (NBB-156, OB12): a square 6-volt lantern battery, about 11 cm, black with a red band
 * and two brass spring terminals on top.
 */
export function createBatteryMesh(scene: Scene): Mesh {
  const casing = MeshBuilder.CreateBox(
    "batteryCasing",
    { width: 0.1, height: 0.11, depth: 0.1 },
    scene,
  );
  casing.position.y = 0.055;
  const parts = [finish(casing, toColor(CONFIG.palette.batteryCase), 30)];
  // The red label: a band of its own, a hair wider than the casing (a box has no vertices
  // halfway up to paint it on).
  const band = MeshBuilder.CreateBox(
    "batteryBand",
    { width: 0.102, height: 0.04, depth: 0.102 },
    scene,
  );
  band.position.y = 0.055;
  parts.push(finish(band, toColor(CONFIG.palette.batteryLabel), 29));
  for (const x of [-0.025, 0.025]) {
    const spring = MeshBuilder.CreateCylinder(
      "batteryTerminal",
      { height: 0.025, diameter: 0.012, tessellation: 6 },
      scene,
    );
    spring.position = v(x, 0.122, 0);
    parts.push(finish(spring, toColor(CONFIG.palette.brass), 31));
  }
  return assemble("battery", parts, getBoneMaterial(scene));
}

/**
 * The antenna (OB12): a telescopic whip antenna, about 45 cm, three steel sections thinner toward
 * a ball tip, on a dark threaded mount. Stands along Y.
 */
export function createAntennaMesh(scene: Scene): Mesh {
  const steel = toColor(CONFIG.palette.gunSteel).scale(1.6);
  const parts: Mesh[] = [];
  const mount = MeshBuilder.CreateCylinder(
    "antennaMount",
    { height: 0.04, diameterTop: 0.016, diameterBottom: 0.022, tessellation: 6 },
    scene,
  );
  mount.position.y = 0.02;
  parts.push(finish(mount, toColor(CONFIG.palette.darkMetal), 32));
  const sections = [
    { from: 0.04, to: 0.19, diameter: 0.01 },
    { from: 0.19, to: 0.32, diameter: 0.007 },
    { from: 0.32, to: 0.44, diameter: 0.005 },
  ];
  sections.forEach(({ from, to, diameter }, index) => {
    const section = MeshBuilder.CreateCylinder(
      "antennaSection",
      { height: to - from, diameter, tessellation: 5 },
      scene,
    );
    section.position.y = (from + to) / 2;
    parts.push(finish(section, steel.scale(1 - index * 0.08), 33 + index));
  });
  // The tip: a short fat bead (a sphere would cost ~100 triangles).
  const tip = MeshBuilder.CreateCylinder(
    "antennaTip",
    { height: 0.01, diameter: 0.012, tessellation: 5 },
    scene,
  );
  tip.position.y = 0.445;
  parts.push(finish(tip, steel, 36));
  return assemble("antenna", parts, getBoneMaterial(scene));
}

/**
 * The tubes (OB12): three radio vacuum tubes, about 8 cm, standing in a small wooden tray. Pale
 * glass with a darker top and a black base.
 */
export function createTubesMesh(scene: Scene): Mesh {
  const parts: Mesh[] = [];
  const tray = MeshBuilder.CreateBox(
    "tubesTray",
    { width: 0.12, height: 0.02, depth: 0.045 },
    scene,
  );
  tray.position.y = 0.01;
  parts.push(finish(tray, toColor(CONFIG.palette.cabinLogs), 37));
  const glass = toColor(CONFIG.palette.tubeGlass);
  [-0.035, 0, 0.035].forEach((x, index) => {
    const base = MeshBuilder.CreateCylinder(
      "tubeBase",
      { height: 0.015, diameter: 0.026, tessellation: 6 },
      scene,
    );
    base.position = v(x, 0.0275, 0);
    parts.push(finish(base, toColor(CONFIG.palette.batteryCase), 38 + index));
    const bulb = MeshBuilder.CreateCylinder(
      "tubeGlass",
      { height: 0.06, diameterTop: 0.021, diameterBottom: 0.024, tessellation: 6 },
      scene,
    );
    bulb.position = v(x, 0.065, 0);
    bulb.bakeCurrentTransformIntoVertices();
    // The top of the glass is silvered (the getter), darker than the rest.
    paint(bulb, (_x, y) => (y > 0.08 ? glass.scale(0.55) : glass), 41 + index);
    parts.push(bulb);
    // The rounded top as a low cone (a half sphere would cost ~50 triangles per tube).
    const dome = MeshBuilder.CreateCylinder(
      "tubeDome",
      { height: 0.01, diameterTop: 0.006, diameterBottom: 0.021, tessellation: 6 },
      scene,
    );
    dome.position = v(x, 0.1, 0);
    parts.push(finish(dome, glass.scale(0.55), 44 + index));
  });
  return assemble("tubes", parts, getBoneMaterial(scene));
}

/**
 * The assembled radio (OB12): an olive military field radio, about 30 cm, with a dial, two knobs,
 * a carrying handle, the battery's red band showing in a side slot and the antenna up from a
 * corner.
 */
export function createRadioMesh(scene: Scene): Mesh {
  const olive = toColor(CONFIG.palette.radioCase);
  const dark = toColor(CONFIG.palette.darkMetal);
  const parts: Mesh[] = [];
  const box = MeshBuilder.CreateBox("radioBox", { width: 0.3, height: 0.2, depth: 0.16 }, scene);
  box.position.y = 0.1;
  box.bakeCurrentTransformIntoVertices();
  jitter(box, 0.002, 47);
  paint(box, olive, 48);
  parts.push(box);
  // Front panel (facing -Z): the dial and two knobs.
  const dial = MeshBuilder.CreateCylinder(
    "radioDial",
    { height: 0.008, diameter: 0.08, tessellation: 10 },
    scene,
  );
  dial.rotation.x = Math.PI / 2;
  dial.position = v(-0.06, 0.11, -0.082);
  parts.push(finish(dial, toColor(CONFIG.palette.bone), 49));
  [0.05, 0.1].forEach((x, index) => {
    const knob = MeshBuilder.CreateCylinder(
      "radioKnob",
      { height: 0.02, diameter: 0.03, tessellation: 6 },
      scene,
    );
    knob.rotation.x = Math.PI / 2;
    knob.position = v(x, 0.1, -0.088);
    parts.push(finish(knob, dark, 50 + index));
  });
  // The battery's red band in a slot on the right side.
  const slot = MeshBuilder.CreateBox(
    "radioSlot",
    { width: 0.006, height: 0.04, depth: 0.1 },
    scene,
  );
  slot.position = v(0.152, 0.08, 0);
  parts.push(finish(slot, toColor(CONFIG.palette.batteryLabel), 52));
  // Carrying handle on top: two posts and a grip (a ring would cost ~300 triangles).
  for (const x of [-0.06, 0.06]) {
    const post = MeshBuilder.CreateBox(
      "radioHandlePost",
      { width: 0.014, height: 0.04, depth: 0.014 },
      scene,
    );
    post.position = v(x, 0.22, 0);
    parts.push(finish(post, dark, 53));
  }
  const grip = MeshBuilder.CreateBox(
    "radioHandleGrip",
    { width: 0.134, height: 0.014, depth: 0.018 },
    scene,
  );
  grip.position = v(0, 0.244, 0);
  parts.push(finish(grip, dark, 54));
  // The antenna, up from the back left corner.
  const antenna = createAntennaMesh(scene);
  antenna.position = v(-0.13, 0.2, 0.06);
  antenna.bakeCurrentTransformIntoVertices();
  parts.push(antenna);
  return assemble("radio", parts, getBoneMaterial(scene));
}

/**
 * A deer skull (OB8-A, OB12, MD1-A): a doe's (no antlers, CO3), bleached, about 22 cm long. A
 * rounded braincase at the back, the snout and jaw as one wide wedge tapering to the nose, a nasal
 * bone along the top and dark eye sockets on the sides. Faces +Z.
 */
export function createDeerSkullMesh(scene: Scene): Mesh {
  const boneColor = toColor(CONFIG.palette.creatureBone);
  const socket = new Color3(0.05, 0.04, 0.03);
  const eyes = [-1, 1].map((s) => v(0.043 * s, 0.06, 0.04));
  const paintSkull = (mesh: Mesh, seed: number) =>
    paint(
      mesh,
      (x, y, z) =>
        eyes.some((eye) => Vector3.Distance(eye, v(x, y, z)) < 0.022) ? socket : boneColor,
      seed,
    );

  // The braincase: round, a little longer than wide.
  const cranium = MeshBuilder.CreateSphere("skullCranium", { diameter: 0.1, segments: 4 }, scene);
  cranium.scaling.set(0.9, 0.8, 1.05);
  cranium.position = v(0, 0.05, 0);
  cranium.bakeCurrentTransformIntoVertices();

  // Snout and jaw in one wedge: a four-sided taper, flattened top to bottom, pointing forward and
  // a little down, its wide end tucked into the braincase.
  const snout = MeshBuilder.CreateCylinder(
    "skullSnout",
    { height: 0.16, diameterTop: 0.03, diameterBottom: 0.08, tessellation: 4 },
    scene,
  );
  snout.rotation.y = Math.PI / 4;
  snout.bakeCurrentTransformIntoVertices();
  snout.scaling.set(1, 1, 0.65);
  snout.bakeCurrentTransformIntoVertices();
  snout.rotation.x = Math.PI / 2 + 0.12;
  snout.position = v(0, 0.035, 0.1);
  snout.bakeCurrentTransformIntoVertices();

  // The nasal bone, a thin ridge sloping down the top of the snout.
  const nasal = MeshBuilder.CreateBox(
    "skullNasal",
    { width: 0.02, height: 0.008, depth: 0.12 },
    scene,
  );
  nasal.rotation.x = 0.22;
  nasal.position = v(0, 0.058, 0.085);
  nasal.bakeCurrentTransformIntoVertices();

  const parts = [cranium, snout, nasal];
  parts.forEach((part, index) => {
    paintSkull(part, 54 + index);
    jitter(part, 0.003, 57 + index);
  });
  return assemble("deerSkull", parts, getBoneMaterial(scene));
}

/** Gallery entries (A2-C), lifted a little off the ground. */
function galleryItem(id: string, label: string, build: (scene: Scene) => Mesh): ModelGenerator {
  return {
    id,
    label,
    create(scene: Scene): GeneratedModel {
      const mesh = build(scene);
      mesh.position.y = 0.02;
      return { root: mesh, animations: [] };
    },
  };
}

export const battery = galleryItem("battery", "Bateria", createBatteryMesh);
export const antenna = galleryItem("antenna", "Antena", createAntennaMesh);
export const tubes = galleryItem("tubes", "Válvulas", createTubesMesh);
export const radio = galleryItem("radio", "Rádio", createRadioMesh);
export const deerSkull = galleryItem("deerSkull", "Crânio de cervo", createDeerSkullMesh);
