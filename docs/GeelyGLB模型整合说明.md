# Geely 3D 模型（geelyblackglb）整合说明

> 更新日期：2026-08-22 · 项目：`D:\DPHarness\eva-cockpit-v2_2026-08-22_0314`
> 模型来源：https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56

---

## 一、结论（TL;DR）

| 问题 | 答案 |
|---|---|
| 模型能不能用？ | **能**。CC-BY 协议允许修改与商用，条件是完整署名（已落实） |
| 模型会不会太大？ | 原始 24MB 确实太大，已压缩到 **5.03MB**（约 5 倍），浏览器加载无压力 |
| 用在哪里？ | **仅首页（Landing）Hero 视觉演示**，Dashboard 业务页不放车 |
| 是吉利官方模型吗？ | **不是**，社区爱好者自制（fan model），对外话术不得声称官方提供 |
| 整合状态 | ✅ 已完成并验证：43 项测试全绿、构建通过、浏览器实测渲染正常 |

## 二、合规要点（HHCC 原型赛道）

1. **协议：CC-BY（Attribution）**——允许 remix/transform，前端运行时改材质颜色属于允许的改编行为，无需用 Blender 改源文件。
2. **硬性义务（已全部落实）**：
   - 署名原作者 `crivero` + 来源链接 + 协议名称 ✅（`AI_USAGE.md` 3D-Asset Note）
   - 写明"我们修改了材质颜色（黑→白，运行时覆盖）" ✅
   - **页脚可见署名** ✅（Landing 页脚展示作者/链接/CC-BY/社区模型声明）
3. **风险话术**：模型为第三方自制，**不能宣称吉利官方原厂资产**；BP/文档/路演均需说明。
4. **兜底预案**：若现场加载卡顿，代码已内置自动回退手写 Canvas 线框（零外部资源、零署名负担）。

### 可直接复制的署名块（英文）

```markdown
3D-Asset Note
Base 3D car asset downloaded from Sketchfab:
Author: crivero
Source Link: https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56
License: CC-BY (Creative Commons Attribution)

Note: This is community-made fan-model, NOT official Geely factory asset.
Vehicle white paint material is dynamically overridden at runtime via Three.js
frontend code (glass and emissive light parts keep original materials);
original downloaded asset is black. The file was re-encoded with gltf-transform
(meshopt geometry compression, 24 MB -> 5 MB, geometry unmodified).
This static glb asset is used solely for homepage hero visual demo purpose.
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
| `src/landing/carScene.ts`（新增） | three.js 场景：白漆运行时覆盖（跳过玻璃/发光件）、RoomEnvironment 反射、暖白主光 + 品牌橙轮廓光、贴地软阴影、横纵双向自动取景、约 28 秒自转 + 悬浮、完整 dispose |
| `src/landing/CarModel.tsx`（新增） | React 包装：动态 import（three 独立 chunk ~164KB gzip，不进主包）、requestIdleCallback 后加载、**加载/失败自动回退 Canvas 线框**、交叉淡入、prefers-reduced-motion 静帧 |
| `src/landing/CabinModel.tsx`（保留） | 手写线框座舱，作为加载中/失败时的兜底视觉 |
| `src/landing/Landing.tsx` | Hero 接入 `<CarModel />` + 页脚 CC-BY 署名 |
| `src/landing/landing.css` | `.car-model/.car-stage/.car-canvas` 过渡与响应式样式 |
| `AI_USAGE.md` | 3D-Asset Note 署名 + three.js 依赖许可 |
| `CHANGELOG.md` | 0.6.0 条目记录本次改动 |

附带修复（与模型无关，上次会话遗留）：补齐缺失的 `src/shell/components/EvaFace.tsx`（四态 SVG 表情）与 `src/shell/evaAvatar.ts`（半身像几何纯函数），恢复构建与全部测试。

## 五、怎么看效果 / 排查

1. **3D 车只在首页**：浏览器打开 `http://localhost:<端口>/`（**根路径**）。`#/cockpit` 是座舱 Dashboard，本来就没有车（刻意设计：业务页留给 DMS 功能）。
2. **首帧是红色线框，1~3 秒后淡入白色 3D 车**——这是回退/过渡机制，不是 bug。
3. 若长时间停留在线框：F12 控制台找 `[CarModel] 3D 车模型加载失败` 警告（网络/GLB/WebGL 任一环节失败都会触发并静默回退）。
4. 性能说明：688k 三角面对现代浏览器无压力；已做不开阴影贴图、离屏暂停渲染（IntersectionObserver）、DPR 上限 2。若仍卡顿，可换 CC0 低模 + wireframe 方案（兜底预案）。

## 六、验证记录（2026-08-22）

- `npm test`：**43/43 全绿**
- `npm run build`：通过；three.js 独立 chunk（gzip ~164KB），主包不受影响
- 浏览器实测（1440×900 截图确认）：整车完整可见、白漆 + 玻璃保留、软阴影正常、自转悬浮流畅；Dashboard 路由不受影响
