# Project Baby IO — The Sisyphus & The Librarian Protocol
### Cognitive Blueprint v1.0
**Date:** 2026-04-06
**GEO Spec:** Live (fetched from GitHub master 2026-04-06)
**Status of baby agents:** baby_0 + baby_1 LIVE, 350+ patterns cached, real canvas confirmed

---

## The Philosophy in One Sentence

> *Sisyphus pushes the rock up the hill. The Librarian doesn't help push —*
> *it memorizes the path so the hill gets shorter every time.*

---

## Where We Are Right Now

```
baby_0 / baby_1
  ↓ sample canvas pixels
  ↓ compute delta → fire reward
  ↓ cache pattern as GEO quadtree address
  ↓ confidence: 0.0 → orange (0.7) → pink (≥0.7)
  ❌ CYAN STATE not yet defined (confidence ≥ 0.9 → LibraryEntry)
  ❌ No geometry→code translation
  ❌ No co-pilot feedback to Sisyphus
```

The Sisyphus & Librarian Protocol fills those three gaps.

---

## RainbowBrain Color Map (NON-NEGOTIABLE)

The Librarian speaks in color, not text. Every state has a synesthetic signature.

| Color  | Hex       | State                              | GEO Equivalent |
|--------|-----------|------------------------------------|----------------|
| Cyan   | #00ffff   | **CYAN STATE** — Aha! Promotion    | 0 / GATE_OFF   |
| Red    | #ff3333   | Frustration / struggle             | mask=1 / 1=BL  |
| Blue   | #3b82f6   | Active exploration / Bezier wave   | X_LOOP         |
| Yellow | #eab308   | Curiosity hotspot / entropy peak   | Y_LOOP emerging|
| Green  | #22c55e   | Reward firing                      | GATE_ON moment |
| Orange | #f97316   | Pattern building / confidence 0.4+ | Partial Y_LOOP |
| Pink   | #ec4899   | Stable known pattern (conf ≥ 0.7)  | Z_LOOP locked  |
| White  | #ffffff   | Current focus / attention center   | Depth 0 root   |
| Black  | #000000   | Forgotten / gated                  | GATE_OFF held  |

---

## Phase A — The Observation & Caching Mechanism
### *"How the Librarian hears the Aha!"*

### Current State of the patternCache

```typescript
// In baby_agent.ts today:
patternCache: Map<string, {
  address: string[],    // GEO quadtree path ["TL","TR","BR"]
  confidence: number,   // 0.0 → 1.0
  lastSeen: number,     // tick
  hitCount: number      // how many times revisited
}>
```

### The Cyan State Event

When confidence reaches **0.9** on any cached pattern, the Librarian has its Aha! moment.
This is NOT just a threshold — it's a state transition. The pattern is PROMOTED.

```typescript
// New interface — the promoted pattern
interface LibraryEntry {
  id: string;              // SHA-like hash of address path e.g. "TL-TR-BR-TL"
  address: string[];       // GEO quadtree path (the stone's trajectory)
  confidence: number;      // ≥ 0.9 at promotion, continues strengthening
  promotedAt: number;      // tick when first promoted
  deltaSignature: number;  // avg pixel delta that earned this — the "weight" of the stone
  loopFamily: GEOFamily;   // inferred (see below) — Y/X/Z/DIAG/GATE
  codeHint: string | null; // Phase B fills this
  visitCount: number;      // how many times Sisyphus has passed through this zone
  cyanFlashFired: boolean; // has SpatialEye already shown the promotion flash?
}

type GEOFamily = 'Y_LOOP' | 'X_LOOP' | 'Z_LOOP' | 'DIAG_LOOP' | 'GATE_ON' | 'GATE_OFF';

// New field on RuntimeBrain:
libraryCache: Map<string, LibraryEntry>;
```

### The Promotion Event (fires in BabyAgent.tick())

