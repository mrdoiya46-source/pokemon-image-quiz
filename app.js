const state = {
  questions: [],
  mode: "fixed",
  region: "all",
  sessionQuestions: [],
  currentIndex: 0,
  correct: 0,
  wrong: 0,
  answered: false,
  lastConfig: null
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

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadQuestions();
  bindEvents();
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

  questionCountInput.addEventListener("input", sanitizeQuestionCountInput);

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
}

function sanitizeQuestionCountInput() {
  const value = questionCountInput.value.trim();
  if (!value) {
    return;
  }
  const number = Math.max(1, parseInt(value, 10) || 1);
  questionCountInput.value = String(number);
}

function getCurrentRegion() {
  return regionSelect.value || "all";
}

function matchesRegion(question, region) {
  if (region === "all") {
    return true;
  }
  return question.region === region;
}

function getReviewIdsForRegion(region = getCurrentRegion()) {
  const reviewSet = new Set(getReviewIds());
  return state.questions
    .filter(q => reviewSet.has(q.id) && matchesRegion(q, region))
    .map(q => q.id);
}

function getAvailableQuestions(mode = state.mode, region = getCurrentRegion()) {
  if (mode === "review") {
    const reviewSet = new Set(getReviewIds());
    return state.questions.filter(q => reviewSet.has(q.id) && matchesRegion(q, region));
  }

  return state.questions.filter(q => matchesRegion(q, region));
}

function updateStartSummary() {
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
}

function buildSessionQuestions() {
  const region = getCurrentRegion();
  let pool = getAvailableQuestions(state.mode, region);

  if (state.mode === "random") {
    pool = shuffleArray(pool);
  }

  const requestedCount = parseInt(questionCountInput.value, 10);
  if (!Number.isNaN(requestedCount) && requestedCount > 0) {
    pool = pool.slice(0, Math.min(requestedCount, pool.length));
  }

  return pool;
}

function startSession() {
  state.region = getCurrentRegion();
  state.sessionQuestions = buildSessionQuestions();
  state.currentIndex = 0;
  state.correct = 0;
  state.wrong = 0;
  state.answered = false;
  state.lastConfig = {
    mode: state.mode,
    region: state.region,
    countValue: questionCountInput.value.trim()
  };

  if (state.sessionQuestions.length === 0) {
    alert("出題できる問題がありません。設定を見直してください。");
    return;
  }

  showScreen("quiz");
  renderQuestion();
}

function retrySameConfig() {
  if (!state.lastConfig) {
    backToStart();
    return;
  }

  questionCountInput.value = state.lastConfig.countValue || "20";
  state.mode = state.lastConfig.mode;
  state.region = state.lastConfig.region || "all";
  regionSelect.value = state.region;

  modeButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === state.mode);
  });

  updateStartSummary();
  startSession();
}

function backToStart() {
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
  questionImage.src = question.image;
  questionImage.alt = question.answer;

  modeLabel.textContent = `${getModeLabel(state.mode)} / ${getRegionLabel(state.region)}`;
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
  const correct = isCorrectAnswer(rawInput, question);

  if (correct) {
    state.correct += 1;
  } else {
    state.wrong += 1;
  }

  recordQuestionResult(question.id, correct, rawInput);
  showAnswerResult(correct, question, rawInput, false);
}

function skipCurrentQuestion() {
  if (state.answered) {
    return;
  }

  const question = getCurrentQuestion();
  state.wrong += 1;
  recordQuestionResult(question.id, false, "");
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

function renderResult() {
  showScreen("result");

  const total = state.sessionQuestions.length;
  const rate = total > 0 ? Math.round((state.correct / total) * 100) : 0;
  const remainingReviewCount = getReviewIdsForRegion(state.region).length;

  resultCorrect.textContent = String(state.correct);
  resultWrong.textContent = String(state.wrong);
  resultRate.textContent = `${rate}%`;
  resultReviewCount.textContent = String(remainingReviewCount);

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