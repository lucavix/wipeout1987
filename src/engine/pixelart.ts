/**
 * Pixel-art assets are authored as rows of characters; each character maps to a colour
 * (or null for transparent). `bake` turns them into a canvas that can be drawn with
 * drawImage at any scale/rotation while keeping crisp pixels.
 */
export type Palette = Record<string, string | null>;

export interface PixelArt {
  rows: string[];
  palette: Palette;
}

const cache = new Map<PixelArt, HTMLCanvasElement>();

export function bake(art: PixelArt): HTMLCanvasElement {
  const hit = cache.get(art);
  if (hit) return hit;
  const h = art.rows.length;
  const w = Math.max(...art.rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = art.rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = art.palette[row[x]];
      if (col === undefined) throw new Error(`pixelart: carattere '${row[x]}' senza colore in palette (riga ${y})`);
      if (col === null) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(art, c);
  return c;
}

/** Re-colour an art with a different palette (same rows). */
export const recolor = (art: PixelArt, palette: Palette): PixelArt => ({ rows: art.rows, palette });

/** Horizontal mirror helper: complete the right half from the left half (for symmetric sprites). */
export function mirrorRows(leftRows: string[]): string[] {
  return leftRows.map((r) => r + [...r].reverse().join(''));
}

/** Verify every row has the expected length — throws early with a clear message. */
export function assertSize(name: string, art: PixelArt, w: number, h: number): PixelArt {
  if (art.rows.length !== h) throw new Error(`${name}: ${art.rows.length} righe, attese ${h}`);
  art.rows.forEach((r, i) => { if (r.length !== w) throw new Error(`${name}: riga ${i} ha ${r.length} colonne, attese ${w}`); });
  return art;
}
