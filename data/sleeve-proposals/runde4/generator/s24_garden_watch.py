# -*- coding: utf-8 -*-
"""24 Garden Watch – Porträt aus Froschperspektive: der „unauffällige“ Gartenzwerg mit Sonnenbrille steht groß
im Vordergrund neben dem Pflasterweg und bewacht die Tür des Häuschens auf der fliegenden Insel.

Quellen (MotiveMoe.xcf):
  Ebene 212 „Inconspicuous Lawn Gnome“ – Gartenzwerg (geprüft gegen „Sichtbar #72“: vollständig), 5×
  Ebene 457 „Hausinsel“ – Insel mit Haus, Tür, Fenster, Efeu, Pflasterweg (Ausschnitt 125×175), 2×
  Ebene 553 „Hintergrund“ – Himmel mit Wolken (Ausschnitt), 2×
  Ebene 478 „Relic-Insel“ – zwei Blumenbüschel aus dem Rasen, 2×
Selbst gezeichnet: Schatten des Zwergs (2×-Raster).

Tiefenebenen / Skalierung:
  Himmel, Insel mit Haus, Blumen ... 125×175-Raster, 2×
  Gartenzwerg (Vordergrund) ........ 50×70-Raster, 5×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
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


# ---------- Ebene 1 (2×): Himmel + Hausinsel ----------
sky = layer(M, 553)[151 + 60:151 + 60 + 175, 150:275][..., :3]
g = Canvas(125, 175)
g.a[:] = sky
isle = sprite('e24_hausinsel', M, [457])          # 240×264, Haus bei x 112–190, Tür x 145–160
X0, Y0 = 96, 40                                  # Fensterausschnitt der Insel
L1 = rgba(125, 175)
put(L1, isle, -X0, -Y0)
# Blumenbüschel aus der Relic-Insel
relic = sprite('e24_relic', M, [478])
flw = [relic[53:62, 213:224], relic[36:45, 225:237]]
cv = Canvas(125, 175); cv.a[:] = g.a
cv.paste(L1, 0, 0)
g = cv

# ---------- Ebene 2 (5×): Gartenzwerg ----------
gnome = sprite('e24_gnome', M, [212])             # 15×24
GX, GFOOT = 37, 64                                # Mitte / Fußlinie im 50×70-Raster
fx, fy = GX * 2.5, GFOOT * 2.5                    # Fußpunkt im 125er-Raster
for y in range(int(fy - 3), int(fy + 4)):
    for x in range(int(fx - 20), int(fx + 21)):
        e = ((x + .5 - fx - 3) / 18) ** 2 + ((y + .5 - fy) / 3.2) ** 2
        if e < 1 and 0 <= x < 125 and 0 <= y < 175 and (1 - e) * 1.6 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = (g.a[y, x] * 0.55).astype(np.uint8)

out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
L = rgba(50, 70)
put(L, gnome, GX - gnome.shape[1] // 2, GFOOT - gnome.shape[0])
out.paste(lift(L, 5), 0, 0)
print(save(out, '24_garden_watch.png'))
