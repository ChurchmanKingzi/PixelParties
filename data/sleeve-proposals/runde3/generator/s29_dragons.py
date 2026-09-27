# -*- coding: utf-8 -*-
"""29 Drachenflug – Drachen ziehen über die schwebenden Inseln, ein Dragoneer brüllt ihnen nach.

Quellen (MotiveMoe.xcf):
  - Ebene 553 „Hintergrund“: Himmel mit Wolken (Ausschnitt 1x)
  - Ebene 164 „Ebene #168“: Garteninsel mit Wasserfall (Vordergrund, 2x) – Karten „Green Dragoneer“ u. a.
  - Ebene 447 „Kleine Insel“, 478 „Relic-Insel“: ferne Inseln (1x, dunstig aufgehellt)
  - Ebene 2 „Green Dragoneer #1“ (Karte „Green Dragoneer“), 5 „Red Dragoneer“ (Karte „Red Dragoneer“)
  - Ebene 203 „Blue-Ice Dragon“ + 204 „Ebene #121“ (Eisatem) – Karte „Blue-Ice Dragon“
  - Ebene 299 „Sorbereus“ – Karte „Sorbereus the Adapting Dragon“
"""
from common import *
import numpy as np

F = 'MotiveMoe'
W_, H_ = 250, 350


def haze(s, col, t):
    return tint(s, col, t)


def build():
    cv = Canvas(W_, H_)
    sky = layer(F, 553)
    cv.a[:] = sky[190:190 + H_, 40:40 + W_, :3]
    SKY = tuple(int(v) for v in sky[300, 5, :3])
    # oben etwas dunkler (Tiefe)
    Y, X = np.mgrid[0:H_, 0:W_]
    q = np.clip((80 - Y) / 80.0, 0, 1) * 0.35
    q = (np.floor(q * 4 + BAYER4[Y % 4, X % 4]) / 4) * 0.35
    cv.a[:] = (cv.a * (1 - q[..., None]) + np.array((10, 20, 90)) * q[..., None]).astype(np.uint8)

    # ferne Inseln (1x, dunstig)
    relic = compose(F, [478])
    cv.paste(haze(relic, SKY, 0.45), -96, 52)
    small = compose(F, [447])
    cv.paste(haze(small, SKY, 0.5), 170, 118)

    # Roter Dragoneer sitzt auf der Relic-Insel (2x, dunstig)
    red = sprite('e29_red_dragoneer', F, [5])
    cv.paste(haze(up(red, 2), SKY, 0.3), 70, 62)

    # Sorbereus fliegt im Mittelgrund (3x)
    sor = sprite('e29_sorbereus', F, [299])
    S3 = up(flip(sor), 3)
    cv.paste(S3, 110, 150)

    # Vordergrund: Garteninsel 2x (Wasserfall stürzt über die Kante)
    isl = compose(F, [164])
    I2 = up(isl, 2)
    cv.paste(I2, -330, 212)

    # Green Dragoneer auf der Insel (5x)
    gd = sprite('e29_green_dragoneer', F, [2])
    G4 = up(gd, 5)
    cv.paste(G4, 4, 216)

    # Wolke im Vordergrund links unten

    # Blue-Ice Dragon mit Eisatem, groß oben (4x), stößt nach links
    ice = sprite('e29_ice_dragon', F, [203, 204])
    I4 = up(flip(ice), 4)
    cv.paste(I4, W_ - I4.shape[1] + 6, 4)
    vignette(cv, 0.25, 0.65)
    return cv


if __name__ == '__main__':
    print(save(build(), '29_drachenflug.png'))
