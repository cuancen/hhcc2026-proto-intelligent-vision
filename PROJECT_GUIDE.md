# EVA 智能座舱 · 项目全览（复用 / 二次开发 / 想法碰撞指南）

> **[English version](PROJECT_GUIDE_EN.md)** — 面向队友的深度导览：比 README 更深一层——架构为什么这样设计、哪些模块可以直接搬走复用、
> 怎么安全地改、以及下一步可以往哪走。配套文档地图见文末。
> 更新：2026-08-22（0.9.0，电影化整车数字孪生已融合至远端最新基线）

---

## 0. 三十秒理解这个项目

**一句话**：跑在浏览器里的 L2 辅助驾驶座舱原型——端侧 DMS 与情境语义记忆共同解释驾驶员为什么看开路面，由 EVA 解决原因并在整车数字孪生中确认结果。

**两个页面**（hash 路由，零路由库）：
- `/` 品牌首页 Landing：石墨黑 + 橙/青设计语言 + **石墨金属 3D 车 Hero**（three.js + Sketchfab CC-BY 模型，加载/失败显示 EVA 状态头像）
- `#/cockpit` 单一全屏数字孪生主舞台：左右边缘 HUD 只保留高频状态，完整技术证据集中在抽屉

**演示主轴**：60 秒、9 个稳定镜头提示依次走完日常通勤、疲劳守护、复杂路况三幕。三个场景也可单独运行；暂停、继续和重播不会重复触发镜头。

---

## 1. 技术选型与"零依赖哲学"

| 用了什么 | 为什么 |
|---|---|
| React 18 + Vite 5 + TS strict | 主流、快、类型即文档 |
| **不用**路由库 / 状态库 / UI 组件库 | hash 路由 15 行搞定；状态就是 `useCockpit` 一个 hook；自研 CSS 反而赢了风格一致性（评委也认可"从零搭建"） |
| MediaPipe Tasks Vision（Apache-2.0） | 浏览器端 478 点面部关键点，WASM/GPU 本地推理，画面零上传 |
| three.js（MIT，动态 import） | 首页 Hero 与座舱数字孪生共用；模型失败仍可完整运行二维安全舞台 |
| vitest | 内核/视觉纯函数回归，零 DOM 所以测试飞快 |

