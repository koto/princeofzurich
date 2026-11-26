// Actor: one tile-committed state machine used for the hero, guards, Deepfake and Zins.
import { COLS, TW, TH, FEET, W, H, HANG_Y, fy, supportsCh, ceilingCh, isGateCh } from './level.js';

const HW = 6;
const AIR = new Set(['fall', 'jump', 'jumpup', 'hang', 'climb', 'climbdown', 'bumphead']);
const SPIKE_KILL = new Set(['run', 'runstart', 'skid', 'rturn', 'fadv', 'fret', 'fhit', 'frecoil', 'fstrike', 'fparry', 'fready', 'draw', 'land', 'bump']);
// While committed to one of these animations a buffered Up press does not expire (up to ubLife frames),
// so pressing Up a little early (during a skid, landing, turn or step) still fires when control returns.
const HOLD = new Set(['skid', 'rturn', 'turn', 'land', 'step', 'bump', 'peek', 'align', 'pickup', 'crouch']);
export const RUN_V = 2.2;
// Ledge forgiveness: Up climbs a ledge whose lip is up to CLIMB_FRONT px ahead of the hero
// or up to CLIMB_UNDER px behind him (he is already under the ledge); he steps into place first.
export const CLIMB_FRONT = 42, CLIMB_UNDER = 22;
export const STAND_JUMP = 56, RUN_JUMP = 96;

export class Actor {
  constructor(g, kind, room, c, r, face = 1) {
    this.g = g; this.kind = kind; this.room = room;
    this.x = c * TW + TW / 2; this.y = fy(r); this.rw = r; this.face = face;
    this.st = 'idle'; this.t = 0; this.v = 0; this.vx = 0; this.vy = 0;
    this.hp = 3; this.maxhp = 3; this.armed = false; this.hasSword = false;
    this.dead = false; this.ghost = false; this.flash = 0;
    this.ub = 0; this.ubLife = 0; this.sb = 0; this.pu = false; this.ps = false; this.noGrab = 0;
    this.autoClimb = false; this.hangGrace = 0; this.climbTarget = null;
    this.stepPar = 0; this.pendingDraw = false; this.alertStop = false; this.inp = {};
    this.skill = null; this.cause = null; this.exited = false; this.riposte = 0;
  }
  col() { return Math.max(0, Math.min(COLS - 1, Math.floor(this.x / TW))); }
  row() { return this.rw; }
  onGround() { return !AIR.has(this.st) && !this.dead; }
  tileAt(dc = 0, dr = 0) { return this.g.level.tile(this.room, this.col() + dc, this.rw + dr); }
  go(st, extra) { this.st = st; this.t = 0; if (extra) Object.assign(this, extra); }
  sfx(n) { this.g.sfx(n, this); }

