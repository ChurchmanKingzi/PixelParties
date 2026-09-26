# -*- coding: utf-8 -*-
"""Idle-Animation für Ghuanjun, the Undead Martial Artist (20x33).

Ein Jiangshi, der durchgehend auf einem Bein hüpft:
* Hüpfzyklus 12 Frames (2 Hopser pro Loop) mit Squash & Stretch:
  Landung staucht, Absprung/Landeanflug streckt das Bein.
* Hutkrempe, Knauf und Ärmel folgen 1 Frame verzögert (Nachfedern).
* Talisman flattert im Wind, wird beim Fallen hochgedrückt (verkürzt
  perspektivisch) und klatscht bei der Landung zurück.
* Unter dem Talisman liegt das Gesicht im Schatten der Mütze (schwarz).
"""
import math
import sys
from PIL import Image
import numpy as np

BASE = np.array(Image.open('src/ghuanjun-the-undead-martial-artist.png').convert('RGBA'))
H, W = BASE.shape[:2]
HOP = 12
N = 2 * HOP


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


CLEAR = (0, 0, 0, 0)

# ---------------------------------------------------------------- Hüpfen
#         0  1  2  3  4  5  6  7  8  9 10 11
HEIGHT = [0, 0, 0, 0, 1, 2, 3, 3, 3, 2, 1, 0]
SQUASH = [1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]   # Oberkörper sackt 1 px ein
STRETCH = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0]  # Fuß hängt 1 px tiefer
# Talisman: sichtbare Länge (6 = hängt voll) je Hüpf-Frame
PAPER_LEN = [6, 6, 6, 6, 6, 6, 6, 5, 4, 3, 3, 4]


def body_dy(i):
    k = i % HOP
    return -HEIGHT[k] + SQUASH[k]


def leg_dy(i):
    k = i % HOP
    return -HEIGHT[k] + STRETCH[k]


# ---------------------------------------------------------------- Zonen
LEG_TOP = 28


def zone(x, y):
    if y >= LEG_TOP:
        return 'leg'
    if y <= 5 or (8 <= y <= 11 and (x <= 4 or x >= 15)):
        return 'lag'                           # Knauf, Krempenspitzen
    if 18 <= y <= 24 and (x <= 6 or x >= 13):
        return 'lag'                           # Ärmel
    return 'body'


# ---------------------------------------------------------------- Gesicht & Talisman
SHADOW = rgb('000000')   # Schatten der großen Mütze, wie der Rest der oberen Kopfhälfte
FACE = {y: [SHADOW] * 4 for y in range(10, 16)}   # x8..11, Zeilen 10..15
PAPER_X, PAPER_Y, PAPER_W, PAPER_H = 8, 10, 4, 6
PAPER = [[BASE[PAPER_Y + r, PAPER_X + c].copy() for c in range(PAPER_W)]
         for r in range(PAPER_H)]


def paper_swing(i):
    """Wind: seitliches Pendeln (px an der Unterkante), 3 Schwünge pro Loop."""
    t = 2 * math.pi * i / N
    return 1.7 * math.sin(3 * t + 0.4) + 0.5 * math.sin(5 * t + 1.1)


def draw_paper(a, i):
    L = PAPER_LEN[i % HOP]
    swing = paper_swing(i)
    t = 2 * math.pi * i / N
    for rr in range(L):
        sr = round(rr * (PAPER_H - 1) / max(1, L - 1))
        f = rr / max(1, PAPER_H - 1)              # 0 oben (fest) .. 1 unten
        dx = swing * f ** 1.3 + 0.6 * math.sin(8 * t - rr * 1.3) * f
        dx = int(round(dx))
        for c in range(PAPER_W):
            x = PAPER_X + c + dx
            if 0 <= x < W:
                a[PAPER_Y + rr, x] = PAPER[sr][c]


def source(i):
    a = BASE.copy()
    for y, row in FACE.items():
        for c, col in enumerate(row):
            a[y, PAPER_X + c] = col
    draw_paper(a, i)
    return a


# ---------------------------------------------------------------- Frame
def frame(i):
    s = source(i)
    out = np.zeros_like(BASE)

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H and c[3]:
            out[y, x] = c

    pts = [(x, y) for y in range(H) for x in range(W) if s[y, x][3]]
    # Bein (bei Streckung doppelt gemalt = längeres Bein)
    for x, y in pts:
        if zone(x, y) == 'leg':
            put(x, y + leg_dy(i), s[y, x])
            if leg_dy(i) > body_dy(i):
                put(x, y + leg_dy(i) - 1, s[y, x])
    # Körper (überdeckt das Bein beim Einsacken)
    for x, y in pts:
        if zone(x, y) != 'leg':
            put(x, y + body_dy(i), s[y, x])
    # Nachfedernde Teile: an alter Position (Vorframe) obenauf
    for x, y in pts:
        if zone(x, y) == 'lag':
            put(x, y + body_dy(i - 1), s[y, x])
    return out


frames = [frame(i) for i in range(N)]


def save_gif(path, scale, ms, bg):
    imgs = []
    for f in frames:
        im = Image.fromarray(f).resize((W * scale, H * scale), Image.NEAREST)
        base = Image.new('RGBA', im.size, bg)
        base.alpha_composite(im)
        imgs.append(base.convert('RGB'))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms,
                 loop=0, disposal=2, optimize=False)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 70
    save_gif(f'ghuanjun_idle_{tag}.gif', 10, ms, (40, 30, 70, 255))
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'ghuanjun_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
