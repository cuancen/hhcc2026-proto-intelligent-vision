# Geely 3D 模型（geelyblackglb）整合说明

> 更新日期：2026-08-22 · 当前项目工作区
> 模型来源：https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56

---

## 一、结论（TL;DR）

| 问题 | 答案 |
|---|---|
| 模型能不能用？ | **能**。CC-BY 协议允许修改与商用，条件是完整署名（已落实） |
| 模型会不会太大？ | 原始 24MB 确实太大，已压缩到 **5.03MB**（约 5 倍），浏览器加载无压力 |
| 用在哪里？ | 首页 Landing Hero 与 `#/cockpit` 全屏整车数字孪生主舞台 |
| 是吉利官方模型吗？ | **不是**，社区爱好者自制（fan model），对外话术不得声称官方提供 |
| 整合状态 | ✅ 已完成并验证：85 项测试全绿、构建与完整浏览器闭环通过 |

## 二、合规要点（HHCC 原型赛道）

1. **协议：CC-BY（Attribution）**——允许 remix/transform，前端运行时改材质颜色属于允许的改编行为，无需用 Blender 改源文件。
2. **硬性义务（已全部落实）**：
   - 署名原作者 `crivero` + 来源链接 + 协议名称 ✅（`AI_USAGE.md` 3D-Asset Note）
   - 写明“我们运行时覆盖为石墨金属材质” ✅
   - **页脚可见署名** ✅（Landing 页脚展示作者/链接/CC-BY/社区模型声明）
3. **风险话术**：模型为第三方自制，**不能宣称吉利官方原厂资产**；BP/文档/路演均需说明。
4. **兜底预案**：若现场加载卡顿或失败，代码保留 EVA 头像状态画面，座舱 HUD、控制和证据仍可使用。

### 可直接复制的署名块（英文）

```markdown
3D-Asset Note
Base 3D car asset downloaded from Sketchfab:
Author: crivero
Source Link: https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56
License: CC-BY (Creative Commons Attribution)

Note: This is community-made fan-model, NOT official Geely factory asset.
Vehicle graphite-metal material is dynamically overridden at runtime via Three.js
frontend code (glass and emissive light parts keep original materials);
original downloaded asset is black. The file was re-encoded with gltf-transform
(meshopt geometry compression, 24 MB -> 5 MB, geometry unmodified).
This static glb asset is used for the landing hero and cockpit digital-twin prototype.
```

## 三、体积优化（24MB → 5MB）

- 解析发现：688,362 三角面 / 460,349 顶点，**体积大头是几何 buffer（约 23MB），内嵌贴图仅 ~0.8MB**——压纹理无效。
- 处理：`gltf-transform quantize`（属性量化）+ `gltf-transform meshopt`（EXT_meshopt_compression 几何压缩）→ **5.03MB**，三角面数与观感不变。
- 解码：three 自带 `MeshoptDecoder`，随 Vite 打包本地加载，**断网演示可用**。
- 产物：`public/models/geely.glb`（5MB，自托管）；原始文件留在 `D:\DPHarness\geelyblackglb\source\`。

## 四、代码整合清单（eva-cockpit-v2 项目）

| 文件 | 说明 |
|---|---|
| `public/models/geely.glb` | 压缩后模型（替换了此前被拷入的 24MB 原版） |
| `src/landing/carScene.ts` | three.js 场景：石墨金属材质覆盖（跳过玻璃/发光件）、RoomEnvironment 反射、品牌轮廓光、贴地软阴影、横纵双向自动取景、约 28 秒自转 + 悬浮、完整 dispose |
| `src/shell/twin/` | 整车数字孪生：五场景剧情镜头、车身透视、左舵语义人物、DMS/OMS 关联、雨夜反馈与 EVA 状态降级 |
| `src/landing/CarModel.tsx` | React 包装：动态 import、requestIdleCallback 后加载、EVA 加载/失败状态、交叉淡入、prefers-reduced-motion 静帧 |
| `src/shared/EvaLoadingAvatar.tsx` | 首页、进舱和驾驶舱共用的动态 EVA 头像状态组件 |
| `src/landing/Landing.tsx` | Hero 接入 `<CarModel />` + 页脚 CC-BY 署名 |
| `src/landing/landing.css` | `.car-model/.car-stage/.car-canvas` 过渡与响应式样式 |
| `AI_USAGE.md` | 3D-Asset Note 署名 + three.js 依赖许可 |
| `CHANGELOG.md` | 0.6.0 条目记录本次改动 |

附带修复（与模型无关，上次会话遗留）：补齐缺失的 `src/shell/components/EvaFace.tsx`（四态 SVG 表情）与 `src/shell/evaAvatar.ts`（半身像几何纯函数），恢复构建与全部测试。

## 五、怎么看效果 / 排查

1. 首页与 `#/cockpit` 都使用同一车型资产；座舱页以剧情镜头展示整车和半透明座舱。
2. 首帧先显示 EVA 加载头像，模型就绪后淡入石墨金属 3D 车；失败时头像改为 `3D TWIN OFFLINE`，不是卡死。
3. 若长时间停留在离线状态：F12 控制台查找 `[CarModel] 3D vehicle unavailable` 或 `[TwinStage] 3D unavailable` 警告。
4. 性能说明：688k 三角面已采用无实时阴影、离屏暂停、事件驱动渲染和 DPR 上限；现场功能不依赖 3D 成功加载。

## 六、验证记录（2026-08-22）

- `npm test`：**85/85 全绿**
- `npm run build`：通过；three.js 独立 chunk（gzip ~164KB），主包不受影响
- 浏览器实测：Landing 整车可见；座舱 1426×1114 / 1440×1000 / 390×844 无溢出，五场景 Full Demo、EVA 降级与完成冻结均通过
