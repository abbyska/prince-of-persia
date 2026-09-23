import { floorY } from './constants.js';

// Characters are drawn from a small skeleton, posed by joint angles and
// interpolated between key poses, which gives the smooth "rotoscoped" motion of
// the original without copying its sprites.
//
// Angles are in radians. Legs and arms: 0 = straight down, positive = swung
// forward (towards the facing direction), PI = straight up. The second number
// is the bend at the knee (backwards) or elbow (forwards). `sword` is the blade
// angle: 0 = level, negative = raised.

const THIGH = 12;
const SHIN = 12;
const TORSO = 15;
const UPPER_ARM = 8;
const FOREARM = 7;

export const KEYS = ['hip', 'neck', 'sh', 'head', 'k1', 'f1', 'k2', 'f2', 'e1', 'w1', 'e2', 'w2'];

export const POSES = {
  stand: { lean: 0.02, legs: [[0.12, 0.08], [-0.12, 0.05]], arms: [[0.1, 0.15], [-0.08, 0.1]] },
  turn: { lean: 0, legs: [[0.02, 0.05], [-0.02, 0.05]], arms: [[0.35, 1.3], [0.3, 1.3]] },
  bump: { lean: -0.25, legs: [[0.25, 0.1], [-0.15, 0.3]], arms: [[-0.4, 0.6], [0.5, 0.4]] },
  crouch: { lean: 0.6, legs: [[1.45, 2.5], [1.05, 2.35]], arms: [[0.8, 0.5], [0.5, 0.6]] },
  skid: { lean: -0.3, legs: [[0.75, 0.1], [0.15, 1.0]], arms: [[-0.6, 0.5], [0.9, 0.7]] },
  reach: { lean: 0.35, legs: [[1.1, 0.5], [-0.75, 1.0]], arms: [[2.1, 0.3], [-0.9, 0.6]] },
  tuck: { lean: 0.3, legs: [[1.3, 1.9], [0.7, 1.8]], arms: [[1.5, 0.8], [1.0, 0.8]] },
  armsUp: { lean: 0, legs: [[0.3, 0.6], [0, 0.4]], arms: [[2.85, 0], [2.75, 0.1]] },
  fall: { lean: -0.05, legs: [[0.35, 0.7], [-0.25, 0.3]], arms: [[2.7, 0.3], [2.45, 0.4]] },
  hang: { lean: 0.05, legs: [[0.12, 0.15], [-0.1, 0.35]], arms: [[3.1, 0], [3.0, 0]] },
  drink: { lean: -0.1, legs: [[0.12, 0.08], [-0.12, 0.05]], arms: [[1.1, 2.7], [-0.1, 0.2]] },
  fight: { lean: 0.12, legs: [[0.45, 0.35], [-0.4, 0.25]], arms: [[1.2, 0.35], [-2.3, 0.7]], sword: -0.35 },
  strike: { lean: 0.3, legs: [[0.85, 0.3], [-0.7, 0.1]], arms: [[1.57, 0], [-1.9, 0.5]], sword: 0 },
  windup: { lean: -0.05, legs: [[0.4, 0.35], [-0.45, 0.25]], arms: [[2.4, 0.9], [-2.3, 0.7]], sword: -1.9 },
  parry: { lean: 0.02, legs: [[0.35, 0.3], [-0.4, 0.25]], arms: [[1.9, 1.0], [-2.3, 0.7]], sword: -1.45 },
  hurt: { lean: -0.35, legs: [[0.3, 0.4], [-0.2, 0.2]], arms: [[0.9, 0.5], [-0.6, 0.4]], sword: 0.5 },
  guardIdle: { lean: 0.02, legs: [[0.12, 0.08], [-0.12, 0.05]], arms: [[0.4, 0.4], [-0.08, 0.1]], sword: 1.1 },
};

