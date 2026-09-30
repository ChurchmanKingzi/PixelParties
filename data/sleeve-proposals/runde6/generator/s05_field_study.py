# -*- coding: utf-8 -*-
"""05 Field Study – Gegner „Big Stomp!“, Held: Kit, the Shark Researcher (Base-Version).
Big Stomp!: Abends am Waldrand der Gigantisaurier-Insel steht Kit, der Hai-Forscher, auf der Wiese und folgt einer
Fährte aus dreizehigen Trittsiegeln – hinter ihm ragt über den Baumwipfeln schon die schwarze Silhouette des T-Rex
(Gigantisaur King Trex) vor dem Abendhimmel auf, das Maul weit aufgerissen über ihm.
Einheitliche Seitenansicht: Himmel mit Horizont, Baumsilhouetten am Waldrand, Wiese im Vordergrund.

Quellen:
  MotiveDeepsea.xcf Ebene 38 „Ebene #49“ (Hut) + 39 „Kit-Kopie“ (= Kartenbild „Kit, the Shark Researcher“,
      Sichtbar #37 Lage 305,192, sitzend hinter einem Stuhl, offener Mund); ab der Hüfte die stehenden Beine aus
      Ebene 40 „Kit“ (im Kartenbild vom Stuhl verdeckt).
  MotiveGrailWar.xcf Ebene 513 „Trex“ (80×59, Kartenbild „Gigantisaur King Trex“) – gespiegelt, als schwarze
      Silhouette.
  MotiveGrailWar.xcf Ebene 515 „Ebene #153“ (Inselkarte der Gigantisaurier-Karten): Graskachel 16×16 der Lichtung.
Selbst gezeichnet: Abendhimmel, Baumsilhouetten des Waldrands, dreizehige Trittsiegel, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Himmel, T-Rex-Silhouette, Waldrand, Wiese, Trittsiegel, Schatten – 2× (125×175)
  Kit                                                             – 5× (50×70)
"""
import math, random
from a_util import *  # noqa
import numpy as np

rnd = random.Random(5)
# Base-Kit: Hut (38) + „Kit-Kopie“ (39, sitzend, = Kartenbild Sichtbar #37 inkl. offenem Mund) – für den
# stehenden Kit werden ab der Hüfte (Zeile 18 des Ausschnitts) die Beine aus „Kit“ (40, stehend) genommen;
# im Kartenbild verdeckt der Stuhl diese Zeilen.
_k39 = compose('MotiveDeepsea', [38, 39], crop=False)[205:233, 322:347]
_k40 = compose('MotiveDeepsea', [38, 40], crop=False)[205:233, 322:347]
_kit = _k39.copy(); _kit[18:] = _k40[18:]
kit_ = trimmed(_kit)
trex = sprite('o05_trex', 'MotiveGrailWar', [513])            # Gigantisaur King Trex (80×59)
grass = compose('MotiveGrailWar', [515], crop=False)[322:338, 88:104].copy()   # Graskachel (16×16)

# ---- Ebene 1: Abendhimmel, T-Rex-Silhouette, Waldrand, Wiese (2×, 125×175) ----------------------
W2, H2 = 125, 175
p2 = rgba(W2, H2)
HOR = 100                                                     # Horizont/Waldrand (2×-Raster)
SKY = [(36, 26, 64), (62, 34, 84), (104, 46, 90), (158, 66, 80), (212, 106, 70), (242, 158, 82), (250, 204, 120)]
for y in range(HOR + 6):
    t = min(1, y / (HOR + 2)) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t)); f = t - i
    for x in range(W2):
        p2[y, x] = list(SKY[i + 1] if f > bayer(x, y) else SKY[i]) + [255]
# T-Rex als schwarze Silhouette vor dem Himmel (gespiegelt: Maul nach links, über Kit)
sil = silhouette(trex[:, ::-1], (22, 12, 20))
TX, TY = 36, HOR + 8 - trex.shape[0]
put(p2, sil, TX, TY)
# Waldrand: Nadelbaum-Silhouetten (selbst gezeichnet), verdecken die Beine des T-Rex
TREE, TREE2 = (18, 26, 22), (28, 38, 30)
def conifer(cx, base, h, col):
    for k in range(h):
        y = base - k
        half = int((h - k) * 0.42) + (1 if (k % 3 == 0 and k < h - 2) else 0)
        for x in range(cx - half, cx + half + 1):
            if 0 <= x < W2 and 0 <= y < H2: p2[y, x] = list(col) + [255]
x = -4
while x < W2 + 6:
    h = rnd.randint(12, 22)
    conifer(x, HOR + 6, h, TREE2)
    x += rnd.randint(6, 9)
x = -1
while x < W2 + 6:
    h = rnd.randint(8, 15)
    conifer(x, HOR + 8, h, TREE)
    x += rnd.randint(5, 8)
# Wiese: Graskachel der Insel, abendlich abgedunkelt, nach vorn heller
for y in range(HOR + 8, H2):
    for x in range(W2):
        c = grass[(y - HOR) % 16, x % 16, :3].astype(float)
        d = (y - HOR - 8) / (H2 - HOR - 8)
        c = c * np.array([0.78, 0.64, 0.58]) * (0.55 + 0.35 * d)
        p2[y, x] = list(np.clip(c, 0, 255).astype(np.uint8)) + [255]
# dreizehige Trittsiegel des T-Rex quer über die Wiese (Zehen zeigen zum Wald)
MUD, MUD2 = (40, 38, 16), (26, 24, 10)
def footprint(cx, cy):
    for (dx, dy) in [(0, -1), (0, -2), (0, -3), (-1, -1), (-2, -2), (1, -1), (2, -2), (-2, 1), (2, 1)]:
        p2[cy + dy, cx + dx, :3] = MUD
    for (dx, dy) in [(0, 0), (1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1), (0, 2)]:
        p2[cy + dy, cx + dx, :3] = MUD2
for (x, y) in [(100, 166), (88, 152), (100, 139), (90, 127), (100, 117)]:
    footprint(x, y)
# Bodenschatten unter Kit (Füße bei 250er-y 305 → 2×-Reihe 152)
shadow_ellipse(p2, 62.5 - 3, 152.5, 13, 2.4, a=0.45)
cv = Canvas(250, 350)
blit(cv, p2, 2)

# ---- Ebene 2: Kit (5×, 50×70) ---------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
KX, KY = (W5 - kit_.shape[1]) // 2 - 1, 61 - kit_.shape[0]
put(p5, kit_, KX, KY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '05_field_study.png'))
print(preview('05_field_study.png', 'wave', 'wood', 'amber'))
