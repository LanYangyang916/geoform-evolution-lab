// hotspotSystem.js
// 地貌构造热点系统：
//  - 根据 landforms 的 hotspots 数据，在模型包围盒相对坐标处创建 3D 标记 + 呼吸光圈 + CSS2D 标签；
//  - 处理 hover（放大、指针、提示）与 click（激活、相机聚焦、右侧切换）；
//  - “返回整体观察”恢复默认；
//  - 标注显示/隐藏切换；
//  - 调试模式：Shift+点击模型拾取相对坐标。
// 所有热点都挂载在传入的 modelLoader 提供的包围盒坐标系下，模型缩放/居中后不会错位。
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export function createHotspotSystem(ctx, modelLoader, callbacks = {}) {
  const { scene, camera, controls, renderer, onFrame, flyCameraTo } = ctx;
  const {
    onActivate, // (hotspot) => void  激活某热点时通知 UI
    onDeactivate, // () => void        返回整体观察时通知 UI
    onHover, // (hotspot|null) => void hover 状态变化（可显示 tooltip）
  } = callbacks;

  // 热点对象集合，每项：{ data, group, marker, ring, label, baseScale }
  let hotspots = [];
  let activeId = null; // 当前激活热点 id
  let labelsVisible = false; // 标注是否全部显示
  let hoveredId = null;
  let removeFrameCb = null;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // ---------- 创建单个热点的 3D 标记 ----------
  function buildMarker(color) {
    const group = new THREE.Group();

    // 半透明实心小球
    const sphereGeo = new THREE.SphereGeometry(0.08, 24, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthTest: false, // 始终可见，不被模型遮挡
    });
    const marker = new THREE.Mesh(sphereGeo, sphereMat);
    marker.renderOrder = 999;

    // 呼吸光圈（圆环）
    const ringGeo = new THREE.RingGeometry(0.12, 0.16, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.renderOrder = 998;

    group.add(marker);
    group.add(ring);
    return { group, marker, ring };
  }

  // ---------- 创建 CSS2D 标签 ----------
  function buildLabel(data) {
    const el = document.createElement("div");
    el.className = "hotspot-label";
    el.textContent = data.shortTitle || data.title;
    el.style.borderColor = data.color || "var(--accent-green)";
    // 标签默认不拦截鼠标，hover 检测交给 raycaster（更可靠）
    el.style.pointerEvents = "none";
    const obj = new CSS2DObject(el);
    obj.position.set(0, 0.22, 0); // 标签略高于标记
    obj.center.set(0.5, 1);
    return { el, obj };
  }

  // ---------- 构建一组热点（切换模型后调用）----------
  function build(hotspotData = []) {
    clear(); // 先清理旧热点，避免重复
    if (!Array.isArray(hotspotData) || hotspotData.length === 0) return;

    hotspotData.forEach((data) => {
      const color = data.color || "#9bb28a";
      const { group, marker, ring } = buildMarker(color);
      const { el, obj } = buildLabel(data);
      group.add(obj);

      // 相对坐标 → 世界坐标
      const world = modelLoader.relativeToWorld(data.relativePosition);
      group.position.copy(world);
      // 光圈水平放置（朝上），更像“地面光圈”
      ring.rotation.x = -Math.PI / 2;

      scene.add(group);
      hotspots.push({ data, group, marker, ring, labelEl: el, labelObj: obj, baseScale: 1 });
    });

    // 初始可见性：跟随当前 labelsVisible 状态
    applyVisibility();
    updateAppearance();
  }

  // ---------- 彻底清理所有热点（dispose geometry/material + 移除 CSS2D 元素）----------
  function clear() {
    hotspots.forEach((h) => {
      // 移除 CSS2D 标签 DOM
      if (h.labelObj && h.labelObj.element && h.labelObj.element.parentNode) {
        h.labelObj.element.parentNode.removeChild(h.labelObj.element);
      }
      h.group.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material?.dispose();
        }
      });
      scene.remove(h.group);
    });
    hotspots = [];
    activeId = null;
    hoveredId = null;
  }

  // ---------- 应用可见性（标注开关 + 激活态例外）----------
  function applyVisibility() {
    hotspots.forEach((h) => {
      // 隐藏标注时：仅保留当前激活热点可见
      const visible = labelsVisible || h.data.id === activeId;
      h.group.visible = visible;
    });
  }

  // ---------- 根据 hover / active 状态刷新外观 ----------
  function updateAppearance() {
    hotspots.forEach((h) => {
      const isActive = h.data.id === activeId;
      const isHover = h.data.id === hoveredId;
      // 透明度：有激活项时，非激活热点变暗
      let markerOpacity = 0.85;
      let ringOpacity = 0.5;
      if (activeId) {
        if (isActive) {
          markerOpacity = 1;
          ringOpacity = 0.85;
        } else {
          markerOpacity = 0.25;
          ringOpacity = 0.12;
        }
      } else if (isHover) {
        markerOpacity = 1;
        ringOpacity = 0.8;
      }
      h.marker.material.opacity = markerOpacity;
      h.ring.material.opacity = ringOpacity;

      // 标签样式类
      h.labelEl.classList.toggle("is-active", isActive);
      h.labelEl.classList.toggle("is-hover", isHover && !activeId);
    });
  }

  // ---------- 呼吸动画 + 标签朝向（逐帧）----------
  function tick(dt, now) {
    const pulse = 1 + Math.sin(now * 0.0035) * 0.18; // 缓慢呼吸
    hotspots.forEach((h) => {
      // 光圈呼吸缩放
      h.ring.scale.setScalar(pulse);
      // 标记按相机距离做轻微缩放补偿，远近显示更一致
      const dist = camera.position.distanceTo(h.group.position);
      const s = THREE.MathUtils.clamp(dist / 6, 0.6, 1.6);
      const hoverBoost = h.data.id === hoveredId && !activeId ? 1.35 : 1;
      const activeBoost = h.data.id === activeId ? 1.3 : 1;
      h.marker.scale.setScalar(s * hoverBoost * activeBoost);
    });
  }

  // ---------- 命中检测：返回鼠标下的热点（marker）----------
  function pickHotspot(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    // 只检测可见热点的 marker
    const markers = hotspots.filter((h) => h.group.visible).map((h) => h.marker);
    if (markers.length === 0) return null;
    const hits = raycaster.intersectObjects(markers, false);
    if (hits.length === 0) return null;
    return hotspots.find((h) => h.marker === hits[0].object) || null;
  }

  // ---------- hover 处理 ----------
  function handlePointerMove(event) {
    const hit = pickHotspot(event);
    const newId = hit ? hit.data.id : null;
    if (newId !== hoveredId) {
      hoveredId = newId;
      updateAppearance();
      renderer.domElement.style.cursor = hoveredId ? "pointer" : "";
      if (onHover) onHover(hit ? hit.data : null);
    }
  }

  // ---------- click 处理 ----------
  function handleClick(event) {
    // 调试模式下，Shift+点击由 debug 逻辑处理（见 attachDebug），此处忽略
    if (debugEnabled && event.shiftKey) return;
    const hit = pickHotspot(event);
    if (hit) activate(hit.data.id);
  }

  // ---------- 激活某热点 ----------
  function activate(id) {
    const h = hotspots.find((x) => x.data.id === id);
    if (!h) return;
    activeId = id;
    applyVisibility(); // 隐藏标注时也要让激活项可见
    updateAppearance();

    // 相机聚焦：从热点沿当前视线方向后退 focusDistance
    const targetPos = h.group.position.clone();
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = h.data.focusDistance || 2.0;
    const camPos = targetPos.clone().add(dir.multiplyScalar(dist));
    // 略微抬高视点，观察更自然
    camPos.y += dist * 0.25;
    flyCameraTo(camPos, targetPos, 780);

    if (onActivate) onActivate(h.data);
  }

  // ---------- 返回整体观察 ----------
  function deactivate(flyBack = true) {
    activeId = null;
    hoveredId = null;
    applyVisibility();
    updateAppearance();
    renderer.domElement.style.cursor = "";
    if (flyBack) {
      const def = modelLoader.getDefaultCamera();
      flyCameraTo(def.position, def.target, 780);
    }
    if (onDeactivate) onDeactivate();
  }

  // ---------- 标注显示/隐藏切换 ----------
  function setLabelsVisible(visible) {
    labelsVisible = visible;
    applyVisibility();
    updateAppearance();
  }
  function toggleLabels() {
    setLabelsVisible(!labelsVisible);
    return labelsVisible;
  }
  function getLabelsVisible() {
    return labelsVisible;
  }

  // ========================================================================
  // 调试模式：Shift + 点击模型表面，拾取相对坐标
  // ========================================================================
  let debugEnabled = false;
  let debugMarker = null; // 临时红点
  let debugCallback = null; // (relArray) => void

  function attachDebug(onPick) {
    debugEnabled = true;
    debugCallback = onPick;
  }

  function handleDebugClick(event) {
    if (!debugEnabled || !event.shiftKey) return;
    const model = modelLoader.getCurrentModel();
    if (!model) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(model, true);
    if (hits.length === 0) return;

    const world = hits[0].point.clone();
    const rel = modelLoader.worldToRelative(world).map((v) => Math.round(v * 100) / 100);

    // 临时红点提示位置
    if (!debugMarker) {
      const geo = new THREE.SphereGeometry(0.07, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff4d4f, depthTest: false });
      debugMarker = new THREE.Mesh(geo, mat);
      debugMarker.renderOrder = 1000;
      scene.add(debugMarker);
    }
    debugMarker.position.copy(world);

    if (debugCallback) debugCallback(rel);
  }

  // ---------- 事件绑定 ----------
  const dom = renderer.domElement;
  dom.addEventListener("pointermove", handlePointerMove);
  dom.addEventListener("click", handleClick);
  dom.addEventListener("click", handleDebugClick);

  // 注册逐帧动画
  removeFrameCb = onFrame(tick);

  // ---------- 销毁整个系统（页面卸载时调用，正常 SPA 内一般只 clear）----------
  function destroy() {
    clear();
    if (debugMarker) {
      debugMarker.geometry.dispose();
      debugMarker.material.dispose();
      scene.remove(debugMarker);
      debugMarker = null;
    }
    dom.removeEventListener("pointermove", handlePointerMove);
    dom.removeEventListener("click", handleClick);
    dom.removeEventListener("click", handleDebugClick);
    if (removeFrameCb) removeFrameCb();
  }

  return {
    build,
    clear,
    activate,
    deactivate,
    toggleLabels,
    setLabelsVisible,
    getLabelsVisible,
    attachDebug,
    getActiveId: () => activeId,
    destroy,
  };
}