  normalizeRoom() {
    const R = this.g.level.rooms[this.room];
    if (this.x < 0) { if (R.l) { this.room = R.l; this.x += W; } else this.x = 0; }
    else if (this.x >= W) { if (R.r) { this.room = R.r; this.x -= W; } else this.x = W - 0.01; }
  }
  moveX(dx) {
    if (!dx) return true;
    const L = this.g.level, s = Math.sign(dx), nx = this.x + dx;
    const ex = nx + s * HW, ec = Math.floor(ex / TW);
    if (L.blocks(L.tile(this.room, ec, this.rw))) {
      const edge = s > 0 ? ec * TW : (ec + 1) * TW, cx = edge - s * (HW + 0.01);
      if ((cx - this.x) * s > 0) this.x = cx;
      return false;
    }
    const sep = this.armed ? 22 : 11;
    for (const o of this.g.actors) {
      if (o === this || o.dead || o.ghost || o.room !== this.room || Math.abs(o.y - this.y) > 20) continue;
      const need = (this.armed && o.armed) ? sep : 11;
      const d0 = Math.abs(this.x - o.x), d1 = Math.abs(nx - o.x);
      if (d1 < need && d1 < d0) return false;
    }
    this.x = nx; this.normalizeRoom();
    return true;
  }
  startFall(vx = 0, dist = 0) { this.go('fall', { vx, vy: 0.4, fallDist: dist }); }
  checkSupport() {
    if (!supportsCh(this.tileAt())) { this.startFall(this.v * this.face * 0.6 * (this.st === 'idle' ? 0 : 1)); return false; }
    return true;
  }
  hazards() {
    const L = this.g.level, ch = this.tileAt();
    if (ch === '^' && SPIKE_KILL.has(this.st)) this.die('spikes');
    else if (ch === 'S' && L.slicerLethal(this.col())) this.die('sliced');
    else if (ch === 'L') L.stepOn(this.room, this.col(), this.rw);
  }
  die(cause) {
    if (this.dead) return;
    if (this.kind === 'hero' && this.g.god && cause !== 'void') return;
    this.dead = true; this.hp = 0; this.cause = cause; this.go('dying', { cause });
    this.sfx(this.kind === 'hero' ? 'die' : 'gdie');
  }
  hurtBy(src) {
    if (this.dead || (this.kind === 'hero' && this.g.god)) return;
    this.hp--; this.flash = 24; this.sfx('hurt');
    if (this.hp <= 0) this.die(src === 'fall' ? 'fall' : 'debris');
  }
  takeHit(from) {
    if (this.dead) return;
    if (this.kind === 'deepfake') { if (from) { from.hurtBy('mirror'); if (from.kind === 'hero') this.g.mirrorStruck(); } this.sfx('clang'); return; }
    if (this.kind === 'hero' && this.g.god) { this.sfx('clang'); return; }
    if (!this.armed) { this.die('sword'); return; }
    this.hp--; this.flash = 20; this.sfx('hit');
    if (this.hp <= 0) { this.die('sword'); return; }
    this.go('fhit', { kb: from ? from.face : -this.face });
  }
  drawSword() { if (!this.armed && this.st !== 'draw') this.go('draw'); }

  update(inp) {
    this.inp = inp; this.t++;
    if (this.flash > 0) this.flash--;
    if (inp.u && !this.pu) { this.ub = 12; this.ubLife = 40; }
    if (inp.s && !this.ps) this.sb = 12;
    this.pu = !!inp.u; this.ps = !!inp.s;
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    const fn = this['s_' + this.st];
    if (fn) fn.call(this, inp, dir);
    if (this.ub > 0) { if (HOLD.has(this.st) && this.ubLife > 0) this.ubLife--; else this.ub--; }
    if (this.sb > 0) this.sb--; if (this.noGrab > 0) this.noGrab--; if (this.riposte > 0) this.riposte--;
  }
  rest() { this.go(this.armed ? 'fready' : 'idle'); }

