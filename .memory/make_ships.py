"""Derive ship sprites from public/ships/feisar.png by palette swap (+ optional nose reshape).
Usage: python3 -I .memory/make_ships.py      -> writes public/ships/auricom.png, piranha.png and docs/ships/*_8x.png
"""
import cv2, numpy as np

def hx(s): r, g, b = int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16); return (b, g, r)
FEISAR = {  # role -> colour in feisar.png
    'main': '#f1bc1e', 'shade': '#d78d19', 'light': '#f7e490', 'light2': '#f3d153',
    'sec': '#2a65ba', 'secDark': '#214e93', 'white': '#f9fdf9', 'outline': '#23264a',
    'glass': '#7cb4c8', 'glassDark': '#638ca2', 'glassHi': '#bdc9ce', 'engine': '#b22a2c',
}
SHIPS = {
    'auricom': {'main': '#2f6fe0', 'shade': '#1d49a6', 'light': '#8fb8ff', 'light2': '#5f93f2',
                'sec': '#dde3ee', 'secDark': '#a3adc0', 'white': '#f9fdf9', 'engine': '#e8303a'},
    'piranha': {'main': '#f6a24c', 'shade': '#d9742a', 'light': '#ffd8a8', 'light2': '#ffc078',
                'sec': '#3a3f58', 'secDark': '#262a40', 'white': '#f4f1ea', 'engine': '#e8303a'},
}

def recolour(im, pal):
    out = im.copy()
    for role, src in FEISAR.items():
        if role not in pal: continue
        m = np.all(im[:, :, :3] == np.array(hx(src)), axis=2) & (im[:, :, 3] > 0)
        out[m, :3] = hx(pal[role])
    return out

def fat_nose(im, extra=4, rows=16, peak=4):
    """Widen the first `rows` rows about the centre: factor peaks at row `peak`, back to 1 at `rows`."""
    h, w = im.shape[:2]
    out = np.zeros((h, w + extra, 4), np.uint8)
    out[:, extra // 2:extra // 2 + w] = im
    cx = (w + extra) / 2
    for y in range(rows):
        t = y / peak if y < peak else 1 - (y - peak) / (rows - peak)
        f = 1 + 0.4 * max(0.0, min(1.0, t)) ** 0.8
        row = im[y]; xs = np.where(row[:, 3] > 0)[0]
        if len(xs) == 0: continue
        c0 = (xs[0] + xs[-1] + 1) / 2
        new = np.zeros((w + extra, 4), np.uint8)
        for x in range(w + extra):
            sx = int(round(c0 + (x - cx) / f))
            if 0 <= sx < w and row[sx, 3] > 0: new[x] = row[sx]
        out[y] = new
    return out

base = cv2.imread('public/ships/feisar.png', cv2.IMREAD_UNCHANGED)
for name, pal in SHIPS.items():
    im = recolour(base, pal)
    if name == 'piranha': im = fat_nose(im)
    cv2.imwrite(f'public/ships/{name}.png', im)
    h, w = im.shape[:2]
    bg = np.full((h, w, 3), 24, np.uint8); a = im[:, :, 3:4] / 255.0
    z = cv2.resize((im[:, :, :3] * a + bg * (1 - a)).astype(np.uint8), (w * 8, h * 8), interpolation=cv2.INTER_NEAREST)
    cv2.imwrite(f'docs/ships/{name}_8x.png', z)
    print(name, w, h)
