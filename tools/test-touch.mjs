#!/usr/bin/env node
// tools/test-touch.mjs
// Automated unit tests for floating virtual joystick & multi-touch controls (stubbed DOM, Node).
// Asserts: 8 directions, dead zone + radial hysteresis, knob clamping, diagonal run+jump,
// sector-crossing angular hysteresis, multi-touch joystick + held Shift action, release/cancel
// clearing, secondary top-corner buttons, tap-anywhere card advance, and preventDefault().

import assert from 'node:assert/strict';

class FakeClassList {
  constructor() { this._set = new Set(); }
  add(...names) { for (const n of names) this._set.add(n); }
  remove(...names) { for (const n of names) this._set.delete(n); }
  contains(name) { return this._set.has(name); }
}

class FakeElement {
  constructor({ id = '', classes = [], dataset = {}, rect = null, parent = null } = {}) {
    this.id = id;
    this.classList = new FakeClassList();
    for (const c of classes) this.classList.add(c);
    this.dataset = { ...dataset };
    this.style = {};
    this._rect = rect || { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    this._listeners = new Map();
    this.children = [];
    this.parentElement = parent;
    if (parent) parent.children.push(this);
  }
  getBoundingClientRect() { return this._rect; }
  addEventListener(type, fn, opts) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push({ fn, once: !!(opts && opts.once) });
  }
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    let cur = this;
    while (cur) {
      const list = cur._listeners.get(ev.type);
      if (list && list.length) {
        for (const entry of [...list]) {
          entry.fn(ev);
          if (entry.once) {
            const idx = list.indexOf(entry);
            if (idx >= 0) list.splice(idx, 1);
          }
        }
      }
      cur = cur.parentElement;
    }
  }
  matches(sel) {
    if (sel === '.tbtn[data-key]') {
      return this.classList.contains('tbtn') && typeof this.dataset.key === 'string';
    }
    return false;
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      for (const ch of node.children) {
        if (ch.matches(sel)) out.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return out;
  }
}

