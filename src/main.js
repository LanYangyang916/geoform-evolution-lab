// main.js
// 应用入口：初始化场景、绑定所有交互、管理状态（当前地貌、已探索集合、自动旋转、热点、观察模式）。
import * as THREE from "three";
import { createScene } from "./scene.js";
import { createModelLoader } from "./modelLoader.js";
import { createHotspotSystem } from "./hotspotSystem.js";
import { createSectionViewer } from "./sectionViewer.js";
import { initNotesPage } from "./notesPage.js";
import { initCompareLab } from "./compareLab.js";
import * as UI from "./ui.js";
import { landforms, defaultKey, landformGroups, defaultGroup } from "./data/landforms.js";

// 是否开启调试模式
const DEBUG_HOTSPOTS = new URLSearchParams(location.search).get("debugHotspots") === "1";
const DEBUG_SECTION = new URLSearchParams(location.search).get("debugSection") === "1";

// ---------- 状态 ----------
const state = {
  currentKey: null,
  explored: new Set(), // 已探索的地貌 key
  autoRotate: false,
  isLoading: false,
  viewMode: "model", // "model" | "section"
  activePage: "gallery", // "gallery" | "notes"
  _autoCreateNote: false, // "记录观察"按钮触发时的标记
};

// ---------- 初始化 Three.js ----------
const canvas = document.getElementById("three-canvas");
const canvasWrap = document.getElementById("canvas-wrap");

let ctx = null;
let modelLoader = null;
let hotspotSystem = null;
let sectionViewer = null;
let notesPage = null;
let compareLab = null;

if (canvas && canvasWrap) {
  ctx = createScene(canvas, canvasWrap);
  modelLoader = createModelLoader(ctx);
  // 热点系统：激活/返回时联动右侧 UI
  hotspotSystem = createHotspotSystem(ctx, modelLoader, {
    onActivate: (hotspot) => {
      lastActiveTitle3D = hotspot.title || "";
      UI.showFocusCard(hotspot);
    },
    onDeactivate: () => {
      lastActiveTitle3D = "";
      UI.hideFocusCard();
    },
    onHover: (hotspot) => {
      // hover 时给出"点击查看"提示（仅在标注可见时）
      if (hotspot) UI.showHotspotTip(`点击查看"${hotspot.title}"的形成作用`);
      else UI.hideHotspotTip();
    },
  });
  // 剖面查看器：激活/返回时联动右侧 UI
  let lastActiveTitle3D = "";
  let lastActiveTitleSection = "";
  let lastLfForSection = null;
  sectionViewer = createSectionViewer({
    onActivate: (hotspot) => {
      lastActiveTitleSection = hotspot.title || "";
      UI.showSectionFocusCard(hotspot);
    },
    onDeactivate: () => {
      lastActiveTitleSection = "";
      UI.hideSectionFocusCard();
      // 返回整体剖面说明
      if (lastLfForSection) UI.showSectionOverviewCard(lastLfForSection);
    },
    onLoad: (lf) => {
      lastLfForSection = lf;
      // 加载完成后显示剖面整体说明
      UI.showSectionOverviewCard(lf);
    },
    getLandform: (key) => landforms[key],
  });
  // 学习笔记页面
  notesPage = initNotesPage({
    onBack: () => showGalleryPage(),
    getContext: () => {
      // 对比笔记上下文优先
      if (state._compareNoteCtx) return state._compareNoteCtx;
      return {
        landformId: state.currentKey || "",
        viewMode: state.viewMode,
        observationTargetId: hotspotSystem?.getActiveId() || sectionViewer?.getActiveId() || null,
        observationTargetName: sectionViewer?.getActiveId() ? lastActiveTitleSection : lastActiveTitle3D,
        _autoCreate: state._autoCreateNote || false,
      };
    },
    onSaveStateChange: () => {},
  });
  // 对比实验室
  compareLab = initCompareLab({
    onGoNotes: (ctx) => {
      // 设置对比笔记上下文，跳转到学习笔记
      state._compareNoteCtx = ctx;
      showNotesPage(true);
      state._compareNoteCtx = null;
    },
  });
} else {
  console.warn("未找到画布元素，3D 功能不可用。");
}

