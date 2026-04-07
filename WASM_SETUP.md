# Momentum Engine — WASM Setup

## What was just built

```
momentum-lab/
├── mvl-demo.html              ← Open this NOW. No build step. See it alive.
├── wasm-engine/
│   ├── src/lib.rs             ← The Rust/WASM core (8-stride buffer, GEO loop families)
│   ├── Cargo.toml             ← wasm-bindgen dependency, release = bare-metal
│   └── pkg/                  ← Pre-built WASM output (19KB)
│       ├── momentum_engine_bg.wasm
│       ├── momentum_engine.js
│       └── momentum_engine.d.ts
└── src/lib/spatial-engine.ts ← TypeScript bridge (JS fallback → WASM upgrade)
```

## Step 1: Open the demo right now
Open `mvl-demo.html` in your browser (double-click or drag to Chrome).
Move the sliders. Watch the loop families change. Watch the pattern break.
This runs in pure JS — no build needed.

## Step 2: Set up wasm-pack (one time)
```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Step 3: Build the WASM engine
```bash
cd momentum-lab/wasm-engine
wasm-pack build --target web --out-dir pkg
```

## Step 4: Add to Vite config
```ts
// vite.config.ts — add this plugin
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default {
  plugins: [react(), wasm(), topLevelAwait()],
}
```

```bash
npm install vite-plugin-wasm vite-plugin-top-level-await
```

## Step 5: Use in your React app
```ts
import { initSpatialEngine } from './lib/spatial-engine';

// In App.tsx:
const engine = await initSpatialEngine();
const speedIdx = engine.registerVar(50, 0, 100, 200, 200);

// In your update loop:
engine.computeState(speedIdx, sliderValue, dt);

// In p5.js draw:
// engine.view is a Float32Array — read it directly, no function calls
const family = engine.view[speedIdx * 8 + 7]; // loop_family_id
const errDist = engine.view[speedIdx * 8 + 6]; // error_dist
```

## The architecture in one diagram
```
Blockly block snaps
        ↓
spatial-engine.ts.computeState()
  → JS fallback (instant, < 0.1ms)
  → WASM upgrade transparent (< 0.5ms)
        ↓
engine.view: Float32Array (8 floats per variable)
        ↓ zero-copy read
p5.js draw() reads buffer directly
        ↓
Loop family → GEO quadrant mask → canvas color
Error distance → pattern distortion → celebration
        ↓
Kid sees the math. No text. No error messages.
```
