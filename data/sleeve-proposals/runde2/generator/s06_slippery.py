# -*- coding: utf-8 -*-
"""Sleeve: Slippery Slope – die Slippery-Kreaturen rutschen mit ihren Geschwindigkeits-Schlieren
über das gestreifte Eis. Streifenmuster, Wasserloch und alle Figuren aus den Slippery-Karten."""
import numpy as np
from kit import *

NW, NH = 125, 175
cv = Canvas(NW, NH)
pol = nat('Slippery Polar')
S = pol[44, 0:16]
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = S[(x + y) % 16]

Si = S.astype(int)
def notice(c, tol=22):
    return np.sqrt(((c[..., None, :] - Si[None, None]) ** 2).sum(-1)).min(-1) > tol

def cut_s(n, box, clear=()):
    return cutrule(n, box, notice, largest=1, conn=4, clear=clear)

def put(s, x, y, fl=False, sh=0.35):
    s2 = flip(s) if fl else s
    cv.paste(silhouette(s2, (60, 60, 140)), x + 1, y + 2, alpha=sh)
    cv.paste(s2, x, y)

# Wasserloch mit Narwal (linke Kartenhälfte, Kanten an Ärmelrand)


pool = flip(cutrule('Slippery Ice', (22, 22, 75, 50), notice, largest=1, conn=4))
PX, PY = 0, NH - pool.shape[0]
sk = cut_s('Slippery Skates', (18, 15, 75, 38))
sb = cut_s('Slippery Snobbit', (28, 0, 48, 40))
# Schlittenspur nach oben verlängern (Spur-Zeilen wiederholt), bis unter die Eisbär-Schliere
ext = 30
sb = np.concatenate([np.concatenate([sb[2:6]] * (ext // 4 + 1), 0)[:ext], sb], 0)
SBY = PY - sb.shape[0] + 8
put(sb, 18, SBY)
cv.paste(pool, PX, PY)
# Whoolmoth oben rechts (Kartenkante = Ärmelkante)
wh = cut_s('Slippery Whoolmoth', (0, 3, 75, 50))
cv.paste(wh, NW - wh.shape[1], 0)
# Schneemann mit diagonaler Schliere oben links
sn = cut_s('Slippery Snowman', (0, 0, 50, 45), clear=[(0, 0, 2, 2)])
cv.paste(sn, 0, 0)
# Pinguin (Schliere endet am rechten Rand)
pg = cut_s('Slippery Pengu', (3, 14, 75, 36))
put(pg, NW - pg.shape[1], 56)
# Eisbär gespiegelt (nach rechts), Schliere bis zum linken Rand
pb = cut_s('Slippery Polar', (10, 12, 75, 40))
put(pb, 0, 80, fl=True)
# Schlittschuh-Kind (Schliere nach rechts)
put(sk, NW - sk.shape[1], 124)

big = Canvas(W, H)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 2)[..., :3]
for i, c in enumerate([(30, 40, 110), (139, 142, 239), (220, 222, 255), (30, 40, 110)]):
    big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
print(save(big, '06_slippery_slope.png'))
