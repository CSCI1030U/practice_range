// Application entry point.

import { Game } from "./game.js";
import { CodeEditor } from "./editor.js";
import { Runner } from "./runner.js";
import { Progress } from "./progress.js";
import { loadManifest, loadLevel } from "./levels.js";
import { loadAssets } from "./assets.js";

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const game = new Game(canvas);

// Start asset preload in parallel with everything else.
loadAssets()
  .then((assets) => { game.setAssets(assets); })
  .catch((e) => console.warn("Asset load failed, using placeholders:", e));

const editor = new CodeEditor("editor");
const consoleEl = $("console");
const statusEl = $("status");
const runBtn = $("run-btn");
const stopBtn = $("stop-btn");
const resetBtn = $("reset-btn");
const speedBtn = $("speed-btn");
const scaleSelect = $("scale-select");
const overlayEl = $("game-overlay");
const overlayTitle = $("overlay-title");
const overlayBody = $("overlay-body");
const overlayNext = $("overlay-next");
const overlayRetry = $("overlay-retry");
const levelSelect = $("level-select");
const levelTitle = $("level-title");
const briefTitle = $("brief-title");
const briefBody = $("brief-body");
const apiRefBody = $("api-ref-body");
const solutionDisclosure = $("solution-disclosure");
const solutionBody = $("solution-body");

const SPEEDS = [1, 2, 4, 0.5];
let speedIdx = 0;

const progress = new Progress();
const runner = new Runner({
  game,
  consoleEl,
  onStatus: (s) => setStatus(s),
});

let manifest = [];
let currentLevel = null;

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

function localStorageKey(levelId) { return `python-game.code.${levelId}`; }

function loadSavedCode(level) {
  try {
    const v = localStorage.getItem(localStorageKey(level.id));
    return v !== null ? v : (level.starterCode || "");
  } catch {
    return level.starterCode || "";
  }
}

function saveCode(level, code) {
  try { localStorage.setItem(localStorageKey(level.id), code); } catch {}
}

function populateLevelSelect() {
  levelSelect.innerHTML = "";
  let lastTopic = null;
  let group = null;
  for (const entry of manifest) {
    if (entry.topic !== lastTopic) {
      group = document.createElement("optgroup");
      group.label = entry.topicLabel || entry.topic;
      levelSelect.appendChild(group);
      lastTopic = entry.topic;
    }
    const opt = document.createElement("option");
    opt.value = entry.id;
    const lock = progress.isUnlocked(entry.id, manifest) ? "" : " 🔒";
    const done = progress.isComplete(entry.id) ? " ✓" : "";
    const KIND_LABELS = {
      "demo": " (demo)",
      "activity": " (activity)",
      "homework": " (homework)",
      "in-class": " (in-class)",
      "practice": " (practice)",
    };
    const kind = KIND_LABELS[entry.kind] || "";
    opt.textContent = entry.title + kind + done + lock;
    opt.disabled = !progress.isUnlocked(entry.id, manifest);
    group.appendChild(opt);
  }
}

function renderBrief(level) {
  briefTitle.textContent = level.title;
  briefBody.innerHTML = level.brief || "";
  if (level.api && level.api.length) {
    apiRefBody.innerHTML = "<ul>" +
      level.api.map(n => `<li><code>${n}</code></li>`).join("") +
      "</ul>";
  } else {
    apiRefBody.innerHTML = "<p class='sys'>All commands available — see full reference in docs.</p>";
  }
  if (level.solution) {
    solutionBody.textContent = level.solution;
    solutionDisclosure.hidden = false;
    solutionDisclosure.open = false;  // closed by default
  } else {
    solutionDisclosure.hidden = true;
  }
}

async function activateLevel(id, { keepCode = false } = {}) {
  hideOverlay();
  setStatus("Loading level…");
  try {
    const level = await loadLevel(id);
    currentLevel = level;
    levelTitle.textContent = level.kind ? `· ${level.kind}` : "";
    game.loadLevel(level);
    renderBrief(level);
    if (!keepCode) {
      editor.setValue(loadSavedCode(level));
    }
    setStatus(runner.pyodide ? "Ready" : "Loading Python…");
    levelSelect.value = id;
  } catch (e) {
    setStatus(`Failed to load ${id}: ${e.message}`, "error");
    console.error(e);
  }
}

function hideOverlay() { overlayEl.classList.add("hidden"); }
function showOverlay(title, body, opts = {}) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlayNext.style.display = opts.hasNext ? "" : "none";
  overlayRetry.style.display = "";
  overlayEl.classList.remove("hidden");
}

