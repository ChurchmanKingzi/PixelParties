# -*- coding: utf-8 -*-
"""55 Zwei Schnitterinnen – Licht und Schatten: Lizbeth, die Schnitterin des Lichts, und ihr dunkles Gegenstück
stehen vorn im Mittelgang der Kathedrale, wappenartig gespiegelt,
die Sensen nach außen; hinten Orgel, Altar und die
farbigen Lichtsäulen der Fenster.

Quellen (MotiveBoons.xcf):
  - Ebene 62 „Ebene #12“: Kathedralen-Innenraum mit Orgel, Altar, rotem Läufer und Lichtsäulen
    (Hintergrund der Karte „Lizbeth, the Reaper of the Light“), Ausschnitt Mittelschiff; die kleine eingebackene
    Nebenfigur neben dem Altar ist durch Spiegeln der linken Altarseite entfernt
  - Ebene 60 „Ebene #13“ + 59 „Ebene #15“: Lizbeth mit goldener Sense (Szene „Sichtbar #4“; Regel B:
    Figur + Sense vollständig; die weißen Funkenstriche der Sense-Ebene sind in der Szene nicht sichtbar und
    werden weggelassen – es bleiben genau die in der Szene sichtbaren Sense-Pixel)
  - Ebene 57 „Ebene #16“: dunkle Schnitterin mit roter Sense (Szenen „Sichtbar #5–#7“; vollständig)
Skalierung: Kathedrale 2× (Hintergrund, weit hinten), beide Schnitterinnen 5× (Vordergrund, stehen am unteren
Bildrand auf dem Läufer, überdecken Altar und Bänke) – wie Vampir/Schloss in „Count of the Deep“.
"""
from common import *
from e_util import upcanvas, small_canvas, trim_
import numpy as np

B = 'MotiveBoons'
K = 5                                               # Pixelgröße der Schnitterinnen


def lizbeth():
    fig = compose(B, [60], crop=False)
    sc = compose(B, [59], crop=False)
    # nur die Pixel der Sense behalten, die in der Szene „Sichtbar #4“ (Ebene 58) auch zu sehen sind
    scene = layer(B, 58)
    d = np.abs(sc[..., :3].astype(int) - scene[..., :3].astype(int)).max(-1)
    sc[(d > 8) | (scene[..., 3] == 0)] = 0
    # Funkenstriche rechts vom Stielende (weiß, x > Stiel) entfernen – dort liegt in der Szene weißes Glas
    bx = bbox(layer(B, 59))
    Yc, Xc = np.mgrid[0:sc.shape[0], 0:sc.shape[1]]
    white = sc[..., :3].min(-1) > 200
    sc[white & (Xc >= bx[0] + 17) & (Yc < bx[1] + 10)] = 0
    import xcfkit
    acc = xcfkit.over(sc, fig)                      # Ebene 60 liegt über 59
    acc[..., 3] = np.where(acc[..., 3] >= 128, 255, 0)
    return trim_(acc)


def build():
    bg = small_canvas(2)                            # 125×175
    a = layer(B, 62); b = bbox(a)
    cath = a[b[1]:b[3], b[0]:b[2], :3].copy()       # 240×320
    # die im Hintergrund eingebackene Nebenfigur rechts neben dem Altar entfernen: Spalten 177–192 aus der
    # spiegelbildlichen linken Altarseite (Achse x = 160) übernehmen – Läufer/Lichtschein sind dort symmetrisch
    for x in range(177, 193):
        cath[100:131, x] = cath[100:131, 320 - x]
    bg.a[:] = cath[0:175, 98:223]
    # Innenraum abdunkeln (reine Farbmultiplikation, kein Dithering → ruhiger Hintergrund)
    H, W = bg.a.shape[:2]
    f = np.linspace(0.62, 0.42, H)[:, None, None]
    bg.a[:] = (bg.a * f + np.array((8, 4, 20)) * (1 - f) * 0.5).astype(np.uint8)
    vignette(bg, 0.35, 0.6)
    cv = upcanvas(bg, 2)

    # Wappenartig gespiegelt: links die dunkle Schnitterin (Sense nach außen links), rechts Lizbeth
    # (gespiegelt, Sense nach außen rechts); die beiden Sensenstiele stehen innen nebeneinander.
    D = up(compose(B, [57]), K)
    L = up(flip(lizbeth()), K)
    cv.paste(D, 125 - D.shape[1] - 3, 352 - D.shape[0])
    cv.paste(L, 125 + 3, 352 - L.shape[0])
    return cv


if __name__ == '__main__':
    print(save(build(), '55_zwei_schnitterinnen.png'))
