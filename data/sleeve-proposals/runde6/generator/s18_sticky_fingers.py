# -*- coding: utf-8 -*-
"""18 – Gegner „Flying Sparks“, Held: Lilly, the Charming Infiltrator (Base). Entwurf."""
import math, random
from c_util import *  # noqa
import numpy as np
import xcfkit as X

M, G, R = 'Motive', 'MotiveGrailWar', 'MotiveRussia'
rnd = random.Random(18)

lilly = sprite('o18_lilly', M, [973])                        # 18×25, = Sichtbar #256 (Ebene 140), 0 px Abweichung
# Sparkfly-Arbeiterin: Körper 160 + Flügel 158 (linke Biene), Königin: 177 Körper + 176 Beine + 175 Krone
body = layer(R, 160)[244:276, 82:108].copy(); wing = layer(R, 158)[244:276, 82:108].copy()
bb = bbox(X.over(body, wing)); body = body[bb[1]:bb[3], bb[0]:bb[2]]; wing = wing[bb[1]:bb[3], bb[0]:bb[2]]
queen = compose(R, [175, 176, 177])
chest = sprite('o18_chest', M, [1386])                      # Treasure Chest 24×16
hall = layer(G, 663)                                        # „Rathaus aussen“ (320×240-Karte)

# ---------- 1×: Rathaus bei Nacht ----------
cv = Canvas(250, 350)
X0, Y0 = 230, 113
bg = hall[Y0:Y0 + 240, X0:X0 + 250, :3].astype(int)
# Platz nach unten mit Pflaster der Karte verlängern (gespiegelt gekachelt)
tile = hall[300:332, 330:362, :3].astype(int)
full = np.zeros((350, 250, 3), int)
full[:240] = bg
for y in range(240, 350):
    for x in range(250):
        ty = (y - 240) % 64; ty = ty if ty < 32 else 63 - ty
        tx = x % 64; tx = tx if tx < 32 else 63 - tx
        full[y, x] = tile[ty, tx]
# Nachtfärbung: abdunkeln, nach Blau ziehen
night = (full * np.array([0.34, 0.38, 0.58]) + np.array([4, 6, 22])).clip(0, 255)
# warmes Licht aus dem offenen Giebelfenster (Innenraum x120–132, y51–60) + Lichtkegel auf der Fassade
WX, WY = 126, 56
for y in range(350):
    for x in range(250):
        d = math.hypot((x + 0.5 - WX) / 1.0, (y + 0.5 - WY) / 0.8)
        if d < 34:
            lv = int((1 - d / 34) * 3 + bayer(x, y))
            if lv: night[y, x] = [mix(tuple(int(v) for v in night[y, x]), (255, 196, 110), (0, .10, .2, .3)[min(3, lv)])][0]
win = full[51:61, 120:133]
dark = win.sum(-1) < 200
for j in range(10):
    for i in range(13):
        if dark[j, i]: night[51 + j, 120 + i] = (255, 206, 120) if j > 2 else (232, 160, 80)
cv.a[:] = night.astype(np.uint8)

# ---------- 2×: Sparkflies mit Beute ----------
p2 = rgba(125, 175)
wings2 = rgba(125, 175)
def bee(x, y, fl=False):
    b_, w_ = (flip(body), flip(wing)) if fl else (body, wing)
    put(wings2, w_, x, y); put(p2, b_, x, y)
put(p2, queen, 51, 6)                                       # Königin (mit Hive's Crown) im Fenster
# zwei Arbeiterinnen tragen die Schatztruhe zu Lilly hinab
put(p2, chest, 26, 78)
bee(20, 60); bee(36, 60)
bee(82, 44, True)                                           # eine dritte fliegt eben aus dem Fenster
blit(cv, p2, 2)
cv.paste(up(wings2, 2), 0, 0, alpha=0.7)                    # Flügel wie in den Kartenszenen durchscheinend (70 %)
cv.paste(up(p2, 2), 0, 0)                                   # Körper über die Flügel

# ---------- 5×: Lilly ----------
p5 = rgba(50, 70)
put(p5, lilly, (50 - 18) // 2, 40)
blit(cv, p5, 5)
print(save(cv, '18_sticky_fingers.png'))
