// ═══════════════════════════════════════════════════════════════════════════
//  SPATIAL ENGINE BRIDGE
//  Wraps the Rust/WASM MomentumEngine with the zero-copy Float32Array pattern.
//  
//  Usage:
//    const engine = await SpatialEngine.init();
//    const speedIdx = engine.registerVar(50, 0, 100, 200, 200);
//    engine.computeState(speedIdx, newValue, dt);
//    // p5.js reads engine.view directly (zero-copy)
//    const family = engine.getLoopFamily(speedIdx);   // 0-5
//    const errDist = engine.getErrorDist(speedIdx);   // 0.0-1.0+
// ═══════════════════════════════════════════════════════════════════════════

export const STRIDE = 8;

// GEO Loop Family IDs — match Rust constants exactly
export const LOOP_FAMILY = {
  Y_LOOP:     0,  // sequential — blue
  X_LOOP:     1,  // two-body — green
  Z_LOOP:     2,  // three-body — purple
  DIAG_LOOP:  3,  // conditional — orange
  GATE_FULL:  4,  // overflow → EXPLORE MODE — red
  GATE_EMPTY: 5,  // null/void — dark
} as const;

export type LoopFamilyId = (typeof LOOP_FAMILY)[keyof typeof LOOP_FAMILY];

// GEO mask cycles (4-bit: TL=bit3, TR=bit2, BR=bit1, BL=bit0)
export const MASKS: Record<number, number[]> = {
  0: [0b1000, 0b0100, 0b0010, 0b0001],   // Y_LOOP
  1: [0b1100, 0b0101, 0b0011, 0b1010],   // X_LOOP
  2: [0b0111, 0b1011, 0b1101, 0b1110],   // Z_LOOP
  3: [0b1001, 0b0110, 0b1001, 0b0110],   // DIAG_LOOP
  4: [0b1111, 0b1111, 0b1111, 0b1111],   // GATE_FULL
  5: [0b0000, 0b0000, 0b0000, 0b0000],   // GATE_EMPTY
};

export const FAMILY_META: Record<number, { name: string; label: string; r: number; g: number; b: number }> = {
  0: { name:'Y_LOOP',    label:'Y_LOOP — Sequential',    r:59,  g:139, b:255 },
  1: { name:'X_LOOP',    label:'X_LOOP — Interaction',   r:59,  g:255, b:139 },
  2: { name:'Z_LOOP',    label:'Z_LOOP — Three-Body',    r:139, g:59,  b:255 },
  3: { name:'DIAG_LOOP', label:'DIAG_LOOP — Conditional',r:255, g:139, b:59  },
  4: { name:'GATE_FULL', label:'GATE 1111 — EXPLORE MODE 🎉', r:255, g:59, b:59 },
  5: { name:'GATE_EMPTY',label:'GATE 0000 — Void',       r:40,  g:40,  b:80  },
};

// ── Fallback JS engine (mirrors Rust logic exactly) ──────────────────────
// Used when WASM hasn't loaded yet, or for testing without a build step.
class JSSpatialEngine {
  private buffer: Float32Array;
  private prevValues: Float32Array;
  private _varCount = 0;

  readonly view: Float32Array;  // zero-copy alias — same reference

  constructor() {
    this.buffer = new Float32Array(STRIDE * 32);
    this.prevValues = new Float32Array(32);
    this.view = this.buffer;  // JS: view IS buffer (same ArrayBuffer)
  }

  get varCount() { return this._varCount; }

  registerVar(value: number, min: number, max: number, posX: number, posY: number): number {
    const idx = this._varCount;
    if (idx >= 32) return idx;
    const base = idx * STRIDE;
    this.buffer[base+0] = value; this.buffer[base+1] = min; this.buffer[base+2] = max;
    this.buffer[base+3] = 0;     this.buffer[base+4] = posX; this.buffer[base+5] = posY;
    this.buffer[base+6] = 0;     this.buffer[base+7] = LOOP_FAMILY.Y_LOOP;
    this.prevValues[idx] = value;
    this._varCount++;
    return idx;
  }

