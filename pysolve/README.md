# CodeForge

A standalone, browser-based environment for practising Python. Students read a
problem, write Python in a syntax-highlighted editor, run it against their own
input, and check their solution against a set of test cases - all in the
browser, with no server-side code execution. Problems span several categories
(including a **Debugging** category where students fix broken programs), with
scoring, a leaderboard, and a downloadable completion certificate.

(The folder is named `pysolve/` and its browser storage keys use the `pysolve:`
prefix, for historical reasons; the tool is called CodeForge.)

## Running it

The page loads problems with `fetch()`, which browsers block on `file://`
URLs, so serve the folder over HTTP:

```bash
cd pysolve
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in a browser. The first run downloads the
Pyodide (CPython-in-WebAssembly) runtime from a CDN - this needs internet and
takes a few seconds; it is cached afterwards.

## How it works

- **Editor** - CodeMirror 5 with Python highlighting (loaded from CDN).
- **Python** - [Pyodide](https://pyodide.org) runs real CPython in the browser.
- **I/O model** - each test's `input` is piped to the program's `stdin`, and
  `print()` / `stdout` is captured and compared to the expected output.
  Comparison ignores trailing whitespace and a trailing newline.

## Adding problems

Each problem is a self-contained JSON file in `problems/`, listed in
`problems/manifest.json`:

```json
{ "file": "01-sum-two.json", "title": "Sum of Two Numbers" }
```

A problem file looks like:

```json
{
  "id": "01-sum-two",
  "title": "Sum of Two Numbers",
  "description": "# Markdown describing the problem …",
  "starterCode": "a = int(input())\n…",
  "hints": [
    "A small nudge (e.g. which strategy to use).",
    "A medium hint (e.g. \"similar to the <X> problem you solved\").",
    "```\npseudocode of the solution\n```"
  ],
  "tests": [
    { "name": "Example", "input": "3\n4\n", "expectedOutput": "7\n" }
  ]
}
```

- `description` is Markdown.
- `starterCode` prefills the editor (and is restored by **Reset code**).
- `hints` (optional) is an ordered array, smallest hint first. Students reveal
  them one at a time via a **Show a hint** button under the problem; each hint
  may use Markdown (use a fenced code block for a pseudocode hint). Omit the
  field for no hints. Convention: a small strategy nudge, then a "similar to a
  problem you've seen" pointer, then pseudocode.
- Each test's `input` becomes stdin; `expectedOutput` is the expected stdout.

Student code is auto-saved per problem in the browser's `localStorage`.

## Discouraging copy-paste

This is a problem-solving tool, so it gently discourages pasting in finished
answers: when a sizeable chunk is pasted into the editor, a one-time nudge
appears suggesting the student use the course AI for hints/strategy and write
the solution themselves. It's a deterrent, not a lock - the tool can't (and
doesn't try to) prevent pasting.
