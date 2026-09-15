// Student-facing API for pyplatformer.
//
// Five actions: left(), right(), jump_up(), jump_left(), jump_right().
// Plus a few sensors so students can write conditional/loop solutions.

import { AbortError, GameError } from "./game.js";

const MAX_ACTIONS = 2000;

export function makeApi(game, console) {
  let actions = 0;
  const tick = () => {
    if (game.aborted) throw new AbortError();
    if (++actions > MAX_ACTIONS) {
      throw new GameError(`Too many actions (over ${MAX_ACTIONS}). Looks like an infinite loop.`);
    }
  };

  return {
    // ---- movement ----
    async left()        { tick(); return game.walk("left"); },
    async right()       { tick(); return game.walk("right"); },
    async jump_up()     { tick(); return game.jump("up"); },
    async jump_left()   { tick(); return game.jump("left"); },
    async jump_right()  { tick(); return game.jump("right"); },

    // ---- sensors ----
    async on_ground()     { return game.isOnGround(); },
    async on_wall_left()  { return game.isOnWallLeft(); },
    async on_wall_right() { return game.isOnWallRight(); },
    async flags_left()    { return game.flagsLeft(); },
    async position_x()    { return game.positionX(); },
    async position_y()    { return game.positionY(); },

    // ---- output ----
    async say(msg) { console.log(String(msg)); },
  };
}

export { AbortError, GameError };
