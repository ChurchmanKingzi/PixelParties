# -*- coding: utf-8 -*-
"""10 Hammerfall – Gegner „Cool Gang“ (Structure Deck Cool Gang), Held: Thorad, Strength of Coolness.

Bildidee: Thorad (Thor der Cool Gang) steht auf einem Felsgipfel über dem Wolkenmeer im Gewitter; sein geworfener
Hammer (Hammer Throw) fliegt waagerecht über den Himmel, ein Blitz aus der Wolkendecke schlägt in den Hammerkopf,
ein zweiter fern in einen Gipfel (Ragnarock). Diagonale: Held unten links, Hammer oben rechts. Kein Hallen-Motiv.

Quellen (MotiveCoolhalla.xcf):
  Ebene 221 „Ebene #16“  – Base-Thorad (rechte Figur; Szene „Sichtbar #5“ = Ebene 264, Lage 173,50; 0 px Abweichung).
                           (NICHT 219: Variante mit rotem Zeigefinger „Burning Finger“.)
  Ebene 124 „Ebene #103“ – eiserner Hammer (16×23).
  Ebene 218 „Ebene #24“  – Blitze (Gewitterszene Sichtbar #13), einzelner verzweigter Blitz 39×94, zugeschnitten/gespiegelt.
  Ebene 82 „Ebene #137“  – graue Felsbrocken (die zwei unteren Brocken) als Gipfel, abgedunkelt.
Selbst gezeichnet: Gewitterhimmel, Wolkendecke, Wolkenmeer, ferne Gipfel, Blitzschein/Hof um den Hammer, Lichtkanten.

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): Himmel, Wolkendecke, Blitze, ferne Gipfel, Wolkenmeer
  Mittelgrund 4× (63×88):   fliegender Hammer (90° gedreht) mit Lichthof und Funken
  Vordergrund 5× (50×70):   Gipfelfels (Brocken abgedunkelt), Thorad
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(10)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
B = 'MotiveCoolhalla'

# ------------------------------------------------------------------ Sprites
thorad = parts(layer(B, 221)[50:95, 170:230], dil=1)[-1]            # 26×22 (rechte Figur = Thorad)
hammer = sprite('o10_hammer', B, [124])                              # 23×16
bolts = parts(sprite('o10_light', B, [218]), dil=1)
bolt = [p for p in bolts if p.shape[1] == 39][0]                     # 94×39
rocks = sprite('o10_rocks', B, [82])
boulder = rocks[44:76, 0:69]                                         # untere Brocken als Gipfel


def put(dst, s, x, y, f=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = np.clip(s[j, i, :3].astype(float) * f, 0, 255); dst[yy, xx, 3] = 255


def trim(s):
    ys, xs = np.nonzero(s[..., 3])
    return s[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


boulder = trim(boulder)

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
TOP, MID, LOW = np.array((14, 17, 36)), np.array((40, 48, 84)), np.array((84, 92, 132))
SEA = 122                                                   # Wolkenmeer-Oberkante (Canvas y 244)
PEAKS = [(98, 100, 0.85), (20, 106, 0.8)]                   # ferne Gipfel (x, Spitze y, Steilheit)
HAM = (88, 52)                                              # Hammerkopf (2×-Raster) – Ziel des Blitzes
for y in range(H2):
    for x in range(W2):
        t = y / SEA
        c = TOP * (1 - t) + MID * t if t < 1 else LOW
        L = 0.0
        for px, py, rr in [(HAM[0], HAM[1], 40), (PEAKS[1][0], PEAKS[1][1], 24)]:   # Blitzschein
            d = math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.2)
            L = max(L, max(0, 1 - d / rr) ** 1.4 * 0.6)
        q = math.floor(L * 4 + BAY[y % 4, x % 4]) / 4
        bg[y, x, :3] = np.clip(c + np.array((110, 118, 150)) * q * 0.45, 0, 255)

# ferne Gipfel, die aus dem Wolkenmeer ragen (vom Blitz beleuchtet: helle Grate)
for x in range(W2):
    top = SEA
    for px, py, st in PEAKS:
        top = min(top, py + abs(x + 0.5 - px) * st + 1.5 * math.sin(x * 1.3))
    top = int(top)
    for y in range(top, SEA + 1):
        near = min(abs(x + 0.5 - px) for px, _, _ in PEAKS)
        lit = (y - top) < 2 + (6 - min(near, 6)) * 0.5
        bg[y, x, :3] = (96, 104, 146) if lit else ((50, 56, 90) if (x * 3 + y) % 9 else (62, 68, 104))
    if top < SEA: bg[top, x, :3] = (160, 168, 206)
for y in range(SEA, H2):
    for x in range(W2):
        k = y - SEA
        wave = 2 * math.sin(x * 0.35 + k * 0.9)
        c = np.array((136, 142, 178)) if (k + wave) % 6 < 1.2 else np.array((104, 110, 150))
        bg[y, x, :3] = np.clip(c * (0.8 + 0.2 * min(1, k / 20)), 0, 255)

# Blitze: einer schlägt in den fliegenden Hammerkopf, ein zweiter weiter hinten in den linken Gipfel;
# das obere Ende verschwindet jeweils in der Wolkendecke (Wolke wird danach darübergelegt)
for (px, py), src, fl in [((HAM[0] + 5, HAM[1] - 5), trim(bolt[56:, :]), True), ((PEAKS[1][0], PEAKS[1][1]), trim(bolt[8:, :]), False)]:
    s_ = flip(src) if fl else src
    rows = np.nonzero(s_[-1, :, 3])[0]
    tipx = int(rows.mean())
    put(bg, s_, px - tipx, py - s_.shape[0] + 1)
px, py = PEAKS[1][0], PEAKS[1][1]
for (dx, dy) in [(0, 0), (-1, 0), (1, 0), (0, -1), (-2, 1), (2, 1)]:       # Einschlagblitz im Gipfel
    bg[py + dy, px + dx, :3] = (255, 250, 210)

# Wolkendecke oben: gewellte Unterkante (Wolkenbäuche), innen zwei Tonstufen im geordneten Dithering,
# Unterseite über den Blitzen vom Blitz aufgehellt
CL1, CL2, CL3 = np.array((24, 27, 48)), np.array((46, 52, 86)), np.array((120, 126, 166))
LOBES = [(-6, 16, 14), (12, 22, 13), (30, 18, 12), (48, 24, 14), (66, 19, 12), (84, 22, 14), (102, 18, 12),
         (118, 23, 13), (134, 16, 14)]


def cloud_edge(x):
    e = 0
    for cx, cy, r in LOBES:
        dx = x + 0.5 - cx
        if abs(dx) < r: e = max(e, cy + math.sqrt(r * r - dx * dx) * 0.5)
    return e


for x in range(W2):
    e = cloud_edge(x)
    nearp = min(abs(x + 0.5 - HAM[0]), abs(x + 0.5 - PEAKS[1][0]))
    for y in range(0, int(e) + 1):
        k = e - y
        t = max(0.0, 1 - k / 12)                       # zur Unterkante heller
        c = CL2 if t > BAY[y % 4, x % 4] + 0.25 else CL1
        if k <= 1.6: c = CL3 if nearp < 12 else CL2
        bg[y, x, :3] = c

# ================================================================== Vordergrund 5× (50×70)
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
bx = 25 - boulder.shape[1] // 2
by = 57
put(fg, boulder, bx, by, 0.45)
for i in range(boulder.shape[1]):                     # Blitzlicht auf den Felskuppen
    col = np.nonzero(boulder[:, i, 3])[0]
    if len(col) and 0 <= bx + i < W5 and by + col[0] < H5: fg[by + col[0], bx + i, :3] = (150, 156, 190)
top_rows = [np.nonzero(boulder[:, i, 3])[0] for i in range(boulder.shape[1])]


def rock_top(x0, x1):
    ys = [by + r[0] for i, r in enumerate(top_rows) if len(r) and x0 <= bx + i < x1]
    return min(ys) if ys else by


# Thorad links der Mitte auf der Kuppe
tx = 19 - thorad.shape[1] // 2
feet = rock_top(tx + 4, tx + thorad.shape[1] - 4) + 1
for i in range(thorad.shape[1] - 2):                  # Schatten unter Thorad
    x = tx + 1 + i
    fg[feet, x, :3] = (22, 22, 34); fg[feet, x, 3] = 255
put(fg, thorad, tx, feet - thorad.shape[0])

# ================================================================== Mittelgrund 4× (63×88)
W4, H4 = 63, 88
mid = np.zeros((H4, W4, 4), np.uint8)
hm = rot90(hammer, 3)                                 # waagerecht, Kopf voran nach rechts oben fliegend
hm = hm if hm[:, -4:, 3].sum() > hm[:, :4, 3].sum() else flip(hm)
hcx, hcy = HAM[0] * 2 / 4, HAM[1] * 2 / 4             # Hammerkopf-Mitte im 4×-Raster
hx0 = int(round(hcx - hm.shape[1] + 4)); hy0 = int(round(hcy - hm.shape[0] / 2))
# Blitzschein um den Hammer (weicher Hof im 4×-Raster, geordnetes Dithering)
for y in range(H4):
    for x in range(W4):
        dd = math.hypot(x + 0.5 - (hx0 + hm.shape[1] - 4), (y + 0.5 - (hy0 + hm.shape[0] / 2)) * 1.2)
        if dd < 13 and (1 - dd / 13) * 0.7 > BAY[y % 4, x % 4]:
            mid[y, x, :3] = (150, 170, 230); mid[y, x, 3] = 70
put(mid, hm, hx0, hy0)
for (dx, dy) in [(hm.shape[1], -1), (hm.shape[1] + 1, 3), (hm.shape[1] - 2, -2), (hm.shape[1] - 1, hm.shape[0] + 1)]:
    x, y = hx0 + dx, hy0 + dy                          # Funken am Hammerkopf
    if 0 <= x < W4 and 0 <= y < H4: mid[y, x, :3] = (255, 236, 120); mid[y, x, 3] = 255

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(mid, 4), -1, 0)
cv.paste(up(fg, 5), 0, 0)
save(cv, '10_hammerfall.png')
print('ok')
