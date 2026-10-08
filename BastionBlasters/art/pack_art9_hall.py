"""pack_art9: Props der Trophaeenhalle (BW-09) und der Hexenkueche (BW-10)."""
from __future__ import annotations

import random

from pack_art9_kit import *


def pad_bottom(spr, n):
    """transparente Zeilen unten anfügen (Wanddeko, die höher als der Wandfuss hängen soll)"""
    c = Canvas(spr.w, spr.h + n)
    c.px[:spr.h] = spr.px
    c.rid[:spr.h] = spr.rid
    return c


# =========================================================================== Trophäenhalle


def _plaque(c, w, h, shape='shield'):
    """Holzbrett (Schild- oder Ovalform), Rand dunkel"""
    cx = (w - 1) / 2.0
    for y in range(h):
        for x in range(w):
            if shape == 'oval':
                dx = (x - cx) / (w / 2.0)
                dy = (y - (h - 1) / 2.0) / (h / 2.0)
                if dx * dx + dy * dy > 1.0:
                    continue
            else:
                if y > h * 0.62:
                    hw = (w / 2.0) * (1 - (y - h * 0.62) / (h * 0.46))
                    if abs(x - cx) > hw:
                        continue
            edge = x == 0 or y == 0
            c.put_ramp(x, y, 'wood', 4 if edge else (3 if (x + y) % 3 else 2))
    for y in range(h):
        for x in range(w):
            if c.alpha(x, y) and (not c.alpha(x + 1, y) or not c.alpha(x, y + 1)):
                c.put_ramp(x, y, 'wood', 1)


def plaque_goblin():
    """ausgestopfter Goblin-Kopf auf Schild (18 x 20)"""
    c = Canvas(18, 20)
    _plaque(c, 18, 20)
    poly(c, [(5, 8), (0, 5), (5, 11)], 'goblin', lo=1, hi=4)
    poly(c, [(12, 8), (17, 5), (12, 11)], 'goblin', lo=2, hi=5)
    ellipse(c, 8.5, 9, 5.4, 4.8, 'goblin', lo=2, hi=5)
    c.rect(6, 7, 7, 8, 'coal', 1)
    c.rect(10, 7, 11, 8, 'coal', 1)
    c.put_ramp(6, 7, 'bone', 5)
    c.put_ramp(10, 7, 'bone', 5)
    hline(c, 6, 11, 11, 'goblin', 1)
    # Namensschild
    c.rect(5, 15, 12, 17, 'gold', 4)
    hline(c, 5, 12, 15, 'gold', 5)
    hline(c, 5, 12, 17, 'gold', 2)
    c.outline()
    return c


def plaque_skull():
    """Totenkopf mit Topfhelm auf Ovalbrett (18 x 20)"""
    c = Canvas(18, 20)
    _plaque(c, 18, 20, 'oval')
    ellipse(c, 8.5, 10, 5.2, 4.6, 'bone', lo=2, hi=5)
    c.rect(5, 12, 6, 13, 'coal', 1)
    c.rect(10, 12, 11, 13, 'coal', 1)
    for x in (6, 8, 10):
        c.put_ramp(x, 15, 'bone', 5)
    hline(c, 6, 11, 16, 'bone', 3)
    ellipse(c, 8.5, 8, 6.2, 5.4, 'metal', lo=1, hi=5, clip=lambda x, y: y <= 8)
    hline(c, 2, 15, 8, 'metal', 1)
    c.put_ramp(8, 2, 'metal', 4)
    c.put_ramp(9, 2, 'metal', 3)
    c.outline()
    return c


