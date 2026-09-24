import { TILE_W, START_HP, floorY, colOf, rowOf } from './constants.js';
import { T } from './level.js';

const HALF = 5; // half body width, for bumping into stone and gates
const HANG_DROP = 44; // feet hang this far below the ledge they hold

// Per-tick horizontal movement for the multi-frame moves. Like the original,
// movement comes from the animation rather than from free physics.
// Values are per tick at 12 ticks a second.
const START_DX = [3, 5, 8, 10];
const RUN_DX = 11;
const STOP_DX = [8, 4, 1];
const RUNTURN_DX = [6, 4, 1, 0];
const RUNJUMP_DX = [10, 13, 13, 13, 13, 13, 13, 12, 8];
const STANDJUMP_DX = [0, 0, 3, 11, 11, 11, 11, 8, 3, 0];
const STANDJUMP_LAND = 7; // tick at which a standing jump touches down
const JUMPUP_DY = [0, -3, -7, -9, -7, -3, 0];
const FALL_ACCEL = 3.75;
const FALL_MAX = 27;

const GROUND = new Set([
  'stand', 'turn', 'startrun', 'run', 'stop', 'runturn', 'bump', 'crouch',
  'standup', 'land', 'landhard', 'crouchhop', 'step', 'drink', 'pickup',
  'engarde', 'fight', 'advance', 'retreat', 'strike', 'parry', 'hurt',
  'blocked', 'sheathe', 'exit',
]);
const ARMED = new Set(['engarde', 'fight', 'advance', 'retreat', 'strike', 'parry', 'hurt', 'blocked']);

export class Prince {
  constructor(game) {
    this.game = game;
    this.maxHp = START_HP;
    this.hp = START_HP;
    this.serial = 0;
  }

  get level() {
    return this.game.level;
  }

  spawn(start) {
    this.x = start.col * TILE_W + 16;
    this.row = start.row;
    this.y = floorY(this.row);
    this.dir = start.dir;
    this.yOff = 0;
    this.vy = 0;
    this.dx = 0;
    this.runPhase = 0;
    this.fallFrom = this.row;
    this.edgeX = 0;
    this.ledgeRow = 0;
    this.stepDist = 0;
    this.noEngage = 0;
    this.hasSword = false;
    this.deathCause = null;
    this.jumpQueued = false;
    // Drop in from the shaft above, as the Prince does at the start of the original.
    this.y = floorY(this.row) - 70;
    this.vy = 2.5;
    this.fallFrom = this.row;
    this.set('fall');
  }

  get alive() {
    return this.state !== 'dead';
  }

  get onGround() {
    return GROUND.has(this.state);
  }

  get armed() {
    return this.hasSword && ARMED.has(this.state);
  }

  col() {
    return colOf(this.x);
  }

  set(state) {
    this.state = state;
    this.t = 0;
    this.serial++;
  }

  fwd(inp) {
    return this.dir > 0 ? inp.right : inp.left;
  }

  back(inp) {
    return this.dir > 0 ? inp.left : inp.right;
  }

  tick(inp) {
    const serial = this.serial;
    if (this.noEngage > 0) this.noEngage--;
    this['s_' + this.state](inp);
    if (this.serial === serial) this.t++;
  }

  // ---- world queries -------------------------------------------------------

  supported() {
    return this.level.standable(this.col(), this.row);
  }

  bodyRows() {
    if (this.onGround) return [this.row];
    const top = rowOf(this.y - 40);
    const bottom = rowOf(this.y - 1);
    return top === bottom ? [top] : [top, bottom];
  }

  // Moves horizontally, stopping at stone, closed gates and living guards.
  // Returns true if something blocked the move.
  moveH(dx) {
    if (!dx) return false;
    const L = this.level;
    let nx = this.x + dx;
    let blocked = false;
    const rows = this.bodyRows();
    const fc = colOf(dx > 0 ? nx + HALF : nx - HALF);
    for (const r of rows) {
      if (L.isWall(fc, r)) {
        nx = dx > 0 ? fc * TILE_W - HALF - 0.01 : (fc + 1) * TILE_W + HALF + 0.01;
        blocked = true;
      }
    }
    for (const r of rows) {
      for (const c of new Set([this.col(), fc])) {
        if (!L.gateClosed(c, r)) continue;
        const gx = L.gatePlaneX(c);
        if (dx > 0 && this.x <= gx - HALF + 0.01 && nx + HALF > gx) {
          nx = gx - HALF;
          blocked = true;
        } else if (dx < 0 && this.x >= gx + HALF - 0.01 && nx - HALF < gx) {
          nx = gx + HALF;
          blocked = true;
        }
      }
    }
    if (this.onGround) {
      for (const g of this.game.guards) {
        if (!g.alive || g.row !== this.row) continue;
        const d = g.x - this.x;
        if (Math.sign(d) === Math.sign(dx) && Math.abs(g.x - nx) < 18) {
          nx = g.x - Math.sign(dx) * 18;
          blocked = true;
        }
      }
    }
    this.x = nx;
    return blocked;
  }

