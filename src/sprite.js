// Rasterises a posed skeleton into a shaded pixel sprite in the style of the
// 1989 DOS game: baggy trousers gathered at the ankle, a loose shirt, a small
// profile head, one-pixel rim shading on the side away from the light, and a
// dark outline so the figure reads against the stonework.

const SIZE = 96;
const HIP_X = 48;
const HIP_Y = 50;

// Materials. Shaded variants are produced by the post-pass.
const E = 0;
const CLOTH = 1;
const CLOTH_FAR = 2;
const SKIN = 3;
const SKIN_FAR = 4;
const HAIR = 5;
const STEEL = 6;
const HILT = 7;
const EYE = 8;
const HEADWEAR = 9;
const BELT = 10;
const COAT = 11;
const COAT_FAR = 12;
const CLOTH_SH = 13;
const SKIN_SH = 14;
const COAT_SH = 15;
const HEADWEAR_SH = 16;
const OUTLINE = 17;
const STEEL_SH = 18;

const SHADE = { [CLOTH]: CLOTH_SH, [SKIN]: SKIN_SH, [COAT]: COAT_SH, [HEADWEAR]: HEADWEAR_SH };

// Heads face right; '.' is transparent.
const HEADS = {
  prince: [
    '.hhhh..',
    'hhhhhh.',
    'hhhsss.',
    'hhsses.',
    'hhsssss',
    '.hssss.',
    '..sss..',
  ],
  guard: [
    '.TTTTT.',
    'TTTTTTT',
    'TTTTTTr',
    '.hssse.',
    '.hsssss',
    '.hssmm.',
    '..sss..',
  ],
};
const HEAD_KEY = { h: HAIR, s: SKIN, e: EYE, T: HEADWEAR, r: BELT, m: HAIR };

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const LOOKS = {
  prince: {
    head: 'prince',
    coat: false,
    colors: {
      [CLOTH]: '#fcfcfc', [CLOTH_SH]: '#b4b4d0', [CLOTH_FAR]: '#a0a0bc',
      [SKIN]: '#ecac7c', [SKIN_SH]: '#b87450', [SKIN_FAR]: '#b87450',
      [HAIR]: '#38200c', [EYE]: '#200c04',
      [STEEL]: '#fcfcfc', [STEEL_SH]: '#9c9cb4', [HILT]: '#fcd454',
      [OUTLINE]: '#100c14',
    },
  },
  guard: {
    head: 'guard',
    coat: true,
    colors: {
      [CLOTH]: '#e4b048', [CLOTH_SH]: '#a4702c', [CLOTH_FAR]: '#94642c',
      [COAT]: '#5870d8', [COAT_SH]: '#34449c', [COAT_FAR]: '#34449c',
      [SKIN]: '#cc8454', [SKIN_SH]: '#8c5030', [SKIN_FAR]: '#8c5030',
      [HAIR]: '#200c04', [EYE]: '#fcfcfc',
      [HEADWEAR]: '#ececf8', [HEADWEAR_SH]: '#a8a8c4', [BELT]: '#fc5454',
      [STEEL]: '#fcfcfc', [STEEL_SH]: '#9c9cb4', [HILT]: '#fcd454',
      [OUTLINE]: '#100c14',
    },
  },
};
for (const look of Object.values(LOOKS)) {
  look.rgb = {};
  for (const [k, v] of Object.entries(look.colors)) look.rgb[k] = rgb(v);
}

export class SpriteRasterizer {
  constructor() {
    this.buf = new Uint8Array(SIZE * SIZE);
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.cctx = this.canvas.getContext('2d');
    this.img = this.cctx.createImageData(SIZE, SIZE);
  }

  set(x, y, m) {
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.buf[y * SIZE + x] = m;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? this.buf[y * SIZE + x] : E;
  }

