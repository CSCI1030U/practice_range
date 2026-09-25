// localStorage-backed progress tracking. Unlocking is per topic: the first
// demo level of every topic is open from the start, and completing it opens
// the rest of that topic (the other demo, activities and homework).

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
   * The first demo level of each topic is always unlocked. Every other level
   * in a topic unlocks once that topic's first demo has been completed.
   * Topics are independent of each other.
   */
  isUnlocked(levelId, manifest) {
    const entry = manifest.find(l => l.id === levelId);
    if (!entry) return true;
    const topicLevels = manifest.filter(l => l.topic === entry.topic);
    const gate = topicLevels.find(l => l.kind === "demo") || topicLevels[0];
    return entry.id === gate.id || this.isComplete(gate.id);
  }
}
