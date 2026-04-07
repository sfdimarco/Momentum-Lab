// ═══════════════════════════════════════════════════════════════════════════
//  PetMode — Full-screen Baby0 Digital Pet Experience
//
//  The entire screen becomes Baby0's living canvas.
//  No chrome. No panels. Just the baby exploring, learning, and caching patterns.
//  Subtle vitals in the corners so you can peek at what the brain is doing.
//
//  This IS the experience that a parent sees on their 3rd monitor:
//  a dark, peaceful canvas with a curious digital mind exploring it.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import GEOPlayground from './GEOPlayground';
import SpatialEye from './SpatialEye';
import DrawCanvas from './DrawCanvas';
import { DiscoveryFlashOverlay, PatternBurst } from './PatternBurst';
import type { BabyAgent } from '../geoai/baby_agent';
import type { DiscoveryFlash } from './PatternBurst';
import type { PatternLockEvent, CyanPromotionEvent, GuideTarget } from './SpatialEye';
import type { StrokeResult } from '../geoai/stroke-interpreter';

interface BrainSnap {
  visualResolution: number;
  currentFocus: { path: string[]; depth: number } | null;
  frustration: number;
  energy: number;
  patternCache: any[];
  libraryCache: any[];
}

interface PetModeProps {
  active: boolean;
  onExit: () => void;
  babyBrainSnap: BrainSnap;
  baby1BrainSnap: BrainSnap;
  lastCyan0: CyanPromotionEvent | null;
  lastCyan1: CyanPromotionEvent | null;
  guideTarget0: GuideTarget | null;
  guideTarget1: GuideTarget | null;
  lastReward: { quadrant: { path: string[] }; value: number; ts: number } | null;
  last1Reward: { quadrant: { path: string[] }; value: number; ts: number } | null;
  lastLock0: PatternLockEvent | null;
  lastLock1: PatternLockEvent | null;
  discoveryFlashes: DiscoveryFlash[];
  onFlashExpired: (id: number) => void;
  lastStroke: StrokeResult | null;
  babyAgent: BabyAgent;
  baby1Agent: BabyAgent;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

const PetMode: React.FC<PetModeProps> = ({
  active,
  onExit,
  babyBrainSnap,
  baby1BrainSnap,
  lastCyan0,
  lastCyan1,
  guideTarget0,
  guideTarget1,
  lastReward,
  last1Reward,
  lastLock0,
  lastLock1,
  discoveryFlashes,
  onFlashExpired,
  lastStroke,
  babyAgent,
  baby1Agent,
  onCanvasReady,
}) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onExit]);

  if (!active) return null;

  // RainbowBrain synesthetic colors: TL=red, TR=blue, BL=yellow, BR=green
  const quadrantColors = {
    'TL': '#ef4444', // red
    'TR': '#3b82f6', // blue
    'BL': '#eab308', // yellow
    'BR': '#22c55e', // green
  };

  return (
    <div
      className="fixed inset-0 bg-[rgb(6,8,12)] z-[300] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'rgb(6, 8, 12)' }}
    >
      {/* Canvas container */}
      <div ref={canvasContainerRef} style={{ position: 'relative', display: 'inline-block' }}>
        {/* GEOPlayground — the living brain canvas */}
        <GEOPlayground
          width={400}
          height={400}
          agent={babyAgent}
          agent2={baby1Agent}
          brain={babyBrainSnap}
          brain2={baby1BrainSnap}
          lastCyanPromotion={lastCyan0 ?? lastCyan1}
          guideTarget={guideTarget0 ?? guideTarget1}
          onCanvasReady={onCanvasReady}
        />

        {/* SpatialEye overlays — both babies watching */}
        <SpatialEye
          agent={babyAgent}
          brainSnap={babyBrainSnap}
          lastCyanPromotion={lastCyan0}
          lastReward={lastReward}
          lastLock={lastLock0}
          guideTarget={guideTarget0}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
        />

        {baby1Agent && (
          <SpatialEye
            agent={baby1Agent}
            brainSnap={baby1BrainSnap}
            lastCyanPromotion={lastCyan1}
            lastReward={last1Reward}
            lastLock={lastLock1}
            guideTarget={guideTarget1}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
          />
        )}

        {/* DrawCanvas — human strokes feed the baby */}
        <DrawCanvas
          width={400}
          height={400}
          active={true}
          agent={babyAgent}
          agent2={baby1Agent}
          libraryCache={babyBrainSnap.libraryCache}
          onStroke={() => {}}
        />

        {/* Discovery flashes */}
        <DiscoveryFlashOverlay
          flashes={discoveryFlashes}
          onFlashExpired={onFlashExpired}
          canvasContainer={canvasContainerRef.current}
        />

        {/* Pattern bursts */}
        <PatternBurst
          agents={[
            { agent: babyAgent, name: 'baby_0', color: 'cyan' as const, accentHex: '#06b6d4' },
            ...(baby1Agent ? [{ agent: baby1Agent, name: 'baby_1', color: 'pink' as const, accentHex: '#ec4899' }] : []),
          ]}
          canvasContainerRef={canvasContainerRef}
          onFlash={() => {}}
          visible={true}
        />
      </div>

      {/* Bottom-left vitals strip */}
      <div className="fixed bottom-6 left-6 text-slate-400 text-xs monospace space-y-1 bg-black/40 p-3 rounded-lg backdrop-blur-sm border border-slate-700/50">
        {/* Baby 0 vitals */}
        <div className="text-slate-300 font-mono text-[11px]">
          <span className="text-cyan-400">🧠 baby_0:</span>
          <span className="ml-2">
            {babyBrainSnap.visualResolution}x{babyBrainSnap.visualResolution} grid |
          </span>
          <span className="ml-1">✨ {babyBrainSnap.patternCache.length}</span>
          <span className="ml-1">📚 {babyBrainSnap.libraryCache.length}</span>
        </div>

        {/* Energy bar for baby_0 */}
        <div className="text-slate-400 text-[10px]">
          ⚡
          <div className="inline-block w-20 h-2 bg-slate-700 rounded-full ml-1 align-middle relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, babyBrainSnap.energy * 100))}%` }}
            />
          </div>
        </div>

        {/* Current focus path */}
        {babyBrainSnap.currentFocus && (
          <div className="text-[10px]">
            Current:
            {babyBrainSnap.currentFocus.path.slice(-3).map((step, i) => (
              <span
                key={i}
                style={{
                  color: quadrantColors[step as keyof typeof quadrantColors] || '#64748b',
                  marginLeft: '2px',
                }}
              >
                ●
              </span>
            ))}
          </div>
        )}

        {/* Frustration indicator */}
        {babyBrainSnap.frustration > 0 && (
          <div className="text-amber-400 text-[10px]">
            😤 frustration: {babyBrainSnap.frustration.toFixed(2)}
          </div>
        )}

        {/* Baby 1 vitals if active */}
        {baby1Agent && (
          <>
            <div className="border-t border-slate-700/50 pt-1 mt-1" />
            <div className="text-slate-300 font-mono text-[11px]">
              <span className="text-pink-400">🧬 baby_1:</span>
              <span className="ml-2">
                {baby1BrainSnap.visualResolution}x{baby1BrainSnap.visualResolution} grid |
              </span>
              <span className="ml-1">✨ {baby1BrainSnap.patternCache.length}</span>
              <span className="ml-1">📚 {baby1BrainSnap.libraryCache.length}</span>
            </div>

            {/* Energy bar for baby_1 */}
            <div className="text-slate-400 text-[10px]">
              ⚡
              <div className="inline-block w-20 h-2 bg-slate-700 rounded-full ml-1 align-middle relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-pink-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, baby1BrainSnap.energy * 100))}%` }}
                />
              </div>
            </div>

            {baby1BrainSnap.frustration > 0 && (
              <div className="text-amber-400 text-[10px]">
                😤 frustration: {baby1BrainSnap.frustration.toFixed(2)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Top-right agent status indicators */}
      <div className="fixed top-6 right-6 space-y-2">
        {/* Baby 0 active indicator */}
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <div
            className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
            style={{
              boxShadow: '0 0 8px rgba(6, 182, 212, 0.6)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
          <span>🧠 baby_0</span>
        </div>

        {/* Baby 1 active indicator */}
        {baby1Agent && (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <div
              className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"
              style={{
                boxShadow: '0 0 8px rgba(236, 72, 153, 0.6)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span>🧬 baby_1</span>
          </div>
        )}
      </div>

      {/* Close button (subtle X top-left) */}
      <button
        onClick={onExit}
        className="fixed top-6 left-6 p-2 text-slate-500 hover:text-slate-300 transition-colors"
        title="Exit Pet Mode (Esc)"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="4" y1="4" x2="16" y2="16" />
          <line x1="16" y1="4" x2="4" y2="16" />
        </svg>
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PetMode;
