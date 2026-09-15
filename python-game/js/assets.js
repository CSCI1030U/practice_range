// Preloads sprite sheets and defines atlas coordinates for each sprite.
//
// All Sprout Lands assets use 16×16 native tiles. Our display tile size
// is set in game.js (currently 48 = 3× scale). The renderer handles scaling.
//
// Credit: Sprout Lands by Cup Nooble (non-commercial use, credit required).
// https://cupnooble.itch.io/sprout-lands-asset-pack

const ASSET_DIR = "assets/sproutlands";

const SHEETS = {
  hero:   `${ASSET_DIR}/Characters/Basic Charakter Spritesheet.png`,
  chest:  `${ASSET_DIR}/Objects/Chest.png`,
  key:    `${ASSET_DIR}/Objects/keys_a.png`,
  fences: `${ASSET_DIR}/Tilesets/Fences.png`,
  grass:  `${ASSET_DIR}/Tilesets/Grass.png`,
  water:  `${ASSET_DIR}/Tilesets/Water.png`,
  plants: `${ASSET_DIR}/Objects/Basic_Plants.png`,
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
      try {
        const img = await loadImage(src);
        return [key, img];
      } catch (e) {
        console.warn(e.message + " (will fall back to placeholder)");
        return [key, null];
      }
    })
  );
  const images = Object.fromEntries(entries);
  return { images, atlas: ATLAS };
}

// --- Atlas coordinates ---
// All in NATIVE source-pixel coordinates within their sheet.
// {x, y, w, h} of one frame.

export const ATLAS = {
  // Hero spritesheet: 4 rows × 4 cols of 48×48 cells.
  // Row index by facing direction; column index by walk-cycle frame.
  //
  // The character art in each cell occupies roughly (17..31, 16..32) — feet
  // are at source y=32, not y=48. There are ~16 px of transparent padding
  // below the character. We anchor at the actual feet (y=32) so the
  // character sits ON the tile, matching the chest's anchor.
  hero: {
    cellW: 48,
    cellH: 48,
    anchorX: 24,
    anchorY: 32,
    rowByDir: { down: 0, up: 1, left: 2, right: 3 },
    walkFrameCount: 4,
  },
  // Chest sheet layout (2 rows × 5 columns of 48×48):
  //   Row 0 = down-facing chest, Row 1 = left-facing chest.
  //   Col 0 = closed; Col 1 = an alternate chunky chest variant (unused);
  //   Cols 2-4 = the opening animation.
  // For east-facing approaches we horizontally flip row 1.
  // facing="N" falls back to row 0 (no native up-facing art).
  //
  // Anchor: chest body's bottom-center. Measured opaque-pixel bbox shows
  // body bottom at exactly source y=32 across every frame, so anchorY=32
  // matches the hero — chest base and hero feet land on the same line.
  chest: {
    cellW: 48,
    cellH: 48,
    anchorX: 24,
    anchorY: 32,
    rowByFacing: { S: 0, N: 0, W: 1, E: 1 },
    flipByFacing: { S: false, N: false, W: false, E: true },
    closedFrame: 0,
    openFrames: [2, 3, 4],
  },
  // Fences: 4×4 grid of 16×16. Full autotile, picked by a 4-bit neighbor
  // bitmask (N=1, E=2, S=4, W=8) → [col, row].
  //
  // Layout (verified by Randy):
  //   col 0 is the vertical strip (top endcap, mid, bottom endcap, isolated post).
  //   row 3 is the horizontal strip (post, E-endcap, mid, W-endcap).
  //   cols 1-3 × rows 0-2 is the 3×3 corner/cross/T grid.
  fences: {
    cellW: 16,
    cellH: 16,
    bitmaskToCell: {
      0:  [0, 3],  // isolated post (no neighbors)
      1:  [0, 2],  // N only — fence rises from above, bottom endcap
      2:  [1, 3],  // E only — left endcap of horizontal run
      4:  [0, 0],  // S only — fence drops below, top endcap
      8:  [3, 3],  // W only — right endcap of horizontal run
      3:  [1, 2],  // N+E — bottom-left corner
      5:  [0, 1],  // N+S — vertical middle
      6:  [1, 0],  // E+S — top-left corner
      9:  [3, 2],  // N+W — bottom-right corner
      10: [2, 3],  // E+W — horizontal middle
      12: [3, 0],  // S+W — top-right corner
      7:  [1, 1],  // N+E+S — T pointing right
      11: [2, 2],  // N+E+W — T pointing up
      13: [3, 1],  // N+S+W — T pointing left
      14: [2, 0],  // E+S+W — T pointing down
      15: [2, 1],  // all four — cross
    },
  },
  // Grass: 11×7 grid of 16×16. Plain grass somewhere in the sheet.
  // The top-left area has the cleanest patches.
  grass: {
    cellW: 16,
    cellH: 16,
    plainCol: 1,
    plainRow: 1,
  },
  // Water animation: 4 frames in a 4×1 strip.
  water: {
    cellW: 16,
    cellH: 16,
    frames: 4,
    frameDurMs: 200,
  },
  // keys_a.png is a 200×40 strip of 9 keys. We use the 2nd from the left:
  // its opaque pixels span (27,9)–(38,29) → 11×20. Tall and narrow.
  // displayFrac is relative to TILE HEIGHT (key is taller than wide).
  key: {
    srcX: 27, srcY: 9, srcW: 11, srcH: 20,
    displayFrac: 0.425,
  },
};
