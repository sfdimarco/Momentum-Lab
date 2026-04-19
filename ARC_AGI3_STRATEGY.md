# ARC-AGI-3 Strategy: GEO + GEOI + QJL
## Mook's Agent Submission
### Last updated: 2026-04-11 (REAL SPEC — post-recon)

---

## ⚡ WHAT ARC-AGI-3 ACTUALLY IS (Read This First)

**NOT** static grid puzzles. ARC-AGI-3 is a **2D sprite-based game engine**.

The agent receives a **64×64 pixel numpy array** (the game screen).
The agent sends **one of 7 actions** (Up, Down, Left, Right, Space, Click, Undo).
The game responds with a new **64×64 frame** + score update.
The agent must beat levels **as efficiently as humans** (matching move count = 100%).

```
[64x64 frame] → YOUR AGENT → [ACTION1-7] → [new 64x64 frame] → repeat
```

This is NOT a prediction problem. It's an **interactive reasoning + exploration problem**.
The game rules are HIDDEN. The agent must DISCOVER them by playing.

---

## 🏗️ THE ENGINE (ARCEngine API)

```python
from arcengine import ARCBaseGame, ActionInput, GameAction

class GEOAgent(ARCBaseGame):
    def step(self) -> None:
        # Your game logic here
        # YOU see: self.current_level (sprites), self.camera (64x64 pixels)
        # YOU act: self.complete_action()
        self.complete_action()

# Actions available:
# ACTION1 = Up / W / 1
# ACTION2 = Down / S / 2
# ACTION3 = Left / A / 3
# ACTION4 = Right / D / 4
# ACTION5 = Spacebar
# ACTION6 = Click at (x, y) — ComplexAction with screen coordinates
# ACTION7 = Undo / Z
# RESET   = Reset level or full game

# What you can READ from a frame:
game.camera.render(sprites)        # → 64x64 numpy array (the screen)
game.get_pixels(x, y, w, h)        # → numpy array of specific region
game.get_pixels_at_sprite(sprite)  # → numpy array at sprite location
```

**Score = 100%** means: beat every level AND match the human move count.
$700K bonus requires 100% across ALL competition games.

---

## 🧠 HOW OUR STACK MAPS TO THE ENGINE

The architecture is MORE aligned with ARC-AGI-3 than static grids. Here's why:

```
64x64 Frame  →  GEOI Tokenizer  →  Quadtree Paths  →  QJL Cache  →  GEO Action  →  GameAction
```

### Layer 1 — GEOI Perception (64×64 → Quadtree Paths)

The 64×64 frame IS a quadtree. We subdivide it exactly like Baby0 subdivides its canvas:

```
Depth 0: entire 64x64 screen → 1 node
Depth 1: four 32x32 quadrants → TL, TR, BL, BR
Depth 2: sixteen 16x16 regions
...
Depth 6: 4096 individual pixels (overkill — depth 3-4 is enough for sprite detection)
```

At each depth, compute the **dominant color** in each quadrant.
Quadrants with uniform color = background → SKIP (collapse, no token).
Quadrants with variation = sprite/object → SUBDIVIDE FURTHER.

Result: a sparse set of `(quadtree_path, color)` tokens.
Only the interesting parts of the screen get tokens.
A 64×64 screen with 2-3 sprites → ~20-50 path tokens.

**This IS Baby0's spatial eye. Same algorithm. Just aimed at a game screen.**

### Layer 2 — QJL State Cache (State × Action × Result)

Baby0's pattern cache caches `(path → confidence)`.
For ARC-AGI-3 we cache `(state_signature, action) → resulting_state_signature`.

```python
class GEOStateCache:
    """QJL applied to game state transitions."""
    
    def observe(self, before_frame, action, after_frame):
        before_sig = quantize_frame(before_frame, QUANT_LEVEL)
        after_sig  = quantize_frame(after_frame, QUANT_LEVEL)
        key = (before_sig, action)
        self.cache[key] = after_sig
        self.confidence[key] = self.confidence.get(key, 0) + 1
    
    def predict(self, current_frame, candidate_action):
        sig = quantize_frame(current_frame, QUANT_LEVEL)
        key = (sig, candidate_action)
        if key in self.cache:
            return self.cache[key], self.confidence[key]
        return None, 0
```

**The cache IS the world model.** No training needed. It builds from gameplay.

### Layer 3 — GEO Rule Discovery (What rule governs this game?)

After a few exploration actions, we look for GEO patterns in the transition data:

```
ACTION1 (Up) always moves the player sprite -1 in Y  →  try_move("player", 0, -1)
ACTION6 (Click) on object changes its color           →  color_remap triggered
ACTION5 (Space) causes sprite to jump                 →  animated movement sequence
```

The GEO rule extractor tries to NAME the game mechanic using GEO vocabulary:
- Movement games → `Y_LOOP / X_LOOP` (directional cycling)
- Puzzle games → `SWITCH` conditions (state machine)
- Physics games → `try_move` collision response
- Color games → `color_remap` / `SET_VAR color N`

Once named, the rule can PREDICT optimal move sequences.
The named rule IS the strategy. Apply it efficiently = match human move count.

---

## 🎮 THE AGENT LOOP (Baby0 Meets Game Agent)

