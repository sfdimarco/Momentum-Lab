// ═══════════════════════════════════════════════════════════════════════════
//  SPATIAL STATE — Global Singleton + Game Variable Bridge
//  This is the live wire between the MomentumEngine (game logic)
//  and the SynestheticLayer (visual feedback).
//
//  The bridge: after every game tick, call syncFromGameState()
//  The canvas: reads spatialState.view directly every frame
// ═══════════════════════════════════════════════════════════════════════════

import { STRIDE, LOOP_FAMILY, FAMILY_META, getMask } from './spatial-engine';
export { STRIDE, LOOP_FAMILY, FAMILY_META, getMask };
export type { LoopFamilyId } from './spatial-engine';

// Singleton buffer — the entire program's state in one flat array
const MAX_VARS = 32;
export const spatialBuffer = new Float32Array(STRIDE * MAX_VARS);
export const prevValues    = new Float32Array(MAX_VARS);

// Variable registry — name → slot index
const varRegistry = new Map<string, number>();
let varCount = 0;

// Tolerance thresholds (mirrors Rust constants)
const THRESH_X    = 0.20;
const THRESH_Z    = 0.50;
const THRESH_DIAG = 0.80;

function assignLoopFamily(errNorm: number, value: number): number {
  if (!isFinite(value) || isNaN(value)) return LOOP_FAMILY.GATE_EMPTY;
  if (errNorm === 0)         return LOOP_FAMILY.Y_LOOP;
  if (errNorm < THRESH_X)   return LOOP_FAMILY.X_LOOP;
  if (errNorm < THRESH_Z)   return LOOP_FAMILY.Z_LOOP;
  if (errNorm < THRESH_DIAG) return LOOP_FAMILY.DIAG_LOOP;
  return LOOP_FAMILY.GATE_FULL;
}

// Register or retrieve a variable slot
export function getOrRegisterVar(
  name: string,
  initialValue: number,
  min: number,
  max: number,
  posX: number,
  posY: number
): number {
  if (varRegistry.has(name)) return varRegistry.get(name)!;
  if (varCount >= MAX_VARS) return varCount - 1;

  const idx = varCount++;
  varRegistry.set(name, idx);

  const base = idx * STRIDE;
  spatialBuffer[base + 0] = initialValue;
  spatialBuffer[base + 1] = min;
  spatialBuffer[base + 2] = max;
  spatialBuffer[base + 3] = 0;
  spatialBuffer[base + 4] = posX;
  spatialBuffer[base + 5] = posY;
  spatialBuffer[base + 6] = 0;
  spatialBuffer[base + 7] = LOOP_FAMILY.Y_LOOP;
  prevValues[idx] = initialValue;
  return idx;
}

// THE HOT PATH — called every frame for each tracked variable
export function updateVar(
  varIndex: number,
  value: number,
  dt: number,
  min?: number,
  max?: number
): void {
  const base = varIndex * STRIDE;
  const minV = min ?? spatialBuffer[base + 1];
  const maxV = max ?? spatialBuffer[base + 2];

  spatialBuffer[base + 0] = value;
  if (min !== undefined) spatialBuffer[base + 1] = minV;
  if (max !== undefined) spatialBuffer[base + 2] = maxV;

  const prev = prevValues[varIndex];
  spatialBuffer[base + 3] = dt > 0 ? (value - prev) / dt : 0;
  prevValues[varIndex] = value;

  const errRaw = value < minV ? minV - value : value > maxV ? value - maxV : 0;
  const range = maxV - minV;
  const errNorm = range > 0 ? errRaw / range : 0;
  spatialBuffer[base + 6] = errNorm;
  spatialBuffer[base + 7] = assignLoopFamily(errNorm, value);
}

export function setVarPosition(varIndex: number, posX: number, posY: number): void {
  const base = varIndex * STRIDE;
  spatialBuffer[base + 4] = posX;
  spatialBuffer[base + 5] = posY;
}

export function dominantFamily(): number {
  let maxErr = 0; let family: number = LOOP_FAMILY.Y_LOOP;
  for (let i = 0; i < varCount; i++) {
    const base = i * STRIDE;
    const err = spatialBuffer[base + 6];
    if (err > maxErr) { maxErr = err; family = spatialBuffer[base + 7]; }
  }
  return family;
}

export function activeVarCount(): number { return varCount; }

export function resetSpatialState(): void {
  spatialBuffer.fill(0);
  prevValues.fill(0);
  varRegistry.clear();
  varCount = 0;
}

// ── GAME BRIDGE — called from App.tsx after each engine.update() ──────────
// Maps MomentumEngine game state → spatial buffer
export function syncFromGameState(
  sprites: Array<{
    id: string; x: number; y: number; vx: number; vy: number;
    size: number; variables?: Record<string, any>;
  }>,
  physics: { gravity: number; bounce: number; friction: number },
  canvasWidth: number,
  canvasHeight: number,
  dt: number
): void {
  // Track physics globals
  const gravIdx = getOrRegisterVar('gravity', physics.gravity, -200, 200, canvasWidth * 0.15, 20);
  updateVar(gravIdx, physics.gravity, dt, -200, 200);

  const bounceIdx = getOrRegisterVar('bounce', physics.bounce, 0, 1, canvasWidth * 0.5, 20);
  updateVar(bounceIdx, physics.bounce, dt, 0, 1);

  // Track each sprite's position and velocity
  sprites.forEach((sprite, i) => {
    const px = (sprite.x / canvasWidth) * canvasWidth;
    const py = (sprite.y / canvasHeight) * canvasHeight;

    const xIdx = getOrRegisterVar(`${sprite.id}_x`, sprite.x, -canvasWidth, canvasWidth * 2, px, py);
    updateVar(xIdx, sprite.x, dt, -canvasWidth, canvasWidth * 2);
    setVarPosition(xIdx, px, py);

    const vyIdx = getOrRegisterVar(`${sprite.id}_vy`, sprite.vy, -500, 500, px, py);
    updateVar(vyIdx, sprite.vy, dt, -500, 500);

    // User-defined variables from blocks
    if (sprite.variables) {
      Object.entries(sprite.variables).forEach(([key, val]) => {
        if (typeof val !== 'number') return;
        const vIdx = getOrRegisterVar(`${sprite.id}_${key}`, val, -1000, 1000, px, py);
        updateVar(vIdx, val, dt);
      });
    }
  });
}
