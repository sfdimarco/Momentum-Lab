// ═══════════════════════════════════════════════════════════════════════════
//  PATTERN BURST — "What Did The AI Find?"
//
//  The bidirectional student-AI loop, made VISIBLE.
//
//  When a baby agent locks in a pattern (confidence crosses 0.7 = pink),
//  PatternBurst:
//    1. Captures a thumbnail of the EXACT region of the student's canvas
//    2. Slams it into a card wall that the student can actually SEE
//    3. Fires a callback so the canvas can flash that region in color
//
//  The card wall answers: "The AI found something here — look at this spot!"
//  That spark of "whoa, the AI saw THAT?" is the loop closing.
//
//  Pillar 2 (Synesthetic): Pure visual. No text explaining what was found.
//  Pillar 3 (Pedagogy): The AI's curiosity becomes the kid's curiosity.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback, RefObject } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BabyAgent, BabyAgentEvent } from '../geoai/baby_agent';
import { captureQuadrantThumb, getQuadrantBounds } from '../geoai/pattern-lens';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  agent: BabyAgent;
  name: string;
  /** Tailwind-compatible CSS color class base (e.g. 'cyan', 'pink') */
  color: 'cyan' | 'pink';
  /** CSS accent color for borders and glows */
  accentHex: string;
}

export interface DiscoveryFlash {
  id: number;
  /** Pixel bounds on the canvas (matches canvas coordinate space) */
  bounds: { x: number; y: number; w: number; h: number };
  /** CSS color string */
  color: string;
  ts: number;
}

export interface PatternCard {
  id: string;            // unique: `${agentName}_${pathKey}`
  agentName: string;
  agentColor: 'cyan' | 'pink';
  accentHex: string;
  path: string[];
  depth: number;
  confidence: number;
  visitCount: number;    // how many times reinforced
  thumb: string | null;  // JPEG data URL of the quadrant snapshot
  ts: number;            // when first discovered
  justReinforced: boolean;  // briefly true after a revisit, for glow animation
}

// ── Props ────────────────────────────────────────────────────────────────────

