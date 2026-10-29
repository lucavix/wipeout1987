import type { Ship } from './ship';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface Entry {
  ship: Ship;
  lap: number;          // laps completed
  sector: number;       // next sector gate to pass (0..SECTORS-1)
  lapStart: number;
  lapTimes: number[];
  best: number | null;
  /** Crossed the start line once (the grid sits behind it). */
  started: boolean;
  finished: boolean;
  eliminated: boolean; eliminatedAt: number;
  finishTime: number | null;
  /** Lap + fraction of the lap, for ranking. */
  progress: number;
}

export const SECTORS = 8;
export const COUNTDOWN = 3.5;

/** Lap counting with sector gates (so cutting across or reversing does not count), timers and ranking. */
export class Race {
  phase: RacePhase = 'countdown';
  time = 0;            // seconds since the race started (negative during countdown)
  entries: Entry[];
  constructor(ships: Ship[], public laps = 3, public trackLength = 1) {
    this.time = -COUNTDOWN;
    this.entries = ships.map((ship) => ({ ship, lap: 0, sector: 0, lapStart: 0, lapTimes: [], best: null, started: false, finished: false, eliminated: false, eliminatedAt: 0, finishTime: null, progress: 0 }));
  }

  get countdown(): number { return Math.max(0, -this.time); }
  get started(): boolean { return this.time >= 0; }
  entry(ship: Ship): Entry { return this.entries.find((e) => e.ship === ship)!; }
  position(ship: Ship): number { return this.ranking().findIndex((e) => e.ship === ship) + 1; }

  /** Seconds after the player is done before the race is called even if others are still running. */
  endTimer = -1;
  update(dt: number, player: Ship): void {
    if (this.phase === 'finished') return;
    this.time += dt;
    for (const e of this.entries) if (e.ship.eliminated && !e.eliminated) { e.eliminated = true; e.eliminatedAt = this.time; }
    if (this.phase === 'countdown' && this.time >= 0) this.phase = 'racing';
    if (this.phase !== 'racing') return;
    for (const e of this.entries) {
      if (e.finished || e.eliminated) continue;
      const frac = e.ship.s / this.trackLength;
      // Gate k sits at frac = k/SECTORS; it is passed while the ship is in the sector right after it.
      const after = ((frac - e.sector / SECTORS) % 1 + 1) % 1;
      if (after < 1 / SECTORS) {
        if (e.sector === 0) {
          if (!e.started) { e.started = true; e.lapStart = this.time; }
          else {
            const t = this.time - e.lapStart;
            e.lapTimes.push(t);
            e.best = e.best === null ? t : Math.min(e.best, t);
            e.lap++; e.lapStart = this.time;
            if (e.lap >= this.laps) { e.finished = true; e.finishTime = this.time; }
          }
        }
        e.sector = (e.sector + 1) % SECTORS;
      }
      e.progress = e.started ? e.lap + frac : frac - 1;
    }
    const pe = this.entry(player);
    if ((pe.finished || pe.eliminated) && this.endTimer < 0) this.endTimer = 8;
    if (this.endTimer >= 0) this.endTimer -= dt;
    if (this.entries.every((e) => e.finished || e.eliminated) || this.endTimer === 0 || (this.endTimer > -1 && this.endTimer < 0)) this.phase = 'finished';
  }

  /** Current lap time of a ship. */
  lapTime(e: Entry): number { return e.finished ? 0 : Math.max(0, this.time - e.lapStart); }

  /** Entries sorted by race position. */
  ranking(): Entry[] {
    return [...this.entries].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.eliminated && b.eliminated) return b.eliminatedAt - a.eliminatedAt;
      if (a.finished && b.finished) return a.finishTime! - b.finishTime!;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
  }
}
