# -*- coding: utf-8 -*-
"""37 Sandtrap Oasis – Gegner „Shifting Sandlands“, Held: Bakhm, the Desert Digger.

Draufsicht auf die Wüste im Stil seiner Kartenwelt (RPG-Karte): Bakhm reckt sich genau wie auf seiner Base-Karte aus
seinem Sandtrichter (mit dem Tonnenkaktus hinter dem Schädel, der auf der Karte wie ein Happen im Maul wirkt) und
lauert mit dem Schädel zum Nilufer hin. Dort trinkt ahnungslos das Pure Advantage Camel (Cover-Karte des Decks);
seine frische Spur führt quer durch die Dünen dicht am Trichter vorbei. Die Wüste ist voller Überraschungen: Bakhms
Support-Zonen sind Surprise-Zonen, das Kamel ist selbst eine Surprise-Kreatur.

Quellen (MotiveEgypt.xcf):
  Ebene 41 „Bakhm #4“ + 42 „Bakhm #1“ (Schwanzspitze) + 46 „Ebene #96“ (Sandtrichter) – zusammen mit Ebene 132
  „Ebene #78“ (Wüste) pixelgleich mit „Sichtbar #52“ (Ebene 1) im Ausschnitt x350–460/y355–460 (0 Pixel Abweichung);
  das ist die Szene der Karte „Bakhm, the Desert Digger“ (Kartenbild gefiltert, gleiche Pose, gleicher Kaktus).
  Aus Ebene 132 zusätzlich nur der Tonnenkaktus hinter dem Schädel (x364–380/y377–395), in Originallage zu Bakhm.
  Ebene 234 „Hintergrund“ – Nilufer mit Bucht, Wüste, Kakteen, Schädel (Ausschnitt x334–418/y296–413); Objekte,
  die unter Bakhm/Trichter/Kamel lägen, sind mit der 16-px-periodischen Sandtextur überdeckt.
  Ebenen 67 „Ebene #103“ + 65 „Ebene #128“ – das Kamel der Karte „Pure Advantage Camel“ (Sichtbar Ebene 62, blickt
  wie dort nach links, hier zum Wasser); die schwarze Gestalt 66 der Karte weggelassen.
Selbst gezeichnet: Kamelspur (Hufabdrücke), Schlagschatten, Trinkkreise im Wasser.

Skalierung: EIN Raster, alles 3× (84×117): Wüste, Nil, Trichter, Bakhm (57×64 → 171×192 px), Kamel, Spur.
"""
import math, random
import numpy as np
from gkit36_40 import *  # noqa

rnd = random.Random(37)
W2, H2 = 84, 117                   # EIN Raster 3× (Bakhm samt Sandtrichter größer)
SX0, SY0 = 334, 296                # Ausschnitt aus Ebene 234

# ------------------------------------------------------------------ Hintergrund: Nilufer + Wüste
L234 = layer('MotiveEgypt', 234)
bg = Plane(W2, H2, 3)
bg.a[:] = L234[SY0:SY0 + H2, SX0:SX0 + W2]
rgb = bg.a[..., :3].astype(int)
water = rgb[..., 2] > rgb[..., 0] + 60

# Objekte (Kakteen, Blüten, Schädel, Konturen) an der Farbe erkennen – Sand ist immer deutlich rot-gelb (R−B ≥ 55)
shore = {(74, 40, 16), (140, 117, 82)}


def is_obj(c):
    r, g, b = (int(v) for v in c)
    if (r, g, b) in shore or b > r + 60: return False
    if g > r: return True                                   # grün (Kaktus)
    if r > 180 and b > 120 and g < 150: return True         # pink (Blüte)
    if abs(r - b) < 45 and abs(r - g) < 35: return True     # grau/weiß (Schädel, Stacheln)
    if r + g + b < 150: return True                         # dunkle Kontur
    return False


