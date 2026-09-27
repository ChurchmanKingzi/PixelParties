# -*- coding: utf-8 -*-
"""47 Bamboo Sentinel – Nahaufnahme: Xiong, der Bambuswächter, steht groß und frontal mit quer gehaltenem
Bambusstab in einem dichten Bambushain; Lichtbahnen fallen schräg durch die Halme.

Quellen (MotiveChina.xcf):
  Ebene 5 „Xiong“ – Xiong mit Bambusstab (Karte „Xiong, the Bamboo Guardian“, Szene „Sichtbar #4“, dort 100 % sichtbar), 6×
  Ebene 8 „Ebene #6“ – Bambuszaun: einzelne Halme als Textur für den fernen Hain (senkrecht gekachelt, umgefärbt), 2×
  Ebene 37 „Hintergrund“ – Grastextur für den Boden, 2×
Selbst gezeichnet: Dunst-Verlauf, nahe Bambushalme (Farben aus dem Zaun), Blätter, Lichtbahnen, Schatten.
Skalierung: gesamter Hintergrund (Hain, Halme, Blätter, Boden, Licht) 2× (125×175); Xiong + Schatten 6× (42×59).
"""
import math, random
from j_util_46_50 import *  # noqa

C = 'MotiveChina'
random.seed(47)

bg = Lay(2)
GY = 144    # Bodenlinie (2×-Raster) hinten
bg.vgrad([(0, (16, 30, 40)), (0.55, (30, 58, 62)), (1, (52, 90, 80))], y1=GY + 4)

# ferner Hain: Halme aus dem Bambuszaun, senkrecht gekachelt, in Dunst getaucht
fence = sprite('j47_fence', C, [8])
FT = fence[:, :, :]
fh, fw = FT.shape[:2]


def stalk_col(sx):
    """Eine Halmspalte (2 px breit) aus dem Zaun: RGBA-Streifen der Höhe fh."""
    return FT[:, sx:sx + 2]


# Halmspalten im Zaun finden (deckende Doppelspalten)
cols = [x for x in range(fw - 1) if FT[:, x, 3].mean() > 200 and FT[:, x + 1, 3].mean() > 200 and (x == 0 or FT[:, x - 1, 3].mean() < 50)]
far_pal = [(22, 42, 48), (36, 66, 66), (54, 90, 82)]
for n, x in enumerate(range(-1, bg.w, 5)):
    st = stalk_col(cols[(n * 3) % len(cols)])
    off = random.randint(0, fh - 1)
    for y in range(0, GY):
        c = st[(y + off) % fh, 0 if (x % 2) else 1]
        v = c[:3].astype(float).mean()
        col = far_pal[0] if v < 110 else (far_pal[1] if v < 170 else far_pal[2])
        for dx in range(2): bg.px(x + dx, y, col)

# Lichtbahnen schräg von links oben (gedithert, nur auf dem fernen Hain)
LIGHT = (120, 170, 150)
# heller Dunst hinter der Figur (trennt Xiong vom Hain)
bg.radial(62, 96, 46, (70, 112, 98), 0.8, 1.2)
bg.radial(62, 96, 30, (96, 140, 118), 0.7, 1.2)
for y in range(0, GY):
    for x in range(bg.w):
        for (x0, w0) in [(10, 7), (36, 5), (58, 8)]:
            u = x - (x0 + y * 0.45)
            if 0 <= u < w0:
                t = 0.3 * (1 - y / GY) * (1 - abs(u - w0 / 2) / (w0 / 2 + 1))
                if t > B4[y % 4, x % 4]: bg.px(x, y, LIGHT)

# Boden: Gras, nach vorne dunkler
grass = sprite('j47_grass', C, [37], box=(300, 400, 340, 440))
GT = tile_rgb(grass, bg.w, bg.h)
for y in range(GY, bg.h):
    for x in range(bg.w):
        f = 0.62 - 0.3 * (y - GY) / (bg.h - GY)
        bg.px(x, y, tuple(int(v * f) for v in GT[y, x]))
for x in range(bg.w):
    bg.px(x, GY, (30, 52, 40))

# nahe Halme (selbst gezeichnet, Farben aus dem Zaun), rahmen die Figur links und rechts
near = Lay(2)
NPAL = dict(dk=(14, 26, 22), md=(52, 84, 58), lt=(90, 124, 80), hl=(130, 156, 96), node=(150, 168, 104))


def draw_stalk(L, x0, w, ybot, lean=0.0, seg=19, ph=0, dark=1.0):
    for y in range(-2, ybot):
        xs = x0 + lean * (ybot - y)
        for i in range(w):
            if i == 0: c = NPAL['dk']
            elif i == w - 1: c = NPAL['dk']
            elif i == 1: c = NPAL['lt']
            elif i == 2 and w > 4: c = NPAL['hl']
            else: c = NPAL['md']
            if (y + ph) % seg == 0: c = NPAL['node'] if 0 < i < w - 1 else NPAL['dk']
            if (y + ph) % seg == 1 and 0 < i < w - 1: c = NPAL['dk']
            L.px(int(xs) + i, y, tuple(int(v * dark) for v in c))


def draw_leaf(L, x, y, d, n=7, col=(30, 62, 42), hi=(66, 104, 70)):
    """Schmales Bambusblatt (Lanzett), d=+1 nach rechts, -1 nach links."""
    for i in range(n):
        yy = y + i // 3
        L.px(x + d * i, yy, col)
        if 1 < i < n - 2: L.px(x + d * i, yy + 1, col)
        if 1 < i < n - 3 and i % 2: L.px(x + d * i, yy, hi)


# drei Halme links, drei rechts (gespiegelte Plätze)
for (x0, w, ph, dk) in [(4, 6, 3, 0.8), (17, 5, 11, 0.65), (28, 4, 7, 0.5)]:
    draw_stalk(near, x0, w, GY + 8, ph=ph, dark=dk)
    draw_stalk(near, bg.w - x0 - w, w, GY + 8, ph=ph + 5, dark=dk)
for (x, y, d) in [(10, 28, 1), (10, 30, 1), (21, 60, 1), (9, 88, -1), (32, 44, 1), (22, 104, -1)]:
    draw_leaf(near, x, y, d); draw_leaf(near, bg.w - 1 - x, y + 6, -d)
# Blätterdach oben: hängende Blattbüschel an den nahen Halmen (gespiegelt links/rechts)
for (x, y) in [(8, 10), (20, 20), (30, 8), (40, 16), (52, 6)]:
    for side in (0, 1):
        xx = x if side == 0 else bg.w - 1 - x
        for (d, dy, n) in [(-1, 0, 8), (1, 0, 8), (-1, 3, 7), (1, 3, 7), (1, 6, 6), (-1, 6, 6)]:
            draw_leaf(near, xx, y + dy, d if side == 0 else -d, n=n, hi=(104, 146, 92))

# Xiong 6× mit Schatten
fg = Lay(6)
xiong = sprite('j47_xiong', C, [5])
xw, xh = xiong.shape[1], xiong.shape[0]
X0 = (fg.w - xw) // 2 - 1
FEET = 50                  # Fußlinie im 6×-Raster (→ 300 px)
Y0 = FEET - xh
SC = X0 + xw // 2
for x in range(SC - 8, SC + 8): fg.px(x, FEET - 1, (14, 26, 18))
for x in range(SC - 6, SC + 6): fg.px(x, FEET, (14, 26, 18))
fg.paste(xiong, X0, Y0)

cv = flatten([bg, near, fg])
print(save(cv, '47_bamboo_sentinel.png'))
