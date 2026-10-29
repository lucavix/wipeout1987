import { angleDiff, angleOf, dist, sub } from '@/engine/math';
import { laneAt, tileOfS, type Track } from '@/track/track';
import type { Controls } from './physics';
import type { Ship } from './ship';
import { targetAhead } from './weapons';

export interface AiState {
  /** 0..1: lookahead precision, throttle courage, reaction. */
  skill: number;
  lane: number;
  laneTimer: number;
  fire: boolean;
}

export const newAi = (skill: number, lane: number): AiState => ({ skill, lane, laneTimer: 2 + Math.random() * 4, fire: false });

/**
 * Opponent driver: follows the centreline offset to its lane, changes lane to catch speed pads or
 * dodge the ship in front, lifts for sharp bends, and decides when to use its item (`fire`).
 */
export function aiControls(ship: Ship, ai: AiState, track: Track, ships: Ship[], dt: number): Controls {
  const L = track.main.length, k = ai.skill;
  ai.fire = false;
  // Lane choice: prefer a lane with a speed pad coming up; otherwise wander now and then.
  ai.laneTimer -= dt;
  const myTile = tileOfS(ship.s);
  const padAhead = track.laneMarks.find((m) => m.kind === 'speed' && m.k0 > myTile && m.k0 < myTile + 10);
  if (padAhead && padAhead.lane !== ai.lane && ai.laneTimer < 1) { ai.lane = padAhead.lane; ai.laneTimer = 3; }
  else if (ai.laneTimer <= 0) { ai.lane = Math.floor(Math.random() * 3); ai.laneTimer = 4 + Math.random() * 6; }
  // Dodge: a ship right ahead in my lane -> shift a lane.
  const ahead = targetAhead(ship, ships, 260, 0.35);
  if (ahead && ahead.laneIdx === ai.lane && ai.laneTimer < 2.5) { ai.lane = (ai.lane + (Math.random() < 0.5 ? 1 : 2)) % 3; ai.laneTimer = 3; }

  const look = 200 + 120 * k + ship.speed * 0.12;
  const laneOff = (ai.lane - 1) * 90;
  const a = laneAt(track.main, (ship.s + look) / L);
  const b = laneAt(track.main, (ship.s + look * 2.5) / L);
  const target = { x: a.pos.x - a.dir.y * laneOff, y: a.pos.y + a.dir.x * laneOff };
  const err = angleDiff(ship.heading, angleOf(sub(target, ship.pos)));
  const bend = Math.abs(angleDiff(angleOf(a.dir), angleOf(b.dir)));
  const steer = Math.max(-1, Math.min(1, err * (1.8 + 1.2 * k)));
  const sp = ship.speed / 1500;
  const brave = 0.55 + 0.35 * k;
  const thrust = bend > 0.9 && sp > brave ? -0.3 : bend > 0.5 && sp > brave + 0.2 ? 0 : 1;
  const air = Math.abs(err) > 0.45 && sp > 0.5;

  // Items.
  if (ship.item) {
    if (ship.item === 'turbo' && bend < 0.25) ai.fire = true;
    else if ((ship.item === 'missile' || ship.item === 'rockets') && targetAhead(ship, ships, 1200, 0.3)) ai.fire = true;
    else if (ship.item === 'mines' && ships.some((o) => o !== ship && o.dead === 0 && dist(o.pos, ship.pos) < 500 && Math.abs(angleDiff(ship.heading, angleOf(sub(o.pos, ship.pos)))) > 2.4)) ai.fire = true;
    else if (ship.item === 'shield' && ship.energy < 45) ai.fire = true;
  }
  return { thrust, steer, airL: air && err < 0, airR: air && err > 0 };
}
