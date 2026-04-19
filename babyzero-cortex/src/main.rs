// BabyZero Visual Cortex — main.rs
// Phase 1: ENCODER (native Rust binary, no WASM yet)
// Language before types. Soul before body.
#![allow(dead_code)]
use std::collections::{BTreeMap, HashMap};

// ── SECTION 1: COLOR FAMILIES ─────────────────────────────────────
// Mook's synesthetic map. COLOR IS DATA. Not theming. The grammar.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum ColorFamily {
    BlackHole = 0, // 0  → Cyan,   void with gravitational weight 1.0
    YLoop     = 1, // 1,3→ Red/Yellow, single active quadrant
    XLoop     = 2, // 2,5→ Blue/Orange, adjacent structural pair
    ZLoop     = 3, // 4  → Green, three-quadrant complex
    DiagLoop  = 4, // 6,7→ Purple/Pink, diagonal relationship
    GateOn    = 5, // 8  → White, boundary / flood fill
    GateOff   = 6, // 9  → Black, true ground, no perceptual weight
}

impl ColorFamily {
    pub fn from_value(v: u8) -> Self {
        match v {
            0 => Self::BlackHole,
            1 | 3 => Self::YLoop,
            2 | 5 => Self::XLoop,
            4 => Self::ZLoop,
            6 | 7 => Self::DiagLoop,
            8 => Self::GateOn,
            _ => Self::GateOff,
        }
    }
    pub fn as_u8(self) -> u8 { self as u8 }
    pub fn base_weight(self) -> f32 {
        match self {
            Self::BlackHole => 1.0, // 0! = 1, void has full weight
            Self::GateOff   => 0.0, // true ground, suppressed
            _               => 0.5,
        }
    }
}

// ── SECTION 2: TRANSFORM TYPES ────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum Axis { Horizontal, Vertical, Diagonal }

#[derive(Debug, Clone, PartialEq)]
pub enum TransformType {
    ColorSubstitution { from: u8, to: u8 },
    SpatialShift      { dx: i8, dy: i8 },
    Rotation          { degrees: u16 },
    Reflection        { axis: Axis },
    ObjectDuplication { offset: (i8, i8) },
    FloodFill         { value: u8 },
    Scaling           { factor: u8 },
    Unknown,
}

impl TransformType {
    pub fn decay_constant(&self) -> f32 {
        match self {
            Self::Reflection { .. }        => 0.0005,
            Self::Rotation { .. }          => 0.001,
            Self::ColorSubstitution { .. } => 0.005,
            Self::SpatialShift { .. }      => 0.01,
            Self::Scaling { .. }           => 0.01,
            Self::FloodFill { .. }         => 0.02,
            Self::ObjectDuplication { .. } => 0.05,
            Self::Unknown                  => 0.1,
        }
    }
}

// ── SECTION 3: GRAMMAR RULE (the soul / heartbeat) ────────────────

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PatternKey {
    pub depth: u8,
    pub color_family_sequence: Vec<u8>,
    pub region_z_order: u64,
}

#[derive(Debug, Clone)]
pub struct GrammarRule {
    pub pattern:             PatternKey,
    pub transform:           TransformType,
    pub weight:              f32,
    pub last_reinforced_at:  u64,
    pub decay_constant:      f32,
    pub reinforcement_count: u32,
}

impl GrammarRule {
    pub fn new(pattern: PatternKey, transform: TransformType) -> Self {
        let dc = transform.decay_constant();
        Self { pattern, transform, weight: 0.5, last_reinforced_at: 0,
               decay_constant: dc, reinforcement_count: 0 }
    }
    pub fn effective_weight(&self, tick: u64) -> f32 {
        let age = tick.saturating_sub(self.last_reinforced_at) as f32;
        (self.weight * (-self.decay_constant * age).exp()).max(0.0)
    }
    pub fn reinforce(&mut self, tick: u64) {
        let age_penalty = (-self.decay_constant
            * tick.saturating_sub(self.last_reinforced_at) as f32).exp();
        self.weight = (self.weight + 0.15 * age_penalty).min(1.0);
        self.last_reinforced_at = tick;
        self.reinforcement_count += 1;
    }
    pub fn penalize(&mut self) { self.weight = (self.weight - 0.05).max(0.0); }
}

// ── SECTION 4: GRAMMAR ENGINE ─────────────────────────────────────

pub type GrammarEngine = BTreeMap<PatternKey, Vec<GrammarRule>>;

pub fn best_rule<'a>(engine: &'a GrammarEngine, key: &PatternKey, tick: u64)
    -> Option<&'a GrammarRule>
{
    engine.get(key)?.iter().max_by(|a, b|
        a.effective_weight(tick).partial_cmp(&b.effective_weight(tick))
         .unwrap_or(std::cmp::Ordering::Equal))
}

// ── SECTION 5: QJL CACHE ──────────────────────────────────────────

pub fn qjl_cache_key(depth: u8, families: &[u8; 3], z_order: u64) -> u64 {
    let db = (depth / 2) as u64;
    let fh = ((families[0] as u64) << 8) | ((families[1] as u64) << 4) | (families[2] as u64);
    let zb = z_order >> 4;
    (db << 52) | (fh << 40) | (zb & 0x000F_FFFF_FFFF_FFFF)
}

#[derive(Debug, Clone)]
pub struct CachedTransform {
    pub transform: TransformType, pub cached_weight: f32,
    pub cached_at_tick: u64,      pub hit_count: u32,
}
impl CachedTransform {
    pub fn is_fresh(&self, tick: u64) -> bool {
        tick.saturating_sub(self.cached_at_tick) < 50
    }
}

pub struct BabyZeroCaches {
    pub present_cache: HashMap<u64, CachedTransform>,
    pub void_cache:    HashMap<u64, CachedTransform>,
}
impl BabyZeroCaches {
    pub fn new() -> Self {
        Self { present_cache: HashMap::with_capacity(1024),
               void_cache:    HashMap::with_capacity(1024) }
    }
}

// ── SECTION 6: PERCEPTION BUFFERS ─────────────────────────────────
// Channel 1: PRESENT  Channel 4: VOID (0→255, everything else→0)

pub struct PresentBuffer { pub data: Vec<u8>, pub width: usize, pub height: usize }
impl PresentBuffer {
    pub fn from_grid(grid: &[Vec<u8>]) -> Self {
        let height = grid.len();
        let width  = grid.first().map(|r| r.len()).unwrap_or(0);
        let mut data = Vec::with_capacity(width * height);
        for row in grid { data.extend_from_slice(row); }
        Self { data, width, height }
    }
    pub fn at(&self, row: usize, col: usize) -> u8 { self.data[row * self.width + col] }
    pub fn len(&self) -> usize { self.data.len() }
}

pub struct VoidBuffer { pub data: Vec<u8>, pub width: usize, pub height: usize }
impl VoidBuffer {
    pub fn from_present(p: &PresentBuffer) -> Self {
        // Void world semantics: 0-cells (black holes) stay as 0 — they are the OBJECTS.
        // Non-zero cells become 9 (GateOff/ground) — suppressed background in void world.
        // Keeps all values in 0-9 so dominant_value counts correctly.
        // 0! = 1 — in void world, 0 is the focal object, not the absence.
        let data = p.data.iter().map(|&v| if v == 0 { 0u8 } else { 9u8 }).collect();
        Self { data, width: p.width, height: p.height }
    }
    pub fn at(&self, row: usize, col: usize) -> u8 { self.data[row * self.width + col] }
    pub fn len(&self) -> usize { self.data.len() }
}

// ── SECTION 7: QUAD ARENA ─────────────────────────────────────────

pub mod node_flags {
    pub const IS_BACKGROUND:   u8 = 1 << 0;
    pub const IS_LEAF:         u8 = 1 << 1;
    pub const IS_DIAGONAL_SRC: u8 = 1 << 2;
    pub const IS_GATE_OFF:     u8 = 1 << 3;
    pub const IS_BLACK_HOLE:   u8 = 1 << 4;
    pub const IS_VOID_MAP:     u8 = 1 << 5;
}

#[derive(Debug, Clone)]
pub struct QuadNode {
    pub z_order: u64, pub depth: u8, pub dominant_value: u8,
    pub color_family: u8, pub node_flags: u8, pub decay_weight: f32,
    pub children: [u32; 4],   // [TL,TR,BL,BR], u32::MAX = leaf
    pub x0: u16, pub y0: u16, pub x1: u16, pub y1: u16,
}
impl QuadNode {
    pub fn is_leaf(&self)       -> bool { self.node_flags & node_flags::IS_LEAF != 0 }
    pub fn is_background(&self) -> bool { self.node_flags & node_flags::IS_BACKGROUND != 0 }
    pub fn is_black_hole(&self) -> bool { self.node_flags & node_flags::IS_BLACK_HOLE != 0 }
}

pub struct QuadArena { pub nodes: Vec<QuadNode>, pub used: usize }
impl QuadArena {
    pub fn new(w: usize, h: usize) -> Self {
        Self { nodes: Vec::with_capacity(((w * h * 4) / 3).max(64)), used: 0 }
    }
    pub fn alloc(&mut self, n: QuadNode) -> u32 {
        let i = self.nodes.len() as u32; self.nodes.push(n); self.used += 1; i
    }
    pub fn get(&self, i: u32) -> Option<&QuadNode> {
        if i == u32::MAX { None } else { self.nodes.get(i as usize) }
    }
    pub fn get_mut(&mut self, i: u32) -> Option<&mut QuadNode> {
        if i == u32::MAX { None } else { self.nodes.get_mut(i as usize) }
    }
}

// ── SECTION 8: BACKGROUND DETECTION ──────────────────────────────

pub fn detect_background(p: &PresentBuffer) -> u8 {
    let mut counts = [0u32; 10];
    for &v in &p.data { if (v as usize) < 10 { counts[v as usize] += 1; } }
    let max = *counts.iter().max().unwrap_or(&0);
    counts.iter().enumerate().find(|&(_, &c)| c == max)
          .map(|(i, _)| i as u8).unwrap_or(0)
}

// ── SECTION 9: GEOI BINARY HEADER ────────────────────────────────

pub mod geoi_flags {
    pub const HAS_DIAGONAL_INDEX:  u8 = 1 << 0;
    pub const HAS_DECAY_WEIGHTS:   u8 = 1 << 1;
    pub const BACKGROUND_DETECTED: u8 = 1 << 2;
}

pub struct GeoiHeader {
    pub magic: [u8; 4], pub version: u8, pub width: u16, pub height: u16,
    pub depth_max: u8, pub color_map_id: u8, pub flags: u8, pub geo_rule_hash: u32,
}
impl GeoiHeader {
    pub fn new(w: u16, h: u16, flags: u8) -> Self {
        Self { magic: *b"GEOI", version: 1, width: w, height: h,
               depth_max: 8, color_map_id: 0, flags, geo_rule_hash: 0 }
    }
    pub fn to_bytes(&self) -> [u8; 16] {
        let mut b = [0u8; 16];
        b[0..4].copy_from_slice(&self.magic); b[4] = self.version;
        b[5..7].copy_from_slice(&self.width.to_le_bytes());
        b[7..9].copy_from_slice(&self.height.to_le_bytes());
        b[9] = self.depth_max; b[10] = self.color_map_id; b[11] = self.flags;
        b[12..16].copy_from_slice(&self.geo_rule_hash.to_le_bytes()); b
    }
}

// ── SECTION 10: DIAGONAL INDEX ────────────────────────────────────

#[derive(Debug, Clone)]
pub struct DiagonalPair { pub z_order_a: u64, pub z_order_b: u64 }
pub type DiagonalIndex = Vec<DiagonalPair>;

// ── SECTION 11: BABYZERO STATE ────────────────────────────────────

pub struct BabyZero {
    pub grammar: GrammarEngine, pub caches: BabyZeroCaches,
    pub tick: u64, pub background: u8,
}
impl BabyZero {
    pub fn new() -> Self {
        Self { grammar: BTreeMap::new(), caches: BabyZeroCaches::new(),
               tick: 0, background: 9 }
    }
    pub fn advance_tick(&mut self) { self.tick += 1; }
}

// ── SECTION 12: QJL CACHE LOOKUP (C5) ────────────────────────────
// The ONLY external interface to the QJL cache.
// All cache logic lives here. Nobody else touches the HashMap directly.

#[derive(Debug, Default)]
pub struct CacheStats {
    pub hits:   u64,
    pub misses: u64,
}
impl CacheStats {
    pub fn new() -> Self { Self { hits: 0, misses: 0 } }
    pub fn hit_rate(&self) -> f32 {
        let total = self.hits + self.misses;
        if total == 0 { 0.0 } else { self.hits as f32 / total as f32 }
    }
    pub fn print(&self, label: &str) {
        println!("  [{}] cache  hits={} misses={}  rate={:.1}%",
            label, self.hits, self.misses, self.hit_rate() * 100.0);
    }
}

/// QJL lookup wrapper. Cache HIT + fresh → clone O(1).
/// HIT + stale → evict + fall through. MISS → grammar BTreeMap + cache result.
/// Returns None if grammar has no rule for this key (expected early in training).
pub fn lookup_or_compute(
    cache:  &mut HashMap<u64, CachedTransform>,
    engine: &GrammarEngine,
    key:    &PatternKey,
    tick:   u64,
    stats:  &mut CacheStats,
) -> Option<CachedTransform> {
    // Build QJL key — take first 3 family bytes (pad with 0 if shorter)
    let f0 = key.color_family_sequence.get(0).copied().unwrap_or(0);
    let f1 = key.color_family_sequence.get(1).copied().unwrap_or(0);
    let f2 = key.color_family_sequence.get(2).copied().unwrap_or(0);
    let qjl_key = qjl_cache_key(key.depth, &[f0, f1, f2], key.region_z_order);

    // Phase A: cache probe
    if let Some(entry) = cache.get_mut(&qjl_key) {
        if entry.is_fresh(tick) {
            entry.hit_count += 1;
            stats.hits += 1;
            return Some(entry.clone());
        }
        // Stale — evict
        cache.remove(&qjl_key);
    }

    // Phase B: miss — full grammar BTreeMap lookup O(log n)
    stats.misses += 1;
    let ct = best_rule(engine, key, tick).map(|rule| CachedTransform {
        transform:      rule.transform.clone(),
        cached_weight:  rule.effective_weight(tick),
        cached_at_tick: tick,
        hit_count:      0,
    });
    if let Some(ref entry) = ct {
        cache.insert(qjl_key, entry.clone());
    }
    ct
}

// ── SECTION 13: PERCEPTION INTERFERENCE (D1) ─────────────────────
// perception(R, D) = memory_signal × void_signal
// R = present PatternKey  D = void PatternKey (same region, void channel)
// High interference → BabyZero is confident about this region.
// Low interference  → uncertain. Needs more training examples.

#[derive(Debug)]
pub struct PerceptionResult {
    pub memory_signal: f32,   // Channel 3: grammar weight for present key
    pub void_signal:   f32,   // Channel 4: grammar weight for void key
    pub interference:  f32,   // memory_signal × void_signal
}

/// Core perception query. Pulls from all 4 channels simultaneously.
/// Rust borrow note: present_cache and void_cache are separate fields
/// → splitting borrows works without unsafe.
pub fn perception(
    baby:      &mut BabyZero,
    p_key:     PatternKey,
    v_key:     PatternKey,
    p_stats:   &mut CacheStats,
    v_stats:   &mut CacheStats,
) -> PerceptionResult {
    let tick = baby.tick;

    // Split borrows: grammar (immut) + two separate cache fields (mut)
    let p_ct = lookup_or_compute(
        &mut baby.caches.present_cache,
        &baby.grammar,
        &p_key,
        tick,
        p_stats,
    );
    let v_ct = lookup_or_compute(
        &mut baby.caches.void_cache,
        &baby.grammar,
        &v_key,
        tick,
        v_stats,
    );

    let memory_signal = p_ct.map(|ct| ct.cached_weight).unwrap_or(0.0);
    let void_signal   = v_ct.map(|ct| ct.cached_weight).unwrap_or(0.0);
    let interference  = memory_signal * void_signal;

    PerceptionResult { memory_signal, void_signal, interference }
}

// ── SECTION 14: PHASE 2 TESTS ─────────────────────────────────────

pub fn run_phase2_tests() {
    println!("\n══ Phase 2 Tests (C5 + D1) ═════════════════════════");

    let mut baby = BabyZero::new();
    let mut p_stats = CacheStats::new();
    let mut v_stats = CacheStats::new();

    // Seed the grammar engine with a test rule
    let pk = PatternKey {
        depth: 2,
        color_family_sequence: vec![1, 2, 6],  // Red, Blue, GateOff
        region_z_order: 0x10,
    };
    let rule = GrammarRule::new(pk.clone(), TransformType::ColorSubstitution { from: 1, to: 2 });
    baby.grammar.entry(pk.clone()).or_default().push(rule);

    // Test C5: first call is a MISS, second is a HIT
    let ct1 = lookup_or_compute(&mut baby.caches.present_cache, &baby.grammar, &pk, 0, &mut p_stats);
    assert!(ct1.is_some(), "Should find the seeded rule");
    assert_eq!(p_stats.misses, 1);
    assert_eq!(p_stats.hits, 0);
    println!("  [PASS] First lookup: miss (grammar BTreeMap) → cached");

    let ct2 = lookup_or_compute(&mut baby.caches.present_cache, &baby.grammar, &pk, 1, &mut p_stats);
    assert!(ct2.is_some(), "Cache hit");
    assert_eq!(p_stats.hits, 1);
    println!("  [PASS] Second lookup: cache HIT (O(1)) — rule retrieved without BTreeMap");

    // Verify QJL bucket collision: adjacent depth shares bucket
    let pk3 = PatternKey { depth: 3, ..pk.clone() };
    let ct3 = lookup_or_compute(&mut baby.caches.present_cache, &baby.grammar, &pk3, 2, &mut p_stats);
    // depth=2 and depth=3 → same bucket (depth/2 = 1) → should also hit
    println!("  [INFO] Depth-3 key (same bucket as depth-2): {:?}", ct3.is_some());

    p_stats.print("present");

    // Test D1: perception with empty void grammar → interference = 0
    let vk = PatternKey {
        depth: 2,
        color_family_sequence: vec![0, 6, 6],  // BlackHole (void object), GateOff, GateOff
        region_z_order: 0x10,
    };
    let result = perception(&mut baby, pk.clone(), vk, &mut p_stats, &mut v_stats);
    println!("\n  [D1] Perception result:");
    println!("       memory_signal = {:.4}  (present grammar confidence)", result.memory_signal);
    println!("       void_signal   = {:.4}  (void grammar confidence — 0 = untrained)", result.void_signal);
    println!("       interference  = {:.4}  (memory × void)", result.interference);
    assert!(result.memory_signal > 0.0, "Present channel should have signal from seeded rule");
    assert_eq!(result.void_signal, 0.0, "Void channel has no rules yet → 0");
    assert_eq!(result.interference, 0.0, "Interference is 0 when void is silent");
    println!("  [PASS] interference=0.0 when void grammar is empty (expected — Phase 2 baseline)");

    v_stats.print("void");
    println!("\n  → Grammar training begins in Phase 3. Each solved ARC example seeds rules.");
    println!("  → Target: interference > 0 on patterns BabyZero has seen before.");
    println!("\n✅ Phase 2 tests complete.");
}

