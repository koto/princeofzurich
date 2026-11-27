#!/usr/bin/env node
// tools/combat-sim.mjs
// Headless sword-combat benchmark driving the REAL Game / Player / Enemy / LevelState / Input
// classes with three scripted players:
//   - 'masher': closes distance and spams Shift (strike), never parries
//   - 'turtle': engages and only parries (Up), never strikes
//   - 'fencer': manages spacing, reacts to observable telegraphs with human-like delay,
//               parries & ripostes, punishes whiffs/recovery, avoids retreating into hazards
//
// Usage:
//   node tools/combat-sim.mjs            (default: 50 trials per matchup)
//   node tools/combat-sim.mjs --trials 60

import { Sim, DT } from './sim.mjs';
import { COLS, colOfX } from '../src/level.js';

const args = process.argv.slice(2);
const trialsIdx = args.indexOf('--trials');
const TRIALS = trialsIdx >= 0 ? Math.max(5, parseInt(args[trialsIdx + 1], 10) || 50) : 50;
const MAX_DUEL_SECONDS = 40;
const MAX_FRAMES = Math.round(MAX_DUEL_SECONDS / DT);

// Representative encounters spanning every guard tier and the final boss.
// Each entry pulls the REAL room & enemy definition from LEVELS.
export const ENCOUNTERS = [
  { id: 'T1_tut',    label: 'L1 R6 Herr Kuster (Tut)',   levelIdx: 0, roomId: 6, startCol: 4, maxHp: 3 },
  { id: 'T1_cap',    label: 'L1 R7 Meister Baer',        levelIdx: 0, roomId: 7, startCol: 3, maxHp: 3 },
  { id: 'T2_ruedi',  label: 'L2 R3 Olten Ruedi',         levelIdx: 1, roomId: 3, startCol: 4, maxHp: 4 },
  { id: 'T3_corp',   label: 'L3 R5 Reduit Corporal',     levelIdx: 2, roomId: 5, startCol: 3, maxHp: 4 },
  { id: 'T3_major',  label: 'L3 R7 Maj. Tobler (^)',     levelIdx: 2, roomId: 7, startCol: 3, maxHp: 4 },
  { id: 'T4_rochat', label: 'L4 R7 M. Rochat',           levelIdx: 3, roomId: 7, startCol: 3, maxHp: 4 },
  { id: 'T5_favre',  label: 'L5 R6 D. Favre (Chillon)',  levelIdx: 4, roomId: 6, startCol: 1, maxHp: 4 },
  { id: 'T6_warden', label: 'L6 R7 Safety Warden',       levelIdx: 5, roomId: 7, startCol: 4, maxHp: 4 },
  { id: 'T7_arch',   label: 'L7 R7 Archive Guard',       levelIdx: 6, roomId: 7, startCol: 3, maxHp: 5 },
  { id: 'T8_blaser', label: 'L8 R6 W. Blaser (Wind)',    levelIdx: 7, roomId: 6, startCol: 3, maxHp: 5 },
  { id: 'T9_alpine', label: 'L9 R3 Ice Sentry (Ice)',    levelIdx: 8, roomId: 3, startCol: 4, maxHp: 5 },
  { id: 'T9_glac',   label: 'L9 R7 Glacier Capt (Ice)',  levelIdx: 8, roomId: 7, startCol: 3, maxHp: 5 },
  { id: 'T10_body',  label: 'L10 R2 Zins Bodyguard',     levelIdx: 9, roomId: 2, startCol: 5, maxHp: 5 },
  { id: 'T10_chief', label: 'L10 R4 Chief of Sec (L.)',  levelIdx: 9, roomId: 4, startCol: 3, maxHp: 5 },
  { id: 'BOSS_zins', label: 'L10 R6 Dr. Viktor Zins',    levelIdx: 9, roomId: 6, startCol: 4, maxHp: 5 },
];

// Synthetic pair-pressure arena (tests multi-guard coordination without altering level layouts)
const PAIR_ARENA = {
  id: 0,
  name: 'Pair Arena',
  subtitle: '',
  ice: false,
  start: { room: 0, col: 3, row: 2, facing: 1, hasSword: true },
  rooms: {
    0: {
      links: { left: null, right: null, up: null, down: null },
      grid: ['############', '#..........#', '#__________#', '############'],
      enemies: [
        { col: 7, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2, archetype: 'brawler', name: 'Vanguard' },
        { col: 9, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2, archetype: 'sentry', name: 'Flanker' },
      ],
    },
  },
};

