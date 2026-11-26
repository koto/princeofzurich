// Headless simulation helpers: drive the real Game update loop with scripted input.
import { Game } from '../src/game.js';
import l1 from '../src/levels/l1.js'; import l2 from '../src/levels/l2.js'; import l3 from '../src/levels/l3.js';
import l4 from '../src/levels/l4.js'; import l5 from '../src/levels/l5.js';
export const defs = [l1, l2, l3, l4, l5];
export function make(level = 0, god = false) {
  const held = { left: false, right: false, up: false, down: false, shift: false };
  const hits = new Set();
  const io = { held, took: (n) => { const r = hits.has(n); hits.delete(n); return r; }, sfx() {}, music() {}, jingle() {}, duck() {}, toggleMute: () => false };
  const g = new Game(defs, io); g.god = god; g.debugStart(level);
  const api = {
    g, held, hits,
    set(keys) { for (const k in held) held[k] = false; for (const k of keys.split(' ').filter(Boolean)) { if (k in held) { held[k] = true; hits.add(k); } } },
    tick(n = 1) { for (let i = 0; i < n; i++) { g.update(); hits.clear(); } },
    hold(keys, n) { api.set(keys); api.tick(n); },
    until(keys, cond, max = 600) { api.set(keys); for (let i = 0; i < max; i++) { if (cond(g.hero, g)) { return true; } api.tick(1); } return false; },
    idle(n = 30) { api.set(''); api.tick(n); },
    waitIdle(max = 120) { api.set(''); for (let i = 0; i < max && g.hero.st !== 'idle'; i++) api.tick(1); },
    pos() { const h = g.hero; return `${h.room} x=${h.x.toFixed(1)} y=${h.y.toFixed(1)} rw=${h.rw} st=${h.st} hp=${h.hp}${h.dead ? ' DEAD(' + h.cause + ')' : ''}`; },
  };
  return api;
}
