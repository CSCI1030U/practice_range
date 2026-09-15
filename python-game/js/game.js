// Tile-based game engine with placeholder graphics.
// Designed so real sprites can be dropped in by replacing the draw* helpers
// in the SPRITES table without touching engine logic.

// Source assets are 16×16 native pixels. The on-screen display size is
// `Game#tile`, which equals `SOURCE_TILE * Game#scale`. Scale is a runtime
// property and can be changed via `Game#setScale(n)`.
export const SOURCE_TILE = 16;
export const DEFAULT_SCALE = 2;

export const TILES = {
  FLOOR: 0,
  WALL: 1,
  EXIT: 2,         // goal pad (unused in v1 — we use treasure as goal)
  WATER: 3,        // impassable, visually distinct from wall
};

export const DIR = {
  UP:    { dx:  0, dy: -1, name: "up" },
  DOWN:  { dx:  0, dy:  1, name: "down" },
  LEFT:  { dx: -1, dy:  0, name: "left" },
  RIGHT: { dx:  1, dy:  0, name: "right" },
};

// ----- Placeholder graphics -----
// Each draws one tile/sprite into a 2D ctx at (px, py) with given size.
// Swap any of these with image blits for real assets later.

function drawFloor(ctx, x, y, s) {
  ctx.fillStyle = "#2a2d3e";
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "#1f2230";
  ctx.fillRect(x, y, s, 1);
  ctx.fillRect(x, y, 1, s);
}

function drawWall(ctx, x, y, s) {
  ctx.fillStyle = "#5a4a3a";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#3a2e22";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  // brick pattern
  ctx.strokeStyle = "#4a3c2e";
  ctx.beginPath();
  ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s, y + s / 2);
  ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s / 2);
  ctx.moveTo(x + s / 4, y + s / 2); ctx.lineTo(x + s / 4, y + s);
  ctx.moveTo(x + 3 * s / 4, y + s / 2); ctx.lineTo(x + 3 * s / 4, y + s);
  ctx.stroke();
}

function drawWater(ctx, x, y, s) {
  ctx.fillStyle = "#2a4a6a";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#3a6a8a";
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const yy = y + s * (0.25 + i * 0.25);
    ctx.moveTo(x + 4, yy);
    ctx.bezierCurveTo(x + s / 3, yy - 2, x + 2 * s / 3, yy + 2, x + s - 4, yy);
  }
  ctx.stroke();
}

function drawExit(ctx, x, y, s) {
  ctx.fillStyle = "#2a2d3e";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#50fa7b";
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(x + 4, y + 4, s - 8, s - 8);
  ctx.setLineDash([]);
}

function drawHero(ctx, x, y, s, dir, walkPhase) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, y + s - 4, s * 0.32, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = "#8be9fd";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1e1f29";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // direction indicator (eye/nose)
  ctx.fillStyle = "#1e1f29";
  const off = s * 0.18;
  let ex = cx, ey = cy;
  if (dir === DIR.UP)    ey -= off;
  if (dir === DIR.DOWN)  ey += off;
  if (dir === DIR.LEFT)  ex -= off;
  if (dir === DIR.RIGHT) ex += off;
  ctx.beginPath();
  ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // walking bob (simple)
  // (walkPhase 0..1) - we already animate position; this is just cosmetic
}

function drawTreasure(ctx, x, y, s, opened) {
  const pad = s * 0.18;
  const w = s - pad * 2;
  const h = s - pad * 2;
  ctx.fillStyle = "#a06030";
  ctx.fillRect(x + pad, y + pad + h * 0.35, w, h * 0.65);
  ctx.fillStyle = opened ? "#ffd866" : "#c07840";
  ctx.fillRect(x + pad, y + pad, w, h * 0.4);
  ctx.strokeStyle = "#5a3a1a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, h - 1);
  // lock / shine
  ctx.fillStyle = opened ? "#ffec99" : "#ffcc44";
  ctx.fillRect(x + s / 2 - 2, y + pad + h * 0.3, 4, 6);
  if (opened) {
    // sparkle
    ctx.fillStyle = "#fffacd";
    ctx.fillRect(x + s / 2 - 1, y + pad - 3, 2, 4);
    ctx.fillRect(x + s / 2 - 3, y + pad - 1, 6, 2);
  }
}

