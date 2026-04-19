# GEOI Format Specification
### GEO Image — Binary Quadtree Snapshot Format
**Version:** 1.0  
**Status:** Canonical draft — language before types  
**Author:** Mook + The Council (April 2026)

---

## What Is GEOI?

GEOI is a binary stream format for encoding a 2D grid (like an ARC puzzle) as a
recursive quadtree, where each node carries spatial position, color family,
and a decay weight.

It is NOT a video format. It is NOT a pixel format. It is a **compressed
structural description** of what is spatially meaningful in a grid — the way
an eye encodes a scene into regions of interest, not raw photons.

A GEOI file answers the question: *"What is this grid made of, where are the
things, and how much does BabyZero currently trust what it sees?"*

---

## Core Concepts (Language First)

### The Grid
The input is always a 2D rectangular array of integer values from 0 to 9.
These are not "pixels" — they are **semantic tokens** with synesthetic color identity:

| Value | Color  | Meaning                                        |
|-------|--------|------------------------------------------------|
| 0     | Cyan   | BLACK HOLE — negative space with weight 1.0    |
| 1     | Red    | High-energy, focal point                       |
| 2     | Blue   | Structural, cold pair                          |
| 3     | Yellow | Bright, primary signal                         |
| 4     | Green  | Growth, organic, complex                       |
| 5     | Orange | Warm structural                                |
| 6     | Purple | Deep, diagonal relationship                    |
| 7     | Pink   | Soft outlier                                   |
| 8     | White  | Boundary / flood fill                          |
| 9     | Black  | Ground state — suppress                        |

This map is NOT decoration. It is the encoding grammar. BabyZero reasons in
color families, not integer comparisons.

**Critical law: 0 is NOT a passthrough. 0 is a black hole.**

`0! = 1` — zero factorial equals one. Zero has multiplicative weight 1.0, not 0.0.
A region of 0s is not empty. It is a void with SHAPE, MASS, and GRAVITATIONAL
PULL on the grammar engine. The absence IS the information.

In ARC puzzles, the shape of the 0-void frequently IS the answer.
An object moving to "fill" a 0-void. A reflection across a 0-axis.
A duplication that "completes" the negative space. BabyZero that cannot
see negative space is blind to half the puzzle.

Value 9 (Black) is true ground — it suppresses because it has no perceptual
weight in Mook's synesthetic model. Value 0 (Cyan) suppresses visually in
naive renderers, but in BabyZero's grammar it ATTRACTS, it DEFINES, it SHAPES.

### The Quadtree
The quadtree recursively divides the grid into four quadrants (TL, TR, BL, BR).
A region stops splitting when it is **semantically uniform** — meaning it
contains only one color family. A region splits when it contains multiple
color families that are semantically distinct.

Uniformity is judged by **color family variance**, not pixel variance.
A region with values [0, 0, 0, 0] is uniform even if the integers differ slightly.
A region with values [0, 0, 1, 0] is NOT uniform — it contains a red intruder.

### The Z-Order Stream (Morton Encoding)
Once the quadtree is built, nodes are serialized into a 1D stream using the
Morton Z-order curve. The Z-order curve interleaves the binary bits of X and Y
coordinates, producing a 1D index that preserves **spatial locality**:
nodes that are close in 2D space stay close in the stream.

This is critical: BabyZero reads the stream as a spatial narrative.
Nodes near each other in the stream are near each other in the grid.

**Z-order is not perfect.** It preserves horizontal and vertical adjacency
well, but can be "blind" to diagonal adjacency. Two points at (0,1) and (1,0)
— diagonal neighbors — can end up far apart in Z-order. ARC puzzles frequently
test diagonal transformations. The Diagonal Index (see below) compensates.

### The Diagonal Index
After Z-order serialization, a secondary pass identifies pairs of leaf nodes
that are diagonally adjacent in the original grid but non-adjacent in the
Z-order stream. These pairs are stored separately as the Diagonal Index.

Rule: two leaf nodes are diagonal neighbors if their 2D positions differ by
(±1, ±1) AND they are not already Z-order adjacent.

