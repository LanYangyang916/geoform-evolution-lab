// sectionViewer.js
// 地形剖面互动学习模块：
//  三层 DOM：.section-viewer（裁剪窗口）
//    → .section-panzoom-layer（唯一缩放/平移层）
//      → .section-image-frame（= 图片 contain 后的真实像素尺寸，热点百分比坐标参照）
//        → img + .section-hotspot-layer
//
//  热点使用百分比 left/top 定位，随 frame 自动缩放 —— 不再有像素坐标累积误差。
//

const $ = (id) => document.getElementById(id);

const MIN_SCALE = 1;
const MAX_SCALE = 2.5;

export function createSectionViewer(callbacks = {}) {
  const { onActivate, onDeactivate, onLoad, getLandform } = callbacks;

  // =================== DOM ===================
  const viewer      = $("section-viewer");
  const panzoom     = $("section-panzoom-layer");
  const frame       = $("section-image-frame");
  const img         = $("section-image");
  const hotspotLayer= $("section-hotspot-layer");
  const hintEl      = $("section-hint");
  const emptyEl     = $("section-empty");
  const emptyTextEl = $("section-empty-text");

  // =================== 状态 ===================
  const state = {
    scale: 1,
    x: 0,   // panzoom translateX (px)
    y: 0,   // panzoom translateY (px)
    drag: null,
    hotspotsVisible: true,
    activeId: null,
    hoveredId: null,
    loadedKey: null,
    // 图片 contain 后的真实像素尺寸
    frameW: 0,
    frameH: 0,
  };

  let currentHotspots = [];
  let ro = null;    // ResizeObserver for viewer

  // =================== 图片 contain 尺寸计算 ===================
  function getContainedRect() {
    if (!viewer || !img) return { w: 0, h: 0 };
    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return { w: vw, h: vh };
    const imgRatio = iw / ih;
    const boxRatio = vw / vh;
    if (boxRatio > imgRatio) {
      // 容器更宽 → 图片高度撑满
      const h = vh;
      const w = h * imgRatio;
      return { w, h };
    }
    // 容器更窄 → 图片宽度撑满
    const w = vw;
    const h = w / imgRatio;
    return { w, h };
  }

  /** 将 image-frame 宽高设置为 contain 后的真实像素，保持居中 */
  function updateFrameSize() {
    const { w, h } = getContainedRect();
    if (w === 0 || h === 0) return;
    state.frameW = w;
    state.frameH = h;
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
  }

  // =================== 变换 ===================
  function applyTransform() {
    if (!panzoom) return;
    panzoom.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  }

  function clampTransform() {
    if (!viewer) return;
    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    const margin = 80;
    // frame 居中在 panzoom 内，缩放后 frame 等效尺寸 = frameW * scale × frameH * scale
    // frame 左上角在 panzoom 中的位置：(-halfW * scale, -halfH * scale)
    // transform 后该点在 viewer 中的位置：x + (-halfW * scale), y + (-halfH * scale)
    const halfW = (state.frameW * state.scale) / 2;
    const halfH = (state.frameH * state.scale) / 2;
    const cx = vw / 2;
    const cy = vh / 2;
    const frameLeft   = cx + state.x - halfW;
    const frameTop    = cy + state.y - halfH;
    const frameRight  = cx + state.x + halfW;
    const frameBottom = cy + state.y + halfH;

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    // 修正：不把图片完全拖出可视区
    if (frameRight < margin)  state.x += margin - frameRight;
    if (frameLeft > vw - margin) state.x -= frameLeft - vw + margin;
    if (frameBottom < margin) state.y += margin - frameBottom;
    if (frameTop > vh - margin) state.y -= frameTop - vh + margin;
  }

  // =================== 热点：百分比定位，无需像素计算 ===================
  function buildHotspots() {
    if (!hotspotLayer) return;
    hotspotLayer.innerHTML = "";
    currentHotspots.forEach((h) => {
      const btn = document.createElement("button");
      btn.className = "section-hotspot";
      btn.type = "button";
      btn.title = h.title;
      btn.setAttribute("aria-label", h.title);
      btn.dataset.id = h.id;
      // 百分比定位 → 缩放平移自动跟随
      btn.style.left = `${h.x}%`;
      btn.style.top = `${h.y}%`;
      btn.innerHTML = `
        <span class="section-hotspot-pulse" style="background:${h.color || "#9bb28a"}"></span>
        <span class="section-hotspot-dot"  style="background:${h.color || "#9bb28a"}"></span>
        <span class="section-hotspot-label">${h.title}</span>
      `;
      btn.addEventListener("mouseenter", () => {
        if (state.activeId) return;
        state.hoveredId = h.id;
        updateStyles();
      });
      btn.addEventListener("mouseleave", () => {
        state.hoveredId = null;
        updateStyles();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.activeId === h.id) return;
        activateHotspot(h);
      });
      hotspotLayer.appendChild(btn);
    });
    updateStyles();
  }

  function updateStyles() {
    if (!hotspotLayer) return;
    hotspotLayer.querySelectorAll(".section-hotspot").forEach((btn) => {
      const isActive = btn.dataset.id === state.activeId;
      const isHover  = btn.dataset.id === state.hoveredId;
      btn.classList.toggle("is-active", isActive);
      btn.classList.toggle("is-hover", isHover && !state.activeId);
      btn.style.opacity = (state.activeId && !isActive) ? "0.3" : "";
    });
  }

  // =================== 激活热点：放大 + 平移使热点靠近视觉中心 ===================
  function activateHotspot(h) {
    state.activeId = h.id;
    updateStyles();
    if (!viewer) return;
    const oldScale = state.scale;
    const newScale = Math.min(MAX_SCALE, Math.max(oldScale, 1.6));
    const scaleRatio = newScale / oldScale;

    // 热点在 image-frame 内的百分比坐标 → frame 内像素
    const fx = (h.x / 100) * state.frameW;
    const fy = (h.y / 100) * state.frameH;
    // frame 中心在 panzoom 中的位置（因为 CSS 居中）
    // panzoom 左上在 viewer 中的偏移 = (vw/2 + state.x, vh/2 + state.y)
    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    // 热点在 viewer 中的当前像素位置
    const hotVx = vw / 2 + state.x + (fx - state.frameW / 2) * oldScale;
    const hotVy = vh / 2 + state.y + (fy - state.frameH / 2) * oldScale;

    // 以热点为焦点缩放：缩放后热点应在同一屏幕位置
    state.x = hotVx - vw / 2 - (fx - state.frameW / 2) * newScale;
    state.y = hotVy - vh / 2 - (fy - state.frameH / 2) * newScale;
    state.scale = newScale;
    // 再把热点稍稍移向中心
    const hotAfterX = vw / 2 + state.x + (fx - state.frameW / 2) * newScale;
    const hotAfterY = vh / 2 + state.y + (fy - state.frameH / 2) * newScale;
    state.x += (vw / 2 - hotAfterX) * 0.55;
    state.y += (vh / 2 - hotAfterY) * 0.55;

    clampTransform();
    applyTransform();
    if (onActivate) onActivate(h);
  }

  // =================== 返回整体剖面 ===================
  function deactivate(doReset = true) {
    state.activeId = null;
    state.hoveredId = null;
    updateStyles();
    if (doReset) resetView();
    if (onDeactivate) onDeactivate();
  }

  function resetView() {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    state.activeId = null;
    state.hoveredId = null;
    applyTransform();
    updateStyles();
    if (onDeactivate) onDeactivate();
  }

  // =================== 标注 ===================
  function setLabelsVisible(v) {
    state.hotspotsVisible = v;
    if (hotspotLayer) hotspotLayer.style.display = v ? "" : "none";
  }
  function toggleLabels() {
    setLabelsVisible(!state.hotspotsVisible);
    return state.hotspotsVisible;
  }
  function getLabelsVisible() { return state.hotspotsVisible; }

  // =================== 截图 ===================
  function takeScreenshot() {
    const lf = state.loadedKey ? getLandform?.(state.loadedKey) : null;
    const name = lf?.name || "geoform";
    const c = document.createElement("canvas");
    c.width = Math.min(img.naturalWidth, 1920);
    c.height = Math.min(img.naturalHeight, 1440);
    const cx = c.getContext("2d");
    if (img.complete) cx.drawImage(img, 0, 0, c.width, c.height);
    const a = document.createElement("a");
    a.download = `${name}-剖面图.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  }

  // =================== 事件 ===================
  function handleWheel(e) {
    e.preventDefault();
    if (!viewer) return;
    const rect = viewer.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const old = state.scale;
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    const next = clamp(old + delta, MIN_SCALE, MAX_SCALE);
    const ratio = next / old;
    state.x = mx - (mx - state.x) * ratio;
    state.y = my - (my - state.y) * ratio;
    state.scale = next;
    clampTransform();
    applyTransform();
    // 不需要 positionHotspots()
  }

  function handlePointerDown(e) {
    if (e.target.closest(".section-hotspot")) return;
    state.drag = { sx: e.clientX, sy: e.clientY, sX: state.x, sY: state.y };
    if (viewer) viewer.classList.add("is-dragging");
    e.preventDefault();
  }

  function handlePointerMove(e) {
    if (!state.drag) return;
    state.x = state.drag.sX + (e.clientX - state.drag.sx);
    state.y = state.drag.sY + (e.clientY - state.drag.sy);
    clampTransform();
    applyTransform();
  }

  function handlePointerUp() {
    if (!state.drag) return;
    state.drag = null;
    if (viewer) viewer.classList.remove("is-dragging");
  }

  function bindEvents() {
    if (!viewer) return;
    viewer.addEventListener("wheel", handleWheel, { passive: false });
    viewer.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    // ResizeObserver：窗口/全屏变化时重算 frame 尺寸
    ro = new ResizeObserver(() => {
      updateFrameSize();
      applyTransform();
    });
    ro.observe(viewer);
  }

  // =================== 调试 ===================
  function attachDebug(onPick) {
    if (!viewer) return;
    viewer.addEventListener("click", (e) => {
      if (!onPick || !state.frameW || !state.frameH) return;
      const fRect = frame.getBoundingClientRect();
      const fx = (e.clientX - fRect.left) / fRect.width * 100;
      const fy = (e.clientY - fRect.top) / fRect.height * 100;
      if (fx < -5 || fx > 105 || fy < -5 || fy > 105) return;
      onPick({ x: Math.round(fx * 10) / 10, y: Math.round(fy * 10) / 10 });
    });
  }

  // =================== 加载 ===================
  function load(key, lf) {
    if (!img) return;
    state.loadedKey = key;
    state.scale = 1; state.x = 0; state.y = 0;
    state.activeId = null; state.hoveredId = null;
    currentHotspots = [];
    if (hotspotLayer) hotspotLayer.innerHTML = "";

    // 无剖面图数据：清除图片，显示占位提示
    if (!lf?.sectionImage) {
      img.removeAttribute("src");
      img.style.display = "none";
      if (panzoom) panzoom.style.display = "none";
      if (emptyEl) { emptyEl.hidden = false; }
      if (emptyTextEl) emptyTextEl.textContent = lf?.name ? `${lf.name} 剖面图即将接入` : "该地貌剖面图即将接入";
      if (hintEl) hintEl.style.display = "none";
      return;
    }

    // 有剖面图：隐藏占位，显示 panzoom
    if (emptyEl) { emptyEl.hidden = true; }
    if (panzoom) panzoom.style.display = "";
    if (hintEl) hintEl.style.display = "";
    img.style.display = "";
    currentHotspots = lf.sectionHotspots || [];
    img.src = lf.sectionImage;
    img.alt = lf.sectionOverview?.title || lf.name + " 地形剖面";
    img.onload = () => {
      updateFrameSize();
      applyTransform();
      buildHotspots();
      if (onLoad) onLoad(lf);
    };
    img.onerror = () => {
      console.warn("剖面图加载失败：" + lf.sectionImage);
      if (hotspotLayer) hotspotLayer.innerHTML = "";
      img.style.display = "none";
      if (panzoom) panzoom.style.display = "none";
      if (emptyEl) { emptyEl.hidden = false; }
      if (emptyTextEl) emptyTextEl.textContent = lf?.name ? `${lf.name} 剖面图加载失败` : "剖面图加载失败";
      if (hintEl) hintEl.style.display = "none";
    };
  }

  function getActiveId() { return state.activeId; }

  // =================== init ===================
  bindEvents();
  applyTransform();

  return {
    load, resetView, deactivate,
    toggleLabels, setLabelsVisible, getLabelsVisible,
    getActiveId, takeScreenshot, attachDebug,
    getViewerEl: () => viewer,
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
