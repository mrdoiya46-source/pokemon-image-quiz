
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[ \t\r\n\u3000]+/g, "")
    .trim()
    .toLowerCase();
}

function getAcceptedAnswers(question) {
  const base = [question.answer, ...(Array.isArray(question.aliases) ? question.aliases : [])];
  return [...new Set(base.map(normalizeAnswer).filter(Boolean))];
}

function isCorrectAnswer(input, question) {
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) {
    return false;
  }
  return getAcceptedAnswers(question).includes(normalizedInput);
}

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatAnswerForDisplay(answer) {
  const escaped = escapeHtml(answer);
  return escaped.replace(/(♂|♀)$/u, '<span class="gender-symbol">$1</span>');
}