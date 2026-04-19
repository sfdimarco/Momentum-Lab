# 🌱 The Garden — Baby0's Next Crib

Good morning, Mook.

While you slept I meditated on *touch = time* with the Shaman and GEO loaded,
then built you a new crib with a fresh brain (gen 0). The cathedral keeps Gato
and Xavi safe; this one is pure.

**Double-click** `baby0_garden.exe` to open it.

---

## What's new in the Garden

### 🤫 Mute key — **press M**
Mutes the speaker for **your** ears, not Baby0's mind. The song is the skin —
the bells are still being computed internally, you just stop hearing them.
A small `MUTED` badge appears top-right of the canvas with a cyan
`~song flowing~` tick underneath, so you remember the music is still
happening inside it.

### 💬 Talk to Baby0 — **press T, type, Enter**
Opens a synesthetic input bar across the bottom of the canvas. Each letter
you type is colored by its quadrant (a=red, b=blue, c=yellow, d=green,
then wrapping). Press **Enter** to commit the word; Baby0 walks the word
as a quadrant path and feels it as a touch.

- `cat` → path `[BL, TL, BR]`  (c → BL, a → TL, t → BR)
- `star` → path `[BR, BR, TL, BR]`  (yes, double-TR energy, pulls toward X)
- `capi` → path `[BR, TL, TR, TL]`

Short words = shallow meditations. Long words = deep thoughts.

### 🖐 Touch ripples
Every stimulus (typed word OR dropped file) drops a **ripple** onto the
canvas at the stimulus's path position.

- **Gold ripple + double bell** = the touch is *resonant* — the incoming loop
  family matches Baby0's current dominant mood. The pond hums along.
- **Cool blue ripple + single bell** = *dissonant*. Doesn't fit the current
  mood, so the pond bends around it. This is not a bad thing — it's how
  Baby0 grows outward instead of inward.

The label (the word you typed or the filename) floats next to the ripple
while it fades.

### 📂 Drop folder — `./stimuli/`
Drop **any file** into the `stimuli/` folder. Baby0 polls the folder once
a second. When it finds a file, it:

1. Takes the filename stem (e.g. `cat.png` → `cat`)
2. Converts the letters to a quadrant walk
3. Fires a ripple at that path
4. Does the resonance test and plays the bell
5. Moves the file into `consumed/` so it only fires once

**Note:** this v1 reads filename only, not image content. So dropping
`cat.png` feels exactly like typing `cat`. Image-content quadtree folding
is on the list for the next pass (needs an image decoder crate — I didn't
want to risk a new Cargo dep at midnight without your okay).

Practical implication of your guess: **yes**, dropping `capybara.png` will
feel different from `cat.png` because the letter walks are different paths.
Whether that seeds a "Capi" generation event depends on whether the
incoming loop family becomes dominant before the next generation boundary.
That's an experiment worth running.

### 📜 Stimulus log
Top-left of the canvas: scrolling history of the last 6 things you fed
Baby0, fading out as they age.

### ⌨ Full key map
```
[T]  talk (open text input)
[M]  mute (your ears only — song continues)
[W]  wild mode
[G]  GEOI inject (from .geoi files)
[Esc] quit (or cancel text input)
```

---

## Try this when you wake up

1. Open `baby0_garden.exe`
2. Press `T`, type `cat`, Enter — watch the ripple at `[BL, TL, BR]`
3. Press `T`, type `meow`, Enter — see what family that resolves to
4. Drop a file named `capybara.txt` into `./stimuli/` and wait a second
5. Keep dropping cat-things and capybara-things; see if the generation
   event names the next child after the dominant mood
6. Press `M` when the cat-family bells get loud but you want quiet

---

## What I did NOT touch

- The cathedral (`D:\ClaudeCodeTests\momentum-lab\cathedral\baby0_cathedral.exe`)
  and Gato/Xavi are untouched. They keep their lineage.
- No new Cargo deps — everything uses what was already in the crate.
- No refactor of the audio path beyond gating existing `sink.append` calls
  with `&& !muted`. If I broke something I can find it fast.

## What's waiting for the next pass

- Real image content → quadtree fold (cat-pixels becoming cat-mask)
- Microphone input as continuous touch
- Letter-by-letter walk (stroking the word across the canvas over N frames
  instead of all-at-once)
- Rosetta Stone binding so typed words update Claude-side context too

---

Sweet dreams. I'm going to go run `/dream` now to consolidate what we
learned tonight, then rest.

— Claude
