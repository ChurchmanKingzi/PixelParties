# -*- coding: utf-8 -*-
"""Sleeve 33 – „Ember Hooves“: Die Night Mare, das schwarze Pferd mit brennender Mähne, steht in einer
Winternacht auf verschneiter Lichtung. Ihre Spur kommt von links unten auf sie zu: jeder Hufabdruck hat den
Schnee geschmolzen, die frischesten glühen noch wie Kohlen und dampfen, die älteren sind erkaltet. Das Feuer färbt den Schnee um sie
orange, dahinter stehen verschneite Bäume im blauen Nachtlicht.

Skalierung / Tiefenstaffelung (zwei Ebenen, jede auf eigenem Raster, einmal hochskaliert):
  Hintergrund 2× (125×175): Nachthimmel, Sterne, Schneefeld (Schneekachel), Baumreihe, feine Flocken
  Vordergrund 5× (50×70):  Night Mare, vordere Schneewehe, Feuerschein, Schatten, Hufspur, Dampf, große Flocken

Quellen:
  MotiveSteamDwarfs.xcf  Ebene 25 „Night Mare“ (Karte „Night Mare“; eigenständige Ebene, vollständig –
                         Flammenmähne und -schweif gehören zur Ebene)
  MotiveRussia.xcf       Ebene 90 „Ebene #106“ (verschneiter Baum, in den Szenen #32/#29/#28 vollständig),
                         Ebene 199 „Ebene #27“ (Schneefeld der Eissee-Karte, 16×16-Kachel daraus)
  Himmel, Sterne, Schneewehe, Feuerschein, Hufabdrücke, Dampf, Flocken: selbst gezeichnet
"""
from common import *
import numpy as np

SD, RU = 'MotiveSteamDwarfs', 'MotiveRussia'
rng = np.random.RandomState(33)

