# -*- coding: utf-8 -*-
"""28 Fun-Fun Manege – der Totenkopf-Direktor (Vordergrund) präsentiert seine unheimlichen Artisten in der
Manege: den blutenden Masken-Elefanten auf seiner Trommel, den Clown auf dem Ball und den Strongman.

Runde 3b:
  - Zelt, Manege, Lichtkegel und Ballons liegen jetzt im selben 3×-Raster wie die Artisten (vorher 1×-Dithering
    und 2×-Ballons neben 3×-Figuren). Direktor 6× bleibt – er steht eindeutig im Vordergrund, vom unteren
    Bildrand angeschnitten, vor der Manege-Bande (Perspektive).
  - Regel B: Elefant jetzt mit seiner Zirkustrommel (Teil von Ebene 15 „Fun-Fun Elephant #4“), auf der er in der
    Szene „Sichtbar #176“ sitzt – vorher hingen die Blutspuren in der Luft. Strongman jetzt vollständig: vorher
    fehlten die Keule (Teil von Ebene 20 „#2“), die Hand (21 „#3“) und die Kette (17 „#4“) – der erhobene Arm
    endete in einer freischwebenden Faust. Die Aufschrift „1T“ auf der Keulenkugel ist übermalt (kein Text).

Quellen (MotiveMoe.xcf):
  - Direktor: Ebenen 25 „Fun-Fun Director #2“ (Zylinder), 27 „#1“ (Totenkopfmaske), 28 (Körper) – Karte
    „Fun-Fun Circus Director“ (Regel B: vollständig lt. „Sichtbar #175“)
  - Elefant: Ebenen 10–14 + Trommel aus Ebene 15 (Box 241,153–257,162) – Karte „Fun-Fun Circus Elephant“
  - Strongman: Ebenen 17, 18, 19, 21 + Keule aus Ebene 20 (Box 328,95–345,117) – Karte „Fun-Fun Circus Strongman“
  - Clown auf Ball: Ebene 36 „Fun Circus Clown #1“ – Karte „Fun-Fun Circus Clown“
  - Luftballons: einzelne Ballons aus Ebene 23 „Fun-Fun Strongman #6“, zur Zeltkuppel aufgestiegen
  Zeltbahnen, Manege, Lichtkegel: selbst erstellt in Kartenfarben (3×-Raster).
Skalierung: Zelt/Manege/Licht/Ballons/Elefant/Clown/Strongman 3×; Direktor 6× (Vordergrund).
"""
from common import *
from e_util import upcanvas, small_canvas, compose_boxes
import numpy as np, math

F = 'MotiveMoe'
K = 3


def cone(cv, apex, left, right, col, t, y1):
    H, W = cv.a.shape[:2]
    ax, ay = apex
    Y, X = np.mgrid[0:H, 0:W]
    f = (Y - ay) / max(1, (y1 - ay))
    xl = ax + (left - ax) * f; xr = ax + (right - ax) * f
    inside = (Y >= ay) & (Y < y1) & (X >= np.minimum(xl, xr)) & (X <= np.maximum(xl, xr))
    lit = inside & (t > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.55 + np.array(col) * 0.45
    cv.a[:] = a.clip(0, 255).astype(np.uint8)


def elephant():
    return compose_boxes(F, [(10, None), (11, None), (12, None), (13, None), (14, None),
                             (15, (241, 153, 257, 162))])


def strongman():
    s = compose_boxes(F, [(17, None), (18, None), (19, None), (20, (328, 95, 345, 117)), (21, None)])
    # „1T“ auf der Kugel übermalen: helle Pixel im Kugelbereich (links unten) in Kugelfarbe
    h, w = s.shape[:2]
    reg = s[13:24, 0:11]
    c = reg[..., :3].astype(int)
    white = (reg[..., 3] > 0) & (c.min(-1) > 170)
    dark = (reg[..., 3] > 0) & (c.max(-1) < 90) & (c.max(-1) > 25)
    col = np.median(c[dark], 0).astype(np.uint8) if dark.any() else np.array((40, 40, 40), np.uint8)
    reg[white, :3] = col
    return s


def build():
    cv = small_canvas(K)                             # 84×117
    H, W = cv.a.shape[:2]
    RED, DRED, CREAM, DCREAM = (150, 28, 40), (92, 14, 26), (226, 196, 150), (150, 118, 90)
    Y, X = np.mgrid[0:H, 0:W]
    th = BAYER4[Y % 4, X % 4]
    # Zeltbahnen laufen zur Zeltspitze über dem Bild zusammen
    ang = np.arctan2(X - 42, Y + 20)
    stripe = (np.floor(ang / 0.17).astype(int) % 2) == 0
    shade = np.clip(Y / 63.0, 0, 1)
    col_a = np.where(stripe[..., None], np.array(RED), np.array(CREAM))
    col_b = np.where(stripe[..., None], np.array(DRED), np.array(DCREAM))
    cv.a[:] = np.where((shade > th)[..., None], col_b, col_a).astype(np.uint8)
    Yd = np.clip((Y - 20) / 37.0, 0, 1)
    q = (np.floor(Yd * 4 + th) / 4).clip(0, 1) * 0.85
    cv.a[:] = (cv.a * (1 - q[..., None])).astype(np.uint8)

    # Manege: ovaler Sägemehlboden mit rot-weißer Bande
    cx, cy, rx, ry = 42, 72, 52, 21
    d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
    floor = d <= 1
    saw = np.where((((X + Y) % 5 == 0) | ((X * 3 + Y * 5) % 11 == 0))[..., None],
                   np.array((150, 104, 66)), np.array((176, 128, 82)))
    cv.a[floor] = saw[floor]
    band = (d > 1) & (d <= 1.25)
    seg = (np.floor((np.arctan2((Y - cy) / ry, (X - cx) / rx) + math.pi) / 0.3).astype(int) % 2) == 0
    bcol = np.where(seg[..., None], np.array((196, 36, 44)), np.array((236, 226, 206)))
    cv.a[band] = bcol[band]
    cv.a[band & (d > 1.17)] = (60, 10, 20)

    # Scheinwerfer
    cone(cv, (42, -7), 23, 60, (255, 240, 190), 0.4, 67)
    cone(cv, (-7, -7), 4, 27, (255, 200, 230), 0.4, 74)
    cone(cv, (90, -7), 58, 82, (200, 230, 255), 0.4, 74)

    # Ballons an der Zeltkuppel (einzelne Ballons mit Schnur)
    bl = [p for p in parts(sprite('e28_balloons', F, [23]), dil=0) if p.shape == (17, 7, 4)]
    for j, (x, y) in enumerate([(2, 4), (9, -2), (15, 7), (64, 2), (72, -3), (77, 8)]):
        cv.paste(bl[j % len(bl)], x, y)

    # Artisten 3× (= 1× im nativen Raster)
    E = elephant()
    cv.paste(E, 42 - E.shape[1] // 2, 66 - E.shape[0])
    C = sprite('e28_clown', F, [36])
    cv.paste(C, 2, 76 - C.shape[0])
    S = flip(strongman())
    cv.paste(S, W - S.shape[1] - 2, 77 - S.shape[0])
    vignette(cv, 0.35, 0.62)
    big = upcanvas(cv, K)

    # Direktor im Vordergrund 6×
    dire = sprite('e28_director', F, [25, 27, 28])
    D = up(dire, 6)
    paste(big, D, 125, 350 + 24, anchor='b')
    return big


if __name__ == '__main__':
    print(save(build(), '28_funfun_manege.png'))
