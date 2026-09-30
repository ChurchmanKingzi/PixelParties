# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Block C (Runde 6, Sleeves 13–18): Ebenen-Raster, Einsetzen, Dithering, Wolken, Vorschau."""
import math, os, sys
import numpy as np
from common import *  # noqa

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad'


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(dst, s, x, y, alpha=None):
    """Sprite s (RGBA) deckend in das Ebenen-Raster dst setzen (nur Pixel mit Alpha>0).
    alpha=(a, x0, y0): geordnet gedithert – nur Pixel, deren Bayer-Schwelle < a ist."""
    h, w = s.shape[:2]
    for j in range(h):
        yy = y + j
        if not 0 <= yy < dst.shape[0]: continue
        for i in range(w):
            xx = x + i
            if 0 <= xx < dst.shape[1] and s[j, i, 3] > 0:
                if alpha is not None and BAYER4[yy % 4, xx % 4] >= alpha: continue
                dst[yy, xx] = s[j, i]


def bayer(x, y):
    return BAYER4[y % 4, x % 4]


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def grad_pick(pal, t, x, y):
    """Farbe aus Palette pal für t∈[0,1], geordnet gedithert zwischen Nachbarstufen."""
    t = min(1.0, max(0.0, t)) * (len(pal) - 1)
    i = min(len(pal) - 2, int(t)); f = t - i
    return pal[i + 1] if f > bayer(x, y) else pal[i]


def cumulus(arr, puffs, tones, base=None, light=(-0.55, -0.83)):
    """Haufenwolke aus Kreisen (cx, cy, r) im Raster von arr; tones hell→dunkel, Licht von links oben."""
    H, W = arr.shape[:2]
    n = len(tones) - 1
    for y in range(H):
        for x in range(W):
            best = None
            for (cx, cy, r) in puffs:
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d2 = dx * dx + dy * dy
                if d2 <= r * r:
                    nz = math.sqrt(max(0.0, 1 - d2 / (r * r)))
                    lam = (dx / r) * light[0] + (dy / r) * light[1] + nz * 0.55
                    best = lam if best is None else max(best, lam)
            if best is None: continue
            if base is not None and y >= base: best = min(best, -0.2)
            t = min(1, max(0, (0.95 - best) / 1.25)) * n
            i = int(t); f = t - i
            k = min(n, i + (1 if f > bayer(x, y) else 0))
            arr[y, x] = list(tones[k]) + [255]


def blit(cv, lay, k, ox=0, oy=0):
    """Ebene im groben Raster einmal ganzzahlig hochskalieren und auf die 250×350-Leinwand legen."""
    cv.paste(up(lay, k), ox, oy)


def shadow(s, col=(0, 0, 0)):
    o = s.copy(); o[..., :3] = col; return o


def recolor(s, fn):
    """Pixelweise Umfärbung: fn((r,g,b)) -> (r,g,b)."""
    o = s.copy()
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if o[j, i, 3]:
                o[j, i, :3] = fn(tuple(int(v) for v in o[j, i, :3]))
    return o


def preview(png, name, form='ornate', pal='gold', st='ruby', st2=None):
    sys.path.insert(0, os.path.join(HERE, '..', '..', 'runde3', 'generator'))
    import frames2 as F
    out = os.path.join(SCR, name)
    if st2: F.apply(png, out, form, pal, st, st2)
    else: F.apply(png, out, form, pal, st)
    return out
