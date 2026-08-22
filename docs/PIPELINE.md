# PIPELINE —— 参数表 / 数据流 / 演示剧本

> 参数唯一出处为 `src/core/params.ts` 与 `src/vision/metrics.ts`。修改任何阈值必须：
> ① `npm test` 回归全绿 ② 同步本表 ③ 手动过一遍 EVA Vision Loop 主闭环与三个保留场景确认节奏。

## 一、内核参数表（src/core/params.ts）

| 参数 | 值 | 说明 |
|---|---|---|
| roadSpeed | 城市 55 / 高速 105 / 拥堵 24 km/h | 道路基准速度 |
| speedTrim | 雨 0.85 / 夜 0.92 / 弯道 0.94 / L2 降级 0.85 / 低情绪 0.96 | 目标速度修正（连乘） |
| fatigueRate | 基础 0.08 / 拥堵 0.22 / 高速(>85) 0.42 每仿真分钟 | 工况疲劳累积 |
| fatigueScenarioMult | 1.6 | 疲劳场景加速倍率 |
| restDecay | 2.6 / 分钟 | 休息模式恢复速率 |
| fatigueTh | care 60 / urgent 85 | 疲劳双阈值 |
| reEscalateAfter | 6 分钟 | 拒绝休息后的再升级间隔 |
| perclosTh | warn 0.25 / high 0.35 | 视觉闭眼占比分级 |
| perclosFatigueK | 185 | PERCLOS→疲劳度折算（0.35→65 越过 care） |
| lookAwayTh | warn 2s / esc 4s | 视线离开分级；≥4s 触发 L2 降级 |
| lookAwayFatigueCap | 40 | 视线离开折算疲劳上限 |
| complexityBlock | 2 | 雨+夜+拥堵 因子 ≥2 屏蔽娱乐 |
| emotionTh | low 32 / high 68 | 情绪四联动阈值 |
| cd | care 8 / urgent 15 / emotion 10 / look 1.5 / complex 6 / l2Remind 5 分钟 | 规则冷却 |
| speedTau | 0.9 分钟 | 速度一阶惯性时间常数 |

## 二、视觉指标参数（src/vision/metrics.ts）

| 参数 | 值 | 说明 |
|---|---|---|
| EAR_CLOSED | 0.15 | EAR 低于该值判为闭眼帧（典型睁眼 0.25–0.40） |
| PERCLOS 窗口 | 30s 滑动 | 闭眼帧占比；blinkPm 按 60s 窗口外推 |
| LOOK_TH | yaw 22° / pitch 18° | 头部姿态超阈记为视线离开 |
| EAR 六点索引 | 右[33,160,158,133,153,144] 左[362,385,387,263,373,380] | MediaPipe 478 点网格 |

## 三、数据流

```
摄像头 ──MediaPipe(本地WASM/GPU)──▶ 478 关键点 + 4×4 变换矩阵
                                      │ metrics.ts 纯函数
                                      ▼
                     VisionSample{present,perclos,blinkPm,lookAwaySec,yaw,pitch,ear}
                                      │ act.setVision() ──(模拟信号走同一管线)──▶
                                      ▼
模拟物品视觉事件 ──▶ CabinObjectObservation{物品,位置,重要度,置信度}
（显著标注 simulated-event；不保存原始画面） │ act.observeCabinObject()
                                      ▼
   工况仿真(sim.ts) ──▶ CockpitState.context.memory ◀─ VisionSample + 物品语义事件
                                      │ evaRules.ts（原因关联 + 冷却闸门 + 安全边界）
                                      ▼
             告知位置 / 阅读灯联动 / 分级告警 / L2 降级恢复 / 对话播报
                                      │ DMS 视线回正
                                      ▼
                     视觉确认风险解除 ──▶ 情境时间轨 + shell 面板 + aria-live
```

采样节流：真实模型每帧推理、≥100ms 向内核发样；模拟信号 10Hz。内核 tick：`setInterval(100ms, dt=0.2×速率 仿真分钟)`（后台标签页不冻结）。

## 四、自动演示剧本（src/shell/autoDemo.ts，速率 ×1）

| 实秒 | 动作 | 预期 |
|---|---|---|
| 0.5 | 进入 EVA Vision Loop | 解释真实 DMS / 模拟物品事件边界，L2 保持驾驶员监管 |
| 4 | 注入停车卡、电脑包、水杯语义事件 | 情境记忆显示物品、位置、重要度与置信度 |
| 9 | 手机位置更新为无线充电板 | 只记录语义事件，不长期录像 |
| 16 | 模拟驾驶员开始寻找停车卡 | 模拟视觉源确定性生成向左下方视线偏离 |
| 19 | DMS 捕捉持续视线偏离 | 先感知风险，不把“分心”当作最终答案 |
| 22 | 情境内核关联寻找原因 | 视线方向 + 停车卡位置 → “正在找停车卡” |
| 25 | 精准行动 | 告知左侧车门储物格并打开主驾左侧阅读灯 |
| 30 | DMS 确认视线回正 | 关闭阅读灯，记录“确认”事件；若超过 4s 仍走 L2 降级 |
| 46 | 离车检查 | 只提醒电脑包与手机，普通水杯和停车卡保持静默 |
| 57 | 闭环总结 | 看见 → 理解 → 行动 → 确认 |

## 五、验证流程（每次改动必做）

```bash
npm test          # 48 项：内核 21 + 视觉指标 9 + shell/交互 18
npm run build     # tsc --noEmit + vite build
npm run dev       # 主闭环 + 三个手动场景 + 摄像头/模拟切换 + 键盘 1/2/3/4/D/L
```
