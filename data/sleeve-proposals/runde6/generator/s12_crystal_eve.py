# -*- coding: utf-8 -*-
"""12 Crystal Eve – Gegner „Crystal Gifts“ (Structure Deck Crystal Gifts), Held: Mary Crestmas.

Bildidee: Heiliger Abend auf dem verschneiten Dorfplatz ihres Weihnachtsdorfs. Mary Crestmas steht vorn im Schnee,
hinter ihr leuchtet der Crystal Well (Cover-Karte), dessen bunter Edelsteinkranz wie ein Kranz aus Geschenken und
Lichtern funkelt; über dem Platz hängt eine Lichterkette, es schneit. Ihre „Geschenke“ sind Kristalle – sie
schenkt dem Gegner Karten und zieht selbst nach.

Quellen:
  MotiveBoons.xcf  Ebene 71 „Ebene #6“ – flache Weihnachtsdorf-Szene (Mary-Karte: Mary auf der Bühne vor rotem Vorhang).
                   Base-Mary = Bühnenfigur (weißer Schleier mit grünlichem Glanz, OHNE rote Mütze; die rot bemützte
                   Mary auf dem Platz ist eine andere Fassung), Ausschnitt x 115–140, y 243–267, vom Vorhang freigestellt
                   (Zeilen 2–18 Spanne zwischen den Schleierkanten, darunter nur Nicht-Vorhang-Pixel). Kein eigener
                   Ebenen-Sprite vorhanden. Außerdem die Schnee-Textur des Platzes.
  MotiveBritain.xcf Ebene 16 „Ebene #210“ – Crystal Well (Karte Crystal Well, Szene Sichtbar #47 = Ebene 14,
                   Lage 190,437); Ebene 15 „Ebene #211“ – dessen Funkeln.
Selbst gezeichnet: Nachttönung, Lichtschein des Brunnens, Lichterkette, Schneeflocken, Schatten.

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): Schneeplatz (nachtblau getönt), Lichterkette, Schneeflocken, Lichtschein
  Mittelgrund 3× (84×117):  Crystal Well mit Funkeln
  Vordergrund 5× (50×70):   Mary Crestmas mit Schatten
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(12)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0

# ------------------------------------------------------------------ Sprites
L71 = layer('MotiveBoons', 71)


def mary_sprite(L):
    x0, y0, x1, y1 = 115, 243, 140, 267
    sub = L[y0:y1, x0:x1, :3].astype(int)
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
    curtain = (r > g + 50) & (r > b + 50) & (g < 120)
    m = np.zeros(curtain.shape, bool)
    for y in range(sub.shape[0]):
        if y == 0:                                   # Kappe des Schleiers: nur die hellgrünen Glanzpixel
            m[y] = (g[y] > 180) & (b[y] < 140); continue
        if y == 1:                                   # Schleierbogen: nur helle Pixel (Lichterkette ausgeschlossen)
            m[y] = sub[y].min(-1) > 125; continue
        xs = [x for x in range(0, 25) if not curtain[y, x]]
        if not xs: continue
        if y <= 18: m[y, min(xs):max(xs) + 1] = True
        else: m[y, xs] = True
    out = np.zeros(sub.shape[:2] + (4,), np.uint8)
    out[..., :3] = sub; out[..., 3] = m * 255
    ys, xs = np.nonzero(m)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


mary = mary_sprite(L71)                                   # 24×24
import os
from PIL import Image
Image.fromarray(mary).save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sprites6', 'o12_mary.png'))
well = sprite('o12_well16', 'MotiveBritain', [16])        # Brunnen ohne Funkeln
sparkle_layer = compose('MotiveBritain', [15], crop=False)
wb = bbox(compose('MotiveBritain', [16], crop=False))
sparks = sparkle_layer[wb[1] - 6:wb[3] + 6, wb[0] - 6:wb[2] + 6]      # Funkeln in Brunnen-Koordinaten (+6)
SNOW = L71[357:397, 165:213, :3].astype(float)       # reine Schneefläche des Platzes


def put(dst, s, x, y, f=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = np.clip(s[j, i, :3].astype(float) * f, 0, 255); dst[yy, xx, 3] = 255


def tex(src, h, w):
    sh, sw = src.shape[:2]
    ys, xs = np.arange(h), np.arange(w)
    yy = np.where((ys // sh) % 2 == 0, ys % sh, sh - 1 - ys % sh)
    xx = np.where((xs // sw) % 2 == 0, xs % sw, sw - 1 - xs % sw)
    return src[yy][:, xx]


# ================================================================== Geometrie
WX3, WY3 = 42 - well.shape[1] // 2, 29                    # Brunnen im 3×-Raster (Canvas y 87)
WCX, WCY = 125, (WY3 + 17) * 3                            # Wassermitte (Canvas)
MX5, MFEET5 = 25 - mary.shape[1] // 2, 63                 # Mary im 5×-Raster (Füße Canvas y 315)

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
snow = tex(SNOW, H2, W2)
NIGHT = np.array((22, 30, 70))
GLOW = np.array((120, 235, 235))
HOR = 36                                                  # Horizont (Canvas y 72)
SKY_T, SKY_B = np.array((8, 10, 30)), np.array((34, 44, 92))
HILL = np.array((70, 84, 130))
for y in range(H2):
    for x in range(W2):
        if y < HOR:
            t = y / HOR
            c = SKY_T * (1 - t) + SKY_B * t
        else:
            t = (y - HOR) / (H2 - HOR)
            f = 0.30 + 0.30 * t                             # Platz nach vorn heller
            c = snow[y, x] * f + NIGHT * (1 - f) * 0.9
        d = math.hypot((x + 0.5) * 2 - WCX, ((y + 0.5) * 2 - WCY) * 1.4)
        L = max(0, 1 - d / 105) ** 0.9 if y >= HOR else 0  # Lichtschein des Kristallbrunnens auf dem Schnee
        q = math.floor(L * 5 + BAY[y % 4, x % 4]) / 5
        c = c + (GLOW - c) * 0.55 * q
        bg[y, x, :3] = np.clip(c, 0, 255)
# Sterne
for _ in range(22):
    x, y = rnd.randrange(0, W2), rnd.randrange(0, HOR - 10)
    bg[y, x, :3] = (200, 210, 255)
# ferne verschneite Hügel mit den warmen Fensterlichtern des Dorfes
for x in range(W2):
    top = int(HOR - 5 - 3 * math.sin(x * 0.11 + 1) - 2 * math.sin(x * 0.31))
    for y in range(top, HOR + 1):
        bg[y, x, :3] = HILL * (0.8 if y > top else 1.1)
for (x, y) in [(8, HOR - 2), (14, HOR - 3), (15, HOR - 1), (31, HOR - 2), (47, HOR - 4), (48, HOR - 2), (77, HOR - 3),
               (92, HOR - 1), (93, HOR - 3), (109, HOR - 2), (118, HOR - 4)]:
    bg[y, x, :3] = (255, 206, 110)
for x in range(W2):
    bg[HOR + 1, x, :3] = (bg[HOR + 1, x, :3] * 0.7).astype(np.uint8)
# Lichterkette: zwei durchhängende Bögen über dem Platz, Birnchen in den Farben der Dorf-Lichterketten
BULBS = [(230, 40, 40), (40, 190, 60), (60, 110, 230), (240, 200, 40), (200, 60, 200)]
for (xa, xb, ya, sag) in [(-2, 64, 11, 10), (61, 127, 11, 10)]:
    k = 0
    for x in range(xa, xb + 1):
        t = (x - xa) / (xb - xa)
        y = int(round(ya + sag * 4 * t * (1 - t)))
        if 0 <= x < W2:
            bg[y, x, :3] = (20, 20, 28)
            if (x - xa) % 6 == 3:
                bg[y + 1, x, :3] = BULBS[k % 5]; k += 1
                bg[y + 2, x, :3] = np.clip(np.array(BULBS[(k - 1) % 5]) * 0.6, 0, 255)
# Schneeflocken
for _ in range(46):
    x, y = rnd.randrange(0, W2), rnd.randrange(0, H2)
    bg[y, x, :3] = (236, 240, 255)

# ================================================================== Mittelgrund 3× (84×117)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
# Schatten des Brunnens im Schnee
for i in range(-24, 25):
    for dy in (0, 1):
        x, y = 42 + i, WY3 + well.shape[0] - 1 + dy
        if abs(i) < 24 - dy * 3:
            mid[y, x, :3] = (26, 34, 70); mid[y, x, 3] = 120
put(mid, well, WX3, WY3)
sm = sparks[..., 3] > 0
for (j, i) in zip(*np.nonzero(sm)):
    y, x = WY3 - 6 + j, WX3 - 6 + i
    if 0 <= y < H3 and 0 <= x < W3:
        mid[y, x, :3] = sparks[j, i, :3]; mid[y, x, 3] = 255

# ================================================================== Vordergrund 5× (50×70)
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
for i in range(-9, 10):
    fg[MFEET5 + 1, 25 + i, :3] = (26, 34, 70); fg[MFEET5 + 1, 25 + i, 3] = 140
put(fg, mary, MX5, MFEET5 + 1 - mary.shape[0])

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(mid, 3), -1, 0)
cv.paste(up(fg, 5), 0, 0)
save(cv, '12_crystal_eve.png')
print('ok')
