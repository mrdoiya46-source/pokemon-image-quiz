const REGION_ORDER = [
  "kanto",
  "johto",
  "hoenn",
  "sinnoh",
  "unova",
  "kalos",
  "alola",
  "galar",
  "hisui",
  "paldea"
];

const state = {
  questions: [],
  mode: "fixed",
  region: "all",
  sessionQuestions: [],
  currentIndex: 0,
  correct: 0,
  wrong: 0,
  skipped: 0,
  answered: false,
  lastConfig: null,
  debugMode: false,
  isDebugSession: false,
  debugQuestionId: null,
  isAchievementPreview: false,
  questionCountMode: "auto",
  manualRequestedCount: null,
  sessionAvailableCountAtStart: 0,
  sessionExcludeSolvedAtStart: false
};

const startScreen = document.getElementById("startScreen");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");

const questionCountInput = document.getElementById("questionCountInput");
const questionCountHelp = document.getElementById("questionCountHelp");
const totalQuestionCount = document.getElementById("totalQuestionCount");
const reviewCount = document.getElementById("reviewCount");
const reviewNotice = document.getElementById("reviewNotice");
const regionSelect = document.getElementById("regionSelect");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const startButton = document.getElementById("startButton");

const excludeSolvedBlock = document.getElementById("excludeSolvedBlock");
const excludeSolvedCheckbox = document.getElementById("excludeSolvedCheckbox");
const quickCountButtons = [...document.querySelectorAll(".quick-count-button")];

const debugPanel = document.getElementById("debugPanel");
const debugQuestionInput = document.getElementById("debugQuestionInput");
const debugQuestionList = document.getElementById("debugQuestionList");
const debugStartButton = document.getElementById("debugStartButton");

const debugAchievementRegionA = document.getElementById("debugAchievementRegionA");
const debugAchievementRegionB = document.getElementById("debugAchievementRegionB");
const debugPreviewRegionButton = document.getElementById("debugPreviewRegionButton");
const debugPreviewMultiButton = document.getElementById("debugPreviewMultiButton");
const debugPreviewSecretButton = document.getElementById("debugPreviewSecretButton");
const debugPreviewAllButton = document.getElementById("debugPreviewAllButton");

const modeLabel = document.getElementById("modeLabel");
const progressText = document.getElementById("progressText");
const correctStat = document.getElementById("correctStat");
const wrongStat = document.getElementById("wrongStat");
const questionImage = document.getElementById("questionImage");

const answerPhase = document.getElementById("answerPhase");
const resultPhase = document.getElementById("resultPhase");
const answerInput = document.getElementById("answerInput");
const submitButton = document.getElementById("submitButton");
const skipButton = document.getElementById("skipButton");
const feedbackBox = document.getElementById("feedbackBox");
const nextButton = document.getElementById("nextButton");
const resetSessionBtn = document.getElementById("resetSessionBtn");

const resultCorrect = document.getElementById("resultCorrect");
const resultWrong = document.getElementById("resultWrong");
const resultRate = document.getElementById("resultRate");
const resultReviewCount = document.getElementById("resultReviewCount");
const resultMessage = document.getElementById("resultMessage");
const retrySameModeButton = document.getElementById("retrySameModeButton");
const backToStartButton = document.getElementById("backToStartButton");

const resultDebugNotice = document.getElementById("resultDebugNotice");
const resultDebugText = document.getElementById("resultDebugText");
const achievementArea = document.getElementById("achievementArea");
const secretAchievementBox = document.getElementById("secretAchievementBox");
const regionAchievementBox = document.getElementById("regionAchievementBox");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.debugMode = hasDebugMode();
  await loadQuestions();
  bindEvents();
  setupDebugPanel();
  updateStartSummary();
}

async function loadQuestions() {
  const response = await fetch("questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("questions.json の読み込みに失敗しました。");
  }
  const data = await response.json();
  state.questions = data.filter(q => q.enabled !== false);
}

function hasDebugMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "1";
}

