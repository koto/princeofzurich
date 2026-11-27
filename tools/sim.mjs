// tools/sim.mjs
// Headless simulation harness: runs the REAL Game / Player / Enemy / LevelState code in Node
// at a fixed 60 Hz step and drives it with synthesized key presses (the same Input class the
// browser uses). Used by tools/test-climb.mjs and tools/test-levels.mjs.

import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { LEVELS } from '../src/levels/index.js';
import { floorY, tileCenterX, colOfX, TILE_W } from '../src/level.js';

export const DT = 1 / 60;

const KEYS = {
  left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
  shift: 'ShiftLeft', space: 'Space', enter: 'Enter', esc: 'Escape', r: 'KeyR',
};

export class StubAudio {
  constructor() { this.currentTrack = null; this.log = []; }
  play(name) { this.log.push(name); if (this.log.length > 200) this.log.shift(); }
  playMusic(n) { this.currentTrack = n; }
  setPaused() {}
  unlock() {}
  toggleMute() { return false; }
}

export function seedRandom(seed = 1) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Sim {
  // levelOrDef: level index (0..4) or a custom level definition object
  constructor(levelOrDef = 0, { god = false, seed = 1, noEnemies = false, maxHp = 3 } = {}) {
    seedRandom(seed);
    this.input = new Input();
    this.audio = new StubAudio();
    const canvas = { getContext: () => ({}) };
    this.game = new Game(canvas, this.input, this.audio);
    this.game.godMode = god;
    this.game.playerMaxHp = maxHp;
    let idx = levelOrDef;
    this._tempIndex = -1;
    if (typeof levelOrDef === 'object') {
      LEVELS.push(levelOrDef);
      idx = LEVELS.length - 1;
      this._tempIndex = idx;
    }
    this.game.startLevel(idx, false);
    if (this._tempIndex >= 0) LEVELS.splice(this._tempIndex, 1);
    if (noEnemies) this.game.enemies = [];
    this.frames = 0;
    this.events = [];
    const origHandle = this.game._handleGameEvent.bind(this.game);
    this.game._handleGameEvent = (ev, payload) => {
      this.events.push(ev);
      origHandle(ev, payload);
    };
  }

  get p() { return this.game.player; }
  get level() { return this.game.level; }

  step(n = 1) {
    for (let i = 0; i < n; i++) {
      this.game.update(DT);
      this.frames++;
    }
  }

  press(k) { this.input.injectPress(KEYS[k] || k); }
  release(k) { this.input.injectRelease(KEYS[k] || k); }
  releaseAll() { for (const k of Object.values(KEYS)) this.input.injectRelease(k); }

  tap(k, frames = 5) {
    this.press(k);
    this.step(frames);
    this.release(k);
  }

  hold(keys, frames) {
    const ks = Array.isArray(keys) ? keys : [keys];
    for (const k of ks) this.press(k);
    this.step(frames);
    for (const k of ks) this.release(k);
  }

  stepUntil(pred, maxFrames = 600) {
    for (let i = 0; i < maxFrames; i++) {
      if (pred(this)) return true;
      this.step(1);
    }
    return pred(this);
  }

  // Teleport the hero to a standing spot (for focused mechanic tests)
  place(roomId, col, row, { x = null, facing = 1 } = {}) {
    const p = this.p;
    p.roomId = roomId;
    p.row = row;
    p.x = x ?? tileCenterX(col);
    p.y = floorY(row);
    p.vx = 0;
    p.vy = 0;
    p.facing = facing;
    p.grounded = true;
    p.hangLedge = null;
    p.climbIntent = 0;
    p.enterState('idle', 0.2);
    this.releaseAll();
    this.step(2);
  }

  idle() {
    const p = this.p;
    return p.alive && p.grounded && (p.state === 'idle' || p.state === 'combat_idle');
  }

  waitIdle(maxFrames = 240) {
    return this.stepUntil((s) => s.idle() || !s.p.alive, maxFrames);
  }

  snap() {
    const p = this.p;
    return {
      room: p.roomId, row: p.row, col: colOfX(p.x), x: +p.x.toFixed(1), y: +p.y.toFixed(1),
      state: p.state, grounded: p.grounded, alive: p.alive, hp: p.hp, mode: this.game.mode,
    };
  }

  // Run in a direction until the hero's x crosses targetX (or a frame limit)
  runTo(targetX, { careful = false, maxFrames = 600 } = {}) {
    const dir = targetX > this.p.x ? 'right' : 'left';
    if (careful) this.press('shift');
    this.press(dir);
    const ok = this.stepUntil((s) => (dir === 'right' ? s.p.x >= targetX : s.p.x <= targetX) || !s.p.alive ||
      (s.p.state === 'idle' && s.frames > 0 && Math.abs(s.p.vx) < 1 && s._stuck()), maxFrames);
    this.release(dir);
    if (careful) this.release('shift');
    return ok;
  }

  _stuck() {
    this._lastX = this._lastX ?? [];
    this._lastX.push(this.p.x);
    if (this._lastX.length > 20) this._lastX.shift();
    return this._lastX.length >= 20 && Math.max(...this._lastX) - Math.min(...this._lastX) < 0.01;
  }
}

export function colLeft(c) { return c * TILE_W; }

// Tiny assertion collector shared by test scripts
export class Report {
  constructor(name) { this.name = name; this.pass = 0; this.fail = 0; this.failures = []; }
  check(ok, label, detail = '') {
    if (ok) { this.pass++; } else { this.fail++; this.failures.push(`${label}${detail ? ' :: ' + detail : ''}`); }
    return ok;
  }
  print() {
    for (const f of this.failures) console.error(`  [FAIL] ${f}`);
    console.log(`${this.name}: ${this.pass} passed, ${this.fail} failed`);
    return this.fail === 0;
  }
}
