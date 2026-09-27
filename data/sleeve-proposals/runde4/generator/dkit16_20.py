# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Block D (Sleeves 16–20, Runde 4).

Arbeitsweise: jede Tiefenebene wird auf ihrem eigenen groben Raster gebaut (Canvas für deckende
Hintergründe, RGBA-Array für freigestellte Ebenen) und genau einmal ganzzahlig auf das 250×350-Raster
hochskaliert (`blit`). So haben alle Pixel einer Ebene dieselbe Größe.
"""
import math
import numpy as np
from common import *  # noqa

W, H = 250, 350


def grid(k):
    """Größe des groben Rasters für Faktor k (deckt 250×350 vollständig ab)."""
    return -(-W // k), -(-H // k)


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(dst, s, x, y, alpha=1.0):
    """Sprite s (RGBA) hart auf RGBA-Array dst setzen (Alpha auf ganze Pixel)."""
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] >= 128
    if alpha >= 1:
        dst[Y0:Y1, X0:X1][m] = sub[m]
    else:
        d = dst[Y0:Y1, X0:X1]
        old = d[m].astype(float)
        new = sub[m].astype(float)
        mix = np.where(old[:, 3:4] > 0, old * (1 - alpha) + new * alpha, new)
        mix[:, 3] = np.where(old[:, 3] > 0, 255, 255 * (alpha >= .5))
        d[m] = mix.astype(np.uint8)


def blit(cv, arr, k, ox=0, oy=0):
    """Ebene (Canvas oder RGBA-Array, grobes Raster) k-fach vergrößert auf cv (250×350) legen.
    ox/oy: Versatz des groben Rasters in Zielpixeln (0..k-1), z. B. zum Zentrieren."""
    a = arr.a if hasattr(arr, 'a') else arr
    if a.shape[2] == 3:
        a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    u = up(a, k)
    cv.paste(u, -ox, -oy)


def vgrad(cv, y0, y1, stops, x0=0, x1=None):
    x1 = cv.w if x1 is None else x1
    n = len(stops) - 1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        a, b = np.array(stops[i]), np.array(stops[i + 1])
        for x in range(max(0, x0), min(cv.w, x1)):
            cv.a[y, x] = b if f > BAYER4[y % 4, x % 4] else a


def glow(cv, cx, cy, r, col, strength=0.5, ry=None):
    """Geditherter Lichthof (Tönung in Viertelstufen), optional elliptisch."""
    col = np.array(col, float); ry = ry or r
    for y in range(max(0, int(cy - ry)), min(cv.h, int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(cv.w, int(cx + r) + 1)):
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1: continue
            t = (1 - d) ** 1.5 * strength
            q = min(math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4, strength)
            if q > 0:
                cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


def shade(cv, fn, col=(0, 0, 0)):
    """fn(x,y)->t in [0,1]: Anteil der Abdunklung/Tönung, in Viertelstufen gedithert."""
    col = np.array(col, float)
    for y in range(cv.h):
        for x in range(cv.w):
            t = fn(x, y)
            if t <= 0: continue
            q = min(1, math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4)
            if q > 0:
                cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


def ellipse_shadow(arr, cx, cy, rx, ry, col=(0, 0, 0), a=150):
    """Weicher Bodenschatten als Dither-Ellipse in ein RGBA-Array (vor dem Sprite setzen)."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if not (0 <= x < arr.shape[1] and 0 <= y < arr.shape[0]): continue
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d < 1 and (1 - d) * 1.6 > BAYER4[y % 4, x % 4]:
                arr[y, x] = list(col) + [a]


def over_rgb(cv, arr):
    """RGBA-Array (gleiches Raster) mit echter Alpha auf Canvas legen."""
    cv.paste(arr, 0, 0)


def lum_map(s, dark, light):
    """Sprite auf eine Zweifarbrampe abbilden (Helligkeit bleibt erhalten)."""
    out = s.copy()
    L = s[..., :3].astype(float).mean(-1, keepdims=True) / 255
    out[..., :3] = (np.array(dark) * (1 - L) + np.array(light) * L).astype(np.uint8)
    return out


def lowres_tile(tex, w, h, ox=0, oy=0):
    th, tw = tex.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    return tex[(yy + oy) % th, (xx + ox) % tw][..., :3]


def bands(cv, y0, y1, stops, soft=0.3, x0=0, x1=None):
    """Senkrechter Verlauf als ruhige Farbbänder: gedithert wird nur im Übergang (Anteil soft)."""
    x1 = cv.w if x1 is None else x1
    n = len(stops) - 1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        f = min(1, max(0, (f - (1 - soft) / 2) / soft))
        a, b = np.array(stops[i]), np.array(stops[i + 1])
        for x in range(max(0, x0), min(cv.w, x1)):
            cv.a[y, x] = b if f > BAYER4[y % 4, x % 4] else a
