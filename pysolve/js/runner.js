/*
 * runner.js - manages the Pyodide Web Worker (js/pyworker.js) from the main
 * thread. Running code in a worker keeps the UI responsive and makes it
 * possible to stop a runaway program: stop() terminates the worker (killing
 * whatever it's executing) and spins up a fresh one.
 *
 * No backend and no special headers required - works over a plain static
 * server.
 */
(function () {
  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";

  let worker = null;
  let ready = false;
  let readyPromise = null;
  let pendingRun = null; // { resolve } for the run currently in flight
  let progressCb = null;

  // Create a fresh worker and (re)initialize Pyodide in it. readyPromise
  // resolves once the worker reports it's ready to run code.
  function spawn() {
    ready = false;
    worker = new Worker("js/pyworker.js");
    readyPromise = new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") {
          ready = true;
          resolve();
        } else if (m.type === "progress") {
          progressCb && progressCb(m.text);
        } else if (m.type === "result") {
          const p = pendingRun;
          pendingRun = null;
          p && p.resolve({ stdout: m.stdout, error: m.error });
        } else if (m.type === "error") {
          reject(new Error(m.text || "worker failed to start"));
        }
      };
      worker.onerror = (err) => reject(new Error(err.message || "worker error"));
    });
    worker.postMessage({ type: "init", indexURL: PYODIDE_URL });
    return readyPromise;
  }

  function load(onProgress) {
    progressCb = onProgress;
    if (!worker) spawn();
    return readyPromise;
  }

  // Run source against one stdin string. Resolves with
  // { stdout, error } normally, or { stopped: true } if stop() interrupts it.
  function run(source, stdinText) {
    if (!ready) return Promise.reject(new Error("Python runtime not ready"));
    return new Promise((resolve) => {
      pendingRun = { resolve };
      worker.postMessage({ type: "run", source, stdin: stdinText || "" });
    });
  }

  // Kill whatever the worker is doing (e.g. an infinite loop) and start a fresh
  // worker. Any in-flight run resolves as { stopped: true }. Returns the new
  // worker's readyPromise so callers can wait for the runtime to come back.
  function stop() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    if (pendingRun) {
      const p = pendingRun;
      pendingRun = null;
      p.resolve({ stdout: "", error: null, stopped: true });
    }
    return spawn();
  }

  window.PyRunner = {
    load,
    run,
    stop,
    isReady: () => ready,
    isRunning: () => !!pendingRun,
  };
})();
