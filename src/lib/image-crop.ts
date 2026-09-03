/**
 * Pure math for the avatar cropper (src/components/settings/AvatarUploadForm.tsx)
 * --- kept separate from the DOM/canvas plumbing so it's actually
 * testable (jsdom can't decode real images or render a canvas).
 */

/** "object-fit: cover" scale --- the smallest scale that still fills the (square) container on both axes. */
export function coverScale(naturalWidth: number, naturalHeight: number, containerSize: number): number {
  return Math.max(containerSize / naturalWidth, containerSize / naturalHeight);
}

/**
 * Keeps a displayed-image offset (its CSS `left`/`top`, in px, relative
 * to the container) from ever revealing empty space beyond the image's
 * edges --- the image is always at least as big as the container
 * (v. coverScale), so the valid range is [container - displayedSize, 0].
 */
export function clampOffset(offset: number, displayedSize: number, containerSize: number): number {
  const min = containerSize - displayedSize;
  return Math.min(0, Math.max(min, offset));
}

/**
 * Translates what's currently visible in the crop viewport (a CSS-px
 * offset + displayed size, relative to the container) back into the
 * source image's own natural-pixel coordinates --- the rectangle to
 * hand to CanvasRenderingContext2D.drawImage() when producing the final
 * square export.
 */
export function computeCropRect({
  naturalWidth,
  containerSize,
  offsetLeft,
  offsetTop,
  displayedWidth,
}: {
  naturalWidth: number;
  containerSize: number;
  offsetLeft: number;
  offsetTop: number;
  displayedWidth: number;
}): { sx: number; sy: number; sSize: number } {
  const scaleFactor = displayedWidth / naturalWidth;
  return {
    sx: -offsetLeft / scaleFactor,
    sy: -offsetTop / scaleFactor,
    sSize: containerSize / scaleFactor,
  };
}
