# -*- coding: utf-8 -*-
"""Sleeve 34 – „Heart of the Hive“: Draufsicht auf eine Honigwabe. In der Mitte sitzt die gekrönte Bienenkönigin
auf einer Blüte aus hell glänzenden Honigzellen; ringsum liegen verdeckelte Brutzellen, die übrige Wabe tritt als
ruhiger, abgedunkelter Hintergrund zurück. Vier Arbeiterinnen bilden ihren Hofstaat: je zwei oben und unten,
spiegelsymmetrisch, die Köpfe zur Königin gewandt.

Skalierung / Tiefenstaffelung (zwei Raster, je einmal hochskaliert):
  Wabe 3× (84×117): Honig- und Brutzellen, Honigglanz der 7 Mittelzellen, übrige Zellen entsättigt/abgedunkelt
                    (ringweise, ohne Dithering); weiße Glanzkanten der Vorlage zu Honiggelb beruhigt,
                    Brutdeckel einfarbig.
  Tiere 4× (64×88):  Königin, vier Arbeiterinnen, ihre Schlagschatten (1 Rasterpunkt, 50 %).

Quellen (MotiveRussia.xcf, Karte „Hive's Crown“, Szenen 145 „Sichtbar #13“ / 147 „Sichtbar #11“):
  Wabe        = Ebene 180 „Ebene #42“: Honigzelle (Zentrum x126/y234) und Brutzelle (x108/y104) als Stempel;
                das Wabengitter (18 px Spaltenabstand, 13 px Reihenabstand, Versatz 9) wird Zelle für Zelle
                (Voronoi-Bereich um jeden Gitterpunkt) mit dem passenden Stempel neu gesetzt.
  Königin     = Ebenen 177 „Ebene #45“ (Körper) + 176 „Ebene #47“ (Beine) + 175 „Ebene #46“ (Krone), Lage wie in
                Szene 145; Thron (178) und Auswahl-Leuchten (170/171/173/174) bleiben weg.
  Arbeiterin  = Ebenen 160 „Ebene #62“ (Körper) + 158 „Ebene #61“ (Flügel, wie in den Szenen durchscheinend:
                70 % Deckkraft auf ganzen Pixeln), linke der drei Bienen; der rote Fleck (159) entfällt.
  Schatten, Abdunklung, Honigglanz: selbst gezeichnet.
"""
from common import *
import numpy as np

RU = 'MotiveRussia'
W, H = 84, 117
cv = Canvas(W, H)

# ---------- Wabe ----------
src = layer(RU, 180)[..., :3].copy()
# ruhigere Wabe: weiße Glanzkanten -> weiches Honiggelb, Brutdeckel einfarbig (nur Umriss bleibt dunkel)
wht = (src == (255, 255, 255)).all(-1); src[wht] = (244, 184, 96)
for c in [(97, 39, 33), (65, 39, 33)]:
    src[(src == c).all(-1)] = (84, 40, 34)
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
    hd = hexdist(x, y)
    px = src[yy[m] - y + sy, xx[m] - x + sx].astype(float)
    if hd <= 1:                                     # Honigglanz unter der Königin: volle Farbe
        f, sat = (1.0 if hd == 0 else 0.9), 1.0
    else:                                           # übrige Wabe als ruhiger Hintergrund
        f, sat = max(0.4, 0.62 - 0.06 * (hd - 2)), 0.78
    g = px.mean(-1, keepdims=True)
    warm = np.array([1.0, 1.0, 1.0]) if hd <= 1 else np.array([1.08, 0.94, 0.78])   # Hintergrund warm, nicht grünlich
    cv.a[m] = ((g + (px - g) * sat) * f * warm).clip(0, 255).astype(np.uint8)

# ---------- Figuren: eigenes 4×-Raster (64×88, beschnitten auf 250×350) ----------
W4, H4 = 64, 88
fg = np.zeros((H4, W4, 4), np.uint8)
sh = np.zeros((H4, W4, 4), np.uint8)                # Schatten getrennt, damit Flügel nicht darauf mischen
queen = compose(RU, [175, 176, 177])
# Arbeiterin: Körper (160) + Flügel (158, in den Szenen durchscheinend -> 70 % Deckkraft auf ganzen Pixeln),
# linke der drei Bienen; der rote Fleck (159) entfällt
body = compose(RU, [160], crop=False)
wing = compose(RU, [158], crop=False)
un = (body[..., 3] > 0) | (wing[..., 3] > 0)
import cv2
n, lab = cv2.connectedComponents(un.astype(np.uint8), connectivity=8)
ys0, xs0 = np.nonzero(un)
k = lab[ys0[np.argmin(xs0)], xs0.min()]            # linkeste Biene
ys, xs = np.nonzero(lab == k)
box = (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1)
bee = body[box[0]:box[1], box[2]:box[3]].copy()
wg = wing[box[0]:box[1], box[2]:box[3]]
wm = wg[..., 3] > 0
over = wm & (bee[..., 3] > 0)
bee[over, :3] = (wg[over, :3] * 0.7 + bee[over, :3] * 0.3).astype(np.uint8)
free = wm & (bee[..., 3] == 0)
bee[free, :3] = wg[free, :3]; bee[free, 3] = 178

def put(s, x, y):
    """Schlagschatten (1 Rasterpunkt nach rechts unten, 50 %) + Figur ins 4×-Raster."""
    m = s[..., 3] > 170
    h, w = m.shape
    for j in range(h):
        for i in range(w):
            if m[j, i] and 0 <= y + j + 1 < H4 and 0 <= x + i + 1 < W4:
                sh[y + j + 1, x + i + 1] = (20, 8, 4, 128)
    for j in range(h):
        for i in range(w):
            a_ = s[j, i, 3]
            if a_ and 0 <= y + j < H4 and 0 <= x + i < W4:
                if a_ == 255 or fg[y + j, x + i, 3] == 0:
                    fg[y + j, x + i] = s[j, i]
                else:
                    fg[y + j, x + i, :3] = (s[j, i, :3] * a_ / 255 + fg[y + j, x + i, :3] * (1 - a_ / 255)).astype(np.uint8)
                    fg[y + j, x + i, 3] = 255

qh, qw = queen.shape[:2]
QX, QY = 32 - qw // 2, 44 - qh // 2                 # Mitte -> (125, 175) px
put(queen, QX, QY)
bh, bw = bee.shape[:2]
top = np.rot90(bee, 2).copy()                       # oben: schaut nach unten zur Königin
BL = 7                                              # linke Bienen ab x=7 (25 px vom Rand)
BT = QY - 2 - bh                                    # obere Reihe
BB = QY + qh + 2                                    # untere Reihe
put(top, BL, BT); put(flip(top), W4 - BL - bw, BT)
put(bee, BL, BB); put(flip(bee), W4 - BL - bw, BB)

out = Canvas(250, 350)
out.a[:] = up(np.dstack([cv.a, np.full((H, W), 255, np.uint8)]), 3)[1:351, 1:251, :3]
out.paste(up(sh, 4)[1:351, 3:253], 0, 0)
out.paste(up(fg, 4)[1:351, 3:253], 0, 0)
print(save(out, '34_heart_of_the_hive.png'))
