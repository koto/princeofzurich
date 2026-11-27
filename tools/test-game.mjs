#!/usr/bin/env node
// tools/test-game.mjs
// Comprehensive automated test suite driving the REAL Game/Player/Enemy/LevelState
// with synthesized keyboard presses across ALL 10 LEVELS:
//  Part 1: Movement feel (stone/ice skid, run_turn, careful-step edge clamp, jumps, coyote)
//  Part 2: Combat readability & AI (windup >= 215ms, buffered parry-riposte, spacing,
//          guard room reset, Deepfake sheathe merge past 2.4s, Zins anti-jump, masher loss, 3 boss phases)
//  Part 3: Recovery pits, proximity spikes, vertical falling-debris hold-plates, Alpine Foehn wind,
//          music track mapping, story card constraints, and Level Select UI
//  Part 4: Full end-to-end playthrough of ALL 10 LEVELS WITHOUT GOD MODE!
// Exit code 1 on any failure.

import { Sim, Report, DT } from './sim.mjs';
import { TILE_W, floorY, tileCenterX, colOfX } from '../src/level.js';
import {
  INTRO_CARDS, INTERLUDE_CARDS, getVictoryCards, TIMEOUT_CARDS, LEVEL_MUSIC_TRACKS,
} from '../src/story.js';

const R = new Report('test-game');

// ---------------------------------------------------------------------------
// Movement & Combat Drivers (strictly real key presses — zero teleports in Part 4!)
// ---------------------------------------------------------------------------

