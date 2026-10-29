import type { Vec2 } from '@/engine/math';
import { PAL } from '@/gfx/palette';
import * as T from '@/gfx/tiles';
import type { TileSet } from '@/gfx/tiles';
import type { Track, Lane, Strip } from './track';

let tiles: TileSet | null = null;
let bgPattern: CanvasPattern | null = null;

/** Must be called with the loaded textures before anything is drawn. */
export function setTiles(ts: TileSet): void { tiles = ts; bgPattern = null; bitmapFor = null; texCache = null; }

function getTiles(): TileSet {
  if (!tiles) throw new Error('texture non caricate: chiama setTiles(await loadTiles()) prima di disegnare');
  return tiles;
}

export function drawGround(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }): void {
  if (!bgPattern) bgPattern = ctx.createPattern(getTiles().background, 'repeat')!;
  ctx.save();
  ctx.scale(T.BG_PX, T.BG_PX);
  ctx.fillStyle = bgPattern;
  ctx.fillRect(view.x / T.BG_PX, view.y / T.BG_PX, view.w / T.BG_PX + 1, view.h / T.BG_PX + 1);
  ctx.restore();
}

/** Pick the texture for a lane strip on tile k (k = floor(distance / tile length)). One texture per tile. */
function laneTile(t: TileSet, track: Track, lane: Lane, strip: Strip, k: number): HTMLCanvasElement {
  if (lane !== track.main) return t.pit;
  const j = track.jump;
  if (k === j.k0) return t.jumpStart;
  if (k === j.k1) return t.jumpEnd;
  if (k > j.k0 && k < j.k1) return t.void;
  if (k === 0) return t.finish;
  for (const m of track.laneMarks) if (m.lane === strip.lane && k >= m.k0 && k < m.k1) return m.kind === 'speed' ? t.speed : t.weapon;
  return t.lane;
}

function kerbTile(t: TileSet, lane: Lane, track: Track, strip: Strip): HTMLCanvasElement {
  if (lane === track.main) return strip.side === 'left' ? t.kerbL : t.kerbR;
  return strip.side === 'left' ? t.pitKerbL : t.pitKerbR;
}

// ---------------------------------------------------------------------------------------------
// Software rasteriser: every chunk pixel is mapped to track coordinates (s along, d across) and
// sampled from the matching texel. No triangles, no clipping, no antialiasing seams.

interface Tex { w: number; h: number; data: Uint8ClampedArray }
const texOf = (c: HTMLCanvasElement): Tex => ({ w: c.width, h: c.height, data: c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data });
let texCache: Map<HTMLCanvasElement, Tex> | null = null;
function tex(c: HTMLCanvasElement): Tex {
  if (!texCache) texCache = new Map();
  let t = texCache.get(c);
  if (!t) { t = texOf(c); texCache.set(c, t); }
  return t;
}

/** Texture for (strip, tile k) of a lane, as raw pixels. */
function stripTex(t: TileSet, track: Track, lane: Lane, strip: Strip, k: number): Tex {
  if (strip.kind === 'kerb') return tex(kerbTile(t, lane, track, strip));
  return tex(laneTile(t, track, lane, strip, k));
}

/**
 * The static track is rasterised once into a single world-aligned bitmap, one pixel per TRACK_PX
 * world units (= one texel). Forward mapping: walk every lane along s and across d at half-pixel
 * steps and write the texel at that world position. Later lanes overwrite earlier ones, which gives
 * the priority: pit kerb < main kerb < pit lane < main lane.
 */
let bitmap: { canvas: HTMLCanvasElement; img: ImageData; x: number; y: number; w: number; h: number } | null = null;
let bitmapFor: Track | null = null;

function splatLane(track: Track, lane: Lane, kerbs: boolean, t: TileSet): void {
  const bm = bitmap!;
  const out = bm.img.data;
  const n = lane.center.length;
  const segs = lane.closed ? n : n - 1;
  const step = T.TRACK_PX / 2;
  const tileLen = T.TILE_LEN * T.TRACK_PX;
  for (const strip of lane.strips) {
    if ((strip.kind === 'kerb') !== kerbs) continue;
    const dCount = Math.ceil(strip.w / step);
    for (let i = 0; i < segs; i++) {
      const a = lane.center[i], b = lane.center[(i + 1) % n];
      const na = lane.tangent[i], nb = lane.tangent[(i + 1) % n];
      const segLen = lane.cum[i + 1] - lane.cum[i];
      const sCount = Math.max(1, Math.ceil(segLen / step));
      for (let si = 0; si < sCount; si++) {
        const f = si / sCount;
        const s = lane.cum[i] + f * segLen;
        const k = Math.floor(s / tileLen);
        const tx = stripTex(t, track, lane, strip, k);
        const u = Math.min(tx.w - 1, Math.floor(((s - k * tileLen) / T.TRACK_PX) * (tx.w / T.TILE_LEN)));
        const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f;
        let nx = -(na.y + (nb.y - na.y) * f), ny = na.x + (nb.x - na.x) * f;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        for (let di = 0; di <= dCount; di++) {
          const d = strip.off + Math.min(strip.w - 0.01, di * step);
          const v = Math.min(tx.h - 1, Math.floor((d - strip.off) / T.TRACK_PX));
          const qx = Math.floor((px + nx * d - bm.x) / T.TRACK_PX), qy = Math.floor((py + ny * d - bm.y) / T.TRACK_PX);
          if (qx < 0 || qy < 0 || qx >= bm.w || qy >= bm.h) continue;
          const o = (qy * bm.w + qx) * 4, si4 = (v * tx.w + u) * 4;
          out[o] = tx.data[si4]; out[o + 1] = tx.data[si4 + 1]; out[o + 2] = tx.data[si4 + 2]; out[o + 3] = tx.data[si4 + 3];
        }
      }
    }
  }
}

