// src/game.js
// Top-level game state machine: title, intro cards, gameplay, combat, story interludes,
// 60-minute Swiss railway countdown, localStorage persistence, and URL debug hooks.

import { LEVELS } from './levels/index.js';
import { LevelState, VIEW_W, VIEW_H } from './level.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { renderGame, formatTime } from './render.js';
import {
  INTRO_CARDS, LEVEL_INTROS, INTERLUDE_CARDS, getVictoryCard, TIMEOUT_CARD,
} from './story.js';

const SAVE_KEY = 'princeofzurich_save_v1';
const TOTAL_TIME_SEC = 60 * 60; // 60 minutes

export class Game {
  constructor(canvas, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.audio = audio;

    this.time = 0;
    this.mode = 'title'; // 'title'|'intro'|'playing'|'paused'|'dead'|'interlude'|'victory'|'timeout'
    this.levelIndex = 0;
    this.timeRemaining = TOTAL_TIME_SEC;
    this.playerMaxHp = 3;

    this.level = null;
    this.player = null;
    this.enemies = [];

    this.introIndex = 0;
    this.activeCard = null;
    this.titleSelection = 0;
    this.savedGame = this._loadSave();

    this.bannerText = '';
    this.bannerTimer = 0;
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.flashColor = '#ffffff';
    this.deathReason = '';
    this.warned5m = false;
    this.warned1m = false;
    this.lastHintRoom = -1;

    // Parse URL debug flags: ?level=N and ?god=1
    this.godMode = false;
    this._applyUrlParams();
  }

