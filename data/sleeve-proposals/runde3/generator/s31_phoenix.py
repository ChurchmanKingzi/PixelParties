# -*- coding: utf-8 -*-
"""31 Phönix-Aufstieg – Prinzessin Mary steigt in Phönixgestalt aus einer Feuersäule über dem Altar der
Tempelinsel in den rosa Himmel, Feuervögel begleiten sie, ein Strahlenkranz leuchtet hinter ihr.

Runde 3b: vorher Mary 3×, Flammenkranz 2×, Feuerschweif 3× (gedreht, wirkte wie Blutstropfen), Vögel 3×+2×,
Insel/Himmel 1×. Jetzt alles einheitlich 3×; die Feuersäule ist der Flammenkranz „Mary #3“ selbst, der vom Altar
aufsteigt (kein zweckentfremdeter Schweif mehr). Strahlen im selben 3×-Raster gedithert.

Quellen (MotiveMoe.xcf):
  - Ebene 556 „Hintergrund-Kopie #1“: rosa Wolkenhimmel (Karte „Cute Princess Mary“)
  - Ebene 486 „Mary-Kopie“ + 487 „Mary #1“: Mary mit Phönixflügeln (Karte „Cute Princess Mary“;
    Regel-B-Vergleich mit „Sichtbar #169“: vollständig)
  - Ebene 488 „Mary #3“: Flammenkranz/Feuersäule
  - Ebene 478 „Relic-Insel“: Tempelplatz mit Säulen und Altarstein (leicht rosa getönt)
  - Ebene 220 „Ebene #105“: kleine Feuervögel (Karte „Victory Phoenix Cannon“)
Skalierung: alles 3× (Szene im nativen Raster 84×117 gebaut und als Ganzes verdreifacht).
"""
from common import *
from e_util import upcanvas, small_canvas
import numpy as np, math

F = 'MotiveMoe'
K = 3


def build():
    cv = small_canvas(K)                           # 84×117
    H, W = cv.a.shape[:2]
    sky = layer(F, 556)[64:64 + H, 150:150 + W, :3]
    cv.a[:] = sky
    CX, CY = 42, 40
    Y, X = np.mgrid[0:H, 0:W]
    # Strahlenkranz
    ang = np.arctan2(Y - CY, X - CX)
    r = np.hypot(X - CX, Y - CY)
    wedge = (np.floor((ang + math.pi) / (2 * math.pi / 20)).astype(int) % 2) == 0
    t = np.clip(1 - r / 90.0, 0, 1) * 0.9
    lit = wedge & (t > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.45 + np.array((255, 176, 90)) * 0.55
    cv.a[:] = a.astype(np.uint8)

    # Tempelinsel unten: Mary ist bereits über den Säulen des Tempelplatzes aufgestiegen
    relic = compose(F, [478])
    relic = tint(relic, (240, 110, 200), 0.18)
    cv.paste(relic, CX - 105, 80)

    # Flammenkranz hinter Mary (die offene Mitte wird von ihrem Körper gefüllt)
    burst = hsv_shift(compose(F, [488]), -10, 1.05, 0.86)   # 104×152, röter/dunkler: Flügel heben sich ab
    cv.paste(burst, CX - burst.shape[1] // 2, 70 - burst.shape[0])

    # Feuervögel
    bird = sprite('e31_firebird', F, [220])        # 12×20
    cv.paste(bird, 3, 70)
    cv.paste(flip(bird), 61, 62)

    # Mary mit Phönixflügeln
    mary = sprite('e31_mary_phoenix', F, [486, 487])   # 57×78
    cv.paste(mary, CX - mary.shape[1] // 2, 8)
    vignette(cv, 0.3, 0.62)
    return upcanvas(cv, K)


if __name__ == '__main__':
    print(save(build(), '31_phoenix_aufstieg.png'))
