// src/levels/level9.js
// Level 9: Jungfraujoch Ice Palace (Aletsch Glacier, 3,454m - 23:50 CET) (10 rooms)
// [Existing Level 4 renumbered with Story Bible text, guard names/barks, and verbatim merge cues]
// One New Gameplay Idea: Glacial Ice Friction (Doubled Skid) & The Sympathetic Mirror Duel.

export const level9 = {
  id: 8,
  name: 'Jungfrau Ice Palace',
  subtitle: 'ALETSCH GLACIER (3,454M) - 23:50',
  ice: true,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Glacial Threshold (3-tier ice cavern teaching longer skid on ice)
    0: {
      seed: 401,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'GLACIER ICE DOUBLES YOUR SKID. BRAKE EARLY OR SHIFT-STEP.',
      grid: [
        '############',
        '#___.______#',
        '#_____L_____',
        '####_____###',
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 1: Crevasse Ice Bridge (Loose ice bridge + staggered survivable drop/climb to Room 4)
    1: {
      seed: 402,
      links: { left: 0, right: 2, up: null, down: 4 },
      grid: [
        '############',
        '#______.___#',
        '___LL.______',
        '###..__#####',
      ],
      decor: [
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 4: Sub-Glacial Shelf (Survivable 2-floor drop from Room 1 + clean climb back up!)
    4: {
      seed: 403,
      links: { left: null, right: null, up: 1, down: null },
      hint: 'SUB-GLACIAL SHELF: RECOVER AND CLIMB THE ICE SHAFTS BACK.',
      grid: [
        '##_____.___#',
        '#__._______#',
        '#__________#',
        '############',
      ],
      items: [
        { col: 9, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 5, row: 1, type: 'torch' },
      ],
    },

    // Room 2: Frost Spike Corridor (2-tier glacial passage)
    2: {
      seed: 404,
      links: { left: 1, right: 3, up: null, down: null },
      grid: [
        '############',
        '#_____._____',
        '___^____^___',
        '############',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 3, row: 1, type: 'torch' },
      ],
    },

    // Room 3: Alpine Patrol (2-tier guard chamber + upper Reserve Tonic)
    3: {
      seed: 405,
      links: { left: 2, right: 5, up: null, down: null },
      grid: [
        '############',
        '_____._____#',
        '____________',
        '############',
      ],
      items: [
        { col: 9, row: 1, type: 'large_elixir' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3,
          archetype: 'brawler', name: 'Ice Sentry',
          bark: '"STOP SLIDING. THIS IS A REGULATED GLACIER."',
        },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 5: Frozen Portcullis (3-floor timed ice gate + reopen plate prevents soft-lock)
    5: {
      seed: 406,
      links: { left: 3, right: 6, up: null, down: null },
      grid: [
        '############',
        '#___P_.____#',
        '___L______GP',
        '##___#######',
      ],
      plates: [
        { col: 4, row: 1, targetId: 'l9_g_ice', action: 'open' },
        { col: 11, row: 2, targetId: 'l9_g_ice', action: 'open' },
      ],
      gates: [
        { id: 'l9_g_ice', col: 10, row: 2, openDuration: 11, stayOpen: false },
      ],
      decor: [
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 6: Ice Cavern Leap (Vaulted 3-tier crevasse)
    6: {
      seed: 407,
      links: { left: 5, right: 7, up: null, down: null },
      grid: [
        '##........##',
        '#______.____',
        '___..___L___',
        '##____##___#',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 7: Glacier Captain (Vaulted pit-edge elite duel!)
    7: {
      seed: 408,
      links: { left: 6, right: 8, up: null, down: null },
      grid: [
        '##........##',
        '_____._____#',
        '________.___',
        '######_____#',
      ],
      enemies: [
        {
          col: 6, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4,
          archetype: 'duellist', name: 'Glacier Captain',
          bark: '"SUMMIT LIFT IS SEALED BY AUDIT ORDER. HOLD!"',
        },
      ],
      decor: [
        { col: 4, row: 2, type: 'banner' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 8: SET-PIECE — THE CREVASSE SPAN (Sympathetic Mirror Duel with The Deepfake!)
    // Striking the Deepfake hurts you too; press Down to sheathe, then walk into it to merge!
    8: {
      seed: 409,
      links: { left: 7, right: 9, up: null, down: null },
      hint: 'STRIKING YOUR COPY HURTS YOU. PRESS DOWN TO SHEATHE.',
      grid: [
        '#..........#',
        '#__......__#',
        '__________P_',
        '##........##',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      plates: [
        { col: 10, row: 2, targetId: 'l9_exit', action: 'open' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'deepfake', facing: -1, hp: 4, skill: 4,
          archetype: 'duellist', name: 'The Deepfake',
          bark: '"SAME ID, LUCA. YOU ARE AUDITING YOUR OWN RIBS."',
        },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },

    // Room 9: Rock-Core Summit Lift Exit (108m straight up to Sphinx Observatory!)
    9: {
      seed: 410,
      links: { left: 8, right: null, up: null, down: null },
      hint: 'SUMMIT LIFT CLEARED. 108 METERS UP TO SPHINX OBSERVATORY.',
      grid: [
        '##........##',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l9_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
      ],
    },
  },
};
