# -*- coding: utf-8 -*-
"""Kleine Hilfsfunktionen für Block A (Runde 6, Sleeves 01–06)."""
import math, os, sys
import numpy as np
from common import *  # noqa

SP = '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/A/'


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(dst, s, x, y, alpha_min=1):
    """Sprite s (RGBA) deckend in dst (RGBA-Ebene) setzen, mit Beschneidung."""
    h, w = s.shape[:2]
    y0, x0 = max(0, y), max(0, x)
    y1, x1 = min(dst.shape[0], y + h), min(dst.shape[1], x + w)
    if y1 <= y0 or x1 <= x0: return
    src = s[y0 - y:y1 - y, x0 - x:x1 - x]
    m = src[..., 3] >= alpha_min
    dst[y0:y1, x0:x1][m] = src[m]


def bayer(x, y):
    return BAYER4[y % 4, x % 4]


def blit(cv, lay, k, ox=0, oy=0):
    cv.paste(up(lay, k), ox, oy)


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def soft_to_dither(arr, soft, col, strength=1.0):
    """Weiches Alpha (0..255, gleiche Rastergröße wie arr) als geordnet gedithertes Deckweiß auftragen."""
    H, W = arr.shape[:2]
    for y in range(H):
        for x in range(W):
            t = soft[y, x] / 255.0 * strength
            if t > 0 and t > bayer(x, y):
                arr[y, x, :3] = col; arr[y, x, 3] = 255


def trimmed(s):
    b = bbox(s)
    return s[b[1]:b[3], b[0]:b[2]]


def shadow_ellipse(arr, cx, cy, rx, ry, col=(0, 0, 0), a=0.45):
    """Halbtransparenter Bodenschatten (geordnet gedithert, in RGBA-Ebene: mischt mit vorhandener Farbe)."""
    H, W = arr.shape[:2]
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if not (0 <= x < W and 0 <= y < H): continue
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d <= 1:
                arr[y, x, :3] = (arr[y, x, :3] * (1 - a) + np.array(col) * a).astype(np.uint8)


def preview(fname, form='ornate', pal='gold', st='ruby', st2=None):
    """Roh- und Rahmenvorschau nebeneinander in den Scratchpad schreiben."""
    from PIL import Image
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
    import frames2 as F
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', fname)
    out = SP + 'fr_' + fname
    args = [src, out, form, pal, st] + ([st2] if st2 else [])
    F.apply(*args)
    # ohne Interpolation: beide Bilder exakt auf das 250er-Raster (÷3, nearest), dann ×2 nearest
    a = Image.open(src).convert('RGB'); b = Image.open(out).convert('RGB')
    def red(im):
        w, h = im.size[0] // 3, im.size[1] // 3
        return im.resize((w, h), Image.NEAREST).resize((w * 2, h * 2), Image.NEAREST)
    a, b = red(a), red(b)
    S = Image.new('RGB', (a.size[0] + b.size[0] + 10, max(a.size[1], b.size[1])), (30, 30, 30))
    S.paste(a, (0, 0)); S.paste(b, (a.size[0] + 10, 0))
    S.save(SP + 'pv_' + fname)
    return SP + 'pv_' + fname
