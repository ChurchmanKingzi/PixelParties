# -*- coding: utf-8 -*-
"""05 Field Study – Gegner „Big Stomp!“, Held: Kit, the Shark Researcher (Base-Version).
Big Stomp!: Kit, der Hai-Forscher, steht auf einer Lichtung der Gigantisaurier-Insel; hinter ihm stapft der
riesige Brachion durch den Wald, dessen Trittsiegel quer über die Lichtung führen – Kit ist ihm auf der Spur.
Wald und Dinosaurier im Stil der Gigantisaurier-Karten (Draufsicht-Karte mit Kreaturen darauf).

Quellen:
  MotiveDeepsea.xcf Ebene 38 „Ebene #49“ (Hut) + 39 „Kit-Kopie“ (= Kartenbild „Kit, the Shark Researcher“,
      Sichtbar #37 Lage 305,192, sitzend hinter einem Stuhl, offener Mund); ab der Hüfte die stehenden Beine aus
      Ebene 40 „Kit“ (im Kartenbild vom Stuhl verdeckt).
  MotiveGrailWar.xcf Ebene 503 „Brachion“ (69×53), in Sichtbar #61 (Kartenbild „Gigantisaur Brachion“) zu 100 % gleich.
  MotiveGrailWar.xcf Ebene 515 „Ebene #153“: Inselkarte der Gigantisaurier-Karten, Ausschnitt x60–144/y262–379
      (Wald leicht abgedunkelt).
Selbst gezeichnet: Trittsiegel, Schatten.

Skalierung:
  Insel, Brachion, Trittsiegel, Schatten – 3× (84×117)
  Kit                                    – 5× (50×70)
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
brach = sprite('o05_brachion', 'MotiveGrailWar', [503])       # Gigantisaur Brachion (69×53), = Sichtbar #61
isle = compose('MotiveGrailWar', [515], crop=False)           # Insel-Karte der Gigantisaurier-Karten

# ---- Ebene 1: Urwaldinsel + Brachion (3×, 84×117) ---------------------------------------------
W3, H3 = 84, 117
MX, MY = 60, 262
p3 = isle[MY:MY + H3, MX:MX + W3].copy()
p3[..., 3] = 255
BX, BY = 7, 9
# Wald etwas abdunkeln, die Lichtung bleibt hell (Kit hebt sich ab)
c = p3[..., :3].astype(int)
forest = (c[..., 1] < 120) | (c[..., 0] > c[..., 1])
p3[..., :3][forest] = (p3[..., :3][forest] * 0.78).astype(np.uint8)
# Fußspuren des Brachion quer über die Lichtung (selbst gezeichnet: runde Trittsiegel mit drei Zehen)
MUD, MUD2, RIM = (58, 64, 22), (44, 46, 16), (150, 206, 70)
def footprint(cx, cy):
    """Trittsiegel: plattgetretener Grasrand (hell) oben, Mulde (dunkel), drei Zehenkerben vorn."""
    for y in range(cy - 3, cy + 4):
        for x in range(cx - 4, cx + 5):
            d = ((x + 0.5 - cx - 0.5) / 4.2) ** 2 + ((y + 0.5 - cy - 0.5) / 3.1) ** 2
            if d < 1:
                p3[y, x, :3] = MUD2 if d < 0.35 else MUD
    for x in range(cx - 3, cx + 5):
        p3[cy - 4, x, :3] = mix(p3[cy - 4, x, :3], RIM, 0.5)
    for dx in (-3, 0, 3):
        p3[cy - 4, cx + dx, :3] = MUD2; p3[cy - 5, cx + dx, :3] = MUD
for (x, y) in [(60, 108), (52, 97), (61, 86), (53, 75)]:
    footprint(x, y)
shadow_ellipse(p3, BX + 36, BY + brach.shape[0] - 1, 26, 3.2, a=0.45)
put(p3, brach, BX, BY)
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
