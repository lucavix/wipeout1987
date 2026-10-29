"""Trace a track centreline from a VGCartography-style isometric map.

Usage: python3 -I tools/trace_track.py tools/altima.json
The JSON holds the panel image, the HSV range of the road surface, the rough points (image
coordinates in the given `coord_scale` system, i.e. the width the image was viewed at) and the
world scale. Every visible point is snapped to the ridge of the road mask (centre of the road) within
`snap` px; points marked hidden (tunnels) are kept as given. Outputs: <name>_trace.png (overlay to
check by eye) and <name>_points.ts (world coordinates for src/track/<name>.ts).
"""
import json, sys, cv2, numpy as np

spec = json.load(open(sys.argv[1]))
im = cv2.imread(spec['image'])
H, W = im.shape[:2]
k = W / spec['coord_scale']                       # rough coords -> image px
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
lo, hi = np.array(spec['hsv_lo']), np.array(spec['hsv_hi'])
mask = cv2.inRange(hsv, lo, hi)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
keep = np.zeros_like(mask)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 400: keep[lab == i] = 255
dt = cv2.distanceTransform(keep, cv2.DIST_L2, 5)

snap = spec.get('snap', 12) * k
out_pts, flags = [], []
for p in spec['points']:
    x, y = p[0] * k, p[1] * k
    hidden = len(p) > 2 and p[2] == 'h'
    if not hidden:
        r = int(snap)
        x0, y0 = int(max(0, x - r)), int(max(0, y - r))
        win = dt[y0:int(y + r) + 1, x0:int(x + r) + 1]
        if win.size and win.max() > 3:
            # ridge pixel with the largest distance to the road edge, weighted to stay near the guess
            yy, xx = np.mgrid[y0:y0 + win.shape[0], x0:x0 + win.shape[1]]
            score = win - 0.15 * np.hypot(xx - x, yy - y)
            j = np.unravel_index(np.argmax(score), score.shape)
            x, y = float(xx[j]), float(yy[j])
    out_pts.append((x, y)); flags.append(hidden)

# overlay
ov = im.copy()
pts = np.array(out_pts, np.int32)
for i in range(len(pts)):
    a, b = pts[i], pts[(i + 1) % len(pts)]
    col = (0, 200, 255) if not (flags[i] and flags[(i + 1) % len(pts)]) else (255, 80, 255)
    cv2.line(ov, tuple(a), tuple(b), col, 2)
for i, (x, y) in enumerate(pts):
    cv2.circle(ov, (int(x), int(y)), 4, (0, 255, 0) if not flags[i] else (255, 0, 255), -1)
    if i % 5 == 0: cv2.putText(ov, str(i), (int(x) + 5, int(y) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
cv2.imwrite(spec['name'] + '_trace.png', ov)

# world coordinates: image px * units_per_px, y stretched to undo the camera tilt
u, sy = spec['units_per_px'], spec['y_stretch']
world = [(round(x * u / 10) * 10, round(y * u * sy / 10) * 10) for x, y in out_pts]
length = sum(np.hypot(world[i][0] - world[(i + 1) % len(world)][0], world[i][1] - world[(i + 1) % len(world)][1]) for i in range(len(world)))
# ---- src/track/<id>.ts
def fmt_pts(pts, indent='  '):
    rows = []
    for i in range(0, len(pts), 4):
        rows.append(indent + ' '.join(f'{{ x: {x}, y: {y} }},' for x, y in pts[i:i + 4]))
    return '\n'.join(rows)
pit = spec.get('pit')
pit_ts = 'null'
if pit:
    # pit lane: the main points strictly between from and to, shifted sideways (offset > 0 = right of travel)
    seg = world[pit['from'] + 1:pit['to']]
    pts = []
    for i, (x, y) in enumerate(seg):
        ax, ay = world[pit['from'] + i]; bx, by = world[pit['from'] + i + 2]
        tx, ty = bx - ax, by - ay; l = np.hypot(tx, ty) or 1
        nx, ny = -ty / l, tx / l
        pts.append((round((x + nx * pit['offset']) / 10) * 10, round((y + ny * pit['offset']) / 10) * 10))
    pit_ts = f"{{\n    from: {pit['from']},\n    to: {pit['to']},\n    points: [\n{fmt_pts(pts, '      ')}\n    ],\n  }}"
jump = spec.get('jump')
jump_ts = f"{{ from: {jump[0]}, to: {jump[1]} }}" if jump else 'null'
tunnels_ts = ', '.join(f'{{ from: {a}, to: {b} }}' for a, b in spec.get('tunnels', []))
bridges_ts = ', '.join(f'{{ from: {a}, to: {b} }}' for a, b in spec.get('bridges', []))
pads = lambda key: ' '.join(f'{{ t: {t}, lane: {l} }},' for t, l in spec.get(key, []))
const = spec['const']
ts = f"""import type {{ TrackData }} from './track';

/**
 * {spec['track_name']} — linea centrale tracciata con tools/trace_track.py da {spec['image']}
 * ({len(world)} punti, giro di circa {int(length)} unita'). Coordinate mondo = pixel immagine x {u}
 * (y x {u * sy:.0f} per compensare l'inclinazione della vista). Rigenera con:
 *   python3 -I tools/trace_track.py {sys.argv[1]}
 * I tratti in galleria sono invisibili nella mappa e tracciati a mano.
 */
export const {const}: TrackData = {{
  id: '{spec['id']}',
  name: '{spec['track_name']}',
  country: '{spec['country']}',
  theme: {{ ground: '{spec['ground']}', ref: {{ src: '{spec['ref_src']}', sx: {u}, sy: {u * sy:g} }} }},
  main: [
{fmt_pts(world)}
  ],
  pit: {pit_ts},
  jump: {jump_ts},
  tunnels: [{tunnels_ts}],
  bridges: [{bridges_ts}],
  speedPads: [
    {pads('speed_pads')}
  ],
  weaponPads: [
    {pads('weapon_pads')}
  ],
}};
"""
open(spec['out'], 'w').write(ts)
print('wrote', spec['out'])
