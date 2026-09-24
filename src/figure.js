import { floorY } from './constants.js';

// Characters are drawn from a small skeleton. Every move is a sequence of
// hand-made key poses shown one per game tick (12 a second), like the
// original's frame-by-frame animation, rather than a smooth blend.
//
// Angles are in radians. Legs and arms: 0 = straight down, positive = swung
// forward (towards the facing direction), PI = straight up. The second number
// is the bend at the knee (backwards) or elbow (forwards). `sword` is the blade
// angle: 0 = level, negative = raised. `lift` raises the whole body.

const THIGH = 12;
const SHIN = 12;
const TORSO = 15;
const UPPER_ARM = 8;
const FOREARM = 7;

export const KEYS = ['hip', 'neck', 'sh', 'head', 'k1', 'f1', 'k2', 'f2', 'e1', 'w1', 'e2', 'w2'];

const pose = (lean, legs, arms, sword) => ({ lean, legs, arms, sword });

export const POSES = {
  stand: pose(0.03, [[0.1, 0.06], [-0.1, 0.05]], [[0.08, 0.2], [-0.06, 0.15]]),
  turnA: pose(0, [[0.05, 0.1], [-0.05, 0.1]], [[0.5, 1.5], [0.45, 1.6]]),
  turnB: pose(0.05, [[0.2, 0.2], [-0.1, 0.1]], [[0.2, 0.8], [-0.2, 0.6]]),
  bump: pose(-0.3, [[0.3, 0.1], [-0.1, 0.4]], [[-0.6, 0.6], [0.6, 0.5]]),
  startA: pose(0.1, [[0.35, 0.6], [-0.08, 0.08]], [[-0.2, 0.5], [0.25, 0.6]]),
  startB: pose(0.18, [[0.65, 0.25], [-0.3, 0.4]], [[-0.4, 0.8], [0.5, 1.0]]),
  skidA: pose(0, [[0.55, 0.2], [-0.2, 0.7]], [[-0.3, 0.6], [0.4, 0.9]]),
  skidB: pose(-0.25, [[0.75, 0.1], [0.15, 1.1]], [[-0.7, 0.4], [0.9, 0.6]]),
  skidC: pose(-0.1, [[0.35, 0.15], [0, 0.5]], [[-0.2, 0.3], [0.3, 0.4]]),
  crouchPrep: pose(0.25, [[0.6, 1.1], [0.4, 1.0]], [[-0.5, 0.4], [-0.3, 0.5]]),
  crouchDeep: pose(0.5, [[1.1, 2.0], [0.9, 1.9]], [[-0.9, 0.3], [-0.7, 0.4]]),
  crouch: pose(0.6, [[1.45, 2.5], [1.05, 2.35]], [[0.8, 0.5], [0.5, 0.6]]),
  landHard: pose(0.9, [[1.4, 2.6], [1.1, 2.5]], [[1.0, 0.1], [0.8, 0.2]]),
  pushOff: pose(0.35, [[0.25, 0.15], [-0.45, 0.2]], [[2.2, 0.3], [1.8, 0.4]]),
  airStretch: pose(0.3, [[0.9, 0.4], [-0.7, 0.5]], [[2.3, 0.2], [1.6, 0.5]]),
  airTuck: pose(0.35, [[1.3, 1.4], [0.8, 1.6]], [[1.8, 0.5], [1.3, 0.7]]),
  reachDown: pose(0.25, [[0.9, 0.5], [0.3, 0.9]], [[1.2, 0.6], [0.8, 0.8]]),
  landCrouch: pose(0.6, [[1.3, 2.3], [1.0, 2.2]], [[0.9, 0.5], [0.6, 0.6]]),
  takeoff: pose(0.35, [[0.35, 0.2], [-0.75, 0.35]], [[1.4, 0.6], [-0.8, 0.5]]),
  leapA: pose(0.3, [[1.15, 0.25], [-0.95, 0.5]], [[2.1, 0.3], [-1.2, 0.4]]),
  leap: pose(0.25, [[1.3, 0.2], [-1.1, 0.45]], [[2.3, 0.2], [-1.3, 0.4]]),
  leapB: pose(0.25, [[1.2, 0.5], [-0.8, 0.9]], [[2.0, 0.4], [-1.0, 0.6]]),
  descendA: pose(0.25, [[0.95, 0.4], [-0.5, 1.1]], [[1.6, 0.6], [-0.6, 0.8]]),
  descendB: pose(0.22, [[0.8, 0.3], [-0.3, 1.0]], [[1.2, 0.7], [-0.4, 0.8]]),
  landReach: pose(0.2, [[0.7, 0.2], [-0.4, 0.7]], [[0.8, 0.8], [-0.3, 0.8]]),
  armsUp: pose(0, [[0.1, 0.15], [-0.1, 0.25]], [[3.0, 0], [2.9, 0.05]]),
  armsUpBent: pose(0, [[0.3, 0.6], [0.1, 0.5]], [[2.9, 0.1], [2.8, 0.15]]),
  hang: pose(0.05, [[0.12, 0.15], [-0.1, 0.35]], [[3.1, 0], [3.0, 0]]),
  pull: pose(0.15, [[0.25, 0.4], [-0.05, 0.6]], [[2.4, 1.1], [2.3, 1.2]]),
  chin: pose(0.45, [[0.6, 1.2], [0.1, 0.7]], [[1.5, 1.9], [1.4, 2.0]]),
  kneeUp: pose(0.9, [[1.7, 2.7], [-0.1, 0.9]], [[1.1, 0.4], [0.9, 0.6]]),
  fallA: pose(-0.05, [[0.35, 0.7], [-0.25, 0.3]], [[2.7, 0.3], [2.2, 0.6]]),
  fallB: pose(0, [[0.1, 0.4], [0.25, 0.9]], [[2.3, 0.5], [2.8, 0.2]]),
  stepLift: pose(0.05, [[0.45, 0.9], [-0.05, 0.08]], [[0.2, 0.4], [-0.15, 0.3]]),
  stepReach: pose(0.05, [[0.6, 0.35], [-0.15, 0.1]], [[0.25, 0.4], [-0.2, 0.3]]),
  stepPlace: pose(0.08, [[0.4, 0.1], [-0.35, 0.2]], [[0.2, 0.3], [-0.2, 0.3]]),
  stepShift: pose(0.1, [[0.15, 0.05], [-0.45, 0.5]], [[0.1, 0.3], [-0.1, 0.3]]),
  stepBring: pose(0.05, [[0.1, 0.05], [0.1, 0.9]], [[0.05, 0.2], [0, 0.2]]),
  drinkLift: pose(0, [[0.1, 0.06], [-0.1, 0.05]], [[0.8, 1.6], [-0.1, 0.2]]),
  drink: pose(-0.1, [[0.1, 0.06], [-0.1, 0.05]], [[1.1, 2.7], [-0.1, 0.2]]),
  drinkTilt: pose(-0.22, [[0.12, 0.06], [-0.12, 0.05]], [[1.3, 2.6], [-0.2, 0.2]]),
  reachFloor: pose(0.8, [[1.4, 2.5], [1.0, 2.4]], [[1.2, 0.1], [0.6, 0.5]]),
  kneel: pose(0.3, [[1.3, 2.5], [1.0, 2.5]], [[0.4, 0.3], [0.2, 0.3]]),
  slump: pose(1.0, [[1.3, 2.5], [1.0, 2.5]], [[0.9, 0.2], [0.6, 0.3]]),
  fight: pose(0.12, [[0.45, 0.35], [-0.4, 0.25]], [[1.2, 0.35], [-2.3, 0.7]], -0.35),
  advanceA: pose(0.14, [[0.6, 0.3], [-0.35, 0.25]], [[1.2, 0.35], [-2.3, 0.7]], -0.35),
  advanceB: pose(0.12, [[0.4, 0.35], [-0.2, 0.35]], [[1.2, 0.35], [-2.3, 0.7]], -0.35),
  retreatA: pose(0.08, [[0.4, 0.35], [-0.6, 0.2]], [[1.2, 0.35], [-2.3, 0.7]], -0.35),
  retreatB: pose(0.1, [[0.25, 0.3], [-0.45, 0.25]], [[1.2, 0.35], [-2.3, 0.7]], -0.35),
  windup: pose(-0.05, [[0.4, 0.35], [-0.45, 0.25]], [[2.4, 0.9], [-2.3, 0.7]], -1.9),
  lunge: pose(0.2, [[0.7, 0.3], [-0.6, 0.15]], [[1.9, 0.3], [-2.1, 0.6]], -0.8),
  strike: pose(0.3, [[0.85, 0.3], [-0.7, 0.1]], [[1.57, 0], [-1.9, 0.5]], 0),
  parry: pose(0.02, [[0.35, 0.3], [-0.4, 0.25]], [[1.9, 1.0], [-2.3, 0.7]], -1.45),
  hurt: pose(-0.35, [[0.3, 0.4], [-0.2, 0.2]], [[0.9, 0.5], [-0.6, 0.4]], 0.5),
  guardIdle: pose(0.03, [[0.1, 0.06], [-0.1, 0.05]], [[0.4, 0.4], [-0.06, 0.15]], 1.1),
};

