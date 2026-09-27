# -*- coding: utf-8 -*-
"""21 Cheese Moon – der Holy Cheese fliegt nachts heim zu einem riesigen Vollmond aus Emmentaler,
vor dem der Nerdy Cheese mit seinen Fledermausflügeln wie eine Fledermaus vorbeizieht.

Quellen (MotiveMoe.xcf, Karten „Holy Cheese“, „Nerdy Cheese“):
  Ebene 312 „Holy Cheese“   – Käse mit Engelsflügeln + Heiligenschein (ohne den losen weißen Balken)
  Ebene 310 „Nerdy Cheese“  – violetter Käse mit Brille und hohen Fledermausflügeln
Selbst gezeichnet: Nachthimmel, Sterne, Mond mit Emmentaler-Löchern (Farben aus der Holy-Cheese-Palette).

Tiefenebenen / Skalierung:
  Himmel, Sterne, Mond ........ 125×175-Raster, 2×
  Nerdy Cheese vor dem Mond ... 125×175-Raster, 2×
  vorderer Käse (Holy Cheese) . 84×117-Raster, 3×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa  (runde4/common – muss vor bkit geladen sein)
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vgrad, radial, disk_mask, lerpc  # noqa
import math
import numpy as np

M = 'MotiveMoe'
W, H = 250, 350


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(L, s, x, y):
    """RGBA-Sprite s in die RGBA-Ebene L setzen (harte Kanten)."""
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(L.shape[1], x + w), min(L.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] > 127
    L[Y0:Y1, X0:X1][m] = sub[m]


def lift(L, k):
    """Ebene auf ihrem Raster k-fach hochskalieren und auf 250×350 zuschneiden."""
    return up(L, k)[:H, :W]


# ---------- Sprites ----------
holy = sprite('e21_holy', M, [312])
holy = [p for p in parts(holy, dil=1) if p.shape[1] > 5]          # weißen Balken weglassen
hb, hh = [p for p in holy if p.shape[0] > 20][0], [p for p in holy if p.shape[0] <= 12][0]
# Heiligenschein wieder genau wie in der Ebene über den Käse setzen
full = compose(M, [312], crop=False)
full[..., 3] = np.where(full[..., 3] >= 128, 255, 0)
bb = bbox(full)
full = full[bb[1]:bb[3], bb[0]:bb[2]]
cols = (full[..., 3] > 0).sum(0)
xs = np.where(cols > 0)[0]
# rechten Balken (schmale Spalte weit rechts) abschneiden
gap = [x for x in range(1, len(xs)) if xs[x] - xs[x - 1] > 3]
HOLY = full[:, :xs[gap[0] - 1] + 1] if gap else full
HOLY = HOLY[:, :]; b = bbox(HOLY); HOLY = HOLY[b[1]:b[3], b[0]:b[2]]
NERD = sprite('e21_nerdy', M, [310])

# ---------- Ebene 1: Himmel + Mond (2×) ----------
g = Canvas(125, 175)
vgrad(g, [(0, (6, 8, 30)), (0.5, (14, 20, 58)), (1, (24, 30, 80))])
MX, MY, MR = 62.5, 56, 41
radial(g, MX, MY, MR + 26, (24, 32, 84), 0.9, power=0.9)
radial(g, MX, MY, MR + 12, (46, 52, 110), 0.8, power=0.8)
rng = np.random.RandomState(21)
for _ in range(60):
    x, y = rng.randint(0, 125), rng.randint(0, 175)
    if math.hypot(x - MX, y - MY) < MR + 16: continue
    g.px(x, y, (200, 210, 255) if rng.rand() < .4 else (110, 120, 180))
for (x, y) in [(16, 20), (108, 16), (12, 118), (113, 128), (22, 160), (100, 150)]:
    for ddx, ddy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        g.px(x + ddx, y + ddy, (236, 240, 255) if (ddx, ddy) == (0, 0) else (130, 140, 205))

# Käsemond (Farben der Holy-Cheese-Palette, etwas aufgehellt)
C_LT, C_BS, C_MD, C_DK, C_DD = (252, 240, 196), (246, 222, 150), (222, 186, 102), (176, 138, 58), (120, 86, 28)
yy, xx = np.mgrid[0:175, 0:125]
dx, dy = (xx + .5 - MX) / MR, (yy + .5 - MY) / MR
d2 = dx * dx + dy * dy
inside = d2 < 1
lamb = np.clip(-0.45 * dx - 0.40 * dy + 0.80 * np.sqrt(np.clip(1 - d2, 0, 1)), 0, 1)
for y in range(175):
    for x in range(125):
        if not inside[y, x]: continue
        t = lamb[y, x]; th = BAYER4[y % 4, x % 4]
        if t > 0.66: c = C_LT if (t - 0.66) * 4 > th else C_BS
        elif t > 0.34: c = C_BS if (t - 0.34) * 3 > th else C_MD
        else: c = C_MD if t * 3 > th else C_DK
        g.a[y, x] = c
# Löcher (Emmentaler): Innenwand oben-links dunkel, Boden etwas heller, Lichtkante unten-rechts
holes = [(-0.45, -0.38, 7.5, 6.0), (0.36, -0.55, 5.0, 4.2), (0.52, 0.10, 7.0, 6.0), (-0.12, 0.45, 6.0, 5.0),
         (-0.62, 0.30, 3.8, 3.2), (0.02, -0.08, 3.6, 3.0), (0.30, 0.66, 3.4, 2.8), (-0.22, -0.78, 3.0, 2.4),
         (0.78, -0.30, 2.6, 2.6), (-0.78, -0.02, 2.4, 3.0)]
for hx, hy, rx, ry in holes:
    cx, cy = MX + hx * MR, MY + hy * MR
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            if not (0 <= x < 125 and 0 <= y < 175) or not inside[y, x]: continue
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if e < 1:
                e2 = ((x + .5 - cx - 1.3) / rx) ** 2 + ((y + .5 - cy - 1.3) / ry) ** 2
                g.a[y, x] = C_MD if e2 < 0.55 else (C_DD if e2 < 1.0 else C_DK)
            elif e < 1.5 and (x + .5 - cx) / rx + (y + .5 - cy) / ry > 0.6:
                g.a[y, x] = C_LT
            elif e < 1.5 and (x + .5 - cx) / rx + (y + .5 - cy) / ry < -0.6:
                g.a[y, x] = C_MD
cv = Canvas(W, H)
cv.a[:] = lift(g.a, 2)

# ---------- Ebene 2: Nerdy Cheese quer vor dem Mond (2×) ----------
L2 = rgba(125, 175)
put(L2, NERD, 62 - NERD.shape[1] // 2, 24)
cv.paste(lift(L2, 2), 0, 0)

# ---------- Ebene 3: vorderer Holy Cheese (3×) ----------
L3 = rgba(84, 117)
put(L3, HOLY, 42 - HOLY.shape[1] // 2, 63)
cv.paste(lift(L3, 3), 0, 0)

print(save(cv, '21_cheese_moon.png'))
