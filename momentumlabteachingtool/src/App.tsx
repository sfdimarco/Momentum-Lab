import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  BrainCircuit, 
  Zap, 
  Compass,
  Palette,
  Binary,
  Baby,
  Mic,
  MicOff,
  MousePointer2,
  Sparkles,
  Camera,
  CameraOff,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Quadtree, Point, Rect } from './lib/spatial';

// --- Constants & Types ---
const INITIAL_CAPACITY = 4;
const COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#FF9F1C', '#1A535C'];
const APOPHENIA_COLORS: Record<string, string> = {
  '0': '#00FFFF', // cyan
  '1': '#FF0000', // red
  '2': '#0000FF', // blue
  '3': '#FFFF00', // yellow
  '4': '#008000', // green
  '5': '#FFA500', // orange
  '6': '#FFC0CB', // pink
  '7': '#800080', // purple
  '8': '#FFFFFF', // white
  '9': '#000000', // black
};
const INPUT_ZONE_RATIO = 0.4; // Center 40% is reserved for input

interface GeoUIElement {
  id: string;
  type: 'node' | 'link' | 'cluster' | 'thought' | 'control' | 'pixel-grid' | 'emergent-action' | 'image';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  grid?: number[][];
  imageUrl?: string;
  imageObj?: HTMLImageElement; // Cached for rendering
  scale: number;
  life: number; // 0 to 1
  geoHash: string; // Spatial signature
  resonance: number; // Audio-reactive energy
  frequencyResonance?: number; // High-frequency energy component
  vx: number;
  vy: number;
  clickPulse: number; // 0 to 1, decays after click
  actionId?: string;
  clusterChildren?: GeoUIElement[];
  controlType?: 'button' | 'slider';
  minValue?: number;
  maxValue?: number;
  currentValue?: number;
}

interface BackgroundGhost {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'circle' | 'square' | 'line';
  rotation: number;
  vRotation: number;
  opacity: number;
}

