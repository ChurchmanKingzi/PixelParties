"""Umgebung: Böden, Mauern, Turm, Tor, Kern, Räume (schräge Draufsicht, 32-px-Zellen)."""
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


def wall_block(seed=4, trim=None, moss=True):
    """Mauerblock 32 x (32+WALL_H): Oberseite 32x32 + Vorderseite (schräge Draufsicht)"""
    H = WALL_H
    c = Canvas(32, 32 + H)
    rnd = random.Random(seed)
    bot = 32 + H - 1
    rows = H // 5
    # --- Vorderseite: Quader 14x5 im Verband
    for row in range(rows):
        y0 = 32 + row * 5
        off = 7 if row % 2 else 0
        for x in range(-7, 32, 14):
            bx = x + off
            t_ = rnd.choice([2, 3, 3])
            for yy in range(5):
                for xx in range(14):
                    px = bx + xx
                    if not (0 <= px < 32):
                        continue
                    py = y0 + yy
                    if yy == 4 or xx == 13:
                        idx = 1                              # Fuge
                    elif yy == 0:
                        idx = 5 if row == 0 else min(5, t_ + 1)   # Lichtkante
                    elif xx == 0:
                        idx = min(5, t_ + 1)
                    else:
                        idx = t_ - (1 if (row == rows - 1 and yy > 2) else 0)
                        if texture_noise(px, py, seed) > 0.9:
                            idx = max(1, idx - 1)
                    c.put_ramp(px, py, 'stone', idx)
    # Unterkante dunkler (Okklusion)
    for x in range(32):
        c.put_ramp(x, bot, 'stone', 0)
        if x % 2 == 0:
            c.put_ramp(x, bot - 1, 'stone', 1)
    # Moos
    if moss:
        for x in range(32):
            h = int(1 + 2.0 * value_noise(x, 3, 32, seed + 11))
            if texture_noise(x, 0, seed + 5) > 0.5:
                for k in range(h):
                    c.put_ramp(x, bot - 1 - k, 'grass', 2 if k == 0 else (3 if (x + k) % 2 == 0 else 2))
        c.put_ramp(5, 34, 'grass', 3)
        c.put_ramp(6, 35, 'grass', 2)
        c.put_ramp(24, 36, 'grass', 3)
    # --- Oberseite (y 0..31): unregelmäßige Steinplatten (Voronoi), ruhig und ohne Raster
    cap = tile_cobble(seed + 20, 32, base='stone', tone=(3, 4), mortar=2, hi=5)
    for y in range(32):
        for x in range(32):
            c.px[y, x] = cap.px[y, x]
            c.rid[y, x] = cap.rid[y, x]
    # Fase: Nord/West einen Ton heller, Süd/Ost einen Ton dunkler
    for i in range(32):
        c.put_ramp(i, 0, 'stone', 4)
        c.put_ramp(0, i, 'stone', 4)
        c.put_ramp(i, 31, 'stone', 2)
        c.put_ramp(31, i, 'stone', 2)
    for x in range(1, 31):
        if x % 2 == 0:
            c.put_ramp(x, 30, 'stone', 2)
    if trim:
        for (x, y, i) in [(15, 14, 3), (16, 14, 3), (15, 15, 2), (16, 15, 2), (14, 15, 4), (17, 15, 1), (15, 16, 2), (16, 16, 1)]:
            c.put_ramp(x, y, trim, i)
    return c


def wall_top_only(seed=4):
    """Mauerblock ohne sichtbare Vorderseite (wenn im Süden Mauer anschließt): 32x32"""
    full = wall_block(seed, moss=False)
    c = Canvas(32, 32)
    for y in range(32):
        for x in range(32):
            if full.px[y, x, 3]:
                c.px[y, x] = full.px[y, x]
                c.rid[y, x] = full.rid[y, x]
    return c


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