```typescript
// Add to tick() after confidence is updated:
if (pattern.confidence >= 0.9 && !libraryCache.has(patternKey)) {
  const entry = promoteToLibrary(pattern);
  libraryCache.set(patternKey, entry);
  // Tell SpatialEye to fire CYAN_FLASH at this pattern's quadrant
  this.emit('CYAN_EVENT', entry);
}
```

### Inferring the GEO Loop Family from a Quadtree Path

This is the core mapping — the path shape IS the loop family signature.

```
Path Analysis Algorithm:

1. Count unique quadrants in the address:
   - 1 unique quadrant → Y_LOOP (single rotating quadrant)
   - 2 unique quadrants:
       - Adjacent (TL+TR, TR+BR, BR+BL, BL+TL) → X_LOOP (adjacent pair)
       - Diagonal (TL+BR, TR+BL)                → DIAG_LOOP (diagonal toggle)
   - 3 unique quadrants → Z_LOOP (three-quadrant sweep)
   - 4 unique quadrants → GATE_ON (full occupation — all quadrants active)
   - 0 (no delta) → GATE_OFF (stone is still — frozen)

2. Weight by depth:
   - depth 1-2: macro-level family (coarse understanding)
   - depth 3-5: mid-level family (this is the "word" level)
   - depth 6-8: micro-level family (this is the "letter" level — the texture of the stone)

3. The DOMINANT family across depth layers = the entry's loopFamily.
```

Example:
```
Address: ["TL", "TR", "TL", "TR", "TL", "TR"]
Unique quadrants: {TL, TR} — adjacent pair
→ loopFamily: X_LOOP
→ codeHint (Phase B): if/else conditional

Address: ["TL", "TR", "BR", "BL", "TL", "TR", "BR"]
Unique quadrants: {TL, TR, BR, BL} — all four
→ loopFamily: GATE_ON
→ codeHint (Phase B): function definition / full block
```

### The CYAN Flash on SpatialEye

When `CYAN_EVENT` fires:
1. SpatialEye draws a **cyan ring** (3px stroke, full opacity) at the pattern's canvas region
2. Ring expands outward over 12 frames (200ms), fading to 0
3. Ring leaves a **permanent faint cyan mark** (10% opacity) — the library bookmark
4. All other quadrant colors dim to 50% for 500ms — the Librarian pausing to file

This is the only moment the entire canvas acknowledges what just happened.

---

## Phase B — The Translation Leap
### *"Geometry is not metaphor for code. Geometry IS code."*

### The Core Insight

GEO loop families and programming constructs share the same abstract structure because both
are describing *how control flows through a space*. The Librarian doesn't translate — it
**recognizes equivalence**.

### The Pattern→Code Mapping Table

| GEO Family | Spatial Behavior | Code Primitive | Blockly Block |
|------------|-----------------|----------------|---------------|
| Y_LOOP | Single quadrant rotates clockwise | Sequential statement / print | `print("")` |
| X_LOOP | Adjacent pair cycles back-and-forth | Conditional branch (if/else) | `if <test>` |
| Z_LOOP | Three-quadrant sweep — goes, turns, returns | Loop (for/while) | `repeat N times` |
| DIAG_LOOP | Diagonal toggle — ping-pong | Recursion / callback | `call function` |
| GATE_ON | All quadrants full (1111) | Function definition | `function {}` |
| GATE_OFF | All quadrants empty (0000) | Empty / null / reset | `(empty block)` |

### The Depth Modifier

Depth modifies the COMPLEXITY of the code primitive:

```
depth 1-2  → simplest form:  print("hello")
depth 3-4  → medium form:    for i in range(5): print(i)
depth 5-6  → compound form:  for i in range(n): for j in range(m): ...
depth 7-8  → full form:      class / module level construct
```

### The "Bezier Wave is Blue" Example (Mook's specific example)

> "When the stone moves in a specific Bezier wave (Blue), it triggers Hello World"

Blue = X_LOOP (two-branch, back-and-forth).
A Bezier wave is an X_LOOP trajectory at low depth — smooth alternation between two quadrants.

```
X_LOOP at depth 2-3 + delta signature "smooth, regular" → "Hello World" template
```

