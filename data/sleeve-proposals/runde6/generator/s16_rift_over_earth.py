# -*- coding: utf-8 -*-
"""16 – Gegner „Depths of the Cosmos“, Held: Argos, the Eye of the Cosmos (Base). Entwurf."""
import math, random
from c_util import *  # noqa
import numpy as np

B = 'MotiveBoons'
rnd = random.Random(16)
argos = sprite('o16_argos', B, [38])                                   # 23×54
anal = [p for p in parts(compose(B, [34]), dil=1) if p.shape == (17, 18, 4)][0]   # Analyzer-Sichelschiff
search = parts(compose(B, [22]), dil=1)[0]                             # Life-Searcher 19×34
beam = [p for p in parts(compose(B, [23]), dil=1) if p.shape[0] == 29][0]        # grüner Suchstrahl 9×29
gath = parts(compose(B, [28]), dil=1)[0]                               # Gatherer 30×33
bg = layer(B, 80)
earth = disc(bg[..., :3], 280, 325, 50)                                # Erdkugel (Hintergrund der Kosmos-Szenen)

# ---------- 1×: All, Sterne, Erde ----------
cv = Canvas(250, 350)
SP = [(4, 4, 22), (6, 8, 34), (10, 12, 48), (14, 18, 64), (18, 24, 78)]
for y in range(350):
    for x in range(250):
        cv.a[y, x] = grad_pick(SP, 0.2 + 0.6 * math.hypot((x - 125) / 250, (y - 140) / 350) * -1 + 0.6, x, y)
for _ in range(90):
    x, y = rnd.randrange(250), rnd.randrange(350)
    cv.a[y, x] = rnd.choice([(200, 210, 255), (120, 130, 200), (255, 255, 255)])
for _ in range(7):
    x, y = rnd.randrange(8, 242), rnd.randrange(8, 342)
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): cv.px(x + dx, y + dy, (170, 190, 255) if (dx or dy) else (255, 255, 255))
EX, EY = 184, 282
p1 = rgba(250, 350)
put(p1, earth, EX - 50, EY - 50)
blit(cv, p1, 1)

# ---------- 2×: Flotte (strömt aus dem Auge zur Erde) ----------
p2 = rgba(125, 175)
# dunkelroter Schein um das Auge (im 2×-Raster hinter der Flotte), außen gedithert
ECX, ECY = (6 + 11.5) * 2, (5 + 27) * 2          # Augenmitte im 2×-Raster
for y in range(175):
    for x in range(125):
        d = math.hypot((x + 0.5 - ECX) / 34, (y + 0.5 - ECY) / 62)
        if 0.34 < d < 1:                            # nicht in die offene Pupille
            lv = int((1 - d) * 3 + bayer(x, y))
            if lv:
                c = tuple(int(v) for v in cv.a[min(349, y * 2), min(249, x * 2)])
                p2[y, x] = list(mix(c, (110, 14, 34), (0, 0.18, 0.32, 0.45)[min(3, lv)])) + [255]
for (x, y) in [(58, 34), (74, 52), (64, 70)]:          # Analyzer (Sichelschiffe) fliegen nach rechts unten
    put(p2, anal, x, y)
SX, SY = 80, 84                                          # Life-Searcher über der Erde
put(p2, search, SX, SY)
put(p2, gath, 10, 118)                                   # Gatherer mit Asteroiden unten links
rocks = parts(compose(B, [29]), dil=1)
for r_, (x, y) in zip(rocks, [(46, 128), (8, 152), (42, 150)]):
    put(p2, r_, x, y)
blit(cv, p2, 2)
# grüner Suchstrahl (halbtransparent, ganze 2×-Pixel)
cv.paste(up(beam, 2), (SX + 5) * 2, (SY + 32) * 2, alpha=0.45)

# ---------- 4×: Argos ----------
p4 = rgba(63, 88)
AX, AY = 6, 5
put(p4, argos, AX, AY)
blit(cv, p4, 4)
print(save(cv, '16_rift_over_earth.png'))