  // Distance to the next drop-off in a direction (99 if there is none nearby).
  distToDrop(dir) {
    const L = this.level;
    const c = this.col();
    let edge = dir > 0 ? (c + 1) * TILE_W : c * TILE_W;
    for (let i = 1; i <= 2; i++) {
      const t = L.tile(c + dir * i, this.row).t;
      if (t === T.EMPTY) return Math.abs(edge - this.x);
      if (t === T.WALL) return 99;
      edge += dir * TILE_W;
    }
    return 99;
  }

  // After moving on the ground: fall if the floor ran out, and die if a fast
  // move carried us onto spikes. Returns false if the move ended in a fall/death.
  checkFooting(prevCol, fast) {
    if (!this.supported()) {
      this.startFall(this.dir * 3);
      return false;
    }
    if (fast && this.col() !== prevCol && this.level.tile(this.col(), this.row).t === T.SPIKES) {
      this.die('spikes');
      return false;
    }
    return true;
  }

  enemy() {
    let best = null;
    for (const g of this.game.guards) {
      if (!g.alive || g.row !== this.row) continue;
      if (!best || Math.abs(g.x - this.x) < Math.abs(best.x - this.x)) best = g;
    }
    return best;
  }

  enemyNear(d) {
    const g = this.enemy();
    return g && Math.abs(g.x - this.x) < d;
  }

  atOpenExit() {
    return this.level.exitAt(this.col(), this.row) && this.level.exitOpen >= 1;
  }

  isParrying() {
    return this.state === 'parry' && this.t <= 3;
  }

  // ---- transitions ---------------------------------------------------------

  startFall(dx = 0, fromRow = this.row) {
    this.yOff = 0;
    this.vy = 2.5;
    this.dx = dx;
    this.fallFrom = fromRow;
    this.set('fall');
  }

  die(cause) {
    if (!this.alive) return;
    this.hp = 0;
    this.yOff = 0;
    this.deathCause = cause;
    this.set('dead');
    this.game.hurtFx();
    this.game.sfx('death');
  }

  hurt(amount = 1) {
    this.hp = Math.max(0, this.hp - amount);
    this.game.hurtFx();
    if (this.hp <= 0) {
      this.die('hurt');
      return false;
    }
    return true;
  }

  takeHit() {
    if (!this.alive) return;
    this.game.sfx('hit');
    if (this.hurt()) this.set('hurt');
    else this.deathCause = 'sword';
  }

  blocked() {
    this.set('blocked');
  }

  engarde() {
    const g = this.enemy();
    this.dir = g.x > this.x ? 1 : -1;
    this.game.sfx('draw');
    this.set('engarde');
  }

  canEngage() {
    return this.hasSword && this.noEngage <= 0 && this.enemyNear(70);
  }

  hangFrom(edgeX, ledgeRow, dir) {
    this.dir = dir;
    this.edgeX = edgeX;
    this.ledgeRow = ledgeRow;
    this.x = edgeX - dir * 6;
    this.y = floorY(ledgeRow) + HANG_DROP;
    this.row = ledgeRow + 1;
    this.yOff = 0;
    this.set('hang');
  }

  // Jump up: grab a ledge above-ahead (or above-behind) if there is a gap overhead.
  tryJumpGrab() {
    const L = this.level;
    const c = this.col();
    const r = this.row;
    if (L.hasFloor(c, r - 1)) return false;
    for (const d of [this.dir, -this.dir]) {
      if (L.standable(c + d, r - 1)) {
        this.dir = d;
        this.edgeX = d > 0 ? (c + 1) * TILE_W : c * TILE_W;
        this.ledgeRow = r - 1;
        this.grabFromX = this.x;
        this.set('jumpgrab');
        return true;
      }
    }
    return false;
  }

