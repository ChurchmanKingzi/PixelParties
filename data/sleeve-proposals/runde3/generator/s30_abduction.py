# -*- coding: utf-8 -*-
"""30 Besuch aus der Tiefe – Life-Searcher-Invasoren holen mit grünen Suchstrahlen einen Gartenzwerg und
ein Cheerleader-Häschen von einer kleinen Himmelsinsel, das Mutterschiff wartet im All darüber.

Runde 3b: ALLES in einheitlich 2× (Szene wird im nativen Raster 125×175 gebaut und als Ganzes verdoppelt),
statt vorher 1×-Insel/-Himmel neben 2×-Figuren und 3×-Mutterschiff. Die Häuschen-Insel (240 px breit) passte
in 2× nicht ins Bild und wurde durch die „Kleine Insel“ ersetzt. Das Cheerleader-Häschen war vorher an der
Spalte 48 der Ebene abgeschnitten (linker Pompom fehlte) – jetzt vollständig (s. u.).

Quellen:
  MotiveBoons.xcf
  - Ebene 4 „Ebene #21“: Sternenhimmel mit roter Sonne (Karten „Cosmic Manipulation“ u. a.)
  - Ebene 25 „Ebene #35“: Mutterschiff (Karte „Arrival from the Cosmic Depths“)
  - Ebene 22 „Ebene #36“: drei Life-Searcher-Invasoren (Karte „Life-Searcher from the Cosmic Depths“);
    Strahlfarbe/-form nach Ebene 23 „Ebene #37“, als gedithertes Trapez selbst gezeichnet
  MotiveMoe.xcf
  - Ebene 553 „Hintergrund“: Himmel mit Wolken
  - Ebene 447 „Kleine Insel“: schwebende Grasinsel mit Ranken
  - Ebene 212 „Inconspicuous Lawn“ (Gartenzwerg, Karte „Inconspicuous Lawn Gnome“)
  - Ebene 442 „Cheering Rabbit“: drei Häschen nebeneinander (Karte „Cute Bunny“, Szene „Sichtbar #142“).
    Beim rechten Häschen verdeckt der vordere Pompom des mittleren den linken Pompom teilweise; die Figur ist
    symmetrisch (Achse zwischen Spalte 57/58), daher wird die linke Arm-/Pompom-Hälfte aus der vollständigen
    rechten gespiegelt → Häschen mit zwei ganzen Pompoms.
Skalierung: alles 2× (Himmel, All, Insel, Mutterschiff, Invasoren, Zwerg, Häschen, Strahlen, Vignette).
"""
from common import *
from e_util import upcanvas, small_canvas, trim_
import numpy as np

B, M = 'MotiveBoons', 'MotiveMoe'
K = 2


def rabbit():
    """Rechtes Häschen aus Ebene 442, linke Pompom-Hälfte gespiegelt ergänzt."""
    l = sprite('e30_rabbits', M, [442])           # 27×72, drei Häschen
    r = np.zeros((27, 28, 4), np.uint8)
    r[:, 9:28] = l[:, 53:72]                      # Körper + rechter Arm/Pompom (vollständig)
    for x in range(44, 53):                       # linke Seite = Spiegel an Achse 57.5
        r[:, x - 44] = l[:, 115 - x]
    return trim_(r)


def beam(cv, cx, ytop, ybot, w0, w1, col, t):
    H, W = cv.a.shape[:2]
    Y, X = np.mgrid[0:H, 0:W]
    f = np.clip((Y - ytop) / max(1, ybot - ytop), 0, 1)
    l = cx - w0 - (w1 - w0) * f; r = cx + w0 + (w1 - w0) * f
    inside = (Y >= ytop) & (Y < ybot) & (X >= l) & (X < r)
    edge = inside & ((X < l + 1) | (X >= r - 1))
    tt = np.where(edge, t + 0.3, t)
    lit = inside & (tt > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.35 + np.array(col) * 0.65
    cv.a[:] = a.clip(0, 255).astype(np.uint8)


def build():
    cv = small_canvas(K)                           # 125×175 natives Raster
    H, W = cv.a.shape[:2]
    sky = layer(M, 553)
    cv.a[:] = sky[250:250 + H, 170:170 + W, :3]
    Y, X = np.mgrid[0:H, 0:W]
    # Nacht: Himmel nach oben stärker abgedunkelt und ins Blaue verschoben (gedithert, 4 Stufen)
    q = np.clip(0.75 - (Y - 60) / 260.0, 0.35, 0.75)
    q = np.floor(q * 4 + BAYER4[Y % 4, X % 4]) / 4
    night = np.array((6, 10, 40))
    cv.a[:] = (cv.a * (1 - q[..., None]) + night * q[..., None]).astype(np.uint8)
    # oben: Weltall, rote Sonne links oben angeschnitten; weicher Dither-Übergang in den Nachthimmel
    sp = layer(B, 4); b = bbox(sp)
    space = sp[b[1]:b[3], b[0]:b[2], :3]           # 240×320, Sonne bei (160, 120)
    top = np.zeros((H, W, 3), np.uint8); top[:] = space[-1, -1]
    top[:120] = space[102:222, 186:186 + W]
    t = np.clip((96 - Y) / 50.0, 0, 1)
    m = t > BAYER4[Y % 4, X % 4]
    cv.a[m] = top[m]

    # kleine Himmelsinsel unten
    isl = compose(M, [447])                        # 192×128
    isl = hsv_shift(isl, 8, 0.85, 0.62)            # im Nachtlicht
    IX, IY = -2, 100
    cv.paste(isl, IX, IY)

    # Mutterschiff oben
    ship = sprite('e30_mothership', B, [25])       # 45×82
    cv.paste(ship, (W - ship.shape[1]) // 2, 3)

    # Invasoren mit Suchstrahlen
    sq = parts(sprite('e30_searchers', B, [22]), dil=0)   # je 34×19
    GREEN = (40, 240, 40)
    # (Invasor x, y) ; Strahl endet auf dem Gras der Insel
    L = (15, 50); R = (98, 44)
    beam(cv, L[0] + 9, L[1] + 30, 150, 3, 10, GREEN, 0.55)
    beam(cv, R[0] + 9, R[1] + 30, 140, 3, 10, GREEN, 0.55)
    gnome = sprite('e30_gnome', M, [212])          # 24×15
    rab = rabbit()
    cv.paste(gnome, L[0] + 9 - gnome.shape[1] // 2, 100)
    cv.paste(rab, R[0] + 9 - rab.shape[1] // 2, 84)
    cv.paste(sq[0], L[0], L[1])
    cv.paste(flip(sq[1]), R[0], R[1])
    cv.paste(sq[2], (W - 19) // 2, 48)             # dritter kommt gerade aus dem Schiff
    vignette(cv, 0.3, 0.6)
    return upcanvas(cv, K)


if __name__ == '__main__':
    print(save(build(), '30_besuch_aus_der_tiefe.png'))
