export interface SpriteState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
  isStatic: boolean;
  variables?: Record<string, any>;
}

export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0 to 1
}

export interface GameState {
  sprites: SpriteState[];
  texts: TextState[];
  particles: ParticleState[];
  camera: { x: number, y: number };
  frame: number;
  flash?: { color: string, opacity: number };
}

export interface TextState {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

// Layout: [x, y, vx, vy, rotation, size, opacity, flipX, flipY, isStatic] = 10 floats per sprite
const SPRITE_DATA_SIZE = 10;
const MAX_SPRITES = 100;

interface Thread {
  actions: any[];
  ptr: number;
  waitTimer: number;
  loop: boolean;
}

export class MomentumEngine {
  private historyBuffer: Float32Array;
  private currentBuffer: Float32Array;
  private spriteColors: string[] = [];
  private spriteIds: string[] = [];
  private texts: TextState[] = [];
  private cameraX = 0;
  private cameraY = 0;
  private spriteThreads: Thread[][] = []; // Each sprite has a list of threads
  private spriteTweens: any[][] = []; // Each sprite has a list of active tweens
  private spriteAppearanceStates: (any | null)[] = []; // Persistent appearance state per sprite
  private spriteShakeTimers: number[] = []; // Temporary shake duration per sprite
  private spriteVariables: Map<string, any>[] = []; // Local variables per sprite
  private particles: ParticleState[] = [];
  private screenFlash: { color: string, duration: number, current: number } | null = null;
  private database: Map<string, any> = new Map();
  private groups: Map<string, Set<number>> = new Map();
  private maxHistory = 600;
  private historyPtr = 0;
  private historyCount = 0;
  private frame = 0;
  private screenShake = 0;

  constructor() {
    this.currentBuffer = new Float32Array(MAX_SPRITES * SPRITE_DATA_SIZE);
    this.historyBuffer = new Float32Array(this.maxHistory * MAX_SPRITES * SPRITE_DATA_SIZE);
    this.reset();
  }

  reset() {
    this.frame = 0;
    this.historyPtr = 0;
    this.historyCount = 0;
    this.spriteIds = [];
    this.spriteColors = [];
    this.texts = [];
    this.particles = [];
    this.screenFlash = null;
    this.database.clear();
    this.groups.clear();
    this.cameraX = 0;
    this.cameraY = 0;
    this.screenShake = 0;
    this.spriteThreads = [];
    this.spriteTweens = [];
    this.spriteAppearanceStates = [];
    this.spriteShakeTimers = [];
    this.spriteVariables = [];
    this.currentBuffer.fill(0);
  }

  addSprite(x: number, y: number, size: number, color: string = '#3b82f6', isStatic: boolean = false) {
    if (this.spriteIds.length >= MAX_SPRITES) return;
    
    const i = this.spriteIds.length;
    const idx = i * SPRITE_DATA_SIZE;
    const id = `sprite_${i}`;
    
    this.spriteIds.push(id);
    this.spriteColors.push(color);
    this.spriteThreads.push([]);
    this.spriteTweens.push([]);
    this.spriteAppearanceStates.push(null);
    this.spriteShakeTimers.push(0);
    this.spriteVariables.push(new Map());
    
    this.currentBuffer[idx] = x;
    this.currentBuffer[idx + 1] = y;
    this.currentBuffer[idx + 2] = isStatic ? 0 : Math.random() * 4 - 2; // vx
    this.currentBuffer[idx + 3] = isStatic ? 0 : Math.random() * 4 - 2; // vy
    this.currentBuffer[idx + 4] = 0; // rotation
    this.currentBuffer[idx + 5] = size;
    this.currentBuffer[idx + 6] = 1.0; // opacity
    this.currentBuffer[idx + 7] = 0; // flipX (0 = false, 1 = true)
    this.currentBuffer[idx + 8] = 0; // flipY
    this.currentBuffer[idx + 9] = isStatic ? 1 : 0;
  }

  private applyAppearance(i: number, idx: number, app: any, logic: any) {
    this.spriteAppearanceStates[i] = app;
    this.internalApplyAppearance(i, idx, app, logic);
  }

