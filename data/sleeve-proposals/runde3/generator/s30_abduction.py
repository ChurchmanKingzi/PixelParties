# -*- coding: utf-8 -*-
"""30 Besuch aus der Tiefe – Life-Searcher-Invasoren holen mit grünen Suchstrahlen Bewohner einer
Himmelsinsel ins All, das Mutterschiff wartet.

Quellen:
  MotiveBoons.xcf
  - Ebene 4 „Ebene #21“: Sternenhimmel mit roter Sonne (Karte „Cosmic Manipulation“ u. a.), 1x
  - Ebene 25 „Ebene #35“: Mutterschiff (Karte „Arrival from the Cosmic Depths“), 3x
  - Ebene 22 „Ebene #36“: Life-Searcher-Invasoren, Ebene 23 „Ebene #37“: ihre grünen Strahlen
    (Karte „Life-Searcher from the Cosmic Depths“; Strahlfarbe/-form übernommen, gedithert)
  MotiveMoe.xcf
  - Ebene 553 „Hintergrund“: Himmel mit Wolken
  - Ebene 457 „Hausinsel“: schwebende Insel mit Haus
  - Ebene 212 „Inconspicuous Lawn“ (Gartenzwerg), 442 „Cheering Rabbit“ (ein Hase) – werden hochgezogen
"""
from common import *
import numpy as np

W_, H_ = 250, 350
B, M = 'MotiveBoons', 'MotiveMoe'


def beam(cv, x0, x1, ytop, xb0, xb1, ybot, col, t):
    Y, X = np.mgrid[0:H_, 0:W_]
    f = np.clip((Y - ytop) / max(1, ybot - ytop), 0, 1)
    l = x0 + (xb0 - x0) * f; r = x1 + (xb1 - x1) * f
    inside = (Y >= ytop) & (Y < ybot) & (X >= l) & (X < r)
    edge = inside & ((X < l + 2) | (X >= r - 2))
    tt = np.where(edge, t + 0.25, t)
    lit = inside & (tt > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.4 + np.array(col) * 0.6
    cv.a[:] = a.clip(0, 255).astype(np.uint8)


def build():
    cv = Canvas(W_, H_)
    # unten: Himmel der Mo-Welt
    sky = layer(M, 553)
    cv.a[:] = sky[210:210 + H_, 60:60 + W_, :3]
    # oben: Weltall (Sternenfeld mit Sonne), weich in den Himmel gedithert
    sp = layer(B, 4)
    b = bbox(sp)
    space = sp[b[1]:b[3], b[0]:b[2], :3]           # 320x240
    sub = space[0:200, 20:270]                     # Sonne links oben angeschnitten
    Y, X = np.mgrid[0:H_, 0:W_]
    top = np.zeros((H_, W_, 3), np.uint8)
    top[:200] = sub
    t = np.clip((200 - Y) / 70.0, 0, 1)
    m = t > BAYER4[Y % 4, X % 4]
    cv.a[m] = top[m]

    # Hausinsel unten
    isl = compose(M, [457])
    IX, IY = -14, 214
    cv.paste(isl, IX, IY)

    # Mutterschiff 3x oben
    ship = sprite('e30_mothership', B, [25])
    S3 = up(ship, 3)
    cv.paste(S3, 125 - S3.shape[1] // 2, 4)

    # Invasoren (2x): zwei suchen mit Strahlen, einer kommt gerade aus dem Mutterschiff
    sq = parts(sprite('e30_searchers', B, [22]), dil=0)
    GREEN = (40, 240, 40)
    beams = [(40, 118, 296), (212, 104, 252)]      # (x-Mitte, y oben Invasor, y Boden)
    for (cx, y0, yb) in beams:
        beam(cv, cx - 8, cx + 8, y0 + 60, cx - 20, cx + 20, yb, GREEN, 0.7)
    gnome = sprite('e30_gnome', M, [212])
    rab = sprite('e30_rabbits', M, [442])
    def trim_(s):
        ys_, xs_ = np.where(s[..., 3] > 0)
        return s[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]
    r2 = trim_(rab[:, 48:72])
    paste(cv, up(gnome, 2), 40, 232, anchor='c')
    paste(cv, up(flip(r2), 2), 212, 212, anchor='c')
    for (cx, y0, yb), s in zip(beams, sq[:2]):
        cv.paste(up(s, 2), cx - s.shape[1], y0)
    cv.paste(up(sq[2], 2), 125 - sq[2].shape[1], 128)
    vignette(cv, 0.3, 0.6)
    return cv


if __name__ == '__main__':
    print(save(build(), '30_besuch_aus_der_tiefe.png'))