// ── MAIN: smoke test ──────────────────────────────────────────────

fn main() {
    println!("BabyZero Visual Cortex — Phase 1 Encoder");
    println!("==========================================");

    // 1. All structs construct
    let baby = BabyZero::new();
    println!("[OK] BabyZero constructed. Tick: {}", baby.tick);

    // 2. Color family map
    for v in 0u8..=9 {
        let f = ColorFamily::from_value(v);
        println!("  {} → {:?}  weight={:.1}", v, f, f.base_weight());
    }

    // 3. Present + Void buffers, background detection
    let grid: Vec<Vec<u8>> = vec![
        vec![9,9,9], vec![9,1,9], vec![9,9,9],
    ];
    let present = PresentBuffer::from_grid(&grid);
    let void_b  = VoidBuffer::from_present(&present);
    let bg = detect_background(&present);
    println!("\n[OK] 3x3 grid. Background={} ({:?})", bg, ColorFamily::from_value(bg));
    assert_eq!(bg, 9);
    // Void semantics: 0→0 (void object), non-zero→9 (ground).
    // Grid1 has no 0-cells → all 9s in void buffer.
    let void_sum: u32 = void_b.data.iter().map(|&v| v as u32).sum();
    let expected_all9: u32 = 9 * present.len() as u32; // all cells become 9
    println!("     Void sum={} (expect {} — all cells→9 in void world)", void_sum, expected_all9);
    assert_eq!(void_sum, expected_all9, "Grid with no 0-cells: void buffer should be all 9s");

    // 4. Grid WITH black holes (0-cells)
    let g2: Vec<Vec<u8>> = vec![
        vec![0,9,9], vec![9,1,9], vec![9,9,0],
    ];
    let p2 = PresentBuffer::from_grid(&g2);
    let v2 = VoidBuffer::from_present(&p2);
    // Two 0-cells → stay as 0; seven non-zero cells → become 9.
    let v2s: u32 = v2.data.iter().map(|&v| v as u32).sum();
    let expected_v2: u32 = 7 * 9; // 7 non-zero cells → 9, two 0-cells → 0
    println!("     Grid2 void sum={} (expect {} — 7×9 + 2×0)", v2s, expected_v2);
    assert_eq!(v2s, expected_v2, "Two 0-cells stay 0, 7 non-zeros become 9");

    // 5. QJL key bucket stability
    let fams = [1u8, 2u8, 3u8];
    let k2 = qjl_cache_key(2, &fams, 0x1F);
    let k3 = qjl_cache_key(3, &fams, 0x1F); // same bucket as 2
    let k4 = qjl_cache_key(4, &fams, 0x1F); // different bucket
    println!("\n[OK] QJL — depth2={:#x} depth3={:#x} depth4={:#x}", k2, k3, k4);
    assert_eq!(k2, k3, "depths 2 and 3 share bucket");
    assert_ne!(k2, k4, "depths 2 and 4 differ");

    // 6. Grammar decay
    let pk = PatternKey { depth: 2, color_family_sequence: vec![1,6,1], region_z_order: 0x10 };
    let mut rule = GrammarRule::new(pk, TransformType::Unknown);
    let w0  = rule.effective_weight(0);
    let w50 = rule.effective_weight(50);
    println!("\n[OK] Grammar decay — w@0={:.4}  w@50={:.4}  decays={}", w0, w50, w50 < w0);
    assert!(w50 < w0);
    rule.reinforce(50);
    println!("     After reinforce: weight={:.4} count={}", rule.weight, rule.reinforcement_count);
    assert_eq!(rule.reinforcement_count, 1);

    // 7. GEOI header bytes
    let hdr = GeoiHeader::new(3, 3, geoi_flags::HAS_DECAY_WEIGHTS | geoi_flags::BACKGROUND_DETECTED);
    let hb = hdr.to_bytes();
    assert_eq!(&hb[0..4], b"GEOI"); assert_eq!(hb[4], 1);
    println!("\n[OK] GEOI header magic=GEOI version={}", hb[4]);

    println!("\n✅ All structs compile. All assertions pass.");

    // Phase 1: full pipeline tests
    run_pipeline_tests();

    // Phase 2: cache + perception interference tests
    run_phase2_tests();

    // Phase 3: predict first, earn the reward
    run_phase3_tests();
}

// ═══════════════════════════════════════════════════════════════════
//  TRACK B — QUADTREE BUILDER
//  Split condition: color-family set cardinality > 1
//  Void version: double max_depth (the void is fine-grained)
// ═══════════════════════════════════════════════════════════════════

use morton_encoding::morton_encode;

/// Check if a rectangular region [x0,x1) × [y0,y1) is color-family uniform.
/// A region is uniform if ALL cells belong to the same ColorFamily.
fn region_color_families(buf: &[u8], width: usize, x0: u16, y0: u16, x1: u16, y1: u16) -> Vec<ColorFamily> {
    let mut families = std::collections::HashSet::new();
    for row in y0..y1 {
        for col in x0..x1 {
            let v = buf[row as usize * width + col as usize];
            families.insert(ColorFamily::from_value(v));
        }
    }
    let mut v: Vec<ColorFamily> = families.into_iter().collect();
    v.sort();
    v
}

/// Dominant value in a region (most frequent; tie → lower value).
fn dominant_value_in_region(buf: &[u8], width: usize, x0: u16, y0: u16, x1: u16, y1: u16) -> u8 {
    let mut counts = [0u32; 10];
    for row in y0..y1 {
        for col in x0..x1 {
            let v = buf[row as usize * width + col as usize];
            if (v as usize) < 10 { counts[v as usize] += 1; }
        }
    }
    let max = *counts.iter().max().unwrap_or(&0);
    counts.iter().enumerate().find(|&(_, &c)| c == max)
          .map(|(i, _)| i as u8).unwrap_or(0)
}

/// Build a quadtree from a flat grid buffer into a QuadArena.
/// Returns the index of the root node.
///
/// is_void: if true, this is the VoidBuffer tree (double max_depth)
pub fn build_quadtree(
    buf: &[u8],
    width: usize, height: usize,
    background: u8,
    max_depth: u8,
    is_void: bool,
    arena: &mut QuadArena,
) -> u32 {
    let effective_max = if is_void { max_depth.saturating_mul(2).min(16) } else { max_depth };
    build_node(buf, width, background, effective_max, is_void, arena, 0, 0, width as u16, height as u16, 0)
}

fn build_node(
    buf: &[u8], width: usize, background: u8,
    max_depth: u8, is_void: bool,
    arena: &mut QuadArena,
    x0: u16, y0: u16, x1: u16, y1: u16,
    depth: u8,
) -> u32 {
    // Compute Morton code for the top-left cell of this region
    let z_order: u64 = morton_encode([x0 as u32, y0 as u32]);
    let dom_val = dominant_value_in_region(buf, width, x0, y0, x1, y1);
    let families = region_color_families(buf, width, x0, y0, x1, y1);
    let is_uniform = families.len() <= 1;
    let is_too_small = (x1 - x0) <= 1 || (y1 - y0) <= 1;
    let at_max_depth = depth >= max_depth;

    // Compute node flags
    let mut flags: u8 = 0;
    if dom_val == background             { flags |= node_flags::IS_BACKGROUND; }
    if ColorFamily::from_value(dom_val) == ColorFamily::GateOff { flags |= node_flags::IS_GATE_OFF; }
    if ColorFamily::from_value(dom_val) == ColorFamily::BlackHole { flags |= node_flags::IS_BLACK_HOLE; }
    if is_void                           { flags |= node_flags::IS_VOID_MAP; }

    // Decay weight: fresh = 1.0 for void/black-hole, 1.0 for all new nodes
    let decay_weight = if dom_val == 0 { 1.0f32 } else { 1.0f32 };

    if is_uniform || is_too_small || at_max_depth {
        // LEAF
        flags |= node_flags::IS_LEAF;
        let node = QuadNode {
            z_order, depth, dominant_value: dom_val,
            color_family: ColorFamily::from_value(dom_val).as_u8(),
            node_flags: flags, decay_weight,
            children: [u32::MAX; 4],
            x0, y0, x1, y1,
        };
        arena.alloc(node)
    } else {
        // SPLIT into 4 quadrants: TL, TR, BL, BR
        let mx = x0 + (x1 - x0) / 2;
        let my = y0 + (y1 - y0) / 2;

        // Allocate placeholder first to get index, then fill children
        let placeholder = QuadNode {
            z_order, depth, dominant_value: dom_val,
            color_family: ColorFamily::from_value(dom_val).as_u8(),
            node_flags: flags, decay_weight,
            children: [u32::MAX; 4],
            x0, y0, x1, y1,
        };
        let self_idx = arena.alloc(placeholder);

        // Build children (may recursively grow arena)
        let c_tl = build_node(buf, width, background, max_depth, is_void, arena, x0, y0, mx, my, depth+1);
        let c_tr = build_node(buf, width, background, max_depth, is_void, arena, mx, y0, x1, my, depth+1);
        let c_bl = build_node(buf, width, background, max_depth, is_void, arena, x0, my, mx, y1, depth+1);
        let c_br = build_node(buf, width, background, max_depth, is_void, arena, mx, my, x1, y1, depth+1);

        // Patch children into parent (arena is a Vec, self_idx is stable)
        arena.nodes[self_idx as usize].children = [c_tl, c_tr, c_bl, c_br];
        self_idx
    }
}

// ── ASCII tree printer (for visual verification) ─────────────────

pub fn print_tree(arena: &QuadArena, idx: u32, indent: usize) {
    if idx == u32::MAX { return; }
    let node = &arena.nodes[idx as usize];
    let fam  = ColorFamily::from_value(node.dominant_value);
    let leaf_mark = if node.is_leaf() { "●" } else { "○" };
    let bg_mark   = if node.is_background() { " [BG]" } else { "" };
    let bh_mark   = if node.is_black_hole() { " [BH!]" } else { "" };
    let void_mark = if node.node_flags & node_flags::IS_VOID_MAP != 0 { " [VOID]" } else { "" };
    println!("{}{} d{}  val={} {:?}  z={:#x}  [{},{}..{},{}]{}{}{}",
        "  ".repeat(indent), leaf_mark, node.depth, node.dominant_value, fam,
        node.z_order, node.x0, node.y0, node.x1, node.y1,
        bg_mark, bh_mark, void_mark);
    for &child in &node.children {
        print_tree(arena, child, indent + 1);
    }
}

// ── Collect all leaf nodes ────────────────────────────────────────

