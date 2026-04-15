
const STORAGE_KEY = "pokemonImageQuiz.v2";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { users: {} };
    }
    const parsed = JSON.parse(raw);
    if (!parsed.users || typeof parsed.users !== "object") {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeUsername(username) {
  const value = String(username || "").trim();
  return value || "default";
}

function ensureUserRecord(username) {
  const store = loadStore();
  const key = normalizeUsername(username);

  if (!store.users[key]) {
    store.users[key] = {
      questions: {}
    };
    saveStore(store);
  }

  return store.users[key];
}

function getUserRecord(username) {
  const store = loadStore();
  return store.users[normalizeUsername(username)] || { questions: {} };
}

function getReviewIds(username) {
  const user = getUserRecord(username);
  return Object.entries(user.questions)
    .filter(([, record]) => record && record.needsReview)
    .map(([id]) => id);
}

function recordQuestionResult(username, questionId, isCorrect, rawInput) {
  const store = loadStore();
  const key = normalizeUsername(username);

  if (!store.users[key]) {
    store.users[key] = { questions: {} };
  }

  if (!store.users[key].questions[questionId]) {
    store.users[key].questions[questionId] = {
      wrongCount: 0,
      correctCount: 0,
      lastWrongInput: "",
      lastAnsweredAt: "",
      needsReview: false
    };
  }

  const record = store.users[key].questions[questionId];
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

function clearUserProgress(username) {
  const store = loadStore();
  const key = normalizeUsername(username);
  delete store.users[key];
  saveStore(store);
}