function bindEvents() {
  modeButtons.forEach(button => {
    button.addEventListener("click", () => {
      modeButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.mode = button.dataset.mode;
      updateStartSummary();
    });
  });

  regionSelect.addEventListener("change", () => {
    state.region = regionSelect.value;
    updateStartSummary();
  });

  excludeSolvedCheckbox.addEventListener("change", () => {
    updateStartSummary();
  });

  questionCountInput.addEventListener("input", handleQuestionCountInput);

  quickCountButtons.forEach(button => {
    button.addEventListener("click", () => {
      const raw = button.dataset.count;
      if (raw === "all") {
        state.questionCountMode = "auto";
        state.manualRequestedCount = null;
      } else {
        state.questionCountMode = "manual";
        state.manualRequestedCount = Math.max(1, parseInt(raw, 10) || 1);
      }
      updateStartSummary();
    });
  });

  startButton.addEventListener("click", startSession);
  submitButton.addEventListener("click", submitCurrentAnswer);
  skipButton.addEventListener("click", skipCurrentQuestion);
  nextButton.addEventListener("click", goNextQuestion);
  retrySameModeButton.addEventListener("click", retrySameConfig);
  backToStartButton.addEventListener("click", backToStart);
  resetSessionBtn.addEventListener("click", endSession);

  answerInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();

      if (state.answered) {
        goNextQuestion();
      } else {
        submitCurrentAnswer();
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing) {
      return;
    }
    if (quizScreen.classList.contains("hidden")) {
      return;
    }
    if (!state.answered) {
      return;
    }

    const activeElement = document.activeElement;
    if (
      activeElement === answerInput ||
      activeElement === submitButton ||
      activeElement === skipButton ||
      activeElement === nextButton
    ) {
      return;
    }

    event.preventDefault();
    goNextQuestion();
  });

  if (debugStartButton) {
    debugStartButton.addEventListener("click", event => {
      event.preventDefault();
      startDebugSessionFromInput();
    });
  }

  if (debugQuestionInput) {
    debugQuestionInput.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        startDebugSessionFromInput();
      }
    });
  }

  if (debugPreviewRegionButton) {
    debugPreviewRegionButton.addEventListener("click", event => {
      event.preventDefault();
      openAchievementPreview({
        regions: [debugAchievementRegionA?.value || "kanto"],
        secret: false
      });
    });
  }

  if (debugPreviewMultiButton) {
    debugPreviewMultiButton.addEventListener("click", event => {
      event.preventDefault();
      const regions = collectPreviewRegions(true);
      if (!regions) {
        return;
      }
      openAchievementPreview({
        regions,
        secret: false
      });
    });
  }

  if (debugPreviewSecretButton) {
    debugPreviewSecretButton.addEventListener("click", event => {
      event.preventDefault();
      openAchievementPreview({
        regions: [],
        secret: true
      });
    });
  }

  if (debugPreviewAllButton) {
    debugPreviewAllButton.addEventListener("click", event => {
      event.preventDefault();
      const regions = collectPreviewRegions(false);
      openAchievementPreview({
        regions,
        secret: true
      });
    });
  }
}

function setupDebugPanel() {
  if (!debugPanel) {
    return;
  }

  debugPanel.classList.toggle("hidden", !state.debugMode);

  if (!state.debugMode) {
    return;
  }

  populateDebugQuestionList();
}

function populateDebugQuestionList() {
  if (!debugQuestionList) {
    return;
  }

  debugQuestionList.innerHTML = "";

  state.questions.forEach(question => {
    const option = document.createElement("option");
    option.value = question.id;
    option.label = `${question.answer} / ${getRegionLabel(question.region)}`;
    debugQuestionList.appendChild(option);
  });
}

function collectPreviewRegions(requireSecondRegion) {
  const regionA = debugAchievementRegionA?.value || "";
  const regionB = debugAchievementRegionB?.value || "";

  const regions = [regionA];
  if (regionB) {
    regions.push(regionB);
  }

  const uniqueRegions = [...new Set(regions.filter(Boolean))];

  if (requireSecondRegion && uniqueRegions.length < 2) {
    alert("地方Aと異なる地方Bを選択してください。");
    return null;
  }

  return uniqueRegions;
}

function setResultDebugNotice(visible, text = "表示確認用のプレビューです。記録は変更されません。") {
  if (!resultDebugNotice || !resultDebugText) {
    return;
  }

  resultDebugNotice.classList.toggle("hidden", !visible);
  resultDebugText.textContent = text;
}

