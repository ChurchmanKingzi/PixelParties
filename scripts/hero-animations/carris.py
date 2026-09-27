# -*- coding: utf-8 -*-
"""Idle-Animation für Carris, the Time Keeper und den Skin Little Carris
(MotiveBritain.xcf).

Aufruf: python3 carris.py <tag> [ms] [hero|little]

* Er atmet (der Oberkörper hebt sich im Rhythmus um 1 px, die Füße bleiben).
* Er blinzelt zweimal pro Loop: der Glanz im Auge erlischt, geschlossen
  rutscht der schwarze Lidstrich eine Zeile tiefer und ist 2 px breit.
* Die Ohren zucken ab und zu: hero – das linke Ohr kippt oben 1 px (ganze
  Zeilen), die Spitze des rechten sackt 1 px ab (ganze Spalten), so
  entstehen keine Lücken; little – die Ohrspitzen kippen 1 px nach außen.
* hero:   die große Taschenuhr in seiner Hand hebt und senkt sich mit ihr
          beim Atmen und tickt (der lange Zeiger springt alle
          4 Frames eine Stunde weiter, die Uhr läuft einmal pro Loop herum),
          das herabhängende Kettenende schwingt sachte (zeilenweise, unten
          stärker); er tippt ungeduldig mit dem rechten Fuß.
* little: der Mäuseschwanz schwingt hin und her (der senkrechte Teil als
          Ganzes, die Krümmung am Körper bleibt stehen – kein Knick).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('hero', 'little')), 'hero')
if V == 'hero':
    BODY = np.array(Image.open('src/carris-the-time-keeper-body.png').convert('RGBA')).astype(int)
    WATCH = np.array(Image.open('src/carris-the-time-keeper-watch.png').convert('RGBA')).astype(int)
    PREFIX = 'carris'
    LID_ROW, EYE_XS, GLINT = 9, (20, 21, 24, 25), [(21, 10), (25, 10)]
    FEET_Y = 21
    EAR_L = [(x, y) for y in range(0, 3) for x in range(0, 22)]          # obere Zeilen, ganz
    EAR_R = [(x, y) for y in range(2, 6) for x in range(29, 32)]         # Spitze, ganze Spalten
    FOOT = [(x, y) for y in (21, 22) for x in range(23, 28)]
else:
    BODY = np.array(Image.open('src/little-carris.png').convert('RGBA')).astype(int)
    WATCH = None
    PREFIX = 'little_carris'
    LID_ROW, EYE_XS, GLINT = 6, (8, 9, 12, 13), [(9, 7), (13, 7)]
    FEET_Y = 18
    EAR_L = [(x, y) for y in range(0, 2) for x in range(3, 8)]
    EAR_R = [(x, y) for y in range(0, 2) for x in range(14, 19)]
    FOOT = []
SH, SW = BODY.shape[:2]
P, PT, PB = 4, 4, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
BLACK = (0, 0, 0, 255)
FACE, GREY = rgb('e0e0e0'), rgb('c6c6c6')
DIAL, HAND = rgb('c9c9c9'), rgb('000000')
DIAL_C = (12, 15)                                    # Mitte des Zifferblatts
SHORT_HAND = [(13, 16), (14, 16)]
CHAIN_X, CHAIN_Y = 4, 8                              # herabhängendes Kettenende
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
EAR_TWITCH = {6: 'l', 7: 'l', 30: 'r', 31: 'r'}
TAP = {20, 21, 24, 25}                               # Fuß hebt sich (hero)
TAIL = [(x, y) for y in range(9, 15) for x in range(0, 5)] if V == 'little' else []   # senkrechter Teil


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


def watch(i, b):
    """Uhr: langer Zeiger (Länge 3) in 12 Stufen, Kettenende schwingt."""
    w = WATCH.copy()
    for y, x in zip(*np.nonzero((w[:, :, :3] == HAND[:3]).all(2) & (w[:, :, 3] > 0))):
        w[y, x] = DIAL
    ang = 2 * math.pi * (i // 4) / 12
    for r in (1, 2, 3):
        w[int(round(DIAL_C[1] - r * math.cos(ang))), int(round(DIAL_C[0] + r * math.sin(ang)))] = HAND
    for x, y in SHORT_HAND:
        w[y, x] = HAND
    w[DIAL_C[1], DIAL_C[0]] = HAND
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(w[:, :, 3])):
        dx = 0
        if x < CHAIN_X and y >= CHAIN_Y:
            dx = int(round(1.4 * (y - CHAIN_Y) / 21 * math.sin(2 * math.pi * i / 24 - (y - CHAIN_Y) * 0.15)))
        out[y + PT + b, x + P + dx] = w[y, x]
    return out


def tail_dx(y, i):
    return int(round(math.sin(2 * math.pi * i / 16)))   # senkrechter Teil als Ganzes


def frame(i):
    s = BODY.copy()
    st = BLINK.get(i)
    if st:
        for x, y in GLINT:
            s[y, x] = GREY
        if st == 'zu':
            for x in EYE_XS:
                s[LID_ROW, x] = FACE
                s[LID_ROW + 1, x] = BLACK
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    if WATCH is not None:                            # Taschenuhr in seiner Hand, hebt sich mit
        w = watch(i, b)
        m = w[:, :, 3] > 0
        out[m] = w[m]
    ear_l, ear_r, tail, foot = set(EAR_L), set(EAR_R), set(TAIL), set(FOOT)
    tw = EAR_TWITCH.get(i)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dx, dy = 0, (b if y < FEET_Y else 0)
            if V == 'hero' and tw == 'l' and (x, y) in ear_l:
                dx = 1
            elif V == 'hero' and tw == 'r' and (x, y) in ear_r:
                dy += 1
            elif V == 'little' and tw and ((x, y) in ear_l or (x, y) in ear_r):
                dx = -1 if (x, y) in ear_l else 1
            if (x, y) in tail:
                dx = tail_dx(y, i)
            if (x, y) in foot and i in TAP:
                dy = -1
            out[y + PT + dy, x + P + dx] = s[y, x]
    if b:                                            # Zeile über den Füßen dehnen
        y = FEET_Y - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{PREFIX}_idle_{tag}', frames, ms, scale=8, check_edges=True)
