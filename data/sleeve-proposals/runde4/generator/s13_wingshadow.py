# -*- coding: utf-8 -*-
"""13 Wingshadow – Luftbild: Thunderstruck Waflav gleitet mit ausgebreiteten Flügeln und knisternder
Ladung über ein Dorf in Draufsicht; tief unter ihm fällt sein kleiner Schatten auf Weg und Treppe.

Quellen (MotiveGN.xcf):
  Ebene 13 „Thunder-Struck Waflav“ (Körper) + Ebene 14 „Thunder-Struck Waflav #1“ (Flügel)
      + Funken aus Ebene 12 „Thunder-Struck Waflav #4“ (ohne den großen Blitzstrahl)
      (geprüft gegen Szene 11 „Sichtbar #141“, Karte „Thunderstruck Waflav“: 1173/1184 Pixel identisch)
  Ebene 97 „Ebene #279“ – Dorfkarte (Häuser, Weg, Treppen), Ausschnitt ohne „PUB“-Schild und FPS-Anzeige
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Dorfkarte + Schatten 2× (Raster 125×175) – der Schatten liegt auf dem Boden und hat dessen Pixelgröße;
  Waflav 3× (Raster 84×117), hoch über dem Dorf, eindeutig im Vordergrund.
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350

# ---------------------------------------------------------------- Boden (2×)
m = layer(D, 97)
X0, Y0 = 11 + 178, 17 + 62                          # Ebene 97 liegt bei (11, 17): Weg, Treppen, Bäume, Teich
ground = m[Y0:Y0 + 175, X0:X0 + 125, :3].astype(float)
# Gewitterstimmung: etwas entsättigt, abgedunkelt und bläulich
lum = ground.mean(-1, keepdims=True)
ground = (ground * 0.7 + lum * 0.3) * 0.64 + np.array([6, 10, 28])
gcv = Canvas(125, 175)
gcv.a[:] = ground.clip(0, 255).astype(np.uint8)

body = sprite('c13_waflav', D, [13, 14])            # Körper + Flügel (76×38)

# Schatten (2×): Silhouette von Körper + Flügeln, nach rechts unten versetzt
SX, SY = 74, 122                                    # Mitte des Schattens im 125er-Raster
sh = body[..., 3] > 0
h, w = sh.shape
for j in range(h):
    for i in range(w):
        if sh[j, i]:
            X, Y = SX - w // 2 + i, SY - h // 2 + j
            if 0 <= X < 125 and 0 <= Y < 175:
                gcv.a[Y, X] = (gcv.a[Y, X] * 0.42).astype(np.uint8)
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([gcv.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.55, 0.55, g=2)

# ---------------------------------------------------------------- Waflav (3×)
# Figur inkl. Funken in Originallage (Leinwand der xcf), Blitzstrahl weggelassen
fig = compose(D, [13, 14], crop=False)
spk = layer(D, 12).copy()
# großen Blitzstrahl (zusammenhängender Teil 44×28) entfernen
import cv2
mk = (spk[..., 3] > 0).astype(np.uint8)
n, lab = cv2.connectedComponents(mk, connectivity=8)
for k in range(1, n):
    ys, xs = np.where(lab == k)
    if (xs.max() - xs.min() + 1, ys.max() - ys.min() + 1) == (28, 44) or len(xs) > 200:
        spk[lab == k] = 0
from xcfkit import over
allf = over(spk, fig)            # Funken unter die Figur
allf = over(allf, fig)
b = bbox(allf)
F = allf[b[1]:b[3], b[0]:b[2]].copy(); F[..., 3] = np.where(F[..., 3] >= 128, 255, 0)
FX = up(F, 3)
cx, cy = 125, 112
cv.paste(FX, cx - FX.shape[1] // 2, cy - FX.shape[0] // 2)
print(F.shape)
print(save(cv, '13_wingshadow.png'))
