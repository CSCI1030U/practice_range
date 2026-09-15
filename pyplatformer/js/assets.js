// Asset preload + atlas for pyplatformer.
//
// Tilemap: 18×18 native tiles in tilemap_packed.png (20 cols × 9 rows).
// Characters: 128×128 cells with 1 px spacing, 7×7 grid in
// spritesheet-characters-default.png. Each character spans 9 consecutive
// cells (row-major) in this order:
//   0 walking_up_1, 1 walking_up_2, 2 crouching, 3 stand_1, 4 falling,
//   5 stand_2,      6 jumping,      7 walking_1, 8 walking_2
// Backgrounds: 4 × 48×72 scenes (two forest, desert, jungle) in
// tilemap-backgrounds_packed.png.

const ASSET_DIR = "assets";

const SHEETS = {
  tiles:       `${ASSET_DIR}/tilemap_packed.png`,
  chars:       `${ASSET_DIR}/spritesheet-characters-default.png`,
  backgrounds: `${ASSET_DIR}/tilemap-backgrounds_packed.png`,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function loadAssets() {
  const entries = await Promise.all(
    Object.entries(SHEETS).map(async ([key, src]) => {
      try { return [key, await loadImage(src)]; }
      catch (e) { console.warn(e.message); return [key, null]; }
    })
  );
  return { images: Object.fromEntries(entries), atlas: ATLAS };
}

// Tile IDs (the values stored in level.tiles). The renderer translates
// these to (col, row) in the tilemap_packed.png sheet.
//
// 0 is empty/sky. Solid IDs are >= 1.
export const TILE = {
  EMPTY:     0,
  GRASS:     1,   // grass-topped solid (top of a platform)
  DIRT:      2,   // solid block (interior)
  STONE:     3,   // alt solid block
  SPIKE:     4,   // hazard (kills hero)
  FLAG:      5,   // goal — collect to win
  COIN:      6,
  PLATFORM:  7,   // floating wooden plank (solid)
};

export function isSolidTile(t) {
  return t === TILE.GRASS || t === TILE.DIRT || t === TILE.STONE || t === TILE.PLATFORM;
}

// Atlas: source-pixel coords inside each sheet.
//
// Tilemap layout (verified against the Kenney sheet):
//   Columns 0–3 are platform variants:
//     col 0: single-width (both side edges)
//     col 1: left edge of a wider platform
//     col 2: middle  (no side edges, repeatable)
//     col 3: right edge
//   Rows give the surface material plus a "with bottom"/"no bottom" pair:
//     row 0: grass top, with bottom         row 1: grass top, no bottom
//     row 2: brown top, with bottom         row 3: brown top, no bottom
//     row 4: snowy top, with bottom         row 5: snowy top, no bottom
//     row 6: middle dirt (interior)
//     row 7: bottom dirt (closing piece)
//   Flag is 2 tiles tall: col 12 row 6 (top), col 12 row 7 (bottom/base).
export const ATLAS = {
  tiles: {
    cellW: 18,
    cellH: 18,
    // Single-cell static mappings used as fallback / for non-autotiled tiles.
    byId: {
      [TILE.SPIKE]:    [8, 4],   // spikes (placeholder, may be off)
      [TILE.FLAG]:     [11, 6],  // flag pole base (top half rendered above)
      [TILE.COIN]:     [10, 0],  // coin (placeholder)
      [TILE.PLATFORM]: [5, 4],   // wooden plank (placeholder)
    },
    // Platform autotile — col by edge state, row by "with bottom".
    grassRowWithBottom: 0,
    grassRowNoBottom:   1,
    dirtMidCell:    [0, 6],
    dirtBottomCell: [0, 7],
    // Flag top half (rendered one tile above the flag tile in the grid).
    flagTopCell:    [11, 5],
  },
  // Character sprite sheet: cells are 128×128 with 1 px spacing → stride 129.
  // Each character takes 9 cells laid out row-major across the 7-wide grid.
  // Per-character frame names (offsets into the 9):
  //   0 walking_up_1, 1 walking_up_2, 2 crouching, 3 stand_1, 4 falling,
  //   5 stand_2,      6 jumping,      7 walking_1, 8 walking_2
  chars: {
    cellW: 128,
    cellH: 128,
    cellStride: 129,
    gridCols: 7,
    // Sprite bbox inside the 128-cell (measured): tight body region.
    // We use this for cropping so we don't waste display space.
    bodyX: 16,    // approx
    bodyY: 24,
    bodyW: 96,
    bodyH: 104,
    // Frame indices within a character's 9-frame set.
    frame: {
      WALK_UP_1: 0,
      WALK_UP_2: 1,
      CROUCH:    2,
      IDLE:      3,
      FALL:      4,
      IDLE_ALT:  5,
      JUMP:      6,
      WALK_1:    7,
      WALK_2:    8,
    },
    // Character index — 1 is the green astronaut.
    defaultCharacter: 1,
    // Display size relative to a TILE. Source cells are square (128×128),
    // so display must also be square to avoid horizontal squashing.
    displayW: 1.6,
    displayH: 1.6,
  },
  backgrounds: {
    // Four 48×72 scenes side by side in a 192×72 sheet: two forest variants,
    // then desert, then jungle. (They are 48 wide, not 64 — slicing at 64
    // gives you half of one scene and half of the next.)
    cellW: 48,
    cellH: 72,
    forest: 1,
    desert: 2,
    jungle: 3,
  },
};

/**
 * Convert a character-local frame index (0..8) to source (sx, sy) in
 * the character sheet for a given character index.
 */
export function charFrameSrc(characterIdx, frameOffset) {
  const a = ATLAS.chars;
  const globalIdx = characterIdx * 9 + frameOffset;
  const col = globalIdx % a.gridCols;
  const row = Math.floor(globalIdx / a.gridCols);
  return {
    sx: col * a.cellStride,
    sy: row * a.cellStride,
    sw: a.cellW,
    sh: a.cellH,
  };
}