// Deterministic local PRNG for bot reaction jitter (does NOT perturb Math.random used by Enemy AI)
function makeBotRng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isSafeStep(sim, dir, stepPx = 15) {
  const p = sim.p;
  const nx = p.x + dir * stepPx;
  if (nx < 16 || nx > 384 - 16) return false;
  const nc = colOfX(nx);
  if (nc < 0 || nc >= COLS) return false;
  if (sim.level.isWall(p.roomId, nc, p.row)) return false;
  if (sim.level.isGateBlocking(p.roomId, nc, p.row)) return false;
  if (!sim.level.hasFloor(p.roomId, nc, p.row)) return false;
  const ch = sim.level.getTile(p.roomId, nc, p.row);
  if (ch === '^' || ch === 'L') return false;
  return true;
}

function createBot(style, seed) {
  const rng = makeBotRng(seed + 7919);

  if (style === 'masher') {
    let strikeCadence = 0;
    return (sim, foe) => {
      const p = sim.p;
      const dist = Math.abs(foe.x - p.x);
      const dirKey = foe.x >= p.x ? 'right' : 'left';
      if (!p.swordDrawn) {
        sim.press(dirKey);
        return;
      }
      sim.release('left');
      sim.release('right');
      sim.release('up');
      sim.release('shift');
      if (dist > 35 && p.state === 'combat_idle') {
        sim.press(dirKey);
      } else {
        strikeCadence++;
        // Mash Shift rapidly (~every 3 frames)
        if (strikeCadence % 3 === 0) {
          sim.press('shift');
        }
      }
    };
  }

  if (style === 'turtle') {
    let sawStrikeFrames = 0;
    let reactFrames = 7;
    let parryCooldown = 0;
    let idleParryTimer = 0;
    let prevFoeAnim = '';
    let prevFoeAnimT = 1;
    return (sim, foe) => {
      const p = sim.p;
      const dist = Math.abs(foe.x - p.x);
      const dirKey = foe.x >= p.x ? 'right' : 'left';
      sim.release('left');
      sim.release('right');
      sim.release('up');
      sim.release('shift');

      if (!p.swordDrawn) {
        sim.press(dirKey);
        return;
      }
      if (parryCooldown > 0) parryCooldown--;

      // Step into engagement range once if far away
      if (dist > 44 && p.state === 'combat_idle') {
        sim.press(dirKey);
        return;
      }

      const newClip = foe.anim !== prevFoeAnim || foe.animT < prevFoeAnimT - 0.1;
      prevFoeAnim = foe.anim;
      prevFoeAnimT = foe.animT;
      if (newClip) sawStrikeFrames = 0;

      // React to any enemy telegraph (strikes AND feints) with parry; never strikes
      const enemyTelegraph = (foe.anim === 'combat_strike' || foe.anim === 'combat_feint') &&
        (foe.strikeTelegraph > 0 || foe.animT < 0.45);
      if (enemyTelegraph) {
        if (sawStrikeFrames === 0) {
          reactFrames = 6 + Math.floor(rng() * 4);
        }
        sawStrikeFrames++;
        if (sawStrikeFrames >= reactFrames && parryCooldown === 0) {
          sim.press('up');
          parryCooldown = 12;
        }
      } else {
        sawStrikeFrames = 0;
        idleParryTimer++;
        if (idleParryTimer >= 28 && p.state === 'combat_idle' && parryCooldown === 0) {
          sim.press('up');
          idleParryTimer = 0;
          parryCooldown = 16;
        }
      }
    };
  }

  // 'fencer': skilled human-like player (observable state only, realistic reaction delay)
  let sawTelegraphFrames = 0;
  let telegraphReact = 7;
  let reactedToThisClip = false;
  let fellForFeint = false;
  let actionCooldown = 0;
  let probeTimer = 26 + Math.floor(rng() * 24);
  let prevFoeAnim = '';
  let prevFoeAnimT = 1;
  let foePostStrikeWindow = 0;
  let foeWhiffReact = 0;

  return (sim, foe) => {
    const p = sim.p;
    const dist = Math.abs(foe.x - p.x);
    const towardSign = foe.x >= p.x ? 1 : -1;
    const towardKey = towardSign > 0 ? 'right' : 'left';
    const awayKey = towardSign > 0 ? 'left' : 'right';

    sim.release('left');
    sim.release('right');
    sim.release('up');
    sim.release('shift');

    if (!p.swordDrawn) {
      sim.press(towardKey);
      return;
    }

    if (actionCooldown > 0) actionCooldown--;
    if (foePostStrikeWindow > 0) foePostStrikeWindow--;

    // Detect when enemy starts a new animation clip (e.g. feint -> strike, or second swing)
    const newClip = foe.anim !== prevFoeAnim || foe.animT < prevFoeAnimT - 0.15;
    if (prevFoeAnim === 'combat_strike' && foe.anim !== 'combat_strike') {
      foePostStrikeWindow = 16;
      foeWhiffReact = 4 + Math.floor(rng() * 3);
    }
    if (newClip) {
      sawTelegraphFrames = 0;
      reactedToThisClip = false;
      // Experienced human reading distinct telegraphs (normal gold star, amber feint, crimson delayed heavy):
      // - Bites on amber feints ~40% of the time (gets caught in parry recovery!)
      // - On delayed heavy lunges (crimson glint, ~360ms windup), holds parry longer ~62% of the time,
      //   but reacts early on reflex ~38% of the time (caught as guard drops!).
      // - Normal visual+audio reaction: 150-200ms (9-12 frames), with ~15% slight late slip under pressure.
      fellForFeint = foe.anim === 'combat_feint' ? (rng() < 0.42) : false;
      const isHeavyGlint = foe.anim === 'combat_strike' && foe.strikeKind === 'heavy';
      if (isHeavyGlint && rng() < 0.56) {
        // Read the crimson heavy glint and timed parry for the delayed thrust (~430ms)
        telegraphReact = 16 + Math.floor(rng() * 6); // 267-350ms
      } else {
        const slowSlip = rng() < 0.16 ? 3 : 0;
        telegraphReact = 9 + Math.floor(rng() * 4) + slowSlip;
      }
    }
    prevFoeAnim = foe.anim;
    prevFoeAnimT = foe.animT;

    // 1. Immediate riposte after a successful parry!
    if (p.state === 'combat_parry' && p.parrySuccess && !p.riposteQueued) {
      sim.press('shift');
      actionCooldown = 8;
      return;
    }
    if (p.riposteWindow > 0.10 && p.state === 'combat_idle' && dist <= 40 && actionCooldown === 0) {
      sim.press('shift');
      actionCooldown = 10;
      return;
    }

    // 2. React to observable enemy telegraph (committed strike OR a feint we bit on!)
    const foeCommittedWindup = foe.anim === 'combat_strike' && foe.strikeTelegraph > 0;
    const foeFeintBaited = foe.anim === 'combat_feint' && foe.strikeTelegraph > 0 && fellForFeint;

    if ((foeCommittedWindup || foeFeintBaited) && dist <= 46) {
      sawTelegraphFrames++;
      if (!reactedToThisClip && sawTelegraphFrames >= telegraphReact) {
        const canParryNow =
          p.state === 'combat_idle' ||
          p.state === 'combat_advance' ||
          p.state === 'combat_retreat' ||
          (p.state === 'combat_parried' && p.stateTimer >= 0.11);

        if (canParryNow) {
          reactedToThisClip = true;
          // Occasionally step back at outer edge to force a whiff (only on non-heavy normal strikes)
          if (foe.anim === 'combat_strike' && dist >= 36 && rng() < 0.20 &&
              isSafeStep(sim, -towardSign, 16) && p.state === 'combat_idle') {
            sim.press(awayKey);
            actionCooldown = 8;
            return;
          }
          sim.press('up');
          actionCooldown = 6;
          return;
        }
      }
    }

    if (actionCooldown > 0) return;

    // 3. Punish observable whiff / enemy recovery state!
    const foeRecovering =
      foe.anim === 'combat_recover' ||
      (foe.anim === 'combat_strike' && foe.animT >= 0.78) ||
      (foePostStrikeWindow > 0 && foePostStrikeWindow <= 16 - foeWhiffReact && foe.anim !== 'combat_parry' && foe.anim !== 'combat_strike');

    if (foeRecovering && p.state === 'combat_idle') {
      if (dist <= 38) {
        sim.press('shift');
        actionCooldown = 14;
        foePostStrikeWindow = 0;
        return;
      } else if (dist <= 50 && isSafeStep(sim, towardSign, 12)) {
        sim.press(towardKey);
        actionCooldown = 7;
        return;
      }
    }

    // 4. Footwork & spacing management in combat_idle
    if (p.state === 'combat_idle') {
      if (dist > 37) {
        if (isSafeStep(sim, towardSign, 10)) {
          sim.press(towardKey);
          actionCooldown = 8;
          return;
        }
      } else if (dist < 25) {
        if (isSafeStep(sim, -towardSign, 16)) {
          sim.press(awayKey);
          actionCooldown = 8;
          return;
        }
      }

      // Patient probing strike only occasionally (never mindless spamming!)
      probeTimer--;
      if (probeTimer <= 0) {
        probeTimer = 34 + Math.floor(rng() * 30);
        if (dist <= 36 && foe.anim !== 'combat_parry' && foe.anim !== 'combat_strike') {
          sim.press('shift');
          actionCooldown = 18;
        } else if (dist <= 48 && isSafeStep(sim, towardSign, 10)) {
          sim.press(towardKey);
          actionCooldown = 9;
        }
      }
    }
  };
}