  private internalApplyAppearance(i: number, idx: number, app: any, logic: any) {
    // Color
    if (app.effect === 'DAMAGE') {
      if (Math.floor(this.frame / 4) % 2 === 0) {
        this.spriteColors[i] = '#ffffff'; // White flash
      } else {
        if (app.color === 'RAINBOW') {
          const hue = (this.frame * 2) % 360;
          this.spriteColors[i] = `hsl(${hue}, 80%, 60%)`;
        } else if (app.color) {
          this.spriteColors[i] = app.color;
        }
      }
    } else if (app.color === 'RAINBOW') {
      const hue = (this.frame * 2) % 360;
      this.spriteColors[i] = `hsl(${hue}, 80%, 60%)`;
    } else if (app.color) {
      this.spriteColors[i] = app.color;
    }

    // Size & Pulse
    let baseSize = this.evaluate(app.size, i, logic) || this.currentBuffer[idx + 5];
    if (app.effect === 'PULSE') {
      this.currentBuffer[idx + 5] = baseSize + Math.sin(this.frame * 0.1) * 10;
    } else if (app.effect === 'SHAKE') {
      this.currentBuffer[idx] += (Math.random() - 0.5) * 4;
      this.currentBuffer[idx + 1] += (Math.random() - 0.5) * 4;
      this.currentBuffer[idx + 5] = baseSize;
    } else {
      this.currentBuffer[idx + 5] = baseSize;
    }

    // Fading & Flashing
    if (app.effect === 'FADE_IN') {
      this.currentBuffer[idx + 6] = Math.min(1.0, this.currentBuffer[idx + 6] + 0.02);
    } else if (app.effect === 'FADE_OUT') {
      this.currentBuffer[idx + 6] = Math.max(0.0, this.currentBuffer[idx + 6] - 0.02);
    } else if (app.effect === 'FLASH') {
      this.currentBuffer[idx + 6] = (Math.floor(this.frame / 6) % 2 === 0) ? 1.0 : 0.2;
    } else if (app.effect === 'GHOST') {
      this.currentBuffer[idx + 6] = 0.4 + Math.sin(this.frame * 0.1) * 0.2;
    } else if (app.effect === 'NONE') {
      this.currentBuffer[idx + 6] = 1.0;
    }
  }

  private applyMove(idx: number, direction: string, steps: any, logic: any) {
    const actualSteps = this.evaluate(steps, idx / SPRITE_DATA_SIZE, logic);
    const multiplier = direction === 'FORWARD' ? 1 : -1;
    let dx = this.currentBuffer[idx + 2];
    let dy = this.currentBuffer[idx + 3];
    
    if (dx === 0 && dy === 0) dx = 1;
    
    const mag = Math.sqrt(dx * dx + dy * dy);
    this.currentBuffer[idx] += (dx / mag) * actualSteps * multiplier;
    this.currentBuffer[idx + 1] += (dy / mag) * actualSteps * multiplier;
  }

  private applyRotate(idx: number, angle: any, logic: any) {
    const actualAngle = this.evaluate(angle, idx / SPRITE_DATA_SIZE, logic);
    // Convert degrees to radians for the engine
    this.currentBuffer[idx + 4] = (actualAngle * Math.PI) / 180;
  }

  private applyFlip(idx: number, axis: string) {
    if (axis === 'HORIZONTAL') {
      this.currentBuffer[idx + 7] = this.currentBuffer[idx + 7] === 0 ? 1 : 0;
    } else if (axis === 'VERTICAL') {
      this.currentBuffer[idx + 8] = this.currentBuffer[idx + 8] === 0 ? 1 : 0;
    }
  }

