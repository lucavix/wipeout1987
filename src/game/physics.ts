import { add, dot, fromAngle, len, mul, sub, type Vec2 } from '@/engine/math';
import type { Ship } from './ship';
import type { Track, Wall } from '@/track/track';
import { alongDist, laneIndexAt, projectOnLane, tileOfS } from '@/track/track';
import { pointInPolygon } from '@/engine/math';
import { randomItem } from './weapons';

/** Anti-grav handling model. All values are world units (3.75 units = 1 track texel) and seconds. */
export const PHYS = {
  maxSpeed: 1500,     // terminal speed under full thrust, u/s
  thrust: 1200,       // u/s^2
  brake: 2000,        // u/s^2 (down arrow)
  coast: 260,         // u/s^2 passive slowdown when not thrusting
  turnLow: 3.0,       // rad/s at standstill
  turnHigh: 1.7,      // rad/s at max speed
  grip: 7,            // 1/s: how fast sideways velocity is killed (lower = more drift)
  airbrakeTurn: 1.6,  // rad/s added by Z / X
  airbrakeScrub: 700, // u/s^2 speed loss while airbraking
  airbrakeGrip: 2.2,  // grip while airbraking (drifts)
  bounce: 0.35,       // wall restitution
  wallFriction: 0.88, // tangential speed kept after a wall hit
  wallDamage: 30,     // energy (%) lost by a head-on hit at max speed
  grazeDeg: 20,       // contacts shallower than this scrape: sparks, no speed loss, no damage
  grazeOutDeg: 3,     // ...velocity set parallel to the wall, tilted this much away from it
  hitThreshold: 0.08, // normal speed (fraction of maxSpeed) below which a contact is a grind, not a hit
  grindFriction: 2.5, // 1/s tangential slowdown while scraping along a wall
  padBoost: 330,      // u/s of boost given by a speed pad (+22% of the class top speed)
  turboBoost: 520,    // u/s of boost held while a turbo item burns (+35%)
  boostDecay: 0.7,    // 1/s exponential decay of the boost once the pad/turbo is over
  jumpMinSpeed: 500,  // slower than this over the gap and you fall
  jumpRespawnBack: 450, // restart this far before the gap (enough run-up to clear it again)
  fallDamage: 15,
  respawnDelay: 1.3, // seconds between the explosion and the restart
  turboRamp: 8,      // 1/s: how fast a turbo pulls the ship up to its boosted top speed
  pitRecharge: 30,   // energy per second in the pit lane
  pitSpeed: 750,     // speed cap in the pit lane
};

export interface Controls { thrust: number; steer: number; airL: boolean; airR: boolean }
export const NO_CONTROLS: Controls = { thrust: 0, steer: 0, airL: false, airR: false };

/** Uniform grid over the wall segments so each ship only tests nearby walls. */
/** How far (along the track) a main-lane wall stays active for a ship: beyond this it belongs to another
 *  part of the circuit that merely crosses or runs close by (tunnel under a bridge). */
export const WALL_REACH = 700;

export class WallGrid {
  private cells = new Map<string, Wall[]>();
  constructor(walls: Wall[], public laneLength: number, public cell = 256) {
    for (const w of walls) {
      const x0 = Math.floor(Math.min(w.a.x, w.b.x) / cell), x1 = Math.floor(Math.max(w.a.x, w.b.x) / cell);
      const y0 = Math.floor(Math.min(w.a.y, w.b.y) / cell), y1 = Math.floor(Math.max(w.a.y, w.b.y) / cell);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        let list = this.cells.get(k); if (!list) this.cells.set(k, (list = []));
        list.push(w);
      }
    }
  }
  near(p: Vec2, r: number): Wall[] {
    const out: Wall[] = [];
    const x0 = Math.floor((p.x - r) / this.cell), x1 = Math.floor((p.x + r) / this.cell);
    const y0 = Math.floor((p.y - r) / this.cell), y1 = Math.floor((p.y + r) / this.cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const l = this.cells.get(`${x},${y}`); if (l) out.push(...l); }
    return out;
  }
}

/** Speed classes of the original: Rapier is the handling tuned so far; Vector and Venom are slower and
 *  calmer, Phantom faster with sharper opponents. `mul` scales the top speed and the pad boost. */
