/**
 * Keyboard and mouse state for the game. Keys are read by physical position (`event.code`, e.g.
 * "KeyW"), so WASD works on any keyboard layout. Mouse look only works while the pointer is locked
 * to the canvas (click on the game to lock; Esc releases it).
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private readonly canvas: HTMLCanvasElement;
  private lockEnabled = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault(); // Space would otherwise scroll the page.
      }
      if (!this.down.has(event.code)) {
        this.pressedThisFrame.add(event.code);
      }
      this.down.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.down.delete(event.code);
    });
    // Releasing every key when the window loses focus avoids "stuck" keys after alt-tab.
    window.addEventListener("blur", () => {
      this.down.clear();
    });

    canvas.addEventListener("click", () => {
      if (this.pointerLockEnabled && !this.isPointerLocked) {
        // Browsers may refuse, e.g. right after the mouse was released: one more click works.
        canvas.requestPointerLock().catch(() => undefined);
      }
    });
    // Mouse buttons count as keys named "Mouse0" (left), "Mouse1" (middle) and "Mouse2" (right),
    // only while the mouse is captured: the click that captures it is not an attack.
    document.addEventListener("mousedown", (event) => {
      if (!this.isPointerLocked) {
        return;
      }
      const code = `Mouse${event.button}`;
      if (!this.down.has(code)) {
        this.pressedThisFrame.add(code);
      }
      this.down.add(code);
    });
    document.addEventListener("mouseup", (event) => {
      this.down.delete(`Mouse${event.button}`);
    });
    document.addEventListener("mousemove", (event) => {
      if (this.isPointerLocked) {
        this.mouseX += event.movementX;
        this.mouseY += event.movementY;
      }
    });
  }

  /**
   * Whether clicking the game captures the mouse. Off on screens that need the mouse pointer
   * (the death screen, VD4).
   */
  get pointerLockEnabled(): boolean {
    return this.lockEnabled;
  }

  set pointerLockEnabled(enabled: boolean) {
    this.lockEnabled = enabled;
    if (!enabled && this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** True while the key is held. */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** Mouse movement since the last call, in pixels. */
  consumeMouseMovement(): { x: number; y: number } {
    const movement = { x: this.mouseX, y: this.mouseY };
    this.mouseX = 0;
    this.mouseY = 0;
    return movement;
  }

  /** Call once at the end of every frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
