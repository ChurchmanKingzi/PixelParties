# -*- coding: utf-8 -*-
"""46 Dragon Gate – Legende vom Drachentor: ein Karpfen schnellt über die Fallkante des Wasserfalls hinaus, dem
Drachen entgegen, der ihm als große, durchscheinende Erscheinung am Abendhimmel wartet; unten rechts im Becken
steht der Kranich, der ihn verpasst hat, und späht zum Fuß des Wasserfalls.

Quellen:
  MotiveJapan.xcf  Ebene 6 „Scavenging Crane #1“ – Kranich, gespiegelt (Karte „Scavenging Crane“, Szene „Sichtbar #36“), 5×
                   Ebene 5 „Scavenging Crane #2“ – Fisch, um 180° gedreht (gleiche Karte), 5×
                   Ebene 7 „Scavenging Crane“ – Gischtwolken am Fuß des Wasserfalls, 2×
                   Ebene 173 „Ebene #140“ – Ahornbaum auf den Klippenkanten (abgedunkelt, links + gespiegelt rechts), 2×
                   Ebene 108 „Ebene #31“ – Erdtextur, umgefärbt als Fels der Klippen, 2×
  MotiveGuardianBeasts.xcf  Ebene 105 „Long-Kopie“ – Guardian Beast Long als geditherte Himmelserscheinung auf eigener Ebene, 3×
Selbst gezeichnet: Himmel, Berge, Klippenform, Wasserfall, Becken, Wellenringe, Tropfen.
Skalierung: Himmel, Klippen, Bäume, Wasserfall, Becken 2× (125×175); Drachenerscheinung (halbtransparent, eigene
Ebene hinter den Klippen) 3× (84×117); Vordergrund (Karpfen, Kranich, Spritzer, Wellenringe) 5× (50×70).
Der Karpfen ist nur um 180° gedreht (Regel 1: keine schrägen Drehungen); der Sprung liest sich über die Lage
über der Fallkante, die Spritzerkrone und die abreißenden Wasserfäden.
"""
import math, random
from j_util_46_50 import *  # noqa

J, G = 'MotiveJapan', 'MotiveGuardianBeasts'
random.seed(46)

# ---------------- 2×-Ebene: Himmel, Berge, Geist, Klippen, Wasserfall, Becken ----------------
bg = Lay(2)
bg.vgrad([(0, (22, 20, 58)), (0.35, (58, 36, 92)), (0.7, (150, 70, 110)), (1, (236, 142, 112))], y1=84)
# ferne Berge
for x in range(bg.w):
    h1 = 70 - 9 * math.exp(-((x - 20) / 16) ** 2) - 6 * math.exp(-((x - 104) / 14) ** 2) - 2 * math.sin(x / 5)
    for y in range(int(h1), 84): bg.px(x, y, (104, 58, 106))
# Schein hinter der Drachenerscheinung
bg.radial(72, 34, 40, (92, 48, 102), 0.9, 0.8)
bg.radial(72, 34, 26, (140, 74, 118), 0.8, 1.0)

