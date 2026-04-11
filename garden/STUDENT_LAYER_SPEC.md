# Student Layer Spec — The Next Interface
**Status:** Vision stub (not yet built)  
**Depends on:** baby0_studio.exe (Layer 1-3 complete)  
**North Star:** Would a 9-year-old get a spark of magic in under 3 seconds?

---

## What the Student Layer Does

Baby0 Studio is currently a research instrument — beautiful to Mook and to researchers, but opaque to a 4th grader. The Student Layer wraps the same engine in a kid-accessible skin without changing Baby0's internals.

The key insight from the Council: **Baby0's comfort signals are already there. We just need to translate them.**

---

## The Translation Map

| Baby0 internal state | Research view (now) | Student view (next) |
|---------------------|--------------------|--------------------|
| `visual_reward` high | Amber background warmth | "Gato is happy 😊" warm glow |
| `frustration` high | Cool blue shift | "Gato is thinking..." cooler hue |
| Library promotion | White flash | "Gato learned something! ⭐" |
| Resonant touch | Gold ripple | "Gato liked that! 🟡" |
| Dissonant touch | Blue ripple | "Gato is surprised! 🔵" |
| Constellation star (high confidence) | Bright star | "Gato knows this one really well!" |
| Library pulse | Flash | Star burst animation |

---

## The Kid Interface Components

### 1. The Mood Ring (replaces benchmark panel for kids)
A large circular mood indicator in the top-right corner.
- Warm amber = comfortable, familiar territory
- Cool blue = exploring, learning something new
- Slowly pulsing = healthy heartbeat
- Fast pulsing = excited (high visual_reward delta)

This is the same `ambient_warmth` + `heartbeat_alpha` data, just rendered as a circle instead of a number.

### 2. The Star Counter
"Gato knows __ things" — just `brain.library.len()` rendered as a friendly counter.
When it increments: star burst animation + sound celebration.

### 3. Talk to Gato (simplified)
The T-key text input already works. The student version just needs:
- A friendlier prompt: "Say something to Gato..." instead of the technical bar
- The ripple color response (gold/blue) is already there — that IS the feedback
- Add a simple text label: "Gato hummed! (it agreed)" or "Gato bent! (it's thinking)"

### 4. Drop Zone (simplified)
The stimuli folder already works. Student layer adds:
- A visible drag-drop area on the canvas (currently just a folder)
- "Drop a picture or word for Gato!" label
- Visual feedback when a file lands

### 5. The Pattern Teacher (Phase 2 — Mentor Mode)
When a student draws a pattern on the draw canvas, Baby0:
1. Receives the drawing as a path via the existing inject mechanism
2. Checks if the path is resonant or dissonant with its current state
3. If resonant: extends the pattern (adds more steps in the same family)
4. If dissonant: offers a "bridge" path (finds the nearest resonant path in library)

The student sees: "Gato wants to add to your drawing!" → Baby0's extension appears.
This is the atomic unit: Student draws → Baby0 responds → Student learns recursion/patterns.

---

## Implementation Plan (when ready)

### Option A: Overlay mode (easiest)
Add a `student_mode: bool` flag to the exe.
When true: hide the HUD, benchmark panel, and focus dots. Show the mood ring + star counter instead.
Toggle with S key (for teacher to switch modes during class).

### Option B: Separate web skin (better for class)
Run baby0_studio.exe in the background.
A React page (Momentum Lab web app) reads `brain.json` every second and renders the student-friendly overlay.
Students interact via the Momentum Lab UI; Baby0 processes via the stimuli folder.

This is the **WASM bridge** the Architect was asking for — and the student interface is the reason to build it.

### Option C: Two windows (research + student simultaneously)
baby0_studio.exe stays open for Mook/researcher.
A second lightweight window (p5.js or Macroquad overlay) renders the kid interface.
They share `brain.json` as the data bus.

---

## The Atomic Learning Unit (from the Council)

> Student does X → Baby0 does Y → Student learns Z

Example:
- Student draws a branching pattern (TL→TR→TL→TR...) — an XLoop family
- Baby0's constellation shows XLoop stars lighting up (orange glow)
- Baby0 extends the pattern: adds 2 more XLoop steps, emits a resonance chord
- Student sees: "Gato liked that! It kept going!"
- Student learns: **patterns have families. XLoop = branching. Your drawing fits a family.**

This is recursion made tangible without the word "recursion."

---

## Research Measurements (for the paper)

When Student Layer is live, log:
1. `student_action_ts` — timestamp of every student input
2. `baby0_response_type` — resonant or dissonant
3. `library_growth_rate` — does Baby0 learn faster with student interaction?
4. `student_session_length` — how long does a kid stay engaged?
5. `pattern_family_distribution` — what loop families do students favor?

Compare: Baby0 with students vs. Baby0 in wild mode alone.
Hypothesis: Baby0 + students → faster library crystallization + more diverse family distribution.

---

*The stars are already there. The kids just need a window to see them.*