  // Down at an edge: lower yourself over it and hang.
  tryClimbDown() {
    const L = this.level;
    const c = this.col();
    const r = this.row;
    for (const g of [this.dir, -this.dir]) {
      if (L.tile(c + g, r).t !== T.EMPTY) continue;
      const edge = g > 0 ? (c + 1) * TILE_W : c * TILE_W;
      if (Math.abs(edge - this.x) <= 14) {
        this.dir = -g;
        this.edgeX = edge;
        this.ledgeRow = r;
        this.set('climbdown');
        return true;
      }
    }
    return false;
  }

  beginStep() {
    const d = this.distToDrop(this.dir);
    this.stepDist = Math.max(0, Math.min(11, d - 3));
    this.set('step');
  }

  // End of a jump: land, catch the far ledge, or fall.
  landJump(inp, running) {
    const L = this.level;
    const c = this.col();
    this.yOff = 0;
    if (L.standable(c, this.row)) {
      if (L.tile(c, this.row).t === T.SPIKES) {
        this.die('spikes');
        return false;
      }
      this.game.sfx('land');
      if (running) this.set(this.fwd(inp) ? 'run' : 'stop');
      return true;
    }
    // Coming up short: the ledge ahead is caught only if UP or ACTION is held.
    const edge = this.dir > 0 ? (c + 1) * TILE_W : c * TILE_W;
    if ((inp.up || inp.action) && L.standable(c + this.dir, this.row) && Math.abs(edge - this.x) <= 20) {
      this.game.sfx('grab');
      this.hangFrom(edge, this.row, this.dir);
      return false;
    }
    this.startFall(this.dir * 3);
    return false;
  }

  // ---- states --------------------------------------------------------------

  s_stand(inp) {
    const L = this.level;
    this.yOff = 0;
    this.jumpQueued = false;
    if (!this.supported()) return this.startFall(0);
    if (this.canEngage()) return this.engarde();
    if (inp.up && this.atOpenExit()) return this.set('exit');
    // ACTION on its own drinks or takes the sword; with a direction it's a careful step.
    if (inp.actionP && !inp.left && !inp.right) {
      const tl = L.tile(this.col(), this.row);
      if (tl.t === T.POTION) return this.set('drink');
      if (tl.t === T.SWORD) return this.set('pickup');
    }
    const fwd = this.fwd(inp);
    if (inp.up && fwd) return this.set('standjump');
    if (inp.up) {
      if (!this.tryJumpGrab()) this.set('jumpup');
      return;
    }
    if (inp.down) {
      if (!this.tryClimbDown()) this.set('crouch');
      return;
    }
    if (fwd && inp.action) return this.beginStep();
    if (fwd) return this.set('startrun');
    if (this.back(inp)) return this.set('turn');
  }

  s_turn() {
    if (this.t === 1) this.dir = -this.dir;
    if (this.t >= 2) this.set('stand');
  }

  s_startrun(inp) {
    if (!this.fwd(inp)) return this.set('stop');
    // A running jump needs a run-up: UP now is remembered until full speed.
    if (inp.up) this.jumpQueued = true;
    const pc = this.col();
    if (this.moveH(this.dir * START_DX[this.t])) return this.set('bump');
    if (!this.checkFooting(pc, true)) return;
    if (this.t >= START_DX.length - 1) {
      this.runPhase = 2 / 8; // continue the stride where the start-up frames left off
      this.set('run');
    }
  }

  s_run(inp) {
    if (this.canEngage()) return this.engarde();
    if (inp.up || this.jumpQueued) {
      this.jumpQueued = false;
      return this.set('runjump');
    }
    if (this.back(inp)) return this.set('runturn');
    if (!this.fwd(inp) || inp.down) return this.set('stop');
    const pc = this.col();
    if (this.moveH(this.dir * RUN_DX)) return this.set('bump');
    this.runPhase = (this.runPhase + 1 / 8) % 1;
    this.checkFooting(pc, true);
  }

  s_stop() {
    const pc = this.col();
    this.moveH(this.dir * (STOP_DX[this.t] ?? 0));
    if (!this.checkFooting(pc, true)) return;
    if (this.t >= STOP_DX.length - 1) this.set('stand');
  }

