// Continuous-physics platformer engine.
//
// World is a tile grid. Hero position is continuous (sub-tile). Each
// student-facing action (right/left/jump_*) initiates a physics
// simulation that runs until the hero settles on a surface, at which
// point the action's awaiting Promise resolves.

import { TILE, isSolidTile, ATLAS, charFrameSrc } from "./assets.js";

export const SOURCE_TILE = 18;
export const DEFAULT_SCALE = 2;

// Physics constants (in tile units / second² etc.).
// Each action call covers exactly one tile of net displacement:
//   right()/left()  → ±1 tile horizontal
//   jump_up()       → up and back down on the same tile
//   jump_left()/_right() → ±1 horizontal, clearing a one-tile step
//
// A directional jump rises straight up first and only moves sideways once
// it is clear of a one-tile step (JUMP_CLEAR_RISE). Launching sideways
// immediately would scrape the step the hero is standing against — with the
// hero flush to it, there is no room to gain height before the collision.
const GRAVITY     = 60;
const MAX_FALL    = 22;
const WALK_SPEED  = 5.5;
const WALK_TILES  = 1;       // distance one right()/left() call covers
const JUMP_VY     = 13.2;    // peak ≈ 1.45 tiles up
const JUMP_DIR_VY = 13.2;
const JUMP_DIR_VX = 5.5;     // sideways speed once the step is cleared
const JUMP_CLEAR_RISE = 1.2; // rise this far before moving sideways

// Hero hitbox (in tile units). Slightly narrower than a tile so corners
// don't catch awkwardly.
const HERO_W = 0.7;
const HERO_H = 1.2;

// Settle threshold — when both velocities are tiny on a surface, we
// consider the hero at rest.
const REST_EPS = 0.05;

// Fixed physics sub-step. Frame time is divided into chunks no larger than
// this before being integrated (see _tickSim).
const MAX_SUB_STEP = 1 / 120;

export class Game {
  constructor(canvas, assets = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.scale = DEFAULT_SCALE;
    this.preferredScale = DEFAULT_SCALE;
    this.tile = SOURCE_TILE * this.scale;
    this.speed = 1;
    this.aborted = false;

    this.assets = assets;
    this.level = null;
    this.state = null;

    this._renderRaf = null;
    this._lastTs = 0;
    this._totalTs = 0;
    this._sim = null;       // current simulation { onTick(dt), settleCheck() → bool, resolve, reject }
    this._startRenderLoop();
  }

  setAssets(assets) { this.assets = assets; }
  setSpeed(mult)    { this.speed = mult; }
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

  abort()           { this.aborted = true; if (this._sim) this._sim.reject?.(new AbortError()); this._sim = null; }
  clearAbort()      { this.aborted = false; }

  // ---- level loading ----

  loadLevel(level) {
    this._sourceLevel = level;
    // Collecting a flag clears its tile, so never draw on the caller's own
    // grid: replaying a level has to start from the original tiles, not the
    // ones the previous attempt emptied.
    this.level = { ...level, tiles: level.tiles.map(row => row.slice()) };
    this.state = {
      hero: {
        x: this.level.start.x + 0.5,   // tile-center
        y: this.level.start.y + 1,     // feet at bottom of tile
        vx: 0, vy: 0,
        facing: "right",
        onGround: false,
        onWallLeft: false, onWallRight: false,
        anim: "idle",
        walkPhase: 0,
      },
      flagsRemaining: this._countFlags(this.level),
      won: false,
      message: null,
    };
    this.refitScale();
    this.aborted = false;
    this._sim = null;
    // Settle initial position: drop the hero straight down until on a surface.
    this._initialSettle();
    this._updateSurfaceState(this.state.hero);
    this.state.hero.anim = this.state.hero.onGround ? "idle" : "fall";
  }

  /**
   * Put the level back to how it started — flags restored, hero at the
   * start. This is what Reset, Try Again, and the start of every run need;
   * re-passing the current level would hand back the emptied grid.
   */
  resetLevel() {
    if (this._sourceLevel) this.loadLevel(this._sourceLevel);
  }