/** Rasterise the whole track. Returns the bitmap size in pixels. */
export function prerenderTrack(track: Track): string {
  const t = getTiles();
  const b = track.bounds;
  const margin = 100;
  const x = Math.floor((b.min.x - margin) / T.TRACK_PX) * T.TRACK_PX, y = Math.floor((b.min.y - margin) / T.TRACK_PX) * T.TRACK_PX;
  const w = Math.ceil((b.max.x + margin - x) / T.TRACK_PX), h = Math.ceil((b.max.y + margin - y) / T.TRACK_PX);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d')!;
  bitmap = { canvas, img: g.createImageData(w, h), x, y, w, h };
  bitmapFor = track;
  splatLane(track, track.pit, true, t);
  splatLane(track, track.main, true, t);
  splatLane(track, track.pit, false, t);
  splatLane(track, track.main, false, t);
  g.putImageData(bitmap.img, 0, 0);
  return `${w}x${h}`;
}

export function drawTrack(ctx: CanvasRenderingContext2D, track: Track, view: { x: number; y: number; w: number; h: number }): void {
  if (bitmapFor !== track || !bitmap) prerenderTrack(track);
  const bm = bitmap!;
  // Only the visible part of the bitmap, cut on whole source pixels so the pixel grid never shifts.
  const sx0 = Math.max(0, Math.floor((view.x - bm.x) / T.TRACK_PX)), sy0 = Math.max(0, Math.floor((view.y - bm.y) / T.TRACK_PX));
  const sx1 = Math.min(bm.w, Math.ceil((view.x + view.w - bm.x) / T.TRACK_PX)), sy1 = Math.min(bm.h, Math.ceil((view.y + view.h - bm.y) / T.TRACK_PX));
  if (sx1 <= sx0 || sy1 <= sy0) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bm.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0, bm.x + sx0 * T.TRACK_PX, bm.y + sy0 * T.TRACK_PX, (sx1 - sx0) * T.TRACK_PX, (sy1 - sy0) * T.TRACK_PX);
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: Vec2[], closed: boolean): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
}

/** Debug: outline of every strip (the 5 "parallelepipeds") and of every tile slice along the track. */
export function drawStripOutlines(ctx: CanvasRenderingContext2D, track: Track, zoom: number, view: { x: number; y: number; w: number; h: number }): void {
  const vx0 = view.x - 200, vy0 = view.y - 200, vx1 = view.x + view.w + 200, vy1 = view.y + view.h + 200;
  for (const lane of [track.main, track.pit]) {
    const n = lane.center.length;
    const edges: number[] = [lane.strips[0].off, ...lane.strips.map((s) => s.off + s.w)];
    ctx.lineWidth = 1.5 / zoom;
    // long edges of each strip
    ctx.strokeStyle = PAL.magenta;
    for (const off of edges) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const p = lane.center[i], nx = -lane.tangent[i].y, ny = lane.tangent[i].x;
        const x = p.x + nx * off, y = p.y + ny * off;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      if (lane.closed) ctx.closePath();
      ctx.stroke();
    }
    // cross lines at every tile boundary (TILE_LEN px along = 80 world units)
    ctx.strokeStyle = PAL.orange;
    const tileLen = T.TILE_LEN * T.TRACK_PX;
    let nextS = 0;
    for (let i = 0; i < n; i++) {
      if (lane.cum[i] < nextS) continue;
      nextS = Math.floor(lane.cum[i] / tileLen) * tileLen + tileLen;
      const p = lane.center[i];
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const nx = -lane.tangent[i].y, ny = lane.tangent[i].x;
      ctx.beginPath();
      ctx.moveTo(p.x + nx * edges[0], p.y + ny * edges[0]);
      ctx.lineTo(p.x + nx * edges[edges.length - 1], p.y + ny * edges[edges.length - 1]);
      ctx.stroke();
    }
  }
}

/** Debug: walls as thin cyan lines and the centreline as a dotted magenta line. */
export function drawTrackDebug(ctx: CanvasRenderingContext2D, track: Track, zoom: number): void {
  ctx.lineWidth = 2 / zoom;
  ctx.strokeStyle = PAL.cyan;
  for (const w of track.walls) { ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke(); }
  ctx.strokeStyle = PAL.magenta; ctx.setLineDash([10 / zoom, 10 / zoom]);
  strokePolyline(ctx, track.main.center, true);
  strokePolyline(ctx, track.pit.center, false);
  ctx.setLineDash([]);
  ctx.fillStyle = PAL.yellow;
  for (const q of track.data.main) ctx.fillRect(q.x - 4 / zoom, q.y - 4 / zoom, 8 / zoom, 8 / zoom);
}
