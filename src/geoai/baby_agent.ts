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
        rewardValue: p.rewardValue,
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
    console.log(
      `[${this.cfg.name}] 🧠 Brain loaded from ${snapshot.timestamp}. `,
      `${this.brain.patternCache.length} patterns restored at ${Math.pow(2, this.brain.visualResolution)}×${Math.pow(2, this.brain.visualResolution)} resolution.`
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
            // SWITCH_STRATEGY — prioritize random_leap and exploration
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
  };
}

if (typeof window !== 'undefined') {
  (window as any).__baby0__ = makeDevTools(babyAgent,  'baby_0');
  (window as any).__baby1__ = makeDevTools(baby1Agent, 'baby_1');
  console.log('[geoai] 💡 Dev tools: window.__baby0__ / window.__baby1__ — .saveBrain() .status() .clearBrain()');
}
