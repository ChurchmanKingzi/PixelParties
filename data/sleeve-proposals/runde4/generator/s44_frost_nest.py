# -*- coding: utf-8 -*-
"""44 Frost Nest – Morgengrauen über dem Wolkenmeer: das eisblaue Drachenei liegt groß zwischen zwei
Felsbrocken und Schneewehen auf einem verschneiten Gipfel; die aufgehende Sonne steht genau dahinter,
ein erster Riss im Ei glimmt kalt-blau.

Quellen (MotiveCoolhalla.xcf):
  Ebene 3   „Icy Dragonegg“ – Drachenei (Karte „Icy Dragonegg“), Riss nachgezeichnet              4×
  Ebene 41  „Ebene #182“    – violetter Felsbrocken (Szene „Sichtbar #50“), links/gespiegelt rechts 4×
  Ebene 98  „Ebene #130“    – Felsplateau-Karte (Szenen des Dracheneis), 32×32-Kachel für den Gipfel 4×
Himmel, Sonne, Wolkenmeer, Schneekappe und Schneelippe selbst gezeichnet.
Skalierung: Himmel/Sonne/Wolken 2×, Gipfel + Ei + Felsen 4×.
"""
import math
import numpy as np
from kit41_45 import *  # noqa

C = 'MotiveCoolhalla'
egg = sprite('i44_egg', C, [3])
rock = sprite('i44_rock', C, [41])

# ---------------------------------------------------------------- Himmel (2×)
bg = G(2)
W2, H2 = bg.w, bg.h
yy, xx = np.mgrid[0:H2, 0:W2]
HOR = 118
vbands(bg, [(22, 26, 70), (36, 38, 92), (56, 50, 114), (84, 64, 132), (120, 80, 142), (160, 96, 146),
            (204, 118, 140), (236, 146, 128), (252, 180, 138), (255, 208, 156)],
       [14, 30, 46, 60, 72, 84, 96, 106, 114], soft=2.5)
# Sonne direkt hinter dem Ei (Scheibe + zwei Hofstufen)
SX, SY = 62.5, 92
bg.dfill(bg.ellipse_mask(SX, SY, 44, 44) & (yy < HOR), (250, 176, 132), 0.5)
bg.dfill(bg.ellipse_mask(SX, SY, 34, 34) & (yy < HOR), (255, 196, 140), 1.0)
bg.dfill(bg.ellipse_mask(SX, SY, 27, 27) & (yy < HOR), (255, 226, 168), 1.0)
bg.dfill(bg.ellipse_mask(SX, SY, 22, 22) & (yy < HOR), (255, 244, 206), 1.0)
# feine Wolkenstreifen quer vor dem oberen Himmel
for (y, x0, x1, col) in ((30, 6, 52, (104, 76, 140)), (33, 14, 40, (120, 86, 150)), (46, 70, 122, (150, 92, 146)),
                         (49, 84, 112, (170, 104, 150)), (70, 0, 34, (214, 128, 136)), (73, 8, 26, (226, 140, 136)),
                         (64, 92, 125, (206, 124, 140))):
    bg.rect(x0, y, x1, y + 1, col)
# Wolkenmeer: Reihen von Wolkenbuckeln bis zum unteren Rand, nach vorn größer und heller
rng = np.random.default_rng(44)
ROWS = [((226, 150, 160), (184, 112, 140)), ((238, 172, 172), (196, 124, 148)), ((246, 192, 184), (206, 140, 156)),
        ((252, 208, 196), (214, 154, 164)), ((255, 222, 208), (222, 168, 174)), ((255, 234, 222), (230, 182, 186))]
