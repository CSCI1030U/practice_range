// localStorage-backed progress tracking. Linear unlock with free practice
// within completed topics: a level is unlocked if it's the first level, or
// if any prior level (by manifest order) in the same topic or any prior
// topic has been completed.

const KEY = "python-game.progress.v1";

export class Progress {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { completed: {} };
    } catch {
      return { completed: {} };
    }
  }

  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {}
  }

  isComplete(levelId) { return !!this.data.completed[levelId]; }

  markComplete(levelId) {
    this.data.completed[levelId] = Date.now();
    this._save();
  }

  reset() {
    this.data = { completed: {} };
    this._save();
  }

  /**
   * A level is unlocked if it's the first level, or if the immediately preceding
   * level (by manifest order) has been completed. This is "linear unlock".
   * Practice levels within a completed topic stay unlocked.
   */
  isUnlocked(levelId, manifest) {
    const idx = manifest.findIndex(l => l.id === levelId);
    if (idx <= 0) return true;
    const prev = manifest[idx - 1];
    return this.isComplete(prev.id);
  }
}