function createStubDom({ viewportW = 844, viewportH = 390, isTouch = true } = {}) {
  const byId = new Map();
  const container = new FakeElement({
    id: 'touch-controls',
    rect: { left: 0, top: 0, width: viewportW, height: viewportH, right: viewportW, bottom: viewportH },
  });
  const joyEl = new FakeElement({ id: 'touch-joy', parent: container });
  const joyKnob = new FakeElement({ id: 'touch-joy-knob', parent: joyEl });

  const makeBtn = (id, key, rect) => new FakeElement({
    id,
    classes: ['tbtn'],
    dataset: { key },
    rect,
    parent: container,
  });

  const btnPause = makeBtn('btn-pause', 'Escape', { left: 10, top: 8, width: 42, height: 32, right: 52, bottom: 40 });
  const btnMute = makeBtn('btn-mute', 'KeyM', { left: 58, top: 8, width: 42, height: 32, right: 100, bottom: 40 });
  const btnTime = makeBtn('btn-time', 'Space', { left: viewportW - 100, top: 8, width: 42, height: 32, right: viewportW - 58, bottom: 40 });
  const btnRestart = makeBtn('btn-restart', 'KeyR', { left: viewportW - 52, top: 8, width: 42, height: 32, right: viewportW - 10, bottom: 40 });
  const btnAction = makeBtn('touch-action', 'ShiftLeft', {
    left: viewportW - 96, top: viewportH - 96, width: 78, height: 78,
    right: viewportW - 18, bottom: viewportH - 18,
  });

  for (const el of [container, joyEl, joyKnob, btnPause, btnMute, btnTime, btnRestart, btnAction]) {
    if (el.id) byId.set(el.id, el);
  }

  const winListeners = new Map();
  const docListeners = new Map();
  const addMapListener = (map) => (type, fn, opts) => {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push({ fn, once: !!(opts && opts.once) });
  };
  const emitMap = (map, type, ev) => {
    const list = map.get(type);
    if (!list) return;
    for (const entry of [...list]) {
      entry.fn(ev);
      if (entry.once) {
        const idx = list.indexOf(entry);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
  };

  const win = {
    innerWidth: viewportW,
    innerHeight: viewportH,
    addEventListener: addMapListener(winListeners),
    emit: (type, ev = {}) => emitMap(winListeners, type, ev),
    matchMedia: (q) => ({ matches: isTouch && q.includes('coarse') }),
    __POZ__: null,
  };
  if (isTouch) win.ontouchstart = null;

  const doc = {
    hidden: false,
    getElementById: (id) => byId.get(id) || null,
    addEventListener: addMapListener(docListeners),
    emit: (type, ev = {}) => emitMap(docListeners, type, ev),
  };

  globalThis.window = win;
  globalThis.document = doc;
  Object.defineProperty(globalThis, 'navigator', {
    value: { maxTouchPoints: isTouch ? 5 : 0 },
    configurable: true,
    writable: true,
  });

  return {
    win, doc, container, joyEl, joyKnob,
    buttons: { pause: btnPause, mute: btnMute, time: btnTime, restart: btnRestart, action: btnAction },
  };
}

function makeTouchEvent(type, touches, target) {
  let prevented = false;
  return {
    type,
    target,
    changedTouches: touches.map((t) => ({
      identifier: t.id,
      clientX: t.x,
      clientY: t.y,
      target: t.target || target,
    })),
    preventDefault() { prevented = true; },
    get defaultPrevented() { return prevented; },
  };
}

function sendTouch(container, type, touches, target = container) {
  const ev = makeTouchEvent(type, touches, target);
  target.dispatchEvent(ev);
  return ev;
}

function dirState(input) {
  return {
    left: input.left,
    right: input.right,
    up: input.up,
    down: input.downKey,
    shift: input.shift,
  };
}

// Import Input module once; createStubDom installs globals before each new Input()
const { Input, JOY_DEAD_ZONE, JOY_MAX_RADIUS } = await import('../src/input.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

console.log('Running Prince of Zurich touch-control tests...');

// 1. Visibility detection on touch vs non-touch devices
test('shows touch controls only on touch devices', () => {
  const desktop = createStubDom({ isTouch: false });
  new Input();
  assert.equal(desktop.container.classList.contains('visible'), false);
  // First touch event reveals controls on hybrid devices
  desktop.win.emit('touchstart', {});
  assert.equal(desktop.container.classList.contains('visible'), true);

  const mobile = createStubDom({ isTouch: true });
  new Input();
  assert.equal(mobile.container.classList.contains('visible'), true);
});

// 2. Dead zone & radial hysteresis & visual placement
test('dead zone (~12px), radial hysteresis, and floating base placement', () => {
  const dom = createStubDom();
  const input = new Input();

  const evStart = sendTouch(dom.container, 'touchstart', [{ id: 1, x: 140, y: 260 }]);
  assert.equal(evStart.defaultPrevented, true, 'touchstart calls preventDefault');
  assert.equal(dom.joyEl.classList.contains('active'), true);
  assert.equal(dom.joyEl.style.left, '140px');
  assert.equal(dom.joyEl.style.top, '260px');
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false });

  // Inside dead zone (11px < 12px)
  const evDead = sendTouch(dom.container, 'touchmove', [{ id: 1, x: 140 + (JOY_DEAD_ZONE - 1), y: 260 }]);
  assert.equal(evDead.defaultPrevented, true, 'touchmove calls preventDefault');
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false });

  // Cross dead zone (14px >= 12px) -> Right
  input.endFrame();
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 154, y: 260 }]);
  assert.deepEqual(dirState(input), { left: false, right: true, up: false, down: false, shift: false });

  // Radial hysteresis: pull back to 10px (>= 9px release threshold) -> stays Right
  input.endFrame();
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 150, y: 260 }]);
  assert.deepEqual(dirState(input), { left: false, right: true, up: false, down: false, shift: false });

  // Pull inside release threshold (7px < 9px) -> clears to neutral
  input.endFrame();
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 147, y: 260 }]);
  input.endFrame();
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false });

  // Far drag clamps knob transform to JOY_MAX_RADIUS (48px)
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 140 + 120, y: 260 }]);
  assert.equal(dom.joyKnob.style.transform, `translate3d(${JOY_MAX_RADIUS.toFixed(1)}px, 0.0px, 0)`);

  const evEnd = sendTouch(dom.container, 'touchend', [{ id: 1, x: 260, y: 260 }]);
  assert.equal(evEnd.defaultPrevented, true, 'touchend calls preventDefault');
  input.endFrame();
  assert.equal(dom.joyEl.classList.contains('active'), false);
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false });
});

