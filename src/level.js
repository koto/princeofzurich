// src/level.js
// Constants, tile helpers, and live runtime room/level state (gates, plates, loose floors, slicers, items).

export const VIEW_W = 384;
export const VIEW_H = 216;
export const HUD_H = 24;
export const PLAY_H = VIEW_H - HUD_H; // 192
export const COLS = 12;
export const ROWS = 4;
export const TILE_W = 32; // 12 * 32 = 384
export const TILE_H = 48; // 4 * 48 = 192
export const FLOOR_THICK = 6;

export function floorY(row) {
  return (row + 1) * TILE_H - FLOOR_THICK;
}

export function tileCenterX(col) {
  return col * TILE_W + TILE_W * 0.5;
}

export function colOfX(x) {
  return Math.floor(x / TILE_W);
}

export function rowOfY(y) {
  // Given feet y, return the row whose floor is at or just below y
  return Math.floor((y - 1) / TILE_H);
}

// Tile chars:
// '#' solid wall
// '.' empty space
// '_' solid floor
// 'L' loose floor
// '^' spikes
// 'C' slicer (beam shutter)
// 'G' gate (floor + vertical portcullis)
// 'P' open pressure plate
// 'Q' close pressure plate
// 'E' level exit door
// 'M' mirror / CERN detector

export function isWalkableBaseTile(ch) {
  return ch === '_' || ch === 'L' || ch === '^' || ch === 'C' ||
    ch === 'G' || ch === 'P' || ch === 'Q' || ch === 'E' || ch === 'M';
}

export class LevelState {
  constructor(levelDef) {
    this.def = levelDef;
    this.id = levelDef.id;
    this.name = levelDef.name;
    this.subtitle = levelDef.subtitle || '';
    this.ice = !!levelDef.ice;
    this.rooms = new Map();
    this.gatesById = new Map();
    this.exitsById = new Map();
    this.fallingDebris = []; // { roomId, col, x, y, vy, startRow }
    this.particles = []; // { roomId, x, y, vx, vy, life, maxLife, color, size }
    this.mirrorBroken = false;
    this.deepfakeSpawned = false;
    this.deepfakeMerged = false;
    this.flags = new Set();

    this._initRooms();
  }

  _initRooms() {
    for (const [key, rdef] of Object.entries(this.def.rooms)) {
      const roomId = Number(key);
      const grid = rdef.grid.map((rowStr) => rowStr.split(''));
      const loose = new Map(); // "c,r" -> { state: 'intact'|'shaking'|'fallen', timer }
      const slicers = new Map(); // "c,r" -> { phase, period }
      const spikes = new Map(); // "c,r" -> { extended: 0..1, bloody: false }
      const plates = new Map(); // "c,r" -> { ...plateDef, pressed: false, pressTimer: 0 }

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const ch = grid[r][c];
          const k = `${c},${r}`;
          if (ch === 'L') {
            loose.set(k, { col: c, row: r, state: 'intact', timer: 0 });
          } else if (ch === 'C') {
            slicers.set(k, {
              col: c,
              row: r,
              period: 2.2,
              phase: ((c * 0.55 + r * 0.8 + roomId * 0.4) % 2.2),
              wasClosed: false,
            });
          } else if (ch === '^') {
            spikes.set(k, { col: c, row: r, extended: 0.25, triggered: false, snapped: false });
          }
        }
      }

      if (rdef.plates) {
        for (const p of rdef.plates) {
          plates.set(`${p.col},${p.row}`, {
            col: p.col,
            row: p.row,
            targetId: p.targetId,
            action: p.action || 'open',
            pressed: false,
            pressTimer: 0,
            wasOccupied: false,
          });
        }
      }

      const gates = [];
      if (rdef.gates) {
        for (const g of rdef.gates) {
          const gateObj = {
            id: g.id,
            roomId,
            col: g.col,
            row: g.row,
            openAmount: g.initiallyOpen ? 1 : 0, // 0 closed, 1 open
            targetOpen: g.initiallyOpen ? 1 : 0,
            stayOpen: !!g.stayOpen,
            openDuration: g.openDuration ?? 9.0,
            timer: 0,
          };
          gates.push(gateObj);
          this.gatesById.set(g.id, gateObj);
        }
      }

