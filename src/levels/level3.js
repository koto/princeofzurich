// src/levels/level3.js
// Level 3: Gotthard Reduit Fortress: Sasso San Gottardo (Uri / Ticino, 2,100m - 23:12 CET) (10 rooms)
// [Existing Level 2 renumbered with Story Bible text, guard names/barks, and 1979 CRT terminal]
// One New Gameplay Idea: Proximity Floor Spikes (^, safe with Shift) & Tonic vs Coolant Triage.

export const level3 = {
  id: 2,
  name: 'Gotthard Reduit',
  subtitle: 'URI / TICINO (2,100M) - 23:12',
  ice: false,
  start: { room: 0, col: 1, row: 2, facing: 1, hasSword: true },
  rooms: {
    // Room 0: Bunker Airlock (Spikes tutorial + upper gallery)
    0: {
      seed: 201,
      links: { left: null, right: 1, up: null, down: null },
      hint: 'HOLD SHIFT + ARROW TO CAREFUL-STEP SAFELY OVER SPIKES.',
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
      hint: 'RUN + UP CLEARS WIDE GAPS. HOLD SHIFT TO CATCH LEDGES.',
      grid: [
        '############',
        '_______.___#',
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

    // Room 4: Lower Maintenance Pit (2-floor survivable recovery from Room 1 + climb back up!)
    4: {
      seed: 203,
      links: { left: null, right: 5, up: 1, down: null },
      hint: 'LOWER REDUIT SUMP: RECOVER AND CLIMB THE SERVICE SHAFTS.',
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

    // Room 5: Ammunition Depot (Reserve Tonic vs bluish Coolant decoy + climb up to Room 2!)
    5: {
      seed: 204,
      links: { left: 4, right: null, up: 2, down: null },
      hint: 'ORANGE FLASK: CIVIL DEFENSE TONIC. BLUE: COOLANT.',
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
        {
          col: 6, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2,
          archetype: 'brawler', name: 'Reduit Corporal',
          bark: '"UNANNOUNCED MOBILIZATION INSPECTION! EN GARDE!"',
        },
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
        {
          col: 9, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2,
          archetype: 'sentry', name: 'Bunker Sentry',
          bark: '"SECTOR URI-TICINO IS SEALED. IDENTIFY YOURSELF."',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
      ],
    },

    // Room 3: Close-Plate Trap Corridor (Jump over red close-plate; reopen plate prevents soft-lock)
    3: {
      seed: 206,
      links: { left: 2, right: 6, up: null, down: null },
      hint: 'RED LOCKDOWN PLATES SLAM BLAST DOORS. VAULT OVER THEM.',
      grid: [
        '############',
        '___._P_____#',
        '______Q___GP',
        '############',
      ],
      plates: [
        { col: 5, row: 1, targetId: 'l3_g_blast', action: 'open' },
        { col: 6, row: 2, targetId: 'l3_g_blast', action: 'close' },
        { col: 11, row: 2, targetId: 'l3_g_blast', action: 'open' },
      ],
      gates: [
        { id: 'l3_g_blast', col: 10, row: 2, openDuration: 11, stayOpen: false },
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

    // Room 7: Officer's Artillery Bridge (Maj. Tobler + knock guard onto spikes!)
    7: {
      seed: 208,
      links: { left: 6, right: 8, up: null, down: null },
      hint: 'TIP: FENCE GUARDS BACKWARD ONTO THEIR OWN SPIKES.',
      grid: [
        '############',
        '_____._____#',
        '_________^^_',
        '############',
      ],
      enemies: [
        {
          col: 6, row: 2, type: 'guard', facing: -1, hp: 4, skill: 3,
          archetype: 'brawler', name: 'Maj. Tobler',
          bark: '"NOBODY TOLD ME THE 1989 DRILL WAS OVER!"',
        },
      ],
      decor: [
        { col: 3, row: 2, type: 'banner' },
        { col: 1, row: 2, type: 'crt' },
      ],
    },

    // Room 8: 1979 Switchboard & Blast Door Control (3-floor pit-edge duel + upper exit plate)
    8: {
      seed: 209,
      links: { left: 7, right: 9, up: null, down: null },
      grid: [
        '############',
        '#__P___.___#',
        '____..______',
        '###____#####',
      ],
      items: [
        { col: 1, row: 2, type: 'small_elixir' },
      ],
      plates: [
        { col: 3, row: 1, targetId: 'l3_exit', action: 'open' },
      ],
      enemies: [
        {
          col: 8, row: 2, type: 'guard', facing: -1, hp: 3, skill: 2,
          archetype: 'sentry', name: 'Tunnel Guard',
          bark: '"1987 LIFT INSPECTION OVERDUE. ACCESS DENIED."',
        },
      ],
      decor: [
        { col: 10, row: 2, type: 'torch' },
        { col: 2, row: 2, type: 'crt' },
      ],
    },

    // Room 9: 1987 West-Bound Service Lift Exit (Celine CRT transmission!)
    9: {
      seed: 210,
      links: { left: 8, right: null, up: null, down: null },
      hint: '1979 COPPER CRT ACTIVE. TAKE THE 1987 WEST-BOUND LIFT.',
      grid: [
        '############',
        '#_____.____#',
        '_______E___#',
        '############',
      ],
      exits: [
        { id: 'l3_exit', col: 7, row: 2 },
      ],
      decor: [
        { col: 4, row: 2, type: 'crt' },
        { col: 9, row: 2, type: 'torch' },
        { col: 7, row: 1, type: 'banner' },
      ],
    },
  },
};
