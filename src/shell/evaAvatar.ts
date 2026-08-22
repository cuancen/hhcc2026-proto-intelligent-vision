/**
 * EVA 数字人半身像线框几何（纯函数、零 DOM）——使用「顶点 + 环/弧」表达，
 * 供 EvaFace 组件与回归测试使用。
 * 结构：头（4 纬环 + 3 经线）+ 颈（2 环）+ 躯干（肩/胸/下胸前弧）+ 脊柱芯。
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bust {
  /** 闭合环：4 头纬环 + 3 经线 + 2 颈环 */
  loops: Vec3[][];
  /** 前表面开口弧：肩 / 胸 / 下胸 */
  arcs: Vec3[][];
  eyes: [Vec3, Vec3];
  mouth: Vec3;
  /** 脊柱芯点列（头心 → 胸口 → 腰） */
  core: Vec3[];
  height: number;
}

/** 头部椭球参数：中心 y=1.62，半径 (0.42, 0.50, 0.46) */
const HEAD_C = 1.62;
const HEAD_R: Vec3 = { x: 0.42, y: 0.5, z: 0.46 };

function ring(count: number, fn: (t: number) => Vec3): Vec3[] {
  return Array.from({ length: count }, (_, i) => fn((i / count) * Math.PI * 2));
}

export function buildBust(): Bust {
  // 4 条头纬环（不同高度的截面椭圆，前后收窄由 z 半径随 |y 偏移| 缩小实现）
  const latOffsets = [-0.3, -0.1, 0.12, 0.32];
  const headRings = latOffsets.map((dy) =>
    ring(14, (t) => ({
      x: HEAD_R.x * Math.cos(t) * Math.sqrt(Math.max(0.05, 1 - (dy / HEAD_R.y) ** 2)),
      y: HEAD_C + dy,
      z: HEAD_R.z * Math.sin(t) * Math.sqrt(Math.max(0.05, 1 - (dy / HEAD_R.y) ** 2)),
    })),
  );

  // 3 条经线（绕 y 轴 0°/60°/120° 的竖直大圆，贴合椭球）
  const meridians = [0, Math.PI / 3, (2 * Math.PI) / 3].map((phi) =>
    ring(16, (t) => {
      const sy = Math.sin(t);
      const cy = Math.cos(t);
      const squash = Math.sqrt(Math.max(0.05, 1 - sy * sy));
      return {
        x: HEAD_R.x * cy * squash * Math.cos(phi),
        y: HEAD_C + HEAD_R.y * sy,
        z: HEAD_R.z * cy * squash * Math.sin(phi),
      };
    }),
  );

  // 2 条颈环
  const neckRings = [1.12, 1.26].map((y) => ring(10, (t) => ({ x: 0.16 * Math.cos(t), y, z: 0.15 * Math.sin(t) })));

  // 前表面弧：肩(y=0.98 宽) / 胸(y=0.72) / 下胸(y=0.48)，x 对称收窄
  const arcs = [
    arcRow(0.98, 0.74, 0.4),
    arcRow(0.72, 0.66, 0.46),
    arcRow(0.48, 0.5, 0.4),
  ];

  const core: Vec3[] = [
    { x: 0, y: 0.05, z: 0 },
    { x: 0, y: 0.3, z: 0.02 },
    { x: 0, y: 0.58, z: 0.06 },
    { x: 0, y: 0.86, z: 0.04 },
    { x: 0, y: 1.1, z: 0 },
    { x: 0, y: 1.34, z: 0.02 },
    { x: 0, y: HEAD_C, z: 0 },
    { x: 0, y: HEAD_C + 0.3, z: 0 },
  ];

  return {
    loops: [...headRings, ...meridians, ...neckRings],
    arcs,
    eyes: [
      { x: -0.16, y: HEAD_C + 0.04, z: 0.38 },
      { x: 0.16, y: HEAD_C + 0.04, z: 0.38 },
    ],
    mouth: { x: 0, y: HEAD_C - 0.14, z: 0.42 },
    core,
    height: HEAD_C + HEAD_R.y,
  };
}

/** 一条躯干前弧：给定 y 高度与 x/z 张角，生成 9 点开口弧 */
function arcRow(y: number, spread: number, depth: number): Vec3[] {
  return Array.from({ length: 9 }, (_, i) => {
    const t = -1 + (2 * i) / 8; // -1 … 1
    return { x: spread * t, y, z: depth * (1 - t * t) + 0.02 };
  });
}

// ---------- 情绪表现（EvaFace 组件与测试共用） ----------

import type { EvaMood } from './evaFace';

export type { EvaMood };

/** 四态主题色（与 theme.css --accent/--ok/--warn/--danger 对齐） */
export const MOOD_COLOR: Record<EvaMood, string> = {
  calm: '#2dd4bf',
  care: '#4ade80',
  warn: '#fbbf24',
  urgent: '#f87171',
};

/** 眼形：平静横杆 / 关怀弯月(笑眼) / 警示圆睁 / 紧急瞪大 */
export function eyeShapeOf(mood: EvaMood): 'bar' | 'arc' | 'round' | 'max' {
  switch (mood) {
    case 'care': return 'arc';
    case 'warn': return 'round';
    case 'urgent': return 'max';
    default: return 'bar';
  }
}
