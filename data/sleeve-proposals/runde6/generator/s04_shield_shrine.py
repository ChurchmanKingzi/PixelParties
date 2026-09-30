# -*- coding: utf-8 -*-
"""04 Shield Shrine – Gegner „Bamboo Warrior“, Held: Xiong, the Bamboo Guardian (Base-Version).
Xiong hält Ehrenwache vor seinem Wappen in der Palasthalle: an der dunklen, rot lackierten Wand hängt zwischen den
roten Vorhängen der Bamboo-Shield-Karte sein Bamboo Shield, dahinter gekreuzt zwei brennende Bamboo Staffs (Cover
des Decks). Bamboo Warrior: Schild und Karten kehren aus dem Ablagestapel zurück, der Stab schlägt dann zu.

Quellen (MotiveChina.xcf):
  Ebene 5 „Xiong“: Base-Xiong mit quer gehaltenem Bambusstab (35×27), in Sichtbar #4 (Ebene 4, Kartenbild
      „Xiong, the Bamboo Guardian“, Lage 411,349) zu 100 % pixelgleich. (Nicht verwendet: 11 „Bamboo Statt #1“,
      andere Pose der Bamboo-Staff-Karte.)
  Ebene 12 „Bamboo Statt“: der brennende Bambusstab der Bamboo-Staff-Karte (einmal gespiegelt → gekreuzt).
  Ebene 3 „Bamboo Shield #1“ (rote Vorhänge) und 16 „Bamboo Shield“ aus Sichtbar #5 (Kartenbild „Bamboo Shield“),
  Ebene 26 „Palace #3“ (Ziegel, als dunkler Boden).
Selbst gezeichnet: Lackwand mit Fugen, Goldleiste, Lichtschein, Wandhaken, Abdunklung, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Wand, Vorhänge, Schild, Stäbe, Boden, Schatten – 3× (84×117)
  Xiong                                          – 5× (50×70)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'MotiveChina'
xiong = sprite('o04_xiong', B, [5])                          # Base-Xiong mit Bambusstab (35×27), = Sichtbar #4
curt = sprite('o04_curtains', B, [3])                        # rote Vorhänge der Bamboo-Shield-Karte (84×53)
shield = sprite('o04_shield', B, [16])                       # Bamboo Shield (20×25)
staff = sprite('o04_staff', B, [12])                        # brennender Bamboo Staff (62×9)
bricks = sprite('o04_bricks', B, [26])                       # braune Ziegel „Palace #3“

# ---- Ebene 1: Lackwand mit Wappen (3×, 84×117) ------------------------------------------------
W3, H3 = 84, 117
p3 = rgba(W3, H3)
FLOOR = 80
WALL = [(58, 12, 16), (70, 16, 20), (84, 20, 24)]            # dunkles Palastrot
for y in range(FLOOR):
    for x in range(W3):
        t = min(1.0, y / 70.0) * 2
        k = min(2, int(t) + (1 if t - int(t) > bayer(x, y) else 0))
        c = WALL[k]
        if x % 14 == 0: c = (44, 8, 12)                      # Fugen der Lackbretter
        p3[y, x] = list(c) + [255]
# Goldleiste am Wandfuß
for x in range(W3):
    p3[FLOOR - 3, x, :3] = (200, 150, 60); p3[FLOOR - 2, x, :3] = (120, 80, 30); p3[FLOOR - 1, x, :3] = (40, 10, 12)
# Boden: dunkle Ziegel
for y in range(FLOOR, H3):
    for x in range(W3):
        c = bricks[(y - FLOOR) % bricks.shape[0], (x + 3) % bricks.shape[1]]
        c = c[:3] if c[3] else np.array([60, 30, 18])
        f = 0.55 - 0.2 * (y - FLOOR) / (H3 - FLOOR)
        p3[y, x] = list((c * f).astype(np.uint8)) + [255]
# Lichtschein hinter dem Wappen
SCX, SCY = W3 / 2, 40
for y in range(FLOOR - 3):
    for x in range(W3):
        d = math.hypot((x + 0.5 - SCX) / 30.0, (y + 0.5 - SCY) / 30.0)
        if d < 1:
            t = (1 - d) * 2.2
            k = int(t) + (1 if t - int(t) > bayer(x, y) else 0)
            if k: p3[y, x, :3] = mix(p3[y, x, :3], (230, 150, 70), 0.14 * min(k, 2))
# gekreuzte brennende Bambusstäbe hinter dem Schild, an zwei Wandhaken
sL, sR = staff, staff[:, ::-1]
put(p3, sL, (W3 - sL.shape[1]) // 2, SCY - 4)
put(p3, sR, (W3 - sR.shape[1]) // 2, SCY - 4)
for hx in (17, 66):
    p3[SCY - 5, hx, :3] = (30, 20, 16); p3[SCY + 5, hx, :3] = (30, 20, 16)
put(p3, shield, (W3 - shield.shape[1]) // 2, SCY - shield.shape[0] // 2)
put(p3, curt, (W3 - curt.shape[1]) // 2, -24)                # Vorhänge nur als oberer Behang
# Bodenschatten unter Xiong (Füße bei 250er-y 305 → 3×-Reihe 102)
shadow_ellipse(p3, 45.6, 101.8, 15, 2.2, a=0.5)
cv = Canvas(250, 350)
blit(cv, p3, 3, -1, 0)

# ---- Ebene 2: Xiong (5×, 50×70) -------------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
XX, XY = 9, 61 - xiong.shape[0]                             # Gesichtsmitte (Sprite-x 16) → 250er-x 125
put(p5, xiong, XX, XY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '04_shield_shrine.png'))
print(preview('04_shield_shrine.png', 'bamboo', 'bamboo', 'jade'))
