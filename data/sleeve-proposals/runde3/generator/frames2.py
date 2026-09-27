# -*- coding: utf-8 -*-
"""Rahmen mit unterschiedlichen Bauformen (nicht nur Farben) für die Runde-3-Sleeves und die Shop-Sleeves.

Alle Rahmen entstehen im 125×175-Raster (1 Rahmenpixel = 6 Bildpixel) und werden über das Sleeve gelegt.
Bauformen: ornate, double, twist, industrial, arch, icicle, bamboo, moulding, card, bone, cosmic, meander,
wave, stone, filigree.  Paletten/Edelsteine aus frames.py.
Aufruf: python3 frames2.py [nr ...]      – Runde 3 → runde3/final/<Name>.png
        python3 frames2.py shop          – Shop-Sleeves 2–15 → data/shop/sleeves/sleeveN.png (Original: git)
"""
import os, sys, glob, math, hashlib
import numpy as np
from PIL import Image
from frames import PAL, GEM, SRC, DST

FW, FH, S = 125, 175, 6
ROOT = os.path.abspath(os.path.join(SRC, '..', '..', '..'))
SHOP = os.path.join(ROOT, 'data', 'shop', 'sleeves')


def h(*v):
    return int(hashlib.md5(repr(v).encode()).hexdigest()[:8], 16)


class F:
    def __init__(self, pal, gem='ruby', gem2=None, w=FW, hh=FH):
        self.W, self.H = w, hh
        self.O, self.D, self.M, self.L, self.G = [np.array(c) for c in PAL[pal]]
        self.pal = pal; self.gem = gem; self.gem2 = gem2 or gem
        self.rgb = np.zeros((hh, w, 3), np.uint8); self.a = np.zeros((hh, w), np.uint8)
        yy, xx = np.mgrid[0:hh, 0:w]; self.yy, self.xx = yy, xx
        self.dist = np.minimum.reduce([xx, yy, w - 1 - xx, hh - 1 - yy])
        self.side = np.argmin(np.stack([yy, xx, hh - 1 - yy, w - 1 - xx]), 0)
        self.lit = (self.side == 0) | (self.side == 1)
        self.along = np.where((self.side == 0) | (self.side == 2), xx, yy)

    def put(self, m, c):
        self.rgb[m] = c; self.a[m] = 1

    def px(self, x, y, c):
        if 0 <= x < self.W and 0 <= y < self.H: self.rgb[y, x] = c; self.a[y, x] = 1

    def bevel_band(self, w, o=0):
        d = self.dist - o; b = (d >= 0) & (d < w)
        self.put(b, self.M)
        self.put(b & (d == 0), self.O); self.put(b & (d == w - 1), self.O)
        if w >= 4:
            self.put(b & (d == 1) & self.lit, self.L); self.put(b & (d == 1) & ~self.lit, self.D)
            self.put(b & (d == w - 2) & self.lit, self.D); self.put(b & (d == w - 2) & ~self.lit, self.L)
        return b, d

    def shadow(self, depth=1):
        inner = (self.a == 0)
        grown = inner.copy()
        m = self.a == 1
        for _ in range(depth):
            g = np.zeros_like(m)
            g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
            m = m | g
        self.a[(m) & inner] = 2

    def gem_at(self, cx, cy, r, g=None):
        cols = GEM[g or self.gem]
        for y in range(cy - r - 1, cy + r + 2):
            for x in range(cx - r - 1, cx + r + 2):
                d = abs(x - cx) + abs(y - cy)
                if d == r + 1: self.px(x, y, self.O)
                elif d <= r:
                    s_ = (x - cx) + (y - cy)
                    self.px(x, y, cols[2] if s_ < 0 else (cols[0] if s_ > 0 and d == r else cols[1]))
        if r > 1: self.px(cx - 1, cy - 1, (255, 255, 255))

    def disc(self, cx, cy, r, fill=None, rim=None, shade=True):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = math.hypot(x + .5 - cx, y + .5 - cy)
                if d <= r:
                    c = fill if fill is not None else self.M
                    if shade and d > r - 1.2: c = rim if rim is not None else self.O
                    elif shade and (x - cx) + (y - cy) < -r * 0.6: c = self.L
                    self.px(x, y, c)

    def plate(self, x0, y0, w, hh):
        for y in range(y0, y0 + hh):
            for x in range(x0, x0 + w):
                e = min(x - x0, y - y0, x0 + w - 1 - x, y0 + hh - 1 - y)
                c = self.O if e == 0 else ((self.L if (y - y0 == 1 or x - x0 == 1) else self.D) if e == 1 else self.M)
                self.px(x, y, c)

    def corners(self):
        return [(0, 0, 1, 1), (self.W - 1, 0, -1, 1), (self.W - 1, self.H - 1, -1, -1), (0, self.H - 1, 1, -1)]


