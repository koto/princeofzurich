// Skeletal figure renderer: poses are 13-number keyframes interpolated per state.
// [tl, hd, ans, ane, afs, afe, lnh, lnk, lfh, lfk, oy, ox, sw]
//  torso lean, head tilt, near arm shoulder/elbow, far arm shoulder/elbow, near leg hip/knee, far leg hip/knee, offsets, sword angle
const D = Math.PI / 180;
export const POSE = {
  stand: [0, 0, 8, 12, -8, 10, 4, 2, -4, 2, 0, 0, 20],
  turn: [-6, 0, 20, 20, -20, 20, 6, 4, -6, 4, 0, 0, 20],
  R1: [14, 4, -50, -70, 45, -80, 45, 15, -40, 55, 0, 0, 40],
  R2: [14, 4, -10, -70, 10, -70, 5, 70, 0, 5, 0, 0, 40],
  R3: [14, 4, 45, -80, -50, -70, -40, 55, 45, 15, 0, 0, 40],
  R4: [14, 4, 10, -70, -10, -70, 0, 5, 5, 70, 0, 0, 40],
  skid: [-12, -2, 40, 30, -30, 30, 32, 10, -6, 20, 0, 0, 40],
  stepA: [4, 0, 14, 14, -14, 14, 24, 8, -14, 14, 0, 0, 20],
  stepB: [4, 0, -14, 14, 14, 14, -14, 14, 24, 8, 0, 0, 20],
  peek: [22, 8, 60, 20, 40, 20, 6, 4, -4, 4, 0, 0, 20],
  crouch: [22, 6, 30, 30, 10, 30, 80, 135, 70, 125, 0, 0, 20],
  jumpwind: [26, 6, 20, 40, -10, 40, 80, 140, 70, 130, 0, 0, 20],
  jumpup: [-2, -6, 170, -10, 160, -10, 10, 50, -10, 40, 0, 0, 20],
  leap: [12, 0, 60, -60, -50, -60, 70, 90, -35, 70, 0, 0, 40],
  leapRun: [16, 0, -60, -50, 70, -70, 60, 20, -50, 85, 0, 0, 40],
  fall: [-4, 0, 140, -10, 120, -10, 20, 20, -25, 30, 0, 0, 20],
  hang: [-4, -4, 176, 0, 172, 0, 3, 10, -4, 14, 0, 0, 20],
  pull1: [-6, -4, 135, -120, 130, -120, 30, 70, -10, 30, 0, 0, 20],
  pull2: [28, 6, 70, -80, 60, -90, 80, 100, -10, 40, 0, 0, 20],
  bend: [42, 10, 70, 10, 50, 10, 30, 50, -10, 40, 0, 0, 20],
  stagger: [-14, -6, 30, 20, -30, 20, -10, 20, 18, 12, 0, 0, 20],
  fready: [8, 0, 80, -20, -50, 40, 28, 20, -26, 30, 0, 0, 100],
  fadvA: [8, 0, 80, -20, -50, 40, 44, 14, -30, 34, 0, 0, 100],
  fadvB: [8, 0, 80, -20, -50, 40, 14, 22, -14, 24, 0, 0, 100],
  fwind: [-2, 0, 30, -60, -50, 40, 22, 20, -26, 30, 0, 0, 125],
  fthrust: [18, 2, 90, 0, -60, 30, 62, 6, -34, 6, 0, 0, 90],
  fparry: [4, 0, 100, 60, -50, 40, 26, 20, -26, 30, 0, 0, 172],
  fhit: [-22, -8, -20, 10, -40, 20, 20, 20, -22, 40, 0, 0, 50],
  frecoil: [-10, -4, 60, -30, -50, 40, 12, 20, -30, 30, 0, 0, 70],
  drawA: [2, 0, 20, 30, -20, 30, 10, 10, -10, 10, 0, 0, 20],
  lie: [0, 0, 20, 10, -20, 10, 8, 4, -6, 4, 0, 0, 20],
  impale: [-30, -10, 120, 0, 140, 0, 30, 20, -30, 20, 0, 0, 20],
};
const RC = ['R1', 'R2', 'R3', 'R4'];
const ARR = (n) => (typeof n === 'string' ? POSE[n] : n);
export function lerp(a, b, k) { a = ARR(a); b = ARR(b); k = Math.max(0, Math.min(1, k)); return a.map((v, i) => v + (b[i] - v) * k); }
function seq(kf, t) {
  if (t <= kf[0][0]) return ARR(kf[0][1]);
  for (let i = 1; i < kf.length; i++) if (t <= kf[i][0]) return lerp(kf[i - 1][1], kf[i][1], (t - kf[i - 1][0]) / Math.max(1, kf[i][0] - kf[i - 1][0]));
  return ARR(kf[kf.length - 1][1]);
}
function cycle(t, per = 4) { const f = t / per, i = Math.floor(f) % 4; return lerp(RC[i], RC[(i + 1) % 4], f - Math.floor(f)); }

