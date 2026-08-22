# 更新日志

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/)，提交历史即官方开发期内的迭代证据。

## 1.0.0 —— EVA 角色 × 后追行驶舞台 × Evidence 工作台

- `feat(eva)` 使用团队提供的紫蓝 EVA 素材派生透明无眼壳层，统一品牌、播报、加载与离线反馈；SVG 动态叠加 calm/listening/thinking/caring/cautious/urgent/confirming 七态眼神，紧急安全语义优先于剧情与实时 DMS 情绪
- `feat(twin)` 主舞台移除左右数据栏和底部三幕注释；道路、车道线、城市体块、光门和模拟前车统一锚定到车辆舞台坐标系，并按车型几何纵轴校准。通勤使用正后追，疲劳切入透明舱内 DMS，复杂路况使用低位雨夜后追；轮胎按模型最低点留出路面间隙，不制作轮动特效
- `feat(evidence)` Evidence 由三标签抽屉升级为 72vw 三列工作台，同屏展示 Perception → Reasoning → Execution 与真实 DMS / 模拟驾驶环境边界；打开自动暂停，关闭仅恢复原本正在播放的体验，保留 Esc、遮罩关闭与焦点恢复
- `refactor(3d)` 隐藏原方盒 EVA，Three.js 继续采用事件驱动渲染；道路主体与车辆共用 Three.js 相机和消失点，轻量 CSS 仅承担景深流光与雨线
- `chore(security)` Vite/Vitest 工具链升级并清零依赖审计告警；回归增至 68 项（core 25 + vision 13 + shell/交互 30）

## 0.9.0 —— 单一整车数字孪生主舞台（远端最新基线融合）

- `feat(twin)` 驾驶舱改为全屏整车数字孪生：复用 `geely.glb`，程序化重建座椅、驾驶员、EVA、视线、物品热点与阅读灯；10 个稳定 `DemoCue` 驱动电影镜头与橙/青语义反馈，WebGL/模型失败完整回退二维整车舞台
- `feat(ui)` 不切双视图：原项目 EVA/驾驶员与 DMS/L2/座舱能力压缩为左右边缘 HUD，详细感知/推理/执行证据集中到键盘可操作抽屉；桌面单视口、移动端底部抽屉，所有用户可见文案统一英文
- `feat(runtime)` 1.2 秒非阻塞入场遮罩 + 可暂停单时间轴；ready/paused/completed 冻结仿真与路线，模型解码长阻塞不会跳过剧情步骤；首页 CTA 舞台就绪后自动开演
- `fix(3d)` 外部广角隐藏程序化座舱，消除透明排序导致的“座椅/EVA 穿出车身”；修复 Landing 单材质网格被误转成材质数组而不渲染的问题，并校准石墨金属材质与自动取景
- `test` 回归增至 63 项（core 25 + vision 13 + shell/交互 25）；浏览器覆盖 1426×1114、1440×1000、390×844、减弱动态、WebGL 降级、英文文案、控制台/页面错误与完整 60 秒闭环

## 0.8.0 —— 视觉情绪检测 × Eva 主动情绪关怀（6 态 · 零新增模型）

- `feat(vision)` 情绪检测：复用 face_landmarker 的 blendshapes 输出（`outputFaceBlendshapes`），加权启发式纯函数 `classifyEmotion` 分 6 态（neutral/happy/sad/angry/surprised/drowsy，微笑抑制 angry 防误报）+ 10 帧多数投票平滑——零新增模型、零额外加载，离线可用；模拟信号按工况合成情绪（拥堵→angry / 高疲劳→drowsy / 情绪值高→happy / 低→sad），与真实模型走同一套指标管线
- `feat(core)` Eva 主动情绪关怀：非 neutral 情绪稳定 ≥0.3 仿真分钟即主动开口——悲伤开导（暖氛围灯+轻音乐联动）/ 开心询问好事 / 堵车愤怒安抚（深呼吸建议 + L2 跟车兜底 + 切舒缓音乐）/ 困倦休息建议 / 惊讶轻确认；同一情绪只关怀一次 + 话题冷却 5 分钟防唠叨（`visionEmotion` 参数，reset 同步复位）
- `feat(ui)` DMS 面板新增 Emotion (6-class) 指标格（emoji + 标签横跨两列，sad/drowsy/surprised 琥珀警示、angry 红色告警）
- `test` 情绪分类（微笑/皱眉/抑制项/低强度回落）+ 平滑器多数投票 + 关怀规则（sad 联动/拥堵安抚/防唠叨/稳定期）共 8 项新增，合计 51 项全绿；浏览器实测：复杂路况拥堵时 sim 合成 angry → Eva 主动安抚话术 + 音乐自动切舒缓

## 0.7.0 —— 全站界面文案英文化（国际展示 / 开源就绪）

- `feat(i18n)` 全站 UI 文案切换为英文：内核播报/告警/休息选择分支（evaRules）、场景标签与描述、16 个座舱面板、Landing 首页、开机自检清单、自动演示讲解词、全部 aria/title、index.html（lang/title/description）
- `feat(i18n)` 类型值级变更并全链路同步：EvaMode（Observing/Guarding/Intervening/Resting/Cautious）、MusicKind（Soft/Upbeat/News/Off）、氛围灯（Teal/Warm Amber）；指令解析改英文关键词（sleepy/hot/cold/music/massage/nav/rest/l2 on/off），演示剧本内指令同步；TTS 切 en-US 并自动选英文语音包
- `test` 40 处绑定中文文案的断言同步更新，43 项全绿；代码注释与团队文档保留中文（工作语言不变）

