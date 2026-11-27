// src/main.js
// Bootstrapper: integer/letterboxed canvas scaling at 384x216, fixed-step animation loop.

import { VIEW_W, VIEW_H } from './level.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const intScale = Math.floor(Math.min(vw / VIEW_W, vh / VIEW_H));
  let w, h;
  if (intScale >= 1) {
    // True integer scaling for razor-sharp pixel art & bitmap typography
    w = VIEW_W * intScale;
    h = VIEW_H * intScale;
  } else {
    const aspect = VIEW_W / VIEW_H;
    if (vw / vh > aspect) {
      h = vh;
      w = Math.floor(h * aspect);
    } else {
      w = vw;
      h = Math.floor(w / aspect);
    }
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const input = new Input();
const audio = new AudioEngine();
const game = new Game(canvas, input, audio);

// Expose handle for debugging / automated verification
window.__POZ__ = game;

// Clicking canvas on title/story screens advances cleanly
canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (game.mode === 'title' || game.mode === 'intro' || game.mode === 'interlude' ||
      game.mode === 'victory' || game.mode === 'timeout' || game.mode === 'dead') {
    input.injectPress('Enter');
    setTimeout(() => input.injectRelease('Enter'), 50);
  }
});

const FIXED_DT = 1 / 60;
let lastTs = performance.now();
let accumulator = 0;

function loop(ts) {
  const rawDt = (ts - lastTs) / 1000;
  lastTs = ts;
  // Clamp dt to prevent tunneling/spiral after tab backgrounding
  const frameDt = Math.min(0.05, Math.max(0, rawDt));
  accumulator += frameDt;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 4) {
    game.update(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }
  game.render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
