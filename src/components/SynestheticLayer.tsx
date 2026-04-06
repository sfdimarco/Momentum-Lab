// ═══════════════════════════════════════════════════════════════════════════
//  SYNESTHETIC LAYER — The Visual Error / State Feedback Overlay
//
//  This is Pillar 2 made real: the bridge between the WASM buffer and the
//  p5.js canvas. Reads the 8-stride Float32Array DIRECTLY every frame.
//  No React state. No props drilling. Pure buffer → pixels.
//
//  What it draws:
//  - GEO quadrant masks pulsing in loop family colors
//  - Variable anchor points with rate-driven pulse rings
//  - Error distance gradient overlaying the canvas
//  - Connection lines between spatially related variables
//  - GATE celebration: fractal explosion when err ≥ 80%
//  - GATE empty: silent void glow when value is undefined
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import {
  spatialBuffer,
  STRIDE,
  LOOP_FAMILY,
  FAMILY_META,
  getMask,
  activeVarCount,
  dominantFamily,
} from '../lib/spatial-state';

interface SynestheticLayerProps {
  width: number;
  height: number;
  visible: boolean;
}

// GEO mask tick — advances independently of React render cycle
let globalMaskTick = 0;

const SynestheticLayer: React.FC<SynestheticLayerProps> = ({ width, height, visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);
  // Ref so the p5 draw() closure always reads the current value — not a stale capture
  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(width, height).parent(containerRef.current!);
        p.frameRate(60);
        p.noSmooth(); // pixel-crisp for quadrant rendering
      };

      p.draw = () => {
        p.clear(); // transparent background — we're an overlay
        if (!visibleRef.current) return;

        const count = activeVarCount();
        if (count === 0) return;

        // Advance GEO mask every 8 frames (~7.5 advances/sec at 60fps)
        // This is the ADVANCE step from the GEO grammar
        if (p.frameCount % 8 === 0) globalMaskTick++;

        const dom = dominantFamily();

        // ── QUADRANT LAYER ─────────────────────────────────────────────
        // Draw the GEO quadrant mask for the dominant loop family.
        // This IS the pattern. The kid sees this and knows the state.
        drawQuadrantMask(p, dom, width, height);

        // ── VARIABLE ANCHORS ───────────────────────────────────────────
        for (let i = 0; i < count; i++) {
          const base = i * STRIDE;
          const value   = spatialBuffer[base + 0];
          const minV    = spatialBuffer[base + 1];
          const maxV    = spatialBuffer[base + 2];
          const rate    = spatialBuffer[base + 3];
          const posX    = spatialBuffer[base + 4];
          const posY    = spatialBuffer[base + 5];
          const errDist = spatialBuffer[base + 6];
          const family  = spatialBuffer[base + 7] | 0;
          const meta    = FAMILY_META[family];

          // Draw error aura — grows with error distance
          if (errDist > 0) {
            const auraSize = 30 + errDist * 120;
            const auraAlpha = Math.min(180, errDist * 200);
            p.noStroke();
            p.fill(meta.r, meta.g, meta.b, auraAlpha * 0.3);
            p.ellipse(posX, posY, auraSize * 2, auraSize * 2);

            // Error rings — multiple for higher error
            if (errDist > 0.2) {
              p.noFill();
              p.stroke(meta.r, meta.g, meta.b, auraAlpha * 0.5);
              p.strokeWeight(1);
              p.ellipse(posX, posY, auraSize * 1.5, auraSize * 1.5);
            }
            if (errDist > 0.5) {
              p.ellipse(posX, posY, auraSize * 0.8, auraSize * 0.8);
            }
          }

          // Pulse ring driven by |rate| — velocity of change
          const pulseT = (p.frameCount * 0.08) % (Math.PI * 2);
          const pulse = 1 + Math.sin(pulseT) * 0.3;
          const ringSize = (18 + Math.min(Math.abs(rate) * 0.3, 30)) * pulse;

          p.noFill();
          p.stroke(meta.r, meta.g, meta.b, 120);
          p.strokeWeight(1.5);
          p.ellipse(posX, posY, ringSize * 2, ringSize * 2);

          // Core dot — solid in family color
          p.noStroke();
          p.fill(meta.r, meta.g, meta.b, 230);
          p.ellipse(posX, posY, 12, 12);

          // Inner bright center
          p.fill(255, 255, 255, 180);
          p.ellipse(posX, posY, 4, 4);
        }

        // ── CONNECTION LINES ───────────────────────────────────────────
        // Connect spatially adjacent variables with colored lines
        // Line brightness = avg error distance between the two
        for (let i = 0; i < count - 1; i++) {
          const bi = i * STRIDE;
          const bj = (i + 1) * STRIDE;
          const xi = spatialBuffer[bi + 4], yi = spatialBuffer[bi + 5];
          const xj = spatialBuffer[bj + 4], yj = spatialBuffer[bj + 5];
          const errI = spatialBuffer[bi + 6];
          const errJ = spatialBuffer[bj + 6];
          const avgErr = (errI + errJ) / 2;

          const dominantVar = errI > errJ ? (spatialBuffer[bi + 7] | 0) : (spatialBuffer[bj + 7] | 0);
          const meta = FAMILY_META[dominantVar];

          p.stroke(meta.r, meta.g, meta.b, 40 + avgErr * 120);
          p.strokeWeight(0.8 + avgErr * 2);
          p.line(xi, yi, xj, yj);
        }
        p.noStroke();

        // ── GATE FULL CELEBRATION ──────────────────────────────────────
        if (dom === LOOP_FAMILY.GATE_FULL) {
          drawGateCelebration(p, width, height);
        }

        // ── GATE EMPTY — void glow ─────────────────────────────────────
        if (dom === LOOP_FAMILY.GATE_EMPTY) {
          drawVoidGlow(p, width, height);
        }
      };
    };

    p5Ref.current = new p5(sketch);
    return () => { p5Ref.current?.remove(); };
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width, height,
        pointerEvents: 'none', // Let clicks through to the game canvas
        zIndex: 10,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    />
  );
};