function drawKey(ctx, x, y, s) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = "#ffd866";
  ctx.beginPath();
  ctx.arc(cx - 5, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 1, cy - 1, 9, 2);
  ctx.fillRect(cx + 5, cy + 1, 2, 3);
  ctx.fillRect(cx + 3, cy + 1, 2, 3);
}

function drawCoin(ctx, x, y, s) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = "#ffd866";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a07820";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#a07820";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", cx, cy + 1);
}

const TILE_DRAWERS = {
  [TILES.FLOOR]: drawFloor,
  [TILES.WALL]:  drawWall,
  [TILES.EXIT]:  drawExit,
  [TILES.WATER]: drawWater,
};

// ----- Game state -----

export class Game {
  constructor(canvas, assets = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.scale = DEFAULT_SCALE;
    this.preferredScale = DEFAULT_SCALE;
    this.tile = SOURCE_TILE * this.scale;
    this.speed = 1;           // animation speed multiplier
    this.aborted = false;
    this.level = null;
    this.state = null;
    this.assets = assets;     // { images: {hero, chest, ...}, atlas: {...} }
    this._renderRaf = null;
    this._lastTs = 0;
    this._totalTs = 0;
    this._tickSubs = [];
    this._startRenderLoop();
  }

  setAssets(assets) { this.assets = assets; }

  setScale(s) {
    this.preferredScale = s;
    this.refitScale();
  }

  /**
   * Apply the largest whole-number scale that fits the pane without
   * exceeding the scale the student picked. A canvas wider than its pane is
   * scaled down by CSS at some fractional ratio, which turns evenly sized
   * tiles into uneven ones — seams and wobbling tile widths right across
   * the level.
   */
  refitScale() {
    this.scale = this._fittedScale();
    this.tile = SOURCE_TILE * this.scale;
    if (this.level) this._resizeCanvas();
  }

  _fittedScale() {
    const preferred = this.preferredScale ?? DEFAULT_SCALE;
    const host = this.canvas.parentElement;
    if (!this.level || !host || typeof getComputedStyle !== "function") return preferred;
    const pad = getComputedStyle(host);
    const availW = host.clientWidth  - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    const availH = host.clientHeight - parseFloat(pad.paddingTop)  - parseFloat(pad.paddingBottom);
    if (!(availW > 0) || !(availH > 0)) return preferred;
    const fit = Math.min(
      Math.floor(availW / (this.level.width  * SOURCE_TILE)),
      Math.floor(availH / (this.level.height * SOURCE_TILE)),
    );
    return Math.max(1, Math.min(preferred, fit));
  }


  setSpeed(mult) { this.speed = mult; }
  abort() { this.aborted = true; }
  clearAbort() { this.aborted = false; }

  loadLevel(level) {
    this.level = level;
    this.state = {
      hero: { x: level.start.x, y: level.start.y, dir: DIR[level.start.dir || "RIGHT"] },
      items: (level.items || []).map(it => ({ ...it, collected: false })),
      chest: level.chest
        ? { ...level.chest, opened: false, facing: level.chest.facing || "S" }
        : null,
      coinsCollected: 0,
      anim: null,
      message: null,
      messageAt: 0,
    };
    this.refitScale();
    this.aborted = false;
  }

  _resizeCanvas() {
    const w = this.level.width * this.tile;
    const h = this.level.height * this.tile;
    this.canvas.width = w;
    this.canvas.height = h;
    // Resizing a canvas resets its 2D context to defaults, smoothing back
    // ON — which samples across sprite-sheet cell edges and fringes every
    // tile. It has to be turned off again after every resize.
    this.ctx.imageSmoothingEnabled = false;
  }