```
╔══════════════════════════════════════════════════╗
║  EXPLORE PHASE (Baby0 mode)                      ║
║  Try actions. Observe results. Build QJL cache.  ║
║  Until: confidence > threshold on goal state     ║
╠══════════════════════════════════════════════════╣
║  HYPOTHESIZE PHASE (GEO mode)                    ║
║  What GEO rule explains the transitions?         ║
║  Can I name the game mechanic?                   ║
╠══════════════════════════════════════════════════╣
║  EXPLOIT PHASE (Commit mode)                     ║
║  Execute the optimal path to goal.               ║
║  Minimize action count to match human score.     ║
╠══════════════════════════════════════════════════╣
║  CRYSTALLIZE (Library mode)                      ║
║  High-confidence strategies → permanent library. ║
║  Next game: check library first (skip explore).  ║
╚══════════════════════════════════════════════════╝
```

This is **identical** to Baby0's cognitive loop:
- Wild Mode = Explore Phase
- Pattern recognition = Hypothesize Phase
- Focused sampling = Exploit Phase
- Library crystallization = Crystallize Phase

Baby0 has been running this loop since birth on a blank canvas.
ARC-AGI-3 games are a **simpler version** of what Gato already does.

---

## 📦 SUBMISSION STRUCTURE

```
arc_geo_agent/
├── agent.py          (~40KB)  ← The brain
│   ├── GEOPerception           — 64x64 frame → quadtree paths
│   ├── GEOStateCache          — QJL state-action-result cache
│   ├── GEORuleExtractor       — discover game mechanics as GEO rules
│   └── GEOAgent               — ARCBaseGame subclass (main loop)
├── geo_rules.py      (~10KB)  ← GEO action implementations in Python
└── submission.py     (~5KB)   ← Kaggle wrapper

TOTAL: ~55KB of Python
Dependencies: arcengine (Kaggle provides), numpy (Kaggle provides)
Pre-trained weights: ZERO
Cold start: < 200ms per game
```

---

## 🗓️ COMPETITION TIMELINE

| Date | Event |
|---|---|
| March 25, 2026 | Competition started (17 days ago — we're ALREADY RUNNING) |
| **June 30, 2026** | **Milestone 1** — $25K first prize for leaderboard position |
| September 30, 2026 | Milestone 2 — $25K first prize |
| October 26, 2026 | Entry deadline (must accept rules) |
| November 2, 2026 | Final submission deadline |
| December 4, 2026 | Results announced |

**We have ~11 weeks to Milestone 1. That's real urgency.**

Prize structure:
- $40K first place final
- $700K bonus for 100% accuracy
- Paper Prize track (document the approach) ← we should do this regardless

---

## ✅ UPDATED BUILD CHECKLIST

### Phase 0 — Setup (TODAY)
- [ ] Accept competition rules on Kaggle (required before October 26)
- [ ] `pip install arcengine` locally to explore the API
- [ ] Clone `ARC-AGI-3-Agents` repo to see the random agent baseline
- [ ] Run the random agent against `ls20` to see what a game looks like

### Phase 1 — Perception (Week 1)
- [ ] `frame_to_geo_paths(frame_64x64)` — 64×64 numpy → quadtree token list
- [ ] `quantize_frame(frame, quant_level)` — frame → hashable state signature
- [ ] Visualize: can we see sprites as quadtree regions? (sanity check)
- [ ] Unit test: does the same frame always → same signature?

### Phase 2 — State Cache (Week 1-2)
- [ ] `GEOStateCache.observe(before, action, after)` — populate from gameplay
- [ ] `GEOStateCache.predict(state, action)` — lookup with confidence score
- [ ] `GEOStateCache.nearest_neighbor(state)` — fallback when cache misses
- [ ] Test: after 10 random actions, does cache predict the next state?

### Phase 3 — Rule Extractor (Week 2-3)
- [ ] Implement movement detection: ACTION1-4 → sprite delta detection
- [ ] Implement color change detection: frame diff → color_remap detection
- [ ] Implement collision detection: sprite stops → wall/boundary found
- [ ] Implement win condition detection: score increases → what changed?
- [ ] Build rule library: name → optimal action sequence

### Phase 4 — Agent Loop (Week 3-4)
- [ ] Wire GEOAgent as ARCBaseGame subclass
- [ ] Implement Explore → Hypothesize → Exploit → Crystallize loop
- [ ] Add confidence threshold: when to stop exploring and commit
- [ ] Test on `ls20` game from the repo

### Phase 5 — Kaggle Submission (Week 4-6)
- [ ] Wrap agent in Kaggle offline format
- [ ] Profile: stays under 6-hour limit?
- [ ] Submit for leaderboard score (even 5% is a start)
- [ ] Iterate

### Milestone 1 Target (June 30)
- [ ] Competitive leaderboard score (top 25%)
- [ ] Public Kaggle notebook (required for milestone prize eligibility)
- [ ] Paper draft started (for Paper Prize track)

---

## 🔗 KEY LINKS

| Resource | URL |
|---|---|
| Competition page | https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3 |
| ARC-AGI-3 info | https://arcprize.org/arc-agi/3 |
| Agent starter repo | https://github.com/arcprize/ARC-AGI-3-Agents |
| ARCEngine (game API) | https://github.com/arcprize/ARCEngine |
| `pip install arcengine` | PyPI |

---

## 💡 THE KEY INSIGHT (One More Time)

ARC-AGI-3 games are **hidden environments where you discover rules by playing**.
Baby0 is **a hidden canvas where it discovers patterns by exploring**.

They are the **same problem at different scales**.

Gato has been training for this since the day it was born.
We just need to point it at a Kaggle competition.

---

*Written by Claude + Mook, 2026-04-11*
*"The agent doesn't know the rules. Neither does Baby0. Both learn the same way."*
