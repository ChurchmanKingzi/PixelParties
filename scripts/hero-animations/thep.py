# -*- coding: utf-8 -*-
"""Idle-Animation für Thep, the Court Scribe (MotiveEgypt.xcf, Ebene „Thep“).

* Er schreibt wirklich: Er greift mit Hand und Feder zur Schriftrolle, die
  Federspitze kritzelt zwei Zeilen darauf (die Tinte bleibt als krakelige
  dunkle Linie stehen), dann zieht er die Hand zurück. Beim Hinübergreifen
  kippt die Feder etwas und liegt hinter Kopf und Körper – nur über der
  Rolle liegen Hand und Federspitze vorn. In der Pause zieht die Tinte ein
  (verblasst), damit der Loop nahtlos ist.
* Er atmet: Kopf und Oberkörper heben sich im Rhythmus um 1 px (die Zeile
  darunter wird gedehnt, die Füße bleiben stehen).
* Er blinzelt einmal pro Loop in der Schreibpause (halb -> zu -> halb).
* Über den goldenen Kapuzenrand läuft einmal pro Loop ein Glanz.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import rotate_part

SRC = np.array(Image.open('src/thep-the-court-scribe.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 3, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
QUILL_COLS = {rgb(c) for c in ('9e9e9e', '6c6c6c', 'e2e2e2')}
# Feder + Hand mit Federspitze (links unten, Spitze bei x3, y24)
GROUP = np.array([[bool(SRC[y, x, 3]) and ((y < 19 and x < 9 and tuple(SRC[y, x]) in QUILL_COLS)
                                           or (18 <= y <= 24 and x <= 5)) for x in range(SW)] for y in range(SH)])
NIB = (3, 24)
PIVOT = (3.5, 23.5)
SCROLL = {rgb(c) for c in ('bbad9f', 'a69482', 'd1c5bd', 'c7bab0', '817264')}
INK = rgb('4a2c0a')
REACH = (9, -1, -0.25)                               # Versatz der Spitze an der Rolle, Neigung der Feder
JITTER = [0, -1, 0, 0, -1, 0, -1, 0]                 # krakelige Schrift


def pose(i):
    """(dx, dy, Winkel) der Feder-Hand-Gruppe."""
    rx, ry, ra = REACH
    if 6 <= i <= 9:                                  # hinübergreifen
        f = (i - 5) / 4
        return int(round(rx * f)), int(round(ry * f)), ra * f
    if 10 <= i <= 17:                                # Zeile 1
        return rx + (i - 10), ry + JITTER[i - 10], ra
    if i == 18:                                      # neue Zeile
        return rx, ry + 3, ra
    if 19 <= i <= 25:                                # Zeile 2
        return rx + (i - 19), ry + 3 + JITTER[i - 19], ra
    if 26 <= i <= 29:                                # zurückziehen
        f = (30 - i) / 5
        return int(round((rx + 3) * f)), int(round((ry + 3) * f)), ra * f
    return 0, 0, 0.0


WRITE = [k for k in range(10, 26) if k != 18]
INK_PX = {k: (NIB[0] + pose(k)[0], NIB[1] + pose(k)[1]) for k in WRITE}
BODY_Y = 28                                          # ab hier stehen die Füße
FACE, LASH = rgb('53597d'), rgb('000000')
# großes, rundes Ibis-Auge (x10–12, Zeilen 11–13) und das kleine türkise Auge (x15)
EYE_BIG = [(x, y) for x in (10, 11, 12) for y in (11, 12, 13)]
BLINK = {33: 'halb', 34: 'zu', 35: 'zu', 36: 'halb'}
GOLD = {rgb(c) for c in ('ffd248', 'fdecc1', 'd1a741')}
WHITE = np.array([255, 252, 220])
def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


def shine(c, x, y, i):
    if tuple(c) not in GOLD:
        return c
    g = i * 0.7 - 4
    d = abs(x - y * 0.5 - g)
    if d > 1.0:
        return c
    return np.array([*(np.array(c[:3]) * 0.4 + WHITE * 0.6).astype(int), 255])


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for x, y in EYE_BIG:                         # Lid senkt sich von oben
            if y == 11 or st == 'zu':
                s[y, x] = LASH if (st == 'halb' or y == 12) else FACE
        s[12, 15] = LASH if st == 'halb' else FACE
        if st == 'zu':
            s[13, 15] = LASH
    # Tinte: bleibt stehen, verblasst in der Pause (Frames 38–45)
    fade = 1.0 if i <= 37 else max(0.0, 1 - (i - 37) / 8)
    for k, (x, y) in INK_PX.items():
        if k < i and fade > 0 and tuple(SRC[y, x]) in SCROLL:
            s[y, x, :3] = (np.array(INK[:3]) * fade + SRC[y, x, :3] * (1 - fade)).astype(int)
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    front = np.zeros((H, W), bool)                   # hier darf die Hand vorn liegen (Rolle)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3] or GROUP[y, x]:
                continue
            yy = y + PT + (b if y < BODY_Y else 0)
            out[yy, x + P] = shine(s[y, x], x, y, i)
            front[yy, x + P] = tuple(SRC[y, x]) in SCROLL
    if b:
        y = BODY_Y - 1
        for x in range(SW):
            if s[y, x, 3] and not GROUP[y, x] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    dx, dy, ang = pose(i)
    part = rotate_part(SRC, GROUP, PIVOT, ang, (H, W), (P + dx, PT + b + dy))
    m = (part[:, :, 3] > 0) & ((out[:, :, 3] == 0) | front)
    out[m] = part[m]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'thep_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
