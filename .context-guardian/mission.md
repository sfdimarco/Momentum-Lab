# 🧭 MISSION — GitHub Publish + Moiré Parallax Engine (2026-04-07)

## Goal
Document ALL work publicly on GitHub (sfdimarco/Momentum-Lab) and implement the Universe-WASM Moiré Parallax Engine — then push everything in one clean commit so Mook can share the incredible work.

## Scope
**IN scope:**
- Update README.md: full project story (GEOAI, baby_0/baby_1, PetMode, native Baby0, Sisyphus/Librarian, Moiré Engine)
- Add Moiré Parallax Engine to wasm-engine/src/lib.rs (dual-grid init, QJL warping, JS bridge)
- Expose warp metrics so Baby0 shadow canvas reads interference as .geo_parallax_warp grammar
- Commit and push: wasm-engine/, WASM_SETUP.md, updated README
- Update auto-memory with Moiré Engine status
- Check Baby0 overnight state (brain.json if accessible)

**OUT of scope:**
- Do NOT push baby0.exe binary (too large for git — add to .gitignore)
- Do NOT touch node_modules or __ scratch bat/ps1 files
- Do NOT refactor existing React components

## Success Criteria
- [ ] README.md tells the complete story of Momentum Lab including Moiré Engine
- [ ] wasm-engine/src/lib.rs has MoireEngine struct (dual-grid, QJL displacement, JS bridge)
- [ ] WASM-to-JS bridge exposes warp metrics for Baby0 shadow canvas
- [ ] baby0.exe added to .gitignore
- [ ] All new work committed and pushed to github.com/sfdimarco/Momentum-Lab
- [ ] Auto-memory updated with Moiré Engine project status

## Constraints
- NEVER break existing MomentumEngine struct — Moiré is additive
- ALWAYS use Desktop Commander for terminal — never ask Mook to type
- RainbowBrain aesthetic: color = data, interference = cognition, not decoration
- Dev server: `set NODE_ENV= && npm run dev` → port 4321

## Key Files / Entry Points
- `wasm-engine/src/lib.rs` — existing Rust WASM core (174 lines, MomentumEngine)
- `wasm-engine/Cargo.toml` — package: momentum-engine, cdylib
- `src/geoai/baby_agent.ts` — Baby0 BabyAgent class with shadow canvas
- `README.md` — main project docs (needs major update)
- `.context-guardian/checkpoint.md` — running progress log

## Original User Request (verbatim)
> "All of this needs to be updated and documented on https://github.com/sfdimarco so that I can share all the incredible work we have been doing together. I have let Baby0 run all night let me know if it taught us anything. Abstract: Universe-WASM Moiré Parallax Engine for Cognitive Visual Learning..."