// 3. All 8 directions
test('maps all 8 directions cleanly to left/right/up/down key states', () => {
  const dom = createStubDom();
  const input = new Input();
  const ox = 160;
  const oy = 220;
  const r = 36;

  const cases = [
    { name: 'E (right)', deg: 0, exp: { left: false, right: true, up: false, down: false, shift: false } },
    { name: 'SE (down+right)', deg: 45, exp: { left: false, right: true, up: false, down: true, shift: false } },
    { name: 'S (down)', deg: 90, exp: { left: false, right: false, up: false, down: true, shift: false } },
    { name: 'SW (down+left)', deg: 135, exp: { left: true, right: false, up: false, down: true, shift: false } },
    { name: 'W (left)', deg: 180, exp: { left: true, right: false, up: false, down: false, shift: false } },
    { name: 'NW (up+left)', deg: -135, exp: { left: true, right: false, up: true, down: false, shift: false } },
    { name: 'N (up)', deg: -90, exp: { left: false, right: false, up: true, down: false, shift: false } },
    { name: 'NE (up+right)', deg: -45, exp: { left: false, right: true, up: true, down: false, shift: false } },
  ];

  for (const c of cases) {
    const rad = (c.deg * Math.PI) / 180;
    sendTouch(dom.container, 'touchstart', [{ id: 10, x: ox, y: oy }]);
    sendTouch(dom.container, 'touchmove', [{ id: 10, x: ox + Math.cos(rad) * r, y: oy + Math.sin(rad) * r }]);
    assert.deepEqual(dirState(input), c.exp, `direction ${c.name}`);
    sendTouch(dom.container, 'touchend', [{ id: 10, x: ox, y: oy }]);
    input.endFrame();
    assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false }, `release after ${c.name}`);
  }
});

// 4. Diagonal run+jump without interrupting run
test('diagonal run+jump keeps run key held and fires upPressed + up buffer', () => {
  const dom = createStubDom();
  const input = new Input();
  const ox = 150;
  const oy = 250;

  // Run right
  sendTouch(dom.container, 'touchstart', [{ id: 1, x: ox, y: oy }]);
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: ox + 40, y: oy }]);
  assert.equal(input.right, true);
  assert.equal(input.rightPressed, true);
  assert.equal(input.up, false);
  input.endFrame();

  // Sweep to Up-Right diagonal for running jump
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: ox + 30, y: oy - 30 }]);
  assert.equal(input.right, true, 'right remains held');
  assert.equal(input.rightPressed, false, 'right is NOT spuriously re-pressed');
  assert.equal(input.released.has('ArrowRight'), false, 'right is NOT released');
  assert.equal(input.up, true, 'up becomes active');
  assert.equal(input.upPressed, true, 'upPressed edge triggers jump');
  assert.equal(input.consumeUp(), true, 'consumeUp succeeds for running jump');

  // Sweep back to pure Right after jump
  input.endFrame();
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: ox + 40, y: oy }]);
  assert.equal(input.right, true);
  assert.equal(input.up, false);
  assert.equal(input.released.has('ArrowUp'), true);
  sendTouch(dom.container, 'touchend', [{ id: 1, x: ox + 40, y: oy }]);
  input.endFrame();

  // Mirror: run left -> Up-Left diagonal
  sendTouch(dom.container, 'touchstart', [{ id: 2, x: ox, y: oy }]);
  sendTouch(dom.container, 'touchmove', [{ id: 2, x: ox - 40, y: oy }]);
  input.endFrame();
  sendTouch(dom.container, 'touchmove', [{ id: 2, x: ox - 30, y: oy - 30 }]);
  assert.equal(input.left, true);
  assert.equal(input.leftPressed, false);
  assert.equal(input.up, true);
  assert.equal(input.upPressed, true);
  sendTouch(dom.container, 'touchend', [{ id: 2, x: ox - 30, y: oy - 30 }]);
  input.endFrame();
});

