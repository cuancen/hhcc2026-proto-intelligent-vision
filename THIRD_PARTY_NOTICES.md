# Third-Party Notices

This file records the third-party libraries, model files, and visual references used by the EVA Smart Cockpit prototype. Versions reflect `package-lock.json` at the verified checkpoint.

## Runtime libraries

| Item | Version | License | Source | Use and modification |
|---|---:|---|---|---|
| React | 18.3.1 | MIT | https://github.com/facebook/react | Application component runtime; unmodified dependency |
| React DOM | 18.3.1 | MIT | https://github.com/facebook/react | Browser renderer; unmodified dependency |
| Three.js | 0.185.1 | MIT | https://github.com/mrdoob/three.js | Landing vehicle and event-driven digital-twin rendering; unmodified dependency |
| MediaPipe Tasks Vision | 0.10.35 | Apache-2.0 | https://github.com/google-ai-edge/mediapipe | Browser-local Face Landmarker inference; WASM copied locally by `scripts/copy-wasm.mjs` |

## Development tools

| Item | Version | License | Source | Use |
|---|---:|---|---|---|
| Vite | 8.2.2 | MIT | https://github.com/vitejs/vite | Development server and production build |
| Vite React plugin | 6.1.0 | MIT | https://github.com/vitejs/vite-plugin-react | React transform and Fast Refresh integration |
| Vitest | 4.1.11 | MIT | https://github.com/vitest-dev/vitest | Automated regression tests |
| TypeScript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript | Static type checking |

Transitive package versions and license metadata are locked in `package-lock.json`.

## MediaPipe Face Landmarker model

- File: `public/models/face_landmarker.task`
- Upstream source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Project and license reference: https://github.com/google-ai-edge/mediapipe (Apache-2.0)
- Purpose: 478-point face landmarks and blendshape output for local DMS metrics.
- Modification: none. The file is self-hosted to improve demo reliability; camera frames remain in the browser.

## Geely community vehicle model

- File: `public/models/geely.glb`
- Asset title: `geelyblack.glb`
- Author: **crivero**
- Source: https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56
- License: Creative Commons Attribution (CC BY)
- Purpose: landing-page vehicle and cockpit digital twin.
- Modifications: re-encoded with glTF Transform and Meshopt compression (approximately 24 MB to 5 MB) without geometry changes; the application overrides selected body materials at runtime.
- Disclosure: this is a community-made model, not an official Geely factory asset. The required author attribution is also shown in the application footer.

## EVA character image

- Files: `public/eva/eva-reference.png`, `public/eva/eva-shell.png`
- Source: team-provided EVA reference image, explicitly approved by the user for local project use and derivative generation.
- Modification: OpenAI image generation removed the fixed eyes and produced an eye-free transparent shell; code overlays original SVG expressions at runtime.
- Purpose: brand, narration, loading, and offline feedback.
- Rights status: treated as a team-authorized project asset; the submitting team remains responsible for confirming final competition-use rights.

## Visual inspiration and fonts

- The dark minimal visual direction references HackHarvard 2024 project **Garuda** as inspiration only. No Garuda source code, CSS, components, animations, models, or images are included.
- The UI uses system fonts (`Segoe UI`, `PingFang SC`, `Microsoft YaHei`, Bahnschrift/DIN-style fallbacks). No font files are bundled.

Product and vehicle names may be trademarks of their respective owners. This prototype does not claim official authorization or production readiness.
