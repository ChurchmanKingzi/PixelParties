# -*- coding: utf-8 -*-
"""25 Balloon Drift – der Creepy Clown schwebt an seinem Bündel aus Clownsgesicht-Ballons über ein
Wolkenmeer in den Abendhimmel, hinter ihm versinkt die Sonne.

Quellen (MotiveMoe.xcf):
  Ebene 389 „Creepy Clown“ – Clown mit Gesichtsballons und rotem Ballon an der Schnur (geprüft gegen
             „Sichtbar #145“ / „#32“: vollständig; Bodenschatten und die Nebenfigur weggelassen), 4×
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
# Bodenschatten (dunkelgrüne Ellipse unter den Füßen) entfernen
sh = (CLOWN[..., 3] > 0) & np.all(np.abs(CLOWN[..., :3].astype(int) - CLOWN[-1, CLOWN.shape[1] // 2, :3].astype(int)) < 12, -1)
rows = np.where(sh.any(1))[0]
CLOWN = CLOWN.copy(); CLOWN[rows.min():][sh[rows.min():]] = 0
b = bbox(CLOWN); CLOWN = CLOWN[b[1]:b[3], b[0]:b[2]]
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
SX, SY, SR = 62.5, 128, 15
radial(g, SX, SY, SR + 26, (246, 160, 110), 0.7, power=1.2)
radial(g, SX, SY, SR + 12, (252, 196, 120), 0.8, power=1.0)
for y in range(int(SY - SR - 1), int(SY + SR + 1)):
    for x in range(int(SX - SR - 1), int(SX + SR + 1)):
        d = math.hypot(x + .5 - SX, y + .5 - SY)
        if d < SR:
            g.a[y, x] = (255, 236, 170) if d < SR - 3 or (SR - d) * 0.4 > BAYER4[y % 4, x % 4] else (255, 206, 120)


def cloud(c, dark, light):
    s = lum_tint(c, dark, light)
    return s


cvb = Canvas(125, 175); cvb.a[:] = g.a
# obere, ferne Schleierwolken (violett)
cvb.paste(cloud(flip(CLOUD), (70, 34, 96), (150, 90, 160)), -40, 30)
cvb.paste(cloud(CLOUD, (80, 36, 100), (170, 100, 170)), 70, 52)
# Wolkenmeer: drei Staffeln, vorn dunkler/röter, hinten heller
cvb.paste(cloud(CLOUD, (214, 120, 120), (255, 222, 190)), -30, 118)
cvb.paste(cloud(flip(CLOUD), (214, 120, 120), (255, 222, 190)), 30, 116)
cvb.paste(cloud(CLOUD, (178, 82, 116), (246, 172, 160)), -60, 132)
cvb.paste(cloud(flip(CLOUD), (178, 82, 116), (246, 172, 160)), 50, 134)
cvb.paste(cloud(CLOUD, (120, 50, 104), (220, 128, 146)), -20, 148)
cvb.paste(cloud(flip(CLOUD), (120, 50, 104), (220, 128, 146)), 20, 154)
g = cvb
# unterhalb der vordersten Wolkenstaffel: dichte Wolkendecke
for y in range(160, 175):
    for x in range(125):
        if np.all(g.a[y, x] == g.a[y, x]):
            pass

out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
L = rgba(63, 88)
put(L, CLOWN, 31 - CLOWN.shape[1] // 2, 12)
out.paste(lift(L, 4), 0, 0)
print(save(out, '25_balloon_drift.png'))
