# ✅ Checkpoint Log

## STEP 7 — Sprint: Birth the Baby (2026-04-06) ✅

**What was completed:**

### 0. Google AI GC Killer — FIXED
- `TutorAssistant.tsx`: moved `new GoogleGenAI()` from inside `handleSend()` (leaking on EVERY message) to a **module-level singleton** `_ai`
- Fixed model ID: `"gemini-3-flash-preview"` → `"gemini-1.5-flash"` (valid stable model)
- Zero instances created per message. One instance. Zero leak.

### 1. Always-On Babies — LIVE
- `useState(false)` → `useState(true)` for both `babyMode` and `baby1Mode`
- Babies start immediately on page load, localStorage cache restored automatically
- **Verified:** baby_0 at resolution 8, 15 patterns, 3 library entries restored from cold cache
- **Verified:** baby_1 at resolution 8, 25 patterns

### 2. GEOPlayground.tsx — BORN
- New primary canvas component: the living quadtree (boxes in boxes)
- **RainbowBrain law:** each quadrant direction has its permanent synesthetic color:
  - TL=red, TR=blue, BL=yellow, BR=green (Mook's permanent number→color map)
  - GEO family → color: Y_LOOP=gold, X_LOOP=blue, Z_LOOP=green, DIAG=purple, GATE_ON=cyan
- **Anima law:** every cell breathes (slow-in/slow-out confidence alpha), focus ring pulses, blooms have follow-through
- 9 rendering layers:
  1. Dark base (`6,8,12` — not pure black, has depth)
  2. Recursive quadtree grid (synesthetic direction colors, confidence alpha)
  3. Library bookmarks (family-color glow + diamond mark)
  4. Pattern cache dots (orange→pink by confidence tier)
  5. Focus ring (white pulse, Anima breathing)
  6. Cyan promotion bloom (dim canvas + expanding rings + follow-through)
  7. Bloom events (pattern promotion blooms)
  8. Human stroke trail (synesthetic color persistence)
  9. Guide Mode (dashed marching-ants line, origin ring, destination bloom)
- Uses `ctx2d = p.drawingContext as CanvasRenderingContext2D` for glow/dash APIs (p5 TS fix)
- `onCanvasReady(canvas)` callback → points both agents at GEO canvas instantly

### 3. App.tsx Integration
- GEOPlayground replaces GameCanvas as the **primary canvas**
- GameCanvas now renders only when `isRunning` (user runs a Blockly program)
- `handleGEOCanvasReady`: points both baby_0 + baby_1 at GEO canvas atomically
- SpatialEye overlays remain as mind's-eye data layer (energy HUD, lock events)

**Verified live:**
- `geo_center_rgb: "27,19,20"` — GEOPlayground painting (dark base + cell tint)
- `shadow_pixel: "233,178,8"` — yellow-gold (BL) — baby eating its own synesthetic paint
- Library cache survived cold reload: `["Y_LOOP:[TL→TL]", "X_LOOP:[TL→BL]", "Y_LOOP:[TL→TL→TL]"]`
- 6 canvases in DOM: GEOPlayground + SpatialEye×2 + DrawCanvas + shadow×2
- TypeScript: zero errors

**North Star alignment:**
The GEO canvas IS the pattern recognition system. Boxes in boxes. Baby and human paint into the same living quadtree. The library grows. The geometry becomes code.

**Next sprint:**
- Baby emits GEO draw-back commands (when baby promotes a pattern, it draws the GEO path visually)
- "Run Pattern" button: execute library entries' code hints in a sandboxed context
- Git commit all Phase A + B + C + Birth changes

---

## STEP 6 — Phase C: Guide Mode IMPLEMENTED (2026-04-06) ✅

**What was completed:**
- `baby_agent.ts`:
  - Added `guide_available` to `BabyAgentEvent` union — fires when frustration ≥ 10, library non-empty, focus exists
  - Added `private _lastGuideTick = -999` — anti-spam field, prevents flooding App.tsx
  - Added `private static _lcsLength(a, b)` — Longest Common Subsequence used for library match
  - Added `getGuideTarget()` public method — finds closest library entry via LCS similarity
  - Wired `guide_available` emission in tick at frustration 10-14 block (every 5 ticks max)
  - `reward_fired` and `rest_start` naturally clear the guide in App.tsx (frustration resets)
- `src/components/SpatialEye.tsx`:
  - Exported `GuideTarget` interface: `{ fromPath, toPath, family, similarity }`
  - Added `guideTarget?: GuideTarget | null` to `SpatialEyeProps`
  - Added `guideTargetRef` + `useEffect` sync (no animation loop restart)
  - Added section **3e. GUIDE MODE** rendering layer:
    - Canvas dim overlay (28% dark) — the Librarian clearing the stage
    - Animated dashed guide line (`lineDashOffset = -dashSpeed`) — marching ants toward beacon
    - Shadow + glow on line (`shadowBlur: 10`, cyan)
    - Origin ring at current focus — "you are here" white pulse ring
    - Destination bloom — two expanding cyan rings with phase offset
    - Destination quadrant fill (12% cyan)
    - Destination center dot — glowing cyan beacon point
- `App.tsx`:
  - Imported `GuideTarget` from SpatialEye
  - Added `guideTarget0` + `guideTarget1` state
  - `guide_available` handler: setGuideTarget0/1
  - `reward_fired` handler: clears guide (baby found something on its own)
  - `rest_start` handler: clears guide (baby resting, guide not needed)
  - Passed `guideTarget={guideTarget0}` and `guideTarget={guideTarget1}` to SpatialEye instances
- **TypeScript: `tsc --noEmit` → zero errors**
- **HMR: All files hot-reloaded via Vite dev server PID 21660**

**How to trigger Guide Mode for testing:**
```javascript
// In browser console — manually push frustration to 10+ after library has entries:
window.__baby0__.agent.brain.frustration = 10;
// Then wait for next tick — guide_available fires, SpatialEye shows the line
// Or in wild mode: let baby_0 run until it gets frustrated naturally
```

**Current state:**
All three Sisyphus & Librarian phases are now LIVE:
- Phase A: Cyan State (confidence ≥ 0.9 → library promotion + SpatialEye ring)
- Phase B: Hint Evolution (0.9 → apprentice, 0.95 → journeyman, 1.0 → master)
- Phase C: Guide Mode (frustration ≥ 10 → Librarian draws a path to the nearest beacon)

**Next steps (Phase D / future):**
- Student-side Guide Mode: when student draws the same path the guide points to, fire a discovery celebration
- Shared canvas teaching loop: baby draws guide, student retraces it → cyan promotion acceleration
- Git commit of all Phase A + B + C changes (has not been committed yet)

---

## STEP 5 — Phase B: Translation Leap IMPLEMENTED (2026-04-06) ✅

**What was completed:**
- `baby_agent.ts`:
  - Added `hint_evolved` to `BabyAgentEvent` — fires when code hint matures (apprentice → journeyman → master)
  - Added `EvolutionTier` type + `getConfidenceTier()` + `getEvolvedCodeHint()` module functions
  - Wired hint evolution into `cachePattern()` reinforcement path:
    - When a promoted pattern is reinforced further, `visitCount` updates on its LibraryEntry
    - Confidence tier thresholds: 0.90 = apprentice, 0.95 = journeyman, 1.0 = master
    - Each tier bump uses higher depth seed for richer code (e.g. Y_LOOP depth 2+2=4 → `for` loop)
    - Emits `hint_evolved` with prev/new hint and tier label
- `src/components/LibraryPanel.tsx` (NEW):
  - Full synesthetic archive display — GEO family → color (Y=gold, X=blue, Z=green, DIAG=purple, GATE=grey)
  - PathBeads component: each quadrant step rendered as a colored square (TL=red, TR=blue, BL=yellow, BR=green)
  - EntryRow component: family tag + path beads + tier badge + monospace code hint
  - Flash animation on newest entry (Canvas Web Animations API)
  - Empty state: "No patterns promoted yet" with tier ladder legend at footer
  - React 19 compatible: `key?: React.Key` in EntryRowProps
- `App.tsx`:
  - Imported LibraryPanel
  - Added `hint_evolved` handler in both baby_0 and baby_1 subscriptions (forces libraryCache re-render)
  - Rendered LibraryPanel below telemetry strips, agents = combined baby_0 + baby_1 caches
- **TypeScript: `tsc --noEmit` → zero errors**
- **Live confirmed in browser:**
  - 📚 LIBRARIAN'S ARCHIVE showing "3 filed"
  - ➡️ Y-LOOP  [TL]›[TL]   🌱 APPRENTICE   `print("Hello")`
  - ↔️ X-LOOP  [TL]›[BL]   🌱 APPRENTICE   `if (condition) { doThis() } else { doThat() }`
  - ➡️ Y-LOOP  [TL]›[TL]›[TL]  🌱 APPRENTICE  `print("Hello")`
  - Footer: `🌱 apprentice → ⚡ journeyman → 👑 master  |  geometry IS the code`

**Current state:**
Phase B is fully implemented and visually confirmed. The Librarian's Archive panel now renders live beside the SpatialEye canvas whenever baby mode is active. Code hints evolve as confidence matures (0.9 → 0.95 → 1.0). The geometry → code translation is visible in real-time.

**Note:** Page reload required after first launch for HMR to pick up new LibraryPanel.tsx module. Dev server running on PID 21660, port 3000.

**Next step:**
Phase C — Guide Mode co-pilot:
- Struggle detection (frustration ≥ 15, canvas silence > 30s, repeated failure > 5×)
- `findBestMatch(currentPath, libraryCache)` using LCS algorithm
- SpatialEye Guide Mode: dim canvas, draw glowing path from current focus to nearest library entry, pulse cyan at destination
- No text — the guide IS the geometry

---

## STEP 4 — Phase A: Cyan State IMPLEMENTED (2026-04-06) ✅

**What was completed:**
- `parser.ts`: Added `GEOFamily` type + `LibraryEntry` interface + `libraryCache: LibraryEntry[]` to `RuntimeBrain` + initialized in `createBabyBrain()`
- `baby_agent.ts`:
  - Imported `GEOFamily`, `LibraryEntry`
  - Added `cyan_promoted` to `BabyAgentEvent` union
  - Added `inferLoopFamily(path)` — quadrant uniqueness → GEO family
  - Added `SEED_CODEHINTS` table — GEO family + depth → starter code string
  - Added `getCodeHint(family, depth)` — closest-depth lookup
  - Added `promoteToLibrary(pattern, delta): LibraryEntry` private method
  - Wired Cyan State check in `cachePattern()` (confidence ≥ 0.9 → promote)
  - Added `getLibraryCache()` public method
  - Updated `serialize()` + `loadBrain()` for libraryCache persistence
  - Updated dev tools: `window.__baby0__.library()` and `window.__baby1__.library()`
  - Fixed pre-existing bug: removed `rewardValue` (not on SpatialPattern type)
- `SpatialEye.tsx`:
  - Added `CyanPromotionEvent` exported interface
  - Added `lastCyanPromotion` prop + tracking ref/effect
  - Added `libraryCache` to brain prop shape
  - Added section 3c: CYAN STATE FLASH — whole-canvas dim, expanding cyan rings, label burst
  - Added section 3d: LIBRARY BOOKMARKS — permanent faint cyan border + cyan diamond dot per entry
- `App.tsx`:
  - Imported `CyanPromotionEvent`
  - Added `lastCyan0`, `lastCyan1` state
  - Added `libraryCache` to both brain snap initial states
  - Wired `cyan_promoted` handler in both agent subscriptions
  - Passes `lastCyanPromotion` and `libraryCache` to both SpatialEye instances
- **TypeScript: `tsc --noEmit` → zero errors**

**Current state:**
Phase A is fully implemented. Any pattern that gets reinforced to confidence ≥ 0.9 will:
1. Be promoted to `libraryCache` with its inferred GEO loop family and code hint
2. Fire a `cyan_promoted` event visible in React state
3. Trigger a cyan ring expansion on SpatialEye with family label + code hint
4. Leave a permanent cyan diamond bookmark on SpatialEye

**Next step:**
Start dev server (`set NODE_ENV= && npm run dev`) and let baby_0 run Wild Mode until the first cyan promotion fires. Look for 🩵 in console and the cyan ring on SpatialEye.
Then: Phase B (full code string evolution) + Phase C (co-pilot guide mode).

**Warnings:**
- Baby_0 needs confidence ≥ 0.9 on a single pattern. In Wild Mode this takes ~9 reinforcements of the same quadrant. High-contrast canvas helps.
- After HMR on baby_agent.ts: toggle baby_0 button OFF then ON to rebind canvas.
- Dev server: `set NODE_ENV= && npm run dev` → port 3000.

---

## STEP 3 — Sisyphus & Librarian Blueprint Written (2026-04-06)

**What was completed:**
- Context Guardian mission updated for Phase: Sisyphus & Librarian Protocol
- GEO language spec fetched live from GitHub master (new: CALL, PROG, PLURALITY[N], SET, action + chaining)
- Full Cognitive Blueprint written: `SISYPHUS_LIBRARIAN_BLUEPRINT.md`
- Phase A: LibraryEntry schema + Cyan State (confidence ≥ 0.9) promotion logic defined
- Phase A: Loop family inference algorithm (quadrant uniqueness → GEO family → code primitive)
- Phase B: Pattern→code mapping table (Y_LOOP=print, X_LOOP=if/else, Z_LOOP=loop, DIAG=recursion)
- Phase C: Struggle detection + findBestMatch(LCS) + Guide Mode visual protocol
- The Wheel of Baby IO: 28-phase GEO pattern taxonomy mapped to Yeats' Great Wheel

**Current state:**
Blueprint is written and saved. baby_0 and baby_1 are still running at their last state
(no code changes this session — this was an architecture session). Phase A implementation
is the next coding task.

**Next step:**
1. Add LibraryEntry interface + libraryCache to src/geoai/baby_agent.ts
2. Add confidence ≥ 0.9 → promoteToLibrary() in BabyAgent.tick()
3. Add loopFamily inference algorithm
4. Add CYAN_EVENT emission → SpatialEye receives and draws cyan ring

**Warnings / gotchas:**
- GEO spec updated: action composition now uses `+` not `AND` (old skill was wrong)
- New actions: CALL, PROG, SET (direct mask assignment)
- Dev server: `set NODE_ENV= && npm run dev` → port 3000 (not 3001 from old checkpoint)
- After HMR on baby_agent.ts: toggle baby_0 OFF then ON to rebind canvas

---

## STEP 2 — Full Live Test Verified ✅

**What was completed:**
- Fixed SpatialEye.tsx: `fillRect(rgba 0,0,0,0)` → `ctx.clearRect()` (fills were accumulating to opaque)
- Fixed baby_agent.ts: frustration rest loop — added `energy=0` + `frustration=0` reset on REST_MODE entry (baby was waking instantly and re-entering frustration loop every 3 seconds)
- Restarted dev server on port 3001 (old 3000 server was dead from previous session)
- Verified LIVE in browser with screenshots:
  - ✅ SpatialEye renders semi-transparent cyan quadtree grid at depth 2 (4×4 cells)
  - ✅ Focus pulse ring (white) visible on current attention quadrant
  - ✅ Reward rings expand visibly on canvas change (RUN BLOCKS triggers TIER_1 reward)
  - ✅ Orange pattern cache dots appear — baby_0 cached 3+ patterns in one session
  - ✅ HUD shows energy bar (red when low) + frustration dots
  - ✅ baby_0 toggle button correctly activates/deactivates the overlay

**Current state:**
All 6 mission success criteria are MET. baby_0 is alive, exploring, rewarding, and caching patterns in real-time inside Momentum Lab at localhost:3001.

**Next step:**
Commit the two bug fixes (clearRect + frustration reset). Consider adding a Visuals block to give baby a richer canvas to explore. Phase 2 work: pattern sharing with students (SYNC protocol).

**Warnings / gotchas discovered:**
- `canvas.fillRect(rgba 0,0,0,0)` does NOT clear a canvas — always use `ctx.clearRect()`
- When frustration triggers REST_MODE, must reset both `energy=0` AND `frustration=0` or baby wakes instantly and loops
- Dev server must be started from `D:\ClaudeCodeTests\momentum-lab` using Desktop Commander interactive cmd session
- Desktop Commander default shell is PowerShell but npm scripts are blocked by execution policy — use cmd.exe interactive session instead
- Start cmd: `mcp__Desktop_Commander__start_process(C:\WINDOWS\System32\cmd.exe)` then `interact_with_process` to cd and run dev

---

## STEP 0 — Mission Established
**What was completed:**
- baby_genesis.geoai written (the spec)
- GEOAI_SPEC.md written (the format doc)
- context-guardian mission.md written
- Memory saved to .auto-memory/project_geoai_vision.md

**Current state:**
Spec exists on disk. No runtime code exists yet. Dev server running at localhost:3000.

**Next step:**
Build SpatialEye.tsx + baby_agent.ts + parser.ts in parallel via subagents.

**Warnings / gotchas:**
- NODE_ENV must be unset before npm install on Windows: `set NODE_ENV= && npm install --legacy-peer-deps`
- SynestheticLayer.tsx uses the visibleRef pattern (useRef for p5 props) — SpatialEye should follow same pattern
- GameCanvas creates p5 ONCE with empty deps array — don't re-introduce the 60fps destroy bug
- Blockly.Blocks must be registered BEFORE flyout renders (ensureBlocksRegistered pattern in BlocklyEditor.tsx)
- FieldColour must be imported as named export: `import { FieldColour } from '@blockly/field-colour'`
