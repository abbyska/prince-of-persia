import { TILE_H, TICK_HZ, floorY } from './constants.js';

export const T = {
  EMPTY: 'empty',
  FLOOR: 'floor',
  WALL: 'wall',
  PILLAR: 'pillar',
  SPIKES: 'spikes',
  LOOSE: 'loose',
  GATE: 'gate',
  PLATE: 'plate',
  POTION: 'potion',
  SWORD: 'sword',
  EXIT: 'exit',
  TORCH: 'torch',
  RUBBLE: 'rubble',
};

const GATE_HOLD = 20 * TICK_HZ; // gates stay open this long after a plate press
const LOOSE_DELAY = 6; // ticks a loose floor shakes before it drops

// Anything outside the map behaves like solid stone.
const SOLID = Object.freeze({ t: T.WALL });

function parseTile(ch) {
  switch (ch) {
    case ' ': return { t: T.EMPTY };
    case '_': return { t: T.FLOOR };
    case '#': return { t: T.WALL };
    case '|': return { t: T.PILLAR };
    case '^': return { t: T.SPIKES, ext: 0, hold: 0 };
    case '~': return { t: T.LOOSE, fallIn: -1, wobble: 0 };
    case 't': return { t: T.TORCH };
    case ',': return { t: T.RUBBLE };
    case '/': return { t: T.SWORD };
    case 'h': return { t: T.POTION, kind: 'heal' };
    case 'H': return { t: T.POTION, kind: 'life' };
    case '*': return { t: T.PLATE, link: 'exit', pressed: 0 };
    case '[': return { t: T.EXIT, half: 0 };
    case ']': return { t: T.EXIT, half: 1 };
  }
  if (ch >= 'A' && ch <= 'D') return { t: T.GATE, link: ch.toLowerCase(), open: 0, timer: 0 };
  if (ch >= 'a' && ch <= 'd') return { t: T.PLATE, link: ch, pressed: 0 };
  throw new Error(`Unknown tile '${ch}'`);
}

export class Level {
  constructor(def) {
    this.def = def;
    this.reset();
  }

  reset() {
    const map = this.def.map;
    this.rows = map.length;
    this.cols = map[0].length;
    this.tiles = map.map((line) => [...line].map(parseTile));
    this.falling = []; // loose floors on their way down
    this.exitOpen = 0; // 0 closed .. 1 fully open
    this.exitOpening = false;
    this.version = 0; // bumped whenever the static look of a tile changes
    this.events = []; // sound effects raised this tick
  }

  tile(c, r) {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return SOLID;
    return this.tiles[r][c];
  }

  isWall(c, r) {
    return this.tile(c, r).t === T.WALL;
  }

  // Has a floor (or stone) — i.e. something that stops a fall or a jump up.
  hasFloor(c, r) {
    return this.tile(c, r).t !== T.EMPTY;
  }

  // A floor a character can stand on.
  standable(c, r) {
    const t = this.tile(c, r).t;
    return t !== T.EMPTY && t !== T.WALL;
  }

  setTile(c, r, tile) {
    this.tiles[r][c] = tile;
    this.version++;
  }

  // The gate's bars sit near the right side of its tile.
  gatePlaneX(c) {
    return c * 32 + 26;
  }

  gateClosed(c, r) {
    const t = this.tile(c, r);
    return t.t === T.GATE && t.open < 0.75;
  }

  exitAt(c, r) {
    return this.tile(c, r).t === T.EXIT;
  }

  // Called every tick for the tile under a character standing on the ground.
  stepOn(c, r) {
    const tl = this.tile(c, r);
    if (tl.t === T.PLATE) this.press(tl);
    else if (tl.t === T.LOOSE && tl.fallIn < 0) {
      tl.fallIn = LOOSE_DELAY;
      this.events.push('loose');
    }
  }

  press(tl) {
    if (!tl.pressed) this.events.push('click');
    tl.pressed = 2;
    if (tl.link === 'exit') {
      if (!this.exitOpening) {
        this.exitOpening = true;
        this.events.push('gate');
      }
      return;
    }
    for (const row of this.tiles) {
      for (const g of row) {
        if (g.t === T.GATE && g.link === tl.link) {
          if (g.timer <= 0 && g.open < 1) this.events.push('gate');
          g.timer = GATE_HOLD;
        }
      }
    }
  }

  // Spikes spring up when someone comes within a tile of them.
  near(c, r) {
    for (let dc = -1; dc <= 1; dc++) {
      const tl = this.tile(c + dc, r);
      if (tl.t === T.SPIKES) {
        if (tl.ext === 0 && tl.hold === 0) this.events.push('spikes');
        tl.hold = 10;
      }
    }
  }

  // Knocking a loose floor from below makes it fall straight away.
  knock(c, r) {
    const tl = this.tile(c, r);
    if (tl.t === T.LOOSE && tl.fallIn < 0) tl.fallIn = 2;
  }

  update() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tl = this.tiles[r][c];
        switch (tl.t) {
          case T.PLATE:
            if (tl.pressed > 0) tl.pressed--;
            break;
          case T.GATE:
            if (tl.timer > 0) {
              tl.timer--;
              tl.open = Math.min(1, tl.open + 0.12);
            } else if (tl.open > 0) {
              tl.open = Math.max(0, tl.open - 0.015);
              if (tl.open === 0) this.events.push('slam');
            }
            break;
          case T.SPIKES:
            if (tl.hold > 0) {
              tl.hold--;
              tl.ext = Math.min(5, tl.ext + 2);
            } else {
              tl.ext = Math.max(0, tl.ext - 1);
            }
            break;
          case T.LOOSE:
            if (tl.fallIn > 0) {
              tl.fallIn--;
              if (tl.fallIn === 0) this.drop(c, r);
            } else if (tl.wobble > 0) {
              tl.wobble--;
            } else if (Math.random() < 0.003) {
              tl.wobble = 3; // idle rattle, like the original
            }
            break;
        }
      }
    }

    if (this.exitOpening) this.exitOpen = Math.min(1, this.exitOpen + 0.019);

    for (const f of this.falling) {
      f.vy = Math.min(f.vy + 3.75, 25);
      f.y += f.vy;
      const next = f.row + 1;
      if (f.y >= floorY(next)) {
        if (this.hasFloor(f.c, next) || next >= this.rows) {
          f.done = true;
          const below = this.tile(f.c, next);
          if (below.t === T.FLOOR) this.setTile(f.c, next, { t: T.RUBBLE });
          else if (below.t === T.PLATE) this.press(below);
          this.events.push('crash');
        } else {
          f.row = next;
        }
      }
    }
    this.falling = this.falling.filter((f) => !f.done);
  }

  drop(c, r) {
    this.setTile(c, r, { t: T.EMPTY });
    this.falling.push({ c, row: r, y: r * TILE_H + 55, vy: 2 });
  }
}
