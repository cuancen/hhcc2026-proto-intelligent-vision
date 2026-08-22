# EVA Smart Cockpit — Cabin Perception, Human Protection

> [English project guide](README_EN.md) · HHCC 2026 Prototype Development Track · Built during the official development period

**Official public competition repository:** [cuancen/hhcc2026-proto-intelligent-vision](https://github.com/cuancen/hhcc2026-proto-intelligent-vision)

**Team staging mirror:** [b1207739631-rgb/hhcc-2026-prototype](https://github.com/b1207739631-rgb/hhcc-2026-prototype)

EVA is an explainable in-cabin agent that combines local driver monitoring, semantic occupant monitoring, cabin memory, cabin actuation, and L2 assistance. Its default presentation is one uninterrupted five-experience tour: **Daily Commute → Fatigue Guard → Complex Roads → Cabin Memory → OMS MomentTrace**.

## Safety positioning

This prototype demonstrates **L2 combined driving assistance**: lane-level steering and acceleration support with continuous driver supervision. The driver remains responsible at all times and must be ready to take over. EVA is limited to monitoring, alerts, recommendations, cabin adjustments, and safe assistance degradation; this project does not claim L3/L4 autonomy.

## Current verified checkpoint

- Full-screen Three.js vehicle digital twin with calibrated left-hand-drive occupants, vehicle-anchored road motion, scene-specific cameras, event-driven rendering, and WebGL fallback.
- Browser-local MediaPipe DMS from an explicitly selected live camera or local video: EAR, PERCLOS, head pose, eyes-off-road, presence, and six-state emotion classification.
- Simulated semantic OMS with 23 test states, seat-aware risk rules, a guarded L2 response, dual-sensor recovery, and one explainable MomentTrace artifact.
- Workload and vision fatigue fusion with care and urgent thresholds.
- Approximately 118-second pausable Full Demo that automatically completes all five experiences; every experience also remains individually selectable.
- Wide three-column Technical Evidence workbench exposing perception, reasoning, execution, simulation boundaries, and driver responsibility.
- Local-video upload replaces the old simulation button; the default Full Demo uses a clearly labelled replay and never requests camera access by itself.
- English UI, serialized EVA speech, keyboard control, high contrast, scalable text, reduced-motion support, and explicit sensor fallbacks.
- 85 automated regression tests at this checkpoint.

## Run locally

Requirements: Node.js 20.19+ (or 22.12+) and a modern browser.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Select `Run Full Demo` for the automatic five-experience tour, or `Enter Dashboard` / `#/cockpit` for manual control.

```bash
npm test
npm run build
```

`npm install` runs `scripts/copy-wasm.mjs`, copying the MediaPipe WASM runtime into `public/mediapipe-wasm/` for local serving. That generated directory and `dist/` are intentionally not committed.

## Demo controls

- `Space`: start, pause, or continue.
- `D`: replay the selected experience or automatic Full Demo.
- `1`, `2`, `3`: City Commute, Fatigue Guard, or Complex Roads.
- `L`: toggle L2 assistance.
- `Evidence`: inspect DMS/OMS sources, reasoning, actions, and driver responsibility.

The Full Demo starts with `DMS · REPLAY FALLBACK`, so it is deterministic and never prompts for camera permission. `Live DMS` and `Upload Video` are optional evidence inputs selected inside Evidence; both are processed locally in the browser and are not uploaded. OMS and the driving environment remain visibly identified simulations.

## Architecture

```text
src/core/      DOM-free simulation, EVA rules, parameters, and L2 policy
src/vision/    MediaPipe DMS, pure metrics, and simulated fallback
src/landing/   English landing experience and Three.js vehicle hero
src/shell/     Cockpit UI, timeline, EVA avatar, Evidence, and digital twin
tests/         Core, vision, shell, timeline, and twin-state regression tests
public/        Self-hosted face model, vehicle GLB, and approved EVA assets
docs/          Pipeline, decisions, features, and project guidance
```

The simulation clock advances only while the experience is running. Ready, paused, Evidence-open, and completed states freeze simulation. The high-poly vehicle renders on demand during transitions rather than using an always-on animation loop.

## Competition records

- [Decision log](docs/DECISIONS.md)
- [AI usage disclosure](AI_USAGE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Pipeline and parameters](docs/PIPELINE.md)
- [Project guide](PROJECT_GUIDE_EN.md)

The public history preserves the official-period implementation commits instead of flattening them into a single source dump. No credentials, personal data, dependency directories, generated builds, or research-workspace artifacts belong in this repository.
