// src/main.js
// Bootstrapper: 2x native canvas (768x432) for logical 384x216 world, crisp scaling, fixed-step loop.

import { VIEW_W, VIEW_H } from './level.js';
import { RENDER_SCALE } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';

const RENDER_W = VIEW_W * RENDER_SCALE;
const RENDER_H = VIEW_H * RENDER_SCALE;

const canvas = document.getElementById('game-canvas');
canvas.width = RENDER_W;
canvas.height = RENDER_H;

function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  let w, h, exactPixel = false;

  if (vw >= RENDER_W && vh >= RENDER_H && Number.isInteger(dpr)) {
    // Prefer exact integer physical-pixel scaling of the 768x432 canvas
    const physScale = Math.floor(Math.min((vw * dpr) / RENDER_W, (vh * dpr) / RENDER_H));
    if (physScale >= 1) {
      w = Math.round((RENDER_W * physScale) / dpr);
      h = Math.round((RENDER_H * physScale) / dpr);
      exactPixel = true;
    }
  }

  if (!exactPixel) {
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
  canvas.style.imageRendering = exactPixel ? 'pixelated' : 'auto';
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
