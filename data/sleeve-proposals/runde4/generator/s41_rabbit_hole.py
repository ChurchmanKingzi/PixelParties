# -*- coding: utf-8 -*-
"""41 Down the Rabbit Hole – Froschperspektive in einen Erdschacht: Carris, das weiße Kaninchen, fällt groß
auf uns zu, die goldene Taschenuhr an der Kette flattert neben ihm, weiter oben im Schacht fällt die kleine
Maus (Little Carris); ganz oben leuchtet die runde Öffnung zum Himmel.

Quellen (MotiveBritain.xcf):
  Ebene 268 „Carris“        – weißes Kaninchen (Karte „Carris, the Time Keeper“)       Vordergrund 5×
  Ebene 266 „Ebene #24“     – goldene Taschenuhr mit Kette (gleiche Karte)             Vordergrund 5×
  Ebene 267 „Little Carris“ – kleine Maus                                             Mittelgrund 3×
  Ebene 271 „Hintergrund“   – Erd-Kachel (16×16) der Britain-Karte für die Schachtwand   Hintergrund 2×
Schacht, Ringe, Licht, Himmel und Fallstreifen selbst gezeichnet, alles im 2×-Raster (125×175).
Skalierung: Schacht/Himmel 2×, Maus 3×, Kaninchen + Uhr 5×.
"""
import math
import numpy as np
from kit41_45 import *  # noqa

B = 'MotiveBritain'
rabbit = sprite('i41_carris', B, [268])
watch = sprite('i41_watch', B, [266])
mouse = sprite('i41_littlecarris', B, [267])
earth = compose(B, [271], crop=False)[96:112, 264:280]          # 16×16-Kachel Erde

# ---------------------------------------------------------------- Schacht (2×)
bg = G(2)
W2, H2 = bg.w, bg.h
VX, VY, R0 = 62.5, 36.0, 12.5
yy, xx = np.mgrid[0:H2, 0:W2]
dx, dy = xx + .5 - VX, yy + .5 - VY
r = np.sqrt(dx * dx + dy * dy)
th = np.arctan2(dy, dx)
# Schachtwand: Erdschichten zwischen perspektivisch gestaffelten Ringen, jede Schicht eine Stufe dunkler
# (keine Verlaufs-Dither), die dunklen Körner der Britain-Erdkachel bleiben als Sprenkel erhalten.
tile = earth[yy % 16, xx % 16, :3].astype(int)
speck = tile.sum(-1) < 300                                              # dunkle Körner der Kachel
wall = r >= R0
rings = [R0 * 1.3 ** n for n in range(0, 14)]
BANDS = [(206, 160, 100), (186, 138, 80), (164, 116, 64), (140, 96, 52), (118, 78, 42), (98, 62, 34),
         (80, 50, 28), (64, 40, 22), (50, 31, 18), (40, 24, 14), (32, 19, 11), (26, 15, 9), (21, 12, 8)]
band = np.clip(np.searchsorted(rings, r) - 1, 0, len(BANDS) - 1)
for n, col in enumerate(BANDS):
    m = wall & (band == n)
    bg.a[m, :3] = col; bg.a[m, 3] = 255
    dk = tuple(int(v * 0.8) for v in col)
    bg.a[m & speck, :3] = dk
    # jede zweite Schicht etwas rötlicher (Tonschicht)
    if n % 2 == 1:
        bg.a[m & ~speck, :3] = tuple(int(v) for v in (col[0], col[1] * 0.93, col[2] * 0.9))
# Ringkanten: dunkle Fuge außen, helle Kante innen (Licht kommt aus der Öffnung)
for k, rr in enumerate(rings[1:]):
    fuge = wall & (r >= rr) & (r < rr + 0.9)
    bg.a[fuge, :3] = (bg.a[fuge, :3] * 0.55).astype(np.uint8)
    lit = wall & (r < rr) & (r >= rr - 0.9) & (dy < 0.35 * r)
    bg.a[lit, :3] = np.clip(bg.a[lit, :3].astype(int) + 26, 0, 255).astype(np.uint8)
# Himmel in der Öffnung
sky = ~wall
bg.vgrad([(0, (120, 190, 255)), (0.55, (176, 222, 255)), (1, (232, 246, 255))],
         y0=int(VY - R0), y1=int(VY + R0), m=sky)
# Rand der Öffnung: Grasbüschel (selbst gezeichnet)
rng = np.random.default_rng(41)
for a in np.linspace(0, 2 * math.pi, 34, endpoint=False) + rng.uniform(0, .12, 34):
    L = rng.integers(2, 5)
    for s in range(L):
        rr = R0 + 0.3 - s
        x, y = VX + math.cos(a) * rr, VY + math.sin(a) * rr
        bg.px(int(x), int(y), (46, 92, 40) if s < L - 1 else (84, 150, 60))
# Maus (2×, selbe Ebene wie der Schacht): fällt weiter oben, nahe der Öffnung
bg.paste(outline(mouse, (26, 15, 9)), 84, 45)

# ---------------------------------------------------------------- Kaninchen + Uhr (5×)
fg = G(5)
RX, RY = 9, 39                                   # Kaninchen links unten
fg.paste(outline(rabbit, (20, 12, 8)), RX - 1, RY - 1)
# Uhr rechts daneben; das lose Kettenende (unten links im Sprite) liegt an der rechten Pfote
WX, WY = RX + 15, RY - 13
fg.paste(outline(watch, (20, 12, 8)), WX - 1, WY - 1)
fg.paste(rabbit, RX, RY)                          # Pfote über dem Kettenende

cv = flatten([bg, fg])
print(save(cv, '41_rabbit_hole.png'))