  private evaluate(expr: any, i: number, logic: any): any {
    if (typeof expr !== 'object' || expr === null) return expr;

    switch (expr.type) {
      case 'math_arithmetic': {
        const a = this.evaluate(expr.a, i, logic);
        const b = this.evaluate(expr.b, i, logic);
        if (expr.op === 'ADD') return a + b;
        if (expr.op === 'MINUS') return a - b;
        if (expr.op === 'MULTIPLY') return a * b;
        if (expr.op === 'DIVIDE') return a / b;
        if (expr.op === 'POWER') return Math.pow(a, b);
        return 0;
      }
      case 'math_single': {
        const num = this.evaluate(expr.num, i, logic);
        if (expr.op === 'ROOT') return Math.sqrt(num);
        if (expr.op === 'ABS') return Math.abs(num);
        if (expr.op === 'NEG') return -num;
        if (expr.op === 'LN') return Math.log(num);
        if (expr.op === 'LOG10') return Math.log10(num);
        if (expr.op === 'EXP') return Math.exp(num);
        if (expr.op === 'POW10') return Math.pow(10, num);
        return 0;
      }
      case 'math_trig': {
        const num = this.evaluate(expr.num, i, logic);
        const rad = (num * Math.PI) / 180;
        if (expr.op === 'SIN') return Math.sin(rad);
        if (expr.op === 'COS') return Math.cos(rad);
        if (expr.op === 'TAN') return Math.tan(rad);
        if (expr.op === 'ASIN') return (Math.asin(num) * 180) / Math.PI;
        if (expr.op === 'ACOS') return (Math.acos(num) * 180) / Math.PI;
        if (expr.op === 'ATAN') return (Math.atan(num) * 180) / Math.PI;
        return 0;
      }
      case 'math_constant': {
        if (expr.constant === 'PI') return Math.PI;
        if (expr.constant === 'E') return Math.E;
        if (expr.constant === 'GOLDEN_RATIO') return (1 + Math.sqrt(5)) / 2;
        if (expr.constant === 'SQRT2') return Math.SQRT2;
        if (expr.constant === 'SQRT1_2') return Math.SQRT1_2;
        if (expr.constant === 'INFINITY') return Infinity;
        return 0;
      }
      case 'math_round': {
        const num = this.evaluate(expr.num, i, logic);
        if (expr.op === 'ROUND') return Math.round(num);
        if (expr.op === 'ROUNDUP') return Math.ceil(num);
        if (expr.op === 'ROUNDDOWN') return Math.floor(num);
        return 0;
      }
      case 'math_modulo': {
        const dividend = this.evaluate(expr.dividend, i, logic);
        const divisor = this.evaluate(expr.divisor, i, logic);
        return dividend % divisor;
      }
      case 'math_random_int': {
        const from = this.evaluate(expr.from, i, logic);
        const to = this.evaluate(expr.to, i, logic);
        return Math.floor(Math.random() * (to - from + 1)) + from;
      }
      case 'logic_compare': {
        const a = this.evaluate(expr.a, i, logic);
        const b = this.evaluate(expr.b, i, logic);
        if (expr.op === 'EQ') return a === b;
        if (expr.op === 'NEQ') return a !== b;
        if (expr.op === 'LT') return a < b;
        if (expr.op === 'LTE') return a <= b;
        if (expr.op === 'GT') return a > b;
        if (expr.op === 'GTE') return a >= b;
        return false;
      }
      case 'logic_operation': {
        const a = this.evaluate(expr.a, i, logic);
        const b = this.evaluate(expr.b, i, logic);
        if (expr.op === 'AND') return a && b;
        if (expr.op === 'OR') return a || b;
        return false;
      }
      case 'is_key_pressed': {
        return logic.keysPressed && logic.keysPressed.has(expr.key);
      }
      case 'get_sprite_property': {
        const targetIdx = expr.spriteId * SPRITE_DATA_SIZE;
        if (targetIdx >= this.spriteIds.length * SPRITE_DATA_SIZE) return 0;
        if (expr.property === 'X') return this.currentBuffer[targetIdx];
        if (expr.property === 'Y') return this.currentBuffer[targetIdx + 1];
        if (expr.property === 'VX') return this.currentBuffer[targetIdx + 2];
        if (expr.property === 'VY') return this.currentBuffer[targetIdx + 3];
        if (expr.property === 'ROTATION') return (this.currentBuffer[targetIdx + 4] * 180) / Math.PI;
        if (expr.property === 'SIZE') return this.currentBuffer[targetIdx + 5];
        if (expr.property === 'OPACITY') return this.currentBuffer[targetIdx + 6] * 100;
        return 0;
      }
      case 'current_frame': {
        return this.frame;
      }
      case 'sprite_id': {
        return i;
      }
      case 'db_get': {
        return this.database.get(expr.key) ?? 0;
      }
      case 'get_variable': {
        if (i < this.spriteVariables.length) {
          return this.spriteVariables[i].get(expr.var) ?? 0;
        }
        return 0;
      }
      default:
        return 0;
    }
  }

