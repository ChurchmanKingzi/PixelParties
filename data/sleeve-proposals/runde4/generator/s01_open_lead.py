# -*- coding: utf-8 -*-
"""01 Open Lead – Luftbild aufs Packeis: Zwischen schneebedeckten Eisschollen öffnet sich eine breite Rinne
dunklen Wassers. Darin schwimmt der Narwal nach oben, sein Stoßzahn schiebt eine Bugwelle vor sich her.
Am Rand der großen Scholle rechts oben rutscht Snobbit bäuchlings mit langer Spur auf die Rinne zu – genau
dorthin, wo der Narwal gleich auftaucht.

Quellen:
  Motive.xcf Ebene 780 „Narw“ (Karte „Slippery Narw“, Draufsicht) – 4×
  Motive.xcf Ebene 783 „Snobbit“ (Karte „Slippery Snobbit“, Draufsicht) – 4×
  MotiveCoolhalla.xcf Ebene 143 „Ebene #87“: Schneetextur (Kachel 8×8, x 127–135, y 64–72) für die Schollen – 4×
  Farben der Eiskanten (Diagonal-Eis) und des Wassers aus den Slippery-Szenen (Motive 779/782).
Selbst gezeichnet (63×88-Raster = 4×): Schollenform (Voronoi mit Rissen), Schollenkanten mit sichtbarer
Eisdicke, Schlagschatten, Wasser mit Tiefenverlauf, kleine Treibschollen, Bugwelle, Rutschspur.
Skalierung: EINE Tiefenebene, alles 4× (Raster 63×88, auf 252×352 hochskaliert, auf 250×350 beschnitten).
"""
import math, random
import numpy as np
from common import *  # noqa

K = 4
GW, GH = 63, 88
rnd = random.Random(3)

ICE_WALL = [(173, 174, 247), (140, 142, 239)]
RIM = (247, 255, 255)
WAT = [(0, 16, 120), (0, 24, 181), (0, 40, 206), (0, 81, 247), (0, 117, 239), (60, 160, 240)]

snow_src = compose('MotiveCoolhalla', [143], crop=False)
b = bbox(layer('MotiveCoolhalla', 143))
SNOW = snow_src[b[1] + 64:b[1] + 72, b[0] + 127:b[0] + 135, :3].copy()

# ---- Schollen: handgesetzte Voronoi-Zentren, Risse an den Zellgrenzen ----
SEEDS = [(4, 4), (22, -6), (46, 2), (60, 14), (50, 26), (60, 44), (54, 62), (60, 80), (48, 92),
         (6, 26), (-4, 44), (8, 58), (2, 76), (16, 92), (30, 100)]
def center(y):                              # Mittellinie der Hauptrinne
    t = min(1.0, max(0.0, (y - 4) / 30.0)); t = t * t * (3 - 2 * t)
    return 20 + 11 * t + 1.2 * math.sin(y / 5.0) - 3 * max(0, y - 74) / 14
def halfw(y):
    return (7 if y < 16 else 7 + 8 * min(1, (y - 16) / 14)) + 1.0 * math.sin(y / 3.7)

# Breite der Fuge zwischen zwei Zellen: 0 = verwachsen (größere Scholle), sonst offenes Wasser
PAIR = {}
def pairw(i, j):
    k = (min(i, j), max(i, j))
    if k not in PAIR:
        PAIR[k] = rnd.choice((0, 0, 2.6, 3.4, 4.2))
    return PAIR[k]
for k, v in {(2, 3): 0, (3, 4): 0, (2, 4): 0, (1, 2): 3.6, (4, 5): 3.2, (0, 1): 0, (0, 9): 3.0,
             (9, 10): 0, (10, 11): 3.4, (11, 12): 0, (12, 13): 2.6, (5, 6): 0, (6, 7): 3.8, (7, 8): 0}.items():
    PAIR[k] = v
