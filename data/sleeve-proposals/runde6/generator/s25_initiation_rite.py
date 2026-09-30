# -*- coding: utf-8 -*-
"""25 Initiation Rite – Gegner „Join our Cult!“ (sample-Structure Deck Join our Cult), Held: Klaus, the Cult Leader.

Idee (Porträt/Ruhemoment im Kultkeller): Klaus – der Kapuzenmann mit blauem Haar, rotem Auge und erhobenem
Opferdolch – steht groß in der Mitte seines Kellergewölbes, vor ihm kniet der braunhaarige Neuling seiner
Base-Karte („Join our Cult!“). Ringsum stehen seine Kultisten in schwarzen Kutten, an der Wand lodern zwei Fackeln,
rechts liegt das Buch auf dem Lesepult. Ein fahles rotes Glühen steigt unter den beiden aus dem Boden
(Decay Magic, ohne Pentagramm), sonst liegt das Gewölbe im Dunkeln.

Quellen (MotiveGrailWar.xcf):
  Ebene 526 „Kultisten“, rechte Gruppe (Box x 279–297, y 123–154): Klaus (Kapuze, Dolch) mit dem knienden
      Neuling – genau die Figurengruppe der Base-Karte „Klaus, the Cult Leader“ (Kartenszene Sichtbar #48 = Ebene 738,
      Lage 222,66; die Karte zeigt diese Gruppe weichgezeichnet und vergrößert, daher kein Pixelvergleich möglich,
      Form/Farben/Anordnung stimmen überein). Derselbe Kapuzenkopf erscheint auf „Clausss, the No-Nonsense Cultist“.
  Ebene 532 „Ebene #145“ – Kultkeller mit Fackeln, Lesepult und fünf Kultisten (Ausschnitt x 228–353, y 58–233);
      der Ritualkreis samt Figuren in der Mitte (x 268–326, y 125–186) wurde mit der Bodenkachel des Gewölbes
      (16×16, x 282–298, y 108–124, periodisch ausgerichtet) übermalt.
Selbst gezeichnet: Abdunklung, Fackelschein, rotes Bodenglühen, Bodenschatten.

Skalierung:
  Hintergrund (Gewölbe, Kultisten, Fackeln, Licht)          – 2× (Raster 125×175)
  Vordergrund (Klaus + Neuling 18×31 → 108×186, Schatten)   – 6× (Raster 42×59)
"""
import math
import numpy as np
from ekit_25_30 import *  # noqa

GW = 'MotiveGrailWar'
klaus = sprite('o25_klaus_group', GW, [526], box=(279, 123, 297, 154))

# ================================================================ 2×: Kultkeller
hall = layer(GW, 532).copy()
tile = hall[108:124, 282:298].copy()
for y in range(125, 186):
    for x in range(268, 326):
        hall[y, x] = tile[(y - 108) % 16, (x - 282) % 16]
X0, Y0 = 228, 58
bw, bh = grid(2)
bg = hall[Y0:Y0 + bh, X0:X0 + bw].copy()
bg[..., 3] = 255
# Fackeln (Flammen) und Klaus' Standort in 2×-Rasterkoordinaten
TORCH = [((256 - X0), (96 - Y0)), ((336 - X0), (96 - Y0))]
KX, KY = 62.5, 118                    # Fußpunkt der Gruppe (Canvas 125, 236)
rgb = bg[..., :3].astype(float)
out = np.zeros_like(rgb)
for y in range(bh):
    for x in range(bw):
        c = rgb[y, x]
        # Grundabdunklung, Fackelschein (warm), rotes Glühen um Klaus
        lt = 0.42
        for tx, ty in TORCH:
            d = math.hypot((x + .5 - tx) / 30, (y + .5 - ty) / 34)
            lt += 0.5 * math.floor(max(0, 1 - d) ** 1.3 * 4 + bay(x, y)) / 4
        d = math.hypot((x + .5 - KX) / 34, (y + .5 - (KY - 22)) / 40)
        rg = math.floor(max(0, 1 - d) ** 1.2 * 4 + bay(x, y)) / 4
        c = c * min(lt, 1.0) + np.array([120, 10, 16]) * rg * .45
        out[y, x] = c
bg[..., :3] = out.clip(0, 255).astype(np.uint8)
# Flammen selbst nicht abdunkeln (Originalpixel der Fackeln zurück)
for tx, ty in TORCH:
    for y in range(ty - 8, ty + 3):
        for x in range(tx - 6, tx + 6):
            src = hall[Y0 + y, X0 + x, :3].astype(int)
            if src[0] > 180 and src[0] > src[2] + 60:
                bg[y, x, :3] = src

# ================================================================ 6×: Klaus mit Neuling
fw, fh = grid(6)                         # 42×59
fg = rgba(fw, fh)
GX = 21 - klaus.shape[1] // 2            # mittig (Canvas 72–180)
GB = 39                                  # unterste Zeile (Canvas 234–239)
for x in range(GX + 2, GX + klaus.shape[1] - 2):
    for dy in (0, 1):
        if bay(x, GB + dy) < (.75 if dy == 0 else .35):
            setp(fg, x, GB + dy, (18, 4, 8), 170)
put(fg, klaus, GX, GB - klaus.shape[0] + 1)

print(finish([(bg, 2), (fg, 6)], '25_initiation_rite.png'))
