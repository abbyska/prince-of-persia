import { TILE_W, floorY, colOf } from './constants.js';
import { T } from './level.js';

// A palace guard: stands watch, then fences with the Prince when he comes close.
// Guards never leave the stretch of floor they start on.
export class Guard {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.serial = 0;
    this.reset();
  }

  reset() {
    const d = this.def;
    this.x = d.col * TILE_W + 16;
    this.row = d.row;
    this.y = floorY(d.row);
    this.dir = d.dir;
    this.hp = this.maxHp = d.hp ?? 3;
    this.skill = d.skill ?? 0.4;
    this.cool = 10;
    this.seenStrike = -1;
    this.set('guard');
    this.computeSpan();
  }

  computeSpan() {
    const L = this.game.level;
    const ok = (c) => L.standable(c, this.row) && L.tile(c, this.row).t !== T.SPIKES;
    let a = colOf(this.x);
    let b = a;
    while (ok(a - 1)) a--;
    while (ok(b + 1)) b++;
    this.minX = a * TILE_W + 8;
    this.maxX = (b + 1) * TILE_W - 8;
  }

  get alive() {
    return this.state !== 'dead';
  }

  set(state) {
    this.state = state;
    this.t = 0;
    this.serial++;
  }

  isParrying() {
    return this.state === 'parry' && this.t <= 3;
  }

  move(dx) {
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x + dx));
    // Keep a sword's length from the Prince rather than walking through him.
    const p = this.game.prince;
    if (p.alive && p.onGround && p.row === this.row) {
      const d = p.x - this.x;
      if (Math.abs(d) < 18) this.x = p.x - Math.sign(d || this.dir) * 18;
    }
  }

  tick() {
    const serial = this.serial;
    this['s_' + this.state]();
    if (this.serial === serial) this.t++;
  }

  prince() {
    const p = this.game.prince;
    if (!p.alive || !p.onGround || p.row !== this.row) return null;
    const d = p.x - this.x;
    return Math.abs(d) < 120 ? { p, d, dist: Math.abs(d) } : null;
  }

  s_guard() {
    const s = this.prince();
    if (s) {
      this.dir = Math.sign(s.d) || this.dir;
      this.game.sfx('draw');
      this.set('fight');
    }
  }

  s_fight() {
    const s = this.prince();
    if (!s) {
      if (this.t > 20) this.set('guard');
      return;
    }
    const { p, d, dist } = s;
    this.dir = Math.sign(d) || this.dir;
    this.cool--;

    // React to the Prince's strike with a parry, as often as skill allows.
    if (p.state === 'strike' && p.t <= 1 && p.serial !== this.seenStrike && dist < 50) {
      this.seenStrike = p.serial;
      if (Math.random() < this.skill) return this.set('parry');
    }
    if (dist > 38) return this.set('advance');
    if (dist < 20) return this.set('retreat');
    if (this.cool <= 0) {
      this.cool = 10 + Math.floor(Math.random() * 12);
      this.set('strike');
    }
  }

  s_advance() {
    this.move(this.dir * 4);
    if (this.t >= 2) this.set('fight');
  }

  s_retreat() {
    this.move(-this.dir * 4);
    if (this.t >= 2) this.set('fight');
  }

  s_strike() {
    // A visible wind-up gives the player time to parry.
    if (this.t === 3) this.move(this.dir * 3);
    if (this.t === 4) this.game.resolveStrike(this, this.game.prince);
    if (this.t >= 6 && this.state === 'strike') this.set('fight');
  }

  s_parry() {
    if (this.t >= 4) this.set('fight');
  }

  s_blocked() {
    if (this.t < 2) this.move(-this.dir * 2);
    if (this.t >= 3) this.set('fight');
  }

  s_hurt() {
    if (this.t < 2) this.move(-this.dir * 3);
    if (this.t >= 3) this.set('fight');
  }

  s_dead() {}

  blocked() {
    this.set('blocked');
  }

  takeHit() {
    this.hp--;
    this.game.sfx('hit');
    this.cool = Math.max(this.cool, 8);
    if (this.hp <= 0) {
      this.game.sfx('guarddie');
      this.set('dead');
    } else {
      this.set('hurt');
    }
  }
}
