const STORAGE_KEY = "pokemonImageQuiz.v2";

function createEmptyQuestionRecord() {
  return {
    wrongCount: 0,
    correctCount: 0,
    askedCount: 0,
    lastWrongInput: "",
    lastAnsweredAt: "",
    needsReview: false
  };
}

function normalizeQuestionRecord(record) {
  const base = createEmptyQuestionRecord();
  const source = record && typeof record === "object" ? record : {};

  return {
    wrongCount: Number(source.wrongCount) || 0,
    correctCount: Number(source.correctCount) || 0,
    askedCount: Number(source.askedCount) || 0,
    lastWrongInput: String(source.lastWrongInput || ""),
    lastAnsweredAt: String(source.lastAnsweredAt || ""),
    needsReview: Boolean(source.needsReview)
  };
}

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

function normalizeStoreShape(store) {
  const questions = {};
  const sourceQuestions =
    store && store.questions && typeof store.questions === "object"
      ? store.questions
      : {};

  Object.entries(sourceQuestions).forEach(([questionId, record]) => {
    questions[questionId] = normalizeQuestionRecord(record);
  });

  return { questions };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { questions: {} };
    }

    const parsed = JSON.parse(raw);
    const migrated = normalizeStoreShape(migrateLegacyStore(parsed));

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

function getAllQuestionRecords() {
  return loadStore().questions;
}

function getQuestionRecord(questionId) {
  const store = loadStore();
  return normalizeQuestionRecord(store.questions[questionId]);
}

function getReviewIds() {
  const records = getAllQuestionRecords();
  return Object.entries(records)
    .filter(([, record]) => record && record.needsReview)
    .map(([id]) => id);
}

function incrementAskedCount(questionId) {
  const store = loadStore();

  if (!store.questions[questionId]) {
    store.questions[questionId] = createEmptyQuestionRecord();
  }

  store.questions[questionId] = normalizeQuestionRecord(store.questions[questionId]);
  store.questions[questionId].askedCount += 1;

  saveStore(store);
}

function recordQuestionResult(questionId, isCorrect, rawInput) {
  const store = loadStore();

  if (!store.questions[questionId]) {
    store.questions[questionId] = createEmptyQuestionRecord();
  }

  store.questions[questionId] = normalizeQuestionRecord(store.questions[questionId]);

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