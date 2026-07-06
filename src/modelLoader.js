// modelLoader.js
// 负责 GLB 模型加载、旧模型销毁（dispose）、归一化缩放、居中、相机自动适配。
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// 目标显示尺寸：所有模型归一化后最长边约为该值，保证不同模型显示尺度相近
const TARGET_SIZE = 4;

// ===== BUILD MARKER: MODEL_DEBUG_BUILD_20260706_01 =====
console.log("[modelLoader] BUILD=MODEL_DEBUG_BUILD_20260706_01 | tone=Linear | dispose=safe | loadId=on");

export function createModelLoader(ctx) {
  const { scene, camera, controls, renderer, ground } = ctx;
  const loader = new GLTFLoader();

  let currentModel = null; // 当前模型根对象
  let currentBox = new THREE.Box3(); // 当前模型归一化后的世界包围盒
  let loadId = 0; // 加载版本号：防止过期回调覆盖当前场景

  // 默认相机机位（由 fitCameraToModel 计算后写入，供重置视角使用）
  let defaultCamPos = new THREE.Vector3(4, 3, 6);
  let defaultTarget = new THREE.Vector3(0, 0, 0);

  // ---------- 安全释放旧模型 ----------
  // mat.dispose() 内部已负责释放所有关联贴图；不再额外手动遍历材质属性，
  // 避免同一纹理被 double-dispose 导致 WebGL 管道脏写（表现为模型材质变灰）。
  function disposeModel(model) {
    if (!model) return;
    model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat && typeof mat.dispose === "function") mat.dispose();
        });
      }
    });
    scene.remove(model);
  }

  // ---------- 归一化 + 居中：让模型最长边为 TARGET_SIZE，并把底部贴近 y=0 ----------
  function normalizeModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = TARGET_SIZE / maxDim;
    model.scale.setScalar(scale);

    // 重新计算缩放后的包围盒，使模型水平居中、底部落在地面 y=0
    const box2 = new THREE.Box3().setFromObject(model);
    const center2 = box2.getCenter(new THREE.Vector3());
    model.position.x -= center2.x;
    model.position.z -= center2.z;
    model.position.y -= box2.min.y;
    return model;
  }

  // ---------- 根据模型尺寸自动适配相机距离 ----------
  function fitCameraToModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;
    // 计算让模型完整入镜所需距离，并留出余量
    let dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    dist = Math.max(dist, controls.minDistance + 0.5);

    // 以略带俯视的方位观察
    const dir = new THREE.Vector3(0.7, 0.55, 1).normalize();
    defaultTarget = center.clone();
    defaultCamPos = center.clone().add(dir.multiplyScalar(dist));

    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultTarget);
    // 地面跟随模型底部
    ground.position.y = box.min.y;
    controls.update();
  }

  // ---------- 设置模型阴影属性 + 打印材质诊断 ----------
  function prepareModel(model) {
    let meshCount = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        meshCount++;
        // 材质诊断日志
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const type = mat ? mat.type : "null";
        const hasMap = !!(mat && mat.map);
        const hasColor = !!(mat && mat.color);
        const colorHex = (hasColor && mat.color.getHex) ? "#" + mat.color.getHex().toString(16).padStart(6, "0") : "N/A";
        console.log(
          `  [mat-diag] mesh="${child.name || "(unnamed)"}" type=${type} color=${colorHex} map=${hasMap}`,
          hasMap ? mat.map.source?.data ? `(data present)` : `(no data)` : ""
        );
      }
    });
    console.log(`[modelLoader] model has ${meshCount} meshes`);
  }

  // ---------- 加载指定模型 ----------
  // onProgress(percent|null)、返回 Promise
  function load(modelPath, { onProgress } = {}) {
    // 递增版本号，使正在进行的旧加载过期
    const myId = ++loadId;

    return new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf) => {
          // 过期回调直接丢弃
          if (myId !== loadId) {
            console.warn(`[modelLoader] 忽略过期回调 (id=${myId}, current=${loadId})`);
            return;
          }

          // 先销毁旧模型
          if (currentModel) {
            disposeModel(currentModel);
            currentModel = null;
            // 强制 GPU 刷新，确保旧资源完全释放
            renderer.render(scene, camera);
          }

          const model = gltf.scene;
          normalizeModel(model);
          prepareModel(model);
          scene.add(model);
          currentModel = model;

          fitCameraToModel(model);
          currentBox = new THREE.Box3().setFromObject(model);

          // 再渲染一帧，确保新模型的所有材质/贴图提交到 GPU
          renderer.render(scene, camera);

          resolve(model);
        },
        (xhr) => {
          if (onProgress) {
            const percent = xhr.total ? Math.round((xhr.loaded / xhr.total) * 100) : null;
            onProgress(percent);
          }
        },
        (err) => {
          console.error(`[modelLoader] GLB 加载失败: ${modelPath}`, err);
          reject(err);
        }
      );
    });
  }

  // ---------- 重置视角：相机、target、模型旋转 ----------
  function resetView() {
    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultTarget);
    if (currentModel) currentModel.rotation.set(0, 0, 0);
    controls.update();
  }

  return {
    load,
    resetView,
    getCurrentModel: () => currentModel,
    // 当前模型归一化后的世界包围盒（克隆，避免外部改动内部状态）
    getCurrentBox: () => currentBox.clone(),
    // 默认机位/目标，供热点系统“返回整体观察”时复用
    getDefaultCamera: () => ({ position: defaultCamPos.clone(), target: defaultTarget.clone() }),
    // 把模型包围盒相对坐标 [x,y,z]（0~1）换算为真实世界坐标
    relativeToWorld: (rel) => {
      const min = currentBox.min;
      const size = currentBox.getSize(new THREE.Vector3());
      return new THREE.Vector3(
        min.x + size.x * rel[0],
        min.y + size.y * rel[1],
        min.z + size.z * rel[2]
      );
    },
    // 把世界坐标换算为相对坐标（调试模式拾取用）
    worldToRelative: (world) => {
      const min = currentBox.min;
      const size = currentBox.getSize(new THREE.Vector3());
      return [
        size.x ? (world.x - min.x) / size.x : 0,
        size.y ? (world.y - min.y) / size.y : 0,
        size.z ? (world.z - min.z) / size.z : 0,
      ];
    },
  };
}
