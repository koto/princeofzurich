// src/levels/level1.js
// Level 1: Paradeplatz Vaults, Zurich (9 rooms)
// Teaches: movement, jumps, ledge climbing, climb-down, loose floors, plates/gates,
// guild sabre pickup, optional vault verticality, and first fencing duels.

export const level1 = {
  id: 0,
  name: 'Paradeplatz Vaults, Zurich',
  subtitle: '23:00 — Sub-Basement 4',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: false },
  rooms: {
    // Room 0: Holding Vault (Start — teaches running, 1-tile pit jump, and ledge climbing)
    0: {
      seed: 101,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'ARROWS: Run/Jump. Press UP near a bright ledge lip to climb.',
      grid: [
        '############',
        '#......_____',
        '#___.___####',
        '#_______####',
      ],
      decor: [
        { col: 2, row: 2, type: 'torch' },
        { col: 9, row: 1, type: 'banner' },
      ],
    },

    // Room 1: Safe-Deposit Gallery (3-tier descent to Sabre Vault + mandatory locked upper gate)
    1: {
      seed: 102,
      links: { left: 0, right: 3, up: null, down: 2 },
      hint: 'Cracked tiles collapse. Descend the vault shaft to arm yourself and raise the grate.',
      grid: [
        '############',
        '___L______G_',
        '#____._____#',
        '#______.___#',
      ],
      gates: [
        { id: 'l1_g_vault', col: 10, row: 1, stayOpen: true },
      ],
      items: [
        { col: 8, row: 1, type: 'small_elixir' },
      ],
      decor: [
        { col: 4, row: 1, type: 'torch' },
        { col: 2, row: 2, type: 'sign' },
      ],
    },

    // Room 2: Guild Sabre Vault (Mandatory Sabre + vault gate plate + lower bonus recess)
    2: {
      seed: 103,
      links: { left: null, right: 4, up: 1, down: null },
      hint: 'Press SHIFT beside the Guild Sabre, then step on the brass plate to raise the upper grate.',
      grid: [
        '####____.__#',
        '#P___.______',
        '#_____L_____',
        '#####___####',
      ],
      plates: [
        { col: 1, row: 1, targetId: 'l1_g_vault', action: 'open' },
      ],
      items: [
        { col: 2, row: 1, type: 'sword' },
        { col: 7, row: 3, type: 'small_elixir' },
      ],
      decor: [
        { col: 2, row: 1, type: 'banner' },
        { col: 7, row: 0, type: 'torch' },
      ],
    },

    // Room 4: Bullion Undercroft (Optional 3-floor bonus vault with Large Elixir)
    4: {
      seed: 104,
      links: { left: 2, right: null, up: null, down: null },
      hint: 'Bullion Reserve: climb or jump for the gold-rimmed Reserve Elixir (+1 Max HP).',
      grid: [
        '############',
        '___L__.____#',
        '_____.___###',
        '#_______####',
      ],
      items: [
        { col: 9, row: 1, type: 'large_elixir' },
      ],
      decor: [
        { col: 6, row: 1, type: 'torch' },
      ],
    },

    // Room 3: Upper Promenade (Teaches climb-down & multi-tier traversal)
    3: {
      seed: 105,
      links: { left: 1, right: 5, up: null, down: null },
      hint: 'Press DOWN at a ledge edge to hang and climb down safely.',
      grid: [
        '############',
        '____._______',
        '#______.___#',
        '#________###',
      ],
      items: [
        { col: 2, row: 3, type: 'small_elixir' },
      ],
      decor: [
        { col: 3, row: 1, type: 'torch' },
        { col: 9, row: 1, type: 'banner' },
      ],
    },

    // Room 5: Portcullis Chamber (Timed gate puzzle + right-side reopen plate prevents soft-lock)
    5: {
      seed: 106,
      links: { left: 3, right: 6, up: null, down: null },
      hint: 'Step on the upper plate to raise the vault grate, then sprint through before it closes.',
      grid: [
        '############',
        '___.___P._##',
        '#_________GP',
        '############',
      ],
      plates: [
        { col: 7, row: 1, targetId: 'l1_g_timed', action: 'open' },
        { col: 11, row: 2, targetId: 'l1_g_timed', action: 'open' },
      ],
      gates: [
        { id: 'l1_g_timed', col: 10, row: 2, openDuration: 10, stayOpen: false },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
      ],
    },

    // Room 6: First Vault Guard
    6: {
      seed: 107,
      links: { left: 5, right: 7, up: null, down: null },
      hint: 'Fencing: UP parries, SHIFT strikes/ripostes, LEFT/RIGHT steps, DOWN sheathes.',
      grid: [
        '############',
        '#___.._____#',
        '____________',
        '############',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      enemies: [
        { col: 8, row: 2, type: 'guard', facing: -1, hp: 2, skill: 1, name: 'Vault Guard' },
      ],
      decor: [
        { col: 6, row: 2, type: 'torch' },
      ],
    },

    // Room 7: Treasury Hall (Second Guard + Upper Exit Plate)
    7: {
      seed: 108,
      links: { left: 6, right: 8, up: null, down: null },
      hint: 'Defeat the Captain and climb up to trigger the Exit Plate.',
      grid: [
        '############',
        '#____P_.___#',
        '____________',
        '############',
      ],
      plates: [
        { col: 5, row: 1, targetId: 'l1_exit', action: 'open' },
      ],
      enemies: [
        { col: 7, row: 2, type: 'guard', facing: -1, hp: 3, skill: 1, name: 'Vault Captain' },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 10, row: 2, type: 'torch' },
      ],
    },

    // Room 8: Paradeplatz Exit Chute
    8: {
      seed: 109,
      links: { left: 7, right: null, up: null, down: null },
      hint: 'Stand before the open vault door and press UP to escape.',
      grid: [
        '############',
        '#______.___#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l1_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'torch' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
