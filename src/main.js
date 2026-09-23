import './style.css';
import { SCREEN_W, SCREEN_H, TICK_MS } from './constants.js';
import { Game } from './game.js';
import { LEVEL1 } from './level1.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { sfx, unlockAudio, toggleMute } from './audio.js';

const view = document.getElementById('screen');
const vctx = view.getContext('2d');
const buf = document.createElement('canvas');
buf.width = SCREEN_W;
buf.height = SCREEN_H;
const renderer = new Renderer(buf.getContext('2d'));

const game = new Game(LEVEL1, {
  sfx,
  vibrate: (ms) => navigator.vibrate?.(ms),
});
const input = new Input();
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle('touch', isTouch);
let paused = false;

// ---- layout ----------------------------------------------------------------

// The original's 320x200 image was shown on a 4:3 monitor, so pixels were
// slightly taller than wide. We keep that 4:3 shape and scale to fit.
function layout() {
  const app = document.getElementById('app');
  const vw = app.clientWidth;
  const vh = app.clientHeight;
  const portrait = vh > vw;
  document.body.classList.toggle('portrait', isTouch && portrait);
  let w;
  let h;
  if (!isTouch) {
    h = Math.min(vh, (vw * 3) / 4);
  } else if (portrait) {
    h = Math.min((vw * 3) / 4, vh * 0.55);
  } else {
    // Leave room at the sides for the thumbs.
    const side = Math.max(120, Math.min(190, vw * 0.2));
    h = Math.min(vh, ((vw - 2 * side) * 3) / 4);
  }
  w = (h * 4) / 3;
  view.style.width = `${Math.floor(w)}px`;
  view.style.height = `${Math.floor(h)}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  view.width = Math.floor(w * dpr);
  view.height = Math.floor(h * dpr);

  const pad = Math.round(Math.max(110, Math.min(170, portrait ? vw * 0.4 : (vw - w) / 2 - 20, vh * 0.45)));
  document.documentElement.style.setProperty('--pad', `${pad}px`);
  present();
}

function present() {
  vctx.imageSmoothingEnabled = false;
  vctx.drawImage(buf, 0, 0, view.width, view.height);
}

// ---- flow ------------------------------------------------------------------

async function goFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {
    // Not supported (e.g. iPhone Safari) — play in the browser as is.
  }
}

function startOrContinue() {
  unlockAudio();
  if (paused) {
    paused = false;
    return;
  }
  if (game.mode === 'title') {
    if (isTouch) goFullscreen();
    game.begin();
  } else if (game.mode === 'won' || game.mode === 'timeup') {
    game.newGame();
    game.begin();
  }
}

function setPaused(on) {
  if (game.mode !== 'play') return;
  paused = on;
  if (on) input.clear();
}

input.onPress((b) => {
  unlockAudio();
  if (b === 'start' || (b === 'action' && game.mode !== 'play') || paused) startOrContinue();
});

input.bindKeyboard((e) => {
  if (e.repeat) return false;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    setPaused(!paused);
    return true;
  }
  if (e.key === 'm' || e.key === 'M') {
    toggleMute();
    return true;
  }
  return false;
});

input.bindDpad(document.getElementById('dpad'));
input.bindButton(document.getElementById('btn-jump'), 'up');
input.bindButton(document.getElementById('btn-action'), 'action');

view.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (game.mode === 'play' && !paused && game.prince.alive) return;
  startOrContinue();
  if (game.mode === 'play' && !game.prince.alive) input.setSource('tap', ['start']);
});
view.addEventListener('pointerup', () => input.setSource('tap', []));

const pauseBtn = document.getElementById('btn-pause');
pauseBtn.addEventListener('click', () => (paused ? startOrContinue() : setPaused(true)));
const soundBtn = document.getElementById('btn-sound');
soundBtn.addEventListener('click', () => {
  unlockAudio();
  soundBtn.classList.toggle('off', toggleMute());
});
document.getElementById('btn-full').addEventListener('click', goFullscreen);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));
document.addEventListener('fullscreenchange', layout);
// Stop iOS from treating long presses and double taps as page gestures.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---- loop ------------------------------------------------------------------

let last = performance.now();
let acc = 0;
let dirty = true;

function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= TICK_MS) {
    acc -= TICK_MS;
    const inp = input.snapshot();
    if (!paused) game.tick(inp);
    dirty = true;
  }
  if (dirty) {
    renderer.render(game, { touch: isTouch, paused });
    present();
    dirty = false;
  }
  requestAnimationFrame(frame);
}

layout();
requestAnimationFrame(frame);

// Handy for debugging from the console.
window.__game = game;