  _startRenderLoop() {
    const loop = (ts) => {
      const dt = ts - this._lastTs;
      this._lastTs = ts;
      this._totalTs += dt;
      this._tickAnim(dt);
      this._render();
      this._renderRaf = requestAnimationFrame(loop);
    };
    this._renderRaf = requestAnimationFrame(loop);
  }

  _tickAnim(dt) {
    if (!this.state) return;
    const a = this.state.anim;
    if (a) {
      if (this.aborted) {
        this.state.anim = null;
        a.reject?.(new AbortError());
        return;
      }
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.t = t;
      if (t >= 1) {
        // Snap hero position to the move target before the render runs.
        // The async stepInDir await resumes via a microtask AFTER this
        // animation frame's render, so without this finalization the
        // render between two queued moves would briefly show the old
        // position (a one-frame backward flash).
        if (a.type === "move") {
          this.state.hero.x = a.toX;
          this.state.hero.y = a.toY;
        }
        this.state.anim = null;
        a.resolve?.();
      }
    }
    for (const fn of this._tickSubs) fn();
  }

  _render() {
    const { ctx, level, state } = this;
    if (!level) {
      ctx.fillStyle = "#0a0b10";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const s = this.tile;
    const useSprites = !!(this.assets && this.assets.images);

    // tiles
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const t = level.tiles[y][x];
        if (useSprites) {
          this._drawTileSprite(t, x, y);
        } else {
          const drawer = TILE_DRAWERS[t] || drawFloor;
          drawer(ctx, x * s, y * s, s);
        }
      }
    }

    // items
    for (const it of state.items) {
      if (it.collected) continue;
      const px = it.x * s, py = it.y * s;
      if (it.type === "key") {
        if (useSprites && this.assets.images.key) {
          this._drawKeySprite(it);
        } else {
          drawKey(ctx, px, py, s);
        }
      }
      if (it.type === "coin") drawCoin(ctx, px, py, s);
    }

    // chest
    if (state.chest) {
      if (useSprites) {
        this._drawChestSprite(state.chest);
      } else {
        drawTreasure(ctx, state.chest.x * s, state.chest.y * s, s, state.chest.opened);
      }
    }

    // hero (with interpolation)
    let hx = state.hero.x, hy = state.hero.y;
    let walkPhase = 0;
    if (state.anim && state.anim.type === "move") {
      const a = state.anim;
      hx = a.fromX + (a.toX - a.fromX) * a.t;
      hy = a.fromY + (a.toY - a.fromY) * a.t;
      walkPhase = a.t;
    }
    if (useSprites) {
      this._drawHeroSprite(hx, hy, state.hero.dir, walkPhase);
    } else {
      drawHero(ctx, hx * s, hy * s, s, state.hero.dir, walkPhase);
    }

