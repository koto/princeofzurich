// Keyboard + touch input. `held` is polled; `hit` holds edge presses consumed once per tick.
export const held = { left: false, right: false, up: false, down: false, shift: false };
export const hit = new Set();
const MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'space', KeyR: 'r', Escape: 'esc', KeyM: 'm', Enter: 'enter',
};
function setKey(name, down) {
  if (!name) return;
  if (name in held) held[name] = down;
  if (down) hit.add(name);
}
export function initInput(target = window) {
  target.addEventListener('keydown', (e) => {
    const n = MAP[e.code];
    if (n) { e.preventDefault(); if (!e.repeat) setKey(n, true); }
  });
  target.addEventListener('keyup', (e) => { const n = MAP[e.code]; if (n) { e.preventDefault(); setKey(n, false); } });
  target.addEventListener('blur', () => { for (const k in held) held[k] = false; });
  const touch = document.getElementById('touch');
  if (touch && ('ontouchstart' in window || (window.matchMedia && matchMedia('(pointer: coarse)').matches))) {
    touch.style.display = 'flex';
    touch.querySelectorAll('button').forEach((b) => {
      const n = b.dataset.k;
      const on = (e) => { e.preventDefault(); setKey(n, true); b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); setKey(n, false); b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    });
  }
}
export function takeHit(name) { const r = hit.has(name); hit.delete(name); return r; }
export function clearHits() { hit.clear(); }
