import { createScreen, beginFrame } from '@/engine/canvas';
import { initInput, endInputFrame, pressed, down, axis } from '@/engine/input';
import { Camera } from '@/engine/camera';
import { add, mul, perp, angleOf } from '@/engine/math';
import { bake } from '@/engine/pixelart';
import { buildTrack } from '@/track/track';
import { SAGARMATHA } from '@/track/sagarmatha';
import { drawGround, drawTrack, drawTrackDebug, drawStripOutlines, prerenderTrack, setTiles } from '@/track/trackRender';
import { PAL } from '@/gfx/palette';
import { loadTiles } from '@/gfx/tiles';
import { SHIPS, type ShipDef } from '@/gfx/ships';
import { drawHud } from '@/gfx/hud';
import { drawText, textWidth } from '@/gfx/font';
import { Ship, SHIP_TILT } from '@/game/ship';
import { PHYS, NO_CONTROLS, WallGrid, collideShips, stepShip, type Controls } from '@/game/physics';
import { Race } from '@/game/race';
import { autopilot } from '@/game/autopilot';
import { aiControls, newAi } from '@/game/ai';
import { ITEM_NAMES, drawProjectile, updateProjectiles, useItem, type Projectile } from '@/game/weapons';
import { Explosion, Sparks } from '@/gfx/fx';
import { DebugPanel } from '@/game/debug';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const screen = createScreen(canvas);
initInput();

const track = buildTrack(SAGARMATHA);
setTiles(await loadTiles());
{ const t0 = performance.now(); const size = prerenderTrack(track); console.log(`track prerender: ${size} px in ${Math.round(performance.now() - t0)} ms`); }
const camera = new Camera();

// ---- Start grid: 8 ships behind the finish line, two columns, staggered.
const gridPos = (i: number) => {
  const f = track.finish;
  const row = Math.floor(i / 2), col = i % 2;
  const back = 160 + row * 160 + col * 70;
  const side = (col === 0 ? -1 : 1) * 90;
  return add(add(f.pos, mul(f.dir, -back)), mul(perp(f.dir), side));
};
/** Field size. Only 2 sprites exist for now, so the rest are clones ("II", "III") until the artist delivers the others. */
const FIELD = 4;
const ROMAN = ['', ' II', ' III', ' IV'];
const fieldDefs: ShipDef[] = Array.from({ length: FIELD }, (_, i) => {
  const base = SHIPS[i % SHIPS.length], gen = Math.floor(i / SHIPS.length);
  return gen === 0 ? base : { ...base, id: `${base.id}${gen + 1}`, name: `${base.name}${ROMAN[gen]}` };
});
const ships: Ship[] = fieldDefs.map((def, i) => new Ship(def, gridPos(i), angleOf(track.finish.dir)));
let player = ships[0];
const wallGrid = new WallGrid(track.walls);
let race = new Race(ships, 3, track.main.length);
const LAPS = 3;
/** Autopilot per ship (A toggles it for the player). */
const auto = new Set<Ship>();
let fx: Explosion[] = [];
const sparks = new Sparks();
const projectiles: Projectile[] = [];
const stats = { graze: 0, hits: 0, explosions: 0, shots: 0, weaponHits: 0 };
type Mode = 'select' | 'race';
let mode: Mode = 'select';
let selectIdx = 0;
const newRace = (playerIdx = ships.indexOf(player)) => {
  // The chosen ship starts from the back of the grid; opponents get an AI driver with varied skill.
  const order = [...ships.filter((_, i) => i !== playerIdx), ships[playerIdx]];
  order.forEach((s, i) => {
    s.respawn(track, 0); s.pos = gridPos(i); s.heading = angleOf(track.finish.dir);
    s.energy = 100; s.item = null; s.turbo = s.shield = 0; s.eliminated = false; s.dead = 0;
    s.ai = s === ships[playerIdx] ? null : newAi(0.35 + Math.random() * 0.6, i % 3);
  });
  player = ships[playerIdx];
  projectiles.length = 0; fx = [];
  race = new Race(ships, LAPS, track.main.length);
  mode = 'race';
  camera.snapTo(player.pos, camera.params.zoomNear);
};

