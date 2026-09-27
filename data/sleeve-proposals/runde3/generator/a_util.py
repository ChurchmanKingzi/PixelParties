# -*- coding: utf-8 -*-
"""Kleine Hilfsfunktionen für Block A (Sleeves 01–06)."""
import math
import numpy as np
from common import *  # noqa


def put(cv, s, x, y, k=1, anchor='tl', fl=False, shadow=0.0, sh_col=(0, 0, 0), sdx=1, sdy=1):
    """Sprite ganzzahlig skaliert setzen. anchor: tl (links oben), b (Mitte unten), c (Mitte)."""
    s2 = flip(s) if fl else s
    if k != 1: s2 = up(s2, k)
    h, w = s2.shape[:2]
    if anchor == 'b': x, y = x - w // 2, y - h
    elif anchor == 'c': x, y = x - w // 2, y - h // 2
    elif anchor == 'bl': y = y - h
    x, y = int(x), int(y)
    if shadow:
        cv.paste(silhouette(s2, sh_col), x + sdx * k, y + sdy * k, alpha=shadow)
    cv.paste(s2, x, y)
    return x, y, w, h


def vgrad(cv, y0, y1, stops, x0=0, x1=None):
    """Senkrechter Verlauf über mehrere Farben, Bayer-gedithert (harte Pixel)."""
    x1 = cv.w if x1 is None else x1
    n = len(stops) - 1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        a, b = np.array(stops[i]), np.array(stops[i + 1])
        for x in range(max(0, x0), min(cv.w, x1)):
            cv.a[y, x] = b if f > BAYER4[y % 4, x % 4] else a


def glow(cv, cx, cy, r, col, strength=0.5, step=None):
    """Weicher Lichthof als gedithertes Einfärben (quantisiert, keine Unschärfe)."""
    col = np.array(col, float)
    for y in range(max(0, int(cy - r)), min(cv.h, int(cy + r) + 1)):
        for x in range(max(0, int(cx - r)), min(cv.w, int(cx + r) + 1)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r
            if d >= 1: continue
            t = (1 - d) ** 1.5 * strength
            q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
            q = min(q, strength)
            if q > 0:
                cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


def tile(cv, tex, k=1, x0=0, y0=0, x1=None, y1=None, ox=0, oy=0):
    """Textur (RGB/RGBA) k-fach vergrößert kacheln."""
    t = up(tex, k) if k != 1 else tex
    fill_tiles(cv, t, x0, y0, x1, y1, ox, oy)


def blit_rgb(cv, rgb, x, y, k=1):
    """Deckendes Bild (Hintergrund) setzen."""
    a = np.asarray(rgb)
    if a.shape[2] == 3:
        a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    else:
        a = a.copy(); a[..., 3] = 255
    cv.paste(up(a, k) if k != 1 else a, x, y)


def frame(cv, cols):
    for i, c in enumerate(cols):
        cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c


def recolor_mask(s, mask, fn):
    out = s.copy(); out[mask] = fn(out[mask]); return out


def glow_seg(cv, x0, y0, x1, y1, r, col, strength=0.4):
    """Lichthof um eine Strecke (gedithert)."""
    col = np.array(col, float)
    vx, vy = x1 - x0, y1 - y0; L2 = max(1e-6, vx * vx + vy * vy)
    for y in range(max(0, int(min(y0, y1) - r)), min(cv.h, int(max(y0, y1) + r) + 1)):
        for x in range(max(0, int(min(x0, x1) - r)), min(cv.w, int(max(x0, x1) + r) + 1)):
            t = min(1, max(0, ((x + .5 - x0) * vx + (y + .5 - y0) * vy) / L2))
            d = math.hypot(x + .5 - (x0 + t * vx), y + .5 - (y0 + t * vy)) / r
            if d >= 1: continue
            q = math.floor((1 - d) ** 1.5 * strength * 4 + BAYER4[y % 4, x % 4]) / 4
            q = min(q, strength)
            if q > 0: cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


# --- Runde 3b: einheitliches Pixelraster ------------------------------------------------------
def lowres(G):
    """Leinwand im Raster G (jede Zelle = G×G Pixel des 250×350-Rasters)."""
    return Canvas(-(-250 // G), -(-350 // G))


def blow(cv, lo, G, alpha_keep=False):
    """Raster-G-Leinwand ganzzahlig vergrößert auf die 250×350-Leinwand übertragen."""
    big = np.repeat(np.repeat(lo.a, G, 0), G, 1)[:cv.h, :cv.w]
    cv.a[:big.shape[0], :big.shape[1]] = big[..., :3]


def rim_light(s, col, dx, dy, t=0.55):
    """Kantenlicht: deckende Pixel, deren Nachbar in Richtung (dx,dy) leer ist, zur Lichtfarbe hin mischen."""
    a = s[..., 3] > 0
    sh = np.zeros_like(a)
    h, w = a.shape
    ys, xs = np.nonzero(a)
    ny, nx = ys + dy, xs + dx
    ok = (ny < 0) | (ny >= h) | (nx < 0) | (nx >= w)
    inside = ~ok
    empty = np.zeros(len(ys), bool)
    empty[ok] = True
    empty[inside] = ~a[ny[inside], nx[inside]]
    out = s.copy()
    sel = (ys[empty], xs[empty])
    out[sel[0], sel[1], :3] = (out[sel[0], sel[1], :3] * (1 - t) + np.array(col) * t).astype(np.uint8)
    return out


def sgrad(cv, y0, y1, stops, x0=0, x1=None):
    """Senkrechter Verlauf ohne Dithering (jede Rasterzeile eine Farbe) – für grobe Raster (4×/5×)."""
    x1 = cv.w if x1 is None else x1
    n = len(stops) - 1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        c = np.array(stops[i]) * (1 - f) + np.array(stops[i + 1]) * f
        cv.a[y, max(0, x0):min(cv.w, x1)] = c.astype(np.uint8)


def sglow(cv, cx, cy, r, col, strength=0.4):
    """Lichthof ohne Dithering: jede Rasterzelle wird einheitlich zur Lichtfarbe gemischt."""
    col = np.array(col, float)
    for y in range(max(0, int(cy - r)), min(cv.h, int(cy + r) + 1)):
        for x in range(max(0, int(cx - r)), min(cv.w, int(cx + r) + 1)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r
            if d < 1:
                t = (1 - d) ** 1.5 * strength
                cv.a[y, x] = (cv.a[y, x] * (1 - t) + col * t).astype(np.uint8)
