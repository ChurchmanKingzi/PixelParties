# -*- coding: utf-8 -*-
"""Gemeinsame Werkzeuge für die Tarot-Sleeves (Große Arkana).

Raster: 250x350 Pixel, gespeichert mit Faktor 3 -> 750x1050 (wie alle Sleeves).
Der Rahmen (Gold-Relief, Platten oben/unten, Spiralen) ist derselbe wie bei
„XIII – Skullmael“ (v2_05_tarot.py), damit die Serie zusammenpasst.

Typischer Ablauf eines Karten-Skripts:
    from tlib import *
    cv = new_card()                 # Canvas 250x350
    sky(cv, [...])                  # Hintergrund im Bildfeld (AX0..AX1, AY0..AY1)
    f = Fig(); f.ellipse(...); ...  # Figur als Materialkarte zeichnen
    cv.paste(f.render(MATS), x, y)  # schattiert + gedithert einfügen
    ... Details in voller Auflösung mit px()/rampc() ...
    finish(cv, 'XIX', 'TAIO', emblem=emblem_sun, out='19_sun_taio')
"""
import os, sys, math, random
TDIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(TDIR))
from px2 import *                      # noqa: F401,F403  (Canvas, relief, render_regions, BAYER4, ...)
from font35 import text35, width35     # noqa: F401

W, H = 250, 350
AX0, AY0, AX1, AY1 = 16, 42, 234, 302   # Bildfeld innerhalb des Rahmens
CX = 125                                 # horizontale Mitte des Bildfelds
OUTDIR = os.path.abspath(os.path.join(TDIR, '..', '..', 'tarot'))
os.makedirs(OUTDIR, exist_ok=True)
OUT = (18, 10, 24)                       # Standard-Umrissfarbe

# ------------------------------------------------------------------ Farbrampen
GOLD = [(90, 44, 10), (150, 86, 20), (212, 146, 40), (246, 198, 74), (255, 236, 150), (255, 252, 220)]
GOLD7 = [(70, 34, 8), (120, 70, 16), (176, 116, 32), (222, 164, 52), (248, 206, 96), (255, 236, 170), (255, 255, 236)]
SILVER = [(30, 32, 46), (60, 66, 86), (98, 106, 130), (146, 154, 178), (190, 198, 218), (226, 232, 246), (255, 255, 255)]
BONE = [(52, 40, 36), (100, 86, 72), (150, 136, 114), (196, 184, 158), (228, 220, 198), (248, 244, 230)]
SKIN = [(92, 44, 36), (150, 82, 60), (206, 128, 96), (238, 172, 132), (252, 210, 176), (255, 236, 214)]
SKIN_DARK = [(52, 26, 22), (96, 52, 36), (140, 84, 56), (184, 120, 82), (216, 160, 116), (240, 200, 160)]
RUBY = [(60, 4, 14), (130, 10, 30), (200, 30, 50), (250, 90, 100), (255, 200, 200)]
SAPH = [(8, 16, 60), (20, 50, 140), (50, 110, 220), (140, 190, 255), (230, 245, 255)]
EMER = [(4, 40, 20), (10, 100, 50), (40, 170, 90), (140, 240, 170), (230, 255, 240)]
AMETH = [(30, 8, 48), (70, 20, 110), (120, 50, 180), (180, 120, 240), (240, 220, 255)]
WHITE_CLOTH = [(70, 70, 96), (120, 122, 150), (170, 174, 198), (214, 218, 234), (244, 246, 252), (255, 255, 255)]
RED_CLOTH = [(50, 6, 14), (100, 14, 28), (160, 28, 40), (210, 56, 56), (240, 110, 96)]
BLUE_CLOTH = [(12, 14, 44), (24, 34, 90), (40, 64, 150), (70, 110, 200), (130, 170, 236)]
PURPLE_CLOTH = [(26, 8, 34), (48, 16, 62), (74, 28, 94), (100, 44, 124), (130, 70, 156)]
GREEN_CLOTH = [(8, 30, 18), (18, 60, 30), (34, 100, 44), (60, 146, 60), (110, 190, 90)]
BROWN = [(34, 18, 12), (70, 40, 24), (110, 68, 40), (152, 100, 60), (194, 140, 90)]
STONE = [(24, 20, 34), (46, 40, 60), (72, 66, 90), (104, 98, 124), (140, 134, 160), (180, 176, 196)]
FIRE = [(80, 10, 6), (170, 30, 10), (236, 90, 20), (255, 170, 40), (255, 230, 120), (255, 255, 220)]


