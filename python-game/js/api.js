// Bridge exposed to Pyodide. Every function returns a Promise that Python
// awaits via `pyodide.ffi.run_sync(...)` (stack switching), making them
// appear synchronous to student code.
//
// Errors raised here become Python exceptions when not caught.

import { DIR, AbortError, GameError } from "./game.js";

const MAX_ACTIONS = 2000;

export function makeApi(game, console) {
  let actions = 0;
  const tick = () => {
    if (game.aborted) throw new AbortError();
    if (++actions > MAX_ACTIONS) {
      throw new GameError(
        `Too many actions (over ${MAX_ACTIONS}). Looks like an infinite loop — check your stopping condition.`
      );
    }
  };
  const ensure = () => {
    if (game.aborted) throw new AbortError();
  };

  return {
    // ---- movement ----
    async move_up()    { tick(); return game.stepInDir(DIR.UP); },
    async move_down()  { tick(); return game.stepInDir(DIR.DOWN); },
    async move_left()  { tick(); return game.stepInDir(DIR.LEFT); },
    async move_right() { tick(); return game.stepInDir(DIR.RIGHT); },

    async turn_up()    { tick(); return game.turn(DIR.UP); },
    async turn_down()  { tick(); return game.turn(DIR.DOWN); },
    async turn_left()  { tick(); return game.turn(DIR.LEFT); },
    async turn_right() { tick(); return game.turn(DIR.RIGHT); },
    async turn(direction) {
      tick();
      const dir = DIR[String(direction).toUpperCase()];
      if (!dir) throw new GameError(`turn: unknown direction '${direction}' (use UP, DOWN, LEFT, or RIGHT).`);
      return game.turn(dir);
    },
    async move_forward() { tick(); return game.stepInDir(game.state.hero.dir); },

    // ---- actions ----
    async open_chest() { tick(); return game.openChest(); },
    async pick_up_key() { tick(); return game.pickUpKey(); },
    async go_to(target) { tick(); return game.goTo(target); },

    // ---- sensors (synchronous, but expose as async so Python wrappers are uniform) ----
    async is_at_chest()    { return game.isNextToChest(); },
    async is_on_treasure() { return game.isNextToChest(); },  // alias
    async is_wall_up()    { return game.isWallInDir(DIR.UP); },
    async is_wall_down()  { return game.isWallInDir(DIR.DOWN); },
    async is_wall_left()  { return game.isWallInDir(DIR.LEFT); },
    async is_wall_right() { return game.isWallInDir(DIR.RIGHT); },
    async is_key_up()     { return game.isKeyInDir(DIR.UP); },
    async is_key_down()   { return game.isKeyInDir(DIR.DOWN); },
    async is_key_left()   { return game.isKeyInDir(DIR.LEFT); },
    async is_key_right()  { return game.isKeyInDir(DIR.RIGHT); },
    async has_key()       { return game.hasItem("key"); },
    async coins_collected() { return game.itemCount("coin"); },
    async position_x()    { return game.state.hero.x; },
    async position_y()    { return game.state.hero.y; },

    // ---- output ----
    async say(msg) {
      console.log(String(msg));
    },
  };
}

export { AbortError, GameError };
