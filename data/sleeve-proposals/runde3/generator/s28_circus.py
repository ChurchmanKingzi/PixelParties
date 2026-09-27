# -*- coding: utf-8 -*-
"""28 Fun-Fun Manege – der Zirkusdirektor präsentiert seine (unheimlichen) Artisten.

Quellen (MotiveMoe.xcf):
  - Direktor: Ebenen 25 „Fun-Fun Director #2“ (Zylinder), 27 „Fun-Fun Director #1“ (Totenkopfmaske),
    28 „Fun-Fun Director“ (Körper) – Karte „Fun-Fun Circus Director“
  - Elefant: Ebenen 10, 11, 12, 13, 14 („Fun-Fun Elephant“, „#1“ Blut, „#2“ Maske, „#3“, „#5“) – Karte „Fun-Fun Circus Elephant“
  - Strongman: Ebenen 18 „Fun-Fun Strongman #1“ (Maske) + 19 „Fun-Fun Strongman“ – Karte „Fun-Fun Circus Strongman“
  - Clown auf Ball: Ebene 36 „Fun Circus Clown #1“ – Karte „Fun-Fun Circus Clown“
  - Luftballons: Ebene 23 „Fun-Fun Strongman #6“
  Zelt (Streifen), Manege und Scheinwerfer: selbst erstellt in Farben der Karten.
"""
from common import *
import numpy as np, math

F = 'MotiveMoe'
W_, H_ = 250, 350


def cone(cv, apex, left, right, col, t, y1):
    ax, ay = apex
    Y, X = np.mgrid[0:H_, 0:W_]
    f = (Y - ay) / max(1, (y1 - ay))
    xl = ax + (left - ax) * f; xr = ax + (right - ax) * f
    inside = (Y >= ay) & (Y < y1) & (X >= np.minimum(xl, xr)) & (X <= np.maximum(xl, xr))
    lit = inside & (t > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.55 + np.array(col) * 0.45
    cv.a[:] = a.clip(0, 255).astype(np.uint8)


def build():
    cv = Canvas(W_, H_, (20, 6, 12))
    RED, DRED, CREAM, DCREAM = (150, 28, 40), (92, 14, 26), (226, 196, 150), (150, 118, 90)
    # Zeltplane: Bahnen, die zur Zeltspitze (125, -60) zusammenlaufen
    Y, X = np.mgrid[0:H_, 0:W_]
    ang = np.arctan2(X - 125, Y + 60)
    stripe = (np.floor(ang / 0.16).astype(int) % 2) == 0
    shade = np.clip((Y) / 190.0, 0, 1)   # nach unten dunkler (Zeltwand im Schatten)
    th = BAYER4[Y % 4, X % 4]
    col_a = np.where(stripe[..., None], np.array(RED), np.array(CREAM))
    col_b = np.where(stripe[..., None], np.array(DRED), np.array(DCREAM))
    tent = np.where((shade > th)[..., None], col_b, col_a)
    cv.a[:] = tent.astype(np.uint8)
    # Tiefe: Zeltwand unten fast schwarz
    ordered(cv, 0, 110, W_, 200, (0, 0, 0), (0, 0, 0), lambda x, y: 0)
    a = cv.a.astype(float)
    Yd = np.clip((Y - 60) / 110.0, 0, 1)
    q = (np.floor(Yd * 4 + th) / 4).clip(0, 1) * 0.85
    cv.a[:] = (a * (1 - q[..., None])).astype(np.uint8)

    # Manege: ovaler Sägemehlboden mit rot-weißer Bande
    cx, cy, rx, ry = 125, 214, 150, 62
    d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
    floor = d <= 1
    saw = np.where((((X + Y) % 7 == 0) | ((X * 3 + Y * 5) % 11 == 0))[..., None], np.array((150, 104, 66)), np.array((176, 128, 82)))
    cv.a[floor] = saw[floor]
    band = (d > 1) & (d <= 1.22) & (Y > cy - ry - 16)
    seg = (np.floor((np.arctan2((Y - cy) / ry, (X - cx) / rx) + math.pi) / 0.22).astype(int) % 2) == 0
    upper = Y < cy
    bcol = np.where(seg[..., None], np.array((196, 36, 44)), np.array((236, 226, 206)))
    bcol = np.where((upper & ~((Y - cy) < -ry * 1.02))[..., None], bcol, bcol)
    cv.a[band] = bcol[band]
    top_edge = band & (d > 1.16)
    cv.a[top_edge] = (60, 10, 20)

    # Scheinwerfer auf die Artisten
    cone(cv, (125, -20), 70, 180, (255, 240, 190), 0.4, 200)
    cone(cv, (-20, -20), 14, 80, (255, 200, 230), 0.4, 222)
    cone(cv, (270, -20), 176, 244, (200, 230, 255), 0.4, 222)

    # Luftballons oben (zur Zeltkuppel aufgestiegen)
    bal = sprite('e28_balloons', F, [23])
    B2 = up(bal, 2)
    cv.paste(B2, -86, -60)
    cv.paste(flip(B2), W_ - B2.shape[1] + 90, -66)

    # Elefant in der Mitte 3x
    ele = sprite('e28_elephant', F, [10, 11, 12, 13, 14])
    E = up(ele, 3)
    paste(cv, E, 125, 196, anchor='b')

    # Clown auf dem Ball links 3x, Strongman rechts 3x
    clown = sprite('e28_clown', F, [36])
    C = up(clown, 3)
    cv.paste(C, 2, 222 - C.shape[0])
    strong = sprite('e28_strongman', F, [18, 19])
    S = up(flip(strong), 3)
    cv.paste(S, W_ - S.shape[1] - 4, 226 - S.shape[0])

    # Direktor im Vordergrund 6x
    dire = sprite('e28_director', F, [25, 27, 28])
    D = up(dire, 6)
    paste(cv, D, 125, H_ + 24, anchor='b')
    vignette(cv, 0.35, 0.62)
    return cv


if __name__ == '__main__':
    print(save(build(), '28_funfun_manege.png'))
