# EVA Smart Cockpit — Cabin Perception, Human Protection

> [English project guide](README_EN.md) · HHCC 2026 Prototype Development Track · Built during the official development period

**Official public competition repository:** [cuancen/hhcc2026-proto-intelligent-vision](https://github.com/cuancen/hhcc2026-proto-intelligent-vision)

**Team staging mirror:** [b1207739631-rgb/hhcc-2026-prototype](https://github.com/b1207739631-rgb/hhcc-2026-prototype)

EVA is an explainable in-cabin agent that combines on-device driver monitoring, workload fatigue, cabin actuation, and L2 assistance into one three-act digital-twin demonstration: **City Commute, Fatigue Guard, and Complex Roads**.

## Safety positioning

This prototype demonstrates **L2 combined driving assistance**: lane-level steering and acceleration support with continuous driver supervision. The driver remains responsible at all times and must be ready to take over. EVA is limited to monitoring, alerts, recommendations, cabin adjustments, and safe assistance degradation; this project does not claim L3/L4 autonomy.

## Current verified checkpoint

- Full-screen Three.js vehicle digital twin with event-driven rendering and WebGL fallback.
- Browser-local MediaPipe DMS: EAR, PERCLOS, head pose, eyes-off-road, presence, and six-state emotion classification.
- Workload and vision fatigue fusion with care and urgent thresholds.
- Approximately 60-second pausable tour across commute, fatigue, rest, rain-night complexity, recovery, and voice control.
- Technical Evidence interface exposing perception, reasoning, execution, simulation boundaries, and driver responsibility.
- English UI, keyboard control, high contrast, scalable text, reduced-motion support, and camera/simulation fallback.
- 63 automated regression tests at this checkpoint.

## Run locally

Requirements: Node.js 20.19+ (or 22.12+) and a modern browser.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Select `Run Live Demo` for the automatic three-act tour, or `Enter Dashboard` / `#/cockpit` for manual control.

```bash
npm test
npm run build
```

`npm install` runs `scripts/copy-wasm.mjs`, copying the MediaPipe WASM runtime into `public/mediapipe-wasm/` for local serving. That generated directory and `dist/` are intentionally not committed.

## Demo controls

- `Space`: start, pause, or continue.
- `D`: replay the automatic tour.
- `1`, `2`, `3`: City Commute, Fatigue Guard, or Complex Roads.
- `L`: toggle L2 assistance.
- `Evidence`: inspect real/simulated input boundaries and system decisions.

Camera input is processed locally in the browser and is not uploaded. Simulated DMS and driving-environment inputs are visibly identified.

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
