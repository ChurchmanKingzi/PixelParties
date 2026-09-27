# -*- coding: utf-8 -*-
"""15 Birthday Wish – Stillleben im abgedunkelten Labor: eine riesige Geburtstagstorte mit drei
brennenden Kerzen, an ihr festgebunden zwei blaue Luftballontrauben; links davor Monia, die mit
geschlossenen Augen ihren Wunsch denkt, rechts davor das Geschenk. Nur die Kerzen erhellen den Raum.

Quellen (MotiveGN.xcf), Anordnung Torte/Ballons/Geschenk wie in Szene 578 „Sichtbar #42“:
  Ebene 359 „Ebene #132“ – Torte mit Kerzen (in der Szene teils vom Geschenk verdeckt, sonst identisch)
  Ebene 360 „Ebene #131“ – zwei Luftballontrauben (Schnüre um 3–5 Pixel bis zum Tortenteller verlängert)
  Ebene 358 „Ebene #126“ – Geschenk (135/145 Pixel in Szene 578 sichtbar, Rest verdeckt)
  Ebene 547 „Chibi-Monia“ – Monia mit geschlossenen Augen (Karte „Cool Birthday Girl Monia“)
  Ebene 134 „Ebene #249“ – Labor-Wand (Mäanderfliesen) und Bodenplatten
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Raum (Wand mit Mäanderfries, Boden) und Kerzenschein 2× (Raster 125×175);
  Torte, Ballons, Schnüre, Geschenk, Monia, Bodenschatten 4× (Raster 63×88).
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
frieze = lab[169 + 10:169 + 34, 70:390, :3]        # Mäanderfliesen als Fries
floor = lab[169 + 150:169 + 240, 70:390, :3]       # Bodenplatten
bg = Canvas(125, 175)
FLOORY = 108                                       # Wand/Boden-Kante im 2×-Raster
vgrad(bg, [(0, (14, 8, 20)), (1, (34, 20, 36))], y1=FLOORY)
for y in range(FLOORY - 26, FLOORY - 2):           # Fries knapp über dem Boden, stark abgedunkelt
    for x in range(125):
        c = frieze[y - (FLOORY - 26), (x + 7) % frieze.shape[1]].astype(float)
        bg.a[y, x] = (c * 0.22 + np.array([22, 12, 24])).astype(np.uint8)
bg.a[FLOORY - 27] = (12, 6, 14); bg.a[FLOORY - 2] = (12, 6, 14)
for y in range(FLOORY, 175):
    for x in range(125):
        c = floor[(y - FLOORY) % floor.shape[0], (x + 3) % floor.shape[1]].astype(float)
        bg.a[y, x] = (c * 0.30 + np.array([16, 10, 14])).clip(0, 255).astype(np.uint8)
bg.a[FLOORY - 1] = (10, 6, 12); bg.a[FLOORY] = (60, 44, 50)
# Kerzenschein: warmes Licht in drei Stufen, zwischen den Stufen geordnet gedithert
CANDLE = (62.5, 80)
LV = [np.array([1.25, 1.1, 0.95]), np.array([1.6, 1.3, 1.0]), np.array([2.1, 1.6, 1.1])]
for y in range(175):
    for x in range(125):
        d = math.hypot(x + .5 - CANDLE[0], (y + .5 - CANDLE[1]) * 0.95) / 70
        if d >= 1: continue
        t = (1 - d) * 3
        i = int(t); f = t - i
        if f > BAYER4[y % 4, x % 4]: i += 1
        if i == 0: continue
        c = bg.a[y, x].astype(float) * LV[min(i, 3) - 1] + np.array([6, 2, 0]) * i
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
TX, TY = 19, 32
ox, oy = 205 - TX, 258 - TY                         # Tortenecke -> (19, 32) im 63er-Raster
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
def shadow(cx, cy, rx, ry):
    for Y in range(int(cy - ry), int(cy + ry) + 1):
        for X in range(int(cx - rx), int(cx + rx) + 1):
            if ((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2 < 1 and 0 <= X < gw and 0 <= Y < gh:
                if (X + Y) % 2 == 0 or ((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2 < 0.45:
                    out[Y, X] = (18, 10, 14, 255)
shadow(TX + 12.5, TY + 31, 15, 2.2)
put(grp[b[1]:b[3], b[0]:b[2]], b[0] - ox, b[1] - oy)
# Geschenk rechts vorne, Monia links vorne (weiter vorne = tiefer im Bild)
gs = sprite('c15_gift', D, [358])                   # 14×13
ms = sprite('c15_monia', D, [547])                  # 22×16
MX, MY = 8, TY + 40 - 22
GX, GY = 41, TY + 38 - 13
shadow(MX + 8, MY + 22, 8, 1.8)
shadow(GX + 7, GY + 13.5, 8, 1.8)
put(ms, MX, MY)
put(gs, GX, GY)

cv.paste(up(out, G)[:H, 1:W + 1], 0, 0)
print(save(cv, '15_birthday_wish.png'))
