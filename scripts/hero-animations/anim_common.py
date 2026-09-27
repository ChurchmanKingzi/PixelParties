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


def save_outputs(name, frames, ms, scale=8, check_edges=False):
    if check_edges:
        assert_not_clipped(frames, name)
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


def draw_sparkles(out, i, n, sparkles, tint0, tint1, only_empty=True):
    """Glitzersterne in out malen. Ein Stern muss vollständig im Bild liegen und
    darf den Rand nicht berühren – sonst Fehler (nichts darf abgeschnitten
    werden). Mit only_empty wird ein Stern, der die Figur überdecken würde, in
    diesem Frame ganz weggelassen statt angeschnitten gezeichnet."""
    h, w = out.shape[:2]
    for star in sparkles:
        pix = sparkle_pixels(i, n, [star], tint0, tint1)
        for x, y in pix:
            if not (1 <= x < w - 1 and 1 <= y < h - 1):
                raise ValueError(f'Glitzerstern bei {(x, y)} ragt an den Bildrand ({w}x{h})')
        if only_empty and any(out[y, x, 3] for x, y in pix):
            continue
        for (x, y), c in pix.items():
            out[y, x] = c


def assert_not_clipped(frames, name=''):
    """Kein Frame darf am Bildrand deckende Pixel haben (sonst wäre etwas
    abgeschnitten)."""
    for k, f in enumerate(frames):
        a = f[:, :, 3] > 0
        if a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any():
            raise ValueError(f'{name}: Frame {k} berührt den Bildrand (abgeschnitten?)')


def ring8(mask):
    """1-px-Rand (8er-Nachbarschaft) um eine Maske."""
    h, w = mask.shape
    d = mask.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            s = np.zeros_like(mask)
            s[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = \
                mask[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
            d |= s
    return d & ~mask


def draw_bounce(out, s, b, knee, oy, ox, dx_fn=None):
    """Sprite s in out malen: Zeilen oberhalb von knee um b verschieben
    (-1 = gestreckt, +1 = gestaucht), die Beine darunter bleiben stehen.
    Beim Strecken wird die Zeile über dem Knie gedehnt (keine Lücke).
    dx_fn(x, y) -> waagrechter Versatz einzelner Pixel (optional)."""
    sh, sw = s.shape[:2]
    for y in range(sh):
        for x in range(sw):
            if s[y, x, 3]:
                dx = dx_fn(x, y) if dx_fn else 0
                out[y + oy + (b if y < knee else 0), x + ox + dx] = s[y, x]
    if b < 0:
        y = knee - 1
        for x in range(sw):
            if s[y, x, 3] and not out[y + oy, x + ox, 3]:
                out[y + oy, x + ox] = s[y, x]


BOUNCE12 = [0, 0, -1, -1, -1, 0, 0, 1, 1, 1, 0, 0]      # Federn im 12er-Takt
