# -*- coding: utf-8 -*-
"""06 – Alice, the Puppeteer Girl (Entwurf v3).
Idee: Nachts in Alices Zimmer im Herrenhaus. Alice steht groß auf dem violetten Läufer, die Arme
ausgebreitet, an ihren Fäden sitzen ihre zwei Puppen. Der Raum dahinter liegt im Dunkeln – nur ihr
eigener violetter Magieschein; in der Finsternis glühen die roten Puppenaugen (im Schrank, im Spiegel ...).
"""
import math
from common import *  # noqa
import numpy as np
from xcfkit import over

D = 'MotiveBritain'
W, H = 250, 350


def bay(x, y):
    return BAYER4[y % 4, x % 4]


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def keep_boxes(a, boxes):
    m = np.zeros(a.shape[:2], bool)
    for x0, y0, x1, y1 in boxes: m[y0:y1, x0:x1] = True
    b = a.copy(); b[~m] = 0
    return b


def put(dst, s, x, y):
    t = np.zeros_like(dst)
    h, w = s.shape[:2]
    t[y:y + h, x:x + w] = s
    return over(dst, t)


EMIS = {(236, 39, 65), (159, 17, 30), (209, 0, 0), (234, 42, 67), (159, 14, 32)}   # Puppenaugen/Schleifen

# ---------------------------------------------------------------- Hintergrund: Zimmer (2×)
AX = 282                        # Symmetrieachse des Zimmers (Bett, Läufer, Säulenpaare)
RX0, RY0 = AX - 62, 238         # Fenster 125×175 im Ebenen-Koordinatensystem
l8 = layer(D, 8)
room = layer(D, 60).copy()
# Läufer (Ebene 59) nach vorn verlängert: Mittelstück (Periode 9) wiederholt, Endborte nach unten versetzt
rug = layer(D, 59)
E = 36
rug2 = np.zeros_like(rug)
rug2[:341] = rug[:341]
for y in range(341, 341 + E):
    rug2[y] = rug[y - 9 * math.ceil((y - 340) / 9)]
rug2[341 + E:] = rug[341:rug.shape[0] - E]
acc = over(room, rug2)
acc = over(acc, layer(D, 56))                               # Bild im Rahmen (Alice-Porträt), Kristallkugel
gh8 = keep_boxes(l8, [(227, 291, 237, 302)])                # Geister-Puppe im Spiegel (alpha 76)
ward = keep_boxes(l8, [(243, 283, 256, 303)])               # liegende Puppe auf dem Schrank + rote Augen darin
bed = keep_boxes(l8, [(276, 283, 288, 295)])                # Puppe auf dem Bett (ohne ihren roten Faden)
bed[np.all(bed[..., :3] == (209, 0, 0), -1)] = 0
acc = over(acc, gh8); acc = over(acc, ward); acc = over(acc, bed)
# zwei stehende Puppen am Fuß der hinteren Säulen (gespiegelt, symmetrisch zur Achse)
dolls = parts(l8, dil=0, minpx=2)
stand = [p for p in dolls if p.shape[:2] == (12, 8)][0]
acc = put(acc, stand, 248, 311)
acc = put(acc, flip(stand), 2 * AX - 248 - 8, 311)
bg = acc[RY0:RY0 + 175, RX0:RX0 + 125].copy()
bg[..., 3] = 255

rgb = bg[..., :3]
emis = np.zeros(bg.shape[:2], bool)
for c in EMIS:
    emis |= np.all(rgb == c, -1)
# (Bild im Rahmen soll nicht glühen)
emis[257 - RY0:272 - RY0, 272 - RX0:289 - RX0] = False
ghost = np.zeros(bg.shape[:2], bool)
gm = gh8[291:302, 227:237, 3] > 0
ghost[291 - RY0:302 - RY0, 227 - RX0:237 - RX0] = gm

# Licht: violetter Schein um Alice, nach außen Finsternis (weich, im 2×-Raster)
LX, LY = 62.5, 112
GLOW = np.array([64, 16, 104])
dollm = np.zeros(bg.shape[:2], bool)                       # Puppen im Hintergrund (bleiben blass sichtbar)
for sp in (ward, bed):
    dollm |= sp[RY0:RY0 + 175, RX0:RX0 + 125, 3] > 0
for (px, py) in ((248, 311), (2 * AX - 248 - 8, 311)):
    dollm[py - RY0:py - RY0 + 12, px - RX0:px - RX0 + 8] |= stand[..., 3] > 0 if px == 248 else flip(stand)[..., 3] > 0
out = rgb.astype(float)
for y in range(175):
    for x in range(125):
        d = math.hypot((x + .5 - LX) / 52, (y + .5 - LY) / 50)
        t = max(0.0, 1 - d)
        f = 0.13 + 0.80 * t ** 1.1
        c = out[y, x]
        if emis[y, x]:
            c = c * 1.0
        elif ghost[y, x]:
            c = c * 0.85 + np.array([0, 10, 20])
        elif dollm[y, x]:
            c = c * max(f, 0.42) + np.array([4, 4, 16])
        else:
            c = c * f + GLOW * (t ** 2) * 0.4 + (1 - f) * np.array([5, 2, 14])
        out[y, x] = c
bgl = np.dstack([out.clip(0, 255).astype(np.uint8), np.full((175, 125), 255, np.uint8)])

cv = Canvas(W, H)
cv.paste(up(bgl, 2), 0, 0)

# ---------------------------------------------------------------- Alice mit ihren Puppen (5×)
grp = l8[303:331, 236:276].copy()                  # Alice #6, Base-Karte (Sichtbar #53, Lage 218,288)
grp[24:, 249 - 236:265 - 236] = 0                  # Kopf der Puppe darunter (gehört nicht dazu)
grp = part_at(grp, 20, 10, dil=0)
gh, gw = grp.shape[:2]
# Fäden: 1 px, dunkel/hell abwechselnd (Originalpixel), halbtransparent außerhalb von Alice
F1, F2 = (75, 1, 117), (154, 47, 231)
for y in range(gh):
    for x in range(gw):
        if grp[y, x, 3] and tuple(grp[y, x, :3]) in (F1, F2) and not (248 <= x + 236 <= 263):
            grp[y, x, 3] = 185
AL = rgba(50, 70)
gx, gyb = 5, 61                                    # Gruppe x 236–275 (Alice 248–263) genau mittig, Unterkante y 61
for y in range(70):
    for x in range(50):
        d = ((x + .5 - 25) / 18) ** 2 + ((y + .5 - (gyb - 1.2)) / 2.4) ** 2
        if d < 1 and 0.6 > bay(x, y):
            AL[y, x] = (8, 0, 18, 170)
tmp = rgba(50, 70)
tmp[gyb - gh:gyb, gx:gx + gw] = grp
AL = over(AL, tmp)
cv.paste(up(AL, 5), 0, 0)

print(save(cv, '06_dolls_in_the_dark.png'))
