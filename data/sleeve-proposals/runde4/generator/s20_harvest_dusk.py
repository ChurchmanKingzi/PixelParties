# -*- coding: utf-8 -*-
"""20 Harvest Dusk – Erntezeit: die Country-Harpyie sitzt nach getaner Arbeit auf einem großen Heuhaufen
im abgeernteten Stoppelfeld und spielt der untergehenden Sonne ein Ständchen; weiter hinten steht
ein Pferd im Abendlicht vor dem Waldsaum.

Quellen (MotiveGrailWar.xcf):
  Ebene 36 „Country Harpy“ – Harpyie mit Gitarre auf ihrem Heuhaufen (Karte „Country Harpyformer“,
          geprüft gegen Sichtbar #164: vollständig)
  Ebene 38 „Marianne #3“ – Pferd (Teilfigur unten links, geprüft gegen Sichtbar #182)
Selbst gezeichnet: Abendhimmel, Sonne, Wolkenstreifen, Waldsaum, Stoppelfeld mit Fluchtlinien,
Streiflicht, Schatten, Schwalben.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Sonne, Waldsaum, Feld, Pferd, Schwalben) – 2×-Raster (125×175)
  Vordergrund (Harpyie auf Heuhaufen + Schatten)                           – 5×-Raster (50×70)
"""
import random
from dkit16_20 import *  # noqa

B = 'MotiveGrailWar'
rnd = random.Random(20)
harpy = sprite('d20_harpy', B, [36])                    # 30×34

# ---------------- Hintergrund 2× --------------------------------------------------------------
bw, bh = grid(2)
bg = Canvas(bw, bh)
HZ = 94
bands(bg, 0, HZ, [(34, 30, 76), (58, 44, 104), (100, 60, 120), (156, 80, 118), (212, 112, 104), (244, 160, 96),
                  (252, 200, 120)], soft=0.7)
# Abendrot: breiter, flacher Lichtsaum über dem Horizont (die Sonne ist schon untergegangen)
glow(bg, 62, HZ, 90, (255, 214, 140), 0.45, ry=22)
# blasser Erntemond oben rechts, mit Schattierung
MX, MY, MR = 98, 30, 10
glow(bg, MX, MY, 24, (230, 200, 190), 0.25)
for y in range(MY - MR, MY + MR + 1):
    for x in range(MX - MR, MX + MR + 1):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR:
            c = (250, 238, 206)
            if math.hypot(x + .5 - MX - 3, y + .5 - MY + 2) > MR - 1: c = (226, 204, 186)   # Terminator-Schatten
            if (x, y) in ((MX - 3, MY - 2), (MX - 2, MY - 2), (MX + 2, MY + 3), (MX - 4, MY + 3), (MX - 3, MY + 3)):
                c = (228, 212, 184)                                                     # Mondflecken
            bg.px(x, y, c)
# Sterne (wenige, einzelne Pixel im 2×-Raster)
for (x, y) in [(12, 10), (30, 22), (52, 8), (70, 18), (116, 52), (8, 40), (80, 40)]:
    bg.px(x, y, (230, 222, 250))
# Wolkenstreifen (vor der Sonne teils dunkler)
for (cx, cy, L, col) in [(34, HZ - 20, 36, (236, 150, 108)), (92, HZ - 13, 40, (236, 150, 108)),
                         (24, 58, 26, (170, 88, 118)), (100, 64, 22, (184, 96, 114))]:
    for x in range(int(cx - L / 2), int(cx + L / 2)):
        t = abs(x - cx) / (L / 2)
        bg.px(x, cy, col)
        if t < .55: bg.px(x, cy + 1, col)
        if t < .25: bg.px(x, cy - 1, col)
# Waldsaum am Horizont (Silhouette, Kronenbögen)
TREE = (88, 56, 78)
x = 0
while x < bw:
    w = rnd.choice((4, 5, 6, 7)); h = rnd.choice((3, 4, 5, 6))
    for i in range(w):
        hh = h - (1 if i in (0, w - 1) else 0)
        for y in range(HZ - hh, HZ + 1): bg.px(x + i, y, TREE)
    x += w - 1
# Stoppelfeld: Reihen laufen auf einen Fluchtpunkt am Horizont zu
VX = 62
FIELD = [(196, 150, 84), (172, 124, 66), (214, 170, 96)]
for y in range(HZ + 1, bh):
    dy = y - HZ
    for x in range(bw):
        u = (x + .5 - VX) / dy * 6          # Winkel-Koordinate
        row = int(math.floor(u)) % 2
        c = FIELD[row]
        if (x * 3 + y * 7) % 9 == 0 and dy > 10: c = FIELD[2]      # Stoppeln
        bg.a[y, x] = c
# Streiflicht: warm oben (Horizont), dunkler nach vorne
shade(bg, lambda x, y: (0.55 * min(1, (y - HZ) / 70) if y > HZ else 0), col=(70, 40, 50))
shade(bg, lambda x, y: (0.3 * max(0, 1 - math.hypot(x - 62, (y - HZ) * 2) / 60) if y > HZ else 0),
      col=(255, 220, 150))

# Schwalben (selbst gezeichnet, kleine Bögen)
for (x, y) in [(20, 70), (29, 76), (14, 78)]:
    for dx, dy in ((-2, 0), (-1, -1), (0, 0), (1, -1), (2, 0)):
        bg.px(x + dx, y + dy, (60, 44, 70))

# ---------------- Vordergrund 6× --------------------------------------------------------------
fw, fh = grid(6)                                    # 42×59
fg = rgba(fw, fh)
harpy_o = outline(harpy, (38, 22, 34), 1)           # dunkle Kontur (1 Zelle) löst die Figur vom Abendhimmel
hx = (fw - harpy_o.shape[1]) // 2
hy = 55 - harpy_o.shape[0]
ellipse_shadow(fg, hx + harpy_o.shape[1] / 2 + 2, hy + harpy_o.shape[0] - 1, 17, 2.2, (60, 34, 44), 255)
put(fg, harpy_o, hx, hy)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 6, ox=1, oy=1)
print(save(cv, '20_harvest_dusk.png'))
