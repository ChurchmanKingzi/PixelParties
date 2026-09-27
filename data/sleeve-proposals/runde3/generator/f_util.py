# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Block F (Sleeves 33–38, 57).

Grundsatz Runde 3b: alle Elemente einer Bildebene in derselben Skalierung K. Licht/Schatten und Dithering werden
deshalb auf dem K-Raster berechnet (ein „Pixel“ = K×K Canvas-Pixel), damit keine feineren Pixel entstehen.
"""
import numpy as np
from common import *  # noqa

W, H = 250, 350


def rgba(a):
    """RGB(A)-Ausschnitt voll deckend machen (Hintergrund-Stücke)."""
    return np.dstack([a[..., :3], np.full(a.shape[:2], 255, np.uint8)])


def put(cv, s, x, y, k=1, anchor='tl', fl=False):
    """Sprite ganzzahlig skaliert setzen. anchor: tl, b (Mitte unten), bl (links unten), c (Mitte)."""
    s2 = flip(s) if fl else s
    if k != 1: s2 = up(s2, k)
    h, w = s2.shape[:2]
    if anchor == 'b': x, y = x - w // 2, y - h
    elif anchor == 'c': x, y = x - w // 2, y - h // 2
    elif anchor == 'bl': y = y - h
    x, y = int(x), int(y)
    cv.paste(s2, x, y)
    return x, y, w, h


def grid(k, ox=0, oy=0):
    """Koordinaten des K-Rasters (Mitte jeder K-Zelle) und Bayer-Schwelle je Zelle."""
    yy, xx = np.mgrid[0:H, 0:W]
    gy, gx = (yy - oy) // k, (xx - ox) // k
    cy, cx = gy * k + oy + k / 2, gx * k + ox + k / 2
    th = BAYER4[gy % 4, gx % 4]
    return cx, cy, th


def shade(cv, t, th, col=(0, 0, 0), levels=4):
    """Canvas zu Anteil t (0..1, Feld H×W) Richtung col mischen, quantisiert + geordnet gedithert (Schwelle th)."""
    q = (np.floor(t * levels + th) / levels).clip(0, 1)
    cv.a[:] = (cv.a * (1 - q[..., None]) + np.array(col) * q[..., None]).clip(0, 255).astype(np.uint8)


def vgrad(cv, stops, y0=0, y1=H, k=1, ox=0, oy=0):
    """Senkrechter Verlauf über Farbstufen, geordnet gedithert auf dem K-Raster."""
    cx, cy, th = grid(k, ox, oy)
    n = len(stops) - 1
    t = np.clip((cy - y0) / max(1, y1 - y0), 0, 1) * n
    q = np.floor(t + th * 0.999).clip(0, n).astype(int)
    for i, c in enumerate(stops):
        cv.a[q == i] = c


def ghost(cv, S, x, y, k, alpha=0.5, fade_from=0.6, tint_col=None, tint_t=0.0, keep=None):
    """Halbtransparenter Geist (Regel E): Sprite S (bereits K-fach skaliert) mit Alpha auf ganze K-Pixel mischen.
    Ab fade_from (Anteil der Höhe) läuft die Figur nach unten geordnet gedithert aus. keep: Maske (in S-Koordinaten)
    von Pixeln, die voll deckend bleiben (z. B. leuchtende Augen)."""
    S = S.copy()
    if tint_col is not None and tint_t:
        S = tint(S, tint_col, tint_t)
    h, w = S.shape[:2]
    ny, nx = h // k, w // k
    gy, gx = np.mgrid[0:ny, 0:nx]
    fade = np.clip((gy / ny - fade_from) / max(1e-6, 1 - fade_from), 0, 1)
    vis = (1 - fade) > BAYER4[gy % 4, gx % 4] * 0.999
    vis = up(vis[..., None].astype(np.uint8), k)[..., 0] > 0
    a = np.where(vis, alpha, 0.0)
    if keep is not None:
        a = np.where(keep, 1.0, a)
    m = (S[..., 3] > 0)
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(W, x + w), min(H, y + h)
    sub = S[Y0 - y:Y1 - y, X0 - x:X1 - x]
    al = (a[Y0 - y:Y1 - y, X0 - x:X1 - x] * m[Y0 - y:Y1 - y, X0 - x:X1 - x])[..., None]
    dst = cv.a[Y0:Y1, X0:X1].astype(float)
    cv.a[Y0:Y1, X0:X1] = (sub[..., :3] * al + dst * (1 - al)).astype(np.uint8)


def drop(cv, S, x, y, k, col=(0, 0, 0), alpha=0.45, dx=1, dy=1):
    """Schlagschatten eines K-fach skalierten Sprites, versetzt um ganze K-Pixel."""
    cv.paste(silhouette(S, col), x + dx * k, y + dy * k, alpha=alpha)


def ellipse_shadow(cv, cx, cy, rx, ry, k, alpha=0.45, col=(0, 0, 0)):
    """Bodenschatten als Ellipse auf dem K-Raster."""
    x0, y0 = int(cx - rx), int(cy - ry)
    nx, ny = int(2 * rx // k) + 1, int(2 * ry // k) + 1
    gy, gx = np.mgrid[0:ny, 0:nx]
    ex = (gx + 0.5 - nx / 2) / (nx / 2); ey = (gy + 0.5 - ny / 2) / (ny / 2)
    m = (ex ** 2 + ey ** 2) <= 1
    s = np.zeros((ny, nx, 4), np.uint8); s[m, 3] = 255; s[..., :3] = col
    s = up(s, k)
    cv.paste(s, int(cx - s.shape[1] / 2), int(cy - s.shape[0] / 2), alpha=alpha)
