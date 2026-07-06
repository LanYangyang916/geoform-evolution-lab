// scene.js
// 负责 Three.js 场景的搭建：渲染器、CSS2D 标签渲染器、相机、灯光、地面投影、
// OrbitControls、相机平滑补间、resize、渲染循环与逐帧回调。
// 不关心具体模型加载（交给 modelLoader.js），也不关心热点（交给 hotspotSystem.js）。
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

export function createScene(canvas, container) {
  // ---------- WebGL 渲染器 ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // 透明背景，露出 CSS 浅米白渐变
    preserveDrawingBuffer: true, // 允许截图导出 PNG
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // 使用 LinearToneMapping — 更适合展示 GLB 模型的原始材质色彩，
  // ACESFilmicToneMapping 的 S 曲线会在部分 GPU 上不定时压暗 PBR 材质。
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;

  // ---------- CSS2D 标签渲染器（覆盖在 canvas 之上，用于热点 HTML 标签）----------
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "css2d-layer";
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none"; // 默认不拦截，单个标签按需开启
  container.appendChild(labelRenderer.domElement);

  // ---------- 场景 ----------
  const scene = new THREE.Scene();
  scene.background = null; // 不使用黑色天空盒

  // ---------- 相机（透视）----------
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.set(4, 3, 6);

  // ---------- 灯光 ----------
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe7dfd2, 0.5);
  scene.add(hemi);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(5, 8, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -12;
  dirLight.shadow.camera.right = 12;
  dirLight.shadow.camera.top = 12;
  dirLight.shadow.camera.bottom = -12;
  dirLight.shadow.bias = -0.0004;
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(-6, 4, -4);
  scene.add(fillLight);

  // ---------- 地面（仅接收阴影）----------
  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.16 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- 控制器 ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.0;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.autoRotateSpeed = 1.6;
  controls.target.set(0, 0, 0);

  // ========================================================================
  // 相机平滑补间：在渲染循环中以缓动插值移动相机位置与 target。
  // 用户一旦手动拖动（controls 'start' 事件）即中断当前补间。
  // ========================================================================
  const tween = {
    active: false,
    startTime: 0,
    duration: 800,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  };

  // 缓动函数（easeInOutCubic）
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function flyCameraTo(toPos, toTarget, duration = 800) {
    tween.active = true;
    tween.startTime = performance.now();
    tween.duration = duration;
    tween.fromPos.copy(camera.position);
    tween.toPos.copy(toPos);
    tween.fromTarget.copy(controls.target);
    tween.toTarget.copy(toTarget);
  }

  function cancelCameraTween() {
    tween.active = false;
  }

  // 用户开始手动操作时，中断相机补间，避免“抢镜头”
  controls.addEventListener("start", cancelCameraTween);

  function updateTween(now) {
    if (!tween.active) return;
    const t = Math.min((now - tween.startTime) / tween.duration, 1);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    if (t >= 1) tween.active = false;
  }

  // ---------- 逐帧回调注册（供热点呼吸动画等使用）----------
  const frameCallbacks = new Set();
  function onFrame(cb) {
    frameCallbacks.add(cb);
    return () => frameCallbacks.delete(cb);
  }

  // ---------- resize：使用 getBoundingClientRect 读取容器真实像素尺寸 ----------
  function resize() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  // 保留 window.resize 兜底（全屏切换、移动端地址栏显示/隐藏等）
  window.addEventListener("resize", resize);

  // ---------- 渲染循环 ----------
  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    updateTween(now);
    controls.update();
    // 逐帧回调（热点呼吸、标签朝向等）
    frameCallbacks.forEach((cb) => cb(dt, now));

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  animate();

  return {
    renderer,
    labelRenderer,
    scene,
    camera,
    controls,
    ground,
    resize,
    flyCameraTo,
    cancelCameraTween,
    onFrame,
  };
}
