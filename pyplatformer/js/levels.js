// Level loader for pyplatformer.
//
// Level JSON schema:
//   id, title, topic, kind ("demo" | "activity" | "homework"),
//   brief (HTML for the briefing pane),
//   width, height,
//   tiles: 2D array of strings using char codes below — or numeric IDs,
//   start: { x, y },
//   background?: "forest" | "desert" | "jungle",
//   starterCode?: string,
//   solution?: string,
//   api?: string[]

import { TILE } from "./assets.js";

const CHAR_MAP = {
  ".": TILE.EMPTY,
  "@": TILE.EMPTY,
  "G": TILE.GRASS,
  "D": TILE.DIRT,
  "S": TILE.STONE,
  "^": TILE.SPIKE,
  "F": TILE.FLAG,
  "$": TILE.COIN,
  "=": TILE.PLATFORM,
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
      throw new Error(`Level ${id}: row width ${row.length} ≠ declared ${level.width}`);
    }
  }
  return level;
}
