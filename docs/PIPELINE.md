# PIPELINE —— 参数表 / 数据流 / 演示剧本

> 参数唯一出处为 `src/core/params.ts` 与 `src/vision/metrics.ts`。修改任何阈值必须：
> ① `npm test` 回归全绿 ② 同步本表 ③ 手动过一遍三场景确认节奏。

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
| visionEmotion | stableMin 0.3 / chatCd 5 分钟 | 视觉情绪稳定判定与主动关怀冷却 |
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
| 情绪分类 | blendshapes 加权启发式（EMOTION_TH 0.25）+ 10 帧多数投票平滑 | 6 态 neutral/happy/sad/angry/surprised/drowsy；复用同一 face_landmarker 模型，零额外开销 |

## 三、数据流

```
摄像头 ──MediaPipe(本地WASM/GPU)──▶ 478 关键点 + 4×4 变换矩阵
                                      │ metrics.ts 纯函数
                                      ▼
                     VisionSample{present,perclos,blinkPm,lookAwaySec,yaw,pitch,ear,emotion}
                                      │ act.setVision() ──(模拟信号走同一管线)──▶
                                      ▼
   工况仿真(sim.ts) ──▶ CockpitState ◀─ 融合: fatigue = max(simFatigue, 185×perclos, lookAway×6)
                                      │ evaRules.ts（冷却闸门 + 场景脚本队列 + 用户分支）
                                      ▼
                     座舱调节 / 分级告警 / L2 降级恢复 / 对话播报 ──▶ shell 面板 + aria-live
```

采样节流：真实模型每帧推理、≥100ms 向内核发样；模拟信号 10Hz。内核 tick：`setInterval(100ms, dt=0.2×速率 仿真分钟)`（后台标签页不冻结）。

## 四、自动演示剧本（src/shell/autoDemo.ts，速率 ×2）

| 实秒 | 动作 | 预期 |
|---|---|---|
| 0.5 | 场景一 日常通勤 | 问候→识别→习惯座舱→路线规划（3 条主动服务） |
| 9 | 场景二 疲劳守护（自动开 L2） | 长途高速 + 视觉监测播报 |
| 13 | 注入疲劳 62 | 温柔关怀：通风/降温/轻音乐 |
| 19 | 注入疲劳 88 | 紧急干预 + 休息选择分支 |
| 23 | 选择「立即休息」 | 休息模式（按摩/暖光/音乐关） |
| 30 | 场景三 复杂路况 | 雨→拥堵→夜→前车急刹；娱乐屏蔽、谨慎模式 |
| 46 | 回归日常通勤 | 路况缓解恢复播报 |
| 52 | 指令「导航还有多久」 | 语音链路演示 |
| 58 | 演示结束，速率回 ×1 | — |

## 五、验证流程（每次改动必做）

```bash
npm test          # 51 项：内核 20 + 视觉指标 12 + 座舱/几何 19
npm run build     # tsc --noEmit + vite build
npm run dev       # 手动：三场景 + 自动演示 + 摄像头/模拟切换 + 键盘 1/2/3/D/L
```