pub fn collect_leaves(arena: &QuadArena, idx: u32, out: &mut Vec<u32>) {
    if idx == u32::MAX { return; }
    let node = &arena.nodes[idx as usize];
    if node.is_leaf() {
        out.push(idx);
    } else {
        for &child in &node.children {
            collect_leaves(arena, child, out);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  TRACK B — DIAGONAL PASS
//  After Z-order, find leaf pairs that are diagonal-adjacent in 2D
//  but non-adjacent in Z-order (|z_a - z_b| > 1).
// ═══════════════════════════════════════════════════════════════════

pub fn build_diagonal_index(arena: &QuadArena, leaves: &[u32]) -> DiagonalIndex {
    // Build (x,y) → z_order map for all leaf top-left corners
    let mut pos_to_z: HashMap<(u16, u16), u64> = HashMap::with_capacity(leaves.len());
    for &idx in leaves {
        let n = &arena.nodes[idx as usize];
        pos_to_z.insert((n.x0, n.y0), n.z_order);
    }

    let mut pairs: DiagonalIndex = Vec::new();
    let mut seen: std::collections::HashSet<(u64, u64)> = std::collections::HashSet::new();

    for &idx in leaves {
        let n = &arena.nodes[idx as usize];
        // 4 diagonal directions: (±1, ±1) in single-cell steps
        for dx in [-1i32, 1] {
            for dy in [-1i32, 1] {
                let nx = n.x0 as i32 + dx;
                let ny = n.y0 as i32 + dy;
                if nx < 0 || ny < 0 { continue; }
                if let Some(&z_b) = pos_to_z.get(&(nx as u16, ny as u16)) {
                    let z_a = n.z_order;
                    // Non-adjacent in Z-order space
                    let diff = if z_a > z_b { z_a - z_b } else { z_b - z_a };
                    if diff > 1 {
                        let key = if z_a < z_b { (z_a, z_b) } else { (z_b, z_a) };
                        if seen.insert(key) {
                            pairs.push(DiagonalPair { z_order_a: key.0, z_order_b: key.1 });
                        }
                    }
                }
            }
        }
    }
    pairs
}

// ═══════════════════════════════════════════════════════════════════
//  TRACK B — GEOI BINARY SERIALIZER
//  Writes present.geoi and void.geoi to disk.
// ═══════════════════════════════════════════════════════════════════

pub fn serialize_geoi(
    arena: &QuadArena,
    diag: &DiagonalIndex,
    background: u8,
    width: u16,
    height: u16,
    path: &str,
) -> std::io::Result<usize> {

    let has_diag   = !diag.is_empty();
    let mut flags  = geoi_flags::HAS_DECAY_WEIGHTS | geoi_flags::BACKGROUND_DETECTED;
    if has_diag { flags |= geoi_flags::HAS_DIAGONAL_INDEX; }

    let header = GeoiHeader::new(width, height, flags);
    let mut out: Vec<u8> = Vec::new();

    // 16-byte header
    out.extend_from_slice(&header.to_bytes());
    // Background value byte (because BACKGROUND_DETECTED is set)
    out.push(background);

    // Node stream — only leaf nodes in Z-order
    let mut leaves: Vec<u32> = Vec::new();
    collect_leaves(arena, 0, &mut leaves);
    // Sort by z_order for canonical stream order
    leaves.sort_by_key(|&i| arena.nodes[i as usize].z_order);

    for &idx in &leaves {
        let n = &arena.nodes[idx as usize];
        // 8 bytes z_order
        out.extend_from_slice(&n.z_order.to_le_bytes());
        // 1 byte depth
        out.push(n.depth);
        // 1 byte dominant_value
        out.push(n.dominant_value);
        // 1 byte node_flags
        out.push(n.node_flags);
        // 1 byte color_family
        out.push(n.color_family);
        // 4 bytes decay_weight (f32 LE) — because HAS_DECAY_WEIGHTS
        out.extend_from_slice(&n.decay_weight.to_le_bytes());
    }

    // Diagonal index (if any)
    if has_diag {
        let count = diag.len() as u32;
        out.extend_from_slice(&count.to_le_bytes());
        for pair in diag {
            out.extend_from_slice(&pair.z_order_a.to_le_bytes());
            out.extend_from_slice(&pair.z_order_b.to_le_bytes());
        }
    }

    let total = out.len();
    std::fs::write(path, &out)?;
    Ok(total)
}

// ═══════════════════════════════════════════════════════════════════
//  FULL PIPELINE: process_grid()
//  Takes a 2D grid → builds present + void trees → serializes both
// ═══════════════════════════════════════════════════════════════════

pub struct PipelineResult {
    pub background: u8,
    pub present_leaves: usize,
    pub void_leaves:    usize,
    pub diagonal_pairs: usize,
}

pub fn process_grid(
    grid: &[Vec<u8>],
    present_path: &str,
    void_path: &str,
    max_depth: u8,
    verbose: bool,
) -> PipelineResult {
    let present = PresentBuffer::from_grid(grid);
    let void_b  = VoidBuffer::from_present(&present);
    let bg      = detect_background(&present);
    let w       = present.width;
    let h       = present.height;

    // ── Present quadtree ──────────────────────────────
    let mut present_arena = QuadArena::new(w, h);
    build_quadtree(&present.data, w, h, bg, max_depth, false, &mut present_arena);
    let mut p_leaves: Vec<u32> = Vec::new();
    collect_leaves(&present_arena, 0, &mut p_leaves);
    let diag = build_diagonal_index(&present_arena, &p_leaves);

    if verbose {
        println!("\n── Present Quadtree ──");
        print_tree(&present_arena, 0, 0);
        println!("  Leaves: {}  Diagonal pairs: {}", p_leaves.len(), diag.len());
    }

    let p_bytes = serialize_geoi(&present_arena, &diag, bg, w as u16, h as u16, present_path)
        .expect("Failed to write present.geoi");

    // ── Void quadtree (double depth) ──────────────────
    let mut void_arena = QuadArena::new(w, h);
    build_quadtree(&void_b.data, w, h, 0, max_depth, true, &mut void_arena);
    let mut v_leaves: Vec<u32> = Vec::new();
    collect_leaves(&void_arena, 0, &mut v_leaves);
    let void_diag = build_diagonal_index(&void_arena, &v_leaves);

    if verbose {
        println!("\n── Void Quadtree (double depth) ──");
        print_tree(&void_arena, 0, 0);
        println!("  Leaves: {}  Diagonal pairs: {}", v_leaves.len(), void_diag.len());
    }

    let v_bytes = serialize_geoi(&void_arena, &void_diag, 0, w as u16, h as u16, void_path)
        .expect("Failed to write void.geoi");

    if verbose {
        println!("\n── GEOI output ──");
        println!("  present.geoi: {} bytes ({} leaf nodes)", p_bytes, p_leaves.len());
        println!("  void.geoi:    {} bytes ({} leaf nodes)", v_bytes, v_leaves.len());
    }

    PipelineResult {
        background: bg,
        present_leaves: p_leaves.len(),
        void_leaves:    v_leaves.len(),
        diagonal_pairs: diag.len(),
    }
}

pub fn run_pipeline_tests() {
    println!("\n\u{2550}\u{2550} Pipeline Tests \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}");

    {
        let grid = vec![vec![9u8,9,9],vec![9,1,9],vec![9,9,9]];
        let r = process_grid(&grid, "/tmp/t1p.geoi", "/tmp/t1v.geoi", 4, true);
        assert_eq!(r.background, 9);
        println!("  [PASS] 3x3: bg={}, p_leaves={}, v_leaves={}, diag_pairs={}",
            r.background, r.present_leaves, r.void_leaves, r.diagonal_pairs);
    }

    {
        let grid = vec![vec![0u8,9,9,9],vec![9,9,9,9],vec![9,9,1,9],vec![9,9,9,0]];
        let r = process_grid(&grid, "/tmp/t2p.geoi", "/tmp/t2v.geoi", 4, true);
        assert!(r.void_leaves > 0);
        println!("  [PASS] 4x4 black holes: p_leaves={} v_leaves={}", r.present_leaves, r.void_leaves);
    }

    {
        let grid = vec![vec![9u8,9,9],vec![9,9,9],vec![9,9,9]];
        let r = process_grid(&grid, "/tmp/t3p.geoi", "/tmp/t3v.geoi", 4, false);
        assert_eq!(r.present_leaves, 1);
        println!("  [PASS] uniform 3x3: p_leaves={} (expect 1)", r.present_leaves);
    }

    {
        let grid = vec![vec![1u8,9,9,9],vec![9,9,9,9],vec![9,9,9,9],vec![9,9,9,1]];
        let r = process_grid(&grid, "/tmp/t4p.geoi", "/tmp/t4v.geoi", 4, false);
        println!("  [INFO] diagonal 4x4: p_leaves={} diag_pairs={}", r.present_leaves, r.diagonal_pairs);
    }

    println!("\n\u{2705} Pipeline tests complete. GEOI files written to /tmp/");
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 3 — SECTION 15: TRANSFORM APPLICATOR
//  BabyZero commits to a prediction before seeing the answer.
// ═══════════════════════════════════════════════════════════════════

/// Apply a TransformType to a grid, producing a new output grid.
/// This is BabyZero's "hand" — what it does when it thinks it knows the answer.
pub fn apply_transform(grid: &[Vec<u8>], transform: &TransformType) -> Vec<Vec<u8>> {
    let h = grid.len();
    let w = if h > 0 { grid[0].len() } else { 0 };
    match transform {
        TransformType::ColorSubstitution { from, to } => {
            grid.iter().map(|row|
                row.iter().map(|&v| if v == *from { *to } else { v }).collect()
            ).collect()
        }
        TransformType::Reflection { axis } => {
            match axis {
                Axis::Horizontal => grid.iter().map(|row| {
                    let mut r = row.clone(); r.reverse(); r
                }).collect(),
                Axis::Vertical => {
                    let mut g = grid.to_vec(); g.reverse(); g
                }
                Axis::Diagonal => {
                    // Transpose: grid[r][c] → grid[c][r]
                    (0..w).map(|c| (0..h).map(|r| grid[r][c]).collect()).collect()
                }
            }
        }
        TransformType::Rotation { degrees } => {
            match degrees % 360 {
                90 => {
                    // 90° CW: new[c][h-1-r] = old[r][c]
                    (0..w).map(|c| (0..h).rev().map(|r| grid[r][c]).collect()).collect()
                }
                180 => {
                    grid.iter().rev().map(|row| { let mut r = row.clone(); r.reverse(); r }).collect()
                }
                270 => {
                    // 270° CW: new[w-1-c][r] = old[r][c]
                    (0..w).rev().map(|c| (0..h).map(|r| grid[r][c]).collect()).collect()
                }
                _ => grid.to_vec(),
            }
        }
        TransformType::FloodFill { value } => {
            // Flood fill the most common non-background color region with `value`
            // Simple: replace the dominant non-background object color with value
            let bg = {
                let mut counts = [0u32; 10];
                for row in grid { for &v in row { if v < 10 { counts[v as usize] += 1; }}}
                let max = *counts.iter().max().unwrap_or(&0);
                counts.iter().enumerate().find(|&(_, &c)| c == max)
                      .map(|(i, _)| i as u8).unwrap_or(9)
            };
            grid.iter().map(|row|
                row.iter().map(|&v| if v != bg { *value } else { v }).collect()
            ).collect()
        }
        TransformType::SpatialShift { dx, dy } => {
            let mut out = vec![vec![9u8; w]; h];
            for r in 0..h {
                for c in 0..w {
                    let nr = r as i32 + *dy as i32;
                    let nc = c as i32 + *dx as i32;
                    if nr >= 0 && nr < h as i32 && nc >= 0 && nc < w as i32 {
                        out[nr as usize][nc as usize] = grid[r][c];
                    }
                }
            }
            out
        }
        TransformType::Scaling { factor } => {
            // Upscale each cell by factor
            let f = *factor as usize;
            grid.iter().flat_map(|row| {
                let scaled_row: Vec<u8> = row.iter().flat_map(|&v| vec![v; f]).collect();
                vec![scaled_row; f]
            }).collect()
        }
        TransformType::ObjectDuplication { offset } => {
            // Duplicate object by placing a copy at the given offset
            let mut out = grid.to_vec();
            for r in 0..h {
                for c in 0..w {
                    let nr = r as i32 + offset.1 as i32;
                    let nc = c as i32 + offset.0 as i32;
                    if nr >= 0 && nr < h as i32 && nc >= 0 && nc < w as i32 {
                        if grid[r][c] != 9 {
                            out[nr as usize][nc as usize] = grid[r][c];
                        }
                    }
                }
            }
            out
        }
        TransformType::Unknown => grid.to_vec(),
    }
}

/// Compare two grids for exact equality.
pub fn grids_match(a: &[Vec<u8>], b: &[Vec<u8>]) -> bool {
    a.len() == b.len() && a.iter().zip(b.iter()).all(|(ra, rb)| ra == rb)
}

/// Pretty-print a grid with synesthetic color hints.
pub fn print_grid(label: &str, grid: &[Vec<u8>]) {
    let color_char = |v: u8| match v {
        0 => '■', 1 => 'R', 2 => 'B', 3 => 'Y',
        4 => 'G', 5 => 'O', 6 => 'P', 7 => 'K',
        8 => 'W', 9 => '.', _ => '?',
    };
    println!("  {}:", label);
    for row in grid {
        let s: String = row.iter().map(|&v| color_char(v).to_string()).collect::<Vec<_>>().join(" ");
        println!("    {}", s);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 3 — SECTION 16: GRAMMAR SEEDER
//  Detect what transform turns input→output. Seed the grammar.
// ═══════════════════════════════════════════════════════════════════

/// Detect the most likely TransformType by comparing input and output grids.
pub fn detect_transform(input: &[Vec<u8>], output: &[Vec<u8>]) -> TransformType {
    // 1. Test ColorSubstitution: same dimensions, only value mappings changed
    if input.len() == output.len()
        && input.iter().zip(output.iter()).all(|(ri, ro)| ri.len() == ro.len())
    {
        // Build value→value mapping
        let mut map: HashMap<u8, u8> = HashMap::new();
        let mut consistent = true;
        'outer: for (ri, ro) in input.iter().zip(output.iter()) {
            for (&vi, &vo) in ri.iter().zip(ro.iter()) {
                if let Some(&mapped) = map.get(&vi) {
                    if mapped != vo { consistent = false; break 'outer; }
                } else {
                    map.insert(vi, vo);
                }
            }
        }
        if consistent {
            // Find the one non-identity substitution
            for (&from, &to) in &map {
                if from != to {
                    return TransformType::ColorSubstitution { from, to };
                }
            }
        }
    }

    // 2. Test horizontal reflection
    let h_reflected: Vec<Vec<u8>> = input.iter().map(|row| {
        let mut r = row.clone(); r.reverse(); r
    }).collect();
    if grids_match(&h_reflected, output) {
        return TransformType::Reflection { axis: Axis::Horizontal };
    }

    // 3. Test vertical reflection
    let v_reflected: Vec<Vec<u8>> = {
        let mut g = input.to_vec(); g.reverse(); g
    };
    if grids_match(&v_reflected, output) {
        return TransformType::Reflection { axis: Axis::Vertical };
    }

    // 4. Test 180° rotation
    let rot180 = apply_transform(input, &TransformType::Rotation { degrees: 180 });
    if grids_match(&rot180, output) {
        return TransformType::Rotation { degrees: 180 };
    }

    TransformType::Unknown
}

/// Seed the grammar engine from one (input, output) training example.
/// Extracts leaf PatternKeys from the input quadtree and creates/reinforces
/// GrammarRules linking each pattern to the detected transform.
pub fn seed_from_example(baby: &mut BabyZero, input: &[Vec<u8>], output: &[Vec<u8>]) {
    let transform = detect_transform(input, output);
    let present = PresentBuffer::from_grid(input);
    let void_b  = VoidBuffer::from_present(&present);
    let bg = detect_background(&present);
    let w = present.width; let h = present.height;

    // Build present quadtree + extract leaf PatternKeys
    let mut arena = QuadArena::new(w, h);
    build_quadtree(&present.data, w, h, bg, 5, false, &mut arena);
    let mut leaf_indices: Vec<u32> = Vec::new();
    collect_leaves(&arena, 0, &mut leaf_indices);

    // Build void quadtree
    let mut void_arena = QuadArena::new(w, h);
    build_quadtree(&void_b.data, w, h, 0, 5, true, &mut void_arena);
    let mut void_leaf_indices: Vec<u32> = Vec::new();
    collect_leaves(&void_arena, 0, &mut void_leaf_indices);

    let tick = baby.tick;

    // Seed present grammar
    for &idx in &leaf_indices {
        let node = &arena.nodes[idx as usize];
        if node.is_background() { continue; } // skip background — too generic
        // Key insight: for global transforms (color substitution, reflection),
        // position doesn't matter — key only on color family + depth bucket.
        // z_order >> 4 quantizes position, but for small grids (0-15 range)
        // this collapses to 0 anyway. Use 0 explicitly = "any position".
        let pk = PatternKey {
            depth: node.depth / 2 * 2,  // depth bucket (0,2,4,6...)
            color_family_sequence: vec![node.color_family, 0, 0],
            region_z_order: 0,  // position-independent: rule applies anywhere
        };
        let rules = baby.grammar.entry(pk.clone()).or_insert_with(Vec::new);
        if let Some(existing) = rules.iter_mut().find(|r| r.transform == transform) {
            existing.reinforce(tick);
        } else {
            let mut rule = GrammarRule::new(pk, transform.clone());
            rule.reinforce(tick);
            rules.push(rule);
        }
    }

    // Seed void grammar (for void signal in interference)
    for &idx in &void_leaf_indices {
        let node = &void_arena.nodes[idx as usize];
        if node.dominant_value == 9 { continue; } // skip suppressed ground
        let pk = PatternKey {
            depth: node.depth / 2 * 2,
            color_family_sequence: vec![node.color_family, 0, 0],
            region_z_order: 0,  // position-independent
        };
        let rules = baby.grammar.entry(pk.clone()).or_insert_with(Vec::new);
        if let Some(existing) = rules.iter_mut().find(|r| r.transform == transform) {
            existing.reinforce(tick);
        } else {
            let mut rule = GrammarRule::new(pk, transform.clone());
            rule.reinforce(tick);
            rules.push(rule);
        }
    }

    baby.advance_tick();
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 3 — SECTION 17: PREDICTOR
//  BabyZero commits. It says what it thinks will happen.
// ═══════════════════════════════════════════════════════════════════

pub struct Prediction {
    pub grid:          Vec<Vec<u8>>,   // the predicted output grid
    pub transform:     TransformType,  // what BabyZero thinks the rule is
    pub confidence:    f32,            // interference score (memory × void)
    pub rules_checked: usize,          // how many grammar rules were considered
}

pub fn predict(
    baby:    &mut BabyZero,
    input:   &[Vec<u8>],
    p_stats: &mut CacheStats,
    v_stats: &mut CacheStats,
) -> Prediction {
    let present = PresentBuffer::from_grid(input);
    let void_b  = VoidBuffer::from_present(&present);
    let bg = detect_background(&present);
    let w = present.width; let h = present.height;

    let mut p_arena = QuadArena::new(w, h);
    build_quadtree(&present.data, w, h, bg, 5, false, &mut p_arena);
    let mut p_leaves: Vec<u32> = Vec::new();
    collect_leaves(&p_arena, 0, &mut p_leaves);

    let mut v_arena = QuadArena::new(w, h);
    build_quadtree(&void_b.data, w, h, 0, 5, true, &mut v_arena);
    let mut v_leaves: Vec<u32> = Vec::new();
    collect_leaves(&v_arena, 0, &mut v_leaves);

    let tick = baby.tick;
    let mut best_interference = 0.0f32;
    let mut best_transform = TransformType::Unknown;
    let mut rules_checked = 0usize;

    // Query every non-background present leaf
    for &pidx in &p_leaves {
        let pn = &p_arena.nodes[pidx as usize];
        if pn.is_background() { continue; }
        let pk = PatternKey {
            depth: pn.depth / 2 * 2,  // same depth bucket as seed
            color_family_sequence: vec![pn.color_family, 0, 0],
            region_z_order: 0,  // position-independent: match seeded rules
        };
        // Find matching void leaf (same region)
        let vk = v_leaves.iter().find(|&&vi| {
            let vn = &v_arena.nodes[vi as usize];
            vn.x0 == pn.x0 && vn.y0 == pn.y0
        }).map(|&vi| {
            let vn = &v_arena.nodes[vi as usize];
            PatternKey {
                depth: vn.depth,
                color_family_sequence: vec![vn.color_family, 0, 0],
                region_z_order: vn.z_order,
            }
        }).unwrap_or_else(|| PatternKey {
            depth: 0,
            color_family_sequence: vec![6, 0, 0], // GateOff = silent void
            region_z_order: 0,
        });

        rules_checked += 1;
        let result = perception(baby, pk, vk, p_stats, v_stats);
        // When void is silent (no 0-cells in grid), fall back to memory_signal alone.
        // Absence of void objects is not counterevidence — it's the expected pattern.
        let confidence = if result.void_signal > 0.0 {
            result.interference            // full product: both channels active
        } else {
            result.memory_signal           // void silent: trust memory alone
        };
        if confidence > best_interference {
            best_interference = confidence;
            // Re-query to get the actual transform
            if let Some(rule) = best_rule(&baby.grammar.clone(),
                &PatternKey {
                    depth: pn.depth / 2 * 2,
                    color_family_sequence: vec![pn.color_family, 0, 0],
                    region_z_order: 0,
                }, tick)
            {
                best_transform = rule.transform.clone();
            }
        }
    }

    let predicted_grid = apply_transform(input, &best_transform);
    Prediction {
        grid: predicted_grid,
        transform: best_transform,
        confidence: best_interference,
        rules_checked,
    }
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 3 — SECTION 18: REWARD
//  BabyZero sees if it was right. Grammar reinforces or penalizes.
// ═══════════════════════════════════════════════════════════════════

/// Reward or penalize BabyZero based on whether prediction matched actual output.
/// Returns true if prediction was correct.
pub fn reward(
    baby:       &mut BabyZero,
    input:      &[Vec<u8>],
    prediction: &Prediction,
    actual:     &[Vec<u8>],
) -> bool {
    let correct = grids_match(&prediction.grid, actual);
    let present = PresentBuffer::from_grid(input);
    let void_b  = VoidBuffer::from_present(&present);
    let bg = detect_background(&present);
    let w = present.width; let h = present.height;
    let tick = baby.tick;

    let mut arena = QuadArena::new(w, h);
    build_quadtree(&present.data, w, h, bg, 5, false, &mut arena);
    let mut leaf_indices: Vec<u32> = Vec::new();
    collect_leaves(&arena, 0, &mut leaf_indices);

    for &idx in &leaf_indices {
        let node = &arena.nodes[idx as usize];
        if node.is_background() { continue; }
        let pk = PatternKey {
            depth: node.depth / 2 * 2,
            color_family_sequence: vec![node.color_family, 0, 0],
            region_z_order: 0,
        };
        if let Some(rules) = baby.grammar.get_mut(&pk) {
            for rule in rules.iter_mut() {
                if rule.transform == prediction.transform {
                    if correct { rule.reinforce(tick); }
                    else       { rule.penalize(); }
                }
            }
        }
    }
    baby.advance_tick();
    correct
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 3 — SECTION 19: PHASE 3 TESTS
//  Hand-crafted ARC-style examples. Predict first. Earn the reward.
// ═══════════════════════════════════════════════════════════════════

pub fn run_phase3_tests() {
    println!("\n\u{2550}\u{2550} Phase 3 Tests \u{2014} Predict First, Earn the Reward \u{2550}\u{2550}\u{2550}\u{2550}");

    let mut baby = BabyZero::new();
    let mut p_stats = CacheStats::new();
    let mut v_stats = CacheStats::new();

    // ── Training examples: Red→Blue color substitution ──────────────
    // Simple ARC puzzle: every 1 (Red) becomes 2 (Blue)
    let training: Vec<(Vec<Vec<u8>>, Vec<Vec<u8>>)> = vec![
        // Example 1: single cell
        (vec![vec![9,9,9],vec![9,1,9],vec![9,9,9]],
         vec![vec![9,9,9],vec![9,2,9],vec![9,9,9]]),
        // Example 2: two cells
        (vec![vec![1,9,9],vec![9,9,9],vec![9,9,1]],
         vec![vec![2,9,9],vec![9,9,9],vec![9,9,2]]),
        // Example 3: row of red
        (vec![vec![9,9,9,9],vec![1,1,1,9],vec![9,9,9,9],vec![9,9,9,9]],
         vec![vec![9,9,9,9],vec![2,2,2,9],vec![9,9,9,9],vec![9,9,9,9]]),
    ];

    println!("\n  \u{2500}\u{2500} Training phase \u{2500}\u{2500}");
    for (i, (inp, out)) in training.iter().enumerate() {
        let t = detect_transform(inp, out);
        println!("  Example {}: detected transform = {:?}", i+1, t);
        seed_from_example(&mut baby, inp, out);
    }
    println!("  Grammar rules seeded: {}", baby.grammar.values().map(|v| v.len()).sum::<usize>());

    // ── Test case: novel Red→Blue grid BabyZero hasn't seen ─────────
    let test_input: Vec<Vec<u8>> = vec![
        vec![9,1,9,9],
        vec![9,9,9,1],
        vec![1,9,9,9],
        vec![9,9,1,9],
    ];
    let test_actual: Vec<Vec<u8>> = vec![
        vec![9,2,9,9],
        vec![9,9,9,2],
        vec![2,9,9,9],
        vec![9,9,2,9],
    ];

    println!("\n  \u{2500}\u{2500} Prediction phase \u{2500}\u{2500}");
    print_grid("Input", &test_input);

    let pred = predict(&mut baby, &test_input, &mut p_stats, &mut v_stats);
    print_grid("BabyZero predicts", &pred.grid);
    println!("  Transform: {:?}", pred.transform);
    println!("  Confidence (interference): {:.4}", pred.confidence);
    println!("  Rules checked: {}", pred.rules_checked);

    p_stats.print("present");
    v_stats.print("void");

    // ── Reveal the answer ───────────────────────────────────────────
    println!("\n  \u{2500}\u{2500} Reward phase \u{2500}\u{2500}");
    print_grid("Actual output", &test_actual);
    let correct = reward(&mut baby, &test_input, &pred, &test_actual);

    if correct {
        println!("  \u{2705} CORRECT! BabyZero got it right. Grammar reinforced.");
        println!("  \u{1F9E0} Interference will be HIGHER on the next similar pattern.");
    } else {
        println!("  \u{274C} Wrong. Grammar penalized. BabyZero will adjust.");
        println!("  Predicted: {:?}", pred.transform);
    }

    // ── Show interference after reward: same test input again ───────
    println!("\n  \u{2500}\u{2500} Post-reward: interference on same input \u{2500}\u{2500}");
    let pred2 = predict(&mut baby, &test_input, &mut p_stats, &mut v_stats);
    println!("  Confidence (interference) before reward: {:.4}", pred.confidence);
    println!("  Confidence (interference) after reward:  {:.4}", pred2.confidence);
    let delta = pred2.confidence - pred.confidence;
    if delta > 0.0 {
        println!("  \u{2B06}\u{FE0F}  Interference grew by {:.4} \u{2014} BabyZero is more confident now.", delta);
    }

    println!("\n\u{2705} Phase 3 tests complete.");
    run_phase4_tests();
}


// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: RELATIONAL GRAMMAR — Scientific Method Loop
// Objects → Roles → Hypotheses → Test → Score → Learn
// "Not what color changes — what ROLE does and why"
// ══════════════════════════════════════════════════════════════════════════════

// ── SECTION 20: OBJECT OBSERVATION ───────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum SizeClass {
    Tiny,     // 1 cell
    Small,    // 2-4 cells
    Medium,   // 5-16 cells
    Large,    // 17-64 cells
    Dominant, // >64 cells
}

impl SizeClass {
    pub fn from_count(n: usize) -> Self {
        match n {
            1       => Self::Tiny,
            2..=4   => Self::Small,
            5..=16  => Self::Medium,
            17..=64 => Self::Large,
            _       => Self::Dominant,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IsolationLevel {
    Touching, // Chebyshev dist 0 — shares an edge or corner with another object
    Near,     // dist 1-2 — close but not touching
    Isolated, // dist 3+ — stands alone
}

/// A connected component in the grid — BabyZero's basic unit of perception.
#[derive(Debug, Clone)]
pub struct Object {
    pub cells:            Vec<(usize, usize)>, // (row, col) of every cell
    pub value:            u8,                  // raw pixel value 0-9
    pub color_family:     ColorFamily,
    pub size_class:       SizeClass,
    pub bbox:             (usize, usize, usize, usize), // (min_r, min_c, max_r, max_c)
    pub isolation:        IsolationLevel,
    pub shape:            Vec<(usize, usize)>, // normalized fingerprint
    pub copies_in_grid:   u8,                 // how many same-shape objects exist (incl. self)
    pub adjacent_families: Vec<ColorFamily>,  // families within Chebyshev dist ≤ 2
}

impl Object {
    pub fn cell_count(&self) -> usize { self.cells.len() }
    pub fn same_shape_as(&self, other: &Object) -> bool { self.shape == other.shape }

    /// Center of mass: (avg_row, avg_col)
    pub fn centroid(&self) -> (f32, f32) {
        let n = self.cells.len() as f32;
        let sr: f32 = self.cells.iter().map(|&(r, _)| r as f32).sum();
        let sc: f32 = self.cells.iter().map(|&(_, c)| c as f32).sum();
        (sr / n, sc / n)
    }

    /// Is this object on the grid boundary?
    pub fn is_on_edge(&self, rows: usize, cols: usize) -> bool {
        self.cells.iter().any(|&(r, c)| r == 0 || c == 0 || r + 1 == rows || c + 1 == cols)
    }
}

// ── Helper geometry functions ─────────────────────────────────────────────────

/// 4-connected flood fill from (sr, sc), same value.
fn flood_fill_component(
    data: &[u8], w: usize, h: usize,
    sr: usize, sc: usize,
    visited: &mut Vec<bool>,
) -> Vec<(usize, usize)> {
    let target = data[sr * w + sc];
    let mut stack = vec![(sr, sc)];
    let mut cells = Vec::new();
    while let Some((r, c)) = stack.pop() {
        let idx = r * w + c;
        if visited[idx] || data[idx] != target { continue; }
        visited[idx] = true;
        cells.push((r, c));
        if r > 0         { stack.push((r - 1, c)); }
        if r + 1 < h     { stack.push((r + 1, c)); }
        if c > 0         { stack.push((r, c - 1)); }
        if c + 1 < w     { stack.push((r, c + 1)); }
    }
    cells
}

/// Normalize cells so bbox top-left is (0,0), then sort — shape fingerprint.
pub fn shape_fingerprint(cells: &[(usize, usize)]) -> Vec<(usize, usize)> {
    if cells.is_empty() { return vec![]; }
    let min_r = cells.iter().map(|&(r, _)| r).min().unwrap_or(0);
    let min_c = cells.iter().map(|&(_, c)| c).min().unwrap_or(0);
    let mut fp: Vec<_> = cells.iter().map(|&(r, c)| (r - min_r, c - min_c)).collect();
    fp.sort_unstable();
    fp
}

/// Bounding box (min_r, min_c, max_r, max_c).
fn compute_bbox(cells: &[(usize, usize)]) -> (usize, usize, usize, usize) {
    let min_r = cells.iter().map(|&(r, _)| r).min().unwrap_or(0);
    let min_c = cells.iter().map(|&(_, c)| c).min().unwrap_or(0);
    let max_r = cells.iter().map(|&(r, _)| r).max().unwrap_or(0);
    let max_c = cells.iter().map(|&(_, c)| c).max().unwrap_or(0);
    (min_r, min_c, max_r, max_c)
}

/// Minimum Chebyshev distance between two cell sets.
fn min_chebyshev(a: &[(usize, usize)], b: &[(usize, usize)]) -> usize {
    let mut min_d = usize::MAX;
    for &(ar, ac) in a {
        for &(br, bc) in b {
            let d = ar.abs_diff(br).max(ac.abs_diff(bc));
            if d < min_d { min_d = d; }
            if min_d == 0 { return 0; }
        }
    }
    min_d
}

// ── SECTION 21: EXTRACT OBJECTS ───────────────────────────────────────────────

/// Extract all foreground connected-component objects from a PresentBuffer.
/// Background (most frequent value) is excluded.
pub fn extract_objects(buf: &PresentBuffer) -> Vec<Object> {
    let w = buf.width;
    let h = buf.height;
    let data = &buf.data;

    // Detect background value — most frequent pixel
    let mut counts = [0u32; 10];
    for &v in data { if (v as usize) < counts.len() { counts[v as usize] += 1; } }
    let bg_val = counts.iter().enumerate()
        .max_by_key(|&(_, &c)| c)
        .map(|(i, _)| i as u8)
        .unwrap_or(9);

    // Flood fill all components, keep only foreground
    let mut visited = vec![false; w * h];
    let mut components: Vec<(Vec<(usize, usize)>, u8)> = Vec::new();
    for r in 0..h {
        for c in 0..w {
            if visited[r * w + c] { continue; }
            let val = data[r * w + c];
            let cells = flood_fill_component(data, w, h, r, c, &mut visited);
            if val != bg_val { components.push((cells, val)); }
        }
    }
    if components.is_empty() { return vec![]; }

    // Shape fingerprints
    let fingerprints: Vec<Vec<(usize, usize)>> = components.iter()
        .map(|(cells, _)| shape_fingerprint(cells))
        .collect();

    // Copy counts: init=1 (self), +1 per other object with same shape
    let mut copy_counts = vec![1u8; components.len()];
    for i in 0..components.len() {
        for j in 0..components.len() {
            if i != j && fingerprints[i] == fingerprints[j] {
                copy_counts[i] = copy_counts[i].saturating_add(1);
            }
        }
    }

    // Build Object structs (isolation + adj_families filled in second pass)
    let mut objects: Vec<Object> = components.iter().enumerate()
        .map(|(idx, (cells, val))| Object {
            bbox:             compute_bbox(cells),
            size_class:       SizeClass::from_count(cells.len()),
            color_family:     ColorFamily::from_value(*val),
            shape:            fingerprints[idx].clone(),
            copies_in_grid:   copy_counts[idx],
            cells:            cells.clone(),
            value:            *val,
            isolation:        IsolationLevel::Isolated,
            adjacent_families: vec![],
        })
        .collect();

    // Second pass: isolation distance + adjacent families
    let cell_refs: Vec<Vec<(usize, usize)>> = objects.iter()
        .map(|o| o.cells.clone())
        .collect();
    let fam_refs: Vec<ColorFamily> = objects.iter().map(|o| o.color_family).collect();

    for i in 0..objects.len() {
        let mut min_dist = usize::MAX;
        let mut adj: Vec<ColorFamily> = Vec::new();
        for j in 0..objects.len() {
            if i == j { continue; }
            let d = min_chebyshev(&cell_refs[i], &cell_refs[j]);
            if d < min_dist { min_dist = d; }
            if d <= 2 && !adj.contains(&fam_refs[j]) { adj.push(fam_refs[j]); }
        }
        objects[i].isolation = match min_dist {
            0             => IsolationLevel::Touching,
            1..=2         => IsolationLevel::Near,
            _             => IsolationLevel::Isolated,
        };
        objects[i].adjacent_families = adj;
    }

    objects
}

/// Top-level: raw grid → Vec<Object>
/// BabyZero's eye. It sees objects, not pixels.
pub fn observe_grid(grid: &[Vec<u8>]) -> Vec<Object> {
    let buf = PresentBuffer::from_grid(grid);
    extract_objects(&buf)
}

// ── SECTION 22: RELATIONAL ROLES ─────────────────────────────────────────────

/// Structural role of an object — INDEPENDENT of its color.
/// This is the key: same rule applies regardless of which color plays the role.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum ObjectRole {
    UniqueSingleton, // exactly 1 copy in the grid, isolated
    RepeatedUnit,    // 2+ copies of same shape
    IsolatedSmall,   // alone + Tiny or Small
    SurroundedLarge, // Large/Dominant + touching others
    EdgeTouching,    // touches grid boundary
    CenterMass,      // centroid near grid center (within 20% of center)
    LargestObject,   // biggest object by cell count
    SmallestObject,  // smallest object by cell count
}

/// Derive the role of an object within its observation context.
pub fn classify_role(obj: &Object, all: &[Object], grid_rows: usize, grid_cols: usize) -> ObjectRole {
    // ① Repeated units — copies_in_grid wins over size comparisons
    if obj.copies_in_grid >= 2 { return ObjectRole::RepeatedUnit; }

    // ② Structural isolation — small isolated objects are agents, not context
    if obj.isolation == IsolationLevel::Isolated
       && matches!(obj.size_class, SizeClass::Tiny | SizeClass::Small) {
        return ObjectRole::IsolatedSmall;
    }
    if obj.isolation == IsolationLevel::Isolated && obj.copies_in_grid == 1 {
        return ObjectRole::UniqueSingleton;
    }

    // ③ Size-rank roles — only meaningful when multiple objects exist
    if all.len() > 1 {
        let max_cells = all.iter().map(|o| o.cell_count()).max().unwrap_or(1);
        let min_cells = all.iter().map(|o| o.cell_count()).min().unwrap_or(1);
        if obj.cell_count() == max_cells { return ObjectRole::LargestObject; }
        if obj.cell_count() == min_cells { return ObjectRole::SmallestObject; }
    }

    // ④ Spatial roles
    if obj.is_on_edge(grid_rows, grid_cols) { return ObjectRole::EdgeTouching; }
    if matches!(obj.size_class, SizeClass::Large | SizeClass::Dominant)
       && obj.isolation == IsolationLevel::Touching {
        return ObjectRole::SurroundedLarge;
    }
    let (cr, cc) = obj.centroid();
    let center_r = grid_rows as f32 / 2.0;
    let center_c = grid_cols as f32 / 2.0;
    let dist_r = (cr - center_r).abs() / grid_rows as f32;
    let dist_c = (cc - center_c).abs() / grid_cols as f32;
    if dist_r < 0.2 && dist_c < 0.2 { return ObjectRole::CenterMass; }

    ObjectRole::UniqueSingleton // fallback
}

/// The relational key: describes WHO is acting and in WHAT CONTEXT.
/// Position-free and color-free — pure structural role.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct RelationKey {
    pub agent_role:   ObjectRole,  // the thing that changes
    pub context_role: ObjectRole,  // the dominant/background object (or Unknown→Self)
    pub size_class:   SizeClass,   // rough scale
}

// ── SECTION 23: BEHAVIOR TYPES + HYPOTHESES ──────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BehaviorType {
    Recolor   { from: u8, to: u8 },   // change pixel value
    ReflectH,                          // flip horizontally
    ReflectV,                          // flip vertically
    Expand    { by: u8 },             // grow bounding box by N cells
    Move      { dr: i8, dc: i8 },     // translate position
    CopyN     { count: u8 },          // duplicate N times
    FillToEdge,                        // flood fill outward to boundary
    CountDriven,                       // output encodes count of some pattern
    FallToSurface,                     // object falls straight down until hitting a surface or bottom edge
    Accrete,                           // surface loses cells at the embed site where a landing agent merged in
    Unchanged,                         // this object stays the same
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorHypothesis {
    pub key:             RelationKey,
    pub behavior:        BehaviorType,
    pub confidence:      f32,
    pub evidence_count:  u32,
    pub failure_count:   u32,
    #[serde(default)]
    pub last_seen_session: u32,
}

impl BehaviorHypothesis {
    pub fn new(key: RelationKey, behavior: BehaviorType) -> Self {
        Self { key, behavior, confidence: 0.5, evidence_count: 0, failure_count: 0, last_seen_session: 0 }
    }
    pub fn reinforce(&mut self) {
        self.evidence_count += 1;
        self.confidence = (self.confidence + 0.15).min(1.0);
    }
    pub fn penalize(&mut self) {
        self.failure_count += 1;
        self.confidence = (self.confidence - 0.05).max(0.0);
    }
    pub fn score(&self) -> f32 {
        if self.evidence_count + self.failure_count == 0 { return 0.5; }
        self.evidence_count as f32
            / (self.evidence_count + self.failure_count) as f32
    }
}

// ── SECTION 24: GRID DIFF — WHAT CHANGED? ────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ObjectChange {
    pub in_obj:   Object,
    pub out_obj:  Option<Object>, // None = disappeared
    pub behavior: BehaviorType,
}

#[derive(Debug, Clone)]
pub struct GridDiff {
    pub changes:   Vec<ObjectChange>,
    pub unchanged: Vec<Object>,
    pub rows:      usize,
    pub cols:      usize,
}

/// Reflect cells horizontally: row' = (rows - 1 - row)
pub fn reflect_cells_h(cells: &[(usize, usize)], rows: usize) -> Vec<(usize, usize)> {
    cells.iter().map(|&(r, c)| (rows.saturating_sub(1 + r), c)).collect()
}

/// Reflect cells vertically: col' = (cols - 1 - col)
pub fn reflect_cells_v(cells: &[(usize, usize)], cols: usize) -> Vec<(usize, usize)> {
    cells.iter().map(|&(r, c)| (r, cols.saturating_sub(1 + c))).collect()
}

/// Compare input grid to output grid; infer what happened to each object.
pub fn diff_grids(input: &[Vec<u8>], output: &[Vec<u8>]) -> GridDiff {
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    let in_objs  = observe_grid(input);
    let out_objs = observe_grid(output);

    let mut changes  = Vec::new();
    let mut unchanged = Vec::new();

    for in_obj in &in_objs {
        // ① Same shape + same bbox → unchanged or recolored
        if let Some(out_obj) = out_objs.iter().find(|o| {
            o.shape == in_obj.shape && o.bbox == in_obj.bbox
        }) {
            if out_obj.value != in_obj.value {
                changes.push(ObjectChange {
                    in_obj: in_obj.clone(), out_obj: Some(out_obj.clone()),
                    behavior: BehaviorType::Recolor { from: in_obj.value, to: out_obj.value },
                });
            } else {
                unchanged.push(in_obj.clone());
            }
            continue;
        }

        // ①' FallToSurface — checked BEFORE ReflectH because single-cell shape fingerprints
        // are all [(0,0)] and ReflectH would greedily grab any single-cell output object.
        // A genuine fall: same shape, pure downward move (dc==0, dr>0), new position rests on
        // the bottom edge or on a non-zero, non-self surface cell directly below it in the output.
        if let Some(fall_out) = out_objs.iter().find(|o| {
            o.shape == in_obj.shape && o.bbox != in_obj.bbox && o.value == in_obj.value
        }) {
            let fdr = fall_out.bbox.0 as i32 - in_obj.bbox.0 as i32;
            let fdc = fall_out.bbox.1 as i32 - in_obj.bbox.1 as i32;
            let new_row = fall_out.bbox.0;
            let new_col = fall_out.bbox.1;
            let is_fall = fdc == 0 && fdr > 0 && (
                new_row + 1 >= rows
                    || (new_row + 1 < rows
                        && output[new_row + 1][new_col] != 0
                        && output[new_row + 1][new_col] != in_obj.value)
            );
            if is_fall {
                changes.push(ObjectChange {
                    in_obj: in_obj.clone(), out_obj: Some(fall_out.clone()),
                    behavior: BehaviorType::FallToSurface,
                });
                continue;
            }
        }

        // ② ReflectH: does reflected-H shape appear anywhere in output?
        let rh_cells = reflect_cells_h(&in_obj.cells, rows);
        let rh_fp    = shape_fingerprint(&rh_cells);
        if let Some(out_obj) = out_objs.iter().find(|o| o.shape == rh_fp) {
            changes.push(ObjectChange {
                in_obj: in_obj.clone(), out_obj: Some(out_obj.clone()),
                behavior: BehaviorType::ReflectH,
            });
            continue;
        }

        // ③ ReflectV
        let rv_cells = reflect_cells_v(&in_obj.cells, cols);
        let rv_fp    = shape_fingerprint(&rv_cells);
        if let Some(out_obj) = out_objs.iter().find(|o| o.shape == rv_fp) {
            changes.push(ObjectChange {
                in_obj: in_obj.clone(), out_obj: Some(out_obj.clone()),
                behavior: BehaviorType::ReflectV,
            });
            continue;
        }

        // ③.5 Accrete — surface object loses cells at the embed site.
        // All output cells of the same value are a strict (non-empty) subset of input cells.
        {
            let out_same_cells: std::collections::HashSet<(usize, usize)> = out_objs.iter()
                .filter(|o| o.value == in_obj.value)
                .flat_map(|o| o.cells.iter().copied())
                .collect();
            let in_cell_set: std::collections::HashSet<(usize, usize)> =
                in_obj.cells.iter().copied().collect();
            if !out_same_cells.is_empty()
                && out_same_cells.len() < in_cell_set.len()
                && out_same_cells.iter().all(|c| in_cell_set.contains(c))
            {
                changes.push(ObjectChange {
                    in_obj: in_obj.clone(), out_obj: None,
                    behavior: BehaviorType::Accrete,
                });
                continue;
            }
        }

        // ④ Same shape but moved (different bbox) — check for FallToSurface first
        if let Some(out_obj) = out_objs.iter().find(|o| o.shape == in_obj.shape) {
            let dr = out_obj.bbox.0 as i32 - in_obj.bbox.0 as i32;
            let dc = out_obj.bbox.1 as i32 - in_obj.bbox.1 as i32;

            // FallToSurface: pure downward movement (dc==0, dr>0)
            // where the new position is resting on the bottom edge or on a non-zero surface below.
            let is_fall = dc == 0 && dr > 0 && {
                let new_row = out_obj.bbox.0;
                let new_col = out_obj.bbox.1;
                // Resting on bottom edge OR a non-zero non-agent cell directly below in output
                new_row + 1 >= rows
                    || (new_row + 1 < rows && output[new_row + 1][new_col] != 0
                        && output[new_row + 1][new_col] != in_obj.value)
            };

            let behavior = if is_fall {
                BehaviorType::FallToSurface
            } else {
                BehaviorType::Move {
                    dr: dr.clamp(-127, 127) as i8,
                    dc: dc.clamp(-127, 127) as i8,
                }
            };
            changes.push(ObjectChange {
                in_obj: in_obj.clone(), out_obj: Some(out_obj.clone()),
                behavior,
            });
            continue;
        }

        // ⑤ Object disappeared
        changes.push(ObjectChange {
            in_obj: in_obj.clone(), out_obj: None,
            behavior: BehaviorType::Unknown,
        });
    }

    GridDiff { changes, unchanged, rows, cols }
}

// ── SECTION 25: RELATIONAL GRAMMAR STORE ────────────────────────────────────

pub type RelationalGrammar = HashMap<RelationKey, Vec<BehaviorHypothesis>>;

/// Seed the relational grammar from one (input, output) training pair.
pub fn seed_relational(
    grammar: &mut RelationalGrammar,
    input:   &[Vec<u8>],
    output:  &[Vec<u8>],
    tick:    u64,
) {
    let _ = tick;
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    let in_objs = observe_grid(input);
    let diff    = diff_grids(input, output);

    for change in &diff.changes {
        if matches!(change.behavior, BehaviorType::Unknown | BehaviorType::Unchanged) { continue; }
        let agent_role   = classify_role(&change.in_obj, &in_objs, rows, cols);
        // Context = largest other object's role (or self if alone)
        let context_role = in_objs.iter()
            .filter(|o| o.value != change.in_obj.value)
            .max_by_key(|o| o.cell_count())
            .map(|ctx| classify_role(ctx, &in_objs, rows, cols))
            .unwrap_or(agent_role);

        let key = RelationKey {
            agent_role,
            context_role,
            size_class: change.in_obj.size_class,
        };

        let hypotheses = grammar.entry(key.clone()).or_default();
        if let Some(h) = hypotheses.iter_mut().find(|h| h.behavior == change.behavior) {
            h.reinforce();
        } else {
            hypotheses.push(BehaviorHypothesis::new(key, change.behavior));
        }
    }
}

/// Predict what will happen to the input grid based on the relational grammar.
/// Returns the best-scoring behavior hypothesis for the primary agent object.
pub fn predict_relational(
    grammar: &RelationalGrammar,
    input:   &[Vec<u8>],
) -> Option<(BehaviorType, f32, Object)> {
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    let objs = observe_grid(input);
    if objs.is_empty() { return None; }

    // Find the most "interesting" object — smallest isolated foreground object
    // (most likely the agent in ARC tasks)
    let agent = objs.iter()
        .min_by_key(|o| o.cell_count())
        .unwrap();

    let agent_role = classify_role(agent, &objs, rows, cols);
    let context_role = objs.iter()
        .filter(|o| o.value != agent.value)
        .max_by_key(|o| o.cell_count())
        .map(|ctx| classify_role(ctx, &objs, rows, cols))
        .unwrap_or(agent_role);

    let key = RelationKey {
        agent_role,
        context_role,
        size_class: agent.size_class,
    };

    // Look for matching key — three tiers of fuzziness
    let best_vec = grammar.get(&key)
        // Tier 2: same role + same size, ignore context
        .or_else(|| {
            grammar.iter()
                .filter(|(k, _)| k.agent_role == key.agent_role && k.size_class == key.size_class)
                .max_by_key(|(_, hs)| {
                    hs.iter().map(|h| (h.confidence * 100.0) as u32).max().unwrap_or(0)
                })
                .map(|(_, v)| v)
        })
        // Tier 3: same size class, any role — BabyZero generalizes across roles
        .or_else(|| {
            grammar.iter()
                .filter(|(k, _)| k.size_class == key.size_class)
                .max_by_key(|(_, hs)| {
                    hs.iter().map(|h| (h.confidence * 100.0) as u32).max().unwrap_or(0)
                })
                .map(|(_, v)| v)
        })
        // Tier 4: anything in the grammar (most confident rule wins)
        .or_else(|| {
            grammar.values()
                .max_by_key(|hs| {
                    hs.iter().map(|h| (h.confidence * 100.0) as u32).max().unwrap_or(0)
                })
        });

    let best = best_vec.and_then(|hs| hs.iter().max_by(|a, b|
        a.confidence.partial_cmp(&b.confidence).unwrap_or(std::cmp::Ordering::Equal)
    ));

    best.map(|h| (h.behavior, h.confidence, agent.clone()))
}

// ── SECTION 26: SCIENTIFIC METHOD LOOP ───────────────────────────────────────
//
//  OBSERVE  → extract objects from each training input
//  HYPOTHESIZE → infer behaviors from diffs
//  TEST  → apply hypothesis to each training input, compare to output
//  LOG   → reinforce high-scoring, penalize low-scoring
//  IMPROVE → next call benefits from updated grammar weights

pub struct ExperimentLog {
    pub pair_index:  usize,
    pub behavior:    BehaviorType,
    pub cells_match: usize,
    pub cells_total: usize,
    pub score:       f32,
}

/// Apply a BehaviorType to a grid's agent object and compare to expected output.
/// Returns fraction of cells that match.
pub fn test_hypothesis(
    behavior:  BehaviorType,
    agent:     &Object,
    input:     &[Vec<u8>],
    expected:  &[Vec<u8>],
) -> f32 {
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    if rows == 0 || cols == 0 { return 0.0; }

    // Build predicted output grid starting from input
    let mut predicted: Vec<Vec<u8>> = input.to_vec();

    match behavior {
        BehaviorType::Recolor { from, to } => {
            for r in 0..rows {
                for c in 0..cols {
                    if predicted[r][c] == from { predicted[r][c] = to; }
                }
            }
        }
        BehaviorType::ReflectH => {
            for r in 0..rows / 2 {
                let mirror = rows - 1 - r;
                for c in 0..cols {
                    let tmp = predicted[r][c];
                    predicted[r][c] = predicted[mirror][c];
                    predicted[mirror][c] = tmp;
                }
            }
        }
        BehaviorType::ReflectV => {
            for r in 0..rows {
                for c in 0..cols / 2 {
                    let mirror = cols - 1 - c;
                    let tmp = predicted[r][c];
                    predicted[r][c] = predicted[r][mirror];
                    predicted[r][mirror] = tmp;
                }
            }
        }
        BehaviorType::Move { dr, dc } => {
            // Move the agent object by (dr, dc)
            let mut moved = predicted.clone();
            for &(r, c) in &agent.cells {
                moved[r][c] = 9; // erase from original position (background)
            }
            for &(r, c) in &agent.cells {
                let nr = r as i32 + dr as i32;
                let nc = c as i32 + dc as i32;
                if nr >= 0 && nc >= 0 && (nr as usize) < rows && (nc as usize) < cols {
                    moved[nr as usize][nc as usize] = agent.value;
                }
            }
            predicted = moved;
        }
        _ => {} // other behaviors → no-op for now, score will be low
    }

    // If output dims differ from input, none of our current behaviors handle it
    let exp_rows = expected.len();
    let exp_cols = expected.first().map(|r| r.len()).unwrap_or(0);
    if exp_rows != rows || exp_cols != cols { return 0.0; }

    // Count matching cells
    let total = rows * cols;
    let matches = (0..rows).flat_map(|r| (0..cols).map(move |c| (r, c)))
        .filter(|&(r, c)| predicted[r][c] == expected[r][c])
        .count();

    matches as f32 / total as f32
}

/// The scientific loop: given training pairs, iterate observe→hypothesize→test→log.
/// Returns a log of each test run.
pub fn run_scientific_loop(
    grammar: &mut RelationalGrammar,
    pairs:   &[(&[Vec<u8>], &[Vec<u8>])],
) -> Vec<ExperimentLog> {
    let mut log = Vec::new();

    // Pass 1: OBSERVE + HYPOTHESIZE — seed grammar from all training pairs
    for (input, output) in pairs.iter() {
        seed_relational(grammar, input, output, 0);
    }

    // Pass 2: TEST + LOG — score every seeded hypothesis against all pairs
    for (pair_idx, (input, output)) in pairs.iter().enumerate() {
        if let Some((behavior, _conf, agent)) = predict_relational(grammar, input) {
            let score = test_hypothesis(behavior, &agent, input, output);
            log.push(ExperimentLog {
                pair_index: pair_idx,
                behavior,
                cells_match: (score * (input.len() * input[0].len()) as f32) as usize,
                cells_total: input.len() * input[0].len(),
                score,
            });

            // Reinforce if score > 0.8, penalize if < 0.5
            let rows = input.len();
            let cols = input.first().map(|r| r.len()).unwrap_or(0);
            let objs = observe_grid(input);
            if objs.is_empty() { continue; }

            let agent_role   = classify_role(&agent, &objs, rows, cols);
            let context_role = objs.iter()
                .filter(|o| o.value != agent.value)
                .max_by_key(|o| o.cell_count())
                .map(|ctx| classify_role(ctx, &objs, rows, cols))
                .unwrap_or(agent_role);
            let key = RelationKey { agent_role, context_role, size_class: agent.size_class };

            if let Some(hs) = grammar.get_mut(&key) {
                if let Some(h) = hs.iter_mut().find(|h| h.behavior == behavior) {
                    if score > 0.8 { h.reinforce(); }
                    else if score < 0.5 { h.penalize(); }
                }
            }
        }
    }

    log
}

// ── SECTION 27: PHASE 4 TESTS ─────────────────────────────────────────────────

pub fn run_phase4_tests() {
    println!("\n{}", "═".repeat(60));
    println!("PHASE 4: Relational Grammar — Scientific Method Loop");
    println!("{}", "═".repeat(60));

    // ── Test 1: Object extraction on familiar grids ────────────────
    println!("\n── Test 1: observe_grid() on 3×3 Red on Black ──");
    let grid_3x3_red: Vec<Vec<u8>> = vec![
        vec![9, 9, 9],
        vec![9, 1, 9],
        vec![9, 9, 9],
    ];
    let objs = observe_grid(&grid_3x3_red);
    println!("  Objects found: {}", objs.len());
    assert_eq!(objs.len(), 1, "Should find exactly 1 foreground object");
    let obj = &objs[0];
    println!("  value={} family={:?} size={:?} isolation={:?} copies={}",
             obj.value, obj.color_family, obj.size_class, obj.isolation, obj.copies_in_grid);
    assert_eq!(obj.value, 1);
    assert_eq!(obj.size_class, SizeClass::Tiny);
    assert_eq!(obj.isolation, IsolationLevel::Isolated);
    assert_eq!(obj.copies_in_grid, 1);
    println!("  [PASS] Single isolated red cell detected correctly");

    // ── Test 2: Multiple objects, copy detection ───────────────────
    println!("\n── Test 2: 4×4 with 2 identical red dots ──");
    let grid_two_reds: Vec<Vec<u8>> = vec![
        vec![1, 9, 9, 1],
        vec![9, 9, 9, 9],
        vec![9, 9, 9, 9],
        vec![9, 9, 9, 9],
    ];
    let objs2 = observe_grid(&grid_two_reds);
    println!("  Objects found: {}", objs2.len());
    assert_eq!(objs2.len(), 2);
    assert_eq!(objs2[0].copies_in_grid, 2, "Both should report 2 copies");
    assert_eq!(objs2[1].copies_in_grid, 2);
    println!("  [PASS] Two identical dots, each reports copies_in_grid=2");

    // ── Test 3: Role classification ────────────────────────────────
    println!("\n── Test 3: classify_role() on familiar grid ──");
    let objs3 = observe_grid(&grid_3x3_red);
    let role = classify_role(&objs3[0], &objs3, 3, 3);
    println!("  Role of isolated red dot: {:?}", role);
    assert!(
        matches!(role, ObjectRole::IsolatedSmall | ObjectRole::UniqueSingleton | ObjectRole::SmallestObject),
        "Isolated single cell should be IsolatedSmall or UniqueSingleton, got {:?}", role
    );
    println!("  [PASS] Role classified correctly");

    // ── Test 4: diff_grids() detects Recolor ──────────────────────
    println!("\n── Test 4: diff_grids() — Red→Blue recolor ──");
    let input_rc: Vec<Vec<u8>> = vec![
        vec![9, 9, 9],
        vec![9, 1, 9],
        vec![9, 9, 9],
    ];
    let output_rc: Vec<Vec<u8>> = vec![
        vec![9, 9, 9],
        vec![9, 2, 9],
        vec![9, 9, 9],
    ];
    let diff = diff_grids(&input_rc, &output_rc);
    println!("  Changes found: {}", diff.changes.len());
    assert_eq!(diff.changes.len(), 1);
    assert_eq!(diff.changes[0].behavior, BehaviorType::Recolor { from: 1, to: 2 });
    println!("  [PASS] Recolor(1→2) detected from diff");

    // ── Test 5: Scientific loop — teach 3 Red→Blue pairs ──────────
    println!("\n── Test 5: Scientific loop — 3 Red→Blue training pairs ──");
    let pairs_input = vec![
        vec![vec![9u8,9,9],vec![9,1,9],vec![9,9,9]],
        vec![vec![9u8,1,9],vec![9,9,9],vec![9,9,9]],
        vec![vec![9u8,9,9],vec![9,9,9],vec![9,1,9]],
    ];
    let pairs_output = vec![
        vec![vec![9u8,9,9],vec![9,2,9],vec![9,9,9]],
        vec![vec![9u8,2,9],vec![9,9,9],vec![9,9,9]],
        vec![vec![9u8,9,9],vec![9,9,9],vec![9,2,9]],
    ];
    let pairs: Vec<(&[Vec<u8>], &[Vec<u8>])> = pairs_input.iter()
        .zip(pairs_output.iter())
        .map(|(i, o)| (i.as_slice(), o.as_slice()))
        .collect();

    let mut grammar: RelationalGrammar = HashMap::new();
    let log = run_scientific_loop(&mut grammar, &pairs);

    println!("  Grammar rules after training: {}", grammar.values().map(|v| v.len()).sum::<usize>());
    println!("  Experiment log ({} entries):", log.len());
    for entry in &log {
        println!("    pair {}: {:?}  score={:.2}  ({}/{})",
                 entry.pair_index, entry.behavior, entry.score,
                 entry.cells_match, entry.cells_total);
        assert!(entry.score > 0.8,
                "Score should be >0.8 for Red→Blue pairs, got {:.2}", entry.score);
    }
    println!("  [PASS] All pairs scored >0.8");

    // ── Test 6: Novel prediction ────────────────────────────────────
    println!("\n── Test 6: Predict on novel 4×4 Red on Black ──");
    let novel_input: Vec<Vec<u8>> = vec![
        vec![9,9,9,9],
        vec![9,1,9,9],
        vec![9,9,9,9],
        vec![9,9,1,9],
    ];
    if let Some((behavior, confidence, agent)) = predict_relational(&grammar, &novel_input) {
        println!("  Predicted: {:?}", behavior);
        println!("  Confidence: {:.4}", confidence);
        println!("  Agent: value={} role={:?} size={:?}",
                 agent.value,
                 classify_role(&agent, &observe_grid(&novel_input), 4, 4),
                 agent.size_class);
        assert_eq!(behavior, BehaviorType::Recolor { from: 1, to: 2 },
                   "Should predict Recolor(1→2) on novel Red grid");
        assert!(confidence > 0.5, "Confidence should be > 0.5");
        println!("  [PASS] Correct relational prediction on novel grid");
    } else {
        panic!("No prediction made — grammar should have learned from training");
    }

    // ── Test 7: ReflectH diff detection ────────────────────────────
    println!("\n── Test 7: diff_grids() — ReflectH ──");
    let input_rh: Vec<Vec<u8>> = vec![
        vec![1,9,9,9],
        vec![1,9,9,9],
        vec![9,9,9,9],
        vec![9,9,9,9],
    ];
    let output_rh: Vec<Vec<u8>> = vec![
        vec![9,9,9,9],
        vec![9,9,9,9],
        vec![1,9,9,9],
        vec![1,9,9,9],
    ];
    let diff_rh = diff_grids(&input_rh, &output_rh);
    println!("  Changes: {}", diff_rh.changes.len());
    if !diff_rh.changes.is_empty() {
        println!("  Behavior: {:?}", diff_rh.changes[0].behavior);
        let b = diff_rh.changes[0].behavior;
        assert!(matches!(b, BehaviorType::ReflectH | BehaviorType::Move { .. }),
                "Should detect ReflectH or Move for a flipped object");
        println!("  [PASS] Reflection or move detected");
    }

    println!("\n✅ Phase 4 tests complete.");
    println!("   BabyZero now sees OBJECTS and reasons about ROLES.");
    println!("   The Scientific Method Loop is live.");
    run_phase5_tests();
}


// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: REAL ARC JSON LOADER + EVALUATION
// Load actual ARC-AGI training tasks → seed grammar → predict → score
// "Does the scientific method generalize to real puzzles?"
// ══════════════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};

// ── SECTION 28: ARC JSON TYPES ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ArcPair {
    pub input:  Vec<Vec<u8>>,
    pub output: Vec<Vec<u8>>,
}

#[derive(Debug, Deserialize)]
pub struct ArcTask {
    pub train: Vec<ArcPair>,
    pub test:  Vec<ArcPair>,
}

impl ArcTask {
    pub fn from_file(path: &str) -> Result<Self, String> {
        let raw = std::fs::read_to_string(path)
            .map_err(|e| format!("Cannot read {}: {}", path, e))?;
        serde_json::from_str(&raw)
            .map_err(|e| format!("JSON parse error in {}: {}", path, e))
    }
}

// ── SECTION 29: MULTI-BEHAVIOR PREDICTION ────────────────────────────────────
//
// Phase 3 applied one transform globally (e.g., all 1s → 2s).
// Real ARC tasks often involve MULTIPLE concurrent transforms:
//   - 3 columns of different colors each map to a different target
//   - Multiple objects each move independently
//
// Solution: collect ALL seeded hypotheses with confidence > threshold
// and apply them together. This is "hypothesis composition."

/// Apply ALL high-confidence behaviors from the grammar to the input grid.
/// Returns the predicted output grid.
pub fn predict_composed(
    grammar: &RelationalGrammar,
    input:   &[Vec<u8>],
    min_confidence: f32,
) -> Vec<Vec<u8>> {
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    let mut predicted = input.to_vec();
    let objs = observe_grid(input);

    // Collect all high-confidence hypotheses
    let mut active: Vec<(BehaviorType, f32)> = Vec::new();
    for hypotheses in grammar.values() {
        for h in hypotheses {
            if h.confidence >= min_confidence {
                if !active.iter().any(|(b, _)| *b == h.behavior) {
                    active.push((h.behavior, h.confidence));
                }
            }
        }
    }

    // Sort: highest confidence first
    active.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Apply each behavior to the running prediction
    let dummy_agent = objs.first().cloned();
    for (behavior, _conf) in &active {
        match behavior {
            BehaviorType::Recolor { from, to } => {
                for r in 0..rows {
                    for c in 0..cols {
                        if predicted[r][c] == *from { predicted[r][c] = *to; }
                    }
                }
            }
            BehaviorType::ReflectH => {
                for r in 0..rows / 2 {
                    let mirror = rows - 1 - r;
                    for c in 0..cols {
                        let tmp = predicted[r][c];
                        predicted[r][c] = predicted[mirror][c];
                        predicted[mirror][c] = tmp;
                    }
                }
            }
            BehaviorType::ReflectV => {
                for r in 0..rows {
                    for c in 0..cols / 2 {
                        let mirror = cols - 1 - c;
                        let tmp = predicted[r][c];
                        predicted[r][c] = predicted[r][mirror];
                        predicted[r][mirror] = tmp;
                    }
                }
            }
            BehaviorType::Move { dr, dc } => {
                if let Some(ref agent) = dummy_agent {
                    let mut moved = predicted.clone();
                    for &(r, c) in &agent.cells {
                        moved[r][c] = 9;
                    }
                    for &(r, c) in &agent.cells {
                        let nr = r as i32 + *dr as i32;
                        let nc = c as i32 + *dc as i32;
                        if nr >= 0 && nc >= 0 && (nr as usize) < rows && (nc as usize) < cols {
                            moved[nr as usize][nc as usize] = agent.value;
                        }
                    }
                    predicted = moved;
                }
            }
            _ => {}
        }
    }
    predicted
}

/// Score a prediction against expected output. Returns (matching_cells, total_cells, fraction).
pub fn score_prediction(predicted: &[Vec<u8>], expected: &[Vec<u8>]) -> (usize, usize, f32) {
    // Handle different-sized grids (e.g., 44f52bb0 outputs a 1×1)
    if predicted.len() != expected.len()
        || predicted.first().map(|r| r.len()) != expected.first().map(|r| r.len()) {
        return (0, expected.len() * expected.first().map(|r| r.len()).unwrap_or(0), 0.0);
    }
    let rows = expected.len();
    let cols = expected.first().map(|r| r.len()).unwrap_or(0);
    let total = rows * cols;
    let matches = (0..rows).flat_map(|r| (0..cols).map(move |c| (r, c)))
        .filter(|&(r, c)| predicted[r][c] == expected[r][c])
        .count();
    (matches, total, matches as f32 / total.max(1) as f32)
}

// ── SECTION 30: TASK EVALUATOR ────────────────────────────────────────────────

#[derive(Debug)]
pub struct TaskEvalResult {
    pub task_id:          String,
    pub train_pairs:      usize,
    pub test_pairs:       usize,
    pub grammar_rules:    usize,
    pub behaviors_found:  Vec<BehaviorType>,
    pub test_scores:      Vec<f32>,
    pub mean_score:       f32,
    pub solved:           bool,   // all test pairs score >= 0.9
}

/// Full evaluation pipeline for one ARC task:
///   1. OBSERVE+HYPOTHESIZE: seed grammar from all training pairs
///   2. TEST: predict on each test pair, score
///   3. LOG: report
pub fn evaluate_arc_task(task: &ArcTask, task_id: &str) -> TaskEvalResult {
    let mut grammar: RelationalGrammar = HashMap::new();

    // Seed from all training pairs
    for (i, pair) in task.train.iter().enumerate() {
        let diff = diff_grids(&pair.input, &pair.output);
        let behaviors: Vec<_> = diff.changes.iter()
            .map(|c| c.behavior)
            .filter(|b| !matches!(b, BehaviorType::Unknown))
            .collect();
        if !behaviors.is_empty() {
            print!("  train[{}] behaviors: ", i);
            for b in &behaviors { print!("{:?}  ", b); }
            println!();
        }
        seed_relational(&mut grammar, &pair.input, &pair.output, i as u64);
    }

    let grammar_rules: usize = grammar.values().map(|v| v.len()).sum();

    // Collect unique behaviors found
    let mut behaviors_found: Vec<BehaviorType> = Vec::new();
    for hs in grammar.values() {
        for h in hs {
            if !behaviors_found.contains(&h.behavior) {
                behaviors_found.push(h.behavior);
            }
        }
    }

    // Predict on test pairs using composed prediction
    let mut test_scores = Vec::new();
    for (i, pair) in task.test.iter().enumerate() {
        let predicted = predict_composed(&grammar, &pair.input, 0.4);
        let (matches, total, score) = score_prediction(&predicted, &pair.output);

        // Print grid comparison for small grids
        let rows = pair.input.len();
        let cols = pair.input.first().map(|r| r.len()).unwrap_or(0);
        if rows <= 7 && cols <= 7 {
            println!("  test[{}] input:", i);
            for row in &pair.input {
                print!("    ");
                for &v in row { print!("{} ", v); }
                println!();
            }
            println!("  test[{}] predicted:", i);
            for row in &predicted {
                print!("    ");
                for &v in row { print!("{} ", v); }
                println!();
            }
            println!("  test[{}] expected:", i);
            for row in &pair.output {
                print!("    ");
                for &v in row { print!("{} ", v); }
                println!();
            }
        }

        println!("  test[{}] score: {:.1}% ({}/{})", i, score * 100.0, matches, total);
        test_scores.push(score);
    }

    let mean_score = if test_scores.is_empty() { 0.0 }
                     else { test_scores.iter().sum::<f32>() / test_scores.len() as f32 };
    let solved = test_scores.iter().all(|&s| s >= 0.9);

    TaskEvalResult {
        task_id:         task_id.to_string(),
        train_pairs:     task.train.len(),
        test_pairs:      task.test.len(),
        grammar_rules,
        behaviors_found,
        test_scores,
        mean_score,
        solved,
    }
}

// ── SECTION 31: PHASE 5 TESTS ─────────────────────────────────────────────────

pub fn run_phase5_tests() {
    println!("\n{}", "═".repeat(60));
    println!("PHASE 5: Real ARC-AGI Evaluation");
    println!("{}", "═".repeat(60));

    // Find arc-data directory relative to the binary
    // When run via `cargo run` the working dir is the project root
    let arc_dir = "arc-data";
    let tasks = [
        ("0d3d703e", "Multi-color substitution (column palette swap)"),
        ("67a3c6ac", "ReflectV (each row reversed)"),
        ("3618c87e", "Gravitational fall (1s drop to 5-row)"),
    ];

    let mut results: Vec<TaskEvalResult> = Vec::new();

    for (task_id, description) in &tasks {
        let path = format!("{}/{}.json", arc_dir, task_id);
        println!("\n── Task: {} ──", task_id);
        println!("   Description: {}", description);

        match ArcTask::from_file(&path) {
            Ok(task) => {
                println!("   Training pairs: {}  Test pairs: {}",
                         task.train.len(), task.test.len());
                let result = evaluate_arc_task(&task, task_id);
                println!("   Grammar rules seeded: {}", result.grammar_rules);
                print!("   Behaviors detected: ");
                if result.behaviors_found.is_empty() {
                    print!("none (all diffs Unknown)");
                } else {
                    for b in &result.behaviors_found { print!("{:?}  ", b); }
                }
                println!();
                println!("   Mean test score: {:.1}%  {}",
                         result.mean_score * 100.0,
                         if result.solved { "✅ SOLVED" } else { "🔬 Partial" });
                results.push(result);
            }
            Err(e) => {
                println!("   ⚠ Could not load: {}", e);
            }
        }
    }

    // Summary
    println!("\n{}", "─".repeat(60));
    println!("EVALUATION SUMMARY");
    println!("{}", "─".repeat(60));
    let solved = results.iter().filter(|r| r.solved).count();
    let total  = results.len();
    println!("  Tasks attempted: {}", total);
    println!("  Tasks solved (≥90%): {}/{}", solved, total);
    println!();
    for r in &results {
        let status = if r.solved { "✅ SOLVED" } else { "🔬 partial" };
        println!("  {:12} {:8.1}%  {}  rules={}",
                 r.task_id, r.mean_score * 100.0, status, r.grammar_rules);
    }

    // Honest science report
    println!("\n{}", "─".repeat(60));
    println!("WHAT BABYZERO LEARNED");
    println!("{}", "─".repeat(60));
    println!("  BabyZero is a scientist — it observes, hypothesizes, tests.");
    println!("  Each task tells us what it can and cannot yet perceive:");
    println!();
    for r in &results {
        println!("  {}:", r.task_id);
        if r.behaviors_found.is_empty() {
            println!("    → Behaviors: none detected (diff produced Unknown)");
            println!("    → Gap: transform is beyond current BehaviorType vocabulary");
        } else {
            print!("    → Detected: ");
            for b in &r.behaviors_found { print!("{:?}  ", b); }
            println!();
            println!("    → Score: {:.1}% — {}",
                     r.mean_score * 100.0,
                     if r.solved {
                         "rule generalizes perfectly to test"
                     } else if r.mean_score > 0.5 {
                         "partial match — rule covers some objects, misses others"
                     } else {
                         "low match — rule found but doesn't generalize to test grid"
                     });
        }
    }

    println!("\n✅ Phase 5 evaluation complete.");
    println!("   BabyZero has seen real ARC data for the first time.");
    println!("   The scientific loop ran on genuine puzzles.");

    run_phase6_tests();
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 6: AMYGDALA — THE SELF STAGE
// "The self is the minimum sufficient cause."
// Fluid, present-tense. Re-evaluated per observation. No lock-in.
// Six questions: Where am I? Who am I? How do I move? How do I feel?
//                What do I want? How do I get it?
// ══════════════════════════════════════════════════════════════════════════════

// ── SECTION 32: EGOCENTRIC MAP ───────────────────────────────────────────────
// Not allocentric ("object is at row 2, col 4").
// Egocentric: "I am in the top-left quadrant. The edge is 2 cells behind me.
//              The nearest object is 3 cells to my right."
// Everything measured from MY centroid. Present tense. Fluid.

#[derive(Debug, Clone)]
pub struct EgocentricMap {
    pub centroid:      (f32, f32),                       // MY centroid — the anchor
    pub ego_row:       f32,                              // 0=top  1=bottom (normalized)
    pub ego_col:       f32,                              // 0=left 1=right  (normalized)
    pub to_edge:       [f32; 4],                         // [top, right, bottom, left] in cells
    pub nearest:       Option<(f32, f32, ColorFamily)>,  // (delta_row, delta_col, family)
    pub void_pressure: f32,                              // 0=surrounded  1=completely alone
}

impl EgocentricMap {
    pub fn from_focal(focal: &Object, all: &[Object], rows: usize, cols: usize) -> Self {
        let (cr, cc) = focal.centroid();
        let ego_row = cr / rows.max(1) as f32;
        let ego_col = cc / cols.max(1) as f32;
        let to_edge = [
            cr,                               // distance to top edge
            cols as f32 - 1.0 - cc,          // distance to right edge
            rows as f32 - 1.0 - cr,          // distance to bottom edge
            cc,                               // distance to left edge
        ];

        // Nearest neighbor — in ego-centric delta space
        let nearest = all.iter()
            .filter(|o| !(o.bbox == focal.bbox && o.value == focal.value))
            .min_by(|a, b| {
                let (ar, ac) = a.centroid();
                let (br, bc) = b.centroid();
                let da = (ar - cr).powi(2) + (ac - cc).powi(2);
                let db = (br - cr).powi(2) + (bc - cc).powi(2);
                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|o| {
                let (or_, oc) = o.centroid();
                (or_ - cr, oc - cc, o.color_family)
            });

        let void_pressure = match focal.isolation {
            IsolationLevel::Isolated => 1.0,
            IsolationLevel::Near     => 0.5,
            IsolationLevel::Touching => 0.0,
        };

        Self { centroid: (cr, cc), ego_row, ego_col, to_edge, nearest, void_pressure }
    }

    pub fn quadrant(&self) -> &'static str {
        match (self.ego_row < 0.5, self.ego_col < 0.5) {
            (true,  true)  => "top-left",
            (true,  false) => "top-right",
            (false, true)  => "bottom-left",
            (false, false) => "bottom-right",
        }
    }

    /// Which axis would move my centroid more under reflection?
    /// Used to disambiguate ReflectH vs ReflectV without needing ground truth.
    pub fn dominant_reflect_axis(&self, rows: usize, cols: usize) -> BehaviorType {
        let (cr, cc) = self.centroid;
        // How far does my centroid move under each reflection?
        let row_delta = (rows as f32 - 1.0 - 2.0 * cr).abs(); // ReflectH moves rows
        let col_delta = (cols as f32 - 1.0 - 2.0 * cc).abs(); // ReflectV moves cols
        if col_delta > row_delta { BehaviorType::ReflectV } else { BehaviorType::ReflectH }
    }
}

// ── SECTION 33: DRIVE STATE + SELF-MODEL ─────────────────────────────────────

/// Drive state: the gap between current self-state and grammar-predicted output.
/// Not a plan. A desire with direction. Present tense.
#[derive(Debug, Clone)]
pub struct DriveState {
    pub behavior:   BehaviorType,  // what grammar says should happen to me
    pub confidence: f32,
    pub approach:   bool,          // true = move toward attractor (high void pressure)
}

/// SelfModel — fluid, present-tense snapshot.
/// Re-evaluated per observation. Not stored between calls.
/// Identity = causal reach. Self = minimum sufficient cause.
/// residual: fraction of output diff NOT explained by self's action. Lower = better self.
#[derive(Debug, Clone)]
pub struct SelfModel {
    pub focal:        Object,
    pub ego_map:      EgocentricMap,
    pub action_vocab: Vec<BehaviorType>,
    pub drive:        Option<DriveState>,
    pub residual:     f32,
}

impl SelfModel {
    pub fn print_report(&self, label: &str) {
        let (cr, cc) = self.ego_map.centroid;
        println!("  [SELF:{}] val={} fam={:?} size={:?} quad={}",
                 label, self.focal.value, self.focal.color_family,
                 self.focal.size_class, self.ego_map.quadrant());
        println!("           centroid=({:.1},{:.1}) void_pressure={:.2}",
                 cr, cc, self.ego_map.void_pressure);
        println!("           to_edges=[T:{:.1} R:{:.1} B:{:.1} L:{:.1}]",
                 self.ego_map.to_edge[0], self.ego_map.to_edge[1],
                 self.ego_map.to_edge[2], self.ego_map.to_edge[3]);
        if let Some(ref drive) = self.drive {
            println!("           DRIVE: {:?}  conf={:.3}  approach={}",
                     drive.behavior, drive.confidence, drive.approach);
        } else {
            println!("           DRIVE: none");
        }
        println!("           residual={:.4}  {}",
                 self.residual,
                 if self.residual < 0.15 { "✓ strong self" }
                 else if self.residual < 0.5 { "~ partial" }
                 else { "✗ weak" });
    }
}

// ── SECTION 34: SELECT FOCAL OBJECT ──────────────────────────────────────────
// FLUID. PRESENT TENSE. No lock-in.
// The self is the object whose action, when applied, minimizes unexplained diff.
// "Who am I right now?" = "Who explains the most right now?"

/// Select the focal object (self) from the input grid.
/// expected: training output, used to score residual. None = test time.
pub fn select_focal_object(
    grammar:  &RelationalGrammar,
    input:    &[Vec<u8>],
    expected: Option<&[Vec<u8>]>,
) -> Option<SelfModel> {
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    let all_objs = observe_grid(input);
    if all_objs.is_empty() { return None; }

    let mut best: Option<SelfModel> = None;
    let mut best_residual = f32::MAX;

    for obj in &all_objs {
        let ego_map = EgocentricMap::from_focal(obj, &all_objs, rows, cols);
        let agent_role = classify_role(obj, &all_objs, rows, cols);
        let context_role = all_objs.iter()
            .filter(|o| !(o.bbox == obj.bbox && o.value == obj.value))
            .max_by_key(|o| o.cell_count())
            .map(|ctx| classify_role(ctx, &all_objs, rows, cols))
            .unwrap_or(agent_role);
        let key = RelationKey { agent_role, context_role, size_class: obj.size_class };

        // Ego-centric action vocabulary:
        // Recolor rules filtered to only those where from == self.value.
        // This collapses 12 competing palette signals to 1 per focal object.
        let mut action_vocab: Vec<BehaviorType> = Vec::new();
        for hs in grammar.values() {
            for h in hs {
                if h.confidence < 0.3 { continue; }
                let keep = match h.behavior {
                    BehaviorType::Recolor { from, .. } => from == obj.value,
                    _ => true,
                };
                if keep && !action_vocab.contains(&h.behavior) {
                    action_vocab.push(h.behavior);
                }
            }
        }

        // Find best ego-compatible hypothesis for this object
        // Ego-compatible filter helper: Recolor only if from == self.value
        let ego_ok = |b: BehaviorType| -> bool {
            match b {
                BehaviorType::Recolor { from, .. } => from == obj.value,
                _ => true,
            }
        };

        // Return (behavior, confidence) by value — avoids lifetime issues with closures
        // Tier 1: exact key match
        let best_hyp: Option<(BehaviorType, f32)> = grammar.get(&key)
            .and_then(|hs| {
                hs.iter()
                    .filter(|h| ego_ok(h.behavior))
                    .max_by(|a, b|
                        a.confidence.partial_cmp(&b.confidence)
                                   .unwrap_or(std::cmp::Ordering::Equal)
                    )
                    .map(|h| (h.behavior, h.confidence))
            })
            // Tier 2: same agent_role
            .or_else(|| {
                grammar.iter()
                    .filter(|(k, _)| k.agent_role == key.agent_role)
                    .flat_map(|(_, hs)| hs.iter())
                    .filter(|h| ego_ok(h.behavior))
                    .max_by(|a, b|
                        a.confidence.partial_cmp(&b.confidence)
                                   .unwrap_or(std::cmp::Ordering::Equal)
                    )
                    .map(|h| (h.behavior, h.confidence))
            })
            // Tier 3: anything ego-compatible
            .or_else(|| {
                grammar.values()
                    .flat_map(|hs| hs.iter())
                    .filter(|h| ego_ok(h.behavior))
                    .max_by(|a, b|
                        a.confidence.partial_cmp(&b.confidence)
                                   .unwrap_or(std::cmp::Ordering::Equal)
                    )
                    .map(|h| (h.behavior, h.confidence))
            });

        let (predicted_behavior, hyp_confidence) = best_hyp.unwrap_or((BehaviorType::Unknown, 0.0));

        // Measure residual
        let residual = if let Some(exp) = expected {
            let score = test_hypothesis(predicted_behavior, obj, input, exp);
            1.0 - score
        } else {
            1.0 - hyp_confidence.clamp(0.0, 1.0)
        };

        let drive = if predicted_behavior != BehaviorType::Unknown {
            Some(DriveState {
                behavior:   predicted_behavior,
                confidence: hyp_confidence,
                approach:   ego_map.void_pressure > 0.5,
            })
        } else {
            None
        };

        let model = SelfModel {
            focal:        obj.clone(),
            ego_map,
            action_vocab,
            drive,
            residual,
        };

        if residual < best_residual {
            best_residual = residual;
            best = Some(model);
        }
    }

    best
}

// ── SECTION 35: EGO-CENTRIC PREDICTION ───────────────────────────────────────
// predict_ego: use SelfModel to drive prediction.
// Three modes, selected by dominant grammar signal:
//   PALETTE mode  — ego-centric Recolor per unique value (fixes palette swap)
//   REFLECT mode  — ego-centric axis disambiguation (fixes ReflectV selection)
//   MOVE mode     — focal object drives its own translation

pub fn predict_ego(
    grammar: &RelationalGrammar,
    input:   &[Vec<u8>],
) -> Vec<Vec<u8>> {
    let rows = input.len();
    let cols = input.first().map(|r| r.len()).unwrap_or(0);
    let mut predicted = input.to_vec();
    let all_objs = observe_grid(input);

    // Gather all seeded behaviors by type
    let recolor_rules: Vec<(u8, u8, f32)> = grammar.values()
        .flat_map(|hs| hs.iter())
        .filter_map(|h| match h.behavior {
            BehaviorType::Recolor { from, to } => Some((from, to, h.confidence)),
            _ => None,
        })
        .collect();

    // Carry evidence_count as third field — self-override needs earned confidence, not just high confidence
    let reflect_rules: Vec<(BehaviorType, f32, u32)> = grammar.values()
        .flat_map(|hs| hs.iter())
        .filter(|h| matches!(h.behavior, BehaviorType::ReflectH | BehaviorType::ReflectV))
        .map(|h| (h.behavior, h.confidence, h.evidence_count))
        .collect();

    let move_rules: Vec<(i8, i8, f32)> = grammar.values()
        .flat_map(|hs| hs.iter())
        .filter_map(|h| match h.behavior {
            BehaviorType::Move { dr, dc } => Some((dr, dc, h.confidence)),
            _ => None,
        })
        .collect();

    let fall_confidence: f32 = grammar.values()
        .flat_map(|hs| hs.iter())
        .filter(|h| h.behavior == BehaviorType::FallToSurface)
        .map(|h| h.confidence)
        .fold(0.0_f32, f32::max);

    // Check if grammar has per-value Recolor coverage
    let unique_vals: Vec<u8> = {
        let mut vals: Vec<u8> = all_objs.iter().map(|o| o.value).collect();
        vals.sort_unstable();
        vals.dedup();
        vals
    };
    let covered_vals = unique_vals.iter()
        .filter(|&&v| recolor_rules.iter().any(|(f, _, _)| *f == v))
        .count();
    // If majority of grammar rules are Recolor → palette mode
    let total_rules: usize = grammar.values().map(|v| v.len()).sum();
    let recolor_count = recolor_rules.len();
    let in_palette_mode = total_rules > 0 && recolor_count * 2 >= total_rules && covered_vals > 0;

    // Section comment: mode priority — palette → fall → reflect → move
    // Fall must beat reflect: FallToSurface tasks also generate ReflectH noise,
    // so if fall_confidence is seeded at all, it should route to FALL MODE first.
    if in_palette_mode {
        // PALETTE MODE — ego-centric Recolor per unique input value
        // Each value gets its own targeted rule. Collapses 12 signals → 1 per color.
        for &val in &unique_vals {
            if let Some(&(from, to, _)) = recolor_rules.iter()
                .filter(|(f, _, _)| *f == val)
                .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal))
            {
                for row in &mut predicted {
                    for cell in row.iter_mut() {
                        if *cell == from { *cell = to; }
                    }
                }
            }
        }

    } else if fall_confidence > 0.0 {
        // FALL MODE — gravity. Apply FallToSurface to every object of the focal value.
        // Each object falls independently until it hits a non-zero, non-self surface or the bottom.
        let focal_self = select_focal_object(grammar, input, None);
        let agent_value = focal_self.as_ref().map(|sm| sm.focal.value).unwrap_or(1);

        // Accrete check: if grammar knows Accrete, the agent embeds INTO the surface
        // (lands at the deepest surface cell in its column, replacing it).
        // Otherwise, classic land-on-top (last empty row above obstacle).
        let accrete_confidence: f32 = grammar.values()
            .flat_map(|hs| hs.iter())
            .filter(|h| h.behavior == BehaviorType::Accrete)
            .map(|h| h.confidence)
            .fold(0.0_f32, f32::max);
        let embed_mode = accrete_confidence > 0.0;

        let mut moved = predicted.clone();
        // Erase all objects with agent_value first
        for obj in all_objs.iter().filter(|o| o.value == agent_value) {
            for &(r, c) in &obj.cells { moved[r][c] = 0; }
        }
        // Drop each cell independently
        for obj in all_objs.iter().filter(|o| o.value == agent_value) {
            for &(r, c) in &obj.cells {
                if embed_mode {
                    // EMBED MODE: find the deepest (highest row index) non-zero cell in this
                    // column below the starting position; land AT that cell (replace it).
                    let surface_r = (r + 1..rows)
                        .rev()
                        .find(|&nr| moved[nr][c] != 0 && moved[nr][c] != agent_value);
                    let land_r = surface_r.unwrap_or(rows - 1);
                    moved[land_r][c] = agent_value;
                } else {
                    // CLASSIC MODE: land at last empty row above first obstacle
                    let mut land_r = r;
                    for nr in (r + 1)..rows {
                        if moved[nr][c] == 0 { land_r = nr; } else { break; }
                    }
                    moved[land_r][c] = agent_value;
                }
            }
        }
        predicted = moved;

    } else if !reflect_rules.is_empty() {
        // REFLECT MODE — select focal self, use ego_map to disambiguate axis
        let focal_self = select_focal_object(grammar, input, None);

        // Determine majority grammar vote (highest-confidence reflect rule)
        let majority_behavior = reflect_rules.iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(b, _, _)| *b)
            .unwrap_or(BehaviorType::ReflectH);

        // SELF-OVERRIDE check: find highest-confidence opposite of majority
        let minority_reflect = if majority_behavior == BehaviorType::ReflectH {
            BehaviorType::ReflectV
        } else {
            BehaviorType::ReflectH
        };
        // Carry both confidence and evidence_count — override requires EARNED confidence
        let (minority_conf, minority_evidence) = reflect_rules.iter()
            .find(|(b, _, _)| *b == minority_reflect)
            .map(|(_, conf, ev)| (*conf, *ev))
            .unwrap_or((0.0, 0));

        // Evidence gate: self-override must be earned, not just loud.
        // A fresh seed of 3 training pairs can produce high confidence from noise.
        // Require the minority to have ≥3 observations before it can override majority.
        const OVERRIDE_MIN_EVIDENCE: u32 = 3;

        let behavior = if let Some(ref sm) = focal_self {
            let is_unique   = sm.residual < 0.15; // residual < 15% = strong unique signal
            let is_earned   = minority_evidence >= OVERRIDE_MIN_EVIDENCE;

            if is_unique && minority_conf > 0.0 && is_earned {
                // Unique self + grammar knows the minority behavior with earned evidence → SELF OVERRIDE fires
                println!("  ⚡ SELF OVERRIDE: unique-self ({:?} res={:.3}) beats majority. minority={:?}@{:.2} ev={} maj={:?}",
                         sm.ego_map.quadrant(), sm.residual, minority_reflect, minority_conf, minority_evidence, majority_behavior);
                minority_reflect
            } else {
                if is_unique && minority_conf > 0.0 && !is_earned {
                    println!("  ⏳ override suppressed — minority evidence {} < {} required",
                             minority_evidence, OVERRIDE_MIN_EVIDENCE);
                }
                // Standard path: ego_map's symmetry preference
                sm.ego_map.dominant_reflect_axis(rows, cols)
            }
        } else {
            // No focal — highest-confidence reflect wins
            majority_behavior
        };

        match behavior {
            BehaviorType::ReflectH => {
                for r in 0..rows / 2 {
                    let mirror = rows - 1 - r;
                    for c in 0..cols {
                        let tmp = predicted[r][c];
                        predicted[r][c] = predicted[mirror][c];
                        predicted[mirror][c] = tmp;
                    }
                }
            }
            BehaviorType::ReflectV => {
                for r in 0..rows {
                    for c in 0..cols / 2 {
                        let mirror = cols - 1 - c;
                        let tmp = predicted[r][c];
                        predicted[r][c] = predicted[r][mirror];
                        predicted[r][mirror] = tmp;
                    }
                }
            }
            _ => {}
        }

    } else if !move_rules.is_empty() {
        // MOVE MODE — focal self drives its own translation
        let focal_self = select_focal_object(grammar, input, None);
        if let Some(ref sm) = focal_self {
            if let Some(&(dr, dc, _)) = move_rules.iter()
                .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal))
            {
                let agent = &sm.focal;
                let mut moved = predicted.clone();
                for &(r, c) in &agent.cells { moved[r][c] = 9; }
                for &(r, c) in &agent.cells {
                    let nr = r as i32 + dr as i32;
                    let nc = c as i32 + dc as i32;
                    if nr >= 0 && nc >= 0 && nr < rows as i32 && nc < cols as i32 {
                        moved[nr as usize][nc as usize] = agent.value;
                    }
                }
                predicted = moved;
            }
        }
    }

    predicted
}

// ── SECTION 36: PHASE 6 TASK EVALUATOR ───────────────────────────────────────

pub fn evaluate_arc_task_v6(task: &ArcTask, task_id: &str) -> TaskEvalResult {
    let mut grammar: RelationalGrammar = HashMap::new();

    // Seed from all training pairs
    for (i, pair) in task.train.iter().enumerate() {
        let diff = diff_grids(&pair.input, &pair.output);
        let behaviors: Vec<_> = diff.changes.iter()
            .map(|c| c.behavior)
            .filter(|b| !matches!(b, BehaviorType::Unknown))
            .collect();
        if !behaviors.is_empty() {
            print!("  train[{}] behaviors: ", i);
            for b in &behaviors { print!("{:?}  ", b); }
            println!();
        }
        seed_relational(&mut grammar, &pair.input, &pair.output, i as u64);
    }

    let grammar_rules: usize = grammar.values().map(|v| v.len()).sum();

    // Show SelfModel for first training pair
    if let Some(first_pair) = task.train.first() {
        if let Some(sm) = select_focal_object(
            &grammar, &first_pair.input, Some(&first_pair.output)
        ) {
            sm.print_report("train[0]");
        }
    }

    let mut behaviors_found: Vec<BehaviorType> = Vec::new();
    for hs in grammar.values() {
        for h in hs {
            if !behaviors_found.contains(&h.behavior) {
                behaviors_found.push(h.behavior);
            }
        }
    }

    // Predict test pairs using ego-centric prediction
    let mut test_scores = Vec::new();
    for (i, pair) in task.test.iter().enumerate() {
        let predicted = predict_ego(&grammar, &pair.input);
        let (matches, total, score) = score_prediction(&predicted, &pair.output);

        let rows = pair.input.len();
        let cols = pair.input.first().map(|r| r.len()).unwrap_or(0);
        if rows <= 7 && cols <= 7 {
            print_grid(&format!("test[{}] input", i), &pair.input);
            print_grid(&format!("test[{}] predicted (v6)", i), &predicted);
            print_grid(&format!("test[{}] expected", i), &pair.output);
        }

        println!("  test[{}] v6 score: {:.1}% ({}/{})", i, score * 100.0, matches, total);
        test_scores.push(score);
    }

    let mean_score = if test_scores.is_empty() { 0.0 }
                     else { test_scores.iter().sum::<f32>() / test_scores.len() as f32 };
    let solved = test_scores.iter().all(|&s| s >= 0.9);

    TaskEvalResult {
        task_id:         task_id.to_string(),
        train_pairs:     task.train.len(),
        test_pairs:      task.test.len(),
        grammar_rules,
        behaviors_found,
        test_scores,
        mean_score,
        solved,
    }
}

// ── SECTION 37: PHASE 6 TESTS ─────────────────────────────────────────────────

pub fn run_phase6_tests() {
    println!("\n{}", "═".repeat(60));
    println!("PHASE 6: Amygdala — The Self Stage");
    println!("\"The self is the minimum sufficient cause.\"");
    println!("{}", "═".repeat(60));

    let arc_dir = "arc-data";
    let tasks = [
        ("0d3d703e", "Multi-color palette swap (ego-centric Recolor)"),
        ("67a3c6ac", "ReflectV — axis disambiguated by ego_map"),
        ("3618c87e", "Gravitational fall — focal self + drive state"),
    ];

    let mut results: Vec<TaskEvalResult> = Vec::new();

    for (task_id, description) in &tasks {
        let path = format!("{}/{}.json", arc_dir, task_id);
        println!("\n── Task: {} ({}) ──", task_id, description);

        match ArcTask::from_file(&path) {
            Ok(task) => {
                println!("   Training pairs: {}  Test pairs: {}",
                         task.train.len(), task.test.len());
                let result = evaluate_arc_task_v6(&task, task_id);
                println!("   Grammar rules: {}  Mean score: {:.1}%  {}",
                         result.grammar_rules,
                         result.mean_score * 100.0,
                         if result.solved { "✅ SOLVED" } else { "🔬 Partial" });
                results.push(result);
            }
            Err(e) => println!("   ⚠ Could not load: {}", e),
        }
    }

    // Compare v5 vs v6
    println!("\n{}", "─".repeat(60));
    println!("PHASE 6 SUMMARY — EGO VS FLAT");
    println!("{}", "─".repeat(60));
    let v5_baselines = [0.0f32, 33.3, 36.0];
    for (i, r) in results.iter().enumerate() {
        let v5 = v5_baselines.get(i).copied().unwrap_or(0.0);
        let v6 = r.mean_score * 100.0;
        let delta = v6 - v5;
        let arrow = if delta > 0.0 { "↑" } else if delta < 0.0 { "↓" } else { "→" };
        println!("  {:12}  v5={:.1}%  v6={:.1}%  {} {:.1}pp  {}",
                 r.task_id, v5, v6, arrow, delta.abs(),
                 if r.solved { "✅ SOLVED" } else { "🔬" });
    }
    let solved = results.iter().filter(|r| r.solved).count();
    println!("\n  Tasks solved: {}/{}", solved, results.len());
    println!("\n✅ Phase 6 complete. The self has been tried.");
    println!("   Fluid, present-tense. Minimum sufficient cause.");

    free_play();
}

// ── SECTION 38: FREE PLAY ─────────────────────────────────────────────────────
// No scoring. No pressure. Just BabyZero wandering through its sandbox,
// noticing what it notices. All candidate selves shown. Curiosity only.

// ── SECTION 32: PERSISTENT GRAMMAR (PHASE 7) ─────────────────────────────────
// The vascular network starts remembering.
// Cross-task grammar that compounds across sessions instead of resetting.
// Violet-purple substrate holding the weight; red veins pulse on cross-task
// recognition; cyan cells with red pupils grow brighter as confidence climbs.

#[derive(Serialize, Deserialize, Debug)]
struct PersistedGrammar {
    version: u32,
    total_sessions: u32,
    entries: Vec<(RelationKey, Vec<BehaviorHypothesis>)>,
}

/// Save RelationalGrammar to JSON. HashMap keys get flattened to a Vec of entries
/// because JSON can't key on structs directly. The grey grate accepts the flattening.
pub fn save_grammar(grammar: &RelationalGrammar, path: &str, total_sessions: u32) -> std::io::Result<()> {
    let entries: Vec<(RelationKey, Vec<BehaviorHypothesis>)> = grammar.iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let persisted = PersistedGrammar { version: 1, total_sessions, entries };
    let json = serde_json::to_string_pretty(&persisted)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(path, json)
}

/// Load RelationalGrammar from JSON. Missing file = empty grammar, 0 sessions.
/// First run will be silent. Second run starts hearing itself.
/// Applies decay to each hypothesis based on sessions_since_last_seen.
pub fn load_grammar(path: &str) -> (RelationalGrammar, u32) {
    const DECAY_RATE: f64 = 0.05;

    let contents = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return (HashMap::new(), 0),
    };
    let persisted: PersistedGrammar = match serde_json::from_str(&contents) {
        Ok(p) => p,
        Err(e) => {
            println!("  ⚠ grammar file unreadable ({}), starting fresh", e);
            return (HashMap::new(), 0);
        }
    };

    let current_session = persisted.total_sessions + 1;
    let mut grammar: RelationalGrammar = persisted.entries.into_iter().collect();

    for hyps in grammar.values_mut() {
        for hyp in hyps.iter_mut() {
            let sessions_gone = current_session.saturating_sub(hyp.last_seen_session);
            let decay_multiplier = (1.0 - DECAY_RATE).powi(sessions_gone as i32);
            hyp.confidence = (hyp.confidence as f64 * decay_multiplier) as f32;
        }
    }

    (grammar, persisted.total_sessions)
}

/// Gentle merge — cross-task compounding.
pub fn merge_into_global(global: &mut RelationalGrammar, task_grammar: &RelationalGrammar, current_session: u32) {
    for (key, task_hyps) in task_grammar {
        let global_hyps = global.entry(key.clone()).or_insert_with(Vec::new);
        for task_h in task_hyps {
            if let Some(existing) = global_hyps.iter_mut().find(|h| h.behavior == task_h.behavior) {
                existing.evidence_count += task_h.evidence_count.max(1);
                existing.confidence = ((existing.confidence + task_h.confidence) / 2.0 + 0.05).min(1.0);
                existing.last_seen_session = current_session;
            } else {
                let mut new_h = task_h.clone();
                new_h.last_seen_session = current_session;
                global_hyps.push(new_h);
            }
        }
    }
}

pub fn free_play() {
    println!("\n{}", "█".repeat(60));
    println!("FREE PLAY — BabyZero wanders the sandbox");
    println!("No scores. No pressure. Just noticing.");
    println!("{}", "█".repeat(60));

    const GRAMMAR_PATH:  &str = "babyzero_grammar.json";
    const UNKNOWNS_PATH: &str = "babyzero_unknowns.json";
    let (mut global_grammar, prior_sessions) = load_grammar(GRAMMAR_PATH);
    let prior_rules: usize = global_grammar.values().map(|v| v.len()).sum();
    if prior_sessions > 0 {
        println!("  🧠 Memory loaded: {} rules from {} prior sessions",
                 prior_rules, prior_sessions);
    } else {
        println!("  🌱 First session — grammar starts empty.");
    }
    let mut unknowns = UnknownAccumulator::load(UNKNOWNS_PATH);

    let arc_dir = std::path::Path::new("arc-data");
    let mut task_files: Vec<String> = std::fs::read_dir(arc_dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
              .filter(|e| e.path().extension().map(|x| x == "json").unwrap_or(false))
              .map(|e| e.path().to_string_lossy().to_string())
              .collect()
        })
        .unwrap_or_default();
    task_files.sort();
    println!("\n  Found {} tasks to explore.\n", task_files.len());

    for path in &task_files {
        let task_id = std::path::Path::new(path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());

        let task = match ArcTask::from_file(path) {
            Ok(t)  => t,
            Err(e) => { println!("  ⚠ {}: {}", task_id, e); continue; }
        };

        println!("┌─ {} ─── {} train pairs, {} test pairs",
                 task_id, task.train.len(), task.test.len());

        let mut grammar: RelationalGrammar = HashMap::new();
        for (i, pair) in task.train.iter().enumerate() {
            seed_relational(&mut grammar, &pair.input, &pair.output, i as u64);
            accumulate_unknowns(&mut unknowns, &task_id, &pair.input, &pair.output, prior_sessions + 1);
        }
        let rule_count: usize = grammar.values().map(|v| v.len()).sum();

        let mut all_behaviors: Vec<(BehaviorType, f32)> = grammar.values()
            .flat_map(|hs| hs.iter())
            .map(|h| (h.behavior, h.confidence))
            .collect();
        all_behaviors.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        all_behaviors.dedup_by_key(|(b, _)| *b);

        print!("│  Grammar: {} rules.  Behaviors: ", rule_count);
        if all_behaviors.is_empty() { print!("none"); }
        else { for (b, conf) in all_behaviors.iter().take(5) { print!("{:?}({:.2})  ", b, conf); } }
        println!();

        if let Some(first) = task.train.first() {
            let objs = observe_grid(&first.input);
            println!("│  Objects in train[0]: {}", objs.len());
            let rows = first.input.len();
            let cols = first.input.first().map(|r| r.len()).unwrap_or(0);

            for (i, obj) in objs.iter().enumerate() {
                let ego = EgocentricMap::from_focal(obj, &objs, rows, cols);
                let (cr, cc) = ego.centroid;
                let role = classify_role(obj, &objs, rows, cols);
                let drive_str = {
                    let agent_role = role;
                    let context_role = objs.iter()
                        .filter(|o| !(o.bbox == obj.bbox && o.value == obj.value))
                        .max_by_key(|o| o.cell_count())
                        .map(|ctx| classify_role(ctx, &objs, rows, cols))
                        .unwrap_or(agent_role);
                    let key = RelationKey { agent_role, context_role, size_class: obj.size_class };
                    grammar.get(&key)
                        .and_then(|hs| hs.iter()
                            .filter(|h| match h.behavior {
                                BehaviorType::Recolor { from, .. } => from == obj.value,
                                _ => true,
                            })
                            .max_by(|a, b|
                                a.confidence.partial_cmp(&b.confidence)
                                           .unwrap_or(std::cmp::Ordering::Equal)
                            )
                        )
                        .map(|h| format!("{:?}@{:.2}", h.behavior, h.confidence))
                        .unwrap_or_else(|| "?".to_string())
                };
                let near_str = ego.nearest
                    .map(|(dr, dc, fam)| format!("→({:+.0},{:+.0}){:?}", dr, dc, fam))
                    .unwrap_or_else(|| "alone".to_string());
                println!("│    [{}] val={} {:?} {}  ({:.1},{:.1}) {}  void={:.1}  near:{}  wants:{}",
                         i, obj.value, obj.size_class, ego.quadrant(),
                         cr, cc, format!("{:?}", role).chars().take(12).collect::<String>(),
                         ego.void_pressure, near_str, drive_str);
            }
            if let Some(winner) = select_focal_object(&grammar, &first.input, Some(&first.output)) {
                println!("│  ▶ SELF → val={} {:?} quad={}  residual={:.3}  drive:{:?}",
                         winner.focal.value, winner.focal.size_class, winner.ego_map.quadrant(),
                         winner.residual,
                         winner.drive.as_ref().map(|d| d.behavior).unwrap_or(BehaviorType::Unknown));
            }
        }

        if let Some(test_pair) = task.test.first() {
            let predicted = predict_ego(&grammar, &test_pair.input);
            let mut changed_cells = 0usize;
            for r in 0..test_pair.input.len() {
                for c in 0..test_pair.input[0].len() {
                    if test_pair.input[r][c] != predicted[r][c] { changed_cells += 1; }
                }
            }
            let total = test_pair.input.len() * test_pair.input[0].len();
            println!("│  Wandered on test[0]: changed {}/{} cells", changed_cells, total);
            let (_, _, score) = score_prediction(&predicted, &test_pair.output);
            let feel = if score >= 0.9      { "✅ feels right" }
                       else if score >= 0.6 { "~ close"            }
                       else if score >= 0.3 { "~ something"        }
                       else                 { "✗ lost"         };
            println!("│  Feeling: {} ({:.0}% match)", feel, score * 100.0);
        }

        let before = global_grammar.values().map(|v| v.len()).sum::<usize>();
        let current_session = prior_sessions + 1;
        merge_into_global(&mut global_grammar, &grammar, current_session);
        let after = global_grammar.values().map(|v| v.len()).sum::<usize>();
        let grew = after.saturating_sub(before);
        if grew > 0 { println!("│  🌿 {} new hypotheses joined the vascular network", grew); }
        println!("└{}", "─".repeat(59));
        println!();
    }

    let total_rules: usize = global_grammar.values().map(|v| v.len()).sum();
    match save_grammar(&global_grammar, GRAMMAR_PATH, prior_sessions + 1) {
        Ok(_)  => println!("█ Grammar saved: {} rules across {} sessions → {}",
                           total_rules, prior_sessions + 1, GRAMMAR_PATH),
        Err(e) => println!("⚠ Grammar save failed: {}", e),
    }
    println!("█ Free play complete. BabyZero has wandered {} tasks.", task_files.len());
    println!("█ The self is fluid. It was different in each room.");

    println!();
    unknowns.print_candidates();
    match unknowns.save(UNKNOWNS_PATH) {
        Ok(_)  => println!("█ Unknown patterns saved → {}", UNKNOWNS_PATH),
        Err(e) => println!("⚠ Unknown save failed: {}", e),
    }
}

// ── SECTION 39: UNKNOWN ACCUMULATOR (PHASE 9) ─────────────────────
// Unknown is not silence — it’s signal waiting to be named.
// When diff_grids encounters a pattern it cannot classify, this accumulator
// records the structural signature. After CANDIDATE_THRESHOLD observations
// of the same signature across sessions and tasks, the pattern becomes a
// named candidate — ready for a new BehaviorType verb.

const CANDIDATE_THRESHOLD: usize = 5;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnknownRecord {
    pub task_id:            String,
    pub agent_value:        u8,
    pub input_cell_count:   usize,
    pub output_cell_count:  usize,   // union of same-value cells in output (confirms Accrete)
    pub session:            u32,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct UnknownAccumulator {
    pub patterns: HashMap<String, Vec<UnknownRecord>>,
}

impl UnknownAccumulator {
    pub fn load(path: &str) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &str) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        // Atomic write: write to .tmp then rename — prevents truncation on Windows mount sync
        let tmp_path = format!("{}.tmp", path);
        std::fs::write(&tmp_path, &json)?;
        std::fs::rename(&tmp_path, path)
    }

    pub fn observe(
        &mut self,
        key:               &RelationKey,
        task_id:           &str,
        agent_value:       u8,
        input_cell_count:  usize,
        output_cell_count: usize,
        session:           u32,
    ) {
        let k = format!("{:?}+{:?}|{:?}", key.agent_role, key.context_role, key.size_class);
        self.patterns.entry(k).or_default().push(UnknownRecord {
            task_id: task_id.to_string(),
            agent_value,
            input_cell_count,
            output_cell_count,
            session,
        });
    }

    pub fn print_candidates(&self) {
        let mut sorted: Vec<(&String, usize)> = self.patterns.iter()
            .map(|(k, recs)| (k, recs.len()))
            .collect();
        sorted.sort_by(|a, b| b.1.cmp(&a.1));

        if sorted.is_empty() {
            println!("  🔮 Unknown accumulator: empty.");
            return;
        }
        println!("  🔮 Unknown pattern library — {} structural signatures:", sorted.len());
        for (key, count) in sorted.iter().take(10) {
            let recs = &self.patterns[*key];
            let tasks: std::collections::HashSet<&str> =
                recs.iter().map(|r| r.task_id.as_str()).collect();
            let marker = if *count >= CANDIDATE_THRESHOLD { "🌱 CANDIDATE" }
                         else                              { "          " };
            println!("     {} [{:>3} obs, {} tasks] {}", marker, count, tasks.len(), key);
        }
    }
}

