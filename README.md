# PRINCE OF ZURICH

A 2D cinematic platformer in the spirit of 1989-era rotoscoped dungeon platformers — deliberate, tile-committed movement, flip-screen rooms, mechanical traps, tactical sword duels, and a real-time 60-minute Swiss railway clock countdown.

Zero dependencies. Zero build step. Pure HTML5 Canvas, vanilla ES modules, procedural articulated skeletal animation, and WebAudio synthesis.

## Story

**Zurich, 23:00 CET.** While the Federal Council is politely occupied at the Davos summit, Dr. Viktor Zins — chairman of private bank *Zins & Cie* — triggers **Operation Sechselaeuten**: at midnight sharp, his system merges every Swiss bank account into a single ledger he alone controls.

Only Chief Auditor **Celine Amrein** holds the second cryptographic key required to abort the consolidation. Zins has locked her inside the **Sphinx Observatory** atop the Jungfraujoch with exactly sixty minutes to countersign.

You play **Luca "Prinz" Brunner** — Zurich bike courier, rooftop-running legend, and Celine's partner — caught carrying her audit files and dropped into the forgotten bullion vaults beneath Paradeplatz. With sixty minutes on the SBB railway clock, cross Switzerland through the wartime Reduit tunnel network, the CERN accelerator ring, and the Jungfraujoch Ice Palace to duel Dr. Zins and rescue Celine before midnight.

### The Five Levels
1. **Paradeplatz Vaults, Zurich** — Start unarmed, recover a Guild Sabre, master jumps, ledge-climbing, loose floors, pressure plates, vault grates, and your first guards.
2. **Gotthard Reduit Bunker** — Retractable spikes (safe with careful-step), wide running jumps, trap close-plates, and tainted coolant decoys.
3. **CERN Ring Sector 4, Geneva** — Timed cryo/laser beam shutters and the quantum-optics mirror that splits off **the Deepfake**, an AI double that sabotages your run.
4. **Jungfraujoch Ice Palace** — Extended skid distance on glacier ice, loose ice bridges, Alpine tactical guards, and the Deepfake bridge encounter (sheathe your blade and merge to heal!).
5. **Sphinx Observatory Summit** — Final alpine gauntlet, fencing duel against Dr. Viktor Zins on the narrow summit walkway, and the rescue of Celine Amrein.

## Controls

| Key | Action |
|---|---|
| `Left` / `Right` (or `A` / `D`) | Run / Turn around / Advance & Retreat in fencing stance |
| `Up` (or `W`) | Jump straight up & grab ledge / Pull up / Standing or Running Jump / Parry in combat / Enter open Exit Door |
| `Down` (or `S`) | Crouch / Climb down ledge / Drop from hang / Sheathe sword in combat |
| `Shift` | Careful step (`Shift` + direction; never walks off edges, safe on spikes) / Hold to hang / Catch ledge while falling / Pick up items / Strike in combat |
| `Space` | Display time remaining until midnight |
| `R` | Restart current level (global clock keeps running) |
| `Esc` | Pause / Resume |
| `M` | Toggle mute |

On touch devices, an on-screen control overlay appears automatically.

### Debug & URL Parameters
- `?level=1` .. `?level=5` — Jump directly to any level (1-indexed).
- `?god=1` — Enable invulnerability mode.

Progress (current level, remaining time, max health) is saved automatically in `localStorage` and can be resumed via **Continue** on the title screen.

## How to Run

Serve the project directory with any static HTTP server (required for ES modules):

```bash
python3 -m http.server 8399
```

Then open [http://localhost:8399/](http://localhost:8399/) in your browser.

### Validation
Run the automated level & syntax validator with Node.js:

```bash
node tools/validate.mjs
```


## Play online

This is engine B of two built from the same design: https://koto.github.io/princeofzurich/neon/ (engine A, on `main`: https://koto.github.io/princeofzurich/sonnet/).
