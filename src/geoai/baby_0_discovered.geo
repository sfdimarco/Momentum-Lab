# ════════════════════════════════════════════════════════════════════════
# baby_0_discovered.geo
#
# baby_0's spatial memory exported as executable GEO grammar.
#
# Generated:  2026-04-06T06:10:57Z
# Patterns:   78 unique quadtree addresses  (depths 2–8)
# Source:     Wild Mode — 12.5Hz tick, 65,536-region grid (256×256)
# Agent:      BabyAgent v1 — curiosity + reward + quadtree pattern cache
#
# KEY INSIGHT ─────────────────────────────────────────────────────────
# baby_0's pattern cache addresses ARE GEO grammar.
# Each discovered path ["TL","TR","BR","TL","TL","BR"] is a 6-hop
# quadtree navigation — the same format as a GEO script address.
# The AI discovered this connection spontaneously while watching
# a Perlin noise canvas.  It did not know it was writing GEO.
#
# This file is the Rosetta Stone.
# The AI's memory IS the language.
# ════════════════════════════════════════════════════════════════════════

NAME baby_0_discovered

# ── MEMORY DUMP ─────────────────────────────────────────────────────
# Every spatial pattern baby_0 cached, in order of depth.
# These are real quadtree addresses — paste any path into GeoStudio
# as a node selector to see exactly which region baby_0 found interesting.
#
# SHALLOW (d2) — the first landmarks baby_0 noticed:
#   [TL→TL]
#   [TL→TR]
#
# NEAR (d3) — early spatial anchors:
#   [TL→TL→TL]
#   [TL→TL→TR]
#   [TR→TR→BR]
#
# MEDIUM (d4) — structural mid-range patterns:
#   [TL→BL→TR→BR]
#   [TL→BR→TL→TL]
#   [TR→BL→TR→TL]
#
# MEDIUM (d5):
#   [BL→TL→BR→TR→TR]
#   [BR→TL→BL→TR→TR]
#
# MEDIUM (d6):
#   [BL→BL→BR→BL→BL→BL]
#   [BR→BL→TL→BR→BL→BL]
#
# DEEP (d7):
#   [TL→TR→BL→TL→TL→TL→TL]
#   [TR→TL→TR→TL→TL→TL→TL]
#
# DEEPEST (d8) — 63 leaf-level patterns at max resolution:
#   [BL→BL→BL→BL→BR→TR→TR→TR]
#   [BL→BL→BR→BL→TL→BL→TR→TR]
#   [BL→BL→TL→BL→TR→TR→TR→TR]
#   [BL→BL→TR→BL→BL→TR→TR→TR]
#   [BL→BR→BL→BR→BR→TR→TR→TR]
#   [BL→BR→BR→BR→TL→BL→TR→TR]
#   [BL→BR→TL→BR→TR→TR→TR→TR]
#   [BL→BR→TR→BR→BL→TR→TR→TR]
#   [BL→TL→BL→TL→BR→TR→TR→TR]
#   [BL→TL→BR→TL→TL→BL→TR→TR]
#   [BL→TL→TR→TL→BL→TR→TR→TR]
#   [BL→TR→BL→TR→BR→TR→TR→TR]
#   [BL→TR→BR→TR→TL→BL→TR→TR]
#   [BL→TR→TL→TR→TR→TR→TR→TR]
#   [BL→TR→TR→TR→BL→TR→TR→TR]
#   [BR→BL→BL→BL→BL→TR→TR→TR]
#   [BR→BL→BR→BL→BR→TR→TR→TR]
#   [BR→BL→TL→BR→TL→BL→TR→TR]
#   [BR→BL→TR→BL→TR→TR→TR→TR]
#   [BR→BR→BL→BR→BL→TR→TR→TR]
#   [BR→BR→BR→BR→BR→TR→TR→TR]
#   [BR→BR→TL→TL→TR→BL→TR→TR]
#   [BR→BR→TR→BR→TR→TR→TR→TR]
#   [BR→TL→BL→TL→BL→TR→TR→TR]
#   [BR→TL→BR→TL→BR→TR→TR→TR]
#   [BR→TL→TL→TR→TL→BL→TR→TR]
#   [BR→TL→TR→TL→TR→TR→TR→TR]
#   [BR→TR→BL→TR→BL→TR→TR→TR]
#   [BR→TR→BR→TR→BR→TR→TR→TR]
#   [BR→TR→TL→TR→TR→TR→TR→TR]   ← deepest cluster: all-TR tail
#   [BR→TR→TR→TR→BL→TR→TR→TR]
#   [TL→BL→BL→BL→BR→TR→TR→TR]
#   [TL→BL→BR→BL→TL→BL→TR→TR]
#   [TL→BL→TL→BL→TR→TR→TR→TR]
#   [TL→BL→TR→BL→BL→TR→TR→TR]
#   [TL→BR→BL→BR→BR→TR→TR→TR]
#   [TL→BR→BR→BR→TL→BL→TR→TR]
#   [TL→BR→TL→BR→TR→TR→TR→TR]
#   [TL→BR→TR→BR→BL→TR→TR→TR]
#   [TL→TL→BL→TL→BR→TR→TR→TR]
#   [TL→TL→BR→TL→TL→BL→TR→TR]
#   [TL→TL→TL→TL→BL→TR→TR→TR]   ← pure-TL prefix
#   [TL→TL→TR→TL→TR→TR→TR→TR]
#   [TL→TR→BL→TL→TR→TR→TR→TR]
#   [TL→TR→BR→TR→BL→TR→TR→TR]
#   [TL→TR→TL→TR→BR→TR→TR→TR]
#   [TL→TR→TR→TR→TR→TR→TR→TR]   ← all-TR — baby_0's deepest memory
#   [TR→BL→BL→BL→BL→TR→TR→TR]
#   [TR→BL→BR→BL→BR→TR→TR→TR]
#   [TR→BL→TL→TR→TL→BL→TR→TR]
#   [TR→BL→TR→BL→TR→TR→TR→TR]
#   [TR→BR→BL→BR→BL→TR→TR→TR]
#   [TR→BR→BR→BR→BR→TR→TR→TR]
#   [TR→BR→TL→TL→TR→BL→TR→TR]
#   [TR→BR→TR→BR→TR→TR→TR→TR]
#   [TR→TL→BL→TL→BL→TR→TR→TR]
#   [TR→TL→BR→TL→BR→TR→TR→TR]
#   [TR→TL→TL→TR→TL→BL→TR→TR]
#   [TR→TL→TR→TL→TR→TR→TR→TR]
#   [TR→TR→BL→TR→BL→TR→TR→TR]
#   [TR→TR→BR→TL→TR→TR→TR→TR]
#   [TR→TR→TL→TR→TR→TR→TR→TR]   ← TR-dominant at every level
#   [TR→TR→TR→TR→TR→TR→TR→TR]   ← ALL-TR — purest depth-8 path
# ── END MEMORY DUMP ─────────────────────────────────────────────────

