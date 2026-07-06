// ui.js
// 负责所有与 DOM 相关的渲染：左侧菜单、右侧详情、Toast、加载/错误状态、按钮状态、学习进度。
import { landforms, landformOrder, landformGroups, defaultGroup } from "./data/landforms.js";

// 安全获取 DOM，找不到时返回 null（调用处做空值保护）
const $ = (id) => document.getElementById(id);

// ---------- 顶部导航激活态 ----------
export function setNavActive(nav) {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.nav === nav);
  });
}

// 各地貌左侧图标的配色（与视觉系统协调）- 向后兼容
const dotColors = {
  "v-valley": "#7eaec6",
  "alluvial-fan": "#c8a77f",
  "delta": "#9bb28a",
  "oxbow-lake": "#a98bb0",
  "peak-forest": "#7ea67e",
  "karst-cave": "#7e8ba6",
  "sinkhole": "#a69a7e",
  "dune": "#c8a87e",
  "yardang": "#b8a27e",
  "wind-eroded-mushroom": "#a88e6e",
};

// 当前选中的分类 group
let currentGroup = defaultGroup;

// ---------- 渲染分类切换标签 ----------
export function renderCategoryTabs(onGroupChange) {
  const container = $("category-tabs");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(landformGroups).forEach(([groupKey, group]) => {
    const btn = document.createElement("button");
    btn.className = "category-tab";
    btn.dataset.group = groupKey;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", groupKey === currentGroup ? "true" : "false");
    btn.textContent = group.label;
    if (groupKey === currentGroup) btn.classList.add("is-active");
    btn.addEventListener("click", () => {
      if (groupKey === currentGroup) return;
      currentGroup = groupKey;
      // 更新标签激活态
      document.querySelectorAll(".category-tab").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.group === groupKey);
        b.setAttribute("aria-selected", b.dataset.group === groupKey ? "true" : "false");
      });
      // 通知外部切换分类
      if (onGroupChange) onGroupChange(groupKey);
    });
    container.appendChild(btn);
  });
}

// 获取当前分类
export function getCurrentGroup() {
  return currentGroup;
}

// 编程式切换分类
export function setCurrentGroup(groupKey) {
  if (!landformGroups[groupKey]) return;
  currentGroup = groupKey;
  document.querySelectorAll(".category-tab").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.group === groupKey);
    b.setAttribute("aria-selected", b.dataset.group === groupKey ? "true" : "false");
  });
}