**定位铁律**（全项目话术红线）：只做 **L2 辅助驾驶**表述，驾驶责任始终属于人；不出现 L3/L4 字样。

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  landing/   品牌首页（独立于业务，可整体删掉不影响座舱）        │
│    CarModel → carScene(three.js) ⇄ EVA 加载/离线状态头像      │
├─────────────────────────────────────────────────────────────┤
│  shell/     UI 外壳                                          │
│    hooks: useCockpit(订阅内核) useDms(视觉生命周期)           │
│           useTts(本地语音) useUiPrefs(字号/对比度/静音)       │
│    twin: 整车场景 + 剧情帧派生 + 二维降级                   │
│    components: 边缘 HUD / 单句叙事 / 三幕轨 / 证据抽屉       │
├────────────── requestAnimationFrame 直读 liveState ──────────┤
│  vision/    机器视觉（只产出 VisionSample，不碰 UI）          │
│    dms.ts(MediaPipe 引擎,多源容灾) → metrics.ts(纯函数) ←──┐  │
│    simVision.ts(模拟信号, 共用同一套 metrics 纯函数) ──────┘  │
├──────────────────────── act.setVision(sample) ──────────────┤
│  core/      内核（零 DOM！不 import React/浏览器对象）        │
│    sim.ts(仿真动力学) + evaRules.ts(规则引擎) + params.ts    │
│    index.ts createCockpit(): state/snapshot()/step()/actions │
└─────────────────────────────────────────────────────────────┘
```

**数据流一句话**：100ms 时钟只在 `running` 时调用 `step(dt)`；准备、暂停、完成均冻结仿真。数字孪生由 `CockpitState + DemoCue + mood` 纯函数派生镜头/透明度/热点/灯光；视觉模块仍只以 `act.setVision()` 写入传感数据。

### 分层铁律（改动前必读）

1. **core 零 DOM**——内核可以在 Node 里裸跑（测试就是这么做的），搬到任何框架都能用；
2. **vision 与内核解耦**——视觉只产出 `VisionSample`（core/types.ts 里的纯数据接口），真实模型和模拟信号共用 `metrics.ts` 同一套纯函数；
3. **参数唯一出处**——所有阈值在 `core/params.ts`，散落硬编码是违规；
4. **容灾优先**——任何外部资源失败必须零影响（详见 §5 容灾总表）。

---

## 3. 目录导览（逐文件）

```
src/
├─ core/                       ★ 内核（可整体复用，见 §6）
│  ├─ params.ts                  P（全部阈值）+ SCENARIOS（三场景元数据）
│  ├─ types.ts                   CockpitState 全家桶（drive/driver/cabin/chat/alerts/pending/stats）
│  ├─ sim.ts                     stepSim 动力学：速度一阶惯性/疲劳累积/情绪游走/fuseFatigue 融合
│  ├─ evaRules.ts                规则引擎：gate 冷却闸门/场景脚本队列/handleCommand 指令解析/
│  │                             双阈值疲劳+pending 用户分支/L2 降级/情绪联动/复杂路况屏蔽
│  └─ index.ts                   createCockpit()：state + snapshot() + step() + actions
├─ vision/                     ★ 机器视觉
│  ├─ metrics.ts                 纯函数：earOf/bothEar、headPoseOf(4×4矩阵→yaw/pitch)、
│  │                             createPerclosTracker(30s 滑窗)、createLookAwayTracker
│  ├─ dms.ts                     MediaPipe 引擎：WASM 三源容灾 + 模型双源 + GPU→CPU 回退
│  └─ simVision.ts               模拟信号：眨眼合成(周期随疲劳缩短)+随机视线离开事件，
│                                喂给与真实模型相同的 metrics 管线
├─ shell/
│  ├─ hooks/
│  │  ├─ useCockpit.ts           订阅内核：interval 驱动 + 快照 + liveState 直读通道
│  │  ├─ useDms.ts               视觉生命周期：model/sim/off 三态，失败自动降级
│  │  ├─ useTts.ts               speechSynthesis(en-US)，无语音包环境自动跳过
│  │  └─ useUiPrefs.ts           字号 4 档/高对比/语音开关，localStorage 持久化
│  ├─ autoDemo.ts                可暂停 60s 单时间轴：9 个 DemoCue + transport API
│  ├─ simulationClock.ts         仅 running 时推进内核
│  ├─ ambient.ts                 紧急度→三档氛围色（青碧/琥珀/红）
│  ├─ evaFace.ts / evaAvatar.ts  情绪推导纯函数 / 半身像线框几何（纯函数）
│  ├─ twin/                      Three.js 整车场景 / deriveTwinFrame / 二维安全舞台
│  ├─ theme.css                  车规电影化设计系统 + 响应式证据抽屉
│  └─ components/                CockpitHeader/SystemsRail/EvaNarration/StoryRail/
│                               CinemaControls/EvidenceDrawer/EntryTransition
├─ landing/
│  ├─ Landing.tsx                首页骨架（Hero/Features/Demo/Run/About/页脚署名）
│  ├─ CarModel.tsx               3D 车 React 包装：动态 import + EVA 状态回退 + 交叉淡入
│  ├─ carScene.ts                three.js 场景：石墨金属覆盖(跳过玻璃/发光件)/RoomEnvironment/
│  │                             品牌橙轮廓光/贴地软阴影/双向自动取景/自转悬浮/完整 dispose
│  ├─ ../shared/EvaLoadingAvatar  首页/进舱/座舱共用加载与离线状态
│  └─ landing.css                首页样式（红橙设计语言 + .car-stage 过渡）
tests/                          core.test(25) + vision.test(13) + shell.test(25) = 63 项
public/models/                  face_landmarker.task(自托管) + geely.glb(meshopt 压缩 5MB)
scripts/copy-wasm.mjs           postinstall：MediaPipe WASM → public/（离线可用）
docs/                           PIPELINE(参数表/数据流) 功能说明 AI使用声明
```

---

## 4. 六个核心机制（读懂这节 = 能安全改动）

### 4.1 双通道状态分发（useCockpit）

```
100ms 时钟 ── transport=running ──▶ api.step(0.2 × speed) → structuredClone 快照 → React
           └─ ready/paused/completed ──▶ 不推进仿真
