// src/enemy.js
// Guards, Elites, Dr. Viktor Zins, and the CERN/Jungfraujoch AI Deepfake.
// Tactical 1989-style sword AI: reactive parry + riposte, strike windup/active/recovery,
// feints, advancing lunges, hazard awareness/pushing, distinct archetypes, pair coordination,
// and a 3-phase boss duel for Dr. Viktor Zins.

import {
  VIEW_W, PLAY_H, COLS, ROWS, TILE_W, TILE_H,
  floorY, tileCenterX, colOfX,
} from './level.js';

const BODY_HALF_W = 6;
const GRAVITY = 460;

// Archetype combat profiles (further scaled by skill 1..5 and boss phase 1..3)
export const ARCHETYPES = {
  rookie: {
    idealMin: 26,
    idealMax: 35,
    baseDelay: 0.84,
    delayPerSkill: 0.04,
    minDelay: 0.68,
    parryBase: 0.08,
    parryPerSkill: 0.03,
    spamParryBonus: 0.05,
    parryCap: 0.22,
    riposteChance: 0.15,
    riposteWindup: 0.36,
    strikeWindup: 0.28,
    strikeRecovery: 0.30,
    feintChance: 0.0,
    heavyChance: 0.0,
    followUpChance: 0.0,
    counterRiposteChance: 0.0,
    retreatAfterHit: 0.12,
    retreatAfterStrike: 0.10,
    whiffPunishDelay: 0.45,
    turtleBreakThreshold: 5,
    pushAggression: 0.20,
  },
  sentry: {
    idealMin: 28,
    idealMax: 37,
    baseDelay: 0.54,
    delayPerSkill: 0.055,
    minDelay: 0.34,
    parryBase: 0.60,
    parryPerSkill: 0.10,
    spamParryBonus: 0.36,
    parryCap: 0.97,
    riposteChance: 0.94,
    riposteWindup: 0.255,
    strikeWindup: 0.25,
    strikeRecovery: 0.24,
    feintChance: 0.20,
    heavyChance: 0.12,
    followUpChance: 0.20,
    counterRiposteChance: 0.0,
    retreatAfterHit: 0.28,
    retreatAfterStrike: 0.28,
    whiffPunishDelay: 0.08,
    turtleBreakThreshold: 2,
    pushAggression: 0.58,
  },
  brawler: {
    idealMin: 24,
    idealMax: 32,
    baseDelay: 0.48,
    delayPerSkill: 0.05,
    minDelay: 0.26,
    parryBase: 0.56,
    parryPerSkill: 0.10,
    spamParryBonus: 0.38,
    parryCap: 0.97,
    riposteChance: 0.96,
    riposteWindup: 0.245,
    strikeWindup: 0.242,
    strikeRecovery: 0.24,
    feintChance: 0.18,
    heavyChance: 0.46,
    followUpChance: 0.46,
    counterRiposteChance: 0.10,
    retreatAfterHit: 0.10,
    retreatAfterStrike: 0.08,
    whiffPunishDelay: 0.06,
    turtleBreakThreshold: 2,
    pushAggression: 0.90,
  },
  duellist: {
    idealMin: 27,
    idealMax: 37,
    baseDelay: 0.50,
    delayPerSkill: 0.05,
    minDelay: 0.26,
    parryBase: 0.62,
    parryPerSkill: 0.08,
    spamParryBonus: 0.34,
    parryCap: 0.98,
    riposteChance: 0.96,
    riposteWindup: 0.238,
    strikeWindup: 0.238,
    strikeRecovery: 0.20,
    feintChance: 0.36,
    heavyChance: 0.24,
    followUpChance: 0.30,
    counterRiposteChance: 0.24,
    retreatAfterHit: 0.38,
    retreatAfterStrike: 0.24,
    whiffPunishDelay: 0.05,
    turtleBreakThreshold: 2,
    pushAggression: 0.78,
  },
  boss: {
    idealMin: 26,
    idealMax: 36,
    baseDelay: 0.42,
    delayPerSkill: 0.015,
    minDelay: 0.20,
    parryBase: 0.64,
    parryPerSkill: 0.05,
    spamParryBonus: 0.32,
    parryCap: 0.98,
    riposteChance: 0.98,
    riposteWindup: 0.232,
    strikeWindup: 0.232,
    strikeRecovery: 0.17,
    feintChance: 0.32,
    heavyChance: 0.28,
    followUpChance: 0.42,
    counterRiposteChance: 0.0,
    retreatAfterHit: 0.26,
    retreatAfterStrike: 0.16,
    whiffPunishDelay: 0.04,
    turtleBreakThreshold: 2,
    pushAggression: 0.90,
  },
};

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
    this.archetype = def.archetype || (
      this.type === 'zins' ? 'boss' :
      this.type === 'deepfake' ? 'duellist' :
      this.type === 'elite' ? 'duellist' :
      this.skill <= 1 ? 'rookie' : 'sentry'
    );
    this.bossPhase = 1;
    this.alive = true;
    this.grounded = true;
    this.hasSword = true;
    this.swordDrawn = this.type !== 'deepfake' || !def.scripted;
    this.nonCombat = !!def.scripted; // scripted Deepfake sabotage actors
    this.scripted = def.scripted || null; // 'steal_elixir' | 'slam_gate' | 'mirror_dash' | 'archive_sabotage' | 'viaduct_sabotage'
    this.scriptTriggered = false;
    this.scriptDone = false;
    this.hiddenAfterDeath = false;
    this.bark = def.bark || null;
    this.barked = false;
    this.taunt = def.taunt || null;

    this.state = this.nonCombat ? 'idle' : 'combat_idle';
    this.stateTimer = 0;
    this.stateDur = 0.25;
    this.anim = this.state;
    this.animT = 0;
    this.hurtFlash = 0;
    this.fallStartY = this.y;

    this.aiCooldown = 0.40 + Math.random() * 0.25;
    this.parryTimer = 0;
    this.strikeHitDone = false;
    this.strikeSwingPlayed = false;
    this.strikeTelegraph = 0;
    this.strikeKind = 'normal'; // 'normal' | 'riposte' | 'heavy'
    this.strikeWindupFrac = 0.50;
    this.strikeActiveEndFrac = 0.72;
    this.strikeReach = 38;
    this.strikeLungeDist = 0;
    this.strikeLungeMoved = 0;
    this.pendingRiposte = false;
    this.pendingFeintFollowup = false;
    this.feintFollowupHeavy = false;
    this.lastReactedStrikeId = -1;
    this.playerTurtleCount = 0;
    this.playerPassiveTimer = 0;
    this.vulnerableTimer = 0; // open to riposte right after being parried!
    this.recoveryTimer = 0;   // brief window after stepping/striking where guard is open
    this.stepStartX = this.x;
    this.stepTargetX = this.x;
    this._onEvent = null;
  }

  _profile() {
    return ARCHETYPES[this.archetype] || ARCHETYPES.sentry;
  }

  _phaseParams() {
    const base = this._profile();
    if (this.archetype !== 'boss') {
      const s = this.skill;
      return {
        delay: Math.max(base.minDelay, base.baseDelay - s * base.delayPerSkill),
        parryChance: Math.min(base.parryCap, base.parryBase + s * base.parryPerSkill),
        spamParryBonus: base.spamParryBonus,
        parryCap: base.parryCap,
        riposteChance: Math.min(0.98, base.riposteChance + Math.max(0, s - 2) * 0.06),
        riposteWindup: Math.max(0.225, base.riposteWindup - Math.max(0, s - 2) * 0.012),
        strikeWindup: Math.max(0.225, base.strikeWindup - Math.max(0, s - 2) * 0.008),
        strikeRecovery: Math.max(0.18, base.strikeRecovery - Math.max(0, s - 2) * 0.015),
        feintChance: Math.min(0.45, base.feintChance + Math.max(0, s - 2) * 0.05),
        heavyChance: Math.min(0.50, base.heavyChance + Math.max(0, s - 2) * 0.05),
        followUpChance: Math.min(0.52, base.followUpChance + Math.max(0, s - 2) * 0.05),
        counterRiposteChance: s >= 4 ? base.counterRiposteChance : 0,
        retreatAfterHit: base.retreatAfterHit,
        retreatAfterStrike: base.retreatAfterStrike,
        whiffPunishDelay: base.whiffPunishDelay,
        turtleBreakThreshold: base.turtleBreakThreshold,
        pushAggression: base.pushAggression,
        idealMin: base.idealMin,
        idealMax: base.idealMax,
      };
    }

    // Dr. Viktor Zins 3-phase boss curve (all strikes keep >= 220ms readable windup)
    if (this.bossPhase === 1) {
      return {
        delay: 0.36,
        parryChance: 0.78,
        spamParryBonus: 0.25,
        parryCap: 0.98,
        riposteChance: 0.96,
        riposteWindup: 0.235,
        strikeWindup: 0.235,
        strikeRecovery: 0.18,
        feintChance: 0.28,
        heavyChance: 0.20,
        followUpChance: 0.30,
        counterRiposteChance: 0.0, // Phase 1 rewards clean ripostes directly
        retreatAfterHit: 0.24,
        retreatAfterStrike: 0.16,
        whiffPunishDelay: 0.05,
        turtleBreakThreshold: 2,
        pushAggression: 0.84,
        idealMin: 27,
        idealMax: 36,
      };
    }
    if (this.bossPhase === 2) {
      return {
        delay: 0.25,
        parryChance: 0.86,
        spamParryBonus: 0.25,
        parryCap: 0.98,
        riposteChance: 1.0,
        riposteWindup: 0.226,
        strikeWindup: 0.226,
        strikeRecovery: 0.16,
        feintChance: 0.46,
        heavyChance: 0.44,
        followUpChance: 0.50,
        counterRiposteChance: 0.50, // Can clash-parry a riposte!
        retreatAfterHit: 0.26,
        retreatAfterStrike: 0.12,
        whiffPunishDelay: 0.03,
        turtleBreakThreshold: 1,
        pushAggression: 0.92,
        idealMin: 25,
        idealMax: 35,
      };
    }
    // Phase 3: Midnight Consolidation (HP <= 3)
    return {
      delay: 0.17,
      parryChance: 0.90,
      spamParryBonus: 0.26,
      parryCap: 0.99,
      riposteChance: 1.0,
      riposteWindup: 0.220,
      strikeWindup: 0.220,
      strikeRecovery: 0.14,
      feintChance: 0.56,
      heavyChance: 0.60,
      followUpChance: 0.68,
      counterRiposteChance: 0.64,
      retreatAfterHit: 0.16,
      retreatAfterStrike: 0.06,
      whiffPunishDelay: 0.02,
      turtleBreakThreshold: 1,
      pushAggression: 0.98,
      idealMin: 24,
      idealMax: 34,
    };
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
    this.strikeTelegraph = 0;
    this.pendingRiposte = false;
    this.pendingFeintFollowup = false;

    if (this.hp <= 0) {
      this.die();
      return;
    }

    // Dr. Viktor Zins phase transitions! (e.g. HP 8 -> P1: 8..7, P2: 6..4, P3: 3..1)
    let phaseShifted = false;
    if (this.archetype === 'boss') {
      const p2Cut = Math.max(4, this.maxHp - 2);
      const p3Cut = Math.max(2, Math.floor(this.maxHp * 0.38));
      const nextPhase = this.hp <= p3Cut ? 3 : this.hp <= p2Cut ? 2 : 1;
      if (nextPhase > this.bossPhase) {
        this.bossPhase = nextPhase;
        phaseShifted = true;
        this.vulnerableTimer = 0;
        this.recoveryTimer = 0;
        this._onEvent?.('bossPhase', { phase: this.bossPhase, boss: this });
      }
    }

    if (knockDir !== 0 && this.grounded) {
      this.vx = knockDir * (phaseShifted ? 96 : 84);
      this.enterState('combat_hit', phaseShifted ? 0.32 : 0.26);
    }
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.swordDrawn = false;
    this.strikeTelegraph = 0;
    this.pendingRiposte = false;
    this.pendingFeintFollowup = false;
    this.vx = 0;
    this.vy = 0;
    this.enterState('dead', 0.55);
    this._onEvent?.('enemyDefeated', this);
  }

  _computeParryChance(player) {
    const p = this._phaseParams();
    if (this.type === 'deepfake') {
      return Math.min(0.85, 0.46 + (player.consecutiveStrikes || 0) * 0.16);
    }
    const spam = Math.max(0, (player.consecutiveStrikes || 0) - 1);
    return Math.min(p.parryCap, p.parryChance + spam * p.spamParryBonus);
  }

  receivePlayerStrike(player, level, audio, isRiposte = false) {
    if (!this.alive || this.nonCombat) return 'miss';

    const p = this._phaseParams();
    this.playerPassiveTimer = 0;
    this.playerTurtleCount = 0;

    // 1. If actively holding parry stance:
    //    - Blocks normal strikes 100%.
    //    - Ripostes break passive parry UNLESS enemy is a high-skill duellist/boss counter-clashing.
    if (this.grounded && this.state === 'combat_parry' && !isRiposte) {
      this._triggerParryCounter(player, p);
      return 'parried';
    }

    // 2. Riposte after player parry:
    //    - Always lands on rookie/sentry/Phase 1 Zins/low skill.
    //    - On skill 4 duellists & Zins Phase 2/3, small chance for a dramatic sword clash!
    if (isRiposte) {
      if (this.grounded && p.counterRiposteChance > 0 && Math.random() < p.counterRiposteChance) {
        this.vulnerableTimer = 0;
        this.recoveryTimer = 0;
        this._triggerParryCounter(player, p, true);
        return 'parried';
      }
      const knockDir = player.x < this.x ? 1 : -1;
      this.vulnerableTimer = 0;
      this.takeDamage(1, 'sword', knockDir);
      return 'hit';
    }

    // 3. Reactive parry from neutral stance (or mid-feint / early windup / advance for skill >= 2):
    //    - Cannot parry while stunned (combat_hit), recovering from a whiff (combat_recover),
    //      parried-open (vulnerableTimer > 0), or during active/recovery frames of a strike!
    const inGuardableState =
      this.state === 'combat_idle' ||
      (this.skill >= 2 && this.state === 'combat_feint') ||
      (this.skill >= 2 && this.state === 'combat_advance' && this.animT < 0.65) ||
      (this.skill >= 2 && this.state === 'combat_retreat' && this.animT < 0.60) ||
      (this.skill >= 2 && this.state === 'combat_strike' && this.strikeKind !== 'riposte' && this.animT < this.strikeWindupFrac * 0.65);

    const canParry = this.grounded &&
      inGuardableState &&
      this.vulnerableTimer <= 0 &&
      this.recoveryTimer <= 0;

    if (canParry) {
      const chance = this._computeParryChance(player);
      if (Math.random() < chance) {
        this._triggerParryCounter(player, p);
        return 'parried';
      }
    }

    // 4. Mid-lunge blade clash / commitment:
    //    - Against skill >= 2 enemies who have ALREADY launched a committed lunge (riposte, heavy,
    //      or late normal windup), trying to mash a normal strike into their incoming blade gets
    //      clashed/deflected rather than letting the masher stunlock through their attack!
    const knockDir = player.x < this.x ? 1 : -1;
    if (this.state === 'combat_strike' && this.skill >= 2 && this.animT <= this.strikeActiveEndFrac) {
      if (this.strikeKind === 'riposte') {
        // Cannot interrupt an enemy counter-riposte by mashing Shift — it deflects and keeps thrusting!
        return 'parried';
      }
      if (this.strikeKind === 'heavy' && this.animT >= this.strikeWindupFrac * 0.45) {
        // Heavy lunge pushes through reckless swings (player must parry or out-space!)
        return 'parried';
      }
      if (this.animT >= this.strikeWindupFrac * 0.55 && (player.consecutiveStrikes || 0) >= 2) {
        // Spamming into an already-launching strike triggers a blade clash -> riposte!
        this._triggerParryCounter(player, p, true);
        return 'parried';
      }
    }

    this.takeDamage(1, 'sword', knockDir);
    return 'hit';
  }

  _triggerParryCounter(player, p, forceRiposte = false) {
    this.facing = player.x >= this.x ? 1 : -1;
    this.strikeTelegraph = 0;
    this.enterState('combat_parry', 0.26);
    const spamBonus = (player.consecutiveStrikes || 0) >= 2 ? 0.20 : 0;
    const willRiposte = forceRiposte || Math.random() < Math.min(1, p.riposteChance + spamBonus);
    this.pendingRiposte = willRiposte;
    this.aiCooldown = willRiposte ? 0.08 : Math.max(0.22, p.delay * 0.65);
  }

  _launchStrike(kind, audio, p) {
    this.strikeKind = kind;
    this.strikeHitDone = false;
    this.strikeSwingPlayed = false;
    this.strikeLungeMoved = 0;
    this.pendingRiposte = false;
    this.pendingFeintFollowup = false;

    let windup = p.strikeWindup;
    let active = 0.11;
    let recovery = p.strikeRecovery;
    let reach = 38;
    let lungeDist = 0;

    if (kind === 'riposte') {
      windup = p.riposteWindup; // >= 0.225s (human-reactable!)
      active = 0.10;
      recovery = Math.max(0.16, p.strikeRecovery - 0.04);
      reach = 42;
      lungeDist = 5;
      audio?.play('riposteTelegraph');
    } else if (kind === 'heavy') {
      // Delayed heavy advancing lunge: longer ~420ms windup throws off reflex early parries!
      windup = this.archetype === 'boss' || this.skill >= 3 ? 0.43 : 0.39;
      active = 0.12;
      recovery = p.strikeRecovery + 0.08; // bigger whiff punish window!
      reach = 44;
      lungeDist = 12;
      audio?.play('heavyTelegraph');
    } else {
      audio?.play('telegraph');
    }

    const totalDur = windup + active + recovery;
    this.strikeWindupFrac = windup / totalDur;
    this.strikeActiveEndFrac = (windup + active) / totalDur;
    this.strikeReach = reach;
    this.strikeLungeDist = lungeDist;
    this.strikeTelegraph = windup * 0.96;
    this.enterState('combat_strike', totalDur);
    this.aiCooldown = p.delay * (0.85 + Math.random() * 0.30);
  }

  _launchFeint(audio, p, followHeavy = false) {
    this.strikeKind = 'normal';
    this.pendingFeintFollowup = true;
    this.feintFollowupHeavy = followHeavy;
    // 265-285ms raised-blade feint: baits reflex parries so the follow-up lands right as guard drops!
    const feintDur = Math.max(0.265, 0.29 - this.skill * 0.005);
    this.strikeTelegraph = feintDur * 0.90;
    audio?.play('feint');
    this.enterState('combat_feint', feintDur);
    this.aiCooldown = 0.03;
  }

  update(dt, time, player, level, audio, onEvent, allEnemies = null) {
    this._onEvent = onEvent || null;
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

    // Track passive player behavior (turtling)
    if (this.swordDrawn && player.alive && player.roomId === this.roomId && player.row === this.row) {
      if (player.state === 'combat_strike') {
        this.playerPassiveTimer = 0;
      } else {
        this.playerPassiveTimer += dt;
      }
    }

    // Combat states
    switch (this.state) {
      case 'combat_idle':
      case 'idle':
        this._updateCombatAI(dt, player, level, audio, allEnemies);
        break;
      case 'combat_advance':
      case 'combat_retreat':
        this._updateStep(dt, player, level, audio);
        break;
      case 'combat_strike':
        this._updateStrike(dt, player, level, audio);
        break;
      case 'combat_feint':
        this._updateFeint(dt, player, level, audio);
        break;
      case 'combat_parry':
        this._updateParry(dt, player, level, audio);
        break;
      case 'combat_recover':
        this._updateRecover(dt);
        break;
      case 'combat_hit':
        this._updateHit(dt, player, level, audio);
        break;
    }
  }

  _updateScripted(dt, player, level, audio, onEvent) {
    if (this.scriptDone) return;
    if (player.roomId !== this.roomId) return;

    if (!this.scriptTriggered) {
      this.scriptTriggered = true;
      this.anim = 'run';
      this.facing = this.spawnFacing || 1;
      if (this.taunt) {
        onEvent?.('deepfakeTaunt', this.taunt);
      } else if (this.scripted === 'steal_elixir') {
        onEvent?.('deepfakeTaunt', 'DEEPFAKE: "CONSOLIDATING YOUR TONIC. RECEIPT FILED."');
      } else if (this.scripted === 'slam_gate') {
        onEvent?.('deepfakeTaunt', 'DEEPFAKE: "ACCESS REVOKED. PLEASE SUBMIT FORM 7-B."');
      } else if (this.scripted === 'archive_sabotage') {
        onEvent?.('deepfakeTaunt', 'DEEPFAKE: "FILED YOUR BERN ADDRESS. YOU ARE WELCOME."');
      } else if (this.scripted === 'viaduct_sabotage') {
        onEvent?.('deepfakeTaunt', 'DEEPFAKE: "UNREGISTERED COURIER. RE-ROUTING BRIDGE."');
      }
    }

    // Run across the room, triggering plates, breaking viaduct loose tiles, or stealing elixir along the way
    this.stateTimer += dt;
    this.anim = 'run';
    this.animT = (this.stateTimer / 0.36) % 1;
    this.x += this.facing * 118 * dt;

    const room = level.getRoom(this.roomId);
    const col = colOfX(this.x);
    if (room && this.scripted === 'steal_elixir') {
      for (const it of room.items) {
        if (!it.collected && it.row === this.row && Math.abs(it.x - this.x) < 12) {
          it.collected = true;
          audio.play('elixir');
          level.spawnParticles(this.roomId, it.x, it.y - 8, 12, '#45d4f5', 60, 0.5, 2);
        }
      }
    }

    if (room && (this.scripted === 'slam_gate' || this.scripted === 'archive_sabotage')) {
      const ch = level.getTile(this.roomId, col, this.row);
      if (ch === 'Q') {
        level.triggerPlate(this.roomId, col, this.row, audio, onEvent, { silentBanner: true });
      }
    }

    if (room && (this.scripted === 'archive_sabotage' || this.scripted === 'viaduct_sabotage')) {
      const ch = level.getTile(this.roomId, col, this.row);
      if (ch === 'L') {
        level.triggerLooseFloor(this.roomId, col, this.row, audio);
      }
    }

    const outRight = this.facing > 0 && (this.x > VIEW_W - 8 || level.isWall(this.roomId, colOfX(this.x + 8), this.row));
    const outLeft = this.facing < 0 && (this.x < 8 || level.isWall(this.roomId, colOfX(this.x - 8), this.row));
    if (outRight || outLeft) {
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

  _canStepSafely(level, dir, dist = 16) {
    const nx = this.x + dir * dist;
    if (nx < 10 || nx > VIEW_W - 10) return false;
    const nc = colOfX(nx);
    if (level.isWall(this.roomId, nc, this.row)) return false;
    if (level.isGateBlocking(this.roomId, nc, this.row)) return false;
    if (!level.hasFloor(this.roomId, nc, this.row)) return false;
    const ch = level.getTile(this.roomId, nc, this.row);
    if (ch === '^' || ch === 'L') return false;
    return true;
  }

  _hazardBehindPlayer(player, level) {
    const backDir = player.x >= this.x ? 1 : -1;
    for (let d = 16; d <= 52; d += 16) {
      const px = player.x + backDir * d;
      if (px < 10 || px > VIEW_W - 10) return false;
      const c = colOfX(px);
      if (level.isWall(this.roomId, c, this.row)) return false;
      if (!level.hasFloor(this.roomId, c, this.row)) return true;
      const ch = level.getTile(this.roomId, c, this.row);
      if (ch === '^' || ch === 'L') return true;
    }
    return false;
  }

  _partnerInfo(player, allEnemies) {
    if (!allEnemies || allEnemies.length <= 1) return null;
    const peers = allEnemies.filter((e) =>
      e !== this && e.alive && !e.nonCombat && e.swordDrawn &&
      e.roomId === this.roomId && e.row === this.row
    );
    if (peers.length === 0) return null;
    const peer = peers[0];
    const myDist = Math.abs(player.x - this.x);
    const peerDist = Math.abs(player.x - peer.x);
    const sameSide = Math.sign(this.x - player.x) === Math.sign(peer.x - player.x);
    const peerStriking = peer.state === 'combat_strike' || peer.state === 'combat_feint';
    return { peer, myDist, peerDist, sameSide, peerStriking };
  }

  _tryReactiveParry(player, p) {
    if (this.vulnerableTimer > 0 || this.recoveryTimer > 0) return false;
    if (player.state !== 'combat_strike' || player.strikeIsRiposte) return false;
    if (player.animT >= 0.34) return false;
    if (Math.abs(player.x - this.x) > 44) return false;
    if (this.lastReactedStrikeId === player.strikeId) return false;

    this.lastReactedStrikeId = player.strikeId;
    const chance = this._computeParryChance(player);
    if (Math.random() < chance) {
      this.facing = player.x >= this.x ? 1 : -1;
      this.enterState('combat_parry', 0.28);
      this.pendingRiposte = false; // riposte triggers if player blade actually clashes!
      this.aiCooldown = Math.max(0.14, p.delay * 0.45);
      return true;
    }
    return false;
  }

  _updateCombatAI(dt, player, level, audio, allEnemies) {
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
    const p = this._phaseParams();

    // 1. Reactive defense against incoming player strike windup (bypasses aiCooldown!)
    if (this._tryReactiveParry(player, p)) return;

    // 2. React to player whiffing a strike or dropping an empty parry (whiff punish!)
    const playerOpen =
      (player.state === 'combat_strike' && player.strikeWhiffed) ||
      (player.state === 'combat_parry' && !player.parryActive && !player.parrySuccess) ||
      player.state === 'combat_parried';

    if (playerOpen && dist <= 46 && this.vulnerableTimer <= 0 && this.aiCooldown > p.whiffPunishDelay) {
      this.aiCooldown = p.whiffPunishDelay;
    }

    // Pair coordination: avoid stacking on top of an ally; rotate pressure cleanly
    const pair = this._partnerInfo(player, allEnemies);
    if (pair) {
      if (pair.sameSide && pair.myDist > pair.peerDist + 2) {
        // Support partner holds ~26px behind vanguard and steps up if vanguard falls back or gets hit
        const wantDist = pair.peer.state === 'combat_hit' || pair.peer.state === 'combat_recover' ? 30 : pair.peerDist + 24;
        this.aiCooldown -= dt;
        if (this.aiCooldown <= 0) {
          if (dist > wantDist + 6 && this._canStepSafely(level, this.facing)) {
            this.stepStartX = this.x;
            this.stepTargetX = this.x + this.facing * 12;
            audio.play('step');
            this.enterState('combat_advance', 0.22);
          } else if (dist < wantDist - 6 && this._canStepSafely(level, -this.facing)) {
            this.stepStartX = this.x;
            this.stepTargetX = this.x - this.facing * 12;
            this.enterState('combat_retreat', 0.22);
          }
          this.aiCooldown = 0.24;
        }
        return;
      }
      if (!pair.sameSide && pair.peerStriking) {
        // Flanking partner staggers attacks slightly so player isn't hit on identical frames
        this.aiCooldown = Math.max(this.aiCooldown, 0.22);
      }
    }

    this.aiCooldown -= dt;
    if (this.aiCooldown > 0) return;

    const hazardBehind = this._hazardBehindPlayer(player, level);
    const playerTurtling =
      (player.emptyParryStreak || 0) >= p.turtleBreakThreshold ||
      this.playerTurtleCount >= p.turtleBreakThreshold ||
      this.playerPassiveTimer >= 2.2;

    // 3. Punish an open/whiffed player immediately!
    if (playerOpen && dist <= 42) {
      if (dist > 36 && p.heavyChance > 0 && this._canStepSafely(level, this.facing, 12)) {
        this._launchStrike('heavy', audio, p);
      } else {
        this._launchStrike('normal', audio, p);
      }
      return;
    }

    // 4. Distance management
    if (dist > p.idealMax + 4) {
      // Brawler/Boss can launch a gap-closing advancing lunge from mid-range!
      if (dist <= 45 && (playerTurtling || Math.random() < p.heavyChance * 0.75) &&
          this._canStepSafely(level, this.facing, 14)) {
        this._launchStrike('heavy', audio, p);
        return;
      }
      if (this._canStepSafely(level, this.facing)) {
        const maxStep = Math.min(18, Math.max(8, dist - p.idealMin - 2));
        this.stepStartX = this.x;
        this.stepTargetX = this.x + this.facing * maxStep;
        audio.play(level.ice ? 'iceStep' : 'step');
        this.enterState('combat_advance', 0.20);
      }
      this.aiCooldown = p.delay * 0.38;
      return;
    }

    if (dist < p.idealMin - 2 && this._canStepSafely(level, -this.facing)) {
      // Maintain clean fencing distance (no nose-to-nose blade clipping)
      this.stepStartX = this.x;
      this.stepTargetX = this.x - this.facing * 12;
      this.enterState('combat_retreat', 0.19);
      this.aiCooldown = p.delay * 0.35;
      return;
    }

    // 5. In sword range: choose tactical action based on archetype, player turtling, spam, and hazards
    const roll = Math.random();
    const playerMashing = this.skill >= 2 && (player.consecutiveStrikes || 0) >= 2;

    // Anti-mash discipline: never waste time feinting into a masher — hold active parry to counter-riposte!
    if (playerMashing) {
      if (roll < 0.72) {
        this.enterState('combat_parry', 0.30);
        this.pendingRiposte = false;
        this.aiCooldown = 0.14;
      } else if (p.heavyChance > 0 && this._canStepSafely(level, this.facing, 10)) {
        this._launchStrike('heavy', audio, p);
      } else {
        this._launchStrike('normal', audio, p);
      }
      return;
    }

    // Anti-turtle mixup: feint into strike or heavy advancing pressure!
    if (playerTurtling && p.feintChance > 0 && roll < Math.min(0.70, p.feintChance + 0.30)) {
      this._launchFeint(audio, p, Math.random() < p.heavyChance);
      return;
    }
    if ((playerTurtling || hazardBehind) && p.heavyChance > 0 && roll < p.heavyChance + 0.25 &&
        this._canStepSafely(level, this.facing, 10)) {
      this._launchStrike('heavy', audio, p);
      return;
    }

    // Normal tactical distribution
    const feintCut = p.feintChance;
    const heavyCut = feintCut + (this._canStepSafely(level, this.facing, 10) ? p.heavyChance * 0.65 : 0);
    const strikeCut = heavyCut + (hazardBehind ? 0.58 : 0.48);
    const retreatCut = strikeCut + (hazardBehind ? 0.05 : 0.14);

    if (roll < feintCut) {
      // In Zins Phase 2/3, feint follow-ups frequently escalate into the 2-damage crimson heavy!
      const followHeavy = this.archetype === 'boss' && this.bossPhase >= 2
        ? Math.random() < 0.55
        : Math.random() < p.heavyChance * 0.5;
      this._launchFeint(audio, p, followHeavy);
    } else if (roll < heavyCut) {
      this._launchStrike('heavy', audio, p);
    } else if (roll < strikeCut) {
      this._launchStrike('normal', audio, p);
    } else if (roll < retreatCut && this._canStepSafely(level, -this.facing)) {
      this.stepStartX = this.x;
      this.stepTargetX = this.x - this.facing * 13;
      this.enterState('combat_retreat', 0.20);
      this.aiCooldown = p.delay * 0.42;
    } else if (this.archetype === 'sentry' || this.archetype === 'duellist') {
      // Baiting guard stance — invites the hero to attack into a parry!
      this.enterState('combat_parry', 0.28);
      this.pendingRiposte = false;
      this.aiCooldown = p.delay * 0.40;
    } else {
      this._launchStrike('normal', audio, p);
    }
  }

  _updateStep(dt, player, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.animT = u;

    // Skilled guards can abort an early advance into a reactive parry if hero swings!
    if (this.state === 'combat_advance' && this.skill >= 3 && u < 0.45) {
      const p = this._phaseParams();
      if (this._tryReactiveParry(player, p)) return;
    }

    const nx = this.stepStartX + (this.stepTargetX - this.stepStartX) * u;
    this._moveX(nx - this.x, level);
    if (u >= 1) {
      // Rookies drop guard slightly after advancing; trained guards (skill >= 2) keep blade up
      if (this.state === 'combat_advance' && this.skill <= 1) {
        this.recoveryTimer = Math.max(this.recoveryTimer, 0.16);
      }
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateFeint(dt, player, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'combat_feint';
    this.animT = u;

    if (u >= 1) {
      this.strikeTelegraph = 0;
      const p = this._phaseParams();
      const dist = Math.abs(player.x - this.x);
      if (this.pendingFeintFollowup && this._canSeePlayer(player, level) && dist <= 46) {
        this.facing = player.x >= this.x ? 1 : -1;
        const kind = this.feintFollowupHeavy && this._canStepSafely(level, this.facing, 10) ? 'heavy' : 'normal';
        this._launchStrike(kind, audio, p);
        return;
      }
      this.pendingFeintFollowup = false;
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateParry(dt, player, level, audio) {
    this.stateTimer += dt;
    this.anim = 'combat_parry';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);

    // Fire crisp counter-riposte right after parrying the player's blade!
    if (this.pendingRiposte && this.stateTimer >= 0.06) {
      const p = this._phaseParams();
      if (this._canSeePlayer(player, level) && Math.abs(player.x - this.x) <= 46) {
        this.facing = player.x >= this.x ? 1 : -1;
        // In Zins Phase 2/3, occasionally mix a delayed heavy thrust into a counter-clash!
        const heavyMix = this.archetype === 'boss' && this.bossPhase >= 2 &&
          Math.random() < (this.bossPhase === 3 ? 0.38 : 0.25) &&
          this._canStepSafely(level, this.facing, 10);
        this._launchStrike(heavyMix ? 'heavy' : 'riposte', audio, p);
        return;
      }
      this.pendingRiposte = false;
    }

    if (this.stateTimer >= this.stateDur) {
      this.pendingRiposte = false;
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateRecover(dt) {
    this.stateTimer += dt;
    this.anim = 'combat_recover';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);
    if (this.stateTimer >= this.stateDur) {
      this.enterState('combat_idle', 0.2);
    }
  }

  _updateStrike(dt, player, level, audio) {
    this.stateTimer += dt;
    const u = Math.min(1, this.stateTimer / this.stateDur);
    this.anim = 'combat_strike';
    this.animT = u;

    // Advancing lunge slides forward smoothly during late windup into active frames
    if (this.strikeLungeDist > 0 && u >= this.strikeWindupFrac * 0.55 && u <= this.strikeActiveEndFrac) {
      const span = Math.max(0.01, this.strikeActiveEndFrac - this.strikeWindupFrac * 0.55);
      const frac = Math.min(1, (u - this.strikeWindupFrac * 0.55) / span);
      const targetMoved = this.strikeLungeDist * frac;
      const step = targetMoved - this.strikeLungeMoved;
      if (step > 0 && this._canStepSafely(level, this.facing, step + 6)) {
        const distNow = Math.abs(player.x - this.x);
        const clamped = Math.max(0, Math.min(step, distNow - 22));
        if (clamped > 0) {
          this._moveX(this.facing * clamped, level);
          this.strikeLungeMoved += clamped;
        }
      }
    }

    // Distinct swing audio as the lunge launches right after windup telegraph
    if (!this.strikeSwingPlayed && u >= this.strikeWindupFrac - 0.03) {
      this.strikeSwingPlayed = true;
      audio.play('strike');
    }

    if (!this.strikeHitDone && u >= this.strikeWindupFrac && u <= this.strikeActiveEndFrac) {
      if (this._canSeePlayer(player, level) && Math.abs(player.x - this.x) <= this.strikeReach) {
        this.strikeHitDone = true;
        const isHeavy = this.strikeKind === 'heavy';
        const bossHeavyDmg = (this.archetype === 'boss' && this.bossPhase >= 2 && isHeavy) ? 2 : 1;
        const res = player.receiveEnemyStrike(this, level, audio, { heavy: isHeavy, kind: this.strikeKind, damage: bossHeavyDmg });
        if (res === 'parried') {
          this.playerTurtleCount++;
          const p = this._phaseParams();
          // Open for a clean riposte! (Only recoil backward onto safe floor — never commit pit-suicide from a parry!)
          this.vulnerableTimer = Math.max(0.60, 0.86 - this.skill * 0.04);
          if (this._canStepSafely(level, -this.facing, 10)) {
            this._moveX(-this.facing * 6, level);
          }
          this.aiCooldown = Math.max(0.45, p.delay + 0.16);
          this.enterState('combat_recover', 0.34);
          return;
        } else if (res === 'hit') {
          this.playerTurtleCount = 0;
        }
      }
    }

    if (u >= 1) {
      const p = this._phaseParams();
      if (!this.strikeHitDone) {
        // Whiffed strike -> visible punishable recovery state!
        const whiffDur = this.strikeKind === 'heavy' ? 0.34 : Math.max(0.18, p.strikeRecovery);
        this.recoveryTimer = Math.max(this.recoveryTimer, whiffDur + 0.06);
        this.enterState('combat_recover', whiffDur);
        return;
      }

      // Connected strike: guard keeps composure (no self-inflicted recovery vulnerability!)
      const dist = Math.abs(player.x - this.x);
      if (player.alive && dist <= 38 && Math.random() < p.followUpChance * 0.65) {
        this.aiCooldown = Math.max(0.14, p.delay * 0.42);
        this.enterState('combat_idle', 0.16);
      } else if (Math.random() < p.retreatAfterStrike && this._canStepSafely(level, -this.facing)) {
        this.stepStartX = this.x;
        this.stepTargetX = this.x - this.facing * 12;
        this.enterState('combat_retreat', 0.20);
        this.aiCooldown = p.delay * 0.45;
      } else {
        this.enterState('combat_idle', 0.2);
      }
    }
  }

  _updateHit(dt, player, level, audio) {
    this.stateTimer += dt;
    this.anim = 'combat_hit';
    this.animT = Math.min(1, this.stateTimer / this.stateDur);

    this._moveX(this.vx * dt, level);
    this.vx *= Math.pow(level.ice ? 0.14 : 0.05, dt);

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
      const p = this._phaseParams();
      // If player is mashing strikes, immediately raise guard instead of eating a free hit!
      if (player && player.alive && this.skill >= 2 && (player.consecutiveStrikes || 0) >= 2 &&
          Math.abs(player.x - this.x) <= 46 && Math.random() < 0.88) {
        this.facing = player.x >= this.x ? 1 : -1;
        this.enterState('combat_parry', 0.30);
        this.pendingRiposte = false;
        this.aiCooldown = 0.14;
        return;
      }
      // Skilled guards can retreat to regain spacing after being hit instead of getting stunlocked!
      if (player && player.alive && Math.random() < p.retreatAfterHit && this._canStepSafely(level, -this.facing)) {
        this.stepStartX = this.x;
        this.stepTargetX = this.x - this.facing * 14;
        this.enterState('combat_retreat', 0.18);
        this.aiCooldown = p.delay * 0.45;
      } else {
        this.aiCooldown = Math.min(this.aiCooldown, p.delay * 0.5);
        this.enterState('combat_idle', 0.2);
      }
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
