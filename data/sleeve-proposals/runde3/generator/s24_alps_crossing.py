# -*- coding: utf-8 -*-
"""Sleeve 24 – „Crossing the Alps“: Hatusbal, der Anführer von Tusca, führt seinen Elefantenzug im
Schneetreiben über den vereisten Pass: oben ziehen zwei Lastelefanten den Grat entlang, am Hang folgt der
Sandrüssel-Elefant, vorn stapft der König im roten Mantel voran.

Runde 3b: ALLES einheitlich 3× (natives Raster 84×117, Kartenansicht wie im Spiel: Staffelung nur über die
Lage im Bild, nicht über die Pixelgröße). Statt sieben gleicher Elefanten jetzt drei verschiedene Elefanten-
Sprites; die beiden Grat-Elefanten sind unterschiedlich gerichtet/abgedunkelt und tragen keine Krone (die
trägt nur Hatusbal).

Quellen (MotiveGrailWar.xcf): Ebene 476 „Ebene #139“ (Eisklippe und Schneefeld), 205 „Taunting Elephant“
(laufender Elefant – Krone entfernt – und Hatusbal im Mantel), 199 „Trunk Sand“ (nur der Elefant, ohne
Sandstrahl und Opfer), 711 „Fiona #5“ (Funkeln als Schneeflocken). Schneetreiben/Schatten selbst gezeichnet.
Karten: Hatusbal the Leader of Tusca, Taunting Elephant, Trunk Sand.
"""
import numpy as np
from d_util import *  # noqa

K = 3
nc = native(K)
W, H = nc.w, nc.h
IX, IY = 300, 100
bg = region(B, [476], (IX, IY, IX + W, IY + H))
nc.a[:] = bg[..., :3]
yy, xx = np.mgrid[0:H, 0:W]

walk, king = parts(sprite('d24_taunting', B, [205]), dil=1)[:2]
walker = keep('d24_walker', decrown(walk))
trunk = sprite('d24_trunk_elephant', B, [199], box=(220, 229, 241, 257))

SH = (150, 150, 196)
def stand(s, x, feet, fl=False, dv=1.0):
    s2 = hsv_shift(s, 0, 1.0, dv) if dv != 1.0 else s
    blob(nc, x + s.shape[1] // 2, feet, s.shape[1] // 2 - 1, 2, SH, 1.0)
    put(nc, s2, x, feet - s.shape[0], fl=fl)

# oben auf dem Grat: zwei Lastelefanten laufen nach links (der hintere etwas dunkler)
stand(walker, 46, 29, fl=True, dv=0.88)
stand(walker, 10, 31, fl=True)
# am Hang: Sandrüssel-Elefant kommt herab
stand(trunk, 10, 82)
# vorn: Hatusbal im Mantel führt den Zug an
stand(king, 32, 112)
# Spuren im Schnee zwischen den Stationen (selbst gezeichnet, 1 natives Pixel)
for (x, y) in [(20, 84), (24, 89), (28, 94), (33, 98), (38, 102)]:
    nc.a[y, x:x + 2] = (170, 170, 214)

# Schneetreiben: Funkeln aus 711 + einzelne Flocken
flakes = sprite('d24_flakes', B, [711])
nc.paste(flakes, 40, 40)
nc.paste(flip(flakes), -16, 94)
rng = np.random.RandomState(8)
for _ in range(70):
    x, y = rng.randint(0, W), rng.randint(0, H)
    nc.px(x, y, (250, 250, 255))
    if rng.rand() < 0.3: nc.px(x - 1, y + 1, (220, 222, 245))
cv = finish(nc, K)
print(save(cv, '24_alps_crossing.png'))
