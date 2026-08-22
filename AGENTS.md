# AGENTS.md — Eva 智能座舱（AI 协作约定）

机器视觉 DMS × L2 辅助驾驶舱内智能体。Vite + React 18 + TS；内核零 DOM。**定位铁律：全项目只做 L2 辅助驾驶表述，不出现 L3/L4 自动驾驶。**

## 目录

```
src/core/     内核：sim 仿真 / evaRules 规则引擎 / params 参数唯一出处（零 DOM）
src/vision/   机器视觉：metrics 纯函数 / dms MediaPipe 引擎 / simVision 模拟回退
src/shell/    UI：电影控制、证据抽屉、可暂停时间轴；twin/ 为 Three.js 整车数字孪生与二维回退
src/landing/  品牌首页：three.js 3D 车 Hero（CC-BY，署名见 AI_USAGE.md）+ Canvas 线框回退；独立于座舱业务
tests/        vitest：core 25 项 + vision 13 项 + shell/交互 25 项（共 63 项）
public/       自托管模型 models/face_landmarker.task + models/geely.glb（meshopt 压缩）；mediapipe-wasm/ 由 postinstall 生成（不入库）
docs/PIPELINE.md  参数表/数据流/演示剧本（改参数必须同步）
```

## 验证流程（每次改动必做）

```bash
npm test        # 63 项回归必须全绿
npm run build   # tsc --noEmit + vite build
```

改 `src/core/params.ts` 任何阈值：① 跑测试 ② 同步 `docs/PIPELINE.md` 参数表 ③ 手动过三场景（自动演示 60s）。

## 架构铁律

1. **CORE 零 DOM**：`src/core/` 不 import DOM/React；UI 只经 `useCockpit()` 的快照与 `act.*` 与内核交互。
2. **时间体系**：仿真 `setInterval(100ms)`，仅在 `running` 时推进；暂停/准备/完成必须冻结。三维渲染按剧情事件唤醒，勿改回永久 rAF。
3. **视觉与内核解耦**：视觉模块只产出 `VisionSample` 写入 `act.setVision()`；模拟信号与真实模型共用 `metrics.ts` 同一套纯函数管线。
4. **容灾优先**：新增外部资源必须"失败零影响"——模型自托管 + 多源回退 + 模拟信号兜底；摄像头拒绝自动降级不报错。
5. **参数纪律**：阈值只加在 `params.ts`，不散落硬编码。

## 已踩过的坑

- PERCLOS 窗口冷启动半分钟才稳定（演示前先开视觉）；
- `structuredClone` 快照每 100ms 全量拷贝——状态保持 JSON 安全（勿放 Map/Set/函数）；
- MediaPipe GPU delegate 在部分驱动上初始化失败——已做 CPU 回退，勿删；
- chat/alert 数组有上限截断（200/100），防止长演示内存增长；
- Windows 下 CRLF 警告无害，勿改 .gitattributes 引发全库 diff。

## 话术规范

- Eva 消息 kind：`care`（绿）/ `warn`（黄）/ `urg`（红）/ `sys`（蓝）；
- L2 相关播报必须包含"监管/接管"责任表述（英文文案对应 supervising / take over）；
- All user-facing UI copy is English; command parsing remains English-first, and the English README/project guide stays current;
- 代码注释、团队文档与协作沟通保持中文（工作语言）。
