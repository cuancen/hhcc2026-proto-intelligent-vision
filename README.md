# Eva · 智能座舱 —— 机器视觉守护的 L2 辅助驾驶舱内智能体

> **[English version](README_EN.md)** | 吉利黑客松 · 原型开发赛道（Prototype Development Track，官方开发期内从零搭建）
> 创新主线：**机器视觉赛道 × 智能座舱** —— EVA 不只检测疲劳，还把驾驶员视线、车内物品语义记忆与行车工况关联起来，在数字孪生中解释原因、执行行动并确认结果。

## 定位声明（重要）

本产品定位为 **L2 组合辅助驾驶**（驾驶员监测 + 自适应巡航 + 车道居中辅助）：
系统在车道内辅助转向与加减速，**驾驶员始终是驾驶责任的主体**，需保持对路况的监管并随时准备接管。
全项目（界面、话术、文档）不使用 L3/L4 自动驾驶表述；Eva 的所有干预均以"提醒、建议、座舱调节、辅助降级"为边界。

## 功能总览

| 模块 | 内容 |
|---|---|
| 机器视觉 DMS | 摄像头 → MediaPipe 面部关键点（478 点，浏览器本地 WASM/GPU 推理，零上传）→ EAR / PERCLOS / 头姿 / 驾驶员在位 / blendshapes 情绪六态 |
| 双通道疲劳融合 | 工况累积疲劳（车速/路况/时长）与视觉 PERCLOS 取强融合，60 温柔关怀 / 85 紧急干预 + 休息选择分支 |
| 分神守护 | 视线离开 ≥2s 预警、≥4s 紧急告警并 L2 降级（缩速、拉大时距），回正自动恢复 |
| Eva 拟人智能体 | 表情/模式联动、对话流、情境快捷回复、自然语言指令（冷热/音乐/按摩/导航/休息/辅助开关） |
| 复杂路况协同 | 雨+夜+拥堵因子 ≥2 → 屏蔽娱乐、谨慎模式；缓解后自动恢复 |
| 数字孪生主舞台 | Three.js 整车模型 + 车身透视 + 程序化座舱/EVA/视线/热点/灯光；WebGL 失败自动回退二维整车示意 |
| 四类体验 | 60 秒情境闭环（看见—理解—行动—确认）+ 日常通勤 / 疲劳守护 / 复杂路况三个手动场景 |

## 快速开始

```bash
npm install     # postinstall 自动将 MediaPipe WASM 拷贝到 public/（自托管，离线可用）
npm run dev     # http://localhost:5173
npm test        # 63 项内核/视觉/情绪/时间轴/几何回归
npm run build   # 类型检查 + 生产构建
```

**演示建议**：所有用户可见界面为英文。首页点 `Watch the 60s Loop` 会在数字孪生就绪后自动开演；直接访问 `#/cockpit` 则停在 `Start Experience`。底部可 `Pause / Continue / Replay Loop` 和切场景，空格也可控制播放。
真实机器视觉、模拟信号、完整 DMS 数值、推理事件与 L2 责任声明均收进右上角 `Evidence` 抽屉。

## 技术架构

```
src/
├── core/      内核（零 DOM，可独立测试/迁移）
│   ├── sim.ts        仿真动力学：速度/疲劳/情绪/路况
│   ├── evaRules.ts   Eva 规则引擎：冷却闸门 + 场景脚本队列 + 用户分支
│   ├── adas.ts→并入 sim/eva  L2 策略：降级/恢复/监管提醒
│   └── params.ts     参数唯一出处（阈值/速率/冷却）
├── vision/    机器视觉
│   ├── metrics.ts    纯函数：EAR/头姿解算/PERCLOS 窗口/视线离开追踪
│   ├── dms.ts        MediaPipe 引擎：多源容灾（本地 WASM→jsDelivr→unpkg；GPU→CPU）
│   └── simVision.ts  模拟信号回退（与真实管线共用 metrics）
└── shell/     电影化 UI 外壳（React 18 + TS）
    ├── twin/   Three.js 整车数字孪生、剧情镜头、纯函数帧派生与二维降级
    ├── hooks/  useCockpit（可冻结仿真）/ useDms / useUiPrefs
    └── components/ 顶栏、单句叙事、四阶段轨道、电影控制、技术证据抽屉
```

稳定性设计：100ms 时钟只在 `running` 时推进，ready / paused / completed 冻结仿真；视觉模型自托管于 `public/`，摄像头失败降级模拟信号，WebGL/车型失败降级二维安全舞台。参数表与验证流程见 `docs/PIPELINE.md` 与 `AGENTS.md`。

## 评分点映射

| 评审维度 | 本项目对应 |
|---|---|
| 出色的交互与用户体验 | 全屏整车数字孪生 + 10 镜头 60s 剧本 + 可暂停/继续/重播 + 技术证据抽屉 |
| 强大的可访问性 | 字号缩放（4 档持久化）/ 高对比模式 / 键盘全操作 / aria-live 分级播报 / prefers-reduced-motion / 跳转链 |
| 高度稳定的内核功能 | 零 DOM 内核 + 63 项回归测试 + 可暂停单时间轴 + 视觉多源容灾 + WebGL/摄像头双降级 |
| 适应多种场景 | 主闭环 + 三个保留场景 × 摄像头/模拟双视觉源 × 3D/2D 双舞台 × 响应式布局 |
| 迭代证据 | 全部功能在官方开发期内提交，提交历史即迭代记录（见 CHANGELOG.md） |

## 目录

```
├── public/models/face_landmarker.task   自托管视觉模型（3.7MB）
├── scripts/copy-wasm.mjs                WASM 自托管拷贝（postinstall）
├── src/{core,vision,shell}              见上文架构
├── tests/                               内核 + 视觉指标回归
└── docs/PIPELINE.md                     参数表 / 数据流 / 演示剧本
```

## 声明

- 演示中的车速、疲劳速率、温度等为**仿真假设值**（集中定义于 `src/core/params.ts`），非量产标定；
- MediaPipe Face Landmarker 模型与运行时遵循 Apache-2.0，自托管分发；
- 摄像头画面仅在本设备浏览器内推理，不采集、不上传任何影像。
