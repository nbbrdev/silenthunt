import {
  Color3,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import {
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { Input } from "../core/input";
import {
  createDoorModel,
  createFoundationMesh,
  createRoofMesh,
  createWallMesh,
} from "../models/structures/buildPieces";
import type { Equipment } from "../player/equipment";
import type { Inventory } from "../player/inventory";
import type { Player } from "../player/player";
import type { InventoryScreen } from "../ui/inventoryScreen";
import type { ChunkManager } from "../world/chunks";
import type { PieceKind, Plan, StructureManager } from "../world/structures";
import type { Terrain } from "../world/terrain";
import type { InteractionSystem } from "./interactions";
import type { NoiseSystem } from "./noise";
import type { SoundEffects } from "./soundEffects";

const PIECES: { kind: PieceKind; label: string }[] = [
  { kind: "foundation", label: "Fundação" },
  { kind: "wall", label: "Parede" },
  { kind: "door", label: "Porta" },
  { kind: "roof", label: "Telhado" },
];

const OK_COLOR = new Color3(0.35, 0.95, 0.4);
const BAD_COLOR = new Color3(1, 0.3, 0.25);

/** What the building mode needs from the rest of the game. */
export interface BuildingWorld {
  structures: StructureManager;
  terrain: Terrain;
  chunks: ChunkManager;
  inventory: Inventory;
  equipment: Equipment;
  inventoryScreen: InventoryScreen;
  noise: NoiseSystem;
  interactions: InteractionSystem;
}

/**
 * The building mode (NBB-145, RF-52, RF-53, CN1-A to CN3). B turns it on and off; 1 to 4 (or the
 * wheel) pick the piece, R turns it, the left button places it where the see-through preview
 * shows (green if it can go there, red if not), paid in wood from the inventory; holding the
 * right button on a piece for 1 s takes it apart for half its wood. Each piece placed is heard
 * 20 m away.
 */
export class BuildingMode {
  private readonly input: Input;
  private readonly player: Player;
  private readonly world: BuildingWorld;
  private readonly ghosts: Record<PieceKind, TransformNode>;
  private readonly ghostMaterial: StandardMaterial;
  private readonly bar: StackPanel;
  private readonly barSlots: { frame: Rectangle; cost: TextBlock }[] = [];
  private readonly hint: TextBlock;
  private readonly progressFrame: Rectangle;
  private readonly progressFill: Rectangle;
  private active = false;
  private selected = 0;
  private turn = 0;
  private plan: Plan | undefined;
  private dismantleSeconds = 0;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    world: BuildingWorld,
    ui: AdvancedDynamicTexture,
  ) {
    this.input = input;
    this.player = player;
    this.world = world;

    // RF-53: see-through previews, tinted green or red.
    this.ghostMaterial = new StandardMaterial("buildGhost", scene);
    this.ghostMaterial.disableLighting = true;
    this.ghostMaterial.emissiveColor = OK_COLOR;
    this.ghostMaterial.alpha = 0.4;
    this.ghostMaterial.backFaceCulling = false;
    const ghost = (name: string, meshes: Mesh[]) => {
      const root = new TransformNode(`ghost-${name}`, scene);
      for (const mesh of meshes) {
        mesh.parent = root;
        mesh.material = this.ghostMaterial;
        mesh.useVertexColors = false;
        mesh.isPickable = false;
      }
      root.setEnabled(false);
      return root;
    };
    const door = createDoorModel(scene);
    door.leaf.position = door.hinge.clone();
    this.ghosts = {
      foundation: ghost("foundation", [createFoundationMesh(scene)]),
      wall: ghost("wall", [createWallMesh(scene)]),
      door: ghost("door", [door.frame, door.leaf]),
      roof: ghost("roof", [createRoofMesh(scene)]),
    };

    // CN1-A: the pieces' bar, where the quick bar is.
    const { slotPx } = CONFIG.inventory;
    this.bar = new StackPanel("buildBar");
    this.bar.isVertical = false;
    this.bar.height = `${slotPx}px`;
    this.bar.top = "-52px";
    this.bar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.bar.isVisible = false;
    ui.addControl(this.bar);
    PIECES.forEach((piece, index) => {
      const frame = new Rectangle(`buildSlot${index}`);
      frame.width = "104px";
      frame.height = `${slotPx}px`;
      frame.paddingLeft = "3px";
      frame.paddingRight = "3px";
      frame.thickness = 1;
      frame.cornerRadius = 4;
      frame.background = "rgba(0, 0, 0, 0.35)";
      const name = new TextBlock(`buildSlot${index}Name`, `${index + 1} ${piece.label}`);
      name.color = "white";
      name.fontSize = 14;
      name.top = "-8px";
      frame.addControl(name);
      const cost = new TextBlock(`buildSlot${index}Cost`, "");
      cost.fontSize = 12;
      cost.top = "10px";
      frame.addControl(cost);
      this.bar.addControl(frame);
      this.barSlots.push({ frame, cost });
    });
    this.hint = new TextBlock("buildHint", "");
    this.hint.color = "white";
    this.hint.fontSize = 14;
    this.hint.height = "22px";
    this.hint.top = `${-60 - slotPx}px`;
    this.hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.hint.isVisible = false;
    ui.addControl(this.hint);

    // CN2-A: how far along taking a piece apart is.
    this.progressFrame = new Rectangle("dismantleProgress");
    this.progressFrame.width = "140px";
    this.progressFrame.height = "4px";
    this.progressFrame.top = "80px";
    this.progressFrame.thickness = 0;
    this.progressFrame.background = "rgba(255, 255, 255, 0.15)";
    this.progressFrame.isVisible = false;
    ui.addControl(this.progressFrame);
    this.progressFill = new Rectangle("dismantleProgressFill");
    this.progressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.progressFill.thickness = 0;
    this.progressFill.background = "white";
    this.progressFill.alpha = 0.7;
    this.progressFrame.addControl(this.progressFill);

    scene.onBeforeRenderObservable.add(() => {
      this.update(frameSeconds(scene));
    });
  }

  /** Development only: holds (true) or lets go of (false) the right button; undefined: real mouse. */
  debugHold: boolean | undefined;
  /** NBB-149 (AC1): placing and taking apart a piece are heard. */
  sounds: SoundEffects | undefined;

  get isActive(): boolean {
    return this.active;
  }

  /** B: building mode on or off (also for development). */
  toggle(): void {
    this.active = !this.active;
    this.world.equipment.suspended = this.active;
    this.world.inventoryScreen.hotbarHidden = this.active;
    this.bar.isVisible = this.active;
    this.hint.isVisible = this.active;
    this.dismantleSeconds = 0;
    this.progressFrame.isVisible = false;
    if (!this.active) {
      for (const ghost of Object.values(this.ghosts)) {
        ghost.setEnabled(false);
      }
    }
  }

  /** Picks a piece (0 to 3), as 1 to 4 would. */
  select(index: number): void {
    this.selected = ((index % PIECES.length) + PIECES.length) % PIECES.length;
  }

  /** Places the piece in the preview, as the left button would (also for development). */
  placeNow(): void {
    const plan = this.plan;
    const kind = PIECES[this.selected]?.kind;
    if (!plan || !kind || plan.problem) {
      return;
    }
    const cost = CONFIG.building.cost[kind];
    if (!this.world.inventory.remove("wood", cost)) {
      return;
    }
    this.world.structures.place(plan, this.turn);
    this.world.noise.emit(plan.position, CONFIG.noise.radius.build, "build");
    this.sounds?.play("place");
  }

  private update(seconds: number): void {
    const controls = this.player.controlsEnabled;
    if (controls && this.input.wasPressed("KeyB")) {
      this.toggle();
    }
    if (!this.active) {
      return;
    }
    if (controls) {
      ["Digit1", "Digit2", "Digit3", "Digit4"].forEach((code, index) => {
        if (this.input.wasPressed(code)) {
          this.select(index);
        }
      });
      const wheel = this.input.consumeWheel();
      if (wheel !== 0) {
        this.select(this.selected + wheel);
      }
      if (this.input.wasPressed("KeyR")) {
        this.turn = (this.turn + 1) % 4;
      }
    }
    this.refreshBar();
    this.updatePreview(controls);
    if (!controls) {
      return;
    }
    if (this.input.wasPressed("Mouse0")) {
      this.placeNow();
    }
    this.updateDismantle(this.debugHold ?? this.input.isDown("Mouse2"), seconds);
  }

  /** RF-53: the preview where the player looks, green or red, with the reason when red. */
  private updatePreview(controls: boolean): void {
    const kind = PIECES[this.selected]?.kind ?? "foundation";
    for (const [ghostKind, ghost] of Object.entries(this.ghosts)) {
      ghost.setEnabled(controls && ghostKind === kind && this.plan !== undefined);
    }
    const target = controls ? this.targetPoint() : undefined;
    const { structures, chunks, inventory } = this.world;
    this.plan = target
      ? structures.plan(kind, target, this.turn, this.player.feet, (x, z) =>
          chunks.obstaclesNear(x, z, 1.2).some((obstacle) => !obstacle.structure),
        )
      : undefined;
    const plan = this.plan;
    const ghost = this.ghosts[kind];
    if (!plan) {
      ghost.setEnabled(false);
      this.hint.text = "Mire no chão, a até 6 m";
      this.hint.color = "white";
      return;
    }
    if (!plan.problem && inventory.count("wood") < CONFIG.building.cost[kind]) {
      plan.problem = "Falta madeira";
    }
    ghost.setEnabled(true);
    ghost.position.copyFrom(plan.position);
    ghost.rotation.y = plan.rotationY;
    this.ghostMaterial.emissiveColor = plan.problem ? BAD_COLOR : OK_COLOR;
    this.hint.text = plan.problem ?? "[R] Girar · segure o botão direito para desmontar · [B] Sair";
    this.hint.color = plan.problem ? "#ff8a7a" : "white";
  }

  /** Where the view meets the ground or a floor, within reach (CN3). */
  private targetPoint(): Vector3 | undefined {
    const camera = this.player.camera;
    const eye = camera.globalPosition;
    const direction = camera.getDirection(Vector3.Forward());
    const { reach } = CONFIG.building;
    for (let distance = 0.5; distance <= reach; distance += 0.1) {
      const point = eye.add(direction.scale(distance));
      const floor = this.world.structures.floorAt(point.x, point.z);
      const ground = this.world.terrain.heightAt(point.x, point.z);
      if (point.y <= Math.max(ground, floor ?? -Infinity)) {
        return point;
      }
    }
    return undefined;
  }

  /** CN2-A: holding the right button on a piece for 1 s takes it apart for half its wood. */
  private updateDismantle(held: boolean, seconds: number): void {
    const camera = this.player.camera;
    const { structures, inventory, interactions } = this.world;
    const target = held
      ? structures.pieceAlong(
          camera.globalPosition,
          camera.getDirection(Vector3.Forward()),
          CONFIG.building.reach,
        )
      : undefined;
    if (!target) {
      this.dismantleSeconds = 0;
      this.progressFrame.isVisible = false;
      return;
    }
    if (!Number.isFinite(this.dismantleSeconds)) {
      // Already done: waiting for the button to be let go.
      this.progressFrame.isVisible = false;
      return;
    }
    this.dismantleSeconds += seconds;
    const total = CONFIG.building.dismantleSeconds;
    this.progressFrame.isVisible = true;
    this.progressFill.width = `${Math.round(Math.min(1, this.dismantleSeconds / total) * 140)}px`;
    if (this.dismantleSeconds < total) {
      return;
    }
    this.dismantleSeconds = -Infinity; // until the button is let go
    if (structures.hasDependents(target)) {
      interactions.say("Outra peça depende desta");
      return;
    }
    const kind = structures.remove(target);
    if (kind) {
      const refund = Math.floor(CONFIG.building.cost[kind] / 2);
      inventory.add("wood", refund);
      this.sounds?.play("dismantle");
      interactions.say(`Você recuperou: ${refund} ${refund === 1 ? "madeira" : "madeiras"}`);
    }
  }

  private refreshBar(): void {
    const wood = this.world.inventory.count("wood");
    PIECES.forEach((piece, index) => {
      const slot = this.barSlots[index];
      if (!slot) {
        return;
      }
      const cost = CONFIG.building.cost[piece.kind];
      slot.cost.text = `${cost} madeiras`;
      slot.cost.color = wood >= cost ? "rgba(255, 255, 255, 0.75)" : "#e0685c";
      const selected = index === this.selected;
      slot.frame.thickness = selected ? 2 : 1;
      slot.frame.color = selected ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.25)";
    });
  }
}
