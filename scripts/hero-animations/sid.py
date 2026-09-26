# -*- coding: utf-8 -*-
"""Idle-Animation für Sid, the King of Thieves (38x38).

Dieb und Attentäter ganz in Schwarz – grazil und schleichend:
* Er federt lautlos auf den Zehenspitzen (Füße bleiben stehen).
* Die ausgestreckten Arme gleiten im Wechsel auf und ab (an der Schulter fest).
* In der rechten Hand ein Dolch im Rückhandgriff; einmal pro Loop wirft er
  ihn wirbelnd hoch und fängt ihn wieder.
* Dunkle Schattenschwaden kriechen um seine Füße.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, wave, save_outputs

SRC = np.array(Image.open('src/sid-the-king-of-thieves.png').convert('RGBA')).astype(int)
H, W = SRC.shape[:2]
N = 48


def rise(i):
    return -1 if 4 <= i % 24 < 14 else 0


def is_arm(x, y):
    return (16 <= y <= 19 and x <= 13) or (16 <= y <= 21 and x >= 24)


def arm_lift(x, i):
    if x <= 13:
        reach, ph = (14 - x) / 4, 0.0
    else:
        reach, ph = (x - 23) / 4, math.pi
    lift = int(round(1 + wave(i, 24, ph + 0.6)))          # 0..2, im Wechsel
    return int(round(lift * min(1.0, reach)))


def is_foot(x, y):
    return y >= 26


# ---------------------------------------------------------------- Dolch
HILT, GUARD = rgb('2c1000'), rgb('515350')
BLADE, EDGE = rgb('c8ccd0'), rgb('f4f6f8')
HAND = (27, 21)                                           # Griffposition (Original)
# Ausrichtungen: Liste (dx, dy, Farbe) relativ zum Griffpunkt
DAGGER = {
    'unten': [(0, 0, HILT), (0, 1, GUARD), (0, 2, BLADE), (0, 3, BLADE), (0, 4, EDGE)],
    'diag1': [(0, 0, HILT), (1, 1, GUARD), (1, 2, BLADE), (2, 3, EDGE)],
    'quer':  [(-1, 0, HILT), (0, 0, GUARD), (1, 0, BLADE), (2, 0, BLADE), (3, 0, EDGE)],
    'diag2': [(0, 0, HILT), (1, -1, GUARD), (1, -2, BLADE), (2, -3, EDGE)],
    'oben':  [(0, 0, HILT), (0, -1, GUARD), (0, -2, BLADE), (0, -3, BLADE), (0, -4, EDGE)],
}
SPIN = ['unten', 'diag1', 'quer', 'diag2', 'oben', 'diag2', 'quer', 'diag1']
TOSS_START, TOSS_LEN = 28, 12


def dagger_state(i):
    t = (i - TOSS_START) % N
    if t >= TOSS_LEN:
        return 'unten', 0, 0
    h = int(round(9 * math.sin(math.pi * t / TOSS_LEN)))    # Wurfbogen
    dx = int(round(1.5 * math.sin(math.pi * t / TOSS_LEN)))
    return SPIN[t % len(SPIN)], -h, dx


def draw_dagger(out, i, hand_dy):
    pose, hy, hx = dagger_state(i)
    x0, y0 = HAND[0] + hx, HAND[1] + hand_dy + hy
    for dx, dy, c in DAGGER[pose]:
        x, y = x0 + dx, y0 + dy
        if 0 <= x < W and 0 <= y < H:
            out[y, x] = c


# ---------------------------------------------------------------- Schatten
SHADOW = [(12, 27, 0, 1), (24, 27, 10, -1), (16, 28, 20, 1), (27, 26, 30, -1), (10, 26, 38, 1)]


def shadows(out, i):
    for x0, y0, start, d in SHADOW:
        t = (i - start) % N
        if t >= 16:
            continue
        a = int(150 * math.sin(math.pi * t / 16))
        x = x0 + d * t * 0.4
        y = y0 - (t // 6)
        for k in range(3):
            xx, yy = int(round(x + d * k)), int(round(y))
            if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                out[yy, xx] = (18, 16, 30, max(0, a - k * 45))


def frame(i):
    s = SRC.copy()
    out = np.zeros_like(s)
    r = rise(i)
    for y in range(H):                                     # Füße fest
        for x in range(W):
            if s[y, x, 3] and is_foot(x, y):
                out[y, x] = s[y, x]
    if r < 0:                                              # Beine strecken sich
        for x in range(W):
            if s[25, x, 3]:
                out[25, x] = s[25, x]
    for y in range(H):                                     # Körper
        for x in range(W):
            if s[y, x, 3] and not is_foot(x, y) and not is_arm(x, y):
                out[y + r, x] = s[y, x]
    for y in range(16, 22):                                # Arme
        for x in range(W):
            if s[y, x, 3] and is_arm(x, y):
                out[y + r - arm_lift(x, i), x] = s[y, x]
    draw_dagger(out, i, r - arm_lift(HAND[0], i))
    shadows(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'sid_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
