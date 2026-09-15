// Pyodide loader + run_student_code invoker for pyplatformer.

import { makeApi } from "./api.js";

const API_NAMES = [
  "left", "right",
  "jump_up", "jump_left", "jump_right",
  "on_ground", "on_wall_left", "on_wall_right",
  "flags_left", "position_x", "position_y",
  "say",
];

export class Runner {
  constructor({ game, consoleEl, onStatus }) {
    this.game = game;
    this.consoleEl = consoleEl;
    this.onStatus = onStatus || (() => {});
    this.pyodide = null;
    this._loading = null;
    this._currentRun = null;
  }

  async load() {
    if (this.pyodide) return this.pyodide;
    if (this._loading) return this._loading;
    this._loading = (async () => {
      this.onStatus("Loading Python runtime…");
      // eslint-disable-next-line no-undef
      const pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/",
        stdout: (s) => this._stdout(s),
        stderr: (s) => this._stderr(s),
      });
      const bootstrapSource = await (await fetch(`py/bootstrap.py?_=${Date.now()}`)).text();
      pyodide.runPython(bootstrapSource);
      const setApiNames = pyodide.globals.get("_set_api_names");
      setApiNames(pyodide.toPy(API_NAMES));
      setApiNames.destroy();
      this.pyodide = pyodide;
      this.onStatus("Ready");
      return pyodide;
    })();
    return this._loading;
  }

  _stdout(s) {
    const span = document.createElement("span");
    span.textContent = s + "\n";
    this.consoleEl.appendChild(span);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }
  _stderr(s) {
    const span = document.createElement("span");
    span.className = "err";
    span.textContent = s + "\n";
    this.consoleEl.appendChild(span);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }
  clearConsole() { this.consoleEl.textContent = ""; }

  async run(source) {
    if (!this.pyodide) await this.load();
    if (this._currentRun) throw new Error("Already running. Stop first.");
    const pyodide = this.pyodide;

    this.game.loadLevel(this.game.level);
    this.game.clearAbort();

    const consoleLogger = { log: (msg) => this._stdout(msg) };
    const api = makeApi(this.game, consoleLogger);

    const bindApi = pyodide.globals.get("_bind_api");
    bindApi(api);
    bindApi.destroy();

    const runStudent = pyodide.globals.get("run_student_code");
    this._currentRun = runStudent(source);
    let result = { win: false };
    try {
      this.onStatus("Running…");
      await this._currentRun;
      result.win = this.game.checkWin();
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      if (msg.includes("Execution stopped")) {
        result.aborted = true;
      } else {
        result.error = extractStudentError(msg);
        this._stderr(result.error);
      }
    } finally {
      runStudent.destroy();
      this._currentRun = null;
    }
    return result;
  }

  stop() {
    if (this._currentRun) this.game.abort();
  }
}

function extractStudentError(msg) {
  const m = msg.match(/_StudentError:\s*([\s\S]*?)(?:\n\s*$|$)/);
  if (m) return m[1].trim();
  const lines = msg.split("\n").filter(l => l.trim().length);
  return lines.slice(-6).join("\n");
}
