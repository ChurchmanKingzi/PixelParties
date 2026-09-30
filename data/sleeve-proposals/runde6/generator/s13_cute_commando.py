# -*- coding: utf-8 -*-
"""13 – Gegner „Cute Commando“ (sample-Structure Deck Cute Commando), Held: Cute Annoyance Mini (Base).
Entwurf 2.
"""
import math, random
from c_util import *  # noqa
import numpy as np

B = 'MotiveMoe'
rnd = random.Random(13)

mini = sprite('o13_mini', B, [497, 498])                       # 34×25 Base-Mini
bunnies = parts(compose(B, [429]), dil=1)
bunny = [p for p in bunnies if p.shape == (18, 36, 4)][0]      # frontal fliegender Cute Bunny
cats = parts(compose(B, [492]), dil=1)
cat = [p for p in cats if p.shape[1] == 23][0]                 # frontal fliegende Cute Cat
phoenix = sprite('o13_phoenix', B, [420])                      # 36×32 Cute Phoenix im Sturzflug
relic = sprite('o13_relic', B, [478])                          # 240×240 „Relic-Insel“ (Cute-Phoenix-Karte)
sky = layer(B, 553)[200:550, 150:400].copy()                     # Moe-Himmel mit Schleierwölkchen

# ---------- 1×: Himmel, Relic-Insel, Feuersäule, Phoenix ----------
cv = Canvas(250, 350)
cv.a[:] = sky[..., :3]
PX = 172                     # Achse der Feuersäule
IX, IY = PX - 105, 196       # Relic-Insel so, dass der Altar (x250,y152 in der Ebene) unter der Säule liegt
p1 = rgba(250, 350)
put(p1, relic, IX, IY)
# warmer Schein der Säule auf dem Himmel: zwei geditherte Stufen, nach außen auslaufend
for y in range(350):
    for x in range(250):
        d = abs(x + 0.5 - PX)
        fade = 1.0 if y < 250 else max(0.0, 1 - (y - 250) / 30)
        g = max(0.0, 1 - d / 64) ** 1.5 * fade
        if g <= 0: continue
        c = tuple(int(v) for v in cv.a[y, x])
        lv = int(g * 3 + bayer(x, y))          # 0..3 Stufen, geordnet gedithert
        if lv: cv.a[y, x] = mix(c, (255, 196, 128), (0.0, 0.16, 0.32, 0.48)[min(3, lv)])
FL = [(255, 250, 214), (255, 226, 92), (252, 168, 40), (232, 96, 28), (184, 44, 30)]
colw = [rnd.uniform(-1.5, 1.5) for _ in range(40)]
for y in range(0, 262):
    for x in range(PX - 18, PX + 19):
        d = abs(x + 0.5 - PX)
        w = 14 + colw[(y // 5) % 40] + 1.5 * math.sin(y / 7.0 + x)
        if d > w: continue
        t = d / w
        k = 0 if t < 0.25 else 1 if t < 0.5 else 2 if t < 0.72 else 3 if t < 0.9 else 4
        # senkrechte Flammenzungen: in jeder 3. Spalte eine Stufe dunkler
        if (x % 3 == 0) and k < 4 and ((y + x * 5) // 6) % 2: k += 1
        p1[y, x] = list(FL[k]) + [255]
# Lichtschein auf dem Platz der Relic-Insel (nur auf Inselpixeln, gedithert)
AX, AY = PX, IY + 152 - 82 - 6
for y in range(AY - 26, AY + 26):
    for x in range(PX - 44, PX + 45):
        if not (0 <= y < 350 and 0 <= x < 250) or p1[y, x, 3] == 0: continue
        e = math.hypot((x + 0.5 - AX) / 44, (y + 0.5 - AY) / 24)
        if e < 1 and (1 - e) > bayer(x, y) * 0.9:
            c = tuple(int(v) for v in p1[y, x, :3])
            p1[y, x, :3] = mix(c, (255, 196, 110), 0.38 if e < 0.55 else 0.2)
put(p1, phoenix, PX - 18, AY - 26)
blit(cv, p1, 1)

# ---------- 2×: Kommando ----------
p2 = rgba(125, 175)
put(p2, bunny, 13, 104); put(p2, cat, 24, 134)
blit(cv, p2, 2)

# ---------- 5×: Mini ----------
p5 = rgba(50, 70)
put(p5, mini, 5, 12)
blit(cv, p5, 5)
print(save(cv, '13_cute_commando.png'))
