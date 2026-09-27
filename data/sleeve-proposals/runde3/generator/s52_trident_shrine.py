# -*- coding: utf-8 -*-
"""52 Trident Shrine – Rückenfigur vor dem Heiligtum: Im Saal der Deepsea-Burg fällt eine violette Lichtsäule auf
den steinernen Altarsockel, darin schwebt der zerbrochene Dreizack; Luftblasen und Funken steigen im Licht auf.
Der Taucher (von hinten gesehen) steht davor und blickt hinauf – kurz bevor er zum „Mender of the Shattered
Trident“ wird.

Quellen (MotiveDeepsea.xcf), nach den Karten „Lolek Mender of the Shattered Trident“ / „Shattered Trident
Treasure of the Deepsea“ (Szenen „Sichtbar #62“, „Sichtbar #47“):
  Ebene 190 „Ebene #103“ – Taucher in Rückenansicht (Szene „Sichtbar #47“), 4×
  Ebene 194 „Ebene #102“ – Altarsockel, 4×
  Ebene 192 „Ebene #108“ – der Dreizack, 4×
  Ebene 186 „Ebene #111“ – Lichtsäule (Mittelzeile als Profil, nach oben verlängert), 4×
  Ebene 185 „Ebene #110“ – Funkeln, 4×
  Ebene 197 „Ebene #100“ – Ziegelwand-, Boden- und Sockelleisten-Kacheln der Burg, 4×
  Luftblasen selbst gezeichnet im 4×-Raster (wie 08).
Skalierung: alles einheitlich 4× (Wand, Boden, Sockel, Lichtsäule, Dreizack, Funkeln, Blasen, Taucher).
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
F = 4
cv = Canvas(W, H)
NW, NH = W // F + 1, H // F + 1          # 63×88 natives Raster

wall = sprite('b52_ds197', D, [197])
brick = wall[56:72, 112:128]
floor = wall[120:128, 120:128]
skirt = wall[86:100, 112:128]

FYN = 50                                  # Wand/Boden-Grenze (native) -> y 200
nat = np.zeros((NH, NW, 3), np.uint8)
nat[:FYN] = tile_rgb(brick, NW, FYN, ox=8)
nat[FYN - 14:FYN] = tile_rgb(skirt, NW, 14, ox=8)
nat[FYN:] = tile_rgb(floor, NW, NH - FYN)
# Licht: Wand/Boden abdunkeln, zur Mitte (Lichtsäule) heller – harte Stufen je Spalte/Zeile
for y in range(NH):
    for x in range(NW):
        dx = abs(x + .5 - NW / 2)
        if y < FYN:
            f = 0.62 if dx < 12 else (0.48 if dx < 20 else 0.36)
            f *= 0.75 + 0.25 * min(1, y / 30)          # Decke im Dunkeln
        else:
            dy = (y - (FYN + 6)) / 9.0
            e = (dx / 20.0) ** 2 + dy ** 2
            f = 0.85 if e < 0.45 else (0.62 if e < 1.0 else (0.45 if e < 2.2 else 0.34))
        nat[y, x] = (nat[y, x].astype(float) * f).clip(0, 255).astype(np.uint8)
# violetter Widerschein des Lichts auf dem Boden (harte Ellipse)
for y in range(FYN, NH):
    for x in range(NW):
        if ((x + .5 - NW / 2) / 14) ** 2 + ((y - (FYN + 5)) / 5.5) ** 2 < 1:
            nat[y, x] = (nat[y, x].astype(float) * 0.6 + np.array((190, 160, 230)) * 0.4).astype(np.uint8)
cv.a[:] = up(np.dstack([nat, np.full(nat.shape[:2], 255, np.uint8)]), F)[:H, :W, :3]

vignette_grid(cv, 0.5, 0.55, F)           # Vignette nur auf dem Raum, nicht auf Licht/Figuren

# Lichtsäule: Kern deckend, Rand gedithert (im 4×-Raster)
beam = sprite('b52_ds186', D, [186])
core = layer(D, 186)
b = bbox(core); craw = core[b[1]:b[3], b[0]:b[2]]
BW = craw.shape[1]
bx0 = NW // 2 - BW // 2
PLAT_TOPN = FYN + 3
for y in range(0, PLAT_TOPN):
    row = craw[34]                                          # Mittelzeile der Säule: sie fällt von oben herein
    for i in range(BW):
        al = row[i, 3] / 255.0
        if al <= 0: continue
        X, Y = bx0 + i, y
        if al > 0.85 or al > BAYER4[Y % 4, X % 4]:
            c = nat_c = row[i, :3].astype(float)
            if al < 0.85:  # halbtransparenter Rand: mit Hintergrund mischen
                base = cv.a[Y * F, X * F].astype(float)
                c = base * 0.45 + nat_c * 0.55
            cv.a[Y * F:(Y + 1) * F, X * F:(X + 1) * F] = c.clip(0, 255).astype(np.uint8)

# Altarsockel
plat = sprite('b52_ds194', D, [194])
P4 = up(plat, F)
PB = (FYN + 11) * F
pb(cv, P4, 125, PB)

# Dreizack schwebt in der Säule
tri = sprite('b52_ds192', D, [192])
T4 = up(tri, F)
pc(cv, T4, 126, 116)

# Funkeln + aufsteigende Blasen im Licht
spark = parts(sprite('b52_ds185', D, [185]), dil=0, minpx=1)
for p, (x, y) in zip(spark, [(92, 60), (150, 92), (98, 150), (146, 34)]):
    cv.paste(up(p, F), x, y)
BUB = {1: np.array([[1]]), 2: np.array([[0, 1, 0], [1, 2, 1], [0, 1, 0]])}
BC = {1: (225, 215, 250), 2: (150, 120, 200)}
def bubble(n):
    m = BUB[n]; s_ = np.zeros(m.shape + (4,), np.uint8)
    for v, c in BC.items(): s_[m == v] = c + (255,)
    return s_
for (x, y, n) in [(112, 176, 1), (136, 150, 2), (72, 120, 1), (170, 150, 2), (60, 40, 2), (180, 70, 1), (176, 8, 1), (70, 190, 1)]:
    cv.paste(up(bubble(n), F), x, y)

# Taucher von hinten, davor
diver = sprite('b52_ds190', D, [190])
DV = up(diver, F)
# Schatten auf dem Boden (4×-Raster, harte Ellipse)
for y in range(0, H, F):
    for x in range(0, W, F):
        if ((x + 2 - 125) / 44) ** 2 + ((y + 2 - 340) / 9) ** 2 < 1:
            cv.a[y:y + F, x:x + F] = (cv.a[y:y + F, x:x + F] * 0.55).astype(np.uint8)
pb(cv, DV, 125, 342)

print(save(cv, '52_trident_shrine.png'))
