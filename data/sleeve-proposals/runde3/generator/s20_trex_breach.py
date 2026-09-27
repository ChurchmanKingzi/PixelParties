# -*- coding: utf-8 -*-
"""Sleeve 20 – „Trex Breach“: Der Gigantisaurier-T-Rex bricht durch das Burgtor, Steine und Torbretter
fliegen, Stadtwachen fliehen.

Quellen (MotiveGrailWar.xcf): Ebene 706 „Schloss Front“ (Burgfassade mit Türmen, Tor, Bannern – Hintergrund 2×,
Mauersteine/Torbretter als Trümmer), Ebene 513 „Trex“ (3×), Ebene 676 „Doomed Town Guard“ und 593 „Ebene #52“
(Städter, je 3×). Loch/Bruchkante: Pixel der Fassade abgedunkelt bzw. umgefärbt.
Karten: Gigantisaur King Trex, Doomed Town Guard.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
BX, BY = 204, 166                                  # linke obere Ecke des Fassadenausschnitts (nativ)
wall = region(B, [706], (BX, BY, BX + 125, BY + 175))
fill_bg(cv, wall, 2)

# --- Loch in der Mauer um das Tor (natives Raster, gezackt) ---------------------------------
rng = np.random.RandomState(7)
hole = np.zeros((350, 250), bool)
top = {}
for x in range(236, 298):
    d = min(x - 236, 297 - x)
    t = 222 - min(d, 16) + rng.randint(0, 4)        # oben bogenförmig, gezackt
    top[x] = t
for x, t in top.items():
    y1 = 276 if 241 < x < 292 else 276 - rng.randint(3, 10)
    hole[(t - BY) * 2:(y1 - BY) * 2, (x - BX) * 2:(x - BX + 1) * 2] = True
# Innenraum: sehr dunkel, nach unten leicht heller (Staub)
ys, xs = np.where(hole)
for y, x in zip(ys, xs):
    f = (y - 100) / 160.0
    th = BAYER8[(y // 2) % 8, (x // 2) % 8]
    cv.a[y, x] = (38, 24, 16) if f * 0.7 > th else (16, 10, 12)
# Bruchkante: 1 natives Pixel dunkler Rand + helle Steinkante darüber
import cv2
hm = hole.astype(np.uint8)
ring1 = (cv2.dilate(hm, np.ones((5, 5), np.uint8)) > 0) & ~hole
ring2 = (cv2.dilate(hm, np.ones((9, 9), np.uint8)) > 0) & ~hole & ~ring1
cv.a[ring2] = (cv.a[ring2].astype(int) * 0.75).astype(np.uint8)
cv.a[ring1] = (48, 36, 58)

# --- T-Rex: hinterer Teil steckt noch in der Mauer ------------------------------------------
trex = sprite('d20_trex', B, [513])
TX, TY = 4, 80
k = 3
T = up(trex, k)
hx = (266 - BX) * 2                                   # Mitte des Lochs
vis = hole.copy(); vis[:, hx:] = True
vis[(270 - BY) * 2:, (241 - BX) * 2:] = True                         # Füße treten auf den Weg
shv = np.zeros_like(vis); shv[:(268 - BY) * 2, hx:] = True; shv &= ~hole
mask_paste(cv, silhouette(T, (18, 10, 24)), TX + 6, TY + 6, shv)    # Schlagschatten auf der Mauer
mask_paste(cv, T, TX, TY, vis)

# --- Trümmer: Mauersteine und Torbretter --------------------------------------------------------
def chunk(x0, y0, w, h):
    c = region(B, [706], (x0, y0, x0 + w, y0 + h)).copy()
    c[0, 0, 3] = c[0, -1, 3] = c[-1, 0, 3] = 0
    return outline(c, (40, 30, 52))

stones = [chunk(323, 214, 5, 4), chunk(324, 230, 4, 3), chunk(200, 236, 6, 4), chunk(325, 240, 5, 3),
          chunk(201, 220, 4, 4), chunk(323, 222, 3, 3)]
planks = [region(B, [706], (250, 205, 252, 216)), region(B, [706], (270, 208, 272, 218))]
planks = [outline(p, (40, 22, 10)) for p in planks]
for (s, x, y, kk) in [(stones[0], 58, 118, 3), (stones[1], 196, 96, 2), (stones[2], 30, 200, 3),
                      (stones[3], 214, 176, 3), (stones[4], 100, 106, 2), (stones[5], 150, 96, 2),
                      (stones[1], 18, 150, 2), (stones[4], 226, 238, 2)]:
    put(cv, s, x, y, kk, shadow=(20, 14, 20), sh_off=(1, 2), sh_alpha=0.45)
put(cv, rot90(planks[0]), 104, 300, 3, shadow=(20, 14, 20), sh_off=(1, 2))
put(cv, rot90(planks[1]), 40, 96, 2, shadow=(20, 14, 20), sh_off=(1, 2))

# --- fliehende Wachen im Vordergrund -------------------------------------------------------------
guard = sprite('d20_guard', B, [676])
man = sprite('d20_townsman', B, [593])
put(cv, guard, 14, 272, 3, shadow=(20, 30, 10), sh_off=(2, 1))
put(cv, man, 184, 266, 3, shadow=(20, 30, 10), sh_off=(-2, 1))

vignette(cv, 0.45, 0.6)
frame(cv, [(20, 14, 26), (120, 96, 150), (60, 44, 80)])
print(save(cv, '20_trex_breach.png'))
