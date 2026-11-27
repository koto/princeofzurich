// src/levels/level4.js
// Level 4: Grande Dixence Dam Galleries (Canton Valais, 2,365m - 23:19 CET) (10 rooms)
// One New Gameplay Idea: Vertical Falling-Debris Puzzle Triggers — dislodging loose concrete
// slabs (L) above (running across or jumping beneath them) to drop masonry onto lower hold-plates!
// Set-Piece: The Four-Story Penstock Shaft (Rooms 2 & 3).

export const level4 = {
  id: 3,
  name: 'Grande Dixence Dam',
  subtitle: 'VALAIS (2,365M) - 23:19',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: 2140M Inspection Gallery (Safe teaching room: bump L overhead or walk across it to pin hold-plate P!)
    0: {
      seed: 1401,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'BREAK LOOSE SLABS ABOVE TO TRIGGER LOWER SLUICE PLATES.',
      grid: [
        '############',
        '#___._L___##',
        '#_____P___G_',
        '############',
      ],
      plates: [
        { col: 6, row: 2, targetId: 'l4_g_intro', action: 'open', hold: true },
      ],
      gates: [
        { id: 'l4_g_intro', col: 10, row: 2, stayOpen: false },
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 1: Turbine Sluice (All 4 rows 0..3: bump L at (5,1) -> drops past '.' at (5,2) onto sunken P at (5,3)!)
    1: {
      seed: 1402,
      links: { left: 0, right: 2, up: null, down: null },
      hint: 'JUMP UNDER CRACKED CEILINGS TO DROP MASONRY BELOW.',
      grid: [
        '#______.___#',
        '#___.L_____#',
        '_____.____G_',
        '####_P_#####',
      ],
      plates: [
        { col: 5, row: 3, targetId: 'l4_g_sluice', action: 'open', hold: true },
      ],
      gates: [
        { id: 'l4_g_sluice', col: 10, row: 2, stayOpen: false },
      ],
      items: [
        { col: 9, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 3, row: 1, type: 'torch' },
      ],
    },

    // Room 2: SET-PIECE Lower Penstock Shaft (Spillway gate blocked; climb UP to Room 3 & chain 2 slab drops!)
    2: {
      seed: 1403,
      links: { left: 1, right: 4, up: 3, down: null },
      hint: 'CLIMB THE PENSTOCK SHAFT. DROP UPPER SLABS TO PIN THE LOWER VALVE.',
      grid: [
        '##____._.___',
        '#_____L.___#',
        '______.____G',
        '####__P_####',
      ],
      plates: [
        { col: 6, row: 3, targetId: 'l4_g_spill', action: 'open', hold: true },
      ],
      gates: [
        { id: 'l4_g_spill', col: 11, row: 2, stayOpen: false },
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 3: SET-PIECE Upper Penstock Shaft (Above Room 2 — break L at (6,1) -> breaks L at (6,3) -> pins Room 2 (6,3)!)
    3: {
      seed: 1404,
      links: { left: null, right: null, up: null, down: 2 },
      hint: 'DISLODGE THE UPPER SLAB TO CHAIN MASONRY DOWN FOUR STORIES.',
      grid: [
        '##____.____#',
        '#____.L____#',
        '#_____.____#',
        '#_____L__._#',
      ],
      items: [
        { col: 9, row: 0, type: 'large_elixir' },
      ],
      decor: [
        { col: 3, row: 1, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 4: Valve Gallery (Duel Dam Warden + 3-tier catwalk)
    4: {
      seed: 1405,
      links: { left: 2, right: 5, up: null, down: null },
      grid: [
        '############',
        '#_____.____#',
        '____________',
        '############',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      enemies: [
        {
          col: 8, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2,
          archetype: 'sentry', name: 'Dam Warden',
          bark: '"285 METERS OF VALAIS CONCRETE. NO ZURICH SHORTCUTS!"',
        },
      ],
      decor: [
        { col: 4, row: 2, type: 'torch' },
      ],
    },

    // Room 5: Weeping Concrete Chasm (Loose bridge + spikes + upper gallery bypass)
    5: {
      seed: 1406,
      links: { left: 4, right: 6, up: null, down: null },
      grid: [
        '############',
        '#___._______',
        '___L___^____',
        '##____######',
      ],
      decor: [
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 6: Hydro Penstock Span (2-tile running jump + lower inspection catch shelf)
    6: {
      seed: 1407,
      links: { left: 5, right: 7, up: null, down: null },
      grid: [
        '############',
        '______.____#',
        '____..______',
        '###____#####',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 8, row: 2, type: 'torch' },
      ],
    },

    // Room 7: Upper Concrete Girder — SET-PIECE DUEL with Valais Dam Inspector M. Rochat!
    7: {
      seed: 1408,
      links: { left: 6, right: 8, up: null, down: null },
      grid: [
        '#____._____#',
        '#_______.###',
        '____________',
        '############',
      ],
      items: [
        { col: 2, row: 0, type: 'small_elixir' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'guard', facing: -1, hp: 4, skill: 3,
          archetype: 'brawler', name: 'M. Rochat',
          bark: '"ZURICH MUD ON MY PENSTOCK? UNACCEPTABLE."',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 8: Spillway Control (4-floor climb + falling slab trigger or direct step on Exit Plate)
    8: {
      seed: 1409,
      links: { left: 7, right: 9, up: null, down: null },
      grid: [
        '#____L_.___#',
        '#_____.____#',
        '_____P______',
        '############',
      ],
      plates: [
        { col: 5, row: 2, targetId: 'l4_exit', action: 'open' },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
        { col: 9, row: 0, type: 'sign' },
      ],
    },

    // Room 9: Rhone-to-Leman Hydro Drain Exit
    9: {
      seed: 1410,
      links: { left: 8, right: null, up: null, down: null },
      hint: 'SPILLWAY DRAIN OPEN. FOLLOW THE PIPE WEST TO CHILLON.',
      grid: [
        '############',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l4_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
