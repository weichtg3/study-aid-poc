import { gradeAnswer } from "./grader.js";

const app = document.querySelector("#app");
const helpDialog = document.querySelector("#help-dialog");
const voiceDialog = document.querySelector("#voice-dialog");
const toast = document.querySelector("#toast");

const defaultVoiceSettings = { voiceURI: "", rate: 0.92, autoRead: true };

function loadVoiceSettings() {
  try {
    return { ...defaultVoiceSettings, ...JSON.parse(localStorage.getItem("study-voice-settings") || "{}") };
  } catch {
    return { ...defaultVoiceSettings };
  }
}

const state = {
  courses: [],
  course: null,
  progress: { attempts: [] },
  lessonIndex: 0,
  questionIndex: 0,
  responses: [],
  selectedAnswer: "",
  feedback: null,
  recognition: null,
  listening: false,
  voiceSettings: loadVoiceSettings()
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const assetUrl = (path) => new URL(path, document.baseURI);

async function fetchJson(path) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("study-progress") || "{}");
    return Array.isArray(saved.attempts) ? saved : { attempts: [] };
  } catch {
    return { attempts: [] };
  }
}

function saveAttempt(attempt) {
  state.progress.attempts.unshift(attempt);
  state.progress.attempts = state.progress.attempts.slice(0, 50);
  localStorage.setItem("study-progress", JSON.stringify(state.progress));
}

function validateCourse(course, expectedId) {
  const requiredStrings = ["id", "title", "eyebrow", "description"];
  if (course.schemaVersion !== 1 || requiredStrings.some((key) => typeof course[key] !== "string") ||
      course.id !== expectedId || !Array.isArray(course.lessons) || !Array.isArray(course.questions) ||
      !course.lessons.length || !course.questions.length || !Number.isFinite(course.passingScore) ||
      !/^#[0-9a-f]{6}$/i.test(course.accent)) {
    throw new Error(`Course ${expectedId} does not match the supported course schema.`);
  }
  return course;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function availableVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang?.toLowerCase().startsWith("en"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function recommendedVoice(voices = availableVoices()) {
  return voices.find((voice) => /samantha|ava premium|ava enhanced|serena|aria|zira|google us english/i.test(voice.name))
    || voices.find((voice) => /enhanced|premium|natural/i.test(voice.name))
    || voices[0]
    || null;
}

function selectedVoice() {
  const voices = availableVoices();
  return voices.find((voice) => voice.voiceURI === state.voiceSettings.voiceURI)
    || recommendedVoice(voices);
}

function populateVoiceSettings({ reset = false } = {}) {
  const select = document.querySelector("#voice-select");
  const range = document.querySelector("#voice-rate");
  const output = document.querySelector("#voice-rate-output");
  const autoRead = document.querySelector("#voice-auto-read");
  if (!select) return;
  const voices = availableVoices();
  const recommended = recommendedVoice(voices);
  if (reset && recommended) state.voiceSettings.voiceURI = recommended.voiceURI;
  const activeURI = state.voiceSettings.voiceURI || recommended?.voiceURI || "";
  select.innerHTML = voices.length
    ? voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}" ${voice.voiceURI === activeURI ? "selected" : ""}>${escapeHtml(voice.name)} · ${escapeHtml(voice.lang)}</option>`).join("")
    : `<option value="">Default browser voice</option>`;
  range.value = String(state.voiceSettings.rate);
  output.value = `${Number(state.voiceSettings.rate).toFixed(2)}×`;
  autoRead.checked = state.voiceSettings.autoRead;
}

function readVoiceForm() {
  return {
    voiceURI: document.querySelector("#voice-select")?.value || "",
    rate: Number(document.querySelector("#voice-rate")?.value || defaultVoiceSettings.rate),
    autoRead: Boolean(document.querySelector("#voice-auto-read")?.checked)
  };
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  app.focus({ preventScroll: true });
}

async function loadHome() {
  const catalog = await fetchJson("courses/index.json");
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.courses)) throw new Error("The course catalog is invalid.");
  state.courses = await Promise.all(catalog.courses.map(async ({ id, file }) => {
    const course = validateCourse(await fetchJson(`courses/${file}`), id);
    return { ...course, lessonCount: course.lessons.length, questionCount: course.questions.length };
  }));
  state.progress = loadProgress();
  renderHome();
}

