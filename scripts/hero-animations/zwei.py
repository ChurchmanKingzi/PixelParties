# -*- coding: utf-8 -*-
"""Idle-Animation für Zwei, the Lucky Thief (38x29 + 1 px oben = 38x30).

Idle in seiner Pose mit dem geklauten pinken Glas-Dreizack:
* Ruhiges Atmen: der ganze Oberkörper samt Dreizack hebt sich als Einheit,
  die Füße bleiben stehen (keine Nähte, die Brille oder Arme zerreißen).
* Schulterblick: der Kopf dreht sich kurz nach hinten (links), dazu ein
  freches Grinsen; danach bewundert er die Beute (Kopf nach rechts, Brille
  blitzt auf).
* Windstöße von rechts: die Haarspitzen oben und die lose Strähne links
  wehen kurz nach links.
* Glas-Dreizack: Lichtband wandert über das Glas, dazu Glitzersterne.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, sweep_level, sparkle_pixels, save_outputs

SRC = np.array(Image.open('src/zwei-the-lucky-thief.png').convert('RGBA')).astype(int)
PT = 1
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 48

GLASS = [rgb('e247e3'), rgb('fd51fe'), rgb('f7a5fe'), rgb('f9c0fe'), rgb('fbd8fe'), rgb('ffffff')]
GLASS_SET = set(GLASS[:-1])
LENS = [rgb('c2e4ff'), rgb('d5e9ff'), rgb('faffff'), rgb('ffffff')]
LENS_SET = set(LENS[:-1])
MOUTH = rgb('b8683c')


def o(y):
    return y - PT


def is_glass(x, y):
    return 0 <= x < W and 0 <= y < H and px(BASE, x, y) in GLASS_SET


# ---------------------------------------------------------------- Bewegung
def inhale(i):
    """Zwei Atemzüge pro Loop, ganzer Oberkörper hebt sich 1 px."""
    return 1 if 8 <= i % 24 < 19 else 0


def is_leg(x, oy):
    return oy >= 22 and 11 <= x <= 22


GUST = [(18, 24), (40, 45)]                 # Windstöße (Start, Ende)


def gust(i, lag=0):
    t = (i - lag) % N
    return any(a <= t < b for a, b in GUST)


def head_dx(i):
    """-1: Schulterblick nach hinten, +1: Blick auf die Beute."""
    t = i % N
    if 6 <= t < 16:
        return -1
    if 28 <= t < 37:
        return 1
    return 0


def smirk(i):
    return 9 <= i % N < 17


def offset(x, y, i):
    """Rückwärts-Mapping: (dx, dy), um die out(x, y) verschoben ist."""
    oy = o(y)
    if is_leg(x, oy):
        return 0, 0                          # Füße bleiben stehen
    dx = 0
    sy = oy + inhale(i)                      # Wind-Zonen in Quellzeilen messen
    if gust(i):
        if sy <= 2:                          # Haarspitzen oben legen sich in den Wind
            dx = -1
        elif 4 <= sy <= 6 and x <= 10:
            dx = -1                          # lose Strähne links weht aus
    return dx, -inhale(i)


def face_rows():
    """Gesichtszeilen (Brille bis Kinn) mit Innenbereich innerhalb der Kapuze."""
    rows = {}
    for oy in range(9, 15):
        xs = [x for x in range(9, 25) if BASE[oy + PT, x, 3]]
        rows[oy] = (min(xs) + 1, max(xs) - 1)
    return rows


FACE = face_rows()


def turn_face(s, i):
    """Kopfdrehung: nur das Gesicht wandert innerhalb der Kapuze (Umriss bleibt)."""
    d = head_dx(i)
    if not d:
        return s
    t = s.copy()
    for oy, (lo, hi) in FACE.items():
        y = oy + PT
        for x in range(lo, hi + 1):
            t[y, x] = s[y, min(hi, max(lo, x - d))]
    return t


# ---------------------------------------------------------------- Glanz
SPARKLES = [(7, 20, 4), (31, 18, 18), (27, 20, 28), (31, 22, 40)]


def glass_level(x, y, i):
    """Ein langsames Lichtband pro Loop über den Dreizack (links -> rechts)."""
    return sweep_level(x, o(y), i, N, speed=1.6, slope=0.5, offset=-4)


def lens_level(x, y, i):
    t = i % N
    if not 30 <= t < 37:
        return 0
    pos = 11 + (t - 30) * 2
    d = abs(x + (o(y) - 10) * 0.6 - pos)
    return 2 if d < 0.8 else 1 if d < 1.8 else 0


def frame(i):
    s = BASE.copy()
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            if c in GLASS_SET:
                lv = glass_level(x, y, i)
                if lv:
                    s[y, x] = GLASS[min(len(GLASS) - 1, GLASS.index(c) + lv)]
            elif c in LENS_SET:
                lv = lens_level(x, y, i)
                if lv:
                    s[y, x] = LENS[min(len(LENS) - 1, LENS.index(c) + lv + 1)]
    if smirk(i):                             # freches Grinsen (Mundwinkel hoch)
        s[13 + PT, 17] = MOUTH
        s[12 + PT, 18] = MOUTH
    s = turn_face(s, i)
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            dx, dy = offset(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
    # Glitzersterne auf dem Glas (bewegen sich mit dem Oberkörper)
    up = inhale(i)
    for (x, y), c in sparkle_pixels(i, N, SPARKLES, GLASS[3], GLASS[4]).items():
        yy = y + PT - up
        if 0 <= x < W and 0 <= yy < H and (is_glass(x, y + PT) or out[yy, x, 3] == 0):
            out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'zwei_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
