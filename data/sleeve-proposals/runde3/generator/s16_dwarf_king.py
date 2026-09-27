# -*- coding: utf-8 -*-
"""Sleeve 16 – Der Zwergenkönig vor seinem Stollen, überarbeitet für Runde 3b.

Güldefaber, der König der Zwerge, steht groß im Vordergrund neben seinem aufrecht gestellten,
funkelnden Fass-Hammer (Anordnung wie auf seiner Karte), daneben ein Fass. Weit hinter ihm führt
der Pfad zwischen Wiesen und Bäumen zum dunklen Stolleneingang in der Felswand – der Blick geht
über den König hinweg in die Tiefe (Aufbau wie „Count of the Deep“).

Skalierung / Tiefenstaffelung:
  Vordergrund 5×: König, Fass-Hammer, Glitzer, Fass (alle auf derselben Ebene, alle 5×)
  Hintergrund 2×: Felswand mit Stolleneingang, Pfad, Bäume (weit hinten, durch Abdunkeln und
                  Dunst zusätzlich zurückgesetzt). Der König wird unten vom Bildrand angeschnitten,
                  sein Standpunkt liegt also vor der gesamten Kulisse.
  Die frühere Garde (Dragon Pilots 4× neben dem 7×-König) ist entfallen (Regel A).

Quellen (Motive.xcf, Karte „Güldefaber, the King of Dwarfs“, Szene 262):
  König = Ebene 266 „Güldefaber“; Fass-Hammer + Fass = Ebene 265; Glitzer = Ebene 264
  Kulisse = Ebene 874 „Ebene #264“ (Felswand mit Stolleneingang, Pfad, Wiese, Bäume)
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
# ---------- Felswand 6× und dunkle Stollennische (Rundbogen) im 6×-Raster
tile_fill(cv, rock, 0, 0, W, FLOOR, k=K, ox=2 * K)
shade_rows(cv, 0, FLOOR, 0.45, 0.2, (20, 10, 6), k=K)
NX, NTOP = W // 2, 36                                    # Nischenmitte, Scheitel
NR = 96
def niche(x, y, pad=0):
    cy = NTOP + NR
    if y >= cy: return abs(x + K / 2 - NX) < NR + pad
    return math.hypot(x + K / 2 - NX, y + K / 2 - cy) < NR + pad
for y in range(0, FLOOR, K):
    for x in range(0, W, K):
        if niche(x, y):
            t = min(1, max(0, (y - NTOP) / (FLOOR - NTOP)))
            c = [(12, 7, 5), (24, 14, 8), (40, 24, 12), (58, 36, 18)]
            i = int(t * 3 + BAYER4[(y // K) % 4, (x // K) % 4] * 0.999)
            cv.rect(x, y, x + K, y + K, c[min(i, 3)])
        elif niche(x, y, K):
            cv.rect(x, y, x + K, y + K, (150, 104, 60))           # Bogenkante (Licht)
        elif niche(x, y, 2 * K):
            cv.rect(x, y, x + K, y + K, (28, 14, 6))              # Fuge
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
