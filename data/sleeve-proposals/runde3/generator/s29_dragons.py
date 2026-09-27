# -*- coding: utf-8 -*-
"""29 Drachenflug – über einer Himmelsinsel ziehen der Blue-Ice Dragon und Sorbereus ihre Bahnen, unten auf
der Insel brüllen der Green und der Red Dragoneer ihnen nach.

Runde 3b: vorher gemischte Pixelgrößen (Inseln 1×, Red Dragoneer 2× auf 1×-Insel, Sorbereus 3×, Ice Dragon 4×,
Green Dragoneer 5× auf 2×-Insel). Jetzt alles einheitlich 3×. Der Eisatem (Ebene 204) entfällt – er traf
vorher nichts Sinnvolles.

Quellen (MotiveMoe.xcf):
  - Ebene 553 „Hintergrund“: Himmel mit Wolken
  - Ebene 447 „Kleine Insel“: Grasinsel (Boden der beiden Dragoneer)
  - Ebene 203 „Blue-Ice Dragon“ (Karte „Blue-Ice Dragon“; Regel B: vollständig, einzige weitere Ebene der Figur
    ist der Atem 204)
  - Ebene 299 „Sorbereus“ (Karte „Sorbereus the Adapting Dragon“)
  - Ebene 2 „Green Dragoneer #1“ (Karte „Green Dragoneer“), Ebene 5 „Red Dragoneer“ (Karte „Red Dragoneer“)
Skalierung: alles 3× (Szene im nativen Raster 84×117 gebaut und als Ganzes verdreifacht).
"""
from common import *
from e_util import upcanvas, small_canvas
import numpy as np

F = 'MotiveMoe'
K = 3


def build():
    cv = small_canvas(K)                           # 84×117
    H, W = cv.a.shape[:2]
    sky = layer(F, 553)
    cv.a[:] = sky[222:222 + H, 196:196 + W, :3]
    Y, X = np.mgrid[0:H, 0:W]
    q = np.clip((50 - Y) / 50.0, 0, 1) * 0.4        # oben tiefer blau
    q = np.floor(q * 4 + BAYER4[Y % 4, X % 4]) / 4 * 0.4
    cv.a[:] = (cv.a * (1 - q[..., None]) + np.array((10, 20, 90)) * q[..., None]).astype(np.uint8)

    # Wolkenbank hinter der Insel (Ebene #64)
    cl = compose(F, [122])                         # 36×133
    cv.paste(cl, -40, 66)
    # Insel unten
    isl = compose(F, [447])                        # 192×128
    IX, IY = -24, 78
    cv.paste(isl, IX, IY)

    # Drachen am Himmel
    ice = sprite('e29_ice_dragon_body', F, [203])  # 28×36
    cv.paste(ice, 3, 5)
    sor = sprite('e29_sorbereus', F, [299])        # 21×45
    cv.paste(flip(sor), 36, 42)

    # Dragoneer auf dem Gras
    gd = sprite('e29_green_dragoneer', F, [2])     # 30×28
    cv.paste(flip(gd), 4, 80)
    red = sprite('e29_red_dragoneer', F, [5])      # 27×32
    cv.paste(red, 48, 84)
    vignette(cv, 0.25, 0.65)
    return upcanvas(cv, K)


if __name__ == '__main__':
    print(save(build(), '29_drachenflug.png'))