      const exits = [];
      if (rdef.exits) {
        for (const ex of rdef.exits) {
          const exObj = {
            id: ex.id,
            roomId,
            col: ex.col,
            row: ex.row,
            openAmount: ex.initiallyOpen ? 1 : 0,
            isOpen: !!ex.initiallyOpen,
          };
          exits.push(exObj);
          this.exitsById.set(ex.id, exObj);
        }
      }

      const items = (rdef.items || []).map((it, idx) => ({
        id: `${roomId}_item_${idx}`,
        col: it.col,
        row: it.row,
        x: tileCenterX(it.col),
        y: floorY(it.row),
        type: it.type,
        collected: false,
      }));

      const mirror = rdef.mirror ? {
        col: rdef.mirror.col,
        row: rdef.mirror.row,
        broken: false,
      } : null;

      this.rooms.set(roomId, {
        id: roomId,
        seed: rdef.seed ?? (this.id * 100 + roomId),
        links: {
          left: rdef.links?.left ?? null,
          right: rdef.links?.right ?? null,
          up: rdef.links?.up ?? null,
          down: rdef.links?.down ?? null,
        },
        grid,
        loose,
        slicers,
        spikes,
        plates,
        gates,
        exits,
        items,
        mirror,
        decor: rdef.decor || [],
        scripts: rdef.scripts || [],
        hint: rdef.hint || null,
      });
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  getTile(roomId, col, row) {
    const room = this.rooms.get(roomId);
    if (!room) return '#';
    if (col < 0) {
      if (room.links.left !== null) {
        return this.getTile(room.links.left, COLS + col, row);
      }
      return '#';
    }
    if (col >= COLS) {
      if (room.links.right !== null) {
        return this.getTile(room.links.right, col - COLS, row);
      }
      return '#';
    }
    if (row < 0) {
      if (room.links.up !== null) {
        return this.getTile(room.links.up, col, ROWS + row);
      }
      return '#';
    }
    if (row >= ROWS) {
      if (room.links.down !== null) {
        return this.getTile(room.links.down, col, row - ROWS);
      }
      return '.';
    }
    const ch = room.grid[row][col];
    if (ch === 'L') {
      const l = room.loose.get(`${col},${row}`);
      if (l && l.state === 'fallen') return '.';
    }
    return ch;
  }

  isWall(roomId, col, row) {
    return this.getTile(roomId, col, row) === '#';
  }

  hasFloor(roomId, col, row) {
    const ch = this.getTile(roomId, col, row);
    return isWalkableBaseTile(ch);
  }