function runDuel(enc, style, trialIdx) {
  const seed = (enc.levelIdx + 1) * 10000 + enc.roomId * 100 + trialIdx * 17 + 3;
  const levelOrDef = enc.customDef || enc.levelIdx;
  const s = new Sim(levelOrDef, { god: false, maxHp: enc.maxHp, seed });
  s.p.hasSword = true;
  s.place(enc.roomId, enc.startCol, 2, { facing: 1 });

  const foes = s.game.enemies.filter((e) => e.alive && !e.nonCombat && e.roomId === enc.roomId && e.row === 2);
  if (foes.length === 0) {
    throw new Error(`No combat enemy found for ${enc.id}`);
  }

  const bot = createBot(style, seed);
  let frames = 0;

  while (frames < MAX_FRAMES) {
    // A foe knocked off the duel floor into a lower pit counts as defeated on that bridge!
    const activeFoes = foes.filter((e) => e.alive && e.roomId === enc.roomId && e.row === 2);
    if (!s.p.alive || activeFoes.length === 0) break;
    if (s.p.roomId !== enc.roomId || s.p.row !== 2) {
      s.step(120);
      break;
    }
    // Target closest living foe on the row
    let target = activeFoes[0];
    for (const f of activeFoes) {
      if (Math.abs(f.x - s.p.x) < Math.abs(target.x - s.p.x)) target = f;
    }
    bot(s, target);
    s.step(1);
    frames++;
  }

  const activeFoes = foes.filter((e) => e.alive && e.roomId === enc.roomId && e.row === 2);
  const won = s.p.alive && activeFoes.length === 0;
  const lost = !s.p.alive;
  const timeout = !won && !lost;
  const hpLost = enc.maxHp - Math.max(0, s.p.hp);
  return { won, lost, timeout, hpLost, duration: frames * DT };
}

