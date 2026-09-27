# -*- coding: utf-8 -*-
"""13 Count of the Deep – Porträt-Plakat: Teppes, der Deepsea-Vampir, breitet vor seinem blutroten Schloss
auf dem Meeresgrund den Umhang aus; zwei Fledermäuse flankieren ihn, weitere umkreisen die Türme, tote
Tiefsee-Bäume rahmen das Bild.

Quellen (MotiveDeepsea.xcf):
  Ebene 335 „TEPPES“ – Vampir (Karte „Teppes the Deepsea Vampire“), 5×
  Ebene 336 „Teppes“ – die zwei Fledermäuse neben ihm (gleiche Karte), 3×
  Ebene 346 „Bats“ – Fledermäuse (Karte „Deepsea Bats“), 2×
  Ebene 75 „Blood Rock“ – rotes Schloss, 1× (in der Ferne)
  Ebene 74 „Ebene #207“ – tote Bäume, 4×, als Silhouetten
  Ebene 77 „Ebene #206“ – rote Erde + Pflasterweg (Kacheln), 2×
  Ebene 341 „Ebene #150“ – Blasen;  Farben: Deepsea-Meer (Ebene 391)
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
cv = Canvas(W, H)

vgrad(cv, [(0, (6, 12, 34)), (0.5, (18, 36, 84)), (1, (10, 16, 40))])
# rötlicher Schein hinter dem Schloss
radial(cv, 125, 150, 150, (54, 26, 60), 0.8, power=0.8)
radial(cv, 125, 150, 100, (96, 34, 60), 0.6, power=1.0)

# Schloss (ganz, 1×, in der Ferne)
castle = sprite('b13_ds75', D, [75])
cx0, cy0 = 125 - castle.shape[1] // 2, 52
GY = cy0 + castle.shape[0] - 4
# Grund: rote Erde + Pflasterweg aus der Blood-Rock-Karte
soil = sprite('b13_ds77_soil', D, [77], box=(152, 255, 168, 271))
path = sprite('b13_ds77_path', D, [77], box=(104, 200, 120, 216))
gt = np.repeat(np.repeat(tile_rgb(soil, W // 2 + 1, (H - GY) // 2 + 1), 2, 0), 2, 1)[:H - GY, :W]
pt = np.repeat(np.repeat(tile_rgb(path, W // 2 + 1, (H - GY) // 2 + 1), 2, 0), 2, 1)[:H - GY, :W]
for j in range(H - GY):
    hw = 9 + j * 0.62                                  # Weg wird nach vorne breiter
    for x in range(W):
        cv.a[GY + j, x] = pt[j, x] if abs(x + .5 - 125) < hw else gt[j, x]
    f = 0.75 - 0.35 * j / (H - GY)
    cv.a[GY + j] = (cv.a[GY + j] * f).astype(np.uint8)
for j in range(H - GY):                              # Wegränder
    hw = int(9 + j * 0.62)
    for x in (125 - hw, 125 + hw):
        if 0 <= x < W: cv.a[GY + j, x] = (70, 60, 72)
cv.paste(castle, cx0, cy0)
cv.a[GY] = np.maximum(cv.a[GY], (0, 0, 0))

# Fledermäuse um die Türme
bats = [p for p in parts(sprite('b13_ds346', D, [346]), dil=0) if p.shape[0] > 6]
for (x, y), b in zip([(30, 30), (196, 20), (156, 64), (70, 70)], bats):
    cv.paste(up(b, 2), x, y)

# tote Bäume als Rahmen (Silhouetten)
trees = parts(sprite('b13_ds74', D, [74]), dil=1)
T4 = up(lum_tint(trees[0], (4, 6, 18), (40, 44, 70)), 4)
cv.paste(T4, -14, H - T4.shape[0] + 6)
cv.paste(flip(T4), W - T4.shape[1] + 14, H - T4.shape[0] + 6)

# Teppes
tep = [p for p in parts(sprite('b13_ds335', D, [335]), dil=1) if p.shape[:2] == (23, 24)][0]
T6 = up(tep, 5)
# Schlagschatten auf dem Weg
for y in range(H - 20, H - 6):
    for x in range(40, 210):
        d = ((x - 125) / 80) ** 2 + ((y - (H - 13)) / 7) ** 2
        if d < 1 and 0.7 > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (cv.a[y, x] * 0.4).astype(np.uint8)
pb(cv, T6, 125, H - 10)
# flankierende Fledermäuse (aus der Teppes-Karte)
fb = parts(sprite('b13_ds336', D, [336]), dil=1)
cv.paste(up(fb[0], 3), 30, 222)
cv.paste(up(flip(fb[0]), 3), W - 30 - fb[0].shape[1] * 3, 222)

# Blasen
bub = parts(sprite('b13_ds341', D, [341]), dil=0, minpx=1)
for (x, y), b in zip([(28, 120), (222, 110), (70, 16), (178, 40), (12, 70), (236, 160)], bub * 3):
    cv.paste(up(b, 2), x, y)

vignette(cv, 0.55, 0.55)
print(save(cv, '13_count_of_the_deep.png'))
