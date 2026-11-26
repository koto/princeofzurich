// src/story.js
// Narrative cards, intro sequence, endings, and dry Swiss wit.

export const INTRO_CARDS = [
  {
    header: 'ZURICH — 23:00 CET',
    lines: [
      'While the Federal Council is politely',
      'occupied at Davos, Dr. Viktor Zins of',
      'Zins & Cie initiates Operation Sechselaeuten.',
      '',
      'At midnight sharp, every Swiss bank account',
      'merges into a single ledger. His ledger.',
    ],
  },
  {
    header: 'THE SECOND KEY',
    lines: [
      'Only Chief Auditor Celine Amrein can abort',
      'the consolidation. Zins has locked her atop',
      'the Jungfraujoch Sphinx Observatory with',
      'exactly sixty minutes to countersign.',
      '',
      'Swiss punctuality, weaponized.',
    ],
  },
  {
    header: 'THE PRINCE OF ZURICH',
    lines: [
      'Luca "Prinz" Brunner — bike courier, rooftop',
      'legend, and Celine\'s partner — was caught',
      'delivering her audit files and dropped into',
      'the forgotten vaults beneath Paradeplatz.',
      '',
      'No bike. No badge. Sixty minutes to midnight.',
    ],
  },
];

export const LEVEL_INTROS = [
  {
    title: 'LEVEL 1: PARADEPLATZ VAULTS',
    subtitle: 'ZURICH — SUB-BASEMENT 4',
    hint: 'Find a guild sabre. Step carefully (Shift) at edges.',
  },
  {
    title: 'LEVEL 2: GOTTHARD REDUIT',
    subtitle: 'ALPINE MILITARY TUNNEL NETWORK',
    hint: 'Shift-step crosses spikes safely. Run + Up leaps wide gaps.',
  },
  {
    title: 'LEVEL 3: CERN RING SECTOR 4',
    subtitle: 'GENEVA — SUPERCONDUCTING CONDUIT',
    hint: 'Time the beam shutters. Beware the quantum detector mirror.',
  },
  {
    title: 'LEVEL 4: JUNGFRAUJOCH ICE PALACE',
    subtitle: '3,454M — GLACIAL PASSAGE',
    hint: 'Ice extends your skid. Some battles cannot be won with steel.',
  },
  {
    title: 'LEVEL 5: SPHINX OBSERVATORY',
    subtitle: '3,571M — SUMMIT WALKWAY',
    hint: 'Dr. Zins awaits. Parry (Up) then riposte (Shift). Reach Celine.',
  },
];

export const INTERLUDE_CARDS = [
  // After Level 1 -> Level 2
  {
    header: 'PARADEPLATZ CLEARED',
    lines: [
      'Prinz emerges behind the old bullion chute',
      'and slips into the wartime Reduit rail shaft.',
      '',
      'The vaults smelled of cedar, old francs, and',
      'deferred tax declarations. South to Gotthard.',
    ],
  },
  // After Level 2 -> Level 3
  {
    header: 'GOTTHARD REDUIT CLEARED',
    lines: [
      'Even a Cold War alpine fortress leaves its',
      'service doors open for someone with a sabre',
      'and a complete disregard for signage.',
      '',
      'A private express tunnel leads west: CERN.',
    ],
  },
  // After Level 3 -> Level 4
  {
    header: 'CERN SECTOR CLEARED',
    lines: [
      'The quantum detector split off an AI Deepfake',
      'of Prinz — smug, armed, and already ahead',
      'on the Bernese Oberland funicular.',
      '',
      'Up into the Jungfraujoch Ice Palace.',
    ],
  },
  // After Level 4 -> Level 5
  {
    header: 'ICE PALACE CLEARED',
    lines: [
      'Whole again — one Prinz, zero fraudulent',
      'copies, and frostbite narrowly averted.',
      '',
      'Above the glacier stands the Sphinx dome,',
      'where Dr. Zins is polishing his ledger.',
    ],
  },
];

export function getVictoryCard(timeRemainingSec) {
  const mins = Math.floor(timeRemainingSec / 60);
  const secs = Math.floor(timeRemainingSec % 60);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return {
    header: '23:59 — MERGER ABORTED',
    lines: [
      'Celine countersigns the cryptographic abort.',
      'At 23:59, Operation Sechselaeuten dissolves',
      'into forty thousand polite compliance memos.',
      '',
      `Time remaining before midnight: ${mm}:${ss}`,
      '',
      'They catch the 00:04 Jungfraubahn down.',
      'Naturally, it departs on the exact second.',
    ],
  };
}

export const TIMEOUT_CARD = {
  header: '00:00 — OPERATION SECHSELAEUTEN',
  lines: [
    'The railway clock strikes midnight.',
    'Every account in Switzerland quietly folds',
    'into Zins & Cie Private Holding No. 1.',
    '',
    'Tomorrow morning even the Zurich tram ticket',
    'machines will charge a wealth-management fee.',
    '',
    'Press Enter or Space to try again.',
  ],
};
