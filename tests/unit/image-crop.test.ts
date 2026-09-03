import { describe, expect, it } from "vitest";
import { clampOffset, computeCropRect, coverScale } from "@/lib/image-crop";

describe("coverScale", () => {
  it("scales up a landscape image just enough to fill the container's height", () => {
    // 400x200 into a 200x200 container: height is the binding constraint (x1), width overshoots (x0.5).
    expect(coverScale(400, 200, 200)).toBe(1);
  });

  it("scales up a portrait image just enough to fill the container's width", () => {
    expect(coverScale(200, 400, 200)).toBe(1);
  });

  it("scales down a larger square image to exactly fill the container", () => {
    expect(coverScale(1000, 1000, 200)).toBe(0.2);
  });
});

describe("clampOffset", () => {
  it("clamps a positive offset (dragged past the top/left edge) back to 0", () => {
    expect(clampOffset(50, 300, 200)).toBe(0);
  });

  it("clamps a negative offset (dragged past the bottom/right edge) to -(displayedSize - containerSize)", () => {
    expect(clampOffset(-150, 300, 200)).toBe(-100);
  });

  it("leaves an in-range offset untouched", () => {
    expect(clampOffset(-30, 300, 200)).toBe(-30);
  });

  it("has no room to move when the image exactly fills the container", () => {
    expect(clampOffset(10, 200, 200)).toBe(0);
    expect(clampOffset(-10, 200, 200)).toBe(0);
  });
});

describe("computeCropRect", () => {
  it("maps a centered, unpanned image back to the natural-pixel crop matching the container", () => {
    // 1000x1000 natural image, displayed at 200x200 (scaleFactor 0.2) with no offset.
    const rect = computeCropRect({
      naturalWidth: 1000,
      containerSize: 200,
      offsetLeft: 0,
      offsetTop: 0,
      displayedWidth: 200,
    });
    // -0 === 0 numerically (from -offsetLeft/scaleFactor with offsetLeft 0), but toEqual is strict about the sign bit.
    expect(rect.sx).toBe(-0);
    expect(rect.sy).toBe(-0);
    expect(rect.sSize).toBe(1000);
  });

  it("converts a panned offset into natural-pixel source coordinates", () => {
    // Same 5x downscale; panned 20 displayed px left and 10 up.
    const rect = computeCropRect({
      naturalWidth: 1000,
      containerSize: 200,
      offsetLeft: -20,
      offsetTop: -10,
      displayedWidth: 200,
    });
    expect(rect).toEqual({ sx: 100, sy: 50, sSize: 1000 });
  });

  it("shrinks the source crop size as the image is zoomed in", () => {
    // Zoomed to double size (400 displayed instead of 200): scaleFactor 0.4, so the crop covers less of the source.
    const rect = computeCropRect({
      naturalWidth: 1000,
      containerSize: 200,
      offsetLeft: 0,
      offsetTop: 0,
      displayedWidth: 400,
    });
    expect(rect.sSize).toBe(500);
  });
});
