import { drawText, textWidth } from './font';
import { PAL } from './palette';
import type { Screen } from '@/engine/canvas';

export interface HudData {
  shipName: string;
  speed: number;        // world units / s
  maxSpeed: number;
  lap: number; laps: number;
  time: number;         // seconds, current lap
  bestLap: number | null;
  energy: number;       // 0..1
  item: string | null;
  position: number; total: number;
  shield: number; turbo: number;
  fps: number;
}

const fmtTime = (t: number): string => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t % 1) * 100);
  return `${m}'${String(s).padStart(2, '0')}"${String(ms).padStart(2, '0')}`;
};

export function drawHud(screen: Screen, d: HudData): void {
  const { ctx, width, height } = screen;
  ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
  const S = 3; // font scale
  // Top-left: lap and time
  drawText(ctx, `LAP ${d.lap}/${d.laps}`, 16, 14, S, PAL.yellow);
  drawText(ctx, fmtTime(d.time), 16, 14 + 7 * S, S, PAL.white);
  if (d.bestLap !== null) drawText(ctx, `BEST ${fmtTime(d.bestLap)}`, 16, 14 + 14 * S, S, PAL.silver);
  // Position, big, under the lap counter.
  const pos = `${d.position}`;
  drawText(ctx, pos, 16, 14 + 22 * S, 8, d.position === 1 ? PAL.yellow : PAL.white);
  drawText(ctx, `/${d.total}`, 16 + textWidth(pos, 8) + 4, 14 + 22 * S + 15, 3, PAL.silver);
  // Top-right: ship + fps
  const name = d.shipName;
  drawText(ctx, name, width - 16 - textWidth(name, S), 14, S, PAL.cyan);
  drawText(ctx, `${d.fps} FPS`, width - 16 - textWidth(`${d.fps} FPS`, 2), 14 + 7 * S, 2, PAL.grey);
  // Bottom-left: energy bar
  const bw = 180, bh = 12, bx = 16, by = height - 16 - bh;
  ctx.fillStyle = PAL.black; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = d.energy > 0.3 ? PAL.green : PAL.red; ctx.fillRect(bx, by, Math.round(bw * d.energy), bh);
  drawText(ctx, 'ENERGY', bx, by - 7 * 2 - 4, 2, PAL.silver);
  // Bottom-right: speed readout + bar
  const kmh = Math.round(d.speed * 0.6);
  const txt = `${kmh}`;
  drawText(ctx, txt, width - 16 - textWidth(txt, 5), height - 16 - 5 * 5 - 18, 5, PAL.white);
  drawText(ctx, 'KM/H', width - 16 - textWidth('KM/H', 2), height - 16 - 10 - 2, 2, PAL.silver);
  const sw = 180, sx = width - 16 - sw, sy = height - 16 - 5 * 5 - 30;
  ctx.fillStyle = PAL.black; ctx.fillRect(sx - 2, sy - 2, sw + 4, 8);
  ctx.fillStyle = PAL.cyan; ctx.fillRect(sx, sy, Math.round(sw * Math.min(1, d.speed / d.maxSpeed)), 4);
  // Bottom-centre: item slot
  const slot = 48, cx = width / 2 - slot / 2, cy = height - 16 - slot;
  ctx.fillStyle = PAL.black; ctx.fillRect(cx - 2, cy - 2, slot + 4, slot + 4);
  ctx.fillStyle = PAL.navy; ctx.fillRect(cx, cy, slot, slot);
  if (d.item) { drawItemIcon(ctx, d.item, cx, cy, slot); drawText(ctx, d.item, width / 2 - textWidth(d.item, 2) / 2, cy + slot + 6, 2, PAL.yellow); }
  if (d.shield > 0) drawText(ctx, `SCUDO ${d.shield.toFixed(1)}`, width / 2 - textWidth('SCUDO 0.0', 2) / 2, cy - 14, 2, PAL.cyan);
  else if (d.turbo > 0) drawText(ctx, 'TURBO', width / 2 - textWidth('TURBO', 2) / 2, cy - 14, 2, PAL.orange);
}

/** 8-bit icon of an item in the HUD slot. */
function drawItemIcon(ctx: CanvasRenderingContext2D, item: string, x: number, y: number, size: number): void {
  const u = size / 12; // 12x12 icon grid
  const px = (c: number, r: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x + c * u, y + r * u, w * u, h * u); };
  switch (item) {
    case 'TURBO': px(2, 5, 3, 2, PAL.orange); px(5, 4, 3, 4, PAL.orange); px(8, 3, 2, 6, PAL.yellow); px(10, 5, 1, 2, PAL.white); break;
    case 'MISSILE': px(2, 5, 7, 2, PAL.silver); px(9, 4, 2, 4, PAL.red); px(1, 4, 1, 1, PAL.silver); px(1, 7, 1, 1, PAL.silver); px(0, 5, 2, 2, PAL.orange); break;
    case 'ROCKETS': for (const r of [2, 5, 8]) { px(3, r, 5, 2, PAL.silver); px(8, r, 2, 2, PAL.yellow); px(1, r, 2, 2, PAL.orange); } break;
    case 'MINE': px(3, 3, 6, 6, PAL.steel); px(5, 5, 2, 2, PAL.red); px(5, 1, 2, 2, PAL.steel); px(5, 9, 2, 2, PAL.steel); px(1, 5, 2, 2, PAL.steel); px(9, 5, 2, 2, PAL.steel); break;
    case 'SCUDO': px(3, 1, 6, 1, PAL.cyan); px(2, 2, 1, 6, PAL.cyan); px(9, 2, 1, 6, PAL.cyan); px(3, 8, 1, 2, PAL.cyan); px(8, 8, 1, 2, PAL.cyan); px(4, 10, 4, 1, PAL.cyan); px(5, 4, 2, 3, PAL.white); break;
  }
}
