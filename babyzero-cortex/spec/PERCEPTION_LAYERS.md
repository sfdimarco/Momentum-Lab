# BabyZero Perception Layers
### Four Simultaneous Channels, One Visual Cortex
*From universe-wasm performance research — applied to spatial pattern cognition*

---

## The Core Problem

A brain does not process "what it sees now" and then separately look up "what it
remembers." Both happen simultaneously. The INTERFERENCE between NOW and MEMORY
IS the perception. Moiré. Two layers. One emergent pattern.

BabyZero has the same requirement: it cannot see a grid, then remember, then compare.
All four perception channels must fire in the same computational tick —
and they must KNOW how they differ from each other.

"You will need to partition this so that all layers work simultaneously
while also knowing how they differentiate." — Mook

---

## The Four Channels

```
╔══════════════════════════════════════════════════════════════╗
║  CHANNEL 1: PRESENT   ──── what is here RIGHT NOW           ║
║  CHANNEL 2: STRUCTURE ──── the spatial hierarchy             ║
║  CHANNEL 3: MEMORY    ──── what was seen before              ║
║  CHANNEL 4: VOID      ──── the negative space / black holes  ║
╚══════════════════════════════════════════════════════════════╝
           ↓         ↓          ↓          ↓
    ┌──────────────────────────────────────────┐
    │   INTERFERENCE LAYER — moiré of all 4   │
    │   This is what BabyZero "sees"           │
    └──────────────────────────────────────────┘
```

Each channel is a separate memory partition. They run in parallel.
The perception is their overlap, not their sequence.

---

## Channel 1: PRESENT
**Time horizon:** < 1ms (this frame)
**Memory partition:** Raw WASM linear buffer (zero-copy)
**Rust owner:** `PresentBuffer` — a flat `Vec<u8>` of the input grid
**Performance layer:** SIMD128 — 4 cells evaluated per clock cycle

The raw grid, decoded from its 2D array format into a flat buffer aligned for
SIMD operations. Four cells processed per cycle using packed float comparison.

```rust
// SIMD lane layout — 4 cells per SIMD128 operation
// [cell_0_value, cell_1_value, cell_2_value, cell_3_value] → [family_0..3]
// color family evaluation runs 4x wider than scalar
```

JS reads this buffer via zero-copy pointer (universe-wasm pattern):
```javascript
const ptr = babyzero.present_buffer_ptr();
const grid = new Uint8Array(wasm.memory.buffer, ptr, babyzero.grid_len());
// grid is a live view — no copy, no GC, no latency
```

**What it knows:** what values exist, where they sit, what color family each is.
**What it does NOT know:** what this pattern means, whether it's been seen before.

---

## Channel 2: STRUCTURE
**Time horizon:** < 10ms (built once per grid)
**Memory partition:** Arena-allocated quadtree (pre-reserved, no per-frame malloc)
**Rust owner:** `QuadArena` — a flat `Vec<QuadNode>` with index-based children
**Performance layer:** Barnes-Hut O(n log n) — the quadtree IS the spatial hierarchy

This is where the universe-wasm insight lands hardest: **the quadtree encoder is
already Barnes-Hut.** We are not building a separate spatial index. The GEOI
quadtree IS the spatial compression hierarchy, the same structure that gives
Barnes-Hut its O(n log n) complexity.

Uniform regions = consolidated "distant bodies" (Barnes-Hut clusters).
Split regions = "near bodies" that need full resolution.

Arena allocation means: the entire quadtree is one pre-reserved block of memory.
No malloc/free per node. No GC. The arena is allocated once at startup (or per
grid size class) and reused. Nodes are addressed by integer index, not pointer.

```rust
struct QuadArena {
    nodes: Vec<QuadNode>,  // flat, pre-allocated
    capacity: usize,       // pre-reserved based on grid size
    used: usize,           // current watermark
}

struct QuadNode {
    z_order: u64,
    depth: u8,
    dominant_value: u8,
    color_family: u8,
    node_flags: u8,
    decay_weight: f32,
    // children: [u32; 4]  — indices into arena.nodes, u32::MAX = no child
    children: [u32; 4],
}
```

**What it knows:** the spatial hierarchy, what's grouped with what, at what scale.
**What it does NOT know:** whether this structure matches a remembered pattern.

---

