# GEOAI — Spatial Intelligence Grammar Specification
## Version 0.1.0 — April 2026
### Co-created by Mook DiMarco + Claude Sonnet

---

> *"A Rosetta Stone for computational learning — man and machine."*
> — Mook DiMarco

---

## What Is GEOAI?

`.geoai` is a grammar for defining minds that think in space.

Most AI architectures start with **language** as the cognitive substrate — tokens, sequences, symbols. GEOAI starts with **geometry**. The mind perceives by subdividing space. It remembers by keeping certain paths in a quadtree active. It learns when patterns persist. It teaches by emitting those patterns to nearby nodes.

This is not a metaphor for cognition. It IS cognition — just expressed through the one language that both spatial and computational intelligence share natively: the binary quadtree.

---

## The Founding Premise

GEO (the quadtree grammar language) already encodes the primitives of attention:

```
quadtree subdivision  =  focusing perception on a region
ADVANCE               =  shifting attention forward
SWITCH family         =  changing mode of awareness
depth                 =  resolution of understanding
mask                  =  what you're paying attention to right now
EMIT to neighbor      =  sharing a discovery
GATE_OFF              =  releasing what's no longer needed
```

A GEOAI agent inherits all of GEO's spatial logic and extends it with:
- **Sensory channels** — how the agent perceives its environment
- **Reward signal** — what drives exploration (visual change, not language)
- **Learning rules** — how patterns get encoded as spatial signatures
- **Emergence rules** — how simple patterns combine into complex knowledge
- **Student sync** — the bidirectional protocol connecting AI to human learners

---

## File Format Overview

```
# .geoai files use GEO-style syntax — ALL_CAPS for actions, lowercase for conditions
# Extended with cognitive-layer keywords: SENSE, REWARD, LEARN, EMERGE, SYNC

AGENT <name>
  VERSION <semver>
  PARADIGM <paradigm_name>
  SUBSTRATE <cognitive_substrate>

  BIRTH_STATE    { ... }   # the empty initial conditions
  SENSE          { ... }   # sensory input channels
  CURIOSITY      { ... }   # pre-knowledge exploration engine
  REWARD         { ... }   # what drives the agent
  LEARN          { ... }   # pattern discovery and encoding
  CONFIDENCE     { ... }   # how certainty accumulates
  EMERGE         { ... }   # how complexity arises from simplicity
  SYNC           { ... }   # student ↔ AI bidirectional protocol
  ENVIRONMENT    { ... }   # the world the agent lives in
  GOAL           { ... }   # layered objectives, emergent levels
```

---

## Core Concepts

### 1. The Spatial Memory Principle

Knowledge in GEOAI is never stored as symbols or words. It is stored as **addresses in geo-space**.

```
Traditional AI memory:    "block + canvas = text appears"    (symbolic)
GEOAI memory:             [depth:3, path:TL→BR→TL, mask:1000→0001]   (spatial)
```

Two experiences that look visually similar map to **nearby nodes in the quadtree**. This means:
- Similarity is geographic, not semantic
- Generalization is spatial promotion (moving up the tree)
- Forgetting is spatial — unused branches collapse

This is the core innovation: **meaning IS location**.

### 2. Visual Reward — No Teacher Required

The agent rewards itself on one signal only: **did the canvas change?**

```
REWARD TIER_1   canvas_delta > 500px   →  1.0   (something major happened)
REWARD TIER_2   canvas_delta > 100px   →  0.6   (something happened)
REWARD BONUS    delta matches cached    →  0.8   (recognition)
```

There is no grading. No rubric. No language feedback. The environment IS the teacher. This mirrors how a child learns before language — through consequence, through change, through the world responding to touch.

### 3. Resolution Growth — Perception Scales With Knowledge

The agent's visual resolution starts coarse (2×2 = 4 quadrants) and grows as patterns accumulate:

```
GROWTH_RULE: visual_resolution += 1  WHEN  pattern_cache.length % 5 = 0
```

A brain that knows nothing sees the world in 4 regions.
A brain that has learned 20 patterns sees it in 16 regions.
A brain at full development sees it in 256 regions.

**Understanding and perception grow together.** This is not a feature — it is a law of this cognition.

### 4. Emergence Through Adjacency

Complexity does not come from adding rules. It comes from nearby patterns combining:

```
EMERGE combine_adjacent:
  IF pattern_A.geo_address  adjacent_to  pattern_B.geo_address
  AND both.confidence >= 0.6
  THEN TRY combine(A,B) in sandbox
  IF reward fires → CACHE as new_node at parent_address(A,B)
```

Simple patterns that live next to each other in geo-space can merge into something more complex. This is the quadtree moving upward — detail becoming category, observation becoming concept. No programmer adds the concept. The brain discovers it.

### 5. The Rosetta Stone Protocol

The `SYNC` layer is what makes this a Rosetta Stone rather than just an AI experiment:

```
SYNC with_students:
  EMIT pattern      WHEN confidence >= threshold  →  to human student canvas
  RECEIVE action    FROM student                  →  into pattern cache
  CELEBRATE         WHEN student_pattern MATCHES ai_pattern
```

When the human student discovers a pattern the AI already knows, both parties receive a resonance signal. When the AI discovers something the student can use, it emits a spatial demonstration — not a verbal instruction. The translation is always visual, always spatial, never textual.