function nextLevelId(id) {
  const i = manifest.findIndex(l => l.id === id);
  if (i < 0 || i >= manifest.length - 1) return null;
  return manifest[i + 1].id;
}

async function onRun() {
  runBtn.disabled = true;
  stopBtn.disabled = false;
  resetBtn.disabled = true;
  levelSelect.disabled = true;
  editor.setReadOnly(true);
  runner.clearConsole();
  hideOverlay();
  setStatus("Running…", "running");
  const code = editor.getValue();
  saveCode(currentLevel, code);

  let result;
  try {
    result = await runner.run(code);
  } catch (e) {
    result = { error: e.message };
  }

  runBtn.disabled = false;
  stopBtn.disabled = true;
  resetBtn.disabled = false;
  levelSelect.disabled = false;
  editor.setReadOnly(false);

  if (result.aborted) {
    setStatus("Stopped", "");
    return;
  }
  if (result.error) {
    setStatus("Error", "error");
    return;
  }
  if (result.win) {
    setStatus("Solved!", "success");
    const wasFirstTime = !progress.isComplete(currentLevel.id);
    progress.markComplete(currentLevel.id);
    populateLevelSelect();
    levelSelect.value = currentLevel.id;
    const next = nextLevelId(currentLevel.id);
    let body;
    if (wasFirstTime && next) {
      body = "Nicely done. Ready for the next one?";
    } else if (wasFirstTime && !next) {
      body = "Nicely done — that was the last level!";
    } else if (!wasFirstTime && next) {
      body = "Solved again. Try another approach?";
    } else {
      body = "Solved again — and that was the last level!";
    }
    showOverlay("Level Complete!", body, { hasNext: !!next });
  } else {
    setStatus("Try again", "error");
    showOverlay(
      "Not quite",
      "Your code ran without errors, but didn't solve the level. Adjust and try again.",
      { hasNext: false }
    );
  }
}

function onStop() {
  runner.stop();
  setStatus("Stopping…", "");
}

function onReset() {
  if (currentLevel) {
    game.loadLevel(currentLevel);
    hideOverlay();
    setStatus("Reset");
  }
}

function onSpeedToggle() {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  const s = SPEEDS[speedIdx];
  game.setSpeed(s);
  speedBtn.textContent = `Speed: ${s}×`;
}

const SCALE_KEY = "python-game.scale";

function applyScale(n) {
  game.setScale(n);
  try { localStorage.setItem(SCALE_KEY, String(n)); } catch {}
}

function loadSavedScale() {
  try {
    const v = parseInt(localStorage.getItem(SCALE_KEY), 10);
    if (v >= 1 && v <= 6) return v;
  } catch {}
  return 2;
}

overlayNext.addEventListener("click", () => {
  const n = nextLevelId(currentLevel.id);
  if (n) activateLevel(n);
});
overlayRetry.addEventListener("click", () => {
  hideOverlay();
  game.loadLevel(currentLevel);
});

// Re-fit the canvas when the window changes size, so the level keeps being
// drawn at a whole-number scale rather than being squeezed by CSS.
let refitTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => game.refitScale(), 100);
});

runBtn.addEventListener("click", onRun);
stopBtn.addEventListener("click", onStop);
resetBtn.addEventListener("click", onReset);
speedBtn.addEventListener("click", onSpeedToggle);
scaleSelect.addEventListener("change", (e) => {
  applyScale(parseInt(e.target.value, 10));
});
levelSelect.addEventListener("change", (e) => {
  activateLevel(e.target.value);
});

// Keyboard shortcut: Ctrl/Cmd + Enter to run
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!runBtn.disabled) onRun();
  }
});

// ----- bootstrap -----

(async () => {
  const initialScale = loadSavedScale();
  game.setScale(initialScale);
  scaleSelect.value = String(initialScale);

  try {
    manifest = await loadManifest();
  } catch (e) {
    setStatus("Failed to load levels", "error");
    console.error(e);
    return;
  }
  populateLevelSelect();
  // pick first unlocked, last-completed level if any, else first level
  const firstId = manifest[0].id;
  await activateLevel(firstId);

  // Kick off Pyodide load in the background.
  runner.load().then(() => {
    setStatus("Ready");
    runBtn.disabled = false;
    runBtn.textContent = "▶ Run (Ctrl+Enter)";
  }).catch((e) => {
    setStatus("Failed to load Python: " + e.message, "error");
  });
})();
