# Python Platformer — CSCI 1030U practice environment

A browser-based Python practice range, and a companion to `python-game/`
(Python Quest). Students write Python to walk and jump a character across
platform levels and collect flags. Topics covered, in order: sequential
statements, `while` loops, `for` loops, variables and conditionals, and
functions.

Where Quest is a top-down maze, this one has gravity: the ground rises and
falls, and reaching a flag means deciding when to walk and when to climb.
The two apps teach the same topics through different mechanics, so a student
who is stuck on one can practise the same idea in the other.

## Running locally

The page must be served over HTTP (Pyodide and the level JSON files use
`fetch`, which won't work from `file://`):

```bash
cd pyplatformer
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in a recent Chrome, Edge, or Firefox.
First load downloads Pyodide (~10 MB) and is cached by the browser.

No build step. No backend. Progress saves to `localStorage`.

## What students see

- **Game pane** (left): the level, with the hero and any uncollected flags.
- **Briefing** (below the game): the goal, the new idea this level teaches,
  and which commands are available.
- **Code panel** (right): Python editor with syntax highlighting.
- **Output panel** (bottom-right): `say()` output and error messages.
- **Run / Stop / Reset Level** buttons, plus a speed toggle, a display-scale
  selector, and the level list. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs.

A level is complete when every flag has been collected.

## Student-facing API

These names are available as Python globals while student code runs. Each
movement call animates one tile and returns once the hero has landed.

### Movement
- `right()`, `left()` — walk one tile. Walking into the side of a step does
  nothing (no error); walking off a ledge drops you onto whatever is below.
- `jump_right()`, `jump_left()` — jump one tile sideways, clearing a step
  one tile high.
- `jump_up()` — jump straight up and land on the same tile.

### Sensors
- `wall_right()`, `wall_left()` — `True` when a step blocks the tile beside
  you, i.e. when walking that way would get you nowhere and a jump would
  not.
- `on_ground()` — `True` when the hero is standing on something.
- `flags_left()` — how many flags are still uncollected.
- `position_x()`, `position_y()` — the hero's tile column and row, as
  integers. Row `0` is the **top** of the level, so climbing makes
  `position_y()` smaller.

### Output
- `say(text)` — print to the output panel.

## Movement rules worth knowing

The engine is continuous (sub-tile positions, real gravity), but every
student-visible action is quantised so that one call means one predictable
move:

- A walk covers exactly one tile, or stops early against a step.
- A directional jump rises about 1.45 tiles, then moves sideways exactly one
  tile — enough to climb a **one-tile** step, never a two-tile one.
- Actions always begin and end with the hero standing still on the ground.
  There is no mid-air state for student code to observe, and therefore no
  mid-air jumping.
- Walking off the side of the level, or falling out of the bottom of it,
  ends the run with an error rather than hanging.

Level terrain should therefore only ever rise by one tile at a time in the
direction of travel. Drops can be any depth.

## How the magic works (instructor reference)

Students write code like:

```python
while flags_left() > 0:
    if wall_right():
        jump_right()
    else:
        right()
```

It looks synchronous, but every API call is an asynchronous JS function (so
the animation can play between steps). Before running, `py/bootstrap.py`:

1. Parses the student source to an AST.
2. Finds every user-defined function that transitively calls into the API,
   and converts those `def`s to `async def`.
3. Injects `await` before each call to an API or async user function.
4. Compiles with `PyCF_ALLOW_TOP_LEVEL_AWAIT` and `eval`s to a coroutine.
5. Awaits it; each `right()` blocks until the hero has landed (or the
   student presses **Stop**).

Students never see `async`/`await`, and tracebacks point at their own line
numbers because the AST is compiled directly, with no source round-trip.

## Authoring new levels

Each level is a JSON file in `levels/`, plus an entry in
`levels/manifest.json`, which defines play order and topic grouping.

```json
{
  "id": "03-for-02",
  "title": "Five Stairs",
  "topic": "for",
  "kind": "demo",
  "brief": "<p>HTML for the briefing pane.</p>",
  "width": 6,
  "height": 10,
  "tiles": [
    "......",
    "......",
    "......",
    ".....F",
    "....GG",
    "...GDD",
    "..GDDD",
    ".GDDDD",
    "GDDDDD",
    "DDDDDD"
  ],
  "start": { "x": 0, "y": 7 },
  "background": "jungle",
  "api": ["right", "jump_right"],
  "starterCode": "",
  "solution": "for step in range(5):\n    jump_right()\n"
}
```

**Tile characters:** `.` empty, `G` grass-topped solid, `D` dirt (solid),
`F` flag. (`S` stone, `^` spike, `$` coin and `=` plank exist in the tile
enum but have no working sprite or behaviour yet — don't use them.) Tiles
may also be given as a 2-D array of the integer IDs in `js/assets.js`.

**Coordinates** are tile-based with `(0, 0)` at the top-left. `start` is the
tile the hero spawns in; they fall straight down onto whatever is beneath.

**Flags** are drawn two tiles tall — the tile above a flag must be empty.

**`background`** is `"forest"`, `"desert"`, or `"jungle"`.

**`api`** lists the commands shown in the brief's "Available commands"
expander. It is a display hint only — every command is callable regardless.
Use it to keep the early levels to a small vocabulary.

**`kind`** is `"demo"`, `"activity"`, or `"homework"`; it shows as a label
in the level list.

**`solution`** is shown behind the "Show one possible solution" disclosure.

Levels unlock per topic: the first `demo` level of every topic is open from
the start, and completing it unlocks the rest of that topic (the second demo,
the activities and the homework).

## Project layout

```
pyplatformer/
├── index.html        # entry page
├── styles.css        # layout & theme
├── js/
│   ├── main.js       # orchestration (UI, level switching, run/stop)
│   ├── game.js       # physics engine + canvas renderer
│   ├── api.js        # JS-side student API (moves, sensors)
│   ├── runner.js     # Pyodide loader + Python invocation
│   ├── editor.js     # Ace wrapper
│   ├── levels.js     # level loader
│   ├── assets.js     # sprite sheet atlas + preloading
│   └── progress.js   # localStorage progress tracking
├── py/
│   └── bootstrap.py  # AST transform + run_student_code, loaded into Pyodide
├── levels/
│   ├── manifest.json # ordered list of levels
│   └── *.json        # individual level files
└── assets/           # Kenney "Pixel Platformer" artwork (CC0)
```

## Resetting progress

Progress lives under the `pyplatformer.progress.v1` key, and each level's
saved code under `pyplatformer.code.<level id>`. To wipe both, run
`localStorage.clear()` in DevTools and refresh.

## Known caveats

- Pyodide's first-load cost (~10 MB) is high, and it comes from a CDN, so
  the first run needs internet. Worth hosting locally for restricted lab
  environments.
- The AST transform handles user-defined functions that call the API, but
  not lambdas or API functions passed around as values.
- There is no hazard tile: the hero cannot be hurt, only stuck or lost off
  the edge of the map.
