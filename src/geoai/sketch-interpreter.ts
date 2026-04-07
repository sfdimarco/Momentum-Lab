// ═══════════════════════════════════════════════════════════════════════════
//  sketch-interpreter.ts — Image → GEO Pipeline
//
//  The human draws in a notebook. Takes a photo. Uploads it.
//  Gemini Vision reads the gesture and returns a GEO path.
//  That path enters baby's cognitive loop via injectPattern().
//
//  The LLM is the BRIDGE between:
//    human visual (imprecise, organic, gestural)
//    → GEO syntax (precise, recursive, quadrant-addressed)
//
//  When the human's drawing aligns with baby's library:
//    the baby RECOGNIZES it → emits the code hint → the geometry IS the code.
//
//  This is gestural programming. You draw it. Baby codes it.
// ═══════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import type { GEOFamily } from './parser';

// ── Singleton Gemini client (same fix as TutorAssistant — never new per call) ─
const _ai = typeof process !== 'undefined' && process.env?.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ── GEO Interpretation Result ─────────────────────────────────────────────

export interface SketchGEOResult {
  /** The interpreted GEO quadrant path */
  path: string[];
  /** Inferred GEO loop family */
  family: GEOFamily;
  /** Confidence in interpretation (0–1) */
  confidence: number;
  /** Human-readable description of what the AI saw */
  description: string;
  /** Whether a library match was found */
  libraryMatch: boolean;
  /** The matched library entry's code hint (if any) */
  codeHint: string | null;
  /** The matched library entry ID (if any) */
  matchedEntryId: string | null;
}

// ── The Vision Prompt ─────────────────────────────────────────────────────
// The prompt that teaches Gemini to think in GEO spatial quadrant language.
// It maps the image's dominant visual gesture onto the quadtree grid.

const GEO_VISION_PROMPT = `
You are a spatial gesture interpreter for a quadtree-based programming system called GEO.

The canvas is divided into 4 quadrants:
  TL = top-left    (like the number 1 — RED)
  TR = top-right   (like the number 2 — BLUE)
  BL = bottom-left (like the number 3 — YELLOW)
  BR = bottom-right (like the number 4 — GREEN)

GEO loop families (what a spatial gesture MEANS as code):
  Y_LOOP    → 1 unique quadrant repeating  → print / linear flow / assignment
  X_LOOP    → 2 adjacent quadrants (TB or LR neighbor) → if/else / conditional branch
  DIAG_LOOP → 2 diagonal quadrants (TL↔BR or TR↔BL)  → recursion / callback / ping-pong
  Z_LOOP    → 3 unique quadrants (sweep)  → for loop / while / iteration
  GATE_ON   → all 4 quadrants             → function definition / full system

Look at the image and identify:
1. The dominant SPATIAL GESTURE — where does the visual energy start and where does it flow?
2. Map the gesture as a sequence of quadrant labels (TL, TR, BL, BR)
3. Keep the path length 2–6 (longer paths = deeper/finer quadtree address)
4. Infer the loop family from the quadrant uniqueness pattern

Return ONLY valid JSON (no markdown, no explanation):
{
  "path": ["TL", "TR", "BL"],
  "family": "Z_LOOP",
  "confidence": 0.8,
  "description": "Three-point sweep from upper-left through upper-right down to lower-left — classic Z_LOOP iteration gesture"
}
`.trim();

// ── Main Interpreter Function ─────────────────────────────────────────────

/**
 * Interpret a sketch image as a GEO path using Gemini Vision.
 *
 * @param imageBase64  Base64-encoded image (without data: prefix)
 * @param mimeType     Image MIME type (default: image/jpeg)
 * @param libraryCache Optional library entries to check for match
 *
 * @returns SketchGEOResult — the interpreted path, family, and any library match
 */
export async function sketchToGEO(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  libraryCache: Array<{ id: string; address: string[]; loopFamily: string; codeHint: string | null }> = []
): Promise<SketchGEOResult> {

  // ── Fallback if Gemini not available ────────────────────────────────────
  if (!_ai) {
    console.warn('[sketch-interpreter] No Gemini API key — using fallback interpretation');
    return _fallbackInterpretation();
  }

  try {
    const response = await _ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            }
          },
          { text: GEO_VISION_PROMPT }
        ]
      }],
      config: {
        temperature: 0.3,  // Lower temp = more deterministic spatial parsing
      }
    });

    const raw = response.text?.trim() ?? '';
    const parsed = _parseGEOJson(raw);
    if (!parsed) {
      console.warn('[sketch-interpreter] Could not parse Gemini response:', raw);
      return _fallbackInterpretation();
    }

    // ── Check library match ──────────────────────────────────────────────
    const match = _findLibraryMatch(parsed.path, libraryCache);

    return {
      path: parsed.path,
      family: parsed.family as GEOFamily,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      description: parsed.description ?? '',
      libraryMatch: !!match,
      codeHint: match?.codeHint ?? null,
      matchedEntryId: match?.id ?? null,
    };

  } catch (err) {
    console.error('[sketch-interpreter] Gemini vision error:', err);
    return _fallbackInterpretation();
  }
}

// ── LCS-based library match ───────────────────────────────────────────────

function _lcsLength(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[m][n];
}

function _findLibraryMatch(
  path: string[],
  library: Array<{ id: string; address: string[]; loopFamily: string; codeHint: string | null }>
): { id: string; codeHint: string | null } | null {
  if (library.length === 0) return null;

  let best: { id: string; codeHint: string | null } | null = null;
  let bestScore = 0.6; // minimum threshold to count as a match

  for (const entry of library) {
    const lcs = _lcsLength(path, entry.address);
    const maxLen = Math.max(path.length, entry.address.length, 1);
    const similarity = lcs / maxLen;
    if (similarity > bestScore) {
      bestScore = similarity;
      best = { id: entry.id, codeHint: entry.codeHint };
    }
  }

  return best;
}

// ── JSON Parser (robust — handles Gemini wrapping the JSON in markdown) ───

function _parseGEOJson(raw: string): {
  path: string[]; family: string; confidence: number; description: string;
} | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);

    // Validate required fields
    if (!Array.isArray(data.path) || data.path.length === 0) return null;
    if (!data.family) return null;

    // Validate path entries
    const validDirs = new Set(['TL', 'TR', 'BL', 'BR']);
    const cleanPath = data.path.filter((d: unknown) => typeof d === 'string' && validDirs.has(d));
    if (cleanPath.length === 0) return null;

    return {
      path: cleanPath,
      family: data.family,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      description: data.description ?? '',
    };
  } catch {
    return null;
  }
}

// ── Fallback (no Gemini) ──────────────────────────────────────────────────
// Returns a sensible default — diagonal Z_LOOP gesture.
// This keeps the UI working even without an API key.

function _fallbackInterpretation(): SketchGEOResult {
  return {
    path: ['TR', 'TL', 'BL'],
    family: 'Z_LOOP',
    confidence: 0.4,
    description: 'Fallback interpretation — Gemini not available. Z_LOOP assumed.',
    libraryMatch: false,
    codeHint: null,
    matchedEntryId: null,
  };
}

// ── File → Base64 helper ──────────────────────────────────────────────────

/**
 * Convert a File (from <input type="file"> or drag-drop) to base64.
 * Used by the Upload Sketch UI.
 */
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl = "data:image/jpeg;base64,/9j/4AA..."
      const [meta, base64] = dataUrl.split(',');
      const mimeType = meta.match(/data:([^;]+);/)?.[1] ?? 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
