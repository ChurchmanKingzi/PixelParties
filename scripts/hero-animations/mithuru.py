# -*- coding: utf-8 -*-
"""Idle-Animation für Lord Mithuru, the Rotten Mastermind (MotiveArcanum.xcf:
Mithuru + Weinglas aus „Ebene #29“/„Ebene #30“).

* Er hält sein Weinglas: der Wein schwenkt darin hin und her (die Oberfläche
  kippt, der Glanz wandert mit), das Glas atmet mit der Hand mit.
* Squash and Stretch aus den Knien: der Oberkörper samt Armen und Glas
  federt 1 px hoch (Kniezeile gedehnt) und 1 px tief (Kniezeile gestaucht),
  die Füße bleiben stehen.
* Sein Auge ohne Glas blinzelt richtig (offen -> halb -> zu -> halb -> offen).
* Die Haare schwingen leicht mit: die oberen Reihen pendeln seitlich nach.
* Über sein Brillenglas huscht einmal pro Loop ein Lichtreflex.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

BODY = np.array(Image.open('src/lord-mithuru-the-rotten-mastermind-body.png').convert('RGBA')).astype(int)
GLASS = np.array(Image.open('src/lord-mithuru-the-rotten-mastermind-glass.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PT, P = 3, 2
H, W = SH + PT + 1, SW + 2 * P
N = 32
KNEE = 25                                           # ab hier stehen die Unterschenkel
WINE, WINE_HI = (229, 90, 90, 245), (244, 103, 101, 245)
RIM = [(11, 15), (12, 15), (13, 15)]
SURF = [(11, 16), (12, 16), (13, 16)]
LENS = [(9, 10), (9, 9), (10, 10), (10, 9)]           # nur das Brillenglas
EYE_TOP, EYE_BOT = (5, 9), (5, 10)                   # Auge ohne Glas
LID, LASH = rgb('f8bc77'), rgb('543d00')
HAIR = {rgb(c) for c in ('684d00', '927000', '725500', '8c6b05', '7b5d00', '543d00')}
WHITE, SHINE = rgb('ffffff'), rgb('e8f6ff')


def bounce(i):
    """-1 = gestreckt (hoch), +1 = gestaucht (tief)."""
    return [0, 0, -1, -1, -1, 0, 0, 1, 1, 1, 0, 0][i % 12]


def blink(s, i):
    t = (i - 14) % N
    state = {0: 'halb', 1: 'zu', 2: 'zu', 3: 'halb'}.get(t)
    if state == 'halb':
        s[EYE_TOP[1], EYE_TOP[0]] = LASH
    elif state == 'zu':
        s[EYE_TOP[1], EYE_TOP[0]] = LID
        s[EYE_BOT[1], EYE_BOT[0]] = LASH


def hair_dx(x, y, i):
    if y > 3 or tuple(BODY[y, x]) not in HAIR:
        return 0
    sway = math.sin(2 * math.pi * i / 12 - 1.2 - 0.4 * y)     # hängt nach
    return int(round(sway * (1.0 if y <= 1 else 0.6)))


def slosh(g, i):
    """Wein kippt: links hoch – eben – rechts hoch – eben (Glanz wandert mit)."""
    phase = (i // 3) % 4
    for x, y in SURF:
        g[y, x] = WINE
    hi = [11, 12, 13, 12][phase]
    g[16, hi] = WINE_HI
    if phase == 0:                                   # links hochgeschwappt
        g[15, 11] = WINE
        g[16, 13] = GLASS[17, 12]
    elif phase == 2:                                 # rechts hochgeschwappt
        g[15, 13] = WINE
        g[16, 11] = GLASS[17, 12]


def glint(s, i):
    t = i - 22
    if not 0 <= t < 6:
        return
    for k, (x, y) in enumerate(LENS):
        if k == t:
            s[y, x] = WHITE
        elif abs(k - t) == 1:
            s[y, x] = SHINE


def frame(i):
    s = BODY.copy()
    glint(s, i)
    blink(s, i)
    g = GLASS.copy()
    slosh(g, i)
    b = bounce(i)
    out = np.zeros((H, W, 4), int)
    for src in (s, g):
        for y in range(SH):
            for x in range(SW):
                if src[y, x, 3]:
                    c = src[y, x]
                    dx = hair_dx(x, y, i) if src is s else 0
                    oy, ox = y + PT + (b if y < KNEE else 0), x + P + dx
                    if c[3] < 255 and out[oy, ox, 3]:        # halbtransparentes Glas mischen
                        f = c[3] / 255
                        c = (*[int(round(f * c[k] + (1 - f) * out[oy, ox, k])) for k in range(3)], 255)
                    out[oy, ox] = c
    if b < 0:                                        # gestreckt: Kniezeile dehnen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'mithuru_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
