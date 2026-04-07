/**
 * StrokeHUD.tsx — Live Gesture Translation Overlay
 *
 * Floats over the canvas corner and shows — in real-time — what GEO
 * construct the student's current gesture corresponds to.
 *
 * Updates LIVE as the user drags (path updates on every drag point).
 * Shows the final code hint when stroke is completed.
 * Fades out gracefully 2.5s after the last stroke ends.
 *
 * Layout:
 *   [FAMILY TAG]  [PATH BEADS]  →  [CODE HINT]
 *   Y-LOOP        [TL]          →  print("Hello")
 *
 * Pillar 2: the invisible math made visible without any text to read.
 * The kid FEELS the geometry → code translation happen under their finger.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { StrokeResult } from '../geoai/stroke-interpreter';
import { FAMILY_LABELS } from '../geoai/stroke-interpreter';
import type { GEOFamily } from '../geoai/parser';

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY COLOR MAP — for the tag background
// ═══════════════════════════════════════════════════════════════════════════

const FAMILY_BG: Record<string, string> = {
  Y_LOOP:    '#ca8a04',  // gold-600
  X_LOOP:    '#2563eb',  // blue-600
  Z_LOOP:    '#16a34a',  // green-600
  DIAG_LOOP: '#9333ea',  // purple-600
  GATE_ON:   '#475569',  // slate-600
  GATE_OFF:  '#334155',  // slate-700
};

const QUADRANT_COLORS: Record<string, string> = {
  TL: '#ef4444',
  TR: '#3b82f6',
  BL: '#eab308',
  BR: '#22c55e',
};

// ═══════════════════════════════════════════════════════════════════════════
// PATH BEADS — compact visual path display
// ═══════════════════════════════════════════════════════════════════════════

function PathBeads({ path }: { path: string[] }) {
  if (path.length === 0) return <span className="text-slate-500 text-[9px] italic">drawing...</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {path.map((step, i) => (
        <React.Fragment key={i}>
          <span
            className="inline-block w-5 h-5 rounded text-white text-[8px] font-black flex items-center justify-center leading-none shadow-sm"
            style={{ backgroundColor: QUADRANT_COLORS[step] ?? '#94a3b8' }}
          >
            {step}
          </span>
          {i < path.length - 1 && (
            <span className="text-slate-400 text-[10px] font-bold">›</span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STROKE HUD
// ═══════════════════════════════════════════════════════════════════════════

interface StrokeHUDProps {
  /** Completed stroke result (fires on mouse release) */
  lastStroke: StrokeResult | null;
  /** Live path during stroke (fires on every drag point) */
  livePath: string[];
  /** Whether draw mode is active */
  active: boolean;
}

export default function StrokeHUD({ lastStroke, livePath, active }: StrokeHUDProps) {
  const [visible, setVisible] = useState(false);
  const [displayPath, setDisplayPath] = useState<string[]>([]);
  const [displayFamily, setDisplayFamily] = useState<string>('');
  const [displayCode, setDisplayCode] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear fade timer on unmount
  useEffect(() => () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  // Show + update when draw mode is toggled on
  useEffect(() => {
    if (active) {
      setVisible(true);
      setDisplayPath([]);
      setDisplayFamily('');
      setDisplayCode(null);
    }
  }, [active]);

  // Live path updates — fires during drag
  useEffect(() => {
    if (livePath.length === 0) return;
    setVisible(true);
    setIsLive(true);
    setDisplayPath(livePath);

    // Infer family live
    const inferFamily = (path: string[]): GEOFamily => {
      if (path.length === 0) return 'GATE_OFF';
      const unique = new Set(path);
      if (unique.size <= 1) return 'Y_LOOP';
      if (unique.size === 2) {
        const [a, b] = [...unique];
        const diagonal =
          (a === 'TL' && b === 'BR') || (a === 'BR' && b === 'TL') ||
          (a === 'TR' && b === 'BL') || (a === 'BL' && b === 'TR');
        return diagonal ? 'DIAG_LOOP' : 'X_LOOP';
      }
      if (unique.size === 3) return 'Z_LOOP';
      return 'GATE_ON';
    };
    setDisplayFamily(inferFamily(livePath));
    setDisplayCode(null); // code only shows on completion
  }, [livePath]);

  // Completed stroke result
  useEffect(() => {
    if (!lastStroke) return;
    setVisible(true);
    setIsLive(false);
    setDisplayPath(lastStroke.path);
    setDisplayFamily(lastStroke.family);
    setDisplayCode(lastStroke.codeHint);

    // Start fade timer
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      if (!active) setVisible(false);
    }, 4000);
  }, [lastStroke, active]);

  if (!visible) return null;

  const familyLabel = FAMILY_LABELS[displayFamily as GEOFamily] ?? displayFamily;
  const familyBg = FAMILY_BG[displayFamily] ?? '#475569';

  return (
    <div
      className="absolute top-2 left-2 z-30 flex flex-col gap-1.5 max-w-[380px]"
      style={{ pointerEvents: 'none' }}
    >
      {/* Main translation row */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-sm border border-slate-700/60 shadow-lg">

        {/* Live indicator */}
        {isLive && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        )}

        {/* Family tag */}
        {displayFamily && (
          <span
            className="text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ backgroundColor: familyBg }}
          >
            {familyLabel}
          </span>
        )}

        {/* Path beads */}
        <PathBeads path={displayPath} />

        {/* Arrow */}
        {displayCode && (
          <span className="text-slate-500 text-[10px] flex-shrink-0">→</span>
        )}
      </div>

      {/* Code hint — appears on stroke completion */}
      {displayCode && (
        <div className="px-2 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/60 shadow-lg">
          <code className="text-[10px] font-mono text-green-300 leading-snug whitespace-pre-wrap block">
            {displayCode}
          </code>
        </div>
      )}

      {/* Draw mode instruction — when no stroke yet */}
      {!displayFamily && active && (
        <div className="px-2 py-1 rounded bg-slate-950/70 border border-slate-700/40">
          <span className="text-[9px] text-slate-400 font-mono">
            🖌️ draw on canvas → geometry becomes code
          </span>
        </div>
      )}
    </div>
  );
}
