# -*- coding: utf-8 -*-
"""Idle-Animation für Toras, Master of all Weapons (MotiveDeepsea.xcf: „Toras“).

Im Sprite ist das Schwert mitten im Hieb: an der Faust die goldene
Parierstange, die Klinge selbst ist nur als grauer Keil (die Schwungspur) zu
sehen. Hier schwingt er es tatsächlich:
* Die Klinge wird gezeichnet (3 px breit mit Kanten, heller Grat, setzt direkt
  an der Parierstange an, spitz zulaufend) und dreht sich samt
  Parierstange um die Faust: in Ruhe schräg nach oben gehalten, kurz
  ausholen, dann in drei Frames nach unten durchgezogen.
* Die Schwungspur ist eine überstrichene Sichel hinter der Klinge (wie beim
  Skin Toras the Battle Maniac): an der Klinge so breit wie die ganze Klinge,
  zum Anfang des Hiebs hin spitz zulaufend, außen hell, innen dunkler (in den
  Grautönen des Keils aus dem Sprite). Nach dem Hieb schrumpft sie zur Klinge
  hin weg. Der Keil aus dem Sprite selbst wird nicht mehr gezeigt.
* Danach hebt er das Schwert langsam wieder.
* Die Faust mit der goldenen Manschette geht mit: beim gehobenen Schwert
  1 px höher, nach dem Hieb 1 px tiefer (das Schwert dreht um die Faust).
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
ARM = BODY & (_xs >= 20) & (_xs <= 25) & (_ys >= 12) & (_ys <= 16)   # Faust mit goldener Manschette
# Schwert (Parierstange + gezeichnete Klinge nach rechts)
SWORD = np.zeros((SH, SW, 4), int)
for x in range(28, SW):                              # Klinge setzt direkt an der Parierstange an
    if x == SW - 1:                                  # Spitze
        SWORD[14, x] = rgb('dedede')
        continue
    for y, c in ((13, 'dedede'), (14, 'ffffff'), (15, 'a7a7a7')):
        SWORD[y, x] = rgb(c)
    if x < SW - 2:
        SWORD[12, x] = rgb('808080')
        SWORD[16, x] = rgb('717171')
SWORD[GUARD] = SRC[GUARD]
SWORD_M = SWORD[:, :, 3] > 0
ANG = np.arctan2(_ys + 0.5 - PIVOT[1], _xs + 0.5 - PIVOT[0])   # Winkel jedes Keil-Pixels
RAISED, WIND = -1.0, -1.25
DOWN = float(ANG[WEDGE].max()) + 0.02                # Klinge endet am Ende der Schwungspur


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


BLADE_R = SW - PIVOT[0]                              # Klingenspitze (vom Drehpunkt aus)
BLADE_R0 = 28 - PIVOT[0]                             # Klingenansatz an der Parierstange


def trail(out, px_, py_, start, ang):
    """Schwungspur als Sichel vom Winkel start bis zur Klinge (ang): außen genau bis zur Klingenspitze,
    an der Klinge so breit wie die ganze Klinge, zum Anfang hin spitz."""
    lo, hi = min(start, ang), max(start, ang)
    span = max(0.3, abs(ang - start))
    for y in range(out.shape[0]):
        for x in range(out.shape[1]):
            dx, dy = x + 0.5 - px_, y + 0.5 - py_
            a = math.atan2(dy, dx)
            if not lo <= a <= hi:
                continue
            u = max(0.0, 1 - abs(a - ang) / span)         # 1 an der Klinge, 0 am Anfang der Spur
            T = 1.0 + (BLADE_R - BLADE_R0 - 1.0) * u ** 1.3
            r = math.hypot(dx, dy)
            if BLADE_R - T <= r <= BLADE_R:
                d = (BLADE_R - r) / T
                c = 'dedede' if d < 0.2 else 'cccccc' if d < 0.45 else 'bfbfbf' if d < 0.75 else 'a7a7a7'
                if u < 0.12:
                    c = '969696'
                out[y, x] = rgb(c)


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for x, y in EYE:
            s[y, x] = SKIN if st == 'halb' else BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    ang, tr = pose(i)
    ad = max(-1, min(1, int(round(ang))))            # Faust folgt dem Schwert (hoch/runter)
    if tr:                                           # Schwungspur hinter der Klinge (breit an der Klinge)
        kind, a = tr
        trail(out, PIVOT[0] + P, PIVOT[1] + PT + b + ad, WIND if kind == 'bis' else a, ang)
    sword = rotate_part(SWORD, SWORD_M, PIVOT, ang, (H, W), (P, PT + b + ad))
    msk = sword[:, :, 3] > 0
    out[msk] = sword[msk]
    for y in range(SH):                              # Figur (Faust liegt über dem Griff)
        for x in range(SW):
            if BODY[y, x] and not ARM[y, x]:
                out[y + PT + (b if y < KNEE else 0), x + P] = s[y, x]
    for y in range(SH):
        for x in range(SW):
            if ARM[y, x]:
                out[y + PT + b + ad, x + P] = s[y, x]
    if ad:                                           # freie Zeile unter/über der Faust füllen
        yb = 16 if ad < 0 else 12
        for x in range(20, 26):
            if ARM[yb, x] and not out[yb + PT + b, x + P, 3]:
                out[yb + PT + b, x + P] = s[yb, x]
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