// ---------- 切换地貌 ----------
async function selectLandform(key) {
  const lf = landforms[key];
  if (!lf || !modelLoader) return;
  if (state.isLoading) return; // 加载中忽略重复点击

  state.currentKey = key;

  // 切换前清理旧热点 + 复位焦点 UI
  if (hotspotSystem) hotspotSystem.clear();
  UI.hideFocusCard();
  UI.hideHotspotTip();

  // 立即更新菜单高亮与文字信息（提升响应感）
  UI.setActiveMenu(key);
  UI.renderStageHeader(lf);
  UI.renderInfo(lf);

  // 显示加载遮罩
  state.isLoading = true;
  UI.showLoading(`正在加载 ${lf.name} 模型…`);

  try {
    await modelLoader.load(lf.modelPath, {
      onProgress: (percent) => {
        if (percent !== null) {
          UI.updateLoadingText(`正在加载 ${lf.name} 模型… ${percent}%`);
        }
      },
    });

    // 模型加载完成后构建热点（包围盒已就绪）
    if (hotspotSystem) {
      hotspotSystem.build(lf.hotspots || []);
      // 保持当前标注显示状态一致
      hotspotSystem.setLabelsVisible(hotspotSystem.getLabelsVisible());
      UI.setHotspotsButton(hotspotSystem.getLabelsVisible());
    }

    // 调试模式：更新当前模型名
    if (DEBUG_HOTSPOTS) UI.setDebugModel(lf.name);

    // 记录探索进度
    state.explored.add(key);
    UI.updateProgress(state.explored.size);

    // 如果当前处于剖面模式，同时加载剖面图
    if (sectionViewer && state.viewMode === "section") {
      sectionViewer.load(key, lf);
    }

    UI.hideLoading();
  } catch (err) {
    console.error(`模型加载失败：${lf.modelPath}`, err);
    UI.showError(`模型暂时无法加载，请检查 ${lf.modelPath} 是否存在。`);
  } finally {
    state.isLoading = false;
  }
}

// ---------- 观察模式切换 ----------
function setViewMode(mode) {
  if (mode === state.viewMode) return;
  state.viewMode = mode;

  const threeContainer = document.getElementById("three-container");
  const sectionViewerEl = document.getElementById("section-viewer");
  const modelToolbar = document.getElementById("model-toolbar");
  const sectionToolbar = document.getElementById("section-toolbar");
  const canvasHint = document.querySelector(".canvas-hint");

  if (mode === "section") {
    // 隐藏 3D，显示剖面
    if (threeContainer) threeContainer.style.display = "none";
    if (sectionViewerEl) sectionViewerEl.classList.remove("is-hidden");
    if (modelToolbar) modelToolbar.classList.add("is-hidden");
    if (sectionToolbar) sectionToolbar.classList.remove("is-hidden");
    if (canvasHint) canvasHint.style.display = "none";
    // 停止自动旋转 + 关闭标注
    if (ctx) { state.autoRotate = false; ctx.controls.autoRotate = false; }
    UI.setAutoRotateButton(false);
    if (hotspotSystem) hotspotSystem.setLabelsVisible(false);
    UI.setHotspotsButton(false);
    UI.hideHotspotTip();
    UI.hideFocusCard();
    // 同步剖面工具栏中的标注按钮
    UI.setSectionHotspotsButton(sectionViewer?.getLabelsVisible?.() ?? true);
    // 加载当前地貌剖面
    const lf = landforms[state.currentKey];
    if (sectionViewer && lf) sectionViewer.load(state.currentKey, lf);
    // 高亮底部卡片
    activateScaleCard("profile");
  } else {
    // 显示 3D，隐藏剖面
    if (threeContainer) threeContainer.style.display = "";
    if (sectionViewerEl) sectionViewerEl.classList.add("is-hidden");
    if (modelToolbar) modelToolbar.classList.remove("is-hidden");
    if (sectionToolbar) sectionToolbar.classList.add("is-hidden");
    if (canvasHint) canvasHint.style.display = "";
    if (ctx) ctx.resize();
    // 隐藏剖面相关卡片
    UI.hideSectionFocusCard();
    UI.hideSectionOverviewCard();
    // 高亮底部卡片
    activateScaleCard("model");
  }
}

