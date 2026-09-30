# -*- coding: utf-8 -*-
"""15 „Red Tide“ – Gegner „Deepsea Terror“, Held: Siphem, the Deepsea Demon (Base).

Bildidee (Überarbeitung nach Nutzer-Feedback): Siphem steht mit ausgebreiteten Flügeln breitbeinig auf dem dunklen
Meeresgrund, hinter ihm geht groß der rote Mond der Tiefsee auf; vor dem Mond ragt als schwarze Silhouette der Dark
Deepsea God empor und überragt ihn. Links und rechts rahmen zwei Deepsea Monstrosities (tote Korallenbäume mit
roten Adern) die Szene. Kein Schloss (≠ Deepsea Awakening/Count of the Deep). Die frühere Armee und die Counter-Blasen
sind entfallen – sie verschwanden hinter Siphems Flügeln.

Quellen (MotiveDeepsea.xcf):
  Siphem (Base)   = Ebene 301 „Siphem“ + rotes Randlicht Ebene 300 „Siphem #1“, wie in Sichtbar #107 (Ebene 34,
                    Karte „Siphem“, Lage 245,277) mit ca. 25 % Deckkraft nur auf Siphems Pixeln gemischt
  roter Mond      = Ebene 378 „Ebene #187“ (86×86)
  Dark Deepsea God = Ebene 308 „DDG“ (75×57), als schwarze Silhouette (einfarbig, 2 Dunkelstufen am Rand weg)
  Deepsea Monstrosity = Ebene 339 (links, rechts gespiegelt)
Selbst gezeichnet: Wasserverlauf, Mondschein, Meeresgrund, Siphems Bodenschatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Wasser                                            – 1×
  Mond, DDG-Silhouette, Meeresgrund, Monstrosities – 2× (125×175)
  Siphem + Schatten                                 – 5× (50×70)
"""
import math, random
from c_util import *  # noqa
import numpy as np

D = 'MotiveDeepsea'
rnd = random.Random(15)

sip = layer(D, 301).copy(); red = layer(D, 300)
m = (sip[..., 3] > 0) & (red[..., 3] > 0)
sip[m, :3] = (sip[m, :3] * 0.75 + np.array([255, 0, 14]) * 0.25).astype(np.uint8)
b = bbox(sip); siphem = sip[b[1]:b[3], b[0]:b[2]]                      # 36×31 (h×b 31×36)

def P(i, box=None):
    a = compose(D, [i], crop=False)
    if box: x0, y0, x1, y1 = box; a = a[y0:y1, x0:x1]
    bb = bbox(a); return a[bb[1]:bb[3], bb[0]:bb[2]]

monst = P(339, (190, 265, 240, 325)); moon = P(378); ddg = P(308)
ddg_sil = silhouette(ddg, (6, 4, 12))

# ---------- 1×: Wasser ----------
cv = Canvas(250, 350)
WAT = [(40, 10, 26), (34, 12, 34), (26, 14, 42), (18, 18, 48), (14, 20, 46), (10, 16, 36), (8, 12, 28)]
for y in range(350):
    for x in range(250):
        cv.a[y, x] = grad_pick(WAT, y / 330, x, y)

# ---------- 2×: Mond, Gott-Silhouette, Grund, Monstrosities ----------
p2 = rgba(125, 175)
MX, MY = (125 - 86) // 2, 14                          # Mond: 250er x78–250?, y28–200
MCX, MCY = MX + 43, MY + 43
for y in range(175):                                   # Mondschein: zwei Ringe
    for x in range(125):
        d = math.hypot(x + 0.5 - MCX, y + 0.5 - MCY)
        if 43 <= d < 58:
            lv = int((58 - d) / 15 * 2.4 + bayer(x, y))
            if lv:
                c = tuple(int(v) for v in cv.a[y * 2, x * 2])
                p2[y, x] = list(mix(c, (150, 30, 44), (0, 0.18, 0.32, 0.4)[min(3, lv)])) + [255]
put(p2, moon, MX, MY)
put(p2, ddg_sil, (125 - 75) // 2, MY + 6)            # der Dark Deepsea God als Schatten vor dem Mond
GY = 136                                              # Horizont des Meeresgrunds (250er: y272)
GR = [(24, 20, 36), (18, 16, 30), (12, 12, 24)]
for x in range(125):
    h = GY + int(1.5 * math.sin(x / 9.0) + 1.0 * math.sin(x / 3.1))
    for y in range(h, 175):
        p2[y, x] = list(grad_pick(GR, (y - h) / 26, x, y)) + [255]
    p2[h, x, :3] = (46, 32, 56)
def stand(s, cx, fy, fl=False):
    s = flip(s) if fl else s
    x = int(cx - s.shape[1] / 2); y = fy - s.shape[0]
    put(p2, s, x, y); return (x + s.shape[1] // 2, y)
put(p2, monst, -9, GY + 4 - monst.shape[0]); put(p2, flip(monst), 125 + 9 - monst.shape[1], GY + 4 - monst.shape[0])
blit(cv, p2, 2)

# ---------- 5×: Siphem steht auf dem Grund ----------
p5 = rgba(50, 70)
FX, FY = (50 - 36) // 2, 61 - 31                      # Füße auf 250er-y 305
for x in range(FX + 6, FX + 30):                       # flacher Bodenschatten unter seinen Füßen
    if abs(x - (FX + 17.5)) < 12: cv.a[61 * 5:62 * 5, x * 5:x * 5 + 5] = (cv.a[61 * 5:62 * 5, x * 5:x * 5 + 5] * 0.5).astype(np.uint8)
put(p5, siphem, FX, FY)
blit(cv, p5, 5)
print(save(cv, '15_red_tide.png'))
