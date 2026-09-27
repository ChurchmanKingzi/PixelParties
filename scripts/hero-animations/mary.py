# -*- coding: utf-8 -*-
"""Flug-Animation für Cute Princess Mary (Sprite aus MotiveMoe.xcf).

Körper (`Mary-Kopie`) und Flügel (`Mary #1`) liegen als getrennte Ebenen vor
(src/cute-princess-mary-body.png / -wings.png, deckungsgleich mit
src/cute-princess-mary.png).

* Flügelschlag: jeder Flügel dreht sich um sein Schultergelenk – hoch (Spitzen
  nach oben, leicht angelegt) und kraftvoll herunter (weit gespreizt).
  Die Spitzen hängen der Wurzel nach (Nachschwingen), die Federn biegen sich.
  Gezeichnet wird per Rückwärts-Abbildung mit 3x3-Überabtastung und
  Mehrheitsfarbe – es entstehen keine neuen Mischfarben.
* Fliegen: beim Abschlag wird Mary nach oben gedrückt, beim Aufschlag sinkt
  sie etwas ab.
* Glut: von den Flügelspitzen lösen sich beim Abschlag kleine Funken.
"""
import math
import sys
from collections import Counter
from PIL import Image
import numpy as np
from anim_common import save_outputs

BODY = np.array(Image.open('src/cute-princess-mary-body.png').convert('RGBA')).astype(int)
WINGS = np.array(Image.open('src/cute-princess-mary-wings.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PL = PR = 7
PT, PB = 10, 3
H, W = SH + PT + PB, SW + PL + PR
N = 32
FLAP = 16                                   # Frames pro Flügelschlag

MID_X = 39                                  # Trennlinie linker/rechter Flügel
PIVOTS = {-1: (34.0, 33.0), 1: (44.0, 33.0)}   # Schultergelenke (Sprite-Koordinaten)
UP, DOWN = 0.40, -0.34                      # Winkel oben/unten (Bogenmaß)
LAG = 0.018                                 # Nachschwingen (Phase) pro Pixel Abstand


def phase(i):
    return 2 * math.pi * (i % FLAP) / FLAP


def base_angle(i, r=0.0):
    """Schlagwinkel: schneller Abschlag, langsamerer Aufschlag."""
    p = phase(i) - LAG * r
    s = math.sin(p)
    s = s * (1.25 if s < 0 else 0.85)      # Abschlag kräftiger
    return (UP + DOWN) / 2 + (UP - DOWN) / 2 * max(-1.0, min(1.0, s))


def span(i):
    """Oben leicht angelegt (kürzer), unten voll gespreizt."""
    a = base_angle(i)
    return 0.93 + 0.07 * (UP - a) / (UP - DOWN)


def body_dy(i):
    """Abschlag drückt sie hoch, beim Aufschlag sinkt sie ab (leicht verzögert)."""
    return int(round(-2.2 * math.sin(phase(i) - 2.2) - 0.3))


def sample_wing(side, i, x, y, oy):
    """Rückwärts-Abbildung eines Ausgabepixels (Leinwand) in die Flügelquelle."""
    px_, py_ = PIVOTS[side]
    px_, py_ = px_ + PL, py_ + PT + oy
    votes = Counter()
    sc = span(i)
    for sx in (-0.33, 0.0, 0.33):
        for sy in (-0.33, 0.0, 0.33):
            dx, dy = x + sx - px_, y + sy - py_
            r = math.hypot(dx, dy)
            ang = side * base_angle(i, r)             # links: positiv = im Uhrzeigersinn hoch
            c, s = math.cos(-ang), math.sin(-ang)
            ux, uy = (dx * c - dy * s) / sc, (dx * s + dy * c) / sc
            qx = int(round(PIVOTS[side][0] + ux))
            qy = int(round(PIVOTS[side][1] + uy))
            if 0 <= qx < SW and 0 <= qy < SH and WINGS[qy, qx, 3] and \
                    ((qx < MID_X) if side < 0 else (qx >= MID_X)):
                votes[tuple(WINGS[qy, qx])] += 1
            else:
                votes[None] += 1
    col, n = votes.most_common(1)[0]
    if col is None and n < 5:                             # knappe Mehrheit leer -> Farbe nehmen
        rest = [(k, v) for k, v in votes.items() if k is not None]
        if rest and max(v for _, v in rest) >= 4:
            col = max(rest, key=lambda kv: kv[1])[0]
    return col


EMBER = [(255, 236, 170), (255, 190, 80), (240, 120, 40), (190, 60, 30)]


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = body_dy(i)
    # Flügel (hinter dem Körper)
    for side in (-1, 1):
        for y in range(H):
            for x in range(W):
                c = sample_wing(side, i, x, y, oy)
                if c is not None:
                    out[y, x] = c
    # Körper
    for y in range(SH):
        for x in range(SW):
            if BODY[y, x, 3]:
                out[y + PT + oy, x + PL] = BODY[y, x]
    # Funken von den Flügelspitzen (Abschlag)
    for k in range(6):
        t = (i + k * 5) % 12
        if t >= 8:
            continue
        side = -1 if k % 2 else 1
        tip = (4 + 3 * (k // 2), 12 + 5 * (k // 2)) if side < 0 else (SW - 5 - 3 * (k // 2), 12 + 5 * (k // 2))
        # Spitze mit der aktuellen Flügelstellung mitdrehen
        pxv, pyv = PIVOTS[side]
        ang = side * base_angle(i - t, math.hypot(tip[0] - pxv, tip[1] - pyv))
        dx, dy = tip[0] - pxv, tip[1] - pyv
        c, s = math.cos(ang), math.sin(ang)
        ex = pxv + (dx * c - dy * s) * span(i - t) + PL
        ey = pyv + (dx * s + dy * c) * span(i - t) + PT + body_dy(i - t)
        ex += side * 0.4 * t
        ey += 0.6 * t + 0.08 * t * t
        xx, yy = int(round(ex)), int(round(ey))
        if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
            out[yy, xx] = (*EMBER[min(3, t // 2)], 255 - t * 22)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'mary_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=5)
