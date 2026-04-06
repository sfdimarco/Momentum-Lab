// ═══════════════════════════════════════════════════════════════════════════
//  SPATIAL EYE — Visual Brain of baby_0
//
//  Makes the invisible quadtree mind of baby_0 VISIBLE.
//  Renders a living overlay that shows:
//  - The quadtree grid at current resolution
//  - Entropy hotspots (where baby looks first)
//  - Current focus with pulsing attention ring
//  - Reward flashes with expanding rings
//  - Pattern cache glowing softly
//  - Energy and frustration status
//
//  Colors are SYNESTHETIC (non-negotiable):
//  #00ffff cyan — unexplored regions
//  #3b82f6 blue — actively exploring
//  #eab308 yellow — high entropy / curiosity hotspot
//  #22c55e green — reward firing
//  #f97316 orange — pattern emerging
//  #ec4899 pink — stable known pattern
//  #ffffff white — current focus
//  #ff3333 red — frustration
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';

interface SpatialEyeProps {
  visible: boolean;
  width: number;
  height: number;
  label?: string;   // agent name shown in HUD (default: 'baby_0')
  brain: {
    visualResolution: number;
    currentFocus: { depth: number; path: string[] } | null;
    frustration: number;
    energy: number;
    patternCache: Array<{ geoAddress: { depth: number; path: string[] }; confidence: number }>;
  };
  lastReward: { quadrant: { depth: number; path: string[] }; value: number } | null;
  quadrantEntropy: Map<string, number>;
}

// Synesthetic color palette
const COLORS = {
  cyan: '#00ffff',      // unexplored
  blue: '#3b82f6',      // actively exploring
  yellow: '#eab308',    // high entropy
  green: '#22c55e',     // reward
  orange: '#f97316',    // pattern emerging
  pink: '#ec4899',      // stable pattern
  white: '#ffffff',     // focus
  red: '#ff3333',       // frustration
};