def plaque_bear():
    """Bärenkopf mit Schal auf Schild (20 x 22)"""
    c = Canvas(20, 22)
    _plaque(c, 20, 22)
    ellipse(c, 4.5, 6.5, 2.8, 2.8, 'fur', lo=2, hi=4)
    ellipse(c, 15.5, 6.5, 2.8, 2.8, 'fur', lo=3, hi=5)
    ellipse(c, 10, 11, 6.4, 5.6, 'fur', lo=2, hi=5)
    ellipse(c, 10, 14, 3.4, 2.6, 'fur', lo=4, hi=5)
    c.rect(7, 9, 8, 10, 'coal', 1)
    c.rect(12, 9, 13, 10, 'coal', 1)
    c.rect(9, 13, 11, 14, 'coal', 1)
    hline(c, 4, 15, 17, 'teamA', 3)
    hline(c, 4, 15, 18, 'teamA', 2)
    c.outline()
    return c


def trophy_cup(h=16, col='gold'):
    """Pokal auf rotem Kissen und Steinsockel (16 x h+10)"""
    c = Canvas(16, h + 11)
    y0 = h + 11
    block(c, 1, y0 - 8, 14, y0 - 1, 'stone', hi=4, mid=3, lo=2, deep=1)
    hline(c, 3, 12, y0 - 9, 'teamA', 4)
    hline(c, 2, 13, y0 - 8, 'teamA', 3)
    # Fuss, Stiel, Schale
    hline(c, 4, 11, y0 - 10, col, 3)
    hline(c, 5, 10, y0 - 11, col, 4)
    c.rect(7, y0 - 15, 8, y0 - 11, col, 3)
    c.put_ramp(7, y0 - 14, col, 5)
    top = y0 - 15
    for k in range(7):
        w = 6 - int(k * 0.5)
        x0 = 8 - w
        c.rect(x0, top - 6 + k, 7 + w, top - 6 + k, col, 4 if k < 3 else 3)
        c.put_ramp(x0, top - 6 + k, col, 5)
        c.put_ramp(7 + w, top - 6 + k, col, 2)
    # Henkel
    for (x, y) in ((1, top - 5), (0, top - 4), (1, top - 3), (14, top - 5), (15, top - 4), (14, top - 3)):
        c.put_ramp(x, y, col, 3)
    c.put_ramp(5, top - 4, col, 5)
    c.put_ramp(5, top - 3, 'bone', 5)
    c.outline()
    return c


def gnome_medal():
    """Gartenzwerg-Statue mit riesiger Medaille, Brust raus (18 x 30)"""
    c = Canvas(18, 30)
    # Sockel
    block(c, 2, 25, 15, 29, 'stone', hi=4, mid=3, lo=2, deep=1)
    # Beine / Stiefel
    c.rect(5, 22, 7, 25, 'wood', 3)
    c.rect(10, 22, 12, 25, 'wood', 2)
    hline(c, 4, 7, 25, 'wood', 1)
    hline(c, 9, 13, 25, 'wood', 1)
    # Koerper (blaue Latzhose + Hemd), Brust raus
    round_rect(c, 4, 12, 13, 23, 'ice', lo=1, hi=4, radius=2)
    c.rect(4, 12, 13, 14, 'bone', 4)
    c.rect(4, 12, 13, 12, 'bone', 5)
    hline(c, 4, 13, 22, 'ice', 1)
    # Arme in die Seiten
    thick_line(c, 4, 14, 2, 19, 2.2, 'skin', lo=2, hi=4)
    thick_line(c, 13, 14, 15, 19, 2.2, 'skin', lo=2, hi=4)
    # Medaille
    c.line(7, 12, 8, 16, 'teamA', 3)
    c.line(10, 12, 9, 16, 'teamA', 2)
    ellipse(c, 8.5, 18, 3.4, 3.4, 'gold', lo=2, hi=5, spec=(7, 17, 5))
    c.put_ramp(8, 18, 'gold', 3)
    c.put_ramp(9, 19, 'gold', 2)
    # Bart + Kopf
    poly(c, [(4, 11), (13, 11), (11, 17), (8.5, 19), (6, 17)], 'bone', lo=3, hi=5)
    ellipse(c, 8.5, 8, 4.2, 3.6, 'skin', lo=2, hi=5)
    ellipse(c, 11, 9, 1.5, 1.4, 'skin', lo=3, hi=5)         # Nase
    c.put_ramp(8, 7, 'coal', 1)
    c.put_ramp(6, 7, 'coal', 1)
    poly(c, [(3, 7), (14, 7), (11, 2), (9.5, 0), (7, 2)], 'teamA', lo=1, hi=4)
    hline(c, 3, 14, 7, 'teamA', 1)
    c.put_ramp(6, 5, 'teamA', 4)
    c.outline()
    return c


