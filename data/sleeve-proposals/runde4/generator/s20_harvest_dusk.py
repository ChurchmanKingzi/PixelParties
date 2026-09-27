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
animals = parts(sprite('d20_animals', B, [38]), dil=1)
horse = [p for p in animals if p.shape[:2] == (23, 24)][0]  # Pferd unten links (vollständig)

# ---------------- Hintergrund 2× --------------------------------------------------------------
bw, bh = grid(2)
bg = Canvas(bw, bh)
HZ = 94
bands(bg, 0, HZ, [(70, 60, 120), (120, 78, 132), (184, 100, 120), (232, 140, 104), (250, 186, 110), (254, 224, 150)],
      soft=0.6)
# große, halb versunkene Sonne genau hinter der Harpyie, goldener Hof
SX, SY, SR = 62, HZ + 3, 31
glow(bg, SX, SY, 70, (255, 232, 170), 0.45, ry=50)
for y in range(SY - SR, SY + SR + 1):
    for x in range(SX - SR, SX + SR + 1):
        d = math.hypot(x + .5 - SX, y + .5 - SY)
        if d < SR: bg.px(x, y, (255, 238, 186) if d < SR - 3 else (255, 214, 140))
# Wolkenstreifen (vor der Sonne teils dunkler)
for (cx, cy, L, col) in [(50, SY - 22, 34, (240, 168, 112)), (78, SY - 12, 40, (240, 168, 112)),
                         (98, 40, 34, (190, 104, 124)), (30, 26, 22, (150, 86, 128)), (18, 60, 20, (226, 140, 108))]:
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
shade(bg, lambda x, y: (0.35 * max(0, 1 - math.hypot(x - SX, (y - HZ) * 2) / 50) if y > HZ else 0),
      col=(255, 220, 150))

# Pferd in der Ferne (2×) links vor der Sonne, Schatten zur Seite weg von der Sonne
def ground_shadow(cx, gy, rx):
    for yy in range(gy - 1, gy + 1):
        for xx in range(int(cx), int(cx + rx * 2)):
            if (xx + yy) % 2 == 0: bg.px(xx, yy, (110, 70, 58))

px, py = 12, HZ + 20 - horse.shape[0]
ground_shadow(px + 12, py + horse.shape[0], 9)
bg.paste(horse, px, py)
# Schwalben (selbst gezeichnet, kleine Bögen)
for (x, y) in [(92, 22), (101, 30), (86, 34)]:
    for dx, dy in ((-2, 0), (-1, -1), (0, 0), (1, -1), (2, 0)):
        bg.px(x + dx, y + dy, (60, 44, 70))

# ---------------- Vordergrund 5× --------------------------------------------------------------
fw, fh = grid(5)                                    # 50×70
fg = rgba(fw, fh)
hx = (fw - harpy.shape[1]) // 2
hy = fh - 3 - harpy.shape[0]
ellipse_shadow(fg, hx + harpy.shape[1] / 2 + 3, hy + harpy.shape[0] - 1, 17, 2.4, (70, 40, 44), 255)
put(fg, harpy, hx, hy)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 5)
print(save(cv, '20_harvest_dusk.png'))
