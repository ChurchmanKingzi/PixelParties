# -*- coding: utf-8 -*-
"""Idle-Animation für Kazena, the Storming Rebel (26x37 + Rand = 31x40).

* Sie schwebt: ganzer Körper gleitet sanft auf und ab, Beine hängen nach.
* Heftiger Sturm: die langen grünen Haare fliegen wild (überlagerte schnelle
  Wellen, Stärke wächst zu den Spitzen), lose Strähnen peitschen davon,
  Windschlieren fegen durchs Bild, der Saum flattert.
* Die Arme schwingen unabhängig voneinander um die Schultern.
* Mimik: Blinzeln, das Grinsen (weiß) wird zwischendurch breiter.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/kazena-the-storming-rebel.png').convert('RGBA')).astype(int)
PAD_L, PAD_T, PAD_R, PAD_B = 1, 3, 4, 0
BASE = np.zeros((SRC.shape[0] + PAD_T + PAD_B, SRC.shape[1] + PAD_L + PAD_R, 4), int)
BASE[PAD_T:PAD_T + SRC.shape[0], PAD_L:PAD_L + SRC.shape[1]] = SRC
H, W = BASE.shape[:2]
N = 48
CLEAR = (0, 0, 0, 0)


def P(x, y):
    """Originalkoordinate -> Leinwand."""
    return x + PAD_L, y + PAD_T


FACE_BOX = (8, 15, 11, 17)          # Original-Koordinaten (x0, x1, y0, y1)


def is_green(c):
    r, g, b, a = c
    return a > 0 and g > r and g > b


def orig(x, y):
    return x - PAD_L, y - PAD_T


def is_hair(x, y):
    ox, oy = orig(x, y)
    if FACE_BOX[0] <= ox <= FACE_BOX[1] and FACE_BOX[2] <= oy <= FACE_BOX[3]:
        return False
    c = px(BASE, x, y)
    if not is_green(c):
        return False
    return oy <= 17 or (ox >= 16 and oy <= 19)


HAIR = {(x, y) for y in range(H) for x in range(W) if is_hair(x, y)}
ANCHOR = P(12, 11)


# ---------------------------------------------------------------- Bewegung
def float_dy(i, lag=0.0):
    return int(round(1.4 * wave(i - lag, N, 0.0)))


def hair_offset(x, y, i):
    """Wildes Flattern: Summe schneller Wellen, Stärke wächst zur Spitze."""
    d = math.hypot(x - ANCHOR[0], (y - ANCHOR[1]) * 1.1)
    u = max(0.0, min(1.0, (d - 3) / 12))
    dx = u * (1.8 * wave(i, 8, -2.4 * u + y * 0.35) + 0.9 * wave(i, 12, 1.3 - 1.5 * u))
    dy = u * (1.5 * wave(i, 6, -2.0 * u + x * 0.30) + 0.7 * wave(i, 16, 0.4 + x * 0.1))
    dx += 0.8 * u                                   # Wind drückt nach rechts
    return dx, dy


def arm_dy(ox, oy, i):
    """Arme schwingen um die Schultern (unabhängig voneinander, gegen den Sturm)."""
    if not 19 <= oy <= 24:
        return 0
    if ox <= 7:
        ang = 0.38 * wave(i, 24, 0.0) + 0.15 * wave(i, 16, 1.2)
        return int(round(ang * (7 - ox)))
    if ox >= 17:
        ang = 0.38 * wave(i, 24, 2.3) + 0.15 * wave(i, 12, 0.4)
        return int(round(ang * (ox - 17)))
    return 0


def hem_dx(oy, i):
    if 24 <= oy <= 28:
        return int(round(0.8 * (oy - 23) / 5 * wave(i, 8, oy * 0.9)))
    return 0


# ---------------------------------------------------------------- Mimik
SKIN = rgb('f6cd8b')
SKIN_D = rgb('f6bd98')
LASH = rgb('413705')
TEETH = rgb('ffffff')
EYES = [(9, 13), (10, 13), (13, 13), (14, 13), (9, 14), (10, 14), (13, 14), (14, 14)]


def face(a, i):
    t = i % N
    if t in (9, 10, 31):
        for ox, oy in EYES:
            x, y = P(ox, oy)
            a[y, x] = SKIN if oy == 13 else LASH
    if 18 <= t < 28:                                # breiteres Grinsen
        for ox, oy in ((13, 17), (10, 17)):
            x, y = P(ox, oy)
            a[y, x] = TEETH


# ---------------------------------------------------------------- Sturm-Extras
STRANDS = [  # lose Strähnen: Startpunkt (Original), Startframe
    ((20, 6), 0), ((23, 11), 11), ((18, 3), 22), ((24, 8), 33), ((16, 15), 40),
]
STRAND_COL = [rgb('186504'), rgb('0d3902'), rgb('061c01')]
STREAKS = [(13, 0), (24, 16), (31, 30), (8, 40)]   # (Zeile, Startframe)
STREAK_ALPHA = [150, 120, 90, 60, 35]            # Kopf -> auslaufender Schweif


def storm_extras(out, i, bob):
    for (ox, oy), start in STRANDS:
        t = (i - start) % N
        if t >= 6:
            continue
        x0, y0 = P(ox, oy)
        x0 += int(t * 1.2) + 1
        y0 += bob + int(round(math.sin(t * 1.3)))
        for k in range(3):                          # kurze, fliegende Strähne
            xx, yy = x0 + k, y0 - (k // 2) * (1 if t % 2 else -1)
            if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                out[yy, xx] = STRAND_COL[min(2, t // 2)]
    for row, start in STREAKS:
        t = (i - start) % N
        if t >= 10:
            continue
        x_head = -4 + t * 4
        for k, al in enumerate(STREAK_ALPHA):
            xx = x_head - k
            y = row + int(round(0.9 * math.sin((xx + t) * 0.35)))   # leichter Schwung
            if 0 <= xx < W and 0 <= y < H and out[y, xx, 3] == 0:
                out[y, xx] = (220, 240, 236, al)


def frame(i):
    s = BASE.copy()
    face(s, i)
    out = np.zeros_like(s)
    body = float_dy(i)
    # Körper, Gesicht (ohne Haare)
    for y in range(H):
        for x in range(W):
            ox, oy = orig(x, y)
            if oy >= 26:
                dy = float_dy(i, 2)                  # Beine hängen nach
            elif oy <= 17:
                dy = float_dy(i, 1)                  # Kopf leicht verzögert
            else:
                dy = body + arm_dy(ox, oy, i)
            dx = hem_dx(oy, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and (sx, sy) not in HAIR and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
    # Haare (hinter Gesicht/Körper), wild verformt
    head = float_dy(i, 1)
    hair_layer = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            dx, dy = hair_offset(x, y - head, i)
            sx, sy = int(round(x - dx)), int(round(y - head - dy))
            if (sx, sy) in HAIR:
                hair_layer[y, x] = s[sy, sx]
    mask = (out[..., 3] == 0) & (hair_layer[..., 3] > 0)
    out[mask] = hair_layer[mask]
    storm_extras(out, i, head)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'kazena_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=10)
