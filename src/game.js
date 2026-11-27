// src/game.js
// Top-level game state machine: title, level select, intro cards, gameplay, combat,
// story interludes, multi-card endings, 60-minute Swiss railway countdown,
// localStorage persistence, and URL debug hooks (?level=1..10, ?god=1).

import { LEVELS } from './levels/index.js';
import { LevelState } from './level.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { renderGame } from './render.js';
import {
  INTRO_CARDS, LEVEL_INTROS, LEVEL_MUSIC_TRACKS, INTERLUDE_CARDS,
  getVictoryCards, TIMEOUT_CARDS, DEATH_LINES, CAUSE_DEATH_LINES,
  TIMER_MILESTONES, CLOCK_CHECK_LINES, EVENT_BANNERS, ZINS_BARKS, DEEPFAKE_BARKS,
} from './story.js';

const SAVE_KEY = 'princeofzurich_save_v3';
const TOTAL_TIME_SEC = 60 * 60; // 60 minutes

export class Game {
  constructor(canvas, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.audio = audio;

    this.time = 0;
    this.mode = 'title'; // 'title'|'level_select'|'intro'|'playing'|'paused'|'dead'|'interlude'|'victory'|'timeout'
    this.levelIndex = 0;
    this.timeRemaining = TOTAL_TIME_SEC;
    this.playerMaxHp = 3;

    this.level = null;
    this.player = null;
    this.enemies = [];

    this.introIndex = 0;
    this.cardQueue = [];
    this.cardIndex = 0;
    this.activeCard = null;
    this.titleSelection = 0;
    this.levelSelectIndex = 0;
    this.savedGame = this._loadSave();

    this.bannerText = '';
    this.bannerTimer = 0;
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.flashColor = '#ffffff';
    this.deathReason = '';
    this.deathCount = 0;
    this.clockCheckCount = 0;
    this.firedMilestones = new Set();
    this.lastHintRoom = -1;

    // Parse URL debug flags: ?level=1..10 and ?god=1
    this.godMode = false;
    this._applyUrlParams();
  }

