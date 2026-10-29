import type { Vec2 } from '@/engine/math';

interface TrailPoint { x: number; y: number; t: number; w: number }

/** Ribbon trail: a ring buffer of points with birth time; drawn as a fading, thinning polyline. */
export class Trail {
  private pts: TrailPoint[] = [];
  constructor(public color: string, public life = 0.9, public maxPoints = 90) {}

  /** Add an emitter sample. `intensity` in [0,2] scales width (turbo > 1). */
  push(p: Vec2, now: number, intensity: number): void {
    const last = this.pts[this.pts.length - 1];
    if (last && (last.x - p.x) ** 2 + (last.y - p.y) ** 2 < 9) return;
    this.pts.push({ x: p.x, y: p.y, t: now, w: 6 + 10 * intensity });
    if (this.pts.length > this.maxPoints) this.pts.shift();
  }

  clear(): void { this.pts.length = 0; }

  prune(now: number): void {
    while (this.pts.length && now - this.pts[0].t > this.life) this.pts.shift();
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const n = this.pts.length;
    if (n < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = this.color;
    // Draw in short chunks so width and alpha can taper along the ribbon.
    for (let i = 1; i < n; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const age = (now - b.t) / this.life;
      const k = Math.max(0, 1 - age);
      ctx.globalAlpha = k * 0.85;
      ctx.lineWidth = b.w * k;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
