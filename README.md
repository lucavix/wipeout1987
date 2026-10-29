# WIPEOUT 1987

A top-down, 2D, pixel-art tribute to **WipEout**.

## [▶ PLAY HERE](https://lucavix.github.io/wipeout1987/)

Runs in the browser, nothing to install. Keyboard required.

I have been playing video games for forty years, and no game has ever hit me the way WipEout did:
the speed, the anti-gravity handling, the neon tracks, the music, the whole Designers Republic look.
This little project is my way of saying thank you to the people who made it, and of saying out loud
what so many of us hope: **that the series comes back**. We are still here, still waiting for the next one.

This is a fan project. It is not affiliated with, endorsed by, or connected to Sony Interactive
Entertainment, Psygnosis, Studio Liverpool or anyone who owns the WipEout name. WipEout is a
trademark of its respective owners. Everything here was written from scratch; the artwork is
original pixel art inspired by the games.

![Ship select](docs/shots/f3-01-selezione.jpg)

## What it is

- Four speed classes like the original: **Vector**, **Venom**, **Rapier** and **Phantom**. Rapier is the
  handling the game was tuned on; Vector and Venom are slower with calmer opponents, Phantom is faster
  with the sharpest AI. Chosen first, before the circuit and the ship.
- Three circuits from the 1995 game, traced from VGCartography's map, plus one more. **Altima VII**, the first track of the 1995 game, traced from VGCartography's track
  map: the long start straight, the climb on the right, the big loop, the covered descent, the road
  over the mountain and the tunnel that passes under it back to the start line. **Karbonis V**, a fast forest loop
  with a covered descent. **Terramax**, with the road on top of the dam, a covered pipe and the bridge
  over the lake. **Sagarmatha**, with a long left straight, a hairpin, a jump on the right straight and
  a wide loop at the top. All have a pit lane that recharges your energy. The track select screen shows
  a minimap of each circuit.
- Vector track geometry with chunky 8-bit textures: five parallel strips (two neon kerbs, three lanes),
  one PNG texture per strip, every world pixel mapped to exactly one texel.
- Anti-gravity handling: thrust, brake, steering that tightens as you slow down, left/right airbrakes
  that make the ship drift. Scraping a wall at a shallow angle throws sparks and pins you to it until
  you steer away; hitting it hard bounces you off and costs energy.
- Speed pads, a jump (too slow and you fall), and a pit lane with a speed limit.
- Weapon pads hand out turbo, homing missile, rockets, mines and shield. Energy runs out, you blow up.
- Three AI opponents with different skill levels, lap counting with sector gates, lap and best-lap
  times, live position, a results screen.
- Camera that pulls back as you speed up. Ribbon trails behind the engines. Ships bank and pitch
  with the controls.
- Everything runs in an HTML5 canvas, no WebGL, no dependencies at runtime. No sound (yet).

![Race](docs/shots/f3-02-gara-salto.jpg)

## Controls

| Key | Action |
|---|---|
| Arrow up / down | Thrust / brake |
| Arrow left / right | Steer |
| Z / X | Left / right airbrake |
| Space | Use item |
| Esc | Pause |
| Up / down (menus) | Choose the class, the circuit, then left / right the ship |
| Enter / Esc | Next screen / previous screen; Enter starts the race |
| A | Autopilot (handy to watch the track) |
| F / O | Free camera / whole track |
| B / D | Show strip outlines / walls |
| F1 | Tuning panel: physics and camera parameters, live |

## Running it

```
npm install
npm run dev
```

Then open http://127.0.0.1:5187/. `npm run build` produces a static site in `dist/`; every push to
`main` deploys it to GitHub Pages through `.github/workflows/pages.yml`.

## How it is built

- Vite + TypeScript, Canvas 2D with `imageSmoothingEnabled = false`, fixed 60 Hz update loop.
- `src/track/` builds the track from a hand-traced centreline (Catmull-Rom spline, curvature
  limiting, strip profile, walls, jump, tunnel and pad tiles) and rasterises it once at start-up into
  world-aligned bitmap chunks allocated only where the track is; each frame only the visible chunks
  are blitted. A circuit may cross over itself: every wall knows its distance along the lap and only
  acts on ships that are on that part of the track, so a tunnel can pass under another section.
- `tools/trace_track.py` turns a track map into a centreline: rough points are snapped to the centre
  of the road surface detected in the image, the overlay `*_trace.png` is there to check the result,
  and the script writes `src/track/<id>.ts`. Altima VII came from
  [VGCartography's Wipeout (1995) map](https://www.deviantart.com/vgcartography/art/Wipeout-1995-Tracks-and-Craft-1159706214)
  (not included in the repo; put the panel in `ref/vgcartography/altima.png` to re-trace).
- `src/game/physics.ts` is the handling model, `src/game/weapons.ts` the items, `src/game/ai.ts` the
  opponent drivers, `src/game/race.ts` laps and ranking.
- Ships are PNG sprites in `public/ships/` (nose up, transparent background), loaded at start-up;
  `src/gfx/ships.ts` holds only the metadata (engine positions, trail colour, stats). Two ships for
  now (AG Systems and FEISAR); the others will come from a proper pixel artist.
- Track textures are PNGs in `public/textures/`, with procedural fallbacks in `src/gfx/tilegen.ts`
  (`npm run textures:generate` exports them).

Built with the help of Claude Code.

## License

MIT for the code. The WipEout name, team names and track names belong to their owners.
