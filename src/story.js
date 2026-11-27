// src/story.js
// Narrative cards, intro sequence, endings, death lines, timer notices, and guard barks.
// All strings strictly use PIXEL_FONT-safe ASCII from writers/STORY_BIBLE.md.

export const TITLE_TEXT = {
  title: 'PRINCE OF ZURICH',
  subtitle: 'OP. SECHSELAEUTEN - 60 MIN TO MIDNIGHT',
  tagline: 'SIXTY MINUTES. TEN STOPS. NO TRAM PASS.',
};

export const INTRO_CARDS = [
  {
    header: 'ZURICH - 23:00 CET',
    lines: [
      'THE FEDERAL COUNCIL IS SNOWED IN AT DAVOS,',
      'SO NOBODY IS WATCHING THE COUNTRY. PRIVATE',
      'BANKER DR. VIKTOR ZINS CALLS THIS AN IDEAL',
      'MAINTENANCE WINDOW FOR OP. SECHSELAEUTEN.',
    ],
  },
  {
    header: 'ORDINANCE 41.09-BIS',
    lines: [
      'AT 00:00 SHARP, EVERY SWISS ACCOUNT FOLDS',
      'INTO ZINS & CIE LEDGER 1. NOT THEFT -',
      'CONSOLIDATION. CUSTOMERS WILL DESCRIBE IT',
      'DIFFERENTLY, IN FOUR NATIONAL LANGUAGES.',
    ],
  },
  {
    header: 'THE FOUR-EYES PRINCIPLE',
    lines: [
      'ABORTING THE MERGE NEEDS TWO KEYS. KEY B',
      'IS WITH AUDITOR CELINE AMREIN, LOCKED ATOP',
      'THE SPHINX OBSERVATORY. ZINS CUT HER FIBER',
      'BUT FORGOT THE 1979 COPPER RADIATOR LINE.',
    ],
  },
  {
    header: 'COURIER 04 - "PRINZ"',
    lines: [
      'BIKE COURIER LUCA "PRINZ" BRUNNER CARRIED',
      'KEY A, DOUBLED BACK FOR HER BADGE, AND',
      'WOKE IN PARADEPLATZ VAULTS. NO BIKE. NO GA',
      'PASS. AND QUIET HOURS STARTED AT 22:00.',
    ],
  },
];

export const LEVEL_INTROS = [
  {
    title: 'LEVEL 1: PARADEPLATZ VAULTS',
    subtitle: 'ZURICH (408M) - 23:00',
    shortName: 'PARADEPLATZ VAULTS',
    music: 'level0',
  },
  {
    title: 'LEVEL 2: OLTEN SBB GLEIS 0',
    subtitle: 'SOLOTHURN (396M) - 23:06',
    shortName: 'OLTEN SBB GLEIS 0',
    music: 'level1',
  },
  {
    title: 'LEVEL 3: GOTTHARD REDUIT',
    subtitle: 'URI / TICINO (2,100M) - 23:12',
    shortName: 'GOTTHARD REDUIT',
    music: 'level2',
  },
  {
    title: 'LEVEL 4: GRANDE DIXENCE DAM',
    subtitle: 'VALAIS (2,365M) - 23:19',
    shortName: 'GRANDE DIXENCE DAM',
    music: 'level3',
  },
  {
    title: 'LEVEL 5: CHILLON VIADUCT',
    subtitle: 'MONTREUX, VAUD (372M) - 23:25',
    shortName: 'CHILLON VIADUCT',
    music: 'level4',
  },
  {
    title: 'LEVEL 6: CERN RING SECTOR 4',
    subtitle: 'MEYRIN, GENEVA (430M) - 23:31',
    shortName: 'CERN RING SECTOR 4',
    music: 'level5',
  },
  {
    title: 'LEVEL 7: BUNDESHAUS ARCHIVE',
    subtitle: 'BERN (542M) - 23:38',
    shortName: 'BUNDESHAUS ARCHIVE',
    music: 'level6',
  },
  {
    title: 'LEVEL 8: EIGERWAND GALLERY',
    subtitle: 'NORTH FACE (2,865M) - 23:44',
    shortName: 'EIGERWAND GALLERY',
    music: 'level7',
  },
  {
    title: 'LEVEL 9: JUNGFRAU ICE PALACE',
    subtitle: 'ALETSCH GLACIER (3,454M) - 23:50',
    shortName: 'JUNGFRAU ICE PALACE',
    music: 'level8',
  },
  {
    title: 'LEVEL 10: SPHINX OBSERVATORY',
    subtitle: 'JUNGFRAUJOCH (3,571M) - 23:55',
    shortName: 'SPHINX OBSERVATORY',
    music: 'level9',
  },
];

