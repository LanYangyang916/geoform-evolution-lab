// compareLab.js → 地貌挑战实验室
// 答题引擎：关卡导航 → 观察答题 → 反馈解析 → 对比表 → 进入下一关
import { landforms, landformGroups } from "./data/landforms.js";
import { challenges, challengeCategories, challengeLevels, getChallenge, getLevelCount } from "./data/challenges.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "geoform-challenge-progress-v1";

// ========================= 进度持久化 =========================
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

// ========================= 主入口 =========================
export function initCompareLab(callbacks) {
  const { onGoNotes } = callbacks || {};

  // ---- 状态 ----
  let progress = loadProgress();
  let currentCategory = "river";
  let currentLevel = 1;
  let currentChallenge = null;   // 当前题目对象
  let quizPhase = "pre";         // "pre" | "answered" | "feedback"
  let selectedAnswer = -1;       // 用户选的选项索引
  let hintUsed = false;          // 本关是否已用提示
  let isCorrect = false;

  // ---- 获取当前题目 ----
  function loadCurrentChallenge() {
    currentChallenge = getChallenge(currentCategory, currentLevel);
    quizPhase = "pre";
    selectedAnswer = -1;
    hintUsed = false;
    isCorrect = false;
  }

  // ---- 本关进度 ----
  function getLevelProgress() {
    if (!currentChallenge) return null;
    return progress[currentChallenge.id] || null;
  }

  // ---- 分类总星数 ----
  function getCategoryStars(cat) {
    return challenges
      .filter((c) => c.category === cat)
      .reduce((sum, c) => sum + (progress[c.id]?.stars || 0), 0);
  }

  // ========================= 左栏：关卡导航 =========================
  function renderLevelNav() {
    // 分类切换
    const tabsEl = $("challenge-category-tabs");
    if (tabsEl) {
      tabsEl.innerHTML = Object.entries(challengeCategories).map(([key, cat]) => {
        const stars = getCategoryStars(key);
        const total = getLevelCount(key) * 3;
        const active = key === currentCategory ? " is-active" : "";
        return `<button class="challenge-cat-tab${active}" data-cat="${key}" type="button">
          <span class="challenge-cat-emoji">${cat.icon}</span>
          <span class="challenge-cat-label">${cat.label}</span>
          <span class="challenge-cat-stars">${stars}/${total} ★</span>
        </button>`;
      }).join("");
      tabsEl.querySelectorAll(".challenge-cat-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentCategory = btn.dataset.cat;
          currentLevel = 1;
          loadCurrentChallenge();
          renderAll();
        });
      });
    }

    // 关卡列表
    const listEl = $("challenge-level-list");
    if (listEl) {
      const lfKeys = landformGroups[currentCategory]?.keys || [];
      const totalCount = getLevelCount(currentCategory);

      listEl.innerHTML = challengeLevels.slice(0, totalCount).map((lvl, i) => {
        const lvlNum = i + 1;
        const ch = getChallenge(currentCategory, lvlNum);
        const prog = ch ? progress[ch.id] : null;
        const isCurrent = lvlNum === currentLevel;
        const isCompleted = prog?.completed;
        const stars = prog?.stars || 0;

        let statusClass = "";
        let statusIcon = lvlNum;
        if (isCompleted) { statusClass = " is-completed"; statusIcon = "★"; }
        if (isCurrent) { statusClass += " is-current"; }

        // 关联地貌名
        const names = (ch?.relatedLandforms || []).slice(0, 2)
          .map((k) => landforms[k]?.name || k).join(" · ");

        return `<button class="challenge-level-item${statusClass}" data-level="${lvlNum}" type="button">
          <span class="challenge-level-num">${statusIcon}</span>
          <span class="challenge-level-info">
            <span class="challenge-level-type">${lvl.emoji} ${lvl.label}</span>
            <span class="challenge-level-landforms">${names}</span>
          </span>
          <span class="challenge-level-stars">${isCompleted ? "★".repeat(stars) + "☆".repeat(3 - stars) : "☆☆☆"}</span>
        </button>`;
      }).join("");

      listEl.querySelectorAll(".challenge-level-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentLevel = parseInt(btn.dataset.level);
          loadCurrentChallenge();
          renderAll();
        });
      });
    }
  }

  // ========================= 中栏：答题主区域 =========================
  function renderQuiz() {
    if (!currentChallenge) {
      const qEl = $("challenge-quiz-area");
      if (qEl) qEl.innerHTML = `<p class="challenge-empty">暂无该关卡题目，请选择其他关卡。</p>`;
      return;
    }

    const ch = currentChallenge;
    const prevProg = getLevelProgress();
    const alreadyDone = prevProg?.completed;

    // 进度条
    const totalLevels = getLevelCount(currentCategory);
    const progressPct = ((currentLevel - 1) / totalLevels) * 100;

    let html = "";
    html += `<div class="challenge-progress-bar"><span class="challenge-progress-fill" style="width:${progressPct}%"></span></div>`;
    html += `<p class="challenge-progress-text">关卡 ${ch.level} / ${totalLevels} · ${ch.title}</p>`;
    html += `<h3 class="challenge-question">${ch.question}</h3>`;

    // 选项
    html += `<div class="challenge-options" id="challenge-options">`;
    ch.options.forEach((opt, i) => {
      let optClass = "challenge-option";
      if (quizPhase === "answered" || quizPhase === "feedback") {
        if (i === ch.correctAnswer) optClass += " is-correct";
        else if (i === selectedAnswer && !isCorrect) optClass += " is-wrong";
        else optClass += " is-dimmed";
      }
      const disabled = (quizPhase === "answered" || quizPhase === "feedback") ? " disabled" : "";
      html += `<button class="${optClass}" data-idx="${i}" type="button"${disabled}>
        <span class="challenge-option-letter">${"ABCD"[i]}</span>
        <span class="challenge-option-text">${esc(opt)}</span>
      </button>`;
    });
    html += `</div>`;

    // 按钮区
    html += `<div class="challenge-actions">`;
    if (quizPhase === "pre") {
      html += `<button class="btn btn-secondary btn-sm" id="btn-use-hint" type="button" title="使用提示后本关最多只能拿2星">💡 使用提示</button>`;
      html += `<button class="btn btn-primary" id="btn-submit" type="button" disabled>提交答案</button>`;
    }
    if (quizPhase === "answered" || quizPhase === "feedback") {
      html += `<button class="btn btn-secondary btn-sm" id="btn-retry" type="button">🔄 再做一次</button>`;
      if (currentLevel < totalLevels) {
        html += `<button class="btn btn-primary" id="btn-next" type="button">进入下一关 →</button>`;
      }
    }
    html += `</div>`;

    // 反馈区
    if (quizPhase === "answered" || quizPhase === "feedback") {
      const lf = landforms[ch.landformKey];
      const lfName = lf?.name || ch.options[ch.correctAnswer];
      const icon = isCorrect ? "✅" : "❌";
      const title = isCorrect ? `回答正确！` : `正确答案是：${lfName}`;
      html += `<div class="challenge-feedback ${isCorrect ? "is-correct" : "is-wrong"}">`;
      html += `<p class="challenge-feedback-title">${icon} ${title}</p>`;
      html += `<p class="challenge-feedback-desc">${ch.explanation}</p>`;

      // 知识点对比表行
      if (ch.landformKey) {
        const cmpLf = landforms[ch.landformKey];
        if (cmpLf?.comparison) {
          const cmp = cmpLf.comparison;
          html += `<div class="challenge-compare-mini">`;
          html += `<p class="challenge-compare-mini-title">📋 知识点</p>`;
          html += `<table class="challenge-kb-table">`;
          if (cmp.type) html += `<tr><td class="ckb-label">类型</td><td>${esc(cmp.type)}</td></tr>`;
          if (cmp.dominantProcess) html += `<tr><td class="ckb-label">主导作用</td><td>${esc(cmp.dominantProcess)}</td></tr>`;
          if (cmp.recognitionCue) html += `<tr><td class="ckb-label">识别特征</td><td>${esc(cmp.recognitionCue)}</td></tr>`;
          html += `</table></div>`;
        }
      }

      // 奖励
      const stars = prevProg?.stars || 0;
      html += `<p class="challenge-reward">获得 ${"★".repeat(stars)}${"☆".repeat(3 - stars)} · ${stars}/3 星</p>`;
      html += `</div>`;
    }

    const qEl = $("challenge-quiz-area");
    if (qEl) qEl.innerHTML = html;

    // 绑定事件
    bindQuizEvents(ch);
  }

  function bindQuizEvents(ch) {
    // 选项点击
    document.querySelectorAll(".challenge-option:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        // 高亮选中
        document.querySelectorAll(".challenge-option").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        selectedAnswer = idx;
        const submitBtn = $("btn-submit");
        if (submitBtn) submitBtn.disabled = false;
      });
    });

    // 提交
    const submitBtn = $("btn-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (selectedAnswer < 0) return;
        isCorrect = selectedAnswer === ch.correctAnswer;
        quizPhase = "feedback";
        // 保存进度
        const prevProg = getLevelProgress();
        let stars = 0;
        if (isCorrect) {
          stars = hintUsed ? Math.max(2, prevProg?.stars || 0) : 3;
        } else {
          stars = prevProg?.stars || 0; // 答错保留已有星数
        }
        progress[ch.id] = {
          completed: isCorrect || (prevProg?.completed || false),
          stars: Math.max(prevProg?.stars || 0, stars),
          hintsUsed: hintUsed,
        };
        saveProgress(progress);
        renderAll();
      });
    }

    // 提示
    const hintBtn = $("btn-use-hint");
    if (hintBtn) {
      hintBtn.addEventListener("click", () => {
        hintUsed = true;
        // 移除两个错误选项（变成2选1）
        const wrongIdx = [];
        ch.options.forEach((_, i) => { if (i !== ch.correctAnswer) wrongIdx.push(i); });
        // 只保留一个错误选项 + 正确答案
        const hideIdx = wrongIdx[Math.floor(Math.random() * wrongIdx.length)];
        const el = document.querySelector(`.challenge-option[data-idx="${hideIdx}"]`);
        if (el) el.style.display = "none";
        hintBtn.disabled = true;
        hintBtn.textContent = "提示已使用";
      });
    }

    // 重试
    const retryBtn = $("btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        quizPhase = "pre";
        selectedAnswer = -1;
        hintUsed = false;
        isCorrect = false;
        renderAll();
      });
    }

    // 下一关
    const nextBtn = $("btn-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const total = getLevelCount(currentCategory);
        if (currentLevel < total) {
          currentLevel++;
        } else {
          // 切换到另一个分类
          currentCategory = currentCategory === "river" ? "karst" : "river";
          currentLevel = 1;
        }
        loadCurrentChallenge();
        renderAll();
      });
    }

    // Hint tooltip
    const hintTipEl = $("challenge-hint-tip");
    if (hintTipEl && ch.hint) {
      hintTipEl.textContent = ch.hint;
    }
  }

  // ========================= 右栏：关卡信息 =========================
  function renderStats() {
    if (!currentChallenge) return;

    const ch = currentChallenge;
    const lf = landforms[ch.landformKey];
    const catInfo = challengeCategories[currentCategory];
    const totalStars = getCategoryStars(currentCategory);
    const totalLevels = getLevelCount(currentCategory);
    const maxStars = totalLevels * 3;
    const completedCount = challenges.filter((c) => c.category === currentCategory && progress[c.id]?.completed).length;

    // 本关目标
    const goalEl = $("challenge-goal");
    if (goalEl) {
      goalEl.innerHTML = `<p class="challenge-goal-text">${challengeLevels[ch.level - 1]?.emoji || ""} 完成"${ch.title}"关卡，识别${lf?.name || ch.options[ch.correctAnswer]}的关键特征与形成机制。</p>`;
    }

    // 当前得分
    const scoreEl = $("challenge-score");
    if (scoreEl) {
      scoreEl.innerHTML = `<span class="challenge-score-stars">${"★".repeat(totalStars)}${"☆".repeat(maxStars - totalStars)}</span>
        <span class="challenge-score-text">${completedCount}/${totalLevels} 关完成 · ${totalStars}/${maxStars} 星</span>`;
    }

    // 观察提示
    const hintEl = $("challenge-hint-tip");
    if (hintEl && ch.hint) {
      hintEl.textContent = ch.hint;
    }

    // 答题解析（仅在答完后显示）
    const explainEl = $("challenge-explain");
    if (explainEl) {
      if (quizPhase === "answered" || quizPhase === "feedback") {
        explainEl.classList.remove("is-locked");
        const prevProg = getLevelProgress();
        explainEl.innerHTML = `
          <p class="challenge-explain-title">📝 答题解析</p>
          <p class="challenge-explain-text">${ch.explanation}</p>
          ${lf ? `<p class="challenge-explain-landform"><strong>关联地貌：</strong>${lf.name} — ${lf.subtitle}</p>` : ""}
          <p class="challenge-explain-stars">本关成绩：${"★".repeat(prevProg?.stars || 0)}${"☆".repeat(3 - (prevProg?.stars || 0))}</p>
        `;
      } else {
        explainEl.classList.add("is-locked");
        explainEl.innerHTML = `
          <span class="challenge-explain-lock">🔒</span>
          <p class="challenge-explain-text">完成作答后解锁解析</p>
        `;
      }
    }

    // 已掌握知识点
    const masteredEl = $("challenge-mastered");
    if (masteredEl) {
      const mastered = challenges
        .filter((c) => c.category === currentCategory && progress[c.id]?.completed)
        .map((c) => landforms[c.landformKey]?.name || c.options[c.correctAnswer]);
      if (mastered.length > 0) {
        masteredEl.innerHTML = `
          <p class="challenge-mastered-title">🏆 已掌握</p>
          <div class="challenge-mastered-tags">${mastered.map((n) => `<span class="challenge-mastered-tag">${esc(n)}</span>`).join("")}</div>
        `;
      } else {
        masteredEl.innerHTML = `
          <p class="challenge-mastered-title">🏆 已掌握</p>
          <p class="challenge-mastered-empty">完成关卡后这里将显示已掌握的地貌。</p>
        `;
      }
    }

    // 记录按钮
    const recordBtn = $("challenge-btn-record");
    if (recordBtn) {
      const prevProg = getLevelProgress();
      recordBtn.style.display = prevProg?.completed ? "" : "none";
    }
  }

  function recordObservation() {
    if (!currentChallenge || !onGoNotes) return;
    const ch = currentChallenge;
    const lf = landforms[ch.landformKey];
    const prevProg = getLevelProgress();
    const ctx = {
      noteType: "challenge",
      landformId: ch.landformKey || "",
      viewMode: "model",
      observationTargetId: null,
      observationTargetName: "",
      title: `挑战：${ch.title} — ${lf?.name || ch.options[ch.correctAnswer]}`,
      observation: `题目：${ch.question}\n\n我的回答：${ch.options[selectedAnswer] || "未作答"}\n\n解析：${ch.explanation}\n\n成绩：${prevProg?.stars || 0}/3 星`,
      question: "",
      _autoCreate: true,
    };
    if (onGoNotes) onGoNotes(ctx);
  }

  // ========================= 全部刷新 =========================
  function renderAll() {
    renderLevelNav();
    renderQuiz();
    renderStats();
  }

  // ========================= 事件绑定 =========================
  function bindEvents() {
    // 记录按钮
    const recordBtn = $("challenge-btn-record");
    if (recordBtn) recordBtn.addEventListener("click", recordObservation);
  }

  // ========================= 初始化 =========================
  function show() {
    loadCurrentChallenge();
    renderAll();
  }

  bindEvents();
  loadCurrentChallenge();
  renderAll();

  return { show, renderAll };
}

// ========================= 工具函数 =========================
function esc(s) {
  if (!s) return "";
  s = String(s);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
