# -*- coding: utf-8 -*-
"""Sleeve 25 – „Blackstache's Bow“: Kapitän Blackstache steht – wie auf seiner Karte – vorn auf dem
Bugspriet seines Schiffs und reckt den Säbel über das Meer; am Bug hält der Doomed Pirate Wache, Möwen
kreisen, unten zieht eine Meeresschildkröte am Bug vorbei.

Runde 3b: ALLES einheitlich 3× (natives Raster 84×117 aus Meer + Schiff, am Ende verdreifacht). Vorher stand
ein 5×-Kapitän neben 3×-Piraten auf einem 2×-Deck – jetzt haben Schiff, Meer, Kapitän, Crew und Schildkröte
dieselbe Pixelgröße.

Quellen (MotiveGrailWar.xcf): Ebene 328 „Ebene #230“ (Meer), 325 „Schiff“ (Bug mit Bugspriet), 323 „Blackstache“
(linke Figur mit Säbel; Lage auf dem Bugspriet wie in der Szene „Sichtbar #123“, 4 px weiter zum Schiff),
559 „Doomed Pirate“, 542 „Populated Island Turtle“ (ohne Einzelpixel), 121 „Ebene #470“ (fliegende Möwen).
Schatten auf Wasser/Deck selbst gezeichnet. Karten: Blackstache Scourge of the Pixel Seas, Doomed Pirate,
Populated Island Turtle.
"""
import numpy as np
from d_util import *  # noqa

K = 3
nc = native(K)
W, H = nc.w, nc.h
X0, Y0 = 146, 140
sea = region(B, [328], (X0, Y0, X0 + W, Y0 + H))
nc.a[:] = sea[..., :3]
ship = region(B, [325], (X0, Y0, X0 + W, Y0 + H))
# Schatten des Rumpfs aufs Wasser (1 natives Pixel versetzt, halbtransparent auf ganze Pixel)
nc.paste(silhouette(ship, (8, 26, 80)), 2, 3, alpha=0.45)
nc.paste(ship, 0, 0)

# --- Blackstache auf dem Bugspriet ------------------------------------------------------------------------
cap = parts(sprite('d25_blackstache_all', B, [323]), dil=1)[0]
keep('d25_blackstache', cap)
cx, cy = 144 + 4 - X0, 186 - Y0                  # 4 px weiter innen als in der Karte, Füße auf dem Spriet
nc.paste(silhouette(cap, (8, 26, 80)), cx + 2, cy + 4, alpha=0.45)
nc.paste(cap, cx, cy)

# --- Doomed Pirate auf dem Vorschiff, Möwen am Himmel ---------------------------------------------------
doomed = sprite('d25_doomed_pirate', B, [559])
blob(nc, 69, 222 - Y0, 8, 2, (70, 44, 18), 1.0)
put(nc, doomed, 57, 222 - Y0 - doomed.shape[0], fl=True)       # schaut zum Kapitän
gulls = parts(sprite('d25_gulls', B, [121]), dil=1)
fly = [g for g in gulls if g.shape[1] > 12]          # einzelne Möwe + Möwenpaar
for g, (x, y) in zip(fly, [(14, 20), (56, 6)]):
    nc.paste(silhouette(g, (8, 26, 80)), x + 3, y + 6, alpha=0.35)
    nc.paste(g, x, y)

# --- Meeresschildkröte vor dem Bug ------------------------------------------------------------------------
turtle = max(parts(sprite('d25_turtle', B, [542]), dil=1), key=lambda p: p.size)
keep('d25_turtle_clean', turtle)
nc.paste(silhouette(turtle, (8, 30, 100)), 4, 96, alpha=0.5)
nc.paste(turtle, 2, 92)

vignette(nc, 0.3, 0.7)
cv = finish(nc, K)
print(save(cv, '25_blackstache_bow.png'))
