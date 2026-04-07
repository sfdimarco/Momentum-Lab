/**
 * DrawCanvas.tsx — The Shared Tactile Workspace
 *
 * A p5.js overlay that turns the canvas into a collaborative drawing surface.
 * The student draws → baby reads → library grows → code appears.
 *
 * Three layers happening simultaneously:
 *
 *  LAYER 1 — STUDENT STROKES
 *    Brush color = quadrant color (TL=red, TR=blue, BL=yellow, BR=green)
 *    Strokes are semi-transparent, fade over 3 seconds
 *    Every pixel painted is also injected into baby's shadow canvas (HIGH DELTA FOOD)
 *
 *  LAYER 2 — GEO GRID OVERLAY
 *    Shows the quadtree grid at baby's current resolution
 *    Each quadrant subtly color-coded so student can feel the geometry
 *    Updates live as baby gains visual resolution
 *
 *  LAYER 3 — BABY DRAW-BACK (AI RESPONSE)
 *    When baby detects a high-reward pattern or promotes to library,
 *    it draws a glowing bloom at its current focus quadrant
 *    Color = the GEO family's synesthetic color
 *    This is the AI "speaking back" in the same visual language
 *
 * Pillars served: ALL THREE
 *  P1 — bare-metal: strokes directly modify shadow canvas pixels
 *  P2 — synesthetic: color IS data, gesture IS code
 *  P3 — pedagogical: zero friction, draw to learn
 */

