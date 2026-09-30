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
  MotiveGrailWar.xcf Ebene 513 „Trex“ + 512 „Ebene #335“ (Flammenkrone; zusammen 80×68 = Kartenbild
      „Gigantisaur King Trex“) – gespiegelt, der Körper als schwarze Silhouette, die Krone in ihren Farben.
  MotiveGrailWar.xcf Ebene 515 „Ebene #153“ (Inselkarte der Gigantisaurier-Karten): Graskachel 16×16 der Lichtung.
Selbst gezeichnet: Abendhimmel, Baumsilhouetten des Waldrands, dreizehige Trittsiegel, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Himmel, T-Rex-Silhouette mit Krone, Waldrand, Wiese, Trittsiegel, Schatten – 3× (84×117)
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
_all = compose('MotiveGrailWar', [512, 513], crop=False)      # Gigantisaur King Trex (513) mit Flammenkrone (512)
_cr = compose('MotiveGrailWar', [512], crop=False)
_b = bbox(_all)
trex = _all[_b[1]:_b[3], _b[0]:_b[2]].copy()                  # 80×68
is_crown = _cr[_b[1]:_b[3], _b[0]:_b[2], 3] > 0
grass = compose('MotiveGrailWar', [515], crop=False)[340:356, 92:108].copy()   # Graskachel der Lichtung (16×16)

# ---- Ebene 1: Abendhimmel, T-Rex-Silhouette, Waldrand, Wiese (3×, 84×117) ----------------------
W3, H3 = 84, 117
p3 = rgba(W3, H3)
HOR = 68                                                      # Horizont/Waldrand (3×-Raster)
SKY = [(36, 26, 64), (62, 34, 84), (104, 46, 90), (158, 66, 80), (212, 106, 70), (242, 158, 82), (250, 204, 120)]
for y in range(HOR + 6):
    t = min(1, y / (HOR + 2)) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t)); f = t - i
    for x in range(W3):
        p3[y, x] = list(SKY[i + 1] if f > bayer(x, y) else SKY[i]) + [255]
# T-Rex als schwarze Silhouette vor dem Himmel (gespiegelt: Maul nach links über Kit); seine Flammenkrone
# behält ihre Farben und glüht vor dem Abendhimmel
tr = trex[:, ::-1]; ic = is_crown[:, ::-1]
sil = silhouette(tr, (22, 12, 20))
sil[ic & (tr[..., 3] > 0)] = tr[ic & (tr[..., 3] > 0)]
TX, TY = 8, HOR + 10 - tr.shape[0]                           # Maul ganz im Bild, Schwanz läuft rechts hinaus
put(p3, sil, TX, TY)
# Waldrand: Nadelbaum-Silhouetten (selbst gezeichnet), verdecken die Beine des T-Rex
TREE, TREE2 = (18, 26, 22), (28, 38, 30)
def conifer(cx, base, h, col):
    for k in range(h):
        y = base - k
        half = int((h - k) * 0.42) + (1 if (k % 3 == 0 and k < h - 2) else 0)
        for x in range(cx - half, cx + half + 1):
            if 0 <= x < W3 and 0 <= y < H3: p3[y, x] = list(col) + [255]
x = -4
while x < W3 + 6:
    conifer(x, HOR + 5, rnd.randint(9, 15), TREE2)
    x += rnd.randint(5, 7)
x = -1
while x < W3 + 6:
    conifer(x, HOR + 7, rnd.randint(6, 10), TREE)
    x += rnd.randint(4, 6)
# Wiese: Graskachel der Insel, abendlich abgedunkelt, nach vorn heller
for y in range(HOR + 7, H3):
    for x in range(W3):
        c = grass[(y - HOR) % 16, x % 16, :3].astype(float)
        d = (y - HOR - 7) / (H3 - HOR - 7)
        c = c * np.array([0.78, 0.64, 0.58]) * (0.55 + 0.35 * d)
        p3[y, x] = list(np.clip(c, 0, 255).astype(np.uint8)) + [255]
# dreizehige Trittsiegel des T-Rex quer über die Wiese (Zehen zeigen zum Wald)
MUD, MUD2 = (46, 40, 18), (28, 24, 10)
def footprint(cx, cy):
    for (dx, dy) in [(0, -1), (0, -2), (0, -3), (-1, -1), (-2, -2), (1, -1), (2, -2), (-2, 1), (2, 1)]:
        p3[cy + dy, cx + dx, :3] = MUD
    for (dx, dy) in [(0, 0), (1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1), (0, 2)]:
        p3[cy + dy, cx + dx, :3] = MUD2
for (x, y) in [(68, 110), (60, 101), (68, 92), (61, 83)]:
    footprint(x, y)
# Bodenschatten unter Kit (Füße bei 250er-y 305 → 3×-Reihe 102)
shadow_ellipse(p3, 41.5, 101.8, 9, 1.6, a=0.45)
cv = Canvas(250, 350)
blit(cv, p3, 3, -1, 0)

# ---- Ebene 2: Kit (5×, 50×70) ---------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
KX, KY = (W5 - kit_.shape[1]) // 2, 61 - kit_.shape[0]
put(p5, kit_, KX, KY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '05_field_study.png'))
print(preview('05_field_study.png', 'wave', 'wood', 'amber'))
