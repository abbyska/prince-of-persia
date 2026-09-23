// Draws a posed skeleton as a smooth, shaded figure: tapered limbs with
// cylindrical shading, baggy trousers gathered at the ankle, an outlined
// silhouette, and a painted profile head.

const OUTLINE = '#15111c';
const LIGHT = (() => {
  const v = [-0.55, -0.85];
  const l = Math.hypot(v[0], v[1]);
  return [v[0] / l, v[1] / l];
})();

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function tone(base) {
  return { base, light: mix(base, '#ffffff', 0.45), dark: mix(base, '#10102a', 0.5) };
}

function makeLook(src) {
  const far = (c) => mix(c, '#10102a', 0.3);
  const look = { ...src };
  for (const k of ['pants', 'shirt', 'skin']) {
    look[k] = tone(src[k]);
    look[k + 'Far'] = tone(far(src[k]));
  }
  return look;
}

const LOOKS = {
  prince: makeLook({ pants: '#eeeef8', shirt: '#fafafe', skin: '#e6a676', hair: '#2a170c', head: 'prince' }),
  guard: makeLook({
    pants: '#d49a3c', shirt: '#4a64c8', skin: '#c47f52', hair: '#1c0e06',
    turban: '#f0f0f8', belt: '#cc3434', coat: true, head: 'guard',
  }),
};

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function capsule(ctx, a, b, wa, wb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1e-3;
  const nx = -dy / L;
  const ny = dx / L;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2);
  ctx.lineTo(b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2);
  ctx.arc(b[0], b[1], wb / 2, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2);
  ctx.arc(a[0], a[1], wa / 2, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
}

function shadedCapsule(ctx, a, b, wa, wb, t) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1e-3;
  let nx = -dy / L;
  let ny = dx / L;
  if (nx * LIGHT[0] + ny * LIGHT[1] < 0) {
    nx = -nx;
    ny = -ny;
  }
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const w = Math.max(wa, wb) / 2;
  const g = ctx.createLinearGradient(mx + nx * w, my + ny * w, mx - nx * w, my - ny * w);
  g.addColorStop(0, t.light);
  g.addColorStop(0.42, t.base);
  g.addColorStop(1, t.dark);
  ctx.fillStyle = g;
  capsule(ctx, a, b, wa, wb);
  ctx.fill();
}

// A group of segments shares one outline so joints read as one limb.
function group(ctx, segs) {
  ctx.fillStyle = OUTLINE;
  for (const [a, b, wa, wb] of segs) {
    capsule(ctx, a, b, wa + 1.1, wb + 1.1);
    ctx.fill();
  }
  for (const [a, b, wa, wb, t] of segs) shadedCapsule(ctx, a, b, wa, wb, t);
}

function leg(ctx, hip, knee, foot, d, pants, skin) {
  const calf = lerp(knee, foot, 0.5);
  const ankle = lerp(knee, foot, 0.86);
  group(ctx, [
    [hip, knee, 6.0, 5.2, pants],
    [knee, calf, 5.2, 6.6, pants],
    [calf, ankle, 6.6, 2.8, pants],
  ]);
  group(ctx, [[[foot[0] - d * 0.6, foot[1] - 0.9], [foot[0] + d * 3.2, foot[1] - 0.4], 2.2, 1.6, skin]]);
}

function arm(ctx, sh, el, wr, cloth, skin, sword) {
  group(ctx, [
    [sh, el, 3.2, 2.7, cloth],
    [el, wr, 2.7, 2.2, cloth],
  ]);
  sword?.();
  const fx = wr[0] - el[0];
  const fy = wr[1] - el[1];
  const fl = Math.hypot(fx, fy) || 1;
  const hand = [wr[0] + (fx / fl) * 1.1, wr[1] + (fy / fl) * 1.1];
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.base;
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 1.35, 0, Math.PI * 2);
  ctx.fill();
}

