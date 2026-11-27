// src/input.js
// Keyboard + floating-joystick mobile touch input manager with edge-triggered press detection.

const TRACKED_CODES = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
  'ShiftLeft', 'ShiftRight',
  'Space', 'Enter', 'Escape', 'KeyR', 'KeyM',
]);

const BUFFER_TTL = 0.2;

// Floating virtual joystick tuning (pixels / radians)
export const JOY_DEAD_ZONE = 12;
export const JOY_RELEASE_ZONE = 9;
export const JOY_MAX_RADIUS = 48;
export const JOY_SECTOR_HYST_RAD = (6 * Math.PI) / 180;

const TAP_MAX_DURATION_MS = 450;
const TAP_ADVANCE_MODES = new Set([
  'title', 'intro', 'interlude', 'victory', 'timeout', 'dead', 'level_select',
]);

// 8-way sectors indexed by Math.round(atan2(dy, dx) / (PI/4)) mod 8:
// 0: E, 1: SE, 2: S, 3: SW, 4: W, 5: NW, 6: N, 7: NE
export const SECTOR_KEYS = [
  ['ArrowRight'],
  ['ArrowDown', 'ArrowRight'],
  ['ArrowDown'],
  ['ArrowDown', 'ArrowLeft'],
  ['ArrowLeft'],
  ['ArrowUp', 'ArrowLeft'],
  ['ArrowUp'],
  ['ArrowUp', 'ArrowRight'],
];

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function resolveJoystickSector(dx, dy, prevSector = -1) {
  const dist = Math.hypot(dx, dy);
  if (prevSector === -1) {
    if (dist < JOY_DEAD_ZONE) return -1;
  } else if (dist < JOY_RELEASE_ZONE) {
    return -1;
  }
  const angle = Math.atan2(dy, dx);
  if (prevSector !== -1) {
    const center = prevSector * (Math.PI / 4);
    if (Math.abs(angleDiff(angle, center)) <= (Math.PI / 8) + JOY_SECTOR_HYST_RAD) {
      return prevSector;
    }
  }
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

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

    // Multi-touch virtual joystick & button state
    this._touchContainer = null;
    this._joyEl = null;
    this._joyKnobEl = null;
    this._buttons = [];
    this._joyTouchId = null;
    this._joyOriginX = 0;
    this._joyOriginY = 0;
    this._joySector = -1;
    this._joyKeys = new Set();
    this._joyMoved = false;
    this._joyStartTime = 0;
    this._btnTouches = new Map();
    this._tapTouches = new Map();

    this._boundKeyDown = (e) => this._onKeyDown(e);
    this._boundKeyUp = (e) => this._onKeyUp(e);
    this._boundBlur = () => this._clearAll();
    this._boundVisChange = () => {
      if (typeof document !== 'undefined' && document.hidden) this._clearAll();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._boundKeyDown, { passive: false });
      window.addEventListener('keyup', this._boundKeyUp);
      window.addEventListener('blur', this._boundBlur);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this._boundVisChange);
        this._initTouch();
      }
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
    this._joyTouchId = null;
    this._joySector = -1;
    this._joyKeys.clear();
    this._joyMoved = false;
    for (const info of this._btnTouches.values()) {
      info.btn.classList.remove('active');
    }
    this._btnTouches.clear();
    this._tapTouches.clear();
    this._hideJoyVisual();
  }

  _pressTouchKey(code) {
    const c = (this._touchCounts.get(code) || 0) + 1;
    this._touchCounts.set(code, c);
    this._recordPress(code);
  }

  _releaseTouchKey(code) {
    const prev = this._touchCounts.get(code) || 0;
    const c = Math.max(0, prev - 1);
    if (c === 0) {
      this._touchCounts.delete(code);
      if (this.down.has(code)) {
        this.down.delete(code);
        this.released.add(code);
      }
    } else {
      this._touchCounts.set(code, c);
    }
  }

  _setJoySector(sector) {
    this._joySector = sector;
    const nextKeys = sector >= 0 ? SECTOR_KEYS[sector] : [];
    const nextSet = new Set(nextKeys);
    for (const code of this._joyKeys) {
      if (!nextSet.has(code)) {
        this._releaseTouchKey(code);
      }
    }
    for (const code of nextSet) {
      if (!this._joyKeys.has(code)) {
        this._pressTouchKey(code);
      }
    }
    this._joyKeys = nextSet;
  }

  _showJoyVisual(x, y) {
    if (this._joyEl) {
      this._joyEl.style.left = `${x}px`;
      this._joyEl.style.top = `${y}px`;
      this._joyEl.classList.add('active');
    }
    if (this._touchContainer) {
      this._touchContainer.classList.add('joy-active');
    }
    if (this._joyKnobEl) {
      this._joyKnobEl.style.transform = 'translate3d(0px, 0px, 0)';
    }
  }

  _moveJoyVisual(dx, dy) {
    if (!this._joyKnobEl) return;
    const dist = Math.hypot(dx, dy);
    const scale = dist > JOY_MAX_RADIUS && dist > 0 ? JOY_MAX_RADIUS / dist : 1;
    const kx = dx * scale;
    const ky = dy * scale;
    this._joyKnobEl.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
  }

  _hideJoyVisual() {
    if (this._joyEl) {
      this._joyEl.classList.remove('active');
    }
    if (this._touchContainer) {
      this._touchContainer.classList.remove('joy-active');
    }
    if (this._joyKnobEl) {
      this._joyKnobEl.style.transform = 'translate3d(0px, 0px, 0)';
    }
  }

  _isTapAdvanceMode() {
    const mode = typeof window !== 'undefined' && window.__POZ__ ? window.__POZ__.mode : null;
    return TAP_ADVANCE_MODES.has(mode);
  }

  _pulseEnter() {
    this.down.delete('Enter');
    this._recordPress('Enter');
    this.down.delete('Enter');
  }

  _unlockAudioFromGesture() {
    if (typeof window !== 'undefined' && window.__POZ__ && window.__POZ__.audio) {
      window.__POZ__.audio.unlock();
    }
  }

  _findButton(target, clientX, clientY) {
    if (target && typeof target.closest === 'function') {
      const hit = target.closest('.tbtn[data-key]');
      if (hit) return hit;
    }
    if (target && target.dataset && target.dataset.key) {
      return target;
    }
    for (const btn of this._buttons) {
      if (typeof btn.getBoundingClientRect !== 'function') continue;
      const r = btn.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0 &&
          clientX >= r.left && clientX <= r.right &&
          clientY >= r.top && clientY <= r.bottom) {
        return btn;
      }
    }
    return null;
  }

  _isLeftHalf(clientX) {
    const container = this._touchContainer;
    const r = container && typeof container.getBoundingClientRect === 'function'
      ? container.getBoundingClientRect()
      : null;
    const width = (r && r.width > 0) ? r.width : (window.innerWidth || 800);
    const left = (r && r.width > 0) ? r.left : 0;
    return clientX < left + width / 2;
  }

  _onTouchInputStart(id, clientX, clientY, target) {
    this._unlockAudioFromGesture();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const btn = this._findButton(target, clientX, clientY);
    if (btn && btn.dataset && btn.dataset.key) {
      const code = btn.dataset.key;
      this._btnTouches.set(id, {
        code,
        btn,
        startX: clientX,
        startY: clientY,
        startTime: now,
        isAction: code === 'ShiftLeft',
      });
      btn.classList.add('active');
      this._pressTouchKey(code);
      return;
    }

    if (this._isLeftHalf(clientX)) {
      if (this._joyTouchId === null) {
        this._joyTouchId = id;
        this._joyOriginX = clientX;
        this._joyOriginY = clientY;
        this._joySector = -1;
        this._joyMoved = false;
        this._joyStartTime = now;
        this._showJoyVisual(clientX, clientY);
      } else {
        this._tapTouches.set(id, { startX: clientX, startY: clientY, startTime: now, moved: false });
      }
      return;
    }

    this._tapTouches.set(id, { startX: clientX, startY: clientY, startTime: now, moved: false });
  }

  _onTouchInputMove(id, clientX, clientY) {
    if (id === this._joyTouchId) {
      const dx = clientX - this._joyOriginX;
      const dy = clientY - this._joyOriginY;
      if (Math.hypot(dx, dy) >= JOY_DEAD_ZONE) {
        this._joyMoved = true;
      }
      const nextSector = resolveJoystickSector(dx, dy, this._joySector);
      if (nextSector !== this._joySector) {
        this._setJoySector(nextSector);
      }
      this._moveJoyVisual(dx, dy);
      return;
    }
    const tap = this._tapTouches.get(id);
    if (tap && !tap.moved) {
      if (Math.hypot(clientX - tap.startX, clientY - tap.startY) >= JOY_DEAD_ZONE) {
        tap.moved = true;
      }
    }
  }

  _onTouchInputEnd(id, cancelled = false) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (id === this._joyTouchId) {
      const wasTap = !cancelled && !this._joyMoved && (now - this._joyStartTime) <= TAP_MAX_DURATION_MS;
      this._setJoySector(-1);
      this._joyTouchId = null;
      this._joyMoved = false;
      this._hideJoyVisual();
      if (wasTap && this._isTapAdvanceMode()) {
        this._pulseEnter();
      }
      return;
    }

    const btnInfo = this._btnTouches.get(id);
    if (btnInfo) {
      this._btnTouches.delete(id);
      this._releaseTouchKey(btnInfo.code);
      let stillHeld = false;
      for (const other of this._btnTouches.values()) {
        if (other.btn === btnInfo.btn) {
          stillHeld = true;
          break;
        }
      }
      if (!stillHeld) {
        btnInfo.btn.classList.remove('active');
      }
      if (!cancelled && btnInfo.isAction && this._isTapAdvanceMode()) {
        this._pulseEnter();
      }
      return;
    }

    const tap = this._tapTouches.get(id);
    if (tap) {
      this._tapTouches.delete(id);
      if (!cancelled && !tap.moved && (now - tap.startTime) <= TAP_MAX_DURATION_MS && this._isTapAdvanceMode()) {
        this._pulseEnter();
      }
    }
  }

  _initTouch() {
    const container = document.getElementById('touch-controls');
    if (!container) return;

    this._touchContainer = container;
    this._joyEl = document.getElementById('touch-joy');
    this._joyKnobEl = document.getElementById('touch-joy-knob');
    this._buttons = Array.from(container.querySelectorAll('.tbtn[data-key]'));

    const isTouch = ('ontouchstart' in window) ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch) {
      container.classList.add('visible');
    }
    // Also reveal touch controls on first touch event anywhere
    window.addEventListener('touchstart', () => {
      container.classList.add('visible');
    }, { once: true, passive: true });

    container.addEventListener('contextmenu', (ev) => ev.preventDefault());

    // Primary path: Touch Events tracked by touch.identifier (independent multi-touch)
    container.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      container.classList.add('visible');
      const list = ev.changedTouches || [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        this._onTouchInputStart(`t:${t.identifier}`, t.clientX, t.clientY, t.target || ev.target);
      }
    }, { passive: false });

    container.addEventListener('touchmove', (ev) => {
      ev.preventDefault();
      const list = ev.changedTouches || [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        this._onTouchInputMove(`t:${t.identifier}`, t.clientX, t.clientY);
      }
    }, { passive: false });

    const endTouch = (cancelled) => (ev) => {
      ev.preventDefault();
      const list = ev.changedTouches || [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        this._onTouchInputEnd(`t:${t.identifier}`, cancelled);
      }
    };
    container.addEventListener('touchend', endTouch(false), { passive: false });
    container.addEventListener('touchcancel', endTouch(true), { passive: false });

    // Non-touch Pointer fallback (mouse/pen when overlay is visible, ignores pointerType === 'touch')
    container.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'touch') return;
      ev.preventDefault();
      this._onTouchInputStart(`p:${ev.pointerId}`, ev.clientX, ev.clientY, ev.target);
    });
    window.addEventListener('pointermove', (ev) => {
      if (ev.pointerType === 'touch') return;
      const pid = `p:${ev.pointerId}`;
      if (pid === this._joyTouchId || this._tapTouches.has(pid) || this._btnTouches.has(pid)) {
        this._onTouchInputMove(pid, ev.clientX, ev.clientY);
      }
    });
    const endPointer = (cancelled) => (ev) => {
      if (ev.pointerType === 'touch') return;
      const pid = `p:${ev.pointerId}`;
      if (pid === this._joyTouchId || this._tapTouches.has(pid) || this._btnTouches.has(pid)) {
        this._onTouchInputEnd(pid, cancelled);
      }
    };
    window.addEventListener('pointerup', endPointer(false));
    window.addEventListener('pointercancel', endPointer(true));
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
