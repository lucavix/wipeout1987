/**
 * Procedural generators of the default track textures. Pure functions (x, y) -> colour, no DOM,
 * so the same code bakes tiles in the browser (fallback when a PNG is missing) and exports PNGs
 * from Node (tools/export_tiles.mjs). The PNGs in public/textures/ are the real assets: edit those.
 *
 * Tile space: x = along the direction of travel, y = across the strip (0 = outer/left edge).
 */
export const TRACK_PX = 5;                    // world units per texture pixel (was 2.5: track doubled, ships unchanged)
export const TILE_LEN = 32;                   // px along the track -> 160 world units per tile
export const KERB_PX = 22, LANE_PX = 36, PIT_KERB_PX = 12;
export const KERB_W = KERB_PX * TRACK_PX;     // 110
export const LANE_W = LANE_PX * TRACK_PX;     // 180
export const PIT_KERB_W = PIT_KERB_PX * TRACK_PX; // 60
export const BG_PX = 4;                       // world units per background pixel
export const BG_SIZE = 128;

const C = {
  void: '#06070d', deep: '#0b1a3a', panel: '#262a45', panelDark: '#1d2038', panelLight: '#30355a',
  seam: '#171a30', blue: '#1c6fff', blueHi: '#39a8ff', blueLo: '#1240a0', cyan: '#4fd1ff', cyanDim: '#2b7f9a',
  red: '#e8303a', yellow: '#f2d23c', ink: '#1a1a2e', green: '#7dff3a', greenLo: '#2fb52a', white: '#eef0f8', grey: '#6b7390',
};

export type Px = (x: number, y: number) => string | null;
export interface TileSpec { name: string; w: number; h: number; px: Px; note: string }

const noise = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

/** Lane edge rows: a 1 px half-divider on both edges, so every lane/lane boundary shows 2 px of cyan dashes. */
const laneEdge = (x: number, y: number, h: number): string | null =>
  (y === 0 || y === h - 1) ? ((x % 16) < 8 ? C.cyan : C.cyanDim) : null;

/** Uniform dark surface with a little pixel grain, neon dashes on both edges. */
const laneBase: Px = (x, y) => {
  const e = laneEdge(x, y, LANE_PX); if (e) return e;
  if (noise(x, y) < 0.03) return C.panelLight;
  if (noise(x + 7, y + 3) < 0.04) return C.panelDark;
  return C.panel;
};

const voidPx: Px = (x, y) => (x % 8 === 4 && y % 8 === 4 ? C.deep : C.void);

