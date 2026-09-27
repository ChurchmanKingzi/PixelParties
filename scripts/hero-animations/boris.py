# -*- coding: utf-8 -*-
"""Idle-Animation für Boris, the Guardian of Blackport (23x40 + 2 px oben/links = 25x42).

* Er stemmt das Schwert hoch (bis 2 px; Klinge, Parierstange, Faust und Knauf
  als Einheit, der Arm streckt sich mit) und senkt es wieder.
* Oben angekommen brüllt er: der Mund reißt weit auf, Schrei-Linien zucken
  vor seinem Gesicht; unten schließt er den Mund.
* Leichtes Atmen der Rüstung, die Füße stehen fest.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, save_outputs

SRC = np.array(Image.open('src/boris-the-guardian-of-blackport.png').convert('RGBA')).astype(int)
PT, PL = 2, 2
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1] + PL, 4), int)
BASE[PT:, PL:] = SRC
H, W = BASE.shape[:2]
N = 48

HAIR = {rgb(c) for c in ('663c32', 'be7e4e', 'f1b65a', 'ffe979')}
MOUTH_DARK, MOUTH_RED, SKIN, LIP = rgb('580000'), rgb('9c0000'), rgb('f7bd7b'), rgb('663c32')


def in_sword(x, oy):
    c = px(SRC, x, oy)
    if c is None or SRC[oy, x, 3] == 0:
        return False
    if oy <= 17:
        return 15 <= x <= 18
    if 18 <= oy <= 20:
        return 11 <= x <= 22 and c not in HAIR
    if 21 <= oy <= 23:
        return 15 <= x <= 19
    if 24 <= oy <= 25:
        return 14 <= x <= 19
    return False


SWORD = [(x, oy) for oy in range(26) for x in range(SRC.shape[1]) if in_sword(x, oy)]
SWORD_SET = set(SWORD)


def lift(i):
    t = i % N
    if 12 <= t < 15 or 33 <= t < 36:
        return 1
    if 15 <= t < 33:
        return 2
    return 0


def shouting(i):
    return 16 <= i % N < 32


def mouth(a, i):
    """Mund: zu (Schwert unten), offen (Original), weit auf (Brüllen)."""
    t = i % N
    y = PT
    if shouting(i):
        a[25 + y, 9 + PL] = MOUTH_RED
        a[27 + y, 10 + PL] = MOUTH_DARK
        a[27 + y, 11 + PL] = MOUTH_DARK
    elif t < 10 or t >= 40:
        a[25 + y, 10 + PL] = SKIN
        a[25 + y, 11 + PL] = LIP
        a[26 + y, 10 + PL] = SKIN
        a[26 + y, 11 + PL] = SKIN


def under(x, oy, s):
    """Was unter dem angehobenen Schwert sichtbar wird."""
    if oy <= 20:                                          # Parierstange über dem Haar
        for d in range(1, 5):
            if x - d >= 0 and s[oy + PT, x - d + PL, 3] and (x - d, oy) not in SWORD_SET:
                return s[oy + PT, x - d + PL]
        return None
    for d in range(1, 6):                                 # unter der Faust: Arm
        yy = oy + d
        if yy < SRC.shape[0] and s[yy + PT, x + PL, 3] and (x, yy) not in SWORD_SET:
            return s[yy + PT, x + PL]
    return None


# Schrei-Linien links vor dem Gesicht (Leinwandkoordinaten x, Originalzeile)
SHOUT_LINES = [[(3, 21), (2, 20), (1, 19), (0, 18)], [(3, 24), (2, 24), (1, 24), (0, 24)],
               [(3, 27), (2, 28), (1, 29), (0, 30)]]


def breath(i):
    return -1 if 6 <= i % 24 < 15 else 0


def frame(i):
    s = BASE.copy()
    mouth(s, i)
    out = np.zeros_like(s)
    b = breath(i)
    feet = 36
    for y in range(H):
        for x in range(W):
            oy = y - PT
            if not s[y, x, 3] or (x - PL, oy) in SWORD_SET:
                continue
            ty = y + (b if oy < feet else 0)
            out[ty, x] = s[y, x]
    if b < 0:
        for x in range(W):
            if s[feet - 1 + PT, x, 3] and not out[feet - 1 + PT, x, 3]:
                out[feet - 1 + PT, x] = s[feet - 1 + PT, x]
    L = lift(i)
    if L:
        moved = {(x, oy - L) for x, oy in SWORD}
        for x, oy in SWORD:
            if (x, oy) not in moved:
                c = under(x, oy, s)
                if c is not None:
                    out[oy + PT + b, x + PL] = c
    for x, oy in SWORD:
        out[oy + PT + b - L, x + PL] = s[oy + PT, x + PL]
    if shouting(i):                                       # Schrei-Linien zucken
        for k, line in enumerate(SHOUT_LINES):
            if (i + k) % 3 == 2:
                continue
            off = (i // 2 + k) % 2
            for n, (x, oy) in enumerate(line):
                xx, yy = x + 1 - off, oy + PT + b
                if 0 <= xx < W and out[yy, xx, 3] == 0:
                    out[yy, xx] = (255, 245, 210, 230 - n * 50)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'boris_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
