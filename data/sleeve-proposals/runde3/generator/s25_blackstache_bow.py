# -*- coding: utf-8 -*-
"""Sleeve 25 – „Blackstache's Bow“: Kapitän Blackstache steht auf dem Vorschiff und reckt den riesigen Säbel
über den Bug nach vorn, hinter ihm seine Crew (Flintlock-Piratin, Doomed Pirate); unten schwimmt eine
Meeresschildkröte vorbei.

Quellen (MotiveGrailWar.xcf): Ebene 328 „Ebene #230“ (Meer, 2×), 325 „Schiff“ (Vorschiff in Draufsicht, 2×),
323 „Blackstache“ (linke Figur mit Säbelhieb, 5×), 289 „Flintlock“, 559 „Doomed Pirate“,
542 „Populated Island Turtle“ (je 3×).
Karten: Blackstache Scourge of the Pixel Seas, Doomed Pirate, Populated Island Turtle.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
WX, WY = 192, 138
fill_bg(cv, region(B, [328], (WX, WY, WX + 125, WY + 175)), 2)
ship = region(B, [325], (WX, WY, WX + 125, WY + 175))
# Schatten des Rumpfs aufs Wasser
sh = silhouette(ship, (10, 30, 80)); cv.paste(up(sh, 2), 6, 8, alpha=0.5)
fill_bg(cv, ship, 2)

cap = parts(sprite('d25_blackstache_all', B, [323]), dil=1)[0]
keep('d25_blackstache', cap)
flint = sprite('d25_flintlock', B, [289])
turtle = max(parts(sprite('d25_turtle', B, [542]), dil=1), key=lambda p: p.size)   # ohne Einzelpixel
doomed = sprite('d25_doomed_pirate', B, [559])

S = dict(shadow=(40, 22, 8), sh_off=(1, 1), sh_alpha=0.5)
put(cv, doomed, 172, 64, 3, **S)
put(cv, flint, 64, 40, 3, **S)
put(cv, turtle, 8, 272, 3, shadow=(10, 40, 110), sh_off=(2, 2), sh_alpha=0.6)
put(cv, cap, 16, 156, 5, shadow=(40, 22, 8), sh_off=(1, 1), sh_alpha=0.55)

vignette(cv, 0.35, 0.6)
frame(cv, [(20, 14, 10), (230, 190, 90), (120, 80, 30)])
print(save(cv, '25_blackstache_bow.png'))
