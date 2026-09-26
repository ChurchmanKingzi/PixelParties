# -*- coding: utf-8 -*-
"""Sleeve: Spinnennest – das Netz aus „Trapping“ (Viertel gespiegelt, gedreht), die Crimson Skull
Spider am roten Faden, dazu Baby-, Brain-, Diamond- und Cute Spider. Höhlenboden aus „Spider Hive“."""
import numpy as np
from kit import *

cv = Canvas(W, H)
# --- Höhlenboden: Spider Hive, Spinnen/Netze herausretuschiert, gespiegelt gekachelt, abgedunkelt
hv = nat('Spider Hive')
m = not_dirt(hv.astype(int))
m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
hv = inpaint_h(hv, m)
t = np.concatenate([hv, hv[:, ::-1]], 1); t = np.concatenate([t, t[::-1]], 0)
tile = hsv_shift(up(np.dstack([t, np.full(t.shape[:2], 255, np.uint8)]), 2), 0, 0.95, 0.68)
fill_tiles(cv, tile, ox=30, oy=20)
vignette(cv, 0.8, 0.3)

# --- Netz: oberes linkes Viertel aus Trapping, zu vollem Rad gespiegelt, um 90° gedreht, 5×
tr = nat('Trapping').astype(int)
wm = ((tr.max(-1) > 200) & ((tr.max(-1) - tr.min(-1)) < 50))
q = wm[0:26, 0:39]
top = np.concatenate([q, q[:, :-1][:, ::-1]], 1)
full = np.concatenate([top, top[:-1][::-1]], 0)       # 51 × 77
full = np.rot90(full)                                  # 77 × 51
K = 5
fh, fw = full.shape
ox = (W - fw * K) // 2; oy = (H - fh * K) // 2
WEB = (214, 212, 222); WEBS = (40, 26, 16)
for y in range(fh):
    for x in range(fw):
        if full[y, x]:
            cv.rect(ox + x * K + 2, oy + y * K + 2, ox + x * K + K + 2, oy + y * K + K + 2, WEBS)
for y in range(fh):
    for x in range(fw):
        if full[y, x]:
            cv.rect(ox + x * K, oy + y * K, ox + x * K + K, oy + y * K + K, WEB)
HX, HY = ox + 25 * K + K // 2, oy + 38 * K + K // 2   # Nabe

# --- Spinnen
def sp(n, box, clear=()):
    return cutrule(n, box, not_dirt, clear=clear)
boss = cutrule('Crimson Skull Spider', (28, 14, 49, 40),
               lambda c: ((c.max(-1) < 115) & ((c.max(-1) - c.min(-1)) < 38)) |
                         ((c[..., 0] > 2 * c[..., 1]) & (c[..., 0] > 70) & (c[..., 0] > 2 * c[..., 2])))
boss = boss[:21]
baby = sp('Crimson Skull Spider', (51, 27, 68, 38))
baby2 = sp('Crimson Skull Spider', (20, 9, 34, 18))
brain = sp('Brain Spider', (27, 17, 46, 36))
dia = sp('Diamond Spider', (27, 15, 45, 34))
cute = sp('Cute Spider', (27, 11, 52, 34), clear=[(27, 11, 52, 14)])

def put(s, x, y, k, fl=False, r=0, sh=(3, 3)):
    s2 = up(rot90(flip(s) if fl else s, r), k)
    cv.paste(silhouette(s2, (0, 0, 0)), x + sh[0], y + sh[1], alpha=0.45)
    cv.paste(s2, x, y)
    return s2

# roter Faden der Crimson Skull Spider (Farben vom Kartenfaden) von oben bis zur Nabe
B = up(boss, 5)
bx = HX - B.shape[1] // 2; by = HY - B.shape[0] // 2 + 6
TH = [(149, 5, 3), (112, 2, 0)]
tx = bx + 10 * 5
for y in range(0, by + 5):
    cv.rect(tx, y, tx + 5, y + 1, TH[(y // 5) % 2])
cv.paste(silhouette(B, (0, 0, 0)), bx + 4, by + 4, alpha=0.5)
cv.paste(B, bx, by)

put(baby, 26, 40, 3); put(baby2, 190, 70, 3, True, 1); put(baby, 186, 250, 3, False, 2); put(baby2, 30, 300, 3, False, 3)
put(dia, 28, 150, 3, r=1); put(brain, 176, 146, 3, True); put(dia, 100, 290, 3, True)
put(cute, 150, 20, 3, r=0)
put(baby, 120, 24, 2, r=1); put(baby2, 60, 226, 2); put(baby, 210, 320, 2, r=3)

for i, c in enumerate([(20, 12, 8), (120, 0, 0), (170, 10, 5), (20, 12, 8)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '04_spider_nest.png'))