function openAchievementPreview({ regions = [], secret = false }) {
  if (!state.debugMode) {
    return;
  }

  state.isAchievementPreview = true;
  state.isDebugSession = false;
  state.debugQuestionId = null;

  showScreen("result");

  resultCorrect.textContent = "—";
  resultWrong.textContent = "—";
  resultRate.textContent = "—";
  resultReviewCount.textContent = "—";

  if (retrySameModeButton) {
    retrySameModeButton.classList.add("hidden");
  }

  setResultDebugNotice(true, "DEBUG表示中：以下は達成メッセージの確認用です。記録は変更されません。");
  renderAchievements(regions, secret);
  resultMessage.textContent = "達成メッセージの表示確認用プレビューです。";
}

function handleQuestionCountInput() {
  const raw = questionCountInput.value.trim();

  if (!raw) {
    state.questionCountMode = "auto";
    state.manualRequestedCount = null;
    updateStartSummary();
    return;
  }

  const number = Math.max(1, parseInt(raw, 10) || 1);
  state.questionCountMode = "manual";
  state.manualRequestedCount = number;
  updateStartSummary();
}

function getCurrentRegion() {
  return regionSelect.value || "all";
}

function isExcludeSolvedEnabled() {
  return state.mode !== "review" && excludeSolvedCheckbox.checked;
}

function updateExcludeSolvedUi() {
  const disabled = state.mode === "review";
  excludeSolvedCheckbox.disabled = disabled;
  excludeSolvedBlock.classList.toggle("disabled", disabled);
}

function matchesRegion(question, region) {
  if (region === "all") {
    return true;
  }
  return question.region === region;
}

function getReviewIdsForRegion(region = getCurrentRegion()) {
  const records = getAllQuestionRecords();

  return state.questions
    .filter(question => {
      const record = records[question.id];
      return Boolean(record?.needsReview) && matchesRegion(question, region);
    })
    .map(question => question.id);
}

function getAvailableQuestions(mode = state.mode, region = getCurrentRegion()) {
  const records = getAllQuestionRecords();

  if (mode === "review") {
    return state.questions.filter(question => {
      const record = records[question.id];
      return Boolean(record?.needsReview) && matchesRegion(question, region);
    });
  }

  return state.questions.filter(question => {
    if (!matchesRegion(question, region)) {
      return false;
    }

    if (!isExcludeSolvedEnabled()) {
      return true;
    }

    const record = records[question.id];
    return (record?.correctCount || 0) < 1;
  });
}

function getEffectiveQuestionCount(availableCount) {
  if (availableCount <= 0) {
    return 0;
  }

  if (state.questionCountMode === "auto") {
    return availableCount;
  }

  const requested = Math.max(1, parseInt(state.manualRequestedCount, 10) || 1);
  return Math.min(requested, availableCount);
}

function syncQuestionCountInput(availableCount) {
  const effectiveCount = getEffectiveQuestionCount(availableCount);
  const nextValue = effectiveCount > 0 ? String(effectiveCount) : "";

  if (questionCountInput.value !== nextValue) {
    questionCountInput.value = nextValue;
  }

  updateQuickCountButtons(availableCount);
}

function updateQuickCountButtons(availableCount) {
  quickCountButtons.forEach(button => {
    const raw = button.dataset.count;
    const isAll = raw === "all";

    button.disabled = availableCount <= 0;

    let isActive = false;
    if (isAll) {
      isActive = state.questionCountMode === "auto";
    } else {
      const count = parseInt(raw, 10);
      isActive = state.questionCountMode === "manual" && state.manualRequestedCount === count;
    }

    button.classList.toggle("active", isActive);
  });
}

function updateStartSummary() {
  updateExcludeSolvedUi();

  const currentRegion = getCurrentRegion();
  const available = getAvailableQuestions(state.mode, currentRegion).length;
  const reviewAvailable = getReviewIdsForRegion(currentRegion).length;

  totalQuestionCount.textContent = String(available);
  reviewCount.textContent = String(reviewAvailable);

  questionCountHelp.textContent = available > 0
    ? `この条件で最大 ${available} 問まで出題できます`
    : "この条件で出題できる問題がありません";

  if (reviewNotice) {
    reviewNotice.classList.toggle("hidden", state.mode !== "review");
  }

  syncQuestionCountInput(available);
}

