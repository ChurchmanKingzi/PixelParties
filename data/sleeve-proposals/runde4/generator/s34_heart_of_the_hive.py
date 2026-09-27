# -*- coding: utf-8 -*-
"""Sleeve 34 – „Heart of the Hive“: Draufsicht auf eine Honigwabe als Mosaik. In der Mitte sitzt die gekrönte
Bienenkönigin, um sie herum liegen die verdeckelten Brutzellen (braun), außen die Honigzellen (gold). Wie der
Hofstaat eines echten Bienenvolks sind Arbeiterinnen ihr zugewandt – je eine oben, unten, links und rechts
(gespiegelte bzw. um 90° gedrehte Plätze, streng symmetrisch).

Skalierung: EINE Ebene (die Wabenoberfläche), alles im 84×117-Raster gebaut und einmal 3× hochskaliert –
Wabe (zum Rand hin zellenweise abgedunkelt), Königin, Arbeiterinnen, Schlagschatten.

Quellen (MotiveRussia.xcf, Karte „Hive's Crown“, Szenen 145 „Sichtbar #13“ / 147 „Sichtbar #11“):
  Wabe        = Ebene 180 „Ebene #42“: Honigzelle (Zentrum x126/y234) und Brutzelle (x108/y104) als Stempel;
                das Wabengitter (18 px Spaltenabstand, 13 px Reihenabstand, Versatz 9) wird Zelle für Zelle
                (Voronoi-Bereich um jeden Gitterpunkt) mit dem passenden Stempel neu gesetzt.
  Königin     = Ebenen 177 „Ebene #45“ (Körper) + 176 „Ebene #47“ (Beine) + 175 „Ebene #46“ (Krone), in der Lage
                wie in Szene 145 (Krone auf dem Kopf); der Thron aus Ebene 178 und die Auswahl-Leuchten
                (170/171/173/174) bleiben weg.
  Arbeiterin  = Ebenen 160 „Ebene #62“ (Körper) + 158 „Ebene #61“ (Flügel), linke der drei Bienen; die roten
                Flecken 159 sind ein Karteneffekt und entfallen.
  Schatten, Vignette: selbst gezeichnet.
"""
from common import *
import numpy as np

RU = 'MotiveRussia'
W, H = 84, 117
cv = Canvas(W, H)

# ---------- Wabe ----------
src = layer(RU, 180)[..., :3]
STAMP = {'honey': (126, 234), 'brood': (108, 104)}
CX, CY = 42, 58                                     # Bildmitte = Gitterpunkt unter der Königin
OX, OY = CX % 18, CY % 13
rows = {}
centers = []
for j in range(-2, H // 13 + 3):
    for i in range(-2, W // 18 + 3):
        y = OY + 13 * j
        x = OX + 18 * i + (9 if ((y - CY) // 13) % 2 else 0)
        centers.append((x, y))
centers = np.array(centers)

def hexdist(x, y):
    """Wabenabstand (Ringnummer) einer Zelle zur Mittelzelle (versetzte Reihen -> Würfelkoordinaten)."""
    r = int(round((y - CY) / 13)); odd = r % 2
    c = int(round((x - CX - 9 * odd) / 18))
    q = c - (r - odd) // 2
    return (abs(q) + abs(r) + abs(q + r)) // 2

def cell_type(x, y):
    return 'brood' if hexdist(x, y) == 2 else 'honey'  # Honig unter dem Hofstaat, Brutring, Honig außen

yy, xx = np.mgrid[0:H, 0:W]
best = np.full((H, W), 1e9); idx = np.zeros((H, W), int)
for k, (x, y) in enumerate(centers):
    d = (xx - x) ** 2 + ((yy - y) * 1.0) ** 2
    m = d < best; best[m] = d[m]; idx[m] = k
for k, (x, y) in enumerate(centers):
    m = idx == k
    if not m.any(): continue
    sx, sy = STAMP[cell_type(x, y)]
    f = 1 - 0.14 * max(0, hexdist(x, y) - 2)          # Zellen zum Rand hin ringweise dunkler (ohne Dithering)
    cv.a[m] = (src[yy[m] - y + sy, xx[m] - x + sx] * f).astype(np.uint8)

# ---------- Figuren ----------
queen = compose(RU, [175, 176, 177])
bees = parts(compose(RU, [158, 160]), dil=0)
bee = bees[0]                                       # Kopf oben

def shadow(s, x, y, dx=1, dy=1):
    m = s[..., 3] > 0
    h, w = m.shape
    for j in range(h):
        for i in range(w):
            if m[j, i] and 0 <= y + j + dy < H and 0 <= x + i + dx < W:
                cv.a[y + j + dy, x + i + dx] = (cv.a[y + j + dy, x + i + dx] * 0.45).astype(np.uint8)

def place(s, cx, cy):
    x, y = cx - s.shape[1] // 2, cy - s.shape[0] // 2
    shadow(s, x, y)
    cv.paste(s, x, y)

place(queen, CX, CY)
RY, RX = 26, 23
place(np.rot90(bee, 2).copy(), CX, CY - RY)         # oben, schaut nach unten
place(bee, CX, CY + RY)                             # unten, schaut nach oben
place(np.rot90(bee, -1).copy(), CX - RX, CY)        # links, schaut nach rechts
place(np.rot90(bee, 1).copy(), CX + RX, CY)         # rechts, schaut nach links


out = Canvas(250, 350)
out.a[:] = up(np.dstack([cv.a, np.full((H, W), 255, np.uint8)]), 3)[1:351, 1:251, :3]
print(save(out, '34_heart_of_the_hive.png'))