function activateScaleCard(scale) {
  document.querySelectorAll("[data-scale]").forEach((c) => {
    c.classList.toggle("is-active", c.dataset.scale === scale);
  });
}

// ---------- 页面切换 ----------
function hideAllPages() {
  document.querySelector(".workspace").classList.add("is-hidden");
  const np = document.getElementById("notes-page"); if (np) np.classList.add("is-hidden");
  const cp = document.getElementById("compare-page"); if (cp) cp.classList.add("is-hidden");
}

function setPageAttr(page) {
  const shell = document.querySelector(".app-shell");
  if (shell) shell.setAttribute("data-page", page);
}

function showGalleryPage() {
  state.activePage = "gallery";
  hideAllPages();
  setPageAttr("gallery");
  document.querySelector(".workspace").classList.remove("is-hidden");
  UI.setNavActive("atlas");
  if (ctx) ctx.resize();
}

function showNotesPage(autoCreate = false) {
  state.activePage = "notes";
  state._autoCreateNote = autoCreate;
  hideAllPages();
  setPageAttr("notes");
  const np = document.getElementById("notes-page");
  if (np) np.classList.remove("is-hidden");
  UI.setNavActive("notes");
  if (notesPage) {
    notesPage.show();
    state._autoCreateNote = false;
  }
}

function showComparePage() {
  state.activePage = "compare";
  hideAllPages();
  setPageAttr("compare");
  const cp = document.getElementById("compare-page");
  if (cp) cp.classList.remove("is-hidden");
  UI.setNavActive("compare");
  if (compareLab) compareLab.show();
}

// ---------- 绑定左侧菜单 + 分类切换 ----------
UI.renderCategoryTabs((groupKey) => {
  // 切换分类后：重新渲染该分类下的地貌列表，自动选中第一个
  UI.renderLandformList(selectLandform);
  // 清除当前高亮
  UI.setActiveMenu(null);
  // 选中该分类下第一个地貌
  const firstKey = landformGroups[groupKey]?.keys[0];
  if (firstKey) selectLandform(firstKey);
});
UI.renderLandformList(selectLandform);

// ---------- 构造标注按钮 ----------
const btnHotspots = document.getElementById("btn-hotspots");
if (btnHotspots && hotspotSystem) {
  btnHotspots.addEventListener("click", () => {
    const on = hotspotSystem.toggleLabels();
    UI.setHotspotsButton(on);
    if (!on) UI.hideHotspotTip();
  });
}

// ---------- 返回整体观察按钮 ----------
const btnFocusBack = document.getElementById("btn-focus-back");
if (btnFocusBack && hotspotSystem) {
  btnFocusBack.addEventListener("click", () => {
    hotspotSystem.deactivate(true);
  });
}

// ---------- 底部主按钮 ----------
const btnAutoRotate = document.getElementById("btn-autorotate");
if (btnAutoRotate && ctx) {
  btnAutoRotate.addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    ctx.controls.autoRotate = state.autoRotate;
    UI.setAutoRotateButton(state.autoRotate);
  });
}

const btnReset = document.getElementById("btn-reset");
if (btnReset && modelLoader) {
  btnReset.addEventListener("click", () => {
    // 重置视角同时取消热点激活状态
    if (hotspotSystem && hotspotSystem.getActiveId()) {
      hotspotSystem.deactivate(false); // 不重复飞行，下面 resetView 已复位
    }
    modelLoader.resetView();
    if (ctx) ctx.cancelCameraTween(); // 取消可能正在进行的聚焦补间
    // 重置同时关闭自动旋转，回到默认状态
    if (state.autoRotate) {
      state.autoRotate = false;
      ctx.controls.autoRotate = false;
      UI.setAutoRotateButton(false);
    }
  });
}

