# -*- coding: utf-8 -*-
"""04 Cracked Keeper – Chaos-Diamond, der violette Kristallwächter, steht breitbeinig und frontal in seiner
Höhle. Hinter ihm reißt die Felswand in einem glühenden Spalt auf, der aus dem Boden unter seinen Füßen
emporsteigt; der rote Riss-Kristall in seiner Brust antwortet mit demselben Licht.

Quellen (Motive.xcf):
  Ebene 241 „Chaos-Diamond #2“ (Karte „Chaos-Diamond, the Cracked Keeper“, Szene „Sichtbar #228“) – 4×,
  Vordergrund. Vollständigkeit geprüft: die Szene zeigt ihn nur im Kartenfenster (Beine teils verdeckt),
  die Ebene enthält die ganze Figur.
  Farben der Höhle nach der Kartenszene (graues Geröll, schwarzviolette Wand).
Selbst gezeichnet (125×175-Raster = 2×): Felswand, Boden, glühender Spalt mit Verästelungen, Lichtschein,
Geröll, Schatten.
Skalierung: Hintergrund 2×; Chaos-Diamond 4× als klarer Vordergrund.
"""
import math, random
import numpy as np
from common import *  # noqa

W, H = 250, 350
GW, GH = 125, 175
bg = Canvas(GW, GH)
rnd = random.Random(4)

FLOOR = 122                     # Horizont Wand/Boden im 2×-Raster
WALL = [(16, 12, 26), (24, 18, 36), (34, 26, 48), (46, 38, 62)]
GROUNDC = [(40, 36, 46), (56, 52, 62), (74, 70, 80), (96, 92, 102)]

# ---- Felswand: große Blöcke (Voronoi) mit dunklen Fugen ----
seeds = [(rnd.uniform(0, GW), rnd.uniform(0, FLOOR), rnd.randint(1, 2)) for _ in range(46)]
for y in range(FLOOR):
    for x in range(GW):
        ds = sorted(((x - sx) ** 2 + ((y - sy) * 1.3) ** 2, c) for sx, sy, c in seeds)
        d1, c = ds[0]; d2 = ds[1][0]
        if math.sqrt(d2) - math.sqrt(d1) < 1.0: col = WALL[0]
        else:
            col = WALL[c]
            # Oberkante der Blöcke leicht heller (Licht von unten/aus dem Spalt folgt später)
            if 0.12 > BAYER4[y % 4, x % 4] and ((x * 7 + y * 3) % 5 == 0): col = WALL[c + 1]
        bg.a[y, x] = col
# nach oben dunkler
for y in range(FLOOR):
    f = 0.55 + 0.45 * (y / FLOOR)
    for x in range(GW):
        if f < 1 and (1 - f) * 2 > BAYER4[y % 4, x % 4]:
            bg.a[y, x] = (bg.a[y, x] * 0.6).astype(np.uint8)
# ---- Boden: Geröll ----
for y in range(FLOOR, GH):
    for x in range(GW):
        v = rnd.random()
        k = 1 if v < 0.84 else 0 if v < 0.92 else 2
        bg.a[y, x] = GROUNDC[k]
