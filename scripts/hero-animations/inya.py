# -*- coding: utf-8 -*-
"""Idle-Animation für Card Game Player Inya (20x29 + Rand = 24x33).

Sie denkt sehr scharf nach:
* Die vier weißen Federn an der Baskenmütze schwingen einzeln
  (Spitze am stärksten, jede mit eigenem Takt).
* Die Augen huschen hin und her, die Stirn legt sich in Falten,
  der Finger tippt ans Kinn, sie blinzelt.
* Ab und zu steigt ein kleines Fragezeichen auf; ruhiges Atmen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/card-game-player-inya.png').convert('RGBA')).astype(int)
PL, PT, PR = 1, 4, 3
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1] + PL + PR, 4), int)
BASE[PT:, PL:PL + SRC.shape[1]] = SRC
H, W = BASE.shape[:2]
N = 48

FEATHER_COLS = {rgb('f1feff'), rgb('8593d2'), rgb('552e7a'), rgb('b4bcf9')}


def P(x, y):
    return x + PL, y + PT


def feather_of(ox, oy):
    """Welche der vier Federn (oder None)."""
    c = px(SRC, ox, oy)
    if c not in FEATHER_COLS:
        return None
    if ox <= 4:
        return 'LO' if oy <= 8 else 'LU'
    if ox >= 15:
        return 'RO' if oy <= 8 else 'RU'
    return None


# (Ansatzpunkt am Hut, Periode, Phase)
FEATHERS = {'LO': ((5, 7), 16, 0.0), 'LU': ((4, 10), 12, 1.7),
            'RO': ((14, 7), 16, 2.9), 'RU': ((15, 10), 24, 4.2)}
FEATHER_PX = {k: [] for k in FEATHERS}
for oy in range(SRC.shape[0]):
    for ox in range(SRC.shape[1]):
        f = feather_of(ox, oy)
        if f:
            FEATHER_PX[f].append((ox, oy))
ALL_FEATHER = {p for pts in FEATHER_PX.values() for p in pts}


def breath(i, lag=0):
    t = (i - lag) % N
    return 1 if 14 <= t < 38 else 0


def feather_offset(name, ox, oy, i):
    (ax, ay), period, ph = FEATHERS[name]
    dist = math.hypot(ox - ax, oy - ay)
    w = min(1.0, dist / 4)
    dy = int(round(1.3 * w * wave(i, period, ph)))
    dx = int(round(0.7 * w * wave(i, period, ph + 1.3)))
    return dx, dy


# ---------------------------------------------------------------- Gesicht
WHITE, IRIS = rgb('f1feff'), rgb('9d9387')
LASH, SKIN = rgb('413704'), rgb('f6bc97')


def face(a, i):
    t = i % N
    gaze = [0] * 6 + [-1] * 6 + [0] * 4 + [1] * 8 + [0] * 6 + [-1] * 4 + [1] * 6 + [0] * 8
    g = gaze[t]
    y = 13 + PT
    # Auge links: (7,13) weiß, (8,13) Iris; rechts: (11,13) Iris, (12,13) weiß
    if g == -1:
        a[y, 7 + PL], a[y, 8 + PL] = IRIS, WHITE
        a[y, 11 + PL], a[y, 12 + PL] = IRIS, WHITE
    elif g == 1:
        a[y, 7 + PL], a[y, 8 + PL] = WHITE, IRIS
        a[y, 11 + PL], a[y, 12 + PL] = WHITE, IRIS
    if 16 <= t < 26:                                   # Stirn in Falten
        a[11 + PT, 9 + PL] = LASH
        a[11 + PT, 11 + PL] = LASH
    if t in (30, 31, 45):                              # blinzeln
        for x in (7, 8, 11, 12):
            a[y, x + PL] = SKIN
    if t % 8 in (2, 3):                                # Finger tippt ans Kinn
        # nur die Fingerlinie im Inneren der Hand wandert, der braune Rand bleibt
        a[16 + PT, 9 + PL] = rgb('3a2409')
        a[16 + PT, 10 + PL] = rgb('f6bc97')


QUESTION = ["###", "..#", ".##", "...", ".#."]      # 3x5-Fragezeichen


def question(out, i):
    t = (i - 20) % N
    if t >= 14:
        return
    x0, y0 = 18, 4 - t // 3 + 2
    a = 230 if t < 9 else int(230 * (14 - t) / 5)
    for dy, row in enumerate(QUESTION):
        for dx, ch in enumerate(row):
            if ch == '#':
                x, y = x0 + dx, y0 + dy
                if 0 <= x < W and 0 <= y < H and out[y, x, 3] == 0:
                    out[y, x] = (241, 254, 255, a)


def frame(i):
    s = BASE.copy()
    face(s, i)
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            ox, oy = x - PL, y - PT
            if oy >= 25:
                dy = 0                                  # Füße
            elif oy <= 14:
                dy = breath(i, 1)
            else:
                dy = breath(i)
            sx, sy = x, y - dy
            if 0 <= sy < H and s[sy, sx, 3] and (sx - PL, sy - PT) not in ALL_FEATHER:
                out[y, x] = s[sy, sx]
    # Federn: jede dreht sich als Ganzes um ihren Ansatz am Hut (Rückwärts-Mapping)
    hb = breath(i, 1)
    for name, pts in FEATHER_PX.items():
        (ax, ay), period, ph = FEATHERS[name]
        ang = 0.32 * wave(i, period, ph)
        ca, sa = math.cos(ang), math.sin(ang)
        pset = set(pts)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        for oy in range(min(ys) - 3, max(ys) + 4):
            for ox in range(min(xs) - 3, max(xs) + 4):
                rx, ry = ox - ax, oy - ay
                sx = int(round(ax + ca * rx + sa * ry))
                sy = int(round(ay - sa * rx + ca * ry))
                if (sx, sy) in pset:
                    x, y = ox + PL, oy + PT + hb
                    if 0 <= x < W and 0 <= y < H:
                        out[y, x] = s[sy + PT, sx + PL]
    question(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'inya_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
