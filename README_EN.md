# Eva Smart Cockpit — An L2 Cabin Agent Guarded by Machine Vision

> **[中文版](README.md)** | Geely Hackathon · Prototype Development Track (built from scratch within the official development window)
> Core idea: **Machine Vision × Smart Cockpit** — Cabin Perception, Human Protection: EVA unifies local DMS, semantic OMS, cabin memory, fatigue protection and guarded L2 responses in one explainable five-experience digital-twin demonstration.

**Official public competition repository:** [cuancen/hhcc2026-proto-intelligent-vision](https://github.com/cuancen/hhcc2026-proto-intelligent-vision)

**Team staging mirror:** [b1207739631-rgb/hhcc-2026-prototype](https://github.com/b1207739631-rgb/hhcc-2026-prototype)

## Positioning Statement (Important)

Eva is positioned as **L2 combined driving assistance** (driver monitoring + adaptive cruise + lane centering):
the system assists steering and speed **while the driver remains the responsible party at all times**, monitoring traffic and ready to take over.
Nowhere in the product (UI, scripts, docs) do we use L3/L4 autonomy claims; every Eva intervention is bounded to *reminders, suggestions, cabin adjustments, and assistance degradation*.

## Feature Overview

| Module | What it does |
|---|---|
| Machine-vision DMS | User-selected camera or local video → MediaPipe Face Landmarker (478 points, on-device WASM/GPU inference, zero upload) → EAR / blink rate / PERCLOS / head yaw & pitch / driver-presence. The Full Demo uses labelled replay by default and never requests camera access automatically |
| Semantic OMS | 23 simulated, seat-aware occupant states with confidence, duration and stale-data rules; the main trace uses a rear-right window risk and never pretends the OMS feed is real |
| Dual-channel fatigue fusion | Driving-workload fatigue (speed/road/duration) fused with vision PERCLOS by *take-the-stronger*; ≥60 gentle care / ≥85 urgent intervention + a rest-choice branch |
| Distraction guard | Eyes-off-road ≥2s warning, ≥4s urgent alert + L2 degradation (slower target speed, longer headway); auto-recovery when attention returns |
| Eva persona agent | One-line cinematic narration plus natural-language controls for temperature, music, massage, navigation, rest and L2 assistance |
| Complex-road synergy | Rain+night+congestion factor ≥2 → block entertainment, cautious mode; auto-restore when conditions ease |
| Digital-twin stage | Full-vehicle Three.js stage with a vehicle-anchored procedural road/city world, translucent cabin, DMS beam, rain-night lead vehicle and scene-specific cameras |
| Unified instrumentation | No split dashboard: the default stage keeps only the chapter, speed/L2, one EVA line and playback controls; a wide keyboard-accessible workbench shows Perception / Reasoning / Execution together |
| Five-experience tour | An approximately 118-second automatic tour through Daily Commute, Fatigue Guard, Complex Roads, Cabin Memory and OMS MomentTrace; every experience also runs independently |
| Landing hero | Graphite 3D car (CC-BY attributed Sketchfab model, meshopt-compressed 24 MB→5 MB) with a shared EVA loading/offline state |

## Quick Start

```bash
npm install     # postinstall copies the MediaPipe WASM runtime into public/ (self-hosted, offline-ready)
npm run dev     # http://localhost:5173 (Vite auto-increments the port if taken)
npm test        # 85 regression tests across core, vision, OMS, timeline and interaction
npm run build   # type-check + production build
```

**Demo tips**: click **Run Full Demo** on the landing page to autoplay all five experiences once the stage is ready. Direct `#/cockpit` visits remain frozen at **Start Experience**. Use **Pause / Continue / Replay Full Demo**, or press `Space`; `1/2/3` select the three driving scenes, `D` restarts the selected experience, and `L` toggles L2.
Open **Evidence** to inspect DMS and OMS sources, fatigue fusion, road-context reasoning, cabin actuators and the alert log. **Live DMS** requests the camera only when clicked; **Upload Video** analyzes a selected local video on-device. With neither selected, the Full Demo uses an explicitly labelled replay fallback.

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
│   └── components/  header / EVA narration / three-column evidence workbench / movie controls
└── landing/   Brand homepage (three.js 3D car hero + shared EVA loading/offline state)
```

Stability by design: the simulation clock advances only while transport is `running`; ready, paused, Evidence-open and completed states freeze route and time. The vision model and WASM runtime are self-hosted, camera and local-video inputs fail safely to labelled replay, and WebGL/model failure keeps the cockpit operational behind an EVA status view. Three.js is dynamically imported. Full parameter table and data flow live in `docs/PIPELINE.md`; a deeper architecture guide is in [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) / [`PROJECT_GUIDE_EN.md`](PROJECT_GUIDE_EN.md).

## Judging-criteria mapping

| Criterion | Where this project lands |
|---|---|
| Interaction & UX | Full-screen vehicle digital twin + 21-node five-experience tour + calibrated scene cameras + pause/continue/replay + hidden evidence workbench |
| Accessibility | 4-step font scaling (persisted) / high-contrast mode / full keyboard operation / aria-live graded announcements / prefers-reduced-motion / skip links |
| Solid core | Zero-DOM kernel + 85 regression tests + pausable single timeline + single-source params + vision/WebGL fallbacks |
| Versatility | 5 selectable experiences × live camera/local video/replay DMS × 23 OMS states × responsive layout (desktop/tablet/phone) |
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
