
(function () {
  function normalizeText(value) {
    return String(value || "")
      .replace(/\u3000/g, " ")
      .replace(/[：]/g, ":")
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildAcceptableAnswers(question) {
    const base = [question.answer].concat(question.aliases || []);
    return base
      .map(normalizeText)
      .filter(Boolean);
  }

  function isCorrectAnswer(inputValue, question) {
    const normalized = normalizeText(inputValue);
    const acceptable = buildAcceptableAnswers(question);
    return acceptable.includes(normalized);
  }

  function shuffle(array) {
    const cloned = array.slice();
    for (let i = cloned.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
  }

  window.quizUtils = {
    normalizeText,
    buildAcceptableAnswers,
    isCorrectAnswer,
    shuffle
  };
})();