function pad(str, n) {
  const s = String(str);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function rpad(str, n) {
  const s = String(str);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function runAll() {
  const styles = ['masher', 'turtle', 'fencer'];
  const allEncounters = [
    ...ENCOUNTERS,
    { id: 'PAIR_sim', label: 'Synthetic Pair (2 Guards)', levelIdx: 0, roomId: 0, startCol: 3, maxHp: 5, customDef: PAIR_ARENA },
  ];

  console.log(`\nPrince of Zurich — Combat Simulation (${TRIALS} trials per matchup, max ${MAX_DUEL_SECONDS}s/duel)\n`);
  const header =
    pad('Encounter', 28) + ' | ' +
    pad('Masher (Win / HP)', 19) + ' | ' +
    pad('Turtle (Win / HP)', 19) + ' | ' +
    pad('Fencer (Win / HP)', 19);
  console.log(header);
  console.log('-'.repeat(header.length));

  const results = [];
  for (const enc of allEncounters) {
    const row = { enc, stats: {} };
    for (const style of styles) {
      let wins = 0, losses = 0, timeouts = 0, hpLostAll = 0, hpLostWins = 0, durSum = 0;
      for (let t = 0; t < TRIALS; t++) {
        const res = runDuel(enc, style, t);
        if (res.won) { wins++; hpLostWins += res.hpLost; }
        else if (res.lost) losses++;
        else timeouts++;
        hpLostAll += res.hpLost;
        durSum += res.duration;
      }
      row.stats[style] = {
        winPct: (wins / TRIALS) * 100,
        lossPct: (losses / TRIALS) * 100,
        toPct: (timeouts / TRIALS) * 100,
        avgHpLost: hpLostAll / TRIALS,
        avgHpLostOnWin: wins > 0 ? hpLostWins / wins : null,
        avgDur: durSum / TRIALS,
      };
    }
    results.push(row);

    const fmt = (st) => {
      const pct = rpad(`${Math.round(st.winPct)}%`, 4);
      const hp = st.avgHpLost.toFixed(2);
      const to = st.toPct > 0 ? ` T${Math.round(st.toPct)}` : '';
      return pad(`${pct} (-${hp}hp)${to}`, 19);
    };
    console.log(
      pad(enc.label, 28) + ' | ' +
      fmt(row.stats.masher) + ' | ' +
      fmt(row.stats.turtle) + ' | ' +
      fmt(row.stats.fencer)
    );
  }
  console.log('');
  return results;
}

runAll();
