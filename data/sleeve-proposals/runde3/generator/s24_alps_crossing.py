# -*- coding: utf-8 -*-
"""Sleeve 24 – „Crossing the Alps“: Hatusbal, der Anführer von Tusca, führt seinen Elefantenzug im Schneetreiben
über die vereisten Serpentinen – hinten klein, vorne groß (Tiefe über ganzzahlige Skalierung 2×/3×/4×).

Quellen (MotiveGrailWar.xcf): Ebene 476 „Ebene #139“ (Eisfelsen-Bänder und Schneefeld, 2×),
207 „Hatusbal“ (Elefantenkönig mit zwei Fackeln, 4×), 205 „Taunting Elephant“ (laufender Elefant,
Krone entfernt, 2×/3×), 711 „Fiona #5“ (Funkeln als Schneeflocken, 1×/2×).
Karten: Hatusbal the Leader of Tusca, Taunting Elephant.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
bg = region(B, [476], (190, 70, 315, 245))
fill_bg(cv, bg, 2)

el = parts(sprite('d24_taunting', B, [205]), dil=1)
walker = decrown(el[0])                      # Zugelefanten ohne Krone – nur Hatusbal trägt sie
hat = sprite('d24_hatusbal', B, [207])

def sh(s):
    return dict(shadow=(120, 120, 170), sh_off=(1, 1), sh_alpha=0.6)

# hinterer Zug (2×) oben, läuft nach rechts; mittlerer (3×) läuft nach links
for i, x in enumerate([22, 78, 134, 190]):
    put(cv, walker, x, 24 + i * 5, 2, **sh(walker))
for i, x in enumerate([156, 42]):
    put(cv, walker, x, 116 + i * 12, 3, fl=True, **sh(walker))
# vorn: Hatusbal mit Fackeln (4×)
put(cv, hat, 125, 344, 4, anchor='b', **sh(hat))

# Schneeflocken
flakes = sprite('d24_flakes', B, [711])
for (x, y, k) in [(10, 10, 1), (150, 4, 1), (190, 70, 2), (4, 96, 1), (120, 92, 1), (200, 180, 1),
                  (30, 200, 2), (96, 170, 1)]:
    put(cv, flakes, x, y, k)

vignette(cv, 0.3, 0.6)
frame(cv, [(30, 40, 80), (230, 230, 250), (120, 140, 200)])
print(save(cv, '24_alps_crossing.png'))
