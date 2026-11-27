// src/levels/level10.js
// Level 10: Sphinx Observatory Summit (Jungfraujoch, 3,571m - 23:55 CET) (8 rooms)
// [Existing Level 5 finale preserved with Story Bible text, Foehn wind synthesis on Room 1,
//  Dr. Viktor Zins 3-phase boss duel, and the Four-Eyes Dual-Key Abort with Celine Amrein!]

export const level10 = {
  id: 9,
  name: 'Sphinx Observatory',
  subtitle: 'JUNGFRAUJOCH (3,571M) - 23:55',
  ice: false,
  slicerPeriod: 2.1,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Elevator Landing (Uses all 4 rows 0..3 under open starry summit sky!)
    0: {
      seed: 501,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'SUMMIT DOME AHEAD. CELINE HAS THREE BUSBARS PULLED.',
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

    // Room 1: Summit Gauntlet (Synthesizes open-sky Foehn wind + spikes + cryo-shutters!)
    1: {
      seed: 502,
      links: { left: 0, right: 2, up: null, down: null },
      wind: { dir: -1, period: 6.2, warnStart: 2.4, gustStart: 3.2, gustEnd: 4.8, cols: [4, 5, 6, 7, 8] },
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

    // Room 2: Security Checkpoint (3-tier elite arena with summit Reserve Tonic on row 0)
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
        {
          col: 8, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4,
          archetype: 'brawler', name: 'Zins Bodyguard',
          bark: '"THE CHAIRMAN IS NOT TAKING WALK-INS AT 23:56."',
        },
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
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      plates: [
        { col: 3, row: 1, targetId: 'l10_g_dome', action: 'open' },
        { col: 11, row: 2, targetId: 'l10_g_dome', action: 'open' },
      ],
      gates: [
        { id: 'l10_g_dome', col: 10, row: 2, openDuration: 10, stayOpen: false },
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
        {
          col: 6, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4,
          archetype: 'duellist', name: 'Chief of Security',
          bark: '"ALL FOUR BUSBARS COMMIT AT MIDNIGHT. STAND DOWN."',
        },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 5: Antechamber before Zins (Open sky + upper walkway + final heal)
    5: {
      seed: 506,
      links: { left: 4, right: 6, up: null, down: null },
      hint: 'DR. ZINS PARRIES IMPATIENCE. PARRY (UP), THEN RIPOSTE.',
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

    // Room 6: SET-PIECE — Narrow 3,571m Summit Walkway (OPEN-SKY FINAL DUEL WITH DR. VIKTOR ZINS!)
    6: {
      seed: 507,
      links: { left: 5, right: 7, up: null, down: null },
      hint: 'DR. ZINS: "TWENTY-SIX CANTONS WAS ALWAYS TOO MANY, BRUNNER."',
      grid: [
        '............',
        '............',
        '__________P_',
        '##........##',
      ],
      plates: [
        { col: 10, row: 2, targetId: 'l10_exit', action: 'open' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'zins', facing: -1, hp: 9, skill: 5,
          archetype: 'boss', name: 'Dr. Viktor Zins',
          bark: '"TWENTY-SIX CANTONS WAS ALWAYS TOO MANY, BRUNNER."',
        },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 7: Sphinx Observatory Dome — Four-Eyes Dual-Key Abort with Celine Amrein!
    7: {
      seed: 508,
      links: { left: 6, right: null, up: null, down: null },
      hint: 'STAND BESIDE CELINE AT THE CONSOLE. TURN BOTH KEYS.',
      grid: [
        '###......###',
        '###......###',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l10_exit', col: 7, row: 2 },
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
