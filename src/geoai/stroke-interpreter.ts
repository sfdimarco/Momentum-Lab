/**
 * stroke-interpreter.ts — The Rosetta Stone
 *
 * Converts physical canvas gestures → GEO quadtree paths → code constructs.
 *
 * This is the core translation layer of the Shared Canvas system.
 * When a student draws on the canvas, this module answers:
 *   "What geometry are they making?" → GEO loop family
 *   "What code does that geometry represent?" → code hint from library
 *   "Where on the quadtree does this live?" → GEO address for baby to eat
 *
 * The path IS the program. The gesture IS the code.
 *
 * Pillar 2: synesthetic feedback — the invisible math made tangible.
 */

import { quadrantToPixelRegion } from './parser';
import type { LibraryEntry, GEOFamily } from './parser';

// ═══════════════════════════════════════════════════════════════════════════
// PIXEL → QUADRANT MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a single pixel coordinate to a quadtree path at a given depth.
 * Returns the full address (e.g. ['TL', 'BR', 'TL']) for a point (x, y)
 * on a canvas of size (W, H) at the given quadtree depth.
 */
export function pixelToQuadrantPath(
  x: number,
  y: number,
  W: number,
  H: number,
  depth: number
): string[] {
  const path: string[] = [];
  let cx = 0, cy = 0, cw = W, ch = H;

  for (let d = 0; d < depth; d++) {
    const hw = cw / 2;
    const hh = ch / 2;
    const inLeft = x < cx + hw;
    const inTop  = y < cy + hh;

    if (inTop && inLeft)        { path.push('TL'); cw = hw; ch = hh; }
    else if (inTop && !inLeft)  { path.push('TR'); cx += hw; cw = hw; ch = hh; }
    else if (!inTop && inLeft)  { path.push('BL'); cy += hh; cw = hw; ch = hh; }
    else                        { path.push('BR'); cx += hw; cy += hh; cw = hw; ch = hh; }
  }

  return path;
}

/**
 * Convert a pixel coordinate to the top-level quadrant label (depth = 1).
 * Returns 'TL' | 'TR' | 'BL' | 'BR'.
 */
export function pixelToQuadrant(
  x: number,
  y: number,
  W: number,
  H: number
): string {
  const inLeft = x < W / 2;
  const inTop  = y < H / 2;
  if (inTop && inLeft)        return 'TL';
  if (inTop && !inLeft)       return 'TR';
  if (!inTop && inLeft)       return 'BL';
  return 'BR';
}

// ═══════════════════════════════════════════════════════════════════════════
// STROKE → GEO PATH
// Builds a deduplicated quadrant sequence from a stream of (x,y) points.
// Only appends when the quadrant CHANGES — so a stroke across TL→TR→BR
// becomes the path ['TL', 'TR', 'BR'] regardless of how many pixels crossed.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a GEO path from a sequence of canvas points.
 * Tracks quadrant changes at the given depth level.
 * Only records a step when the quadrant changes (transition detection).
 */
export function buildGEOPathFromPoints(
  points: Array<{ x: number; y: number }>,
  W: number,
  H: number,
  depth = 1
): string[] {
  if (points.length === 0) return [];

  const path: string[] = [];
  let lastQuadrant = '';

  for (const pt of points) {
    const q = pixelToQuadrant(pt.x, pt.y, W, H);
    if (q !== lastQuadrant) {
      path.push(q);
      lastQuadrant = q;
    }
  }

  return path;
}

// ═══════════════════════════════════════════════════════════════════════════
// GEO PATH → LOOP FAMILY INFERENCE
// Same algorithm as baby_agent — mirrored here so DrawCanvas can use it
// without importing the whole agent module.
// ═══════════════════════════════════════════════════════════════════════════