def stuffed_bear():
    """ausgestopfter Bär auf Holzsockel, Pranken oben (24 x 38)"""
    c = Canvas(24, 38)
    block(c, 1, 33, 22, 37, 'wood', hi=4, mid=3, lo=2, deep=1)
    # Beine
    ellipse(c, 8, 31, 4.2, 3.0, 'fur', lo=1, hi=4)
    ellipse(c, 16, 31, 4.2, 3.0, 'fur', lo=2, hi=5)
    # Körper
    ellipse(c, 12, 22, 8.6, 10.6, 'fur', lo=1, hi=5, ambient=0.12)
    ellipse(c, 12, 25, 4.8, 6.0, 'fur', lo=3, hi=5)
    # Arme erhoben
    thick_line(c, 5, 17, 1, 8, 4.2, 'fur', lo=1, hi=4)
    thick_line(c, 19, 17, 23, 8, 4.2, 'fur', lo=2, hi=5)
    for (x, y) in ((0, 5), (1, 4), (2, 5), (22, 5), (23, 4), (21, 5)):
        c.put_ramp(x, y, 'bone', 5)
    # Kopf
    ellipse(c, 7, 6, 2.8, 2.8, 'fur', lo=2, hi=4)
    ellipse(c, 17, 6, 2.8, 2.8, 'fur', lo=3, hi=5)
    ellipse(c, 12, 10, 6.4, 5.6, 'fur', lo=2, hi=5)
    ellipse(c, 12, 12.5, 3.4, 2.6, 'fur', lo=4, hi=5)
    c.rect(9, 8, 10, 9, 'coal', 1)
    c.rect(14, 8, 15, 9, 'coal', 1)
    c.rect(11, 11, 13, 12, 'coal', 1)
    # Medaille + Band (er hat auch eine)
    c.line(8, 15, 12, 19, 'teamA', 3)
    c.line(16, 15, 12, 19, 'teamA', 2)
    ellipse(c, 12, 21, 2.4, 2.4, 'gold', lo=2, hi=5)
    c.outline()
    return c


def trophy_banner():
    """Wandbehang mit Wappenschild und gekreuzter Pfanne und Schwert (16 x 22)"""
    c = Canvas(16, 22)
    hline(c, 0, 15, 0, 'wood', 4)
    hline(c, 0, 15, 1, 'wood', 2)
    for y in range(2, 19):
        for x in range(1, 15):
            c.put_ramp(x, y, 'teamA', 3 if x < 8 else 2)
    for x in range(1, 15):
        if x % 2:
            poly(c, [(x, 19), (x + 1, 19), (x, 21)], 'teamA', flat=2)
    # Kreuzung Schwert und Bratpfanne
    c.line(3, 15, 12, 5, 'metal', 4)
    c.line(4, 15, 13, 5, 'metal', 3)
    c.line(12, 15, 3, 5, 'wood', 4)
    ellipse(c, 3.5, 5.5, 2.6, 2.6, 'coal', lo=0, hi=3)
    c.put_ramp(12, 5, 'metal', 5)
    c.rect(7, 10, 8, 11, 'gold', 5)
    c.outline()
    return c