interface PatternBurstProps {
  agents: AgentConfig[];
  /** Ref to the div that wraps the game canvas — used to find the canvas and anchor flashes */
  canvasContainerRef: RefObject<HTMLDivElement>;
  /** Called when a new discovery arrives — parent renders a flash overlay */
  onFlash: (flash: DiscoveryFlash) => void;
  visible: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

const MAX_CARDS = 8;
const CARD_SIZE = 72;          // thumbnail px
const PINK_THRESHOLD = 0.7;    // confidence where we call it "found"
const NEW_CARD_THRESHOLD = 0.3; // confidence where we first show a card

let flashIdCounter = 0;

export const PatternBurst: React.FC<PatternBurstProps> = ({
  agents,
  canvasContainerRef,
  onFlash,
  visible,
}) => {
  const [cards, setCards] = useState<PatternCard[]>([]);
  const cardsRef = useRef<PatternCard[]>([]);

  // Keep ref in sync for use in event callbacks
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Find the live game canvas from the container (reads .current at call time — always fresh)
  const getGameCanvas = useCallback((): HTMLCanvasElement | null => {
    const container = canvasContainerRef.current;
    if (!container) return null;
    // Use the p5Canvas specifically to avoid shadow canvases
    const c = container.querySelector('canvas.p5Canvas') as HTMLCanvasElement | null;
    return c ?? (container.querySelector('canvas') as HTMLCanvasElement | null);
  }, [canvasContainerRef]);

  useEffect(() => {
    if (!visible) return;

    // Subscribe to all agents
    const unsubs = agents.map(({ agent, name, color, accentHex }) => {
      return agent.on((event: BabyAgentEvent) => {
        if (event.type === 'pattern_cached') {
          const { pattern } = event;
          const path = pattern.geoAddress?.path;
          const depth = pattern.geoAddress?.depth;
          if (!path || depth === undefined) return;
          if (pattern.confidence < NEW_CARD_THRESHOLD) return;

          const pathKey = path.join('→');
          const cardId = `${name}_${pathKey}`;

          setCards(prev => {
            // Don't duplicate — only add if not already present
            if (prev.some(c => c.id === cardId)) return prev;

            const canvas = getGameCanvas();
            const thumb = canvas ? captureQuadrantThumb(canvas, path, CARD_SIZE) : null;

            const newCard: PatternCard = {
              id: cardId,
              agentName: name,
              agentColor: color,
              accentHex,
              path,
              depth,
              confidence: pattern.confidence,
              visitCount: 1,
              thumb,
              ts: Date.now(),
              justReinforced: false,
            };

            // Newest first, cap at MAX_CARDS
            return [newCard, ...prev].slice(0, MAX_CARDS);
          });
        }

        if (event.type === 'pattern_reinforced') {
          const { pattern, prevConfidence } = event;
          const path = pattern.geoAddress?.path;
          if (!path) return;

          const pathKey = path.join('→');
          const cardId = `${name}_${pathKey}`;
          const newConf = pattern.confidence;
          const crossedPink = prevConfidence < PINK_THRESHOLD && newConf >= PINK_THRESHOLD;

          setCards(prev => {
            const existing = prev.find(c => c.id === cardId);

            if (existing) {
              // Update in place — refresh thumb on reinforcement
              const canvas = getGameCanvas();
              const freshThumb = canvas ? captureQuadrantThumb(canvas, path, CARD_SIZE) : existing.thumb;

              return prev.map(c =>
                c.id === cardId
                  ? { ...c, confidence: newConf, visitCount: c.visitCount + 1, thumb: freshThumb ?? c.thumb, justReinforced: true }
                  : c
              );
            } else {
              // First time seeing this card (was below new_card threshold before)
              const canvas = getGameCanvas();
              const thumb = canvas ? captureQuadrantThumb(canvas, path, CARD_SIZE) : null;
              const newCard: PatternCard = {
                id: cardId, agentName: name, agentColor: color, accentHex,
                path, depth: pattern.geoAddress.depth,
                confidence: newConf, visitCount: 1, thumb, ts: Date.now(),
                justReinforced: false,
              };
              return [newCard, ...prev].slice(0, MAX_CARDS);
            }
          });

          // On pink threshold cross: fire the canvas flash
          if (crossedPink) {
            const canvas = getGameCanvas();
            if (canvas) {
              const bounds = getQuadrantBounds(path, canvas.width, canvas.height);
              onFlash({
                id: ++flashIdCounter,
                bounds,
                color: accentHex,
                ts: Date.now(),
              });
            }
          }

          // Clear justReinforced after animation
          setTimeout(() => {
            setCards(prev => prev.map(c =>
              c.id === cardId ? { ...c, justReinforced: false } : c
            ));
          }, 1200);
        }
      });
    });

    return () => unsubs.forEach(u => u());
  }, [agents, visible, onFlash, getGameCanvas]);

  if (!visible || cards.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          👁️ AI Found This
        </span>
        <span className="text-xs text-slate-400 font-mono">
          ({cards.length} pattern{cards.length !== 1 ? 's' : ''})
        </span>
        {cards.some(c => c.confidence >= PINK_THRESHOLD) && (
          <span className="text-xs font-bold text-pink-500 animate-pulse">
            🌸 LOCKED IN
          </span>
        )}
      </div>

      {/* Card Wall — horizontal scroll */}
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
      >
        <AnimatePresence initial={false}>
          {cards.map(card => (
            <PatternCard key={card.id} card={card} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Single Pattern Card ────────────────────────────────────────────────────────

const PatternCard: React.FC<{ card: PatternCard }> = ({ card }) => {
  const isPink = card.confidence >= PINK_THRESHOLD;
  const isOrange = card.confidence >= 0.4 && !isPink;
  const confPct = Math.round(card.confidence * 100);

  // Confidence glow color
  const glowColor = isPink ? card.accentHex : isOrange ? '#f97316' : '#eab308';

  // Abbreviated path for display (first 3 steps + depth)
  const pathShort = card.path.length > 3
    ? card.path.slice(0, 3).join('→') + `…(${card.depth})`
    : card.path.join('→');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.6, y: 20 }}
      animate={{
        opacity: 1,
        scale: card.justReinforced ? [1, 1.08, 1] : 1,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0.5, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden border-2 bg-white"
      style={{
        width: CARD_SIZE + 16,
        borderColor: card.justReinforced || isPink ? glowColor : '#e2e8f0',
        boxShadow: isPink || card.justReinforced
          ? `0 0 14px 3px ${glowColor}55`
          : '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'border-color 0.4s, box-shadow 0.4s',
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative flex items-center justify-center bg-slate-100"
        style={{ width: CARD_SIZE + 16, height: CARD_SIZE + 8 }}
      >
        {card.thumb ? (
          <img
            src={card.thumb}
            alt="canvas region"
            style={{ width: CARD_SIZE, height: CARD_SIZE, imageRendering: 'pixelated', borderRadius: 4 }}
          />
        ) : (
          // Fallback if thumb failed (tainted canvas etc.)
          <div
            style={{ width: CARD_SIZE, height: CARD_SIZE, borderRadius: 4, background: '#f1f5f9' }}
            className="flex items-center justify-center text-2xl"
          >
            🧩
          </div>
        )}

        {/* Baby identity badge — top left */}
        <div
          className="absolute top-1 left-1 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none"
          style={{ background: card.accentHex }}
        >
          {card.agentName}
        </div>

        {/* Revisit count badge — top right (only if >1) */}
        {card.visitCount > 1 && (
          <div
            className="absolute top-1 right-1 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none"
            style={{ background: glowColor }}
          >
            ×{card.visitCount}
          </div>
        )}

        {/* Pink sparkle overlay — flashes briefly when locked */}
        {isPink && (
          <motion.div
            className="absolute inset-0 rounded pointer-events-none"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{ background: `${glowColor}33` }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5 flex flex-col gap-1">
        {/* Confidence bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: glowColor }}
            initial={{ width: 0 }}
            animate={{ width: `${confPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {/* Path label — very small, for developer curiosity */}
        <span
          className="text-[8px] font-mono text-slate-400 truncate leading-none"
          title={card.path.join('→')}
        >
          {pathShort}
        </span>
      </div>
    </motion.div>
  );
};

// ── Discovery Flash Overlay ───────────────────────────────────────────────────
// Rendered directly on top of the canvas, absolutely positioned.
// The "WHOA, THERE" moment — shows the student exactly where the AI looked.

interface DiscoveryFlashOverlayProps {
  flashes: DiscoveryFlash[];
  onExpired: (id: number) => void;
}

export const DiscoveryFlashOverlay: React.FC<DiscoveryFlashOverlayProps> = ({ flashes, onExpired }) => {
  return (
    <>
      <AnimatePresence>
        {flashes.map(flash => (
          <DiscoveryFlashItem key={flash.id} flash={flash} onExpired={onExpired} />
        ))}
      </AnimatePresence>
    </>
  );
};

const DiscoveryFlashItem: React.FC<{ flash: DiscoveryFlash; onExpired: (id: number) => void }> = ({
  flash,
  onExpired,
}) => {
  useEffect(() => {
    const t = setTimeout(() => onExpired(flash.id), 2000);
    return () => clearTimeout(t);
  }, [flash.id, onExpired]);

  return (
    <motion.div
      initial={{ opacity: 0.9, scale: 1.08 }}
      animate={{ opacity: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.8, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        left: flash.bounds.x,
        top: flash.bounds.y,
        width: flash.bounds.w,
        height: flash.bounds.h,
        border: `3px solid ${flash.color}`,
        borderRadius: 6,
        background: `${flash.color}22`,
        boxShadow: `0 0 24px 8px ${flash.color}66`,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    />
  );
};
