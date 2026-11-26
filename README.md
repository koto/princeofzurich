# PRINCE OF ZURICH

A 2D cinematic platformer in the spirit of 1989-era rotoscoped dungeon platformers — deliberate, tile-committed movement, flip-screen rooms, mechanical traps, tactical sword duels, and a real-time 60-minute Swiss railway clock countdown.

Zero dependencies. Zero build step. Pure HTML5 Canvas, vanilla ES modules, procedural articulated skeletal animation, and WebAudio synthesis.

## Story

**Zurich, 23:00 CET.** While the seven members of the Swiss Federal Council are politely snowed into Davos for an alpine working seminar, private banker **Dr. Viktor Zins** — Chairman of *Zins & Cie* — invokes Cold War **Emergency Ordinance 41.09-bis** to trigger **Operation Sechselaeuten**: at midnight sharp, every Swiss bank account folds into **Zins & Cie Sammel-Konto Nr. 1**. Technically nobody is robbed; nine million people simply become minority clients who may apply in writing (**Form 7-B**, ten working days, excluding cantonal holidays) to withdraw their own francs.

Under Swiss dual-control law (**the Four-Eyes Principle**), aborting the consolidation before midnight requires turning two physical keys together at the last air-gapped 1971 failover console inside the **Sphinx Observatory** (3,571m) atop the Jungfraujoch:
- **Key B (Auditor Smartcard):** Held by **Celine Amrein**, Chief Auditor at the Federal Audit Office, sealed inside the Sphinx dome — though Zins forgot her 1979 Reduit copper radiator maintenance line.
- **Key A (Notarized Revocation Token):** Dispatched off-grid via Zurich bike courier **Luca "Prinz" Brunner** (Badge 04) — caught doubling back for Celine's dropped badge at Paradeplatz and dumped unarmed into Sub-Basement 4.

With sixty real minutes on the SBB railway clock, cross Switzerland from Zurich through Olten, Gotthard, Valais, Montreux, Geneva, Bern, and the North Face of the Eiger to outrun your own AI compliance double, duel Dr. Zins, and turn both keys during the railway clock's 1.5-second pause at twelve.

### The Ten Levels
1. **Paradeplatz Vaults (Zurich, 408m — 23:00)** — Start unarmed, recover Zins's ceremonial Guild Sabre (**Asset 0041**, unsigned), master jumps, ledge-climbing, loose marble, brass grates, and your first vault guards.
2. **Olten SBB Gleis 0 (Solothurn, 396m — 23:06)** — Legally unavoidable rail transfer beneath Platform 12: red lockdown close-plates (`Q`), tight timed SBB departure bulkheads, and the Midnight Transfer Gantry.
3. **Gotthard Reduit (Uri / Ticino, 2,100m — 23:12)** — Proximity floor spikes (safe with `Shift` careful-step), Civil Defense tonics vs. industrial coolant decoys, Maj. Tobler's 1989 mobilization drill, and Celine's 1979 CRT warning to detour west.
4. **Grande Dixence Dam (Valais, 2,365m — 23:19)** — Hollow brutalist galleries inside Europe's tallest gravity dam: vertical falling-debris triggers, the four-story Penstock Shaft masonry cascade, and Inspector M. Rochat.
5. **Chillon Viaduct (Montreux, Vaud, 372m — 23:25)** — Medieval Savoyard cellars bolted directly beneath the 1960s A9 motorway: rhythmic hydraulic sluice-shutters, weighted hold-plates (pin with fallen stone or a defeated guard), and D. Favre at the Pillar of Bonivard.
6. **CERN Ring Sector 4 (Meyrin, Geneva, 430m — 23:31)** — High-tempo photonic beam shutters, superconducting dipole bays, and the Quantum Calibration Mirror that destroys Zins's key-spoofer and splits off **the Deepfake**.
7. **Bundeshaus Archive (Bern, 542m — 23:38)** — Subterranean Federal Palace archives and Mint: active Deepfake sabotage (filing your Bern address & Serafe fee!), deceptive Express `Q` plates vs. Celine's yellow scribbled audit notes, and the Hall of 26 Cantons pneumatic override.
8. **Eigerwand Gallery (North Face, 2,865m — 23:44)** — Storm-lashed rock galleries inside the Eiger: periodic Alpine Foehn wind gusts (brace headwinds with `Shift`/`Down`; ride tailwinds across impossible 3-tile broken rack-rail chasms), Rail Marshal W. Blaser, and the Shattered Viaduct.
9. **Jungfrau Ice Palace (Aletsch Glacier, 3,454m — 23:50)** — Glacial blue-ice friction (doubled skid distance), loose ice bridges, Ice Sentries, and the Crevasse Span sympathetic mirror duel (sheathe your sabre with `Down` and walk forward to merge!).
10. **Sphinx Observatory (Jungfraujoch, 3,571m — 23:55)** — Full-system summit ascent synthesizing wind, shutters, and elite guards, culminating in a three-phase fencing duel against **Dr. Viktor Zins** on the 3,571m walkway and the Four-Eyes dual-key abort beside Celine Amrein.

## Controls

| Key | Action |
|---|---|
| `Left` / `Right` (or `A` / `D`) | Run / Turn around / Advance & Retreat in fencing stance |
| `Up` (or `W`) | Jump straight up & grab ledge / Pull up / Standing or Running Jump / Parry in combat / Enter open Exit Door |
| `Down` (or `S`) | Crouch (braces in Foehn wind) / Climb down ledge / Drop from hang / Sheathe sword in combat |
| `Shift` | Careful step (`Shift` + direction; never walks off edges, safe on spikes) / Brace in Foehn wind / Hold to hang / Catch ledge while falling / Pick up items / Strike & Riposte in combat |
| `Space` | Display time remaining until midnight |
| `R` | Restart current level (global clock keeps running) |
| `Esc` | Pause / Resume / Back from Level Select |
| `M` | Toggle mute |

On touch devices, an on-screen control overlay appears automatically.

### Level Select, Saves & URL Parameters
- **Level Select (1-10):** Available directly from the title screen to jump into any of the ten Swiss locations.
- **`?level=1` .. `?level=10`** — Jump directly to any level (1-indexed).
- **`?god=1`** — Enable invulnerability mode.

Campaign progress (current level, remaining time, max health) is saved automatically in `localStorage` (`princeofzurich_save_v3`) and can be resumed via **Continue** on the title screen.

## How to Run

Serve the project directory with any static HTTP server (required for ES modules):

```bash
python3 -m http.server 8399
```

Then open [http://localhost:8399/](http://localhost:8399/) in your browser.

### Validation & Automated Tests
Run the automated validators and headless gameplay tests with Node.js:

```bash
node tools/validate.mjs
node tools/test-climb.mjs
node tools/test-game.mjs
node tools/combat-sim.mjs
```

## Play online

This is engine B of two built from the same design: https://koto.github.io/princeofzurich/neon/ (engine A, on `main`: https://koto.github.io/princeofzurich/sonnet/).
