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

test('falling three floors is fatal, one floor is safe', () => {
  const game = newGame();
  const p = game.prince;
  p.startFall(0, p.row);
  p.fallFrom = p.row - 3;
  const { until } = driver(game);
  // Force a landing on the current floor from "three rows up".
  until({}, () => p.state !== 'fall', 20);
  assert.equal(p.state, 'dead');

  const g2 = newGame();
  const d2 = driver(g2);
  d2.settle();
  // Walk off the loose-floor hole: stand on the loose tile until it drops.
  g2.prince.x = 6 * TILE_W + 16;
  d2.until({}, () => g2.prince.state === 'fall', 30, 'loose floor to drop');
  d2.until({}, () => g2.prince.state !== 'fall', 30, 'landing');
  assert.ok(g2.prince.alive);
  assert.equal(g2.prince.row, 3);
  assert.equal(g2.prince.hp, 3);
});

test('running onto spikes kills, stepping carefully does not', () => {
  const game = newGame();
  const { tick, settle, until } = driver(game);
  const p = game.prince;
  settle();
  p.x = 20 * TILE_W + 16;
  until({ right: true }, () => !p.alive || p.col() >= 23, 60, 'run into spikes');
  assert.equal(p.state, 'dead');
  assert.equal(p.deathCause, 'spikes');

  const g2 = newGame();
  const d2 = driver(g2);
  d2.settle();
  g2.prince.x = 21 * TILE_W + 16;
  g2.guards.length = 0;
  for (let i = 0; i < 8; i++) {
    d2.until({ right: true, action: true }, () => g2.prince.state === 'step', 5, 'step');
    d2.settle();
  }
  assert.ok(g2.prince.alive);
  assert.ok(g2.prince.col() >= 23, `crossed spikes (col ${g2.prince.col()})`);
  void tick;
});

test('the whole level can be completed', () => {
  const game = newGame();
  const p = game.prince;
  const { tick, until, settle } = driver(game);
  settle();

  // 1. Run right across the loose floor and leap the two-tile gap.
  until({ right: true }, () => p.x >= 392, 100, 'run to gap');
  until({ right: true, up: true }, () => p.state === 'runjump', 3, 'take off');
  until({ right: true }, () => p.state !== 'runjump', 20, 'land jump');
  settle();
  assert.equal(p.row, 2, 'still on the upper floor');
  assert.ok(p.col() >= 15, `cleared the gap (col ${p.col()})`);

  // 2. Step under the alcove, jump up, grab the ledge and climb.
  while (p.col() < 16) {
    until({ right: true, action: true }, () => p.state === 'step', 5, 'step');
    settle();
  }
  until({ up: true }, () => p.state === 'hang', 20, 'grab ledge');
  until({ up: true }, () => p.state === 'standup', 20, 'climb');
  settle();
  assert.equal(p.row, 1);

  // 3. Take the sword.
  while (p.col() < 18) {
    until({ right: true, action: true }, () => p.state === 'step', 5, 'step to sword');
    settle();
  }
  until({ action: true }, () => p.hasSword, 20, 'pick up sword');
  settle();

  // 4. Climb back down to the corridor.
  until({ left: true }, () => p.dir < 0, 10, 'turn');
  settle();
  while (p.x - 17 * TILE_W > 12) {
    until({ left: true, action: true }, () => p.state === 'step', 5, 'step to edge');
    settle();
  }
  until({ down: true }, () => p.state === 'hang', 20, 'climb down');
  until({ down: true }, () => p.state !== 'hang', 5, 'let go');
  until({}, () => p.state !== 'fall', 20, 'drop');
  settle();
  assert.equal(p.row, 2);

  // 5. Walk to the spikes and step carefully across them.
  until({ right: true }, () => p.x >= 21 * TILE_W + 8, 100, 'reach spikes');
  settle();
  while (p.col() < 23 && p.state !== 'engarde' && p.state !== 'fight') {
    until({ right: true, action: true }, () => p.state !== 'stand', 5, 'step over spikes');
    until({}, () => p.state === 'stand' || p.state === 'fight', 20, 'finish step');
  }

  // 6. Duel the guard: parry his strikes, strike back.
  const guard = game.guards[0];
  for (let i = 0; i < 1500 && guard.alive; i++) {
    assert.ok(p.alive, `prince died in the fight (${p.deathCause})`);
    const d = Math.abs(guard.x - p.x);
    if (p.state !== 'fight') tick({});
    else if (guard.state === 'strike' && guard.t >= 1 && guard.t <= 3) tick({ up: true });
    else if (d > 40) tick({ right: true });
    else tick({ action: true });
  }
  assert.ok(!guard.alive, 'guard defeated');
  until({}, () => p.state === 'stand', 60, 'sheathe');

  // 7. Heal at the potion, then drop down the hole beside the exit.
  while (p.col() < 27) {
    until({ right: true, action: true }, () => p.state === 'step', 5, 'step to potion');
    settle();
  }
  until({ action: true }, () => p.state === 'drink', 5, 'drink');
  settle();
  until({ right: true }, () => p.state === 'fall', 100, 'walk into the hole');
  until({}, () => p.state !== 'fall', 20, 'drop to lower corridor');
  settle();
  assert.equal(p.row, 3);
  assert.ok(p.alive);

  // 8. Go left over the gate plate, through the gate, carefully across the
  //    spikes, to the exit plate.
  until({ left: true }, () => p.col() <= 27, 100, 'through the gate');
  until({}, () => p.state === 'stand', 20);
  while (p.col() > 25) {
    until({ left: true, action: true }, () => p.state === 'step', 8, 'step left over spikes');
    settle();
  }
  until({ left: true }, () => p.col() <= 21, 100, 'run to the plates');
  settle();
  assert.ok(game.level.exitOpening, 'exit plate pressed');

  // 9. Back through the gate and climb up beside the exit.
  until({ right: true }, () => p.col() >= 25, 100, 'run back to spikes');
  settle();
  while (p.col() < 27) {
    until({ right: true, action: true }, () => p.state === 'step', 8, 'step right over spikes');
    settle();
  }
  until({ right: true }, () => p.x >= 33 * TILE_W + 16, 100, 'back to the hole');
  settle();
  until({ up: true }, () => p.state === 'hang', 20, 'grab ledge by exit');
  until({ up: true }, () => p.state === 'standup', 20, 'climb up');
  settle();
  assert.equal(p.row, 2);

  // 10. Walk into the open exit.
  until({ right: true }, () => p.col() >= 36, 60, 'reach the exit');
  settle();
  until({}, () => game.level.exitOpen >= 1, 200, 'door to open');
  until({ up: true }, () => game.mode === 'won', 60, 'leave the level');
  assert.equal(game.mode, 'won');
  assert.ok(colOf(p.x) >= 36);
});