// 5. Finger crossing sectors & angular hysteresis (no boundary flicker)
test('finger crossing sectors has hysteresis and transitions cleanly around 360 deg', () => {
  const dom = createStubDom();
  const input = new Input();
  const ox = 180;
  const oy = 220;
  const r = 40;
  const moveDeg = (deg) => {
    const rad = (deg * Math.PI) / 180;
    sendTouch(dom.container, 'touchmove', [{ id: 3, x: ox + Math.cos(rad) * r, y: oy + Math.sin(rad) * r }]);
  };

  sendTouch(dom.container, 'touchstart', [{ id: 3, x: ox, y: oy }]);
  moveDeg(0); // East
  input.endFrame();

  // Slightly past nominal -22.5 deg boundary (-25 deg): hysteresis keeps East (no flicker)
  moveDeg(-25);
  assert.equal(input.right, true);
  assert.equal(input.up, false, 'stays East inside hysteresis band at -25 deg');

  // Clearly past hysteresis threshold (-32 deg): switches to NE (up+right)
  input.endFrame();
  moveDeg(-32);
  assert.equal(input.right, true);
  assert.equal(input.up, true, 'switches to NE past hysteresis band at -32 deg');

  // Jiggle back past -22.5 deg to -20 deg: hysteresis keeps NE (no flicker)
  input.endFrame();
  moveDeg(-20);
  assert.equal(input.right, true);
  assert.equal(input.up, true, 'stays NE inside hysteresis band at -20 deg');

  // Move further back to -14 deg: switches back to East
  input.endFrame();
  moveDeg(-14);
  input.endFrame();
  assert.equal(input.right, true);
  assert.equal(input.up, false, 'returns to East at -14 deg');

  // Continuous 360-degree sweep across all 8 sectors including +/-180 wraparound
  const sweep = [
    { deg: 0, exp: { left: false, right: true, up: false, down: false, shift: false } },
    { deg: 45, exp: { left: false, right: true, up: false, down: true, shift: false } },
    { deg: 90, exp: { left: false, right: false, up: false, down: true, shift: false } },
    { deg: 135, exp: { left: true, right: false, up: false, down: true, shift: false } },
    { deg: 178, exp: { left: true, right: false, up: false, down: false, shift: false } },
    { deg: -176, exp: { left: true, right: false, up: false, down: false, shift: false } },
    { deg: -135, exp: { left: true, right: false, up: true, down: false, shift: false } },
    { deg: -90, exp: { left: false, right: false, up: true, down: false, shift: false } },
    { deg: -45, exp: { left: false, right: true, up: true, down: false, shift: false } },
    { deg: 0, exp: { left: false, right: true, up: false, down: false, shift: false } },
  ];
  for (const step of sweep) {
    moveDeg(step.deg);
    input.endFrame();
    assert.deepEqual(dirState(input), step.exp, `sweep angle ${step.deg} deg`);
  }

  sendTouch(dom.container, 'touchend', [{ id: 3, x: ox, y: oy }]);
  input.endFrame();
});

// 6. Multi-touch: joystick + held Shift action from second finger (independent IDs)
test('multi-touch joystick + held Shift action operate independently by touch id', () => {
  const dom = createStubDom();
  const input = new Input();
  const actBtn = dom.buttons.action;

  // Finger 1 starts joystick left-half and drags right
  sendTouch(dom.container, 'touchstart', [{ id: 1, x: 120, y: 260 }]);
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 160, y: 260 }]);
  input.endFrame();

  // Finger 2 presses and holds Shift/Action button on bottom-right
  sendTouch(dom.container, 'touchstart', [{ id: 2, x: 785, y: 330, target: actBtn }], actBtn);
  assert.equal(input.right, true);
  assert.equal(input.shift, true);
  assert.equal(input.shiftPressed, true);
  assert.equal(actBtn.classList.contains('active'), true);

  // Finger 2 wobbles off button edge while still held (must NOT drop hang/careful step)
  input.endFrame();
  sendTouch(dom.container, 'touchmove', [{ id: 2, x: 720, y: 260, target: actBtn }], actBtn);
  assert.equal(input.shift, true, 'shift stays held while thumb drifts');

  // Finger 1 moves to Up-Right while Finger 2 holds Shift
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 150, y: 230 }]);
  assert.deepEqual(dirState(input), { left: false, right: true, up: true, down: false, shift: true });

  // Third finger tapping left half does NOT hijack Finger 1's joystick
  sendTouch(dom.container, 'touchstart', [{ id: 9, x: 50, y: 150 }]);
  sendTouch(dom.container, 'touchmove', [{ id: 9, x: 10, y: 150 }]);
  assert.deepEqual(dirState(input), { left: false, right: true, up: true, down: false, shift: true });
  sendTouch(dom.container, 'touchend', [{ id: 9, x: 10, y: 150 }]);

  // Finger 1 releases: directions clear, Shift remains held!
  sendTouch(dom.container, 'touchend', [{ id: 1, x: 150, y: 230 }]);
  input.endFrame();
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: true });
  assert.equal(actBtn.classList.contains('active'), true);

  // Finger 1 re-engages Left (careful step left while Shift still held)
  sendTouch(dom.container, 'touchstart', [{ id: 3, x: 150, y: 250 }]);
  sendTouch(dom.container, 'touchmove', [{ id: 3, x: 110, y: 250 }]);
  input.endFrame();
  assert.deepEqual(dirState(input), { left: true, right: false, up: false, down: false, shift: true });

  // Finger 2 releases Shift: Shift clears, Left remains held!
  sendTouch(dom.container, 'touchend', [{ id: 2, x: 720, y: 260, target: actBtn }], actBtn);
  input.endFrame();
  assert.deepEqual(dirState(input), { left: true, right: false, up: false, down: false, shift: false });
  assert.equal(actBtn.classList.contains('active'), false);

  // Finger 3 touchcancel clears Left cleanly
  sendTouch(dom.container, 'touchcancel', [{ id: 3, x: 110, y: 250 }]);
  input.endFrame();
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false });
});

