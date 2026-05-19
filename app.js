const LETTERS = ["a", "b", "c", "d"];
const STORAGE_KEY = "wijsbegeerte-quiz-score";

const STOP_WORDS = new Set([
  "aan", "als", "altijd", "antwoord", "beide", "begrip", "benadering", "best", "beste",
  "bij", "binnen", "dat", "de", "deze", "die", "dit", "door", "een", "en", "er", "gaat",
  "geeft", "gekenmerkt", "geldt", "het", "hier", "hoort", "hoe", "i", "ii", "in", "is",
  "allemaal", "even", "juist", "kan", "lijken", "met", "mens", "mensen", "naar", "niet", "nog", "of", "omschrijving", "om", "onder",
  "onjuist", "op", "over", "past", "rijtje", "staat", "stroming", "te", "thuis", "tot",
  "uitspraak", "van", "verbindt", "verschillende", "volgende", "voor", "waar", "waarin", "wat", "welk",
  "welke", "wordt", "zijn"
]);

const questions = window.QUIZ_QUESTIONS || [];
const coursePages = window.COURSE_PAGES || [];

const state = {
  current: null,
  selected: null,
  answered: false,
  seen: new Set(),
  stats: loadStats()
};

const els = {
  answeredCount: document.querySelector("#answeredCount"),
  correctCount: document.querySelector("#correctCount"),
  streakCount: document.querySelector("#streakCount"),
  chapterFilter: document.querySelector("#chapterFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  shuffleButton: document.querySelector("#shuffleButton"),
  resetButton: document.querySelector("#resetButton"),
  chapterBadge: document.querySelector("#chapterBadge"),
  categoryBadge: document.querySelector("#categoryBadge"),
  progressBadge: document.querySelector("#progressBadge"),
  questionText: document.querySelector("#questionText"),
  optionsList: document.querySelector("#optionsList"),
  checkButton: document.querySelector("#checkButton"),
  nextButton: document.querySelector("#nextButton"),
  resultPanel: document.querySelector("#resultPanel"),
  infoButton: document.querySelector("#infoButton"),
  infoPanel: document.querySelector("#infoPanel"),
  infoContent: document.querySelector("#infoContent"),
  closeInfoButton: document.querySelector("#closeInfoButton")
};

init();

function init() {
  populateFilters();
  bindEvents();
  updateScore();
  drawQuestion();
}

function populateFilters() {
  const chapters = Array.from(new Set(questions.map((q) => q.chapter)));
  const types = Array.from(new Set(questions.map((q) => q.category)));

  els.chapterFilter.innerHTML = [
    `<option value="">Alle hoofdstukken</option>`,
    ...chapters.map((chapter) => `<option value="${escapeAttr(chapter)}">${escapeHtml(shortChapter(chapter))}</option>`)
  ].join("");

  els.typeFilter.innerHTML = [
    `<option value="">Alle types</option>`,
    ...types.map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`)
  ].join("");
}

function bindEvents() {
  els.chapterFilter.addEventListener("change", drawQuestion);
  els.typeFilter.addEventListener("change", drawQuestion);
  els.shuffleButton.addEventListener("click", drawQuestion);
  els.nextButton.addEventListener("click", drawQuestion);
  els.checkButton.addEventListener("click", checkAnswer);
  els.infoButton.addEventListener("click", showInfo);
  els.closeInfoButton.addEventListener("click", () => {
    els.infoPanel.hidden = true;
  });
  els.resetButton.addEventListener("click", () => {
    state.stats = { answered: 0, correct: 0, streak: 0 };
    saveStats();
    updateScore();
  });
}

function getPool() {
  const chapter = els.chapterFilter.value;
  const type = els.typeFilter.value;
  return questions.filter((question) => {
    return (!chapter || question.chapter === chapter) && (!type || question.category === type);
  });
}

function drawQuestion() {
  const pool = getPool();
  if (!pool.length) {
    renderEmptyState();
    return;
  }

  const unseen = pool.filter((question) => !state.seen.has(question.id));
  const choices = unseen.length ? unseen : pool;
  if (!unseen.length) {
    state.seen.clear();
  }

  state.current = choices[Math.floor(Math.random() * choices.length)];
  state.selected = null;
  state.answered = false;
  state.seen.add(state.current.id);
  renderQuestion();
}

function renderEmptyState() {
  state.current = null;
  els.chapterBadge.textContent = "Geen vragen";
  els.categoryBadge.textContent = "";
  els.progressBadge.textContent = "";
  els.questionText.textContent = "Geen vragen voor deze filter.";
  els.optionsList.innerHTML = "";
  els.checkButton.disabled = true;
  els.resultPanel.hidden = true;
  els.infoButton.hidden = true;
  els.infoPanel.hidden = true;
}

function renderQuestion() {
  const question = state.current;
  els.chapterBadge.textContent = shortChapter(question.chapter);
  els.categoryBadge.textContent = question.category;
  els.progressBadge.textContent = `Vraag ${question.id}`;
  els.questionText.textContent = question.text;

  els.optionsList.innerHTML = LETTERS.map((letter) => {
    return `
      <button class="option-button" type="button" data-letter="${letter}" aria-pressed="false">
        <span class="option-letter">${letter}</span>
        <span class="option-text">${escapeHtml(question.options[letter])}</span>
      </button>
    `;
  }).join("");

  for (const button of els.optionsList.querySelectorAll(".option-button")) {
    button.addEventListener("click", () => selectOption(button.dataset.letter));
  }

  els.checkButton.disabled = true;
  els.resultPanel.hidden = true;
  els.resultPanel.className = "result";
  els.resultPanel.innerHTML = "";
  els.infoButton.hidden = true;
  els.infoPanel.hidden = true;
}

function selectOption(letter) {
  if (state.answered) return;
  state.selected = letter;
  for (const button of els.optionsList.querySelectorAll(".option-button")) {
    const isSelected = button.dataset.letter === letter;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
  els.checkButton.disabled = false;
}

function checkAnswer() {
  if (!state.current || !state.selected || state.answered) return;

  const question = state.current;
  const isCorrect = state.selected === question.answer;
  state.answered = true;
  els.checkButton.disabled = true;

  state.stats.answered += 1;
  if (isCorrect) {
    state.stats.correct += 1;
    state.stats.streak += 1;
  } else {
    state.stats.streak = 0;
  }
  saveStats();
  updateScore();

  for (const button of els.optionsList.querySelectorAll(".option-button")) {
    const letter = button.dataset.letter;
    button.disabled = true;
    button.classList.remove("selected");
    if (letter === question.answer) button.classList.add("correct");
    if (letter === state.selected && !isCorrect) button.classList.add("wrong");
    if (letter !== question.answer && letter !== state.selected) button.classList.add("dimmed");
  }

  els.resultPanel.hidden = false;
  els.resultPanel.classList.toggle("is-correct", isCorrect);
  els.resultPanel.classList.toggle("is-wrong", !isCorrect);
  els.resultPanel.innerHTML = isCorrect
    ? `<strong>Juist.</strong>${escapeHtml(question.answer.toUpperCase())}: ${escapeHtml(question.answerText)}`
    : `<strong>Niet juist.</strong>Het juiste antwoord is ${escapeHtml(question.answer.toUpperCase())}: ${escapeHtml(question.answerText)}`;
  els.infoButton.hidden = false;
}

function showInfo() {
  if (!state.current) return;
  const search = buildSearch(state.current);
  const matches = rankPages(search).slice(0, 2);

  els.infoPanel.hidden = false;
  if (!matches.length) {
    els.infoContent.innerHTML = `<p>Geen passend cursusfragment gevonden.</p>`;
    return;
  }

  els.infoContent.innerHTML = `
    <div class="keyword-row">${search.displayTerms.map((term) => `<span>${escapeHtml(term)}</span>`).join("")}</div>
    ${matches.map((match) => {
      const snippet = makeSnippet(match.page, search);
      return `
        <article class="source-snippet">
          <h3>Cursus p. ${match.page.page}${match.page.heading ? ` · ${escapeHtml(match.page.heading)}` : ""}</h3>
          <p>${escapeHtml(snippet)}</p>
        </article>
      `;
    }).join("")}
  `;
  els.infoPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildSearch(question) {
  const answerText = question.answerText || "";
  const chapterTitle = question.chapter.replace(/^H\d+\s+-\s+/, "");
  const combined = `${answerText} ${question.text} ${chapterTitle}`;
  const answerTerms = tokenize(answerText);
  const allTerms = tokenize(combined);
  const weighted = new Map();

  for (const term of allTerms) {
    weighted.set(term, Math.max(weighted.get(term) || 0, 1));
  }
  for (const term of answerTerms) {
    weighted.set(term, Math.max(weighted.get(term) || 0, 4));
  }

  const phrase = normalizeText(answerText);
  const terms = [...weighted.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 16);

  return {
    phrase,
    terms,
    displayTerms: [answerText, ...terms.map(([term]) => term)].filter(Boolean).slice(0, 7)
  };
}

function rankPages(search) {
  return coursePages
    .map((page) => {
      const haystack = normalizeText(`${page.heading} ${page.text}`);
      let score = 0;
      if (search.phrase.length > 4 && haystack.includes(search.phrase)) score += 55;
      for (const [term, weight] of search.terms) {
        if (haystack.includes(term)) {
          score += weight * Math.min(7, 1 + Math.floor((haystack.match(new RegExp(escapeRegExp(term), "g")) || []).length / 2));
        }
      }
      return { page, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.page.page - b.page.page);
}

function makeSnippet(page, search) {
  const sentences = page.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [page.text];
  let bestIndex = 0;
  let bestScore = -1;

  sentences.forEach((sentence, index) => {
    const normalized = normalizeText(sentence);
    let score = 0;
    if (search.phrase.length > 4 && normalized.includes(search.phrase)) score += 30;
    for (const [term, weight] of search.terms) {
      if (normalized.includes(term)) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const start = Math.max(0, bestIndex - 1);
  const end = Math.min(sentences.length, bestIndex + 2);
  return compactText(sentences.slice(start, end).join(" ")).slice(0, 780);
}

function tokenize(value) {
  const normalized = normalizeText(value);
  const tokens = normalized.match(/[a-z0-9]+/g) || [];
  return Array.from(new Set(tokens.filter((token) => token.length > 3 && !STOP_WORDS.has(token))));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function updateScore() {
  els.answeredCount.textContent = state.stats.answered;
  els.correctCount.textContent = state.stats.correct;
  els.streakCount.textContent = state.stats.streak;
}

function loadStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && Number.isFinite(parsed.answered) && Number.isFinite(parsed.correct) && Number.isFinite(parsed.streak)) {
      return parsed;
    }
  } catch {
    return { answered: 0, correct: 0, streak: 0 };
  }
  return { answered: 0, correct: 0, streak: 0 };
}

function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
}

function shortChapter(chapter) {
  return chapter.replace(/^H(\d+)\s+-\s+/, "H$1 · ");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