  _levelMusicTrack(idx = this.levelIndex) {
    return LEVEL_MUSIC_TRACKS[idx] || 'level0';
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
        // Support 1..10 as Level 1..10, and 0 as Level 1
        const idx = n >= 1 && n <= LEVELS.length ? n - 1 : Math.max(0, Math.min(LEVELS.length - 1, n));
        this.playerMaxHp = 3 + Math.min(3, Math.floor(idx / 3));
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

  _writeSave(levelIdx = this.levelIndex) {
    try {
      const data = {
        version: 3,
        levelIndex: levelIdx,
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

  _syncFiredMilestones() {
    this.firedMilestones.clear();
    for (const m of TIMER_MILESTONES) {
      if (this.timeRemaining <= m.sec) {
        this.firedMilestones.add(m.sec);
      }
    }
  }

  _pickDeathLine(reason) {
    // Use cause-specific override on the first hit or alternating with the 20-line pool
    const key = reason === 'bottomless' ? 'fall' : reason;
    const idx = this.deathCount++;
    if (key && CAUSE_DEATH_LINES[key] && (idx % 2 === 0)) {
      return CAUSE_DEATH_LINES[key];
    }
    return DEATH_LINES[idx % DEATH_LINES.length];
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
    this._syncFiredMilestones();
    this.introIndex = 0;
    this.cardQueue = INTRO_CARDS;
    this.cardIndex = 0;
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
    this._syncFiredMilestones();
    this.audio.play('ui');
    this.startLevel(this.savedGame.levelIndex, true);
  }

  openLevelSelect() {
    this.levelSelectIndex = this.savedGame ? this.savedGame.levelIndex : 0;
    this.mode = 'level_select';
    this.audio.play('ui');
  }

  startSelectedLevel(idx) {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, idx));
    this.timeRemaining = TOTAL_TIME_SEC;
    this.playerMaxHp = 3 + Math.min(3, Math.floor(clamped / 3));
    this._syncFiredMilestones();
    this.audio.play('ui');
    this.startLevel(clamped, false);
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
      if (reason === 'debris') this.showBanner(EVENT_BANNERS.debrisHit, 2.4);
    };
    this.player.onDeath = (reason) => {
      this.deathReason = this._pickDeathLine(reason);
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
    if (saveProgress) this._writeSave(this.levelIndex);

    const info = LEVEL_INTROS[this.levelIndex] || { title: def.name, subtitle: def.subtitle || '' };
    this.showBanner(`${info.title} - ${info.subtitle}`, 4.2);
    this.audio.playMusic(this._levelMusicTrack(this.levelIndex));
  }

  _completeLevel() {
    this.playerMaxHp = this.player.maxHp;
    if (this.levelIndex >= LEVELS.length - 1) {
      // Beat Level 10 — Good Ending sequence!
      this.cardQueue = getVictoryCards(this.timeRemaining);
      this.cardIndex = 0;
      this.activeCard = this.cardQueue[0];
      this.mode = 'victory';
      this._clearSave();
      this.audio.setPaused(false);
      this.audio.playMusic('victory');
      return;
    }
    this.cardQueue = [INTERLUDE_CARDS[this.levelIndex]];
    this.cardIndex = 0;
    this.activeCard = this.cardQueue[0];
    this.mode = 'interlude';
    this.audio.setPaused(false);
    this.audio.playMusic('victory');
    // Save next level progress immediately
    this._writeSave(this.levelIndex + 1);
  }

  _handleGameEvent(ev, payload) {
    switch (ev) {
      case 'pickupSword':
        this.showBanner(EVENT_BANNERS.pickupSword, 3.6);
        this.flash('#f2d06b', 0.18);
        break;
      case 'pickupElixir':
        this.showBanner(EVENT_BANNERS.pickupElixir, 2.8);
        break;
      case 'pickupLargeElixir':
        this.showBanner(EVENT_BANNERS.pickupLargeElixir, 3.2);
        this.flash('#ffd859', 0.22);
        break;
      case 'pickupPoison':
        this.showBanner(EVENT_BANNERS.pickupPoison, 3.0);
        break;
      case 'exitOpened':
        this.showBanner(EVENT_BANNERS.exitOpened, 2.8);
        break;
      case 'gateOpened':
        if (!this.bannerTimer) this.showBanner(EVENT_BANNERS.gateOpened, 1.8);
        break;
      case 'gateClosed':
        if (!payload?.silent) {
          this.showBanner(EVENT_BANNERS.gateClosed, 2.2);
          this.shake(0.18);
        }
        break;
      case 'mirrorBroken':
        this.flash('#8cecff', 0.35);
        this.shake(0.28);
        this.showBanner(EVENT_BANNERS.mirrorBroken, 4.2);
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
        this.showBanner(
          this.player.hp <= 2 ? EVENT_BANNERS.deepfakePain : DEEPFAKE_BARKS.mirrorHit,
          4.0
        );
        break;
      case 'deepfakeSheathed':
        this.showBanner(EVENT_BANNERS.deepfakeSheathed, 3.8);
        break;
      case 'deepfakeMerged':
        this.flash('#a8f4ff', 0.45);
        this.showBanner(EVENT_BANNERS.deepfakeMerged, 4.2);
        break;
      case 'deepfakeTaunt':
        this.showBanner(payload, 3.8);
        break;
      case 'bossPhase':
        if (payload?.phase === 2) {
          this.audio.play('bossPhase');
          this.flash('#f0c451', 0.22);
          this.showBanner(ZINS_BARKS.midDuel, 3.4);
        } else if (payload?.phase === 3) {
          this.audio.play('bossPhase');
          this.flash('#ff5959', 0.26);
          this.shake(0.22);
          this.showBanner('DR. ZINS (PHASE III): "MIDNIGHT IS A SCHEDULED WINDOW."', 3.4);
        }
        break;
      case 'enemyDefeated':
        if (payload?.type === 'zins') {
          this.showBanner(ZINS_BARKS.defeated, 4.0);
        }
        break;
      case 'combatStart':
        if (payload) {
          if (payload.type === 'zins') {
            this.audio.playMusic('duel');
            if (!payload.barked) {
              payload.barked = true;
              this.showBanner(ZINS_BARKS.opening, 4.2);
            }
          } else {
            if ((payload.type === 'elite' || payload.type === 'deepfake' || payload.skill >= 3) && payload.swordDrawn) {
              this.audio.playMusic('duel');
            }
            if (payload.bark && !payload.barked) {
              payload.barked = true;
              this.showBanner(`${payload.name.toUpperCase()}: ${payload.bark}`, 3.8);
            }
          }
        }
        break;
      case 'roomChange': {
        const rm = this.level.getRoom(payload);
        if (rm && rm.hint && this.lastHintRoom !== payload) {
          this.lastHintRoom = payload;
          this.showBanner(rm.hint, 4.0);
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
        this.showBanner(m ? EVENT_BANNERS.audioMuted : EVENT_BANNERS.audioRestored, 2.0);
      }
    }

    switch (this.mode) {
      case 'title': this._updateTitle(); break;
      case 'level_select': this._updateLevelSelect(); break;
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

  _titleMenuCount() {
    // [CONTINUE], NEW GAME / START GAME, LEVEL SELECT
    return this.savedGame ? 3 : 2;
  }

  _updateTitle() {
    const count = this._titleMenuCount();
    if (this.input.upPressed) {
      this.titleSelection = (this.titleSelection + count - 1) % count;
      this.audio.play('ui');
    } else if (this.input.downPressed) {
      this.titleSelection = (this.titleSelection + 1) % count;
      this.audio.play('ui');
    }
    if (this.input.enterPressed || this.input.spacePressed) {
      if (this.savedGame) {
        if (this.titleSelection === 0) this.continueGame();
        else if (this.titleSelection === 1) this.startNewGame();
        else this.openLevelSelect();
      } else {
        if (this.titleSelection === 0) this.startNewGame();
        else this.openLevelSelect();
      }
    }
  }

  _updateLevelSelect() {
    const n = LEVELS.length;
    if (this.input.upPressed) {
      this.levelSelectIndex = (this.levelSelectIndex + n - 1) % n;
      this.audio.play('ui');
    } else if (this.input.downPressed) {
      this.levelSelectIndex = (this.levelSelectIndex + 1) % n;
      this.audio.play('ui');
    } else if (this.input.leftPressed) {
      this.levelSelectIndex = (this.levelSelectIndex + n - 5) % n;
      this.audio.play('ui');
    } else if (this.input.rightPressed) {
      this.levelSelectIndex = (this.levelSelectIndex + 5) % n;
      this.audio.play('ui');
    } else if (this.input.enterPressed || this.input.spacePressed) {
      this.startSelectedLevel(this.levelSelectIndex);
    } else if (this.input.escPressed) {
      this.mode = 'title';
      this.audio.play('ui');
    }
  }

  _updateIntro() {
    if (this.input.enterPressed || this.input.spacePressed) {
      this.audio.play('ui');
      this.introIndex++;
      this.cardIndex = this.introIndex;
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
      this.cardIndex++;
      if (this.cardIndex < this.cardQueue.length) {
        this.activeCard = this.cardQueue[this.cardIndex];
        if (this.activeCard.music) {
          this.audio.playMusic(this.activeCard.music);
        }
      } else {
        this.mode = 'title';
        this.titleSelection = 0;
        this.savedGame = this._loadSave();
        this.audio.playMusic('title');
      }
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
    for (const m of TIMER_MILESTONES) {
      if (!this.firedMilestones.has(m.sec) && this.timeRemaining <= m.sec) {
        this.firedMilestones.add(m.sec);
        this.showBanner(m.text, 4.5);
        break;
      }
    }
    if (this.timeRemaining <= 0) {
      this.cardQueue = TIMEOUT_CARDS;
      this.cardIndex = 0;
      this.activeCard = TIMEOUT_CARDS[0];
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
    if (this.input.timePressed) {
      const m = Math.floor(this.timeRemaining / 60);
      const s = Math.floor(this.timeRemaining % 60);
      const fmt = CLOCK_CHECK_LINES[this.clockCheckCount++ % CLOCK_CHECK_LINES.length];
      this.showBanner(fmt(String(m), String(s).padStart(2, '0')), 3.2);
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
      enemy.update(dt, this.time, this.player, this.level, this.audio, (ev, p) => this._handleGameEvent(ev, p), this.enemies);
    }

    // Revert duel music back to level track once the duel foe in this room is defeated/sheathed/left
    if (this.audio.currentTrack === 'duel') {
      const activeDuelFoe = this.enemies.some((e) =>
        e.alive && !e.nonCombat && e.swordDrawn &&
        e.roomId === this.player.roomId &&
        (e.type === 'zins' || e.type === 'elite' || e.type === 'deepfake' || e.skill >= 3)
      );
      if (!activeDuelFoe) {
        this.audio.playMusic(this._levelMusicTrack(this.levelIndex));
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