  private processThread(i: number, idx: number, thread: Thread, logic: any) {
    if (thread.waitTimer > 0) {
      thread.waitTimer--;
      return;
    }

    while (thread.ptr < thread.actions.length) {
      const action = thread.actions[thread.ptr];
      thread.ptr++;

      if (action.type === 'move') {
        this.applyMove(idx, action.direction, action.steps, logic);
      } else if (action.type === 'rotate') {
        this.applyRotate(idx, action.angle, logic);
      } else if (action.type === 'flip') {
        this.applyFlip(idx, action.axis);
      } else if (action.type === 'text') {
        this.texts.push({
          text: action.text,
          x: this.evaluate(action.x, i, logic),
          y: this.evaluate(action.y, i, logic),
          size: this.evaluate(action.size, i, logic),
          color: action.color
        });
      } else if (action.type === 'appearance') {
        this.applyAppearance(i, idx, action, logic);
      } else if (action.type === 'sound') {
        // Visual feedback for sound
        this.screenShake = 10;
        this.texts.push({
          text: `🔊 ${action.sound}!`,
          x: this.currentBuffer[idx],
          y: this.currentBuffer[idx + 1] - 40,
          size: 20,
          color: '#ffffff'
        });
      } else if (action.type === 'flash_screen') {
        this.screenFlash = {
          color: action.color,
          duration: action.duration,
          current: action.duration
        };
      } else if (action.type === 'particles') {
        for (let p = 0; p < action.count; p++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          this.particles.push({
            x: action.x,
            y: action.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: action.color,
            size: Math.random() * 4 + 2,
            life: 1.0
          });
        }
      } else if (action.type === 'coffee') {
        const targetIdx = action.spriteId * SPRITE_DATA_SIZE;
        if (targetIdx < this.spriteIds.length * SPRITE_DATA_SIZE) {
          // Boost speed
          this.currentBuffer[targetIdx + 2] *= 2.0;
          this.currentBuffer[targetIdx + 3] *= 2.0;
          
          // Set pulse effect
          this.spriteAppearanceStates[action.spriteId] = { effect: 'PULSE' };
          
          // Visual feedback
          this.screenShake = 15;
          this.texts.push({
            text: "CAFFEINE! ☕",
            x: this.currentBuffer[targetIdx],
            y: this.currentBuffer[targetIdx + 1] - 50,
            size: 24,
            color: '#fbbf24' // Amber-400
          });
          
          // Particle burst
          for (let p = 0; p < 20; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 4;
            this.particles.push({
              x: this.currentBuffer[targetIdx],
              y: this.currentBuffer[targetIdx + 1],
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: '#78350f', // Coffee brown
              size: Math.random() * 5 + 3,
              life: 1.0
            });
          }
        }
      } else if (action.type === 'wait') {
        thread.waitTimer = Math.floor(this.evaluate(action.duration, i, logic) * 60);
        return; // Yield thread
      } else if (action.type === 'set_property') {
        const targetIdx = action.spriteId * SPRITE_DATA_SIZE;
        if (targetIdx < this.spriteIds.length * SPRITE_DATA_SIZE) {
          const val = this.evaluate(action.value, i, logic);
          if (action.property === 'X') this.currentBuffer[targetIdx] = val;
          if (action.property === 'Y') this.currentBuffer[targetIdx + 1] = val;
          if (action.property === 'VX') this.currentBuffer[targetIdx + 2] = val;
          if (action.property === 'VY') this.currentBuffer[targetIdx + 3] = val;
          if (action.property === 'ROTATION') this.currentBuffer[targetIdx + 4] = (val * Math.PI) / 180;
          if (action.property === 'SIZE') this.currentBuffer[targetIdx + 5] = val;
          if (action.property === 'OPACITY') this.currentBuffer[targetIdx + 6] = val / 100;
        }
      } else if (action.type === 'tween') {
        const targetIdx = action.spriteId * SPRITE_DATA_SIZE;
        if (targetIdx < this.spriteIds.length * SPRITE_DATA_SIZE) {
          let propIdx = 0;
          if (action.property === 'X') propIdx = 0;
          else if (action.property === 'Y') propIdx = 1;
          else if (action.property === 'ROTATION') propIdx = 4;
          else if (action.property === 'SIZE') propIdx = 5;
          else if (action.property === 'OPACITY') propIdx = 6;

          let startVal = this.currentBuffer[targetIdx + propIdx];
          if (action.property === 'ROTATION') startVal = (startVal * 180) / Math.PI;
          if (action.property === 'OPACITY') startVal *= 100;

          this.spriteTweens[action.spriteId].push({
            property: action.property,
            propIdx,
            startVal,
            endVal: this.evaluate(action.value, i, logic),
            startFrame: this.frame,
            duration: action.duration,
            easing: action.easing
          });
        }
      } else if (action.type === 'shake_temp') {
        if (action.spriteId < this.spriteShakeTimers.length) {
          this.spriteShakeTimers[action.spriteId] = action.duration;
        }
      } else if (action.type === 'db_set') {
        this.database.set(action.key, this.evaluate(action.value, i, logic));
      } else if (action.type === 'set_variable') {
        if (i < this.spriteVariables.length) {
          this.spriteVariables[i].set(action.var, this.evaluate(action.value, i, logic));
        }
      } else if (action.type === 'change_variable') {
        if (i < this.spriteVariables.length) {
          const currentVal = this.spriteVariables[i].get(action.var) ?? 0;
          const delta = this.evaluate(action.value, i, logic);
          this.spriteVariables[i].set(action.var, currentVal + delta);
        }
      } else if (action.type === 'add_to_group') {
        if (!this.groups.has(action.groupName)) {
          this.groups.set(action.groupName, new Set());
        }
        this.groups.get(action.groupName)!.add(action.spriteId);
      } else if (action.type === 'move_group') {
        const group = this.groups.get(action.groupName);
        if (group) {
          const steps = this.evaluate(action.steps, i, logic);
          group.forEach(spriteId => {
            if (spriteId < this.spriteIds.length) {
              this.applyMove(spriteId * SPRITE_DATA_SIZE, action.direction, steps, logic);
            }
          });
        }
      } else if (action.type === 'rotate_group') {
        const group = this.groups.get(action.groupName);
        if (group) {
          const angle = (this.evaluate(action.angle, i, logic) * Math.PI) / 180;
          group.forEach(spriteId => {
            if (spriteId < this.spriteIds.length) {
              const idx = spriteId * SPRITE_DATA_SIZE;
              this.currentBuffer[idx + 4] += angle;
            }
          });
        }
      } else if (action.type === 'if') {
        const condition = this.evaluate(action.condition, i, logic);
        const subActions = condition ? action.thenActions : action.elseActions;
        if (subActions && subActions.length > 0) {
          // We insert sub-actions into the current thread's execution path
          // This is a bit tricky. For now, let's just push a new thread or handle it recursively.
          // Recursive call is simpler but might hit stack limits if too deep.
          // Let's just process them in a temporary thread.
          const tempThread: Thread = {
            actions: subActions,
            ptr: 0,
            waitTimer: 0,
            loop: false
          };
          while (tempThread.ptr < tempThread.actions.length && tempThread.waitTimer === 0) {
            this.processThread(i, idx, tempThread, logic);
          }
          if (tempThread.waitTimer > 0) {
            // If the sub-thread hit a wait, we need to pause the main thread too.
            // This is complex. For now, let's just say 'if' doesn't support 'wait' inside it perfectly.
            // Actually, we can just replace the current action with the sub-actions.
          }
        }
      } else if (action.type === 'repeat') {
        const times = this.evaluate(action.times, i, logic);
        for (let r = 0; r < times; r++) {
          const tempThread: Thread = {
            actions: action.subActions,
            ptr: 0,
            waitTimer: 0,
            loop: false
          };
          while (tempThread.ptr < tempThread.actions.length && tempThread.waitTimer === 0) {
            this.processThread(i, idx, tempThread, logic);
          }
        }
      }
    }

    if (thread.loop && thread.ptr >= thread.actions.length) {
      thread.ptr = 0;
    }
  }

