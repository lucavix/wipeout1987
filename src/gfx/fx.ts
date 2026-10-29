import type { Vec2 } from '@/engine/math';
import { PAL } from './palette';

interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; t: number }

/** 8-bit explosion: a flash, a pixel ring and a burst of square sparks/smoke. */
export class Explosion {
  t = 0;
  readonly duration = 1.1;
  private parts: Particle[] = [];
  constructor(public pos: Vec2, tint: string) {
    const colors = [PAL.white, PAL.yellow, PAL.orange, PAL.red, PAL.red, tint, PAL.grey, PAL.steel];
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 380;
      const smoke = i >= 24;
      this.parts.push({
        x: pos.x, y: pos.y, vx: Math.cos(a) * sp * (smoke ? 0.35 : 1), vy: Math.sin(a) * sp * (smoke ? 0.35 : 1),
        size: smoke ? 14 + Math.random() * 12 : 5 + Math.random() * 8,
        color: smoke ? (Math.random() < 0.5 ? PAL.grey : PAL.steel) : colors[Math.floor(Math.random() * 6)],
        life: smoke ? 0.9 + Math.random() * 0.3 : 0.35 + Math.random() * 0.5, t: 0,
      });
    }
  }
  get done(): boolean { return this.t >= this.duration; }
  update(dt: number): void {
    this.t += dt;
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.pos;
    // Flash + expanding pixel ring in the first third.
    if (this.t < 0.12) { ctx.fillStyle = PAL.white; const r = 50; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    if (this.t < 0.45) {
      const r = 20 + this.t * 320, th = 10;
      ctx.strokeStyle = this.t < 0.2 ? PAL.yellow : PAL.orange; ctx.lineWidth = th;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const px = Math.round((x + Math.cos(a) * r) / 5) * 5, py = Math.round((y + Math.sin(a) * r) / 5) * 5; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    }
    for (const p of this.parts) {
      if (p.t >= p.life) continue;
      const k = 1 - p.t / p.life;
      const s = Math.max(2, Math.round(p.size * (0.4 + 0.6 * k) / 2) * 2);
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }
}
