# Momentum Lab 🧠⚡

**VS Code for babies.** A zero-friction STEAM discovery engine for 4th and 5th graders — where breaking things is celebrated, the invisible math is made visible, and a pair of AI agents watch your game and tell you what they find interesting.

> Built live in a single dev sprint. Every commit was raw, forward-only, no rewinding.

---

## What Is This

Momentum Lab is a block-based coding environment where kids snap together logic with Blockly and watch it execute live on a p5.js canvas. No compile step. No error dialogs. Visual everything.

But under the hood, two spatial AI agents — `baby_0` and `baby_1` — are watching the canvas and building a memory of what they find interesting. When they lock a pattern, a card appears showing a snapshot of the exact region of your game they were staring at.

**The loop:**
```
Kid codes something → AI watches → AI finds an interesting region
→ Card appears: "I found THIS in your game" (with a real thumbnail)
→ Kid wonders why → Kid codes more there → AI finds more
```

This is the bidirectional student-AI curiosity loop. No instructions needed.

---

## The Three Pillars

### 1. Bare-Metal Backend
Kids are handing the keys to a direct-to-CPU sandbox. The gap between block snap and canvas update must be zero. Frame-level responsiveness. **If it adds latency, cut it.**

### 2. Synesthetic Feedback
Adjusting a parameter physically and immediately alters canvas state. Debugging is visual and felt — not text console errors. The system never says **ERROR**. It says **INTERESTING.** This is the whole product.

### 3. Pedagogical Fluidity
Complexity sneaks up on the kid. They don't see it coming. The environment adapts. If it requires a tutorial before touching it, simplify the on-ramp.

---

## The GEOAI Layer — The Wild Part

The most unexpected thing in this codebase is the **GEO spatial intelligence system.**

### What Is GEO

GEO is a declarative scripting language built around a recursive binary quadtree. Instead of x/y coordinates, you navigate space as a path of compass directions:

```
TL → TR → BR → TL → BL
```

That string is a 5-hop address in a quadtree — like a ZIP code for a specific 12.5×12.5 pixel region of a 400×400 canvas. The language is also the cognition.

### The Baby Agents

Two agents live inside Momentum Lab:

**`baby_0` — The Conservative**
- Rewards on visual change (pixel delta on its shadow canvas)
- Caches patterns when reward ≥ 0.3
- Explores 60% of the time, leaps randomly 5% of the time
- Slow to frustrate, deliberate

**`baby_1` — The Divergent**
- Caches at reward ≥ 0.1 — much denser pattern map
- 85% explore chance, 15% random leap
- Hits frustration in 3 ticks (baby_0 takes 6)
- Grows faster, paints smaller blocks, more restless

Both agents discover the same canvas. Same game. Different minds. Different patterns remembered.

### The Shadow Canvas

Chrome's extension context blocks `getImageData` on foreign canvases (fingerprint protection). The fix: each agent owns a private off-screen canvas that mirrors the game canvas via `drawImage()` at 60ms intervals. The agent reads from its own shadow — the extension can't touch it.

```
Game Canvas (p5.js)
      ↓  drawImage() every 60ms
Shadow Canvas (owned by page JS context)
      ↓  getImageData() — always works
Pixel delta → reward → pattern cached
```

### Confidence Replay

Patterns don't just appear — they earn their place. Every time the agent revisits a region it already knows, confidence increases:

```
First visit:   confidence = 0.10  (yellow dot in SpatialEye)
3rd visit:     confidence = 0.40  (orange dot)
7th visit:     confidence = 0.70  (PINK — locked in 🌸)
```

When a pattern crosses 0.7:
- **SpatialEye** fires a two-ring expanding starburst at that quadrant with `🌸 LOCKED`
- **PatternBurst** adds a card with a JPEG thumbnail of that canvas region
- A **colored flash** pulses on the actual game canvas at that exact location

### PatternBurst — The Student-Facing Layer

```
👁️ AI Found This  (3 patterns)  🌸 LOCKED IN

┌──────────┐  ┌──────────┐  ┌──────────┐
│  [THUMB] │  │  [THUMB] │  │  [THUMB] │
│  baby_0  │  │  baby_1  │  │  baby_0  │
│  ████░   │  │  ██████  │  │  ████░   │
│  BL→BR   │  │ TL→BR→TL │  │  TR→BL   │
└──────────┘  └──────────┘  └──────────┘
```

