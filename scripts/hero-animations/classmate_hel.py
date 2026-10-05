# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Classmate Hel“ (Sayo Aisaka, Negima) von Hel, the Bound Specter.

Ebenen: Körper (src/classmate-hel-body.png, vom Nutzer gezeichnet, mit Geisterschweif), Schulstuhl und Pult
(src/classmate-hel-{chair,desk}.png, classmate_hel_sprite.py).
Frame 0 ist die Ruhepose (der Sprite genau wie gezeichnet); jede Bewegung ist als Differenz zu Frame 0
formuliert.
* Sie schwebt sanft auf und ab (die ganze Figur).
* Das lange weiße Haar weht: eine Welle läuft die Strähnen hinab (nach unten stärker, Wind in eine
  Richtung), der Rock flattert im selben Wind (zum Saum hin stärker).
* Der Geisterschweif windet sich ständig: eine Welle läuft bis in die Spitze, die abgelösten
  Pünktchen am Ende schlingern mit.
* Vier Möbelstücke (drei Stühle, ein Pult) schweben um sie herum: jedes kreist auf einer kleinen Bahn mit
  eigener Phase, die Stühle auf der rechten Seite sind gespiegelt.
* Fahle Geisterlichter steigen neben ihr auf.
Aufruf (aus scripts/hero-animations):  python3 classmate_hel.py final 90
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/classmate-hel-body.png').convert('RGBA')).astype(int)
CHAIR = np.array(Image.open('src/classmate-hel-chair.png').convert('RGBA')).astype(int)
DESK = np.array(Image.open('src/classmate-hel-desk.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PL, PR, PT, PB = 14, 14, 7, 4
H, W = SH + PT + PB, SW + PL + PR
N = 48
OUTLINE = (0x4c, 0x49, 0x66)
HAIR = {(0xd4, 0xd0, 0xee), (0xaa, 0xa5, 0xd2), (0x82, 0x7d, 0xae), (0xf4, 0xf2, 0xff)}
HAIR_Y0, HAIR_Y1 = 9, 24            # Haarsträhnen neben dem Körper (Zeilen im Sprite)
SKIRT_Y0, SKIRT_Y1 = 20, 26         # Rock bis Saum
TAIL_Y0 = 27                        # ab hier der Geisterschweif
FUR = [  # (Sprite, Mitte x, Mitte y, gespiegelt, Umlaufrichtung, Phase)
    (DESK, 8, 11, False, 1, 0.0),
    (CHAIR, 7, 26, False, -1, 2.1),
    (CHAIR, W - 8, 15, True, 1, 4.0),
    (CHAIR, W - 8, 30, True, -1, 1.2),
]


def col(p):
    return tuple(int(v) for v in p[:3])


def hair_spans():
    """Je Zeile die Spalten der Haarsträhnen links und rechts neben dem Körper."""
    out = {}
    for y in range(HAIR_Y0, HAIR_Y1 + 1):
        xs = np.nonzero(BODY[y, :, 3])[0]
        x0, x1 = xs.min(), xs.max()
        a = x0
        while a + 1 < SW and a - x0 < 4 and BODY[y, a + 1, 3] and (
                col(BODY[y, a + 1]) in HAIR or (col(BODY[y, a + 1]) == OUTLINE and a + 2 < SW
                                                and col(BODY[y, a + 2]) in HAIR)):
            a += 1
        b = x1
        while b - 1 >= 0 and x1 - b < 4 and BODY[y, b - 1, 3] and (
                col(BODY[y, b - 1]) in HAIR or (col(BODY[y, b - 1]) == OUTLINE and b - 2 >= 0
                                                and col(BODY[y, b - 2]) in HAIR)):
            b -= 1
        if a < b - 4:
            out[y] = (x0, a, b, x1)
    return out


SPANS = hair_spans()


def wave(i, y, c, cycles=2):
    """Differenz einer laufenden Welle zu Frame 0 (in Frame 0 genau null); cycles Perioden pro Loop."""
    w = 2 * math.pi * cycles * i / N
    return math.sin(w - c * y) - math.sin(-c * y)


def clip01(v):
    return min(1.0, max(0.0, v))


def dx_hair(i, y):
    return int(round(clip01((y - 8) / (HAIR_Y1 - 8)) * (1.0 * wave(i, y, 0.45) + 0.45 * wave(i, y, 0.9, 4))))


def dx_skirt(i, y):
    return int(round(clip01((y - SKIRT_Y0 + 1) / (SKIRT_Y1 - SKIRT_Y0 + 1)) * (1.2 * wave(i, y, 0.45) + 0.5 * wave(i, y, 0.9, 4))))


def dx_tail(i, y):
    k = y - (TAIL_Y0 - 1)
    return int(round((1.0 + 0.15 * k) * wave(i, y, 0.7, 3)))


PX = 4                              # Rand links/rechts, damit verschobene Teile Platz haben


def figure(i):
    """Der Sprite mit wehendem Haar, flatterndem Rock und sich windendem Schweif (Breite SW + 2 * PX)."""
    out = np.zeros((SH, SW + 2 * PX, 4), int)
    row = lambda y: np.nonzero(BODY[y, :, 3])[0]
    for y in range(SH):
        if not len(row(y)):
            continue
        if y in SPANS:                                  # Haar neben dem Körper: eigene Verschiebung
            x0, a, b, x1 = SPANS[y]
            dh, ds = dx_hair(i, y), dx_skirt(i, y)
            for x in range(x0, a + 1):
                out[y, x + PX + dh] = BODY[y, x]
            for x in range(b, x1 + 1):
                out[y, x + PX + dh] = BODY[y, x]
            for x in range(a + 1, b):                   # Körper (ab dem Rock mit dem Rock)
                out[y, x + PX + ds] = BODY[y, x]
            lo, hi = PX + min(x0 + dh, a + 1 + ds), PX + max(x1 + dh, b - 1 + ds)
            for x in range(lo, hi + 1):                 # Lücke zwischen Strähne und Körper schließen
                if not out[y, x, 3]:
                    left = x - 1
                    while left >= lo and not out[y, left, 3]:
                        left -= 1
                    if left >= lo:
                        out[y, x] = out[y, left]
        elif SKIRT_Y0 <= y <= SKIRT_Y1:                 # Saum: ganze Zeile mit dem Rock
            d = dx_skirt(i, y)
            for x in row(y):
                out[y, x + PX + d] = BODY[y, x]
        elif y >= TAIL_Y0:                              # Geisterschweif
            d = dx_tail(i, y)
            for x in row(y):
                out[y, x + PX + d] = BODY[y, x]
        else:
            out[y, PX:PX + SW] = BODY[y]
    # Schweif zusammenhalten: aufeinanderfolgende Zeilen, die sich nach dem Verschieben nicht mehr berühren
    for y in range(TAIL_Y0, SH - 1):
        a, b = np.nonzero(out[y, :, 3])[0], np.nonzero(out[y + 1, :, 3])[0]
        if not len(a) or not len(b):
            continue
        if b.min() > a.max() + 1:
            for x in range(a.max() + 1, b.min()):
                out[y + 1, x] = rgb('4c4966')
        elif b.max() < a.min() - 1:
            for x in range(b.max() + 1, a.min()):
                out[y + 1, x] = rgb('4c4966')
    return out


def put(out, s, ox, oy, flip=False):
    if flip:
        s = s[:, ::-1]
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        yy, xx = y + oy, x + ox
        if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]:
            out[yy, xx] = s[y, x]


def frame(i):
    t = 2 * math.pi * i / N
    out = np.zeros((H, W, 4), int)
    for spr, cx, cy, flip, d, ph in FUR:            # Möbel kreisen auf kleinen Bahnen
        a = d * t + ph
        x = cx + int(round(2.3 * math.cos(a)))
        y = cy + int(round(2.6 * math.sin(a)))
        put(out, spr, x - spr.shape[1] // 2, y - spr.shape[0] // 2, flip)
    dy = -int(round(1.2 * math.sin(t)))
    put(out, figure(i), PL - PX, PT + dy)
    near = np.zeros((H, W), bool)                   # Geisterlichter nie an Figur oder Möbeln
    ys, xs = np.nonzero(out[:, :, 3])
    for y, x in zip(ys, xs):
        near[max(0, y - 2):y + 3, max(0, x - 2):x + 3] = True
    for k in range(5):
        a = (i + k * 10) % N
        L = 26
        if a >= L:
            continue
        side = -1 if k % 2 else 1
        x = PL + SW // 2 + side * (SW // 2 + 2 + (k % 3) * 2) + int(round(1.2 * math.sin(0.45 * a + k)))
        y = PT + SH - 8 - int(round(1.2 * a))
        for yy, c in ((y, rgb('e8e4ff', int(210 * min(1.0, a / 3) * (1 - a / L)))),
                      (y + 1, rgb('b8b0d8', int(150 * min(1.0, a / 3) * (1 - a / L))))):
            if 1 <= x < W - 1 and 1 <= yy < H - 1 and not near[yy, x] and c[3] > 20 and not out[yy, x, 3]:
                out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'classmate_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=6,
                 check_edges=True)