export function inferLoopFamily(path: string[]): GEOFamily {
  if (path.length === 0) return 'GATE_OFF';

  const unique = new Set(path);

  if (unique.size <= 1) return 'Y_LOOP';

  if (unique.size === 2) {
    const [a, b] = [...unique];
    const diagonal =
      (a === 'TL' && b === 'BR') || (a === 'BR' && b === 'TL') ||
      (a === 'TR' && b === 'BL') || (a === 'BL' && b === 'TR');
    return diagonal ? 'DIAG_LOOP' : 'X_LOOP';
  }

  if (unique.size === 3) return 'Z_LOOP';
  return 'GATE_ON';
}

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY MATCH — find best matching entry for the drawn path
// Uses Longest Common Subsequence (LCS) for fuzzy matching.
// ═══════════════════════════════════════════════════════════════════════════

/** LCS length between two string arrays */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Find the best matching LibraryEntry for the drawn path.
 * Returns null if no library entries exist.
 * "Best" = highest LCS similarity to the drawn path.
 */
export function findLibraryMatch(
  drawnPath: string[],
  libraryCache: LibraryEntry[]
): { entry: LibraryEntry; similarity: number } | null {
  if (libraryCache.length === 0 || drawnPath.length === 0) return null;

  let best: LibraryEntry | null = null;
  let bestScore = -1;

  for (const entry of libraryCache) {
    const lcs = lcsLength(drawnPath, entry.address);
    const maxLen = Math.max(drawnPath.length, entry.address.length);
    const similarity = maxLen > 0 ? lcs / maxLen : 0;

    if (similarity > bestScore) {
      bestScore = similarity;
      best = entry;
    }
  }

  return best ? { entry: best, similarity: bestScore } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNESTHETIC BRUSH COLORS
// The quadrant the student draws in determines the brush color.
// Mook's system: TL=red, TR=blue, BL=yellow, BR=green
// Family colors layer on top for the draw-back layer.
// ═══════════════════════════════════════════════════════════════════════════

export const QUADRANT_COLORS: Record<string, { r: number; g: number; b: number }> = {
  TL: { r: 239, g: 68,  b: 68  },  // red
  TR: { r: 59,  g: 130, b: 246 },  // blue
  BL: { r: 234, g: 179, b: 8   },  // yellow
  BR: { r: 34,  g: 197, b: 94  },  // green
};

export const FAMILY_COLORS: Record<GEOFamily, { r: number; g: number; b: number }> = {
  Y_LOOP:    { r: 234, g: 179, b: 8   }, // gold
  X_LOOP:    { r: 59,  g: 130, b: 246 }, // blue
  Z_LOOP:    { r: 34,  g: 197, b: 94  }, // green
  DIAG_LOOP: { r: 168, g: 85,  b: 247 }, // purple
  GATE_ON:   { r: 226, g: 232, b: 240 }, // slate
  GATE_OFF:  { r: 71,  g: 85,  b: 105 }, // grey
};

export const FAMILY_LABELS: Record<GEOFamily, string> = {
  Y_LOOP:    '➡️ Y-LOOP',
  X_LOOP:    '↔️ X-LOOP',
  Z_LOOP:    '🔄 Z-LOOP',
  DIAG_LOOP: '↗️ DIAG',
  GATE_ON:   '⬛ GATE-ON',
  GATE_OFF:  '⬜ GATE-OFF',
};

// ═══════════════════════════════════════════════════════════════════════════
// STROKE RESULT — full interpretation of a completed stroke
// ═══════════════════════════════════════════════════════════════════════════

export interface StrokeResult {
  path: string[];                           // GEO quadrant sequence
  family: GEOFamily;                        // inferred loop type
  match: { entry: LibraryEntry; similarity: number } | null;  // library lookup
  codeHint: string | null;                  // code string to show
  ts: number;                               // timestamp
}

/**
 * Interpret a completed stroke and return the full GEO + code result.
 */
export function interpretStroke(
  points: Array<{ x: number; y: number }>,
  W: number,
  H: number,
  libraryCache: LibraryEntry[],
  depth = 1
): StrokeResult {
  const path = buildGEOPathFromPoints(points, W, H, depth);
  const family = inferLoopFamily(path);
  const match = findLibraryMatch(path, libraryCache);

  return {
    path,
    family,
    match,
    codeHint: match?.entry.codeHint ?? null,
    ts: Date.now(),
  };
}
