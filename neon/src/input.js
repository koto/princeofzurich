// src/input.js
// Keyboard + on-screen touch input manager with edge-triggered press detection.

const TRACKED_CODES = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
  'ShiftLeft', 'ShiftRight',
  'Space', 'Enter', 'Escape', 'KeyR', 'KeyM',
]);

const BUFFER_TTL = 0.2;

function actionForCode(code) {
  if (code === 'ArrowUp' || code === 'KeyW') return 'up';
  if (code === 'ArrowDown' || code === 'KeyS') return 'down';
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
  if (code === 'ArrowRight' || code === 'KeyD') return 'right';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'shift';
  return null;
}

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.buffer = new Map();
    this._touchCounts = new Map();
    this._anyKeyPressed = false;
    this._boundKeyDown = (e) => this._onKeyDown(e);
    this._boundKeyUp = (e) => this._onKeyUp(e);
    this._boundBlur = () => this._clearAll();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._boundKeyDown, { passive: false });
      window.addEventListener('keyup', this._boundKeyUp);
      window.addEventListener('blur', this._boundBlur);
      this._initTouch();
    }
  }

  _recordPress(code) {
    if (!this.down.has(code)) {
      this.down.add(code);
      this.pressed.add(code);
      this._anyKeyPressed = true;
      const act = actionForCode(code);
      if (act) this.buffer.set(act, BUFFER_TTL);
    }
  }

  _onKeyDown(e) {
    if (TRACKED_CODES.has(e.code)) {
      e.preventDefault();
    }
    this._recordPress(e.code);
  }

  _onKeyUp(e) {
    if (this.down.has(e.code)) {
      this.down.delete(e.code);
      this.released.add(e.code);
    }
  }

  _clearAll() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.buffer.clear();
    this._touchCounts.clear();
  }

  _initTouch() {
    const container = document.getElementById('touch-controls');
    if (!container) return;

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch) {
      container.classList.add('visible');
    }
    // Also reveal touch controls on first touch event anywhere
    window.addEventListener('touchstart', () => {
      container.classList.add('visible');
    }, { once: true, passive: true });

    const buttons = container.querySelectorAll('.tbtn[data-key]');
    for (const btn of buttons) {
      const code = btn.dataset.key;
      const press = (ev) => {
        ev.preventDefault();
        btn.classList.add('active');
        const c = (this._touchCounts.get(code) || 0) + 1;
        this._touchCounts.set(code, c);
        this._recordPress(code);
      };
      const release = (ev) => {
        ev.preventDefault();
        btn.classList.remove('active');
        const c = Math.max(0, (this._touchCounts.get(code) || 1) - 1);
        this._touchCounts.set(code, c);
        if (c === 0 && this.down.has(code)) {
          this.down.delete(code);
          this.released.add(code);
        }
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    }
  }

  // Synthesize press/release for automated testing or canvas click
  injectPress(code) {
    this._recordPress(code);
  }

  injectRelease(code) {
    if (this.down.has(code)) {
      this.down.delete(code);
      this.released.add(code);
    }
  }

  hasBuffer(action) {
    return (this.buffer.get(action) || 0) > 0;
  }

  consumeBuffer(action) {
    const val = this.buffer.get(action) || 0;
    if (val > 0) {
      this.buffer.delete(action);
      return true;
    }
    return false;
  }

  consumeUp() {
    if (this.upPressed || this.hasBuffer('up')) {
      this.buffer.delete('up');
      return true;
    }
    return false;
  }

  consumeShift() {
    if (this.shiftPressed || this.hasBuffer('shift')) {
      this.buffer.delete('shift');
      return true;
    }
    return false;
  }

  consumeDown() {
    if (this.downPressed || this.hasBuffer('down')) {
      this.buffer.delete('down');
      return true;
    }
    return false;
  }

  endFrame(dt = 1 / 60) {
    this.pressed.clear();
    this.released.clear();
    this._anyKeyPressed = false;
    for (const [act, ttl] of this.buffer) {
      const rem = ttl - dt;
      if (rem <= 0) this.buffer.delete(act);
      else this.buffer.set(act, rem);
    }
  }

  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // A key counts as held on the frame it was pressed even if it was already released again
  // (very short taps / touch flicks shorter than one frame must not be lost).
  _held(a, b) { return this.down.has(a) || this.down.has(b) || this.pressed.has(a) || this.pressed.has(b); }
  get left() { return this._held('ArrowLeft', 'KeyA'); }
  get right() { return this._held('ArrowRight', 'KeyD'); }
  get up() { return this._held('ArrowUp', 'KeyW'); }
  get downKey() { return this._held('ArrowDown', 'KeyS'); }
  get shift() { return this._held('ShiftLeft', 'ShiftRight'); }

  get leftPressed() { return this.pressed.has('ArrowLeft') || this.pressed.has('KeyA'); }
  get rightPressed() { return this.pressed.has('ArrowRight') || this.pressed.has('KeyD'); }
  get upPressed() { return this.pressed.has('ArrowUp') || this.pressed.has('KeyW'); }
  get downPressed() { return this.pressed.has('ArrowDown') || this.pressed.has('KeyS'); }
  get shiftPressed() { return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'); }
  get spacePressed() { return this.pressed.has('Space'); }
  get enterPressed() { return this.pressed.has('Enter'); }
  get escPressed() { return this.pressed.has('Escape'); }
  get restartPressed() { return this.pressed.has('KeyR'); }
  get mutePressed() { return this.pressed.has('KeyM'); }
  get anyPressed() { return this._anyKeyPressed; }
}