liveState() + DemoCue + mood ──▶ deriveTwinFrame() ──▶ 事件驱动 Three.js 渲染
```
- **为什么**：快照保证 React 纯净（状态必须 JSON 安全——别放 Map/Set/函数）；活引用让数字孪生不必为了读取最新状态触发 React 重渲染。
- **时间体系**：dt 单位是“仿真分钟”。电影时间轴独立、可暂停，并剔除模型解码级长阻塞；准备、暂停和完成状态必须冻结时间与路线。

### 4.2 规则引擎（evaRules.ts）

- **冷却闸门 `gate(ctx, key, coolMin, fire)`**：所有重复性播报必须过闸门，key 隔离（`fat1/fat2/look/emoLow/...`），冷却是仿真分钟；
- **双阈值疲劳**：`fatigue ≥ 60` 温柔关怀（调座舱）→ `≥ 85` 紧急干预（pushPending 弹选择框：立即休息 / 再坚持）→ 拒绝休息则 `cd.fat2 = t + 6` 实现到点再升级；
- **L2 降级**：视线离开 ≥4s → `l2Degraded`（缩速拉距），回正 <0.5s 自动恢复——舱驾协同的最直观证据；
- **场景脚本队列**：`applyScenario` 用 `at(delay, fn)` 排队播报，时刻基于当前 t 顺延，中途切场景不会挤压。

### 4.3 视觉管线（vision/）

```
MediaPipe 478 点 ─┐
                  ├→ metrics.ts 纯函数（EAR/PERCLOS 滑窗/头姿/视线离开）→ VisionSample → act.setVision()
