/*
 * scores.js - score + leaderboard storage behind a small async provider
 * interface, so a shared backend can replace the local store without touching
 * the UI.
 *
 * Provider contract (all methods async / Promise-returning):
 *   getNickname()                  -> string | null
 *   setNickname(name)              -> void
 *   recordSolve(problemId, points) -> { newBest: bool, total: number }
 *   getSolved()                    -> Set<string> of solved problem ids (current player)
 *   getLeaderboard()               -> [{ nick, total, solved }] sorted desc
 *
 * To go backend-backed later: implement the same methods against your API and
 * set `window.Scores = new RemoteScoreProvider(...)`. app.js only calls the
 * interface, never localStorage directly.
 */
(function () {
  const NICK_KEY = "pysolve:nick";
  const NAME_KEY = "pysolve:fullname"; // display name for certificates
  const ACH_KEY = "pysolve:achievements"; // { [nick]: [achievementId, ...] }
  const DATA_KEY = "pysolve:scores"; // { [nick]: { [problemId]: points } }

  class LocalScoreProvider {
    _load() {
      try {
        return JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
      } catch {
        return {};
      }
    }
    _save(data) {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    }

    async getNickname() {
      return localStorage.getItem(NICK_KEY);
    }

    async getFullName() {
      return localStorage.getItem(NAME_KEY) || "";
    }

    async setFullName(name) {
      localStorage.setItem(NAME_KEY, name || "");
    }

    async setNickname(name) {
      localStorage.setItem(NICK_KEY, name);
    }

    // Record that the current player solved a problem worth `points`. We keep
    // the best (max) points per problem, so re-solving never lowers a score and
    // duplicate solves don't stack.
    async recordSolve(problemId, points) {
      const nick = await this.getNickname();
      if (!nick) return { newBest: false, total: 0 };
      const data = this._load();
      const mine = (data[nick] = data[nick] || {});
      const prev = mine[problemId] || 0;
      const newBest = points > prev;
      if (newBest) mine[problemId] = points;
      this._save(data);
      const total = Object.values(mine).reduce((a, b) => a + b, 0);
      return { newBest, total };
    }

    async getSolved() {
      const nick = await this.getNickname();
      const data = this._load();
      return new Set(Object.keys((nick && data[nick]) || {}));
    }

    // Wipe all solved status / scores / achievements for every player (the
    // nickname is kept). Achievements are part of "progress", so they go too.
    async clearScores() {
      localStorage.removeItem(DATA_KEY);
      localStorage.removeItem(ACH_KEY);
    }

    // Earned achievement ids for the current player.
    _loadAch() {
      try {
        return JSON.parse(localStorage.getItem(ACH_KEY) || "{}");
      } catch {
        return {};
      }
    }
    async getAchievements() {
      const nick = await this.getNickname();
      return (nick && this._loadAch()[nick]) || [];
    }
    async setAchievements(list) {
      const nick = await this.getNickname();
      if (!nick) return;
      const data = this._loadAch();
      data[nick] = list;
      localStorage.setItem(ACH_KEY, JSON.stringify(data));
    }

    // Re-sync every stored solve to a problem's CURRENT point value. Stored
    // scores capture the points earned at solve time, so re-tuning a problem's
    // points later leaves old totals stale. Calling this with a
    // { problemId: currentPoints } map corrects all players' records. Solves
    // whose problem no longer appears in the map are left untouched. Returns
    // true if anything changed.
    async reconcile(pointsById) {
      const data = this._load();
      let changed = false;
      for (const probs of Object.values(data)) {
        for (const id of Object.keys(probs)) {
          if (id in pointsById && probs[id] !== pointsById[id]) {
            probs[id] = pointsById[id];
            changed = true;
          }
        }
      }
      if (changed) this._save(data);
      return changed;
    }

    async getLeaderboard() {
      const data = this._load();
      return Object.entries(data)
        .map(([nick, probs]) => ({
          nick,
          total: Object.values(probs).reduce((a, b) => a + b, 0),
          solved: Object.keys(probs).length,
        }))
        .sort((a, b) => b.total - a.total || b.solved - a.solved || a.nick.localeCompare(b.nick));
    }
  }

  window.Scores = new LocalScoreProvider();
})();
