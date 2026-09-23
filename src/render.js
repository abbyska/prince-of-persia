import { SCREEN_W, SCREEN_H, TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS, ROOM_W, ROOM_H } from './constants.js';
import { T } from './level.js';
import { princeJoints, guardJoints } from './figure.js';
import { drawText } from './font.js';

// A small VGA-style palette for the blue dungeon.
const PAL = {
  bg: '#1c2656',
  bgMortar: '#111838',
  bgHi: '#28346c',
  bgLo: '#18204a',
  block: '#4c5a98',
  blockHi: '#7483c0',
  blockLo: '#2c3668',
  floorTop: '#8e9cd6',
  floorFront: '#5664a2',
  floorLine: '#2a3264',
  pillar: '#6a78b6',
  pillarHi: '#a0acdf',
  pillarLo: '#3e4a88',
  metal: '#6a5434',
  flame: ['#fc5454', '#fca854', '#fcfc54'],
  spike: '#c8c8dc',
  spikeTip: '#fcfcfc',
  gate: '#2a2a36',
  gateHi: '#6c6c84',
  door: '#5a6090',
  doorLine: '#3a4070',
  stair: ['#202848', '#2c3660'],
  glass: '#a8c8fc',
  cork: '#8a6a3a',
  red: '#fc5454',
  green: '#54fc54',
  steel: '#dcdcf0',
  gold: '#fcd454',
  hp: '#fc5454',
  hpEmpty: '#6c1818',
  guardHp: '#5480fc',
  text: '#fcfcfc',
};

