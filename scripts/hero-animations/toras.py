# -*- coding: utf-8 -*-
"""Idle-Animation für Toras, Master of all Weapons (MotiveDeepsea.xcf: „Toras“).

Im Sprite ist das Schwert mitten im Hieb: an der Faust die goldene
Parierstange, die Klinge selbst ist nur als grauer Keil (die Schwungspur) zu
sehen. Hier schwingt er es tatsächlich:
* Die Klinge wird gezeichnet (3 px breit, heller Grat) und dreht sich samt
  Parierstange um die Faust: in Ruhe schräg nach oben gehalten, kurz
  ausholen, dann in drei Frames nach unten durchgezogen.
* Der Keil aus dem Sprite ist die Schwungspur: er erscheint hinter der Klinge,
  soweit sie schon geschwungen ist, und schrumpft danach zur Klinge hin weg.
* Danach hebt er das Schwert langsam wieder.
* Er wippt in den Knien und blinzelt zweimal pro Loop.
Frame 0 zeigt das gehobene Schwert (nicht den Hieb aus dem Sprite); die
Figur selbst liegt deckungsgleich wie im Sprite.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import rotate_part, fill_pinholes

SRC = np.array(Image.open('src/toras-master-of-all-weapons.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 5, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 23
PIVOT = (24.5, 14.5)                                 # Faust
BLACK = (0, 0, 0, 255)
SKIN = rgb('ffe6d5')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
EYE = [(13, 10), (14, 10)]
WEDGE_COLS = {rgb(c) for c in ('969696', '717171', 'dedede', 'cccccc', 'bfbfbf', 'a7a7a7', '808080')}
_ys, _xs = np.mgrid[0:SH, 0:SW]
WEDGE = np.array([[bool(SRC[y, x, 3]) and x >= 21 and y >= 13 and tuple(SRC[y, x]) in WEDGE_COLS
                   for x in range(SW)] for y in range(SH)])
GUARD = (SRC[:, :, 3] > 0) & (_xs >= 25) & (_xs <= 28) & (_ys >= 9) & (_ys <= 21) & ~WEDGE
BODY = (SRC[:, :, 3] > 0) & ~WEDGE & ~GUARD
# Schwert (Parierstange + gezeichnete Klinge nach rechts)
SWORD = np.zeros((SH, SW, 4), int)
SWORD[GUARD] = SRC[GUARD]
for x in range(29, SW):
    tip = x >= SW - 2
    for y, c in ((13, 'dedede'), (14, 'ffffff'), (15, 'a7a7a7')):
        if tip and y != 14:
            continue
        SWORD[y, x] = rgb(c)
    if not tip:
        SWORD[12, x] = rgb('808080')
        SWORD[16, x] = rgb('717171')
SWORD_M = SWORD[:, :, 3] > 0
ANG = np.arctan2(_ys + 0.5 - PIVOT[1], _xs + 0.5 - PIVOT[0])   # Winkel jedes Keil-Pixels
RAISED, WIND, DOWN = -1.0, -1.25, 1.5


def pose(i):
    """(Winkel der Klinge, Spur: ('bis', a) = bis a gezeigt, ('ab', a) = ab a, None)."""
    if i < 18 or i >= 42:
        return RAISED, None
    if i < 22:
        return RAISED + (WIND - RAISED) * (i - 17) / 4, None
    if i <= 24:
        a = {22: -0.4, 23: 0.5, 24: DOWN}[i]
        return a, ('bis', a)
    if i < 30:
        return DOWN, {25: ('ab', 0.3), 26: ('ab', 0.8), 27: ('ab', 1.2)}.get(i)
    f = (i - 29) / 12
    return DOWN + (RAISED - DOWN) * (0.5 - 0.5 * math.cos(math.pi * f)), None


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for x, y in EYE:
            s[y, x] = SKIN if st == 'halb' else BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    ang, trail = pose(i)
    if trail:                                        # Schwungspur hinter der Klinge
        kind, a = trail
        m = WEDGE & ((ANG <= a) if kind == 'bis' else (ANG >= a))
        for y, x in zip(*np.nonzero(m)):
            out[y + PT + (b if y < KNEE else 0), x + P] = s[y, x]
    sword = rotate_part(SWORD, SWORD_M, PIVOT, ang, (H, W), (P, PT + b))
    msk = sword[:, :, 3] > 0
    out[msk] = sword[msk]
    for y in range(SH):                              # Figur (Faust liegt über dem Griff)
        for x in range(SW):
            if BODY[y, x]:
                out[y + PT + (b if y < KNEE else 0), x + P] = s[y, x]
    if b < 0:
        y = KNEE - 1
        for x in range(SW):
            if BODY[y, x] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'toras_idle_{tag}', frames, ms, scale=8, check_edges=True)
