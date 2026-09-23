import { SCREEN_W, SCREEN_H, TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS, ROOM_W, ROOM_H } from './constants.js';
import { T } from './level.js';
import { princeJoints, guardJoints } from './figure.js';
import { drawText } from './font.js';
import { SpriteRasterizer } from './sprite.js';

// A small VGA-style palette for the blue dungeon.
const PAL = {
  bg: '#2e3660',
  bgLight: '#363e6c',
  bgDark: '#282f56',
  bgHi: '#404a7e',
  bgLo: '#1e2448',
  bgMortar: '#10142c',
  block: '#6c78ac',
  blockHi: '#a4ace0',
  blockLo: '#3c4478',
  blockMark: '#56629a',
  floorTop: '#c0c6ec',
  floorMid: '#9098cc',
  floorFront: '#5c6498',
  floorLine: '#14183a',
  pillar: '#7884bc',
  pillarHi: '#a8b0e0',
  pillarShine: '#d4d8f4',
  pillarLo: '#444e88',
  metal: '#4c3c2c',
  metalHi: '#8c7050',
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

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.cache = document.createElement('canvas');
    this.cache.width = ROOM_W;
    this.cache.height = ROOM_H;
    this.cacheKey = '';
    this.frame = 0;
    this.sprites = new SpriteRasterizer();
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

  // Background stonework: four courses of bricks of uneven width, each brick
  // bevelled light on top/left and dark on bottom/right, like the DOS dungeon.
  backWall(ctx, x, y, c, r) {
    ctx.fillStyle = PAL.bgMortar;
    ctx.fillRect(x, y, TILE_W, TILE_H);
    let yy = y;
    for (let i = 0; i < 4; i++) {
      const h = i === 3 ? 15 : 16;
      let bx = -(hash(c, r, i) % 14);
      let j = 0;
      while (bx < TILE_W) {
        const w = 11 + (hash(c + 17, r * 4 + i, j) % 9);
        const a = Math.max(0, bx + 1);
        const b = Math.min(TILE_W, bx + w);
        if (b > a) this.brick(ctx, x + a, yy + 1, b - a, h - 1, hash(c * 5 + j, r * 4 + i, 7), bx + 1 >= 0, bx + w <= TILE_W);
        bx += w;
        j++;
      }
      yy += h;
    }
  }

  brick(ctx, x, y, w, h, seed, leftEdge, rightEdge) {
    const tone = seed % 7;
    ctx.fillStyle = tone === 0 ? PAL.bgLight : tone === 1 ? PAL.bgDark : PAL.bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.bgHi;
    ctx.fillRect(x, y, w, 1);
    if (leftEdge) ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = PAL.bgLo;
    ctx.fillRect(x, y + h - 1, w, 1);
    if (rightEdge) ctx.fillRect(x + w - 1, y + 1, 1, h - 1);
    if (seed % 3 === 0 && w > 6) ctx.fillRect(x + 2 + ((seed >> 4) % (w - 5)), y + 3 + ((seed >> 8) % (h - 6)), 2, 1);
  }

  // Solid masonry: large bevelled stones with weathering marks.
  wallBlock(ctx, x, y, c, r, level) {
    ctx.fillStyle = PAL.floorLine;
    ctx.fillRect(x, y, TILE_W, TILE_H);
    for (let i = 0; i < 3; i++) {
      const by = y + i * 21;
      const segs = (i + r + c) & 1 ? [[0, 16], [16, 32]] : [[0, 32]];
      for (const [a, b] of segs) {
        const sx = x + a;
        const w = b - a - 1;
        ctx.fillStyle = PAL.block;
        ctx.fillRect(sx, by, w, 20);
        ctx.fillStyle = PAL.blockHi;
        ctx.fillRect(sx, by, w, 1);
        ctx.fillRect(sx, by, 1, 20);
        ctx.fillStyle = PAL.blockLo;
        ctx.fillRect(sx, by + 18, w, 2);
        ctx.fillRect(sx + w - 2, by + 1, 2, 19);
        ctx.fillStyle = PAL.blockMark;
        for (let k = 0; k < 3; k++) {
          const h = hash(c * 3 + k, r * 3 + i, a);
          if (h % 2) ctx.fillRect(sx + 2 + (h % (w - 6)), by + 3 + ((h >> 6) % 13), 1 + ((h >> 10) % 3), 1);
        }
      }
    }
    if (level.tile(c, r - 1).t === T.EMPTY) {
      ctx.fillStyle = PAL.floorTop;
      ctx.fillRect(x, y, TILE_W, 2);
      ctx.fillStyle = PAL.floorMid;
      ctx.fillRect(x, y + 2, TILE_W, 1);
    }
  }

  // A floor slab: a lit top surface, a darker front face and a hard shadow line.
  floor(ctx, x, y, c, r, level, dy = 0) {
    const Y = y + 54 + dy;
    ctx.fillStyle = PAL.floorTop;
    ctx.fillRect(x, Y, TILE_W, 2);
    ctx.fillStyle = PAL.floorMid;
    ctx.fillRect(x, Y + 2, TILE_W, 2);
    ctx.fillStyle = PAL.floorFront;
    ctx.fillRect(x, Y + 4, TILE_W, 4);
    ctx.fillStyle = PAL.floorLine;
    ctx.fillRect(x, Y + 8, TILE_W, 1);
    ctx.fillRect(x + TILE_W - 1, Y + 4, 1, 4);
    ctx.fillStyle = PAL.floorMid;
    for (let k = 0; k < 3; k++) {
      const h = hash(c, r, k + 40);
      ctx.fillRect(x + (h % 30), Y + (h >> 5) % 2, 2, 1);
    }
    if (level.tile(c - 1, r).t === T.EMPTY) {
      ctx.fillStyle = PAL.floorLine;
      ctx.fillRect(x, Y + 1, 1, 8);
    }
    if (level.tile(c + 1, r).t === T.EMPTY) {
      ctx.fillStyle = PAL.floorFront;
      ctx.fillRect(x + TILE_W - 3, Y + 1, 3, 7);
      ctx.fillStyle = PAL.floorLine;
      ctx.fillRect(x + TILE_W - 1, Y, 1, 9);
    }
  }

  // A round column, lit from the left, with a capital and a base.
  pillar(ctx, x, y) {
    const px = x + 10;
    ctx.fillStyle = PAL.pillar;
    ctx.fillRect(px, y + 7, 12, 43);
    ctx.fillStyle = PAL.pillarHi;
    ctx.fillRect(px + 2, y + 7, 3, 43);
    ctx.fillStyle = PAL.pillarShine;
    ctx.fillRect(px + 3, y + 7, 1, 43);
    ctx.fillStyle = PAL.pillarLo;
    ctx.fillRect(px + 9, y + 7, 3, 43);
    ctx.fillRect(px, y + 7, 1, 43);
    for (const [cy, rows] of [[y + 1, [PAL.pillarHi, PAL.pillarShine, PAL.pillar, PAL.pillar, PAL.pillarLo, PAL.floorLine]], [y + 48, [PAL.floorLine, PAL.pillarHi, PAL.pillar, PAL.pillar, PAL.pillarLo, PAL.pillarLo]]]) {
      rows.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(x + 7, cy + i, 18, 1);
      });
    }
  }

  sconce(ctx, x, y) {
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(x + 13, y + 21, 6, 3);
    ctx.fillRect(x + 15, y + 24, 2, 8);
    ctx.fillRect(x + 13, y + 31, 6, 2);
    ctx.fillStyle = PAL.metalHi;
    ctx.fillRect(x + 13, y + 21, 6, 1);
    ctx.fillRect(x + 15, y + 24, 1, 8);
  }

  flame(ctx, x, y, seed) {
    const h = hash(seed, this.frame);
    const tall = 10 + (h % 5);
    const lean = ((h >> 3) % 5) - 2;
    const cx = x + 16;
    const base = y + 20;
    for (let i = 0; i < tall; i++) {
      const k = i / tall;
      const w = Math.max(1, Math.round(7 * Math.pow(1 - k, 0.75) * (i < 2 ? 0.8 : 1)));
      const sx = Math.round(cx - w / 2 + lean * k * k);
      ctx.fillStyle = PAL.flame[0];
      ctx.fillRect(sx, base - i, w, 1);
      if (w > 2) {
        ctx.fillStyle = PAL.flame[1];
        ctx.fillRect(sx + 1, base - i, w - 2, 1);
      }
      if (w > 4 && k < 0.55) {
        ctx.fillStyle = PAL.flame[2];
        ctx.fillRect(sx + 2, base - i, w - 4, 1);
      }
    }
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(cx - 1, base - 2, 2, 2);
    if (h % 4 === 0) {
      ctx.fillStyle = PAL.flame[2];
      ctx.fillRect(cx + lean + ((h >> 7) % 3) - 1, base - tall - 2 - ((h >> 9) % 3), 1, 1);
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
            ctx.fillStyle = PAL.floorLine;
            ctx.fillRect(x + 4, y + 51, 23, 3);
            ctx.fillStyle = PAL.steel;
            ctx.fillRect(x + 10, y + 52, 16, 1);
            ctx.fillStyle = PAL.gold;
            ctx.fillRect(x + 8, y + 51, 1, 3);
            ctx.fillRect(x + 5, y + 52, 3, 1);
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
        if (visible(g.x, g.y)) this.sprites.draw(ctx, guardJoints(g), 'guard', g.alive, ox, oy);
      }
      const p = game.prince;
      if (visible(p.x, p.y) && !(p.state === 'exit' && p.t > 12)) {
        this.sprites.draw(ctx, princeJoints(p), 'prince', p.armed, ox, oy);
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
