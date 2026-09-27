# -*- coding: utf-8 -*-
"""Hilfen für Block F (Sleeves 26–30), Runde 4.

Grundsatz: jede Tiefenebene wird auf IHREM groben Raster gebaut (Ebene(k): ceil(250/k) × ceil(350/k) Zellen,
RGBA) und genau einmal um k hochskaliert. Verläufe, Dithering, Linien und Schatten entstehen auf diesem Raster,
haben also automatisch dieselbe Pixelgröße wie die Figuren der Ebene.
"""
import os, sys, math
import numpy as np
from common import *  # noqa

W, H = 250, 350
B4 = BAYER4
SCR = os.environ.get('SP', '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/f')


class Ebene:
    """RGBA-Leinwand auf dem k-Raster."""
    def __init__(self, k):
        self.k = k
        self.w, self.h = math.ceil(W / k), math.ceil(H / k)
        self.a = np.zeros((self.h, self.w, 4), np.uint8)

    def fill(self, col):
        self.a[..., :3] = col; self.a[..., 3] = 255

    def px(self, x, y, col, al=255):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x, :3] = col[:3]; self.a[y, x, 3] = al

    def rect(self, x0, y0, x1, y1, col):
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(self.w, x1), min(self.h, y1)
        if x1 > x0 and y1 > y0:
            self.a[y0:y1, x0:x1, :3] = col; self.a[y0:y1, x0:x1, 3] = 255

    def paste(self, s, x, y, alpha=1.0):
        """Sprite s (RGBA, Pixel dieses Rasters) mit Alpha darüberlegen; Alpha auf ganze Pixel."""
        h, w = s.shape[:2]; x, y = int(x), int(y)
        X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(self.w, x + w), min(self.h, y + h)
        if X1 <= X0 or Y1 <= Y0: return
        sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x].astype(float)
        sa = sub[..., 3:4] / 255 * alpha
        dst = self.a[Y0:Y1, X0:X1].astype(float); da = dst[..., 3:4] / 255
        oa = sa + da * (1 - sa)
        rgb = (sub[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
        self.a[Y0:Y1, X0:X1, :3] = rgb.round().clip(0, 255).astype(np.uint8)
        self.a[Y0:Y1, X0:X1, 3] = (oa[..., 0] * 255).round().astype(np.uint8)

    def put(self, s, x, y, anchor='tl', alpha=1.0):
        h, w = s.shape[:2]
        if anchor == 'b': x, y = x - w // 2, y - h
        elif anchor == 'c': x, y = x - w // 2, y - h // 2
        elif anchor == 'bl': y = y - h
        self.paste(s, int(x), int(y), alpha)
        return int(x), int(y), w, h

    def big(self, ox=0, oy=0):
        """Einmal um k hochskalieren und auf 250×350 zuschneiden (ox/oy: Versatz des Rasters)."""
        u = up(self.a, self.k)
        out = np.zeros((H, W, 4), np.uint8)
        out[:, :] = 0
        hh, ww = min(H, u.shape[0] - oy), min(W, u.shape[1] - ox)
        out[:hh, :ww] = u[oy:oy + hh, ox:ox + ww]
        return out


def onto(cv, E, ox=0, oy=0):
    """Ebene E (hochskaliert) auf das 250×350-Canvas legen."""
    cv.paste(E.big(ox, oy), 0, 0)


def bayer(w, h):
    yy, xx = np.mgrid[0:h, 0:w]
    return B4[yy % 4, xx % 4]


def vgrad(E, stops, y0=0, y1=None, x0=0, x1=None):
    """Senkrechter Verlauf über Farbstufen, geordnet gedithert (auf dem Raster der Ebene)."""
    y1 = E.h if y1 is None else y1; x1 = E.w if x1 is None else x1
    n = len(stops) - 1
    for y in range(max(0, y0), min(E.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        for x in range(max(0, x0), min(E.w, x1)):
            i = int(math.floor(t + B4[y % 4, x % 4] * 0.999)); i = min(max(i, 0), n)
            E.a[y, x, :3] = stops[i]; E.a[y, x, 3] = 255


def mix(c1, c2, t):
    return tuple(int(round(a * (1 - t) + b * t)) for a, b in zip(c1, c2))


def darken_region(E, fn, col=(0, 0, 0), levels=4):
    """fn(x,y)->t (0..1): Richtung col mischen, quantisiert + geordnet gedithert."""
    for y in range(E.h):
        for x in range(E.w):
            t = fn(x, y)
            if t <= 0: continue
            q = min(1.0, math.floor(t * levels + B4[y % 4, x % 4]) / levels)
            if q > 0:
                E.a[y, x, :3] = [int(c * (1 - q) + cc * q) for c, cc in zip(E.a[y, x, :3], col)]


def lum_tint(s, dark, light):
    """Sprite nach Helligkeit zwischen zwei Farben umfärben (Alpha bleibt)."""
    rgb = s[..., :3].astype(float)
    l = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]) / 255
    lo, hi = np.array(dark, float), np.array(light, float)
    out = s.copy(); out[..., :3] = (lo + (hi - lo) * l[..., None]).clip(0, 255).astype(np.uint8)
    return out


def trimA(s):
    b = bbox(s)
    return s[b[1]:b[3], b[0]:b[2]] if b else s


def preview(name, form, pal, gem, gem2=None, out=None):
    """Vorschau mit Rahmen (runde3/generator/frames2.py)."""
    sys.path.insert(0, os.path.join(HERE_F, '..', '..', 'runde3', 'generator'))
    import frames2 as F
    out = out or os.path.join(SCR, name.replace('.png', '_frame.png'))
    F.apply(os.path.join(HERE_F, '..', name), out, form, pal, gem, gem2)
    return out


HERE_F = os.path.dirname(os.path.abspath(__file__))


def zoomcheck(s, path, k=10):
    """Sprite groß auf Grün zur Sichtprüfung."""
    from PIL import Image
    h, w = s.shape[:2]
    bg = np.zeros((h, w, 3), np.uint8); bg[:] = (0, 150, 110)
    al = s[..., 3:4] / 255
    im = (s[..., :3] * al + bg * (1 - al)).astype(np.uint8)
    Image.fromarray(im).resize((w * k, h * k), Image.NEAREST).save(path)
    return path
