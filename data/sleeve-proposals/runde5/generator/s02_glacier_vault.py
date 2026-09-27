# -*- coding: utf-8 -*-
"""02 Glacier Vault – Broghan, the Frozen Guardian of the North, steht in Ketten im Gewölbe unter dem Gletscher und
bewacht das Heart of Ice, das hinter ihm über dem Spiegeleis schwebt und die Eiswände kalt aufleuchten lässt.
Er selbst kann nicht erfrieren – er IST das Eis; sein rotes Auge ist das einzige warme Licht im Gewölbe.

Quellen:
  MotiveGrailWar.xcf  Ebene 472 „Broghan-Kopie“ – Base-Broghan mit Ketten (Karte „Broghan, the Frozen Guardian of
                      the North“, Sichtbar #31 = Ebene 108, Lage 233,97; linke obere Figur, Box 245,105–300,145).
                      Geprüft gegen die Szene: alle Pixel stimmen bis auf den weißen Schneedunst (~20 %) und das rote
                      Fadenkreuz der Karte überein; Ebene 473 „Broghan“ ist dieselbe Figur OHNE Ketten, die Figur rechts
                      (Armbrust) und die kettenlose Figur unten auf beiden Ebenen gehören zu anderen Szenen.
  MotiveGrailWar.xcf  Ebene 476 „Ebene #139“ – Eisfels-Textur (Eisgrate aus derselben Broghan-Szene), senkrecht
                      16-px-periodisch, daraus die Gewölbewand.
  Motive.xcf          Ebene 739 „Heart of Ice“ – das Artefakt (Karte „Heart of Ice“, Sichtbar Ebene 736).
Selbst gezeichnet: Lichtführung/Verdunklung der Eiswand, Eiszapfen, Spiegeleis-Boden mit Spiegelungen, Lichthof und
Strahlen des Herzens, Verlängerung der beiden oberen Ketten bis zur Decke (Kettenglieder im Muster der Figur).

Skalierung (Tiefenebenen):
  Hintergrund (Eiswand, Eiszapfen, Spiegeleis hinten)       – 2×-Raster (125×175)
  Mittelgrund (Heart of Ice mit Lichthof und Strahlen)      – 3×-Raster (84×117)
  Vordergrund (Broghan, Ketten, seine Spiegelung, Boden)    – 5×-Raster (51×71, um 3 px nach links versetzt,
                                                             damit Broghans Symmetrieachse mittig liegt)
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(2)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0

# ------------------------------------------------------------------ Sprites
broghan = sprite('h02_broghan', 'MotiveGrailWar', [472], box=(245, 105, 300, 145))   # 43×31, Achse Spalte 21
heart = sprite('h02_heart', 'Motive', [739])                                          # 10×8
wall_src = layer('MotiveGrailWar', 476)

ICE = [(90, 146, 198), (57, 89, 140), (132, 186, 222), (82, 121, 173), (173, 215, 255), (231, 239, 255), (82, 117, 173)]


def ice_texture():
    """Senkrecht kachelbare Eistextur (16 Zeilen) aus dem Eisgrat: je Spalte ein 16er-Stück aus dem Band."""
    rgb = wall_src[..., :3]
    m = np.zeros(rgb.shape[:2], bool)
    for c in ICE: m |= (rgb == c).all(2)
    m &= wall_src[..., 3] > 0
    T = np.zeros((16, 320, 3), np.uint8)
    for i, x in enumerate(range(143, 463)):
        ys = np.nonzero(m[:, x])[0]
        runs = np.split(ys, np.nonzero(np.diff(ys) != 1)[0] + 1)
        r = max(runs, key=len)
        for y in r[:16]: T[y % 16, i] = rgb[y, x]
    return T


def comp(dst, src_rgba, k, ox=0, oy=0):
    """Grobe RGBA-Ebene k-fach hochskalieren und auf das 250er-Canvas legen."""
    big = up(src_rgba, k)
    dst.paste(big, ox, oy)


# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
HX, HY = 62.5, 39.0           # Herzmitte im 2×-Raster (125, 78 im 250er-Raster)
HOR = 117                     # Horizont: Wand trifft Spiegeleis (y 234)
T = ice_texture()
tex = np.tile(T[:, 96:96 + W2], (H2 // 16 + 2, 1, 1))[:H2]
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255

NAVY = np.array((10, 14, 34))


def light(x, y):
    d = math.hypot((x + 0.5 - HX) / 1.0, (y + 0.5 - HY) / 1.15)
    L = max(0.0, 1 - d / 78.0) ** 1.6
    return L


for y in range(HOR):
    for x in range(W2):
        L = light(x, y)
        # untere Wandzone etwas heller (Gegenlicht vom Spiegeleis)
        L += 0.10 * max(0, (y - 80) / 37)
        f = 0.16 + 0.95 * L
        q = math.floor(f * 6 + BAY[y % 4, x % 4] - 0.5) / 6
        q = min(max(q, 0.12), 1.05)
        c = tex[y, x].astype(float)
        col = NAVY * (1 - q) + c * q
        bg[y, x, :3] = np.clip(col, 0, 255)

# Eiszapfen an der Gewölbedecke (Silhouetten mit heller Kante)
top = np.zeros(W2, int)
x = 0
while x < W2:
    w = rnd.choice((3, 4, 5, 6))
    ln = rnd.choice((4, 6, 8, 10, 13)) + (6 if abs(x - 62) > 34 else 0)
    for i in range(w):
        xx = x + i
        if xx >= W2: break
        t = abs(i - (w - 1) / 2) / (w / 2)
        top[xx] = int(ln * (1 - t) + 2)
    x += w
for x in range(W2):
    for y in range(0, top[x] + 3):
        bg[y, x, :3] = (8, 11, 28) if y < top[x] else (18, 26, 58)
    if 0 < top[x] < H2: bg[top[x] - 1, x, :3] = (46, 70, 128)       # Glanzkante

# Spiegeleis: Wand gespiegelt, abgedunkelt, mit waagerechten Schlieren
for y in range(HOR, H2):
    k = y - HOR
    sy = HOR - 1 - k
    for x in range(W2):
        c = bg[max(sy, 0), x, :3].astype(float) if sy >= 0 else NAVY
        fade = 0.55 - 0.012 * k
        col = NAVY * (1 - max(fade, 0.18)) + c * max(fade, 0.18)
        # glatte Bänder
        if (k + (x // 9) % 3) % 7 == 0 and k < 40: col = col * 1.18
        bg[y, x, :3] = np.clip(col, 0, 255)
# Horizontkante: dünner heller Saum (Schneerand am Wandfuß)
for x in range(W2):
    L = light(x, HOR)
    c = (150, 176, 226) if L > 0.18 else (86, 110, 170)
    bg[HOR, x, :3] = c
    bg[HOR - 1, x, :3] = (62, 88, 150) if (x % 4) else c

# ================================================================== Mittelgrund 3× (84×117)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
hx3, hy3 = 125 / 3, 78 / 3             # Herzmitte im 3×-Raster
CY1, CY2, CW = (156, 211, 255), (114, 192, 255), (231, 243, 255)
for y in range(H3):
    for x in range(W3):
        dx, dy = x + 0.5 - hx3, y + 0.5 - hy3
        d = math.hypot(dx, dy * 1.05)
        a = 0.0
        if d < 15: a = max(a, 0.55 * (1 - d / 15) ** 1.2)
        # vier weiche Strahlen (diagonal + senkrecht)
        ang = math.atan2(dy, dx)
        for base in (math.pi / 2, -math.pi / 2, math.pi / 4, 3 * math.pi / 4, -math.pi / 4, -3 * math.pi / 4):
            da = abs((ang - base + math.pi) % (2 * math.pi) - math.pi)
            wdt = 0.07 if base in (math.pi / 2, -math.pi / 2) else 0.05
            if da < wdt and 6 < d < 34: a = max(a, 0.28 * (1 - d / 34))
        if a <= 0: continue
        q = math.floor(a * 4 + BAY[y % 4, x % 4]) / 4
        if q <= 0: continue
        col = CY1 if d > 6 else CW
        mid[y, x, :3] = col
        mid[y, x, 3] = int(255 * min(q, 0.75))
# Herz selbst
hy0, hx0 = int(round(hy3 - 4)), int(round(hx3 - 5))
m = heart[..., 3] > 0
mid[hy0:hy0 + 8, hx0:hx0 + 10][m] = heart[m]

# ================================================================== Vordergrund 5× (51×71, Versatz −3 px)
W5, H5 = 51, 71
OX5 = -3
fg = np.zeros((H5, W5, 4), np.uint8)
BX, BY = 4, 29                        # Broghan links oben im 5×-Raster → x 17, y 145
FEET = BY + 30                        # Sprite-Zeile 29 = Fußsohle, Zeile 30 = Kettenenden am Boden

# Kettenverlängerung nach oben (Glieder im Muster der Figur: Seitenschienen, Einschnürung alle 4 Zeilen)
B_, C_, D_ = (89, 89, 89), (137, 137, 137), (160, 160, 160)
LINK = [  # 4 Zeilen, Spalten 0..3 (entspricht Sprite-Spalten 1..4 links oben)
    [None, B_, C_, None],
    [C_, None, None, D_],
    [C_, None, None, D_],
    [B_, None, None, C_],
]


def chain_up(col0, y_bottom, mirror=False):
    for k, y in enumerate(range(y_bottom, -1, -1)):
        row = LINK[k % 4]
        if mirror: row = row[::-1]
        for i, c in enumerate(row):
            if c is not None and 0 <= y < H5:
                fg[y, col0 + i, :3] = c; fg[y, col0 + i, 3] = 255


chain_up(BX + 1, BY + 0)             # links: über dem Querriegel (Sprite-Zeile 1) weiter nach oben
chain_up(BX + 38, BY - 1, mirror=True)   # rechts: über dem obersten Glied (Sprite-Zeile 0)

# Spiegelung im Eis (unter der Fußlinie, gespiegelt, blau abgedunkelt, halbdurchsichtig)
ref = broghan[:30][::-1]
for j in range(ref.shape[0]):
    y = FEET + j
    if y >= H5: break
    for i in range(ref.shape[1]):
        if ref[j, i, 3] == 0: continue
        c = np.array(ref[j, i, :3], float)
        c = c * 0.55 + np.array((30, 44, 96)) * 0.45
        a = 0.62 - 0.05 * j
        if a <= 0.1: continue
        fg[y, BX + i, :3] = c.astype(np.uint8)
        fg[y, BX + i, 3] = int(255 * a)

# Figur
m = broghan[..., 3] > 0
fg[BY:BY + 31, BX:BX + 43][m] = broghan[m]

# ================================================================== zusammensetzen (250×350)
cv = Canvas(250, 350)
comp(cv, bg, 2)
comp(cv, mid, 3, 0, 0)
comp(cv, fg, 5, OX5, 0)
save(cv, '02_glacier_vault.png')
print('ok')
