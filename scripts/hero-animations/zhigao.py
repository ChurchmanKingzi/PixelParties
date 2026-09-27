# -*- coding: utf-8 -*-
"""Idle-Animation für Zhigao, the Heavenly Emperor (MotiveChina.xcf: „Zhigao #2“
auf dem Thron „Palace“).

Teile: src/zhigao-the-heavenly-emperor-{throne,body}.png (deckungsgleich).
* Der Thron steht fest; Zhigao sitzt und atmet (Kopf, Hut, Oberkörper und
  Arme heben sich im Rhythmus um 1 px, gedehnt wird die Schärpe über dem
  Schoß – nicht der Hals).
* Er wippt mit den Füßen: abwechselnd hebt sich der linke und der rechte
  Fuß um 1 px.
* Die vier Troddeln seines Huts pendeln sachte (unten stärker, jede 1 px
  breit und zusammenhängend).
* Der Schmuck an seinem Hut blitzt einmal pro Loop auf.
* Er blinzelt zweimal pro Loop (geschlossen: 2 px breite schwarze Striche).
* Sein Schatten (25 % Schwarz) fällt auf den Thron und wird darübergemischt.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes

THRONE = np.array(Image.open('src/zhigao-the-heavenly-emperor-throne.png').convert('RGBA')).astype(int)
BODY = np.array(Image.open('src/zhigao-the-heavenly-emperor-body.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT, PB = 2, 2, 1
H, W = SH + PT + PB, SW + 2 * P
N = 48
CHEST_Y = 24                                         # bis hier atmet er (Schärpe Zeile 24 wird gedehnt, nicht der Hals)
FOOT_L = {(x, y) for y in (27, 28) for x in range(12, 16)}
FOOT_R = {(x, y) for y in (27, 28, 29) for x in range(16, 20)}
TASSELS = {9, 11, 23, 25}                            # Spalten der Troddeln (Zeilen 10–19)
TASSEL_Y0 = 10
BLACK = (0, 0, 0, 255)
LID = rgb('f6bd7b')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
WHITES = [(14, 18), (18, 18)]
LINE = [(13, 18), (14, 18), (17, 18), (18, 18)]
GEM = (16, 12, 28)                                   # Hutschmuck (x, y, Start)
GOLD0, GOLD1 = rgb('ccb98e'), rgb('fff6c5')


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


def foot_dy(x, y, i):
    t = i % 12
    if (x, y) in FOOT_L and t in (3, 4, 5):
        return -1
    if (x, y) in FOOT_R and t in (9, 10, 11):
        return -1
    return 0


def tassel_dx(y, i):
    f = (y - TASSEL_Y0) / 9
    return int(round(1.2 * f * math.sin(2 * math.pi * i / 24)))


def blend(dst, c):
    a = c[3] / 255
    if a >= 1 or not dst[3]:
        return c
    return np.array([*(np.round(c[:3] * a + dst[:3] * (1 - a))).astype(int), 255])


def frame(i):
    s = BODY.copy()
    st = BLINK.get(i)
    if st:
        for x, y in WHITES:
            s[y, x] = LID
        if st == 'zu':
            for x, y in LINE:
                s[y, x] = BLACK
    out = np.zeros((H, W, 4), int)
    out[PT:PT + SH, P:P + SW] = THRONE
    b = breath(i)
    fig = np.zeros((H, W, 4), int)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dx, dy = 0, 0
            if y <= CHEST_Y:
                dy = b
                if x in TASSELS and TASSEL_Y0 <= y:
                    dx = tassel_dx(y, i)
            elif s[y, x, 3] == 255:
                dy = foot_dy(x, y, i)
            if b and y == CHEST_Y:                   # Schärpe gedehnt
                fig[y + PT, x + P] = s[y, x]
            fig[y + PT + dy, x + P + dx] = s[y, x]
    fill_pinholes(fig)
    for y, x in zip(*np.nonzero(fig[:, :, 3])):
        out[y, x] = blend(out[y, x], fig[y, x])
    gx, gy, start = GEM
    for (x, y), c in sparkle_pixels(i, N, [(gx + P, gy + PT + b, start)], GOLD0, GOLD1).items():
        out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'zhigao_idle_{tag}', frames, ms, scale=8, check_edges=True)
