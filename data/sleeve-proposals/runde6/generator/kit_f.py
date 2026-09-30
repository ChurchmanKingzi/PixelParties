# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Block F (Sleeves 31–35, Runde 6).

Jede Tiefenebene wird auf ihrem eigenen groben Raster gebaut (RGBA-Array, z. B. 50×70 für 5×) und erst
beim Zusammensetzen ganzzahlig auf das 250×350-Raster hochskaliert (`Stack.add`). Transparenz wirkt immer
auf ganze Pixel der jeweiligen Ebene (Alpha je grobem Pixel oder geordnetes Dithering).
"""
import math, os
import numpy as np
from PIL import Image
from common import *  # noqa
import xcfkit

W, H = 250, 350
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def grid(k):
    return -(-W // k), -(-H // k)


def rgba(w, h, col=None):
    a = np.zeros((h, w, 4), np.uint8)
    if col is not None:
        a[..., :3] = col; a[..., 3] = 255
    return a


def cached(key, fn):
    """Aus Ebenen geschnittene Teilsprites unter sprites6/<key>.png ablegen (ohne xcf-Export: von dort laden)."""
    path = os.path.join(xcfkit.CACHE, key + '.png')
    try:
        s = fn(); Image.fromarray(s).save(path); return s
    except Exception:
        return np.array(Image.open(path).convert('RGBA'))


def trim(s):
    ys, xs = np.where(s[..., 3] > 0)
    return s[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()


def put(dst, s, x, y, alpha=1.0, dither=False):
    """Sprite hart einsetzen (Alpha >=128 zählt). alpha<1: gleichmäßige Mischung je Pixel oder Bayer-Dithering."""
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] >= 128
    if alpha >= 1:
        dst[Y0:Y1, X0:X1][m] = sub[m]; dst[Y0:Y1, X0:X1, 3][m] = 255
        return
    if dither:
        yy, xx = np.mgrid[Y0:Y1, X0:X1]
        m = m & (alpha > BAYER[yy % 4, xx % 4])
        dst[Y0:Y1, X0:X1][m] = sub[m]; dst[Y0:Y1, X0:X1, 3][m] = 255
        return
    reg = dst[Y0:Y1, X0:X1]
    old = reg[..., :3].astype(float)
    olda = reg[..., 3:4] / 255.0
    new = sub[..., :3].astype(float)
    mix_rgb = np.where(olda > 0, old * (1 - alpha) + new * alpha, new)
    mix_a = np.where(olda[..., 0] > 0, 255, int(round(alpha * 255)))
    reg[m, :3] = mix_rgb[m].astype(np.uint8)
    reg[m, 3] = np.maximum(reg[m, 3], mix_a[m])


class Stack:
    """Master-Bild 250×350 (RGB); Ebenen werden hochskaliert und darübergelegt."""

    def __init__(self, col=(0, 0, 0)):
        self.a = np.zeros((H, W, 3), float); self.a[:] = col

    def add(self, layer, k, ox=0, oy=0):
        """layer: RGBA im groben Raster; k: Pixelgröße; ox/oy: Versatz in 250er-Pixeln."""
        up_ = np.repeat(np.repeat(layer, k, 0), k, 1)
        h, w = up_.shape[:2]
        X0, Y0 = max(0, ox), max(0, oy); X1, Y1 = min(W, ox + w), min(H, oy + h)
        sub = up_[Y0 - oy:Y1 - oy, X0 - ox:X1 - ox]
        al = sub[..., 3:4] / 255.0
        self.a[Y0:Y1, X0:X1] = sub[..., :3] * al + self.a[Y0:Y1, X0:X1] * (1 - al)

    def canvas(self):
        cv = Canvas(W, H)
        cv.a[:] = self.a.round().clip(0, 255).astype(np.uint8)
        return cv


def bands(arr, y0, y1, stops, soft=0.5, x0=0, x1=None):
    """Senkrechter Farbverlauf in Stufen mit geordnetem Dithering an den Übergängen."""
    x1 = arr.shape[1] if x1 is None else x1
    n = len(stops) - 1
    for y in range(max(0, y0), min(arr.shape[0], y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        f = min(1, max(0, (f - (1 - soft) / 2) / soft))
        a, b = np.array(stops[i]), np.array(stops[i + 1])
        for x in range(x0, x1):
            arr[y, x, :3] = b if f > BAYER[y % 4, x % 4] else a
            arr[y, x, 3] = 255


def glow(arr, cx, cy, r, col, strength=0.5, ry=None, only_opaque=True, power=1.5):
    """Weicher Lichtschein, in Viertelstufen gedithert (nur auf deckenden Pixeln der Ebene)."""
    col = np.array(col, float); ry = ry or r
    for y in range(max(0, int(cy - ry)), min(arr.shape[0], int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(arr.shape[1], int(cx + r) + 1)):
            if only_opaque and arr[y, x, 3] == 0: continue
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1: continue
            t = (1 - d) ** power * strength
            q = min(math.floor(t * 4 + BAYER[y % 4, x % 4]) / 4, strength)
            if q > 0: arr[y, x, :3] = (arr[y, x, :3] * (1 - q) + col * q).astype(np.uint8)


def shade_ellipse(arr, cx, cy, rx, ry, f=0.5, soft=1.6):
    """Bodenschatten: Ellipse abdunkeln (gedithert)."""
    for y in range(max(0, int(cy - ry)), min(arr.shape[0], int(cy + ry) + 1)):
        for x in range(max(0, int(cx - rx)), min(arr.shape[1], int(cx + rx) + 1)):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d < 1 and arr[y, x, 3] > 0 and (1 - d) * soft > BAYER[y % 4, x % 4]:
                arr[y, x, :3] = (arr[y, x, :3] * f).astype(np.uint8)


def recolor(s, fn):
    out = s.copy(); m = out[..., 3] > 0
    out[m, :3] = np.array([fn(c) for c in out[m, :3].astype(float)]).clip(0, 255).astype(np.uint8)
    return out


def mul(s, f, add=(0, 0, 0)):
    out = s.copy(); m = out[..., 3] > 0
    out[m, :3] = (out[m, :3].astype(float) * np.array(f) + np.array(add)).clip(0, 255).astype(np.uint8)
    return out


def cells(s, c, ox=0, oy=0):
    """Mosaik mit Zellgröße c auf sein Zellraster zurückrechnen (Mittelpunktsabtastung)."""
    h, w = s.shape[:2]
    ys = np.arange(oy + c // 2, h, c); xs = np.arange(ox + c // 2, w, c)
    return s[np.ix_(ys, xs)].copy()


def line(arr, x0, y0, x1, y1, col, alt=None):
    """1-Pixel-Linie (im Raster der Ebene); alt: zweite Farbe im Wechsel (Faden hell/dunkel)."""
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    last = None; k = 0
    for i in range(n):
        t = i / max(1, n - 1)
        x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
        if (x, y) == last: continue
        last = (x, y)
        if 0 <= x < arr.shape[1] and 0 <= y < arr.shape[0]:
            c = col if (alt is None or k % 2 == 0) else alt
            arr[y, x, :3] = c; arr[y, x, 3] = 255
        k += 1


def preview(name, form, pal, stone, stone2=None):
    """Gerahmte Vorschau in den Scratchpad schreiben (nur zur Kontrolle)."""
    import sys
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(here, '..', '..', 'runde3', 'generator'))
    import frames2 as F
    scr = os.environ.get('SP', '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad')
    out = os.path.join(scr, 'f', name.replace('.png', '_framed.png'))
    args = [os.path.join(here, '..', name), out, form, pal, stone] + ([stone2] if stone2 else [])
    F.apply(*args)
    return out
