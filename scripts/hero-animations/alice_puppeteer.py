# -*- coding: utf-8 -*-
"""Idle-Animation für Alice, the Puppeteer Girl (MotiveBritain.xcf: „Alice #6“
+ die Puppe aus „Mr Jiggles“).

Teile: src/alice-the-puppeteer-girl-{body,puppets}.png (deckungsgleich).
* Die drei Mr Jiggles tanzen jeder für sich: die beiden an den Fäden schwingen
  nach außen und hüpfen (links im 24er-, rechts im 16er-Takt), die Fäden
  werden jedes Frame gespannt von Alices Hand zur Puppe neu gezogen; die Puppe unten watschelt hin
  und her und macht ab und zu einen Hüpfer.
* Alice atmet: der ganze Oberkörper samt Händen hebt sich im Rhythmus um
  1 px, gedehnt wird das Kleid (Zeile 20), nicht der Hals.
* Ihre Augen sind im Sprite lächelnd geschlossen (^-förmig). Zweimal pro
  Loop gehen sie auf und zeigen ihre blauen Augen (Wimpernstrich oben, darunter
  Blau mit hellem Glanz); dazwischen kurz ein gerader Lidstrich als Übergang.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

BODY = np.array(Image.open('src/alice-the-puppeteer-girl-body.png').convert('RGBA')).astype(int)
PUP = np.array(Image.open('src/alice-the-puppeteer-girl-puppets.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT, PB = 4, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
SKIN, BLACK = rgb('f7bc97'), (0, 0, 0, 255)
DRESS_EDGE = rgb('000200')
STRING_L = [(10, 14), (11, 14), (8, 15), (9, 15), (6, 16), (7, 16)]
STRING_R = [(29, 14), (28, 14), (31, 15), (30, 15), (33, 16), (32, 16)]
# Fäden: (Hand, Ende an der Puppe, Farbe gerader / ungerader Spalten)
THREADS = [((11, 14), (6, 16), (rgb('4b0175'), rgb('9a2fe7'))),
           ((28, 14), (33, 16), (rgb('9a2fe7'), rgb('4b0175')))]


def line(x0, y0, x1, y1):
    """Bresenham, 8er-zusammenhängend."""
    pts, dx, dy = [], abs(x1 - x0), -abs(y1 - y0)
    sx, sy, err = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1), dx + dy
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def puppet_mask(left):
    strings = set(STRING_L if left else STRING_R)
    m = np.zeros((SH, SW), bool)
    for y in range(16, SH):
        for x in range(SW):
            if not BODY[y, x, 3] or (x, y) in strings or tuple(BODY[y, x]) == DRESS_EDGE:
                continue
            if (left and (x <= 10 or (x == 11 and y > 16))) or (not left and (x >= 29 or (x == 28 and y > 16))):
                m[y, x] = True
    return m


PUP_L, PUP_R = puppet_mask(True), puppet_mask(False)
STR_L, STR_R = set(STRING_L), set(STRING_R)
BREATH_Y = 20                                        # bis hier hebt sich der Oberkörper
BLUE, BLUE_HI = rgb('2f6fe8'), rgb('9fd8ff')
EYE_STATES = {'strich': {(17, 8): SKIN, (22, 8): SKIN, (16, 9): BLACK, (17, 9): BLACK, (18, 9): SKIN,
                         (21, 9): SKIN, (22, 9): BLACK, (23, 9): BLACK},
              'offen': {(17, 8): BLACK, (18, 8): BLACK, (21, 8): BLACK, (22, 8): BLACK,
                        (17, 9): BLUE, (18, 9): BLUE_HI, (21, 9): BLUE_HI, (22, 9): BLUE}}
EYES = {10: 'strich', 20: 'strich', 34: 'strich', 42: 'strich'}
EYES.update({i: 'offen' for i in list(range(11, 20)) + list(range(35, 42))})


def hop(t, start):
    """Kleiner Hüpfer: 0, -1, -2, -1 ab start."""
    return {start: -1, start + 1: -2, start + 2: -1}.get(t, 0)


def pose_l(i):
    return -int(round(1 - math.cos(2 * math.pi * i / 24))), hop(i % 12, 6)


def pose_r(i):
    return int(round(1 - math.cos(2 * math.pi * i / 16))), hop(i % 16, 9)


def pose_b(i):
    return int(round(math.sin(2 * math.pi * i / 24))), hop(i % 24, 18)


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


def frame(i):
    s = BODY.copy()
    for (x, y), c in EYE_STATES.get(EYES.get(i), {}).items():
        s[y, x] = c
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    lx, ly = pose_l(i)
    rx, ry = pose_r(i)
    for y in range(SH):                              # Alice
        for x in range(SW):
            if not s[y, x, 3] or PUP_L[y, x] or PUP_R[y, x] or (x, y) in STR_L or (x, y) in STR_R:
                continue
            if y <= BREATH_Y:
                if b and y == BREATH_Y:              # Kleid gedehnt
                    out[y + PT, x + P] = s[y, x]
                out[y + PT + b, x + P] = s[y, x]
            else:
                out[y + PT, x + P] = s[y, x]
    for ((hx, hy), (ex, ey), cols), (dx, dy) in zip(THREADS, ((lx, ly), (rx, ry))):   # Fäden gespannt
        for x, y in line(hx, hy + b, ex + dx, ey + dy):
            out[y + PT, x + P] = cols[x % 2]
    for mask, (dx, dy) in ((PUP_L, (lx, ly)), (PUP_R, (rx, ry))):
        for y, x in zip(*np.nonzero(mask)):
            out[y + PT + dy, x + P + dx] = s[y, x]
    bx, by = pose_b(i)                               # Puppe unten (vor Alice)
    for y, x in zip(*np.nonzero(PUP[:, :, 3])):
        out[y + PT + by, x + P + bx] = PUP[y, x]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'alice_puppeteer_idle_{tag}', frames, ms, scale=8, check_edges=True)
