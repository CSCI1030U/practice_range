// Student-facing API for pyplatformer.
//
// Five actions: left(), right(), jump_up(), jump_left(), jump_right().
// Plus a few sensors so students can write conditional/loop solutions.

import { AbortError, GameError } from "./game.js";

// No level needs anywhere near this many moves, so a run that reaches it is
// a runaway loop — and at one animated move each, waiting out a larger cap
// is its own small punishment.
const MAX_ACTIONS = 500;
// Sensors don't move anyone, so they don't count against MAX_ACTIONS — but a
// loop that only reads sensors ("while wall_right(): say('hi')") would spin
// forever, so they get a much larger budget of their own.
const MAX_SENSOR_READS = 100000;

export function makeApi(game, console) {
  let actions = 0;
  const tick = () => {
    if (game.aborted) throw new AbortError();
    if (++actions > MAX_ACTIONS) {
      throw new GameError(`Too many moves (over ${MAX_ACTIONS}). Looks like a loop that never stops — check its condition.`);
    }
  };

  let reads = 0;
  const sense = () => {
    if (game.aborted) throw new AbortError();
    if (++reads > MAX_SENSOR_READS) {
      throw new GameError(
        "Looks like an infinite loop — a loop is checking a sensor over and over " +
        "without ever moving. Check your stopping condition."
      );
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
    async on_ground()     { sense(); return game.isOnGround(); },
    async wall_left()     { sense(); return game.isWallLeft(); },
    async wall_right()    { sense(); return game.isWallRight(); },
    async flags_left()    { sense(); return game.flagsLeft(); },
    async position_x()    { sense(); return game.positionX(); },
    async position_y()    { sense(); return game.positionY(); },

    // ---- output ----
    async say(msg) { console.log(String(msg)); },
  };
}

export { AbortError, GameError };
