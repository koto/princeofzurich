import { W, H } from './level.js';
import { Game } from './game.js';
import { held, takeHit, clearHits, initInput } from './input.js';
import * as A from './audio.js';
import { renderPlay, renderCard, renderTitle, renderEnd } from './render.js';
import l1 from './levels/l1.js'; import l2 from './levels/l2.js'; import l3 from './levels/l3.js';
import l4 from './levels/l4.js'; import l5 from './levels/l5.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
ctx.imageSmoothingEnabled = false;

const q = new URLSearchParams(location.search);
const io = {
  held, took: takeHit,
  sfx: (n) => A.sfx(n), music: (n) => A.playMusic(n), jingle: () => A.jingle(),
  duck: (d) => A.setMusicDuck(d),
  toggleMute: () => A.toggleMute(),
};
const game = new Game([l1, l2, l3, l4, l5], io);
game.god = q.get('god') === '1'; game.godOn = game.god;
if (q.has('level')) { const n = Math.max(0, Math.min(4, parseInt(q.get('level'), 10) - 1 || 0)); game.debugStart(n); }
window.__game = game;

initInput(window);
let unlocked = false;
const unlock = () => { if (unlocked) return; unlocked = true; A.initAudio(); game.track = ''; };
['keydown', 'pointerdown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

function resize() {
  const s = Math.max(1, Math.min(window.innerWidth / W, window.innerHeight / H));
  const k = s >= 2 ? Math.floor(s) : s;
  canvas.style.width = Math.floor(W * k) + 'px'; canvas.style.height = Math.floor(H * k) + 'px';
}
window.addEventListener('resize', resize); resize();

function draw() {
  ctx.imageSmoothingEnabled = false;
  switch (game.mode) {
    case 'title': renderTitle(ctx, game); break;
    case 'cards': renderCard(ctx, game); break;
    case 'end': renderEnd(ctx, game); break;
    default: renderPlay(ctx, game);
  }
}
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { game.update(); clearHits(); acc -= 1000 / 60; }
  try { draw(); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