  s_runturn(inp) {
    const pc = this.col();
    this.moveH(this.dir * (RUNTURN_DX[this.t] ?? 0));
    if (!this.checkFooting(pc, true)) return;
    if (this.t === 3) this.dir = -this.dir;
    if (this.t >= 4) this.set(this.fwd(inp) ? 'startrun' : 'stand');
  }

  s_bump() {
    if (this.t === 0) {
      this.game.sfx('bump');
      this.moveH(-this.dir * 3);
    }
    if (this.t >= 2) this.set('stand');
  }

  s_runjump(inp) {
    const i = this.t;
    const n = RUNJUMP_DX.length;
    const hit = this.moveH(this.dir * RUNJUMP_DX[i]);
    this.yOff = -Math.sin((Math.PI * (i + 1)) / n) * 12;
    if (hit) return this.startFall(0);
    if (i >= n - 1) this.landJump(inp, true);
  }

  s_standjump(inp) {
    const i = this.t;
    const hit = this.moveH(this.dir * STANDJUMP_DX[i]);
    this.yOff = i >= 3 && i <= STANDJUMP_LAND ? -Math.sin((Math.PI * (i - 2)) / (STANDJUMP_LAND - 1)) * 10 : 0;
    if (hit && i >= 3) return this.startFall(0);
    if (i === STANDJUMP_LAND && !this.landJump(inp, false)) return;
    if (i >= STANDJUMP_DX.length - 1) this.set('stand');
  }

  s_jumpup() {
    this.yOff = JUMPUP_DY[this.t] ?? 0;
    if (this.t === 3) this.level.knock(this.col(), this.row - 1);
    if (this.t >= JUMPUP_DY.length - 1) {
      this.yOff = 0;
      this.set('stand');
    }
  }

  s_jumpgrab() {
    if (this.t >= 4) {
      this.game.sfx('grab');
      this.hangFrom(this.edgeX, this.ledgeRow, this.dir);
    }
  }

  s_hang(inp) {
    const lc = this.dir > 0 ? colOf(this.edgeX) : colOf(this.edgeX) - 1;
    if (!this.level.standable(lc, this.ledgeRow)) return this.dropFromHang();
    if (inp.up) return this.set('climb');
    if (inp.down || inp.actionP) this.dropFromHang();
  }

  dropFromHang() {
    this.row = this.ledgeRow;
    this.y = floorY(this.ledgeRow) + HANG_DROP;
    this.startFall(0, this.ledgeRow);
  }

  s_climb() {
    if (this.t >= 8) {
      this.row = this.ledgeRow;
      this.y = floorY(this.ledgeRow);
      this.x = this.edgeX + this.dir * 8;
      this.set('standup');
    }
  }

  s_climbdown() {
    if (this.t >= 6) this.hangFrom(this.edgeX, this.ledgeRow, this.dir);
  }

  s_fall(inp) {
    const L = this.level;
    const y0 = this.y;
    this.vy = Math.min(this.vy + FALL_ACCEL, FALL_MAX);
    const y1 = y0 + this.vy;
    if (this.dx && this.moveH(this.dx)) this.dx = 0;
    const c = this.col();

    // Hold UP or ACTION to catch a ledge on the way down.
    if (inp.up || inp.action) {
      for (let lr = 0; lr < L.rows; lr++) {
        const hy = floorY(lr) + HANG_DROP;
        if (hy <= y0 || hy > y1 || L.tile(c, lr).t !== T.EMPTY) continue;
        for (const d of [this.dir, -this.dir]) {
          const edge = d > 0 ? (c + 1) * TILE_W : c * TILE_W;
          if (L.standable(c + d, lr) && Math.abs(edge - this.x) <= 18) {
            this.game.sfx('grab');
            this.hangFrom(edge, lr, d);
            return;
          }
        }
      }
    }

    for (let rr = Math.max(0, rowOf(y0)); rr <= rowOf(y1); rr++) {
      const fy = floorY(rr);
      if (fy < y0 || fy > y1 || !L.standable(c, rr)) continue;
      this.y = fy;
      this.row = rr;
      return this.land(rr - this.fallFrom);
    }

    this.y = y1;
    this.row = Math.max(this.row, rowOf(y1 - 1));
    if (y1 > L.rows * 63 + 60) this.die('fall');
  }