  // ---- ledges -------------------------------------------------------------------------------
  // A climbable ledge for facing f: a floor tile one row up whose lip lies within the forgiveness
  // window, with open space above the take-off column and walkable floor between us and it.
  findClimb(f) {
    const L = this.g.level, lr = this.rw - 1, k0 = Math.round(this.x / TW);
    let best = null;
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const E = k * TW, dist = (E - this.x) * f;
      if (dist < -CLIMB_UNDER || dist > CLIMB_FRONT) continue;
      const sc = f > 0 ? k - 1 : k, lc = sc + f;
      if (sc < 0 || sc >= COLS) continue;
      if (lr < 0 && (lc < 0 || lc >= COLS)) continue; // never climb diagonally across two room seams
      if (ceilingCh(L.tile(this.room, sc, lr))) continue;
      const led = L.tile(this.room, lc, lr);
      if (!supportsCh(led) || L.blocks(led)) continue;
      const alignX = E - f * 7;
      if (!this.pathClear(alignX)) continue;
      const score = Math.abs(dist - 7);
      if (!best || score < best.score) best = { lc, lr, hd: -f, edge: E, alignX, score, f };
    }
    return best;
  }
  pathClear(x1) {
    const L = this.g.level, c0 = this.col(), c1 = Math.floor(x1 / TW);
    if (c1 < 0 || c1 >= COLS) return false;
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) { const ch = L.tile(this.room, c, this.rw); if (!supportsCh(ch) || L.blocks(ch)) return false; }
    return true;
  }
  // Up pressed (fresh, buffered) or held on the ground. Held Up only ever starts climbs.
  tryUp(inp, dir, running = false) {
    const fresh = this.ub > 0, L = this.g.level;
    if (dir && dir !== this.face) { if (!fresh || running) return false; this.go('turn', { nf: dir }); return true; }
    // Running at full speed + Up (without Shift) always executes a running jump, never interrupts a sprint to climb.
    const wantRunJump = running && dir === this.face && !inp.s && !(this.sb > 0);
    let cl = wantRunJump ? null : this.findClimb(this.face);
    if (!cl && !dir && !running) cl = this.findClimb(-this.face);
    if (cl) {
      // Up + direction toward an immediate pit ahead is a jump across the pit, not a climb.
      const under = L.tile(this.room, cl.lc, this.rw);
      const ahead = this.tileAt(cl.f, 0);
      const gapJump = dir === cl.f && !inp.s && ((!supportsCh(under) && under !== '#') || (!supportsCh(ahead) && ahead !== '#'));
      if (!gapJump) { this.startClimb(cl); return true; }
    }
    if (!fresh) return false;
    this.ub = 0;
    if (running) { this.startJump(true); return true; }
    if (dir === this.face) this.startJump(false); else this.startJumpUp();
    return true;
  }
  startClimb(cl) {
    this.ub = 0; this.face = cl.f; this.climbTarget = cl;
    const d = cl.alignX - this.x;
    if (Math.abs(d) > 8) { this.go('align', { ax0: this.x, n: Math.max(4, Math.ceil(Math.abs(d) / 3)) }); return; }
    this.go('jumpup', { n: 28, ax0: this.x }); this.sfx('jump');
  }
  s_align() {
    const cl = this.climbTarget;
    this.x = this.ax0 + (cl.alignX - this.ax0) * Math.min(1, this.t / this.n); this.normalizeRoom();
    if (this.t >= this.n) { this.x = cl.alignX; this.go('jumpup', { n: 28, ax0: this.x }); this.sfx('jump'); }
  }
  startJumpUp() {
    this.climbTarget = null;
    if (ceilingCh(this.tileAt(0, -1))) { this.go('bumphead'); return; }
    this.go('jumpup', { n: 28, ax0: this.x });
    this.sfx('jump');
  }
  s_bumphead() { if (this.t === 7) this.sfx('bump'); if (this.t >= 22) this.rest(); }
  s_jumpup(inp) {
    const cl = this.climbTarget;
    if (cl) {
      if (this.t <= 7) this.x = this.ax0 + (cl.alignX - this.ax0) * Math.min(1, this.t / 7);
      if (this.t >= 9) { this.climbTarget = null; this.grab(cl.lc, cl.lr, cl.hd, !inp.s || inp.u); return; }
    }
    if (this.t >= this.n) this.rest();
  }
  grab(ledgeCol, ledgeRow, hd, autoClimb = false) {
    const edge = hd > 0 ? (ledgeCol + 1) * TW : ledgeCol * TW;
    let room = this.room, lr = ledgeRow;
    if (lr < 0) { const u = this.g.level.rooms[room].u; if (!u) return false; room = u; lr += 4; }
    this.room = room; this.rw = lr; this.hEdge = edge; this.hd = hd; this.face = -hd;
    this.x = edge + hd * 4; this.y = fy(lr) + HANG_Y; this.vx = 0;
    this.autoClimb = autoClimb; this.hangGrace = 0; this.climbTarget = null;
    this.normalizeRoom();
    this.go('hang'); this.sfx('grab');
    return true;
  }
  ledgeTile() { const lc = Math.floor((this.hEdge - this.hd * 4) / TW); return this.g.level.tile(this.room, lc, this.rw); }
  s_hang(inp) {
    const L = this.g.level, led = this.ledgeTile();
    if (!supportsCh(led)) { this.noGrab = 20; this.startFall(0, 0); return; } // the ledge crumbled away
    if (led === 'L') { const lc = Math.floor((this.hEdge - this.hd * 4) / TW); L.stepOn(this.room, lc, this.rw); }
    if (this.autoClimb || this.ub > 0 || inp.u) {
      this.autoClimb = false; this.ub = 0;
      this.go('climb', { x0: this.x, y0: this.y, n: 26 }); return;
    }
    if (inp.d) { this.noGrab = 14; this.startFall(0, 0); return; }
    if (!inp.s) {
      if (this.hangGrace < 8) { this.hangGrace++; return; }
      this.noGrab = 14; this.startFall(0, 0); return;
    }
    this.hangGrace = 0;
  }
  s_climb() {
    const u = this.t / this.n, x1 = this.hEdge - this.hd * 10, y1 = fy(this.rw);
    this.y = this.y0 + (y1 - this.y0) * Math.min(1, u / 0.6);
    this.x = this.x0 + (x1 - this.x0) * Math.max(0, (u - 0.4) / 0.6);
    if (this.t >= this.n) {
      this.x = x1; this.y = y1; this.normalizeRoom(); this.face = -this.hd; this.go('idle');
      if (this.checkSupport()) this.hazards();
    }
  }
  atLip(f) {
    const ch = this.tileAt(f, 0), edge = f > 0 ? (this.col() + 1) * TW : this.col() * TW;
    return !supportsCh(ch) && ch !== '#' && Math.abs(this.x - edge) <= 20;
  }
  tryClimbDown() {
    for (const f of [this.face, -this.face]) if (this.atLip(f)) { this.face = f; this.startClimbDown(); return true; }
    return false;
  }
  startClimbDown() {
    if (this.rw === 3 && !this.g.level.rooms[this.room].d) { this.go('peek'); return; }
    const hd = this.face, edge = hd > 0 ? (this.col() + 1) * TW : this.col() * TW;
    this.go('climbdown', { x0: this.x, y0: this.y, hd, hEdge: edge, n: 22 });
  }
  s_climbdown(inp) {
    const u = this.t / this.n;
    this.x = this.x0 + (this.hEdge + this.hd * 4 - this.x0) * Math.min(1, u * 1.4);
    this.y = this.y0 + HANG_Y * Math.max(0, (u - 0.2) / 0.8);
    if (this.t === 9) this.face = -this.hd;
    if (this.t >= this.n) { this.y = fy(this.rw) + HANG_Y; this.x = this.hEdge + this.hd * 4; this.autoClimb = false; this.hangGrace = 0; this.go('hang'); }
  }

  // ---- ground movement ---------------------------------------------------------------------
  s_idle(inp, dir) {
    if (!this.checkSupport()) return;
    this.v = 0;
    this.hazards(); if (this.dead) return;
    if (this.pendingDraw) { this.pendingDraw = false; if (this.hasSword && !this.armed) { this.go('draw'); return; } }
    const up = this.ub > 0 || inp.u;
    if (this.kind === 'hero' && up && this.atOpenDoor()) { this.go('enter'); return; }
    if (up && !inp.d && this.tryUp(inp, dir)) return;
    if (inp.d) { if (this.tryClimbDown()) return; return this.go('crouch'); }
    if (dir) {
      if (dir !== this.face) return this.go('turn', { nf: dir });
      if (inp.s) return this.startStep();
      return this.go('runstart');
    }
    if (this.sb > 0 && this.kind === 'hero' && this.tryPickup()) { this.sb = 0; }
  }
  atOpenDoor() {
    const L = this.g.level, d = L.door;
    return d && d.room === this.room && d.r === this.rw && L.doorOpen > 0.9 && Math.abs(this.x - (d.c * TW + TW / 2)) < 20;
  }
  tryPickup() {
    const it = this.g.level.itemAt(this.room, this.col(), this.rw);
    if (!it || Math.abs(this.x - (it.c * TW + TW / 2)) > 18) return false;
    this.go('pickup', { item: it }); return true;
  }
  s_pickup() {
    if (!this.checkSupport()) return;
    this.hazards(); if (this.dead) return;
    if (this.t === 14 && this.item && !this.item.taken) { this.item.taken = true; this.g.applyItem(this, this.item); }
    if (this.t >= 32) this.rest();
  }
  s_turn() {
    if (!this.checkSupport()) return;
    this.hazards(); if (this.dead) return;
    if (this.t === 3) this.face = this.nf || -this.face;
    if (this.t >= 7) this.rest();
  }
  s_crouch(inp) {
    if (!this.checkSupport()) return;
    this.hazards(); if (this.dead) return;
    if (!inp.d && this.t > 3) this.rest();
  }
  startStep() {
    const f = this.face, ahead = this.tileAt(f, 0);
    const edge = f > 0 ? (this.col() + 1) * TW : this.col() * TW;
    let len = 11;
    if (!supportsCh(ahead) && ahead !== '#' && !isGateCh(ahead)) len = Math.max(0, Math.min(len, f * (edge - this.x) - 3));
    if (len < 1) return this.go('peek');
    this.go('step', { len, n: 10, sx0: this.x, stepPar: this.stepPar ^ 1 });
  }
  s_peek(inp, dir) {
    if (!this.checkSupport()) return;
    const up = this.ub > 0 || inp.u;
    if (up && !inp.d && this.tryUp(inp, dir)) return;
    if (inp.d && this.tryClimbDown()) return;
    if (dir && dir !== this.face) return this.go('turn', { nf: dir });
    if (this.t >= 12) this.rest();
  }
  s_step(inp, dir) {
    this.moveX(this.face * this.len / this.n);
    if (!this.checkSupport()) return;
    this.hazards();
    if (this.dead) return;
    if ((this.ub > 0 || inp.u) && !inp.d && this.t >= 2) { const cl = this.findClimb(this.face); if (cl) return this.startClimb(cl); }
    if (this.t >= this.n) { if (this.pendingDraw) return this.rest(); if (inp.s && dir === this.face && !inp.u) this.startStep(); else this.rest(); }
  }
  s_runstart(inp, dir) {
    this.v = Math.min(RUN_V, 0.6 + this.t * 0.2);
    if (!this.runCommon(inp, dir)) return;
    if (this.t >= 8) this.go('run');
  }
  s_run(inp, dir) {
    this.v = RUN_V;
    this.runCommon(inp, dir);
  }
  runCommon(inp, dir) {
    if ((this.ub > 0 || inp.u) && !inp.d && !this.alertStop && !this.pendingDraw && (dir === this.face || !dir)) {
      if (this.tryUp(inp, dir === this.face ? dir : 0, true)) return false;
    }
    if (!dir || inp.s || this.alertStop || this.pendingDraw) { this.go('skid', { v0: this.v }); return false; }
    if (dir !== this.face) { this.go('rturn', { v0: this.v }); return false; }
    if (!this.moveX(this.face * this.v)) { this.go('bump', { bf: -this.face }); this.sfx('bump'); return false; }
    if (!this.checkSupport()) return false;
    this.hazards();
    return !this.dead;
  }
  skidLen() { return this.g.level.def.ice ? 24 : 12; }
  s_skid(inp, dir) {
    const n = this.skidLen();
    this.moveX(this.face * this.v0 * Math.max(0, 1 - this.t / n));
    if (!this.checkSupport()) return;
    this.hazards();
    if (this.dead) return;
    if ((this.ub > 0 || inp.u) && !inp.d && !this.alertStop && !this.pendingDraw) {
      const cl = this.findClimb(this.face);
      if (cl) { this.startClimb(cl); return; }
      if (this.ub > 0 && dir === this.face && !inp.s && this.t < 5) { this.ub = 0; this.startJump(true); return; }
    }
    if (dir === this.face && this.t > 5 && !inp.s && !this.alertStop && !this.pendingDraw) { this.go('runstart'); return; }
    if (this.t >= n) this.rest();
  }
  s_rturn(inp, dir) {
    const ice = this.g.level.def.ice, brk = ice ? 20 : 10, tot = ice ? 24 : 14;
    if (this.t <= brk) { this.moveX(this.face * this.v0 * (1 - this.t / brk)); if (!this.checkSupport()) return; this.hazards(); if (this.dead) return; }
    if (this.t === brk) this.face = -this.face;
    if (this.t >= tot) {
      if (dir === this.face && !inp.s && !this.alertStop && !this.pendingDraw && !(this.ub > 0)) { this.go('runstart', { v: 1 }); return; }
      this.rest();
    }
  }
  s_bump() { this.moveX(this.bf * 0.4); if (this.t >= 14) this.rest(); }
  s_land(inp, dir) {
    if (!this.checkSupport()) return;
    if (this.t >= this.ln) {
      if (dir === this.face && !inp.s && !this.armed && !this.alertStop && !this.pendingDraw && !(this.ub > 0)) { this.go('runstart'); return; }
      this.rest();
    }
  }

  // ---- jumps -------------------------------------------------------------------------------
  startJump(running) {
    this.go('jump', { run: running, n: running ? 30 : 24, dist: running ? RUN_JUMP : STAND_JUMP, h: running ? 16 : 13 });
    this.sfx('jump');
  }
  s_jump(inp, dir) {
    const L = this.g.level, sp = this.dist / this.n;
    if (!this.moveX(this.face * sp)) { this.startFall(0); return; }
    if (this.tileAt() === 'S' && L.slicerLethal(this.col())) { this.die('sliced'); return; }
    if (this.t >= this.n) {
      if (!supportsCh(this.tileAt())) {
        // landing assist: a few pixels short of the far lip still counts as landing on it
        const f = this.face, E = f > 0 ? (this.col() + 1) * TW : this.col() * TW, nxt = this.tileAt(f, 0);
        if ((E - this.x) * f <= 9 && supportsCh(nxt) && !L.blocks(nxt)) { this.x = E + f * (HW + 1); this.normalizeRoom(); }
      }
      const ch = this.tileAt();
      if (supportsCh(ch)) {
        if (ch === '^') { this.die('spikes'); return; }
        this.hazards(); if (this.dead) return;
        this.sfx('land');
        if (this.run && dir === this.face && !this.armed && !this.alertStop && !this.pendingDraw) { this.v = RUN_V; this.go('run'); }
        else this.go('land', { ln: this.run ? 8 : 6 });
      } else this.startFall(sp * 0.45);
    }
  }

  // ---- falling -----------------------------------------------------------------------------
  // Is there a floor slab in column c whose top is above our feet but within our body height?
  slabAt(c) {
    const L = this.g.level;
    for (let k = -1; k < 4; k++) { const top = fy(k); if (top < this.y - 0.5 && top > this.y - 40 && supportsCh(L.tile(this.room, c, k))) return true; }
    return false;
  }
  s_fall(inp) {
    const L = this.g.level;
    this.vy = Math.min(4.5, this.vy + 0.22);
    const py = this.y; this.y += this.vy; this.fallDist += this.vy;
    this.vx *= 0.97;
    if (this.vx) {
      const s = Math.sign(this.vx), ec = Math.floor((this.x + this.vx + s * HW) / TW);
      if (ec !== Math.floor((this.x + s * HW) / TW) && this.slabAt(ec)) {
        this.x = s > 0 ? Math.min(this.x, ec * TW - HW - 0.01) : Math.max(this.x, (ec + 1) * TW + HW + 0.01); this.vx = 0;
      } else if (!this.moveX(this.vx)) this.vx = 0;
    }
    const c = this.col();
    for (let k = Math.floor(py / TH); k <= Math.floor(this.y / TH); k++) {
      if (k > 3) break;
      if (py < fy(k) && fy(k) <= this.y && supportsCh(L.tile(this.room, c, k))) {
        this.y = fy(k); this.rw = k;
        this.land(this.fallDist); return;
      }
    }
    this.rw = Math.max(0, Math.min(3, Math.floor(this.y / TH)));
    if ((inp.s || this.sb > 0 || inp.u) && this.noGrab <= 0 && this.fallDist > 4) {
      if (this.tryFallGrab()) return;
    }
    if (this.y >= 4 * TH) {
      const R = L.rooms[this.room];
      if (R.d) { this.room = R.d; this.y -= 4 * TH; this.rw = Math.max(0, Math.min(3, Math.floor(this.y / TH))); }
      else if (this.y >= 4 * TH + HANG_Y + 24) {
        if (this.kind === 'hero' && this.g.god) { this.g.respawnHero(); return; }
        this.die('void'); this.y = H + 40; return;
      }
    }
  }
  // Catch a ledge while falling: any floor lip within reach of the hands, on either side.
  tryFallGrab() {
    const L = this.g.level;
    let best = null;
    for (let k = -1; k < 4; k++) {
      const hy = fy(k) + HANG_Y;
      if (this.y < hy - 18 || this.y > hy + 22) continue;
      const k0 = Math.round(this.x / TW);
      for (let e = k0 - 1; e <= k0 + 1; e++) {
        const E = e * TW;
        if (Math.abs(this.x - E) > 20) continue;
        for (const hd of [-1, 1]) {
          // hd = side of the ledge we hang on; ledge column lc, hanging column hc
          const lc = hd < 0 ? e : e - 1, hc = hd < 0 ? e - 1 : e;
          if (k < 0 && (lc < 0 || lc >= COLS || hc < 0 || hc >= COLS)) continue;
          const led = L.tile(this.room, lc, k), sp = L.tile(this.room, hc, k);
          if (!supportsCh(led) || L.blocks(led) || supportsCh(sp) || sp === '#') continue;
          const score = Math.abs(this.x - E) + (-hd === this.face ? 0 : 6);
          if (!best || score < best.score) best = { lc, k, hd, score };
        }
      }
    }
    if (!best) return false;
    return this.grab(best.lc, best.k, best.hd, false);
  }
  land(dist) {
    const ch = this.tileAt();
    this.sfx('land');
    if (ch === '^') { this.die('spikes'); return; }
    if (dist > 112) { this.die('fall'); return; }
    this.v = 0;
    if (dist > 62) { this.hurtBy('fall'); if (!this.dead) this.go('land', { ln: 28 }); return; }
    this.go('land', { ln: dist > 28 ? 12 : 4 });
    this.hazards();
  }

  // ---- misc --------------------------------------------------------------------------------
  s_enter() { if (this.t >= 44) this.exited = true; }
  s_dying() { /* stays down */ }

  // ---- fencing -----------------------------------------------------------------------------
  s_draw() { if (this.t === 8) { this.armed = true; this.sfx('draw'); } if (this.t >= 16) this.go('fready'); }
  s_sheathe(inp) { if (this.t === 7) { this.armed = false; this.sfx('draw'); } if (this.t >= 14) this.go('idle'); }
  s_fready(inp, dir) {
    if (!this.checkSupport()) return;
    this.hazards(); if (this.dead) return;
    if (this.kind === 'hero') {
      if (inp.d) { this.go('sheathe'); return; }
    }
    if (this.ub > 0) { this.ub = 0; this.go('fparry'); return; }
    if (this.sb > 0) { this.sb = 0; this.go('fstrike', { fast: this.riposte > 0 }); this.riposte = 0; return; }
    if (dir) { this.go(dir === this.face ? 'fadv' : 'fret'); }
  }
  s_fadv(inp, dir) {
    if (!this.moveX(this.face * 0.75)) { this.rest(); return; }
    if (!this.checkSupport()) return;
    this.hazards(); if (this.dead) return;
    if (this.t >= 8) this.go('fready');
  }
  s_fret(inp, dir) {
    this.moveX(-this.face * 0.6);
    if (!this.checkSupport()) return;
    this.hazards(); if (this.dead) return;
    if (this.t >= 8) this.go('fready');
  }
  // Strike: wind-up, lunge, hit. A riposte (strike straight after a successful parry) is faster.
  s_fstrike() {
    const hit = this.fast ? 4 : 6, end = this.fast ? 12 : 15;
    if (this.t === 1) this.sfx('swish');
    if (this.t >= 2 && this.t <= hit) { this.moveX(this.face * 0.8); if (!this.checkSupport()) return; }
    if (this.t === hit) this.g.resolveStrike(this);
    if (this.t >= end) this.go('fready');
  }
  s_fparry(inp) {
    // after a successful parry, Shift cancels straight into a fast riposte
    if (this.parried && (this.sb > 0 || inp.s) && this.t >= 3) { this.parried = false; this.sb = 0; this.go('fstrike', { fast: true }); return; }
    if (this.t >= 12) { if (this.parried) this.riposte = 14; this.parried = false; this.go('fready'); }
  }
  s_frecoil() { this.moveX(-this.face * 0.5); if (this.t >= (this.longRecoil ? 22 : 12)) { this.longRecoil = false; this.go('fready'); } }
  s_fhit() {
    if (this.t < 7) { this.moveX(this.kb * 1.5); if (!supportsCh(this.tileAt())) { this.startFall(this.kb * 0.8); return; } this.hazards(); }
    if (this.t >= 16) this.go('fready');
  }
}