  getGateAt(roomId, col, row) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (const g of room.gates) {
      if (g.col === col && g.row === row) return g;
    }
    return null;
  }

  isGateBlocking(roomId, col, row) {
    const g = this.getGateAt(roomId, col, row);
    return g ? g.openAmount < 0.65 : false;
  }

  getExitAt(roomId, col, row) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (const ex of room.exits) {
      if (ex.col === col && ex.row === row) return ex;
    }
    return null;
  }

  getSlicerState(roomId, col, row, time) {
    const room = this.rooms.get(roomId);
    if (!room) return { closed: false, openness: 1, warning: false };
    const s = room.slicers.get(`${col},${row}`);
    if (!s) return { closed: false, openness: 1, warning: false };
    const cycle = ((time + s.phase) % s.period) / s.period;
    // 0.00..0.52: open (safe)
    // 0.52..0.64: warning / closing fast
    // 0.64..0.82: snapped closed (LETHAL)
    // 0.82..1.00: reopening (safe)
    if (cycle < 0.52) return { closed: false, openness: 1, warning: false };
    if (cycle < 0.64) {
      const p = (cycle - 0.52) / 0.12;
      return { closed: p > 0.7, openness: 1 - p, warning: true };
    }
    if (cycle < 0.82) return { closed: true, openness: 0, warning: false };
    const p = (cycle - 0.82) / 0.18;
    return { closed: false, openness: p, warning: false };
  }

  triggerLooseFloor(roomId, col, row, audio) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const l = room.loose.get(`${col},${row}`);
    if (l && l.state === 'intact') {
      l.state = 'shaking';
      l.timer = 0.42;
      audio?.play('looseShake');
    }
  }

  triggerPlate(roomId, col, row, audio, onEvent, opts = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const plate = room.plates.get(`${col},${row}`);
    if (!plate) return;
    plate.pressed = true;
    plate.pressTimer = 0.25;
    if (!plate.wasOccupied) {
      plate.wasOccupied = true;
      audio?.play('plate');
      this._activateTarget(plate.targetId, plate.action, audio, onEvent, opts);
    }
  }

  _activateTarget(targetId, action, audio, onEvent, opts = null) {
    const targets = Array.isArray(targetId) ? targetId : [targetId];
    for (const tid of targets) {
      const gate = this.gatesById.get(tid);
      if (gate) {
        if (action === 'close') {
          gate.targetOpen = 0;
          gate.timer = 0;
          audio?.play('gateSlam');
          onEvent?.('gateClosed', { gate, silent: !!opts?.silentBanner });
        } else {
          gate.targetOpen = 1;
          gate.timer = gate.stayOpen ? 0 : gate.openDuration;
          audio?.play('gate');
          onEvent?.('gateOpened', gate);
        }
      }
      const exit = this.exitsById.get(tid);
      if (exit && action !== 'close') {
        if (!exit.isOpen) {
          exit.isOpen = true;
          audio?.play('gate');
          onEvent?.('exitOpened', exit);
        }
      }
    }
  }

  spawnParticles(roomId, x, y, count, color, speed = 45, life = 0.4, size = 2) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        roomId,
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        life,
        maxLife: life,
        color,
        size,
      });
    }
  }

  update(dt, time, entities, audio, onEvent) {
    // 1. Update loose floors, plates, gates, exits across all rooms
    for (const room of this.rooms.values()) {
      // Loose floors
      for (const l of room.loose.values()) {
        if (l.state === 'shaking') {
          l.timer -= dt;
          if (l.timer <= 0) {
            l.state = 'fallen';
            audio?.play('looseBreak');
            this.fallingDebris.push({
              roomId: room.id,
              col: l.col,
              x: tileCenterX(l.col),
              y: floorY(l.row),
              vy: 20,
              startRow: l.row,
            });
            this.spawnParticles(room.id, tileCenterX(l.col), floorY(l.row), 7, '#8f8a7c', 45, 0.45, 2);
          }
        }
      }

      // Plates reset occupation if nobody is standing on them
      for (const plate of room.plates.values()) {
        let occupied = false;
        for (const ent of entities) {
          if (!ent || !ent.alive || ent.roomId !== room.id) continue;
          if (ent.grounded && colOfX(ent.x) === plate.col && ent.row === plate.row) {
            occupied = true;
            this.triggerPlate(room.id, plate.col, plate.row, audio, onEvent);
          }
        }
        if (!occupied) {
          plate.wasOccupied = false;
          if (plate.pressTimer > 0) {
            plate.pressTimer -= dt;
          } else {
            plate.pressed = false;
          }
        }
      }

      // Gates
      for (const g of room.gates) {
        if (g.targetOpen > 0.5 && !g.stayOpen && g.timer > 0) {
          const prevSec = Math.ceil(g.timer);
          g.timer -= dt;
          const nextSec = Math.ceil(g.timer);
          if (g.timer > 0 && g.timer <= 3.0 && nextSec < prevSec) {
            audio?.play('gateTick');
          }
          if (g.timer <= 0) {
            g.targetOpen = 0;
            audio?.play('gate');
          }
        }
        if (g.openAmount < g.targetOpen) {
          g.openAmount = Math.min(1, g.openAmount + dt * 2.2);
        } else if (g.openAmount > g.targetOpen) {
          g.openAmount = Math.max(0, g.openAmount - dt * 0.65);
        }
      }

      // Exits
      for (const ex of room.exits) {
        if (ex.isOpen && ex.openAmount < 1) {
          ex.openAmount = Math.min(1, ex.openAmount + dt * 1.4);
        }
      }

      // Rhythmic beam shutter audio when player is in this room
      const playerEnt = entities[0];
      if (playerEnt && playerEnt.roomId === room.id) {
        for (const s of room.slicers.values()) {
          const st = this.getSlicerState(room.id, s.col, s.row, time);
          if (st.closed && !s.wasClosed) {
            audio?.play('slicer');
          }
          s.wasClosed = st.closed;
        }
      }

      // Dynamic proximity spikes: spring up with a metallic click when an entity rushes near,
      // stay retracted for careful steps, and retract slowly once clear.
      for (const sp of room.spikes.values()) {
        let threat = false;
        const sx = tileCenterX(sp.col);
        for (const ent of entities) {
          if (!ent || !ent.alive || ent.roomId !== room.id || ent.row !== sp.row) continue;
          const dx = Math.abs(ent.x - sx);
          const fast = ent.state === 'run' || ent.state === 'run_start' || ent.state === 'skid' ||
            ent.state === 'run_turn' || ent.state === 'fall' || ent.state === 'combat_hit';
          if (dx < 36 && fast) {
            threat = true;
            break;
          }
        }
        if (sp.triggered || threat) {
          if (!sp.snapped && sp.extended < 0.7 && playerEnt && playerEnt.roomId === room.id) {
            audio?.play('spike');
            sp.snapped = true;
          }
          sp.extended = Math.min(1.0, sp.extended + dt * 9.0);
        } else {
          if (sp.extended > 0.26) {
            sp.extended = Math.max(0.26, sp.extended - dt * 1.4);
          }
          if (sp.extended <= 0.35) sp.snapped = false;
        }
      }
    }

    // 2. Update falling debris (hits entities, triggers plates, breaks loose floors)
    for (let i = this.fallingDebris.length - 1; i >= 0; i--) {
      const d = this.fallingDebris[i];
      d.vy = Math.min(280, d.vy + 460 * dt);
      const prevY = d.y;
      d.y += d.vy * dt;

      // Room transition down
      if (d.y > PLAY_H) {
        const room = this.rooms.get(d.roomId);
        if (room && room.links.down !== null) {
          d.roomId = room.links.down;
          d.y -= PLAY_H;
          d.startRow = -1;
        } else {
          this.fallingDebris.splice(i, 1);
          continue;
        }
      }

      // Check collision with entities strictly below the tile that broke
      const fallenEnough = d.startRow < 0 || d.y > floorY(d.startRow) + 22;
      if (fallenEnough) {
        for (const ent of entities) {
          if (!ent || !ent.alive || ent.roomId !== d.roomId) continue;
          if (Math.abs(ent.x - d.x) < 13 && d.y >= ent.y - 28 && prevY <= ent.y) {
            ent.takeDamage?.(1, 'debris');
            this.spawnParticles(d.roomId, d.x, ent.y - 16, 8, '#a09888', 60, 0.4, 2);
            this.fallingDebris.splice(i, 1);
            d._removed = true;
            break;
          }
        }
      }
      if (d._removed) continue;

      // Check landing on a floor tile
      for (let r = 0; r < ROWS; r++) {
        if (r <= d.startRow) continue;
        const fy = floorY(r);
        if (prevY < fy && d.y >= fy) {
          const ch = this.getTile(d.roomId, d.col, r);
          if (ch === 'L') {
            this.triggerLooseFloor(d.roomId, d.col, r, audio);
            this.spawnParticles(d.roomId, d.x, fy, 8, '#9b9586', 55, 0.4, 2);
            this.fallingDebris.splice(i, 1);
            break;
          } else if (isWalkableBaseTile(ch) || ch === '#') {
            if (ch === 'P' || ch === 'Q') {
              this.triggerPlate(d.roomId, d.col, r, audio, onEvent);
            }
            audio?.play('land');
            this.spawnParticles(d.roomId, d.x, fy, 10, '#9b9586', 65, 0.45, 2);
            this.fallingDebris.splice(i, 1);
            break;
          }
        }
      }
    }

    // 3. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 150 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}