function buildSessionQuestions() {
  const region = getCurrentRegion();
  let pool = getAvailableQuestions(state.mode, region);

  if (state.mode === "random") {
    pool = shuffleArray(pool);
  }

  const count = getEffectiveQuestionCount(pool.length);
  return pool.slice(0, count);
}

function startSession() {
  resetPreviewState();

  state.isDebugSession = false;
  state.debugQuestionId = null;
  state.region = getCurrentRegion();
  state.sessionAvailableCountAtStart = getAvailableQuestions(state.mode, state.region).length;
  state.sessionExcludeSolvedAtStart = isExcludeSolvedEnabled();
  state.sessionQuestions = buildSessionQuestions();
  state.currentIndex = 0;
  state.correct = 0;
  state.wrong = 0;
  state.skipped = 0;
  state.answered = false;
  state.lastConfig = {
    kind: "normal",
    mode: state.mode,
    region: state.region,
    countMode: state.questionCountMode,
    manualRequestedCount: state.manualRequestedCount,
    excludeSolvedChecked: excludeSolvedCheckbox.checked
  };

  if (state.sessionQuestions.length === 0) {
    alert("出題できる問題がありません。設定を見直してください。");
    return;
  }

  showScreen("quiz");
  renderQuestion();
}

function startDebugSessionFromInput() {
  if (!state.debugMode) {
    return;
  }

  resetPreviewState();

  const rawId = String(debugQuestionInput?.value || "").trim();
  if (!rawId) {
    alert("問題IDを入力してください。");
    debugQuestionInput?.focus();
    return;
  }

  const normalized = rawId.toLowerCase();
  const question = state.questions.find(q => String(q.id).toLowerCase() === normalized);

  if (!question) {
    alert("指定した問題IDが見つかりません。");
    debugQuestionInput?.focus();
    debugQuestionInput?.select();
    return;
  }

  state.isDebugSession = true;
  state.debugQuestionId = question.id;
  state.mode = "fixed";
  state.region = question.region || "all";
  state.sessionAvailableCountAtStart = 1;
  state.sessionExcludeSolvedAtStart = false;
  state.sessionQuestions = [question];
  state.currentIndex = 0;
  state.correct = 0;
  state.wrong = 0;
  state.skipped = 0;
  state.answered = false;
  state.lastConfig = {
    kind: "debug",
    questionId: question.id
  };

  showScreen("quiz");
  renderQuestion();
}

function retrySameConfig() {
  if (!state.lastConfig) {
    backToStart();
    return;
  }

  if (state.lastConfig.kind === "debug") {
    if (debugQuestionInput) {
      debugQuestionInput.value = state.lastConfig.questionId;
    }
    startDebugSessionFromInput();
    return;
  }

  state.mode = state.lastConfig.mode;
  state.region = state.lastConfig.region || "all";
  state.questionCountMode = state.lastConfig.countMode || "auto";
  state.manualRequestedCount =
    state.lastConfig.manualRequestedCount !== undefined
      ? state.lastConfig.manualRequestedCount
      : null;

  regionSelect.value = state.region;
  excludeSolvedCheckbox.checked = Boolean(state.lastConfig.excludeSolvedChecked);

  modeButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === state.mode);
  });

  updateStartSummary();
  startSession();
}

function resetPreviewState() {
  state.isAchievementPreview = false;
  if (retrySameModeButton) {
    retrySameModeButton.classList.remove("hidden");
  }
  setResultDebugNotice(false);
}

function backToStart() {
  resetPreviewState();
  state.isDebugSession = false;
  state.debugQuestionId = null;
  showScreen("start");
  updateStartSummary();
}

function endSession() {
  const ok = confirm("現在のテストを終了して開始画面へ戻りますか？");
  if (!ok) {
    return;
  }
  backToStart();
}

function showScreen(screen) {
  startScreen.classList.toggle("hidden", screen !== "start");
  quizScreen.classList.toggle("hidden", screen !== "quiz");
  resultScreen.classList.toggle("hidden", screen !== "result");
}

