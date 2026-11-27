// src/music.js
// Self-contained WebAudio soundtrack for Prince of Zurich.
// Zero external imports.
//
// Features explicit note-data transcriptions of public-domain melodies with a
// Swiss connection (composers deceased before 1955 or traditional folk tunes),
// 3-part arrangements (melody, root/fifth bass, chord-tone arpeggio/pad, plus
// optional light percussion), warm click-free ADSR synthesis, gentle master
// low-pass + compressor, feedback-delay reverb, and a Node-runnable self-test.

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
};

function buildScaleSet(rootPc, mode) {
  const intervals = SCALES[mode];
  if (!intervals) throw new Error(`Unknown scale mode: ${mode}`);
  return new Set(intervals.map((i) => (rootPc + i) % 12));
}

// Common triad / seventh chord intervals relative to chord root
const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

function chordPitchClasses(chord) {
  const iv = CHORD_INTERVALS[chord.quality];
  if (!iv) throw new Error(`Unknown chord quality: ${chord.quality}`);
  return new Set(iv.map((semi) => (chord.rootPc + semi) % 12));
}

/**
 * Computes MIDI notes in a target octave range for a chord's triad/7th.
 * Used to voice arpeggios and pads strictly from declared chord tones.
 */
function chordMidis(chord, baseOctaveMidi = 48) {
  const iv = CHORD_INTERVALS[chord.quality];
  const rootMidi = baseOctaveMidi + chord.rootPc;
  return iv.map((semi) => rootMidi + semi);
}

// ---------------------------------------------------------------------------
// Public-Domain Swiss Track Definitions
// Each track declares:
//   - source: public-domain attribution (composer death year < 1955 or Traditional)
//   - key: { rootPc, mode, name }
//   - chromaticPassing: optional array of allowed chromatic pitch classes (0..11)
//   - chords: [{ beat, dur, rootPc, quality, bassMidi, fifthMidi }]
//   - melody: array of [midiNote | null, durationInBeats]
// ---------------------------------------------------------------------------

