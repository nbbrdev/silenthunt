import { describe, expect, it } from "vitest";
import { formatFps } from "../../src/ui/fpsCounter";

describe("formatFps", () => {
  it("rounds to the nearest whole frame", () => {
    expect(formatFps(59.7)).toBe("60 FPS");
    expect(formatFps(30.2)).toBe("30 FPS");
  });

  it("shows a placeholder for invalid values", () => {
    expect(formatFps(Number.NaN)).toBe("-- FPS");
    expect(formatFps(Number.POSITIVE_INFINITY)).toBe("-- FPS");
    expect(formatFps(-1)).toBe("-- FPS");
  });
});