function renderQuestion() {
  if (state.currentIndex >= state.sessionQuestions.length) {
    renderResult();
    return;
  }

  state.answered = false;

  const question = state.sessionQuestions[state.currentIndex];

  if (!state.isDebugSession) {
    incrementAskedCount(question.id);
  }

  questionImage.src = question.image;
  questionImage.alt = question.answer;

  if (state.isDebugSession) {
    modeLabel.textContent = `デバッグ / ${question.id}`;
  } else {
    modeLabel.textContent = `${getModeLabel(state.mode)} / ${getRegionLabel(state.region)}`;
  }

  progressText.textContent = `${state.currentIndex + 1} / ${state.sessionQuestions.length}`;
  correctStat.textContent = `正解 ${state.correct}`;
  wrongStat.textContent = `誤答 ${state.wrong}`;

  answerInput.value = "";
  answerPhase.classList.remove("hidden");
  resultPhase.classList.add("hidden");
  feedbackBox.className = "feedback";

  focusAnswerInput();
}

function focusAnswerInput() {
  requestAnimationFrame(() => {
    setTimeout(() => {
      answerInput.focus();
      answerInput.select();
    }, 50);
  });
}

function getCurrentQuestion() {
  return state.sessionQuestions[state.currentIndex];
}

function submitCurrentAnswer() {
  if (state.answered) {
    return;
  }

  const question = getCurrentQuestion();
  const rawInput = answerInput.value;

  if (!normalizeAnswer(rawInput)) {
    alert("回答を入力してください。");
    focusAnswerInput();
    return;
  }

  const correct = isCorrectAnswer(rawInput, question);

  if (correct) {
    state.correct += 1;
  } else {
    state.wrong += 1;
  }

  if (!state.isDebugSession) {
    recordQuestionResult(question.id, correct, rawInput);
  }

  showAnswerResult(correct, question, rawInput, false);
}

function skipCurrentQuestion() {
  if (state.answered) {
    return;
  }

  const question = getCurrentQuestion();
  state.wrong += 1;
  state.skipped += 1;

  if (!state.isDebugSession) {
    recordQuestionResult(question.id, false, "");
  }

  showAnswerResult(false, question, "", true);
}

function showAnswerResult(correct, question, rawInput, skipped) {
  state.answered = true;
  correctStat.textContent = `正解 ${state.correct}`;
  wrongStat.textContent = `誤答 ${state.wrong}`;

  feedbackBox.className = `feedback ${correct ? "success" : "error"}`;

  if (correct) {
    feedbackBox.innerHTML = `
      <div class="feedback-title">正解です。</div>
      <div class="feedback-answer">${formatAnswerForDisplay(question.answer)}</div>
    `;
  } else if (skipped) {
    feedbackBox.innerHTML = `
      <div class="feedback-title">スキップしました。</div>
      <div class="feedback-sub">正解</div>
      <div class="feedback-answer">${formatAnswerForDisplay(question.answer)}</div>
    `;
  } else {
    feedbackBox.innerHTML = `
      <div class="feedback-title">不正解です。</div>
      <div class="feedback-sub">あなたの回答: ${escapeHtml(rawInput || "未入力")}</div>
      <div class="feedback-sub">正解</div>
      <div class="feedback-answer">${formatAnswerForDisplay(question.answer)}</div>
    `;
  }

  answerPhase.classList.add("hidden");
  resultPhase.classList.remove("hidden");
  nextButton.focus();
}

