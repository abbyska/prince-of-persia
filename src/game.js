import { GAME_MINUTES, START_HP, TICK_HZ, ROOM_W, ROOM_H } from './constants.js';
import { Level } from './level.js';
import { Prince } from './prince.js';
import { Guard } from './guard.js';

// Game rules and flow. Has no DOM access, so it can run headless in tests.
// `hooks.sfx(name)` and `hooks.vibrate(ms)` are optional.
export class Game {
  constructor(levelDef, hooks = {}) {
    this.def = levelDef;
    this.hooks = hooks;
    this.level = new Level(levelDef);
    this.prince = new Prince(this);
    this.guards = [];
    this.mode = 'title'; // title | play | won | timeup
    this.newGame();
  }

  newGame() {
    this.timeLeft = GAME_MINUTES * 60 * TICK_HZ;
    this.prince.maxHp = START_HP;
    this.startLevel();
  }

  startLevel() {
    this.level.reset();
    this.guards = this.def.guards.map((g) => new Guard(this, g));
    this.prince.maxHp = START_HP;
    this.prince.hp = START_HP;
    this.prince.spawn(this.def.start);
    this.deadTicks = 0;
    this.flash = 0;
    this.msg = null;
  }

  begin() {
    this.mode = 'play';
    this.message(`${this.minutesLeft()} MINUTES LEFT`, 45);
  }

  minutesLeft() {
    return Math.ceil(this.timeLeft / (60 * TICK_HZ));
  }

  sfx(name) {
    this.hooks.sfx?.(name);
  }

  message(text, ticks = 30) {
    this.msg = { text, ticks };
  }

  hurtFx() {
    this.flash = 2;
    this.flashColor = '#fc5454';
    this.hooks.vibrate?.(60);
  }

  potionFx(kind) {
    this.flash = 3;
    this.flashColor = kind === 'life' ? '#54fc54' : '#fcfcfc';
    this.sfx('potion');
    if (kind === 'life') this.message('YOUR STRENGTH GROWS', 40);
  }

  win() {
    if (this.mode !== 'play') return;
    this.mode = 'won';
    this.sfx('win');
  }

  // Which room the camera shows: the one the Prince's feet are in.
  room() {
    const p = this.prince;
    return {
      rx: Math.max(0, Math.floor(p.x / ROOM_W)),
      ry: Math.max(0, Math.floor((p.y - 1) / ROOM_H)),
    };
  }

  resolveStrike(att, def) {
    if (!def || !def.alive) return;
    const d = def.x - att.x;
    if (Math.sign(d) !== att.dir || Math.abs(d) > 46) {
      this.sfx('swish');
      return;
    }
    if (def.isParrying() && def.dir === -att.dir) {
      this.sfx('clang');
      att.blocked();
      return;
    }
    def.takeHit();
  }

  tick(inp) {
    if (this.mode !== 'play') return;

    const before = this.minutesLeft();
    if (this.timeLeft > 0) this.timeLeft--;
    const now = this.minutesLeft();
    if (now !== before && (now % 5 === 0 || now <= 5)) {
      this.message(now === 1 ? '1 MINUTE LEFT' : `${now} MINUTES LEFT`, 45);
    }
    if (this.timeLeft <= 0) {
      this.mode = 'timeup';
      this.sfx('death');
      return;
    }

    const p = this.prince;
    p.tick(inp);
    if (p.alive && p.onGround) {
      this.level.stepOn(p.col(), p.row);
      this.level.near(p.col(), p.row);
    } else if (p.deathCause === 'spikes') {
      this.level.near(p.col(), p.row); // keep the spikes up under the body
    }
    for (const g of this.guards) g.tick();
    this.level.update();
    for (const e of this.level.events) this.sfx(e);
    this.level.events.length = 0;

    if (this.msg && --this.msg.ticks <= 0) this.msg = null;
    if (this.flash > 0) this.flash--;

    if (!p.alive) {
      this.deadTicks++;
      if (this.deadTicks > 20 && (inp.actionP || inp.startP)) this.startLevel();
    }
  }
}
