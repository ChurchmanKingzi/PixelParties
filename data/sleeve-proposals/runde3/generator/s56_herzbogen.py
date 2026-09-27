# -*- coding: utf-8 -*-
"""56 Der Herzbogen – Stillleben bei Nacht: Im Säulenheiligtum der Relic-Insel ruht der „Heart-Shaped Bow“
auf seinem Altarstein, bewacht von drei steinernen Orakel-Statuen; ein Lichtschein um den Altar lässt nur den
Bogen und seine Umgebung hell leuchten, der Rest des Tempelplatzes versinkt in stufenweisem Dunkel.

Quellen (MotiveMoe.xcf), zusammengesetzt in Originallage wie in der Szene „Sichtbar #14“ (Karte „Heart-Shaped
Bow, the Final Proof of Cuteness“), ohne die beiden Figuren der Szene:
  - Ebene 478 „Relic-Insel“: Tempelplatz mit Säulen und Altarstein
  - Ebene 145 „Ebene #8“: drei Orakel-Statuen auf Sockeln
  - Ebene 467 „Heart-Shaped Bow“: Herzbogen mit Funkeln (Regel B: vollständig, einzige Nachbarebenen in der
    Szene sind die Statuen und die nicht verwendete Figur „Mine Mine Mine“)
  - Ebene 468 „Ebene #2“: kleine rosa Herzen (einige, steigen vom Bogen auf)
  Licht: selbst erstellt – konzentrische Helligkeitsstufen (6 harte Stufen, je natives Pixel) um den Bogen.
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
    scene = compose(F, [145, 467, 478], crop=False)
    # Fenster um den Bogen (Bogen-Mitte in Ebenen-Koordinaten ≈ 251, 144)
    x0, y0 = 251 - W // 2, 144 - 50
    win = scene[y0:y0 + H, x0:x0 + W]
    cv.a[:] = (18, 12, 34)
    cv.paste(win, 0, 0)

    # Nacht mit Lichtkegel: Helligkeit in 6 Stufen, elliptisch um den Altar
    Y, X = np.mgrid[0:H, 0:W]
    d = np.hypot((X - W / 2) / 1.0, (Y - 54) / 1.25)
    lv = np.clip(np.floor(d / 10.0), 0, 5)
    f = np.array([1.0, 0.78, 0.56, 0.4, 0.3, 0.22])[lv.astype(int)]
    night = np.array((20, 14, 46))
    cv.a[:] = (cv.a * f[..., None] + night * (1 - f[..., None]) * 0.6).astype(np.uint8)
    # Bogen noch einmal unverändert obenauf (volle Leuchtkraft)
    bow = compose(F, [467], crop=False)[y0:y0 + H, x0:x0 + W]
    cv.paste(bow, 0, 0)

    # ein paar Herzen steigen auf
    hearts = parts(sprite('e56_hearts', F, [468]), dil=0)
    for j, (x, y) in enumerate([(29, 38), (52, 34), (33, 28), (48, 22)]):
        cv.paste(hearts[j % len(hearts)], x, y)
    return upcanvas(cv, K)


if __name__ == '__main__':
    print(save(build(), '56_herzbogen.png'))