  update(logic: any) {
    // 1. Save current state to circular history buffer
    const offset = this.historyPtr * MAX_SPRITES * SPRITE_DATA_SIZE;
    this.historyBuffer.set(this.currentBuffer, offset);
    
    this.historyPtr = (this.historyPtr + 1) % this.maxHistory;
    if (this.historyCount < this.maxHistory) this.historyCount++;

    this.frame++;
    if (this.screenShake > 0) this.screenShake *= 0.9;

    // Reset texts for this frame (they are populated from logic)
    this.texts = [];
    if (logic.texts) {
      this.texts = [...logic.texts];
    }

    // Camera Follow Logic
    let targetCamX = 0;
    let targetCamY = 0;
    if (logic.cameraFollowId !== undefined && logic.cameraFollowId !== null) {
      const targetIdx = logic.cameraFollowId * SPRITE_DATA_SIZE;
      if (targetIdx < this.spriteIds.length * SPRITE_DATA_SIZE) {
        targetCamX = this.currentBuffer[targetIdx] - 200;
        targetCamY = this.currentBuffer[targetIdx + 1] - 200;
      }
    }

    // Smooth follow (lerp) + Screen Shake
    const lerpFactor = 0.1;
    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;
    
    this.cameraX += (targetCamX - this.cameraX) * lerpFactor + shakeX;
    this.cameraY += (targetCamY - this.cameraY) * lerpFactor + shakeY;

    // Handle Frame Events (on_frame)
    if (logic.frameActions && logic.frameActions[this.frame]) {
      const actions = logic.frameActions[this.frame];
      if (this.spriteThreads.length > 0) {
        this.spriteThreads[0].push({
          actions,
          ptr: 0,
          waitTimer: 0,
          loop: false
        });
      }
    }

    // Process Particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= 0.02;
      return p.life > 0;
    });

