# -*- coding: utf-8 -*-
"""05 Field Study – Gegner „Big Stomp!“, Held: Kit, the Shark Researcher (Base-Version).
Big Stomp!: Kit, der Hai-Forscher, steht auf einer Lichtung der Gigantisaurier-Insel und folgt einer Fährte aus
dreizehigen Trittsiegeln – hinter ihm, am Waldrand, ragt schon die riesige Schattensilhouette des T-Rex (Gigantisaur
King Trex) auf und beugt das aufgerissene Maul über ihn.
Wald im Stil der Gigantisaurier-Karten (Draufsicht-Karte mit Kreaturen darauf).

Quellen:
  MotiveDeepsea.xcf Ebene 38 „Ebene #49“ (Hut) + 39 „Kit-Kopie“ (= Kartenbild „Kit, the Shark Researcher“,
      Sichtbar #37 Lage 305,192, sitzend hinter einem Stuhl, offener Mund); ab der Hüfte die stehenden Beine aus
      Ebene 40 „Kit“ (im Kartenbild vom Stuhl verdeckt).
  MotiveGrailWar.xcf Ebene 513 „Trex“ (80×59, Kartenbild „Gigantisaur King Trex“) – als dunkle,
      halbtransparente Silhouette (ganze 3×-Pixel mit Alpha).
  MotiveGrailWar.xcf Ebene 515 „Ebene #153“: Inselkarte der Gigantisaurier-Karten, Ausschnitt x280–364/y105–222
      (Erdlichtung am Waldrand, Wald leicht abgedunkelt).
Selbst gezeichnet: dreizehige Trittsiegel, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Insel, T-Rex-Silhouette, Trittsiegel, Schatten – 3× (84×117)
  Kit                                              – 5× (50×70)
"""
import math, random
from a_util import *  # noqa
import numpy as np

# Base-Kit: Hut (38) + „Kit-Kopie“ (39, sitzend, = Kartenbild Sichtbar #37 inkl. offenem Mund) – für den
# stehenden Kit werden ab der Hüfte (Zeile 18 des Ausschnitts) die Beine aus „Kit“ (40, stehend) genommen;
# im Kartenbild verdeckt der Stuhl diese Zeilen.
_k39 = compose('MotiveDeepsea', [38, 39], crop=False)[205:233, 322:347]
_k40 = compose('MotiveDeepsea', [38, 40], crop=False)[205:233, 322:347]
_kit = _k39.copy(); _kit[18:] = _k40[18:]
kit_ = trimmed(_kit)
trex = sprite('o05_trex', 'MotiveGrailWar', [513])            # Gigantisaur King Trex (80×59)
isle = compose('MotiveGrailWar', [515], crop=False)           # Insel-Karte der Gigantisaurier-Karten

# ---- Ebene 1: Urwaldinsel + T-Rex-Schatten (3×, 84×117) ---------------------------------------------
W3, H3 = 84, 117
MX, MY = 280, 105                                            # offene Erdlichtung am Waldrand
p3 = isle[MY:MY + H3, MX:MX + W3].copy()
p3[..., 3] = 255
TX, TY = W3 - trex.shape[1] + 2, 22                         # Maul rechts oben über der Lichtung, Schwanz im Wald
# Wald etwas abdunkeln, die Lichtung bleibt hell (Kit hebt sich ab)
c = p3[..., :3].astype(int)
forest = (c[..., 1] < 120) | (c[..., 0] > c[..., 1])
p3[..., :3][forest] = (p3[..., :3][forest] * 0.78).astype(np.uint8)
# Fußspuren des Brachion quer über die Lichtung (selbst gezeichnet: runde Trittsiegel mit drei Zehen)
MUD, MUD2, RIM = (96, 62, 30), (70, 42, 20), (214, 172, 110)
def footprint(cx, cy):
    """Dreizehiges Trittsiegel (T-Rex): Ballen, drei Zehen nach vorn (oben), heller Grasrand."""
    pts2 = [(0, 0), (1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1), (0, 2)]              # Ballen (dunkel)
    pts1 = [(0, -1), (0, -2), (0, -3), (0, -4), (-1, -1), (-2, -2), (-3, -3), (1, -1), (2, -2), (3, -3),
            (-2, 1), (2, 1)]                                                     # Zehen
    for (dx, dy) in pts1: p3[cy + dy, cx + dx, :3] = MUD
    for (dx, dy) in pts2: p3[cy + dy, cx + dx, :3] = MUD2
    for (dx, dy) in [(0, -5), (-4, -4), (4, -4)]:
        p3[cy + dy, cx + dx, :3] = mix(p3[cy + dy, cx + dx, :3], RIM, 0.6)
for (x, y) in [(66, 108), (57, 97), (66, 86), (57, 75)]:
    footprint(x, y)
# Schattensilhouette des T-Rex fällt über die Lichtung (dunkel, halbtransparent auf ganzen 3×-Pixeln)
sil = trex.copy()
m = sil[..., 3] > 0
sil[m, :3] = (14, 22, 12); sil[m, 3] = 190
cv0 = p3.copy()
for y in range(sil.shape[0]):
    for x in range(sil.shape[1]):
        yy, xx = TY + y, TX + x
        if m[y, x] and 0 <= yy < H3 and 0 <= xx < W3:
            p3[yy, xx, :3] = (p3[yy, xx, :3] * 0.42 + np.array([26, 16, 10]) * 0.58).astype(np.uint8)
# Bodenschatten unter Kit (Füße bei 250er-y 305 → 3×-Reihe 102)
shadow_ellipse(p3, 34.5, 102, 10, 1.8, a=0.4)
cv = Canvas(250, 350)
blit(cv, p3, 3, -1, 0)

# ---- Ebene 2: Kit (5×, 50×70) ---------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
KX, KY = (W5 - kit_.shape[1]) // 2 - 6, 61 - kit_.shape[0]
put(p5, kit_, KX, KY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '05_field_study.png'))
print(preview('05_field_study.png', 'wave', 'wood', 'amber'))