BabyZero reads the Diagonal Index as "hidden spatial relationships" —
the under-currents of the grid that Z-order alone can't see.

### Decay Weight
Every node carries a `decay_weight` — a float from 0.0 to 1.0 that represents
BabyZero's current confidence in the grammar rule associated with this node.

- **1.0** = this pattern was just reinforced. BabyZero trusts it completely.
- **0.5** = this pattern was reinforced a while ago. Trust is fading.
- **0.0** = this pattern has decayed to noise. BabyZero ignores it.

Decay weight is stored in the GEOI snapshot at capture time.
It is NOT computed on read — it is a point-in-time record.

### GEO Rule Binding
Each GEOI file optionally records the name of the GEO grammar rule set that
was active when the snapshot was taken. This creates an auditable link between:
- What the grid looked like (the snapshot)
- What behavior was running (the rule set)
- What BabyZero was thinking (the grammar engine state)

A GEOI file without a rule binding is still valid — it is a pure structural snapshot.
A GEOI file WITH a rule binding is an **episodic memory** — a moment in BabyZero's learning.

---

## Binary Layout

All multi-byte integers are little-endian.

### Header (16 bytes)
```
Offset  Size  Type    Field              Description
------  ----  ------  -----              -----------
0       4     u8[4]   magic              Always "GEOI" = [0x47,0x45,0x4F,0x49]
4       1     u8      version            Format version. Currently 1.
5       2     u16     width              Grid width in cells (max 65535)
7       2     u16     height             Grid height in cells (max 65535)
9       1     u8      depth_max          Maximum quadtree recursion depth (1–16)
10      1     u8      color_map_id       0 = Mook's synesthetic map (only option in v1)
11      1     u8      flags              Bit flags (see below)
12      4     u32     geo_rule_hash      CRC32 of the GEO rule name. 0x00000000 = none.
```

**Header flags (byte 11):**
```
Bit 0  HAS_DIAGONAL_INDEX   1 = Diagonal Index section is present after node stream
Bit 1  HAS_DECAY_WEIGHTS    1 = Each node carries a decay_weight field
Bit 2  BACKGROUND_DETECTED  1 = Header contains detected background value
Bits 3-7: reserved, must be 0
```

If `BACKGROUND_DETECTED` is set, byte 16 (the first byte after the 16-byte header)
holds the detected background value (u8, 0–9) before the node stream begins.

### Node Stream
Each node is a fixed 12-byte record (when HAS_DECAY_WEIGHTS is set):
```
Offset  Size  Type   Field           Description
------  ----  ----   -----           -----------
0       8     u64    z_order         Morton Z-order code for this node's position
8       1     u8     depth           Recursion depth. 0 = root.
9       1     u8     dominant_value  ARC value (0–9) that dominates this region
10      1     u8     node_flags      Per-node flags (see below)
11      1     u8     color_family    GEO loop family this color maps to (0=Y_LOOP etc.)
```

When `HAS_DECAY_WEIGHTS` is set, each node has an additional 4 bytes:
```
12      4     f32    decay_weight    Current confidence: 0.0 (forgotten) to 1.0 (fresh)
```
Making each node 16 bytes when decay weights are included.

**Per-node flags (byte 10):**
```
Bit 0  IS_BACKGROUND    This node is the detected background color (value 9)
Bit 1  IS_LEAF          This node did not split (uniform region)
Bit 2  IS_DIAGONAL_SRC  This node appears in the Diagonal Index as a source
Bit 3  IS_GATE_OFF      This node is true-suppressed (value 9 / black ground)
Bit 4  IS_BLACK_HOLE    This node is value 0 — void with gravitational weight
Bit 5  IS_VOID_MAP      This node is part of the void map (0-region structure)
Bits 6-7: reserved
```

IS_BLACK_HOLE and IS_GATE_OFF are mutually exclusive.
IS_BLACK_HOLE nodes are never suppressed — they are always encoded, always weighted.

