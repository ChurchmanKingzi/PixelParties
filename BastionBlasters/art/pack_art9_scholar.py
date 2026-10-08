"""pack_art9: Props der Akademie der verbotenen Buecher (BW-08) und der Arcanum-Magie (geteilt)."""
from __future__ import annotations

import random

from pack_art9_kit import *

BOOK_COLS = ['teamA', 'ice', 'leaf', 'gold', 'purple', 'fire', 'slime', 'cloth']


def draw_book_v(c, x, y_base, w, h, col, band=True):
    """stehendes Buch von vorn (Rücken): Lichtkante links, Schatten rechts, Goldband"""
    for k in range(h):
        yy = y_base - k
        for dx in range(w):
            if dx == 0:
                i = 4
            elif dx == w - 1:
                i = 1
            elif dx == w - 2 and w > 3:
                i = 2
            else:
                i = 3
            if k == h - 1:
                i = 5 if dx < w - 1 else 3
            c.put_ramp(x + dx, yy, col, i)
    if band and h > 4:
        by = y_base - h // 2
        for dx in range(w):
            c.put_ramp(x + dx, by, 'gold', 4 if dx < w - 1 else 2)


def bookshelf(w=26, h=32, seed=1, cols=None, spooky=False):
    """Bücherregal von vorn, drei Fächer voller Bücher (w x h)"""
    cols = cols or BOOK_COLS
    c = Canvas(w, h)
    rnd = random.Random(seed)
    # Rückwand
    for y in range(3, h - 2):
        for x in range(2, w - 2):
            c.put_ramp(x, y, 'wood', 0 if (x + y) % 5 else 1)
    # Seitenwangen
    for x in (0, 1):
        vline(c, x, 1, h - 1, 'wood', 4 if x == 0 else 3)
    for x in (w - 2, w - 1):
        vline(c, x, 1, h - 1, 'wood', 2 if x == w - 2 else 1)
    # Krone
    hline(c, 0, w - 1, 0, 'wood', 5)
    hline(c, 0, w - 1, 1, 'wood', 4)
    hline(c, 0, w - 1, 2, 'wood', 2)
    hline(c, 0, w - 1, h - 1, 'wood', 1)
    hline(c, 0, w - 1, h - 2, 'wood', 2)
    # Fächer
    n = 3
    inner = h - 5
    step = inner // n
    for s in range(n):
        yb = 3 + (s + 1) * step - 1               # Fachboden-Oberkante
        hline(c, 2, w - 3, yb, 'wood', 4)
        hline(c, 2, w - 3, yb + 1, 'wood', 2)
        x = 2
        hmax = step - 3
        while x < w - 4:
            bw = rnd.choice([2, 3, 3, 4])
            if x + bw > w - 3:
                break
            if rnd.random() < 0.12:
                x += 2                                  # Lücke
                continue
            bh = rnd.randint(hmax - 3, hmax)
            col = rnd.choice(cols)
            draw_book_v(c, x, yb - 1, bw, bh, col, band=rnd.random() < 0.6)
            x += bw
    c.outline()
    return c


def flying_book(pose=0, cover='purple', pages='bone'):
    """fliegendes Buch (18 x 14): aufgeschlagen, die Seiten flattern; pose 0 = Deckel hoch, 1 = flach, 2 = Deckel tief"""
    c = Canvas(18, 15)
    if pose == 0:
        L = [(9, 12), (1, 9), (0, 2), (8, 5)]
        R = [(9, 12), (17, 9), (18, 2), (10, 5)]
    elif pose == 1:
        L = [(9, 12), (1, 11), (1, 5), (8, 6)]
        R = [(9, 12), (17, 11), (17, 5), (10, 6)]
    else:
        L = [(9, 8), (2, 11), (1, 6), (8, 3)]
        R = [(9, 8), (16, 11), (17, 6), (10, 3)]
    poly(c, L, pages, lo=3, hi=5)
    poly(c, R, pages, lo=2, hi=4)
    # Einband als dicke Unterkante und Aussenkante
    for (pts, lit) in ((L, 4), (R, 2)):
        (sx, sy), (ex, ey), (tx, ty), (ux, uy) = pts
        c.line(sx, sy, ex, ey, cover, lit)
        c.line(sx, sy + 1, ex, ey + 1, cover, lit - 1)
        c.line(ex, ey, tx, ty, cover, lit)
        c.line(tx, ty, ux, uy, cover, lit - 1)
    # Textzeilen
    (sx, sy), (ex, ey), (tx, ty), (ux, uy) = L
    for k in range(1, 4):
        t = k / 4.0
        x0 = int(ux + (tx - ux) * 0.15 + (sx - ux) * t * 0.9)
        y0 = int(uy + (ty - uy) * 0.15 + (sy - uy) * t * 0.9)
        c.put_ramp(x0 + 2, y0 + 1, pages, 1)
        c.put_ramp(x0 + 3, y0 + 1, pages, 2)
    c.put_ramp(9, L[0][1], 'gold', 5)
    c.outline()
    return c


