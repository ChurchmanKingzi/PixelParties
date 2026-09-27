# -*- coding: utf-8 -*-
"""Sleeve 57 – „Exploding Skull“: Oben an der Treppe wartet etwas.

Idee: Horror-Blick die Haupttreppe des Arcanum-Anwesens hinauf. Im oberen Flur, direkt über dem Treppenschacht,
hat sich der riesige Explosionsschädel breitbeinig aufgebaut – glühende Augen und Maul, die Lunte brennt schon.
Hinter ihm Wand mit Gemälden, der rote Läufer; unten der Treppenschacht, aus dem der Betrachter hinaufsieht.
Das Licht kommt vom Funken und den glühenden Augen, der Flur versinkt nach außen im Dunkel.

Skalierung: alles 3× (Flur, Wand, Gemälde, Treppe und der Schädel, der auf dem Treppenabsatz steht).
Licht/Schatten im 3×-Raster gedithert.

Quellen (MotiveArcanum):
  100 „FLUR OBEN“ (oberer Flur x539–622 / y462–578: Wand mit Gemälden, roter Läufer, Treppenschacht),
  48 „Giant Exploding Skull“ (vollständig in einer Ebene, vgl. Szene „Sichtbar #39“)
"""
from common import *
from f_util import *
import numpy as np

A = 'MotiveArcanum'
K = 3
cv = Canvas(W, H)
hall = layer(A, 100)

# ---------- oberer Flur (3×) ----------
X0, Y0 = 539, 462
cv.paste(up(rgba(hall[Y0:Y0 + 117, X0:X0 + 84]), K), -1, 0)

# ---------- Dunkel: der Flur liegt im Finstern, nur um den Schädel Licht (3×-Raster) ----------
cx, cy, th = grid(K, ox=-1)
SCX, SCY = 125, 150
d = np.sqrt(((cx - SCX) / 1.1) ** 2 + ((cy - SCY) / 1.0) ** 2)
shade(cv, np.clip((d - 60) / 130, 0, 1) * 0.8 + 0.12, th)
# gelber Schein des Funkens auf der Wand (nur ein enger Hof, 3×-Raster)
d2 = np.sqrt((cx - 76) ** 2 + (cy - 108) ** 2)
shade(cv, np.clip(1 - d2 / 34, 0, 1) * 0.3, th, col=(255, 220, 90), levels=3)

# ---------- der Explosionsschädel (3×) auf dem Treppenabsatz ----------
ges = sprite('f57_ges', A, [48])
S = up(ges, K)
LAND = (540 - Y0) * K + 4                     # Oberkante des Treppenschachts = vorderer Rand des Absatzes
SX = SCX - S.shape[1] // 2
ellipse_shadow(cv, SCX, LAND - 2 * K, S.shape[1] * 0.42, 9, K, alpha=0.55)
cv.paste(S, SX, LAND - S.shape[0])

save(cv, '57_exploding_skull.png')
