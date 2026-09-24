import { SCREEN_W, SCREEN_H, TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS, ROOM_W, ROOM_H } from './constants.js';
import { T } from './level.js';
import { princeJoints, guardJoints } from './figure.js';
import { drawCharacter, drawShadow } from './character.js';

// The game world is laid out on the original's 320x200 grid, but drawn with
// smooth shapes at the display's full resolution. The grid is stretched to
// 4:3 exactly as a 1989 monitor stretched it.
//
// Depth follows the original's oblique view from slightly above: every floor
// is a slab whose top surface recedes towards the back wall (its back edge
// shifted SKEW units right), so floor ends and stone blocks show a side face.
const SLAB_TOP = 46;
const FRONT = 56; // front edge of the floor surface; feet stand at 55
const SKEW = 7;
const FONT = "'Cinzel', 'Trajan Pro', Georgia, 'Times New Roman', serif";

const C = {
  void: '#000000',
  mark: '#22305a',
  mortar: '#1e2844',
  stone: ['#7280a0', '#6b7999', '#7a88a8'],
  stoneHi: '#a4b1cc',
  stoneLo: '#2f3b5a',
  stoneSpeck: '#4b597b',
  top: '#5d6b8c',
  topBack: '#3e4a68',
  topEdge: '#8c9aba',
  side: '#26305a',
  sideDark: '#0e1428',
  flame: ['#fff6c0', '#ffc040', '#ff6a1a', 'rgba(200,30,0,0)'],
  gold: '#f0c850',
  text: '#f2ead2',
  dimText: '#aab0d4',
  hp: '#ff3a2a',
  guardHp: '#5c86ff',
};

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function poly(ctx, ...pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frame = 0;
    this.resize();
  }

  // Call after the canvas changes size.
  resize() {
    this.sx = this.canvas.width / SCREEN_W;
    this.sy = this.canvas.height / SCREEN_H;
    this.layers = {};
    // Checkerboard used on the dark side faces, sized to about one original pixel.
    const cell = Math.max(1, Math.round(this.sx * 0.9));
    const d = document.createElement('canvas');
    d.width = d.height = cell * 2;
    const dc = d.getContext('2d');
    dc.fillStyle = C.sideDark;
    dc.fillRect(0, 0, cell, cell);
    dc.fillRect(cell, cell, cell, cell);
    this.ditherCanvas = d;
  }

  logical(ctx) {
    ctx.setTransform(this.sx, 0, 0, this.sy, 0, 0);
  }

  // A cached, transparent full-room layer, redrawn only when its key changes.
  layer(name, key, draw) {
    const w = this.canvas.width;
    const h = Math.ceil(ROOM_H * this.sy);
    let L = this.layers[name];
    if (!L) {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      L = this.layers[name] = { canvas: cv, key: null };
    }
    if (L.key !== key) {
      L.key = key;
      const c = L.canvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      this.logical(c);
      draw(c);
    }
    return L.canvas;
  }

  eachTile(rx, ry, fn) {
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) fn(rx * ROOM_COLS + c, ry * ROOM_ROWS + r, c * TILE_W, r * TILE_H);
    }
  }

  // ---- static background ---------------------------------------------------

  drawBackground(ctx, level, rx, ry) {
    this.eachTile(rx, ry, (c, r, x, y) => {
      if (level.isWall(c, r)) this.wallFace(ctx, x, y, c, r);
      else this.backWall(ctx, x, y, c, r);
    });
    this.eachTile(rx, ry, (c, r, x, y) => {
      const tl = level.tile(c, r);
      switch (tl.t) {
        case T.WALL:
          this.wallDepth(ctx, x, y, c, r, level);
          break;
        case T.TORCH:
          this.sconce(ctx, x, y);
          this.floor(ctx, x, y, c, r, level);
          break;
        case T.EXIT:
          if (tl.half === 0) this.exitFrame(ctx, x, y);
          this.floor(ctx, x, y, c, r, level);
          break;
        case T.RUBBLE:
          this.floor(ctx, x, y, c, r, level);
          this.rubble(ctx, x, y, c, r);
          break;
        case T.FLOOR:
        case T.PILLAR:
        case T.POTION:
        case T.SWORD:
        case T.SPIKES:
        case T.GATE:
          this.floor(ctx, x, y, c, r, level);
          break;
      }
    });
  }

  // Open space behind the platforms is dark, with only a faint dotted outline
  // of masonry here and there, as in the original.
  backWall(ctx, x, y, c, r) {
    ctx.fillStyle = C.void;
    ctx.fillRect(x, y, TILE_W, TILE_H);
    const h = hash(c, r, 5);
    if (h % 7 !== 0) return;
    const bx = x + 5 + (h % 10);
    const by = y + 8 + ((h >>> 4) % 18);
    ctx.strokeStyle = C.mark;
    ctx.lineWidth = 0.6;
    ctx.setLineDash([0.9, 1.1]);
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of [
      [0, 0, 16, 0], [-4, 5, 20, 5], [2, 10, 14, 10],
      [8, -3, 8, 5], [2, 5, 2, 10], [13, 5, 13, 13],
    ]) {
      ctx.moveTo(bx + x0, by + y0);
      ctx.lineTo(bx + x1, by + y1);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // One dressed stone: flat slate face, lit top-left edge, dark bottom-right
  // edge and a few chisel marks.
  stoneFace(ctx, x, y, w, h, seed) {
    ctx.fillStyle = C.stone[seed % C.stone.length];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.stoneHi;
    ctx.fillRect(x, y, w, 0.9);
    ctx.fillRect(x, y, 0.9, h);
    ctx.fillStyle = C.stoneLo;
    ctx.fillRect(x, y + h - 1.1, w, 1.1);
    ctx.fillRect(x + w - 1.1, y, 1.1, h);
    ctx.fillStyle = C.stoneSpeck;
    for (let k = 0; k < 3; k++) {
      const s = hash(seed, k, 3);
      if (s % 3 === 0 || w < 6 || h < 5) continue;
      const px = x + 2 + (s % Math.max(1, w - 5));
      const py = y + 2 + ((s >>> 6) % Math.max(1, h - 4));
      ctx.fillRect(px, py, 1.2, 0.7);
      ctx.fillRect(px + 1.2, py + 0.7, 0.7, 0.7);
    }
  }

  // A course of stones of uneven width. Joints are laid out along the whole
  // row of the world, so stones run on across tile boundaries; each tile draws
  // the part of the row inside it.
  course(ctx, x, y, h, c, row, width = TILE_W) {
    const x0 = c * TILE_W;
    let bx = -(hash(0, row, 1) % 20);
    let j = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, h);
    ctx.clip();
    while (bx < x0 + width) {
      const w = 14 + (hash(j, row, 7) % 9);
      if (bx + w > x0) this.stoneFace(ctx, x + bx - x0 + 0.4, y + 0.4, w - 0.8, h - 0.8, hash(j, row, 9));
      bx += w;
      j++;
    }
    ctx.restore();
  }

  // Solid masonry: three courses of large stones.
  wallFace(ctx, x, y, c, r) {
    ctx.fillStyle = C.mortar;
    ctx.fillRect(x, y, TILE_W, TILE_H);
    for (let i = 0; i < 3; i++) this.course(ctx, x, y + i * 21, 21, c, 1000 + r * 3 + i);
  }

  // Top surface of a slab (floor or stone block): a flat slate band whose
  // back edge is shifted right, so the left end of a platform slants back.
  topSurface(ctx, x, top, front) {
    poly(ctx, [x, front], [x + TILE_W, front], [x + TILE_W + SKEW, top], [x + SKEW, top]);
    ctx.fillStyle = C.top;
    ctx.fill();
    poly(ctx, [x + SKEW, top], [x + TILE_W + SKEW, top], [x + TILE_W + SKEW - 0.4, top + 1], [x + SKEW - 0.4, top + 1]);
    ctx.fillStyle = C.topBack;
    ctx.fill();
  }

  // The dark, dithered side of a block or slab, seen where it ends.
  sideFace(ctx, x, top, front, bottom) {
    poly(ctx, [x, front], [x + SKEW, top], [x + SKEW, bottom - (front - top)], [x, bottom]);
    ctx.fillStyle = C.side;
    ctx.fill();
    ctx.fillStyle = this.dither(ctx);
    ctx.fill();
  }

  dither(ctx) {
    const p = ctx.createPattern(this.ditherCanvas, 'repeat');
    try {
      p.setTransform(new DOMMatrix([1 / this.sx, 0, 0, 1 / this.sy, 0, 0]));
    } catch {
      // Without pattern transforms the checker is just finer.
    }
    return p;
  }

  // Stone block: top surface where open above, side face where open to the right.
  wallDepth(ctx, x, y, c, r, level) {
    const depth = FRONT - SLAB_TOP;
    if (!level.hasFloor(c, r - 1)) {
      this.topSurface(ctx, x, y - depth, y);
      ctx.fillStyle = C.topEdge;
      ctx.fillRect(x, y - 0.5, TILE_W, 0.8);
    }
    if (!level.isWall(c + 1, r)) {
      this.sideFace(ctx, x + TILE_W, y - depth, y, y + TILE_H);
      ctx.strokeStyle = C.void;
      ctx.lineWidth = 0.6;
      for (const k of [21, 42]) {
        ctx.beginPath();
        ctx.moveTo(x + TILE_W, y + k);
        ctx.lineTo(x + TILE_W + SKEW, y + k - depth);
        ctx.stroke();
      }
    }
  }

  floor(ctx, x, y, c, r, level, dy = 0) {
    const top = y + SLAB_TOP + dy;
    const front = y + FRONT + dy;
    this.topSurface(ctx, x, top, front);
    ctx.fillStyle = C.stoneSpeck;
    for (let k = 0; k < 3; k++) {
      const h = hash(c, r, k + 40);
      ctx.fillRect(x + 4 + (h % 26), top + 2 + ((h >>> 5) % 6), 1.2, 0.6);
    }
    this.floorFront(ctx, x, y + dy, c, r, level);
  }

  // The slab's front edge (and dark side face where it ends at a drop). Also
  // drawn in the foreground so a hanging Prince's hands go behind the lip.
  floorFront(ctx, x, y, c, r, level) {
    const front = y + FRONT;
    const bottom = y + TILE_H;
    ctx.fillStyle = C.mortar;
    ctx.fillRect(x, front, TILE_W, bottom - front);
    this.stoneFace(ctx, x + 0.3, front + 0.3, TILE_W - 0.6, bottom - front - 0.6, hash(c, r, 21));
    ctx.fillStyle = C.topEdge;
    ctx.fillRect(x, front - 0.4, TILE_W, 0.8);
    if (level.tile(c + 1, r).t === T.EMPTY) this.sideFace(ctx, x + TILE_W, y + SLAB_TOP, front, bottom);
  }

  // A tapered iron cup on a short bracket.
  sconce(ctx, x, y) {
    poly(ctx, [x + 12.5, y + 20.5], [x + 19.5, y + 20.5], [x + 17, y + 31], [x + 15, y + 31]);
    ctx.fillStyle = hgrad(ctx, x + 12.5, x + 19.5, ['#e4e8f4', '#9098b0', '#3a4058']);
    ctx.fill();
    ctx.fillStyle = '#2a3048';
    ctx.fillRect(x + 12.5, y + 20.5, 7, 1);
  }

  rubble(ctx, x, y, c, r) {
    for (let i = 0; i < 8; i++) {
      const h = hash(c, r, i);
      const px = x + 3 + (h % 26);
      const py = y + FRONT - 1 - ((h >>> 5) % 7);
      const s = 1.2 + ((h >>> 8) % 3) * 0.7;
      poly(ctx, [px, py], [px + s * 1.6, py - s * 0.8], [px + s * 3, py - 0.2], [px + s * 1.4, py + s * 0.5]);
      ctx.fillStyle = (h >>> 11) % 2 ? C.stoneHi : C.stone[1];
      ctx.fill();
      ctx.strokeStyle = C.stoneLo;
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }

  exitFrame(ctx, x, y) {
    ctx.fillStyle = C.mortar;
    ctx.fillRect(x + 4, y + 2, 56, 44);
    this.course(ctx, x + 4, y + 2, 7, 200, 1, 56);
    for (const sx of [x + 4, x + 52]) {
      for (let i = 0; i < 5; i++) this.stoneFace(ctx, sx + 0.3, y + 9 + i * 7.4 + 0.3, 7.4, 6.8, hash(sx, i, 4));
    }
    ctx.fillStyle = C.void;
    ctx.fillRect(x + 12, y + 9, 40, 37);
    for (let i = 0; i < 5; i++) {
      const sy = y + 46 - (i + 1) * 7.4;
      ctx.fillStyle = i % 2 ? C.stone[1] : C.stone[2];
      ctx.fillRect(x + 12 + i * 3.5, sy, 40 - i * 7, 7.4);
      ctx.fillStyle = C.stoneHi;
      ctx.fillRect(x + 12 + i * 3.5, sy, 40 - i * 7, 0.8);
      ctx.fillStyle = C.stoneLo;
      ctx.fillRect(x + 12 + i * 3.5, sy + 6.6, 40 - i * 7, 0.8);
    }
  }

  // ---- foreground layer ----------------------------------------------------

  drawForeground(ctx, level, rx, ry) {
    this.eachTile(rx, ry, (c, r, x, y) => {
      const t = level.tile(c, r).t;
      if (t === T.PILLAR) this.pillar(ctx, x, y, c, r);
      if (t !== T.EMPTY && t !== T.WALL && t !== T.LOOSE && t !== T.PLATE) this.floorFront(ctx, x, y, c, r, level);
    });
  }

  // A column of stacked stones with a dark dithered side, standing on the floor.
  pillar(ctx, x, y, c, r) {
    const x0 = x + 7;
    const x1 = x + 22;
    const bottom = y + SLAB_TOP + 5;
    poly(ctx, [x1, y], [x1 + SKEW, y], [x1 + SKEW, bottom - (FRONT - SLAB_TOP)], [x1, bottom]);
    ctx.fillStyle = C.side;
    ctx.fill();
    ctx.fillStyle = this.dither(ctx);
    ctx.fill();
    ctx.fillStyle = C.mortar;
    ctx.fillRect(x0, y, x1 - x0, bottom - y);
    const h = (bottom - y) / 4;
    for (let i = 0; i < 4; i++) this.stoneFace(ctx, x0 + 0.4, y + i * h + 0.4, x1 - x0 - 0.8, h - 0.8, hash(c, r, i + 60));
  }

  // ---- animated pieces -----------------------------------------------------

  drawDynamic(ctx, level, rx, ry) {
    this.eachTile(rx, ry, (c, r, x, y) => {
      const tl = level.tile(c, r);
      switch (tl.t) {
        case T.TORCH:
          this.flame(ctx, x, y, c * 31 + r);
          break;
        case T.SPIKES:
          this.spikes(ctx, x, y, tl.ext, false);
          break;
        case T.LOOSE: {
          const shaking = tl.fallIn > 0 || tl.wobble > 0;
          this.floor(ctx, x, y, c, r, level, shaking ? (this.frame & 1 ? -0.8 : 0.8) : 0);
          ctx.strokeStyle = 'rgba(20,24,60,0.7)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x + 10, y + FRONT);
          ctx.lineTo(x + 13, y + 51);
          ctx.lineTo(x + 18, y + 49);
          ctx.moveTo(x + 22, y + FRONT);
          ctx.lineTo(x + 24, y + 52);
          ctx.stroke();
          break;
        }
        case T.PLATE:
          this.floor(ctx, x, y, c, r, level);
          this.plate(ctx, x, y, tl.pressed);
          break;
        case T.POTION:
          this.potion(ctx, x, y, tl.kind, c);
          break;
        case T.SWORD:
          this.floorSword(ctx, x, y);
          break;
        case T.EXIT:
          if (tl.half === 0) this.exitDoor(ctx, x, y, level.exitOpen);
          break;
      }
    });
    for (const f of level.falling) {
      const x = (f.c - rx * ROOM_COLS) * TILE_W;
      const y = f.y - 55 - ry * ROOM_H;
      if (x >= 0 && x < ROOM_W) this.floor(ctx, x, y, -9, -9, level);
    }
  }

  flame(ctx, x, y, seed) {
    const t = this.frame;
    const f = 0.85 + 0.12 * Math.sin(t * 1.9 + seed) + (hash(seed, t) % 100) / 900;
    const lean = Math.sin(t * 1.3 + seed * 2) * 1.6;
    const fx = x + 16;
    const base = y + 20;

    // Warm light on the stonework.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(fx, base - 5, 0, fx, base - 5, 22 * f);
    glow.addColorStop(0, 'rgba(255,150,60,0.10)');
    glow.addColorStop(0.4, 'rgba(255,110,40,0.03)');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fx - 50, base - 55, 100, 100);
    ctx.restore();

    const tongue = (w, h, k) => {
      ctx.beginPath();
      ctx.moveTo(fx - w, base);
      ctx.bezierCurveTo(fx - w * 1.4, base - h * 0.4, fx - w * 0.3 + lean * k, base - h * 0.75, fx + lean * 1.3 * k, base - h);
      ctx.bezierCurveTo(fx + w * 0.3 + lean * k, base - h * 0.7, fx + w * 1.4, base - h * 0.4, fx + w, base);
      ctx.closePath();
    };
    const g = ctx.createRadialGradient(fx, base - 2, 0.5, fx, base - 5, 12 * f);
    g.addColorStop(0, C.flame[0]);
    g.addColorStop(0.35, C.flame[1]);
    g.addColorStop(0.75, C.flame[2]);
    g.addColorStop(1, C.flame[3]);
    tongue(3.4, 14 * f, 1);
    ctx.fillStyle = g;
    ctx.fill();
    tongue(1.6, 7 * f, 0.6);
    ctx.fillStyle = 'rgba(255,250,220,0.9)';
    ctx.fill();
  }

  // Two rows of blades: the back row behind the characters, the front row in front.
  spikes(ctx, x, y, ext, front) {
    const h = (ext / 5) * 13;
    const base = y + (front ? 55 : 50);
    for (const sx of front ? [5, 12, 19, 26] : [9, 16, 23, 30]) {
      ctx.fillStyle = 'rgba(10,12,30,0.8)';
      ctx.fillRect(x + sx - 1.6, base - 0.4, 3.2, 0.8);
      if (!h) continue;
      poly(ctx, [x + sx - 1.1, base], [x + sx + 1.1, base], [x + sx, base - h]);
      ctx.fillStyle = hgrad(ctx, x + sx - 1.1, x + sx + 1.1, ['#ffffff', '#b8bed8', '#555c80']);
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,12,30,0.6)';
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  }

  plate(ctx, x, y, pressed) {
    const top = y + (pressed ? 50.5 : 49);
    const front = y + (pressed ? 55 : 53.5);
    poly(ctx, [x + 6, front], [x + 25, front], [x + 28, top], [x + 9, top]);
    ctx.fillStyle = vgrad(ctx, top, front, pressed ? [C.topBack, C.top] : [C.stone[1], C.stoneHi]);
    ctx.fill();
    ctx.strokeStyle = C.stoneLo;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    if (!pressed) {
      ctx.fillStyle = C.stoneLo;
      ctx.fillRect(x + 6, front, 19, 1.8);
    }
  }

  potion(ctx, x, y, kind, seed) {
    const big = kind === 'life';
    const cx = x + 17;
    const r = big ? 3.6 : 2.9;
    const cy = y + 54.2 - r;
    const liquid = big ? ['#b6ffb0', '#28c040', '#0a5a18'] : ['#ffb0a8', '#e8282a', '#6a0a10'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9);
    glow.addColorStop(0, big ? 'rgba(80,255,100,0.25)' : 'rgba(255,60,60,0.22)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 9, cy - 9, 18, 18);
    ctx.restore();
    ctx.fillStyle = 'rgba(200,220,255,0.55)';
    ctx.fillRect(cx - 0.9, cy - r - 3.2, 1.8, 3.4);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(cx - 1.1, cy - r - 4.2, 2.2, 1.2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0.2, cx, cy, r);
    liquid.forEach((c, i) => g.addColorStop(i / 2, c));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,255,0.8)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    const b = (this.frame + seed * 3) % 12;
    if (b < 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx + Math.sin(b) * 0.5, cy - r - 4 - b * 0.8, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  floorSword(ctx, x, y) {
    const yy = y + 52.5;
    ctx.fillStyle = 'rgba(0,0,10,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 17, yy + 1.3, 11, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [x + 9, yy - 0.6], [x + 27, yy - 0.1], [x + 27.8, yy + 0.2], [x + 9, yy + 0.6]);
    ctx.fillStyle = vgrad(ctx, yy - 0.6, yy + 0.6, ['#ffffff', '#8c94b8']);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.fillRect(x + 8, yy - 2.2, 1, 4.4);
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(x + 5, yy - 0.6, 3, 1.2);
    if (this.frame % 30 < 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x + 12 + (this.frame % 30) * 5, yy - 0.2, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  exitDoor(ctx, x, y, open) {
    const h = (1 - open) * 37;
    if (h <= 0.2) return;
    ctx.fillStyle = C.stone[0];
    ctx.fillRect(x + 12, y + 9, 40, h);
    ctx.fillStyle = C.stoneLo;
    for (let yy = y + 13; yy < y + 9 + h; yy += 5) ctx.fillRect(x + 12, yy, 40, 0.7);
    ctx.fillStyle = C.stoneHi;
    ctx.fillRect(x + 12, y + 9 + h - 0.8, 40, 0.8);
  }

  gates(ctx, level, rx, ry) {
    this.eachTile(rx, ry, (c, r, x, y) => {
      const tl = level.tile(c, r);
      if (tl.t !== T.GATE) return;
      ctx.fillStyle = vgrad(ctx, y, y + 3.5, ['#4a4a5c', '#15151f']);
      ctx.fillRect(x + 19.5, y, 13, 3.5);
      const h = (1 - tl.open) * 50;
      if (h <= 0.5) return;
      for (const bx of [21, 24.5, 28, 31.5]) {
        ctx.fillStyle = hgrad(ctx, bx - 0.8, bx + 0.8, ['#9ca0b8', '#3a3c4c', '#16161e']);
        ctx.fillRect(x + bx - 0.8, y + 3.5, 1.6, h);
        poly(ctx, [x + bx - 0.9, y + 3.5 + h], [x + bx + 0.9, y + 3.5 + h], [x + bx, y + 5.5 + h]);
        ctx.fill();
      }
      for (let yy = y + 9; yy < y + 3.5 + h; yy += 8) {
        ctx.fillStyle = vgrad(ctx, yy, yy + 1.4, ['#8c90a8', '#23252f']);
        ctx.fillRect(x + 20, yy, 12.5, 1.4);
      }
    });
  }

  // ---- composition ---------------------------------------------------------

  drawRoom(game, rx, ry, withChars = true) {
    const ctx = this.ctx;
    const level = game.level;
    const key = `${rx},${ry},${level.version},${level.def.name}`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.layer('bg', key, (c) => this.drawBackground(c, level, rx, ry)), 0, 0);
    this.logical(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ROOM_W, ROOM_H);
    ctx.clip();
    this.drawDynamic(ctx, level, rx, ry);

    if (withChars) {
      const ox = rx * ROOM_W;
      const oy = ry * ROOM_H;
      const visible = (x, y) => x > ox - 30 && x < ox + ROOM_W + 30 && y > oy - 10 && y < oy + ROOM_H + 60;
      const p = game.prince;
      const showPrince = visible(p.x, p.y) && !(p.state === 'exit' && p.t > 12);
      for (const g of game.guards) if (visible(g.x, g.y)) drawShadow(ctx, g.x - ox, g.y - oy);
      if (showPrince && (p.onGround || !p.alive)) drawShadow(ctx, p.x - ox, p.y - oy);
      for (const g of game.guards) {
        if (visible(g.x, g.y)) drawCharacter(ctx, guardJoints(g), 'guard', g.alive, ox, oy);
      }
      if (showPrince) {
        ctx.save();
        if (p.state === 'exit') ctx.globalAlpha = Math.max(0, 1 - p.t / 12);
        drawCharacter(ctx, princeJoints(p), 'prince', p.armed, ox, oy);
        ctx.restore();
      }
    }

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.layer('fg', key, (c) => this.drawForeground(c, level, rx, ry)), 0, 0);
    this.logical(ctx);
    this.eachTile(rx, ry, (c, r, x, y) => {
      const tl = level.tile(c, r);
      if (tl.t === T.SPIKES) this.spikes(ctx, x, y, tl.ext, true);
    });
    this.gates(ctx, level, rx, ry);
    if (game.flash > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = game.flashColor;
      ctx.fillRect(0, 0, ROOM_W, ROOM_H);
      ctx.globalAlpha = 1;
    }
  }

  // Text is counter-scaled so letters keep their shape on the 4:3 stretch.
  text(str, x, y, size, color, align = 'center', weight = 700) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, this.sx / this.sy);
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(str, size * 0.06, size * 0.08);
    ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  flask(x, y, full, color) {
    const ctx = this.ctx;
    poly(ctx, [x, y + 7.5], [x + 6, y + 7.5], [x + 3, y]);
    if (full) {
      ctx.fillStyle = vgrad(ctx, y, y + 7.5, ['#ffffff', color, '#300008']);
      ctx.fill();
    }
    ctx.strokeStyle = full ? 'rgba(255,255,255,0.5)' : color;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  statusBar(game, touch) {
    const ctx = this.ctx;
    const y = ROOM_H;
    ctx.fillStyle = vgrad(ctx, y, SCREEN_H, ['#0a0a14', '#000000']);
    ctx.fillRect(0, y, SCREEN_W, SCREEN_H - y);
    const p = game.prince;
    for (let i = 0; i < p.maxHp; i++) this.flask(3 + i * 8, y + 2, i < p.hp, C.hp);

    const { rx, ry } = game.room();
    const g = game.guards.find(
      (g) => g.alive && g.state !== 'guard' && Math.floor(g.x / ROOM_W) === rx && Math.floor((g.y - 1) / ROOM_H) === ry,
    );
    if (g) for (let i = 0; i < g.maxHp; i++) this.flask(SCREEN_W - 9 - i * 8, y + 2, i < g.hp, C.guardHp);

    let msg = game.msg?.text;
    if (!p.alive && game.deadTicks > 20) {
      msg = this.frame % 20 < 14 ? (touch ? 'Press Action to continue' : 'Press Shift to continue') : '';
    }
    if (msg) this.text(msg, SCREEN_W / 2, y + 5.6, 6.4, C.text);
  }

  play(game, touch) {
    const { rx, ry } = game.room();
    this.drawRoom(game, rx, ry);
    this.statusBar(game, touch);
  }

  dim(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(0,0,8,${alpha})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  title(game, touch) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawRoom(game, 0, 0, false);
    this.logical(ctx);
    this.dim(0.62);
    ctx.save();
    ctx.translate(SCREEN_W / 2, 44);
    ctx.scale(1, this.sx / this.sy);
    ctx.font = `700 25px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(60,0,0,0.9)';
    ctx.fillText('Prince of Persia', 1.2, 1.6);
    const gg = ctx.createLinearGradient(0, -12, 0, 12);
    gg.addColorStop(0, '#fff3b0');
    gg.addColorStop(0.5, '#f0c040');
    gg.addColorStop(1, '#a86a10');
    ctx.fillStyle = gg;
    ctx.fillText('Prince of Persia', 0, 0);
    ctx.restore();
    this.text('A tribute to the 1989 classic', SCREEN_W / 2, 66, 8, C.text, 'center', 600);
    this.text('Original game by Jordan Mechner', SCREEN_W / 2, 77, 6, C.dimText, 'center', 600);
    const help = touch
      ? ['Pad: run, crouch, climb', 'Jump: jump up or ahead · parry', 'Action: careful step, drink,', 'take the sword, strike']
      : ['Arrows: run, jump, crouch, climb', 'Up + arrow: jump ahead · Up: parry', 'Shift + arrow: careful step', 'Shift: drink, take the sword, strike'];
    help.forEach((l, i) => this.text(l, SCREEN_W / 2, 104 + i * 11, 6.4, C.dimText, 'center', 600));
    if (this.frame % 20 < 14) this.text(touch ? 'Tap to begin' : 'Press Enter to begin', SCREEN_W / 2, 164, 8, C.text);
  }

  endScreen(game, touch) {
    this.play(game, touch);
    this.dim(0.62);
    const won = game.mode === 'won';
    this.text(won ? 'You escaped the dungeon' : 'Time has expired', SCREEN_W / 2, 62, 12, won ? C.gold : C.hp);
    if (won) {
      const m = game.minutesLeft();
      this.text(`${m} minute${m === 1 ? '' : 's'} left`, SCREEN_W / 2, 82, 7.5, C.text, 'center', 600);
      this.text('The Princess awaits…', SCREEN_W / 2, 96, 7, C.dimText, 'center', 600);
    }
    if (this.frame % 20 < 14) this.text(touch ? 'Tap to play again' : 'Press Enter to play again', SCREEN_W / 2, 130, 7.5, C.text);
  }

  paused(game, touch) {
    this.play(game, touch);
    this.dim(0.5);
    this.text('Paused', SCREEN_W / 2, 84, 16, C.text);
    this.text(touch ? 'Tap to continue' : 'Press P to continue', SCREEN_W / 2, 108, 7, C.dimText, 'center', 600);
  }

  render(game, { touch, paused }) {
    this.frame++;
    this.logical(this.ctx);
    if (game.mode === 'title') this.title(game, touch);
    else if (paused) this.paused(game, touch);
    else if (game.mode === 'play') this.play(game, touch);
    else this.endScreen(game, touch);
  }
}
