import { add, angleDiff, angleOf, catmullRom, dist, lerpV, mul, norm, perp, pointInPolygon, sub, type Vec2 } from '@/engine/math';
import { KERB_W, LANE_W, PIT_KERB_W, TILE_LEN, TRACK_PX } from '@/gfx/tiles';
/** Hand-traced track description (see sagarmatha.ts, altima.ts). */
export interface TrackData {
  id: string;
  name: string;
  /** Linea centrale del loop principale, chiusa (l'ultimo punto si ricongiunge al primo). */
  main: Vec2[];
  /** Corsia box: si stacca da main[from] e rientra in main[to]; i punti sono quelli intermedi. null = nessuna. */
  pit: { from: number; to: number; points: Vec2[] } | null;
  /** Salto: la pista manca tra main[from] (stacco) e main[to] (atterraggio). null = nessuno. */
  jump: { from: number; to: number } | null;
  /** Gallerie: tra main[from] e main[to] la pista e' coperta (texture scura) e puo' incrociare altri tratti. */
  tunnels?: { from: number; to: number }[];
  /** Speed pad e weapon pad: posizione come frazione t in [0,1) lungo main e corsia 0..2 (0 = sinistra). */
  speedPads: { t: number; lane: number }[];
  weaponPads: { t: number; lane: number }[];
  theme: {
    /** Texture dello sfondo fuori pista (public/textures/<ground>.png). */
    ground: string;
    /** Immagine di riferimento (tasto R): path sotto public/ e scala mondo/pixel sui due assi. */
    ref?: { src: string; sx: number; sy: number };
  };
}

/** `s`: distance along the main lane of the wall segment (undefined for pit walls). Walls far from a
 *  ship's own track position are ignored, so tracks can cross over themselves (tunnels, bridges). */
export interface Wall { a: Vec2; b: Vec2; s?: number }

/** One strip of the track cross-section. `off` is the offset of its left edge from the centreline. */
export interface Strip {
  kind: 'kerb' | 'lane';
  side: 'left' | 'right' | 'mid';
  /** Lane index 0..2 for lane strips. */
  lane: number;
  off: number;
  w: number;
  /** Lane strips: draw the cyan divider on the right edge. */
  divider: boolean;
}

/** A drivable lane: a sampled centreline with left/right boundaries and a strip profile. */
export interface Lane {
  closed: boolean;
  width: number;
  strips: Strip[];
  center: Vec2[];
  /** Unit tangent per centre sample. */
  tangent: Vec2[];
  /** Outer edges (for the fill polygon). */
  left: Vec2[];
  right: Vec2[];
  /** Inner kerb edges: what ships collide with. */
  wallLeft: Vec2[];
  wallRight: Vec2[];
  /** Cumulative length at each centre sample; cum[n] = total length (closed) */
  cum: number[];
  length: number;
  polygon: Vec2[];
  /** Polygon of the drivable lanes only (between the inner kerb edges). */
  innerPolygon: Vec2[];
}

/** Jump zone, aligned to the tile grid: tiles k0..k1 inclusive have no floor (k0 = lip, k1 = landing lip). */
export interface Jump {
  k0: number; k1: number;
  /** Distance along the lane where the floor ends / resumes. */
  s0: number; s1: number;
  polygon: Vec2[];
}

/** Pads occupy whole tiles k0 <= k < k1 of one lane. */
export interface LaneMark { lane: number; k0: number; k1: number; kind: 'speed' | 'weapon' }

export interface Track {
  data: TrackData;
  main: Lane;
  pit: Lane | null;
  jump: Jump | null;
  /** Covered tiles k0 <= k <= k1 of the main lane. */
  tunnels: { k0: number; k1: number }[];
  walls: Wall[];
  finish: { pos: Vec2; dir: Vec2; width: number };
  laneMarks: LaneMark[];
  bounds: { min: Vec2; max: Vec2 };
}

/** Shortest distance between two positions along a closed lane of length `len`. */
export const alongDist = (a: number, b: number, len: number): number => {
  const d = Math.abs(((a - b) % len + len) % len);
  return Math.min(d, len - d);
};