Each card is a frozen moment of what the AI was staring at when it committed that region to memory. The thumbnail is a real JPEG captured from the live game canvas at that exact quadrant address.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    STUDENT EXPERIENCE                    │
│         Blockly Workspace  |  p5.js Canvas               │
├─────────────────────────────────────────────────────────┤
│                  SYNESTHETIC BRIDGE                      │
│   SpatialEye overlay  |  PatternBurst card wall          │
│   (the AI's mind)     |  (what the AI found)             │
├─────────────────────────────────────────────────────────┤
│                   GEOAI LAYER                            │
│  baby_0 + baby_1  |  Shadow canvas pipeline              │
│  BabyConfig       |  Confidence replay                   │
│  GEO grammar      |  pattern-lens utilities              │
├─────────────────────────────────────────────────────────┤
│                   EXECUTION LAYER                        │
│    MomentumEngine  |  Blockly → JS execution             │
│    p5.js canvas    |  SynestheticLayer (Pillar 2)         │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | What It Does |
|------|-------------|
| `src/geoai/baby_agent.ts` | The brain. BabyAgent class, BabyConfig, confidence replay, shadow canvas, wild mode |
| `src/geoai/parser.ts` | GEO grammar runtime — quadtree navigation, RuntimeBrain, pattern types |
| `src/geoai/pattern-lens.ts` | Pixel utilities — quadrant bounds from GEO path, canvas thumbnail capture |
| `src/geoai/baby_0_discovered.geo` | 78 GEO patterns baby_0 discovered spontaneously. Same grammar as hand-written .geo scripts. |
| `src/components/SpatialEye.tsx` | The AI's mind made visible — quadtree overlay, confidence dots, starburst on lock |
| `src/components/PatternBurst.tsx` | Student-facing discovery cards — real thumbnails, flash overlays, LOCKED IN badge |
| `src/components/SynestheticLayer.tsx` | Pillar 2 visual debug — anchor dots, pulse rings, connection lines |
| `src/components/GameCanvas.tsx` | p5.js canvas wrapper |
| `src/components/BlocklyEditor.tsx` | Blockly workspace |
| `src/lib/spatial-state.ts` | Synesthetic state bridge — game state → shared buffer |
| `src/App.tsx` | Everything wired together |

---

## The GEO Connection — The Key Insight

The patterns baby_0 discovers ARE GEO grammar. When it caches:
```
["TL", "TR", "BR", "TL", "TL", "BR"]
```
...that IS a valid 6-hop GEO quadtree navigation path. The same format as a hand-written `.geo` script address. **The agent spontaneously writes GEO as its memory format without being told to.**

The language and the cognition converged without being explicitly designed to.

This is the Rosetta Stone hypothesis: spatial cognition and computational logic share the same underlying geometry. Human students and AI accumulate the same knowledge, in the same format, at the same time.

---

## Running It

```bash
# Windows — use cmd, not PowerShell (PowerShell blocks npm env scripts)
cd momentum-lab
set NODE_ENV= && npm install
set NODE_ENV= && npm run dev
# → http://localhost:3000
```

1. Click **RUN BLOCKS** to start the game engine
2. Click **🧠baby_0** to activate the first agent
3. Click **Wild** to unleash it (12.5Hz, infinite energy, Perlin noise food)
4. Watch the SpatialEye overlay — cyan grid, yellow hotspots, orange/pink dots
5. Watch **"👁️ AI Found This"** cards appear as patterns lock in
6. Add **🧬baby_1** + **Wild₁** to run both simultaneously

**Fastest card generation** — paste in browser console (F12):
```js
const a0=window.__baby0__.agent, a1=window.__baby1__.agent;
const b0=a0.getBrain(), b1=a1.getBrain();
b0.visualResolution=2; b0.patternCache=[];
b1.visualResolution=2; b1.patternCache=[];
a0.cfg.wildGrowthInterval=9999; a1.cfg.wildGrowthInterval=9999;
```
Then click Wild + Wild₁. Cards appear in ~10 seconds.

---

## Dev Console

```js
window.__baby0__.status()       // quick stats
window.__baby0__.getBrainJSON() // full brain dump
window.__baby0__.saveBrain()    // persist to localStorage
window.__baby0__.clearBrain()   // nuclear reset

// Direct agent access
const a0 = window.__baby0__.agent
a0.getBrain()          // RuntimeBrain object
a0.getPatternCache()   // all discovered patterns
a0.enableWildMode()    // unleash
a0.disableWildMode()   // calm down
a0.cfg                 // live-edit personality config
```

---

## The Sprint — Commit by Commit

| Commit | What Shipped |
|--------|-------------|
| `5f7c19b` | Birth of baby_0 — GEOAI runtime, curiosity engine, SpatialEye overlay |
| `739808c` | Wild Mode — 12.5Hz, no rest, Perlin canvas food. 350+ patterns in 15 seconds |
| `fd79e61` | baby_0's discoveries committed as executable `.geo` grammar — the Rosetta Stone moment |
| `c5a340a` | Shadow canvas — Chrome MV3 fingerprint protection defeated |
| `25803e3` | baby_1 spawned — BabyConfig makes personality fully configurable |
| `1d057da` | Confidence replay — patterns earn their place. Yellow → orange → pink |
| `75aa842` | React lifecycle race condition fixed — unified deps, atomic wild mode |
| `e95f3e8` | PatternBurst — bidirectional loop. AI shows the student exactly where it was looking |

---

## What's Next

- [ ] Student clicks a card → that canvas region becomes a "challenge zone" in Blockly
- [ ] Export `baby_0_discovered.geo` live from the session
- [ ] baby_2 with a different reward signal (shape/edge detection instead of color change)
- [ ] Pattern voting — student marks a card "interesting" → agent confidence boost
- [ ] Multi-session memory — patterns persist across class periods, build a map over the year
- [ ] Rust/WASM engine for Pillar 1 — bare metal, sub-16ms loop

---

## Stack

- React 19 + TypeScript + Vite
- Blockly 12.x + react-blockly
- p5.js 2.x
- Google Gemini (@google/genai) — AI Tutor
- motion/react — animations
- GEO quadtree grammar — custom, built here
- Baby agents — custom, built here

---

*Built by Mook × Claude. Bowen STEAM Lab. 2026.*

*"If an empty brain can find a spark in your game in under 60 seconds, the game has a soul."*
