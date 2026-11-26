#!/usr/bin/env node
// tools/test-game.mjs
// Comprehensive automated test suite driving the REAL Game/Player/Enemy/LevelState
// with synthesized keyboard presses:
//  Part 1: Movement feel (stone/ice skid, run_turn, careful-step edge clamp, jumps, coyote)
//  Part 2: Combat readability & AI (windup >= 220ms, buffered parry-riposte, spacing,
//          guard room reset, Deepfake sheathe merge past 2.4s, Zins anti-jump intercept)
//  Part 3: Recovery pits & dynamic traps (L2 Room 4 & L4 Room 4 survive + climb out, proximity spikes)
//  Part 4: Full end-to-end playthrough of ALL 5 LEVELS WITHOUT GOD MODE!
// Exit code 1 on any failure.

import { Sim, Report, DT } from './sim.mjs';
import { TILE_W, floorY, tileCenterX, colOfX } from '../src/level.js';

const R = new Report('test-game');

// ---------------------------------------------------------------------------
// Movement & Combat Drivers (strictly real key presses — zero teleports in Part 4!)
// ---------------------------------------------------------------------------

function walkTo(s, roomId, targetX, { careful = false, maxFrames = 600, stopOnRowChange = true } = {}) {
  const startRow = s.p.row;
  const dir = targetX > s.p.x ? 'right' : 'left';
  // Release slightly early when running so the weighty PoP skid stops near targetX
  const skidLead = careful ? 0 : (s.level.ice ? 28 : 16);
  const stopX = dir === 'right' ? targetX - skidLead : targetX + skidLead;
  if (careful) s.press('shift');
  if ((dir === 'right' && s.p.x < stopX) || (dir === 'left' && s.p.x > stopX)) {
    s.press(dir);
    for (let i = 0; i < maxFrames; i++) {
      if (!s.p.alive || s.p.roomId !== roomId) break;
      if (stopOnRowChange && s.p.row !== startRow) break;
      if (dir === 'right' && s.p.x >= stopX) break;
      if (dir === 'left' && s.p.x <= stopX) break;
      s.step(1);
    }
    s.release(dir);
  }
  if (careful) s.release('shift');
  s.waitIdle(120);
  // Fine-tune with careful steps if needed and still on same floor
  if (!careful && s.p.alive && s.p.roomId === roomId && s.p.row === startRow && Math.abs(s.p.x - targetX) > 10) {
    const fdir = targetX > s.p.x ? 'right' : 'left';
    s.press('shift');
    s.press(fdir);
    for (let i = 0; i < 120; i++) {
      if (!s.p.alive || s.p.roomId !== roomId || s.p.row !== startRow) break;
      if (fdir === 'right' && s.p.x >= targetX - 4) break;
      if (fdir === 'left' && s.p.x <= targetX + 4) break;
      s.step(1);
    }
    s.release(fdir);
    s.release('shift');
    s.waitIdle(80);
  }
}

function dropInto(s, dir, maxFrames = 180) {
  const startRoom = s.p.roomId;
  const startRow = s.p.row;
  s.press(dir);
  s.stepUntil((q) => !q.p.alive || q.p.roomId !== startRoom || q.p.row !== startRow || !q.p.grounded, maxFrames);
  s.release(dir);
  s.stepUntil((q) => !q.p.alive || q.p.grounded, 180);
  s.waitIdle(100);
}

function crossRoom(s, dir, targetRoom, maxFrames = 400) {
  s.press(dir);
  s.stepUntil((q) => !q.p.alive || q.p.roomId === targetRoom || q.p.swordDrawn, maxFrames);
  s.release(dir);
}

function climbOnce(s, dir = null) {
  if (dir) {
    const want = dir === 'right' ? 1 : -1;
    if (s.p.facing !== want) {
      s.tap(dir, 3);
      s.waitIdle(40);
    }
  }
  s.tap('up', 5);
  s.waitIdle(180);
}

function jumpGap(s, dir, running = false, takeoffX = null) {
  if (running) {
    s.press(dir);
    if (takeoffX !== null) {
      s.stepUntil((q) => !q.p.alive || (dir === 'right' ? q.p.x >= takeoffX : q.p.x <= takeoffX), 300);
    } else {
      s.step(20);
    }
    s.tap('up', 5);
    s.stepUntil((q) => !q.p.alive || (q.p.grounded && q.p.state !== 'run_jump'), 120);
    s.release(dir);
    s.waitIdle(120);
  } else {
    // Face the jump direction cleanly first if facing away
    if ((dir === 'right' && s.p.facing < 0) || (dir === 'left' && s.p.facing > 0)) {
      s.tap(dir, 3);
      s.waitIdle(40);
    }
    s.hold([dir, 'up'], 6);
    s.waitIdle(120);
  }
}