const refImg = new Image(); refImg.src = `${import.meta.env.BASE_URL}ref/sagarmatha.png`;
const styleImg = new Image(); styleImg.src = `${import.meta.env.BASE_URL}ref/pista.jpeg`;
let showStyle = false;
let showRef = false, showDebug = false, showSheet = false, freeCam = false, showStrips = false, paused = false;
let now = 0;

const panel = new DebugPanel()
  .add({ obj: camera.params as unknown as Record<string, number>, key: 'zoomNear', min: 0.3, max: 3 })
  .add({ obj: camera.params as unknown as Record<string, number>, key: 'zoomFar', min: 0.2, max: 2 })
  .add({ obj: camera.params as unknown as Record<string, number>, key: 'lookAhead', min: 0, max: 800 })
  .add({ obj: camera.params as unknown as Record<string, number>, key: 'posLambda', min: 1, max: 20 })
  .add({ obj: camera.params as unknown as Record<string, number>, key: 'zoomLambda', min: 0.5, max: 10 })
  .add({ obj: PHYS, key: 'maxSpeed', min: 300, max: 3000 })
  .add({ obj: PHYS, key: 'thrust', min: 200, max: 3000 })
  .add({ obj: PHYS, key: 'turnLow', min: 0.5, max: 6 })
  .add({ obj: PHYS, key: 'turnHigh', min: 0.5, max: 6 })
  .add({ obj: PHYS, key: 'grip', min: 0.5, max: 20 })
  .add({ obj: PHYS, key: 'airbrakeTurn', min: 0, max: 4 })
  .add({ obj: PHYS, key: 'airbrakeGrip', min: 0.5, max: 10 })
  .add({ obj: PHYS, key: 'bounce', min: 0, max: 1 })
  .add({ obj: PHYS, key: 'grazeDeg', min: 0, max: 60 })
  .add({ obj: PHYS, key: 'grazeOutDeg', min: 0, max: 15 })
  .add({ obj: PHYS, key: 'padBoost', min: 0, max: 1200 })
  .add({ obj: SHIP_TILT, key: 'rollDeg', min: 0, max: 85 })
  .add({ obj: SHIP_TILT, key: 'pitchDeg', min: 0, max: 85 })
  .add({ obj: SHIP_TILT, key: 'yaw', min: 0, max: 0.4 });

const fitTrack = () => {
  const b = track.bounds;
  const w = b.max.x - b.min.x + 400, h = b.max.y - b.min.y + 400;
  camera.snapTo({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }, Math.min(screen.width / w, screen.height / h));
};
camera.snapTo(player.pos, camera.params.zoomNear);

// Debug hooks for the browser console / automated checks.
const dbg = {
  camera, track, ships, auto, PHYS, stats, projectiles,
  get mode() { return mode; },
  get race() { return race; },
  look(x: number, y: number, zoom: number) { freeCam = true; camera.snapTo({ x, y }, zoom); },
  follow() { freeCam = false; },
  get paused() { return paused; }, set paused(v: boolean) { paused = v; },
  newRace,
  /** Scripted input for the player (null = keyboard). */
  input: null as Controls | null,
  fps: () => fps,
  renderMs: () => renderMs,
};

(window as unknown as { dbg: unknown }).dbg = dbg;

const fmt = (t: number): string => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t % 1) * 100);
  return `${m}'${String(s).padStart(2, '0')}"${String(ms).padStart(2, '0')}`;
};

