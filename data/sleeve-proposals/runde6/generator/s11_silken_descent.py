# -*- coding: utf-8 -*-
"""11 Silken Descent – Gegner „Creepy Crawlies“ (Structure Deck Creepy Crawlies), Held: Alleria, the Queen of Spiders.

Bildidee: Tief unten im Spinnenbau (Spider Hive). Von oben fällt ein schmaler Lichtstrahl herein;
an ihrem eigenen Faden lässt sich Alleria (Base, eine Hand am Faden wie auf ihrer Karte) lautlos in den Lichtkegel
hinab. Ringsum in der Erdwand lauern ihre Spinnen: aus den Löchern glühen rote Augenpaare, kleine Spinnen klettern
die Wand hinauf, rechts hängt eine Crimson Skull Spider an ihrem roten Faden, am Boden krabbeln Spinnen ins Licht.
Bewusst ohne Spinnennetz (ausgereizter Motivtyp, s. „Spider Nest“).

Quellen:
  MotiveGrailWar.xcf  Ebene 622 „Alleria-Kopie“ – Base-Alleria (Szene „Sichtbar #56“ = Ebene 63, Lage 284,118; diese
                      Ebene zeigt wie die Karte die linke Hand am Faden; 624 „Alleria“ weicht ab, 619 = Octopus-Variante).
                      Nur die Figur (Teil 29×35), die Netze der Ebene weggelassen.
  MotiveGrailWar.xcf  Ebene 621 „Ebene #79“ – ihr Faden (Spalte x 312, hell/dunkel abwechselnd) → nach oben verlängert.
  MotiveGN.xcf        Ebene 259 „Ebene #178“ – Crimson Skull Spider an rotem Faden (Karte Crimson Skull Spider).
  MotiveGN.xcf        Ebene 267 „SPODDERS“ – Spinnen der Creepy-Crawlies-Karten (Spider Hive u. a.): krabbelnde
                      Spinnen, kletternde Spinnen, Spinnen im Erdloch (Kuppel mit roten Augen).
  MotiveGN.xcf        Ebene 421 „Klippen“ – Erdwand-/Bodentextur der Spinnenhöhlen-Karten.
Selbst gezeichnet: Dunkelheit, Lichtkegel von oben, Lichtfleck, Schatten am Boden, Fadenverlängerungen (Allerias Faden
reicht bis zum oberen Bildrand und endet direkt an ihrer Hand).

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): Erdwand, Lichtkegel, Spinnen in Löchern/an der Wand, Boden mit Spinnen und Schatten
  Mittelgrund 3× (84×117):  Crimson Skull Spider mit rotem Faden
  Vordergrund 5× (50×70):   Alleria mit ihrem Faden (1 Rasterpixel breit, hell/dunkel)
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(11)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0

# ------------------------------------------------------------------ Sprites
all_parts = parts(layer('MotiveGrailWar', 622)[110:175, 290:360], dil=0)
alleria = [p for p in all_parts if p.shape[:2] == (29, 35)][0]          # Figur ohne Netze
thr_src = layer('MotiveGrailWar', 621)[:, 312]                          # Fadenspalte
THR = [tuple(c[:3]) for c in thr_src if c[3] > 0][:2]                   # zwei Fadenfarben (hell/dunkel)
crimson = sprite('o11_crimson', 'MotiveGN', [259])                       # 37×19 inkl. rotem Faden
spod = parts(sprite('o11_spod', 'MotiveGN', [267]), dil=0)
crawl = [p for p in spod if p.shape[:2] == (8, 12)]
climb = [p for p in spod if p.shape[:2] in ((10, 6), (9, 6), (12, 8))]
domes = [p for p in spod if p.shape[:2] in ((5, 10), (5, 8))]
klip = layer('MotiveGN', 421)
WALL = klip[228 + 170:228 + 230, 70 + 90:70 + 200, :3].astype(float)     # dichte Felswand mit Ranken
DIRT = klip[228 + 128:228 + 146, 70 + 200:70 + 260, :3].astype(float)    # heller Erdweg


def tex(src, h, w, ox=0, oy=0):
    sh, sw = src.shape[:2]
    ys = np.arange(h) + oy; xs = np.arange(w) + ox
    yy = np.where((ys // sh) % 2 == 0, ys % sh, sh - 1 - ys % sh)
    xx = np.where((xs // sw) % 2 == 0, xs % sw, sw - 1 - xs % sw)
    return src[yy][:, xx]


def put(dst, s, x, y, f=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = np.clip(s[j, i, :3].astype(float) * f, 0, 255); dst[yy, xx, 3] = 255


# ================================================================== Geometrie
AX5, AY5 = 9, 14                  # Alleria (Teil) im 5×-Raster → Canvas x 45, y 70
HAND_X5 = AX5 + 7                 # Fadenspalte im 5×-Raster (Canvas x 80–85)
HOLE_X = (HAND_X5 * 5 + 2.5) / 2  # Deckenloch-Mitte im 2×-Raster
FLOOR = 141                       # Boden (2×-Raster, Canvas y 282)
HOLE_Y = 0                        # Licht fällt von oben (über dem Bildrand) herein

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
wall = tex(WALL, H2, W2, 3, 0)
dirt = tex(DIRT, H2, W2)
DARK = np.array((10, 6, 4))
LIGHT = np.array((255, 236, 170))


def cone(x, y):
    """Lichtstärke im Kegel vom Deckenloch zum Lichtfleck auf dem Boden (leicht schräg)."""
    if y < HOLE_Y: return 0.0
    t = (y - HOLE_Y) / (FLOOR - HOLE_Y)
    cx = HOLE_X + (64 - HOLE_X) * t            # Kegelachse wandert zur Bildmitte
    half = 6 + 24 * t
    d = abs(x + 0.5 - cx) / half
    if d >= 1: return 0.0
    return (1 - d ** 2) * (0.75 - 0.25 * t)


for y in range(H2):
    for x in range(W2):
        if y < FLOOR:
            base = wall[y, x]
            amb = 0.20 + 0.10 * (1 - abs(x + 0.5 - W2 / 2) / (W2 / 2))
        else:
            base = dirt[y, x] * 0.8
            amb = 0.22
        L = cone(x, y)
        if y >= FLOOR:                                   # Lichtfleck auf dem Boden
            d = math.hypot((x + 0.5 - 64) / 30, (y + 0.5 - (FLOOR + 12)) / 9)
            L = max(L, 0.6 * max(0, 1 - d) ** 0.7)
        f = amb + L
        q = math.floor(f * 6 + BAY[y % 4, x % 4] - 0.5) / 6
        q = max(q, 0.12)
        col = DARK * (1 - q) + base * q
        if L > 0.05: col = col + LIGHT * 0.12 * L
        bg[y, x, :3] = np.clip(col, 0, 255)
# Bodenkante (Übergang Wand → Boden)
for x in range(W2):
    bg[FLOOR, x, :3] = (bg[FLOOR, x, :3] * 0.5).astype(np.uint8)

# Schatten Allerias und der Crimson Skull Spider im Lichtfleck auf dem Boden
for (cx, cy, rx, ry) in [(66, FLOOR + 13, 17, 3.2), (100, FLOOR + 9, 6, 1.6)]:
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if 0 <= x < W2 and 0 <= y < H2 and ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1:
                bg[y, x, :3] = (bg[y, x, :3] * 0.45).astype(np.uint8)
# Spinnen in Erdlöchern (Kuppel mit roten Augen) links und rechts an der Wand, im Dunkeln
for (x, y, k) in [(12, 40, 0), (22, 70, 1), (12, 100, 0), (26, 124, 1), (100, 34, 1), (108, 62, 0),
                  (96, 88, 0), (110, 116, 1), (84, 128, 0)]:
    d = domes[k % len(domes)]
    for j in range(d.shape[0]):                        # Lochrand: dunkle Mulde unter der Kuppel
        pass
    hx0 = x - 1; hy0 = y + d.shape[0] - 2
    for i in range(d.shape[1] + 2):
        if 0 <= hx0 + i < W2: bg[hy0, hx0 + i, :3] = (4, 3, 2); bg[hy0 + 1, hx0 + i, :3] = (26, 16, 10)
    put(bg, d, x, y)
# kletternde Spinnen an der Wand
for (x, y, k) in [(34, 30, 0), (90, 52, 1), (18, 88, 2), (104, 110, 0)]:
    c = climb[k % len(climb)]
    put(bg, c, x, y, 0.9)
# krabbelnde Spinnen am Boden, auf den Lichtfleck zu
for (x, y, fl) in [(26, 146, False), (90, 147, True), (40, 155, False), (76, 157, True), (58, 160, False)]:
    c = crawl[(x // 7) % len(crawl)]
    c = flip(c) if fl else c
    for i in range(c.shape[1] - 2):                    # Schatten
        xx, yy = x + 1 + i, y + c.shape[0]
        if 0 <= xx < W2 and yy < H2: bg[yy, xx, :3] = (bg[yy, xx, :3] * 0.55).astype(np.uint8)
    put(bg, c, x, y)

# ================================================================== Mittelgrund 3× (84×117)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
cx3, cy3 = 56, 52                                     # Crimson Skull Spider rechts, Faden nach oben verlängert
put(mid, crimson, cx3, cy3)
tcol = [c for c in crimson[:, :, :] .reshape(-1, 4) if c[3] > 0]
col_thread = crimson[0][crimson[0, :, 3] > 0][0][:3]
tx = cx3 + int(np.nonzero(crimson[0, :, 3])[0][0])
for y in range(0, cy3):
    mid[y, tx, :3] = col_thread if y % 2 else np.clip(col_thread.astype(int) * 0.6, 0, 255)
    mid[y, tx, 3] = 255

# ================================================================== Vordergrund 5× (50×70)
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
# Faden von der Decke bis zur Hand (1 Rasterpixel, hell/dunkel abwechselnd wie im Original)
light_c, dark_c = (225, 225, 225), (160, 160, 160)
put(fg, alleria, AX5, AY5)
for y in range(0, AY5 + 9):                  # vom oberen Bildrand bis an die Hand (Handpixel Zeile AY5+9)
    fg[y, HAND_X5, :3] = light_c if y % 2 == 0 else dark_c; fg[y, HAND_X5, 3] = 255

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(mid, 3), -2, 0)
cv.paste(up(fg, 5), 0, 0)
vignette(cv, 0.4, 0.6)
save(cv, '11_silken_descent.png')
print('ok')
