# -*- coding: utf-8 -*-
"""Idle-Animation für Elana (25x25): Gitarre spielen im Groove.

Pro Frame wird zuerst eine modifizierte Quelle gebaut (Schlaghand, Greifhand
und Fuß an ihrer aktuellen Position), danach wird sie per Zonen-
Verschiebungsfeld (Wippen mit gestaffelter Nachfolge) auf den Frame gemappt.

Takt: 32 Frames pro Loop, 8 Frames pro Viertel, 4 Frames pro Achtel.
"""
import sys
from PIL import Image
import numpy as np

SRC = np.array(Image.open('src/elana-the-rocky-rebel.png').convert('RGBA'))
H, W = SRC.shape[:2]
N = 32


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


CLEAR = (0, 0, 0, 0)
BLACK = rgb('000000')
SHADOW = rgb('1a2127')
HAND_COLS = {rgb('633007'), rgb('c1925c'), rgb('f8bc77')}
# Streifen des Gitarrenhalses, indiziert über x + y
NECK = {25: rgb('3e3832'), 26: rgb('acb1b3'), 27: rgb('66514a'),
        28: rgb('acb1b3'), 29: rgb('3e3832')}


def px(a, x, y):
    return tuple(int(v) for v in a[y, x])


def pixels(box, pred):
    x0, y0, x1, y1 = box
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if pred(px(SRC, x, y))}


STRUM_HAND = pixels((8, 15, 11, 18), lambda c: c in HAND_COLS)
FRET_HAND = pixels((15, 9, 18, 12), lambda c: c in HAND_COLS)
FOOT = pixels((4, 23, 7, 24), lambda c: c[3] > 0)

# ---------------------------------------------------------------- Timing
def beat(i):
    return i % 8


# Schlaghand: Achtel-Strumming  ab (Anschlag) – mitte – auf – mitte
STRUM = [[1, 0, -1, 0][i % 4] for i in range(N)]
# Greifhand: Griffwechsel entlang des Halses (+1 = Richtung Kopf)
FRET = [0] * 8 + [1] * 8 + [0] * 4 + [-1] * 8 + [0] * 4
# Fuß: landet auf dem Schlag, hebt sich in der zweiten Takthälfte
FOOT_UP = [1 if beat(i) in (5, 6, 7) else 0 for i in range(N)]


def stagger(lag):
    """Wippen im Halbtakt: runter auf Schlag 1, hoch auf Schlag 2 (Periode 16)."""
    return [1 if ((i - lag) % 16) < 8 else 0 for i in range(N)]


DY = {'body': stagger(0), 'head': stagger(1), 'hair': stagger(2),
      'tips': stagger(3), 'side': stagger(4), 'legs': [0] * N}
TIP_DX = [{5: 1, 13: -1}.get(i % 16, 0) for i in range(N)]


def zone(x, y):
    if y >= 21 and not (7 <= x <= 10 and y <= 22):
        return 'legs'
    if y <= 1:
        return 'tips'
    if y <= 2 and x <= 16:
        return 'hair'
    if 15 <= x <= 16 and 2 <= y <= 6:
        return 'hair'
    if x <= 2 and 7 <= y <= 13:
        return 'side'
    if y <= 12 and x <= 12:
        return 'head'
    return 'body'


# ---------------------------------------------------------------- Aufbau
def move(a, pts, dx, dy, fill):
    """Pixelgruppe verschieben; frei werdende Stellen per fill(x, y) füllen."""
    if dx == 0 and dy == 0:
        return
    cols = {p: px(SRC, *p) for p in pts}
    for x, y in pts:
        a[y, x] = fill(x, y)
    for (x, y), c in cols.items():
        a[y + dy, x + dx] = c


def strum_fill(x, y):
    return BLACK if y <= 15 else SHADOW


def neck_fill(x, y):
    return NECK.get(x + y, CLEAR)


def source(i):
    a = SRC.copy()
    move(a, STRUM_HAND, 0, STRUM[i], strum_fill)
    move(a, FRET_HAND, FRET[i], -FRET[i], neck_fill)
    move(a, FOOT, 0, -FOOT_UP[i], lambda x, y: CLEAR)
    return a


def frame(i):
    s = source(i)
    out = np.zeros_like(SRC)
    for y in range(H):
        for x in range(W):
            dy = DY[zone(x, y)][i]
            dx = TIP_DX[i] if y <= DY['tips'][i] else 0
            sx, sy = x - dx, y - dy
            if 0 <= sy < H and 0 <= sx < W:
                out[y, x] = s[sy, sx]
    return out


frames = [frame(i) for i in range(N)]


def up(a, s):
    return Image.fromarray(a).resize((W * s, H * s), Image.NEAREST)


def save_gif(path, scale, ms, bg=None):
    imgs = []
    for f in frames:
        im = up(f, scale)
        if bg is not None:
            base = Image.new('RGBA', im.size, bg)
            base.alpha_composite(im)
            im = base.convert('RGB')
        imgs.append(im)
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms,
                 loop=0, disposal=2, optimize=False)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    save_gif(f'elana_idle_{tag}.gif', 10, ms, bg=(40, 30, 70, 255))
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'elana_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
