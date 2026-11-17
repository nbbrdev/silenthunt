import { PointerEventTypes, type Scene } from "@babylonjs/core";
import {
  Button,
  Control,
  Image,
  Rectangle,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
  type Vector2WithInfo,
} from "@babylonjs/gui";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { Crafting } from "../player/crafting";
import type { Inventory, Stack } from "../player/inventory";
import { ITEM_LABELS, type ItemId, type Recipe } from "../player/items";
import type { Player } from "../player/player";

/** One slot drawn on screen: its frame, the item's icon and how many. */
interface SlotView {
  frame: Rectangle;
  icon: Image;
  count: TextBlock;
}

/**
 * The quick bar at the bottom of the screen (G2, RF-57) and the inventory screen on Tab (IN1-A,
 * IN3-A, IN4-A). The game goes on while it is open: the player stands still and the mouse is free.
 * A click picks up a whole stack and the next one puts it down (or swaps it); the right button
 * picks up half a stack, or puts down one at a time.
 */
export class InventoryScreen {
  /** Asked before opening (not while dead). */
  canOpen: () => boolean = () => true;

  private readonly inventory: Inventory;
  private readonly player: Player;
  private readonly input: Input;
  private readonly hotbar: SlotView[] = [];
  private readonly panelSlots: SlotView[] = [];
  private readonly hotbarPanel: StackPanel;
  private readonly panel: Rectangle;
  private readonly hoverText: TextBlock;
  private readonly nameText: TextBlock;
  private readonly cursorView: SlotView;
  private readonly crafting: Crafting;
  private readonly recipesPanel: Rectangle;
  private readonly recipeRows: RecipeRow[] = [];
  private readonly craftText: TextBlock;
  private readonly craftBar: Rectangle;
  private readonly craftFill: Rectangle;
  private icons: Partial<Record<ItemId, string>> = {};
  private cursor: Stack | undefined;
  private open = false;
  private nameLeft = 0;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    inventory: Inventory,
    crafting: Crafting,
    ui: AdvancedDynamicTexture,
  ) {
    this.inventory = inventory;
    this.crafting = crafting;
    this.player = player;
    this.input = input;
    const { hotbarSlots, backpackSlots, slotPx } = CONFIG.inventory;

    // --- The quick bar, always on screen.
    this.hotbarPanel = new StackPanel("hotbar");
    this.hotbarPanel.isVertical = false;
    this.hotbarPanel.height = `${slotPx}px`;
    this.hotbarPanel.top = "-52px";
    this.hotbarPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    ui.addControl(this.hotbarPanel);
    for (let index = 0; index < hotbarSlots; index++) {
      const view = createSlot(`hotbar${index}`);
      view.frame.paddingLeft = "3px";
      view.frame.paddingRight = "3px";
      view.frame.width = `${slotPx + 6}px`;
      this.hotbarPanel.addControl(view.frame);
      this.hotbar.push(view);
    }
    // The name of what was just picked on the quick bar, for a moment.
    this.nameText = new TextBlock("heldName", "");
    this.nameText.color = "white";
    this.nameText.fontSize = 15;
    this.nameText.height = "22px";
    this.nameText.top = `${-60 - slotPx}px`;
    this.nameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    ui.addControl(this.nameText);

    // --- The inventory screen (Tab): the backpack above, the quick bar below it.
    const gap = 6;
    const columns = hotbarSlots;
    const rows = backpackSlots / columns;
    // CF1-A: the recipes stand in a column to the right; the two are centered together.
    const panelWidth = columns * (slotPx + gap) + 40;
    // Tall enough for the slots and for every recipe plus the progress bar under them.
    const panelHeight = Math.max(
      (rows + 1) * (slotPx + gap) + 120,
      RECIPE_TOP + crafting.recipes.length * RECIPE_STEP + 56,
    );
    const recipesWidth = RECIPES_WIDTH;
    const between = 12;
    this.panel = new Rectangle("inventoryPanel");
    this.panel.width = `${panelWidth}px`;
    this.panel.height = `${panelHeight}px`;
    this.panel.left = `${-(recipesWidth + between) / 2}px`;
    this.panel.background = "rgba(10, 10, 10, 0.82)";
    this.panel.color = "rgba(255, 255, 255, 0.2)";
    this.panel.thickness = 1;
    this.panel.cornerRadius = 6;
    this.panel.isVisible = false;
    ui.addControl(this.panel);
    const title = new TextBlock("inventoryTitle", "Inventário");
    title.color = "white";
    title.fontSize = 18;
    title.height = "30px";
    title.top = "12px";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.addControl(title);

    this.recipesPanel = new Rectangle("recipesPanel");
    this.recipesPanel.width = `${recipesWidth}px`;
    this.recipesPanel.height = `${panelHeight}px`;
    this.recipesPanel.left = `${(panelWidth + between) / 2}px`;
    this.recipesPanel.background = this.panel.background;
    this.recipesPanel.color = this.panel.color;
    this.recipesPanel.thickness = 1;
    this.recipesPanel.cornerRadius = 6;
    this.recipesPanel.isVisible = false;
    ui.addControl(this.recipesPanel);
    const recipesTitle = new TextBlock("recipesTitle", "Fazer");
    recipesTitle.color = "white";
    recipesTitle.fontSize = 18;
    recipesTitle.height = "30px";
    recipesTitle.top = "12px";
    recipesTitle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.recipesPanel.addControl(recipesTitle);
    crafting.recipes.forEach((recipe, index) => {
      const row = createRecipeRow(recipe, index);
      row.button.onPointerUpObservable.add(() => crafting.start(recipe));
      this.recipesPanel.addControl(row.frame);
      this.recipeRows.push(row);
    });
    // CF2-B: what is being made, and how far along.
    this.craftText = new TextBlock("craftText", "");
    this.craftText.color = "white";
    this.craftText.alpha = 0.8;
    this.craftText.fontSize = 14;
    this.craftText.height = "20px";
    this.craftText.top = "-30px";
    this.craftText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.recipesPanel.addControl(this.craftText);
    this.craftBar = new Rectangle("craftBar");
    this.craftBar.width = `${recipesWidth - 40}px`;
    this.craftBar.height = "4px";
    this.craftBar.top = "-18px";
    this.craftBar.thickness = 0;
    this.craftBar.background = "rgba(255, 255, 255, 0.15)";
    this.craftBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.recipesPanel.addControl(this.craftBar);
    this.craftFill = new Rectangle("craftFill");
    this.craftFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.craftFill.thickness = 0;
    this.craftFill.background = "white";
    this.craftFill.alpha = 0.7;
    this.craftBar.addControl(this.craftFill);
    crafting.onChanged.add(() => this.refresh());

    const place = (index: number, column: number, row: number, extra: number) => {
      const view = createSlot(`inventorySlot${index}`);
      view.frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      view.frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      view.frame.left = `${20 + column * (slotPx + gap)}px`;
      view.frame.top = `${50 + row * (slotPx + gap) + extra}px`;
      view.frame.isPointerBlocker = true;
      view.frame.onPointerUpObservable.add((info: Vector2WithInfo) => {
        this.moveCursor(info.x, info.y);
        this.click(index, info.buttonIndex === 2);
      });
      view.frame.onPointerEnterObservable.add(() => this.hover(index));
      view.frame.onPointerOutObservable.add(() => this.hover(undefined));
      this.panel.addControl(view.frame);
      this.panelSlots[index] = view;
    };
    for (let i = 0; i < backpackSlots; i++) {
      place(hotbarSlots + i, i % columns, Math.floor(i / columns), 0);
    }
    for (let i = 0; i < hotbarSlots; i++) {
      // A small gap sets the quick bar apart from the backpack.
      place(i, i, rows, 14);
    }
    this.hoverText = new TextBlock("inventoryHover", "");
    this.hoverText.color = "white";
    this.hoverText.alpha = 0.75;
    this.hoverText.fontSize = 15;
    this.hoverText.height = "24px";
    this.hoverText.top = "-14px";
    this.hoverText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.panel.addControl(this.hoverText);

    // What is held by the mouse while moving items, following the pointer.
    this.cursorView = createSlot("inventoryCursor");
    this.cursorView.frame.thickness = 0;
    this.cursorView.frame.background = "transparent";
    this.cursorView.frame.isPointerBlocker = false;
    this.cursorView.frame.isHitTestVisible = false;
    this.cursorView.frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.cursorView.frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.cursorView.frame.isVisible = false;
    ui.addControl(this.cursorView.frame);
    scene.onPointerObservable.add((pointer) => {
      if (pointer.type === PointerEventTypes.POINTERMOVE && this.open) {
        this.moveCursor(pointer.event.offsetX, pointer.event.offsetY);
      }
    });

    inventory.onChanged.add(() => this.refresh());
    let lastSelected = inventory.selected;
    inventory.onChanged.add(() => {
      if (inventory.selected !== lastSelected) {
        lastSelected = inventory.selected;
        this.showName();
      }
    });
    input.onKeyDownNow.add((code) => {
      if (code === "Tab") {
        this.toggle();
      } else if (code === "Escape" && this.open) {
        this.close(false);
      }
    });
    scene.onBeforeRenderObservable.add(() => {
      const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      this.nameLeft = Math.max(0, this.nameLeft - seconds);
      this.nameText.alpha = Math.min(1, this.nameLeft * 3) * 0.8;
      const progress = this.crafting.progress;
      this.craftBar.isVisible = progress !== undefined;
      this.craftText.text = progress ? `Fazendo: ${ITEM_LABELS[progress.recipe.item]}` : "";
      this.craftFill.width = `${Math.round((progress?.fraction ?? 0) * (RECIPES_WIDTH - 40))}px`;
    });
    this.refresh();
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** IN7-A: the icons arrive once they are drawn. */
  setIcons(icons: Partial<Record<ItemId, string>>): void {
    this.icons = icons;
    this.refresh();
  }

  /** Closes the screen (the death screen takes over, VD4); `recapture` takes the mouse back. */
  close(recapture: boolean): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.panel.isVisible = false;
    this.recipesPanel.isVisible = false;
    this.hotbarPanel.isVisible = true;
    // CF2-B: closing the screen stops what was being made (nothing is used up).
    this.crafting.stop();
    this.cursorView.frame.isVisible = false;
    if (this.cursor) {
      // Whatever was held by the mouse goes back into the inventory.
      this.inventory.add(this.cursor.item, this.cursor.count);
      this.cursor = undefined;
    }
    if (recapture) {
      this.player.controlsEnabled = true;
      this.input.pointerLockEnabled = true;
      this.input.capturePointer();
    }
  }

  private toggle(): void {
    if (this.open) {
      this.close(true);
      return;
    }
    if (!this.canOpen()) {
      return;
    }
    this.open = true;
    this.panel.isVisible = true;
    this.recipesPanel.isVisible = true;
    this.hotbarPanel.isVisible = false;
    // IN3-A: the world goes on; the player stands still and gets the mouse pointer.
    this.player.controlsEnabled = false;
    this.input.pointerLockEnabled = false;
    this.hover(undefined);
    this.refresh();
  }

  /** IN4-A: left picks up or puts down (or swaps); right picks up half or puts down one. */
  private click(index: number, right: boolean): void {
    const slot = this.inventory.slot(index);
    const cursor = this.cursor;
    if (!cursor) {
      if (!slot) {
        return;
      }
      const taken = right ? Math.ceil(slot.count / 2) : slot.count;
      this.cursor = { item: slot.item, count: taken };
      this.inventory.setSlot(index, { item: slot.item, count: slot.count - taken });
      return;
    }
    const max = CONFIG.inventory.stack[cursor.item];
    if (right) {
      // One at a time, onto an empty slot or the same item.
      if (!slot || (slot.item === cursor.item && slot.count < max)) {
        this.inventory.setSlot(index, { item: cursor.item, count: (slot?.count ?? 0) + 1 });
        this.cursor = cursor.count > 1 ? { item: cursor.item, count: cursor.count - 1 } : undefined;
        this.refresh();
      }
      return;
    }
    if (!slot) {
      this.cursor = undefined;
      this.inventory.setSlot(index, cursor);
    } else if (slot.item === cursor.item) {
      const moved = Math.min(cursor.count, max - slot.count);
      this.cursor =
        cursor.count > moved ? { item: cursor.item, count: cursor.count - moved } : undefined;
      this.inventory.setSlot(index, { item: slot.item, count: slot.count + moved });
    } else {
      this.cursor = slot;
      this.inventory.setSlot(index, cursor);
    }
  }

  /** The stack held by the mouse follows the pointer (screen pixels). */
  private moveCursor(x: number, y: number): void {
    const half = CONFIG.inventory.slotPx / 2;
    this.cursorView.frame.left = `${x - half}px`;
    this.cursorView.frame.top = `${y - half}px`;
  }

  private hover(index: number | undefined): void {
    const slot = index === undefined ? undefined : this.inventory.slot(index);
    this.hoverText.text = slot ? `${ITEM_LABELS[slot.item]} (${slot.count})` : "";
  }

  private showName(): void {
    const item = this.inventory.selectedItem;
    this.nameText.text = item ? ITEM_LABELS[item] : "";
    this.nameLeft = item ? CONFIG.inventory.nameSeconds : 0;
  }

  private refresh(): void {
    const { hotbarSlots } = CONFIG.inventory;
    for (let index = 0; index < hotbarSlots; index++) {
      const view = this.hotbar[index];
      if (view) {
        this.draw(view, this.inventory.slot(index));
        const selected = index === this.inventory.selected;
        view.frame.thickness = selected ? 2 : 1;
        view.frame.color = selected ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.25)";
      }
    }
    this.panelSlots.forEach((view, index) => {
      this.draw(view, this.inventory.slot(index));
      const selected = index === this.inventory.selected;
      view.frame.color = selected ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.25)";
    });
    this.draw(this.cursorView, this.cursor);
    this.cursorView.frame.isVisible = this.open && this.cursor !== undefined;

    // CF1-A: each recipe shows what it needs (what is missing in red) and whether it can be made.
    const busy = this.crafting.progress !== undefined;
    for (const row of this.recipeRows) {
      const icon = this.icons[row.recipe.item];
      row.icon.isVisible = icon !== undefined;
      if (icon && row.icon.source !== icon) {
        row.icon.source = icon;
      }
      row.recipe.cost.forEach(([item, need], index) => {
        const text = row.costs[index];
        if (text) {
          const have = this.inventory.count(item);
          text.text = `${ITEM_LABELS[item]} ${Math.min(have, need)}/${need}`;
          text.color = have >= need ? "rgba(255, 255, 255, 0.8)" : MISSING_COLOR;
        }
      });
      const ready = !busy && this.crafting.canMake(row.recipe);
      row.button.isEnabled = ready;
      row.button.alpha = ready ? 1 : 0.35;
    }
  }

  private draw(view: SlotView, stack: Stack | undefined): void {
    const source = stack ? this.icons[stack.item] : undefined;
    view.icon.isVisible = source !== undefined;
    if (source && view.icon.source !== source) {
      view.icon.source = source;
    }
    view.count.text = stack && stack.count > 1 ? String(stack.count) : "";
  }
}

