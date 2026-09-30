# -*- coding: utf-8 -*-
"""10 Wowhalla Watch – Gegner „Cool Gang“ (Structure Deck Cool Gang), Held: Thorad, Strength of Coolness.

Bildidee (nach Nutzer-Feedback): Thorad steht groß und frontal im Schnee vor Wowhalla, dem großen Schloss der Coolness
(Cover-Karte „Wowhalla, the Hall of the Cool“) – der Wächter vor seiner Halle. Hinter ihm ragt der Hauptturm mit den
grünen Stachel-Dächern auf (dieselben Dächer, auf denen er auf seiner Karte steht), über dem Schloss spannt sich der
Regenbogen der Coolness (Bifab, Bridge to Coolness / Rainbow Road von Swellpnir), die Zahnräder der Halle drehen sich.

Quellen (MotiveCoolhalla.xcf, alle im selben Koordinatensystem, Ausschnitt x 122–372, y 30–380):
  Ebene 221 „Ebene #16“  – Base-Thorad (rechte Figur; Szene „Sichtbar #5“ = Ebene 264, Lage 173,50; 0 px Abweichung).
  Ebene 253 „Ebene #11“  – Wowhalla-Schloss; 254 „Ebene #10“ – Zahnräder; 251 „Ebene #4“ – Eissaum am Schlossfuß.
  Ebene 257 „Ebene #12“  – Himmel mit Wolken; 255/256 – Schneehügel davor.
  Ebene 207 „Ebene #32“  – Regenbogen (Rainbow Road der Swellpnir-/Bifab-Karten).
  (Ebene 252, die weiche Rauchsäule, bewusst weggelassen – weichgezeichnet, keine Pixelgrafik.)
Selbst gezeichnet: Schatten unter Thorad, leichte Abdunklung des Schlosses hinter ihm (Tiefe).

Skalierung (Tiefenebenen):
  Hintergrund 1× (250×350): Himmel, Regenbogen, Zahnräder, ganzes Wowhalla-Schloss, Schnee (Originalpixel der
                            Szene – das Schloss ist 326 px breit und passt nur in Originalgröße; weit hinten)
  Vordergrund 6× (42×59):   Thorad (132×156 px) mit Schatten
"""
import math
import numpy as np
from common import *  # noqa

B = 'MotiveCoolhalla'
thorad = parts(layer(B, 221)[50:95, 170:230], dil=1)[-1]            # 26×22 (rechte Figur = Thorad)
X0, Y0 = 122, 30                                                    # Ausschnitt im Szenen-Koordinatensystem

# ================================================================== Hintergrund 1× (250×350): das ganze Schloss wie auf der Cover-Karte
W1, H1 = 250, 350
sky = compose(B, [257], crop=False)
rest = compose(B, [251, 253, 254, 255, 256], crop=False)
rain = compose(B, [207], crop=False)
SH, SW = sky.shape[:2]
bg = np.zeros((H1, W1, 4), np.uint8); bg[..., 3] = 255
yy = np.clip(np.arange(H1) + Y0, 0, SH - 1)
bg[..., :3] = sky[yy][:, X0:X0 + W1, :3]
# Regenbogen (Rainbow Road) hinter den linken Türmen aufsteigend
rb = rain[..., 3] > 0
ys, xs = np.nonzero(rb)
dx, dy = (X0 - 20) - xs.min(), (Y0 + 28) - ys.min()
for y, x in zip(ys, xs):
    Y, X = y + dy - Y0, x + dx - X0
    if 0 <= Y < H1 and 0 <= X < W1: bg[Y, X, :3] = rain[y, x, :3]
sub = rest[Y0:Y0 + H1, X0:X0 + W1]
m = sub[..., 3] > 0
bg[:sub.shape[0]][m, :3] = sub[m, :3]
SHIFT = -1
last = sub.shape[0] - 1                                             # Szene endet bei y 257: Schneefeld fortsetzen
for y in range(last - 1, H1):                                       # diagonale Schneestreifen fortsetzen
    bg[y, :, :3] = np.roll(bg[y - 1, :, :3], SHIFT, axis=0)

# ================================================================== Vordergrund 6× (42×59)
W6, H6 = 42, 59
fg = np.zeros((H6, W6, 4), np.uint8)
TX = 21 - thorad.shape[1] // 2
FEET = 54
for i in range(-10, 11):
    for d in (0, 1):
        if abs(i) <= 10 - d * 2:
            fg[FEET + 1 + d, 21 + i, :3] = (120, 150, 196); fg[FEET + 1 + d, 21 + i, 3] = 150
m = thorad[..., 3] > 0
fg[FEET + 1 - thorad.shape[0]:FEET + 1, TX:TX + thorad.shape[1]][m] = thorad[m]

cv = Canvas(250, 350)
cv.paste(bg, 0, 0)
cv.paste(up(fg, 6), -1, 0)
save(cv, '10_wowhalla_watch.png')
print('ok')
