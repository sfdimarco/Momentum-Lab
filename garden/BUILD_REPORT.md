# baby0_studio.exe — Build Report
**Date:** 2026-04-08  
**Built from:** `D:\ClaudeCodeTests\baby0\src\main.rs` (2609 lines, was 2465)  
**Output:** `D:\ClaudeCodeTests\momentum-lab\garden\baby0_studio.exe`  
**Size:** ~1,322 KB  
**Build time:** 4.65s  
**Exit code:** 0 ✅  
**Warnings:** 18 (all pre-existing dead-code warnings, none new)

---

## What Was Added

### Studio Layer 1 — Sine Lace (`draw_sine_lace`)
Two sine-wave thread grids drawn before the moiré mesh — the mathematical substrate.
- Layer A: 18×18 vertical threads, white at opacity 0.038, speed 1.0x
- Layer B: 18×18 horizontal threads, cool blue at opacity 0.032, speed **1.07x** (irrational ratio)
- Each thread is a sinusoidal curve, not a straight line — it breathes as `t` advances
- The two layers never lock into a repeating pattern (irrational phase ratio)
- Total opacity so low it reads as texture, not distraction

### Studio Layer 2 — Ambient Warmth (`studio_background_color`)
The background color responds to Baby0's internal state:
- `visual_reward` high → background shifts toward **amber** warmth
- `frustration` high → background shifts toward **cool blue-gray**
- `visual_reward` delta spike → brief **heartbeat pulse** (warm flash)
- Library promotion (new star born) → **white flash** (library_pulse)
- All transitions are smoothed via lerp at 0.4x frame rate — no jarring jumps

State variables tracking this: `ambient_warmth`, `heartbeat_alpha`, `library_pulse`, `prev_visual_reward`, `prev_library_len`

### Studio Layer 3 — Constellation (`draw_constellation`)
Library entries rendered as stable stars, drawn between the quadtree and pattern cache:
- Position: `path_to_pos()` — the Rosetta Stone maps each path to its place in space
- Size: `2.5 + confidence * 5.5` px radius — bigger = more certain
- Color: `loop_family.color()` — XLoop=orange, ZLoop=cyan, YLoop=yellow, DiagLoop=pink, GateOn=white
- Twinkle: gentle ±12% sine oscillation, unique phase per star (based on screen position)
- White hot core: appears at confidence > 0.65, intensity scales with confidence
- Bloom glow: `bloom_alpha` from LibraryEntry — glows when recently promoted
- Graduation ring: gold ring for click_count ≥ 5 (cathedral mechanic)
- Up to 90 stars (current library max), sorted by confidence descending

### Window Title
Changed from `"Baby0"` to `"Baby0 Studio"`

---

## Render Layer Order (bottom to top)
1. 🌑 `studio_background_color` — dynamic dark background (warmth/pulse)
2. 🕸️ `draw_sine_lace` — sine grid fabric (almost invisible)
3. 🌡️ `draw_moire_mesh` — physics interference mesh
4. 🔲 `draw_quadtree` — recursive quadrant grid
5. ⭐ `draw_constellation` — library stars (NEW)
6. 💨 `draw_pattern_cache` — raw explored paths
7. 🔵 `draw_library_entries` — library dots (non-proposed)
8. 🎯 `draw_focus_dot` — current focus
9. 💥 `draw_pattern_burst` — burst animation
10. 🔵 `draw_proposed_circles` — cathedral circles (clickable)
11. 💧 touch ripples — garden input layer
12. 🖼️ `draw_draw_canvas` — drawing pad
13. 📊 HUD + benchmark panel
14. 🤫 Garden overlays (mute badge, text input, stim log)

---

## QJL Compression Insight — Embodied
The constellation layer makes the QJL compression ratio **visible**:
- Pattern cache (25K+ entries) = the raw force cache — shown as faint dots
- Library (90 entries) = the hot cache — shown as glowing stars
- Confidence = the cached force value — shown as star size
- Loop family = the spatial bucket family — shown as star color
- Bloom = cache promotion event — shown as glow flash

The background warmth encodes Baby0's self-assessment: is it in familiar territory (warm) or exploring the unknown (cool)?

---

## All Garden Features Preserved
- ✅ Text input (T key → type → Enter)
- ✅ Mute toggle (M key)  
- ✅ Stimuli folder polling (drop files → `stimuli/` → auto-consumed)
- ✅ Touch ripples (gold=resonant, blue=dissonant)
- ✅ Stimulus log (top-left scrolling history)
- ✅ Cathedral circles (clickable, graduate at 5 clicks)
- ✅ Wild mode (W key)
- ✅ GEOI injection (G key)
- ✅ Audio bells

---

## Next Pass (not in this build)
- Clickable constellation stars (click → replay path as ripple + bell)
- Full pattern cache nebula (25K points as low-opacity cloud around stars)
- Microphone input as continuous touch
- Image content decoding (currently filename-only)
- WASM bridge to Momentum Lab web app