/** Countdown / lap splits / results, drawn in screen space over the HUD. */
function drawRaceOverlay(): void {
  const { ctx, width, height } = screen;
  ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
  const centre = (txt: string, y: number, sc: number, col: string) => drawText(ctx, txt, (width - textWidth(txt, sc)) / 2, y, sc, col);
  if (race.phase === 'countdown') {
    const n = Math.ceil(race.countdown);
    centre(n > 3 ? 'PRONTI' : String(n), height * 0.22, 12, n > 3 ? PAL.silver : n === 1 ? PAL.yellow : PAL.cyan);
  } else if (race.time < 1) {
    centre('GO!', height * 0.22, 12, PAL.green);
  }
  const e = race.entry(player);
  if (race.phase === 'finished' || e.finished || e.eliminated) {
    ctx.fillStyle = 'rgba(6,7,13,0.75)'; ctx.fillRect(width / 2 - 260, height / 2 - 150, 520, 300);
    centre(e.eliminated ? 'ELIMINATA' : race.phase === 'finished' ? 'GARA FINITA' : 'TRAGUARDO', height / 2 - 130, 5, e.eliminated ? PAL.red : PAL.yellow);
    const rank = race.ranking();
    rank.forEach((r, i) => {
      const line = `${i + 1}. ${r.ship.def.name.padEnd(14)} ${r.finished ? fmt(r.finishTime!) : r.eliminated ? 'ELIMINATA' : 'IN GARA'}`;
      centre(line, height / 2 - 80 + i * 24, 3, r.ship === player ? PAL.cyan : PAL.white);
    });
    e.lapTimes.forEach((t, i) => centre(`GIRO ${i + 1}  ${fmt(t)}`, height / 2 + 20 + i * 20, 2, PAL.silver));
    if (race.phase === 'finished') centre('INVIO: SCELTA NAVE', height / 2 + 110, 2, PAL.grey);
  } else if (e.lap > 0 && race.lapTime(e) < 3) {
    centre(`GIRO ${fmt(e.lapTimes[e.lapTimes.length - 1])}`, 120, 4, e.best === e.lapTimes[e.lapTimes.length - 1] ? PAL.green : PAL.white);
  }
}

const FIXED_DT = 1 / 60;
let acc = 0, last = performance.now();
let frames = 0, fps = 0, fpsStamp = performance.now();
let renderMs = 0; // exponential average of the render() cost

