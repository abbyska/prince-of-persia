// PC-speaker style sound: short square-wave beeps and blips, made on the fly.
let ac = null;
let noiseBuf = null;
let muted = false;

export function unlockAudio() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, at = 0, slideTo = null, vol = 0.05) {
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.01);
}

function noise(dur, vol = 0.08, at = 0) {
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  const g = ac.createGain();
  s.buffer = noiseBuf;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g).connect(ac.destination);
  s.start(t);
  s.stop(t + dur);
}

const melody = (notes, len) => notes.forEach((f, i) => tone(f, len * 0.9, i * len));

const SFX = {
  land: () => tone(90, 0.04),
  thud: () => {
    tone(70, 0.12, 0, 40, 0.08);
    noise(0.1, 0.06);
  },
  bump: () => tone(120, 0.05),
  grab: () => tone(400, 0.03),
  hit: () => tone(260, 0.14, 0, 70, 0.07),
  clang: () => {
    tone(1500, 0.04);
    tone(2200, 0.05, 0.03);
  },
  swish: () => tone(700, 0.05, 0, 300, 0.03),
  draw: () => tone(900, 0.06, 0, 1400, 0.03),
  sword: () => melody([523, 659, 784, 1047], 0.08),
  potion: () => melody([392, 523, 659, 784, 1047], 0.06),
  death: () => melody([392, 330, 262, 196, 131], 0.18),
  guarddie: () => melody([330, 247, 165], 0.1),
  win: () => melody([523, 659, 784, 659, 784, 1047], 0.12),
  gate: () => [0, 0.05, 0.1, 0.15].forEach((a) => tone(300, 0.015, a, null, 0.04)),
  slam: () => noise(0.12, 0.1),
  click: () => tone(700, 0.02, 0, null, 0.04),
  spikes: () => tone(1800, 0.06, 0, 600, 0.04),
  loose: () => tone(160, 0.03, 0, null, 0.03),
  crash: () => noise(0.2, 0.12),
};

export function sfx(name) {
  if (!ac || muted || ac.state !== 'running') return;
  SFX[name]?.();
}
