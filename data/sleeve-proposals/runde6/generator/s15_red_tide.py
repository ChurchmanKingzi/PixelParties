# -*- coding: utf-8 -*-
"""15 „Red Tide“ – Gegner „Deepsea Terror“, Held: Siphem, the Deepsea Demon (Base).

Bildidee (Porträt von unten, Heerführer): Siphem schwebt mit ausgebreiteten Flügeln im roten Licht, das von rechts oben
durch das Wasser fällt (wie in seinem Kartenbild); unten auf dem dunklen Meeresgrund zwischen zwei Deepsea
Monstrosities (Totholz-Korallen mit roten Adern) stehen Deepsea Witch, Deepsea Werewolf und Deepsea Pirate und blicken
zu ihm auf. Aus jeder Kreatur steigt eine Kette roter Blasen zu ihm – seine Deepsea Counters (Leadership/Decay Magic:
zurückgeholte Kreaturen werden zu Countern). Kein Schloss, kein Cthulhu (≠ Deepsea Awakening/Count of the Deep).

Quellen (MotiveDeepsea.xcf):
  Siphem (Base)   = Ebene 301 „Siphem“ + rotes Randlicht Ebene 300 „Siphem #1“, wie in Sichtbar #107 (Ebene 34,
                    Karte „Siphem“, Lage 245,277) mit ca. 25 % Deckkraft nur auf Siphems Pixeln gemischt
                    (per Farbvergleich mit der Szene bestimmt; die Szenen-Gesamtabdunklung ×0,72 entfällt)
  Deepsea Witch   = Ebene 309 „Witch #1“;  Deepsea Werewolf = Ebene 329 „Werewolf“
  Deepsea Pirate  = Ebene 310 „Pirate“ (nur die Figur x270–295, ohne den Klumpen rechts), gespiegelt
  Deepsea Monstrosity = Ebene 339 „Monstrosity“ (links, rechts gespiegelt)
Selbst gezeichnet: Wasserverlauf (rot oben → Tiefseeblau), Lichtbahnen, Meeresgrund, Counter-Blasen.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Wasser, Lichtbahnen                               – 1×
  Meeresgrund, Kreaturen, Blasen                    – 2× (125×175)
  Siphem                                            – 5× (50×70)
"""
import math, random
from c_util import *  # noqa
import numpy as np

D = 'MotiveDeepsea'
rnd = random.Random(15)

# Siphem (Base) = Ebene 301 „Siphem“ + rotes Randlicht 300 „Siphem #1“ (in Sichtbar #107 mit ~25 % Deckkraft)
sip = layer(D, 301).copy(); red = layer(D, 300)
m = (sip[..., 3] > 0) & (red[..., 3] > 0)
sip[m, :3] = (sip[m, :3] * 0.75 + np.array([255, 0, 14]) * 0.25).astype(np.uint8)
b = bbox(sip); siphem = sip[b[1]:b[3], b[0]:b[2]]                      # 36×31

def P(i, box=None):
    a = compose(D, [i], crop=False)
    if box: x0, y0, x1, y1 = box; a = a[y0:y1, x0:x1]
    bb = bbox(a); return a[bb[1]:bb[3], bb[0]:bb[2]]

mummy = P(304); witch = P(309); pirate = P(310, (270, 290, 295, 335)); wolf = P(329)
monst = P(339, (190, 265, 240, 325)); prim = P(317); bat = P(346, (90, 200, 116, 216))
print('siphem', siphem.shape, 'pirate', pirate.shape, 'monst', monst.shape, 'bat', bat.shape)

# ---------- 1×: Wasser mit rotem Licht von oben ----------
cv = Canvas(250, 350)
WAT = [(92, 22, 34), (70, 22, 40), (48, 22, 48), (30, 26, 58), (20, 30, 62), (14, 26, 52), (10, 20, 40), (8, 14, 30)]
for y in range(350):
    for x in range(250):
        t = y / 330 - 0.12 * (x / 250)          # rechts oben etwas heller (Lichtquelle)
        cv.a[y, x] = grad_pick(WAT, t, x, y)
# Lichtbahnen von rechts oben (schräg, gedithert, nach unten auslaufend)
for (x0, w) in [(150, 14), (196, 10), (238, 16), (110, 7)]:
    for y in range(0, 300):
        cx = x0 - y * 0.45
        for x in range(int(cx - w), int(cx + w) + 1):
            if not 0 <= x < 250: continue
            f = (1 - abs(x + 0.5 - cx) / w) * max(0, 1 - y / 300)
            if f > bayer(x, y) * 1.2 + 0.15:
                cv.a[y, x] = mix(tuple(int(v) for v in cv.a[y, x]), (200, 60, 70), 0.22)

# ---------- 2×: Meeresgrund, Armee, Counter-Blasen, Fledermäuse ----------
p2 = rgba(125, 175)
GR = [(26, 26, 44), (20, 20, 36), (14, 14, 28)]
GY = 150
for x in range(125):
    h = GY + int(2 * math.sin(x / 9.0) + 1.2 * math.sin(x / 3.1))
    for y in range(h, 175):
        p2[y, x] = list(grad_pick(GR, (y - h) / 20, x, y)) + [255]
    if p2[h, x, 3]: p2[h, x, :3] = (40, 40, 66)
def stand(s, cx, fl=False):
    s = flip(s) if fl else s
    x = int(cx - s.shape[1] / 2); y = GY + 3 - s.shape[0]
    put(p2, s, x, y); return (x + s.shape[1] // 2, y)
heads = []
put(p2, monst, -9, GY + 6 - monst.shape[0]); put(p2, flip(monst), 125 + 9 - monst.shape[1], GY + 6 - monst.shape[0])
heads.append(stand(witch, 40)); heads.append(stand(wolf, 62)); heads.append(stand(pirate, 85, True))
# Deepsea Counter: je Kreatur eine Kette kleiner roter Blasen, die senkrecht zu Siphem aufsteigt
BUB = [(255, 150, 150), (214, 40, 52), (120, 14, 30)]
def bubble(x, y, r):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            d = math.hypot(i, j)
            if d <= r + 0.35 and 0 <= x + i < 125 and 0 <= y + j < 175:
                c = BUB[2] if d > r - 0.6 else BUB[1]
                p2[y + j, x + i] = list(c) + [255]
    if r >= 1: p2[y - 1, x - 1] = list(BUB[0]) + [255] if r > 1 else p2[y - 1, x - 1]
for n, (hx, hy) in enumerate(heads):
    y = hy - 5
    k = 0
    while y > 92:
        x = hx + (62 - hx) * (hy - 5 - y) / 90 + (1 if k % 2 else -1) * (n != 1)
        bubble(int(round(x)), y, 2 if k % 3 == 2 else 1)
        y -= 7 + k; k += 1
blit(cv, p2, 2)

# ---------- 5×: Siphem ----------
p5 = rgba(50, 70)
put(p5, siphem, (50 - 36) // 2, 7)
blit(cv, p5, 5)
print(save(cv, '15_red_tide.png'))
