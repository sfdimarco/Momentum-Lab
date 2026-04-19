# SAGE — Know Before You Enter
*The rabbit holes. The guardrails. The green path.*

---

## Before Every Session: The 3 Reads
1. Read `.context-guardian/mission.md` — what are we building?
2. Read `.context-guardian/checkpoint.md` — where did we stop?
3. Check one Phase 1 success criterion — can we check a box today?

If you can't check a box today, don't start the session yet.
Redesign until you can.

---

## The Rabbit Holes

| Hole                              | Cost    | Sage Alternative                          |
|-----------------------------------|---------|-------------------------------------------|
| rusqlite + wasm-bindgen on Windows| 2 days  | BTreeMap + GrammarStorage trait           |
| WASM pipeline before algo works   | 4 hours | Native `cargo run` binary first           |
| Non-power-of-2 grid panics        | 1 day   | Pad to next power-of-2 on input           |
| Over-engineering TransformType    | 1 week  | Start with `Unknown`, add types from data |
| Full React harness before encoder | 3 days  | Standalone HTML p5.js file first          |
| Morton encoding from scratch      | 2 days  | Use the `morton` crate (2 lines)          |
| SQLite schema design up front     | 3 days  | BTreeMap first, migrate with trait swap   |

---

## The Green Build Path

```
✅ Step 1  cargo new babyzero-cortex --bin
           Define structs (no logic). Does it compile?

✅ Step 2  Background detection on a hardcoded 3×3 grid.
           Print: "Background: 9"

✅ Step 3  Quadtree builder. Print as ASCII. Verify by eye.

✅ Step 4  Morton encoding (use crate). Print z_order per node.

✅ Step 5  Diagonal pass. Print: "N diagonal pairs found."

✅ Step 6  GEOI binary serialize → write to file.

✅ Step 7  p5.js HTML harness reads file → draws colored rects.

🛑 STOP   Check in with Mook. Does it feel right?
           Is the object isolated? Is the color map singing?
           Only proceed to Phase 2 with explicit green light.
```

---

## The Color Is Data

When in doubt: ask "what color is this?" If the answer is "I don't know
what it means" — that's the bug. BabyZero never touches a node it can't
name in color.

```
0 = Cyan    = background, suppress
1 = Red     = focal, single active
2 = Blue    = structural pair
3 = Yellow  = high signal
4 = Green   = complex, growing    ← we are here
5 = Orange  = warm structural
6 = Purple  = deep diagonal
7 = Pink    = soft outlier
8 = White   = boundary / flood
9 = Black   = ground (like 0)
```

---

## The Sage Mantra

> Language before types.
> Soul before body.
> Proof before cathedral.
> Check in before Phase 2.