    // Process Screen Flash
    if (this.screenFlash) {
      this.screenFlash.current--;
      if (this.screenFlash.current <= 0) {
        this.screenFlash = null;
      }
    }

    // 2. Process Logic (The Brain)
    for (let i = 0; i < this.spriteIds.length; i++) {
      const idx = i * SPRITE_DATA_SIZE;
      const isStatic = this.currentBuffer[idx + 9] === 1;
      
      // Apply Persistent Appearance
      if (this.spriteAppearanceStates[i]) {
        this.internalApplyAppearance(i, idx, this.spriteAppearanceStates[i], logic);
      }

      // Apply Temporary Shake
      if (this.spriteShakeTimers[i] > 0) {
        this.currentBuffer[idx] += (Math.random() - 0.5) * 6;
        this.currentBuffer[idx + 1] += (Math.random() - 0.5) * 6;
        this.spriteShakeTimers[i]--;
      }

      // Update Tweens
      this.spriteTweens[i] = this.spriteTweens[i].filter(tween => {
        const elapsed = this.frame - tween.startFrame;
        const t = Math.min(1.0, elapsed / tween.duration);
        
        let easedT = t;
        if (tween.easing === 'EASE_IN') easedT = t * t;
        else if (tween.easing === 'EASE_OUT') easedT = t * (2 - t);
        else if (tween.easing === 'EASE_IN_OUT') easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const val = tween.startVal + (tween.endVal - tween.startVal) * easedT;
        
        if (tween.property === 'ROTATION') {
          this.currentBuffer[idx + tween.propIdx] = (val * Math.PI) / 180;
        } else if (tween.property === 'OPACITY') {
          this.currentBuffer[idx + tween.propIdx] = val / 100;
        } else {
          this.currentBuffer[idx + tween.propIdx] = val;
        }

        return t < 1.0;
      });

      // Apply Physics (Gravity & Friction)
      if (!isStatic) {
        if (logic.gravity !== undefined && logic.gravity !== null) {
          this.currentBuffer[idx + 3] += logic.gravity; // vy += gravity
        }
        if (logic.friction !== undefined && logic.friction !== null) {
          this.currentBuffer[idx + 2] *= (1 - logic.friction); // vx *= (1 - friction)
          this.currentBuffer[idx + 3] *= (1 - logic.friction); // vy *= (1 - friction)
        }
      }

      // Apply appearance logic (Global tick logic)
      if (logic.appearance) {
        const app = logic.appearance;
        this.applyAppearance(i, idx, app, logic);
      }

      // Handle Tick Actions (Create new looping thread if not exists)
      if (logic.tickActions && logic.tickActions.length > 0) {
        const hasTickThread = this.spriteThreads[i].some(t => t.loop);
        if (!hasTickThread) {
          this.spriteThreads[i].push({
            actions: logic.tickActions,
            ptr: 0,
            waitTimer: 0,
            loop: true
          });
        }
      }

      // Handle Key Pressed Events (Create new threads)
      if (logic.keyActions && logic.keysPressed) {
        Object.keys(logic.keyActions).forEach(key => {
          if (logic.keysPressed.has(key)) {
            const actions = logic.keyActions[key];
            // To prevent spamming threads, we could check if one exists, 
            // but for key presses, multiple might be desired for some effects.
            // However, for "Wait" to work sensibly, we should probably limit it.
            const hasKeyThread = this.spriteThreads[i].some(t => t.actions === actions);
            if (!hasKeyThread) {
              this.spriteThreads[i].push({
                actions,
                ptr: 0,
                waitTimer: 0,
                loop: false
              });
            }
          }
        });
      }

      // Process Sprite Threads
      this.spriteThreads[i] = this.spriteThreads[i].filter(thread => {
        this.processThread(i, idx, thread, logic);
        return thread.ptr < thread.actions.length || thread.loop;
      });

      // Apply rotation commands if they exist (Global tick logic)
      if (logic.rotations && logic.rotations.length > 0) {
        logic.rotations.forEach((rot: { angle: any }) => {
          this.applyRotate(idx, rot.angle, logic);
        });
      }

      // Apply flip commands if they exist (Global tick logic)
      if (logic.flips && logic.flips.length > 0) {
        logic.flips.forEach((flip: { axis: string }) => {
          this.applyFlip(idx, flip.axis);
        });
      }

      // Apply movement commands if they exist (Global tick logic)
      if (!isStatic && logic.movements && logic.movements.length > 0) {
        logic.movements.forEach((move: { direction: string, steps: any }) => {
          this.applyMove(idx, move.direction, move.steps, logic);
        });
      }

      // Always apply velocity to position (The Brain)
      if (!isStatic) {
        this.currentBuffer[idx] += this.currentBuffer[idx + 2];
        this.currentBuffer[idx + 1] += this.currentBuffer[idx + 3];
      }

      // Bounce/Wrap
      if (logic.bounce) {
        if (this.currentBuffer[idx] < 0) {
          this.currentBuffer[idx] = 0;
          if (!isStatic) this.currentBuffer[idx + 2] *= -1;
        } else if (this.currentBuffer[idx] > 400) {
          this.currentBuffer[idx] = 400;
          if (!isStatic) this.currentBuffer[idx + 2] *= -1;
        }
        
        if (this.currentBuffer[idx + 1] < 0) {
          this.currentBuffer[idx + 1] = 0;
          if (!isStatic) this.currentBuffer[idx + 3] *= -1;
        } else if (this.currentBuffer[idx + 1] > 400) {
          this.currentBuffer[idx + 1] = 400;
          if (!isStatic) this.currentBuffer[idx + 3] *= -1;
        }
      } else {
        if (this.currentBuffer[idx] < 0) this.currentBuffer[idx] = 400;
        if (this.currentBuffer[idx] > 400) this.currentBuffer[idx] = 0;
        if (this.currentBuffer[idx + 1] < 0) this.currentBuffer[idx + 1] = 400;
        if (this.currentBuffer[idx + 1] > 400) this.currentBuffer[idx + 1] = 0;
      }
    }

