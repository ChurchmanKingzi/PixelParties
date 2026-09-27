# -*- coding: utf-8 -*-
"""31 Phönix-Aufstieg – Prinzessin Mary steigt mit Phönixflügeln aus einer Flammensäule in den rosa Himmel.

Quellen (MotiveMoe.xcf):
  - Ebene 556 „Hintergrund-Kopie #1“: rosa Wolkenhimmel (Karte „Cute Princess Mary“)
  - Ebene 486 „Mary-Kopie“ + 487 „Mary #1“: Mary in Phönixgestalt mit Flügeln (Karte „Cute Princess Mary“), 4x
  - Ebene 488 „Mary #3“: Flammenkranz, 2x
  - Ebene 422 „Cute Phoenix“: Flammensäule/Feuerschweif (Karte „Cute Phoenix“), 3x
  - Ebene 220 „Ebene #105“: kleine Feuervögel (Karte „Victory Phoenix Cannon“), 3x
  Strahlenkranz: gedithert, selbst erstellt in den Orangetönen der Karte.
"""
from common import *
import numpy as np, math

F = 'MotiveMoe'
W_, H_ = 250, 350


def build():
    cv = Canvas(W_, H_)
    sky = layer(F, 556)[63:376, 100:350, :3]           # 313 Zeilen
    ext = sky[::-1][:H_ - sky.shape[0]]
    cv.a[:] = np.concatenate([sky, ext], 0)

    # Strahlenkranz um die Mitte (Farbe wie im Kartenhintergrund)
    CX, CY = 125, 128
    Y, X = np.mgrid[0:H_, 0:W_]
    ang = np.arctan2(Y - CY, X - CX)
    r = np.hypot(X - CX, Y - CY)
    wedge = (np.floor((ang + math.pi) / (2 * math.pi / 24)).astype(int) % 2) == 0
    t = np.clip(1 - r / 230.0, 0, 1) * 0.85
    lit = wedge & (t > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.45 + np.array((255, 170, 80)) * 0.55
    cv.a[:] = a.astype(np.uint8)

    # Flammenkranz 2x hinter Mary
    burst = compose(F, [488])
    B2 = up(burst, 2)
    cv.paste(B2, CX - B2.shape[1] // 2, CY - 150)

    # Feuerschweif unter Mary (Flammensäule, 3x) – runde Spitze oben an ihren Füßen
    trail = compose(F, [422])
    trail = trail[:96]                                    # ohne kleinen Vogel/Schatten am Ende
    T3 = up(trail, 3)
    cv.paste(T3, CX - T3.shape[1] // 2, 214)

    # kleine Feuervögel begleiten sie
    bird = sprite('e31_firebird', F, [220])
    b3 = up(bird, 3)
    cv.paste(b3, 14, 262)
    cv.paste(flip(b3), 178, 238)
    cv.paste(up(bird, 2), 48, 312)
    cv.paste(up(bird, 2), 190, 300)

    # Mary mit Phönixflügeln 3x
    mary = sprite('e31_mary_phoenix', F, [486, 487])
    M4 = up(mary, 4)
    cv.paste(M4, CX - M4.shape[1] // 2, CY - 96)
    vignette(cv, 0.3, 0.62)
    return cv


if __name__ == '__main__':
    print(save(build(), '31_phoenix_aufstieg.png'))
