import { angleDiff, angleOf, sub } from '@/engine/math';
import { laneAt, type Track } from '@/track/track';
import type { Controls } from './physics';
import type { Ship } from './ship';

/**
 * Minimal line-following driver: aim at a point ahead on the centreline (offset to a chosen lane),
 * steer proportionally, lift off when the bend ahead is sharp. Used to test laps now; the phase-3
 * AI builds on it.
 */
export function autopilot(ship: Ship, track: Track, lane = 1, lookAhead = 260): Controls {
  const L = track.main.length;
  const laneOff = (lane - 1) * 90;
  const a = laneAt(track.main, (ship.s + lookAhead) / L);
  const b = laneAt(track.main, (ship.s + lookAhead * 2.5) / L);
  const target = { x: a.pos.x - a.dir.y * laneOff, y: a.pos.y + a.dir.x * laneOff };
  const want = angleOf(sub(target, ship.pos));
  const err = angleDiff(ship.heading, want);
  const bend = Math.abs(angleDiff(angleOf(a.dir), angleOf(b.dir)));
  const steer = Math.max(-1, Math.min(1, err * 2.2));
  const sp = ship.speed / 1500;
  const thrust = bend > 0.9 && sp > 0.55 ? -0.3 : bend > 0.5 && sp > 0.75 ? 0 : 1;
  return { thrust, steer, airL: err < -0.5 && sp > 0.5, airR: err > 0.5 && sp > 0.5 };
}