// returns {p: pose array, dy: vertical offset, rot: radians, alpha}
export function poseFor(a) {
  const t = a.t, o = { dy: 0, rot: 0, alpha: 1, lie: false };
  switch (a.st) {
    case 'turn': o.p = seq([[0, 'stand'], [3, 'turn'], [7, 'stand']], t); break;
    case 'runstart': o.p = t < 4 ? lerp('stand', 'R2', t / 4) : cycle(t, 3); break;
    case 'run': o.p = cycle(t + 6, 4); break;
    case 'skid': { const n = a.g.level.def.ice ? 24 : 12; o.p = seq([[0, 'R2'], [3, 'skid'], [n - 4, 'skid'], [n, 'stand']], t); break; }
    case 'rturn': { const ice = a.g.level.def.ice, brk = ice ? 20 : 10, tot = ice ? 24 : 14; o.p = seq([[0, 'R2'], [4, 'skid'], [brk, 'skid'], [tot - 2, 'turn'], [tot, 'stand']], t); break; }
    case 'align': o.p = seq([[0, 'stand'], [Math.max(2, a.n / 2), a.stepPar ? 'stepA' : 'stepB'], [a.n, 'stand']], t); break;
    case 'step': o.p = seq([[0, 'stand'], [5, a.stepPar ? 'stepA' : 'stepB'], [10, 'stand']], t); break;
    case 'peek': o.p = seq([[0, 'stand'], [6, 'peek'], [10, 'peek'], [14, 'stand']], t); break;
    case 'crouch': o.p = seq([[0, 'stand'], [4, 'crouch']], t); break;
    case 'bump': o.p = seq([[0, 'R2'], [3, 'stagger'], [14, 'stand']], t); break;
    case 'bumphead': o.p = seq([[0, 'stand'], [4, 'jumpup'], [8, 'stagger'], [22, 'stand']], t); o.dy = -8 * Math.sin(Math.PI * Math.min(1, t / 8)); break;
    case 'jumpup':
      if (a.climbTarget) { o.p = seq([[0, 'stand'], [3, 'jumpwind'], [8, 'jumpup']], t); o.dy = t > 3 ? -16 * Math.sin(Math.PI / 2 * Math.min(1, (t - 3) / 6)) : 0; }
      else { o.p = seq([[0, 'stand'], [4, 'jumpwind'], [8, 'jumpup'], [20, 'jumpup'], [28, 'stand']], t); o.dy = t > 4 && t < 24 ? -26 * Math.sin(Math.PI * (t - 4) / 20) : 0; }
      break;
    case 'jump': { const u = t / a.n; o.p = seq([[0, 'jumpwind'], [3, a.run ? 'leapRun' : 'leap'], [a.n - 6, a.run ? 'leapRun' : 'leap'], [a.n, 'crouch']], t); o.dy = -4 * a.h * u * (1 - u) * 1.6; break; }
    case 'fall': o.p = POSE.fall; break;
    case 'hang': o.p = POSE.hang; break;
    case 'climb': o.p = seq([[0, 'hang'], [9, 'pull1'], [18, 'pull2'], [26, 'stand']], t); break;
    case 'climbdown': o.p = seq([[0, 'stand'], [8, 'bend'], [14, 'pull2'], [22, 'hang']], t); break;
    case 'land': o.p = seq([[0, 'crouch'], [Math.max(2, a.ln), 'stand']], t); break;
    case 'pickup': o.p = seq([[0, 'stand'], [8, 'bend'], [18, 'bend'], [32, 'stand']], t); break;
    case 'enter': o.p = cycle(t, 6); o.dy = -t * 0.16; o.alpha = Math.max(0, 1 - Math.max(0, t - 12) / 32); break;
    case 'draw': o.p = seq([[0, 'stand'], [8, 'drawA'], [16, 'fready']], t); break;
    case 'sheathe': o.p = seq([[0, 'fready'], [7, 'drawA'], [14, 'stand']], t); break;
    case 'fready': o.p = lerp('fready', 'fadvB', 0.5 + 0.5 * Math.sin(t / 14) * 0.3); break;
    case 'fadv': o.p = seq([[0, 'fadvA'], [4, 'fadvB'], [8, 'fready']], t); break;
    case 'fret': o.p = seq([[0, 'fadvB'], [4, 'fadvA'], [8, 'fready']], t); break;
    case 'fstrike': o.p = a.fast ? seq([[0, 'fready'], [2, 'fwind'], [4, 'fthrust'], [8, 'fthrust'], [12, 'fready']], t) : seq([[0, 'fready'], [4, 'fwind'], [6, 'fthrust'], [10, 'fthrust'], [15, 'fready']], t); break;
    case 'fparry': o.p = seq([[0, 'fready'], [3, 'fparry'], [10, 'fparry'], [14, 'fready']], t); break;
    case 'fhit': o.p = seq([[0, 'fhit'], [7, 'fhit'], [16, 'fready']], t); break;
    case 'frecoil': o.p = seq([[0, 'frecoil'], [a.longRecoil ? 22 : 12, 'fready']], t); break;
    case 'dying': {
      const c = a.cause;
      if (c === 'spikes') { o.p = seq([[0, 'fall'], [8, 'impale']], t); o.dy = -4; }
      else if (c === 'sword') { o.p = seq([[0, 'fhit'], [8, 'lie']], t); o.lie = Math.min(1, t / 20); o.rot = -o.lie * Math.PI / 2; }
      else { o.p = seq([[0, 'fhit'], [6, 'lie']], t); o.lie = Math.min(1, t / 14); o.rot = -o.lie * Math.PI / 2; }
      break;
    }
    default: {
      const br = Math.sin(t * 0.08) * 0.4;
      o.p = POSE.stand.slice();
      o.p[10] = br;
    }
  }
  return o;
}

