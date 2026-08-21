/**
 * 将 @mediapipe/tasks-vision 的 WASM 运行时拷贝到 public/mediapipe-wasm，
 * 使视觉模块可完全自托管运行（离线 / 弱网 / 国内网络均可）。
 * 由 postinstall 自动执行；产物不进 git（.gitignore），由各环境自行生成。
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, 'public', 'mediapipe-wasm');

if (!existsSync(src)) {
  console.error('[copy-wasm] 未找到 @mediapipe/tasks-vision/wasm，跳过（视觉模块将回退 CDN）');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-wasm] 已拷贝 WASM 运行时 → public/mediapipe-wasm');