So the first time a student writes a Bezier-shaped pattern on the canvas, the Librarian
caches it as an X_LOOP entry, and the codeHint becomes:
```javascript
// Hello World — your first conversation with the machine
console.log("Hello World");
```

### How codeHint Gets Set

Phase B is initially **seeded** (a known mapping table) and then **learned** (student behavior updates it):

```typescript
// Seeded mapping — the Librarian's starting vocabulary:
const SEED_CODEHINTS: Record<GEOFamily, Record<number, string>> = {
  Y_LOOP: {
    2: 'print("Hello")',
    4: 'for (let i = 0; i < n; i++) { print(i) }',
    6: 'function printAll(arr) { arr.forEach(x => print(x)) }',
  },
  X_LOOP: {
    2: 'if (condition) { doA() } else { doB() }',
    4: 'while (x > 0) { x = condition ? x-1 : x+1 }',
    6: 'switch(state) { case A: ... case B: ... }',
  },
  Z_LOOP: {
    2: 'repeat(n) { /* body */ }',
    4: 'for (let i = 0; i < rows; i++) { for (let j = 0; j < cols; j++) { } }',
    6: 'function traverse(grid) { /* recursive sweep */ }',
  },
  DIAG_LOOP: {
    2: 'function callBack() { return callBack() }',
    4: 'addEventListener("click", handler)',
    6: 'async function fetch() { await response }',
  },
  GATE_ON: {
    2: 'function myFunction() { }',
    4: 'class MyClass { constructor() {} }',
    6: 'module.exports = { /* full API */ }',
  },
  GATE_OFF: {
    2: '// empty',
    4: 'null',
    6: 'undefined',
  }
};
```

The Librarian sets `entry.codeHint = SEED_CODEHINTS[entry.loopFamily][closestDepth]`.

The code string is an **output of navigating the library**, not the input.
The stone's movement writes the code. Not the other way around.

---

## Phase C — The Retrieval & Assistance Protocol
### *"The Librarian never speaks. It draws."*

### Detecting When Sisyphus Is Struggling

Three trigger conditions — any one fires Co-Pilot mode:

```typescript
const STRUGGLE_CONDITIONS = {
  frustrationThreshold: 15,      // baby agent frustration >= 15
  canvasSilenceSecs: 30,         // no canvas change for 30 seconds
  repeatedFailureCount: 5,       // same pattern attempted + failed 5 times
};
```

### Pattern Matching — "The Geometric Shape of the Struggle"

When Co-Pilot fires, the system compares the student's current quadrant trajectory
(their rock-pushing path) against all LibraryEntries:

```typescript
function findBestMatch(studentPath: string[], library: Map<string, LibraryEntry>): LibraryEntry | null {
  let bestScore = 0;
  let bestEntry = null;

  for (const entry of library.values()) {
    // Longest common subsequence of GEO addresses
    const score = lcsLength(studentPath, entry.address) / Math.max(studentPath.length, entry.address.length);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore > 0.4 ? bestEntry : null; // 40% path match = close enough
}
```

### The Co-Pilot Visual Response — "Guide Mode"

The Librarian does NOT show text. It does NOT highlight a button.
It **draws the correct path** through the quadtree, in the student's visual field.

```
Co-Pilot Visual Protocol:

1. CALM: All non-relevant quadrants dim to 25% opacity (the Librarian clears the noise)
2. TRACE: The matching LibraryEntry's address is drawn as a glowing path:
   - Each hop in the path lights up sequentially (200ms per hop)
   - Color sequence: WHITE → CYAN → target quadrant color
   - The path draws itself like a compass needle finding north
3. PULSE: The destination quadrant pulses cyan 3 times (slow, deliberate — "here")
4. WAIT: Guide Mode stays active for 8 seconds, then fades
5. RESET: If student moves toward the correct quadrant → Guide Mode brightens
         If student moves away → Guide Mode fades faster (doesn't lecture)
```

### The Co-Pilot Does Not Force

