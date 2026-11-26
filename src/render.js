// All drawing. Internal resolution 384x216.
import { COLS, ROWS, TW, TH, W, H, fy, supportsCh, ceilingCh, isGateCh, isPlateCh, slicerOpen } from './level.js';
import { drawText, textWidth, wrap } from './font.js';
import { drawFigure, poseFor, styleFor, STYLES } from './figure.js';
import { drawBackdrop, drawTitleBackdrop } from './backdrops.js';

const PAL = [
  { wall: '#6b5a3e', light: '#8c7852', dark: '#43372a', top: '#b09a68', face: '#5a4a33', acc: '#d4af37' },
  { wall: '#6d7168', light: '#8b9086', dark: '#3f423d', top: '#a2a69a', face: '#555952', acc: '#e0b81a' },
  { wall: '#2c4670', light: '#4670a6', dark: '#16243d', top: '#7aa6d8', face: '#243b5c', acc: '#5fe0ff' },
  { wall: '#7fb4cf', light: '#cdeaf6', dark: '#4e7a95', top: '#eaf7fc', face: '#79aac4', acc: '#ffffff' },
  { wall: '#2b2b44', light: '#4a4a70', dark: '#14142a', top: '#9a9ac4', face: '#3a3a5c', acc: '#ffd86b' },
];
const hash = (a, b, c) => { let h = 2166136261; for (const ch of a + ':' + b + ':' + c) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function floorTile(ctx, p, x, y, shake) {
  const o = shake ? Math.round(Math.sin(shake * 1.7) * 1.2) : 0;
  ctx.fillStyle = p.face; ctx.fillRect(x + o, y + 46, TW, 4);
  ctx.fillStyle = p.top; ctx.fillRect(x + o, y + 44, TW, 2);
  ctx.fillStyle = p.dark; ctx.fillRect(x + o + TW - 1, y + 44, 1, 6); ctx.fillRect(x + o, y + 49, TW, 1);
}
function wallTile(ctx, p, x, y, seed) {
  ctx.fillStyle = p.wall; ctx.fillRect(x, y, TW, TH);
  ctx.fillStyle = p.dark;
  for (let r = 0; r < 5; r++) { const yy = y + r * 10; ctx.fillRect(x, yy + 9, TW, 1); const off = (r + seed) % 2 ? 0 : 8; for (let k = off; k < TW; k += 16) ctx.fillRect(x + k, yy, 1, 9); }
  ctx.fillStyle = p.light; ctx.fillRect(x, y, TW, 1); ctx.fillRect(x, y, 1, TH);
  ctx.fillStyle = p.face; ctx.fillRect(x, y + 44, TW, 6);
}

function drawFixture(ctx, idx, x, y, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.08 + x * 0.2);
  if (idx === 0) {
    // Paradeplatz vault brass wall sconce
    ctx.fillStyle = '#4a3a1e'; ctx.fillRect(x - 3, y + 6, 6, 3);
    ctx.fillStyle = '#d4af37'; ctx.fillRect(x - 2, y + 2, 4, 5);
    ctx.fillStyle = '#fff0b8'; ctx.fillRect(x - 1, y + 3, 2, 3);
    ctx.fillStyle = `rgba(255,220,130,${0.08 + 0.04 * pulse})`; ctx.beginPath(); ctx.arc(x, y + 4, 18, 0, 7); ctx.fill();
  } else if (idx === 1) {
    // Gotthard Réduit caged industrial bunker bulkhead light
    ctx.fillStyle = '#2c2f2a'; ctx.fillRect(x - 4, y + 2, 8, 6);
    ctx.fillStyle = '#f2d06b'; ctx.fillRect(x - 3, y + 3, 6, 4);
    ctx.fillStyle = '#2c2f2a'; ctx.fillRect(x - 3, y + 4.5, 6, 1); ctx.fillRect(x - 0.5, y + 3, 1, 4);
    ctx.fillStyle = `rgba(245,215,120,${0.07 + 0.03 * pulse})`; ctx.beginPath(); ctx.arc(x, y + 5, 16, 0, 7); ctx.fill();
  } else if (idx === 4) {
    // Sphinx Observatory alpine safety beacon post (grounded on floor at y + 44)
    ctx.fillStyle = '#26283c'; ctx.fillRect(x - 1, y + 32, 2, 12);
    ctx.fillStyle = '#4a4e6e'; ctx.fillRect(x - 2, y + 42, 4, 2);
    ctx.fillStyle = pulse > 0.4 ? '#ffd86b' : '#b86820'; ctx.fillRect(x - 1.5, y + 29, 3, 3);
    ctx.fillStyle = `rgba(255,210,100,${0.06 + 0.08 * pulse})`; ctx.beginPath(); ctx.arc(x, y + 30, 14, 0, 7); ctx.fill();
  }
}