  land(rows) {
    const L = this.level;
    this.yOff = 0;
    this.dx = 0;
    if (L.tile(this.col(), this.row).t === T.SPIKES) return this.die('spikes');
    if (rows >= 3) {
      this.game.sfx('thud');
      return this.die('fall');
    }
    if (rows === 2) {
      this.game.sfx('thud');
      if (this.hurt()) this.set('landhard');
      return;
    }
    this.game.sfx('land');
    this.set('land');
  }

  s_land(inp) {
    if (this.t >= 2) this.set(inp.down ? 'crouch' : 'standup');
  }

  s_landhard() {
    if (this.t >= 6) this.set('standup');
  }

  s_crouch(inp) {
    if (!this.supported()) return this.startFall(0);
    if (!inp.down) return this.set('standup');
    if (this.fwd(inp) && this.t > 1) this.set('crouchhop');
  }

  s_crouchhop() {
    const pc = this.col();
    this.moveH(this.dir * 3);
    if (!this.checkFooting(pc, false)) return;
    if (this.t >= 2) this.set('crouch');
  }

  s_standup() {
    if (this.t >= 2) this.set('stand');
  }

  s_step() {
    if (this.t < 5 && this.stepDist) this.moveH((this.dir * this.stepDist) / 5);
    if (!this.supported()) return this.startFall(0);
    if (this.t >= 5) this.set('stand');
  }

  s_drink() {
    if (this.t === 4) {
      const L = this.level;
      const tl = L.tile(this.col(), this.row);
      if (tl.t === T.POTION) {
        if (tl.kind === 'life') {
          this.maxHp = Math.min(10, this.maxHp + 1);
          this.hp = this.maxHp;
        } else {
          this.hp = Math.min(this.maxHp, this.hp + 1);
        }
        L.setTile(this.col(), this.row, { t: T.FLOOR });
        this.game.potionFx(tl.kind);
      }
    }
    if (this.t >= 8) this.set('stand');
  }

  s_pickup() {
    if (this.t === 3) {
      const L = this.level;
      if (L.tile(this.col(), this.row).t === T.SWORD) {
        this.hasSword = true;
        L.setTile(this.col(), this.row, { t: T.FLOOR });
        this.game.sfx('sword');
      }
    }
    if (this.t >= 7) this.set('stand');
  }

  s_exit() {
    const L = this.level;
    // Walk into the doorway, then up the stairs.
    let c = this.col();
    if (L.tile(c, this.row).half === 1) c--;
    const target = c * TILE_W + TILE_W;
    this.x += Math.sign(target - this.x) * Math.min(3, Math.abs(target - this.x));
    if (this.t >= 15) this.game.win();
  }

  s_dead() {}

  // ---- sword fighting ------------------------------------------------------

  s_engarde() {
    if (this.t >= 3) this.set('fight');
  }

  s_fight(inp) {
    const g = this.enemy();
    if (!this.supported()) return this.startFall(0);
    if (!g || Math.abs(g.x - this.x) > 110) return this.set('sheathe');
    this.dir = g.x > this.x ? 1 : -1;
    if (inp.actionP) return this.set('strike');
    if (inp.upP) return this.set('parry');
    if (inp.down) return this.set('sheathe');
    if (this.fwd(inp)) return this.set('advance');
    if (this.back(inp)) this.set('retreat');
  }

  s_advance() {
    this.moveH(this.dir * 5);
    if (!this.supported()) return this.startFall(this.dir * 2);
    if (this.t >= 2) this.set('fight');
  }

  s_retreat() {
    this.moveH(-this.dir * 5);
    if (!this.supported()) return this.startFall(-this.dir * 2);
    if (this.t >= 2) this.set('fight');
  }

  s_strike() {
    if (this.t === 1) this.moveH(this.dir * 3);
    if (this.t === 2) this.game.resolveStrike(this, this.enemy());
    if (this.t >= 5 && this.state === 'strike') this.set('fight');
  }

  s_parry() {
    if (this.t >= 4) this.set('fight');
  }

  s_blocked() {
    if (this.t < 2) this.moveH(-this.dir * 2);
    if (this.t >= 3) this.set('fight');
  }

  s_hurt() {
    if (this.t < 2) this.moveH(-this.dir * 3);
    if (!this.supported()) return this.startFall(-this.dir * 2);
    if (this.t >= 3) this.set(this.hasSword && this.enemy() ? 'fight' : 'stand');
  }

  s_sheathe() {
    if (this.t >= 3) {
      this.noEngage = 30;
      this.set('stand');
    }
  }
}
