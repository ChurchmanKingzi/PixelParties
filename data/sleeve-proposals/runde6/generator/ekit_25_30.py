# -*- coding: utf-8 -*-
"""Kleine Hilfsfunktionen für Block E (Sleeves 25–30). Alles arbeitet auf RGBA-Arrays in einem
Tiefenebenen-Raster (z. B. 125×175 für 2×, 84×117 für 3×), die am Ende einmal hochskaliert werden."""
import math
import numpy as np
from common import *  # noqa
from xcfkit import over

W, H = 250, 350
PREVIEW = '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/e'


def grid(k):
    """Rastergröße einer Tiefenebene mit Pixelgröße k (aufgerundet)."""
    return -(-W // k), -(-H // k)


def rgba(w, h, col=None):
    a = np.zeros((h, w, 4), np.uint8)
    if col is not None:
        a[..., :3] = col[:3]; a[..., 3] = 255
    return a


def bay(x, y):
    return BAYER4[y % 4, x % 4]


def put(dst, s, x, y, alpha=None):
    """s (RGBA) mit Alpha-Blending bei (x, y) in dst (RGBA) einsetzen, randsicher."""
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y)
    X1, Y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0:
        return dst
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x].astype(float)
    a = sub[..., 3:4] / 255.0
    if alpha is not None:
        a = a * alpha
    d = dst[Y0:Y1, X0:X1].astype(float)
    out = d.copy()
    out[..., :3] = sub[..., :3] * a + d[..., :3] * (1 - a)
    out[..., 3:4] = np.maximum(d[..., 3:4], a * 255)
    dst[Y0:Y1, X0:X1] = out.clip(0, 255).astype(np.uint8)
    return dst


def setp(a, x, y, col, al=255):
    if 0 <= x < a.shape[1] and 0 <= y < a.shape[0]:
        a[y, x, :3] = col[:3]; a[y, x, 3] = al


def mix(c1, c2, t):
    return tuple(int(round(c1[i] * (1 - t) + c2[i] * t)) for i in range(3))


def vgrad(a, x0, y0, x1, y1, cols, dither=True):
    """Senkrechter Verlauf über eine Farbliste mit geordnetem Dithering (harte Stufen)."""
    n = len(cols) - 1
    for y in range(max(0, y0), min(a.shape[0], y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        for x in range(max(0, x0), min(a.shape[1], x1)):
            c = cols[i + 1] if (f > bay(x, y) if dither else f > .5) else cols[i]
            a[y, x, :3] = c; a[y, x, 3] = 255


def glow(a, cx, cy, rx, ry, col, strength=0.5, steps=4, mask=None):
    """Weicher, gestufter Lichtschein (gedithert) im Raster von a."""
    col = np.array(col, float)
    for y in range(max(0, int(cy - ry)), min(a.shape[0], int(cy + ry) + 1)):
        for x in range(max(0, int(cx - rx)), min(a.shape[1], int(cx + rx) + 1)):
            if mask is not None and not mask[y, x]:
                continue
            d = math.hypot((x + .5 - cx) / rx, (y + .5 - cy) / ry)
            if d >= 1:
                continue
            q = min(math.floor((1 - d) ** 1.5 * strength * steps + bay(x, y)) / steps, strength)
            if q > 0:
                a[y, x, :3] = (a[y, x, :3] * (1 - q) + col * q).astype(np.uint8)


def darken_rgba(s, f, col=(0, 0, 0)):
    out = s.copy()
    out[..., :3] = (out[..., :3].astype(float) * f + np.array(col) * (1 - f)).clip(0, 255).astype(np.uint8)
    return out


def crop_alpha(s):
    ys, xs = np.nonzero(s[..., 3] > 0)
    return s[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def line(a, x0, y0, x1, y1, col, al=255):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        setp(a, round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col, al)


def finish(layers, fname):
    """layers: Liste (rgba, k[, dx, dy]) von hinten nach vorn; jede Ebene wird einmal ganzzahlig hochskaliert
    und optional als Ganzes um (dx, dy) Canvas-Pixel verschoben (Feinausrichtung, Pixelgröße bleibt einheitlich)."""
    cv = Canvas(W, H)
    for L in layers:
        arr, k = L[0], L[1]
        dx, dy = (L[2], L[3]) if len(L) > 2 else (0, 0)
        a = arr
        if a.shape[2] == 3:
            a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
        cv.paste(up(a, k), dx, dy)
    return save(cv, fname)


def preview(fname, frame=('ornate', 'gold', 'ruby'), out=None):
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
    import frames2 as F
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', fname)
    out = out or os.path.join(PREVIEW, 'framed_' + fname)
    F.apply(src, out, *frame)
    return out
