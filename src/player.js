// src/player.js
// Deliberate, tile-committed 1989-style platformer movement, ledge climbing,
// fall damage, trap interactions, item pickups, and fencing combat.

import {
  VIEW_W, PLAY_H, COLS, ROWS, TILE_W, TILE_H,
  floorY, tileCenterX, colOfX,
} from './level.js';

const BODY_HALF_W = 6;
const RUN_SPEED = 104;
const GRAVITY = 460;
const MAX_FALL = 260;

// Climbing forgiveness tuning (see tools/test-climb.mjs)
export const CLIMB_REACH = 28;        // px outside the open column the hero will auto-shuffle to climb
const CLIMB_AHEAD_REACH = 128;        // px ahead a running hero will keep running to reach a ledge
const CLIMB_INTENT_TIME = 0.6;        // s an early Up press is remembered while running toward a ledge
const CATCH_HANDS_WINDOW = 14;        // px vertical window for catching a ledge while falling
const CATCH_EDGE_WINDOW = 22;         // px horizontal window for catching a ledge while falling/jumping
// Standing jump clears one empty tile; running jump clears two and can catch the ledge across
// three. Stand jump has a short crouch windup; both fly with constant horizontal speed on a
// parabolic arc (ballistic), then absorb on landing.
const STAND_JUMP = { dist: 56, dur: 0.56, arc: 17, windup: 0.1 };
const RUN_JUMP = { dist: 96, dur: 0.58, arc: 20, windup: 0 };
const TAILWIND_RUN_JUMP = { dist: 132, dur: 0.68, arc: 24, windup: 0 };
const SKID_TIME = 0.34;      // stone: ~half a tile of boot slide
const ICE_SKID_TIME = 0.7;   // glacier ice: ~a full tile
const COYOTE_TIME = 0.1;     // s after running off an edge in which Up still launches a running jump

export class Player {
  constructor(startDef, maxHp = 3) {
    this.roomId = startDef.room;
    this.row = startDef.row;
    this.x = tileCenterX(startDef.col);
    this.y = floorY(startDef.row);
    this.vx = 0;
    this.vy = 0;
    this.facing = startDef.facing || 1;
    this.palette = 'hero';

    this.maxHp = maxHp;
    this.hp = maxHp;
    this.alive = true;
    this.grounded = true;
    this.hasSword = !!startDef.hasSword;
    this.swordDrawn = false;
    this.sheathedLock = 0; // cooldown after manual sheathe (lets you walk into Deepfake!)

    this.state = 'idle';
    this.stateTimer = 0;
    this.stateDur = 0.2;
    this.anim = 'idle';
    this.animT = 0;
    this.stepSoundPhase = 0;
    this.hurtFlash = 0;

    // Action metadata
    this.fallStartY = this.y;
    this.jumpStartX = 0;
    this.jumpTargetX = 0;
    this.jumpBaseY = 0;
    this.jumpArc = 14;
    this.hangLedge = null; // { roomId, col, row, facing }
    this.hangGrace = 0;
    this.jumpUpAutoClimb = false;
    this.climbIntent = 0; // remembered Up press while running toward a ledge
    this.climbFrom = null;
    this.climbTo = null;
    this.pickupItem = null;
    this.strikeHitDone = false;
    this.strikeId = 0;
    this.strikeIsRiposte = false;
    this.strikeWhiffed = false;
    this.riposteWindow = 0;
    this.riposteQueued = false;
    this.parrySuccess = false;
    this.parryActive = false;
    this.parryCooldown = 0;
    this.emptyParryStreak = 0;
    this.emptyParryDecay = 0;
    this.consecutiveStrikes = 0;
    this.strikeChainDecay = 0;
    this.lastSafePos = { roomId: this.roomId, x: this.x, y: this.y, row: this.row };

    // Callbacks injected by Game
    this.onDamage = null;
    this.onDeath = null;
    this.onExitLevel = null;
    this.onEvent = null;
    this.godMode = false;
    this.currentTime = 0;
    this._bracingShift = false;
  }

  takeDamage(amount, reason = 'injury', knockDir = 0) {
    if (!this.alive) return;
    if (this.godMode) {
      this.hurtFlash = 0.25;
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 0.5;
    this.onDamage?.(amount, reason);

    if (this.hp <= 0) {
      this.die(reason);
      return;
    }

    if (knockDir !== 0 && this.grounded) {
      this.vx = knockDir * 72;
      this.enterState('combat_hit', 0.26);
    }
  }

  die(reason = 'PRINZ HAS FALLEN') {
    if (!this.alive) return;
    if (this.godMode) {
      // In god mode, recover safely if bottomless fall
      if (reason === 'bottomless') {
        this.roomId = this.lastSafePos.roomId;
        this.x = this.lastSafePos.x;
        this.y = this.lastSafePos.y;
        this.row = this.lastSafePos.row;
        this.vy = 0;
        this.vx = 0;
        this.grounded = true;
        this.enterState('idle', 0.2);
      }
      return;
    }
    this.hp = 0;
    this.alive = false;
    this.swordDrawn = false;
    this.vx = 0;
    this.vy = 0;
    this.enterState('dead', 0.55);
    this.onDeath?.(reason);
  }

  enterState(state, duration = 0.2) {
    this.state = state;
    this.stateTimer = 0;
    this.stateDur = Math.max(0.01, duration);
    this.anim = state;
    this.animT = 0;
  }

  update(dt, time, input, level, enemies, audio) {
    this.currentTime = time;
    this._bracingShift = !!(input && input.shift);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.sheathedLock > 0) this.sheathedLock = Math.max(0, this.sheathedLock - dt);
    if (this.riposteWindow > 0) this.riposteWindow = Math.max(0, this.riposteWindow - dt);
    if (this.parryCooldown > 0) this.parryCooldown = Math.max(0, this.parryCooldown - dt);
    if (this.emptyParryDecay > 0) {
      this.emptyParryDecay = Math.max(0, this.emptyParryDecay - dt);
      if (this.emptyParryDecay === 0) this.emptyParryStreak = 0;
    }
    if (this.strikeChainDecay > 0) {
      this.strikeChainDecay = Math.max(0, this.strikeChainDecay - dt);
      if (this.strikeChainDecay === 0) this.consecutiveStrikes = 0;
    }
    if (this.climbIntent > 0) this.climbIntent = Math.max(0, this.climbIntent - dt);
    if (this.coyote > 0) this.coyote = Math.max(0, this.coyote - dt);

    if (!this.alive) {
      this.stateTimer += dt;
      this.anim = 'dead';
      this.animT = Math.min(1, this.stateTimer / this.stateDur);
      return;
    }

    // Track last safe grounded spot (not loose floor, not spikes)
    if (this.grounded) {
      const c = colOfX(this.x);
      const t = level.getTile(this.roomId, c, this.row);
      if (t === '_' || t === 'P' || t === 'E') {
        this.lastSafePos = { roomId: this.roomId, x: this.x, y: this.y, row: this.row };
      }
    }

    // Auto-draw sword when facing an armed enemy on same floor in view
    const duelTarget = this._findDuelEnemy(level, enemies);
    if (duelTarget && this.hasSword && this.grounded && this.sheathedLock <= 0) {
      const inNormalMove = this.state === 'idle' || this.state === 'run' ||
        this.state === 'run_start' || this.state === 'skid' || this.state === 'careful' ||
        this.state === 'land' || this.state === 'run_turn';
      if (inNormalMove && !this.swordDrawn) {
        // Don't auto-draw against a sheathed Deepfake!
        if (!(duelTarget.type === 'deepfake' && !duelTarget.swordDrawn)) {
          this.swordDrawn = true;
          this.facing = duelTarget.x >= this.x ? 1 : -1;
          this.vx = 0;
          audio.play('swordDraw');
          this.enterState('combat_idle', 0.2);
          this.onEvent?.('combatStart', duelTarget);
        }
      }
    } else if (this.swordDrawn && !duelTarget && this.state === 'combat_idle') {
      // Automatically sheathe when no enemy remains on this floor
      this.swordDrawn = false;
      this.enterState('sheathe', 0.24);
    }

    // State machine
    switch (this.state) {
      case 'idle': this._updateIdle(dt, input, level, enemies, audio); break;
      case 'run_start': this._updateRunStart(dt, input, level, audio); break;
      case 'run': this._updateRun(dt, input, level, audio); break;
      case 'skid': this._updateSkid(dt, input, level, audio); break;
      case 'turn': this._updateTurn(dt, input, level, audio); break;
      case 'run_turn': this._updateRunTurn(dt, input, level, audio); break;
      case 'careful': this._updateCareful(dt, input, level, audio); break;
      case 'crouch': this._updateCrouch(dt, input, level, enemies, audio); break;
      case 'pickup': this._updatePickup(dt, level, audio); break;
      case 'jump_up': this._updateJumpUp(dt, input, level, audio); break;
      case 'stand_jump': this._updateHorizJump(dt, input, level, enemies, audio, false); break;
      case 'run_jump': this._updateHorizJump(dt, input, level, enemies, audio, true); break;
      case 'fall': this._updateFall(dt, input, level, audio); break;
      case 'land':
      case 'hard_land':
        this._updateTimedRecovery(dt, input, level, audio);
        break;
      case 'hang': this._updateHang(dt, input, level, audio); break;
      case 'climb_up': this._updateClimbUp(dt, level, audio); break;
      case 'climb_down': this._updateClimbDown(dt, level, audio); break;
      case 'combat_idle': this._updateCombatIdle(dt, input, level, enemies, audio); break;
      case 'combat_advance':
      case 'combat_retreat':
        this._updateCombatStep(dt, input, level, audio);
        break;
      case 'combat_strike': this._updateCombatStrike(dt, input, level, enemies, audio); break;
      case 'combat_parry': this._updateCombatParry(dt, input, audio); break;
      case 'combat_parried': this._updateCombatParried(dt, input, level, audio); break;
      case 'combat_hit': this._updateCombatHit(dt, level, audio); break;
      case 'sheathe': this._updateSheathe(dt); break;
    }

    // Post-movement environmental checks (mirror, slicers, deepfake merge, loose floor)
    if (this.alive) {
      this._checkEnvironment(dt, time, level, enemies, audio);
    }
  }

