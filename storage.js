const STORAGE_KEY = "pokemonImageQuiz.v2";

function migrateLegacyStore(parsed) {
  if (parsed && parsed.questions && typeof parsed.questions === "object") {
    return { questions: parsed.questions };
  }

  if (parsed && parsed.users && typeof parsed.users === "object") {
    if (
      parsed.users.default &&
      parsed.users.default.questions &&
      typeof parsed.users.default.questions === "object"
    ) {
      return { questions: parsed.users.default.questions };
    }

    const firstUser = Object.values(parsed.users).find(
      user => user && user.questions && typeof user.questions === "object"
    );

    if (firstUser) {
      return { questions: firstUser.questions };
    }
  }

  return { questions: {} };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { questions: {} };
    }

    const parsed = JSON.parse(raw);
    const migrated = migrateLegacyStore(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
      saveStore(migrated);
    }

    return migrated;
  } catch {
    return { questions: {} };
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getQuestionRecord(questionId) {
  const store = loadStore();
  return store.questions[questionId] || {
    wrongCount: 0,
    correctCount: 0,
    lastWrongInput: "",
    lastAnsweredAt: "",
    needsReview: false
  };
}

function getReviewIds() {
  const store = loadStore();
  return Object.entries(store.questions)
    .filter(([, record]) => record && record.needsReview)
    .map(([id]) => id);
}

function recordQuestionResult(questionId, isCorrect, rawInput) {
  const store = loadStore();

  if (!store.questions[questionId]) {
    store.questions[questionId] = {
      wrongCount: 0,
      correctCount: 0,
      lastWrongInput: "",
      lastAnsweredAt: "",
      needsReview: false
    };
  }

  const record = store.questions[questionId];
  record.lastAnsweredAt = new Date().toISOString();

  if (isCorrect) {
    record.correctCount += 1;
    record.needsReview = false;
  } else {
    record.wrongCount += 1;
    record.lastWrongInput = String(rawInput || "");
    record.needsReview = true;
  }

  saveStore(store);
}

function clearProgress() {
  saveStore({ questions: {} });
}