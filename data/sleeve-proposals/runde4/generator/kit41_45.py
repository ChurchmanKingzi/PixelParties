# -*- coding: utf-8 -*-
"""Hilfen für Block I (Sleeves 41–45): Tiefenebenen auf eigenem groben Raster.

Jede Ebene `G(k)` ist ein RGBA-Raster der Größe ceil(250/k)×ceil(350/k). Alles, was darauf gezeichnet
oder eingefügt wird (Sprites 1:1, Linien, Verläufe, Dithering), hat nach dem einmaligen Hochskalieren um k
automatisch dieselbe Pixelgröße. `flatten([...])` legt die Ebenen von hinten nach vorn übereinander und
liefert ein 250×350-Canvas für `save`.
"""
import math, os, sys
import numpy as np
from common import *  # noqa

B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0


class G:
    def __init__(self, k, fill=None):
        self.k = k
        self.w = -(-250 // k); self.h = -(-350 // k)
        self.a = np.zeros((self.h, self.w, 4), np.uint8)
        if fill is not None:
            self.a[..., :3] = fill; self.a[..., 3] = 255

    # --- Grundoperationen -------------------------------------------------
    def px(self, x, y, c, a=255):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x, :3] = c[:3]; self.a[y, x, 3] = a

    def get(self, x, y):
        return tuple(int(v) for v in self.a[y, x, :3])

    def rect(self, x0, y0, x1, y1, c):
        x0, y0 = max(0, int(x0)), max(0, int(y0)); x1, y1 = min(self.w, int(x1)), min(self.h, int(y1))
        if x1 > x0 and y1 > y0:
            self.a[y0:y1, x0:x1, :3] = c[:3]; self.a[y0:y1, x0:x1, 3] = 255

    def paste(self, s, x, y, alpha=1.0):
        x, y = int(x), int(y)
        h, w = s.shape[:2]
        X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(self.w, x + w), min(self.h, y + h)
        if X1 <= X0 or Y1 <= Y0: return
        sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
        m = sub[..., 3] >= 128
        if alpha < 1.0:   # geordnetes Dithering statt Halbtransparenz
            yy, xx = np.mgrid[Y0:Y1, X0:X1]
            m = m & (alpha > B4[yy % 4, xx % 4])
        d = self.a[Y0:Y1, X0:X1]
        d[m, :3] = sub[m, :3]; d[m, 3] = 255

    def pc(self, s, cx, cy, alpha=1.0):
        self.paste(s, cx - s.shape[1] // 2, cy - s.shape[0] // 2, alpha)

    def pb(self, s, cx, by, alpha=1.0):
        self.paste(s, cx - s.shape[1] // 2, by - s.shape[0], alpha)

    def mask(self):
        return self.a[..., 3] > 0

    # --- Zeichnen ---------------------------------------------------------
    def line(self, x0, y0, x1, y1, c, alt=None):
        """Bresenham; mit alt: Pixel für Pixel abwechselnd c/alt (Faden)."""
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
        err = dx + dy; n = 0
        while True:
            self.px(x0, y0, alt if (alt is not None and n % 2) else c); n += 1
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy

    def poly(self, pts, c, alt=None):
        for (a, b), (p, q) in zip(pts[:-1], pts[1:]):
            self.line(a, b, p, q, c, alt)

    def dfill(self, m, c, t=1.0):
        """Maske m (bool, Rastergröße) mit Farbe c füllen, Anteil t per Bayer-Dithering (t darf Array sein)."""
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        t = np.broadcast_to(np.asarray(t, float), m.shape)
        mm = m & (t > B4[yy % 4, xx % 4])
        self.a[mm, :3] = c[:3]; self.a[mm, 3] = 255

    def vgrad(self, stops, y0=0, y1=None, m=None):
        """Senkrechter Verlauf über Farbstufen [(t, rgb)], zwischen Nachbarstufen gedithert."""
        y1 = self.h if y1 is None else y1
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        t = (yy - y0) / max(1, (y1 - y0 - 1))
        band = (yy >= y0) & (yy < y1)
        if m is not None: band &= m
        for (ta, ca), (tb, cb) in zip(stops[:-1], stops[1:]):
            sel = band & (t >= ta) & (t <= tb)
            f = (t - ta) / max(1e-6, tb - ta)
            pick = f > B4[yy % 4, xx % 4]
            for cond, col in ((sel & ~pick, ca), (sel & pick, cb)):
                self.a[cond, :3] = col; self.a[cond, 3] = 255

    def glow(self, cx, cy, r, col, strength=1.0, power=1.0, m=None, ry=None):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        ry = r if ry is None else ry
        d = np.sqrt(((xx + .5 - cx) / r) ** 2 + ((yy + .5 - cy) / ry) ** 2)
        t = np.clip(1 - d, 0, 1) ** power * strength
        mm = (self.a[..., 3] > 0) if m is None else m
        self.dfill(mm, col, t)

    def ellipse_mask(self, cx, cy, rx, ry):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        return ((xx + .5 - cx) / rx) ** 2 + ((yy + .5 - cy) / ry) ** 2 <= 1

    def shade(self, f, m=None):
        mm = self.mask() if m is None else m
        self.a[mm, :3] = (self.a[mm, :3] * f).clip(0, 255).astype(np.uint8)


def flatten(layers, bg=(0, 0, 0)):
    """Ebenen (hinten → vorn) je um ihr k hochskalieren und zu einem 250×350-Canvas verschmelzen."""
    out = np.zeros((350, 250, 3), np.uint8); out[:] = bg
    for L in layers:
        u = np.repeat(np.repeat(L.a, L.k, 0), L.k, 1)[:350, :250]
        m = u[..., 3] > 0
        out[m] = u[m, :3]
    cv = Canvas(250, 350); cv.a[:] = out
    return cv


def outline(s, col=(0, 0, 0)):
    """1-px-Kontur (im Raster des Sprites) um alle deckenden Pixel."""
    h, w = s.shape[:2]
    p = np.zeros((h + 2, w + 2, 4), np.uint8); p[1:-1, 1:-1] = s
    m = p[..., 3] > 0
    g = m.copy(); g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
    r = g & ~m
    p[r, :3] = col; p[r, 3] = 255
    return p


def trimmed(s):
    b = bbox(s)
    return s[b[1]:b[3], b[0]:b[2]] if b else s


def recol(s, fn):
    """Farben pixelweise umrechnen: fn(rgb-Array Nx3) -> Nx3."""
    o = s.copy(); m = o[..., 3] > 0
    o[m, :3] = np.clip(fn(o[m, :3].astype(float)), 0, 255).astype(np.uint8)
    return o


def lum_tint(s, dark, light):
    """Graustufen-Helligkeit auf eine Zweifarben-Rampe abbilden (Silhouetten/Schatten-Varianten)."""
    def f(c):
        l = (c @ np.array([0.3, 0.59, 0.11]) / 255.0)[:, None]
        return np.array(dark) * (1 - l) + np.array(light) * l
    return recol(s, f)


def preview(src, dst, form, pal, gem, gem2=None):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
    import frames2 as F
    return F.apply(src, dst, form, pal, gem, gem2)


def shade_final(cv, m, k, f):
    """Nach dem Verschmelzen: Maske m (im Raster k) auf das 250×350-Bild hochskalieren und dort abdunkeln
    (Schlagschatten mit der Pixelgröße der werfenden Ebene)."""
    u = np.repeat(np.repeat(m, k, 0), k, 1)[:350, :250]
    cv.a[u] = (cv.a[u] * f).astype(np.uint8)


def grid_mask(k):
    return np.zeros((-(-350 // k), -(-250 // k)), bool)


def vbands(g, cols, edges, x0=0, x1=None, m=None, soft=2.0):
    """Waagerechte Farbbänder: cols[i] zwischen edges[i-1] und edges[i]; nur ±soft Zeilen um jede Kante
    werden gedithert (ruhige Flächen statt großflächigem Schachbrett)."""
    yy, xx = np.mgrid[0:g.h, 0:g.w]
    x1 = g.w if x1 is None else x1
    sel = (xx >= x0) & (xx < x1)
    if m is not None: sel &= m
    idx = np.searchsorted(np.array(edges), yy + .5)
    idx = np.clip(idx, 0, len(cols) - 1)
    out = np.array(cols)[idx]
    for k, e in enumerate(edges):
        if k + 1 >= len(cols): break
        t = (yy + .5 - (e - soft)) / (2 * soft)
        band = (t > 0) & (t < 1)
        pick = band & (t > B4[yy % 4, xx % 4])
        out[band & ~pick] = cols[k]; out[pick] = cols[k + 1]
    g.a[sel, :3] = out[sel]; g.a[sel, 3] = 255


def tint_final(cv, m, k, col, t, lift=1.0):
    """Nach dem Verschmelzen: Bereich m (Raster k) aufhellen/einfärben – z. B. Glas vor dem Hintergrund."""
    u = np.repeat(np.repeat(m, k, 0), k, 1)[:350, :250]
    v = cv.a[u].astype(float) * lift
    cv.a[u] = np.clip(v * (1 - t) + np.array(col) * t, 0, 255).astype(np.uint8)
