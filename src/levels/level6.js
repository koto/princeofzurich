// src/levels/level6.js
// Level 6: CERN Ring Sector 4 (Meyrin, Geneva, 430m - 23:31 CET) (10 rooms)
// [Existing Level 3 renumbered with Story Bible text, guard names/barks, and verbatim Deepfake taunts]
// One New Gameplay Idea: High-Tempo Photonic Beam Shutters (C, 2.2s) & Quantum-Optics Mirror (M).

export const level6 = {
  id: 5,
  name: 'CERN Ring Sector 4',
  subtitle: 'MEYRIN, GENEVA (430M) - 23:31',
  ice: false,
  slicerPeriod: 2.2,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Cryo-Entry + First Beam Shutter + Upper Observation Gallery
    0: {
      seed: 301,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'PHOTONIC SHUTTERS SNAP FAST. TIME THE OPEN BEAT.',
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
        {
          col: 9, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3,
          archetype: 'duellist', name: 'CERN Tactical',
          bark: '"REMOVE SWISS WATCHES AND FERROUS SABRES IMMEDIATELY!"',
        },
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
        { col: 7, row: 1, targetId: 'l6_g_mirror', action: 'open' },
      ],
      gates: [
        { id: 'l6_g_mirror', col: 8, row: 2, openDuration: 10, stayOpen: true },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 4: Detector Bay 4 (THE QUANTUM CALIBRATION MIRROR — Vaulted collider dome)
    4: {
      seed: 305,
      links: { left: 3, right: 5, up: null, down: null },
      hint: 'QUANTUM CALIBRATION MIRROR AHEAD. SPRINT STRAIGHT THROUGH.',
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

    // Room 5: Aftermath Corridor (Geneva auto-notice + shutter + loose tile + upper catwalk)
    5: {
      seed: 306,
      links: { left: 4, right: 6, up: null, down: null },
      hint: 'GENEVA AUTO-NOTICE: NOISE COMPLAINT FILED AFTER 22:00.',
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

    // Room 6: Elixir Sabotage! (Deepfake confiscates Reserve Tonic + staggered shaft to Room 7)
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
        {
          col: 4, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 3,
          name: 'The Deepfake', scripted: 'steal_elixir',
          taunt: 'DEEPFAKE: "CONSOLIDATING YOUR TONIC. RECEIPT FILED."',
        },
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
        { col: 5, row: 2, targetId: 'l6_g_final', action: 'close' },
      ],
      gates: [
        { id: 'l6_g_final', col: 10, row: 2, initiallyOpen: true, stayOpen: true },
      ],
      enemies: [
        {
          col: 3, row: 2, type: 'deepfake', facing: 1, hp: 3, skill: 3,
          name: 'The Deepfake', scripted: 'slam_gate',
          taunt: 'DEEPFAKE: "ACCESS REVOKED. PLEASE SUBMIT FORM 7-B."',
        },
      ],
      decor: [
        { col: 2, row: 1, type: 'torch' },
      ],
    },

    // Room 7: Lower Cryo Bypass (3-floor conduit: re-opens sabotaged gate & opens Exit!)
    7: {
      seed: 309,
      links: { left: null, right: null, up: 6, down: null },
      hint: 'DEEPFAKE LOCKED THE GATE. USE THE CRYO BYPASS BELOW.',
      grid: [
        '#####___.__#',
        '#.P___C____#',
        '#____P_____#',
        '############',
      ],
      plates: [
        { col: 2, row: 1, targetId: 'l6_g_final', action: 'open' },
        { col: 5, row: 2, targetId: 'l6_exit', action: 'open' },
      ],
      enemies: [
        {
          col: 7, row: 2, type: 'elite', facing: -1, hp: 4, skill: 3,
          archetype: 'duellist', name: 'Safety Warden',
          bark: '"A FERROUS SABRE IN SECTOR 4? FILING A REPORT!"',
        },
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      decor: [
        { col: 9, row: 1, type: 'torch' },
      ],
    },

    // Room 9: Geneva Diplomatic Express Exit (East to Bern!)
    9: {
      seed: 310,
      links: { left: 8, right: null, up: null, down: null },
      hint: 'THE DEEPFAKE BOARDED THE EXPRESS TO BERN. PURSUE EAST.',
      grid: [
        '##........##',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l6_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 5, row: 2, type: 'sign' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
