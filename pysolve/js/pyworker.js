/*
 * pyworker.js - runs Pyodide inside a Web Worker so student code executes off
 * the main thread. That keeps the page responsive (so a Stop button works) and
 * lets the main thread kill a runaway program by terminating this worker.
 *
 * Messages in:  { type: "init", indexURL }   { type: "run", source, stdin }
 * Messages out: { type: "progress", text }   { type: "ready" }
 *               { type: "result", stdout, error }
 */
let pyodide = null;

// Same harness as before: run the student's source with stdin piped in and
// stdout/stderr captured, returning (output, traceback-or-None).
const HARNESS = `
import sys, io, traceback

def _run(source, stdin_text):
    old_in, old_out, old_err = sys.stdin, sys.stdout, sys.stderr
    buf_out = io.StringIO()
    sys.stdin = io.StringIO(stdin_text)
    sys.stdout = buf_out
    sys.stderr = buf_out
    err = None
    try:
        exec(compile(source, "<student>", "exec"), {"__name__": "__main__"})
    except SystemExit:
        pass
    except BaseException:
        err = traceback.format_exc()
    finally:
        sys.stdin, sys.stdout, sys.stderr = old_in, old_out, old_err
    return buf_out.getvalue(), err
`;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "init") {
    try {
      self.postMessage({ type: "progress", text: "Downloading Python runtime…" });
      importScripts(msg.indexURL + "pyodide.js");
      self.postMessage({ type: "progress", text: "Starting Python…" });
      pyodide = await loadPyodide({ indexURL: msg.indexURL });
      pyodide.runPython(HARNESS);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", text: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (msg.type === "run") {
    if (!pyodide) {
      self.postMessage({ type: "result", stdout: "", error: "Python runtime not ready" });
      return;
    }
    const runFn = pyodide.globals.get("_run");
    try {
      const result = runFn(msg.source, msg.stdin || "");
      const stdout = result.get(0);
      const error = result.get(1);
      result.destroy();
      self.postMessage({ type: "result", stdout, error: error || null });
    } catch (err) {
      self.postMessage({ type: "result", stdout: "", error: String(err) });
    } finally {
      runFn.destroy();
    }
  }
};
