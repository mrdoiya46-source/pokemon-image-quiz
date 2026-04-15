
(function () {
  const STORAGE_KEY = "pokemonImageQuizProgressV1";

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function writeAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function ensureUser(data, username) {
    if (!data[username]) {
      data[username] = {
        username,
        questions: {},
        lastPlayedMode: "fixed",
        updatedAt: new Date().toISOString()
      };
    }
    return data[username];
  }

  window.quizStorage = {
    getUser(username) {
      const all = readAll();
      return ensureUser(all, username);
    },

    saveUser(userData) {
      const all = readAll();
      all[userData.username] = {
        ...userData,
        updatedAt: new Date().toISOString()
      };
      writeAll(all);
    },

    recordAnswer(username, questionId, isCorrect, inputValue, mode) {
      const all = readAll();
      const user = ensureUser(all, username);
      const item = user.questions[questionId] || {
        wrongCount: 0,
        correctCount: 0,
        reviewPending: false,
        lastWrongInput: "",
        lastAnsweredAt: null
      };

      if (isCorrect) {
        item.correctCount += 1;
        if (mode === "review") {
          item.reviewPending = false;
        }
      } else {
        item.wrongCount += 1;
        item.reviewPending = true;
        item.lastWrongInput = inputValue;
      }

      item.lastAnsweredAt = new Date().toISOString();
      user.questions[questionId] = item;
      user.lastPlayedMode = mode;
      all[username] = user;
      writeAll(all);
      return item;
    },

    getReviewIds(username) {
      const user = this.getUser(username);
      return Object.entries(user.questions)
        .filter(([, value]) => value.reviewPending)
        .map(([id]) => id);
    },

    getReviewCount(username) {
      return this.getReviewIds(username).length;
    },

    resetUser(username) {
      const all = readAll();
      delete all[username];
      writeAll(all);
    },

    resetAll() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();