def gate(team='teamA', seed=6):
    """Doppeltor 32x64 (1x2 Zellen), Draufsicht auf die Torflügel in der Ringmauer"""
    c = Canvas(32, 64)
    # Boden dahinter (dunkel, Torweg)
    for y in range(64):
        for x in range(32):
            c.put_ramp(x, y, 'dirt', 2 if (x + y) % 2 else 1)
    # Torflügel: senkrechte Bohlen
    for y in range(6, 58):
        for x in range(2, 30):
            bx = (x - 2) % 7
            idx = 3
            if bx == 6:
                idx = 1
            elif bx == 0:
                idx = 4
            elif y < 12:
                idx = 4
            if y > 50:
                idx = max(1, idx - 1)
            if texture_noise(x, y // 3, seed) > 0.82:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
    # Mittelspalt
    for y in range(6, 58):
        c.put_ramp(15, y, 'wood', 0)
        c.put_ramp(16, y, 'wood', 1)
    # Eisenbänder
    for by in (14, 30, 46):
        for x in range(2, 30):
            if x in (15, 16):
                continue
            c.put_ramp(x, by, 'metal', 3 if x % 2 else 4)
            c.put_ramp(x, by + 1, 'metal', 2)
            c.put_ramp(x, by + 2, 'metal', 1)
        for sx in (5, 11, 20, 26):
            c.put_ramp(sx, by, 'metal', 5)
    # Steinrahmen oben/unten (Pfosten) mit Teamwappen
    for y in list(range(0, 6)) + list(range(58, 64)):
        for x in range(32):
            idx = 4 if (x + y) % 9 else 3
            if y in (0, 58):
                idx = 5
            if y in (5, 63):
                idx = 2
            c.put_ramp(x, y, 'stone', idx)
    for (x, y, i) in [(15, 2, 3), (16, 2, 3), (15, 3, 2), (16, 3, 2), (15, 60, 3), (16, 60, 3), (15, 61, 2), (16, 61, 2)]:
        c.put_ramp(x, y, team, i)
    # Querriegel
    for x in range(1, 31):
        c.put_ramp(x, 31, 'wood', 0)
        c.put_ramp(x, 32, 'wood', 1)
    c.put_ramp(15, 31, 'gold', 5)
    c.put_ramp(16, 31, 'gold', 4)
    return c


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


def _back_wall(c: Canvas, w=64, h=12, seed=1):
    for y in range(h):
        for x in range(w):
            row = y // 6
            off = 8 if row else 0
            idx = 3 if y < h - 2 else 2
            if y % 6 == 5:
                idx = 1
            elif (x + off) % 16 == 0:
                idx = 1
            elif y % 6 == 0:
                idx = 4
            c.put_ramp(x, y, 'stone', idx)
    for x in range(w):
        c.put_ramp(x, h - 1, 'stone', 0)


def room_krankenstation(team='teamA'):
    c = Canvas(64, 32)
    floor = tile_planks(7, 64, tone=(3, 4, 4))
    for y in range(12, 32):
        for x in range(64):
            c.px[y, x] = floor.px[y - 12, x]
            c.rid[y, x] = floor.rid[y - 12, x]
    _back_wall(c, 64, 12)
    # Fenster
    for y in range(2, 10):
        for x in range(26, 38):
            c.put_ramp(x, y, 'sky', 4 if y < 6 else 3)
    for x in range(26, 38):
        c.put_ramp(x, 1, 'stone', 5)
        c.put_ramp(x, 10, 'stone', 5)
    for y in range(1, 11):
        c.put_ramp(25, y, 'stone', 5)
        c.put_ramp(38, y, 'stone', 1)
        c.put_ramp(31, y, 'stone', 4)
        c.put_ramp(32, y, 'stone', 2)
    # Banner mit grünem Kreuz
    for y in range(1, 11):
        for x in range(8, 18):
            c.put_ramp(x, y, 'bone', 5 if x < 13 else 4)
    for y in range(3, 9):
        c.put_ramp(12, y, 'goblin', 3)
        c.put_ramp(13, y, 'goblin', 2)
    for x in range(10, 16):
        c.put_ramp(x, 5, 'goblin', 3)
        c.put_ramp(x, 6, 'goblin', 2)
    c.put_ramp(8, 11, 'bone', 3)
    c.put_ramp(17, 11, 'bone', 3)
    # Betten (senkrecht, Kopfteil oben): Holzgestell, helles Laken, weißes Kissen, minzgrüne Decke
    for bx in (4, 22):
        by = 12
        for x in range(bx, bx + 15):
            c.put_ramp(x, 31, 'wood', 1)
        # Gestell (breiter als die Matratze) mit Pfosten
        round_rect(c, bx - 1, by + 1, bx + 14, by + 19, 'wood', lo=1, hi=4, radius=1)
        for (px_, py_) in ((bx - 1, by), (bx + 14, by), (bx - 1, by + 19), (bx + 14, by + 19)):
            c.rect(px_, py_ - 1, px_, py_ + 1, 'wood', 4)
            c.put_ramp(px_, py_ - 2, 'gold', 4)
        c.rect(bx, by, bx + 13, by + 2, 'wood', 3)                                      # Kopfbrett
        for x in range(bx, bx + 14):
            c.put_ramp(x, by, 'wood', 4)
        round_rect(c, bx + 1, by + 3, bx + 12, by + 18, 'fur', lo=3, hi=5, radius=1)    # Laken
        round_rect(c, bx + 2, by + 4, bx + 11, by + 8, 'bone', lo=4, hi=5, radius=2)    # Kissen
        round_rect(c, bx + 1, by + 9, bx + 12, by + 18, 'slime', lo=2, hi=5, radius=1)  # Decke
        for x in range(bx + 1, bx + 13):
            c.put_ramp(x, by + 9, 'bone', 5)                                             # Saum
        for k in range(3):
            c.put_ramp(bx + 3 + k * 3, by + 13, 'slime', 5)
        c.rect(bx + 1, by + 17, bx + 12, by + 17, team, 3)                               # Teamstreifen am Fußende
    # Laterne und Kräutertopf
    round_rect(c, 42, 22, 50, 30, 'gold', lo=1, hi=4, radius=2)
    c.put_ramp(46, 24, 'gold', 5)
    c.put_ramp(46, 25, 'gold', 5)
    for (x, y) in [(45, 21), (46, 20), (47, 21)]:
        c.put_ramp(x, y, 'gold', 3)
    round_rect(c, 53, 23, 60, 30, 'wood', lo=1, hi=4, radius=1)
    for (x, y, i) in [(54, 22, 4), (55, 21, 5), (57, 22, 4), (58, 21, 5), (56, 20, 4), (59, 22, 3)]:
        c.put_ramp(x, y, 'leaf', i)
    return c


def room_schmiede():
    c = Canvas(64, 32)
    floor = tile_cobble(9, 64, tone=(1, 2), mortar=0, hi=3)
    for y in range(12, 32):
        for x in range(64):
            c.px[y, x] = floor.px[y - 12, x]
            c.rid[y, x] = floor.rid[y - 12, x]
    _back_wall(c, 64, 12)
    # Esse (Glutöffnung)
    for y in range(1, 11):
        for x in range(40, 56):
            dx = (x - 47.5) / 8.0
            dy = (y - 5.5) / 5.5
            if dx * dx + dy * dy < 1.0 or (y > 5 and abs(dx) < 1):
                d = dx * dx + dy * dy
                idx = 5 if d < 0.15 else (4 if d < 0.4 else (3 if d < 0.65 else 2))
                if (x + y) % 2 and d > 0.3:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'fire', idx)
    for x in range(38, 58):
        c.put_ramp(x, 0, 'metal', 3)
        c.put_ramp(x, 11, 'metal', 2)
    # Amboss
    round_rect(c, 14, 20, 29, 25, 'metal', lo=1, hi=5, radius=1)
    round_rect(c, 17, 25, 26, 29, 'metal', lo=0, hi=3, radius=1)
    for x in range(12, 17):
        c.put_ramp(x, 21, 'metal', 4)
    c.put_ramp(14, 20, 'metal', 5)
    # Hammer + Funken
    c.line(33, 23, 38, 18, 'wood', 3)
    c.rect(36, 16, 40, 19, 'metal', 3)
    c.put_ramp(36, 16, 'metal', 5)
    for (x, y) in [(24, 17), (28, 15), (20, 16), (30, 19)]:
        c.put_ramp(x, y, 'gold', 5)
        c.put_ramp(x + 1, y + 1, 'fire', 4)
    # Wassertrog
    round_rect(c, 44, 22, 58, 29, 'wood', lo=1, hi=4, radius=2)
    for y in range(23, 27):
        for x in range(45, 58):
            c.put_ramp(x, y, 'ice', 3 if (x + y) % 3 else 4)
    # Fass
    round_rect(c, 3, 19, 11, 29, 'wood', lo=1, hi=4, radius=2)
    for y in (21, 27):
        for x in range(3, 12):
            c.put_ramp(x, y, 'metal', 2)
    return c


