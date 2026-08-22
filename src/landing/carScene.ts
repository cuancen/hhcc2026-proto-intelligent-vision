import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  type Material,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Hero 主视觉 3D 场景（three.js，动态 import 按需加载，不进主包）。
 * - 车辆模型：Sketchfab「geelyblackglb」by crivero（CC-BY，署名见 AI_USAGE.md）
 * - 模型经 gltf-transform meshopt 压缩（24MB → 5MB），解码器自 three 自带、离线可用
 * - 运行时把车身材质覆盖为白色车漆；玻璃（半透明）与车灯/屏幕（自发光）保留原材质
 * - 失败零影响：任何一步抛错由调用方捕获并回退 Canvas 线框（CabinModel）
 */

const BRAND_ORANGE = 0xff7838;

export interface CarSceneOptions {
  /** prefers-reduced-motion：仅渲染静帧（不旋转、不悬浮） */
  reducedMotion: boolean;
  /** 模型地址（默认走 Vite base 的自托管路径） */
  modelUrl?: string;
}

/** 是否保留原材质：玻璃（半透明/alpha 蒙版）与发光件（车灯、屏幕）不做白漆覆盖 */
function keepOriginal(mat: MeshStandardMaterial): boolean {
  const emissive = mat.emissive ? mat.emissive.r + mat.emissive.g + mat.emissive.b : 0;
  return mat.transparent || mat.alphaTest > 0 || emissive > 0.01;
}

function disposeMaterial(mat: Material): void {
  for (const value of Object.values(mat)) {
    if (value && (value as { isTexture?: boolean }).isTexture) value.dispose();
  }
  mat.dispose();
}

/** 软圆形阴影贴图（Canvas 径向渐变，零外部资源） */
function makeShadowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function mountCarScene(canvas: HTMLCanvasElement, opts: CarSceneOptions): Promise<() => void> {
  const url = opts.modelUrl ?? `${import.meta.env.BASE_URL}models/geely.glb`;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return Promise.reject(new Error('WebGL unavailable'));
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = false; // 688k 三角面：不用阴影贴图，用贴地软阴影图

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);

  // 环境反射（RoomEnvironment 本地生成，无外部 HDR 依赖）
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  // 灯光：暖白主光 + 品牌橙轮廓光（呼应 Landing 红橙光晕）
  const key = new DirectionalLight(0xfff2e8, 2.2);
  key.position.set(4, 6, 3);
  scene.add(key);
  const rim = new DirectionalLight(BRAND_ORANGE, 1.8);
  rim.position.set(-5, 2.2, -4);
  scene.add(rim);
  const fill = new DirectionalLight(0x8fb4ff, 0.6);
  fill.position.set(-3, 1.2, 5);
  scene.add(fill);

  let raf = 0;
  let visible = true;
  let disposed = false;
  const cleanups: Array<() => void> = [];
  /** 模型就绪后赋值：按当前画布纵横比重新定距取景 */
  let reframe: (() => void) | null = null;

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 });
  io.observe(canvas);
  cleanups.push(() => io.disconnect());

  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    reframe?.();
    if (opts.reducedMotion) renderer.render(scene, camera);
  });
  ro.observe(canvas);
  cleanups.push(() => ro.disconnect());

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  return loader.loadAsync(url).then((gltf) => {
    if (disposed) {
      gltf.scene.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(disposeMaterial);
      });
      throw new Error('unmounted');
    }

    const model = gltf.scene;
    const replaced: MeshStandardMaterial[] = [];
    const paint = new MeshStandardMaterial({
      color: 0x2e3946,
      metalness: 0.72,
      roughness: 0.29,
      envMapIntensity: 1.18,
    });

    model.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const currentMaterial = mesh.material;
      const hasMaterialArray = Array.isArray(currentMaterial);
      const mats: Material[] = hasMaterialArray ? currentMaterial : [currentMaterial];
      const nextMaterials = mats.map((m) => {
        const std = m as MeshStandardMaterial;
        if (keepOriginal(std)) return std;
        replaced.push(std);
        return paint;
      });
      // Three.js only renders a material array through geometry groups. Turning a
      // single-material mesh into an array leaves ungrouped GLB meshes invisible.
      mesh.material = hasMaterialArray ? nextMaterials : nextMaterials[0];
    });
    // 被替换的原材质立即释放（贴图/程序纹理一并清掉）
    replaced.forEach(disposeMaterial);

    // 自动取景：包围盒居中 + 半径定距，与模型原始尺度解耦
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    model.position.sub(center);
    const radius = Math.max(size.x, size.y, size.z, 1e-4) / 2;

    const pivot = new Group();
    pivot.add(model);
    scene.add(pivot);

    // 贴地软阴影（不随车旋转，随悬浮微缩放）
    const shadowTex = makeShadowTexture();
    const shadow = new Mesh(
      new PlaneGeometry(radius * 2.4, radius * 2.4),
      new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -size.y / 2 - radius * 0.04;
    scene.add(shadow);

    const azimuth = MathUtils.degToRad(36);
    const elevation = MathUtils.degToRad(13);
    // 同时适配竖直/水平视野：Hero 右栏是窄高容器，只按垂直 fov 定距会横向裁切
    const place = () => {
      const vHalf = MathUtils.degToRad(camera.fov / 2);
      const hHalf = Math.min(
        Math.PI * 0.45,
        Math.atan(Math.tan(vHalf) * Math.max(camera.aspect, 0.1)),
      );
      const distance = Math.max(radius / Math.sin(vHalf), radius / Math.sin(hHalf)) * 1.03;
      camera.position.set(
        Math.sin(azimuth) * Math.cos(elevation) * distance,
        Math.sin(elevation) * distance + radius * 0.05,
        Math.cos(azimuth) * Math.cos(elevation) * distance,
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    place();
    reframe = place;

    let lastMs = performance.now();
    let spin = 0;
    let settle = 0;
    const floatAmp = radius * 0.012;

    const draw = (ms: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden) { lastMs = ms; return; }
      const dt = Math.min(0.1, (ms - lastMs) / 1000);
      lastMs = ms;
      if (!opts.reducedMotion) {
        spin += dt * 0.22; // 约 28 秒一圈，与线框回退一致
        settle = Math.min(1, settle + dt * 1.2);
      } else {
        settle = 1;
      }
      const ease = 1 - Math.pow(1 - settle, 3);
      pivot.rotation.y = spin * ease;
      const float = opts.reducedMotion ? 0 : Math.sin(ms / 1400) * floatAmp;
      pivot.position.y = (float + floatAmp) * ease;
      const breath = 1 - (float / floatAmp || 0) * 0.06;
      shadow.scale.setScalar(breath);
      renderer.render(scene, camera);
    };

    if (opts.reducedMotion) renderer.render(scene, camera);
    else raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      shadowTex.dispose();
      shadow.geometry.dispose();
      (shadow.material as MeshBasicMaterial).dispose();
      model.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(disposeMaterial);
      });
      paint.dispose();
      envTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  });
}