def winged_book(cover='teamA', f=0):
    """geschlossenes Buch mit Federflügeln (20 x 14)"""
    c = Canvas(20, 14)
    up = 0 if f == 0 else 3
    poly(c, [(6, 7), (0, 2 + up), (1, 8 + up // 2), (6, 10)], 'bone', lo=3, hi=5)
    poly(c, [(13, 7), (19, 2 + up), (18, 8 + up // 2), (13, 10)], 'bone', lo=2, hi=4)
    for k in range(3):
        c.put_ramp(2 + k, 5 + k + up // 3, 'bone', 2)
        c.put_ramp(17 - k, 5 + k + up // 3, 'bone', 1)
    block(c, 6, 3, 13, 11, cover, hi=4, mid=3, lo=2, deep=1)
    vline(c, 7, 3, 11, 'gold', 3)
    c.put_ramp(10, 6, 'gold', 5)
    c.put_ramp(11, 6, 'gold', 4)
    hline(c, 7, 13, 12, 'bone', 3)
    c.outline()
    return c


def owl_librarian():
    """Eule mit Brille (16 x 20)"""
    c = Canvas(16, 20)
    # Füße
    for (x, y) in ((5, 19), (6, 19), (7, 19), (9, 19), (10, 19), (11, 19)):
        c.put_ramp(x, y, 'gold', 3)
    # Körper
    ellipse(c, 8, 14, 6.4, 5.6, 'dirt', lo=1, hi=4)
    ellipse(c, 8, 15, 3.8, 4.2, 'bone', lo=3, hi=5)
    for (x, y) in ((6, 13), (8, 13), (10, 13), (7, 15), (9, 15), (6, 17), (8, 17), (10, 17)):
        c.put_ramp(x, y, 'bone', 2)
    # Flügel
    poly(c, [(2, 11), (4, 11), (5, 18), (3, 17)], 'wood', lo=1, hi=3)
    poly(c, [(14, 11), (12, 11), (11, 18), (13, 17)], 'wood', lo=1, hi=3)
    # Kopf + Federohren
    poly(c, [(2, 6), (1, 0), (6, 3)], 'dirt', lo=1, hi=4)
    poly(c, [(14, 6), (15, 0), (10, 3)], 'dirt', lo=1, hi=4)
    ellipse(c, 8, 7.5, 6.8, 5.2, 'dirt', lo=2, hi=5)
    ellipse(c, 5.2, 8, 3.2, 3.0, 'bone', lo=4, hi=5)
    ellipse(c, 10.8, 8, 3.2, 3.0, 'bone', lo=3, hi=5)
    # Brille: Goldringe + Pupillen
    for cx in (5, 11):
        for (dx, dy) in ((-2, -1), (-2, 0), (-1, -2), (0, -2), (1, -1), (1, 0), (-1, 1), (0, 1)):
            c.put_ramp(cx + dx, 8 + dy, 'gold', 4)
        c.put_ramp(cx - 1, 8, 'coal', 1)
        c.put_ramp(cx, 8, 'coal', 1)
        c.put_ramp(cx - 1, 7, 'coal', 1)
        c.put_ramp(cx, 7, 'coal', 1)
    c.put_ramp(8, 8, 'gold', 3)
    # Schnabel
    c.put_ramp(8, 10, 'fire', 4)
    c.put_ramp(7, 10, 'fire', 3)
    c.put_ramp(8, 11, 'fire', 3)
    c.outline()
    return c


def librarian_desk():
    """Ausleihtheke: Bücherstapel mit Eule, Glocke, Tintenfass (34 x 32)"""
    c = Canvas(34, 32)
    # Tisch
    block(c, 1, 20, 32, 25, 'wood', hi=5, mid=4, lo=3, deep=2)
    hline(c, 1, 32, 20, 'wood', 5)
    block(c, 3, 26, 30, 31, 'wood', hi=3, mid=2, lo=1, deep=0)
    for x in (9, 18, 27):
        vline(c, x, 27, 31, 'wood', 0)
    c.rect(12, 28, 15, 28, 'gold', 4)
    c.rect(21, 28, 24, 28, 'gold', 4)
    # Stapel
    stack = [('teamA', 15), ('ice', 13), ('leaf', 14)]
    y = 20
    for (col, w) in stack:
        x0 = 17 - w // 2 + 2
        y -= 4
        block(c, x0, y, x0 + w - 1, y + 3, col, hi=4, mid=3, lo=2, deep=1)
        hline(c, x0 + 1, x0 + w - 2, y + 4 if False else y + 3, 'bone', 4)
    # Eule oben auf dem Stapel
    ow = owl_librarian()
    c.blit(ow, 9, y - 18 + 4)
    # Glocke + Tintenfass
    ellipse(c, 5, 18, 2.8, 2.6, 'gold', lo=2, hi=5, clip=lambda x, yy: yy <= 18)
    c.rect(3, 18, 7, 18, 'gold', 2)
    c.put_ramp(5, 15, 'gold', 5)
    ellipse(c, 29, 18, 2.4, 2.2, 'coal', lo=0, hi=3)
    c.line(29, 17, 31, 11, 'bone', 5)
    c.line(30, 17, 32, 12, 'bone', 4)
    c.outline()
    return c


def lectern_forbidden(cover='purple'):
    """Pult mit angekettetem, glotzendem Buch (24 x 30)"""
    c = Canvas(24, 30)
    # Fuß + Säule
    block(c, 5, 26, 18, 29, 'wood', hi=4, mid=3, lo=2, deep=1)
    block(c, 9, 14, 14, 26, 'wood', hi=4, mid=3, lo=2, deep=1)
    # Schrägplatte
    poly(c, [(2, 15), (21, 15), (19, 11), (4, 11)], 'wood', lo=2, hi=5)
    hline(c, 2, 21, 15, 'wood', 1)
    # Buch (Einband zum Betrachter)
    block(c, 4, 1, 19, 11, cover, hi=4, mid=3, lo=2, deep=1)
    hline(c, 5, 18, 12, 'bone', 4)
    hline(c, 6, 18, 13, 'bone', 2)
    # Schliesse + Kette
    c.rect(18, 4, 20, 8, 'gold', 4)
    c.put_ramp(19, 6, 'coal', 1)
    for k in range(6):
        c.put_ramp(4 + k * 2, 3 + k, 'metal', 4 if k % 2 else 3)
        c.put_ramp(5 + k * 2, 3 + k, 'metal', 2)
        c.put_ramp(17 - k * 2, 3 + k, 'metal', 4 if k % 2 else 3)
    # das Auge auf dem Deckel
    c.rect(9, 5, 14, 7, 'gold', 5)
    c.rect(10, 4, 13, 4, 'gold', 4)
    c.rect(10, 8, 13, 8, 'gold', 3)
    c.rect(11, 5, 12, 7, 'coal', 1)
    c.outline()
    return c


def window_night(w=18, h=24, star=False):
    """Fenster mit Nachthimmel, Mond und Sternen; star=True: Sternschnuppe"""
    c = Canvas(w, h)
    cx = (w - 1) / 2.0
    r = w / 2.0
    for y in range(1, h - 2):
        for x in range(1, w - 1):
            if y < r:
                dx = (x - cx) / (r - 1)
                dy = (y - r) / (r - 1)
                if dx * dx + dy * dy > 1.0:
                    continue
            base = 0 if y < h * 0.45 else 1
            c.put_ramp(x, y, 'sky', base)
            if (x + y) % 2 == 0 and abs(y - h * 0.45) < 3:
                c.put_ramp(x, y, 'sky', 1 - base)
    # Sprosse
    vline(c, int(cx), 4, h - 4, 'stone', 4)
    vline(c, int(cx) + 1, 4, h - 4, 'stone', 2)
    hline(c, 1, w - 2, int(h * 0.55), 'stone', 4)
    hline(c, 1, w - 2, int(h * 0.55) + 1, 'stone', 2)
    # Sims
    hline(c, 0, w - 1, h - 3, 'stone', 5)
    hline(c, 0, w - 1, h - 2, 'stone', 3)
    hline(c, 0, w - 1, h - 1, 'stone', 1)
    if star:
        for k in range(8):
            c.put_ramp(w - 5 - k, 4 + k // 2, 'gold', 5 if k < 3 else 4 if k < 6 else 3)
        c.put_ramp(w - 4, 3, 'bone', 5)
        c.put_ramp(w - 5, 4, 'bone', 5)
        c.put_ramp(3, 7, 'bone', 4)
        c.put_ramp(4, 12, 'bone', 5)
    else:
        ellipse(c, 5, 8, 2.8, 2.8, 'gold', lo=3, hi=5)
        ellipse(c, 6.5, 7, 2.4, 2.4, 'sky', lo=0, hi=0)      # Sichel
        c.put_ramp(12, 5, 'bone', 5)
        c.put_ramp(10, 12, 'bone', 4)
        c.put_ramp(13, 10, 'bone', 5)
    c.outline()
    return c


def candle_sconce():
    """Wandkerze (8 x 12)"""
    c = Canvas(8, 12)
    c.rect(3, 5, 4, 10, 'bone', 4)
    c.rect(3, 5, 3, 10, 'bone', 5)
    c.rect(1, 10, 6, 10, 'metal', 3)
    c.put_ramp(3, 11, 'metal', 2)
    c.put_ramp(4, 11, 'metal', 2)
    c.put_ramp(3, 3, 'gold', 5)
    c.put_ramp(3, 4, 'fire', 4)
    c.put_ramp(4, 4, 'fire', 3)
    c.put_ramp(3, 2, 'gold', 4)
    c.outline()
    return c