top, hmin = HOR - 5, 3
for k, (col, dark) in enumerate(ROWS):
    bg.rect(0, top + hmin + 2, W2, H2, col)
    x = -int(rng.integers(0, 8)); wmin, wmax = 10 + 3 * k, 18 + 5 * k
    while x < W2:
        w = int(rng.integers(wmin, wmax)); h = hmin + k // 2 + int(rng.integers(0, 3))
        m = bg.ellipse_mask(x + w / 2, top + h, w / 2, h) & (yy >= top)
        bg.dfill(m, col)
        bg.dfill(m & (yy >= top + h + 1) & ~bg.ellipse_mask(x + w / 2 + 2, top + h - 2, w / 2, h), dark)
        x += w - 4
    top += 5 + 2 * k

# ---------------------------------------------------------------- Gipfel, Nest, Ei (4×)
fg = G(4)
W4, H4 = fg.w, fg.h
y4, x4 = np.mgrid[0:H4, 0:W4]
GY = 75                                              # Oberkante der Schneefläche (y=300)
# Gipfel: Fels (Kachel der Felsplateau-Karte, Ebene 98) mit Schneekappe; Flanken fallen ins Wolkenmeer ab
rocktex = compose(C, [98], crop=False)[60:92, 125:157]
half = 27 + (y4 - GY) * 0.8                       # halbe Breite des Gipfels, nach unten breiter
body = (np.abs(x4 + .5 - 31.5) <= half) & (y4 >= GY - 1)
t = rocktex[y4 % 32, x4 % 32]
fg.a[body, :3] = (t[body, :3] * np.array([0.66, 0.62, 0.80])).astype(np.uint8); fg.a[body, 3] = 255
edge = body & ~(np.abs(x4 + .5 - 31.5) <= half - 1)
fg.a[edge, :3] = (26, 16, 20)
# Schneekappe mit Tropfkante
capd = GY + 3 + ((x4 * 7) % 5 == 0) * 1 + ((x4 * 3) % 7 == 0) * 2 - (np.abs(x4 + .5 - 31.5) > 24) * 1
snow = body & (y4 <= capd)
fg.dfill(snow, (222, 234, 255))
fg.dfill(snow & (y4 <= GY), (255, 255, 255))
fg.dfill(snow & (y4 == capd) & body, (176, 196, 236))
# Schatten von Ei und Felsen auf dem Schnee
fg.shade(0.84, snow & fg.ellipse_mask(32, GY, 17, 1.3))
# Felsbrocken links und (gespiegelt) rechts, leicht in den Schnee gesunken
RK = 16
rb = GY + 1
fg.pb(outline(rock, (26, 18, 40)), RK, rb)
fg.pb(outline(flip(rock), (26, 18, 40)), 63 - RK, rb)
# Ei mit nachgezeichnetem Riss (dunkle Fuge + blaues Glimmen)
eg = egg.copy()
m = eg[..., 3] > 0
inner = m.copy(); inner[1:-1, 1:-1] = m[1:-1, 1:-1] & m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]
rim = m & ~inner
rim[int(eg.shape[0] * 0.55):] = False                  # Gegenlicht nur an der oberen Kante
eg[rim, :3] = (eg[rim, :3] * 0.4 + np.array([255, 214, 170]) * 0.6).astype(np.uint8)
e = outline(eg, (10, 20, 44))
crack = [(20, 10), (19, 11), (20, 12), (21, 13), (20, 14), (19, 15), (18, 16), (19, 17), (20, 18), (21, 19), (22, 20)]
for (x, y) in crack:
    e[y, x, :3] = (12, 22, 52)
    if e[y, x + 1, 3]: e[y, x + 1, :3] = (150, 236, 255)
EX = 32 - e.shape[1] // 2
fg.paste(e, EX, GY + 3 - e.shape[0])
# Schneelippe vor dem Fuß des Eis (es liegt in einer Mulde)
lip = fg.ellipse_mask(32, GY + 2, 12, 2.0) & (y4 >= GY)
fg.dfill(lip, (236, 244, 255)); fg.dfill(lip & (y4 == GY), (255, 255, 255))
cv = flatten([bg, fg])

print(save(cv, '44_frost_nest.png'))
