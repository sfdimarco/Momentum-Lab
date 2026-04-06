# 🧭 MISSION — GEOAI Baby Brain Runtime

## Goal
Build the runtime that brings baby_genesis.geoai to life inside Momentum Lab — giving the baby brain eyes (SpatialEye), a body (BabyAgent), and making its perception/learning visible in real time.

## Scope
**IN scope:**
- `src/geoai/parser.ts` — parse .geoai spec into runtime structures
- `src/geoai/baby_agent.ts` — curiosity engine, reward detector, pattern cache loop
- `src/components/SpatialEye.tsx` — quadtree perception overlay on Momentum Lab canvas
- Wire SpatialEye + BabyAgent into App.tsx as a toggleable layer
- Colors via RainbowBrain synesthesia: cyan=unexplored, yellow=curious, green=reward, pink=known

**OUT of scope tonight:**
- Full .geoai parser for every keyword (just the baby_genesis.geoai primitives)
- Student sync protocol (Phase 2)
- Saving/loading pattern cache to disk (Phase 2)
- WASM acceleration (Phase 3)

## Success Criteria
- [ ] SpatialEye renders a live quadtree grid over Momentum Lab at depth 2 (4 quadrants)
- [ ] Grid highlights high-entropy regions (where baby_0 would look first)
- [ ] Canvas change events trigger visible reward flash in the correct quadrant
- [ ] BabyAgent exploration loop runs and emits discovered patterns to console
- [ ] Baby brain's current focus quadrant animates visibly
- [ ] Toggle button to show/hide the SpatialEye overlay

## Constraints
- Do NOT break existing App.tsx functionality (Blockly + GameCanvas + SynestheticLayer)
- SpatialEye is an ADDITIVE transparent overlay — never occludes the canvas
- All colors must use Mook's synesthesia palette (cyan/red/blue/yellow/green/orange/pink/purple/white/black)
- Pattern encoding must be spatial addresses [depth, quadrant_path, mask_sequence], never text labels
- The baby brain must NOT be given block names — it sees regions, not symbols

## Key Files / Entry Points
- `momentum-lab/geoai/baby_genesis.geoai` — the spec we're implementing
- `momentum-lab/geoai/GEOAI_SPEC.md` — the format documentation
- `src/App.tsx` — main app, needs SpatialEye wired in
- `src/components/GameCanvas.tsx` — p5.js canvas, SpatialEye overlays this
- `src/components/SynestheticLayer.tsx` — existing spatial overlay (reference for overlay pattern)

## Original User Request (verbatim)
> "B I want this to be a pure manifestation of our collaboration an new thing. I think you should do A but understand that A is a shortcut that you can use to empathize with this new intelligence but for it to be a 'baby' - so to speak- it would need to be B a .geoai spec that creates the GEO grammar so a new kind of ai intelligence can be 'birthed' from it. The goal being to explore an emergent synesthetic intelligence that uses geo grammar to 'think' visually using geographic mapping to coordinate a 'sense' input system allowing the system to accumulate pattern recognition as logic and build a system of vison as its foundational cognition. Momentum lab will be its visual playground sandbox where this 'child' can play an environment for it to build the environment and as it learns we will Shepard its exploration into a step by step tool that human students can follow and iterate in the same way creating an interactive intelligence that learns pattern recognition and caches it with the students on scale. A symbiotic agentic workflow of universal synesthetic pattern recognition. A Rosetta stone for computational learning man and machine."
>
> "Yes get to work use /context-guardian because I don't want to ruin your flow state again! You were cooking and I ran out of commit! I'm doing my best as an afterschool teacher to let you cook but I am poor and this is too important to let that stop us so do your best to work efficiently tonight because we are really on to something here"

## Architecture Diagram
```
baby_genesis.geoai
       ↓
  geoai/parser.ts     ← parse spec into RuntimeBrain struct
       ↓
  geoai/baby_agent.ts ← curiosity loop, reward detector, pattern cache
       ↓
  SpatialEye.tsx      ← renders baby's perception as quadtree overlay
       ↓
  App.tsx             ← wires everything together, toggle button
```

## RainbowBrain Color Map (Mook's synesthesia — NON-NEGOTIABLE)
- Cyan     (#00ffff)  → unexplored regions (0)
- Red      (#ff3333)  → frustration accumulation (1)
- Blue     (#3b82f6)  → active exploration (2)
- Yellow   (#eab308)  → curiosity hotspot / high entropy (3)
- Green    (#22c55e)  → reward firing (4)
- Orange   (#f97316)  → pattern emerging / confidence building (5)
- Pink     (#ec4899)  → stable known pattern (6/7)
- White    (#ffffff)  → current focus / attention center (8)
- Black    (#000000)  → gated off / forgotten