# Wandfuß-Kante
for x in range(GW):
    bg.a[FLOOR, x] = (22, 18, 28)
    if (x // 3) % 2: bg.a[FLOOR + 1, x] = (30, 26, 36)
# Geröllbrocken
def rock(cx, cy, rx, ry):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if e < 1 and 0 <= x < GW and 0 <= y < GH:
                top = ((x + .5 - cx) / rx) ** 2 + ((y - .5 - cy) / ry) ** 2 >= 1
                bg.a[y, x] = GROUNDC[3] if top else (GROUNDC[2] if x < cx else GROUNDC[1])
    for x in range(cx - rx, cx + rx + 1):
        if 0 <= x < GW and cy + ry + 1 < GH: bg.a[cy + ry + 1, x] = (24, 20, 30)
for (cx, cy, rx, ry) in [(14, 150, 5, 3), (108, 146, 6, 3), (24, 131, 3, 2), (100, 129, 3, 2), (6, 165, 4, 2),
                         (117, 162, 4, 3)]:
    rock(cx, cy, rx, ry)

# ---- glühender Spalt: steigt aus dem Boden hinter dem Wächter die Wand hinauf und verästelt sich ----
CR = [(255, 230, 240), (255, 90, 130), (214, 24, 72), (8, 4, 10)]
crack = np.zeros((GH, GW), np.uint8)       # 0 nichts, 1 Rand, 2 Glut, 3 Kern
def seg_line(pts, w0, w1):
    """Polylinie mit von w0 auf w1 abnehmender Breite; Kern (3), Glut (2), Rand (1)."""
    raster = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n):
            raster.append((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)))
    raster.append(pts[-1])
    N = len(raster)
    for i, (px, py) in enumerate(raster):
        w = w0 + (w1 - w0) * i / max(1, N - 1)
        r = int(round(w))
        for dy in range(-r - 1, r + 2):
            for dx in range(-r - 1, r + 2):
                X, Y = px + dx, py + dy
                if not (0 <= X < GW and 0 <= Y < GH): continue
                d = max(abs(dx), abs(dy) * 0.6)
                lvl = 4 if (d == 0 and r >= 2) else 3 if d <= max(0, r - 1) else 2 if d <= r else 1 if d <= r + 1 else 0
                crack[Y, X] = max(crack[Y, X], lvl)
MAIN = [(62, 130), (62, 121), (60, 110), (64, 98), (59, 84), (63, 70), (58, 56), (61, 44), (55, 30), (58, 18),
        (52, 5), (54, -3)]
seg_line(MAIN, 2.4, 0.6)
seg_line([(59, 84), (50, 79), (45, 70), (36, 64), (30, 57)], 1.4, 0.6)
seg_line([(58, 56), (68, 50), (74, 40), (84, 35), (90, 26)], 1.4, 0.6)
seg_line([(55, 30), (46, 25), (42, 15), (35, 10)], 1.0, 0.5)
seg_line([(63, 70), (71, 66), (75, 60)], 0.8, 0.4)
# Spalt läuft im Boden zwischen den Füßen nach vorn und wird dabei breiter
seg_line([(62, 124), (60, 136), (64, 148), (61, 160), (63, 172), (62, 178)], 1.0, 3.0)
# Lichtschein um den Spalt (gedithert, nur auf Fels)
ys, xs = np.nonzero(crack >= 2)
glow = np.zeros((GH, GW))
for y in range(GH):
    for x in range(GW):
        d = np.min(np.abs(xs - x) + np.abs(ys - y) * 0.9) if len(xs) else 99
        glow[y, x] = max(0.0, 1 - d / 16.0)
for y in range(GH):
    for x in range(GW):
        t = glow[y, x]
        if crack[y, x]: continue
        if t * 1.3 > BAYER4[y % 4, x % 4] + 0.6:
            bg.a[y, x] = np.minimum(255, bg.a[y, x] * 0.5 + np.array((120, 20, 60)) * 0.9).astype(np.uint8)
        elif t * 1.3 > BAYER4[y % 4, x % 4]:
            bg.a[y, x] = np.minimum(255, bg.a[y, x] * 0.6 + np.array((70, 12, 40)) * 0.8).astype(np.uint8)
for y in range(GH):
    for x in range(GW):
        if crack[y, x] == 4: bg.a[y, x] = CR[0]
        elif crack[y, x] == 3: bg.a[y, x] = CR[1]
        elif crack[y, x] == 2: bg.a[y, x] = CR[2]
        elif crack[y, x] == 1: bg.a[y, x] = CR[3]

# ---- Schatten des Wächters auf dem Boden ----
K = 4
ck = sprite('a04_keeper', 'Motive', [241])
kh, kw = ck.shape[:2]
FEET = 322
KX = W // 2 - (kw * K) // 2
KY = FEET - kh * K
for y in range(GH):
    for x in range(GW):
        e = ((x + .5 - (KX + kw * K / 2) / 2) / 44.0) ** 2 + ((y + .5 - FEET / 2 + 1) / 5.0) ** 2
        if e < 1 and 0.7 > BAYER4[y % 4, x % 4] and not crack[y, x]:
            bg.a[y, x] = (bg.a[y, x] * 0.35).astype(np.uint8)

cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((GH, GW), 255, np.uint8)]), 2)[:, :, :3]
cv.paste(up(ck, K), KX, KY)
print(save(cv, '04_cracked_keeper.png'))
