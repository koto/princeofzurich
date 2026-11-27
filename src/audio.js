// src/audio.js
// Procedural WebAudio sound effects + optional dynamic Music class hook.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.paused = false;
    this.music = null;
    this._MusicClass = null;
    this.currentTrack = null;
    this._musicReady = false;
    this._initMusicHook();
  }

  async _initMusicHook() {
    try {
      const mod = await import('./music.js');
      const MusicClass = mod.Music || mod.default;
      if (typeof MusicClass === 'function') {
        this._MusicClass = MusicClass;
        this._ensureMusicInstance();
      }
    } catch (_) {
      // Optional src/music.js not present; silent fallback.
    }
  }

  _ensureMusicInstance() {
    if (this.music || !this._MusicClass || !this.ctx) return;
    try {
      this.music = new this._MusicClass(this.ctx);
      this._musicReady = true;
      this._syncMusicVolume();
      if (this.currentTrack && !this.muted) {
        this.music.play?.(this.currentTrack);
      }
    } catch (_) {
      this.music = null;
      this._musicReady = false;
    }
  }

  _syncMusicVolume() {
    if (!this.music || typeof this.music.setVolume !== 'function') return;
    const targetVol = this.muted ? 0 : (this.paused ? 0.18 : 0.7);
    try {
      this.music.setVolume(targetVol);
    } catch (_) {}
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch (_) {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this._ensureMusicInstance();
    if (this.music && this.currentTrack && !this.muted) {
      try {
        this._syncMusicVolume();
        this.music.play?.(this.currentTrack);
      } catch (_) {}
    }
  }

  setPaused(paused) {
    this.paused = !!paused;
    this._syncMusicVolume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.music) {
      try {
        if (typeof this.music.setVolume === 'function') {
          this._syncMusicVolume();
          if (!this.muted && this.currentTrack) {
            this.music.play?.(this.currentTrack);
          }
        } else if (typeof this.music.setMuted === 'function') {
          this.music.setMuted(this.muted);
        } else if (this.muted && typeof this.music.stop === 'function') {
          this.music.stop();
        } else if (!this.muted && this.currentTrack) {
          this.music.play?.(this.currentTrack);
        }
      } catch (_) {}
    }
    return this.muted;
  }

  playMusic(trackName) {
    if (this.currentTrack === trackName) return;
    this.currentTrack = trackName;
    if (this.music) {
      try {
        this._syncMusicVolume();
        if (!this.muted) {
          this.music.play?.(trackName);
        }
      } catch (_) {}
    }
  }

  _tone(freq, dur, type = 'triangle', vol = 0.12, endFreq = null, delay = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + Math.min(0.01, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _noise(dur, vol = 0.08, cutoff = 1200, delay = 0) {
    if (this.muted || !this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 1.2;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  play(name) {
    if (this.muted) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx) return;

    switch (name) {
      case 'step': {
        const v = 0.9 + Math.random() * 0.22;
        const g = 0.85 + Math.random() * 0.3;
        this._tone(110 * v, 0.045, 'triangle', 0.055 * g, 65 * v);
        this._noise(0.03, 0.028 * g, 780 * v);
        break;
      }
      case 'iceStep': {
        const v = 0.92 + Math.random() * 0.18;
        const g = 0.85 + Math.random() * 0.3;
        this._tone(520 * v, 0.035, 'sine', 0.038 * g, 340 * v);
        this._noise(0.04, 0.032 * g, 3200 * v);
        break;
      }
      case 'skid':
        this._noise(0.14, 0.07, 1800);
        this._tone(210, 0.12, 'sawtooth', 0.03, 95);
        break;
      case 'jump':
        this._tone(160, 0.09, 'sine', 0.07, 290);
        break;
      case 'grab':
        this._tone(140, 0.06, 'triangle', 0.09, 95);
        this._noise(0.04, 0.05, 650);
        break;
      case 'land':
        this._tone(95, 0.08, 'triangle', 0.11, 42);
        this._noise(0.05, 0.06, 400);
        break;
      case 'hardLand':
        this._tone(75, 0.18, 'sawtooth', 0.14, 30);
        this._noise(0.14, 0.12, 320);
        break;
      case 'looseShake':
        this._tone(180, 0.05, 'square', 0.04, 140);
        break;
      case 'looseBreak':
        this._noise(0.18, 0.11, 520);
        this._tone(120, 0.16, 'triangle', 0.09, 48);
        break;
      case 'plate':
        this._tone(310, 0.06, 'square', 0.07, 220);
        this._tone(460, 0.07, 'triangle', 0.07, 420, 0.04);
        break;
      case 'gate':
        this._tone(135, 0.18, 'sawtooth', 0.07, 90);
        this._noise(0.16, 0.06, 900);
        break;
      case 'gateSlam':
        this._tone(90, 0.22, 'sawtooth', 0.13, 35);
        this._noise(0.18, 0.12, 500);
        break;
      case 'gateTick':
        this._tone(680, 0.03, 'square', 0.045, 520);
        break;
      case 'spike':
        this._noise(0.05, 0.06, 3800);
        this._tone(920, 0.05, 'triangle', 0.055, 1480);
        break;
      case 'slicer':
        this._noise(0.08, 0.06, 3600);
        this._tone(780, 0.07, 'sawtooth', 0.045, 220);
        break;
      case 'swordDraw':
        this._tone(620, 0.14, 'sawtooth', 0.05, 1340);
        this._noise(0.10, 0.04, 4200);
        break;
      case 'parry':
        this._tone(680, 0.06, 'triangle', 0.055, 1020);
        this._noise(0.05, 0.04, 3400);
        break;
      case 'telegraph':
        this._tone(860, 0.055, 'sine', 0.04, 1280);
        break;
      case 'riposteTelegraph':
        this._tone(1120, 0.055, 'triangle', 0.05, 1620);
        break;
      case 'heavyTelegraph':
        this._tone(620, 0.075, 'sawtooth', 0.045, 940);
        break;
      case 'feint':
        this._tone(980, 0.035, 'sine', 0.03, 820);
        break;
      case 'bossPhase':
        this._tone(330, 0.14, 'triangle', 0.09, 440, 0);
        this._tone(494, 0.20, 'triangle', 0.10, 660, 0.10);
        break;
      case 'strike':
        this._noise(0.08, 0.07, 2400);
        this._tone(420, 0.07, 'triangle', 0.06, 180);
        break;
      case 'clang':
        this._tone(1180, 0.16, 'square', 0.08, 920);
        this._tone(1790, 0.22, 'triangle', 0.09, 1520);
        this._noise(0.07, 0.08, 4800);
        break;
      case 'hurt':
        this._tone(190, 0.18, 'sawtooth', 0.14, 70);
        this._noise(0.12, 0.09, 600);
        break;
      case 'death':
        this._tone(240, 0.22, 'sawtooth', 0.12, 160, 0);
        this._tone(180, 0.25, 'sawtooth', 0.12, 110, 0.18);
        this._tone(130, 0.40, 'triangle', 0.13, 62, 0.38);
        break;
      case 'elixir':
        this._tone(440, 0.10, 'sine', 0.09, 554, 0);
        this._tone(554, 0.10, 'sine', 0.09, 659, 0.09);
        this._tone(659, 0.20, 'sine', 0.10, 880, 0.18);
        break;
      case 'poison':
        this._tone(320, 0.14, 'sawtooth', 0.09, 210, 0);
        this._tone(210, 0.24, 'sawtooth', 0.09, 110, 0.12);
        break;
      case 'mirror':
        this._noise(0.24, 0.12, 4600);
        this._tone(1320, 0.18, 'sine', 0.09, 440, 0);
        this._tone(980, 0.22, 'triangle', 0.08, 1660, 0.06);
        break;
      case 'merge':
        this._tone(330, 0.35, 'sine', 0.09, 440, 0);
        this._tone(440, 0.38, 'sine', 0.09, 660, 0.1);
        this._tone(660, 0.45, 'triangle', 0.10, 880, 0.2);
        break;
      case 'exit':
        this._tone(392, 0.14, 'triangle', 0.10, 392, 0);
        this._tone(494, 0.14, 'triangle', 0.10, 494, 0.12);
        this._tone(587, 0.16, 'triangle', 0.11, 587, 0.24);
        this._tone(784, 0.32, 'triangle', 0.12, 784, 0.36);
        break;
      case 'ui':
        this._tone(520, 0.05, 'triangle', 0.06, 620);
        break;
      case 'wind':
        this._noise(0.55, 0.065, 620);
        this._tone(165, 0.50, 'sine', 0.03, 240);
        break;
    }
  }
}
