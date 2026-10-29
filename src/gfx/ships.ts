/**
 * Ship roster. The sprites are PNGs in public/ships/<id>.png (nose up, transparent background),
 * loaded once at start-up by loadShips(); this file holds only the metadata.
 */
export interface ShipDef {
  id: string;
  name: string;
  /** Sprite size in pixels, read from the PNG. */
  w: number; h: number;
  /** Engine nozzle positions in sprite pixels (origin top-left), used for trail emitters. */
  engines: { x: number; y: number }[];
  trailColor: string;
  /** Handling flavour: 0..1 each. */
  stats: { speed: number; thrust: number; handling: number; shield: number };
  /** Baked sprite, set by loadShips(). */
  image: HTMLCanvasElement;
}

/** World units per sprite pixel. */
export const SHIP_PX = 1.6;

const placeholder = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e24fd1'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#06070d'; ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = '#e24fd1'; ctx.fillRect(w / 2 - 2, 2, 4, h - 4);
  return c;
};

const def = (d: Omit<ShipDef, 'image' | 'w' | 'h'>): ShipDef => ({ ...d, w: 32, h: 56, image: placeholder(32, 56) });

export const SHIPS: ShipDef[] = [
  def({ id: 'agsys', name: 'AG-SYSTEMS', trailColor: '#4fd1ff',
    engines: [{ x: 13.5, y: 60.5 }, { x: 25.0, y: 60.5 }],
    stats: { speed: 0.6, thrust: 0.85, handling: 0.8, shield: 0.6 } }),
  def({ id: 'feisar', name: 'FEISAR', trailColor: '#f2d23c',
    engines: [{ x: 10.2, y: 57.5 }, { x: 19.8, y: 57.5 }],
    stats: { speed: 0.55, thrust: 0.7, handling: 0.9, shield: 0.8 } }),
];

function loadPng(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Load every ship PNG into its ShipDef (size taken from the file). Missing files get a magenta placeholder. */
export async function loadShips(): Promise<void> {
  await Promise.all(SHIPS.map(async (s) => {
    const img = await loadPng(`${import.meta.env.BASE_URL}ships/${s.id}.png`);
    if (!img) { console.warn(`ships/${s.id}.png mancante: uso un segnaposto`); return; }
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    s.image = c; s.w = c.width; s.h = c.height;
  }));
}