This is philosophical and technical:
- The Librarian shows a PATH, not an answer
- If the student ignores it: Guide Mode fades, no punishment, baby just watches again
- If the student finds their OWN path to the same pattern: that's a STRONGER reward (bonus delta)
- The hill gets shorter whether the student follows the Librarian or not — but faster if they do

### The "Hello World Loop" Example (Mook's specific example)

> "If a student is struggling to build a loop, the Librarian recognizes the geometric
>  shape of their struggle, retrieves the blueprint, and visually guides the rock."

```
Scenario:
- Student's quadrant path so far: ["TL", "TL", "TL", "TL"] — stuck in one corner (Y_LOOP start)
- They're trying to make something repeat (they want Z_LOOP — three-quadrant sweep)
- The Librarian finds Z_LOOP entry in libraryCache: ["TL", "TR", "BR", "TL", "TR", "BR"]
- 40%+ LCS match? Yes — both start with TL repetition
- Co-Pilot fires:
  1. Canvas dims to 25%
  2. Path lights: TL (white) → TR (cyan) → BR (yellow) → TL (white) again → ...
  3. The SWEEP pattern becomes visible — the student sees the rock rolling across three corners
  4. If they move their block to trigger TR: reward fires immediately, Guide brightens
  5. Pattern strengthens — the Librarian has genuinely helped
```

---

## The Borgesian Library — The 28 Phases

Mook referenced Edmund Dulac's Wheel of the 28 Phases of the Moon (Yeats, A Vision B, 1937).

This is not decorative. The Library of Babel contains every possible book.
The quadtree contains every possible spatial pattern.

A 4-level quadtree has 4^4 = 256 possible leaf paths.
But unique **trajectories** (sequences of 2-4 unique quadrants) number 28 distinct loop-family signatures at the macro level — just like Yeats' 28 phases.

Each LibraryEntry IS a phase. The Librarian builds Yeats' Great Wheel from student behavior.
The wheel doesn't exist until students push rocks. The wheel IS the history of all the pushes.

**The Wheel of Baby IO:**
```
Phase  1-4:   Y_LOOP variants (single quadrant rotation — pure linear)
Phase  5-8:   X_LOOP variants (adjacent pairs — conditional)
Phase  9-12:  Z_LOOP variants (three-quadrant — iterative)
Phase 13-14:  DIAG_LOOP variants (diagonal — recursive)
Phase 15:     GATE_ON (full — function)
Phase 16:     GATE_OFF (empty — null)
Phase 17-28:  Compound multi-depth patterns (the complex constructs)
```

The student's Blockly program is a walk across this wheel.
The Librarian is watching where they walk.
The code that emerges is the path they took.

---

## Implementation Order

```
Week 1:
  [1] Add LibraryEntry interface + libraryCache to baby_agent.ts
  [2] Add confidence ≥ 0.9 → promoteToLibrary() in tick()
  [3] Add loop family inference algorithm (quadrant uniqueness count)
  [4] Add CYAN_EVENT emission from tick()

Week 2:
  [5] SpatialEye: receive CYAN_EVENT → draw cyan expansion ring
  [6] SpatialEye: permanent faint cyan bookmark for library entries
  [7] Seed CODEHINTS table (Phase B mapping)
  [8] Wire codeHint into LibraryEntry on promotion

Week 3:
  [9]  Add struggle detection (frustration / silence / repeated failure)
  [10] Implement findBestMatch() LCS comparison
  [11] SpatialEye: Guide Mode — dim + draw path animation
  [12] Test full loop: student struggles → Librarian draws path → student follows → reward fires

Week 4:
  [13] Surface LibraryEntries as shareable student artifact (the visible pattern map)
  [14] Expose window.__library__ for dev inspection
  [15] Checkpoint: full Sisyphus→Librarian→Sisyphus loop confirmed
```

---

## The Emotional Contract

The Librarian does not whip. It catalogs.
The Sisyphus does not fail. They experiment.

Every time the rock rolls back down, the path is shorter.
That is not Sisyphean tragedy. That is learning.

---

*Written in collaboration: Mook + Claude, 2026-04-06.*
*"We are writing functional poetry."*
