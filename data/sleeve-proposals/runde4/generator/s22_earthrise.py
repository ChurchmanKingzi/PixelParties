# -*- coding: utf-8 -*-
"""22 Earthrise – Nomu, der Wanderer der Welten, steht auf dem Mond und zeigt auf die riesige Erde, die
über dem Mondhorizont aufgeht.

Quellen (MotiveBoons.xcf):
  Ebene 74 „Ebene #3“ – die würfelförmige Erde der Boons-Welt (36×36, vollständig), 3×
  Ebene 2  „Nomu“ – Nomu mit Hut und weißem Anzug (geprüft gegen „Sichtbar #22“: vollständig); zeigt mit
             ausgestrecktem Arm nach rechts auf die Erde, 5×
  Ebene 73 „Ebene #2“ – Mond: liefert die Farbpalette des Mondbodens
Selbst gezeichnet (3×-Raster): Sternhimmel, Mondboden mit Horizontkrümmung, Kratern, Nomus Schatten
(Sonnenlicht von links oben -> Schatten fällt nach rechts hinten), kleine Sonne links oben.

Tiefenebenen / Skalierung:
  Himmel, Erdwürfel, Mondboden, Schatten ... 84×117-Raster, 3×
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


# ---------- Erde: der Würfel aus MotiveBoons (Ebene 74) ----------
EARTH = sprite('e22_cube_earth', B, [74])              # 36×36

# ---------- Ebene 1 (3×): Himmel ----------
GW, GH = 84, 117
g = Canvas(GW, GH)
vgrad(g, [(0, (2, 3, 16)), (0.6, (6, 10, 34)), (1, (12, 18, 52))])
rng = np.random.RandomState(22)
for _ in range(45):
    x, y = rng.randint(0, GW), rng.randint(0, 94)
    g.px(x, y, (230, 234, 255) if rng.rand() < .35 else (110, 120, 170))
for (x, y) in [(46, 8), (74, 22), (8, 50), (30, 36)]:
    for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        g.px(x + dx, y + dy, (240, 244, 255) if (dx, dy) == (0, 0) else (120, 130, 190))
EX, EY = 60, 74                                     # Mitte des Erdwürfels im 84er-Raster (Unterkante hinter dem Horizont)
g.paste(EARTH, EX - 18, EY - 18)
# Sonne links oben (Lichtquelle für Erdwürfel und Nomus Schatten): kleine Scheibe mit geditherter Korona
SUX, SUY = 15, 17
for y in range(SUY - 8, SUY + 9):
    for x in range(SUX - 8, SUX + 9):
        d = math.hypot(x + .5 - SUX, y + .5 - SUY)
        if d < 3.2: g.px(x, y, (255, 250, 228))
        elif d < 4.2: g.px(x, y, (255, 226, 150))
        elif d < 8 and (1 - (d - 4.2) / 3.8) * 0.8 > BAYER4[y % 4, x % 4]: g.px(x, y, (120, 110, 150))

# ---------- Mondboden (3×) ----------
M_L, M_1, M_2, M_3, M_4, M_D = (189, 197, 171), (158, 171, 133), (139, 150, 117), (115, 125, 96), (93, 100, 80), (58, 62, 50)
HZ = 90
yy, xx = np.mgrid[0:GH, 0:GW]
horizon = HZ + ((xx + .5 - GW / 2) / (GW / 2)) ** 2 * 3.5
ground = yy >= horizon
for y in range(GH):
    for x in range(GW):
        if not ground[y, x]: continue
        d = y - horizon[y, x]
        th = BAYER4[y % 4, x % 4]
        t = min(1, d / 27 + (x / GW) * 0.3)           # Sonne links: links heller, rechts dunkler
        if t < 0.10: c = M_L if (0.10 - t) * 10 > th else M_1
        elif t < 0.35: c = M_1 if (0.35 - t) * 4 > th else M_2
        elif t < 0.65: c = M_2 if (0.65 - t) * 3.3 > th else M_3
        elif t < 0.95: c = M_3 if (0.95 - t) * 3.3 > th else M_4
        else: c = M_4 if (1.2 - t) * 4 > th else M_D
        g.a[y, x] = c
for x in range(GW):
    g.px(x, int(math.ceil(HZ + ((x + .5 - GW / 2) / (GW / 2)) ** 2 * 3.5)), M_L)
craters = [(64, 95, 6, 1.4), (13, 98, 4, 1.1), (72, 107, 8, 2.0), (40, 100, 3.5, 1.0), (52, 112, 6, 1.6)]
for cx, cy, rx, ry in craters:
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            if not (0 <= x < GW and 0 <= y < GH) or not ground[y, x]: continue
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            upper = (y + .5 - cy) < 0
            if e < 1:
                g.a[y, x] = M_D if (upper and e > 0.45) else (M_4 if upper else M_3)
            elif e < 1.6:
                g.a[y, x] = M_2 if upper else M_L
for _ in range(20):
    x, y = rng.randint(0, GW), rng.randint(HZ + 3, GH)
    if ground[y, x]:
        g.px(x, y, M_D); g.px(x, y - 1, M_L)

# ---------- Ebene 2 (5×): Nomu ----------
nomu = sprite('e22_nomu', B, [2])                   # 19×26, zeigt mit dem Arm nach rechts
NX, NFOOT = 15, 64                                   # links im Bild, Fußlinie im 50×70-Raster
fx, fy = NX * 5 / 3, NFOOT * 5 / 3
# Schlagschatten: Sonne links oben -> Schatten nach rechts hinten, flach und länglich
for y in range(int(fy - 3), int(fy + 2)):
    for x in range(int(fx - 6), int(fx + 23)):
        e = ((x + .5 - (fx + 8)) / 14) ** 2 + ((y + .5 - (fy - 0.5)) / 1.8) ** 2
        if e < 1 and 0 <= x < GW and 0 <= y < GH and (1 - e) * 1.8 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = (g.a[y, x] * 0.45).astype(np.uint8)

out = Canvas(W, H)
out.a[:] = lift(g.a, 3)
L = rgba(50, 70)
put(L, nomu, NX - nomu.shape[1] // 2, NFOOT - nomu.shape[0])
out.paste(lift(L, 5), 0, 0)
print(save(out, '22_earthrise.png'))
