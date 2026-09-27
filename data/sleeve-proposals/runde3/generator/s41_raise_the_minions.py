# -*- coding: utf-8 -*-
"""Sleeve 41 – „Raise the Minions“ (Runde 3b, ersetzt das Konzert-Motiv „Graveyard Gig“): Wir stehen hinter dem
Totenbeschwörer aus „Raise the Minions“ (Rückenansicht, roter Umhang, Spitzohren). Vor ihm auf dem Friedhof
steigen seine drei Skelett-Diener zwischen den Grabsteinen aus der aufgebrochenen Erde, grünes Beschwörungslicht
quillt aus den Gräbern.

Skalierung: Beschwörer 5× (Vordergrund); Skelette, Grabsteine, Erdhügel, Grablicht 3× (Mittelgrund, eine Ebene);
ferner Hügel/Bäume als Silhouette im 3×-Raster; Himmel Dither-Verlauf.

Vollständigkeit (Regel B): Kartenszene „Sichtbar #54“ [755] enthält genau die Ebenen 756 (Beschwörer) und 757
(die drei Skelette) – beide pixelgleich (match 1.0), nichts fehlt.

Quellen (Motive.xcf): 756 „Raise the Minions“, 757 „Ebene #375“ (Skelette), 1229 „Ebene #711“ (Grabsteine,
Kreuze), 770 „Ebene #368“ (Grabsteine), 75 „Skele Archer #2“ (großer Grabstein).
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
cv = Canvas(W2, H2)
rng = np.random.RandomState(11)

# ---------------------------------------------------------------- Himmel + Horizont
HOR = 128
c0, c1 = np.array((6, 8, 18)), np.array((26, 44, 52))
for y in range(HOR):
    t = y / HOR
    for x in range(W2):
        lv = math.floor(t * 5 + BAYER4[y % 4, x % 4]) / 5
        cv.a[y, x] = (c0 * (1 - lv) + c1 * lv).astype(np.uint8)
for i in range(25):                                         # Sterne (1 px, wie in 13/34)
    cv.px(rng.randint(0, W2), rng.randint(0, HOR - 40), (150, 170, 190))

# ferne Hügelkette + kahle Bäume (Silhouette, 3×-Raster)
h = 6
for i in range(W2 // 3 + 1):
    h = max(3, min(10, h + rng.randint(-1, 2)))
    cv.rect(i * 3, HOR - 3 * h, i * 3 + 3, H2, (14, 20, 24))


def tree(x0, base, hgt, lean=0):
    for k in range(hgt):
        cv.rect(x0 + (k * lean) // 6 * 3, base - 3 * k - 3, x0 + (k * lean) // 6 * 3 + 3, base - 3 * k, (14, 20, 24))
    for k, (dx, dy, n) in enumerate(((1, 0.55, 3), (-1, 0.7, 2), (1, 0.85, 2), (-1, 0.4, 3))):
        yb = base - int(hgt * dy) * 3
        xb = x0 + (int(hgt * dy) * lean) // 6 * 3
        for j in range(1, n + 1):
            cv.rect(xb + dx * 3 * j, yb - 3 * j, xb + dx * 3 * j + 3, yb - 3 * j + 3, (14, 20, 24))


tree(24, HOR - 18, 16, 1); tree(212, HOR - 12, 13, -1); tree(174, HOR - 20, 9, 0)

# ---------------------------------------------------------------- Boden (Mittelgrund, 3×-Raster)
GR = HOR - 6
for by in range(GR // 3, H2 // 3 + 1):
    for bx in range(W2 // 3 + 1):
        r = rng.rand()
        c = (30, 34, 30) if r < 0.2 else (20, 24, 22) if r < 0.85 else (40, 46, 36)
        cv.rect(bx * 3, by * 3, bx * 3 + 3, by * 3 + 3, c)

K = 3
stones = parts(lay(B, 1229), dil=0) + parts(lay(B, 770), dil=0)
slab = [s for s in stones if s.shape[1] == 16]
cross = [s for s in stones if s.shape[1] == 12]
big = lay(B, 75)


def glow(cx, cy, rx, ry, col=(90, 230, 120), amt=0.55):
    """grünes Grablicht, gedithert im 3×-Raster"""
    for by in range((cy - ry) // 3, (cy + ry) // 3 + 1):
        for bx in range((cx - rx) // 3, (cx + rx) // 3 + 1):
            d = math.hypot((bx * 3 + 1 - cx) / rx, (by * 3 + 1 - cy) / ry)
            a = max(0.0, 1 - d) * amt
            q = math.floor(a * 4 + BAYER4[by % 4, bx % 4]) / 4
            if q > 0 and 0 <= by * 3 < H2:
                y0, x0 = by * 3, bx * 3
                sub = cv.a[y0:y0 + 3, max(0, x0):x0 + 3].astype(float)
                cv.a[y0:y0 + 3, max(0, x0):x0 + 3] = (sub * (1 - q) + np.array(col) * q).astype(np.uint8)


def mound(cx, y, w):
    """aufgebrochene Erde vor dem Grab (3×-Raster)"""
    for i in range(-w, w + 1):
        hh = int(round(5 * math.sqrt(max(0.0, 1 - (i / (w + 0.5)) ** 2)))) + (1 if i % 3 == 0 and abs(i) < w else 0)
        for j in range(hh):
            c = (122, 92, 58) if j == hh - 1 else (88, 64, 40) if (i + j) % 3 else (64, 46, 30)
            cv.rect(cx + i * 3, y - 3 * j - 3, cx + i * 3 + 3, y - 3 * j, c)
        cv.rect(cx + i * 3, y, cx + i * 3 + 3, y + 3, (24, 18, 14))


# hintere Grabreihe (ohne Skelette)
for s, x, y in ((slab[0], 4, 160), (cross[0], 200, 154), (slab[1], 64, 152), (cross[1], 158, 148)):
    u = darken(up(s, K), 0.62); cv.paste(u, x, y - u.shape[0])

# drei Skelette steigen aus den Gräbern: Grabstein dahinter, Skelett, Erdhügel davor (verdeckt die Füße)
sk = parts(lay(B, 757), dil=0)
spots = [(sk[0], 46, 236, slab[2]), (sk[1], 125, 210, big), (sk[2], 204, 236, cross[2])]
for s, cx, base, st in spots:
    stu = up(st, K)
    cv.paste(stu, cx - stu.shape[1] // 2 + (6 if cx < 125 else -6 if cx > 125 else 0), base - 30 - stu.shape[0])
for s, cx, base, st in spots:
    glow(cx, base - 24, 34, 30, amt=0.4)
for s, cx, base, st in spots:
    u = up(s, K)
    x, y = cx - u.shape[1] // 2, base + 6 - u.shape[0]
    cv.paste(u, x, y)
    mound(cx, base, 9)

# Irrlichter: kleine grüne Funken (3×3) über den Gräbern
for cx, cy in ((30, 150), (60, 132), (118, 118), (140, 140), (190, 128), (222, 150), (96, 160), (170, 160)):
    cv.rect(cx, cy, cx + 3, cy + 3, (150, 255, 170))

# ---------------------------------------------------------------- Beschwörer (5×, Vordergrund)
nec = lay(B, 756)
N = up(nec, 5)
nx, ny = W2 // 2 - N.shape[1] // 2, H2 - N.shape[0] + 2
cv.paste(N, nx, ny)

for n, s in dict(necro=nec, skel_a=sk[0], skel_b=sk[1], skel_c=sk[2]).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g41_%s.png' % n))
vignette(cv, 0.5, 0.55)
print(save(cv, '41_raise_the_minions.png'))