function goNextQuestion() {
  if (!state.answered) {
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
}

function hideAchievementDisplay() {
  achievementArea.classList.add("hidden");
  secretAchievementBox.classList.add("hidden");
  regionAchievementBox.classList.add("hidden");
  regionAchievementBox.classList.remove("region-achievement-group");
  secretAchievementBox.innerHTML = "";
  regionAchievementBox.innerHTML = "";
}

function getNewlyCompletedRegions() {
  const newlyCompleted = [];
  const records = getAllQuestionRecords();

  REGION_ORDER.forEach(region => {
    if (hasCompletedRegion(region)) {
      return;
    }

    const regionQuestions = state.questions.filter(question => question.region === region);
    if (regionQuestions.length === 0) {
      return;
    }

    const isComplete = regionQuestions.every(question => {
      const record = records[question.id];
      return (record?.correctCount || 0) >= 1;
    });

    if (isComplete) {
      const marked = markRegionCompleted(region);
      if (marked) {
        newlyCompleted.push(region);
      }
    }
  });

  return newlyCompleted;
}

function hasPerfectAllRegionClear() {
  if (state.isDebugSession || state.isAchievementPreview) {
    return false;
  }

  if (state.mode === "review") {
    return false;
  }

  if (state.region !== "all") {
    return false;
  }

  if (state.sessionExcludeSolvedAtStart) {
    return false;
  }

  if (state.sessionAvailableCountAtStart <= 0) {
    return false;
  }

  if (state.sessionQuestions.length !== state.sessionAvailableCountAtStart) {
    return false;
  }

  if (state.correct !== state.sessionQuestions.length) {
    return false;
  }

  if (state.wrong !== 0) {
    return false;
  }

  if (state.skipped !== 0) {
    return false;
  }

  return true;
}

function renderAchievements(regions, hasSecretAchievement) {
  hideAchievementDisplay();

  if (!hasSecretAchievement && (!regions || regions.length === 0)) {
    return;
  }

  achievementArea.classList.remove("hidden");

  if (hasSecretAchievement) {
    secretAchievementBox.classList.remove("hidden");
    secretAchievementBox.innerHTML = `
      <div class="achievement-badge">SECRET</div>
      <div class="achievement-title">全地方完全制覇！！</div>
      <div class="achievement-text">
        1回のテストで全問連続正解！？
        <p><font size="6">.....え、暇なの？</font>
        <p>とりあえずスクショして河合に送ってみてください。
        <br>きっといいことあると思います。
      </div>
    `;
  }

  if (regions && regions.length > 0) {
    regionAchievementBox.classList.remove("hidden");
    regionAchievementBox.classList.add("region-achievement-group");

    regionAchievementBox.innerHTML = regions
      .map(region => {
        const label = getRegionLabel(region);
        return `
          <div class="region-complete-card">
            <div class="achievement-badge">COMPLETE</div>
            <div class="achievement-title">${escapeHtml(label)}地方コンプリート！</div>
            <div class="achievement-text">
              ${escapeHtml(label)}地方のすべてのポケモンと<br>出会い、正解しました！
            </div>
          </div>
        `;
      })
      .join("");
  }
}

function renderResult() {
  showScreen("result");
  resetPreviewState();

  const total = state.sessionQuestions.length;
  const rate = total > 0 ? Math.round((state.correct / total) * 100) : 0;
  const remainingReviewCount = getReviewIdsForRegion(state.region).length;

  resultCorrect.textContent = String(state.correct);
  resultWrong.textContent = String(state.wrong);
  resultRate.textContent = `${rate}%`;
  resultReviewCount.textContent = String(remainingReviewCount);

  if (state.isDebugSession) {
    hideAchievementDisplay();
    resultMessage.textContent = `デバッグセッションが終了しました。問題ID: ${state.debugQuestionId}。このセッションの結果は復習記録に保存されていません。`;
    return;
  }

  const newlyCompletedRegions = getNewlyCompletedRegions();
  const hasSecretAchievement = hasPerfectAllRegionClear();
  renderAchievements(newlyCompletedRegions, hasSecretAchievement);

  if (state.mode === "review") {
    resultMessage.textContent = `${getRegionLabel(state.region)}の復習モードが終了しました。残っている苦手問題は次回も復習できます。`;
  } else {
    resultMessage.textContent = `テストが終了しました。誤答した問題は${getRegionLabel(state.region)}の復習対象に追加されています。`;
  }
}

function getModeLabel(mode) {
  switch (mode) {
    case "random":
      return "ランダム";
    case "review":
      return "復習";
    default:
      return "固定順";
  }
}

function getRegionLabel(region) {
  switch (region) {
    case "kanto":
      return "カントー";
    case "johto":
      return "ジョウト";
    case "hoenn":
      return "ホウエン";
    case "sinnoh":
      return "シンオウ";
    case "unova":
      return "イッシュ";
    case "kalos":
      return "カロス";
    case "alola":
      return "アローラ";
    case "galar":
      return "ガラル";
    case "hisui":
      return "ヒスイ";
    case "paldea":
      return "パルデア";
    default:
      return "全地方";
  }
}