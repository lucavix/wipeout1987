"""Pixel-art drawing (cell grid, white background, sprite may touch the image edges) -> sprite PNG.
Usage: python3 -I .memory/extract_pixelart.py ref/piranha.jpeg public/ships/piranha.png [cols rows]
Without cols/rows it tries grids near W/12 x H/12 and keeps the one whose cells are most uniform.
Prints the engine nozzle positions (bottom-most opaque column clusters) for src/gfx/ships.ts.
"""
import sys, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src); H, W = im.shape[:2]

def sample(cols, rows):
    cw, ch = W / cols, H / rows
    grid = np.zeros((rows, cols, 3), np.uint8); var = 0.0
    for j in range(rows):
        for i in range(cols):
            x0, y0 = int(i * cw) + 2, int(j * ch) + 2; x1, y1 = max(x0 + 1, int((i + 1) * cw) - 2), max(y0 + 1, int((j + 1) * ch) - 2)
            win = im[y0:y1, x0:x1].reshape(-1, 3).astype(np.float32)
            grid[j, i] = np.median(win, axis=0); var += win.var(axis=0).sum()
    return grid, var / (rows * cols)

if len(sys.argv) > 4: cands = [(int(sys.argv[3]), int(sys.argv[4]))]
else:
    c0, r0 = round(W / 12), round(H / 12)
    cands = [(c, r) for c in range(c0 - 2, c0 + 3) for r in range(r0 - 2, r0 + 3)]
best = min(((sample(c, r), c, r) for c, r in cands), key=lambda t: t[0][1])
(grid, var), cols, rows = best
print(f'grid {cols}x{rows} (cell {W / cols:.1f}x{H / rows:.1f} px, uniformity {var:.0f})')

hsv = cv2.cvtColor(grid, cv2.COLOR_BGR2HSV)
mask = ~((hsv[:, :, 2] > 225) & (hsv[:, :, 1] < 30))          # white background -> transparent
# quantise the ship colours (k-means) and merge near-identical centres
pix = grid[mask].reshape(-1, 3).astype(np.float32)
K = min(16, len(np.unique(pix, axis=0)))
crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.5)
_, labels, centers = cv2.kmeans(pix, K, None, crit, 6, cv2.KMEANS_PP_CENTERS)
centers = centers.astype(int); merged = list(range(K))
for a in range(K):
    for b in range(a):
        if merged[b] == b and np.linalg.norm(centers[a] - centers[b]) < 24: merged[a] = b; break
sprite = np.zeros((rows, cols, 4), np.uint8); li = 0
for j in range(rows):
    for i in range(cols):
        if mask[j, i]:
            c = centers[merged[int(labels[li][0])]]; li += 1
            sprite[j, i] = (c[0], c[1], c[2], 255)
# trim empty border rows/cols
ys, xs = np.nonzero(sprite[:, :, 3]); sprite = sprite[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
cv2.imwrite(out, sprite)
h, w = sprite.shape[:2]
bottoms = [max([j for j in range(h) if sprite[j, i, 3]], default=-1) for i in range(w)]
low = [i for i, b in enumerate(bottoms) if b >= h - 2]; clusters = []
for i in low:
    if clusters and i - clusters[-1][-1] <= 1: clusters[-1].append(i)
    else: clusters.append([i])
print(f'{out}: {w}x{h} px, {len(set(merged))} colours')
print('engines:', [{'x': round(sum(c) / len(c) + 0.5, 1), 'y': h - 0.5} for c in clusters if len(c) >= 2])
print('palette:', ', '.join('#%02x%02x%02x' % (c[2], c[1], c[0]) for k, c in enumerate(centers) if merged[k] == k))
