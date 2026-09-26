# -*- coding: utf-8 -*-
"""Sleeve: Gigantisaurs-Comicseite (ohne Text) – vier Panels aus den Gigantisaur-Kartenbildern
(Pteranos, Raptoren, Triceras, Spinor) im nativen Kartenraster (3× ≈ Kartenpixel)."""
import numpy as np
from kit import *

NW, NH = 84, 117
cv = Canvas(NW, NH, (24, 40, 20))
# Hintergrund: Blätterdach aus Gigantisaur Raptoren (linker Waldstreifen), abgedunkelt
rap = nat('Gigantisaur Raptoren')
leaf = rap[0:20, 0:20]
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = (leaf[y % 20, x % 20] * 0.55).astype(np.uint8)

INK = (16, 14, 10); PAPER = (244, 238, 220)
def panel(n, crop, x, y):
    a = nat(n)[crop[1]:crop[3], crop[0]:crop[2]]
    h, w = a.shape[:2]
    cv.rect(x - 2, y - 2, x + w + 2, y + h + 2, PAPER)
    cv.rect(x - 1, y - 1, x + w + 1, y + h + 1, INK)
    cv.a[y:y + h, x:x + w] = a
    return x, y, w, h

X0 = (NW - 76) // 2
pA = panel('Gigantisaur Pteranos', (0, 5, 76, 36), X0, 4)
pB = panel('Gigantisaur Raptoren', (27, 3, 64, 40), X0, 39)
pC = panel('Gigantisaur Triceras', (37, 4, 74, 41), X0 + 39, 39)
pD = panel('Gigantisaur Spinor', (0, 4, 76, 34), X0, 80)

big = Canvas(W, H)
u = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 3)[..., :3]
big.a[:] = u[:H, :W]
for i, c in enumerate([INK, (90, 140, 40), (160, 200, 80), INK]):
    big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
print(save(big, '07_gigantisaur_comic.png'))
