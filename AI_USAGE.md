# AI Usage & Attribution

## Design inspiration

> UI/UX design inspiration is referenced from the HackHarvard 2024 project **Garuda**
> (dark theme, red-orange radial glow, floating 3D hero, minimal navigation).
> All frontend components, styling code, and 3D wireframe rendering logic are
> implemented by our team from scratch.
> No source code or assets are directly copied from the Garuda repository.

中文对照：UI/UX 设计灵感参考 HackHarvard 2024 项目 Garuda（深色主题、红橙径向光晕、
悬浮 3D 主视觉、极简导航）。所有前端组件、样式代码与渲染逻辑均为本团队从零实现，
没有直接复制 Garuda 仓库的任何源码或资源文件（首页 3D 车模型的第三方来源见下文
3D-Asset Note）。

## What we did NOT reuse

- No component, page, or business logic source code from Garuda.
- No CSS/animation files from Garuda.
- No 3D model assets from Garuda (the Garuda hero visual is NOT used here).

## 3D-Asset Note (CC-BY attribution)

Base 3D car asset downloaded from Sketchfab:

- Author: **crivero**
- Source Link: <https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56>
- License: **CC-BY (Creative Commons Attribution)**

Note: This is a community-made fan model, **NOT an official Geely factory asset**.
The vehicle's body material is dynamically overridden at runtime via our
Three.js frontend code (graphite metal; glass and emissive light parts keep their
original materials); the original downloaded asset is black. The file was also
re-encoded with gltf-transform (meshopt geometry compression, 24 MB → 5 MB);
no geometry was modified. This static glb asset is used for the landing hero
and the cockpit digital-twin prototype, with automatic Canvas/2D fallbacks if
loading fails. All Three.js scene setup, lighting, shadow, cinematic camera,
procedural cabin and fallback rendering logic are fully
implemented by our team. No external hackathon project source code is reused.
The same attribution is shown in the landing page footer.

中文对照：首页 Hero 3D 车辆模型取自 Sketchfab，原作者 crivero，协议 CC-BY（署名）。
该模型为社区爱好者自制，**并非吉利官方原厂资产**；车身漆面由我们的 Three.js
前端代码在运行时覆盖为石墨金属材质（玻璃与车灯发光件保留原材质），并对文件做了
meshopt 几何压缩（24 MB → 5 MB，未改动几何）。GLB 同时用于首页与座舱数字孪生，
加载失败自动回退团队自研的 Canvas/二维舞台；Three.js 场景、灯光、阴影、电影镜头、
程序化座舱与降级渲染均为团队自研，未复用任何外部黑客松项目源码。页脚同步展示同一署名。

## Third-party dependencies (used as normal libraries)

- [React 18](https://react.dev/) / [Vite](https://vitejs.dev/) — MIT
- [three.js](https://threejs.org/) — MIT (landing hero and cockpit digital twin;
  loaded via dynamic import, with wireframe/2D fallback)
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) — Apache-2.0,
  self-hosted model & WASM runtime (`public/models/`, `scripts/copy-wasm.mjs`)

## AI assistance

AI coding assistants were used during the official development window for
scaffolding, refactoring and test writing under team direction. Every module
can be explained by the team, and all business logic lives in this repository
with a commit-by-commit history authored during the event.

## L2 positioning

EVA targets **L2 combined driving assistance**. The driver remains the
responsible party at all times; EVA's interventions are limited to alerts,
suggestions, cabin adjustments, and assistance degradation.