def erase(x0, y0, x1, y1):
    """Objekte im Rechteck durch Sand aus 16 px Entfernung (Texturperiode) ersetzen."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if is_obj(bg.a[y, x, :3]):
                for dx, dy in ((16, 0), (-16, 0), (32, 0), (-32, 0), (0, 16), (0, -16), (16, 16), (-16, -16)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W2 and 0 <= yy < H2 and not is_obj(bg.a[yy, xx, :3]) and not water[yy, xx]:
                        bg.a[y, x, :3] = bg.a[yy, xx, :3]; break


BX, BY = 16 - 363, 12 - 377        # Versatz Original → Raster (Trichter links bei x 16, Bakhm oben bei y 12)
CX, CY = 16, 87                    # Kamel links oben; Maul am Wasser
PROTECT = [(16, 12, 16 + 92, 12 + 71), (CX - 2, CY - 2, CX + 32, CY + 27)]
import cv2
om = np.array([[is_obj(c) for c in row] for row in bg.a[..., :3]]).astype(np.uint8)
n_, lab_ = cv2.connectedComponents(cv2.dilate(om, np.ones((3, 3), np.uint8)), connectivity=8)
for k in range(1, n_):
    ys, xs = np.nonzero((lab_ == k) & (om > 0))
    if len(ys) == 0: continue
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    if any(x0 < p[2] and x1 > p[0] and y0 < p[3] and y1 > p[1] for p in PROTECT):
        erase(max(0, x0 - 1), max(0, y0 - 1), min(W2, x1 + 1), min(H2, y1 + 1))   # Objekt unter Bakhm/Kamel

# ------------------------------------------------------------------ Kamelspur (selbst gezeichnet)
# Paarweise Hufabdrücke (je 2×2 dunkle Delle mit hellem Rand darunter), von rechts am Trichterrand vorbei zum Kamel
DENT, RIM = (122, 92, 52), (236, 214, 152)
pts = [(86, 92), (74, 96), (62, 100), (52, 104), (47, 106)]
steps = []
for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
    n = int(math.hypot(x1 - x0, y1 - y0) / 3.4)
    for i in range(n):
        t = i / n
        steps.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x1 - x0, y1 - y0))
for i, (x, y, dx, dy) in enumerate(steps):
    ln = math.hypot(dx, dy); nx, ny = -dy / ln, dx / ln           # Normale zur Laufrichtung
    side = 1.3 if i % 2 else -1.3
    px, py = int(round(x + nx * side)), int(round(y + ny * side))
    for (ddx, ddy, c) in ((0, 0, DENT), (1, 0, DENT), (0, 1, DENT), (1, 1, DENT), (0, 2, RIM), (1, 2, RIM)):
        xx, yy = px + ddx, py + ddy
        if 0 <= xx < W2 and 0 <= yy < H2 and not water[yy, xx] and not is_obj(bg.a[yy, xx, :3]):
            bg.a[yy, xx, :3] = c

# ------------------------------------------------------------------ Bakhm im Sandtrichter (Originallage wie Karte)
L132 = layer('MotiveEgypt', 132)
bak_full = compose('MotiveEgypt', [41, 42, 46], crop=False)
sprite('o37_bakhm', 'MotiveEgypt', [41, 42, 46])
cactus_box = (364, 377, 381, 396)
cac = L132[cactus_box[1]:cactus_box[3], cactus_box[0]:cactus_box[2]].copy()
cm = np.array([[is_obj(c) for c in row] for row in cac[..., :3]])
cac[~cm] = 0
# Tonnenkaktus liegt HINTER Bakhm → zuerst
bg.paste(cac, cactus_box[0] + BX, cactus_box[1] + BY)
bb = bbox(bak_full)
bg.paste(bak_full[bb[1]:bb[3], bb[0]:bb[2]], bb[0] + BX, bb[1] + BY)

# ------------------------------------------------------------------ Kamel am Ufer
camel = compose('MotiveEgypt', [65, 67])
sprite('o37_camel', 'MotiveEgypt', [65, 67])
ch, cw = camel.shape[:2]
bg.paste(silhouette(camel, (70, 48, 24)), CX + 1, CY + 2, alpha=0.40)
bg.paste(camel, CX, CY)
# Trinkkreise vor dem Maul (zwei helle Wellenbögen im Wasser)
RING = (123, 173, 239)
for (dx, dy) in ((-5, 8), (-4, 7), (-3, 7), (-2, 8), (-7, 11), (-6, 10), (-5, 9), (-1, 9), (0, 10)):
    x, y = CX + dx, CY + dy
    if 0 <= x < W2 and water[y, x]: bg.a[y, x, :3] = RING

cv = compose_planes([bg])
save(cv, '37_sandtrap_oasis.png')
print('ok', camel.shape, bb)