export const TILE_SPECS: TileSpec[] = [
  { name: 'kerb_left', w: TILE_LEN, h: KERB_PX, note: 'bordo sinistro; y=0 e\' il lato esterno. Il destro e\' lo stesso specchiato (o kerb_right.png se esiste)', px: (x, y) => {
    if (y <= 1) return C.deep;
    if (y === 2 || y === 5) return C.blue;
    if (y === 3 || y === 4) return C.blueHi;
    if (y === 6) return C.deep;
    if (y === 7) return C.red;
    if (y === 8) return C.ink;
    if (y === 9 || y === 10) return ((x >> 1) + (y >> 1)) % 2 === 0 ? C.yellow : C.ink;
    if (y === 11) return C.ink;
    if (y === 12) return (x % 6) < 3 ? C.red : C.ink;
    if (y === 13) return C.ink;
    if (y <= 16) return noise(x, y) < 0.08 ? C.panelLight : C.panelDark;
    if (y === 17) return (x % 4) === 0 ? C.yellow : C.ink;
    if (y <= 19) return C.ink;
    return C.panelDark;
  } },
  { name: 'lane', w: TILE_LEN, h: LANE_PX, note: 'corsia normale', px: laneBase },
  { name: 'speed_pad', w: TILE_LEN, h: LANE_PX, note: 'corsia con chevron verdi (acceleratore), la punta guarda +x (verso di marcia)', px: (x, y) => {
    const e = laneEdge(x, y, LANE_PX); if (e) return e;
    const dy = Math.abs(y - 17.5);
    const u = ((x + dy * 0.75) % 16 + 16) % 16;
    if (u < 3) return C.green;
    if (u < 4) return C.greenLo;
    return C.panelDark;
  } },
  { name: 'weapon_pad', w: TILE_LEN, h: LANE_PX, note: 'corsia con rombo giallo (powerup)', px: (x, y) => {
    const e = laneEdge(x, y, LANE_PX); if (e) return e;
    const ax = Math.abs(x - 15.5), ay = Math.abs(y - 17.5);
    const ring = ax + ay;
    if (ring >= 11 && ring < 14) return C.yellow;
    if ((ax < 1.5 || ay < 1.5) && ring < 9) return C.red;
    return laneBase(x, y);
  } },
  { name: 'finish', w: TILE_LEN, h: LANE_PX, note: 'traguardo: scacchiera nei primi 16 px, poi corsia', px: (x, y) => {
    const e = laneEdge(x, y, LANE_PX); if (e) return e;
    if (x < 16) return ((x >> 2) + (y >> 2)) % 2 === 0 ? C.white : C.void;
    return laneBase(x, y);
  } },
  { name: 'jump_start', w: TILE_LEN, h: LANE_PX, note: 'prima tile del salto: strisce giallo/nere (8 px) poi voragine', px: (x, y) =>
    x < 8 ? (((x + y) >> 2) % 2 === 0 ? C.yellow : C.void) : voidPx(x, y) },
  { name: 'void', w: TILE_LEN, h: LANE_PX, note: 'voragine del salto', px: voidPx },
  { name: 'jump_end', w: TILE_LEN, h: LANE_PX, note: 'ultima tile del salto: voragine poi strisce giallo/nere (8 px)', px: (x, y) =>
    x >= TILE_LEN - 8 ? (((x + y) >> 2) % 2 === 0 ? C.yellow : C.void) : voidPx(x, y) },
  { name: 'pit_lane', w: TILE_LEN, h: LANE_PX, note: 'corsia box', px: (x, y) => {
    if (y === 17 || y === 18) return (x % 12) < 6 ? C.white : C.panelDark;
    if (x % 8 === 0) return C.seam;
    return noise(x, y) < 0.05 ? C.panel : C.panelDark;
  } },
  { name: 'pit_kerb_left', w: TILE_LEN, h: PIT_KERB_PX, note: 'bordino sinistro dei box; il destro e\' specchiato', px: (x, y) => {
    if (y <= 1) return C.deep;
    if (y <= 4) return y === 3 ? C.blueHi : C.blueLo;
    if (y === 5) return C.deep;
    if (y <= 9) return (x % 8) < 4 ? C.grey : C.ink;
    return C.panelDark;
  } },
  { name: 'background', w: BG_SIZE, h: BG_SIZE, note: 'sfondo fuori pista, si ripete; 1 px = 4 unita\' mondo', px: (x, y) => {
    const n = noise(x * 3, y * 7);
    const bx = Math.floor(x / 32), by = Math.floor(y / 32);
    if (noise(bx * 11, by * 13) < 0.25) {
      const lx = x % 32, ly = y % 32;
      if (lx >= 4 && lx < 28 && ly >= 6 && ly < 26) {
        if (lx === 4 || lx === 27 || ly === 6 || ly === 25) return '#182044';
        if ((lx + ly) % 7 === 0 && noise(x, y) < 0.3) return '#1f2a5a';
        return '#0d1226';
      }
    }
    if (n < 0.006) return C.white;
    if (n < 0.012) return C.grey;
    if (n < 0.015) return C.yellow;
    if (n < 0.017) return C.cyan;
    return '#090b16';
  } },
];

/** Low-frequency, tileable (period 128) blotch noise for terrain. */
const blotch = (x: number, y: number): number => {
  const w = (v: number) => ((v % BG_SIZE) + BG_SIZE) % BG_SIZE;
  const a = noise(w(x) >> 5, w(y) >> 5), b = noise(w(x + 16) >> 4, w(y + 16) >> 4), c = noise(w(x) >> 2, w(y) >> 2);
  return a * 0.5 + b * 0.3 + c * 0.2;
};