  _findDuelEnemy(level, enemies) {
    let best = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive || e.roomId !== this.roomId || e.nonCombat) continue;
      if (e.row !== this.row || !e.grounded) continue;
      if (!this._hasClearLine(level, this.roomId, this.row, this.x, e.x)) continue;
      const dist = Math.abs(e.x - this.x);
      if (dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    return best;
  }

  _hasClearLine(level, roomId, row, x1, x2) {
    const c1 = Math.max(0, Math.min(COLS - 1, colOfX(Math.min(x1, x2))));
    const c2 = Math.max(0, Math.min(COLS - 1, colOfX(Math.max(x1, x2))));
    for (let c = c1; c <= c2; c++) {
      if (level.isWall(roomId, c, row)) return false;
      if (level.isGateBlocking(roomId, c, row)) return false;
      if (!level.hasFloor(roomId, c, row)) return false;
    }
    return true;
  }

  _moveX(dx, level) {
    if (dx === 0) return false;
    let nx = this.x + dx;
    let blocked = false;
    const checkRow = this.grounded ? this.row : Math.max(0, Math.min(ROWS - 1, Math.floor((this.y - 12) / TILE_H)));

    if (dx > 0) {
      const leadCol = colOfX(nx + BODY_HALF_W);
      if (level.isWall(this.roomId, leadCol, checkRow)) {
        nx = leadCol * TILE_W - BODY_HALF_W - 0.1;
        blocked = true;
      } else {
        // Check closed gate on current or lead tile
        for (const c of [colOfX(this.x), leadCol]) {
          if (level.isGateBlocking(this.roomId, c, checkRow)) {
            const gx = tileCenterX(c) - 5;
            if (this.x <= gx + 1 && nx > gx) {
              nx = gx;
              blocked = true;
            }
          }
        }
      }
    } else {
      const leadCol = colOfX(nx - BODY_HALF_W);
      if (level.isWall(this.roomId, leadCol, checkRow)) {
        nx = (leadCol + 1) * TILE_W + BODY_HALF_W + 0.1;
        blocked = true;
      } else {
        for (const c of [colOfX(this.x), leadCol]) {
          if (level.isGateBlocking(this.roomId, c, checkRow)) {
            const gx = tileCenterX(c) + 5;
            if (this.x >= gx - 1 && nx < gx) {
              nx = gx;
              blocked = true;
            }
          }
        }
      }
    }

    this.x = nx;

    // Seamless left/right room flip (only if adjacent room entry tile isn't a wall or closed gate!)
    const room = level.getRoom(this.roomId);
    if (this.x < 0 && room && room.links.left !== null) {
      if (level.isWall(room.links.left, COLS - 1, checkRow) || level.isGateBlocking(room.links.left, COLS - 1, checkRow)) {
        this.x = 0.5;
        blocked = true;
      } else {
        this.roomId = room.links.left;
        this.x += VIEW_W;
        this.jumpStartX += VIEW_W;
        this.jumpTargetX += VIEW_W;
        this.onEvent?.('roomChange', this.roomId);
      }
    } else if (this.x >= VIEW_W && room && room.links.right !== null) {
      if (level.isWall(room.links.right, 0, checkRow) || level.isGateBlocking(room.links.right, 0, checkRow)) {
        this.x = VIEW_W - 0.5;
        blocked = true;
      } else {
        this.roomId = room.links.right;
        this.x -= VIEW_W;
        this.jumpStartX -= VIEW_W;
        this.jumpTargetX -= VIEW_W;
        this.onEvent?.('roomChange', this.roomId);
      }
    }

    return blocked;
  }

  _checkGroundSupport(level, audio) {
    if (!this.grounded) return true;
    const col = colOfX(this.x);
    if (!level.hasFloor(this.roomId, col, this.row)) {
      const wasRunning = this.state === 'run' || this.state === 'run_start' || this.state === 'skid' || this.state === 'run_turn';
      this.coyote = wasRunning ? COYOTE_TIME : 0;
      this.grounded = false;
      this.fallStartY = this.y;
      this.vy = 15;
      this.vx = Math.max(-42, Math.min(42, this.vx * 0.4));
      this.swordDrawn = false;
      this.enterState('fall', 0.4);
      return false;
    }
    this.y = floorY(this.row);
    const tile = level.getTile(this.roomId, col, this.row);
    if (tile === 'L') {
      level.triggerLooseFloor(this.roomId, col, this.row, audio);
    }
    return true;
  }

  _findNearbyItem(level) {
    const room = level.getRoom(this.roomId);
    if (!room) return null;
    for (const it of room.items) {
      if (it.collected) continue;
      if (it.row === this.row && Math.abs(it.x - this.x) < 20) {
        return it;
      }
    }
    return null;
  }

  _updateIdle(dt, input, level, enemies, audio) {
    this.stateTimer += dt;
    this.anim = 'idle';
    this.animT = (this.stateTimer * 0.65) % 1;
    this.vx = 0;

    if (!this._checkGroundSupport(level, audio)) return;

    // Shift alone: pick up nearby sword / elixir!
    if (input.shiftPressed && !input.left && !input.right) {
      const item = this._findNearbyItem(level);
      if (item) {
        this.pickupItem = item;
        this.x = item.x - this.facing * 4;
        this.enterState('pickup', 0.45);
        return;
      }
      // Or manually draw sword if enemy present (cancels sheathe lock)
      if (this.hasSword) {
        this.sheathedLock = 0;
        const foe = this._findDuelEnemy(level, enemies);
        if (foe) {
          this.swordDrawn = true;
          this.facing = foe.x >= this.x ? 1 : -1;
          audio.play('swordDraw');
          this.enterState('combat_idle', 0.2);
          return;
        }
      }
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // Up pressed (or buffered): open Exit Door, climbable ledge, or jump.
    if (input.consumeUp()) {
      this._groundUp(level, input, enemies, audio, 'stand');
      return;
    }
    // Holding Up (or a remembered early press) beside a climbable ledge always climbs.
    if ((input.up || this.climbIntent > 0) && dir === 0) {
      const ledge = this._findJumpUpLedge(level);
      if (ledge) {
        this._startJumpUp(level, input, audio, ledge);
        return;
      }
    }

    // Down pressed: Climb down if near a ledge edge, else Crouch
    if (input.downPressed || input.downKey) {
      if (input.consumeDown()) {
        const ledge = this._findClimbDownLedge(level);
        if (ledge) {
          this.hangLedge = ledge;
          this.facing = ledge.facing;
          this.grounded = false;
          this.climbFrom = { x: this.x, y: this.y };
          this.climbTo = { x: ledge.hangX, y: ledge.hangY };
          this.enterState('climb_down', 0.34);
          return;
        }
      }
      this.enterState('crouch', 0.14);
      return;
    }

    // Directional input
    if (dir !== 0) {
      if (dir !== this.facing) {
        this.facing = dir;
        this.enterState('turn', 0.16);
        return;
      }
      if (input.shift) {
        this._startCarefulStep(level, audio);
      } else {
        this.enterState('run_start', 0.14);
      }
    }
  }

  _startCarefulStep(level, audio) {
    const stepDist = 11;
    const curCol = colOfX(this.x);
    let targetX = this.x + this.facing * stepDist;
    const targetCol = colOfX(targetX);

    // NEVER walk off an edge while careful-stepping (and never slide backwards!)
    if (!level.hasFloor(this.roomId, targetCol, this.row)) {
      if (this.facing > 0) {
        const edgeLimit = (curCol + 1) * TILE_W - 4;
        if (this.x >= edgeLimit - 1) return false;
        targetX = Math.max(this.x, Math.min(targetX, edgeLimit));
      } else {
        const edgeLimit = curCol * TILE_W + 4;
        if (this.x <= edgeLimit + 1) return false;
        targetX = Math.min(this.x, Math.max(targetX, edgeLimit));
      }
    }
    this.jumpStartX = this.x;
    this.jumpTargetX = targetX;
    audio.play(level.ice ? 'iceStep' : 'step');
    this.enterState('careful', 0.20);
    return true;
  }

  _updateCareful(dt, input, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'careful';
    this.animT = u;
    const desiredX = this.jumpStartX + (this.jumpTargetX - this.jumpStartX) * u;
    this._moveX(desiredX - this.x, level);
    if (!this._checkGroundSupport(level, audio)) return;
    if (input.consumeUp()) {
      const ledge = this._findJumpUpLedge(level);
      if (ledge) {
        this._startJumpUp(level, input, audio, ledge);
        return;
      }
      this.climbIntent = Math.max(this.climbIntent, 0.25);
    }
    if (u >= 1) {
      this.enterState('idle', 0.2);
    }
  }

  _updateCrouch(dt, input, level, enemies, audio) {
    this.stateTimer += dt;
    this.anim = 'crouch';
    this.animT = Math.min(1, this.stateTimer / 0.12);
    if (input.consumeUp()) {
      this._groundUp(level, input, enemies, audio, 'stand');
      return;
    }
    if (!input.downKey && this.stateTimer >= 0.12) {
      this.enterState('idle', 0.2);
    }
  }

  _updatePickup(dt, level, audio) {
    this.stateTimer += dt;
    this.anim = 'pickup';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);

    if (this.pickupItem && !this.pickupItem.collected && this.animT >= 0.45) {
      const it = this.pickupItem;
      it.collected = true;
      if (it.type === 'sword') {
        this.hasSword = true;
        audio.play('swordDraw');
        level.spawnParticles(this.roomId, it.x, it.y - 6, 12, '#f2d06b', 60, 0.5, 2);
        this.onEvent?.('pickupSword', it);
      } else if (it.type === 'small_elixir') {
        this.hp = Math.min(this.maxHp, this.hp + 1);
        audio.play('elixir');
        level.spawnParticles(this.roomId, it.x, it.y - 8, 10, '#ff5c6c', 55, 0.45, 2);
        this.onEvent?.('pickupElixir', it);
      } else if (it.type === 'large_elixir') {
        this.maxHp = Math.min(8, this.maxHp + 1);
        this.hp = this.maxHp;
        audio.play('elixir');
        level.spawnParticles(this.roomId, it.x, it.y - 8, 16, '#ffd859', 65, 0.55, 2);
        this.onEvent?.('pickupLargeElixir', it);
      } else if (it.type === 'poison') {
        audio.play('poison');
        level.spawnParticles(this.roomId, it.x, it.y - 8, 10, '#4ea0ff', 50, 0.45, 2);
        this.onEvent?.('pickupPoison', it);
        this.takeDamage(1, 'poison');
      }
    }

    if (this.stateTimer >= this.stateDur && this.alive) {
      this.pickupItem = null;
      this.enterState('idle', 0.2);
    }
  }