// ---------- 剖面工具栏按钮 ----------
const btnSectionHotspots = document.getElementById("btn-section-hotspots");
if (btnSectionHotspots && sectionViewer) {
  btnSectionHotspots.addEventListener("click", () => {
    const on = sectionViewer.toggleLabels();
    UI.setSectionHotspotsButton(on);
  });
}

const btnSectionReset = document.getElementById("btn-section-reset");
if (btnSectionReset && sectionViewer) {
  btnSectionReset.addEventListener("click", () => {
    sectionViewer.resetView();
  });
}

const btnSectionFullscreen = document.getElementById("btn-section-fullscreen");
if (btnSectionFullscreen) {
  btnSectionFullscreen.addEventListener("click", () => {
    const target = canvasWrap;
    if (!document.fullscreenElement) {
      target?.requestFullscreen?.().catch(() => UI.showToast("当前浏览器不支持全屏。"));
    } else {
      document.exitFullscreen?.();
    }
  });
}

const btnSectionScreenshot = document.getElementById("btn-section-screenshot");
if (btnSectionScreenshot && sectionViewer) {
  btnSectionScreenshot.addEventListener("click", () => {
    sectionViewer.takeScreenshot();
    UI.showToast("剖面截图已保存。");
  });
}

// ---------- 剖面返回整体剖面按钮 ----------
const btnSectionFocusBack = document.getElementById("btn-section-focus-back");
if (btnSectionFocusBack && sectionViewer) {
  btnSectionFocusBack.addEventListener("click", () => {
    sectionViewer.deactivate(true);
  });
}

// ---------- "记录观察"按钮 ----------
const btnRecordObs = document.getElementById("btn-record-obs");
if (btnRecordObs) {
  btnRecordObs.addEventListener("click", () => {
    showNotesPage(true);
  });
}

// ---------- Ctrl+S 保存笔记 ----------
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && state.activePage === "notes") {
    e.preventDefault();
    const saveBtn = document.getElementById("note-save");
    if (saveBtn) saveBtn.click();
  }
});

// ---------- 错误重试按钮 ----------
const btnRetry = document.getElementById("error-retry");
if (btnRetry) {
  btnRetry.addEventListener("click", () => {
    UI.hideError();
    if (state.currentKey) selectLandform(state.currentKey);
  });
}

// ---------- 画布右上角工具按钮 ----------
document.querySelectorAll("[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => handleTool(btn.dataset.tool));
});

function handleTool(tool) {
  switch (tool) {
    case "fullscreen": {
      // 让中间画布容器进入/退出全屏
      const target = canvasWrap;
      if (!document.fullscreenElement) {
        target?.requestFullscreen?.().catch(() => UI.showToast("当前浏览器不支持全屏。"));
      } else {
        document.exitFullscreen?.();
      }
      break;
    }
    case "screenshot": {
      takeScreenshot();
      break;
    }
    case "rotate-hint":
      UI.showToast("按住鼠标左键拖拽即可旋转模型。");
      break;
    case "zoom-hint":
      UI.showToast("滚动鼠标滚轮即可放大或缩小。");
      break;
  }
}

// ---------- 截图：导出当前 canvas 为 PNG ----------
// CSS2D 标签是覆盖在 canvas 之上的 HTML，不在 WebGL 缓冲区内，
// 因此不会进入截图、也不会导致导出失败；这里仅导出 3D 画面。
function takeScreenshot() {
  // 剖面模式下委托给 sectionViewer.screenshot
  if (state.viewMode === "section" && sectionViewer) {
    sectionViewer.takeScreenshot();
    UI.showToast("剖面截图已保存。");
    return;
  }
  if (!ctx) return;
  try {
    // 渲染一帧确保缓冲区为最新画面
    ctx.renderer.render(ctx.scene, ctx.camera);
    const dataURL = ctx.renderer.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    const name = state.currentKey ? landforms[state.currentKey].name : "geoform";
    link.download = `${name}-地球雕刻师.png`;
    link.href = dataURL;
    link.click();
    UI.showToast("截图已保存。");
  } catch (err) {
    console.error("截图失败", err);
    UI.showToast("截图失败，请重试。");
  }
}

