# -*- coding: utf-8 -*-
"""46 Dragon Gate – Legende vom Drachentor: ein Karpfen springt den Wasserfall hinauf, gerade dem Schnabel
des Kranichs im Becken entkommen; oben im Abenddunst erscheint schemenhaft der Drache, der er werden will.

Quellen:
  MotiveJapan.xcf  Ebene 6 „Scavenging Crane #1“ – Kranich (Karte „Scavenging Crane“, Szene „Sichtbar #36“), 5×
                   Ebene 5 „Scavenging Crane #2“ – Fisch, um 180° gedreht (gleiche Karte), 5×
                   Ebene 7 „Scavenging Crane“ – Gischtwolken am Fuß des Wasserfalls, 2×
                   Ebene 173 „Ebene #140“ – Ahornbaum auf den Klippenkanten (abgedunkelt, links + gespiegelt rechts), 2×
                   Ebene 108 „Ebene #31“ – Erdtextur, umgefärbt als Fels der Klippen, 2×
  MotiveGuardianBeasts.xcf  Ebene 105 „Long-Kopie“ – Guardian Beast Long als gedithertes Geisterbild, 2×
Selbst gezeichnet: Himmel, Berge, Klippenform, Wasserfall, Becken, Wellenringe, Tropfen.
Skalierung: Hintergrund/Mittelgrund (Himmel, Drachengeist, Klippen, Bäume, Wasserfall, Becken) 2× (125×175);
Vordergrund (Kranich, Fisch, Tropfen, Wellenringe um die Beine) 5× (50×70).
"""
import math, random
from j_util_46_50 import *  # noqa

J, G = 'MotiveJapan', 'MotiveGuardianBeasts'
random.seed(46)

# ---------------- 2×-Ebene: Himmel, Berge, Geist, Klippen, Wasserfall, Becken ----------------
bg = Lay(2)
bg.vgrad([(0, (22, 20, 58)), (0.35, (58, 36, 92)), (0.7, (150, 70, 110)), (1, (236, 142, 112))], y1=74)
# ferne Berge
for x in range(bg.w):
    h1 = 60 - 9 * math.exp(-((x - 20) / 16) ** 2) - 6 * math.exp(-((x - 104) / 14) ** 2) - 2 * math.sin(x / 5)
    for y in range(int(h1), 74): bg.px(x, y, (104, 58, 106))
# Drachengeist (Long) im Dunst – nach unten ausblendend
long_ = sprite('j46_long', G, [105])
ghost = recolor(long_, lambda a: a * 0.6 + np.array([255, 226, 190]) * 0.4)
gx, gy = 62 - long_.shape[1] // 2, 13
bg.radial(62, 30, 32, (98, 52, 104), 0.9, 0.8)
bg.radial(62, 30, 22, (132, 70, 116), 0.8, 1.0)
bg.paste(ghost, gx, gy, mask_fn=lambda i, j: 0.92 * max(0.0, min(1.0, (38 - j) / 12)))

# Klippen: Fels aus Erdtextur, blau-violett umgefärbt
earth = sprite('j46_earth', J, [108], box=(140, 339, 220, 379))
rock = quant(lum_tint(earth, (20, 14, 36), (150, 120, 160)), [(34, 26, 52), (54, 42, 76), (78, 60, 102), (104, 82, 126)])
RT = tile_rgb(rock, bg.w, bg.h)
TOP = 60            # Oberkante Wasserfall
WL, WR = 41, 84     # Wasserfall-Ränder
POOL = 142          # Wasserspiegel Becken


def cliff_edge_left(y):
    return WL + (2 if y < TOP + 6 else 0) + int(1.5 * math.sin(y / 7.0))


def cliff_edge_right(y):
    return WR - (2 if y < TOP + 6 else 0) + int(1.5 * math.sin(y / 6.0 + 2))


