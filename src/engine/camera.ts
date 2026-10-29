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
  /** View rotation: the ship may lean up to `tiltDeg` off "screen up" before the world turns under it;
   *  inside that band the view drifts back towards the heading at `rotLambda` (1/s, 0 = never). */
  tiltDeg: number;
  rotLambda: number;
}

export const DEFAULT_CAMERA: CameraParams = {
  zoomNear: 1.6,
  zoomFar: 0.55,
  lookAhead: 380,
  posLambda: 6,
  zoomLambda: 2.5,
  tiltDeg: 45,
  rotLambda: 1.2,
};

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class Camera {
  x = 0; y = 0; zoom = 1;
  /** Rotation applied to the world (radians). 0 = north up. */
  angle = 0;
  params: CameraParams;
  constructor(params: CameraParams = DEFAULT_CAMERA) { this.params = { ...params }; }

  snapTo(pos: Vec2, zoom: number, angle = 0): void { this.x = pos.x; this.y = pos.y; this.zoom = zoom; this.angle = angle; }

  /** Follow `pos` heading `dir` with speed fraction `s` in [0,1]. */
  follow(pos: Vec2, dir: Vec2, s: number, dt: number): void {
    const p = this.params;
    const f = clamp(s, 0, 1);
    const tx = pos.x + dir.x * p.lookAhead * f;
    const ty = pos.y + dir.y * p.lookAhead * f;
    this.x = damp(this.x, tx, p.posLambda, dt);
    this.y = damp(this.y, ty, p.posLambda, dt);
    this.zoom = damp(this.zoom, lerp(p.zoomNear, p.zoomFar, f), p.zoomLambda, dt);
    // Heading on screen: world angle + view rotation; "up" is -PI/2. Keep it within +/- tiltDeg.
    const want = -Math.PI / 2 - Math.atan2(dir.y, dir.x);           // rotation that puts the ship nose up
    const off = wrap(want - this.angle);                             // how far the ship leans off screen-up
    const tilt = p.tiltDeg * Math.PI / 180;
    if (Math.abs(off) > tilt) this.angle = wrap(this.angle + off - Math.sign(off) * tilt);
    else this.angle = wrap(this.angle + off * (1 - Math.exp(-p.rotLambda * dt)));
  }

  /** Set the canvas transform so subsequent drawing is in world units. */
  apply(s: Screen): void {
    const z = this.zoom * s.dpr;
    const c = Math.cos(this.angle) * z, sn = Math.sin(this.angle) * z;
    const cx = s.dpr * s.width / 2, cy = s.dpr * s.height / 2;
    // screen = R(angle) * (world - cam) * z + centre
    s.ctx.setTransform(c, sn, -sn, c, cx - (c * this.x - sn * this.y), cy - (sn * this.x + c * this.y));
  }

  /** World-space rectangle currently visible (bounding box of the rotated screen). */
  viewRect(s: Screen): { x: number; y: number; w: number; h: number } {
    const ac = Math.abs(Math.cos(this.angle)), as = Math.abs(Math.sin(this.angle));
    const w = (s.width * ac + s.height * as) / this.zoom, h = (s.width * as + s.height * ac) / this.zoom;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  toScreen(p: Vec2, s: Screen): Vec2 {
    const dx = (p.x - this.x) * this.zoom, dy = (p.y - this.y) * this.zoom;
    const c = Math.cos(this.angle), sn = Math.sin(this.angle);
    return { x: c * dx - sn * dy + s.width / 2, y: sn * dx + c * dy + s.height / 2 };
  }
}