/** CF1-A: the recipe column's width, and where its rows start and how far apart (pixels). */
const RECIPES_WIDTH = 350;
const RECIPE_TOP = 48;
const RECIPE_STEP = 58;

/** CF1-A: missing materials are shown in this red. */
const MISSING_COLOR = "#e0685c";

/** One recipe on screen: its icon, name, materials and the "Fazer" button. */
interface RecipeRow {
  recipe: Recipe;
  frame: Rectangle;
  icon: Image;
  costs: TextBlock[];
  button: Button;
}

function createRecipeRow(recipe: Recipe, index: number): RecipeRow {
  const frame = new Rectangle(`recipe${index}`);
  frame.width = `${RECIPES_WIDTH - 24}px`;
  frame.height = `${RECIPE_STEP - 4}px`;
  frame.top = `${RECIPE_TOP + index * RECIPE_STEP}px`;
  frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  frame.thickness = 0;
  frame.background = "rgba(255, 255, 255, 0.05)";
  frame.cornerRadius = 4;
  const icon = new Image(`recipe${index}Icon`);
  icon.width = "44px";
  icon.height = "44px";
  icon.left = "5px";
  icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  icon.stretch = Image.STRETCH_UNIFORM;
  icon.isVisible = false;
  frame.addControl(icon);
  const name = new TextBlock(
    `recipe${index}Name`,
    recipe.count > 1 ? `${ITEM_LABELS[recipe.item]} (${recipe.count})` : ITEM_LABELS[recipe.item],
  );
  name.color = "white";
  name.fontSize = 15;
  name.fontWeight = "bold";
  name.height = "20px";
  name.top = "6px";
  name.left = "56px";
  name.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  name.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  frame.addControl(name);
  const costs = new StackPanel(`recipe${index}Costs`);
  costs.isVertical = false;
  costs.height = "18px";
  costs.top = "28px";
  costs.left = "56px";
  costs.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  costs.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  frame.addControl(costs);
  const costTexts = recipe.cost.map((_, costIndex) => {
    const text = new TextBlock(`recipe${index}Cost${costIndex}`, "");
    text.fontSize = 12;
    text.resizeToFit = true;
    text.paddingRight = "8px";
    costs.addControl(text);
    return text;
  });
  const button = Button.CreateSimpleButton(`recipe${index}Make`, "Fazer");
  button.width = "58px";
  button.height = "28px";
  button.left = "-8px";
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.color = "white";
  button.fontSize = 13;
  button.background = "#3d4a35";
  button.cornerRadius = 4;
  button.thickness = 0;
  frame.addControl(button);
  return { recipe, frame, icon, costs: costTexts, button };
}

function createSlot(name: string): SlotView {
  const size = CONFIG.inventory.slotPx;
  const frame = new Rectangle(name);
  frame.width = `${size}px`;
  frame.height = `${size}px`;
  frame.thickness = 1;
  frame.color = "rgba(255, 255, 255, 0.25)";
  frame.background = "rgba(0, 0, 0, 0.35)";
  frame.cornerRadius = 4;
  const icon = new Image(`${name}Icon`);
  icon.width = `${size - 8}px`;
  icon.height = `${size - 8}px`;
  icon.stretch = Image.STRETCH_UNIFORM;
  icon.isVisible = false;
  frame.addControl(icon);
  const count = new TextBlock(`${name}Count`, "");
  count.color = "white";
  count.fontSize = 13;
  count.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  count.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  count.paddingRight = "4px";
  count.paddingBottom = "2px";
  count.shadowColor = "black";
  count.shadowBlur = 2;
  frame.addControl(count);
  return { frame, icon, count };
}