function drawTiles(ctx, g, room) {
  const L = g.level, p = PAL[L.idx], R = L.rooms[room], t = L.t;
  if (R.u) {
    const U = L.rooms[R.u];
    for (let c = 0; c < COLS; c++) {
      const uch = U.t[3][c], ux = c * TW;
      if (supportsCh(uch) || uch === '#') {
        ctx.fillStyle = p.face; ctx.fillRect(ux, 0, TW, 4);
        ctx.fillStyle = p.dark; ctx.fillRect(ux, 4, TW, 1);
        if (c > 0 && !ceilingCh(U.t[3][c - 1])) { ctx.fillStyle = p.acc; ctx.fillRect(ux, 1, 2, 3); }
        if (c < COLS - 1 && !ceilingCh(U.t[3][c + 1])) { ctx.fillStyle = p.acc; ctx.fillRect(ux + TW - 2, 1, 2, 3); }
      }
    }
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = R.t[r][c], x = c * TW, y = r * TH, hs = hash(room, c, r);
    // decor behind
    if ((L.idx === 0 || L.idx === 1) && ch === '_' && hs % 11 === 0 && r > 0) drawFixture(ctx, L.idx, x + 16, y + 12, t);
    if (L.idx === 4 && ch === '_' && hs % 13 === 0) drawFixture(ctx, L.idx, x + 16, y, t);
    if (L.idx === 2 && ch === '_' && hs % 9 === 0) { ctx.fillStyle = p.acc; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.05 + c); ctx.fillRect(x + 6, y + 14, 20, 2); ctx.globalAlpha = 1; }
    if (L.idx === 1 && ch === '_' && hs % 6 === 0) { for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#222' : p.acc; ctx.fillRect(x + 4 + k * 6, y + 44, 6, 2); } }
    if (ch === '#') wallTile(ctx, p, x, y, hs % 2);
    else if (ch === '_' || ch === '^' || ch === 'S' || ch === 'D' || ch === 'M' || isPlateCh(ch) || isGateCh(ch)) floorTile(ctx, p, x, y, 0);
    else if (ch === 'L') {
      const n = L.loose.get(room + ':' + c + ':' + r);
      const o = n ? Math.round(Math.sin(n * 1.9) * 1.4) : 0;
      // Distinct loose slab: sunken 1px, dark vertical seam gaps on both edges, jagged cracks, dust specks
      ctx.fillStyle = p.face; ctx.fillRect(x + 1 + o, y + 46, TW - 2, 4);
      ctx.fillStyle = p.top; ctx.fillRect(x + 1 + o, y + 45, TW - 2, 1);
      ctx.fillStyle = '#090910';
      ctx.fillRect(x + o, y + 44, 1, 6); ctx.fillRect(x + TW - 1 + o, y + 44, 1, 6);
      ctx.fillRect(x + 9 + o, y + 45, 1, 2); ctx.fillRect(x + 10 + o, y + 47, 2, 1); ctx.fillRect(x + 12 + o, y + 48, 1, 2);
      ctx.fillRect(x + 21 + o, y + 45, 1, 3); ctx.fillRect(x + 22 + o, y + 47, 2, 2);
      const dustPhase = (t + (hs % 80)) % 95;
      if (dustPhase < 22) {
        ctx.fillStyle = p.top; ctx.globalAlpha = 1 - dustPhase / 22;
        ctx.fillRect(x + 11 + (hs % 10), y + 50 + Math.floor(dustPhase * 0.45), 1, 1);
        ctx.globalAlpha = 1;
      }
    }
    if (ch !== '#' && supportsCh(ch) && r < 3) {
      if (!ceilingCh(L.tile(room, c - 1, r))) {
        ctx.fillStyle = p.acc; ctx.fillRect(x, y + 44, 3, 2); ctx.fillRect(x, y + 46, 2, 3);
      }
      if (!ceilingCh(L.tile(room, c + 1, r))) {
        ctx.fillStyle = p.acc; ctx.fillRect(x + TW - 3, y + 44, 3, 2); ctx.fillRect(x + TW - 2, y + 46, 2, 3);
      }
    }
    if (ch === '^') {
      for (let k = 0; k < 4; k++) { const sx = x + 2 + k * 7; ctx.fillStyle = '#cfd3da'; ctx.beginPath(); ctx.moveTo(sx, y + 44); ctx.lineTo(sx + 3.5, y + 33); ctx.lineTo(sx + 7, y + 44); ctx.fill(); ctx.fillStyle = '#7a7f8c'; ctx.beginPath(); ctx.moveTo(sx + 3.5, y + 33); ctx.lineTo(sx + 7, y + 44); ctx.lineTo(sx + 4.5, y + 44); ctx.fill(); }
    } else if (ch === 'S') {
      const o = slicerOpen(t, c), j = 4 + (1 - o) * 18;
      ctx.fillStyle = '#2a2d35'; ctx.fillRect(x + 4, y, 24, j); ctx.fillRect(x + 4, y + 44 - j, 24, j);
      ctx.fillStyle = '#c9ced8';
      for (let k = 0; k < 5; k++) { const sx = x + 5 + k * 5; ctx.beginPath(); ctx.moveTo(sx, y + j); ctx.lineTo(sx + 2, y + j + 5); ctx.lineTo(sx + 4, y + j); ctx.fill(); ctx.beginPath(); ctx.moveTo(sx, y + 44 - j); ctx.lineTo(sx + 2, y + 44 - j - 5); ctx.lineTo(sx + 4, y + 44 - j); ctx.fill(); }
      if (o < 0.5) { ctx.fillStyle = 'rgba(255,60,40,0.5)'; ctx.fillRect(x + 6, y + j + 5, 20, Math.max(0, 44 - 2 * j - 10)); }
    } else if (isPlateCh(ch)) {
      const down = [...L.down].some((k) => k.startsWith(room + ':' + c + ':' + r + ':'));
      ctx.fillStyle = p.dark; ctx.fillRect(x + 8, y + 42, 16, down ? 2 : 3); ctx.fillStyle = down ? '#6c6' : '#c66'; ctx.fillRect(x + 9, y + (down ? 43 : 42), 14, 1);
    } else if (isGateCh(ch)) {
      const gt = L.gates[ch], h = Math.round(44 * (1 - gt.open));
      ctx.fillStyle = p.dark; ctx.fillRect(x, y, TW, 3);
      if (h > 0) { ctx.fillStyle = '#8b8f99'; for (let k = 0; k < 5; k++) ctx.fillRect(x + 3 + k * 6, y + 3, 2, Math.max(0, h - 3)); ctx.fillRect(x + 3, y + h - 6, 26, 2); ctx.fillStyle = '#c9ced8'; for (let k = 0; k < 5; k++) ctx.fillRect(x + 3 + k * 6, y + 3, 1, Math.max(0, h - 3)); }
    } else if (ch === 'D') {
      // Arched portal frame with ascending steps inside and open/locked beacon
      ctx.fillStyle = p.dark; ctx.fillRect(x + 2, y + 4, 28, 40);
      ctx.fillStyle = p.light; ctx.fillRect(x + 3, y + 5, 26, 2); ctx.fillRect(x + 3, y + 5, 2, 39); ctx.fillRect(x + 27, y + 5, 2, 39);
      ctx.fillStyle = '#06070d'; ctx.fillRect(x + 6, y + 8, 20, 36);
      const o = L.doorOpen, dh = Math.round(36 * (1 - o));
      // ascending stone steps visible as the door rises
      for (let st = 0; st < 5; st++) {
        const sy = y + 38 - st * 5, sw = 20 - st * 2;
        ctx.fillStyle = st % 2 ? '#1a1e2e' : '#262b40'; ctx.fillRect(x + 6 + st, sy, sw, 5);
        ctx.fillStyle = '#3d4566'; ctx.fillRect(x + 6 + st, sy, sw, 1);
      }
      if (o > 0.35) {
        const gGlow = ctx.createLinearGradient(x + 6, y + 8, x + 6, y + 44);
        gGlow.addColorStop(0, `rgba(255,230,150,${0.32 * o})`);
        gGlow.addColorStop(1, `rgba(255,200,110,${0.08 * o})`);
        ctx.fillStyle = gGlow; ctx.fillRect(x + 6, y + 8, 20, 36);
      }
      if (dh > 0) {
        ctx.fillStyle = p.wall; ctx.fillRect(x + 6, y + 8, 20, dh);
        ctx.fillStyle = p.acc; ctx.fillRect(x + 6, y + 8 + dh - 2, 20, 2);
        ctx.fillStyle = p.dark; for (let k = 0; k < dh; k += 6) ctx.fillRect(x + 6, y + 8 + k, 20, 1);
      }
      // status indicator dot in arch lintel (red locked, bright green/gold open)
      ctx.fillStyle = o > 0.85 ? '#6ee67a' : (L.doorUnlocked ? '#ffd86b' : '#c44');
      ctx.fillRect(x + 14, y + 5, 4, 2);
    } else if (ch === 'M') {
      ctx.fillStyle = '#10182a'; ctx.fillRect(x + 7, y + 8, 18, 36);
      const gr = ctx.createLinearGradient(x + 7, y + 8, x + 25, y + 44); gr.addColorStop(0, '#9fe8f5'); gr.addColorStop(0.5, '#3a6fa0'); gr.addColorStop(1, '#bfefff');
      ctx.fillStyle = gr; ctx.fillRect(x + 9, y + 10, 14, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; const sh = (t * 0.6) % 50; ctx.fillRect(x + 9, y + 10 + (sh % 30), 14, 2);
    }
  }
  for (const rb of L.rubble) if (rb.room === room) { ctx.fillStyle = p.dark; ctx.fillRect(rb.x - 6, fy(rb.r) - 2, 5, 2); ctx.fillStyle = p.face; ctx.fillRect(rb.x - 1, fy(rb.r) - 3, 4, 3); ctx.fillRect(rb.x + 4, fy(rb.r) - 1, 3, 1); }
}

function drawItem(ctx, it, t) {
  const x = it.c * TW + 16, y = fy(it.r), bob = Math.sin(t * 0.08) * 1;
  if (it.t === 'w') {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 9, y - 4, 18, 4);
    ctx.strokeStyle = '#e8eef6'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 8, y - 6); ctx.lineTo(x + 9, y - 6); ctx.stroke();
    ctx.fillStyle = '#d4af37'; ctx.fillRect(x - 10, y - 8, 2, 5); ctx.fillRect(x - 14, y - 6, 5, 1.5);
    ctx.fillStyle = '#ffffff44'; ctx.fillRect(x - 6 + ((t >> 1) % 16), y - 9, 1, 4);
    return;
  }
  const big = it.t === 'L', col = it.t === 'p' ? '#58b8ff' : '#e0343c', s = big ? 1.4 : 1;
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(x, y - 6 * s + bob, 7 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#d8e4ee'; ctx.fillRect(x - 1.5 * s, y - 12 * s + bob, 3 * s, 4 * s);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 4 * s + bob, 4.2 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff8'; ctx.fillRect(x - 2 * s, y - 6 * s + bob, 1.5, 2);
  if (it.t === 'p') { ctx.fillStyle = '#9ff'; ctx.fillRect(x + 2, y - 12 + bob - (t % 12) / 4, 1, 1); }
}

