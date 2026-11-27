// src/music.js
// Self-contained WebAudio soundtrack for Prince of Zurich.
// Zero external imports.
//
// Features long-form, multi-section transcriptions and arrangements of
// public-domain works with a Swiss connection (composers deceased before 1955
// or traditional Swiss folk songs). Every looping track exceeds 90 seconds
// before repeating, with a short non-repeating intro, per-section key & chord
// progressions, evolving instrumentation/register, counter-melodies, varying
// bass patterns (roots, walking, pedal, genre grooves), dynamic arcs, rests,
// breakdown sections, warm click-free ADSR synthesis, master low-pass +
// compressor, feedback-delay reverb, and a Node-runnable self-test.

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.14;

/**
 * Equal-temperament MIDI-to-frequency conversion (A4 = 440 Hz).
 * @param {number} midi
 * @returns {number}
 */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Scale & Chord Helpers (Pitch Classes: C=0 .. B=11)
// ---------------------------------------------------------------------------

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

function buildScaleSet(rootPc, mode) {
  const intervals = SCALES[mode];
  if (!intervals) throw new Error(`Unknown scale mode: ${mode}`);
  return new Set(intervals.map((i) => (rootPc + i) % 12));
}

const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '6': [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
};

const NOTE_PC = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const QUALITY_MAP = {
  '': 'maj',
  m: 'min',
  min: 'min',
  dim: 'dim',
  aug: 'aug',
  '7': '7',
  maj7: 'maj7',
  m7: 'min7',
  min7: 'min7',
  dim7: 'dim7',
  m7b5: 'm7b5',
  sus4: 'sus4',
  sus2: 'sus2',
  '6': '6',
  m6: 'min6',
};

function parseChordSymbol(sym) {
  const match = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!match) throw new Error(`Invalid chord symbol: ${sym}`);
  const rootPc = NOTE_PC[match[1]];
  if (rootPc === undefined) throw new Error(`Unknown root in chord: ${sym}`);
  const quality = QUALITY_MAP[match[2]];
  if (!quality) throw new Error(`Unknown quality in chord: ${sym}`);
  // Keep bass root warmly in B1 (35) .. Bb2 (46)
  const bassMidi = rootPc === 11 ? 35 : 36 + rootPc;
  const fifthSemi = (quality === 'dim' || quality === 'dim7' || quality === 'm7b5') ? 6 : 7;
  const up = bassMidi + fifthSemi;
  const fifthMidi = up <= 48 ? up : bassMidi - (12 - fifthSemi);
  return { rootPc, quality, bassMidi, fifthMidi, symbol: sym };
}

/**
 * Builds contiguous section-local chord events from [durationInBeats, symbol] pairs.
 */
function chordSeq(items) {
  let beat = 0;
  return items.map(([dur, sym]) => {
    const parsed = parseChordSymbol(sym);
    const ev = { beat, dur, ...parsed };
    beat += dur;
    return ev;
  });
}

function chordPitchClasses(chord) {
  const iv = CHORD_INTERVALS[chord.quality];
  if (!iv) throw new Error(`Unknown chord quality: ${chord.quality}`);
  return new Set(iv.map((semi) => (chord.rootPc + semi) % 12));
}

function chordMidis(chord, baseOctaveMidi = 48) {
  const iv = CHORD_INTERVALS[chord.quality];
  const rootMidi = baseOctaveMidi + chord.rootPc;
  return iv.map((semi) => rootMidi + semi);
}

// ---------------------------------------------------------------------------
// Public-Domain Swiss Track Definitions (Section-Based Long Forms)
//
// Each track declares:
//   - source: public-domain attribution (composer died before 1955 or Traditional)
//   - bpm, beatsPerBar, bars, loop, wet
//   - key: home key { name, rootPc, mode }
//   - sections: ordered array of sections (optional leading isIntro: true)
//     Each section declares:
//       - name, bars, key, chromaticPassing, chords, melody ([midi|null, dur])
//       - optional counterMelody, leadVoice, counterVoice, dynamics,
//         bassStyle, arpStyle, padMode, percStyle, articulation
// ---------------------------------------------------------------------------

