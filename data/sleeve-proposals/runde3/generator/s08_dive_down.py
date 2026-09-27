# -*- coding: utf-8 -*-
"""08 Dive Down – Querschnitt von der Oberfläche in die Tiefe: oben Blutmond über der Felsküste, der Taucher
sinkt mit aufsteigender Blasenspur hinab, ein Greatmaw-Hai kreuzt, ganz unten glüht der Schatz vor der
versunkenen Deepsea-Burg, aus dem Dunkel starren Augen.

Quellen (MotiveDeepsea.xcf):
  Ebene 207 „Dive Down“ – Taucher (Karte „Dive Down“), 4×
  Ebene 200 „Ebene #93“ – Luftblasen (Karte „Dive Down“), 1×/2×
  Ebene 363 „Ebene #182“ – Blutmond, 1×  (Glanz selbst gedithert in Mondfarbe)
  Ebene 386 „Ebene #194“ – Felsklippe (Deepsea-Küste), 1×, gespiegelt; als Meeresboden abgedunkelt
  Ebene 93  „Greatmaw Shawk“ – Hai, 2×, blau abgedunkelt
  Ebene 196 „Deepsea Treasure“ – Schatztruhe, 2×
  Ebene 375 „Siphem #3“ – Deepsea-Burg (Karte „Siphem“), 1×, abgedunkelt
  Ebene 388 „Ebene #14“ – Tiefsee-Gewächse, 2×
  Ebene 84 „Greatmaw Siren“ – Angler-Hai im Halbdunkel, 2×
  Ebene 295 „Ebene #19“ – grün leuchtende Augen (Karte „Deepsea Reaper“)
  Farben: Ebene 391 „Hintergrund“ (Himmel/Meer).
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
cv = Canvas(W, H)
D = 'MotiveDeepsea'
SURF = 64

# ---------- Himmel ----------
vgrad(cv, [(0, (14, 30, 72)), (0.55, (30, 70, 128)), (1, (47, 101, 159))], 0, 0, W, SURF)
MX, MY = 176, 30
for y in range(0, SURF):
    for x in range(W):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < 31: cv.a[y, x] = (120, 56, 78)
        elif d < 37 and 0.5 > BAYER4[y % 4, x % 4]: cv.a[y, x] = (120, 56, 78)
        elif d < 44 and 0.25 > BAYER4[y % 4, x % 4]: cv.a[y, x] = (84, 62, 108)
moon = sprite('b08_ds363', D, [363])
pc(cv, moon, MX, MY)
# Wasser unterhalb der Oberfläche überdeckt Glanz später

# Felsküste links (Klippe aus der Deepsea-Szene, gespiegelt)
rock = sprite('b08_ds386', D, [386])
R2 = up(flip(rock), 1)
cv.paste(R2, -34, SURF - 70)

# ---------- Wasser ----------
water = [(0, (47, 101, 159)), (0.18, (22, 65, 125)), (0.5, (18, 44, 100)), (0.8, (10, 26, 64)), (1, (5, 10, 28))]
vgrad(cv, water, 0, SURF, W, H)
# Mondspiegelung auf der Oberfläche
for j, y in enumerate(range(SURF + 3, SURF + 40, 4)):
    hw = max(2, 20 - j * 2) + (j % 2) * 3
    for x in range(MX - hw, MX + hw):
        cv.a[y, x] = (150, 64, 84) if j < 4 else (96, 58, 104)
# Wasserlinie
for x in range(W):
    cv.a[SURF, x] = (120, 170, 215) if (x // 3) % 3 else (80, 130, 190)
    cv.a[SURF + 1, x] = (47, 101, 159) if (x // 3) % 3 == 1 else (80, 130, 190)
# Felsen unter Wasser (Fortsetzung der Klippe, blau abgedunkelt)

# Lichtstrahlen von der Oberfläche
for y in range(SURF + 2, 250):
    for x in range(W):
        for x0, wd in ((70, 10), (130, 7), (200, 12)):
            u = x - (x0 - 0.35 * (y - SURF))
            t = max(0, 1 - abs(u) / wd) * (1 - (y - SURF) / 186) * 0.5
            if t > BAYER4[y % 4, x % 4]:
                c = cv.a[y, x].astype(int)
                cv.a[y, x] = np.clip(c + (30, 40, 45), 0, 255)

# ---------- Mittlere Tiefe: Hai ----------
shark = sprite('b08_ds93', D, [93])
sh2 = up(lum_tint(shark, (8, 20, 50), (60, 100, 150)), 2)
cv.paste(flip(sh2), -14, 196)
# Greatmaw-Siren (Angler-Hai) rechts im Halbdunkel, der Köder glimmt
siren = parts(sprite('b08_ds84', D, [84]))[0]
lure = (siren[..., 0] > 150) & (siren[..., 1] < 80) & (siren[..., 3] > 0); lure[12:] = False
sr = lum_tint(siren, (8, 18, 46), (46, 84, 134))
sr[lure, :3] = (220, 70, 80)
S2 = up(sr, 2)
cv.paste(S2, W - S2.shape[1] + 34, 150)

# ---------- Grund ----------
GY = 300
castle = sprite('b08_ds375', D, [375])
c1 = lum_tint(castle, (6, 12, 34), (36, 54, 104))
# Fenster weiter rot glimmen lassen
red = (castle[..., 0] > 150) & (castle[..., 1] < 90)
c1[red, :3] = (150, 40, 50)
cv.paste(up(c1, 1), 162, GY - 44 + 6)
# Seebodenfelsen
bed = lum_tint(rock, (4, 10, 26), (24, 38, 70))
cv.paste(up(bed, 1), W - 109 + 20, GY - 30)
cv.paste(up(flip(bed), 1), -30, GY - 20)
vgrad(cv, [(0, (10, 20, 44)), (1, (4, 8, 20))], 0, GY + 14, W, H)
# Gewächse
weed = sprite('b08_ds388', D, [388])
for i, (p, x) in enumerate(zip(parts(weed), (8, 60, 150, 205, 228))):
    pb(cv, up(p, 2), x, GY + 18)
# Augen im Dunkel
eyes = sprite('b08_ds295', D, [295])
cv.paste(up(eyes, 1), 10, GY - 40)

# Schatz mit Glanz
chest = sprite('b08_ds196', D, [196])
radial(cv, 125, GY + 8, 70, (70, 70, 60), 0.7, power=1.6)
radial(cv, 125, GY + 8, 46, (140, 120, 60), 0.6, power=1.8)
C2 = up(chest, 2)
pb(cv, C2, 125, GY + 36)

# ---------- Taucher + Blasenspur ----------
bub = sprite('b08_ds200', D, [200])
bp = parts(bub, dil=0, minpx=1)
# Blasenkette über dem Helm bis zur Oberfläche
rng = np.random.RandomState(7)
diver = sprite('b08_ds207', D, [207])
DV = up(diver, 4)
dx, dy = 125 - DV.shape[1] // 2, 112
by = dy - 4
while by > SURF + 4:
    x = 128 + int(6 * math.sin(by / 11.0)) + rng.randint(-2, 3)
    b = bp[rng.randint(len(bp))]
    k = 2 if by > dy - 40 else 1
    cv.paste(up(b, k), x, by)
    by -= rng.randint(6, 11)
cv.paste(DV, dx, dy)

vignette(cv, 0.5, 0.6)
print(save(cv, '08_dive_down.png'))
