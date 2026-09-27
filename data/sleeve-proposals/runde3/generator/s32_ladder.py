# -*- coding: utf-8 -*-
"""32 Leiter zum Himmel – am Rand der Hausinsel hängt eine Strickleiter ins Nichts; ein Kletterer steigt
herauf, der Himmelsarchäologe wartet oben mit der Spitzhacke, tief unten treiben Wolken und Inseln.

Quellen (MotiveMoe.xcf):
  - Ebene 457 „Hausinsel“ + 449 „Ladder to the Sky“ (Leiter mit Kletterer) in Originallage zusammengesetzt,
    wie auf der Karte „Ladder to the Sky“, 3x
  - Ebene 553 „Hintergrund“: Himmel mit Wolken (1x); Ebene 122 „Ebene #64“: Wolken unter der Insel
  - Ebene 461 „Sky Archeologist“: Archäologe mit Spitzhacke (Karte „Sky Archeologist“), 3x
  - Ebene 429 „Cute Bunny #1“: fliegende Fledermaus-Häschen
"""
from common import *
import numpy as np

F = 'MotiveMoe'
W_, H_ = 250, 350


def build():
    cv = Canvas(W_, H_)
    sky = layer(F, 553)
    cv.a[:] = sky[220:220 + H_, 20:20 + W_, :3]
    SKY = tuple(int(v) for v in sky[300, 5, :3])

    # tief unten: Wolken (Ebene 122) treiben unter der Insel
    cl = compose(F, [122])
    cv.paste(tint(cl, SKY, 0.15), 120, 300)
    cv.paste(flip(tint(cl, SKY, 0.3)), -70, 236)

    # Insel mit Leiter 3x: Ausschnitt so, dass der Pfad zur Kante und die Leiter im Bild sind
    comp = compose(F, [449, 457], crop=False)
    x0, y0 = 177, 326
    win = comp[y0:y0 + 117, x0:x0 + 84]
    W3 = up(win, 3)
    cv.paste(W3, 0, 0)

    # Archäologe wartet an der Kante (3x), schaut hinunter
    arch = sprite('e32_archeologist', F, [461])
    A3 = up(arch, 3)
    cv.paste(A3, 148, 6)

    # fliegende Häschen
    bun = parts(sprite('e32_batbunnies', F, [429]), dil=0)
    cv.paste(up(bun[0], 2), 12, 270)
    cv.paste(flip(up(bun[1], 2)), 176, 214)
    cv.paste(up(bun[2], 1), 200, 318)
    vignette(cv, 0.3, 0.62)
    return cv


if __name__ == '__main__':
    print(save(build(), '32_leiter_zum_himmel.png'))