  _applyUrlParams() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('god') === '1' || params.get('god') === 'true') {
      this.godMode = true;
    }
    const lvlParam = params.get('level');
    if (lvlParam !== null) {
      const n = parseInt(lvlParam, 10);
      if (Number.isFinite(n)) {
        // Support 1..5 as Level 1..5, and 0 as Level 1
        const idx = n >= 1 && n <= LEVELS.length ? n - 1 : Math.max(0, Math.min(LEVELS.length - 1, n));
        this.startLevel(idx, false);
        return;
      }
    }
    this.audio.playMusic('title');
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.levelIndex === 'number' && data.levelIndex >= 0 && data.levelIndex < LEVELS.length &&
          typeof data.timeRemaining === 'number' && data.timeRemaining > 0) {
        return data;
      }
    } catch (_) {}
    return null;
  }

  _writeSave() {
    try {
      const data = {
        levelIndex: this.levelIndex,
        timeRemaining: Math.max(1, Math.floor(this.timeRemaining)),
        maxHp: this.playerMaxHp,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.savedGame = data;
    } catch (_) {}
  }

  _clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      this.savedGame = null;
    } catch (_) {}
  }

  showBanner(text, duration = 3.5) {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  flash(color = '#ffffff', dur = 0.22) {
    this.flashColor = color;
    this.flashTimer = dur;
  }

  shake(dur = 0.25) {
    this.shakeTimer = Math.max(this.shakeTimer, dur);
  }

  startNewGame() {
    this.timeRemaining = TOTAL_TIME_SEC;
    this.playerMaxHp = 3;
    this.warned5m = false;
    this.warned1m = false;
    this.introIndex = 0;
    this.activeCard = INTRO_CARDS[0];
    this.mode = 'intro';
    this.audio.play('ui');
  }

  continueGame() {
    if (!this.savedGame) {
      this.startNewGame();
      return;
    }
    this.timeRemaining = this.savedGame.timeRemaining;
    this.playerMaxHp = this.savedGame.maxHp || 3;
    this.warned5m = this.timeRemaining <= 300;
    this.warned1m = this.timeRemaining <= 60;
    this.audio.play('ui');
    this.startLevel(this.savedGame.levelIndex, true);
  }

  startLevel(index, saveProgress = true) {
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    const def = LEVELS[this.levelIndex];
    this.level = new LevelState(def);

    this.player = new Player(def.start, this.playerMaxHp);
    this.player.godMode = this.godMode;
    this.player.onDamage = (amt, reason) => {
      this.shake(0.28);
      this.flash('#ff2233', 0.16);
      if (reason === 'debris') this.showBanner('FALLING DEBRIS! -1 HEALTH', 2.2);
    };
    this.player.onDeath = (reason) => {
      this.deathReason = reason || 'PRINZ HAS FALLEN';
      this.mode = 'dead';
      this.shake(0.35);
      this.audio.play('death');
      this.audio.playMusic('death');
    };
    this.player.onExitLevel = () => {
      this._completeLevel();
    };
    this.player.onEvent = (ev, payload) => {
      this._handleGameEvent(ev, payload);
    };

    // Instantiate room enemies
    this.enemies = [];
    for (const [roomKey, rdef] of Object.entries(def.rooms)) {
      const rid = Number(roomKey);
      if (rdef.enemies) {
        for (const edef of rdef.enemies) {
          this.enemies.push(new Enemy(rid, edef));
        }
      }
    }

    this.mode = 'playing';
    this.lastHintRoom = -1;
    this.audio.setPaused(false);
    if (saveProgress) this._writeSave();

    const info = LEVEL_INTROS[this.levelIndex] || { title: def.name };
    const minsLeft = Math.ceil(this.timeRemaining / 60);
    this.showBanner(`${info.title}  —  ${minsLeft} MIN LEFT`, 4.2);
    this.audio.playMusic(`level${this.levelIndex}`);
  }

  _completeLevel() {
    this.playerMaxHp = this.player.maxHp;
    if (this.levelIndex >= LEVELS.length - 1) {
      // Beat Level 5 — Victory!
      this.activeCard = getVictoryCard(this.timeRemaining);
      this.mode = 'victory';
      this._clearSave();
      this.audio.setPaused(false);
      this.audio.playMusic('victory');
      return;
    }
    this.activeCard = INTERLUDE_CARDS[this.levelIndex];
    this.mode = 'interlude';
    this.audio.setPaused(true);
    // Save next level progress immediately
    const nextIdx = this.levelIndex + 1;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        levelIndex: nextIdx,
        timeRemaining: Math.max(1, Math.floor(this.timeRemaining)),
        maxHp: this.playerMaxHp,
      }));
      this.savedGame = this._loadSave();
    } catch (_) {}
  }

  _handleGameEvent(ev, payload) {
    switch (ev) {
      case 'pickupSword':
        this.showBanner('GUILD SABRE ACQUIRED! Ready to fence.', 3.2);
        this.flash('#f2d06b', 0.18);
        break;
      case 'pickupElixir':
        this.showBanner('ALPINE TONIC — +1 HEALTH', 2.2);
        break;
      case 'pickupLargeElixir':
        this.showBanner('RESERVE ELIXIR — MAX HEALTH +1 & FULL HEAL!', 3.0);
        this.flash('#ffd859', 0.22);
        break;
      case 'pickupPoison':
        this.showBanner('TAINTED COOLANT — POISON! -1 HEALTH', 2.8);
        break;
      case 'exitOpened':
        this.showBanner('EXIT DOOR UNLOCKED!', 2.8);
        break;
      case 'gateOpened':
        if (!this.bannerTimer) this.showBanner('VAULT GRATE RAISED', 1.6);
        break;
      case 'gateClosed':
        if (!payload?.silent) {
          this.showBanner('GATE SLAMMED SHUT!', 2.2);
          this.shake(0.18);
        }
        break;
      case 'mirrorBroken':
        this.flash('#8cecff', 0.35);
        this.shake(0.28);
        this.showBanner('QUANTUM SCANNER SHATTERED — THE DEEPFAKE ESCAPED!', 4.0);
        // Spawn a transient escaping Deepfake phantom leaping out of the mirror
        this.enemies.push(new Enemy(this.player.roomId, {
          col: payload.col,
          row: payload.row,
          type: 'deepfake',
          facing: 1,
          scripted: 'mirror_dash',
          name: 'The Deepfake',
        }));
        break;
      case 'deepfakePain':
        this.showBanner('STRIKING THE DEEPFAKE HURTS YOU TOO! Press DOWN to sheathe.', 4.0);
        break;
      case 'deepfakeSheathed':
        this.showBanner('The Deepfake lowered its blade. Walk into it to merge!', 3.8);
        break;
      case 'deepfakeMerged':
        this.flash('#a8f4ff', 0.45);
        this.showBanner('MERGED WITH DEEPFAKE — FULL HEAL & MAX HEALTH +1!', 4.0);
        break;
      case 'deepfakeTaunt':
        this.showBanner(payload, 3.6);
        break;
      case 'combatStart':
        if (payload) {
          if (payload.type === 'zins') {
            this.audio.playMusic('duel');
            this.showBanner('FINAL DUEL: DR. VIKTOR ZINS — PARRY (UP) THEN STRIKE (SHIFT)!', 4.2);
          } else if ((payload.type === 'elite' || payload.type === 'deepfake') && payload.swordDrawn) {
            this.audio.playMusic('duel');
          }
        }
        break;
      case 'roomChange': {
        const rm = this.level.getRoom(payload);
        if (rm && rm.hint && this.lastHintRoom !== payload) {
          this.lastHintRoom = payload;
          this.showBanner(rm.hint, 3.8);
        }
        break;
      }
    }
  }

  update(dt) {
    this.time += dt;
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);

    // Global unlock & mute toggle
    if (this.input.anyPressed) {
      this.audio.unlock();
    }
    if (this.input.mutePressed) {
      const m = this.audio.toggleMute();
      if (this.mode === 'playing') {
        this.showBanner(m ? 'AUDIO MUTED' : 'AUDIO UNMUTED', 1.6);
      }
    }

    switch (this.mode) {
      case 'title': this._updateTitle(); break;
      case 'intro': this._updateIntro(); break;
      case 'interlude': this._updateInterlude(); break;
      case 'victory':
      case 'timeout':
        this._updateEndCard();
        break;
      case 'paused': this._updatePaused(); break;
      case 'dead': this._updateDead(dt); break;
      case 'playing': this._updatePlaying(dt); break;
    }

    this.input.endFrame(dt);
  }

  _updateTitle() {
    const count = this.savedGame ? 2 : 1;
    if (this.input.upPressed || this.input.downPressed) {
      this.titleSelection = (this.titleSelection + 1) % count;
      this.audio.play('ui');
    }
    if (this.input.enterPressed || this.input.spacePressed) {
      if (this.savedGame && this.titleSelection === 0) {
        this.continueGame();
      } else {
        this.startNewGame();
      }
    }
  }

  _updateIntro() {
    if (this.input.enterPressed || this.input.spacePressed) {
      this.audio.play('ui');
      this.introIndex++;
      if (this.introIndex >= INTRO_CARDS.length) {
        this.startLevel(0, true);
      } else {
        this.activeCard = INTRO_CARDS[this.introIndex];
      }
    } else if (this.input.escPressed) {
      this.startLevel(0, true);
    }
  }

  _updateInterlude() {
    if (this.input.enterPressed || this.input.spacePressed) {
      this.audio.play('ui');
      this.startLevel(this.levelIndex + 1, true);
    }
  }

  _updateEndCard() {
    if (this.input.enterPressed || this.input.spacePressed) {
      this.audio.play('ui');
      this.mode = 'title';
      this.titleSelection = 0;
      this.savedGame = this._loadSave();
      this.audio.playMusic('title');
    }
  }

  _updatePaused() {
    if (this.input.escPressed) {
      this.mode = 'playing';
      this.audio.setPaused(false);
      this.audio.play('ui');
    } else if (this.input.restartPressed) {
      this.audio.setPaused(false);
      this.startLevel(this.levelIndex, false);
    } else if (this.input.enterPressed) {
      this.mode = 'title';
      this.savedGame = this._loadSave();
      this.audio.setPaused(false);
      this.audio.playMusic('title');
    }
  }

  _updateDead(dt) {
    // Clock keeps running even on death!
    this._tickCountdown(dt);
    if (this.mode === 'timeout') return;

    // Keep animating death slump & particles
    this.player.update(dt, this.time, this.input, this.level, this.enemies, this.audio);
    this.level.update(dt, this.time, [this.player, ...this.enemies], this.audio, (e, p) => this._handleGameEvent(e, p));

    if (this.input.restartPressed || this.input.spacePressed || this.input.enterPressed) {
      this.startLevel(this.levelIndex, false);
    }
  }

  _tickCountdown(dt) {
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (!this.warned5m && this.timeRemaining <= 300) {
      this.warned5m = true;
      this.showBanner('5 MINUTES TO MIDNIGHT — HURRY!', 4.5);
    }
    if (!this.warned1m && this.timeRemaining <= 60) {
      this.warned1m = true;
      this.showBanner('1 MINUTE TO MIDNIGHT — FINAL SECONDS!', 5.0);
    }
    if (this.timeRemaining <= 0) {
      this.activeCard = TIMEOUT_CARD;
      this.mode = 'timeout';
      this.audio.play('death');
      this.audio.playMusic('death');
    }
  }

  _updatePlaying(dt) {
    if (this.input.escPressed) {
      this.mode = 'paused';
      this.audio.setPaused(true);
      this.audio.play('ui');
      return;
    }
    if (this.input.restartPressed) {
      this.startLevel(this.levelIndex, false);
      return;
    }
    if (this.input.spacePressed) {
      const m = Math.floor(this.timeRemaining / 60);
      const s = Math.floor(this.timeRemaining % 60);
      this.showBanner(`${m} MIN ${String(s).padStart(2, '0')} SEC LEFT UNTIL MIDNIGHT`, 3.0);
      this.audio.play('ui');
    }

    this._tickCountdown(dt);
    if (this.mode !== 'playing') return;

    // Show initial room hint once if first room has one and intro banner faded
    const curRoom = this.level.getRoom(this.player.roomId);
    if (curRoom && curRoom.hint && this.lastHintRoom === -1 && this.bannerTimer <= 0) {
      this.lastHintRoom = curRoom.id;
      this.showBanner(curRoom.hint, 4.0);
    }

    // Update player
    this.player.update(dt, this.time, this.input, this.level, this.enemies, this.audio);

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(dt, this.time, this.player, this.level, this.audio, (ev, p) => this._handleGameEvent(ev, p));
    }

    // Revert duel music back to level track once the duel foe in this room is defeated/sheathed/left
    if (this.audio.currentTrack === 'duel') {
      const activeDuelFoe = this.enemies.some((e) =>
        e.alive && !e.nonCombat && e.swordDrawn &&
        e.roomId === this.player.roomId &&
        (e.type === 'zins' || e.type === 'elite' || e.type === 'deepfake')
      );
      if (!activeDuelFoe) {
        this.audio.playMusic(`level${this.levelIndex}`);
      }
    }

    // Update level traps, loose floors, plates, gates, debris, particles
    this.level.update(
      dt,
      this.time,
      [this.player, ...this.enemies],
      this.audio,
      (ev, p) => this._handleGameEvent(ev, p)
    );
  }

  render() {
    renderGame(this.ctx, this);
  }
}