TILE_SPECS.push(
  { name: 'tunnel', w: TILE_LEN, h: LANE_PX, note: 'corsia in galleria: asfalto scuro, luci cyan sui bordi, una lampada ogni 16 px', px: (x, y) => {
    if (y === 0 || y === LANE_PX - 1) return (x % 8) < 5 ? C.cyan : C.cyanDim;
    if (y === 1 || y === LANE_PX - 2) return '#0c1a28';
    if (x % 16 === 0 && y > 4 && y < LANE_PX - 5) return '#3a3f5a';
    if (noise(x + 3, y + 11) < 0.03) return '#1a1c2a';
    return '#101018';
  } },
  { name: 'tunnel_kerb_left', w: TILE_LEN, h: KERB_PX, note: 'bordo sinistro in galleria (cemento, neon cyan); il destro e\' specchiato', px: (x, y) => {
    if (y <= 1) return '#15161e';
    if (y === 2 || y === 3) return C.cyan;
    if (y === 4) return '#0c1a28';
    if (y <= 17) return noise(x * 5, y * 3) < 0.12 ? '#363a4a' : '#2a2d3a';
    if (y === 18) return (x % 6) < 3 ? C.yellow : C.ink;
    return '#1a1a2e';
  } },
  { name: 'ground_altima', w: BG_SIZE, h: BG_SIZE, note: 'sfondo Altima VII: colline canadesi di notte, verde scuro screziato con rocce e abeti', px: (x, y) => {
    const v = blotch(x, y), n = noise(x, y);
    if (n < 0.004) return '#3b4a3e';                 // sassi
    if (n < 0.009) return '#0a1a0c';                 // abeti
    if (v < 0.32) return '#0f2414';
    if (v < 0.5) return '#15301a';
    if (v < 0.66) return '#1b3a20';
    return '#224626';
  } },
);

/** Ground themes of the other circuits: same blotch noise, different palettes and speckles. */
const ground = (name: string, note: string, cols: [string, string, string, string], speck: [string, string]): TileSpec => ({
  name, w: BG_SIZE, h: BG_SIZE, note, px: (x, y) => {
    const v = blotch(x, y), n = noise(x, y);
    if (n < 0.004) return speck[0];
    if (n < 0.009) return speck[1];
    return v < 0.32 ? cols[0] : v < 0.5 ? cols[1] : v < 0.66 ? cols[2] : cols[3];
  },
});
TILE_SPECS.push(
  ground('ground_karbonis', 'sfondo Karbonis V: foresta giapponese di notte, verde muschio e abeti', ['#0c1f10', '#132a16', '#1a361d', '#213f22'], ['#4a5a3a', '#071308']),
  ground('ground_terramax', 'sfondo Terramax: prati tedeschi, verde chiaro con rocce', ['#2a4a1e', '#365c24', '#42702c', '#4e8034'], ['#8a8a6a', '#1e3a16']),
  ground('ground_korodera', 'sfondo Korodera: zona industriale russa, terra scura e cenere', ['#14110f', '#1d1813', '#262019', '#2e2820'], ['#5a4a3a', '#0a0806']),
  ground('ground_arridos', 'sfondo Arridos IV: deserto americano, sabbia rossa e roccia', ['#5a2a22', '#6e3628', '#834430', '#96523a'], ['#c08a60', '#3a1a14']),
  ground('ground_silverstream', 'sfondo Silverstream: ghiaccio della Groenlandia, bianco azzurro', ['#8fb4d6', '#a4c6e4', '#b8d6ee', '#cce4f6'], ['#ffffff', '#6a90b8']),
  ground('ground_firestar', 'sfondo Firestar: Marte, lava e roccia nera', ['#2a0a06', '#4a1208', '#7a2408', '#b84a10'], ['#ff9a30', '#120402']),
);

/** Optional PNGs that override a derived tile when present. */
export const OPTIONAL_TILES = ['kerb_right', 'pit_kerb_right'];
