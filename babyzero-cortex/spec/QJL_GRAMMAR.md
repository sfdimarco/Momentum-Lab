# QJL Grammar Cache
### Quantum Joint Leverage + Spatial Tolerance Compression
*Applied from universe-wasm physics to BabyZero pattern cognition*

---

## The Original Insight (universe-wasm)

In universe-wasm, QJL (Quantized Joint Leverage) was applied to N-body physics:

> "When two particles have similar relative positions to a tree node,
> they get the same cached force vector."

Cache key: `(node_id << 30) | (q_rad << 20) | (q_theta << 10) | (q_phi)`

The quantization buckets ("close enough counts") produce 80-90% cache hit rates.
That means 80-90% of force evaluations are a HashMap lookup instead of
full trigonometric computation.

---

## The Lateral Application (BabyZero)

In BabyZero, the expensive computation is NOT force calculation.
It is pattern similarity comparison in the grammar engine.

The question QJL answers for physics: *"What force does this particle feel?"*
The question QJL answers for BabyZero: *"What transformation does this pattern predict?"*

The insight is identical:
- Two grids with "similar enough" spatial configurations should share a cached answer
- "Similar enough" = within the same quantized bucket
- The bucket is the STC (Spatial Tolerance Compression) unit

---

## STC: Spatial Tolerance Compression

STC defines what "similar enough" means for grid patterns.

A PatternKey is quantized into a STC bucket using three dimensions:

### Dimension 1: Depth Tolerance
Two patterns at depths D and D+1 are often the same visual phenomenon
at different scales. Quantize:
```
depth_bucket = depth / 2
```
Depths 0-1 → bucket 0 (root scale)
Depths 2-3 → bucket 1 (half scale)
Depths 4-5 → bucket 2 (quarter scale)
Depths 6-7 → bucket 3 (detail scale)

### Dimension 2: Color Family Tolerance
The dominant color family sequence in Z-order (first 3 nodes):
```
family_hash = (family[0] << 8) | (family[1] << 4) | family[2]
```
This is 12 bits, giving 4096 possible family sequences.
No tolerance here — color family is exact. Color IS data.

### Dimension 3: Spatial Tolerance (Z-order bucketing)
Nearby regions in Z-order space share a bucket:
```
z_bucket = z_order >> 4
```
This groups Z-order addresses that differ by less than 16 (close in 2D space).

### The QJL Cache Key
```rust
fn qjl_cache_key(depth: u8, families: &[u8; 3], z_order: u64) -> u64 {
    let depth_bucket  = (depth / 2) as u64;
    let family_hash   = ((families[0] as u64) << 8)
                      | ((families[1] as u64) << 4)
                      |  (families[2] as u64);
    let z_bucket      = z_order >> 4;

    (depth_bucket  << 52)   // bits 52-63: depth bucket (4 bits)
  | (family_hash   << 40)   // bits 40-51: family hash  (12 bits)
  | (z_bucket      & 0xFFFFFFFFFFFF) // bits 0-39: z bucket (40 bits)
}
```

This key fits in a u64 — the same width as the universe-wasm QJL key.
HashMap<u64, CachedTransform> is the cache. No extra deps, no ORM, no overhead.

---

## What Gets Cached: CachedTransform

```rust
struct CachedTransform {
    /// The best rule found for this bucket at time of caching
    transform: TransformType,

    /// Effective weight when cached (may have decayed since — caller must check)
    cached_weight: f32,

    /// Grammar engine tick when this cache entry was written
    cached_at_tick: u64,

    /// How many times this cache entry has been hit (for eviction priority)
    hit_count: u32,
}

impl CachedTransform {
    /// Is this cache entry still trustworthy?
    /// If the grammar engine has run many ticks since caching,
    /// the underlying rule may have decayed significantly.
    /// Threshold: don't trust a cache entry older than 50 ticks.
    fn is_fresh(&self, current_tick: u64) -> bool {
        current_tick - self.cached_at_tick < 50
    }
}
```

---

## Cache Lifecycle

```
LOOKUP:
  1. Compute QJL key from PatternKey
  2. Check HashMap for key
  3a. Cache HIT + entry is fresh → return CachedTransform. DONE. (O(1))
  3b. Cache HIT + entry is stale → invalidate, go to MISS path
  3c. Cache MISS → run full GrammarEngine BTreeMap lookup (O(log n))
       → Store result in cache with current tick
       → Return result

REINFORCEMENT:
  1. Rule reinforce() is called (correct solve)
  2. Find all cache entries whose bucket CONTAINS the reinforced PatternKey
  3. Invalidate those entries (mark stale) — they need fresh weights
  (This is the only cache invalidation trigger)

DECAY SWEEP:
  1. Every N ticks, sweep the cache
  2. Remove entries where hit_count = 0 (never used since insertion)
  3. Remove entries where is_fresh() = false AND hit_count < 3
  (Keep popular stale entries — they'll be refreshed on next hit)
```