export const LEVEL_MUSIC_TRACKS = LEVEL_INTROS.map((l) => l.music);

export const INTERLUDE_CARDS = [
  // After level1 (Paradeplatz -> Olten)
  {
    header: 'PARADEPLATZ VAULTS CLEARED',
    lines: [
      'PRINZ SLIPS DOWN THE 1941 GOLD CHUTE WITH',
      'ZINS\'S GUILD SABRE (ASSET 0041, UNSIGNED).',
      'CELINE ON RADIO: "ALL SECRET TUNNELS ROUTE',
      'VIA OLTEN. DO NOT ARGUE WITH TIMETABLES."',
    ],
  },
  // After level2 (Olten -> Gotthard)
  {
    header: 'OLTEN GLEIS 0 CLEARED',
    lines: [
      'PLATFORM ZERO SURVIVED WITHOUT A TICKET.',
      'AN OLD REDUIT FREIGHT CAR POINTS SOUTH TO',
      'THE GOTTHARD BUNKER. ZONE 110 FARE REMAINS',
      'ENTHUSIASTICALLY UNPAID. NEXT: URI.',
    ],
  },
  // After level3 (Gotthard -> Grande Dixence)
  {
    header: 'GOTTHARD REDUIT CLEARED',
    lines: [
      'THE 1987 LIFT STILL WORKS. CELINE BREAKS',
      'IN ON THE BUNKER CRT: "ZINS RENTED CERN',
      'COMPUTE TO SPOOF MY KEY EARLY. DETOUR WEST',
      'TO GENEVA. KILL THE RELAY. STOP RUSHING."',
    ],
  },
  // After level4 (Grande Dixence -> Chillon)
  {
    header: 'GRANDE DIXENCE CLEARED',
    lines: [
      '285 METERS OF VALAIS CONCRETE HELD BACK A',
      'GLACIER AND ONE FURIOUS DAM INSPECTOR. THE',
      'HYDRO DRAIN SPILLS WEST TO LAKE GENEVA AND',
      'CHILLON\'S CELLARS. KEEP YOUR BOOTS DRY.',
    ],
  },
  // After level5 (Chillon -> CERN)
  {
    header: 'CHILLON VIADUCT CLEARED',
    lines: [
      'MEDIEVAL DUNGEONS BOLTED DIRECTLY UNDER A',
      '1960S MOTORWAY: PEAK SWISS LAND USE. THE',
      'FIBER TRUNK HUMS WEST INTO GENEVA. CELINE:',
      '"CUT THE SECTOR 4 RELAY. MIND THE MAGNETS."',
    ],
  },
  // After level6 (CERN -> Bundeshaus Bern)
  {
    header: 'CERN SECTOR 4 CLEARED',
    lines: [
      'THE KEY-SPOOFER IS GLASS DUST, WHICH HELPS.',
      'WHAT STEPPED OUT OF THE MIRROR HAS PRINZ\'S',
      'FACE, HIS TONIC, AND AN INSURANCE POLICY.',
      'IT JUST CAUGHT THE EXPRESS TRAIN TO BERN.',
    ],
  },
  // After level7 (Bundeshaus Bern -> Eigerwand)
  {
    header: 'BUNDESHAUS ARCHIVE CLEARED',
    lines: [
      'NO FORGED WAIVER FILED, THOUGH YOUR COPY',
      'REGISTERED YOUR ADDRESS AT CELINE\'S FLAT.',
      '(SERAFE BILL PENDING.) IT BOLTED SOUTH TO',
      'EIGERWAND. PARLIAMENT REMAINS EMPTY.',
    ],
  },
  // After level8 (Eigerwand -> Ice Palace)
  {
    header: 'EIGERWAND GALLERY CLEARED',
    lines: [
      'CELINE OVER INTERCOM: "YOUR COPY JUST',
      'OFFERED TO SIGN FORM 7-B. YOU HAVE NEVER',
      'SIGNED A RECEIPT IN YOUR LIFE. I LOCKED IT',
      'IN THE ICE PALACE. GO SORT YOURSELF OUT."',
    ],
  },
  // After level9 (Ice Palace -> Sphinx Observatory)
  {
    header: 'ICE PALACE CLEARED',
    lines: [
      'BLADE SHEATHED. ONE PRINZ AGAIN, WHICH IS',
      'MORE THAN MOST COMMITTEES MANAGE - PLUS',
      'ONE RETURNED TONIC. CELINE: "THREE BUSBARS',
      'PULLED. ZINS IS OUTSIDE. TAKE THE LIFT."',
    ],
  },
  // After level10 (Sphinx Duel Cleared -> Transitions to Good Ending)
  {
    header: 'SPHINX WALKWAY CLEARED',
    lines: [
      'DR. ZINS YIELDS ON POINTS, REQUESTS AN',
      'ITEMIZED RECEIPT FOR ASSET 0041, AND EXITS',
      'VIA THE SNOW CHUTE. INSIDE THE DOME,',
      'CELINE HOLDS THE LAST BUSBAR OPEN FOR YOU.',
    ],
  },
];