function update(dt: number): void {
  now += dt;
  if (pressed('F1')) panel.toggle();
  if (pressed('KeyR')) showRef = !showRef;
  if (pressed('KeyP')) showStyle = !showStyle;
  if (pressed('KeyD')) showDebug = !showDebug;
  if (pressed('KeyB')) showStrips = !showStrips;
  if (pressed('KeyS')) showSheet = !showSheet;
  if (pressed('KeyF')) { freeCam = !freeCam; if (freeCam) fitTrack(); }
  if (pressed('KeyO')) { freeCam = true; fitTrack(); }

  if (mode === 'select') {
    if (pressed('ArrowLeft')) selectIdx = (selectIdx + ships.length - 1) % ships.length;
    if (pressed('ArrowRight')) selectIdx = (selectIdx + 1) % ships.length;
    if (pressed('Enter') || pressed('Space')) newRace(selectIdx);
    endInputFrame();
    return;
  }
  if (pressed('Escape')) paused = !paused;
  if (pressed('KeyA')) { if (auto.has(player)) auto.delete(player); else auto.add(player); }
  if (pressed('Enter') && race.phase === 'finished') { mode = 'select'; endInputFrame(); return; }

  if (freeCam) {
    const pan = 600 / camera.zoom * dt;
    camera.x += axis('ArrowLeft', 'ArrowRight') * pan;
    camera.y += axis('ArrowUp', 'ArrowDown') * pan;
    if (down('Equal') || down('NumpadAdd')) camera.zoom *= 1 + 1.5 * dt;
    if (down('Minus') || down('NumpadSubtract')) camera.zoom /= 1 + 1.5 * dt;
  }

  if (paused) { endInputFrame(); return; }
  race.update(dt, player);
  const live = race.started;
  for (const s of ships) {
    let c: Controls = NO_CONTROLS;
    let fire = false;
    const en = race.entry(s);
    if (live && !en.finished && !en.eliminated && s.dead === 0) {
      if (s.ai) { c = aiControls(s, s.ai, track, ships, dt); fire = s.ai.fire; }
      else if (auto.has(s)) c = autopilot(s, track, 1);
      else if (s === player) { c = dbg.input ?? { thrust: axis('ArrowDown', 'ArrowUp'), steer: axis('ArrowLeft', 'ArrowRight'), airL: down('KeyZ'), airR: down('KeyX') }; fire = pressed('Space'); }
    }
    if (fire && s.item && s.dead === 0 && !s.airborne) { const shots = useItem(s, ships); projectiles.push(...shots); stats.shots++; }
    const ev = stepShip(s, c, track, wallGrid, dt);
    if (ev.graze) { stats.graze++; sparks.emit(ev.graze.pos, ev.graze.dir, ev.graze.n, 4, s.speed); }
    if (ev.wallHit) stats.hits++;
    if (ev.exploded) { stats.explosions++; fx.push(new Explosion(s.pos, s.def.trailColor)); for (const t of s.trails) t.clear(); }
  }
  for (const w of updateProjectiles(projectiles, ships, wallGrid, dt)) {
    if (w.kind === 'hit') stats.weaponHits++;
    if (w.projectile.kind === 'mine' || w.kind === 'hit') fx.push(new Explosion(w.pos, PAL.orange));
    else sparks.emit(w.pos, { x: -Math.cos(w.projectile.heading), y: -Math.sin(w.projectile.heading) }, { x: 0, y: 0 }, 12, 900);
  }
  sparks.update(dt);
  for (const f of fx) f.update(dt);
  fx = fx.filter((f) => !f.done);
  for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) if (!ships[i].dead && !ships[j].dead) collideShips(ships[i], ships[j]);
  if (!freeCam) camera.follow(player.pos, player.forward, player.speed / PHYS.maxSpeed, dt);
  for (const s of ships) if (!s.dead) s.emitTrails(now, Math.min(1.5, s.speed / PHYS.maxSpeed));
  endInputFrame();
}

function drawSelect(): void {
  const { ctx, width, height } = screen;
  ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
  const centre = (txt: string, y: number, sc: number, col: string) => drawText(ctx, txt, (width - textWidth(txt, sc)) / 2, y, sc, col);
  centre('WIPEOUT 1987', 70, 10, PAL.cyan);
  centre('SAGARMATHA  -  SCEGLI LA NAVE', 160, 3, PAL.silver);
  const sc = 5, gap = 70 * sc;
  const x0 = (width - ships.length * gap + gap - 50 * sc) / 2, y0 = height / 2 - 150;
  ships.forEach((s, i) => {
    const d = s.def, x = x0 + i * gap, sel = i === selectIdx;
    if (sel) { ctx.fillStyle = PAL.navy; ctx.fillRect(x - 20, y0 - 20, 50 * sc + 40, 64 * sc + 150); }
    ctx.drawImage(bake(d.art), x + (50 * sc - d.w * sc) / 2, y0 + (64 * sc - d.h * sc) / 2, d.w * sc, d.h * sc);
    drawText(ctx, d.name, x, y0 + 64 * sc + 10, 2, sel ? d.trailColor : PAL.grey);
    const bars: [string, number][] = [['VEL', d.stats.speed], ['SPINTA', d.stats.thrust], ['GUIDA', d.stats.handling], ['SCUDO', d.stats.shield]];
    bars.forEach(([n, v], j) => {
      const by = y0 + 64 * sc + 36 + j * 20;
      drawText(ctx, n, x, by, 2, PAL.silver);
      ctx.fillStyle = PAL.slate; ctx.fillRect(x + 60, by + 1, 100, 8);
      ctx.fillStyle = sel ? PAL.cyan : PAL.grey; ctx.fillRect(x + 60, by + 1, Math.round(100 * v), 8);
    });
  });
  centre('SINISTRA/DESTRA: SCEGLI   INVIO: GARA', height - 80, 3, PAL.white);
  centre('FRECCE GUIDA  Z/X AIRBRAKE  SPAZIO ARMA  ESC PAUSA', height - 48, 2, PAL.grey);
}

