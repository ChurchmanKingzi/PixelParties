# -*- coding: utf-8 -*-
"""10 Serpent Breaker – Gegner „Cool Gang“ (Structure Deck Cool Gang), Held: Thorad, Strength of Coolness.

Bildidee: Götterdämmerung der Coolness (Deckkarte „Ragnarock“). Thorad, der Thor der Cool Gang, steht groß auf einem
verschneiten Felsvorsprung über dem nächtlichen Sturmmeer. Draußen hat sich Yolomungandr, die Weltschlange mit ihren
Goldketten (Yolomungandr, Ender of Coolness), aus dem Meer erhoben; Thorad hat seinen goldenen Hammer Modnir (Modnir,
Hammer of Coolness / Hammer Throw) geschleudert – die leuchtende Wurfbahn zieht sich von ihm quer übers Bild, der Hammer
kracht der Schlange unters Maul, ein Blitz aus der Wolkendecke lädt ihn auf. Klare Diagonale: Held unten links → Ziel oben
rechts. Kein Hallen-Motiv (Wowhalla bleibt außen vor).

Quellen (MotiveCoolhalla.xcf):
  Ebene 221 „Ebene #16“  – Base-Thorad (rechte Figur; Szene „Sichtbar #5“ = Ebene 264, Lage 173,50; 0 px Abweichung).
                           (NICHT 219: Variante mit rotem Zeigefinger „Burning Finger“.)
  Ebene 217 „Ebene #20“  – Modnir, der goldene Hammer (Karte „Modnir, Hammer of Coolness“, Szene Sichtbar #6).
  Ebene 184 „Ebene #60“  – Weltschlange mit Goldketten (rechte Figur 58×80; Yolomungandr-Serie, Szenen Sichtbar #53–55).
  Ebene 180 „Ebene #67“  – weißer Lichtstern (Einschlagsblitz).
  Ebene 218 „Ebene #24“  – Blitze (Gewitterszene Sichtbar #13).
  Ebene 143 „Ebene #87“  – Fels- und Schneetextur der Coolhalla-Berge (Felsvorsprung).
Selbst gezeichnet: Sturmhimmel, Wolkendecke, Meer/Wellen/Gischt, Wurfbahn, Glut am Einschlag, Schatten.

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): Sturmhimmel, Wolkendecke, Blitz ins Meer, Meer, goldener Einschlagschein
  Mittelgrund 3× (84×117):  Weltschlange (240×174 px) mit Gischt, Modnir, Lichtstern-Kern, Wurfbahn
  Vordergrund 5× (50×70):   Felsvorsprung mit Schneekappe, Thorad (110×130 px)
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(10)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
B = 'MotiveCoolhalla'

# ------------------------------------------------------------------ Sprites
thorad = parts(layer(B, 221)[50:95, 170:230], dil=1)[-1]            # 26×22 (rechte Figur = Thorad)
modnir = sprite('o10_modnir', B, [217])                             # 27×22
serpent = parts(sprite('o10_z184', B, [184]), dil=1)[-1]             # 58×80, Kopf rechts oben
star = sprite('o10_z180', B, [180])                                  # 61×83 Lichtstern
bolts = parts(sprite('o10_light', B, [218]), dil=1)
bolt = [p for p in bolts if p.shape[1] == 39][0]                     # 94×39
m143 = sprite('o10_z143', B, [143])
ROCK = m143[12:30, 60:110, :3].astype(float)
SNOW = m143[95:118, 20:150, :3].astype(float)


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


def tex(src, y, x):
    h, w = src.shape[:2]
    return src[y % h, x % w]


# ================================================================== Geometrie
SEA = 90                          # Meereshorizont (2×-Raster, Canvas y 180)
SX3, SY3 = -8, 2                 # Weltschlange im 3×-Raster: Fuß auf dem Horizont (3×-y 63), Kopf rechts oben
JAW = (SX3 + 70, SY3 + 26)        # Unterkiefer (3×-Raster)
HX3, HY3 = JAW[0] - 6, JAW[1] + 1 # Modnir (3×-Raster): Hammerkopf trifft von unten gegen den Kiefer
IMP3 = (HX3 + 7, HY3 + 2)         # Einschlagpunkt (3×-Raster)
IMP = (IMP3[0] * 1.5, IMP3[1] * 1.5)   # derselbe Punkt im 2×-Raster (für den Lichtschein)
BX = 22                           # Blitzeinschlag im Meer links hinten (2×-Raster)

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
TOP, MID = np.array((10, 12, 30)), np.array((44, 52, 92))
for y in range(H2):
    for x in range(W2):
        if y < SEA:
            t = y / SEA
            c = TOP * (1 - t) + MID * t
        else:
            k = y - SEA
            c = np.array((18, 26, 52)) + np.array((10, 14, 20)) * min(1, k / 60)
            if (k + int(2 * math.sin(x * 0.3 + k * 0.7))) % 7 == 0: c = c + np.array((34, 44, 70))   # Wellenkämme
        d = math.hypot(x + 0.5 - IMP[0], (y + 0.5 - IMP[1]) * 1.1)
        L = max(0, 1 - d / 42) ** 1.4                       # goldener Schein des Einschlags
        q = math.floor(L * 5 + BAY[y % 4, x % 4]) / 5
        c = c + (np.array((255, 214, 120)) - c) * 0.45 * q
        bg[y, x, :3] = np.clip(c, 0, 255)

# Blitz aus der Wolkendecke in den Hammer (vor der Wolke gezeichnet, Wolke deckt das obere Ende)
bl = trim(bolt[10:, :])
tip = int(np.nonzero(bl[-1, :, 3])[0].mean())
put(bg, bl, BX - tip, SEA - bl.shape[0] + 1)
for dx in range(-4, 5):                                      # Gischt am Blitzeinschlag
    bg[SEA, BX + dx, :3] = (230, 236, 255) if abs(dx) < 3 else (150, 170, 220)

# Wolkendecke: Wolkenbäuche, zweistufig gedithert, über dem Einschlag hell angestrahlt
CL1, CL2, CL3 = np.array((22, 24, 46)), np.array((44, 50, 84)), np.array((150, 140, 120))
LOBES = [(-6, 10, 13), (12, 15, 12), (30, 11, 12), (48, 17, 13), (66, 12, 12), (84, 16, 13), (102, 11, 12),
         (118, 15, 13), (134, 10, 13)]


def cloud_edge(x):
    e = 0
    for cx, cy, r in LOBES:
        dx = x + 0.5 - cx
        if abs(dx) < r: e = max(e, cy + math.sqrt(r * r - dx * dx) * 0.5)
    return e


for x in range(W2):
    e = cloud_edge(x)
    for y in range(0, int(e) + 1):
        k = e - y
        c = CL2 if max(0.0, 1 - k / 10) > BAY[y % 4, x % 4] + 0.25 else CL1
        if k <= 1.6: c = CL3 if abs(x + 0.5 - BX) < 10 else CL2
        bg[y, x, :3] = c

# ================================================================== Mittelgrund 3× (84×117)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
# Weltschlange mit Goldketten, aus dem Meer steigend; Gischt an der Wasserlinie
put(mid, serpent, SX3, SY3)
cols = np.nonzero(serpent[-1, :, 3])[0]
for x in range(max(0, SX3 + cols.min() - 2), SX3 + cols.max() + 3):
    mid[SY3 + serpent.shape[0], x, :3] = (200, 214, 240) if x % 2 else (140, 160, 206)
    mid[SY3 + serpent.shape[0], x, 3] = 255
# Wurfbahn: leuchtende Bogenspur von Thorad (links unten) zum Stielende des Hammers
x0, y0 = 56, 68                                     # rechts neben Thorads Kopf
hcols = np.nonzero(modnir[-1, :, 3])[0]
x1, y1 = HX3 + int(hcols.mean()), HY3 + modnir.shape[0]      # Stielende
for i in range(120):
    t = i / 119
    x = x0 + (x1 - x0) * t
    y = y0 + (y1 - y0) * t + 4 * math.sin(math.pi * t)
    for w in (0, 1):
        xi, yi = int(round(x)) + w, int(round(y))
        if 0 <= xi < W3 and 0 <= yi < H3:
            mid[yi, xi, :3] = (255, 244, 170) if (i + w) % 2 == 0 else (250, 184, 70)
            mid[yi, xi, 3] = int(255 * (0.55 + 0.45 * t))
# Lichtstern (Kern) am Einschlag, dann der Hammer
sc = np.array(np.nonzero(star[..., 3])).mean(1).astype(int)
st = star[sc[0] - 7:sc[0] + 8, sc[1] - 7:sc[1] + 8]
put(mid, st, IMP3[0] - 8, IMP3[1] - 6)
put(mid, modnir, HX3, HY3)
for (dx, dy) in [(-3, -2), (4, -4), (-5, 2), (6, 1), (1, -5)]:      # Funken
    x, y = IMP3[0] + dx, IMP3[1] + dy
    if 0 <= x < W3 and 0 <= y < H3: mid[y, x, :3] = (255, 240, 150); mid[y, x, 3] = 255

# ================================================================== Vordergrund 5× (50×70)
W6, H6 = 50, 70
fg = np.zeros((H6, W6, 4), np.uint8)
TX = 21 - thorad.shape[1] // 2
FEET = 62
# Felsvorsprung: Schneekappe auf braunem Fels, nach rechts unten abfallend
for x in range(W6):
    top = FEET + 1 + (0 if x < 36 else (x - 36) * 0.6) + (0 if x > 6 else (6 - x) * 0.6) + 0.6 * math.sin(x * 0.8)
    top = int(top)
    for y in range(top, H6):
        if y - top < 2:
            c = tex(SNOW, y, x * 2)
        else:
            c = tex(ROCK, y * 2, x * 3) * 0.7
        fg[y, x, :3] = np.clip(c, 0, 255); fg[y, x, 3] = 255
for i in range(thorad.shape[1] - 2):                 # Schatten
    fg[FEET + 1, TX + 1 + i, :3] = (70, 76, 120)
put(fg, thorad, TX, FEET + 1 - thorad.shape[0])

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(mid, 3), -1, 0)
cv.paste(up(fg, 5), 0, 0)
save(cv, '10_serpent_breaker.png')
print('ok')
