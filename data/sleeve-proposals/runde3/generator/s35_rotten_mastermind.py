# -*- coding: utf-8 -*-
"""Sleeve 35 – „Rotten Mastermind“: Audienz im Geheimraum.

Idee (ersetzt „Arcane Library“, um die Bibliotheks-Doppelung mit 02 aufzulösen): Blick in den geheimen Thronsaal
des Arcanum-Anwesens. Oben in der Mitte thront Lord Mithuru, der verdorbene Drahtzieher, mit einem Glas Rotwein,
flankiert von zwei Kandelabern; vor ihm Beistelltisch mit Weinflasche. Im Vordergrund steht Celia (von hinten,
unterhalb der Stufe) und blickt zu ihm hinauf – Gegenspielerin gegen Drahtzieher, klare Blickführung nach oben.

Skalierung: Thronsaal inkl. Thron, Kandelaber, Tisch und Mithuru 3× (hinten); Celia 5× (klar im Vordergrund,
steht vor/unter der Stufe und überdeckt sie).

Quellen (MotiveArcanum):
  154 „GEHEIMRAUM“ (Thronsaal x650–733 / y126–243), 153 „Mithuru“ + 152 „Ebene #29“ (Glas) + 151 „Ebene #30“
  (Wein) – zusammen wie in Szene „Sichtbar #32“ (Karte Lord Mithuru, the Rotten Mastermind),
  63 „Ebene #75“ (Celia von hinten, vgl. „Sichtbar #18“)
"""
from common import *
from f_util import *
import numpy as np

A = 'MotiveArcanum'
cv = Canvas(W, H)
room = layer(A, 154)

# ---------- Thronsaal (3×) ----------
KR = 3
X0, Y0 = 650, 126
R = up(rgba(room[Y0:Y0 + 117, X0:X0 + 84]), KR)
cv.paste(R, -1, 0)

# ---------- Licht: Kerzen hell, Rand/Decke dunkel (auf dem 3×-Raster gedithert) ----------
cx, cy, th = grid(KR, ox=-1)
d = np.sqrt(((cx - 125) / 1.15) ** 2 + ((cy - 130) / 1.0) ** 2)
shade(cv, np.clip((d - 95) / 120, 0, 1) * 0.75, th)
shade(cv, np.clip((60 - cy) / 60, 0, 1) * 0.6, th)          # Decke/obere Mauer ins Dunkel

# Mithuru mit Weinglas auf dem Thron (3×, an Originalposition)
ms = sprite('f35_mithuru', A, [151, 152, 153])
bb = (684, 161)                               # Lage im Thronsaal (bbox der Ebenen 151–153)
cv.paste(up(darken(ms, 0.88), KR), (bb[0] - X0) * KR - 1, (bb[1] - Y0) * KR)


# ---------- Celia im Vordergrund (5×) ----------
KC = 5
cel = sprite('f35_celia_back', A, [63])
C = up(cel, KC)
cx0 = 125 - C.shape[1] // 2
ellipse_shadow(cv, 125, H - 8, C.shape[1] * 0.45, 8, KC, alpha=0.5)
# Kerzenlicht von vorn-oben: Silhouette leicht abgedunkelt, damit der Thron das hellste Element bleibt
cv.paste(darken(C, 0.9), cx0, H - 2 - C.shape[0])

save(cv, '35_rotten_mastermind.png')
