// All story text. Dry, polite, slightly over-insured.
export const INTRO = [
  { h: 'ZURICH. PRESENT DAY.', t: 'The Federal Council is in Davos, where nothing can go wrong because nobody is watching the country. Dr. Viktor Zins, chairman of Zins & Cie, chooses this week to launch Operation Sechseläuten.' },
  { h: 'THE PLAN', t: 'At midnight, every Swiss bank account will be merged into a single ledger. Dr. Zins is the sole administrator. He describes this as "consolidation". Customers will describe it differently, in several languages.' },
  { h: 'THE ONLY KEY', t: 'The merge needs two cryptographic keys. The second belongs to Céline Amrein, chief auditor, who has declined to countersign. She is now locked in the observatory on the Jungfraujoch. Zins gave her one hour to reconsider.' },
  { h: 'THE PRINCE', t: 'Luca "Prinz" Brunner, bike courier and rooftop legend, carried her evidence across town and was caught doing it. He now sits in the forgotten vaults under Paradeplatz. It is the quietest he has been in years.' },
  { h: 'SIXTY MINUTES', t: 'The old Réduit tunnels still link the Alps in secret, because Swiss secrets are very well kept, including from the Swiss. One hour. Four hundred kilometres. No tram pass.' },
];

export const LEVELS = [
  { name: 'PARADEPLATZ VAULTS', place: 'Zurich', tip: 'Press UP near a ledge to climb (hold SHIFT to hang). Stand near items and press SHIFT to take them.',
    end: { h: 'VAULTS CLEARED', t: 'Prinz leaves the vaults richer in experience and poorer in dignity. A service hatch leads to the Réduit, which is not on any tourist map. This is the point.' } },
  { name: 'GOTTHARD RÉDUIT', place: 'Uri', tip: 'Spikes are lethal at speed. Careful steps (SHIFT + direction) cross them safely.',
    end: { h: 'GOTTHARD PASSED', t: 'The bunker ends in a lift last serviced in 1987. It works. Prinz decides not to ask why. Next stop: Geneva, which is further away than it sounds and closer than it is.' } },
  { name: 'CERN TUNNEL', place: 'Geneva', tip: 'The beam shutters snap shut on a fixed rhythm. Do not run through while they close.',
    end: { h: 'CERN BEHIND HIM', t: 'Prinz leaves the collider with a headache and a strong suspicion that something is following him. Something with his face, his jacket, and no sense of fair play.' } },
  { name: 'JUNGFRAU ICE PALACE', place: 'Bernese Oberland', tip: 'Ice. Stopping takes longer than expected. The floor is also optimistic about its own strength.',
    end: { h: 'THE DEEPFAKE MERGED', t: 'Prinz and his double become one person again, which is more than most committees manage. The summit is above him. So is the stairway. So, presumably, is Dr. Zins.' } },
  { name: 'SPHINX OBSERVATORY', place: 'Jungfraujoch, 3571 m', tip: 'Dr. Zins fences like he invests: patiently, and at your expense. Parry, then strike.',
    end: null },
];

export const MIRROR_MSG = 'THE DETECTOR FLICKERS. A COPY OF YOU STEPS OUT.';
export const SAB = {
  steal: 'THE DEEPFAKE TOOK YOUR ELIXIR. IT DID NOT LEAVE A NOTE.',
  gate: 'THE DEEPFAKE JAMMED THE GATE. AMBITIOUS FOR A SCREENSAVER.',
};
export const MERGE_MSG = 'YOU AND THE DEEPFAKE BECOME ONE. HEALTH RESTORED.';

export const DEATH = [
  'A courier is only as fast as his last delivery.',
  'The vault keeps what falls into it.',
  'Insurance does not cover this.',
  'Even Swiss precision has off days.',
  'Try again. The clock does not mind.',
];

export const TIMEUP = [
  { h: 'MIDNIGHT', t: 'The clock on the platform reaches twelve. Somewhere in a Zurich office a button is pressed, quietly and without applause.' },
  { h: 'THE LEDGER', t: 'By morning every account in the country has one owner. The press calls it efficient. The Federal Council returns from Davos and issues a statement of deep concern, which is the most it has ever done about anything.' },
  { h: 'BAD ENDING', t: 'Prinz arrives at the observatory to find the door open and the coffee cold. Punctuality, it turns out, was the whole point. Press ENTER.' },
];

export function endingCards(minLeft, secLeft) {
  const elapsed = Math.max(0, 3600 - (minLeft * 60 + secLeft));
  const em = Math.floor(elapsed / 60);
  const stamp = em >= 60 ? '23:59' : '23:' + String(em).padStart(2, '0');
  const spare = minLeft > 0 ? `${minLeft} minute${minLeft === 1 ? '' : 's'} ${secLeft} second${secLeft === 1 ? '' : 's'}` : `${secLeft} seconds`;
  return [
    { h: 'THE KEY', t: 'Céline looks at Prinz, then at the clock, then at the cable he has dragged across a mountain. "You are late," she says. She countersigns the abort anyway.' },
    { h: stamp, t: 'The merge fails with ' + spare + ' to spare. Dr. Zins is escorted away by people with clipboards, which is the most frightening kind. Zins & Cie announces a transparent audit of itself.' },
    { h: 'THE LAST TRAIN', t: 'There is one train down the mountain. It is on time. Prinz and Céline board it without running. Nobody comments. This is Switzerland.' },
    { h: 'THE END', t: 'PRINCE OF ZURICH. Thank you for playing. The trams run on time again.' },
  ];
}
