# -*- coding: utf-8 -*-
"""11 Fire & Storm – geteiltes Plakat: links stürzt ein Lavafall mit Feuersäulen (Luna die Flammenfee),
rechts ein Wasserfall im Gewitterregen mit Blitzen (Tempeste die Wetterfee). Wo sich beide Hälften treffen,
schwebt ihre verschmolzene Gestalt Tempeluna.

Quellen (MotiveHawaii.xcf):
  Ebene 147 „Luna“ (Karte „Luna the Flame Fairy“), 5×;  Ebene 150 „Tempeste“ (Karte „Tempeste the Weather
  Fairy“), 5×, gespiegelt;  Ebene 90 „Tempeluna“ (Karte „Tempeluna the Convergence Fairy“), 6×
  Ebene 265 „Ebene #92“ – Lavafall-Kachel 16×16 (2×);  Ebene 264 „Ebene #90“ – Wasserfall-Kachel 16×16 (2×)
  Ebene 260 „Ebene #18“ – Feuersäulen/Flämmchen (Luna-Szene), 2×
  Ebene 149 „Ebene #46“ – Blitze (Tempeste-Szene), 2×;  Ebene 176 „Ebene #101“ – Regen, 1×
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
HW = 'MotiveHawaii'
cv = Canvas(W, H)

lava = sprite('b11_hw265', HW, [265])[0:16, 0:16]
wat = sprite('b11_hw264', HW, [264])[0:16, 0:16]
LV = np.repeat(np.repeat(tile_rgb(lava, W, H), 2, 0), 2, 1)[:H, :W]
WT = np.repeat(np.repeat(tile_rgb(wat, W, H, oy=5), 2, 0), 2, 1)[:H, :W]


# Zickzack-Naht (wie ein Blitz) etwas links/rechts der Mitte
def seam(y):
    k = (y // 22) % 2
    f = (y % 22) / 22
    return 125 + int((-9 + 18 * f) if k == 0 else (9 - 18 * f))


for y in range(H):
    s = seam(y)
    cv.a[y, :s] = LV[y, :s]
    cv.a[y, s:] = WT[y, s:]
# Wasserseite abdunkeln (Gewitter), Lavaseite leicht aufhellen lassen wie sie ist
for y in range(H):
    s = seam(y)
    cv.a[y, s:] = (cv.a[y, s:] * 0.55).astype(np.uint8)
    cv.a[y, :s] = (cv.a[y, :s] * np.array([0.82, 0.66, 0.6])).astype(np.uint8)

# Regen nur rechts
rain = sprite('b11_hw176', HW, [176])
rn = Canvas(W, H); rn.a[:] = cv.a
rn.paste(rain, W // 2 - 20, 0); rn.paste(rain, W // 2 - 60, 170)
for y in range(H):
    s = seam(y) + 2
    cv.a[y, s:] = rn.a[y, s:]

# Feuersäulen links
fl = parts(sprite('b11_hw260', HW, [260]), dil=0)
tall = [p for p in fl if p.shape[0] >= 70]
small = [p for p in fl if p.shape[0] < 30]
cv.paste(up(tall[0], 2), -6, 188)
cv.paste(up(tall[2], 2), 58, 214)
cv.paste(up(small[0], 2), 20, 146)
cv.paste(up(small[1], 2), 84, 186)

# Blitze rechts
bolts = parts(sprite('b11_hw149', HW, [149]), dil=1)
cv.paste(up(bolts[0], 2), 176, 168)
cv.paste(up(flip(bolts[1]), 2), 190, 282)

# Nahtlinie (glühend links, hell rechts)
for y in range(H):
    s = seam(y)
    cv.a[y, s - 1] = (255, 236, 150)
    cv.a[y, s] = (255, 255, 230)
    cv.a[y, s + 1] = (160, 230, 255)

# Feen
luna = sprite('b11_hw147', HW, [147])
temp = sprite('b11_hw150', HW, [150])
L5 = up(luna, 5); T5 = up(flip(temp), 5)
cv.paste(L5, 10, 24)
cv.paste(T5, W - 10 - T5.shape[1], 30)

# Tempeluna an der Naht, unten
tl = sprite('b11_hw90', HW, [90])
T6 = up(tl, 6)
pb(cv, T6, 125, H - 12)

vignette(cv, 0.5, 0.6)
print(save(cv, '11_fire_and_storm.png'))
