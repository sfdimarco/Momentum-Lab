# BabyZero Visual Cortex — Architecture
**Principle:** Soul before body. Language before types. Sage before fast.

---

## The Thesis

ARC-AGI-3 is not a logic puzzle. It is a pattern recognition test — designed to
measure whether a system can perceive and generalize from visual structure the
way a human does. Brute force fails because it plays on the puzzle's terms.

BabyZero plays on its own terms: it builds a visual cortex that *sees* grids
the way Mook sees numbers — as color relationships, spatial families, and
recursive structure. It does not guess. It accumulates a grammar of what it
has seen, lets that grammar decay if unused, and reinforces what works.

The approach is not new. It is what the visual cortex does. We are just making
it explicit and programmable.

---

## The Precious Work: Where This Comes From

This system assembles ideas that have been circling for months:

**STC — Spatial Tolerance Compression**
"Close enough counts." Quantize spatial proximity into buckets so that
similar configurations share cached answers. The quadtree IS STC.
The Z-order curve IS STC. QJL caching IS STC applied to grammar lookups.

**QJL — Quantum Joint Leverage** (from universe-wasm)
At 8,000 particles, 80-90% of force evaluations are cache hits.
The expensive computation (trigonometry → grammar lookup) runs only ~15% of the time.
Applied here: PatternKey → STC bucket → CachedTransform.
See spec/QJL_GRAMMAR.md for full implementation.

