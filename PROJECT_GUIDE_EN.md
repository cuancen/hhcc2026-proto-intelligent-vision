# EVA Smart Cockpit · Project Guide (Reuse / Extension / Idea Pool)

> **[中文版](PROJECT_GUIDE.md)** — a deep tour for teammates: one level deeper than the README —
> why the architecture looks the way it does, which modules you can lift and reuse as-is,
> how to change things safely, and where to go next. Doc map at the end.
> Updated: 2026-08-22 (v0.6.0, 3D hero car integrated)

---

## 0. Understand it in 30 seconds

**One sentence**: an L2 driver-assistance cockpit prototype running entirely in the browser — MediaPipe facial landmarks infer *locally* whether the driver is drowsy or looking away, that signal fuses with driving-workload state, and a rule engine named Eva intervenes in graded steps (cabin adjustments → reminders → L2 degradation → rest guidance).

**Two pages** (hash routing, zero router libraries):
- `/` — brand landing: dark red-orange design language + a **real-time 3D car hero** (three.js + a CC-BY Sketchfab model, auto-falls back to a hand-written wireframe on any failure)
- `#/cockpit` — the dashboard: three-column layout, all business features live here

**Demo backbone**: a 60-second scripted run through three scenes (☀ commute ambient service → 😮‍💨 fatigue dual-threshold intervention → ⛈ complex-road cabin-drive synergy). Pause anytime to take over manually, or turn on the camera and drive the whole vision pipeline with your own face.

---

## 1. Tech choices & the "zero-dependency philosophy"

| Choice | Why |
|---|---|
| React 18 + Vite 5 + TS strict | Mainstream, fast, types-as-documentation |
| **No** router / state / UI-component libraries | Hash routing is 15 lines; all state is one `useCockpit` hook; hand-rolled CSS won on visual consistency (and judges like "built from scratch") |
| MediaPipe Tasks Vision (Apache-2.0) | 478-point facial landmarks in-browser, WASM/GPU on-device, frames never uploaded |
| three.js (MIT, dynamic import) | Landing 3D car only — separate chunk, never enters the dashboard bundle |
| vitest | Kernel & vision are pure functions, so tests are instant |

**Positioning red line** (applies to all wording): L2 assistance only — the driver stays responsible; never L3/L4 language.

---

## 2. Overall architecture

```
┌─────────────────────────────────────────────────────────────┐
│  landing/   Brand homepage (independent; deletable)          │
│    CarModel → carScene(three.js) ⇄ fallback CabinModel       │
├─────────────────────────────────────────────────────────────┤
│  shell/     UI shell                                         │
│    hooks: useCockpit(kernel subscription) useDms(vision      │
│           lifecycle) useTts(local speech) useUiPrefs         │
│    components: 3-column panels + ControlBar + DemoBanner     │
├────────────── rAF reads liveState() directly ───────────────┤
│  vision/    Machine vision (produces VisionSample only)      │
│    dms.ts(MediaPipe engine, multi-source) → metrics.ts ──┐   │
│    simVision.ts(simulated source, same metrics) ─────────┘   │
├──────────────────── act.setVision(sample) ──────────────────┤
│  core/      Kernel (zero DOM! no React/browser imports)      │
│    sim.ts(dynamics) + evaRules.ts(rule engine) + params.ts  │
│    index.ts createCockpit(): state/snapshot()/step()/actions │
└─────────────────────────────────────────────────────────────┘
```

**Data flow in one line**: a `setInterval(100ms)` tick calls `step(dt)` (simulation + rules) → UI renders from a `structuredClone` snapshot; high-frequency Canvas layers bypass React via `liveState()`; the vision module is a *plug-in sensor* writing `act.setVision()` once per sampling period.

### Layer rules (read before changing anything)