## Channel 3: MEMORY
**Time horizon:** hours to weeks (accumulated over solve attempts)
**Memory partition:** GrammarEngine BTreeMap (in-memory), later SQLite (on disk)
**Rust owner:** `GrammarEngine` — see ARCHITECTURE.md for the decay schema
**Performance layer:** QJL pattern caching — 60-80% of grammar lookups are cache hits

Channel 3 is where BabyZero's learning lives. It is the only channel that
persists across grids, across sessions, across days. It is the long memory.

Its interface with the other channels is the **Pattern Query**:
given a PatternKey derived from Channel 2's quadtree, look up what Channel 3
knows about grids with that structure.

The key speed insight: Channel 3 is accessed via the QJL cache (see QJL_GRAMMAR.md).
Most pattern queries hit the cache. Only novel patterns miss. Cache misses are
learning opportunities — the grammar engine extends itself.

**What it knows:** what spatial patterns mean, what transforms they predict, how
confident those predictions are right now (decay weight).
**What it does NOT know:** what is currently on screen — it only responds to queries.

---

## Channel 4: VOID
**Time horizon:** < 1ms (same frame as Channel 1)
**Memory partition:** Void Map buffer (parallel to Present buffer)
**Rust owner:** `VoidBuffer` — same size as PresentBuffer, inverted semantics
**Performance layer:** SIMD128 — computed bitwise in parallel with Channel 1

This is the critical innovation. Channel 4 is Channel 1 INVERTED.

Where Channel 1 sees objects (values 1-8), Channel 4 sees void (value 0).
Where Channel 1 builds a quadtree of what's PRESENT, Channel 4 builds a
quadtree of what's ABSENT.

**0 is a black hole.** `0! = 1`. The void has weight 1.0, not 0.0.
The shape of the void is as grammatically informative as the shape of the objects.

```rust
// Channel 4 computation — runs simultaneously with Channel 1 (SIMD)
fn compute_void_buffer(present: &[u8]) -> Vec<u8> {
    present.iter().map(|&v| if v == 0 { 255 } else { 0 }).collect()
    // 255 = "this is void, maximum weight"
    // 0   = "this is occupied, no void signal"
}

// Then Channel 4 builds its own quadtree on void_buffer
// A region is "void-uniform" if it's ALL 0s
// A region is "void-complex" if it contains both 0s and non-0s → split further
// Void regions split to DOUBLE the max depth of the present quadtree
// Because the shape of the void is often finer than the shape of the objects
```

The Channel 4 quadtree is encoded as a second GEOI stream — the Void GEOI.
It is ALWAYS generated alongside the Present GEOI, never optional.

**Why double depth for void regions?** Because in ARC puzzles, the void often
holds the precision that the answer requires. An object that's 2×2 might need
to move into a void that's shaped like a 2×2 hole — and the hole's exact
boundaries matter more than the object's. Double depth = double resolution
on what's missing.

**What it knows:** where nothing is, how large the nothing is, what shape
the nothing takes, whether the nothing changed between input and output.
**What it does NOT know:** what should fill the void. That's Channel 3's job.

---

## The Interference Layer: Moiré Perception

The four channels produce four GEOI streams per grid:
1. `present.geoi` — the objects
2. `structure.geoi` — same as present but arena-indexed (same data, different access)
3. (implicit) — Channel 3 is the Grammar Engine, not a GEOI stream
4. `void.geoi` — the negative space

BabyZero's **perception** is the overlap query:

```
For a given spatial region R at depth D:
  present_signal   = Channel 1 dominant_value at R, D
  structure_signal = Channel 2 color_family at R, D
  memory_signal    = Channel 3 effective_weight of best_rule(PatternKey(R, D))
  void_signal      = Channel 4 void_weight at R, D (0.0 if occupied, 1.0 if void)

perception(R, D) = {
    present: present_signal,
    structure: structure_signal,
    memory: memory_signal,
    void: void_signal,
    interference: memory_signal * void_signal  // ← THE KEY
}
```

The `interference` term is where the moiré lives. When memory_signal is high
(BabyZero has seen this structure before) AND void_signal is high (there's void
here), the interference says: **"I've seen this void shape before and I know
how to fill it."** That's a solve signal.

When interference is low but void_signal is high: novel void shape. Learning
opportunity. BabyZero extends Channel 3.

When interference is high but void_signal is low: the memory matches the
objects, not the void. Different kind of solve — transformation of what's there,
not filling of what's missing.

