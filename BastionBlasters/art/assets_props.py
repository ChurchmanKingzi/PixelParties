"""Möbel, Wanddeko und Bodendekor für Räume (schräge Draufsicht, Vorderansicht)."""
from __future__ import annotations

import math
import random

from pixl import *


# --------------------------------------------------------------------------- Möbel


def bed(team='teamA', sheet='slime'):
    """Bett, senkrecht (Kopfteil oben), 18x24"""
    c = Canvas(18, 24)
    round_rect(c, 1, 2, 16, 21, 'wood', lo=1, hi=4, radius=1)
    c.rect(1, 2, 16, 4, 'wood', 3)
    for x in range(1, 17):
        c.put_ramp(x, 2, 'wood', 4)
    for (px_, py_) in ((1, 2), (16, 2), (1, 21), (16, 21)):
        c.rect(px_, py_ - 1, px_, py_ + 1, 'wood', 4)
    round_rect(c, 3, 5, 14, 20, 'fur', lo=3, hi=5, radius=1)
    round_rect(c, 4, 6, 13, 10, 'bone', lo=4, hi=5, radius=2)
    round_rect(c, 3, 12, 14, 20, sheet, lo=2, hi=5, radius=1)
    for x in range(3, 15):
        c.put_ramp(x, 12, 'bone', 5)
    for k in range(3):
        c.put_ramp(5 + k * 3, 16, sheet, 5)
    c.rect(3, 19, 14, 19, team, 3)
    c.outline()
    return c


def bunk(team='teamA'):
    """Etagenbett von vorn, 20x24"""
    c = Canvas(20, 24)
    for x in (1, 17):
        c.rect(x, 2, x + 1, 22, 'wood', 3)
        c.rect(x, 2, x, 22, 'wood', 4)
    for (y0, col) in ((4, team), (13, 'slime')):
        round_rect(c, 2, y0, 17, y0 + 7, 'fur', lo=3, hi=5, radius=1)
        round_rect(c, 3, y0 + 1, 7, y0 + 4, 'bone', lo=4, hi=5, radius=1)
        round_rect(c, 8, y0 + 1, 17, y0 + 7, col, lo=2, hi=5, radius=1)
        c.rect(2, y0 + 7, 17, y0 + 8, 'wood', 2)
    c.rect(1, 22, 18, 23, 'wood', 1)
    c.outline()
    return c


def anvil():
    c = Canvas(22, 14)
    round_rect(c, 5, 8, 16, 12, 'metal', lo=0, hi=3, radius=1)
    round_rect(c, 2, 3, 19, 8, 'metal', lo=1, hi=5, radius=1)
    poly(c, [(19, 4), (21, 5), (19, 7)], 'metal', lo=2, hi=5)
    c.put_ramp(4, 4, 'metal', 5)
    c.put_ramp(5, 4, 'metal', 5)
    c.outline()
    return c


def barrel():
    c = Canvas(14, 18)
    round_rect(c, 1, 3, 12, 16, 'wood', lo=1, hi=4, radius=3)
    ellipse(c, 6.5, 3.5, 5.5, 2.4, 'wood', lo=3, hi=5)
    for y in (6, 13):
        for x in range(1, 13):
            c.put_ramp(x, y, 'metal', 2)
    c.outline()
    return c


def trough():
    c = Canvas(22, 14)
    round_rect(c, 1, 4, 20, 12, 'wood', lo=1, hi=4, radius=2)
    for y in range(5, 9):
        for x in range(3, 19):
            c.put_ramp(x, y, 'ice', 3 if (x + y) % 3 else 4)
    c.outline()
    return c


def crate():
    c = Canvas(16, 16)
    round_rect(c, 1, 2, 14, 14, 'wood', lo=1, hi=4, radius=1)
    for x in range(2, 14):
        c.put_ramp(x, 2, 'wood', 5)
    c.line(2, 3, 13, 13, 'wood', 2)
    c.line(13, 3, 2, 13, 'wood', 2)
    c.outline()
    return c


def rack():
    """Waffenständer, 22x20"""
    c = Canvas(22, 20)
    c.rect(1, 6, 20, 8, 'wood', 3)
    c.rect(1, 16, 20, 17, 'wood', 2)
    for k, x in enumerate((3, 7, 11, 15, 19)):
        c.rect(x, 2 + (k % 2) * 2, x, 16, 'wood', 4)
        c.rect(x - 1, 1 + (k % 2) * 2, x + 1, 3 + (k % 2) * 2, 'metal', 4)
    c.outline()
    return c


