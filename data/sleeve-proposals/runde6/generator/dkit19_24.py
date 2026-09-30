# -*- coding: utf-8 -*-
"""Kleine Hilfsfunktionen für Block D (Sleeves 19–24, Runde 6).

Arbeitsweise: jede Tiefenebene wird auf ihrem eigenen groben Raster (RGBA-Array) gebaut und mit
`blit(cv, ebene, k)` einmal ganzzahlig auf das 250×350-Raster hochskaliert – so haben alle Pixel einer
Ebene dieselbe Größe.
"""
import math
import numpy as np
from common import *  # noqa
from xcfkit import over

W, H = 250, 350


def grid(k):
    """Rastergröße einer Ebene mit Pixelgröße k (aufgerundet, damit sie das Bild ganz füllt)."""
    return -(-W // k), -(-H // k)


def rgba(w, h, col=None):
    a = np.zeros((h, w, 4), np.uint8)
    if col is not None:
        a[..., :3] = col[:3]; a[..., 3] = 255
    return a


def put(dst, s, x, y, alpha=1.0):
    """s (RGBA) auf dst (RGBA) legen; Alpha-Werte < 128 gelten als leer, alpha<1 = gleichmäßig durchscheinend."""
    x, y = int(x), int(y)
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] >= 128
    d = dst[Y0:Y1, X0:X1]
    if alpha >= 1:
        d[m] = sub[m]; d[m, 3] = 255
    else:
        c = d[..., :3].astype(float)
        c[m] = sub[m][:, :3] * alpha + c[m] * (1 - alpha)
        d[..., :3] = c.astype(np.uint8)
        d[m, 3] = np.maximum(d[m, 3], int(255 * alpha) if d.shape[2] == 4 else 255)


def setp(dst, x, y, col, a=255):
    x, y = int(x), int(y)
    if 0 <= x < dst.shape[1] and 0 <= y < dst.shape[0]:
        dst[y, x, :3] = col[:3]
        dst[y, x, 3] = a


def blit(cv, arr, k, ox=0, oy=0, alpha=1.0):
    a = arr
    if a.shape[2] == 3:
        a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    cv.paste(up(a, k), -ox, -oy, alpha=alpha)


def bay(x, y):
    return BAYER4[y % 4, x % 4]


def dith(t, x, y, levels=4):
    """geordnet gedithertes Quantisieren von t∈[0,1] auf `levels` Stufen."""
    return min(1.0, max(0.0, math.floor(t * levels + bay(x, y)) / levels))


def shade(a, f, col=(0, 0, 0)):
    """RGB mit Faktor f in Richtung col mischen (f=1 → unverändert)."""
    out = a.copy()
    out[..., :3] = (a[..., :3].astype(float) * f + np.array(col) * (1 - f)).clip(0, 255).astype(np.uint8)
    return out


def crop_alpha(s):
    b = bbox(s)
    return s[b[1]:b[3], b[0]:b[2]].copy()


def scene_masked(base, scene, idxs, box=None):
    """Figur pixelgenau aus der „Sichtbar“-Szene: Farben der Szene, Maske = Vereinigung der Ebenen."""
    m = np.zeros(layer(base, scene).shape[:2], bool)
    for i in idxs:
        m |= layer(base, i)[..., 3] > 0
    s = layer(base, scene).copy()
    s[..., 3] = np.where(m, 255, 0)
    if box is not None:
        x0, y0, x1, y1 = box
        s = s[y0:y1, x0:x1]
    return s


def ellipse_ring(dst, cx, cy, rx, ry, col, thick=1.0, a=255, skip=None):
    """1-Pixel-Ellipse (Raster der Ebene). skip(x,y)->bool blendet Teile aus (z. B. hinter einer Figur)."""
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = math.hypot((x + .5 - cx) / rx, (y + .5 - cy) / ry)
            if abs(d - 1) * min(rx, ry) < thick * 0.5 + 0.01:
                if skip is None or not skip(x, y):
                    setp(dst, x, y, col, a)