  // A tapered capsule from a (radius ra) to b (radius rb).
  cap(a, b, ra, rb, m) {
    const x0 = Math.floor(Math.min(a[0] - ra, b[0] - rb));
    const x1 = Math.ceil(Math.max(a[0] + ra, b[0] + rb));
    const y0 = Math.floor(Math.min(a[1] - ra, b[1] - rb));
    const y1 = Math.ceil(Math.max(a[1] + ra, b[1] + rb));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a[0];
        const py = y + 0.5 - a[1];
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const r = ra + (rb - ra) * t;
        const ex = px - dx * t;
        const ey = py - dy * t;
        if (ex * ex + ey * ey <= r * r) this.set(x, y, m);
      }
    }
  }

  stamp(rows, cx, cy, dir) {
    const w = rows[0].length;
    const h = rows.length;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h / 2);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const m = HEAD_KEY[rows[r][c]];
        if (!m) continue;
        const x = dir > 0 ? x0 + c : x0 + (w - 1 - c) + (w % 2 ? 0 : 1);
        this.set(x, y0 + r, m);
      }
    }
  }

  line(a, b, m) {
    let x0 = Math.round(a[0]);
    let y0 = Math.round(a[1]);
    const x1 = Math.round(b[0]);
    const y1 = Math.round(b[1]);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, m);
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

  leg(hip, knee, foot, dir, cloth, skin) {
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    // Baggy trousers: full through the thigh and calf, gathered at the ankle.
    this.cap(hip, knee, 2.9, 2.5, cloth);
    const calf = lerp(knee, foot, 0.55);
    const ankle = lerp(knee, foot, 0.82);
    this.cap(knee, calf, 2.5, 3.1, cloth);
    this.cap(calf, ankle, 3.1, 1.8, cloth);
    // Bare foot pointing forward.
    this.cap([foot[0] - dir * 0.5, foot[1] - 1], [foot[0] + dir * 3, foot[1] - 0.6], 1.1, 0.9, skin);
  }

  arm(sh, el, wr, cloth, skin) {
    this.cap(sh, el, 1.9, 1.6, cloth);
    this.cap(el, wr, 1.6, 1.3, cloth);
    const fx = wr[0] - el[0];
    const fy = wr[1] - el[1];
    const fl = Math.hypot(fx, fy) || 1;
    this.cap(wr, [wr[0] + (fx / fl) * 1.5, wr[1] + (fy / fl) * 1.5], 1.3, 1.1, skin);
  }

  // Draws joints J (world space) with a look onto ctx, offset by the room origin.
  draw(ctx, J, lookName, armed, ox, oy) {
    const look = LOOKS[lookName];
    const d = J.dir;
    const bx = Math.round(J.hip[0]) - HIP_X;
    const by = Math.round(J.hip[1]) - HIP_Y;
    const L = (p) => [p[0] - bx, p[1] - by];
    const [hip, neck, sh, head, k1, f1, k2, f2, e1, w1, e2, w2] =
      ['hip', 'neck', 'sh', 'head', 'k1', 'f1', 'k2', 'f2', 'e1', 'w1', 'e2', 'w2'].map((k) => L(J[k]));
    const body = look.coat ? COAT : CLOTH;

    this.buf.fill(E);
    // Far side first.
    this.leg(hip, k2, f2, d, CLOTH_FAR, SKIN_FAR);
    this.arm(sh, e2, w2, look.coat ? COAT_FAR : CLOTH_FAR, SKIN_FAR);
    // Body.
    this.cap(neck, sh, 1.3, 1.3, SKIN);
    this.cap(hip, sh, 3.3, 3.7, body);
    this.leg(hip, k1, f1, d, CLOTH, SKIN);
    if (look.coat) {
      // Coat skirt over the thighs, and a sash at the waist.
      const mid = [(k1[0] + k2[0]) / 2, (k1[1] + k2[1]) / 2];
      this.cap(hip, [hip[0] + (mid[0] - hip[0]) * 0.55, hip[1] + (mid[1] - hip[1]) * 0.55], 3.6, 4.1, COAT);
      this.cap([hip[0] - 3, hip[1] - 1], [hip[0] + 3, hip[1] - 1], 0.8, 0.8, BELT);
    }
    this.stamp(HEADS[look.head], head[0], head[1], d);
    this.arm(sh, e1, w1, body, SKIN);

    this.shade(d);

    if (armed && J.sword != null) {
      const vx = Math.cos(J.sword) * d;
      const vy = Math.sin(J.sword);
      this.line([w1[0] + vx * 2, w1[1] + vy * 2], [w1[0] + vx * 17, w1[1] + vy * 17], STEEL);
      this.line([w1[0] + vx * 3 + vy, w1[1] + vy * 3 - vx], [w1[0] + vx * 14 + vy, w1[1] + vy * 14 - vx], STEEL_SH);
      this.line([w1[0] - vy * 2, w1[1] + vx * 2], [w1[0] + vy * 2, w1[1] - vx * 2], HILT);
    }

    this.blit(ctx, look, bx - ox, by - oy);
  }

  // Rim shading on the back and underside, then a dark outline.
  shade(dir) {
    const b = this.buf;
    const out = new Uint8Array(b);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const m = b[y * SIZE + x];
        const sh = SHADE[m];
        if (!sh) continue;
        if (this.get(x - dir, y) === E || this.get(x, y + 1) === E) out[y * SIZE + x] = sh;
      }
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (b[y * SIZE + x] !== E) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) {
          out[y * SIZE + x] = OUTLINE;
        }
      }
    }
    b.set(out);
  }

  blit(ctx, look, x, y) {
    const data = this.img.data;
    const b = this.buf;
    for (let i = 0; i < b.length; i++) {
      const c = b[i] ? look.rgb[b[i]] : null;
      const o = i * 4;
      if (c) {
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      } else {
        data[o + 3] = 0;
      }
    }
    this.cctx.putImageData(this.img, 0, 0);
    ctx.drawImage(this.canvas, x, y);
  }
}