export function getVictoryCards(timeRemainingSec) {
  const mins = Math.floor(timeRemainingSec / 60);
  const secs = Math.floor(timeRemainingSec % 60);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return [
    INTERLUDE_CARDS[9],
    {
      header: `MERGE ABORTED - ${mm}:${ss} LEFT`,
      lines: [
        'CELINE TURNS KEY B. PRINZ TURNS KEY A JUST',
        'AS THE SBB SECOND HAND PAUSES AT TWELVE.',
        'OP. SECHSELAEUTEN DISSOLVES INTO 40,000',
        'NON-BINDING COMPLIANCE MEMOS (FORM 7-B).',
      ],
    },
    {
      header: 'ADMINISTRATIVE CLOSURE',
      lines: [
        'AUDITORS WITH CLIPBOARDS ESCORT ZINS AWAY,',
        'THE MOST FRIGHTENING KIND. PRINZ SIGNS FOR',
        'ASSET 0041. IN DAVOS, THE FEDERAL COUNCIL',
        'PRAISES ITS OWN DECISIVE CRISIS RESPONSE.',
      ],
    },
    {
      header: 'THE 00:04 JUNGFRAUBAHN',
      lines: [
        'THE LAST TRAIN LEAVES ON THE EXACT SECOND.',
        'THEY BOARD WITHOUT RUNNING. CELINE: "YOUR',
        'SERAFE BILL CAME TO BERN." PRINZ SLIDES A',
        'RECEIPT OVER. "GOOD. WE CHANGE AT OLTEN."',
      ],
      music: 'title',
    },
  ];
}

export function getVictoryCard(timeRemainingSec) {
  return getVictoryCards(timeRemainingSec)[1];
}

