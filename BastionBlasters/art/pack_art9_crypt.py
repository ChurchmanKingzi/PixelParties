"""pack_art9: Props der Gruft (BF-05): Saerge mit Kissen, Kerzen, Skelett mit Zeitung."""
from __future__ import annotations

import random

from pack_art9_kit import *
from pack_art9_hall import pad_bottom


def _coffin_outline_mask(w, h):
    """Sechseck-Sarg von oben: oben breit (Schultern), unten schmal"""
    m = [[False] * w for _ in range(h)]
    for y in range(h):
        if y < 4:
            lo, hi = 3 + (3 - y), w - 4 - (3 - y)
        elif y < h * 0.34:
            lo, hi = 0, w - 1
        else:
            t = (y - h * 0.34) / (h * 0.66)
            inset = int(round(t * 3.2))
            lo, hi = inset, w - 1 - inset
        for x in range(lo, hi + 1):
            m[y][x] = True
    return m


def coffin(kind='open', seed=1):
    """Sarg von oben (18 x 32). kind: open (Kissen, Decke, schlafender Schaedel, Deckel halb abgeschoben) | closed"""
    w, h = 18, 32
    c = Canvas(w, h)
    m = _coffin_outline_mask(w, h)
    for y in range(h):
        for x in range(w):
            if not m[y][x]:
                continue
            edge = (x == 0 or y == 0 or not m[y][x - 1] or (y > 0 and not m[y - 1][x]))
            edge2 = (x == w - 1 or y == h - 1 or not m[y][min(w - 1, x + 1)] or (y < h - 1 and not m[y + 1][x]))
            i = 3 if (x + y) % 5 else 2
            if edge:
                i = 4
            elif edge2:
                i = 1
            c.put_ramp(x, y, 'wood', i)
    if kind == 'open':
        # Innenraum (Futter)
        for y in range(3, 20):
            for x in range(3, w - 3):
                if m[y][x] and m[y][x - 2] and m[y][x + 2] if 2 <= x < w - 2 else False:
                    c.put_ramp(x, y, 'cloth', 2 if (x + y) % 2 else 1)
        # Kissen
        round_rect(c, 4, 4, 13, 8, 'bone', lo=3, hi=5, radius=2)
        c.put_ramp(6, 5, 'bone', 5)
        # Schaedel auf dem Kissen
        ellipse(c, 9, 6, 3.2, 2.8, 'bone', lo=3, hi=5)
        c.rect(7, 6, 7, 6, 'coal', 1)
        c.rect(10, 6, 10, 6, 'coal', 1)
        # Decke bis ans Kinn
        for y in range(9, 19):
            for x in range(3, w - 3):
                if 2 <= x < w - 2 and m[y][x - 2] and m[y][x + 2]:
                    c.put_ramp(x, y, 'teamB', 3 if (x < 8) else 2)
        hline(c, 3, w - 4, 9, 'teamB', 5)
        for k in range(3):
            c.put_ramp(5 + k * 3, 13, 'teamB', 4)
        # Deckel halb abgeschoben (untere Haelfte), schraeg
        for y in range(19, h - 1):
            for x in range(1, w - 1):
                if m[y][x] and m[y][x - 1] and m[y][x + 1]:
                    i = 3 if (x + y) % 6 else 2
                    if y == 19:
                        i = 5
                    elif x == 1 or m[y][x - 2 if x >= 2 else 0] is False:
                        i = 4
                    c.put_ramp(x, y, 'wood', i)
        hline(c, 2, w - 3, 20, 'wood', 1)
        # goldenes Kreuz
        vline(c, 9, 22, 29, 'gold', 4)
        hline(c, 7, 11, 24, 'gold', 4)
        c.put_ramp(8, 24, 'gold', 5)
    else:
        # geschlossen: Knochenkreuz
        vline(c, 9, 5, 26, 'bone', 4)
        vline(c, 8, 5, 26, 'bone', 5)
        hline(c, 5, 12, 10, 'bone', 4)
        hline(c, 5, 12, 9, 'bone', 5)
        c.put_ramp(4, 9, 'bone', 5)
        c.put_ramp(13, 9, 'bone', 4)
        c.put_ramp(4, 11, 'bone', 4)
        c.put_ramp(13, 11, 'bone', 3)
        for (x, y) in ((3, 7), (14, 7), (6, 28), (11, 28)):
            c.put_ramp(x, y, 'gold', 4)
    c.outline()
    return c