// Run cycle: four key poses for each stride (contact, down, passing, flight),
// then the same with the legs and arms swapped.
const RUN_HALF = [
  { lean: 0.22, a: [0.7, 0.15], b: [-0.55, 0.55], an: [-0.65, 0.9], af: [0.75, 1.3] },
  { lean: 0.28, a: [0.3, 0.55], b: [-0.5, 1.7], an: [-0.35, 1.0], af: [0.45, 1.2] },
  { lean: 0.25, a: [-0.05, 0.25], b: [0.45, 1.9], an: [0.05, 1.0], af: [0.05, 1.0] },
  { lean: 0.22, a: [-0.5, 0.4], b: [1.0, 1.3], an: [0.7, 1.3], af: [-0.6, 0.9], lift: 2 },
];

export function runFrame(i) {
  const k = ((i % 8) + 8) % 8;
  const F = RUN_HALF[k % 4];
  const first = k < 4;
  return {
    lean: F.lean,
    legs: first ? [F.a, F.b] : [F.b, F.a],
    arms: first ? [F.an, F.af] : [F.af, F.an],
    lift: F.lift || 0,
  };
}

function rig(p) {
  const lean = p.lean || 0;
  const limb = (base, a, b, l1, l2, bendSign) => {
    const j = [base[0] + Math.sin(a) * l1, base[1] + Math.cos(a) * l1];
    const a2 = a + bendSign * b;
    return [j, [j[0] + Math.sin(a2) * l2, j[1] + Math.cos(a2) * l2]];
  };
  const hip = [0, 0];
  const neck = [Math.sin(lean) * TORSO, -Math.cos(lean) * TORSO];
  const sh = [neck[0] * 0.82, neck[1] * 0.82];
  const [k1, f1] = limb(hip, p.legs[0][0], p.legs[0][1], THIGH, SHIN, -1);
  const [k2, f2] = limb(hip, p.legs[1][0], p.legs[1][1], THIGH, SHIN, -1);
  const [e1, w1] = limb(sh, p.arms[0][0], p.arms[0][1], UPPER_ARM, FOREARM, 1);
  const [e2, w2] = limb(sh, p.arms[1][0], p.arms[1][1], UPPER_ARM, FOREARM, 1);
  const head = [neck[0] + Math.sin(lean) * 3, neck[1] - 5];
  return { hip, neck, sh, head, k1, f1, k2, f2, e1, w1, e2, w2 };
}

