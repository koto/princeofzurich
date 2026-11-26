// src/levels/level5.js
// Level 5: Sphinx Observatory Summit (8 rooms)
// Full 4-floor alpine summit ascent, pit-edge elite duel, open-sky boss duel with
// Dr. Viktor Zins on the narrow 3,571m summit walkway, and rescue of Celine Amrein!

export const level5 = {
  id: 4,
  name: 'Sphinx Observatory Summit',
  subtitle: '23:51 — 3,571m High-Altitude Dome',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Elevator Landing (Uses all 4 rows 0..3 under open starry summit sky!)
    0: {
      seed: 501,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'The summit dome lies ahead. Ascend the observatory tiers — midnight is close.',
      grid: [
        '#........___',
        '#_____._____',
        '#___L___C___',
        '##____######',
      ],
      items: [
        { col: 2, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 6, row: 2, type: 'banner' },
        { col: 10, row: 0, type: 'torch' },
      ],
    },

    // Room 1: Summit Gauntlet (3-tier alpine ridge: open-sky top, shutter mid, spike+shutter low)
    1: {
      seed: 502,
      links: { left: 0, right: 2, up: null, down: null },
      grid: [
        '___.._______',
        '______C_.__#',
        '__^___C_____',
        '############',
      ],
      decor: [
        { col: 9, row: 0, type: 'torch' },
      ],
    },

    // Room 2: Security Checkpoint (3-tier elite arena with summit Large Elixir on row 0)
    2: {
      seed: 503,
      links: { left: 1, right: 3, up: null, down: null },
      grid: [
        '______..___#',
        '#___.._____#',
        '____________',
        '############',
      ],
      items: [
        { col: 9, row: 0, type: 'large_elixir' },
      ],
      enemies: [
        { col: 8, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4, name: 'Zins Bodyguard' },
      ],
      decor: [
        { col: 2, row: 0, type: 'torch' },
      ],
    },

    // Room 3: Timed Observatory Gate (3-floor vaulted dome mechanism + reopen plate)
    3: {
      seed: 504,
      links: { left: 2, right: 4, up: null, down: null },
      grid: [
        '##........##',
        '#__P___.___#',
        '____..____GP',
        '###____#####',
      ],
      plates: [
        { col: 3, row: 1, targetId: 'l5_g_dome', action: 'open' },
        { col: 11, row: 2, targetId: 'l5_g_dome', action: 'open' },
      ],
      gates: [
        { id: 'l5_g_dome', col: 10, row: 2, openDuration: 10, stayOpen: false },
      ],
      decor: [
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 4: High-Altitude Catwalk (Open sky + pit/loose-catwalk elite duel!)
    4: {
      seed: 505,
      links: { left: 3, right: 5, up: null, down: null },
      grid: [
        '#...........',
        '#_____._____',
        '________L.__',
        '#######____#',
      ],
      enemies: [
        { col: 6, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4, name: 'Chief of Security' },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 5: Antechamber before Zins (Open sky + upper walkway + final heal)
    5: {
      seed: 506,
      links: { left: 4, right: 6, up: null, down: null },
      hint: 'Dr. Viktor Zins waits on the summit walkway. Parry (UP) then riposte (SHIFT)!',
      grid: [
        '...........#',
        '_______.___#',
        '____C_______',
        '############',
      ],
      items: [
        { col: 9, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 7, row: 2, type: 'banner' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 6: Narrow Summit Walkway — OPEN-SKY FINAL DUEL WITH DR. VIKTOR ZINS!
    6: {
      seed: 507,
      links: { left: 5, right: 7, up: null, down: null },
      hint: 'DR. VIKTOR ZINS: "Switzerland prefers consolidation, Herr Brunner."',
      grid: [
        '............',
        '............',
        '__________P_',
        '##........##',
      ],
      plates: [
        { col: 10, row: 2, targetId: 'l5_exit', action: 'open' },
      ],
      enemies: [
        { col: 7, row: 2, type: 'zins', facing: -1, hp: 6, skill: 5, name: 'Dr. Viktor Zins' },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 7: Sphinx Observatory Dome — Open-Glass Summit & Rescue Celine Amrein!
    7: {
      seed: 508,
      links: { left: 6, right: null, up: null, down: null },
      hint: 'Reach Celine at the cryptographic console to abort Operation Sechselaeuten!',
      grid: [
        '###......###',
        '###......###',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l5_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 9, row: 2, type: 'celine' },
        { col: 4, row: 2, type: 'torch' },
        { col: 10, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