def candelabra():
    """Standleuchter mit drei Kerzen (14 x 32)"""
    c = Canvas(14, 32)
    c.rect(6, 12, 7, 29, 'metal', 3)
    c.rect(6, 12, 6, 29, 'metal', 4)
    c.rect(3, 29, 10, 31, 'metal', 2)
    c.rect(3, 29, 10, 29, 'metal', 4)
    hline(c, 2, 11, 12, 'metal', 3)
    c.line(2, 12, 2, 9, 'metal', 3)
    c.line(11, 12, 11, 9, 'metal', 3)
    for x in (2, 6, 11):
        yt = 9 if x != 6 else 6
        c.rect(x - 1, yt, x, yt + 3, 'bone', 4)
        c.put_ramp(x - 1, yt, 'bone', 5)
        c.put_ramp(x - 1, yt + 3, 'bone', 3)
        c.put_ramp(x, yt + 1, 'bone', 2)
        # Flamme
        c.put_ramp(x - 1, yt - 1, 'fire', 4)
        c.put_ramp(x - 1, yt - 2, 'gold', 5)
        c.put_ramp(x - 1, yt - 3, 'gold', 4)
        c.put_ramp(x, yt - 1, 'fire', 3)
    c.outline()
    return c


def armchair_reader():
    """Skelett im Ohrensessel liest Zeitung (36 x 36), Pantoffeln, Teetasse auf der Lehne"""
    c = Canvas(36, 36)
    # Sessel hinten (Lehne)
    round_rect(c, 3, 4, 28, 30, 'cloth', lo=1, hi=4, radius=4)
    round_rect(c, 0, 14, 7, 32, 'cloth', lo=1, hi=4, radius=2)     # linke Armlehne
    round_rect(c, 25, 14, 32, 32, 'cloth', lo=0, hi=3, radius=2)    # rechte Armlehne
    for y in (10, 18, 26):
        for x in range(8, 24):
            if (x + y) % 4 == 0:
                c.put_ramp(x, y, 'cloth', 1)
    # Sitzkissen
    round_rect(c, 6, 26, 26, 33, 'cloth', lo=2, hi=5, radius=2)
    hline(c, 7, 25, 33, 'cloth', 0)
    # Beine: ein Bein ueberschlagen, Pantoffel
    thick_line(c, 12, 28, 12, 33, 3.0, 'bone', lo=1, hi=4)
    thick_line(c, 18, 28, 24, 30, 3.0, 'bone', lo=2, hi=5)
    ellipse(c, 11.5, 34, 3.6, 1.8, 'teamB', lo=2, hi=5)
    ellipse(c, 26, 30.5, 2.8, 1.8, 'teamB', lo=2, hi=5)
    # Zeitung: grosses Blatt, Schriftzeilen als Graubloecke
    for y in range(8, 27):
        for x in range(9, 24):
            i = 5 if x < 12 else (4 if (x + y) % 2 == 0 or x < 20 else 3)
            c.put_ramp(x, y, 'bone', i)
    hline(c, 9, 23, 8, 'bone', 3)
    for y in (12, 14, 16, 18, 20, 22, 24):
        for x in range(10, 23):
            if (x // 2 + y) % 3 != 0 and x != 16:
                c.put_ramp(x, y, 'bone', 2 if x < 16 else 1)
    c.rect(10, 10, 15, 11, 'coal', 2)                              # Schlagzeile
    c.rect(17, 10, 22, 11, 'coal', 3)
    vline(c, 16, 9, 26, 'bone', 2)
    # Hände halten das Blatt
    c.rect(7, 18, 9, 21, 'bone', 5)
    c.rect(24, 18, 26, 21, 'bone', 4)
    for y in (18, 20):
        c.put_ramp(10, y, 'bone', 4)
        c.put_ramp(23, y, 'bone', 3)
    # Schaedel mit Topfhelm ueber dem Blatt
    ellipse(c, 16.5, 4.5, 5.2, 4.2, 'bone', lo=2, hi=5)
    c.rect(14, 5, 15, 6, 'coal', 1)
    c.rect(18, 5, 19, 6, 'coal', 1)
    ellipse(c, 16.5, 2.5, 6.0, 3.8, 'metal', lo=1, hi=5, clip=lambda x, y: y <= 2)
    hline(c, 10, 23, 3, 'metal', 1)
    c.outline()
    return c


def tea_table():
    """Beistelltisch mit dampfender Tasse und einer Kerze (14 x 22)"""
    c = Canvas(14, 24)
    ellipse(c, 7, 14, 6.0, 2.6, 'wood', lo=3, hi=5)
    c.rect(6, 16, 7, 21, 'wood', 2)
    hline(c, 3, 10, 22, 'wood', 1)
    hline(c, 4, 9, 21, 'wood', 2)
    # Tasse
    round_rect(c, 4, 9, 9, 13, 'bone', lo=3, hi=5, radius=1)
    c.put_ramp(10, 10, 'bone', 4)
    c.put_ramp(10, 11, 'bone', 3)
    hline(c, 5, 8, 9, 'leaf', 3)
    # Dampf
    for (x, y) in ((6, 7), (7, 5), (6, 3), (7, 1)):
        c.put_ramp(x, y, 'bone', 4)
    c.outline()
    return c


def skull_niche():
    """Nische mit Schaedelstapel (22 x 20), Rundbogen"""
    c = Canvas(22, 20)
    for y in range(0, 20):
        for x in range(0, 22):
            if y < 8:
                dx = (x - 10.5) / 10.0
                dy = (y - 8) / 8.0
                if dx * dx + dy * dy > 1.0:
                    continue
            c.put_ramp(x, y, 'coal', 0 if (x + y) % 3 else 1)
    rows = [(3, [4, 11, 17]), (9, [7, 14]), (14, [3, 10, 17])]
    for (y, xs) in rows:
        for x in xs:
            ellipse(c, x, y, 2.6, 2.4, 'bone', lo=2, hi=5)
            c.put_ramp(x - 1, y, 'coal', 0)
            c.put_ramp(x + 1, y, 'coal', 0)
            c.put_ramp(x, y + 2, 'bone', 2)
    # Knochen quer
    c.line(2, 18, 19, 17, 'bone', 3)
    c.line(2, 19, 19, 18, 'bone', 2)
    c.outline()
    return c


def cobweb(flip=False):
    """Spinnennetz in der Ecke (14 x 14), nur Fäden"""
    c = Canvas(14, 14)
    for k in range(0, 14):
        c.put_ramp(k, 0, 'bone', 3 if k % 2 else 4)
        c.put_ramp(0, k, 'bone', 3 if k % 2 else 4)
    for k in range(0, 14):
        c.put_ramp(k, k, 'bone', 3 if k % 2 else 4)
    c.line(0, 0, 13, 6, 'bone', 3)
    c.line(0, 0, 6, 13, 'bone', 3)
    for r in (4, 8, 11):
        for a in range(0, 91, 6):
            x = int(round(r * math.cos(math.radians(a))))
            y = int(round(r * math.sin(math.radians(a))))
            if r == 8:
                x, y = x - 0, y
            if (a // 6) % 2 == 0 or r == 4:
                c.put_ramp(x, y, 'bone', 4 if r < 8 else 3)
    # Spinne
    c.put_ramp(6, 7, 'coal', 2)
    c.put_ramp(7, 7, 'coal', 2)
    c.put_ramp(6, 8, 'coal', 1)
    return c.flipped() if flip else c


def torch_green():
    """Wandfackel mit grüner Geisterflamme (8 x 20)"""
    c = Canvas(8, 20)
    c.rect(3, 9, 4, 18, 'wood', 3)
    c.rect(3, 9, 3, 18, 'wood', 4)
    c.rect(1, 7, 6, 9, 'metal', 3)
    c.put_ramp(1, 7, 'metal', 4)
    # Flamme
    for (x, y, i) in ((3, 6, 5), (4, 6, 4), (3, 5, 5), (4, 5, 4), (3, 4, 4), (4, 4, 3), (3, 3, 4), (3, 2, 3), (2, 6, 3), (5, 6, 3)):
        c.put_ramp(x, y, 'slime', i)
    c.outline()
    return c


def bat_hanging():
    """Fledermaus kopfüber (10 x 10)"""
    c = Canvas(10, 10)
    ellipse(c, 5, 5, 2.2, 3.0, 'coal', lo=1, hi=4)
    poly(c, [(3, 3), (0, 4), (1, 8), (3, 7)], 'coal', lo=1, hi=3)
    poly(c, [(7, 3), (10, 4), (9, 8), (7, 7)], 'coal', lo=1, hi=3)
    c.put_ramp(4, 7, 'fire', 4)
    c.put_ramp(6, 7, 'fire', 4)
    c.outline()
    return c


def crypt_rug():
    """zerschlissener Laeufer (Bodendeko, 20 x 36) in dunklem Violett mit Knochen-Rand"""
    c = Canvas(20, 36)
    for y in range(36):
        for x in range(20):
            edge = min(x, y, 19 - x, 35 - y)
            if edge == 0:
                i = 1
            elif edge == 1:
                i = 3 if (x + y) % 2 else 2
            else:
                i = 2 if ((x // 3 + y // 3) % 2 == 0) else 1
            c.put_ramp(x, y, 'cloth', i)
    for y in range(4, 33, 4):
        c.put_ramp(10, y, 'bone', 3)
        c.put_ramp(9, y + 1, 'bone', 2)
        c.put_ramp(11, y + 1, 'bone', 2)
    return c
