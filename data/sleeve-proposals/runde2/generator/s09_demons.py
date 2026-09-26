# -*- coding: utf-8 -*-
"""Sleeve: Kreislauf der Cycling Demons – Pentagramm aus „Summoning Circle“ (Kerzen und Kopfsteinpflaster),
an den fünf Spitzen Medaillons der fünf Cycling Demons (Bouldor, Herbithorn, Hydrogen, Infernous, Serpentous)."""
import math, numpy as np
from kit import *

cv = Canvas(W, H)
sc = nat('Summoning Circle')          # 94×64, feineres Raster (p≈6,35)
cob = sc[1:63, 1:21]
t2 = np.concatenate([cob, cob[:, ::-1]], 1)
tile = up(np.dstack([t2, np.full(t2.shape[:2], 255, np.uint8)]), 2)
fill_tiles(cv, hsv_shift(tile, 0, 1.0, 0.55))
vignette(cv, 0.85, 0.2)

CX, CY = 125, 178
# Pentagramm-Scheibe 4×; rote Linien kräftiger
# Pentagramm: die dunklen Linien der Karte (v<70) als Maske, glühend rot nachgezogen, 4×
K = 4
lines = (sc.max(-1) < 70)
yy, xx = np.mgrid[0:sc.shape[0], 0:sc.shape[1]]
lines &= ((xx + .5 - 46.5) ** 2 + (yy + .5 - 39.5) ** 2) < 25 ** 2
ys, xs = np.where(lines)
pcx, pcy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
glow = cv2.dilate(lines.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
for (mk, col) in ((glow, (90, 8, 8)), (lines, (225, 40, 25))):
    for y, x in zip(*np.where(mk)):
        X = int(CX + (x - pcx) * K); Y = int(CY + (y - pcy) * K)
        if mk is glow:
            ordered(cv, X, Y, X + K, Y + K, cv.a[min(Y, H - 1), min(X, W - 1)].tolist(), col, lambda a, b: 0.6)
        else:
            cv.rect(X, Y, X + K, Y + K, col)
# Kerzen der Karte (helle Pixel + ihre Flammen) an ihren Stellen
cand = (sc.max(-1) > 190) | ((hsv_of(sc.astype(int))[..., 0] > 10) & (hsv_of(sc.astype(int))[..., 0] < 35) & (hsv_of(sc.astype(int))[..., 1] > 150))
cand &= ((xx + .5 - pcx) ** 2 + (yy + .5 - pcy) ** 2) < 22 ** 2
for y, x in zip(*np.where(cand)):
    X = int(CX + (x - pcx) * K); Y = int(CY + (y - pcy) * K)
    cv.rect(X, Y, X + K, Y + K, sc[y, x])

demons = [('Infernous Demon', 38, 25), ('Herbithorn Demon', 40, 22), ('Hydrogen Demon', 38, 24),
          ('Serpentous Demon', 37, 23), ('Bouldor Demon', 38, 23)]
R = 13
for i, (n, bx, by) in enumerate(demons):
    th = math.radians(36 + i * 72)
    px = CX + 94 * math.sin(th); py = CY - 124 * math.cos(th)
    a = nat(n)
    m = up(hsv_shift(disc(a, bx, by, R), 0, 1.45, 1.08), 2)
    ring(cv, px, py, 0, 2 * R + 4, (30, 5, 5))
    ring(cv, px, py, 0, 2 * R + 3, (150, 25, 20))
    ring(cv, px, py, 0, 2 * R + 1, (70, 10, 10))
    paste(cv, m, int(px) - 2 * R, int(py) - 2 * R)

for i, c in enumerate([(30, 5, 5), (150, 25, 20), (70, 10, 10), (30, 5, 5)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '09_cycling_demons.png'))
