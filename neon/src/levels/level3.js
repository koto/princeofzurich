// src/levels/level3.js
// Level 3: CERN Accelerator Tunnel, Geneva (10 rooms)
// Teaches: slicer beam shutters (C), multi-tier cryogenic conduits, pit-edge elite duels,
// quantum mirror (M) splitting off the Deepfake, and Deepfake sabotage + maintenance bypass.

export const level3 = {
  id: 2,
  name: 'CERN Ring Sector 4, Geneva',
  subtitle: '23:25 — Cryogenic Conduit',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Cryo-Entry + First Beam Shutter + Upper Observation Gallery
    0: {
      seed: 301,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'Time the CERN beam shutters carefully — sprint when they open.',
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

    // Room 1: Double Shutter Conduit (High/Low split route)
    1: {
      seed: 302,
      links: { left: 0, right: 2, up: null, down: null },
      grid: [
        '############',
        '#___.__C____',
        '__C_____C___',
        '############',
      ],
      decor: [
        { col: 6, row: 2, type: 'sign' },
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 2: Dipole Guard Bay (3-floor pit-edge elite duel!)
    2: {
      seed: 303,
      links: { left: 1, right: 3, up: null, down: null },
      grid: [
        '############',
        '____.._____#',
        '_______.____',
        '#####_____##',
      ],
      items: [
        { col: 2, row: 1, type: 'small_elixir' },
      ],
      enemies: [
        { col: 9, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3, name: 'CERN Tactical' },
      ],
      decor: [
        { col: 10, row: 1, type: 'torch' },
      ],
    },

    // Room 3: Superconducting Chasm (3-floor gate mechanism)
    3: {
      seed: 304,
      links: { left: 2, right: 4, up: null, down: null },
      grid: [
        '############',
        '#____._P___#',
        '___..___G___',
        '##____######',
      ],
      plates: [
        { col: 7, row: 1, targetId: 'l3_g_mirror', action: 'open' },
      ],
      gates: [
        { id: 'l3_g_mirror', col: 8, row: 2, openDuration: 10, stayOpen: true },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 4: Quantum Optics Detector (THE MIRROR — Vaulted collider dome)
    4: {
      seed: 305,
      links: { left: 3, right: 5, up: null, down: null },
      hint: 'A quantum-optics scanner blocks the ring. Sprint straight through!',
      grid: [
        '##...##...##',
        '#___.##.___#',
        '______M_____',
        '############',
      ],
      mirror: { col: 6, row: 2 },
      decor: [
        { col: 4, row: 2, type: 'sign' },
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 5: Aftermath Corridor (3-floor shutter + loose tile + upper catwalk)
    5: {
      seed: 306,
      links: { left: 4, right: 6, up: null, down: null },
      grid: [
        '############',
        '#______.____',
        '___L__C_____',
        '##___#######',
      ],
      decor: [
        { col: 3, row: 1, type: 'torch' },
      ],
    },

    // Room 6: Elixir Sabotage! (Deepfake steals Large Elixir + clean 1-floor staggered shaft to Room 7)
    6: {
      seed: 307,
      links: { left: 5, right: 8, up: null, down: 7 },
      grid: [
        '############',
        '_____._____#',
        '________.___',
        '#######__.##',
      ],
      items: [
        { col: 6, row: 2, type: 'large_elixir' },
        { col: 2, row: 2, type: 'small_elixir' },
      ],
      enemies: [
        { col: 4, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 3, name: 'The Deepfake', scripted: 'steal_elixir' },
      ],
      decor: [
        { col: 10, row: 1, type: 'torch' },
      ],
    },

    // Room 8: Gate Sabotage! (Deepfake steps on close-plate Q slamming gate to Room 9)
    8: {
      seed: 308,
      links: { left: 6, right: 9, up: null, down: null },
      grid: [
        '############',
        '#_____.____#',
        '_____Q____G_',
        '############',
      ],
      plates: [
        { col: 5, row: 2, targetId: 'l3_g_final', action: 'close' },
      ],
      gates: [
        { id: 'l3_g_final', col: 10, row: 2, initiallyOpen: true, stayOpen: true },
      ],
      enemies: [
        { col: 3, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 3, name: 'The Deepfake', scripted: 'slam_gate' },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 7: Lower Maintenance Bypass (3-floor conduit: re-opens sabotaged gate & opens Exit!)
    7: {
      seed: 309,
      links: { left: null, right: null, up: 6, down: null },
      hint: 'Override the Deepfake\'s lockdown from the maintenance conduit.',
      grid: [
        '#####___.__#',
        '#.P___C____#',
        '#____P_____#',
        '############',
      ],
      plates: [
        { col: 2, row: 1, targetId: 'l3_g_final', action: 'open' },
        { col: 5, row: 2, targetId: 'l3_exit', action: 'open' },
      ],
      enemies: [
        { col: 7, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3, name: 'Sector Warden' },
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 9: Geneva Funicular Exit
    9: {
      seed: 310,
      links: { left: 8, right: null, up: null, down: null },
      grid: [
        '##........##',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l3_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'sign' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