const PRINCE_LOOK = { cloth: '#f4f4f4', dark: '#a4a4c0', skin: '#e0a070', hair: '#2a1a10', turban: null, belt: null };
const GUARD_LOOK = { cloth: '#6a7ce0', dark: '#34409a', skin: '#c88050', hair: '#2a1a10', turban: '#e8e8e8', belt: '#fcd454' };

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// Thick pixel line (Bresenham with a square brush).
function line(ctx, ax, ay, bx, by, w) {
  let x0 = Math.round(ax);
  let y0 = Math.round(ay);
  const x1 = Math.round(bx);
  const y1 = Math.round(by);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const o = w >> 1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.cache = document.createElement('canvas');
    this.cache.width = ROOM_W;
    this.cache.height = ROOM_H;
    this.cacheKey = '';
    this.frame = 0;
  }

  // ---- static room layer ---------------------------------------------------

  staticRoom(level, rx, ry) {
    const key = `${rx},${ry},${level.version},${level.def.name}`;
    if (key === this.cacheKey) return this.cache;
    this.cacheKey = key;
    const ctx = this.cache.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const wc = rx * ROOM_COLS + c;
        const wr = ry * ROOM_ROWS + r;
        const x = c * TILE_W;
        const y = r * TILE_H;
        const tl = level.tile(wc, wr);
        if (tl.t === T.WALL) this.wallBlock(ctx, x, y, wc, wr, level);
        else this.backWall(ctx, x, y, wc, wr);
      }
    }
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const wc = rx * ROOM_COLS + c;
        const wr = ry * ROOM_ROWS + r;
        const x = c * TILE_W;
        const y = r * TILE_H;
        const tl = level.tile(wc, wr);
        switch (tl.t) {
          case T.FLOOR:
          case T.POTION:
          case T.SWORD:
          case T.SPIKES:
          case T.GATE:
            this.floor(ctx, x, y, wc, wr, level);
            break;
          case T.TORCH:
            this.sconce(ctx, x, y);
            this.floor(ctx, x, y, wc, wr, level);
            break;
          case T.PILLAR:
            this.pillar(ctx, x, y);
            this.floor(ctx, x, y, wc, wr, level);
            break;
          case T.RUBBLE:
            this.floor(ctx, x, y, wc, wr, level);
            this.rubble(ctx, x, y, wc, wr);
            break;
          case T.EXIT:
            if (tl.half === 0) this.exitFrame(ctx, x, y);
            this.floor(ctx, x, y, wc, wr, level);
            break;
        }
      }
    }
    return this.cache;
  }

  backWall(ctx, x, y, c, r) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(x, y, TILE_W, TILE_H);
    for (let i = 0; i < 7; i++) {
      const by = y + i * 9;
      const off = (i + r * 7) & 1 ? 8 : 0;
      for (let j = -1; j < 2; j++) {
        const bx = x + off + j * 16;
        const h = hash(c * 4 + j, r * 8 + i);
        if (h % 9 === 0) {
          ctx.fillStyle = PAL.bgHi;
          ctx.fillRect(Math.max(x, bx + 1), by, Math.min(15, x + TILE_W - bx - 1), 8);
        } else if (h % 11 === 0) {
          ctx.fillStyle = PAL.bgLo;
          ctx.fillRect(Math.max(x, bx + 1), by, Math.min(15, x + TILE_W - bx - 1), 8);
        }
      }
      ctx.fillStyle = PAL.bgMortar;
      ctx.fillRect(x, by + 8, TILE_W, 1);
      ctx.fillRect(x + off, by, 1, 8);
      ctx.fillRect(x + off + 16, by, 1, 8);
    }
  }

  wallBlock(ctx, x, y, c, r, level) {
    ctx.fillStyle = PAL.block;
    ctx.fillRect(x, y, TILE_W, TILE_H);
    for (let i = 0; i < 3; i++) {
      const by = y + i * 21;
      const split = (i + r + c) & 1;
      const segs = split ? [[0, 16], [16, 32]] : [[0, 32]];
      for (const [a, b] of segs) {
        const w = b - a;
        ctx.fillStyle = PAL.blockHi;
        ctx.fillRect(x + a, by, w, 1);
        ctx.fillRect(x + a, by, 1, 20);
        ctx.fillStyle = PAL.blockLo;
        ctx.fillRect(x + a, by + 20, w, 1);
        ctx.fillRect(x + b - 1, by + 1, 1, 20);
        if (hash(c, r, i + a) % 4 === 0) {
          ctx.fillRect(x + a + 4 + (hash(c, i) % (w - 8)), by + 6, 2, 1);
        }
      }
    }
    // A lit top edge where the block meets open space above.
    if (level.tile(c, r - 1).t === T.EMPTY) {
      ctx.fillStyle = PAL.floorTop;
      ctx.fillRect(x, y, TILE_W, 2);
    }
  }

  floor(ctx, x, y, c, r, level, dy = 0) {
    const Y = y + 55 + dy;
    ctx.fillStyle = PAL.floorTop;
    ctx.fillRect(x, Y, TILE_W, 3);
    ctx.fillStyle = PAL.floorFront;
    ctx.fillRect(x, Y + 3, TILE_W, 5);
    ctx.fillStyle = PAL.floorLine;
    ctx.fillRect(x, Y + 3, TILE_W, 1);
    ctx.fillRect(x, Y + 7, TILE_W, 1);
    ctx.fillRect(x + TILE_W - 1, Y + 3, 1, 5);
    if (level.tile(c - 1, r).t === T.EMPTY) ctx.fillRect(x, Y, 1, 8);
    if (level.tile(c + 1, r).t === T.EMPTY) ctx.fillRect(x + TILE_W - 1, Y, 1, 8);
  }

  pillar(ctx, x, y) {
    ctx.fillStyle = PAL.pillar;
    ctx.fillRect(x + 10, y + 6, 12, 49);
    ctx.fillStyle = PAL.pillarHi;
    ctx.fillRect(x + 11, y + 6, 2, 49);
    ctx.fillRect(x + 8, y + 1, 16, 4);
    ctx.fillRect(x + 8, y + 50, 16, 5);
    ctx.fillStyle = PAL.pillarLo;
    ctx.fillRect(x + 19, y + 6, 3, 44);
    ctx.fillRect(x + 8, y + 5, 16, 1);
    ctx.fillRect(x + 8, y + 50, 16, 1);
  }

  sconce(ctx, x, y) {
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(x + 15, y + 22, 2, 7);
    ctx.fillRect(x + 13, y + 20, 6, 2);
    ctx.fillRect(x + 14, y + 29, 4, 1);
  }

  flame(ctx, x, y, seed) {
    const h = hash(seed, this.frame);
    const tall = 5 + (h % 4);
    const lean = (h >> 3) % 3 - 1;
    const cx = x + 16;
    const base = y + 19;
    for (let i = 0; i < tall; i++) {
      const w = Math.max(1, Math.round(((tall - i) / tall) * 5));
      const sx = cx - (w >> 1) + (i > tall / 2 ? lean : 0);
      ctx.fillStyle = PAL.flame[0];
      ctx.fillRect(sx, base - i, w, 1);
      if (w > 2) {
        ctx.fillStyle = PAL.flame[1];
        ctx.fillRect(sx + 1, base - i, w - 2, 1);
      }
      if (w > 3 && i < tall / 2) {
        ctx.fillStyle = PAL.flame[2];
        ctx.fillRect(sx + 2, base - i, w - 4 || 1, 1);
      }
    }
  }

  rubble(ctx, x, y, c, r) {
    ctx.fillStyle = PAL.floorFront;
    for (let i = 0; i < 6; i++) {
      const h = hash(c, r, i);
      ctx.fillRect(x + 3 + (h % 26), y + 52 + ((h >> 5) % 3), 2 + ((h >> 8) % 3), 1 + ((h >> 11) % 2));
    }
  }

  exitFrame(ctx, x, y) {
    ctx.fillStyle = PAL.block;
    ctx.fillRect(x + 6, y + 3, 52, 52);
    ctx.fillStyle = PAL.blockHi;
    ctx.fillRect(x + 4, y + 1, 56, 3);
    ctx.fillRect(x + 6, y + 4, 1, 51);
    ctx.fillStyle = PAL.blockLo;
    ctx.fillRect(x + 57, y + 4, 1, 51);
    ctx.fillRect(x + 11, y + 9, 42, 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 12, y + 10, 40, 45);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = PAL.stair[i & 1];
      ctx.fillRect(x + 12 + i * 3, y + 49 - i * 8, 40 - i * 6, 6);
    }
  }

  // ---- dynamic tile layer --------------------------------------------------

  dynamicTiles(ctx, level, rx, ry) {
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const wc = rx * ROOM_COLS + c;
        const wr = ry * ROOM_ROWS + r;
        const x = c * TILE_W;
        const y = r * TILE_H;
        const tl = level.tile(wc, wr);
        switch (tl.t) {
          case T.TORCH:
            this.flame(ctx, x, y, wc * 31 + wr);
            break;
          case T.SPIKES:
            this.spikes(ctx, x, y, tl.ext);
            break;
          case T.LOOSE: {
            const shaking = tl.fallIn > 0 || tl.wobble > 0;
            this.floor(ctx, x, y, wc, wr, level, shaking ? (this.frame & 1 ? -1 : 1) : 0);
            ctx.fillStyle = PAL.floorLine;
            ctx.fillRect(x + 9, y + 56 + (shaking ? 1 : 0), 1, 2);
            ctx.fillRect(x + 22, y + 57, 1, 1);
            break;
          }
          case T.PLATE:
            this.floor(ctx, x, y, wc, wr, level, tl.pressed ? 1 : 0);
            ctx.fillStyle = tl.pressed ? PAL.floorLine : PAL.floorTop;
            if (!tl.pressed) ctx.fillRect(x + 6, y + 53, 20, 2);
            ctx.fillStyle = PAL.floorLine;
            ctx.fillRect(x + 6, y + (tl.pressed ? 56 : 55), 20, 1);
            break;
          case T.POTION:
            this.potion(ctx, x, y, tl.kind, wc);
            break;
          case T.SWORD:
            ctx.fillStyle = PAL.steel;
            ctx.fillRect(x + 10, y + 53, 16, 1);
            ctx.fillStyle = PAL.gold;
            ctx.fillRect(x + 8, y + 52, 1, 3);
            ctx.fillRect(x + 5, y + 53, 3, 1);
            if (this.frame % 24 < 2) {
              ctx.fillStyle = '#fff';
              ctx.fillRect(x + 12 + (this.frame % 24) * 6, y + 52, 1, 1);
            }
            break;
          case T.EXIT:
            if (tl.half === 0) this.exitDoor(ctx, x, y, level.exitOpen);
            break;
        }
      }
    }
    for (const f of level.falling) {
      const x = (f.c - rx * ROOM_COLS) * TILE_W;
      const y = f.y - 55 - ry * ROOM_H;
      if (x >= 0 && x < ROOM_W) this.floor(ctx, x, y, -9, -9, level);
    }
  }

  spikes(ctx, x, y, ext) {
    const h = [0, 3, 6, 9, 11, 12][ext];
    const Y = y + 55;
    for (const sx of [4, 9, 15, 20, 26]) {
      ctx.fillStyle = PAL.spike;
      ctx.fillRect(x + sx, Y - 1, 1, 1);
      if (h) {
        ctx.fillRect(x + sx, Y - h, 1, h);
        ctx.fillRect(x + sx + 1, Y - h + 3, 1, h - 3);
        ctx.fillStyle = PAL.spikeTip;
        ctx.fillRect(x + sx, Y - h, 1, 1);
      }
    }
  }

  potion(ctx, x, y, kind, seed) {
    const big = kind === 'life';
    const cx = x + 16;
    const by = y + 55;
    const w = big ? 7 : 5;
    const h = big ? 7 : 5;
    ctx.fillStyle = PAL.glass;
    ctx.fillRect(cx - (w >> 1) - 1, by - h - 1, w + 2, h + 1);
    ctx.fillRect(cx - 1, by - h - 5, 3, 4);
    ctx.fillStyle = big ? PAL.green : PAL.red;
    ctx.fillRect(cx - (w >> 1), by - h, w, h);
    ctx.fillStyle = PAL.cork;
    ctx.fillRect(cx - 1, by - h - 6, 3, 1);
    const b = (this.frame + seed * 3) % 10;
    if (b < 6) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx + ((seed + this.frame) % 2), by - h - 7 - b, 1, 1);
    }
  }

  exitDoor(ctx, x, y, open) {
    const h = Math.round((1 - open) * 45);
    if (h <= 0) return;
    ctx.fillStyle = PAL.door;
    ctx.fillRect(x + 12, y + 10, 40, h);
    ctx.fillStyle = PAL.doorLine;
    for (let yy = y + 13; yy < y + 10 + h; yy += 4) ctx.fillRect(x + 12, yy, 40, 1);
    ctx.fillStyle = PAL.blockHi;
    ctx.fillRect(x + 12, y + 9 + h, 40, 1);
  }

  gates(ctx, level, rx, ry) {
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const tl = level.tile(rx * ROOM_COLS + c, ry * ROOM_ROWS + r);
        if (tl.t !== T.GATE) continue;
        const x = c * TILE_W;
        const y = r * TILE_H;
        const h = Math.round((1 - tl.open) * 50);
        ctx.fillStyle = PAL.gate;
        ctx.fillRect(x + 21, y, 11, 4);
        if (h <= 0) continue;
        for (const bx of [22, 25, 28, 31]) {
          ctx.fillStyle = PAL.gate;
          ctx.fillRect(x + bx, y + 4, 1, h);
          ctx.fillStyle = PAL.gateHi;
          ctx.fillRect(x + bx - 1, y + 4, 1, h);
        }
        ctx.fillStyle = PAL.gateHi;
        for (let yy = y + 10; yy < y + 4 + h; yy += 7) ctx.fillRect(x + 21, yy, 11, 1);
        ctx.fillRect(x + 21, y + 3 + h, 11, 1);
      }
    }
  }

  // ---- characters ----------------------------------------------------------

  figure(ctx, J, look, armed, ox, oy) {
    const d = J.dir;
    const P = (p) => [p[0] - ox, p[1] - oy];
    const seg = (a, b, w) => {
      const [ax, ay] = P(a);
      const [bx, by] = P(b);
      line(ctx, ax, ay, bx, by, w);
    };
    const foot = (f) => {
      const [fx, fy] = P(f);
      ctx.fillRect(Math.round(fx) - (d < 0 ? 2 : 0), Math.round(fy), 3, 1);
    };
    const hand = (w) => {
      const [wx, wy] = P(w);
      ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
    };

    // far limbs
    ctx.fillStyle = look.dark;
    seg(J.hip, J.k2, 4);
    seg(J.k2, J.f2, 3);
    seg(J.sh, J.e2, 2);
    seg(J.e2, J.w2, 2);
    ctx.fillStyle = look.skin;
    foot(J.f2);
    hand(J.w2);

    // body
    ctx.fillStyle = look.cloth;
    seg(J.hip, J.sh, 6);
    if (look.belt) {
      ctx.fillStyle = look.belt;
      const [hx, hy] = P(J.hip);
      ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 5, 1);
    }
    ctx.fillStyle = look.skin;
    seg(J.sh, J.neck, 2);

    // near leg
    ctx.fillStyle = look.cloth;
    seg(J.hip, J.k1, 4);
    seg(J.k1, J.f1, 3);
    ctx.fillStyle = look.skin;
    foot(J.f1);

    // head
    const [hx, hy] = P(J.head);
    const X = Math.round(hx);
    const Y = Math.round(hy);
    ctx.fillStyle = look.skin;
    ctx.fillRect(X - 2, Y - 3, 5, 7);
    ctx.fillRect(d > 0 ? X + 3 : X - 3, Y, 1, 2);
    ctx.fillStyle = look.hair;
    ctx.fillRect(X - 2, Y - 4, 5, 2);
    ctx.fillRect(d > 0 ? X - 3 : X + 3, Y - 3, 1, 5);
    if (look.turban) {
      ctx.fillStyle = look.turban;
      ctx.fillRect(X - 3, Y - 6, 7, 3);
      ctx.fillStyle = PAL.red;
      ctx.fillRect(X, Y - 7, 1, 1);
    }

    // near arm and sword
    ctx.fillStyle = look.cloth;
    seg(J.sh, J.e1, 2);
    seg(J.e1, J.w1, 2);
    if (armed && J.sword != null) {
      const [wx, wy] = P(J.w1);
      const vx = Math.cos(J.sword) * d;
      const vy = Math.sin(J.sword);
      ctx.fillStyle = PAL.steel;
      line(ctx, wx + vx * 2, wy + vy * 2, wx + vx * 16, wy + vy * 16, 1);
      ctx.fillStyle = PAL.gold;
      line(ctx, wx - vy * 2, wy + vx * 2, wx + vy * 2, wy - vx * 2, 1);
    }
    ctx.fillStyle = look.skin;
    hand(J.w1);
  }

  // ---- screens -------------------------------------------------------------

  drawRoom(game, rx, ry, withChars = true) {
    const ctx = this.ctx;
    const level = game.level;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ROOM_W, ROOM_H);
    ctx.clip();
    ctx.drawImage(this.staticRoom(level, rx, ry), 0, 0);
    this.dynamicTiles(ctx, level, rx, ry);
    if (withChars) {
      const ox = rx * ROOM_W;
      const oy = ry * ROOM_H;
      const visible = (x, y) => x > ox - 30 && x < ox + ROOM_W + 30 && y > oy - 10 && y < oy + ROOM_H + 60;
      for (const g of game.guards) {
        if (visible(g.x, g.y)) this.figure(ctx, guardJoints(g), GUARD_LOOK, g.alive, ox, oy);
      }
      const p = game.prince;
      if (visible(p.x, p.y) && !(p.state === 'exit' && p.t > 12)) {
        this.figure(ctx, princeJoints(p), PRINCE_LOOK, p.armed, ox, oy);
      }
    }
    this.gates(ctx, level, rx, ry);
    if (game.flash > 0) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = game.flashColor;
      ctx.fillRect(0, 0, ROOM_W, ROOM_H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  statusBar(game, touch) {
    const ctx = this.ctx;
    const y = ROOM_H;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y, SCREEN_W, SCREEN_H - y);
    const p = game.prince;
    for (let i = 0; i < p.maxHp; i++) this.triangle(2 + i * 8, y + 2, i < p.hp, PAL.hp, PAL.hpEmpty);

    const { rx, ry } = game.room();
    const g = game.guards.find(
      (g) => g.alive && g.state !== 'guard' && Math.floor(g.x / ROOM_W) === rx && Math.floor((g.y - 1) / ROOM_H) === ry,
    );
    if (g) {
      for (let i = 0; i < g.maxHp; i++) this.triangle(SCREEN_W - 9 - i * 8, y + 2, i < g.hp, PAL.guardHp, '#182a6c');
    }

    let text = game.msg?.text;
    if (!p.alive && game.deadTicks > 20) {
      text = this.frame % 20 < 14 ? (touch ? 'PRESS ACTION TO CONTINUE' : 'PRESS SHIFT TO CONTINUE') : '';
    }
    if (text) drawText(ctx, text, SCREEN_W / 2, y + 2, PAL.text, 1, 'center');
  }

  triangle(x, y, full, color, empty) {
    const ctx = this.ctx;
    ctx.fillStyle = full ? color : empty;
    for (let j = 0; j < 7; j++) {
      const half = j >> 1;
      if (full || j === 6) ctx.fillRect(x + 3 - half, y + j, 1 + half * 2, 1);
      else {
        ctx.fillRect(x + 3 - half, y + j, 1, 1);
        ctx.fillRect(x + 3 + half, y + j, 1, 1);
      }
    }
  }

  play(game, touch) {
    const { rx, ry } = game.room();
    this.drawRoom(game, rx, ry);
    this.statusBar(game, touch);
  }

  dim(alpha) {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.ctx.globalAlpha = 1;
  }

  title(game, touch) {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.drawRoom(game, 0, 0, false);
    this.dim(0.7);
    drawText(ctx, 'PRINCE OF PERSIA', SCREEN_W / 2 + 2, 42, '#6c1818', 2, 'center');
    drawText(ctx, 'PRINCE OF PERSIA', SCREEN_W / 2, 40, PAL.gold, 2, 'center');
    drawText(ctx, 'A TRIBUTE TO THE 1989 CLASSIC', SCREEN_W / 2, 64, PAL.text, 1, 'center');
    drawText(ctx, 'ORIGINAL GAME BY JORDAN MECHNER', SCREEN_W / 2, 76, '#a4a4c0', 1, 'center');

    const help = touch
      ? ['PAD: RUN, CROUCH, CLIMB', 'JUMP: JUMP UP OR AHEAD, PARRY', 'ACTION: CAREFUL STEP, DRINK,', 'TAKE THE SWORD, STRIKE']
      : ['ARROWS: RUN, JUMP, CROUCH, CLIMB', 'UP+ARROW: JUMP AHEAD   UP: PARRY', 'SHIFT+ARROW: CAREFUL STEP', 'SHIFT: DRINK, TAKE SWORD, STRIKE'];
    help.forEach((l, i) => drawText(ctx, l, SCREEN_W / 2, 104 + i * 11, '#a4a4c0', 1, 'center'));
    if (this.frame % 20 < 14) {
      drawText(ctx, touch ? 'TAP TO BEGIN' : 'PRESS ENTER TO BEGIN', SCREEN_W / 2, 164, PAL.text, 1, 'center');
    }
  }

  endScreen(game, touch) {
    const ctx = this.ctx;
    this.play(game, touch);
    this.dim(0.65);
    const won = game.mode === 'won';
    drawText(ctx, won ? 'YOU ESCAPED THE DUNGEON' : 'TIME HAS EXPIRED', SCREEN_W / 2, 60, won ? PAL.gold : PAL.red, 1, 'center');
    if (won) {
      const m = game.minutesLeft();
      drawText(ctx, `${m} MINUTE${m === 1 ? '' : 'S'} LEFT`, SCREEN_W / 2, 80, PAL.text, 1, 'center');
      drawText(ctx, 'THE PRINCESS AWAITS...', SCREEN_W / 2, 96, '#a4a4c0', 1, 'center');
    }
    if (this.frame % 20 < 14) {
      drawText(ctx, touch ? 'TAP TO PLAY AGAIN' : 'PRESS ENTER TO PLAY AGAIN', SCREEN_W / 2, 130, PAL.text, 1, 'center');
    }
  }

  paused(game, touch) {
    this.play(game, touch);
    this.dim(0.5);
    drawText(this.ctx, 'PAUSED', SCREEN_W / 2, 80, PAL.text, 2, 'center');
    drawText(this.ctx, touch ? 'TAP TO CONTINUE' : 'PRESS P TO CONTINUE', SCREEN_W / 2, 110, '#a4a4c0', 1, 'center');
  }

  render(game, { touch, paused }) {
    this.frame++;
    if (game.mode === 'title') this.title(game, touch);
    else if (paused) this.paused(game, touch);
    else if (game.mode === 'play') this.play(game, touch);
    else this.endScreen(game, touch);
  }
}
