import { Observable, PointerEventTypes, type Scene } from "@babylonjs/core";
import {
  Image,
  Rectangle,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
  type Vector2WithInfo,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { Input } from "../core/input";
import type { Player } from "../player/player";
import { BIOMES, BIOME_NAMES, biomeAt, type Biome } from "../world/biomes";
import { cabinsNear } from "../world/cabinSites";
import type { ChunkManager } from "../world/chunks";

/** NBB-157: the map as saved (missing in older saves: nothing explored yet). */
export interface SavedMap {
  /** The explored squares ("ix,iz", `map.cellSize` meters each). */
  explored: string[];
  marks: [number, number][];
  /** Which mark is the destination (its index), if any. */
  destination: number | null;
  /** The cabins visited, with where they stand. */
  visited: { id: string; x: number; z: number }[];
}

/** What the map draws from and works with. */
export interface MapParts {
  input: Input;
  player: Player;
  chunks: ChunkManager;
  seed: number;
  /** The fires: where and whether they burn. */
  fires: () => { x: number; z: number; lit: boolean }[];
  beds: () => { x: number; z: number }[];
  /** OB12, MP3-A: the cabins a note read points to. */
  knownCabins: () => { x: number; z: number }[];
  /** Whether M may open the map now (not in menus, dead, a note, the victory, the inventory). */
  canOpen: () => boolean;
  /** NBB-164 (AG14): whether there is water at a point (lakes and rivers show on the map). */
  isWater: (x: number, z: number) => boolean;
}

interface Point {
  x: number;
  z: number;
}

/**
 * The map (NBB-157; RF-69, MP1-A to MP8). M opens a sheet of paper, north up, centered on the
 * player: what was explored (a band around the path walked) in light paper with its trees as
 * dots, the rest dark. The cabins visited (and the next one, once its note is read), the fires
 * and the beds show by themselves; a click puts or removes a mark, and the right button makes a
 * mark the destination, which the compass then shows. The world goes on while it is open.
 */
export class WorldMap {
  private readonly p: MapParts;
  private readonly sheet: Rectangle;
  private readonly image: Image;
  private readonly canvas: HTMLCanvasElement;
  private readonly explored = new Set<string>();
  private readonly exploredChunks = new Set<string>();
  private readonly visited = new Map<string, Point>();
  private readonly marks: Point[] = [];
  private destination: number | undefined;
  private zoom: number = CONFIG.map.startZoom;
  private open = false;
  private untilReveal = 0;
  /** BM5-A: the biome of each explored square (filled as they are drawn). */
  private readonly cellBiomes = new Map<string, Biome>();
  /** AG14: which quarters of each explored square are water (4 bits; it never changes). */
  private readonly cellWater = new Map<string, number>();
  /** FX14: the map opened or closed (the paper is heard). */
  readonly onToggled = new Observable<boolean>();
  /** The trees of each chunk drawn (refreshed each time the map opens: some may be felled). */
  private readonly trees = new Map<string, Point[]>();

  constructor(scene: Scene, ui: AdvancedDynamicTexture, parts: MapParts) {
    this.p = parts;
    const settings = CONFIG.map;

    this.sheet = new Rectangle("mapSheet");
    this.sheet.width = `${settings.width + 40}px`;
    this.sheet.height = `${settings.height + 110}px`;
    this.sheet.background = settings.colors.explored;
    this.sheet.color = "#8a7f6a";
    this.sheet.thickness = 1;
    this.sheet.cornerRadius = 3;
    this.sheet.isVisible = false;
    this.sheet.zIndex = 8;
    ui.addControl(this.sheet);

    const column = new StackPanel("mapColumn");
    this.sheet.addControl(column);
    const title = new TextBlock("mapTitle", "Mapa");
    title.color = settings.colors.ink;
    title.fontSize = 22;
    title.height = "48px";
    column.addControl(title);

    this.canvas = document.createElement("canvas");
    this.canvas.width = settings.width;
    this.canvas.height = settings.height;
    this.image = new Image("mapImage");
    this.image.width = `${settings.width}px`;
    this.image.height = `${settings.height}px`;
    this.image.onPointerUpObservable.add((info: Vector2WithInfo) => this.click(info));
    column.addControl(this.image);

    const help = new TextBlock(
      "mapHelp",
      "Clique: marcar ou tirar · Botão direito: destino · Roda: zoom · M: fechar",
    );
    help.color = "#5a4f3e";
    help.fontSize = 15;
    help.height = "44px";
    column.addControl(help);

    parts.input.onKeyDownNow.add((code) => {
      if (code === "KeyM") {
        if (this.open) {
          this.close();
        } else if (parts.canOpen()) {
          this.show();
        }
      } else if (code === "Escape" && this.open) {
        this.close();
      }
    });
    scene.onPointerObservable.add((pointer) => {
      if (!this.open || pointer.type !== PointerEventTypes.POINTERWHEEL) {
        return;
      }
      const event = pointer.event as WheelEvent;
      const step = Math.sign(event.deltaY);
      const last = settings.metersPerPixel.length - 1;
      const next = Math.max(0, Math.min(last, this.zoom + step));
      if (next !== this.zoom) {
        this.zoom = next;
        this.draw();
      }
    });
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** MP4-A, MP8: where the destination is, if there is one (the compass shows it). */
  get destinationPoint(): Point | undefined {
    return this.destination === undefined ? undefined : this.marks[this.destination];
  }

  get saved(): SavedMap {
    return {
      explored: [...this.explored],
      marks: this.marks.map(({ x, z }) => [x, z]),
      destination: this.destination ?? null,
      visited: [...this.visited].map(([id, { x, z }]) => ({ id, x, z })),
    };
  }

  restore(saved: Partial<SavedMap>): void {
    for (const key of saved.explored ?? []) {
      this.addExplored(key);
    }
    this.marks.length = 0;
    for (const [x, z] of saved.marks ?? []) {
      this.marks.push({ x, z });
    }
    const destination = saved.destination ?? undefined;
    this.destination =
      destination !== undefined && destination < this.marks.length ? destination : undefined;
    for (const { id, x, z } of saved.visited ?? []) {
      this.visited.set(id, { x, z });
    }
  }

  /** Development: how much was explored, the marks and the destination. */
  debugState(): object {
    return {
      open: this.open,
      explored: this.explored.size,
      marks: this.marks.map(({ x, z }) => [Math.round(x), Math.round(z)]),
      destination: this.destination ?? null,
      visited: [...this.visited.keys()],
      zoom: CONFIG.map.metersPerPixel[this.zoom],
    };
  }

  /** Development: puts a mark at (x, z), as a click would; `destination` makes it the destination. */
  debugMark(x: number, z: number, destination = false): void {
    this.marks.push({ x, z });
    if (destination) {
      this.destination = this.marks.length - 1;
    }
  }

  private show(): void {
    const { player, input } = this.p;
    this.open = true;
    this.sheet.isVisible = true;
    // MP6-A: the world goes on; the player stands still and gets the mouse.
    player.controlsEnabled = false;
    input.pointerLockEnabled = false;
    this.zoom = CONFIG.map.startZoom;
    this.trees.clear();
    this.reveal();
    this.draw();
    this.onToggled.notifyObservers(true);
  }

  private close(): void {
    const { player, input } = this.p;
    this.open = false;
    this.sheet.isVisible = false;
    this.onToggled.notifyObservers(false);
    player.controlsEnabled = true;
    input.pointerLockEnabled = true;
    // Inside the key event: the browser lets the game take the mouse back.
    input.capturePointer();
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    const settings = CONFIG.map;
    this.untilReveal -= seconds;
    if (this.untilReveal <= 0) {
      this.untilReveal = settings.revealSeconds;
      this.reveal();
    }
    // MP8: reaching the destination ends it (the mark stays).
    const target = this.destinationPoint;
    const feet = this.p.player.feet;
    const reached =
      target &&
      Math.hypot(target.x - feet.x, target.z - feet.z) <= settings.destinationReachDistance;
    if (reached) {
      this.destination = undefined;
    }
  }

  /** MP2-A, MP8: the squares around the player become explored; nearby cabins, visited. */
  private reveal(): void {
    const { cellSize, revealRadius, cabinVisitDistance } = CONFIG.map;
    const { x, z } = this.p.player.feet;
    const reach = Math.ceil(revealRadius / cellSize);
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const centerX = (cx + dx + 0.5) * cellSize;
        const centerZ = (cz + dz + 0.5) * cellSize;
        if (Math.hypot(centerX - x, centerZ - z) <= revealRadius) {
          this.addExplored(`${cx + dx},${cz + dz}`);
        }
      }
    }
    for (const site of cabinsNear(x, z, this.p.seed)) {
      if (Math.hypot(site.x - x, site.z - z) <= cabinVisitDistance) {
        this.visited.set(site.id, { x: site.x, z: site.z });
      }
    }
  }

  private addExplored(key: string): void {
    if (this.explored.has(key)) {
      return;
    }
    this.explored.add(key);
    const [ix = 0, iz = 0] = key.split(",").map(Number);
    const { cellSize } = CONFIG.map;
    const { chunkSize } = CONFIG.world;
    const chunkX = Math.floor((ix * cellSize) / chunkSize);
    const chunkZ = Math.floor((iz * cellSize) / chunkSize);
    this.exploredChunks.add(`${chunkX},${chunkZ}`);
  }

  /** Map pixels from a world point (north, +Z, is up). */
  private toPixels(x: number, z: number): { px: number; py: number } {
    const { width, height, metersPerPixel } = CONFIG.map;
    const mpp = metersPerPixel[this.zoom] ?? 1;
    const feet = this.p.player.feet;
    return { px: width / 2 + (x - feet.x) / mpp, py: height / 2 - (z - feet.z) / mpp };
  }

  /** MP4-A, MP8: left puts a mark or removes the one clicked; right makes it the destination. */
  private click(info: Vector2WithInfo): void {
    const settings = CONFIG.map;
    const mpp = settings.metersPerPixel[this.zoom] ?? 1;
    const left = this.image.centerX - settings.width / 2;
    const top = this.image.centerY - settings.height / 2;
    const px = info.x - left;
    const py = info.y - top;
    const feet = this.p.player.feet;
    const picked = this.marks.findIndex((mark) => {
      const at = this.toPixels(mark.x, mark.z);
      return Math.hypot(at.px - px, at.py - py) <= settings.markPickPixels;
    });
    if (info.buttonIndex === 2) {
      if (picked >= 0) {
        this.destination = this.destination === picked ? undefined : picked;
      }
    } else if (picked >= 0) {
      this.marks.splice(picked, 1);
      if (this.destination === picked) {
        this.destination = undefined;
      } else if (this.destination !== undefined && this.destination > picked) {
        this.destination--;
      }
    } else if (this.marks.length < settings.maxMarks) {
      const x = feet.x + (px - settings.width / 2) * mpp;
      const z = feet.z - (py - settings.height / 2) * mpp;
      this.marks.push({ x, z });
    }
    this.draw();
  }

  /** MP7-A: paper and ink. */
  /** BM5-A: the biome of an explored square (remembered: it never changes). */
  private biomeOf(key: string, ix: number, iz: number): Biome {
    let biome = this.cellBiomes.get(key);
    if (!biome) {
      const { cellSize } = CONFIG.map;
      biome = biomeAt((ix + 0.5) * cellSize, (iz + 0.5) * cellSize, this.p.seed);
      this.cellBiomes.set(key, biome);
    }
    return biome;
  }

  /** AG14: the quarters of an explored square that are water, as bits (remembered). */
  private waterOf(key: string, ix: number, iz: number): number {
    let bits = this.cellWater.get(key);
    if (bits === undefined) {
      const { cellSize } = CONFIG.map;
      bits = 0;
      for (let q = 0; q < 4; q++) {
        const x = (ix + 0.25 + 0.5 * (q % 2)) * cellSize;
        const z = (iz + 0.25 + 0.5 * Math.floor(q / 2)) * cellSize;
        if (this.p.isWater(x, z)) {
          bits |= 1 << q;
        }
      }
      this.cellWater.set(key, bits);
    }
    return bits;
  }

  /** BM8: a small legend of the biomes (and the water, AG14) seen so far, at the bottom left. */
  private drawLegend(context: CanvasRenderingContext2D): void {
    const { biomeColors, colors, height } = CONFIG.map;
    const seen = BIOMES.filter((biome) => [...this.cellBiomes.values()].includes(biome));
    const rows: { color: string; name: string }[] = seen.map((biome) => ({
      color: biomeColors[biome],
      name: BIOME_NAMES[biome],
    }));
    if ([...this.cellWater.values()].some((bits) => bits !== 0)) {
      rows.push({ color: colors.water, name: "Água" });
    }
    if (rows.length < 2) {
      return;
    }
    context.font = "13px 'Crimson Pro', serif";
    context.textBaseline = "middle";
    rows.forEach((row, index) => {
      const y = height - 14 - (rows.length - 1 - index) * 18;
      context.fillStyle = row.color;
      context.fillRect(10, y - 6, 14, 12);
      context.strokeStyle = colors.ink;
      context.lineWidth = 1;
      context.strokeRect(10, y - 6, 14, 12);
      context.fillStyle = colors.ink;
      context.fillText(row.name, 30, y);
    });
  }

  private draw(): void {
    const settings = CONFIG.map;
    const { colors, cellSize, width, height } = settings;
    const mpp = settings.metersPerPixel[this.zoom] ?? 1;
    const context = this.canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.fillStyle = colors.unexplored;
    context.fillRect(0, 0, width, height);

    // The explored squares in light paper, BM5-A: tinted by their biome.
    const cellPixels = cellSize / mpp;
    for (const key of this.explored) {
      const [ix = 0, iz = 0] = key.split(",").map(Number);
      const corner = this.toPixels(ix * cellSize, (iz + 1) * cellSize);
      if (
        corner.px > -cellPixels &&
        corner.py > -cellPixels &&
        corner.px < width &&
        corner.py < height
      ) {
        context.fillStyle = settings.biomeColors[this.biomeOf(key, ix, iz)];
        context.fillRect(corner.px, corner.py, cellPixels + 0.6, cellPixels + 0.6);
        // AG14: its watery quarters in blue-gray (north is up: the upper half is +Z).
        const water = this.waterOf(key, ix, iz);
        if (water !== 0) {
          context.fillStyle = colors.water;
          const half = cellPixels / 2;
          for (let q = 0; q < 4; q++) {
            if (water & (1 << q)) {
              const qx = corner.px + (q % 2) * half;
              const qy = corner.py + (1 - Math.floor(q / 2)) * half;
              context.fillRect(qx, qy, half + 0.6, half + 0.6);
            }
          }
        }
      }
    }
    this.drawLegend(context);

    // The trees of the explored squares, as dots of ink.
    const dot = Math.max(0.8, 1.4 / mpp);
    context.fillStyle = colors.tree;
    for (const chunk of this.exploredChunks) {
      for (const tree of this.treesOf(chunk)) {
        const cell = `${Math.floor(tree.x / cellSize)},${Math.floor(tree.z / cellSize)}`;
        if (!this.explored.has(cell)) {
          continue;
        }
        const { px, py } = this.toPixels(tree.x, tree.z);
        if (px >= 0 && py >= 0 && px <= width && py <= height) {
          context.beginPath();
          context.arc(px, py, dot, 0, Math.PI * 2);
          context.fill();
        }
      }
    }

    // MP3-A: the cabins visited and the ones a note points to, as little houses.
    const cabins = new Map<string, Point>();
    for (const point of [...this.visited.values(), ...this.p.knownCabins()]) {
      cabins.set(`${Math.round(point.x)},${Math.round(point.z)}`, point);
    }
    for (const cabin of cabins.values()) {
      this.drawCabin(context, cabin);
    }
    for (const bed of this.p.beds()) {
      const { px, py } = this.toPixels(bed.x, bed.z);
      context.fillStyle = colors.ink;
      context.fillRect(px - 5, py - 3, 10, 6);
    }
    for (const fire of this.p.fires()) {
      const { px, py } = this.toPixels(fire.x, fire.z);
      context.fillStyle = fire.lit ? colors.fireLit : colors.fireOut;
      context.beginPath();
      context.arc(px, py, 4.5, 0, Math.PI * 2);
      context.fill();
    }

    // MP4-A, MP8: the marks, numbered; the destination circled.
    context.strokeStyle = colors.mark;
    context.fillStyle = colors.mark;
    context.lineWidth = 2.5;
    context.font = `bold 13px "${CONFIG.hud.fontFamily}"`;
    this.marks.forEach((mark, index) => {
      const { px, py } = this.toPixels(mark.x, mark.z);
      context.beginPath();
      context.moveTo(px - 6, py - 6);
      context.lineTo(px + 6, py + 6);
      context.moveTo(px + 6, py - 6);
      context.lineTo(px - 6, py + 6);
      context.stroke();
      context.fillText(String(index + 1), px + 8, py - 6);
      if (index === this.destination) {
        context.beginPath();
        context.arc(px, py, 11, 0, Math.PI * 2);
        context.stroke();
      }
    });

    // The player: an arrow pointing where they look.
    const yaw = this.p.player.view.yaw;
    const center = this.toPixels(this.p.player.feet.x, this.p.player.feet.z);
    context.save();
    context.translate(center.px, center.py);
    // Yaw 0 faces north (up on the map); turning right turns clockwise.
    context.rotate(yaw);
    context.fillStyle = colors.ink;
    context.beginPath();
    context.moveTo(0, -11);
    context.lineTo(7, 8);
    context.lineTo(0, 4);
    context.lineTo(-7, 8);
    context.closePath();
    context.fill();
    context.restore();

    this.image.source = this.canvas.toDataURL();
  }

  private drawCabin(context: CanvasRenderingContext2D, cabin: Point): void {
    const { px, py } = this.toPixels(cabin.x, cabin.z);
    context.strokeStyle = CONFIG.map.colors.ink;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(px - 8, py + 7);
    context.lineTo(px - 8, py - 2);
    context.lineTo(px, py - 9);
    context.lineTo(px + 8, py - 2);
    context.lineTo(px + 8, py + 7);
    context.closePath();
    context.stroke();
  }

  private treesOf(chunk: string): Point[] {
    const cached = this.trees.get(chunk);
    if (cached) {
      return cached;
    }
    const [cx = 0, cz = 0] = chunk.split(",").map(Number);
    const trees = this.p.chunks.treesIn(cx, cz);
    this.trees.set(chunk, trees);
    return trees;
  }
}
