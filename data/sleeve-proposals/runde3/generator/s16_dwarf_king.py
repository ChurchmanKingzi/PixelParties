# -*- coding: utf-8 -*-
"""Sleeve 16 – Der Zwergenkönig vor seinem Stollen, überarbeitet für Runde 3b.

Güldefaber, der König der Zwerge, steht groß vor dem holzverschalten Eingang seines Stollens,
neben ihm – wie auf seiner Karte – der aufrecht gestellte, funkelnde Fass-Hammer. Hinter ihm führt
der Stollen ins Dunkel; Felswand und Boden stammen aus der Kulisse seiner Karte.

Einheitliche Pixelgröße: ALLES 6× (König, Fass-Hammer, Glitzer, Felswand- und Bodentextur,
Holzausbau und Stollen-Dithering). Die frühere Garde (Dragon Pilots 4× neben dem 7×-König) und der
4×-Hammer über dem König sind entfallen (Regel A); der Hammer steht jetzt wie auf der Karte neben ihm.

Quellen (Motive.xcf, Karte „Güldefaber, the King of Dwarfs“, Szene 262):
  König = Ebene 266 „Güldefaber“; Fass-Hammer = Ebene 265; Glitzer = Ebene 264
  Felswand + Boden = Ebene 874 „Ebene #264“ (Kulisse der Karte); Holzausbau selbst gezeichnet in
  den Holzfarben der Fässer aus Ebene 265
Vollständigkeit (Regel B): fig_check gegen Szene 262 – alle sichtbaren Figurpixel stammen aus
264/265/266; das graue Stück hinter der Krone gehört zur Felswand (874), nicht zur Figur.
"""
from c_util import *

M = 'Motive'
K = 6
cv = Canvas(W, H)

# ---------- Figuren (nativ)
grp = figure('c16_group', M, [(265, (317, 150, 341, 183)), (265, (325, 183, 333, 185)), 266])   # Hammer + König
spk = figure('c16_sparkle', M, [264])                                                       # Glitzer, gleiche Lage
# Lage der Teile zueinander (nativ): Gruppe beginnt bei (317, 150), Glitzer bei (312, 146)
GX0, GY0, SX0, SY0 = 317, 150, 312, 146
rock = tex('c16_rock', M, 874, (282, 152, 314, 200))       # Felswand (Kluftfels), 32×48
dirt = tex('c16_dirt', M, 874, (320, 170, 346, 181))      # Pfad/Stollenboden, 26×11

FLOOR = 300                                               # Standlinie (Canvas-y, Vielfaches von 6)
# ---------- Felswand 6× mit Stolleneingang: dunkler Stollen, Holzausbau (Stempel + Kappe) in den
# Holzfarben der Fässer aus Ebene 265, alles im 6×-Raster
tile_fill(cv, rock, 0, 0, W, FLOOR, k=K, ox=2 * K)
shade_rows(cv, 0, FLOOR, 0.45, 0.25, (20, 10, 6), k=K)
WD = [(72, 44, 22), (103, 64, 32), (136, 95, 49), (175, 127, 64), (199, 159, 97)]   # Holz dunkel→hell
OX0, OX1, OTOP = 5 * K, W - 5 * K, 7 * K                  # Stollenöffnung
for y in range(OTOP, FLOOR, K):                            # Stollen: dunkel, nach hinten schwarz
    for x in range(OX0, OX1, K):
        t = (y - OTOP) / (FLOOR - OTOP)
        c = [(10, 6, 4), (22, 13, 7), (38, 23, 11), (56, 34, 16)]
        i = int(t * 3 + BAYER4[(y // K) % 4, (x // K) % 4] * 0.999)
        cv.rect(x, y, x + K, y + K, c[min(i, 3)])
def post(x0):                                              # Stempel: 3 Zellen breit
    for y in range(OTOP, FLOOR, K):
        cv.rect(x0, y, x0 + K, y + K, WD[3])
        cv.rect(x0 + K, y, x0 + 2 * K, y + K, WD[2])
        cv.rect(x0 + 2 * K, y, x0 + 3 * K, y + K, WD[1])
        if (y // K) % 7 == 3: cv.rect(x0 + K, y, x0 + 2 * K, y + K, WD[1])     # Astloch
    cv.rect(x0 - K, OTOP - 4 * K, x0 + 4 * K, OTOP - 3 * K, WD[0])           # Schatten unter der Kappe
post(OX0 - 3 * K); post(OX1)
for x in range(OX0 - 5 * K, OX1 + 5 * K, K):               # Kappe (Querbalken), 3 Zellen hoch
    cv.rect(x, OTOP - 3 * K, x + K, OTOP - 2 * K, WD[4])
    cv.rect(x, OTOP - 2 * K, x + K, OTOP - K, WD[3] if (x // K) % 9 else WD[1])
    cv.rect(x, OTOP - K, x + K, OTOP, WD[1])
for xe in (OX0 - 5 * K, OX1 + 4 * K):                      # Balkenenden (Hirnholz)
    cv.rect(xe, OTOP - 3 * K, xe + K, OTOP, WD[2])
# Boden 6×
tile_fill(cv, dirt, 0, FLOOR, W, H, k=K)
cv.rect(0, FLOOR, W, FLOOR + K, (70, 44, 22))
shade_rows(cv, FLOOR, H, 0.2, 0.55, (26, 14, 6), k=K)

# ---------- König + Hammer 6× (Originalanordnung), Glitzer ohne Kontur in derselben Lage
Gw, Gh = grp.shape[1] * K, grp.shape[0] * K
gx, gy = (W - Gw) // 2, FLOOR + K - Gh
put(cv, grp, gx, gy, K, ol=(26, 14, 6), shadow=(8, 4, 2), sdx=1, sdy=0, salpha=0.5)
cv.paste(up(spk, K), gx + (SX0 - GX0) * K, gy + (SY0 - GY0) * K)

print(save(cv, '16_dwarf_king.png'))
