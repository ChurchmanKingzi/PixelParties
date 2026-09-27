# -*- coding: utf-8 -*-
"""Kleine Zusatzwerkzeuge für Block B (Sleeves 07–13), aufbauend auf common/kit."""
import math
import numpy as np
from common import *  # noqa


def lerpc(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vgrad(cv, stops, x0=0, y0=0, x1=None, y1=None, mask=None, levels=4):
    """Senkrechter Verlauf über Farbstufen `stops` [(t, rgb), ...] mit 4×4-Bayer-Dithering
    zwischen benachbarten Stufen (keine Zwischenfarben -> Pixel-Art-Look)."""
    x1 = cv.w if x1 is None else x1; y1 = cv.h if y1 is None else y1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1))
        for k in range(len(stops) - 1):
            if stops[k][0] <= t <= stops[k + 1][0]:
                ta, ca = stops[k]; tb, cb = stops[k + 1]; break
        else:
            ta, ca = stops[-1]; tb, cb = stops[-1]
        f = 0 if tb == ta else (t - ta) / (tb - ta)
        for x in range(max(0, x0), min(cv.w, x1)):
            if mask is not None and not mask[y, x]: continue
            cv.a[y, x] = cb if f > BAYER4[y % 4, x % 4] else ca


def radial(cv, cx, cy, r, col, strength=1.0, mask=None, power=1.0):
    """Weiches Leuchten als gedithertes Überblenden zu `col` (je Pixel volle Farbe oder nichts)."""
    for y in range(max(0, int(cy - r)), min(cv.h, int(cy + r + 1))):
        for x in range(max(0, int(cx - r)), min(cv.w, int(cx + r + 1))):
            if mask is not None and not mask[y, x]: continue
            d = math.hypot(x + .5 - cx, y + .5 - cy) / r
            if d >= 1: continue
            t = ((1 - d) ** power) * strength
            if t > BAYER4[y % 4, x % 4]:
                cv.a[y, x] = col


def shade(cv, factor, mask=None, box=None):
    a = cv.a.astype(float)
    if box:
        x0, y0, x1, y1 = box
        a[y0:y1, x0:x1] *= factor
    elif mask is not None:
        a[mask] *= factor
    else:
        a *= factor
    cv.a[:] = a.clip(0, 255).astype(np.uint8)


def pc(cv, s, cx, cy):
    """Sprite mittig bei (cx, cy) einsetzen; gibt linke obere Ecke zurück."""
    h, w = s.shape[:2]
    x, y = int(cx - w // 2), int(cy - h // 2)
    cv.paste(s, x, y); return x, y


def pb(cv, s, cx, by):
    """Sprite mit Fußpunkt (Mitte unten) bei (cx, by) einsetzen."""
    h, w = s.shape[:2]
    x, y = int(cx - w // 2), int(by - h)
    cv.paste(s, x, y); return x, y


def disk_mask(w, h, cx, cy, r):
    yy, xx = np.mgrid[0:h, 0:w]
    return (xx + .5 - cx) ** 2 + (yy + .5 - cy) ** 2 < r * r


def tile_rgb(tile, w, h, ox=0, oy=0):
    th, tw = tile.shape[:2]
    yy = (np.arange(h)[:, None] + oy) % th
    xx = (np.arange(w)[None, :] + ox) % tw
    return tile[yy, xx][..., :3]


def recolor_map(s, pal_from, pal_to):
    out = s.copy()
    for a, b in zip(pal_from, pal_to):
        m = np.all(s[..., :3] == np.array(a, np.uint8), -1)
        out[m, :3] = b
    return out


def dither_alpha(cv, s, x, y, alpha):
    """Sprite mit geordnetem Dithering 'halbtransparent' setzen (jede Pixel ganz oder gar nicht)."""
    h, w = s.shape[:2]
    m = s[..., 3] > 0
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if m[j, i] and 0 <= X < cv.w and 0 <= Y < cv.h and alpha > BAYER4[Y % 4, X % 4]:
                cv.a[Y, X] = s[j, i, :3]


def lum_tint(s, dark, light):
    """Sprite einfärben: Helligkeit -> Verlauf zwischen zwei Farben (Silhouetten mit Tiefe)."""
    out = s.copy()
    v = s[..., :3].astype(float).mean(-1) / 255.0
    for c in range(3):
        out[..., c] = (dark[c] + (light[c] - dark[c]) * v).clip(0, 255).astype(np.uint8)
    return out
