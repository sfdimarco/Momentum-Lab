// ═══════════════════════════════════════════════════════════════════════════
//  GEOPlayground — The Living Quadtree Canvas
//
//  This IS the pattern recognition system. Boxes in boxes.
//  The cube is the foundation. The recursive grid IS the cognition.
//
//  🌈 RainbowBrain law: Color is data, not decoration.
//    Each quadrant direction has a fixed synesthetic color (Mook's system):
//      TL = RED   (1)   — the original, the anchor
//      TR = BLUE  (2)   — the opposite, the branch
//      BL = YELLOW(3)   — the ground, the warmth
//      BR = GREEN (4)   — the growth, the go
//      ROOT = CYAN       — unexplored void
//
//  🕯️ Anima law: Everything alive breathes. Nothing mechanical.
//    - Cells slow-in/slow-out their confidence alpha
//    - Focus ring has anticipation (brightens before moving)
//    - Pattern promotions have weight — bloom then settle
//    - Library entries pulse like a held breath
//
//  Baby0 + Baby1 paint INTO this canvas.
//  Human draws INTO this canvas.
//  Together they build the GEO library.
//  The library becomes executable code.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import type { BabyAgent } from '../geoai/baby_agent';
import type { LibraryEntry, GEOFamily } from '../geoai/parser';
import type { CyanPromotionEvent, GuideTarget } from './SpatialEye';

// ── Synesthetic Color System ─────────────────────────────────────────────
// TL=red, TR=blue, BL=yellow, BR=green — Mook's permanent number→color map
const QUAD_RGB: Record<string, [number, number, number]> = {
  TL: [220, 38,  38],   // red    — 1
  TR: [37,  99,  235],  // blue   — 2
  BL: [234, 179, 8],    // yellow — 3
  BR: [34,  197, 94],   // green  — 4
};

// GEO family → synesthetic color (from LibraryPanel / RainbowBrain)
const FAMILY_RGB: Record<GEOFamily, [number, number, number]> = {
  Y_LOOP:    [234, 179, 8],    // gold   — linear flow
  X_LOOP:    [59,  130, 246],  // blue   — branching
  Z_LOOP:    [34,  197, 94],   // green  — looping
  DIAG_LOOP: [168, 85,  247],  // purple — recursion
  GATE_ON:   [6,   182, 212],  // cyan   — full function
  GATE_OFF:  [55,  65,  81],   // dark   — null state
};

