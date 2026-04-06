// ═══════════════════════════════════════════════════════════════════════════
//  PATTERN LENS — The Student-Facing View of the AI's Mind
//
//  Utilities for converting abstract quadtree addresses into VISIBLE things
//  a 4th grader can actually see and wonder about.
//
//  This is the bidirectional loop:
//    AI finds interesting region → we show kid EXACTLY where on their canvas
//    Kid sees it → gets curious → codes something new there → AI finds more
//
//  These functions are the bridge between GEO quadtree grammar and pixels.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Given a GEO quadtree path, compute the pixel bounds of that region.
 *
 * Example: path=['TL','BR','TL'] on a 400x400 canvas
 *   → TL: x=0, y=0, w=200, h=200
 *   → BR: x=100, y=100, w=100, h=100
 *   → TL: x=100, y=100, w=50, h=50
 *   → { x: 100, y: 100, w: 50, h: 50 }
 */
export function getQuadrantBounds(
  path: string[],
  canvasW: number,
  canvasH: number
): { x: number; y: number; w: number; h: number } {
  let x = 0, y = 0, w = canvasW, h = canvasH;

  for (const dir of path) {
    const hw = w / 2;
    const hh = h / 2;
    if (dir === 'TR' || dir === '1') {
      x += hw;
    } else if (dir === 'BR' || dir === '2') {
      x += hw;
      y += hh;
    } else if (dir === 'BL' || dir === '3') {
      y += hh;
    }
    // TL / '0': x, y unchanged
    w = hw;
    h = hh;
  }

  return { x, y, w, h };
}

/**
 * Snapshot a specific quadrant from a live canvas into a thumbnail data URL.
 *
 * Draws the region into an offscreen 72×72 canvas and returns a JPEG URL.
 * Returns null if the source canvas is unavailable or tainted.
 *
 * @param canvas  The source canvas to snapshot (p5 game canvas or shadow canvas)
 * @param path    GEO quadtree path array e.g. ['TL','BR','TL']
 * @param thumbSize  Output thumbnail size in pixels (default 72)
 */
export function captureQuadrantThumb(
  canvas: HTMLCanvasElement,
  path: string[],
  thumbSize = 72
): string | null {
  try {
    const bounds = getQuadrantBounds(path, canvas.width, canvas.height);
    if (bounds.w < 1 || bounds.h < 1) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = thumbSize;
    offscreen.height = thumbSize;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Scale the region up to fill the thumbnail
    ctx.drawImage(
      canvas,
      bounds.x, bounds.y, bounds.w, bounds.h,
      0, 0, thumbSize, thumbSize
    );

    return offscreen.toDataURL('image/jpeg', 0.85);
  } catch {
    // Canvas may be tainted (cross-origin) or unavailable — fail silently
    return null;
  }
}

/**
 * Compute the CENTER point of a quadrant's bounding box.
 * Used for drawing connecting lines, focus rings, etc.
 */
export function getQuadrantCenter(
  path: string[],
  canvasW: number,
  canvasH: number
): { cx: number; cy: number } {
  const b = getQuadrantBounds(path, canvasW, canvasH);
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

/**
 * Return a CSS-friendly border-radius for a quadrant depth.
 * Deep quadrants (tiny) get slightly more rounding for readability.
 */
export function getQuadrantBorderRadius(depth: number): string {
  if (depth <= 2) return '4px';
  if (depth <= 4) return '6px';
  return '8px';
}