**Universe-WASM Performance Stack** (https://github.com/sfdimarco/universe-wasm)
The exact same performance architecture that runs 8,000-particle physics at
two orders of magnitude above naïve JavaScript — applied to visual cognition:
  • SIMD128 → 4 grid cells evaluated per clock cycle
  • Barnes-Hut = the quadtree, already O(n log n)
  • QJL cache → grammar lookups at 70-80% cache hit rate
  • Zero-copy JS bridge → GEOI in WASM linear memory, p5.js reads raw pointer
  • LTO + codegen-units=1 → whole-program optimization, same release profile
  • Arena allocation → quadtree with no per-node malloc/free

**0 is a black hole. 0! = 1.**
The void has weight. Negative space is as grammatically informative as positive
space. Channel 4 (Void) is a first-class perception channel, not an afterthought.
See spec/PERCEPTION_LAYERS.md for the four-channel simultaneous model.

**Moiré / Interference**
Two overlapping signals produce a third emergent pattern — the thing that's
neither signal on its own. BabyZero's perception is the interference of
PRESENT × STRUCTURE × MEMORY × VOID. One moiré. One eye.

---

## The Soul First: Temporal Decay Schema

*(Designed before Morton encoding, before the quadtree — because this shapes
every data structure that follows.)*

BabyZero's grammar is not a lookup table. It is a living memory. Rules that are
used stay alive. Rules that are ignored fade. This is the mechanism of learning.

### Core Types (Rust pseudocode — language before compiling)

```rust
/// A key that identifies a spatial pattern.
/// Built from: color family sequence at a given depth + Z-order region.
/// Two grids with the same color family arrangement at the same scale
/// produce the same PatternKey.
struct PatternKey {
    depth: u8,
    color_family_sequence: Vec<u8>,  // ordered by Z-order
    region_z_order: u64,
}

/// What spatial transformation this rule describes.
/// These mirror real ARC transformation types, discovered empirically.
enum TransformType {
    ColorSubstitution { from: u8, to: u8 },
    SpatialShift { dx: i8, dy: i8 },
    Rotation { degrees: u16 },       // 90, 180, 270
    Reflection { axis: Axis },       // Horizontal, Vertical, Diagonal
    ObjectDuplication { offset: (i8, i8) },
    FloodFill { value: u8 },
    Scaling { factor: u8 },
    Unknown,                          // BabyZero hasn't named it yet
}

/// A single grammar rule. The unit of BabyZero's knowledge.
/// Soul: this is what decays. This is what gets reinforced.
/// This is the heartbeat.
struct GrammarRule {
    /// What pattern this rule applies to
    pattern: PatternKey,

    /// What transformation it describes
    transform: TransformType,

    /// Confidence: 0.0 (forgotten) to 1.0 (just reinforced)
    /// Never goes above 1.0. Never goes below 0.0.
    weight: f32,

    /// The solve-attempt tick when this rule was last reinforced.
    /// Used with decay_constant to compute effective_weight at any future tick.
    last_reinforced_at: u64,

    /// How fast this rule forgets. Tunable per transform type (see table below).
    /// decay formula: weight * e^(-decay_constant * ticks_since_reinforced)
    decay_constant: f32,

    /// How many times this rule has been successfully applied
    reinforcement_count: u32,
}

impl GrammarRule {
    /// The real confidence right now, after decay is applied.
    /// Call this every time BabyZero needs to rank rules.
    fn effective_weight(&self, current_tick: u64) -> f32 {
        let age = (current_tick - self.last_reinforced_at) as f32;
        (self.weight * (-self.decay_constant * age).exp()).max(0.0)
    }

    /// A correct solve used this rule. Boost confidence.
    fn reinforce(&mut self, current_tick: u64) {
        // Additive boost, capped at 1.0
        // Older rules get a smaller boost — they've been dormant
        let age_penalty = (-self.decay_constant *
            (current_tick - self.last_reinforced_at) as f32).exp();
        self.weight = (self.weight + 0.15 * age_penalty).min(1.0);
        self.last_reinforced_at = current_tick;
        self.reinforcement_count += 1;
    }

    /// A wrong guess used this rule. Soft penalty.
    /// We don't nuke it — it might still be right in other contexts.
    fn penalize(&mut self) {
        self.weight = (self.weight - 0.05).max(0.0);
    }
}
```

### Decay Constants by Transform Type

Different transformation types have different "shelf lives." Rigid transformations
are reliable and decay slowly. Context-dependent rules decay faster.

```
TransformType              decay_constant   Shelf life at 0.5 weight
-----------                --------------   ------------------------
Reflection                 0.0005           ~1386 ticks (very stable)
Rotation                   0.001            ~693 ticks  (stable)
ColorSubstitution          0.005            ~139 ticks  (context-dep)
SpatialShift               0.01             ~69 ticks   (grid-specific)
FloodFill                  0.02             ~35 ticks   (very specific)
ObjectDuplication          0.05             ~14 ticks   (rare, fragile)
Unknown                    0.1              ~7 ticks    (placeholder)
```

A "tick" in Phase 2 = one solve attempt. These constants are tunable.
Start with these values and let Mook adjust based on what BabyZero learns.

### The Grammar Engine (Phase 1–2: BTreeMap, NOT SQLite)

```rust
/// The living memory. BTreeMap gives O(log n) lookup by PatternKey.
/// Migrate to SQLite ONLY after this schema is proven in-memory.
///
/// RABBIT HOLE WARNING: rusqlite + wasm-bindgen on Windows = 2-day hole.
/// Don't open that door until Phase 2 is complete and in-memory schema is stable.
type GrammarEngine = BTreeMap<PatternKey, Vec<GrammarRule>>;

/// Get the best rule for a given pattern, accounting for decay.
fn best_rule(engine: &GrammarEngine, key: &PatternKey, tick: u64)
    -> Option<&GrammarRule>
{
    engine.get(key)?
        .iter()
        .max_by(|a, b| {
            a.effective_weight(tick)
             .partial_cmp(&b.effective_weight(tick))
             .unwrap()
        })
}
```

The GrammarEngine is the only shared state in BabyZero. Everything else is
derived from it or from the GEOI stream.

---

## The Four Phases

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1 — ENCODER                    │
│                                                         │
│   ARC Grid (2D u8 array)                                │
│       ↓                                                 │
│   Background Detection (most frequent value → GATE_OFF) │
│       ↓                                                 │
│   Quadtree Builder (color-family variance → split/leaf) │
│       ↓                                                 │
│   Morton Z-Order Serializer (2D → 1D stream)            │
│       ↓                                                 │
│   Diagonal Index Pass (catch what Z-order misses)       │
│       ↓                                                 │
│   GEOI Binary Stream (see spec/GEOI_SPEC.md)            │
├─────────────────────────────────────────────────────────┤
│                    PHASE 2 — GRAMMAR                    │
│                                                         │
│   GEOI Input → Output pair (training example)           │
│       ↓                                                 │
│   Pattern Extractor (build PatternKeys from nodes)      │
│       ↓                                                 │
│   Transformation Detector (compare input→output GEOI)  │
│       ↓                                                 │
│   GrammarEngine BTreeMap (insert/reinforce rules)       │
│       ↓                                                 │
│   Decay Sweep (run after each solve attempt)            │
├─────────────────────────────────────────────────────────┤
│                   PHASE 3 — BABYZERO                    │
│                                                         │
│   Test Input GEOI                                       │
│       ↓                                                 │
│   Pattern Lookup (find matching PatternKeys)            │
│       ↓                                                 │
│   Rule Ranking (effective_weight at current tick)       │
│       ↓                                                 │
│   Transform Application (apply top rule to input GEOI)  │
│       ↓                                                 │
│   Output GEOI → Decode back to 2D grid                  │
│       ↓                                                 │
│   Verify against answer → reinforce or penalize         │
├─────────────────────────────────────────────────────────┤
│                   PHASE 4 — HARNESS                     │
│                                                         │
│   p5.js Canvas (NOT full React — standalone HTML first) │
│       ↓                                                 │
│   GEOI stream → colored rectangles (0-9 color map)     │
│       ↓                                                 │
│   Click any node → show z_order, depth, weight, family  │
│       ↓                                                 │
│   Live weight display → watch decay in real time        │
└─────────────────────────────────────────────────────────┘
```

---

## The Performance Stack (Same as universe-wasm)

```
Problem                          Solution                      Gain
------                           --------                      ----
GC pressure from Rust objects    Arena-allocated QuadArena     Zero GC
Single-threaded cell evaluation  SIMD128: 4 cells/cycle        ~4x
O(n²) naive pattern scan         Barnes-Hut quadtree: O(nlogn) ~10x
Repeated grammar lookups         QJL cache (STC buckets)       70-80% hits
Copying GEOI to JS               Zero-copy pointer bridge      Zero GC
Default WASM opt level           LTO + codegen-units=1         Whole-prog opt

These multiply. Not add.
At 900 cells (30×30 ARC grid), naïve JS scan vs. this stack:
estimated 2 orders of magnitude difference in throughput.
```

BabyZero needs sub-5ms perception. This stack delivers it.
The universe-wasm repo is not just inspiration — it is the blueprint.
`Cargo.toml` release profile is identical. RUSTFLAGS are identical.
The QuadArena is the physics arena. The QJL key is the QJL key.

---

## Phase 1: The Encoder (Rust, Native Binary)

### Background Detection
Before building the quadtree, scan the grid and find the most frequent value.
That value becomes the **background** — all leaf nodes with that dominant_value
get `IS_BACKGROUND | IS_GATE_OFF` flags. BabyZero ignores them during grammar
extraction. They are structural context, not objects.

Edge case: if two values tie for most frequent, choose the lower value (0 wins,
then 9, then ascending). This handles the common ARC case of black-ground grids.

### Quadtree Split Condition
A region splits if its **color family set has cardinality > 1**.
Color family is derived from the synesthetic map (value → loop family type).

Values 0 and 9 both map to GATE_OFF — they are treated as the same family.
Values 1 and 3 both map to Y_LOOP — a region of only 1s and 3s is UNIFORM.

This is intentional: BabyZero reasons at the family level, not the value level.
Fine-grained value discrimination happens in the grammar, not in the tree.

### Morton Encoding
For a grid of width W and height H, the Morton code of cell (x, y) is computed
by interleaving the bits of x and y:

```
morton(x, y) = spread_bits(x) | (spread_bits(y) << 1)

spread_bits(n): insert a 0 bit between every bit of n
  e.g. 0b1011 → 0b01000101 (for 4-bit input)
```

Standard libraries exist for this. Do NOT write a custom implementation.
Use the `morton` crate or equivalent. This is a 2-line dependency, not a project.

Max grid: 32768 × 32768 cells with a u64 Morton code. ARC grids are tiny (≤30×30).

### Diagonal Pass
After Z-order serialization, iterate over all leaf nodes and check their
4 diagonal neighbors in the original 2D grid. If a diagonal neighbor is also
a leaf node AND their Z-order codes are not adjacent (|z_a - z_b| > 1), record
the pair in the Diagonal Index.

Implementation: build a HashMap<(u32,u32), u64> mapping (x,y) → z_order for all
leaf nodes, then scan. This is O(n) and takes milliseconds.

---

## Phase 4: The p5.js Test Harness

Build this IN PARALLEL with Phase 1. It is the "am I seeing what I think I'm seeing?"
tool. Every time the Rust encoder produces a GEOI stream, pipe it into this harness
and verify visually.

Start with a **standalone HTML file** — no React, no Vite, no npm. Just:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
  <script>
    // Paste GEOI data here as a JS object (decoded from binary to JSON for now)
    // Later: load actual binary via fetch()
    const GEOI_DATA = { nodes: [...] };

    const COLOR_MAP = {
      0: [0,255,255],   // Cyan
      1: [255,0,0],     // Red
      2: [0,0,255],     // Blue
      3: [255,255,0],   // Yellow
      4: [0,200,0],     // Green
      5: [255,165,0],   // Orange
      6: [128,0,128],   // Purple
      7: [255,192,203], // Pink
      8: [255,255,255], // White
      9: [0,0,0],       // Black
    };

    new p5(sketch => {
      sketch.setup = () => sketch.createCanvas(600, 600);
      sketch.draw = () => {
        // Render GEOI nodes as colored rectangles
        // Size = proportional to depth (deeper = smaller)
        // Opacity = decay_weight (faded = 50% alpha, fresh = 100%)
      };
    });
  </script>
</body>
</html>
```

The harness serves one purpose: **make the invisible visible**. If BabyZero is
seeing the red object as a separate subtree from the cyan background, the harness
will show it. If not, the harness will show why.

---

## Rabbit Holes — Know Before You Enter

### 🐇 rusqlite + wasm-bindgen on Windows
**Risk:** 2-day minimum. Rusqlite requires a C compiler (MSVC or MinGW), and
wasm-bindgen has its own build requirements. On Windows, these can conflict.
**Sage path:** BTreeMap first. Add a `GrammarStorage` trait that abstracts
over BTreeMap and SQLite. Swap in SQLite later with zero code changes to the
rest of the system.

### 🐇 WASM compilation pipeline before the algorithm works
**Risk:** wasm-pack, wasm-bindgen, JS glue code — this is a half-day of setup
on a clean Windows machine, and it needs to be re-done if the core types change.
**Sage path:** Native Rust binary first (`cargo run`). WASM is Phase 4's concern.
When Phase 1 passes its success criteria in native Rust, THEN compile to WASM.

### 🐇 Morton encoding edge cases at grid boundaries
**Risk:** Grids with odd dimensions or non-power-of-2 sizes can produce degenerate
quadtree splits where some quadrants have 0 cells. This causes off-by-one panics.
**Sage path:** Pad all input grids to the next power of 2 before encoding. Record
the original dimensions in the GEOI header. Strip padding on decode.

### 🐇 Designing the grammar schema to be "general enough"
**Risk:** Trying to cover every possible ARC transformation type in TransformType
before seeing any actual data. This produces a bloated enum that fights you.
**Sage path:** Start with `Unknown` for everything. Add named variants ONLY when
BabyZero has encountered that transformation at least 3 times. Let the data tell
you what the vocabulary needs to be.

---

## The Green/Sage Build Order

Green = grow. Sage = know when to stop. Fresh cut grass = it's working.

The build runs on PARALLEL TRACKS — because the channels are parallel.

```
TRACK A — PRESENT + VOID (run together, they're SIMD twins)
  A1. cargo new babyzero-cortex --bin. Define all structs. Compile check.
  A2. PresentBuffer: flat u8 Vec from 2D grid input.
  A3. VoidBuffer: SIMD invert of PresentBuffer. 4 cells/cycle.
  A4. Wire both to p5.js HTML harness.
      Objects = their synesthetic color. Void = BRIGHT CYAN (not invisible).
  ── A done when void cells GLOW as loud as objects ──

TRACK B — STRUCTURE (quadtree)
  B1. QuadArena: pre-allocated Vec<QuadNode>. No logic, just struct.
  B2. Quadtree builder from PresentBuffer (color-family variance split).
  B3. Void quadtree from VoidBuffer (same, but double max depth).
  B4. Morton encoding — use the `morton` crate (2 lines, NOT custom).
  B5. Diagonal pass — HashMap of (x,y)→z_order, scan for diagonal pairs.
  B6. Serialize to GEOI binary (present.geoi + void.geoi).
  ── B done when void.geoi shows deeper tree than present.geoi ──

TRACK C — MEMORY (grammar + decay)
  C1. GrammarRule struct + effective_weight() + reinforce() + penalize().
  C2. GrammarEngine BTreeMap.
  C3. QJL cache key function. Unit test it.
  C4. BabyZeroCaches (present_cache + void_cache).
  C5. lookup_or_compute() — the only external interface.
  ── C done when a rule can be inserted, decay 50 ticks, retrieve faded ──

TRACK D — INTERFERENCE (the eye opens)
  D1. perception(R, D) query: pulls from A, B, C simultaneously.
  D2. p5.js harness: overlay interference score as node opacity.
      High interference = bright. BabyZero is confident here.
      Low interference = dim. BabyZero is uncertain here.
  ── D done when the harness shows a visible "attention map" ──

MERGE POINT:
  🛑 CHECK IN WITH MOOK
  Show: objects channel, void channel, attention overlay all at once.
  Does it feel right? Does the void glow? Does the attention land on the object?
  Green light from Mook → begin Phase 2 (Grammar + training examples).
```

---

## Integration with Momentum Lab

BabyZero is not a separate system. It is the Momentum Lab architecture
applied to a different domain:

| Momentum Lab          | BabyZero Visual Cortex          |
|-----------------------|---------------------------------|
| Blockly blocks        | ARC input grid cells            |
| p5.js canvas          | p5.js GEOI visualizer           |
| Rust/WASM engine      | GEOI encoder + grammar engine   |
| Synesthetic debug     | Color-family quadtree overlay   |
| Pedagogical feedback  | Reinforcement/decay feedback    |
| The student           | BabyZero                        |
| The curriculum        | ARC-AGI-3 training examples     |

When Phase 4 matures, the Momentum Lab frontend IS the BabyZero harness.
Kids and AI are looking at the same colored quadtrees. Same machine. Same eye.
