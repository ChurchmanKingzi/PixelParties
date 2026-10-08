"""pack_art2: kleine Zusatz-Sprites fuer die Dioramen (Bombe, Engel, Meteor, Wal-Geschoss, Tor, Maulwurfshaufen, Steinplatten)."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art2_kit import *


def spr_zep_bomb(f=0):
    """fallende Fliegerbombe, Nase unten, Flossen oben (10 x 15)"""
    c = Canvas(10, 15)
    ellipse(c, 5, 9, 3.4, 4.8, 'coal', lo=1, hi=4, ambient=0.3)
    c.put_ramp(5, 14, 'coal', 1)
    for (x, y, i) in ((1, 1, 3), (1, 2, 3), (2, 3, 2), (8, 1, 2), (8, 2, 2), (7, 3, 1), (2, 2, 4)):
        c.put_ramp(x, y, 'metal', i)
    c.rect(3, 5, 7, 5, 'gold', 3)
    c.put_ramp(3, 5, 'gold', 5)
    c.put_ramp(3, 8, 'coal', 5)
    c.put_ramp(4, 7, 'coal', 5)
    c.outline()
    return c


def spr_shell():
    """Granate fuer Dicke Berta, fliegt nach rechts (16 x 7)"""
    c = Canvas(16, 7)
    poly(c, [(0, 1), (9, 1), (15, 3), (9, 6), (0, 6)], 'metal', lo=1, hi=5)
    c.rect(4, 1, 5, 5, 'gold', 4)
    c.put_ramp(4, 1, 'gold', 5)
    c.put_ramp(14, 3, 'bone', 5)
    c.put_ramp(13, 3, 'bone', 4)
    c.put_ramp(1, 2, 'metal', 5)
    c.outline()
    return c


def spr_angel(f=0):
    """kleiner singender Engel mit Heiligenschein (S, 16 x 20)"""
    c = Canvas(16, 20)
    # Fluegel
    wl = m_poly(c, [(6, 9), (1, 4), (0, 10), (3, 14), (6, 13)])
    wr = m_poly(c, [(10, 9), (15, 4), (15, 10), (12, 14), (10, 13)])
    shade_mask(c, wl, 'fur', 2, 5, r=1, passes=1, strength=3.0, ambient=0.5)
    shade_mask(c, wr, 'fur', 1, 4, r=1, passes=1, strength=3.0, ambient=0.5)
    # Robe
    robe = m_poly(c, [(5, 9), (11, 9), (13, 19), (3, 19)])
    shade_mask(c, robe, 'bone', 2, 5, r=2, passes=1, strength=3.5, ambient=0.5)
    for y in range(12, 19):
        put_if_solid(c, 8, y, 'bone', 2)
    c.rect(5, 12, 11, 12, 'gold', 3)
    # Kopf: geschlossene Augen, offener Mund (singt)
    ellipse(c, 8, 6, 3.4, 3.2, 'skin', lo=2, hi=5)
    c.put_ramp(9, 5, 'coal', 1)
    c.put_ramp(11, 5, 'coal', 1) if False else None
    c.put_ramp(9, 8, 'coal', 1)
    c.put_ramp(8, 8, 'coal', 2)
    def hair(x, y):
        return y <= 4
    ellipse(c, 8, 4.4, 3.8, 3.0, 'gold', lo=3, hi=5, clip=hair)
    # Heiligenschein
    for (x, y) in ((5, 1), (6, 0), (7, 0), (8, 0), (9, 0), (10, 1)):
        c.put_ramp(x, y, 'gold', 5 if 6 <= x <= 8 else 4)
    c.put_ramp(4, 2, 'gold', 3)
    c.put_ramp(11, 2, 'gold', 3)
    # Haende gefaltet
    c.put_ramp(8, 10, 'skin', 4)
    c.put_ramp(9, 10, 'skin', 3)
    c.outline()
    return c


def spr_meteor():
    """Sternschnuppe: gluehender Felsbrocken (20 x 20)"""
    c = Canvas(26, 26)
    rnd = random.Random(11)
    cx, cy = 15.0, 15.0                              # Kopf fliegt nach unten rechts, Flammen zeigen nach oben links
    rock_pts = []
    for k in range(14):
        a = math.radians(k * 360 / 14)
        r = 6.4 + rnd.uniform(-1.1, 1.1)
        rock_pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    flame_pts = []
    for k in range(28):
        a = math.radians(k * 360 / 28)
        back = max(0.0, -(math.cos(a) * 0.6 + math.sin(a) * 0.8))      # 1 = genau nach hinten
        r = 8.4 + back * 5.5 * (1.0 if k % 2 else 0.45) + rnd.uniform(-0.5, 0.5)
        flame_pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    flame = m_poly(c, flame_pts)
    shade_mask(c, flame, 'fire', 2, 5, r=2, passes=1, strength=2.0, ambient=0.5)
    inner = m_poly(c, [(cx + (x - cx) * 0.78, cy + (y - cy) * 0.78) for (x, y) in flame_pts]) & flame
    flat_mask(c, inner, 'gold', 4)
    rock = m_poly(c, rock_pts)
    shade_mask(c, rock, 'coal', 0, 3, r=2, passes=2, strength=5.0, ambient=0.3)
    for (x0, y0, x1, y1) in ((11, 11, 14, 14), (14, 14, 18, 13), (14, 14, 15, 19), (12, 17, 10, 19), (13, 10, 16, 9)):
        c.line(x0, y0, x1, y1, 'fire', 5 if (x0 + y0) % 2 else 4)
    for (x, y) in ((12, 12), (17, 12), (13, 17)):
        c.put_ramp(x, y, 'gold', 5)
    c.outline()
    return c


def spr_dirt_hole():
    """Loch im Boden mit aufgeworfenem Erdring, Draufsicht (34 x 18): hinterer Teil"""
    c = Canvas(34, 18)
    ellipse(c, 17, 9, 15.5, 7.5, 'dirt', lo=1, hi=4, ambient=0.25)
    ellipse(c, 17, 9.5, 11.5, 5.2, 'coal', lo=0, hi=2, ambient=0.3)
    for (x, y, i) in ((3, 6, 5), (5, 4, 5), (28, 5, 4), (30, 8, 4), (9, 2, 5), (22, 2, 4)):
        c.put_ramp(x, y, 'dirt', i)
    c.outline()
    return c


def spr_dirt_lip():
    """vorderer Erdwall des Lochs: verdeckt die Beine des auftauchenden Gnoms (34 x 9)"""
    c = Canvas(34, 9)
    m = m_ellipse(c, 17, 1.5, 15.5, 7.5) & m_poly(c, [(0, 3), (34, 3), (34, 9), (0, 9)])
    shade_mask(c, m, 'dirt', 1, 4, r=2, passes=1, strength=3.0, ambient=0.4)
    for (x, y, i) in ((6, 6, 5), (14, 5, 4), (24, 6, 5), (29, 4, 3)):
        put_if_solid(c, x, y, 'dirt', i)
    c.outline()
    return c


def spr_molehill(big=1):
    """kleiner Maulwurfshaufen (Draufsicht) mit dunklem Loch"""
    w, h = (16, 10) if big == 0 else (22, 12)
    c = Canvas(w, h)
    ellipse(c, w / 2, h * 0.58, w / 2 - 0.5, h * 0.42, 'dirt', lo=1, hi=5, ambient=0.25)
    ellipse(c, w / 2 + 1, h * 0.62, w * 0.2, h * 0.16, 'coal', lo=0, hi=2)
    c.outline()
    return c


def spr_slab(damage=0):
    """hohe Steinplatte (Mauerstueck von der Seite) 14 x 38; damage 0 = ganz, 1 = Loch + Risse, 2 = zerborsten (Stumpf)"""
    c = Canvas(14, 38)
    if damage >= 2:
        m = m_poly(c, [(0, 38), (0, 26), (3, 24), (5, 27), (8, 22), (11, 26), (13, 25), (13, 38)])
        shade_mask(c, m, 'stone', 1, 4, r=2, passes=1, strength=3.0, ambient=0.4)
        for (x, y) in ((4, 30), (8, 33), (10, 29)):
            put_if_solid(c, x, y, 'stone', 1)
        c.outline()
        return c
    top = m_poly(c, [(0, 0), (13, 0), (13, 7), (0, 7)])
    shade_mask(c, top, 'stone', 3, 5, r=1, passes=1, strength=2.0, ambient=0.6)
    face = m_poly(c, [(0, 7), (13, 7), (13, 37), (0, 37)])
    shade_mask(c, face, 'stone', 1, 4, r=2, passes=1, strength=3.0, ambient=0.4)
    for y in range(11, 37, 6):                       # Fugen
        for x in range(0, 14):
            put_if_solid(c, x, y, 'stone', 1)
    for (x, y) in ((4, 8), (9, 14), (3, 20), (8, 26), (5, 32)):
        c.put_ramp(x, y, 'stone', 5)
    if damage == 1:
        ellipse(c, 7, 19, 4.4, 4.4, 'coal', lo=0, hi=2)
        for (x0, y0, x1, y1) in ((7, 15, 6, 10), (4, 19, 0, 17), (10, 22, 13, 25), (7, 23, 8, 30)):
            c.line(x0, y0, x1, y1, 'stone', 0)
        for (x, y) in ((3, 16), (11, 16), (3, 23)):
            c.put_ramp(x, y, 'stone', 5)
    c.outline()
    return c


def spr_chunk(n=0):
    """Steinbrocken / Trümmer (6 x 6)"""
    c = Canvas(7, 6)
    if n % 3 == 0:
        poly(c, [(1, 1), (5, 0), (6, 4), (2, 5)], 'stone', lo=1, hi=5)
    elif n % 3 == 1:
        poly(c, [(0, 2), (3, 0), (5, 2), (4, 5), (1, 5)], 'stone', lo=2, hi=5)
    else:
        poly(c, [(1, 0), (4, 1), (3, 4), (0, 3)], 'stone', lo=1, hi=4)
    c.outline()
    return c


def spr_splinter(n=0):
    """Holzsplitter (8 x 3)"""
    c = Canvas(9, 4)
    c.line(0, 1 + (n % 2), 7, 1 + ((n + 1) % 2), 'wood', 4)
    c.line(1, 2 + (n % 2), 7, 2 + ((n + 1) % 2), 'wood', 2)
    c.put_ramp(8, 1 + ((n + 1) % 2), 'wood', 5)
    return c


def spr_cracked_gate():
    """Stadttor (Suedansicht): Steinpfeiler, Holzflügel, in der Mitte vom Rammbock gesprengt (46 x 52)"""
    c = Canvas(46, 52)
    # Pfeiler
    for (x0, x1, lo) in ((0, 9, 1), (36, 45, 1)):
        m = m_poly(c, [(x0, 6), (x1, 6), (x1, 51), (x0, 51)])
        shade_mask(c, m, 'stone', 1, 4, r=2, passes=1, strength=3.0, ambient=0.4)
        for y in range(12, 51, 6):
            for x in range(x0, x1 + 1):
                put_if_solid(c, x, y, 'stone', 1)
        for y in range(9, 50, 6):
            c.put_ramp(x0 + 3 + (y // 6 % 2) * 3, y, 'stone', 1)
        # Zinne
        t = m_poly(c, [(x0 - 1, 2), (x1 + 1, 2), (x1 + 1, 7), (x0 - 1, 7)])
        shade_mask(c, t, 'stone', 3, 5, r=1, passes=1, strength=2.0, ambient=0.6)
    # Sturz (Bogen flach)
    lin = m_poly(c, [(8, 8), (37, 8), (37, 17), (8, 17)])
    shade_mask(c, lin, 'stone', 2, 4, r=2, passes=1, strength=3.0, ambient=0.4)
    for x in range(9, 37, 6):
        for y in range(9, 17):
            put_if_solid(c, x, y, 'stone', 1)
    # Torfluegel: Holzbohlen
    for side, (x0, x1) in enumerate(((9, 22), (23, 36))):
        for x in range(x0, x1 + 1):
            u = (x - x0) % 4
            for y in range(17, 51):
                idx = 3 if u in (0, 1) else 2
                if u == 3:
                    idx = 1
                if x == x0:
                    idx = 4
                c.put_ramp(x, y, 'wood', idx)
        for by in (24, 42):
            c.rect(x0, by, x1, by + 2, 'metal', 2)
            c.rect(x0, by, x1, by, 'metal', 4)
            for x in range(x0 + 1, x1, 4):
                c.put_ramp(x, by + 1, 'metal', 5)
    # Riss in der Mitte und weggesprengtes Loch
    hole = m_poly(c, [(20, 28), (26, 26), (28, 34), (25, 41), (21, 38), (23, 33)])
    flat_mask(c, hole, 'coal', 0)
    for (x, y) in ((22, 31), (24, 30), (24, 36), (22, 35)):
        c.put_ramp(x, y, 'coal', 1)
    for (x0, y0, x1, y1) in ((20, 28, 15, 22), (26, 26, 31, 20), (28, 34, 33, 38), (21, 38, 16, 44), (25, 41, 29, 47), (20, 30, 11, 32)):
        c.line(x0, y0, x1, y1, 'wood', 0)
    for (x, y) in ((19, 27), (27, 25), (29, 36), (17, 43)):
        c.put_ramp(x, y, 'wood', 5)
        c.put_ramp(x + 1, y + 1, 'wood', 4)
    # Eisenring
    ellipse(c, 14, 36, 2.6, 2.6, 'metal', lo=1, hi=5)
    ellipse(c, 14, 36, 1.2, 1.2, 'wood', lo=1, hi=2)
    c.outline()
    return c