function actorDraw(ctx, a, t) {
  const pose = poseFor(a), st = styleFor(a);
  if (a.flash > 0 && (a.flash >> 1) % 2 && !a.dead) pose.alpha *= 0.55;
  if (a.kind === 'deepfake') pose.alpha *= 0.55 + 0.25 * Math.sin(t * 0.2);
  drawFigure(ctx, pose, a.x, a.y, a.face, st, a.armed);
}

function pips(ctx, x, y, n, max, col, dir) {
  for (let i = 0; i < max; i++) {
    const px = dir > 0 ? x + i * 10 : x - i * 10 - 8;
    ctx.beginPath(); ctx.moveTo(px, y + 7); ctx.lineTo(px + 4, y); ctx.lineTo(px + 8, y + 7); ctx.closePath();
    if (i < n) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); }
  }
}

export function drawClock(ctx, cx, cy, rad, secLeft, t) {
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy, rad + 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4f4ee'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
  ctx.strokeStyle = '#111';
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0; ctx.lineWidth = big ? Math.max(1.4, rad / 8) : 0.7; const r0 = rad - (big ? rad * 0.25 : rad * 0.12); ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); ctx.lineTo(cx + Math.sin(a) * (rad - 1), cy - Math.cos(a) * (rad - 1)); ctx.stroke(); }
  const elapsed = Math.max(0, 3600 - secLeft);
  const hand = (ang, len, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - Math.sin(ang) * len * 0.15, cy + Math.cos(ang) * len * 0.15); ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); ctx.stroke(); };
  hand(((11 + elapsed / 3600) / 12) * Math.PI * 2, rad * 0.52, Math.max(1.5, rad / 6), '#111');
  hand((((elapsed / 60) % 60) / 60) * Math.PI * 2, rad * 0.8, Math.max(1.2, rad / 9), '#111');
  const sbbSec = Math.min(60, (elapsed % 60) * 60 / 58.5), sa = (sbbSec / 60) * Math.PI * 2;
  hand(sa, rad * 0.85, 0.8, '#d11');
  ctx.fillStyle = '#d11'; ctx.beginPath(); ctx.arc(cx + Math.sin(sa) * rad * 0.7, cy - Math.cos(sa) * rad * 0.7, Math.max(1.5, rad / 7), 0, 7); ctx.fill();
}

