# -*- coding: utf-8 -*-
"""Sleeve 21 – „Skulltop Storm“: Die Skulltop-Burg auf dem riesigen Gigantisaurier-Schädel in einer
Gewitternacht; ein Blitz schlägt in die Hauptturmspitze, Schneeregen, eisige Bergkette.

Quellen (MotiveGrailWar.xcf): Ebene 490 „Skulltop Castle“ und 496 „Gigantisaur Skull“ (beide 4×, in der
Original-Lage zueinander wie auf der Karte), 577 „Ebene #7“ (Blitze, 2×), 296 „Ebene #363“ (Regen der Karte
Divine Gift of Rain, 1×), 476 „Ebene #139“ (Eisgrat, 2×, nächtlich umgefärbt).
Himmel: selbst erstellter, geordnet geditherter Verlauf. Karten: Gigantisaur Skull.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
NIGHT = [(8, 6, 20), (18, 12, 40), (34, 24, 66), (58, 46, 98)]
dither_grad(cv, 0, 350, NIGHT, pix=1)

# Wolkenbänder (selbst erstellt): hellere, geditherte Streifen
for y in range(0, 150):
    for x in range(250):
        v = 0.5 + 0.5 * np.sin(x / 23.0 + y / 9.0) * np.sin(x / 57.0 - y / 17.0)
        if v * (1 - y / 150.0) * 0.8 > BAYER8[y % 8, x % 8] + 0.25:
            c = cv.a[y, x].astype(int)
            cv.a[y, x] = np.clip(c + (22, 18, 34), 0, 255)

# Lichtschein des Blitzes am Himmel (geditherter Radialverlauf)
for y in range(0, 200):
    for x in range(250):
        d = np.hypot((x - 125) / 1.3, y - 40) / 120.0
        if (1 - d) * 0.9 > BAYER8[y % 8, x % 8] + 0.15:
            cv.a[y, x] = np.clip(cv.a[y, x].astype(int) + (26, 24, 46), 0, 255)

# --- ferne Eisberge: Grat aus der Eiskarte, oberhalb freigestellt --------------------------------
ice = region(B, [476], (150, 60, 275, 190)).copy()      # 125×130 nativ → 2×
c = ice[..., :3].astype(int)
blue = (c[..., 2] - c[..., 0] > 60) & (c.max(-1) < 215)
for x in range(ice.shape[1]):
    ys = np.where(blue[:, x])[0]
    top = ys.min() if len(ys) else ice.shape[0]
    ice[:top, x, 3] = 0
ice = hsv_shift(ice, 8, 0.8, 0.42)
fill_bg(cv, ice, 2, 0, 128)

# --- Schädel + Burg --------------------------------------------------------------------------------
skull = sprite('d21_skull', B, [496])        # Lage 238,127
castle = sprite('d21_castle', B, [490])      # Lage 249,100
k = 4
SX, SY = 25, 200
sk = hsv_shift(skull, 0, 0.9, 0.78)
ca = hsv_shift(castle, 0, 0.95, 0.85)
# Schatten auf den Schnee
put(cv, silhouette(skull, (10, 8, 26)), SX + 8, SY + 6, k)
put(cv, sk, SX, SY, k)
CX, CY = SX + (249 - 238) * k, SY + (100 - 127) * k
put(cv, ca, CX, CY, k)

# --- Blitz schlägt in die Hauptturmspitze ----------------------------------------------------------
bolt = sprite('d21_bolt', B, [577])          # Lage 223,116; unteres Ende bei (256,188)
spire = (CX + 15 * k + 2, CY)                # Spitze des goldenen Mittelturms
bx, by = spire[0] - (256 - 223) * 2, spire[1] - (188 - 116) * 2
glow = outline(up(bolt, 2), (120, 110, 220))
cv.paste(glow, bx - 1, by - 1, alpha=0.55)
put(cv, bolt, bx, by, 2)

# --- Schneeregen -----------------------------------------------------------------
rain = sprite('d21_rain', B, [296])
rain = tint(rain, (170, 170, 230), 0.5)
cv.paste(rain, 2, 0, alpha=0.8)
cv.paste(rain, 5, 212, alpha=0.8)

vignette(cv, 0.55, 0.55)
frame(cv, [(10, 8, 20), (150, 150, 210), (60, 56, 110)])
print(save(cv, '21_skulltop_storm.png'))
