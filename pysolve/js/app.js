/*
 * app.js - UI wiring: load problems, set up the editor, run code and tests.
 */
(function () {
  const $ = (sel) => document.querySelector(sel);

  const statusEl = $("#status");
  const selectEl = $("#problem-select");
  const categoryEl = $("#category-select");
  const btnRun = $("#btn-run");
  const btnTest = $("#btn-test");
  const btnStop = $("#btn-stop");
  const btnReset = $("#btn-reset");
  const outputEl = $("#output");

  const REVEAL_KEY = "pysolve:revealed"; // ids of debugging problems whose type is shown

  // Categories that grant a completion certificate when all their problems are
  // solved. Add more here later (e.g. "Strings") to extend certificates.
  const CERT_CATEGORIES = ["Debugging"];

  // ---- achievements ----
  const MEDAL = { gold: "🥇", silver: "🥈", bronze: "🥉" };
  // Tier awarded for completing each category (harder categories → gold).
  const CATEGORY_TIER = {
    "General Challenges": "silver",
    Strings: "silver",
    Lists: "silver",
    Recursion: "silver",
    "Data Structures": "gold",
    "Algorithm Design & Analysis": "gold",
    Debugging: "bronze",
  };
  // Non-category achievement definitions. Category and "all categories" ones are
  // generated from the manifest so they adapt as categories are added.
  const ACHIEVEMENT_DEFS = {
    "first-solve": { title: "First Steps", desc: "Solve your first problem.", tier: "bronze" },
    "solve-10": { title: "Getting the Hang of It", desc: "Solve 10 problems.", tier: "bronze" },
    "solve-25": { title: "Dedicated", desc: "Solve 25 problems.", tier: "silver" },
    "solve-50": { title: "Half Century", desc: "Solve 50 problems.", tier: "gold" },
    "points-1000": { title: "Four Figures", desc: "Earn 1,000 points.", tier: "silver" },
    "points-3000": { title: "Point Hoarder", desc: "Earn 3,000 points.", tier: "gold" },
    speed: { title: "Speed Solver", desc: "Solve a problem in under a minute.", tier: "silver" },
    flawless: { title: "Flawless", desc: "Pass every test on your first attempt.", tier: "silver" },
    "all-categories": { title: "Completionist", desc: "Complete every category.", tier: "gold" },
    unaided: { title: "Unaided", desc: "Complete a whole category without revealing any hints.", tier: "gold" },
    "no-paste": { title: "From Scratch", desc: "Complete a whole category without pasting in a full solution.", tier: "gold" },
  };

  // Hints revealed after a failed attempt on a debugging problem.
  const HINTS = {
    syntax:
      "Syntax error - the program won't even start. Look for a mistake in the Python grammar itself (a missing symbol, wrong operator, bad indentation).",
    runtime:
      "Runtime error - the program starts but crashes partway through. Read the error message and trace which line and value caused it.",
    logic:
      "Logic error - the program runs without crashing but gives the wrong answer. Compare what it actually does to what it's supposed to do.",
    multiple:
      "Multiple bugs - this program has more than one error, and they may be of different kinds (syntax, runtime, and/or logic). Fixing just one won't be enough; keep going until every test passes.",
  };
  const TYPE_LABELS = {
    syntax: "syntax error",
    runtime: "runtime error",
    logic: "logic error",
    multiple: "multiple bugs",
  };

  // ---- themes ----
  // `dark` selects the matching CodeMirror editor theme (dark vs light).
  const THEME_KEY = "pysolve:theme";
  const THEMES = [
    { id: "carbon", name: "Carbon (dark)", dark: true },
    { id: "ontario-dark", name: "Ontario Tech - Dark", dark: true },
    { id: "forest-dark", name: "Forest (dark)", dark: true },
    { id: "ontario-light", name: "Ontario Tech - Light", dark: false },
    { id: "paper", name: "Paper (light)", dark: false },
    { id: "sky", name: "Sky (light)", dark: false },
    { id: "high-contrast", name: "High Contrast", dark: true },
    { id: "colorblind", name: "Colour-Blind Friendly", dark: false },
  ];
  function themeById(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }
  function cmThemeFor(id) {
    return themeById(id).dark ? "material-darker" : "default";
  }
  function currentTheme() {
    const id = localStorage.getItem(THEME_KEY);
    return THEMES.some((t) => t.id === id) ? id : "carbon";
  }
  function applyTheme(id) {
    document.documentElement.setAttribute("data-theme", id);
    // Editor (syntax-highlighting) theme is an independent preference - see
    // EDITOR_THEMES below - so we deliberately don't touch it here.
    localStorage.setItem(THEME_KEY, id);
  }

  // ---- editor (CodeMirror) syntax-highlighting themes ----
  // Independent of the app theme; the user picks one in the code panel header.
  const EDITOR_THEME_KEY = "pysolve:editor-theme";
  const EDITOR_THEMES = [
    // Light themes
    { id: "default",         name: "Default (light)" },
    { id: "eclipse",         name: "Eclipse (light)" },
    { id: "neat",            name: "Neat (light)" },
    { id: "idea",            name: "IDEA (light)" },
    { id: "mdn-like",        name: "MDN-like (light)" },
    { id: "solarized light", name: "Solarized Light (light)" },
    // Dark themes
    { id: "material-darker",       name: "Material Darker (dark)" },
    { id: "monokai",               name: "Monokai (dark)" },
    { id: "dracula",               name: "Dracula (dark)" },
    { id: "ayu-dark",              name: "Ayu Dark (dark)" },
    { id: "nord",                  name: "Nord (dark)" },
    { id: "solarized dark",        name: "Solarized Dark (dark)" },
    { id: "cobalt",                name: "Cobalt (dark)" },
    { id: "material-ocean",        name: "Material Ocean (dark)" },
    { id: "blackboard",            name: "Blackboard (dark)" },
    { id: "vibrant-ink",           name: "Vibrant Ink (dark)" },
    { id: "the-matrix",            name: "The Matrix (dark)" },
    { id: "tomorrow-night-bright", name: "Tomorrow Night Bright (dark)" },
    { id: "night",                 name: "Night (dark)" },
    { id: "moxer",                 name: "Moxer (dark)" },
  ];
  function currentEditorTheme() {
    const id = localStorage.getItem(EDITOR_THEME_KEY);
    return EDITOR_THEMES.some((t) => t.id === id) ? id : "material-darker";
  }
  function applyEditorTheme(id) {
    if (editor) editor.setOption("theme", id);
    localStorage.setItem(EDITOR_THEME_KEY, id);
  }

  let editor = null;
  let manifest = [];
  let categories = []; // normalized [{ name, problems: [{ file, title }] }]
  let fileToId = {}; // problem file path -> problem id (built on boot)
  let pointsById = {}; // problem id -> current points (built on boot)
  let current = null; // current problem object
  let solvedSet = new Set(); // problem ids the current player has solved
  let revealed = loadRevealed(); // ids whose error-type hint has been revealed
  let earnedAchievements = new Set(); // achievement ids earned by current player
  let problemStartTime = 0; // when the current problem was opened (for speed)
  let failedAttempts = new Set(); // problem ids with a failed check this session
  let pasteNudged = false; // whether the paste nudge has shown for this problem
  let hintsShown = loadHints(); // { problemId: number of hints revealed }

  function loadRevealed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(REVEAL_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }
  function saveRevealed() {
    localStorage.setItem(REVEAL_KEY, JSON.stringify([...revealed]));
  }

  const HINTS_KEY = "pysolve:hints";
  function loadHints() {
    try {
      return JSON.parse(localStorage.getItem(HINTS_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveHints() {
    localStorage.setItem(HINTS_KEY, JSON.stringify(hintsShown));
  }

  const PASTED_KEY = "pysolve:pasted"; // ids of problems with a whole-code paste
  let pastedSet = loadPasted();
  let hintAvailable = new Set(); // ids of problems that ship with hints (built on boot)
  function loadPasted() {
    try {
      return new Set(JSON.parse(localStorage.getItem(PASTED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }
  function savePasted() {
    localStorage.setItem(PASTED_KEY, JSON.stringify([...pastedSet]));
  }

  // ---- CodeMirror editor ----
  editor = CodeMirror.fromTextArea($("#code"), {
    mode: "python",
    theme: currentEditorTheme(),
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    extraKeys: {
      Tab: (cm) => cm.replaceSelection("    "),
    },
  });

  // ---- status helper ----
  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  // ---- output comparison ----
  // Compare leniently: ignore trailing spaces on each line and trailing blank
  // lines, so a missing/extra final newline doesn't fail an otherwise-correct
  // answer. This matches typical judge behaviour for beginner exercises.
  function normalize(text) {
    return String(text)
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/\n+$/, "");
  }
  function outputsMatch(actual, expected) {
    return normalize(actual) === normalize(expected);
  }

  // ---- problem loading ----
  async function loadManifest() {
    const res = await fetch("problems/manifest.json");
    if (!res.ok) throw new Error("Could not load problems/manifest.json");
    manifest = await res.json();
    // Accept either the categorized format ({ categories: [{ name, problems }] })
    // or a plain flat array of { file, title } (treated as one unnamed group).
    categories = Array.isArray(manifest)
      ? [{ name: "Problems", problems: manifest }]
      : manifest.categories || [];
    // Fill the category dropdown; each option's value is its index in `categories`.
    categoryEl.innerHTML = "";
    categories.forEach((cat, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = cat.name || "Problems";
      categoryEl.appendChild(opt);
    });
    // Populate the problem dropdown for the first category.
    populateProblems(0);
  }

  // Fill the problem dropdown with the problems of category `index`.
  function populateProblems(index) {
    const cat = categories[index] || { problems: [] };
    selectEl.innerHTML = "";
    for (const entry of cat.problems || []) {
      const opt = document.createElement("option");
      opt.value = entry.file;
      opt.dataset.title = entry.title; // base label, before any ✓ prefix
      opt.textContent = entry.title;
      selectEl.appendChild(opt);
    }
    refreshProblemList();
  }

  // Mark solved problems in the dropdown with a leading ✓. The option value is
  // a file path, so we map it to the problem id (built in buildPointsMap) and
  // check it against the current player's solved set.
  function refreshProblemList() {
    for (const opt of selectEl.options) {
      const base = opt.dataset.title || opt.textContent;
      const id = fileToId[opt.value];
      const done = id && solvedSet.has(id);
      opt.textContent = (done ? "✓ " : "") + base;
    }
  }

  async function loadProblem(file) {
    const res = await fetch("problems/" + file);
    if (!res.ok) throw new Error("Could not load problem " + file);
    current = await res.json();
    renderProblem();
  }

  function storageKey() {
    return "pysolve:code:" + (current ? current.id : "unknown");
  }

  function renderProblem() {
    renderMeta();
    renderDescription();
    // Restore the student's saved work for this problem, else starter code.
    const saved = localStorage.getItem(storageKey());
    editor.setValue(saved != null ? saved : current.starterCode || "");
    // Prefill stdin with the first test's input as a convenience.
    if (current.tests && current.tests.length) {
      $("#stdin").value = current.tests[0].input || "";
    }
    pasteNudged = false; // re-arm the paste nudge for the new problem
    updateEditedPill();
    clearOutput();
    switchTab("run");
    problemStartTime = Date.now(); // for the speed achievement
  }

  // Render the problem description followed by the (progressively revealed) hints.
  function renderDescription() {
    $("#problem-body").innerHTML = marked.parse(current.description || "") + hintsHtml();
  }

  // Tiered hints: revealed one at a time, on request. Stored per problem so they
  // stay revealed when the student returns. Hint text may use Markdown (e.g. a
  // fenced code block for the pseudocode hint).
  function hintsHtml() {
    const hints = current && current.hints;
    if (!hints || !hints.length) return "";
    const shown = hintsShown[current.id] || 0;
    let html = '<div class="hints" id="hints"><h3>Hints</h3>';
    for (let i = 0; i < shown && i < hints.length; i++) {
      html +=
        `<div class="hint-box"><div class="hint-label">Hint ${i + 1} of ${hints.length}</div>` +
        `${marked.parse(hints[i])}</div>`;
    }
    if (shown < hints.length) {
      const label = shown === 0 ? "Show a hint" : `Show next hint (${shown + 1} of ${hints.length})`;
      html += `<button id="hint-btn" class="btn ghost hint-btn">💡 ${label}</button>`;
    } else {
      html += '<div class="hint-allshown">All hints shown.</div>';
    }
    return html + "</div>";
  }

  function revealHint() {
    if (!current || !current.hints) return;
    const shown = hintsShown[current.id] || 0;
    if (shown >= current.hints.length) return;
    hintsShown[current.id] = shown + 1;
    saveHints();
    renderDescription();
    const h = $("#hints");
    if (h) h.scrollIntoView({ block: "nearest" });
  }

  // A debugging problem is one that carries an errorType - its starter code is a
  // buggy program the student must fix.
  function isDebugProblem() {
    return !!(current && current.errorType);
  }

  function renderMeta() {
    const diff = (current.difficulty || "").toLowerCase();
    const pts = current.points || 0;
    const solved = solvedSet.has(current.id);
    const showType = isDebugProblem() && revealed.has(current.id);
    const parts = [];
    if (diff) parts.push(`<span class="pill ${diff}">${escapeHtml(current.difficulty)}</span>`);
    parts.push(`<span class="pill points">${pts} pts</span>`);
    if (showType) {
      const label = TYPE_LABELS[current.errorType] || current.errorType;
      parts.push(`<span class="pill errtype">${escapeHtml(label)}</span>`);
    }
    if (solved) parts.push(`<span class="pill solved">✓ Solved</span>`);
    let html = parts.join("");
    if (showType && HINTS[current.errorType]) {
      html += `<div class="hint">💡 ${escapeHtml(HINTS[current.errorType])}</div>`;
    }
    $("#problem-meta").innerHTML = html;
  }

  // Show an "edited" marker when a debugging problem's code differs from the
  // original buggy starter, so it's clear when a saved/edited version is shown.
  function updateEditedPill() {
    const edited = isDebugProblem() && editor.getValue() !== (current.starterCode || "");
    $("#edited-pill").hidden = !edited;
  }

  // Reveal the error-type hint after a failed attempt on a debugging problem.
  function revealCategory() {
    if (isDebugProblem() && !revealed.has(current.id)) {
      revealed.add(current.id);
      saveRevealed();
      renderMeta();
    }
  }

  function clearOutput() {
    outputEl.textContent = "";
    outputEl.className = "output";
    $("#test-summary").textContent = "";
    $("#test-summary").className = "test-summary";
    $("#test-results").innerHTML = "";
  }

  // Toggle the running state: while code runs, Run/Tests are disabled and Stop
  // is enabled. (When stopped, the stop handler manages the buttons instead.)
  function setRunning(on) {
    btnRun.disabled = on;
    btnTest.disabled = on;
    btnStop.disabled = !on;
  }

  // ---- run a single custom input ----
  async function doRun() {
    if (!PyRunner.isReady()) return;
    switchTab("run");
    outputEl.className = "output";
    outputEl.textContent = "Running…";
    saveCode();
    setRunning(true);
    const res = await PyRunner.run(editor.getValue(), $("#stdin").value);
    if (res.stopped) return; // UI handled by the stop button
    setRunning(false);
    if (res.error) {
      outputEl.className = "output err";
      outputEl.textContent = (res.stdout || "") + "\n" + res.error;
    } else {
      outputEl.textContent = res.stdout || "(no output)";
    }
  }

  // ---- run all tests ----
  async function doTests() {
    if (!PyRunner.isReady() || !current.tests) return;
    switchTab("tests");
    const resultsEl = $("#test-results");
    const summaryEl = $("#test-summary");
    resultsEl.innerHTML = "";
    summaryEl.textContent = "Running tests…";
    summaryEl.className = "test-summary";
    saveCode();
    setRunning(true);

    const source = editor.getValue();
    let passed = 0;

    for (let i = 0; i < current.tests.length; i++) {
      const t = current.tests[i];
      const res = await PyRunner.run(source, t.input || "");
      if (res.stopped) return; // aborted mid-run; stop handler manages the UI
      const ok = !res.error && outputsMatch(res.stdout, t.expectedOutput || "");
      if (ok) passed++;
      resultsEl.appendChild(renderTestCase(i, t, res.stdout, res.error, ok));
    }

    setRunning(false);
    const total = current.tests.length;
    const allPass = passed === total;
    summaryEl.textContent = `${passed} / ${total} tests passed` + (allPass ? "  🎉" : "");
    summaryEl.className = "test-summary " + (allPass ? "pass" : "fail");

    if (allPass) {
      await awardPoints();
    } else {
      failedAttempts.add(current.id); // affects the Flawless achievement
      revealCategory(); // failed attempt on a debugging problem reveals its hint
    }
  }

  // Called when every test passes: ensure the player has a nickname, record the
  // solve, refresh the UI, and evaluate achievements (with this solve's speed
  // and flawlessness).
  async function awardPoints() {
    const nick = await ensureNickname();
    if (!nick) return; // player declined to sign in
    const elapsedMs = problemStartTime ? Date.now() - problemStartTime : null;
    const flawless = !failedAttempts.has(current.id);
    const certBefore = eligibleCertCategory();
    const { newBest, total } = await Scores.recordSolve(current.id, current.points || 0);
    solvedSet.add(current.id);
    renderMeta();
    refreshProblemList();
    updateCertificate();
    await refreshScore();
    await renderBoard();
    if (newBest) showToast(`✓ Solved! +${current.points || 0} pts - total ${total}`);
    if (eligibleCertCategory() && !certBefore) {
      showToast("🏅 Certificate available - open your profile to download it.");
    }
    await evaluateAchievements({ elapsedMs, flawless });
    if (!$("#profile-modal").hidden) refreshProfile();
  }

  // ---- completion certificate (per category; computed from the manifest) ----
  // The set of problem ids in a category is derived at runtime, so adding more
  // problems to a certificate category automatically raises the bar.
  function categoryIds(name) {
    const cat = categories.find((c) => c.name === name);
    return cat ? (cat.problems || []).map((e) => fileToId[e.file]).filter(Boolean) : [];
  }
  function isCategoryComplete(name) {
    const ids = categoryIds(name);
    return ids.length > 0 && ids.every((id) => solvedSet.has(id));
  }
  // Return the name of the first certificate-granting category that's complete,
  // or null. (Today there's just one; the list can grow later.)
  function eligibleCertCategory() {
    return CERT_CATEGORIES.find((name) => isCategoryComplete(name)) || null;
  }
  function updateCertificate() {
    const eligible = !!eligibleCertCategory();
    $("#profile-cert").hidden = !eligible;
    $("#profile-cert-note").hidden = eligible;
    $("#cert-indicator").hidden = !eligible;
  }

  // ---- achievement engine ----
  // Total points = sum of the current point value of each solved problem.
  function totalPoints() {
    let t = 0;
    for (const id of solvedSet) t += pointsById[id] || 0;
    return t;
  }
  // Look up the display info for any achievement id (category ids are dynamic).
  function achievementDef(id) {
    if (id.startsWith("cat:")) {
      const name = id.slice(4);
      return {
        title: "Completed: " + name,
        desc: "Solve every problem in " + name + ".",
        tier: CATEGORY_TIER[name] || "silver",
      };
    }
    return ACHIEVEMENT_DEFS[id] || { title: id, desc: "", tier: "bronze" };
  }
  // Fixed display order for the achievements panel.
  function orderedAchievementIds() {
    return [
      "first-solve", "solve-10", "solve-25", "solve-50",
      "points-1000", "points-3000", "speed", "flawless",
      ...categories.map((c) => "cat:" + c.name),
      "all-categories", "unaided", "no-paste",
    ];
  }
  // Which achievements are satisfied right now, given persistent state plus the
  // momentary context of a just-completed solve (speed/flawless).
  function computeEarned(ctx) {
    const s = new Set();
    const n = solvedSet.size;
    const pts = totalPoints();
    if (n >= 1) s.add("first-solve");
    if (n >= 10) s.add("solve-10");
    if (n >= 25) s.add("solve-25");
    if (n >= 50) s.add("solve-50");
    if (pts >= 1000) s.add("points-1000");
    if (pts >= 3000) s.add("points-3000");
    let allCats = categories.length > 0;
    for (const c of categories) {
      if (!isCategoryComplete(c.name)) {
        allCats = false;
        continue;
      }
      s.add("cat:" + c.name);
      const ids = categoryIds(c.name);
      // Unaided: the category offers hints, but none were revealed on any of its
      // problems. (Categories with no hints, like Debugging, don't qualify.)
      if (ids.some((id) => hintAvailable.has(id)) && ids.every((id) => !(hintsShown[id] > 0))) {
        s.add("unaided");
      }
      // From Scratch: no whole-code paste on any problem in the category.
      if (ids.every((id) => !pastedSet.has(id))) {
        s.add("no-paste");
      }
    }
    if (allCats) s.add("all-categories");
    if (ctx.elapsedMs != null && ctx.elapsedMs < 60000) s.add("speed");
    if (ctx.flawless) s.add("flawless");
    return s;
  }
  // Evaluate achievements, persist any newly earned, and (unless silent) toast
  // each one. Called after a solve, and silently on boot / nickname change.
  async function evaluateAchievements(ctx = {}) {
    const nick = await Scores.getNickname();
    if (!nick) return;
    const earnedNow = computeEarned(ctx);
    const newly = [...earnedNow].filter((id) => !earnedAchievements.has(id));
    if (!newly.length) return;
    newly.forEach((id) => earnedAchievements.add(id));
    await Scores.setAchievements([...earnedAchievements]);
    if (!ctx.silent) {
      for (const id of newly) {
        const d = achievementDef(id);
        showToast(`${MEDAL[d.tier] || "🏅"} Achievement unlocked: ${d.title}`);
      }
    }
    renderAchievements();
  }

  // Generate and download a PDF certificate for the completed category. The
  // design lives in the #certificate HTML template (styled in styles.css).
  async function downloadCertificate() {
    const category = eligibleCertCategory();
    if (!category) return;
    const nick = (await Scores.getNickname()) || "Anonymous";
    const displayName = (await Scores.getFullName()) || nick;
    const ids = categoryIds(category);
    const count = ids.length;
    const points = ids.reduce((sum, id) => sum + (pointsById[id] || 0), 0);
    const date = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Fill the template. Wording adapts to the category (debugging vs others).
    $("#cert-name").textContent = displayName;
    if (category === "Debugging") {
      $("#cert-line").textContent =
        `has successfully fixed all ${count} debugging ` +
        `${count === 1 ? "challenge" : "challenges"}, earning ${points} points.`;
    } else {
      $("#cert-line").textContent =
        `has successfully completed all ${count} ${category} ` +
        `${count === 1 ? "problem" : "problems"}, earning ${points} points.`;
    }
    $("#cert-date").textContent = date;

    const cert = $("#certificate");
    const canvas = await html2canvas(cert, { scale: 3, backgroundColor: null, useCORS: true });
    const img = canvas.toDataURL("image/png");
    const w = cert.offsetWidth;
    const h = cert.offsetHeight;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: w >= h ? "landscape" : "portrait",
      unit: "px",
      format: [w, h],
    });
    doc.addImage(img, "PNG", 0, 0, w, h);
    const safe = displayName.replace(/[^A-Za-z0-9_-]/g, "_") || "certificate";
    doc.save(`CodeForge-Certificate-${safe}.pdf`);
  }

  async function refreshScore() {
    const board = await Scores.getLeaderboard();
    const nick = await Scores.getNickname();
    const me = board.find((r) => r.nick === nick);
    const total = me ? me.total : 0;
    $("#profile-label").textContent = nick ? `${nick} · ${total} pts` : "Sign in";
    if (!$("#profile-modal").hidden) $("#profile-score").textContent = total + " pts";
  }

  // ---- profile menu ----
  function renderAchievements() {
    const listEl = $("#achievement-list");
    if (!listEl) return;
    const ids = orderedAchievementIds();
    listEl.innerHTML = "";
    let earned = 0;
    for (const id of ids) {
      const d = achievementDef(id);
      const has = earnedAchievements.has(id);
      if (has) earned++;
      const card = document.createElement("div");
      card.className = "achievement " + (has ? "earned" : "locked");
      card.innerHTML =
        `<div class="ach-medal">${MEDAL[d.tier] || "🏅"}</div>` +
        `<div class="ach-info"><h5>${escapeHtml(d.title)}</h5><p>${escapeHtml(d.desc)}</p></div>`;
      listEl.appendChild(card);
    }
    $("#ach-count").textContent = `(${earned} / ${ids.length})`;
  }

  async function refreshProfile() {
    const nick = await Scores.getNickname();
    $("#profile-nick").textContent = nick || "-";
    $("#profile-score").textContent = totalPoints() + " pts";
    updateCertificate();
    renderAchievements();
  }

  async function openProfile() {
    await refreshProfile();
    $("#profile-modal").hidden = false;
  }
  function closeProfile() {
    $("#profile-modal").hidden = true;
  }

  // ---- leaderboard ----
  async function renderBoard() {
    const board = await Scores.getLeaderboard();
    const nick = await Scores.getNickname();
    const body = $("#board-body");
    body.innerHTML = "";
    $("#board-empty").style.display = board.length ? "none" : "";
    board.forEach((row, i) => {
      const tr = document.createElement("tr");
      if (row.nick === nick) tr.className = "me";
      tr.innerHTML =
        `<td>${i + 1}</td>` +
        `<td>${escapeHtml(row.nick)}</td>` +
        `<td>${row.solved}</td>` +
        `<td>${row.total}</td>`;
      body.appendChild(tr);
    });
  }

  function renderTestCase(i, t, actual, error, ok) {
    const wrap = document.createElement("div");
    wrap.className = "test-case " + (ok ? "pass" : "fail");

    const head = document.createElement("div");
    head.className = "tc-head";
    head.innerHTML =
      `<span class="tc-badge">${ok ? "✓" : "✗"}</span>` +
      `<span>${t.name || "Test " + (i + 1)}</span>`;
    head.addEventListener("click", () => wrap.classList.toggle("open"));

    const body = document.createElement("div");
    body.className = "tc-body";
    const actualText = error ? (actual || "") + "\n" + error : actual;
    body.innerHTML =
      col("Input", t.input || "(none)", false) +
      col("Expected", t.expectedOutput || "", false) +
      col(error ? "Error" : "Your output", actualText || "(no output)", !ok);

    wrap.appendChild(head);
    wrap.appendChild(body);
    if (!ok) wrap.classList.add("open"); // auto-expand failures
    return wrap;
  }

  function col(title, text, mismatch) {
    return (
      `<div class="tc-col${mismatch ? " mismatch" : ""}">` +
      `<h4>${title}</h4><pre>${escapeHtml(text)}</pre></div>`
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---- persistence ----
  function saveCode() {
    if (current) localStorage.setItem(storageKey(), editor.getValue());
  }

  // ---- nickname modal ----
  // Resolves with a valid nickname (opening the modal if one isn't set yet),
  // or null if the player cancels.
  let nickResolve = null;
  function ensureNickname() {
    return Scores.getNickname().then((nick) => (nick ? nick : openNickModal()));
  }
  async function openNickModal(prefill) {
    $("#name-input").value = await Scores.getFullName();
    return new Promise((resolve) => {
      nickResolve = resolve;
      $("#nick-input").value = prefill || "";
      $("#nick-error").textContent = "";
      $("#nick-modal").hidden = false;
      $("#nick-input").focus();
    });
  }
  function closeNickModal(value) {
    $("#nick-modal").hidden = true;
    const r = nickResolve;
    nickResolve = null;
    if (r) r(value);
  }
  async function trySaveNick() {
    const result = Sanitize.sanitizeNickname($("#nick-input").value);
    if (!result.ok) {
      $("#nick-error").textContent = result.reason;
      return;
    }
    await Scores.setNickname(result.value);
    await Scores.setFullName(Sanitize.sanitizeFullName($("#name-input").value));
    // Refresh state for the (possibly new) player.
    solvedSet = await Scores.getSolved();
    earnedAchievements = new Set(await Scores.getAchievements());
    await evaluateAchievements({ silent: true }); // grant any already-satisfied
    renderMeta();
    refreshProblemList();
    updateCertificate();
    await refreshScore();
    await renderBoard();
    await refreshProfile();
    closeNickModal(result.value);
  }
  $("#btn-profile").addEventListener("click", () => openProfile().catch(showError));
  $("#profile-close").addEventListener("click", closeProfile);
  $("#profile-modal").addEventListener("click", (e) => {
    if (e.target.id === "profile-modal") closeProfile(); // click backdrop to close
  });
  $("#profile-change-nick").addEventListener("click", () =>
    Scores.getNickname().then((n) => openNickModal(n || ""))
  );
  $("#profile-cert").addEventListener("click", () => downloadCertificate().catch(showError));

  // ---- theme picker ----
  (function setupThemes() {
    const sel = $("#theme-select");
    for (const t of THEMES) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    }
    sel.value = currentTheme();
    applyTheme(sel.value); // ensure attribute is in sync on load
    sel.addEventListener("change", () => applyTheme(sel.value));
  })();

  // ---- editor (syntax-highlighting) theme picker ----
  (function setupEditorThemes() {
    const sel = $("#editor-theme-select");
    for (const t of EDITOR_THEMES) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    }
    sel.value = currentEditorTheme();
    sel.addEventListener("change", () => applyEditorTheme(sel.value));
  })();

  $("#nick-save").addEventListener("click", trySaveNick);
  $("#nick-cancel").addEventListener("click", () => closeNickModal(null));
  $("#nick-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySaveNick();
    if (e.key === "Escape") closeNickModal(null);
  });

  // ---- toast (queued, so several achievements show in sequence) ----
  const toastQueue = [];
  let toastShowing = false;
  function showToast(msg) {
    toastQueue.push(msg);
    if (!toastShowing) nextToast();
  }
  function nextToast() {
    const el = $("#toast");
    if (!toastQueue.length) {
      toastShowing = false;
      return;
    }
    toastShowing = true;
    el.textContent = toastQueue.shift();
    el.hidden = false;
    el.classList.remove("fade");
    setTimeout(() => {
      el.classList.add("fade");
      setTimeout(() => {
        el.hidden = true;
        nextToast();
      }, 300);
    }, 2200);
  }

  // ---- tabs ----
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === name)
    );
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.dataset.panel === name)
    );
    if (name === "board") renderBoard();
  }
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => switchTab(t.dataset.tab))
  );

  // ---- button wiring ----
  btnRun.addEventListener("click", doRun);
  btnTest.addEventListener("click", doTests);
  btnStop.addEventListener("click", async () => {
    // Kill the running program and restart the worker. Run/Tests stay disabled
    // until the fresh Python runtime is ready again.
    const ready = PyRunner.stop();
    btnStop.disabled = true;
    btnRun.disabled = true;
    btnTest.disabled = true;
    outputEl.className = "output err";
    outputEl.textContent = "■ Stopped.";
    switchTab("run");
    setStatus("Restarting Python…");
    try {
      await ready;
      setStatus("Python ready", "ready");
    } catch (err) {
      showError("Python failed to restart: " + (err.message || err));
      return;
    }
    btnRun.disabled = false;
    btnTest.disabled = false;
  });
  btnReset.addEventListener("click", () => {
    if (current && confirm("Restore the starter code? Your changes will be lost.")) {
      editor.setValue(current.starterCode || "");
      saveCode();
    }
  });

  // Reset ALL problems. Two-step so you can choose the depth:
  //   step 1 - restore every problem's starter code (clear saved edits)
  //   step 2 - optionally also clear progress (which problems are solved) / scores
  $("#btn-reset-all").addEventListener("click", async () => {
    if (!confirm("Restore every problem to its starter code?\n\nThis clears your saved edits for all problems.")) {
      return;
    }
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("pysolve:code:")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));

    const alsoProgress = confirm(
      "Also reset progress (which problems are marked solved) and leaderboard scores?\n\nOK = start fresh (all solved marks and points reset).\nCancel = keep progress, just reset the code."
    );
    if (alsoProgress) {
      await Scores.clearScores();
      solvedSet = await Scores.getSolved();
      earnedAchievements = new Set();
      failedAttempts = new Set();
      revealed = new Set();
      saveRevealed();
      hintsShown = {};
      saveHints();
      pastedSet = new Set();
      savePasted();
    }

    if (current) renderProblem(); // reload current problem from its starter code
    refreshProblemList();
    updateCertificate();
    renderAchievements();
    await refreshScore();
    await renderBoard();
    showToast(
      alsoProgress
        ? "Reset complete - starter code and progress cleared"
        : "All problems reset to starter code"
    );
  });
  categoryEl.addEventListener("change", () => {
    populateProblems(Number(categoryEl.value));
    // Load the first problem of the newly chosen category.
    loadProblem(selectEl.value).catch(showError);
  });
  selectEl.addEventListener("change", () => loadProblem(selectEl.value).catch(showError));
  // Reveal hints on request (delegated, since the hints HTML is re-rendered).
  $("#problem-body").addEventListener("click", (e) => {
    if (e.target.closest("#hint-btn")) revealHint();
  });
  const debouncedSave = debounce(saveCode, 400);
  editor.on("change", (cm, change) => {
    if (change && change.origin === "paste") maybePasteNudge(change);
    updateEditedPill();
    debouncedSave();
  });

  // Gentle, one-per-problem nudge when a sizeable chunk is pasted in - this tool
  // is for practising problem-solving, not pasting finished answers.
  function maybePasteNudge(change) {
    const text = (change.text || []).join("\n");
    if (text.length < 40) return; // ignore small pastes (a token, a line)
    // Record the whole-code paste (affects the "From Scratch" achievement),
    // regardless of whether we show the nudge.
    if (current && !pastedSet.has(current.id)) {
      pastedSet.add(current.id);
      savePasted();
    }
    if (pasteNudged) return; // nudge at most once per problem
    pasteNudged = true;
    showToast(
      "💡 Pasting in a full solution skips the practice. Use the course AI to explain or strategize - then write it yourself."
    );
  }

  function debounce(fn, ms) {
    let h;
    return (...a) => {
      clearTimeout(h);
      h = setTimeout(() => fn(...a), ms);
    };
  }

  function showError(err) {
    console.error(err);
    setStatus(err.message || String(err), "error");
  }

  // Flatten all categories to a single list of { file, title }.
  function manifestEntries() {
    return categories.flatMap((c) => c.problems || []);
  }

  // Build a { problemId: points } map from every problem's current JSON, so
  // stored scores can be reconciled to present-day point values. Also records
  // the file -> id mapping used to mark solved problems in the dropdown.
  async function buildPointsMap() {
    const map = {};
    fileToId = {};
    hintAvailable = new Set();
    await Promise.all(
      manifestEntries().map(async (e) => {
        try {
          const res = await fetch("problems/" + e.file);
          if (res.ok) {
            const p = await res.json();
            map[p.id] = p.points || 0;
            fileToId[e.file] = p.id;
            if (p.hints && p.hints.length) hintAvailable.add(p.id);
          }
        } catch {
          /* skip unreadable problem */
        }
      })
    );
    return map;
  }

  // ---- boot ----
  (async function boot() {
    // Restore player identity before rendering the first problem.
    const nick = await Scores.getNickname();
    $("#profile-label").textContent = nick || "Sign in";
    try {
      await loadManifest();
      // Correct any stored scores to the problems' current point values before
      // showing totals (keeps scores accurate after points are re-tuned).
      pointsById = await buildPointsMap();
      await Scores.reconcile(pointsById);
    } catch (err) {
      showError(err);
      return;
    }
    solvedSet = await Scores.getSolved();
    earnedAchievements = new Set(await Scores.getAchievements());
    await evaluateAchievements({ silent: true }); // grant any already-satisfied
    refreshProblemList(); // fileToId is ready now, so mark solved problems
    updateCertificate();
    await refreshScore();
    await renderBoard();
    renderAchievements();
    try {
      await loadProblem(selectEl.value);
    } catch (err) {
      showError(err);
      return;
    }
    try {
      await PyRunner.load(setStatus);
      setStatus("Python ready", "ready");
      btnRun.disabled = false;
      btnTest.disabled = false;
    } catch (err) {
      showError("Python failed to load: " + (err.message || err));
    }
  })();
})();
