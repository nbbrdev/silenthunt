import {
  Color3,
  Mesh,
  StandardMaterial,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { Control, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import { createBedMesh } from "../models/structures/bed";
import { createCampfireModel } from "../models/structures/campfire";
import type { Equipment } from "../player/equipment";
import type { Inventory } from "../player/inventory";
import type { Player } from "../player/player";
import type { BedManager } from "../world/beds";
import type { CampfireManager } from "../world/campfires";
import type { ChunkManager } from "../world/chunks";
import type { StructureManager } from "../world/structures";
import type { Terrain } from "../world/terrain";
import type { SoundEffects } from "./soundEffects";

const OK_COLOR = new Color3(0.35, 0.95, 0.4);
const BAD_COLOR = new Color3(1, 0.3, 0.25);

/** What putting things down needs from the rest of the game. */
export interface PlacingWorld {
  terrain: Terrain;
  chunks: ChunkManager;
  structures: StructureManager;
  campfires: CampfireManager;
  beds: BedManager;
  inventory: Inventory;
  equipment: Equipment;
}

/**
 * Putting a campfire or a bed down (NBB-146, FG1-A): with one selected on the quick bar, a
 * see-through preview shows where it would go, 1.8 m ahead, on the ground or a floor: green if it
 * fits, red against a trunk, a big rock, a wall or another fire or bed. The left button puts it
 * there.
 */
export class PlacingSystem {
  private readonly player: Player;
  private readonly world: PlacingWorld;
  private readonly ghosts: Record<"campfire" | "bed", TransformNode>;
  private readonly material: StandardMaterial;
  private readonly hint: TextBlock;
  private spot: { position: Vector3; heading: number; ok: boolean } | undefined;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    world: PlacingWorld,
    ui: AdvancedDynamicTexture,
  ) {
    this.player = player;
    this.world = world;
    this.material = new StandardMaterial("placeGhost", scene);
    this.material.disableLighting = true;
    this.material.emissiveColor = OK_COLOR;
    this.material.alpha = 0.4;
    this.material.backFaceCulling = false;
    const ghost = (name: string, root: TransformNode, meshes: Mesh[]) => {
      for (const mesh of meshes) {
        mesh.material = this.material;
        mesh.useVertexColors = false;
        mesh.isPickable = false;
      }
      root.name = `ghost-${name}`;
      root.setEnabled(false);
      return root;
    };
    const fire = createCampfireModel(scene, 1);
    fire.fire.dispose();
    for (const core of fire.cores) {
      core.dispose();
    }
    const bed = createBedMesh(scene);
    this.ghosts = {
      campfire: ghost(
        "campfire",
        fire.root,
        fire.root.getChildMeshes(false).filter((mesh): mesh is Mesh => mesh instanceof Mesh),
      ),
      bed: ghost("bed", bed, [bed]),
    };

    this.hint = new TextBlock("placeHint", "");
    this.hint.color = "white";
    this.hint.fontSize = 14;
    this.hint.height = "22px";
    this.hint.top = `${-60 - CONFIG.inventory.slotPx - 24}px`;
    this.hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.hint.isVisible = false;
    ui.addControl(this.hint);

    scene.onBeforeRenderObservable.add(() => {
      this.update();
      if (this.spot && player.controlsEnabled && input.wasPressed("Mouse0")) {
        this.placeNow();
      }
    });
  }

  /** Puts the held campfire or bed where the preview is (also for development). */
  placeNow(): void {
    const held = this.world.equipment.current;
    const spot = this.spot;
    if (!spot?.ok || (held !== "campfire" && held !== "bed")) {
      return;
    }
    const { inventory } = this.world;
    if (inventory.takeFromSlot(inventory.selected) !== held) {
      return;
    }
    const { x, y, z } = spot.position;
    if (held === "campfire") {
      this.world.campfires.placeAt(x, y, z, spot.heading);
    } else {
      // Like the preview: the head away from the player.
      this.world.beds.placeAt(x, y, z, spot.heading + Math.PI);
    }
    this.sounds?.play("place");
  }

  /** NBB-149 (AC1): putting something down is heard. */
  sounds: SoundEffects | undefined;

  private update(): void {
    const held = this.world.equipment.current;
    const active = (held === "campfire" || held === "bed") && this.player.controlsEnabled;
    this.ghosts.campfire.setEnabled(active && held === "campfire");
    this.ghosts.bed.setEnabled(active && held === "bed");
    this.hint.isVisible = active;
    if (!active) {
      this.spot = undefined;
      return;
    }
    const forward = this.player.camera.getDirection(Vector3.Forward());
    const flat = new Vector3(forward.x, 0, forward.z);
    if (flat.lengthSquared() < 1e-6) {
      return;
    }
    flat.normalize();
    const center = this.player.feet.add(flat.scale(CONFIG.campfire.placeDistance));
    const { terrain, structures, chunks, campfires, beds } = this.world;
    const floor = structures.floorAt(center.x, center.z);
    center.y = Math.max(terrain.heightAt(center.x, center.z), floor ?? -Infinity);
    const heading = Math.atan2(flat.x, flat.z);
    // The bed is long: its two ends must be clear too.
    const points =
      held === "bed"
        ? [center, center.add(flat.scale(0.8)), center.subtract(flat.scale(0.8))]
        : [center];
    const blocked = points.some(
      (point) =>
        chunks.obstaclesNear(point.x, point.z, 0.55).length > 0 ||
        campfires.isNearAny(point.x, point.z, 1.4) ||
        beds.isNearAny(point.x, point.z, 1.2),
    );
    this.spot = { position: center, heading, ok: !blocked };
    const ghost = held === "campfire" ? this.ghosts.campfire : this.ghosts.bed;
    ghost.position.copyFrom(center);
    // The bed lies along the view (feet toward the player).
    ghost.rotation.y = held === "bed" ? heading + Math.PI : heading;
    this.material.emissiveColor = blocked ? BAD_COLOR : OK_COLOR;
    this.hint.text = blocked ? "Algo no caminho" : "Clique para colocar";
    this.hint.color = blocked ? "#ff8a7a" : "white";
  }
}