export const TIMEOUT_CARDS = [
  {
    header: '00:00 - MIDNIGHT SHARP',
    lines: [
      'THE RED SECOND HAND PAUSES AT TWELVE, THEN',
      'CLICKS OVER. ONE RELAY FIRES IN ZURICH. NO',
      'ALARM SOUNDS. EVERY SWISS ACCOUNT FOLDS',
      'SMOOTHLY INTO ZINS & CIE LEDGER NO. 1.',
    ],
  },
  {
    header: 'CONSOLIDATION COMPLETE',
    lines: [
      'BY 07:00, TRAM TICKET MACHINES CHARGE A',
      'WEALTH-MANAGEMENT FEE. THE FEDERAL COUNCIL',
      'ISSUES A STATEMENT OF DEEP CONCERN IN FOUR',
      'LANGUAGES. ROMANSH ARRIVES AT 10:15.',
    ],
  },
  {
    header: 'NOTICE OF LATE ARRIVAL',
    lines: [
      'PRINZ REACHES THE DOME AT 00:02. THE DOOR',
      'IS OPEN. CELINE IS ALREADY COLLECTING',
      '100,000 SIGNATURES. PUNCTUALITY WAS THE',
      'JOB. PRESS ENTER OR SPACE TO RETRY.',
    ],
  },
];

export const TIMEOUT_CARD = TIMEOUT_CARDS[0];

export const DEATH_LINES = [
  'INSURANCE DOES NOT COVER THIS.',
  'A COURIER IS ONLY AS FAST AS HIS LAST JUMP.',
  'NOT COVERED UNDER SUVA ACCIDENT POLICY.',
  'THE SBB CLOCK DOES NOT PAUSE FOR GRIEF.',
  'ZINS & CIE DECLINES ALL LIABILITY.',
  'OUTSIDE APPROVED COURIER HOURS.',
  'NEXT OF KIN NOTIFIED BY REGISTERED MAIL.',
  'IMPROPER FOOTWEAR FOR ALPINE TRANSIT.',
  'DELIVERY STATUS: PERMANENTLY DELAYED.',
  'VIOLATION OF QUIET HOURS AFTER 22:00.',
  'FORM 7-B REMAINS CONSPICUOUSLY UNSIGNED.',
  'GRAVITY REMAINS CANTONALLY UNREGULATED.',
  'YOUR HALF-FARE CARD DOES NOT APPLY HERE.',
  'YOUR DEEPFAKE WOULD HAVE MADE THAT JUMP.',
  'CELINE PREDICTED THIS EXACT SHORTCUT.',
  'A PREVENTABLE COMPLIANCE INCIDENT.',
  'LAST INSPECTED 1987. STILL LETHAL.',
  'THE VAULT KEEPS WHAT FALLS INTO IT.',
  'DAVOS EXPRESSES MEASURED CONCERN.',
  'TRY AGAIN. PUNCTUALITY IS MANDATORY.',
];

export const CAUSE_DEATH_LINES = {
  spikes: 'SPACE-STEP WAS IN THE MANUAL.',
  slicer: 'CLEANLY AUDITED INTO TWO HALVES.',
  fall: 'UNSCHEDULED VERTICAL DESCENT.',
  poison: 'IT SAID DO NOT DRINK IN FOUR LANGUAGES.',
  unarmed: 'NEVER BRING A COURIER BAG TO A DUEL.',
  deepfake: 'SELF-INFLICTED. CLAIM DENIED.',
};

export const DEATH_SUBLINES = {
  line2: 'THE SBB CLOCK DOES NOT WAIT.',
  line3: 'PRESS R, SPACE OR ENTER TO RETRY',
};

export const TIMER_MILESTONES = [
  { sec: 50 * 60, text: '23:10 - 50 MIN LEFT. DAVOS STILL AT APERITIF.' },
  { sec: 45 * 60, text: '23:15 - 45 MIN LEFT. CELINE FILED AUDIT HOLD 1.' },
  { sec: 30 * 60, text: '23:30 - 30 MIN LEFT. DAVOS FORMS A WORKING GROUP.' },
  { sec: 20 * 60, text: '23:40 - 20 MIN LEFT. WORKING GROUP ADJOURNS TO TUE.' },
  { sec: 15 * 60, text: '23:45 - 15 MIN LEFT. NOTE: SBB CLOCKS PAUSE AT 12.' },
  { sec: 10 * 60, text: '23:50 - 10 MIN LEFT. CELINE: "PICK UP THE PACE."' },
  { sec: 5 * 60,  text: '23:55 - 5 MIN LEFT. DAVOS SENDS DEEP CONCERN.' },
  { sec: 2 * 60,  text: '23:58 - 2 MIN LEFT. INTEREST ACCRUING RAPIDLY.' },
  { sec: 1 * 60,  text: '23:59 - 60 SEC. SECOND HAND NEARING THE PAUSE.' },
  { sec: 30,      text: '30 SEC TO MIDNIGHT. RUN LIKE TRAM DOORS ARE CLOSING.' },
];