// Places a pose in the world. Anchors: 'feet' (the lowest foot rests on x,y),
// 'hands' (the highest hand is at x,y) or 'hip' (the hip is at x,y).
export function place(p, x, y, dir, anchor = 'feet', yOff = 0) {
  const r = rig(p);
  let ox = 0;
  let oy = 0;
  if (anchor === 'hands') {
    const w = r.w1[1] < r.w2[1] ? r.w1 : r.w2;
    ox = -w[0];
    oy = -w[1];
  } else if (anchor === 'feet') {
    oy = -Math.max(r.f1[1], r.f2[1]) - (p.lift || 0);
  }
  const J = { dir, sword: p.sword };
  for (const k of KEYS) J[k] = [x + (r[k][0] + ox) * dir, y + r[k][1] + oy + yOff];
  return J;
}

export function lerpJ(a, b, k) {
  k = Math.max(0, Math.min(1, k));
  const J = { dir: k < 0.5 ? a.dir : b.dir };
  for (const key of KEYS) J[key] = [a[key][0] + (b[key][0] - a[key][0]) * k, a[key][1] + (b[key][1] - a[key][1]) * k];
  const sa = a.sword ?? b.sword;
  const sb = b.sword ?? a.sword;
  J.sword = sa == null ? undefined : sa + (sb - sa) * k;
  return J;
}