1. **core is zero-DOM** — the kernel runs bare in Node (that's how tests work) and ports to any framework;
2. **vision is decoupled from the kernel** — vision only produces `VisionSample` (a pure-data interface in core/types.ts); real model and simulated source share the same `metrics.ts` pure functions;
3. **single source of parameters** — every threshold lives in `core/params.ts`; scattered hard-coding is a violation;
4. **fallback-first** — every external resource must fail with zero impact (see §4.4 fallback table).

---

## 3. Directory tour (file by file)

```
src/
├─ core/                       ★ Kernel (reusable wholesale, see §5)
│  ├─ params.ts                  P (all thresholds) + SCENARIOS (scene metadata)
│  ├─ types.ts                   CockpitState family (drive/driver/cabin/chat/alerts/pending/stats)
│  ├─ sim.ts                     stepSim dynamics: first-order speed / fatigue / emotion walk /
│  │                             fuseFatigue fusion
│  ├─ evaRules.ts                Rule engine: gate cooldowns / scene script queue / handleCommand /
│  │                             dual-threshold fatigue + pending branch / L2 degradation /
│  │                             emotion linkage / complex-road entertainment block
│  └─ index.ts                   createCockpit(): state + snapshot() + step() + actions
├─ vision/                     ★ Machine vision
│  ├─ metrics.ts                 Pure: earOf/bothEar, headPoseOf(4×4→yaw/pitch),
│  │                             createPerclosTracker(30s window), createLookAwayTracker
│  ├─ dms.ts                     MediaPipe engine: WASM 3-source + model 2-source + GPU→CPU
│  └─ simVision.ts               Simulated source: synthesized blinks (period shrinks with fatigue)
│                                + random look-away events, fed through the same metrics pipeline
├─ shell/
│  ├─ hooks/
│  │  ├─ useCockpit.ts           Kernel subscription: interval drive + snapshots + liveState
│  │  ├─ useDms.ts               Vision lifecycle: model/sim/off, auto-degrades on failure
│  │  ├─ useTts.ts               speechSynthesis (zh-CN), silently skipped when unavailable
│  │  └─ useUiPrefs.ts           Font scale / contrast / voice, persisted in localStorage
│  ├─ autoDemo.ts                60s script: DEMO_STEPS (with judge narration) + runAutoDemo
│  ├─ ambient.ts                 Urgency → 3 ambient levels (teal/amber/red)
│  ├─ evaFace.ts / evaAvatar.ts  Mood derivation / bust wireframe geometry (pure functions)
│  ├─ theme.css                  Cockpit design system (CSS vars + .eva-face-svg styles)
│  └─ components/                TopBar/BootSplash/EvaAgent/DriverPanel/DmsPanel/SceneView/
│                                DataflowBar/AdasPanel/CabinPanel/AlertCenter/StatsPanel/
│                                ControlBar/DemoBanner/Gauge/EvaFace
├─ landing/
│  ├─ Landing.tsx                Page skeleton (Hero/Features/Demo/Run/About/footer credit)
│  ├─ CarModel.tsx               3D car React wrapper: dynamic import + wireframe fallback + fade
│  ├─ carScene.ts                three.js scene: white-paint override (skips glass/emissive)/
│  │                             RoomEnvironment / brand-orange rim light / soft ground shadow /
│  │                             dual-axis auto-framing / hover-spin / full disposal
│  ├─ CabinModel.tsx             Hand-written Canvas pseudo-3D wireframe (fallback, zero deps)
│  ├─ projection.ts              Perspective/rotation/brand-gradient pure functions
│  └─ landing.css                Landing styles (red-orange language + .car-stage transition)
tests/                          core(16) + vision(8) + shell(19) = 43 tests
public/models/                  face_landmarker.task (self-hosted) + geely.glb (meshopt, 5 MB)
scripts/copy-wasm.mjs           postinstall: MediaPipe WASM → public/ (offline-ready)
docs/                           PIPELINE (params/data flow) · feature manual · AI statement
```

---

## 4. Six core mechanisms (read this = change safely)

### 4.1 Dual-channel state distribution (useCockpit)

```
setInterval(100ms) → api.step(0.2 × speed)  → setSnap(structuredClone(state))  ← React panels
                  └→ liveState() = api.state (live reference)                  ← Canvas rAF
```
- **Why**: snapshots keep React pure (full deep-clone every 100 ms — state must stay JSON-safe: no Map/Set/functions); the live reference keeps SceneView at 60 fps.
- **Time system**: `dt` is *simulated minutes*, not wall seconds — `speed` merely scales dt; all thresholds and cooldowns are defined in simulated time, decoupling script pacing from real time. `setInterval` over `rAF` is deliberate: rAF freezes in background tabs, the simulation must not.

### 4.2 Rule engine (evaRules.ts)

- **Cooldown gate `gate(ctx, key, coolMin, fire)`**: every repeatable announcement must pass a keyed gate (`fat1/fat2/look/emoLow/...`); cooldowns are simulated minutes;
- **Dual-threshold fatigue**: `≥60` gentle care (cabin adjustments) → `≥85` urgent (pushPending choice card: rest now / hold on) → refusing rest sets `cd.fat2 = t + 6` for a scheduled re-escalation;
- **L2 degradation**: eyes-off-road ≥4s → `l2Degraded` (slower speed, longer headway), auto-recovery below 0.5s — the most tangible proof of cabin-drive synergy;
- **Scene script queue**: `applyScenario` queues announcements via `at(delay, fn)` with times offset from the current t — switching scenes mid-flight never piles up messages.

### 4.3 Vision pipeline (vision/)

```
MediaPipe 478 pts ─┐
                   ├→ metrics.ts pure functions (EAR/PERCLOS window/head pose/look-away) → VisionSample → act.setVision()
simulated signal  ─┘ (identical metrics pipeline as the real model)
```
- **EAR**: six-point formula `(|p2-p6|+|p3-p5|) / 2|p1-p4|`; `< 0.15` counts as a closed-eye frame;
- **PERCLOS**: closed-frame ratio over a 30 s sliding window + blinks/min (extrapolated while the window warms up);
- **Head pose**: yaw/pitch decomposed from the facial-transformation 4×4 column-major matrix; `|yaw|>22° or |pitch|>18°` counts as looking away;
- **Fusion**: `fuseFatigue = max(sim fatigue, 185×PERCLOS, min(40, lookAwaySec×6))` — take-the-stronger, safety first.

### 4.4 Fallback table (the project's signature design)

| Failure point | Degradation path | Where |
|---|---|---|
| WASM CDN down | self-hosted → jsDelivr → unpkg | `dms.ts WASM_SOURCES + firstOk()` |
| Model file down | self-hosted → Google storage | `MODEL_SOURCES` |
| GPU delegate fails | auto-retry on CPU | `tryCreate('GPU') catch → CPU` |
| Camera denied | auto-switch to simulated signal, no error | `useDms.startModel catch` |
| No speech packs | TTS silently skipped (prevents renderer hang) | `useTts` |
| 3D car fails | wireframe fallback stays forever | `CarModel.tsx catch` |
| Simulated signal | same metrics pipeline as the real model | `simVision.ts` |

`firstOk(sources, open, label)` — that tiny try-in-order function is the whole philosophy in miniature. Wire every new external resource this way.

### 4.5 Auto demo & page relay (autoDemo.ts + App.tsx)

- The script = `DEMO_STEPS` (sec + judge-facing title/note) + a setTimeout sequence in `runAutoDemo`, at 2× speed;
- Landing "Run Live Demo" → `sessionStorage['eva.autodemo']='1'` → hash to cockpit → BootSplash ends → flag consumed → demo starts;
- Stopping does **not** clean the scene — judges can keep playing with the current state. Deliberate pitch detail.

### 4.6 Landing 3D car (landing/carScene.ts)

- The GLB is a Sketchfab CC-BY model re-encoded with **gltf-transform quantize + meshopt (24 MB → 5 MB)**, geometry untouched; decoding uses three's bundled MeshoptDecoder — offline-ready;
- White paint is applied at runtime: transparent materials (glass) and emissive ones (lights) are skipped, everything else becomes `MeshStandardMaterial(white, metalness .25, roughness .35)` — the CC-BY-compliant way (modification declared) with no source-file editing;
- Dynamic import (three lives in its own ~164 KB gzip chunk) + `requestIdleCallback` + IntersectionObserver pause + full disposal (StrictMode double-mount safe);
- Framing fits the bounding sphere on **both axes** — narrow containers never crop the car.

---

## 5. Reuse guide (what you can lift as-is)

> Principle: the further down, the more independent. core has no React; metrics has no core; projection/evaAvatar have nothing.

| Want to reuse | Take | Dependencies | Portable? |
|---|---|---|---|
| **The whole cabin kernel** (sim + rules + scenes) | `src/core/` (4 files) | none (zero DOM) | ✅ any framework / Node. Entry `createCockpit()`; write your own subscription |
| **DMS metric algorithms** (EAR/PERCLOS/pose/look-away) | `src/vision/metrics.ts` | none | ✅ pure functions — mini-programs, backends, anywhere |
| **MediaPipe fallback engine** | `src/vision/dms.ts` | `@mediapipe/tasks-vision` (dynamic) + metrics | ✅ emits VisionSample via callback, UI-agnostic |
| **Simulated signal source** | `src/vision/simVision.ts` | metrics + a `getState()` | ✅ any "need a fake sensor" scenario |
| **3D product pedestal** | `carScene.ts + CarModel.tsx` | three; change `modelUrl` to swap the model | ✅ delete the paint override → generic turntable |
| **Pseudo-3D wireframe rendering** | `landing/projection.ts + CabinModel.tsx` | none | ✅ pure projection math + Canvas |
| **Dual-channel state pattern** | the `useCockpit.ts` recipe | React | pattern ports: snapshot for the framework, live ref for Canvas |
| **Multi-source fallback pattern** | `firstOk()` | none | ✅ for every external resource |
| **Scripted auto-demo pattern** | `autoDemo.ts` recipe | none | ✅ steps table + timers + stop-without-cleanup |
| **Persona geometry/mood** | `evaAvatar.ts + evaFace.ts` | evaFace needs both | ✅ pure; palette/eye-shapes are re-skinnable |

**Minimal kernel reuse** (any JS environment):
```ts
import { createCockpit } from './core';
const ck = createCockpit();
ck.actions.scenario('fatigue');
ck.actions.setVision({ present: true, perclos: 0.4, /* ... */ });
setInterval(() => { ck.step(0.2); console.log(ck.snapshot().evaMode); }, 100);
```

---

## 6. Extension cookbook

**Add a scene**: add metadata to `params.ts SCENARIOS` → `ScenarioId` derives automatically → add a script branch in `evaRules.applyScenario` (queue announcements with `at(delay, fn)`) → optionally add a step in `autoDemo.ts` → run tests.

**Add a natural-language command**: follow the `has('keywords') → adjust() + say()` pattern in `evaRules.handleCommand`; keep `s.stats` counters in sync.

**Tune a threshold**: edit `params.ts` only → `npm test` → sync the table in `docs/PIPELINE.md` → walk the three scenes. Tests guard behaviors like the 60/85 dual thresholds.

**Add a vision metric** (yawn / on-screen gaze ratio, etc.): add a pure function + unit test in `metrics.ts` → call it in the `dms.ts` sampling loop and extend `VisionSample` (`types.ts`) → consume it in `evaRules` → display in `DmsPanel`. Keep `simVision.ts` synthesizing the same signal.

**Add a dashboard panel**: create under `shell/components/`, props take only `snap`/`act` (snapshot + actions, never kernel internals) → drop it into a column in `App.tsx` → styles via the panel classes in `theme.css`.

**Swap the 3D car model**: put the new GLB in `public/models/` → change `modelUrl` in `carScene.ts`; compress big files first (`npx @gltf-transform/cli quantize in.glb t.glb && npx @gltf-transform/cli meshopt t.glb out.glb` — measured 24 MB→5 MB); third-party models must follow the CC-BY attribution flow in `AI_USAGE.md` + page footer.

**Add an external resource**: decide the failure path first (§4.4 table); self-host first, CDN only as backup.

---

## 7. Known pitfalls (already stepped on — don't repeat)

1. **PERCLOS cold start**: the 30 s window needs half a minute to stabilize — start vision before demoing; the simulated source has no such issue;
2. **Snapshots are full structuredClone copies**: state must stay JSON-safe (no Map/Set/functions/cycles);
3. **Never move the simulation to rAF**: background tabs would freeze it; setInterval doesn't;
4. **MediaPipe GPU delegate** fails on some drivers — the CPU fallback exists, don't remove it;
5. **chat/alerts are capped** (200/100): prevents memory growth in long demos; cap any new array state the same way;
6. **3D car specifics**: three must be dynamically imported (bundle size); disposal must include `forceContextLoss` (StrictMode double-mount); frame on both axes (narrow-container cropping); meshopt-compress large GLBs first;
7. **CRLF warnings on Windows are harmless** — don't touch .gitattributes and flood the repo with diffs;
8. **Multiple dev servers**: Vite auto-increments ports when occupied — double-check which port your browser tab is actually on (page titles are identical).

---

## 8. Idea pool (where to go next)

**Product**
- Multi-occupant sensing: passenger/rear-cabin camera → zoned ambient + child-left-behind alerts (swap in PoseLandmarker; pipeline unchanged);
- Emotion→music personalization loop: make the `emotion`↔music mapping learnable (persist preferences in localStorage);
- Deeper rest mode: real service-area POI data (Amap/Baidu open API) + a 20-minute nap countdown with wake-up;
- "Night-guardian mode" on long night drives: suppress non-safety chatter (the graded `kind` system is the foundation).

**Technical**
- Upgrade `handleCommand` keyword matching to on-device LLM intent recognition (WebGPU + small model) — rule-engine structure unchanged;
- Adaptive DMS frame rate on phones: lower sampling / landmark thinning (the overlay already draws every 7th point; do the same for inference);
- Render the `evaAvatar.ts` bust geometry as a real 3D digital human replacing the SVG EvaFace (geometry is ready; only the render layer is missing);
- WebRTC two-device demo: judge's phone as the camera, big screen shows the cockpit reacting (send VisionSample over WebSocket — zero kernel changes).

**Demo / pitch**
- BootSplash already self-checks — add a "camera calibration" ritual animation to signal the vision is real;
- Record the official 60 s demo video: the auto-demo + DemoBanner narration are ready-made;
- The stats bar (478/0/3/43) and CHANGELOG are the iteration evidence chain — surface them proactively in Q&A.

---

## 9. Command cheat sheet & doc map

```bash
npm install      # postinstall copies MediaPipe WASM into public/ (offline-ready)
npm run dev      # dev server (5173 by default, auto-increments — watch the port!)
npm test         # 43 regression tests (core 16 + vision 8 + shell 19) — must stay green
npm run build    # tsc --noEmit + vite build
```

| Doc | Owns |
|---|---|
| `README.md` / `README_EN.md` | Front door: positioning / features / quick start / judging mapping |
| `AGENTS.md` | AI-collaboration contract: layout / verification / architecture rules / pitfalls |
| `docs/PIPELINE.md` | Parameter table (synced with params.ts) / data flow / demo script |
| `docs/功能说明.md` | Team feature manual (F11/F12 shortcuts and feature details) |
| `AI_USAGE.md` | AI-use transparency + third-party asset attribution (incl. 3D car CC-BY) |
| `CHANGELOG.md` | Versioned iteration record (readable form of commit history) |
| **This guide** | Architecture deep-read + reuse guide + extension cookbook + idea pool |

> Maintenance contract: architecture-level changes must sync §2–§4; new pitfalls go to §7; drop raw ideas into §8 whenever — no maturity required.