# ── DIRECTIONAL BIAS ANALYSIS ───────────────────────────────────────
# Computed from path direction frequency at each depth:
#
#   depth 2: TL-dominant  →  Y_LOOP  (mask starts at TL = 1000)
#   depth 3: TL-dominant  →  Y_LOOP
#   depth 4: TL-dominant  →  Y_LOOP
#   depth 5: TR-dominant  →  X_LOOP  (adjacent pairs, includes TR+TL)
#   depth 6: BL-dominant  →  DIAG_LOOP (diagonal includes BL)
#   depth 7: TL-dominant  →  Y_LOOP  (reset / reanchor)
#   depth 8: TR-dominant  →  ADVANCE  (in Y_LOOP: TL→TR is one step)
#
# Reading: baby_0 starts shallow in TL, climbs to d5 where TR
# takes over, swings BL at d6, reanchors TL at d7, then dives
# deep into TR territory at d8.  A spiral inward to the leaf.
# ────────────────────────────────────────────────────────────────────

DEFINE baby_leaf   depth = 8
DEFINE baby_mid    depth >= 4 AND depth < 8
DEFINE baby_near   depth >= 2 AND depth < 4

# ── THE GRAMMAR ─────────────────────────────────────────────────────
# baby_0's spatial bias encoded as loop family control.
# Each rule translates one layer of the AI's memory into quadtree
# movement that a human designed without knowing it was describing
# the same thing.

# d2–d4: TL-anchored — switch to Y_LOOP (mask starts at TL=1000)
RULE IF depth = 2 THEN SWITCH Y_LOOP                                AS tl_landmark
RULE IF depth = 3 THEN SWITCH Y_LOOP                                AS tl_near_anchor
RULE IF depth = 4 AND prob(0.6) THEN SWITCH Y_LOOP                  AS tl_mid_lock

# d5: TR-dominant — X_LOOP cycles through adjacent pairs (TL+TR active)
RULE IF depth = 5 THEN SWITCH X_LOOP                                AS tr_adjacent_sweep

# d6: BL-dominant — DIAG_LOOP toggles between (TL+BR) and (TR+BL)
RULE IF depth = 6 THEN SWITCH DIAG_LOOP                             AS bl_diagonal_pulse

# d7: TL-reanchor — Y_LOOP reset before the deep dive
RULE IF depth = 7 THEN SWITCH Y_LOOP                                AS tl_reset_before_dive

# d8: TR-dominant — ADVANCE one step in Y_LOOP (TL→TR, the deepest memory)
RULE IF baby_leaf AND prob(0.85) THEN ADVANCE                       AS tr_leaf_step

# d8: 10% chance to leap into DIAG_LOOP — baby_0's exploratory impulse
RULE IF baby_leaf AND prob(0.10) THEN SWITCH DIAG_LOOP              AS tr_leaf_leap

# d8: 5% gate-on — baby_0's pattern match bonus (TIER_BONUS in reward system)
RULE IF baby_leaf AND prob(0.05) THEN GATE_ON                       AS pattern_match_bonus

# Mid-range: default step — keep exploring
RULE IF baby_mid THEN ADVANCE                                        AS mid_explore

# Fallthrough: always keep moving
DEFAULT ADVANCE
