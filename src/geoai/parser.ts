/**
 * parser.ts — GEOAI Runtime Brain Parser
 * 
 * Parses baby_genesis.geoai into a RuntimeBrain struct.
 * Creates a fresh baby_0 instance with proper spatial typing.
 * 
 * This is NOT a full .geoai parser.
 * Instead, we implement BIRTH_STATE values from the spec as TypeScript constants.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A position in the quadtree — the universal address format.
 * The path describes the journey from root through the tree.
 */
export interface QuadrantAddress {
  depth: number;
  path: ('TL' | 'TR' | 'BL' | 'BR')[];
  maskSequence?: number[];  // optional GEO mask sequence
}

/**
 * A pattern discovered by the baby brain.
 * Patterns are spatial signatures — the address IS the meaning.
 */
export interface SpatialPattern {
  id: string;
  geoAddress: QuadrantAddress;        // WHERE in the quadtree this pattern lives
  actionSequence: QuadrantAddress[];  // spatial inputs that led to reward
  visualSignature: number[];          // pixel delta signature
  confidence: number;                 // 0.0 – 1.0
  discoveredAtAge: number;
  lastFiredAt: number;                // tick
}

/**
 * Pattern cache — indexed by address string key.
 */
export type PatternCache = Map<string, SpatialPattern>;

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY TYPES — Phase A: Sisyphus & Librarian Protocol
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GEO loop family — inferred from the spatial trajectory of a cached pattern.
 * The shape of the path IS the type of code construct it maps to.
 *
 *  Y_LOOP    → 1 unique quadrant (rotating)   → print / assignment (linear)
 *  X_LOOP    → 2 adjacent quadrants            → if / else (conditional)
 *  DIAG_LOOP → 2 diagonal quadrants            → recursion / callback
 *  Z_LOOP    → 3 unique quadrants (sweep)      → for / while (loop)
 *  GATE_ON   → all 4 quadrants                 → function definition
 *  GATE_OFF  → empty / no movement             → null / empty state
 */
export type GEOFamily =
  | 'Y_LOOP'
  | 'X_LOOP'
  | 'Z_LOOP'
  | 'DIAG_LOOP'
  | 'GATE_ON'
  | 'GATE_OFF';

/**
 * A LibraryEntry is a SpatialPattern that has crossed the CYAN STATE threshold
 * (confidence ≥ 0.9). The Librarian's permanent archive — patterns it has "understood".
 *
 * The Librarian never pushes. It remembers how the rock was pushed.
 */
export interface LibraryEntry {
  id: string;                 // address path joined: "TL→TR→BR→TL"
  address: string[];          // GEO quadtree path e.g. ["TL","TR","BR","TL"]
  depth: number;              // quadtree depth of the pattern
  confidence: number;         // ≥ 0.9 at promotion, continues strengthening
  promotedAt: number;         // brain tick when first promoted
  deltaSignature: number;     // avg pixel delta that earned promotion (the stone's weight)
  loopFamily: GEOFamily;      // inferred from spatial trajectory
  codeHint: string | null;    // Phase B: mapped code template (null until filled)
  visitCount: number;         // how many times Sisyphus has been near this pattern
  cyanFlashFired: boolean;    // has SpatialEye already rendered the promotion flash?
}

/**
 * RuntimeBrain — the living state of baby_0.
 * This struct holds all mutable and immutable state during execution.
 */
export interface RuntimeBrain {
  // Identity (from BIRTH_STATE)
  name: string;                // 'baby_0'
  version: string;             // '0.1.0'
  
  // Birth state (from BIRTH_STATE block in spec)
  knowledge: PatternCache;
  energy: number;              // 0.0 – 1.0, starts at 1.0
  curiosity: 'MAX' | 'HIGH' | 'MED' | 'LOW' | 'MIN';  // starts at MAX
  frustration: number;         // 0+, starts at 0
  age: number;                 // count of pattern discoveries, starts at 0
  patternCache: SpatialPattern[];
  visualResolution: number;    // 2 = 2x2 grid (4 quadrants at birth), grows with age
  confidenceThreshold: number; // 0.7 by spec
  
  // Runtime state (added by runtime, not in spec)
  currentFocus: QuadrantAddress | null;              // currently attending quadrant
  visitCounts: Map<string, number>;                  // how many times each quadrant visited
  lastReward: { location: QuadrantAddress; value: number; tick: number } | null;
  tick: number;                                      // runtime tick counter
  isResting: boolean;                                // resting mode (energy depletion)

