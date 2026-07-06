// notesPage.js
// 学习笔记页面渲染与交互：左侧列表/筛选、中间编辑、右侧地貌提示。
// 不引入外部库，不操作 Three.js 场景，仅渲染 DOM 和管理笔记状态。
import { landforms, landformOrder } from "./data/landforms.js";
import * as Store from "./notesStore.js";

const $ = (id) => document.getElementById(id);

// ========================= 便捷支架文本 =========================
const PROMPTS = {
  discovery: "我的发现：\n",
  mechanism: "我认为该地貌形成的主要原因是：\n",
  feature:   "从形态上可以识别出：\n",
  question:  "我还想进一步弄清：\n",
};

// ========================= 主函数 =========================
export function initNotesPage(callbacks) {
  const {
    onBack,               // () => void  返回图鉴馆
    getContext,           // () => { landformId, viewMode, observationTargetId, observationTargetName, hotspotTitle }
    onSaveStateChange,    // (dirty: boolean) => void
  } = callbacks;

  // ---- 内部状态 ----
  let notes = [];           // 当前筛选列表
  let activeId = null;      // 当前编辑的笔记 ID
  let isDirty = false;
  let filterKey = "";       // "" = 全部, 或 landformId
  let supressDirty = false; // 程序化修改表单时不标记 dirty

  // ---- DOM ----
  const listEl = $("notes-list");
  const filterEl = $("notes-filter");
  const editorEl = $("notes-editor");
  const emptyEl = $("notes-empty");
  const emptyNew = $("notes-empty-new");
  const hintRight = $("notes-hint-right");

  // 编辑器字段
  const titleInp = $("note-title");
  const landformSel = $("note-landform");
  const viewModeTxt = $("note-viewmode");
  const obsTargetTxt = $("note-obstarget");
  const observationTa = $("note-observation");
  const questionTa = $("note-question");
  const pinnedLabel = $("note-pinned-label");
  const saveBtn = $("note-save");
  const pinBtn = $("note-pin");
  const deleteBtn = $("note-delete");
  const modifiedEl = $("note-modified");

  // ===================== 刷新 =====================
  function refresh() {
    notes = Store.getSortedNotes(filterKey || undefined);
    if (activeId && !notes.find((n) => n.id === activeId)) {
      activeId = notes.length > 0 ? notes[0].id : null;
    }
    renderList();
    renderFilter();
    if (activeId) loadNoteToEditor(activeId);
    else clearEditor();
  }

  // ===================== 左侧列表 =====================
  function renderList() {
    if (!listEl) return;
    if (notes.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      if (editorEl) editorEl.classList.add("is-empty");
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (editorEl) editorEl.classList.remove("is-empty");

    listEl.innerHTML = notes.map((n) => {
      const lf = landforms[n.landformId];
      const lfName = lf ? lf.name : "—";
      const title = n.title || "未命名观察记录";
      const updated = fmtTime(n.updatedAt);
      const view = n.viewMode === "section" ? "地形剖面" : "模型视图";
      const isActive = n.id === activeId;
      const isCompare = n.noteType === "comparison";
      const compareBadge = isCompare ? ' <span class="cmp-note-badge">对比笔记</span>' : '';
      return `
        <button class="note-card${isActive ? ' is-active' : ''}${n.pinned ? ' is-pinned' : ''}${isCompare ? ' is-compare' : ''}"
                data-id="${n.id}" type="button" title="${esc(title)}">
          <span class="note-card-title">${n.pinned ? '📌 ' : ''}${esc(title)}</span>
          <span class="note-card-meta">${esc(lfName)} · ${view}${compareBadge}</span>
          <span class="note-card-time">${updated}</span>
        </button>`;
    }).join("");

    listEl.querySelectorAll(".note-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (id === activeId) return;
        if (isDirty) {
          if (!confirm("当前笔记尚未保存，是否继续离开？")) return;
        }
        activeId = id;
        loadNoteToEditor(id);
        renderList();
      });
    });
  }

  // ===================== 筛选 =====================
  function renderFilter() {
    if (!filterEl) return;
    const counts = Store.getLandformCounts();
    const total = notes.length;// all notes count
    const allCount = Store.loadNotes().length;

    const items = [
      { key: "", label: "全部笔记", count: allCount },
      ...landformOrder.map((k) => ({ key: k, label: landforms[k]?.name || k, count: counts[k] || 0 })),
    ];

    filterEl.innerHTML = items.map((it) => {
      const isActive = it.key === filterKey;
      return `<button class="notes-filter-item${isActive ? ' is-active' : ''}" data-key="${it.key}" type="button">
        ${esc(it.label)} <span class="notes-filter-count">${it.count}</span>
      </button>`;
    }).join("");

    filterEl.querySelectorAll(".notes-filter-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterKey = btn.dataset.key;
        activeId = null;
        refresh();
      });
    });
  }

  // ===================== 编辑器 =====================
  function loadNoteToEditor(id) {
    const note = Store.loadNotes().find((n) => n.id === id);
    if (!note) { clearEditor(); return; }
    supressDirty = true;
    if (titleInp) titleInp.value = note.title;
    if (landformSel) landformSel.value = note.landformId || "";
    if (viewModeTxt) viewModeTxt.textContent = note.viewMode === "section" ? "地形剖面" : "模型视图";
    if (obsTargetTxt) obsTargetTxt.textContent = note.observationTargetName || "整体观察";
    if (observationTa) observationTa.value = note.observation;
    if (questionTa) questionTa.value = note.question;
    if (pinnedLabel) pinnedLabel.textContent = note.pinned ? "📌 已固定" : "未固定";
    if (modifiedEl) modifiedEl.textContent = "修改时间：" + fmtTime(note.updatedAt);
    if (saveBtn) saveBtn.classList.remove("is-dirty");
    isDirty = false;
    supressDirty = false;
    updateRightHint(note);
    if (onSaveStateChange) onSaveStateChange(false);
  }

  function clearEditor() {
    supressDirty = true;
    if (titleInp) titleInp.value = "";
    if (landformSel) landformSel.value = "";
    if (viewModeTxt) viewModeTxt.textContent = "—";
    if (obsTargetTxt) obsTargetTxt.textContent = "—";
    if (observationTa) observationTa.value = "";
    if (questionTa) questionTa.value = "";
    if (pinnedLabel) pinnedLabel.textContent = "未固定";
    if (modifiedEl) modifiedEl.textContent = "";
    if (saveBtn) saveBtn.classList.remove("is-dirty");
    isDirty = false;
    supressDirty = false;
    updateRightHint(null);
    if (onSaveStateChange) onSaveStateChange(false);
  }

  /** 将当前编辑器内容保存回 note */
  function saveCurrent() {
    if (!activeId) return;
    const patch = {
      title: titleInp?.value?.trim() || "",
      landformId: landformSel?.value || "",
      viewMode: noteViewMode(),
      observationTargetName: obsTargetTxt?.textContent === "整体观察" ? "" : (obsTargetTxt?.textContent || ""),
      observation: observationTa?.value || "",
      question: questionTa?.value || "",
    };
    // viewMode: 本质只能从下拉选
    // 此处保留已有值，由下面 updateNote 合并
    const updated = Store.updateNote(activeId, patch);
    if (updated) {
      isDirty = false;
      if (saveBtn) saveBtn.classList.remove("is-dirty");
      if (pinnedLabel) pinnedLabel.textContent = updated.pinned ? "📌 已固定" : "未固定";
      if (modifiedEl) modifiedEl.textContent = "修改时间：" + fmtTime(updated.updatedAt);
      if (onSaveStateChange) onSaveStateChange(false);
      refresh();
      loadNoteToEditor(activeId);
    }
  }

  function noteViewMode() {
    const txt = viewModeTxt?.textContent || "";
    return txt.includes("剖面") ? "section" : "model";
  }

  function markDirty() {
    if (supressDirty) return;
    if (!isDirty) {
      isDirty = true;
      if (saveBtn) saveBtn.classList.add("is-dirty");
      if (onSaveStateChange) onSaveStateChange(true);
    }
  }

  // ===================== 右侧提示 =====================
  function updateRightHint(note) {
    if (!hintRight) return;
    if (!note || !note.landformId) {
      hintRight.innerHTML = '<p class="notes-hint-empty">选择笔记后，这里会显示关联地貌的提示。</p>';
      return;
    }

    // 对比笔记：展示双地貌提示
    if (note.noteType === "comparison" && note.comparisonLandformIds?.length === 2) {
      const lfA = landforms[note.comparisonLandformIds[0]];
      const lfB = landforms[note.comparisonLandformIds[1]];
      hintRight.innerHTML = `<div class="notes-ref-card">
        <h4>对比笔记：${esc(note.comparisonLandformNames?.[0] || "")} vs ${esc(note.comparisonLandformNames?.[1] || "")}</h4>
        <p class="notes-hint-empty">对比要点：关注主导作用、形成环境和形态特征差异，思考彼此之间的成因区别。</p>
        ${lfA ? `<dl class="notes-ref-dl"><dt>${esc(lfA.name)}</dt><dd>${esc(lfA.comparison?.dominantProcess || lfA.dominantForce || "")}</dd></dl>` : ''}
        ${lfB ? `<dl class="notes-ref-dl"><dt>${esc(lfB.name)}</dt><dd>${esc(lfB.comparison?.dominantProcess || lfB.dominantForce || "")}</dd></dl>` : ''}
      </div>`;
      return;
    }

    const lf = landforms[note.landformId];
    if (!lf) { hintRight.innerHTML = ''; return; }

    let html = `<div class="notes-ref-card">
      <h4>当前关联地貌</h4>
      <p class="notes-ref-name">${esc(lf.name)}</p>
      <dl class="notes-ref-dl">
        <dt>类型</dt><dd>${esc(lf.type)}</dd>
        <dt>关键特征</dt><dd>${(lf.features || []).map(esc).join("、")}</dd>
        <dt>形成提示</dt><dd>${esc(lf.subtitle || "")}</dd>
        <dt>写作提示</dt><dd>${esc(lf.hint || "")}</dd>
      </dl>`;

    if (note.viewMode === "section") {
      html += `<div class="notes-ref-extra"><p>当前观察视图：<strong>地形剖面</strong></p>
        <p>建议关注：高低变化、沉积层、侵蚀位置与内部结构。</p></div>`;
    }

    if (note.observationTargetName) {
      html += `<div class="notes-ref-extra"><p>当前观察点：<strong>${esc(note.observationTargetName)}</strong></p></div>`;
    }

    html += `</div>`;
    hintRight.innerHTML = html;
  }

  // ===================== 公共方法 =====================
  function show() {
    refresh();
    // 若有传入的 context，自动创建草稿
    const ctx = getContext?.();
    if (ctx && ctx._autoCreate) {
      createFromContext(ctx);
      // 只消费一次
      if (getContext) getContext._autoCreate = false;
    }
  }

  function createFromContext(ctx) {
    const note = Store.createNote({
      landformId: ctx.landformId || "",
      viewMode: ctx.viewMode || "model",
      observationTargetId: ctx.observationTargetId || null,
      observationTargetName: ctx.observationTargetName || "",
      noteType: ctx.noteType || "observation",
      comparisonLandformIds: ctx.comparisonLandformIds || null,
      comparisonLandformNames: ctx.comparisonLandformNames || null,
      title: ctx.title || "",
      observation: ctx.observation || "",
      question: ctx.question || "",
    });
    filterKey = "";
    activeId = note.id;
    refresh();
  }

  // 从图鉴馆进入：创建关联笔记
  function openNewNote(context) {
    filterKey = "";
    const note = Store.createNote(context);
    activeId = note.id;
    refresh();
  }

  /** 当前笔记是否未保存 */
  function getIsDirty() { return isDirty; }

  // ===================== 事件绑定 =====================
  function bindEvents() {
    // 新建按钮
    const btnNew = $("btn-note-new");
    if (btnNew) btnNew.addEventListener("click", () => {
      if (isDirty && !confirm("当前笔记尚未保存，是否继续新建？")) return;
      const ctx = getContext?.() || {};
      openNewNote({ landformId: ctx.landformId || "", viewMode: "model" });
    });

    // 返回图鉴馆
    const btnBack = $("btn-notes-back");
    if (btnBack) btnBack.addEventListener("click", () => {
      if (isDirty && !confirm("当前笔记尚未保存，是否继续离开？")) return;
      if (onBack) onBack();
    });

    // 编辑器字段 → mark dirty
    [titleInp, observationTa, questionTa].forEach((el) => {
      if (el) el.addEventListener("input", markDirty);
    });
    if (landformSel) {
      landformSel.addEventListener("change", () => {
        markDirty();
        // 实时更新右侧提示
        const note = Store.loadNotes().find((n) => n.id === activeId) || {};
        note.landformId = landformSel.value;
        updateRightHint(note);
      });
    }

    // viewMode 切换
    const vmBtns = document.querySelectorAll("[data-note-viewmode]");
    vmBtns.forEach((b) => b.addEventListener("click", () => {
      if (viewModeTxt) viewModeTxt.textContent = b.dataset.noteViewmode === "section" ? "地形剖面" : "模型视图";
      markDirty();
    }));

    // 快捷学习支架
    document.querySelectorAll("[data-prompt]").forEach((b) => {
      b.addEventListener("click", () => {
        const key = b.dataset.prompt;
        const text = PROMPTS[key] || "";
        const ta = (key === "question") ? questionTa : observationTa;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
        markDirty();
      });
    });

    // 保存
    if (saveBtn) saveBtn.addEventListener("click", saveCurrent);

    // 固定
    if (pinBtn) pinBtn.addEventListener("click", () => {
      if (!activeId) return;
      Store.togglePinned(activeId);
      refresh();
      loadNoteToEditor(activeId);
    });

    // 删除
    if (deleteBtn) deleteBtn.addEventListener("click", () => {
      if (!activeId) return;
      if (!confirm("确定要删除这条笔记吗？此操作不可恢复。")) return;
      Store.deleteNote(activeId);
      isDirty = false;
      // 选下一条
      const remaining = Store.getSortedNotes(filterKey || undefined);
      activeId = remaining.length > 0 ? remaining[0].id : null;
      refresh();
    });

    // 地貌下拉：动态渲染选项
    if (landformSel) {
      landformSel.innerHTML = '<option value="">— 选择地貌 —</option>' +
        landformOrder.map((k) => `<option value="${k}">${esc(landforms[k]?.name || k)}</option>`).join("");
    }
  }

  bindEvents();
  refresh();

  return { show, openNewNote, getIsDirty, refresh };
}

// ===================== 工具函数 =====================
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

function esc(s) {
  if (!s) return "";
  s = String(s);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