const SAMPLE_STEP = 20;
/** Minimum bend radius of the centrelines (must exceed half the track width). */
const MIN_RADIUS_MAIN = 280;
const MIN_RADIUS_PIT = 130;
export const TILE_WORLD = TILE_LEN * TRACK_PX; // 80
export const PAD_TILES = 2;

/** Main track profile: kerb | lane | lane | lane | kerb. */
export function mainProfile(): Strip[] {
  const half = KERB_W + LANE_W * 1.5;
  return [
    { kind: 'kerb', side: 'left', lane: -1, off: -half, w: KERB_W, divider: false },
    { kind: 'lane', side: 'mid', lane: 0, off: -half + KERB_W, w: LANE_W, divider: true },
    { kind: 'lane', side: 'mid', lane: 1, off: -half + KERB_W + LANE_W, w: LANE_W, divider: true },
    { kind: 'lane', side: 'mid', lane: 2, off: -half + KERB_W + LANE_W * 2, w: LANE_W, divider: false },
    { kind: 'kerb', side: 'right', lane: -1, off: half - KERB_W, w: KERB_W, divider: false },
  ];
}
export function pitProfile(): Strip[] {
  const half = PIT_KERB_W + LANE_W / 2;
  return [
    { kind: 'kerb', side: 'left', lane: -1, off: -half, w: PIT_KERB_W, divider: false },
    { kind: 'lane', side: 'mid', lane: 0, off: -half + PIT_KERB_W, w: LANE_W, divider: false },
    { kind: 'kerb', side: 'right', lane: -1, off: half - PIT_KERB_W, w: PIT_KERB_W, divider: false },
  ];
}

function sampleSpline(pts: Vec2[], closed: boolean, before?: Vec2, after?: Vec2, step = SAMPLE_STEP): Vec2[] {
  const out: Vec2[] = [];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const p0 = closed ? pts[(i - 1 + n) % n] : (i === 0 ? (before ?? p1) : pts[i - 1]);
    const p3 = closed ? pts[(i + 2) % n] : (i + 2 < n ? pts[i + 2] : (after ?? p2));
    const steps = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let s = 0; s < steps; s++) out.push(catmullRom(p0, p1, p2, p3, s / steps));
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Resample a polyline at a uniform spacing (closed polylines wrap around). */
function resample(pts: Vec2[], step: number, closed: boolean): Vec2[] {
  const n = pts.length;
  const segs = closed ? n : n - 1;
  let total = 0;
  for (let i = 0; i < segs; i++) total += dist(pts[i], pts[(i + 1) % n]);
  const count = Math.max(4, Math.round(total / step));
  const spacing = total / count;
  const out: Vec2[] = [];
  let i = 0, acc = 0;
  for (let k = 0; k < (closed ? count : count + 1); k++) {
    const target = k * spacing;
    while (i < segs - 1 && acc + dist(pts[i], pts[(i + 1) % n]) < target) { acc += dist(pts[i], pts[(i + 1) % n]); i++; }
    const a = pts[i], b = pts[(i + 1) % n];
    const l = dist(a, b) || 1;
    out.push(lerpV(a, b, Math.min(1, (target - acc) / l)));
  }
  if (!closed) out[out.length - 1] = pts[n - 1];
  return out;
}

/**
 * Smooth a sampled centreline until no bend is tighter than `minRadius`. Points whose local turn
 * exceeds the limit are pulled toward the midpoint of their neighbours (a fillet), then the line is
 * resampled uniformly. Endpoints of open lines stay fixed. This keeps the inner track edge from
 * folding over itself where the track width exceeds the bend radius.
 */
function limitCurvature(pts: Vec2[], step: number, minRadius: number, closed: boolean): Vec2[] {
  let p = resample(pts, step, closed);
  const maxTurn = step / minRadius;
  for (let iter = 0; iter < 400; iter++) {
    const n = p.length;
    let worst = 0;
    const next = p.map((pt, i) => {
      if (!closed && (i === 0 || i === n - 1)) return pt;
      const a = p[(i - 1 + n) % n], b = p[(i + 1) % n];
      const turn = Math.abs(angleDiff(angleOf(sub(pt, a)), angleOf(sub(b, pt))));
      worst = Math.max(worst, turn);
      if (turn <= maxTurn) return pt;
      return lerpV(pt, mul(add(a, b), 0.5), 0.5);
    });
    p = next;
    if (iter % 10 === 9) p = resample(p, step, closed);
    if (worst <= maxTurn * 1.02) break;
  }
  return resample(p, step, closed);
}