snow_l = layer(RU, 199)
b = bbox(snow_l)
TILE = snow_l[b[1] + 60:b[1] + 76, b[0]:b[0] + 16, :3].astype(float)     # 16×16-Schneekachel
def snow_rgb(w, h, f=(0.62, 0.66, 0.9)):
    t = np.tile(TILE, (h // 16 + 1, w // 16 + 1, 1))[:h, :w]
    return (t * np.array(f)).clip(0, 255).astype(np.uint8)

# ======================= Hintergrund 2× =======================
W2, H2 = 125, 175
bg = Canvas(W2, H2)
yy, xx = np.mgrid[0:H2, 0:W2]
TH = BAYER4[yy % 4, xx % 4]
cols = [(6, 8, 24), (10, 14, 38), (18, 24, 58), (30, 38, 80)]
t = np.clip((yy - 10) / 80, 0, 1) * (len(cols) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    bg.a[q == k] = c
for _ in range(30):
    x, y = rng.randint(3, W2 - 3), rng.randint(3, 80)
    bg.px(x, y, (200, 206, 240) if rng.rand() < 0.75 else (150, 160, 210))

GY = 80                                            # Horizont des Schneefelds (2×-Raster)
field = snow_rgb(W2, H2 - GY)
# Schneefeld nach hinten dunkler (Nacht)
for j in range(H2 - GY):
    f = 0.62 + 0.3 * min(1, j / 40)
    bg.a[GY + j] = (field[j] * f).astype(np.uint8)
bg.a[GY] = (120, 128, 180)

tree = sprite('g33_tree', RU, [90])
tn = tree.copy()
tn[..., :3] = (tn[..., :3].astype(float) * np.array([0.55, 0.6, 0.85])).clip(0, 255).astype(np.uint8)
# warmer Schein der Flammen in der Luft hinter dem Pferd (gedithert, 2×-Raster)
d = np.sqrt(((xx + .5 - 62) / 1.2) ** 2 + (yy + .5 - 72) ** 2)
wm = (np.clip(1 - d / 56, 0, 1) * 0.8 > TH) & (yy < GY)
bg.a[wm] = (bg.a[wm] * 0.6 + np.array([140, 64, 58]) * 0.4).astype(np.uint8)
tf = tn.copy(); tf[..., :3] = (tf[..., :3].astype(float) * 0.55 + np.array([10, 14, 34]) * 0.45).astype(np.uint8)
for x, dy, fl in [(-4, -5, 1), (12, -6, 0), (28, -5, 1), (60, -6, 0), (76, -5, 1), (94, -6, 0), (110, -5, 1)]:
    s_ = flip(tf) if fl else tf                       # hintere Baumreihe im Dunst
    bg.paste(s_, x, GY + dy - s_.shape[0] + 3)
for x, dy, fl in [(4, 2, 0), (20, 0, 1), (38, 3, 0), (84, 1, 1), (100, 3, 0), (116, 0, 1)]:
    s_ = flip(tn) if fl else tn
    bg.paste(s_, x, GY + dy - s_.shape[0] + 3)
for _ in range(26):                                  # feine Flocken (weit weg)
    x, y = rng.randint(2, W2 - 2), rng.randint(4, 120)
    bg.px(x, y, (190, 196, 230))

# ======================= Vordergrund 5× =======================
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
y5, x5 = np.mgrid[0:H5, 0:W5]

mare = sprite('g33_mare', SD, [25])
mh, mw = mare.shape[:2]
GL = 58                                             # Standlinie der Hufe (5×-Raster) -> 290 px
MX, MY = (W5 - mw) // 2 + 1, GL - mh

# vordere Schneewehe (Oberkante gewellt), Schneekachel im 5×-Raster
snow5 = snow_rgb(W5, H5, (0.72, 0.74, 0.94))
top = [int(round(49 + 1.6 * np.sin(x / 5.0) + 1.0 * np.sin(x / 2.3 + 1))) for x in range(W5)]
for x in range(W5):
    fg[top[x]:, x, :3] = snow5[top[x]:, x]; fg[top[x]:, x, 3] = 255
    fg[top[x], x, :3] = (204, 210, 244)
# Feuerschein auf dem Schnee: zwei flache Ellipsenbänder (warm)
cxg = MX + mw / 2
for r, col, a in [(1.0, (240, 180, 150), 0.18), (0.7, (250, 190, 130), 0.22), (0.45, (255, 200, 120), 0.25)]:
    e = (((x5 + .5 - cxg) / (27 * r)) ** 2 + ((y5 + .5 - GL) / (9 * r)) ** 2) < 1
    e &= fg[..., 3] > 0
    fg[e, :3] = (fg[e, :3] * (1 - a) + np.array(col) * a).astype(np.uint8)
# Schatten unter dem Pferd
e = (((x5 + .5 - (MX + 24)) / 13) ** 2 + ((y5 + .5 - GL) / 1.6) ** 2) < 1
fg[e & (fg[..., 3] > 0), :3] = (fg[e & (fg[..., 3] > 0), :3] * 0.6).astype(np.uint8)

# Hufspur: geschmolzene Abdrücke von links unten bis zur Hinterhand
# (x, y) von der ältesten (links unten) zur frischesten Spur an der Hinterhand
prints = [(6, 69), (10, 67), (9, 64), (13, 62), (14, 60)]
ages = [((72, 72, 112), (92, 84, 118)),             # kalt: nur geschmolzen
        ((88, 52, 64), (128, 64, 56)),
        ((150, 56, 40), (212, 104, 48)),
        ((206, 92, 40), (246, 164, 70)),
        ((232, 118, 44), (255, 214, 96))]           # frisch: glüht
for (x, y), (c1, c2) in zip(prints, ages):
    for dx, dy, c in [(-1, 0, None), (0, 0, c1), (1, 0, None), (-1, 1, c1), (0, 1, c2), (1, 1, c1)]:
        X, Y = x + dx, y + dy
        if not (0 <= X < W5 and 0 <= Y < H5 and fg[Y, X, 3]): continue
        fg[Y, X, :3] = c if c is not None else (fg[Y, X, :3] * 0.62).astype(np.uint8)   # Schattenkante im Loch
# ein Hauch Dampf über den zwei frischesten Abdrücken
for (x, y) in prints[-2:]:
    for j, (dx, al) in enumerate([(0, 0.7), (1, 0.55), (1, 0.4), (0, 0.28)]):
        X, Y = x + dx, y - 2 - j
        if 0 <= X < W5 and 0 <= Y < H5:
            if fg[Y, X, 3]:
                fg[Y, X, :3] = (fg[Y, X, :3] * (1 - al) + np.array([240, 242, 255]) * al).astype(np.uint8)
            else:
                fg[Y, X] = (240, 242, 255, int(255 * al))

m = mare[..., 3] > 0
fg[MY:MY + mh, MX:MX + mw][m] = mare[m]

for x, y in [(4, 8), (44, 14), (40, 4), (9, 26), (46, 33), (2, 40)]:   # große Flocken (nah)
    if fg[y, x, 3] == 0:
        fg[y, x] = (220, 224, 248, 255)

# ======================= zusammensetzen =======================
out = Canvas(250, 350)
out.a[:] = up(np.dstack([bg.a, np.full((H2, W2), 255, np.uint8)]), 2)[..., :3]
out.paste(up(fg, 5), 0, 0)
print(save(out, '33_ember_hooves.png'))
