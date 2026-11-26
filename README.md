# Prince of Zurich

A 2D cinematic platformer in the deliberate, tile-committed tradition of the classic rotoscoped dungeon platformers. Original art, levels, names and text; everything is drawn procedurally on a canvas (no image assets, no dependencies, no build step).

## Play

Two engines were built from the same design and both are playable online:

- Engine A (this branch, `main`): https://koto.github.io/princeofzurich/sonnet/
- Engine B (branch `ag-engine`): https://koto.github.io/princeofzurich/neon/

## Story

Present day. While the Federal Council is away at the Davos summit, Dr. Viktor Zins, chairman of the private bank Zins & Cie, quietly triggers "Operation Sechseläuten": at the stroke of midnight his system will merge every Swiss bank account into one ledger that he alone controls. The only person who can stop it is Céline Amrein, the bank's chief auditor, who holds the second cryptographic key. Zins has locked her in the observatory atop the Jungfraujoch and given her one hour to countersign.

You are Luca "Prinz" Brunner, bike courier, rooftop legend and Céline's partner, caught carrying her evidence and thrown into the forgotten vaults beneath Paradeplatz. You have 60 real-time minutes (shown on a Swiss railway station clock) to cross the country through the old Réduit tunnel network.

1. Paradeplatz Vaults, Zurich: movement, loose floors, plates and gates, a first guard (find the guild sabre).
2. Gotthard Réduit: spikes, long jumps, more guards.
3. CERN, Geneva: beam shutters (slicer traps) and a strange detector mirror that splits off "the Deepfake".
4. Jungfraujoch Ice Palace: slippery ice, loose floors, tough guards, the Deepfake on the bridge (sheathe your sword and walk into it to merge; striking it hurts you).
5. Sphinx Observatory: the duel with Dr. Zins, then Céline.

## Run

No build step. Serve the folder with any static server and open it:

    python3 -m http.server 8377
    # then open http://localhost:8377/

(ES modules need http, not file://.) URL parameters: `?level=N` starts at level N (1-5), `?god=1` makes the hero invulnerable.

## Controls

| Key | Action |
| --- | --- |
| Left / Right | run (with start-up, skid and turn-around) |
| Shift + Left/Right | careful step (never walks off an edge) |
| Up | jump (with a direction: running or standing jump); at a ledge, jump up and hold Shift to grab it |
| Shift (held) | hang from a ledge; grab a ledge while falling; pick up an item you stand on; strike in combat |
| Up (while hanging) | pull up |
| Down | crouch; at a ledge edge climb down (hold Shift to hang, release to drop) |
| Up at an open exit door | enter |
| Combat (sword drawn) | Left/Right advance/retreat, Shift strike, Up parry, Down sheathe |
| Space | show time left |
| R | restart level (timer keeps running) |
| Esc | pause |
| M | mute |
| Enter | confirm on menus and story cards |

Touch devices get on-screen buttons. Falls: 1 floor is safe, 2 floors cost 1 health, 3+ kill. Spikes kill at speed but are safe with careful steps. Dying restarts the level; the clock does not. Progress (level, time left, health, sword) is saved to localStorage; use Continue on the title screen.

## Development tools

    node tools/validate.mjs        # structure, links, plates/gates/exit, coarse reachability for all levels
    node tools/mechanics-test.mjs  # headless checks of falls, spikes, ledges, flips, jumps (uses the real game loop)
    node tools/autoplay.mjs all --god   # BFS autopilot completes every level through the real loop

`tools/preview-extras.html` is a small preview page for the procedural backdrops and music.