export interface SpeedClass { id: string; name: string; mul: number; aiMin: number; aiMax: number; note: string; color: string }
export const CLASSES: SpeedClass[] = [
  { id: 'vector', name: 'VECTOR', mul: 0.7, aiMin: 0.2, aiMax: 0.55, note: 'LENTA. PER IMPARARE LA PISTA', color: '#7dff3a' },
  { id: 'venom', name: 'VENOM', mul: 0.85, aiMin: 0.3, aiMax: 0.7, note: 'VELOCE. AVVERSARI PIU\' SVEGLI', color: '#f2d23c' },
  { id: 'rapier', name: 'RAPIER', mul: 1.0, aiMin: 0.4, aiMax: 0.9, note: 'MOLTO VELOCE. LA CLASSE DI RIFERIMENTO', color: '#4fd1ff' },
  { id: 'phantom', name: 'PHANTOM', mul: 1.3, aiMin: 0.6, aiMax: 1.0, note: 'FOLLE. I MURI FANNO ANCORA PIU\' MALE', color: '#e8303a' },
];
export let speedClass: SpeedClass = CLASSES[2];
export function setSpeedClass(c: SpeedClass): void { speedClass = c; }
/** Top speed of the current class (before the per-ship stat). */
export const classMaxSpeed = (): number => PHYS.maxSpeed * speedClass.mul;

export interface StepEvents { wallHit: number; padHit: boolean; fell: boolean; landed: boolean; exploded: boolean; eliminated: boolean; pickup: boolean; graze: { pos: Vec2; dir: Vec2; n: Vec2 } | null }