function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">A QUIET PLACE TO LEARN</p>
        <h1>Grow what<br/>you know.</h1>
        <p class="lede">Choose a course, review a short lesson, and answer questions in your own words. No pressure—just practice.</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="petal"></span><span class="petal"></span><span class="petal"></span>
        <span class="flower-center">many<br/>florets</span>
      </div>
    </section>
    <section aria-labelledby="course-heading">
      <div class="section-heading"><p class="eyebrow">COURSE LIBRARY</p><h2 id="course-heading">What would you like to study?</h2></div>
      <div class="course-list">${state.courses.map(renderCourseCard).join("")}</div>
    </section>`;
}

function renderCourseCard(course) {
  const attempts = state.progress.attempts.filter((attempt) => attempt.courseId === course.id);
  const best = attempts.length ? Math.max(...attempts.map(({ score }) => score)) : null;
  return `<article class="course-card" style="--course-accent:${escapeHtml(course.accent || "#7357e6")}">
    <div>
      <p class="eyebrow">${escapeHtml(course.eyebrow)}</p>
      <h2>${escapeHtml(course.title)}</h2>
      <p>${escapeHtml(course.description)}</p>
      <div class="meta-row">
        <span class="chip">${course.lessonCount} lessons</span>
        <span class="chip">${course.questionCount} questions</span>
        <span class="chip">About ${course.estimatedMinutes} min</span>
        <span class="chip">${best === null ? "Not started" : `Best: ${best}%`}</span>
      </div>
    </div>
    <div class="course-actions">
      <button class="button secondary" data-action="quiz" data-course="${escapeHtml(course.id)}">${best === null ? "Take quiz" : "Practice again"}</button>
      <button class="button primary" data-action="learn" data-course="${escapeHtml(course.id)}">Start learning →</button>
    </div>
  </article>`;
}

async function ensureCourse(id) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) throw new Error("That course could not be found.");
  state.course = course;
}

function renderLesson() {
  const lesson = state.course.lessons[state.lessonIndex];
  app.innerHTML = `
    <button class="back-button" data-action="home">← Back to courses</button>
    <div class="page-head">
      <div><p class="eyebrow">LEARN · ${state.lessonIndex + 1} OF ${state.course.lessons.length}</p><h2>${escapeHtml(state.course.title)}</h2><p>Read at your pace or let the app read it to you.</p></div>
      <button class="button secondary" data-action="speak-lesson">◖)) Read lesson aloud</button>
    </div>
    <div class="lesson-layout">
      <nav class="lesson-nav" aria-label="Lessons">
        ${state.course.lessons.map((item, index) => `<button class="${index === state.lessonIndex ? "active" : ""}" data-action="lesson" data-index="${index}">${index + 1}. ${escapeHtml(item.title)}</button>`).join("")}
      </nav>
      <div>
        <article class="lesson-card">
          <div class="lesson-number">${state.lessonIndex + 1}</div>
          <p class="eyebrow">${escapeHtml(lesson.kicker)}</p>
          <h2>${escapeHtml(lesson.title)}</h2>
          <p class="body-copy">${escapeHtml(lesson.body)}</p>
          <div class="definition"><strong>${escapeHtml(lesson.term)}</strong><span>${escapeHtml(lesson.definition)}</span></div>
          <div class="memory-tip"><span>✦</span><span><strong>Memory tip:</strong> ${escapeHtml(lesson.memoryTip)}</span></div>
        </article>
        <div class="lesson-controls">
          <button class="button ghost" data-action="previous-lesson" ${state.lessonIndex === 0 ? "disabled" : ""}>← Previous</button>
          <button class="button primary" data-action="next-lesson">${state.lessonIndex === state.course.lessons.length - 1 ? "Start practice quiz →" : "Next lesson →"}</button>
        </div>
      </div>
    </div>`;
  scrollTop();
}

function renderQuiz() {
  const question = state.course.questions[state.questionIndex];
  const percent = ((state.questionIndex + 1) / state.course.questions.length) * 100;
  const response = state.selectedAnswer;
  app.innerHTML = `
    <div class="quiz-wrap">
      <button class="back-button" data-action="home">← Leave practice</button>
      <div class="quiz-progress"><span>Question ${state.questionIndex + 1} of ${state.course.questions.length}</span><div class="progress-track"><span style="width:${percent}%"></span></div></div>
      <article class="quiz-card">
        <span class="question-topic">${escapeHtml(question.topic)} · ${question.type === "spoken" ? "Speak or type" : "Choose one"}</span>
        <div class="question-prompt">${escapeHtml(question.prompt)}</div>
        ${renderQuestionImage(question)}
        <div class="listen-row">
          <button class="button secondary" data-action="speak-question">◖)) Hear question</button>
        </div>
        ${question.type === "choice" ? renderChoices(question, response) : renderVoiceAnswer(response)}
        ${state.feedback ? renderFeedback(state.feedback) : ""}
        <div class="quiz-actions">
          <button class="text-button" data-action="hint">Show a hint</button>
          ${state.feedback && state.feedback.status !== "partial"
            ? `<button class="button primary" data-action="next-question">${state.questionIndex === state.course.questions.length - 1 ? "See my results" : "Next question →"}</button>`
            : `<button class="button primary" data-action="check-answer" ${response.trim() ? "" : "disabled"}>Check answer</button>`}
        </div>
      </article>
    </div>`;
  if (question.type === "spoken" && !state.feedback) document.querySelector("#spoken-answer")?.focus();
  scrollTop();
}

function renderQuestionImage(question) {
  if (!question.image) return "";
  return `<figure class="question-figure">
    <img src="${escapeHtml(assetUrl(question.image.src))}" alt="${escapeHtml(question.image.alt)}">
    ${question.image.caption ? `<figcaption>${escapeHtml(question.image.caption)}</figcaption>` : ""}
  </figure>`;
}

function renderChoices(question, response) {
  return `<div class="choice-list">${question.options.map((option, index) => `
    <button class="choice ${response === option ? "selected" : ""}" data-action="select-choice" data-value="${escapeHtml(option)}">
      <span class="choice-letter">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(option)}</span>
    </button>`).join("")}</div>`;
}

function renderVoiceAnswer(response) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return `<div class="answer-box">
    <textarea id="spoken-answer" placeholder="Your answer will appear here—or type it yourself." aria-label="Your answer">${escapeHtml(response)}</textarea>
    <div class="record-row">
      <button class="mic-button ${state.listening ? "listening" : ""}" data-action="toggle-mic" aria-label="${state.listening ? "Stop listening" : "Start speaking"}">${state.listening ? "■" : "●"}</button>
      <span class="voice-status">${state.listening ? "Listening… speak naturally" : SpeechRecognition ? "Tap to answer aloud" : "Voice recognition isn't available here—type your answer"}</span>
      <span class="chip">${SpeechRecognition ? "Voice ready" : "Typed mode"}</span>
    </div>
  </div>`;
}

function renderFeedback(feedback) {
  const title = feedback.status === "correct" ? "Correct" : feedback.status === "partial" ? "Almost there" : "Let's review";
  return `<div class="feedback ${feedback.status}" role="status"><h3>${title}</h3><p>${escapeHtml(feedback.message)} ${feedback.status !== "partial" ? escapeHtml(feedback.explanation) : ""}</p></div>`;
}

async function gradeCurrentAnswer() {
  const question = state.course.questions[state.questionIndex];
  const result = { ...gradeAnswer(question, state.selectedAnswer), explanation: question.explanation, hint: question.hint };
  state.feedback = result;
  if (result.status !== "partial") {
    state.responses[state.questionIndex] = {
      questionId: question.id,
      response: state.selectedAnswer,
      score: result.score,
      status: result.status
    };
  }
  renderQuiz();
  speak(result.status === "correct" ? `Correct. ${result.explanation}` : result.status === "partial" ? `${result.message} ${result.hint}` : `${result.message} ${result.explanation}`);
}

function startQuiz() {
  state.questionIndex = 0;
  state.responses = [];
  state.selectedAnswer = "";
  state.feedback = null;
  stopListening();
  renderQuiz();
  if (state.voiceSettings.autoRead) window.setTimeout(() => speakQuestion(), 350);
}

async function finishQuiz() {
  const points = state.responses.reduce((sum, response) => sum + response.score, 0);
  const score = Math.round((points / state.course.questions.length) * 100);
  const correct = state.responses.filter(({ status }) => status === "correct").length;
  const passed = score >= state.course.passingScore;
  saveAttempt({
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    courseId: state.course.id,
    completedAt: new Date().toISOString(),
    score,
    correct,
    total: state.course.questions.length,
    passed,
    mode: "mixed"
  });
  app.innerHTML = `
    <article class="result-card">
      <div class="result-ring" style="--score:${score}%"><strong>${score}%</strong></div>
      <p class="eyebrow">PRACTICE COMPLETE</p>
      <h2>${passed ? "Nicely done." : "Good practice."}</h2>
      <p>${passed ? `You passed the ${state.course.passingScore}% practice goal and answered ${correct} questions completely correctly.` : `You're building the vocabulary. Review the lessons and try for the ${state.course.passingScore}% practice goal when you're ready.`}</p>
      <div class="result-actions">
        <button class="button ghost" data-action="learn" data-course="${state.course.id}">Review lessons</button>
        <button class="button primary" data-action="retry">Practice again</button>
      </div>
    </article>`;
  speak(`${passed ? "Nicely done" : "Good practice"}. Your score is ${score} percent.`);
  scrollTop();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return notify("Text-to-speech isn't available in this browser.");
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.voiceSettings.rate;
  utterance.pitch = 1.03;
  utterance.voice = selectedVoice();
  window.speechSynthesis.speak(utterance);
}

function speakQuestion() {
  const question = state.course.questions[state.questionIndex];
  speak(`Question ${state.questionIndex + 1}. ${question.prompt}`);
}

function startListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return notify("Voice recognition isn't supported here. You can type your answer instead.");
  stopListening();
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  state.recognition = recognition;
  state.listening = true;
  recognition.onresult = (event) => {
    state.selectedAnswer = Array.from(event.results).map((result) => result[0].transcript).join(" ");
    const textarea = document.querySelector("#spoken-answer");
    if (textarea) textarea.value = state.selectedAnswer;
  };
  recognition.onerror = (event) => {
    state.listening = false;
    renderQuiz();
    notify(event.error === "not-allowed" ? "Microphone permission was not granted." : "I couldn't hear that. Try again or type your answer.");
  };
  recognition.onend = () => {
    state.listening = false;
    state.recognition = null;
    renderQuiz();
  };
  recognition.start();
  renderQuiz();
}

function stopListening() {
  if (state.recognition) state.recognition.stop();
  state.recognition = null;
  state.listening = false;
}

document.addEventListener("input", (event) => {
  if (event.target.id === "spoken-answer") {
    state.selectedAnswer = event.target.value;
    document.querySelector('[data-action="check-answer"]')?.toggleAttribute("disabled", !state.selectedAnswer.trim());
  }
  if (event.target.id === "voice-rate") {
    document.querySelector("#voice-rate-output").value = `${Number(event.target.value).toFixed(2)}×`;
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === "home") {
      window.speechSynthesis?.cancel();
      stopListening();
      await loadHome();
    } else if (action === "show-help") helpDialog.showModal();
    else if (action === "voice-settings") {
      populateVoiceSettings();
      voiceDialog.showModal();
    } else if (action === "preview-voice") {
      state.voiceSettings = readVoiceForm();
      speak("Here is how your study questions will sound. What is the dense flower head in the Asteraceae family called?");
    } else if (action === "reset-voice") {
      state.voiceSettings = { ...defaultVoiceSettings };
      populateVoiceSettings({ reset: true });
      speak("This is the recommended study voice on this device.");
    } else if (action === "learn") {
      await ensureCourse(target.dataset.course || state.course?.id);
      state.lessonIndex = 0;
      renderLesson();
    } else if (action === "quiz") {
      await ensureCourse(target.dataset.course || state.course?.id);
      startQuiz();
    } else if (action === "lesson") {
      state.lessonIndex = Number(target.dataset.index);
      renderLesson();
    } else if (action === "previous-lesson") {
      state.lessonIndex = Math.max(0, state.lessonIndex - 1);
      renderLesson();
    } else if (action === "next-lesson") {
      if (state.lessonIndex === state.course.lessons.length - 1) startQuiz();
      else { state.lessonIndex += 1; renderLesson(); }
    } else if (action === "speak-lesson") {
      const lesson = state.course.lessons[state.lessonIndex];
      speak(`${lesson.title}. ${lesson.body} ${lesson.term}. ${lesson.definition}. Memory tip. ${lesson.memoryTip}`);
    } else if (action === "speak-question") speakQuestion();
    else if (action === "select-choice") {
      if (!state.feedback) { state.selectedAnswer = target.dataset.value; renderQuiz(); }
    } else if (action === "toggle-mic") state.listening ? stopListening() : startListening();
    else if (action === "hint") {
      const question = state.course.questions[state.questionIndex];
      notify(question.hint);
      speak(`Hint. ${question.hint}`);
    } else if (action === "check-answer") await gradeCurrentAnswer();
    else if (action === "next-question") {
      if (state.questionIndex === state.course.questions.length - 1) await finishQuiz();
      else {
        state.questionIndex += 1;
        state.selectedAnswer = "";
        state.feedback = null;
        renderQuiz();
        if (state.voiceSettings.autoRead) window.setTimeout(() => speakQuestion(), 300);
      }
    } else if (action === "retry") startQuiz();
  } catch (error) {
    notify(error.message);
  }
});

document.querySelector("#voice-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.voiceSettings = readVoiceForm();
  localStorage.setItem("study-voice-settings", JSON.stringify(state.voiceSettings));
  window.speechSynthesis?.cancel();
  voiceDialog.close();
  notify("Voice settings saved on this device.");
});

async function init() {
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        if (voiceDialog.open) populateVoiceSettings();
      });
    }
    await loadHome();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(assetUrl("service-worker.js")).catch(() => {});
  } catch (error) {
    app.innerHTML = `<section class="result-card"><h2>We couldn't start the study app.</h2><p>${escapeHtml(error.message)}</p><button class="button primary" onclick="location.reload()">Try again</button></section>`;
  }
}

init();
