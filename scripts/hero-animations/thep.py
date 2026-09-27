# -*- coding: utf-8 -*-
"""Idle-Animation für Thep, the Court Scribe (MotiveEgypt.xcf, Ebene „Thep“).

* Er schreibt: in der ersten Loop-Hälfte kritzelt die Federspitze in kurzen
  Strichen hin und her (die Feder wird zur Spitze hin geschert, der Kiel in
  der Hand bleibt), danach ruht sie.
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

SRC = np.array(Image.open('src/thep-the-court-scribe.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 3, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
QUILL_COLS = {rgb(c) for c in ('9e9e9e', '6c6c6c', 'e2e2e2')}
QUILL = {(x, y) for y in range(0, 19) for x in range(0, 9) if SRC[y, x, 3] and tuple(SRC[y, x]) in QUILL_COLS}
QUILL_ROOT = 19
BODY_Y = 28                                          # ab hier stehen die Füße
FACE, LASH = rgb('53597d'), rgb('000000')
# großes, rundes Ibis-Auge (x10–12, Zeilen 11–13) und das kleine türkise Auge (x15)
EYE_BIG = [(x, y) for x in (10, 11, 12) for y in (11, 12, 13)]
BLINK = {33: 'halb', 34: 'zu', 35: 'zu', 36: 'halb'}
GOLD = {rgb(c) for c in ('ffd248', 'fdecc1', 'd1a741')}
WHITE = np.array([255, 252, 220])
# Schreibstriche: Versatz der Federspitze pro Frame (erste Hälfte), dann Ruhe
STROKES = [0, 1, 1, 0, -1, 0, 1, 1, 0, 0, -1, -1, 0, 1, 0, -1, 0, 1, 1, 0, -1, -1, 0, 0]


def quill_dx(y, i):
    a = STROKES[i] if i < len(STROKES) else 0
    return int(round(a * (QUILL_ROOT - y) / QUILL_ROOT * 1.4))


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
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dx = quill_dx(y, i) if (x, y) in QUILL else 0
            out[y + PT + (b if y < BODY_Y else 0), x + P + dx] = shine(s[y, x], x, y, i)
    if b:
        y = BODY_Y - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'thep_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
