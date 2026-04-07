/**
 * LibraryPanel.tsx — Phase B: The Librarian's Living Archive
 *
 * Renders all LibraryEntry records promoted to Cyan State (confidence ≥ 0.9).
 * Shows each entry's GEO loop family, quadtree path, current code hint, and
 * confidence tier (apprentice → journeyman → master).
 *
 * This is where geometry becomes visible as code.
 * The rock reaches the top. The Librarian files the weight.
 *
 * Design principles:
 *  - Synesthetic color-coding: family → color (Mook's system)
 *  - Code hint grows in complexity as confidence matures (Phase B evolution)
 *  - No text explanations — the geometry IS the explanation
 *  - Kid-friendly readability: big colored tag, clear monospace hint
 */

import React, { useRef, useEffect } from 'react';
import type { LibraryEntry, GEOFamily } from '../geoai/parser';

// ═══════════════════════════════════════════════════════════════════════════
// SYNESTHETIC COLOR MAP
// GEO loop family → visual color (Mook's sense-language)
//
//  Y_LOOP   — single rotation, linear flow  → gold / yellow (3)
//  X_LOOP   — adjacent branch, if/else       → blue (2)
//  Z_LOOP   — three-quadrant sweep, loop     → green (4 adjacent)
//  DIAG_LOOP— diagonal, recursion/callback   → pink/purple (6↔7 territory)
//  GATE_ON  — all quadrants, function def    → white / light (8)
//  GATE_OFF — no movement, null state        → grey/dark (0 cyan echo)
// ═══════════════════════════════════════════════════════════════════════════

interface FamilyStyle {
  bg: string;       // Tailwind bg class for the tag
  border: string;   // Tailwind border class for the row
  text: string;     // Tailwind text class for the tag
  glow: string;     // Tailwind ring class for master tier
  emoji: string;
  label: string;
  codeColor: string; // color for the code hint text
}