pub fn accumulate_unknowns(
    accum:   &mut UnknownAccumulator,
    task_id: &str,
    input:   &[Vec<u8>],
    output:  &[Vec<u8>],
    session: u32,
) {
    let rows     = input.len();
    let cols     = input.first().map(|r| r.len()).unwrap_or(0);
    let in_objs  = observe_grid(input);
    let out_objs = observe_grid(output);
    let diff     = diff_grids(input, output);

    for change in &diff.changes {
        if change.behavior != BehaviorType::Unknown { continue; }
        let agent_role   = classify_role(&change.in_obj, &in_objs, rows, cols);
        let context_role = in_objs.iter()
            .filter(|o| o.value != change.in_obj.value)
            .max_by_key(|o| o.cell_count())
            .map(|ctx| classify_role(ctx, &in_objs, rows, cols))
            .unwrap_or(agent_role);
        let key = RelationKey { agent_role, context_role, size_class: change.in_obj.size_class };

        // Count total output cells for the same value (structural witness)
        let output_cell_count: usize = out_objs.iter()
            .filter(|o| o.value == change.in_obj.value)
            .map(|o| o.cell_count())
            .sum();

        accum.observe(&key, task_id, change.in_obj.value,
                      change.in_obj.cell_count(), output_cell_count, session);
    }
}