function createTrackSpecs() {
  return {
    // -----------------------------------------------------------------------
    // TITLE: "Ranz des vaches" from William Tell Overture (Part III, Andante)
    // Source: Gioachino Rossini (1792-1868), 1829. Public domain.
    // Mood: Stately alphorn-like pastoral call in G major, 3/4 time.
    // -----------------------------------------------------------------------
    title: {
      source: 'Gioachino Rossini (1792-1868), William Tell Overture (1829) - Ranz des vaches (Public Domain)',
      bpm: 76,
      beatsPerBar: 3,
      bars: 16,
      loop: true,
      wet: 0.34,
      leadVoice: 'alphorn',
      leadEchoVoice: 'flute',
      echoStartBeat: 24,
      leadGain: 0.24,
      bassGain: 0.14,
      arpGain: 0.055,
      padGain: 0.06,
      key: { name: 'G major', rootPc: 7, mode: 'major' },
      chromaticPassing: [],
      chords: [
        // Phrase A (bars 0-7)
        { beat: 0,  dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 3,  dur: 3, rootPc: 0, quality: 'maj',  bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 6,  dur: 3, rootPc: 2, quality: '7',    bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 9,  dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 12, dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 15, dur: 3, rootPc: 4, quality: 'min',  bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 18, dur: 3, rootPc: 2, quality: 'maj',  bassMidi: 38, fifthMidi: 45 }, // D
        { beat: 21, dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        // Phrase B (bars 8-15, flute/horn upper dialogue)
        { beat: 24, dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 27, dur: 3, rootPc: 0, quality: 'maj',  bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 30, dur: 3, rootPc: 2, quality: '7',    bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 33, dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 36, dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 39, dur: 3, rootPc: 9, quality: 'min7', bassMidi: 45, fifthMidi: 40 }, // Am7
        { beat: 42, dur: 3, rootPc: 2, quality: '7',    bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 45, dur: 3, rootPc: 7, quality: 'maj',  bassMidi: 43, fifthMidi: 38 }, // G
      ],
      melody: [
        // Bar 0 (G)
        [71, 1.5], [67, 0.5], [62, 1.0],
        // Bar 1 (C)
        [64, 1.0], [66, 0.5], [67, 0.5], [69, 1.0],
        // Bar 2 (D7)
        [69, 1.5], [66, 0.5], [62, 1.0],
        // Bar 3 (G)
        [67, 2.0], [62, 1.0],
        // Bar 4 (G)
        [71, 1.5], [67, 0.5], [62, 1.0],
        // Bar 5 (Em)
        [64, 1.0], [67, 1.0], [71, 1.0],
        // Bar 6 (D)
        [69, 1.5], [66, 0.5], [62, 1.0],
        // Bar 7 (G)
        [67, 2.5], [null, 0.5],
        // Bar 8 (G)
        [74, 1.5], [71, 0.5], [67, 1.0],
        // Bar 9 (C)
        [76, 1.5], [72, 0.5], [67, 1.0],
        // Bar 10 (D7)
        [69, 1.0], [71, 0.5], [72, 0.5], [69, 1.0],
        // Bar 11 (G)
        [71, 2.0], [67, 1.0],
        // Bar 12 (G)
        [74, 1.5], [71, 0.5], [67, 1.0],
        // Bar 13 (Am7)
        [76, 1.0], [74, 1.0], [72, 1.0],
        // Bar 14 (D7)
        [69, 1.5], [66, 0.5], [62, 1.0],
        // Bar 15 (G)
        [67, 2.5], [null, 0.5],
      ],
      arpStyle: 'waltz',
      bassStyle: 'waltz',
      percStyle: 'none',
    },

    // -----------------------------------------------------------------------
    // LEVEL 0 (Paradeplatz Bank Vaults): "Guggisberglied" (Sly minor variation)
    // Source: Traditional Swiss folk song (18th century, Canton Bern). Public domain.
    // Mood: Stealthy, hushed E-minor variation at slow tempo with vault clock tick.
    // -----------------------------------------------------------------------
    level0: {
      source: 'Traditional Swiss Folk Song (18th c.), Guggisberglied / S\'isch aeben e Moensch (Public Domain)',
      bpm: 84,
      beatsPerBar: 4,
      bars: 8,
      loop: true,
      wet: 0.24,
      leadVoice: 'dulcimer',
      leadGain: 0.23,
      bassGain: 0.14,
      arpGain: 0.055,
      padGain: 0.045,
      key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
      chromaticPassing: [3], // D# harmonic-minor leading tone on B7 dominant
      chords: [
        { beat: 0,  dur: 4, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 4,  dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
        { beat: 6,  dur: 2, rootPc: 9,  quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 8,  dur: 2, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 10, dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
        { beat: 12, dur: 4, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 16, dur: 2, rootPc: 9,  quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 18, dur: 2, rootPc: 2,  quality: 'maj', bassMidi: 38, fifthMidi: 45 }, // D
        { beat: 20, dur: 2, rootPc: 7,  quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 22, dur: 2, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 24, dur: 2, rootPc: 9,  quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 26, dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
        { beat: 28, dur: 4, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
      ],
      melody: [
        // Bar 0 (Em)
        [64, 1.0], [67, 1.0], [71, 1.0], [72, 1.0],
        // Bar 1 (B7 -> Am)
        [71, 1.5], [69, 0.5], [69, 1.0], [67, 1.0],
        // Bar 2 (Em -> B7)
        [67, 1.0], [66, 1.0], [66, 1.0], [63, 1.0],
        // Bar 3 (Em)
        [64, 3.0], [null, 1.0],
        // Bar 4 (Am -> D)
        [69, 1.0], [72, 1.0], [74, 1.0], [72, 0.5], [71, 0.5],
        // Bar 5 (G -> Em)
        [71, 1.0], [69, 1.0], [67, 1.0], [64, 1.0],
        // Bar 6 (Am -> B7)
        [69, 1.0], [67, 1.0], [66, 1.0], [63, 1.0],
        // Bar 7 (Em)
        [64, 2.5], [null, 1.5],
      ],
      arpStyle: 'stealth',
      bassStyle: 'sneak',
      percStyle: 'vault',
    },

    // -----------------------------------------------------------------------
    // LEVEL 1 (Gotthard Reduit Army Bunker): "Der alte Berner Marsch"
    // Source: Traditional Swiss military march (18th c., Canton Bern). Public domain.
    // Mood: Steady, disciplined subterranean march in G major, 4/4 time.
    // -----------------------------------------------------------------------
    level1: {
      source: 'Traditional Swiss Military March (18th c.), Der alte Berner Marsch (Public Domain)',
      bpm: 110,
      beatsPerBar: 4,
      bars: 8,
      loop: true,
      wet: 0.26,
      leadVoice: 'alphorn',
      leadGain: 0.24,
      bassGain: 0.15,
      arpGain: 0.055,
      padGain: 0.045,
      key: { name: 'G major', rootPc: 7, mode: 'major' },
      chromaticPassing: [],
      chords: [
        { beat: 0,  dur: 2, rootPc: 7, quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 2,  dur: 2, rootPc: 2, quality: '7',   bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 4,  dur: 4, rootPc: 7, quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 8,  dur: 2, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 10, dur: 2, rootPc: 7, quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 12, dur: 4, rootPc: 2, quality: '7',   bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 16, dur: 2, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 18, dur: 2, rootPc: 7, quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 20, dur: 2, rootPc: 2, quality: '7',   bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 22, dur: 2, rootPc: 7, quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 24, dur: 2, rootPc: 9, quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 26, dur: 2, rootPc: 2, quality: '7',   bassMidi: 38, fifthMidi: 45 }, // D7
        { beat: 28, dur: 4, rootPc: 7, quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
      ],
      melody: [
        // Bar 0 (G -> D7)
        [67, 1.0], [67, 1.0], [69, 1.5], [66, 0.5],
        // Bar 1 (G)
        [67, 0.5], [69, 0.5], [71, 1.0], [74, 1.0], [71, 1.0],
        // Bar 2 (C -> G)
        [72, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
        // Bar 3 (D7)
        [69, 1.5], [67, 0.5], [66, 1.0], [62, 1.0],
        // Bar 4 (C -> G)
        [72, 1.0], [76, 1.0], [74, 1.0], [71, 1.0],
        // Bar 5 (D7 -> G)
        [69, 1.0], [72, 1.0], [71, 1.0], [67, 1.0],
        // Bar 6 (Am -> D7)
        [69, 0.5], [71, 0.5], [72, 1.0], [69, 1.0], [66, 1.0],
        // Bar 7 (G)
        [67, 2.5], [null, 1.5],
      ],
      arpStyle: 'march',
      bassStyle: 'march',
      percStyle: 'march',
    },

    // -----------------------------------------------------------------------
    // LEVEL 2 (CERN Accelerator Tunnel): "Lueget, vo Baergen und Tal"
    // Source: Ferdinand Fuerchtegott Huber (1791-1863), 1822. Public domain.
    // Mood: Sparse, arpeggiated, mysterious F-major / D-minor modal colors.
    // -----------------------------------------------------------------------
    level2: {
      source: 'Ferdinand Fuerchtegott Huber (1791-1863), Lueget, vo Baergen und Tal (1822) (Public Domain)',
      bpm: 92,
      beatsPerBar: 3,
      bars: 12,
      loop: true,
      wet: 0.32,
      leadVoice: 'flute',
      leadGain: 0.23,
      bassGain: 0.13,
      arpGain: 0.065,
      padGain: 0.05,
      key: { name: 'F major', rootPc: 5, mode: 'major' },
      chromaticPassing: [],
      chords: [
        { beat: 0,  dur: 3, rootPc: 2,  quality: 'min7', bassMidi: 38, fifthMidi: 45 }, // Dm7
        { beat: 3,  dur: 3, rootPc: 7,  quality: 'min7', bassMidi: 43, fifthMidi: 38 }, // Gm7
        { beat: 6,  dur: 3, rootPc: 5,  quality: 'maj7', bassMidi: 41, fifthMidi: 48 }, // Fmaj7
        { beat: 9,  dur: 3, rootPc: 0,  quality: 'maj',  bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 12, dur: 3, rootPc: 2,  quality: 'min7', bassMidi: 38, fifthMidi: 45 }, // Dm7
        { beat: 15, dur: 3, rootPc: 10, quality: 'maj7', bassMidi: 46, fifthMidi: 41 }, // Bbmaj7
        { beat: 18, dur: 3, rootPc: 5,  quality: 'maj7', bassMidi: 41, fifthMidi: 48 }, // Fmaj7
        { beat: 21, dur: 3, rootPc: 9,  quality: 'min7', bassMidi: 45, fifthMidi: 40 }, // Am7
        { beat: 24, dur: 3, rootPc: 10, quality: 'maj7', bassMidi: 46, fifthMidi: 41 }, // Bbmaj7
        { beat: 27, dur: 3, rootPc: 7,  quality: 'min7', bassMidi: 43, fifthMidi: 38 }, // Gm7
        { beat: 30, dur: 3, rootPc: 0,  quality: '7',    bassMidi: 36, fifthMidi: 43 }, // C7
        { beat: 33, dur: 3, rootPc: 2,  quality: 'min',  bassMidi: 38, fifthMidi: 45 }, // Dm
      ],
      melody: [
        // Bar 0 (Dm7)
        [72, 1.0], [69, 1.0], [65, 1.0],
        // Bar 1 (Gm7)
        [67, 1.0], [69, 1.0], [70, 1.0],
        // Bar 2 (Fmaj7)
        [69, 2.0], [65, 1.0],
        // Bar 3 (C)
        [67, 1.0], [69, 0.5], [67, 0.5], [64, 1.0],
        // Bar 4 (Dm7)
        [65, 1.0], [69, 1.0], [72, 1.0],
        // Bar 5 (Bbmaj7)
        [74, 1.5], [72, 0.5], [70, 1.0],
        // Bar 6 (Fmaj7)
        [69, 1.0], [67, 1.0], [65, 1.0],
        // Bar 7 (Am7)
        [64, 2.0], [null, 1.0],
        // Bar 8 (Bbmaj7)
        [70, 1.0], [74, 1.0], [77, 1.0],
        // Bar 9 (Gm7)
        [74, 1.0], [72, 1.0], [70, 1.0],
        // Bar 10 (C7)
        [67, 1.0], [70, 1.0], [64, 1.0],
        // Bar 11 (Dm)
        [65, 2.0], [null, 1.0],
      ],
      arpStyle: 'cern',
      bassStyle: 'pulse',
      percStyle: 'cern',
    },

    // -----------------------------------------------------------------------
    // LEVEL 3 (Jungfraujoch Ice Palace): "Vo Luzern uf Waeggis zue"
    // Source: Johann Luethi (1800-1869), 1832. Traditional Swiss folk song. Public domain.
    // Mood: Glassy high-register lullaby-like folk tune in C major, 4/4 time.
    // -----------------------------------------------------------------------
    level3: {
      source: 'Johann Luethi (1800-1869), Vo Luzern uf Waeggis zue (1832) (Public Domain)',
      bpm: 74,
      beatsPerBar: 4,
      bars: 8,
      loop: true,
      wet: 0.38,
      leadVoice: 'dulcimer',
      leadEchoVoice: 'flute',
      echoStartBeat: 16,
      leadGain: 0.23,
      bassGain: 0.12,
      arpGain: 0.055,
      padGain: 0.06,
      key: { name: 'C major', rootPc: 0, mode: 'major' },
      chromaticPassing: [],
      chords: [
        { beat: 0,  dur: 4, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 4,  dur: 2, rootPc: 5, quality: 'maj', bassMidi: 41, fifthMidi: 36 }, // F
        { beat: 6,  dur: 2, rootPc: 7, quality: '7',   bassMidi: 43, fifthMidi: 38 }, // G7
        { beat: 8,  dur: 2, rootPc: 7, quality: '7',   bassMidi: 43, fifthMidi: 38 }, // G7
        { beat: 10, dur: 2, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 12, dur: 4, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 16, dur: 2, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 18, dur: 2, rootPc: 7, quality: '7',   bassMidi: 43, fifthMidi: 38 }, // G7
        { beat: 20, dur: 2, rootPc: 5, quality: 'maj', bassMidi: 41, fifthMidi: 36 }, // F
        { beat: 22, dur: 2, rootPc: 7, quality: '7',   bassMidi: 43, fifthMidi: 38 }, // G7
        { beat: 24, dur: 2, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 26, dur: 2, rootPc: 7, quality: '7',   bassMidi: 43, fifthMidi: 38 }, // G7
        { beat: 28, dur: 4, rootPc: 0, quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
      ],
      melody: [
        // Bar 0 (C)
        [79, 1.0], [79, 1.0], [76, 1.0], [72, 1.0],
        // Bar 1 (F -> G7)
        [77, 1.0], [77, 1.0], [74, 2.0],
        // Bar 2 (G7 -> C)
        [79, 1.0], [77, 1.0], [76, 1.0], [74, 1.0],
        // Bar 3 (C)
        [76, 1.0], [72, 1.0], [72, 1.5], [null, 0.5],
        // Bar 4 (Refrain: C -> G7)
        [79, 1.5], [79, 0.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 0.5],
        // Bar 5 (F -> G7)
        [77, 1.5], [77, 0.5], [77, 0.5], [76, 0.5], [74, 0.5], [72, 0.5],
        // Bar 6 (C -> G7)
        [79, 1.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 1.0],
        // Bar 7 (C)
        [72, 2.5], [null, 1.5],
      ],
      arpStyle: 'lullaby',
      bassStyle: 'gentle',
      percStyle: 'ice',
    },

    // -----------------------------------------------------------------------
    // LEVEL 4 (Sphinx Observatory Summit): "Storm" from William Tell Overture
    // Source: Gioachino Rossini (1792-1868), 1829 (Part II, Orage). Public domain.
    // Mood: Tense nocturnal alpine build in E minor, 4/4 time.
    // -----------------------------------------------------------------------
    level4: {
      source: 'Gioachino Rossini (1792-1868), William Tell Overture (1829) - Storm Theme (Public Domain)',
      bpm: 98,
      beatsPerBar: 4,
      bars: 8,
      loop: true,
      wet: 0.34,
      leadVoice: 'alphorn',
      leadGain: 0.24,
      bassGain: 0.15,
      arpGain: 0.06,
      padGain: 0.055,
      key: { name: 'E minor', rootPc: 4, mode: 'naturalMinor' },
      chromaticPassing: [3], // D# harmonic-minor tension on B7
      chords: [
        { beat: 0,  dur: 4, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 4,  dur: 2, rootPc: 9,  quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 6,  dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
        { beat: 8,  dur: 4, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 12, dur: 2, rootPc: 9,  quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 14, dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
        { beat: 16, dur: 2, rootPc: 0,  quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 18, dur: 2, rootPc: 2,  quality: 'maj', bassMidi: 38, fifthMidi: 45 }, // D
        { beat: 20, dur: 2, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 22, dur: 2, rootPc: 0,  quality: 'maj', bassMidi: 36, fifthMidi: 43 }, // C
        { beat: 24, dur: 2, rootPc: 9,  quality: 'min', bassMidi: 45, fifthMidi: 40 }, // Am
        { beat: 26, dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
        { beat: 28, dur: 2, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 30, dur: 2, rootPc: 11, quality: '7',   bassMidi: 35, fifthMidi: 42 }, // B7
      ],
      melody: [
        // Bar 0 (Em)
        [64, 0.5], [67, 0.5], [71, 1.0], [76, 1.0], [71, 0.5], [67, 0.5],
        // Bar 1 (Am -> B7)
        [72, 1.0], [69, 1.0], [71, 1.0], [66, 1.0],
        // Bar 2 (Em)
        [64, 0.5], [67, 0.5], [71, 1.0], [79, 1.0], [76, 1.0],
        // Bar 3 (Am -> B7)
        [76, 1.0], [72, 1.0], [75, 1.5], [null, 0.5],
        // Bar 4 (C -> D)
        [72, 0.5], [76, 0.5], [79, 1.0], [78, 1.0], [74, 1.0],
        // Bar 5 (Em -> C)
        [76, 1.0], [71, 1.0], [72, 1.0], [67, 1.0],
        // Bar 6 (Am -> B7)
        [69, 0.5], [72, 0.5], [76, 1.0], [75, 1.0], [71, 1.0],
        // Bar 7 (Em -> B7)
        [76, 2.0], [71, 1.0], [null, 1.0],
      ],
      arpStyle: 'storm',
      bassStyle: 'pulse',
      percStyle: 'summit',
    },

    // -----------------------------------------------------------------------
    // DUEL: "Walkuerenritt" (Ride of the Valkyries) from Die Walkuere
    // Source: Richard Wagner (1813-1883), composed in Zurich 1851-1856. Public domain.
    // Mood: Driving, fierce B-minor sword-duel theme in compound triple feel (3/4).
    // -----------------------------------------------------------------------
    duel: {
      source: 'Richard Wagner (1813-1883), Walkuerenritt / Ride of the Valkyries (composed in Zurich, 1851-1856) (Public Domain)',
      bpm: 134,
      beatsPerBar: 3,
      bars: 12,
      loop: true,
      wet: 0.24,
      leadVoice: 'softBrass',
      leadGain: 0.25,
      bassGain: 0.15,
      arpGain: 0.06,
      padGain: 0.045,
      key: { name: 'B minor', rootPc: 11, mode: 'naturalMinor' },
      chromaticPassing: [8, 10], // G# (B Dorian / E major) and A# (F#7 leading tone)
      chords: [
        { beat: 0,  dur: 3, rootPc: 11, quality: 'min', bassMidi: 35, fifthMidi: 42 }, // Bm
        { beat: 3,  dur: 3, rootPc: 11, quality: 'min', bassMidi: 35, fifthMidi: 42 }, // Bm
        { beat: 6,  dur: 3, rootPc: 11, quality: 'min', bassMidi: 35, fifthMidi: 42 }, // Bm
        { beat: 9,  dur: 3, rootPc: 4,  quality: 'maj', bassMidi: 40, fifthMidi: 47 }, // E
        { beat: 12, dur: 3, rootPc: 4,  quality: 'min', bassMidi: 40, fifthMidi: 47 }, // Em
        { beat: 15, dur: 3, rootPc: 6,  quality: '7',   bassMidi: 42, fifthMidi: 37 }, // F#7
        { beat: 18, dur: 3, rootPc: 11, quality: 'min', bassMidi: 35, fifthMidi: 42 }, // Bm
        { beat: 21, dur: 3, rootPc: 6,  quality: '7',   bassMidi: 42, fifthMidi: 37 }, // F#7
        { beat: 24, dur: 3, rootPc: 11, quality: 'min', bassMidi: 35, fifthMidi: 42 }, // Bm
        { beat: 27, dur: 3, rootPc: 7,  quality: 'maj', bassMidi: 43, fifthMidi: 38 }, // G
        { beat: 30, dur: 3, rootPc: 6,  quality: '7',   bassMidi: 42, fifthMidi: 37 }, // F#7
        { beat: 33, dur: 3, rootPc: 11, quality: 'min', bassMidi: 35, fifthMidi: 42 }, // Bm
      ],
      melody: [
        // Bar 0 (Bm)
        [71, 0.5], [66, 0.25], [71, 0.25], [74, 1.0], [71, 0.75], [71, 0.25],
        // Bar 1 (Bm)
        [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [74, 0.75], [74, 0.25],
        // Bar 2 (Bm)
        [78, 0.5], [74, 0.25], [78, 0.25], [74, 1.0], [71, 1.0],
        // Bar 3 (E - B Dorian surge)
        [76, 0.5], [71, 0.25], [76, 0.25], [80, 1.0], [76, 1.0],
        // Bar 4 (Em)
        [79, 0.5], [76, 0.25], [79, 0.25], [76, 1.0], [71, 1.0],
        // Bar 5 (F#7)
        [78, 0.5], [73, 0.25], [78, 0.25], [76, 1.0], [73, 1.0],
        // Bar 6 (Bm)
        [74, 0.5], [71, 0.25], [74, 0.25], [78, 1.0], [74, 1.0],
        // Bar 7 (F#7)
        [73, 0.5], [70, 0.25], [73, 0.25], [78, 1.0], [66, 0.75], [66, 0.25],
        // Bar 8 (Bm)
        [71, 0.5], [66, 0.25], [71, 0.25], [74, 1.0], [71, 0.75], [71, 0.25],
        // Bar 9 (G)
        [74, 0.5], [71, 0.25], [74, 0.25], [79, 1.0], [74, 1.0],
        // Bar 10 (F#7)
        [76, 0.5], [73, 0.25], [70, 0.25], [73, 1.0], [78, 1.0],
        // Bar 11 (Bm)
        [71, 2.0], [null, 0.75], [66, 0.25],
      ],
      arpStyle: 'storm',
      bassStyle: 'pulse',
      percStyle: 'galop',
    },

    // -----------------------------------------------------------------------
    // DEATH: Short descending minor cadence (~2.6s + tail)
    // Source: Traditional Swiss minor-mode elegy cadence (Public domain motif).
    // -----------------------------------------------------------------------
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
      bassGain: 0.14,
      arpGain: 0.055,
      padGain: 0.06,
      key: { name: 'D minor', rootPc: 2, mode: 'naturalMinor' },
      chromaticPassing: [],
      chords: [
        { beat: 0, dur: 4, rootPc: 2, quality: 'min', bassMidi: 38, fifthMidi: 45 }, // Dm
      ],
      melody: [
        [69, 1.0], [67, 1.0], [65, 1.0], [62, 1.0],
      ],
      arpStyle: 'cadenceDown',
      bassStyle: 'sustain',
      percStyle: 'none',
    },

    // -----------------------------------------------------------------------
    // VICTORY: Short bright major fanfare cadence (~3.4s + tail)
    // Source: Alberich Zwyssig (1808-1854), Schweizerpsalm / Alpine fanfare motif (1841).
    // -----------------------------------------------------------------------
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
      bassGain: 0.15,
      arpGain: 0.06,
      padGain: 0.065,
      key: { name: 'F major', rootPc: 5, mode: 'major' },
      chromaticPassing: [],
      chords: [
        { beat: 0, dur: 2, rootPc: 5,  quality: 'maj', bassMidi: 41, fifthMidi: 36 }, // F
        { beat: 2, dur: 2, rootPc: 10, quality: 'maj', bassMidi: 46, fifthMidi: 41 }, // Bb
        { beat: 4, dur: 2, rootPc: 0,  quality: '7',   bassMidi: 36, fifthMidi: 43 }, // C7
        { beat: 6, dur: 2, rootPc: 5,  quality: 'maj', bassMidi: 41, fifthMidi: 36 }, // F
      ],
      melody: [
        [65, 1.0], [69, 0.5], [72, 0.5], [74, 1.0], [70, 1.0],
        [72, 0.5], [74, 0.5], [76, 1.0], [77, 2.0],
      ],
      arpStyle: 'fanfare',
      bassStyle: 'fanfare',
      percStyle: 'fanfare',
    },
  };
}

// ---------------------------------------------------------------------------
// Arrangement Compiler (3 Parts + Optional Light Percussion)
// ---------------------------------------------------------------------------

function compileTrack(spec) {
  const totalBeats = spec.beatsPerBar * spec.bars;
  const events = [];

  // Part 1: Melody
  let cursor = 0;
  for (const [midi, dur] of spec.melody) {
    if (midi !== null) {
      const useEcho =
        spec.leadEchoVoice &&
        spec.echoStartBeat !== undefined &&
        cursor >= spec.echoStartBeat;
      const voice = useEcho ? spec.leadEchoVoice : spec.leadVoice;
      events.push({
        beat: cursor,
        kind: 'melody',
        voice,
        midi,
        durBeats: Math.max(0.18, dur * 0.92),
        gain: spec.leadGain,
      });
    }
    cursor += dur;
  }

  // Part 2 & 3: Bass (chord roots/fifths) + Pad / Arpeggio (chord tones)
  for (const chord of spec.chords) {
    // Pad on every chord change
    events.push({
      beat: chord.beat,
      kind: 'pad',
      voice: 'pad',
      midi: 48 + chord.rootPc,
      fifthMidi: 48 + ((chord.rootPc + 7) % 12),
      durBeats: Math.max(0.5, chord.dur * 0.96),
      gain: spec.padGain,
    });

    // Bass patterns using strictly chord.bassMidi (root) and chord.fifthMidi (fifth)
    if (spec.bassStyle === 'waltz') {
      events.push({ beat: chord.beat, kind: 'bass', voice: 'bass', midi: chord.bassMidi, durBeats: 1.5, gain: spec.bassGain });
      if (chord.dur >= 3) {
        events.push({ beat: chord.beat + 2, kind: 'bass', voice: 'bass', midi: chord.fifthMidi, durBeats: 0.7, gain: spec.bassGain * 0.8 });
      }
    } else if (spec.bassStyle === 'sneak') {
      for (let b = 0; b < chord.dur; b += 2) {
        events.push({ beat: chord.beat + b, kind: 'bass', voice: 'bass', midi: chord.bassMidi, durBeats: 0.75, gain: spec.bassGain });
        if (b + 1.5 < chord.dur) {
          events.push({ beat: chord.beat + b + 1.5, kind: 'bass', voice: 'bass', midi: chord.fifthMidi, durBeats: 0.4, gain: spec.bassGain * 0.78 });
        }
      }
    } else if (spec.bassStyle === 'march' || spec.bassStyle === 'pulse') {
      for (let b = 0; b < chord.dur; b += 1) {
        const midi = b % 2 === 0 ? chord.bassMidi : chord.fifthMidi;
        events.push({ beat: chord.beat + b, kind: 'bass', voice: 'bass', midi, durBeats: 0.65, gain: b % 2 === 0 ? spec.bassGain : spec.bassGain * 0.82 });
      }
    } else if (spec.bassStyle === 'galop') {
      for (let b = 0; b < chord.dur; b += 1) {
        const midi = b % 2 === 0 ? chord.bassMidi : chord.fifthMidi;
        events.push({ beat: chord.beat + b, kind: 'bass', voice: 'bass', midi, durBeats: 0.45, gain: spec.bassGain });
        events.push({ beat: chord.beat + b + 0.5, kind: 'bass', voice: 'bass', midi: chord.bassMidi + 12, durBeats: 0.35, gain: spec.bassGain * 0.72 });
      }
    } else if (spec.bassStyle === 'gentle' || spec.bassStyle === 'fanfare') {
      events.push({ beat: chord.beat, kind: 'bass', voice: 'bass', midi: chord.bassMidi, durBeats: Math.min(1.6, chord.dur * 0.8), gain: spec.bassGain });
      if (chord.dur >= 2) {
        events.push({ beat: chord.beat + 1, kind: 'bass', voice: 'bass', midi: chord.fifthMidi, durBeats: 0.8, gain: spec.bassGain * 0.8 });
      }
    } else {
      events.push({ beat: chord.beat, kind: 'bass', voice: 'bass', midi: chord.bassMidi, durBeats: chord.dur * 0.9, gain: spec.bassGain });
    }

    // Arpeggio strictly on chord tones
    const tones = chordMidis(chord, 60); // octave 4..5
    if (spec.arpStyle === 'waltz' || spec.arpStyle === 'cern') {
      const step = 0.5;
      let idx = 0;
      for (let b = 0; b < chord.dur; b += step) {
        if (spec.arpStyle === 'waltz' && b === 0) {
          idx++;
          continue; // leave beat 0 open for bass+melody
        }
        const midi = tones[idx % tones.length];
        events.push({ beat: chord.beat + b, kind: 'arp', voice: 'arp', midi, durBeats: 0.48, gain: spec.arpGain });
        idx++;
      }
    } else if (spec.arpStyle === 'stealth' || spec.arpStyle === 'lullaby') {
      let idx = 0;
      for (let b = 0.5; b < chord.dur; b += 0.5) {
        const midi = tones[idx % tones.length] + (spec.arpStyle === 'lullaby' ? 12 : 0);
        events.push({ beat: chord.beat + b, kind: 'arp', voice: 'arp', midi, durBeats: 0.45, gain: spec.arpGain });
        idx++;
      }
    } else if (spec.arpStyle === 'march' || spec.arpStyle === 'storm' || spec.arpStyle === 'galop') {
      let idx = 0;
      for (let b = 0; b < chord.dur; b += 0.5) {
        const midi = tones[idx % tones.length];
        events.push({ beat: chord.beat + b, kind: 'arp', voice: 'arp', midi, durBeats: 0.36, gain: b % 1 === 0 ? spec.arpGain * 0.8 : spec.arpGain });
        idx++;
      }
    } else if (spec.arpStyle === 'cadenceDown') {
      const desc = [...tones].reverse();
      desc.forEach((midi, idx) => {
        events.push({ beat: chord.beat + idx * 0.5, kind: 'arp', voice: 'arp', midi, durBeats: 0.9, gain: spec.arpGain });
      });
    } else if (spec.arpStyle === 'fanfare') {
      tones.forEach((midi, idx) => {
        if (idx * 0.5 < chord.dur) {
          events.push({ beat: chord.beat + idx * 0.5, kind: 'arp', voice: 'arp', midi, durBeats: 0.55, gain: spec.arpGain });
        }
      });
    }
  }

  // Optional light percussion per bar
  if (spec.percStyle !== 'none') {
    for (let bar = 0; bar < spec.bars; bar++) {
      const b0 = bar * spec.beatsPerBar;
      if (spec.percStyle === 'vault') {
        for (let b = 0; b < spec.beatsPerBar; b += 0.5) {
          events.push({ beat: b0 + b, kind: 'perc', voice: 'woodTick', freq: b % 1 === 0 ? 2200 : 3000, gain: b % 1 === 0 ? 0.036 : 0.02 });
        }
        events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 78, gain: 0.1 });
      } else if (spec.percStyle === 'march') {
        events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 80, gain: 0.12 });
        events.push({ beat: b0 + 2, kind: 'perc', voice: 'softKick', startFreq: 74, gain: 0.1 });
        events.push({ beat: b0 + 1, kind: 'perc', voice: 'brush', durSec: 0.09, gain: 0.035 });
        events.push({ beat: b0 + 3, kind: 'perc', voice: 'brush', durSec: 0.09, gain: 0.035 });
      } else if (spec.percStyle === 'cern') {
        events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 86, gain: 0.09 });
        events.push({ beat: b0 + 1.5, kind: 'perc', voice: 'woodTick', freq: 2800, gain: 0.024 });
        events.push({ beat: b0 + 2.5, kind: 'perc', voice: 'woodTick', freq: 3400, gain: 0.02 });
      } else if (spec.percStyle === 'ice') {
        events.push({ beat: b0 + 2, kind: 'perc', voice: 'brush', durSec: 0.16, gain: 0.024 });
      } else if (spec.percStyle === 'summit') {
        events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 76, gain: 0.11 });
        events.push({ beat: b0 + 2, kind: 'perc', voice: 'softKick', startFreq: 72, gain: 0.09 });
        events.push({ beat: b0 + 3, kind: 'perc', voice: 'brush', durSec: 0.15, gain: 0.032 });
      } else if (spec.percStyle === 'galop') {
        events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 90, gain: 0.13 });
        events.push({ beat: b0 + 0.5, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.032 });
        events.push({ beat: b0 + 1, kind: 'perc', voice: 'softKick', startFreq: 82, gain: 0.1 });
        events.push({ beat: b0 + 1.5, kind: 'perc', voice: 'brush', durSec: 0.06, gain: 0.036 });
      } else if (spec.percStyle === 'fanfare') {
        events.push({ beat: b0, kind: 'perc', voice: 'softKick', startFreq: 88, gain: 0.12 });
        events.push({ beat: b0 + 2, kind: 'perc', voice: 'brush', durSec: 0.11, gain: 0.036 });
      }
    }
  }

  events.sort((a, b) => a.beat - b.beat);
  return { ...spec, totalBeats, events };
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
   * @param {string} trackName - 'title'|'level0'..'level4'|'duel'|'death'|'victory'
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
    const horizon = this._ctx.currentTime + SCHEDULE_AHEAD_SEC;
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
        this._eventCursor = 0;
        this._cycleStartTime += track.totalBeats * secPerBeat;
      }

      const ev = track.events[this._eventCursor];
      const eventTime = this._cycleStartTime + ev.beat * secPerBeat;
      if (eventTime >= horizon) break;

      const durSec = (ev.durBeats || 0.5) * secPerBeat;
      this._triggerEvent(voices, ev, eventTime, durSec);
      this._eventCursor += 1;
    }
  }

  _triggerEvent(voices, ev, time, durSec) {
    if (ev.kind === 'melody') {
      const freq = midiToFreq(ev.midi);
      voices[ev.voice](time, freq, durSec, ev.gain);
    } else if (ev.kind === 'pad') {
      voices.pad(time, midiToFreq(ev.midi), midiToFreq(ev.fifthMidi), durSec, ev.gain);
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

      // Soft plucked dulcimer / celesta-like Hackbrett
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

      // Warm rounded brass for Duel & Victory fanfare
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

      // Warm open-fifth background pad
      pad(time, freq, fifthFreq, dur, gain = 0.055) {
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
        lp.frequency.setValueAtTime(860, t);

        const stopAt = applyAdsr(env, t, dur, gain, Math.min(0.35, dur * 0.3), 0.2, 0.85, Math.min(0.35, dur * 0.3));
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
  const REQUIRED_TRACKS = ['title', 'level0', 'level1', 'level2', 'level3', 'level4', 'duel', 'death', 'victory'];
  const tracks = createTrackData();

  for (const name of REQUIRED_TRACKS) {
    const t = tracks[name];
    if (!t) throw new Error(`Missing required track: ${name}`);

    const expectedTotalBeats = t.beatsPerBar * t.bars;
    if (Math.abs(t.totalBeats - expectedTotalBeats) > 1e-9) {
      throw new Error(`${name}: totalBeats ${t.totalBeats} != ${expectedTotalBeats}`);
    }

    const scaleSet = buildScaleSet(t.key.rootPc, t.key.mode);
    const passingSet = new Set(t.chromaticPassing || []);

    const findChordAt = (beat) => {
      const c = t.chords.find((ch) => beat >= ch.beat - 1e-9 && beat < ch.beat + ch.dur - 1e-9);
      if (!c) throw new Error(`${name}: no chord declared at beat ${beat}`);
      return c;
    };

    const isStrongBeat = (beat) => {
      const beatInBar = ((beat % t.beatsPerBar) + t.beatsPerBar) % t.beatsPerBar;
      if (Math.abs(beatInBar) < 1e-6) return true;
      if (t.beatsPerBar === 4 && Math.abs(beatInBar - 2) < 1e-6) return true;
      return false;
    };

    let beat = 0;
    let noteCount = 0;
    for (const [midi, dur] of t.melody) {
      if (dur <= 0) throw new Error(`${name}: non-positive duration ${dur}`);
      if (midi !== null) {
        noteCount++;
        const pc = ((midi % 12) + 12) % 12;

        // 1. All notes must belong to declared scale (or listed chromatic passing tones)
        if (!scaleSet.has(pc) && !passingSet.has(pc)) {
          throw new Error(
            `${name}: note MIDI ${midi} (pc=${pc}) at beat ${beat} is not in ${t.key.name} scale or chromaticPassing`
          );
        }

        // 2. All notes attacking on or sounding across a strong beat must be chord tones
        for (let checkBeat = Math.ceil(beat - 1e-9); checkBeat < beat + dur - 1e-9; checkBeat += 1) {
          if (isStrongBeat(checkBeat)) {
            const chord = findChordAt(checkBeat);
            const chordPcs = chordPitchClasses(chord);
            if (!chordPcs.has(pc)) {
              throw new Error(
                `${name}: melody note MIDI ${midi} (pc=${pc}) on strong beat ${checkBeat} is not a chord tone of ${chord.rootPc}:${chord.quality}`
              );
            }
          }
        }
      }
      beat += dur;
    }

    if (Math.abs(beat - expectedTotalBeats) > 1e-6) {
      throw new Error(`${name}: melody duration ${beat} != expected ${expectedTotalBeats} beats`);
    }
    if (noteCount === 0) {
      throw new Error(`${name}: melody has no pitched notes`);
    }

    // Also verify A4=440 equal temperament
    if (Math.abs(midiToFreq(69) - 440) > 1e-9) {
      throw new Error('midiToFreq(69) must equal 440 Hz');
    }

    console.log(`PASS ${name.padEnd(8)} | ${t.key.name.padEnd(8)} | ${t.bpm} BPM | ${noteCount} notes | ${t.source}`);
  }

  console.log(`All ${REQUIRED_TRACKS.length} tracks passed scale, strong-beat chord-tone, and duration assertions.`);
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