function walkTo(s, roomId, targetX, { careful = false, maxFrames = 600, stopOnRowChange = true } = {}) {
  const startRow = s.p.row;
  const dir = targetX > s.p.x ? 'right' : 'left';
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
  if (!careful && s.p.alive && s.p.roomId === roomId && s.p.row === startRow && Math.abs(s.p.x - targetX) > 10) {
    const fdir = targetX > s.p.x ? 'right' : 'left';
    s.press('shift');
    s.press(fdir);
    for (let i = 0; i < 140; i++) {
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

function crossRoom(s, dir, targetRoom, maxFrames = 500) {
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
    s.stepUntil((q) => !q.p.alive || (q.p.grounded && q.p.state !== 'run_jump'), 140);
    s.release(dir);
    s.waitIdle(120);
  } else {
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
  let sawClosed = false;
  s.stepUntil((q) => {
    const st = q.level.getSlicerState(room, shutterCol, row, q.game.time);
    if (st.closed) sawClosed = true;
    return sawClosed && !st.closed && !st.warning && st.openness >= 0.99;
  }, 360);
  walkTo(s, room, destX);
}

function waitWindActive(s, roomId, wantActive = true, maxFrames = 600) {
  // Hold Shift while waiting so wind never pushes us off-spot; wait for a fresh transition
  // when wanting an active tailwind so we get the full gust duration!
  s.press('shift');
  let sawOpposite = !wantActive;
  s.stepUntil((q) => {
    const ws = q.level.getWindState(roomId, q.game.time);
    if (ws.active !== wantActive) sawOpposite = true;
    return sawOpposite && ws.active === wantActive;
  }, maxFrames);
  s.release('shift');
}

function fightRoomFoe(s, maxFrames = 2600) {
  const room = s.p.roomId;
  const row = s.p.row;
  let parryWait = 0;
  let lastClip = '';
  let lastAnimT = 1;
  let parriedThisClip = false;

  for (let i = 0; i < maxFrames; i++) {
    if (!s.p.alive) return false;
    const foe = s.game.enemies.find((e) => e.alive && !e.nonCombat && e.roomId === room && e.row === row);
    if (!foe) {
      s.releaseAll();
      s.stepUntil((q) => !q.p.alive || (!q.p.swordDrawn && q.p.state === 'idle'), 120);
      return true;
    }
    if (!s.p.swordDrawn) {
      const dir = foe.x > s.p.x ? 'right' : 'left';
      s.press(dir);
      s.step(4);
      s.release(dir);
      continue;
    }

    const newClip = foe.anim !== lastClip || foe.animT < lastAnimT - 0.15;
    if (newClip) {
      parriedThisClip = false;
      parryWait = foe.anim === 'combat_strike' && foe.strikeKind === 'heavy' ? 14 : 5;
    }
    lastClip = foe.anim;
    lastAnimT = foe.animT;

    const p = s.p;
    const dist = Math.abs(foe.x - p.x);

    if (p.state === 'combat_parry' && p.parrySuccess && !p.riposteQueued) {
      s.tap('shift', 3);
      continue;
    }
    if (p.riposteWindow > 0.12 && p.state === 'combat_idle' && dist <= 40) {
      s.tap('shift', 3);
      continue;
    }

    if (foe.state === 'combat_strike' && foe.strikeTelegraph > 0 && dist <= 46 && !parriedThisClip) {
      if (parryWait > 0) {
        parryWait--;
        s.step(1);
        continue;
      }
      const canParryNow = p.state === 'combat_idle' || p.state === 'combat_advance' ||
        p.state === 'combat_retreat' || (p.state === 'combat_parried' && p.stateTimer >= 0.11);
      if (canParryNow) {
        parriedThisClip = true;
        s.tap('up', 3);
        continue;
      }
    }

    if (foe.state === 'combat_recover' && p.state === 'combat_idle' && dist <= 39) {
      s.tap('shift', 3);
      s.step(8);
      continue;
    }

    if (p.state === 'combat_idle' && dist > 35) {
      const dir = foe.x > p.x ? 'right' : 'left';
      s.tap(dir, 4);
      s.step(6);
      continue;
    }

    s.step(1);
  }
  return false;
}

// ---------------------------------------------------------------------------
// PART 1: MOVEMENT FEEL
// ---------------------------------------------------------------------------

{
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

  const sCoyote = new Sim(pitDef, { noEnemies: true });
  sCoyote.place(0, 1, 2, { facing: 1 });
  sCoyote.press('right');
  sCoyote.stepUntil((q) => q.p.state === 'fall', 150);
  sCoyote.step(2);
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
  // 2A: Dr. Viktor Zins (Level 10, index 9) strike windup >= 215ms
  const sZins = new Sim(9, { god: false, maxHp: 5 });
  sZins.place(6, 5, 2, { facing: 1 });
  const zins = sZins.game.enemies.find((e) => e.type === 'zins');
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
  const sParry = new Sim(9, { god: false, maxHp: 5 });
  sParry.place(6, 6, 2, { x: tileCenterX(6) + 2, facing: 1 });
  const z2 = sParry.game.enemies.find((e) => e.type === 'zins');
  const hp0 = z2.hp;
  sParry.stepUntil(() => z2.state === 'combat_strike', 240);
  if (z2.strikeKind === 'heavy') sParry.step(12);
  sParry.tap('up', 4);
  sParry.step(4);
  sParry.tap('shift', 4);
  sParry.step(40);
  R.check(z2.hp === hp0 - 1 && sParry.p.hp === 5, '2B buffered parry-to-riposte lands cleanly on Zins', `zinsHp=${z2.hp}/${hp0} playerHp=${sParry.p.hp} kind=${z2.strikeKind}`);

  // 2C: Minimum duel spacing prevents nose-to-nose overlap
  const sSpace = new Sim(0, { god: false });
  sSpace.p.hasSword = true;
  sSpace.place(6, 6, 2, { facing: 1 });
  const guard = sSpace.game.enemies.find((e) => e.roomId === 6);
  sSpace.step(10);
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
  g6.x = 40;
  sReset.place(5, 8, 2, { facing: -1 });
  sReset.step(180);
  R.check(g6.x > 160, '2D guard resets away from doorway when player leaves room', `guardX=${g6.x.toFixed(1)} spawnX=${g6.spawnX}`);

  // 2E: Level 9 (index 8) Deepfake sheathe & wait 4s merges cleanly
  const sDf = new Sim(8, { god: false, maxHp: 3 });
  sDf.place(8, 4, 2, { facing: 1 });
  sDf.step(10);
  sDf.tap('down', 5);
  sDf.step(260);
  const stillAlive = sDf.p.alive;
  walkTo(sDf, 8, tileCenterX(8));
  R.check(stillAlive && sDf.p.alive && sDf.level.deepfakeMerged && sDf.p.maxHp === 4,
    '2E L9 Deepfake stays passive past 2.4s and merges cleanly',
    `alive=${sDf.p.alive} merged=${sDf.level.deepfakeMerged} maxHp=${sDf.p.maxHp}`);

  // 2F: Anti-air guard intercept blocks sheathe+jump bypass over Dr. Viktor Zins
  const sSkip = new Sim(9, { god: false, maxHp: 5 });
  sSkip.place(6, 4, 2, { facing: 1 });
  sSkip.step(10);
  sSkip.tap('down', 5);
  sSkip.waitIdle(40);
  jumpGap(sSkip, 'right', true, tileCenterX(5) + 12);
  R.check(!sSkip.p.alive || sSkip.p.x < tileCenterX(7),
    '2F cannot sheathe and running-jump straight past Dr. Viktor Zins',
    JSON.stringify(sSkip.snap()));

  // 2G: Strike-mashing loses to mid-game guard (L3 R7 Maj. Tobler, index 2)
  const sMash = new Sim(2, { god: false, maxHp: 4, seed: 7 });
  sMash.place(7, 3, 2, { facing: 1 });
  const major = sMash.game.enemies.find((e) => e.roomId === 7);
  for (let i = 0; i < 1200 && sMash.p.alive && major.alive; i++) {
    sMash.releaseAll();
    if (!sMash.p.swordDrawn || Math.abs(major.x - sMash.p.x) > 35) sMash.press('right');
    else if (i % 3 === 0) sMash.press('shift');
    sMash.step(1);
  }
  R.check(!sMash.p.alive && major.alive,
    '2G mindless strike-mashing loses to mid-game guard (Maj. Tobler)',
    `playerAlive=${sMash.p.alive} majorHp=${major.hp}`);

  // 2H: Dr. Viktor Zins transitions through all 3 boss phases as HP drops
  const sBoss = new Sim(9, { god: false, maxHp: 5, seed: 11 });
  sBoss.place(6, 5, 2, { facing: 1 });
  const zb = sBoss.game.enemies.find((e) => e.type === 'zins');
  const p1 = zb.bossPhase;
  zb.takeDamage(2, 'sword', 1);
  const p2 = zb.bossPhase;
  zb.takeDamage(4, 'sword', 1);
  const p3 = zb.bossPhase;
  R.check(p1 === 1 && p2 === 2 && p3 === 3,
    '2H Dr. Viktor Zins advances through Phases 1 -> 2 -> 3',
    `phases=${p1}->${p2}->${p3}`);
}

// ---------------------------------------------------------------------------
// PART 3: RECOVERY PITS, DYNAMIC TRAPS & NEW V3 MECHANICS
// ---------------------------------------------------------------------------

{
  // 3A: Level 3 (index 2) Room 1 pit drop -> survive in Room 4 -> climb back
  const sL3Pit = new Sim(2, { god: false, maxHp: 3 });
  sL3Pit.place(1, 3, 2, { facing: 1 });
  dropInto(sL3Pit, 'right');
  dropInto(sL3Pit, 'right');
  const inRoom4 = sL3Pit.p.alive && sL3Pit.p.roomId === 4 && sL3Pit.p.row === 0;
  climbOnce(sL3Pit);
  const onR1Row3 = sL3Pit.p.alive && sL3Pit.p.roomId === 1 && sL3Pit.p.row === 3;
  climbOnce(sL3Pit);
  const backOnR1Row2 = sL3Pit.p.alive && sL3Pit.p.roomId === 1 && sL3Pit.p.row === 2;
  R.check(inRoom4 && onR1Row3 && backOnR1Row2,
    '3A Level 3 Room 4 recovery pit is survivable and climbs cleanly back',
    `inR4=${inRoom4} r1r3=${onR1Row3} back=${backOnR1Row2} ${JSON.stringify(sL3Pit.snap())}`);

  // 3B: Level 9 (index 8) Room 1 loose-ice drop -> survive in Room 4 -> climb back
  const sL9Pit = new Sim(8, { god: false, maxHp: 3 });
  sL9Pit.place(1, 4, 2, { facing: 1 });
  sL9Pit.stepUntil((q) => !q.p.alive || (q.p.roomId === 4 && q.p.grounded), 180);
  sL9Pit.waitIdle(80);
  const inL9R4 = sL9Pit.p.alive && sL9Pit.p.roomId === 4 && sL9Pit.p.row === 0;
  climbOnce(sL9Pit);
  const onL9R1Row3 = sL9Pit.p.alive && sL9Pit.p.roomId === 1 && sL9Pit.p.row === 3;
  climbOnce(sL9Pit);
  const backOnL9R1Row2 = sL9Pit.p.alive && sL9Pit.p.roomId === 1 && sL9Pit.p.row === 2;
  R.check(inL9R4 && onL9R1Row3 && backOnL9R1Row2,
    '3B Level 9 Room 4 recovery pit is survivable and climbs cleanly back',
    `inR4=${inL9R4} r1r3=${onL9R1Row3} back=${backOnL9R1Row2} ${JSON.stringify(sL9Pit.snap())}`);

  // 3C: Proximity spikes react to rushing and careful-step crosses safely
  const sSpk = new Sim(2, { god: false });
  const sp = sSpk.level.getRoom(0).spikes.get('4,2');
  walkTo(sSpk, 0, tileCenterX(3) - 6);
  const extAfterRush = sp.extended;
  sSpk.step(50);
  walkTo(sSpk, 0, tileCenterX(6), { careful: true });
  R.check(extAfterRush > 0.6 && sSpk.p.alive && colOfX(sSpk.p.x) >= 5,
    '3C proximity spikes react to rushing and careful-step crosses safely',
    `extAfterRush=${extAfterRush.toFixed(2)} alive=${sSpk.p.alive} col=${colOfX(sSpk.p.x)}`);

  // 3D: Vertical falling-debris pins hold-plate (L4 Room 0, index 3)
  const sDeb = new Sim(3, { god: false });
  walkTo(sDeb, 0, tileCenterX(6));
  const gateBefore = sDeb.level.gatesById.get('l4_g_intro');
  sDeb.tap('up', 4); // bump L at (6,1) overhead!
  sDeb.waitIdle(60); // finish jump_up cleanly
  sDeb.hold('left', 18); // step clear before masonry drops!
  sDeb.waitIdle(60);
  sDeb.step(80); // let slab fall onto P at (6,2)
  const plate0 = sDeb.level.getRoom(0).plates.get('6,2');
  R.check(plate0.pinnedByDebris && gateBefore.stayOpen && gateBefore.openAmount > 0.7,
    '3D bumping overhead loose slab pins hold-plate & keeps sluice gate open',
    `pinned=${plate0.pinnedByDebris} open=${gateBefore.openAmount.toFixed(2)}`);

  // 3E: Alpine Foehn Wind (L8, index 7): unbraced pushed, crouch/Shift braces, tailwind clears 3-tile chasm
  const sWind = new Sim(7, { god: false });
  sWind.place(0, 6, 2, { facing: 1 });
  waitWindActive(sWind, 0, true);
  const xStartWind = sWind.p.x;
  sWind.step(40); // unbraced in dir=-1 headwind -> pushed left!
  const unbracedDelta = xStartWind - sWind.p.x;
  const xBraceStart = sWind.p.x;
  sWind.press('down'); // crouch-brace!
  sWind.step(30);
  sWind.release('down');
  const bracedDelta = Math.abs(xBraceStart - sWind.p.x);
  R.check(unbracedDelta > 12 && bracedDelta < 0.5,
    '3E Foehn headwind pushes unbraced hero and crouch/Shift braces firmly',
    `unbracedPush=${unbracedDelta.toFixed(1)}px bracedDelta=${bracedDelta.toFixed(1)}px`);

  // 3F: Music track mapping, Story Bible card line/char/ASCII checks, and Level Select UI
  const expectedTracks = ['level0', 'level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9'];
  const tracksMatch = expectedTracks.every((t, i) => LEVEL_MUSIC_TRACKS[i] === t);
  const allCards = [...INTRO_CARDS, ...INTERLUDE_CARDS, ...getVictoryCards(1234), ...TIMEOUT_CARDS];
  const badCard = allCards.find((c) =>
    !c || !c.header || c.header.length > 34 || c.lines.length > 4 ||
    c.lines.some((ln) => ln.length > 44 || /[^A-Z0-9 :.,!?\-+/'"()><|&_]/.test(ln))
  );
  const sSel = new Sim(0, { god: false });
  sSel.game.openLevelSelect();
  sSel.tap('right', 2); // jump col 0 -> col 1 (index 0 -> 5 = L6)
  sSel.tap('down', 2);  // index 5 -> 6 = L7
  sSel.tap('enter', 2);
  R.check(tracksMatch && !badCard && sSel.game.mode === 'playing' && sSel.game.levelIndex === 6,
    '3F Music mapping (10 levels), Story Bible card limits, and Level Select UI verified',
    `tracks=${tracksMatch} badCard=${badCard?.header || 'none'} selLvl=${sSel.game.levelIndex}`);
}

// ---------------------------------------------------------------------------
// PART 4: FULL END-TO-END PLAYTHROUGH OF ALL 10 LEVELS WITHOUT GOD MODE!
// ---------------------------------------------------------------------------

let totalSimFrames = 0;

// --- LEVEL 1: Paradeplatz Vaults ---
{
  const s = new Sim(0, { god: false, maxHp: 3, seed: 42 });
  walkTo(s, 0, tileCenterX(3) + 4);
  jumpGap(s, 'right', false);
  walkTo(s, 0, tileCenterX(6));
  climbOnce(s);
  crossRoom(s, 'right', 1);
  walkTo(s, 1, tileCenterX(3));
  s.stepUntil((q) => q.p.row === 2 && q.p.grounded, 120);
  s.waitIdle(60);
  dropInto(s, 'right');
  dropInto(s, 'right');
  dropInto(s, 'right');
  walkTo(s, 2, tileCenterX(6) - 6);
  jumpGap(s, 'left', false);
  walkTo(s, 2, tileCenterX(2));
  s.tap('shift', 5);
  s.waitIdle(90);
  walkTo(s, 2, tileCenterX(1));
  walkTo(s, 2, tileCenterX(4) + 6);
  jumpGap(s, 'right', false);
  walkTo(s, 2, tileCenterX(8));
  climbOnce(s, 'left');
  walkTo(s, 2, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 1, tileCenterX(5));
  climbOnce(s, 'left');
  walkTo(s, 1, tileCenterX(3));
  climbOnce(s, 'right');
  crossRoom(s, 'right', 3);
  walkTo(s, 3, tileCenterX(3) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 5);
  walkTo(s, 5, tileCenterX(2) + 6);
  jumpGap(s, 'right', false);
  walkTo(s, 5, tileCenterX(7));
  dropInto(s, 'right');
  crossRoom(s, 'right', 6);
  fightRoomFoe(s);
  crossRoom(s, 'right', 7);
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 7, tileCenterX(5));
  dropInto(s, 'right');
  crossRoom(s, 'right', 8);
  walkTo(s, 8, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive && s.p.hasSword,
    '4A Level 1 (Paradeplatz Vaults) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 2: Olten SBB Gleis 0 ---
{
  const s = new Sim(1, { god: false, maxHp: 4, seed: 42 });
  // Room 0: climb col 3 RIGHT -> row 1, hit P col 5 (opens l2_g_intro), drop col 3 -> vault Q col 6 -> Room 1!
  walkTo(s, 0, tileCenterX(3));
  climbOnce(s, 'right');
  walkTo(s, 0, tileCenterX(5)); // opens l2_g_intro!
  dropInto(s, 'left'); // drops onto col 3 (left of Q col 6!)
  walkTo(s, 0, tileCenterX(5) + 6);
  jumpGap(s, 'right', false); // vaults Q col 6!
  crossRoom(s, 'right', 1);
  // Room 1: jump col 4 on row 2 -> Room 2
  walkTo(s, 1, tileCenterX(3) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 2);
  // Room 2: running jump across cols 4..5 -> Room 3
  walkTo(s, 2, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  crossRoom(s, 'right', 3);
  // Room 3: duel Ruedi -> Room 5
  fightRoomFoe(s);
  crossRoom(s, 'right', 5);
  // Room 5 (Midnight Transfer Gantry): climb col 3 -> row 1 -> col 6 -> row 0 -> P col 4 -> drop -> vault twin Q (cols 4 & 7) -> Room 6!
  walkTo(s, 5, tileCenterX(3));
  climbOnce(s, 'right');
  walkTo(s, 5, tileCenterX(6));
  climbOnce(s, 'left');
  walkTo(s, 5, tileCenterX(4)); // opens l2_g_gantry!
  dropInto(s, 'right'); // drops onto col 6 row 1
  dropInto(s, 'left');  // runs left off col 4 row 1 -> drops onto col 3 row 2 (left of Q col 4!)
  walkTo(s, 5, tileCenterX(3) + 6);
  jumpGap(s, 'right', false); // vaults Q col 4 -> lands col 5!
  walkTo(s, 5, tileCenterX(6) + 6);
  jumpGap(s, 'right', false); // vaults Q col 7 -> lands col 8!
  crossRoom(s, 'right', 6);
  // Room 6: duel Night Marshal -> Room 7
  fightRoomFoe(s);
  crossRoom(s, 'right', 7);
  // Room 7: jump col 3, climb col 5 -> row 1 -> climb col 8 -> row 0 -> hit P col 3 (l2_exit) -> drop -> Room 8!
  walkTo(s, 7, tileCenterX(2) + 6);
  jumpGap(s, 'right', false);
  walkTo(s, 7, tileCenterX(5));
  climbOnce(s, 'right');
  walkTo(s, 7, tileCenterX(8));
  climbOnce(s, 'left');
  walkTo(s, 7, tileCenterX(3)); // opens l2_exit!
  dropInto(s, 'right'); // row 1 col 8
  dropInto(s, 'left');  // row 2 col 5
  crossRoom(s, 'right', 8);
  walkTo(s, 8, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4B Level 2 (Olten SBB Gleis 0) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 3: Gotthard Reduit ---
{
  const s = new Sim(2, { god: false, maxHp: 4, seed: 42 });
  walkTo(s, 0, tileCenterX(3) - 6);
  walkTo(s, 0, tileCenterX(6), { careful: true });
  crossRoom(s, 'right', 1);
  walkTo(s, 1, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  crossRoom(s, 'right', 2);
  walkTo(s, 2, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  fightRoomFoe(s);
  crossRoom(s, 'right', 3);
  walkTo(s, 3, tileCenterX(3));
  climbOnce(s);
  walkTo(s, 3, tileCenterX(5));
  dropInto(s, 'left');
  walkTo(s, 3, tileCenterX(5) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 6);
  walkTo(s, 6, tileCenterX(6) - 6);
  walkTo(s, 6, tileCenterX(9), { careful: true });
  crossRoom(s, 'right', 7);
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(8) - 4);
  walkTo(s, 7, tileCenterX(11) + 12, { careful: true });
  if (s.p.roomId === 7) crossRoom(s, 'right', 8);
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
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4C Level 3 (Gotthard Reduit) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 4: Grande Dixence Dam ---
{
  const s = new Sim(3, { god: false, maxHp: 4, seed: 42 });
  // Room 0: bump L at (6,1) overhead from (6,2), step clear so slab pins hold-plate (6,2) -> open l4_g_intro!
  walkTo(s, 0, tileCenterX(6));
  s.tap('up', 4);
  s.waitIdle(60);
  s.hold('left', 18);
  s.waitIdle(60);
  s.step(80);
  crossRoom(s, 'right', 1);
  // Room 1: climb col 4 -> row 1, walk across L (5,1) -> drops onto sunken P (5,3) pinning l4_g_sluice!
  walkTo(s, 1, tileCenterX(4));
  climbOnce(s, 'right');
  walkTo(s, 1, tileCenterX(7));
  s.step(70); // let slab fall onto (5,3)
  dropInto(s, 'left'); // drop col 4 -> row 2 col 4
  walkTo(s, 1, tileCenterX(4) + 6);
  jumpGap(s, 'right', false); // jump col 5 gap -> col 6
  crossRoom(s, 'right', 2);
  // Room 2 & 3 (Four-Story Penstock Shaft): jump col 6 -> climb col 7 -> row 1 col 8 -> climb col 8 -> row 0 col 9 -> climb col 9 -> Room 3 row 3 col 8!
  walkTo(s, 2, tileCenterX(5) + 6);
  jumpGap(s, 'right', false); // col 7 row 2
  walkTo(s, 2, tileCenterX(7));
  climbOnce(s, 'right'); // row 1 col 8
  climbOnce(s, 'right'); // row 0 col 9
  climbOnce(s, 'left');  // Room 3 row 3 col 8!
  // Room 3: run across L(6,3) to col 4 so we step clear as it drops onto Room 2 L(6,1) -> pins Room 2 P(6,3) -> opens l4_g_spill!
  walkTo(s, 3, tileCenterX(4));
  s.step(140); // let the 4-story masonry chain hit Room 2 P(6,3) and pin l4_g_spill!
  // Jump right across broken (6,3) back to col 7, drop col 9 -> Room 2 row 0 col 9 -> col 8 -> row 1 col 8 -> col 7 -> row 2!
  walkTo(s, 3, tileCenterX(5) + 6);
  jumpGap(s, 'right', false);
  dropInto(s, 'right'); // drops into Room 2 row 0 col 9
  dropInto(s, 'left');  // drops into Room 2 row 1 col 8
  dropInto(s, 'left');  // drops into Room 2 row 2 col 7!
  crossRoom(s, 'right', 4);
  // Room 4: duel Dam Warden -> Room 5
  fightRoomFoe(s);
  crossRoom(s, 'right', 5);
  // Room 5: sprint over L col 3, careful-step across spikes col 7 -> Room 6
  walkTo(s, 5, tileCenterX(6) - 6);
  walkTo(s, 5, tileCenterX(9), { careful: true });
  crossRoom(s, 'right', 6);
  // Room 6: running jump cols 4..5 -> Room 7
  walkTo(s, 6, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  crossRoom(s, 'right', 7);
  // Room 7: duel M. Rochat -> Room 8
  fightRoomFoe(s);
  crossRoom(s, 'right', 8);
  // Room 8: step on P col 5 (opens l4_exit) -> Room 9!
  walkTo(s, 8, tileCenterX(5));
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4D Level 4 (Grande Dixence Dam) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 5: Chillon Viaduct ---
{
  const s = new Sim(4, { god: false, maxHp: 4, seed: 42 });
  // Room 0: pass hydraulic shutter col 5 -> Room 1
  passShutter(s, 'right', 5, tileCenterX(8));
  crossRoom(s, 'right', 1);
  // Room 1: bump L at (5,1) overhead from (5,2), step aside -> pins hold-plate (5,2) -> l5_g_sluice stays open!
  walkTo(s, 1, tileCenterX(5));
  s.tap('up', 4);
  s.step(8);
  walkTo(s, 1, tileCenterX(3));
  s.step(80);
  crossRoom(s, 'right', 2);
  // Room 2: pass shutter col 3, running jump cols 5..6, pass shutter col 9 -> Room 3
  passShutter(s, 'right', 3, tileCenterX(4) + 6);
  walkTo(s, 2, tileCenterX(4) - 8);
  jumpGap(s, 'right', true, tileCenterX(4) + 12);
  if (colOfX(s.p.x) < 7) {
    walkTo(s, 2, tileCenterX(2));
    jumpGap(s, 'right', true, tileCenterX(4) + 8);
  }
  passShutter(s, 'right', 9, tileCenterX(10) + 8);
  crossRoom(s, 'right', 3);
  // Room 3: duel Fiber Guard, then bump L at (6,1) onto hold-plate (6,2) -> l5_g_fiber opens -> Room 5!
  fightRoomFoe(s);
  walkTo(s, 3, tileCenterX(6));
  s.tap('up', 4);
  s.step(8);
  walkTo(s, 3, tileCenterX(4));
  s.step(80);
  crossRoom(s, 'right', 5);
  // Room 5: sprint over L col 3, pass shutter col 8 -> Room 6
  passShutter(s, 'right', 8, tileCenterX(10));
  crossRoom(s, 'right', 6);
  // Room 6 (Pillar of Bonivard): duel D. Favre, bump L at (5,1) onto hold-plate (5,2), pass shutter col 7 -> Room 7!
  fightRoomFoe(s);
  walkTo(s, 6, tileCenterX(5));
  s.tap('up', 4);
  s.step(8);
  walkTo(s, 6, tileCenterX(3));
  s.step(80);
  passShutter(s, 'right', 7, tileCenterX(9));
  crossRoom(s, 'right', 7);
  // Room 7: pass shutter col 3, climb col 7 -> row 1 -> climb col 6 -> row 0 -> hit P col 4 (l5_exit) -> drop -> pass shutter col 8 -> Room 8!
  passShutter(s, 'right', 3, tileCenterX(7));
  climbOnce(s, 'left'); // row 1 col 6
  walkTo(s, 7, tileCenterX(6));
  climbOnce(s, 'left'); // row 0 col 5
  walkTo(s, 7, tileCenterX(4)); // opens l5_exit!
  dropInto(s, 'right'); // row 1 col 6
  dropInto(s, 'right'); // row 2 col 7
  passShutter(s, 'right', 8, tileCenterX(10));
  crossRoom(s, 'right', 8);
  walkTo(s, 8, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4E Level 5 (Chillon Viaduct) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 6: CERN Ring Sector 4 ---
{
  const s = new Sim(5, { god: false, maxHp: 4, seed: 42 });
  passShutter(s, 'right', 5, tileCenterX(8));
  crossRoom(s, 'right', 1);
  passShutter(s, 'right', 2, tileCenterX(5));
  passShutter(s, 'right', 8, tileCenterX(10));
  crossRoom(s, 'right', 2);
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
  walkTo(s, 3, tileCenterX(0) + 12);
  jumpGap(s, 'right', true, tileCenterX(2) + 4);
  walkTo(s, 3, tileCenterX(5));
  climbOnce(s, 'right');
  walkTo(s, 3, tileCenterX(8));
  dropInto(s, 'left');
  crossRoom(s, 'right', 4);
  const mirrorBrokenBefore = s.level.mirrorBroken;
  crossRoom(s, 'right', 5);
  const mirrorBrokenAfter = s.level.mirrorBroken && s.level.deepfakeSpawned;
  passShutter(s, 'right', 6, tileCenterX(9));
  crossRoom(s, 'right', 6);
  walkTo(s, 6, tileCenterX(7) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 8);
  s.step(90);
  crossRoom(s, 'left', 6);
  dropInto(s, 'left');
  dropInto(s, 'right');
  dropInto(s, 'left');
  passShutter(s, 'left', 6, tileCenterX(3));
  walkTo(s, 7, tileCenterX(2));
  dropInto(s, 'left');
  s.tap('shift', 4);
  s.waitIdle(60);
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(5));
  walkTo(s, 7, tileCenterX(1));
  climbOnce(s, 'right');
  passShutter(s, 'right', 6, tileCenterX(8));
  climbOnce(s, 'right');
  walkTo(s, 7, tileCenterX(9));
  climbOnce(s, 'left');
  walkTo(s, 6, tileCenterX(8));
  climbOnce(s, 'right');
  crossRoom(s, 'right', 8);
  walkTo(s, 8, tileCenterX(4) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(!mirrorBrokenBefore && mirrorBrokenAfter && s.game.mode === 'interlude' && s.p.alive,
    '4F Level 6 (CERN Ring Sector 4) completable WITHOUT god mode',
    `mirror=${mirrorBrokenAfter} mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 7: Bundeshaus Archive ---
{
  const s = new Sim(6, { god: false, maxHp: 5, seed: 42 });
  // Room 0: climb col 3 -> row 1, hit Celine's note P col 5 -> drop col 3 -> vault Q col 6!
  walkTo(s, 0, tileCenterX(3));
  climbOnce(s, 'right');
  walkTo(s, 0, tileCenterX(5));
  dropInto(s, 'left');
  walkTo(s, 0, tileCenterX(5) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 1);
  // Room 1: sprint across L col 3, careful-step across spikes col 7 -> Room 2
  walkTo(s, 1, tileCenterX(6) - 6);
  walkTo(s, 1, tileCenterX(9), { careful: true });
  crossRoom(s, 'right', 2);
  // Room 2: pass shutter col 3 -> Room 3
  passShutter(s, 'right', 3, tileCenterX(8));
  crossRoom(s, 'right', 3);
  // Room 3: climb col 5 -> row 1, climb col 7 -> row 0, hit Celine's note P col 3 (l7_g_mint), drop col 7 -> col 5?
  // Wait: Q is at col 5! Let's ensure Room 3 row 1 hole is at col 3 so dropping lands cleanly left of Q col 5!
  walkTo(s, 3, tileCenterX(3));
  climbOnce(s, 'right');
  walkTo(s, 3, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 3, tileCenterX(3));
  dropInto(s, 'right');
  dropInto(s, 'left');
  walkTo(s, 3, tileCenterX(4) + 6);
  jumpGap(s, 'right', false); // vaults Q col 5 -> lands col 6
  crossRoom(s, 'right', 4);
  // Room 4: duel Mint Guard -> Room 5
  fightRoomFoe(s);
  crossRoom(s, 'right', 5);
  // Room 5 (Hall of 26 Cantons): Deepfake triggers Q col 4 (slams l7_g_canton) & breaks L col 7!
  s.step(90);
  // Drop through col 8 -> row 3 -> col 9 -> Room 7!
  walkTo(s, 5, tileCenterX(6) + 4);
  dropInto(s, 'right'); // col 7 or 8 -> row 3
  dropInto(s, 'right'); // col 9 -> Room 7 row 0!
  // Room 7: drop col 8 -> row 1, pass shutter col 6, hit Celine's note P col 2 (reopens l7_g_canton!), drop col 1 -> duel Archive Guard!
  dropInto(s, 'left');
  passShutter(s, 'left', 6, tileCenterX(2));
  dropInto(s, 'left');
  fightRoomFoe(s);
  // Climb back up Room 7 -> Room 5 -> vault Q col 4 & broken L/pit cols 7..8 -> Room 6!
  walkTo(s, 7, tileCenterX(1));
  climbOnce(s, 'right');
  passShutter(s, 'right', 6, tileCenterX(8));
  climbOnce(s, 'right');
  walkTo(s, 7, tileCenterX(9));
  climbOnce(s, 'left'); // Room 5 row 3
  walkTo(s, 5, tileCenterX(8));
  climbOnce(s, 'right'); // Room 5 row 2 col 9 (right of Q col 4 & pit col 8!)
  crossRoom(s, 'right', 6);
  // Room 6: pass shutter col 2, running jump cols 6..7 (land col 8), sprint over L col 9 -> Room 8
  passShutter(s, 'right', 2, tileCenterX(3));
  jumpGap(s, 'right', true, tileCenterX(5) - 6);
  crossRoom(s, 'right', 8);
  // Room 8: careful-step spikes col 3, climb col 5 -> row 1 -> climb col 8 -> row 0 -> hit P col 3 (l7_exit) -> drop -> Room 9!
  walkTo(s, 8, tileCenterX(2) - 4);
  walkTo(s, 8, tileCenterX(5), { careful: true });
  climbOnce(s, 'right');
  walkTo(s, 8, tileCenterX(8));
  climbOnce(s, 'left');
  walkTo(s, 8, tileCenterX(3));
  dropInto(s, 'right');
  dropInto(s, 'left');
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4G Level 7 (Bundeshaus Archive) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 8: Eigerwand Gallery ---
{
  const s = new Sim(7, { god: false, maxHp: 5, seed: 42 });
  // Room 0: wait for headwind lull & cross to Room 1
  waitWindActive(s, 0, false);
  crossRoom(s, 'right', 1);
  // Room 1: ride tailwind across 3-tile chasm cols 4..6!
  walkTo(s, 1, tileCenterX(1));
  waitWindActive(s, 1, true);
  jumpGap(s, 'right', true, tileCenterX(3) + 4);
  crossRoom(s, 'right', 2);
  // Room 2: careful-step spikes col 3 (Shift also braces headwind!) -> Room 3
  walkTo(s, 2, tileCenterX(2) - 4, { careful: true });
  walkTo(s, 2, tileCenterX(5), { careful: true });
  crossRoom(s, 'right', 3);
  // Room 3: running jump cols 4..5, climb col 7 LEFT -> row 1, hit P col 3 (l8_g_rack), drop col 7 -> Room 4!
  walkTo(s, 3, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 8);
  walkTo(s, 3, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 3, tileCenterX(3));
  dropInto(s, 'right');
  crossRoom(s, 'right', 4);
  // Room 4: duel Alpine Guard in storm -> Room 6
  fightRoomFoe(s);
  crossRoom(s, 'right', 6);
  // Room 6 (Panoramic Window 3): duel W. Blaser -> Room 7
  fightRoomFoe(s);
  crossRoom(s, 'right', 7);
  // Room 7 (Shattered Viaduct): brace with Shift while Deepfake drops LLL bridge, then ride tailwind across 3-tile chasm!
  walkTo(s, 7, tileCenterX(1));
  s.press('shift');
  s.step(100); // Brace while Deepfake runs across & drops LLL
  s.release('shift');
  waitWindActive(s, 7, true);
  jumpGap(s, 'right', true, tileCenterX(3) + 4);
  crossRoom(s, 'right', 8);
  // Room 8: pass shutter col 4, climb col 5 -> row 1 -> climb col 8 -> row 0 -> hit P col 3 (l8_exit) -> drop -> Room 9!
  passShutter(s, 'right', 4, tileCenterX(5));
  climbOnce(s, 'right');
  walkTo(s, 8, tileCenterX(8));
  climbOnce(s, 'left');
  walkTo(s, 8, tileCenterX(3));
  dropInto(s, 'right');
  dropInto(s, 'left');
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.game.mode === 'interlude' && s.p.alive,
    '4H Level 8 (Eigerwand Gallery) completable WITHOUT god mode',
    `mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 9: Jungfraujoch Ice Palace ---
{
  const s = new Sim(8, { god: false, maxHp: 5, seed: 42 });
  crossRoom(s, 'right', 1);
  walkTo(s, 1, tileCenterX(0) + 12);
  jumpGap(s, 'right', true, tileCenterX(3) + 6);
  crossRoom(s, 'right', 2);
  walkTo(s, 2, tileCenterX(2) - 8);
  walkTo(s, 2, tileCenterX(5), { careful: true });
  walkTo(s, 2, tileCenterX(7) - 8);
  walkTo(s, 2, tileCenterX(10), { careful: true });
  crossRoom(s, 'right', 3);
  fightRoomFoe(s);
  crossRoom(s, 'right', 5);
  walkTo(s, 5, tileCenterX(6));
  climbOnce(s, 'left');
  walkTo(s, 5, tileCenterX(4));
  dropInto(s, 'right');
  crossRoom(s, 'right', 6);
  walkTo(s, 6, tileCenterX(0) + 12);
  jumpGap(s, 'right', true, tileCenterX(2) + 4);
  crossRoom(s, 'right', 7);
  fightRoomFoe(s);
  walkTo(s, 7, tileCenterX(7) + 6);
  jumpGap(s, 'right', false);
  crossRoom(s, 'right', 8);
  s.step(12);
  s.tap('down', 5);
  s.waitIdle(60);
  walkTo(s, 8, tileCenterX(10));
  crossRoom(s, 'right', 9);
  walkTo(s, 9, tileCenterX(7));
  s.tap('up', 5);
  s.step(10);
  totalSimFrames += s.frames;
  R.check(s.level.deepfakeMerged && s.game.mode === 'interlude' && s.p.alive,
    '4I Level 9 (Jungfraujoch Ice Palace) completable WITHOUT god mode',
    `merged=${s.level.deepfakeMerged} mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

// --- LEVEL 10: Sphinx Observatory Summit ---
{
  const s = new Sim(9, { god: false, maxHp: 6, seed: 42 });
  passShutter(s, 'right', 8, tileCenterX(10));
  crossRoom(s, 'right', 1);
  walkTo(s, 1, tileCenterX(1) - 4);
  walkTo(s, 1, tileCenterX(4), { careful: true });
  passShutter(s, 'right', 6, tileCenterX(9));
  crossRoom(s, 'right', 2);
  fightRoomFoe(s);
  crossRoom(s, 'right', 3);
  walkTo(s, 3, tileCenterX(1));
  jumpGap(s, 'right', true, tileCenterX(3) + 4);
  walkTo(s, 3, tileCenterX(7));
  climbOnce(s, 'left');
  walkTo(s, 3, tileCenterX(3));
  dropInto(s, 'right');
  crossRoom(s, 'right', 4);
  fightRoomFoe(s);
  walkTo(s, 4, tileCenterX(5));
  jumpGap(s, 'right', true, tileCenterX(7) + 4);
  crossRoom(s, 'right', 5);
  passShutter(s, 'right', 4, tileCenterX(9));
  s.tap('shift', 5);
  s.waitIdle(60);
  crossRoom(s, 'right', 6);
  const zins = s.game.enemies.find((e) => e.type === 'zins');
  const duelWon = fightRoomFoe(s, 2600);
  walkTo(s, 6, tileCenterX(10));
  crossRoom(s, 'right', 7);
  walkTo(s, 7, tileCenterX(9));
  totalSimFrames += s.frames;
  R.check(duelWon && !zins.alive && s.game.mode === 'victory' && s.p.alive,
    '4J Level 10 (Sphinx Observatory + Dr. Viktor Zins + Celine) completable WITHOUT god mode',
    `duelWon=${duelWon} zinsAlive=${zins.alive} mode=${s.game.mode} t=${(s.frames * DT).toFixed(1)}s ${JSON.stringify(s.snap())}`);
}

console.log(`Total 10-level bot clear time: ${(totalSimFrames * DT / 60).toFixed(2)} min (${(totalSimFrames * DT).toFixed(1)}s) / 60.00 min budget.`);

process.exit(R.print() ? 0 : 1);
