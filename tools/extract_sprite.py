"""Convert a pixel-art reference image (regular cell grid) into a sprite PNG for public/ships/.
Usage: python3 -I tools/extract_sprite.py ref/nave1.jpeg 100 public/ships/nuova.png   (100 = cells per side)
Prints the suggested engine positions and palette for src/gfx/ships.ts.
"""
import sys, cv2, numpy as np
from collections import Counter

path, cells, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
im = cv2.imread(path); H, W = im.shape[:2]
cw, ch = W / cells, H / cells
# sample the median of a small window at each cell centre
grid = np.zeros((cells, cells, 3), np.uint8)
for j in range(cells):
    for i in range(cells):
        cx, cy = int((i + 0.5) * cw), int((j + 0.5) * ch)
        win = im[max(0, cy - 2):cy + 3, max(0, cx - 2):cx + 3].reshape(-1, 3)
        grid[j, i] = np.median(win, axis=0)
# background = most common cell colour (ignores a white picture frame if present)
q = (grid // 16).reshape(-1, 3)
vals, counts = np.unique(q, axis=0, return_counts=True)
bg = vals[np.argmax(counts)] * 16 + 8
fg = np.linalg.norm(grid.astype(int) - bg, axis=2) > 60
# main connected component (ship), 8-connected, plus anything touching it after one dilation
n, lab = cv2.connectedComponents(fg.astype(np.uint8), connectivity=8)
sizes = Counter(lab[fg].tolist())
# largest component that does not touch the image border (skips a picture frame)
edge = set(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist())
main = next(c for c, _ in sizes.most_common() if c not in edge)
mask = (lab == main)
for _ in range(2):
    d = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    touched = set(lab[d & fg].tolist()) - {0}
    mask = np.isin(lab, list(touched))
ys, xs = np.nonzero(mask)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
crop = grid[y0:y1, x0:x1]; cmask = mask[y0:y1, x0:x1]
# quantise ship colours with k-means (k=12), then merge near-identical centres
pix = crop[cmask].reshape(-1, 3).astype(np.float32)
K = min(12, len(np.unique(pix, axis=0)))
crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
_, labels, centers = cv2.kmeans(pix, K, None, crit, 5, cv2.KMEANS_PP_CENTERS)
centers = centers.astype(int)
merged = list(range(K))
for a in range(K):
    for b in range(a):
        if merged[b] == b and np.linalg.norm(centers[a] - centers[b]) < 28: merged[a] = b; break
uniq = sorted(set(merged))
chars = 'abcdefghijklmnopqrstuvwxyz'
cmap = {u: chars[k] for k, u in enumerate(uniq)}
rows = []
li = 0
for j in range(crop.shape[0]):
    row = ''
    for i in range(crop.shape[1]):
        if not cmask[j, i]: row += '.'
        else: row += cmap[merged[int(labels[li][0])]]; li += 1
    rows.append(row)
pal = {cmap[u]: '#%02x%02x%02x' % (centers[u][2], centers[u][1], centers[u][0]) for u in uniq}
# engines: columns whose lowest opaque cell is within 2 rows of the sprite bottom, clustered
h = len(rows); bottoms = [max([j for j in range(h) if rows[j][i] != '.'], default=-1) for i in range(len(rows[0]))]
low = [i for i, b in enumerate(bottoms) if b >= h - 3]
clusters = []
for i in low:
    if clusters and i - clusters[-1][-1] <= 1: clusters[-1].append(i)
    else: clusters.append([i])
engines = [{'x': round(sum(c) / len(c) + 0.5, 1), 'y': h - 0.5} for c in clusters if len(c) >= 2]
out_img = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
for j, r in enumerate(rows):
    for i, ch in enumerate(r):
        if ch != '.':
            c = pal[ch]; out_img[j, i] = (int(c[5:7], 16), int(c[3:5], 16), int(c[1:3], 16), 255)
cv2.imwrite(out, out_img)
print(f"// {out}: {crop.shape[1]}x{crop.shape[0]} px, {len(uniq)} colours")
print("engines: " + str(engines).replace("'", "") + ",")
print("palette: " + ', '.join(pal.values()))