# Klippen: Fels aus Erdtextur, blau-violett umgefärbt
earth = sprite('j46_earth', J, [108], box=(111, 441, 151, 471))
rock = quant(lum_tint(earth, (20, 14, 36), (150, 120, 160)), [(34, 26, 52), (54, 42, 76), (78, 60, 102), (104, 82, 126)])
RT = tile_rgb(rock, bg.w, bg.h)
TOP = 74            # Oberkante Wasserfall (→ 148 px)
WL, WR = 10, 45     # Wasserfall-Ränder (links der Mitte)
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
FC = (WL + WR) // 2
bg.paste(big, FC - big.shape[1] // 2, POOL - 12)
small = [p for p in foam if p is not big]
for p in small[:2]:
    bg.paste(p, FC - big.shape[1] // 2 - 6, POOL - 2)
    bg.paste(flip(p), FC + big.shape[1] // 2 - p.shape[1] + 6, POOL - 1)

# Ahornbäume auf den Klippenkanten
trees = [p for p in parts(sprite('j46_trees', J, [173]), dil=0) if p.shape[:2] == (36, 32)]
t = darken(trees[0], 0.7)
bg.paste(t, -12, TOP - 4 - t.shape[0] + 2)
bg.paste(flip(t), bg.w - t.shape[1] + 12, TOP - 4 - t.shape[0] + 3)

# ---------------- 3×-Ebene: Drachenerscheinung am Himmel (hinter den Klippen) ----------------
gh = Lay(3)
long_ = sprite('j46_long', G, [105])
ghost = recolor(long_, lambda a: a * 0.55 + np.array([255, 232, 196]) * 0.45)
GX, GY = 30, 7                           # → x 90..168, y 21..132 px
gh.paste(outline_sil(silhouette(long_, (255, 214, 150)), (255, 214, 150)), GX - 1, GY - 1,
         mask_fn=lambda i, j: 0.45 * max(0.0, min(1.0, (36 - j) / 9)))
gh.paste(ghost, GX, GY, mask_fn=lambda i, j: 0.9 * max(0.0, min(1.0, (36 - j) / 9)))
# unterhalb der Klippenoberkante nichts von der Erscheinung zeigen
for y in range(gh.h):
    if y * 3 >= (TOP - 6) * 2: gh.a[y, :, 3] = 0

# ---------------- 5×-Ebene: Karpfen, Kranich, Spritzer ----------------
fg = Lay(5)
FOAMC, WAT = (236, 246, 255), (150, 200, 240)
fish = rot90(sprite('j46_fish', J, [5]), 2)            # Kopf nach oben
fw_, fh_ = fish.shape[1], fish.shape[0]
LIP5 = TOP * 2 // 5                                     # Fallkante im 5×-Raster
FX = (WL + WR) * 2 // 10 - fw_ // 2 + 2
FY = LIP5 - fh_ - 5                                     # ganz über der Fallkante: in der Luft
fg.paste(fish, FX, FY)
# Spritzerkrone an der Fallkante unter der Schwanzflosse + abreißende Wasserfäden
cx5 = FX + fw_ // 2
for (dx, dy) in [(-3, 0), (-2, -1), (-1, 0), (0, 0), (1, 0), (2, -1), (3, 0), (-4, 1), (4, 1), (-5, -1), (5, -1)]:
    fg.px(cx5 + dx, LIP5 + dy, FOAMC if abs(dx) < 4 else WAT)
for (dx, dy) in [(-2, -3), (2, -3), (-4, -3), (4, -4), (-6, -3), (6, -2), (0, -2)]:
    fg.px(cx5 + dx, LIP5 + dy, FOAMC)
for (dx, dy) in [(-7, -6), (7, -7), (-8, -10), (8, -11), (-6, -13), (7, -15), (-7, -17)]:
    fg.px(cx5 + dx, LIP5 + dy, WAT)
# Wasserfaden, der vom Schwanz zur Kante zurückreißt (hell/dunkel abwechselnd)
for k, dy in enumerate(range(FY + fh_, LIP5 - 1)):
    fg.px(cx5 - 1 + (k % 2), dy, FOAMC if k % 2 == 0 else WAT)
# Tropfen, die vom Körper abperlen
for (dx, dy) in [(-1, 4), (fw_, 6), (-2, 9), (fw_ + 1, 10), (-1, 13), (fw_, 14)]:
    fg.px(FX + dx, FY + dy, FOAMC)

crane = flip(sprite('j46_crane', J, [6]))               # schaut nach links zum Wasserfall
cw_ = crane.shape[1]
WATER5 = (2 * POOL) // 5 + 2
CX = fg.w - cw_ - 1
CY = WATER5 - 18
fg.paste(crane, CX, CY)
for y in range(WATER5 + 1, fg.h):
    fg.a[y, :, 3] = 0
legs = [x for x in range(fg.w) if fg.a[WATER5, x, 3]]
for lx in ([legs[0], legs[-1]] if legs else []):
    for dx in range(-3, 4):
        fg.px(lx + dx, WATER5, (200, 228, 250) if abs(dx) > 1 else (150, 200, 240))
    fg.px(lx - 4, WATER5 + 1, (110, 160, 216)); fg.px(lx + 4, WATER5 + 1, (110, 160, 216))

cv = flatten([bg, gh, fg])

print(save(cv, '46_dragon_gate.png'))
