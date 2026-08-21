# 更新日志

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/)，提交历史即官方开发期内的迭代证据。

## 0.1.0 —— 官方开发期首次可演示版本

- `chore` 初始化工程脚手架 Vite + React + TypeScript（原型赛道从零搭建）
- `feat(core)` 座舱内核：仿真动力学 + Eva 规则引擎 + L2 ADAS 策略（零 DOM，24 项回归中的 16 项内核测试）
  - 疲劳双阈值（60/85）+ 拒绝休息 6 分钟再升级分支
  - 视线离开 2s/4s 分级 → L2 降级与自动恢复
  - 复杂路况因子 ≥2 屏蔽娱乐；情绪四联动；自然语言指令
- `feat(ui)` 座舱外壳：三栏布局 / 设计系统 / Canvas 伪三维态势视图 / 对话流 / 分级告警 / L2 面板
- `feat(vision)` 机器视觉 DMS：MediaPipe 面部关键点本地推理，EAR/PERCLOS/头部姿态指标纯函数（8 项测试），模型自托管 + WASM 三源容灾 + 模拟信号回退
- `feat(demo)` 60 秒自动演示剧本 + 感知→Eva→控制数据流动画 + 键盘快捷键（1/2/3/D/L）
- `feat(a11y)` 字号缩放 / 高对比 / 跳转链 / aria-live 分级播报 / prefers-reduced-motion
- `docs` README / PIPELINE 参数表 / AGENTS 协作约定，L2 辅助驾驶定位全面落地

## 0.2.0 —— 路演讲解能力（08-22 凌晨追加）

- `feat(demo)` 演示剧本结构化：每步带 `{title, note}` 评委讲解文案，覆盖三场景 + 休息分支（新增 3 项剧本回归测试，合计 28 项）
- `feat(demo)` 路演讲解横幅 DemoBanner：自动演示时悬浮展示「第几步 / 正在看什么 / 想表达什么」+ 进度点 + 随手停止，替换底部旧状态 chip
- `docs` 比赛规则 skill（作弊红线/评分导向/commit 纪律/录制规范）；团队功能说明手册
- 工程外配套：功能演示 MP4 自动录制管线（feature-recordings/，不入库）

### 已知边界（后续迭代方向）

- PERCLOS 窗口 30s，冷启动需半分钟才稳定展示（可考虑开机预热）
- 指令解析为关键词表，非 NLU；下一步接 LLM 对话
- 视线离开仅用头部姿态代理，未做虹膜视线方向估计
- 移动端布局为单列堆叠，尚未针对竖屏仪表形态深度优化
