// src/enemy.js
// Guards, Elites, Dr. Viktor Zins, and the CERN/Jungfraujoch AI Deepfake.

import {
  VIEW_W, PLAY_H, COLS, ROWS, TILE_W, TILE_H,
  floorY, tileCenterX, colOfX,
} from './level.js';

const BODY_HALF_W = 6;
const GRAVITY = 460;

export class Enemy {
  constructor(roomId, def) {
    this.roomId = roomId;
    this.type = def.type || 'guard'; // 'guard' | 'elite' | 'deepfake' | 'zins'
    this.name = def.name || (
      this.type === 'zins' ? 'Dr. Viktor Zins' :
      this.type === 'deepfake' ? 'The Deepfake' :
      this.type === 'elite' ? 'Alpine Tactical' : 'Vault Guard'
    );
    this.palette = this.type;
    this.row = def.row;
    this.x = tileCenterX(def.col);
    this.y = floorY(def.row);
    this.spawnRoomId = roomId;
    this.spawnX = this.x;
    this.spawnRow = this.row;
    this.spawnFacing = def.facing || -1;
    this.vx = 0;
    this.vy = 0;
    this.facing = def.facing || -1;

    this.maxHp = def.hp || (this.type === 'zins' ? 6 : this.type === 'elite' ? 4 : 3);
    this.hp = this.maxHp;
    this.skill = def.skill ?? (this.type === 'zins' ? 5 : this.type === 'elite' ? 3 : 1);
    this.alive = true;
    this.grounded = true;
    this.hasSword = true;
    this.swordDrawn = this.type !== 'deepfake' || !def.scripted;
    this.nonCombat = !!def.scripted; // scripted Deepfake sabotage actors in L3
    this.scripted = def.scripted || null; // 'steal_elixir' | 'slam_gate' | 'mirror_dash'
    this.scriptTriggered = false;
    this.scriptDone = false;
    this.hiddenAfterDeath = false;

    this.state = this.nonCombat ? 'idle' : 'combat_idle';
    this.stateTimer = 0;
    this.stateDur = 0.25;
    this.anim = this.state;
    this.animT = 0;
    this.hurtFlash = 0;
    this.fallStartY = this.y;

    this.aiCooldown = 0.45 + Math.random() * 0.35;
    this.parryTimer = 0;
    this.strikeHitDone = false;
    this.strikeSwingPlayed = false;
    this.strikeTelegraph = 0;
    this.vulnerableTimer = 0; // open to riposte right after being parried!
    this.recoveryTimer = 0;   // brief window after stepping/striking where guard is open
    this.stepStartX = this.x;
    this.stepTargetX = this.x;
  }

  enterState(state, dur = 0.25) {
    this.state = state;
    this.stateTimer = 0;
    this.stateDur = Math.max(0.01, dur);
    this.anim = state;
    this.animT = 0;
  }

