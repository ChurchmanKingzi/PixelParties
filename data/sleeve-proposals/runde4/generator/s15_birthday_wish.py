# -*- coding: utf-8 -*-
"""15 Birthday Wish – Stillleben im abgedunkelten Labor: eine riesige Geburtstagstorte mit drei
brennenden Kerzen, an ihr festgebunden zwei blaue Luftballontrauben; links davor Monia, die mit
geschlossenen Augen ihren Wunsch denkt, rechts davor das Geschenk. Nur die Kerzen erhellen den Raum.

Quellen (MotiveGN.xcf), Anordnung Torte/Ballons/Geschenk wie in Szene 578 „Sichtbar #42“:
  Ebene 359 „Ebene #132“ – Torte mit Kerzen (in der Szene teils vom Geschenk verdeckt, sonst identisch)
  Ebene 360 „Ebene #131“ – zwei Luftballontrauben (Schnüre um 3–5 Pixel bis zum Tortenteller verlängert)
  Ebene 358 „Ebene #126“ – Geschenk (135/145 Pixel in Szene 578 sichtbar, Rest verdeckt)
  Ebene 547 „Chibi-Monia“ – Monia mit geschlossenen Augen (Karte „Cool Birthday Girl Monia“)
  Ebene 356 „Ebene #134“ – gelbe Freude-Striche (aus derselben Szene)
  Ebene 134 „Ebene #249“ – Labor-Wand (Mäanderfliesen) und Bodenplatten
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Raum (Wand, Boden) und Kerzenschein 2× (Raster 125×175);
  Torte, Ballons, Schnüre, Geschenk, Monia, Freude-Striche, Schatten 4× (Raster 63×88).
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350
G = 4

# ---------------------------------------------------------------- Raum (2×)
lab = layer(D, 134)
wall = lab[169 + 10:169 + 40, 70:390, :3]          # Mäanderfliesen-Band
floor = lab[169 + 120:169 + 200, 70:390, :3]       # Bodenplatten
bg = Canvas(125, 175)
FLOORY = 118                                       # Wand/Boden-Kante im 2×-Raster
for y in range(175):
    for x in range(125):
        if y < FLOORY:
            c = wall[y % wall.shape[0], (x + 7) % wall.shape[1]].astype(float)
            c = c * 0.30 + np.array([14, 8, 16])
        else:
            c = floor[(y - FLOORY) % floor.shape[0], (x + 3) % floor.shape[1]].astype(float)
            c = c * 0.36 + np.array([16, 10, 12])
        bg.a[y, x] = c.clip(0, 255).astype(np.uint8)
bg.a[FLOORY - 1] = (10, 6, 12); bg.a[FLOORY] = (54, 40, 46)
# Kerzenschein: warmes Licht, gestuft und geordnet gedithert, um die Kerzenflammen
CANDLE = (62.5, 58)
for y in range(175):
    for x in range(125):
        d = math.hypot(x + .5 - CANDLE[0], (y + .5 - CANDLE[1]) * 0.9) / 78
        if d >= 1: continue
        t = (1 - d) ** 1.6
        f = 1 + 0.9 * t
        warm = np.array([1.0 + 0.5 * t, 1.0 + 0.2 * t, 1.0 - 0.1 * t])
        c = bg.a[y, x].astype(float) * f * warm
        if t * 3 % 1 > BAYER4[y % 4, x % 4]:
            c = c * 1.08
        bg.a[y, x] = c.clip(0, 255).astype(np.uint8)
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.6, 0.5, g=2)

# ---------------------------------------------------------------- Stillleben (4×)
gw, gh = 63, 88
out = np.zeros((gh, gw, 4), np.uint8)
def put(s, x, y):
    for j in range(s.shape[0]):
        for i in range(s.shape[1]):
            if s[j, i, 3] and 0 <= x + i < gw and 0 <= y + j < gh:
                out[y + j, x + i] = s[j, i]

# Anordnung in Originalkoordinaten der xcf (Ballons 191..243 / 240..284, Torte 205..230 / 258..289)
ox, oy = 205 - 19, 258 - 24                         # Tortenecke -> (19, 24) im 63er-Raster
bal = layer(D, 360).copy()
# Schnüre bis zum Tellerrand verlängern (die Szene zeigt sie hinter der Torte endend)
S = bal[282, 202].copy() if bal[282, 202, 3] else bal[280, 203].copy()
for (x, y) in [(203, 283), (204, 284), (204, 285), (205, 286)]:
    bal[y, x] = S
for (x, y) in [(230, 284), (230, 285), (229, 286)]:
    bal[y, x] = S
cake = layer(D, 359)
gift = layer(D, 358)
from xcfkit import over
grp = over(bal, cake)                                # Torte vor den Schnüren
b = bbox(grp)
# Schatten der Torte auf dem Boden (4×, gedithert)
for i in range(-2, 28):
    for j in range(2):
        X, Y = 19 + i, 24 + 31 + j - 1
        if 0 <= X < gw and (i + j) % 2 == 0:
            out[Y, X] = (20, 12, 16, 255)
put(grp[b[1]:b[3], b[0]:b[2]], b[0] - ox, b[1] - oy)
# Geschenk rechts vorne, Monia links vorne (weiter vorne = tiefer im Bild)
gs = sprite('c15_gift', D, [358])                   # 14×13
ms = sprite('c15_monia', D, [547])                  # 22×16
MX, MY = 8, 63 - 22 + 2
GX, GY = 41, 63 - 14 + 1
for (sx, sy, s) in [(MX, MY, ms), (GX, GY, gs)]:
    for i in range(1, s.shape[1] - 1):              # Bodenschatten
        X, Y = sx + i, sy + s.shape[0]
        if (i % 2 == 0) and Y < gh: out[Y, X] = (20, 12, 16, 255)
put(ms, MX, MY)
put(gs, GX, GY)
# Freude-Striche neben Monias Kopf (aus Szene 578)
jy = sprite('c15_joy', D, [356])
put(flip(jy), MX - 6, MY - 6)

cv.paste(up(out, G)[:H, 1:W + 1], 0, 0)
print(save(cv, '15_birthday_wish.png'))