function passShutter(s, dir, shutterCol, destX) {
  const room = s.p.roomId;
  const row = s.p.row;
  const waitX = dir === 'right' ? shutterCol * TILE_W - 14 : (shutterCol + 1) * TILE_W + 14;
  walkTo(s, room, waitX);
  // Wait for shutter to be freshly open (openness === 1 and not warning, right after reopening)
  let sawClosed = false;
  s.stepUntil((q) => {
    const st = q.level.getSlicerState(room, shutterCol, row, q.game.time);
    if (st.closed) sawClosed = true;
    return sawClosed && !st.closed && !st.warning && st.openness >= 0.99;
  }, 300);
  // Sprint right through!
  walkTo(s, room, destX);
}

function fightRoomFoe(s, maxFrames = 1400) {
  // Duel using real parry (Up) on enemy strike telegraph -> buffered riposte (Shift),
  // stepping in when out of range and finishing cleanly.
  const room = s.p.roomId;
  const row = s.p.row;
  for (let i = 0; i < maxFrames; i++) {
    if (!s.p.alive) return false;
    const foe = s.game.enemies.find((e) => e.alive && !e.nonCombat && e.roomId === room && e.row === row);
    if (!foe) {
      s.stepUntil((q) => !q.p.alive || (!q.p.swordDrawn && q.p.state === 'idle'), 120);
      return true;
    }
    // Wait until sword is drawn (walk toward foe if needed)
    if (!s.p.swordDrawn) {
      const dir = foe.x > s.p.x ? 'right' : 'left';
      s.press(dir);
      s.step(4);
      s.release(dir);
      continue;
    }
    const dist = Math.abs(foe.x - s.p.x);
    if (foe.state === 'combat_strike' && foe.stateTimer < foe.stateDur * 0.48) {
      // Enemy telegraphed a strike! Parry with Up, then queue Shift riposte!
      s.tap('up', 4);
      s.step(8);
      s.tap('shift', 4);
      s.step(20);
    } else if (dist > 33 && s.p.state === 'combat_idle') {
      const dir = foe.x > s.p.x ? 'right' : 'left';
      s.tap(dir, 5);
      s.step(10);
    } else if (foe.vulnerableTimer > 0.1 && s.p.state === 'combat_idle') {
      s.tap('shift', 4);
      s.step(16);
    } else if (foe.state === 'combat_advance' && dist <= 36 && s.p.state === 'combat_idle') {
      // Punish advancing guard!
      s.tap('shift', 4);
      s.step(18);
    } else {
      s.step(1);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// PART 1: MOVEMENT FEEL
// ---------------------------------------------------------------------------

{
  // 1A: Stone skid vs Ice skid
  const flatRoom = (ice) => ({
    id: 0, name: 'MoveTest', subtitle: '', ice,
    start: { room: 0, col: 1, row: 2, facing: 1, hasSword: false },
    rooms: {
      0: {
        links: { left: null, right: null, up: null, down: null },
        grid: ['############', '#..........#', '#__________#', '############'],
      },
    },
  });

  const sStone = new Sim(flatRoom(false), { noEnemies: true });
  sStone.press('right');
  sStone.step(30);
  const xReleaseStone = sStone.p.x;
  sStone.release('right');
  sStone.waitIdle(120);
  const stoneSkid = sStone.p.x - xReleaseStone;
  R.check(stoneSkid >= 14 && stoneSkid <= 28, '1A stone skid weighty (~0.5 tile)', `skid=${stoneSkid.toFixed(1)}px`);

  const sIce = new Sim(flatRoom(true), { noEnemies: true });
  sIce.press('right');
  sIce.step(30);
  const xReleaseIce = sIce.p.x;
  sIce.release('right');
  sIce.waitIdle(120);
  const iceSkid = sIce.p.x - xReleaseIce;
  R.check(iceSkid >= 26 && iceSkid > stoneSkid * 1.45, '1B ice skid significantly longer than stone', `ice=${iceSkid.toFixed(1)}px stone=${stoneSkid.toFixed(1)}px`);

  // 1C: run_turn triggers cleanly when reversing mid-run
  const sTurn = new Sim(flatRoom(false), { noEnemies: true });
  sTurn.press('right');
  sTurn.step(26);
  sTurn.release('right');
  sTurn.press('left');
  sTurn.step(2);
  const enteredRunTurn = sTurn.p.state === 'run_turn';
  sTurn.step(30);
  sTurn.release('left');
  R.check(enteredRunTurn && sTurn.p.facing === -1, '1C run_turn pivots smoothly mid-run', `entered=${enteredRunTurn} facing=${sTurn.p.facing}`);

  // 1D: careful-step at pit edge never moves backwards and never falls off
  const pitDef = {
    id: 0, name: 'EdgeTest', subtitle: '', ice: false,
    start: { room: 0, col: 3, row: 2, facing: 1, hasSword: false },
    rooms: {
      0: {
        links: { left: null, right: null, up: null, down: null },
        grid: ['############', '#..........#', '#___.___####', '#___________'],
      },
    },
  };
  const sEdge = new Sim(pitDef, { noEnemies: true });
  sEdge.place(0, 3, 2, { x: 127, facing: 1 });
  const xBefore = sEdge.p.x;
  sEdge.hold(['shift', 'right'], 20);
  sEdge.waitIdle(60);
  R.check(sEdge.p.grounded && sEdge.p.row === 2 && sEdge.p.x >= xBefore, '1D careful-step at brink never slides backward or falls', `before=${xBefore} after=${sEdge.p.x.toFixed(1)} row=${sEdge.p.row}`);

  // 1E: coyote running jump just after running off edge
  const sCoyote = new Sim(pitDef, { noEnemies: true });
  sCoyote.place(0, 1, 2, { facing: 1 });
  sCoyote.press('right');
  sCoyote.stepUntil((q) => q.p.state === 'fall', 150);
  sCoyote.step(2); // 2 frames (33ms) into fall — within 100ms coyote window
  sCoyote.tap('up', 4);
  const launched = sCoyote.p.state === 'run_jump';
  sCoyote.release('right');
  sCoyote.waitIdle(120);
  R.check(launched && sCoyote.p.grounded && sCoyote.p.row === 2 && colOfX(sCoyote.p.x) >= 5, '1E coyote running jump clears pit', `launched=${launched} ${JSON.stringify(sCoyote.snap())}`);
}

// ---------------------------------------------------------------------------
// PART 2: COMBAT READABILITY & AI
// ---------------------------------------------------------------------------

{
  // 2A: Dr. Viktor Zins strike windup is >= 220ms before active hit
  const sZins = new Sim(4, { god: false, maxHp: 5 });
  sZins.place(6, 5, 2, { facing: 1 });
  const zins = sZins.game.enemies.find((e) => e.type === 'zins');
  // Wait for Zins to start a strike
  let windupFrames = 0;
  let sawStrike = false;
  for (let i = 0; i < 300; i++) {
    sZins.step(1);
    if (zins.state === 'combat_strike') {
      sawStrike = true;
      if (!zins.strikeHitDone) windupFrames++;
      else break;
    }
  }
  const windupMs = windupFrames * DT * 1000;
  R.check(sawStrike && windupMs >= 215, '2A Zins strike windup is human-reactable (>=215ms)', `saw=${sawStrike} windup=${windupMs.toFixed(0)}ms`);

  // 2B: Buffered parry-to-riposte hits Zins cleanly
  const sParry = new Sim(4, { god: false, maxHp: 5 });
  sParry.place(6, 6, 2, { x: tileCenterX(6) + 2, facing: 1 });
  const z2 = sParry.game.enemies.find((e) => e.type === 'zins');
  const hp0 = z2.hp;
  sParry.stepUntil(() => z2.state === 'combat_strike', 240);
  // Press Up (parry) and immediately buffer Shift (riposte) 4 frames later — BEFORE parry ends!
  sParry.tap('up', 4);
  sParry.step(4);
  sParry.tap('shift', 4);
  sParry.step(40);
  R.check(z2.hp === hp0 - 1 && sParry.p.hp === 5, '2B buffered parry-to-riposte lands cleanly on Zins', `zinsHp=${z2.hp}/${hp0} playerHp=${sParry.p.hp}`);

  // 2C: Minimum duel spacing prevents nose-to-nose overlap
  const sSpace = new Sim(0, { god: false });
  sSpace.p.hasSword = true;
  sSpace.place(6, 6, 2, { facing: 1 });
  const guard = sSpace.game.enemies.find((e) => e.roomId === 6);
  sSpace.step(10); // enter combat_idle
  for (let k = 0; k < 5; k++) {
    sSpace.tap('right', 5);
    sSpace.step(12);
  }
  const sep = Math.abs(guard.x - sSpace.p.x);
  R.check(sep >= 20, '2C minimum duel spacing prevents nose-to-nose overlap', `sep=${sep.toFixed(1)}px`);

  // 2D: Guard resets toward spawn position when player leaves the room
  const sReset = new Sim(0, { god: false });
  sReset.p.hasSword = true;
  sReset.place(6, 1, 2, { facing: 1 });
  const g6 = sReset.game.enemies.find((e) => e.roomId === 6);
  g6.x = 40; // simulate guard chased player near left doorway
  sReset.place(5, 8, 2, { facing: -1 }); // player leaves to Room 5
  sReset.step(180);
  R.check(g6.x > 160, '2D guard resets away from doorway when player leaves room', `guardX=${g6.x.toFixed(1)} spawnX=${g6.spawnX}`);

  // 2E: Level 4 Deepfake sheathe & wait 4s (past 2.4s sheathedLock) merges cleanly without instant-kill!
  const sDf = new Sim(3, { god: false, maxHp: 3 });
  sDf.place(8, 4, 2, { facing: 1 });
  sDf.step(10); // auto-draw sword
  sDf.tap('down', 5); // sheathe
  sDf.step(260); // wait 4.3 seconds (> 2.4s sheathedLock!)
  const stillAlive = sDf.p.alive;
  walkTo(sDf, 8, tileCenterX(8));
  R.check(stillAlive && sDf.p.alive && sDf.level.deepfakeMerged && sDf.p.maxHp === 4,
    '2E L4 Deepfake stays passive past 2.4s and merges cleanly',
    `alive=${sDf.p.alive} merged=${sDf.level.deepfakeMerged} maxHp=${sDf.p.maxHp}`);

  // 2F: Anti-air guard intercept blocks sheathe+jump bypass over Dr. Viktor Zins
  const sSkip = new Sim(4, { god: false, maxHp: 5 });
  sSkip.place(6, 4, 2, { facing: 1 });
  sSkip.step(10);
  sSkip.tap('down', 5); // sheathe
  sSkip.waitIdle(40);
  jumpGap(sSkip, 'right', true, tileCenterX(5) + 12);
  R.check(!sSkip.p.alive || sSkip.p.x < tileCenterX(7),
    '2F cannot sheathe and running-jump straight past Dr. Viktor Zins',
    JSON.stringify(sSkip.snap()));
}

// ---------------------------------------------------------------------------
// PART 3: RECOVERY PITS & DYNAMIC TRAPS
// ---------------------------------------------------------------------------

{
  // 3A: Level 2 Room 1 pit drop -> survive in Room 4 -> climb all the way back to Room 1 row 2!
  const sL2Pit = new Sim(1, { god: false, maxHp: 3 });
  sL2Pit.place(1, 3, 2, { facing: 1 });
  // Step into col 4 -> lands on row 3 col 4, then step right into col 5 -> lands on Room 4 row 0 col 5!
  dropInto(sL2Pit, 'right');
  dropInto(sL2Pit, 'right');
  const inRoom4 = sL2Pit.p.alive && sL2Pit.p.roomId === 4 && sL2Pit.p.row === 0;
  // Climb straight back up from Room 4 row 0 col 5 -> Room 1 row 3 col 4 -> Room 1 row 2 col 3!
  climbOnce(sL2Pit);
  const onL2R1Row3 = sL2Pit.p.alive && sL2Pit.p.roomId === 1 && sL2Pit.p.row === 3;
  climbOnce(sL2Pit);
  const backOnR1Row2 = sL2Pit.p.alive && sL2Pit.p.roomId === 1 && sL2Pit.p.row === 2;
  R.check(inRoom4 && onL2R1Row3 && backOnR1Row2,
    '3A Level 2 Room 4 recovery pit is survivable and climbs cleanly back to Room 1',
    `inR4=${inRoom4} r1r3=${onL2R1Row3} back=${backOnR1Row2} ${JSON.stringify(sL2Pit.snap())}`);

  // 3B: Level 4 Room 1 loose-ice drop -> survive in Room 4 -> climb all the way back to Room 1 row 2!
  const sL4Pit = new Sim(3, { god: false, maxHp: 3 });
  sL4Pit.place(1, 4, 2, { facing: 1 });
  // Stand on loose ice col 4 until it breaks and drops us to Room 4 row 0!
  sL4Pit.stepUntil((q) => !q.p.alive || (q.p.roomId === 4 && q.p.grounded), 180);
  sL4Pit.waitIdle(80);
  const inL4R4 = sL4Pit.p.alive && sL4Pit.p.roomId === 4 && sL4Pit.p.row === 0;
  climbOnce(sL4Pit);
  const onL4R1Row3 = sL4Pit.p.alive && sL4Pit.p.roomId === 1 && sL4Pit.p.row === 3;
  climbOnce(sL4Pit);
  const backOnL4R1Row2 = sL4Pit.p.alive && sL4Pit.p.roomId === 1 && sL4Pit.p.row === 2;
  R.check(inL4R4 && onL4R1Row3 && backOnL4R1Row2,
    '3B Level 4 Room 4 recovery pit is survivable and climbs cleanly back to Room 1',
    `inR4=${inL4R4} r1r3=${onL4R1Row3} back=${backOnL4R1Row2} ${JSON.stringify(sL4Pit.snap())}`);

  // 3C: Proximity spikes extend when rushing near, stay safe with Shift careful-step
  const sSpk = new Sim(1, { god: false });
  const sp = sSpk.level.getRoom(0).spikes.get('4,2');
  walkTo(sSpk, 0, tileCenterX(3) - 6);
  const extAfterRush = sp.extended;
  // Wait briefly for spikes to retract, then careful-step safely across col 4!
  sSpk.step(50);
  walkTo(sSpk, 0, tileCenterX(6), { careful: true });
  R.check(extAfterRush > 0.6 && sSpk.p.alive && colOfX(sSpk.p.x) >= 5,
    '3C proximity spikes react to rushing and careful-step crosses safely',
    `extAfterRush=${extAfterRush.toFixed(2)} alive=${sSpk.p.alive} col=${colOfX(sSpk.p.x)}`);
}

// ---------------------------------------------------------------------------
// PART 4: FULL END-TO-END PLAYTHROUGH OF ALL 5 LEVELS WITHOUT GOD MODE!
// ---------------------------------------------------------------------------

// --- LEVEL 1: Paradeplatz Vaults (Unarmed start -> Sabre -> Vault Gate -> Timed Gate -> 2 Guards -> Exit) ---
{
  const s = new Sim(0, { god: false, maxHp: 3, seed: 42 });
  // Room 0: jump 1-tile pit at col 4, climb ledge to row 1, enter Room 1
  walkTo(s, 0, tileCenterX(3) + 4);
  jumpGap(s, 'right', false);
  walkTo(s, 0, tileCenterX(6));
  climbOnce(s);
  crossRoom(s, 'right', 1);
  // Room 1: walk onto loose tile col 3, let it break -> drop to row 2
  walkTo(s, 1, tileCenterX(3));
  s.stepUntil((q) => q.p.row === 2 && q.p.grounded, 120);
  s.waitIdle(60);
  // Drop at col 5 -> row 3, then drop at col 7 -> Room 2 row 0!
  dropInto(s, 'right');
  dropInto(s, 'right');
  // Room 2: drop col 8 -> row 1, jump col 5 -> pick up Guild Sabre at col 2 + step on P at col 1!
  dropInto(s, 'right');
  walkTo(s, 2, tileCenterX(6) - 6);
  jumpGap(s, 'left', false);
  walkTo(s, 2, tileCenterX(2));
  s.tap('shift', 5); // pick up Guild Sabre!
  s.waitIdle(90);
  walkTo(s, 2, tileCenterX(1)); // step on P -> opens l1_g_vault!
  // Return right: jump col 5, climb col 8 LEFT -> row 0 col 7, climb col 7 -> Room 1 row 3!
  walkTo(s, 2, tileCenterX(4) + 6);
  jumpGap(s, 'right', false);
  walkTo(s, 2, tileCenterX(8));
  climbOnce(s, 'left');
  walkTo(s, 2, tileCenterX(7));
  climbOnce(s, 'left'); // into Room 1 row 3!
  // Room 1: climb col 5 -> row 2, climb col 3 (broken L!) RIGHT -> row 1 col 4!
  walkTo(s, 1, tileCenterX(5));
  climbOnce(s, 'left');
  walkTo(s, 1, tileCenterX(3));
  climbOnce(s, 'right');
  // Walk right through opened l1_g_vault -> Room 3!
  crossRoom(s, 'right', 3);
  // Room 3: jump col 4 on row 1, enter Room 5!
  walkTo(s, 3, tileCenterX(3) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 5);
  // Room 5: jump col 3 on row 1, step on P at col 7 -> opens l1_g_timed, drop col 9, sprint into Room 6!
  walkTo(s, 5, tileCenterX(2) + 6);
  jumpGap(s, 'right', false);
  walkTo(s, 5, tileCenterX(7));
  dropInto(s, 'right');
  crossRoom(s, 'right', 6);
  // Room 6: duel Vault Guard!
  fightRoomFoe(s);
  crossRoom(s, 'right', 7);
  // Room 7: duel Vault Captain, climb col 7 LEFT -> row 1 col 6, step on P at col 5 (opens l1_exit), drop col 7 -> Room 8!
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 7, tileCenterX(5));
  dropInto(s, 'right');
  crossRoom(s, 'right', 8);
  // Room 8: walk to Exit Door col 7, press Up!
  walkTo(s, 8, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  R.check(s.game.mode === 'interlude' && s.p.alive && s.p.hasSword,
    '4A Level 1 completable end-to-end WITHOUT god mode',
    `mode=${s.game.mode} sword=${s.p.hasSword} ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 2: Gotthard Reduit Bunker (Spikes -> 2-tile Jump -> Sentries -> Close-Plate -> Major -> Exit) ---
{
  const s = new Sim(1, { god: false, maxHp: 4, seed: 42 });
  // Room 0: careful-step across spikes col 4 -> Room 1
  walkTo(s, 0, tileCenterX(3) - 6);
  walkTo(s, 0, tileCenterX(6), { careful: true });
  crossRoom(s, 'right', 1);
  // Room 1: running jump across 2-tile chasm cols 4..5 -> Room 2
  walkTo(s, 1, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  crossRoom(s, 'right', 2);
  // Room 2: running jump across cols 4..5, duel Bunker Sentry -> Room 3
  walkTo(s, 2, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  fightRoomFoe(s);
  crossRoom(s, 'right', 3);
  // Room 3: climb col 3 -> row 1, step on P col 5 (l2_g_blast), drop col 3, jump over Q col 6, sprint into Room 6!
  walkTo(s, 3, tileCenterX(3));
  climbOnce(s);
  walkTo(s, 3, tileCenterX(5));
  dropInto(s, 'left');
  walkTo(s, 3, tileCenterX(5) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 6);
  // Room 6: sprint over L col 3, careful-step across spikes col 7 -> Room 7
  walkTo(s, 6, tileCenterX(6) - 6);
  walkTo(s, 6, tileCenterX(9), { careful: true });
  crossRoom(s, 'right', 7);
  // Room 7: duel Reduit Major, careful-step over spikes cols 9..10 -> Room 8
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(8) - 4);
  walkTo(s, 7, tileCenterX(11) + 12, { careful: true });
  if (s.p.roomId === 7) crossRoom(s, 'right', 8);
  // Room 8: running jump cols 4..5, duel Tunnel Guard, climb col 7 -> row 1, step on P col 3 (l2_exit), drop col 7 -> Room 9!
  walkTo(s, 8, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 4);
  fightRoomFoe(s);
  walkTo(s, 8, tileCenterX(7));
  climbOnce(s);
  walkTo(s, 8, tileCenterX(3));
  dropInto(s, 'right');
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4B Level 2 completable end-to-end WITHOUT god mode',
    `mode=${s.game.mode} ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 3: CERN Ring Sector 4 (Shutters -> Elite -> Mirror -> Deepfake Sabotage -> Maintenance Bypass -> Exit) ---
{
  const s = new Sim(2, { god: false, maxHp: 4, seed: 42 });
  // Room 0: pass shutter col 5 -> Room 1
  passShutter(s, 'right', 5, tileCenterX(8));
  crossRoom(s, 'right', 1);
  // Room 1: pass shutter col 2 & col 8 -> Room 2
  passShutter(s, 'right', 2, tileCenterX(5));
  passShutter(s, 'right', 8, tileCenterX(10));
  crossRoom(s, 'right', 2);
  // Room 2: CERN Tactical stands across pit col 7; drop into cryo-trench col 7, or sheathe + jump col 7 then duel!
  // Let's jump across col 7 (if sword auto-drew across pit, sheathe cleanly or duel across/after!)
  walkTo(s, 2, tileCenterX(6) + 4);
  if (s.p.swordDrawn) {
    s.tap('down', 5);
    s.waitIdle(40);
  }
  jumpGap(s, 'right', false);
  if (s.p.row === 3) {
    walkTo(s, 2, tileCenterX(7));
    s.tap('right', 3);
    s.waitIdle(30);
    climbOnce(s);
  }
  fightRoomFoe(s);
  crossRoom(s, 'right', 3);
  // Room 3: running jump cols 3..4, climb col 5 RIGHT -> row 1 col 6, step on P col 7 (l3_g_mirror), drop col 5 -> Room 4
  walkTo(s, 3, tileCenterX(0) + 12);
  jumpGap(s, 'right', true, tileCenterX(2) + 4);
  walkTo(s, 3, tileCenterX(5));
  climbOnce(s, 'right');
  walkTo(s, 3, tileCenterX(8));
  dropInto(s, 'left');
  crossRoom(s, 'right', 4);
  // Room 4: sprint through Quantum Mirror col 6 -> Room 5
  const mirrorBrokenBefore = s.level.mirrorBroken;
  crossRoom(s, 'right', 5);
  const mirrorBrokenAfter = s.level.mirrorBroken && s.level.deepfakeSpawned;
  // Room 5: pass L col 3 & shutter col 6 -> Room 6
  passShutter(s, 'right', 6, tileCenterX(9));
  crossRoom(s, 'right', 6);
  // Room 6: jump col 8 -> enter Room 8 to trigger Deepfake slam
  walkTo(s, 6, tileCenterX(7) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 8);
  // Wait for scripted Deepfake to slam l3_g_final
  s.step(90);
  // Backtrack to Room 6, drop down col 8 -> row 3 -> col 9 -> Room 7 row 0!
  crossRoom(s, 'left', 6);
  dropInto(s, 'left');
  dropInto(s, 'right');
  // Room 7: drop col 8 -> row 1, pass shutter col 6, hit P col 2 (reopens l3_g_final!), drop col 1 -> row 2
  dropInto(s, 'left');
  passShutter(s, 'left', 6, tileCenterX(3));
  walkTo(s, 7, tileCenterX(2)); // reopens l3_g_final!
  dropInto(s, 'left');
  // Grab small elixir col 1 if needed, duel Sector Warden, hit P col 5 (opens l3_exit!)
  s.tap('shift', 4);
  s.waitIdle(60);
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(5)); // opens l3_exit!
  // Climb back up Room 7: col 1 -> row 1, pass shutter col 6 -> col 8 -> row 0 col 9 -> Room 6!
  walkTo(s, 7, tileCenterX(1));
  climbOnce(s, 'right');
  passShutter(s, 'right', 6, tileCenterX(8));
  climbOnce(s, 'right');
  walkTo(s, 7, tileCenterX(9));
  climbOnce(s, 'left'); // into Room 6 row 3!
  walkTo(s, 6, tileCenterX(8));
  climbOnce(s, 'right'); // onto Room 6 row 2 col 9!
  crossRoom(s, 'right', 8);
  // Room 8: jump over close-plate Q at col 5, walk through reopened l3_g_final -> Room 9!
  walkTo(s, 8, tileCenterX(4) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  R.check(!mirrorBrokenBefore && mirrorBrokenAfter && s.game.mode === 'interlude' && s.p.alive,
    '4C Level 3 completable end-to-end WITHOUT god mode',
    `mirror=${mirrorBrokenAfter} mode=${s.game.mode} ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 4: Jungfraujoch Ice Palace (Ice Skid -> Crevasse -> Spikes -> Guard -> Ice Gate -> Captain -> Deepfake Merge -> Exit) ---
{
  const s = new Sim(3, { god: false, maxHp: 4, seed: 42 });
  // Room 0: run right over L col 6 -> Room 1
  crossRoom(s, 'right', 1);
  // Room 1: cross LL. (cols 3,4,5): sprint across cols 3,4 and jump col 5!
  walkTo(s, 1, tileCenterX(0) + 12);
  jumpGap(s, 'right', true, tileCenterX(3) + 6);
  crossRoom(s, 'right', 2);
  // Room 2: careful-step over frost spikes at cols 3 & 8 -> Room 3
  walkTo(s, 2, tileCenterX(2) - 8);
  walkTo(s, 2, tileCenterX(5), { careful: true });
  walkTo(s, 2, tileCenterX(7) - 8);
  walkTo(s, 2, tileCenterX(10), { careful: true });
  crossRoom(s, 'right', 3);
  // Room 3: duel Alpine Guard -> Room 5
  fightRoomFoe(s);
  crossRoom(s, 'right', 5);
  // Room 5: climb col 6 LEFT -> row 1 col 5, hit P col 4 (opens l4_g_ice), drop col 6 -> sprint into Room 6!
  walkTo(s, 5, tileCenterX(6));
  climbOnce(s, 'left');
  walkTo(s, 5, tileCenterX(4));
  dropInto(s, 'right');
  crossRoom(s, 'right', 6);
  // Room 6: running jump ice chasm cols 3..4, sprint across L col 8 -> Room 7
  walkTo(s, 6, tileCenterX(0) + 12);
  jumpGap(s, 'right', true, tileCenterX(2) + 4);
  crossRoom(s, 'right', 7);
  // Room 7: duel Glacier Captain, jump pit col 8 -> Room 8
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(7) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 8);
  // Room 8: THE DEEPFAKE BRIDGE — sheathe sword with Down, walk into Deepfake to merge, hit P col 10 -> Room 9!
  s.step(12);
  s.tap('down', 5);
  s.waitIdle(60);
  walkTo(s, 8, tileCenterX(10));
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  R.check(s.level.deepfakeMerged && s.game.mode === 'interlude' && s.p.alive,
    '4D Level 4 completable end-to-end WITHOUT god mode',
    `merged=${s.level.deepfakeMerged} mode=${s.game.mode} ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 5: Sphinx Observatory Summit (Gauntlet -> Elites -> Timed Gate -> Dr. Viktor Zins Boss Duel -> Rescue Celine -> VICTORY!) ---
{
  const s = new Sim(4, { god: false, maxHp: 5, seed: 42 });
  // Room 0: pass L col 4 & shutter col 8 -> Room 1
  passShutter(s, 'right', 8, tileCenterX(10));
  crossRoom(s, 'right', 1);
  // Room 1: careful-step spikes col 2, pass shutter col 6 -> Room 2
  walkTo(s, 1, tileCenterX(1) - 4);
  walkTo(s, 1, tileCenterX(4), { careful: true });
  passShutter(s, 'right', 6, tileCenterX(9));
  crossRoom(s, 'right', 2);
  // Room 2: duel Zins Bodyguard -> Room 3
  fightRoomFoe(s);
  crossRoom(s, 'right', 3);
  // Room 3: running jump cols 4..5, climb col 7 LEFT -> row 1 col 6, hit P col 3 (l5_g_dome), drop col 7 -> sprint into Room 4!
  walkTo(s, 3, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 4);
  walkTo(s, 3, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 3, tileCenterX(3));
  dropInto(s, 'right');
  crossRoom(s, 'right', 4);
  // Room 4: duel Chief of Security, running jump over L. (cols 8..9) -> Room 5
  fightRoomFoe(s);
  walkTo(s, 4, tileCenterX(5));
  jumpGap(s, 'right', true, tileCenterX(7) + 4);
  crossRoom(s, 'right', 5);
  // Room 5: pass shutter col 4, grab small elixir col 9 -> Room 6!
  passShutter(s, 'right', 4, tileCenterX(9));
  s.tap('shift', 5);
  s.waitIdle(60);
  crossRoom(s, 'right', 6);
  // Room 6: FINAL BOSS DUEL WITH DR. VIKTOR ZINS!
  const zins = s.game.enemies.find((e) => e.type === 'zins');
  const duelWon = fightRoomFoe(s, 2400);
  // Step on l5_exit plate at col 10 -> Room 7!
  walkTo(s, 6, tileCenterX(10));
  crossRoom(s, 'right', 7);
  // Room 7: walk to Celine Amrein at col 9 -> VICTORY!
  walkTo(s, 7, tileCenterX(9));
  R.check(duelWon && !zins.alive && s.game.mode === 'victory' && s.p.alive,
    '4E Level 5 (including Dr. Viktor Zins boss duel & Celine rescue) completable WITHOUT god mode',
    `duelWon=${duelWon} zinsAlive=${zins.alive} mode=${s.game.mode} ${JSON.stringify(s.snap())}`);
}

process.exit(R.print() ? 0 : 1);
