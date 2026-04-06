import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { GameState } from '../lib/engine';

interface GameCanvasProps {
  gameState: GameState;
  xRayMode: boolean;
  isPaused: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  GameCanvas — p5.js renderer
//
//  CRITICAL: p5 is created ONCE. All props are read through refs so the
//  draw() closure never goes stale. Without this, React destroys and
//  recreates p5 every frame (60x/sec), making Blockly unusable during run.
// ─────────────────────────────────────────────────────────────────────────────
const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, xRayMode, isPaused, className }) => {
  const canvasRef     = useRef<HTMLDivElement>(null);
  const p5Instance    = useRef<p5 | null>(null);

  // Live refs — updated on every prop change, read inside draw() closure
  const gameStateRef  = useRef(gameState);
  const xRayRef       = useRef(xRayMode);
  const isPausedRef   = useRef(isPaused);

  useEffect(() => { gameStateRef.current = gameState; },  [gameState]);
  useEffect(() => { xRayRef.current      = xRayMode;  },  [xRayMode]);
  useEffect(() => { isPausedRef.current  = isPaused;  },  [isPaused]);

  // Create p5 ONCE — never destroy unless component unmounts
  useEffect(() => {
    if (!canvasRef.current) return;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(400, 400).parent(canvasRef.current!);
        p.frameRate(60);
      };

      p.draw = () => {
        const gs   = gameStateRef.current;
        const xRay = xRayRef.current;
        const paused = isPausedRef.current;

        p.background(15, 23, 42); // Slate-900

        p.push();
        // Apply Camera Offset
        p.translate(-gs.camera.x, -gs.camera.y);

        // Draw Grid if X-Ray is on
        if (xRay) {
          p.stroke(30, 41, 59);
          for (let i = -1000; i < 1400; i += 50) {
            p.line(i, -1000, i, 1400);
            p.line(-1000, i, 1400, i);
          }
        }

        // Render Sprites
        gs.sprites.forEach(sprite => {
          p.push();
          p.translate(sprite.x, sprite.y);
          p.rotate(sprite.rotation);
          p.scale(sprite.flipX ? -1 : 1, sprite.flipY ? -1 : 1);

          const c = p.color(sprite.color);
          c.setAlpha(sprite.opacity * 255);

          // Glow
          p.noStroke();
          const glowColor = p.color(sprite.color);
          glowColor.setAlpha(sprite.opacity * 50);
          p.fill(glowColor);
          if (sprite.isStatic) {
            p.rectMode(p.CENTER);
            p.rect(0, 0, sprite.size * 1.2, sprite.size * 1.2, 8);
          } else {
            p.ellipse(0, 0, sprite.size * 1.5);
          }

          p.fill(c);
          if (sprite.isStatic) {
            p.rectMode(p.CENTER);
            p.rect(0, 0, sprite.size, sprite.size, 4);
            p.noFill();
            p.stroke(255, 50);
            p.strokeWeight(2);
            p.rect(0, 0, sprite.size * 0.8, sprite.size * 0.8, 2);
          } else {
            p.ellipse(0, 0, sprite.size, sprite.size);
          }

          // X-Ray labels
          if (xRay) {
            p.fill(255);
            p.textSize(12);
            p.textAlign(p.CENTER);
            p.text(`x: ${Math.round(sprite.x)}`, 0, -sprite.size / 2 - 20);
            p.text(`y: ${Math.round(sprite.y)}`, 0, -sprite.size / 2 - 5);
            p.stroke(255, 255, 0);
            p.line(0, 0, sprite.vx * 10, sprite.vy * 10);
          }

          p.pop();
        });

        // Render Particles
        gs.particles.forEach(part => {
          p.push();
          const pc = p.color(part.color);
          pc.setAlpha(part.life * 255);
          p.fill(pc);
          p.noStroke();
          p.ellipse(part.x, part.y, part.size);
          p.pop();
        });

        // Render Texts
        gs.texts.forEach(t => {
          p.push();
          p.fill(t.color);
          p.noStroke();
          p.textSize(t.size);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(t.text, t.x, t.y);
          p.pop();
        });

        p.pop(); // End Camera

        // Screen Flash
        if (gs.flash) {
          p.push();
          const fc = p.color(gs.flash.color);
          fc.setAlpha(gs.flash.opacity * 255);
          p.fill(fc);
          p.noStroke();
          p.rect(0, 0, p.width, p.height);
          p.pop();
        }

        if (paused) {
          p.fill(0, 0, 0, 100);
          p.rect(0, 0, p.width, p.height);
          p.fill(255);
          p.textSize(32);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("PAUSED", p.width / 2, p.height / 2);
        }
      };
    };

    p5Instance.current = new p5(sketch);
    return () => { p5Instance.current?.remove(); };
  }, []); // ← Empty deps: create once, refs handle live updates

  return (
    <div className={`relative border-4 border-slate-700 rounded-xl overflow-hidden shadow-2xl bg-slate-900 ${className || ''}`}>
      <div ref={canvasRef} className="flex items-center justify-center h-full w-full" />
      {xRayMode && (
        <div className="absolute top-2 left-2 bg-blue-500/80 text-white px-2 py-1 rounded text-xs font-mono animate-pulse">
          X-RAY VISION ACTIVE
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
