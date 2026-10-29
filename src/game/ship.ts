import { add, angleOf, fromAngle, type Vec2 } from '@/engine/math';
import { SHIP_PX, type ShipDef } from '@/gfx/ships';
import { Trail } from '@/gfx/trail';
import { laneAt, type Track } from '@/track/track';
import type { ItemKind } from './weapons';
import type { AiState } from './ai';

/** Sprite nose points up (-y), so the sprite rotation is heading + 90deg. */
const SPRITE_ROT = Math.PI / 2;
const DEG = Math.PI / 180;

/** Visual tilt of the hull (degrees at full input); editable from the debug panel. */
export const SHIP_TILT = { rollDeg: 35, pitchDeg: 18, yaw: 0.06 };

export class Ship {
  pos: Vec2;
  /** Direction the nose points, radians (0 = +x, PI/2 = +y i.e. down the screen). */
  heading: number;
  /** Velocity vector; `speed` is its length, cached after each physics step. */
  vel: Vec2 = { x: 0, y: 0 };
  speed = 0;
  energy = 100;
  /** Collision radius. */
  radius: number;
  /** Roll (banking) -1..1: from above the hull looks narrower, as if seen on its side. */
  roll = 0;
  /** Pitch -1..1: nose up (accelerating) or down (braking); from above the hull looks shorter. */
  pitch = 0;
  /** Over the jump gap: no control, drawn bigger with a shadow. airT / airLen = seconds in the air / expected. */
  airborne = false; airT = 0; airLen = 1;
  hitFlash = 0;
  /** Seconds left before respawning after being destroyed (0 = alive) and where to respawn. */
  dead = 0; respawnS = 0;
  /** Blink timer after a respawn. */
  spawnBlink = 0;
  /** Track-relative position from the last physics step (main lane). */
  hint = -1; s = 0; d = 0; laneIdx = -1; tile = 0; padTile = -1; weaponTile = -1;
  /** In the pit lane (recharging). */
  inPit = false;
  item: ItemKind | null = null;
  /** Seconds of turbo / shield left. */
  turbo = 0; shield = 0;
  /** Extra top speed (u/s) granted by a pad or turbo, decays over time. */
  boost = 0;
  eliminated = false;
  /** Opponent driver state (null = human). */
  ai: AiState | null = null;
  trails: Trail[];
  constructor(public def: ShipDef, pos: Vec2, heading: number) {
    this.pos = { ...pos };
    this.heading = heading;
    this.radius = def.w * SHIP_PX * 0.42;
    this.trails = def.engines.map(() => new Trail(def.trailColor));
  }

  get forward(): Vec2 { return fromAngle(this.heading); }

  /** Take damage unless shielded. */
  damage(amount: number): void {
    if (this.shield > 0 || this.dead > 0) return;
    this.energy = Math.max(0, this.energy - amount);
    this.hitFlash = Math.max(this.hitFlash, 0.15);
  }

  /** Put the ship on the main centreline at distance s, stopped. */
  respawn(track: Track, s: number): void {
    const at = laneAt(track.main, s / track.main.length);
    this.pos = { ...at.pos }; this.heading = angleOf(at.dir);
    this.vel = { x: 0, y: 0 }; this.speed = 0; this.airborne = false; this.hint = -1; this.padTile = -1; this.boost = 0; this.s = at.s;
    for (const t of this.trails) t.clear();
  }

  /** World position of engine nozzle i. */
  enginePos(i: number): Vec2 {
    const e = this.def.engines[i];
    const lx = (e.x - this.def.w / 2) * SHIP_PX, ly = (e.y - this.def.h / 2) * SHIP_PX;
    const a = this.heading + SPRITE_ROT;
    const c = Math.cos(a), s = Math.sin(a);
    return add(this.pos, { x: lx * c - ly * s, y: lx * s + ly * c });
  }

  emitTrails(now: number, intensity: number): void {
    this.trails.forEach((t, i) => { t.push(this.enginePos(i), now, intensity); t.prune(now); });
  }

  /** 0..1 height over the jump: a parabola over the expected flight time. */
  get height(): number {
    if (!this.airborne) return 0;
    const u = Math.min(1, this.airT / this.airLen);
    return 4 * u * (1 - u);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead > 0) return;
    if (this.spawnBlink > 0 && Math.floor(this.spawnBlink * 10) % 2 === 0) return;
    const img = this.def.image;
    const rot = this.heading + SPRITE_ROT + this.roll * SHIP_TILT.yaw;
    const rollA = this.roll * SHIP_TILT.rollDeg * DEG, pitchA = this.pitch * SHIP_TILT.pitchDeg * DEG;
    const lift = 1 + 0.3 * this.height;
    // Top-down projection of a banked/pitched flat hull: width * cos(roll), length * cos(pitch).
    const w = this.def.w * SHIP_PX * Math.cos(rollA) * lift, h = this.def.h * SHIP_PX * Math.cos(pitchA) * lift;
    // Nose up (pitch > 0) foreshortens from the tail, nose down from the nose: keep the engines in place.
    const shiftY = (this.def.h * SHIP_PX - h) / 2 * Math.sign(this.pitch) * 0.5;
    if (this.airborne) {
      // Drop shadow on the ground, offset with height.
      ctx.save();
      ctx.translate(this.pos.x + 18 * this.height, this.pos.y + 26 * this.height);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#000';
      ctx.fillRect(-w * 0.35, -h * 0.45, w * 0.7, h * 0.9);
      ctx.restore();
    }
    if (this.shield > 0) {
      // Pixel ring, blinking in the last second.
      if (this.shield > 1 || Math.floor(this.shield * 8) % 2 === 0) {
        const r = Math.max(w, h) * 0.62;
        ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const px = Math.round((this.pos.x + Math.cos(a) * r) / 4) * 4, py = Math.round((this.pos.y + Math.sin(a) * r) / 4) * 4; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(rot);
    ctx.drawImage(img, -w / 2, -h / 2 + shiftY, w, h);
    if (this.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, this.hitFlash * 5) * 0.7; ctx.fillStyle = '#fff';
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillRect(-w / 2, -h / 2 + shiftY, w, h);
    }
    ctx.restore();
  }
}
