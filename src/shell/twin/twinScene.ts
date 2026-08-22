import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
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
  SpotLight,
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
import { fitModelBounds } from './twinState';

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
  rearChase: chasePose(7.45, 1.28, 1.15, -0.1),
  rainChase: chasePose(8.9, 1.55, 1.35, -0.12, 0.45),
  rearWide: chasePose(10.2, 2.62, 1.15, -0.08, -0.9),
  cabin: { position: [4.8, 2.8, 5.2], target: [-0.15, 0.35, 0] },
  console: { position: [2.6, 2.25, 3.7], target: [0.25, 0.48, 0.35] },
  driver: { position: [-3.4, 2.25, 3.8], target: [-0.56, 0.48, 0.48] },
  gaze: { position: [-3.8, 2.15, 4.1], target: [-0.64, 0.46, 0.38] },
  cause: { position: [-3.75, 2.2, 3.85], target: [-0.68, 0.42, 0.36] },
  assist: { position: [-3.35, 2.65, 3.8], target: [-0.62, 0.43, 0.38] },
  verify: { position: [-0.9, 2.55, 4.4], target: [-0.28, 0.38, 0.18] },
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

function makeSeat(): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: SMOKE, metalness: 0.08, roughness: 0.78, transparent: true, opacity: 0.56 });
  const base = new Mesh(new BoxGeometry(0.62, 0.18, 0.72), material);
  base.position.y = 0.05;
  const back = new Mesh(new BoxGeometry(0.62, 0.92, 0.18), material);
  back.position.set(0, 0.52, -0.27);
  back.rotation.x = -0.12;
  const head = new Mesh(new BoxGeometry(0.4, 0.26, 0.16), material);
  head.position.set(0, 1.03, -0.33);
  group.add(base, back, head);
  return group;
}

interface DrivingWorld {
  group: Group;
  city: Group;
  gates: Group;
  leadVehicle: Group;
  roadMaterial: MeshBasicMaterial;
  wetMaterial: MeshBasicMaterial;
  laneMaterial: MeshBasicMaterial;
  gridMaterial: MeshBasicMaterial;
  gateMaterial: MeshBasicMaterial;
  tailLightMaterial: MeshBasicMaterial;
}