simVision 合成信号 ┘（与真实模型走完全相同的 metrics 管线）
```
- **EAR**：六点法 `(|p2-p6|+|p3-p5|) / 2|p1-p4|`，`< 0.15` 判闭眼帧；
- **PERCLOS**：30 秒滑窗闭眼帧占比 + 每分钟眨眼数（窗口不足按时间外推）；
- **头姿**：从 facialTransformationMatrixes 4×4 列主序矩阵分解 yaw/pitch，`|yaw|>22° 或 |pitch|>18°` 记视线离开；
- **融合**：`fuseFatigue = max(仿真疲劳, 185×PERCLOS, min(40, 视线离开秒×6))`——取强而非加权，安全优先。

### 4.4 容灾总表（本项目的招牌设计）

| 失败点 | 降级路径 | 实现 |
|---|---|---|
| WASM 运行时 CDN 挂 | 本地自托管 → jsDelivr → unpkg | `dms.ts WASM_SOURCES + firstOk()` |
| 模型文件挂 | 本地 → Google 官方源 | `MODEL_SOURCES` |
| GPU delegate 失败 | 自动重试 CPU | `tryCreate('GPU') catch → CPU` |
| 摄像头被拒绝 | 自动切模拟信号，不报错 | `useDms.startModel catch` |
| 无语音包环境 | TTS 静默跳过（防渲染进程挂死） | `useTts` |
| 3D 车加载失败 | 保留 EVA 离线状态，座舱功能继续运行 | `CarModel.tsx / TwinStage.tsx catch` |
| 模拟信号 | 与真实管线共用 metrics，链路一致 | `simVision.ts` |

`firstOk(sources, open, label)` 这个依次尝试的小函数是整个容灾观的浓缩——新外部资源照此模式接。

### 4.5 自动演示与页面接力（autoDemo.ts + App.tsx）

- 剧本 = 9 个稳定 `DemoCue` + 单一时间轴调度器；`pause/resume/restart/stop` 不会重复触发步骤；
- Landing「Run Live Demo」→ `sessionStorage['eva.autodemo']='1'` → hash 跳座舱 → 舞台就绪后自动开演；
- 暂停不清理现场，完成后冻结现场；评委可以随时打开证据抽屉检查链路。

### 4.6 首页 3D 车（landing/carScene.ts）

- GLB 是 Sketchfab CC-BY 模型经 **gltf-transform quantize+meshopt 压缩（24MB→5MB）**，几何未动；解码用 three 自带 MeshoptDecoder，离线可用；
- 运行时石墨金属材质覆盖：跳过透明材质（玻璃）与自发光材质（车灯），并保持单材质/材质数组形态，避免无 geometry groups 的网格不可见；
- 动态 import（three 独立 chunk ~164KB gzip）+ `requestIdleCallback` 后加载 + IntersectionObserver 离屏暂停 + 完整 dispose（StrictMode 双挂载安全）；
- 取景按包围球横纵双向适配，容器再窄也不裁切。

---

## 5. 复用指南（哪些可以直接搬走）

> 原则：越靠下越独立。core 不依赖 React，metrics 不依赖 core，evaAvatar 依赖为零。

| 想复用什么 | 搬什么 | 要带什么依赖 | 去哪都能用吗 |
|---|---|---|---|
| **座舱内核整体**（仿真+规则+场景） | `src/core/` 四件套 | 无（零 DOM） | ✅ 任何框架/Node。入口 `createCockpit()`，你的框架自己写订阅 |
| **DMS 指标算法**（EAR/PERCLOS/头姿/视线） | `src/vision/metrics.ts` | 无 | ✅ 纯函数，甚至能跑在小程序/后端 |
| **MediaPipe 容灾引擎** | `src/vision/dms.ts` | `@mediapipe/tasks-vision`（动态 import）+ metrics | ✅ 产 VisionSample 回调，UI 无关 |
| **模拟信号源**（无摄像头演示） | `src/vision/simVision.ts` | metrics + 一个 `getState()` | ✅ 任何"需要假传感器"的场景 |
| **3D 模型展示位**（任意 GLB 产品展示） | `carScene.ts + CarModel.tsx` | three；改 `modelUrl` 即换模型 | ✅ 材质覆盖逻辑可替换为任意品牌展台 |
| **EVA 加载/离线状态** | `shared/EvaLoadingAvatar.tsx` | React + CSS | ✅ 首页、进舱与座舱统一复用 |
| **双通道状态分发模式** | `useCockpit.ts` 的写法 | React | 模式可移植：interval+快照给框架、活引用给 Canvas |
| **多源容灾模式** | `firstOk()` 三行 | 无 | ✅ 一切外部资源 |
| **剧本式自动演示模式** | `autoDemo.ts` 写法 | 无 | ✅ 步骤表 + 定时器 + 可停不停现场 |
| **数字人几何/情绪** | `evaAvatar.ts + evaFace.ts` | evaFace 依赖前两者 | ✅ 纯函数；四态调色/眼形可直接换皮 |

**复用内核的最小示例**（在任意 JS 环境里）：
```ts
import { createCockpit } from './core';
const ck = createCockpit();
ck.actions.scenario('fatigue');
ck.actions.setVision({ present: true, perclos: 0.4, /* … */ });  // 喂视觉
setInterval(() => { ck.step(0.2); console.log(ck.snapshot().evaMode); }, 100);
```

---

## 6. 二次开发 Cookbook（照着改就行）

**加一个场景**：`params.ts SCENARIOS` 加元数据 → `types.ts ScenarioId` 自动推导 → `evaRules.applyScenario` 加脚本分支（用 `at(delay, fn)` 排播报）→ （可选）`autoDemo.ts` 加剧本步 → 跑测试。

**加一条自然语言指令**：`evaRules.handleCommand` 里照抄 `has('关键词') → adjust() + say()` 模式；记得 `s.stats` 计数。

**调阈值**：只改 `params.ts` → `npm test` → 同步 `docs/PIPELINE.md` 参数表 → 手过三场景。测试会替你守住 60/85 双阈值等行为。

**加视觉指标**（如哈欠/注视屏占比）：`metrics.ts` 加纯函数 + 单测 → `dms.ts` 采样循环里调用并塞进 `VisionSample`（`types.ts` 加字段）→ `evaRules` 消费 → `DmsPanel` 展示。模拟通道 `simVision.ts` 记得同步合成该信号。

**增加座舱可见证据**：主舞台保持克制；一眼可读的值放 `SystemsRail`，详细控制与历史放进 `EvidenceDrawer` 的感知/推理/执行页。props 只接 `snap`/`act`，不直连内核内部。

**换 3D 车模型**：新 GLB 放 `public/models/` → `carScene.ts` 改 `modelUrl`；大文件先 `npx @gltf-transform/cli quantize in.glb t.glb && npx @gltf-transform/cli meshopt t.glb out.glb` 压缩（24MB→5MB 实测）；第三方模型必须按 CC-BY 流程在 `AI_USAGE.md` + 页脚署名。

**加外部资源**：先想清楚失败怎么办（参照 §4.4 容灾表），自托管优先，CDN 只做后备源。

---

## 7. 已知坑（前人踩过，别再踩）

1. **PERCLOS 冷启动**：30s 滑窗要半分钟才稳——演示前先开视觉；剧本用模拟信号则无此问题；
2. **快照是 structuredClone 全量深拷贝**：状态必须 JSON 安全（勿放 Map/Set/函数/循环引用）；
3. **勿绕过播放状态**：ready/paused/completed 必须冻结内核；Three.js 镜头稳定后保持事件驱动，不恢复永久 rAF；
4. **MediaPipe GPU delegate** 在部分驱动上初始化失败——已有 CPU 回退，勿删；
5. **chat/alerts 有上限截断**（200/100）：防长演示内存增长，新数组类状态照此办理；
6. **3D 车相关**：three 必须动态 import（主包体积）；dispose 要含 `forceContextLoss`（StrictMode 双挂载）；取景要横纵双向适配（窄容器横向裁切的坑）；GLB 大 file 先 meshopt 压缩；
7. **Windows 下 CRLF 警告无害**，勿改 .gitattributes 引发全库 diff；
8. **多个 dev server 并存**：端口被占 Vite 自动 +1，注意浏览器里开的到底是哪个端口（页面标题一样）。

---

## 8. 想法碰撞（下一步往哪走）

**产品向**
- 多乘员感知：副驾/后舱摄像头位姿 → 分区氛围与儿童遗留提醒（MediaPipe 换 PoseLandmarker 即可，管线不变）；
- 情绪→音乐的个性化闭环：把 `emotion` 与音乐选择的映射做成可学习（localStorage 记偏好）；
- 休息模式深化：服务区 POI 真数据（高德/百度开放 API）+ 20 分钟小睡倒计时唤醒；
- 「守夜人模式」：长途夜间自动压缩非安全播报，只保留安全语义（话术分级已有 kind 基础）。

**技术向**
- 把 `handleCommand` 的关键词匹配升级为本地 LLM 意图识别（WebGPU + 小模型），规则引擎结构不变；
- DMS 帧率自适应：手机降采样率/关键点抽稀（`onLandmarks` 已按 7 抽 1 画点，推理侧同理）；
- 用 `evaAvatar.ts` 的半身像几何做一个真 3D 数字人替换 SVG EvaFace（几何已经 ready，缺渲染层）；
- WebRTC 双端演示：评委手机开摄像头，大屏看座舱反应（VisionSample 走 WebSocket 即可，内核零改动）。

**演示/路演向**
- BootSplash 开机自检已有——可加一段「摄像头标定」仪式感动画，暗示视觉是真实在跑；
- 录制 60s 官方演示视频：自动演示 + DemoBanner 讲解词现成，直接照着念；
- 数据条（4/0/1/63）与 CHANGELOG 是迭代证据链，答辩时主动展示。

---

## 9. 命令速查与文档地图

```bash
npm install      # postinstall 自动拷贝 MediaPipe WASM 到 public/（离线可用）
npm run dev      # 开发（默认 5173，被占自动顺延——注意看端口！）
npm test         # 63 项回归（core 25 + vision 13 + shell/交互 25），必须全绿
npm run build    # tsc --noEmit + vite build
```

| 文档 | 管什么 |
|---|---|
| `README.md` | 对外门面：定位/功能/快速开始/评分点映射 |
| `AGENTS.md` | AI 协作约定：目录/验证流程/架构铁律/已知坑 |
| `docs/PIPELINE.md` | 参数表（与 params.ts 同步）/数据流/演示剧本 |
| `docs/功能说明.md` | 团队功能手册（F11/F12 等快捷键与功能细节） |
| `AI_USAGE.md` | AI 使用透明声明 + 第三方资产署名（含 3D 车 CC-BY） |
| `CHANGELOG.md` | 版本迭代记录（提交历史的可读版） |
| **本文** | 架构深读 + 复用指南 + 二开 cookbook + 想法池 |

> 维护约定：改架构级内容（§2-§4）须同步本文；加新坑进 §7；新想法随手丢 §8，不要求成熟。