# ------------------------------------------------------------------ Bauformen
def ornate(f):
    b, d = f.bevel_band(5)
    mid = b & (d == 2)
    f.put(mid & (f.along % 3 == 0), f.G)
    C = 9
    for k, (cx, cy) in enumerate([(0, 0), (f.W - C, 0), (f.W - C, f.H - C), (0, f.H - C)]):
        f.plate(cx, cy, C, C); f.gem_at(cx + 4, cy + 4, 2, f.gem if k % 2 == 0 else f.gem2)
    for (cx, cy, hz) in [(f.W // 2, 3, 1), (f.W // 2, f.H - 4, 1), (3, f.H // 2, 0), (f.W - 4, f.H // 2, 0)]:
        f.plate(cx - 7, cy - 3, 15, 7) if hz else f.plate(cx - 3, cy - 7, 7, 15)
        f.gem_at(cx, cy, 1, f.gem2 if hz else f.gem)
    f.shadow()


def double(f):
    f.bevel_band(3)
    d = f.dist; f.a[(d == 3)] = 2
    b = (d >= 4) & (d < 6); f.put(b & (d == 4), f.L); f.put(b & (d == 5), f.O)
    for (x, y, sx, sy) in f.corners():
        for j in range(8):
            for i in range(8):
                e = min(i, j, 7 - i, 7 - j)
                f.px(x + sx * i, y + sy * j, f.O if e == 0 else (f.D if e == 1 else f.M))
        f.gem_at(x + sx * 4 - (1 if sx < 0 else 0), y + sy * 4 - (1 if sy < 0 else 0), 1)
    for (cx, cy) in [(f.W // 2, 1), (f.W // 2, f.H - 2), (1, f.H // 2), (f.W - 2, f.H // 2)]:
        f.gem_at(cx, cy, 1, f.gem2)
    f.shadow()


def twist(f):
    b, d = f.bevel_band(5)
    inner = b & (d >= 1) & (d <= 3)
    stripe = ((f.along + d) % 4) < 2
    f.put(inner & stripe, f.L); f.put(inner & ~stripe, f.D)
    f.put(inner & ((f.along + d) % 4 == 0), f.G)
    for (x, y, sx, sy) in f.corners():
        cx, cy = x + sx * 5.5, y + sy * 5.5
        f.disc(cx, cy, 6.5); f.gem_at(int(cx - (1 if sx < 0 else 0)), int(cy - (1 if sy < 0 else 0)), 2)
    f.shadow()


def industrial(f):
    b, d = f.bevel_band(6)
    f.put(b & (d == 3) & (f.along % 10 == 5), f.G); f.put(b & (d == 3) & (f.along % 10 == 6), f.O)
    for (x, y, sx, sy) in f.corners():
        for j in range(20):
            for i in range(20):
                if i + j < 18:
                    X, Y = x + sx * i, y + sy * j
                    e = 17 - (i + j)
                    f.px(X, Y, f.O if e == 0 else (f.L if e == 1 else f.M))
        for (i, j) in [(8, 3), (3, 8), (6, 6)]:
            f.px(x + sx * i, y + sy * j, f.G); f.px(x + sx * (i + 1), y + sy * (j + 1), f.O)
    f.shadow()


def arch(f, height=22):
    """Flacher Korbbogen oben (Zwickel mit Maßwerk-Kreisen), Schlussstein mit Stein, Sockel unten."""
    f.bevel_band(4)
    x0, x1 = 4, f.W - 5; cx = (x0 + x1) / 2; hw = (x1 - x0) / 2 + 0.5; ys = 4 + height
    inside = np.zeros_like(f.a, bool)
    for y in range(4, ys + 1):
        for x in range(x0, x1 + 1):
            e = ((x + .5 - cx) / hw) ** 2 + ((ys - y - .5) / height) ** 2
            if e > 1:
                f.px(x, y, f.D if (x * 3 + y) % 7 else f.M)
            elif e > 0.93:
                f.px(x, y, f.O)
            elif e > 0.84:
                f.px(x, y, f.L if x < cx else f.G)
    for sx_, cxx in ((1, x0 + 7), (-1, x1 - 7)):
        f.disc(cxx + .5, 4 + 6.5, 3.4, fill=f.G, rim=f.O)
        f.disc(cxx + .5, 4 + 6.5, 1.4, fill=f.O, rim=f.O)
    f.gem_at(f.W // 2, 3, 2)
    b = (f.H - 1 - f.yy) < 7
    f.put(b, f.M); f.put(b & ((f.H - 1 - f.yy) == 6), f.O); f.put(b & ((f.H - 1 - f.yy) == 5), f.L)
    f.put(b & ((f.H - 1 - f.yy) == 0), f.O); f.put(b & ((f.H - 1 - f.yy) == 3) & (f.xx % 6 == 3), f.G)
    f.shadow()


def icicle(f):
    f.bevel_band(4)
    f.put((f.dist >= 1) & (f.dist <= 2) & (np.random.default_rng(3).random(f.dist.shape) < 0.25), f.G)
    x = 5
    while x < f.W - 5:
        wdt = 3 + h(x) % 3; ln = 3 + h(x, 1) % 8
        for j in range(ln):
            half = max(0, (wdt // 2) - j * wdt // (2 * ln + 1))
            for i in range(-half, half + 1):
                f.px(x + i, 4 + j, f.L if i < 0 else (f.G if i == 0 else f.M))
            f.px(x - half - 1, 4 + j, f.O); f.px(x + half + 1, 4 + j, f.O)
        f.px(x, 4 + ln, f.O)
        x += wdt + 2 + h(x, 2) % 3
    for x in range(4, f.W - 4):   # Schneewulst unten
        hgt = 2 + int(1.5 * (1 + math.sin(x * 0.45)))
        for j in range(hgt): f.px(x, f.H - 5 - j, f.G if j == hgt - 1 else f.L)
        f.px(x, f.H - 5 - hgt, f.O)
    for (x, y, sx, sy) in f.corners():
        cx, cy = x + sx * 6, y + sy * 6
        for j in range(-7, 8):
            for i in range(-7, 8):
                if abs(i) + abs(j) * 0.55 <= 5 or abs(i) * 0.55 + abs(j) <= 5:
                    d_ = min(5 - abs(i) - abs(j) * 0.55, 5 - abs(i) * 0.55 - abs(j))
                    f.px(cx + i, cy + j, f.G if (i <= 0 and j <= 0 and d_ > 1) else (f.O if d_ < 0.8 else f.L))
    f.shadow()


def bamboo(f):
    O, D, M, L, G = f.O, f.D, f.M, f.L, f.G
    prof = [O, L, G, M, D, O]
    for d in range(6):
        f.put((f.dist == d) & ((f.side == 0) | (f.side == 2)), prof[d] if True else M)
        f.put((f.dist == d) & ((f.side == 1) | (f.side == 3)), prof[d])
    b = f.dist < 6
    f.put(b & (f.along % 17 == 0) & (f.dist > 0) & (f.dist < 5), O)
    f.put(b & (f.along % 17 == 1) & (f.dist > 0) & (f.dist < 5), G)
    tie = np.array(PAL['wood'][3]); tie_d = np.array(PAL['wood'][1])
    for (x, y, sx, sy) in f.corners():
        for j in range(9):
            for i in range(9):
                if i == j or i == 8 - j or (i + j) % 4 == 0 and i < 8 and j < 8 and (i in (2, 6) or j in (2, 6)):
                    f.px(x + sx * i, y + sy * j, tie if (i + j) % 2 else tie_d)
        for k in range(9):
            f.px(x + sx * k, y + sy * 8, O); f.px(x + sx * 8, y + sy * k, O)
    f.shadow()


def moulding(f):
    gold = [np.array(c) for c in PAL['gold']]
    prof = [f.O, f.D, f.M, f.L, f.G, f.M, f.D, gold[3], gold[1], f.O]
    for d, c in enumerate(prof):
        m = f.dist == d
        c2 = c
        if d in (3, 4) and True:
            f.put(m & f.lit, c); f.put(m & ~f.lit, f.M if d == 3 else f.D)
        else:
            f.put(m, c2)
    # Gehrungsfugen
    for (x, y, sx, sy) in f.corners():
        for k in range(10): f.px(x + sx * k, y + sy * k, f.O)
    f.shadow()


def card(f):
    b, d = f.bevel_band(5)
    R = 13
    for (x, y, sx, sy) in f.corners():
        cx, cy = x + sx * (5 + R), y + sy * (5 + R)
        for j in range(5 + R + 1):
            for i in range(5 + R + 1):
                X, Y = x + sx * i, y + sy * j
                if math.hypot(X + .5 - cx, Y + .5 - cy) > R and i >= 4 and j >= 4 and i < 5 + R and j < 5 + R:
                    edge = math.hypot(X + .5 - cx, Y + .5 - cy) < R + 1.1
                    f.px(X, Y, f.O if edge else f.M)
    # goldene Innenkontur, folgt den abgerundeten Ecken
    m = f.a == 1
    g = np.zeros_like(m); g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
    f.put(g & ~m, f.G)
    for (x, y, sx, sy) in f.corners():
        f.gem_at(x + sx * 7, y + sy * 7, 2)
    for (cx, cy) in [(f.W // 2, 2), (f.W // 2, f.H - 3), (2, f.H // 2), (f.W - 3, f.H // 2)]:
        f.gem_at(cx, cy, 1, f.gem2)
    f.shadow()


def bone(f):
    O, D, M, L, G = f.O, f.D, f.M, f.L, f.G
    for d, c in enumerate([O, L, M, D, O]):
        f.put((f.dist == d + 1), c)
    f.put(f.dist == 0, f.O * 0 + np.array(PAL['bone'][0]) // 2)
    for (x, y, sx, sy) in f.corners():
        for (ox, oy) in [(4, 1.5), (1.5, 4), (7, 3), (3, 7)]:
            f.disc(x + sx * ox + (0.5 if sx < 0 else 0.5), y + sy * oy + 0.5, 3.2)
    for (cx, cy, hz) in [(f.W // 2, 3, 1), (f.W // 2, f.H - 4, 1), (3, f.H // 2, 0), (f.W - 4, f.H // 2, 0)]:
        for s in (-4, 4):
            f.disc(cx + (s if hz else 0) + .5, cy + (0 if hz else s) + .5, 3)
        f.gem_at(cx, cy, 1)
    f.shadow()


def cosmic(f):
    b, d = f.bevel_band(3)
    rng = np.random.default_rng(11)
    for _ in range(90):
        x, y = rng.integers(0, f.W), rng.integers(0, f.H)
        if min(x, y, f.W - 1 - x, f.H - 1 - y) in (0, 1, 2, 3, 4) and f.a[y, x] == 1 or min(x, y, f.W - 1 - x, f.H - 1 - y) < 3:
            f.px(x, y, f.G)
    for (x, y, sx, sy) in f.corners():
        cx, cy = x + sx * 7.5, y + sy * 7.5
        col = np.array(GEM[f.gem][1]); lit = np.array(GEM[f.gem][2]); dk = np.array(GEM[f.gem][0])
        for j in range(-12, 13):   # Ring
            for i in range(-12, 13):
                e = (i / 10.5) ** 2 + (j / 3.2) ** 2
                if 0.75 < e < 1.1 and not (j < 0 and i * i + j * j < 36):
                    f.px(int(cx + i), int(cy + j), f.G if e < 0.95 else f.O)
        f.disc(cx, cy, 5.5, fill=col, rim=dk)
        f.px(int(cx) - 2, int(cy) - 2, lit)
        for j in range(-12, 13):
            for i in range(-12, 13):
                e = (i / 10.5) ** 2 + (j / 3.2) ** 2
                if 0.75 < e < 1.1 and j >= 0:
                    f.px(int(cx + i), int(cy + j), f.G if e < 0.95 else f.O)
    for (cx, cy) in [(f.W // 2, 1), (f.W // 2, f.H - 2), (1, f.H // 2), (f.W - 2, f.H // 2)]:
        for k in range(-3, 4):
            f.px(cx + k, cy, f.G); f.px(cx, cy + k, f.G)
        f.px(cx, cy, (255, 255, 255))
    f.shadow()


KEY = ["11111111", "10000001", "10111101", "10100101"]   # Mäander-Grundmuster (4 Zeilen, Periode 8)
KEY = ["11111110", "00000010", "11110010", "10010010", "10000010", "11111110"]


def meander(f):
    b, d = f.bevel_band(8)
    inner = b & (d >= 1) & (d <= 6)
    gold = np.array(PAL['gold'][2]) if f.pal in ('lacquer', 'ebony', 'gothic', 'jade') else f.G
    for y, x in zip(*np.where(inner)):
        r = d[y, x] - 1; c = f.along[y, x] % 8
        if KEY[r][c] == '1': f.rgb[y, x] = gold
    for (x, y, sx, sy) in f.corners():
        x0 = x if sx > 0 else x - 9; y0 = y if sy > 0 else y - 9
        f.plate(x0, y0, 10, 10); f.gem_at(x0 + 4 + (1 if sx < 0 else 0), y0 + 4 + (1 if sy < 0 else 0), 2)
    f.shadow()


def wave(f):
    b, d = f.bevel_band(4)
    for x in range(f.W):
        for (y0, sgn) in [(4, 1), (f.H - 5, -1)]:
            hgt = int(2 + 2 * math.sin(x * 2 * math.pi / 12))
            for j in range(max(0, hgt)):
                f.px(x, y0 + sgn * j, f.G if j == hgt - 1 else f.L)
    for y in range(f.H):
        for (x0, sgn) in [(4, 1), (f.W - 5, -1)]:
            wdt = int(1 + 1.5 * (1 + math.sin(y * 2 * math.pi / 14)))
            for j in range(wdt):
                f.px(x0 + sgn * j, y, f.G if j == wdt - 1 else f.L)
    for (x, y, sx, sy) in f.corners():
        cx, cy = x + sx * 7, y + sy * 7
        for j in range(-6, 7):   # Muschel: Fächer
            for i in range(-6, 7):
                r_ = math.hypot(i, j)
                if r_ <= 6 and (j * sy <= 1):
                    ang = math.atan2(j, i)
                    c = f.O if r_ > 5.2 else (f.L if int((ang + 4) * 3) % 2 else f.M)
                    f.px(cx + i, cy + j, c)
        f.gem_at(cx, cy + sy * 1, 1, 'pearl')
    f.shadow()


def stone(f):
    O, D, M, L = f.O, f.D, f.M, f.L
    blk = 9
    for y in range(f.H):
        for x in range(f.W):
            d = f.dist[y, x]; al = f.along[y, x]; s = f.side[y, x]
            k = al // blk
            depth = 5 + h(s, k) % 4
            if d < depth:
                row = 0 if d < 3 else 1
                off = (blk // 2) if row else 0
                edge = ((al + off) % blk == 0) or d == 3 or d == depth - 1 or d == 0
                c = O if edge else (L if (d == 1 or d == 4) and f.lit[y, x] else (D if (d in (2, depth - 2)) and not f.lit[y, x] else M))
                if not edge and h(x, y) % 9 == 0: c = D
                f.px(x, y, c)
    for (x, y, sx, sy) in f.corners():
        x0 = x if sx > 0 else x - 11; y0 = y if sy > 0 else y - 11
        f.plate(x0, y0, 12, 12)
    f.shadow()


def filigree(f):
    f.bevel_band(3)
    gcol = f.G
    for (x, y, sx, sy) in f.corners():
        # Spiralranke im Bildwinkel
        for (r, w_) in [(9, 1), (5, 1)]:
            cx, cy = x + sx * (3 + r), y + sy * (3 + r)
            for t in np.linspace(0, math.pi * 1.5, 80):
                X = cx - sx * r * math.cos(t) ; Y = cy - sy * r * math.sin(t)
                X, Y = int(round(X)), int(round(Y))
                if min(X, Y, f.W - 1 - X, f.H - 1 - Y) >= 3:
                    f.px(X, Y, gcol)
                    f.px(X + sx, Y + sy, f.O)
        f.gem_at(x + sx * 4, y + sy * 4, 2)
    for (cx, cy, hz) in [(f.W // 2, 3, 1), (f.W // 2, f.H - 4, 1), (3, f.H // 2, 0), (f.W - 4, f.H // 2, 0)]:
        f.gem_at(cx, cy, 2, f.gem2)
        for s in (-1, 1):   # Blätter
            for k in range(1, 7):
                X = cx + s * (k + 3) if hz else cx + (1 if cx < 5 else -1) * (k // 3)
                Y = cy + (1 if cy < 5 else -1) * (k // 3) if hz else cy + s * (k + 3)
                f.px(X, Y, gcol)
    f.shadow()


FORMS = dict(ornate=ornate, double=double, twist=twist, industrial=industrial, arch=arch, icicle=icicle,
             bamboo=bamboo, moulding=moulding, card=card, bone=bone, cosmic=cosmic, meander=meander,
             wave=wave, stone=stone, filigree=filigree)

# Nr → (Name, Bauform, Palette, Stein[, Stein2])
R3 = {
    1: ('Lunar New Year', 'meander', 'lacquer', 'topaz'), 2: ('Heavenly Throne', 'arch', 'lacquer', 'jade'),
    3: ('Guardian Niu', 'ornate', 'bronze', 'ruby'), 4: ('Yokai Parade', 'bamboo', 'bamboo', 'ruby'),
    5: ('Moonlit Duel', 'card', 'ebony', 'ruby', 'sapphire'), 6: ('Fox Pond', 'filigree', 'silver', 'rose'),
    7: ('Porthole', 'industrial', 'brass', 'sapphire'), 8: ('Into the Deep', 'wave', 'sea', 'topaz'),
    9: ('Sirens Song', 'twist', 'sea', 'pearl'), 10: ('Luau', 'bamboo', 'wood', 'lava'),
    11: ('Fire and Storm', 'card', 'gold', 'lava', 'cyan'), 12: ('Aquatic Crest', 'ornate', 'silver', 'sapphire'),
    13: ('Count of the Deep', 'arch', 'gothic', 'ruby'), 14: ('Lava Diver', 'industrial', 'iron', 'lava'),
    15: ('Steam Crest', 'twist', 'brass', 'topaz'), 16: ('Dwarf King', 'stone', 'stone', 'ruby'),
    17: ('Hydra Duel', 'icicle', 'ice', 'sapphire'), 18: ('White Parade', 'double', 'ice', 'ruby'),
    19: ('Poison Card', 'card', 'gold', 'emerald', 'amethyst'), 20: ('T-Rex Breach', 'stone', 'stone', 'lava'),
    21: ('Skulltop Storm', 'double', 'iron', 'cyan'), 22: ('The Summoning', 'arch', 'gothic', 'magenta'),
    23: ('Generals Duel', 'meander', 'gold', 'ruby'), 24: ('Crossing the Alps', 'icicle', 'ice', 'amber'),
    25: ('Blackstaches Bow', 'twist', 'wood', 'topaz'), 26: ('Weapon Storm', 'industrial', 'iron', 'ruby'),
    27: ('Rift in the Sky', 'cosmic', 'cosmic', 'ruby'), 28: ('Fun Fun Circus', 'twist', 'lacquer', 'topaz'),
    29: ('Dragon Flight', 'filigree', 'bronze', 'emerald', 'sapphire'), 30: ('Close Encounter', 'cosmic', 'cosmic', 'lime'),
    31: ('Rise of the Phoenix', 'filigree', 'gold', 'lava'), 32: ('Ladder to the Sky', 'double', 'wood', 'sapphire'),
    33: ('Life Serum', 'industrial', 'iron', 'rose'), 34: ('Blood Eclipse', 'filigree', 'gothic', 'ruby'),
    35: ('Rotten Mastermind', 'ornate', 'gothic', 'amethyst'), 36: ('Vanitas', 'moulding', 'wood', 'ruby'),
    37: ('Travelers Portal', 'cosmic', 'cosmic', 'topaz'), 38: ('Class Photo', 'moulding', 'wood', 'ruby'),
    39: ('Inferno', 'stone', 'iron', 'lava'), 40: ('Angel Mirror', 'filigree', 'silver', 'topaz', 'onyx'),
    41: ('Raise the Minions', 'bone', 'bone', 'lime'), 42: ('Slime Drive', 'bamboo', 'bamboo', 'lime'),
    43: ('Cybug Case', 'double', 'gold', 'amber'), 44: ('Dragons Hoard', 'ornate', 'gold', 'emerald'),
    45: ('Last Round', 'moulding', 'wood', 'amber'), 46: ('Midnight in London', 'double', 'iron', 'topaz'),
    47: ('Frozen Throne', 'icicle', 'ice', 'cyan'), 48: ('Trojan Gift', 'stone', 'stone', 'topaz'),
    49: ('Curtain Call', 'arch', 'gold', 'ruby'), 50: ('Nile Night', 'meander', 'gold', 'sapphire'),
    51: ('Circle of Fuses', 'meander', 'lacquer', 'amber'), 52: ('Trident Shrine', 'wave', 'sea', 'amethyst'),
    53: ('Dragon Pilot', 'industrial', 'brass', 'lava'), 54: ('Witching Hour', 'twist', 'wood', 'lime'),
    55: ('Twin Reapers', 'arch', 'ebony', 'topaz'), 56: ('Heart Bow', 'card', 'silver', 'rose'),
    57: ('Exploding Skull', 'bone', 'bone', 'amber'), 58: ('Mammoth Trek', 'bone', 'bone', 'sapphire'),
    59: ('Qinglong Storm', 'meander', 'bronze', 'jade'), 60: ('Bone Wyrm', 'bone', 'bone', 'lava'),
}
# Shop-Sleeves 2–15 (Datei, Bauform, Palette, Stein[, Stein2], Einzug in Rahmenpixeln bei schwarzem Rand)
SHOP_FR = {
    2: ('moulding', 'iron', 'ruby'), 3: ('ornate', 'sapphire_x', 'sapphire'), 4: ('wave', 'sea', 'ruby'),
    5: ('cosmic', 'cosmic', 'ruby'), 6: ('double', 'ice', 'sapphire'), 7: ('filigree', 'gold', 'rose'),
    8: ('card', 'silver', 'ruby', 'onyx'), 9: ('filigree', 'silver', 'topaz'), 10: ('twist', 'silver', 'amethyst'),
    11: ('moulding', 'wood', 'topaz'), 12: ('arch', 'stone', 'sapphire'), 13: ('arch', 'gothic', 'lime'),
    14: ('ornate', 'gold', 'ruby'), 15: ('stone', 'stone', 'lava'),
}
PAL['sapphire_x'] = [(10, 16, 60), (30, 50, 150), (50, 90, 220), (110, 150, 250), (220, 235, 255)]


def build(form, pal, gem, gem2=None, w=FW, hh=FH):
    f = F(pal, gem, gem2, w, hh); FORMS[form](f); return f.rgb, f.a


def apply(src_path, out_path, form, pal, gem, gem2=None, inset=0):
    im = np.array(Image.open(src_path).convert('RGB')).astype(np.float32)
    if inset:
        rgb = np.zeros((FH, FW, 3), np.uint8); a = np.zeros((FH, FW), np.uint8)
        # äußerer Passepartout-Rand in dunkler Rahmenfarbe
        O, D, M = [np.array(c) for c in PAL[pal][:3]]
        yy, xx = np.mgrid[0:FH, 0:FW]; dist = np.minimum.reduce([xx, yy, FW - 1 - xx, FH - 1 - yy])
        rgb[:] = D; rgb[dist == 0] = O; rgb[(dist % 3 == 1) & (dist < inset)] = M
        a[dist < inset] = 1
        r2, a2 = build(form, pal, gem, gem2, FW - 2 * inset, FH - 2 * inset)
        sub = a2 > 0
        rgb[inset:FH - inset, inset:FW - inset][sub] = r2[sub]
        a[inset:FH - inset, inset:FW - inset][sub] = a2[sub]
    else:
        rgb, a = build(form, pal, gem, gem2)
    R = np.repeat(np.repeat(rgb, S, 0), S, 1).astype(np.float32)
    A = np.repeat(np.repeat(a, S, 0), S, 1)
    out = im.copy(); out[A == 1] = R[A == 1]; out[A == 2] = im[A == 2] * 0.45
    Image.fromarray(out.astype(np.uint8)).save(out_path, optimize=True)
    return out_path


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == 'shop':
        import subprocess
        for n, (form, pal, gem, *rest) in SHOP_FR.items():
            orig = os.path.join(SHOP, f'sleeve{n}.png')
            # immer vom Original aus git rendern (idempotent)
            data = subprocess.run(['git', '-C', ROOT, 'show', f'bd5a7c5:data/shop/sleeves/sleeve{n}.png'],
                                  capture_output=True, check=True).stdout
            tmp = os.path.join('/tmp', f'orig_sleeve{n}.png'); open(tmp, 'wb').write(data)
            print(apply(tmp, orig, form, pal, gem, rest[0] if rest else None, inset=12 if n == 2 else 0))
    else:
        nrs = [int(x) for x in args] or sorted(R3)
        for old in glob.glob(os.path.join(DST, '*.png')) if not args else []:
            os.remove(old)
        for n in nrs:
            name, form, pal, gem, *rest = R3[n]
            src = [s for s in glob.glob(os.path.join(SRC, f'{n:02d}_*.png')) if not os.path.basename(s).startswith('00')]
            print(apply(src[0], os.path.join(DST, f'{name}.png'), form, pal, gem, rest[0] if rest else None))
