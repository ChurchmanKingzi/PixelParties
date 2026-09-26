# -*- coding: utf-8 -*-
"""Idle-Animation für Sparrow, the Buffoon of the Treasure Cave (50x45).

* Der Stuhl auf seinem Kopf brennt: prozedurale Flamme aus der Hitzekarte
  des Originals (Zungen wachsen/schrumpfen, Hitze steigt auf), Funken.
* Er schielt: die Pupillen wandern unabhängig voneinander durch die Augen.
* Er sabbert: Faden am Mund zieht sich, Tropfen fällt beschleunigt in die
  Pfütze, die aufspritzt und schimmert.
* Schwert falschrum: pendelt tollpatschig um die Hand, ab und zu haut er mit
  dem Griff nach unten (Comic-Aufprallstern).
* Leichtes Wippen; Kopf/Stuhl folgen verzögert, die erhobene Hand winkt,
  die Füße bleiben am Boden.
"""
import math
import sys
from PIL import Image
import numpy as np

BASE = np.array(Image.open('src/sparrow-the-buffoon-of-the-treasure-cave.png').convert('RGBA')).astype(int)
H, W = BASE.shape[:2]
N = 40
CLEAR = (0, 0, 0, 0)


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def px(a, x, y):
    return tuple(int(v) for v in a[y, x])


def wave(i, period, phase=0.0):
    return math.sin(2 * math.pi * i / period + phase)


# ---------------------------------------------------------------- Feuer
FIRE = [None, rgb('ffb500'), rgb('ffd800'), rgb('ffff00'), rgb('ffff9a'), rgb('ffffff')]
HEAT_OF = {c: k for k, c in enumerate(FIRE) if c}
FX0, FX1, FY0, FY1 = 20, 43, 0, 27
HEAT = np.zeros((H, W))
FLAME = set()
for y in range(FY0, FY1 + 1):
    for x in range(FX0, FX1 + 1):
        c = px(BASE, x, y)
        if c in HEAT_OF:
            HEAT[y, x] = HEAT_OF[c]
            FLAME.add((x, y))
FLAME_BOTTOM = {x: max([y for (xx, y) in FLAME if xx == x], default=None) for x in range(W)}

_rng = np.random.default_rng(3)
_nz = _rng.random((40, W))
for _ in range(2):
    _nz = (np.roll(_nz, 1, 0) + 2 * _nz + np.roll(_nz, -1, 0)) / 4
    _nz = (np.roll(_nz, 1, 1) + 2 * _nz + np.roll(_nz, -1, 1)) / 4
NOISE = (_nz - _nz.min()) / (_nz.max() - _nz.min())
PH1 = _rng.random(W) * 2 * math.pi
PH2 = _rng.random(W) * 2 * math.pi


def flame_heat(x, y, i):
    base = FLAME_BOTTOM.get(x)
    if base is None:
        # Nachbarspalten erlauben Zungen, die seitlich hineinwachsen
        return 0
    t = 2 * math.pi * i / N
    s = 1.0 + 0.16 * (0.6 * math.sin(2 * t + PH1[x]) + 0.4 * math.sin(3 * t + PH2[x]))
    sy = int(round(base - (base - y) / s))
    lean = int(round(0.8 * math.sin(t * 2) * max(0, 14 - y) / 12))
    sx = x - lean
    if not (FY0 <= sy <= FY1 and FX0 <= sx <= FX1):
        return 0
    h = HEAT[sy, sx]
    if h == 0:
        return 0
    if h >= 2:
        v = NOISE[(y + i) % 40, x]
        if v > 0.75:
            h += 1
        elif v < 0.25:
            h -= 1
        h = max(2, min(5, h))
    return int(h)


EMBERS = [(24, 2, 0), (29, 0, 9), (34, 0, 17), (38, 2, 26), (31, 1, 33)]
EMBER_COL = [rgb('ffff9a'), rgb('ffd800'), rgb('ffb500'), rgb('c86400')]