import React, { useEffect, useRef, useCallback } from 'react';
import p5 from 'p5';
import type { BabyAgent } from '../geoai/baby_agent';
import {
  pixelToQuadrant,
  buildGEOPathFromPoints,
  interpretStroke,
  QUADRANT_COLORS,
  FAMILY_COLORS,
  type StrokeResult,
} from '../geoai/stroke-interpreter';
import type { LibraryEntry } from '../geoai/parser';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DrawCanvasProps {
  width: number;
  height: number;
  /** Is draw mode active? When false, canvas is pointer-events: none */
  active: boolean;
  /** Primary baby agent — receives stroke pixels + focus region rendered */
  agent: BabyAgent;
  /** Secondary agent (baby_1) — also receives stroke food */
  agent2?: BabyAgent;
  /** Library cache for GEO match lookup */
  libraryCache: LibraryEntry[];
  /** Fired when user completes a stroke — contains full GEO + code interpretation */
  onStroke?: (result: StrokeResult) => void;
  /** Fired on every point during a stroke (for live HUD updates) */
  onStrokeUpdate?: (currentPath: string[], currentQuadrant: string) => void;
  /** When a cyan promotion fires, baby draws back at this timestamp */
  lastCyanPromotion?: { path: string[]; ts: number } | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BRUSH STROKE TRAIL
// Each point in the trail fades from full alpha → 0 over TRAIL_LIFE ms
// ═══════════════════════════════════════════════════════════════════════════

interface TrailPoint {
  x: number;
  y: number;
  quadrant: string;   // which quadrant → which color
  t: number;          // timestamp when this point was added
  size: number;       // brush size at this point
}

const TRAIL_LIFE_MS   = 3000;  // stroke fades over 3 seconds
const BRUSH_RADIUS    = 18;    // base brush size in pixels
const FEED_RADIUS     = 22;    // radius of shadow canvas paint (bigger = more food for baby)
const CANVAS_W        = 400;
const CANVAS_H        = 400;
const BLOOM_DURATION  = 2500;  // ms for baby draw-back bloom animation

// ═══════════════════════════════════════════════════════════════════════════
// GEO GRID DRAWING
// Renders the quadtree grid at the agent's current resolution
// ═══════════════════════════════════════════════════════════════════════════

/** Recursively draw quadrant grid lines at the given depth */
function drawQuadGrid(
  p: p5,
  x: number, y: number, w: number, h: number,
  depth: number, maxDepth: number,
  alpha: number
) {
  if (depth >= maxDepth) return;

  const hw = w / 2;
  const hh = h / 2;

  // Draw the midlines for this level
  const lineAlpha = alpha * Math.pow(0.6, depth); // fade deeper lines
  p.stroke(0, 255, 255, lineAlpha * 255);
  p.strokeWeight(Math.max(0.2, 0.8 - depth * 0.2));

  // Vertical midline
  p.line(x + hw, y, x + hw, y + h);
  // Horizontal midline
  p.line(x, y + hh, x + w, y + hh);

  // Recurse into 4 children
  drawQuadGrid(p, x,      y,      hw, hh, depth + 1, maxDepth, alpha);
  drawQuadGrid(p, x + hw, y,      hw, hh, depth + 1, maxDepth, alpha);
  drawQuadGrid(p, x,      y + hh, hw, hh, depth + 1, maxDepth, alpha);
  drawQuadGrid(p, x + hw, y + hh, hw, hh, depth + 1, maxDepth, alpha);
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOOM — baby's draw-back animation
// A glowing ring that expands and fades at the baby's focus region
// ═══════════════════════════════════════════════════════════════════════════

interface Bloom {
  cx: number;    // center x
  cy: number;    // center y
  r: number;     // color r
  g: number;     // color g
  b: number;     // color b
  t: number;     // timestamp when bloom started
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAW CANVAS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DrawCanvas({
  width,
  height,
  active,
  agent,
  agent2,
  libraryCache,
  onStroke,
  onStrokeUpdate,
  lastCyanPromotion,
}: DrawCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);

  // Live refs so p5 closure doesn't go stale
  const activeRef = useRef(active);
  const libraryCacheRef = useRef(libraryCache);
  const onStrokeRef = useRef(onStroke);
  const onStrokeUpdateRef = useRef(onStrokeUpdate);
  const agentRef = useRef(agent);
  const agent2Ref = useRef(agent2);

  // Keep refs in sync
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { libraryCacheRef.current = libraryCache; }, [libraryCache]);
  useEffect(() => { onStrokeRef.current = onStroke; }, [onStroke]);
  useEffect(() => { onStrokeUpdateRef.current = onStrokeUpdate; }, [onStrokeUpdate]);
  useEffect(() => { agentRef.current = agent; }, [agent]);
  useEffect(() => { agent2Ref.current = agent2; }, [agent2]);

  // Bloom trigger: fire when lastCyanPromotion changes
  const bloomTriggerRef = useRef<{ path: string[]; ts: number } | null>(null);
  const pendingBloomRef = useRef<boolean>(false);

  useEffect(() => {
    if (lastCyanPromotion && lastCyanPromotion.ts !== bloomTriggerRef.current?.ts) {
      bloomTriggerRef.current = lastCyanPromotion;
      pendingBloomRef.current = true;
    }
  }, [lastCyanPromotion]);

  // Create p5 ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    // Stroke state (shared via closure)
    const trail: TrailPoint[] = [];
    let isDrawing = false;
    let currentPoints: Array<{ x: number; y: number }> = [];
    let currentQuadrant = '';
    const blooms: Bloom[] = [];

    const sketch = (p: p5) => {
      p.setup = () => {
        const canvas = p.createCanvas(CANVAS_W, CANVAS_H);
        canvas.parent(containerRef.current!);
        p.frameRate(60);
        p.colorMode(p.RGB, 255, 255, 255, 255);
      };

      p.draw = () => {
        const isActive = activeRef.current;
        p.clear();

        // ── LAYER 2: GEO GRID OVERLAY ─────────────────────────────────────
        // Show the quadtree structure baby is perceiving
        const resolution = agentRef.current.getResolution();
        const gridDepth = Math.min(resolution, 3); // cap at 3 levels for readability
        p.noFill();
        drawQuadGrid(p, 0, 0, CANVAS_W, CANVAS_H, 0, gridDepth, isActive ? 0.18 : 0.06);

        // Quadrant color tint — very subtle background wash when active
        if (isActive) {
          p.noStroke();
          const quadTints = [
            { x: 0,       y: 0,       q: 'TL' },
            { x: CANVAS_W/2, y: 0,       q: 'TR' },
            { x: 0,       y: CANVAS_H/2, q: 'BL' },
            { x: CANVAS_W/2, y: CANVAS_H/2, q: 'BR' },
          ];
          for (const tint of quadTints) {
            const c = QUADRANT_COLORS[tint.q];
            p.fill(c.r, c.g, c.b, 12);
            p.rect(tint.x, tint.y, CANVAS_W / 2, CANVAS_H / 2);
          }
        }

        // ── LAYER 1: BRUSH STROKE TRAIL ───────────────────────────────────
        const now = p.millis();
        p.noStroke();
        for (let i = trail.length - 1; i >= 0; i--) {
          const pt = trail[i];
          const age = now - pt.t;
          if (age > TRAIL_LIFE_MS) {
            trail.splice(0, i + 1); // remove all older points
            break;
          }
          const fade = 1 - age / TRAIL_LIFE_MS;
          const c = QUADRANT_COLORS[pt.quadrant] ?? { r: 255, g: 255, b: 255 };
          p.fill(c.r, c.g, c.b, fade * 200);
          p.circle(pt.x, pt.y, pt.size);
        }

        // Cursor glow at current draw position
        if (isDrawing && isActive && currentPoints.length > 0) {
          const last = currentPoints[currentPoints.length - 1];
          const c = QUADRANT_COLORS[currentQuadrant] ?? { r: 255, g: 255, b: 255 };
          // Outer glow
          p.fill(c.r, c.g, c.b, 30);
          p.circle(last.x, last.y, BRUSH_RADIUS * 5);
          // Inner bright dot
          p.fill(c.r, c.g, c.b, 220);
          p.circle(last.x, last.y, BRUSH_RADIUS * 1.5);
        }

        // ── LAYER 3: BABY DRAW-BACK ───────────────────────────────────────
        // Fire a new bloom if a cyan promotion just came in
        if (pendingBloomRef.current) {
          pendingBloomRef.current = false;
          // Get baby's focus region — bloom at its center
          const region = agentRef.current.getFocusRegion(CANVAS_W, CANVAS_H);
          if (region) {
            const cx = region.x + region.w / 2;
            const cy = region.y + region.h / 2;
            // Color = promoted path's family color
            const lib = agentRef.current.getLibraryCache();
            const lastEntry = lib[lib.length - 1];
            const fc = lastEntry
              ? FAMILY_COLORS[lastEntry.loopFamily as keyof typeof FAMILY_COLORS] ?? { r: 0, g: 255, b: 255 }
              : { r: 0, g: 255, b: 255 };
            blooms.push({ cx, cy, r: fc.r, g: fc.g, b: fc.b, t: p.millis() });
          }
        }

        // Render active blooms
        p.noFill();
        for (let i = blooms.length - 1; i >= 0; i--) {
          const bloom = blooms[i];
          const age = p.millis() - bloom.t;
          if (age > BLOOM_DURATION) {
            blooms.splice(i, 1);
            continue;
          }
          const progress = age / BLOOM_DURATION;
          const fade = Math.pow(1 - progress, 1.5);

          // Expanding cyan rings (3 rings, staggered)
          for (let ring = 0; ring < 3; ring++) {
            const ringDelay = ring * 300;
            const ringAge = age - ringDelay;
            if (ringAge < 0) continue;
            const ringProgress = Math.min(1, ringAge / (BLOOM_DURATION - ringDelay));
            const ringFade = Math.pow(1 - ringProgress, 2) * fade;
            const ringRadius = 20 + ringProgress * 80 + ring * 15;
            p.stroke(bloom.r, bloom.g, bloom.b, ringFade * 200);
            p.strokeWeight(2 - ringProgress);
            p.circle(bloom.cx, bloom.cy, ringRadius * 2);
          }

          // Center fill pulse
          p.noStroke();
          p.fill(bloom.r, bloom.g, bloom.b, fade * 80 * (1 - progress));
          p.circle(bloom.cx, bloom.cy, (1 - progress) * 60);
        }
      };

      // ── MOUSE / TOUCH HANDLERS ─────────────────────────────────────────

      p.mousePressed = () => {
        if (!activeRef.current) return;
        if (p.mouseX < 0 || p.mouseX > CANVAS_W || p.mouseY < 0 || p.mouseY > CANVAS_H) return;
        isDrawing = true;
        currentPoints = [];
        const pt = { x: p.mouseX, y: p.mouseY };
        currentPoints.push(pt);
        currentQuadrant = pixelToQuadrant(p.mouseX, p.mouseY, CANVAS_W, CANVAS_H);

        trail.push({
          x: p.mouseX, y: p.mouseY,
          quadrant: currentQuadrant,
          t: p.millis(),
          size: BRUSH_RADIUS * 2,
        });

        // Feed the baby
        const color = QUADRANT_COLORS[currentQuadrant] ?? { r: 200, g: 200, b: 200 };
        agentRef.current.feedStroke(p.mouseX, p.mouseY, FEED_RADIUS, color);
        agent2Ref.current?.feedStroke(p.mouseX, p.mouseY, FEED_RADIUS, color);
      };

      p.mouseDragged = () => {
        if (!activeRef.current || !isDrawing) return;
        if (p.mouseX < 0 || p.mouseX > CANVAS_W || p.mouseY < 0 || p.mouseY > CANVAS_H) return;

        const pt = { x: p.mouseX, y: p.mouseY };
        currentPoints.push(pt);
        const newQuadrant = pixelToQuadrant(p.mouseX, p.mouseY, CANVAS_W, CANVAS_H);

        if (newQuadrant !== currentQuadrant) {
          currentQuadrant = newQuadrant;
        }

        trail.push({
          x: p.mouseX, y: p.mouseY,
          quadrant: currentQuadrant,
          t: p.millis(),
          size: BRUSH_RADIUS * 2,
        });

        // Feed the baby — every drag point is pixel food
        const color = QUADRANT_COLORS[currentQuadrant] ?? { r: 200, g: 200, b: 200 };
        agentRef.current.feedStroke(p.mouseX, p.mouseY, FEED_RADIUS, color);
        agent2Ref.current?.feedStroke(p.mouseX, p.mouseY, FEED_RADIUS, color);

        // Live path update for HUD
        const livePath = buildGEOPathFromPoints(currentPoints, CANVAS_W, CANVAS_H);
        onStrokeUpdateRef.current?.(livePath, currentQuadrant);
      };

      p.mouseReleased = () => {
        if (!isDrawing || !activeRef.current) return;
        isDrawing = false;

        if (currentPoints.length === 0) return;

        // Interpret the completed stroke
        const result = interpretStroke(
          currentPoints,
          CANVAS_W,
          CANVAS_H,
          libraryCacheRef.current
        );

        onStrokeRef.current?.(result);
        currentPoints = [];
      };

      // Touch support — cast to any since p5 TS types don't include touch handlers
      (p as any).touchStarted = () => {
        if (!activeRef.current) return false;
        const t = (p as any).touches?.[0];
        if (!t) return false;
        isDrawing = true;
        currentPoints = [];
        currentPoints.push({ x: t.x, y: t.y });
        currentQuadrant = pixelToQuadrant(t.x, t.y, CANVAS_W, CANVAS_H);
        trail.push({ x: t.x, y: t.y, quadrant: currentQuadrant, t: p.millis(), size: BRUSH_RADIUS * 2.5 });
        const color = QUADRANT_COLORS[currentQuadrant] ?? { r: 200, g: 200, b: 200 };
        agentRef.current.feedStroke(t.x, t.y, FEED_RADIUS * 1.3, color);
        return false;
      };

      (p as any).touchMoved = () => {
        if (!activeRef.current || !isDrawing) return false;
        const t = (p as any).touches?.[0];
        if (!t) return false;
        currentPoints.push({ x: t.x, y: t.y });
        currentQuadrant = pixelToQuadrant(t.x, t.y, CANVAS_W, CANVAS_H);
        trail.push({ x: t.x, y: t.y, quadrant: currentQuadrant, t: p.millis(), size: BRUSH_RADIUS * 2.5 });
        const color = QUADRANT_COLORS[currentQuadrant] ?? { r: 200, g: 200, b: 200 };
        agentRef.current.feedStroke(t.x, t.y, FEED_RADIUS * 1.3, color);
        const livePath = buildGEOPathFromPoints(currentPoints, CANVAS_W, CANVAS_H);
        onStrokeUpdateRef.current?.(livePath, currentQuadrant);
        return false;
      };

      (p as any).touchEnded = () => {
        if (!isDrawing || !activeRef.current) return false;
        isDrawing = false;
        if (currentPoints.length > 0) {
          const result = interpretStroke(currentPoints, CANVAS_W, CANVAS_H, libraryCacheRef.current);
          onStrokeRef.current?.(result);
        }
        currentPoints = [];
        return false;
      };
    };

    p5Ref.current = new p5(sketch);

    return () => {
      p5Ref.current?.remove();
      p5Ref.current = null;
    };
  }, []); // create once

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : 'default',
        zIndex: 20,
      }}
    />
  );
}
