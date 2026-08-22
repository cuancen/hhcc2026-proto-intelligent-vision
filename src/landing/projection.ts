/** Landing 页伪 3D 线框投影：全部纯函数（零 DOM），可独立回归测试。 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Projected {
  x: number;
  y: number;
  /** 相机空间深度（越大越远），用于按深度着色与近裁剪 */
  depth: number;
}

/** 绕 Y 轴旋转（右手系） */
export function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

/** 透视投影：相机位于 z = camZ 处朝 -z 看，焦距 focal，画布中心 (cx, cy) */
export function project(p: Vec3, camZ: number, focal: number, cx: number, cy: number, scale: number): Projected {
  const zc = camZ - p.z; // 相机空间深度（p.z 越大越远）
  const k = (focal / Math.max(0.05, zc)) * scale;
  return { x: cx + p.x * k, y: cy - p.y * k, depth: zc };
}

/** 品牌渐变插值：暗红 #a82c36 → 橙红 #ff7838（t=0 近 / 1 远，远处更暖） */
export function brandColor(t: number, alpha = 1): string {
  const c = Math.min(1, Math.max(0, t));
  const r = Math.round(0xa8 + (0xff - 0xa8) * c);
  const g = Math.round(0x2c + (0x78 - 0x2c) * c);
  const b = Math.round(0x36 + (0x38 - 0x36) * c);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 圆环顶点（世界坐标，用于轮子/检测环） */
export function ring(cx: number, cy: number, cz: number, radius: number, axis: 'x' | 'y' | 'z', segments = 14): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    if (axis === 'z') pts.push({ x: cx + c, y: cy + s, z: cz });
    else if (axis === 'x') pts.push({ x: cx, y: cy + s, z: cz + c });
    else pts.push({ x: cx + c, y: cy, z: cz + s });
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/* 座舱线框模型（单位：米，紧凑级 SUV 侧视轮廓 × 车宽拉伸）            */
/* ------------------------------------------------------------------ */

/** 侧视轮廓（x 前后 / y 高度），从车头下沿逆时针一圈 */
const SIDE_PROFILE: readonly [number, number][] = [
  [-2.02, 0.42], // 前保险杠下沿
  [-2.08, 0.78], // 前保险杠上沿
  [-1.86, 0.94], // 机盖前缘
  [-0.98, 1.06], // 风挡下沿
  [-0.38, 1.42], // 车顶前
  [0.72, 1.40], // 车顶后
  [1.52, 1.04], // 后风挡下沿
  [1.98, 0.96], // 尾箱上沿
  [2.06, 0.52], // 尾部
  [2.02, 0.42], // 尾部下沿
];

const HALF_W = 0.86; // 半车宽
const WHEEL_X = [-1.28, 1.32] as const;
const WHEEL_R = 0.36;

export interface CabinWireframe {
  /** 独立线段（已含两侧轮廓纵向连接线） */
  segments: [Vec3, Vec3][];
  /** 闭合多边形（侧轮廓、侧窗、轮环、检测环），每环首尾自动闭合 */
  loops: Vec3[][];
  /** 驾驶员头部中心（检测框目标） */
  head: Vec3;
  /** 驾驶员检测框 12 条棱 */
  headBoxSegs: [Vec3, Vec3][];
  /** 车内摄像头位置（后视镜处）到头部的视线 */
  gazes: [Vec3, Vec3][];
}

/** 构建线框座舱：侧轮廓拉伸 + 侧窗 + 轮环 + 驾驶员检测框 + 视线 */
export function buildCabin(): CabinWireframe {
  const loops: Vec3[][] = [];
  const segments: [Vec3, Vec3][] = [];

  // 两侧轮廓（z = ±HALF_W）+ 顶点纵向连线
  const sides = [-HALF_W, HALF_W].map((z) =>
    SIDE_PROFILE.map(([x, y]) => ({ x, y, z })),
  );
  sides.forEach((pts) => loops.push(pts));
  SIDE_PROFILE.forEach((_, i) => {
    segments.push([sides[0][i], sides[1][i]]);
  });

  // 侧窗（乘员舱剪影，稍内缩）
  const winZ = HALF_W + 0.015;
  [-winZ, winZ].forEach((z) => {
    loops.push([
      { x: -0.78, y: 1.08, z },
      { x: -0.28, y: 1.37, z },
      { x: 0.64, y: 1.35, z },
      { x: 1.34, y: 1.06, z },
    ]);
  });

  // 轮环（双侧前后）
  for (const wx of WHEEL_X) {
    for (const z of [-HALF_W, HALF_W]) {
      loops.push(ring(wx, WHEEL_R, z, WHEEL_R, 'z', 12));
    }
  }

  // 驾驶员检测框（座舱内头部，EVA 的视觉锚点）
  const head: Vec3 = { x: 0.18, y: 1.06, z: 0.3 };
  const s = 0.19; // 半边长
  const headBox = [
    { x: head.x - s, y: head.y - s * 1.15, z: head.z - s },
    { x: head.x + s, y: head.y - s * 1.15, z: head.z - s },
    { x: head.x + s, y: head.y - s * 1.15, z: head.z + s },
    { x: head.x - s, y: head.y - s * 1.15, z: head.z + s },
    { x: head.x - s, y: head.y + s * 1.15, z: head.z - s },
    { x: head.x + s, y: head.y + s * 1.15, z: head.z - s },
    { x: head.x + s, y: head.y + s * 1.15, z: head.z + s },
    { x: head.x - s, y: head.y + s * 1.15, z: head.z + s },
  ];
  const E: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const boxSegs = E.map(([a, b]) => [headBox[a], headBox[b]] as [Vec3, Vec3]);

  // 舱内摄像头（后视镜位）→ 头部 视线
  const cam: Vec3 = { x: -0.34, y: 1.16, z: 0.3 };
  const gazes: [Vec3, Vec3][] = [
    [cam, { x: head.x - s, y: head.y, z: head.z - s }],
    [cam, { x: head.x + s, y: head.y, z: head.z - s }],
    [cam, { x: head.x - s, y: head.y, z: head.z + s }],
    [cam, { x: head.x + s, y: head.y, z: head.z + s }],
  ];

  // 感知扫描环（地面）
  loops.push(ring(0.1, 0.02, 0, 2.9, 'y', 28));

  return { segments, loops, head, headBoxSegs: boxSegs, gazes };
}