  _updateTurn(dt, input, level, audio) {
    this.stateTimer += dt;
    this.anim = 'turn';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);
    if (!this._checkGroundSupport(level, audio)) return;
    if (input.consumeUp()) {
      this._groundUp(level, input, null, audio, 'stand');
      return;
    }
    if (this.stateTimer >= this.stateDur) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir === this.facing && !input.shift) {
        this.enterState('run_start', 0.12);
      } else {
        this.enterState('idle', 0.2);
      }
    }
  }

  _updateRunStart(dt, input, level, audio) {
    this.stateTimer += dt;
    this.anim = 'run_start';
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.animT = u;

    // Up: climb a nearby ledge, or a standing jump
    if (input.consumeUp()) {
      this._groundUp(level, input, null, audio, 'stand');
      return;
    }

    const spd = RUN_SPEED * (0.45 + 0.55 * u);
    this.vx = this.facing * spd;
    const blocked = this._moveX(this.vx * dt, level);
    if (blocked) {
      this.vx = 0;
      this.enterState('idle', 0.2);
      return;
    }
    if (!this._checkGroundSupport(level, audio)) return;
    this._checkRunSpikes(level, audio);
    if (!this.alive) return;

    if (this.stateTimer >= this.stateDur) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir === this.facing) {
        this.stepSoundPhase = 0;
        this.enterState('run', 0.42);
      } else {
        this._startSkid(level, audio);
      }
    }
  }

  _updateRun(dt, input, level, audio) {
    this.stateTimer += dt;
    this.anim = 'run';
    this.animT = (this.stateTimer / 0.42) % 1;

    // Footstep sound twice per run cycle
    const phase = Math.floor(this.stateTimer / 0.21);
    if (phase !== this.stepSoundPhase) {
      this.stepSoundPhase = phase;
      audio.play(level.ice ? 'iceStep' : 'step');
    }

    // Up while running: climb if a ledge is here (or run on to one ahead), else running jump
    if (input.consumeUp()) {
      this._groundUp(level, input, null, audio, 'run');
      return;
    }
    if (this.climbIntent > 0) {
      const ledge = this._findJumpUpLedge(level, { reach: 2, facingOnly: true });
      if (ledge) {
        this._startJumpUp(level, input, audio, ledge);
        return;
      }
    }

    this.vx = this.facing * RUN_SPEED;
    const blocked = this._moveX(this.vx * dt, level);
    if (blocked) {
      this.vx = 0;
      audio.play('land');
      this.enterState('idle', 0.2);
      return;
    }
    if (!this._checkGroundSupport(level, audio)) return;
    this._checkRunSpikes(level, audio);
    if (!this.alive) return;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir === -this.facing) {
      this._startRunTurn(level, audio);
    } else if (dir !== this.facing) {
      this._startSkid(level, audio);
    }
  }

  _startSkid(level, audio) {
    const dur = level.ice ? ICE_SKID_TIME : SKID_TIME; // Longer skid on Jungfraujoch ice!
    this.skidV0 = Math.max(40, Math.abs(this.vx));
    audio.play('skid');
    level.spawnParticles(this.roomId, this.x, this.y, 4, level.ice ? '#c8f0ff' : '#969288', 25, 0.25, 1);
    this.enterState('skid', dur);
  }

  _startRunTurn(level, audio) {
    this.skidV0 = Math.max(40, Math.abs(this.vx));
    audio.play('skid');
    level.spawnParticles(this.roomId, this.x, this.y, 5, level.ice ? '#c8f0ff' : '#969288', 28, 0.25, 1);
    this.turnFlipped = false;
    this.enterState('run_turn', level.ice ? 0.52 : 0.34);
  }

  // Slide forward by dx but never off a ledge (stops at the lip like a careful step)
  _slideX(dx, level) {
    if (dx === 0) return false;
    const dir = Math.sign(dx);
    const col = colOfX(this.x);
    const nextCol = colOfX(this.x + dx + dir * 2);
    if (nextCol !== col && !level.isWall(this.roomId, nextCol, this.row) &&
        !level.hasFloor(this.roomId, nextCol, this.row)) {
      const limit = dir > 0 ? (col + 1) * TILE_W - 4 : col * TILE_W + 4;
      const ndx = dir > 0 ? Math.max(0, limit - this.x) : Math.min(0, limit - this.x);
      if (Math.abs(ndx) < 0.01) return true;
      return this._moveX(ndx, level) || true;
    }
    return this._moveX(dx, level);
  }

  _updateRunTurn(dt, input, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    if (input.consumeUp()) {
      if (!this.turnFlipped) this.facing = -this.facing;
      this.turnFlipped = true;
      this._groundUp(level, input, null, audio, 'stand');
      return;
    }
    if (u < 0.55) {
      // braking slide in the old direction
      this.anim = 'skid';
      this.animT = u / 0.55;
      const k = 1 - u / 0.55;
      this.vx = this.facing * this.skidV0 * k;
      this._slideX(this.vx * dt, level);
    } else {
      if (!this.turnFlipped) {
        this.turnFlipped = true;
        this.facing = -this.facing;
      }
      this.vx = 0;
      this.anim = 'turn';
      this.animT = (u - 0.55) / 0.45;
    }
    if (!this._checkGroundSupport(level, audio)) return;
    this._checkRunSpikes(level, audio);
    if (!this.alive) return;
    if (u >= 1) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir === this.facing && !input.shift) {
        this.enterState('run_start', 0.12);
      } else {
        this.enterState('idle', 0.2);
      }
    }
  }

  _updateSkid(dt, input, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'skid';
    this.animT = u;

    // Cancel skid into a climb (or jump) the moment Up is pressed
    if (input.consumeUp()) {
      this._groundUp(level, input, null, audio, 'stand');
      return;
    }
    if (this.climbIntent > 0 || input.up) {
      const ledge = this._findJumpUpLedge(level);
      if (ledge) {
        this._startJumpUp(level, input, audio, ledge);
        return;
      }
    }

    // Decelerate from the entry speed (longer slide on ice); never slides off a ledge
    const k = 1 - u;
    this.vx = this.facing * (this.skidV0 || RUN_SPEED) * k * (level.ice ? k * 0.5 + 0.5 : 1);
    const blocked = this._slideX(this.vx * dt, level);
    if (blocked) {
      this.vx = 0;
      this.enterState('idle', 0.2);
      return;
    }
    if (!this._checkGroundSupport(level, audio)) return;
    this._checkRunSpikes(level, audio);
    if (!this.alive) return;

    if (u >= 1) {
      this.vx = 0;
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir !== 0 && dir !== this.facing) {
        this.facing = dir;
        this.enterState('turn', 0.14);
      } else {
        this.enterState('idle', 0.2);
      }
    }
  }

  _checkRunSpikes(level, audio) {
    const col = colOfX(this.x);
    if (level.getTile(this.roomId, col, this.row) === '^') {
      const room = level.getRoom(this.roomId);
      const sp = room?.spikes.get(`${col},${this.row}`);
      if (sp) {
        sp.extended = 1.0;
        sp.triggered = true;
      }
      audio.play('hurt');
      this.die('spikes');
    }
  }

  _heldDir(input) {
    return (input.right ? 1 : 0) - (input.left ? 1 : 0);
  }

  _tryExitDoor(level, enemies, audio) {
    const ex = level.getExitAt(this.roomId, colOfX(this.x), this.row);
    if (!ex || !ex.isOpen) return false;
    if (enemies && enemies.some((e) => e.alive && e.type === 'zins')) return false;
    audio.play('exit');
    this.onExitLevel?.();
    return true;
  }

  // Is there something worth jumping over (pit, spikes, loose tile, close-plate, shutter)
  // ahead before the next wall?
  _hazardAhead(level, dir, dist) {
    const cur = colOfX(this.x);
    for (let d = 8; d <= dist; d += 8) {
      const c = colOfX(this.x + dir * d);
      if (c === cur) continue;
      const ch = level.getTile(this.roomId, c, this.row);
      if (ch === '#') return false;
      if (c >= 0 && c < COLS && level.isGateBlocking(this.roomId, c, this.row)) return false;
      if (!level.hasFloor(this.roomId, c, this.row)) return true;
      if (ch === '^' || ch === 'L' || ch === 'Q' || ch === 'C') return true;
    }
    return false;
  }

  _hasWallOrGateAhead(dir, level, maxDist = 56) {
    const curCol = colOfX(this.x);
    for (let d = 8; d <= maxDist; d += 8) {
      const c = colOfX(this.x + dir * d);
      if (c === curCol) continue;
      if (level.isWall(this.roomId, c, this.row)) return true;
      if (c >= 0 && c < COLS && level.isGateBlocking(this.roomId, c, this.row)) return true;
    }
    return false;
  }

  // Every column between the hero and column c (inclusive) on the current floor must be
  // walkable (no wall, no closed gate, no pit) for the hero to shuffle over to it.
  _pathWalkable(level, c) {
    const from = colOfX(this.x);
    const step = c >= from ? 1 : -1;
    for (let k = from; ; k += step) {
      if (k !== from) {
        if (level.isWall(this.roomId, k, this.row)) return false;
        if (level.isGateBlocking(this.roomId, k, this.row)) return false;
        if (!level.hasFloor(this.roomId, k, this.row)) return false;
      }
      if (k === c) break;
    }
    return true;
  }

  // Central "Up on the ground" decision. mode: 'stand' | 'run'.
  // Up always climbs when a climbable ledge is within reach, unless the hero is holding a
  // direction toward something that is clearly meant to be jumped over.
  _groundUp(level, input, enemies, audio, mode) {
    if (this._tryExitDoor(level, enemies, audio)) return;
    const dir = this._heldDir(input);
    if (dir === 0) {
      this.vx = 0;
      this._startJumpUp(level, input, audio, this._findJumpUpLedge(level));
      return;
    }
    const look = mode === 'run' ? 104 : 64;
    const hazard = this._hazardAhead(level, dir, look);
    if (!hazard) {
      const ledge = this._findJumpUpLedge(level, { prefer: dir });
      if (ledge) {
        this.vx = 0;
        this._startJumpUp(level, input, audio, ledge);
        return;
      }
      // Running at a wall with a ledge a little further ahead: keep running, then climb.
      if (mode === 'run' && this._hasWallOrGateAhead(dir, level, CLIMB_AHEAD_REACH + 16)) {
        const ahead = this._findJumpUpLedge(level, { reach: CLIMB_AHEAD_REACH, aheadDir: dir, facingOnly: true });
        if (ahead) {
          this.climbIntent = CLIMB_INTENT_TIME;
          return;
        }
      }
    }
    this.facing = dir;
    if (mode === 'run') {
      const ws = level.getWindState?.(this.roomId, this.currentTime);
      const jumpSpec = (ws && ws.active && this.facing === ws.dir) ? TAILWIND_RUN_JUMP : RUN_JUMP;
      this._startHorizJump(jumpSpec.dist, jumpSpec.dur, jumpSpec.arc, 'run_jump', audio);
    } else {
      this._startHorizJump(STAND_JUMP.dist, STAND_JUMP.dur, STAND_JUMP.arc, 'stand_jump', audio);
    }
  }

  // Find a ledge the hero can jump up to from (or near) the current spot.
  // opts.reach: px the hero may be outside the open column (auto-align shuffle)
  // opts.aheadDir: only consider open columns in that direction (plus the current one)
  // opts.facingOnly: ledge must be in the facing direction
  // opts.prefer: preferred ledge direction
  _findJumpUpLedge(level, opts = {}) {
    const reach = opts.reach ?? CLIMB_REACH;
    const targetRow = this.row - 1;
    let targetRoomId = this.roomId;
    let localTargetRow = targetRow;
    if (targetRow < 0) {
      const rm = level.getRoom(this.roomId);
      if (!rm || rm.links.up === null) return null;
      targetRoomId = rm.links.up;
      localTargetRow = ROWS - 1;
    }
    const baseCol = Math.max(0, Math.min(COLS - 1, colOfX(this.x)));
    const prefer = opts.prefer || this.facing;
    const span = Math.ceil(reach / TILE_W) + 1;

    let best = null;
    let bestScore = Infinity;
    for (let c = baseCol - span; c <= baseCol + span; c++) {
      if (c < 0 || c >= COLS) continue;
      const left = c * TILE_W;
      const right = left + TILE_W;
      const distSpan = this.x < left ? left - this.x : (this.x >= right ? this.x - right + 0.01 : 0);
      if (distSpan > reach) continue;
      if (opts.aheadDir && c !== baseCol && Math.sign(c - baseCol) !== opts.aheadDir) continue;
      // The open column: hole above, standable floor here, reachable on foot
      if (level.getTile(targetRoomId, c, localTargetRow) !== '.') continue;
      if (level.isWall(this.roomId, c, this.row)) continue;
      if (!level.hasFloor(this.roomId, c, this.row) && c !== baseCol) continue;
      if (!this._pathWalkable(level, c)) continue;

      for (const d of [-1, 1]) {
        if (opts.facingOnly && d !== this.facing) continue;
        const ledgeCol = c + d;
        let ledgeRoomId = targetRoomId;
        let localLedgeCol = ledgeCol;
        if (ledgeCol < 0) {
          const rm = level.getRoom(targetRoomId);
          if (!rm || rm.links.left === null) continue;
          ledgeRoomId = rm.links.left;
          localLedgeCol = COLS - 1;
        } else if (ledgeCol >= COLS) {
          const rm = level.getRoom(targetRoomId);
          if (!rm || rm.links.right === null) continue;
          ledgeRoomId = rm.links.right;
          localLedgeCol = 0;
        }
        const ledgeCh = level.getTile(ledgeRoomId, localLedgeCol, localTargetRow);
        if (ledgeCh === '#' || !level.hasFloor(ledgeRoomId, localLedgeCol, localTargetRow)) continue;
        if (level.isGateBlocking(ledgeRoomId, localLedgeCol, localTargetRow)) continue;

        const hangX = d > 0 ? right - 4 : left + 4;
        const score = distSpan * 3 + Math.abs(this.x - hangX) * 0.05 + (d === prefer ? 0 : 5);
        if (score < bestScore) {
          bestScore = score;
          best = {
            roomId: targetRoomId,
            ledgeRoomId,
            col: localLedgeCol,
            openCol: c,
            row: localTargetRow,
            facing: d,
            hangX,
            hangY: floorY(localTargetRow) + 27,
            crossUp: targetRow < 0,
            dist: Math.abs(this.x - hangX),
          };
        }
      }
    }
    return best;
  }

  _findClimbDownLedge(level) {
    const col = colOfX(this.x);
    let best = null;
    for (const dir of [this.facing, -this.facing]) {
      const edgeX = dir > 0 ? (col + 1) * TILE_W : col * TILE_W;
      if (Math.abs(this.x - edgeX) > 20) continue;
      const openCol = col + dir;
      const openCh = level.getTile(this.roomId, openCol, this.row);
      if (openCh !== '.' || level.hasFloor(this.roomId, openCol, this.row)) continue;
      // Hang facing back toward the floor we're climbing down from!
      const hangFacing = -dir;
      const hangX = dir > 0 ? edgeX + 4 : edgeX - 4;
      const hangY = floorY(this.row) + 27;
      const cand = {
        roomId: this.roomId,
        ledgeRoomId: this.roomId,
        col,
        openCol,
        row: this.row,
        facing: hangFacing,
        hangX: Math.max(4, Math.min(VIEW_W - 4, hangX)),
        hangY,
        crossUp: false,
        d: Math.abs(this.x - edgeX),
      };
      if (!best || cand.d < best.d) best = cand;
    }
    return best;
  }

  _startJumpUp(level, input, audio, ledge = undefined) {
    this.hangLedge = ledge === undefined ? this._findJumpUpLedge(level) : ledge;
    this.climbIntent = 0;
    this.jumpSprung = false;
    this.vx = 0;
    this.jumpUpAutoClimb = !(input && input.shift);
    this.jumpStartX = this.x;
    this.jumpBaseY = this.y;
    this.grounded = false;
    if (this.hangLedge) {
      // Crouch + auto-align shuffle (longer when the hero has further to go), then spring up.
      const dist = Math.abs(this.hangLedge.hangX - this.x);
      this.jumpWindup = 0.12 + Math.min(0.16, dist / 190);
      this.jumpShuffle = dist > 7;
      this.enterState('jump_up', this.jumpWindup + 0.2);
    } else {
      audio.play('jump');
      this.jumpWindup = 0;
      this.jumpShuffle = false;
      this.enterState('jump_up', 0.36);
    }
  }

  _updateJumpUp(dt, input, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'jump_up';
    this.animT = u;

    if (input.shift) {
      this.jumpUpAutoClimb = false;
    }

    if (this.hangLedge) {
      const ledge = this.hangLedge;
      const targetY = ledge.crossUp ? ledge.hangY - PLAY_H : ledge.hangY;
      const w = this.jumpWindup;
      const t = this.stateTimer;
      if (t < w) {
        // Windup: shuffle onto the take-off spot under the ledge, crouching
        const k = t / w;
        const e = k * k * (3 - 2 * k);
        this.x = this.jumpStartX + (ledge.hangX - this.jumpStartX) * e;
        this.y = this.jumpBaseY;
        this.facing = this.jumpShuffle && k < 0.8
          ? (Math.sign(ledge.hangX - this.jumpStartX) || ledge.facing)
          : ledge.facing;
        this.anim = this.jumpShuffle && k < 0.8 ? 'careful' : 'jump_up';
        this.animT = this.jumpShuffle && k < 0.8 ? (k / 0.8) : 0;
        return;
      }
      if (!this.jumpSprung) {
        this.jumpSprung = true;
        audio.play('jump');
      }
      this.facing = ledge.facing;
      const k = Math.min(1, (t - w) / (this.stateDur - w));
      const e = 1 - (1 - k) * (1 - k);
      this.x = ledge.hangX;
      this.y = this.jumpBaseY + (targetY - this.jumpBaseY) * e;
      this.animT = 0.25 + 0.75 * k;

      if (k >= 1) {
        this.jumpSprung = false;
        if (ledge.crossUp) {
          this.roomId = ledge.roomId;
          this.onEvent?.('roomChange', this.roomId);
        }
        this.x = ledge.hangX;
        this.y = ledge.hangY;
        this.row = ledge.row;
        audio.play('grab');

        // Shaking loose floor when grabbing it!
        if (level.getTile(ledge.ledgeRoomId, ledge.col, ledge.row) === 'L') {
          level.triggerLooseFloor(ledge.ledgeRoomId, ledge.col, ledge.row, audio);
        }

        if (!input.shift && (input.up || this.jumpUpAutoClimb)) {
          this._startClimbUp();
        } else {
          this.hangGrace = 2.5;
          this.enterState('hang', 0.5);
        }
      }
      return;
    }

    // No ledge: jump up ~15px, bump ceiling/loose floor above, land back down
    const arc = Math.sin(u * Math.PI) * 15;
    this.y = this.jumpBaseY - arc;

    if (u >= 0.45 && u <= 0.55) {
      const c = colOfX(this.x);
      let headRoomId = this.roomId;
      let headRow = this.row - 1;
      if (headRow < 0) {
        const rm = level.getRoom(this.roomId);
        if (rm && rm.links.up !== null) {
          headRoomId = rm.links.up;
          headRow = ROWS - 1;
        }
      }
      if (headRow >= 0 && level.getTile(headRoomId, c, headRow) === 'L') {
        level.triggerLooseFloor(headRoomId, c, headRow, audio, 0.58);
      }
    }

    if (u >= 1) {
      this.y = floorY(this.row);
      this.grounded = true;
      audio.play('land');
      this.enterState('land', 0.12);
    }
  }

  _startHorizJump(dist, dur, arc, stateName, audio, windup = null) {
    audio.play('jump');
    this.grounded = false;
    this.coyote = 0;
    this.jumpStartX = this.x;
    this.jumpTargetX = this.x + this.facing * dist;
    this.jumpBaseY = this.y;
    this.jumpArc = arc;
    this.jumpWindup = windup ?? (stateName === 'stand_jump' ? STAND_JUMP.windup : RUN_JUMP.windup);
    this.fallStartY = this.y;
    this.enterState(stateName, dur);
  }

  _updateHorizJump(dt, input, level, enemies, audio, isRunning) {
    this.stateTimer += dt;
    this.anim = isRunning ? 'run_jump' : 'stand_jump';
    const w = this.jumpWindup || 0;
    if (this.stateTimer < w) {
      // crouch windup before a standing jump (feet planted)
      this.animT = 0;
      this.y = this.jumpBaseY;
      return;
    }
    const u = Math.min(1, (this.stateTimer - w) / Math.max(0.01, this.stateDur - w));
    this.animT = u;

    const prevX = this.x;
    const desiredX = this.jumpStartX + (this.jumpTargetX - this.jumpStartX) * u;
    const blocked = this._moveX(desiredX - prevX, level);

    // Anti-air guard intercept: armed alert guards on the same floor block jumping right through them!
    if (enemies) {
      for (const e of enemies) {
        if (!e.alive || e.nonCombat || !e.swordDrawn || e.roomId !== this.roomId || e.row !== this.row) continue;
        if (Math.abs(this.x - e.x) < 12 && this._hasClearLine(level, this.roomId, this.row, prevX, e.x)) {
          this.x = prevX;
          this.vx = -this.facing * 24;
          this.vy = 20;
          e.facing = this.x < e.x ? -1 : 1;
          this.receiveEnemyStrike(e, level, audio);
          if (this.alive) {
            this.enterState('fall', 0.4);
          }
          return;
        }
      }
    }

    // Cap upward arc under a low ceiling (solid block or floor slab directly above)
    let maxArc = this.jumpArc;
    const aboveCh = level.getTile(this.roomId, colOfX(this.x), this.row - 1);
    if (aboveCh === '#') maxArc = Math.min(maxArc, 6);
    else if (aboveCh !== '.') maxArc = Math.min(maxArc, 11);
    this.y = this.jumpBaseY - 4 * u * (1 - u) * maxArc;

    if (blocked) {
      // If Up is held near an overhead climbable ledge, catch the ledge instead of bonking!
      if (input.up || input.shift) {
        const ledge = this._findJumpUpLedge(level);
        if (ledge) {
          this.hangLedge = ledge;
          this.facing = ledge.facing;
          this.jumpUpAutoClimb = !input.shift;
          this.jumpStartX = this.x;
          this.jumpBaseY = this.y;
          this.jumpWindup = 0;
          this.jumpShuffle = false;
          this.jumpSprung = true;
          this.enterState('jump_up', 0.16);
          return;
        }
      }
      // Bonked into wall mid-jump -> fall down cleanly
      this.vx = 0;
      this.vy = 20;
      this.enterState('fall', 0.4);
      return;
    }

    // Generous far-ledge catch during final 30% of horizontal jump or on landing frame
    if (u >= 0.6 && (input.shift || input.up) &&
        !level.hasFloor(this.roomId, colOfX(this.jumpTargetX), this.row)) {
      const col = colOfX(this.x);
      if (!level.hasFloor(this.roomId, col, this.row)) {
        const probeX = this.x + this.facing * CATCH_EDGE_WINDOW;
        const edgeCol = colOfX(probeX);
        if (edgeCol !== col) {
          let ledgeRoomId = this.roomId;
          let localEdgeCol = edgeCol;
          if (edgeCol < 0) {
            const rm = level.getRoom(this.roomId);
            ledgeRoomId = rm?.links?.left ?? null;
            localEdgeCol = COLS - 1;
          } else if (edgeCol >= COLS) {
            const rm = level.getRoom(this.roomId);
            ledgeRoomId = rm?.links?.right ?? null;
            localEdgeCol = 0;
          }
          if (ledgeRoomId !== null && !level.isWall(ledgeRoomId, localEdgeCol, this.row) &&
              level.hasFloor(ledgeRoomId, localEdgeCol, this.row) &&
              !level.isGateBlocking(ledgeRoomId, localEdgeCol, this.row)) {
            const edgeX = this.facing > 0 ? edgeCol * TILE_W - 4 : (edgeCol + 1) * TILE_W + 4;
            this.hangLedge = {
              roomId: this.roomId,
              ledgeRoomId,
              col: localEdgeCol,
              openCol: col,
              row: this.row,
              facing: this.facing,
              hangX: edgeX,
              hangY: floorY(this.row) + 27,
            };
            this.x = edgeX;
            this.y = this.hangLedge.hangY;
            this.hangGrace = 2.5;
            audio.play('grab');
            if (level.getTile(ledgeRoomId, localEdgeCol, this.row) === 'L') {
              level.triggerLooseFloor(ledgeRoomId, localEdgeCol, this.row, audio);
            }
            if (input.up && !input.shift) {
              this._startClimbUp();
            } else {
              this.enterState('hang', 0.5);
            }
            return;
          }
        }
      }
    }

    if (u >= 1) {
      this.y = floorY(this.row);
      const col = colOfX(this.x);

      // Slight forgiving toe-catch onto far floor tile if within 8px of its edge
      if (!level.hasFloor(this.roomId, col, this.row)) {
        const edgeCol = colOfX(this.x + this.facing * 10);
        if (edgeCol !== col && edgeCol >= 0 && edgeCol < COLS &&
            level.hasFloor(this.roomId, edgeCol, this.row) &&
            !level.isWall(this.roomId, edgeCol, this.row) &&
            !level.isGateBlocking(this.roomId, edgeCol, this.row)) {
          // Step onto brink if jump barely reached
          this.x = this.facing > 0 ? edgeCol * TILE_W + 3 : (edgeCol + 1) * TILE_W - 3;
        }
      }

      const landCol = colOfX(this.x);
      if (level.hasFloor(this.roomId, landCol, this.row)) {
        this.grounded = true;
        this.y = floorY(this.row);
        audio.play('land');
        level.spawnParticles(this.roomId, this.x, this.y, 4, '#9e9a8e', 28, 0.25, 1);

        const tile = level.getTile(this.roomId, landCol, this.row);
        if (tile === 'L') level.triggerLooseFloor(this.roomId, landCol, this.row, audio);
        if (tile === '^') {
          this._checkRunSpikes(level, audio);
          return;
        }

        // Preserve run if player is holding direction after a running jump!
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (isRunning && dir === this.facing) {
          this.enterState('run', 0.42);
        } else {
          this.enterState('land', 0.14);
        }
      } else {
        // Overshot into pit -> Fall!
        this.fallStartY = floorY(this.row);
        this.vy = 25;
        this.vx = this.facing * (isRunning ? 34 : 18);
        this.enterState('fall', 0.4);
      }
    }
  }

  _updateFall(dt, input, level, audio) {
    this.stateTimer += dt;
    this.anim = 'fall';
    this.animT = (this.stateTimer * 2.5) % 1;

    // Coyote time: Up just after running off an edge still launches the running jump
    if (this.coyote > 0 && input.consumeUp()) {
      this.y = this.fallStartY;
      this.vy = 0;
      const ws = level.getWindState?.(this.roomId, this.currentTime);
      const jumpSpec = (ws && ws.active && this.facing === ws.dir) ? TAILWIND_RUN_JUMP : RUN_JUMP;
      this._startHorizJump(jumpSpec.dist, jumpSpec.dur, jumpSpec.arc, 'run_jump', audio);
      return;
    }

    const prevY = this.y;
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;

    if (this.vx !== 0) {
      const blocked = this._moveX(this.vx * dt, level);
      if (blocked) this.vx = 0;
      this.vx *= Math.pow(0.25, dt);
    }

    // Catch a ledge while falling if Shift (or Up) is held! Supports cross-room ledges.
    if ((input.shift || input.up) && this.vy > 0) {
      const handsY = this.y - 26;
      const col = colOfX(this.x);
      for (let r = 0; r < ROWS; r++) {
        const fy = floorY(r);
        if (Math.abs(handsY - fy) < CATCH_HANDS_WINDOW) {
          if (level.getTile(this.roomId, col, r) !== '.') continue;
          for (const dir of [this.facing, -this.facing]) {
            const adj = col + dir;
            let adjRoomId = this.roomId;
            let localAdj = adj;
            if (adj < 0) {
              const rm = level.getRoom(this.roomId);
              if (!rm || rm.links.left === null) continue;
              adjRoomId = rm.links.left;
              localAdj = COLS - 1;
            } else if (adj >= COLS) {
              const rm = level.getRoom(this.roomId);
              if (!rm || rm.links.right === null) continue;
              adjRoomId = rm.links.right;
              localAdj = 0;
            }
            if (!level.isWall(adjRoomId, localAdj, r) && level.hasFloor(adjRoomId, localAdj, r) &&
                !level.isGateBlocking(adjRoomId, localAdj, r)) {
              const edgeX = dir > 0 ? adj * TILE_W - 4 : (adj + 1) * TILE_W + 4;
              if (Math.abs(this.x - edgeX) < CATCH_EDGE_WINDOW) {
                this.facing = dir;
                this.x = edgeX;
                this.y = fy + 27;
                this.vy = 0;
                this.vx = 0;
                this.row = r;
                this.fallStartY = fy;
                this.hangLedge = {
                  roomId: this.roomId,
                  ledgeRoomId: adjRoomId,
                  col: localAdj,
                  openCol: col,
                  row: r,
                  facing: dir,
                  hangX: edgeX,
                  hangY: fy + 27,
                };
                this.hangGrace = 2.5;
                audio.play('grab');
                if (level.getTile(adjRoomId, localAdj, r) === 'L') {
                  level.triggerLooseFloor(adjRoomId, localAdj, r, audio);
                }
                this.enterState('hang', 0.5);
                return;
              }
            }
          }
        }
      }
    }

    // Room transition downward
    if (this.y > PLAY_H) {
      const room = level.getRoom(this.roomId);
      if (room && room.links.down !== null) {
        this.roomId = room.links.down;
        this.y -= PLAY_H;
        this.fallStartY -= PLAY_H;
        this.row = 0;
        this.onEvent?.('roomChange', this.roomId);
        return;
      }
      audio.play('death');
      this.die('bottomless');
      return;
    }

    // Landing on floor check
    const col = colOfX(this.x);
    for (let r = 0; r < ROWS; r++) {
      const fy = floorY(r);
      if (prevY <= fy + 2 && this.y >= fy) {
        if (level.hasFloor(this.roomId, col, r)) {
          this.y = fy;
          this.row = r;
          this.vy = 0;
          this.vx = 0;
          this.grounded = true;

          const tile = level.getTile(this.roomId, col, r);
          if (tile === 'L') level.triggerLooseFloor(this.roomId, col, r, audio);
          if (tile === '^') {
            this._checkRunSpikes(level, audio);
            return;
          }

          const floorsFallen = (this.y - this.fallStartY) / TILE_H;
          if (floorsFallen >= 2.45) {
            audio.play('hardLand');
            level.spawnParticles(this.roomId, this.x, this.y, 12, '#a89f90', 70, 0.5, 2);
            this.die('fall');
          } else if (floorsFallen >= 1.45) {
            audio.play('hardLand');
            level.spawnParticles(this.roomId, this.x, this.y, 8, '#a89f90', 55, 0.4, 2);
            this.takeDamage(1, 'fall');
            if (this.alive) this.enterState('hard_land', 0.34);
          } else {
            audio.play('land');
            level.spawnParticles(this.roomId, this.x, this.y, 4, '#9a9488', 30, 0.25, 1);
            this.enterState('land', 0.14);
          }
          return;
        }
      }
    }
  }

  _updateTimedRecovery(dt, input, level, audio) {
    this.stateTimer += dt;
    this.animT = Math.min(1, this.stateTimer / this.stateDur);
    if (!this._checkGroundSupport(level, audio)) return;
    if (input.consumeUp()) {
      this._groundUp(level, input, null, audio, 'stand');
      return;
    }
    if (input.up || this.climbIntent > 0) {
      const ledge = this._findJumpUpLedge(level);
      if (ledge && this.stateTimer >= 0.06) {
        this._startJumpUp(level, input, audio, ledge);
        return;
      }
    }
    if (this.stateTimer >= this.stateDur) {
      this.enterState('idle', 0.2);
    }
  }

  _updateHang(dt, input, level, audio) {
    this.stateTimer += dt;
    this.anim = 'hang';
    this.animT = (this.stateTimer * 0.8) % 1;
    this.hangGrace = Math.max(0, this.hangGrace - dt);

    // If the loose floor we're hanging from fell, drop!
    if (this.hangLedge && !level.hasFloor(this.hangLedge.ledgeRoomId, this.hangLedge.col, this.hangLedge.row)) {
      this._dropFromHang();
      return;
    }

    if (input.consumeUp() || (input.up && this.stateTimer > 0.08)) {
      this._startClimbUp();
      return;
    }
    if (input.downPressed) {
      this._dropFromHang();
      return;
    }
    // Hold Shift to hang indefinitely; otherwise drop after grace expires
    if (!input.shift && this.hangGrace <= 0) {
      this._dropFromHang();
    }
  }

  _dropFromHang() {
    this.grounded = false;
    // Dropping from a hang starts fall ~0.55 floors lower, so a 2-floor drop becomes safe!
    this.fallStartY = this.y - 2;
    this.vy = 10;
    this.vx = 0;
    this.hangLedge = null;
    this.enterState('fall', 0.4);
  }

  _startClimbUp() {
    const ledge = this.hangLedge;
    this.climbFrom = { x: this.x, y: this.y };
    const landX = ledge.facing > 0
      ? (ledge.openCol + 1) * TILE_W + 9
      : ledge.openCol * TILE_W - 9;
    this.climbTo = { x: landX, y: floorY(ledge.row) };
    this.enterState('climb_up', 0.38);
  }

  _updateClimbUp(dt, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'climb_up';
    this.animT = u;

    // Smooth ease-in-out mantle onto ledge
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    this.x = this.climbFrom.x + (this.climbTo.x - this.climbFrom.x) * e;
    this.y = this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * e;

    // Handle horizontal room wrap if climbing across room border
    const room = level.getRoom(this.roomId);
    if (this.x < 0 && room && room.links.left !== null) {
      this.roomId = room.links.left;
      this.x += VIEW_W;
      this.climbFrom.x += VIEW_W;
      this.climbTo.x += VIEW_W;
      this.onEvent?.('roomChange', this.roomId);
    } else if (this.x >= VIEW_W && room && room.links.right !== null) {
      this.roomId = room.links.right;
      this.x -= VIEW_W;
      this.climbFrom.x -= VIEW_W;
      this.climbTo.x -= VIEW_W;
      this.onEvent?.('roomChange', this.roomId);
    }

    if (u >= 1) {
      this.grounded = true;
      this.row = this.hangLedge ? this.hangLedge.row : this.row;
      this.y = floorY(this.row);
      this.hangLedge = null;
      audio.play('step');
      this.enterState('idle', 0.2);
    }
  }

  _updateClimbDown(dt, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'climb_down';
    this.animT = u;

    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    this.x = this.climbFrom.x + (this.climbTo.x - this.climbFrom.x) * e;
    this.y = this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * e;

    if (u >= 1) {
      this.x = this.climbTo.x;
      this.y = this.climbTo.y;
      this.hangGrace = 2.5;
      audio.play('grab');
      this.enterState('hang', 0.5);
    }
  }

  // -------------------------------------------------------------------------
  // Fencing Combat States
  // -------------------------------------------------------------------------

  _startCombatStrike(audio, isRiposte = false) {
    this.strikeId++;
    this.strikeHitDone = false;
    this.strikeWhiffed = false;
    this.strikeIsRiposte = isRiposte;
    this.emptyParryStreak = 0;
    if (isRiposte) {
      this.consecutiveStrikes = 0;
    } else {
      this.consecutiveStrikes = Math.min(6, this.consecutiveStrikes + 1);
      this.strikeChainDecay = 1.5;
    }
    audio?.play('strike');
    // Normal strike: 0.44s (150ms windup, 88ms active, 202ms recovery)
    // Riposte strike: 0.30s (72ms windup, 84ms active, 144ms recovery)
    this.enterState('combat_strike', isRiposte ? 0.30 : 0.44);
  }

  _startCombatParry(audio) {
    audio?.play('parry');
    this.parrySuccess = false;
    this.parryActive = true;
    this.riposteQueued = false;
    this.consecutiveStrikes = 0;
    // Slight recovery penalty if repeatedly spamming empty parries
    const fatigue = Math.min(0.16, this.emptyParryStreak * 0.055);
    this.enterState('combat_parry', 0.39 + fatigue);
  }

  _updateCombatIdle(dt, input, level, enemies, audio) {
    this.stateTimer += dt;
    this.anim = 'combat_idle';
    this.animT = (this.stateTimer * 0.9) % 1;
    this.vx = 0;
    this.parryActive = false;

    if (!this._checkGroundSupport(level, audio)) return;

    const foe = this._findDuelEnemy(level, enemies);
    if (foe) {
      this.facing = foe.x >= this.x ? 1 : -1;
    }

    // Down: Sheathe sword!
    if (input.consumeDown()) {
      this.swordDrawn = false;
      this.sheathedLock = 2.4;
      this.enterState('sheathe', 0.24);
      this.onEvent?.('sheathe', foe);
      return;
    }

    // Up: Parry! (respects brief empty-parry recovery gap)
    if (this.parryCooldown <= 0 && input.consumeUp()) {
      this._startCombatParry(audio);
      return;
    }

    // Shift: Strike (or fast riposte if within riposteWindow)!
    if (input.consumeShift()) {
      this._startCombatStrike(audio, this.riposteWindow > 0);
      return;
    }

    // Left / Right: Advance or Retreat (respecting clean fencing spacing!)
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      const advancing = dir === this.facing;
      if (advancing && foe && Math.abs(foe.x - this.x) < 26) return;
      if (!advancing) {
        this.consecutiveStrikes = 0;
      }
      this.jumpStartX = this.x;
      let targetX = this.x + dir * 15;
      if (advancing && foe) {
        const minDist = 25;
        if (this.facing > 0) targetX = Math.min(targetX, foe.x - minDist);
        else targetX = Math.max(targetX, foe.x + minDist);
      }
      this.jumpTargetX = targetX;
      audio.play(level.ice ? 'iceStep' : 'step');
      this.enterState(advancing ? 'combat_advance' : 'combat_retreat', 0.17);
    }
  }

  _updateCombatStep(dt, input, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.animT = u;
    // Allow responsive parry cancel mid-footwork when an enemy swings!
    if (this.parryCooldown <= 0 && input.consumeUp()) {
      this._startCombatParry(audio);
      return;
    }
    const desiredX = this.jumpStartX + (this.jumpTargetX - this.jumpStartX) * u;
    this._moveX(desiredX - this.x, level);
    if (!this._checkGroundSupport(level, audio)) return;
    if (u >= 1) {
      if (input.consumeShift()) {
        this._startCombatStrike(audio, this.riposteWindow > 0);
        return;
      }
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateCombatStrike(dt, input, level, enemies, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'combat_strike';
    this.animT = u;

    if (!this._checkGroundSupport(level, audio)) return;

    const activeStart = this.strikeIsRiposte ? 0.24 : 0.34;
    const activeEnd = this.strikeIsRiposte ? 0.52 : 0.54;
    const reach = this.strikeIsRiposte ? 40 : 38;

    // Active blade window
    if (!this.strikeHitDone && u >= activeStart && u <= activeEnd) {
      const foe = this._findDuelEnemy(level, enemies);
      if (foe && Math.abs(foe.x - this.x) <= reach && Math.sign(foe.x - this.x) === this.facing) {
        this.strikeHitDone = true;
        const isRiposte = this.strikeIsRiposte || this.riposteWindow > 0;
        const res = foe.receivePlayerStrike(this, level, audio, isRiposte);
        if (isRiposte) this.riposteWindow = 0;
        if (res === 'parried') {
          audio.play('clang');
          level.spawnParticles(this.roomId, (this.x + foe.x) * 0.5, this.y - 18, 10, '#fff29c', 85, 0.28, 2);
          this._moveX(-this.facing * 6, level);
          // Recoil state: cannot mash Shift immediately; can parry a counter-riposte if sharp!
          this.enterState('combat_parried', 0.25);
          return;
        } else if (res === 'hit') {
          audio.play('hurt');
          level.spawnParticles(this.roomId, foe.x, foe.y - 16, 8, '#ff4d5a', 70, 0.3, 2);
          // Deepfake linked pain!
          if (foe.type === 'deepfake') {
            this.onEvent?.('deepfakePain', foe);
            this.takeDamage(1, 'deepfake');
          }
        }
      }
    }

    // Mark whiff once active frames pass without connecting (punishable recovery!)
    if (!this.strikeHitDone && u > activeEnd) {
      this.strikeWhiffed = true;
    }

    // Early recovery exit on a clean hit so landing blows feels crisp
    if (this.strikeHitDone && u >= 0.78 && this.alive) {
      this.enterState('combat_idle', 0.2);
      return;
    }

    // Late whiff recovery allows emergency parry right at the tail end
    if (this.strikeWhiffed && u >= 0.86 && this.parryCooldown <= 0 && input.consumeUp()) {
      this._startCombatParry(audio);
      return;
    }

    if (u >= 1 && this.alive) {
      this.strikeWhiffed = false;
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateCombatParried(dt, input, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'combat_parried';
    this.animT = u;
    if (!this._checkGroundSupport(level, audio)) return;

    // After initial blade-recoil shock (110ms), a sharp fencer can parry an incoming counter-riposte!
    if (this.stateTimer >= 0.11 && this.parryCooldown <= 0 && input.consumeUp()) {
      this._startCombatParry(audio);
      return;
    }

    if (u >= 1) {
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateCombatParry(dt, input, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'combat_parry';
    this.animT = u;

    // Active parry frames cover the first ~265ms (so reacting immediately to any normal/riposte strike always blocks!);
    // the ~125ms+ tail drops guard (punishable by feints and delayed heavy lunges!).
    this.parryActive = this.parrySuccess || this.stateTimer <= 0.265;

    // Buffer Shift pressed ANY time during parry to fire an immediate crisp riposte!
    if (input.consumeShift()) {
      this.riposteQueued = true;
    }

    // After a successful clang, fire a queued riposte snappily without waiting out the whole parry clip
    if (this.riposteQueued && this.parrySuccess && this.stateTimer >= 0.08) {
      this.riposteQueued = false;
      this.parrySuccess = false;
      this.parryActive = false;
      this._startCombatStrike(audio, true);
      return;
    }

    if (this.stateTimer >= this.stateDur) {
      const blocked = this.parrySuccess;
      const queued = this.riposteQueued;
      this.parrySuccess = false;
      this.parryActive = false;
      this.riposteQueued = false;
      if (!blocked) {
        this.emptyParryStreak = Math.min(4, this.emptyParryStreak + 1);
        this.emptyParryDecay = 1.6;
        this.parryCooldown = 0.08 + this.emptyParryStreak * 0.04;
      }
      if (queued) {
        this._startCombatStrike(audio, blocked || this.riposteWindow > 0);
        return;
      }
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateCombatHit(dt, level, audio) {
    this.stateTimer += dt;
    this.anim = 'combat_hit';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);
    this.parryActive = false;
    this._moveX(this.vx * dt, level);
    this.vx *= Math.pow(level.ice ? 0.14 : 0.05, dt);
    if (!this._checkGroundSupport(level, audio)) return;
    // Knocked onto spikes!
    if (level.getTile(this.roomId, colOfX(this.x), this.row) === '^') {
      this._checkRunSpikes(level, audio);
      return;
    }
    if (this.stateTimer >= this.stateDur) {
      this.vx = 0;
      this.enterState(this.swordDrawn ? 'combat_idle' : 'idle', 0.2);
    }
  }

  _updateSheathe(dt) {
    this.stateTimer += dt;
    this.anim = 'sheathe';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);
    if (this.stateTimer >= this.stateDur) {
      this.enterState('idle', 0.2);
    }
  }

  receiveEnemyStrike(enemy, level, audio, opts = null) {
    if (!this.alive) return 'miss';
    if (this.state === 'combat_parry' && this.parryActive && this.facing !== enemy.facing) {
      this.parrySuccess = true;
      this.emptyParryStreak = 0;
      this.consecutiveStrikes = 0;
      this.parryCooldown = 0;
      this.riposteWindow = 0.78;
      audio.play('clang');
      level.spawnParticles(this.roomId, (this.x + enemy.x) * 0.5, this.y - 18, 12, '#fff5a8', 90, 0.3, 2);
      // Heavy / brawler / boss blows push a blocking defender back slightly (hazard pressure!)
      const push = opts?.heavy ? 7 : (enemy.archetype === 'brawler' || enemy.archetype === 'boss' ? 4 : 2);
      const pushDir = enemy.x < this.x ? 1 : -1;
      this._moveX(pushDir * (level.ice ? push * 1.4 : push), level);
      this._checkGroundSupport(level, audio);
      if (this.alive && this.grounded && level.getTile(this.roomId, colOfX(this.x), this.row) === '^') {
        this._checkRunSpikes(level, audio);
      }
      return 'parried';
    }
    // Unarmed or sheathed hero dies in one hit!
    if (!this.swordDrawn) {
      audio.play('hurt');
      level.spawnParticles(this.roomId, this.x, this.y - 16, 12, '#ff3344', 80, 0.4, 2);
      this.die('unarmed');
      return 'hit';
    }
    const knockDir = enemy.x < this.x ? 1 : -1;
    const dmg = opts?.damage ?? 1;
    audio.play('hurt');
    level.spawnParticles(this.roomId, this.x, this.y - 16, dmg > 1 ? 14 : 8, dmg > 1 ? '#ff9442' : '#ff4d5a', dmg > 1 ? 95 : 70, 0.36, 2);
    this.takeDamage(dmg, `DEFEATED BY ${enemy.name?.toUpperCase() || 'GUARD'}`, knockDir);
    return 'hit';
  }

  // -------------------------------------------------------------------------
  // Environmental Triggers (Slicers, Mirror, Deepfake Merge, Celine Rescue)
  // -------------------------------------------------------------------------

  _checkEnvironment(dt, time, level, enemies, audio) {
    const room = level.getRoom(this.roomId);
    if (!room) return;
    const col = colOfX(this.x);

    // 0. Periodic Alpine Foehn Wind Gusts (Eigerwand / Sphinx)
    // Holding Shift (brace / careful-step) or Down (crouch) anchors firmly against gusts.
    const wind = level.getWindState?.(this.roomId, time);
    if (this.grounded && wind && wind.active && level.isColInWind(this.roomId, col)) {
      const braced = this._bracingShift || this.state === 'crouch' || this.state === 'careful' ||
        this.state === 'pickup' || this.state === 'climb_up' || this.state === 'climb_down';
      if (!braced) {
        let pushSpeed = 0;
        if (this.state === 'idle' || this.state === 'land' || this.state === 'hard_land' || this.state === 'turn') {
          pushSpeed = 44;
        } else if (this.state === 'combat_idle') {
          pushSpeed = 24;
        } else if (this.state === 'run' || this.state === 'run_start' || this.state === 'skid') {
          pushSpeed = this.facing === wind.dir ? 16 : 28;
        }
        if (pushSpeed > 0) {
          this._moveX(wind.dir * pushSpeed * wind.strength * dt, level);
          this._checkGroundSupport(level, audio);
          if (!this.alive) return;
          if (this.grounded && level.getTile(this.roomId, colOfX(this.x), this.row) === '^') {
            this._checkRunSpikes(level, audio);
            return;
          }
        }
      }
    }

    // 1. Slicer / Beam Shutter check
    const slicerRow = this.grounded ? this.row : Math.max(0, Math.min(ROWS - 1, Math.floor((this.y - 12) / TILE_H)));
    if (level.getTile(this.roomId, col, slicerRow) === 'C') {
      const st = level.getSlicerState(this.roomId, col, slicerRow, time);
      if (st.closed && Math.abs(this.x - tileCenterX(col)) < 8) {
        audio.play('slicer');
        level.spawnParticles(this.roomId, this.x, this.y - 16, 14, '#ff4466', 90, 0.4, 2);
        this.die('slicer');
        return;
      }
    }

    // 2. CERN Quantum Mirror check (Level 3)
    if (room.mirror && !room.mirror.broken) {
      if (this.row === room.mirror.row && Math.abs(this.x - tileCenterX(room.mirror.col)) < 10) {
        room.mirror.broken = true;
        level.mirrorBroken = true;
        level.deepfakeSpawned = true;
        audio.play('mirror');
        level.spawnParticles(this.roomId, tileCenterX(room.mirror.col), floorY(room.mirror.row) - 18, 22, '#7ce8ff', 100, 0.65, 2);
        this.onEvent?.('mirrorBroken', room.mirror);
      }
    }

    // 3. Level 4 Deepfake Merge check (sheathed hero walks into sheathed Deepfake!)
    for (const e of enemies) {
      if (!e.alive || e.type !== 'deepfake' || e.roomId !== this.roomId) continue;
      if (e.row === this.row && !this.swordDrawn && !e.swordDrawn && Math.abs(e.x - this.x) < 16) {
        e.alive = false;
        e.hiddenAfterDeath = true;
        level.deepfakeMerged = true;
        this.maxHp = Math.min(8, this.maxHp + 1);
        this.hp = this.maxHp;
        audio.play('merge');
        level.spawnParticles(this.roomId, this.x, this.y - 16, 26, '#8cecff', 90, 0.7, 2);
        this.onEvent?.('deepfakeMerged', e);
      }
    }

    // 4. Level 5 Celine rescue auto-trigger when reaching Celine in final room (requires open exit & Zins defeated)!
    for (const d of room.decor) {
      if (d.type === 'celine' && this.row === d.row && Math.abs(this.x - tileCenterX(d.col)) < 18) {
        const zinsAlive = enemies.some((e) => e.alive && e.type === 'zins');
        const exitOpen = room.exits.length === 0 || room.exits.some((ex) => ex.isOpen);
        if (!zinsAlive && exitOpen) {
          audio.play('exit');
          this.onExitLevel?.();
          return;
        }
      }
    }
  }
}
