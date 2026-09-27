# -*- coding: utf-8 -*-
"""Sleeve 54 – „Witching Hour“: Nacht über der Waldhütte. Fenster und offene Tür glühen warm, die Hexe mit
dem Besen steht im Lichtschein auf der Schwelle; über den Waldweg kommt der Elfendruide mit seiner grün
leuchtenden Kugel zu Besuch, Glühwürmchen tanzen zwischen den Bäumen.

Einheitlich 2×: die ganze Szene wird im nativen Raster (125×175) der Kartenkarte „Cottage“ komponiert und am
Ende verdoppelt – Hütte, Wald, Figuren, Licht und Glühwürmchen haben dieselbe Pixelgröße.

Quellen (MotiveGrailWar.xcf): Ebene 596 „Cottage“ (Waldhütte mit Weg, Holzstapeln, Schild; nachtblau
umgefärbt), 107 „Hexe“ (mit Besen), 139 „Elven Druid“ (mit Kugelstab).
Nachtfärbung, Fensterglühen, Lichtkegel, Kugelschein, Glühwürmchen: selbst gezeichnet (geordnetes Dithering).
Karten: Hexe/Witch-Motiv, Elven Druid.
"""
import numpy as np
from d_util import *  # noqa

K = 2
nc = native(K)
W, H = nc.w, nc.h
X0, Y0 = 193, 70
orig = region(B, [596], (X0, Y0, X0 + W, Y0 + H))[..., :3].astype(int)
yy, xx = np.mgrid[0:H, 0:W]
B8 = BAYER8[yy % 8, xx % 8]

# --- Nacht: kühl abdunkeln -----------------------------------------------------------------------------
lum = orig.mean(-1, keepdims=True)
night = np.clip((orig * 0.6 + lum * 0.4) * np.array([0.30, 0.37, 0.56]) + np.array([4, 6, 16]), 0, 255)
nc.a[:] = night.astype(np.uint8)

def light(cx, cy, rx, ry, warm, s=1.0):
    """Lichtkegel: innerhalb einer geditherten Ellipse die Originalfarben warm getönt zurückholen."""
    d = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    t = np.clip(1 - d, 0, 1) * s
    for lvl, f in [(0.0, 0.55), (0.35, 0.8), (0.7, 1.0)]:
        m = t > lvl + B8 * 0.35
        col = np.clip(orig * np.array(warm) * f, 0, 255)
        cur = nc.a.astype(int)
        nc.a[m] = np.maximum(cur, col.astype(int))[m].astype(np.uint8)

WARM = (1.05, 0.82, 0.52)
# Lichtschein unter den Fenstern und aus der Tür
for wx in (224, 287):
    light(wx - X0, 131 - Y0, 13, 10, WARM, 0.9)
light(255 - X0, 182 - Y0, 16, 20, WARM, 1.1)

# Fensterscheiben und offene Tür glühen
GLOW = [(255, 236, 160), (255, 198, 96), (232, 142, 52)]
for (x0, y0, x1, y1) in [(219, 125, 230, 136), (282, 125, 294, 136)]:
    sub = orig[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0]
    pane = sub.sum(-1) < 360
    ys, xs = np.where(pane)
    for y, x in zip(ys, xs):
        c = GLOW[1] if (y + x) % 3 else GLOW[0]
        nc.a[y0 - Y0 + y, x0 - X0 + x] = c
    frame = ~pane
    ys, xs = np.where(frame)
    nc.a[y0 - Y0 + ys, x0 - X0 + xs] = (110, 66, 30)
# Tür (248..263 × 140..170) steht offen: Innenlicht, nach oben heller
for y in range(141, 170):
    for x in range(250, 262):
        f = (y - 141) / 29.0
        i = 0 if f < 0.35 + BAYER8[y % 8, x % 8] * 0.3 else (1 if f < 0.8 + BAYER8[y % 8, x % 8] * 0.2 else 2)
        nc.a[y - Y0, x - X0] = GLOW[i]
# Türblatt nach innen links aufgeschwungen: schmaler dunkler Streifen
nc.a[141 - Y0:170 - Y0, 250 - X0] = (70, 34, 10)
nc.a[141 - Y0:170 - Y0, 251 - X0] = (120, 72, 28)

# --- Hexe auf der Schwelle -----------------------------------------------------------------------------
witch = sprite('d54_witch', B, [107])
put(nc, witch, 256 - X0, 173 - Y0, anchor='b')

# --- Elfendruide mit leuchtender Kugel auf dem Weg ------------------------------------------------------
druid = sprite('d54_druid', B, [139])
dx, dy = 236 - X0, 238 - Y0 - druid.shape[0]
# Kugel finden (hellgrüne Pixel) → grüner Schein auf den Weg
c = druid[..., :3].astype(int)
orb = (c[..., 1] > 150) & (c[..., 1] > c[..., 0] + 40) & (druid[..., 3] > 0)
oy, ox = np.where(orb)
ocx, ocy = dx + int(ox.mean()), dy + int(oy.mean())
light(ocx, ocy + 4, 20, 17, (0.6, 1.15, 0.65), 1.3)
blob(nc, dx + druid.shape[1] // 2, dy + druid.shape[0], 9, 2, (14, 20, 26), 1.0)
nc.paste(druid, dx, dy)

# --- Glühwürmchen ----------------------------------------------------------------------------------------
rng = np.random.RandomState(4)
for _ in range(14):
    x, y = rng.randint(2, W - 2), rng.randint(2, H - 2)
    if 6 < y < 102 and 6 < x < 120: continue          # nicht auf der Hütte
    nc.px(x, y, (220, 255, 130))
    if rng.rand() < 0.5: nc.px(x + 1, y, (120, 170, 60))

vignette(nc, 0.4, 0.6)
cv = finish(nc, K)
print(save(cv, '54_witching_hour.png'))
