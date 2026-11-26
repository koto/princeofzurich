// WebAudio synth for effects (warmly low-passed with click-free envelopes); music comes from music.js.
import { Music } from './music.js';

let ctx = null, master = null, sfxBus = null, music = null, muted = false, ducked = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
    sfxBus = ctx.createBiquadFilter(); sfxBus.type = 'lowpass'; sfxBus.frequency.value = 4000; sfxBus.connect(master);
    music = new Music(ctx, master); music.setVolume(ducked ? 0.16 : 0.5);
  } catch (e) { ctx = null; }
}
export function toggleMute() {
  muted = !muted;
  if (master && ctx) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(muted ? 0 : 0.6, t, 0.02);
  }
  return muted;
}
export function isMuted() { return muted; }
export function setMusicDuck(d) {
  if (ducked === !!d) return;
  ducked = !!d;
  if (music) music.setVolume(ducked ? 0.16 : 0.5);
}

function tone(freq, dur, type = 'triangle', vol = 0.14, slide = 0, delay = 0) {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime + delay, atk = Math.min(0.004, dur * 0.2);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.14, hp = 800, delay = 0) {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime + delay, atk = Math.min(0.004, dur * 0.2);
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
}

const FX = {
  step: () => noise(0.04, 0.05, 1500),
  jump: () => tone(300, 0.12, 'triangle', 0.1, 200),
  land: () => noise(0.08, 0.1, 300),
  bump: () => noise(0.1, 0.12, 200),
  grab: () => { noise(0.05, 0.08, 1000); tone(180, 0.08, 'triangle', 0.1); },
  clang: () => { tone(1250, 0.18, 'triangle', 0.09, -200); tone(1870, 0.14, 'sine', 0.06, -300); noise(0.05, 0.11, 2600); },
  swish: () => noise(0.1, 0.07, 2200),
  draw: () => { noise(0.18, 0.06, 2600); tone(2100, 0.1, 'triangle', 0.04, -600); },
  hit: () => { noise(0.1, 0.16, 400); tone(160, 0.15, 'sawtooth', 0.09, -80); },
  hurt: () => { tone(220, 0.25, 'sawtooth', 0.1, -120); noise(0.1, 0.09, 300); },
  die: () => { tone(260, 0.55, 'sawtooth', 0.12, -200); noise(0.28, 0.09, 200); },
  gdie: () => { tone(200, 0.38, 'sawtooth', 0.09, -150); },
  plate: () => { tone(115, 0.1, 'triangle', 0.12); noise(0.06, 0.07, 400); },
  gate: () => { tone(90, 0.45, 'sawtooth', 0.05, 35); noise(0.35, 0.05, 280); },
  gateclose: () => { noise(0.18, 0.16, 200); tone(70, 0.2, 'triangle', 0.1, -20); },
  door: () => { tone(75, 0.75, 'sawtooth', 0.07, 45); noise(0.55, 0.05, 200); },
  shake: () => noise(0.12, 0.09, 150),
  crash0: () => noise(0.24, 0.13, 120),
  crash1: () => { noise(0.32, 0.18, 100); tone(70, 0.2, 'triangle', 0.1, -30); },
  elixir: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, 0, i * 0.07)); },
  poison: () => { tone(300, 0.38, 'sawtooth', 0.09, -200); },
  item: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.11, 'triangle', 0.08, 0, i * 0.06)); },
  mirror: () => { tone(900, 0.55, 'sine', 0.09, 600); tone(1350, 0.55, 'sine', 0.05, -400); },
  slicer: () => { noise(0.05, 0.07, 1800); tone(190, 0.06, 'triangle', 0.06, -90); },
  tick: () => tone(980, 0.035, 'triangle', 0.05),
  warn: () => { tone(880, 0.12, 'triangle', 0.08); tone(880, 0.12, 'triangle', 0.08, 0, 0.2); },
  card: () => tone(660, 0.05, 'triangle', 0.05),
};
export function sfx(name) { if (!ctx || muted) return; const f = FX[name]; if (f) f(); }

export function jingle() {
  if (!ctx || muted) return;
  [[392, 0], [494, 0.2], [587, 0.4]].forEach(([f, d]) => {
    tone(f, 0.35, 'triangle', 0.08, 0, d);
  });
}
export function playMusic(name) { if (music) { try { music.play(name); } catch (e) { /* ignore */ } } }
export function stopMusic() { if (music) { try { music.stop(); } catch (e) { /* ignore */ } } }