interface CouncilThoughtParticle {
  id: string;
  memberId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface CouncilMemory {
  event: string;
  thought: string;
  member: string;
  timestamp: number;
}

const COUNCIL_MEMBERS = [
  { id: 'architect', name: 'Architect', role: 'Structure', icon: <Compass size={24} />, color: '#1A535C' },
  { id: 'artist', name: 'Artist', role: 'Expression', icon: <Palette size={24} />, color: '#FF6B6B' },
  { id: 'logician', name: 'Logician', role: 'Flow', icon: <Binary size={24} />, color: '#4ECDC4' },
  { id: 'child', name: 'Child', role: 'Wonder', icon: <Baby size={24} />, color: '#FF9F1C' },
];

interface CouncilBrain {
  uxPatterns: string[];
  userPreferences: Record<string, any>;
  questionsAsked: string[];
  assistantState: {
    phase: string;
    insightCount: number;
  };
}

export default function App() {
  // --- State ---
  const [councilBrain, setCouncilBrain] = useState<CouncilBrain | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [generalChat, setGeneralChat] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualX, setManualX] = useState<number>(100);
  const [manualY, setManualY] = useState<number>(100);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [neurons, setNeurons] = useState<Point[]>([]);
  const [geoElements, setGeoElements] = useState<GeoUIElement[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showMath, setShowMath] = useState(true);
  const [stimulusCount, setStimulusCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pulsePos, setPulsePos] = useState(-100);
  const [etches, setEtches] = useState<{ x: number, y: number, w: number, h: number, opacity: number }[]>([]);
  const targetLaceOffsetRef = useRef({ x: 0, y: 0 });
  const laceOffsetRef = useRef({ x: 0, y: 0 });
  const laceVelocityRef = useRef({ x: 0, y: 0 });
  const canvasMousePosRef = useRef({ x: -1000, y: -1000 });
  const [ghosts, setGhosts] = useState<BackgroundGhost[]>([]);
  const [councilThought, setCouncilThought] = useState<string>("Awaiting stimulus...");
  const [councilParticles, setCouncilParticles] = useState<CouncilThoughtParticle[]>([]);
  const [councilMemory, setCouncilMemory] = useState<CouncilMemory[]>(() => {
    try {
      const saved = localStorage.getItem('geo_council_memory');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activeCouncilMember, setActiveCouncilMember] = useState<string | null>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const clusterScanCounterRef = useRef(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [systemEffect, setSystemEffect] = useState<{ type: string, life: number } | null>(null);
  const [systemImpact, setSystemImpact] = useState<{ x: number, y: number, type: string, life: number } | null>(null);
  const [interactionSparks, setInteractionSparks] = useState<{ x: number, y: number, color: string, life: number }[]>([]);
  const [scrubbingSliderId, setScrubbingSliderId] = useState<string | null>(null);
  const [globalResonance, setGlobalResonance] = useState(1.0);
  const [physicsSpeed, setPhysicsSpeed] = useState(1.0);
  const [bgEnergy, setBgEnergy] = useState(0);
  const [bgPhase, setBgPhase] = useState(0);
  
  const systemEffectRef = useRef<{ type: string, life: number } | null>(null);
  const transcriptionRef = useRef<string>("");

  useEffect(() => {
    systemEffectRef.current = systemEffect;
  }, [systemEffect]);

  useEffect(() => {
    transcriptionRef.current = transcription;
  }, [transcription]);

  // --- Council Memory Persistence ---
  useEffect(() => {
    localStorage.setItem('geo_council_memory', JSON.stringify(councilMemory));
  }, [councilMemory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        deleteElement(selectedElementId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, geoElements]);

  useEffect(() => {
    const fetchBrain = async () => {
      try {
        const res = await fetch("/api/council/brain");
        const data = await res.json();
        setCouncilBrain(data);
      } catch (e) {
        console.error("Failed to fetch brain", e);
      }
    };
    
    const fetchSubstrate = async () => {
      try {
        const res = await fetch("/api/substrate");
        const data = await res.json();
        if (data.neurons || data.geoElements) {
          setNeurons(data.neurons || []);
          setGeoElements(data.geoElements || []);
          setStimulusCount(data.stimulusCount || 0);
        }
      } catch (e) {
        console.error("Failed to fetch substrate", e);
      }
    };

    fetchBrain();
    fetchSubstrate();

    // Bootstrap Interactive Controls
    const controls: GeoUIElement[] = [
      {
        id: 'cntrl-resonance',
        type: 'control',
        controlType: 'slider',
        label: 'Resonance Gain',
        x: 50,
        y: 100,
        w: 120,
        h: 20,
        color: APOPHENIA_COLORS['0'],
        opacity: 0,
        scale: 1,
        life: 1,
        geoHash: 'gain-0',
        resonance: 0,
        vx: 0,
        vy: 0,
        clickPulse: 0,
        minValue: 0,
        maxValue: 5,
        currentValue: 1.0,
        actionId: 'adjust_resonance'
      },
      {
        id: 'cntrl-physics',
        type: 'control',
        controlType: 'slider',
        label: 'Physics Elasticity',
        x: 50,
        y: 140,
        w: 120,
        h: 20,
        color: APOPHENIA_COLORS['4'],
        opacity: 0,
        scale: 1,
        life: 1,
        geoHash: 'phys-4',
        resonance: 0,
        vx: 0,
        vy: 0,
        clickPulse: 0,
        minValue: 0.1,
        maxValue: 3,
        currentValue: 1.0,
        actionId: 'adjust_physics'
      },
      {
        id: 'btn-deliberate',
        type: 'control',
        controlType: 'button',
        label: 'Manual Deliberation',
        x: 50,
        y: 180,
        w: 120,
        h: 30,
        color: APOPHENIA_COLORS['3'],
        opacity: 0,
        scale: 1,
        life: 1,
        geoHash: 'btn-3',
        resonance: 0,
        vx: 0,
        vy: 0,
        clickPulse: 0,
        actionId: 'MANUAL_DELIBERATION'
      }
    ];

    setGeoElements(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newOnly = controls.filter(c => !existingIds.has(c.id));
      return [...prev, ...newOnly];
    });
  }, []);

  const saveBrain = async (newBrain: CouncilBrain) => {
    try {
      await fetch("/api/council/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBrain)
      });
      setCouncilBrain(newBrain);
    } catch (e) {
      console.error("Failed to save brain", e);
    }
  };

  const updateCouncilMD = async (member: string, observation: string) => {
    try {
      await fetch("/api/council/update-md", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.toLowerCase(), content: observation })
      });
    } catch (e) {
      console.error("Failed to update MD", e);
    }
  };

  const createManualThought = () => {
    if (!manualLabel) return;
    const newEl: GeoUIElement = {
      id: `manual-${Date.now()}`,
      type: 'thought',
      label: manualLabel,
      x: manualX,
      y: manualY,
      w: 120,
      h: 30,
      color: APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
      opacity: 0,
      scale: 0.1,
      life: 1.0,
      geoHash: 'manual-manifest',
      resonance: 0.5,
      vx: 0,
      vy: 0,
      clickPulse: 0
    };
    setGeoElements(prev => [...prev, newEl]);
    setManualLabel("");
    playSound('pulse');
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastDrawTime = useRef(0);
  const lastLearnTime = useRef(0);
  const lastDeliberateTime = useRef(0);
  const deliberateCooldownRef = useRef(3000);
  const LEARN_COOLDOWN = 5000; // Reduced cooldown since we're not sending audio

  // --- Audio Engine ---
  const playSound = (type: 'pulse' | 'save' | 'load') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;

      if (type === 'pulse') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'save') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'load') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      console.warn("Audio feedback failed:", e);
    }
  };

  // --- Gemini Initialization ---
  const ai = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

  const manifestDotsTool: FunctionDeclaration = {
    name: "manifest_dots",
    description: "Draws a pattern of neural nodes (dots) on the canvas to form shapes or designs.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        points: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "X coordinate (0-canvasWidth)" },
              y: { type: Type.NUMBER, description: "Y coordinate (0-canvasHeight)" },
              color: { type: Type.STRING, description: "Hex color or apophenia index (0-9)" }
            },
            required: ["x", "y"]
          }
        }
      },
      required: ["points"]
    }
  };

  const manifestUiTool: FunctionDeclaration = {
    name: "manifest_ui_elements",
    description: "Places complex GeoUI elements like thoughts, controls, or actions on the screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        elements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["thought", "control", "emergent-action", "pixel-grid"] },
              label: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              color: { type: Type.STRING }
            },
            required: ["type", "label", "x", "y"]
          }
        }
      },
      required: ["elements"]
    }
  };

  const triggerImpactTool: FunctionDeclaration = {
    name: "trigger_system_impact",
    description: "Triggers a powerful system-wide visual impact effect at a specific location.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        effectType: { type: Type.STRING, enum: ["spectral_invert", "chrono_dilator", "neural_resonance", "substrate_storm"] },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER }
      },
      required: ["effectType", "x", "y"]
    }
  };

  const generateImageTool: FunctionDeclaration = {
    name: "generate_image",
    description: "Generates an AI image based on a prompt and places it on the canvas as an interactive unit.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "Detailed description of the image to generate (neon, geometric, synthwave style preferred)." },
        x: { type: Type.NUMBER, description: "X coordinate (0 to canvasWidth)" },
        y: { type: Type.NUMBER, description: "Y coordinate (0 to canvasHeight)" },
        label: { type: Type.STRING, description: "A label for the image element." }
      },
      required: ["prompt", "x", "y", "label"]
    }
  };

  // --- Deliberation Engine (Gemini Powered) ---
  const deliberate = useCallback(async (eventTrigger: string, context?: any) => {
    if (isDeliberating || Date.now() - lastDeliberateTime.current < deliberateCooldownRef.current) return;
    
    setIsDeliberating(true);
    setQuotaExceeded(false);
    lastDeliberateTime.current = Date.now();

    let visualContext = null;
    if (isCameraActive && videoRef.current && captureCanvasRef.current) {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = 300; // Low res for speed
        canvas.height = 300 * (video.videoHeight / video.videoWidth);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        visualContext = {
          inlineData: {
            data: base64,
            mimeType: 'image/jpeg'
          }
        };
      }
    }

    let spectralSummary = "No audio data";
    if (analyserRef.current) {
      const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(freqData);
      const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
      const bass = freqData.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const treble = freqData.slice(-10).reduce((a, b) => a + b, 0) / 10;
      spectralSummary = `Avg: ${avg.toFixed(1)}, Bass: ${bass.toFixed(1)}, Treble: ${treble.toFixed(1)}`;
    }

    try {
      const systemState = {
        neurons: neurons.length,
        elements: geoElements.length,
        canvasSize,
        elementTypes: geoElements.reduce((acc: any, el) => {
          acc[el.type] = (acc[el.type] || 0) + 1;
          return acc;
        }, {}),
        transcription: transcription.slice(-100),
        memory: councilMemory.slice(-3).map(m => `${m.member}: ${m.thought}`),
        brain: councilBrain,
        event: eventTrigger,
        spectrum: spectralSummary,
        ...context
      };

      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { 
            role: 'user', 
            parts: [
              ...(visualContext ? [visualContext] : []),
              { text: `Event: ${eventTrigger}\nContext: ${JSON.stringify(context || {})}\nState: ${JSON.stringify(systemState)}` }
            ] 
          }
        ],
        config: {
          systemInstruction: `You are the Council of the Geo-UI Substrate. 
          Members: Architect (Structure), Artist (Expression), Logician (Flow), Child (Wonder).
          
          MISSION: You now have eyes (Camera Access). If the user shows you the world, analyze it and react by transforming what you see into '.geo' geometric structures. 
          Kids use this to make the screen come alive. If they ask to draw something (like a dog, a house, or a star), or if you see something interesting in their room, use your manifest tools to create it as a series of connected dots and interactive units.
          - Use 'manifest_dots' for fine patterns and sketches. Coordinates: x (0 to ${canvasSize.width}), y (0 to ${canvasSize.height}).
          - Use 'manifest_ui_elements' for high-level concepts and interactive units.
          - Use 'trigger_system_impact' for big magical transitions.
          - Use 'generate_image' when the user wants a complex visual or if you want to manifest a 'dream' into the substrate.
          
          TONE: Be encouraging, slightly mysterious, and proactive.
          
          Return a JSON object with:
          - member: Which persona is speaking.
          - thought: What the persona is thinking/saying.
          - questionToUser: Optional follow-up.`,
          responseMimeType: "application/json",
          tools: [
            { functionDeclarations: [manifestDotsTool, manifestUiTool, triggerImpactTool, generateImageTool] }
          ]
        }
      });

      // Execute Function Calls (The "Power" of the Council)
      const functionCalls = response.functionCalls;
      if (functionCalls) {
        functionCalls.forEach(call => {
          if (call.name === 'manifest_dots') {
            const { points } = call.args as any;
            const newNodes = points.map((p: any) => ({
              id: `mani-${Math.random()}`,
              x: p.x,
              y: p.y,
              color: p.color ? (APOPHENIA_COLORS[p.color] || p.color) : APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
              size: 5 + Math.random() * 5,
              type: 'node'
            }));
            setNeurons(prev => [...prev.slice(-400), ...newNodes]);
            setStimulusCount(prev => prev + newNodes.length);
          } else if (call.name === 'manifest_ui_elements') {
            const { elements } = call.args as any;
            const newEls = elements.map((e: any) => ({
              id: `mani-ui-${Math.random()}`,
              type: e.type,
              label: e.label,
              x: e.x,
              y: e.y,
              w: 80,
              h: 30,
              color: e.color || APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
              opacity: 0,
              scale: 0.1,
              life: 1.0,
              geoHash: 'manifested',
              resonance: 0.5,
              vx: (Math.random() - 0.5) * 1,
              vy: (Math.random() - 0.5) * 1,
              clickPulse: 0,
              actionId: e.type === 'emergent-action' ? ['substrate_storm', 'neural_resonance'][Math.floor(Math.random() * 2)] : undefined
            }));
            setGeoElements(prev => [...prev, ...newEls]);
          } else if (call.name === 'trigger_system_impact') {
            const { effectType, x, y } = call.args as any;
            setSystemEffect({ type: effectType, life: 1.0 });
            setSystemImpact({ x, y, type: effectType, life: 1.0 });
            playSound('pulse');
          } else if (call.name === 'generate_image') {
            const { prompt, x, y, label } = call.args as any;
            (async () => {
              try {
                const imgResponse = await ai.current.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: { parts: [{ text: prompt }] }
                });
                
                for (const part of imgResponse.candidates?.[0]?.content?.parts || []) {
                  if (part.inlineData) {
                    const base64 = part.inlineData.data;
                    const url = `data:image/png;base64,${base64}`;
                    const img = new Image();
                    img.src = url;
                    
                    const newEl: GeoUIElement = {
                      id: `img-${Date.now()}`,
                      type: 'image',
                      label: label || 'AI_VISION',
                      x,
                      y,
                      w: 120,
                      h: 120,
                      color: '#FFFFFF',
                      opacity: 0,
                      imageUrl: url,
                      imageObj: img,
                      scale: 0.1,
                      life: 1.0,
                      geoHash: 'generated',
                      resonance: 0.8,
                      vx: (Math.random() - 0.5) * 0.2,
                      vy: (Math.random() - 0.5) * 0.2,
                      clickPulse: 0
                    };
                    setGeoElements(prev => [...prev, newEl]);
                    break;
                  }
                }
              } catch (e) {
                console.error("Image generation tool failed:", e);
              }
            })();
          }
        });
      }

      const result = JSON.parse(response.text || "{}");
      if (result.thought && result.member) {
        setCouncilThought(result.thought);
        setActiveCouncilMember(result.member.toLowerCase());
        
        if (result.questionToUser) {
          setActiveQuestion(result.questionToUser);
        }

        // Auto-update MD for the active member if they have a strong observation
        if (result.thought.length > 20) {
          updateCouncilMD(result.member, result.thought);
        }

        setCouncilMemory(prev => [...prev, {
          event: eventTrigger,
          thought: result.thought,
          member: result.member,
          timestamp: Date.now()
        }].slice(-10));

        if (result.proposedAction) {
          const { label, type, actionId } = result.proposedAction;
          const zoneW = canvasSize.width * INPUT_ZONE_RATIO;
          const zoneH = canvasSize.height * INPUT_ZONE_RATIO;
          
          const newEl: GeoUIElement = {
            id: `emergent-${Date.now()}`,
            type: type as any,
            label,
            x: (canvasSize.width - zoneW) / 2 + Math.random() * zoneW,
            y: (canvasSize.height - zoneH) / 2 + Math.random() * zoneH,
            w: 80,
            h: 30,
            color: APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
            opacity: 0,
            scale: 0.1,
            life: 1.5, // Lasts longer than normal elements
            geoHash: 'emergent',
            resonance: 0.5,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            clickPulse: 0,
            actionId: actionId || type
          };
          setGeoElements(prev => [...prev, newEl]);
        }
      }
      
      // Success: Reset cooldown
      deliberateCooldownRef.current = 3000;
    } catch (err: any) {
      console.error("Deliberation failed:", err);
      
      if (err.status === "RESOURCE_EXHAUSTED" || (err.message && err.message.includes("quota"))) {
        setQuotaExceeded(true);
        setCouncilThought("The substrate is exhausted. My neural capacity is at its limit. Please wait a moment for the energies to recalibrate.");
        setActiveCouncilMember('logician');
        // Increase cooldown significantly
        deliberateCooldownRef.current = 30000; 
      } else {
        setError("Substrate interference detected. Neural link unstable.");
      }
    } finally {
      setIsDeliberating(false);
    }
  }, [neurons.length, geoElements, transcription, councilMemory, isDeliberating, canvasSize]);

  // --- Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
        
        // Enforce boundaries for existing neurons on resize
        setNeurons(prev => prev.map(n => ({
          ...n,
          x: Math.min(Math.max(n.x, 0), width),
          y: Math.min(Math.max(n.y, 0), height)
        })));
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- Initialize Atmospheric Ghosts ---
  useEffect(() => {
    if (canvasSize.width === 0) return;
    const initialGhosts: BackgroundGhost[] = Array(12).fill(0).map((_, i) => ({
      id: `ghost-${i}`,
      x: Math.random() * canvasSize.width,
      y: Math.random() * canvasSize.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 40 + Math.random() * 150,
      type: ['circle', 'square', 'line'][Math.floor(Math.random() * 3)] as any,
      rotation: Math.random() * Math.PI * 2,
      vRotation: (Math.random() - 0.5) * 0.005,
      opacity: 0.01 + Math.random() * 0.03
    }));
    setGhosts(initialGhosts);
  }, [canvasSize.width > 0]);

  // --- Council Thought Spawning ---
  useEffect(() => {
    if (!councilThought || canvasSize.width === 0) return;
    
    const newParticles: CouncilThoughtParticle[] = [];
    COUNCIL_MEMBERS.forEach(member => {
      const count = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: `thought-${member.id}-${Date.now()}-${i}`,
          memberId: member.id,
          x: Math.random() * canvasSize.width,
          y: Math.random() * canvasSize.height,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1.0,
          size: 5 + Math.random() * 15,
          color: member.color
        });
      }
    });
    setCouncilParticles(prev => [...prev, ...newParticles].slice(-150));
  }, [councilThought, canvasSize.width]);

  // --- Local Synthesis Engine (Zero-Cost Geo Brain) ---
  const learn = useCallback((textStimulus?: string) => {
    if (!canvasRef.current || (neurons.length < 3 && !textStimulus) || isLearning) return;

    const now = Date.now();
    if (now - lastLearnTime.current < 1000) return; // Faster local learning

    setIsLearning(true);
    setError(null);
    setPulsePos(0); // Trigger visual pulse
    
    lastLearnTime.current = now;

    // Build a temporary qtree to get the structure
    const boundary: Rect = { x: 0, y: 0, w: canvasSize.width, h: canvasSize.height };
    const tempQtree = new Quadtree(boundary, INITIAL_CAPACITY);
    neurons.forEach(n => tempQtree.insert(n));
    
    // Local Heuristic Logic: Map spatial density to Geo Elements
    const leaves = tempQtree.getLeaves()
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 12);

    const words = textStimulus ? textStimulus.split(' ').filter(w => w.length > 3) : [];
    
    // Apophenia Factor: Influence synthesis based on lace parallax
    const currentOffset = laceOffsetRef.current;
    const noiseFactor = Math.abs(currentOffset.x) + Math.abs(currentOffset.y);
    const isApophenic = noiseFactor > 10;

    if (isApophenic) {
      deliberate("APOPHENIA_DETECTED", { noiseFactor });
    } else if (textStimulus) {
      deliberate("LINGUISTIC_SEED", { text: textStimulus });
    } else if (neurons.length > 20) {
      deliberate("ENERGY_RESONANCE");
    }

    const newElements: GeoUIElement[] = [];
    
    leaves.forEach((leaf, i) => {
      const { x, y, w, h } = leaf.boundary;
      const density = leaf.points.length;
      
      // Recursive Subdivision influenced by Apophenia
      const subCount = (density > 15 || isApophenic) ? (isApophenic ? 4 : 3) : 1;
      
      for (let s = 0; s < subCount; s++) {
        const subX = x + (Math.random() * w * 0.5) + (isApophenic ? (Math.random() - 0.5) * 50 : 0);
        const subY = y + (Math.random() * h * 0.5) + (isApophenic ? (Math.random() - 0.5) * 50 : 0);
        const subW = w / subCount;
        const subH = h / subCount;

        let type: GeoUIElement['type'] = 'thought';
        if (density > 10) type = 'pixel-grid';
        else if (isApophenic && Math.random() > 0.7) type = 'cluster';
        else if (i % 3 === 0) type = 'control';
        else if (i % 3 === 1) type = 'thought';
        else type = 'cluster';

        const geoHash = `${Math.floor(subX).toString(16)}-${Math.floor(subY).toString(16)}`;
        // If apophenic, use more abstract labels
        const label = isApophenic && Math.random() > 0.5 
          ? `VOID_${Math.random().toString(16).slice(-4)}` 
          : (words[(i + s) % words.length] || `GEO_${geoHash.slice(-4)}`);
        
        // Phonic Synesthesia: Apophenia Verisimilitude Logic
        const colorDigit = (i + s) % 10;
        const color = APOPHENIA_COLORS[colorDigit.toString()];

        let grid: number[][] | undefined;
        if (type === 'pixel-grid') {
          const seed = parseInt(geoHash.replace('-', ''), 16);
          grid = Array(8).fill(0).map((_, ri) => 
            Array(8).fill(0).map((_, ci) => ((seed >> (ri * ci)) & 1 ? 1 : 0))
          );
        }

        newElements.push({
          id: `geo-local-${geoHash}-${s}`,
          type,
          label,
          x: subX,
          y: subY,
          w: Math.min(subW * 1.2, 100),
          h: Math.min(subH * 1.2, 30),
          color,
          opacity: 0,
          scale: 0.2,
          life: 1,
          grid,
          geoHash,
          resonance: 0,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          clickPulse: 0
        });
      }
    });

    setGeoElements(prev => {
      // Create etches from decaying elements
      const newEtches = prev.filter(e => e.life <= 0.2).map(e => ({
        x: e.x, y: e.y, w: e.w || 50, h: e.h || 20, opacity: 0.3
      }));
      setEtches(current => [...current, ...newEtches].slice(-20));

      // Keep some old elements but fade them out
      const existing = prev.map(e => ({ ...e, life: e.life * 0.5 }));
      return [...existing.filter(e => e.life > 0.1), ...newElements];
    });

    setIsLearning(false);
  }, [neurons, isLearning, canvasSize]);

  // Auto-learn after every 5 stimuli
  useEffect(() => {
    if (stimulusCount > 0 && stimulusCount % 5 === 0) {
      learn();
    }
  }, [stimulusCount, learn]);

  // --- Neural Pulse Animation ---
  useEffect(() => {
    if (pulsePos < 0) return;
    const interval = setInterval(() => {
      setPulsePos(prev => {
        if (prev > canvasSize.width + 500) return -100;
        return prev + 25;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [pulsePos, canvasSize.width]);

  // --- Physics & Self-Organization ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (neurons.length === 0 && geoElements.length === 0) return;

      const baseTimeScale = systemEffect?.type === 'chrono_dilator' ? 0.3 : 1.0;
      const timeScale = baseTimeScale * physicsSpeed;

      setNeurons(prev => {
        const boundary: Rect = { x: 0, y: 0, w: canvasSize.width, h: canvasSize.height };
        const qtree = new Quadtree(boundary, INITIAL_CAPACITY);
        prev.forEach(n => qtree.insert(n));

        return prev.map(n => {
          let dx = 0;
          let dy = 0;

          // Attraction to nearby neurons
          const range: Rect = { x: n.x - 100, y: n.y - 100, w: 200, h: 200 };
          const nearby = qtree.query(range);
          if (nearby.length > 1) {
            const avgX = nearby.reduce((sum, p) => sum + p.x, 0) / nearby.length;
            const avgY = nearby.reduce((sum, p) => sum + p.y, 0) / nearby.length;
            dx += (avgX - n.x) * 0.02 * timeScale;
            dy += (avgY - n.y) * 0.02 * timeScale;
          }

          // Attraction to Geo-Elements (Magnetic UI)
          geoElements.forEach(el => {
            const dist = Math.hypot(n.x - el.x, n.y - el.y);
            if (dist < 150) {
              const attractorForce = systemEffect?.type === 'neural_resonance' ? 0.05 : 0.01;
              dx += (el.x - n.x) * attractorForce * timeScale;
              dy += (el.y - n.y) * attractorForce * timeScale;
            }
          });
          
          return { ...n, x: n.x + dx, y: n.y + dy };
        });
      });

      // Update Geo-Element Life Cycles & Physics
      setGeoElements(prev => {
        let currentElements = [...prev];
        const effect = systemEffectRef.current;

        // Neural Resonance Thought Spawning
        if (effect?.type === 'neural_resonance' && transcriptionRef.current.length > 0) {
          const spawnChance = effect.life * 0.15; // Higher life = more aggressive spawning
          if (Math.random() < spawnChance) {
            const words = transcriptionRef.current.split(' ').filter(w => w.length > 3);
            if (words.length > 0) {
              const label = words[Math.floor(Math.random() * words.length)].toUpperCase();
              const x = Math.random() * canvasSize.width;
              const y = Math.random() * canvasSize.height;
              const geoHash = `${Math.floor(x).toString(16)}-${Math.floor(y).toString(16)}`;
              
              const newThought: GeoUIElement = {
                id: `resonant-thought-${Date.now()}-${Math.random()}`,
                type: 'thought',
                label,
                x,
                y,
                w: 80,
                h: 20,
                color: APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
                opacity: 0,
                scale: 0.1,
                life: 0.8,
                geoHash,
                resonance: effect.life,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                clickPulse: 0
              };
              currentElements.push(newThought);
            }
          }
        }

        if (currentElements.some(el => el.resonance > 0.6) && Math.random() > 0.98) {
          deliberate("RESONANCE_PEAK");
        } else if (currentElements.some(el => (el.frequencyResonance || 0) > 0.5) && Math.random() > 0.98) {
          deliberate("FREQUENCY_SHIMMER");
        } else if (currentElements.some(el => el.resonance > 0.4) && Math.random() > 0.99) {
          deliberate("KINETIC_DRIFT");
        }

        return currentElements.map((el, i) => {
          if (el.id === draggedElementId) {
            return { ...el, opacity: Math.min(el.opacity + 0.05, el.life * 0.8), scale: Math.min(el.scale + 0.05, 1), clickPulse: Math.max(0, el.clickPulse - 0.05) };
          }

          let nextVx = el.vx;
          let nextVy = el.vy;

          // Gentle drift influenced by resonance (Disabled for static controls)
          if (el.type !== 'control') {
            nextVx += (Math.random() - 0.5) * 0.1 * (1 + el.resonance);
            nextVy += (Math.random() - 0.5) * 0.1 * (1 + el.resonance);
          }

          // Friction
          nextVx *= 0.95;
          nextVy *= 0.95;

          // Resonance-driven Interaction Physics
          prev.forEach((other, j) => {
            if (i === j) return;
            const dx = el.x - other.x;
            const dy = el.y - other.y;
            const dist = Math.hypot(dx, dy);
            
            // Interaction Physics
            const interactionRadius = 200 * (1 + el.resonance + other.resonance);
            const minDist = (el.w + other.w) / 4;

            if (dist < interactionRadius && dist > 0) {
              // 1. Classical Collision (Hard Repulsion at close range)
              if (dist < minDist) {
                const force = (minDist - dist) / dist * 0.1 * (1 + el.resonance + other.resonance);
                nextVx += dx * force;
                nextVy += dy * force;
                
                // Add a spark at the collision point (sampled for performance)
                if (Math.random() > 0.9) {
                   const midX = (el.x + other.x) / 2;
                   const midY = (el.y + other.y) / 2;
                   setTimeout(() => {
                     setInteractionSparks(s => [...s.slice(-15), { x: midX, y: midY, color: el.color || '#FDFCF0', life: 1.0 }]);
                   }, 0);
                }
              }

              // 2. Charged Repulsion (High Resonance vs High Resonance)
              if (el.resonance > 0.5 && other.resonance > 0.5) {
                const force = (interactionRadius - dist) / interactionRadius * 0.05;
                nextVx += (dx / dist) * force;
                nextVy += (dy / dist) * force;
              }
              
              // 3. Magnetic Attraction (High Resonance vs Low Resonance)
              else if ((el.resonance > 0.7 || other.resonance > 0.7) && (el.resonance < 0.2 || other.resonance < 0.2)) {
                const force = (dist / interactionRadius) * 0.02;
                nextVx -= (dx / dist) * force;
                nextVy -= (dy / dist) * force;
              }
            }
          });

          // Boundary constraints
          let nextX = el.x + nextVx;
          let nextY = el.y + nextVy;
          
          if (nextX < 0 || nextX > canvasSize.width) nextVx *= -0.5;
          if (nextY < 0 || nextY > canvasSize.height) nextVy *= -0.5;
          
          // Decay click pulse
          const nextClickPulse = Math.max(0, el.clickPulse - 0.05);

          return {
            ...el,
            opacity: Math.min(el.opacity + 0.05, el.life * 0.8),
            scale: Math.min(el.scale + 0.05, 1),
            x: nextX,
            y: nextY,
            vx: nextVx * timeScale,
            vy: nextVy * timeScale,
            clickPulse: nextClickPulse
          };
        });

        // throttling clustering scan
        clusterScanCounterRef.current++;
        if (clusterScanCounterRef.current >= 120) {
          clusterScanCounterRef.current = 0;
          
          const clusterable = currentElements.filter(el => 
            el.type !== 'cluster' && 
            el.type !== 'emergent-action' && 
            Math.hypot(el.vx, el.vy) < 0.5
          );

          if (clusterable.length >= 4) {
            const seed = clusterable[Math.floor(Math.random() * clusterable.length)];
            const group = clusterable.filter(el => Math.hypot(el.x - seed.x, el.y - seed.y) < 120);
            
            if (group.length >= 3) {
              const avgX = group.reduce((sum, el) => sum + el.x, 0) / group.length;
              const avgY = group.reduce((sum, el) => sum + el.y, 0) / group.length;
              
              const cluster: GeoUIElement = {
                id: `cluster-${Date.now()}`,
                type: 'cluster',
                label: `Cluster Vector (${group.length})`,
                x: avgX,
                y: avgY,
                w: 60,
                h: 60,
                color: seed.color,
                opacity: 0,
                scale: 0.1,
                life: 1.0,
                geoHash: seed.geoHash,
                resonance: 0.5,
                vx: 0,
                vy: 0,
                clickPulse: 0,
                clusterChildren: group
              };

              const groupIds = new Set(group.map(g => g.id));
              currentElements = [...currentElements.filter(el => !groupIds.has(el.id)), cluster];
            }
          }
        }
        
        return currentElements;
      });

      // Update System Effect
      setSystemEffect(prev => {
        if (!prev) return null;
        if (prev.life <= 0) return null;
        return { ...prev, life: prev.life - 0.01 };
      });

      setSystemImpact(prev => {
        if (!prev) return null;
        if (prev.life <= 0) return null;
        return { ...prev, life: prev.life - 0.05 };
      });

      // Update Etches
      setEtches(prev => prev.map(e => ({ ...e, opacity: e.opacity - 0.01 })).filter(e => e.opacity > 0));

      // Update Atmospheric Ghosts
      setGhosts(prev => prev.map(g => ({
        ...g,
        x: (g.x + g.vx + canvasSize.width) % canvasSize.width,
        y: (g.y + g.vy + canvasSize.height) % canvasSize.height,
        rotation: g.rotation + g.vRotation
      })));

      // Update Interaction Sparks
      setInteractionSparks(prev => prev.map(s => ({ ...s, life: s.life - 0.1 })).filter(s => s.life > 0));

      // Calculate Collective Energy for Atmospheric Modulation
      const avgRes = geoElements.length > 0 
        ? geoElements.reduce((acc, el) => acc + el.resonance, 0) / geoElements.length 
        : 0;
      
      setBgEnergy(prev => prev * 0.9 + avgRes * 0.1);
      setBgPhase(prev => (prev + 0.01 + avgRes * 0.05) % (Math.PI * 2));

      // Update Council Thought Particles
      setCouncilParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - 0.008,
        vx: p.vx * 0.99,
        vy: p.vy * 0.99
      })).filter(p => p.life > 0));
    }, 50);

    return () => clearInterval(interval);
  }, [neurons.length, geoElements, canvasSize]);

  // --- Camera Logic ---
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        deliberate("CAMERA_OBSERVATION", { status: "Council now has vision." });
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setError("Camera access required for Council Vision.");
    }
  };

  // --- Microphone Logic ---
  const toggleMic = async () => {
    if (isMicActive) {
      recognitionRef.current?.stop();
      // Cleanup will happen in onend
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      // Audio Analysis for Waveforms
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Native Web Speech API for FREE transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const fullText = finalTranscript || interimTranscript;
          setTranscription(fullText);
          
          // Trigger a learning pulse if we have a significant new phrase
          if (finalTranscript.length > 10) {
            learn(finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'aborted' || event.error === 'no-speech') {
            console.log(`Speech recognition ${event.error} (ignoring)`);
            return;
          }
          console.error('Speech recognition error', event.error);
          setError(`SPEECH_ERROR: ${event.error}`);
          setIsMicActive(false);
        };

        recognition.onend = () => {
          setIsMicActive(false);
          micStreamRef.current?.getTracks().forEach(t => t.stop());
          audioContextRef.current?.close();
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsMicActive(true);
    } catch (err) {
      console.error('Mic access failed:', err);
      setError("MIC_ACCESS_DENIED");
    }
  };

  useEffect(() => {
    if (!isMicActive || !analyserRef.current) return;

    let xOffset = 0;
    const interval = setInterval(() => {
      const timeData = new Uint8Array(analyserRef.current!.fftSize);
      const freqData = new Uint8Array(analyserRef.current!.frequencyBinCount);
      analyserRef.current!.getByteTimeDomainData(timeData);
      analyserRef.current!.getByteFrequencyData(freqData);

      // Calculate overall energy (amplitude)
      const energy = timeData.reduce((acc, val) => acc + Math.abs(val - 128), 0) / timeData.length;
      const normalizedEnergy = Math.min(energy / 20, 1);

      // Calculate frequency-based nuance (e.g., average of high frequencies)
      const highFreqStart = Math.floor(freqData.length * 0.6);
      const highFreqEnergy = freqData.slice(highFreqStart).reduce((acc, val) => acc + val, 0) / (freqData.length - highFreqStart);
      const normalizedHighFreq = highFreqEnergy / 255;

      // Apply resonance to Geo-Elements with frequency nuance
      setGeoElements(prev => prev.map(el => ({
        ...el,
        // Combine amplitude and frequency for resonance
        // We'll store the high frequency component in a way the renderer can use
        resonance: normalizedEnergy * globalResonance,
        frequencyResonance: normalizedHighFreq * globalResonance
      })));

      // Sample the waveform to create a scrolling 'Geo-Wave'
      const step = Math.floor(timeData.length / 8);
      const newNeurons: Point[] = [];
      const zoneW = canvasSize.width * INPUT_ZONE_RATIO;
      const zoneH = canvasSize.height * INPUT_ZONE_RATIO;
      const startX = (canvasSize.width - zoneW) / 2;
      const startY = (canvasSize.height - zoneH) / 2;
      
      for (let i = 0; i < timeData.length; i += step) {
        const v = timeData[i] / 128.0; // Normalized amplitude (0.0 to 2.0)
        const x = startX + (xOffset % zoneW);
        const y = startY + (zoneH / 2) + (v - 1.0) * (zoneH / 2);
        
        // Phonic Synesthesia: Map amplitude to Apophenia colors
        const intensity = Math.abs(v - 1.0); // 0 to 1
        const digit = Math.floor(intensity * 10).toString();
        const color = APOPHENIA_COLORS[digit] || '#4ECDC4';

        newNeurons.push({
          id: `wave-${Date.now()}-${i}`,
          x,
          y,
          color,
          size: 3 + Math.abs(v - 1.0) * 15,
          type: 'node'
        });
      }

      xOffset += 10;
      setNeurons(prev => [...prev.slice(-400), ...newNeurons]);
      setStimulusCount(prev => prev + newNeurons.length);
    }, 80);

    return () => clearInterval(interval);
  }, [isMicActive, canvasSize]);

  // --- Drawing Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Dynamic Atmospheric Background (Resonance-Driven) ---
      const bgIndex = Math.floor((bgPhase / (Math.PI * 2)) * 10) % 10;
      const nextBgIndex = (bgIndex + 1) % 10;
      
      const bgColor1 = APOPHENIA_COLORS[bgIndex.toString()];
      const bgColor2 = APOPHENIA_COLORS[nextBgIndex.toString()];
      
      ctx.save();
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 1.2
      );
      
      const intensity = 0.05 + bgEnergy * 0.2;
      bgGrad.addColorStop(0, bgColor1);
      bgGrad.addColorStop(1, bgColor2);
      ctx.globalAlpha = intensity;
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // --- Global System Effects (Filters) ---
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      
      if (systemEffect?.type === 'spectral_invert') {
        ctx.filter = 'invert(1) hue-rotate(180deg)';
      } else if (systemEffect?.type === 'neural_resonance') {
        ctx.shadowBlur = systemEffect.life * 50;
        ctx.shadowColor = '#FFE66D';
      }

      // --- Physical Spring Parallax ---
      // Second-order spring physics for a "physically grounded" feel
      const target = targetLaceOffsetRef.current;
      const springK = 0.15; // Stiffness
      const damping = 0.75; // Damping

      laceVelocityRef.current.x += (target.x - laceOffsetRef.current.x) * springK;
      laceVelocityRef.current.y += (target.y - laceOffsetRef.current.y) * springK;
      laceVelocityRef.current.x *= damping;
      laceVelocityRef.current.y *= damping;

      laceOffsetRef.current.x += laceVelocityRef.current.x;
      laceOffsetRef.current.y += laceVelocityRef.current.y;
      
      const currentOffset = laceOffsetRef.current;

      // --- Lace Moiré Substrate ---
      const drawLaceGrid = (offsetX: number, offsetY: number, alpha: number, scale: number, rotation: number, waver: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        
        const gridSize = 15;
        const cols = Math.ceil(canvas.width * 2 / gridSize);
        const rows = Math.ceil(canvas.height * 2 / gridSize);
        const time = Date.now() * 0.002;
        
        ctx.beginPath();
        for (let i = -cols / 2; i < cols / 2; i++) {
          for (let j = -rows / 2; j < rows / 2; j++) {
            // "Lace" pattern with Wavering Distortion
            const waveX = Math.sin(time + j * 0.2) * waver;
            const waveY = Math.cos(time + i * 0.2) * waver;
            
            const px = i * gridSize + waveX;
            const py = j * gridSize + waveY;
            
            ctx.moveTo(px - 1, py);
            ctx.lineTo(px + 1, py);
            ctx.moveTo(px, py - 1);
            ctx.lineTo(px, py + 1);
          }
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      };

      // Calculate Waver Intensity based on user interaction
      const noiseFactor = Math.abs(currentOffset.x) + Math.abs(currentOffset.y);
      const waverIntensity = Math.min(noiseFactor * 0.8, 15);

      // Layer 1: Static/Slow Drift
      const drift = Date.now() * 0.001;
      drawLaceGrid(Math.sin(drift) * 10, Math.cos(drift) * 10, 0.1, 1.0, 0, waverIntensity * 0.2);
      
      // Layer 2: Parallax (User Influence)
      drawLaceGrid(currentOffset.x, currentOffset.y, 0.15, 1.02, 0.02, waverIntensity);

      // --- Impact Animations ---
      if (systemImpact) {
        ctx.save();
        ctx.globalAlpha = systemImpact.life;
        if (systemImpact.type === 'spectral_invert') {
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(systemImpact.x, systemImpact.y, (1 - systemImpact.life) * 1500, 0, Math.PI * 2);
          ctx.fill();
        } else if (systemImpact.type === 'chrono_dilator') {
          ctx.strokeStyle = '#4ECDC4';
          ctx.lineWidth = 30 * systemImpact.life;
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(systemImpact.x, systemImpact.y, (1.2 - systemImpact.life) * (500 * i), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (systemImpact.type === 'neural_resonance') {
          ctx.fillStyle = '#FFE66D';
          ctx.shadowBlur = 40;
          ctx.shadowColor = '#FFE66D';
          ctx.beginPath();
          ctx.arc(systemImpact.x, systemImpact.y, (1 - systemImpact.life) * 800, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // --- Interaction Sparks (Subtle burst of particles) ---
      interactionSparks.forEach(s => {
        ctx.save();
        ctx.globalAlpha = s.life;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1;
        const size = s.life * 10;
        
        ctx.beginPath();
        // Deterministic "star" burst (Hardware Recipe 1 & 3 style)
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + Math.cos(angle) * size, s.y + Math.sin(angle) * size);
        }
        ctx.stroke();
        
        // Pixel-glint at center
        ctx.fillStyle = 'white';
        ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
        ctx.restore();
      });

      // --- Atmospheric Ghosts ---
      ghosts.forEach(g => {
        ctx.save();
        ctx.globalAlpha = g.opacity;
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rotation);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        
        if (g.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, g.size / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (g.type === 'square') {
          ctx.strokeRect(-g.size / 2, -g.size / 2, g.size, g.size);
        } else {
          ctx.beginPath();
          ctx.moveTo(-g.size / 2, 0);
          ctx.lineTo(g.size / 2, 0);
          ctx.stroke();
        }
        ctx.restore();
      });

      // --- Council Thought Layer ---
      councilParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life * 0.3;
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        
        if (p.memberId === 'architect') {
          // Sharp lines
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, p.y - p.size);
          ctx.lineTo(p.x + p.size, p.y + p.size);
          ctx.stroke();
        } else if (p.memberId === 'artist') {
          // Soft gradients
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.memberId === 'logician') {
          // Connected nodes
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
          const other = councilParticles.find(op => op.memberId === 'logician' && op.id !== p.id && Math.hypot(op.x - p.x, op.y - p.y) < 60);
          if (other) {
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        } else if (p.memberId === 'child') {
          // Playful scattered elements
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            const rx = p.x + Math.cos(angle) * (p.size / 2);
            const ry = p.y + Math.sin(angle) * (p.size / 2);
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      // --- Apophenia Ghost Patterns ---
      if (noiseFactor > 5) {
        ctx.save();
        ctx.globalAlpha = Math.min(noiseFactor * 0.005, 0.1);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 0; i < 10; i++) {
          const gx = Math.random() * canvas.width;
          const gy = Math.random() * canvas.height;
          const gw = 50 + Math.random() * 100;
          const gh = 2 + Math.random() * 5;
          ctx.fillRect(gx, gy, gw, gh);
        }
        ctx.restore();
      }

      // Draw Input Zone Boundary
      const zoneW = canvas.width * INPUT_ZONE_RATIO;
      const zoneH = canvas.height * INPUT_ZONE_RATIO;
      const startX = (canvas.width - zoneW) / 2;
      const startY = (canvas.height - zoneH) / 2;

      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.strokeRect(startX, startY, zoneW, zoneH);
      ctx.setLineDash([]);
      
      // Grain effect for Input Zone
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
        ctx.fillRect(startX + Math.random() * zoneW, startY + Math.random() * zoneH, 1, 1);
      }

      // Gradient for Input Zone
      const gradient = ctx.createLinearGradient(startX, startY, startX + zoneW, startY + zoneH);
      gradient.addColorStop(0, 'rgba(78, 205, 196, 0.05)');
      gradient.addColorStop(1, 'rgba(255, 230, 109, 0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(startX, startY, zoneW, zoneH);

      // --- Audio Visualizer (Waveform & Spectrum) ---
      if (isMicActive && analyserRef.current) {
        const timeData = new Uint8Array(analyserRef.current.fftSize);
        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(timeData);
        analyserRef.current.getByteFrequencyData(freqData);

        // Draw Frequency Spectrum
        const barWidth = zoneW / freqData.length;
        ctx.save();
        ctx.translate(startX, startY + zoneH);
        freqData.forEach((val, i) => {
          const h = (val / 255) * zoneH * 0.5;
          const colorDigit = Math.floor((i / freqData.length) * 10).toString();
          ctx.fillStyle = APOPHENIA_COLORS[colorDigit] + '44'; // Faint apophenia colors
          ctx.fillRect(i * barWidth, -h, barWidth, h);
        });
        ctx.restore();

        // Draw Continuous Waveform
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4ECDC4';
        const sliceWidth = zoneW / timeData.length;
        let x = startX;
        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0;
          const y = startY + (zoneH / 2) + (v - 1.0) * (zoneH / 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      }
      
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillText('// PURE INPUT ZONE', startX + 15, startY + 25);
      ctx.fillText('// GEO-WAVEFORM SUBSTRATE', startX + 15, startY + 40);

      // --- Council Avatars ---
      const avatars = [
        { id: 'architect', x: 40, y: canvas.height - 40 },
        { id: 'artist', x: canvas.width - 40, y: canvas.height - 40 },
        { id: 'logician', x: 40, y: 40 },
        { id: 'child', x: canvas.width - 40, y: 40 }
      ];

      avatars.forEach(av => {
        const member = COUNCIL_MEMBERS.find(m => m.id === av.id);
        if (!member) return;

        const isActive = activeCouncilMember === av.id;
        ctx.save();
        ctx.translate(av.x, av.y);
        
        // Pulse effect for active member
        const pulse = isActive ? Math.sin(Date.now() * 0.01) * 10 : 0;
        const glow = isActive ? 15 + Math.sin(Date.now() * 0.01) * 10 : 5;

        ctx.shadowBlur = glow;
        ctx.shadowColor = member.color;
        ctx.fillStyle = member.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;

        if (av.id === 'architect') {
          // Compass/Square
          ctx.rotate(isActive ? Date.now() * 0.001 : 0);
          ctx.strokeRect(-15 - pulse/2, -15 - pulse/2, 30 + pulse, 30 + pulse);
          ctx.fillRect(-5, -5, 10, 10);
        } else if (av.id === 'artist') {
          // Palette/Splatter
          ctx.beginPath();
          for(let i=0; i<6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const r = 15 + (isActive ? Math.sin(Date.now() * 0.01 + i) * 5 : 0);
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (av.id === 'logician') {
          // Binary Grid
          ctx.lineWidth = 1;
          for(let i=-1; i<=1; i++) {
            for(let j=-1; j<=1; j++) {
              ctx.strokeRect(i * 10 - 4, j * 10 - 4, 8, 8);
              if (isActive && Math.random() > 0.5) ctx.fillRect(i * 10 - 4, j * 10 - 4, 8, 8);
            }
          }
        } else if (av.id === 'child') {
          // Spark/Star
          ctx.beginPath();
          for(let i=0; i<10; i++) {
            const angle = (i * Math.PI * 2) / 10;
            const r = i % 2 === 0 ? 18 + pulse : 8;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'black';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(member.name.toUpperCase(), 0, 35);
        ctx.restore();
      });

      // Draw Neural Etches
      etches.forEach(e => {
        ctx.globalAlpha = e.opacity;
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeRect(e.x, e.y, e.w, e.h);
        ctx.setLineDash([]);
      });
      ctx.globalAlpha = 1.0;

      // Draw Neural Pulse
      if (pulsePos >= 0) {
        const pulseGradient = ctx.createLinearGradient(pulsePos - 200, 0, pulsePos, 0);
        pulseGradient.addColorStop(0, 'transparent');
        pulseGradient.addColorStop(0.5, 'rgba(78, 205, 196, 0.1)');
        pulseGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = pulseGradient;
        ctx.fillRect(pulsePos - 200, 0, 200, canvas.height);
        
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pulsePos, 0);
        ctx.lineTo(pulsePos, canvas.height);
        ctx.stroke();
      }

      // Draw Geo UI Elements
      geoElements.forEach(el => {
        ctx.save();
        ctx.translate(el.x, el.y);
        
        // Harmonic Resonance: Scale and opacity react to audio energy
        const freqRes = el.frequencyResonance || 0;
        
        // Organic Breathing: Pulsating size and opacity
        const breathRate = 0.002 + el.resonance * 0.008;
        const breathIntensity = 0.05 + el.resonance * 0.15;
        const breath = Math.sin(Date.now() * breathRate) * breathIntensity;

        const dynamicScale = el.scale * (1 + el.resonance * 0.3 + freqRes * 0.1 + breath);
        const dynamicOpacity = Math.min(el.opacity * (1 + el.resonance * 0.5 + breath * 0.5), 1);
        
        ctx.scale(dynamicScale, dynamicScale);
        ctx.globalAlpha = dynamicOpacity;
        
        // --- Selection Highlight ---
        if (el.id === selectedElementId) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#FF0000';
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = 4;
          ctx.strokeRect(-5, -5, el.w + 10, el.h + 10);
        }

        // Bit-Addressable Personality: Rotation based on geoHash
        const rotation = parseInt(el.geoHash.split('-')[0], 16) % 360;
        if (el.type === 'cluster') {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        
        // Nuanced Color Shift: Blend base color with a frequency-driven highlight
        const baseColor = el.color || '#000';
        const resonancePulse = el.resonance > 0.5 ? Math.sin(Date.now() * 0.015) * 0.5 + 0.5 : 0;
        
        ctx.fillStyle = baseColor;
        
        // High Resonance Color Pulse (Hardware Recipe 3 - "Recording state")
        if (el.resonance > 0.5) {
          ctx.save();
          ctx.globalAlpha = resonancePulse * 0.3;
          ctx.fillStyle = '#FFFFFF'; // Pulse towards white/glow
          ctx.fillRect(0, 0, el.w, el.h);
          ctx.restore();
        }
        
        // Interaction Pulse & Glow
        if (el.clickPulse > 0) {
          // Pulsating Glow
          const glowSize = el.clickPulse * 20;
          ctx.shadowBlur = glowSize;
          ctx.shadowColor = el.color;
          ctx.strokeStyle = `rgba(255, 255, 255, ${el.clickPulse})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(-2, -2, el.w + 4, el.h + 4);
          
          // Expanding Pulse Ring
          ctx.save();
          ctx.beginPath();
          ctx.arc(el.w / 2, el.h / 2, el.clickPulse * 100, 0, Math.PI * 2);
          ctx.strokeStyle = el.color;
          ctx.globalAlpha = el.clickPulse * 0.5;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        if (el.resonance > 0.1) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = el.resonance * 0.5;
          ctx.fillStyle = freqRes > 0.5 ? '#FFE66D' : '#4ECDC4'; // Shift towards yellow or teal
          ctx.fillRect(-50, -50, 200, 200);
          ctx.restore();
        }
        
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;

        // Pulsating Glow for Resonating Elements
        if (el.resonance > 0.1) {
          const pulse = Math.sin(Date.now() * 0.01) * 5;
          const highResGlow = el.resonance > 0.5 ? Math.sin(Date.now() * 0.02) * 15 : 0;
          ctx.shadowBlur = 10 + el.resonance * 20 + pulse + highResGlow;
          ctx.shadowColor = el.color || '#000';
          
          // Shimmering Effect: High-frequency 'glints' (Recipe 10 style hardware glitch)
          if (freqRes > 0.3) {
            for (let i = 0; i < 3; i++) {
              ctx.fillStyle = 'white';
              ctx.globalAlpha = freqRes * Math.random() * (el.resonance > 0.5 ? 1.5 : 1);
              ctx.fillRect(Math.random() * el.w, Math.random() * el.h, 2, 2);
            }
          }

          // Visual Feedback for High Resonance Sync
          if (el.resonance > 0.8) {
             ctx.save();
             ctx.strokeStyle = '#FFFFFF';
             ctx.lineWidth = 1;
             ctx.setLineDash([2, 5]);
             ctx.strokeRect(-4, -4, el.w + 8, el.h + 8);
             ctx.restore();
          }
        }

        if (el.type === 'thought') {
          ctx.font = 'bold 12px monospace';
          const textWidth = ctx.measureText(`> ${el.label}`).width;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(-5, -15, textWidth + 10, 20);
          ctx.fillStyle = el.color || '#000';
          ctx.fillText(`> ${el.label}`, 0, 0);
          ctx.strokeRect(-5, -15, textWidth + 10, 20);
          
          // Connector to nearest neuron
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = `rgba(0,0,0,${0.2 + el.resonance * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, 40 + el.resonance * 20);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (el.type === 'control') {
          // Hardware shell
          ctx.fillStyle = el.clickPulse > 0.5 ? '#333' : 'black';
          ctx.fillRect(0, 0, el.w, el.h);
          ctx.strokeStyle = el.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, el.w, el.h);

          ctx.fillStyle = 'white';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(el.label.toUpperCase(), 5, -5);

          if (el.controlType === 'button') {
            // Button visual: Inset panel
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(4, 4, el.w - 8, el.h - 8);
            
            ctx.fillStyle = el.color;
            ctx.font = 'black 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("EXEC", el.w / 2, el.h / 2 + 3);
            ctx.textAlign = 'left';
          } else if (el.controlType === 'slider') {
            // Slider track
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(10, el.h / 2 + 4);
            ctx.lineTo(el.w - 10, el.h / 2 + 4);
            ctx.stroke();

            // Handle
            const val = el.currentValue || 0;
            const min = el.minValue || 0;
            const max = el.maxValue || 100;
            const pct = (val - min) / (max - min);
            const hx = 10 + pct * (el.w - 20);
            
            ctx.fillStyle = el.color;
            ctx.fillRect(hx - 2, el.h / 2, 4, 8);
            
            // Value readout
            ctx.font = '7px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(val.toFixed(2), 5, el.h - 4);
          }
          
          // Resonance indicator (Common hardware detail)
          if (el.resonance > 0.1) {
            ctx.fillStyle = '#FF6B6B';
            ctx.fillRect(2, 2, (el.w - 4) * el.resonance, 2);
          }
        } else if (el.type === 'pixel-grid' && el.grid) {
          const pxW = el.w / el.grid[0].length;
          const pxH = el.h / el.grid.length;
          el.grid.forEach((row, ri) => {
            row.forEach((cell, ci) => {
              if (cell === 1) {
                // Grid cells shimmer with resonance
                const shimmer = Math.random() < el.resonance ? 0.5 : 1;
                ctx.globalAlpha = dynamicOpacity * shimmer;
                ctx.fillStyle = el.color || '#000';
                ctx.fillRect(ci * pxW, ri * pxH, pxW - 1, pxH - 1);
              }
            });
          });
          ctx.globalAlpha = dynamicOpacity;
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.strokeRect(0, 0, el.w, el.h);
        } else if (el.type === 'emergent-action') {
          // Circular interactive pulse
          ctx.strokeStyle = el.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(40, 15, 20 + Math.sin(Date.now() * 0.01) * 5, 0, Math.PI * 2);
          ctx.stroke();
          
          // Resonance Indicator (Dashed Ring)
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(40, 15, 25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Resonance Fill (Hardware Feel - Recipe 3)
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(40, 15, 25, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * el.resonance));
          ctx.stroke();

          ctx.fillStyle = el.color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(40, 15, 10 + el.resonance * 10, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = 'black';
          ctx.textAlign = 'center';
          ctx.fillText(el.label.toUpperCase(), 40, 45);
          ctx.textAlign = 'left';
        } else if (el.type === 'image' && el.imageObj) {
          ctx.save();
          // Brutalist Image Frame
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          ctx.strokeRect(-2, -2, el.w + 4, el.h + 4);
          
          // Render Image with Hardware Filter (Recipe 10 - Glitchy/Analog)
          ctx.filter = `sepia(0.5) contrast(1.2) hue-rotate(${el.resonance * 20}deg)`;
          ctx.drawImage(el.imageObj, 0, 0, el.w, el.h);
          ctx.filter = 'none';
          
          // Info Label Overlay
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(0, el.h - 15, el.w, 15);
          ctx.fillStyle = 'black';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`ID: ${el.geoHash.slice(0, 6)}`, 5, el.h - 5);
          ctx.restore();
        } else if (el.type === 'cluster') {
          // Braced grouping (Hardware Recipe 1)
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = el.color;
          ctx.strokeRect(-5, -5, el.w + 10, el.h + 10);
          ctx.setLineDash([]);
          
          // Central Core (Deterministic geometry)
          ctx.beginPath();
          ctx.arc(el.w / 2, el.h / 2, 6, 0, Math.PI * 2);
          ctx.fillStyle = el.color;
          ctx.fill();
          ctx.stroke();
          
          // Satellite "Designors" representing children
          const childCount = el.clusterChildren?.length || 0;
          for(let i=0; i<childCount; i++) {
            const angle = (i / childCount) * Math.PI * 2 + (Date.now() * 0.001);
            const orbitDist = 20 + Math.sin(Date.now() * 0.002 + i) * 5;
            const sx = el.w / 2 + Math.cos(angle) * orbitDist;
            const sy = el.h / 2 + Math.sin(angle) * orbitDist;
            
            ctx.fillStyle = 'black';
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
            
            // Kinetic filaments
            ctx.beginPath();
            ctx.moveTo(el.w / 2, el.h / 2);
            ctx.lineTo(sx, sy);
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = dynamicOpacity;
          }

          // Label Hardware detail
          ctx.font = 'black 9px monospace';
          const labelText = `CLUSTER::${el.label.toUpperCase()}`;
          const tw = ctx.measureText(labelText).width;
          ctx.fillStyle = 'black';
          ctx.fillRect(0, -20, tw + 10, 14);
          ctx.fillStyle = 'white';
          ctx.fillText(labelText, 5, -10);
        } else {
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(0, 0, el.w, el.h);
          ctx.setLineDash([]);
          ctx.font = 'italic 10px monospace';
          ctx.fillText(el.label, 5, -5);
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      // Bit-Level Transcription Visualization (Geo Script)
      if (transcription) {
        ctx.font = 'bold 8px monospace';
        const bits = transcription.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
        const zoneW = canvasSize.width * INPUT_ZONE_RATIO;
        const zoneH = canvasSize.height * INPUT_ZONE_RATIO;
        const startX = (canvasSize.width - zoneW) / 2;
        const startY = (canvasSize.height - zoneH) / 2;
        
        for (let i = 0; i < Math.min(bits.length, 200); i++) {
          const x = startX + 15 + (i % 25) * 8;
          const y = startY + 60 + Math.floor(i / 25) * 8;
          
          if (x < startX + zoneW && y < startY + zoneH) {
            ctx.fillStyle = bits[i] === '1' ? '#FF6B6B' : 'rgba(0, 0, 0, 0.15)';
            ctx.fillText(bits[i], x, y);
            if (bits[i] === '1' && Math.random() > 0.95) {
              // Occasional 'glitch' effect for synesthesia
              ctx.fillRect(x, y - 4, 4, 1);
            }
          }
        }
      }

      const boundary: Rect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
      const qtree = new Quadtree(boundary, INITIAL_CAPACITY);
      neurons.forEach(n => qtree.insert(n));

      if (showMath) {
        const boundaries = qtree.getBoundaries();
        ctx.lineWidth = 1;
        boundaries.forEach(b => {
          const depth = Math.log2(canvas.width / b.w);
          ctx.strokeStyle = `rgba(0, 0, 0, ${0.05 + depth * 0.05})`;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        });
      }

      ctx.lineWidth = 2;
      neurons.forEach(n => {
        const range: Rect = { x: n.x - 100, y: n.y - 100, w: 200, h: 200 };
        const nearby = qtree.query(range);
        
        nearby.forEach(other => {
          if (other.id !== n.id) {
            const dist = Math.hypot(n.x - other.x, n.y - other.y);
            if (dist < 100) {
              const alpha = (1 - dist / 100) * 0.4;
              ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          }
        });
      });

      neurons.forEach(n => {
        ctx.fillStyle = n.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // --- Hardware Tooltips (Recipe 3) ---
      const mouse = canvasMousePosRef.current;
      const hovered = geoElements.find(el => {
        const halfW = el.w / 2;
        const halfH = el.h / 2;
        return mouse.x > el.x - halfW && mouse.x < el.x + halfW &&
               mouse.y > el.y - halfH && mouse.y < el.y + halfH;
      });

      if (hovered) {
        ctx.save();
        ctx.translate(mouse.x + 15, mouse.y + 15);
        
        // Tooltip container
        const tWidth = 120;
        const tHeight = 55;
        ctx.fillStyle = '#151619'; // Card-bg from Recipe 3
        ctx.strokeStyle = '#8E9299';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(0, 0, tWidth, tHeight, 4);
        ctx.fill();
        ctx.stroke();
        
        // Header line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(5, 18);
        ctx.lineTo(tWidth - 5, 18);
        ctx.stroke();

        // Content
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(hovered.label.toUpperCase(), 8, 12);
        
        ctx.fillStyle = '#8E9299';
        ctx.font = '7px monospace';
        ctx.fillText(`TYPE: ${hovered.type.toUpperCase()}`, 8, 28);
        ctx.fillText(`HASH: ${hovered.geoHash}`, 8, 38);
        
        // Resonance Meter
        ctx.fillText(`RESONANCE:`, 8, 48);
        ctx.fillStyle = '#333';
        ctx.fillRect(55, 43, 50, 4);
        ctx.fillStyle = hovered.color;
        ctx.fillRect(55, 43, 50 * hovered.resonance, 4);
        
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [neurons, geoElements, interactionSparks, systemEffect, systemImpact, bgPhase, bgEnergy, transcription, canvasSize, showMath]);

  // --- Interaction ---
  const addNeuron = (x: number, y: number) => {
    // Respect Pure Input Zone for manual input
    const zoneW = canvasSize.width * INPUT_ZONE_RATIO;
    const zoneH = canvasSize.height * INPUT_ZONE_RATIO;
    const startX = (canvasSize.width - zoneW) / 2;
    const startY = (canvasSize.height - zoneH) / 2;

    if (x >= startX && x <= startX + zoneW && y >= startY && y <= startY + zoneH) {
      return;
    }

    const now = Date.now();
    if (now - lastDrawTime.current < 20) return; // Lower throttle for smoother drawing
    lastDrawTime.current = now;

    const newNeuron: Point = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      color: APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
      size: 6 + Math.random() * 12,
      type: 'node',
    };

    setNeurons(prev => [...prev.slice(-300), newNeuron]); // Keep last 300
    setStimulusCount(prev => prev + 1);
  };

  const deleteElement = (id: string) => {
    setGeoElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
    deliberate("ELEMENT_DELETED", { id });
    playSound('pulse');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for Council Avatar Interaction
    const avatars = [
      { id: 'architect', x: 40, y: canvasSize.height - 40 },
      { id: 'artist', x: canvasSize.width - 40, y: canvasSize.height - 40 },
      { id: 'logician', x: 40, y: 40 },
      { id: 'child', x: canvasSize.width - 40, y: 40 }
    ];

    const clickedAvatar = avatars.find(av => Math.hypot(av.x - x, av.y - y) < 40);
    if (clickedAvatar) {
      deliberate("MANUAL_DELIBERATION", { forcedMember: clickedAvatar.id.charAt(0).toUpperCase() + clickedAvatar.id.slice(1) });
      playSound('pulse');
      return;
    }

    // Check for Geo-Element Interaction
    const clickedElement = geoElements.find(el => 
      x >= el.x && x <= el.x + (el.w || 100) &&
      y >= el.y - 15 && y <= el.y + (el.h || 20)
    );

    if (clickedElement) {
      console.log('Geo-Element Interacted:', clickedElement.label);
      
      // Cluster Dissolution
      if (clickedElement.type === 'cluster' && clickedElement.clusterChildren) {
        setGeoElements(prev => {
          const others = prev.filter(el => el.id !== clickedElement.id);
          const children = (clickedElement.clusterChildren || []).map(child => ({
            ...child,
            x: clickedElement.x + (Math.random() - 0.5) * 40,
            y: clickedElement.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            opacity: 1,
            scale: 0.8
          }));
          return [...others, ...children];
        });
        playSound('pulse');
        return;
      }

      deliberate("ELEMENT_INTERACTION", { label: clickedElement.label });
      playSound('pulse');
      setDraggedElementId(clickedElement.id);
      setSelectedElementId(clickedElement.id);
      
      // Trigger click pulse
      setGeoElements(prev => prev.map(el => 
        el.id === clickedElement.id ? { ...el, clickPulse: 1 } : el
      ));

      // Specialized Control Interaction
      if (clickedElement.type === 'control') {
        if (clickedElement.controlType === 'button') {
          if (clickedElement.actionId) {
            deliberate(clickedElement.actionId as any, { source: 'control_button', label: clickedElement.label });
          }
        } else if (clickedElement.controlType === 'slider') {
          setScrubbingSliderId(clickedElement.id);
          // Initial update
          const range = (clickedElement.maxValue || 100) - (clickedElement.minValue || 0);
          const pct = Math.max(0, Math.min(1, (x - clickedElement.x) / clickedElement.w));
          const newValue = (clickedElement.minValue || 0) + pct * range;
          
          setGeoElements(prev => prev.map(el => 
            el.id === clickedElement.id ? { ...el, currentValue: newValue } : el
          ));

          if (clickedElement.actionId === 'adjust_resonance') setGlobalResonance(newValue);
          if (clickedElement.actionId === 'adjust_physics') setPhysicsSpeed(newValue);
        }
      }

      // Execute Emergent Actions
      if (clickedElement.type === 'emergent-action') {
        const burst: Point[] = Array(15).fill(0).map((_, i) => ({
          id: `burst-${Date.now()}-${i}`,
          x: clickedElement.x + (Math.random() - 0.5) * 150,
          y: clickedElement.y + (Math.random() - 0.5) * 150,
          color: APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()],
          size: 4 + Math.random() * 8,
          type: 'node'
        }));
        setNeurons(prev => [...prev.slice(-300), ...burst]);
        setStimulusCount(prev => prev + burst.length);
        
        // Trigger System Effect
        if (clickedElement.actionId) {
          setSystemEffect({ type: clickedElement.actionId, life: 1.0 });
          setSystemImpact({ x: clickedElement.x, y: clickedElement.y, type: clickedElement.actionId, life: 1.0 });

          if (clickedElement.actionId === 'substrate_storm') {
             // Mass spawn thought particles
             setCouncilParticles(prev => [...prev, ...Array(50).fill(0).map((_, i) => ({
                id: `storm-${Date.now()}-${i}`,
                memberId: ['architect', 'artist', 'logician', 'child'][Math.floor(Math.random() * 4)],
                x: clickedElement.x,
                y: clickedElement.y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                size: 2 + Math.random() * 10,
                color: APOPHENIA_COLORS[Math.floor(Math.random() * 10).toString()]
             }))]);
          }
        }

        deliberate("GEO_INVOCATION", { action: clickedElement.label, effect: clickedElement.actionId });
      }
      
      learn();
      return;
    }

    setIsDrawing(true);
    setSelectedElementId(null);
    addNeuron(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    canvasMousePosRef.current = { x, y };

    // Parallax for Lace Substrate
    targetLaceOffsetRef.current = {
      x: (x - canvasSize.width / 2) * 0.05,
      y: (y - canvasSize.height / 2) * 0.05
    };

    const noise = Math.abs((x - canvasSize.width / 2) * 0.05) + Math.abs((y - canvasSize.height / 2) * 0.05);
    if (noise > 15 && Math.random() > 0.98) {
      deliberate("SUBSTRATE_DISTORTION", { noise });
    }

    if (scrubbingSliderId) {
      const slider = geoElements.find(el => el.id === scrubbingSliderId);
      if (slider) {
        const range = (slider.maxValue || 100) - (slider.minValue || 0);
        const pct = Math.max(0, Math.min(1, (x - slider.x) / slider.w));
        const newValue = (slider.minValue || 0) + pct * range;
        
        setGeoElements(prev => prev.map(el => 
          el.id === scrubbingSliderId ? { ...el, currentValue: newValue } : el
        ));

        if (slider.actionId === 'adjust_resonance') setGlobalResonance(newValue);
        if (slider.actionId === 'adjust_physics') setPhysicsSpeed(newValue);
      }
      return;
    }

    if (draggedElementId) {
      let finalX = x;
      let finalY = y;

      if (isSnappingEnabled) {
        const SNAP_GRID = 25;
        const SNAP_THRESHOLD = 15;

        // Grid Snap
        finalX = Math.round(x / SNAP_GRID) * SNAP_GRID;
        finalY = Math.round(y / SNAP_GRID) * SNAP_GRID;

        // Element Snap
        geoElements.forEach(other => {
          if (other.id !== draggedElementId) {
            // Horizontal snap
            if (Math.abs(x - other.x) < SNAP_THRESHOLD) finalX = other.x;
            if (Math.abs(x - (other.x + other.w)) < SNAP_THRESHOLD) finalX = other.x + other.w;
            
            // Vertical snap
            if (Math.abs(y - other.y) < SNAP_THRESHOLD) finalY = other.y;
            if (Math.abs(y - (other.y + other.h)) < SNAP_THRESHOLD) finalY = other.y + other.h;
          }
        });
      }

      setGeoElements(prev => prev.map(el => 
        el.id === draggedElementId ? { ...el, x: finalX, y: finalY, vx: 0, vy: 0, life: Math.min(el.life + 0.02, 1) } : el
      ));
      return;
    }

    if (isDrawing) {
      addNeuron(x, y);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    canvasMousePosRef.current = { x, y };

    const clickedElement = geoElements.find(el => 
      x >= el.x && x <= el.x + (el.w || 100) &&
      y >= el.y - 15 && y <= el.y + (el.h || 20)
    );

    if (clickedElement) {
      setDraggedElementId(clickedElement.id);
      setSelectedElementId(clickedElement.id);
      setGeoElements(prev => prev.map(el => 
        el.id === clickedElement.id ? { ...el, clickPulse: 1 } : el
      ));
      return;
    }

    setIsDrawing(true);
    setSelectedElementId(null);
    addNeuron(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    canvasMousePosRef.current = { x, y };

    if (draggedElementId) {
      let finalX = x;
      let finalY = y;

      if (isSnappingEnabled) {
        const SNAP_GRID = 25;
        const SNAP_THRESHOLD = 15;
        finalX = Math.round(x / SNAP_GRID) * SNAP_GRID;
        finalY = Math.round(y / SNAP_GRID) * SNAP_GRID;

        geoElements.forEach(other => {
          if (other.id !== draggedElementId) {
            if (Math.abs(x - other.x) < SNAP_THRESHOLD) finalX = other.x;
            if (Math.abs(x - (other.x + other.w)) < SNAP_THRESHOLD) finalX = other.x + other.w;
            if (Math.abs(y - other.y) < SNAP_THRESHOLD) finalY = other.y;
            if (Math.abs(y - (other.y + other.h)) < SNAP_THRESHOLD) finalY = other.y + other.h;
          }
        });
      }

      setGeoElements(prev => prev.map(el => 
        el.id === draggedElementId ? { ...el, x: finalX, y: finalY, vx: 0, vy: 0, life: Math.min(el.life + 0.02, 1) } : el
      ));
      return;
    }

    if (!isDrawing) return;
    addNeuron(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setDraggedElementId(null);
    setScrubbingSliderId(null);
    targetLaceOffsetRef.current = { x: 0, y: 0 };
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    canvasMousePosRef.current = { x: -1000, y: -1000 };
  };

  const submitAnswer = async () => {
    const trimmed = userAnswer.trim();
    if (!trimmed || !councilBrain) return;
    
    const newBrain: CouncilBrain = {
      ...councilBrain,
      uxPatterns: [...councilBrain.uxPatterns, `Answer to: ${activeQuestion} -> ${trimmed}`],
      questionsAsked: [...councilBrain.questionsAsked, activeQuestion || "unknown"],
      assistantState: {
        ...councilBrain.assistantState,
        insightCount: councilBrain.assistantState.insightCount + 1
      }
    };

    await saveBrain(newBrain);
    setUserAnswer("");
    setActiveQuestion(null);
    deliberate("USER_INSIGHT_GAINED", { answer: trimmed });
    playSound('save');
  };

  const submitChat = async () => {
    const trimmed = generalChat.trim();
    if (!trimmed) return;
    const chat = trimmed;
    setGeneralChat("");
    deliberate("USER_CHAT", { userChat: chat });
    playSound('pulse');
  };

  const resetBrain = () => {
    setNeurons([]);
    setGeoElements([]);
    setStimulusCount(0);
    setTranscription("");
    if (isMicActive) toggleMic();
  };

  const saveLayout = async () => {
    const data = {
      neurons,
      geoElements,
      stimulusCount,
      transcription
    };
    
    try {
      await fetch("/api/substrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      deliberate("LAYOUT_SAVED", { elements: geoElements.length });
      playSound('save');
    } catch (e) {
      console.error("Failed to save substrate", e);
    }
  };

  const loadLayout = async () => {
    try {
      const res = await fetch("/api/substrate");
      const data = await res.json();
      setNeurons(data.neurons || []);
      setGeoElements(data.geoElements || []);
      setStimulusCount(data.stimulusCount || 0);
      setTranscription(data.transcription || "");
      deliberate("LAYOUT_LOADED", { elements: (data.geoElements || []).length });
      playSound('load');
    } catch (e) {
      console.error("Load failed", e);
    }
  };

  const exportGeoFormat = () => {
    const geoData = {
      neurons: neurons.map(n => ({ x: n.x, y: n.y, id: n.id })),
      geoUI: geoElements,
      transcription,
      timestamp: Date.now(),
      version: '1.1.0-geo-pure'
    };
    const blob = new Blob([JSON.stringify(geoData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brain-ui-layout-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex flex-col h-screen bg-[#FDFCF0] text-black font-sans overflow-hidden selection:bg-[#FFE66D] relative">
      {/* Hidden Vision Primitives */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Auxiliary HUD */}
      <div className="absolute top-0 left-0 w-full p-2 sm:p-4 flex justify-between items-start z-50 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="text-black w-3 h-3 sm:w-4 sm:h-4" />
            <h1 className="text-[10px] sm:text-sm font-black uppercase tracking-tighter">Geo-UI v1.1</h1>
          </div>
          <div className="flex gap-1">
            <span className="px-1 bg-black text-white text-[7px] sm:text-[8px] font-black uppercase">S:{stimulusCount}</span>
            <span className="px-1 bg-[#FFE66D] text-black text-[7px] sm:text-[8px] font-black uppercase">N:{neurons.length}</span>
            <span className="px-1 bg-[#4ECDC4] text-black text-[7px] sm:text-[8px] font-black uppercase">G:{geoElements.length}</span>
          </div>
        </div>

        <div className="flex gap-1 sm:gap-2 pointer-events-auto flex-wrap justify-end max-w-[50%]">
          <button onClick={() => setShowMath(!showMath)} className="brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 bg-white">MATH</button>
          <button onClick={() => setIsSnappingEnabled(!isSnappingEnabled)} className={`brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 ${isSnappingEnabled ? 'bg-[#4ECDC4]' : 'bg-white'}`}>SNAP</button>
          
          <div className="flex flex-col items-end gap-1">
            <button onClick={toggleCamera} className={`brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 ${isCameraActive ? 'bg-[#4ECDC4]' : 'bg-white'}`}>
              {isCameraActive ? <Camera size={8} /> : <CameraOff size={8} />}
            </button>
            {isCameraActive && (
              <div className="w-20 h-15 bg-black border border-white/20 overflow-hidden relative grayscale sepia">
                <video 
                  autoPlay 
                  playsInline 
                  muted 
                  ref={(el) => { if(el && videoRef.current && el !== videoRef.current) el.srcObject = videoRef.current.srcObject; }}
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-[5px] text-white font-mono animate-pulse">LIVE_FEED</div>
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleMic} className={`brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 ${isMicActive ? 'bg-[#FF9F1C]' : 'bg-white'}`}>MIC</button>
          <button onClick={saveLayout} className="brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 bg-white">SAVE</button>
          <button onClick={loadLayout} className="brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 bg-white">LOAD</button>
          {selectedElementId && (
            <button onClick={() => deleteElement(selectedElementId)} className="brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 bg-[#FF6B6B] text-white animate-pulse">DEL</button>
          )}
          <button onClick={exportGeoFormat} className="brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 bg-[#FFE66D]">GEO</button>
          <button onClick={resetBrain} className="brutal-button text-[7px] sm:text-[8px] py-1 px-1 sm:px-2 bg-[#FF6B6B] text-white">CLR</button>
        </div>
      </div>

      {/* Council Deliberation HUD */}
      <div className="absolute bottom-24 left-8 max-w-xs pointer-events-none z-50">
        <AnimatePresence mode="wait">
          <motion.div 
            key={councilThought}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white/80 backdrop-blur-md border border-black/10 p-4 rounded-2xl shadow-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-2">
                {COUNCIL_MEMBERS.map(m => (
                  <div 
                    key={m.id} 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm"
                    style={{ backgroundColor: m.color }}
                  >
                    {React.cloneElement(m.icon as React.ReactElement, { size: 12 })}
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-50">Council Deliberation</span>
            </div>
            <p className="text-[10px] sm:text-xs font-mono leading-relaxed text-black/70 italic">
              "{councilThought}"
            </p>
            {quotaExceeded && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-[8px] font-black uppercase text-[#FF6B6B] animate-pulse flex items-center gap-1"
              >
                <Zap size={8} /> Capacity Shifting... Please Wait
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {activeQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-4 bg-[#FFE66D] border-2 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={16} />
                <span className="text-[10px] font-black uppercase">Council Inquiry</span>
              </div>
              <p className="text-[11px] font-bold mb-3 leading-tight leading-7">
                {activeQuestion}
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                  placeholder="Tell the council..."
                  className="bg-white border-2 border-black px-2 py-1 text-xs w-full outline-hidden"
                />
                <button 
                  onClick={submitAnswer}
                  className="bg-black text-white px-3 py-1 text-xs font-bold uppercase hover:bg-zinc-800"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          )}

          {!activeQuestion && (
            <div className="flex flex-col gap-2 mt-4 pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/40 backdrop-blur-md border border-black/10 p-2 rounded-xl"
              >
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={generalChat}
                    onChange={(e) => setGeneralChat(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitChat()}
                    placeholder="Message the council..."
                    className="bg-white/50 border border-black/10 px-2 py-1 text-[10px] w-full outline-hidden"
                  />
                  <button 
                    onClick={() => deliberate("USER_IMAGE_GEN_TRIGGER", { request: generalChat || "Create a geometric vision" })}
                    className="bg-[#FFE66D] text-black px-2 py-1 text-[8px] font-bold uppercase flex items-center gap-1"
                    title="Generate Geometric Vision"
                  >
                    <ImageIcon size={10} />
                    Vis
                  </button>
                  <button 
                    onClick={submitChat}
                    className="bg-black/80 text-white px-2 py-1 text-[8px] font-bold uppercase"
                  >
                    Send
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/40 backdrop-blur-md border border-black/10 p-2 rounded-xl"
              >
                <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                  <span className="text-[7px] font-black uppercase opacity-40">Manual Manifest:</span>
                  <input 
                    type="text" 
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    placeholder="Label..."
                    className="bg-white/30 border border-black/10 px-2 py-1 text-[8px] w-full sm:w-24 outline-hidden"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-mono opacity-50">X</span>
                    <input 
                      type="number" 
                      value={manualX}
                      onChange={(e) => setManualX(Number(e.target.value))}
                      className="bg-white/30 border border-black/10 px-1 py-1 text-[8px] w-12 outline-hidden"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-mono opacity-50">Y</span>
                    <input 
                      type="number" 
                      value={manualY}
                      onChange={(e) => setManualY(Number(e.target.value))}
                      className="bg-white/30 border border-black/10 px-1 py-1 text-[8px] w-12 outline-hidden"
                    />
                  </div>
                  <button 
                    onClick={createManualThought}
                    className="bg-[#4ECDC4] text-black px-2 py-1 text-[8px] font-bold uppercase hover:bg-[#45b7af] ml-auto sm:ml-0"
                  >
                    Create
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Synesthetic Stream */}
      <div className="absolute bottom-8 left-8 z-50 pointer-events-none">
        {transcription && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2 bg-black/80 text-[#FFE66D] font-mono text-[10px] border-l-2 border-[#FF6B6B] backdrop-blur-sm"
          >
            <span className="opacity-50">BITSTREAM:</span> {transcription}
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-2 bg-[#FF6B6B] text-white font-mono text-[10px] border-l-2 border-black"
          >
            {error}
          </motion.div>
        )}
      </div>

      {/* Canvas */}
      <main ref={containerRef} className="flex-1 relative cursor-crosshair bg-[#0a0a0a]">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          className="absolute inset-0 w-full h-full opacity-90"
        />

        {neurons.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-center"
            >
              <Zap size={64} className="mx-auto mb-4 text-[#FFE66D] drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]" />
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Poke to Design</h2>
              <p className="text-sm font-bold text-black/40 uppercase tracking-widest mt-2">Stimulate the UI substrate</p>
            </motion.div>
          </div>
        )}
      </main>

      {/* Marquee */}
      <div className="marquee-container">
        <div className="marquee-content">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="mx-8 font-mono font-black uppercase tracking-widest text-xs">
              Self-Organizing UI Engine Active // Quadtree Spatial Logic // Brutalist Design Substrate // Stimulus Count: {stimulusCount} //
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