export function runPose(phase, amp = 1, lean = 0.22) {
  const a = phase * Math.PI * 2;
  const leg = (off) => {
    const s = Math.sin(a + off);
    const c = Math.cos(a + off);
    return [0.8 * s * amp, (c > 0 ? 0.25 + 1.4 * c : 0.25) * amp + 0.05];
  };
  const s = Math.sin(a) * amp;
  return { lean: lean * amp, legs: [leg(0), leg(Math.PI)], arms: [[-0.8 * s, 0.9], [0.8 * s, 0.9]] };
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

// Places a pose in the world. By default the lowest foot rests on (x, y);
// with anchor 'hands' the highest hand is put at (x, y) instead.
export function place(pose, x, y, dir, anchor = 'feet', yOff = 0) {
  const r = rig(pose);
  let ox = 0;
  let oy;
  if (anchor === 'hands') {
    const w = r.w1[1] < r.w2[1] ? r.w1 : r.w2;
    ox = -w[0];
    oy = -w[1];
  } else {
    oy = -Math.max(r.f1[1], r.f2[1]);
  }
  const J = { dir, sword: pose.sword };
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

function lerpPose(a, b, k) {
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

const HANG_HAND = (p) => [p.edgeX - p.dir * 1, floorY(p.ledgeRow) + 1];

export function princeJoints(p) {
  const { x, y, dir } = p;
  const P = (pose, yOff = p.yOff) => place(pose, x, y, dir, 'feet', yOff);
  const t = p.t;
  switch (p.state) {
    case 'stand':
      return P(POSES.stand);
    case 'turn':
      return P(t === 0 ? POSES.turn : lerpPose(POSES.turn, POSES.stand, 0.5));
    case 'bump':
      return P(POSES.bump);
    case 'startrun':
      return P(runPose(p.runPhase, (t + 1) / 4));
    case 'run':
      return P(runPose(p.runPhase));
    case 'stop':
      return P(POSES.skid);
    case 'runturn':
      return P(t < 3 ? POSES.skid : POSES.turn);
    case 'runjump': {
      const n = 11;
      if (t < 1) return P(runPose(p.runPhase));
      if (t >= n - 2) return P(lerpPose(POSES.reach, POSES.tuck, (t - (n - 2)) / 2));
      return P(lerpPose(POSES.tuck, POSES.reach, Math.min(1, t / 3)));
    }
    case 'standjump':
      if (t < 3) return P(lerpPose(POSES.stand, POSES.crouch, t / 2));
      if (t <= 9) return P(lerpPose(POSES.tuck, POSES.reach, Math.min(1, (t - 3) / 3)));
      return P(POSES.crouch);
    case 'jumpup':
      if (t < 2 || t > 6) return P(POSES.crouch);
      return P(POSES.armsUp);
    case 'jumpgrab': {
      const [hx, hy] = HANG_HAND(p);
      return lerpJ(P(POSES.crouch, 0), place(POSES.hang, hx, hy, dir, 'hands'), t / 5);
    }
    case 'hang': {
      const [hx, hy] = HANG_HAND(p);
      return place(POSES.hang, hx, hy, dir, 'hands');
    }
    case 'climb': {
      const [hx, hy] = HANG_HAND(p);
      const top = place(POSES.crouch, p.edgeX + dir * 8, floorY(p.ledgeRow), dir);
      return lerpJ(place(POSES.hang, hx, hy, dir, 'hands'), top, t / 9);
    }
    case 'climbdown': {
      const [hx, hy] = HANG_HAND(p);
      return lerpJ(P(POSES.crouch, 0), place(POSES.hang, hx, hy, dir, 'hands'), t / 7);
    }
    case 'fall':
      return P(POSES.fall, 0);
    case 'land':
    case 'landhard':
    case 'crouch':
      return P(POSES.crouch, 0);
    case 'crouchhop':
      return P(POSES.crouch, t === 1 ? -2 : 0);
    case 'standup':
      return P(lerpPose(POSES.crouch, POSES.stand, (t + 1) / 3), 0);
    case 'step':
      return P(runPose(Math.min(t, 5) / 10, 0.45, 0.05));
    case 'drink':
      return P(t < 3 ? lerpPose(POSES.stand, POSES.drink, t / 2) : t > 8 ? POSES.stand : POSES.drink);
    case 'pickup':
      return P(t < 6 ? POSES.crouch : POSES.stand);
    case 'exit':
      return P(runPose(t / 8, 0.5, 0.05));
    case 'engarde':
      return P(lerpPose(POSES.stand, POSES.fight, t / 2));
    case 'fight':
      return P(POSES.fight);
    case 'advance':
    case 'retreat':
      return P(lerpPose(POSES.fight, POSES.stand, t === 1 ? 0.3 : 0));
    case 'strike':
      return P(t === 0 ? POSES.windup : t <= 3 ? POSES.strike : POSES.fight);
    case 'parry':
      return P(POSES.parry);
    case 'blocked':
    case 'hurt':
      return P(POSES.hurt);
    case 'sheathe':
      return P(lerpPose(POSES.fight, POSES.stand, t / 2));
    case 'dead':
      return lying(x, y, dir);
  }
  return P(POSES.stand);
}

export function guardJoints(g) {
  const P = (pose) => place(pose, g.x, g.y, g.dir);
  switch (g.state) {
    case 'guard':
      return P(POSES.guardIdle);
    case 'advance':
    case 'retreat':
      return P(lerpPose(POSES.fight, POSES.stand, g.t === 1 ? 0.3 : 0));
    case 'strike':
      return P(g.t < 3 ? POSES.windup : g.t <= 5 ? POSES.strike : POSES.fight);
    case 'parry':
      return P(POSES.parry);
    case 'hurt':
    case 'blocked':
      return P(POSES.hurt);
    case 'dead':
      return lying(g.x, g.y, g.dir);
  }
  return P(POSES.fight);
}