def cup_shelf(n=3):
    """Wandbord mit kleinen Pokalen (30 x 14), Pokale stehen auf dem Brett"""
    c = Canvas(30, 14)
    for k in range(n):
        cx = 6 + k * 9
        c.rect(cx - 2, 3, cx + 2, 3, 'gold', 4)
        for yy in range(4, 7):
            c.rect(cx - 2 + (yy - 4) // 2, yy, cx + 2 - (yy - 4) // 2, yy, 'gold', 4 if yy < 6 else 3)
        c.put_ramp(cx - 2, 3, 'gold', 5)
        c.rect(cx, 7, cx, 8, 'gold', 3)
        c.rect(cx - 1, 9, cx + 1, 9, 'gold', 3)
        c.put_ramp(cx - 1, 4, 'bone', 5)
    c.rect(0, 10, 29, 11, 'wood', 4)
    c.rect(0, 12, 29, 12, 'wood', 2)
    c.rect(2, 13, 3, 13, 'wood', 1)
    c.rect(26, 13, 27, 13, 'wood', 1)
    c.outline()
    return c


# =========================================================================== Hexenküche


def cauldron_big():
    """Dicker Kessel auf Feuer, grüner Trank blubbert (36 x 34)"""
    c = Canvas(36, 34)
    # Holzscheite
    for (x0, y0, x1, y1) in ((4, 31, 31, 28), (6, 28, 30, 31)):
        thick_line(c, x0, y0, x1, y1, 3.4, 'wood', lo=1, hi=4)
    # Flammen
    flame = [(8, 24, 5), (12, 22, 7), (16, 20, 9), (20, 22, 8), (25, 24, 6), (28, 27, 4)]
    for (fx, fy, fh) in flame:
        for k in range(fh):
            w = max(0, (fh - k) // 3 + (1 if k < 2 else 0))
            yy = fy + 6 - k
            for dx in range(-w, w + 1):
                idx = 5 if k < fh * 0.35 and abs(dx) <= w // 2 else (4 if k < fh * 0.6 else 3)
                c.put_ramp(fx + dx, yy, 'fire', idx)
    # Kessel (Bauch)
    ellipse(c, 18, 17, 14.5, 12.5, 'coal', lo=0, hi=4, ambient=0.2)
    # Glanzstreifen
    for k in range(6):
        c.put_ramp(8 + k // 2, 12 + k, 'coal', 5)
        c.put_ramp(9 + k // 2, 12 + k, 'coal', 4)
    # Reifen
    for x in range(4, 33):
        dy = int(round(3.0 * (1 - ((x - 18) / 14.5) ** 2) ** 0.5))
        c.put_ramp(x, 22 - dy, 'metal', 2 if x % 2 else 1)
    # Rand + Trank
    ellipse(c, 18, 7.5, 14.4, 4.8, 'metal', lo=1, hi=4)
    ellipse(c, 18, 7.5, 12.2, 3.6, 'slime', lo=2, hi=5)
    for (x, y, i) in ((12, 7, 5), (13, 7, 5), (19, 6, 5), (24, 8, 5), (16, 9, 4), (22, 7, 4), (9, 8, 4)):
        c.put_ramp(x, y, 'slime', i)
    for (x, y) in ((11, 5), (22, 4)):
        c.put_ramp(x, y, 'slime', 4)
        c.put_ramp(x + 1, y, 'slime', 5)
    # Füsse
    for fx in (7, 29):
        c.rect(fx, 28, fx + 1, 31, 'coal', 2)
    # Zungen vorn (vor dem Kessel)
    for (fx, fh) in ((3, 6), (11, 4), (18, 5), (25, 4), (32, 6)):
        for k in range(fh):
            w = max(0, (fh - k) // 3)
            for dx in range(-w, w + 1):
                c.put_ramp(fx + dx, 32 - k, 'fire', 5 if k < 2 else (4 if k < fh - 2 else 3))
    c.outline()
    return c


def stirring_spoon(f=0):
    """Riesenkochlöffel, rührt von allein (20 x 34): Kelle unten (im Trank), Griff mit Öse schräg nach oben rechts"""
    c = Canvas(20, 34)
    thick_line(c, 5, 29, 15, 7, 2.4, 'wood', lo=2, hi=5)
    ellipse(c, 4.5, 29.5, 3.6, 2.4, 'wood', lo=2, hi=5)
    ellipse(c, 15.5, 4.5, 2.4, 3.0, 'wood', lo=2, hi=5)
    c.put_ramp(15, 4, 'wood', 0)
    c.put_ramp(16, 5, 'wood', 0)
    c.outline()
    return c


def skull_steam(f=0):
    """Dampf in Totenkopfform (18 x 22); keine Outline, aufgelöst durch Dither"""
    c = Canvas(18, 22)
    # Schädel
    for y in range(0, 14):
        for x in range(0, 18):
            dx = (x - 8.5) / 8.0
            dy = (y - 6.5) / 6.6
            if dx * dx + dy * dy <= 1.0 or (y >= 10 and y <= 13 and abs(x - 8.5) <= 4.4):
                i = 5 if (x + y) % 2 == 0 else 4
                if x < 5 and y < 6:
                    i = 5
                if x > 12 or y > 11:
                    i = 4 if (x + y) % 2 == 0 else 3
                c.put_ramp(x, y, 'bone', i)
    # Augenhöhlen und Nase
    for (x0, y0) in ((4, 5), (10, 5)):
        c.rect(x0, y0, x0 + 3, y0 + 3, 'coal', 4)
        c.rect(x0 + 1, y0 + 1, x0 + 2, y0 + 3, 'coal', 3)
    c.rect(8, 9, 9, 10, 'coal', 4)
    for x in (5, 7, 9, 11):
        c.rect(x, 12, x, 13, 'coal', 4)
    # Schwaden darunter
    for y in range(14, 22):
        for x in range(4, 14):
            if (x + y + f) % 2 == 0 and abs(x - (9 + 2 * math.sin(y * 0.8 + f))) < 3.2 - (y - 14) * 0.3:
                c.put_ramp(x, y, 'bone', 4 if y < 18 else 3)
    return c


def potion_shelf():
    """Wandbord mit vier Traenken + Tarnflasche (34 x 16)"""
    c = Canvas(34, 16)
    cols = [('fire', 4), ('gold', 4), ('leaf', 4), ('purple', 4), ('sky', 4)]
    for k, (col, i) in enumerate(cols):
        x = 2 + k * 6
        if col == 'sky':
            # Tarntrank: nur Umriss, durchsichtig
            c.rect(x + 1, 1, x + 2, 2, 'bone', 3)
            for y in range(3, 9):
                c.put_ramp(x, y, 'bone', 4 if y % 2 else 2)
                c.put_ramp(x + 3, y, 'bone', 3 if y % 2 else 2)
            c.put_ramp(x + 1, 9, 'bone', 3)
            c.put_ramp(x + 2, 9, 'bone', 3)
            c.put_ramp(x + 1, 5, 'sky', 4)
            continue
        c.rect(x + 1, 1, x + 2, 2, 'wood', 3)
        round_rect(c, x, 3, x + 3, 9, col, lo=2, hi=5, radius=1)
        c.put_ramp(x + 1, 4, col, 5)
        c.put_ramp(x + 2, 7, col, 2)
    c.rect(0, 10, 33, 11, 'wood', 4)
    c.rect(0, 12, 33, 12, 'wood', 2)
    c.rect(2, 13, 3, 14, 'wood', 1)
    c.rect(30, 13, 31, 14, 'wood', 1)
    c.outline()
    return c


def herb_rail():
    """Querstange mit Kräuterbündeln, Schöpfkelle und Pfanne (34 x 20)"""
    c = Canvas(34, 20)
    hline(c, 0, 33, 1, 'wood', 4)
    hline(c, 0, 33, 2, 'wood', 2)
    # Bündel
    bundles = [(4, 'leaf', 9), (10, 'gold', 7), (16, 'purple', 8)]
    for (x, col, h) in bundles:
        c.rect(x, 3, x, 5, 'dirt', 3)
        for k in range(h):
            w = 1 + k // 3
            for dx in range(-w, w + 1):
                c.put_ramp(x + dx, 5 + k, col, 4 if (dx + k) % 3 == 0 else 3 if dx <= 0 else 2)
    # Kelle
    c.line(24, 3, 24, 11, 'metal', 3)
    ellipse(c, 24, 13, 2.8, 2.4, 'metal', lo=1, hi=4)
    # Pfanne
    c.line(30, 3, 30, 8, 'wood', 3)
    ellipse(c, 30, 11, 3.2, 3.0, 'coal', lo=1, hi=4)
    c.put_ramp(29, 10, 'metal', 4)
    c.outline()
    return c


def kitchen_table():
    """Arbeitstisch mit Schale voller Augäpfel, Mörser und Messer (30 x 20)"""
    c = Canvas(30, 20)
    block(c, 1, 9, 28, 13, 'wood', hi=5, mid=4, lo=3, deep=2)
    block(c, 3, 14, 5, 19, 'wood', hi=3, mid=2, lo=1, deep=0)
    block(c, 24, 14, 26, 19, 'wood', hi=3, mid=2, lo=1, deep=0)
    # Schale
    ellipse(c, 9, 8, 6.4, 3.4, 'metal', lo=1, hi=4)
    for (x, y) in ((6, 5), (9, 4), (12, 6)):
        ellipse(c, x, y, 2.2, 2.2, 'bone', lo=3, hi=5)
        c.put_ramp(x + 1, y, 'leaf', 4)
        c.put_ramp(x + 1, y + 1, 'coal', 1)
    # Mörser
    round_rect(c, 17, 4, 22, 9, 'stone', lo=1, hi=4, radius=2)
    thick_line(c, 20, 5, 22, 0, 1.6, 'wood', lo=2, hi=4)
    # Messer
    c.line(24, 8, 27, 8, 'metal', 5)
    c.put_ramp(23, 8, 'wood', 3)
    c.outline()
    return c


def black_cat():
    """sitzende schwarze Katze, schaut den Kessel an (14 x 16)"""
    c = Canvas(14, 16)
    ellipse(c, 6, 11, 4.6, 4.6, 'coal', lo=0, hi=3)
    ellipse(c, 8, 5, 3.8, 3.4, 'coal', lo=1, hi=4)
    poly(c, [(5, 3), (5, 0), (7.5, 2)], 'coal', lo=1, hi=3)
    poly(c, [(11, 3), (11, 0), (8.5, 2)], 'coal', lo=1, hi=3)
    c.put_ramp(7, 5, 'goblin', 5)
    c.put_ramp(10, 5, 'goblin', 5)
    # Schwanz
    for k in range(7):
        c.put_ramp(1 - (1 if k > 3 else 0), 14 - k, 'coal', 2)
        c.put_ramp(2 - (1 if k > 3 else 0), 14 - k, 'coal', 1)
    hline(c, 3, 9, 15, 'coal', 1)
    c.outline()
    return c


def broom():
    c = Canvas(10, 32)
    c.rect(4, 0, 5, 20, 'wood', 3)
    c.rect(4, 0, 4, 20, 'wood', 4)
    poly(c, [(2, 19), (8, 19), (9, 31), (1, 31)], 'dirt', lo=2, hi=5)
    for x in (3, 5, 7):
        vline(c, x, 22, 30, 'dirt', 2)
    hline(c, 2, 8, 20, 'wood', 1)
    hline(c, 2, 8, 21, 'wood', 2)
    c.outline()
    return c