## 0.6.0 —— Hero 真 3D 车模型（three.js · CC-BY 署名 · 容灾回退）

- `feat(landing)` Hero 主视觉升级为真 3D 整车：Sketchfab「geelyblackglb」（作者 crivero，CC-BY，社区自制非吉利官方资产）经 gltf-transform meshopt 几何压缩 24MB→5MB 后自托管于 `public/models/`；three.js 渲染（RoomEnvironment 环境反射 + 暖白主光/品牌橙轮廓光 + Canvas 径向渐变贴地软阴影），运行时把车身材质覆盖为白漆、玻璃与车灯发光件保留原材质；约 28 秒自转 + 正弦悬浮 + 入场缓动，纵横双向自动取景（窄高容器不裁切）
- `feat(landing)` 容灾铁律落地：three 与场景代码动态 import 独立 chunk（gzip ~164KB，不进主包），requestIdleCallback 后再加载；GLB 下载/解析/WebGL 任何一步失败 → 手写 Canvas 线框座舱常驻兜底，首帧由线框垫底、就绪后交叉淡入；prefers-reduced-motion 渲染静帧；IntersectionObserver 离屏暂停渲染
- `feat(ui)` 补齐 Eva 数字人头像 SVG 组件 EvaFace（四态眼形/嘴型/说话开合，样式挂 theme.css）与半身像线框几何 `evaAvatar.ts`（纯函数，2 项回归）
- `docs` AI_USAGE.md 增补 3D-Asset Note：CC-BY 完整署名（作者/来源链接/协议/社区模型声明/白漆运行时修改说明），页脚同步展示署名；three.js 补入依赖许可清单
- `test` 数字人几何与情绪调色板回归，合计 43 项

## 0.5.0 —— 品牌首页 Landing（红橙设计语言 · 从零手写）

- `feat(landing)` 品牌首页：极深炭黑 + 暗红→橙红径向光晕设计语言，极简导航（Features/Demo/Run/About + Dashboard 跳转）、渐变大标题 Hero、三特性卡片、三幕演示入口、数据条、About 与页脚（`src/landing/`，纯 CSS 零新依赖）
- `feat(landing)` Hero 主视觉：手写 Canvas 伪 3D 线框座舱——侧视轮廓 × 车宽拉伸 + 轮环 + 驾驶员检测框（呼吸脉冲 + DRIVER·TRACKED 标签）+ 舱内摄像头视线 + 感知扫描环；约 28 秒自转 + 正弦悬浮 + 入场缓动，深度按品牌渐变着色（透视投影纯函数 `projection.ts`，4 项回归）
- `feat(app)` hash 路由（零路由库）：默认品牌首页，`#/cockpit` 进座舱；Landing「Run Live Demo」经 sessionStorage 接力，开机动画结束后自动开演；顶栏 Logo 可返回首页
- `docs` AI_USAGE.md：设计灵感声明（参考 Garuda 视觉风格、代码与资源零复制）+ 依赖许可 + AI 使用透明声明
- `test` 投影纯函数回归（旋转/透视/品牌渐变/线框结构），合计 41 项

## 0.4.0 —— 交互质感升级（表情 / 动效 / 语音 / 氛围）

- `feat(ui)` Eva 表情系统：四态 SVG 表情（常态圆瞳眨眼 / 关怀弯月 / 警告睁大 / 紧急红瞳微震）+ 嘴型联动（微笑 / 平直 / O 型）+ 说话开合动画；情绪由 evaMode × 最新消息语气推导，只升不降（安全优先），紧急干预待选择期间锁定 urgent（纯函数 `evaFace.ts`，3 项回归）
- `feat(ui)` 对话流动效：消息入场滑入、最新 Eva 消息「正在输入… → 打字机逐字」编排（prefers-reduced-motion 直达全文、读屏一次拿全文）、干预分支弹入动效、告警条目滑入
- `feat(ui)` Eva 语音播报：本地 speechSynthesis（zh-CN）朗读关怀/预警/紧急消息，最新优先不排队；顶栏静音开关（localStorage 持久化）；**无语音包环境（嵌入式/无头浏览器）自动跳过，防止渲染进程挂死**——录制管线友好
- `feat(ui)` 全局告警氛围：根节点 data-ambient 三档（青碧/琥珀/红）驱动面板指示灯、面板描边与场景视图发光；紧急干预全程红色 inset 光脉冲（纯容器样式实现，不叠加全屏覆盖层，零交互拦截风险）（纯函数 `ambient.ts`，4 项回归）
- `feat(ui)` 座舱数值变化 2 秒闪烁高亮：Eva 调节「看得见」
- `fix(core)` 紧急干预等待选择期间不再重复触发关怀播报（唠叨淹没决策时刻）；指令「休息」进入休息模式时清除滞留的紧急选择框
- `test` 表情情绪推导 + 氛围分级纯函数回归，合计 37 项

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

## 0.3.0 —— 品牌与开场体验（08-22 凌晨追加）

- `feat(boot)` 座舱开机自检动画：Eva 亮灯 + 五子系统逐项点亮 + 进度条，点击可跳过，纯 CSS 零依赖（自检清单含回归测试，合计 29 项）
- 参考模式：HackHarvard 获奖项目"前 10 秒视觉锚点"；实现全部现场从零编写

### 已知边界（后续迭代方向）

- PERCLOS 窗口 30s，冷启动需半分钟才稳定展示（可考虑开机预热）
- 指令解析为关键词表，非 NLU；下一步接 LLM 对话
- 视线离开仅用头部姿态代理，未做虹膜视线方向估计
- 移动端布局为单列堆叠，尚未针对竖屏仪表形态深度优化