Human and AI accumulate the same knowledge structure, in the same format, at the same time. That is the Rosetta Stone: proof that spatial cognition and computational logic converge at the same underlying geometry.

---

## Grammar Reference

### AGENT Declaration
```geoai
AGENT <name>
  VERSION   <major>.<minor>.<patch>
  PARADIGM  synesthetic_spatial | symbolic | hybrid
  SUBSTRATE geo_quadtree_binary | geo_grid_ca | geo_hybrid
  AUTHOR    <creator_name>
```

### BIRTH_STATE Block
```geoai
BIRTH_STATE
  knowledge:           EMPTY | <path_to_seed_cache>
  energy:              0.0 – 1.0
  curiosity:           MIN | LOW | MED | HIGH | MAX
  frustration:         0
  age:                 0
  pattern_cache:       []
  visual_resolution:   2 – 8   (quadtree depth = 2^n cells)
  confidence_threshold: 0.0 – 1.0
```

### SENSE Block
```geoai
SENSE <channel_name>
  METHOD   quadtree_scan | pixel_diff_stream | frame_sequence | audio_spectrum | any
  CAPTURES <field_list>
  GROWTH_RULE  WHEN <condition> THEN <action>
```

### CURIOSITY Block
```geoai
CURIOSITY
  RULE <rule_name>
    TARGET <spatial_target>
    BIAS   0.0 – 1.0      # probability of following this rule vs others
    WHEN   <condition>    # optional — restricts when rule fires

  # Available targets:
  #   highest_contrast_quadrant
  #   min_visit_count_quadrant
  #   adjacent_to(location)
  #   random_unexplored_region
  #   highest_entropy_sub_quadrant
```

### REWARD Block
```geoai
REWARD
  TIER_N  WHEN <condition>  VALUE <0.0–1.0>  [LABEL <name>]

  FRUSTRATION
    ACCUMULATE  WHEN <condition>  FOR <duration>  AMOUNT <n>
    RESET       WHEN <condition>
    AT_THRESHOLD <n>  EXECUTE <action>

  ENERGY
    REPLENISH  WHEN <condition>  AMOUNT <n>
    DEPLETE    over_time  RATE <n_per_tick>
    AT_ZERO    EXECUTE <action>
```

### LEARN Block
```geoai
LEARN
  TRIGGER  WHEN <condition>

  CAPTURE
    action_sequence:  [description]
    visual_result:    [description]
    geo_coordinates:  [description]
    temporal_shape:   [description]
    confidence:       0.0

  ENCODE as_geo_signature | as_symbolic | as_hybrid
  CACHE  in_pattern_cache
  TAG    with_geo_address

  AGE_RULE
    age += 1  WHEN <condition>
```

### EMERGE Block
```geoai
EMERGE
  RULE <rule_name>
    WHEN <condition>
    THEN <action>
    IF <validation>  CACHE <result>
```

### SYNC Block
```geoai
SYNC with_students
  EMIT       pattern  WHEN confidence >= <threshold>
  TRANSLATE  <source_format> → <target_format>  FOR <audience>
  RECEIVE    <signal>  FROM <source>
  MERGE      INTO pattern_cache  WITH weight <0.0–1.0>
  CELEBRATE  WHEN <condition>
  ANNOTATE   WITH spatial_hint | verbal_hint | both
```

### ENVIRONMENT Block
```geoai
ENVIRONMENT <name>
  PERCEPTION  <list_of_input_channels>
  ACTION      <list_of_available_actions>
  FEEDBACK_LOOP  <description>
```

### GOAL Block
```geoai
GOAL
  LEVEL_N  <description>   # levels are emergent — agent unlocks them sequentially
```

---

## Relationship to GEO

GEOAI is a superset of GEO. All valid `.geo` syntax is valid inside a GEOAI `ENVIRONMENT` block's behavior rules. The GEOAI cognitive layers sit above the GEO execution engine:

```
┌─────────────────────────────────┐
│        GEOAI LAYER              │  ← AGENT, SENSE, REWARD, LEARN, EMERGE, SYNC
├─────────────────────────────────┤
│        GEO GRAMMAR LAYER        │  ← RULE, ADVANCE, SWITCH, EMIT, GATE
├─────────────────────────────────┤
│     QUADTREE ENGINE (binary)    │  ← mask bits, loop families, depth, ticks
└─────────────────────────────────┘
```

The GEO engine provides the substrate. GEOAI provides the cognition.

---

## Design Principles

1. **Space before symbol** — knowledge is location, not label
2. **Vision before language** — reward is visual, not verbal
3. **Emergence before rules** — complexity grows from simplicity + adjacency
4. **Both learn** — human and AI accumulate the same knowledge simultaneously
5. **Breaking is learning** — frustration is data, not failure
6. **Resolution earns resolution** — you see more clearly as you understand more

---

## What This Is Not

- Not a chatbot. It does not use language as its cognitive substrate.
- Not a supervised learner. There is no labeled training data.
- Not a game AI. It is not optimizing a score function.
- Not a user testing framework. It is a mind being born.

---

*This spec is alive. As baby_0 discovers things we didn't anticipate,*
*those discoveries will be folded back into this document.*
*The spec learns too.*