def platform_zinnen(team='teamA'):
    """Zinnenkranz 64x(32+WALL_H): Steinplattform mit Zinnen (Ringmauer-Ersatz, 2 Geschützplätze)"""
    H = WALL_H
    c = Canvas(64, 32 + H)
    full = wall_block(11, moss=False)
    for ox in (0, 32):
        c.blit(full, ox, 0)
    # Zinnen an der Südkante der Oberseite: niedrige Zähne mit Oberseite, Vorderseite, Schattenkanten
    for mx in range(2, 60, 10):
        for y in range(22, 31):
            for x in range(mx, mx + 8):
                if x >= 63:
                    continue
                if y < 25:
                    idx = 5 if x < mx + 7 else 4          # Oberseite des Zahns
                elif y < 30:
                    idx = 4 if x == mx else (2 if x >= mx + 6 else 3)   # Vorderseite
                else:
                    idx = 1
                c.put_ramp(x, y, 'stone', idx)
        for y in range(22, 31):
            if mx - 1 >= 0:
                c.put_ramp(mx - 1, y, 'stone', 1)
            if mx + 8 < 64:
                c.put_ramp(mx + 8, y, 'stone', 1)
        for x in range(mx - 1, min(64, mx + 9)):
            c.put_ramp(x, 21, 'stone', 1)
    # Teamfarbener Fries an der Vorderseite
    for x in range(64):
        c.put_ramp(x, 35, team, 3 if x % 4 < 2 else 2)
        c.put_ramp(x, 36, team, 1)
    return c


def extend_room(room, floor_fn, extra=10):
    """Raum nach unten um `extra` px Boden verlängern (Gang vor den Möbeln)"""
    c = Canvas(room.w, room.h + extra)
    c.blit(room, 0, 0)
    floor = floor_fn()
    for y in range(room.h, room.h + extra):
        for x in range(room.w):
            c.px[y, x] = floor.px[(y - room.h) % floor.h, x % floor.w]
            c.rid[y, x] = floor.rid[(y - room.h) % floor.h, x % floor.w]
    return c
