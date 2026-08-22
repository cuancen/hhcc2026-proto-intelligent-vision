import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  Box3,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CockpitState } from '../../core';
import type { TwinCameraPreset, TwinFrame } from './twinState';
import { cameraCutKey, fitModelBounds } from './twinState';

const GRAPHITE = new Color(0x151b23);
const SMOKE = new Color(0x242c38);
const METAL = new Color(0xa9b2bf);
const CAUSE = new Color(0xff7a3d);
const VERIFY = new Color(0x5eead4);
const DANGER = new Color(0xff5a5f);
const EVA_PURPLE = new Color(0x8c6cf2);
const ROAD_SURFACE_LOCAL_Y = -0.82;
const TIRE_CLEARANCE = 0.035;

interface CameraPose {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

const VEHICLE_AXIS_X = 0.4689024292;
const VEHICLE_AXIS_Z = 0.8832499713;
const VEHICLE_YAW = Math.atan2(VEHICLE_AXIS_X, VEHICLE_AXIS_Z);

/** 车辆局部坐标：+Z 向前、+X 向左、-X 向右、+Y 向上。 */
export const VEHICLE_CALIBRATION = {
  handedness: 'left-hand-drive' as const,
  yaw: VEHICLE_YAW,
  // Deliberately keep the two semantic occupants on a readable diagonal:
  // driver = front-left, OMS passenger = rear-right.
  // 主驾臀点落在 GLB 前排左座中心；方向盘在该锚点前方单独派生。
  driver: [0.5, -0.09, 0.32] as const,
  rearRight: [-0.5, -0.09, -0.55] as const,
  rearRightWindow: [-0.92, 0.5, -0.58] as const,
};

function worldPoint(point: readonly [number, number, number]): readonly [number, number, number] {
  const [x, y, z] = point;
  return [
    VEHICLE_AXIS_Z * x + VEHICLE_AXIS_X * z,
    y,
    -VEHICLE_AXIS_X * x + VEHICLE_AXIS_Z * z,
  ];
}

function localPose(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
): CameraPose {
  return { position: worldPoint(position), target: worldPoint(target) };
}

function chasePose(
  distance: number,
  height: number,
  lookAhead: number,
  targetY: number,
  lateral = 0,
): CameraPose {
  const lateralX = VEHICLE_AXIS_Z;
  const lateralZ = -VEHICLE_AXIS_X;
  return {
    position: [
      -VEHICLE_AXIS_X * distance + lateralX * lateral,
      height,
      -VEHICLE_AXIS_Z * distance + lateralZ * lateral,
    ],
    target: [VEHICLE_AXIS_X * lookAhead, targetY, VEHICLE_AXIS_Z * lookAhead],
  };
}

const CAMERA_POSES: Record<TwinCameraPreset, CameraPose> = {
  // 车型几何 PCA 测得纵轴为 X/Z=(0.469, 0.883)，三种外景均以此轴为基准但保持不同机位。
  rearChase: chasePose(7.7, 1.52, 1.2, -0.08, 1.28),
  // 提醒驾驶员查看右后方时保持在车辆右侧，承接乘员发现镜头并稍微退远。
  rearRightChase: chasePose(8.25, 1.62, 1.05, -0.08, -1.48),
  // 从追车机位向车辆右后侧小幅横移并拉近，目标始终锁定后排右侧乘员。
  rearRightReveal: localPose([-3.15, 1.62, -5.45], [-0.5, 0.44, -0.55]),
  rainChase: chasePose(8.85, 1.68, 1.4, -0.1, -1.05),
  rearWide: chasePose(10.2, 2.62, 1.15, -0.08, -0.9),
  leftFrontHigh: localPose([5.25, 4.15, 4.65], [0, 0.28, 0.02]),
  // 风险确认与回正从车辆右侧对面观察右后窗；抬高机位，跨侧转场不会穿过车身。
  rearRightFocus: localPose([-5.25, 3.35, -4.05], [-0.5, 0.44, -0.55]),
  cabin: localPose([4.2, 2.7, 4.5], [0.05, 0.34, 0]),
  console: localPose([1.8, 1.95, 3.1], [-0.12, 0.43, 0.45]),
  driver: localPose([3.4, 2.25, 3.8], [VEHICLE_CALIBRATION.driver[0], 0.44, VEHICLE_CALIBRATION.driver[2]]),
  gaze: localPose([3.7, 2.15, 3.7], [VEHICLE_CALIBRATION.driver[0], 0.44, VEHICLE_CALIBRATION.driver[2]]),
  cause: localPose([3.55, 2.2, 3.45], [VEHICLE_CALIBRATION.driver[0], 0.42, VEHICLE_CALIBRATION.driver[2]]),
  assist: localPose([3.25, 2.62, 3.65], [VEHICLE_CALIBRATION.driver[0], 0.43, VEHICLE_CALIBRATION.driver[2]]),
  verify: localPose([1.05, 2.55, 4.5], [0.28, 0.38, 0.18]),
};

export interface TwinSceneOptions {
  liveState: () => CockpitState;
  initialFrame: TwinFrame;
  running: boolean;
  reducedMotion: boolean;
}

export interface TwinSceneController {
  setFrame(frame: TwinFrame): void;
  setRunning(running: boolean): void;
  dispose(): void;
}

function materialColor(frame: TwinFrame): Color {
  if (frame.accent === 'cause') return CAUSE;
  if (frame.accent === 'verify') return VERIFY;
  if (frame.accent === 'danger') return DANGER;
  return METAL;
}

function makeLimb(
  startTuple: readonly [number, number, number],
  endTuple: readonly [number, number, number],
  material: MeshStandardMaterial,
  radius = 0.045,
): Mesh {
  const start = new Vector3(...startTuple);
  const end = new Vector3(...endTuple);
  const direction = end.clone().sub(start);
  const limb = new Mesh(new CylinderGeometry(radius * 0.86, radius, 1, 12), material);
  limb.position.copy(start).add(end).multiplyScalar(0.5);
  limb.scale.y = direction.length();
  limb.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  return limb;
}

function makeJoint(
  point: readonly [number, number, number],
  material: MeshStandardMaterial,
  radius = 0.065,
  scale: readonly [number, number, number] = [1, 1, 1],
): Mesh {
  const joint = new Mesh(new SphereGeometry(radius, 18, 14), material);
  joint.position.set(...point);
  joint.scale.set(...scale);
  return joint;
}

function makeSeatedLegs(material: MeshStandardMaterial): Group {
  const legs = new Group();
  const leftHip: readonly [number, number, number] = [0.105, 0.035, 0];
  const rightHip: readonly [number, number, number] = [-0.105, 0.035, 0];
  const leftKnee: readonly [number, number, number] = [0.12, -0.145, 0.18];
  const rightKnee: readonly [number, number, number] = [-0.12, -0.145, 0.18];
  const leftAnkle: readonly [number, number, number] = [0.12, -0.305, 0.285];
  const rightAnkle: readonly [number, number, number] = [-0.12, -0.305, 0.285];

  legs.add(
    makeLimb(leftHip, leftKnee, material, 0.075),
    makeLimb(rightHip, rightKnee, material, 0.075),
    makeLimb(leftKnee, leftAnkle, material, 0.058),
    makeLimb(rightKnee, rightAnkle, material, 0.058),
    makeJoint(leftHip, material, 0.072),
    makeJoint(rightHip, material, 0.072),
    makeJoint(leftKnee, material, 0.065),
    makeJoint(rightKnee, material, 0.065),
    makeJoint(leftAnkle, material, 0.05),
    makeJoint(rightAnkle, material, 0.05),
    makeJoint([0.12, -0.32, 0.35], material, 0.065, [0.75, 0.46, 1.45]),
    makeJoint([-0.12, -0.32, 0.35], material, 0.065, [0.75, 0.46, 1.45]),
  );
  return legs;
}

interface DrivingWorld {
  group: Group;
  city: Group;
  motion: Group;
  leadVehicle: Group;
  roadMaterial: MeshBasicMaterial;
  wetMaterial: MeshBasicMaterial;
  laneMaterial: MeshBasicMaterial;
  gridMaterial: MeshBasicMaterial;
  reflectorMaterial: MeshBasicMaterial;
  tailLightMaterial: MeshBasicMaterial;
  roadTexture: CanvasTexture;
}

function makeRoadTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new CanvasTexture(canvas);
  const edge = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edge.addColorStop(0, 'rgba(8, 12, 18, 0)');
  edge.addColorStop(0.08, 'rgba(12, 18, 27, .78)');
  edge.addColorStop(0.2, 'rgba(16, 23, 34, .98)');
  edge.addColorStop(0.8, 'rgba(16, 23, 34, .98)');
  edge.addColorStop(0.92, 'rgba(12, 18, 27, .78)');
  edge.addColorStop(1, 'rgba(8, 12, 18, 0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(116, 135, 156, .045)';
  [74, 88, 168, 182].forEach((x) => ctx.fillRect(x, 0, 2, canvas.height));
  for (let y = 0; y < canvas.height; y += 19) {
    const alpha = 0.012 + ((y * 13) % 11) / 1000;
    ctx.fillStyle = `rgba(190, 205, 220, ${alpha})`;
    ctx.fillRect(22 + ((y * 17) % 31), y, 210 - ((y * 7) % 24), 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * 以车辆同一世界坐标构建程序化道路，而不是在 Canvas 后方拼一张二维路面。
 * 车、短道路分段和前车因此天然共享相机与消失点，同时保持纯数字孪生风格。
 */
function makeDrivingWorld(): DrivingWorld {
  const group = new Group();
  group.name = 'procedural-driving-world';
  // 局部道路 +Z 精确旋到车型 PCA 纵轴，避免用肉眼猜一个近似角度。
  group.rotation.y = VEHICLE_YAW;

  const unitPlane = new PlaneGeometry(1, 1);
  const unitBox = new BoxGeometry(1, 1, 1);
  const addGroundPlane = (
    parent: Group,
    material: MeshBasicMaterial | MeshStandardMaterial,
    width: number,
    length: number,
    x: number,
    z: number,
    y: number,
  ) => {
    const mesh = new Mesh(unitPlane, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.set(width, length, 1);
    parent.add(mesh);
    return mesh;
  };
  const addBox = (
    parent: Group,
    material: MeshBasicMaterial | MeshStandardMaterial,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
  ) => {
    const mesh = new Mesh(unitBox, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const roadTexture = makeRoadTexture();
  const roadMaterial = new MeshBasicMaterial({
    color: 0x18202b,
    map: roadTexture,
    transparent: true,
    opacity: 0.96,
    side: DoubleSide,
  });
  addGroundPlane(group, roadMaterial, 8.6, 110, 0, 46.5, ROAD_SURFACE_LOCAL_Y);

  const wetMaterial = new MeshBasicMaterial({
    color: 0x607da5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  addGroundPlane(group, wetMaterial, 8.3, 109.5, 0, 46.5, ROAD_SURFACE_LOCAL_Y + 0.001);

  const laneMaterial = new MeshBasicMaterial({
    color: VERIFY,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    side: DoubleSide,
  });
  const gridMaterial = new MeshBasicMaterial({
    color: 0x7690aa,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: DoubleSide,
  });
  const reflectorMaterial = new MeshBasicMaterial({
    color: 0x8c6cf2,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: DoubleSide,
  });

  const motion = new Group();
  motion.name = 'speed-linked-road-markers';
  const speedCyan = new MeshBasicMaterial({ color: VERIFY, transparent: true, opacity: 0.34, depthWrite: false, blending: AdditiveBlending });
  const speedPurple = new MeshBasicMaterial({ color: EVA_PURPLE, transparent: true, opacity: 0.32, depthWrite: false, blending: AdditiveBlending });
  const guardMaterial = new MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.22, depthWrite: false });
  [-4.08, 4.08].forEach((x) => {
    addBox(group, guardMaterial, [0.055, 0.075, 108], [x, ROAD_SURFACE_LOCAL_Y + 0.43, 45.5]);
    addBox(group, guardMaterial, [0.035, 0.035, 108], [x, ROAD_SURFACE_LOCAL_Y + 0.69, 45.5]);
  });
  for (let z = -8; z <= 31; z += 3.2) {
    [-1.52, 1.52].forEach((x) => addGroundPlane(motion, laneMaterial, 0.075, 1.42, x, z, ROAD_SURFACE_LOCAL_Y + 0.003));
    [-3.92, 3.92].forEach((x) => addBox(motion, reflectorMaterial, [0.08, 0.035, 0.22], [x, ROAD_SURFACE_LOCAL_Y + 0.025, z + 0.2]));
    addBox(motion, speedPurple, [0.035, 0.035, 1.36], [-3.58, ROAD_SURFACE_LOCAL_Y + 0.13, z + 0.72]);
    addBox(motion, speedCyan, [0.035, 0.035, 1.36], [3.58, ROAD_SURFACE_LOCAL_Y + 0.13, z - 0.18]);
    [-4.08, 4.08].forEach((x) => {
      addBox(motion, guardMaterial, [0.045, 0.58, 0.045], [x, ROAD_SURFACE_LOCAL_Y + 0.28, z]);
      addBox(motion, reflectorMaterial, [0.065, 0.09, 0.035], [x - Math.sign(x) * 0.025, ROAD_SURFACE_LOCAL_Y + 0.5, z - 0.03]);
    });
  }
  for (let z = -8; z <= 31; z += 6.4) {
    addGroundPlane(motion, gridMaterial, 8.1, 0.025, 0, z, ROAD_SURFACE_LOCAL_Y + 0.002);
  }
  group.add(motion);

  const city = new Group();
  city.name = 'digital-city-corridor';
  const cityVolume = new MeshBasicMaterial({ color: 0x1d2b3f, transparent: true, opacity: 0.38, depthWrite: false });
  const cityPurple = new MeshBasicMaterial({ color: 0x8c6cf2, transparent: true, opacity: 0.34, depthWrite: false, blending: AdditiveBlending });
  const cityCyan = new MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.3, depthWrite: false, blending: AdditiveBlending });
  for (let index = 0; index < 28; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const depthIndex = Math.floor(index / 2);
    const height = 1.05 + ((index * 5) % 7) * 0.23;
    const width = 0.8 + (index % 4) * 0.16;
    const x = side * (5.05 + (depthIndex % 3) * 0.34);
    const z = -6.4 + depthIndex * 3.2;
    const material = index % 3 === 0 ? cityCyan : cityPurple;
    addBox(city, cityVolume, [width, height, 0.72], [x, ROAD_SURFACE_LOCAL_Y + height / 2, z]);
    for (let row = 0; row < 4; row += 1) {
      addBox(city, material, [0.03, 0.035, 0.42], [x - side * (width / 2 + 0.012), ROAD_SURFACE_LOCAL_Y + 0.28 + row * 0.3, z]);
    }
    addBox(city, material, [0.035, 0.88, 0.035], [side * 4.33, ROAD_SURFACE_LOCAL_Y + 0.44, z + 0.64]);
    addBox(city, material, [0.32, 0.035, 0.035], [side * 4.18, ROAD_SURFACE_LOCAL_Y + 0.84, z + 0.64]);
  }
  group.add(city);

  const leadVehicle = new Group();
  leadVehicle.name = 'simulated-lead-vehicle';
  leadVehicle.position.set(-0.48, 0, 8.6);
  const leadBodyMaterial = new MeshStandardMaterial({ color: 0x111923, metalness: 0.34, roughness: 0.54 });
  const leadGlassMaterial = new MeshBasicMaterial({ color: 0x263a4f, transparent: true, opacity: 0.72 });
  const tailLightMaterial = new MeshBasicMaterial({ color: DANGER, transparent: true, opacity: 0.62 });
  addBox(leadVehicle, leadBodyMaterial, [1.15, 0.38, 1.95], [0, -0.54, 0]);
  addBox(leadVehicle, leadGlassMaterial, [0.78, 0.25, 0.92], [0, -0.25, 0.14]);
  [-0.37, 0.37].forEach((x) => addBox(leadVehicle, tailLightMaterial, [0.25, 0.08, 0.035], [x, -0.45, -0.995]));
  group.add(leadVehicle);

  return {
    group,
    city,
    motion,
    leadVehicle,
    roadMaterial,
    wetMaterial,
    laneMaterial,
    gridMaterial,
    reflectorMaterial,
    tailLightMaterial,
    roadTexture,
  };
}

function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => materials.add(mat));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export async function mountTwinScene(
  canvas: HTMLCanvasElement,
  options: TwinSceneOptions,
): Promise<TwinSceneController> {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    throw new Error('WebGL unavailable');
  }

  const compact = window.matchMedia('(max-width: 640px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = false;

  const scene = new Scene();
  scene.background = null;
  const distanceFog = new FogExp2(0x080d16, 0.03);
  scene.fog = distanceFog;
  const camera = new PerspectiveCamera(compact ? 38 : 31, 1, 0.1, 80);
  const initialPose = CAMERA_POSES[options.initialFrame.camera];
  camera.position.set(...initialPose.position);
  const lookTarget = new Vector3(...initialPose.target);
  camera.lookAt(lookTarget);

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  pmrem.dispose();

  scene.add(new AmbientLight(0x9cadc1, 0.4));
  const key = new DirectionalLight(0xe6ecf5, 2.25);
  key.position.set(5, 7, 5);
  const rim = new DirectionalLight(0xff7a3d, 1.35);
  rim.position.set(-6, 2.5, -5);
  const fill = new DirectionalLight(0x5eead4, 0.52);
  fill.position.set(-4, 2, 5);
  scene.add(key, rim, fill);

  const stage = new Group();
  scene.add(stage);
  const drivingWorld = makeDrivingWorld();
  // 道路与环境属于车辆舞台坐标系；车辆定位或轻微车身起伏时不会与车道脱节。
  stage.add(drivingWorld.group);

  const floorMaterial = new MeshBasicMaterial({ color: 0x0a0f16 });
  const floor = new Mesh(new CircleGeometry(5.5, 96), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.78;
  stage.add(floor);
  const stageRings: Mesh[] = [];
  [2.7, 4.1, 5.35].forEach((radius, index) => {
    const ring = new Mesh(
      new RingGeometry(radius, radius + 0.012, 96),
      new MeshBasicMaterial({ color: index === 1 ? CAUSE : METAL, transparent: true, opacity: index === 1 ? 0.2 : 0.1, side: DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.765;
    stage.add(ring);
    stageRings.push(ring);
  });

  const semanticRig = new Group();
  semanticRig.name = 'vehicle-local-semantic-cutaway';
  semanticRig.rotation.y = VEHICLE_YAW;

  const driver = new Group();
  const driverMaterial = new MeshStandardMaterial({ color: 0x82d8d0, emissive: 0x163b3a, emissiveIntensity: 0.34, metalness: 0.02, roughness: 0.82, transparent: true, opacity: 0.7, depthWrite: false });
  const driverPelvis = new Mesh(new SphereGeometry(0.2, 22, 16), driverMaterial);
  driverPelvis.position.y = 0.04;
  driverPelvis.scale.set(0.82, 0.82, 0.62);
  const driverSpine = makeLimb([0, 0.1, 0], [0, 0.27, 0], driverMaterial, 0.13);
  const driverChest = new Mesh(new SphereGeometry(0.23, 24, 18), driverMaterial);
  driverChest.position.y = 0.26;
  driverChest.scale.set(1.05, 0.82, 0.68);
  const driverShoulders = makeLimb([-0.18, 0.31, 0], [0.18, 0.31, 0], driverMaterial, 0.064);
  const driverNeck = new Mesh(new CylinderGeometry(0.07, 0.085, 0.1, 14), driverMaterial);
  driverNeck.position.y = 0.43;
  const driverHead = new Mesh(new SphereGeometry(0.16, 24, 18), driverMaterial);
  driverHead.position.y = 0.56;
  driverHead.scale.set(0.9, 1.07, 0.94);
  const driverLeftElbow: readonly [number, number, number] = [0.19, 0.21, 0.16];
  const driverRightElbow: readonly [number, number, number] = [-0.19, 0.21, 0.16];
  const driverLeftHand: readonly [number, number, number] = [0.1, 0.22, 0.34];
  const driverRightHand: readonly [number, number, number] = [-0.1, 0.22, 0.34];
  const driverLegs = makeSeatedLegs(driverMaterial);
  driver.add(
    driverPelvis,
    driverSpine,
    driverChest,
    driverShoulders,
    driverNeck,
    driverHead,
    makeLimb([0.17, 0.3, 0.01], driverLeftElbow, driverMaterial, 0.055),
    makeLimb(driverLeftElbow, driverLeftHand, driverMaterial, 0.046),
    makeLimb([-0.17, 0.3, 0.01], driverRightElbow, driverMaterial, 0.055),
    makeLimb(driverRightElbow, driverRightHand, driverMaterial, 0.046),
    makeJoint(driverLeftElbow, driverMaterial, 0.057),
    makeJoint(driverRightElbow, driverMaterial, 0.057),
    makeJoint(driverLeftHand, driverMaterial, 0.045, [0.82, 0.7, 1.12]),
    makeJoint(driverRightHand, driverMaterial, 0.045, [0.82, 0.7, 1.12]),
    driverLegs,
  );
  driver.position.set(...VEHICLE_CALIBRATION.driver);
  semanticRig.add(driver);

  const passenger = new Group();
  const passengerMaterial = new MeshStandardMaterial({ color: 0x9c82f4, emissive: 0x29175a, emissiveIntensity: 0.42, metalness: 0.02, roughness: 0.8, transparent: true, opacity: 0.76, depthWrite: false });
  const passengerPelvis = new Mesh(new SphereGeometry(0.2, 22, 16), passengerMaterial);
  passengerPelvis.position.y = 0.04;
  passengerPelvis.scale.set(0.8, 0.82, 0.62);
  const passengerLegs = makeSeatedLegs(passengerMaterial);
  const passengerLean = new Group();
  const passengerSpine = makeLimb([0, 0.1, 0], [0, 0.27, 0], passengerMaterial, 0.13);
  const passengerChest = new Mesh(new SphereGeometry(0.22, 24, 18), passengerMaterial);
  passengerChest.position.y = 0.26;
  passengerChest.scale.set(1, 0.82, 0.68);
  const passengerShoulders = makeLimb([-0.18, 0.31, 0], [0.18, 0.31, 0], passengerMaterial, 0.064);
  const passengerNeck = new Mesh(new CylinderGeometry(0.068, 0.082, 0.1, 14), passengerMaterial);
  passengerNeck.position.y = 0.43;
  const passengerHead = new Mesh(new SphereGeometry(0.16, 24, 18), passengerMaterial);
  passengerHead.position.y = 0.56;
  passengerHead.scale.set(0.9, 1.07, 0.94);
  const passengerWindowElbow: readonly [number, number, number] = [-0.29, 0.22, 0.08];
  const passengerWindowHand: readonly [number, number, number] = [-0.4, 0.34, 0.12];
  const passengerLapElbow: readonly [number, number, number] = [0.2, 0.19, 0.1];
  const passengerLapHand: readonly [number, number, number] = [0.12, 0.1, 0.23];
  passengerLean.add(
    passengerSpine,
    passengerChest,
    passengerShoulders,
    passengerNeck,
    passengerHead,
    makeLimb([-0.17, 0.3, 0.01], passengerWindowElbow, passengerMaterial, 0.054),
    makeLimb(passengerWindowElbow, passengerWindowHand, passengerMaterial, 0.045),
    makeLimb([0.17, 0.3, 0.01], passengerLapElbow, passengerMaterial, 0.054),
    makeLimb(passengerLapElbow, passengerLapHand, passengerMaterial, 0.045),
    makeJoint(passengerWindowElbow, passengerMaterial, 0.055),
    makeJoint(passengerWindowHand, passengerMaterial, 0.044, [0.82, 0.7, 1.12]),
    makeJoint(passengerLapElbow, passengerMaterial, 0.055),
    makeJoint(passengerLapHand, passengerMaterial, 0.044, [0.82, 0.7, 1.12]),
  );
  passenger.add(passengerPelvis, passengerLegs, passengerLean);
  passenger.position.set(...VEHICLE_CALIBRATION.rearRight);
  semanticRig.add(passenger);

  const riskFrameMaterial = new MeshBasicMaterial({ color: CAUSE, wireframe: true, transparent: true, opacity: 0.82, depthWrite: false });
  const riskFrame = new Mesh(new PlaneGeometry(0.86, 0.66, 2, 2), riskFrameMaterial);
  riskFrame.position.set(...VEHICLE_CALIBRATION.rearRightWindow);
  riskFrame.rotation.y = Math.PI / 2;
  riskFrame.visible = false;
  semanticRig.add(riskFrame);

  const dmsHaloMaterial = new MeshBasicMaterial({ color: VERIFY, transparent: true, opacity: 0.72, side: DoubleSide, depthWrite: false, blending: AdditiveBlending });
  const dmsHalo = new Mesh(new RingGeometry(0.25, 0.285, 48), dmsHaloMaterial);
  dmsHalo.position.set(VEHICLE_CALIBRATION.driver[0], 0.4, VEHICLE_CALIBRATION.driver[2] + 0.015);
  dmsHalo.visible = false;
  semanticRig.add(dmsHalo);

  const omsHaloMaterial = new MeshBasicMaterial({ color: CAUSE, transparent: true, opacity: 0.82, side: DoubleSide, depthWrite: false, blending: AdditiveBlending });
  const omsHalo = new Mesh(new RingGeometry(0.3, 0.34, 48), omsHaloMaterial);
  omsHalo.position.set(VEHICLE_CALIBRATION.rearRightWindow[0] + 0.04, 0.52, VEHICLE_CALIBRATION.rearRightWindow[2] + 0.015);
  omsHalo.visible = false;
  semanticRig.add(omsHalo);

  const steeringMaterial = new MeshBasicMaterial({ color: VERIFY, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false });
  const steeringWheel = new Group();
  steeringWheel.name = 'left-hand-drive-steering-wheel';
  const steeringRim = new Mesh(new RingGeometry(0.14, 0.18, 36), steeringMaterial);
  const steeringHorizontal = new Mesh(new BoxGeometry(0.23, 0.018, 0.018), steeringMaterial);
  const steeringVertical = new Mesh(new BoxGeometry(0.018, 0.16, 0.018), steeringMaterial);
  steeringWheel.add(steeringRim, steeringHorizontal, steeringVertical);
  steeringWheel.position.set(VEHICLE_CALIBRATION.driver[0], 0.29, VEHICLE_CALIBRATION.driver[2] + 0.34);
  steeringWheel.rotation.x = -0.16;
  semanticRig.add(steeringWheel);

  const gazeMaterial = new LineBasicMaterial({ color: CAUSE, transparent: true, opacity: 0.9 });
  const gazeGeometry = new (await import('three')).BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
  const gazeLine = new Line(gazeGeometry, gazeMaterial);
  gazeLine.visible = false;
  semanticRig.add(gazeLine);
  stage.add(semanticRig);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/geely.glb`);
  const car = gltf.scene;
  const carMaterials = new Set<MeshStandardMaterial>();
  car.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((material) => {
      const standard = material as MeshStandardMaterial;
      standard.transparent = true;
      if (!standard.emissive || standard.emissive.r + standard.emissive.g + standard.emissive.b < 0.02) {
        standard.color.copy(standard.transparent && standard.opacity < 1 ? SMOKE : GRAPHITE);
        standard.metalness = Math.max(0.3, standard.metalness ?? 0);
        standard.roughness = 0.34;
      }
      carMaterials.add(standard);
    });
  });
  const box = new Box3().setFromObject(car);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const fit = fitModelBounds(
    [size.x, size.y, size.z],
    [center.x, center.y, center.z],
  );
  car.scale.setScalar(fit.scale);
  car.position.set(...fit.position);
  const surfaceY = fit.groundY - TIRE_CLEARANCE;
  drivingWorld.group.position.y = surfaceY - ROAD_SURFACE_LOCAL_Y;
  floor.position.y = surfaceY;
  stageRings.forEach((ring) => { ring.position.y = surfaceY + 0.002; });
  stage.add(car);

  let disposed = false;
  let running = options.running;
  let visible = true;
  let raf = 0;
  let scheduled = false;
  let frame = options.initialFrame;
  let frameSignature = '';
  let bodyOpacity = frame.bodyOpacity;
  let targetOpacity = frame.bodyOpacity;
  let transitionUntil = 0;
  let lastMs = performance.now();
  let lastRenderMs = 0;
  let roadOffset = 0;
  let desiredFov = camera.fov;
  let roadCamera = ['rearChase', 'rearRightChase', 'rearRightReveal', 'rainChase', 'rearWide', 'rearRightFocus'].includes(options.initialFrame.camera);
  const desiredPosition = new Vector3(...initialPose.position);
  const desiredTarget = new Vector3(...initialPose.target);
  const cameraBasePosition = camera.position.clone();
  const cameraBaseTarget = lookTarget.clone();

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    schedule();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement ?? canvas);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
  }, { threshold: 0.02 });
  intersectionObserver.observe(canvas);
  const onVisibilityChange = () => {
    if (!document.hidden) schedule();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  function updateGaze(next: TwinFrame) {
    const start = new Vector3(VEHICLE_CALIBRATION.driver[0], 0.4, VEHICLE_CALIBRATION.driver[2]);
    let end = new Vector3(VEHICLE_CALIBRATION.driver[0], 0.4, 2.45);
    if (next.correlation) {
      end = new Vector3(VEHICLE_CALIBRATION.rearRight[0], 0.4, VEHICLE_CALIBRATION.rearRight[2]);
    } else if (next.gaze === 'warning') {
      end = new Vector3(0.96, 0.3, 1.95);
    } else if (next.gaze === 'urgent') {
      end = new Vector3(1.12, 0.12, 1.62);
    }
    gazeGeometry.setFromPoints([start, end]);
    const passengerFocus = next.camera === 'rearRightReveal' || next.camera === 'rearRightFocus';
    gazeLine.visible = next.gaze !== 'off' && !passengerFocus;
    gazeMaterial.color.copy(next.gaze === 'monitor' ? VERIFY : next.gaze === 'urgent' ? DANGER : CAUSE);
    dmsHalo.visible = (next.gaze !== 'off' || next.correlation) && !passengerFocus;
    dmsHaloMaterial.color.copy(next.gaze === 'urgent' ? DANGER : next.correlation ? CAUSE : VERIFY);
  }

  function applyFrame(next: TwinFrame, immediate = false) {
    const signature = JSON.stringify(next);
    if (signature === frameSignature && !immediate) return;
    const cameraChanged = cameraCutKey(next) !== cameraCutKey(frame);
    frameSignature = signature;
    frame = next;
    const pose = CAMERA_POSES[next.camera];
    desiredTarget.set(...pose.target);
    targetOpacity = next.bodyOpacity;
    const roadView = ['rearChase', 'rearRightChase', 'rearRightReveal', 'rainChase', 'rearWide', 'rearRightFocus'].includes(next.camera);
    roadCamera = roadView;
    const basePosition = new Vector3(...pose.position);
    const boom = roadView ? 1 + next.motionIntensity * 0.1 : 1;
    desiredPosition.copy(desiredTarget).add(basePosition.sub(desiredTarget).multiplyScalar(boom));
    if (roadView) desiredPosition.y += next.motionIntensity * 0.08;
    const occupantFocus = next.camera === 'rearRightReveal' || next.camera === 'rearRightFocus';
    desiredFov = occupantFocus
      ? (compact ? 38 : 31) + next.motionIntensity * 2.5
      : roadView
        ? (compact ? 43 : 35) + next.motionIntensity * 8
        : (compact ? 39 : 31);
    floor.visible = !roadView;
    stageRings.forEach((ring) => { ring.visible = !roadView; });
    drivingWorld.group.visible = roadView;
    drivingWorld.city.visible = roadView && next.environment === 'city';
    drivingWorld.leadVehicle.visible = roadView && next.environment === 'rain-night';
    drivingWorld.roadMaterial.color.set(next.environment === 'rain-night' ? 0x8390a3 : next.environment === 'city' ? 0x768291 : 0x687584);
    distanceFog.color.set(next.environment === 'rain-night' ? 0x030610 : next.environment === 'city' ? 0x0a1020 : 0x080d16);
    distanceFog.density = next.environment === 'rain-night' ? 0.048 : next.environment === 'city' ? 0.028 : 0.032;
    drivingWorld.roadMaterial.opacity = next.environment === 'rain-night' ? 0.9 : 0.96;
    drivingWorld.wetMaterial.opacity = next.environment === 'rain-night' ? 0.1 : 0;
    drivingWorld.laneMaterial.color.copy(next.environment === 'rain-night' ? METAL : VERIFY);
    drivingWorld.laneMaterial.opacity = next.environment === 'rain-night' ? 0.38 : 0.5;
    drivingWorld.gridMaterial.opacity = next.environment === 'city' ? 0.13 : 0.075;
    drivingWorld.reflectorMaterial.color.copy(next.environment === 'city' ? EVA_PURPLE : next.environment === 'rain-night' ? METAL : VERIFY);
    drivingWorld.reflectorMaterial.opacity = next.environment === 'rain-night' ? 0.7 : 0.52;
    drivingWorld.tailLightMaterial.opacity = next.braking ? 1 : 0.58;
    // 只叠加关键人物、窗口与传感器语义；座椅和内饰直接使用 GLB 原有细节。
    semanticRig.visible = next.bodyOpacity < 0.8 || next.omsMarker !== 'off' || ['cabin', 'console', 'driver', 'gaze', 'cause', 'leftFrontHigh', 'rearRightReveal', 'rearRightFocus'].includes(next.camera);
    updateGaze(next);
    const accent = materialColor(next);
    const omsVisible = next.omsMarker !== 'off';
    const dualSensorView = next.correlation && next.camera !== 'rearRightFocus';
    const recoveryWide = next.effect === 'oms-verify' && next.camera === 'rearWide';
    driver.visible = dualSensorView || recoveryWide || ['driver', 'gaze', 'cause', 'assist'].includes(next.camera);
    steeringWheel.visible = driver.visible;
    passenger.visible = omsVisible || next.correlation;
    omsHalo.visible = omsVisible;
    riskFrame.visible = omsVisible;
    omsHaloMaterial.color.copy(next.omsMarker === 'urgent' ? DANGER : next.omsMarker === 'clear' ? VERIFY : CAUSE);
    riskFrameMaterial.color.copy(omsHaloMaterial.color);
    omsHaloMaterial.opacity = next.omsMarker === 'urgent' ? 1 : next.omsMarker === 'clear' ? 0.7 : 0.82;
    riskFrameMaterial.opacity = next.omsMarker === 'urgent' ? 1 : next.omsMarker === 'clear' ? 0.64 : 0.8;
    rim.color.copy(accent);
    driver.rotation.z = next.correlation ? -0.08 : next.effect === 'urgent' ? 0.08 : next.effect === 'care' ? 0.035 : 0;
    driverHead.rotation.x = next.effect === 'urgent' ? 0.24 : next.effect === 'care' ? 0.12 : 0;
    passenger.position.set(...VEHICLE_CALIBRATION.rearRight);
    passenger.rotation.z = 0;
    passengerLean.position.set(
      next.omsMarker === 'urgent' ? -0.3 : next.omsMarker === 'care' ? -0.19 : 0,
      next.omsMarker === 'urgent' ? 0.075 : next.omsMarker === 'care' ? 0.035 : 0,
      0,
    );
    passengerLean.rotation.z = next.omsMarker === 'urgent' ? 0.32 : next.omsMarker === 'care' ? 0.2 : 0;
    passengerHead.rotation.x = next.omsMarker === 'urgent' ? -0.08 : 0;
    // 实时速度每拍都会改变 motionIntensity；只有真正更换机位才重启剧情转场。
    if (cameraChanged && !immediate && !options.reducedMotion) {
      transitionUntil = performance.now() + 1250;
    } else if (immediate || options.reducedMotion) {
      transitionUntil = 0;
    }
    if (immediate || options.reducedMotion) {
      cameraBasePosition.copy(desiredPosition);
      cameraBaseTarget.copy(desiredTarget);
      camera.position.copy(desiredPosition);
      lookTarget.copy(desiredTarget);
      bodyOpacity = targetOpacity;
      camera.fov = desiredFov;
      camera.updateProjectionMatrix();
    }
    schedule();
  }

  function draw(ms: number) {
    scheduled = false;
    if (disposed || !visible || document.hidden) return;
    const transitioning = !options.reducedMotion && ms < transitionUntil;
    const environmentMoving = running && !options.reducedMotion && frame.motionIntensity > 0;
    if (environmentMoving && !transitioning && ms - lastRenderMs < 1000 / 30) {
      schedule();
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (ms - lastMs) / 1000));
    lastMs = ms;
    lastRenderMs = ms;
    const damping = 1 - Math.exp(-dt * (transitioning ? 3.15 : roadCamera ? 2.05 : 5.2));
    cameraBasePosition.lerp(desiredPosition, damping);
    cameraBaseTarget.lerp(desiredTarget, damping);
    const nextFov = MathUtils.lerp(camera.fov, desiredFov, damping);
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    // 起伏只施加到这一帧的观察位置，不写回惯性基座，避免转场期间逐帧累积成抖动。
    camera.position.copy(cameraBasePosition);
    lookTarget.copy(cameraBaseTarget);
    if (environmentMoving && roadCamera) {
      const heave = Math.sin(ms / 820) * 0.018 * frame.motionIntensity;
      const sway = Math.sin(ms / 1370 + 0.7) * 0.009 * frame.motionIntensity;
      camera.position.y += heave;
      camera.position.x += sway;
    }
    camera.lookAt(lookTarget);
    if (environmentMoving && roadCamera) camera.rotateZ(Math.sin(ms / 1540) * 0.0018 * frame.motionIntensity);
    bodyOpacity = MathUtils.lerp(bodyOpacity, targetOpacity, transitioning ? damping : 1);
    carMaterials.forEach((material) => {
      material.opacity = bodyOpacity;
      material.depthWrite = bodyOpacity > 0.62;
    });

    const state = options.liveState();
    floorMaterial.color.set(state.drive.night ? 0x080b11 : 0x0d1219);
    if (environmentMoving) {
      const metersPerSecond = Math.max(0, state.drive.speed) / 3.6;
      roadOffset = (roadOffset + metersPerSecond * dt * 0.88 * frame.motionIntensity) % 3.2;
      drivingWorld.motion.position.z = -roadOffset;
      drivingWorld.city.position.z = -(roadOffset % 3.6);
      if (dmsHalo.visible) dmsHalo.scale.setScalar(1 + Math.sin(ms / 260) * 0.045);
      if (omsHalo.visible) omsHalo.scale.setScalar(1 + Math.sin(ms / 220) * 0.07);
      if (state.drive.leadBrake) rim.color.lerp(DANGER, 0.12);
    }
    renderer.render(scene, camera);
    // 688k 面车型仅在运行期以最高 30 FPS 连续绘制；暂停、隐藏与静态工件立即冻结。
    const cameraSettling = cameraBasePosition.distanceToSquared(desiredPosition) > 0.000004
      || cameraBaseTarget.distanceToSquared(desiredTarget) > 0.000004
      || Math.abs(camera.fov - desiredFov) > 0.002;
    if (transitioning || environmentMoving || cameraSettling) schedule();
  }

  function schedule() {
    if (disposed || scheduled) return;
    scheduled = true;
    raf = requestAnimationFrame(draw);
  }

  resize();
  applyFrame(options.initialFrame, true);
  renderer.render(scene, camera);
  if (running) schedule();

  return {
    setFrame(next) {
      applyFrame(next);
    },
    setRunning(next) {
      running = next;
      if (running) schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disposeObject(stage);
      drivingWorld.roadTexture.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
