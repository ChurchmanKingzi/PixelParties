# -*- coding: utf-8 -*-
"""Gemeinsame Helfer für die Hero-Idle-Animationen."""
import math
from PIL import Image
import numpy as np

WHITE = (255, 255, 255, 255)


def rgb(h, a=255):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def px(a, x, y):
    return tuple(int(v) for v in a[y, x])


def wave(i, period, phase=0.0):
    return math.sin(2 * math.pi * i / period + phase)


def step(ladder, c, d):
    """Farbe c auf einer Helligkeitsleiter um d Stufen verschieben (geklemmt)."""
    c = tuple(c)
    if c not in ladder:
        return c
    return ladder[max(0, min(len(ladder) - 1, ladder.index(c) + d))]


def sweep_level(x, y, i, n, speed=2.2, slope=0.6, offset=-8.0):
    """Diagonales Lichtband, das einmal pro Loop über die Figur wandert."""
    pos = (i % n) * speed + offset
    d = (x + y * slope) - pos
    if abs(d) < 1.0:
        return 2
    if abs(d) < 2.2:
        return 1
    return 0


STAR = [  # (Armlänge, Mitte, Arm innen, Arm außen) je Lebensframe
    (0, 'mid0', None, None),
    (1, 'white', 'mid0', None),
    (2, 'white', 'white', 'mid1'),
    (1, 'white', 'mid1', None),
    (0, 'mid0', None, None),
]


def sparkle_pixels(i, n, sparkles, tint0, tint1):
    """Vierzackige Glitzersterne: sparkles = [(x, y, Startframe)]."""
    cols = {'white': WHITE, 'mid0': tint0, 'mid1': tint1}
    out = {}
    for x, y, start in sparkles:
        t = (i - start) % n
        if t >= len(STAR):
            continue
        arm, c0, c1, c2 = STAR[t]
        out[(x, y)] = cols[c0]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if arm >= 1:
                out[(x + dx, y + dy)] = cols[c1]
            if arm >= 2:
                out[(x + 2 * dx, y + 2 * dy)] = cols[c2]
    return out


def save_outputs(name, frames, ms, scale=8):
    w = frames[0].shape[1]
    h = frames[0].shape[0]
    imgs = []
    for f in frames:
        im = Image.fromarray(f.astype(np.uint8)).resize((w * scale, h * scale), Image.NEAREST)
        b = Image.new('RGBA', im.size, (40, 30, 70, 255))
        b.alpha_composite(im)
        imgs.append(b.convert('RGB'))
    imgs[0].save(f'{name}.gif', save_all=True, append_images=imgs[1:],
                 duration=ms, loop=0, disposal=2, optimize=False)
    Image.fromarray(np.concatenate(frames, axis=1).astype(np.uint8)).save(f'{name}_sheet.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(len(frames))]
    print(name, 'geänderte Pixel pro Frame:', ch)
