// src/levels/level2.js
// Level 2: Gotthard Reduit Army Bunker (10 rooms)
// Teaches: proximity spikes (safe with Shift careful-step), 2-tile running jumps,
// survivable vertical recovery shafts, close-plates, poison decoy, and pit/spike combat.

export const level2 = {
  id: 1,
  name: 'Gotthard Reduit Bunker',
  subtitle: '23:12 — Alpine Defense Corridor',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Bunker Airlock (Spikes tutorial + upper gallery)
    0: {
      seed: 201,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'Hold SHIFT + Arrow to careful-step safely across spikes, or climb the bunker catwalk.',
      grid: [
        '############',
        '#_____._____',
        '#___^_______',
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

    // Room 1: Long-Jump Chasm (2-tile running jump + staggered survivable drop/climb to Room 4)
    1: {
      seed: 202,
      links: { left: 0, right: 2, up: null, down: 4 },
      hint: 'Sprint and press UP to running-jump across wide chasms. Hold SHIFT while falling to catch ledges!',
      grid: [
        '############',
        '_______.___#',
        '____..______',
        '###__.######',
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 4: Lower Maintenance Pit (2-floor survivable recovery from Room 1 + climb back up!)
    4: {
      seed: 203,
      links: { left: null, right: 5, up: 1, down: null },
      hint: 'Lower Maintenance Pit: recover your health, then climb back up the vertical shafts.',
      grid: [
        '####____.__#',
        '#______.____',
        '#___________',
        '############',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 3, row: 2, type: 'torch' },
      ],
    },

    // Room 5: Ammunition Depot (Large Elixir vs bluish Poison decoy + climb up to Room 2!)
    5: {
      seed: 204,
      links: { left: 4, right: null, up: 2, down: null },
      hint: 'Crimson elixirs heal. Bluish flasks are bunker coolant — avoid!',
      grid: [
        '####____.__#',
        '______.____#',
        '___________#',
        '############',
      ],
      items: [
        { col: 3, row: 2, type: 'poison' },
        { col: 9, row: 2, type: 'large_elixir' },
      ],
      enemies: [
        { col: 6, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2, name: 'Reduit Corporal' },
      ],
      decor: [
        { col: 8, row: 1, type: 'sign' },
      ],
    },

    // Room 2: Reduit Sentry Post (Pit-edge guard duel + climb up from Room 5)
    2: {
      seed: 205,
      links: { left: 1, right: 3, up: null, down: 5 },
      grid: [
        '############',
        '#_____._____',
        '____..______',
        '###__.######',
      ],
      enemies: [
        { col: 9, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2, name: 'Bunker Sentry' },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
      ],
    },

    // Room 3: Close-Plate Trap Corridor (Jump over red close-plate; reopen plate prevents soft-lock)
    3: {
      seed: 206,
      links: { left: 2, right: 6, up: null, down: null },
      hint: 'Red plates SLAM gates shut — jump over them!',
      grid: [
        '############',
        '___._P_____#',
        '______Q___GP',
        '############',
      ],
      plates: [
        { col: 5, row: 1, targetId: 'l2_g_blast', action: 'open' },
        { col: 6, row: 2, targetId: 'l2_g_blast', action: 'close' },
        { col: 11, row: 2, targetId: 'l2_g_blast', action: 'open' },
      ],
      gates: [
        { id: 'l2_g_blast', col: 10, row: 2, openDuration: 11, stayOpen: false },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
      ],
    },

    // Room 6: Spike & Loose Floor Gallery (3-tier bunker shaft)
    6: {
      seed: 207,
      links: { left: 3, right: 7, up: null, down: null },
      grid: [
        '############',
        '#____.______',
        '___L___^____',
        '#_____######',
      ],
      items: [
        { col: 9, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 6, row: 2, type: 'torch' },
      ],
    },

    // Room 7: Officer's Bridge (Upper catwalk + knock guard onto spikes!)
    7: {
      seed: 208,
      links: { left: 6, right: 8, up: null, down: null },
      hint: 'Tip: Fence guards backward onto spikes or off ledges!',
      grid: [
        '############',
        '_____._____#',
        '_________^^_',
        '############',
      ],
      enemies: [
        { col: 6, row: 2, type: 'guard', facing: -1, hp: 4, skill: 2, name: 'Reduit Major' },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
      ],
    },

    // Room 8: Blast Door Control (3-floor pit-edge duel + upper exit plate)
    8: {
      seed: 209,
      links: { left: 7, right: 9, up: null, down: null },
      grid: [
        '############',
        '#__P___.___#',
        '____..______',
        '###____#####',
      ],
      plates: [
        { col: 3, row: 1, targetId: 'l2_exit', action: 'open' },
      ],
      enemies: [
        { col: 8, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2, name: 'Tunnel Guard' },
      ],
      decor: [
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 9: Gotthard Express Shaft Exit
    9: {
      seed: 210,
      links: { left: 8, right: null, up: null, down: null },
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
