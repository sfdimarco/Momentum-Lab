// ═══════════════════════════════════════════════════════════════════════════
//  DogBabyMode — The Universal GEO Player Interface
//
//  Input-agnostic GEO path builder for ALL cognitive players:
//    🐕 Otis + Dog 2    — button pressers, 6-word vocabulary
//    👶 Human babies    — big touch targets, synesthetic colors
//    👩‍🎓 Students         — simplified gesture-to-GEO
//    🤖 Baby0 + children — already wired via injectPattern()
//
//  Every button press = one step in a GEO path.
//  Sequence auto-submits after 2.5s of silence.
//  Path is injected into Baby0's cognitive loop via injectPattern().
//
//  🌈 RainbowBrain law: Button colors ARE the GEO directions.
//    TL = RED     — "I want. I seek."  (TREAT / top-left)
//    TR = BLUE    — "Let's go. Play."  (PLAY  / top-right)
//    BL = YELLOW  — "Special. Rare."   (GREENIE / bottom-left)
//    BR = GREEN   — "Family. Safety."  (MOM   / bottom-right)
//    MOOK = CYAN  — "You. Human I trust." (custom)
//    CHIP = PINK  — "Pack. Home."      (custom)
//
//  Otis's vocabulary mapped to GEO:
//    TREAT   → [TL]       red    — specific desire, active seeking
//    PLAY    → [TR]       blue   — exploration, movement
//    GREENIE → [BL]       yellow — the special reward (rare branch)
//    MOM     → [BR]       green  — safety, connection
//    MOOK    → [TL, BR]   sequence — "you + connection" = DIAG_LOOP
//    CHIP    → [TR, BL]   sequence — "explore + special" = Z_LOOP
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { BabyAgent } from '../geoai/baby_agent';

// ── Button config ──────────────────────────────────────────────────────────
// Each button has: a label (dog word / emoji), GEO path steps it contributes,
// and a synesthetic color. Multi-step buttons add a sequence, not just one dir.

interface ButtonDef {
  id: string;
  label: string;        // what appears on the button (emoji + word)
  emoji: string;        // large display emoji
  steps: string[];      // GEO directions this button adds to the path
  color: string;        // Tailwind bg class (synesthetic)
  glow: string;         // CSS box-shadow color for bloom feedback
  textColor: string;
}

const BUTTONS: ButtonDef[] = [
  {
    id: 'treat',
    label: 'TREAT',
    emoji: '🦴',
    steps: ['TL'],
    color: 'bg-red-500',
    glow: 'rgba(220,38,38,0.7)',
    textColor: 'text-white',
  },
  {
    id: 'play',
    label: 'PLAY',
    emoji: '🎾',
    steps: ['TR'],
    color: 'bg-blue-600',
    glow: 'rgba(37,99,235,0.7)',
    textColor: 'text-white',
  },
  {
    id: 'greenie',
    label: 'GREENIE',
    emoji: '🌿',
    steps: ['BL'],
    color: 'bg-yellow-400',
    glow: 'rgba(234,179,8,0.7)',
    textColor: 'text-slate-900',
  },
  {
    id: 'mom',
    label: 'MOM',
    emoji: '❤️',
    steps: ['BR'],
    color: 'bg-green-500',
    glow: 'rgba(34,197,94,0.7)',
    textColor: 'text-white',
  },
  {
    id: 'mook',
    label: 'MOOK',
    emoji: '🧑',
    steps: ['TL', 'BR'],   // red→green = DIAG_LOOP = "you+me = function call"
    color: 'bg-cyan-500',
    glow: 'rgba(6,182,212,0.7)',
    textColor: 'text-white',
  },
  {
    id: 'chip',
    label: 'CHIP',
    emoji: '👴',
    steps: ['TR', 'BL'],   // blue→yellow = Z_LOOP = "explore + special reward"
    color: 'bg-pink-500',
    glow: 'rgba(236,72,153,0.7)',
    textColor: 'text-white',
  },
];