// 全屏切换后修正画布尺寸
document.addEventListener("fullscreenchange", () => {
  if (ctx) setTimeout(ctx.resize, 60);
});

// ---------- 顶部导航 ----------
document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const nav = btn.dataset.nav;
    if (nav === "atlas") {
      if (state.activePage !== "gallery") showGalleryPage();
      return;
    }
    if (nav === "notes") {
      if (notesPage && notesPage.getIsDirty()) {
        if (!confirm("当前笔记尚未保存，是否继续离开？")) return;
      }
      if (state.activePage !== "notes") showNotesPage(false);
      return;
    }
    if (nav === "compare") {
      if (state.activePage !== "compare") showComparePage();
      return;
    }
    UI.showToast("该模块将在下一版本开放。");
  });
});

// ---------- 底部多尺度观察卡片 ----------
document.querySelectorAll("[data-scale]").forEach((card) => {
  card.addEventListener("click", () => {
    const scale = card.dataset.scale;
    if (scale === "model") {
      if (state.viewMode !== "model") setViewMode("model");
      return;
    }
    if (scale === "profile") {
      if (state.viewMode !== "section") setViewMode("section");
      return;
    }
    // 卫星视角、实景照片仍为"即将接入"
    UI.showToast("该观察模式将在下一版本开放。");
  });
});

// ---------- 窄屏左右栏折叠 ----------
document.querySelectorAll("[data-toggle]").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const side = toggle.dataset.toggle;
    const panel = document.querySelector(`[data-collapsible="${side}"]`);
    if (!panel) return;
    const collapsed = panel.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    // 折叠/展开后修正画布尺寸
    if (ctx) setTimeout(ctx.resize, 60);
  });
});

// ---------- 启动：默认加载 V 型谷 ----------
UI.setAutoRotateButton(false);
UI.setHotspotsButton(false);
UI.updateProgress(0);

// ---------- 热点坐标调试模式 ----------
if (DEBUG_HOTSPOTS && hotspotSystem) {
  let lastRel = null;
  UI.showDebugPanel();
  hotspotSystem.attachDebug((rel) => {
    lastRel = rel;
    UI.setDebugCoord(rel);
  });
  const btnCopy = document.getElementById("debug-copy");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      if (!lastRel) {
        UI.showToast("请先按住 Shift 点击模型表面拾取坐标。");
        return;
      }
      const json = `"relativePosition": [${lastRel.join(", ")}]`;
      try {
        await navigator.clipboard.writeText(json);
        UI.showToast("坐标已复制到剪贴板。");
      } catch {
        UI.showToast(`复制失败，可手动复制：${json}`);
      }
    });
  }
}

// ---------- 剖面坐标调试模式 ----------
if (DEBUG_SECTION && sectionViewer) {
  let lastSectionPick = null;
  UI.showSectionDebugPanel();
  UI.setSectionDebugModel(landforms[defaultKey]?.name || "");
  sectionViewer.attachDebug((pick) => {
    lastSectionPick = pick;
    UI.setSectionDebugCoord(pick);
  });
  const btnSCopy = document.getElementById("section-debug-copy");
  if (btnSCopy) {
    btnSCopy.addEventListener("click", async () => {
      if (!lastSectionPick) {
        UI.showToast("请先点击剖面图拾取坐标。");
        return;
      }
      const json = `{ x: ${lastSectionPick.x}, y: ${lastSectionPick.y} }`;
      try {
        await navigator.clipboard.writeText(json);
        UI.showToast("剖面坐标已复制到剪贴板。");
      } catch {
        UI.showToast("复制失败，可手动复制：" + json);
      }
    });
  }
}

selectLandform(defaultKey);
