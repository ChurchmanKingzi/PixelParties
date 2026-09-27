# -*- coding: utf-8 -*-
"""25 Balloon Drift – der Creepy Clown schwebt an seinem Bündel aus Clownsgesicht-Ballons über ein
Wolkenmeer in den Abendhimmel, hinter ihm versinkt die Sonne.

Quellen (MotiveMoe.xcf):
  Ebene 389 „Creepy Clown“ – Clown mit Gesichtsballons und rotem Ballon an der Schnur (geprüft gegen
             „Sichtbar #145“ / „#32“: vollständig; halbtransparenter Bodenschatten und die Nebenfigur weggelassen), 4×
  Ebene 122 „Ebene #64“ – Wolke, mehrfach gespiegelt, abendlich umgefärbt (Helligkeit -> Farbverlauf), 2×
Selbst gezeichnet (2×-Raster): Abendhimmel mit Farbstufen und Dithering, Sonne mit Schein, Sterne oben.

Tiefenebenen / Skalierung:
  Himmel, Sonne, Wolkenmeer, Wolken .... 125×175-Raster, 2×
  Clown mit Ballons (Vordergrund) ...... 63×88-Raster, 4×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vgrad, radial, lum_tint  # noqa
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
cl = sprite('e25_clown_raw', M, [389])
CLOWN = max(parts(cl, dil=1), key=lambda p: p.shape[0] * p.shape[1])
# (der halbtransparente Bodenschatten der Ebene fällt beim Zusammensetzen weg: Alpha < 128)
CLOUD = sprite('e25_cloud', M, [122])                     # 133×36

# ---------- Ebene 1 (2×) ----------
g = Canvas(125, 175)
vgrad(g, [(0, (26, 16, 56)), (0.25, (60, 26, 88)), (0.5, (128, 44, 110)), (0.68, (206, 86, 116)),
          (0.8, (242, 146, 112)), (1, (250, 196, 128))])
rng = np.random.RandomState(25)
for _ in range(26):
    x, y = rng.randint(0, 125), rng.randint(0, 40)
    g.px(x, y, (220, 200, 255) if rng.rand() < .4 else (140, 110, 190))
# Sonne tief am Horizont, halb im Wolkenmeer
SX, SY, SR = 62.5, 110, 25
radial(g, SX, SY, SR + 30, (240, 140, 112), 0.7, power=1.2)
radial(g, SX, SY, SR + 12, (252, 196, 120), 0.8, power=1.0)
for y in range(int(SY - SR - 1), int(SY + SR + 1)):
    for x in range(int(SX - SR - 1), int(SX + SR + 1)):
        d = math.hypot(x + .5 - SX, y + .5 - SY)
        if d < SR:
            g.a[y, x] = (255, 224, 116) if d < SR - 3 or (SR - d) * 0.4 > BAYER4[y % 4, x % 4] else (252, 176, 88)


def cloud(c, dark, light):
    s = lum_tint(c, dark, light)
    return s


cvb = Canvas(125, 175); cvb.a[:] = g.a
cvb.rect(0, 146, 125, 175, (120, 50, 104))                 # geschlossene Wolkendecke ganz unten
# obere, ferne Schleierwolken (violett)
cvb.paste(cloud(flip(CLOUD), (70, 34, 96), (150, 90, 160)), -40, 30)
cvb.paste(cloud(CLOUD, (80, 36, 100), (170, 100, 170)), 70, 52)
# Wolkenmeer: drei Staffeln, vorn dunkler/röter, hinten heller
cvb.paste(cloud(CLOUD, (206, 108, 122), (250, 204, 186)), -30, 118)
cvb.paste(cloud(flip(CLOUD), (206, 108, 122), (250, 204, 186)), 30, 116)
cvb.paste(cloud(CLOUD, (178, 82, 116), (246, 172, 160)), -60, 132)
cvb.paste(cloud(flip(CLOUD), (178, 82, 116), (246, 172, 160)), 50, 134)
cvb.paste(cloud(CLOUD, (120, 50, 104), (220, 128, 146)), -20, 148)
cvb.paste(cloud(flip(CLOUD), (120, 50, 104), (220, 128, 146)), 20, 154)
g = cvb
out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
L = rgba(63, 88)
put(L, CLOWN, 31 - CLOWN.shape[1] // 2, 9)
out.paste(lift(L, 4), 0, 0)
print(save(out, '25_balloon_drift.png'))
