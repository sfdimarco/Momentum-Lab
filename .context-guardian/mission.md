# 🧭 MISSION — Project Baby IO: The Sisyphus & The Librarian Protocol

## Goal
Architect the cognitive bridge where human tinkering (Sisyphus) becomes the Librarian's
geometric archive — building Baby IO's assistive loop from hallucination into functional co-pilot.

## Scope
**IN scope:**
- Phase A: Observation & Caching — the "Cyan State" Aha! moment, pattern promotion logic
- Phase B: Translation Leap — cached GEO geometry → functional code string mapping
- Phase C: Retrieval & Co-Pilot — Librarian visually guides Sisyphus back to discovered patterns
- The bidirectional student-AI pattern loop (item #4 from GEOAI vision)
- Pattern cache as shareable student artifact (item #2 from GEOAI vision)

**OUT of scope (this session):**
- Rust/WASM migration (future phase)
- New Blockly blocks
- Full UI redesign beyond SpatialEye additions

## Success Criteria
- [ ] Cyan State logic defined: confidence threshold + LibraryEntry promotion schema
- [ ] Loop-family inference algorithm designed (path shape → GEO family → code primitive)
- [ ] Phase B mapping protocol: GEO family → code template table
- [ ] Phase C co-pilot UX: how Librarian draws (not speaks) guidance to Sisyphus
- [ ] Cognitive Blueprint document written to workspace

## Constraints
- Don't break existing baby_0 or baby_1 agents
- Must run in TypeScript/React (no Rust this phase)
- Pattern addresses stay in GEO quadtree grammar format
- Dev server: `set NODE_ENV= && npm run dev` → port 3000
- Librarian NEVER uses text. It draws geometric paths.

## Key Files / Entry Points
- `src/geoai/baby_agent.ts` — BabyAgent class + babyAgent singleton (PRIMARY)
- `src/components/SpatialEye.tsx` — Canvas2D overlay, GEO visualization
- `src/components/GameCanvas.tsx` — Student canvas (real pixel source)
- `geoai/GEOAI_SPEC.md` — Living spec

## Current Project State (2026-04-06)
- baby_0 and baby_1 LIVE, reading actual student canvas pixels via shadow canvas
- BabyConfig system: both agents independently configurable
- 350+ patterns cached (Wild Mode); paths reach depth-8 GEO addresses
- Confidence: 0.0 → orange (0.7) → pink (≥0.7)
- CYAN STATE: target = confidence ≥ 0.9 → LibraryEntry promotion → THIS IS PHASE A
- Bidirectional loop: NOT YET — THIS IS PHASE C
- GEO KEY: baby_0 pattern addresses ARE spontaneous GEO grammar

## Original User Request (verbatim)
> "The Sisyphus (The Human): The kinetic engine. The human pushes the 'rock' through
> tinkering, experimentation, and movement.
> The Librarian (Baby IO): The geometric archivist. Operating within the Borgesian
> Infinite Library (a recursive quad-tree visual canvas), Baby IO watches. It does not
> push the rock; it catalogs how the rock is pushed."
>
> Phase A: Design the bridge where human input is translated into 4-bit Geo-Language.
> Define the exact logic for the Librarian's 'Aha!' moment.
> Phase B: Develop a protocol where the Librarian maps a cached pattern to a functional
> text string.
> Phase C: Once a pattern is mapped, how does the Librarian present it back to Sisyphus?
