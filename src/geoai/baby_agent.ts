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
  | { type: 'frustration_update'; level: number }
  | { type: 'resolution_gained'; newResolution: number }
  | { type: 'energy_update'; level: number }
  | { type: 'rest_start' }
  | { type: 'rest_end' };

export type BabyAgentListener = (event: BabyAgentEvent) => void;

// ═══════════════════════════════════════════════════════════════════════════
// THE BABY AGENT
// ═══════════════════════════════════════════════════════════════════════════

export class BabyAgent {
  brain: RuntimeBrain;
  private listeners: BabyAgentListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private canvasRef: HTMLCanvasElement | null = null;
  private prevPixels: ImageData | null = null;
  private prevColors: Set<string> = new Set();
  private ticksSinceReward: number = 0;
  
  // Configuration
  private readonly TICK_RATE_MS = 500;        // 2 ticks/second — deliberate, thoughtful
  private readonly FRUSTRATION_TICKS = 6;    // 3 seconds at 2 ticks/sec
  private readonly MAX_RESOLUTION = 8;       // depth 8 = 256 regions max
  private readonly MIN_REWARD_FOR_CACHE = 0.3; // only cache rewards >= this
  
  constructor() {
    this.brain = createBabyBrain();
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
   */
  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvasRef = canvas;
  }

  /**
   * Start the exploration loop.
   */
  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), this.TICK_RATE_MS);
    console.log(
      '[baby_0] 🌱 Born. Visual resolution:',
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

  // ─────────────────────────────────────────────────────────────────────────
  // CORE LOOP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Main tick function — runs 2x/second.
   * Sense → Curiosity → Reward → Learn → Emit events.
   */
  private tick() {
    // Handle rest mode
    if (this.brain.isResting) {
      this.brain.energy = Math.min(1.0, this.brain.energy + 0.01);
      if (this.brain.energy > 0.3) {
        this.brain.isResting = false;
        this.emit({ type: 'rest_end' });
        console.log('[baby_0] 👁️ Rested. Ready to explore.');
      }
      return;
    }

    // Increment tick and deplete energy
    this.brain.tick++;
    this.brain.energy = Math.max(0, this.brain.energy - 0.001);

    // If energy exhausted, rest
    if (this.brain.energy <= 0) {
      this.brain.isResting = true;
      this.emit({ type: 'rest_start' });
      console.log('[baby_0] 😴 Energy depleted. Resting...');
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
        this.brain.energy = Math.min(1.0, this.brain.energy + 0.05);
        this.brain.lastReward = { location: focus, value: reward.value, tick: this.brain.tick };

        this.emit({
          type: 'reward_fired',
          quadrant: focus,
          value: reward.value,
          tier: reward.tier,
        });

        // 5. Learn: cache patterns on medium+ rewards
        if (reward.value >= this.MIN_REWARD_FOR_CACHE) {
          this.cachePattern(focus, delta);
        }
      } else {
        // NO REWARD — accumulate frustration
        this.ticksSinceReward++;

        if (this.ticksSinceReward >= this.FRUSTRATION_TICKS) {
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
            console.log('[baby_0] 😤 Too frustrated. Time to rest.');
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
    if (!this.canvasRef) return null;
    try {
      const ctx = this.canvasRef.getContext('2d');
      if (!ctx) return null;
      return ctx.getImageData(0, 0, this.canvasRef.width, this.canvasRef.height);
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
    if (!this.canvasRef) return result;

    const ctx = this.canvasRef.getContext('2d');
    if (!ctx) return result;

    const { width, height } = this.canvasRef;

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

    // 5% random leap (high frustration increases this bias)
    const leapChance = 0.05 + (this.brain.frustration >= 10 ? 0.15 : 0);
    if (Math.random() < leapChance) {
      const unvisited = quadrants.filter(q => !this.brain.visitCounts.has(addressToKey(q)));
      if (unvisited.length > 0) {
        return unvisited[Math.floor(Math.random() * unvisited.length)];
      }
    }

    // 60% explore unexplored (higher bias when frustrated)
    const exploreChance = 0.6 + (this.brain.frustration >= 5 ? 0.2 : 0);
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
   * Cache a new pattern when reward fires.
   * Increments age, triggers growth when age % 5 === 0.
   */
  private cachePattern(location: QuadrantAddress, delta: number) {
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

    // Growth rule: every 5 patterns, gain visual resolution (up to max 8)
    if (this.brain.age % 5 === 0 && this.brain.visualResolution < this.MAX_RESOLUTION) {
      this.brain.visualResolution++;
      this.emit({ type: 'resolution_gained', newResolution: this.brain.visualResolution });
      const regionsPerSide = Math.pow(2, this.brain.visualResolution);
      console.log(
        `[baby_0] 👁️ Resolution gained: now sees ${regionsPerSide}×${regionsPerSide} regions`
      );
    }

    console.log(
      `[baby_0] ✨ Pattern #${this.brain.age} cached at ${JSON.stringify(location.path)} (confidence: ${pattern.confidence})`
    );
    this.emit({ type: 'pattern_cached', pattern });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const babyAgent = new BabyAgent();