/** Advance one ship by dt. Returns what happened (for sound/fx/HUD). */
export function stepShip(ship: Ship, c: Controls, track: Track, grid: WallGrid, dt: number): StepEvents {
  const ev: StepEvents = { wallHit: 0, padHit: false, fell: false, landed: false, exploded: false, eliminated: false, pickup: false, graze: null };
  const P = PHYS, st = ship.def.stats;
  ship.spawnBlink = Math.max(0, ship.spawnBlink - dt);
  ship.turbo = Math.max(0, ship.turbo - dt); ship.shield = Math.max(0, ship.shield - dt);
  if (ship.eliminated) return ev;
  if (ship.dead > 0) {
    ship.dead -= dt;
    if (ship.dead <= 0) { ship.dead = 0; ship.respawn(track, ship.respawnS); ship.spawnBlink = 1.5; }
    return ev;
  }
  /** Blow up and schedule a restart on the centreline at distance s. */
  const destroy = (s: number) => {
    ev.exploded = true;
    ship.dead = P.respawnDelay; ship.respawnS = ((s % track.main.length) + track.main.length) % track.main.length;
    ship.energy = Math.max(10, ship.energy - P.fallDamage);
    ship.vel = { x: 0, y: 0 }; ship.speed = 0; ship.airborne = false;
  };
  const maxSpeed = classMaxSpeed() * (0.85 + 0.3 * st.speed);
  const fwd = fromAngle(ship.heading);
  const side = { x: -fwd.y, y: fwd.x };
  let vf = dot(ship.vel, fwd), vs = dot(ship.vel, side);

  if (!ship.airborne) {
    // Longitudinal.
    const thrustAcc = P.thrust * (0.8 + 0.4 * st.thrust);
    if (c.thrust > 0) vf += thrustAcc * c.thrust * dt;
    else if (c.thrust < 0) vf -= P.brake * -c.thrust * dt;
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), P.coast * dt);
    if (ship.turbo > 0) {
      // Turbo item: raise the top speed and ramp the ship up to it within a few tenths of a second.
      ship.boost = Math.max(ship.boost, P.turboBoost * speedClass.mul);
      const t = maxSpeed + ship.boost;
      if (vf < t) vf += (t - vf) * Math.min(1, P.turboRamp * dt);
    } else ship.boost *= Math.exp(-P.boostDecay * dt);
    if (ship.inPit && vf > P.pitSpeed) vf -= Math.min(vf - P.pitSpeed, 2500 * dt);
    // Speed-dependent drag: terminal speed under full thrust = maxSpeed + boost; anything above is pulled down.
    const top = maxSpeed + ship.boost;
    if (vf > 0) vf -= thrustAcc * (vf / top) ** 2 * dt;
    if (vf > top) vf -= (vf - top) * Math.min(1, 3 * dt);
    if (vf < -maxSpeed * 0.2) vf = -maxSpeed * 0.2;

    // Steering: turn rate falls with speed; airbrakes add turn and scrub speed.
    const sp = Math.min(1, Math.abs(vf) / maxSpeed);
    const handling = 0.85 + 0.3 * st.handling;
    let turn = c.steer * (P.turnLow + (P.turnHigh - P.turnLow) * sp) * handling;
    let grip = P.grip;
    const air = (c.airR ? 1 : 0) - (c.airL ? 1 : 0);
    if (air !== 0) {
      turn += air * P.airbrakeTurn * handling * Math.min(1, sp * 2);
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), P.airbrakeScrub * dt);
      grip = P.airbrakeGrip;
    }
    const slow = Math.min(1, Math.abs(vf) / 150); // almost no yaw when stopped
    ship.heading += turn * dt * (0.25 + 0.75 * slow);
    // Lateral grip: sideways velocity decays.
    vs *= Math.exp(-grip * dt);
    ship.roll += ((c.steer + air * 0.6) - ship.roll) * Math.min(1, 8 * dt);
    ship.pitch += (c.thrust - ship.pitch) * Math.min(1, 6 * dt);
  } else {
    ship.roll += (0 - ship.roll) * Math.min(1, 4 * dt);
    ship.pitch += (0.4 - ship.pitch) * Math.min(1, 4 * dt);
  }

  // Recompose velocity in the (possibly rotated) ship frame and integrate.
  const nf = fromAngle(ship.heading), ns = { x: -nf.y, y: nf.x };
  ship.vel = add(mul(nf, vf), mul(ns, vs));
  ship.speed = len(ship.vel);
  // Integrate in sub-steps no longer than the collision radius so the hull can never cross a wall.
  const steps = ship.airborne ? 1 : Math.max(1, Math.ceil(ship.speed * dt / (ship.radius * 0.7)));
  for (let k = 0; k < steps; k++) {
    ship.pos = add(ship.pos, mul(ship.vel, dt / steps));
    if (!ship.airborne) resolveWalls(ship, grid, dt / steps, ev);
  }
  ship.speed = len(ship.vel);

  // Track position: lane (main or pit), s, d, lane index, tile.
  const hit = projectOnLane(track.main, ship.pos, ship.hint);
  ship.hint = hit.i; ship.s = hit.s; ship.d = hit.d;
  ship.laneIdx = laneIndexAt(track.main, hit.d);
  ship.tile = tileOfS(hit.s);
  ship.inPit = !!track.pit && hit.dist > 150 && pointInPolygon(ship.pos, track.pit.innerPolygon);
  if (ship.inPit) ship.energy = Math.min(100, ship.energy + P.pitRecharge * dt);

  // Jump: over the void tiles the ship flies (no control); too slow and it falls back to the lip.
  const j = track.jump ?? { s0: -1, s1: -1 };
  const overGap = ship.laneIdx >= 0 && ship.s > j.s0 && ship.s < j.s1 && hit.dist < track.main.width;
  if (overGap && !ship.airborne) {
    if (ship.speed < P.jumpMinSpeed) { ev.fell = true; destroy(j.s0 - P.jumpRespawnBack); return ev; }
    else { ship.airborne = true; ship.airT = 0; ship.airLen = (j.s1 - j.s0) / Math.max(1, ship.speed); }
  } else if (!overGap && ship.airborne) { ship.airborne = false; ev.landed = true; }
  if (ship.airborne) ship.airT += dt;

  // Off the track (landed outside, or slipped through a wall): destroyed, restart on the centreline.
  // Measured as lateral distance from the ship's own section of the centreline (not with the track
  // polygon, which self-intersects where a tunnel crosses under another part of the circuit).
  const innerHalf = track.main.width / 2 - track.main.strips[0].w;
  if (!ship.airborne && Math.abs(ship.d) > innerHalf + 10 && !(track.pit && pointInPolygon(ship.pos, track.pit.innerPolygon))) {
    const inGap = track.jump !== null && ship.s > j.s0 - 40 && ship.s < j.s1 + 200;
    destroy(inGap ? j.s0 - P.jumpRespawnBack : ship.s);
    return ev;
  }

  // Speed pads: whole tiles of one lane.
  if (!ship.airborne && ship.laneIdx >= 0) {
    for (const m of track.laneMarks) {
      if (m.kind !== 'speed' || m.lane !== ship.laneIdx || ship.tile < m.k0 || ship.tile >= m.k1) continue;
      if (ship.padTile !== m.k0) {
        ship.padTile = m.k0; ev.padHit = true;
        // A pad kicks the ship straight to its boosted top speed (max + padBoost), whatever it was doing.
        ship.boost = Math.max(ship.boost, P.padBoost * speedClass.mul);
        const vfNow = dot(ship.vel, nf);
        ship.vel = add(ship.vel, mul(nf, Math.max(0, maxSpeed + ship.boost - vfNow)));
      }
    }
    if (!track.laneMarks.some((m) => m.k0 === ship.padTile && ship.tile >= m.k0 && ship.tile < m.k1)) ship.padTile = -1;
    for (const m of track.laneMarks) {
      if (m.kind !== 'weapon' || m.lane !== ship.laneIdx || ship.tile < m.k0 || ship.tile >= m.k1) continue;
      if (ship.weaponTile !== m.k0 && !ship.item) { ship.weaponTile = m.k0; ship.item = randomItem(); ev.pickup = true; }
    }
    if (!track.laneMarks.some((m) => m.k0 === ship.weaponTile && ship.tile >= m.k0 && ship.tile < m.k1)) ship.weaponTile = -1;
  }

  ship.hitFlash = Math.max(0, ship.hitFlash - dt);
  if (ship.energy <= 0) { ev.exploded = true; ev.eliminated = true; ship.eliminated = true; ship.dead = 1e9; ship.vel = { x: 0, y: 0 }; ship.speed = 0; }
  return ev;
}