function buildLane(center: Vec2[], strips: Strip[], closed: boolean): Lane {
  const n = center.length;
  const offL = strips[0].off, offR = strips[strips.length - 1].off + strips[strips.length - 1].w;
  const kerb = strips[0].w;
  const tangent: Vec2[] = [], left: Vec2[] = [], right: Vec2[] = [], wallLeft: Vec2[] = [], wallRight: Vec2[] = [], cum: number[] = [0];
  for (let i = 0; i < n; i++) {
    const prev = center[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = center[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = norm(sub(next, prev));
    tangent.push(t);
    const nrm = perp(t); // right of travel
    left.push(add(center[i], mul(nrm, offL)));
    right.push(add(center[i], mul(nrm, offR)));
    wallLeft.push(add(center[i], mul(nrm, offL + kerb)));
    wallRight.push(add(center[i], mul(nrm, offR - kerb)));
    if (i > 0) cum.push(cum[i - 1] + dist(center[i - 1], center[i]));
  }
  const length = closed ? cum[n - 1] + dist(center[n - 1], center[0]) : cum[n - 1];
  if (closed) cum.push(length);
  // Closed lanes: repeat the first samples so the ring is closed at s=0 (the two crossing edges
  // coincide and cancel out in point-in-polygon tests); otherwise the last segment would be a gap.
  const ring = (l: Vec2[], r: Vec2[]): Vec2[] => closed ? [...l, l[0], r[0], ...[...r].reverse()] : [...l, ...[...r].reverse()];
  const polygon = ring(left, right);
  const innerPolygon = ring(wallLeft, wallRight);
  return { closed, width: offR - offL, strips, center, tangent, left, right, wallLeft, wallRight, cum, length, polygon, innerPolygon };
}

/** Position and tangent at fraction t in [0,1) along a lane's centreline. */
export function laneAt(lane: Lane, t: number): { pos: Vec2; dir: Vec2; s: number } {
  const target = ((t % 1) + 1) % 1 * lane.length;
  let i = 0;
  while (i < lane.cum.length - 2 && lane.cum[i + 1] < target) i++;
  const n = lane.center.length;
  const a = lane.center[i % n], b = lane.center[(i + 1) % n];
  const segLen = lane.cum[i + 1] - lane.cum[i] || 1;
  const f = (target - lane.cum[i]) / segLen;
  return { pos: add(a, mul(sub(b, a), f)), dir: norm(sub(b, a)), s: target };
}

function laneWalls(lane: Lane, tagS: boolean): Wall[] {
  const w: Wall[] = [];
  const n = lane.center.length;
  const segs = lane.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const s = tagS ? lane.cum[i] : undefined;
    w.push({ a: lane.wallLeft[i], b: lane.wallLeft[(i + 1) % n], s });
    w.push({ a: lane.wallRight[i], b: lane.wallRight[(i + 1) % n], s });
  }
  return w;
}

export function buildTrack(data: TrackData): Track {
  const main = buildLane(limitCurvature(sampleSpline(data.main, true), SAMPLE_STEP, MIN_RADIUS_MAIN, true), mainProfile(), true);

  const sc = data.pit;
  const n = data.main.length;
  let pit: Lane | null = null;
  if (sc) {
    const scPts = [data.main[sc.from], ...sc.points, data.main[sc.to]];
    pit = buildLane(limitCurvature(sampleSpline(scPts, false, data.main[(sc.from - 1 + n) % n], data.main[(sc.to + 1) % n], 8), 8, MIN_RADIUS_PIT, false), pitProfile(), false);
  }

  // Walls: boundary segments whose midpoint lies inside the *other* lane are openings, drop them.
  const mid = (w: Wall): Vec2 => mul(add(w.a, w.b), 0.5);
  const walls: Wall[] = pit
    ? [
      ...laneWalls(main, true).filter((w) => !pointInPolygon(mid(w), pit!.polygon)),
      ...laneWalls(pit, false).filter((w) => !pointInPolygon(mid(w), main.polygon)),
    ]
    : laneWalls(main, true);

  const finish = { pos: main.center[0], dir: main.tangent[0], width: main.width };

  const sampleIndexOf = (p: Vec2): number => {
    let best = 0, bd = Infinity;
    main.center.forEach((c, i) => { const d = dist(c, p); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  let jump: Jump | null = null;
  if (data.jump) {
    const i0 = sampleIndexOf(data.main[data.jump.from]), i1 = sampleIndexOf(data.main[data.jump.to]);
    const k0 = Math.round(main.cum[i0] / TILE_WORLD), k1 = Math.round(main.cum[i1] / TILE_WORLD) - 1;
    jump = {
      k0, k1, s0: k0 * TILE_WORLD, s1: (k1 + 1) * TILE_WORLD,
      polygon: [...main.left.slice(i0, i1 + 1), ...main.right.slice(i0, i1 + 1).reverse()],
    };
  }
  const tunnels = (data.tunnels ?? []).map((t) => ({
    k0: Math.round(main.cum[sampleIndexOf(data.main[t.from])] / TILE_WORLD),
    k1: Math.round(main.cum[sampleIndexOf(data.main[t.to])] / TILE_WORLD),
  }));

  const laneMarks: LaneMark[] = [];
  const tileOf = (t: number) => Math.round(t * main.length / TILE_WORLD);
  for (const p of data.speedPads) laneMarks.push({ lane: p.lane, k0: tileOf(p.t), k1: tileOf(p.t) + PAD_TILES, kind: 'speed' });
  for (const p of data.weaponPads) laneMarks.push({ lane: p.lane, k0: tileOf(p.t), k1: tileOf(p.t) + PAD_TILES, kind: 'weapon' });

  const xs = main.polygon.map((p) => p.x), ys = main.polygon.map((p) => p.y);
  const bounds = { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
  return { data, main, pit, jump, tunnels, walls, finish, laneMarks, bounds };
}

/** Where a point sits relative to a lane: distance along (s), signed lateral offset (d, + = right of travel), nearest sample index. */
export interface LaneHit { s: number; d: number; i: number; dist: number }

/**
 * Project `p` on the lane centreline. `hint` (previous sample index) limits the search to a window,
 * which keeps the projection from jumping to another part of the track where it passes close by;
 * if the window gives a poor match the whole lane is searched.
 */
export function projectOnLane(lane: Lane, p: Vec2, hint = -1): LaneHit {
  const n = lane.center.length, segs = lane.closed ? n : n - 1;
  const search = (from: number, to: number): LaneHit => {
    let best: LaneHit = { s: 0, d: 0, i: 0, dist: Infinity };
    for (let k = from; k < to; k++) {
      const i = ((k % segs) + segs) % segs;
      const a = lane.center[i], b = lane.center[(i + 1) % n];
      const ab = sub(b, a), l2 = ab.x * ab.x + ab.y * ab.y || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
      const q = add(a, mul(ab, t));
      const dd = dist(p, q);
      if (dd < best.dist) {
        const tan = norm(ab);
        best = { s: lane.cum[i] + t * (lane.cum[i + 1] - lane.cum[i]), d: (p.x - q.x) * -tan.y + (p.y - q.y) * tan.x, i, dist: dd };
      }
    }
    return best;
  };
  if (hint >= 0) {
    const h = search(hint - 12, hint + 12);
    if (h.dist < 300) return h;
  }
  return search(0, segs);
}

/** Lane strip index (0..2) under lateral offset d, or -1 on a kerb / outside. */
export function laneIndexAt(lane: Lane, d: number): number {
  for (const st of lane.strips) if (st.kind === 'lane' && d >= st.off && d < st.off + st.w) return st.lane;
  return -1;
}

export const tileOfS = (s: number): number => Math.floor(s / TILE_WORLD);