for y in range(TOP - 4, POOL + 2):
    topL = TOP - 6 + int(3 * math.sin(0.0))
    for x in range(bg.w):
        el, er = cliff_edge_left(y), cliff_edge_right(y)
        left = x < el and y >= TOP - 6 + (x // 9) % 2
        right = x >= er and y >= TOP - 6 + ((bg.w - x) // 9) % 2
        if left or right:
            c = RT[y, x]
            # Kanten zum Wasser hin dunkler, Lichtkante oben
            d = (el - x) if left else (x - er)
            f = 0.62 if d < 3 else (0.8 if d < 6 else 1.0)
            if y < TOP - 3 + (x // 9) % 2: c = (150, 112, 140)
            bg.px(x, y, tuple(int(v * f) for v in c))


# Wasserfall
WPAL = [(58, 100, 176), (90, 150, 214), (150, 200, 240), (222, 240, 252)]
cols = [random.choice([0, 1, 1, 2, 2, 3]) for _ in range(bg.w)]
for x in range(WL - 2, WR + 2):
    ph = random.randint(0, 20)
    for y in range(TOP - 1, POOL + 1):
        if not (cliff_edge_left(y) <= x < cliff_edge_right(y)): continue
        c = cols[x]
        if (y + ph) % 11 < 2: c = min(3, c + 1)
        if (y + ph * 3) % 17 < 3: c = max(0, c - 1)
        if x in (cliff_edge_left(y), cliff_edge_right(y) - 1): c = max(0, c - 1)
        bg.px(x, y, WPAL[c])
# Lippe oben: helle Kante
for x in range(cliff_edge_left(TOP), cliff_edge_right(TOP)):
    bg.px(x, TOP - 1, (236, 246, 255)); bg.px(x, TOP, (190, 222, 248))
    if x % 3: bg.px(x, TOP + 1, (222, 240, 252))

# Becken
bg.vgrad([(0, (60, 96, 170)), (0.5, (40, 64, 130)), (1, (26, 36, 84))], y0=POOL, y1=bg.h)
for y in range(POOL, bg.h):
    for x in range(bg.w):
        if (x * 7 + y * 13) % 23 == 0 and y % 3 == 0:
            for dx in range(3): bg.px(x + dx, y, (110, 160, 216))
# Abendlicht auf dem Wasser (Spiegelung der Wolkenfarbe)
for y in range(POOL + 3, bg.h, 3):
    for x in range(40, 86):
        pass
# Gischt am Fuß (aus der Kranich-Karte)
foam = parts(sprite('j46_foam', J, [7]), dil=1)
big = max(foam, key=lambda p: p.shape[1])
bg.paste(big, 62 - big.shape[1] // 2, POOL - 12)
small = [p for p in foam if p is not big]
for p in small[:2]:
    bg.paste(p, 62 - big.shape[1] // 2 - 6, POOL - 2)
    bg.paste(flip(p), 62 + big.shape[1] // 2 - p.shape[1] + 6, POOL - 1)

# Kirschbäume auf den Klippenkanten
trees = [p for p in parts(sprite('j46_trees', J, [173]), dil=0) if p.shape[:2] == (36, 32)]
t = darken(trees[0], 0.7)
bg.paste(t, -12, TOP - 4 - t.shape[0] + 2)
bg.paste(flip(t), bg.w - t.shape[1] + 12, TOP - 4 - t.shape[0] + 3)

# ---------------- 5×-Ebene: Kranich, Fisch, Tropfen ----------------
fg = Lay(5)
crane = sprite('j46_crane', J, [6])
fish = rot90(sprite('j46_fish', J, [5]), 2)
CX, CY = 4, 41
WATER4 = (2 * POOL) // 5 + 2    # Wasserspiegel im 5×-Raster (etwas unter der Beckenkante: Vordergrund)
fg.paste(crane, CX, CY)
# dunkle Kontur nur um den hellen Kopf/Schnabel (trennt ihn vom Wasserfall)
cm = crane[..., 3] >= 128
for j in range(crane.shape[0]):
    for i in range(20, crane.shape[1] + 1):
        if i < crane.shape[1] and cm[j, i]: continue
        M = lambda ii, jj: 0 <= ii < crane.shape[1] and 0 <= jj < crane.shape[0] and cm[jj, ii]
        if (M(i - 1, j) or M(i - 2, j)) and (M(i + 1, j) or M(i + 2, j)): continue   # Lücken (Schnabel) frei lassen
        if (M(i, j - 1) or M(i, j - 2)) and (M(i, j + 1) or M(i, j + 2)): continue
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ii, jj = i + di, j + dj
            if 0 <= ii < crane.shape[1] and 0 <= jj < crane.shape[0] and cm[jj, ii] and crane[jj, ii, :3].mean() > 150:
                fg.px(CX + i, CY + j, (22, 22, 50)); break
# Beine unter Wasser: zu Wasserfarbe gedithert
for y in range(WATER4 + 1, fg.h):
    fg.a[y, :, 3] = 0
# Wellenringe um die Beine
legs = [x for x in range(fg.w) if fg.a[WATER4, x, 3]]
for lx in ([legs[0], legs[-1]] if legs else []):
    for dx in range(-3, 4):
        fg.px(lx + dx, WATER4, (200, 228, 250) if abs(dx) > 1 else (150, 200, 240))
    fg.px(lx - 4, WATER4 + 1, (110, 160, 216)); fg.px(lx + 4, WATER4 + 1, (110, 160, 216))
# Fisch springt nach oben rechts der Mitte
FX, FY = 19, 21
fg.paste(fish, FX, FY)
# Tropfenbogen vom Schnabel zum Schwanz des Fisches
bx, by = CX + 28, CY + 10
for tt in [0.18, 0.34, 0.5, 0.66, 0.8]:
    x = bx + (FX + 6 - bx) * tt + 3 * math.sin(tt * math.pi)
    y = by + (FY + fish.shape[0] + 1 - by) * tt
    fg.px(x, y, (222, 240, 252))
    if tt < 0.6: fg.px(x + 1, y + 1, (110, 160, 216))
for (dx, dy) in [(-2, 3), (13, 2), (-3, 9), (14, 8)]:
    fg.px(FX + dx, FY + fish.shape[0] - 6 + dy, (190, 222, 248))

cv = flatten([bg, fg])

print(save(cv, '46_dragon_gate.png'))
