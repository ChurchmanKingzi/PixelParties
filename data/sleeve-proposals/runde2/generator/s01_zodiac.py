# -*- coding: utf-8 -*-
"""Sleeve: Kreis der zwölf Guardian Beasts – Medaillons aus den 12 Kartenbildern,
Mitte: Yin-Yang aus „Charm of Balance“, Boden/Ziegel aus „Guard Duty“/„Guardian Beast Yang“."""
import math, numpy as np
from kit import *

cv = Canvas(W, H)
# Hintergrund: dunkles Mauerwerk aus Guardian Beast Yang (links, x0..16), 2× skaliert
# Hintergrund: das Labyrinth-Muster aus „Guardian Beast Tu“, gespiegelt gekachelt und abgedunkelt
tu = nat('Guardian Beast Tu')[:, 0:26]
t2 = np.concatenate([tu, tu[:, ::-1]], 1)
t2 = np.concatenate([t2, t2[::-1]], 0)
tile = up(np.dstack([t2, np.full(t2.shape[:2], 255, np.uint8)]), 2)
tile = hsv_shift(tile, 0, 1.1, 0.33)
fill_tiles(cv, tile, ox=7, oy=11)
vignette(cv, 0.6, 0.3)

# Ziegelband (Guard Duty, gelbe Ziegel oben) entlang der Ellipse
gd = nat('Guard Duty')
brick = up(np.dstack([gd[0:10, 0:20], np.full((10, 20), 255, np.uint8)]), 1)
CX, CY, AX, AY = 125, 175, 92, 136
for y in range(H):
    for x in range(W):
        d = math.hypot((x + .5 - CX) / AX, (y + .5 - CY) / AY)
        r = d * 1.0
        if abs(d - 1) < 4.2 / 115:
            cv.a[y, x] = brick[y % 10, x % 20][:3]
        elif abs(d - 1) < 5.6 / 115:
            cv.a[y, x] = (40, 18, 8)

# Mitte: Steinboden-Scheibe aus Charm of Balance mit Yin-Yang, 3×
cob = nat('Charm of Balance')
yy = cut('Charm of Balance', (32, 23, 44, 36), bg=[(32, 23), (43, 23), (32, 35), (43, 35)], tol=60)
# nur Schwarz/Weiß behalten
m = (yy[..., :3].max(-1) < 60) | (yy[..., :3].min(-1) > 200)
yy[..., 3] = np.where(m, 255, 0)
yy = trim(yy)
fsrc = cob[20:38, 48:66]
f2 = np.concatenate([fsrc, fsrc[:, ::-1]], 1); f2 = np.concatenate([f2, f2[::-1]], 0)
floor = disc(f2, 18, 18, 17)
fl = up(floor, 3)
for r in ((54, (40, 18, 8)), (53, (250, 190, 70)), (51, (200, 110, 30)), (50, (40, 18, 8))):
    ring(cv, CX, CY - 8, 0, r[0], r[1])
paste(cv, fl[3:-3, 3:-3], CX, CY - 8, 'c')
Y = up(outline(yy, (70, 60, 80)), 5)
drop_shadow(cv, Y, CX - Y.shape[1] // 2, CY - 8 - Y.shape[0] // 2, 3, 3, (30, 20, 30), 0.6)

# Zwölf Medaillons (Reihenfolge des Tierkreises, oben beginnend im Uhrzeigersinn)
beasts = [('Shu', 36, 24), ('Niu', 38, 22), ('Hu', 37, 24), ('Tu', 37, 20), ('Long', 38, 18), ('She', 41, 26),
          ('Ma', 37, 24), ('Yang', 38, 27), ('Hou', 37, 27), ('Ji', 38, 30), ('Gou', 37, 28), ('Zhu', 31, 27)]
R = 12
# gleichmäßige Bogenlänge auf der Ellipse
ts = np.linspace(0, 2 * math.pi, 4000)
pts = np.stack([CX + AX * np.sin(ts), CY - AY * np.cos(ts)], 1)
seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
L = seg[-1]
for i, (n, bx, by) in enumerate(beasts):
    j = np.searchsorted(seg, L * i / 12)
    px, py = pts[j]
    a = nat('Guardian Beast ' + n)
    d = up(disc(a, bx, by, R), 2)
    ring(cv, px, py, 0, 2 * R + 3, (40, 18, 8))
    ring(cv, px, py, 0, 2 * R + 2, (250, 190, 70))
    ring(cv, px, py, 0, 2 * R + 1, (200, 110, 30))
    paste(cv, d, int(px) - 2 * R, int(py) - 2 * R)
    ring(cv, px, py, 2 * R - 1, 2 * R, (40, 18, 8))

# Rahmen
for i, c in enumerate([(40, 18, 8), (200, 110, 30), (250, 190, 70), (40, 18, 8)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '01_guardian_zodiac.png'))
