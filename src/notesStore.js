// notesStore.js
// 学习笔记本地存储模块。使用 localStorage 持久化，刷新/关闭后数据恢复。
// 存储键名: geoform-learning-notes-v1
// =======================================================

const STORE_KEY = "geoform-learning-notes-v1";

function makeId() {
  return "note_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// ---------- 读取 ----------
export function loadNotes() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("学习笔记数据格式异常，已回退为空。");
      return [];
    }
    return parsed;
  } catch (e) {
    console.warn("学习笔记数据读取失败，已回退为空。", e);
    return [];
  }
}

// ---------- 写入 ----------
function saveNotes(notes) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error("学习笔记保存失败，localStorage 可能已满。", e);
  }
}

// ---------- 创建 ----------
export function createNote(context = {}) {
  const note = {
    id: makeId(),
    landformId: context.landformId || "",
    viewMode: context.viewMode || "model",
    observationTargetId: context.observationTargetId || null,
    observationTargetName: context.observationTargetName || "",
    title: context.title || "",
    observation: context.observation || "",
    question: context.question || "",
    tags: context.tags || [],
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const notes = loadNotes();
  notes.unshift(note);
  saveNotes(notes);
  return note;
}

// ---------- 更新 ----------
export function updateNote(id, patch) {
  const notes = loadNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return null;
  notes[idx] = { ...notes[idx], ...patch, updatedAt: new Date().toISOString() };
  saveNotes(notes);
  return notes[idx];
}

// ---------- 删除 ----------
export function deleteNote(id) {
  const notes = loadNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return false;
  notes.splice(idx, 1);
  saveNotes(notes);
  return true;
}

// ---------- 切换固定 ----------
export function togglePinned(id) {
  const notes = loadNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return null;
  notes[idx].pinned = !notes[idx].pinned;
  notes[idx].updatedAt = new Date().toISOString();
  saveNotes(notes);
  return notes[idx];
}

// ---------- 查询 ----------
export function getNotesByLandform(landformId) {
  const notes = loadNotes();
  if (!landformId) return notes;
  return notes.filter((n) => n.landformId === landformId);
}

// ---------- 排序（固定优先 + 更新时间倒序）----------
export function getSortedNotes(landformId) {
  const notes = getNotesByLandform(landformId);
  return notes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

// ---------- 按地貌统计 ----------
export function getLandformCounts() {
  const notes = loadNotes();
  const counts = {};
  notes.forEach((n) => {
    const key = n.landformId || "_none";
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}