function createTrackSpecs() {
  return {
    // =========================================================================
    // TITLE: "Ranz des vaches" from William Tell Overture (Part III, Andante)
    // Source: Gioachino Rossini (1792-1868), 1829. Public domain.
    // Mood: Pastoral alpine dialogue (English horn / alphorn & flute) in G major,
    //       3/4 time. 4-bar intro + 52-bar loop (156 beats @ 82 BPM = 114.1s).
    // =========================================================================
    title: {
      source: 'Gioachino Rossini (1792-1868), William Tell Overture (1829) - Part III: Ranz des vaches (Public Domain)',
      bpm: 82,
      beatsPerBar: 3,
      bars: 56,
      loop: true,
      wet: 0.35,
      leadVoice: 'alphorn',
      leadGain: 0.23,
      counterGain: 0.135,
      bassGain: 0.135,
      arpGain: 0.052,
      padGain: 0.058,
      key: { name: 'G major', rootPc: 7, mode: 'major' },
      sections: [
        // Intro (4 bars): Distant alpine horn fifths over sunlit G pedal
        {
          name: 'Intro: Alpine Mist',
          isIntro: true,
          bars: 4,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.78,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'none',
          chords: chordSeq([[3, 'G'], [3, 'G'], [3, 'D'], [3, 'G']]),
          melody: [
            [62, 1.5], [67, 1.5],
            [71, 2.0], [67, 1.0],
            [69, 2.0], [66, 1.0],
            [67, 2.0], [null, 1.0],
          ],
        },
        // Section A (12 bars): Cor Anglais (alphorn) pastoral call in G major
        {
          name: 'A: Cor Anglais Call',
          bars: 12,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.94,
          bassStyle: 'waltz',
          arpStyle: 'waltz',
          padMode: 'openFifth',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'G'], [3, 'C'], [3, 'D7'], [3, 'G'],
            [3, 'G'], [3, 'Em'], [3, 'D'], [3, 'G'],
            [3, 'C'], [3, 'G'], [3, 'D7'], [3, 'G'],
          ]),
          melody: [
            [71, 1.5], [67, 0.5], [62, 1.0],
            [64, 1.0], [66, 0.5], [67, 0.5], [69, 1.0],
            [69, 1.5], [66, 0.5], [62, 1.0],
            [67, 2.0], [62, 1.0],
            [71, 1.5], [67, 0.5], [62, 1.0],
            [64, 1.0], [67, 1.0], [71, 1.0],
            [69, 1.5], [66, 0.5], [62, 1.0],
            [67, 2.0], [null, 1.0],
            [72, 1.5], [71, 0.5], [67, 1.0],
            [71, 1.5], [69, 0.5], [67, 1.0],
            [69, 1.0], [66, 1.0], [62, 1.0],
            [67, 2.5], [null, 0.5],
          ],
        },
        // Section B (12 bars): High flute echo & ornate birdcall dialogue + warm strings counter-line
        {
          name: 'B: Flute Dialogue',
          bars: 12,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'warmStrings',
          dynamics: 1.02,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'openFifth',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'G'], [3, 'C'], [3, 'D7'], [3, 'G'],
            [3, 'G'], [3, 'Am7'], [3, 'D7'], [3, 'G'],
            [3, 'Em'], [3, 'C'], [3, 'D7'], [3, 'G'],
          ]),
          melody: [
            [74, 1.5], [71, 0.5], [67, 1.0],
            [76, 1.5], [72, 0.5], [67, 1.0],
            [69, 1.0], [71, 0.5], [72, 0.5], [69, 1.0],
            [71, 2.0], [67, 1.0],
            [74, 1.5], [71, 0.5], [67, 1.0],
            [76, 1.0], [74, 1.0], [72, 1.0],
            [69, 1.5], [66, 0.5], [62, 1.0],
            [67, 2.0], [71, 1.0],
            [76, 1.5], [74, 0.5], [71, 1.0],
            [79, 1.0], [76, 1.0], [72, 1.0],
            [74, 1.0], [72, 0.5], [71, 0.5], [69, 1.0],
            [67, 2.5], [null, 0.5],
          ],
          counterMelody: [
            [67, 2.0], [62, 1.0],
            [64, 2.0], [67, 1.0],
            [66, 2.0], [69, 1.0],
            [67, 2.0], [null, 1.0],
            [67, 2.0], [71, 1.0],
            [69, 2.0], [67, 1.0],
            [66, 2.0], [62, 1.0],
            [67, 2.0], [null, 1.0],
            [67, 2.0], [64, 1.0],
            [67, 2.0], [64, 1.0],
            [66, 2.0], [69, 1.0],
            [67, 2.5], [null, 0.5],
          ],
        },
        // Section C (12 bars): Lyrical E-minor / C-major alpine valley development
        {
          name: 'C: Valley Development',
          bars: 12,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3], // D# leading tone on B7
          leadVoice: 'warmStrings',
          counterVoice: 'flute',
          dynamics: 0.98,
          bassStyle: 'walking',
          arpStyle: 'barcarolle',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'Em'], [3, 'Am'], [3, 'D'], [3, 'G'],
            [3, 'C'], [3, 'Am'], [3, 'B7'], [3, 'Em'],
            [3, 'C'], [3, 'G'], [3, 'Am'], [3, 'B7'],
          ]),
          melody: [
            [71, 1.5], [67, 0.5], [64, 1.0],
            [69, 1.5], [72, 0.5], [69, 1.0],
            [66, 1.0], [69, 1.0], [74, 1.0],
            [71, 2.0], [67, 1.0],
            [72, 1.5], [71, 0.5], [67, 1.0],
            [69, 1.0], [67, 1.0], [64, 1.0],
            [66, 1.5], [63, 0.5], [59, 1.0],
            [64, 2.0], [null, 1.0],
            [67, 1.5], [72, 0.5], [76, 1.0],
            [74, 1.5], [71, 0.5], [67, 1.0],
            [69, 1.0], [72, 1.0], [69, 1.0],
            [71, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [64, 2.0], [67, 1.0],
            [72, 2.0], [69, 1.0],
            [74, 2.0], [69, 1.0],
            [74, 2.0], [null, 1.0],
            [76, 2.0], [72, 1.0],
            [72, 2.0], [69, 1.0],
            [71, 2.0], [66, 1.0],
            [67, 2.0], [null, 1.0],
            [76, 2.0], [72, 1.0],
            [71, 2.0], [74, 1.0],
            [72, 2.0], [69, 1.0],
            [75, 2.0], [null, 1.0],
          ],
        },
        // Section D (8 bars): Hushed mountain-air breakdown with rests & solo celesta/flute
        {
          name: 'D: Quiet Meadow Breakdown',
          bars: 8,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.68,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'G'], [3, 'G'], [3, 'C'], [3, 'G'],
            [3, 'Em'], [3, 'Am7'], [3, 'D7'], [3, 'D7'],
          ]),
          melody: [
            [79, 2.0], [null, 1.0],
            [74, 1.5], [71, 0.5], [67, 1.0],
            [76, 2.0], [null, 1.0],
            [74, 2.0], [null, 1.0],
            [71, 1.5], [67, 0.5], [64, 1.0],
            [72, 1.5], [69, 0.5], [67, 1.0],
            [69, 2.0], [66, 1.0],
            [62, 2.0], [null, 1.0],
          ],
        },
        // Section A' (8 bars): Triumphant pastoral return with alphorn + high flute harmony
        {
          name: 'A2: Sunlit Return',
          bars: 8,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          counterVoice: 'flute',
          dynamics: 1.08,
          bassStyle: 'waltz',
          arpStyle: 'waltz',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'G'], [3, 'C'], [3, 'D7'], [3, 'G'],
            [3, 'Em'], [3, 'Am7'], [3, 'D7'], [3, 'G'],
          ]),
          melody: [
            [71, 1.5], [67, 0.5], [62, 1.0],
            [64, 1.0], [67, 1.0], [72, 1.0],
            [69, 1.5], [66, 0.5], [62, 1.0],
            [67, 2.0], [71, 1.0],
            [71, 1.5], [67, 0.5], [64, 1.0],
            [72, 1.0], [69, 1.0], [67, 1.0],
            [69, 1.5], [66, 0.5], [62, 1.0],
            [67, 2.5], [null, 0.5],
          ],
          counterMelody: [
            [74, 1.5], [71, 0.5], [67, 1.0],
            [76, 1.5], [72, 0.5], [67, 1.0],
            [74, 1.5], [72, 0.5], [69, 1.0],
            [71, 2.0], [74, 1.0],
            [76, 1.5], [74, 0.5], [71, 1.0],
            [76, 1.0], [74, 1.0], [72, 1.0],
            [74, 1.5], [72, 0.5], [69, 1.0],
            [71, 2.5], [null, 0.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 0 (Level 1 - Paradeplatz Vaults, Zurich): "Guggisberglied"
    // Source: Traditional Swiss folk song (18th c., Canton Bern),
    //         "S'isch aeben e Moensch uf Aerde" / Simeliberg. Public domain.
    // Mood: Stealthy nocturnal bank-vault infiltration in E minor, 4/4 time.
    //       4-bar intro + 40-bar loop (160 beats @ 86 BPM = 111.6s).
    // =========================================================================
    level0: {
      source: 'Traditional Swiss Folk Song (18th c., Canton Bern), Guggisberglied / S\'isch aeben e Moensch (Public Domain)',
      bpm: 86,
      beatsPerBar: 4,
      bars: 44,
      loop: true,
      wet: 0.25,
      leadVoice: 'dulcimer',
      leadGain: 0.22,
      counterGain: 0.13,
      bassGain: 0.14,
      arpGain: 0.052,
      padGain: 0.046,
      key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
      sections: [
        // Intro (4 bars): Vault watch tick, pedal E, hushed dulcimer entry
        {
          name: 'Intro: Vault Clockwork',
          isIntro: true,
          bars: 4,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'dulcimer',
          dynamics: 0.78,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'vault',
          chords: chordSeq([[4, 'Em'], [4, 'Em'], [2, 'Am'], [2, 'B7'], [4, 'Em']]),
          melody: [
            [64, 2.0], [null, 2.0],
            [67, 1.5], [66, 0.5], [64, 2.0],
            [69, 2.0], [66, 1.5], [63, 0.5],
            [64, 3.0], [null, 1.0],
          ],
        },
        // Section A (8 bars): Guggisberglied Verse 1 in E minor
        {
          name: 'A: Guggisberglied Verse I',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'dulcimer',
          dynamics: 0.94,
          bassStyle: 'sneak',
          arpStyle: 'stealth',
          padMode: 'openFifth',
          percStyle: 'vault',
          chords: chordSeq([
            [4, 'Em'], [2, 'B7'], [2, 'Am'],
            [2, 'Em'], [2, 'B7'], [4, 'Em'],
            [2, 'Am'], [2, 'D'], [2, 'G'], [2, 'Em'],
            [2, 'Am'], [2, 'B7'], [4, 'Em'],
          ]),
          melody: [
            [64, 1.0], [67, 1.0], [71, 1.0], [72, 1.0],
            [71, 1.5], [69, 0.5], [69, 1.0], [67, 1.0],
            [67, 1.0], [66, 1.0], [66, 1.0], [63, 1.0],
            [64, 3.0], [null, 1.0],
            [69, 1.0], [72, 1.0], [74, 1.0], [72, 0.5], [71, 0.5],
            [71, 1.0], [69, 1.0], [67, 1.0], [64, 1.0],
            [69, 1.0], [67, 1.0], [66, 1.0], [63, 1.0],
            [64, 2.5], [null, 1.5],
          ],
        },
        // Section B (8 bars): Simeliberg Refrain in relative G major with flute lead & dulcimer counter
        {
          name: 'B: Simeliberg Refrain',
          bars: 8,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'dulcimer',
          dynamics: 1.02,
          bassStyle: 'walking',
          arpStyle: 'stealth',
          padMode: 'triad',
          percStyle: 'vault',
          chords: chordSeq([
            [2, 'G'], [2, 'D7'], [2, 'G'], [2, 'C'],
            [2, 'G'], [2, 'Em'], [2, 'Am'], [2, 'D7'],
            [2, 'G'], [2, 'C'], [2, 'D7'], [2, 'G'],
            [2, 'Em'], [2, 'Am'], [2, 'D7'], [2, 'G'],
          ]),
          melody: [
            [74, 1.0], [71, 1.0], [69, 1.0], [66, 1.0],
            [67, 1.5], [69, 0.5], [72, 1.0], [76, 1.0],
            [74, 1.0], [71, 1.0], [67, 1.0], [64, 1.0],
            [69, 1.5], [72, 0.5], [69, 1.5], [null, 0.5],
            [71, 1.0], [74, 1.0], [76, 1.0], [72, 1.0],
            [74, 1.0], [69, 1.0], [71, 1.5], [67, 0.5],
            [64, 1.0], [67, 1.0], [69, 1.0], [72, 1.0],
            [69, 1.0], [66, 1.0], [67, 2.0],
          ],
          counterMelody: [
            [67, 2.0], [66, 2.0],
            [67, 2.0], [67, 2.0],
            [71, 2.0], [71, 2.0],
            [72, 2.0], [66, 1.5], [null, 0.5],
            [67, 2.0], [72, 2.0],
            [66, 2.0], [67, 2.0],
            [67, 2.0], [64, 2.0],
            [66, 2.0], [62, 1.5], [null, 0.5],
          ],
        },
        // Section C (8 bars): Vault Corridor Development in A minor / E minor
        {
          name: 'C: Vault Shadow Development',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'alphorn',
          counterVoice: 'flute',
          dynamics: 1.05,
          bassStyle: 'walking',
          arpStyle: 'stealth',
          padMode: 'openFifth',
          percStyle: 'vault',
          chords: chordSeq([
            [2, 'Am'], [2, 'Em'], [2, 'B7'], [2, 'Em'],
            [2, 'C'], [2, 'G'], [2, 'Am'], [2, 'B7'],
            [2, 'Em'], [2, 'D'], [2, 'C'], [2, 'B7'],
            [2, 'Am'], [2, 'B7'], [4, 'Em'],
          ]),
          melody: [
            [69, 1.0], [72, 1.0], [71, 1.5], [67, 0.5],
            [66, 1.0], [63, 1.0], [64, 1.5], [67, 0.5],
            [67, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
            [69, 1.5], [67, 0.5], [66, 2.0],
            [64, 1.0], [67, 1.0], [66, 1.0], [69, 1.0],
            [67, 1.0], [64, 1.0], [66, 1.5], [63, 0.5],
            [64, 1.0], [69, 1.0], [66, 1.0], [63, 1.0],
            [64, 3.0], [null, 1.0],
          ],
          counterMelody: [
            [76, 2.0], [76, 2.0],
            [75, 2.0], [76, 2.0],
            [76, 2.0], [74, 2.0],
            [72, 2.0], [71, 1.5], [null, 0.5],
            [71, 2.0], [74, 2.0],
            [72, 2.0], [71, 2.0],
            [72, 2.0], [75, 2.0],
            [76, 2.5], [null, 1.5],
          ],
        },
        // Section D (8 bars): Quiet Safe-Cracking Breakdown (pedal bass, clock ticks, sparse chimes & rests)
        {
          name: 'D: Safe-Dial Breakdown',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'celesta',
          dynamics: 0.66,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'none',
          percStyle: 'vault',
          chords: chordSeq([
            [4, 'Em'], [4, 'Em'], [4, 'Am'], [4, 'Em'],
            [4, 'C'], [4, 'Am'], [4, 'B7'], [4, 'B7'],
          ]),
          melody: [
            [76, 1.5], [null, 0.5], [71, 1.0], [null, 1.0],
            [79, 1.5], [null, 0.5], [76, 1.0], [null, 1.0],
            [76, 1.5], [74, 0.5], [72, 1.5], [null, 0.5],
            [71, 2.0], [null, 2.0],
            [76, 1.0], [72, 1.0], [79, 1.5], [null, 0.5],
            [76, 1.0], [72, 1.0], [69, 1.5], [null, 0.5],
            [71, 1.5], [69, 0.5], [66, 1.5], [null, 0.5],
            [75, 2.0], [null, 2.0],
          ],
        },
        // Section A' (8 bars): Hushed octave-enriched return of Guggisberglied resolving to Em
        {
          name: 'A2: Midnight Return',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'dulcimer',
          counterVoice: 'warmStrings',
          dynamics: 1.04,
          bassStyle: 'sneak',
          arpStyle: 'stealth',
          padMode: 'openFifth',
          percStyle: 'vault',
          chords: chordSeq([
            [4, 'Em'], [2, 'B7'], [2, 'Am'],
            [2, 'Em'], [2, 'B7'], [4, 'Em'],
            [2, 'Am'], [2, 'D'], [2, 'G'], [2, 'Em'],
            [2, 'Am'], [2, 'B7'], [4, 'Em'],
          ]),
          melody: [
            [76, 1.0], [79, 1.0], [83, 1.0], [84, 1.0],
            [83, 1.5], [81, 0.5], [81, 1.0], [79, 1.0],
            [79, 1.0], [78, 1.0], [78, 1.0], [75, 1.0],
            [76, 3.0], [null, 1.0],
            [81, 1.0], [84, 1.0], [86, 1.0], [84, 0.5], [83, 0.5],
            [83, 1.0], [81, 1.0], [79, 1.0], [76, 1.0],
            [81, 1.0], [79, 1.0], [78, 1.0], [75, 1.0],
            [76, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [64, 2.0], [67, 2.0],
            [66, 2.0], [69, 2.0],
            [67, 2.0], [66, 2.0],
            [64, 3.0], [null, 1.0],
            [69, 2.0], [66, 2.0],
            [67, 2.0], [64, 2.0],
            [69, 2.0], [66, 2.0],
            [64, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 1 (Level 2 - Olten SBB Gleis 0): String Symphony No. 9 "La Suisse"
    // Source: Felix Mendelssohn (1809-1847), String Symphony No. 9 in C major
    //         "La Suisse" (MWV N 9, 1823) - III. Scherzo & Trio. Public domain.
    // Mood: Nimble, kinetic nocturnal railway concourse with rustic Swiss yodel
    //       Trio in 3/4 time. 4-bar intro + 72-bar loop (216 beats @ 124 BPM = 104.5s).
    // =========================================================================
    level1: {
      source: 'Felix Mendelssohn (1809-1847), String Symphony No. 9 in C major "La Suisse" (1823) - III. Scherzo & Trio (Public Domain)',
      bpm: 124,
      beatsPerBar: 3,
      bars: 76,
      loop: true,
      wet: 0.24,
      leadVoice: 'dulcimer',
      leadGain: 0.22,
      counterGain: 0.13,
      bassGain: 0.14,
      arpGain: 0.052,
      padGain: 0.044,
      key: { name: 'C major', rootPc: 0, mode: 'major' },
      sections: [
        // Intro (4 bars): SBB rail cadence & light staccato C pedal
        {
          name: 'Intro: Gleis 0 Departure',
          isIntro: true,
          bars: 4,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'dulcimer',
          dynamics: 0.80,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'none',
          percStyle: 'rail',
          articulation: 0.72,
          chords: chordSeq([[3, 'C'], [3, 'C'], [3, 'G7'], [3, 'C']]),
          melody: [
            [67, 1.0], [72, 1.0], [76, 1.0],
            [79, 2.0], [76, 1.0],
            [74, 1.0], [71, 1.0], [67, 1.0],
            [72, 2.0], [null, 1.0],
          ],
        },
        // Section A (16 bars): Nimble Scherzo Theme I in C major
        {
          name: 'A: Scherzo Theme I',
          bars: 16,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'dulcimer',
          dynamics: 0.96,
          bassStyle: 'waltz',
          arpStyle: 'waltz',
          padMode: 'openFifth',
          percStyle: 'rail',
          articulation: 0.74,
          chords: chordSeq([
            [3, 'C'], [3, 'C'], [3, 'G7'], [3, 'C'],
            [3, 'F'], [3, 'C'], [3, 'G7'], [3, 'C'],
            [3, 'Am'], [3, 'Dm'], [3, 'G7'], [3, 'C'],
            [3, 'F'], [3, 'G7'], [3, 'C'], [3, 'C'],
          ]),
          melody: [
            [72, 1.0], [76, 0.5], [74, 0.5], [72, 1.0],
            [79, 1.0], [76, 1.0], [72, 1.0],
            [74, 1.0], [71, 0.5], [72, 0.5], [74, 1.0],
            [76, 2.0], [72, 1.0],
            [77, 1.0], [74, 0.5], [76, 0.5], [77, 1.0],
            [76, 1.0], [72, 1.0], [67, 1.0],
            [71, 1.0], [74, 1.0], [79, 1.0],
            [76, 2.0], [null, 1.0],
            [76, 1.0], [72, 0.5], [74, 0.5], [76, 1.0],
            [77, 1.0], [74, 1.0], [69, 1.0],
            [71, 1.0], [74, 0.5], [76, 0.5], [77, 1.0],
            [76, 2.0], [72, 1.0],
            [77, 1.0], [81, 1.0], [77, 1.0],
            [79, 1.0], [74, 1.0], [71, 1.0],
            [72, 2.0], [76, 1.0],
            [72, 2.0], [null, 1.0],
          ],
        },
        // Section B (16 bars): Scherzo Theme II modulating to G major with flute + strings dialogue
        {
          name: 'B: Scherzo Dominant Wing',
          bars: 16,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'warmStrings',
          dynamics: 1.04,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'openFifth',
          percStyle: 'rail',
          articulation: 0.80,
          chords: chordSeq([
            [3, 'G'], [3, 'D7'], [3, 'G'], [3, 'C'],
            [3, 'G'], [3, 'Em'], [3, 'Am'], [3, 'D7'],
            [3, 'G'], [3, 'B7'], [3, 'Em'], [3, 'C'],
            [3, 'G'], [3, 'D7'], [3, 'G'], [3, 'G'],
          ]),
          melody: [
            [74, 1.0], [79, 0.5], [78, 0.5], [79, 1.0],
            [78, 1.0], [74, 1.0], [69, 1.0],
            [71, 1.0], [74, 0.5], [76, 0.5], [79, 1.0],
            [76, 2.0], [72, 1.0],
            [74, 1.0], [71, 1.0], [67, 1.0],
            [71, 1.0], [67, 1.0], [64, 1.0],
            [72, 1.0], [69, 1.0], [64, 1.0],
            [69, 2.0], [null, 1.0],
            [74, 1.0], [79, 1.0], [83, 1.0],
            [81, 1.0], [78, 1.0], [71, 1.0],
            [76, 1.0], [79, 0.5], [78, 0.5], [76, 1.0],
            [76, 1.0], [72, 1.0], [67, 1.0],
            [74, 1.0], [71, 1.0], [67, 1.0],
            [69, 1.0], [72, 1.0], [66, 1.0],
            [67, 2.0], [71, 1.0],
            [67, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [67, 2.0], [71, 1.0],
            [69, 2.0], [66, 1.0],
            [67, 2.0], [71, 1.0],
            [72, 2.0], [67, 1.0],
            [67, 2.0], [71, 1.0],
            [64, 2.0], [67, 1.0],
            [69, 2.0], [64, 1.0],
            [66, 2.0], [null, 1.0],
            [71, 2.0], [67, 1.0],
            [66, 2.0], [71, 1.0],
            [67, 2.0], [71, 1.0],
            [72, 2.0], [67, 1.0],
            [71, 2.0], [67, 1.0],
            [66, 2.0], [69, 1.0],
            [67, 2.0], [62, 1.0],
            [67, 2.0], [null, 1.0],
          ],
        },
        // Section C (16 bars): Trio "La Suisse" in F major — wide-leaping Swiss yodel tune on alphorn
        {
          name: 'C: Trio "La Suisse" (Yodel)',
          bars: 16,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          counterVoice: 'flute',
          dynamics: 1.02,
          bassStyle: 'pedal',
          arpStyle: 'waltz',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'F'], [3, 'F'], [3, 'C7'], [3, 'F'],
            [3, 'Bb'], [3, 'F'], [3, 'C7'], [3, 'F'],
            [3, 'Dm'], [3, 'Gm'], [3, 'C7'], [3, 'F'],
            [3, 'Bb'], [3, 'C7'], [3, 'F'], [3, 'C7'],
          ]),
          melody: [
            [65, 1.0], [72, 1.0], [69, 1.0],
            [77, 1.5], [72, 0.5], [69, 1.0],
            [70, 1.0], [67, 1.0], [64, 1.0],
            [65, 2.0], [60, 1.0],
            [70, 1.0], [74, 1.0], [70, 1.0],
            [72, 1.0], [69, 1.0], [65, 1.0],
            [67, 1.0], [70, 1.0], [64, 1.0],
            [65, 2.0], [null, 1.0],
            [69, 1.0], [74, 1.0], [69, 1.0],
            [70, 1.0], [74, 1.0], [67, 1.0],
            [67, 1.0], [72, 1.0], [70, 1.0],
            [69, 2.0], [65, 1.0],
            [74, 1.0], [70, 1.0], [65, 1.0],
            [72, 1.0], [67, 1.0], [70, 1.0],
            [69, 2.0], [65, 1.0],
            [67, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [72, 2.0], [69, 1.0],
            [72, 2.0], [77, 1.0],
            [76, 2.0], [72, 1.0],
            [72, 2.0], [null, 1.0],
            [74, 2.0], [77, 1.0],
            [77, 2.0], [72, 1.0],
            [76, 2.0], [70, 1.0],
            [72, 2.0], [null, 1.0],
            [74, 2.0], [77, 1.0],
            [74, 2.0], [70, 1.0],
            [72, 2.0], [76, 1.0],
            [77, 2.0], [72, 1.0],
            [77, 2.0], [74, 1.0],
            [76, 2.0], [72, 1.0],
            [72, 2.0], [77, 1.0],
            [76, 2.0], [null, 1.0],
          ],
        },
        // Section D (8 bars): Quiet late-night station timetable breakdown in A minor
        {
          name: 'D: Midnight Platform Breakdown',
          bars: 8,
          key: { name: 'A minor', rootPc: 9, mode: 'naturalMinor' },
          chromaticPassing: [8],
          leadVoice: 'celesta',
          dynamics: 0.64,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'rail',
          chords: chordSeq([
            [3, 'Am'], [3, 'Am'], [3, 'Dm'], [3, 'Am'],
            [3, 'F'], [3, 'Dm'], [3, 'E7'], [3, 'G7'],
          ]),
          melody: [
            [76, 2.0], [null, 1.0],
            [72, 1.5], [71, 0.5], [69, 1.0],
            [74, 2.0], [null, 1.0],
            [72, 2.0], [null, 1.0],
            [77, 1.5], [76, 0.5], [72, 1.0],
            [74, 1.5], [72, 0.5], [69, 1.0],
            [71, 2.0], [68, 1.0],
            [71, 2.0], [null, 1.0],
          ],
        },
        // Section A' (16 bars): Scherzo Da Capo with flute + dulcimer sparkle & brisk coda
        {
          name: 'A2: Scherzo Da Capo',
          bars: 16,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'dulcimer',
          counterVoice: 'flute',
          dynamics: 1.08,
          bassStyle: 'walking',
          arpStyle: 'waltz',
          padMode: 'triad',
          percStyle: 'rail',
          articulation: 0.76,
          chords: chordSeq([
            [3, 'C'], [3, 'C'], [3, 'G7'], [3, 'C'],
            [3, 'F'], [3, 'C'], [3, 'G7'], [3, 'C'],
            [3, 'Am'], [3, 'F'], [3, 'G7'], [3, 'Em'],
            [3, 'Dm'], [3, 'G7'], [3, 'C'], [3, 'C'],
          ]),
          melody: [
            [72, 1.0], [76, 0.5], [74, 0.5], [72, 1.0],
            [79, 1.0], [76, 1.0], [72, 1.0],
            [74, 1.0], [71, 0.5], [72, 0.5], [74, 1.0],
            [76, 2.0], [72, 1.0],
            [77, 1.0], [74, 0.5], [76, 0.5], [77, 1.0],
            [76, 1.0], [72, 1.0], [67, 1.0],
            [71, 1.0], [74, 1.0], [79, 1.0],
            [76, 2.0], [null, 1.0],
            [76, 1.0], [81, 1.0], [76, 1.0],
            [77, 1.0], [72, 1.0], [69, 1.0],
            [74, 1.0], [79, 1.0], [74, 1.0],
            [76, 1.0], [71, 1.0], [67, 1.0],
            [74, 1.0], [77, 1.0], [74, 1.0],
            [79, 1.0], [74, 1.0], [71, 1.0],
            [72, 2.0], [76, 1.0],
            [72, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [76, 2.0], [72, 1.0],
            [84, 2.0], [79, 1.0],
            [79, 2.0], [74, 1.0],
            [79, 2.0], [76, 1.0],
            [81, 2.0], [77, 1.0],
            [79, 2.0], [76, 1.0],
            [74, 2.0], [71, 1.0],
            [72, 2.0], [null, 1.0],
            [81, 2.0], [76, 1.0],
            [81, 2.0], [77, 1.0],
            [79, 2.0], [74, 1.0],
            [79, 2.0], [76, 1.0],
            [77, 2.0], [74, 1.0],
            [74, 2.0], [79, 1.0],
            [76, 2.0], [79, 1.0],
            [84, 2.0], [null, 1.0],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 2 (Level 3 - Gotthard Reduit Bunker): "Der alte Berner Marsch"
    // Source: Traditional Swiss military march (18th c., Canton Bern). Public domain.
    // Mood: Steady, disciplined subterranean march in G major, 4/4 time.
    //       4-bar intro + 52-bar loop (208 beats @ 112 BPM = 111.4s).
    // =========================================================================
    level2: {
      source: 'Traditional Swiss Military March (18th c., Canton Bern), Der alte Berner Marsch (Public Domain)',
      bpm: 112,
      beatsPerBar: 4,
      bars: 56,
      loop: true,
      wet: 0.26,
      leadVoice: 'alphorn',
      leadGain: 0.23,
      counterGain: 0.135,
      bassGain: 0.15,
      arpGain: 0.054,
      padGain: 0.045,
      key: { name: 'G major', rootPc: 7, mode: 'major' },
      sections: [
        // Intro (4 bars): Subterranean drum cadence + G horn fifths
        {
          name: 'Intro: Reduit Garrison Call',
          isIntro: true,
          bars: 4,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.82,
          bassStyle: 'pedal',
          arpStyle: 'none',
          padMode: 'lowDrone',
          percStyle: 'march',
          chords: chordSeq([[4, 'G'], [4, 'G'], [2, 'D7'], [2, 'D7'], [4, 'G']]),
          melody: [
            [62, 1.0], [67, 1.0], [67, 2.0],
            [71, 1.5], [69, 0.5], [67, 2.0],
            [69, 1.0], [66, 1.0], [62, 2.0],
            [67, 2.5], [null, 1.5],
          ],
        },
        // Section A (8 bars): Berner Marsch Part 1 in G major
        {
          name: 'A: Berner Marsch Strain I',
          bars: 8,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.96,
          bassStyle: 'march',
          arpStyle: 'march',
          padMode: 'openFifth',
          percStyle: 'march',
          chords: chordSeq([
            [2, 'G'], [2, 'D7'], [4, 'G'],
            [2, 'C'], [2, 'G'], [4, 'D7'],
            [2, 'C'], [2, 'G'], [2, 'D7'], [2, 'G'],
            [2, 'Am'], [2, 'D7'], [4, 'G'],
          ]),
          melody: [
            [67, 1.0], [67, 1.0], [69, 1.5], [66, 0.5],
            [67, 0.5], [69, 0.5], [71, 1.0], [74, 1.0], [71, 1.0],
            [72, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
            [69, 1.5], [67, 0.5], [66, 1.0], [62, 1.0],
            [72, 1.0], [76, 1.0], [74, 1.0], [71, 1.0],
            [69, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
            [69, 0.5], [71, 0.5], [72, 1.0], [69, 1.0], [66, 1.0],
            [67, 2.5], [null, 1.5],
          ],
        },
        // Section B (8 bars): Berner Marsch Part 2 high brass & flute fife counter-line
        {
          name: 'B: Berner Marsch Strain II',
          bars: 8,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.06,
          bassStyle: 'march',
          arpStyle: 'march',
          padMode: 'triad',
          percStyle: 'march',
          chords: chordSeq([
            [4, 'G'], [4, 'D7'], [4, 'D7'], [4, 'G'],
            [2, 'C'], [2, 'G'], [2, 'Am'], [2, 'D7'],
            [2, 'G'], [2, 'D7'], [4, 'G'],
          ]),
          melody: [
            [71, 1.0], [74, 1.0], [79, 1.0], [74, 1.0],
            [78, 1.5], [76, 0.5], [74, 1.0], [69, 1.0],
            [78, 1.0], [78, 1.0], [81, 1.0], [78, 1.0],
            [79, 2.0], [74, 1.5], [null, 0.5],
            [76, 1.0], [72, 1.0], [74, 1.0], [71, 1.0],
            [72, 1.0], [69, 1.0], [69, 1.0], [66, 1.0],
            [71, 1.0], [74, 1.0], [78, 1.0], [74, 1.0],
            [79, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [79, 2.0], [74, 2.0],
            [74, 2.0], [72, 2.0],
            [72, 2.0], [74, 2.0],
            [74, 2.0], [71, 1.5], [null, 0.5],
            [72, 2.0], [71, 2.0],
            [69, 2.0], [72, 2.0],
            [74, 2.0], [72, 2.0],
            [71, 2.5], [null, 1.5],
          ],
        },
        // Section C (12 bars): Subdominant Trio in C major (fife & warm strings over walking bass)
        {
          name: 'C: Garrison Trio',
          bars: 12,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'warmStrings',
          dynamics: 0.92,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'openFifth',
          percStyle: 'march',
          chords: chordSeq([
            [4, 'C'], [2, 'F'], [2, 'C'], [2, 'G7'], [2, 'C'], [4, 'G7'],
            [4, 'C'], [2, 'F'], [2, 'Dm'], [2, 'C'], [2, 'G7'], [4, 'C'],
            [2, 'Am'], [2, 'F'], [2, 'C'], [2, 'G7'], [2, 'F'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [76, 1.5], [74, 0.5], [72, 1.0], [67, 1.0],
            [69, 1.0], [72, 1.0], [76, 1.0], [72, 1.0],
            [74, 1.0], [71, 1.0], [72, 1.0], [76, 1.0],
            [74, 2.5], [null, 1.5],
            [76, 1.5], [74, 0.5], [72, 1.0], [79, 1.0],
            [77, 1.0], [72, 1.0], [74, 1.0], [69, 1.0],
            [72, 1.0], [76, 1.0], [74, 1.0], [71, 1.0],
            [72, 2.5], [null, 1.5],
            [76, 1.0], [72, 1.0], [77, 1.0], [72, 1.0],
            [79, 1.0], [76, 1.0], [74, 1.0], [71, 1.0],
            [77, 1.0], [72, 1.0], [74, 1.0], [79, 1.0],
            [76, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [72, 2.0], [67, 2.0],
            [65, 2.0], [67, 2.0],
            [71, 2.0], [72, 2.0],
            [71, 2.5], [null, 1.5],
            [72, 2.0], [76, 2.0],
            [72, 2.0], [69, 2.0],
            [67, 2.0], [71, 2.0],
            [67, 2.5], [null, 1.5],
            [72, 2.0], [69, 2.0],
            [72, 2.0], [71, 2.0],
            [69, 2.0], [71, 2.0],
            [72, 2.5], [null, 1.5],
          ],
        },
        // Section D (8 bars): Granite Bunker Patrol in E minor (tense minor development)
        {
          name: 'D: Bunker Patrol (Minor)',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'alphorn',
          dynamics: 0.98,
          bassStyle: 'pulse',
          arpStyle: 'storm',
          padMode: 'openFifth',
          percStyle: 'march',
          chords: chordSeq([
            [4, 'Em'], [2, 'Am'], [2, 'B7'], [4, 'Em'], [2, 'C'], [2, 'D'],
            [2, 'Em'], [2, 'Am'], [2, 'B7'], [2, 'Em'], [2, 'Am'], [2, 'B7'], [4, 'D7'],
          ]),
          melody: [
            [64, 1.0], [67, 1.0], [71, 1.5], [67, 0.5],
            [69, 1.0], [72, 1.0], [71, 1.0], [66, 1.0],
            [67, 1.0], [71, 1.0], [76, 1.5], [71, 0.5],
            [72, 1.0], [67, 1.0], [66, 1.0], [69, 1.0],
            [71, 1.0], [67, 1.0], [69, 1.0], [64, 1.0],
            [66, 1.0], [63, 1.0], [64, 1.0], [67, 1.0],
            [69, 1.0], [72, 1.0], [71, 1.0], [66, 1.0],
            [69, 2.0], [66, 1.0], [null, 1.0],
          ],
        },
        // Section E (6 bars): Drum & Fife Breakdown (pedal D/G, sparse echoing calls & rests)
        {
          name: 'E: Drum & Fife Breakdown',
          bars: 6,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          dynamics: 0.68,
          bassStyle: 'pedal',
          arpStyle: 'none',
          padMode: 'none',
          percStyle: 'march',
          chords: chordSeq([
            [4, 'G'], [4, 'G'], [4, 'C'], [4, 'G'], [4, 'D7'], [4, 'D7'],
          ]),
          melody: [
            [79, 1.0], [74, 1.0], [null, 2.0],
            [74, 1.0], [71, 1.0], [67, 1.5], [null, 0.5],
            [76, 1.0], [72, 1.0], [null, 2.0],
            [74, 1.0], [71, 1.0], [null, 2.0],
            [74, 1.5], [72, 0.5], [69, 1.0], [66, 1.0],
            [69, 2.0], [null, 2.0],
          ],
        },
        // Section A' (10 bars): Full Da Capo Return in G major with brass & flute harmony
        {
          name: 'A2: Triumphant Da Capo',
          bars: 10,
          key: { name: 'G major', rootPc: 7, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.10,
          bassStyle: 'march',
          arpStyle: 'march',
          padMode: 'triad',
          percStyle: 'march',
          chords: chordSeq([
            [2, 'G'], [2, 'D7'], [4, 'G'],
            [2, 'C'], [2, 'G'], [4, 'D7'],
            [2, 'C'], [2, 'G'], [2, 'D7'], [2, 'G'],
            [2, 'Am'], [2, 'D7'], [4, 'G'],
            [2, 'C'], [2, 'D7'], [4, 'G'],
          ]),
          melody: [
            [67, 1.0], [67, 1.0], [69, 1.5], [66, 0.5],
            [67, 0.5], [69, 0.5], [71, 1.0], [74, 1.0], [71, 1.0],
            [72, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
            [69, 1.5], [67, 0.5], [66, 1.0], [62, 1.0],
            [72, 1.0], [76, 1.0], [74, 1.0], [71, 1.0],
            [69, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
            [69, 0.5], [71, 0.5], [72, 1.0], [69, 1.0], [66, 1.0],
            [67, 2.0], [71, 2.0],
            [72, 1.0], [76, 1.0], [74, 1.0], [78, 1.0],
            [79, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [74, 2.0], [72, 2.0],
            [71, 2.0], [79, 2.0],
            [76, 2.0], [74, 2.0],
            [72, 2.0], [69, 2.0],
            [76, 2.0], [79, 2.0],
            [78, 2.0], [74, 2.0],
            [72, 2.0], [78, 2.0],
            [79, 2.0], [74, 2.0],
            [76, 2.0], [78, 2.0],
            [74, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 3 (Level 4 - Grande Dixence Dam, Valais): "Chapelle de Guillaume Tell"
    // Source: Franz Liszt (1811-1886), Annees de pelerinage: Premiere annee -
    //         Suisse (S. 160, 1848-1854), No. 1: Chapelle de Guillaume Tell.
    //         Public domain.
    // Mood: Monumental alpine concrete monolith & rushing spillway water; solemn
    //       chorale hymn alternating with horn fanfares and shimmering arpeggios.
    //       4-bar intro + 40-bar loop (160 beats @ 88 BPM = 109.1s).
    // =========================================================================
    level3: {
      source: 'Franz Liszt (1811-1886), Annees de pelerinage: Suisse (S. 160, 1848-1854) - No. 1: Chapelle de Guillaume Tell (Public Domain)',
      bpm: 88,
      beatsPerBar: 4,
      bars: 44,
      loop: true,
      wet: 0.34,
      leadVoice: 'alphorn',
      leadGain: 0.23,
      counterGain: 0.135,
      bassGain: 0.145,
      arpGain: 0.056,
      padGain: 0.058,
      key: { name: 'C major', rootPc: 0, mode: 'major' },
      sections: [
        // Intro (4 bars): Deep subterranean dam-wall C pedal & stately chime opening
        {
          name: 'Intro: Concrete Monolith',
          isIntro: true,
          bars: 4,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.78,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'none',
          chords: chordSeq([[4, 'C'], [4, 'C'], [4, 'F'], [4, 'G']]),
          melody: [
            [60, 2.0], [67, 2.0],
            [64, 2.0], [67, 2.0],
            [69, 2.0], [65, 2.0],
            [67, 3.0], [null, 1.0],
          ],
        },
        // Section A (8 bars): Piu lento — solemn Swiss chorale hymn in C major
        {
          name: 'A: Chorale Hymn (Piu lento)',
          bars: 8,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.94,
          bassStyle: 'roots',
          arpStyle: 'tremolo',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [4, 'C'], [2, 'F'], [2, 'C'], [2, 'Am'], [2, 'Em'], [4, 'G'],
            [2, 'C'], [2, 'F'], [2, 'Dm'], [2, 'G7'], [2, 'C'], [2, 'F'], [4, 'C'],
          ]),
          melody: [
            [67, 1.5], [64, 0.5], [67, 1.0], [72, 1.0],
            [72, 1.0], [69, 1.0], [67, 2.0],
            [69, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
            [67, 2.0], [62, 1.5], [null, 0.5],
            [64, 1.0], [67, 1.0], [69, 1.0], [72, 1.0],
            [74, 1.0], [69, 1.0], [71, 1.5], [67, 0.5],
            [72, 1.0], [67, 1.0], [69, 1.0], [65, 1.0],
            [64, 2.5], [null, 1.5],
          ],
        },
        // Section B (8 bars): Energico — alpine horn fanfares over rushing spillway water tremolos
        {
          name: 'B: Alpine Horn Fanfare (Energico)',
          bars: 8,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.08,
          bassStyle: 'pulse',
          arpStyle: 'tremolo',
          padMode: 'openFifth',
          percStyle: 'summit',
          chords: chordSeq([
            [4, 'C'], [4, 'G'], [2, 'Am'], [2, 'F'], [4, 'G7'],
            [2, 'C'], [2, 'Em'], [2, 'F'], [2, 'G'], [2, 'F'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [72, 0.75], [72, 0.25], [76, 1.0], [79, 1.5], [76, 0.5],
            [74, 0.75], [74, 0.25], [71, 1.0], [67, 2.0],
            [72, 1.0], [76, 1.0], [77, 1.0], [72, 1.0],
            [74, 2.5], [null, 1.5],
            [76, 0.75], [76, 0.25], [72, 1.0], [71, 1.0], [76, 1.0],
            [77, 1.0], [72, 1.0], [74, 1.0], [79, 1.0],
            [77, 1.0], [81, 1.0], [79, 1.0], [74, 1.0],
            [72, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [67, 2.0], [72, 2.0],
            [71, 2.0], [74, 2.0],
            [69, 2.0], [69, 2.0],
            [71, 2.5], [null, 1.5],
            [72, 2.0], [67, 2.0],
            [69, 2.0], [71, 2.0],
            [72, 2.0], [71, 2.0],
            [76, 2.5], [null, 1.5],
          ],
        },
        // Section C (8 bars): Spillway Cascade in F major — rippling water flute & warm strings
        {
          name: 'C: Spillway Cascade',
          bars: 8,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'warmStrings',
          dynamics: 0.96,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [4, 'F'], [2, 'Bb'], [2, 'F'], [2, 'Gm'], [2, 'C7'], [4, 'F'],
            [2, 'Dm'], [2, 'Bb'], [2, 'F'], [2, 'C7'], [2, 'Bb'], [2, 'C7'], [4, 'F'],
          ]),
          melody: [
            [77, 1.5], [76, 0.5], [72, 1.0], [69, 1.0],
            [70, 1.0], [74, 1.0], [72, 1.5], [69, 0.5],
            [70, 1.0], [67, 1.0], [72, 1.0], [70, 1.0],
            [69, 2.5], [null, 1.5],
            [74, 1.0], [77, 1.0], [74, 1.0], [70, 1.0],
            [72, 1.0], [69, 1.0], [67, 1.5], [70, 0.5],
            [74, 1.0], [70, 1.0], [72, 1.0], [76, 1.0],
            [77, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [69, 2.0], [72, 2.0],
            [74, 2.0], [69, 2.0],
            [67, 2.0], [67, 2.0],
            [65, 2.5], [null, 1.5],
            [69, 2.0], [70, 2.0],
            [65, 2.0], [64, 2.0],
            [70, 2.0], [70, 2.0],
            [69, 2.5], [null, 1.5],
          ],
        },
        // Section D (6 bars): Dark Turbines Development in A minor
        {
          name: 'D: Turbine Gallery (Minor)',
          bars: 6,
          key: { name: 'A minor', rootPc: 9, mode: 'naturalMinor' },
          chromaticPassing: [8],
          leadVoice: 'warmStrings',
          dynamics: 1.02,
          bassStyle: 'pulse',
          arpStyle: 'tremolo',
          padMode: 'openFifth',
          percStyle: 'summit',
          chords: chordSeq([
            [4, 'Am'], [2, 'Dm'], [2, 'E7'], [2, 'Am'], [2, 'F'],
            [2, 'Dm'], [2, 'E7'], [2, 'F'], [2, 'G'], [4, 'G7'],
          ]),
          melody: [
            [69, 1.0], [72, 1.0], [76, 1.5], [72, 0.5],
            [74, 1.0], [69, 1.0], [71, 1.0], [68, 1.0],
            [69, 1.0], [72, 1.0], [72, 1.0], [69, 1.0],
            [74, 1.0], [77, 1.0], [76, 1.0], [71, 1.0],
            [72, 1.0], [69, 1.0], [71, 1.0], [74, 1.0],
            [74, 2.0], [71, 1.0], [null, 1.0],
          ],
        },
        // Section E (4 bars): Cavernous Water-Drop Breakdown (pedal C + sparse celesta & rests)
        {
          name: 'E: Cavernous Breakdown',
          bars: 4,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.62,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'sparse',
          chords: chordSeq([[4, 'C'], [4, 'F'], [4, 'Am'], [4, 'G7']]),
          melody: [
            [79, 1.5], [null, 0.5], [76, 1.0], [null, 1.0],
            [77, 1.5], [null, 0.5], [72, 1.0], [null, 1.0],
            [76, 1.5], [74, 0.5], [72, 1.0], [null, 1.0],
            [74, 2.0], [null, 2.0],
          ],
        },
        // Section A' (6 bars): Largamente Grand Chorale Return in C major
        {
          name: 'A2: Largamente Return',
          bars: 6,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          counterVoice: 'flute',
          dynamics: 1.12,
          bassStyle: 'roots',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'summit',
          chords: chordSeq([
            [4, 'C'], [2, 'F'], [2, 'C'], [2, 'Dm'], [2, 'G7'],
            [2, 'Am'], [2, 'F'], [2, 'C'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [67, 1.5], [64, 0.5], [67, 1.0], [72, 1.0],
            [72, 1.0], [69, 1.0], [67, 2.0],
            [69, 1.0], [74, 1.0], [71, 1.5], [67, 0.5],
            [72, 1.0], [76, 1.0], [77, 1.0], [72, 1.0],
            [76, 1.0], [72, 1.0], [74, 1.0], [71, 1.0],
            [72, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [76, 2.0], [79, 2.0],
            [77, 2.0], [76, 2.0],
            [77, 2.0], [74, 2.0],
            [76, 2.0], [81, 2.0],
            [79, 2.0], [79, 2.0],
            [76, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 4 (Level 5 - Chillon Viaduct, Lake Geneva): "Au lac de Wallenstadt"
    // Source: Franz Liszt (1811-1886), Annees de pelerinage: Premiere annee -
    //         Suisse (S. 160, 1848-1854), No. 2: Au lac de Wallenstadt.
    //         Public domain.
    // Mood: Serene, moonlit lakeside barcarolle in A-flat major, 3/4 time.
    //       4-bar intro + 56-bar loop (168 beats @ 90 BPM = 112.0s).
    // =========================================================================
    level4: {
      source: 'Franz Liszt (1811-1886), Annees de pelerinage: Suisse (S. 160, 1848-1854) - No. 2: Au lac de Wallenstadt (Public Domain)',
      bpm: 90,
      beatsPerBar: 3,
      bars: 60,
      loop: true,
      wet: 0.36,
      leadVoice: 'flute',
      leadGain: 0.22,
      counterGain: 0.13,
      bassGain: 0.125,
      arpGain: 0.056,
      padGain: 0.055,
      key: { name: 'Ab major', rootPc: 8, mode: 'major' },
      sections: [
        // Intro (4 bars): Rocking barcarolle waves in Ab major
        {
          name: 'Intro: Lake Ripples',
          isIntro: true,
          bars: 4,
          key: { name: 'Ab major', rootPc: 8, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.76,
          bassStyle: 'pedal',
          arpStyle: 'barcarolle',
          padMode: 'lowDrone',
          percStyle: 'none',
          chords: chordSeq([[3, 'Ab'], [3, 'Ab'], [3, 'Eb7'], [3, 'Ab']]),
          melody: [
            [72, 2.0], [75, 1.0],
            [80, 2.0], [75, 1.0],
            [73, 1.5], [70, 1.5],
            [72, 2.0], [null, 1.0],
          ],
        },
        // Section A (12 bars): Andante placido — cantabile lakeside melody in Ab major
        {
          name: 'A: Andante placido',
          bars: 12,
          key: { name: 'Ab major', rootPc: 8, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          dynamics: 0.92,
          bassStyle: 'waltz',
          arpStyle: 'barcarolle',
          padMode: 'openFifth',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'Ab'], [3, 'Ab'], [3, 'Db'], [3, 'Ab'],
            [3, 'Fm'], [3, 'Bbm'], [3, 'Eb7'], [3, 'Ab'],
            [3, 'Db'], [3, 'Ab'], [3, 'Eb7'], [3, 'Ab'],
          ]),
          melody: [
            [72, 1.5], [73, 0.5], [75, 1.0],
            [75, 1.5], [72, 0.5], [68, 1.0],
            [73, 1.5], [72, 0.5], [68, 1.0],
            [72, 2.0], [null, 1.0],
            [72, 1.5], [75, 0.5], [77, 1.0],
            [73, 1.5], [70, 0.5], [65, 1.0],
            [67, 1.5], [70, 0.5], [73, 1.0],
            [72, 2.0], [68, 1.0],
            [77, 1.5], [75, 0.5], [73, 1.0],
            [75, 1.5], [72, 0.5], [68, 1.0],
            [70, 1.5], [67, 0.5], [63, 1.0],
            [68, 2.5], [null, 0.5],
          ],
        },
        // Section B (12 bars): Dolcissimo upper-register cantabile + warm strings counter-melody
        {
          name: 'B: Moonlit Archways',
          bars: 12,
          key: { name: 'Ab major', rootPc: 8, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'warmStrings',
          counterVoice: 'flute',
          dynamics: 1.02,
          bassStyle: 'walking',
          arpStyle: 'barcarolle',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'Ab'], [3, 'Cm'], [3, 'Db'], [3, 'Eb7'],
            [3, 'Ab'], [3, 'Fm'], [3, 'Bbm7'], [3, 'Eb7'],
            [3, 'Db'], [3, 'Ab'], [3, 'Eb7'], [3, 'Ab'],
          ]),
          melody: [
            [75, 1.5], [77, 0.5], [80, 1.0],
            [79, 1.5], [75, 0.5], [72, 1.0],
            [73, 1.5], [77, 0.5], [80, 1.0],
            [79, 2.0], [75, 1.0],
            [80, 1.5], [75, 0.5], [72, 1.0],
            [77, 1.5], [72, 0.5], [68, 1.0],
            [70, 1.0], [73, 1.0], [77, 1.0],
            [75, 2.0], [70, 1.0],
            [73, 1.5], [77, 0.5], [73, 1.0],
            [72, 1.5], [75, 0.5], [72, 1.0],
            [70, 1.5], [73, 0.5], [67, 1.0],
            [68, 2.5], [null, 0.5],
          ],
          counterMelody: [
            [72, 2.0], [68, 1.0],
            [75, 2.0], [72, 1.0],
            [77, 2.0], [73, 1.0],
            [75, 2.0], [70, 1.0],
            [72, 2.0], [75, 1.0],
            [72, 2.0], [77, 1.0],
            [73, 2.0], [70, 1.0],
            [70, 2.0], [null, 1.0],
            [77, 2.0], [80, 1.0],
            [80, 2.0], [75, 1.0],
            [75, 2.0], [73, 1.0],
            [72, 2.5], [null, 0.5],
          ],
        },
        // Section C (12 bars): Chillon Dungeon Shadow in relative F minor (alphorn & walking bass)
        {
          name: 'C: Chillon Keep (F minor)',
          bars: 12,
          key: { name: 'F minor', rootPc: 5, mode: 'naturalMinor' },
          chromaticPassing: [4], // E natural leading tone on C7
          leadVoice: 'alphorn',
          counterVoice: 'warmStrings',
          dynamics: 1.00,
          bassStyle: 'walking',
          arpStyle: 'tremolo',
          padMode: 'openFifth',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'Fm'], [3, 'Bbm'], [3, 'C7'], [3, 'Fm'],
            [3, 'Db'], [3, 'Bbm'], [3, 'C7'], [3, 'Fm'],
            [3, 'Ab'], [3, 'Db'], [3, 'Bbm'], [3, 'C7'],
          ]),
          melody: [
            [68, 1.5], [67, 0.5], [65, 1.0],
            [70, 1.5], [68, 0.5], [65, 1.0],
            [67, 1.5], [64, 0.5], [60, 1.0],
            [65, 2.0], [null, 1.0],
            [68, 1.5], [73, 0.5], [72, 1.0],
            [70, 1.5], [68, 0.5], [65, 1.0],
            [67, 1.5], [70, 0.5], [64, 1.0],
            [65, 2.0], [68, 1.0],
            [72, 1.5], [75, 0.5], [72, 1.0],
            [73, 1.5], [72, 0.5], [68, 1.0],
            [70, 1.0], [68, 1.0], [65, 1.0],
            [67, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [72, 2.0], [68, 1.0],
            [73, 2.0], [70, 1.0],
            [72, 2.0], [70, 1.0],
            [68, 2.0], [null, 1.0],
            [73, 2.0], [77, 1.0],
            [73, 2.0], [70, 1.0],
            [72, 2.0], [70, 1.0],
            [68, 2.0], [72, 1.0],
            [75, 2.0], [72, 1.0],
            [77, 2.0], [73, 1.0],
            [73, 2.0], [70, 1.0],
            [72, 2.0], [null, 1.0],
          ],
        },
        // Section D (8 bars): Quiet Lakeside Reflection Breakdown (pedal Ab + celesta & rests)
        {
          name: 'D: Still Water Breakdown',
          bars: 8,
          key: { name: 'Ab major', rootPc: 8, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.64,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'Ab'], [3, 'Ab'], [3, 'Db'], [3, 'Ab'],
            [3, 'Fm'], [3, 'Bbm7'], [3, 'Eb7'], [3, 'Eb7'],
          ]),
          melody: [
            [80, 2.0], [null, 1.0],
            [75, 1.5], [73, 0.5], [72, 1.0],
            [77, 2.0], [null, 1.0],
            [75, 2.0], [null, 1.0],
            [72, 1.5], [70, 0.5], [68, 1.0],
            [73, 1.5], [70, 0.5], [68, 1.0],
            [70, 2.0], [67, 1.0],
            [75, 2.0], [null, 1.0],
          ],
        },
        // Section A' (12 bars): Luminous Barcarolle Return in Ab major (flute + celesta shimmer)
        {
          name: 'A2: Serene Return',
          bars: 12,
          key: { name: 'Ab major', rootPc: 8, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'celesta',
          dynamics: 1.04,
          bassStyle: 'waltz',
          arpStyle: 'barcarolle',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [3, 'Ab'], [3, 'Ab'], [3, 'Db'], [3, 'Ab'],
            [3, 'Fm'], [3, 'Bbm'], [3, 'Eb7'], [3, 'Ab'],
            [3, 'Db'], [3, 'Ab'], [3, 'Eb7'], [3, 'Ab'],
          ]),
          melody: [
            [72, 1.5], [73, 0.5], [75, 1.0],
            [80, 1.5], [75, 0.5], [72, 1.0],
            [73, 1.5], [77, 0.5], [73, 1.0],
            [72, 2.0], [68, 1.0],
            [77, 1.5], [75, 0.5], [72, 1.0],
            [73, 1.5], [70, 0.5], [65, 1.0],
            [67, 1.5], [70, 0.5], [73, 1.0],
            [72, 2.0], [75, 1.0],
            [77, 1.5], [80, 0.5], [77, 1.0],
            [75, 1.5], [72, 0.5], [68, 1.0],
            [70, 1.5], [73, 0.5], [67, 1.0],
            [68, 2.5], [null, 0.5],
          ],
          counterMelody: [
            [80, 2.0], [75, 1.0],
            [84, 2.0], [80, 1.0],
            [85, 2.0], [80, 1.0],
            [84, 2.0], [null, 1.0],
            [80, 2.0], [77, 1.0],
            [82, 2.0], [77, 1.0],
            [79, 2.0], [75, 1.0],
            [80, 2.0], [null, 1.0],
            [85, 2.0], [80, 1.0],
            [84, 2.0], [80, 1.0],
            [79, 2.0], [75, 1.0],
            [80, 2.5], [null, 0.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 5 (Level 6 - CERN Ring Sector 4, Geneva): "Lueget, vo Baergen und Tal"
    // Source: Ferdinand Fuerchtegott Huber (1791-1863), 1822. Public domain.
    // Mood: Luminous, mysterious scientific pulse in F major / D minor, 3/4 time.
    //       4-bar intro + 64-bar loop (192 beats @ 96 BPM = 120.0s).
    // =========================================================================
    level5: {
      source: 'Ferdinand Fuerchtegott Huber (1791-1863), Lueget, vo Baergen und Tal (1822) (Public Domain)',
      bpm: 96,
      beatsPerBar: 3,
      bars: 68,
      loop: true,
      wet: 0.34,
      leadVoice: 'flute',
      leadGain: 0.22,
      counterGain: 0.13,
      bassGain: 0.13,
      arpGain: 0.062,
      padGain: 0.05,
      key: { name: 'F major', rootPc: 5, mode: 'major' },
      sections: [
        // Intro (4 bars): Beamline synchrotron arpeggio & wood-tick clock
        {
          name: 'Intro: Synchrotron Pulse',
          isIntro: true,
          bars: 4,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.78,
          bassStyle: 'pedal',
          arpStyle: 'cern',
          padMode: 'lowDrone',
          percStyle: 'cern',
          chords: chordSeq([[3, 'Dm7'], [3, 'Dm7'], [3, 'Am7'], [3, 'Dm7']]),
          melody: [
            [74, 2.0], [null, 1.0],
            [72, 1.5], [69, 1.5],
            [72, 2.0], [67, 1.0],
            [69, 2.0], [null, 1.0],
          ],
        },
        // Section A (12 bars): Huber modal theme in Dm7 / Fmaj7
        {
          name: 'A: Beamline Theme I',
          bars: 12,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          dynamics: 0.94,
          bassStyle: 'pulse',
          arpStyle: 'cern',
          padMode: 'openFifth',
          percStyle: 'cern',
          chords: chordSeq([
            [3, 'Dm7'], [3, 'Gm7'], [3, 'Fmaj7'], [3, 'C'],
            [3, 'Dm7'], [3, 'Bbmaj7'], [3, 'Fmaj7'], [3, 'Am7'],
            [3, 'Bbmaj7'], [3, 'Gm7'], [3, 'C7'], [3, 'Dm'],
          ]),
          melody: [
            [72, 1.0], [69, 1.0], [65, 1.0],
            [67, 1.0], [69, 1.0], [70, 1.0],
            [69, 2.0], [65, 1.0],
            [67, 1.0], [69, 0.5], [67, 0.5], [64, 1.0],
            [65, 1.0], [69, 1.0], [72, 1.0],
            [74, 1.5], [72, 0.5], [70, 1.0],
            [69, 1.0], [67, 1.0], [65, 1.0],
            [64, 2.0], [null, 1.0],
            [70, 1.0], [74, 1.0], [77, 1.0],
            [74, 1.0], [72, 1.0], [70, 1.0],
            [67, 1.0], [70, 1.0], [64, 1.0],
            [65, 2.0], [null, 1.0],
          ],
        },
        // Section B (12 bars): Luminous F-major expansion with dulcimer counter-line & walking bass
        {
          name: 'B: Luminous Chamber (F major)',
          bars: 12,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'dulcimer',
          dynamics: 1.02,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'cern',
          chords: chordSeq([
            [3, 'Fmaj7'], [3, 'Bb'], [3, 'C7'], [3, 'F'],
            [3, 'Dm7'], [3, 'Gm7'], [3, 'C7'], [3, 'Am7'],
            [3, 'Bbmaj7'], [3, 'Fmaj7'], [3, 'Gm7'], [3, 'C7'],
          ]),
          melody: [
            [72, 1.5], [74, 0.5], [77, 1.0],
            [74, 1.5], [72, 0.5], [70, 1.0],
            [72, 1.0], [70, 1.0], [67, 1.0],
            [69, 2.0], [65, 1.0],
            [72, 1.0], [74, 1.0], [77, 1.0],
            [79, 1.5], [77, 0.5], [74, 1.0],
            [76, 1.0], [72, 1.0], [70, 1.0],
            [72, 2.0], [69, 1.0],
            [74, 1.5], [77, 0.5], [81, 1.0],
            [77, 1.5], [76, 0.5], [72, 1.0],
            [74, 1.0], [70, 1.0], [67, 1.0],
            [72, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [69, 2.0], [65, 1.0],
            [70, 2.0], [65, 1.0],
            [67, 2.0], [70, 1.0],
            [65, 2.0], [null, 1.0],
            [65, 2.0], [69, 1.0],
            [70, 2.0], [67, 1.0],
            [70, 2.0], [67, 1.0],
            [67, 2.0], [64, 1.0],
            [70, 2.0], [74, 1.0],
            [69, 2.0], [72, 1.0],
            [67, 2.0], [70, 1.0],
            [67, 2.0], [null, 1.0],
          ],
        },
        // Section C (12 bars): Subdominant Bb-major soaring harmonic plateau
        {
          name: 'C: Magnet Ring Plateau',
          bars: 12,
          key: { name: 'Bb major', rootPc: 10, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'warmStrings',
          counterVoice: 'celesta',
          dynamics: 1.06,
          bassStyle: 'roots',
          arpStyle: 'cern',
          padMode: 'triad',
          percStyle: 'cern',
          chords: chordSeq([
            [3, 'Bb'], [3, 'Eb'], [3, 'F7'], [3, 'Bb'],
            [3, 'Gm7'], [3, 'Cm7'], [3, 'F7'], [3, 'Bb'],
            [3, 'Eb'], [3, 'Bb'], [3, 'Cm7'], [3, 'F7'],
          ]),
          melody: [
            [74, 1.5], [77, 0.5], [74, 1.0],
            [75, 1.5], [74, 0.5], [70, 1.0],
            [72, 1.0], [75, 1.0], [69, 1.0],
            [70, 2.0], [65, 1.0],
            [70, 1.5], [74, 0.5], [77, 1.0],
            [75, 1.5], [72, 0.5], [67, 1.0],
            [69, 1.0], [72, 1.0], [75, 1.0],
            [74, 2.0], [70, 1.0],
            [75, 1.5], [79, 0.5], [75, 1.0],
            [74, 1.5], [70, 0.5], [65, 1.0],
            [72, 1.0], [70, 1.0], [67, 1.0],
            [69, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [70, 2.0], [74, 1.0],
            [79, 2.0], [75, 1.0],
            [77, 2.0], [72, 1.0],
            [74, 2.0], [null, 1.0],
            [74, 2.0], [70, 1.0],
            [79, 2.0], [75, 1.0],
            [77, 2.0], [72, 1.0],
            [70, 2.0], [null, 1.0],
            [79, 2.0], [75, 1.0],
            [77, 2.0], [74, 1.0],
            [75, 2.0], [72, 1.0],
            [77, 2.0], [null, 1.0],
          ],
        },
        // Section D (8 bars): D-minor polyphonic development with alphorn tenor
        {
          name: 'D: Accelerator Development',
          bars: 8,
          key: { name: 'D minor', rootPc: 2, mode: 'naturalMinor' },
          chromaticPassing: [1], // C# on A7
          leadVoice: 'alphorn',
          counterVoice: 'flute',
          dynamics: 1.00,
          bassStyle: 'walking',
          arpStyle: 'cern',
          padMode: 'openFifth',
          percStyle: 'cern',
          chords: chordSeq([
            [3, 'Dm'], [3, 'Gm'], [3, 'A7'], [3, 'Dm'],
            [3, 'Bb'], [3, 'Gm'], [3, 'A7'], [3, 'Dm'],
          ]),
          melody: [
            [69, 1.5], [67, 0.5], [65, 1.0],
            [67, 1.5], [70, 0.5], [67, 1.0],
            [69, 1.5], [67, 0.5], [61, 1.0],
            [62, 2.0], [65, 1.0],
            [70, 1.5], [69, 0.5], [65, 1.0],
            [67, 1.5], [65, 0.5], [62, 1.0],
            [64, 1.5], [67, 0.5], [61, 1.0],
            [62, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [74, 2.0], [77, 1.0],
            [74, 2.0], [70, 1.0],
            [73, 2.0], [76, 1.0],
            [74, 2.0], [null, 1.0],
            [74, 2.0], [77, 1.0],
            [74, 2.0], [70, 1.0],
            [76, 2.0], [73, 1.0],
            [74, 2.0], [null, 1.0],
          ],
        },
        // Section E (8 bars): Vacuum Chamber Breakdown (pedal D, sparse celesta droplets & rests)
        {
          name: 'E: Cryogenic Vacuum Breakdown',
          bars: 8,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.62,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'sparse',
          chords: chordSeq([
            [3, 'Dm7'], [3, 'Dm7'], [3, 'Bbmaj7'], [3, 'Fmaj7'],
            [3, 'Gm7'], [3, 'Am7'], [3, 'C7'], [3, 'C7'],
          ]),
          melody: [
            [81, 2.0], [null, 1.0],
            [77, 1.5], [74, 0.5], [72, 1.0],
            [74, 2.0], [null, 1.0],
            [76, 2.0], [null, 1.0],
            [74, 1.5], [72, 0.5], [70, 1.0],
            [72, 1.5], [69, 0.5], [67, 1.0],
            [70, 2.0], [67, 1.0],
            [72, 2.0], [null, 1.0],
          ],
        },
        // Section A' (12 bars): Glowing Return of Huber theme with octave flute & dulcimer
        {
          name: 'A2: Colliding Beams Return',
          bars: 12,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'warmStrings',
          dynamics: 1.08,
          bassStyle: 'pulse',
          arpStyle: 'cern',
          padMode: 'triad',
          percStyle: 'cern',
          chords: chordSeq([
            [3, 'Dm7'], [3, 'Gm7'], [3, 'Fmaj7'], [3, 'C'],
            [3, 'Dm7'], [3, 'Bbmaj7'], [3, 'Fmaj7'], [3, 'Am7'],
            [3, 'Bbmaj7'], [3, 'Gm7'], [3, 'C7'], [3, 'Dm'],
          ]),
          melody: [
            [72, 1.0], [69, 1.0], [65, 1.0],
            [67, 1.0], [69, 1.0], [70, 1.0],
            [69, 2.0], [65, 1.0],
            [67, 1.0], [69, 0.5], [67, 0.5], [64, 1.0],
            [65, 1.0], [69, 1.0], [72, 1.0],
            [74, 1.5], [72, 0.5], [70, 1.0],
            [69, 1.0], [67, 1.0], [65, 1.0],
            [64, 2.0], [null, 1.0],
            [70, 1.0], [74, 1.0], [77, 1.0],
            [74, 1.0], [72, 1.0], [70, 1.0],
            [67, 1.0], [70, 1.0], [64, 1.0],
            [65, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [77, 2.0], [74, 1.0],
            [74, 2.0], [70, 1.0],
            [76, 2.0], [72, 1.0],
            [72, 2.0], [67, 1.0],
            [77, 2.0], [74, 1.0],
            [77, 2.0], [74, 1.0],
            [76, 2.0], [72, 1.0],
            [72, 2.0], [null, 1.0],
            [77, 2.0], [81, 1.0],
            [79, 2.0], [74, 1.0],
            [76, 2.0], [70, 1.0],
            [74, 2.0], [null, 1.0],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 6 (Level 7 - Bundeshaus Archive, Bern): "Schweizerpsalm"
    // Source: Alberich Zwyssig (1808-1854), Schweizerpsalm / "Trittst im
    //         Morgenrot daher" (1841). Public domain.
    // Mood: Stately, solemn parliamentary archive chorale in Bb major, 4/4 time.
    //       4-bar intro + 40-bar loop (160 beats @ 84 BPM = 114.3s).
    // =========================================================================
    level6: {
      source: 'Alberich Zwyssig (1808-1854), Schweizerpsalm / Trittst im Morgenrot daher (1841) (Public Domain)',
      bpm: 84,
      beatsPerBar: 4,
      bars: 44,
      loop: true,
      wet: 0.34,
      leadVoice: 'alphorn',
      leadGain: 0.23,
      counterGain: 0.135,
      bassGain: 0.145,
      arpGain: 0.052,
      padGain: 0.06,
      key: { name: 'Bb major', rootPc: 10, mode: 'major' },
      sections: [
        // Intro (4 bars): Solemn Bernese archive chimes & warm Bb pedal
        {
          name: 'Intro: Archive Hall',
          isIntro: true,
          bars: 4,
          key: { name: 'Bb major', rootPc: 10, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'dulcimer',
          dynamics: 0.78,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([[4, 'Bb'], [4, 'Eb'], [4, 'F7'], [4, 'Bb']]),
          melody: [
            [65, 1.0], [70, 1.0], [74, 2.0],
            [75, 2.0], [70, 2.0],
            [72, 1.5], [70, 0.5], [69, 2.0],
            [70, 3.0], [null, 1.0],
          ],
        },
        // Section A (8 bars): Stanza I ("Trittst im Morgenrot daher") in Bb major
        {
          name: 'A: Chorale Stanza I',
          bars: 8,
          key: { name: 'Bb major', rootPc: 10, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.94,
          bassStyle: 'roots',
          arpStyle: 'waltz',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [2, 'Bb'], [2, 'F7'], [2, 'Bb'], [2, 'Eb'],
            [2, 'Bb'], [2, 'F7'], [4, 'Bb'],
            [2, 'Eb'], [2, 'Bb'], [2, 'Cm'], [2, 'F7'],
            [2, 'Gm'], [2, 'F7'], [4, 'Bb'],
          ]),
          melody: [
            [70, 1.5], [70, 0.5], [69, 1.0], [70, 1.0],
            [74, 1.0], [70, 1.0], [75, 1.5], [70, 0.5],
            [74, 1.0], [70, 1.0], [72, 1.0], [69, 1.0],
            [70, 3.0], [null, 1.0],
            [75, 1.5], [75, 0.5], [74, 1.0], [70, 1.0],
            [72, 1.0], [75, 1.0], [72, 1.5], [69, 0.5],
            [70, 1.0], [74, 1.0], [72, 1.0], [69, 1.0],
            [70, 2.5], [null, 1.5],
          ],
        },
        // Section B (8 bars): Stanza II ("Wenn der Alpenfirn sich roetet") with flute counter-melody
        {
          name: 'B: Alpenfirn Counterpoint',
          bars: 8,
          key: { name: 'Bb major', rootPc: 10, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'warmStrings',
          counterVoice: 'flute',
          dynamics: 1.02,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [4, 'Bb'], [2, 'Eb'], [2, 'F7'], [2, 'Gm'], [2, 'Cm'], [4, 'F7'],
            [2, 'Bb'], [2, 'Eb'], [2, 'F7'], [2, 'Gm'], [2, 'Cm'], [2, 'F7'], [4, 'Bb'],
          ]),
          melody: [
            [74, 1.5], [74, 0.5], [77, 1.0], [74, 1.0],
            [75, 1.0], [70, 1.0], [72, 1.5], [69, 0.5],
            [70, 1.0], [74, 1.0], [75, 1.0], [72, 1.0],
            [72, 2.0], [69, 1.5], [null, 0.5],
            [74, 1.0], [77, 1.0], [79, 1.0], [75, 1.0],
            [77, 1.0], [72, 1.0], [74, 1.5], [70, 0.5],
            [72, 1.0], [75, 1.0], [72, 1.0], [69, 1.0],
            [70, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [70, 2.0], [74, 2.0],
            [79, 2.0], [77, 2.0],
            [74, 2.0], [79, 2.0],
            [77, 2.0], [75, 1.5], [null, 0.5],
            [77, 2.0], [75, 2.0],
            [75, 2.0], [79, 2.0],
            [79, 2.0], [77, 2.0],
            [74, 2.5], [null, 1.5],
          ],
        },
        // Section C (8 bars): Vaults of State — G minor contrapuntal reflection (dulcimer + flute)
        {
          name: 'C: Secret Archive (G minor)',
          bars: 8,
          key: { name: 'G minor', rootPc: 7, mode: 'naturalMinor' },
          chromaticPassing: [6], // F# on D7
          leadVoice: 'dulcimer',
          counterVoice: 'flute',
          dynamics: 0.94,
          bassStyle: 'walking',
          arpStyle: 'stealth',
          padMode: 'openFifth',
          percStyle: 'vault',
          chords: chordSeq([
            [4, 'Gm'], [2, 'Cm'], [2, 'D7'], [2, 'Gm'], [2, 'Eb'], [4, 'D7'],
            [2, 'Cm'], [2, 'Gm'], [2, 'Eb'], [2, 'D7'], [2, 'Cm'], [2, 'D7'], [4, 'Gm'],
          ]),
          melody: [
            [67, 1.0], [70, 1.0], [74, 1.5], [70, 0.5],
            [72, 1.0], [75, 1.0], [74, 1.0], [66, 1.0],
            [67, 1.0], [70, 1.0], [70, 1.0], [67, 1.0],
            [69, 2.0], [66, 1.5], [null, 0.5],
            [72, 1.0], [75, 1.0], [74, 1.0], [70, 1.0],
            [70, 1.0], [67, 1.0], [66, 1.0], [69, 1.0],
            [72, 1.0], [67, 1.0], [69, 1.0], [66, 1.0],
            [67, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [74, 2.0], [79, 2.0],
            [75, 2.0], [78, 2.0],
            [79, 2.0], [75, 2.0],
            [74, 2.0], [72, 1.5], [null, 0.5],
            [75, 2.0], [79, 2.0],
            [79, 2.0], [78, 2.0],
            [75, 2.0], [74, 2.0],
            [70, 2.5], [null, 1.5],
          ],
        },
        // Section D (8 bars): Reverent Cathedral Breakdown (pedal F/Bb + sparse celesta & rests)
        {
          name: 'D: Rotunda Silence Breakdown',
          bars: 8,
          key: { name: 'Bb major', rootPc: 10, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.62,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'none',
          chords: chordSeq([
            [4, 'Bb'], [4, 'Gm'], [4, 'Eb'], [4, 'Bb'],
            [4, 'Cm7'], [4, 'Eb'], [4, 'F7'], [4, 'F7'],
          ]),
          melody: [
            [82, 2.0], [null, 2.0],
            [79, 1.5], [77, 0.5], [74, 1.5], [null, 0.5],
            [75, 2.0], [null, 2.0],
            [74, 2.0], [null, 2.0],
            [75, 1.5], [74, 0.5], [72, 1.5], [null, 0.5],
            [79, 2.0], [null, 2.0],
            [77, 1.5], [75, 0.5], [72, 2.0],
            [69, 2.0], [null, 2.0],
          ],
        },
        // Section A' (8 bars): Grand Ceremonial Recapitulation in Bb major (softBrass + flute harmony)
        {
          name: 'A2: Ceremonial Finale',
          bars: 8,
          key: { name: 'Bb major', rootPc: 10, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.10,
          bassStyle: 'roots',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'fanfare',
          chords: chordSeq([
            [2, 'Bb'], [2, 'F7'], [2, 'Bb'], [2, 'Eb'],
            [2, 'Bb'], [2, 'F7'], [4, 'Bb'],
            [2, 'Eb'], [2, 'Cm'], [2, 'Bb'], [2, 'Gm'],
            [2, 'Eb'], [2, 'F7'], [4, 'Bb'],
          ]),
          melody: [
            [70, 1.5], [70, 0.5], [69, 1.0], [70, 1.0],
            [74, 1.0], [70, 1.0], [75, 1.5], [70, 0.5],
            [74, 1.0], [70, 1.0], [72, 1.0], [69, 1.0],
            [70, 2.5], [null, 1.5],
            [75, 1.0], [79, 1.0], [75, 1.0], [72, 1.0],
            [74, 1.0], [77, 1.0], [74, 1.0], [70, 1.0],
            [75, 1.0], [79, 1.0], [77, 1.0], [72, 1.0],
            [70, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [74, 2.0], [77, 2.0],
            [77, 2.0], [79, 2.0],
            [77, 2.0], [75, 2.0],
            [74, 2.5], [null, 1.5],
            [79, 2.0], [79, 2.0],
            [77, 2.0], [79, 2.0],
            [79, 2.0], [75, 2.0],
            [74, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 7 (Level 8 - Eigerwand Gallery, North Face): "Vallee d'Obermann"
    // Source: Franz Liszt (1811-1886), Annees de pelerinage: Premiere annee -
    //         Suisse (S. 160, 1848-1854), No. 6: Vallee d'Obermann. Public domain.
    // Mood: Brooding, austere alpine cliffside drama in E minor, contrasting with
    //       Liszt's luminous C-major thematic transformation. 4/4 time.
    //       4-bar intro + 40-bar loop (160 beats @ 84 BPM = 114.3s).
    // =========================================================================
    level7: {
      source: 'Franz Liszt (1811-1886), Annees de pelerinage: Suisse (S. 160, 1848-1854) - No. 6: Vallee d\'Obermann (Public Domain)',
      bpm: 84,
      beatsPerBar: 4,
      bars: 44,
      loop: true,
      wet: 0.36,
      leadVoice: 'alphorn',
      leadGain: 0.23,
      counterGain: 0.135,
      bassGain: 0.15,
      arpGain: 0.056,
      padGain: 0.058,
      key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
      sections: [
        // Intro (4 bars): Desolate North-Face abyss — deep pedal E & stark sighing motif
        {
          name: 'Intro: North Face Abyss',
          isIntro: true,
          bars: 4,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'alphorn',
          dynamics: 0.76,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'sparse',
          chords: chordSeq([[4, 'Em'], [4, 'Em'], [4, 'Am'], [4, 'B7']]),
          melody: [
            [64, 2.0], [null, 2.0],
            [67, 1.5], [66, 0.5], [64, 2.0],
            [69, 2.0], [64, 2.0],
            [66, 2.0], [63, 1.5], [null, 0.5],
          ],
        },
        // Section A (8 bars): Lento assai — brooding descending Obermann lament in E minor
        {
          name: 'A: Lento Lament (E minor)',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3, 10], // D# (B7) and Bb chromatic sigh passing tone
          leadVoice: 'alphorn',
          dynamics: 0.94,
          bassStyle: 'roots',
          arpStyle: 'tremolo',
          padMode: 'openFifth',
          percStyle: 'sparse',
          chords: chordSeq([
            [4, 'Em'], [2, 'Am'], [2, 'Em'], [2, 'C'], [2, 'Am'], [4, 'B7'],
            [4, 'Em'], [2, 'Am'], [2, 'D'], [2, 'G'], [2, 'B7'], [4, 'Em'],
          ]),
          melody: [
            [71, 1.5], [70, 0.5], [71, 1.0], [67, 1.0],
            [69, 1.5], [66, 0.5], [67, 1.5], [64, 0.5],
            [67, 1.0], [64, 1.0], [69, 1.5], [64, 0.5],
            [66, 2.0], [63, 1.5], [null, 0.5],
            [71, 1.5], [69, 0.5], [67, 1.0], [64, 1.0],
            [69, 1.0], [72, 1.0], [74, 1.0], [69, 1.0],
            [71, 1.0], [67, 1.0], [66, 1.0], [63, 1.0],
            [64, 2.5], [null, 1.5],
          ],
        },
        // Section B (8 bars): Piu mosso e agitato — turbulent ascent on Eiger cliffside
        {
          name: 'B: Agitato Ascent',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'softBrass',
          counterVoice: 'warmStrings',
          dynamics: 1.08,
          bassStyle: 'pulse',
          arpStyle: 'storm',
          padMode: 'openFifth',
          percStyle: 'summit',
          chords: chordSeq([
            [2, 'Em'], [2, 'Am'], [2, 'B7'], [2, 'Em'],
            [2, 'C'], [2, 'D'], [2, 'Em'], [2, 'B7'],
            [2, 'Am'], [2, 'Em'], [2, 'C'], [2, 'B7'],
            [2, 'Em'], [2, 'Am'], [4, 'B7'],
          ]),
          melody: [
            [64, 0.5], [67, 0.5], [71, 1.0], [72, 1.0], [69, 1.0],
            [71, 0.5], [69, 0.5], [66, 1.0], [67, 1.0], [71, 1.0],
            [72, 1.0], [76, 1.0], [74, 1.0], [78, 1.0],
            [79, 1.5], [76, 0.5], [75, 2.0],
            [76, 1.0], [72, 1.0], [76, 1.0], [71, 1.0],
            [72, 1.0], [67, 1.0], [66, 1.0], [71, 1.0],
            [76, 1.0], [71, 1.0], [72, 1.0], [69, 1.0],
            [71, 2.0], [75, 1.5], [null, 0.5],
          ],
          counterMelody: [
            [71, 2.0], [76, 2.0],
            [75, 2.0], [76, 2.0],
            [76, 2.0], [78, 2.0],
            [76, 2.0], [71, 2.0],
            [72, 2.0], [71, 2.0],
            [76, 2.0], [75, 2.0],
            [71, 2.0], [76, 2.0],
            [75, 2.0], [71, 1.5], [null, 0.5],
          ],
        },
        // Section C (8 bars): Luminous Thematic Transformation in C major (sunlight breaking through clouds)
        {
          name: 'C: Sunlit Peak Transformation (C major)',
          bars: 8,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'warmStrings',
          dynamics: 1.00,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'none',
          chords: chordSeq([
            [4, 'C'], [2, 'F'], [2, 'C'], [2, 'Am'], [2, 'Dm'], [4, 'G7'],
            [2, 'C'], [2, 'Em'], [2, 'F'], [2, 'G'], [2, 'Am'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [72, 1.5], [74, 0.5], [76, 1.0], [79, 1.0],
            [81, 1.0], [77, 1.0], [76, 2.0],
            [76, 1.0], [72, 1.0], [74, 1.0], [69, 1.0],
            [71, 2.5], [null, 1.5],
            [72, 1.0], [76, 1.0], [79, 1.0], [76, 1.0],
            [77, 1.0], [81, 1.0], [79, 1.0], [74, 1.0],
            [76, 1.0], [72, 1.0], [74, 1.0], [71, 1.0],
            [72, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [67, 2.0], [72, 2.0],
            [72, 2.0], [72, 2.0],
            [72, 2.0], [69, 2.0],
            [67, 2.5], [null, 1.5],
            [67, 2.0], [71, 2.0],
            [72, 2.0], [74, 2.0],
            [72, 2.0], [74, 2.0],
            [76, 2.5], [null, 1.5],
          ],
        },
        // Section D (8 bars): Icy Ledge Recitative Breakdown (pedal E, wind brush, lone flute & rests)
        {
          name: 'D: Recitativo Ledge Breakdown',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'flute',
          dynamics: 0.62,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'ice',
          chords: chordSeq([
            [4, 'Em'], [4, 'Em'], [4, 'C'], [4, 'Am'],
            [4, 'Em'], [4, 'Am'], [4, 'B7'], [4, 'B7'],
          ]),
          melody: [
            [76, 2.0], [null, 2.0],
            [71, 1.5], [69, 0.5], [67, 1.5], [null, 0.5],
            [72, 2.0], [null, 2.0],
            [72, 1.5], [71, 0.5], [69, 2.0],
            [67, 2.0], [null, 2.0],
            [69, 1.5], [67, 0.5], [64, 1.5], [null, 0.5],
            [66, 2.0], [63, 2.0],
            [71, 2.0], [null, 2.0],
          ],
        },
        // Section A' (8 bars): Solemn Shadowed Return in E minor with alphorn & strings harmony
        {
          name: 'A2: Shadowed Eiger Return',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3, 10],
          leadVoice: 'alphorn',
          counterVoice: 'warmStrings',
          dynamics: 1.06,
          bassStyle: 'roots',
          arpStyle: 'tremolo',
          padMode: 'triad',
          percStyle: 'summit',
          chords: chordSeq([
            [4, 'Em'], [2, 'Am'], [2, 'Em'], [2, 'C'], [2, 'Am'], [4, 'B7'],
            [4, 'Em'], [2, 'Am'], [2, 'B7'], [2, 'C'], [2, 'B7'], [4, 'Em'],
          ]),
          melody: [
            [71, 1.5], [70, 0.5], [71, 1.0], [67, 1.0],
            [69, 1.5], [66, 0.5], [67, 1.5], [64, 0.5],
            [67, 1.0], [64, 1.0], [69, 1.5], [64, 0.5],
            [66, 2.0], [63, 1.5], [null, 0.5],
            [71, 1.5], [69, 0.5], [67, 1.0], [64, 1.0],
            [69, 1.0], [72, 1.0], [71, 1.0], [66, 1.0],
            [67, 1.0], [64, 1.0], [66, 1.0], [63, 1.0],
            [64, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [76, 2.0], [79, 2.0],
            [76, 2.0], [76, 2.0],
            [76, 2.0], [72, 2.0],
            [75, 2.0], [71, 1.5], [null, 0.5],
            [76, 2.0], [79, 2.0],
            [76, 2.0], [75, 2.0],
            [76, 2.0], [75, 2.0],
            [76, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 8 (Level 9 - Jungfrau Ice Palace): "Vo Luzern uf Waeggis zue"
    // Source: Johann Luethi (1800-1869), 1832. Traditional Swiss folk song.
    //         Public domain.
    // Mood: Glassy, crystalline high-register music-box / celesta lullaby in
    //       C major, 4/4 time. 4-bar intro + 40-bar loop (160 beats @ 82 BPM = 117.1s).
    // =========================================================================
    level8: {
      source: 'Johann Luethi (1800-1869), Vo Luzern uf Waeggis zue (1832) (Public Domain)',
      bpm: 82,
      beatsPerBar: 4,
      bars: 44,
      loop: true,
      wet: 0.38,
      leadVoice: 'dulcimer',
      leadGain: 0.22,
      counterGain: 0.13,
      bassGain: 0.12,
      arpGain: 0.055,
      padGain: 0.058,
      key: { name: 'C major', rootPc: 0, mode: 'major' },
      sections: [
        // Intro (4 bars): Crystalline glacier ice-chimes in high register
        {
          name: 'Intro: Glacier Chimes',
          isIntro: true,
          bars: 4,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'celesta',
          dynamics: 0.78,
          bassStyle: 'pedal',
          arpStyle: 'shimmer',
          padMode: 'lowDrone',
          percStyle: 'ice',
          chords: chordSeq([[4, 'C'], [4, 'C'], [4, 'G7'], [4, 'C']]),
          melody: [
            [79, 2.0], [76, 2.0],
            [72, 2.0], [76, 2.0],
            [74, 2.0], [71, 2.0],
            [72, 3.0], [null, 1.0],
          ],
        },
        // Section A (8 bars): Classic Verse & Yodel Refrain in C major (glassy dulcimer)
        {
          name: 'A: Ice Music Box (Verse & Refrain)',
          bars: 8,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'dulcimer',
          dynamics: 0.94,
          bassStyle: 'gentle',
          arpStyle: 'lullaby',
          padMode: 'openFifth',
          percStyle: 'ice',
          chords: chordSeq([
            [4, 'C'], [2, 'F'], [2, 'G7'], [2, 'G7'], [2, 'C'], [4, 'C'],
            [2, 'C'], [2, 'G7'], [2, 'F'], [2, 'G7'], [2, 'C'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [79, 1.0], [79, 1.0], [76, 1.0], [72, 1.0],
            [77, 1.0], [77, 1.0], [74, 2.0],
            [79, 1.0], [77, 1.0], [76, 1.0], [74, 1.0],
            [76, 1.0], [72, 1.0], [72, 1.5], [null, 0.5],
            [79, 1.5], [79, 0.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 0.5],
            [77, 1.5], [77, 0.5], [77, 0.5], [76, 0.5], [74, 0.5], [72, 0.5],
            [79, 1.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 1.0],
            [72, 2.5], [null, 1.5],
          ],
        },
        // Section B (8 bars): Flute & Celesta Yodel Dialogue in C major
        {
          name: 'B: Holdiridia Echoes',
          bars: 8,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'celesta',
          dynamics: 1.00,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'ice',
          chords: chordSeq([
            [2, 'C'], [2, 'Am'], [2, 'Dm'], [2, 'G7'],
            [2, 'Em'], [2, 'Am'], [2, 'Dm'], [2, 'G7'],
            [2, 'C'], [2, 'F'], [2, 'G7'], [2, 'Em'],
            [2, 'F'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [76, 1.0], [79, 1.0], [81, 1.0], [76, 1.0],
            [77, 1.5], [74, 0.5], [74, 1.0], [71, 1.0],
            [76, 1.0], [79, 1.0], [76, 1.0], [72, 1.0],
            [74, 1.0], [77, 1.0], [74, 1.5], [null, 0.5],
            [79, 1.0], [76, 1.0], [77, 1.0], [81, 1.0],
            [79, 1.0], [74, 1.0], [76, 1.0], [71, 1.0],
            [72, 1.0], [77, 1.0], [74, 1.0], [79, 1.0],
            [76, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [72, 2.0], [72, 2.0],
            [74, 2.0], [79, 2.0],
            [71, 2.0], [72, 2.0],
            [69, 2.0], [71, 1.5], [null, 0.5],
            [76, 2.0], [72, 2.0],
            [71, 2.0], [76, 2.0],
            [77, 2.0], [74, 2.0],
            [72, 2.5], [null, 1.5],
          ],
        },
        // Section C (8 bars): Subdominant F-major Glacier Waltz Variation (warmStrings + dulcimer)
        {
          name: 'C: Blue Glacier Hall (F major)',
          bars: 8,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'warmStrings',
          counterVoice: 'dulcimer',
          dynamics: 1.02,
          bassStyle: 'walking',
          arpStyle: 'lullaby',
          padMode: 'triad',
          percStyle: 'ice',
          chords: chordSeq([
            [4, 'F'], [2, 'Bb'], [2, 'C7'], [2, 'F'], [2, 'Dm'], [4, 'C7'],
            [2, 'Bb'], [2, 'F'], [2, 'Gm'], [2, 'C7'], [2, 'Bb'], [2, 'C7'], [4, 'F'],
          ]),
          melody: [
            [77, 1.5], [76, 0.5], [72, 1.0], [69, 1.0],
            [70, 1.0], [74, 1.0], [72, 1.5], [70, 0.5],
            [69, 1.0], [72, 1.0], [74, 1.0], [69, 1.0],
            [72, 2.0], [67, 1.5], [null, 0.5],
            [74, 1.0], [77, 1.0], [77, 1.0], [72, 1.0],
            [74, 1.0], [70, 1.0], [72, 1.5], [67, 0.5],
            [70, 1.0], [74, 1.0], [72, 1.0], [76, 1.0],
            [77, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [72, 2.0], [77, 2.0],
            [74, 2.0], [76, 2.0],
            [77, 2.0], [77, 2.0],
            [76, 2.0], [72, 1.5], [null, 0.5],
            [70, 2.0], [72, 2.0],
            [70, 2.0], [76, 2.0],
            [74, 2.0], [70, 2.0],
            [72, 2.5], [null, 1.5],
          ],
        },
        // Section D (8 bars): Frosted Crevasse Breakdown in A minor (pedal A, sparse celesta & rests)
        {
          name: 'D: Frozen Cavern Breakdown (A minor)',
          bars: 8,
          key: { name: 'A minor', rootPc: 9, mode: 'naturalMinor' },
          chromaticPassing: [8], // G# on E7
          leadVoice: 'celesta',
          dynamics: 0.62,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'ice',
          chords: chordSeq([
            [4, 'Am'], [4, 'Am'], [4, 'Dm'], [4, 'Am'],
            [4, 'F'], [4, 'Dm'], [4, 'E7'], [4, 'G7'],
          ]),
          melody: [
            [81, 2.0], [null, 2.0],
            [76, 1.5], [74, 0.5], [72, 1.5], [null, 0.5],
            [77, 2.0], [null, 2.0],
            [76, 2.0], [null, 2.0],
            [77, 1.5], [76, 0.5], [72, 1.5], [null, 0.5],
            [74, 2.0], [null, 2.0],
            [76, 1.5], [74, 0.5], [71, 2.0],
            [74, 2.0], [null, 2.0],
          ],
        },
        // Section A' (8 bars): Crystalline Return in C major with dulcimer + high flute harmony
        {
          name: 'A2: Crystalline Summit Lullaby',
          bars: 8,
          key: { name: 'C major', rootPc: 0, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'dulcimer',
          counterVoice: 'flute',
          dynamics: 1.06,
          bassStyle: 'gentle',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'ice',
          chords: chordSeq([
            [4, 'C'], [2, 'F'], [2, 'G7'], [2, 'G7'], [2, 'C'], [4, 'C'],
            [2, 'C'], [2, 'G7'], [2, 'F'], [2, 'G7'], [2, 'C'], [2, 'G7'], [4, 'C'],
          ]),
          melody: [
            [79, 1.0], [79, 1.0], [76, 1.0], [72, 1.0],
            [77, 1.0], [77, 1.0], [74, 2.0],
            [79, 1.0], [77, 1.0], [76, 1.0], [74, 1.0],
            [76, 1.0], [72, 1.0], [72, 1.5], [null, 0.5],
            [79, 1.5], [79, 0.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 0.5],
            [77, 1.5], [77, 0.5], [77, 0.5], [76, 0.5], [74, 0.5], [72, 0.5],
            [79, 1.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 1.0],
            [72, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [76, 2.0], [79, 2.0],
            [81, 2.0], [79, 2.0],
            [74, 2.0], [79, 2.0],
            [79, 2.0], [76, 1.5], [null, 0.5],
            [76, 2.0], [74, 2.0],
            [72, 2.0], [71, 2.0],
            [76, 2.0], [71, 2.0],
            [76, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // LEVEL 9 (Level 10 - Sphinx Observatory Finale): William Tell Storm & Finale
    // Source: Gioachino Rossini (1792-1868), William Tell Overture (1829) -
    //         Part II: Storm (Orage) & Part IV: Finale (March of the Swiss Soldiers).
    //         Public domain.
    // Mood: Dramatic nocturnal summit tempest in E minor surging into the
    //       heroic E-major March of the Swiss Soldiers, then cycling seamlessly.
    //       4-bar intro + 56-bar loop (224 beats @ 118 BPM = 113.9s).
    // =========================================================================
    level9: {
      source: 'Gioachino Rossini (1792-1868), William Tell Overture (1829) - Part II: Storm (Orage) & Part IV: Finale (March of the Swiss Soldiers) (Public Domain)',
      bpm: 118,
      beatsPerBar: 4,
      bars: 60,
      loop: true,
      wet: 0.32,
      leadVoice: 'alphorn',
      leadGain: 0.24,
      counterGain: 0.14,
      bassGain: 0.15,
      arpGain: 0.06,
      padGain: 0.055,
      key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
      sections: [
        // Intro (4 bars): Summit lightning rumble & low horn fifths
        {
          name: 'Intro: Summit Tempest Gather',
          isIntro: true,
          bars: 4,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'alphorn',
          dynamics: 0.84,
          bassStyle: 'pedal',
          arpStyle: 'tremolo',
          padMode: 'lowDrone',
          percStyle: 'summit',
          chords: chordSeq([[4, 'Em'], [4, 'Em'], [2, 'Am'], [2, 'B7'], [4, 'Em']]),
          melody: [
            [64, 2.0], [71, 2.0],
            [76, 2.0], [71, 2.0],
            [72, 2.0], [71, 1.5], [66, 0.5],
            [64, 2.5], [null, 1.5],
          ],
        },
        // Section A (8 bars): Part II Storm (Orage) Theme I in E minor
        {
          name: 'A: Orage (Storm Theme I)',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'alphorn',
          dynamics: 0.98,
          bassStyle: 'pulse',
          arpStyle: 'storm',
          padMode: 'openFifth',
          percStyle: 'summit',
          chords: chordSeq([
            [4, 'Em'], [2, 'Am'], [2, 'B7'], [4, 'Em'], [2, 'Am'], [2, 'B7'],
            [2, 'C'], [2, 'D'], [2, 'Em'], [2, 'C'], [2, 'Am'], [2, 'B7'], [2, 'Em'], [2, 'B7'],
          ]),
          melody: [
            [64, 0.5], [67, 0.5], [71, 1.0], [76, 1.0], [71, 0.5], [67, 0.5],
            [72, 1.0], [69, 1.0], [71, 1.0], [66, 1.0],
            [64, 0.5], [67, 0.5], [71, 1.0], [79, 1.0], [76, 1.0],
            [76, 1.0], [72, 1.0], [75, 1.5], [null, 0.5],
            [72, 0.5], [76, 0.5], [79, 1.0], [78, 1.0], [74, 1.0],
            [76, 1.0], [71, 1.0], [72, 1.0], [67, 1.0],
            [69, 0.5], [72, 0.5], [76, 1.0], [75, 1.0], [71, 1.0],
            [76, 2.0], [71, 1.0], [null, 1.0],
          ],
        },
        // Section B (8 bars): Storm Theme II — surging alpine thunder with flute counter-line
        {
          name: 'B: Alpine Gale (Storm Theme II)',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.06,
          bassStyle: 'walking',
          arpStyle: 'storm',
          padMode: 'triad',
          percStyle: 'summit',
          chords: chordSeq([
            [2, 'Em'], [2, 'G'], [2, 'C'], [2, 'B7'],
            [2, 'Em'], [2, 'D'], [2, 'C'], [2, 'B7'],
            [2, 'Am'], [2, 'D'], [2, 'G'], [2, 'Em'],
            [2, 'Am'], [2, 'B7'], [4, 'B7'],
          ]),
          melody: [
            [76, 1.0], [71, 1.0], [74, 1.0], [79, 1.0],
            [76, 1.0], [72, 1.0], [75, 1.5], [71, 0.5],
            [76, 0.5], [74, 0.5], [71, 1.0], [74, 1.0], [69, 1.0],
            [72, 1.0], [67, 1.0], [66, 1.5], [71, 0.5],
            [72, 1.0], [76, 1.0], [78, 1.0], [74, 1.0],
            [79, 1.0], [74, 1.0], [76, 1.0], [71, 1.0],
            [72, 1.0], [69, 1.0], [71, 1.0], [75, 1.0],
            [78, 2.0], [71, 1.5], [null, 0.5],
          ],
          counterMelody: [
            [71, 2.0], [71, 2.0],
            [79, 2.0], [78, 2.0],
            [79, 2.0], [78, 2.0],
            [76, 2.0], [75, 2.0],
            [76, 2.0], [74, 2.0],
            [74, 2.0], [79, 2.0],
            [76, 2.0], [75, 2.0],
            [75, 2.0], [78, 1.5], [null, 0.5],
          ],
        },
        // Section C (12 bars): Part IV Finale — March of the Swiss Soldiers in parallel E major!
        {
          name: 'C: Finale - March of the Swiss Soldiers (E major)',
          bars: 12,
          key: { name: 'E major', rootPc: 4, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.14,
          bassStyle: 'galop',
          arpStyle: 'galop',
          padMode: 'triad',
          percStyle: 'galop',
          chords: chordSeq([
            [4, 'E'], [2, 'E'], [2, 'B7'], [4, 'E'], [2, 'A'], [2, 'B7'],
            [4, 'E'], [2, 'C#m'], [2, 'B7'], [2, 'A'], [2, 'B7'], [4, 'E'],
            [2, 'E'], [2, 'A'], [2, 'B7'], [2, 'C#m'], [2, 'A'], [2, 'B7'], [4, 'E'],
          ]),
          melody: [
            [71, 0.5], [71, 0.5], [76, 1.0], [76, 0.5], [78, 0.5], [80, 1.0],
            [80, 0.5], [78, 0.5], [76, 1.0], [75, 1.0], [71, 1.0],
            [71, 0.5], [71, 0.5], [76, 1.0], [80, 1.0], [83, 1.0],
            [81, 1.0], [76, 1.0], [75, 1.5], [null, 0.5],
            [76, 0.5], [76, 0.5], [80, 1.0], [83, 1.0], [80, 1.0],
            [76, 1.0], [73, 1.0], [75, 1.0], [71, 1.0],
            [73, 0.5], [76, 0.5], [81, 1.0], [78, 1.0], [75, 1.0],
            [76, 2.5], [null, 1.5],
            [80, 1.0], [76, 1.0], [81, 1.0], [76, 1.0],
            [78, 1.0], [75, 1.0], [76, 1.0], [73, 1.0],
            [76, 1.0], [81, 1.0], [78, 1.0], [75, 1.0],
            [76, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [76, 2.0], [80, 2.0],
            [76, 2.0], [78, 2.0],
            [76, 2.0], [76, 2.0],
            [76, 2.0], [78, 1.5], [null, 0.5],
            [80, 2.0], [76, 2.0],
            [80, 2.0], [78, 2.0],
            [76, 2.0], [75, 2.0],
            [80, 2.5], [null, 1.5],
            [76, 2.0], [73, 2.0],
            [75, 2.0], [76, 2.0],
            [73, 2.0], [78, 2.0],
            [80, 2.5], [null, 1.5],
          ],
        },
        // Section D (10 bars): Finale Second Strain & Heroic Summit Fanfare (E major / C# minor)
        {
          name: 'D: Summit Fanfare & Development',
          bars: 10,
          key: { name: 'E major', rootPc: 4, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'flute',
          counterVoice: 'softBrass',
          dynamics: 1.12,
          bassStyle: 'walking',
          arpStyle: 'shimmer',
          padMode: 'triad',
          percStyle: 'march',
          chords: chordSeq([
            [4, 'C#m'], [2, 'A'], [2, 'B7'], [2, 'E'], [2, 'C#m'], [4, 'B7'],
            [2, 'A'], [2, 'E'], [2, 'F#m'], [2, 'B7'],
            [2, 'E'], [2, 'A'], [2, 'B7'], [2, 'E'], [2, 'F#m'], [2, 'B7'], [4, 'B7'],
          ]),
          melody: [
            [80, 1.0], [76, 1.0], [73, 1.0], [76, 1.0],
            [81, 1.0], [76, 1.0], [78, 1.5], [75, 0.5],
            [76, 1.0], [80, 1.0], [80, 1.0], [76, 1.0],
            [78, 2.0], [75, 1.5], [null, 0.5],
            [81, 1.0], [76, 1.0], [80, 1.0], [76, 1.0],
            [78, 1.0], [73, 1.0], [75, 1.0], [78, 1.0],
            [80, 1.0], [83, 1.0], [81, 1.0], [76, 1.0],
            [78, 1.0], [75, 1.0], [76, 2.0],
            [78, 1.0], [73, 1.0], [75, 1.0], [78, 1.0],
            [83, 2.0], [78, 1.0], [null, 1.0],
          ],
          counterMelody: [
            [73, 2.0], [76, 2.0],
            [73, 2.0], [75, 2.0],
            [71, 2.0], [73, 2.0],
            [75, 2.0], [71, 1.5], [null, 0.5],
            [73, 2.0], [71, 2.0],
            [73, 2.0], [71, 2.0],
            [76, 2.0], [73, 2.0],
            [75, 2.0], [76, 2.0],
            [73, 2.0], [71, 2.0],
            [75, 2.0], [71, 1.0], [null, 1.0],
          ],
        },
        // Section E (8 bars): Eye of the Storm Breakdown (high-altitude hush in E minor)
        {
          name: 'E: Eye of the Storm Breakdown',
          bars: 8,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'alphorn',
          dynamics: 0.64,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'sparse',
          chords: chordSeq([
            [4, 'Em'], [4, 'Em'], [4, 'C'], [4, 'Am'],
            [4, 'Em'], [4, 'C'], [4, 'B7'], [4, 'B7'],
          ]),
          melody: [
            [71, 2.0], [null, 2.0],
            [76, 1.5], [74, 0.5], [71, 1.5], [null, 0.5],
            [72, 2.0], [null, 2.0],
            [69, 2.0], [null, 2.0],
            [67, 1.5], [66, 0.5], [64, 2.0],
            [72, 2.0], [67, 2.0],
            [71, 2.0], [66, 2.0],
            [75, 2.0], [null, 2.0],
          ],
        },
        // Section F (10 bars): Final Summit Climax — Storm & Brass Synthesis returning to Em
        {
          name: 'F: Observatory Summit Climax',
          bars: 10,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.15,
          bassStyle: 'galop',
          arpStyle: 'storm',
          padMode: 'triad',
          percStyle: 'galop',
          chords: chordSeq([
            [4, 'Em'], [2, 'Am'], [2, 'B7'], [4, 'Em'], [2, 'C'], [2, 'D'],
            [2, 'Em'], [2, 'G'], [2, 'C'], [2, 'Am'], [2, 'B7'], [2, 'Em'],
            [2, 'Am'], [2, 'B7'], [2, 'Em'], [2, 'B7'], [4, 'Em'],
          ]),
          melody: [
            [64, 0.5], [67, 0.5], [71, 1.0], [76, 1.0], [71, 0.5], [67, 0.5],
            [72, 1.0], [69, 1.0], [71, 1.0], [66, 1.0],
            [64, 0.5], [67, 0.5], [71, 1.0], [79, 1.0], [76, 1.0],
            [76, 1.0], [72, 1.0], [74, 1.0], [78, 1.0],
            [79, 1.0], [76, 1.0], [79, 1.0], [74, 1.0],
            [76, 1.0], [72, 1.0], [76, 1.0], [72, 1.0],
            [75, 1.0], [71, 1.0], [76, 1.5], [71, 0.5],
            [72, 1.0], [76, 1.0], [75, 1.0], [71, 1.0],
            [76, 1.0], [71, 1.0], [75, 1.0], [71, 1.0],
            [76, 2.5], [null, 1.5],
          ],
          counterMelody: [
            [76, 2.0], [79, 2.0],
            [76, 2.0], [75, 2.0],
            [76, 2.0], [83, 2.0],
            [79, 2.0], [78, 2.0],
            [76, 2.0], [79, 2.0],
            [79, 2.0], [76, 2.0],
            [78, 2.0], [79, 2.0],
            [76, 2.0], [78, 2.0],
            [79, 2.0], [78, 2.0],
            [79, 2.5], [null, 1.5],
          ],
        },
      ],
    },

    // =========================================================================
    // DUEL: "Walkuerenritt" (Ride of the Valkyries) from Die Walkuere
    // Source: Richard Wagner (1813-1883), composed in Zurich 1851-1856.
    //         Public domain.
    // Mood: Fierce, driving sword-duel epic in B minor (compound triple 3/4),
    //       expanding through Wagner's B-Dorian surge, D-minor & E-minor
    //       development, duelist standoff breakdown, and climactic reprise.
    //       6-bar intro + 76-bar loop (228 beats @ 134 BPM = 102.1s).
    // =========================================================================
    duel: {
      source: 'Richard Wagner (1813-1883), Walkuerenritt / Ride of the Valkyries (composed in Zurich, 1851-1856) (Public Domain)',
      bpm: 134,
      beatsPerBar: 3,
      bars: 82,
      loop: true,
      wet: 0.25,
      leadVoice: 'softBrass',
      leadGain: 0.24,
      counterGain: 0.14,
      bassGain: 0.15,
      arpGain: 0.058,
      padGain: 0.048,
      key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
      sections: [
        // Intro (6 bars): Swirling Valkyrie storm flourishes & pounding B pedal
        {
          name: 'Intro: Swirling Storm Call',
          isIntro: true,
          bars: 6,
          key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
          chromaticPassing: [10], // A# on F#7
          leadVoice: 'flute',
          dynamics: 0.86,
          bassStyle: 'pedal',
          arpStyle: 'storm',
          padMode: 'lowDrone',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Bm'], [3, 'Bm'], [3, 'Bm'], [3, 'Em'], [3, 'F#7'], [3, 'Bm'],
          ]),
          melody: [
            [78, 1.0], [74, 1.0], [71, 1.0],
            [78, 1.0], [74, 1.0], [71, 1.0],
            [83, 1.0], [78, 1.0], [74, 1.0],
            [79, 1.0], [76, 1.0], [71, 1.0],
            [78, 1.0], [73, 1.0], [70, 1.0],
            [71, 2.0], [null, 1.0],
          ],
        },
        // Section A (12 bars): Main Valkyrie Leitmotif in B minor with B-Dorian E-major surge
        {
          name: 'A: Main Valkyrie Leitmotif',
          bars: 12,
          key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
          chromaticPassing: [8, 10], // G# (E major Dorian surge) & A# (F#7)
          leadVoice: 'softBrass',
          dynamics: 1.02,
          bassStyle: 'pulse',
          arpStyle: 'storm',
          padMode: 'openFifth',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Bm'], [3, 'Bm'], [3, 'Bm'], [3, 'E'],
            [3, 'Em'], [3, 'F#7'], [3, 'Bm'], [3, 'F#7'],
            [3, 'Bm'], [3, 'G'], [3, 'F#7'], [3, 'Bm'],
          ]),
          melody: [
            [71, 0.5], [66, 0.25], [71, 0.25], [74, 1.0], [71, 0.75], [71, 0.25],
            [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [74, 0.75], [74, 0.25],
            [78, 0.5], [74, 0.25], [78, 0.25], [74, 1.0], [71, 1.0],
            [76, 0.5], [71, 0.25], [76, 0.25], [80, 1.0], [76, 1.0],
            [79, 0.5], [76, 0.25], [79, 0.25], [76, 1.0], [71, 1.0],
            [78, 0.5], [73, 0.25], [78, 0.25], [76, 1.0], [73, 1.0],
            [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [74, 1.0],
            [73, 0.5], [70, 0.25], [73, 0.25], [78, 1.0], [66, 0.75], [66, 0.25],
            [71, 0.5], [66, 0.25], [71, 0.25], [74, 1.0], [71, 0.75], [71, 0.25],
            [74, 0.5], [71, 0.25], [74, 0.25], [79, 1.0], [74, 1.0],
            [76, 0.5], [73, 0.25], [70, 0.25], [73, 1.0], [78, 1.0],
            [71, 2.0], [null, 1.0],
          ],
        },
        // Section B (12 bars): "Hojotoho!" Battle Cry & Upper Brass / Flute Counter-Call
        {
          name: 'B: Hojotoho Battle Cry',
          bars: 12,
          key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
          chromaticPassing: [8, 10],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.08,
          bassStyle: 'galop',
          arpStyle: 'galop',
          padMode: 'triad',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Bm'], [3, 'G'], [3, 'D'], [3, 'F#7'],
            [3, 'Bm'], [3, 'E'], [3, 'G'], [3, 'F#7'],
            [3, 'Em'], [3, 'Bm'], [3, 'F#7'], [3, 'Bm'],
          ]),
          melody: [
            [78, 0.5], [74, 0.25], [78, 0.25], [83, 1.0], [78, 1.0],
            [79, 0.5], [74, 0.25], [79, 0.25], [83, 1.0], [79, 1.0],
            [81, 0.5], [78, 0.25], [74, 0.25], [78, 1.0], [81, 1.0],
            [78, 1.5], [76, 0.5], [73, 1.0],
            [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [83, 1.0],
            [80, 0.5], [76, 0.25], [80, 0.25], [83, 1.0], [76, 1.0],
            [79, 1.0], [74, 1.0], [71, 1.0],
            [73, 1.0], [78, 1.0], [70, 1.0],
            [76, 0.5], [71, 0.25], [76, 0.25], [79, 1.0], [76, 1.0],
            [78, 0.5], [74, 0.25], [71, 0.25], [74, 1.0], [78, 1.0],
            [76, 1.0], [73, 1.0], [70, 1.0],
            [71, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [71, 2.0], [74, 1.0],
            [74, 2.0], [71, 1.0],
            [74, 2.0], [78, 1.0],
            [73, 2.0], [70, 1.0],
            [71, 2.0], [74, 1.0],
            [76, 2.0], [71, 1.0],
            [74, 2.0], [79, 1.0],
            [78, 2.0], [73, 1.0],
            [71, 2.0], [76, 1.0],
            [74, 2.0], [71, 1.0],
            [73, 2.0], [78, 1.0],
            [74, 2.0], [null, 1.0],
          ],
        },
        // Section C (16 bars): Symphonic Development in D minor (transposed Valkyrie drive + walking bass)
        {
          name: 'C: Development (D minor Surge)',
          bars: 16,
          key: { name: 'D minor', rootPc: 2, mode: 'naturalMinor' },
          chromaticPassing: [1, 11], // C# on A7, B natural on G major Dorian surge
          leadVoice: 'alphorn',
          counterVoice: 'warmStrings',
          dynamics: 1.04,
          bassStyle: 'walking',
          arpStyle: 'storm',
          padMode: 'openFifth',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Dm'], [3, 'Dm'], [3, 'Dm'], [3, 'G'],
            [3, 'Gm'], [3, 'A7'], [3, 'Dm'], [3, 'A7'],
            [3, 'Dm'], [3, 'Bb'], [3, 'Gm'], [3, 'A7'],
            [3, 'Dm'], [3, 'Bb'], [3, 'A7'], [3, 'Dm'],
          ]),
          melody: [
            [74, 0.5], [69, 0.25], [74, 0.25], [77, 1.0], [74, 0.75], [74, 0.25],
            [77, 0.5], [74, 0.25], [77, 0.25], [81, 1.0], [77, 0.75], [77, 0.25],
            [81, 0.5], [77, 0.25], [81, 0.25], [77, 1.0], [74, 1.0],
            [79, 0.5], [74, 0.25], [79, 0.25], [83, 1.0], [79, 1.0],
            [82, 0.5], [79, 0.25], [82, 0.25], [79, 1.0], [74, 1.0],
            [81, 0.5], [76, 0.25], [81, 0.25], [79, 1.0], [76, 1.0],
            [77, 0.5], [74, 0.25], [77, 0.25], [81, 1.0], [77, 1.0],
            [76, 0.5], [73, 0.25], [76, 0.25], [81, 1.0], [69, 1.0],
            [74, 1.0], [77, 1.0], [81, 1.0],
            [82, 1.5], [77, 0.5], [74, 1.0],
            [79, 1.0], [74, 1.0], [70, 1.0],
            [73, 1.0], [76, 1.0], [81, 1.0],
            [77, 1.0], [74, 1.0], [69, 1.0],
            [74, 1.0], [77, 1.0], [70, 1.0],
            [76, 1.0], [73, 1.0], [69, 1.0],
            [74, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [69, 2.0], [74, 1.0],
            [74, 2.0], [69, 1.0],
            [77, 2.0], [74, 1.0],
            [74, 2.0], [79, 1.0],
            [74, 2.0], [70, 1.0],
            [73, 2.0], [76, 1.0],
            [74, 2.0], [69, 1.0],
            [73, 2.0], [76, 1.0],
            [69, 2.0], [74, 1.0],
            [74, 2.0], [70, 1.0],
            [70, 2.0], [74, 1.0],
            [76, 2.0], [73, 1.0],
            [74, 2.0], [77, 1.0],
            [70, 2.0], [74, 1.0],
            [73, 2.0], [76, 1.0],
            [69, 2.0], [null, 1.0],
          ],
        },
        // Section D (12 bars): Stretto Blade Clash in E minor — escalating urgency
        {
          name: 'D: Stretto Blade Clash (E minor)',
          bars: 12,
          key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
          chromaticPassing: [3], // D# on B7
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.10,
          bassStyle: 'galop',
          arpStyle: 'storm',
          padMode: 'openFifth',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Em'], [3, 'Em'], [3, 'C'], [3, 'B7'],
            [3, 'Em'], [3, 'Am'], [3, 'D'], [3, 'G'],
            [3, 'C'], [3, 'Am'], [3, 'B7'], [3, 'B7'],
          ]),
          melody: [
            [76, 0.5], [71, 0.25], [76, 0.25], [79, 1.0], [76, 1.0],
            [79, 0.5], [76, 0.25], [79, 0.25], [83, 1.0], [79, 1.0],
            [79, 0.5], [76, 0.25], [72, 0.25], [76, 1.0], [79, 1.0],
            [78, 1.0], [75, 1.0], [71, 1.0],
            [76, 1.0], [79, 1.0], [83, 1.0],
            [81, 1.0], [76, 1.0], [72, 1.0],
            [78, 1.0], [74, 1.0], [69, 1.0],
            [74, 1.5], [71, 0.5], [67, 1.0],
            [72, 1.0], [76, 1.0], [79, 1.0],
            [76, 1.0], [72, 1.0], [69, 1.0],
            [71, 1.0], [75, 1.0], [78, 1.0],
            [83, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [71, 2.0], [76, 1.0],
            [76, 2.0], [71, 1.0],
            [76, 2.0], [72, 1.0],
            [75, 2.0], [78, 1.0],
            [71, 2.0], [76, 1.0],
            [76, 2.0], [72, 1.0],
            [74, 2.0], [78, 1.0],
            [79, 2.0], [74, 1.0],
            [76, 2.0], [72, 1.0],
            [72, 2.0], [76, 1.0],
            [75, 2.0], [78, 1.0],
            [78, 2.0], [null, 1.0],
          ],
        },
        // Section E (8 bars): Duelist Standoff Breakdown (low B pedal, pounding drums, tense horn & rests)
        {
          name: 'E: Duelist Standoff Breakdown',
          bars: 8,
          key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
          chromaticPassing: [10],
          leadVoice: 'alphorn',
          dynamics: 0.70,
          bassStyle: 'pedal',
          arpStyle: 'sparse',
          padMode: 'lowDrone',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Bm'], [3, 'Bm'], [3, 'Em'], [3, 'Bm'],
            [3, 'G'], [3, 'Em'], [3, 'F#7'], [3, 'F#7'],
          ]),
          melody: [
            [71, 1.5], [null, 1.5],
            [74, 1.0], [71, 1.0], [null, 1.0],
            [76, 1.5], [null, 1.5],
            [74, 1.5], [71, 1.5],
            [74, 2.0], [null, 1.0],
            [76, 1.5], [71, 1.5],
            [73, 1.5], [70, 1.5],
            [78, 2.0], [null, 1.0],
          ],
        },
        // Section A' (16 bars): Full-Force Climactic Reprise in B minor with soaring flute harmony
        {
          name: 'A2: Climactic Valkyrie Reprise',
          bars: 16,
          key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
          chromaticPassing: [8, 10],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.15,
          bassStyle: 'galop',
          arpStyle: 'storm',
          padMode: 'triad',
          percStyle: 'galop',
          chords: chordSeq([
            [3, 'Bm'], [3, 'Bm'], [3, 'Bm'], [3, 'E'],
            [3, 'Em'], [3, 'F#7'], [3, 'Bm'], [3, 'F#7'],
            [3, 'Bm'], [3, 'G'], [3, 'Em'], [3, 'F#7'],
            [3, 'Bm'], [3, 'G'], [3, 'F#7'], [3, 'Bm'],
          ]),
          melody: [
            [71, 0.5], [66, 0.25], [71, 0.25], [74, 1.0], [71, 0.75], [71, 0.25],
            [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [74, 0.75], [74, 0.25],
            [78, 0.5], [74, 0.25], [78, 0.25], [74, 1.0], [71, 1.0],
            [76, 0.5], [71, 0.25], [76, 0.25], [80, 1.0], [76, 1.0],
            [79, 0.5], [76, 0.25], [79, 0.25], [76, 1.0], [71, 1.0],
            [78, 0.5], [73, 0.25], [78, 0.25], [76, 1.0], [73, 1.0],
            [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [74, 1.0],
            [73, 0.5], [70, 0.25], [73, 0.25], [78, 1.0], [66, 0.75], [66, 0.25],
            [71, 0.5], [66, 0.25], [71, 0.25], [74, 1.0], [78, 1.0],
            [79, 0.5], [74, 0.25], [79, 0.25], [83, 1.0], [79, 1.0],
            [79, 0.5], [76, 0.25], [71, 0.25], [76, 1.0], [79, 1.0],
            [78, 1.0], [73, 1.0], [70, 1.0],
            [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [83, 1.0],
            [79, 1.0], [74, 1.0], [71, 1.0],
            [76, 0.5], [73, 0.25], [70, 0.25], [73, 1.0], [78, 1.0],
            [71, 2.0], [null, 1.0],
          ],
          counterMelody: [
            [78, 2.0], [74, 1.0],
            [78, 2.0], [83, 1.0],
            [83, 2.0], [78, 1.0],
            [80, 2.0], [83, 1.0],
            [76, 2.0], [79, 1.0],
            [78, 2.0], [76, 1.0],
            [78, 2.0], [74, 1.0],
            [78, 2.0], [73, 1.0],
            [78, 2.0], [83, 1.0],
            [83, 2.0], [79, 1.0],
            [76, 2.0], [79, 1.0],
            [78, 2.0], [73, 1.0],
            [78, 2.0], [74, 1.0],
            [79, 2.0], [74, 1.0],
            [78, 2.0], [73, 1.0],
            [74, 2.0], [null, 1.0],
          ],
        },
      ],
    },

    // =========================================================================
    // DEATH: Short descending minor cadence (~2.7s + tail)
    // Source: Traditional Swiss minor-mode elegy cadence (Public domain).
    // =========================================================================
    death: {
      source: 'Traditional Swiss minor-mode descending alpine cadence (Public Domain)',
      bpm: 88,
      beatsPerBar: 4,
      bars: 1,
      loop: false,
      tailSec: 1.3,
      wet: 0.36,
      leadVoice: 'alphorn',
      leadGain: 0.23,
      counterGain: 0.12,
      bassGain: 0.14,
      arpGain: 0.055,
      padGain: 0.06,
      key: { name: 'D minor', rootPc: 2, mode: 'naturalMinor' },
      sections: [
        {
          name: 'Elegy Cadence',
          bars: 1,
          key: { name: 'D minor', rootPc: 2, mode: 'naturalMinor' },
          chromaticPassing: [],
          leadVoice: 'alphorn',
          dynamics: 0.95,
          bassStyle: 'sustain',
          arpStyle: 'cadenceDown',
          padMode: 'openFifth',
          percStyle: 'none',
          chords: chordSeq([[4, 'Dm']]),
          melody: [[69, 1.0], [67, 1.0], [65, 1.0], [62, 1.0]],
        },
      ],
    },

    // =========================================================================
    // VICTORY: Short bright major fanfare cadence (~3.9s + tail)
    // Source: Alberich Zwyssig (1808-1854), Schweizerpsalm / Alpine fanfare
    //         motif (1841). Public domain.
    // =========================================================================
    victory: {
      source: 'Alberich Zwyssig (1808-1854), Schweizerpsalm / Swiss Alpine fanfare cadence (1841) (Public Domain)',
      bpm: 124,
      beatsPerBar: 4,
      bars: 2,
      loop: false,
      tailSec: 1.5,
      wet: 0.34,
      leadVoice: 'softBrass',
      leadGain: 0.25,
      counterGain: 0.14,
      bassGain: 0.15,
      arpGain: 0.06,
      padGain: 0.065,
      key: { name: 'F major', rootPc: 5, mode: 'major' },
      sections: [
        {
          name: 'Alpine Fanfare',
          bars: 2,
          key: { name: 'F major', rootPc: 5, mode: 'major' },
          chromaticPassing: [],
          leadVoice: 'softBrass',
          counterVoice: 'flute',
          dynamics: 1.05,
          bassStyle: 'fanfare',
          arpStyle: 'fanfare',
          padMode: 'triad',
          percStyle: 'fanfare',
          chords: chordSeq([[2, 'F'], [2, 'Bb'], [2, 'C7'], [2, 'F']]),
          melody: [
            [65, 1.0], [69, 0.5], [72, 0.5], [74, 1.0], [70, 1.0],
            [72, 0.5], [74, 0.5], [76, 1.0], [77, 2.0],
          ],
          counterMelody: [
            [69, 2.0], [70, 2.0],
            [76, 2.0], [72, 2.0],
          ],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Arrangement Compiler (Multi-Section, Intro + Loop, Counter-Melody, Bass, Arp, Pad, Perc)
// ---------------------------------------------------------------------------

/**
 * Picks a scale-step approach bass note connecting current chord toward next chord.
 */
function pickWalkingBassNote(chord, nextChord, beatIdx, dur, scaleSet) {
  const tones = chordMidis(chord, 36).map((m) => (m > 48 ? m - 12 : m < 34 ? m + 12 : m));
  const root = chord.bassMidi;
  const third = tones[1] || chord.fifthMidi;
  const fifth = chord.fifthMidi;

  if (beatIdx === 0) return root;
  if (beatIdx === dur - 1 && nextChord) {
    // Approach nextChord.bassMidi by a scale step (1 or 2 semitones above or below)
    const target = nextChord.bassMidi;
    const candidates = [target - 2, target - 1, target + 2, target + 1];
    for (const c of candidates) {
      if (c >= 34 && c <= 50 && scaleSet.has(((c % 12) + 12) % 12)) {
        return c;
      }
    }
    return fifth;
  }
  if (beatIdx === 1) return third;
  if (beatIdx === 2) return fifth;
  return root;
}

function compileTrack(spec) {
  const totalBeats = spec.beatsPerBar * spec.bars;
  const events = [];

  let sectionCursor = 0;
  let introBeats = 0;
  let inLeadingIntro = true;
  const compiledSections = [];

  for (const sec of spec.sections) {
    const secBeats = sec.bars * spec.beatsPerBar;
    const secStart = sectionCursor;
    if (sec.isIntro && inLeadingIntro) {
      introBeats += secBeats;
    } else {
      inLeadingIntro = false;
    }

    const dyn = sec.dynamics ?? 1.0;
    const leadVoice = sec.leadVoice || spec.leadVoice;
    const counterVoice = sec.counterVoice || 'warmStrings';
    const art = sec.articulation ?? 0.92;
    const bassStyle = sec.bassStyle ?? 'roots';
    const arpStyle = sec.arpStyle ?? 'waltz';
    const padMode = sec.padMode ?? 'openFifth';
    const percStyle = sec.percStyle ?? 'none';
    const scaleSet = buildScaleSet(sec.key.rootPc, sec.key.mode);

    // Part 1: Lead Melody
    let melCursor = 0;
    for (const [midi, dur] of sec.melody) {
      if (midi !== null) {
        events.push({
          beat: secStart + melCursor,
          kind: 'melody',
          voice: leadVoice,
          midi,
          durBeats: Math.max(0.16, dur * art),
          gain: spec.leadGain * dyn,
        });
      }
      melCursor += dur;
    }

    // Part 1b: Optional Counter-Melody / Harmony Line
    if (Array.isArray(sec.counterMelody)) {
      let cCursor = 0;
      const baseCounterGain = spec.counterGain ?? spec.leadGain * 0.58;
      for (const [midi, dur] of sec.counterMelody) {
        if (midi !== null) {
          events.push({
            beat: secStart + cCursor,
            kind: 'melody',
            voice: counterVoice,
            midi,
            durBeats: Math.max(0.16, dur * 0.9),
            gain: baseCounterGain * dyn,
          });
        }
        cCursor += dur;
      }
    }

    // Section tonic pedal bass (used by bassStyle === 'pedal')
    const pedalRoot = sec.key.rootPc === 11 ? 35 : 36 + sec.key.rootPc;

    // Part 2, 3, 4: Pad, Bass, and Chord-Tone Arpeggio
    for (let ci = 0; ci < sec.chords.length; ci++) {
      const chord = sec.chords[ci];
      const nextChord = sec.chords[ci + 1] || sec.chords[0];
      const absBeat = secStart + chord.beat;

      // Pad
      if (padMode !== 'none') {
        const chordTones48 = chordMidis(chord, 48);
        const rootPad = chordTones48[0];
        const thirdPad = chordTones48[1] || rootPad + 4;
        const fifthPad = chordTones48[2] || rootPad + 7;
        const padMult = padMode === 'lowDrone' ? 0.72 : padMode === 'triad' ? 1.05 : 0.92;
        events.push({
          beat: absBeat,
          kind: 'pad',
          voice: 'pad',
          midi: padMode === 'lowDrone' ? rootPad - 12 : rootPad,
          thirdMidi: padMode === 'triad' ? thirdPad : null,
          fifthMidi: padMode === 'lowDrone' ? fifthPad - 12 : fifthPad,
          durBeats: Math.max(0.5, chord.dur * 0.96),
          gain: spec.padGain * dyn * padMult,
        });
      }

      // Bass
      const bGain = spec.bassGain * dyn;
      if (bassStyle === 'none') {
        // Intentional silent bass
      } else if (bassStyle === 'pedal') {
        // Sustained or softly pulsing tonic pedal
        const step = chord.dur >= 4 ? 2 : chord.dur;
        for (let b = 0; b < chord.dur; b += step) {
          events.push({
            beat: absBeat + b,
            kind: 'bass',
            voice: 'bass',
            midi: pedalRoot,
            durBeats: Math.min(step * 0.9, 2.4),
            gain: b === 0 ? bGain * 0.9 : bGain * 0.72,
          });
        }
      } else if (bassStyle === 'walking') {
        for (let b = 0; b < chord.dur; b += 1) {
          const midi = pickWalkingBassNote(chord, nextChord, b, chord.dur, scaleSet);
          events.push({
            beat: absBeat + b,
            kind: 'bass',
            voice: 'bass',
            midi,
            durBeats: 0.78,
            gain: b === 0 ? bGain : bGain * 0.82,
          });
        }
      } else if (bassStyle === 'roots') {
        events.push({
          beat: absBeat,
          kind: 'bass',
          voice: 'bass',
          midi: chord.bassMidi,
          durBeats: Math.min(1.8, chord.dur * 0.85),
          gain: bGain,
        });
        if (chord.dur >= 3) {
          events.push({
            beat: absBeat + 2,
            kind: 'bass',
            voice: 'bass',
            midi: chord.fifthMidi,
            durBeats: Math.min(1.2, (chord.dur - 2) * 0.8),
            gain: bGain * 0.82,
          });
        }
      } else if (bassStyle === 'waltz') {
        events.push({
          beat: absBeat,
          kind: 'bass',
          voice: 'bass',
          midi: chord.bassMidi,
          durBeats: 1.5,
          gain: bGain,
        });
        if (chord.dur >= 3) {
          events.push({
            beat: absBeat + 2,
            kind: 'bass',
            voice: 'bass',
            midi: chord.fifthMidi,
            durBeats: 0.72,
            gain: bGain * 0.8,
          });
        }
      } else if (bassStyle === 'sneak') {
        for (let b = 0; b < chord.dur; b += 2) {
          events.push({
            beat: absBeat + b,
            kind: 'bass',
            voice: 'bass',
            midi: chord.bassMidi,
            durBeats: 0.75,
            gain: bGain,
          });
          if (b + 1.5 < chord.dur) {
            events.push({
              beat: absBeat + b + 1.5,
              kind: 'bass',
              voice: 'bass',
              midi: chord.fifthMidi,
              durBeats: 0.4,
              gain: bGain * 0.78,
            });
          }
        }
      } else if (bassStyle === 'march' || bassStyle === 'pulse') {
        for (let b = 0; b < chord.dur; b += 1) {
          const midi = b % 2 === 0 ? chord.bassMidi : chord.fifthMidi;
          events.push({
            beat: absBeat + b,
            kind: 'bass',
            voice: 'bass',
            midi,
            durBeats: 0.65,
            gain: b % 2 === 0 ? bGain : bGain * 0.82,
          });
        }
      } else if (bassStyle === 'galop') {
        for (let b = 0; b < chord.dur; b += 1) {
          const midi = b % 2 === 0 ? chord.bassMidi : chord.fifthMidi;
          events.push({
            beat: absBeat + b,
            kind: 'bass',
            voice: 'bass',
            midi,
            durBeats: 0.45,
            gain: bGain,
          });
          events.push({
            beat: absBeat + b + 0.5,
            kind: 'bass',
            voice: 'bass',
            midi: chord.bassMidi + 12,
            durBeats: 0.35,
            gain: bGain * 0.72,
          });
        }
      } else if (bassStyle === 'gentle' || bassStyle === 'fanfare') {
        events.push({
          beat: absBeat,
          kind: 'bass',
          voice: 'bass',
          midi: chord.bassMidi,
          durBeats: Math.min(1.6, chord.dur * 0.8),
          gain: bGain,
        });
        if (chord.dur >= 2) {
          events.push({
            beat: absBeat + 1,
            kind: 'bass',
            voice: 'bass',
            midi: chord.fifthMidi,
            durBeats: 0.8,
            gain: bGain * 0.8,
          });
        }
      } else {
        events.push({
          beat: absBeat,
          kind: 'bass',
          voice: 'bass',
          midi: chord.bassMidi,
          durBeats: chord.dur * 0.9,
          gain: bGain,
        });
      }

      // Arpeggio strictly on chord tones
      const aGain = spec.arpGain * dyn;
      const tones = chordMidis(chord, 60);
      if (arpStyle === 'none') {
        // Silent arpeggio
      } else if (arpStyle === 'sparse') {
        events.push({
          beat: absBeat + Math.min(1, chord.dur * 0.5),
          kind: 'arp',
          voice: 'arp',
          midi: tones[tones.length - 1],
          durBeats: 0.9,
          gain: aGain * 0.85,
        });
      } else if (arpStyle === 'barcarolle') {
        // Undulating lakeside wave figure (root, fifth, octave, third, fifth, third)
        const wave = [tones[0], tones[2] || tones[0] + 7, tones[0] + 12, tones[1], tones[2] || tones[0] + 7, tones[1]];
        let idx = 0;
        for (let b = 0; b < chord.dur; b += 0.5) {
          events.push({
            beat: absBeat + b,
            kind: 'arp',
            voice: 'arp',
            midi: wave[idx % wave.length],
            durBeats: 0.55,
            gain: idx % 3 === 0 ? aGain : aGain * 0.82,
          });
          idx++;
        }
      } else if (arpStyle === 'shimmer') {
        let idx = 0;
        for (let b = 0.5; b < chord.dur; b += 0.5) {
          const midi = tones[idx % tones.length] + 12;
          events.push({
            beat: absBeat + b,
            kind: 'arp',
            voice: 'arp',
            midi,
            durBeats: 0.48,
            gain: aGain * 0.86,
          });
          idx++;
        }
      } else if (arpStyle === 'tremolo') {
        // Warm low-register alternating murmur
        const lowTones = chordMidis(chord, 48);
        let idx = 0;
        for (let b = 0; b < chord.dur; b += 0.5) {
          events.push({
            beat: absBeat + b,
            kind: 'arp',
            voice: 'arp',
            midi: lowTones[idx % lowTones.length],
            durBeats: 0.42,
            gain: b % 1 === 0 ? aGain * 0.9 : aGain * 0.74,
          });
          idx++;
        }
      } else if (arpStyle === 'waltz' || arpStyle === 'cern') {
        let idx = 0;
        for (let b = 0; b < chord.dur; b += 0.5) {
          if (arpStyle === 'waltz' && b === 0) {
            idx++;
            continue;
          }
          events.push({
            beat: absBeat + b,
            kind: 'arp',
            voice: 'arp',
            midi: tones[idx % tones.length],
            durBeats: 0.48,
            gain: aGain,
          });
          idx++;
        }
      } else if (arpStyle === 'stealth' || arpStyle === 'lullaby') {
        let idx = 0;
        for (let b = 0.5; b < chord.dur; b += 0.5) {
          const midi = tones[idx % tones.length] + (arpStyle === 'lullaby' ? 12 : 0);
          events.push({
            beat: absBeat + b,
            kind: 'arp',
            voice: 'arp',
            midi,
            durBeats: 0.45,
            gain: aGain,
          });
          idx++;
        }
      } else if (arpStyle === 'march' || arpStyle === 'storm' || arpStyle === 'galop') {
        let idx = 0;
        for (let b = 0; b < chord.dur; b += 0.5) {
          events.push({
            beat: absBeat + b,
            kind: 'arp',
            voice: 'arp',
            midi: tones[idx % tones.length],
            durBeats: 0.36,
            gain: b % 1 === 0 ? aGain * 0.8 : aGain,
          });
          idx++;
        }
      } else if (arpStyle === 'cadenceDown') {
        const desc = [...tones].reverse();
        desc.forEach((midi, idx) => {
          events.push({
            beat: absBeat + idx * 0.5,
            kind: 'arp',
            voice: 'arp',
            midi,
            durBeats: 0.9,
            gain: aGain,
          });
        });
      } else if (arpStyle === 'fanfare') {
        tones.forEach((midi, idx) => {
          if (idx * 0.5 < chord.dur) {
            events.push({
              beat: absBeat + idx * 0.5,
              kind: 'arp',
              voice: 'arp',
              midi,
              durBeats: 0.55,
              gain: aGain,
            });
          }
        });
      }
    }

    // Part 5: Per-section light percussion
    if (percStyle !== 'none') {
      for (let bar = 0; bar < sec.bars; bar++) {
        const b0 = secStart + bar * spec.beatsPerBar;
        if (percStyle === 'vault') {
          for (let b = 0; b < spec.beatsPerBar; b += 0.5) {
            events.push({
              beat: b0 + b,
              kind: 'perc',
              voice: 'woodTick',
              freq: b % 1 === 0 ? 2200 : 3000,
              gain: (b % 1 === 0 ? 0.034 : 0.018) * dyn,
            });
          }
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 78, gain: 0.095 * dyn });
        } else if (percStyle === 'rail') {
          // Gentle Swiss railway click-clack in 3/4
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 84, gain: 0.09 * dyn });
          events.push({ beat: b0 + 1, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.026 * dyn });
          events.push({ beat: b0 + 1.5, kind: 'perc', voice: 'woodTick', freq: 2700, gain: 0.02 * dyn });
          events.push({ beat: b0 + 2, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.024 * dyn });
        } else if (percStyle === 'march') {
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 80, gain: 0.115 * dyn });
          if (spec.beatsPerBar >= 4) {
            events.push({ beat: b0 + 2, kind: 'perc', voice: 'softKick', startFreq: 74, gain: 0.095 * dyn });
            events.push({ beat: b0 + 1, kind: 'perc', voice: 'brush', durSec: 0.09, gain: 0.033 * dyn });
            events.push({ beat: b0 + 3, kind: 'perc', voice: 'brush', durSec: 0.09, gain: 0.033 * dyn });
          }
        } else if (percStyle === 'cern') {
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 86, gain: 0.088 * dyn });
          events.push({ beat: b0 + 1.5, kind: 'perc', voice: 'woodTick', freq: 2800, gain: 0.023 * dyn });
          if (spec.beatsPerBar >= 3) {
            events.push({ beat: b0 + 2.5, kind: 'perc', voice: 'woodTick', freq: 3400, gain: 0.019 * dyn });
          }
        } else if (percStyle === 'ice') {
          events.push({ beat: b0 + Math.min(2, spec.beatsPerBar - 1), kind: 'perc', voice: 'brush', durSec: 0.16, gain: 0.022 * dyn });
        } else if (percStyle === 'sparse') {
          if (bar % 2 === 0) {
            events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 72, gain: 0.08 * dyn });
          } else {
            events.push({ beat: b0 + 2, kind: 'perc', voice: 'brush', durSec: 0.15, gain: 0.022 * dyn });
          }
        } else if (percStyle === 'summit') {
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 76, gain: 0.105 * dyn });
          if (spec.beatsPerBar >= 4) {
            events.push({ beat: b0 + 2, kind: 'perc', voice: 'softKick', startFreq: 72, gain: 0.088 * dyn });
            events.push({ beat: b0 + 3, kind: 'perc', voice: 'brush', durSec: 0.15, gain: 0.03 * dyn });
          }
        } else if (percStyle === 'galop') {
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 90, gain: 0.12 * dyn });
          events.push({ beat: b0 + 0.5, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.03 * dyn });
          events.push({ beat: b0 + 1, kind: 'perc', voice: 'softKick', startFreq: 82, gain: 0.095 * dyn });
          events.push({ beat: b0 + 1.5, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.034 * dyn });
          if (spec.beatsPerBar >= 4) {
            events.push({ beat: b0 + 2, kind: 'perc', voice: 'softKick', startFreq: 88, gain: 0.11 * dyn });
            events.push({ beat: b0 + 2.5, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.03 * dyn });
            events.push({ beat: b0 + 3, kind: 'perc', voice: 'brush', durSec: 0.08, gain: 0.034 * dyn });
          }
        } else if (percStyle === 'fanfare') {
          events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 88, gain: 0.115 * dyn });
          if (spec.beatsPerBar >= 4) {
            events.push({ beat: b0 + 2, kind: 'perc', voice: 'brush', durSec: 0.11, gain: 0.034 * dyn });
          }
        }
      }
    }

    compiledSections.push({
      ...sec,
      startBeat: secStart,
      beats: secBeats,
    });
    sectionCursor += secBeats;
  }

  events.sort((a, b) => a.beat - b.beat);
  const loopBeats = totalBeats - introBeats;
  let loopStartEventIndex = 0;
  if (introBeats > 0) {
    const idx = events.findIndex((ev) => ev.beat >= introBeats - 1e-9);
    loopStartEventIndex = idx >= 0 ? idx : 0;
  }

  return {
    ...spec,
    sections: compiledSections,
    totalBeats,
    introBeats,
    loopBeats,
    loopStartEventIndex,
    totalDurationSec: (totalBeats * 60) / spec.bpm,
    loopDurationSec: (loopBeats * 60) / spec.bpm,
    events,
  };
}

function createTrackData() {
  const specs = createTrackSpecs();
  const compiled = {};
  for (const [name, spec] of Object.entries(specs)) {
    compiled[name] = compileTrack(spec);
  }
  return compiled;
}

// ---------------------------------------------------------------------------
// Music Class
// ---------------------------------------------------------------------------

export class Music {
  /**
   * @param {AudioContext} audioContext
   * @param {AudioNode} [destinationNode]
   */
  constructor(audioContext, destinationNode) {
    if (!audioContext) {
      throw new Error('Music requires an AudioContext');
    }
    this._ctx = audioContext;
    this._dest = destinationNode || audioContext.destination;
    this._volume = 0.7;

    const now = this._ctx.currentTime;

    // Master output chain: masterLowpass -> compressor -> masterGain -> destination
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.setValueAtTime(this._volume * 0.78, now);
    this._masterGain.connect(this._dest);

    let chainOut = this._masterGain;
    if (typeof this._ctx.createDynamicsCompressor === 'function') {
      this._compressor = this._ctx.createDynamicsCompressor();
      this._compressor.threshold.setValueAtTime(-18, now);
      this._compressor.knee.setValueAtTime(18, now);
      this._compressor.ratio.setValueAtTime(3.5, now);
      this._compressor.attack.setValueAtTime(0.008, now);
      this._compressor.release.setValueAtTime(0.18, now);
      this._compressor.connect(chainOut);
      chainOut = this._compressor;
    }

    this._masterLowpass = this._ctx.createBiquadFilter();
    this._masterLowpass.type = 'lowpass';
    this._masterLowpass.frequency.setValueAtTime(5200, now);
    this._masterLowpass.Q.setValueAtTime(0.6, now);
    this._masterLowpass.connect(chainOut);

    // Subtle warm feedback-delay reverb bus
    this._delay = this._ctx.createDelay(1.0);
    this._delay.delayTime.setValueAtTime(0.30, now);

    this._delayFilter = this._ctx.createBiquadFilter();
    this._delayFilter.type = 'lowpass';
    this._delayFilter.frequency.setValueAtTime(1850, now);

    this._delayFeedback = this._ctx.createGain();
    this._delayFeedback.gain.setValueAtTime(0.26, now);

    this._delayReturn = this._ctx.createGain();
    this._delayReturn.gain.setValueAtTime(0.38, now);

    this._delay.connect(this._delayFilter);
    this._delayFilter.connect(this._delayFeedback);
    this._delayFeedback.connect(this._delay);
    this._delayFilter.connect(this._delayReturn);
    this._delayReturn.connect(this._masterLowpass);

    this._noiseBuffer = this._createNoiseBuffer();
    this._tracks = createTrackData();

    this._currentTrack = null;
    this._activeBus = null;
    this._timerId = null;
    this._stingerEndTimer = null;
    this._eventCursor = 0;
    this._cycleStartTime = 0;
  }

  _createNoiseBuffer() {
    const sampleRate = this._ctx.sampleRate || 44100;
    const length = Math.floor(sampleRate * 1.2);
    const buffer = this._ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic LCG white noise
    let s = 0x12345678;
    for (let i = 0; i < length; i++) {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      data[i] = s / 2147483648 - 1;
    }
    return buffer;
  }

  /**
   * Starts playing a track. If the requested track is already playing, this is a no-op.
   * Switching tracks crossfades quickly.
   *
   * @param {string} trackName - 'title'|'level0'..'level9'|'duel'|'death'|'victory'
   */
  play(trackName) {
    const track = this._tracks[trackName];
    if (!track) return;

    // No-op if already playing this exact track
    if (this._currentTrack === trackName && this._activeBus) {
      return;
    }

    if (this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
      this._ctx.resume().catch(() => {});
    }

    const now = this._ctx.currentTime;
    const isStinger = !track.loop;
    const fadeOutSec = isStinger || trackName === 'duel' ? 0.14 : 0.28;
    const fadeInSec = isStinger ? 0.025 : trackName === 'duel' ? 0.10 : 0.24;

    this._fadeOutAndClearActive(fadeOutSec);

    const busGain = this._ctx.createGain();
    busGain.gain.setValueAtTime(0.0001, now);
    busGain.gain.exponentialRampToValueAtTime(1.0, now + fadeInSec);
    busGain.connect(this._masterLowpass);

    const wetSend = this._ctx.createGain();
    wetSend.gain.setValueAtTime(track.wet ?? 0.28, now);
    busGain.connect(wetSend);
    wetSend.connect(this._delay);

    this._activeBus = {
      gain: busGain,
      wetSend,
      voices: this._createVoices(busGain),
    };
    this._currentTrack = trackName;
    this._eventCursor = 0;
    this._cycleStartTime = now + 0.04;

    this._scheduleLoop();
    this._timerId = setInterval(() => this._scheduleLoop(), LOOKAHEAD_MS);
  }

  /**
   * Stops playback cleanly with a quick fade-out.
   */
  stop() {
    this._fadeOutAndClearActive(0.15);
    this._currentTrack = null;
  }

  /**
   * Sets overall music volume in [0, 1].
   * @param {number} v
   */
  setVolume(v) {
    const vol = clamp(Number(v) || 0, 0, 1);
    this._volume = vol;
    const now = this._ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setTargetAtTime(vol * 0.78, now, 0.025);
  }

  _fadeOutAndClearActive(fadeSec) {
    if (this._timerId !== null) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
    if (this._stingerEndTimer !== null) {
      clearTimeout(this._stingerEndTimer);
      this._stingerEndTimer = null;
    }

    const oldBus = this._activeBus;
    this._activeBus = null;
    if (!oldBus) return;

    const now = this._ctx.currentTime;
    try {
      const currentVal = Math.max(0.0001, oldBus.gain.gain.value || 1.0);
      oldBus.gain.gain.cancelScheduledValues(now);
      oldBus.gain.gain.setValueAtTime(currentVal, now);
      oldBus.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      oldBus.gain.gain.linearRampToValueAtTime(0, now + fadeSec + 0.02);
    } catch (_) {
      // Ignore audio param timing edge cases
    }

    setTimeout(() => {
      try {
        oldBus.gain.disconnect();
        oldBus.wetSend.disconnect();
      } catch (_) {
        // Already disconnected
      }
    }, Math.ceil((fadeSec + 0.12) * 1000));
  }

  _scheduleLoop() {
    if (!this._currentTrack || !this._activeBus) return;
    const track = this._tracks[this._currentTrack];
    if (!track) return;

    const secPerBeat = 60 / track.bpm;
    const now = this._ctx.currentTime;
    const horizon = now + SCHEDULE_AHEAD_SEC;
    const voices = this._activeBus.voices;

    while (true) {
      if (this._eventCursor >= track.events.length) {
        if (!track.loop) {
          if (this._timerId !== null) {
            clearInterval(this._timerId);
            this._timerId = null;
          }
          const finishedBus = this._activeBus;
          const finishedName = this._currentTrack;
          const endTime = this._cycleStartTime + track.totalBeats * secPerBeat;
          const tailMs = Math.ceil(((endTime - this._ctx.currentTime) + (track.tailSec || 1.3)) * 1000);
          this._stingerEndTimer = setTimeout(() => {
            if (this._activeBus === finishedBus && this._currentTrack === finishedName) {
              this._fadeOutAndClearActive(0.15);
              this._currentTrack = null;
            }
          }, Math.max(200, tailMs));
          return;
        }
        // Seamless loop: skip non-repeating intro and advance cycle by loopBeats
        this._eventCursor = track.loopStartEventIndex;
        this._cycleStartTime += track.loopBeats * secPerBeat;
      }

      const ev = track.events[this._eventCursor];
      const eventTime = this._cycleStartTime + ev.beat * secPerBeat;
      if (eventTime >= horizon) break;

      // Guard against huge catch-up bursts after tab suspension
      if (eventTime >= now - 0.35) {
        const durSec = (ev.durBeats || 0.5) * secPerBeat;
        this._triggerEvent(voices, ev, eventTime, durSec);
      }
      this._eventCursor += 1;
    }
  }

  _triggerEvent(voices, ev, time, durSec) {
    if (ev.kind === 'melody') {
      const freq = midiToFreq(ev.midi);
      voices[ev.voice](time, freq, durSec, ev.gain);
    } else if (ev.kind === 'pad') {
      const thirdFreq = ev.thirdMidi ? midiToFreq(ev.thirdMidi) : null;
      voices.pad(time, midiToFreq(ev.midi), midiToFreq(ev.fifthMidi), durSec, ev.gain, thirdFreq);
    } else if (ev.kind === 'bass') {
      voices.bass(time, midiToFreq(ev.midi), durSec, ev.gain);
    } else if (ev.kind === 'arp') {
      voices.arp(time, midiToFreq(ev.midi), durSec, ev.gain);
    } else if (ev.kind === 'perc') {
      if (ev.voice === 'softKick') {
        voices.softKick(time, ev.gain, ev.startFreq);
      } else if (ev.voice === 'brush') {
        voices.brush(time, ev.durSec, ev.gain);
      } else if (ev.voice === 'woodTick') {
        voices.woodTick(time, ev.gain, ev.freq);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Soft, Click-Free WebAudio Voices (Zero harsh square waves)
  // -------------------------------------------------------------------------

  _createVoices(busGain) {
    const ctx = this._ctx;
    const noiseBuffer = this._noiseBuffer;

    function applyAdsr(env, t, dur, peak, attack, decay, sustainRatio, release) {
      const a = Math.min(attack, dur * 0.4);
      const d = Math.min(decay, Math.max(0.01, dur - a) * 0.5);
      const sustainEnd = Math.max(t + a + d + 0.005, t + dur);
      const sus = Math.max(0.0002, peak * sustainRatio);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + a);
      env.gain.exponentialRampToValueAtTime(sus, t + a + d);
      env.gain.setValueAtTime(sus, sustainEnd);
      env.gain.exponentialRampToValueAtTime(0.0001, sustainEnd + release);
      return sustainEnd + release + 0.02;
    }

    return {
      // Warm low-passed saw + triangle alphorn
      alphorn(time, freq, dur, gain = 0.24) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'sawtooth';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(freq * 0.9985, t);
        o2.frequency.setValueAtTime(freq * 1.0015, t);

        lp.type = 'lowpass';
        lp.Q.setValueAtTime(1.4, t);
        lp.frequency.setValueAtTime(Math.min(freq * 1.6, 540), t);
        lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 3.2, 1650), t + Math.min(0.18, dur * 0.38));
        lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 1.9, 950), t + dur);

        const stopAt = applyAdsr(env, t, dur, gain, 0.055, 0.16, 0.78, 0.16);
        o1.connect(lp);
        o2.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
      },

      // Gentle detuned triangle + sine flute
      flute(time, freq, dur, gain = 0.23) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'triangle';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(freq, t);
        o2.frequency.setValueAtTime(freq * 1.002, t);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(Math.min(freq * 4.2, 3400), t);

        const stopAt = applyAdsr(env, t, dur, gain, 0.032, 0.12, 0.8, 0.13);
        o1.connect(lp);
        o2.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
      },

      // Soft plucked dulcimer / Hackbrett
      dulcimer(time, freq, dur, gain = 0.23) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o2Gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'triangle';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(freq, t);
        o2.frequency.setValueAtTime(freq * 2.002, t);
        o2Gain.gain.setValueAtTime(0.22, t);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(Math.min(freq * 4.0, 3200), t);
        lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.4, 480), t + dur);

        const stopAt = applyAdsr(env, t, dur, gain, 0.009, Math.max(0.12, dur * 0.55), 0.28, 0.12);
        o1.connect(lp);
        o2.connect(o2Gain);
        o2Gain.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
      },

      // Delicate bell-like celesta / glacier music box
      celesta(time, freq, dur, gain = 0.21) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o2Gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'sine';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(freq, t);
        o2.frequency.setValueAtTime(freq * 3.0, t);
        o2Gain.gain.setValueAtTime(0.14, t);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(Math.min(freq * 4.5, 3600), t);
        lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 620), t + dur);

        const stopAt = applyAdsr(env, t, dur, gain, 0.006, Math.max(0.14, dur * 0.62), 0.22, 0.18);
        o1.connect(lp);
        o2.connect(o2Gain);
        o2Gain.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
      },

      // Soft bowed chamber strings (warm detuned triangles + sine)
      warmStrings(time, freq, dur, gain = 0.20) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o3 = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'triangle';
        o2.type = 'triangle';
        o3.type = 'sine';
        o1.frequency.setValueAtTime(freq * 0.9975, t);
        o2.frequency.setValueAtTime(freq * 1.0025, t);
        o3.frequency.setValueAtTime(freq, t);

        lp.type = 'lowpass';
        lp.Q.setValueAtTime(0.7, t);
        lp.frequency.setValueAtTime(Math.min(freq * 3.2, 2100), t);

        const stopAt = applyAdsr(env, t, dur, gain, 0.085, 0.18, 0.82, 0.20);
        o1.connect(lp);
        o2.connect(lp);
        o3.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o3.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
        o3.stop(stopAt);
      },

      // Warm rounded brass for Duel, Finale & Victory fanfare
      softBrass(time, freq, dur, gain = 0.25) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o3 = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'sawtooth';
        o2.type = 'sawtooth';
        o3.type = 'triangle';
        o1.frequency.setValueAtTime(freq * 0.997, t);
        o2.frequency.setValueAtTime(freq * 1.003, t);
        o3.frequency.setValueAtTime(freq, t);

        lp.type = 'lowpass';
        lp.Q.setValueAtTime(1.1, t);
        lp.frequency.setValueAtTime(Math.min(freq * 1.8, 700), t);
        lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 3.4, 2300), t + Math.min(0.05, dur * 0.3));
        lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 2.1, 1300), t + dur);

        const stopAt = applyAdsr(env, t, dur, gain, 0.016, 0.1, 0.72, 0.1);
        o1.connect(lp);
        o2.connect(lp);
        o3.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o3.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
        o3.stop(stopAt);
      },

      // Round warm bass (sine + soft low-passed triangle)
      bass(time, freq, dur, gain = 0.14) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const sub = ctx.createOscillator();
        const body = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        sub.type = 'sine';
        body.type = 'triangle';
        sub.frequency.setValueAtTime(freq, t);
        body.frequency.setValueAtTime(freq, t);
        bodyGain.gain.setValueAtTime(0.45, t);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(Math.min(freq * 3.2, 360), t);

        const stopAt = applyAdsr(env, t, dur, gain, 0.014, 0.1, 0.72, 0.08);
        sub.connect(env);
        body.connect(bodyGain);
        bodyGain.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        sub.start(t);
        body.start(t);
        sub.stop(stopAt);
        body.stop(stopAt);
      },

      // Soft chord-tone arpeggio voice
      arp(time, freq, dur, gain = 0.055) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'triangle';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(freq, t);
        o2.frequency.setValueAtTime(freq * 1.002, t);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(Math.min(freq * 2.8, 2200), t);

        const stopAt = applyAdsr(env, t, dur, gain, 0.012, Math.max(0.08, dur * 0.6), 0.3, 0.1);
        o1.connect(lp);
        o2.connect(lp);
        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
      },

      // Warm open-fifth / triad background pad
      pad(time, freq, fifthFreq, dur, gain = 0.055, thirdFreq = null) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o2Gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        o1.type = 'triangle';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(freq, t);
        o2.frequency.setValueAtTime(fifthFreq * 1.002, t);
        o2Gain.gain.setValueAtTime(0.45, t);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(880, t);

        const stopAt = applyAdsr(env, t, dur, gain, Math.min(0.35, dur * 0.3), 0.2, 0.85, Math.min(0.35, dur * 0.3));
        o1.connect(lp);
        o2.connect(o2Gain);
        o2Gain.connect(lp);

        let o3 = null;
        if (thirdFreq) {
          o3 = ctx.createOscillator();
          const o3Gain = ctx.createGain();
          o3.type = 'sine';
          o3.frequency.setValueAtTime(thirdFreq * 0.999, t);
          o3Gain.gain.setValueAtTime(0.32, t);
          o3.connect(o3Gain);
          o3Gain.connect(lp);
        }

        lp.connect(env);
        env.connect(busGain);

        o1.start(t);
        o2.start(t);
        o1.stop(stopAt);
        o2.stop(stopAt);
        if (o3) {
          o3.start(t);
          o3.stop(stopAt);
        }
      },

      // Soft rounded kick
      softKick(time, gain = 0.12, startFreq = 82) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.11);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);

        osc.connect(env);
        env.connect(busGain);
        osc.start(t);
        osc.stop(t + 0.19);
      },

      // Soft filtered brush hit
      brush(time, durSec = 0.1, gain = 0.032) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1750, t);
        bp.Q.setValueAtTime(1.2, t);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, t + durSec);

        src.connect(bp);
        bp.connect(env);
        env.connect(busGain);
        src.start(t);
        src.stop(t + durSec + 0.02);
      },

      // Soft wood-block / Swiss watch tick
      woodTick(time, gain = 0.03, freq = 2400) {
        const t = Math.max(time, ctx.currentTime + 0.002);
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(freq, t);
        bp.Q.setValueAtTime(4.5, t);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);

        src.connect(bp);
        bp.connect(env);
        env.connect(busGain);
        src.start(t);
        src.stop(t + 0.035);
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Node Self-Test (Guarded so it NEVER runs in a browser or when imported)
// Run directly via: node src/music.js
// ---------------------------------------------------------------------------

function runSelfTest() {
  const REQUIRED_TRACKS = [
    'title',
    'level0', 'level1', 'level2', 'level3', 'level4',
    'level5', 'level6', 'level7', 'level8', 'level9',
    'duel', 'death', 'victory',
  ];
  const tracks = createTrackData();

  // Verify A4=440 equal temperament and exported Music API shape
  if (Math.abs(midiToFreq(69) - 440) > 1e-9) {
    throw new Error('midiToFreq(69) must equal 440 Hz');
  }
  for (const method of ['play', 'stop', 'setVolume']) {
    if (typeof Music.prototype[method] !== 'function') {
      throw new Error(`Music.prototype.${method} must be a function`);
    }
  }

  for (const name of REQUIRED_TRACKS) {
    const t = tracks[name];
    if (!t) throw new Error(`Missing required track: ${name}`);
    if (!Array.isArray(t.sections) || t.sections.length === 0) {
      throw new Error(`${name}: must declare non-empty sections array`);
    }

    const expectedTotalBeats = t.beatsPerBar * t.bars;
    if (Math.abs(t.totalBeats - expectedTotalBeats) > 1e-9) {
      throw new Error(`${name}: totalBeats ${t.totalBeats} != ${expectedTotalBeats}`);
    }

    const isStrongBeat = (beat) => {
      const beatInBar = ((beat % t.beatsPerBar) + t.beatsPerBar) % t.beatsPerBar;
      if (Math.abs(beatInBar) < 1e-6) return true;
      if (t.beatsPerBar === 4 && Math.abs(beatInBar - 2) < 1e-6) return true;
      return false;
    };

    let sumBars = 0;
    let sumBeats = 0;
    let totalNotes = 0;
    let counterNoteCount = 0;
    const voicesUsed = new Set();
    const bassStylesUsed = new Set();
    const dynamicsUsed = new Set();

    for (let si = 0; si < t.sections.length; si++) {
      const sec = t.sections[si];
      const secLabel = `${name}[${si}:${sec.name}]`;
      if (!sec.key || typeof sec.key.rootPc !== 'number' || !sec.key.mode) {
        throw new Error(`${secLabel}: missing key declaration`);
      }
      if (!Array.isArray(sec.chords) || sec.chords.length === 0) {
        throw new Error(`${secLabel}: missing chords declaration`);
      }
      if (!Array.isArray(sec.melody) || sec.melody.length === 0) {
        throw new Error(`${secLabel}: missing melody declaration`);
      }

      const secExpectedBeats = sec.bars * t.beatsPerBar;
      sumBars += sec.bars;
      sumBeats += secExpectedBeats;
      voicesUsed.add(sec.leadVoice || t.leadVoice);
      if (sec.counterVoice) voicesUsed.add(sec.counterVoice);
      bassStylesUsed.add(sec.bassStyle || 'roots');
      dynamicsUsed.add(sec.dynamics ?? 1.0);

      // Verify contiguous chord coverage summing to secExpectedBeats
      let chordCursor = 0;
      for (const ch of sec.chords) {
        if (Math.abs(ch.beat - chordCursor) > 1e-6) {
          throw new Error(`${secLabel}: chord gap/overlap at beat ${ch.beat}, expected ${chordCursor}`);
        }
        if (ch.dur <= 0) {
          throw new Error(`${secLabel}: non-positive chord duration ${ch.dur}`);
        }
        if (((ch.bassMidi % 12) + 12) % 12 !== ch.rootPc) {
          throw new Error(`${secLabel}: bassMidi ${ch.bassMidi} does not match rootPc ${ch.rootPc}`);
        }
        chordCursor += ch.dur;
      }
      if (Math.abs(chordCursor - secExpectedBeats) > 1e-6) {
        throw new Error(`${secLabel}: chords duration ${chordCursor} != expected ${secExpectedBeats}`);
      }

      const scaleSet = buildScaleSet(sec.key.rootPc, sec.key.mode);
      const passingSet = new Set(sec.chromaticPassing || []);

      const findChordAt = (beat) => {
        const c = sec.chords.find((ch) => beat >= ch.beat - 1e-9 && beat < ch.beat + ch.dur - 1e-9);
        if (!c) throw new Error(`${secLabel}: no chord declared at beat ${beat}`);
        return c;
      };

      const validateLine = (line, lineName) => {
        let beat = 0;
        let count = 0;
        for (const [midi, dur] of line) {
          if (dur <= 0) throw new Error(`${secLabel} (${lineName}): non-positive duration ${dur}`);
          if (midi !== null) {
            count++;
            const pc = ((midi % 12) + 12) % 12;

            // 1. Scale or declared chromatic passing tone
            if (!scaleSet.has(pc) && !passingSet.has(pc)) {
              throw new Error(
                `${secLabel} (${lineName}): note MIDI ${midi} (pc=${pc}) at beat ${beat} is not in ${sec.key.name} scale or chromaticPassing`
              );
            }

            // 2. Strong-beat chord tone check
            for (let checkBeat = Math.ceil(beat - 1e-9); checkBeat < beat + dur - 1e-9; checkBeat += 1) {
              if (isStrongBeat(checkBeat)) {
                const chord = findChordAt(checkBeat);
                const chordPcs = chordPitchClasses(chord);
                if (!chordPcs.has(pc)) {
                  throw new Error(
                    `${secLabel} (${lineName}): note MIDI ${midi} (pc=${pc}) on strong beat ${checkBeat} is not a chord tone of ${chord.symbol || `${chord.rootPc}:${chord.quality}`}`
                  );
                }
              }
            }
          }
          beat += dur;
        }
        if (Math.abs(beat - secExpectedBeats) > 1e-6) {
          throw new Error(`${secLabel} (${lineName}): duration ${beat} != expected ${secExpectedBeats} beats`);
        }
        return count;
      };

      totalNotes += validateLine(sec.melody, 'melody');
      if (Array.isArray(sec.counterMelody)) {
        counterNoteCount += validateLine(sec.counterMelody, 'counterMelody');
      }
    }

    // Verify section totals add up to track totals
    if (sumBars !== t.bars) {
      throw new Error(`${name}: sum of section bars ${sumBars} != track.bars ${t.bars}`);
    }
    if (Math.abs(sumBeats - t.totalBeats) > 1e-6) {
      throw new Error(`${name}: sum of section beats ${sumBeats} != track.totalBeats ${t.totalBeats}`);
    }
    if (Math.abs((t.introBeats + t.loopBeats) - t.totalBeats) > 1e-6) {
      throw new Error(`${name}: introBeats + loopBeats != totalBeats`);
    }
    if (totalNotes === 0) {
      throw new Error(`${name}: melody has no pitched notes`);
    }

    // Verify looping track length >= 90 seconds and multi-section arrangement variety
    if (t.loop) {
      if (t.loopDurationSec < 90) {
        throw new Error(
          `${name}: loop duration ${t.loopDurationSec.toFixed(1)}s is shorter than required 90s`
        );
      }
      if (t.introBeats <= 0) {
        throw new Error(`${name}: looping track should include a short intro before first loop`);
      }
      if (t.sections.length < 5) {
        throw new Error(`${name}: expected at least 5 sections (intro + multi-section form), got ${t.sections.length}`);
      }
      if (counterNoteCount === 0) {
        throw new Error(`${name}: looping track should include a counter-melody/harmony in later sections`);
      }
      if (voicesUsed.size < 3) {
        throw new Error(`${name}: expected instrumentation variety (>=3 voices), got ${voicesUsed.size}`);
      }
      if (bassStylesUsed.size < 3) {
        throw new Error(`${name}: expected bass pattern variety (>=3 styles), got ${bassStylesUsed.size}`);
      }
      if (dynamicsUsed.size < 3) {
        throw new Error(`${name}: expected dynamic contrast (>=3 levels), got ${dynamicsUsed.size}`);
      }
    }

    const loopLabel = t.loop
      ? `loop ${t.loopDurationSec.toFixed(1)}s (${t.loopBeats / t.beatsPerBar}b + ${t.introBeats / t.beatsPerBar}b intro)`
      : `stinger ${t.totalDurationSec.toFixed(1)}s`;
    console.log(
      `PASS ${name.padEnd(8)} | ${t.key.name.padEnd(8)} | ${String(t.bpm).padStart(3)} BPM | ${String(t.sections.length).padStart(2)} sec | ${String(totalNotes + counterNoteCount).padStart(4)} notes | ${loopLabel}`
    );
  }

  console.log(
    `All ${REQUIRED_TRACKS.length} tracks passed per-section scale, strong-beat chord-tone, section-length, arrangement-variety, and >=90s loop assertions.`
  );
}

const isNodeMain = (() => {
  if (typeof process === 'undefined' || !process.versions || !process.versions.node) return false;
  if (typeof window !== 'undefined' || typeof document !== 'undefined') return false;
  if (!Array.isArray(process.argv) || !process.argv[1]) return false;
  try {
    const metaPath = decodeURIComponent(import.meta.url.replace(/^file:\/\//, ''));
    const argPath = process.argv[1].replace(/\\/g, '/');
    return metaPath === argPath || metaPath.endsWith('/' + argPath) || argPath.endsWith(metaPath);
  } catch (_) {
    return false;
  }
})();

if (isNodeMain) {
  runSelfTest();
}
