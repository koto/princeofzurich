// src/levels/level7.js
// Level 7: Bundeshaus Sub-Archives & Federal Mint (Bern, 542m - 23:38 CET) (10 rooms)
// One New Gameplay Idea: Active Deepfake Sabotage & Deceptive "Form 7-B" Routing
// (sabotaged Express Q plates vs Celine's yellow scribbled audit notes marking real overrides).
// Set-Piece: The Hall of 26 Cantons (Rooms 5 & 7) — Deepfake files Bern address & slams Mint grate.

export const level7 = {
  id: 6,
  name: 'Bundeshaus Archive',
  subtitle: 'BERN (542M) - 23:38',
  ice: false,
  slicerPeriod: 2.3,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Federal Archive Intake (Teaches deceptive Express Q plate vs Celine's yellow note!)
    0: {
      seed: 1701,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'DEEPFAKE REWIRED EXPRESS PLATES. TRUST CELINE\'S NOTES.',
      grid: [
        '############',
        '#__._P_____#',
        '#_____Q___GP',
        '############',
      ],
      plates: [
        { col: 5, row: 1, targetId: 'l7_g_intake', action: 'open' },
        { col: 6, row: 2, targetId: 'l7_g_intake', action: 'close' },
        { col: 11, row: 2, targetId: 'l7_g_intake', action: 'open' },
      ],
      gates: [
        { id: 'l7_g_intake', col: 10, row: 2, openDuration: 10, stayOpen: false },
      ],
      decor: [
        { col: 5, row: 1, type: 'note' },
        { col: 6, row: 2, type: 'sign' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 1: Rolling Ledger Stacks (3-tier verticality + spikes + loose shelf + Celine note tonic)
    1: {
      seed: 1702,
      links: { left: 0, right: 2, up: null, down: null },
      grid: [
        '#____._____#',
        '#_______.__#',
        '___L___^____',
        '##____######',
      ],
      items: [
        { col: 2, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 2, row: 0, type: 'note' },
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 2: Pneumatic Mail Gallery (Scripted Deepfake steals decoy tonic + shutter sprint)
    2: {
      seed: 1703,
      links: { left: 1, right: 3, up: null, down: null },
      grid: [
        '############',
        '#_____.____#',
        '___C________',
        '############',
      ],
      items: [
        { col: 9, row: 2, type: 'small_elixir' },
      ],
      enemies: [
        {
          col: 5, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 4,
          name: 'The Deepfake', scripted: 'steal_elixir',
          taunt: 'DEEPFAKE: "CONSOLIDATING YOUR TONIC. RECEIPT FILED."',
        },
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },

    // Room 3: Federal Mint Vault (All 4 rows 0..3: climb to row 0 Celine note P, vault Express Q below!)
    3: {
      seed: 1704,
      links: { left: 2, right: 4, up: null, down: null },
      grid: [
        '#__P___.####',
        '#__._______#',
        '_____Q____GP',
        '############',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      plates: [
        { col: 3, row: 0, targetId: 'l7_g_mint', action: 'open' },
        { col: 5, row: 2, targetId: 'l7_g_mint', action: 'close' },
        { col: 11, row: 2, targetId: 'l7_g_mint', action: 'open' },
      ],
      gates: [
        { id: 'l7_g_mint', col: 10, row: 2, openDuration: 11, stayOpen: false },
      ],
      decor: [
        { col: 3, row: 0, type: 'note' },
        { col: 5, row: 2, type: 'sign' },
        { col: 8, row: 1, type: 'torch' },
      ],
    },

    // Room 4: Mint Security Hall (Duel Mint Guard + upper tonic)
    4: {
      seed: 1705,
      links: { left: 3, right: 5, up: null, down: null },
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
          col: 8, row: 2, type: 'guard', facing: -1, hp: 4, skill: 3,
          archetype: 'brawler', name: 'Mint Guard',
          bark: '"PARLIAMENT IS AWAY. NO UNREGISTERED COURIERS!"',
        },
      ],
      decor: [
        { col: 4, row: 2, type: 'banner' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 5: SET-PIECE — The Hall of 26 Cantons (Deepfake files Bern address, slams Mint grate!)
    5: {
      seed: 1706,
      links: { left: 4, right: 6, up: null, down: 7 },
      hint: 'OVERRIDE THE MINT LOCKDOWN VIA THE PNEUMATIC DUCT.',
      grid: [
        '############',
        '#_____.____#',
        '____Q__L._G_',
        '#######__.##',
      ],
      plates: [
        { col: 4, row: 2, targetId: 'l7_g_canton', action: 'close' },
      ],
      gates: [
        { id: 'l7_g_canton', col: 10, row: 2, initiallyOpen: true, stayOpen: true },
      ],
      enemies: [
        {
          col: 2, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 4,
          name: 'The Deepfake', scripted: 'archive_sabotage',
          taunt: 'DEEPFAKE: "FILED YOUR BERN ADDRESS. YOU ARE WELCOME."',
        },
      ],
      decor: [
        { col: 8, row: 2, type: 'note' },
        { col: 3, row: 1, type: 'banner' },
      ],
    },

    // Room 7: Pneumatic Override Duct (Below Room 5 — duel Archive Guard, hit P to reopen l7_g_canton!)
    7: {
      seed: 1707,
      links: { left: null, right: null, up: 5, down: null },
      hint: 'CELINE\'S NOTE MARKS THE REAL OVERRIDE. CLEAR THE ARCHIVE GUARD.',
      grid: [
        '#####___.__#',
        '#.P___C____#',
        '#__________#',
        '############',
      ],
      plates: [
        { col: 2, row: 1, targetId: 'l7_g_canton', action: 'open' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'elite', facing: -1, hp: 4, skill: 4,
          archetype: 'duellist', name: 'Archive Guard',
          bark: '"YOUR TWIN ALREADY SIGNED FORM 7-B. MOVE ALONG."',
        },
      ],
      items: [
        { col: 9, row: 2, type: 'large_elixir' },
      ],
      decor: [
        { col: 2, row: 1, type: 'note' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 6: Aare Sluiceway (Multi-tier shutter + clean runway + 2-tile pit jump + loose floor)
    6: {
      seed: 1708,
      links: { left: 5, right: 8, up: null, down: null },
      grid: [
        '############',
        '#_____._____',
        '__C___.._L__',
        '#####______#',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 7, row: 1, type: 'torch' },
      ],
    },

    // Room 8: Chancellery Switchboard (4-floor climb to row 0 Celine note Exit Plate!)
    8: {
      seed: 1709,
      links: { left: 6, right: 9, up: null, down: null },
      grid: [
        '#__P____.__#',
        '#____._____#',
        '___^________',
        '############',
      ],
      plates: [
        { col: 3, row: 0, targetId: 'l7_exit', action: 'open' },
      ],
      items: [
        { col: 9, row: 0, type: 'small_elixir' },
      ],
      decor: [
        { col: 3, row: 0, type: 'note' },
        { col: 7, row: 2, type: 'sign' },
      ],
    },

    // Room 9: Bernese Oberland Tunnel Exit (South to Eigerwand!)
    9: {
      seed: 1710,
      links: { left: 8, right: null, up: null, down: null },
      hint: 'SERAFE BILL PENDING. PURSUE YOUR COPY SOUTH TO EIGERWAND.',
      grid: [
        '############',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l7_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