export function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function panel(ctx, x, y, w, h) { ctx.fillStyle = 'rgba(8,8,16,0.88)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }

function drawSwordIcon(ctx, x, y) {
  ctx.fillStyle = '#dfe6ee'; ctx.fillRect(x + 4, y + 3, 8, 1); ctx.fillRect(x + 11, y + 2, 2, 1);
  ctx.fillStyle = '#d4af37'; ctx.fillRect(x + 3, y + 1, 1, 5); ctx.fillRect(x, y + 3, 3, 1);
}

function drawHUD(ctx, g) {
  const L = g.level, hero = g.hero;
  ctx.fillStyle = '#07070c'; ctx.fillRect(0, 200, W, 16);
  ctx.fillStyle = '#d4af37'; ctx.fillRect(0, 200, W, 1);
  pips(ctx, 6, 204, hero.hp, hero.maxhp, '#e0343c', 1);
  const afterPips = 6 + hero.maxhp * 10 + 2;
  if (hero.hasSword) drawSwordIcon(ctx, afterPips, 204);
  if (g.godOn) drawText(ctx, 'GOD', afterPips + (hero.hasSword ? 17 : 2), 205, '#fc4');
  // Compact permanent timer at right edge
  const tCol = g.timeLeft <= 300 ? '#e0343c' : '#d4af37';
  drawText(ctx, fmtTime(g.timeLeft), W - 6, 205, tCol, 1, 'right');
  const en = g.currentEnemy;
  if (en && !en.dead && en.kind !== 'deepfake') pips(ctx, W - 40, 204, en.hp, en.maxhp, en.boss ? '#c8a0ff' : '#8aa0b8', -1);
  else if (en && en.kind === 'deepfake') drawText(ctx, 'DEEPFAKE', W - 42, 205, '#7fe', 1, 'right');
  drawText(ctx, 'L' + (L.idx + 1) + ' ' + L.def.name, W / 2, 205, '#8a8aa0', 1, 'center');
  if (g.clockT > 0) {
    panel(ctx, 128, 36, 128, 54);
    drawClock(ctx, 156, 63, 20, g.timeLeft, g.frame);
    drawText(ctx, fmtTime(g.timeLeft), 222, 56, '#fff', 2, 'center');
    drawText(ctx, 'TIME LEFT', 222, 74, '#d4af37', 1, 'center');
  }
  if (g.notice && g.notice.t > 0) {
    const lines = wrap(g.notice.text, 56), h = lines.length * 9 + 8;
    panel(ctx, 20, 4, W - 40, h);
    lines.forEach((l, i) => drawText(ctx, l, W / 2, 8 + i * 9, '#fff', 1, 'center'));
  }
  if (g.muted) drawText(ctx, 'MUTE', W - 30, 3, '#888');
}

export function renderPlay(ctx, g) {
  const room = g.hero.room, L = g.level;
  drawBackdrop(ctx, L.idx, W, H, g.frame / 60, room);
  drawTiles(ctx, g, room);
  for (const it of L.items) if (!it.taken && it.room === room) drawItem(ctx, it, g.frame);
  if (L.def.celine && L.def.celine.room === room) {
    const cx = L.def.celine.c * TW + 16, cr = L.def.celine.r ?? 3;
    const face = g.hero.x < cx ? -1 : 1;
    drawFigure(ctx, { p: celinePose(g.frame), dy: 0, rot: 0, alpha: 1 }, cx, fy(cr), face, STYLES.celine, false);
  }
  const acts = g.actors.filter((a) => a.room === room);
  acts.sort((a, b) => (a.kind === 'hero') - (b.kind === 'hero'));
  for (const a of acts) actorDraw(ctx, a, g.frame);
  if (g.ghost && g.ghost.room === room) { const gh = g.ghost.actor; ctx.globalAlpha = 0.5; actorDraw(ctx, gh, g.frame); ctx.globalAlpha = 1; }
  // sliced / debris
  ctx.fillStyle = PAL[L.idx].face;
  for (const d of L.debris) if (d.room === room) { ctx.fillRect(Math.round(d.x) - 7, Math.round(d.y) - 5, 14, 5); ctx.fillStyle = PAL[L.idx].top; ctx.fillRect(Math.round(d.x) - 7, Math.round(d.y) - 5, 14, 1); ctx.fillStyle = PAL[L.idx].face; }
  if (g.flashT > 0) { ctx.fillStyle = `rgba(160,240,255,${g.flashT / 40})`; ctx.fillRect(0, 0, W, 200); }
  if (g.hero.dead && g.deadT > 20) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, (g.deadT - 20) / 60)})`; ctx.fillRect(0, 0, W, 200); drawText(ctx, g.deathLine, W / 2, 90, '#fff', 1, 'center'); drawText(ctx, 'PRESS ENTER OR R TO TRY AGAIN', W / 2, 106, '#d4af37', 1, 'center'); }
  drawHUD(ctx, g);
  if (g.mode === 'pause') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); drawText(ctx, 'PAUSED', W / 2, 90, '#fff', 3, 'center'); drawText(ctx, 'ESC TO RESUME  -  M TO MUTE', W / 2, 120, '#d4af37', 1, 'center'); }
}
function celinePose(t) {
  const wave = Math.sin(t * 0.12) * 18;
  return [2, Math.sin(t * 0.06) * 3, 130 + wave, -35 + wave * 0.4, -10, 14, 4, 2, -4, 2, Math.sin(t * 0.08) * 0.3, 0, 20];
}

export function renderCard(ctx, g) {
  const c = g.cards[g.cardI];
  ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);
  drawBackdrop(ctx, Math.min(4, g.cardLevel || 0), W, H, g.frame / 60, 'card');
  ctx.fillStyle = 'rgba(5,5,12,0.82)'; ctx.fillRect(0, 0, W, H);
  const pw = W - 36, px = 18;
  const hsc = textWidth(c.h, 2) > pw - 20 ? 1 : 2;
  const lines = wrap(c.t, 52), h = (hsc === 2 ? 54 : 44) + lines.length * 11;
  const y = Math.floor((H - h) / 2);
  panel(ctx, px, y, pw, h);
  drawText(ctx, c.h, W / 2, y + 10, '#d4af37', hsc, 'center');
  lines.forEach((l, i) => drawText(ctx, l, W / 2, y + (hsc === 2 ? 32 : 24) + i * 11, '#e8e8f0', 1, 'center'));
  const footer = g.cards.length > 1 ? `(${g.cardI + 1}/${g.cards.length})  ENTER NEXT  -  ESC SKIP` : 'PRESS ENTER';
  if (Math.floor(g.frame / 30) % 2 === 0 || g.cards.length > 1) drawText(ctx, footer, W / 2, y + h - 11, '#8a8aa0', 1, 'center');
  if (c.clock) drawClock(ctx, W - 26, 26, 16, g.timeLeft, g.frame);
}

export function renderTitle(ctx, g) {
  drawTitleBackdrop(ctx, W, H, g.frame / 60);
  const gr = ctx.createLinearGradient(0, 14, 0, 96);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.28, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 14, W, 82);
  drawText(ctx, 'PRINCE', W / 2 + 2, 28, '#400', 4, 'center'); drawText(ctx, 'PRINCE', W / 2, 26, '#f1ead2', 4, 'center');
  drawText(ctx, 'OF ZURICH', W / 2 + 2, 58, '#400', 4, 'center'); drawText(ctx, 'OF ZURICH', W / 2, 56, '#e0343c', 4, 'center');
  const items = g.menu;
  items.forEach((m, i) => { const sel = i === g.menuI; const y = 124 + i * 14; if (sel) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(110, y - 3, 164, 13); } drawText(ctx, (sel ? '> ' : '  ') + m.label + (sel ? ' <' : '  '), W / 2, y, sel ? '#ffd86b' : '#cfcfe0', 1, 'center'); });
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 196, W, 20);
  drawText(ctx, 'ARROWS MOVE/JUMP   UP CLIMB   SHIFT HANG/STEP/STRIKE', W / 2, 199, '#b8b8c8', 1, 'center');
  drawText(ctx, 'R RESTART   ESC PAUSE   M MUTE   ENTER SELECT', W / 2, 208, '#8a8aa0', 1, 'center');
}

export function renderEnd(ctx, g) {
  ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);
  drawBackdrop(ctx, 4, W, H, g.frame / 60, 'end');
  ctx.fillStyle = 'rgba(5,5,14,0.55)'; ctx.fillRect(0, 0, W, H);
  drawText(ctx, g.endBad ? 'TOO LATE' : 'VICTORY', W / 2, 34, g.endBad ? '#e0343c' : '#ffd86b', 4, 'center');
  if (!g.endBad) { drawClock(ctx, W / 2, 104, 28, g.timeLeft, g.frame); drawText(ctx, 'TIME LEFT ' + fmtTime(g.timeLeft), W / 2, 146, '#fff', 1, 'center'); }
  drawText(ctx, g.endBad ? 'THE LEDGER BELONGS TO ZINS.' : 'THE LEDGER STAYS SWISS. AND DIVIDED. AS INTENDED.', W / 2, 166, '#c8c8d8', 1, 'center');
  if (Math.floor(g.frame / 30) % 2 === 0) drawText(ctx, 'PRESS ENTER', W / 2, 190, '#8a8aa0', 1, 'center');
}
