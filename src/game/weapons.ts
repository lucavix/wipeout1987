import { add, angleDiff, angleOf, dist, dot, fromAngle, len, mul, sub, type Vec2 } from '@/engine/math';
import { PAL } from '@/gfx/palette';
import type { Ship } from './ship';
import type { WallGrid } from './physics';

export type ItemKind = 'turbo' | 'missile' | 'rockets' | 'mines' | 'shield';
export const ITEM_NAMES: Record<ItemKind, string> = { turbo: 'TURBO', missile: 'MISSILE', rockets: 'ROCKETS', mines: 'MINE', shield: 'SCUDO' };
const ITEM_POOL: ItemKind[] = ['turbo', 'turbo', 'missile', 'rockets', 'rockets', 'mines', 'shield'];
export const randomItem = (): ItemKind => ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];

export const WEAPONS = {
  turboTime: 1.3, turboAccel: 1500,
  shieldTime: 5,
  missileSpeed: 2300, missileTurn: 4.0, missileLife: 3.5, missileDamage: 30, missileRange: 1600,
  rocketSpeed: 2700, rocketLife: 1.4, rocketDamage: 12, rocketSpread: 0.06,
  mineLife: 25, mineArm: 1.2, mineDamage: 25,
};

export interface Projectile {
  kind: 'missile' | 'rocket' | 'mine';
  pos: Vec2; vel: Vec2; heading: number;
  owner: Ship; target: Ship | null;
  life: number; age: number; radius: number;
}

export interface WeaponEvent { kind: 'hit' | 'wall'; pos: Vec2; victim: Ship | null; projectile: Projectile }

/** Pick the nearest living ship ahead of `ship` inside a cone, for missiles and the AI. */
export function targetAhead(ship: Ship, ships: Ship[], range: number, cone = 0.6): Ship | null {
  let best: Ship | null = null, bd = range;
  for (const o of ships) {
    if (o === ship || o.dead > 0) continue;
    const d = dist(o.pos, ship.pos);
    if (d >= bd) continue;
    if (Math.abs(angleDiff(ship.heading, angleOf(sub(o.pos, ship.pos)))) > cone) continue;
    best = o; bd = d;
  }
  return best;
}

/** Use the item a ship holds. Returns the projectiles spawned (turbo/shield spawn none). */
export function useItem(ship: Ship, ships: Ship[]): Projectile[] {
  const item = ship.item; if (!item) return [];
  ship.item = null;
  const W = WEAPONS, fwd = fromAngle(ship.heading);
  const nose = add(ship.pos, mul(fwd, ship.radius + 12)), tail = sub(ship.pos, mul(fwd, ship.radius + 14));
  switch (item) {
    case 'turbo': ship.turbo = W.turboTime; return [];
    case 'shield': ship.shield = W.shieldTime; return [];
    case 'missile':
      return [{ kind: 'missile', pos: nose, vel: mul(fwd, W.missileSpeed), heading: ship.heading, owner: ship,
        target: targetAhead(ship, ships, W.missileRange), life: W.missileLife, age: 0, radius: 10 }];
    case 'rockets':
      return [-1, 0, 1].map((k) => {
        const h = ship.heading + k * W.rocketSpread;
        return { kind: 'rocket' as const, pos: add(nose, mul({ x: -fwd.y, y: fwd.x }, k * 10)), vel: fromAngle(h, W.rocketSpeed), heading: h, owner: ship, target: null, life: W.rocketLife, age: 0, radius: 7 };
      });
    case 'mines':
      return [-1, 0, 1].map((k) => ({ kind: 'mine' as const, pos: add(tail, mul({ x: -fwd.y, y: fwd.x }, k * 60)), vel: { x: 0, y: 0 }, heading: 0, owner: ship, target: null, life: W.mineLife, age: 0, radius: 14 }));
  }
}

/** Move projectiles, home missiles, resolve hits against ships and walls. Removes spent ones in place. */
export function updateProjectiles(list: Projectile[], ships: Ship[], grid: WallGrid, dt: number): WeaponEvent[] {
  const W = WEAPONS, events: WeaponEvent[] = [];
  const kill = (p: Projectile, ev: WeaponEvent) => { p.life = 0; events.push(ev); };
  for (const p of list) {
    p.age += dt; p.life -= dt;
    if (p.life <= 0) continue;
    if (p.kind === 'missile') {
      if (p.target && p.target.dead > 0) p.target = null;
      if (p.target) {
        const want = angleOf(sub(p.target.pos, p.pos));
        const e = angleDiff(p.heading, want);
        p.heading += Math.max(-W.missileTurn * dt, Math.min(W.missileTurn * dt, e));
        p.vel = fromAngle(p.heading, W.missileSpeed);
      }
    }
    if (p.kind !== 'mine') {
      p.pos = add(p.pos, mul(p.vel, dt));
      // Walls.
      for (const w of grid.near(p.pos, p.radius)) {
        const ab = sub(w.b, w.a), l2 = dot(ab, ab) || 1;
        const t = Math.max(0, Math.min(1, dot(sub(p.pos, w.a), ab) / l2));
        if (dist(p.pos, add(w.a, mul(ab, t))) < p.radius) { kill(p, { kind: 'wall', pos: p.pos, victim: null, projectile: p }); break; }
      }
      if (p.life <= 0) continue;
    }
    // Ships.
    for (const s of ships) {
      if (s.dead > 0) continue;
      if (s === p.owner && (p.kind !== 'mine' || p.age < W.mineArm)) continue;
      if (p.kind === 'mine' && p.age < W.mineArm) continue;
      if (dist(s.pos, p.pos) < s.radius + p.radius) {
        const dmg = p.kind === 'missile' ? W.missileDamage : p.kind === 'rocket' ? W.rocketDamage : W.mineDamage;
        s.damage(dmg);
        if (p.kind !== 'mine') s.vel = add(mul(s.vel, 0.7), mul(p.vel, 0.08));
        else s.vel = mul(s.vel, 0.55);
        s.speed = len(s.vel);
        kill(p, { kind: 'hit', pos: p.pos, victim: s, projectile: p });
        break;
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
  return events;
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, now: number): void {
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  if (p.kind === 'mine') {
    const blink = Math.floor(now * 6) % 2 === 0;
    ctx.fillStyle = PAL.steel; ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = PAL.slate; ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = p.age < WEAPONS.mineArm ? PAL.grey : blink ? PAL.red : PAL.darkred; ctx.fillRect(-4, -4, 8, 8);
    for (const [x, y] of [[-14, 0], [14, 0], [0, -14], [0, 14]]) { ctx.fillStyle = PAL.steel; ctx.fillRect(x - 3, y - 3, 6, 6); }
  } else {
    ctx.rotate(p.heading);
    const L = p.kind === 'missile' ? 30 : 20, Wd = p.kind === 'missile' ? 10 : 6;
    ctx.fillStyle = PAL.silver; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
    ctx.fillStyle = p.kind === 'missile' ? PAL.red : PAL.yellow; ctx.fillRect(L / 2 - 8, -Wd / 2, 8, Wd);
    const f = 10 + 8 * Math.random();
    ctx.fillStyle = PAL.orange; ctx.fillRect(-L / 2 - f, -Wd / 4, f, Wd / 2);
    ctx.fillStyle = PAL.white; ctx.fillRect(-L / 2 - f / 2, -Wd / 6, f / 2, Wd / 3);
  }
  ctx.restore();
}
