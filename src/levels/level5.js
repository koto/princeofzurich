// src/levels/level5.js
// Level 5: Chateau de Chillon Viaduct Vaults (Montreux, Vaud, 372m - 23:25 CET) (9 rooms)
// One New Gameplay Idea: Timed Hydraulic Sluice-Shutters (C, 2.7s gentle cadence) &
// Hold-Plates (hold: true) requiring fallen masonry or a defeated guard to stay pinned!
// Set-Piece: The Pillar of Bonivard (Room 6) — duel D. Favre + pin floodgate + hydraulic sprint.

export const level5 = {
  id: 4,
  name: 'Chillon Viaduct',
  subtitle: 'MONTREUX, VAUD (372M) - 23:25',
  ice: false,
  slicerPeriod: 2.7,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Viaduct Entry Vault (Teaches gentler 2.7s hydraulic shutter + upper Savoyard gallery)
    0: {
      seed: 1501,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'HYDRAULIC SHUTTERS CYCLE ON A BEAT. SPRINT ON OPEN.',
      grid: [
        '############',
        '#______.___#',
        '#____C______',
        '############',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 2, row: 2, type: 'sign' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 1: Lake-Surge Sluice (Teaches hold-plate: drop overhead L stone to pin floodgate open!)
    1: {
      seed: 1502,
      links: { left: 0, right: 2, up: null, down: null },
      hint: 'HOLD-PLATES CLOSE WHEN EMPTY. DROP STONE OR GUARD.',
      grid: [
        '############',
        '#___.L_____#',
        '_____P____G_',
        '############',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      plates: [
        { col: 5, row: 2, targetId: 'l5_g_sluice', action: 'open', hold: true },
      ],
      gates: [
        { id: 'l5_g_sluice', col: 10, row: 2, stayOpen: false },
      ],
      decor: [
        { col: 3, row: 2, type: 'torch' },
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 2: A9 Pier Cistern (Hydraulic shutters + survivable lake-cellar drop Room 4)
    2: {
      seed: 1503,
      links: { left: 1, right: 3, up: null, down: 4 },
      grid: [
        '############',
        '#_____.____#',
        '___C_..__C__',
        '####__.#####',
      ],
      decor: [
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 4: Sub-Lake Bedrock Cellar (Below Room 2 — survivable 2-floor drop + tonic + climb back)
    4: {
      seed: 1504,
      links: { left: null, right: null, up: 2, down: null },
      hint: 'BEDROCK CELLAR: DRY YOUR BOOTS AND CLIMB BACK TO THE PIER.',
      grid: [
        '#####___.__#',
        '#______.____',
        '#__________#',
        '############',
      ],
      items: [
        { col: 2, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 8, row: 2, type: 'torch' },
      ],
    },

    // Room 3: Romandie Fiber Gallery (Duel Fiber Guard — drop overhead L OR defeat guard onto hold-plate P!)
    3: {
      seed: 1505,
      links: { left: 2, right: 5, up: null, down: null },
      grid: [
        '############',
        '#____.L____#',
        '______P___G_',
        '############',
      ],
      plates: [
        { col: 6, row: 2, targetId: 'l5_g_fiber', action: 'open', hold: true },
      ],
      gates: [
        { id: 'l5_g_fiber', col: 10, row: 2, stayOpen: false },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'guard', facing: -1, hp: 3, skill: 3,
          archetype: 'sentry', name: 'Fiber Guard',
          bark: '"DAMP BOOTS ON SAVOYARD STONE? UNFORGIVABLE."',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
      ],
    },

    // Room 5: Motorway Archway (All 4 rows 0..3 verticality + optional upper Reserve Tonic!)
    5: {
      seed: 1506,
      links: { left: 3, right: 6, up: null, down: null },
      grid: [
        '#______.___#',
        '#___C__.____',
        '___L____C___',
        '##____######',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
        { col: 9, row: 0, type: 'large_elixir' },
      ],
      decor: [
        { col: 2, row: 0, type: 'torch' },
        { col: 6, row: 2, type: 'sign' },
      ],
    },

    // Room 6: SET-PIECE — The Pillar of Bonivard (Duel D. Favre + drop stone onto hold-plate + shutter!)
    6: {
      seed: 1507,
      links: { left: 5, right: 7, up: null, down: null },
      grid: [
        '#_____.____#',
        '#___.L_____#',
        '_____P_C__G_',
        '############',
      ],
      plates: [
        { col: 5, row: 2, targetId: 'l5_g_bonivard', action: 'open', hold: true },
      ],
      gates: [
        { id: 'l5_g_bonivard', col: 10, row: 2, stayOpen: false },
      ],
      enemies: [
        {
          col: 4, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3,
          archetype: 'duellist', name: 'D. Favre',
          bark: '"LORD BYRON HAD BETTER MANNERS THAN YOU, COURIER."',
        },
      ],
      items: [
        { col: 2, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 7: Geneva Fiber Trunk (Double hydraulic cadence + upper Exit Plate on row 0)
    7: {
      seed: 1508,
      links: { left: 6, right: 8, up: null, down: null },
      grid: [
        '#___P_.____#',
        '#______.____',
        '___C____C___',
        '############',
      ],
      plates: [
        { col: 4, row: 0, targetId: 'l5_exit', action: 'open' },
      ],
      decor: [
        { col: 8, row: 0, type: 'torch' },
        { col: 2, row: 2, type: 'sign' },
      ],
    },

    // Room 8: Meyrin Fiber Bore Exit
    8: {
      seed: 1509,
      links: { left: 7, right: null, up: null, down: null },
      hint: 'GENEVA FIBER BORE OPEN. CERN SECTOR 4 LIES WEST.',
      grid: [
        '############',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l5_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
