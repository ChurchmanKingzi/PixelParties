# -*- coding: utf-8 -*-
"""18 Autumn Tiger – Baihu, die weiße Tiger-Kardinalsbestie des Westens, steht frontal brüllend auf einem
Felsgrat; hinter ihr glüht ein goldener Herbstabend über gestaffelten Bergkämmen mit rotem Laubwald,
ein Band aus Ahornlaub wirbelt im Westwind an ihr vorbei.

Quellen (MotiveGrailWar.xcf):
  Ebene 7 „Baihu #1“ – Baihu (Karte „Cardinal Beast Baihu“, geprüft gegen Sichtbar #180: vollständig)
Selbst gezeichnet: Himmel, Abendglühen, Wolkenbänder, drei Bergkämme mit Herbstwald, Felsgrat,
Laubwirbel, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Wolken, Bergkämme, Laub hinten) – 2×-Raster (125×175)
  Vordergrund (Felsgrat, Baihu, Schatten, Laub vorne)   – 4×-Raster (63×88)
"""
import random
from dkit16_20 import *  # noqa

B = 'MotiveGrailWar'
rnd = random.Random(18)
baihu = sprite('d18_baihu', B, [7])            # 48×40

# ---------------- Hintergrund 2× ---------------------------------------------------------
bw, bh = grid(2)                                # 125×175
bg = Canvas(bw, bh)
bands(bg, 0, 122, [(62, 42, 96), (90, 52, 104), (128, 64, 102), (168, 80, 94), (204, 104, 82), (232, 140, 76), (246, 178, 90), (252, 212, 128)], soft=0.45)
bg.a[120:] = (252, 214, 128)
# Abendglühen über dem fernen Kamm (links der Mitte, hinter Baihus Schulter)
glow(bg, 44, 112, 60, (255, 236, 170), 0.55, ry=34)
# flache Wolkenbänder
for (cx, cy, L, col) in [(28, 38, 30, (196, 98, 104)), (96, 30, 26, (176, 86, 108)), (80, 64, 34, (232, 140, 92)),
                         (20, 78, 22, (240, 160, 96))]:
    for x in range(int(cx - L / 2), int(cx + L / 2)):
        t = abs(x - cx) / (L / 2)
        th = 2 if t < 0.6 else 1
        for y in range(cy, cy + th): bg.px(x, y, col)
        if t < 0.3: bg.px(x, cy - 1, col)


def ridge(base, amp, freq, ph, col, tree_col=None, seed=0):
    r = random.Random(seed)
    tops = []
    for x in range(bw):
        h = base - amp * (0.6 * math.sin(x * freq + ph) + 0.4 * math.sin(x * freq * 2.3 + ph * 1.7))
        tops.append(int(h))
    for x in range(bw):
        for y in range(tops[x], bh): bg.a[y, x] = col
    if tree_col:                                 # Laubwald: kleine Kronenbögel entlang der Kante
        x = 0
        while x < bw:
            w = r.choice((3, 4, 5))
            c = tree_col[r.randrange(len(tree_col))]
            top = min(tops[min(bw - 1, x + i)] for i in range(w)) - r.choice((1, 2))
            for i in range(w):
                xx = x + i
                if xx >= bw: break
                hump = top + (1 if i in (0, w - 1) else 0)
                for y in range(hump, tops[xx] + 3): bg.a[y, xx] = c
            x += w - 1
    return tops


ridge(118, 10, 0.045, 0.8, (150, 88, 110))                                           # ferner Kamm
ridge(132, 8, 0.07, 2.2, (118, 54, 74), [(150, 60, 62), (170, 84, 60), (132, 50, 70)], 1)
ridge(146, 7, 0.09, 4.0, (80, 34, 52), [(170, 50, 40), (196, 92, 40), (120, 36, 44), (150, 60, 36)], 2)
# Dunst zwischen den Kämmen
shade(bg, lambda x, y: 0.25 if 121 <= y < 127 else 0, col=(250, 200, 140))