const seg = (ctx, x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const lim = (x, y, ang, len) => [x + Math.sin(ang * D) * len, y + Math.cos(ang * D) * len];

// Draw an articulated figure with feet at (x,y), facing `face` (+1 right).
export function drawFigure(ctx, pose, x, y, face, st, armed) {
  const p = pose.p; const L = { th: 8, sh: 8, ua: 6, fa: 6, to: 12 };
  // auto-ground: compute lowest foot relative to hip
  const foot = (h, k) => { const [kx, ky] = lim(0, 0, h, L.th); const [fx, fy2] = lim(kx, ky, h - k, L.sh); return fy2; };
  const lowest = Math.max(foot(p[6], p[7]), foot(p[8], p[9]));
  const lieFrac = typeof pose.lie === 'number' ? pose.lie : (pose.lie ? 1 : 0);
  const hipY = -lowest * (1 - lieFrac) - 2.6 * lieFrac;
  ctx.save();
  ctx.globalAlpha = pose.alpha * (st.alpha == null ? 1 : st.alpha);
  ctx.translate(Math.round(x), Math.round(y + pose.dy));
  ctx.scale(face, 1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.translate(p[11], hipY + p[10]);
  if (pose.rot) ctx.rotate(pose.rot);
  const tlr = p[0];
  const [tx, ty] = [Math.sin(tlr * D) * L.to, -Math.cos(tlr * D) * L.to];
  const [sx, sy] = [tx * 0.9, ty * 0.9];
  const leg = (h, k, col, boot, w) => {
    const [kx, ky] = lim(0, 0, h, L.th); const [fx, fy2] = lim(kx, ky, h - k, L.sh);
    seg(ctx, 0, 0, kx, ky, w + 0.5, col); seg(ctx, kx, ky, fx, fy2, w - 0.3, col);
    seg(ctx, fx, fy2, fx + 2.5, fy2, w - 0.2, boot);
  };
  const arm = (s, e, col, w) => {
    const [ex, ey] = lim(sx, sy, s, L.ua); const [hx, hy] = lim(ex, ey, s + e, L.fa);
    seg(ctx, sx, sy, ex, ey, w + 0.2, col); seg(ctx, ex, ey, hx, hy, w - 0.4, col);
    return [hx, hy];
  };
  // far limbs
  arm(p[4], p[5], st.far, 2.3);
  leg(p[8], p[9], st.pantsFar, st.boot, 2.9);
  // courier backpack behind torso (Prinz silhouette)
  if (st.pack) {
    const bx = tx * 0.48 - 3.6, by = ty * 0.48 - 3.2;
    ctx.fillStyle = st.pack; ctx.fillRect(bx, by, 3.4, 6.2);
    ctx.fillStyle = '#d4af37'; ctx.fillRect(bx + 0.6, by + 1.5, 2.2, 0.9);
  }
  // tapered torso jacket/coat
  const nx = -ty / L.to, ny = tx / L.to;
  ctx.fillStyle = st.shirt;
  ctx.beginPath();
  ctx.moveTo(tx + nx * 3.1, ty + ny * 3.1);
  ctx.lineTo(tx - nx * 3.1, ty - ny * 3.1);
  ctx.lineTo(-nx * 2.4, -ny * 2.4);
  ctx.lineTo(nx * 2.4, ny * 2.4);
  ctx.closePath(); ctx.fill();
  seg(ctx, 0, -0.8, tx * 0.1, -0.8 + ty * 0.1, 4.8, st.pants);
  if (st.collar) { ctx.fillStyle = st.collar; ctx.fillRect(tx * 0.85 - 1, ty * 0.85 - 1, 2.4, 2.2); }
  if (st.mark) { ctx.fillStyle = st.mark; ctx.fillRect(tx * 0.55 - 1, ty * 0.55 - 2, 2, 1); ctx.fillRect(tx * 0.55 - 0.5, ty * 0.55 - 3, 1, 3); }
  leg(p[6], p[7], st.pants, st.boot, 3.1);
  // head
  const hang = (tlr + p[1]) * D, hx = tx + Math.sin(hang) * 4.8, hy = ty - Math.cos(hang) * 4.8;
  ctx.fillStyle = st.skin; ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = st.hair; ctx.beginPath(); ctx.arc(hx - 0.6, hy - 0.8, 3.7, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
  if (st.helmet) { ctx.fillStyle = st.helmet; ctx.fillRect(hx - 3.6, hy - 3.8, 7.2, 2.4); }
  ctx.fillStyle = '#111'; ctx.fillRect(hx + 1.2, hy - 0.6, 1, 1);
  // near arm and sword
  const [hnx, hny] = arm(p[2], p[3], st.shirt, 2.7);
  ctx.fillStyle = st.skin; ctx.fillRect(hnx - 1, hny - 1, 2, 2);
  if (armed && st.sword !== false) {
    const [bx, by] = lim(hnx, hny, p[12], 16);
    seg(ctx, hnx, hny, bx, by, 1.4, st.blade || '#dfe6ee');
    const [gx, gy] = lim(hnx, hny, p[12], 2.5), n = (p[12] + 90) * D;
    seg(ctx, gx - Math.sin(n) * 2.2, gy - Math.cos(n) * 2.2, gx + Math.sin(n) * 2.2, gy + Math.cos(n) * 2.2, 1.2, '#d4af37');
  }
  ctx.restore();
}

export const STYLES = {
  hero: { skin: '#e8b890', hair: '#4a2c1a', shirt: '#c8302c', far: '#8f2220', pants: '#26304a', pantsFar: '#1a2236', boot: '#14141c', mark: '#fff', pack: '#2a2e3a' },
  guard: { skin: '#d9a77d', hair: '#222', helmet: '#4b5562', shirt: '#434b57', far: '#2f353e', pants: '#20242b', pantsFar: '#15181d', boot: '#0e0e10' },
  guard2: { skin: '#d9a77d', hair: '#222', helmet: '#6d3b3b', shirt: '#7a3434', far: '#522424', pants: '#20242b', pantsFar: '#15181d', boot: '#0e0e10' },
  zins: { skin: '#e6c6a8', hair: '#e4e4ec', shirt: '#3a4058', far: '#262b3d', pants: '#2e3448', pantsFar: '#1f2333', boot: '#11131c', collar: '#f2f4fa', mark: '#d83838', blade: '#f4f4ff' },
  deepfake: { skin: '#9fe8f5', hair: '#2a7a90', shirt: '#46c5d8', far: '#2e8b9b', pants: '#2a5f78', pantsFar: '#1f4a5c', boot: '#13303d', mark: '#fff', blade: '#aef', alpha: 0.7 },
  celine: { skin: '#e8b890', hair: '#8a3a1c', shirt: '#346ab0', far: '#244a7a', pants: '#2c3a52', pantsFar: '#202c40', boot: '#14141c', collar: '#eef4ff', sword: false },
};
export function styleFor(a) {
  if (a.kind === 'hero') return STYLES.hero;
  if (a.kind === 'deepfake') return STYLES.deepfake;
  if (a.boss) return STYLES.zins;
  return a.gtype === 'g1' || a.gtype === 'g2' ? STYLES.guard : STYLES.guard2;
}