// ── Quadrant mask renderer ─────────────────────────────────────────────────
// This is the GEO grammar made visual.
// Each loop family has a mask cycle. The active quadrants glow.
function drawQuadrantMask(p: p5, family: number, W: number, H: number): void {
  const mask = getMask(family, globalMaskTick);
  const meta = FAMILY_META[family];
  const Q_W  = W / 2;
  const Q_H  = H / 2;

  // TL=bit3, TR=bit2, BR=bit1, BL=bit0
  const quads = [
    { bit: 3, x: 0,   y: 0   },
    { bit: 2, x: Q_W, y: 0   },
    { bit: 1, x: Q_W, y: Q_H },
    { bit: 0, x: 0,   y: Q_H },
  ];

  // Base glow alpha — subtler for healthy states, stronger for error states
  const baseAlpha = family === LOOP_FAMILY.Y_LOOP ? 18 : 
                    family === LOOP_FAMILY.GATE_FULL ? 60 : 30;

  for (const q of quads) {
    if (!((mask >> q.bit) & 1)) continue;
    p.noStroke();
    p.fill(meta.r, meta.g, meta.b, baseAlpha);
    p.rect(q.x, q.y, Q_W, Q_H);

    // Corner accent — subtle geometric marker
    p.fill(meta.r, meta.g, meta.b, baseAlpha * 1.5);
    const accentSize = 40;
    const cx = q.bit === 3 || q.bit === 0 ? q.x : q.x + Q_W;
    const cy = q.bit === 3 || q.bit === 2 ? q.y : q.y + Q_H;
    p.ellipse(cx, cy, accentSize, accentSize);
  }

  // Quadrant divider lines — always visible, pulse with family color
  const lineAlpha = 20 + (family !== LOOP_FAMILY.Y_LOOP ? 20 : 0);
  p.stroke(meta.r, meta.g, meta.b, lineAlpha);
  p.strokeWeight(1);
  p.line(W / 2, 0, W / 2, H);
  p.line(0, H / 2, W, H / 2);
  p.noStroke();
}

// ── GATE FULL: Fractal celebration overlay ─────────────────────────────────
function drawGateCelebration(p: p5, W: number, H: number): void {
  const t = p.frameCount * 0.04;
  const meta = FAMILY_META[LOOP_FAMILY.GATE_FULL];

  // Recursive grid pattern — the GEO quadtree made visible
  for (let level = 1; level <= 3; level++) {
    const cells = Math.pow(2, level);
    const cW = W / cells;
    const cH = H / cells;

    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const n = Math.sin(gx * 0.7 + t) * Math.cos(gy * 0.7 - t * 1.3);
        if (n > 0.4) {
          const alpha = (n - 0.4) * 60 / level;
          p.fill(meta.r, meta.g, meta.b, alpha);
          p.noStroke();
          p.rect(gx * cW, gy * cH, cW, cH);
        }
      }
    }
  }

  // "EXPLORE MODE" text — flashes in
  const flash = Math.sin(p.frameCount * 0.15);
  if (flash > 0.5) {
    const alpha = (flash - 0.5) * 2 * 255;
    p.fill(255, 255, 255, alpha * 0.9);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(28);
    p.textStyle(p.BOLD);
    p.text('EXPLORE MODE 🎉', W / 2, H / 2);
    p.textSize(14);
    p.fill(meta.r, meta.g, meta.b, alpha * 0.7);
    p.text("you found the edge", W / 2, H / 2 + 36);
  }
}

// ── GATE EMPTY: Void glow ─────────────────────────────────────────────────
function drawVoidGlow(p: p5, W: number, H: number): void {
  const pulse = Math.sin(p.frameCount * 0.05) * 0.5 + 0.5;
  p.fill(80, 80, 160, 15 + pulse * 20);
  p.noStroke();
  p.rect(0, 0, W, H);

  // Center shimmer — something's missing
  p.fill(120, 120, 255, 40 + pulse * 30);
  p.ellipse(W / 2, H / 2, 80 + pulse * 20, 80 + pulse * 20);
}

export default SynestheticLayer;