def embers(i):
    out = []
    for x0, y0, off in EMBERS:
        t = (i + off) % N
        if t >= 8:
            continue
        y = y0 + 4 - t // 2 - 1
        x = x0 + (1 if t >= 4 else 0) * (1 if x0 % 2 else -1)
        out.append(((x, y), EMBER_COL[min(3, t // 2)]))
    return out


# ---------------------------------------------------------------- Augen
WHITE = rgb('f6ffff')
PUPIL = rgb('052733')
EYES = {'L': (31, 24), 'R': (35, 24)}             # obere linke Ecke des 2x2-Auges
CORNERS = [(0, 1), (0, 0), (1, 0), (1, 1)]          # BL, TL, TR, BR
# Pupillenpositionen im Zeitverlauf (unabhängig voneinander, schielend)
PUPIL_SEQ = {
    'L': [(0, 0, 1), (8, 0, 0), (13, 1, 1), (19, 1, 0), (24, 0, 1), (33, 1, 1)],
    'R': [(0, 1, 1), (5, 0, 1), (11, 0, 0), (17, 1, 1), (27, 0, 0), (31, 1, 1)],
}


def pupil_at(eye, i):
    t = i % N
    pos = None
    for start, dx, dy in PUPIL_SEQ[eye]:
        if t >= start:
            pos = (dx, dy)
    return pos


def apply_eyes(a, i):
    for eye, (ex, ey) in EYES.items():
        for dx, dy in CORNERS:
            a[ey + dy, ex + dx] = WHITE
        pdx, pdy = pupil_at(eye, i)
        a[ey + pdy, ex + pdx] = PUPIL


# ---------------------------------------------------------------- Sabber
DROOL_X, MOUTH_Y, PUDDLE_Y = 34, 28, 41
DROOL_L, DROOL_D = rgb('ccffff'), rgb('88ffff')
STRAND_ROWS = range(28, 41)


def apply_drool(a, i):
    # alten gestrichelten Faden entfernen (Hintergrund = Nachbarpixel links)
    for y in STRAND_ROWS:
        if px(BASE, DROOL_X, y) in (DROOL_L, DROOL_D):
            a[y, DROOL_X] = BASE[y, DROOL_X + 1]
    t = i % 20                                        # 2 Tropfen pro Loop
    # Faden am Mund wird länger (Frames 0..7), dann löst sich der Tropfen
    if t < 8:
        length = 1 + t // 2
        for k in range(length):
            a[MOUTH_Y + k, DROOL_X] = DROOL_L if k < length - 1 else DROOL_D
    else:
        f = t - 8                                     # fallender Tropfen
        y = MOUTH_Y + 4 + (f * (f + 1)) // 3
        if y < PUDDLE_Y - 1:
            a[y, DROOL_X] = DROOL_L
            a[y + 1, DROOL_X] = DROOL_D
            a[MOUTH_Y, DROOL_X] = DROOL_D             # Rest-Sabber am Mund
        else:
            a[MOUTH_Y, DROOL_X] = DROOL_D
            if y < PUDDLE_Y + 3:                      # Platsch
                a[PUDDLE_Y - 1, DROOL_X - 1] = DROOL_L
                a[PUDDLE_Y - 1, DROOL_X + 1] = DROOL_L
    # Pfütze schimmert
    for x in range(32, 38):
        for y in (41, 42):
            c = px(BASE, x, y)
            if c in (DROOL_L, DROOL_D):
                a[y, x] = DROOL_L if (x + i // 3) % 4 == 0 else DROOL_D


# ---------------------------------------------------------------- Schwert
SWORD = {(x, y) for y in range(24, 38) for x in range(0, 26) if BASE[y, x, 3]}
PIVOT_X = 26
BONK = 22                     # Frame, in dem der Griff-Hieb beginnt
STAR = [rgb('ffffff'), rgb('ffff9a'), rgb('ffd800')]


def sword_angle(i):
    a = 0.05 * wave(i, N, 0.3) + 0.03 * wave(i, N / 2, 1.1)
    t = (i - BONK) % N
    swing = [0.0, 0.07, 0.16, 0.22, 0.12, -0.03, 0.02, 0.0]   # ausholen .. zurückfedern
    if t < len(swing):
        a += swing[t]
    return a


def draw_sword(out, i, body_dy):
    ang = sword_angle(i)
    layer = np.zeros_like(out)
    for x, y in SWORD:
        layer[y, x] = BASE[y, x]
    for x in range(0, PIVOT_X):
        dy = int(round(ang * (PIVOT_X - x))) + body_dy
        for y in range(18, H):
            sy = y - dy
            if 0 <= sy < H and layer[sy, x, 3]:
                out[y, x] = layer[sy, x]
    t = (i - BONK) % N
    if t in (3, 4):                                   # Aufprallstern unter dem Griff
        cx, cy = 5, 36 + int(round(ang * (PIVOT_X - 5))) + body_dy + 1
        k = t - 3
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, 1), (0, -1)) if k == 0 else \
                ((-1, -1), (1, -1), (-1, 1), (1, 1), (-2, 0), (2, 0)):
            if 0 <= cx + dx < W and 0 <= cy + dy < H:
                out[cy + dy, cx + dx] = STAR[k if (dx, dy) != (0, 0) else 0]


# ---------------------------------------------------------------- Körper
def bob(i, lag=0):
    t = (i - lag) % N
    return 1 if (4 <= t < 14) or (24 <= t < 34) else 0


def zone_lag(x, y):
    if y >= 36:
        return None                                   # Beine/Füße/Pfütze fest
    if x < PIVOT_X - 1 and y >= 24:
        return None                                   # Schwert (eigene Ebene)
    if y <= 27:
        return 1                                      # Kopf, Stuhl, Flamme, Hand
    return 0


def hand_dx(x, y, i):
    """Erhobene Hand (rechts oben) winkt: obere Zeilen pendeln."""
    if x >= 38 and 16 <= y <= 25:
        amp = max(0.0, (25 - y) / 8)
        return int(round(amp * 1.2 * wave(i, N / 2)))
    return 0


def source(i):
    a = BASE.copy()
    for x, y in SWORD:
        a[y, x] = CLEAR
    for x, y in FLAME:
        a[y, x] = CLEAR
    for y in range(FY0, FY1 + 1):
        for x in range(FX0, FX1 + 1):
            h = flame_heat(x, y, i)
            if h and (a[y, x, 3] == 0):
                a[y, x] = FIRE[h]
    for (x, y), c in embers(i):
        if 0 <= y < H and a[y, x, 3] == 0:
            a[y, x] = c
    apply_eyes(a, i)
    apply_drool(a, i)
    return a


def frame(i):
    s = source(i)
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            lag = zone_lag(x, y)
            dy = 0 if lag is None else bob(i, lag)
            dx = hand_dx(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sy < H and 0 <= sx < W:
                out[y, x] = s[sy, sx]
    draw_sword(out, i, bob(i, 0))
    return out


frames = [frame(i) for i in range(N)]

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    imgs = []
    for f in frames:
        im = Image.fromarray(f.astype(np.uint8)).resize((W * 8, H * 8), Image.NEAREST)
        b = Image.new('RGBA', im.size, (40, 30, 70, 255))
        b.alpha_composite(im)
        imgs.append(b.convert('RGB'))
    imgs[0].save(f'sparrow_idle_{tag}.gif', save_all=True, append_images=imgs[1:],
                 duration=ms, loop=0, disposal=2, optimize=False)
    Image.fromarray(np.concatenate(frames, axis=1).astype(np.uint8)).save(f'sparrow_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
