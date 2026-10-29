import type { Vec2 } from '@/engine/math';
import { PAL } from '@/gfx/palette';
import * as T from '@/gfx/tiles';
import type { TileSet } from '@/gfx/tiles';
import type { Track, Lane, Strip } from './track';

let tiles: TileSet | null = null;
let bgPatterns = new Map<string, CanvasPattern>();

/** Must be called with the loaded textures before anything is drawn. */
export function setTiles(ts: TileSet): void { tiles = ts; bgPatterns = new Map(); chunksFor = null; texCache = null; }

function getTiles(): TileSet {
  if (!tiles) throw new Error('texture non caricate: chiama setTiles(await loadTiles()) prima di disegnare');
  return tiles;
}

export function drawGround(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }, ground = 'background'): void {
  let pat = bgPatterns.get(ground);
  if (!pat) {
    const t = getTiles();
    pat = ctx.createPattern(t.grounds.get(ground) ?? t.background, 'repeat')!;
    bgPatterns.set(ground, pat);
  }
  ctx.save();
  ctx.scale(T.BG_PX, T.BG_PX);
  ctx.fillStyle = pat;
  ctx.fillRect(view.x / T.BG_PX, view.y / T.BG_PX, view.w / T.BG_PX + 1, view.h / T.BG_PX + 1);
  ctx.restore();
}

/** Pick the texture for a lane strip on tile k (k = floor(distance / tile length)). One texture per tile. */
function laneTile(t: TileSet, track: Track, lane: Lane, strip: Strip, k: number): HTMLCanvasElement {
  if (lane !== track.main) return t.pit;
  const j = track.jump;
  if (j) {
    if (k === j.k0) return t.jumpStart;
    if (k === j.k1) return t.jumpEnd;
    if (k > j.k0 && k < j.k1) return t.void;
  }
  if (k === 0) return t.finish;
  for (const m of track.laneMarks) if (m.lane === strip.lane && k >= m.k0 && k < m.k1) return m.kind === 'speed' ? t.speed : t.weapon;
  return inTunnel(track, k) ? t.tunnel : t.lane;
}

const inTunnel = (track: Track, k: number): boolean => track.tunnels.some((tn) => k >= tn.k0 && k <= tn.k1);

function kerbTile(t: TileSet, lane: Lane, track: Track, strip: Strip, k: number): HTMLCanvasElement {
  if (lane === track.main) {
    if (inTunnel(track, k)) return strip.side === 'left' ? t.tunnelKerbL : t.tunnelKerbR;
    return strip.side === 'left' ? t.kerbL : t.kerbR;
  }
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
  if (strip.kind === 'kerb') return tex(kerbTile(t, lane, track, strip, k));
  return tex(laneTile(t, track, lane, strip, k));
}

/**
 * The static track is rasterised once into a single world-aligned bitmap, one pixel per TRACK_PX
 * world units (= one texel). Forward mapping: walk every lane along s and across d at half-pixel
 * steps and write the texel at that world position. Later lanes overwrite earlier ones, which gives
 * the priority: pit kerb < main kerb < pit lane < main lane.
 */
/**
 * The bitmap is split in square chunks allocated only where the track is, so a big circuit costs
 * memory in proportion to its length, not to its bounding box.
 */
const CHUNK = 256; // bitmap px per chunk side
interface Chunk { canvas: HTMLCanvasElement; img: ImageData; cx: number; cy: number }
let chunks = new Map<string, Chunk>();
let chunksFor: Track | null = null;

function chunkAt(cx: number, cy: number): Chunk {
  const key = `${cx},${cy}`;
  let c = chunks.get(key);
  if (!c) {
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK; canvas.height = CHUNK;
    c = { canvas, img: canvas.getContext('2d')!.createImageData(CHUNK, CHUNK), cx, cy };
    chunks.set(key, c);
  }
  return c;
}

function splatLane(track: Track, lane: Lane, kerbs: boolean, t: TileSet, onBridge: boolean | null = null): void {
  const isBridge = (k: number) => track.bridges.some((b) => k >= b.k0 && k <= b.k1);
  const n = lane.center.length;
  const segs = lane.closed ? n : n - 1;
  const step = T.TRACK_PX / 2;
  const tileLen = T.TILE_LEN * T.TRACK_PX;
  let cur: Chunk | null = null;
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
        if (onBridge !== null && isBridge(k) !== onBridge) continue;
        const tx = stripTex(t, track, lane, strip, k);
        const u = Math.min(tx.w - 1, Math.floor(((s - k * tileLen) / T.TRACK_PX) * (tx.w / T.TILE_LEN)));
        const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f;
        let nx = -(na.y + (nb.y - na.y) * f), ny = na.x + (nb.x - na.x) * f;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        for (let di = 0; di <= dCount; di++) {
          const d = strip.off + Math.min(strip.w - 0.01, di * step);
          const v = Math.min(tx.h - 1, Math.floor((d - strip.off) / T.TRACK_PX));
          const qx = Math.floor((px + nx * d) / T.TRACK_PX), qy = Math.floor((py + ny * d) / T.TRACK_PX);
          const cx = Math.floor(qx / CHUNK), cy = Math.floor(qy / CHUNK);
          if (!cur || cur.cx !== cx || cur.cy !== cy) cur = chunkAt(cx, cy);
          const o = ((qy - cy * CHUNK) * CHUNK + (qx - cx * CHUNK)) * 4, si4 = (v * tx.w + u) * 4;
          const out = cur.img.data;
          out[o] = tx.data[si4]; out[o + 1] = tx.data[si4 + 1]; out[o + 2] = tx.data[si4 + 2]; out[o + 3] = tx.data[si4 + 3];
        }
      }
    }
  }
}

/** Rasterise the whole track. Returns a short description of what was allocated. */
export function prerenderTrack(track: Track): string {
  const t = getTiles();
  chunks = new Map();
  chunksFor = track;
  if (track.pit) splatLane(track, track.pit, true, t);
  splatLane(track, track.main, true, t, false);
  if (track.pit) splatLane(track, track.pit, false, t);
  splatLane(track, track.main, false, t, false);
  // Bridges last, kerbs and lanes together, so they sit on top where the track crosses itself.
  if (track.bridges.length) { splatLane(track, track.main, true, t, true); splatLane(track, track.main, false, t, true); }
  for (const c of chunks.values()) c.canvas.getContext('2d')!.putImageData(c.img, 0, 0);
  return `${chunks.size} chunks of ${CHUNK}x${CHUNK} px`;
}

export function drawTrack(ctx: CanvasRenderingContext2D, track: Track, view: { x: number; y: number; w: number; h: number }): void {
  if (chunksFor !== track) prerenderTrack(track);
  const side = CHUNK * T.TRACK_PX; // world units per chunk
  const cx0 = Math.floor(view.x / side), cx1 = Math.floor((view.x + view.w) / side);
  const cy0 = Math.floor(view.y / side), cy1 = Math.floor((view.y + view.h) / side);
  ctx.imageSmoothingEnabled = false;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = chunks.get(`${cx},${cy}`);
    if (c) ctx.drawImage(c.canvas, cx * side, cy * side, side, side);
  }
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
  for (const lane of track.pit ? [track.main, track.pit] : [track.main]) {
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
  if (track.pit) strokePolyline(ctx, track.pit.center, false);
  ctx.setLineDash([]);
  ctx.fillStyle = PAL.yellow;
  for (const q of track.data.main) ctx.fillRect(q.x - 4 / zoom, q.y - 4 / zoom, 8 / zoom, 8 / zoom);
}
