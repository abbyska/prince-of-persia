import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LEVEL1 } from '../src/level1.js';
import { TILE_W, colOf } from '../src/constants.js';

const NONE = { left: false, right: false, up: false, down: false, action: false };

// Drives the game one tick at a time with a held-button input.
function driver(game) {
  let prev = { ...NONE };
  const tick = (held = {}) => {
    const inp = { ...NONE, ...held };
    for (const k of Object.keys(NONE)) inp[k + 'P'] = inp[k] && !prev[k];
    prev = inp;
    game.tick(inp);
  };
  const until = (held, cond, max = 400, what = 'condition') => {
    for (let i = 0; i < max; i++) {
      if (cond()) return;
      tick(held);
    }
    const p = game.prince;
    throw new Error(`timed out waiting for ${what}: state=${p.state} x=${p.x.toFixed(1)} row=${p.row} hp=${p.hp}`);
  };
  const settle = () => until({}, () => game.prince.state === 'stand', 60, 'stand');
  return { tick, until, settle };
}

function newGame() {
  const game = new Game(LEVEL1);
  game.begin();
  return game;
}

test('level map is a whole number of 10x3 rooms', () => {
  assert.equal(LEVEL1.map.length % 3, 0);
  for (const row of LEVEL1.map) assert.equal(row.length, LEVEL1.map[0].length);
  assert.equal(LEVEL1.map[0].length % 10, 0);
});

test('running right stays inside the level and on the floor', () => {
  const game = newGame();
  const { tick, settle } = driver(game);
  settle();
  const p = game.prince;
  for (let i = 0; i < 12; i++) tick({ right: true });
  assert.ok(p.x > 100, `moved right (x=${p.x})`);
  assert.equal(p.row, 2);
  assert.ok(p.alive);
});

test('game speed does not depend on anything but ticks', () => {
  const a = newGame();
  const b = newGame();
  const da = driver(a);
  const db = driver(b);
  for (let i = 0; i < 20; i++) {
    da.tick({ right: true });
    db.tick({ right: true });
  }
  assert.equal(a.prince.x, b.prince.x);
});

test('the Prince drops into the cell without harm', () => {
  const game = newGame();
  const { settle } = driver(game);
  assert.equal(game.prince.state, 'fall');
  settle();
  assert.equal(game.prince.row, 2);
  assert.equal(game.prince.hp, 3);
});

test('falling three floors is fatal, one floor is safe', () => {
  const game = newGame();
  const { settle, until } = driver(game);
  settle();
  const p = game.prince;
  p.startFall(0, p.row);
  p.fallFrom = p.row - 3;
  until({}, () => p.state !== 'fall', 20);
  assert.equal(p.state, 'dead');

  // Stand on a loose floor until it gives way: one floor down is safe.
  const g2 = newGame();
  const d2 = driver(g2);
  d2.settle();
  g2.guards.length = 0;
  g2.prince.x = 12 * TILE_W + 16;
  d2.until({}, () => g2.prince.state === 'fall', 30, 'loose floor to drop');
  d2.until({}, () => g2.prince.state !== 'fall', 30, 'landing');
  assert.ok(g2.prince.alive);
  assert.equal(g2.prince.row, 3);
  assert.equal(g2.prince.hp, 3);
});

test('a short jump only catches the ledge when UP is held', () => {
  for (const hold of [false, true]) {
    const game = newGame();
    const { settle, until } = driver(game);
    settle();
    const p = game.prince;
    // Standing jump from the middle of the tile before the two-tile gap.
    p.x = 15 * TILE_W + 28;
    until({ right: true, up: true }, () => p.state === 'standjump', 3);
    until(hold ? { up: true } : {}, () => p.state === 'hang' || p.state === 'fall' || p.state === 'stand', 20);
    assert.equal(p.state, hold ? 'hang' : 'fall');
  }
});