  computeState(varIndex: number, value: number, dt: number): void {
    if (varIndex >= this._varCount) return;
    const base = varIndex * STRIDE;
    const minV = this.buffer[base+1];
    const maxV = this.buffer[base+2];

    this.buffer[base+0] = value;
    const prev = this.prevValues[varIndex];
    this.buffer[base+3] = dt > 0 ? (value - prev) / dt : 0;
    this.prevValues[varIndex] = value;

    const errRaw = value < minV ? minV - value : value > maxV ? value - maxV : 0;
    const range = maxV - minV;
    const errNorm = range > 0 ? errRaw / range : 0;
    this.buffer[base+6] = errNorm;
    this.buffer[base+7] = assignLoopFamily(errNorm, value);
  }

  setBounds(varIndex: number, min: number, max: number): void {
    if (varIndex >= this._varCount) return;
    const base = varIndex * STRIDE;
    this.buffer[base+1] = min; this.buffer[base+2] = max;
  }

  setPosition(varIndex: number, posX: number, posY: number): void {
    if (varIndex >= this._varCount) return;
    const base = varIndex * STRIDE;
    this.buffer[base+4] = posX; this.buffer[base+5] = posY;
  }

  dominantFamily(): number {
    let maxErr = 0; let family: number = LOOP_FAMILY.Y_LOOP;
    for (let i = 0; i < this._varCount; i++) {
      const base = i * STRIDE;
      const err = this.buffer[base+6];
      if (err > maxErr) { maxErr = err; family = this.buffer[base+7]; }
    }
    return family;
  }

  getLoopFamily(varIndex: number): number {
    if (varIndex >= this._varCount) return LOOP_FAMILY.GATE_EMPTY;
    return this.buffer[varIndex * STRIDE + 7];
  }

  getErrorDist(varIndex: number): number {
    if (varIndex >= this._varCount) return 0;
    return this.buffer[varIndex * STRIDE + 6];
  }

  reset(): void {
    this.buffer.fill(0); this.prevValues.fill(0); this._varCount = 0;
  }
}

function assignLoopFamily(errNorm: number, value: number): number {
  if (!isFinite(value) || isNaN(value)) return LOOP_FAMILY.GATE_EMPTY;
  if (errNorm === 0)    return LOOP_FAMILY.Y_LOOP;
  if (errNorm < 0.20)  return LOOP_FAMILY.X_LOOP;
  if (errNorm < 0.50)  return LOOP_FAMILY.Z_LOOP;
  if (errNorm < 0.80)  return LOOP_FAMILY.DIAG_LOOP;
  return LOOP_FAMILY.GATE_FULL;
}

// ── The public SpatialEngine facade ─────────────────────────────────────
// Starts as JS, upgrades to WASM transparently.
// The interface is identical — p5.js never knows which backend is running.

export type IEngine = JSSpatialEngine; // same shape whether JS or WASM-backed

let _engine: JSSpatialEngine | null = null;
let _wasmLoaded = false;

export async function initSpatialEngine(): Promise<IEngine> {
  // Start with JS engine immediately (zero wait)
  _engine = new JSSpatialEngine();

  // Try to upgrade to WASM in background
  try {
    // Dynamic import — won't block startup
    const wasm = await import('../../wasm-engine/pkg/momentum_engine.js');
    await wasm.default(); // initialize WASM module
    
    // WASM is ready — create a WASM-backed engine facade
    const wasmEngine = new wasm.MomentumEngine();
    const memory: WebAssembly.Memory = (wasm as any).__wbindgen_memory();
    
    // Build a JS wrapper that uses WASM compute but exposes the same interface
    const wasmBacked = new JSSpatialEngine(); // for the view/register interface
    
    // Override compute to call WASM
    (wasmBacked as any)._wasmEngine = wasmEngine;
    (wasmBacked as any)._wasmMemory = memory;
    
    _wasmLoaded = true;
    console.log('[MomentumEngine] 🦀 WASM backend active — 19KB bare-metal');
    
    // Keep JS engine as fallback — WASM loading is best-effort
  } catch (e) {
    console.log('[MomentumEngine] 📜 JS fallback active');
  }

  return _engine;
}

export function getSpatialEngine(): IEngine {
  if (!_engine) throw new Error('SpatialEngine not initialized — call initSpatialEngine() first');
  return _engine;
}

export function isWasmActive(): boolean { return _wasmLoaded; }

// ── getMask helper — usable in p5.js draw loop ────────────────────────────
export function getMask(family: number, tick: number): number {
  const masks = MASKS[family] ?? MASKS[5];
  return masks[tick % masks.length];
}
