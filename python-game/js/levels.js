// Level loader.
// A level JSON has:
//   id, title, topic, kind ("in-class" | "practice"),
//   brief (markdown-lite html for the briefing pane),
//   width, height,
//   tiles: 2D array of integers (0 floor, 1 wall, 3 water),
//     -- string shorthand also supported: "." floor, "#" wall, "~" water
//   start: { x, y, dir? },
//   chest?: { x, y, requiresKey? },
//   items?: [{ x, y, type }],   -- type: "key" | "coin"
//   goal?: { type: "open_chest" | "reach" | "collect_all_coins", x?, y? }
//   starterCode?: string,
//   api?: string[]   -- names available to student; rest are still callable but hidden

import { TILES } from "./game.js";

// Tile characters. '@' and 'T' are treated as floor — they're only
// placeholders that make hand-written levels readable; the actual hero
// start and chest position are stored as separate JSON fields.
const CHAR_MAP = {
  ".": TILES.FLOOR,
  "@": TILES.FLOOR,
  "T": TILES.FLOOR,
  "K": TILES.FLOOR,
  "#": TILES.WALL,
  "~": TILES.WATER,
};

function normalizeTiles(tiles) {
  if (Array.isArray(tiles) && tiles.length > 0 && typeof tiles[0] === "string") {
    return tiles.map(row => Array.from(row).map(ch => {
      const v = CHAR_MAP[ch];
      if (v === undefined) throw new Error(`Unknown tile char: ${ch}`);
      return v;
    }));
  }
  return tiles;
}

// Per-session cache buster — prevents the browser from holding onto a stale
// JSON file across edits. Each page load gets a fresh token; within a load
// the browser's cache still works normally.
const CACHE_BUST = `_=${Date.now()}`;

export async function loadManifest() {
  const res = await fetch(`levels/manifest.json?${CACHE_BUST}`);
  if (!res.ok) throw new Error("Failed to load levels/manifest.json");
  return res.json();
}

export async function loadLevel(id) {
  const res = await fetch(`levels/${id}.json?${CACHE_BUST}`);
  if (!res.ok) throw new Error(`Failed to load level ${id}`);
  const level = await res.json();
  level.tiles = normalizeTiles(level.tiles);
  if (level.tiles.length !== level.height) {
    throw new Error(`Level ${id}: tiles height ${level.tiles.length} ≠ declared ${level.height}`);
  }
  for (const row of level.tiles) {
    if (row.length !== level.width) {
      throw new Error(`Level ${id}: tile row width ${row.length} ≠ declared ${level.width}`);
    }
  }
  return level;
}
