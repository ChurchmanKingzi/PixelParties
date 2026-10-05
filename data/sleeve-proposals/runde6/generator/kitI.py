# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Block I (Sleeves 45–46): Tiefenebenen als RGBA-Raster, Dithering, Vorschau, Messung."""
import os, sys, math
import numpy as np
from PIL import Image
from common import *  # noqa
from xcfkit import over

BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
SCR = '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/i'
HERE_I = os.path.dirname(os.path.abspath(__file__))


class Plane:
    """Eine Tiefenebene: RGBA-Raster (w×h), wird am Ende k-fach hochskaliert auf das 250×350-Canvas gelegt."""

    def __init__(self, w, h, k, ox=0, oy=0):
        self.w, self.h, self.k, self.ox, self.oy = w, h, k, ox, oy
        self.a = np.zeros((h, w, 4), np.uint8)

    def fill(self, col):
        self.a[..., :3] = col; self.a[..., 3] = 255

    def paste(self, s, x, y, alpha=1.0):
        h, w = s.shape[:2]
        X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(self.w, x + w), min(self.h, y + h)
        if X1 <= X0 or Y1 <= Y0: return
        sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x].copy()
        if alpha < 1.0:
            sub[..., 3] = (sub[..., 3].astype(float) * alpha).astype(np.uint8)
        self.a[Y0:Y1, X0:X1] = over(self.a[Y0:Y1, X0:X1], sub)

    def px(self, x, y, col, a=255):
        if 0 <= x < self.w and 0 <= y < self.h:
            if a >= 255 or self.a[y, x, 3] == 0:
                self.a[y, x, :3] = col; self.a[y, x, 3] = 255 if a >= 255 else max(a, self.a[y, x, 3])
            else:
                t = a / 255.0
                self.a[y, x, :3] = (np.array(col) * t + self.a[y, x, :3] * (1 - t)).astype(np.uint8)

    def blend(self, x, y, col, t):
        if 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0:
            self.a[y, x, :3] = np.clip(np.array(col) * t + self.a[y, x, :3] * (1 - t), 0, 255).astype(np.uint8)


def compose_planes(planes, W=250, H=350):
    cv = Canvas(W, H)
    for p in planes:
        cv.paste(up(p.a, p.k), p.ox, p.oy)
    return cv


def dith(v, x, y, levels=4):
    return min(max(math.floor(v * levels + BAY[y % 4, x % 4]) / levels, 0.0), 1.0)


def mix(c1, c2, t):
    return tuple(int(round(a * (1 - t) + b * t)) for a, b in zip(c1, c2))


def crop_alpha(s):
    b = bbox(s)
    return s[b[1]:b[3], b[0]:b[2]].copy()


def hard_alpha(s, thr=128):
    s = s.copy(); s[..., 3] = np.where(s[..., 3] >= thr, 255, 0); return s


def keep(key, s):
    """Sprite im Cache sprites6/ unter key ablegen (Nachvollziehbarkeit) und zurückgeben."""
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, key + '.png')); return s


def preview(fname, form, pal, stone, stone2=None, out=None):
    sys.path.insert(0, os.path.join(HERE_I, '..', '..', 'runde3', 'generator'))
    import frames2 as F
    src = os.path.join(HERE_I, '..', fname)
    out = out or os.path.join(SCR, 'F_' + fname)
    F.apply(*([src, out, form, pal, stone] + ([stone2] if stone2 else [])))
    return out


def half(path, out):
    """Voransicht: pixelgenau ohne Interpolation verkleinern (jedes 2. Pixel)."""
    im = Image.open(path).convert('RGB')
    im.resize((im.width // 2, im.height // 2), Image.NEAREST).save(out)
    return out