function head(ctx, h, d, look) {
  ctx.save();
  ctx.translate(h[0], h[1]);
  ctx.scale(d, 1);
  ctx.lineWidth = 0.55;
  ctx.strokeStyle = OUTLINE;

  // Face.
  ctx.beginPath();
  ctx.ellipse(0.3, 0.2, 3.3, 3.5, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(1.6, -1, 0.5, 0.3, 0.2, 4);
  g.addColorStop(0, look.skin.light);
  g.addColorStop(0.6, look.skin.base);
  g.addColorStop(1, look.skin.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
  // Nose and eye.
  ctx.beginPath();
  ctx.moveTo(3.3, -0.7);
  ctx.lineTo(4.4, 0.9);
  ctx.lineTo(3.2, 1.3);
  ctx.closePath();
  ctx.fillStyle = look.skin.base;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.ellipse(1.8, -0.3, 0.45, 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(1.1, -1.35, 1.5, 0.4);

  if (look.head === 'guard') {
    // Moustache, turban and jewel.
    ctx.beginPath();
    ctx.moveTo(3.4, 1.4);
    ctx.quadraticCurveTo(2.2, 2.6, 0.9, 1.9);
    ctx.quadraticCurveTo(2.2, 1.7, 3.4, 1.4);
    ctx.fillStyle = look.hair;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.1, -2.7, 4.0, 2.5, -0.08, 0, Math.PI * 2);
    const tg = ctx.createLinearGradient(-2, -5, 2, 0);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(1, '#a4a4c4');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80,80,120,0.6)';
    for (const k of [-1.2, 0.2]) {
      ctx.beginPath();
      ctx.ellipse(0.1, -2.7 + k * 0.6, 3.6, 1.2, -0.2, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = look.belt;
    ctx.beginPath();
    ctx.arc(2.7, -2.6, 0.75, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Dark hair swept back.
    ctx.beginPath();
    ctx.moveTo(2.8, -2.2);
    ctx.quadraticCurveTo(0.6, -4.9, -2.6, -3.4);
    ctx.quadraticCurveTo(-4.3, -1.6, -3.6, 1.7);
    ctx.quadraticCurveTo(-2.8, 3.3, -1.5, 2.4);
    ctx.quadraticCurveTo(-1.1, 0.2, 0.2, -1.1);
    ctx.quadraticCurveTo(1.6, -1.6, 2.8, -2.2);
    ctx.closePath();
    ctx.fillStyle = look.hair;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function sword(ctx, w, ang, d) {
  const v = [Math.cos(ang) * d, Math.sin(ang)];
  const p = [-v[1], v[0]];
  const at = (k) => [w[0] + v[0] * k, w[1] + v[1] * k];
  // Grip and pommel.
  ctx.fillStyle = '#4a2c14';
  capsule(ctx, at(-2.6), at(0.8), 1.3, 1.3);
  ctx.fill();
  // Blade.
  const g = ctx.createLinearGradient(...at(0), ...at(18));
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#8c94b8');
  ctx.fillStyle = OUTLINE;
  capsule(ctx, at(1.4), at(18.2), 1.9, 0.9);
  ctx.fill();
  ctx.fillStyle = g;
  capsule(ctx, at(1.4), at(18), 1.2, 0.3);
  ctx.fill();
  // Crossguard.
  ctx.fillStyle = '#e8c050';
  const c = at(1.2);
  capsule(ctx, [c[0] - p[0] * 2.6, c[1] - p[1] * 2.6], [c[0] + p[0] * 2.6, c[1] + p[1] * 2.6], 1.1, 1.1);
  ctx.fill();
}

export function drawShadow(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 0.2, 9.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// J: joints from figure.js (world coordinates); ox/oy: room origin.
export function drawCharacter(ctx, J, lookName, armed, ox, oy) {
  const look = LOOKS[lookName];
  const d = J.dir;
  const L = (k) => [J[k][0] - ox, J[k][1] - oy];
  const [hip, neck, sh, hd, k1, f1, k2, f2, e1, w1, e2, w2] =
    ['hip', 'neck', 'sh', 'head', 'k1', 'f1', 'k2', 'f2', 'e1', 'w1', 'e2', 'w2'].map(L);

  ctx.lineJoin = 'round';
  leg(ctx, hip, k2, f2, d, look.pantsFar, look.skinFar);
  arm(ctx, sh, e2, w2, look.shirtFar, look.skinFar);

  group(ctx, [[sh, neck, 2.4, 2.4, look.skin]]);
  const torso = [[hip, sh, 7.4, 8.2, look.shirt]];
  if (look.coat) {
    const mid = lerp(k1, k2, 0.5);
    torso.push([hip, lerp(hip, mid, 0.6), 8.4, 9.6, look.shirt]);
  }
  group(ctx, torso);
  leg(ctx, hip, k1, f1, d, look.pants, look.skin);
  if (look.coat) {
    // Coat skirt over the near thigh, and a sash.
    group(ctx, [[hip, lerp(hip, lerp(k1, k2, 0.5), 0.6), 8.4, 9.6, look.shirt]]);
    ctx.fillStyle = look.belt;
    capsule(ctx, [hip[0] - 3.6, hip[1] - 1.2], [hip[0] + 3.6, hip[1] - 1.2], 1.6, 1.6);
    ctx.fill();
  }
  head(ctx, hd, d, look);
  arm(ctx, sh, e1, w1, look.shirt, look.skin, armed && J.sword != null ? () => sword(ctx, w1, J.sword, d) : null);
}
