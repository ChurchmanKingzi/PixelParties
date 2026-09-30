# -*- coding: utf-8 -*-
"""04 Shield Shrine – Gegner „Bamboo Warrior“, Held: Xiong, the Bamboo Guardian (Base-Version).
(Docstring wird nach Fertigstellung ergänzt.)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'MotiveChina'
xiong = sprite('o04_xiong', B, [5])                          # Base-Xiong mit Bambusstab (35×27), = Sichtbar #4
curt = sprite('o04_curtains', B, [3])                        # rote Vorhänge der Bamboo-Shield-Karte (84×53)
shield = sprite('o04_shield', B, [16])                       # Bamboo Shield (20×25)
throne = sprite('o04_throne', B, [15])                       # steinerner Thron „Palace“ (34×34)
relief = compose(B, [24], crop=False)                        # Drachenrelief-Paneele „Palace #4“
bricks = sprite('o04_bricks', B, [26])                       # braune Ziegel „Palace #3“

# ---- Ebene 1: Schrein (3×, 84×117) ----------------------------------------------------------
W3, H3 = 84, 117
p3 = rgba(W3, H3)
# Wand aus Drachenreliefs: die 3×2 Paneele der Karte, mittig, senkrecht wiederholt
rb = bbox(relief); R = relief[rb[1]:rb[3], rb[0]:rb[2]]
R = R[:, -97:] if R.shape[1] > 97 else R                     # nur der Paneelblock (ohne losen Ziegel links)
for y in range(0, 90):
    for x in range(W3):
        p3[y, x] = [70, 46, 26, 255]
ox = (W3 - R.shape[1]) // 2
for oy in (-20, R.shape[0] - 20 - 2):
    put(p3, R, ox, oy)
FLOOR = 80
# Boden: braune Ziegel, gekachelt
bt = bricks
for y in range(FLOOR, H3):
    for x in range(W3):
        c = bt[(y - FLOOR) % bt.shape[0], (x + 3) % bt.shape[1]]
        p3[y, x] = c if c[3] else [60, 30, 18, 255]
# Schatten der Wand auf den Boden (Fußleiste)
for x in range(W3):
    p3[FLOOR, x, :3] = (40, 22, 14)
# Thron, darüber der Bamboo Shield, oben die Vorhänge (wie im Kartenbild)
# Wand und Boden abdunkeln (Schild, Vorhänge und Xiong sollen leuchten)
p3[:FLOOR, :, :3] = (p3[:FLOOR, :, :3] * 0.58).astype(np.uint8)
for y in range(FLOOR, H3):
    p3[y, :, :3] = (p3[y, :, :3] * (0.62 - 0.18 * (y - FLOOR) / (H3 - FLOOR))).astype(np.uint8)
# Bamboo Shield an der Wand zwischen den Vorhängen (wie im Kartenbild), mit schwachem Lichtschein
SX, SY = (W3 - shield.shape[1]) // 2, 22
for y in range(H3):
    for x in range(W3):
        d = math.hypot((x + 0.5 - W3 / 2) / 20.0, (y + 0.5 - (SY + 12)) / 22.0)
        if d < 1 and (1 - d) * 2 > bayer(x, y):
            p3[y, x, :3] = mix(p3[y, x, :3], (230, 190, 110), 0.25)
put(p3, shield, SX, SY)
put(p3, curt, (W3 - curt.shape[1]) // 2, 0)
# warmes Halbdunkel: Ränder abdunkeln
for y in range(H3):
    for x in range(W3):
        d = math.hypot((x + 0.5 - W3 / 2) / (W3 / 2), (y + 0.5 - 50) / 70)
        t = max(0, d - 0.5) / 0.6 * 3
        k = int(t) + (1 if t - int(t) > bayer(x, y) else 0)
        if k: p3[y, x, :3] = (p3[y, x, :3] * (1 - 0.16 * min(k, 3))).astype(np.uint8)
cv = Canvas(250, 350)
blit(cv, p3, 3, -1, 0)

# ---- Ebene 2: Xiong (5×, 50×70) -------------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
XX, XY = (W5 - xiong.shape[1]) // 2, 61 - xiong.shape[0]
s5 = rgba(W5, H5)
shadow_ellipse(s5, W5 / 2, 61, 10, 1.6, a=1.0)
put(p5, xiong, XX, XY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '04_shield_shrine.png'))
print(preview('04_shield_shrine.png', 'bamboo', 'bamboo', 'jade'))
