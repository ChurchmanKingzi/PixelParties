# -*- coding: utf-8 -*-
"""22 Earthrise – Nomu, der Wanderer der Welten, steht auf dem Mond und zeigt auf die riesige Erde, die
über dem Mondhorizont aufgeht.

Quellen (MotiveBoons.xcf):
  Ebene 80 „Hintergrund“ – Erde (100×100, weich gerendert) aus dem Weltraumbild; auf dem 2×-Raster in eine
             harte Palette umgesetzt: k-Means auf 6 Tagfarben (Meer/Land/Wolken), harte Scheibenkante,
             Nachtseite mit 3 dunklen Farben, Tag-/Nachtgrenze mit geordnetem Dithering, 2×
  Ebene 2  „Nomu“ – Nomu mit Hut und weißem Anzug (geprüft gegen „Sichtbar #22“: vollständig); zeigt mit
             ausgestrecktem Arm nach rechts auf die Erde, 5×
  Ebene 73 „Ebene #2“ – Mond: liefert die Farbpalette des Mondbodens
Selbst gezeichnet (2×-Raster): Sternhimmel, Mondboden mit Horizontkrümmung, Kratern, Nomus Schatten
(Sonnenlicht von links oben -> Schatten fällt nach rechts hinten).

Tiefenebenen / Skalierung:
  Himmel, Erde, Mondboden, Schatten ... 125×175-Raster, 2×
  Nomu (Vordergrund) .................. 50×70-Raster, 5×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vgrad  # noqa
import math
import numpy as np
import cv2

B = 'MotiveBoons'
W, H = 250, 350


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(L, s, x, y):
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(L.shape[1], x + w), min(L.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] > 127
    L[Y0:Y1, X0:X1][m] = sub[m]


def lift(L, k):
    return up(L, k)[:H, :W]


# ---------- Erde: harte Palette ----------
space = layer(B, 80)[206:446, 119:439][..., :3]      # Weltraumbild, Erde bei x 110–210, y 70–170
ER = 50
earth = space[70:170, 110:210].astype(np.float32)    # 100×100
yy, xx = np.mgrid[0:100, 0:100]
nx, ny = (xx + .5 - 50) / ER, (yy + .5 - 50) / ER
disk = nx * nx + ny * ny < 0.955                        # innerhalb der weichen Randabdunklung
pix = earth[disk].reshape(-1, 3)
crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
_, lab, cen = cv2.kmeans(pix, 6, None, crit, 5, cv2.KMEANS_PP_CENTERS)
cen = cen.astype(int)
day = [tuple(int(v) for v in c) for c in cen]
# Klasse je Farbe: Land (grün > blau), Wolke (hell), sonst Meer
def kind(c):
    r, g, b = c
    if g > b - 10: return 'land'
    if min(c) > 150: return 'cloud'
    return 'sea'
NIGHT = {'sea': (14, 20, 64), 'land': (12, 36, 34), 'cloud': (52, 60, 110)}
labimg = np.full((100, 100), -1, int); labimg[disk] = lab.ravel()
nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
light = np.array([-0.62, -0.42, 0.66]); light /= np.linalg.norm(light)
lam = nx * light[0] + ny * light[1] + nz * light[2]    # Sonnenlicht von links oben
EARTH = np.zeros((100, 100, 4), np.uint8)
for y in range(100):
    for x in range(100):
        if not disk[y, x]: continue
        c = day[labimg[y, x]]
        t = lam[y, x]
        # breite, gedithertes Dämmerungsband; der Rand im Sonnenlicht bekommt eine hellere Kante
        if t < -0.05 or (t < 0.22 and (t + 0.05) / 0.27 < BAYER4[y % 4, x % 4]):
            c = NIGHT[kind(c)]
        EARTH[y, x, :3] = c; EARTH[y, x, 3] = 255
# Atmosphärensaum auf der Tagseite (1 Pixel)
ring = (nx * nx + ny * ny < 1.0) & ~disk
for y, x in zip(*np.where(ring)):
    if lam[y, x] > -0.1 or (lam[y, x] > -0.3 and BAYER4[y % 4, x % 4] < 0.5):
        EARTH[y, x] = (150, 176, 255, 255)

# ---------- Ebene 1 (2×): Himmel ----------
g = Canvas(125, 175)
vgrad(g, [(0, (2, 3, 16)), (0.6, (6, 10, 34)), (1, (12, 18, 52))])
rng = np.random.RandomState(22)
for _ in range(70):
    x, y = rng.randint(0, 125), rng.randint(0, 140)
    g.px(x, y, (230, 234, 255) if rng.rand() < .35 else (110, 120, 170))
for (x, y) in [(12, 14), (60, 8), (112, 40), (20, 70)]:
    for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        g.px(x + dx, y + dy, (240, 244, 255) if (dx, dy) == (0, 0) else (120, 130, 190))
EX, EY = 76, 92                                     # Erdmittelpunkt im 125er-Raster
g.paste(EARTH, EX - 50, EY - 50)

# ---------- Mondboden (2×) ----------
M_L, M_1, M_2, M_3, M_4, M_D = (189, 197, 171), (158, 171, 133), (139, 150, 117), (115, 125, 96), (93, 100, 80), (58, 62, 50)
HZ = 136
yy, xx = np.mgrid[0:175, 0:125]
horizon = HZ + ((xx + .5 - 62.5) / 62.5) ** 2 * 5
ground = yy >= horizon
for y in range(175):
    for x in range(125):
        if not ground[y, x]: continue
        d = y - horizon[y, x]
        th = BAYER4[y % 4, x % 4]
        t = min(1, d / 40 + (x / 125) * 0.3)           # Sonne links: links heller, rechts dunkler
        if t < 0.10: c = M_L if (0.10 - t) * 10 > th else M_1
        elif t < 0.35: c = M_1 if (0.35 - t) * 4 > th else M_2
        elif t < 0.65: c = M_2 if (0.65 - t) * 3.3 > th else M_3
        elif t < 0.95: c = M_3 if (0.95 - t) * 3.3 > th else M_4
        else: c = M_4 if (1.2 - t) * 4 > th else M_D
        g.a[y, x] = c
for x in range(125):
    g.px(x, int(math.ceil(HZ + ((x + .5 - 62.5) / 62.5) ** 2 * 5)), M_L)
craters = [(96, 142, 9, 2.0), (20, 146, 6, 1.6), (108, 160, 12, 3.0), (60, 150, 5, 1.4), (78, 168, 9, 2.4)]
for cx, cy, rx, ry in craters:
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            if not (0 <= x < 125 and 0 <= y < 175) or not ground[y, x]: continue
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            upper = (y + .5 - cy) < 0
            if e < 1:
                g.a[y, x] = M_D if (upper and e > 0.45) else (M_4 if upper else M_3)
            elif e < 1.6:
                g.a[y, x] = M_2 if upper else M_L
for _ in range(30):
    x, y = rng.randint(0, 125), rng.randint(HZ + 4, 175)
    if ground[y, x]:
        g.px(x, y, M_D); g.px(x, y - 1, M_L)

# ---------- Ebene 2 (5×): Nomu ----------
nomu = sprite('e22_nomu', B, [2])                   # 19×26, zeigt mit dem Arm nach rechts
NX, NFOOT = 15, 64                                   # links im Bild, Fußlinie im 50×70-Raster
fx, fy = NX * 2.5, NFOOT * 2.5
# Schlagschatten: Sonne links oben -> Schatten nach rechts hinten, flach und länglich
for y in range(int(fy - 4), int(fy + 3)):
    for x in range(int(fx - 8), int(fx + 34)):
        e = ((x + .5 - (fx + 12)) / 21) ** 2 + ((y + .5 - (fy - 0.8)) / 2.6) ** 2
        if e < 1 and 0 <= x < 125 and 0 <= y < 175 and (1 - e) * 1.8 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = (g.a[y, x] * 0.45).astype(np.uint8)

out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
L = rgba(50, 70)
put(L, nomu, NX - nomu.shape[1] // 2, NFOOT - nomu.shape[0])
out.paste(lift(L, 5), 0, 0)
print(save(out, '22_earthrise.png'))