def noise(x, y):
    return (((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995) % 1000) / 1000.0
floe = np.zeros((GH, GW), bool)
for y in range(GH):
    for x in range(GW):
        ds = sorted(((x + .5 - sx) ** 2 + ((y + .5 - sy) * 1.15) ** 2, i) for i, (sx, sy) in enumerate(SEEDS))
        (d1, i1), (d2, i2) = ds[0], ds[1]
        gap = math.sqrt(d2) - math.sqrt(d1) + 0.7 * (noise(x // 2, y // 2) - 0.5)
        w = pairw(i1, i2)
        floe[y, x] = w == 0 or gap > 2 * w          # Distanzdifferenz wächst ~2 je Pixel
        if abs(x + .5 - center(y)) < halfw(y) + 0.9 * noise(x, y // 2): floe[y, x] = False
# kleine Treibschollen in der Rinne
DRIFT = [(center(9) + 1, 8, 3.2, 2.2), (center(40) - 12, 44, 2.4, 1.8), (center(70) + 11, 70, 2.6, 2.0),
         (center(84) - 9, 84, 3.4, 2.2), (center(26) + 11, 27, 1.8, 1.4)]
for cx, cy, rx, ry in DRIFT:
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if 0 <= x < GW and 0 <= y < GH:
                j = ((x * 7 + y * 11) % 5) * 0.05
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < 1 - j: floe[y, x] = True

# ---- Wasser mit Tiefenverlauf (Abstand zur nächsten Scholle) ----
import cv2
dist = cv2.distanceTransform((~floe).astype(np.uint8), cv2.DIST_L2, 3)
g = Canvas(GW, GH)
for y in range(GH):
    for x in range(GW):
        if floe[y, x]: continue
        d = dist[y, x]
        lv = 5 if d <= 1.2 else 4 if d <= 2.2 else 3 if d <= 3.6 else 2 if d <= 5.5 else 1 if d <= 8 else 0
        # weiche Übergänge: geordnet dithern zwischen Nachbarstufen
        frac = {5: 0, 4: 0, 3: (d - 2.2) / 1.4, 2: (d - 3.6) / 1.9, 1: (d - 5.5) / 2.5, 0: 0}[lv]
        if lv in (1, 2, 3) and frac > 0.6 and 0.5 > BAYER4[y % 4, x % 4]: lv -= 1
        g.a[y, x] = WAT[lv]
# vereinzelte Glanzstriche im offenen Wasser
for y in range(0, GH, 2):
    for x in range(GW - 1):
        h = ((x * 73856093) ^ (y * 19349663)) % 41
        if h == 0 and not floe[y, x] and not floe[y, x + 1] and dist[y, x] > 3:
            g.a[y, x] = WAT[3]; g.a[y, x + 1] = WAT[3]
# ---- Schollen: Schneeoberfläche, beleuchtete Oberkante, sichtbare Eisdicke unten, Schatten ----
for y in range(GH):
    for x in range(GW):
        if floe[y, x]:
            g.a[y, x] = SNOW[y % 8, x % 8]
# blankes Eis (Diagonal-Eis der Slippery-Karten), wo der Wind den Schnee weggeblasen hat
edge_d = cv2.distanceTransform(floe.astype(np.uint8), cv2.DIST_L2, 3)
BARE = [(214, 211, 255), (173, 174, 247), (165, 166, 247)]
for cx, cy, rx, ry in [(8, 14, 6, 3), (52, 42, 5, 3), (10, 66, 7, 4), (54, 76, 4, 3), (4, 40, 4, 3)]:
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            if not (0 <= x < GW and 0 <= y < GH) or edge_d[y, x] < 2.5: continue
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < 0.8 + 0.4 * noise(x, y):
                d = (x + y) % 6
                g.a[y, x] = BARE[0] if d < 2 else BARE[1] if d < 4 else BARE[2]
for y in range(GH):
    for x in range(GW):
        if not floe[y, x]: continue
        if y + 1 < GH and not floe[y + 1, x]:                 # unterer Rand: Eiswand (2 px)
            g.a[y, x] = ICE_WALL[1]
            if y - 1 >= 0 and floe[y - 1, x]: g.a[y - 1, x] = ICE_WALL[0]
        elif (y - 1 >= 0 and not floe[y - 1, x]) or (x - 1 >= 0 and not floe[y, x - 1]):
            g.a[y, x] = RIM
        elif x + 1 < GW and not floe[y, x + 1]:
            g.a[y, x] = ICE_WALL[0]
SHADOW = (0, 12, 90)
for y in range(GH):
    for x in range(GW):
        if floe[y, x]: continue
        if (y - 1 >= 0 and floe[y - 1, x]) or (y - 1 >= 0 and x - 1 >= 0 and floe[y - 1, x - 1] and floe[y, x - 1]):
            g.a[y, x] = SHADOW
        elif x - 1 >= 0 and floe[y, x - 1] and 0.5 > BAYER4[y % 4, x % 4]:
            g.a[y, x] = SHADOW

# ---- Narwal (senkrecht gespiegelt: schwimmt nach oben) ----
narw = sprite('a01_narw', 'Motive', [780])[::-1].copy()
nh, nw = narw.shape[:2]
NX = int(round(center(56))) - nw // 2
NY = 30
hx = NX + nw // 2
for i in range(-13, 14):                    # Bugwelle: zwei helle Bögen vor dem Stoßzahn
    for r0, a0, col in ((3, 9.0, (200, 215, 255)), (6, 13.0, WAT[4])):
        x = hx + i
        y = NY + 8 - r0 - int(round(8 * (1 - (i / 13.0) ** 2) * (a0 / 13.0)))
        if abs(i) >= 3 and 0 <= y < GH and 0 <= x < GW and not floe[y, x]:
            g.a[y, x] = col
for j in range(nh):                        # Unterwasser-Schatten
    for i in range(nw):
        X, Y = NX + i + 2, NY + j + 2
        if narw[j, i, 3] and Y < GH and X < GW and not floe[Y, X] and 0.5 > BAYER4[Y % 4, X % 4]:
            g.a[Y, X] = WAT[0]
for j in range(nh):
    for i in range(nw):
        if not narw[j, i, 3]: continue
        c = narw[j, i, :3].astype(float)
        if j > nh - 13:                    # Schwanz taucht ab: zum Wasserblau hin umgefärbt
            t = 0.3 + 0.25 * (j - (nh - 13)) / 13
            c = c * (1 - t) + np.array(WAT[1]) * t
        g.a[NY + j, NX + i] = c.astype(np.uint8)

# ---- Snobbit auf der großen Scholle rechts oben, rutscht auf die Rinne zu ----
snob = sprite('a01_snobbit', 'Motive', [783])
sh_, sw_ = snob.shape[:2]
SX, SY = 38, 11
TRAIL = [(222, 223, 255), (173, 174, 247), (140, 142, 239)]
for y in range(0, SY + 4):
    for x in range(SX + 2, SX + sw_ - 2):
        if not floe[y, x]: continue
        edge = x in (SX + 2, SX + sw_ - 3)
        g.a[y, x] = TRAIL[2] if edge else (TRAIL[1] if (x in (SX + 3, SX + sw_ - 4)) else TRAIL[0])
for (dx, dy) in [(-1, 16), (13, 16), (-2, 14), (14, 14), (0, 18), (12, 18), (6, 18), (3, 19), (9, 19)]:
    X, Y = SX + dx, SY + dy
    if 0 <= X < GW and 0 <= Y < GH and floe[Y, X]: g.a[Y, X] = RIM
for j in range(sh_):
    for i in range(sw_):
        if snob[j, i, 3]:
            X, Y = SX + i + 1, SY + j + 1
            if floe[Y, X]: g.a[Y, X] = ICE_WALL[1]
g.paste(snob, SX, SY)

cv = Canvas(250, 350)
cv.a[:] = up(np.dstack([g.a, np.full((GH, GW), 255, np.uint8)]), K)[1:351, 1:251, :3]
print(save(cv, '01_open_lead.png'))
