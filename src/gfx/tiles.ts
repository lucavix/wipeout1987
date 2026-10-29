/**
 * Track textures. Each tile is loaded from public/textures/<name>.png; if a file is missing the
 * procedural default from tilegen.ts is baked instead (and a warning is logged).
 */
import { TILE_SPECS, type TileSpec } from './tilegen';
export * from './tilegen';

/** One texture per strip tile: every trapezoid of the track is drawn with exactly one of these. */
export interface TileSet {
  kerbL: HTMLCanvasElement; kerbR: HTMLCanvasElement;
  lane: HTMLCanvasElement; speed: HTMLCanvasElement; weapon: HTMLCanvasElement; finish: HTMLCanvasElement;
  jumpStart: HTMLCanvasElement; void: HTMLCanvasElement; jumpEnd: HTMLCanvasElement;
  pit: HTMLCanvasElement; pitKerbL: HTMLCanvasElement; pitKerbR: HTMLCanvasElement;
  background: HTMLCanvasElement;
}

export function bakeSpec(spec: TileSpec): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = spec.w; c.height = spec.h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < spec.h; y++) for (let x = 0; x < spec.w; x++) {
    const col = spec.px(x, y);
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

function flipY(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!;
  g.translate(0, src.height); g.scale(1, -1); g.drawImage(src, 0, 0);
  return c;
}

function loadPng(name: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(toCanvas(img));
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}textures/${name}.png`;
  });
}

/** Load every texture (PNG first, procedural fallback) and build the derived variants. */
export async function loadTiles(): Promise<TileSet> {
  const got = new Map<string, HTMLCanvasElement>();
  await Promise.all(TILE_SPECS.map(async (spec) => {
    const png = await loadPng(spec.name);
    if (png) {
      if (png.width !== spec.w || png.height !== spec.h) console.warn(`textures/${spec.name}.png e' ${png.width}x${png.height}, attesi ${spec.w}x${spec.h}`);
      got.set(spec.name, png);
    } else {
      console.warn(`textures/${spec.name}.png mancante: uso la versione procedurale`);
      got.set(spec.name, bakeSpec(spec));
    }
  }));
  const kerbR = await loadPng('kerb_right');
  const pitKerbR = await loadPng('pit_kerb_right');
  const g = (n: string) => got.get(n)!;
  return {
    kerbL: g('kerb_left'), kerbR: kerbR ?? flipY(g('kerb_left')),
    lane: g('lane'), speed: g('speed_pad'), weapon: g('weapon_pad'), finish: g('finish'),
    jumpStart: g('jump_start'), void: g('void'), jumpEnd: g('jump_end'),
    pit: g('pit_lane'), pitKerbL: g('pit_kerb_left'), pitKerbR: pitKerbR ?? flipY(g('pit_kerb_left')),
    background: g('background'),
  };
}
