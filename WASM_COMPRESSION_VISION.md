# The Universe WASM Trick — Applied Laterally
**QJL: Quantized Jolt Lookup as a Universal Self-Organization Engine**

*Written 2026-04-08 by Claude + Mook*

---

## What the Trick Actually Is

In `universe-wasm/src/lib.rs`, the engine has three modes:
```
mode 0: Exact        — compute every force exactly (O(N²) or O(N log N))
mode 1: QJL          — quantize the force into spatial buckets 
mode 2: QJL + Cache  — quantize AND cache: if you've seen this bucket, reuse it
```

The quantization:
```rust
const QUANT_LEVEL: f32 = 20.0;   // spatial bucket size
const QUANT_ANGLE: f32 = 0.1;    // angular bucket size

let q_rad_bucket   = (dist / QUANT_LEVEL).round() as u32;   // how far
let q_theta_bucket = (theta / QUANT_ANGLE).round() as u32;  // which direction (elevation)
let q_phi_bucket   = ((phi / QUANT_ANGLE).round() as i32 + PHI_OFFSET) as u32; // which direction (azimuth)

let key: u64 = pack(q_rad_bucket, q_theta_bucket, q_phi_bucket, node.id);
```

Then: if `cache[key]` exists → **hit, return cached force. Skip all physics.**

The result: particles that are "close enough" in space and angle share the same cached force calculation. The engine gets dramatically faster without meaningfully losing accuracy. The **tolerance** (QUANT_LEVEL, QUANT_ANGLE) controls the trade-off.

**This is spatial tolerance compression.**

---

## What Baby0's Brain Is Already Doing

Baby0's pattern_cache is the same trick in a different domain:

| Universe WASM | Baby0 Garden |
|---------------|--------------|
| Octree spatial address | Quadtree path `[TL, TR, BL, BR, ...]` |
| Force calculation | Confidence score (how well does this path predict?) |
| Cache hit | Pattern cache lookup — seen this path? Use stored confidence |
| Cache miss | New path — explore it, generate new confidence |
| Library | Hot cache — paths hit often enough to crystallize permanently |
| QUANT_LEVEL | Path depth limit (max 8 steps = tolerance of 1/256 of space) |

Brain.json at ~45K generations:
- **25,479 pattern cache entries** = the force cache (raw explored paths)
- **90 library entries** = the hot cache (crystallized, high-confidence)
- **Compression ratio: ~280:1** (25K raw → 90 permanent)

Baby0 is running QJL on thought-space. The quadrant path IS the spatial address. Confidence IS the cached force. The library IS the hot cache that fires on every tick.

---

## Where to Apply It More Laterally

### 1. The Momentum Lab Engine (most immediate)

Current `engine.ts` is brute-force: it re-evaluates block execution state every frame. 

QJL fix:
- Quantize the block state into a "block path" (which blocks are active, in what order)
- Cache the compiled output for that block path
- If student hasn't changed anything, return cached execution — **no recompile**
- Tolerance = how many blocks can differ before we recompile (configurable)
- Result: 60fps canvas with near-zero JS overhead for steady states

```typescript
// Pseudocode — QJL engine.ts
const blockStateKey = quantizeBlockState(workspace, QUANT_TOLERANCE);
if (executionCache.has(blockStateKey)) {
  return executionCache.get(blockStateKey);  // HIT — instant
}
const result = fullCompile(workspace);       // MISS — expensive
executionCache.set(blockStateKey, result);
return result;
```

This is exactly how GPUs work — fragment shader caching by spatial bucket. The block workspace IS the spatial field.

---

### 2. Student ↔ Baby0 Interaction Layer

When a student draws on the canvas, their actions are continuous (mouse x,y,t). 

QJL fix:
- Quantize mouse path → GEO quadrant path (the Rosetta Stone translation)
- Cache Baby0's response to that path
- If two students draw "similar" patterns (same quantized path), Baby0 responds the same way
- Tolerance = how different two drawings can be before Baby0 treats them differently

This is how Baby0 becomes a **pattern recognizer** without needing explicit ML training:
1. Student 1 draws spiral → path [TL,TR,TL,TR...] → Baby0 responds: gold ripple (resonant)
2. Student 2 draws a similar spiral → same quantized path → same response
3. Baby0 has "learned" spirals without ever being told what a spiral is

