// Game orchestration: modes, level lifecycle, combat awareness, timer, story hooks.
import { Level, TW, fy } from './level.js';
import { Actor } from './player.js';
import { makeGuard, guardInput, canSee, floorBetween } from './enemy.js';
import * as S from './story.js';

const SAVE_KEY = 'prince-of-zurich-save-v1';
const EMPTY = { l: false, r: false, u: false, d: false, s: false };
const TOTAL = 3600;

export class Game {
  constructor(defs, io) {
    this.defs = defs; this.io = io; // io: {held, took, sfx, music, jingle, toggleMute}
    this.frame = 0; this.mode = 'title'; this.god = false; this.godOn = false;
    this.timeLeft = TOTAL; this.maxhp = 3; this.hasSword = false; this.levelIdx = 0;
    this.cards = []; this.cardI = 0; this.afterCards = null; this.cardLevel = 0;
    this.menuI = 0; this.menu = []; this.level = null; this.hero = null; this.actors = [];
    this.notice = null; this.clockT = 0; this.flashT = 0; this.deadT = 0; this.deathLine = '';
    this.currentEnemy = null; this.track = ''; this.muted = false; this.endBad = false;
    this.ghost = null; this.mirrorDone = false; this.sabDone = new Set(); this.warned = new Set(); this.noFoeT = 0;
    this.refreshMenu();
  }
  // ---- persistence
  loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.level >= 0 ? s : null; } catch (e) { return null; } }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ level: this.levelIdx, time: this.timeLeft, maxhp: this.maxhp, sword: this.hasSword })); } catch (e) { /* ignore */ } }
  refreshMenu() {
    const s = this.loadSave();
    this.menu = [{ label: 'START', act: () => this.newGame() }];
    if (s) this.menu.push({ label: 'CONTINUE - LEVEL ' + (s.level + 1) + ' - ' + Math.floor(s.time / 60) + ' MIN', act: () => this.continueGame(s) });
    this.menuI = 0;
  }
  // ---- flow
  newGame() { this.timeLeft = TOTAL; this.maxhp = 3; this.hasSword = false; this.levelIdx = 0; this.warned = new Set(); this.showCards(S.INTRO, () => this.levelIntro(0)); }
  continueGame(s) { this.timeLeft = s.time; this.maxhp = s.maxhp; this.hasSword = s.sword; this.warned = new Set(); this.levelIntro(s.level); }
  debugStart(n) { this.timeLeft = TOTAL; this.maxhp = 3; this.hasSword = n > 0; this.warned = new Set(); this.startLevel(n); }
  showCards(cards, after, lvl) { this.cards = cards; this.cardI = 0; this.afterCards = after; this.mode = 'cards'; if (lvl !== undefined) this.cardLevel = lvl; this.io.sfx('card'); }
  levelIntro(i) {
    const L = S.LEVELS[i]; this.levelIdx = i;
    this.showCards([{ h: 'LEVEL ' + (i + 1) + ': ' + L.name, t: L.place + '. ' + L.tip, clock: true }], () => this.startLevel(i), i);
  }
  startLevel(i) {
    this.levelIdx = i; this.def = this.defs[i];
    this.level = new Level(this.def, i);
    const s = this.def.start;
    const h = new Actor(this, 'hero', s.room, s.c, s.r, s.face || 1);
    h.maxhp = this.maxhp; h.hp = this.maxhp; h.hasSword = this.hasSword;
    this.hero = h; this.actors = [h];
    for (const [id, R] of Object.entries(this.level.rooms)) for (const gs of R.rd.g || []) this.actors.push(makeGuard(this, gs, id));
    this.mode = 'play'; this.deadT = 0; this.ghost = null; this.mirrorDone = false; this.sabDone = new Set(); this.currentEnemy = null;
    this.notice = null; this.clockT = 0; this.flashT = 0;
    this.godOn = this.god; this.track = ''; this.noFoeT = 0; this.climbHintDone = false; this.swordHintDone = false; this.celineGreeted = false; this.lastTickSec = -1;
    this.save();
  }
  restartLevel() { this.startLevel(this.levelIdx); }
  completeLevel() {
    const i = this.levelIdx; this.maxhp = this.hero.maxhp; this.hasSword = this.hero.hasSword;
    this.io.music('victory'); this.track = 'victory';
    if (i >= 4) {
      const t = Math.max(0, Math.ceil(this.timeLeft));
      this.showCards(S.endingCards(Math.floor(t / 60), t % 60), () => { this.mode = 'end'; this.endBad = false; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } }, 4);
      return;
    }
    this.levelIdx = i + 1; this.save();
    this.showCards([S.LEVELS[i].end], () => this.levelIntro(i + 1), i);
  }
  timeUp() {
    this.io.music('death'); this.track = 'death';
    this.showCards(S.TIMEUP, () => { this.mode = 'end'; this.endBad = true; }, 4);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
  }
  say(text, t = 220) { this.notice = { text, t }; }
  sfx(n, a) { if (!a || !this.hero || a.room === this.hero.room) this.io.sfx(n); }

  // ---- game rules used by actors
  applyItem(a, it) {
    if (it.t === 's') { a.hp = Math.min(a.maxhp, a.hp + 1); this.io.sfx('elixir'); this.say('A SMALL ELIXIR. ONE HEALTH RESTORED.', 140); }
    else if (it.t === 'L') { a.maxhp++; a.hp = a.maxhp; this.io.sfx('elixir'); this.say('A LARGE ELIXIR. MAXIMUM HEALTH UP, FULL RECOVERY.', 160); }
    else if (it.t === 'p') { this.io.sfx('poison'); this.say('POISON. THE LABEL WAS IN ANOTHER LANGUAGE.', 140); a.hurtBy('poison'); }
    else if (it.t === 'w') { a.hasSword = true; this.io.sfx('item'); this.say('A CEREMONIAL GUILD SABRE. BLUNT IN TRADITION, SHARP IN PRACTICE.', 220); }
  }
  resolveStrike(a) {
    const foes = this.actors.filter((o) => o !== a && !o.dead && !o.ghost && o.room === a.room && Math.abs(o.y - a.y) < 24 && (o.x - a.x) * a.face > 0 && Math.abs(o.x - a.x) <= 34)
      .sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
    const o = foes[0]; if (!o) return;
    if (a.kind !== 'hero' && o.kind !== 'hero') return;
    if (a.kind === 'deepfake') return;
    if (o.kind !== 'deepfake' && o.st === 'fparry' && o.t <= 11 && o.face === -a.face && o.armed) { a.go('frecoil', { longRecoil: true }); o.parried = true; this.io.sfx('clang'); return; }
    o.takeHit(a);
  }
  mirrorStruck() { if (!this.mirrorHint) { this.mirrorHint = true; this.say('STRIKING YOUR COPY HURTS YOU. SHEATHE YOUR SWORD (DOWN) AND WALK INTO IT.', 300); } }
  respawnHero() { const s = this.def.start, h = this.hero; h.room = s.room; h.x = s.c * TW + 16; h.y = fy(s.r); h.rw = s.r; h.go('idle'); }

  // ---- per-frame
  update() {
    this.frame++;
    const k = this.io;
    if (k.took('m')) this.muted = k.toggleMute();
    switch (this.mode) {
      case 'title': this.tickTitle(); break;
      case 'cards':
        if (k.took('esc')) { k.sfx('card'); const f = this.afterCards; this.afterCards = null; if (f) f(); }
        else if (k.took('enter') || k.took('space') || k.took('shift')) { k.sfx('card'); if (++this.cardI >= this.cards.length) { const f = this.afterCards; this.afterCards = null; if (f) f(); } }
        break;
      case 'pause': if (k.took('esc')) this.mode = 'play'; break;
      case 'end': if (k.took('enter')) { this.mode = 'title'; this.refreshMenu(); } break;
      case 'play': this.tickPlay(); break;
    }
    if (this.mode === 'title') this.setTrack('title');
    else if (this.mode === 'cards' && !this.track) this.setTrack('title');
    else if (this.mode === 'end' && this.endBad) this.setTrack('death');
    if (k.duck) k.duck(this.mode === 'pause' || this.mode === 'cards');
  }
  setTrack(t) { if (t !== this.track) { this.track = t; this.io.music(t); } }
  tickTitle() {
    const k = this.io;
    if (k.took('up')) this.menuI = (this.menuI + this.menu.length - 1) % this.menu.length;
    if (k.took('down')) this.menuI = (this.menuI + 1) % this.menu.length;
    if (k.took('enter') || k.took('space')) { k.sfx('card'); this.menu[this.menuI].act(); }
  }
  heroInput() { const h = this.io.held; return { l: h.left, r: h.right, u: h.up, d: h.down, s: h.shift }; }
  tickPlay() {
    const k = this.io, h = this.hero, L = this.level;
    if (k.took('esc')) { this.mode = 'pause'; return; }
    if (k.took('r') && !h.exited) { this.restartLevel(); return; }
    if (k.took('space')) this.clockT = 150;
    if (!h.exited) this.timeLeft -= 1 / 60;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.timeUp(); return; }
    if (this.timeLeft <= 60) {
      const sec = Math.floor(this.timeLeft);
      if (sec !== this.lastTickSec) { this.lastTickSec = sec; k.sfx('tick'); }
    }
    for (const m of [300, 60]) if (this.timeLeft <= m && !this.warned.has(m)) { this.warned.add(m); this.say(m === 300 ? 'FIVE MINUTES LEFT.' : 'ONE MINUTE LEFT. THE TRAINS ARE ON TIME, BUT YOU ARE NOT.', 260); this.clockT = 260; k.sfx('warn'); }
    if (this.notice && this.notice.t > 0) this.notice.t--;
    if (this.clockT > 0) this.clockT--;
    if (this.flashT > 0) this.flashT--;
    h.update(h.dead ? EMPTY : this.heroInput());
    for (const a of this.actors) {
      if (a === h || a.room !== h.room) continue;
      a.update(a.dead ? EMPTY : guardInput(a, h, L));
    }
    L.update(this.actors);
    for (const e of L.events.splice(0)) k.sfx(e);
    if ((h.st === 'run' && h.t % 8 === 0) || (h.st === 'runstart' && h.t % 4 === 0) || (h.st === 'step' && h.t === 5)) k.sfx('step');
    if (!h.dead) {
      if (L.idx === 0 && h.room === 'b2' && !this.climbHintDone) {
        this.climbHintDone = true;
        this.say('PRESS UP NEAR A LEDGE TO CLIMB. HOLD SHIFT TO HANG OR STEP CAREFULLY.', 240);
      }
      if (L.idx === 0 && (h.room === 'a3' || h.room === 'a4') && !h.hasSword && !this.swordHintDone) {
        this.swordHintDone = true;
        this.say('A GUARD BLOCKS THE EXIT TO THE RIGHT. SEARCH THE UPPER VAULTS TO THE LEFT FOR A WEAPON.', 260);
      }
      this.combat(); this.specials();
    }
    if (h.dead) {
      this.deadT++;
      if (this.deadT === 1) { k.music('death'); this.track = 'death'; this.deathLine = S.DEATH[Math.floor(Math.random() * S.DEATH.length)]; }
      if ((this.deadT > 50 && (k.took('enter') || k.took('r'))) || this.deadT > 240) { this.restartLevel(); return; }
    }
    if (h.exited) { this.completeLevel(); return; }
    this.updateGhost();
  }
  combat() {
    const h = this.hero, L = this.level;
    const foes = this.actors.filter((a) => a !== h && !a.dead && !a.ghost && a.room === h.room && (a.kind === 'guard' || a.kind === 'deepfake'));
    const seen = foes.filter((a) => canSee(a, h, L) || (a.ai && a.ai.alert > 0 && Math.abs(a.y - h.y) < 24 && Math.abs(a.x - h.x) < 170));
    seen.sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x));
    this.currentEnemy = seen[0] || null;
    const near = seen.find((a) => Math.abs(a.x - h.x) < 112 && Math.abs(a.y - h.y) < 24 && floorBetween(a, h, L));
    if (near) {
      this.noFoeT = 0;
      if (h.st === 'sheathe') h.sheathedChoice = true;
      if (h.sheathedChoice && near.kind !== 'deepfake' && Math.abs(near.x - h.x) < 64) h.sheathedChoice = false;
      if (h.hasSword && !h.sheathedChoice) { h.alertStop = true; if (!h.armed && h.st !== 'draw') h.pendingDraw = true; } else { h.alertStop = false; h.pendingDraw = false; }
      if (h.st === 'fready' && h.t > 2) h.face = Math.sign(near.x - h.x) || h.face;
    } else {
      h.alertStop = false; h.pendingDraw = false; if (!seen.length) h.sheathedChoice = false; this.noFoeT++;
      if (h.armed && h.st === 'fready' && this.noFoeT > 70) h.go('sheathe');
    }
    for (const d of foes) {
      if (d.kind === 'deepfake' && !h.armed && !['draw', 'sheathe', 'fall', 'hang', 'climb', 'climbdown'].includes(h.st) && Math.abs(d.x - h.x) <= 17 && Math.abs(d.y - h.y) < 20) {
        d.dead = true; d.hp = 0; this.actors.splice(this.actors.indexOf(d), 1);
        h.hp = h.maxhp; this.io.sfx('elixir'); this.io.sfx('mirror'); this.say(S.MERGE_MSG, 240); this.flashT = 40; this.currentEnemy = null;
      }
    }
    const boss = seen.some((a) => a.boss);
    this.setTrack(boss ? 'duel' : 'level' + L.idx);
  }
  specials() {
    const h = this.hero, L = this.level, m = L.mirror;
    if (m && !this.mirrorDone && h.room === m.room && h.col() === m.c && h.rw === m.r && ['run', 'runstart', 'jump', 'skid', 'step', 'rturn'].includes(h.st)) {
      this.mirrorDone = true; this.flashT = 40; this.io.sfx('mirror'); this.say(S.MIRROR_MSG, 260);
    }
    for (const [i, s] of (this.def.sabotage || []).entries()) {
      if (this.mirrorDone && !this.sabDone.has(i) && h.room === s.room) { this.sabDone.add(i); this.spawnGhost(s); }
    }
    const cel = this.def.celine;
    if (cel && h.room === cel.room) {
      const zinsAlive = this.actors.some((a) => a.boss && !a.dead);
      const cx = cel.c * TW + TW / 2, cr = cel.r ?? 3;
      if (!this.celineGreeted) {
        this.celineGreeted = true;
        this.say(zinsAlive ? 'CÉLINE: ZINS IS STILL BEHIND YOU!' : 'CÉLINE: YOU ARE LATE. COME HERE - LET US ABORT THE MERGE!', 260);
      }
      if (!zinsAlive && h.rw === cr && Math.abs(h.x - cx) <= 22 && h.onGround()) {
        if (!L.doorUnlocked) { L.doorUnlocked = true; this.io.sfx('door'); }
        h.exited = true;
      }
    }
  }
  spawnGhost(s) {
    let tx = 192;
    if (s.type === 'steal') tx = s.c * TW + 16;
    else { const g = this.level.gates[s.id]; const cell = g && g.cells.find((q) => q.room === s.room); tx = cell ? cell.c * TW + 16 : 192; }
    const from = tx < 192 ? 372 : 12, a = new Actor(this, 'ghost', s.room, 0, 3, from < tx ? 1 : -1);
    a.ghost = true; a.x = from; a.y = fy(3); a.kind = 'deepfake'; a.st = 'run';
    this.ghost = { room: s.room, actor: a, s, tx, from, phase: 0, t: 0 };
  }
  updateGhost() {
    const G = this.ghost; if (!G) return;
    const a = G.actor; a.t++; G.t++;
    if (G.phase === 0) {
      a.st = 'run'; a.face = Math.sign(G.tx - a.x) || 1; a.x += a.face * 2.4;
      if (Math.abs(G.tx - a.x) < 3) { G.phase = 1; G.t = 0; a.st = 'pickup'; a.t = 0; }
    } else if (G.phase === 1) {
      a.t = G.t;
      if (G.t === 14) {
        if (G.s.type === 'steal') { const it = this.level.itemAt(G.s.room, G.s.c, G.s.r); if (it) { it.taken = true; this.say(S.SAB.steal, 220); this.io.sfx('item'); } }
        else { const g = this.level.gates[G.s.id]; if (g) { g.lock = 420; g.open = Math.min(g.open, 0.5); this.say(S.SAB.gate, 220); this.io.sfx('gateclose'); } }
      }
      if (G.t > 30) { G.phase = 2; a.st = 'run'; a.t = 0; a.face = G.from < G.tx ? -1 : 1; }
    } else {
      a.x += a.face * 2.6; if (a.x < -20 || a.x > 404) this.ghost = null;
    }
  }
}
