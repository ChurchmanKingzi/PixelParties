# -*- coding: utf-8 -*-
"""23 Root of all Presents – Weihnachtsnacht: der böse Wurzelbaum, mit Lichterketten und Weihnachtsmützen
geschmückt, steht grinsend mitten im Schnee; an seinen Wurzeln warten zwei Geschenke, es schneit.

Quellen (MotiveMoe.xcf):
  Ebene 178 „The Root of all Presents“ – Baum mit Mützen und Lichterkette (vollständige Ebene), 4×
  Ebene 176 „Ebene #159“ – Geschenkestapel aus derselben Szene („Sichtbar #91“); verwendet wird das
             rechte, unverdeckte rote Paket (rechts) und seine gespiegelte, grün umgefärbte Kopie (links), 4×
  Ebene 129 „Ebene #174“ – Schneetextur des Winterdorfs (sauberer Ausschnitt, gespiegelt gekachelt,
             nächtlich blau getönt), 2×
Selbst gezeichnet (2×-Raster): Nachthimmel, Schneehügel, Schneefall, warmer Lichtschein um den Baum,
farbiger Schein jeder Lichterketten-Birne, Schatten; (4×-Raster): einige große Flocken vorn.

Tiefenebenen / Skalierung:
  Himmel, Hügel, Schneeboden, Schneefall hinten ... 125×175-Raster, 2×
  Baum + Geschenke ............................... 63×88-Raster, 4×
  Schneeflocken vorn ............................. 63×88-Raster, 4× (wenige, groß)
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vgrad, radial  # noqa
import math
import numpy as np

M = 'MotiveMoe'
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


# ---------- Sprites ----------
TREE = sprite('e23_root', M, [178])                       # 46×60
pile = sprite('e23_gifts', M, [176])                      # 45×33
# rechtes rotes Paket: Zeilen 5–19, Spalten 30–44 (+ Schleifenspitze in Zeile 4, Spalten 37–40)
box = np.zeros((16, 15, 4), np.uint8)
box[1:] = pile[5:20, 30:45]
box[0, 7:11] = pile[4, 37:41]
b = bbox(box); BOX_R = box[b[1]:b[3], b[0]:b[2]]
# Lücken am linken Rand (dort lag das blaue Paket) mit Umrissfarbe schließen
BOX_L = hsv_shift(flip(BOX_R), dh=125, ds=0.9, dv=1.05)   # grün umgefärbt, gespiegelt
wh = (BOX_L[..., :3].min(-1) > 180)                       # Band/Glanz wieder weiß
BOX_L[wh, :3] = flip(BOX_R)[wh, :3]

# ---------- Ebene 1 (2×): Himmel ----------
g = Canvas(125, 175)
vgrad(g, [(0, (6, 8, 26)), (0.55, (18, 24, 64)), (1, (40, 46, 96))])
rng = np.random.RandomState(23)
for _ in range(45):
    x, y = rng.randint(0, 125), rng.randint(0, 95)
    g.px(x, y, (190, 200, 240) if rng.rand() < .35 else (100, 110, 170))
# warmer Lichtschein der Lichterkette
radial(g, 62.5, 78, 52, (44, 40, 86), 0.9, power=0.8)
radial(g, 62.5, 80, 36, (70, 52, 92), 0.7, power=0.9)

# Schneehügel hinten (zwei Staffeln)
yy, xx = np.mgrid[0:175, 0:125]
h1 = 112 - 10 * np.exp(-((xx - 18) / 26.0) ** 2) - 7 * np.exp(-((xx - 104) / 22.0) ** 2)
h2 = 124 - 4 * np.sin(xx * 0.08 + 0.6)
for y in range(175):
    for x in range(125):
        if y >= h1[y, x] and y < h2[y, x]:
            t = (y - h1[y, x]) / 14
            g.a[y, x] = (96, 104, 150) if t * 1.3 > BAYER4[y % 4, x % 4] else (126, 134, 180)

# Schneeboden aus der Winterdorf-Textur (nachtblau getönt), ab h2
snow = compose(M, [129])[142:228, 44:72]                           # sauberer Ausschnitt 28×86
tile = np.concatenate([snow, flip(snow)], 1)[..., :3].astype(float)
night = np.array([0.62, 0.66, 0.86])
for y in range(175):
    for x in range(125):
        if y >= h2[y, x]:
            c = tile[(y - 120) % tile.shape[0], x % tile.shape[1]] * night
            d = (y - h2[y, x]) / 50
            f = 1.0 - 0.35 * min(1, d) - 0.25 * abs(x - 62.5) / 62.5
            g.a[y, x] = (c * f).clip(0, 255)
# Kante Hügel/Boden
for x in range(125):
    g.px(x, int(math.ceil(h2[0, x])), (150, 158, 204))

# ---------- Ebene 2 (4×): Baum + Geschenke ----------
TX, TBASE = 31, 77                                # Baummitte / Fußlinie im 63×88-Raster
tx0 = TX - TREE.shape[1] // 2
# Schatten unter dem Baum (2×-Raster, Ellipse)
fx, fy = TX * 2, TBASE * 2
for y in range(int(fy - 4), int(fy + 5)):
    for x in range(int(fx - 34), int(fx + 35)):
        e = ((x + .5 - fx) / 32) ** 2 + ((y + .5 - fy) / 4) ** 2
        if e < 1 and 0 <= y < 175 and (1 - e) * 1.8 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = (g.a[y, x] * 0.55).astype(np.uint8)
# Schneefall hinten (2×): kleine Flocken
for _ in range(90):
    x, y = rng.randint(0, 125), rng.randint(0, 150)
    g.px(x, y, (230, 236, 255) if rng.rand() < .6 else (160, 170, 215))

# Lichtschein jeder Birne der Lichterkette (2×-Raster, gedithert, hinter dem Baum)
import cv2
hsv = cv2.cvtColor(TREE[..., :3].reshape(-1, 1, 3), cv2.COLOR_RGB2HSV_FULL).reshape(TREE.shape[:2] + (3,))
bulb = (TREE[..., 3] > 0) & (hsv[..., 1] > 170) & (hsv[..., 2] > 200)
ty0 = TBASE - TREE.shape[0]
for (by, bx) in zip(*np.where(bulb)):
    col = np.array(TREE[by, bx, :3], float)
    cx, cy = (tx0 + bx) * 2 + 1, (ty0 + by) * 2 + 1
    for y in range(cy - 5, cy + 6):
        for x in range(cx - 5, cx + 6):
            if not (0 <= x < 125 and 0 <= y < 175): continue
            d = math.hypot(x - cx, y - cy) / 5.5
            if d < 1 and (1 - d) * 0.55 > BAYER4[y % 4, x % 4]:
                g.a[y, x] = (g.a[y, x] * 0.7 + col * 0.3).astype(np.uint8)

cv = Canvas(W, H)
cv.a[:] = lift(g.a, 2)

L = rgba(63, 88)
put(L, TREE, tx0, TBASE - TREE.shape[0])
put(L, BOX_L, tx0 + 1, TBASE - BOX_L.shape[0] + 1)
put(L, BOX_R, tx0 + TREE.shape[1] - BOX_R.shape[1] - 1, TBASE - BOX_R.shape[0] + 1)
cv.paste(lift(L, 4), 0, 0)

# ---------- Ebene 3 (4×): ein paar große Flocken vorn ----------
F = rgba(63, 88)
for (x, y) in [(6, 18), (56, 12), (10, 52), (54, 44), (22, 8), (44, 70), (4, 80)]:
    F[y, x] = (240, 244, 255, 255)
cv.paste(lift(F, 4), 0, 0)
print(save(cv, '23_root_of_all_presents.png'))
