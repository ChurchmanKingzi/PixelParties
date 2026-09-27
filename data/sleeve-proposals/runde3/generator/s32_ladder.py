# -*- coding: utf-8 -*-
"""32 Leiter zum Himmel – Vertigo-Blick über die Kante der Hausinsel: die Leiter hängt ins Nichts, ein
Kletterer steigt herauf, oben gräbt der Himmelsarchäologe auf festem Grasboden, unten nur Himmel, Wolken und
Fledermaus-Häschen.

Runde 3b: Archäologe schlug vorher mit erhobener Spitzhacke über die Inselkante ins Leere. Jetzt die
grabende Pose aus „Mine Mine Mine“ (Spitzhacke unten, Spitze steckt im Gras) auf der Grasfläche links vom
Steinpfad, deutlich von der Kante entfernt. Einheitlich 3× (vorher Himmel/Wolken 1×, Häschen 2×/1×).

Quellen (MotiveMoe.xcf):
  - Ebene 457 „Hausinsel“ + 449 „Ladder to the Sky“ (Leiter mit Kletterer) in Originallage zusammengesetzt,
    wie auf der Karte „Ladder to the Sky“
  - Ebene 459 „Mine Mine Mine“: rechter Teil = Sky Archeologist beim Graben (Szene „Sichtbar #14“; Regel-B-
    Prüfung: Figur vollständig, einzige Nachbarebene 467 ist der Herz-Bogen einer anderen Figur)
  - Ebene 553 „Hintergrund“: Himmel mit Wolken; Ebene 122 „Ebene #64“: einzelne Wolke unter der Insel
  - Ebene 429 „Cute Bunny #1“: Fledermaus-Häschen (Karte „Cute Bunny“)
Skalierung: alles 3× (Szene im nativen Raster 84×117 gebaut und als Ganzes verdreifacht).
"""
from common import *
from e_util import upcanvas, small_canvas
import numpy as np

F = 'MotiveMoe'
K = 3


def build():
    cv = small_canvas(K)                              # 84×117
    H, W = cv.a.shape[:2]
    sky = layer(F, 553)
    cv.a[:] = sky[300:300 + H, 250:250 + W, :3]
    SKY = tuple(int(v) for v in sky[300, 5, :3])

    # eine Wolke tief unten, leicht im Dunst
    cl = compose(F, [122])                           # 36×133
    cv.paste(tint(cl, SKY, 0.2), -30, 96)

    # Fledermaus-Häschen unter der Insel (hinter der Leiter)
    bun = parts(sprite('e32_batbunnies', F, [429]), dil=0)
    cv.paste(flip(bun[2]), 48, 72)
    cv.paste(bun[0], 4, 92)

    # Insel mit Leiter (Originallage)
    comp = compose(F, [449, 457], crop=False)
    x0, y0 = 169, 309
    win = comp[y0:y0 + H, x0:x0 + W]
    cv.paste(win, 0, 0)

    # Archäologe gräbt auf dem Gras links vom Pfad (Spitzhacke trifft Grasboden)
    arch = parts(sprite('e32_archeologist_dig', F, [459]), dil=1)[2]   # 29×17
    cv.paste(arch, 6, 2)

    vignette(cv, 0.3, 0.62)
    return upcanvas(cv, K)


if __name__ == '__main__':
    print(save(build(), '32_leiter_zum_himmel.png'))