test('running onto spikes kills, stepping carefully does not', () => {
  const place = (game) => {
    const p = game.prince;
    p.row = 1;
    p.y = 1 * 63 + 55;
    p.x = 22 * TILE_W + 16;
    p.dir = 1;
    p.set('stand');
  };
  const game = newGame();
  const { settle, until } = driver(game);
  settle();
  place(game);
  until({ right: true }, () => !game.prince.alive || game.prince.col() >= 27, 60, 'run into spikes');
  assert.equal(game.prince.deathCause, 'spikes');

  const g2 = newGame();
  const d2 = driver(g2);
  d2.settle();
  place(g2);
  for (let i = 0; i < 20 && g2.prince.col() < 26; i++) {
    d2.until({ right: true, action: true }, () => g2.prince.state === 'step', 5, 'step');
    d2.settle();
  }
  assert.ok(g2.prince.alive);
  assert.ok(g2.prince.col() >= 26, `crossed spikes (col ${g2.prince.col()})`);
});

test('the whole level can be completed', () => {
  const game = newGame();
  const p = game.prince;
  const { tick, until, settle } = driver(game);
  const stepTo = (col, dir) => {
    const key = dir > 0 ? 'right' : 'left';
    for (let i = 0; i < 20 && (dir > 0 ? p.col() < col : p.col() > col); i++) {
      until({ [key]: true, action: true }, () => p.state === 'step' || p.state === 'turn', 5, `step to ${col}`);
      settle();
    }
  };
  settle();

  // 1. The cell: step on the plate and wait for the gate.
  stepTo(4, 1);
  until({}, () => !game.level.gateClosed(6, 2), 40, 'cell gate to open');

  // 2. Run over the loose floors and leap the gap.
  until({ right: true }, () => p.x >= 15 * TILE_W - 2, 100, 'run to the gap');
  until({ right: true, up: true }, () => p.state === 'runjump', 6, 'take off');
  until({ right: true }, () => p.state !== 'runjump', 20, 'land the jump');
  settle();
  assert.equal(p.row, 2);
  assert.ok(p.col() >= 18, `cleared the gap (col ${p.col()})`);

  // 3. Climb to the ledge.
  stepTo(21, 1);
  until({ up: true }, () => p.state === 'hang', 20, 'grab the ledge');
  until({ up: true }, () => p.state === 'standup', 20, 'climb');
  settle();
  assert.equal(p.row, 1);

  // 4. Potion, spikes, sword.
  stepTo(23, 1);
  until({ action: true }, () => p.state === 'drink', 5, 'drink');
  settle();
  stepTo(28, 1);
  until({ action: true }, () => p.hasSword, 20, 'take the sword');
  settle();

  // 5. Drop down to the guard's corridor.
  until({ right: true }, () => p.state === 'fall', 30, 'walk off the ledge');
  until({}, () => p.state !== 'fall', 20, 'land');
  settle();
  assert.equal(p.row, 2);
  assert.equal(p.hp, 3);

  // 6. Duel the guard: parry his strikes, strike back.
  const guard = game.guards[0];
  for (let i = 0; i < 2000 && guard.alive; i++) {
    assert.ok(p.alive, `prince died in the fight (${p.deathCause})`);
    const d = Math.abs(guard.x - p.x);
    if (p.state === 'stand') tick({ right: true });
    else if (p.state !== 'fight') tick({});
    else if (guard.state === 'strike' && guard.t >= 1 && guard.t <= 3) tick({ up: true });
    else if (d > 40) tick({ right: true });
    else tick({ action: true });
  }
  assert.ok(!guard.alive, 'guard defeated');
  until({}, () => p.state === 'stand', 60, 'sheathe');

  // 7. Fall through the hole by the exit.
  until({ right: true }, () => p.state === 'fall', 120, 'walk into the hole');
  until({}, () => p.state !== 'fall', 20, 'drop to the passage');
  settle();
  assert.equal(p.row, 3);

  // 8. Through the gate to the exit plate, and back.
  until({ left: true }, () => p.col() <= 36, 80, 'reach the exit plate');
  settle();
  assert.ok(game.level.exitOpening, 'exit plate pressed');
  until({ right: true }, () => p.x >= 41 * TILE_W + 16, 80, 'back under the hole');
  settle();

  // 9. Climb up beside the exit and leave.
  until({ up: true }, () => p.state === 'hang', 20, 'grab the ledge');
  until({ up: true }, () => p.state === 'standup', 20, 'climb up');
  settle();
  assert.equal(p.row, 2);
  until({ right: true }, () => p.col() >= 45, 60, 'reach the exit');
  settle();
  until({}, () => game.level.exitOpen >= 1, 200, 'door to open');
  until({ up: true }, () => game.mode === 'won', 60, 'leave the level');
  assert.equal(game.mode, 'won');
});
