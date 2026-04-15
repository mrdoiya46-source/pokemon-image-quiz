
(() => {
  const state = {
    questions: [],
    mode: "fixed",
    username: "default",
    queue: [],
    index: 0,
    correct: 0,
    wrong: 0,
    currentQuestion: null,
    answered: false
  };

  const els = {
    startScreen: document.getElementById("startScreen"),
    quizScreen: document.getElementById("quizScreen"),
    resultScreen: document.getElementById("resultScreen"),
    usernameInput: document.getElementById("usernameInput"),
    totalQuestionCount: document.getElementById("totalQuestionCount"),
    reviewCount: document.getElementById("reviewCount"),
    startButton: document.getElementById("startButton"),
    modeButtons: Array.from(document.querySelectorAll(".mode-button")),
    modeLabel: document.getElementById("modeLabel"),
    progressText: document.getElementById("progressText"),
    correctStat: document.getElementById("correctStat"),
    wrongStat: document.getElementById("wrongStat"),
    questionImage: document.getElementById("questionImage"),
    answerInput: document.getElementById("answerInput"),
    submitButton: document.getElementById("submitButton"),
    skipButton: document.getElementById("skipButton"),
    feedbackBox: document.getElementById("feedbackBox"),
    nextActionRow: document.getElementById("nextActionRow"),
    nextButton: document.getElementById("nextButton"),
    resultCorrect: document.getElementById("resultCorrect"),
    resultWrong: document.getElementById("resultWrong"),
    resultRate: document.getElementById("resultRate"),
    resultReviewCount: document.getElementById("resultReviewCount"),
    resultMessage: document.getElementById("resultMessage"),
    backToStartButton: document.getElementById("backToStartButton"),
    retrySameModeButton: document.getElementById("retrySameModeButton"),
    resetSessionBtn: document.getElementById("resetSessionBtn")
  };

  async function init() {
    const loaded = Array.isArray(window.POKEMON_QUESTIONS) ? window.POKEMON_QUESTIONS : [];
    state.questions = loaded.filter(item => item.enabled !== false);
    els.totalQuestionCount.textContent = String(state.questions.length);

    const rememberedName = localStorage.getItem("pokemonImageQuizLastUsername") || "";
    els.usernameInput.value = rememberedName;
    updateReviewCountPreview();
    bindEvents();
  }

  function bindEvents() {
    els.modeButtons.forEach(button => {
      button.addEventListener("click", () => {
        els.modeButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        state.mode = button.dataset.mode;
        updateReviewCountPreview();
      });
    });

    els.usernameInput.addEventListener("input", updateReviewCountPreview);
    els.startButton.addEventListener("click", startQuiz);
    els.submitButton.addEventListener("click", handleSubmit);
    els.skipButton.addEventListener("click", handleSkip);
    els.nextButton.addEventListener("click", goNext);
    els.backToStartButton.addEventListener("click", backToStart);
    els.retrySameModeButton.addEventListener("click", retrySameMode);
    els.resetSessionBtn.addEventListener("click", () => {
      backToStart();
      els.answerInput.value = "";
    });

    els.answerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !state.answered) {
        handleSubmit();
      }
    });
  }

  function selectedUsername() {
    return (els.usernameInput.value || "default").trim() || "default";
  }

  function updateReviewCountPreview() {
    const username = selectedUsername();
    const reviewCount = quizStorage.getReviewCount(username);
    els.reviewCount.textContent = String(reviewCount);
  }

  function modeLabel(mode) {
    if (mode === "random") return "ランダム";
    if (mode === "review") return "復習";
    return "固定順";
  }

  function startQuiz() {
    state.username = selectedUsername();
    localStorage.setItem("pokemonImageQuizLastUsername", state.username);
    state.correct = 0;
    state.wrong = 0;
    state.index = 0;
    state.answered = false;
    state.mode = state.mode || "fixed";

    const reviewIds = new Set(quizStorage.getReviewIds(state.username));
    let queue;
    if (state.mode === "review") {
      queue = state.questions.filter(q => reviewIds.has(q.id));
    } else if (state.mode === "random") {
      queue = quizUtils.shuffle(state.questions);
    } else {
      queue = state.questions.slice();
    }

    state.queue = queue;

    if (state.queue.length === 0) {
      alert(state.mode === "review" ? "復習対象がありません。" : "出題できる問題がありません。");
      updateReviewCountPreview();
      return;
    }

    switchScreen("quiz");
    renderCurrentQuestion();
  }

  function switchScreen(target) {
    els.startScreen.classList.toggle("hidden", target !== "start");
    els.quizScreen.classList.toggle("hidden", target !== "quiz");
    els.resultScreen.classList.toggle("hidden", target !== "result");
  }

  function renderCurrentQuestion() {
    state.answered = false;
    els.answerInput.value = "";
    els.answerInput.disabled = false;
    els.submitButton.disabled = false;
    els.skipButton.disabled = false;
    els.feedbackBox.className = "feedback hidden";
    els.feedbackBox.innerHTML = "";
    els.nextActionRow.classList.add("hidden");

    state.currentQuestion = state.queue[state.index];
    if (!state.currentQuestion) {
      showResults();
      return;
    }

    els.modeLabel.textContent = `${modeLabel(state.mode)} / ${state.username}`;
    els.progressText.textContent = `${state.index + 1} / ${state.queue.length}`;
    els.correctStat.textContent = `正解 ${state.correct}`;
    els.wrongStat.textContent = `誤答 ${state.wrong}`;
    els.questionImage.src = state.currentQuestion.image;
    els.questionImage.alt = `問題画像 ${state.currentQuestion.id}`;
    setTimeout(() => els.answerInput.focus(), 50);
  }

  function handleSubmit() {
    if (state.answered) return;
    const inputValue = els.answerInput.value;
    const question = state.currentQuestion;
    const isCorrect = quizUtils.isCorrectAnswer(inputValue, question);

    if (isCorrect) {
      state.correct += 1;
      quizStorage.recordAnswer(state.username, question.id, true, inputValue, state.mode);
      showFeedback(true, `正解です。<br><strong>${escapeHtml(question.answer)}</strong>`);
    } else {
      state.wrong += 1;
      quizStorage.recordAnswer(state.username, question.id, false, inputValue, state.mode);
      const aliases = (question.aliases || []).length
        ? `<br>許容表記: ${question.aliases.map(escapeHtml).join(" / ")}`
        : "";
      showFeedback(false, `不正解です。<br>正解: <strong>${escapeHtml(question.answer)}</strong>${aliases}`);
    }

    state.answered = true;
    els.answerInput.disabled = true;
    els.submitButton.disabled = true;
    els.skipButton.disabled = true;
    els.nextActionRow.classList.remove("hidden");
    els.correctStat.textContent = `正解 ${state.correct}`;
    els.wrongStat.textContent = `誤答 ${state.wrong}`;
    updateReviewCountPreview();
  }

  function handleSkip() {
    if (state.answered) return;
    const question = state.currentQuestion;
    state.wrong += 1;
    quizStorage.recordAnswer(state.username, question.id, false, "(skip)", state.mode);
    showFeedback(false, `スキップしました。<br>正解: <strong>${escapeHtml(question.answer)}</strong>`);
    state.answered = true;
    els.answerInput.disabled = true;
    els.submitButton.disabled = true;
    els.skipButton.disabled = true;
    els.nextActionRow.classList.remove("hidden");
    els.correctStat.textContent = `正解 ${state.correct}`;
    els.wrongStat.textContent = `誤答 ${state.wrong}`;
    updateReviewCountPreview();
  }

  function showFeedback(isSuccess, html) {
    els.feedbackBox.className = `feedback ${isSuccess ? "success" : "error"}`;
    els.feedbackBox.innerHTML = html;
  }

  function goNext() {
    state.index += 1;
    renderCurrentQuestion();
  }

  function showResults() {
    switchScreen("result");
    const total = state.correct + state.wrong;
    const rate = total ? Math.round((state.correct / total) * 100) : 0;
    const remainingReview = quizStorage.getReviewCount(state.username);

    els.resultCorrect.textContent = String(state.correct);
    els.resultWrong.textContent = String(state.wrong);
    els.resultRate.textContent = `${rate}%`;
    els.resultReviewCount.textContent = String(remainingReview);

    if (state.mode === "review") {
      els.resultMessage.textContent = remainingReview === 0
        ? "復習対象はすべて解消されました。"
        : `まだ復習対象が ${remainingReview} 問あります。`;
    } else {
      els.resultMessage.textContent = remainingReview === 0
        ? "今回の誤答はありませんでした。"
        : `今回までの累積で、復習対象が ${remainingReview} 問あります。`;
    }
  }

  function retrySameMode() {
    startQuiz();
  }

  function backToStart() {
    switchScreen("start");
    updateReviewCountPreview();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  init().catch((error) => {
    console.error(error);
    alert("初期化に失敗しました。questions-data.js / questions.json を確認してください。");
  });
})();
