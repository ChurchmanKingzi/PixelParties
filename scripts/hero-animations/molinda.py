# -*- coding: utf-8 -*-
"""Idle-Animation für Molinda, the Cutest Being in the Sky (Figur aus der
Ebene „Ascended Molinda-Kopie“ in MotiveMoe.xcf).

Amor-Schuss im Loop:
* Zielen: sie spannt den Bogen – der Herzpfeil geht 1 px zurück.
* Schuss: der Pfeil schnellt nach links davon und verblasst dabei (er
  verschwindet, bevor er den Bildrand erreicht – nichts wird abgeschnitten),
  mit rosa Spur und aufsteigenden Herzchen; die Sehne schwingt nach. Der Teil
  des Bogens hinter dem Schaft wird ergänzt.
* Nachladen: ein neuer Pfeil materialisiert sich auf der Sehne.
Dazu schwebt sie leicht und schlägt mit ihrem Flügel (Drehung um die
Schulter, flap_common.rotate_part, die Spitze schwingt nach).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import rotate_part, over, fill_pinholes

SRC = np.array(Image.open('src/molinda-the-cutest-being-in-the-sky.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL, PR, PT, PB = 18, 9, 5, 4
H, W = SH + PT + PB, SW + PL + PR
N = 40

STRING = rgb('c9c9c9')
B_OUT, B_MID = rgb('822a42'), rgb('f75981')
HEART_Y = range(10, 17)
SHAFT_Y = range(12, 15)


WING_COLS = {rgb(c) for c in ('9999ff', 'ccccff', 'f6ffff', '9966ff', '292929')}
WING = np.array([[SRC[y, x, 3] > 0 and tuple(SRC[y, x]) in WING_COLS and (x >= 18 or (y <= 3 and x >= 15))
                  for x in range(SW)] for y in range(SH)])
PIVOT = (18.0, 7.0)


def wing_angle(i, r):
    p = 2 * math.pi * i / 16 - 0.03 * r
    s = math.sin(p)
    return -0.14 + 0.2 * (s * (1.2 if s < 0 else 0.9))    # negativ = nach außen


def is_arrow(x, y):
    if not SRC[y, x, 3]:
        return False
    return (x <= 5 and y in HEART_Y) or (y in SHAFT_Y and 6 <= x <= 12)


def is_string(x, y):
    return SRC[y, x, 3] and tuple(SRC[y, x]) == STRING


ARROW = [(x, y) for y in range(SH) for x in range(SW) if is_arrow(x, y)]
STRING_PX = [(x, y) for y in range(SH) for x in range(SW) if is_string(x, y)]
BOW_FILL = {}
for _y in SHAFT_Y:                                    # Bogen hinter dem Schaft
    BOW_FILL[(6, _y)], BOW_FILL[(7, _y)], BOW_FILL[(8, _y)] = B_OUT, B_MID, B_OUT
HEART = [(0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2)]
PINKS = [rgb('f75981'), rgb('ff66cc'), rgb('f5a0b0')]
FLIGHT = [(-3, 255), (-7, 210), (-11, 150), (-14, 80)]  # (Versatz, Deckkraft)


def state(i):
    """(Pfeil-Versatz, Deckkraft oder None, Sehnen-Schwingung)"""
    if i < 8:
        return 0, 255, 0
    if i < 12:
        return 1, 255, 0                               # gespannt
    if i < 12 + len(FLIGHT):
        ax, a = FLIGHT[i - 12]
        return ax, a, [-1, 0, -1, 0][i - 12]
    if i < 28:
        return 0, None, 0
    if i < 32:
        return 0, int(255 * (i - 27) / 4), 0           # neuer Pfeil blendet ein
    return 0, 255, 0


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 20)))


def blend(under, c, a):
    if under[3] and a < 255:
        f = a / 255
        return (*[int(round(f * c[k] + (1 - f) * under[k])) for k in range(3)], 255)
    return (*c[:3], a)


def frame(i):
    out = np.zeros((H, W, 4), int)
    ax, alpha, wob = state(i)
    dy = bob(i)
    oy, ox = PT + dy, PL
    over(out, fill_pinholes(rotate_part(SRC, WING, PIVOT, lambda r: wing_angle(i, r), (H, W), (ox, oy))))
    for y in range(SH):
        for x in range(SW):
            if SRC[y, x, 3] and not is_arrow(x, y) and not is_string(x, y) and not WING[y, x]:
                out[y + oy, x + ox] = SRC[y, x]
    for (x, y), c in BOW_FILL.items():
        out[y + oy, x + ox] = c
    fill_pinholes(out)                                  # Lücken zwischen Flügel und Kleid
    for x, y in STRING_PX:                              # Sehne (schwingt nach dem Schuss)
        sx = x + (wob if (x, y) != (x, 4) and 8 <= y <= 18 else 0)
        if not out[y + oy, sx + ox, 3] or sx == x:
            out[y + oy, sx + ox] = STRING
    flying = ax < 0
    if alpha is not None:
        ay = oy if not flying else PT + bob(12)
        for x, y in ARROW:
            xx, yy = x + ox + ax, y + ay
            if not flying and x + ax >= 13:
                continue                                # Schaftende liegt hinter der Hand
            out[yy, xx] = blend(out[yy, xx], SRC[y, x], alpha)
        if flying:                                      # rosa Spur
            tail = 12 + ox + ax
            for k in range(1, 8):
                xx = tail + k
                if out[13 + ay, xx, 3] == 0:
                    out[13 + ay, xx] = (*PINKS[k % 3][:3], max(40, int(alpha * (1 - k / 8))))
    if 13 <= i < 24:                                    # Herzchen steigen auf
        t = i - 13
        for k, (hx0, start) in enumerate(((ox - 4, 0), (ox - 10, 2), (ox - 7, 4))):
            tt = t - start
            if 0 <= tt < 6:
                hx, hy = hx0, PT + 8 - tt
                pts = [(hx + dx, hy + dy2) for dx, dy2 in HEART]
                if any(out[y, x, 3] for x, y in pts):
                    continue                            # nie angeschnitten zeichnen
                for x, y in pts:
                    out[y, x] = (*PINKS[k][:3], 255 - tt * 35)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'molinda_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8,
                 check_edges=True)
