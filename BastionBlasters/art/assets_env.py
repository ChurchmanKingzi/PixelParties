"""Umgebung: Bodenkacheln, Wehrturm, Kern (32-px-Zellen). Wände, Tore und Räume baut castle.py, Möbel assets_props.py."""
from __future__ import annotations

import math
import random

from pixl import *


# --------------------------------------------------------------------------- Rauschen


def value_noise(x, y, period, seed):
    """wiederholbares Value-Noise (Kachelbar mit Periode `period` in Pixeln)"""
    cell = 8
    n = period // cell
    gx, gy = x / cell, y / cell
    x0, y0 = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - x0, gy - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)

    def h(ix, iy):
        return texture_noise(ix % n, iy % n, seed)

    a = h(x0, y0) * (1 - fx) + h(x0 + 1, y0) * fx
    b = h(x0, y0 + 1) * (1 - fx) + h(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + b * fy


# --------------------------------------------------------------------------- Böden


def tile_grass(seed=1, size=32):
    c = Canvas(size, size)
    for y in range(size):
        for x in range(size):
            v = value_noise(x, y, size, seed) * 0.7 + value_noise(x * 2, y * 2, size * 2, seed + 3) * 0.3
            idx = quant(v * 0.9 + 0.05, 2, 4, x, y, dw=0.18)
            c.put_ramp(x, y, 'grass', idx)
    rnd = random.Random(seed * 77)
    # Grasbüschel
    for _ in range(6):
        x, y = rnd.randint(3, size - 4), rnd.randint(3, size - 5)
        c.put_ramp(x, y, 'grass', 5)
        c.put_ramp(x - 1, y + 1, 'grass', 4)
        c.put_ramp(x + 1, y + 1, 'grass', 4)
        c.put_ramp(x, y + 1, 'grass', 1)
        c.put_ramp(x - 1, y + 2, 'grass', 1)
        c.put_ramp(x + 1, y + 2, 'grass', 1)
    # winzige Blumen
    for k in range(1 if seed % 2 else 0):
        x, y = rnd.randint(4, size - 6), rnd.randint(4, size - 6)
        col = rnd.choice([('gold', 4), ('skin', 5), ('purple', 4)])
        c.put_ramp(x, y, col[0], col[1])
        c.put_ramp(x + 1, y, col[0], col[1])
        c.put_ramp(x, y + 1, 'grass', 1)
    return c


def tile_cobble(seed=2, size=32, base='stone', tone=(2, 3), mortar=1, hi=4):
    """Pflaster (Innenhof): Voronoi-Platten, kachelbar"""
    c = Canvas(size, size)
    rnd = random.Random(seed)
    pts = []
    g = 4
    step = size // g
    for gy in range(g):
        for gx in range(g):
            pts.append((gx * step + step / 2 + rnd.uniform(-2.4, 2.4), gy * step + step / 2 + rnd.uniform(-2.4, 2.4)))
    slab = [[0] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            best, bi = 1e9, 0
            for i, (px, py) in enumerate(pts):
                dx = min(abs(x - px), size - abs(x - px))
                dy = min(abs(y - py), size - abs(y - py))
                d = dx * dx + dy * dy
                if d < best:
                    best, bi = d, i
            slab[y][x] = bi
    tones = [rnd.choice(tone) for _ in pts]
    for y in range(size):
        for x in range(size):
            s = slab[y][x]
            up = slab[(y - 1) % size][x]
            lf = slab[y][(x - 1) % size]
            dn = slab[(y + 1) % size][x]
            rt = slab[y][(x + 1) % size]
            if dn != s or rt != s:
                idx = mortar            # Fuge unten/rechts (Schatten)
            elif up != s or lf != s:
                idx = hi if tones[s] >= 3 else tone[-1]   # Lichtkante oben/links
            else:
                idx = tones[s]
                if texture_noise(x, y, seed) > 0.93:
                    idx = max(mortar + 1, idx - 1)        # Sprenkel
            c.put_ramp(x, y, base, idx)
    return c


def tile_planks(seed=3, size=32, tone=(2, 3, 4)):
    c = Canvas(size, size)
    rnd = random.Random(seed)
    for row in range(size // 8):
        y0 = row * 8
        x = -rnd.randint(0, 12)
        while x < size:
            ln = rnd.randint(14, 26)
            t = rnd.choice(tone)
            for yy in range(8):
                for xx in range(ln):
                    px = x + xx
                    if not (0 <= px < size):
                        continue
                    if yy == 7:
                        idx = 1
                    elif yy == 0:
                        idx = min(5, t + 1)
                    else:
                        idx = t
                        if yy in (3, 4) and texture_noise(px // 3, row, seed) > 0.62:
                            idx = t - 1       # Maserung
                    if xx == ln - 1:
                        idx = 1
                    c.put_ramp(px, y0 + yy, 'wood', idx)
            # Nägel
            for nx in (x + 2, x + ln - 4):
                if 0 <= nx < size:
                    c.put_ramp(nx, y0 + 3, 'wood', 5)
            x += ln
    return c


# --------------------------------------------------------------------------- Mauerblock


WALL_H = 10   # sichtbare Höhe der Vorderseite in px


# --------------------------------------------------------------------------- Turm


def tower(team='teamA', seed=5):
    """runder Wehrturm 40x72: Körper (Backstein-Zylinder) + Kegeldach in Teamfarbe + Wimpel"""
    W, H = 40, 72
    c = Canvas(W, H)
    cx = 20
    # Körper: Zylinder von y=34..66, Breite 28
    bx0, bx1 = cx - 14, cx + 13
    for y in range(34, 67):
        for x in range(bx0, bx1 + 1):
            u = (x - bx0 + 0.5) / (bx1 - bx0 + 1)           # 0..1 über den Zylinder
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot = nn * LIGHT[0] + nz * LIGHT[2]
            L = 0.16 + 0.84 * max(0.0, dot)
            idx = quant(L, 1, 4, x, y, dw=0.18)
            # Mauerwerk: Fugen alle 6 px, versetzt
            row = (y - 34) // 6
            yy = (y - 34) % 6
            if yy == 5:
                idx = max(1, idx - 1)
            else:
                off = 7 if row % 2 else 0
                if (x + off) % 14 == 0 and yy < 5:
                    idx = max(1, idx - 1)
            c.put_ramp(x, y, 'stone', idx)
    # untere Rundung
    for x in range(bx0, bx1 + 1):
        u = (x - bx0 + 0.5) / (bx1 - bx0 + 1)
        nn = u * 2 - 1
        yb = 66 + int(round(5 * (1 - math.sqrt(max(0.0, 1 - nn * nn)))) * -1) + 0
    # Schießscharte
    for y in range(44, 52):
        c.put_ramp(cx - 1, y, 'stone', 0)
        c.put_ramp(cx, y, 'stone', 0)
    c.put_ramp(cx + 1, 45, 'stone', 1)
    for x in (cx - 2, cx + 1):
        c.put_ramp(x, 44, 'stone', 4)
    # Kranz (Dachtraufe) unter dem Dach
    for x in range(cx - 17, cx + 17):
        u = (x - (cx - 17) + 0.5) / 34
        nn = u * 2 - 1
        nz = math.sqrt(max(0.0, 1 - nn * nn))
        dot = nn * LIGHT[0] + nz * LIGHT[2]
        L = 0.2 + 0.8 * max(0.0, dot)
        for y in (31, 32, 33):
            idx = quant(L, 1, 4, x, y)
            if y == 33:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
    # Kegeldach (Teamfarbe): Dreieck von (cx,6) zu Basis y=31 mit Breite 36
    for y in range(8, 32):
        t = (y - 8) / 23.0
        half = 2 + t * 16.5
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half)) / (2 * half + 0.001)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot = nn * LIGHT[0] + nz * LIGHT[2]
            L = 0.18 + 0.82 * max(0.0, dot)
            idx = quant(L, 1, 4, x, y, dw=0.16)
            # Dachziegel-Reihen
            r = (y - 8) // 4
            if (y - 8) % 4 == 3:
                idx = max(1, idx - 1)
            elif ((x + (2 if r % 2 else 0)) % 5) == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, team, idx)
    # Spitze und Wimpel
    for y in range(2, 9):
        c.put_ramp(cx, y, 'wood', 3)
    c.put_ramp(cx, 1, 'gold', 5)
    c.put_ramp(cx, 2, 'gold', 4)
    for k, (dx, dy) in enumerate([(1, 3), (2, 3), (3, 3), (4, 4), (1, 4), (2, 4), (3, 4), (1, 5), (2, 5)]):
        c.put_ramp(cx + dx, dy, 'gold' if k < 4 else 'gold', 4 if k < 4 else 3)
    c.outline()
    return c


# --------------------------------------------------------------------------- Tor


# --------------------------------------------------------------------------- Kern


def core(glow='purple', ring_team='teamA'):
    """Kern: Sockelscheibe mit Runenring + schwebender Kristall, 64x84"""
    W, H = 64, 84
    c = Canvas(W, H)
    cx = 32
    # unterer Sockel (große Scheibe)
    ellipse(c, cx, 66, 29, 13, 'stone', lo=1, hi=4, ambient=0.3, flatness=0.35)
    for x in range(4, 60):
        for y in range(66, 79):
            pass
    # Kante der Scheibe (Dicke): zweite Ellipse darunter
    for y in range(67, 76):
        for x in range(cx - 29, cx + 29):
            dx = (x + 0.5 - cx) / 29.0
            dy = (y + 0.5 - 66) / 13.0
            if dx * dx + dy * dy <= 1.0 and c.px[y, x, 3] == 0:
                pass
    # Runenring auf der Scheibe
    for ang in range(0, 360, 20):
        a = math.radians(ang)
        x = cx + math.cos(a) * 22
        y = 66 + math.sin(a) * 9.5
        c.put_ramp(int(x), int(y), ring_team, 4)
        c.put_ramp(int(x), int(y) + 1, ring_team, 2)
    # obere Scheibe
    ellipse(c, cx, 64, 18, 8, 'stone', lo=1, hi=5, ambient=0.3, flatness=0.25)
    # Glühen unter dem Kristall (Dither-Ellipse)
    for y in range(48, 72):
        for x in range(cx - 18, cx + 18):
            dx = (x + 0.5 - cx) / 17.0
            dy = (y + 0.5 - 62) / 9.0
            d = dx * dx + dy * dy
            if d < 1.0 and c.px[y, x, 3]:
                if d < 0.35:
                    c.put_ramp(x, y, glow, 3 if (x + y) % 2 == 0 else 2)
                elif d < 0.7 and (x + y) % 2 == 0:
                    c.put_ramp(x, y, glow, 2)
    # Kristall: Sechskant-Prisma mit Spitzen (Facetten)
    def facet(poly, ramp, idx_fn):
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        for y in range(min(ys), max(ys) + 1):
            for x in range(min(xs), max(xs) + 1):
                if point_in_poly(x + 0.5, y + 0.5, poly):
                    c.put_ramp(x, y, ramp, idx_fn(x, y))
    top = (cx, 22)
    bot = (cx, 61)
    L1 = (cx - 9, 31)
    L2 = (cx - 9, 49)
    R1 = (cx + 9, 31)
    R2 = (cx + 9, 49)
    M1 = (cx, 35)
    M2 = (cx, 53)
    span = 39.0
    facet([top, L1, L2, bot, M2, M1], glow, lambda x, y: quant(0.55 + 0.45 * (1 - (y - 22) / span) * 0.8, 2, 5, x, y))
    facet([top, M1, M2, bot, R2, R1], glow, lambda x, y: quant(0.15 + 0.35 * (1 - (y - 22) / span), 1, 4, x, y))
    for y in range(35, 54):
        c.put_ramp(cx, y, glow, 5)
    for k in range(9):
        c.put_ramp(cx - 6, 33 + k, glow, 5)
    c.put_ramp(cx - 4, 27, glow, 5)
    c.put_ramp(cx - 3, 26, glow, 5)
    for (x, y) in [(10, 36), (52, 30), (46, 52), (16, 54), (26, 18), (40, 20)]:
        c.put_ramp(x, y, glow, 5)
        c.put_ramp(x + 1, y, glow, 3)
        c.put_ramp(x, y - 1, glow, 3)
        c.put_ramp(x, y + 1, glow, 3)
        c.put_ramp(x - 1, y, glow, 3)
    c.outline()
    return c


# --------------------------------------------------------------------------- Räume (64x32)