// 7. Top-corner secondary buttons & tap-anywhere to advance title/story cards
test('secondary top-corner buttons and tap-anywhere advance title/story cards', () => {
  const dom = createStubDom();
  const input = new Input();

  const btnChecks = [
    ['pause', 'escPressed'],
    ['mute', 'mutePressed'],
    ['time', 'spacePressed'],
    ['restart', 'restartPressed'],
  ];
  for (const [key, prop] of btnChecks) {
    const btn = dom.buttons[key];
    const r = btn.getBoundingClientRect();
    sendTouch(dom.container, 'touchstart', [{ id: 20, x: r.left + 10, y: r.top + 10, target: btn }], btn);
    assert.equal(input[prop], true, `${key} sets ${prop}`);
    sendTouch(dom.container, 'touchend', [{ id: 20, x: r.left + 10, y: r.top + 10, target: btn }], btn);
    input.endFrame();
    assert.equal(input[prop], false);
  }

  // Tap-anywhere on intro card advances with Enter
  dom.win.__POZ__ = { mode: 'intro', audio: { unlock() {} } };
  sendTouch(dom.container, 'touchstart', [{ id: 30, x: 600, y: 180 }]);
  sendTouch(dom.container, 'touchend', [{ id: 30, x: 602, y: 181 }]);
  assert.equal(input.enterPressed, true, 'tap on right half advances intro card');
  input.endFrame();

  // Tap on left half without dragging also advances title screen
  dom.win.__POZ__.mode = 'title';
  sendTouch(dom.container, 'touchstart', [{ id: 31, x: 180, y: 200 }]);
  sendTouch(dom.container, 'touchend', [{ id: 31, x: 183, y: 202 }]);
  assert.equal(input.enterPressed, true, 'tap on left half advances title screen');
  input.endFrame();

  // Dragging joystick on title navigates menu without triggering Enter
  sendTouch(dom.container, 'touchstart', [{ id: 32, x: 180, y: 200 }]);
  sendTouch(dom.container, 'touchmove', [{ id: 32, x: 180, y: 240 }]);
  assert.equal(input.downPressed, true);
  sendTouch(dom.container, 'touchend', [{ id: 32, x: 180, y: 240 }]);
  assert.equal(input.enterPressed, false, 'dragged joystick does not pulse Enter');
  input.endFrame();

  // Tapping during gameplay does NOT pulse Enter
  dom.win.__POZ__.mode = 'playing';
  sendTouch(dom.container, 'touchstart', [{ id: 33, x: 600, y: 180 }]);
  sendTouch(dom.container, 'touchend', [{ id: 33, x: 601, y: 180 }]);
  assert.equal(input.enterPressed, false, 'tap during playing does not pulse Enter');
});

// 8. Blur clears active joystick & held buttons
test('window blur clears all held touch directions and buttons', () => {
  const dom = createStubDom();
  const input = new Input();
  const actBtn = dom.buttons.action;

  sendTouch(dom.container, 'touchstart', [{ id: 1, x: 120, y: 220 }]);
  sendTouch(dom.container, 'touchmove', [{ id: 1, x: 160, y: 180 }]);
  sendTouch(dom.container, 'touchstart', [{ id: 2, x: 785, y: 330, target: actBtn }], actBtn);
  assert.equal(input.right, true);
  assert.equal(input.up, true);
  assert.equal(input.shift, true);

  dom.win.emit('blur', {});
  assert.deepEqual(dirState(input), { left: false, right: false, up: false, down: false, shift: false });
  assert.equal(dom.joyEl.classList.contains('active'), false);
  assert.equal(actBtn.classList.contains('active'), false);
});

console.log(`\nTouch tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