function mixPose(a, b, k) {
  const mix = (x, y) => x + (y - x) * k;
  return {
    lean: mix(a.lean, b.lean),
    legs: a.legs.map((l, i) => [mix(l[0], b.legs[i][0]), mix(l[1], b.legs[i][1])]),
    arms: a.arms.map((l, i) => [mix(l[0], b.arms[i][0]), mix(l[1], b.arms[i][1])]),
    sword: a.sword == null ? b.sword : mix(a.sword, b.sword ?? a.sword),
  };
}

// Flat on the floor, head behind.
function lying(x, y, dir) {
  const r = rig(POSES.stand);
  const J = { dir };
  for (const k of KEYS) J[k] = [x + dir * (r[k][1] + 2), y - 3 - r[k][0] * 0.4];
  return J;
}

// Picks frame t from a list, holding the last one.
const at = (frames, t) => frames[Math.min(Math.max(0, t), frames.length - 1)];

const STANDJUMP = ['crouchPrep', 'crouchDeep', 'pushOff', 'airStretch', 'airTuck', 'airTuck', 'reachDown', 'landCrouch', 'crouch'];
const RUNJUMP = ['takeoff', 'leapA', 'leap', 'leap', 'leapB', 'descendA', 'descendB', 'landReach'];
const JUMPUP = ['crouchPrep', 'crouchDeep', 'armsUp', 'armsUp', 'armsUp', 'armsUpBent', 'landCrouch'];
const STEP = ['stepLift', 'stepReach', 'stepPlace', 'stepShift', 'stepBring', 'stand'];
const DRINK = ['stand', 'drinkLift', 'drink', 'drinkTilt', 'drinkTilt', 'drink', 'drinkLift', 'stand'];
const PICKUP = ['crouchPrep', 'reachFloor', 'reachFloor', 'reachFloor', 'crouch', 'crouchPrep', 'stand'];
const SKID = ['skidA', 'skidB', 'skidC'];

const HANG_HAND = (p) => [p.edgeX - p.dir * 1, floorY(p.ledgeRow) + 1];

// Key configurations of a climb onto the ledge the Prince is holding.
function climbStages(p) {
  const [hx, hy] = HANG_HAND(p);
  const d = p.dir;
  const top = floorY(p.ledgeRow);
  return [
    place(POSES.hang, hx, hy, d, 'hands'),
    place(POSES.pull, hx, hy, d, 'hands'),
    place(POSES.chin, hx, hy, d, 'hands'),
    place(POSES.kneeUp, p.edgeX + d * 1, top - 9, d, 'hip'),
    place(POSES.crouch, p.edgeX + d * 8, top, d),
  ];
}

// Walks a list of key configurations: frame t shows stage t/2, with the odd
// frames halfway between stages.
function stageFrame(stages, t) {
  const s = Math.min(t / 2, stages.length - 1);
  const i = Math.floor(s);
  return s === i ? stages[i] : lerpJ(stages[i], stages[i + 1], 0.5);
}

function death(x, y, dir, t, cause) {
  if (cause === 'spikes' || cause === 'fall' || t >= 2) return lying(x, y, dir);
  return place(t === 0 ? POSES.kneel : POSES.slump, x, y, dir);
}