---

## How The Channels Differentiate

Each channel "knows how it differs" because it has a **temporal signature**:

```
Channel 1 (PRESENT)  :  age = 0          — this frame only
Channel 2 (STRUCTURE):  age = 0          — this grid only
Channel 3 (MEMORY)   :  age = 0 to ∞    — accumulated, decaying
Channel 4 (VOID)     :  age = 0          — this frame only, inverted

Differentiation signal: |Channel_N.age - Channel_M.age|

If Channel 1 and Channel 3 have high agreement AND age difference is large:
→ BabyZero is seeing something it has TRULY LEARNED. High confidence.

If Channel 1 and Channel 3 have high agreement but age difference is small:
→ Possibly pattern-matching on very recent data. Moderate confidence.

If Channel 4 and Channel 3 have high interference:
→ BabyZero has SEEN THIS VOID BEFORE and knows how to fill it. High confidence.
```

---

## The WASM Performance Stack — Applied to BabyZero

From universe-wasm (https://github.com/sfdimarco/universe-wasm):

| universe-wasm layer      | BabyZero equivalent                          | Gain                     |
|--------------------------|----------------------------------------------|--------------------------|
| SIMD128 float ops        | SIMD color family evaluation (4 cells/cycle) | ~4x Channel 1 + 4 speed  |
| Barnes-Hut O(n log n)    | Quadtree IS Barnes-Hut — same structure      | ~10x vs naïve scan       |
| QJL force caching        | QJL pattern caching (see QJL_GRAMMAR.md)     | 60-80% cache hits        |
| Zero-copy JS bridge      | GEOI in WASM linear memory, JS reads pointer | Zero GC, zero copy       |
| LTO + codegen-units=1    | Same release profile, same binary            | Whole-program opt        |
| Arena allocation         | QuadArena — no per-node malloc/free          | Zero GC pressure         |

These gains **multiply**, not add. A quadtree that's already O(n log n) AND uses
an arena AND avoids GC AND processes 4 cells per SIMD cycle produces the latency
profile BabyZero needs: perception that happens before consciousness catches up.

**The target:** by the time BabyZero reports what it sees, Channel 1-4 have all
already fired. The perception is already complete. The grammar lookup is the
slow part — and QJL caching is what makes THAT fast.

---

## Cargo.toml Performance Profile (Same as universe-wasm)

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"

[dependencies]
# SIMD: use std::arch or portable-simd (nightly) or packed_simd_2
# Arena: no extra dep — just Vec<QuadNode> with manual index management
# QJL cache: std::collections::HashMap<u64, CachedTransform>
# Morton: morton crate (2 lines)
```

```
RUSTFLAGS=-C target-feature=+simd128
```

For native dev builds, use `target-feature=+avx2` instead (desktop SIMD).
For WASM production builds, switch to `+simd128`.
Keep a feature flag: `cfg(target_arch = "wasm32")` selects the right SIMD path.

---

## Phase Build Order (Simultaneous Channels)

Channels are NOT built sequentially. They are built in parallel tracks
that converge when the interference layer is ready:

```
Track A (PRESENT + VOID):
  A1. Implement PresentBuffer (flat u8 Vec)
  A2. Implement VoidBuffer (inverted, SIMD)
  A3. Wire both to p5.js harness → see objects AND void simultaneously
  ── A is done when the harness shows cyan void as BRIGHT, not invisible ──

Track B (STRUCTURE):
  B1. Implement QuadArena (pre-allocated)
  B2. Implement quadtree builder from PresentBuffer
  B3. Add void quadtree builder from VoidBuffer (double depth)
  ── B is done when the ASCII tree shows void regions at deeper depth ──

Track C (MEMORY):
  C1. Implement GrammarRule + decay (see ARCHITECTURE.md — soul first)
  C2. Implement GrammarEngine BTreeMap
  C3. Implement basic pattern extraction from Channel B's quadtree
  ── C is done when a rule can be inserted, decayed, and retrieved ──

Track D (INTERFERENCE):
  D1. Implement perception(R, D) query across all three live channels
  D2. Wire to p5.js: highlight regions with high interference score
  ── D is done when BabyZero can highlight "I've seen this void before" ──
```

Tracks A and B can start in parallel immediately.
Track C can start as soon as Track B produces PatternKeys.
Track D requires A, B, and C to have their basic APIs.