/** Walls: circle vs nearby segments; push out, then scrape / bounce / slide depending on the angle. */
function resolveWalls(ship: Ship, grid: WallGrid, dt: number, ev: StepEvents): void {
  const P = PHYS, r = ship.radius;
  for (const w of grid.near(ship.pos, r)) {
    if (w.s !== undefined && alongDist(w.s, ship.s, grid.laneLength) > WALL_REACH) continue;
    const ab = sub(w.b, w.a), l2 = ab.x * ab.x + ab.y * ab.y || 1;
    const t = Math.max(0, Math.min(1, ((ship.pos.x - w.a.x) * ab.x + (ship.pos.y - w.a.y) * ab.y) / l2));
    const q = add(w.a, mul(ab, t));
    const dx = ship.pos.x - q.x, dy = ship.pos.y - q.y;
    const d = Math.hypot(dx, dy);
    if (d >= r || d === 0) continue;
    const n = { x: dx / d, y: dy / d };
    ship.pos = add(ship.pos, mul(n, r - d));
    const vn = dot(ship.vel, n);
    if (vn < 0) {
      // Tangent pointing the way the ship travels.
      let tangent = { x: -n.y, y: n.x };
      let vt = dot(ship.vel, tangent);
      if (vt < 0) { tangent = { x: -tangent.x, y: -tangent.y }; vt = -vt; }
      const angle = Math.atan2(-vn, vt) * 180 / Math.PI;
      const impact = -vn / P.maxSpeed;
      ev.graze = { pos: q, dir: tangent, n }; // sparks on any contact
      if (angle < P.grazeDeg) {
        // Scrape: keep the speed, run parallel to the wall tilted slightly away from it. The nose is
        // left alone, so the ship stays pinned until the player steers off (punishing, like the original).
        const a = P.grazeOutDeg * Math.PI / 180, sp = ship.speed;
        const dir = { x: tangent.x * Math.cos(a) + n.x * Math.sin(a), y: tangent.y * Math.cos(a) + n.y * Math.sin(a) };
        ship.vel = mul(dir, sp);
      } else if (impact > P.hitThreshold) {
        // A real hit: bounce back, lose some tangential speed, take damage.
        ship.vel = add(mul(n, -vn * P.bounce), mul(tangent, vt * P.wallFriction));
        ev.wallHit = Math.max(ev.wallHit, impact);
        ship.damage(P.wallDamage * impact);
        ship.hitFlash = 0.15;
      } else {
        // Pushing slowly into the wall: slide along it.
        ship.vel = mul(tangent, vt * Math.exp(-P.grindFriction * dt));
      }
      ship.speed = len(ship.vel);
    }
  }
}


/** Ship vs ship: equal push apart, swap the normal velocity components (elastic-ish). */
export function collideShips(a: Ship, b: Ship, laneLength: number): void {
  const d = sub(b.pos, a.pos), l = len(d), min = a.radius + b.radius;
  if (l === 0 || l >= min) return;
  // On different parts of the circuit (one in a tunnel under the other): no contact.
  if (alongDist(a.s, b.s, laneLength) > WALL_REACH) return;
  const n = mul(d, 1 / l), push = (min - l) / 2;
  a.pos = sub(a.pos, mul(n, push)); b.pos = add(b.pos, mul(n, push));
  const va = dot(a.vel, n), vb = dot(b.vel, n);
  if (va - vb <= 0) return;
  const e = 0.5, ja = (vb - va) * (1 + e) / 2;
  a.vel = add(a.vel, mul(n, ja)); b.vel = sub(b.vel, mul(n, ja));
  a.speed = len(a.vel); b.speed = len(b.vel);
  a.hitFlash = b.hitFlash = 0.1;
}
