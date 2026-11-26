// src/levels/level8.js
// Level 8: Eigerwand North-Face Gallery (Jungfraubahn, 2,865m - 23:44 CET) (10 rooms)
// One New Gameplay Idea: Periodic Alpine Foehn Wind Gusts (room.wind) — headwinds push unbraced
// fighters backward (brace with Shift or Down crouch), while timed tailwinds stretch running
// jumps across impossible 3-tile broken rack-rail chasms!
// Set-Piece: Panoramic Window 3 (Room 6 duel vs W. Blaser) + Shattered Viaduct (Room 7 tailwind leap!).

export const level8 = {
  id: 7,
  name: 'Eigerwand Gallery',
  subtitle: 'NORTH FACE (2,865M) - 23:44',
  ice: false,
  slicerPeriod: 2.2,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Eigerwand Station Platform (Safe headwind tutorial — brace with Shift or Down!)
    0: {
      seed: 1801,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'WATCH SNOW AT CLIFF WINDOWS. BRACE HEADWINDS, RIDE TAILWINDS.',
      wind: { dir: -1, period: 5.5, warnStart: 1.8, gustStart: 2.5, gustEnd: 4.5, cols: [4, 5, 6, 7, 8] },
      grid: [
        '############',
        '#_____.____#',
        '#___________',
        '############',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 1: Tailwind Viaduct 1 (Teaches 3-tile tailwind super-jump with safe climb-back shelf!)
    1: {
      seed: 1802,
      links: { left: 0, right: 2, up: null, down: null },
      hint: 'SPRINT AND JUMP WITH THE TAILWIND TO CLEAR 3-TILE CHASMS.',
      wind: { dir: 1, period: 5.5, warnStart: 1.1, gustStart: 1.8, gustEnd: 4.8 },
      grid: [
        '#..........#',
        '#_____.____#',
        '____..._____',
        '###___..####',
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 2: Cogwheel Rack Shaft (All 4 rows 0..3: headwind + spikes + loose shelf)
    2: {
      seed: 1803,
      links: { left: 1, right: 3, up: null, down: null },
      hint: 'HOLD SHIFT OR CROUCH (DOWN) TO HOLD GROUND IN FOEHN GUSTS.',
      wind: { dir: -1, period: 5.8, warnStart: 2.0, gustStart: 2.8, gustEnd: 4.6, cols: [3, 4, 5, 6, 7] },
      grid: [
        '#_____.____#',
        '#___.___L__#',
        '___^________',
        '############',
      ],
      items: [
        { col: 2, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 9, row: 0, type: 'torch' },
      ],
    },

    // Room 3: Ice-Rimmed Switchback (Timed bulkhead + tailwind sprint + survivable shelter Room 5)
    3: {
      seed: 1804,
      links: { left: 2, right: 4, up: null, down: 5 },
      wind: { dir: 1, period: 6.0, warnStart: 2.0, gustStart: 2.8, gustEnd: 5.0 },
      grid: [
        '############',
        '#__P___.____',
        '____..____GP',
        '###__.######',
      ],
      plates: [
        { col: 3, row: 1, targetId: 'l8_g_rack', action: 'open' },
        { col: 11, row: 2, targetId: 'l8_g_rack', action: 'open' },
      ],
      gates: [
        { id: 'l8_g_rack', col: 10, row: 2, openDuration: 10, stayOpen: false },
      ],
      decor: [
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 5: Sub-Gallery Shelter (Below Room 3 — calm wind shelter + tonic + clean climb back)
    5: {
      seed: 1805,
      links: { left: null, right: null, up: 3, down: null },
      hint: 'SUB-GALLERY SHELTER: OUT OF THE FOEHN WIND. CLIMB BACK UP.',
      grid: [
        '####____.__#',
        '#______.____',
        '#__________#',
        '############',
      ],
      items: [
        { col: 2, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 6, row: 2, type: 'torch' },
      ],
    },

    // Room 4: North-Face Patrol (Duel Alpine Guard under periodic headwind gusts!)
    4: {
      seed: 1806,
      links: { left: 3, right: 6, up: null, down: null },
      wind: { dir: -1, period: 6.4, warnStart: 2.4, gustStart: 3.2, gustEnd: 4.8 },
      grid: [
        '##........##',
        '#_____.____#',
        '____________',
        '############',
      ],
      enemies: [
        {
          col: 8, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3,
          archetype: 'brawler', name: 'Alpine Guard',
          bark: '"TRACTION POWER IS OFF. TURN BACK, COURIER!"',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 6: SET-PIECE — Panoramic Window 3 (Duel Oberland Rail Marshal W. Blaser in storm!)
    6: {
      seed: 1807,
      links: { left: 4, right: 7, up: null, down: null },
      wind: { dir: -1, period: 6.5, warnStart: 2.5, gustStart: 3.3, gustEnd: 4.9 },
      grid: [
        '#_____.____#',
        '#___.___.###',
        '____________',
        '############',
      ],
      items: [
        { col: 2, row: 0, type: 'small_elixir' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4,
          archetype: 'duellist', name: 'W. Blaser',
          bark: '"TICKETS, PLEASE. HALBTAX OR STEEL, YOUR CALL."',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 7: SET-PIECE — Shattered Viaduct (Deepfake drops LLL bridge; ride tailwind across 3-tile gap!)
    7: {
      seed: 1808,
      links: { left: 6, right: 8, up: null, down: null },
      hint: 'RIDE THE FOEHN TAILWIND ACROSS THE SHATTERED VIADUCT!',
      wind: { dir: 1, period: 5.4, warnStart: 1.1, gustStart: 1.8, gustEnd: 4.8 },
      grid: [
        '#..........#',
        '#__......__#',
        '____LLL_____',
        '###___..####',
      ],
      enemies: [
        {
          col: 3, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 4,
          name: 'The Deepfake', scripted: 'viaduct_sabotage',
          taunt: 'DEEPFAKE: "UNREGISTERED COURIER. RE-ROUTING BRIDGE."',
        },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 8: Glacier Service Hatch Control (4-floor climb + shutter C + row 0 Exit Plate!)
    8: {
      seed: 1809,
      links: { left: 7, right: 9, up: null, down: null },
      grid: [
        '#__P____.__#',
        '#____._____#',
        '____C_______',
        '############',
      ],
      plates: [
        { col: 3, row: 0, targetId: 'l8_exit', action: 'open' },
      ],
      items: [
        { col: 9, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 6, row: 0, type: 'sign' },
        { col: 2, row: 2, type: 'torch' },
      ],
    },

    // Room 9: Aletsch Glacier Service Hatch Exit (Celine pops the glacier hatch!)
    9: {
      seed: 1810,
      links: { left: 8, right: null, up: null, down: null },
      hint: 'CELINE POPPED THE GLACIER HATCH. ENTER THE ICE PALACE.',
      grid: [
        '##........##',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l8_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