interface GEOPlaygroundProps {
  width: number;
  height: number;
  agent: BabyAgent;
  agent2?: BabyAgent;
  // Brain snapshot for rendering — passed from App.tsx
  brain: {
    visualResolution: number;
    currentFocus: { depth: number; path: string[] } | null;
    frustration: number;
    energy: number;
    patternCache: Array<{ geoAddress: { depth: number; path: string[] }; confidence: number }>;
    libraryCache: Array<{ address: string[]; depth: number; loopFamily: string; codeHint: string | null; confidence: number }>;
  };
  brain2?: {
    visualResolution: number;
    currentFocus: { depth: number; path: string[] } | null;
    frustration: number;
    energy: number;
    patternCache: Array<{ geoAddress: { depth: number; path: string[] }; confidence: number }>;
    libraryCache: Array<{ address: string[]; depth: number; loopFamily: string; codeHint: string | null; confidence: number }>;
  };
  lastCyanPromotion?: CyanPromotionEvent | null;
  guideTarget?: GuideTarget | null;
  /** Called with the p5 canvas element once mounted — agents use it for shadow canvas */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

// ── Helper: quadrant path → pixel rect ──────────────────────────────────
function pathToRect(path: string[], W: number, H: number) {
  let x = 0, y = 0, w = W, h = H;
  for (const dir of path) {
    const hw = w / 2, hh = h / 2;
    if (dir === 'TR' || dir === '1') x += hw;
    else if (dir === 'BR' || dir === '2') { x += hw; y += hh; }
    else if (dir === 'BL' || dir === '3') y += hh;
    w = hw; h = hh;
  }
  return { x, y, w, h };
}

// ── Helper: get all paths at a given depth ───────────────────────────────
function allPathsAtDepth(depth: number): string[][] {
  if (depth < 1) return [[]];
  const dirs = ['TL', 'TR', 'BL', 'BR'];
  const paths: string[][] = [];
  const gen = (cur: string[]) => {
    if (cur.length === depth) { paths.push([...cur]); return; }
    for (const d of dirs) gen([...cur, d]);
  };
  gen([]);
  return paths;
}

// ── Helper: dominant direction of a path (for color) ─────────────────────
function dominantDir(path: string[]): string {
  if (path.length === 0) return 'TL';
  const last = path[path.length - 1];
  return last;
}

// ── TrailPoint: human stroke traces ──────────────────────────────────────
interface TrailPoint {
  x: number; y: number;
  r: number; g: number; b: number;
  born: number;
  life: number; // ms
}

// ── BloomEvent: when a pattern is promoted ────────────────────────────────
interface BloomEvent {
  cx: number; cy: number;
  r: number; g: number; b: number;
  born: number;
  duration: number;
}

const GEOPlayground: React.FC<GEOPlaygroundProps> = ({
  width,
  height,
  agent,
  agent2,
  brain,
  brain2,
  lastCyanPromotion,
  guideTarget,
  onCanvasReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Props refs — avoids stale closures in p5 loop
  const brainRef      = useRef(brain);
  const brain2Ref     = useRef(brain2);
  const guideRef      = useRef(guideTarget ?? null);
  const cyanRef       = useRef(lastCyanPromotion ?? null);
  const cyanTimeRef   = useRef<number | null>(null);

  const trailRef      = useRef<TrailPoint[]>([]);
  const bloomsRef     = useRef<BloomEvent[]>([]);

  useEffect(() => { brainRef.current = brain; }, [brain]);
  useEffect(() => { brain2Ref.current = brain2; }, [brain2]);
  useEffect(() => { guideRef.current = guideTarget ?? null; }, [guideTarget]);
  useEffect(() => {
    if (lastCyanPromotion && lastCyanPromotion !== cyanRef.current) {
      cyanRef.current = lastCyanPromotion;
      cyanTimeRef.current = Date.now();
      // Add a bloom at the promoted quadrant
      const rect = pathToRect(lastCyanPromotion.path, width, height);
      bloomsRef.current.push({
        cx: rect.x + rect.w / 2,
        cy: rect.y + rect.h / 2,
        r: 0, g: 255, b: 255,
        born: Date.now(),
        duration: 2800,
      });
    }
  }, [lastCyanPromotion, width, height]);

  // ── p5 Sketch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    let p5inst: p5;
    const startTime = Date.now();

    const sketch = (p: p5) => {
      let canvas: HTMLCanvasElement;

      p.setup = () => {
        const renderer = p.createCanvas(width, height);
        canvas = renderer.elt as HTMLCanvasElement;
        p.noSmooth();
        p.frameRate(60);
        if (onCanvasReady) onCanvasReady(canvas);
      };

      p.draw = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const cur = brainRef.current;
        const cur2 = brain2Ref.current;
        // p5 drawingContext is typed as a union — alias to 2D context for glow/dash APIs
        const ctx2d = p.drawingContext as CanvasRenderingContext2D;

        // ── 0. Black base ──────────────────────────────────────────────
        p.background(6, 8, 12); // near-black, not pure black — has depth

        // ── 1. RECURSIVE QUADTREE GRID — boxes in boxes ───────────────
        // Each cell IS a pattern address. Color = direction. Alpha = life.
        // 🌈 Color is data. 🕯️ Everything breathes.
        const res = cur.visualResolution;
        const paths = allPathsAtDepth(res);

        for (const path of paths) {
          const rect = pathToRect(path, width, height);
          const dir = dominantDir(path);
          const [r, g, b] = QUAD_RGB[dir] ?? [100, 100, 100];

          // Find pattern at this address (from baby_0)
          const pat = cur.patternCache.find(
            p0 => p0.geoAddress.depth === res &&
            JSON.stringify(p0.geoAddress.path) === JSON.stringify(path)
          );
          // Also check baby_1
          const pat2 = cur2?.patternCache.find(
            p1 => p1.geoAddress.depth === (cur2?.visualResolution ?? res) &&
            JSON.stringify(p1.geoAddress.path) === JSON.stringify(path)
          );

          const conf = Math.max(pat?.confidence ?? 0, pat2?.confidence ?? 0);

          // 🕯️ Anima: slow-in/slow-out — confidence breathes the fill alpha
          // Base pulse: all cells softly alive even when unvisited
          const breathe = 0.04 + 0.02 * Math.sin(elapsed * 0.0007 + path.length * 0.3);
          const confAlpha = conf > 0 ? breathe + conf * 0.22 : breathe;

          // Fill: synesthetic direction color, alpha driven by confidence
          p.noStroke();
          p.fill(r, g, b, confAlpha * 255);
          p.rect(rect.x, rect.y, rect.w, rect.h);

          // Stroke: brighter line at quadrant border
          const strokeAlpha = 0.08 + conf * 0.18;
          p.stroke(r, g, b, strokeAlpha * 255);
          p.strokeWeight(0.5);
          p.noFill();
          p.rect(rect.x, rect.y, rect.w, rect.h);
        }

        // ── 2. LIBRARY BOOKMARKS — permanent glowing borders ─────────
        // 🌈 Library entries leave synesthetic family-color marks
        const allLib = [
          ...cur.libraryCache,
          ...(cur2?.libraryCache ?? []),
        ];
        for (const entry of allLib) {
          if (entry.depth !== res) continue;
          const fam = entry.loopFamily as GEOFamily;
          const [lr, lg, lb] = FAMILY_RGB[fam] ?? [0, 255, 255];
          const rect = pathToRect(entry.address, width, height);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;

          // 🕯️ Anima: library entry pulses like a held breath
          const libPulse = 0.5 + 0.3 * Math.sin(elapsed * 0.0012 + entry.address.length);
          const libConf = Math.min(1, entry.confidence);

          // Glowing fill
          p.noStroke();
          p.fill(lr, lg, lb, libPulse * libConf * 38);
          p.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);

          // Glowing border
          ctx2d.shadowColor = `rgb(${lr},${lg},${lb})`;
          ctx2d.shadowBlur = 8;
          p.stroke(lr, lg, lb, libPulse * 180);
          p.strokeWeight(1.5);
          p.noFill();
          p.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
          ctx2d.shadowBlur = 0;

          // Diamond center mark (the Librarian's signature)
          p.fill(lr, lg, lb, libPulse * 200);
          p.noStroke();
          p.push();
          p.translate(cx, cy);
          p.rotate(Math.PI / 4);
          p.rect(-3, -3, 6, 6);
          p.pop();
        }

        // ── 3. PATTERN CACHE DOTS — baby's learned regions ────────────
        for (const pat of cur.patternCache) {
          if (pat.geoAddress.depth !== res) continue;
          const conf = pat.confidence;
          if (conf < 0.1) continue;
          const rect = pathToRect(pat.geoAddress.path, width, height);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;

          // Color by confidence tier
          let [pr, pg, pb] = [234, 179, 8]; // orange (emerging)
          if (conf > 0.7) [pr, pg, pb] = [236, 72, 153]; // pink (stable)

          // 🕯️ Anima: dot radius breathes with confidence
          const dotPulse = 0.8 + 0.2 * Math.sin(elapsed * 0.002 + conf * 5);
          const dotR = 2 + conf * 4;

          ctx2d.shadowColor = `rgb(${pr},${pg},${pb})`;
          ctx2d.shadowBlur = conf > 0.7 ? 10 : 5;
          p.noStroke();
          p.fill(pr, pg, pb, dotPulse * 220);
          p.circle(cx, cy, dotR * 2);
          ctx2d.shadowBlur = 0;
        }

        // ── 4. CURRENT FOCUS RING — baby's attention ──────────────────
        // 🕯️ Anima: the focus has ANTICIPATION and SLOW-IN/OUT
        if (cur.currentFocus) {
          const rect = pathToRect(cur.currentFocus.path, width, height);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;

          // Pulsing white ring — slow breath
          const focusPulse = 0.6 + 0.4 * Math.sin(elapsed * 0.004);
          ctx2d.shadowColor = 'white';
          ctx2d.shadowBlur = 12;
          p.stroke(255, 255, 255, focusPulse * 200);
          p.strokeWeight(1.5);
          p.noFill();
          p.circle(cx, cy, 18 + Math.sin(elapsed * 0.004) * 5);
          ctx2d.shadowBlur = 0;
        }

        // baby_1 focus (if active) — tinted slightly different
        if (cur2?.currentFocus) {
          const rect = pathToRect(cur2.currentFocus.path, width, height);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;
          const focusPulse = 0.5 + 0.4 * Math.sin(elapsed * 0.005 + 1.2);
          p.stroke(180, 180, 255, focusPulse * 160);
          p.strokeWeight(1);
          p.noFill();
          p.circle(cx, cy, 14 + Math.sin(elapsed * 0.005 + 1.2) * 4);
        }

        // ── 5. CYAN PROMOTION BLOOM ────────────────────────────────────
        // 🕯️ Anima: bloom has WEIGHT — expands then settles with follow-through
        if (cyanRef.current && cyanTimeRef.current !== null) {
          const age = now - cyanTimeRef.current;
          const dur = 3200;
          if (age < dur) {
            const t = age / dur;
            const alpha = Math.pow(1 - t, 1.3);
            const rect = pathToRect(cyanRef.current.path, width, height);
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;

            // Canvas dim (first 600ms)
            if (age < 600) {
              const dim = (1 - age / 600) * 0.4;
              p.noStroke();
              p.fill(0, 0, 0, dim * 255);
              p.rect(0, 0, width, height);
            }

            // Expanding ring
            ctx2d.shadowColor = '#00ffff';
            ctx2d.shadowBlur = 20;
            p.stroke(0, 255, 255, alpha * 230);
            p.strokeWeight(2.5);
            p.noFill();
            p.circle(cx, cy, (10 + t * 120));
            // Inner ring
            p.stroke(0, 255, 255, alpha * 120);
            p.strokeWeight(1);
            p.circle(cx, cy, (10 + t * 60));
            ctx2d.shadowBlur = 0;

            // Quadrant fill
            p.noStroke();
            p.fill(0, 255, 255, alpha * 30);
            p.rect(rect.x, rect.y, rect.w, rect.h);
          }
        }

        // ── 6. BLOOM EVENTS (pattern promotion) ───────────────────────
        // 🕯️ Anima: FOLLOW THROUGH — bloom expands then leaves a trace
        bloomsRef.current = bloomsRef.current.filter(ev => (now - ev.born) < ev.duration);
        for (const bloom of bloomsRef.current) {
          const t = (now - bloom.born) / bloom.duration;
          const alpha = Math.pow(1 - t, 1.5);
          const R = 8 + t * 80;
          ctx2d.shadowColor = `rgb(${bloom.r},${bloom.g},${bloom.b})`;
          ctx2d.shadowBlur = 15;
          p.stroke(bloom.r, bloom.g, bloom.b, alpha * 200);
          p.strokeWeight(2);
          p.noFill();
          p.circle(bloom.cx, bloom.cy, R * 2);
          ctx2d.shadowBlur = 0;
        }

        // ── 7. HUMAN STROKE TRAIL ─────────────────────────────────────
        // 🌈 Human marks persist briefly — synesthetic trace of the gesture
        const TRAIL_LIFE = 3500; // ms
        trailRef.current = trailRef.current.filter(pt => (now - pt.born) < pt.life);
        for (const pt of trailRef.current) {
          const age = now - pt.born;
          const alpha = Math.pow(1 - age / pt.life, 1.5);
          ctx2d.shadowColor = `rgb(${pt.r},${pt.g},${pt.b})`;
          ctx2d.shadowBlur = 8;
          p.noStroke();
          p.fill(pt.r, pt.g, pt.b, alpha * 200);
          p.circle(pt.x, pt.y, 8);
          ctx2d.shadowBlur = 0;
        }

        // ── 8. GUIDE MODE — Librarian draws a path ────────────────────
        // 🕯️ Anima: the guide line breathes — it's a living invitation, not a command
        if (guideRef.current) {
          const guide = guideRef.current;
          const fromRect = pathToRect(guide.fromPath, width, height);
          const toRect   = pathToRect(guide.toPath,   width, height);
          const fromCx = fromRect.x + fromRect.w / 2;
          const fromCy = fromRect.y + fromRect.h / 2;
          const toCx   = toRect.x   + toRect.w   / 2;
          const toCy   = toRect.y   + toRect.h   / 2;

          // Dim the canvas — the Librarian clears the stage
          p.noStroke();
          p.fill(0, 0, 0, 65);
          p.rect(0, 0, width, height);

          // Animated dashed guide line — marching toward destination
          const dashOffset = (elapsed * 0.06) % 12;
          ctx2d.shadowColor = '#00ffff';
          ctx2d.shadowBlur = 12;
          ctx2d.setLineDash([7, 5]);
          ctx2d.lineDashOffset = -dashOffset;
          const lineAlpha = 0.6 + 0.3 * Math.sin(elapsed * 0.003);
          p.stroke(0, 255, 255, lineAlpha * 255);
          p.strokeWeight(1.5);
          p.line(fromCx, fromCy, toCx, toCy);
          ctx2d.setLineDash([]);
          ctx2d.lineDashOffset = 0;
          ctx2d.shadowBlur = 0;

          // Origin ring — "you are here"
          const originPulse = 0.6 + 0.35 * Math.sin(elapsed * 0.005);
          p.stroke(255, 255, 255, originPulse * 220);
          p.strokeWeight(1.5);
          p.noFill();
          p.circle(fromCx, fromCy, 18);

          // Destination bloom — two expanding rings, phase offset
          const t1 = (elapsed * 0.0015) % 1;
          const t2 = ((elapsed * 0.0015) + 0.45) % 1;
          ctx2d.shadowColor = '#00ffff';
          ctx2d.shadowBlur = 14;
          p.stroke(0, 255, 255, (1 - t1) * 180);
          p.strokeWeight(2);
          p.circle(toCx, toCy, 16 + t1 * 38);
          p.stroke(0, 255, 255, (1 - t2) * 100);
          p.strokeWeight(1);
          p.circle(toCx, toCy, 16 + t2 * 38);
          ctx2d.shadowBlur = 0;

          // Destination center dot — the beacon
          ctx2d.shadowColor = '#00ffff';
          ctx2d.shadowBlur = 20;
          p.noStroke();
          p.fill(0, 255, 255, 240);
          p.circle(toCx, toCy, 8);
          ctx2d.shadowBlur = 0;

          // Destination quadrant glow
          p.noStroke();
          p.fill(0, 255, 255, 28);
          p.rect(toRect.x, toRect.y, toRect.w, toRect.h);
        }

        // ── 9. HUD — energy + frustration (minimal, always informative) ─
        const hudX = 10;
        const hudY = height - 22;
        const energyW = 60;
        p.noStroke();
        p.fill(255, 255, 255, 30);
        p.rect(hudX, hudY, energyW, 3, 2);
        const eCol: [number, number, number] = cur.energy > 0.5
          ? [34, 197, 94] : cur.energy > 0.25
          ? [234, 179, 8] : [220, 38, 38];
        p.fill(...eCol, 200);
        p.rect(hudX, hudY, energyW * cur.energy, 3, 2);

        // Frustration dots (small, right of energy bar)
        const dots = Math.min(Math.ceil(cur.frustration / 3), 5);
        for (let i = 0; i < dots; i++) {
          p.fill(220, 38, 38, 140);
          p.circle(hudX + energyW + 8 + i * 6, hudY + 1.5, 4);
        }
      };

      // ── Touch/Mouse event forwarding for shadow canvas feeding ────────
      // DrawCanvas handles the human draw input; we expose the canvas element
      // via onCanvasReady so App.tsx can point agents at it.
    };

    p5inst = new p5(sketch, mountRef.current);

    return () => {
      p5inst.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // ── Public method: add a human trail point ─────────────────────────────
  // Called by DrawCanvas (via parent) when the user strokes the canvas.
  // Returns a function App.tsx can store and call.
  const addTrailPoint = (
    x: number, y: number,
    r: number, g: number, b: number
  ) => {
    trailRef.current.push({ x, y, r, g, b, born: Date.now(), life: 3500 });
  };

  // ── Public method: add a bloom event ──────────────────────────────────
  const addBloom = (
    cx: number, cy: number,
    r: number, g: number, b: number,
    duration = 2000
  ) => {
    bloomsRef.current.push({ cx, cy, r, g, b, born: Date.now(), duration });
  };

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width,
        height,
        display: 'block',
        overflow: 'hidden',
        borderRadius: 4,
        background: '#06080c',
      }}
    />
  );
};

export default GEOPlayground;
export type { GEOPlaygroundProps };