const FAMILY_STYLES: Record<GEOFamily, FamilyStyle> = {
  Y_LOOP: {
    bg: 'bg-yellow-400',
    border: 'border-yellow-300',
    text: 'text-yellow-900',
    glow: 'ring-yellow-400',
    emoji: '➡️',
    label: 'Y-LOOP',
    codeColor: '#92400e', // amber-800
  },
  X_LOOP: {
    bg: 'bg-blue-500',
    border: 'border-blue-300',
    text: 'text-blue-50',
    glow: 'ring-blue-400',
    emoji: '↔️',
    label: 'X-LOOP',
    codeColor: '#1e3a8a', // blue-900
  },
  Z_LOOP: {
    bg: 'bg-green-500',
    border: 'border-green-300',
    text: 'text-green-50',
    glow: 'ring-green-400',
    emoji: '🔄',
    label: 'Z-LOOP',
    codeColor: '#14532d', // green-900
  },
  DIAG_LOOP: {
    bg: 'bg-purple-500',
    border: 'border-purple-300',
    text: 'text-purple-50',
    glow: 'ring-purple-400',
    emoji: '↗️',
    label: 'DIAG',
    codeColor: '#3b0764', // purple-900
  },
  GATE_ON: {
    bg: 'bg-slate-200',
    border: 'border-slate-300',
    text: 'text-slate-700',
    glow: 'ring-slate-400',
    emoji: '⬛',
    label: 'GATE-ON',
    codeColor: '#1e293b', // slate-800
  },
  GATE_OFF: {
    bg: 'bg-slate-400',
    border: 'border-slate-400',
    text: 'text-slate-100',
    glow: 'ring-slate-500',
    emoji: '⬜',
    label: 'GATE-OFF',
    codeColor: '#475569', // slate-600
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE TIER BADGE
// ═══════════════════════════════════════════════════════════════════════════

function getTier(confidence: number): { label: string; color: string; icon: string } {
  if (confidence >= 1.0) return { label: 'MASTER', color: '#f59e0b',   icon: '👑' };
  if (confidence >= 0.95) return { label: 'JOURNEYMAN', color: '#06b6d4', icon: '⚡' };
  return                         { label: 'APPRENTICE', color: '#94a3b8', icon: '🌱' };
}

// ═══════════════════════════════════════════════════════════════════════════
// PATH BEADS — the quadtree address rendered as colored squares
// ═══════════════════════════════════════════════════════════════════════════

const QUADRANT_COLORS: Record<string, string> = {
  TL: '#ef4444', // red  — top-left (1 in Mook's system)
  TR: '#3b82f6', // blue — top-right (2)
  BL: '#eab308', // yellow — bottom-left (3)
  BR: '#22c55e', // green — bottom-right (4)
};

function PathBeads({ path }: { path: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {path.map((step, i) => (
        <React.Fragment key={i}>
          <span
            className="inline-block w-4 h-4 rounded-sm text-white text-[8px] font-bold flex items-center justify-center leading-none"
            style={{ backgroundColor: QUADRANT_COLORS[step] ?? '#94a3b8' }}
            title={step}
          >
            {step[0]}{step[1]}
          </span>
          {i < path.length - 1 && (
            <span className="text-slate-400 text-[8px]">›</span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE LIBRARY ENTRY ROW
// ═══════════════════════════════════════════════════════════════════════════

interface EntryRowProps {
  // React 19: key must be declared in props if used in JSX
  key?: React.Key;
  entry: LibraryEntry;
  agentLabel: string;
  agentColor: string;
  isNew?: boolean;
}

function EntryRow({ entry, agentLabel, agentColor, isNew }: EntryRowProps) {
  const style = FAMILY_STYLES[entry.loopFamily as GEOFamily] ?? FAMILY_STYLES.GATE_OFF;
  const tier = getTier(entry.confidence);

  // Flash animation ref for new entries
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isNew && rowRef.current) {
      rowRef.current.animate(
        [
          { backgroundColor: 'rgba(6,182,212,0.3)', boxShadow: '0 0 12px rgba(6,182,212,0.6)' },
          { backgroundColor: 'transparent', boxShadow: '0 0 0 transparent' },
        ],
        { duration: 1200, easing: 'ease-out' }
      );
    }
  }, [isNew]);

  return (
    <div
      ref={rowRef}
      className={`flex flex-col gap-1 px-2 py-1.5 rounded-lg border ${style.border} bg-white/60`}
    >
      {/* Row header: agent dot + family tag + path + tier */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Agent indicator */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: agentColor }}
          title={agentLabel}
        />
        {/* GEO Family tag */}
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${style.bg} ${style.text}`}
        >
          {style.emoji} {style.label}
        </span>
        {/* Quadtree path as colored beads */}
        <PathBeads path={entry.address} />
        {/* Spacer */}
        <span className="flex-1" />
        {/* Confidence tier */}
        <span
          className="text-[9px] font-bold"
          style={{ color: tier.color }}
          title={`confidence: ${(entry.confidence * 100).toFixed(0)}%`}
        >
          {tier.icon} {tier.label}
        </span>
        {/* Visit count */}
        {entry.visitCount > 0 && (
          <span className="text-[9px] text-slate-400">×{entry.visitCount}</span>
        )}
      </div>
      {/* Code hint — the rock's inscription */}
      {entry.codeHint && (
        <code
          className="block text-[10px] font-mono leading-snug px-2 py-1 rounded bg-slate-900/90 text-green-300 overflow-x-auto whitespace-pre-wrap"
        >
          {entry.codeHint}
        </code>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY PANEL — the Librarian's full archive
// ═══════════════════════════════════════════════════════════════════════════

export interface LibraryAgentSlot {
  libraryCache: Array<{
    id: string;
    address: string[];
    depth: number;
    confidence: number;
    promotedAt: number;
    deltaSignature: number;
    loopFamily: string;
    codeHint: string | null;
    visitCount: number;
    cyanFlashFired: boolean;
  }>;
  label: string;
  color: string;  // hex color for agent dot
}

interface LibraryPanelProps {
  agents: LibraryAgentSlot[];
  visible: boolean;
}

export default function LibraryPanel({ agents, visible }: LibraryPanelProps) {
  if (!visible) return null;

  // Flatten all entries, deduplicate by id, sort by promotedAt desc
  const allEntries: Array<{ entry: LibraryAgentSlot['libraryCache'][0]; agentLabel: string; agentColor: string }> = [];
  const seenIds = new Set<string>();

  for (const agent of agents) {
    for (const entry of agent.libraryCache) {
      const uniqueKey = `${agent.label}__${entry.id}`;
      if (!seenIds.has(uniqueKey)) {
        seenIds.add(uniqueKey);
        allEntries.push({ entry, agentLabel: agent.label, agentColor: agent.color });
      }
    }
  }

  // Sort: most recently promoted first
  allEntries.sort((a, b) => b.entry.promotedAt - a.entry.promotedAt);

  const totalEntries = allEntries.length;
  const masterCount = allEntries.filter(e => e.entry.confidence >= 1.0).length;
  const journeymanCount = allEntries.filter(e => e.entry.confidence >= 0.95 && e.entry.confidence < 1.0).length;

  return (
    <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-cyan-100/80 border-b border-cyan-200">
        <span className="text-base">📚</span>
        <span className="font-bold text-cyan-900 text-xs tracking-wide">
          LIBRARIAN'S ARCHIVE
        </span>
        <span className="font-mono text-[10px] text-cyan-700 bg-cyan-200 px-1.5 py-0.5 rounded">
          {totalEntries} filed
        </span>
        {masterCount > 0 && (
          <span className="font-mono text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
            👑 {masterCount} master
          </span>
        )}
        {journeymanCount > 0 && (
          <span className="font-mono text-[10px] text-cyan-700 bg-cyan-200 px-1.5 py-0.5 rounded">
            ⚡ {journeymanCount} journeyman
          </span>
        )}
        <span className="flex-1" />
        <span className="text-[9px] text-cyan-500 font-mono">PHASE B</span>
      </div>

      {/* Entry list */}
      {totalEntries === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-cyan-400 font-mono italic">
          No patterns promoted yet.<br />
          <span className="text-[10px] opacity-70">Confidence ≥ 0.9 triggers Cyan State.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 p-2 max-h-72 overflow-y-auto">
          {allEntries.map(({ entry, agentLabel, agentColor }, idx) => (
            <EntryRow
              key={`${agentLabel}__${entry.id}`}
              entry={entry as LibraryEntry}
              agentLabel={agentLabel}
              agentColor={agentColor}
              isNew={idx === 0}
            />
          ))}
        </div>
      )}

      {/* Footer hint */}
      {totalEntries > 0 && (
        <div className="px-3 py-1 border-t border-cyan-200 text-[9px] text-cyan-500 font-mono text-right">
          🌱 apprentice → ⚡ journeyman → 👑 master &nbsp;|&nbsp; geometry IS the code
        </div>
      )}
    </div>
  );
}