---

## Expected Cache Hit Rates

From universe-wasm physics (QJL): **80-90% hit rate**

For BabyZero grammar lookups, we expect lower but still strong rates:

| Scenario                              | Expected hit rate |
|---------------------------------------|-------------------|
| Same puzzle type, different instance  | 70-80%            |
| Different puzzle, same transform type | 50-70%            |
| Novel puzzle, no similar seen before  | 5-15%             |
| After 100+ training examples          | 75-85% overall    |

The cache pays for itself after the first 10-20 training examples.
Before that, it adds only a HashMap overhead (negligible).

---

## The Void Map Cache

Channel 4 (Void) has its own separate QJL cache.
Same key structure, but the PatternKey is derived from the VOID quadtree
rather than the present quadtree.

```rust
// Two caches. Same key type. Different semantic domains.
struct BabyZeroCaches {
    present_cache: HashMap<u64, CachedTransform>,   // what's there
    void_cache:    HashMap<u64, CachedTransform>,   // what's NOT there
}
```

The void cache is often HIGHER hit rate than the present cache.
Why? Because in ARC puzzles, the void shape is frequently simpler than
the object shape — more uniform, more recurring across puzzle types.
The void hits the same bucket more often.

---

## QJL + Zero-Copy: The Full Performance Chain

```
JS calls babyzero.perceive(grid_ptr, len)
  │
  ▼
[WASM linear memory — zero copy]
  │
  ├─→ Channel 1: SIMD scan → PresentBuffer (4 cells/cycle)
  │
  ├─→ Channel 4: SIMD invert → VoidBuffer  (4 cells/cycle, parallel)
  │
  ├─→ Channel 2: QuadArena build → O(n log n), arena-allocated, no malloc
  │
  └─→ Channel 3 query:
        compute QJL key →
          CACHE HIT (70-80%): return CachedTransform in O(1)
          CACHE MISS (20-30%): BTreeMap lookup O(log n) → cache result
  │
  ▼
Interference layer: perception() = (present × structure × memory × void)
  │
  ▼
JS reads result via zero-copy pointer — no serialization, no GC
```

Total latency target: **< 5ms** for a 30×30 ARC grid on a modern browser.
Most of that is the quadtree build. The cache makes grammar lookup negligible.

---

## STC As A Compression Philosophy

STC (Spatial Tolerance Compression) is the broader principle:

> "Spatial proximity implies semantic similarity, within a tolerance window."

Applied in universe-wasm: nearby particles share force vectors.
Applied in BabyZero: nearby grid regions share transform predictions.
Applied in Momentum Lab: nearby code states share error feedback.
Applied in QJL compression: nearby memory addresses share cached results.

**It's the same idea at every scale.** This is the QJL insight that spans
the whole project: you don't need to recompute what you've already computed
for something close enough.

The quadtree IS spatial tolerance compression.
The Z-order curve IS spatial tolerance compression.
The color family bucket IS spatial tolerance compression.
The decay weight IS temporal tolerance compression.

They're all the same algorithm wearing different clothes.

---

## What To Implement First

```
STEP 1: The key function
  fn qjl_cache_key(depth, families, z_order) -> u64
  Unit test: same inputs → same key. Different depth bucket → different key.

STEP 2: The cache struct
  struct BabyZeroCaches { present_cache, void_cache }
  No logic yet. Just the HashMap with a capacity pre-hint.

STEP 3: Cache lookup wrapper
  fn lookup_or_compute(cache, key, tick, grammar_engine) -> CachedTransform
  This is the only function the rest of BabyZero calls.
  All cache logic lives inside here.

STEP 4: Wire to Channel 3
  GrammarEngine::best_rule() only called on cache miss.
  Print: "Cache hit" / "Cache miss" to verify ratio.

STEP 5: Void cache
  Same as steps 1-4, but on VoidBuffer's quadtree keys.
  Verify: void cache hit rate should be >= present cache hit rate.
```

🛑 RABBIT HOLE GUARD: Do not optimize the cache before measuring it.
Build step 1-3 first. Run on 10 training examples. Print cache stats.
Only tune bucket sizes AFTER seeing actual hit/miss data.
