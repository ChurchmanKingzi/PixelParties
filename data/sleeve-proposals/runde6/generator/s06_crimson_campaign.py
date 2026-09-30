# -*- coding: utf-8 -*-
"""06 Crimson Campaign – Gegner „Bloody King Zi“, Held: Timeless King Zi (Base-Version).
(Docstring wird nach Fertigstellung ergänzt.)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'MotiveGrailWar'
zi = sprite('o06_zi', B, [487])                               # Base-Zi mit Sternumhang (26×28), = Sichtbar #169
marks = parts(compose(B, [483]), dil=1)                       # „Zi #3“: vier Heeresmarken (gekreuzte Speere) seiner Karte
snowmap = compose(B, [510], crop=False)                      # „Ebene #386“: verschneite Inselkarte

# ---- Ebene 1: Kriegskarte (2×, 125×175) ------------------------------------------------------
W2, H2 = 125, 175
MX, MY = 270, 110                                            # sechseckige Lichtung im verschneiten Wald
p2 = snowmap[MY:MY + H2, MX:MX + W2].copy()
p2[..., 3] = 255
# blutrotes Abendlicht auf dem Schnee: Farben zu Karmin hin verschieben, Ränder dunkler
for y in range(H2):
    for x in range(W2):
        r, g, b = [int(v) for v in p2[y, x, :3]]
        d = math.hypot((x + 0.5 - W2 / 2) / (W2 / 2), (y + 0.5 - H2 / 2) / (H2 / 2))
        f = 1.0 - 0.28 * max(0.0, d - 0.45) / 0.55
        p2[y, x, :3] = (min(255, int(r * 1.0 * f)), int(g * 0.80 * f), int(b * 0.86 * f))
# Heeresmarken: unten Zis goldene Marken, oben die gegnerischen, blutrot umgefärbt
gold = marks[0]
enemy = hsv_shift(gold, dh=-40, ds=1.2, dv=0.85)
enemy = hsv_shift(enemy, dh=0, ds=1.0, dv=1.0)
m2 = rgba(W2, H2)
put(m2, enemy, 6, 4); put(m2, enemy, W2 - 6 - 45, 4)
put(m2, gold, 6, H2 - 4 - 43); put(m2, gold, W2 - 6 - 45, H2 - 4 - 43)
# Bodenschatten unter Zi (Füße bei 250er-y 290 → 2×-Reihe 145)
shadow_ellipse(p2, 62.5, 145, 16, 3, col=(60, 20, 40), a=0.45)
cv = Canvas(250, 350)
blit(cv, p2, 2)
blit(cv, m2, 2)

# ---- Ebene 2: Zi (5×, 50×70) ----------------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
ZX, ZY = (W5 - zi.shape[1]) // 2, 58 - zi.shape[0]
put(p5, zi, ZX, ZY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '06_crimson_campaign.png'))
print(preview('06_crimson_campaign.png', 'cosmic', 'ice', 'ruby', 'sapphire'))
