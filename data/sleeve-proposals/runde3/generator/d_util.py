# -*- coding: utf-8 -*-
"""Kleine Hilfen für Block D (Sleeves 20–26), aufbauend auf common.py."""
import math, os
import numpy as np
from common import *  # noqa

B = 'MotiveGrailWar'
BAYER8 = np.array([[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
                   [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
                   [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                   [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]) / 64.0


def region(base, idxs, box):
    """Ausschnitt (x0,y0,x1,y1) aus zusammengesetzten Ebenen, RGBA, ohne Zuschnitt."""
    return compose(base, idxs, crop=False, box=box)


def fill_bg(cv, rgba, k, ox=0, oy=0):
    """RGB(A)-Bild k-fach vergrößert als Hintergrund ab (ox, oy) auf die Leinwand legen."""
    u = up(rgba, k)
    h, w = u.shape[:2]
    X0, Y0 = max(0, ox), max(0, oy)
    X1, Y1 = min(cv.w, ox + w), min(cv.h, oy + h)
    sub = u[Y0 - oy:Y1 - oy, X0 - ox:X1 - ox]
    if sub.shape[2] == 4:
        m = sub[..., 3] > 0
        cv.a[Y0:Y1, X0:X1][m] = sub[..., :3][m]
    else:
        cv.a[Y0:Y1, X0:X1] = sub


def put(cv, s, x, y, k=1, fl=False, anchor='tl', shadow=None, sh_off=(1, 1), sh_alpha=0.5):
    """Sprite k-fach vergrößert setzen; anchor 'tl' | 'c' | 'b' (unten Mitte)."""
    s2 = flip(s) if fl else s
    s2 = up(s2, k) if k > 1 else s2
    h, w = s2.shape[:2]
    if anchor == 'c': x, y = x - w // 2, y - h // 2
    elif anchor == 'b': x, y = x - w // 2, y - h
    if shadow is not None:
        cv.paste(silhouette(s2, shadow), int(x + sh_off[0] * k), int(y + sh_off[1] * k), alpha=sh_alpha)
    cv.paste(s2, int(x), int(y))
    return int(x), int(y), w, h


def dither_grad(cv, y0, y1, cols, x0=0, x1=None, pix=1, bayer=BAYER8):
    """Senkrechter Verlauf über mehrere Farben, geordnetes Dithering (pix = Blockgröße)."""
    x1 = cv.w if x1 is None else x1
    n = len(cols) - 1
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        for x in range(x0, x1):
            th = bayer[(y // pix) % bayer.shape[0], (x // pix) % bayer.shape[1]]
            cv.a[y, x] = cols[i + 1] if f > th else cols[i]


def frame(cv, cols):
    for i, c in enumerate(cols):
        cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c


def mask_paste(cv, s, x, y, m):
    """Sprite nur dort setzen, wo die Leinwandmaske m (H×W bool) wahr ist."""
    h, w = s.shape[:2]
    t = s.copy()
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(cv.w, x + w), min(cv.h, y + h)
    sub = np.zeros((h, w), bool)
    sub[Y0 - y:Y1 - y, X0 - x:X1 - x] = m[Y0:Y1, X0:X1]
    t[~sub, 3] = 0
    cv.paste(t, x, y)


def decrown(s, rows=6, outline_col=None):
    """Goldene Krone (oberste Zeilen, gelb/orange) entfernen; unterstes entferntes Pixel je Spalte wird
    zur Kopf-Umrisslinie (Farbe = dunkelster Randton der Figur)."""
    w = s.copy()
    c = w[..., :3].astype(int)
    top = np.arange(w.shape[0])[:, None] < rows
    crown = (w[..., 3] > 0) & top & (c[..., 0] - c[..., 2] > 50) & (c[..., 1] - c[..., 2] > 25)
    if outline_col is None:
        op = c[w[..., 3] > 0]; outline_col = tuple(op[op.sum(1).argmin()])
    for x in range(w.shape[1]):
        ys = np.where(crown[:, x])[0]
        if len(ys) == 0: continue
        w[ys, x, 3] = 0
        yb = ys.max()
        if yb + 1 < w.shape[0] and w[yb + 1, x, 3] > 0 and c[yb + 1, x].sum() > 200:
            w[yb, x, :3] = outline_col; w[yb, x, 3] = 255
    m = w[..., 3] > 0
    nb = np.zeros_like(m)
    nb[1:] |= m[:-1]; nb[:-1] |= m[1:]; nb[:, 1:] |= m[:, :-1]; nb[:, :-1] |= m[:, 1:]
    w[m & ~nb & top, 3] = 0                       # vereinzelte Restpixel
    return w


def keep(key, s):
    """Selbst zusammengesetztes Sprite zusätzlich unter sprites3/<key>.png ablegen (Dokumentation)."""
    import xcfkit
    from PIL import Image
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, key + '.png'))
    return s


# --- Runde 3b: auf dem nativen Raster komponieren, dann einheitlich hochskalieren ---------------------
def native(k, color=(0, 0, 0)):
    """Leinwand im nativen Raster für Skalierung k (250×350 / k, aufgerundet)."""
    return Canvas(-(-250 // k), -(-350 // k), color)


def finish(nc, k, cx=None, cy=None):
    """Native Leinwand k-fach vergrößern und mittig (bzw. um cx/cy) auf 250×350 zuschneiden."""
    u = np.repeat(np.repeat(nc.a, k, 0), k, 1)
    h, w = u.shape[:2]
    x0 = (w - 250) // 2 if cx is None else cx
    y0 = (h - 350) // 2 if cy is None else cy
    cv = Canvas(250, 350)
    cv.a[:] = u[y0:y0 + 350, x0:x0 + 250]
    return cv


def dgrad(nc, y0, y1, cols, x0=0, x1=None):
    """Geditherter Verlauf direkt im nativen Raster (Pixelgröße = Skalierung der Ebene)."""
    dither_grad(nc, y0, y1, cols, x0=x0, x1=x1, pix=1)


def blob(nc, cx, cy, rx, ry, col, strength=1.0, bayer=None):
    """Geditherte Ellipse (weicher Rand über geordnetes Dithering) im Raster der Leinwand."""
    bayer = BAYER8 if bayer is None else bayer
    yy, xx = np.mgrid[0:nc.h, 0:nc.w]
    d = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    t = np.clip(1 - d, 0, 1) * strength
    m = t * 2.2 > bayer[yy % 8, xx % 8] + 0.05
    nc.a[m] = col
    return m
