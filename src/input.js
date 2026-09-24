// Merges keyboard and touch into one set of buttons. Presses are counted, so a
// tap shorter than one game tick (~67ms) is never lost.
export const BUTTONS = ['left', 'right', 'up', 'down', 'action', 'start'];

const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  Shift: 'action', z: 'action', Z: 'action', x: 'action', X: 'action', ' ': 'action',
  Enter: 'start',
};

export class Input {
  constructor() {
    this.sources = new Map(); // source id -> Set of buttons held
    this.presses = Object.fromEntries(BUTTONS.map((b) => [b, 0]));
    this.seen = { ...this.presses };
    this.listeners = [];
  }

  onPress(fn) {
    this.listeners.push(fn);
  }

  held(b) {
    for (const s of this.sources.values()) if (s.has(b)) return true;
    return false;
  }

  setSource(id, buttons) {
    const prev = this.sources.get(id) || new Set();
    for (const b of buttons) {
      if (!prev.has(b) && !this.held(b)) {
        this.presses[b]++;
        this.listeners.forEach((fn) => fn(b));
      }
    }
    this.sources.set(id, new Set(buttons));
  }

  clear() {
    this.sources.clear();
  }

  // One snapshot per game tick: held state plus "pressed since last tick".
  snapshot() {
    const s = {};
    for (const b of BUTTONS) {
      const pressed = this.presses[b] !== this.seen[b];
      this.seen[b] = this.presses[b];
      s[b] = this.held(b) || pressed;
      s[b + 'P'] = pressed;
    }
    return s;
  }

  bindKeyboard(onKey) {
    const down = new Set();
    const sync = () => this.setSource('kb', [...down].map((k) => KEYMAP[k]).filter(Boolean));
    window.addEventListener('keydown', (e) => {
      if (onKey(e)) return;
      if (!KEYMAP[e.key]) return;
      e.preventDefault();
      down.add(e.key);
      sync();
    });
    window.addEventListener('keyup', (e) => {
      // Shift changes e.key for letters, so drop both cases.
      down.delete(e.key);
      down.delete(e.key.toLowerCase());
      down.delete(e.key.toUpperCase());
      sync();
    });
    window.addEventListener('blur', () => {
      down.clear();
      this.clear();
    });
  }

  // 8-way pad: the direction comes from the angle of the touch from the centre,
  // so sliding a thumb (e.g. from RIGHT to UP+RIGHT for a running jump) works.
  bindDpad(el) {
    let active = null;
    const update = (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const set = [];
      if (Math.hypot(dx, dy) > r.width * 0.12) {
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (a > -67.5 && a < 67.5) set.push('right');
        if (a > 112.5 || a < -112.5) set.push('left');
        if (a > 22.5 && a < 157.5) set.push('down');
        if (a < -22.5 && a > -157.5) set.push('up');
      }
      this.setSource('dpad', set);
      el.dataset.dir = set.join(' ');
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = e.pointerId;
      el.setPointerCapture(e.pointerId);
      update(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === active) update(e);
    });
    const end = (e) => {
      if (e.pointerId !== active) return;
      active = null;
      this.setSource('dpad', []);
      el.dataset.dir = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  bindButton(el, button) {
    const id = 'btn-' + button;
    const pointers = new Set();
    const sync = () => {
      this.setSource(id, pointers.size ? [button] : []);
      el.classList.toggle('on', pointers.size > 0);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pointers.add(e.pointerId);
      sync();
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      sync();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }
}
