// src/backdrops.js
// Self-contained procedural Canvas 2D backdrops for Prince of Zurich (384x216 native).
// Zero external imports. Deterministic per roomSeed (no Math.random).

const MAX_CACHE_ENTRIES = 48;
const staticCache = new Map();

// ---------------------------------------------------------------------------
// Deterministic PRNG & helpers (no Math.random anywhere)
// ---------------------------------------------------------------------------

function hashSeed(levelIndex, roomSeed) {
  let h = 2166136261 >>> 0;
  const str = `${levelIndex}:${roomSeed ?? 0}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function createRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

function rngInt(rng, min, max) {
  return Math.floor(rngRange(rng, min, max + 1));
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function createOffscreen(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(w, h);
      const cctx = c.getContext('2d');
      if (cctx) return { canvas: c, ctx: cctx };
    } catch (_) {
      // Fall through to DOM canvas
    }
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cctx = c.getContext('2d');
    if (cctx) return { canvas: c, ctx: cctx };
  }
  return null;
}

function getContextScale(ctx) {
  if (ctx && typeof ctx.getTransform === 'function') {
    const m = ctx.getTransform();
    const s = Math.hypot(m.a, m.b);
    if (Number.isFinite(s) && s >= 0.5) return Math.max(1, Math.min(4, Math.round(s * 2) / 2));
  }
  return 1;
}

function getCachedLayer(key, w, h, scale, builder) {
  let entry = staticCache.get(key);
  if (entry) return entry;

  const pw = Math.max(1, Math.round(w * scale));
  const ph = Math.max(1, Math.round(h * scale));
  const off = createOffscreen(pw, ph);
  if (!off) {
    // Fallback if neither OffscreenCanvas nor document exists
    return { canvas: null, meta: builder(null, w, h) };
  }

  off.ctx.imageSmoothingEnabled = scale > 1;
  if (scale !== 1) {
    off.ctx.scale(scale, scale);
  }
  const meta = builder(off.ctx, w, h) || {};
  entry = { canvas: off.canvas, meta };

  if (staticCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = staticCache.keys().next().value;
    staticCache.delete(oldestKey);
  }
  staticCache.set(key, entry);
  return entry;
}

function drawVignette(ctx, w, h, strength = 0.42) {
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.48,
    Math.min(w, h) * 0.25,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Level 0: Paradeplatz Bank Vaults, Zurich
// Dark green paneled halls, safe-deposit walls, stacked bullion, warm brass
// ---------------------------------------------------------------------------

function buildLevel0Static(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    lamps: [],
    goldSpots: [],
    motes: [],
  };

  // Precompute deterministic animated metadata even if ctx is null
  const pilasterCount = rngInt(rng, 3, 5);
  const pilasterSpacing = Math.floor(w / pilasterCount);
  const pilasterOffset = rngInt(rng, -12, 12);
  const hasVaultDoor = rng() > 0.42;
  const vaultDoorX = Math.floor(rngRange(rng, w * 0.28, w * 0.72));
  const vaultDoorY = Math.floor(h * 0.54);
  const vaultDoorR = rngInt(rng, 38, 50);

  for (let i = 0; i <= pilasterCount; i++) {
    const px = i * pilasterSpacing + pilasterOffset;
    if (px > 18 && px < w - 18) {
      meta.lamps.push({
        x: px,
        y: Math.floor(rngRange(rng, 26, 38)),
        phase: rngRange(rng, 0, Math.PI * 2),
        speed: rngRange(rng, 1.4, 2.7),
      });
    }
  }

  for (let i = 0; i < 18; i++) {
    meta.motes.push({
      x: rngRange(rng, 0, w),
      y: rngRange(rng, 20, h - 18),
      vx: rngRange(rng, 1.4, 3.6) * (rng() > 0.5 ? 1 : -1),
      vy: rngRange(rng, -1.8, -0.5),
      phase: rngRange(rng, 0, Math.PI * 2),
      size: rng() > 0.72 ? 2 : 1,
    });
  }

  if (!ctx) return meta;

  // Base deep emerald-slate gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#060e0b');
  bg.addColorStop(0.45, '#0b1914');
  bg.addColorStop(1, '#07110d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Upper coffered ceiling cornice
  ctx.fillStyle = '#0e1f18';
  ctx.fillRect(0, 0, w, 20);
  ctx.fillStyle = '#2d2414';
  ctx.fillRect(0, 19, w, 2);
  ctx.fillStyle = '#47381d';
  ctx.fillRect(0, 21, w, 1);

  // Safe-deposit box walls recessed in bays
  const boxW = 14;
  const boxH = 9;
  const startY = 30;
  const endY = h - 38;
  for (let y = startY; y < endY; y += boxH) {
    for (let x = 6; x < w - 6; x += boxW) {
      // Skip where circular vault door will sit
      if (hasVaultDoor) {
        const dx = x + boxW * 0.5 - vaultDoorX;
        const dy = y + boxH * 0.5 - vaultDoorY;
        if (dx * dx + dy * dy < (vaultDoorR + 10) * (vaultDoorR + 10)) continue;
      }
      const shade = rng();
      ctx.fillStyle = shade > 0.65 ? '#12251d' : shade > 0.3 ? '#0e1e17' : '#0a1611';
      ctx.fillRect(x + 1, y + 1, boxW - 2, boxH - 2);

      // Subtle dark brass border
      ctx.fillStyle = '#282012';
      ctx.fillRect(x, y, boxW - 1, 1);
      ctx.fillRect(x, y, 1, boxH - 1);

      // Tiny recessed keyhole & handle
      ctx.fillStyle = '#46371c';
      ctx.fillRect(x + 3, y + 4, 2, 1);
      ctx.fillStyle = '#18140d';
      ctx.fillRect(x + boxW - 5, y + 4, 1, 2);
    }
  }

  // Vault door centerpiece OR bullion alcove
  if (hasVaultDoor) {
    // Recessed archway frame
    ctx.fillStyle = '#070e0b';
    ctx.beginPath();
    ctx.arc(vaultDoorX, vaultDoorY, vaultDoorR + 8, 0, Math.PI * 2);
    ctx.fill();

    // Outer steel-brass rim
    ctx.fillStyle = '#222b26';
    ctx.beginPath();
    ctx.arc(vaultDoorX, vaultDoorY, vaultDoorR + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4d3d1f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vaultDoorX, vaultDoorY, vaultDoorR + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Inner vault face
    ctx.fillStyle = '#131d19';
    ctx.beginPath();
    ctx.arc(vaultDoorX, vaultDoorY, vaultDoorR - 2, 0, Math.PI * 2);
    ctx.fill();

    // Locking bolts radiating around circumference
    const boltCount = 12;
    for (let b = 0; b < boltCount; b++) {
      const ang = (b / boltCount) * Math.PI * 2;
      const bx = Math.round(vaultDoorX + Math.cos(ang) * (vaultDoorR - 6));
      const by = Math.round(vaultDoorY + Math.sin(ang) * (vaultDoorR - 6));
      ctx.fillStyle = '#3b2f19';
      ctx.fillRect(bx - 2, by - 1, 4, 2);
    }

    // Spoked brass wheel
    const wheelR = Math.floor(vaultDoorR * 0.42);
    ctx.strokeStyle = '#5c4924';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vaultDoorX, vaultDoorY, wheelR, 0, Math.PI * 2);
    ctx.stroke();
    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2 + 0.2;
      ctx.beginPath();
      ctx.moveTo(vaultDoorX, vaultDoorY);
      ctx.lineTo(
        Math.round(vaultDoorX + Math.cos(ang) * wheelR),
        Math.round(vaultDoorY + Math.sin(ang) * wheelR)
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#755e30';
    ctx.fillRect(vaultDoorX - 2, vaultDoorY - 2, 5, 5);
  }

  // Bullion stacks sitting inside dark arched niches near the floor
  const stackCount = rngInt(rng, 2, 4);
  for (let s = 0; s < stackCount; s++) {
    const sx = Math.floor(rngRange(rng, 32, w - 72));
    if (hasVaultDoor && Math.abs(sx + 18 - vaultDoorX) < vaultDoorR + 14) continue;
    const baseY = h - 30;
    const rows = rngInt(rng, 3, 5);
    const cols = rngInt(rng, 4, 6);

    // Dark recessed alcove behind bars
    ctx.fillStyle = '#060c09';
    ctx.fillRect(sx - 5, baseY - rows * 6 - 10, cols * 10 + 10, rows * 6 + 12);
    ctx.strokeStyle = '#2d2515';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 5.5, baseY - rows * 6 - 10.5, cols * 10 + 11, rows * 6 + 13);

    // Pyramid of gold bullion bars
    for (let r = 0; r < rows; r++) {
      const countInRow = Math.max(1, cols - Math.floor(r * 0.6));
      const rowOffset = Math.floor(((cols - countInRow) * 10) / 2);
      for (let c = 0; c < countInRow; c++) {
        const bx = sx + rowOffset + c * 10;
        const by = baseY - (r + 1) * 5;
        ctx.fillStyle = '#4c3a17';
        ctx.fillRect(bx, by, 9, 4);
        ctx.fillStyle = '#705623';
        ctx.fillRect(bx + 1, by, 7, 1);
        ctx.fillStyle = '#2e220d';
        ctx.fillRect(bx, by + 3, 9, 1);

        if (rng() > 0.58) {
          meta.goldSpots.push({
            x: bx + 2,
            y: by,
            phase: rngRange(rng, 0, Math.PI * 2),
            period: rngRange(rng, 2.8, 6.2),
          });
        }
      }
    }

    // Iron filigree bars in front of gold alcove
    ctx.fillStyle = 'rgba(12, 18, 15, 0.72)';
    for (let gx = sx - 2; gx <= sx + cols * 10 + 2; gx += 7) {
      ctx.fillRect(gx, baseY - rows * 6 - 10, 1, rows * 6 + 12);
    }
  }

  // Fluted architectural pilasters
  for (let i = 0; i <= pilasterCount; i++) {
    const px = i * pilasterSpacing + pilasterOffset;
    if (px < -14 || px > w + 14) continue;
    ctx.fillStyle = '#0c1813';
    ctx.fillRect(px - 8, 22, 16, h - 50);
    ctx.fillStyle = '#152920';
    ctx.fillRect(px - 6, 22, 2, h - 50);
    ctx.fillRect(px - 1, 22, 2, h - 50);
    ctx.fillRect(px + 4, 22, 2, h - 50);

    // Brass capital & base trim
    ctx.fillStyle = '#47371b';
    ctx.fillRect(px - 10, 22, 20, 4);
    ctx.fillRect(px - 10, h - 32, 20, 4);
  }

  // Sconce fixtures
  for (const lamp of meta.lamps) {
    ctx.fillStyle = '#4a3a1d';
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 7);
    ctx.fillStyle = '#1d3b2b'; // classic dark green banker's shade
    ctx.fillRect(lamp.x - 5, lamp.y - 5, 10, 4);
    ctx.fillStyle = '#7c622c';
    ctx.fillRect(lamp.x - 2, lamp.y - 1, 4, 2);
  }

  // Marble/wood lower wainscoting
  ctx.fillStyle = '#09120e';
  ctx.fillRect(0, h - 28, w, 28);
  ctx.fillStyle = '#332815';
  ctx.fillRect(0, h - 28, w, 2);

  drawVignette(ctx, w, h, 0.45);
  return meta;
}

function drawLevel0Dynamic(ctx, w, h, t, meta) {
  // Warm flickering sconce glows
  for (const lamp of meta.lamps) {
    const flicker =
      0.86 +
      0.08 * Math.sin(t * lamp.speed + lamp.phase) +
      0.06 * Math.sin(t * lamp.speed * 3.17 + lamp.phase * 1.9);
    const r = 46 * flicker;
    const g = ctx.createRadialGradient(lamp.x, lamp.y + 4, 2, lamp.x, lamp.y + 12, r);
    g.addColorStop(0, `rgba(186, 146, 68, ${0.15 * flicker})`);
    g.addColorStop(0.45, `rgba(130, 100, 42, ${0.06 * flicker})`);
    g.addColorStop(1, 'rgba(130, 100, 42, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(lamp.x - r, lamp.y - 10, r * 2, r * 1.8);
  }

  // Subtle gold bar glints
  for (const spot of meta.goldSpots) {
    const wave = Math.sin((t * Math.PI * 2) / spot.period + spot.phase);
    if (wave > 0.88) {
      const alpha = ((wave - 0.88) / 0.12) * 0.42;
      ctx.fillStyle = `rgba(225, 192, 104, ${alpha.toFixed(3)})`;
      ctx.fillRect(spot.x, spot.y, 3, 1);
      ctx.fillRect(spot.x + 1, spot.y - 1, 1, 3);
    }
  }

  // Drifting golden dust motes
  for (const m of meta.motes) {
    const mx = ((m.x + t * m.vx) % w + w) % w;
    const my = ((m.y + t * m.vy + Math.sin(t * 0.9 + m.phase) * 3) % (h - 28) + (h - 28)) % (h - 28) + 14;
    const a = 0.12 + 0.1 * Math.sin(t * 1.6 + m.phase);
    ctx.fillStyle = `rgba(190, 162, 95, ${a.toFixed(3)})`;
    ctx.fillRect(Math.floor(mx), Math.floor(my), m.size, m.size);
  }
}

// ---------------------------------------------------------------------------
// Level 1: Gotthard Reduit Army Bunker
// Reinforced concrete, heavy pipes, weathered hazard stripes, flickering tubes
// ---------------------------------------------------------------------------

function buildLevel1Static(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    lights: [],
    steamVents: [],
    drips: [],
    beacon: null,
  };

  const lightCount = rngInt(rng, 2, 4);
  for (let i = 0; i < lightCount; i++) {
    const lx = Math.floor(((i + 0.5) / lightCount) * w + rngRange(rng, -18, 18));
    meta.lights.push({
      x: clamp(lx, 32, w - 32),
      y: 16,
      phase: rngRange(rng, 0, 20),
      faulty: rng() > 0.45,
    });
  }

  const ventCount = rngInt(rng, 1, 3);
  for (let i = 0; i < ventCount; i++) {
    meta.steamVents.push({
      x: Math.floor(rngRange(rng, 36, w - 36)),
      y: Math.floor(rngRange(rng, 44, h - 64)),
      phase: rngRange(rng, 0, Math.PI * 2),
      dir: rng() > 0.5 ? 1 : -1,
    });
  }

  for (let i = 0; i < 4; i++) {
    meta.drips.push({
      x: Math.floor(rngRange(rng, 20, w - 20)),
      topY: rngInt(rng, 26, 48),
      bottomY: h - 18,
      period: rngRange(rng, 2.4, 5.2),
      phase: rngRange(rng, 0, 5.0),
    });
  }

  if (rng() > 0.35) {
    meta.beacon = {
      x: Math.floor(rngRange(rng, 48, w - 48)),
      y: Math.floor(rngRange(rng, 42, 66)),
      phase: rngRange(rng, 0, Math.PI * 2),
    };
  }

  if (!ctx) return meta;

  // Base dark concrete bunker backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0d1010');
  bg.addColorStop(0.5, '#151918');
  bg.addColorStop(1, '#0d100f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Poured concrete panels with formwork seams and tie-rod holes
  const panelW = 48;
  const panelH = 36;
  for (let py = 0; py < h; py += panelH) {
    for (let px = 0; px < w; px += panelW) {
      const tone = Math.floor(rngRange(rng, 18, 27));
      ctx.fillStyle = `rgb(${tone}, ${tone + 3}, ${tone + 2})`;
      ctx.fillRect(px + 1, py + 1, panelW - 2, panelH - 2);

      // Tie-rod dimples
      ctx.fillStyle = '#0b0e0e';
      ctx.fillRect(px + 8, py + 8, 2, 2);
      ctx.fillRect(px + panelW - 10, py + 8, 2, 2);
      ctx.fillRect(px + 8, py + panelH - 10, 2, 2);
      ctx.fillRect(px + panelW - 10, py + panelH - 10, 2, 2);

      // Subtle concrete moisture stain
      if (rng() > 0.65) {
        const sx = px + rngInt(rng, 6, panelW - 12);
        const sh = rngInt(rng, 10, panelH - 6);
        ctx.fillStyle = 'rgba(6, 9, 8, 0.32)';
        ctx.fillRect(sx, py + 2, rngInt(rng, 2, 5), sh);
      }
    }
  }

  // Deep recessed blast-door or reinforced arch bays
  const bayCount = rngInt(rng, 2, 3);
  const bayW = Math.floor(w / bayCount);
  for (let i = 0; i < bayCount; i++) {
    const bx = i * bayW + Math.floor(bayW * 0.22);
    const bw = Math.floor(bayW * 0.56);
    const by = 46;
    const bh = h - 72;

    ctx.fillStyle = '#0b0e0e';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1b201e';
    ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    ctx.fillStyle = '#111514';
    ctx.fillRect(bx + 6, by + 6, bw - 12, bh - 12);

    // Heavy horizontal steel ribbing inside blast door
    ctx.fillStyle = '#1d2320';
    for (let ry = by + 16; ry < by + bh - 12; ry += 16) {
      ctx.fillRect(bx + 8, ry, bw - 16, 2);
    }

    // Muted weathered diagonal hazard stripes above bay
    const stripeY = by - 9;
    const stripeH = 7;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, stripeY, bw, stripeH);
    ctx.clip();
    ctx.fillStyle = '#141411';
    ctx.fillRect(bx, stripeY, bw, stripeH);
    ctx.fillStyle = '#534419'; // subdued dusty hazard yellow
    for (let sx = bx - 10; sx < bx + bw + 10; sx += 12) {
      ctx.beginPath();
      ctx.moveTo(sx, stripeY + stripeH);
      ctx.lineTo(sx + 6, stripeY + stripeH);
      ctx.lineTo(sx + 11, stripeY);
      ctx.lineTo(sx + 5, stripeY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Subtle faded Swiss Reduit cross stencil on one wall section
  const crossX = Math.floor(rngRange(rng, 28, w - 44));
  const crossY = Math.floor(rngRange(rng, 68, h - 78));
  ctx.fillStyle = 'rgba(72, 26, 24, 0.34)';
  ctx.fillRect(crossX - 8, crossY - 8, 16, 16);
  ctx.fillStyle = 'rgba(130, 136, 132, 0.25)';
  ctx.fillRect(crossX - 2, crossY - 5, 4, 10);
  ctx.fillRect(crossX - 5, crossY - 2, 10, 4);

  // Overhead horizontal industrial pipes
  const pipeYs = [24, 31, 37];
  for (let p = 0; p < pipeYs.length; p++) {
    const py = pipeYs[p];
    const thick = p === 0 ? 5 : 3;
    ctx.fillStyle = p === 1 ? '#2b201c' : '#232928';
    ctx.fillRect(0, py, w, thick);
    ctx.fillStyle = p === 1 ? '#3d2e28' : '#333c3a';
    ctx.fillRect(0, py, w, 1);
    ctx.fillStyle = '#0d1010';
    ctx.fillRect(0, py + thick - 1, w, 1);

    // Pipe flange collars
    for (let fx = 24 + p * 17; fx < w; fx += 58) {
      ctx.fillStyle = '#181d1c';
      ctx.fillRect(fx, py - 1, 4, thick + 2);
    }
  }

  // Vertical riser pipes & valve wheels
  const vPipeCount = rngInt(rng, 2, 4);
  for (let i = 0; i < vPipeCount; i++) {
    const vx = Math.floor(rngRange(rng, 16, w - 20));
    ctx.fillStyle = '#202625';
    ctx.fillRect(vx, 22, 4, h - 22);
    ctx.fillStyle = '#303937';
    ctx.fillRect(vx, 22, 1, h - 22);
    ctx.fillStyle = '#0b0e0e';
    ctx.fillRect(vx + 3, 22, 1, h - 22);

    // Rust-red handwheel
    if (rng() > 0.35) {
      const vy = rngInt(rng, 70, h - 55);
      ctx.strokeStyle = '#4a2620';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(vx + 2, vy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Lower concrete dado & hazard baseboard
  ctx.fillStyle = '#0f1312';
  ctx.fillRect(0, h - 22, w, 22);
  ctx.fillStyle = '#242a28';
  ctx.fillRect(0, h - 22, w, 2);

  // Ceiling fluorescent fixture cages
  for (const light of meta.lights) {
    ctx.fillStyle = '#252b29';
    ctx.fillRect(light.x - 14, light.y - 4, 28, 4);
    ctx.fillStyle = '#3c4540';
    ctx.fillRect(light.x - 11, light.y, 22, 2);
  }

  // Beacon bracket
  if (meta.beacon) {
    ctx.fillStyle = '#222625';
    ctx.fillRect(meta.beacon.x - 3, meta.beacon.y - 4, 6, 5);
  }

  drawVignette(ctx, w, h, 0.44);
  return meta;
}

function drawLevel1Dynamic(ctx, w, h, t, meta) {
  // Fluorescent tube cones (with deterministic electrical stutter on faulty lamps)
  for (const light of meta.lights) {
    let intensity = 0.85 + 0.06 * Math.sin(t * 2.1 + light.phase);
    if (light.faulty) {
      const cycle = (t * 0.55 + light.phase) % 4.3;
      if (cycle > 3.7 && cycle < 4.15) {
        const buzz = Math.sin(t * 53 + light.phase * 7);
        intensity = buzz > 0.1 ? 0.92 : 0.22;
      }
    }

    ctx.fillStyle = `rgba(182, 198, 174, ${(0.28 * intensity).toFixed(3)})`;
    ctx.fillRect(light.x - 10, light.y, 20, 2);

    const g = ctx.createRadialGradient(light.x, light.y + 4, 4, light.x, light.y + 28, 66);
    g.addColorStop(0, `rgba(148, 166, 140, ${(0.12 * intensity).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(98, 112, 95, ${(0.05 * intensity).toFixed(3)})`);
    g.addColorStop(1, 'rgba(98, 112, 95, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(light.x - 66, light.y, 132, 94);
  }

  // Subtle amber warning beacon pulse
  if (meta.beacon) {
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 2.4 + meta.beacon.phase), 3);
    const r = 26 + pulse * 14;
    const g = ctx.createRadialGradient(meta.beacon.x, meta.beacon.y, 1, meta.beacon.x, meta.beacon.y, r);
    g.addColorStop(0, `rgba(186, 102, 34, ${(0.22 * pulse).toFixed(3)})`);
    g.addColorStop(1, 'rgba(186, 102, 34, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(meta.beacon.x - r, meta.beacon.y - r, r * 2, r * 2);
  }

  // Rising pipe steam wisps
  for (const vent of meta.steamVents) {
    for (let p = 0; p < 5; p++) {
      const life = ((t * 0.45 + vent.phase + p * 0.2) % 1 + 1) % 1;
      const sx = vent.x + vent.dir * life * 16 + Math.sin(life * 5 + p) * 2;
      const sy = vent.y - life * 24;
      const alpha = Math.sin(life * Math.PI) * 0.085;
      const rad = 3 + life * 7;
      ctx.fillStyle = `rgba(160, 174, 168, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Condensation drips
  for (const d of meta.drips) {
    const phase = ((t + d.phase) % d.period) / d.period;
    if (phase < 0.35) {
      const p = phase / 0.35;
      const dy = d.topY + p * p * (d.bottomY - d.topY);
      ctx.fillStyle = 'rgba(130, 152, 148, 0.28)';
      ctx.fillRect(d.x, Math.floor(dy), 1, 3);
    } else if (phase < 0.42) {
      const spread = Math.floor(((phase - 0.35) / 0.07) * 4);
      ctx.fillStyle = 'rgba(130, 152, 148, 0.2)';
      ctx.fillRect(d.x - spread, d.bottomY, 1, 1);
      ctx.fillRect(d.x + spread, d.bottomY, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Level 2: CERN Accelerator Tunnel, Geneva
// Blue-lit subterranean concrete rings, superconducting dipole magnets, cables
// ---------------------------------------------------------------------------

function buildLevel2Static(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    beamY: Math.floor(h * 0.56),
    leds: [],
    sparks: [],
    stripLights: [],
  };

  for (let i = 0; i < 4; i++) {
    meta.stripLights.push({
      x: Math.floor(((i + 0.5) / 4) * w),
      y: 18,
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }

  const rackCount = rngInt(rng, 2, 4);
  const racks = [];
  for (let i = 0; i < rackCount; i++) {
    const rx = Math.floor(rngRange(rng, 22, w - 42));
    racks.push({ x: rx, y: Math.floor(h * 0.34), w: 22, h: 42 });
    const ledCount = rngInt(rng, 4, 7);
    for (let l = 0; l < ledCount; l++) {
      const colorPick = rng();
      meta.leds.push({
        x: rx + 4 + (l % 3) * 5,
        y: Math.floor(h * 0.34) + 6 + Math.floor(l / 3) * 7,
        color: colorPick > 0.7 ? '#3db8d9' : colorPick > 0.35 ? '#35a676' : '#c28d38',
        rate: rngRange(rng, 1.2, 5.2),
        phase: rngRange(rng, 0, Math.PI * 2),
      });
    }
  }

  for (let i = 0; i < 16; i++) {
    meta.sparks.push({
      x: rngRange(rng, 0, w),
      y: rngRange(rng, 24, h - 24),
      speed: rngRange(rng, 6, 18),
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }

  const hasDetectorRing = rng() > 0.45;
  const detectorX = Math.floor(rngRange(rng, w * 0.32, w * 0.68));
  const detectorY = Math.floor(h * 0.46);

  if (!ctx) return meta;

  // Deep cryo-indigo tunnel background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#050912');
  bg.addColorStop(0.5, '#0b1426');
  bg.addColorStop(1, '#060c18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Curved concrete tunnel ribs
  const ribSpacing = 32;
  const ribShift = rngInt(rng, 0, ribSpacing - 1);
  for (let rx = -ribShift; rx < w + ribSpacing; rx += ribSpacing) {
    ctx.fillStyle = '#0f1b33';
    ctx.fillRect(rx, 0, 6, h);
    ctx.fillStyle = '#172747';
    ctx.fillRect(rx + 1, 0, 2, h);
    ctx.fillStyle = '#070d1a';
    ctx.fillRect(rx + 6, 0, 2, h);
  }

  // Horizontal tunnel seam bands
  ctx.fillStyle = '#111f3b';
  ctx.fillRect(0, 32, w, 2);
  ctx.fillRect(0, h - 42, w, 2);

  // Optional distant detector-chamber concentric silhouette (ATLAS/CMS inspired)
  if (hasDetectorRing) {
    for (let ring = 4; ring >= 1; ring--) {
      const r = ring * 13 + 8;
      ctx.strokeStyle = ring % 2 === 0 ? 'rgba(34, 62, 102, 0.45)' : 'rgba(22, 42, 74, 0.55)';
      ctx.lineWidth = ring === 4 ? 5 : 3;
      ctx.beginPath();
      ctx.arc(detectorX, detectorY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Radial calorimeter spokes
    ctx.strokeStyle = 'rgba(26, 52, 88, 0.4)';
    ctx.lineWidth = 1;
    for (let s = 0; s < 12; s++) {
      const ang = (s / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(detectorX + Math.cos(ang) * 14, detectorY + Math.sin(ang) * 14);
      ctx.lineTo(detectorX + Math.cos(ang) * 60, detectorY + Math.sin(ang) * 60);
      ctx.stroke();
    }
  }

  // Overhead cable trays & catenary cable bundles
  ctx.fillStyle = '#0d172b';
  ctx.fillRect(0, 22, w, 6);
  ctx.fillStyle = '#1d3257';
  ctx.fillRect(0, 22, w, 1);
  ctx.strokeStyle = '#162847';
  ctx.lineWidth = 1;
  for (let c = 0; c < 3; c++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 48) {
      const sag = 4 + c * 3;
      if (x === 0) ctx.moveTo(x, 28 + c * 2);
      else ctx.quadraticCurveTo(x - 24, 28 + c * 2 + sag, x, 28 + c * 2);
    }
    ctx.stroke();
  }

  // Instrumentation racks in background bays
  for (const rack of racks) {
    ctx.fillStyle = '#0a1222';
    ctx.fillRect(rack.x, rack.y, rack.w, rack.h);
    ctx.strokeStyle = '#1d3154';
    ctx.lineWidth = 1;
    ctx.strokeRect(rack.x + 0.5, rack.y + 0.5, rack.w - 1, rack.h - 1);
    ctx.fillStyle = '#12203b';
    for (let sy = rack.y + 4; sy < rack.y + rack.h - 4; sy += 7) {
      ctx.fillRect(rack.x + 2, sy, rack.w - 4, 4);
    }
  }

  // Superconducting dipole magnet cryostat line (iconic LHC blue tubes)
  const by = meta.beamY;
  // Support jacks
  for (let jx = 24; jx < w; jx += 64) {
    ctx.fillStyle = '#162540';
    ctx.fillRect(jx, by + 15, 8, h - (by + 15) - 18);
    ctx.fillStyle = '#233a61';
    ctx.fillRect(jx + 1, by + 15, 2, h - (by + 15) - 18);
  }

  // Cryostat main cylinder body
  ctx.fillStyle = '#122645';
  ctx.fillRect(0, by - 12, w, 26);
  ctx.fillStyle = '#1c3b69';
  ctx.fillRect(0, by - 10, w, 5);
  ctx.fillStyle = '#29538c';
  ctx.fillRect(0, by - 9, w, 2);
  ctx.fillStyle = '#0b182e';
  ctx.fillRect(0, by + 8, w, 6);

  // Cryostat interconnect bellows & copper busbars
  for (let bx = 46; bx < w; bx += 78) {
    ctx.fillStyle = '#0d192e';
    ctx.fillRect(bx, by - 14, 14, 30);
    ctx.fillStyle = '#2c3d59';
    for (let k = 0; k < 12; k += 3) {
      ctx.fillRect(bx + 1 + k, by - 12, 2, 26);
    }
    // Subtle copper superconducting coil detail
    ctx.fillStyle = '#473024';
    ctx.fillRect(bx + 2, by - 15, 10, 2);
  }

  // Central translucent beamline conduit groove
  ctx.fillStyle = '#091629';
  ctx.fillRect(0, by - 2, w, 4);

  // Overhead tunnel strip light housings
  for (const s of meta.stripLights) {
    ctx.fillStyle = '#1f365c';
    ctx.fillRect(s.x - 18, s.y - 3, 36, 3);
    ctx.fillStyle = '#33628a';
    ctx.fillRect(s.x - 15, s.y, 30, 1);
  }

  // Lower service floor deck
  ctx.fillStyle = '#081020';
  ctx.fillRect(0, h - 20, w, 20);
  ctx.fillStyle = '#1a2f52';
  ctx.fillRect(0, h - 20, w, 1);

  drawVignette(ctx, w, h, 0.42);
  return meta;
}

function drawLevel2Dynamic(ctx, w, h, t, meta) {
  // Subtle pulsing cool-blue ceiling strip lights
  for (const s of meta.stripLights) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.3 + s.phase);
    const g = ctx.createRadialGradient(s.x, s.y + 4, 4, s.x, s.y + 24, 58);
    g.addColorStop(0, `rgba(62, 146, 204, ${(0.12 * pulse).toFixed(3)})`);
    g.addColorStop(1, 'rgba(62, 146, 204, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x - 58, s.y, 116, 76);
  }

  // Traveling Cherenkov-blue beam pulses along the dipole cryostat
  const by = meta.beamY;
  for (let b = 0; b < 2; b++) {
    const speed = b === 0 ? 115 : -82;
    const rawX = (t * speed + b * 210) % (w + 140);
    const px = rawX < 0 ? rawX + w + 140 - 70 : rawX - 70;
    const len = b === 0 ? 64 : 44;

    const grad = ctx.createLinearGradient(px - len, by, px + len, by);
    grad.addColorStop(0, 'rgba(56, 178, 232, 0)');
    grad.addColorStop(0.5, 'rgba(84, 206, 255, 0.28)');
    grad.addColorStop(1, 'rgba(56, 178, 232, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - len, by - 3, len * 2, 6);

    // Subtle wider halo
    const halo = ctx.createRadialGradient(px, by, 2, px, by, 28);
    halo.addColorStop(0, 'rgba(72, 188, 240, 0.14)');
    halo.addColorStop(1, 'rgba(72, 188, 240, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - 28, by - 28, 56, 56);
  }

  // Blinking instrumentation rack LEDs
  for (const led of meta.leds) {
    const on = Math.sin(t * led.rate + led.phase) > 0.15;
    if (on) {
      ctx.fillStyle = led.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(led.x, led.y, 2, 1);
      ctx.globalAlpha = 1;
    }
  }

  // Faint drifting ionized dust motes
  for (const sp of meta.sparks) {
    const sx = ((sp.x + t * sp.speed) % w + w) % w;
    const sy = sp.y + Math.sin(t * 1.4 + sp.phase) * 3;
    const a = 0.1 + 0.1 * Math.sin(t * 2.5 + sp.phase);
    ctx.fillStyle = `rgba(110, 198, 242, ${a.toFixed(3)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }
}

// ---------------------------------------------------------------------------
// Level 3: Jungfraujoch Ice Palace
// Ice-blue caverns, crystalline facets, hanging icicles, refractive glints
// ---------------------------------------------------------------------------

function buildLevel3Static(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    sparkles: [],
    motes: [],
    causticPhase: rngRange(rng, 0, Math.PI * 2),
  };

  for (let i = 0; i < 20; i++) {
    meta.sparkles.push({
      x: Math.floor(rngRange(rng, 12, w - 12)),
      y: Math.floor(rngRange(rng, 14, h - 22)),
      phase: rngRange(rng, 0, Math.PI * 2),
      speed: rngRange(rng, 1.1, 2.8),
    });
  }

  for (let i = 0; i < 24; i++) {
    meta.motes.push({
      x: rngRange(rng, 0, w),
      y: rngRange(rng, 0, h),
      vx: rngRange(rng, 2.0, 5.5),
      vy: rngRange(rng, 2.5, 6.5),
      phase: rngRange(rng, 0, Math.PI * 2),
      size: rng() > 0.78 ? 2 : 1,
    });
  }

  if (!ctx) return meta;

  // Deep glacial cavern gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#050f19');
  bg.addColorStop(0.45, '#0b1e2f');
  bg.addColorStop(0.85, '#102b40');
  bg.addColorStop(1, '#091826');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Far faceted glacial crystal wall planes
  const facetCols = 10;
  const cellW = w / facetCols;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < facetCols; col++) {
      const x0 = Math.floor(col * cellW + rngRange(rng, -6, 6));
      const y0 = Math.floor(row * (h / 5) + rngRange(rng, -6, 6));
      const x1 = Math.floor((col + 1) * cellW + rngRange(rng, -4, 6));
      const y1 = Math.floor((row + 1) * (h / 5) + rngRange(rng, -4, 6));
      const shade = rng();
      ctx.fillStyle =
        shade > 0.7
          ? 'rgba(34, 78, 108, 0.24)'
          : shade > 0.35
          ? 'rgba(20, 52, 78, 0.28)'
          : 'rgba(8, 22, 36, 0.32)';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0 + rngInt(rng, -5, 5));
      ctx.lineTo(x1 + rngInt(rng, -6, 6), y1);
      ctx.lineTo(x0, y1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Carved ice palace arches / pillars in mid-ground
  const archCount = rngInt(rng, 3, 4);
  const archSpan = w / archCount;
  for (let i = 0; i <= archCount; i++) {
    const px = Math.floor(i * archSpan);
    // Ice pillar
    ctx.fillStyle = '#0d2336';
    ctx.fillRect(px - 10, 14, 20, h - 14);
    ctx.fillStyle = '#183c57';
    ctx.fillRect(px - 8, 14, 5, h - 14);
    ctx.fillStyle = '#255578';
    ctx.fillRect(px - 7, 14, 2, h - 14);
    ctx.fillStyle = '#071420';
    ctx.fillRect(px + 5, 14, 5, h - 14);

    // Pointed glacial arch connecting pillars
    if (i < archCount) {
      const midX = Math.floor(px + archSpan * 0.5);
      ctx.strokeStyle = 'rgba(42, 92, 126, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 6, 62);
      ctx.quadraticCurveTo(px + 10, 18, midX, 10);
      ctx.quadraticCurveTo(px + archSpan - 10, 18, px + archSpan - 6, 62);
      ctx.stroke();
    }
  }

  // Diagonal internal ice fracture lines (low contrast)
  ctx.strokeStyle = 'rgba(72, 134, 172, 0.14)';
  ctx.lineWidth = 1;
  for (let f = 0; f < 14; f++) {
    const fx = rngRange(rng, 0, w);
    const fy = rngRange(rng, 12, h - 20);
    const flen = rngRange(rng, 18, 52);
    const ang = rngRange(rng, -0.9, 0.9);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(ang) * flen, fy + Math.sin(ang) * flen);
    ctx.stroke();
  }

  // Hanging icicle curtain along upper cavern ceiling
  let ix = 0;
  while (ix < w) {
    const iw = rngInt(rng, 4, 10);
    const ih = rngInt(rng, 10, 34);
    ctx.fillStyle = '#133148';
    ctx.beginPath();
    ctx.moveTo(ix, 0);
    ctx.lineTo(ix + iw, 0);
    ctx.lineTo(ix + Math.floor(iw * 0.5), ih);
    ctx.closePath();
    ctx.fill();

    // Subtle pale rim on left edge
    ctx.fillStyle = '#2d6285';
    ctx.beginPath();
    ctx.moveTo(ix, 0);
    ctx.lineTo(ix + Math.max(1, Math.floor(iw * 0.35)), 0);
    ctx.lineTo(ix + Math.floor(iw * 0.5), ih);
    ctx.closePath();
    ctx.fill();

    ix += Math.max(3, iw - rngInt(rng, 0, 2));
  }

  // Lower glacial ice shelf / stalagmites
  let sx = 0;
  while (sx < w) {
    const sw = rngInt(rng, 10, 24);
    const sh = rngInt(rng, 8, 22);
    ctx.fillStyle = '#0a1d2d';
    ctx.beginPath();
    ctx.moveTo(sx, h);
    ctx.lineTo(sx + Math.floor(sw * 0.45), h - sh);
    ctx.lineTo(sx + sw, h);
    ctx.closePath();
    ctx.fill();
    sx += Math.floor(sw * 0.72);
  }

  drawVignette(ctx, w, h, 0.38);
  return meta;
}

function drawLevel3Dynamic(ctx, w, h, t, meta) {
  // Subtle shifting glacial light refraction bands
  for (let b = 0; b < 3; b++) {
    const cx = ((w * 0.25 + b * 130 + Math.sin(t * 0.28 + b * 1.9 + meta.causticPhase) * 42) % w + w) % w;
    const g = ctx.createLinearGradient(cx - 48, 0, cx + 48, h);
    g.addColorStop(0, 'rgba(72, 168, 214, 0)');
    g.addColorStop(0.5, 'rgba(72, 168, 214, 0.055)');
    g.addColorStop(1, 'rgba(72, 168, 214, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Crystalline sparkles on facets
  for (const sp of meta.sparkles) {
    const v = Math.sin(t * sp.speed + sp.phase);
    if (v > 0.78) {
      const a = ((v - 0.78) / 0.22) * 0.48;
      ctx.fillStyle = `rgba(176, 232, 255, ${a.toFixed(3)})`;
      ctx.fillRect(sp.x, sp.y, 1, 1);
      if (v > 0.9) {
        ctx.fillStyle = `rgba(145, 218, 250, ${(a * 0.5).toFixed(3)})`;
        ctx.fillRect(sp.x - 1, sp.y, 3, 1);
        ctx.fillRect(sp.x, sp.y - 1, 1, 3);
      }
    }
  }

  // Drifting ice crystals / frost motes
  for (const m of meta.motes) {
    const mx = ((m.x + t * m.vx + Math.sin(t * 0.8 + m.phase) * 4) % w + w) % w;
    const my = ((m.y + t * m.vy) % h + h) % h;
    ctx.fillStyle = 'rgba(170, 224, 248, 0.22)';
    ctx.fillRect(Math.floor(mx), Math.floor(my), m.size, m.size);
  }

  // Faint floor frost mist
  const mistShift = Math.sin(t * 0.4 + meta.causticPhase) * 14;
  const mist = ctx.createLinearGradient(0, h - 34, 0, h);
  mist.addColorStop(0, 'rgba(92, 174, 214, 0)');
  mist.addColorStop(1, 'rgba(92, 174, 214, 0.09)');
  ctx.fillStyle = mist;
  ctx.fillRect(mistShift - 20, h - 34, w + 40, 34);
}

// ---------------------------------------------------------------------------
// Level 4: Sphinx Observatory Summit at Night
// Starry Alpine sky, jagged Alps silhouettes, Observatory dome, blowing snow
// ---------------------------------------------------------------------------

function buildLevel4Static(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    stars: [],
    snow: [],
    beacon: null,
    windows: [],
    shootPhase: rngRange(rng, 0, 14),
    domeX: 0,
  };

  for (let i = 0; i < 64; i++) {
    const tint = rng();
    meta.stars.push({
      x: Math.floor(rngRange(rng, 2, w - 2)),
      y: Math.floor(rngRange(rng, 2, h * 0.56)),
      size: rng() > 0.86 ? 2 : 1,
      baseAlpha: rngRange(rng, 0.22, 0.65),
      speed: rngRange(rng, 1.2, 3.8),
      phase: rngRange(rng, 0, Math.PI * 2),
      color: tint > 0.72 ? '195, 222, 255' : tint > 0.4 ? '230, 236, 248' : '242, 226, 198',
    });
  }

  for (let i = 0; i < 42; i++) {
    const far = i < 24;
    meta.snow.push({
      x: rngRange(rng, 0, w),
      y: rngRange(rng, 0, h),
      vx: far ? rngRange(rng, -16, -9) : rngRange(rng, -30, -18),
      vy: far ? rngRange(rng, 8, 15) : rngRange(rng, 16, 28),
      phase: rngRange(rng, 0, Math.PI * 2),
      size: far ? 1 : rng() > 0.6 ? 2 : 1,
      alpha: far ? 0.16 : 0.28,
    });
  }

  const domeX = Math.floor(rngRange(rng, w * 0.24, w * 0.76));
  const domeY = Math.floor(rngRange(rng, h * 0.44, h * 0.53));
  meta.domeX = domeX;
  meta.beacon = { x: domeX + 20, y: domeY - 22 };

  for (let i = 0; i < 4; i++) {
    meta.windows.push({
      x: domeX - 11 + i * 6,
      y: domeY + 6,
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }

  if (!ctx) return meta;

  // Deep alpine night sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#03060f');
  sky.addColorStop(0.45, '#071022');
  sky.addColorStop(0.82, '#0e1b36');
  sky.addColorStop(1, '#091122');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Faint Milky Way / alpine horizon glow
  const horizonGlow = ctx.createRadialGradient(w * 0.5, h * 0.62, 12, w * 0.5, h * 0.62, w * 0.58);
  horizonGlow.addColorStop(0, 'rgba(34, 58, 98, 0.22)');
  horizonGlow.addColorStop(1, 'rgba(34, 58, 98, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, w, h);

  // Helper for jagged Alpine mountain ridge
  function drawRidge(baseY, amp, step, fill, snowRim) {
    const pts = [];
    let x = -step;
    let prev = baseY;
    while (x <= w + step) {
      const target = baseY - rngRange(rng, 0, amp);
      prev = prev * 0.35 + target * 0.65;
      pts.push({ x, y: Math.floor(prev) });
      x += rngInt(rng, Math.floor(step * 0.65), Math.floor(step * 1.35));
    }

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle moonlit snow ridge highlights on left-facing slopes
    if (snowRim) {
      ctx.strokeStyle = snowRim;
      ctx.lineWidth = 1;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].y < pts[i - 1].y) {
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y + 1);
          ctx.lineTo(pts[i].x, pts[i].y + 1);
          ctx.stroke();
        }
      }
    }
  }

  // Three depth layers of Alps silhouettes
  drawRidge(Math.floor(h * 0.66), 54, 24, '#0c162b', 'rgba(72, 102, 146, 0.22)');
  drawRidge(Math.floor(h * 0.76), 46, 20, '#101d36', 'rgba(84, 118, 166, 0.24)');

  // Sphinx Observatory crag & iconic summit terrace + dome
  ctx.fillStyle = '#091121';
  ctx.beginPath();
  ctx.moveTo(domeX - 42, h);
  ctx.lineTo(domeX - 24, domeY + 14);
  ctx.lineTo(domeX + 26, domeY + 14);
  ctx.lineTo(domeX + 44, h);
  ctx.closePath();
  ctx.fill();

  // Observatory building block & terrace railing
  ctx.fillStyle = '#15243d';
  ctx.fillRect(domeX - 18, domeY, 36, 15);
  ctx.fillStyle = '#203557';
  ctx.fillRect(domeX - 22, domeY + 11, 44, 3);

  // Astronomical dome silhouette
  ctx.fillStyle = '#1c304f';
  ctx.beginPath();
  ctx.arc(domeX, domeY, 12, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Dome highlight & shutter slit
  ctx.strokeStyle = 'rgba(116, 152, 198, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(domeX, domeY, 11.5, Math.PI * 1.1, Math.PI * 1.65);
  ctx.stroke();
  ctx.fillStyle = '#0a1426';
  ctx.fillRect(domeX + 2, domeY - 11, 2, 11);

  // Meteorological mast/antenna
  ctx.fillStyle = '#253c61';
  ctx.fillRect(domeX + 19, domeY - 22, 1, 24);
  ctx.fillRect(domeX + 16, domeY - 14, 7, 1);

  // Foreground dark alpine ridge framing bottom
  drawRidge(Math.floor(h * 0.89), 24, 18, '#070d1a', 'rgba(60, 88, 128, 0.16)');

  drawVignette(ctx, w, h, 0.36);
  return meta;
}

function drawLevel4Dynamic(ctx, w, h, t, meta) {
  // Subtle high-altitude aurora/cloud veil
  const veilShift = Math.sin(t * 0.18) * 18;
  const veil = ctx.createLinearGradient(0, 12, 0, h * 0.45);
  veil.addColorStop(0, 'rgba(44, 96, 128, 0)');
  veil.addColorStop(0.5, 'rgba(48, 110, 138, 0.045)');
  veil.addColorStop(1, 'rgba(44, 96, 128, 0)');
  ctx.fillStyle = veil;
  ctx.fillRect(veilShift - 20, 12, w + 40, h * 0.42);

  // Twinkling stars
  for (const s of meta.stars) {
    const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
    const a = s.baseAlpha * tw;
    ctx.fillStyle = `rgba(${s.color}, ${a.toFixed(3)})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }

  // Occasional subtle shooting star (once every ~15s)
  const shootCycle = (t + meta.shootPhase) % 15;
  if (shootCycle < 0.55) {
    const p = shootCycle / 0.55;
    const sx = w * 0.72 - p * 88;
    const sy = 14 + p * 30;
    const alpha = Math.sin(p * Math.PI) * 0.45;
    ctx.strokeStyle = `rgba(215, 232, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 16, sy - 5.5);
    ctx.stroke();
  }

  // Warm dim observatory windows
  for (const win of meta.windows) {
    const glow = 0.72 + 0.2 * Math.sin(t * 1.8 + win.phase);
    ctx.fillStyle = `rgba(204, 158, 76, ${(0.45 * glow).toFixed(3)})`;
    ctx.fillRect(win.x, win.y, 3, 2);
  }

  // Red summit antenna beacon pulse
  if (meta.beacon) {
    const bp = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2), 4);
    ctx.fillStyle = `rgba(210, 58, 52, ${(0.25 + 0.55 * bp).toFixed(3)})`;
    ctx.fillRect(meta.beacon.x - 1, meta.beacon.y, 2, 2);
    if (bp > 0.35) {
      const g = ctx.createRadialGradient(meta.beacon.x, meta.beacon.y, 1, meta.beacon.x, meta.beacon.y, 10);
      g.addColorStop(0, `rgba(220, 62, 56, ${(0.25 * bp).toFixed(3)})`);
      g.addColorStop(1, 'rgba(220, 62, 56, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(meta.beacon.x - 10, meta.beacon.y - 10, 20, 20);
    }
  }

  // Wind-driven drifting snow
  for (const fl of meta.snow) {
    const fx = ((fl.x + t * fl.vx) % w + w) % w;
    const fy = ((fl.y + t * fl.vy + Math.sin(t * 1.5 + fl.phase) * 2) % h + h) % h;
    ctx.fillStyle = `rgba(205, 224, 245, ${fl.alpha})`;
    ctx.fillRect(Math.floor(fx), Math.floor(fy), fl.size, fl.size);
  }
}

// ---------------------------------------------------------------------------
// Title Screen Backdrop: Zurich Skyline at Dusk
// Grossmuenster twin towers, Fraumuenster spire, Lake Zurich, Alps, SBB clock
// ---------------------------------------------------------------------------

function buildTitleStatic(ctx, w, h, showClock = true) {
  const rng = createRng(0x5a555249); // 'ZURI'
  const meta = {
    stars: [],
    windows: [],
    ripples: [],
    clock: {
      x: Math.floor(w * 0.145),
      y: Math.floor(h * 0.24),
      r: Math.max(14, Math.floor(Math.min(w, h) * 0.095)),
    },
    waterY: Math.floor(h * 0.72),
  };

  for (let i = 0; i < 48; i++) {
    meta.stars.push({
      x: Math.floor(rngRange(rng, 4, w - 4)),
      y: Math.floor(rngRange(rng, 4, h * 0.36)),
      phase: rngRange(rng, 0, Math.PI * 2),
      speed: rngRange(rng, 1.1, 3.0),
      alpha: rngRange(rng, 0.18, 0.58),
    });
  }

  const waterY = meta.waterY;

  for (let i = 0; i < 36; i++) {
    meta.ripples.push({
      x: rngRange(rng, 12, w - 12),
      y: rngRange(rng, waterY + 4, h - 4),
      len: rngRange(rng, 6, 22),
      speed: rngRange(rng, 0.8, 2.2),
      phase: rngRange(rng, 0, Math.PI * 2),
      warm: rng() > 0.45,
    });
  }

  if (!ctx) return meta;

  // Dusk twilight sky (indigo zenith -> deep plum -> subdued warm amber dusk horizon)
  const sky = ctx.createLinearGradient(0, 0, 0, waterY);
  sky.addColorStop(0, '#070b1a');
  sky.addColorStop(0.36, '#121730');
  sky.addColorStop(0.68, '#281e38');
  sky.addColorStop(0.88, '#4a2b36');
  sky.addColorStop(1, '#683f35');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, waterY);

  // Subtle dusk afterglow behind Alps
  const glow = ctx.createRadialGradient(w * 0.56, waterY - 8, 12, w * 0.56, waterY - 8, w * 0.52);
  glow.addColorStop(0, 'rgba(182, 102, 62, 0.24)');
  glow.addColorStop(0.6, 'rgba(116, 56, 68, 0.1)');
  glow.addColorStop(1, 'rgba(116, 56, 68, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, waterY);

  // Distant Glarner / Swiss Alps silhouette across Lake Zurich
  const alpsPts = [
    [0, waterY - 12],
    [w * 0.08, waterY - 22],
    [w * 0.16, waterY - 16],
    [w * 0.24, waterY - 30],
    [w * 0.31, waterY - 24],
    [w * 0.40, waterY - 38],
    [w * 0.47, waterY - 26],
    [w * 0.55, waterY - 42],
    [w * 0.62, waterY - 30],
    [w * 0.71, waterY - 36],
    [w * 0.80, waterY - 24],
    [w * 0.89, waterY - 31],
    [w, waterY - 18],
  ];
  ctx.fillStyle = '#1b182c';
  ctx.beginPath();
  ctx.moveTo(0, waterY);
  for (const [ax, ay] of alpsPts) ctx.lineTo(Math.floor(ax), Math.floor(ay));
  ctx.lineTo(w, waterY);
  ctx.closePath();
  ctx.fill();

  // Closer dark lakeside foothills
  ctx.fillStyle = '#131324';
  ctx.beginPath();
  ctx.moveTo(0, waterY);
  ctx.lineTo(0, waterY - 14);
  ctx.lineTo(w * 0.22, waterY - 18);
  ctx.lineTo(w * 0.48, waterY - 12);
  ctx.lineTo(w * 0.78, waterY - 17);
  ctx.lineTo(w, waterY - 11);
  ctx.lineTo(w, waterY);
  ctx.closePath();
  ctx.fill();

  // Zurich Old Town skyline silhouette along the Limmat & Lakefront
  ctx.fillStyle = '#0b0c17';
  const bxStart = 0;
  let bx = bxStart;
  while (bx < w) {
    const bw = rngInt(rng, 10, 22);
    const bh = rngInt(rng, 14, 30);
    const by = waterY - bh;
    ctx.fillRect(bx, by, bw, bh);
    // Pitched Zurich gable roof
    ctx.beginPath();
    ctx.moveTo(bx - 1, by);
    ctx.lineTo(bx + Math.floor(bw * 0.5), by - rngInt(rng, 4, 8));
    ctx.lineTo(bx + bw + 1, by);
    ctx.closePath();
    ctx.fill();

    // Record a few tiny warm dusk windows
    const rows = Math.floor(bh / 7);
    for (let r = 0; r < rows; r++) {
      for (let c = 2; c < bw - 3; c += 5) {
        if (rng() > 0.62) {
          meta.windows.push({
            x: bx + c,
            y: by + 3 + r * 6,
            phase: rngRange(rng, 0, Math.PI * 2),
          });
        }
      }
    }
    bx += bw - 1;
  }

  // Fraumuenster slender needle spire (left-center)
  const fmX = Math.floor(w * 0.34);
  ctx.fillStyle = '#090b15';
  ctx.fillRect(fmX - 5, waterY - 46, 10, 46);
  ctx.beginPath();
  ctx.moveTo(fmX - 4, waterY - 46);
  ctx.lineTo(fmX, waterY - 78);
  ctx.lineTo(fmX + 4, waterY - 46);
  ctx.closePath();
  ctx.fill();

  // St. Peter church clock tower (mid-left)
  const spX = Math.floor(w * 0.45);
  ctx.fillStyle = '#0a0c16';
  ctx.fillRect(spX - 7, waterY - 48, 14, 48);
  ctx.beginPath();
  ctx.moveTo(spX - 8, waterY - 48);
  ctx.lineTo(spX, waterY - 62);
  ctx.lineTo(spX + 8, waterY - 48);
  ctx.closePath();
  ctx.fill();
  // Tiny St. Peter golden clock dial
  ctx.fillStyle = '#5c4a2b';
  ctx.beginPath();
  ctx.arc(spX, waterY - 38, 3, 0, Math.PI * 2);
  ctx.fill();

  // Iconic Grossmuenster twin towers (right-center)
  const gmBaseX = Math.floor(w * 0.68);
  const naveW = 36;
  ctx.fillStyle = '#090b15';
  // Nave connecting both towers
  ctx.fillRect(gmBaseX - 18, waterY - 36, naveW, 36);
  ctx.beginPath();
  ctx.moveTo(gmBaseX - 19, waterY - 36);
  ctx.lineTo(gmBaseX, waterY - 46);
  ctx.lineTo(gmBaseX + 19, waterY - 36);
  ctx.closePath();
  ctx.fill();

  // Twin Karlsturm & Glockenturm towers
  const towerOffsets = [-13, 13];
  for (const off of towerOffsets) {
    const tx = gmBaseX + off;
    ctx.fillStyle = '#090b15';
    // Lower masonry shaft
    ctx.fillRect(tx - 7, waterY - 68, 14, 68);
    // Upper octagonal belfry tier
    ctx.fillRect(tx - 6, waterY - 82, 12, 14);
    // Iconic domed/lantern cap + finial
    ctx.beginPath();
    ctx.arc(tx, waterY - 82, 6, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(tx - 2, waterY - 93, 4, 6);
    ctx.fillRect(tx - 1, waterY - 98, 2, 5);

    // Subtle dusk rim highlight along tower edge
    ctx.fillStyle = 'rgba(138, 86, 76, 0.25)';
    ctx.fillRect(tx - 7, waterY - 68, 1, 56);
    // Tiny illuminated arched belfry slit
    ctx.fillStyle = 'rgba(196, 136, 72, 0.4)';
    ctx.fillRect(tx - 1, waterY - 78, 2, 5);
  }

  // Quaibruecke / lakeside promenade wall
  ctx.fillStyle = '#070912';
  ctx.fillRect(0, waterY - 3, w, 4);

  // Lake Zurich water reflection base
  const lake = ctx.createLinearGradient(0, waterY, 0, h);
  lake.addColorStop(0, '#1e192b');
  lake.addColorStop(0.28, '#141528');
  lake.addColorStop(0.7, '#0b0e1e');
  lake.addColorStop(1, '#060812');
  ctx.fillStyle = lake;
  ctx.fillRect(0, waterY, w, h - waterY);

  // Soft reflected Grossmuenster dark silhouette on lake
  ctx.fillStyle = 'rgba(6, 7, 14, 0.45)';
  for (const off of towerOffsets) {
    const tx = gmBaseX + off;
    ctx.fillRect(tx - 6, waterY + 2, 12, h - waterY - 8);
  }

  // Swiss SBB railway station clock bracket & housing (upper-left)
  if (showClock) {
    const cl = meta.clock;
    // Dark wrought-iron station overhang bracket
    ctx.fillStyle = '#090b14';
    ctx.fillRect(0, cl.y - 3, cl.x - cl.r, 5);
    ctx.fillRect(cl.x - 2, 0, 4, cl.y - cl.r);
    ctx.fillStyle = '#1d2236';
    ctx.fillRect(0, cl.y - 3, cl.x - cl.r, 1);

    // Outer metallic casing
    ctx.fillStyle = '#262b3d';
    ctx.beginPath();
    ctx.arc(cl.x, cl.y, cl.r + 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Slightly dimmed cream-white glowing SBB dial (kept low-glare for dusk)
    const dialGrad = ctx.createRadialGradient(cl.x, cl.y, 2, cl.x, cl.y, cl.r);
    dialGrad.addColorStop(0, '#cfd2d6');
    dialGrad.addColorStop(0.85, '#aeb4bd');
    dialGrad.addColorStop(1, '#848b96');
    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2);
    ctx.fill();

    // Iconic Mondaine / SBB baton hour & minute tick marks
    for (let m = 0; m < 60; m++) {
      const ang = (m / 60) * Math.PI * 2 - Math.PI / 2;
      const isHour = m % 5 === 0;
      const rOut = cl.r - 1.5;
      const rIn = isHour ? cl.r - Math.max(4, cl.r * 0.24) : cl.r - Math.max(2, cl.r * 0.11);
      ctx.strokeStyle = '#14171f';
      ctx.lineWidth = isHour ? 1.6 : 0.8;
      ctx.beginPath();
      ctx.moveTo(cl.x + Math.cos(ang) * rIn, cl.y + Math.sin(ang) * rIn);
      ctx.lineTo(cl.x + Math.cos(ang) * rOut, cl.y + Math.sin(ang) * rOut);
      ctx.stroke();
    }
  }

  drawVignette(ctx, w, h, 0.36);
  return meta;
}

function drawTitleDynamic(ctx, w, h, t, meta, showClock = true) {
  // Early evening stars twinkling in upper dusk sky
  for (const s of meta.stars) {
    const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
    ctx.fillStyle = `rgba(225, 232, 250, ${(s.alpha * tw).toFixed(3)})`;
    ctx.fillRect(s.x, s.y, 1, 1);
  }

  // Warm Zurich old-town window lights with subtle life
  for (const win of meta.windows) {
    const flick = 0.78 + 0.22 * Math.sin(t * 0.9 + win.phase);
    ctx.fillStyle = `rgba(222, 168, 86, ${(0.55 * flick).toFixed(3)})`;
    ctx.fillRect(win.x, win.y, 2, 2);
  }

  // Shimmering Lake Zurich water ripples
  for (const r of meta.ripples) {
    const shift = Math.sin(t * r.speed + r.phase) * 5;
    const alpha = 0.08 + 0.08 * Math.sin(t * (r.speed * 1.4) + r.phase);
    ctx.fillStyle = r.warm
      ? `rgba(218, 152, 86, ${alpha.toFixed(3)})`
      : `rgba(136, 152, 198, ${alpha.toFixed(3)})`;
    ctx.fillRect(Math.floor(r.x + shift), Math.floor(r.y), Math.floor(r.len), 1);
  }

  // Animated Swiss SBB station clock hands!
  // 23:00 CET + real-time progression, with authentic SBB 58.5s sweep + 1.5s pause at 12
  if (!showClock) return;
  const cl = meta.clock;
  const baseSeconds = 23 * 3600 + 0 * 60 + t;
  const secInMin = ((baseSeconds % 60) + 60) % 60;
  // Authentic SBB railway clock sweeps 360 deg in 58.5 seconds and pauses 1.5s at 12 o'clock
  const sbbSecFrac = secInMin < 58.5 ? secInMin / 58.5 : 0;
  const minVal = Math.floor(baseSeconds / 60) % 60;
  const hourVal = (baseSeconds / 3600) % 12;

  const hourAng = (hourVal / 12) * Math.PI * 2 - Math.PI / 2;
  const minAng = (minVal / 60) * Math.PI * 2 - Math.PI / 2;
  const secAng = sbbSecFrac * Math.PI * 2 - Math.PI / 2;

  // Soft glow halo around station clock
  const cg = ctx.createRadialGradient(cl.x, cl.y, cl.r * 0.7, cl.x, cl.y, cl.r * 2.1);
  cg.addColorStop(0, 'rgba(204, 212, 224, 0.09)');
  cg.addColorStop(1, 'rgba(204, 212, 224, 0)');
  ctx.fillStyle = cg;
  ctx.fillRect(cl.x - cl.r * 2.1, cl.y - cl.r * 2.1, cl.r * 4.2, cl.r * 4.2);

  // Hour hand
  ctx.strokeStyle = '#12151c';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cl.x - Math.cos(hourAng) * (cl.r * 0.18), cl.y - Math.sin(hourAng) * (cl.r * 0.18));
  ctx.lineTo(cl.x + Math.cos(hourAng) * (cl.r * 0.56), cl.y + Math.sin(hourAng) * (cl.r * 0.56));
  ctx.stroke();

  // Minute hand
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cl.x - Math.cos(minAng) * (cl.r * 0.2), cl.y - Math.sin(minAng) * (cl.r * 0.2));
  ctx.lineTo(cl.x + Math.cos(minAng) * (cl.r * 0.8), cl.y + Math.sin(minAng) * (cl.r * 0.8));
  ctx.stroke();

  // Iconic SBB red lollipop second hand
  const tipDist = cl.r * 0.68;
  const tipX = cl.x + Math.cos(secAng) * tipDist;
  const tipY = cl.y + Math.sin(secAng) * tipDist;
  ctx.strokeStyle = '#c92a2a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cl.x - Math.cos(secAng) * (cl.r * 0.24), cl.y - Math.sin(secAng) * (cl.r * 0.24));
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = '#d63030';
  ctx.beginPath();
  ctx.arc(tipX, tipY, Math.max(1.8, cl.r * 0.11), 0, Math.PI * 2);
  ctx.fill();

  // Center pin
  ctx.fillStyle = '#c92a2a';
  ctx.beginPath();
  ctx.arc(cl.x, cl.y, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Level 1 (index 1): Olten SBB Gleis 0 (Solothurn)
// Brushed SBB transit concrete, cobalt signage, split-flap boards, sodium lamps
// ---------------------------------------------------------------------------

function buildOltenStatic(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    lamps: [],
    signals: [],
    boardX: Math.floor(rngRange(rng, 44, w - 124)),
    boardY: 36,
    clockX: Math.floor(rngRange(rng, w * 0.25, w * 0.75)),
    clockY: 42,
    freightPhase: rngRange(rng, 0, 12),
  };

  for (let i = 0; i < 4; i++) {
    meta.lamps.push({
      x: Math.floor(((i + 0.5) / 4) * w + rngRange(rng, -10, 10)),
      y: 22,
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }
  for (let i = 0; i < 2; i++) {
    meta.signals.push({
      x: i === 0 ? 22 : w - 24,
      y: Math.floor(rngRange(rng, 58, 92)),
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }

  if (!ctx) return meta;

  // Deep SBB transit slate concrete
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a0d11');
  bg.addColorStop(0.5, '#151a20');
  bg.addColorStop(1, '#0c0f13');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Overhead steel railway truss beams
  ctx.fillStyle = '#1d242b';
  ctx.fillRect(0, 0, w, 20);
  ctx.fillStyle = '#2d3640';
  ctx.fillRect(0, 19, w, 2);
  for (let gx = 0; gx < w; gx += 28) {
    ctx.strokeStyle = '#242c34';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, 2);
    ctx.lineTo(gx + 14, 18);
    ctx.lineTo(gx + 28, 2);
    ctx.stroke();
  }

  // Brushed concrete station wall columns & SBB cobalt fascia stripe
  for (let x = 0; x < w; x += 48) {
    ctx.fillStyle = '#181e24';
    ctx.fillRect(x + 2, 22, 44, h - 48);
    ctx.fillStyle = '#242b33';
    ctx.fillRect(x, 22, 4, h - 48);
  }
  // Iconic SBB cobalt blue platform band
  ctx.fillStyle = '#132e54';
  ctx.fillRect(0, 26, w, 8);
  ctx.fillStyle = '#1e467a';
  ctx.fillRect(0, 27, w, 5);
  ctx.fillStyle = '#c8d4e3';
  ctx.fillRect(14, 29, 26, 1);
  ctx.fillRect(w - 42, 29, 24, 1);

  // Recessed nocturnal track tunnel arch behind platform
  const archY = Math.floor(h * 0.62);
  ctx.fillStyle = '#090c10';
  ctx.fillRect(0, archY, w, h - archY - 18);
  // Rails & sleepers silhouette
  ctx.fillStyle = '#272f38';
  ctx.fillRect(0, h - 24, w, 2);
  ctx.fillRect(0, h - 20, w, 1);
  for (let sx = 6; sx < w; sx += 16) {
    ctx.fillStyle = '#171c22';
    ctx.fillRect(sx, h - 22, 8, 3);
  }

  // Split-flap SBB departure board
  const bx = meta.boardX;
  const by = meta.boardY;
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(bx, by, 76, 36);
  ctx.strokeStyle = '#1e467a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, 75, 35);
  ctx.fillStyle = '#1e467a';
  ctx.fillRect(bx + 1, by + 1, 74, 7);
  for (let row = 0; row < 4; row++) {
    ctx.fillStyle = '#141c27';
    ctx.fillRect(bx + 3, by + 10 + row * 6, 70, 4);
  }

  // Suspended white-faced SBB clock housing (offset from board)
  const cx = Math.abs(meta.clockX - (bx + 38)) < 54 ? (bx > w / 2 ? 56 : w - 56) : meta.clockX;
  meta.clockX = cx;
  ctx.fillStyle = '#2b323b';
  ctx.fillRect(cx - 1, 20, 2, meta.clockY - 20);
  ctx.fillStyle = '#404852';
  ctx.beginPath();
  ctx.arc(cx, meta.clockY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8dce0';
  ctx.beginPath();
  ctx.arc(cx, meta.clockY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  // Static hands at ~23:06
  ctx.strokeStyle = '#161a20';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, meta.clockY);
  ctx.lineTo(cx - 2.5, meta.clockY - 3.5);
  ctx.moveTo(cx, meta.clockY);
  ctx.lineTo(cx + 3.2, meta.clockY - 4.8);
  ctx.stroke();

  // Sodium work-lamp hoods
  for (const l of meta.lamps) {
    ctx.fillStyle = '#313840';
    ctx.fillRect(l.x - 6, l.y - 3, 12, 3);
    ctx.fillStyle = '#c48d32';
    ctx.fillRect(l.x - 4, l.y, 8, 2);
  }

  // Signal masts
  for (const s of meta.signals) {
    ctx.fillStyle = '#1f252c';
    ctx.fillRect(s.x - 3, s.y - 8, 6, 18);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(s.x - 2, s.y - 6, 4, 14);
  }

  drawVignette(ctx, w, h, 0.44);
  return meta;
}

function drawOltenDynamic(ctx, w, h, t, meta) {
  // Warm ochre sodium lamp cones
  for (const l of meta.lamps) {
    const hum = 0.88 + 0.08 * Math.sin(t * 3.1 + l.phase);
    const g = ctx.createRadialGradient(l.x, l.y + 3, 2, l.x, l.y + 24, 58);
    g.addColorStop(0, `rgba(212, 154, 56, ${(0.16 * hum).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(170, 114, 38, ${(0.06 * hum).toFixed(3)})`);
    g.addColorStop(1, 'rgba(170, 114, 38, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 58, l.y, 116, 86);
  }

  // Flickering split-flap departure text bars
  for (let row = 0; row < 4; row++) {
    const flip = Math.sin(t * 2.2 + row * 1.9) > 0.86;
    ctx.fillStyle = flip ? 'rgba(240, 210, 120, 0.52)' : 'rgba(212, 154, 56, 0.34)';
    const barW = 24 + ((row * 17) % 30);
    ctx.fillRect(meta.boardX + 5, meta.boardY + 11 + row * 6, barW, 2);
    ctx.fillStyle = 'rgba(200, 216, 232, 0.36)';
    ctx.fillRect(meta.boardX + 56, meta.boardY + 11 + row * 6, 12, 2);
  }

  // Animated red SBB lollipop second hand on background clock
  const sec = (t % 60);
  const sbbFrac = sec < 58.5 ? sec / 58.5 : 0;
  const ang = sbbFrac * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#c9242b';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(meta.clockX, meta.clockY);
  ctx.lineTo(meta.clockX + Math.cos(ang) * 5.8, meta.clockY + Math.sin(ang) * 5.8);
  ctx.stroke();

  // Pulsing red lockdown signal lamps
  for (const s of meta.signals) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.4 + s.phase);
    ctx.fillStyle = `rgba(210, 38, 46, ${(0.8 * pulse).toFixed(3)})`;
    ctx.fillRect(s.x - 1, s.y - 4, 2, 2);
    const rg = ctx.createRadialGradient(s.x, s.y - 3, 1, s.x, s.y - 3, 16);
    rg.addColorStop(0, `rgba(210, 38, 46, ${(0.22 * pulse).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(210, 38, 46, 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(s.x - 16, s.y - 19, 32, 32);
  }

  // Distant passing subterranean freight headlight sweep
  const cycle = ((t + meta.freightPhase) % 14);
  if (cycle < 3.2) {
    const fx = (cycle / 3.2) * (w + 120) - 60;
    const fg = ctx.createRadialGradient(fx, h - 34, 4, fx, h - 34, 52);
    fg.addColorStop(0, 'rgba(235, 212, 150, 0.14)');
    fg.addColorStop(1, 'rgba(235, 212, 150, 0)');
    ctx.fillStyle = fg;
    ctx.fillRect(fx - 52, h - 86, 104, 72);
  }
}

// ---------------------------------------------------------------------------
// Level 4 (index 3): Grande Dixence Dam Galleries (Valais)
// Brutalist monolithic concrete, hydro-teal penstock sumps, mineral streaks
// ---------------------------------------------------------------------------

function buildDixenceStatic(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    tubes: [],
    drips: [],
    ripples: [],
  };

  for (let i = 0; i < 3; i++) {
    meta.tubes.push({
      x: Math.floor(((i + 0.5) / 3) * w + rngRange(rng, -14, 14)),
      y: 18,
      phase: rngRange(rng, 0, 12),
    });
  }
  for (let i = 0; i < 7; i++) {
    meta.drips.push({
      x: Math.floor(rngRange(rng, 18, w - 18)),
      topY: rngInt(rng, 22, 54),
      bottomY: h - 22,
      period: rngRange(rng, 1.8, 4.4),
      phase: rngRange(rng, 0, 4.4),
    });
  }
  for (let i = 0; i < 12; i++) {
    meta.ripples.push({
      x: rngRange(rng, 10, w - 30),
      y: rngRange(rng, h - 24, h - 4),
      len: rngRange(rng, 10, 26),
      phase: rngRange(rng, 0, Math.PI * 2),
      speed: rngRange(rng, 1.0, 2.2),
    });
  }

  if (!ctx) return meta;

  // Cool damp brutalist concrete gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a1014');
  bg.addColorStop(0.55, '#131d24');
  bg.addColorStop(1, '#0b1c24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Monumental angled concrete buttress ribs (285m gravity dam interior)
  for (let rx = 10; rx < w; rx += 54) {
    ctx.fillStyle = '#19242d';
    ctx.fillRect(rx, 0, 18, h - 26);
    ctx.fillStyle = '#24333f';
    ctx.fillRect(rx, 0, 2, h - 26);
    ctx.fillStyle = '#0d141a';
    ctx.fillRect(rx + 18, 0, 3, h - 26);

    // Formwork horizontal lift seams
    ctx.fillStyle = 'rgba(8, 12, 16, 0.35)';
    for (let sy = 20; sy < h - 26; sy += 24) {
      ctx.fillRect(rx, sy, 18, 1);
    }
  }

  // Huge riveted steel penstock conduit pipe spanning background
  const pipeY = Math.floor(h * 0.46);
  ctx.fillStyle = '#142630';
  ctx.fillRect(0, pipeY - 12, w, 24);
  ctx.fillStyle = '#1e3c4a';
  ctx.fillRect(0, pipeY - 10, w, 4);
  ctx.fillStyle = '#0b161d';
  ctx.fillRect(0, pipeY + 8, w, 4);
  for (let fx = 28; fx < w; fx += 64) {
    ctx.fillStyle = '#253f4d';
    ctx.fillRect(fx, pipeY - 14, 5, 28);
    ctx.fillStyle = '#3c687c';
    ctx.fillRect(fx + 1, pipeY - 12, 1, 24);
  }

  // Weeping mineral calcite streaks down concrete
  for (let i = 0; i < 14; i++) {
    const sx = Math.floor(rngRange(rng, 8, w - 8));
    const sy = rngInt(rng, 18, 60);
    const sh = rngInt(rng, 32, 90);
    ctx.fillStyle = 'rgba(130, 164, 176, 0.08)';
    ctx.fillRect(sx, sy, rngInt(rng, 1, 3), sh);
  }

  // Stenciled elevation gauge strip (2140M / 2210M aesthetic)
  const gx = Math.floor(rngRange(rng, 34, w - 58));
  ctx.fillStyle = 'rgba(32, 74, 88, 0.48)';
  ctx.fillRect(gx, 36, 18, 56);
  ctx.fillStyle = 'rgba(120, 198, 214, 0.32)';
  for (let gy = 40; gy < 88; gy += 8) {
    ctx.fillRect(gx + 2, gy, gy % 16 === 0 ? 12 : 6, 1);
  }

  // Deep hydro-teal sump water along bottom
  const sumpG = ctx.createLinearGradient(0, h - 28, 0, h);
  sumpG.addColorStop(0, '#0f303c');
  sumpG.addColorStop(1, '#081b22');
  ctx.fillStyle = sumpG;
  ctx.fillRect(0, h - 26, w, 26);
  ctx.fillStyle = '#286e80';
  ctx.fillRect(0, h - 26, w, 1);

  // Cool fluorescent fixtures
  for (const tb of meta.tubes) {
    ctx.fillStyle = '#26343e';
    ctx.fillRect(tb.x - 14, tb.y - 3, 28, 3);
    ctx.fillStyle = '#5c9eb0';
    ctx.fillRect(tb.x - 11, tb.y, 22, 2);
  }

  drawVignette(ctx, w, h, 0.42);
  return meta;
}

function drawDixenceDynamic(ctx, w, h, t, meta) {
  // Cool hydro-fluorescent light cones
  for (const tb of meta.tubes) {
    const buzz = 0.88 + 0.07 * Math.sin(t * 2.8 + tb.phase);
    const g = ctx.createRadialGradient(tb.x, tb.y + 4, 3, tb.x, tb.y + 30, 68);
    g.addColorStop(0, `rgba(110, 206, 224, ${(0.14 * buzz).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(48, 130, 152, ${(0.06 * buzz).toFixed(3)})`);
    g.addColorStop(1, 'rgba(48, 130, 152, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(tb.x - 68, tb.y, 136, 98);
  }

  // Falling seepage droplets into penstock sump
  for (const d of meta.drips) {
    const phase = ((t + d.phase) % d.period) / d.period;
    if (phase < 0.4) {
      const p = phase / 0.4;
      const dy = d.topY + p * p * (d.bottomY - d.topY);
      ctx.fillStyle = 'rgba(130, 218, 232, 0.36)';
      ctx.fillRect(d.x, Math.floor(dy), 1, 3);
    } else if (phase < 0.5) {
      const r = Math.floor(((phase - 0.4) / 0.1) * 5);
      ctx.fillStyle = 'rgba(110, 210, 226, 0.28)';
      ctx.fillRect(d.x - r, d.bottomY, 1, 1);
      ctx.fillRect(d.x + r, d.bottomY, 1, 1);
    }
  }

  // Shimmering hydro-teal sump water ripples
  for (const r of meta.ripples) {
    const shift = Math.sin(t * r.speed + r.phase) * 4;
    const a = 0.12 + 0.1 * Math.sin(t * r.speed * 1.3 + r.phase);
    ctx.fillStyle = `rgba(88, 204, 222, ${a.toFixed(3)})`;
    ctx.fillRect(Math.floor(r.x + shift), Math.floor(r.y), Math.floor(r.len), 1);
  }
}

// ---------------------------------------------------------------------------
// Level 5 (index 4): Chateau de Chillon Viaduct Vaults (Montreux, Vaud)
// Savoyard limestone arches fused under 1960s A9 motorway piers + moonlit Lac Leman
// ---------------------------------------------------------------------------

function buildChillonStatic(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    slits: [],
    sconces: [],
    motes: [],
  };

  const archCount = 3;
  const archW = Math.floor(w / archCount);
  for (let i = 0; i < archCount; i++) {
    const cx = i * archW + Math.floor(archW * 0.5);
    meta.slits.push({
      x: cx,
      y: 44,
      w: 14,
      h: 64,
      phase: rngRange(rng, 0, Math.PI * 2),
    });
    meta.sconces.push({
      x: i * archW + 14,
      y: 56,
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }
  for (let i = 0; i < 14; i++) {
    meta.motes.push({
      x: rngRange(rng, 0, w),
      y: rngRange(rng, 24, h - 20),
      vx: rngRange(rng, 1.0, 2.8) * (rng() > 0.5 ? 1 : -1),
      vy: rngRange(rng, -1.2, -0.3),
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }

  if (!ctx) return meta;

  // Warm medieval limestone bedrock base
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#12100d');
  bg.addColorStop(0.5, '#1e1a15');
  bg.addColorStop(1, '#14120f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 1960s A9 motorway concrete viaduct slab bolted straight onto the castle ceiling!
  ctx.fillStyle = '#2a2e32';
  ctx.fillRect(0, 0, w, 20);
  ctx.fillStyle = '#3b4147';
  ctx.fillRect(0, 18, w, 2);
  // Concrete pier brackets
  for (let px = 22; px < w; px += 92) {
    ctx.fillStyle = '#21262b';
    ctx.fillRect(px, 14, 24, 14);
    ctx.fillStyle = '#183c42'; // riveted turquoise hydro-bulkhead collar
    ctx.fillRect(px - 2, 26, 28, 4);
  }

  // Dressed Savoyard limestone ashlar blocks
  for (let y = 26; y < h; y += 14) {
    const off = ((y / 14) % 2) * 14;
    for (let x = -off; x < w; x += 28) {
      const shade = rng();
      ctx.fillStyle = shade > 0.65 ? '#2b251e' : shade > 0.3 ? '#231e18' : '#1b1712';
      ctx.fillRect(x + 1, y + 1, 26, 12);
    }
  }

  // Romanesque gothic stone arches framing tall arrow-slit windows onto Lac Leman
  for (const slit of meta.slits) {
    // Vaulted recess
    ctx.fillStyle = '#16130f';
    ctx.beginPath();
    ctx.arc(slit.x, slit.y + 18, 36, Math.PI, 0);
    ctx.lineTo(slit.x + 36, h - 18);
    ctx.lineTo(slit.x - 36, h - 18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#3e362c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(slit.x, slit.y + 18, 36, Math.PI, 0);
    ctx.stroke();

    // Tall narrow castle window opening onto moonlit Lake Geneva!
    const wx = slit.x - Math.floor(slit.w / 2);
    const lakeG = ctx.createLinearGradient(0, slit.y, 0, slit.y + slit.h);
    lakeG.addColorStop(0, '#0d1b33');
    lakeG.addColorStop(0.55, '#193257');
    lakeG.addColorStop(1, '#122640');
    ctx.fillStyle = lakeG;
    ctx.fillRect(wx, slit.y, slit.w, slit.h);
    // Distant Savoy Alps silhouette across the lake
    ctx.fillStyle = '#0c1526';
    ctx.fillRect(wx, slit.y + 24, slit.w, 8);
    // Stone mullion rim
    ctx.strokeStyle = '#4f4539';
    ctx.lineWidth = 1;
    ctx.strokeRect(wx - 0.5, slit.y - 0.5, slit.w + 1, slit.h + 1);
  }

  // Riveted turquoise Romandie fiber-optic trunk & hydro conduit running across stone pillars
  ctx.fillStyle = '#1d444a';
  ctx.fillRect(0, h - 38, w, 6);
  ctx.fillStyle = '#2d6870';
  ctx.fillRect(0, h - 38, w, 2);
  for (let bx = 18; bx < w; bx += 42) {
    ctx.fillStyle = '#3d828c';
    ctx.fillRect(bx, h - 39, 3, 8);
  }

  drawVignette(ctx, w, h, 0.44);
  return meta;
}

function drawChillonDynamic(ctx, w, h, t, meta) {
  // Moonlit silver Lac Leman ripples shimmering inside arrow slits
  for (const slit of meta.slits) {
    const wx = slit.x - Math.floor(slit.w / 2) + 2;
    for (let r = 0; r < 4; r++) {
      const ry = slit.y + 36 + r * 6;
      const a = 0.22 + 0.18 * Math.sin(t * 2.4 + slit.phase + r * 1.2);
      ctx.fillStyle = `rgba(195, 224, 255, ${a.toFixed(3)})`;
      ctx.fillRect(wx + (r % 2), ry, slit.w - 5, 1);
    }
    // Soft moonlight shaft angling onto dungeon floor
    const mg = ctx.createLinearGradient(slit.x, slit.y + 10, slit.x + 14, slit.y + slit.h + 30);
    mg.addColorStop(0, 'rgba(140, 185, 235, 0.09)');
    mg.addColorStop(1, 'rgba(140, 185, 235, 0)');
    ctx.fillStyle = mg;
    ctx.fillRect(slit.x - 10, slit.y + 10, 26, slit.h + 24);
  }

  // Warm medieval sconce flicker
  for (const s of meta.sconces) {
    const fl = 0.85 + 0.12 * Math.sin(t * 5.2 + s.phase);
    const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 34 * fl);
    g.addColorStop(0, `rgba(220, 152, 74, ${(0.15 * fl).toFixed(3)})`);
    g.addColorStop(1, 'rgba(220, 152, 74, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x - 36, s.y - 36, 72, 72);
  }

  // Drifting limestone dust motes
  for (const m of meta.motes) {
    const mx = ((m.x + t * m.vx) % w + w) % w;
    const my = ((m.y + t * m.vy) % (h - 24) + (h - 24)) % (h - 24) + 12;
    ctx.fillStyle = 'rgba(205, 190, 165, 0.16)';
    ctx.fillRect(Math.floor(mx), Math.floor(my), 1, 1);
  }
}

// ---------------------------------------------------------------------------
// Level 7 (index 6): Bundeshaus Sub-Archives & Federal Mint (Bern)
// Bernese green-gold sandstone arches, rolling archive racks, brass pneumatic tubes
// ---------------------------------------------------------------------------

function buildBundeshausStatic(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    lamps: [],
    capsules: [],
    tubeY: 28,
  };

  for (let i = 0; i < 4; i++) {
    meta.lamps.push({
      x: Math.floor(((i + 0.5) / 4) * w),
      y: 44,
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }
  for (let i = 0; i < 2; i++) {
    meta.capsules.push({
      speed: rngRange(rng, 44, 68) * (i % 2 === 0 ? 1 : -1),
      phase: rngRange(rng, 0, 10),
    });
  }

  if (!ctx) return meta;

  // Warm Bernese green-gold sandstone backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0e110c');
  bg.addColorStop(0.5, '#191e15');
  bg.addColorStop(1, '#10140e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Sandstone Federal Palace basement vaults
  for (let ax = 0; ax < w; ax += 64) {
    ctx.fillStyle = '#20261b';
    ctx.fillRect(ax + 4, 20, 56, h - 40);
    ctx.fillStyle = '#2d3426';
    ctx.fillRect(ax, 20, 6, h - 40);
    ctx.fillStyle = '#3d4634';
    ctx.fillRect(ax + 1, 20, 1, h - 40);
  }

  // Towering steel rolling archive shelves packed with cantonal ledger binders
  for (let rx = 10; rx < w - 10; rx += 64) {
    ctx.fillStyle = '#121611';
    ctx.fillRect(rx, 46, 48, h - 70);
    ctx.strokeStyle = '#384031';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 0.5, 46.5, 47, h - 71);
    for (let sy = 56; sy < h - 28; sy += 14) {
      ctx.fillStyle = '#2c3328';
      ctx.fillRect(rx + 2, sy, 44, 2);
      // Colored federal binder spines
      for (let bx = rx + 4; bx < rx + 44; bx += 5) {
        const pick = rng();
        ctx.fillStyle = pick > 0.72 ? '#5c2824' : pick > 0.42 ? '#2b4734' : '#4a432c';
        ctx.fillRect(bx, sy - 10, 3, 9);
      }
    }
  }

  // Gleaming brass pneumatic mail tube running across upper archive
  ctx.fillStyle = '#5e4b22';
  ctx.fillRect(0, meta.tubeY, w, 6);
  ctx.fillStyle = '#9e803c';
  ctx.fillRect(0, meta.tubeY + 1, w, 2);
  for (let jx = 32; jx < w; jx += 64) {
    ctx.fillStyle = '#7d632c';
    ctx.fillRect(jx, meta.tubeY - 1, 4, 8);
  }

  // Green-shaded federal accountant lamps
  for (const l of meta.lamps) {
    ctx.fillStyle = '#6e5728';
    ctx.fillRect(l.x - 1, 34, 2, 10);
    ctx.fillStyle = '#1d5438';
    ctx.fillRect(l.x - 6, l.y, 12, 4);
    ctx.fillStyle = '#328258';
    ctx.fillRect(l.x - 5, l.y, 10, 1);
  }

  // Red-and-white heraldic Mint baseboard trim
  ctx.fillStyle = '#151912';
  ctx.fillRect(0, h - 22, w, 22);
  ctx.fillStyle = '#6b2424';
  ctx.fillRect(0, h - 22, w, 2);

  drawVignette(ctx, w, h, 0.44);
  return meta;
}

function drawBundeshausDynamic(ctx, w, h, t, meta) {
  // Green-shaded accountant lamp warm-emerald pools
  for (const l of meta.lamps) {
    const fl = 0.9 + 0.08 * Math.sin(t * 2.1 + l.phase);
    const g = ctx.createRadialGradient(l.x, l.y + 6, 2, l.x, l.y + 22, 46);
    g.addColorStop(0, `rgba(110, 210, 145, ${(0.14 * fl).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(195, 175, 95, ${(0.06 * fl).toFixed(3)})`);
    g.addColorStop(1, 'rgba(110, 210, 145, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 46, l.y, 92, 74);
  }

  // Occasional bright brass pneumatic mail capsules zipping overhead
  for (const c of meta.capsules) {
    const span = w + 180;
    const raw = ((t * c.speed + c.phase * 40) % span + span) % span;
    const cx = raw - 90;
    if (cx > -12 && cx < w + 12) {
      ctx.fillStyle = 'rgba(242, 214, 128, 0.65)';
      ctx.fillRect(Math.floor(cx), meta.tubeY + 1, 10, 3);
      ctx.fillStyle = 'rgba(255, 245, 200, 0.45)';
      ctx.fillRect(Math.floor(cx + 2), meta.tubeY + 2, 6, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Level 8 (index 7): Eigerwand North-Face Gallery (Jungfraubahn, 2,865m)
// Jagged black-slate alpine rock, iron rack rails, panoramic blizzard cliff windows
// ---------------------------------------------------------------------------

function buildEigerwandStatic(ctx, w, h, seed) {
  const rng = createRng(seed);
  const meta = {
    windows: [],
    snow: [],
    stars: [],
    valleyLights: [],
  };

  // Two large carved North Face panoramic cliff windows
  meta.windows.push({ x: 34, y: 24, w: 122, h: 96 });
  meta.windows.push({ x: 214, y: 24, w: 132, h: 96 });

  for (let i = 0; i < 36; i++) {
    meta.snow.push({
      x: rngRange(rng, 0, w),
      y: rngRange(rng, 18, h - 18),
      vx: rngRange(rng, 45, 95),
      vy: rngRange(rng, 8, 22),
      len: rngInt(rng, 3, 7),
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }
  for (let i = 0; i < 24; i++) {
    meta.stars.push({
      x: Math.floor(rngRange(rng, 36, w - 36)),
      y: Math.floor(rngRange(rng, 26, 66)),
      phase: rngRange(rng, 0, Math.PI * 2),
    });
  }
  for (let i = 0; i < 14; i++) {
    meta.valleyLights.push({
      x: Math.floor(rngRange(rng, 42, w - 42)),
      y: Math.floor(rngRange(rng, 98, 116)),
      warm: rng() > 0.3,
    });
  }

  if (!ctx) return meta;

  // Jagged black-slate Eiger rock interior
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a0d14');
  bg.addColorStop(0.5, '#141822');
  bg.addColorStop(1, '#0c0f17');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Rough-hewn rock facets
  for (let y = 0; y < h; y += 22) {
    for (let x = 0; x < w; x += 30) {
      const v = rng();
      ctx.fillStyle = v > 0.65 ? '#1c212e' : v > 0.3 ? '#151924' : '#0f121b';
      ctx.fillRect(x, y, 28, 20);
    }
  }

  // Huge panoramic North Face cliff windows opening onto 1,800m moonlit drop over Grindelwald
  for (const win of meta.windows) {
    const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
    sky.addColorStop(0, '#070e1f');
    sky.addColorStop(0.65, '#11203d');
    sky.addColorStop(1, '#0a1426');
    ctx.fillStyle = sky;
    ctx.fillRect(win.x, win.y, win.w, win.h);

    // Distant moonlit Oberland ridge silhouette
    ctx.fillStyle = '#0a1220';
    ctx.beginPath();
    ctx.moveTo(win.x, win.y + win.h);
    ctx.lineTo(win.x + 24, win.y + 58);
    ctx.lineTo(win.x + 56, win.y + 72);
    ctx.lineTo(win.x + 92, win.y + 50);
    ctx.lineTo(win.x + win.w, win.y + 68);
    ctx.lineTo(win.x + win.w, win.y + win.h);
    ctx.closePath();
    ctx.fill();

    // Frost-rimmed steel & brass window frame
    ctx.strokeStyle = '#4e5970';
    ctx.lineWidth = 2;
    ctx.strokeRect(win.x, win.y, win.w, win.h);
    ctx.fillStyle = '#2d3545';
    ctx.fillRect(win.x + Math.floor(win.w / 2) - 2, win.y, 4, win.h);
    // Frost rim highlights
    ctx.fillStyle = 'rgba(200, 232, 255, 0.35)';
    ctx.fillRect(win.x + 2, win.y + win.h - 3, win.w - 4, 2);
  }

  // Iron Jungfraubahn cogwheel rack-rail along lower gallery
  ctx.fillStyle = '#1f2533';
  ctx.fillRect(0, h - 26, w, 6);
  ctx.fillStyle = '#3b4459';
  for (let tx = 4; tx < w; tx += 8) {
    ctx.fillRect(tx, h - 28, 4, 2);
  }

  // Frost-rimmed brass Eigerwand station plaque between windows
  ctx.fillStyle = '#1c2330';
  ctx.fillRect(166, 46, 38, 16);
  ctx.strokeStyle = '#9c8346';
  ctx.lineWidth = 1;
  ctx.strokeRect(166.5, 46.5, 37, 15);
  ctx.fillStyle = '#d4c8a6';
  ctx.fillRect(172, 51, 26, 2);
  ctx.fillStyle = '#7e90ad';
  ctx.fillRect(176, 56, 18, 1);

  drawVignette(ctx, w, h, 0.42);
  return meta;
}

function drawEigerwandDynamic(ctx, w, h, t, meta) {
  // Clip starry abyss + distant Grindelwald lights + blowing snow streaks to windows
  for (const win of meta.windows) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x + 1, win.y + 1, win.w - 2, win.h - 2);
    ctx.clip();

    // Twinkling stars high over the North Face
    for (const s of meta.stars) {
      if (s.x < win.x || s.x > win.x + win.w) continue;
      const a = 0.25 + 0.35 * Math.sin(t * 2.2 + s.phase);
      ctx.fillStyle = `rgba(215, 232, 255, ${a.toFixed(3)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }

    // Distant Grindelwald valley lights 1,800m below
    for (const vl of meta.valleyLights) {
      if (vl.x < win.x || vl.x > win.x + win.w) continue;
      ctx.fillStyle = vl.warm ? 'rgba(240, 198, 118, 0.42)' : 'rgba(170, 206, 245, 0.36)';
      ctx.fillRect(vl.x, vl.y, 1, 1);
    }

    // Horizontal blowing blizzard snow streaks
    for (const sn of meta.snow) {
      const sx = ((sn.x + t * sn.vx) % (win.w + 20) + (win.w + 20)) % (win.w + 20) + win.x - 10;
      const sy = ((sn.y + t * sn.vy) % win.h + win.h) % win.h + win.y;
      ctx.fillStyle = 'rgba(210, 235, 255, 0.35)';
      ctx.fillRect(Math.floor(sx), Math.floor(sy), sn.len, 1);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const LEVEL_BUILDERS = [
  buildLevel0Static,     // 0: Paradeplatz Vaults (Zurich)
  buildOltenStatic,      // 1: Olten SBB Gleis 0 (Solothurn)
  buildLevel1Static,     // 2: Gotthard Reduit Fortress (Uri/Ticino)
  buildDixenceStatic,    // 3: Grande Dixence Dam Galleries (Valais)
  buildChillonStatic,    // 4: Chateau de Chillon Viaduct Vaults (Vaud)
  buildLevel2Static,     // 5: CERN Ring Sector 4 (Geneva)
  buildBundeshausStatic, // 6: Bundeshaus Sub-Archives & Mint (Bern)
  buildEigerwandStatic,  // 7: Eigerwand North-Face Gallery (Oberland)
  buildLevel3Static,     // 8: Jungfraujoch Ice Palace (Glacier)
  buildLevel4Static,     // 9: Sphinx Observatory Summit (3,571m)
];

const LEVEL_DYNAMICS = [
  drawLevel0Dynamic,
  drawOltenDynamic,
  drawLevel1Dynamic,
  drawDixenceDynamic,
  drawChillonDynamic,
  drawLevel2Dynamic,
  drawBundeshausDynamic,
  drawEigerwandDynamic,
  drawLevel3Dynamic,
  drawLevel4Dynamic,
];

/**
 * Draws a deterministic, subtly animated procedural backdrop for a room.
 * Static layers are cached per (levelIndex, roomSeed, w, h).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} levelIndex - 0..9 across Switzerland
 * @param {number} w - Canvas width (e.g. 384)
 * @param {number} h - Canvas height (e.g. 216)
 * @param {number} t - Elapsed time in seconds
 * @param {number|string} [roomSeed=0] - Deterministic room seed
 */
export function drawBackdrop(ctx, levelIndex, w, h, t = 0, roomSeed = 0) {
  if (!ctx || w <= 0 || h <= 0) return;
  const count = LEVEL_BUILDERS.length;
  const lvl = ((Math.floor(Number(levelIndex) || 0) % count) + count) % count;
  const time = Number.isFinite(t) ? t : 0;
  const scale = getContextScale(ctx);
  const seedHash = hashSeed(lvl, roomSeed);
  const cacheKey = `lvl:${lvl}:${seedHash}:${w}x${h}@${scale}`;

  const entry = getCachedLayer(cacheKey, w, h, scale, (offCtx, cw, ch) =>
    LEVEL_BUILDERS[lvl](offCtx, cw, ch, seedHash)
  );

  ctx.save();
  if (entry.canvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(entry.canvas, 0, 0, w, h);
  } else {
    LEVEL_BUILDERS[lvl](ctx, w, h, seedHash);
  }
  LEVEL_DYNAMICS[lvl](ctx, w, h, time, entry.meta);
  ctx.restore();
}

/**
 * Draws the Zurich dusk skyline title backdrop (Grossmuenster, Lake Zurich,
 * Alps silhouette, and an animated SBB Swiss railway station clock).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width (e.g. 384)
 * @param {number} h - Canvas height (e.g. 216)
 * @param {number} t - Elapsed time in seconds
 */
export function drawTitleBackdrop(ctx, w, h, t = 0, opts = {}) {
  if (!ctx || w <= 0 || h <= 0) return;
  const showClock = opts.showClock !== false;
  const time = Number.isFinite(t) ? t : 0;
  const scale = getContextScale(ctx);
  const cacheKey = `title:${showClock ? 'clk' : 'noclk'}:${w}x${h}@${scale}`;

  const entry = getCachedLayer(cacheKey, w, h, scale, (offCtx, cw, ch) =>
    buildTitleStatic(offCtx, cw, ch, showClock)
  );

  ctx.save();
  if (entry.canvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(entry.canvas, 0, 0, w, h);
  } else {
    buildTitleStatic(ctx, w, h, showClock);
  }
  drawTitleDynamic(ctx, w, h, time, entry.meta, showClock);
  ctx.restore();
}
