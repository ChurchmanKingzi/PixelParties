# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Block H (Sleeves 41–44): Tiefenebenen auf eigenem Grobraster, Dither-Alpha, Licht."""
import math
import numpy as np
from common import *  # noqa

W, H = 250, 350
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0


def grid(k):
    """Größe des Grobrasters für Pixelgröße k (aufgerundet)."""
    return -(-W // k), -(-H // k)


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(dst, s, x, y, alpha=1.0, dither_seed=0):
    """Sprite s (RGBA) auf die Ebene dst setzen; alpha<1 = geordnetes Dithering auf ganzen Pixeln."""
    h, w = s.shape[:2]
    x, y = int(round(x)), int(round(y))
    X0, Y0 = max(0, x), max(0, y)
    X1, Y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] >= 128
    if alpha < 1.0:
        yy, xx = np.mgrid[Y0:Y1, X0:X1]
        m &= BAY[(yy + dither_seed) % 4, xx % 4] < alpha
    reg = dst[Y0:Y1, X0:X1]
    reg[m, :3] = sub[m, :3]
    if dst.shape[2] == 4:
        reg[m, 3] = 255


def setp(dst, x, y, col):
    x, y = int(x), int(y)
    if 0 <= x < dst.shape[1] and 0 <= y < dst.shape[0]:
        dst[y, x, :3] = col[:3]
        if dst.shape[2] == 4:
            dst[y, x, 3] = 255


def blit(cv, arr, k, ox=0, oy=0):
    """Grobe Ebene k-fach hochskalieren und aufs 250×350-Canvas legen (ox/oy in Endpixeln)."""
    a = arr.a if hasattr(arr, 'a') else arr
    if a.shape[2] == 3:
        a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    cv.paste(up(a, k), -ox, -oy)


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def glow(dst, cx, cy, r, col, strength=0.5, ry=None, power=1.5, steps=4):
    """Weicher Lichthof, in Stufen quantisiert und geordnet gedithert (nur auf deckende Pixel)."""
    col = np.array(col, float)
    ry = ry or r
    for y in range(max(0, int(cy - ry)), min(dst.shape[0], int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(dst.shape[1], int(cx + r) + 1)):
            if dst.shape[2] == 4 and dst[y, x, 3] == 0:
                continue
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1:
                continue
            q = min(math.floor((1 - d) ** power * strength * steps + BAY[y % 4, x % 4]) / steps, strength)
            if q > 0:
                dst[y, x, :3] = (dst[y, x, :3] * (1 - q) + col * q).astype(np.uint8)


def shade(dst, f, mask=None):
    """Ebene abdunkeln/aufhellen (f<1 dunkler)."""
    rgb = dst[..., :3].astype(float) * f
    if mask is None:
        dst[..., :3] = rgb.clip(0, 255).astype(np.uint8)
    else:
        dst[mask, :3] = rgb[mask].clip(0, 255).astype(np.uint8)


def dark_vignette(dst, strength=0.5, r0=0.55, cx=None, cy=None):
    """Randabdunklung in 4 Dither-Stufen auf dem Raster der Ebene."""
    h, w = dst.shape[:2]
    cx = w / 2 if cx is None else cx
    cy = h / 2 if cy is None else cy
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx + .5 - cx) / (w / 2)) ** 2 + ((yy + .5 - cy) / (h / 2)) ** 2) / math.sqrt(2)
    t = np.clip((d - r0) / (1 - r0), 0, 1) * strength
    q = (np.floor(t * 4 + BAY[yy % 4, xx % 4]) / 4).clip(0, 1)
    dst[..., :3] = (dst[..., :3] * (1 - q[..., None])).astype(np.uint8)


def opaque(s):
    """Halbtransparente Randpixel einer Ebene voll deckend machen (alpha>0 → 255)."""
    o = s.copy()
    o[..., 3] = np.where(o[..., 3] > 0, 255, 0)
    return o


def raw_cached(key, base, i, box):
    """Ebenen-Ausschnitt mit ORIGINAL-Alpha (nicht gehärtet) – im Sprite-Cache abgelegt, damit das Skript auch ohne
    den xcf-Export reproduzierbar bleibt."""
    import os
    from PIL import Image
    import xcfkit
    p = os.path.join(xcfkit.CACHE, key + '.png')
    try:
        x0, y0, x1, y1 = box
        a = layer(base, i)[y0:y1, x0:x1].copy()
        Image.fromarray(a).save(p)
        return a
    except Exception:
        return np.array(Image.open(p).convert('RGBA'))
