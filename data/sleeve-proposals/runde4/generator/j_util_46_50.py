# -*- coding: utf-8 -*-
"""Hilfen für Block J (Sleeves 46–50): Tiefenebenen auf eigenem groben Raster (k× hochskaliert).

Lay(k) = RGBA-Ebene im Raster ceil(250/k)×ceil(350/k). flatten([...]) skaliert jede Ebene einmal mit
nearest um ihren Faktor k hoch, schneidet auf 250×350 zu und legt sie mit harter Alpha übereinander.
Halbtransparenz nur per geordnetem Dithering auf ganze Pixel derselben Ebene (dither_alpha).
"""
import math
import numpy as np
from common import *  # noqa

B4 = np.array(BAYER4)


def lerpc(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


class Lay:
    def __init__(self, k, W=250, H=350):
        self.k = k
        self.w = -(-W // k); self.h = -(-H // k)
        self.a = np.zeros((self.h, self.w, 4), np.uint8)

    def px(self, x, y, c, a=255):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x, :3] = c[:3]; self.a[y, x, 3] = a

    def get(self, x, y):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h: return self.a[y, x]
        return None

    def rect(self, x0, y0, x1, y1, c):
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(self.w, x1), min(self.h, y1)
        if x1 > x0 and y1 > y0:
            self.a[y0:y1, x0:x1, :3] = c[:3]; self.a[y0:y1, x0:x1, 3] = 255

    def paste(self, s, x, y, alpha=1.0, mask_fn=None):
        """Sprite mit harter Alpha einsetzen; alpha<1 -> geordnetes Dithering (ganze Pixel)."""
        x, y = int(x), int(y)
        h, w = s.shape[:2]
        for j in range(h):
            Y = y + j
            if not 0 <= Y < self.h: continue
            for i in range(w):
                X = x + i
                if not 0 <= X < self.w: continue
                if s[j, i, 3] < 128: continue
                al = alpha if mask_fn is None else mask_fn(i, j)
                if al < 1 and al <= B4[Y % 4, X % 4]: continue
                self.a[Y, X, :3] = s[j, i, :3]; self.a[Y, X, 3] = 255

    def vgrad(self, stops, x0=0, y0=0, x1=None, y1=None):
        x1 = self.w if x1 is None else x1; y1 = self.h if y1 is None else y1
        for y in range(max(0, y0), min(self.h, y1)):
            t = (y - y0) / max(1, (y1 - y0 - 1))
            for k in range(len(stops) - 1):
                if stops[k][0] <= t <= stops[k + 1][0]:
                    ta, ca = stops[k]; tb, cb = stops[k + 1]; break
            else:
                ta, ca = stops[-1]; tb, cb = stops[-1]
            f = 0 if tb == ta else (t - ta) / (tb - ta)
            for x in range(max(0, x0), min(self.w, x1)):
                self.a[y, x, :3] = cb if f > B4[y % 4, x % 4] else ca
                self.a[y, x, 3] = 255

    def radial(self, cx, cy, r, col, strength=1.0, power=1.0, only_opaque=True):
        for y in range(max(0, int(cy - r)), min(self.h, int(cy + r + 1))):
            for x in range(max(0, int(cx - r)), min(self.w, int(cx + r + 1))):
                if only_opaque and self.a[y, x, 3] == 0: continue
                d = math.hypot(x + .5 - cx, y + .5 - cy) / r
                if d >= 1: continue
                if ((1 - d) ** power) * strength > B4[y % 4, x % 4]:
                    self.a[y, x, :3] = col

    def shade(self, f, mask=None):
        a = self.a[..., :3].astype(float)
        if mask is None: a *= f
        else: a[mask] *= f
        self.a[..., :3] = a.clip(0, 255).astype(np.uint8)


def flatten(layers, crop=None):
    """crop: dict k -> (ox, oy) Versatz beim Zuschneiden der hochskalierten Ebene (Standard 0,0)."""
    cv = Canvas(250, 350)
    for L in layers:
        U = up(L.a, L.k)
        ox, oy = (crop or {}).get(id(L), (0, 0))
        U = U[oy:oy + 350, ox:ox + 250]
        m = U[..., 3] >= 128
        cv.a[:U.shape[0], :U.shape[1]][m] = U[..., :3][m]
    return cv


def tile_rgb(t, w, h, ox=0, oy=0):
    th, tw = t.shape[:2]
    yy = (np.arange(h)[:, None] + oy) % th; xx = (np.arange(w)[None, :] + ox) % tw
    return t[yy, xx][..., :3]


def recolor(s, f):
    out = s.copy(); out[..., :3] = f(s[..., :3].astype(float)).clip(0, 255).astype(np.uint8); return out


def lum_tint(s, dark, light):
    """Graustufen-Helligkeit auf eine Zweifarben-Rampe abbilden (Silhouetten, Geister)."""
    v = s[..., :3].astype(float).mean(-1) / 255.0
    v = (v - v[s[..., 3] > 0].min()) / max(1e-6, v[s[..., 3] > 0].max() - v[s[..., 3] > 0].min()) if (s[..., 3] > 0).any() else v
    out = s.copy()
    for c in range(3): out[..., c] = (dark[c] + (light[c] - dark[c]) * v).clip(0, 255).astype(np.uint8)
    return out


def quant(s, pal):
    """Farben auf eine Palette abbilden (nächste Farbe)."""
    P = np.array(pal, float)
    a = s[..., :3].astype(float)
    d = ((a[..., None, :] - P[None, None]) ** 2).sum(-1)
    out = s.copy(); out[..., :3] = P[d.argmin(-1)].astype(np.uint8); return out


def outline_sil(s, col):
    """Sprite mit 1-px-Kontur (im Raster seiner Ebene)."""
    h, w = s.shape[:2]
    out = np.zeros((h + 2, w + 2, 4), np.uint8)
    m = s[..., 3] >= 128
    M = np.zeros((h + 2, w + 2), bool)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            M[dy:dy + h, dx:dx + w] |= m
    out[M, :3] = col; out[M, 3] = 255
    out[1:-1, 1:-1][m] = s[m]
    return out


def preview(png, out, form, pal, gem, gem2=None):
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
    import frames2 as F
    return F.apply(png, out, form, pal, gem, gem2)