/**
 * 以车辆同一世界坐标构建程序化道路，而不是在 Canvas 后方拼一张二维路面。
 * 车、车道、光门和前车因此天然共享相机与消失点，同时保持纯数字孪生风格。
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

  const roadMaterial = new MeshBasicMaterial({
    color: 0x060a10,
    transparent: true,
    opacity: 0.96,
    side: DoubleSide,
  });
  addGroundPlane(group, roadMaterial, 8.6, 52, 0, 12.5, ROAD_SURFACE_LOCAL_Y);

  const wetMaterial = new MeshBasicMaterial({
    color: 0x607da5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  addGroundPlane(group, wetMaterial, 8.3, 51.5, 0, 12.5, ROAD_SURFACE_LOCAL_Y + 0.001);

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
  const shoulderMaterial = new MeshBasicMaterial({
    color: 0x8c6cf2,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: DoubleSide,
  });

  [-4.12, 4.12].forEach((x) => addGroundPlane(group, shoulderMaterial, 0.045, 52, x, 12.5, ROAD_SURFACE_LOCAL_Y + 0.003));
  for (let z = -5.5; z <= 36; z += 3.2) {
    [-1.52, 1.52].forEach((x) => addGroundPlane(group, laneMaterial, 0.075, 1.48, x, z, ROAD_SURFACE_LOCAL_Y + 0.003));
  }
  for (let z = -7; z <= 37; z += 3.8) {
    addGroundPlane(group, gridMaterial, 8.25, 0.025, 0, z, ROAD_SURFACE_LOCAL_Y + 0.002);
  }

  const gates = new Group();
  gates.name = 'depth-gates';
  const gateMaterial = new MeshBasicMaterial({
    color: VERIFY,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  for (let z = 1.8; z <= 31; z += 5.2) {
    addBox(gates, gateMaterial, [0.035, 1.35, 0.035], [-4.45, -0.14, z]);
    addBox(gates, gateMaterial, [0.035, 1.35, 0.035], [4.45, -0.14, z]);
    addBox(gates, gateMaterial, [8.93, 0.035, 0.035], [0, 0.54, z]);
  }
  group.add(gates);

  const city = new Group();
  city.name = 'city-volume';
  const cityPurple = new MeshBasicMaterial({ color: 0x8c6cf2, wireframe: true, transparent: true, opacity: 0.14 });
  const cityCyan = new MeshBasicMaterial({ color: 0x5eead4, wireframe: true, transparent: true, opacity: 0.11 });
  for (let index = 0; index < 18; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const depthIndex = Math.floor(index / 2);
    const height = 1.1 + ((index * 7) % 9) * 0.18;
    const width = 0.65 + ((index * 5) % 4) * 0.13;
    const depth = 0.7 + ((index * 3) % 5) * 0.16;
    const x = side * (5.25 + (depthIndex % 3) * 0.42);
    const z = 2.8 + depthIndex * 3.6;
    addBox(city, index % 3 === 0 ? cityCyan : cityPurple, [width, height, depth], [x, -0.82 + height / 2, z]);
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
    gates,
    leadVehicle,
    roadMaterial,
    wetMaterial,
    laneMaterial,
    gridMaterial,
    gateMaterial,
    tailLightMaterial,
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

  const cabin = new Group();
  // GLB 外壳为长轴 Z、横轴 X；程序化座舱按其真实舱宽/轴距统一校准，避免穿出车门和前挡。
  cabin.scale.set(0.64, 0.82, 1.18);
  cabin.position.set(0, 0.02, -0.12);
  const cabinFloor = new Mesh(
    new PlaneGeometry(3.55, 2.45),
    new MeshStandardMaterial({ color: 0x151d27, transparent: true, opacity: 0.54, side: DoubleSide }),
  );
  cabinFloor.rotation.x = -Math.PI / 2;
  cabinFloor.position.y = -0.55;
  cabin.add(cabinFloor);
  const seatPositions: Array<readonly [number, number, number]> = [
    [-0.82, -0.48, 0.52], [0.82, -0.48, 0.52], [-0.82, -0.48, -0.72], [0.82, -0.48, -0.72],
  ];
  seatPositions.forEach((position) => {
    const seat = makeSeat();
    seat.position.set(...position);
    cabin.add(seat);
  });

  const driver = new Group();
  const driverMaterial = new MeshStandardMaterial({ color: 0x394657, metalness: 0.04, roughness: 0.94, transparent: true, opacity: 0.52 });
  const torso = new Mesh(new CylinderGeometry(0.22, 0.34, 0.62, 18), driverMaterial);
  torso.position.y = 0.12;
  const head = new Mesh(new SphereGeometry(0.2, 24, 18), driverMaterial);
  head.position.y = 0.57;
  driver.add(torso, head);
  driver.position.set(-0.82, 0.02, 0.54);
  cabin.add(driver);

  const gazeMaterial = new LineBasicMaterial({ color: CAUSE, transparent: true, opacity: 0.9 });
  const gazeGeometry = new (await import('three')).BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
  const gazeLine = new Line(gazeGeometry, gazeMaterial);
  gazeLine.visible = false;
  cabin.add(gazeLine);

  const scanMaterial = new MeshBasicMaterial({ color: VERIFY, transparent: true, opacity: 0.05, side: DoubleSide, depthWrite: false, blending: AdditiveBlending });
  const dmsCone = new Mesh(new ConeGeometry(0.44, 1.18, 32, 1, true), scanMaterial);
  dmsCone.position.set(-0.82, 1.18, 0.54);
  dmsCone.rotation.z = Math.PI;
  dmsCone.visible = false;
  cabin.add(dmsCone);
  const dmsSpot = new SpotLight(0x5eead4, 0, 3.2, Math.PI / 6, 0.72, 1.7);
  dmsSpot.position.set(-0.82, 1.62, 0.54);
  dmsSpot.target.position.set(-0.82, 0.12, 0.54);
  cabin.add(dmsSpot, dmsSpot.target);

  stage.add(cabin);

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
  const desiredPosition = new Vector3(...initialPose.position);
  const desiredTarget = new Vector3(...initialPose.target);

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

  function updateGaze(next: TwinFrame) {
    const start = new Vector3(-0.82, 0.61, 0.56);
    let end = new Vector3(-0.82, 0.58, 2.8);
    if (next.gaze === 'warning') end = new Vector3(-1.18, 0.22, 2.15);
    if (next.gaze === 'urgent') end = new Vector3(-1.34, -0.02, 1.78);
    gazeGeometry.setFromPoints([start, end]);
    gazeLine.visible = next.gaze !== 'off';
    gazeMaterial.color.copy(next.gaze === 'monitor' ? VERIFY : next.gaze === 'urgent' ? DANGER : CAUSE);
  }

  function applyFrame(next: TwinFrame, immediate = false) {
    const signature = JSON.stringify(next);
    if (signature === frameSignature && !immediate) return;
    frameSignature = signature;
    frame = next;
    const pose = CAMERA_POSES[next.camera];
    desiredPosition.set(...pose.position);
    desiredTarget.set(...pose.target);
    targetOpacity = next.bodyOpacity;
    const chaseView = ['rearChase', 'rainChase', 'rearWide'].includes(next.camera);
    floor.visible = !chaseView;
    stageRings.forEach((ring) => { ring.visible = !chaseView; });
    drivingWorld.group.visible = chaseView;
    drivingWorld.city.visible = chaseView && next.environment === 'city';
    drivingWorld.gates.visible = chaseView;
    drivingWorld.leadVehicle.visible = chaseView && next.environment === 'rain-night';
    drivingWorld.roadMaterial.color.set(next.environment === 'rain-night' ? 0x03070d : next.environment === 'city' ? 0x080d15 : 0x060a10);
    drivingWorld.roadMaterial.opacity = next.environment === 'rain-night' ? 0.9 : 0.96;
    drivingWorld.wetMaterial.opacity = next.environment === 'rain-night' ? 0.1 : 0;
    drivingWorld.laneMaterial.color.copy(next.environment === 'rain-night' ? METAL : VERIFY);
    drivingWorld.laneMaterial.opacity = next.environment === 'rain-night' ? 0.38 : 0.5;
    drivingWorld.gridMaterial.opacity = next.environment === 'city' ? 0.13 : 0.075;
    drivingWorld.gateMaterial.color.copy(next.environment === 'city' ? EVA_PURPLE : next.environment === 'rain-night' ? METAL : VERIFY);
    drivingWorld.gateMaterial.opacity = next.environment === 'rain-night' ? 0.27 : 0.19;
    drivingWorld.tailLightMaterial.opacity = next.braking ? 1 : 0.58;
    // 外景保持整车完整；驾驶员、座舱和中控镜头才揭示程序化内饰。
    cabin.visible = next.bodyOpacity < 0.8 || ['cabin', 'console', 'driver', 'gaze', 'cause'].includes(next.camera);
    updateGaze(next);
    const accent = materialColor(next);
    const scanning = ['monitoring', 'care', 'urgent'].includes(next.effect);
    dmsCone.visible = scanning;
    scanMaterial.color.copy(accent);
    scanMaterial.opacity = next.effect === 'urgent' ? 0.12 : next.effect === 'care' ? 0.08 : 0.045;
    dmsSpot.color.copy(accent);
    dmsSpot.intensity = scanning ? (next.effect === 'urgent' ? 13 : 7) : 0;
    rim.color.copy(accent);
    driver.rotation.z = next.effect === 'urgent' ? 0.08 : next.effect === 'care' ? 0.035 : 0;
    head.rotation.x = next.effect === 'urgent' ? 0.34 : next.effect === 'care' ? 0.16 : 0;
    transitionUntil = immediate || options.reducedMotion ? 0 : performance.now() + 1250;
    if (immediate || options.reducedMotion) {
      camera.position.copy(desiredPosition);
      lookTarget.copy(desiredTarget);
      bodyOpacity = targetOpacity;
    }
    schedule();
  }

  function draw(ms: number) {
    scheduled = false;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(0.1, Math.max(0, (ms - lastMs) / 1000));
    lastMs = ms;
    const transitioning = !options.reducedMotion && ms < transitionUntil;
    const damping = transitioning ? 1 - Math.exp(-dt * 4.2) : 1;
    camera.position.lerp(desiredPosition, damping);
    lookTarget.lerp(desiredTarget, damping);
    camera.lookAt(lookTarget);
    bodyOpacity = MathUtils.lerp(bodyOpacity, targetOpacity, transitioning ? damping : 1);
    carMaterials.forEach((material) => {
      material.opacity = bodyOpacity;
      material.depthWrite = bodyOpacity > 0.62;
    });

    const state = options.liveState();
    floorMaterial.color.set(state.drive.night ? 0x080b11 : 0x0d1219);
    const motion = running && !options.reducedMotion;
    if (motion) {
      stage.position.y = Math.sin(ms / 1800) * 0.018;
      if (dmsCone.visible) dmsCone.scale.setScalar(1 + Math.sin(ms / 360) * 0.035);
      if (state.drive.leadBrake) rim.color.lerp(DANGER, 0.12);
    }
    renderer.render(scene, camera);
    // 688k 面车型采用事件驱动渲染：镜头转场连续绘制，镜头稳定后冻结，避免 GPU 空转拖慢剧情调度。
    if (transitioning) schedule();
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
      disposeObject(stage);
      environment.dispose();
      renderer.dispose();
    },
  };
}