    // 3. Collision Detection
    if (logic.collide) {
      for (let i = 0; i < this.spriteIds.length; i++) {
        for (let j = i + 1; j < this.spriteIds.length; j++) {
          const idx1 = i * SPRITE_DATA_SIZE;
          const idx2 = j * SPRITE_DATA_SIZE;
          const static1 = this.currentBuffer[idx1 + 9] === 1;
          const static2 = this.currentBuffer[idx2 + 9] === 1;
          
          if (static1 && static2) continue; // Two static blocks don't collide

          const dx = this.currentBuffer[idx1] - this.currentBuffer[idx2];
          const dy = this.currentBuffer[idx1 + 1] - this.currentBuffer[idx2 + 1];
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (this.currentBuffer[idx1 + 5] + this.currentBuffer[idx2 + 5]) / 2;
          
          if (distance < minDistance) {
            // Trigger collision actions (Create new threads)
            if (logic.collisionActions) {
              this.spriteThreads[i].push({
                actions: logic.collisionActions,
                ptr: 0,
                waitTimer: 0,
                loop: false
              });
              this.spriteThreads[j].push({
                actions: logic.collisionActions,
                ptr: 0,
                waitTimer: 0,
                loop: false
              });
            }

            const nx = dx / distance;
            const ny = dy / distance;
            const rvx = this.currentBuffer[idx1 + 2] - this.currentBuffer[idx2 + 2];
            const rvy = this.currentBuffer[idx1 + 3] - this.currentBuffer[idx2 + 3];
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal > 0) continue;
            
            const jImpulse = -2 * velAlongNormal;
            
            if (!static1 && !static2) {
              this.currentBuffer[idx1 + 2] += jImpulse * nx * 0.5;
              this.currentBuffer[idx1 + 3] += jImpulse * ny * 0.5;
              this.currentBuffer[idx2 + 2] -= jImpulse * nx * 0.5;
              this.currentBuffer[idx2 + 3] -= jImpulse * ny * 0.5;
            } else if (static1) {
              this.currentBuffer[idx2 + 2] -= jImpulse * nx;
              this.currentBuffer[idx2 + 3] -= jImpulse * ny;
            } else {
              this.currentBuffer[idx1 + 2] += jImpulse * nx;
              this.currentBuffer[idx1 + 3] += jImpulse * ny;
            }

            const percent = 0.2;
            const slop = 0.01;
            const penetration = minDistance - distance;
            const correction = Math.max(penetration - slop, 0) / (static1 || static2 ? 1 : 2) * percent;
            
            if (!static1) {
              this.currentBuffer[idx1] += nx * correction;
              this.currentBuffer[idx1 + 1] += ny * correction;
            }
            if (!static2) {
              this.currentBuffer[idx2] -= nx * correction;
              this.currentBuffer[idx2 + 1] -= ny * correction;
            }
          }
        }
      }
    }

    this.frame++;
  }

  triggerStart(actions: any[]) {
    if (!actions || actions.length === 0) return;
    for (let i = 0; i < this.spriteIds.length; i++) {
      this.spriteThreads[i].push({
        actions,
        ptr: 0,
        waitTimer: 0,
        loop: false
      });
    }
  }

  getState(): GameState {
    return {
      frame: this.frame,
      texts: [...this.texts],
      particles: [...this.particles],
      camera: { x: this.cameraX, y: this.cameraY },
      flash: this.screenFlash ? {
        color: this.screenFlash.color,
        opacity: this.screenFlash.current / this.screenFlash.duration
      } : undefined,
      sprites: this.spriteIds.map((id, i) => {
        const idx = i * SPRITE_DATA_SIZE;
        return {
          id,
          x: this.currentBuffer[idx],
          y: this.currentBuffer[idx + 1],
          vx: this.currentBuffer[idx + 2],
          vy: this.currentBuffer[idx + 3],
          rotation: this.currentBuffer[idx + 4],
          size: this.currentBuffer[idx + 5],
          opacity: this.currentBuffer[idx + 6],
          flipX: this.currentBuffer[idx + 7] === 1,
          flipY: this.currentBuffer[idx + 8] === 1,
          isStatic: this.currentBuffer[idx + 9] === 1,
          color: this.spriteColors[i],
          variables: i < this.spriteVariables.length ? Object.fromEntries(this.spriteVariables[i]) : {}
        };
      })
    };
  }

  getHistoryFrame(percent: number): GameState {
    if (this.historyCount === 0) return this.getState();
    const index = Math.floor((percent / 100) * (this.historyCount - 1));
    const actualIdx = (this.historyPtr - this.historyCount + index + this.maxHistory) % this.maxHistory;
    const offset = actualIdx * MAX_SPRITES * SPRITE_DATA_SIZE;
    const data = this.historyBuffer.subarray(offset, offset + MAX_SPRITES * SPRITE_DATA_SIZE);
    
    return {
      frame: this.frame - (this.historyCount - index),
      texts: [], // History for text not implemented yet for simplicity
      particles: [], // History for particles not implemented yet
      camera: { x: 0, y: 0 }, // History for camera not implemented yet
      sprites: this.spriteIds.map((id, i) => {
        const idx = i * SPRITE_DATA_SIZE;
        return {
          id,
          x: data[idx],
          y: data[idx + 1],
          vx: data[idx + 2],
          vy: data[idx + 3],
          rotation: data[idx + 4],
          size: data[idx + 5],
          opacity: data[idx + 6],
          flipX: data[idx + 7] === 1,
          flipY: data[idx + 8] === 1,
          isStatic: data[idx + 9] === 1,
          color: this.spriteColors[i]
        };
      })
    };
  }

  getHistoryLength() {
    return this.historyCount;
  }
}
