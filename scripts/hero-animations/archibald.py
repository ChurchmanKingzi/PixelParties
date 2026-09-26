# -*- coding: utf-8 -*-
"""Idle-Animation für Archibald, the Archmage (21x32 + 2 px oben = 21x34).

Er hält einen Vortrag:
* Der Mund redet (zu / offen / weit offen), unregelmäßig wie beim Sprechen.
* Bei jeder Betonung reißt er die offene Hand hoch, nickt mit
  dem Kopf und reißt den Mund weit auf; der Bart schwingt nach.
* Blinzeln, funkelnde Sterne auf dem Hut, leichtes Gewichtverlagern.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, sparkle_pixels, save_outputs

SRC = np.array(Image.open('src/archibald-the-archmage.png').convert('RGBA')).astype(int)
PT = 2
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 40


def P(x, y):
    return x, y + PT


# ---------------------------------------------------------------- Timing
EMPHASIS = [6, 19, 31]                 # Betonungen im Vortrag


def emph(i):
    """0..1 Stärke der aktuellen Betonung (kurz hoch, dann abklingend)."""
    t = i % N
    for e in EMPHASIS:
        d = t - e
        if 0 <= d < 6:
            return [1.0, 1.0, 1.0, 0.6, 0.3, 0.0][d]
    return 0.0


MOUTH_TALK = [1, 1, 0, 1, 2, 1, 0, 0, 1, 2, 1, 1, 0, 1, 0, 2, 1, 0, 1, 1]


def mouth_state(i):
    if emph(i) >= 0.9:
        return 2
    t = i % N
    if 36 <= t < 40:
        return 0                        # kurze Pause
    return MOUTH_TALK[i % len(MOUTH_TALK)]


# ---------------------------------------------------------------- Gesicht
MUST = rgb('7b7b7b')
MOUTH_D, MOUTH_R = rgb('311800'), rgb('660006')
SKIN = rgb('ffd5a4')
EYES = [(8, 17), (11, 17)]


def face(a, i):
    st = mouth_state(i)
    m = [(9, 19), (10, 19), (9, 20), (10, 20)]
    if st == 0:                                   # zu: Schnurrbart schließt
        for x, y in m:
            a[P(x, y)[1], x] = MUST
        a[P(9, 20)[1], 9] = MOUTH_D
        a[P(10, 20)[1], 10] = MOUTH_D
    elif st == 2:                                 # weit offen
        a[P(9, 21)[1], 9] = MOUTH_D
        a[P(10, 21)[1], 10] = MOUTH_R
    t = i % N
    if t in (13, 14, 27):                         # blinzeln
        for x, y in EYES:
            a[P(x, y)[1], x] = SKIN


STARS = [(9, 6), (8, 7), (11, 9), (10, 10), (15, 12), (11, 13), (7, 14)]
STAR_TW = [(x, y + PT, s) for (x, y), s in zip(STARS, [0, 7, 14, 21, 28, 34, 3])]


# ---------------------------------------------------------------- Frame
HAND = [(x, y) for y in range(19, 23) for x in range(14, 19) if SRC[y, x, 3]]
HAND_SET = set(HAND)


def frame(i):
    s = BASE.copy()
    face(s, i)
    e = emph(i)
    nod = 1 if e >= 0.9 else 0                    # Kopf nickt bei Betonung
    sway = 1 if (i % N) >= 20 else 0              # Gewicht verlagern
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            oy = y - PT
            if oy >= 29:
                dx, dy = 0, 0                     # Füße
            elif oy <= 17:
                dx, dy = 0, nod + (sway if oy >= 10 else 0)
            elif 18 <= oy <= 30 and 7 <= x <= 12:
                bi = i - 1                        # Bart schwingt nach
                dx = 1 if (emph(bi) >= 0.9 and oy >= 25) else 0
                dy = (1 if emph(bi) >= 0.9 else 0) + sway
            else:
                dx, dy = 0, sway
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3] and (sx, sy - PT) not in HAND_SET:
                out[y, x] = s[sy, sx]
    # Hand: hebt sich bei Betonung (bis 3 px), Ärmel wird dabei gestreckt
    lift = -int(round(3 * e)) + sway
    for x, y in HAND:
        yy = y + PT
        lo, hi = sorted((yy, yy + lift))
        for k in range(lo, hi + 1):
            if 0 <= k < H and (x in (15, 18) or k == yy + lift):
                out[k, x] = s[yy, x]
        if 0 <= yy + lift < H:
            out[yy + lift, x] = s[yy, x]
    for (x, y), c in sparkle_pixels(i, N, STAR_TW, rgb('fcfc03'), rgb('ffff63')).items():
        yy = y + nod + (sway if y - PT >= 10 else 0)
        if 0 <= x < W and 0 <= yy < H:
            out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'archibald_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
