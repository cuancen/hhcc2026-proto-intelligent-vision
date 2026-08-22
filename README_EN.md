# Eva Smart Cockpit — An L2 Cabin Agent Guarded by Machine Vision

> **[中文版](README.md)** | Geely Hackathon · Prototype Development Track (built from scratch within the official development window)
> Core idea: **Machine Vision × Smart Cockpit** — a real browser-side facial-landmark model drives Driver Monitoring (DMS), fused with driving-workload signals, so the cabin agent of the L2 era can actually *see the driver*.

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
| Eva persona agent | Mood-linked expressions, chat stream with typewriter orchestration, contextual quick replies, natural-language commands (temperature / music / massage / navigation / rest / L2 toggle) |
| Complex-road synergy | Rain+night+congestion factor ≥2 → block entertainment, cautious mode; auto-restore when conditions ease |
| Situation main view | Canvas pseudo-3D road (day/night, rain, curves, lead-vehicle brake lights) + HUD (speed, L2 state, degradation) |
| Three demo scenes | ☀ Commute (ambient intelligence) / 😮‍💨 Fatigue guard (dual-threshold intervention) / ⛈ Complex roads (cabin-drive synergy) + a 60-second auto demo with narrator banner |
| Landing hero | Dark red-orange design language + real-time 3D car (three.js, CC-BY attributed Sketchfab model, meshopt-compressed 24 MB→5 MB) with automatic wireframe fallback |

## Quick Start

```bash
npm install     # postinstall copies the MediaPipe WASM runtime into public/ (self-hosted, offline-ready)
npm run dev     # http://localhost:5173 (Vite auto-increments the port if taken)
npm test        # 51 regression tests (core / vision metrics / emotion / geometry — vitest, zero DOM)
npm run build   # type-check + production build
```

**Demo tips**: click `▶ 自动演示` (auto demo, ~60 s through all three scenes), or press `1/2/3` to switch scenes, `D` for the demo, `L` to toggle L2.
For the real machine-vision pipeline, click `📷 开启摄像头监测` in the DMS panel — every frame is inferred locally and never uploaded. No camera? Use the `模拟信号` (simulated signal) source: it feeds the exact same metrics pipeline as the real model.

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
├── shell/     UI (React 18 + TS)
│   ├── hooks/  useCockpit (100 ms interval drive) / useDms / useTts / useUiPrefs
│   └── components/  16+ panels & bars
└── landing/   Brand homepage (three.js 3D car hero + hand-written Canvas wireframe fallback)
```

Stability by design: simulation runs on `setInterval` (never freezes in background tabs); the vision model & WASM runtime are self-hosted under `public/` with multi-source fallback; any camera/model failure degrades to the simulated signal — the demo never breaks. Three.js is dynamically imported (separate ~164 KB gzip chunk, never touches the dashboard bundle). Full parameter table and data flow in `docs/PIPELINE.md`; a deep architecture & reuse guide in [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) (中文) / [`PROJECT_GUIDE_EN.md`](PROJECT_GUIDE_EN.md).

## Judging-criteria mapping

| Criterion | Where this project lands |
|---|---|
| Interaction & UX | Three-column cockpit layout + 60 s narrated auto-demo + hotkeys (1/2/3/D/L) + conversational commands + one-click scene injection |
| Accessibility | 4-step font scaling (persisted) / high-contrast mode / full keyboard operation / aria-live graded announcements / prefers-reduced-motion / skip links |
| Solid core | Zero-DOM kernel + 51 regression tests + single-source params + multi-source vision fallback + simulated-signal fallback |
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
- The landing hero car is a community-made Sketchfab model by *crivero* (CC-BY, attributed in `AI_USAGE.md` and the page footer), **not an official Geely asset**; its paint is overridden to white at runtime.
