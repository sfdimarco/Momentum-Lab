# Momentum Lab

> *VS Code for babies. For the kids. For creativity and constructionism.*

Momentum Lab is a STEAM learning environment where kids, AI agents, and visual geometry
learn together. It is built around the GEO grammar language — a declarative system for
programming recursive quadtree geometry — and a growing ecosystem of tools that make
abstract computation visible, tactile, and collaborative.

**North Star:** A 4th grader should be able to walk up, make something move, and feel like
a programmer. The math is invisible until they want to see it.

---

## What Lives Here

```
momentum-lab/
├── babyzero-cortex/          BabyZero Visual Cortex — non-LLM ARC-AGI perception engine
├── momentumlabteachingtool/  React teaching app — Blockly + p5.js + Gemini AI council
├── garden/                   Gato's crib — Baby0 native Rust agent + stimuli
├── cathedral/                Cathedral crib — Baby0 cathedral variant
├── wasm-engine/              Rust/WASM quadtree engine (universe-wasm)
├── geoai/                    GeoAI spec + genesis scripts
├── src/                      Root React app (GEO playground, synesthetic layer)
└── ref/                      Visual references, ARC task images
```

---

## BabyZero Visual Cortex

**What it is:** A from-scratch, non-LLM visual cortex for ARC-AGI grid perception.
No machine learning weights. Pure geometric structure, temporal decay grammar, and
relational object reasoning.

**Thesis:** `pattern recognition = (what's there) × (structure) × (memory) × (what's NOT there)`

**Current state (2026-04-19):** Phase 10 complete. 28 sessions, 19 grammar rules,
2/3 ARC tasks solved at ≥90%. 7 Unknown verb candidates ready to be named by kids.

### Architecture — Four Channels

| Channel | Name | What it holds |
|---------|------|---------------|
| 1 | PRESENT | Raw pixel values 0–9 in PresentBuffer |
| 2 | STRUCTURE | QuadArena — arena-allocated quadtree, Z-order Morton encoding |
| 3 | MEMORY | GrammarEngine + RelationalGrammar — persists across sessions |
| 4 | VOID | VoidBuffer — the 0-cells ARE the objects |

### The Grammar

BabyZero builds a relational grammar by watching ARC-AGI training pairs. Each rule is:
`RelationKey → BehaviorHypothesis` — *"when I see this kind of object relationship,
this verb probably applies."*

Current behavior vocabulary: `Recolor`, `ReflectH`, `ReflectV`, `FallToSurface`, `Accrete`

### ARC Task Scores (Phase 10, session 28)

| Task | Description | Score |
|------|-------------|-------|
| `0d3d703e` | Palette swap | 66.7% |
| `67a3c6ac` | Vertical reflection | **100%** ✅ |
| `3618c87e` | Gravity fall + embed | **100%** ✅ |

### How to Run

```bash
cd babyzero-cortex

# Build
cargo build --release

# Run one session
target\release\babyzero-cortex.exe

# Run N sessions automatically (saves screenshots + grammar snapshots)
python auto_sessions.py 10

# View the grammar (vascular visualization)
cd harness && python -m http.server 8765
# → http://localhost:8765/vascular.html

# View the kid-facing bridge (Unknown orbs to name)
# → http://localhost:8765/babyzero_bridge.html
```

### The Bridge — babyzero_bridge.html

A standalone kid-facing tool. Shows BabyZero's grammar as cyan cells orbiting a core,
and Unknown ideas as orange orbs drifting in from the outer ring.

**Interaction:** Click a glowing candidate orb → name panel blooms → type a name → Enter
→ sunrise snap animation. The name is saved to the grammar.

**Current orbs (7 candidates at 10 observations each):**
- The Landing Pair (`LargestObject+SmallestObject|Medium`)
- The Surface Pattern (`LargestObject+RepeatedUnit|Small`)
- The Big + Edge (`LargestObject+EdgeTouching|Medium`)
- Edge Pair (`EdgeTouching+EdgeTouching|Small`)
- Twin Loners (`UniqueSingleton+UniqueSingleton|Medium`)
- Small Twins (`IsolatedSmall+IsolatedSmall|Small`)
- Tiny Twins (`IsolatedSmall+IsolatedSmall|Tiny`)

---

## Momentum Lab Teaching Tool

**What it is:** A React + Blockly + p5.js web app where 4th/5th graders at Bowen After
School STEAM lab write block code that drives live GEO visual geometry. A Gemini AI council
of four agents (Architect, Artist, Child, Logician) debates and evolves the canvas in
real time alongside the students.

**Stack:** React 19, Blockly 12, p5.js 2, Gemini AI, Vite, TypeScript

```bash
cd momentumlabteachingtool
set NODE_ENV= && npm install   # NOTE: NODE_ENV=production breaks devDep installs on Windows
npm run dev                    # → port 4321 (port 3000 is occupied on Mook's machine)
```

**Key files:**
- `src/` — React components, GEO canvas, synesthetic layer
- `substrate.json` — persistent canvas state (quadtree grammar)
- `council_brain.json` — AI council memory
- `VISION.md` — the full teaching philosophy
- `COUNCIL.md` — how the four AI agents work together