# Zugvögel: ein Keil Wildgänse zieht nach Westen (selbst gezeichnet, je ein kleiner Flügelwinkel)
GOOSE = (60, 34, 66)
birds = [(66, 24)] + [(66 + 6 * k, 24 + 2 * k) for k in (1, 2, 3)] + [(66 + 5 * k, 24 + 5 * k) for k in (1, 2)]
for gx, gy in birds:
    for dx, dy in ((-2, -1), (-1, 0), (0, 0), (1, 0), (2, -1)):
        bg.px(gx + dx, gy + dy, GOOSE)

# ---------------- Vordergrund 4× ---------------------------------------------------------
fw, fh = grid(4)                                 # 63×88
fg = rgba(fw, fh)
GY = 76                                          # Felskante (Zelle) = Baihus Fußlinie
ROCK = [(62, 40, 52), (88, 58, 66), (118, 82, 78), (150, 110, 92), (40, 24, 38)]
tops = []
for x in range(fw):
    t = GY + int(1.6 * math.sin(x * 0.35) + 1.2 * math.sin(x * 0.9 + 1) + abs(x - 31) * 0.12)
    tops.append(t)
for x in range(fw):
    for y in range(tops[x], fh):
        d = y - tops[x]
        c = ROCK[2] if d == 0 else ROCK[1] if d < 3 else ROCK[0]
        if d > 0 and (x * 5 + y * 3) % 13 == 0: c = ROCK[4]
        if d == 1 and (x % 4 == 1): c = ROCK[3]
        fg[y, x] = list(c) + [255]
# Risse im Fels
for sx, sy, n in [(8, 80, 5), (22, 82, 4), (44, 81, 5), (56, 79, 4)]:
    x, y = sx, sy
    for _ in range(n):
        if 0 <= x < fw and y < fh: fg[y, x] = list(ROCK[4]) + [255]
        y += 1; x += rnd.choice((-1, 0, 1))

bx = (fw - baihu.shape[1]) // 2
by = GY + 1 - baihu.shape[0]
ellipse_shadow(fg, fw / 2, GY + 1, 19, 2.2, (30, 14, 30), 255)
put(fg, baihu, bx, by)

# ---------------- Laubwirbel (Westwind, von links unten nach rechts oben) ------------------
LEAF = [(214, 64, 36), (236, 128, 40), (248, 190, 64), (180, 44, 40)]


def leaf(arr_or_cv, x, y, c, rot):
    """Ahornblatt als 3×3-Kreuz mit dunklem Stiel (selbst gezeichnet)."""
    pts = [(0, 0), (-1, 0), (1, 0), (0, -1)] if rot == 0 else [(0, 0), (0, 1), (-1, 0), (1, -1)]
    dark = tuple(int(v * 0.6) for v in c)
    for dx, dy in pts:
        if hasattr(arr_or_cv, 'px'): arr_or_cv.px(x + dx, y + dy, c)
        else:
            if 0 <= x + dx < arr_or_cv.shape[1] and 0 <= y + dy < arr_or_cv.shape[0]:
                arr_or_cv[y + dy, x + dx] = list(c) + [255]
    sx, sy = x + (1 if rot == 0 else -1), y + 1
    if hasattr(arr_or_cv, 'px'): arr_or_cv.px(sx, sy, dark)
    elif 0 <= sx < arr_or_cv.shape[1] and 0 <= sy < arr_or_cv.shape[0]: arr_or_cv[sy, sx] = list(dark) + [255]


# hinten (2×): kleine Blätter entlang einer Bogenbahn
for i, t in enumerate([0.05, 0.14, 0.22, 0.33, 0.45, 0.58, 0.7, 0.83, 0.93]):
    x = int(8 + t * 110); y = int(150 - t * 120 - 18 * math.sin(t * math.pi))
    leaf(bg, x + rnd.randint(-2, 2), y + rnd.randint(-2, 2), LEAF[i % 4], i % 2)
# vorne (4×): wenige große Blätter
for i, (x, y) in enumerate([(5, 62), (57, 20), (9, 30), (53, 58)]):
    leaf(fg, x, y, LEAF[(i + 1) % 4], i % 2)

vignette(bg, 0.25, 0.7)
cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 4, ox=1, oy=1)
print(save(cv, '18_autumn_tiger.png'))