  // Phase A: Sisyphus & Librarian — Cyan State archive
  libraryCache: LibraryEntry[];                      // patterns promoted at confidence ≥ 0.9
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY: Create a fresh baby_0 brain from the spec
// ═══════════════════════════════════════════════════════════════════════════

export function createBabyBrain(): RuntimeBrain {
  return {
    // Identity
    name: 'baby_0',
    version: '0.1.0',
    
    // Birth state from BIRTH_STATE block
    knowledge: new Map(),
    energy: 1.0,                    // "energy: 1.0"
    curiosity: 'MAX',               // "curiosity: MAX"
    frustration: 0,                 // "frustration: 0"
    age: 0,                         // "age: 0"
    patternCache: [],               // "pattern_cache: []"
    visualResolution: 2,            // "visual_resolution: 2" (2x2 = 4 quadrants at birth)
    confidenceThreshold: 0.7,       // "confidence_threshold: 0.7"
    
    // Runtime state
    currentFocus: null,
    visitCounts: new Map(),
    lastReward: null,
    tick: 0,
    isResting: false,

    // Phase A: Sisyphus & Librarian — starts empty, fills as baby understands
    libraryCache: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: QuadrantAddress helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a QuadrantAddress to a string key for use in maps/sets.
 * Format: "d{depth}_{path-components-joined-by-dash}"
 */
export function addressToKey(addr: QuadrantAddress): string {
  return `d${addr.depth}_${addr.path.join('-')}`;
}

/**
 * Get all quadrant addresses at a given resolution depth.
 * Depth 1: 4 quadrants (TL, TR, BL, BR)
 * Depth 2: 16 quadrants (children of each depth-1 quadrant)
 * Depth N: 4^N quadrants
 */
export function getQuadrantsAtDepth(depth: number): QuadrantAddress[] {
  if (depth < 1) return [];
  
  if (depth === 1) {
    return [
      { depth: 1, path: ['TL'] },
      { depth: 1, path: ['TR'] },
      { depth: 1, path: ['BL'] },
      { depth: 1, path: ['BR'] },
    ];
  }
  
  const parents = getQuadrantsAtDepth(depth - 1);
  const result: QuadrantAddress[] = [];
  
  for (const parent of parents) {
    for (const child of ['TL', 'TR', 'BL', 'BR'] as const) {
      result.push({
        depth,
        path: [...parent.path, child],
      });
    }
  }
  
  return result;
}

/**
 * Get the pixel region (bounding box) for a quadrant address.
 * Maps spatial address to screen coordinates.
 * Used by the agent to know which pixels to read.
 */
export function quadrantToPixelRegion(
  addr: QuadrantAddress,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; w: number; h: number } {
  let x = 0, y = 0, w = canvasWidth, h = canvasHeight;
  
  for (const step of addr.path) {
    const hw = w / 2;
    const hh = h / 2;
    
    if (step === 'TL') {
      // Top-left: x, y stay, width and height halve
      w = hw;
      h = hh;
    } else if (step === 'TR') {
      // Top-right: x moves right by half-width
      x += hw;
      w = hw;
      h = hh;
    } else if (step === 'BL') {
      // Bottom-left: y moves down by half-height
      y += hh;
      w = hw;
      h = hh;
    } else if (step === 'BR') {
      // Bottom-right: both x and y move
      x += hw;
      y += hh;
      w = hw;
      h = hh;
    }
  }
  
  return { x, y, w, h };
}

/**
 * Check if one address is adjacent to another at the same depth.
 * Adjacent = same parent, different child position.
 */
export function isAdjacentAddress(a: QuadrantAddress, b: QuadrantAddress): boolean {
  if (a.depth !== b.depth || a.path.length !== b.path.length) return false;
  
  // Both at root depth are never adjacent (only 4 options and they're not adjacent)
  if (a.path.length === 1) {
    // Adjacent pairs at depth 1:
    // TL-TR, TL-BL, TR-BR, BL-BR
    const p1 = a.path[0];
    const p2 = b.path[0];
    return (
      (p1 === 'TL' && (p2 === 'TR' || p2 === 'BL')) ||
      (p1 === 'TR' && (p2 === 'TL' || p2 === 'BR')) ||
      (p1 === 'BL' && (p2 === 'TL' || p2 === 'BR')) ||
      (p1 === 'BR' && (p2 === 'TR' || p2 === 'BL'))
    );
  }
  
  // For deeper quadrants: check if last segment differs but parents are same
  const aParent = a.path.slice(0, -1).join('-');
  const bParent = b.path.slice(0, -1).join('-');
  const aLast = a.path[a.path.length - 1];
  const bLast = b.path[b.path.length - 1];
  
  if (aParent !== bParent) return false;
  
  // Check if the leaf segments are adjacent to each other
  return (
    (aLast === 'TL' && (bLast === 'TR' || bLast === 'BL')) ||
    (aLast === 'TR' && (bLast === 'TL' || bLast === 'BR')) ||
    (aLast === 'BL' && (bLast === 'TL' || bLast === 'BR')) ||
    (aLast === 'BR' && (bLast === 'TR' || bLast === 'BL'))
  );
}

/**
 * Get all quadrants adjacent to a given address at the same depth.
 */
export function getAdjacentQuadrants(
  addr: QuadrantAddress,
  allQuadrants: QuadrantAddress[]
): QuadrantAddress[] {
  return allQuadrants.filter(q => isAdjacentAddress(addr, q));
}

/**
 * Get the parent quadrant address (one level shallower in the tree).
 * Root (depth 1) has no parent.
 */
export function getParentAddress(addr: QuadrantAddress): QuadrantAddress | null {
  if (addr.depth <= 1) return null;
  return {
    depth: addr.depth - 1,
    path: addr.path.slice(0, -1),
  };
}