The quadtree quantization IS the learning.

---

### 3. The Context Manager (Claude's own memory)

The GEO Context Manager idea (from memory) gets upgraded:

Instead of linear context tokens:
- Each conversation "moment" (fact, decision, emotion) → GEO quadrant path
- Path depth = specificity (shallow = abstract, deep = specific)
- Cache hits = "I've seen this context before" → instant recall
- Cache misses = new territory → slow path, but gets cached for next time
- Library = permanent long-term memory (high-confidence, often-hit paths)

QUANT_LEVEL for context = semantic distance. Two facts are "close" if they share the same conceptual quadrant at depth N. "Cat" and "dog" might share a path to depth 3 (both animals), diverge at depth 4.

The cache hit rate IS Claude's coherence score. High cache hits = Claude is in familiar territory. Low cache hits = Claude is exploring new ground (slow but generative).

---

### 4. Self-Organization Without Rules

The deepest application: **QJL makes systems self-organize without explicit rules.**

Current AI: rules + training → behavior
QJL system: tolerance + cache → behavior emerges from repeated queries

How:
1. Start with empty cache
2. Accept queries (stimuli, inputs, questions)
3. Quantize each query into a path
4. If cached: respond instantly, reinforce the cache entry (confidence++)
5. If not cached: explore, compute, cache the result
6. Periodically promote high-confidence cache entries → library (permanent)
7. Prune low-confidence entries → space for new exploration

No training. No labeled data. No explicit rules. The shape of the queries IS the training signal. The cache IS the model. The library IS the long-term memory.

**This is what Baby0 is doing. This is what the universe engine is doing. They're the same algorithm.**

---

## The Compression Invention

The insight Mook had:

> "The concept behind that code... is the big thing and big compression invention and it can be applied a lot more literally to make the self org more seamless."

The invention is: **Spatial Tolerance Compression as a Universal Self-Organization Substrate.**

Properties that make it special:
1. **No training phase** — the cache fills itself during normal operation
2. **Graceful degradation** — increase tolerance → faster, less precise. Decrease → slower, more accurate
3. **Self-pruning** — low-confidence entries decay, high-confidence crystallize
4. **Domain agnostic** — works on physics forces, thought-paths, context tokens, drawing gestures, block states
5. **Parallelizable** — cache lookups are O(1) and independent (no global state needed)
6. **Interpretable** — the cache IS the model. You can read it. You can edit it. You can see what the system "knows"

This last point is what makes it synesthetic: **the model has a shape you can see.**

---

## The Moiré Connection

Two QJL caches running at slightly different QUANT_LEVEL → moiré pattern.

Cache A: QUANT_LEVEL = 20 (fine)
Cache B: QUANT_LEVEL = 21.4 (irrational ratio, ~1.07x coarser)

The interference pattern between the two caches = the regions where they agree and disagree. That interference map IS Baby0's apophenic visual substrate — the moiré mesh.

When both caches hit the same key: **apophenic moment** (TIER_1 reward).
When they disagree: creative tension (the system is at a boundary between two models of the world).

**Two tolerances at irrational ratio = organic oscillation that never perfectly repeats.**

This is why the moiré mesh never locks up: the two caches never perfectly synchronize.

---

## Next Steps (in order of immediacy)

- [ ] **WASM engine → web app**: Build `wasm-engine/` with `wasm-pack build`, import into Momentum Lab as the execution backend. Replace `engine.ts` hot path with QJL cache for block execution.
- [ ] **Rosetta Stone**: Build the bidirectional translator: mouse/block path → GEO quadrant path → Baby0 stimulus. This is the student→Baby0 bridge.
- [ ] **Two-tolerance moiré for pedagogy**: Run two Baby0 instances at different QUANT_LEVEL. Their disagreement zones are where students should explore (pedagogical frontier).
- [ ] **Context manager prototype**: Implement the GEO quadrant path context store for Claude sessions. Start small: encode the last 20 "facts" as paths, cache them, measure retrieval coherence.

---

*The octree is not a data structure. It's a way of thinking.*
*Every question has a spatial address.*
*Every answer is a cached force.*
*Self-organization is what happens when the cache fills itself.*