const SpatialEye: React.FC<SpatialEyeProps> = ({
  visible,
  width,
  height,
  label = 'baby_0',
  brain,
  lastReward,
  quadrantEntropy,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastRewardTimeRef = useRef<number | null>(null);
  const resolutionChangeTimeRef = useRef<number | null>(null);
  const prevResolutionRef = useRef<number>(brain.visualResolution);

  // Refs for animation loop to avoid stale closures
  const brainRef = useRef(brain);
  const lastRewardRef = useRef(lastReward);
  const quadrantEntropyRef = useRef(quadrantEntropy);
  const visibleRef = useRef(visible);
  const labelRef = useRef(label);

  useEffect(() => {
    brainRef.current = brain;
  }, [brain]);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  useEffect(() => {
    lastRewardRef.current = lastReward;
    if (lastReward) {
      lastRewardTimeRef.current = Date.now();
    }
  }, [lastReward]);

  useEffect(() => {
    quadrantEntropyRef.current = quadrantEntropy;
  }, [quadrantEntropy]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Detect resolution changes
  useEffect(() => {
    if (brain.visualResolution !== prevResolutionRef.current) {
      resolutionChangeTimeRef.current = Date.now();
      prevResolutionRef.current = brain.visualResolution;
    }
  }, [brain.visualResolution]);

  // Helper: Get rect of a quadrant at given path
  const getQuadrantRect = (
    path: string[],
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number; w: number; h: number } => {
    let x = 0,
      y = 0,
      w = canvasWidth,
      h = canvasHeight;

    for (const dir of path) {
      const halfW = w / 2;
      const halfH = h / 2;
      if (dir === 'TL' || dir === '0') {
        // top-left: no change
      } else if (dir === 'TR' || dir === '1') {
        x += halfW;
      } else if (dir === 'BR' || dir === '2') {
        x += halfW;
        y += halfH;
      } else if (dir === 'BL' || dir === '3') {
        y += halfH;
      }
      w = halfW;
      h = halfH;
    }
    return { x, y, w, h };
  };

  // Helper: Get all quadrants at a given depth
  const getAllQuadrantPaths = (depth: number): string[][] => {
    if (depth < 1) return [[]];
    const paths: string[][] = [];
    const directions = ['TL', 'TR', 'BR', 'BL'];

    const generate = (current: string[]) => {
      if (current.length === depth) {
        paths.push([...current]);
        return;
      }
      for (const dir of directions) {
        generate([...current, dir]);
      }
    };

    generate([]);
    return paths;
  };

  // Helper: Convert path array to string key for entropy map
  const pathToKey = (depth: number, path: string[]): string => {
    return `d${depth}_${path.join('_')}`;
  };

  // Main animation loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!visibleRef.current) {
        frameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      // Clear canvas (must use clearRect — fillRect with rgba(0,0,0,0) does nothing)
      ctx.clearRect(0, 0, width, height);

      // Get current brain state from refs
      const curBrain = brainRef.current;
      const curReward = lastRewardRef.current;
      const curEntropy = quadrantEntropyRef.current;

      // ── 1. QUADRANT GRID ───────────────────────────────────────────
      const allPaths = getAllQuadrantPaths(curBrain.visualResolution);
      const entropyValues = Array.from(curEntropy.values()) as number[];
      const maxEntropy = entropyValues.length > 0 ? Math.max(...entropyValues) : 1;
      const entropy25thPercentile =
        entropyValues.length > 0 ? entropyValues.sort((a: number, b: number) => b - a)[Math.floor(entropyValues.length * 0.25)] : 0.5;

      for (const path of allPaths) {
        const rect = getQuadrantRect(path, width, height);
        const key = pathToKey(curBrain.visualResolution, path);
        const entropy = curEntropy.get(key) || 0;

        // Determine color based on state
        let fillColor = COLORS.cyan;
        let strokeColor = COLORS.cyan;

        // Check if this quadrant has a cached pattern
        const cachedPattern = curBrain.patternCache.find(
          (p) =>
            p.geoAddress.depth === curBrain.visualResolution &&
            JSON.stringify(p.geoAddress.path) === JSON.stringify(path)
        );

        if (cachedPattern && cachedPattern.confidence > 0.7) {
          fillColor = COLORS.pink;
          strokeColor = COLORS.pink;
        } else if (
          curBrain.currentFocus &&
          curBrain.currentFocus.depth === curBrain.visualResolution &&
          JSON.stringify(curBrain.currentFocus.path) === JSON.stringify(path)
        ) {
          fillColor = COLORS.white;
          strokeColor = COLORS.white;
        } else if (entropy > entropy25thPercentile) {
          fillColor = COLORS.yellow;
          strokeColor = COLORS.yellow;
        } else if (entropy > 0.1) {
          fillColor = COLORS.blue;
          strokeColor = COLORS.blue;
        }

        // Draw fill
        ctx.fillStyle = fillColor + '26'; // ~0.15 opacity
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

        // Draw stroke
        ctx.strokeStyle = fillColor + '99'; // ~0.6 opacity
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }

      // ── 2. CURRENT FOCUS PULSE ───────────────────────────────────────
      if (curBrain.currentFocus) {
        const focusRect = getQuadrantRect(
          curBrain.currentFocus.path,
          width,
          height
        );
        const centerX = focusRect.x + focusRect.w / 2;
        const centerY = focusRect.y + focusRect.h / 2;

        // Pulsing ring
        const pulseT = (elapsed * 0.004) % (Math.PI * 2);
        const pulseRadius = 8 + (Math.sin(pulseT) + 1) * 6; // 8 to 20

        ctx.strokeStyle = COLORS.white + 'cc'; // ~0.8 opacity
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── 3. REWARD FLASH ────────────────────────────────────────────
      if (curReward && lastRewardTimeRef.current !== null) {
        const rewardAge = now - lastRewardTimeRef.current;
        const rewardDuration = 1500; // 1.5 seconds

        if (rewardAge < rewardDuration) {
          const rewardProgress = rewardAge / rewardDuration;
          const rewardAlpha = 1 - rewardProgress;

          const rewardRect = getQuadrantRect(curReward.quadrant.path, width, height);
          const centerX = rewardRect.x + rewardRect.w / 2;
          const centerY = rewardRect.y + rewardRect.h / 2;

          // Green fill over quadrant
          ctx.fillStyle = COLORS.green + Math.floor(rewardAlpha * 255).toString(16).padStart(2, '0');
          ctx.fillRect(rewardRect.x, rewardRect.y, rewardRect.w, rewardRect.h);

          // Expanding ring
          const expandRadius = 15 + rewardProgress * 60;
          ctx.strokeStyle = COLORS.green + Math.floor(rewardAlpha * 200).toString(16).padStart(2, '0');
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, expandRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // ── 4. PATTERN CACHE DOTS ──────────────────────────────────────
      for (const pattern of curBrain.patternCache) {
        if (pattern.geoAddress.depth === curBrain.visualResolution) {
          const patternRect = getQuadrantRect(
            pattern.geoAddress.path,
            width,
            height
          );
          const centerX = patternRect.x + patternRect.w / 2;
          const centerY = patternRect.y + patternRect.h / 2;

          // Determine color by confidence
          let dotColor = COLORS.yellow;
          if (pattern.confidence > 0.7) {
            dotColor = COLORS.pink;
          } else if (pattern.confidence > 0.4) {
            dotColor = COLORS.orange;
          }

          // Glow shadow
          ctx.shadowColor = dotColor + '99';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          ctx.fillStyle = dotColor;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowColor = 'transparent';
        }
      }

      // ── 5. ENERGY/FRUSTRATION STATUS BAR ────────────────────────────
      const hudX = 12;
      const hudY = height - 28;

      // Energy bar
      const energyBarWidth = 80;
      const energyBarHeight = 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(hudX, hudY, energyBarWidth, energyBarHeight);

      const energyColor =
        curBrain.energy > 0.6
          ? COLORS.green
          : curBrain.energy > 0.3
            ? COLORS.orange
            : COLORS.red;
      ctx.fillStyle = energyColor;
      ctx.fillRect(hudX, hudY, energyBarWidth * curBrain.energy, energyBarHeight);

      // Frustration dots
      const maxFrustrationDots = 5;
      const dotsToDraw = Math.min(Math.ceil(curBrain.frustration / 3), maxFrustrationDots);
      for (let i = 0; i < dotsToDraw; i++) {
        ctx.fillStyle = COLORS.red + '99'; // ~0.6 opacity
        ctx.beginPath();
        ctx.arc(hudX + energyBarWidth + 12 + i * 6, hudY + 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Text HUD
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const ageStr = Math.floor(curBrain.patternCache.length);
      const resStr = Math.pow(2, curBrain.visualResolution);
      ctx.fillText(
        `${labelRef.current} | age: ${ageStr} | res: ${resStr}x${resStr}`,
        hudX,
        hudY + 16
      );

      // ── 6. RESOLUTION LABEL ────────────────────────────────────────
      if (resolutionChangeTimeRef.current !== null) {
        const changeAge = now - resolutionChangeTimeRef.current;
        const changeDuration = 2000;

        if (changeAge < changeDuration) {
          const changeProgress = changeAge / changeDuration;
          const changeAlpha = 1 - changeProgress;
          const resolutionSize = Math.pow(2, curBrain.visualResolution);

          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = `rgba(255, 255, 255, ${changeAlpha * 0.8})`;
          ctx.textAlign = 'center';
          ctx.fillText(`👁️ Resolution ${resolutionSize}x${resolutionSize}`, width / 2, height / 2);
          ctx.textAlign = 'left';
        }
      }

      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 10,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    />
  );
};

export default SpatialEye;