// ---------- 渲染左侧地貌列表（按当前分类过滤）----------
export function renderLandformList(onSelect) {
  const list = $("landform-list");
  if (!list) return;
  list.innerHTML = "";

  const group = landformGroups[currentGroup];
  if (!group) return;
  const keys = group.keys;

  keys.forEach((key) => {
    const lf = landforms[key];
    if (!lf) return;
    const li = document.createElement("li");

    const btn = document.createElement("button");
    btn.className = "landform-item";
    btn.dataset.key = key;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.title = `${lf.name} · ${lf.category}`;

    // 缩略图数据
    const thumb = lf.thumbnail || {};
    const thumbColor = thumb.color || dotColors[key] || "#9bb28a";
    const thumbIcon = thumb.icon || lf.name.charAt(0);
    const hasImage = thumb.image && thumb.type === "image";

    let thumbHTML = "";
    if (hasImage) {
      // img + 隐藏占位符（onerror 时切换显示）
      thumbHTML = `<img src="${thumb.image}" alt="${thumb.description || lf.name}" class="lf-thumbnail-img" onerror="this.style.display='none';this.nextElementSibling.style.display='';" />`;
      thumbHTML += `<span class="lf-thumbnail-placeholder" style="display:none;background:${thumbColor}">${thumbIcon}</span>`;
    } else {
      thumbHTML = `<span class="lf-thumbnail-placeholder" style="background:${thumbColor}">${thumbIcon}</span>`;
    }

    btn.innerHTML = `
      <span class="lf-thumbnail">
        ${thumbHTML}
      </span>
      <span class="lf-meta">
        <span class="lf-name">${lf.name}</span>
        <span class="lf-desc">${lf.category}</span>
      </span>
    `;
    btn.addEventListener("click", () => onSelect(key));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

// ---------- 高亮当前选中的菜单项 ----------
export function setActiveMenu(key) {
  const items = document.querySelectorAll(".landform-item");
  items.forEach((item) => {
    const isActive = item.dataset.key === key;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

// ---------- 渲染中间标题区 ----------
export function renderStageHeader(lf) {
  if (!lf) return;
  const name = $("stage-name");
  const en = $("stage-en");
  const sub = $("stage-subtitle");
  if (name) name.textContent = lf.name;
  if (en) en.textContent = lf.englishName;
  if (sub) sub.textContent = lf.subtitle;
  document.title = `${lf.name}｜地球雕刻师`;
}

// ---------- 渲染右侧详情 ----------
export function renderInfo(lf) {
  if (!lf) return;
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  setText("info-type", lf.type);
  setText("info-force", lf.dominantForce);
  setText("info-env", lf.environment);
  setText("info-loc", lf.locations);
  setText("info-hint", lf.hint);

  // 关键特征标签
  const featuresBox = $("info-features");
  if (featuresBox) {
    featuresBox.innerHTML = "";
    lf.features.forEach((f) => {
      const tag = document.createElement("span");
      tag.className = "feature-tag";
      tag.textContent = f;
      featuresBox.appendChild(tag);
    });
  }

  // 形成过程步骤
  const stepsBox = $("info-steps");
  if (stepsBox) {
    stepsBox.innerHTML = "";
    lf.formationSteps.forEach((step, i) => {
      const li = document.createElement("li");
      li.className = "step-item";
      li.innerHTML = `<span class="step-num">${i + 1}</span>${step}`;
      stepsBox.appendChild(li);
    });
  }
}

// ---------- 学习进度 ----------
export function updateProgress(exploredCount) {
  const countEl = $("progress-count");
  const totalEl = $("progress-total");
  const fillEl = $("progress-fill");
  const total = landformOrder.length; // 动态：河流4 + 喀斯特3 + 风力3 = 10
  if (countEl) countEl.textContent = exploredCount;
  if (totalEl) totalEl.textContent = total;
  if (fillEl) fillEl.style.width = `${total > 0 ? (exploredCount / total) * 100 : 0}%`;
}

// ---------- 加载状态 ----------
export function showLoading(text) {
  const overlay = $("loading-overlay");
  const textEl = $("loading-text");
  const errorEl = $("error-overlay");
  if (errorEl) errorEl.hidden = true;
  if (textEl && text) textEl.textContent = text;
  if (overlay) overlay.classList.remove("is-hidden");
}

export function updateLoadingText(text) {
  const textEl = $("loading-text");
  if (textEl && text) textEl.textContent = text;
}

export function hideLoading() {
  const overlay = $("loading-overlay");
  if (overlay) overlay.classList.add("is-hidden");
}

// ---------- 错误状态 ----------
export function showError(message) {
  const overlay = $("loading-overlay");
  const errorEl = $("error-overlay");
  const textEl = $("error-text");
  if (overlay) overlay.classList.add("is-hidden");
  if (textEl && message) textEl.textContent = message;
  if (errorEl) errorEl.hidden = false;
}

export function hideError() {
  const errorEl = $("error-overlay");
  if (errorEl) errorEl.hidden = true;
}

// ---------- Toast ----------
let toastTimer = null;
export function showToast(message, duration = 2400) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  // 触发过渡：下一帧加 class
  requestAnimationFrame(() => toast.classList.add("is-show"));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-show");
    setTimeout(() => {
      toast.hidden = true;
    }, 320);
  }, duration);
}

// ---------- 自动旋转按钮状态 ----------
export function setAutoRotateButton(isOn) {
  const btn = $("btn-autorotate");
  const label = $("autorotate-label");
  if (btn) {
    btn.classList.toggle("is-on", isOn);
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
    btn.title = isOn ? "停止旋转" : "自动旋转模型";
  }
  if (label) label.textContent = isOn ? "停止旋转" : "自动旋转";
}

// ---------- 结构标注按钮状态 ----------
export function setHotspotsButton(isOn) {
  const btn = $("btn-hotspots");
  const label = $("hotspots-label");
  if (btn) {
    btn.classList.toggle("is-on", isOn);
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
    btn.title = isOn ? "隐藏地貌结构标注" : "显示地貌结构标注";
  }
  if (label) label.textContent = isOn ? "隐藏标注" : "显示标注";
}

// ---------- 当前观察构造卡片 ----------
// 点击热点后显示该卡片，置于地貌档案上方；不隐藏原有档案内容。
export function showFocusCard(hotspot) {
  if (!hotspot) return;
  const card = $("focus-card");
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  setText("focus-title", hotspot.title);
  setText("focus-desc", hotspot.description);
  setText("focus-obs", hotspot.observation);
  if (card) {
    card.hidden = false;
    // 用左边框色呼应热点配色
    card.style.borderLeftColor = hotspot.color || "var(--accent-green)";
  }
}

export function hideFocusCard() {
  const card = $("focus-card");
  if (card) card.hidden = true;
}

// ---------- 热点 hover 提示（复用 Toast 区域上方的轻提示）----------
let hotspotTipEl = null;
function ensureHotspotTip() {
  if (hotspotTipEl) return hotspotTipEl;
  const el = document.createElement("div");
  el.className = "hotspot-tip";
  el.setAttribute("role", "status");
  document.body.appendChild(el);
  hotspotTipEl = el;
  return el;
}
export function showHotspotTip(text) {
  const el = ensureHotspotTip();
  el.textContent = text;
  el.classList.add("is-show");
}
export function hideHotspotTip() {
  if (hotspotTipEl) hotspotTipEl.classList.remove("is-show");
}

// ---------- 调试面板 ----------
export function showDebugPanel() {
  const panel = $("debug-panel");
  if (panel) panel.hidden = false;
}
export function setDebugModel(name) {
  const el = $("debug-model");
  if (el) el.textContent = name;
}
export function setDebugCoord(rel) {
  const el = $("debug-coord");
  if (el && Array.isArray(rel)) {
    el.textContent = `relativePosition: [${rel.join(", ")}]`;
  }
}

// ===================== 剖面模式 UI =====================

// ---------- 结构标注按钮状态（剖面版）----------
export function setSectionHotspotsButton(isOn) {
  const btn = $("btn-section-hotspots");
  const label = $("section-hotspots-label");
  if (btn) {
    btn.classList.toggle("is-on", isOn);
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
    btn.title = isOn ? "隐藏剖面标注" : "显示剖面标注";
  }
  if (label) label.textContent = isOn ? "隐藏标注" : "显示标注";
}

// ---------- 当前剖面观察点卡片 ----------
export function showSectionFocusCard(hotspot) {
  if (!hotspot) return;
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  setText("section-focus-title", hotspot.title);
  setText("section-focus-desc", hotspot.description);
  setText("section-focus-obs", hotspot.observation);
  const card = $("section-focus-card");
  const overview = $("section-overview-card");
  if (card) { card.hidden = false; card.style.borderLeftColor = hotspot.color || "var(--accent-green)"; }
  if (overview) overview.hidden = true;
}

export function hideSectionFocusCard() {
  const card = $("section-focus-card");
  if (card) card.hidden = true;
}

// ---------- 剖面整体说明卡片 ----------
export function showSectionOverviewCard(lf) {
  if (!lf || !lf.sectionOverview) return;
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  setText("section-overview-title", lf.sectionOverview.title);
  setText("section-overview-desc", lf.sectionOverview.description);
  setText("section-overview-obs", lf.sectionOverview.observation);
  const card = $("section-overview-card");
  if (card) card.hidden = false;
  // 隐藏焦点卡片，显示概述
  hideSectionFocusCard();
}

export function hideSectionOverviewCard() {
  const card = $("section-overview-card");
  if (card) card.hidden = true;
}

// ---------- 剖面调试面板 ----------
export function showSectionDebugPanel() {
  const panel = $("section-debug-panel");
  if (panel) panel.hidden = false;
}
export function setSectionDebugModel(name) {
  const el = $("section-debug-model");
  if (el) el.textContent = name;
}
export function setSectionDebugCoord(pick) {
  const el = $("section-debug-coord");
  if (el && pick) {
    el.textContent = "x: " + pick.x + " | y: " + pick.y;
  }
}
