# Python Quest — CSCI 1030U practice environment

A browser-based Python learning game for the first three weeks of CSCI 1030U.
Students write Python in a code panel to move a character through maze levels
and open treasure chests. Topics covered: sequential statements, conditionals,
`while` loops, `for` loops, and functions.

## Running locally

The page must be served over HTTP (Pyodide and the level JSON files use
`fetch`, which won't work from `file://`). The simplest option:

```bash
cd python-game
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in a recent Chrome, Edge, or Firefox.
First load downloads Pyodide (~10 MB) and is cached by the browser.

No build step. No backend. Progress saves to `localStorage`.

## What students see

- **Game pane** (left): top-down view of the current level, with the hero
  character and any items/chest.
- **Briefing** (below the game): the goal, teaching notes, and which
  commands are available.
- **Code panel** (right): Python editor with syntax highlighting.
- **Output panel** (bottom-right): printed output and error messages.
- **Run / Stop / Reset Level** buttons, plus a speed toggle and level
  selector. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs.

## Student-facing API

These names are available as Python globals while student code runs.
Each call animates one tile (movement) or beat (action) before returning.

### Movement
- `move_up()`, `move_down()`, `move_left()`, `move_right()` — walk one tile.
  Bumps (no movement) if a wall or water is in the way.
- `turn_up()`, `turn_down()`, `turn_left()`, `turn_right()` — face that
  direction without walking.

### Actions
- `open_chest()` — open the treasure chest. The hero must be standing
  **adjacent** to it (one tile north, south, east, or west).

### Sensors (return bool/int/coord)
- `is_at_chest()` — `True` if the hero is standing right next to the chest.
- `is_on_treasure()` — alias for `is_at_chest()` (older name).
- `is_wall_up()`, `is_wall_down()`, `is_wall_left()`, `is_wall_right()` —
  `True` if the adjacent tile in that direction is impassable.
- `has_key()` — `True` after picking up a key.
- `coins_collected()` — number of coins picked up so far.
- `position_x()`, `position_y()` — current tile coordinates.

### Output
- `say(text)` — print to the output panel.

## How the magic works (instructor reference)

Students write code like:

```python
while not is_on_treasure():
    move_right()
open_chest()
```

It looks synchronous, but every API call is actually an asynchronous JS
function (so animations can play between steps). Before running, we:

1. Parse the student source to an AST.
2. Find every user-defined function that transitively calls into the API,
   and convert those `def`s to `async def`.
3. Inject `await` before each call to an API or async user function.
4. Compile with `PyCF_ALLOW_TOP_LEVEL_AWAIT` and `eval` to a coroutine.
5. Await the coroutine; each `move_right()` blocks until the animation
   finishes (or the user clicks **Stop**).

This means **students never see `async`/`await`** but get real animated
feedback for each step. Tracebacks point at the student's original line
numbers (we compile the AST directly, no source round-trip).

## Authoring new levels

Each level is a JSON file in `levels/`, plus an entry in
`levels/manifest.json`. The manifest defines display order and topic grouping.

### Level schema

```json
{
  "id": "06-rec-01",
  "title": "Recursive Descent",
  "topic": "recursion",
  "kind": "in-class",
  "brief": "<p>HTML for the briefing pane.</p>",
  "width": 8,
  "height": 6,
  "tiles": [
    "########",
    "#@.....#",
    "######.#",
    "#......#",
    "#.T....#",
    "########"
  ],
  "start":  { "x": 1, "y": 1, "dir": "RIGHT" },
  "chest":  { "x": 2, "y": 4, "facing": "W" },
  "items":  [{ "x": 3, "y": 1, "type": "coin" }],
  "goal":   { "type": "open_chest" },
  "api":    ["move_right", "move_down", "open_chest"],
  "starterCode": "# Comments and starter scaffolding for the student.\n\n"
}
```

**Tile characters:** `.` floor, `#` wall, `~` water (impassable). You can
also provide tiles as a 2-D array of integers (`0` floor, `1` wall, `3`
water) — the string form is just convenience.

**Coordinates** are tile-based, with `(0, 0)` at the top-left.

**`chest.facing`** picks the chest sprite orientation. Use `"S"` (default,
front view) when the hero approaches from north or south; `"W"` when the
hero approaches from the west; `"E"` when from the east. The chest doesn't
rotate at open time — it stays in this orientation throughout.

**`goal` types:**
- `{"type": "open_chest"}` — default; chest must be opened.
- `{"type": "reach", "x": X, "y": Y}` — hero must end on that tile.
- `{"type": "collect_all_coins"}` — every coin item must be collected.

**`api`** is a list of names shown to the student in the brief's "Available
commands" expander. It's a display hint only — all commands are technically
callable. Use this to narrow the surface area early and add capabilities as
topics progress.

**`kind`** is `"in-class"` or `"practice"` — affects the level-select label.

## Swapping in real graphics

The placeholder sprites live in `js/game.js` as `drawFloor`, `drawWall`,
`drawHero`, `drawTreasure`, etc. Each takes `(ctx, x, y, size)` and draws
one tile or sprite at that pixel position.

To use real artwork:

1. Drop your tileset and sprite images in `assets/`.
2. Preload them at the top of `game.js`:

   ```js
   const img = new Image();
   img.src = "assets/hero.png";
   ```

3. Replace each `drawXxx` body with a `ctx.drawImage(img, …)` call.

The engine doesn't care about the rendering details — only that each
function paints into the rectangle it was given. Pixel-art assets at 32×32
(matching `TILE` in `game.js`) drop in cleanly.

## Project layout

```
python-game/
├── index.html        # entry page
├── styles.css        # layout & theme
├── js/
│   ├── main.js       # orchestration (UI, level switching, run/stop)
│   ├── game.js       # canvas renderer + tile-based engine
│   ├── api.js        # JS-side student API (move_*, sensors, actions)
│   ├── runner.js     # Pyodide loader + Python invocation
│   ├── editor.js     # Ace wrapper
│   ├── levels.js     # level loader
│   └── progress.js   # localStorage progress tracking
├── py/
│   └── bootstrap.py  # AST transform + run_student_code, loaded into Pyodide
├── levels/
│   ├── manifest.json # ordered list of levels
│   └── *.json        # individual level files
└── assets/           # (empty) drop-in artwork goes here
```

## Resetting progress

In DevTools: `localStorage.clear()` then refresh. Or call
`new Progress().reset()` from the page console (`Progress` isn't a global,
but you can dig it out via the module — or just clear localStorage).

## Known caveats

- The placeholder graphics are functional, not pretty. Real art will go a
  long way for student motivation.
- Pyodide's first-load cost (~10 MB) is high. Subsequent loads are cached.
  Worth considering whether to host Pyodide locally for lab environments
  with restricted internet.
- The AST transform handles user-defined functions that call the API, but
  it does not handle lambdas or passing API functions as callables (e.g.
  `walk_seven(move_right)` with `move_right` as an argument). Workaround:
  define a named helper function instead.
