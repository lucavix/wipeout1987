import { clamp, damp, lerp, type Vec2 } from './math';
import type { Screen } from './canvas';

export interface CameraParams {
  /** Zoom (screen px per world unit) when standing still / at full speed. */
  zoomNear: number;
  zoomFar: number;
  /** How far ahead of the ship the camera looks at full speed, world units. */
  lookAhead: number;
  /** Smoothing rates (1/s). */
  posLambda: number;
  zoomLambda: number;
}

export const DEFAULT_CAMERA: CameraParams = {
  zoomNear: 1.6,
  zoomFar: 0.55,
  lookAhead: 380,
  posLambda: 6,
  zoomLambda: 2.5,
};

export class Camera {
  x = 0; y = 0; zoom = 1;
  params: CameraParams;
  constructor(params: CameraParams = DEFAULT_CAMERA) { this.params = { ...params }; }

  snapTo(pos: Vec2, zoom: number): void { this.x = pos.x; this.y = pos.y; this.zoom = zoom; }

  /** Follow `pos` heading `dir` with speed fraction `s` in [0,1]. */
  follow(pos: Vec2, dir: Vec2, s: number, dt: number): void {
    const p = this.params;
    const f = clamp(s, 0, 1);
    const tx = pos.x + dir.x * p.lookAhead * f;
    const ty = pos.y + dir.y * p.lookAhead * f;
    this.x = damp(this.x, tx, p.posLambda, dt);
    this.y = damp(this.y, ty, p.posLambda, dt);
    this.zoom = damp(this.zoom, lerp(p.zoomNear, p.zoomFar, f), p.zoomLambda, dt);
  }

  /** Set the canvas transform so subsequent drawing is in world units. */
  apply(s: Screen): void {
    const z = this.zoom * s.dpr;
    s.ctx.setTransform(z, 0, 0, z, s.dpr * s.width / 2 - this.x * z, s.dpr * s.height / 2 - this.y * z);
  }

  /** World-space rectangle currently visible. */
  viewRect(s: Screen): { x: number; y: number; w: number; h: number } {
    const w = s.width / this.zoom, h = s.height / this.zoom;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  toScreen(p: Vec2, s: Screen): Vec2 {
    return { x: (p.x - this.x) * this.zoom + s.width / 2, y: (p.y - this.y) * this.zoom + s.height / 2 };
  }
}