export const CLOCK_CHECK_LINES = [
  (mm, ss) => `${mm} MIN ${ss} SEC TO MIDNIGHT. CLOCK VERIFIED.`,
  (mm, ss) => `${mm} MIN ${ss} SEC LEFT. TRAM 11 WOULD BE FASTER.`,
  (mm, ss) => `${mm} MIN ${ss} SEC LEFT. ZINS HAS HIS PEN OUT.`,
  (mm, ss) => `${mm} MIN ${ss} SEC LEFT. NO GRACE PERIOD GRANTED.`,
];

export const EVENT_BANNERS = {
  pickupSword: 'GUILD SABRE (ASSET 0041) TAKEN. RECEIPT PENDING.',
  pickupElixir: 'CIVIL DEFENSE TONIC (1994) - +1 HEALTH. SURPRISINGLY FINE.',
  pickupLargeElixir: 'RESERVE TONIC - MAX HEALTH +1 & FULL HEAL.',
  pickupPoison: 'TUNNEL COOLANT - CLEARLY LABELED. -1 HEALTH.',
  debrisHit: 'UNINSURED MASONRY IMPACT. -1 HEALTH.',
  gateOpened: 'SERVICE GRATE RAISED. (TIMED)',
  gateClosed: 'LOCKDOWN SHUTTER ENGAGED.',
  exitOpened: 'TRANSIT HATCH AUTHORIZED.',
  mirrorBroken: 'SCANNER BREACHED - COMPLIANCE MODEL V2 DEPLOYED.',
  genevaNotice: 'GENEVA AUTO-NOTICE: NOISE COMPLAINT FILED AFTER 22:00.',
  deepfakeTauntElixir: 'DEEPFAKE: "CONSOLIDATING YOUR TONIC. RECEIPT FILED."',
  deepfakeTauntGate: 'DEEPFAKE: "ACCESS REVOKED. PLEASE SUBMIT FORM 7-B."',
  deepfakeTauntArchive: 'DEEPFAKE: "FILED YOUR BERN ADDRESS. YOU ARE WELCOME."',
  deepfakeTauntViaduct: 'DEEPFAKE: "UNREGISTERED COURIER. RE-ROUTING BRIDGE."',
  deepfakePain: 'SHARED LIABILITY! PRESS DOWN TO SHEATHE YOUR BLADE.',
  deepfakeSheathed: 'COMPLIANCE MODEL STANDS DOWN. WALK INTO IT TO MERGE.',
  deepfakeMerged: 'MERGED - ONE PRINZ, TONIC RETURNED, MAX HEALTH +1.',
  audioMuted: 'AUDIO MUTED (QUIET HOURS)',
  audioRestored: 'AUDIO RESTORED',
};

export const ZINS_BARKS = {
  opening: 'DR. ZINS: "TWENTY-SIX CANTONS WAS ALWAYS TOO MANY, BRUNNER."',
  midDuel: 'DR. ZINS: "WHY BLEED FOR A CITY THAT PAYS YOU BY THE DROP?"',
  defeated: 'DR. ZINS: "UNSCHEDULED... DEPRECIATION... RECEIPT, PLEASE."',
};

export const DEEPFAKE_BARKS = {
  mirrorHit: 'DEEPFAKE: "SAME ID, LUCA. YOU ARE AUDITING YOUR OWN RIBS."',
  onSheathe: 'DEEPFAKE: "YOU NEVER COULD TAKE THE SHORTCUT. FINE."',
};
