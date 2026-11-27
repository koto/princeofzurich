// src/levels/level2.js
// Level 2: Olten SBB Gleis 0 (Solothurn, 396m - 23:06 CET) (9 rooms)
// One New Gameplay Idea: Red Lockdown Close-Plates (Q) & Tight Timed Bulkheads.
// Set-Piece: The Midnight Transfer Gantry (Room 5) — 9.5s departure bulkhead + twin Q plates.

export const level2 = {
  id: 1,
  name: 'Olten SBB Gleis 0',
  subtitle: 'SOLOTHURN (396M) - 23:06',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Platform 12 Access (Teaches red Q close-plate vs timed bulkhead on safe layout)
    0: {
      seed: 1201,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'RED LOCKDOWN PLATES SLAM GATES SHUT. VAULT THEM.',
      grid: [
        '####....####',
        '#__._P____##',
        '#_____Q___GP',
        '############',
      ],
      plates: [
        { col: 5, row: 1, targetId: 'l2_g_intro', action: 'open' },
        { col: 6, row: 2, targetId: 'l2_g_intro', action: 'close' },
        { col: 11, row: 2, targetId: 'l2_g_intro', action: 'open' },
      ],
      gates: [
        { id: 'l2_g_intro', col: 10, row: 2, openDuration: 11, stayOpen: false },
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 1: Switchyard Overpass (All 4 rows 0..3 verticality + optional upper tonic)
    1: {
      seed: 1202,
      links: { left: 0, right: 2, up: null, down: null },
      hint: 'RUN + UP CLEARS WIDE PITS. HOLD SHIFT TO CATCH LEDGES.',
      grid: [
        '#____._____#',
        '#_______.__#',
        '____._______',
        '###____#####',
      ],
      items: [
        { col: 2, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 6, row: 0, type: 'torch' },
        { col: 9, row: 2, type: 'sign' },
      ],
    },

    // Room 2: Points Inspection Bay (2-tile running jump + survivable sub-track recovery Room 4)
    2: {
      seed: 1203,
      links: { left: 1, right: 3, up: null, down: 4 },
      grid: [
        '############',
        '#_____.____#',
        '____..______',
        '###__.######',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 4: Sub-Track Recovery Conduit (Below Room 2 — 2-floor survivable + climb back)
    4: {
      seed: 1204,
      links: { left: null, right: null, up: 2, down: null },
      hint: 'SUB-TRACK CONDUIT: GRAB THE TONIC AND CLIMB BACK TO PLATFORM 0.',
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

    // Room 3: Ticket Control (Duel Points Guard Ruedi + upper bypass catwalk)
    3: {
      seed: 1205,
      links: { left: 2, right: 5, up: null, down: null },
      grid: [
        '############',
        '#_____._____',
        '____________',
        '############',
      ],
      enemies: [
        {
          col: 8, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2,
          archetype: 'sentry', name: 'Ruedi',
          bark: '"NO TICKET, NO PLATFORM ZERO. OVERTIME STARTS NOW."',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 10, row: 1, type: 'torch' },
      ],
    },

    // Room 5: SET-PIECE — The Midnight Transfer Gantry (4 floors, 9.5s bulkhead, twin Q plates!)
    5: {
      seed: 1206,
      links: { left: 3, right: 6, up: null, down: null },
      hint: 'CELINE: "STAY OFF RED SENSORS. CATCH THE 23:12 GAP."',
      grid: [
        '#___P_.___##',
        '___.___L___#',
        '____Q__Q__GP',
        '######___###',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      plates: [
        { col: 4, row: 0, targetId: 'l2_g_gantry', action: 'open' },
        { col: 4, row: 2, targetId: 'l2_g_gantry', action: 'close' },
        { col: 7, row: 2, targetId: 'l2_g_gantry', action: 'close' },
        { col: 11, row: 2, targetId: 'l2_g_gantry', action: 'open' },
      ],
      gates: [
        { id: 'l2_g_gantry', col: 10, row: 2, openDuration: 12.5, stayOpen: false },
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 8, row: 0, type: 'torch' },
      ],
    },

    // Room 6: Postal Freight Spur (Duel Night Marshal + upper row 0 tonic)
    6: {
      seed: 1207,
      links: { left: 5, right: 7, up: null, down: null },
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
          col: 7, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2,
          archetype: 'brawler', name: 'Night Marshal',
          bark: '"UNSCHEDULED POINTS INSPECTION. SHOW YOUR PASS!"',
        },
      ],
      decor: [
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 7: Signal Box Alpha (4-floor vertical climb to row 0 Exit Authorization Plate)
    7: {
      seed: 1208,
      links: { left: 6, right: 8, up: null, down: null },
      grid: [
        '#__P____.__#',
        '#____._____#',
        '___.___L____',
        '##____#___##',
      ],
      plates: [
        { col: 3, row: 0, targetId: 'l2_exit', action: 'open' },
      ],
      decor: [
        { col: 7, row: 0, type: 'sign' },
        { col: 2, row: 2, type: 'torch' },
      ],
    },

    // Room 8: Gleis 0 Freight Tunnel Exit
    8: {
      seed: 1209,
      links: { left: 7, right: null, up: null, down: null },
      hint: 'ALL SECRET TUNNELS ROUTE VIA OLTEN. BOARD THE SOUTH FREIGHT.',
      grid: [
        '############',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l2_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
