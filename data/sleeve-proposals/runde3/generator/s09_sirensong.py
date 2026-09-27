# -*- coding: utf-8 -*-
"""09 Siren's Song – die Deepsea-Sirene singt auf einer Klippe vor dem riesigen Blutmond; ihre Noten steigen
auf, unten treibt ein Schiffbrüchiger (Doomed Pirate) an einem Fass zwischen Wrackteilen, Haiflossen kreisen.

Quellen:
  MotiveDeepsea.xcf: Ebene 327 „Siren“ (Karte „Deepsea Siren“, 4×), Ebene 324 „Ebene #167“ (Noten, 3×),
    Ebene 363 „Ebene #182“ (Blutmond, 3×), Ebene 386 „Ebene #194“ (Felsklippe, 2×, gespiegelt zum Gipfel,
    nachtblau getönt), Ebene 50 „Rakah #2“ (Haiflossen, 3×; Karte „Kit the Shark Researcher“)
  MotiveGrailWar.xcf: Ebene 559 „Doomed Pirate“ (4×, im Wasser angeschnitten)
  MotiveSteamDwarfs.xcf: Ebene 211 „Shipwrecked“ (Fass 4×, Planken 2×)
  Farben Himmel/Meer: MotiveDeepsea Ebene 391 „Hintergrund“.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
cv = Canvas(W, H)
HOR = 206          # Horizont
WL = 300           # vordere Wasserlinie (vor dem Felsen)

# ---------- Himmel + Mond ----------
vgrad(cv, [(0, (8, 14, 40)), (0.5, (18, 44, 100)), (1, (40, 70, 120))], 0, 0, W, HOR)
MX, MY = 125, 104
for y in range(0, HOR):
    for x in range(W):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < 84: cv.a[y, x] = (110, 50, 72)
        elif d < 94 and 0.5 > BAYER4[y % 4, x % 4]: cv.a[y, x] = (110, 50, 72)
        elif d < 106 and 0.25 > BAYER4[y % 4, x % 4]: cv.a[y, x] = (70, 50, 96)
moon = up(compose(D, [363]), 3)
pc(cv, moon, MX, MY)

# ---------- ferne See ----------
vgrad(cv, [(0, (22, 65, 125)), (1, (12, 30, 76))], 0, HOR, W, H)
for y in range(HOR, H):
    for x in range(W):
        # Wellenlinien
        if (y - HOR) % 5 == 0 and ((x + (y * 7) % 13) // 6) % 3 == 0:
            cv.a[y, x] = (47, 101, 159)
# Mondspiegelung
for j, y in enumerate(range(HOR + 2, H, 4)):
    hw = int(30 - j * 0.9) + (j % 2) * 4
    for x in range(MX - hw, MX + hw):
        if 0 <= x < W and ((x // 2 + j) % 5):
            cv.a[y, x] = (150, 64, 84) if j < 12 else (96, 58, 104)
cv.a[HOR] = (60, 110, 165)

# ---------- Klippe ----------
rock = compose(D, [386])
hill = np.concatenate([rock, flip(rock)], 1)          # 218×103, Gipfel in der Mitte
hill = lum_tint(hill, (8, 8, 26), (96, 76, 128))
Hh = up(hill[:, 109 - 70:109 + 70], 2)                # 280×206
rk = Canvas(W, H); rk.a[:] = cv.a
rk.paste(Hh, MX - Hh.shape[1] // 2, 176)
cv.a[:WL] = rk.a[:WL]
# Mondlicht-Kante auf den Felsen
m = np.zeros((H, W), bool)
hx0 = MX - Hh.shape[1] // 2
sub = Hh[..., 3] > 0
for j in range(sub.shape[0]):
    for i in range(sub.shape[1]):
        X, Y = hx0 + i, 176 + j
        if 0 <= X < W and 0 <= Y < WL and sub[j, i] and (j == 0 or not sub[j - 1, i] or j < 3 and not sub[0, i]):
            cv.a[Y, X] = (150, 80, 110)
            if Y + 1 < WL: cv.a[Y + 1, X] = (110, 60, 96)

# ---------- Sirene ----------
siren = compose(D, [327])
S = up(siren, 4)
sx, sy = MX - S.shape[1] // 2 - 4, 182 - S.shape[0] + 16
cv.paste(S, sx, sy)
# Noten
notes = parts(compose(D, [324]), dil=1)
pos = [(40, 150), (22, 92), (58, 38), (178, 44), (206, 96), (192, 150)]
for p, (x, y) in zip(notes, pos):
    cv.paste(up(p, 3), x, y)

# ---------- Vordergrundwasser ----------
vgrad(cv, [(0, (18, 44, 100)), (1, (8, 20, 56))], 0, WL, W, H)
for y in range(WL, H):
    for x in range(W):
        if (y - WL) % 6 == 0 and ((x + (y * 5) % 11) // 7) % 3 == 0:
            cv.a[y, x] = (47, 101, 159)
for x in range(W):
    cv.a[WL, x] = (70, 120, 175) if (x // 4) % 2 else (47, 101, 159)

# Haiflossen
fins = [p for p in parts(compose(D, [50]), dil=0) if p.shape[:2] == (10, 10)]
cv.paste(up(fins[0], 3), 6, WL - 22)
cv.paste(up(flip(fins[1]), 2), 64, WL - 12)

# Wrackteile
deb = parts(compose('MotiveSteamDwarfs', [211]), dil=0, minpx=6)
barrels = [p for p in deb if p.shape[0] >= 13 and p.shape[1] >= 12]
planks = [p for p in deb if p.shape[0] < 12 and p.shape[1] >= 8]
cv.paste(up(planks[0], 2), 22, 326)
cv.paste(up(flip(planks[1]), 2), 214, 332)

# Schiffbrüchiger am Fass
pir = compose('MotiveGrailWar', [559])
P = up(pir, 4)
px, py = 142, 252
cut = 322 - py                        # bis zur Wasserlinie sichtbar
cv.paste(P[:cut], px, py)
b = barrels[0]
B = up(b, 4)
cv.paste(B, px - 36, 298)
# Wasserring um den Piraten
for x in range(px + 4, px + P.shape[1] - 2):
    if (x // 3) % 2 == 0: cv.a[322, x] = (130, 180, 225)

vignette(cv, 0.5, 0.6)
print(save(cv, '09_siren_song.png'))
