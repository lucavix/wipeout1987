/** Fullscreen canvas with crisp (nearest-neighbour) scaling. */
export interface Screen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical size in CSS pixels. */
  width: number;
  height: number;
  /** Device pixel ratio actually applied. */
  dpr: number;
}

export function createScreen(canvas: HTMLCanvasElement): Screen {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D non disponibile');
  const screen: Screen = { canvas, ctx, width: 0, height: 0, dpr: 1 };

  const resize = () => {
    screen.dpr = Math.min(window.devicePixelRatio || 1, 2);
    screen.width = window.innerWidth;
    screen.height = window.innerHeight;
    canvas.width = Math.floor(screen.width * screen.dpr);
    canvas.height = Math.floor(screen.height * screen.dpr);
    ctx.imageSmoothingEnabled = false;
  };
  window.addEventListener('resize', resize);
  resize();
  return screen;
}

/** Call at the start of each frame: resets transform to logical pixels and disables smoothing. */
export function beginFrame(s: Screen, clearColor: string): void {
  const { ctx } = s;
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = clearColor;
  ctx.fillRect(0, 0, s.width, s.height);
}
