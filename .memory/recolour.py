"""Replace one colour in a sprite PNG. Usage: python3 -I .memory/recolour.py in.png out.png '#rrggbb'|most '#rrggbb'
('most' = the most frequent opaque colour; prints the palette with counts first)."""
import sys, cv2, numpy as np
from collections import Counter
src, dst, frm, to = sys.argv[1:5]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
cnt = Counter(map(tuple, im[im[:, :, 3] > 0][:, :3].tolist()))
for (b, g, r), n in cnt.most_common(): print(f'#{r:02x}{g:02x}{b:02x} {n}')
hx = lambda s: (int(s[5:7], 16), int(s[3:5], 16), int(s[1:3], 16))
f = cnt.most_common(1)[0][0] if frm == 'most' else hx(frm)
m = np.all(im[:, :, :3] == np.array(f), axis=2) & (im[:, :, 3] > 0)
im[m, :3] = hx(to); cv2.imwrite(dst, im)
print(f'replaced #{f[2]:02x}{f[1]:02x}{f[0]:02x} ({m.sum()} px) with {to} -> {dst}')