def ramp_between(c1, c2, n=5):
    return [lerp(c1, c2, i / (n - 1)) for i in range(n)]


def hair_ramp(base):
    """5-stufige Rampe aus einer Grundfarbe (dunkel -> hell)."""
    b = np.array(base, float)
    return [tuple(np.clip(b * f, 0, 255).astype(int)) for f in (0.35, 0.6, 0.85)] + \
           [tuple(np.clip(b + (255 - b) * t, 0, 255).astype(int)) for t in (0.3, 0.6)]


# ------------------------------------------------------------ Pixel-Helfer
def px(cv, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < cv.w and 0 <= y < cv.h:
        cv.a[y, x] = c[:3]


def rampc(ramp, v, x, y):
    """Farbe aus Rampe für Wert v in [0,1] mit geordnetem Dithering."""
    n = len(ramp) - 1
    v = min(0.9999, max(0.0, v)) * n
    i = int(v); f = v - i
    return ramp[min(n, i + 1)] if f > BAYER4[int(y) % 4, int(x) % 4] else ramp[i]


def blend_px(cv, x, y, c, k):
    x, y = int(x), int(y)
    if 0 <= x < cv.w and 0 <= y < cv.h:
        cv.a[y, x] = lerp(tuple(cv.a[y, x]), c, k)


def new_card(color=(16, 10, 24)):
    return Canvas(W, H, color)


def in_art(x, y):
    return AX0 <= x < AX1 and AY0 <= y < AY1


# ------------------------------------------------------------ Hintergrund
def sky(cv, stops, y0=AY0, y1=AY1, x0=AX0, x1=AX1):
    """vertikaler Verlauf mit Bayer-Dithering"""
    dither_gradient(cv, x0, y0, x1, y1, stops)


def stars(cv, n, y0=AY0, y1=AY1, x0=AX0, x1=AX1, seed=1, cols=None, big=0.1, mask=None):
    rnd = random.Random(seed)
    cols = cols or [(255, 255, 255), (200, 200, 255), (255, 240, 210), (150, 150, 210)]
    for _ in range(n):
        x = rnd.randint(x0, x1 - 1); y = rnd.randint(y0, y1 - 1)
        if mask is not None and not mask[y, x]:
            continue
        c = rnd.choice(cols)
        px(cv, x, y, c)
        if rnd.random() < big:
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                blend_px(cv, x + dx, y + dy, c, 0.5)


def sparkle(cv, x, y, c=(255, 255, 240), r=2, c2=None):
    c2 = c2 or lerp(c, (0, 0, 0), 0.35)
    px(cv, x, y, c)
    for k in range(1, r + 1):
        cc = c if k < r else c2
        px(cv, x + k, y, cc); px(cv, x - k, y, cc); px(cv, x, y + k, cc); px(cv, x, y - k, cc)


def glow(cv, cx, cy, r, color, k=0.35, rx=1.0, ry=1.0, mix=0.35, clip=True):
    """weicher, geditherter Lichthof"""
    for y in range(int(cy - r / ry) - 1, int(cy + r / ry) + 2):
        for x in range(int(cx - r / rx) - 1, int(cx + r / rx) + 2):
            if clip and not in_art(x, y):
                continue
            d = math.hypot((x - cx) * rx, (y - cy) * ry)
            if d < r and BAYER4[y % 4, x % 4] < (1 - d / r) * k * 2:
                blend_px(cv, x, y, color, mix)


def rays(cv, cx, cy, n, r0, r1, color, width=0.12, k=0.5, phase=0.0, mix=0.4):
    """Strahlenkranz (z.B. Sonne, heiliges Licht) – gedithert"""
    for y in range(AY0, AY1):
        for x in range(AX0, AX1):
            d = math.hypot(x - cx, y - cy)
            if r0 < d < r1:
                a = math.atan2(y - cy, x - cx) + phase
                s = abs(math.sin(a * n / 2))
                if s < width * 4:
                    t = (1 - (d - r0) / (r1 - r0)) * (1 - s / (width * 4))
                    if BAYER4[y % 4, x % 4] < t * k * 2:
                        blend_px(cv, x, y, color, mix)


def disc_relief(cv, cx, cy, r, ramp, craters=(), noise_k=0.3, seed=3, bias=0.08, k=2.0, halo=None, halo_r=10):
    """Mond/Sonne/Planet als Relief-Kugel (wie der Mond bei Skullmael)"""
    yy, xx = np.indices((H, W))
    d = np.hypot(xx - cx, yy - cy)
    M = d <= r
    Hm = np.where(M, np.sqrt(np.maximum(0, r * r - d * d)) * 0.05, 0).astype(np.float32)
    for (ccx, ccy, cr) in craters:
        dd = np.hypot(xx - ccx, yy - ccy)
        Hm -= np.where(dd < cr, 0.9 * np.sqrt(np.maximum(0, 1 - (dd / cr) ** 2)), 0)
        Hm += np.where((dd >= cr) & (dd < cr + 2), 0.35, 0)
    if noise_k:
        Hm += (noise(H, W, 4, seed=seed) - 0.5) * noise_k
    M &= (yy >= AY0) & (yy < AY1) & (xx >= AX0) & (xx < AX1)
    relief(cv, Hm, np.zeros((H, W), np.int32), [ramp], M, k=k, bias=bias)
    if halo is not None:
        for y in range(int(cy - r - halo_r), int(cy + r + halo_r) + 1):
            for x in range(int(cx - r - halo_r), int(cx + r + halo_r) + 1):
                dd = math.hypot(x - cx, y - cy)
                if r < dd < r + halo_r and in_art(x, y) and BAYER4[y % 4, x % 4] < (1 - (dd - r) / halo_r) * 0.55:
                    blend_px(cv, x, y, halo, 0.3)
    return M


def cloud_band(cv, y0, x0, x1, col, col2, amp=3, freq=0.13, thick=6, seed=0):
    for x in range(x0, x1):
        top = y0 + int(amp * math.sin(x * freq + seed) + (amp * 0.66) * math.sin(x * 0.31 + seed * 2))
        for y in range(top, top + thick):
            c = col if y < top + 2 else col2
            if y == top + thick - 1 and (x + y) % 2:
                continue
            if in_art(x, y):
                px(cv, x, y, c)


def puffy_cloud(cv, cx, cy, w, h, ramp, seed=0, clip=True):
    """Kumuluswolke aus überlagerten Kreisen, oben hell, unten dunkel (Relief)"""
    rnd = random.Random(seed)
    yy, xx = np.indices((H, W))
    M = np.zeros((H, W), bool); Hh = np.zeros((H, W), np.float32)
    n = max(3, int(w / 9))
    for i in range(n):
        t = i / (n - 1)
        bx = cx - w / 2 + t * w
        br = h * (0.45 + 0.55 * math.sin(math.pi * t)) * rnd.uniform(0.75, 1.0)
        by = cy - br * 0.35
        dd = np.hypot(xx - bx, (yy - by) * 1.1)
        m = dd < br
        M |= m
        Hh = np.maximum(Hh, np.where(m, np.sqrt(np.maximum(0, br * br - dd * dd)) * 0.12, 0))
    M &= yy <= cy + h * 0.25
    if clip:
        M &= (yy >= AY0) & (yy < AY1) & (xx >= AX0) & (xx < AX1)
    relief(cv, Hh, np.zeros((H, W), np.int32), [ramp], M, k=1.6, bias=0.1)
    return M


def hills(cv, base, amp, ramp_or_col, freq=0.05, seed=0, x0=AX0, x1=AX1, y1=AY1, shade_top=2, col_top=None):
    """Silhouetten-Hügel; gibt Höhen je x zurück"""
    tops = {}
    for x in range(x0, x1):
        h = int(base + amp * math.sin(x * freq + seed) + amp * 0.5 * math.sin(x * freq * 2.7 + seed * 3))
        tops[x] = h
        for y in range(h, y1):
            if isinstance(ramp_or_col, list):
                c = rampc(ramp_or_col, 1 - (y - h) / max(1, (y1 - h)) * 0.9, x, y)
            else:
                c = ramp_or_col
            if col_top is not None and y < h + shade_top:
                c = col_top
            px(cv, x, y, c)
    return tops


def fog(cv, y0, y1, color, k=2.2, seed=9, mix=0.45):
    fn = noise(H, W, 10, seed=seed, octaves=2)
    for y in range(y0, y1):
        for x in range(AX0, AX1):
            t = (y - y0) / max(1, (y1 - y0))
            if fn[y, x] > 0.5 and BAYER4[y % 4, x % 4] < (fn[y, x] - 0.5) * k * t + 0.05:
                blend_px(cv, x, y, color, mix)


def vignette(cv, color=(10, 6, 16), strength=0.5, r0=0.55):
    """dunklere Ränder im Bildfeld (gedithert)"""
    cx = (AX0 + AX1) / 2; cy = (AY0 + AY1) / 2
    for y in range(AY0, AY1):
        for x in range(AX0, AX1):
            d = math.hypot((x - cx) / ((AX1 - AX0) / 2), (y - cy) / ((AY1 - AY0) / 2))
            t = (d - r0) / (1.42 - r0)
            if t > 0 and BAYER4[y % 4, x % 4] < t * strength:
                blend_px(cv, x, y, color, 0.45)


# ------------------------------------------------------------ Figuren-Renderer
class Fig:
    """Materialkarte (ein Zeichen je Pixel, '.' = leer). Primitive zeichnen Materialien,
    render() schattiert jede Fläche mit Kissen-Schattierung + Bayer-Dithering (render_regions)
    und setzt einen dunklen Umriss. 'K' = expliziter Umriss/Linie.
    Koordinaten sind lokal (0..w, 0..h); mirror=True spiegelt an der vertikalen Mittelachse mx."""

    def __init__(self, w, h, mx=None):
        self.w, self.h = w, h
        self.L = np.full((h, w), '.', dtype='<U1')
        self.P = np.zeros((h, w), np.int32)       # Teil-ID je Pixel (für innere Konturen)
        self.parts = {}                           # Teilname -> (id, Reihenfolge)
        self.noline = set()                       # Teile ohne innere Kontur
        self.mx = (w - 1) / 2 if mx is None else mx
        self._part = None

    def _m(self):
        return np.zeros((self.h, self.w), np.uint8)

    def part(self, name, line=True):
        """alle folgenden Primitive gehören zu Teil 'name' (None = Teil je Material).
        Wo ein später gezeichneter Teil an einen früheren grenzt, bekommt der frühere
        eine dunkle Kontur in seiner dunkelsten Rampenfarbe (siehe render(inner=True))."""
        self._part = name
        if name is not None and not line:
            self.noline.add(name)
        return self

    def _pid(self, k):
        name = self._part if self._part is not None else ('mat:' + k)
        if name not in self.parts:
            self.parts[name] = (len(self.parts) + 1, len(self.parts) + 1)
        else:
            pid, _ = self.parts[name]
            self.parts[name] = (pid, max(o for _, o in self.parts.values()) + 1)
        return self.parts[name][0]

    def _set(self, m, k, mirror=False, only=None, keep=None):
        m = m.astype(bool)
        if mirror:
            ys, xs = np.where(m)
            xm = np.round(2 * self.mx - xs).astype(int)
            ok = (xm >= 0) & (xm < self.w)
            m2 = np.zeros_like(m); m2[ys[ok], xm[ok]] = True
            m = m | m2
        if only is not None:
            m &= np.isin(self.L, list(only))
        if keep is not None:
            m &= ~np.isin(self.L, list(keep))
        self.L[m] = k
        if k in ('.', 'K'):
            self.P[m] = 0
        else:
            self.P[m] = self._pid(k)
        return m

    def mask(self, keys):
        return np.isin(self.L, list(keys))

    def ellipse(self, cx, cy, rx, ry, k, mirror=False, only=None, keep=None, a0=None, a1=None):
        yy, xx = np.indices((self.h, self.w))
        m = ((xx - cx) / max(rx, 0.5)) ** 2 + ((yy - cy) / max(ry, 0.5)) ** 2 <= 1.0
        if a0 is not None:
            a = np.degrees(np.arctan2(yy - cy, xx - cx)) % 360
            m &= ((a - a0) % 360) <= ((a1 - a0) % 360)
        return self._set(m, k, mirror, only, keep)

    def poly(self, pts, k, mirror=False, only=None, keep=None):
        m = self._m()
        cv2.fillPoly(m, [np.round(np.array(pts, float)).astype(np.int32)], 1)
        return self._set(m, k, mirror, only, keep)

    def rect(self, x0, y0, x1, y1, k, mirror=False, only=None, keep=None):
        m = self._m(); m[max(0, int(y0)):int(y1) + 1, max(0, int(x0)):int(x1) + 1] = 1
        return self._set(m, k, mirror, only, keep)

    def line(self, x0, y0, x1, y1, k, w=1, mirror=False, only=None, keep=None):
        m = self._m()
        if w <= 1:
            n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            for i in range(n + 1):
                t = i / max(1, n)
                x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
                if 0 <= x < self.w and 0 <= y < self.h:
                    m[y, x] = 1
        else:
            cv2.line(m, (int(round(x0)), int(round(y0))), (int(round(x1)), int(round(y1))), 1, int(w))
        return self._set(m, k, mirror, only, keep)

    def limb(self, x0, y0, x1, y1, r0, r1, k, mirror=False, only=None, keep=None):
        """sich verjüngende Kapsel (Arme, Beine, Finger, Schwanz)"""
        yy, xx = np.indices((self.h, self.w)).astype(float)
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1
        t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / L2, 0, 1)
        px_, py_ = x0 + t * dx, y0 + t * dy
        r = r0 + (r1 - r0) * t
        m = np.hypot(xx - px_, yy - py_) <= r
        return self._set(m, k, mirror, only, keep)

    def curve(self, pts, k, w=1.0, w1=None, mirror=False, only=None, keep=None, steps=60):
        """Catmull-Rom-Kurve durch pts mit Breite w (-> w1 am Ende)"""
        P = np.array(pts, float)
        if len(P) == 2:
            P = np.vstack([P[0], P, P[-1]])
        else:
            P = np.vstack([P[0], P, P[-1]])
        out = []
        for i in range(1, len(P) - 2):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            for s in np.linspace(0, 1, steps, endpoint=False):
                s2, s3 = s * s, s * s * s
                out.append(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3))
        out.append(P[-2])
        out = np.array(out)
        w1 = w if w1 is None else w1
        m = self._m()
        n = len(out)
        for i, (x, y) in enumerate(out):
            r = (w + (w1 - w) * i / max(1, n - 1)) / 2
            if r <= 0.5:
                xi, yi = int(round(x)), int(round(y))
                if 0 <= xi < self.w and 0 <= yi < self.h:
                    m[yi, xi] = 1
            else:
                cv2.circle(m, (int(round(x)), int(round(y))), int(round(r)), 1, -1)
        return self._set(m, k, mirror, only, keep)

    def fill_mask(self, m, k, mirror=False, only=None, keep=None):
        return self._set(m, k, mirror, only, keep)

    def paste(self, other, x, y, keep_empty=True):
        """andere Fig (oder Label-Array) an x,y einsetzen"""
        L = other.L if isinstance(other, Fig) else other
        h, w = L.shape
        for j in range(h):
            for i in range(w):
                if L[j, i] != '.' and 0 <= y + j < self.h and 0 <= x + i < self.w:
                    self.L[y + j, x + i] = L[j, i]
                    if isinstance(other, Fig) and L[j, i] != 'K':
                        self.P[y + j, x + i] = self._pid(L[j, i]) if other.P[j, i] else 0

    def outline(self, k='K', diag=False, between=None):
        """Silhouetten-Umriss (außen) + optional Linien zwischen Materialgruppen.
        between: Liste von (setA, setB) – Pixel aus A, die an B grenzen, werden K."""
        e = self.L == '.'
        f = ~e
        g = f.copy()
        g[1:] |= f[:-1]; g[:-1] |= f[1:]; g[:, 1:] |= f[:, :-1]; g[:, :-1] |= f[:, 1:]
        if diag:
            g[1:, 1:] |= f[:-1, :-1]; g[:-1, :-1] |= f[1:, 1:]; g[1:, :-1] |= f[:-1, 1:]; g[:-1, 1:] |= f[1:, :-1]
        ring = g & e
        if between:
            for A, B in between:
                a = np.isin(self.L, list(A)); b = np.isin(self.L, list(B))
                nb = np.zeros_like(b)
                nb[1:] |= b[:-1]; nb[:-1] |= b[1:]; nb[:, 1:] |= b[:, :-1]; nb[:, :-1] |= b[:, 1:]
                self.L[a & nb] = k
        self.L[ring] = k
        return self

    def grow(self, pad):
        """Rand hinzufügen (z.B. vor outline())"""
        L = np.full((self.h + 2 * pad, self.w + 2 * pad), '.', dtype='<U1')
        L[pad:-pad, pad:-pad] = self.L
        P = np.zeros(L.shape, np.int32); P[pad:-pad, pad:-pad] = self.P
        self.L = L; self.P = P; self.h += 2 * pad; self.w += 2 * pad; self.mx += pad
        return self

    def inner_lines(self):
        """Maske der inneren Konturpixel: Pixel eines Teils, der an einen später gezeichneten Teil grenzt"""
        order = np.zeros(max([pid for pid, _ in self.parts.values()] + [0]) + 1, np.int32)
        nol = np.zeros_like(order, bool)
        for name, (pid, o) in self.parts.items():
            order[pid] = o
            if name in self.noline:
                nol[pid] = True
        P = self.P; O = order[P]
        res = np.zeros(P.shape, bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            Q = np.roll(np.roll(P, dy, 0), dx, 1)
            OQ = order[Q]
            res |= (P > 0) & (Q > 0) & (Q != P) & (OQ > O) & ~nol[Q] & ~nol[P]
        return res

    def render(self, mats, outline_col=OUT, light=(-0.62, -0.62, 0.48), seed=0, thin=False, inner=True):
        """schattiert jede Materialfläche; inner=True zieht innere Konturen (dunkelste Rampenfarbe)"""
        # jeder Teil als eigene Fläche schattieren: Materialfläche je Teil trennen, indem die
        # inneren Konturpixel vor dem Rendern leer bleiben
        IL = self.inner_lines() if inner else np.zeros(self.L.shape, bool)
        L = self.L.copy()
        keys = L[IL]
        L[IL] = 'K'
        out = render_regions(L, mats, outline_col=outline_col, light=light, seed=seed, thin=thin)
        ys, xs = np.where(IL)
        for y, x, k in zip(ys, xs, keys):
            r = mats.get(k, {}).get('ramp')
            if r:
                c = np.array(r[0], float) * 0.8 + np.array(outline_col, float) * 0.2
                out[y, x, :3] = c.astype(np.uint8)
        return out


def mat(ramp, pillow=3.0, k=1.4, **kw):
    """Material-Definition für Fig.render (siehe px2.render_regions)"""
    d = dict(ramp=ramp, pillow=pillow, k=k); d.update(kw); return d


def paste_fig(cv, rgba, x, y, flip=False):
    cv.paste(rgba, int(x), int(y), flip=flip)


# ------------------------------------------------------------ Gesichter
def anime_eye(cv, x, y, iris, h=5, w=4, flip=False, lash=OUT, white=(250, 250, 255), glint=(255, 255, 255)):
    """großes Anime-Auge (w x h) mit Wimpernlinie, Iris-Verlauf und Glanzpunkt; x,y = linke obere Ecke"""
    I = hair_ramp(iris)
    for j in range(h):
        for i in range(w):
            ii = w - 1 - i if flip else i
            X, Y = x + ii, y + j
            if j == 0:
                px(cv, X, Y, lash)
            else:
                t = (j - 1) / max(1, h - 2)
                c = I[1] if t < 0.35 else (I[2] if t < 0.7 else I[3])
                if i == 0 and j >= h - 2:
                    c = white
                px(cv, X, Y, c)
    # Glanzpunkt
    gx = x + (w - 2 if flip else 1)
    px(cv, gx, y + 1, glint)
    # Wimpernschlag außen
    px(cv, (x - 1) if not flip else (x + w), y, lash)


def blush(cv, x, y, c=(250, 140, 150)):
    for i in range(3):
        if (x + i + y) % 2 == 0:
            blend_px(cv, x + i, y, c, 0.7)


# ------------------------------------------------------------ Rahmen
def _frame_relief(cv, plate_cols, top_plate, bot_plate):
    FH = np.zeros((H, W), np.float32); FMk = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            e = min(x, W - 1 - x, y, H - 1 - y)
            if e < 12:
                FMk[y, x] = True; FH[y, x] = [0, 1.5, 2.5, 3, 2.6, 1.8, 1.0, 1.2, 2.2, 2.6, 1.8, 0.6][e]
    for y in range(AY0 - 4, AY1 + 4):
        for x in range(AX0 - 4, AX1 + 4):
            e = min(x - (AX0 - 4), AX1 + 3 - x, y - (AY0 - 4), AY1 + 3 - y)
            if 0 <= e < 4:
                FMk[y, x] = True; FH[y, x] = [1.0, 2.4, 2.4, 1.0][e]

    def plate(x0, y0, x1, y1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                e = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y)
                FMk[y, x] = True
                FH[y, x] = [0.8, 2.2, 2.6, 2.0][e] if e < 4 else -9
    plate(*top_plate); plate(*bot_plate)
    for (cx, cy, sx, sy) in [(27, 25, 1, 1), (W - 1 - 27, 25, -1, 1), (27, 322, 1, -1), (W - 1 - 27, 322, -1, -1)]:
        for t in np.linspace(0, 3.5 * math.pi, 140):
            r = 9 * (1 - t / (4 * math.pi))
            x = int(round(cx + sx * math.cos(t) * r)); y = int(round(cy + sy * math.sin(t) * r))
            for dx in range(2):
                FMk[y, x + dx] = True; FH[y, x + dx] = 2.8
    Mplate = (FH == -9)
    FMk2 = FMk & ~Mplate
    relief(cv, FH, np.zeros((H, W), np.int32), [GOLD], FMk2, k=1.3, bias=0.02)
    for y, x in zip(*np.where(Mplate)):
        cv.px(x, y, plate_cols[1] if (x + y) % 2 else plate_cols[0])


def gold_text(cv, t, size, cx, cy, ramp=GOLD, shadow=(8, 4, 10), spacing=0):
    m = text_mask(t, size, spacing); mh, mw = m.shape
    y = int(round(cy - mh / 2)); x0 = int(cx - mw // 2)
    TH2 = np.zeros((H, W), np.float32); TM2 = np.zeros((H, W), bool)
    mm = np.pad(m, 1)
    dist_ = cv2.distanceTransform(mm.astype(np.uint8), cv2.DIST_L2, 3)[1:-1, 1:-1]
    for yy_ in range(mh):
        for xx_ in range(mw):
            if m[yy_, xx_]:
                TM2[y + yy_, x0 + xx_] = True; TH2[y + yy_, x0 + xx_] = min(dist_[yy_, xx_], 2.5)
    for yy_ in range(mh):
        for xx_ in range(mw):
            if m[yy_, xx_]:
                cv.px(x0 + xx_ + 1, y + yy_ + 2, shadow)
    relief(cv, TH2, np.zeros((H, W), np.int32), [ramp], TM2, k=1.2, bias=0.12, blur=0.4)
    return mw, mh


def fit_text_size(t, maxw, start=22, minsize=10, spacing=0):
    s = start
    while s > minsize and text_mask(t, s, spacing).shape[1] > maxw:
        s -= 1
    return s


def finish(cv, numeral, name, out, emblem=None, plate_cols=((24, 12, 30), (34, 18, 42)), name_size=22,
           numeral_size=24, emblem_col=None):
    """Rahmen + Beschriftung zeichnen und speichern.
    emblem(cv, x, y): kleines Symbol (ca. 5x5..7x7), wird links/rechts auf beide Platten gesetzt."""
    top_plate = (70, 8, 180, 40); bot_plate = (44, 304, 206, 342)
    _frame_relief(cv, plate_cols, top_plate, bot_plate)
    gold_text(cv, numeral, numeral_size, 125, 24)
    s = fit_text_size(name, (bot_plate[2] - bot_plate[0]) - 34, name_size)
    gold_text(cv, name, s, 125, 323)
    if emblem is not None:
        for (x, y) in [(78, 21), (167, 21), (49, 321), (196, 321)]:
            emblem(cv, x, y)
    path = os.path.join(OUTDIR, out + '.png')
    cv.img().resize((W * 3, H * 3), Image.NEAREST).save(path)
    return path


# kleine Plattensymbole (Mittelpunkt ca. x+2, y+2)
def _stamp(cv, x, y, rows, cols):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in cols:
                px(cv, x + i, y + j, cols[ch])


def emblem_star(cv, x, y):
    _stamp(cv, x, y - 1, ["..#..", "..#..", "#####", ".###.", ".#.#.", "#...#"],
           {'#': (255, 226, 120)})


def emblem_sun(cv, x, y):
    _stamp(cv, x - 1, y - 1, ["#..#..#", ".#.#.#.", "..###..", "###o###", "..###..", ".#.#.#.", "#..#..#"],
           {'#': (255, 206, 80), 'o': (255, 250, 200)})


def emblem_moon(cv, x, y):
    _stamp(cv, x, y - 1, ["..###", ".##..", "##...", "##...", "##...", ".##..", "..###"],
           {'#': (230, 226, 200)})


def emblem_heart(cv, x, y):
    _stamp(cv, x, y, [".#.#.", "#####", "#####", ".###.", "..#.."], {'#': (240, 70, 90)})


def emblem_skull(cv, x, y):
    _stamp(cv, x, y, [".###.", "#####", "#r#r#", "#####", ".#.#."], {'#': (236, 228, 206), 'r': (200, 40, 40)})


def emblem_diamond(cv, x, y, c=(120, 220, 255)):
    _stamp(cv, x, y - 1, ["..#..", ".###.", "#####", ".###.", "..#.."], {'#': c})


def emblem_generic(rows, cols):
    """eigenes Symbol: rows = Liste von Strings, cols = {zeichen: farbe}"""
    def f(cv, x, y):
        _stamp(cv, x - (len(rows[0]) - 5) // 2, y - (len(rows) - 5) // 2, rows, cols)
    return f


def overview(files, path, cols=6, scale=1):
    ims = [Image.open(f).convert('RGB') for f in files]
    w, h = 250 * scale, 350 * scale
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * (w + 6) + 6, rows * (h + 6) + 6), (12, 8, 18))
    for i, im in enumerate(ims):
        S.paste(im.resize((w, h), Image.NEAREST), (6 + (i % cols) * (w + 6), 6 + (i // cols) * (h + 6)))
    S.save(path)
    return path
