import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Zap, Eye, History, RotateCcw, Info, Bot, Sparkles, Download, Upload, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BlocklyEditor from './components/BlocklyEditor';
import GameCanvas from './components/GameCanvas';
import TutorAssistant from './components/TutorAssistant';
import { MomentumEngine, GameState } from './lib/engine';
import * as Blockly from 'blockly';
import SynestheticLayer from './components/SynestheticLayer';
import SpatialEye from './components/SpatialEye';
import type { PatternLockEvent, CyanPromotionEvent, GuideTarget } from './components/SpatialEye';
import { PatternBurst, DiscoveryFlashOverlay } from './components/PatternBurst';
import type { DiscoveryFlash } from './components/PatternBurst';
import { syncFromGameState, resetSpatialState } from './lib/spatial-state';
import { babyAgent, baby1Agent, BabyAgentEvent } from './geoai/baby_agent';
import type { SpatialPattern } from './geoai/parser';
import LibraryPanel from './components/LibraryPanel';
import DrawCanvas from './components/DrawCanvas';
import StrokeHUD from './components/StrokeHUD';
import type { StrokeResult } from './geoai/stroke-interpreter';
import GEOPlayground from './components/GEOPlayground';
import { sketchToGEO, fileToBase64 } from './geoai/sketch-interpreter';
import type { SketchGEOResult } from './geoai/sketch-interpreter';
import DogBabyMode from './components/DogBabyMode';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [xRayMode, setXRayMode] = useState(false);
  const [scrubValue, setScrubValue] = useState(100);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [workspaceXml, setWorkspaceXml] = useState('');
  const [isCanvasFullScreen, setIsCanvasFullScreen] = useState(false);
  
  const engineRef = useRef(new MomentumEngine());
  const [synestheticMode, setSynestheticMode] = useState(true); // Pillar 2 toggle
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  // Ref so handleWorkspaceChange (callback) can read current running state without stale closure
  const isRunningRef = useRef(false);

  // ── baby_0 state ──────────────────────────────────────────────────────────
  // Always-on: cache IS the cognitive loop. Learning starts at birth.
  const [babyMode, setBabyMode] = useState(true);
  const [wildMode, setWildMode] = useState(false);
  const [babyBrainSnap, setBabyBrainSnap] = useState({
    visualResolution: 2,
    currentFocus: null as { depth: number; path: string[] } | null,
    frustration: 0,
    energy: 1.0,
    patternCache: [] as SpatialPattern[],
    libraryCache: [] as Array<{ address: string[]; depth: number; loopFamily: string }>,
  });
  const [lastReward, setLastReward] = useState<{
    quadrant: { depth: number; path: string[] };
    value: number;
    ts: number;
  } | null>(null);

  // ── baby_1 state ──────────────────────────────────────────────────────────
  const [baby1Mode, setBaby1Mode] = useState(true);
  const [wild1Mode, setWild1Mode] = useState(false);
  const [baby1BrainSnap, setBaby1BrainSnap] = useState({
    visualResolution: 2,
    currentFocus: null as { depth: number; path: string[] } | null,
    frustration: 0,
    energy: 1.0,
    patternCache: [] as SpatialPattern[],
    libraryCache: [] as Array<{ address: string[]; depth: number; loopFamily: string }>,
  });
  const [last1Reward, setLast1Reward] = useState<{
    quadrant: { depth: number; path: string[] };
    value: number;
    ts: number;
  } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // ── Dog/Baby Mode — universal GEO player interface ────────────────────────
  const [dogBabyMode, setDogBabyMode] = useState(false);

  // ── Draw Mode — shared tactile canvas ────────────────────────────────────
  const [drawMode, setDrawMode] = useState(false);
  const [lastStroke, setLastStroke] = useState<StrokeResult | null>(null);
  const [livePath, setLivePath] = useState<string[]>([]);

  const handleStroke = React.useCallback((result: StrokeResult) => {
    setLastStroke(result);
    setLivePath([]);
    console.log(
      `[draw] ✏️ Stroke → ${result.family} | [${result.path.join('→')}]`,
      result.codeHint ? `| "${result.codeHint}"` : '| no match yet'
    );
  }, []);

  const handleStrokeUpdate = React.useCallback((path: string[], quadrant: string) => {
    setLivePath([...path]);
  }, []);

  // ── GEOPlayground canvas ready — point both babies at it ─────────────────
  // When GEOPlayground mounts its p5 canvas, we give both agents eyes immediately.
  // No polling delay needed — onCanvasReady fires synchronously after p5.setup().
  const handleGEOCanvasReady = React.useCallback((canvas: HTMLCanvasElement) => {
    babyAgent.setCanvas(canvas);
    baby1Agent.setCanvas(canvas);
    console.log('[geoai] 👁️ Both babies now watching the GEO playground canvas');
  }, []);

  // ── Sketch Upload — "Human sings, Baby codes" pipeline ───────────────────
  const [sketchResult, setSketchResult] = useState<SketchGEOResult | null>(null);
  const [sketchInterpreting, setSketchInterpreting] = useState(false);
  const sketchResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSketchUpload = React.useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file: File = e.target.files?.[0];
      if (!file) return;
      setSketchInterpreting(true);
      setSketchResult(null);
      try {
        const { base64, mimeType } = await fileToBase64(file);
        // Gather library from both agents for matching
        const lib0 = babyAgent.getLibraryCache().map(entry => ({
          id: entry.address.join('_'),
          address: entry.address,
          loopFamily: entry.loopFamily,
          codeHint: entry.codeHint ?? null,
        }));
        const lib1 = baby1Agent.getLibraryCache().map(entry => ({
          id: entry.address.join('_') + '_b1',
          address: entry.address,
          loopFamily: entry.loopFamily,
          codeHint: entry.codeHint ?? null,
        }));
        const combinedLib = [...lib0, ...lib1];
        const result = await sketchToGEO(base64, mimeType, combinedLib);
        setSketchResult(result);

        // Inject into baby_0 first, then baby_1
        const match0 = babyAgent.injectPattern(result.path, 'sketch');
        const match1 = baby1Agent.injectPattern(result.path, 'sketch');
        const matched = match0 ?? match1;

        console.log(
          `[sketch] 🎨 Interpreted → ${result.family} [${result.path.join('→')}] conf=${result.confidence.toFixed(2)}`,
          matched ? `| 🔥 Library match: "${matched.codeHint}"` : '| No match yet — seeded'
        );

        // Auto-clear the result overlay after 6 seconds
        if (sketchResultTimerRef.current) clearTimeout(sketchResultTimerRef.current);
        sketchResultTimerRef.current = setTimeout(() => setSketchResult(null), 6000);
      } catch (err) {
        console.error('[sketch] Pipeline error:', err);
      } finally {
        setSketchInterpreting(false);
      }
    };
    input.click();
  }, []);

  // ── Pattern Burst (bidirectional student-AI loop) ─────────────────────────
  const [discoveryFlashes, setDiscoveryFlashes] = useState<DiscoveryFlash[]>([]);
  const [lastLock0, setLastLock0] = useState<PatternLockEvent | null>(null);
  const [lastLock1, setLastLock1] = useState<PatternLockEvent | null>(null);
  // Phase A: Cyan State — Librarian promotion events
  const [lastCyan0, setLastCyan0] = useState<CyanPromotionEvent | null>(null);
  const [lastCyan1, setLastCyan1] = useState<CyanPromotionEvent | null>(null);
  // Phase C: Guide Mode — set when baby frustration ≥ 10 AND library has entries
  const [guideTarget0, setGuideTarget0] = useState<GuideTarget | null>(null);
  const [guideTarget1, setGuideTarget1] = useState<GuideTarget | null>(null);

  const handleFlash = React.useCallback((flash: DiscoveryFlash) => {
    setDiscoveryFlashes(prev => [...prev, flash]);
  }, []);

  const handleFlashExpired = React.useCallback((id: number) => {
    setDiscoveryFlashes(prev => prev.filter(f => f.id !== id));
  }, []);

  const downloadProject = () => {
    if (!workspaceRef.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    const blob = new Blob([xmlText], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'momentum-project.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re: any) => {
        const xmlText = re.target.result;
        if (workspaceRef.current) {
          workspaceRef.current.clear();
          const xml = Blockly.utils.xml.textToDom(xmlText);
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const logicRef = useRef<any>({ 
    bounce: false, 
    gravity: 0,
    friction: 0,
    appearance: null, 
    collide: false, 
    collisionActions: [],
    movements: [], 
    texts: [],
    cameraFollowId: null,
    tickActions: [],
    startActions: [],
    keyActions: {} 
  });
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    setGameState(engineRef.current.getState());
  }, []);

  // ── baby_0 lifecycle ─────────────────────────────────────────────────────
  // wildMode is a dep so that if both buttons are clicked together (batched
  // state update), this effect re-runs and calls enable/disableWildMode
  // in the same pass — avoiding the "interval killed by cleanup" race.
  useEffect(() => {
    if (!babyMode) {
      babyAgent.stop();
      return;
    }
    // Give the baby eyes — find the p5 canvas inside the container
    const findCanvas = () => {
      if (!canvasContainerRef.current) return;
      const c = canvasContainerRef.current.querySelector('canvas');
      if (c) babyAgent.setCanvas(c);
    };
    findCanvas();
    // Also try after a brief delay in case p5 hasn't mounted yet
    const t = setTimeout(findCanvas, 500);

    // Subscribe to agent events → update React state for SpatialEye
    const unsub = babyAgent.on((event: BabyAgentEvent) => {
      const b = babyAgent.getBrain();
      if (event.type === 'reward_fired') {
        setLastReward({ quadrant: event.quadrant as any, value: event.value, ts: Date.now() });
        // Reward clears Guide Mode — the baby found something on its own
        setGuideTarget0(null);
      }
      // Track pattern lock for SpatialEye starburst
      if (event.type === 'pattern_reinforced') {
        const { pattern, prevConfidence } = event;
        if (prevConfidence < 0.7 && pattern.confidence >= 0.7 && pattern.geoAddress?.path) {
          setLastLock0({ path: pattern.geoAddress.path, depth: pattern.geoAddress.depth, ts: Date.now() });
        }
      }
      // Phase A: Cyan State — Librarian promotion event
      if (event.type === 'cyan_promoted') {
        setLastCyan0({
          path: event.entry.address,
          depth: event.entry.depth,
          loopFamily: event.entry.loopFamily,
          codeHint: event.entry.codeHint,
          ts: Date.now(),
        });
      }
      // Phase B: Hint Evolution — force libraryCache re-render when a hint matures
      if (event.type === 'hint_evolved') {
        // libraryCache is already mutated in-place by the agent;
        // we trigger a brainSnap update by spreading the current cache.
        setBabyBrainSnap(prev => ({
          ...prev,
          libraryCache: [...babyAgent.getLibraryCache()],
        }));
      }
      // Phase C: Guide Mode — Librarian draws a path toward the nearest beacon
      if (event.type === 'guide_available') {
        setGuideTarget0({
          fromPath: event.fromPath,
          toPath: event.toEntry.address,
          family: event.toEntry.loopFamily,
          similarity: event.similarity,
        });
      }
      // Rest clears guide — baby is resting, guide no longer needed
      if (event.type === 'rest_start') {
        setGuideTarget0(null);
      }
      setBabyBrainSnap({
        visualResolution: b.visualResolution,
        currentFocus: b.currentFocus as any,
        frustration: b.frustration,
        energy: b.energy,
        patternCache: [...b.patternCache],
        libraryCache: [...b.libraryCache],
      });
    });

    // Start (or re-sync wild state) atomically
    if (wildMode) {
      babyAgent.enableWildMode();
    } else {
      babyAgent.start();
    }
    console.log(`[baby_0] 👁️ Watching. wild=${wildMode}`);

    return () => {
      clearTimeout(t);
      unsub();
      // Only fully stop when babyMode goes false — don't stop on wildMode toggle
      if (!babyMode) babyAgent.stop();
    };
  }, [babyMode, wildMode]);

  // Wild mode is handled inside the babyMode/baby1Mode effects (deps include
  // wildMode and wild1Mode) — no separate effect needed. The unified effects
  // call enable/disableWildMode atomically on every state change.

  // ── baby_1 lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!baby1Mode) {
      baby1Agent.stop();
      return;
    }
    const findCanvas = () => {
      if (!canvasContainerRef.current) return;
      const c = canvasContainerRef.current.querySelector('canvas');
      if (c) baby1Agent.setCanvas(c);
    };
    findCanvas();
    const t = setTimeout(findCanvas, 500);

    const unsub = baby1Agent.on((event: BabyAgentEvent) => {
      const b = baby1Agent.getBrain();
      if (event.type === 'reward_fired') {
        setLast1Reward({ quadrant: event.quadrant as any, value: event.value, ts: Date.now() });
        setGuideTarget1(null);
      }
      // Track pattern lock for SpatialEye starburst
      if (event.type === 'pattern_reinforced') {
        const { pattern, prevConfidence } = event;
        if (prevConfidence < 0.7 && pattern.confidence >= 0.7 && pattern.geoAddress?.path) {
          setLastLock1({ path: pattern.geoAddress.path, depth: pattern.geoAddress.depth, ts: Date.now() });
        }
      }
      // Phase A: Cyan State — Librarian promotion event
      if (event.type === 'cyan_promoted') {
        setLastCyan1({
          path: event.entry.address,
          depth: event.entry.depth,
          loopFamily: event.entry.loopFamily,
          codeHint: event.entry.codeHint,
          ts: Date.now(),
        });
      }
      // Phase B: Hint Evolution — force libraryCache re-render for baby_1
      if (event.type === 'hint_evolved') {
        setBaby1BrainSnap(prev => ({
          ...prev,
          libraryCache: [...baby1Agent.getLibraryCache()],
        }));
      }
      // Phase C: Guide Mode
      if (event.type === 'guide_available') {
        setGuideTarget1({
          fromPath: event.fromPath,
          toPath: event.toEntry.address,
          family: event.toEntry.loopFamily,
          similarity: event.similarity,
        });
      }
      if (event.type === 'rest_start') {
        setGuideTarget1(null);
      }
      setBaby1BrainSnap({
        visualResolution: b.visualResolution,
        currentFocus: b.currentFocus as any,
        frustration: b.frustration,
        energy: b.energy,
        patternCache: [...b.patternCache],
        libraryCache: [...b.libraryCache],
      });
    });

    if (wild1Mode) {
      baby1Agent.enableWildMode();
    } else {
      baby1Agent.start();
    }
    console.log(`[baby_1] 🧬 Divergent explorer awakened. wild=${wild1Mode}`);

    return () => {
      clearTimeout(t);
      unsub();
      if (!baby1Mode) baby1Agent.stop();
    };
  }, [baby1Mode, wild1Mode]);

  useEffect(() => {
    let interval: any;
    if (isRunning && !isScrubbing) {
      interval = setInterval(() => {
        engineRef.current.update({ 
          ...logicRef.current, 
          keysPressed: keysPressed.current 
        });
        const state = engineRef.current.getState();
        setGameState({ ...state });
        // Sync to spatial buffer (feeds SynestheticLayer every frame)
        syncFromGameState(
          state.sprites,
          { gravity: logicRef.current.gravity ?? 0,
            bounce:  logicRef.current.bounce  ?? 0,
            friction:logicRef.current.friction ?? 0 },
          400, 400, 1/60
        );
      }, 1000 / 60);
    }
    return () => clearInterval(interval);
  }, [isRunning, isScrubbing]);

  const handleWorkspaceChange = (workspace: Blockly.WorkspaceSvg) => {
    workspaceRef.current = workspace;
    
    // Update XML for tutor
    const xml = Blockly.Xml.workspaceToDom(workspace);
    const xmlText = Blockly.Xml.domToPrettyText(xml);
    setWorkspaceXml(xmlText);

    // Extract logic from blocks
    const allBlocks = workspace.getAllBlocks(false);
    
    // Recursive block stack processor
    const serializeExpression = (block: Blockly.Block | null): any => {
      if (!block) return 0;
      
      if (block.type === 'math_number') {
        return Number(block.getFieldValue('NUM'));
      }
      if (block.type === 'logic_boolean') {
        return block.getFieldValue('BOOL') === 'TRUE';
      }
      if (block.type === 'math_arithmetic') {
        return {
          type: 'math_arithmetic',
          a: serializeExpression(block.getInputTargetBlock('A')),
          b: serializeExpression(block.getInputTargetBlock('B')),
          op: block.getFieldValue('OP')
        };
      }
      if (block.type === 'math_single') {
        return {
          type: 'math_single',
          op: block.getFieldValue('OP'),
          num: serializeExpression(block.getInputTargetBlock('NUM'))
        };
      }
      if (block.type === 'math_trig') {
        return {
          type: 'math_trig',
          op: block.getFieldValue('OP'),
          num: serializeExpression(block.getInputTargetBlock('NUM'))
        };
      }
      if (block.type === 'math_constant_custom') {
        return { type: 'math_constant', constant: block.getFieldValue('CONSTANT') };
      }
      if (block.type === 'math_round') {
        return {
          type: 'math_round',
          op: block.getFieldValue('OP'),
          num: serializeExpression(block.getInputTargetBlock('NUM'))
        };
      }
      if (block.type === 'math_modulo') {
        return {
          type: 'math_modulo',
          dividend: serializeExpression(block.getInputTargetBlock('DIVIDEND')),
          divisor: serializeExpression(block.getInputTargetBlock('DIVISOR'))
        };
      }
      if (block.type === 'math_random_int') {
        return {
          type: 'math_random_int',
          from: serializeExpression(block.getInputTargetBlock('FROM')),
          to: serializeExpression(block.getInputTargetBlock('TO'))
        };
      }
      if (block.type === 'logic_compare') {
        return {
          type: 'logic_compare',
          a: serializeExpression(block.getInputTargetBlock('A')),
          b: serializeExpression(block.getInputTargetBlock('B')),
          op: block.getFieldValue('OP')
        };
      }
      if (block.type === 'logic_operation') {
        return {
          type: 'logic_operation',
          a: serializeExpression(block.getInputTargetBlock('A')),
          b: serializeExpression(block.getInputTargetBlock('B')),
          op: block.getFieldValue('OP')
        };
      }
      if (block.type === 'is_key_pressed') {
        return { type: 'is_key_pressed', key: block.getFieldValue('KEY') };
      }
      if (block.type === 'get_sprite_property') {
        return {
          type: 'get_sprite_property',
          spriteId: Number(block.getFieldValue('SPRITE_ID')),
          property: block.getFieldValue('PROPERTY')
        };
      }
      if (block.type === 'current_frame') {
        return { type: 'current_frame' };
      }
      if (block.type === 'sprite_id') {
        return { type: 'sprite_id' };
      }
      if (block.type === 'db_get') {
        return { 
          type: 'db_get',
          key: block.getFieldValue('KEY')
        };
      }
      if (block.type === 'get_variable') {
        return { 
          type: 'get_variable',
          var: block.getFieldValue('VAR')
        };
      }
      
      return 0;
    };

    const processBlockStack = (startBlock: Blockly.Block | null): any[] => {
      const actions: any[] = [];
      let current = startBlock;
      
      while (current) {
        if (current.type === 'move_sprite') {
          actions.push({ 
            type: 'move', 
            direction: current.getFieldValue('DIRECTION'), 
            steps: serializeExpression(current.getInputTargetBlock('STEPS')) 
          });
        } else if (current.type === 'rotate_sprite') {
          actions.push({ 
            type: 'rotate', 
            angle: serializeExpression(current.getInputTargetBlock('ANGLE')) 
          });
        } else if (current.type === 'flip_sprite') {
          actions.push({ 
            type: 'flip', 
            axis: current.getFieldValue('AXIS') 
          });
        } else if (current.type === 'change_appearance') {
          actions.push({ 
            type: 'appearance', 
            color: current.getFieldValue('COLOR'), 
            size: serializeExpression(current.getInputTargetBlock('SIZE')), 
            effect: current.getFieldValue('EFFECT') 
          });
        } else if (current.type === 'print_text') {
          // Simple "Hello World" block — centered, no config needed
          actions.push({
            type: 'text',
            text: current.getFieldValue('TEXT'),
            x: 200, y: 200, size: 32, color: '#ffffff'
          });
        } else if (current.type === 'display_text') {
          // Uses FieldNumber (not value inputs) — read with getFieldValue
          actions.push({
            type: 'text',
            text: current.getFieldValue('TEXT'),
            x: Number(current.getFieldValue('X')),
            y: Number(current.getFieldValue('Y')),
            size: Number(current.getFieldValue('SIZE')),
            color: current.getFieldValue('COLOR')
          });
        } else if (current.type === 'play_sound') {
          actions.push({
            type: 'sound',
            sound: current.getFieldValue('SOUND')
          });
        } else if (current.type === 'flash_screen') {
          actions.push({
            type: 'flash_screen',
            color: current.getFieldValue('COLOR'),
            duration: Number(current.getFieldValue('DURATION'))
          });
        } else if (current.type === 'create_particles') {
          actions.push({
            type: 'particles',
            x: Number(current.getFieldValue('X')),
            y: Number(current.getFieldValue('Y')),
            color: current.getFieldValue('COLOR'),
            count: Number(current.getFieldValue('COUNT'))
          });
        } else if (current.type === 'coffee') {
          actions.push({
            type: 'coffee',
            spriteId: Number(current.getFieldValue('SPRITE_ID'))
          });
        } else if (current.type === 'set_sprite_property') {
          actions.push({
            type: 'set_property',
            spriteId: Number(current.getFieldValue('SPRITE_ID')),
            property: current.getFieldValue('PROPERTY'),
            value: serializeExpression(current.getInputTargetBlock('VALUE'))
          });
        } else if (current.type === 'tween_sprite') {
          actions.push({
            type: 'tween',
            spriteId: Number(current.getFieldValue('SPRITE_ID')),
            property: current.getFieldValue('PROPERTY'),
            value: serializeExpression(current.getInputTargetBlock('VALUE')),
            duration: Number(current.getFieldValue('DURATION')),
            easing: current.getFieldValue('EASING')
          });
        } else if (current.type === 'shake_sprite_for') {
          actions.push({
            type: 'shake_temp',
            spriteId: Number(current.getFieldValue('SPRITE_ID')),
            duration: Number(current.getFieldValue('DURATION'))
          });
        } else if (current.type === 'db_set') {
          actions.push({
            type: 'db_set',
            key: current.getFieldValue('KEY'),
            value: serializeExpression(current.getInputTargetBlock('VALUE'))
          });
        } else if (current.type === 'set_variable') {
          actions.push({
            type: 'set_variable',
            var: current.getFieldValue('VAR'),
            value: serializeExpression(current.getInputTargetBlock('VALUE'))
          });
        } else if (current.type === 'change_variable') {
          actions.push({
            type: 'change_variable',
            var: current.getFieldValue('VAR'),
            value: serializeExpression(current.getInputTargetBlock('VALUE'))
          });
        } else if (current.type === 'add_to_group') {
          actions.push({
            type: 'add_to_group',
            spriteId: Number(current.getFieldValue('SPRITE_ID')),
            groupName: current.getFieldValue('GROUP_NAME')
          });
        } else if (current.type === 'move_group') {
          actions.push({
            type: 'move_group',
            groupName: current.getFieldValue('GROUP_NAME'),
            direction: current.getFieldValue('DIRECTION'),
            steps: serializeExpression(current.getInputTargetBlock('STEPS'))
          });
        } else if (current.type === 'rotate_group') {
          actions.push({
            type: 'rotate_group',
            groupName: current.getFieldValue('GROUP_NAME'),
            angle: serializeExpression(current.getInputTargetBlock('ANGLE'))
          });
        } else if (current.type === 'controls_repeat_ext') {
          actions.push({
            type: 'repeat',
            times: serializeExpression(current.getInputTargetBlock('TIMES')),
            subActions: processBlockStack(current.getInputTargetBlock('DO'))
          });
        } else if (current.type === 'controls_if') {
          actions.push({
            type: 'if',
            condition: serializeExpression(current.getInputTargetBlock('IF0')),
            thenActions: processBlockStack(current.getInputTargetBlock('DO0')),
            elseActions: processBlockStack(current.getInputTargetBlock('ELSE'))
          });
        } else if (current.type === 'wait_seconds') {
          actions.push({ 
            type: 'wait', 
            duration: serializeExpression(current.getInputTargetBlock('SECONDS')) 
          });
        }
        current = current.getNextBlock();
      }
      return actions;
    };

    // Check if blocks are connected to 'Every Frame'
    const tickBlocks = allBlocks.filter(b => {
      let root = b.getRootBlock();
      return root && root.type === 'on_tick';
    });

    // Extract tick actions
    const tickEvents = allBlocks.filter(b => b.type === 'on_tick');
    const tickActions = tickEvents.flatMap(b => processBlockStack(b.getInputTargetBlock('STACK')));

    // Extract start actions
    const startEvents = allBlocks.filter(b => b.type === 'on_start');
    const startActions = startEvents.flatMap(b => processBlockStack(b.getInputTargetBlock('STACK')));

    const hasBounce = tickBlocks.some(b => b.type === 'bounce_on_edge');
    
    // Extract physics logic
    const gravityBlock = tickBlocks.find(b => b.type === 'set_gravity');
    const gravity = gravityBlock ? Number(gravityBlock.getFieldValue('GRAVITY')) : 0;
    
    const frictionBlock = tickBlocks.find(b => b.type === 'set_friction');
    const friction = frictionBlock ? Number(frictionBlock.getFieldValue('FRICTION')) : 0;
    
    // Extract appearance logic
    const appearanceBlock = tickBlocks.find(b => b.type === 'change_appearance');
    const appearance = appearanceBlock ? {
      color: appearanceBlock.getFieldValue('COLOR'),
      size: Number(appearanceBlock.getFieldValue('SIZE')),
      effect: appearanceBlock.getFieldValue('EFFECT')
    } : null;
    
    // Extract movement commands
    const moveBlocks = tickBlocks.filter(b => b.type === 'move_sprite');
    const movements = moveBlocks.map(b => ({
      direction: b.getFieldValue('DIRECTION'),
      steps: Number(b.getFieldValue('STEPS'))
    }));

    // Extract rotation commands
    const rotateBlocks = tickBlocks.filter(b => b.type === 'rotate_sprite');
    const rotations = rotateBlocks.map(b => ({
      angle: Number(b.getFieldValue('ANGLE'))
    }));

    // Extract flip commands
    const flipBlocks = tickBlocks.filter(b => b.type === 'flip_sprite');
    const flips = flipBlocks.map(b => ({
      axis: b.getFieldValue('AXIS')
    }));

    // Extract text blocks from ANYWHERE in the workspace (not just on_tick).
    // This gives kids immediate "Hello World" feedback — drag a Display Text block
    // anywhere and it shows on canvas the moment RUN is pressed (or live if already running).
    const textBlocks = allBlocks.filter(b =>
      b.type === 'display_text' || b.type === 'print_text'
    );
    const texts = textBlocks.map(b => {
      if (b.type === 'print_text') {
        // print_text is a simplified block: just text + auto-center position
        return {
          text: b.getFieldValue('TEXT'),
          x: 200,
          y: 200,
          size: 32,
          color: '#ffffff'
        };
      }
      return {
        text: b.getFieldValue('TEXT'),
        x: Number(b.getFieldValue('X')),
        y: Number(b.getFieldValue('Y')),
        size: Number(b.getFieldValue('SIZE')),
        color: b.getFieldValue('COLOR')
      };
    });

    // Extract camera follow logic
    const cameraBlock = tickBlocks.find(b => b.type === 'camera_follow');
    const cameraFollowId = cameraBlock ? Number(cameraBlock.getFieldValue('SPRITE_ID')) : null;
    
    // Extract frame actions
    const frameEvents = allBlocks.filter(b => b.type === 'on_frame');
    const frameActions: Record<number, any[]> = {};
    frameEvents.forEach(fb => {
      const frame = Number(fb.getFieldValue('FRAME'));
      frameActions[frame] = processBlockStack(fb.getInputTargetBlock('DO'));
    });

    // Extract collision actions
    const collisionBlocks = allBlocks.filter(b => b.type === 'on_collision');
    const collisionActions = collisionBlocks.flatMap(b => processBlockStack(b.getInputTargetBlock('STACK')));
    const hasCollisionLogic = collisionActions.length > 0;

    // Extract key actions
    const keyBlocks = allBlocks.filter(b => b.type === 'on_key_pressed');
    const keyActions: Record<string, any[]> = {};
    
    keyBlocks.forEach(kb => {
      const key = kb.getFieldValue('KEY');
      keyActions[key] = processBlockStack(kb.getInputTargetBlock('STACK'));
    });

    logicRef.current = {
      bounce: hasBounce,
      gravity: Number(gravity),
      friction: Number(friction),
      appearance,
      collide: hasCollisionLogic,
      collisionActions,
      tickActions,
      startActions,
      movements,
      rotations,
      flips,
      texts,
      cameraFollowId,
      frameActions,
      keyActions,
      keysPressed: keysPressed.current
    };

    // 🔁 LIVE TINKERING — if the game is already running, re-fire "When Game Starts"
    // blocks so kids can swap blocks and see results without stopping the engine.
    if (isRunningRef.current) {
      engineRef.current.triggerStart(startActions);
    }
  };

  const toggleGame = () => {
    const starting = !isRunning;
    isRunningRef.current = starting; // Keep ref in sync before async state update
    setIsRunning(starting);
    setIsScrubbing(false);
    
    // If starting, handle 'When Game Starts' logic
    if (starting && workspaceRef.current) {
      engineRef.current.reset(); // Clear previous run's sprites
      
      const allBlocks = workspaceRef.current.getAllBlocks(false);
      const startBlocks = allBlocks.filter(b => {
        let root = b.getRootBlock();
        return root && root.type === 'on_start';
      });
      
      // Find create_sprite and create_block blocks connected to on_start
      startBlocks.forEach(block => {
        if (block.type === 'create_sprite') {
          const x = block.getFieldValue('X');
          const y = block.getFieldValue('Y');
          const size = block.getFieldValue('SIZE');
          engineRef.current.addSprite(Number(x), Number(y), Number(size), '#3b82f6', false);
        } else if (block.type === 'create_block') {
          const x = block.getFieldValue('X');
          const y = block.getFieldValue('Y');
          const size = block.getFieldValue('SIZE');
          engineRef.current.addSprite(Number(x), Number(y), Number(size), '#64748b', true);
        }
      });

      // Default sprite if none created
      if (engineRef.current.getState().sprites.length === 0) {
        engineRef.current.addSprite(200, 200, 40);
      }

      // Trigger 'When Game Starts' actions
      engineRef.current.triggerStart(logicRef.current.startActions);
      
      setGameState({ ...engineRef.current.getState() });
      console.log("Game Started! Running 'When Game Starts' blocks...");
    }
  };

  const resetGame = () => {
    engineRef.current.reset();
    setGameState({ ...engineRef.current.getState() });
    setIsRunning(false);
    resetSpatialState();
    setIsScrubbing(false);
    setScrubValue(100);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setScrubValue(val);
    setIsScrubbing(true);
    setIsRunning(false);
    
    const historicalState = engineRef.current.getHistoryFrame(val);
    if (historicalState) {
      setGameState(historicalState);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b-4 border-b-blue-500 relative px-6 py-4 flex items-center justify-between shadow-sm overflow-hidden">
        {/* Rainbow Brain Accent */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 animate-gradient-x" />
        
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Momentum Lab</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">STEAM Discovery Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={downloadProject}
              className="p-2 text-slate-600 hover:bg-white hover:text-blue-600 rounded-md transition-all"
              title="Download Project"
            >
              <Download size={18} />
            </button>
            <button
              onClick={uploadProject}
              className="p-2 text-slate-600 hover:bg-white hover:text-blue-600 rounded-md transition-all"
              title="Upload Project"
            >
              <Upload size={18} />
            </button>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 mx-1" />

          <button 
            onClick={() => setIsTutorOpen(!isTutorOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 ${
              isTutorOpen 
                ? 'bg-blue-600 text-white shadow-blue-500/30' 
                : 'bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-500'
            }`}
          >
            <Bot size={18} />
            <span>AI Tutor</span>
            {isTutorOpen && <Sparkles size={14} className="animate-pulse" />}
          </button>

          <div className="h-8 w-[1px] bg-slate-200 mx-2" />
          
          <button 
            onClick={() => setShowIntro(true)}
            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Info size={20} />
          </button>
          <div className="h-8 w-[1px] bg-slate-200 mx-2" />
          <button
            onClick={resetGame}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all font-medium"
          >
            <RotateCcw size={18} />
            Reset
          </button>
          <button
            onClick={toggleGame}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-md ${
              isRunning 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isRunning ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {isRunning ? 'STOP' : 'RUN BLOCKS'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left: Blockly Editor */}
        <div className="flex-[3] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-2 h-6 bg-blue-500 rounded-full" />
              The Logic (Blocks)
            </h2>
            <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded text-slate-600">
              BLOCKLY_WORKSPACE_V1
            </span>
          </div>
          <BlocklyEditor 
            onWorkspaceChange={handleWorkspaceChange} 
            onReset={resetGame}
          />
        </div>

        {/* Right: Preview & Debugging */}
        <div className="flex-[2] flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-2 h-6 bg-purple-500 rounded-full" />
                The Paintbrush (p5.js)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCanvasFullScreen(!isCanvasFullScreen)}
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
                    isCanvasFullScreen ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  title={isCanvasFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isCanvasFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  onClick={() => setXRayMode(!xRayMode)}
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
                    xRayMode ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <Eye size={16} />
                  X-Ray
                </button>
                <button
                  onClick={() => setSynestheticMode(!synestheticMode)}
                  title="Synesthetic Mode — see errors as patterns"
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
                    synestheticMode ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <Sparkles size={16} />
                  Spatial
                </button>
                <button
                  onClick={() => setBabyMode(!babyMode)}
                  title="baby_0 — GEO spatial AI watching and learning"
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
                    babyMode
                      ? 'bg-cyan-100 text-cyan-700 ring-2 ring-cyan-400'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <span style={{ fontSize: 16 }}>🧠</span>
                  baby_0
                </button>
                <button
                  onClick={() => {
                    // Wild mode requires baby to be on first
                    if (!babyMode) setBabyMode(true);
                    setWildMode(prev => !prev);
                  }}
                  title="⚡ WILD — remove the leash. 12.5Hz, no rest, Perlin canvas."
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${
                    wildMode
                      ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400 animate-pulse'
                      : 'bg-slate-200 text-slate-500 hover:bg-yellow-50 hover:text-yellow-600'
                  }`}
                >
                  <Zap size={14} />
                  Wild
                </button>
                {/* ── baby_1 controls ──────────────────────────────────── */}
                <button
                  onClick={() => setBaby1Mode(!baby1Mode)}
                  title="baby_1 — The Divergent: wider net, faster explorer, minReward=0.1"
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
                    baby1Mode
                      ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-400'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <span style={{ fontSize: 16 }}>🧬</span>
                  baby_1
                </button>
                <button
                  onClick={() => {
                    if (!baby1Mode) setBaby1Mode(true);
                    setWild1Mode(prev => !prev);
                  }}
                  title="⚡ WILD — unleash baby_1. Grows every pattern in wild mode."
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${
                    wild1Mode
                      ? 'bg-fuchsia-100 text-fuchsia-700 ring-2 ring-fuchsia-400 animate-pulse'
                      : 'bg-slate-200 text-slate-500 hover:bg-fuchsia-50 hover:text-fuchsia-600'
                  }`}
                >
                  <Zap size={14} />
                  Wild₁
                </button>
                {/* ── Draw Mode toggle ─────────────────────────────────── */}
                <button
                  onClick={() => setDrawMode(prev => !prev)}
                  title="🖌️ Draw Mode — your strokes become GEO code. Baby eats your pixels."
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${
                    drawMode
                      ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-400 animate-pulse'
                      : 'bg-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <span style={{ fontSize: 16 }}>🖌️</span>
                  Draw
                </button>
                {/* ── Sketch Upload — "Human Sings, Baby Codes" ─────────── */}
                <button
                  onClick={handleSketchUpload}
                  disabled={sketchInterpreting}
                  title="🎨 Upload a sketch — Gemini reads the gesture and feeds it to the babies as a GEO path"
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${
                    sketchInterpreting
                      ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-400 animate-pulse cursor-wait'
                      : 'bg-slate-200 text-slate-500 hover:bg-violet-50 hover:text-violet-600'
                  }`}
                >
                  <span style={{ fontSize: 16 }}>{sketchInterpreting ? '⏳' : '🎨'}</span>
                  {sketchInterpreting ? 'Reading…' : 'Sketch'}
                </button>
                {/* ── Dog / Baby Mode — universal GEO player ────────────── */}
                <button
                  onClick={() => setDogBabyMode(true)}
                  title="🐕 Dog·Baby Mode — big buttons for Otis, babies, and anyone who speaks in patterns"
                  className="p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold bg-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                >
                  <span style={{ fontSize: 16 }}>🐕</span>
                  Play
                </button>
              </div>
            </div>
            
            {gameState && (
              <div className={isCanvasFullScreen ? "fixed inset-0 z-[100] bg-slate-900 p-8 flex items-center justify-center" : ""}>
                {isCanvasFullScreen && (
                  <button 
                    onClick={() => setIsCanvasFullScreen(false)}
                    className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all z-[110]"
                  >
                    <Minimize2 size={24} />
                  </button>
                )}
                <div ref={canvasContainerRef} style={{ position: 'relative', display: 'inline-block' }}>
                  {/* ── GEO Playground — the living quadtree canvas (boxes in boxes) ── */}
                  {/* This IS the pattern recognition system. Baby + human paint here.    */}
                  {/* GameCanvas is rendered on top only when a Blockly program is running */}
                  <GEOPlayground
                    width={400}
                    height={400}
                    agent={babyAgent}
                    agent2={baby1Agent}
                    brain={babyBrainSnap}
                    brain2={baby1BrainSnap}
                    lastCyanPromotion={lastCyan0 ?? lastCyan1}
                    guideTarget={guideTarget0 ?? guideTarget1}
                    onCanvasReady={handleGEOCanvasReady}
                  />
                  {/* GameCanvas — shown only when user runs a Blockly program */}
                  {isRunning && (
                    <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 5 }}>
                      <GameCanvas
                        gameState={gameState}
                        xRayMode={xRayMode}
                        isPaused={isScrubbing}
                        wildAnimation={wildMode}
                        className={isCanvasFullScreen ? "w-full h-full max-w-5xl max-h-[80vh] shadow-2xl border-4 border-white/20" : ""}
                      />
                      <SynestheticLayer
                        width={400}
                        height={400}
                        visible={synestheticMode && isRunning}
                      />
                    </div>
                  )}
                  <SpatialEye
                    visible={babyMode}
                    width={400}
                    height={400}
                    label="baby_0"
                    brain={babyBrainSnap}
                    lastReward={lastReward && (Date.now() - lastReward.ts < 1500) ? lastReward : null}
                    quadrantEntropy={new Map()}
                    lastLock={lastLock0}
                    lastCyanPromotion={lastCyan0}
                    guideTarget={guideTarget0}
                  />
                  {/* baby_1 overlay — same canvas, different gaze */}
                  <SpatialEye
                    visible={baby1Mode}
                    width={400}
                    height={400}
                    label="baby_1"
                    brain={baby1BrainSnap}
                    lastReward={last1Reward && (Date.now() - last1Reward.ts < 1500) ? last1Reward : null}
                    quadrantEntropy={new Map()}
                    lastLock={lastLock1}
                    lastCyanPromotion={lastCyan1}
                    guideTarget={guideTarget1}
                  />
                  {/* Discovery Flash overlays — visible "the AI found THIS" moments */}
                  <DiscoveryFlashOverlay
                    flashes={discoveryFlashes}
                    onExpired={handleFlashExpired}
                  />
                  {/* ── Phase B+: Shared Tactile Canvas ───────────────── */}
                  {/* DrawCanvas sits on top — captures strokes, feeds baby pixels, */}
                  {/* renders GEO grid and baby bloom draw-backs.               */}
                  <DrawCanvas
                    width={400}
                    height={400}
                    active={drawMode}
                    agent={babyAgent}
                    agent2={baby1Mode ? baby1Agent : undefined}
                    libraryCache={[
                      ...babyBrainSnap.libraryCache,
                      ...baby1BrainSnap.libraryCache,
                    ] as any}
                    onStroke={handleStroke}
                    onStrokeUpdate={handleStrokeUpdate}
                    lastCyanPromotion={lastCyan0 ?? lastCyan1}
                  />
                  {/* StrokeHUD — floating live translation panel */}
                  <StrokeHUD
                    lastStroke={lastStroke}
                    livePath={livePath}
                    active={drawMode}
                  />
                  {/* ── Sketch Result Overlay — "Baby heard you" ──────────── */}
                  {/* Shows for 6 seconds after a sketch is interpreted.        */}
                  {sketchResult && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        right: 8,
                        zIndex: 60,
                        background: 'rgba(6,8,12,0.88)',
                        border: `1.5px solid ${
                          sketchResult.libraryMatch ? '#06b6d4' : '#7c3aed'
                        }`,
                        borderRadius: 10,
                        padding: '8px 12px',
                        color: '#f0f0f0',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        backdropFilter: 'blur(6px)',
                        boxShadow: sketchResult.libraryMatch
                          ? '0 0 16px rgba(6,182,212,0.45)'
                          : '0 0 12px rgba(124,58,237,0.35)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 15 }}>🎨</span>
                        <span style={{ color: sketchResult.libraryMatch ? '#06b6d4' : '#a78bfa', fontWeight: 700 }}>
                          {sketchResult.family}
                        </span>
                        <span style={{ opacity: 0.6 }}>
                          [{sketchResult.path.join(' → ')}]
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          opacity: 0.5,
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 4,
                          padding: '1px 5px',
                        }}>
                          {Math.round(sketchResult.confidence * 100)}% conf
                        </span>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 10, marginBottom: sketchResult.codeHint ? 4 : 0 }}>
                        {sketchResult.description}
                      </div>
                      {sketchResult.codeHint && (
                        <div style={{
                          marginTop: 4,
                          padding: '4px 8px',
                          background: 'rgba(6,182,212,0.15)',
                          border: '1px solid rgba(6,182,212,0.3)',
                          borderRadius: 6,
                          color: '#67e8f9',
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          🔥 Baby knows this: <code>{sketchResult.codeHint}</code>
                        </div>
                      )}
                      {!sketchResult.libraryMatch && (
                        <div style={{ marginTop: 3, opacity: 0.45, fontSize: 10 }}>
                          Seeded into baby's cache at 0.5 confidence — keep drawing this pattern to teach it
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── baby_0 live telemetry strip ─────────────────────── */}
                {babyMode && (
                  <div className={`mt-2 px-3 py-2 rounded-lg font-mono text-xs flex flex-wrap items-center gap-x-4 gap-y-1 ${
                    wildMode
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                      : 'bg-cyan-50 border border-cyan-200 text-cyan-800'
                  }`}>
                    <span className={`font-bold px-2 py-0.5 rounded text-white text-[10px] tracking-widest ${wildMode ? 'bg-yellow-500 animate-pulse' : 'bg-cyan-500'}`}>
                      🧠 {wildMode ? '⚡ WILD' : '👁 WATCHING'}
                    </span>
                    {(() => {
                      const gridSize = Math.pow(2, babyBrainSnap.visualResolution);
                      return (
                        <span title="Spatial resolution">
                          🔬 <strong>{gridSize}×{gridSize}</strong>
                          <span className="ml-1 text-[10px] opacity-60">({(gridSize * gridSize).toLocaleString()} regions)</span>
                        </span>
                      );
                    })()}
                    <span title="Patterns cached">
                      ✨ <strong>{babyBrainSnap.patternCache.length}</strong>
                      <span className="ml-1 text-[10px] opacity-60">patterns</span>
                    </span>
                    <span className="flex items-center gap-1" title="Energy">
                      ⚡
                      <span className="inline-block w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <span
                          className={`block h-full rounded-full transition-all ${babyBrainSnap.energy > 0.5 ? 'bg-green-400' : babyBrainSnap.energy > 0.2 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.round(babyBrainSnap.energy * 100)}%` }}
                        />
                      </span>
                      <span className="text-[10px] opacity-60">{Math.round(babyBrainSnap.energy * 100)}%</span>
                    </span>
                    {babyBrainSnap.frustration > 0 && (
                      <span title="Frustration">😤 <strong>{babyBrainSnap.frustration}</strong></span>
                    )}
                    {babyBrainSnap.currentFocus && (
                      <span className="opacity-70">📍 [{babyBrainSnap.currentFocus.path.join('→')}]</span>
                    )}
                  </div>
                )}

                {/* ── Pattern Burst — bidirectional AI↔student loop ────── */}
                {(babyMode || baby1Mode) && (
                  <PatternBurst
                    agents={[
                      ...(babyMode ? [{ agent: babyAgent, name: 'baby_0', color: 'cyan' as const, accentHex: '#06b6d4' }] : []),
                      ...(baby1Mode ? [{ agent: baby1Agent, name: 'baby_1', color: 'pink' as const, accentHex: '#ec4899' }] : []),
                    ]}
                    canvasContainerRef={canvasContainerRef}
                    onFlash={handleFlash}
                    visible={babyMode || baby1Mode}
                  />
                )}

                {/* ── baby_1 live telemetry strip ─────────────────────── */}
                {baby1Mode && (
                  <div className={`mt-1 px-3 py-2 rounded-lg font-mono text-xs flex flex-wrap items-center gap-x-4 gap-y-1 ${
                    wild1Mode
                      ? 'bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800'
                      : 'bg-pink-50 border border-pink-200 text-pink-800'
                  }`}>
                    <span className={`font-bold px-2 py-0.5 rounded text-white text-[10px] tracking-widest ${wild1Mode ? 'bg-fuchsia-500 animate-pulse' : 'bg-pink-500'}`}>
                      🧬 {wild1Mode ? '⚡ WILD' : '👁 WATCHING'}
                    </span>
                    {(() => {
                      const gridSize = Math.pow(2, baby1BrainSnap.visualResolution);
                      return (
                        <span title="Spatial resolution">
                          🔬 <strong>{gridSize}×{gridSize}</strong>
                          <span className="ml-1 text-[10px] opacity-60">({(gridSize * gridSize).toLocaleString()} regions)</span>
                        </span>
                      );
                    })()}
                    <span title="Patterns cached — baby_1 caches TIER_3+ so count grows faster">
                      ✨ <strong>{baby1BrainSnap.patternCache.length}</strong>
                      <span className="ml-1 text-[10px] opacity-60">patterns</span>
                    </span>
                    <span className="flex items-center gap-1" title="Energy">
                      ⚡
                      <span className="inline-block w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <span
                          className={`block h-full rounded-full transition-all ${baby1BrainSnap.energy > 0.5 ? 'bg-green-400' : baby1BrainSnap.energy > 0.2 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.round(baby1BrainSnap.energy * 100)}%` }}
                        />
                      </span>
                      <span className="text-[10px] opacity-60">{Math.round(baby1BrainSnap.energy * 100)}%</span>
                    </span>
                    {baby1BrainSnap.frustration > 0 && (
                      <span title="Frustration — baby_1 hits this fast (3 ticks)">😤 <strong>{baby1BrainSnap.frustration}</strong></span>
                    )}
                    {baby1BrainSnap.currentFocus && (
                      <span className="opacity-70">📍 [{baby1BrainSnap.currentFocus.path.join('→')}]</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Phase B: Librarian's Archive ────────────────────── */}
            {(babyMode || baby1Mode) && (
              <LibraryPanel
                visible={babyMode || baby1Mode}
                agents={[
                  ...(babyMode ? [{
                    libraryCache: babyBrainSnap.libraryCache as any,
                    label: 'baby_0',
                    color: '#06b6d4',
                  }] : []),
                  ...(baby1Mode ? [{
                    libraryCache: baby1BrainSnap.libraryCache as any,
                    label: 'baby_1',
                    color: '#ec4899',
                  }] : []),
                ]}
              />
            )}
          </div>

          {/* Debugging Tools */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-blue-500" />
                Time Scrubbing
              </h3>
              <span className="text-xs font-mono text-slate-400">WASM_STATE_BUFFER</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={scrubValue}
                  onChange={handleScrub}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <p className="text-sm text-slate-500 italic">
                {isScrubbing 
                  ? "⏪ Rewinding through the state history buffer..." 
                  : "Drag the slider to look back in time!"}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Brain Health (WASM)</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Frame Rate</p>
                  <p className="text-xl font-mono font-bold text-green-600">60.0 FPS</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Memory Usage</p>
                  <p className="text-xl font-mono font-bold text-blue-600">1.2 MB</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Gravity</p>
                  <p className="text-lg font-mono font-bold text-orange-600">{logicRef.current.gravity?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Friction</p>
                  <p className="text-lg font-mono font-bold text-indigo-600">{(logicRef.current.friction * 100)?.toFixed(0) || '0'}%</p>
                </div>
              </div>
            </div>

            {/* Local Variables Section */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500" />
                Sprite Variables
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {gameState?.sprites.some(s => s.variables && Object.keys(s.variables).length > 0) ? (
                  gameState.sprites.map((sprite, i) => {
                    const vars = sprite.variables || {};
                    const varKeys = Object.keys(vars);
                    if (varKeys.length === 0) return null;
                    
                    return (
                      <div key={sprite.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: sprite.color }}
                          />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Sprite {i} ({sprite.id})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {varKeys.map(key => (
                            <div key={key} className="flex justify-between items-center bg-white px-2 py-0.5 rounded border border-slate-100">
                              <span className="text-[10px] text-slate-400 font-mono">{key}:</span>
                              <span className="text-[10px] font-bold text-blue-600 font-mono">
                                {typeof vars[key] === 'number' ? vars[key].toFixed(1) : String(vars[key])}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    No local variables set yet. Use the "Set variable" block to start tracking data!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <TutorAssistant 
        isOpen={isTutorOpen} 
        onClose={() => setIsTutorOpen(false)} 
        workspaceXml={workspaceXml}
      />

      {/* Intro Modal */}
      <AnimatePresence>
        {/* ── Dog / Baby Mode — full-screen universal player overlay ───── */}
        <DogBabyMode
          active={dogBabyMode}
          agent={babyAgent}
          agent2={baby1Agent}
          onClose={() => setDogBabyMode(false)}
        />

        {showIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-8 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-white/20 p-3 rounded-xl">
                    <Zap size={32} />
                  </div>
                  <h2 className="text-3xl font-bold">Welcome to Momentum Lab!</h2>
                </div>
                <p className="text-blue-100 text-lg">
                  Ready to build your first game? I'm your technical co-pilot, and we're going to use 
                  <strong> The Logic</strong>, <strong>The Brain</strong>, and <strong>The Paintbrush</strong> to create something amazing!
                  Need help? Just click the <strong>AI Tutor</strong> button in the header! 🤖✨
                </p>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                      <Square size={24} />
                    </div>
                    <h3 className="font-bold">The Logic</h3>
                    <p className="text-xs text-slate-500">Snap blocks together to tell your sprites what to do!</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                      <Zap size={24} />
                    </div>
                    <h3 className="font-bold">The Brain</h3>
                    <p className="text-xs text-slate-500">A super-fast Rust engine handles all the math!</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <Eye size={24} />
                    </div>
                    <h3 className="font-bold">The Paintbrush</h3>
                    <p className="text-xs text-slate-500">p5.js draws your game at a smooth 60 frames per second!</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowIntro(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg"
                >
                  Let's Start Discovering! 🚀
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
