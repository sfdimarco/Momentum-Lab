/**
 * baby_agent.ts — The Exploration Loop
 * 
 * Implements the curiosity engine, reward detection, and pattern caching.
 * Runs at 2 ticks/second (500ms), not on requestAnimationFrame.
 * 
 * Key behaviors from baby_genesis.geoai:
 * - CURIOSITY: scan_by_salience, explore_unexplored, follow_reward_gradient, random_leap
 * - REWARD: TIER_1-4 canvas deltas, BONUS pattern match
 * - FRUSTRATION: accumulate, reset on reward, execute rules at thresholds
 * - ENERGY: replenish on reward, deplete over time, rest at zero
 * - AGE & GROWTH: +1 per pattern, resolution grows every 5 patterns (up to 8 max)
 */

import {
  RuntimeBrain,
  SpatialPattern,
  QuadrantAddress,
  PatternCache,
  LibraryEntry,
  GEOFamily,
  createBabyBrain,
  addressToKey,
  getQuadrantsAtDepth,
  quadrantToPixelRegion,
  getAdjacentQuadrants,
} from './parser';

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type BabyAgentEvent =
  | { type: 'focus_changed'; quadrant: QuadrantAddress }
  | { type: 'reward_fired'; quadrant: QuadrantAddress; value: number; tier: string }
  | { type: 'pattern_cached'; pattern: SpatialPattern }
  | { type: 'pattern_reinforced'; pattern: SpatialPattern; prevConfidence: number }
  | { type: 'cyan_promoted'; entry: LibraryEntry }   // 🩵 Phase A: Cyan State — Aha! moment
  | { type: 'hint_evolved'; entry: LibraryEntry; prevHint: string | null; tier: 'apprentice' | 'journeyman' | 'master' }  // 📗 Phase B: code hint matures
  | { type: 'guide_available'; fromPath: string[]; toEntry: LibraryEntry; similarity: number }  // 🧭 Phase C: Guide Mode — the Librarian draws a path
  | { type: 'frustration_update'; level: number }
  | { type: 'resolution_gained'; newResolution: number }
  | { type: 'energy_update'; level: number }
  | { type: 'rest_start' }
  | { type: 'rest_end' };

export type BabyAgentListener = (event: BabyAgentEvent) => void;

// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONFIGURATION
// Each baby is a different personality — same curiosity engine, different soul.
// ═══════════════════════════════════════════════════════════════════════════

export interface BabyConfig {
  name: string;                  // log prefix + UI label
  tickRateMs: number;            // calm exploration pace
  wildTickRateMs: number;        // wild mode pace
  shadowSyncMs: number;          // shadow canvas mirror interval
  frustrationTicks: number;      // ticks without reward before frustration++
  maxResolution: number;         // max quadtree depth (8 = 256×256 regions)
  minRewardForCache: number;     // minimum reward to cache a pattern
  exploreChance: number;         // base probability of exploring unexplored quadrant
  leapChance: number;            // base probability of random leap
  growthInterval: number;        // patterns between resolution gains (normal)
  wildGrowthInterval: number;    // patterns between resolution gains (wild)
  storageKey: string;            // localStorage persistence key
  shadowId: string;              // DOM id of the shadow canvas element
  energyDepletionRate: number;   // energy lost per tick
  energyRewardBonus: number;     // energy gained per reward
  wildPaintBlockSize: number;    // pixel block size for wild mode shadow paint
}

/** baby_0 — the original: curious, deliberate, conservative cacher */
export const BABY_0_CONFIG: BabyConfig = {
  name: 'baby_0',
  tickRateMs: 500,
  wildTickRateMs: 80,
  shadowSyncMs: 60,
  frustrationTicks: 6,
  maxResolution: 8,
  minRewardForCache: 0.3,
  exploreChance: 0.60,
  leapChance: 0.05,
  growthInterval: 5,
  wildGrowthInterval: 2,
  storageKey: 'baby_0_brain_v1',
  shadowId: '__baby0_shadow__',
  energyDepletionRate: 0.001,
  energyRewardBonus: 0.05,
  wildPaintBlockSize: 20,
};

/**
 * baby_1 — The Divergent: wider net, faster explorer, more restless.
 * Caches TIER_3+ rewards (minRewardForCache=0.1) so its pattern map is DENSE.
 * Quick to abandon a region (frustrationTicks=3).
 * Strongly prefers unexplored territory (exploreChance=0.85).
 * Smaller paint blocks → more varied pixel food → richer reward signal.
 */
export const BABY_1_CONFIG: BabyConfig = {
  name: 'baby_1',
  tickRateMs: 500,
  wildTickRateMs: 80,
  shadowSyncMs: 60,
  frustrationTicks: 3,           // twice as impatient as baby_0
  maxResolution: 8,
  minRewardForCache: 0.1,        // caches TIER_3+ — much denser pattern map
  exploreChance: 0.85,           // strongly prefers unexplored territory
  leapChance: 0.15,              // 3× more random leaps
  growthInterval: 3,             // grows faster in normal mode
  wildGrowthInterval: 1,         // fastest possible growth in wild mode
  storageKey: 'baby_1_brain_v1',
  shadowId: '__baby1_shadow__',
  energyDepletionRate: 0.0005,   // slower drain — more stamina
  energyRewardBonus: 0.08,       // bigger energy boost from rewards
  wildPaintBlockSize: 10,        // smaller blocks = richer pixel variety
};

// ═══════════════════════════════════════════════════════════════════════════
// PHASE A — LOOP FAMILY INFERENCE
// The shape of a spatial path IS the type of code construct it maps to.
// Called once per pattern promotion — turns geometry into grammar.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Infer the GEO loop family from a quadtree path.
 *
 * Algorithm: count unique quadrants in the address path.
 *   0 or empty → GATE_OFF  (no movement — null state)
 *   1 unique   → Y_LOOP    (single quadrant rotating — linear flow)
 *   2 unique:
 *     adjacent (TL+TR, TR+BR, BR+BL, BL+TL) → X_LOOP (if/else branch)
 *     diagonal (TL+BR, TR+BL)               → DIAG_LOOP (recursion/callback)
 *   3 unique   → Z_LOOP    (three-quadrant sweep — loop construct)
 *   4 unique   → GATE_ON   (all quadrants — full function definition)
 */