  _initialSettle() {
    const h = this.state.hero;
    // Simulate gravity in small steps for up to 2 seconds of game time.
    const dt = 1 / 60;
    for (let i = 0; i < 120; i++) {
      h.vy += GRAVITY * dt;
      if (h.vy > MAX_FALL) h.vy = MAX_FALL;
      h.y += h.vy * dt;
      this._resolveAxis("y", h);
      this._updateSurfaceState(h);
      if (h.onGround) { h.vy = 0; break; }
    }
  }

  _countFlags(level) {
    let n = 0;
    for (const row of level.tiles) for (const t of row) if (t === TILE.FLAG) n++;
    return n;
  }

  _resizeCanvas() {
    this.canvas.width  = this.level.width  * this.tile;
    this.canvas.height = this.level.height * this.tile;
    // Resizing a canvas resets its 2D context to defaults, smoothing back
    // ON — which samples across sprite-sheet cell edges and fringes every
    // tile. It has to be turned off again after every resize.
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---- tile queries ----

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) {
      return TILE.EMPTY;
    }
    return this.level.tiles[ty][tx];
  }

  _isSolidAt(tx, ty) { return isSolidTile(this.tileAt(tx, ty)); }

  /**
   * Check if a hero-shaped AABB at (cx, cy) where cy is the feet y
   * (bottom of bounding box) overlaps any solid tile.
   */
  _heroAABBCollides(cx, cy) {
    const left   = cx - HERO_W / 2;
    const right  = cx + HERO_W / 2;
    const top    = cy - HERO_H;
    const bottom = cy;
    for (let ty = Math.floor(top); ty <= Math.ceil(bottom) - 1; ty++) {
      for (let tx = Math.floor(left); tx <= Math.ceil(right) - 1; tx++) {
        if (this._isSolidAt(tx, ty)) return true;
      }
    }
    return false;
  }

  // ---- render loop ----

  _startRenderLoop() {
    const loop = (ts) => {
      const dt = (ts - this._lastTs) / 1000;
      this._lastTs = ts;
      this._totalTs += dt;
      if (this.state && this._sim) this._tickSim(Math.min(dt, 0.05) * this.speed);
      this._render();
      this._renderRaf = requestAnimationFrame(loop);
    };
    this._renderRaf = requestAnimationFrame(loop);
  }

  /**
   * Advance the simulation by dt, in fixed sub-steps. A frame's worth of
   * time at 4× speed is far too coarse to integrate in one go — the hero
   * would move most of a tile per step and tunnel through thin floors — so
   * speed changes how much simulated time a frame covers, never how
   * accurately it is simulated.
   */
  _tickSim(dt) {
    let remaining = Math.min(dt, 0.25);
    while (remaining > 0 && this._sim) {
      const step = Math.min(remaining, MAX_SUB_STEP);
      remaining -= step;
      this._tickSimStep(step);
    }
  }

  _tickSimStep(dt) {
    if (this.aborted) {
      const s = this._sim; this._sim = null;
      s.reject?.(new AbortError());
      return;
    }
    this._physicsStep(dt);
    this._collectFlagsUnderHero();
    const offMap = this._offMapMessage();
    if (offMap) {
      // Winning on the way off the map still counts — but the hero will
      // never settle down there, so end the action now.
      const s = this._sim; this._sim = null;
      if (this.state.won) s.resolve?.();
      else s.reject?.(new GameError(offMap));
      return;
    }
    // A win does not cut the action short: the hero finishes the move and
    // lands on the flag's tile, rather than freezing mid-stride.
    if (this._sim.settleCheck()) {
      const s = this._sim; this._sim = null;
      s.resolve?.();
    }
  }

  _physicsStep(dt) {
    const h = this.state.hero;

    // Gravity
    h.vy += GRAVITY * dt;
    if (h.vy > MAX_FALL) h.vy = MAX_FALL;

    // Move X then resolve, then Y then resolve.
    h.x += h.vx * dt;
    this._resolveAxis("x", h);
    h.y += h.vy * dt;
    this._resolveAxis("y", h);

    this._updateSurfaceState(h);

    // Walking phase for animation
    if (h.onGround && Math.abs(h.vx) > 0.01) {
      h.walkPhase = (h.walkPhase + dt * 5) % 2;
      h.anim = "walk";
    } else if (!h.onGround && h.vy < 0) {
      h.anim = "jump";
    } else if (!h.onGround && h.vy > 0.1) {
      h.anim = "fall";
    } else if (h.onWallLeft || h.onWallRight) {
      h.anim = "crouch";
    } else {
      h.anim = "idle";
    }
  }

  _resolveAxis(axis, h) {
    // Push out of any tile we now overlap.
    if (!this._heroAABBCollides(h.x, h.y)) return;
    // Find which side we entered from based on velocity sign.
    if (axis === "x") {
      if (h.vx > 0) {
        // Moving right: snap to left edge of the tile we hit.
        h.x = Math.floor(h.x + HERO_W / 2) - HERO_W / 2 - 0.0001;
      } else if (h.vx < 0) {
        h.x = Math.ceil(h.x - HERO_W / 2) + HERO_W / 2 + 0.0001;
      }
      h.vx = 0;
    } else {
      if (h.vy > 0) {
        // Moving down: feet hit top of a tile.
        h.y = Math.floor(h.y) - 0.0001;
      } else if (h.vy < 0) {
        // Moving up: head hits bottom of a tile.
        h.y = Math.ceil(h.y - HERO_H) + HERO_H + 0.0001;
      }
      h.vy = 0;
    }
  }

  _updateSurfaceState(h) {
    // Probe just outside the hitbox in each direction.
    const probeBelow = 0.05;
    h.onGround = this._heroAABBCollides(h.x, h.y + probeBelow);
    // For walls, only true if we're NOT on the ground (otherwise standing
    // next to a wall would count as wall-cling).
    h.onWallLeft  = !h.onGround && this._heroAABBCollides(h.x - probeBelow, h.y);
    h.onWallRight = !h.onGround && this._heroAABBCollides(h.x + probeBelow, h.y);
  }

  _collectFlagsUnderHero() {
    const h = this.state.hero;
    // Collect by the hero's own column, not their whole hitbox: brushing a
    // neighbouring tile with the edge of the sprite shouldn't count as
    // reaching the flag, or a flag appears to collect itself a tile early.
    const tx = Math.floor(h.x);
    const top    = h.y - HERO_H;
    const bottom = h.y;
    let collected = false;
    for (let ty = Math.floor(top); ty <= Math.ceil(bottom) - 1; ty++) {
      if (this.tileAt(tx, ty) === TILE.FLAG) {
        this.level.tiles[ty][tx] = TILE.EMPTY;
        this.state.flagsRemaining--;
        collected = true;
      }
    }
    if (collected && this.state.flagsRemaining <= 0) {
      this.state.won = true;
    }
  }

  // ---- student-facing actions ----

  async walk(direction) {
    const h = this.state.hero;
    h.facing = direction;
    const sign = direction === "right" ? 1 : -1;
    h.vx = sign * WALK_SPEED;
    const startX = h.x;
    // Settle when (a) we've covered WALK_TILES and we're on ground at rest,
    // or (b) we hit a wall (vx forced to 0), or (c) we fall onto ground.
    return this._runSim((dt) => {
      // Stop dead once a full tile has been covered, landing on the exact
      // tile centre: a frame's worth of overshoot per call would otherwise
      // accumulate over a long loop and drift the hero off the grid.
      if (Math.abs(h.x - startX) >= WALK_TILES) {
        h.x = startX + sign * WALK_TILES;
        h.vx = 0;
      }
      return this._atRestOnGround(h);
    });
  }

  async jump(direction) {
    const h = this.state.hero;
    if (!h.onGround) {
      throw new GameError("Can't jump from here — you're not standing on anything.");
    }
    h.vy = direction === "up" ? -JUMP_VY : -JUMP_DIR_VY;
    h.vx = 0;
    if (direction !== "up") h.facing = direction;
    // Force airborne immediately so the ground state clears for this frame.
    h.onGround = h.onWallLeft = h.onWallRight = false;
    const startX = h.x;
    const startY = h.y;
    const sign = direction === "right" ? 1 : -1;

    return this._runSim((dt) => {
      if (direction !== "up") {
        // Move sideways only once high enough to clear a one-tile step,
        // then stop after covering one tile so the landing is predictable.
        if (startY - h.y >= JUMP_CLEAR_RISE && h.vx === 0) h.vx = sign * JUMP_DIR_VX;
        if (Math.abs(h.x - startX) >= WALK_TILES) {
          h.x = startX + sign * WALK_TILES;
          h.vx = 0;
        }
      }
      return this._atRestOnGround(h);
    });
  }

  /**
   * An action ends when the hero is standing still on solid ground. Resting
   * mid-air is deliberately not a settled state: every action starts and ends
   * with both feet down, which is what makes one call = one predictable move.
   */
  _atRestOnGround(h) {
    return h.onGround && Math.abs(h.vx) < REST_EPS && Math.abs(h.vy) < REST_EPS;
  }

  _runSim(settleCheck) {
    return new Promise((resolve, reject) => {
      this._sim = { settleCheck, resolve, reject };
    });
  }

  /**
   * The hero has left the level entirely (walked off a side edge, or fell
   * past the bottom row). Without this the simulation would never settle.
   * Returns a message to report, or null while the hero is still in play.
   */
  _offMapMessage() {
    const h = this.state.hero;
    if (h.x < -1 || h.x > this.level.width + 1) {
      return "You walked off the side of the level. Check how far you're travelling.";
    }
    if (h.y > this.level.height + 2) {
      return "You fell out of the level. Check where the ground runs out.";
    }
    return null;
  }

  // ---- sensors ----

  isOnGround()    { return !!this.state.hero.onGround; }
  isOnWallLeft()  { return !!this.state.hero.onWallLeft; }
  isOnWallRight() { return !!this.state.hero.onWallRight; }
  flagsLeft()     { return this.state.flagsRemaining; }

  /** Tile column the hero is standing in (an integer, counting from 0 at the left). */
  positionX()     { return this.heroCol(); }
  /** Tile row the hero is standing in (an integer, counting from 0 at the top). */
  positionY()     { return this.heroRow(); }

  heroCol()       { return Math.floor(this.state.hero.x); }
  heroRow()       { return Math.floor(this.state.hero.y - 0.01); }

  /**
   * Is there a solid tile directly beside the hero, at the height they
   * stand at? That is exactly what a walk in that direction would bump
   * into — and what a directional jump would clear.
   */
  isWallRight()   { return this._isSolidAt(this.heroCol() + 1, this.heroRow()); }
  isWallLeft()    { return this._isSolidAt(this.heroCol() - 1, this.heroRow()); }

  checkWin()      { return this.state.won; }

  // ---- rendering ----

  _render() {
    const { ctx, level, state, tile } = this;
    if (!level) {
      ctx.fillStyle = "#1a1b23";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    this._drawBackground();
    this._drawTiles();
    if (state) this._drawHero();
  }

  _drawBackground() {
    const { ctx } = this;
    const imgs = this.assets?.images;
    if (imgs?.backgrounds) {
      const a = ATLAS.backgrounds;
      const which = a[this.level.background || "forest"] ?? 0;
      // Tile horizontally to fill the canvas, flipping every other copy.
      // The scene's left and right edges don't match, so tiling it plainly
      // leaves a hard vertical seam at every repeat; mirroring makes each
      // pair meet edge-to-matching-edge instead.
      const sw = a.cellW, sh = a.cellH;
      const dh = this.canvas.height;
      const dw = (sw / sh) * dh;
      for (let i = 0, dx = 0; dx < this.canvas.width; i++, dx += dw) {
        ctx.save();
        if (i % 2 === 1) {
          ctx.translate(dx + dw, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(imgs.backgrounds, which * sw, 0, sw, sh, 0, 0, dw, dh);
        } else {
          ctx.drawImage(imgs.backgrounds, which * sw, 0, sw, sh, dx, 0, dw, dh);
        }
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "#a4d5f7";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  _drawTiles() {
    const { ctx, level, tile } = this;
    const imgs = this.assets?.images;
    const atlas = ATLAS.tiles;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const t = level.tiles[y][x];
        if (t === TILE.EMPTY) continue;
        const px = x * tile;
        const py = y * tile;
        const cell = this._tileSpriteCell(t, x, y);
        if (imgs?.tiles && cell) {
          ctx.drawImage(imgs.tiles,
            cell[0] * atlas.cellW, cell[1] * atlas.cellH, atlas.cellW, atlas.cellH,
            px, py, tile, tile);
          // Special: flag has a second tile rendered above (the visible flag).
          // The Kenney flag sprite extends right to the cell edge, leaving a
          // stray dark-red column. Trim the rightmost source pixel.
          if (t === TILE.FLAG && y > 0) {
            const top = atlas.flagTopCell;
            const trim = 1;
            ctx.drawImage(imgs.tiles,
              top[0] * atlas.cellW, top[1] * atlas.cellH,
              atlas.cellW - trim, atlas.cellH,
              px, py - tile,
              tile - tile * (trim / atlas.cellW), tile);
          }
        } else {
          this._fallbackTile(t, px, py, tile);
        }
      }
    }
  }

  /**
   * Pick the right source cell for a tile based on neighbours (autotile).
   */
  _tileSpriteCell(t, x, y) {
    const atlas = ATLAS.tiles;
    // Both grass and dirt autotile across columns 0–3 based on whether
    // the tile to the left/right is another solid platform tile.
    if (t === TILE.GRASS || t === TILE.DIRT) {
      const left  = isSolidTile(this.tileAt(x - 1, y));
      const right = isSolidTile(this.tileAt(x + 1, y));
      const below = isSolidTile(this.tileAt(x, y + 1));
      let col;
      if (!left && !right) col = 0;       // isolated column
      else if (!left && right) col = 1;   // left edge
      else if (left && right) col = 2;    // middle
      else col = 3;                        // right edge
      if (t === TILE.GRASS) {
        const row = below ? atlas.grassRowNoBottom : atlas.grassRowWithBottom;
        return [col, row];
      }
      // DIRT
      const row = below ? 6 : 7;          // middle dirt (interior) vs bottom dirt
      return [col, row];
    }
    return atlas.byId[t];
  }

  _fallbackTile(id, x, y, s) {
    const colors = {
      [TILE.GRASS]: "#3a8a3a",
      [TILE.DIRT]: "#7a4a2a",
      [TILE.STONE]: "#8a8a8a",
      [TILE.SPIKE]: "#aa3030",
      [TILE.FLAG]: "#ffdc4a",
      [TILE.COIN]: "#ffd866",
      [TILE.PLATFORM]: "#b08040",
    };
    this.ctx.fillStyle = colors[id] || "#666";
    this.ctx.fillRect(x, y, s, s);
  }

  _drawHero() {
    const { ctx, state, tile } = this;
    const h = state.hero;
    const imgs = this.assets?.images;
    const a = ATLAS.chars;

    // Pick frame.
    let frameOffset = a.frame.IDLE;
    if (h.anim === "walk")   frameOffset = (h.walkPhase < 1) ? a.frame.WALK_1 : a.frame.WALK_2;
    else if (h.anim === "jump")   frameOffset = a.frame.JUMP;
    else if (h.anim === "fall")   frameOffset = a.frame.FALL;
    else if (h.anim === "crouch") frameOffset = a.frame.CROUCH;

    // Display size: scale character so its body is ~1 tile wide × 1.5 tall.
    const dW = a.displayW * tile;
    const dH = a.displayH * tile;
    // Position: anchor at bottom-center of hitbox.
    const cx = h.x * tile;
    const cy = h.y * tile;
    const dx = cx - dW / 2;
    const dy = cy - dH;

    const flip = h.facing === "left";

    if (imgs?.chars) {
      const src = charFrameSrc(a.defaultCharacter, frameOffset);
      ctx.save();
      ctx.translate(dx + (flip ? dW : 0), dy);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(imgs.chars, src.sx, src.sy, src.sw, src.sh, 0, 0, dW, dH);
      ctx.restore();
    } else {
      // Placeholder hero
      ctx.fillStyle = "#8be9fd";
      ctx.fillRect(dx, dy, dW, dH);
    }
  }
}

export class AbortError extends Error {
  constructor() { super("Execution stopped."); this.name = "AbortError"; }
}
export class GameError extends Error {
  constructor(msg) { super(msg); this.name = "GameError"; }
}
