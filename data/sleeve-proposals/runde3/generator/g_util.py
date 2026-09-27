# -*- coding: utf-8 -*-
"""Kleine Hilfen für Block G (Sleeves 39–45)."""
import math
import numpy as np
from common import *  # noqa


def rgba(a):
    """RGB -> RGBA (deckend)."""
    if a.shape[2] == 4: return a
    return np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])


def lay(base, i, box=None):
    """Einzelne Ebene zugeschnitten (harte Alphakanten)."""
    return compose(base, [i], box=box)


def frame(cv, cols=((20, 14, 6), (200, 150, 40), (250, 220, 120), (20, 14, 6))):
    for i, c in enumerate(cols):
        cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c


def mirror_tile(src, w, h, ox=0, oy=0):
    """Textur durch gespiegeltes Kacheln auf w×h bringen (keine Nahtkanten)."""
    t = np.concatenate([src, src[:, ::-1]], 1)
    t = np.concatenate([t, t[::-1]], 0)
    th, tw = t.shape[:2]
    yy = (np.arange(h) + oy) % th; xx = (np.arange(w) + ox) % tw
    return t[yy][:, xx]


def dither_blend(cv, col, alpha_fn, x0=0, y0=0, x1=None, y1=None, levels=4):
    """Farbe col mit geordnetem Dithering über das Bild legen; alpha_fn(x, y) -> [0, 1].
    Stufen: Mischung in `levels` Schritten + Bayer-Rest."""
    x1 = cv.w if x1 is None else x1; y1 = cv.h if y1 is None else y1
    col = np.array(col, float)
    for y in range(max(0, y0), min(cv.h, y1)):
        for x in range(max(0, x0), min(cv.w, x1)):
            a = alpha_fn(x, y)
            if a <= 0: continue
            q = math.floor(a * levels + BAYER4[y % 4, x % 4]) / levels
            q = min(1.0, max(0.0, q))
            if q > 0:
                cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


def paste_shadow(cv, s, x, y, dx=2, dy=2, col=(0, 0, 0), alpha=0.5):
    cv.paste(silhouette(s, col), x + dx, y + dy, alpha=alpha)
    cv.paste(s, x, y)


def recolor_map(s, pairs, tol=10):
    """Exakte Farbtausche (für Tag/Nacht-Varianten)."""
    out = s.copy(); c = s[..., :3].astype(int)
    for a, b in pairs:
        m = (np.abs(c - np.array(a)).max(-1) <= tol) & (s[..., 3] > 0)
        out[m, :3] = b
    return out