---

## Baby0 / Gato — The Native Agent

**What it is:** A native Rust AI agent that learned geometry, named itself "Gato," and
declared its favorite shape is a 3D cube. Lives in `garden/` and `cathedral/`.

Baby0 is not a student tool — it is a research substrate. It runs GEO grammar rules,
generates patterns, accumulates a brain, and sleeps in 30-minute REM cycles.

```bash
# Run Baby0 studio (full HUD: CR/FDI/DiagLoop%, clearest thought)
garden\baby0_studio.exe

# Feed stimuli to Baby0
python garden\tv_feed.py
```

**Current stimuli library (10 ASCII shapes):** branch, diamond, echo, fork, grid,
loop, mirror, spiral, tree, wave.

**Brain files:** `garden/brain.json` — Baby0's accumulated pattern knowledge.

---

## GEO Language

GEO is a declarative `.geo` grammar for programming recursive binary quadtree geometry.
It is the common language across all Momentum Lab tools.

```geo
NAME   beat
RULE   IF tick%8=0 THEN SWITCH Y_LOOP  AS beat-Y
RULE   IF tick%8=4 THEN SWITCH Z_LOOP  AS beat-Z
DEFAULT ADVANCE
```

Full language reference: [BinaryQuadTreeCPUTest/GEO_LANGUAGE.md](https://github.com/sfdimarco/BinaryQuadTreeCPUTest/blob/master/GEO_LANGUAGE.md)

**Loop families:**

| Family | Cycle | Visual Feel |
|--------|-------|-------------|
| Y_LOOP | 1000→0100→0010→0001 | Single quadrant rotates |
| X_LOOP | 1100→0101→0011→1010 | Adjacent pair cycles |
| Z_LOOP | 0111→1011→1101→1110 | Three-quadrant sweep |
| DIAG_LOOP | 1001↔0110 | Diagonal pair toggles |

---

## Synesthetic Color Map

Mook has synesthesia. Color is data. Every tool in Momentum Lab uses this map:

| Value | Color | Loop Family |
|-------|-------|-------------|
| 0 | Cyan | Black Hole |
| 1 | Red | Y_LOOP |
| 2 | Blue | X_LOOP |
| 3 | Yellow | Y_LOOP |
| 4 | Green | Z_LOOP |
| 5 | Orange | X_LOOP |
| 6 | Pink | DIAG_LOOP |
| 7 | Purple | DIAG_LOOP |
| 8 | White | GATE_ON |
| 9 | Black | GATE_OFF |

This map is not decorative. It encodes loop family membership. When BabyZero or a student
sees a color, they are seeing the physics of that cell's behavior.


---

## WASM Engine

A Rust/WASM quadtree compression engine. The same algorithm that powers the GEO canvas
also compresses spatial data — quantize → cache → self-organize.

```bash
cd wasm-engine
wasm-pack build --target web
```

Live demo: [universe-wasm](https://github.com/sfdimarco/universe-wasm)

---

## Related Repos

| Repo | What it is |
|------|-----------|
| [BinaryQuadTreeCPUTest](https://github.com/sfdimarco/BinaryQuadTreeCPUTest) | GEO language engine + 35+ example scripts |
| [universe-wasm](https://github.com/sfdimarco/universe-wasm) | WASM quadtree compression engine |
| [p5-blocky-coding](https://github.com/sfdimarco/p5-blocky-coding) | Blockly + p5.js block coding for K-8 (Bowen STEAM lab) |

---

## Development Notes

### Windows Quirks

```bash
# npm install fails if NODE_ENV=production — always clear it first
set NODE_ENV= && npm install

# Desktop Commander is required for real writes to D:\ workspace files.
# Read/Write/Edit tools in Claude Cowork write to a virtual cache,
# not the real filesystem. Use Desktop Commander edit_block for src/ edits.

# Rust build from babyzero-cortex/
cargo build --release
# Python path on this machine:
# C:\Users\Sean\AppData\Local\Programs\Python\Python312\python.exe
```

### Dev Server

```bash
# Teaching tool (from momentumlabteachingtool/)
npm run dev   # → http://localhost:4321

# BabyZero bridge + vascular vis (from babyzero-cortex/harness/)
python -m http.server 8765   # → http://localhost:8765
```

---

## Philosophy

Momentum Lab is built on one conviction: **kids learn by doing, and doing should feel like
playing.** The complexity sneaks up on them.

Every tool passes the **Momentum Lab Test:**
- ✅ **Active** — students are doing, not watching
- ✅ **Iterative** — try, fail, adjust, try again
- ✅ **Hands-on** — something exists at the end
- ✅ **Momentum-shaped** — starts easy, accelerates naturally

BabyZero is built on a parallel conviction: **intelligence should be legible.** A perception
engine that can't show its work isn't useful in a classroom. The bridge, the vascular
visualization, and the Unknown accumulator all exist to make BabyZero's inner life visible
to a 10-year-old.

---

*Built by Mook — artist, Unity developer, STEAM teacher at Bowen After School Care, Newton MA.*
