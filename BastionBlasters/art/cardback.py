"""Kartenrücken: großes, verziertes Logo in Gold, Strahlenkranz, Kernkristall im Medaillon, Zierecken.
Nur Master-Palette, nativ 160 x 224."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from pixl import *
from pixfont import draw_text, text_width
from cardicons import blit_icon

W, H = 160, 224


def C(ramp, i):
    return RAMPS[ramp][i]


def dot(img, x, y, col):
    if 0 <= x < img.shape[1] and 0 <= y < img.shape[0]:
        img[y, x, :3] = col
        img[y, x, 3] = 255


def _mask_text(s, scale, gap=4):
    """Text als Bool-Maske: jedes Zeichen des Pixelfonts um `scale` vergrößert, `gap` Pixel Abstand (im vergrößerten Raster)"""
    from pixfont import GLYPHS
    cols = []
    for ch in s:
        g = np.kron(GLYPHS[ch], np.ones((scale, scale), bool))
        cols.append(g)
        cols.append(np.zeros((g.shape[0], gap), bool))
    return np.concatenate(cols[:-1], axis=1)[2 * scale:9 * scale]


def gold_letters(img, s, scale, x, y):
    """Goldbuchstaben: senkrechter Verlauf (Schachbrett-Dither), Lichtkante oben/links, INK-Kontur, Schlagschatten"""
    m = _mask_text(s, scale)
    h, w = m.shape
    pad = np.pad(m, 1)
    for yy, xx in zip(*np.nonzero(m)):                      # Schlagschatten
        for dx, dy in ((2, 2), (2, 3), (3, 2)):
            dot(img, x + xx + dx, y + yy + dy, INK)
    ol = np.zeros_like(pad)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ol |= np.roll(np.roll(pad, dy, 0), dx, 1)
    for yy, xx in zip(*np.nonzero(ol & ~pad)):               # Kontur
        dot(img, x + xx - 1, y + yy - 1, INK)
    ys, xs = np.nonzero(m)
    y0, y1 = ys.min(), ys.max()
    for yy, xx in zip(ys, xs):
        t = (yy - y0) / max(1, (y1 - y0))
        v = (1.0 - 0.95 * t) * 3 + 2
        base = int(v)
        frac = v - base
        up = frac > 0.5 or (abs(frac - 0.5) < 0.14 and (xx + yy) % 2 == 0)
        idx = min(5, base + (1 if up else 0))
        if yy == 0 or not m[yy - 1, xx]:
            idx = 5
        elif xx == 0 or not m[yy, xx - 1]:
            idx = min(5, idx + 1)
        if yy + 1 >= h or not m[yy + 1, xx] or xx + 1 >= w or not m[yy, xx + 1]:
            idx = max(1, idx - 2)
        dot(img, x + xx, y + yy, C('gold', idx))
    return w, h


def ring(img, cx, cy, r_out, r_in, ramp='gold'):
    for y in range(cy - r_out - 3, cy + r_out + 4):
        for x in range(cx - r_out - 3, cx + r_out + 4):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r_in <= d <= r_out:
                t = (d - r_in) / (r_out - r_in)
                lit = (x - cx) + (y - cy) < 0
                idx = 5 if (t < 0.25 and lit) else (4 if t < 0.5 else (3 if t < 0.75 else 2))
                if not lit and t > 0.5:
                    idx = 1
                dot(img, x, y, C(ramp, idx))
            elif r_out < d <= r_out + 1.3 or r_in - 1.3 <= d < r_in:
                dot(img, x, y, INK)


def gem(img, x, y, ramp='ice'):
    for (dx, dy) in ((0, -2), (-1, -1), (1, -1), (-2, 0), (2, 0), (-1, 1), (1, 1), (0, 2)):
        dot(img, x + dx, y + dy, INK)
    for (dx, dy, i) in ((0, -1, 4), (-1, 0, 4), (0, 0, 5), (1, 0, 3), (0, 1, 3)):
        dot(img, x + dx, y + dy, C(ramp, i))


def spiral(img, cx, cy, flip, turns=1.7, r0=2.0, r1=11.0):
    """Zierschnörkel: Spirale, 2 px dick, Gold mit Kontur"""
    n = 160
    pts = []
    for k in range(n):
        t = k / (n - 1)
        a = t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * (1 - t)
        pts.append((int(cx + (-1 if flip else 1) * r * math.cos(a)), int(cy + r * math.sin(a))))
    for (x, y) in pts:
        for dx in range(-1, 3):
            for dy in range(-1, 3):
                dot(img, x + dx, y + dy, INK)
    for (x, y) in pts:
        dot(img, x, y, C('gold', 5))
        dot(img, x + 1, y, C('gold', 4))
        dot(img, x, y + 1, C('gold', 3))
        dot(img, x + 1, y + 1, C('gold', 2))


def corner(img, x, y, sx, sy):
    """L-förmige Eckzier mit Edelstein"""
    for k in range(0, 20):
        for t in range(3):
            idx = 5 if t == 0 else (3 if t == 1 else 1)
            dot(img, x + sx * k, y + sy * t, C('gold', idx))
            dot(img, x + sx * t, y + sy * k, C('gold', idx))
    for k in range(0, 21):
        dot(img, x + sx * k, y + sy * 3, INK)
        dot(img, x + sx * 3, y + sy * k, INK)
    gem(img, x + sx * 6, y + sy * 6, 'fire')
    for k in (11, 15):
        dot(img, x + sx * k, y + sy * 5, C('gold', 4))
        dot(img, x + sx * 5, y + sy * k, C('gold', 4))


def sunburst(img, cx, cy, r0, r1, n=28):
    for k in range(n):
        a = k * 2 * math.pi / n + 0.05
        for r in range(r0, r1):
            if (r // 3) % 2:
                continue
            x, y = int(cx + r * math.cos(a)), int(cy + r * math.sin(a))
            if 5 <= x < W - 5 and 5 <= y < H - 5:
                dot(img, x, y, C('purple', 5 if k % 2 else 4))


def battlement(img, x0, x1, y):
    """Zinnenkranz als Zierleiste (Zinnen nach oben)"""
    for x in range(x0, x1):
        k = (x - x0) % 10
        top = y - (5 if k < 6 else 0)
        for yy in range(top, y + 2):
            t = yy - top
            idx = 5 if t == 0 else (4 if k < 2 else (3 if t < 4 else 2))
            dot(img, x, yy, C('gold', idx))
        dot(img, x, top - 1, INK)
        dot(img, x, y + 2, INK)
    for yy in range(y - 5, y + 2):
        dot(img, x0 - 1, yy, INK)
        dot(img, x1, yy, INK)


def render_back() -> Image.Image:
    from cards import card_frame
    ramp = 'purple'
    img, mask = card_frame(ramp)
    for y in range(4, H - 4):                                # Rautengitter
        for x in range(4, W - 4):
            u, v = (x + y) % 12, (x - y) % 12
            line = u in (0, 1) or v in (0, 1)
            col = C(ramp, 2 if line else 1)
            if line and (x + y) % 2:
                col = C(ramp, 3)
            if not line and (x * 5 + y * 3) % 23 == 0:
                col = C(ramp, 0)
            dot(img, x, y, col)
    for x in range(4, W - 4):
        dot(img, x, 3, INK)
        dot(img, x, H - 4, INK)
    for y in range(4, H - 4):
        dot(img, 3, y, INK)
        dot(img, W - 4, y, INK)
    cx, cy, R = 80, 148, 40
    sunburst(img, cx, cy, R + 8, 140)
    for y in range(cy - R, cy + R + 1):                      # Medaillon-Grund
        for x in range(cx - R, cx + R + 1):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= R:
                col = C('purple', 0) if (d < 22 or (x + y) % 2 or d > R - 4) else C('purple', 1)
                dot(img, x, y, col)
    ring(img, cx, cy, R + 5, R, 'gold')
    for k in range(8):
        a = k * 2 * math.pi / 8 + math.pi / 8
        gem(img, int(cx + (R + 2.5) * math.cos(a)), int(cy + (R + 2.5) * math.sin(a)), 'ice' if k % 2 else 'fire')
    from assets_env import core
    arr = np.array(core(glow='purple').to_image())[2:80, :]
    h, w = arr.shape[:2]
    m = arr[:, :, 3] > 0
    img[cy - h // 2 + 1:cy - h // 2 + 1 + h, cx - w // 2:cx - w // 2 + w][m] = arr[m]
    # Logo
    for (s, y) in (('BASTION', 20), ('BLASTERS', 47)):
        ww = _mask_text(s, 3).shape[1]
        gold_letters(img, s, 3, (W - ww) // 2, y)
    battlement(img, 32, W - 32, 15)
    for x in range(14, W - 14):                              # Zierleiste unter dem Logo
        dot(img, x, 80, C('gold', 5 if x % 4 < 2 else 4))
        dot(img, x, 81, C('gold', 2))
        dot(img, x, 79, INK)
        dot(img, x, 82, INK)
    gem(img, W // 2, 80, 'fire')
    for dx in (-22, 22):
        gem(img, W // 2 + dx, 80, 'ice')
    spiral(img, 15, 148, False)
    spiral(img, W - 18, 148, True)
    corner(img, 6, 6, 1, 1)
    corner(img, W - 7, 6, -1, 1)
    corner(img, 6, H - 7, 1, -1)
    corner(img, W - 7, H - 7, -1, -1)
    for x in range(14, W - 14):                              # Zierleiste unten
        dot(img, x, 205, C('gold', 5 if x % 4 < 2 else 4))
        dot(img, x, 206, C('gold', 2))
        dot(img, x, 204, INK)
        dot(img, x, 207, INK)
    for k in range(5):
        blit_icon(img, 'star', W // 2 - 20 + k * 8 - 3, 211)
    out = np.array(Image.fromarray(img, 'RGBA'))
    out[~mask, 3] = 0
    return Image.fromarray(out, 'RGBA')
