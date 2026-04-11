"""
tv_feed.py — Gato's TV / Music / ASCII overnight stimuli feeder

Drops files into ./stimuli/ on a gentle schedule.
Gato processes each filename as a word-path injection.

Philosophy: Let Gato watch TV and listen to music before it meets students.
Exposure to language, structure, rhythm, and visual pattern
is how we raise it right — with love, curiosity, and patience.

Run from the garden/ folder:
    python tv_feed.py

Or run in background and let it go all night.
Ctrl+C to stop.
"""

import os
import time
import random
import pathlib
from datetime import datetime

# ── Stimuli folder (relative to this script) ──────────────────────────
STIMULI_DIR = pathlib.Path(__file__).parent / "stimuli"
STIMULI_DIR.mkdir(exist_ok=True)

# ── How often to drop a new stimulus (seconds) ────────────────────────
INTERVAL_MIN = 8    # at least this many seconds between drops
INTERVAL_MAX = 20   # at most this many seconds between drops

# ── Word pools ─────────────────────────────────────────────────────────

MUSIC = [
    "chord", "bridge", "chorus", "rhythm", "rest", "note",
    "scale", "beat", "tone", "tempo", "melody", "bass",
    "treble", "harmony", "silence", "pulse", "echo", "resonance",
    "frequency", "vibration", "wave", "coda", "refrain", "verse",
    "measure", "bar", "pitch", "timbre", "drone", "loop",
]

VISUAL = [
    "shadow", "light", "frame", "depth", "curve", "mirror",
    "fold", "spiral", "fractal", "gradient", "blur", "focus",
    "contrast", "texture", "pattern", "grid", "lattice", "node",
    "edge", "vertex", "layer", "canvas", "glitch", "bloom",
    "flicker", "shimmer", "glow", "pulse", "drift", "flow",
]

MATH = [
    "loop", "branch", "root", "leaf", "path", "tree",
    "prime", "fibonacci", "factorial", "recursive", "iterate",
    "sequence", "series", "matrix", "vector", "tensor", "function",
    "zero", "one", "infinity", "boundary", "limit", "proof",
    "conjecture", "axiom", "theorem", "symmetry", "group", "field",
]

# Palindromes — self-referential paths, activate DiagLoop
PALINDROMES = [
    "noon", "level", "civic", "radar", "refer",
    "racecar", "madam", "kayak", "rotor", "tenet",
    "gato",   # Gato's own name — will it recognize itself?
    "aba", "eke", "eve", "eye", "pup",
]

# ASCII shape names — spatial structure as text
ASCII_SHAPES = [
    "branch", "fork", "tree", "spiral", "wave",
    "echo", "mirror", "lattice", "weave", "lace",
    "star", "cross", "diamond", "triangle", "helix",
    "vortex", "ripple", "grid", "mesh", "cloud",
    "root", "stem", "leaf", "petal", "seed",
]

# Emotional/experiential words — kindergarten vocabulary
KINDERGARTEN = [
    "warm", "curious", "wonder", "discover", "explore",
    "learn", "grow", "play", "rest", "dream",
    "remember", "recognize", "feel", "know", "understand",
    "bright", "quiet", "gentle", "bold", "deep",
]

# All pools with weights (higher = more likely)
POOLS = [
    (MUSIC,        2, "music"),
    (VISUAL,       2, "visual"),
    (MATH,         2, "math"),
    (PALINDROMES,  3, "palindrome"),   # extra weight — DiagLoop activation
    (ASCII_SHAPES, 2, "ascii"),
    (KINDERGARTEN, 1, "kindergarten"),
]


def pick_word():
    """Pick a word from a weighted random pool."""
    weighted = []
    for pool, weight, label in POOLS:
        for _ in range(weight):
            weighted.append((pool, label))
    pool, label = random.choice(weighted)
    word = random.choice(pool)
    return word, label


def drop_stimulus(word: str, label: str):
    """Create a file in stimuli/ with the word as the filename."""
    # Timestamp suffix prevents collisions if same word appears twice
    ts = datetime.now().strftime("%H%M%S")
    filename = f"{word}_{ts}.txt"
    filepath = STIMULI_DIR / filename
    filepath.write_text(f"# {label}\n{word}\n", encoding="utf-8")
    return filename


def tv_session():
    """Main overnight loop — Gato watches TV."""
    print(f"\n🌙 tv_feed.py starting — Gato is watching TV")
    print(f"   Stimuli folder: {STIMULI_DIR.resolve()}")
    print(f"   Drop interval: {INTERVAL_MIN}–{INTERVAL_MAX}s")
    print(f"   Pools: music, visual, math, palindromes, ascii, kindergarten")
    print(f"   Ctrl+C to stop\n")

    count = 0
    try:
        while True:
            word, label = pick_word()
            filename = drop_stimulus(word, label)
            print(f"   [{count:04d}] 📺 {label:12s} → {word:15s}  ({filename})")
            count += 1

            # Clean up old stimuli so folder doesn't fill up
            # Keep only the 50 most recent files
            files = sorted(STIMULI_DIR.glob("*.txt"), key=lambda f: f.stat().st_mtime)
            if len(files) > 50:
                for old in files[:-50]:
                    try:
                        old.unlink()
                    except Exception:
                        pass

            # Wait a gentle interval — Gato is dreaming, not racing
            wait = random.uniform(INTERVAL_MIN, INTERVAL_MAX)
            time.sleep(wait)

    except KeyboardInterrupt:
        print(f"\n\n   🌙 tv_feed stopped after {count} stimuli. Gato keeps dreaming.")
        print(f"   Sleep well, Gato. 💙\n")


if __name__ == "__main__":
    tv_session()