function render(): void {
  const { ctx, width, height } = screen;
  beginFrame(screen, PAL.black);
  if (mode === 'select') { drawSelect(); return; }
  camera.apply(screen);
  drawGround(ctx, camera.viewRect(screen));
  drawTrack(ctx, track, camera.viewRect(screen));
  if (showStrips) drawStripOutlines(ctx, track, camera.zoom, camera.viewRect(screen));
  if (showDebug) drawTrackDebug(ctx, track, camera.zoom);
  if (showRef && refImg.naturalWidth > 0) { ctx.globalAlpha = 0.5; ctx.drawImage(refImg, 0, 0, refImg.width * 10, refImg.height * 10); ctx.globalAlpha = 1; }
  for (const s of ships) for (const t of s.trails) t.draw(ctx, now);
  for (const s of ships) s.draw(ctx);
  for (const p of projectiles) drawProjectile(ctx, p, now);
  sparks.draw(ctx);
  for (const f of fx) f.draw(ctx);

  const e = race.entry(player);
  drawHud(screen, {
    shipName: player.def.name, speed: player.speed, maxSpeed: PHYS.maxSpeed, lap: Math.min(LAPS, e.lap + 1), laps: LAPS,
    time: e.finished ? e.finishTime! : race.lapTime(e), bestLap: e.best, energy: player.energy / 100,
    item: player.item ? ITEM_NAMES[player.item] : null, position: race.position(player), total: ships.length,
    shield: player.shield, turbo: player.turbo, fps,
  });
  drawRaceOverlay();
  if (paused) drawText(ctx, 'PAUSA', (width - textWidth('PAUSA', 6)) / 2, 60, 6, PAL.yellow);
  if (showStyle && styleImg.naturalWidth > 0) { ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0); ctx.drawImage(styleImg, width - 420, 60, 400, 400); }
  drawText(ctx, freeCam ? 'FREE CAM  F: SEGUI NAVE  O: TUTTA LA PISTA' : `FRECCE: GUIDA  Z/X: AIRBRAKE  A: AUTOPILOTA${auto.has(player) ? ' [ON]' : ''}  SPAZIO: ARMA  F: CAMERA  B: BORDI  D: MURI  F1: DEBUG`, 16, height - 60, 2, PAL.grey);

  if (showSheet) {
    // Sprite sheet: every ship at 6x, nose up, with name.
    const sc = 5, gap = 48 * sc + 24;
    const x0 = (width - SHIPS.length * gap + 24) / 2, y0 = 90;
    ctx.fillStyle = 'rgba(6,7,13,0.8)'; ctx.fillRect(0, y0 - 20, width, 64 * sc + 70);
    SHIPS.forEach((d, i) => {
      ctx.drawImage(bake(d.art), x0 + i * gap, y0, d.w * sc, d.h * sc);
      drawText(ctx, d.name, x0 + i * gap, y0 + 64 * sc + 10, 2, d.trailColor);
    });
  }
}

function frame(t: number): void {
  acc += Math.min(0.25, (t - last) / 1000); last = t;
  while (acc >= FIXED_DT) { update(FIXED_DT); acc -= FIXED_DT; }
  const r0 = performance.now();
  render();
  renderMs = renderMs * 0.95 + (performance.now() - r0) * 0.05;
  frames++;
  if (t - fpsStamp >= 1000) { fps = frames; frames = 0; fpsStamp = t; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