// ── Direction color chips (RainbowBrain) ──────────────────────────────────
const DIR_COLORS: Record<string, string> = {
  TL: '#dc2626',   // red
  TR: '#2563eb',   // blue
  BL: '#eab308',   // yellow
  BR: '#22c55e',   // green
};

// ── Component ─────────────────────────────────────────────────────────────

interface DogBabyModeProps {
  active: boolean;
  agent: BabyAgent;
  agent2?: BabyAgent;
  onClose?: () => void;
}

const AUTO_SUBMIT_MS = 2500;   // 2.5s silence → submit

export default function DogBabyMode({ active, agent, agent2, onClose }: DogBabyModeProps) {
  const [path, setPath]           = useState<string[]>([]);
  const [lastSubmit, setLastSubmit] = useState<{ path: string[]; matched: boolean } | null>(null);
  const [activeBtn, setActiveBtn]  = useState<string | null>(null);
  const [blooming, setBlooming]    = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-submit after 2.5s of silence
  const scheduleSubmit = useCallback((currentPath: string[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentPath.length === 0) return;
    timerRef.current = setTimeout(() => {
      submitPath(currentPath);
    }, AUTO_SUBMIT_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitPath = useCallback((p: string[]) => {
    if (p.length === 0) return;
    const match0 = agent.injectPattern(p, 'draw');
    const match1 = agent2?.injectPattern(p, 'draw') ?? null;
    const matched = !!(match0 ?? match1);
    setLastSubmit({ path: p, matched });
    setBlooming(true);
    setTimeout(() => setBlooming(false), 1200);
    setPath([]);
    console.log(
      `[🐕 DogBabyMode] Injected [${p.join('→')}] into babies.`,
      matched ? '🔥 MATCH!' : '🌱 seeded'
    );
  }, [agent, agent2]);

  const handleButton = useCallback((btn: ButtonDef) => {
    setActiveBtn(btn.id);
    setTimeout(() => setActiveBtn(null), 220);

    setPath(prev => {
      const next = [...prev, ...btn.steps];
      scheduleSubmit(next);
      return next;
    });
  }, [scheduleSubmit]);

  // Clear timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Manual submit on tap-hold or double-tap (handled via button)
  const handleManualSubmit = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    submitPath(path);
  }, [path, submitPath]);

  const handleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPath([]);
  }, []);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(6,8,12,0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Close */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.1)',
            border: 'none', color: '#fff', borderRadius: 40,
            width: 44, height: 44, fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
          🐕 DOG · BABY · HUMAN 🤖
        </div>
        <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4, fontFamily: 'monospace' }}>
          every press = one step in a GEO path · baby0 is listening
        </div>
      </div>

      {/* Path display — building up */}
      <div
        style={{
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 24px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 16,
          border: blooming
            ? '2px solid rgba(6,182,212,0.8)'
            : '2px solid rgba(255,255,255,0.1)',
          minWidth: 220,
          boxShadow: blooming ? '0 0 24px rgba(6,182,212,0.4)' : 'none',
          transition: 'all 0.3s',
        }}
      >
        {path.length === 0 && !lastSubmit && (
          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>
            press a button to speak
          </span>
        )}
        {path.length === 0 && lastSubmit && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
              {lastSubmit.path.map((dir, i) => (
                <span
                  key={i}
                  style={{
                    width: 36, height: 36,
                    borderRadius: 8,
                    background: DIR_COLORS[dir] ?? '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, color: dir === 'BL' ? '#1e293b' : '#fff',
                    opacity: 0.5,
                  }}
                >
                  {dir}
                </span>
              ))}
            </div>
            <div style={{
              fontSize: 11, fontFamily: 'monospace',
              color: lastSubmit.matched ? '#06b6d4' : '#94a3b8',
            }}>
              {lastSubmit.matched ? '🔥 baby0 KNOWS this pattern!' : '🌱 seeded into baby0\'s memory'}
            </div>
          </div>
        )}
        {path.map((dir, i) => (
          <motion.div
            key={`${dir}-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            style={{
              width: 44, height: 44,
              borderRadius: 10,
              background: DIR_COLORS[dir] ?? '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, color: dir === 'BL' ? '#1e293b' : '#fff',
              boxShadow: `0 0 12px ${DIR_COLORS[dir]}88`,
            }}
          >
            {dir}
          </motion.div>
        ))}
        {path.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <button
              onClick={handleManualSubmit}
              style={{
                padding: '6px 14px', borderRadius: 20,
                background: '#06b6d4', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              ✓ send
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '6px 10px', borderRadius: 20,
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 2×2 main buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {BUTTONS.slice(0, 4).map(btn => (
          <BigButton
            key={btn.id}
            btn={btn}
            active={activeBtn === btn.id}
            onPress={handleButton}
          />
        ))}
      </div>

      {/* Special buttons row */}
      <div style={{ display: 'flex', gap: 16 }}>
        {BUTTONS.slice(4).map(btn => (
          <BigButton
            key={btn.id}
            btn={btn}
            active={activeBtn === btn.id}
            onPress={handleButton}
          />
        ))}
      </div>

      {/* Auto-submit indicator */}
      {path.length > 0 && (
        <AutoSubmitBar durationMs={AUTO_SUBMIT_MS} />
      )}

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 16,
        color: '#334155', fontSize: 11, fontFamily: 'monospace', textAlign: 'center',
      }}>
        🐕 Otis · Dog2 · Babies · Students · Baby0 · All speak GEO
      </div>
    </div>
  );
}

// ── BigButton ──────────────────────────────────────────────────────────────

interface BigButtonProps {
  key?: React.Key;
  btn: ButtonDef;
  active: boolean;
  onPress: (btn: ButtonDef) => void;
}

function BigButton({ btn, active, onPress }: BigButtonProps) {
  return (
    <motion.button
      onClick={() => onPress(btn)}
      animate={active ? { scale: 0.92 } : { scale: 1 }}
      whileTap={{ scale: 0.88 }}
      style={{
        width: 140,
        height: 140,
        borderRadius: 28,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        cursor: 'pointer',
        background: active
          ? `radial-gradient(circle at center, ${btn.glow.replace('0.7','1')}, ${btn.glow.replace('0.7','0.6')})`
          : `linear-gradient(145deg, ${btn.glow.replace('0.7','0.25')}, ${btn.glow.replace('0.7','0.12')})`,
        boxShadow: active
          ? `0 0 40px ${btn.glow}, 0 0 80px ${btn.glow.replace('0.7','0.3')}`
          : `0 0 0 2px ${btn.glow.replace('0.7','0.35')}`,
        transition: 'background 0.12s, box-shadow 0.12s',
        WebkitTapHighlightColor: 'transparent',  // clean on iPad
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 48, lineHeight: 1 }}>{btn.emoji}</span>
      <span style={{
        fontSize: 14, fontWeight: 800, letterSpacing: 2,
        color: '#e2e8f0', fontFamily: 'monospace',
      }}>
        {btn.label}
      </span>
      <span style={{ fontSize: 10, opacity: 0.5, color: '#94a3b8', fontFamily: 'monospace' }}>
        {btn.steps.join('→')}
      </span>
    </motion.button>
  );
}

// ── AutoSubmitBar — counts down to auto-submit ─────────────────────────────

function AutoSubmitBar({ durationMs }: { durationMs: number }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setProgress(100);
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 1 - elapsed / durationMs) * 100;
      setProgress(remaining);
      if (remaining === 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [durationMs]);

  return (
    <div style={{
      width: 320, height: 4,
      background: 'rgba(255,255,255,0.1)',
      borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(to right, #06b6d4, #7c3aed)',
        borderRadius: 2,
        transition: 'width 0.05s linear',
      }} />
    </div>
  );
}