def herb_table():
    c = Canvas(26, 16)
    round_rect(c, 1, 6, 24, 12, 'wood', lo=1, hi=4, radius=1)
    c.rect(3, 12, 4, 14, 'wood', 2)
    c.rect(21, 12, 22, 14, 'wood', 2)
    for k, (col, i) in enumerate((('slime', 4), ('fire', 4), ('purple', 4), ('gold', 4))):
        x = 4 + k * 5
        round_rect(c, x, 2, x + 3, 6, col, lo=2, hi=5, radius=1)
        c.put_ramp(x + 1, 1, 'wood', 3)
    c.outline()
    return c


def chest():
    c = Canvas(18, 14)
    round_rect(c, 1, 4, 16, 12, 'wood', lo=1, hi=4, radius=1)
    ellipse(c, 8.5, 5, 7.5, 3.2, 'wood', lo=2, hi=5, clip=lambda x, y: y <= 6)
    for x in range(1, 17):
        c.put_ramp(x, 7, 'gold', 3)
    c.rect(8, 6, 9, 9, 'gold', 5)
    c.outline()
    return c


def plant():
    c = Canvas(14, 18)
    round_rect(c, 3, 11, 10, 16, 'wood', lo=1, hi=4, radius=1)
    for (x, y, i) in [(6, 10, 3), (7, 9, 4), (5, 8, 4), (8, 7, 5), (4, 6, 5), (7, 5, 4), (6, 4, 5), (9, 8, 3), (3, 9, 3)]:
        c.put_ramp(x, y, 'leaf', i)
        c.put_ramp(x + 1, y, 'leaf', max(2, i - 1))
    c.outline()
    return c


def rug(w=48, h=24, team='teamA'):
    """Teppich als Bodendekor (kein Outline)"""
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            edge = min(x, y, w - 1 - x, h - 1 - y)
            if edge == 0:
                idx = 1
            elif edge == 1:
                idx = 4
            elif edge in (2, 3):
                idx = 3 if (x + y) % 2 == 0 else 2
            else:
                idx = 2 if ((x // 3 + y // 3) % 2 == 0) else 3
            c.put_ramp(x, y, team, idx)
    return c


# --------------------------------------------------------------------------- Wanddeko (hängt an Vorderseiten)


def window():
    c = Canvas(12, 14)
    for y in range(1, 13):
        for x in range(1, 11):
            if y < 4:
                dx = (x - 5.5) / 5.0
                if dx * dx + ((y - 4) / 3.0) ** 2 > 1.0:
                    continue
            c.put_ramp(x, y, 'sky', 4 if y < 7 else 3)
    for y in range(3, 13):
        c.put_ramp(5, y, 'stone', 4)
        c.put_ramp(6, y, 'stone', 2)
    for x in range(1, 11):
        c.put_ramp(x, 12, 'stone', 5)
        c.put_ramp(x, 13, 'stone', 2)
    c.put_ramp(3, 6, 'sky', 5)
    c.put_ramp(8, 8, 'sky', 5)
    c.outline()
    return c


def banner_cross(cross='goblin'):
    """hängendes Banner mit Kreuz (Heilung), 12x20"""
    c = Canvas(12, 20)
    c.rect(1, 1, 10, 1, 'wood', 4)
    for y in range(2, 17):
        for x in range(2, 10):
            c.put_ramp(x, y, 'bone', 5 if x < 6 else 4)
    for (x, y) in ((3, 17), (4, 17), (5, 17), (6, 18), (7, 17), (8, 17), (9, 17), (5, 18)):
        c.put_ramp(x, y, 'bone', 4)
    c.rect(5, 5, 6, 12, cross, 3)
    c.rect(3, 8, 8, 9, cross, 3)
    c.rect(6, 5, 6, 12, cross, 2)
    c.outline()
    return c


def crest(team='teamA'):
    """Wappenschild, 12x14"""
    c = Canvas(12, 14)
    poly(c, [(1, 1), (10, 1), (10, 8), (5.5, 13), (1, 8)], team, lo=1, hi=4)
    for y in range(3, 9):
        c.put_ramp(5, y, 'gold', 5)
        c.put_ramp(6, y, 'gold', 4)
    c.rect(3, 5, 8, 6, 'gold', 4)
    c.outline()
    return c


def forge_decor():
    """Esse mit Glut, 24x18"""
    c = Canvas(24, 18)
    round_rect(c, 0, 4, 23, 17, 'stone', lo=1, hi=4, radius=2)
    for y in range(2, 17):
        for x in range(3, 21):
            dx = (x - 11.5) / 8.5
            dy = (y - 10.0) / 7.5
            if dx * dx + dy * dy < 1.0 and (y >= 6 or dx * dx + dy * dy < 0.6):
                d = dx * dx + dy * dy
                idx = 5 if d < 0.16 else (4 if d < 0.4 else (3 if d < 0.7 else 2))
                if (x + y) % 2 and d > 0.35:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'fire', idx)
    c.rect(9, 0, 14, 4, 'stone', 2)         # Schlot
    c.rect(10, 0, 13, 1, 'stone', 1)
    c.outline()
    return c
