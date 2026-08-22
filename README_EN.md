# Eva Smart Cockpit — An L2 Cabin Agent Guarded by Machine Vision

> **[中文版](README.md)** | Geely Hackathon · Prototype Development Track (built from scratch within the official development window)
> Core idea: **Machine Vision × Smart Cockpit** — Cabin Perception, Human Protection: EVA unifies on-device DMS, workload fatigue and cabin/L2 responses in one explainable three-act digital-twin demonstration.

## Positioning Statement (Important)

Eva is positioned as **L2 combined driving assistance** (driver monitoring + adaptive cruise + lane centering):
the system assists steering and speed **while the driver remains the responsible party at all times**, monitoring traffic and ready to take over.
Nowhere in the product (UI, scripts, docs) do we use L3/L4 autonomy claims; every Eva intervention is bounded to *reminders, suggestions, cabin adjustments, and assistance degradation*.

## Feature Overview

| Module | What it does |
|---|---|
| Machine-vision DMS | Camera → MediaPipe Face Landmarker (478 points, on-device WASM/GPU inference, zero upload) → EAR blink rate / PERCLOS eye-closure ratio / head yaw & pitch / driver-presence |
| Dual-channel fatigue fusion | Driving-workload fatigue (speed/road/duration) fused with vision PERCLOS by *take-the-stronger*; ≥60 gentle care / ≥85 urgent intervention + a rest-choice branch |
| Distraction guard | Eyes-off-road ≥2s warning, ≥4s urgent alert + L2 degradation (slower target speed, longer headway); auto-recovery when attention returns |
| Eva persona agent | One-line cinematic narration plus natural-language controls for temperature, music, massage, navigation, rest and L2 assistance |
| Complex-road synergy | Rain+night+congestion factor ≥2 → block entertainment, cautious mode; auto-restore when conditions ease |
| Digital-twin stage | Full-vehicle Three.js stage with translucent body, procedural cabin/EVA, DMS beam, rain-night feedback and story-driven camera presets |
| Unified instrumentation | No split dashboard: slim edge HUD rails keep EVA/driver and DMS/L2/cabin state visible; complete Perception / Reasoning / Execution evidence stays in a keyboard-accessible drawer |
| Three-act experience | A 60-second auto tour through Commute, Fatigue Guard and Complex Roads; each scene also runs independently |
| Landing hero | Graphite 3D car (CC-BY attributed Sketchfab model, meshopt-compressed 24 MB→5 MB) with a shared EVA loading/offline state |

## Quick Start

```bash
npm install     # postinstall copies the MediaPipe WASM runtime into public/ (self-hosted, offline-ready)
npm run dev     # http://localhost:5173 (Vite auto-increments the port if taken)
npm test        # 63 regression tests: core 25 + vision 13 + shell/interaction 25
npm run build   # type-check + production build
```

**Demo tips**: click **Run Live Demo** on the landing page to enter and autoplay once the stage is ready. Direct `#/cockpit` visits remain frozen at **Start Experience**. Use **Pause / Continue / Replay Tour**, or press `Space`; `1/2/3` select the three scenes, `D` restarts the tour, and `L` toggles L2.
Open **Evidence** to inspect the real camera, DMS metrics, fatigue fusion, road-context reasoning, cabin actuators and full alert log. If camera access fails, **SIM** feeds the exact same metrics pipeline.

## Architecture

```
src/
├── core/      Kernel (zero DOM, independently testable & portable)
│   ├── sim.ts        simulation dynamics: speed / fatigue / emotion / road
│   ├── evaRules.ts   Eva rule engine: cooldown gates + scene scripts + user branches
│   └── params.ts     single source of truth for all thresholds
├── vision/    Machine vision
│   ├── metrics.ts    pure functions: EAR / head pose / PERCLOS window / eyes-off-road
│   ├── dms.ts        MediaPipe engine: multi-source fallback (local WASM → jsDelivr → unpkg; GPU → CPU)
│   └── simVision.ts  simulated signal fallback (shares the same metrics pipeline)
├── shell/     Cinematic UI (React 18 + TS)
│   ├── twin/   Three.js digital twin + pure frame derivation + EVA status fallback
│   ├── hooks/  pausable cockpit clock / DMS / English TTS / UI preferences
│   └── components/  header / edge HUD rails / narration / story rail / evidence drawer / movie controls
└── landing/   Brand homepage (three.js 3D car hero + shared EVA loading/offline state)
```

Stability by design: the simulation clock advances only while transport is `running`; ready, paused and completed states freeze route and time. The vision model & WASM runtime are self-hosted with multi-source fallback, camera failure degrades to the simulated signal, and WebGL/model failure keeps the cockpit operational behind an EVA status view. Three.js is dynamically imported. Full parameter table and data flow live in `docs/PIPELINE.md`; a deeper architecture guide is in [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) / [`PROJECT_GUIDE_EN.md`](PROJECT_GUIDE_EN.md).

## Judging-criteria mapping

| Criterion | Where this project lands |
|---|---|
| Interaction & UX | Full-screen vehicle digital twin + 9-shot three-act tour + pause/continue/replay + compact edge instrumentation + hidden evidence drawer |
| Accessibility | 4-step font scaling (persisted) / high-contrast mode / full keyboard operation / aria-live graded announcements / prefers-reduced-motion / skip links |
| Solid core | Zero-DOM kernel + 63 regression tests + pausable single timeline + single-source params + vision/WebGL fallbacks |
| Versatility | 3 demo scenes × 3 sim speeds × camera/simulated vision sources × responsive layout (desktop/tablet/phone) |
| Iteration evidence | Everything committed during the official window; the commit history is the iteration record (see CHANGELOG.md) |

## Repository layout

```
├── public/models/face_landmarker.task   self-hosted vision model (Apache-2.0)
├── public/models/geely.glb              hero car model (CC-BY, meshopt-compressed)
├── scripts/copy-wasm.mjs                WASM self-hosting copy (postinstall)
├── src/{core,vision,shell,landing}      see architecture above
├── tests/                               core + vision + geometry regressions
└── docs/PIPELINE.md                     parameter table / data flow / demo script
```

## Disclaimers

- Speeds, fatigue rates, temperatures etc. in the demo are **simulated assumptions** (centralized in `src/core/params.ts`), not production calibrations;
- The MediaPipe Face Landmarker model & runtime are Apache-2.0, self-hosted;
- Camera frames are inferred only inside this device's browser — nothing is collected or uploaded;
- The vehicle model is a community-made Sketchfab model by *crivero* (CC-BY, attributed in `AI_USAGE.md` and the page footer), **not an official Geely asset**; its material is rendered as graphite metal at runtime.