export function princeJoints(p) {
  const { x, y, dir, t } = p;
  const P = (q, yOff = p.yOff) => place(typeof q === 'string' ? POSES[q] : q, x, y, dir, 'feet', yOff);
  switch (p.state) {
    case 'stand':
      return P('stand');
    case 'turn':
      return P(t === 0 ? 'turnA' : t === 1 ? 'turnB' : 'stand');
    case 'bump':
      return P('bump');
    case 'startrun':
      return P(t === 0 ? POSES.startA : t === 1 ? POSES.startB : runFrame(t - 1));
    case 'run':
      return P(runFrame(Math.floor(p.runPhase * 8)));
    case 'stop':
      return P(at(SKID, t));
    case 'runturn':
      return P(t < 3 ? SKID[t] : t === 3 ? 'turnA' : 'turnB');
    case 'runjump':
      return P(t >= RUNJUMP.length ? runFrame(0) : RUNJUMP[t]);
    case 'standjump':
      return P(t >= STANDJUMP.length ? mixPose(POSES.crouch, POSES.stand, 0.5) : STANDJUMP[t]);
    case 'jumpup':
      return P(at(JUMPUP, t));
    case 'jumpgrab': {
      const [hx, hy] = HANG_HAND(p);
      if (t === 0) return P('crouchDeep', 0);
      if (t === 1) return P('armsUp', -4);
      return lerpJ(P('armsUp', -6), place(POSES.hang, hx, hy, dir, 'hands'), (t - 1) / 3);
    }
    case 'hang': {
      const [hx, hy] = HANG_HAND(p);
      const sway = Math.sin(t * 0.7) * 0.08;
      const h = POSES.hang;
      return place({ ...h, legs: [[h.legs[0][0] + sway, h.legs[0][1]], [h.legs[1][0] - sway, h.legs[1][1]]] }, hx, hy, dir, 'hands');
    }
    case 'climb':
      return stageFrame(climbStages(p), t);
    case 'climbdown':
      return stageFrame(climbStages(p).reverse(), t * 1.4);
    case 'fall':
      return P(t % 4 < 2 ? 'fallA' : 'fallB', 0);
    case 'land':
      return P(t === 0 ? 'crouchDeep' : 'crouch', 0);
    case 'landhard':
      return P(t < 4 ? 'landHard' : 'crouch', 0);
    case 'crouch':
      return P('crouch', 0);
    case 'crouchhop':
      return P('crouch', t === 1 ? -2 : 0);
    case 'standup':
      return P(mixPose(POSES.crouch, POSES.stand, Math.min(1, (t + 1) / 3)), 0);
    case 'step':
      return P(at(STEP, t));
    case 'drink':
      return P(at(DRINK, t));
    case 'pickup':
      return P(at(PICKUP, t));
    case 'exit':
      return P(STEP[t % 5]);
    case 'engarde':
      return P(t === 0 ? POSES.stand : t === 1 ? mixPose(POSES.stand, POSES.fight, 0.5) : POSES.fight);
    case 'fight':
      return P('fight');
    case 'advance':
      return P(t === 0 ? 'advanceA' : t === 1 ? 'advanceB' : 'fight');
    case 'retreat':
      return P(t === 0 ? 'retreatA' : t === 1 ? 'retreatB' : 'fight');
    case 'strike':
      return P(['windup', 'lunge', 'strike', 'strike', mixPose(POSES.strike, POSES.fight, 0.5), 'fight'][Math.min(t, 5)]);
    case 'parry':
      return P('parry');
    case 'blocked':
      return P(mixPose(POSES.fight, POSES.hurt, 0.6));
    case 'hurt':
      return P('hurt');
    case 'sheathe':
      return P(t === 0 ? POSES.fight : t === 1 ? mixPose(POSES.fight, POSES.stand, 0.5) : POSES.stand);
    case 'dead':
      return death(x, y, dir, t, p.deathCause);
  }
  return P('stand');
}

export function guardJoints(g) {
  const P = (q) => place(typeof q === 'string' ? POSES[q] : q, g.x, g.y, g.dir);
  const t = g.t;
  switch (g.state) {
    case 'guard':
      return P('guardIdle');
    case 'advance':
      return P(t === 0 ? 'advanceA' : t === 1 ? 'advanceB' : 'fight');
    case 'retreat':
      return P(t === 0 ? 'retreatA' : t === 1 ? 'retreatB' : 'fight');
    case 'strike':
      return P(
        t < 3 ? mixPose(POSES.fight, POSES.windup, (t + 1) / 3) : ['lunge', 'strike', 'strike', 'fight'][Math.min(t - 3, 3)],
      );
    case 'parry':
      return P('parry');
    case 'hurt':
      return P('hurt');
    case 'blocked':
      return P(mixPose(POSES.fight, POSES.hurt, 0.6));
    case 'dead':
      return death(g.x, g.y, g.dir, t, 'sword');
  }
  return P('fight');
}
