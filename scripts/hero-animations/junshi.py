# -*- coding: utf-8 -*-
"""Idle-Animation für Junshi, the Tactical Genius (MotiveChina.xcf: „Junshi“).

* Er federt in den Knien (die Füße bleiben stehen).
* Er gibt Anweisungen: zweimal pro Loop hebt er den ausgestreckten Arm ein
  Stück (nur der blaue Ärmel, spaltenweise gehoben, zur Hand hin stärker –
  er bleibt an der Schulter; Hutkrempe und Schnurrbartspitzen bleiben am
  Gesicht), hält ihn kurz und senkt ihn wieder.
* Er blinzelt zweimal pro Loop (geschlossen: 2 px breite schwarze Striche).
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import fill_pinholes

SRC = np.array(Image.open('src/junshi-the-tactical-genius.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 24
ARM_X = 16                                           # ab hier liegt der Ärmel
SLEEVE = {rgb(c) for c in ('17203f', '2e3e68', '1f2852', '273462')}   # nur das Blau (nicht Hut/Bart)
BLACK = (0, 0, 0, 255)
SKIN, LID = rgb('ffd5a4'), rgb('d0a983')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
LASH = [(9, 6), (13, 6)]                             # schwarze Lidpixel über den Augen
WHITES = [(9, 7), (13, 7)]
LINE = [(9, 7), (10, 7), (12, 7), (13, 7)]


def point(i):
    """Hub des Arms an der Hand (0..3): heben, halten, senken, Pause."""
    t = i % 24
    return [0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1][t // 2]


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for x, y in WHITES:
            s[y, x] = LID
        if st == 'zu':
            for x, y in LASH:
                s[y, x] = LID
            for x, y in LINE:
                s[y, x] = BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    lift = point(i)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dy = b if y < KNEE else 0
            if x >= ARM_X and tuple(s[y, x]) in SLEEVE:
                dy -= int(round(lift * (x - ARM_X + 1) / (SW - ARM_X)))
            out[y + PT + dy, x + P] = s[y, x]
    if b < 0:                                        # Zeile über dem Knie dehnen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'junshi_idle_{tag}', frames, ms, scale=8, check_edges=True)
