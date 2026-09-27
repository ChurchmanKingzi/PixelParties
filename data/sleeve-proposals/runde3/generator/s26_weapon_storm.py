# -*- coding: utf-8 -*-
"""Sleeve 26 – „Weapon Storm“: Xal, die belebte Rüstung, steht im roten Glühen und lässt einen Sturm aus
Schwertern, Pfeilen und Hellebarden senkrecht in den Himmel schießen – spiegelsymmetrisch wie ein Wappen.

Quellen (MotiveGrailWar.xcf): Ebene 401 „XAL“ (5×), 402 „Weapon Storm“ (nur der Waffenschwarm, um 90° gedreht,
2× vorne / 1× dahinter abgedunkelt), 694 „Doctor Fester #5“ (dunkle Quadermauer, 2×, rot getönt).
Hintergrundglühen: selbst erstellter, geordnet geditherter Radialverlauf. Karten: Xal the Animated Armor.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
wall = region(B, [694], (0, 0, 565, 440))
b = bbox(wall); wall = wall[b[1]:b[3], b[0]:b[2]]
wall = wall[:, 20:120]                                 # nur die dunklen Quader (ohne hellen Rand)
tile = hsv_shift(wall, -10, 1.0, 0.55)
tile = tint(tile, (90, 10, 20), 0.25)
tl = up(tile, 2)
for y in range(0, 350):
    for x in range(250):
        cv.a[y, x] = tl[y % tl.shape[0], x % tl.shape[1], :3]

# rotes Glühen hinter Xal
yy, xx = np.mgrid[0:350, 0:250]
d = np.hypot((xx - 125) / 1.0, (yy - 250) / 1.25) / 190.0
t = np.clip(1 - d, 0, 1)
for lvl, col in [(0.15, (120, 20, 20)), (0.45, (190, 40, 30)), (0.75, (240, 110, 50))]:
    m = t > lvl + BAYER8[yy % 8, xx % 8] * 0.3
    cv.a[m] = (cv.a[m].astype(int) * 0.45 + np.array(col) * 0.55).astype(np.uint8)

# Waffenschwarm (ohne Xal) aus Weapon Storm, nach oben gedreht
ws = compose(B, [402], crop=False)[188:221, 240:331].copy()
b = bbox(ws); ws = ws[b[1]:b[3], b[0]:b[2]]
keep('d26_weapons_only', ws)
up_w = rot90(ws, 1)                                      # Spitzen zeigen nach oben
back = darken(up_w, 0.45)
for x, y in [(4, 10), (60, 0), (150, 4), (208, 14), (104, 30)]:
    put(cv, back if x % 2 == 0 else flip(back), x, y, 1)
for x, y, f in [(20, 44, True), (92, 8, False), (164, 44, True)]:
    put(cv, flip(up_w) if f else up_w, x, y, 2, shadow=(30, 4, 8), sh_off=(1, 1), sh_alpha=0.6)

xal = sprite('d26_xal', B, [401])
put(cv, xal, 125, 348, 5, anchor='b', shadow=(20, 0, 4), sh_off=(1, 0), sh_alpha=0.7)

vignette(cv, 0.5, 0.55)
frame(cv, [(10, 4, 6), (200, 40, 40), (90, 10, 16)])
print(save(cv, '26_weapon_storm.png'))
