# -*- coding: utf-8 -*-
"""Idle-Animation für Molinda, the Cutest Being in the Sky (Ebene
„Ascended Molinda“ aus MotiveMoe.xcf).

Amor-Schuss im Loop:
* Zielen: sie spannt den Bogen – Pfeil, Zughand und Sehnen-Nocke gehen 1 px
  zurück.
* Schuss: der Herzpfeil fliegt nach links aus dem Bild (mit rosa Spur und
  kleinen Herzchen), die Sehne schnellt gerade und schwingt nach. Der Teil
  des Bogens hinter dem Schaft wird ergänzt.
* Nachladen: ein neuer Pfeil materialisiert sich auf der Sehne (blendet
  über vier Frames ein).
Dazu schwebt sie leicht.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/molinda-the-cutest-being-in-the-sky.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL, PR, PT, PB = 16, 2, 3, 3
H, W = SH + PT + PB, SW + PL + PR
N = 40

STRING = rgb('c9c9c9')
B_OUT, B_MID = rgb('742174'), rgb('fe49ff')


def is_arrow(x, y):
    if not SRC[y, x, 3]:
        return False
    if x <= 4 and 7 <= y <= 13:                       # Herzspitze
        return True
    return 9 <= y <= 11 and 5 <= x <= 11              # Schaft (vor dem Bogen)


def is_string(x, y):
    return SRC[y, x, 3] and tuple(SRC[y, x]) == STRING


HAND = [(x, y) for y in range(9, 12) for x in (12, 13) if SRC[y, x, 3] and not is_string(x, y)]
ARROW = [(x, y) for y in range(SH) for x in range(SW) if is_arrow(x, y)]
STRING_PX = [(x, y) for y in range(SH) for x in range(SW) if is_string(x, y)]
BOW_FILL = {(5, y): B_OUT for y in (9, 10, 11)}       # Bogen hinter dem Schaft
BOW_FILL.update({(6, y): B_MID for y in (9, 10, 11)})
BOW_FILL.update({(7, y): B_OUT for y in (9, 10, 11)})
STR_TOP, STR_BOT = 4, 17
HEART = [(0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2)]
PINKS = [rgb('fe49ff'), rgb('ff66cc'), rgb('fec0ff')]


def state(i):
    """(Pfeil-Versatz x, Pfeil sichtbar, Zug, Sehne gespannt, Sehnen-Schwingung)"""
    if i < 8:
        return 0, True, 0, True, 0
    if i < 12:
        return 1, True, 1, True, 0                     # voll gespannt
    if i < 20:
        t = i - 12
        return -[4, 10, 17, 25, 34, 44, 55, 66][t], True, 0, False, [1, -1, 1, 0, 0, 0, 0, 0][t]
    if i < 28:
        return 0, False, 0, False, 0
    if i < 32:
        return 0, True, 0, True, 0                     # neuer Pfeil blendet ein
    return 0, True, 0, True, 0


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 20)))


def frame(i):
    out = np.zeros((H, W, 4), int)
    ax, arrow_on, pull, taut, wob = state(i)
    dy = bob(i)
    oy, ox = PT + dy, PL
    flying = ax < 0
    for y in range(SH):
        for x in range(SW):
            if not SRC[y, x, 3] or is_arrow(x, y) or is_string(x, y) or (x, y) in HAND:
                continue
            out[y + oy, x + ox] = SRC[y, x]
    for (x, y), c in BOW_FILL.items():
        out[y + oy, x + ox] = c
    # Sehne
    if taut:
        for x, y in STRING_PX:
            out[y + oy, x + ox] = STRING
            if pull and 9 <= y <= 12:                 # Nocke gedehnt, keine Lücke
                out[y + oy, x + ox + pull] = STRING
    else:
        # wo die Nocke saß: Handkontur bzw. Ärmel schließen
        out[9 + oy, 12 + ox] = rgb('311800')
        out[12 + oy, 12 + ox] = rgb('060501')
        for y in range(STR_TOP, STR_BOT + 1):
            mid = 1 if 7 <= y <= 14 else 0
            out[y + oy, 10 + ox + wob * mid] = STRING
    # Zughand
    for x, y in HAND:
        out[y + oy, x + ox + (pull if taut else 0)] = SRC[y, x]
    # Pfeil
    if arrow_on:
        oy_a = oy if not flying else PT + bob(12)
        fade = (i - 27) / 4 if 28 <= i < 32 else 1.0
        for x, y in ARROW:
            xx = x + ox + ax
            if 0 <= xx < W:
                c = SRC[y, x]
                if fade < 1:                               # über den Bogen blenden
                    under = out[y + oy_a, xx]
                    if under[3]:
                        c = (*[int(round(fade * c[k] + (1 - fade) * under[k])) for k in range(3)], 255)
                    else:
                        c = (*c[:3], int(255 * fade))
                out[y + oy_a, xx] = c
        if flying:                                    # rosa Spur hinter dem Pfeil
            tail = 12 + ox + ax
            for k in range(1, 9):
                xx = tail + k
                if 0 <= xx < W and out[10 + oy_a, xx, 3] == 0:
                    a = max(40, 230 - k * 28)
                    out[10 + oy_a, xx] = (*PINKS[k % 3][:3], a)
    # Herzchen aus der Spur
    if 13 <= i < 24:
        t = i - 13
        for k, (hx0, start) in enumerate(((ox - 3, 0), (ox - 10, 2), (ox - 6, 4))):
            tt = t - start
            if 0 <= tt < 6:
                hx, hy = hx0, PT + 9 - tt
                for dx, dy2 in HEART:
                    xx, yy = hx + dx, hy + dy2
                    if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                        out[yy, xx] = (*PINKS[k][:3], 255 - tt * 35)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'molinda_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8)