function inferLoopFamily(path: string[]): GEOFamily {
  if (path.length === 0) return 'GATE_OFF';

  const unique = new Set(path);

  if (unique.size <= 1) return path.length === 0 ? 'GATE_OFF' : 'Y_LOOP';

  if (unique.size === 2) {
    const [a, b] = [...unique];
    const diagonal =
      (a === 'TL' && b === 'BR') || (a === 'BR' && b === 'TL') ||
      (a === 'TR' && b === 'BL') || (a === 'BL' && b === 'TR');
    return diagonal ? 'DIAG_LOOP' : 'X_LOOP';
  }

  if (unique.size === 3) return 'Z_LOOP';

  return 'GATE_ON'; // 4 unique quadrants — all occupied
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE B — CODE HINT SEED TABLE
// Maps GEO loop family + depth → a starter code string.
// These are SEEDED values — learned values will override as the Library grows.
// Geometry → Code. The path IS the program.
// ═══════════════════════════════════════════════════════════════════════════

const SEED_CODEHINTS: Record<GEOFamily, Record<number, string>> = {
  Y_LOOP: {
    2: 'print("Hello")',
    4: 'for (let i = 0; i < n; i++) { print(i) }',
    6: 'arr.forEach(x => print(x))',
  },
  X_LOOP: {
    2: 'if (condition) { doThis() } else { doThat() }',
    4: 'while (x > 0) { x = condition ? x - 1 : x + 1 }',
    6: 'switch (state) { case A: ... case B: ... }',
  },
  Z_LOOP: {
    2: 'repeat(n) { /* body */ }',
    4: 'for (let i = 0; i < rows; i++) { for (let j = 0; j < cols; j++) { } }',
    6: 'function traverse(grid) { /* sweep all three quadrants */ }',
  },
  DIAG_LOOP: {
    2: 'function ping() { return pong() }',
    4: 'element.addEventListener("click", handler)',
    6: 'async function fetch() { const res = await call(); return res }',
  },
  GATE_ON: {
    2: 'function myFunction() { /* body */ }',
    4: 'class MyClass { constructor() {} }',
    6: 'module.exports = { /* full API */ }',
  },
  GATE_OFF: {
    2: '// empty',
    4: 'null',
    6: 'undefined',
  },
};

/**
 * Find the nearest seeded code hint for a given family and depth.
 * Uses closest-depth lookup so there's always a match.
 */
function getCodeHint(family: GEOFamily, depth: number): string {
  const hints = SEED_CODEHINTS[family];
  const keys = Object.keys(hints).map(Number).sort((a, b) => a - b);
  const closest = keys.reduce((prev, curr) =>
    Math.abs(curr - depth) < Math.abs(prev - depth) ? curr : prev
  );
  return hints[closest] ?? '// ?';
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE B — HINT EVOLUTION TIERS
// As a pattern is reinforced beyond 0.9, the code hint matures.
// Confidence maps to conceptual depth: geometry grows into richer programs.
//
//  0.90 → Apprentice  (seeded hint — the Librarian hears the knock)
//  0.95 → Journeyman  (next depth — the pattern earns a name)
//  1.00 → Master      (deepest hint — the rock reaches the top)
// ═══════════════════════════════════════════════════════════════════════════

type EvolutionTier = 'apprentice' | 'journeyman' | 'master';

function getConfidenceTier(confidence: number): EvolutionTier {
  if (confidence >= 1.0) return 'master';
  if (confidence >= 0.95) return 'journeyman';
  return 'apprentice';
}

function getEvolvedCodeHint(family: GEOFamily, depth: number, tier: EvolutionTier): string {
  // Tier bumps the "perceived" depth so getCodeHint finds a richer seed.
  // apprentice → exact depth (seeded at promotion)
  // journeyman → depth + 2  (intermediate complexity)
  // master     → depth + 4  (maximum complexity for this family)
  const depthBump = tier === 'master' ? 4 : tier === 'journeyman' ? 2 : 0;
  return getCodeHint(family, depth + depthBump);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BABY AGENT
// ═══════════════════════════════════════════════════════════════════════════

export class BabyAgent {
  brain: RuntimeBrain;
  private cfg: BabyConfig;
  private listeners: BabyAgentListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private canvasRef: HTMLCanvasElement | null = null;
  // Shadow canvas: agent-owned copy used for pixel reads.
  // getImageData on p5's canvas is blocked in Claude-in-Chrome's extension
  // context (fingerprint protection).  We mirror pixel data into this canvas
  // via setInterval so captureCanvas() always has a readable surface.
  private shadowCanvas: HTMLCanvasElement | null = null;
  private shadowCtx: CanvasRenderingContext2D | null = null;
  private shadowIntervalId: ReturnType<typeof setInterval> | null = null;
  private prevPixels: ImageData | null = null;
  private prevColors: Set<string> = new Set();
  private ticksSinceReward: number = 0;

  // Wild mode state
  private wildMode = false;

  // Phase C: Guide Mode — anti-spam timer for guide_available events
  private _lastGuideTick = -999;

  constructor(config: BabyConfig = BABY_0_CONFIG) {
    this.cfg = config;
    this.brain = createBabyBrain();
    // Auto-restore from localStorage on every birth (survives HMR + page refresh)
    this.restoreFromStorage();
  }

  /** Save brain to localStorage — called automatically after each pattern cache */
  private persistToStorage() {
    try {
      const snapshot = this.serialize();
      localStorage.setItem(this.cfg.storageKey, JSON.stringify(snapshot));
    } catch (e) {
      // Storage quota or unavailable — silent fail
    }
  }

  /** Restore brain from localStorage if a snapshot exists */
  private restoreFromStorage() {
    try {
      const raw = localStorage.getItem(this.cfg.storageKey);
      if (!raw) return;
      const snapshot = JSON.parse(raw);
      if (snapshot?.version === 1 && Array.isArray(snapshot.patternCache) && snapshot.patternCache.length > 0) {
        this.loadBrain(snapshot);
        console.log(`[${this.cfg.name}] 💾 Memory restored from localStorage: ${snapshot.stats?.totalPatterns ?? '?'} patterns, res ${snapshot.stats?.gridSize ?? '?'}×${snapshot.stats?.gridSize ?? '?'}`);
      }
    } catch (e) {
      // Corrupt storage — ignore
    }
  }

  /** Wipe localStorage snapshot (use when you want a fresh brain) */
  clearStorage() {
    localStorage.removeItem(this.cfg.storageKey);
    console.log(`[${this.cfg.name}] 🗑️ Brain storage cleared. Next birth starts fresh.`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to agent events (focus changes, rewards, etc.)
   */
  on(listener: BabyAgentListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(event: BabyAgentEvent) {
    this.listeners.forEach(l => l(event));
  }

  /**
   * Give the agent eyes — point it at the canvas element.
   * Creates a shadow canvas that mirrors the source at SHADOW_SYNC_MS
   * so captureCanvas() is never blocked by extension-context restrictions
   * on getImageData (Chrome fingerprint protection on p5's canvas).
   */
  setCanvas(canvas: HTMLCanvasElement | null) {
    // Tear down previous shadow
    if (this.shadowIntervalId) {
      clearInterval(this.shadowIntervalId);
      this.shadowIntervalId = null;
    }
    if (this.shadowCanvas) {
      this.shadowCanvas.remove();
      this.shadowCanvas = null;
      this.shadowCtx = null;
    }

    this.canvasRef = canvas;
    if (!canvas) return;

    // Create a tiny in-page canvas the agent fully owns (no taint issues)
    const sc = document.createElement('canvas');
    sc.width  = canvas.width;
    sc.height = canvas.height;
    sc.id = this.cfg.shadowId;
    sc.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
    document.body.appendChild(sc);
    this.shadowCanvas = sc;
    this.shadowCtx = sc.getContext('2d', { willReadFrequently: true });

    // Mirror source → shadow at cfg.shadowSyncMs
    this.shadowIntervalId = setInterval(() => {
      if (!this.canvasRef || !this.shadowCtx) return;
      try {
        this.shadowCtx.drawImage(this.canvasRef, 0, 0);
      } catch {
        // Cross-origin taint on drawImage — fall back to doing nothing;
        // wild-mode JS animation will write directly to shadowCanvas instead.
      }
    }, this.cfg.shadowSyncMs);

    console.log(`[${this.cfg.name}] 👁️ Shadow canvas online — ${sc.width}×${sc.height}, mirroring every ${this.cfg.shadowSyncMs}ms`);
  }

  /**
   * In wild mode the shadow canvas can also be used as the animation target
   * directly (bypasses p5 entirely — useful when wildAnimation prop is stale).
   */
  getShadowCanvas(): HTMLCanvasElement | null {
    return this.shadowCanvas;
  }

  /**
   * Start the exploration loop.
   */
  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), this.cfg.tickRateMs);
    console.log(
      `[${this.cfg.name}] 🌱 Born. Visual resolution:`,
      this.brain.visualResolution,
      '(2×2 quadrants)'
    );
  }

  /**
   * Stop the exploration loop.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Reset to birth state.
   */
  reset() {
    this.stop();
    this.brain = createBabyBrain();
    this.prevPixels = null;
    this.prevColors = new Set();
    this.ticksSinceReward = 0;
  }

  /**
   * Get the brain state (for rendering, inspection).
   */
  getBrain(): RuntimeBrain {
    return this.brain;
  }

  /**
   * Get the pattern cache.
   */
  getPatternCache(): SpatialPattern[] {
    return this.brain.patternCache;
  }

  /**
   * Get the Librarian's archive — patterns promoted to Cyan State (confidence ≥ 0.9).
   */
  getLibraryCache(): LibraryEntry[] {
    return this.brain.libraryCache;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATTERN INJECTION — Human gesture enters the cognitive loop
  //
  // The human draws in a notebook. A photo is taken. An LLM reads the sketch
  // and returns a GEO path. That path is injected here — as if the baby had
  // explored that quadrant sequence and found a reward there.
  //
  // When the injected path matches a library entry (LCS), the baby "recognizes"
  // what the human drew and responds with the corresponding code hint.
  // This is the moment human and baby's interests align.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inject a GEO path as a high-confidence external observation.
   *
   * Source: 'sketch' (image→GEO pipeline), 'draw' (DrawCanvas stroke),
   *         'api' (programmatic), 'guide' (Guide Mode interaction)
   *
   * The path is treated as a strong reinforcement signal:
   *   - New path: cached at confidence 0.5 (already "seen" by human)
   *   - Known path: reinforced +0.2 (human and baby agree — big signal)
   *   - Library match: emits 'sketch_match' event with the matching entry
   *
   * Returns the LibraryEntry if a match was found (confidence ≥ 0.9), else null.
   */
  injectPattern(
    path: string[],
    source: 'sketch' | 'draw' | 'api' | 'guide' = 'sketch'
  ): LibraryEntry | null {
    if (path.length === 0) return null;

    const location: QuadrantAddress = {
      depth: path.length,
      path: path as ('TL' | 'TR' | 'BL' | 'BR')[],
    };
    const pathKey = path.join('→');

    // ── Check existing pattern cache ─────────────────────────────────────
    const existing = this.brain.patternCache.find(
      p => p.geoAddress?.path?.join('→') === pathKey
    );

    if (existing) {
      // Human drew a path baby already knows — strong agreement signal
      const prevConfidence = existing.confidence;
      existing.confidence = Math.min(1.0, existing.confidence + 0.2); // big boost
      existing.lastFiredAt = this.brain.tick;
      this.emit({ type: 'pattern_reinforced', pattern: existing, prevConfidence });
      console.log(`[${this.cfg.name}] 🎨 INJECT (${source}) [${pathKey}] → confidence ${existing.confidence.toFixed(2)}`);
    } else {
      // Human drew something new — cache it immediately at 0.5 confidence
      const pattern: SpatialPattern = {
        id: `inject_${source}_${Date.now()}`,
        geoAddress: location,
        actionSequence: [location],
        visualSignature: [999], // high delta signature — this was a strong human signal
        confidence: 0.5,
        discoveredAtAge: this.brain.age,
        lastFiredAt: this.brain.tick,
      };
      this.brain.patternCache.push(pattern);
      this.brain.knowledge.set(pattern.id, pattern);
      this.brain.age++;
      this.emit({ type: 'pattern_cached', pattern });
      console.log(`[${this.cfg.name}] 🎨 NEW INJECT (${source}) [${pathKey}] → cached at 0.5`);
    }

    // ── Check for library match (LCS) ────────────────────────────────────
    const target = this.getGuideTarget(); // reuse LCS logic — finds best library match
    if (target && target.similarity >= 0.7) {
      console.log(
        `[${this.cfg.name}] 🎵 SKETCH MATCH! [${pathKey}] aligns with library [${target.toEntry.address.join('→')}] ` +
        `— ${target.toEntry.loopFamily} | "${target.toEntry.codeHint}" | similarity: ${(target.similarity * 100).toFixed(0)}%`
      );
      return target.toEntry;
    }

    // ── Check direct library match ────────────────────────────────────────
    const exactMatch = this.brain.libraryCache.find(e => e.id === pathKey);
    if (exactMatch) {
      console.log(`[${this.cfg.name}] 🎵 EXACT MATCH! [${pathKey}] — "${exactMatch.codeHint}"`);
      return exactMatch;
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED CANVAS APIs — DrawCanvas feeds the baby directly
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Feed a drawn stroke directly into the baby's shadow canvas.
   * This is the highest-value input: student gesture → pixel delta → reward.
   * The baby sees your drawing as high-entropy food.
   *
   * Called by DrawCanvas on every mouse point during a stroke.
   */
  feedStroke(
    x: number,
    y: number,
    radius: number,
    color: { r: number; g: number; b: number }
  ): void {
    if (!this.shadowCtx || !this.shadowCanvas) return;
    const ctx = this.shadowCtx;
    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Get the pixel bounding box of the baby's current focus quadrant.
   * DrawCanvas uses this to render the baby's "response" glow at the right location.
   * Returns null if baby has no focus.
   */
  getFocusRegion(
    canvasW = 400,
    canvasH = 400
  ): { x: number; y: number; w: number; h: number } | null {
    if (!this.brain.currentFocus) return null;
    return quadrantToPixelRegion(this.brain.currentFocus, canvasW, canvasH);
  }

  /**
   * Get the baby's current visual resolution depth.
   * DrawCanvas uses this to draw the matching GEO grid overlay.
   */
  getResolution(): number {
    return this.brain.visualResolution;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE C — GUIDE MODE
  // When frustration ≥ 10 and the Librarian has filed patterns, return the
  // closest library entry to the current focus — using LCS similarity.
  // The guide IS the geometry. No text. The Librarian draws a path.
  // ─────────────────────────────────────────────────────────────────────────

  /** LCS distance between two path arrays. Used for guide matching. */
  private static _lcsLength(a: string[], b: string[]): number {
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
   * Guide Mode: find the closest library entry to the current focus path.
   *
   * Returns null if:
   *   - frustration < 10 (not struggling enough for the guide to activate)
   *   - library is empty (no Cyan State patterns filed yet)
   *   - no current focus (baby isn't looking at anything)
   *
   * The returned entry is the nearest beacon — the Librarian points at it
   * by drawing a line on SpatialEye. No text. The path IS the direction.
   */
  getGuideTarget(): { fromPath: string[]; toEntry: LibraryEntry; similarity: number } | null {
    if (this.brain.frustration < 10) return null;
    if (this.brain.libraryCache.length === 0) return null;
    if (!this.brain.currentFocus) return null;

    const currentPath = this.brain.currentFocus.path.map(p => String(p));
    let best: LibraryEntry | null = null;
    let bestScore = -1;

    for (const entry of this.brain.libraryCache) {
      const lcs = BabyAgent._lcsLength(currentPath, entry.address);
      const maxLen = Math.max(currentPath.length, entry.address.length, 1);
      const similarity = lcs / maxLen;
      if (similarity > bestScore) {
        bestScore = similarity;
        best = entry;
      }
    }

    return best ? { fromPath: currentPath, toEntry: best, similarity: bestScore } : null;
  }

  /**
   * Serialize brain state to a plain JSON object for persistence.
   * Safe to JSON.stringify and save to disk or localStorage.
   */
  serialize(): object {
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      brain: {
        visualResolution: this.brain.visualResolution,
        age: this.brain.age,
        energy: this.brain.energy,
        frustration: this.brain.frustration,
        isResting: this.brain.isResting,
        currentFocus: this.brain.currentFocus,
      },
      patternCache: this.brain.patternCache.map(p => ({
        id: p.id,
        path: p.geoAddress?.path ?? [],      // geoAddress.path is the real quadtree address
        depth: p.geoAddress?.depth ?? 0,
        confidence: p.confidence,
        discoveredAtAge: p.discoveredAtAge,
        lastFiredAt: p.lastFiredAt,
      })),
      // Phase A: persist the Librarian's archive across sessions
      libraryCache: this.brain.libraryCache.map(e => ({
        id: e.id,
        address: e.address,
        depth: e.depth,
        confidence: e.confidence,
        promotedAt: e.promotedAt,
        deltaSignature: e.deltaSignature,
        loopFamily: e.loopFamily,
        codeHint: e.codeHint,
        visitCount: e.visitCount,
      })),
      wildMode: this.wildMode,
      stats: {
        totalPatterns: this.brain.patternCache.length,
        gridSize: Math.pow(2, this.brain.visualResolution),
        totalRegions: Math.pow(2, this.brain.visualResolution) ** 2,
      },
    };
  }

  /**
   * Load a previously serialized brain state.
   * Only restores pattern cache and resolution — doesn't touch running state.
   */
  loadBrain(snapshot: any) {
    if (!snapshot || snapshot.version !== 1) {
      console.warn('[baby_0] ⚠ Invalid snapshot version, ignoring.');
      return;
    }
    this.brain.visualResolution = snapshot.brain.visualResolution ?? this.brain.visualResolution;
    this.brain.age = snapshot.brain.age ?? 0;
    this.brain.energy = snapshot.brain.energy ?? 1.0;
    this.brain.frustration = 0; // always start calm after load
    // Restore pattern cache — reconstruct full SpatialPattern shape from snapshot
    if (Array.isArray(snapshot.patternCache)) {
      this.brain.patternCache = snapshot.patternCache.map((p: any) => ({
        id: p.id ?? `p_restored_${Math.random()}`,
        geoAddress: { depth: p.depth ?? p.path?.length ?? 0, path: p.path ?? [] },
        actionSequence: [{ depth: p.depth ?? 0, path: p.path ?? [] }],
        visualSignature: [],
        confidence: p.confidence ?? 0.1,
        discoveredAtAge: p.discoveredAtAge ?? 0,
        lastFiredAt: p.lastFiredAt ?? 0,
      } as SpatialPattern));
    }
    // Restore library cache if present
    if (Array.isArray(snapshot.libraryCache)) {
      this.brain.libraryCache = snapshot.libraryCache.map((e: any) => ({
        id: e.id,
        address: e.address ?? [],
        depth: e.depth ?? 0,
        confidence: e.confidence ?? 0.9,
        promotedAt: e.promotedAt ?? 0,
        deltaSignature: e.deltaSignature ?? 0,
        loopFamily: (e.loopFamily as GEOFamily) ?? 'Y_LOOP',
        codeHint: e.codeHint ?? null,
        visitCount: e.visitCount ?? 0,
        cyanFlashFired: true,   // already shown before — don't re-flash on restore
      } as LibraryEntry));
    }
    console.log(
      `[${this.cfg.name}] 🧠 Brain loaded from ${snapshot.timestamp}. `,
      `${this.brain.patternCache.length} patterns restored at ${Math.pow(2, this.brain.visualResolution)}×${Math.pow(2, this.brain.visualResolution)} resolution.`,
      this.brain.libraryCache.length > 0 ? `📚 ${this.brain.libraryCache.length} library entries restored.` : ''
    );
  }

  /**
   * WILD MODE — remove the leash.
   * 12.5 ticks/sec, no rest, faster resolution growth.
   * Give it a rich canvas and watch it fill the quadtree.
   */
  enableWildMode() {
    this.wildMode = true;
    this.brain.isResting = false;
    this.brain.frustration = 0;
    this.brain.energy = 1.0;
    this.ticksSinceReward = 0;
    // Always (re)start at wild tick rate — even if interval was dead after HMR
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.tick(), this.cfg.wildTickRateMs);

    // Paint high-contrast cycling colors directly onto shadowCanvas (setInterval —
    // not rAF, which gets throttled when the tab is in background).  This guarantees
    // the agent always has moving pixels to eat even if p5's wildAnimation prop
    // is stale after HMR or a focus change.
    if (this.shadowCanvas && this.shadowCtx) {
      this._startShadowWildPaint();
    }

    console.log(`[${this.cfg.name}] ⚡ WILD MODE — leash removed. Running at ${(1000/this.cfg.wildTickRateMs).toFixed(1)}Hz. No rest. No ceiling.`);
  }

  /** Internal: paint high-contrast cycling color blocks onto shadowCanvas. */
  private _shadowWildPaintId: ReturnType<typeof setInterval> | null = null;
  private _shadowWildFrame = 0;

  private _startShadowWildPaint() {
    if (this._shadowWildPaintId) clearInterval(this._shadowWildPaintId);
    const ctx = this.shadowCtx!;
    const W = this.shadowCanvas!.width;
    const H = this.shadowCanvas!.height;
    const BLOCK = this.cfg.wildPaintBlockSize;

    const PALS = [
      [[255,0,0],[0,255,0],[0,0,255],[255,255,0]],
      [[255,0,255],[0,255,255],[255,128,0],[128,0,255]],
      [[200,50,50],[50,200,50],[50,50,200],[200,200,50]],
      [[80,0,0],[0,80,0],[0,0,80],[80,80,0]],
    ];

    this._shadowWildPaintId = setInterval(() => {
      if (!this.wildMode) {
        clearInterval(this._shadowWildPaintId!);
        this._shadowWildPaintId = null;
        return;
      }
      this._shadowWildFrame++;
      const f = this._shadowWildFrame;
      const pal = PALS[f % PALS.length];
      for (let x = 0; x < W; x += BLOCK) {
        for (let y = 0; y < H; y += BLOCK) {
          const [r, g, b] = pal[Math.floor(Math.random() * pal.length)];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, BLOCK, BLOCK);
        }
      }
    }, 50);
  }

  /**
   * Calm baby_0 back down to normal exploration pace.
   */
  disableWildMode() {
    this.wildMode = false;
    if (this._shadowWildPaintId) {
      clearInterval(this._shadowWildPaintId);
      this._shadowWildPaintId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.tick(), this.cfg.tickRateMs);
    }
    console.log(`[${this.cfg.name}] 🌙 Returning to calm exploration. ${(1000/this.cfg.tickRateMs).toFixed(1)}Hz.`);
  }

  isWild(): boolean { return this.wildMode; }

  // ─────────────────────────────────────────────────────────────────────────
  // CORE LOOP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Main tick function — runs 2x/second.
   * Sense → Curiosity → Reward → Learn → Emit events.
   */
  private tick() {
    // In wild mode: skip rest entirely, always full energy
    if (this.wildMode) {
      this.brain.isResting = false;
      this.brain.energy = 1.0;
    }

    // Handle rest mode (normal mode only)
    if (this.brain.isResting) {
      this.brain.energy = Math.min(1.0, this.brain.energy + 0.01);
      if (this.brain.energy > 0.3) {
        this.brain.isResting = false;
        this.emit({ type: 'rest_end' });
        console.log(`[${this.cfg.name}] 👁️ Rested. Ready to explore.`);
      }
      return;
    }

    // Increment tick and deplete energy (wild: no depletion)
    this.brain.tick++;
    if (!this.wildMode) this.brain.energy = Math.max(0, this.brain.energy - this.cfg.energyDepletionRate);

    // If energy exhausted, rest
    if (this.brain.energy <= 0) {
      this.brain.isResting = true;
      this.emit({ type: 'rest_start' });
      console.log(`[${this.cfg.name}] 😴 Energy depleted. Resting...`);
      return;
    }

    // 1. Sense: capture current canvas state
    const currentPixels = this.captureCanvas();

    // 2. Compute entropy per quadrant at current resolution
    const depth = this.brain.visualResolution;
    const quadrants = getQuadrantsAtDepth(depth);
    const entropy = this.computeQuadrantEntropy(quadrants);

    // 3. Curiosity: pick focus quadrant
    const focus = this.pickFocus(quadrants, entropy);
    if (!focus) return;

    // Update focus if changed
    const focusKey = addressToKey(focus);
    const prevFocusKey = this.brain.currentFocus
      ? addressToKey(this.brain.currentFocus)
      : null;

    if (focusKey !== prevFocusKey) {
      this.brain.currentFocus = focus;
      this.brain.visitCounts.set(focusKey, (this.brain.visitCounts.get(focusKey) ?? 0) + 1);
      this.emit({ type: 'focus_changed', quadrant: focus });
    }

    // 4. Reward: compare to previous frame
    if (this.prevPixels && currentPixels) {
      const { delta, newColors } = this.computeDelta(currentPixels, this.prevPixels);
      const reward = this.computeReward(delta, newColors);

      if (reward.value > 0) {
        // REWARD FIRED
        this.ticksSinceReward = 0;
        this.brain.frustration = Math.max(0, this.brain.frustration - 1);
        this.brain.energy = Math.min(1.0, this.brain.energy + this.cfg.energyRewardBonus);
        this.brain.lastReward = { location: focus, value: reward.value, tick: this.brain.tick };

        this.emit({
          type: 'reward_fired',
          quadrant: focus,
          value: reward.value,
          tier: reward.tier,
        });

        // 5. Learn: cache patterns on medium+ rewards
        if (reward.value >= this.cfg.minRewardForCache) {
          this.cachePattern(focus, delta);
        }
      } else {
        // NO REWARD — accumulate frustration
        this.ticksSinceReward++;

        if (this.ticksSinceReward >= this.cfg.frustrationTicks) {
          this.ticksSinceReward = 0;
          this.brain.frustration++;
          this.emit({ type: 'frustration_update', level: this.brain.frustration });

          // Frustration rules from spec
          if (this.brain.frustration >= 5 && this.brain.frustration < 10) {
            // SEEK_NEW_QUADRANT — already happens in pickFocus via explore_unexplored
          } else if (this.brain.frustration >= 10 && this.brain.frustration < 15) {
            // 🧭 Phase C: Guide Mode — Librarian draws a path to the nearest beacon
            // Emit once every ~5 ticks (anti-spam) so App.tsx can update the guide overlay
            if (this.brain.tick - this._lastGuideTick >= 5) {
              const target = this.getGuideTarget();
              if (target) {
                this._lastGuideTick = this.brain.tick;
                this.emit({ type: 'guide_available', fromPath: target.fromPath, toEntry: target.toEntry, similarity: target.similarity });
              }
            }
          } else if (this.brain.frustration >= 15) {
            // REST_MODE — drain energy so rest lasts a meaningful duration
            this.brain.isResting = true;
            this.brain.energy = 0;        // Force full recovery cycle (~15 seconds)
            this.brain.frustration = 0;   // Reset frustration so next wake starts fresh
            this.ticksSinceReward = 0;
            this.emit({ type: 'rest_start' });
            console.log(`[${this.cfg.name}] 😤 Too frustrated. Time to rest.`);
          }
        }
      }
    }

    // Save pixels for next frame
    if (currentPixels) this.prevPixels = currentPixels;
    this.emit({ type: 'energy_update', level: this.brain.energy });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SENSING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Capture pixel data from canvas.
   */
  private captureCanvas(): ImageData | null {
    // Prefer shadow canvas (immune to extension-context getImageData restriction)
    const target = this.shadowCanvas ?? this.canvasRef;
    if (!target) return null;
    try {
      const ctx = target === this.shadowCanvas
        ? this.shadowCtx
        : target.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      return ctx.getImageData(0, 0, target.width, target.height);
    } catch {
      return null;
    }
  }

  /**
   * Compute Shannon entropy for each quadrant.
   * Higher entropy = more visual information = more interesting.
   */
  private computeQuadrantEntropy(quadrants: QuadrantAddress[]): Map<string, number> {
    const result = new Map<string, number>();
    const target = this.shadowCanvas ?? this.canvasRef;
    if (!target) return result;

    const ctx = target === this.shadowCanvas
      ? this.shadowCtx
      : target.getContext('2d', { willReadFrequently: true });
    if (!ctx) return result;

    const { width, height } = target;

    for (const q of quadrants) {
      const region = quadrantToPixelRegion(q, width, height);
      try {
        const pixels = ctx.getImageData(
          region.x,
          region.y,
          Math.max(1, Math.floor(region.w)),
          Math.max(1, Math.floor(region.h))
        );
        result.set(addressToKey(q), this.shannonEntropy(pixels.data));
      } catch {
        result.set(addressToKey(q), 0);
      }
    }

    return result;
  }

  /**
   * Compute Shannon entropy from pixel data.
   * H = -Σ(p_i * log2(p_i))
   */
  private shannonEntropy(data: Uint8ClampedArray): number {
    const counts = new Map<number, number>();

    // Quantize to 16 buckets for speed (0-255 → 0-15)
    for (let i = 0; i < data.length; i += 4) {
      const brightness = Math.floor(((data[i] + data[i + 1] + data[i + 2]) / 3) / 16);
      counts.set(brightness, (counts.get(brightness) ?? 0) + 1);
    }

    const total = data.length / 4;
    let entropy = 0;

    for (const count of counts.values()) {
      const p = count / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Compute pixel delta between two frames.
   * Also detect new colors entering the scene.
   */
  private computeDelta(
    current: ImageData,
    prev: ImageData
  ): { delta: number; newColors: boolean } {
    let delta = 0;
    const colorsBefore = new Set<string>();
    const colorsAfter = new Set<string>();
    const step = 4; // sample every 4th pixel for performance

    for (let i = 0; i < current.data.length; i += 4 * step) {
      const dr = Math.abs(current.data[i] - prev.data[i]);
      const dg = Math.abs(current.data[i + 1] - prev.data[i + 1]);
      const db = Math.abs(current.data[i + 2] - prev.data[i + 2]);

      if (dr + dg + db > 10) delta++;

      // Track dominant color buckets (64 levels: 0-255 / 64 = 0-3)
      colorsBefore.add(
        `${Math.floor(prev.data[i] / 64)},${Math.floor(prev.data[i + 1] / 64)},${Math.floor(prev.data[i + 2] / 64)}`
      );
      colorsAfter.add(
        `${Math.floor(current.data[i] / 64)},${Math.floor(current.data[i + 1] / 64)},${Math.floor(current.data[i + 2] / 64)}`
      );
    }

    const newColors = [...colorsAfter].some(c => !colorsBefore.has(c));
    return { delta, newColors };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CURIOSITY ENGINE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Decide which quadrant to focus on next.
   * Implements: scan_by_salience, explore_unexplored, follow_reward_gradient, random_leap.
   */
  private pickFocus(
    quadrants: QuadrantAddress[],
    entropy: Map<string, number>
  ): QuadrantAddress | null {
    if (quadrants.length === 0) return null;

    // Random leap — base chance from config, boosted by frustration
    const leapChance = this.cfg.leapChance + (this.brain.frustration >= 10 ? 0.15 : 0);
    if (Math.random() < leapChance) {
      const unvisited = quadrants.filter(q => !this.brain.visitCounts.has(addressToKey(q)));
      if (unvisited.length > 0) {
        return unvisited[Math.floor(Math.random() * unvisited.length)];
      }
    }

    // Explore unexplored — base chance from config, boosted by frustration
    const exploreChance = this.cfg.exploreChance + (this.brain.frustration >= 5 ? 0.2 : 0);
    if (Math.random() < exploreChance) {
      const unvisited = quadrants.filter(q => !this.brain.visitCounts.has(addressToKey(q)));
      if (unvisited.length > 0) {
        // Among unvisited, pick highest entropy
        return unvisited.reduce((best, q) =>
          (entropy.get(addressToKey(q)) ?? 0) > (entropy.get(addressToKey(best)) ?? 0) ? q : best
        );
      }
    }

    // Follow reward gradient if recent reward (within 10 ticks)
    if (
      this.brain.lastReward &&
      this.brain.tick - this.brain.lastReward.tick < 10
    ) {
      const lastLoc = this.brain.lastReward.location;
      const adjacent = getAdjacentQuadrants(lastLoc, quadrants);
      if (adjacent.length > 0) {
        return adjacent[Math.floor(Math.random() * adjacent.length)];
      }
    }

    // Default: highest entropy (scan_by_salience)
    return quadrants.reduce((best, q) =>
      (entropy.get(addressToKey(q)) ?? 0) > (entropy.get(addressToKey(best)) ?? 0) ? q : best
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REWARD DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute reward value based on visual change.
   * Implements TIER_1-4 and NEW_COLOR detection.
   */
  private computeReward(delta: number, newColors: boolean): { value: number; tier: string } {
    if (delta > 500) return { value: 1.0, tier: 'TIER_1_something_exploded' };
    if (delta > 100) return { value: 0.6, tier: 'TIER_2_something_happened' };
    if (newColors) return { value: 0.4, tier: 'TIER_4_new_color' };
    if (delta > 10) return { value: 0.2, tier: 'TIER_3_something_stirred' };
    return { value: 0, tier: 'none' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEARNING / PATTERN CACHING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Promote a pattern to the Librarian's archive (Cyan State).
   *
   * Called when a pattern crosses confidence ≥ 0.9 for the first time.
   * Infers the GEO loop family, sets a seeded code hint, and files the entry.
   * Emits 'cyan_promoted' so SpatialEye can fire the cyan ring flash.
   *
   * The Librarian doesn't push the rock. It files the path.
   */
  private promoteToLibrary(pattern: SpatialPattern, delta: number): LibraryEntry {
    const path = (pattern.geoAddress?.path ?? []).map(p => String(p));
    const depth = pattern.geoAddress?.depth ?? path.length;
    const family = inferLoopFamily(path);
    const visitCount = this.brain.visitCounts.get(addressToKey(pattern.geoAddress)) ?? 0;

    const entry: LibraryEntry = {
      id: path.join('→'),
      address: path,
      depth,
      confidence: pattern.confidence,
      promotedAt: this.brain.tick,
      deltaSignature: delta,
      loopFamily: family,
      codeHint: getCodeHint(family, depth),
      visitCount,
      cyanFlashFired: false,
    };

    this.brain.libraryCache.push(entry);
    return entry;
  }

  /**
   * Cache or reinforce a pattern when reward fires.
   *
   * If a pattern already exists at this exact GEO path:
   *   → REINFORCE: confidence += 0.1 (clamp 1.0), update lastFiredAt
   *   → emit pattern_reinforced — SpatialEye turns orange → pink at 0.7+
   *
   * If no pattern exists yet:
   *   → CACHE: new pattern, confidence = 0.1, age++, trigger growth
   */
  private cachePattern(location: QuadrantAddress, delta: number) {
    const pathKey = location.path.join('→');

    // ── Reinforcement path ────────────────────────────────────────────────
    const existing = this.brain.patternCache.find(
      p => p.geoAddress?.path?.join('→') === pathKey
    );
    if (existing) {
      const prevConfidence = existing.confidence;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
      existing.lastFiredAt = this.brain.tick;
      this.emit({ type: 'pattern_reinforced', pattern: existing, prevConfidence });

      if (existing.confidence >= 0.7 && prevConfidence < 0.7) {
        console.log(
          `[${this.cfg.name}] 🌸 Pattern STABILIZED at [${pathKey}] — confidence ${existing.confidence.toFixed(1)} (orange → pink)`
        );
      }

      // 🩵 CYAN STATE — Aha! moment: promote to Librarian's archive at confidence ≥ 0.9
      if (existing.confidence >= 0.9) {
        const libEntry = this.brain.libraryCache.find(e => e.id === pathKey);
        if (!libEntry) {
          // First promotion — file into library, emit cyan flash
          const entry = this.promoteToLibrary(existing, delta);
          this.emit({ type: 'cyan_promoted', entry });
          console.log(
            `[${this.cfg.name}] 🩵 CYAN STATE at [${pathKey}] — filed as ${entry.loopFamily} | "${entry.codeHint}"`
          );
        } else {
          // 📗 Phase B: Hint Evolution — the code grows as the rock is pushed higher
          libEntry.visitCount++;
          libEntry.confidence = existing.confidence;  // keep in sync
          const newTier = getConfidenceTier(existing.confidence);
          const newHint = getEvolvedCodeHint(libEntry.loopFamily, libEntry.depth, newTier);
          if (newHint !== libEntry.codeHint) {
            const prevHint = libEntry.codeHint;
            libEntry.codeHint = newHint;
            this.emit({ type: 'hint_evolved', entry: libEntry, prevHint, tier: newTier });
            console.log(
              `[${this.cfg.name}] 📗 HINT EVOLVED at [${pathKey}] → ${newTier.toUpperCase()} | "${newHint}"`
            );
          }
        }
      }
      // Auto-save on stabilization
      if (this.brain.age % 5 === 0) this.persistToStorage();
      return;
    }

    // ── New pattern path ──────────────────────────────────────────────────
    const id = `p_${this.brain.age}_${Date.now()}`;
    const pattern: SpatialPattern = {
      id,
      geoAddress: location,
      actionSequence: [location],
      visualSignature: [delta],
      confidence: 0.1,
      discoveredAtAge: this.brain.age,
      lastFiredAt: this.brain.tick,
    };

    this.brain.patternCache.push(pattern);
    this.brain.knowledge.set(id, pattern);
    this.brain.age++;

    // Growth rule: gain visual resolution every N patterns (config-driven)
    const growthInterval = this.wildMode ? this.cfg.wildGrowthInterval : this.cfg.growthInterval;
    if (this.brain.age % growthInterval === 0 && this.brain.visualResolution < this.cfg.maxResolution) {
      this.brain.visualResolution++;
      this.emit({ type: 'resolution_gained', newResolution: this.brain.visualResolution });
      const regionsPerSide = Math.pow(2, this.brain.visualResolution);
      console.log(
        `[${this.cfg.name}] 👁️ Resolution gained: now sees ${regionsPerSide}×${regionsPerSide} regions`
      );
    }

    console.log(
      `[${this.cfg.name}] ✨ Pattern #${this.brain.age} at [${pathKey}] (confidence: ${pattern.confidence})`
    );
    this.emit({ type: 'pattern_cached', pattern });

    // Auto-save every 5 patterns
    if (this.brain.age % 5 === 0) {
      this.persistToStorage();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCES
// ═══════════════════════════════════════════════════════════════════════════

export const babyAgent  = new BabyAgent(BABY_0_CONFIG);
export const baby1Agent = new BabyAgent(BABY_1_CONFIG);

/** Helper: create a dev-console toolbelt for any agent instance */
function makeDevTools(agent: BabyAgent, name: string) {
  return {
    agent,
    getBrainJSON: () => JSON.stringify(agent.serialize(), null, 2),
    saveBrain: () => {
      const json = JSON.stringify(agent.serialize(), null, 2);
      navigator.clipboard.writeText(json).then(
        () => console.log(`[${name}] 🧠 Brain JSON copied to clipboard!`),
        () => console.log(`[${name}] 🧠 Brain JSON (copy manually):\n` + json)
      );
      return json;
    },
    clearBrain: () => {
      agent.clearStorage();
      console.log(`[${name}] 🔄 Reload the page to start with a fresh brain.`);
    },
    status: () => {
      const s = agent.serialize() as any;
      console.log(`[${name}] 🧠 ${s.stats.totalPatterns} patterns | ${s.stats.gridSize}×${s.stats.gridSize} res | wild: ${s.wildMode} | energy: ${(s.brain.energy * 100).toFixed(0)}%`);
      return s.stats;
    },
    // Phase A: Librarian's archive inspection
    library: () => {
      const lib = agent.getLibraryCache();
      if (lib.length === 0) {
        console.log(`[${name}] 📚 Library empty — no patterns promoted to Cyan State yet (need confidence ≥ 0.9)`);
        return [];
      }
      console.log(`[${name}] 📚 Library: ${lib.length} entries`);
      lib.forEach((e, i) => {
        console.log(`  ${i+1}. [${e.address.join('→')}] | ${e.loopFamily} | depth ${e.depth} | conf ${e.confidence.toFixed(2)} | "${e.codeHint}"`);
      });
      return lib;
    },
  };
}

if (typeof window !== 'undefined') {
  (window as any).__baby0__ = makeDevTools(babyAgent,  'baby_0');
  (window as any).__baby1__ = makeDevTools(baby1Agent, 'baby_1');
  console.log('[geoai] 💡 Dev tools: window.__baby0__ / window.__baby1__ — .saveBrain() .status() .clearBrain()');
}