  takeDamage(amount, reason = 'hit', knockDir = 0) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 0.45;
    if (this.hp <= 0) {
      this.die();
      return;
    }
    if (knockDir !== 0 && this.grounded) {
      this.vx = knockDir * 84;
      this.enterState('combat_hit', 0.28);
    }
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.swordDrawn = false;
    this.vx = 0;
    this.vy = 0;
    this.enterState('dead', 0.55);
  }

  receivePlayerStrike(player, level, audio, isRiposte = false) {
    if (!this.alive || this.nonCombat) return 'miss';

    // State-driven defense:
    // - Ripostes after a player parry ALWAYS land.
    // - Enemies CANNOT parry while stepping, striking, stunned, or in post-action recovery.
    // - Enemies parry 100% while actively guarding (combat_parry), and moderately in neutral stance.
    const canParry = this.grounded &&
      (this.state === 'combat_idle' || this.state === 'combat_parry') &&
      this.vulnerableTimer <= 0 &&
      this.recoveryTimer <= 0 &&
      !isRiposte;

    const parryChance = this.type === 'deepfake' ? 0.42 : Math.min(0.48, 0.10 + this.skill * 0.075);
    if (canParry && (this.state === 'combat_parry' || Math.random() < parryChance)) {
      this.enterState('combat_parry', 0.28);
      this.aiCooldown = Math.max(0.22, 0.44 - this.skill * 0.04);
      return 'parried';
    }

    const knockDir = player.x < this.x ? 1 : -1;
    this.takeDamage(1, 'sword', knockDir);
    return 'hit';
  }

  update(dt, time, player, level, audio, onEvent) {
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.vulnerableTimer > 0) this.vulnerableTimer = Math.max(0, this.vulnerableTimer - dt);
    if (this.recoveryTimer > 0) this.recoveryTimer = Math.max(0, this.recoveryTimer - dt);
    if (this.strikeTelegraph > 0) this.strikeTelegraph = Math.max(0, this.strikeTelegraph - dt);

    if (!this.alive) {
      this.stateTimer += dt;
      this.anim = 'dead';
      this.animT = Math.min(1, this.stateTimer / this.stateDur);
      return;
    }

    // Scripted Deepfake sabotage sequences in Level 3
    if (this.scripted) {
      this._updateScripted(dt, player, level, audio, onEvent);
      return;
    }

    // Falling physics (when knocked off a ledge!)
    if (!this.grounded) {
      this._updateFall(dt, level, audio);
      return;
    }

    // Verify ground support
    if (!level.hasFloor(this.roomId, colOfX(this.x), this.row)) {
      this.grounded = false;
      this.fallStartY = this.y;
      this.vy = 15;
      this.swordDrawn = false;
      this.enterState('fall', 0.4);
      return;
    }
    this.y = floorY(this.row);

    // Special Level 4 Deepfake behavior: mirrors player's sheathe!
    if (this.type === 'deepfake' && player.roomId === this.roomId && player.row === this.row) {
      if (!player.swordDrawn && (player.sheathedLock > 0 || !this.swordDrawn)) {
        if (this.swordDrawn) {
          this.swordDrawn = false;
          this.enterState('idle', 0.2);
          onEvent?.('deepfakeSheathed', this);
        }
        this.facing = player.x >= this.x ? 1 : -1;
        this.stateTimer += dt;
        this.anim = 'idle';
        this.animT = (this.stateTimer * 0.6) % 1;
        return;
      } else if (player.swordDrawn && !this.swordDrawn) {
        this.swordDrawn = true;
        this.enterState('combat_idle', 0.2);
      }
    }

    // Combat states
    switch (this.state) {
      case 'combat_idle':
      case 'idle':
        this._updateCombatAI(dt, player, level, audio);
        break;
      case 'combat_advance':
      case 'combat_retreat':
        this._updateStep(dt, level);
        break;
      case 'combat_strike':
        this._updateStrike(dt, player, level, audio);
        break;
      case 'combat_parry':
        this.stateTimer += dt;
        this.anim = 'combat_parry';
        this.animT = Math.min(1, this.stateTimer / this.stateDur);
        if (this.stateTimer >= this.stateDur) {
          this.enterState('combat_idle', 0.2);
        }
        break;
      case 'combat_hit':
        this._updateHit(dt, level, audio);
        break;
    }
  }

  _updateScripted(dt, player, level, audio, onEvent) {
    if (this.scriptDone) return;
    if (player.roomId !== this.roomId) return;

    if (!this.scriptTriggered) {
      this.scriptTriggered = true;
      this.anim = 'run';
      this.facing = 1;
      if (this.scripted === 'steal_elixir') {
        onEvent?.('deepfakeTaunt', 'DEEPFAKE: "Don\'t mind if I borrow your Swiss tonic!"');
      } else if (this.scripted === 'slam_gate') {
        onEvent?.('deepfakeTaunt', 'DEEPFAKE: "Oops — security protocol! Take the long way."');
      }
    }

    // Run right across the room, triggering plates or stealing elixir along the way
    this.stateTimer += dt;
    this.anim = 'run';
    this.animT = (this.stateTimer / 0.36) % 1;
    this.x += this.facing * 118 * dt;

    const room = level.getRoom(this.roomId);
    if (room && this.scripted === 'steal_elixir') {
      for (const it of room.items) {
        if (!it.collected && it.row === this.row && Math.abs(it.x - this.x) < 12) {
          it.collected = true;
          audio.play('elixir');
          level.spawnParticles(this.roomId, it.x, it.y - 8, 12, '#45d4f5', 60, 0.5, 2);
        }
      }
    }

    if (room && this.scripted === 'slam_gate') {
      const col = colOfX(this.x);
      const ch = level.getTile(this.roomId, col, this.row);
      if (ch === 'Q') {
        level.triggerPlate(this.roomId, col, this.row, audio, onEvent, { silentBanner: true });
      }
    }

    if (this.x > VIEW_W - 8 || level.isWall(this.roomId, colOfX(this.x + 8), this.row)) {
      level.spawnParticles(this.roomId, this.x, this.y - 16, 14, '#5ee8ff', 70, 0.45, 2);
      this.alive = false;
      this.hiddenAfterDeath = true;
      this.scriptDone = true;
    }
  }

  _canSeePlayer(player, level) {
    if (!player.alive || player.roomId !== this.roomId || player.row !== this.row) return false;
    const c1 = Math.max(0, Math.min(COLS - 1, colOfX(Math.min(this.x, player.x))));
    const c2 = Math.max(0, Math.min(COLS - 1, colOfX(Math.max(this.x, player.x))));
    for (let c = c1; c <= c2; c++) {
      if (level.isWall(this.roomId, c, this.row)) return false;
      if (level.isGateBlocking(this.roomId, c, this.row)) return false;
      if (!level.hasFloor(this.roomId, c, this.row)) return false;
    }
    return true;
  }

  _canStepSafely(level, dir) {
    const nx = this.x + dir * 16;
    if (nx < 10 || nx > VIEW_W - 10) return false;
    const nc = colOfX(nx);
    if (level.isWall(this.roomId, nc, this.row)) return false;
    if (level.isGateBlocking(this.roomId, nc, this.row)) return false;
    if (!level.hasFloor(this.roomId, nc, this.row)) return false;
    if (level.getTile(this.roomId, nc, this.row) === '^') return false;
    return true;
  }

  _updateCombatAI(dt, player, level, audio) {
    this.stateTimer += dt;
    this.anim = this.swordDrawn ? 'combat_idle' : 'idle';
    this.animT = (this.stateTimer * 0.85) % 1;

    if (!this.swordDrawn) return;

    // When the player leaves the room, reset guard back toward patrol post so they never doorway-camp!
    if (player.roomId !== this.roomId) {
      if (this.roomId === this.spawnRoomId && this.row === this.spawnRow) {
        const dx = this.spawnX - this.x;
        if (Math.abs(dx) > 4) {
          this.x += Math.sign(dx) * Math.min(Math.abs(dx), 96 * dt);
        } else {
          this.x = this.spawnX;
        }
        this.facing = this.spawnFacing;
        this.aiCooldown = Math.max(this.aiCooldown, 0.45);
      }
      return;
    }

    if (!this._canSeePlayer(player, level)) return;

    this.facing = player.x >= this.x ? 1 : -1;
    const dist = Math.abs(player.x - this.x);

    this.aiCooldown -= dt;
    if (this.aiCooldown > 0) return;

    // Higher skill = sharper cadence, but strikes always keep a fair 230–265ms windup telegraph
    const baseDelay = Math.max(0.32, 0.86 - this.skill * 0.10);

    if (dist > 34) {
      // Advance toward player if safe, respecting minimum duel spacing
      if (this._canStepSafely(level, this.facing)) {
        const maxStep = Math.min(16, Math.max(6, dist - 28));
        this.stepStartX = this.x;
        this.stepTargetX = this.x + this.facing * maxStep;
        audio.play('step');
        this.enterState('combat_advance', 0.22);
      }
      this.aiCooldown = baseDelay * 0.45;
    } else if (dist < 23 && this._canStepSafely(level, -this.facing)) {
      // Maintain clean fencing distance (no nose-to-nose blade clipping)
      this.stepStartX = this.x;
      this.stepTargetX = this.x - this.facing * 12;
      this.enterState('combat_retreat', 0.20);
      this.aiCooldown = baseDelay * 0.4;
    } else {
      // In sword range: strike (with readable windup), feint/retreat, or active guard
      const roll = Math.random();
      const strikeProb = 0.56 + this.skill * 0.05;
      if (roll < strikeProb) {
        const strikeDur = Math.max(0.46, 0.54 - this.skill * 0.015);
        audio.play('telegraph');
        this.strikeHitDone = false;
        this.strikeSwingPlayed = false;
        this.strikeTelegraph = strikeDur * 0.48;
        this.enterState('combat_strike', strikeDur);
        this.aiCooldown = baseDelay;
      } else if (roll < 0.84 && this._canStepSafely(level, -this.facing)) {
        this.stepStartX = this.x;
        this.stepTargetX = this.x - this.facing * 12;
        this.enterState('combat_retreat', 0.22);
        this.aiCooldown = baseDelay * 0.48;
      } else {
        this.enterState('combat_parry', 0.30);
        this.aiCooldown = baseDelay * 0.45;
      }
    }
  }

  _updateStep(dt, level) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.animT = u;
    const nx = this.stepStartX + (this.stepTargetX - this.stepStartX) * u;
    this._moveX(nx - this.x, level);
    if (u >= 1) {
      // Brief recovery window after stepping rewards proactive spacing/strikes
      this.recoveryTimer = Math.max(this.recoveryTimer, 0.16);
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateStrike(dt, player, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'combat_strike';
    this.animT = u;

    // Distinct swing audio as the lunge launches after the ~230-265ms windup telegraph
    if (!this.strikeSwingPlayed && u >= 0.46) {
      this.strikeSwingPlayed = true;
      audio.play('strike');
    }

    if (!this.strikeHitDone && u >= 0.50 && u <= 0.72) {
      if (this._canSeePlayer(player, level) && Math.abs(player.x - this.x) <= 38) {
        this.strikeHitDone = true;
        const res = player.receiveEnemyStrike(this, level, audio);
        if (res === 'parried') {
          this.vulnerableTimer = 0.85; // Generous guaranteed riposte opening!
          this._moveX(-this.facing * 6, level);
          this.aiCooldown = 0.65;
        }
      }
    }

    if (u >= 1) {
      this.recoveryTimer = Math.max(this.recoveryTimer, 0.22);
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateHit(dt, level, audio) {
    this.stateTimer += dt;
    this.anim = 'combat_hit';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);

    this._moveX(this.vx * dt, level);
    this.vx *= Math.pow(0.05, dt);

    // Check if knocked onto spikes!
    const col = colOfX(this.x);
    if (level.getTile(this.roomId, col, this.row) === '^') {
      const room = level.getRoom(this.roomId);
      const sp = room?.spikes.get(`${col},${this.row}`);
      if (sp) {
        sp.extended = 1.0;
        sp.triggered = true;
      }
      audio.play('hurt');
      this.die();
      return;
    }

    // Check if knocked off a ledge!
    if (!level.hasFloor(this.roomId, col, this.row)) {
      this.grounded = false;
      this.fallStartY = this.y;
      this.vy = 15;
      this.swordDrawn = false;
      this.enterState('fall', 0.4);
      return;
    }

    if (this.stateTimer >= this.stateDur) {
      this.vx = 0;
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateFall(dt, level, audio) {
    this.stateTimer += dt;
    this.anim = 'fall';
    this.animT = (this.stateTimer * 2.5) % 1;

    const prevY = this.y;
    this.vy = Math.min(260, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;

    if (this.y > PLAY_H) {
      const room = level.getRoom(this.roomId);
      if (room && room.links.down !== null) {
        this.roomId = room.links.down;
        this.y -= PLAY_H;
        this.fallStartY -= PLAY_H;
        this.row = 0;
        return;
      }
      this.hiddenAfterDeath = true;
      this.die();
      return;
    }

    const col = colOfX(this.x);
    for (let r = 0; r < ROWS; r++) {
      const fy = floorY(r);
      if (prevY <= fy + 2 && this.y >= fy && level.hasFloor(this.roomId, col, r)) {
        this.y = fy;
        this.row = r;
        this.vy = 0;
        this.vx = 0;
        this.grounded = true;
        const tile = level.getTile(this.roomId, col, r);
        if (tile === '^') {
          audio.play('hurt');
          this.die();
          return;
        }
        const floors = (this.y - this.fallStartY) / TILE_H;
        if (floors >= 2.2) {
          audio.play('hardLand');
          this.die();
        } else if (floors >= 1.3) {
          audio.play('hardLand');
          this.takeDamage(1, 'fall');
          if (this.alive) {
            this.swordDrawn = true;
            this.enterState('combat_idle', 0.2);
          }
        } else {
          audio.play('land');
          this.swordDrawn = true;
          this.enterState('combat_idle', 0.2);
        }
        return;
      }
    }
  }

  _moveX(dx, level) {
    if (dx === 0) return;
    let nx = this.x + dx;
    if (dx > 0) {
      const lc = colOfX(nx + BODY_HALF_W);
      if (lc >= COLS || level.isWall(this.roomId, lc, this.row) || level.isGateBlocking(this.roomId, lc, this.row)) {
        nx = Math.min(nx, lc * TILE_W - BODY_HALF_W - 0.1);
      }
    } else {
      const lc = colOfX(nx - BODY_HALF_W);
      if (lc < 0 || level.isWall(this.roomId, lc, this.row) || level.isGateBlocking(this.roomId, lc, this.row)) {
        nx = Math.max(nx, (lc + 1) * TILE_W + BODY_HALF_W + 0.1);
      }
    }
    this.x = Math.max(6, Math.min(VIEW_W - 6, nx));
  }
}