    // bump indicator
    if (state.anim && state.anim.type === "bump") {
      const a = state.anim;
      const tx = (state.hero.x + state.hero.dir.dx) * s;
      const ty = (state.hero.y + state.hero.dir.dy) * s;
      ctx.fillStyle = `rgba(255,85,85,${0.4 * Math.sin(a.t * Math.PI)})`;
      ctx.fillRect(tx, ty, s, s);
    }
  }

  // ----- Sprite rendering helpers -----

  _drawTileSprite(tileId, gx, gy) {
    const { ctx, assets } = this;
    const s = this.tile;
    const px = gx * s, py = gy * s;
    const imgs = assets.images;
    const atlas = assets.atlas;

    // Ground layer: grass beneath everything except water.
    if (tileId === TILES.WATER) {
      if (imgs.water) {
        const a = atlas.water;
        const frame = Math.floor(this._totalTs / a.frameDurMs) % a.frames;
        ctx.drawImage(imgs.water,
          frame * a.cellW, 0, a.cellW, a.cellH,
          px, py, s, s);
      } else { drawWater(ctx, px, py, s); }
    } else if (imgs.grass) {
      const a = atlas.grass;
      ctx.drawImage(imgs.grass,
        a.plainCol * a.cellW, a.plainRow * a.cellH, a.cellW, a.cellH,
        px, py, s, s);
    } else {
      drawFloor(ctx, px, py, s);
    }

    // Decoration layer on top of grass.
    if (tileId === TILES.WALL) {
      if (imgs.fences) {
        const a = atlas.fences;
        const mask = this._wallNeighborMask(gx, gy);
        const cell = a.bitmaskToCell[mask] || a.bitmaskToCell[0];
        ctx.drawImage(imgs.fences,
          cell[0] * a.cellW, cell[1] * a.cellH, a.cellW, a.cellH,
          px, py, s, s);
      } else { drawWall(ctx, px, py, s); }
    } else if (tileId === TILES.EXIT) {
      drawExit(ctx, px, py, s);
    }
  }

  _wallNeighborMask(gx, gy) {
    // Returns a 4-bit mask (N=1, E=2, S=4, W=8) of which neighbors are walls.
    // Out-of-bounds neighbors are treated as "no fence" so border walls
    // render as corners/endpoints rather than as fully connected crosses.
    const isWall = (x, y) => {
      if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return false;
      return this.level.tiles[y][x] === TILES.WALL;
    };
    let m = 0;
    if (isWall(gx,     gy - 1)) m |= 1;  // N
    if (isWall(gx + 1, gy))     m |= 2;  // E
    if (isWall(gx,     gy + 1)) m |= 4;  // S
    if (isWall(gx - 1, gy))     m |= 8;  // W
    return m;
  }

  _drawChestSprite(chest) {
    const { ctx, assets } = this;
    const s = this.tile;
    const imgs = assets.images;
    if (!imgs.chest) {
      drawTreasure(ctx, chest.x * s, chest.y * s, s, chest.opened);
      return;
    }
    const a = assets.atlas.chest;

    let frame = a.closedFrame;
    if (chest.opened) frame = a.openFrames[a.openFrames.length - 1];
    if (this.state.anim && this.state.anim.type === "open") {
      const t = this.state.anim.t;
      const idx = Math.min(a.openFrames.length - 1, Math.floor(t * a.openFrames.length));
      frame = a.openFrames[idx];
    }

    const facing = chest.facing || "S";
    const row = a.rowByFacing[facing] ?? 0;
    const flipX = !!a.flipByFacing[facing];

    const destW = a.cellW * this.scale;
    const destH = a.cellH * this.scale;
    const srcX = frame * a.cellW;
    const srcY = row * a.cellH;
    // Anchor: chest body's bottom-center aligned to the tile's bottom-center.
    const dx = chest.x * s + s / 2 - a.anchorX * this.scale;
    const dy = chest.y * s + s - a.anchorY * this.scale;

    if (flipX) {
      ctx.save();
      ctx.translate(dx + destW, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(imgs.chest, srcX, srcY, a.cellW, a.cellH, 0, 0, destW, destH);
      ctx.restore();
    } else {
      ctx.drawImage(imgs.chest, srcX, srcY, a.cellW, a.cellH, dx, dy, destW, destH);
    }
  }

  _drawKeySprite(item) {
    const { ctx, assets } = this;
    const a = assets.atlas.key;
    const t = this.tile;
    // Scale by height so the key fits the tile vertically (key is taller than wide).
    const dispH = t * a.displayFrac;
    const dispW = dispH * (a.srcW / a.srcH);
    const cx = (item.x + 0.5) * t;
    const cy = (item.y + 0.5) * t;
    ctx.drawImage(assets.images.key,
      a.srcX, a.srcY, a.srcW, a.srcH,
      cx - dispW / 2, cy - dispH / 2, dispW, dispH);
  }

  _drawHeroSprite(gx, gy, dir, walkPhase) {
    const { ctx, assets } = this;
    const s = this.tile;
    const imgs = assets.images;
    if (!imgs.hero) {
      drawHero(ctx, gx * s, gy * s, s, dir, walkPhase);
      return;
    }
    const a = assets.atlas.hero;
    const row = a.rowByDir[dir.name] ?? 0;
    let col = 0;
    if (walkPhase > 0) {
      col = Math.min(a.walkFrameCount - 1, Math.floor(walkPhase * a.walkFrameCount));
    }
    const destW = a.cellW * this.scale;
    const destH = a.cellH * this.scale;
    const dx = gx * s + s / 2 - a.anchorX * this.scale;
    const dy = gy * s + s - a.anchorY * this.scale;
    ctx.drawImage(imgs.hero,
      col * a.cellW, row * a.cellH, a.cellW, a.cellH,
      dx, dy, destW, destH);
  }

  // ----- Engine API used by JS-side bridge -----

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.level.width && y < this.level.height;
  }

  tileAt(x, y) {
    if (!this.inBounds(x, y)) return TILES.WALL;
    return this.level.tiles[y][x];
  }

  isBlocked(x, y) {
    const t = this.tileAt(x, y);
    if (t === TILES.WALL || t === TILES.WATER) return true;
    // The chest occupies its tile — hero stops adjacent to open it,
    // so the chest tile itself is impassable.
    const c = this.state && this.state.chest;
    if (c && c.x === x && c.y === y) return true;
    return false;
  }

  async animate(type, props, durationMs) {
    if (this.aborted) throw new AbortError();
    const dur = durationMs / this.speed;
    return new Promise((resolve, reject) => {
      this.state.anim = {
        type, ...props,
        elapsed: 0, t: 0, duration: dur,
        resolve, reject,
      };
    });
  }

  async stepInDir(dir) {
    const { hero } = this.state;
    hero.dir = dir;
    const nx = hero.x + dir.dx;
    const ny = hero.y + dir.dy;
    if (this.isBlocked(nx, ny)) {
      await this.animate("bump", {}, 260);
      return false;
    }
    await this.animate("move", { fromX: hero.x, fromY: hero.y, toX: nx, toY: ny }, 220);
    if (this.aborted) throw new AbortError();
    hero.x = nx;
    hero.y = ny;
    // Auto-pickup for coins only; keys need an explicit pick_up_key() call.
    for (const it of this.state.items) {
      if (it.collected) continue;
      if (it.x !== hero.x || it.y !== hero.y) continue;
      if (it.type === "coin") {
        it.collected = true;
        this.state.coinsCollected++;
      }
    }
    return true;
  }

  async turn(dir) {
    this.state.hero.dir = dir;
    await this.animate("turn", {}, 120);
  }

  async pickUpKey() {
    const { hero } = this.state;
    // Pick up any key within reach (on the same tile or one tile away).
    const key = this.state.items.find(it => {
      if (it.type !== "key" || it.collected) return false;
      return Math.abs(it.x - hero.x) + Math.abs(it.y - hero.y) <= 1;
    });
    if (!key) {
      throw new GameError("There is no key here to pick up.");
    }
    key.collected = true;
    await this.animate("pickup", {}, 240);
  }

  /**
   * Walk to a target. target is the string "chest" or "key" (case-insensitive).
   * Plans the shortest path with BFS, then steps along it.
   */
  async goTo(target) {
    const goals = this._resolveGoToTarget(target);
    if (!goals) {
      throw new GameError(`go_to: don't know how to find '${target}'.`);
    }
    if (goals.length === 0) {
      throw new GameError(`go_to: nothing to go to — no ${String(target).toLowerCase()} available.`);
    }
    const path = this._bfsPath(this.state.hero.x, this.state.hero.y, goals);
    if (path === null) {
      throw new GameError(`go_to: can't reach the ${String(target).toLowerCase()} from here.`);
    }
    for (const dir of path) {
      if (this.aborted) throw new AbortError();
      await this.stepInDir(dir);
    }
  }

  _resolveGoToTarget(target) {
    const t = String(target).toLowerCase();
    if (t === "chest" || t === "treasure") {
      const c = this.state.chest;
      if (!c) return [];
      return this._adjacentWalkable(c.x, c.y);
    }
    if (t === "key") {
      const keys = this.state.items.filter(it => it.type === "key" && !it.collected);
      const tiles = [];
      const seen = new Set();
      for (const k of keys) {
        for (const tile of this._adjacentWalkable(k.x, k.y)) {
          const tk = `${tile.x},${tile.y}`;
          if (!seen.has(tk)) { seen.add(tk); tiles.push(tile); }
        }
      }
      return tiles;
    }
    return null;
  }

  _adjacentWalkable(x, y) {
    const result = [];
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx = x + dx, ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;
      if (this.isBlocked(nx, ny)) continue;
      result.push({ x: nx, y: ny });
    }
    return result;
  }

  _bfsPath(sx, sy, goalTiles) {
    if (!goalTiles.length) return null;
    const goalSet = new Set(goalTiles.map(t => `${t.x},${t.y}`));
    const startKey = `${sx},${sy}`;
    if (goalSet.has(startKey)) return [];
    const visited = new Set([startKey]);
    const queue = [{ x: sx, y: sy, path: [] }];
    const steps = [
      [0, -1, DIR.UP],
      [1,  0, DIR.RIGHT],
      [0,  1, DIR.DOWN],
      [-1, 0, DIR.LEFT],
    ];
    while (queue.length) {
      const { x, y, path } = queue.shift();
      for (const [dx, dy, dir] of steps) {
        const nx = x + dx, ny = y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!this.inBounds(nx, ny)) continue;
        if (this.isBlocked(nx, ny)) continue;
        visited.add(key);
        const next = path.concat([dir]);
        if (goalSet.has(key)) return next;
        queue.push({ x: nx, y: ny, path: next });
      }
    }
    return null;
  }

  async openChest() {
    const { hero, chest } = this.state;
    if (!chest) {
      throw new GameError("There is no treasure chest in this level.");
    }
    const dx = hero.x - chest.x;
    const dy = hero.y - chest.y;
    const manhattan = Math.abs(dx) + Math.abs(dy);
    if (manhattan !== 1) {
      throw new GameError("You must stand next to the treasure chest (not on top of it) to open it.");
    }
    if (chest.requiresKey && !this.hasItem("key")) {
      throw new GameError("The chest is locked. You need a key first.");
    }
    chest.opened = true;
    await this.animate("open", {}, 600);
  }

  isNextToChest() {
    const { hero, chest } = this.state;
    if (!chest) return false;
    return Math.abs(hero.x - chest.x) + Math.abs(hero.y - chest.y) === 1;
  }

  // Kept for backwards compatibility with the original API surface; now
  // returns true when standing adjacent to the chest.
  isOnChest() { return this.isNextToChest(); }

  isWallInDir(dir) {
    const { hero } = this.state;
    return this.isBlocked(hero.x + dir.dx, hero.y + dir.dy);
  }

  isKeyInDir(dir) {
    const { hero } = this.state;
    const tx = hero.x + dir.dx;
    const ty = hero.y + dir.dy;
    return this.state.items.some(it =>
      it.type === "key" && !it.collected && it.x === tx && it.y === ty);
  }

  hasItem(type) {
    return this.state.items.some(it => it.type === type && it.collected);
  }

  itemCount(type) {
    return this.state.items.filter(it => it.type === type && it.collected).length;
  }

  position() { return { x: this.state.hero.x, y: this.state.hero.y }; }

  checkWin() {
    const goal = this.level.goal || { type: "open_chest" };
    if (goal.type === "open_chest") {
      return !!this.state.chest && this.state.chest.opened;
    }
    if (goal.type === "reach") {
      return this.state.hero.x === goal.x && this.state.hero.y === goal.y;
    }
    if (goal.type === "collect_all_coins") {
      return this.state.items.every(it => it.type !== "coin" || it.collected);
    }
    return false;
  }
}

export class AbortError extends Error {
  constructor() { super("Execution stopped."); this.name = "AbortError"; }
}
export class GameError extends Error {
  constructor(msg) { super(msg); this.name = "GameError"; }
}