### Diagonal Index (optional, present if HAS_DIAGONAL_INDEX flag is set)
```
Offset  Size   Type    Field      Description
------  ----   ----    -----      -----------
0       4      u32     count      Number of diagonal pairs
4       count  u64[2]  pairs      Array of (z_order_a, z_order_b) pairs
```

Each pair represents two leaf nodes that are diagonally adjacent in the original
grid but whose Z-order codes are not adjacent (differ by more than 1 after
accounting for depth).

---

## Color Family Mapping

BabyZero maps ARC values to GEO loop families for pattern grammar:

| ARC Value | Color  | GEO Family  | Why                                               |
|-----------|--------|-------------|---------------------------------------------------|
| 0         | Cyan   | BLACK_HOLE  | Void — gravitational weight 1.0, double-depth     |
| 1         | Red    | Y_LOOP      | Single active quadrant — focal point              |
| 2         | Blue   | X_LOOP      | Adjacent pair — structural relationship           |
| 3         | Yellow | Y_LOOP      | Another single — high signal                      |
| 4         | Green  | Z_LOOP      | Three-quadrant — complex, growing                 |
| 5         | Orange | X_LOOP      | Adjacent pair — warm structural                   |
| 6         | Purple | DIAG_LOOP   | Diagonal pair — hidden relationship               |
| 7         | Pink   | DIAG_LOOP   | Diagonal pair — soft outlier                      |
| 8         | White  | GATE_ON     | Full — boundary or flood fill                     |
| 9         | Black  | GATE_OFF    | Ground — true suppression, no perceptual weight   |

**BLACK_HOLE** is a new GEO family added for BabyZero. It behaves differently
from GATE_OFF in every way that matters:

| Property              | GATE_OFF (value 9)        | BLACK_HOLE (value 0)               |
|-----------------------|---------------------------|------------------------------------|
| Grammar weight        | 0.0 — ignored             | 1.0 — maximum                      |
| Quadtree split depth  | Stops splitting early     | Splits to DOUBLE max depth         |
| Void map inclusion    | No                        | Yes — shapes the void map          |
| Diagonal index        | Never a source            | Always checked as a source         |
| Reinforcement signal  | Never reinforces          | Reinforces when void is "filled"   |

This mapping is version-locked to color_map_id = 0. Future versions may define
alternate mappings for different puzzle types.

---

## What GEOI Does NOT Encode
- Raw pixel values (the original grid is not stored — only the quadtree structure)
- Transformation rules (those live in the Grammar Engine, not the snapshot)
- Time sequence (each GEOI is a single snapshot — sequences are collections)
- Object identity (BabyZero assigns identity from grammar, not from GEOI)

---

## Example (3×3 Grid)

Input grid:
```
9 9 9
9 1 9
9 9 9
```
Value 9 (Black/GATE_OFF) is background. Value 1 (Red/Y_LOOP) is the object.

Expected quadtree behavior:
- Root node (depth=0): contains both 9 and 1 → SPLITS
- TL (depth=1): all 9s → LEAF, IS_BACKGROUND, GATE_OFF
- TR (depth=1): all 9s → LEAF, IS_BACKGROUND, GATE_OFF
- BL (depth=1): all 9s → LEAF, IS_BACKGROUND, GATE_OFF
- BR (depth=1): contains 9 and 1 → SPLITS
  - BR.TL (depth=2): value=9 → LEAF, IS_BACKGROUND
  - BR.TR (depth=2): value=9 → LEAF, IS_BACKGROUND
  - BR.BL (depth=2): value=9 → LEAF, IS_BACKGROUND
  - BR.BR (depth=2): value=1 → LEAF, dominant=1, color_family=Y_LOOP ← THE OBJECT

BabyZero "sees": one small red Y_LOOP node isolated in the lower-right quadtree
branch, surrounded by suppressed background. That IS the object. That IS the signal.

---

## Versioning

The `version` byte in the header controls which fields are valid.
- v1: All fields above. Diagonal Index optional. Decay weights optional.
- v2 (planned): Named object identity table after Diagonal Index.
- v3 (planned): Transform history log appended to node records.

Never break v1 compatibility. Add fields only via new optional sections
controlled by header flags.
