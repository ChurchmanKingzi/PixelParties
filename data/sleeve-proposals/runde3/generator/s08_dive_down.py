# -*- coding: utf-8 -*-
"""08 Dive Down – Abstieg ins Blau: der Taucher sinkt mit aufsteigender Blasenspur durch schräge Lichtbahnen
hinab zur Schatztruhe, die auf dem Meeresgrund golden glänzt. Ganz hinten im Dunst die Silhouette der
versunkenen Deepsea-Burg und Seegras; kleine Fische ziehen vorbei. (Kein Mond/Himmel mehr – reine Tiefe.)

Quellen (MotiveDeepsea.xcf):
  Ebene 207 „Dive Down“ – Taucher (Karte „Dive Down“, geprüft gegen „Sichtbar #41“), 4×
  Ebene 196 „Deepsea Treasure“ – Schatztruhe mit Goldmünzen (Karte „Deepsea Treasure“, „Sichtbar #50“), 4×
    Ebene 375 „Siphem #3“ – Deepsea-Burg (Karte „Siphem“), 2×, als blaue Dunst-Silhouette
  Ebene 388 „Ebene #14“ – Seegras, 2× (hinten, Silhouette) und 4× (vorne, neben der Truhe)
  Ebene 85  „Ebene #199“ – kleine blaue Fische (Karte „Greatmaw Shark“), 4×
  Wasserfarben: Ebene 391 „Hintergrund“; Meeresgrund und Luftblasen selbst gezeichnet im 4×-Raster.
Skalierung: Hintergrund (Wasser-Verlauf, Lichtbahnen, Burg, hinteres Seegras) 2×; Taucher, Truhe, Blasen,
  Fische, vorderes Seegras und Grund 4×.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
cv = Canvas(W, H)
F = 4

# =============== Hintergrund im 2×-Raster ===============
NW, NH = 125, 175
bg = Canvas(NW, NH)
vgrad(bg, [(0, (47, 101, 159)), (0.3, (22, 65, 125)), (0.62, (18, 44, 100)), (0.85, (10, 26, 64)), (1, (6, 14, 38))])
# schräge Lichtbahnen von der (unsichtbaren) Oberfläche
for y in range(NH):
    for x in range(NW):
        for x0, wd in ((30, 5), (62, 3.5), (96, 6)):
            u = x - (x0 - 0.3 * y)
            t = max(0, 1 - abs(u) / wd) * max(0, 1 - y / 120) * 0.7
            if t > BAYER4[y % 4, x % 4]:
                c = bg.a[y, x].astype(int)
                bg.a[y, x] = np.clip(c + (26, 36, 42), 0, 255)
# ferne Burg auf dem Grund (Dunst-Silhouette)
castle = sprite('b08_ds375', D, [375])
c1 = lum_tint(castle, (12, 26, 62), (30, 56, 104))
red = (castle[..., 0] > 150) & (castle[..., 1] < 90)
c1[red, :3] = (70, 60, 110)                      # Fenster nur schwach
GYN = 146                                          # ferner Grund (native)
bg.paste(c1, 72, GYN - castle.shape[0] + 2)
# ferner Grund
for x in range(NW):
    yy = GYN + int(2 * math.sin(x / 9.0) + 1.5 * math.sin(x / 4.3))
    bg.a[yy:, x] = (14, 30, 66)
    bg.a[yy, x] = (24, 46, 88)
# hinteres Seegras
weed = sprite('b08_ds388', D, [388])
wp = [p for p in parts(weed, dil=1) if p.shape[0] >= 8]
for p, x in zip(wp, (8, 30, 52, 110, 118)):
    pb(bg, lum_tint(p, (10, 22, 56), (26, 48, 92)), x, GYN + 4)
cv.a[:] = up(np.dstack([bg.a, np.full((NH, NW), 255, np.uint8)]), 2)[:H, :W, :3]

# =============== Vordergrund 4× ===============
# Meeresgrund (4×-Raster, drei Töne, harte Stufen)
GY = 300
SAND = [(22, 52, 78), (36, 78, 104), (58, 110, 132)]
for x in range(0, W, F):
    i = x // F
    top = GY + F * int(round(2.2 * math.sin(i / 5.0) + 1.2 * math.sin(i / 2.3)))
    cv.a[top:, x:x + F] = SAND[0]
    cv.a[top:top + F, x:x + F] = SAND[2]
    cv.a[top + F:top + 2 * F, x:x + F] = SAND[1]
    if i % 5 == 2: cv.a[top + 4 * F:top + 5 * F, x:x + F] = SAND[1]
    if i % 7 == 4: cv.a[top + 7 * F:top + 8 * F, x:x + F] = SAND[1]

# Goldschein um die Truhe (hart abgestufte Ellipsen im 4×-Raster)
for (ry, rx, add) in ((22, 31, (18, 22, 12)), (16, 25, (26, 26, 8)), (11, 19, (36, 32, 4))):
    for y in range(120, H, F):
        for x in range(0, W, F):
            if ((x + 2 - 125) / (rx * F)) ** 2 + ((y + 2 - (GY - 10)) / (ry * F)) ** 2 < 1:
                c = cv.a[y:y + F, x:x + F].astype(int) + np.array(add)
                cv.a[y:y + F, x:x + F] = c.clip(0, 255).astype(np.uint8)

# vorderes Seegras neben der Truhe
for p, x, fl in ((wp[1], 18, False), (wp[3], 232, True), (wp[0], 44, True)):
    q = lum_tint(p, (14, 40, 70), (40, 110, 130))
    pb(cv, up(flip(q) if fl else q, F), x, GY + 14)

chest = sprite('b08_ds196', D, [196])
C4 = up(chest, F)
pb(cv, C4, 125, GY + 26)

# Fische (4×) ziehen links vorbei
fish = parts(sprite('b08_ds85', D, [85]), dil=1)
cv.paste(up(fish[0], F), 10, 166)
cv.paste(up(flip(fish[-1]), F), 196, 60)

# Taucher + Blasenspur
# Blasen selbst gezeichnet im 4×-Raster (Farben der Blasen aus „Dive Down“, aufgehellt)
BUB = [None,
       np.array([[1]]),
       np.array([[0, 1, 0], [1, 2, 1], [0, 1, 0]]),
       np.array([[0, 1, 1, 0], [1, 3, 2, 1], [1, 2, 2, 1], [0, 1, 1, 0]])]
BC = {1: (110, 160, 215, 255), 2: (40, 80, 150, 255), 3: (210, 235, 250, 255)}
def bubble(n):
    m = BUB[n]; s_ = np.zeros(m.shape + (4,), np.uint8)
    for v, c in BC.items(): s_[m == v] = c
    if n == 1: s_[m == 1] = (170, 210, 240, 255)
    return s_
bp = [bubble(n) for n in (1, 2, 1, 3, 1, 2)]
diver = sprite('b08_ds207', D, [207])
DV = up(diver, F)
dx, dy = 125 - DV.shape[1] // 2 + 8, 56
rng = np.random.RandomState(11)
by = dy - 6
k = 0
while by > -12:
    x = dx + DV.shape[1] - 26 + int(5 * math.sin(by / 13.0)) // F * F
    b = bp[k % len(bp)]; k += 1
    cv.paste(up(b, F), x, by)
    by -= F * rng.randint(4, 7)
cv.paste(DV, dx, dy)

vignette_grid(cv, 0.5, 0.58, 2)
print(save(cv, '08_dive_down.png'))
