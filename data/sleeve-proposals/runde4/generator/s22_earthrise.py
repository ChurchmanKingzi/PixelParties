# -*- coding: utf-8 -*-
"""22 Earthrise – Nomu, der Wanderer der Welten, steht auf dem Mond; hinter ihm geht riesig die Erde auf.

Quellen (MotiveBoons.xcf):
  Ebene 80 „Hintergrund“ – Weltraum mit Sternen und Erde (Ausschnitt 125×175 um die Erde), 2×
  Ebene 2  „Nomu“        – Nomu mit Hut und weißem Anzug (geprüft gegen „Sichtbar #22“: vollständig), 5×
  Ebene 73 „Ebene #2“    – Mond: liefert nur die Farbpalette des Mondbodens
Selbst gezeichnet (2×-Raster): Mondboden mit Horizontkrümmung, Kratern, Erdlicht-Schimmer, Nomus Schatten.

Tiefenebenen / Skalierung:
  Weltraum + Erde + Mondboden ... 125×175-Raster, 2×
  Nomu (Vordergrund) ............ 50×70-Raster, 5×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vgrad, radial  # noqa
import math
import numpy as np

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


# ---------- Ebene 1 (2×): Weltraum + Erde ----------
space = layer(B, 80)[206:446, 119:439]          # 240×320 Weltraum, Erde bei x 110–210, y 70–170
EX, EY, ER = 160, 120, 50                        # Erdmittelpunkt/-radius im Weltraum-Ausschnitt
g = Canvas(125, 175)
ox, oy = EX - 62, EY - 76                        # Erde im 125er-Raster bei (62, 76)
g.a[:] = space[oy:oy + 175, ox:ox + 125][..., :3] if oy >= 0 else 0
if oy < 0:
    g.a[-oy:] = space[0:175 + oy, ox:ox + 125][..., :3]
    # fehlende Zeilen oben mit gespiegeltem Sternhimmel auffüllen
    g.a[:-oy] = space[-oy - 1::-1][:, ox:ox + 125][..., :3][: -oy]

# ---------- Mondboden (2×) ----------
M_L, M_1, M_2, M_3, M_4, M_D = (189, 197, 171), (158, 171, 133), (139, 150, 117), (115, 125, 96), (93, 100, 80), (58, 62, 50)
HZ = 104                                          # Horizont in der Bildmitte
yy, xx = np.mgrid[0:175, 0:125]
horizon = HZ + ((xx + .5 - 62.5) / 62.5) ** 2 * 7   # leicht gekrümmt (Mondkugel)
ground = yy >= horizon
for y in range(175):
    for x in range(125):
        if not ground[y, x]: continue
        d = (y - horizon[y, x])                    # Tiefe unter dem Horizont
        th = BAYER4[y % 4, x % 4]
        t = min(1, d / 60 + abs(x - 62.5) / 62.5 * 0.25)   # hinten heller (Erdlicht), vorne/außen dunkler
        if t < 0.08: c = M_L if (0.08 - t) * 12 > th else M_1
        elif t < 0.30: c = M_1 if (0.30 - t) * 4.5 > th else M_2
        elif t < 0.60: c = M_2 if (0.60 - t) * 3.3 > th else M_3
        elif t < 0.90: c = M_3 if (0.90 - t) * 3.3 > th else M_4
        else: c = M_4 if (1.15 - t) * 4 > th else M_D
        g.a[y, x] = c
# Horizontkante
for x in range(125):
    y = int(math.ceil(horizon[0, x] + 0 * x))
    y = int(math.ceil(HZ + ((x + .5 - 62.5) / 62.5) ** 2 * 7))
    g.px(x, y, M_L)
# Krater: flache Ellipsen (Perspektive), Rand oben dunkel / unten hell
craters = [(20, 116, 7, 2.2), (98, 114, 9, 2.6), (58, 124, 5, 1.6), (12, 140, 12, 4), (106, 146, 14, 4.5),
           (40, 158, 9, 3), (84, 128, 4, 1.4), (70, 168, 10, 3), (30, 128, 4, 1.3)]
for cx, cy, rx, ry in craters:
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            if not (0 <= x < 125 and 0 <= y < 175) or not ground[y, x]: continue
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            up_ = (y + .5 - cy) < 0
            if e < 1:
                g.a[y, x] = M_4 if up_ else M_3
                if up_ and e > 0.45: g.a[y, x] = M_D
            elif e < 1.6:
                g.a[y, x] = M_L if not up_ else M_2
# Steinchen
rng = np.random.RandomState(22)
for _ in range(40):
    x, y = rng.randint(0, 125), rng.randint(HZ + 8, 175)
    if ground[y, x]:
        g.px(x, y, M_D); g.px(x, y - 1, M_L)

# ---------- Ebene 2 (5×): Nomu ----------
nomu = sprite('e22_nomu', B, [2])
NX, NFOOT = 25, 64                                 # Mitte / Fußlinie im 50×70-Raster
fx, fy = NX * 5 / 2, NFOOT * 5 / 2                 # Fußpunkt im 125er-Raster
# Schatten: Gegenlicht der Erde -> Schatten fällt nach vorn (zum Betrachter)
for y in range(int(fy - 2), int(fy + 6)):
    for x in range(int(fx - 16), int(fx + 17)):
        e = ((x + .5 - fx) / 14) ** 2 + ((y + .5 - (fy + 1.5)) / 3.6) ** 2
        if e < 1 and 0 <= x < 125 and 0 <= y < 175 and (1 - e) * 1.6 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = (g.a[y, x] * 0.5).astype(np.uint8)

cv = Canvas(W, H)
cv.a[:] = lift(g.a, 2)
L = rgba(50, 70)
put(L, nomu, NX - nomu.shape[1] // 2, NFOOT - nomu.shape[0])
cv.paste(lift(L, 5), 0, 0)
print(save(cv, '22_earthrise.png'))
