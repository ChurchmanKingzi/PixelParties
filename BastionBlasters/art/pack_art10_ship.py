"""pack_art10: Geschuetzdeck (BP-02) und Luftdock (BF-08): Schiffs- und Luftschiff-Props, Raum-Themen."""
from __future__ import annotations

from pack_art10_kit import *


# =========================================================================== Geschuetzdeck


def gun_pad():
    """Geschuetzplatz: runde Eisenplatte im Holzring, Draufsicht (Bodendekor, 24 x 24, ohne Outline)"""
    c = Canvas(24, 24)
    cx = cy = 11.5
    for y in range(24):
        for x in range(24):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > 11.6:
                continue
            lit = (-dx - dy) / (d + 0.01)
            if d > 10.3:
                c.put_ramp(x, y, 'wood', 0)
            elif d > 7.9:
                c.put_ramp(x, y, 'wood', 4 if lit > 0.3 else (3 if lit > -0.4 else 2))
            elif d > 7.0:
                c.put_ramp(x, y, 'wood', 1)
            else:
                idx = 3 if lit > 0.55 else (2 if lit > -0.35 else 1)
                if d > 5.2 and (x + y) % 2 == 0:
                    idx = min(5, idx + 1)
                c.put_ramp(x, y, 'metal', idx)
    # Nieten und Kreuzsteg
    for (dx, dy) in ((-4, -4), (4, -4), (-4, 4), (4, 4)):
        c.put_ramp(int(cx + dx), int(cy + dy), 'metal', 5)
        c.put_ramp(int(cx + dx) + 1, int(cy + dy) + 1, 'metal', 1)
    for k in range(-6, 6):
        c.put_ramp(int(cx + k), int(cy), 'metal', 1)
        c.put_ramp(int(cx), int(cy + k), 'metal', 1)
    c.rect(10, 10, 13, 13, 'metal', 4)
    c.rect(10, 10, 11, 11, 'metal', 5)
    c.rect(12, 12, 13, 13, 'metal', 2)
    return c


def ship_cannon():
    """Schiffskanone von der Seite, Mündung rechts, 34 x 22"""
    c = Canvas(34, 22)
    # Lafette
    poly(c, [(5, 13), (24, 13), (22, 19), (7, 19)], 'wood', lo=1, hi=4)
    c.rect(5, 13, 24, 13, 'wood', 5)
    c.rect(7, 19, 22, 19, 'wood', 0)
    # Rad hinten und vorne
    for wx in (9, 21):
        ellipse(c, wx, 17, 4.6, 4.6, 'wood', lo=1, hi=4)
        ellipse(c, wx, 17, 2.4, 2.4, 'wood', lo=0, hi=2)
        c.put_ramp(wx, 17, 'metal', 4)
        c.put_ramp(wx - 4, 17, 'wood', 0)
        c.put_ramp(wx + 4, 17, 'wood', 0)
    # Rohr: nach rechts leicht ansteigend, konisch
    poly(c, [(3, 7), (3, 14), (27, 12), (27, 6)], 'coal', lo=1, hi=4)
    for x in range(5, 27):
        c.put_ramp(x, 7 - (x - 5) // 14, 'coal', 5 if x % 3 else 4)
    # Verstaerkungsringe
    for x in (9, 16):
        c.rect(x, 6 - (x - 3) // 14, x + 1, 14 - (x - 3) // 12, 'coal', 2)
        c.put_ramp(x, 7 - (x - 3) // 14, 'coal', 4)
    # Muendungswulst
    c.rect(26, 4, 29, 13, 'coal', 3)
    c.rect(26, 4, 26, 13, 'coal', 4)
    c.rect(29, 4, 29, 13, 'coal', 1)
    c.rect(30, 6, 30, 11, 'coal', 0)
    c.rect(27, 7, 28, 10, 'coal', 0)
    # Traube hinten
    ellipse(c, 2.5, 10.5, 2.6, 2.6, 'coal', lo=1, hi=4)
    # Zuendloch mit Funke
    c.put_ramp(8, 5, 'coal', 1)
    c.put_ramp(8, 4, 'fire', 5)
    c.put_ramp(9, 3, 'gold', 5)
    c.put_ramp(7, 3, 'fire', 4)
    c.outline()
    return c


def ball_pile():
    """Kugelpyramide, 18 x 14"""
    c = Canvas(18, 14)
    balls = [(4.5, 10.5), (9, 10.5), (13.5, 10.5), (6.8, 6.4), (11.2, 6.4), (9, 2.4)]
    for (bx, by) in balls:
        ellipse(c, bx + 0.5, by + 0.5, 3.9, 3.9, 'coal', lo=0, hi=0)
        ellipse(c, bx + 0.2, by + 0.2, 3.1, 3.1, 'coal', lo=1, hi=4, ambient=0.2)
        c.put_ramp(int(bx - 1), int(by - 1), 'metal', 4)
        c.put_ramp(int(bx - 1), int(by), 'metal', 3)
        c.put_ramp(int(bx), int(by - 1), 'metal', 3)
    c.outline()
    return c


def rope_coil():
    """aufgeschossenes Tau, flach, 16 x 9"""
    c = Canvas(16, 9)
    cx, cy, rx, ry = 7.5, 4.4, 7.0, 3.6
    for y in range(9):
        for x in range(16):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d > 1.0:
                continue
            if d < 0.12:
                c.put_ramp(x, y, 'wood', 1)
                continue
            ring = int(d * 4.2)
            lit = (x + 0.5 - cx) * -0.5 + (y + 0.5 - cy) * -0.9
            base = 4 if ring % 2 == 0 else 3
            if lit < -1.2:
                base -= 1
            c.put_ramp(x, y, 'dirt', base)
    c.put_ramp(14, 6, 'dirt', 4)
    c.put_ramp(15, 7, 'dirt', 3)
    c.put_ramp(15, 8, 'dirt', 3)
    c.outline()
    return c


def ship_wheel():
    """Steuerrad auf Pfosten, 24 x 28"""
    c = Canvas(24, 28)
    cx, cy = 12, 11
    c.rect(10, 18, 13, 26, 'wood', 3)
    c.rect(10, 18, 10, 26, 'wood', 4)
    c.rect(13, 18, 13, 26, 'wood', 1)
    c.rect(8, 25, 15, 26, 'wood', 2)
    # Speichen
    for a in range(0, 360, 45):
        r = math.radians(a)
        x1, y1 = cx + math.cos(r) * 9.4, cy + math.sin(r) * 9.4
        thick_line(c, cx, cy, x1, y1, 1.6, 'wood', lo=2, hi=4)
        # Griffe
        gx, gy = cx + math.cos(r) * 10.8, cy + math.sin(r) * 10.8
        c.put_ramp(int(gx), int(gy), 'wood', 5)
        c.put_ramp(int(gx), int(gy) + 1, 'wood', 2)
    # Felge
    for y in range(24):
        for x in range(24):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if 6.6 < d <= 8.4:
                lit = (-(x + 0.5 - cx) - (y + 0.5 - cy)) / (d + 0.01)
                c.put_ramp(x, y, 'wood', 4 if lit > 0.3 else (3 if lit > -0.5 else 2))
    ellipse(c, cx + 0.5, cy + 0.5, 2.6, 2.6, 'gold', lo=2, hi=5)
    c.outline()
    return c


def ship_mast(team='teamA'):
    """Mast mit Kraehennest, gerefftem Segel und Wimpel, Fusspunkt unten Mitte, 34 x 44"""
    c = Canvas(34, 44)
    cx = 17
    # Mast
    thick_line(c, cx, 42, cx, 8, 4.6, 'wood', lo=1, hi=4)
    for y in range(14, 42, 5):
        c.put_ramp(cx - 2, y, 'wood', 5)
    # Mastfuss: Eisenring
    c.rect(cx - 4, 37, cx + 4, 39, 'metal', 3)
    c.rect(cx - 4, 37, cx + 4, 37, 'metal', 5)
    c.rect(cx - 4, 40, cx + 4, 43, 'wood', 1)
    c.rect(cx - 4, 40, cx + 4, 40, 'wood', 2)
    # Rah mit gerefftem Segel
    thick_line(c, 2, 19, 31, 19, 2.6, 'wood', lo=1, hi=4)
    thick_line(c, 4, 23, 29, 23, 4.6, 'bone', lo=2, hi=5)
    for x in range(7, 29, 5):
        c.rect(x, 21, x + 1, 25, team, 3)
        c.put_ramp(x, 21, team, 4)
    # Kraehennest
    round_rect(c, cx - 6, 8, cx + 6, 14, 'wood', lo=1, hi=4, radius=1)
    for x in range(cx - 6, cx + 7, 3):
        c.rect(x, 6, x, 8, 'wood', 4)
    c.rect(cx - 6, 6, cx + 6, 6, 'wood', 3)
    # Fahnenstange und Wimpel
    c.rect(cx, 1, cx, 6, 'wood', 3)
    poly(c, [(cx + 1, 0), (cx + 11, 2), (cx + 5, 3), (cx + 10, 5), (cx + 1, 5)], team, lo=1, hi=4)
    c.put_ramp(cx + 4, 2, 'gold', 5)
    c.outline()
    return c


def pirate_gnome():
    """Matrose mit Schrubber und Papagei, 18 x 22"""
    c = Canvas(18, 22)
    # Schrubber hinter dem Koerper
    c.rect(15, 6, 15, 19, 'wood', 3)
    c.rect(15, 6, 15, 19, 'wood', 4)
    for x in range(12, 18):
        c.rect(x, 19, x, 21, 'bone', 3 if (x % 2) else 4)
    c.put_ramp(12, 21, 'bone', 2)
    c.put_ramp(14, 21, 'bone', 2)
    c.put_ramp(17, 21, 'bone', 2)
    # Beine
    thick_line(c, 7, 15, 6, 19, 2.6, 'sky', lo=1, hi=3)
    thick_line(c, 11, 15, 11, 19, 2.6, 'sky', lo=2, hi=4)
    c.rect(4, 19, 7, 20, 'wood', 2)
    c.rect(9, 19, 12, 20, 'wood', 3)
    c.rect(4, 20, 7, 20, 'wood', 1)
    c.rect(9, 20, 12, 20, 'wood', 1)
    # Koerper: Ringelshirt
    round_rect(c, 5, 9, 12, 16, 'bone', lo=2, hi=5, radius=2)
    for y in (10, 12, 14):
        c.rect(5, y, 12, y, 'teamA', 3)
        c.put_ramp(5, y, 'teamA', 4)
    c.rect(5, 16, 12, 16, 'wood', 2)       # Guertel
    c.put_ramp(8, 16, 'gold', 5)
    # Arme
    thick_line(c, 5, 10, 3, 14, 2.0, 'skin', lo=1, hi=4)
    thick_line(c, 12, 10, 14, 13, 2.0, 'skin', lo=3, hi=5)
    c.put_ramp(14, 13, 'skin', 4)
    # Kopf
    ellipse(c, 9, 6, 3.9, 3.6, 'skin', lo=2, hi=5)
    c.put_ramp(11, 6, 'coal', 1)
    c.put_ramp(11, 7, 'coal', 1)
    c.rect(8, 8, 10, 8, 'skin', 1)
    # Kopftuch mit Knoten
    c.rect(5, 3, 13, 4, 'teamA', 3)
    c.rect(5, 3, 13, 3, 'teamA', 4)
    c.rect(5, 4, 13, 4, 'teamA', 2)
    c.put_ramp(4, 4, 'teamA', 3)
    c.put_ramp(3, 5, 'teamA', 2)
    c.put_ramp(2, 6, 'teamA', 2)
    c.put_ramp(3, 6, 'teamA', 3)
    # Augenklappe
    c.rect(10, 5, 11, 6, 'coal', 0)
    c.put_ramp(9, 4, 'coal', 1)
    # Papagei auf der Schulter
    c.rect(2, 7, 3, 10, 'fire', 3)
    c.put_ramp(2, 7, 'fire', 4)
    c.put_ramp(2, 6, 'fire', 4)
    c.put_ramp(3, 6, 'fire', 3)
    c.put_ramp(4, 7, 'gold', 4)
    c.put_ramp(1, 11, 'sky', 3)
    c.put_ramp(2, 11, 'sky', 4)
    c.put_ramp(3, 10, 'gold', 3)
    c.outline()
    return c


def barrel_small():
    """Pulverfass mit Eisenbaendern (kuerzer als barrel), 14 x 14"""
    c = Canvas(14, 14)
    round_rect(c, 1, 2, 12, 12, 'wood', lo=1, hi=4, radius=3)
    ellipse(c, 6.5, 2.8, 5.2, 2.0, 'wood', lo=2, hi=5)
    for y in (5, 10):
        for x in range(1, 13):
            c.put_ramp(x, y, 'metal', 2 if x > 6 else 3)
    c.outline()
    return c


def bulwark_front(w, h=19, shield_gap=24, team='teamA'):
    """Holz-Schanzkleid (Vorderansicht) mit Handlauf, Plankengaengen und Rundschilden"""
    c = Canvas(w, h)
    for x in range(w):
        for y in range(h):
            if y < 3:
                idx = (5, 4, 3)[y]
            elif y == 3:
                idx = 1
            else:
                idx = 3 if y < 9 else 2
                if y in (9, 14):
                    idx = 1
                elif y in (10, 15):
                    idx += 1
                if x % 22 == 5 and y not in (9, 14):
                    idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
        if w - 1 - x < 1:
            for y in range(h):
                c.put_ramp(x, y, 'wood', 1)
    c.rect(0, 0, 0, h - 1, 'wood', 4)
    # Schilde
    for x in range(shield_gap // 2 + 1, w - 6, shield_gap):
        ellipse(c, x + 0.5, 10.5, 4.4, 4.4, 'wood', lo=0, hi=0)
        ellipse(c, x + 0.5, 10.5, 3.7, 3.7, team, lo=1, hi=4)
        c.rect(x - 4, 10, x + 5, 10, 'bone', 4)
        ellipse(c, x + 0.5, 10.5, 1.3, 1.3, 'metal', lo=2, hi=5)
    return c


def bulwark_side(h):
    """Seitliche Reling von oben gesehen (8 breit): Holzbalken mit Pfosten und Tau"""
    c = Canvas(8, h)
    for y in range(h):
        for x in range(8):
            idx = 4 if x < 2 else (3 if x < 6 else 2)
            if x == 7:
                idx = 1
            c.put_ramp(x, y, 'wood', idx)
    for y in range(3, h - 3, 14):
        c.rect(1, y, 6, y + 3, 'wood', 5)
        c.rect(1, y + 3, 6, y + 3, 'wood', 2)
        c.put_ramp(6, y, 'wood', 3)
    for y in range(3, h - 15, 14):
        for k in range(10):
            c.put_ramp(3 + (1 if k % 4 == 1 else 0), y + 4 + k, 'dirt', 4 if k % 2 else 3)
    return c


def furnish_gundeck(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    cx = X0 + W // 2
    wd = ctx.world
    # Schanzkleid statt Steinwaenden
    wd.draw(bulwark_front(W - 8, 19), X0 + 4, Y0 - 4 - 10 + 1, Y0 + 4)
    side = bulwark_side(H + 18)
    wd.draw(side, X0 - 4, Y0 - 4 - 10 + 1, 98)
    wd.draw(side, X0 + W - 4, Y0 - 4 - 10 + 1, 98)
    sy = Y0 + H - 4 - 10 + 1
    for (x0, x1) in ((X0 - 4, cx - 8), (cx + 8, X0 + W + 4)):
        wd.draw(bulwark_front(x1 - x0, 18, shield_gap=22), x0, sy, 120)
    # drei Geschuetzplaetze in einer Reihe
    pad = gun_pad()
    py_ = Y0 + 41
    centers = [(X0 + 22, py_), (cx, py_), (X0 + W - 22, py_)]
    for (px_, pyy) in centers:
        ctx.floor_deco(pad, px_ - 12, pyy - 12)
        ctx.platform(px_, pyy)
    ctx.prop(ship_mast(), cx - 17, Y0 + 22 - 43)
    ctx.prop(ship_cannon(), centers[0][0] - 17, py_ + 6 - 21)
    ctx.prop(ball_pile(), X0 + W - 26, Y0 + 5)
    ctx.prop(barrel_small(), X0 + 6, Y0 + 7)
    ctx.prop(rope_coil(), X0 + 24, Y0 + 14)


THEME_GUNDECK = {'floor': tile_deck(4), 'furnish': furnish_gundeck, 'low': True}



# =========================================================================== Luftdock


def zeppelin(team='teamA'):
    """Walfoermiges Luftschiff (Brummzeppelin): blauer Wal-Ballon, Bullaugen, Stummelflossen, Gondel; Nase rechts. 72 x 38"""
    c = Canvas(72, 38)
    x_l, x_r, cy = 2.0, 68.0, 15.0
    cxm = 44.0                                  # Ellipsenmitte: links lang und spitz, rechts kurz und rund
    ry = 12.5

    def half(x):
        if x < x_l or x > x_r:
            return 0.0
        if x <= cxm:
            u = (cxm - x) / (cxm - x_l)
            return ry * (1.0 - u ** 1.7) ** (1 / 1.7)
        u = (x - cxm) / (x_r - cxm)
        return ry * math.sqrt(max(0.0, 1.0 - u * u))

    def inside(x, y):
        h = half(x + 0.5)
        return h > 0.3 and abs(y + 0.5 - cy) <= h

    def shade(x, y):
        h = half(x + 0.5)
        v = (y + 0.5 - (cy - h)) / (2 * h)          # 0 oben .. 1 unten
        u = (x - x_l) / (x_r - x_l)
        return 0.98 - 0.78 * v ** 1.15 - 0.12 * u + (0.1 if v < 0.2 else 0.0)

    mask_fill(c, inside, 'sky', shade, lo=1, hi=5, bounds=(0, 0, 71, 33))
    # heller Bauch (Walbauch) mit Falten
    for y in range(int(cy), 34):
        for x in range(0, 72):
            if not inside(x, y):
                continue
            h = half(x + 0.5)
            v = (y + 0.5 - (cy - h)) / (2 * h)
            if v > 0.66:
                L = 0.55 + 0.4 * (1 - (x - x_l) / (x_r - x_l)) * 0.4
                idx = 3 if (x + y) % 2 == 0 else 4
                c.put_ramp(x, y, 'fur', idx if v > 0.74 else 3)
    for x in range(14, 62, 5):
        h = half(x + 0.5)
        y0 = int(cy + h * 0.45)
        for k in range(0, 4):
            if inside(x, y0 + k + 3):
                c.put_ramp(x, y0 + k + 3, 'fur', 2)
    # Ballon-Naehte (leichte Kurven)
    for x in (20, 30, 40, 50):
        h = half(x + 0.5)
        for y in range(int(cy - h) + 1, int(cy + h * 0.55)):
            if (y + x) % 2 == 0:
                c.put_ramp(x + (1 if y > cy else 0), y, 'sky', 1)
    # Stummelflossen in Teamfarbe
    poly(c, [(4, 12), (0, 2), (12, 7), (14, 11)], team, lo=1, hi=4)
    poly(c, [(4, 19), (0, 28), (12, 23), (14, 19)], team, lo=0, hi=3)
    # Auge, Maul und Wange
    c.rect(60, 8, 61, 9, 'coal', 0)
    c.put_ramp(60, 8, 'bone', 5)
    for k in range(9):
        mx, my = 65 - k, 18 - (1 if k > 5 else 0)
        if inside(mx, my):
            c.put_ramp(mx, my, 'coal', 1)
    c.put_ramp(58, 16, 'skin', 3)
    c.put_ramp(59, 16, 'skin', 3)
    # Bullaugen
    for x in (28, 36, 44, 52):
        c.rect(x - 1, 15, x + 1, 17, 'gold', 4)
        c.put_ramp(x, 16, 'ice', 5)
        c.put_ramp(x - 1, 15, 'gold', 5)
        c.put_ramp(x + 1, 17, 'gold', 2)
    # Gondel (haengt direkt am Bauch)
    round_rect(c, 26, 25, 46, 32, 'wood', lo=1, hi=4, radius=2)
    c.rect(28, 27, 44, 27, 'gold', 4)
    for x in (30, 35, 40):
        c.rect(x, 28, x + 2, 29, 'ice', 4)
    c.rect(26, 32, 46, 32, team, 2)
    # Propeller hinten an der Gondel
    c.rect(23, 28, 25, 30, 'metal', 3)
    c.put_ramp(23, 28, 'metal', 4)
    c.rect(21, 23, 21, 35, 'metal', 4)
    c.rect(22, 24, 22, 34, 'metal', 2)
    c.rect(21, 23, 22, 23, 'metal', 5)
    c.outline()
    return c


def mooring_mast(team='teamA', h=56):
    """Anlegemast: Eisen-Gittermast mit Ankerkegel und Windsack, Fusspunkt unten, 30 x h"""
    c = Canvas(30, h)
    cx = 15
    top = 20
    # Gitter
    for (x0, x1) in ((cx - 5, cx + 5),):
        for y in range(top, h - 3):
            c.put_ramp(x0, y, 'metal', 4)
            c.put_ramp(x0 + 1, y, 'metal', 3)
            c.put_ramp(x1 - 1, y, 'metal', 2)
            c.put_ramp(x1, y, 'metal', 1)
        for y in range(top, h - 8, 7):
            thick_line(c, x0 + 1, y, x1 - 1, y + 7, 1.4, 'metal', lo=1, hi=3)
            thick_line(c, x1 - 1, y, x0 + 1, y + 7, 1.4, 'metal', lo=2, hi=4)
            c.rect(x0, y, x1, y, 'metal', 4)
    # Fussplatte
    c.rect(cx - 8, h - 4, cx + 8, h - 2, 'metal', 2)
    c.rect(cx - 8, h - 4, cx + 8, h - 4, 'metal', 4)
    c.rect(cx - 8, h - 1, cx + 8, h - 1, 'metal', 0)
    # Ankerkegel
    poly(c, [(cx - 7, top), (cx + 7, top), (cx + 3, top - 8), (cx - 3, top - 8)], 'metal', lo=1, hi=5)
    c.rect(cx - 7, top, cx + 7, top + 1, 'gold', 4)
    c.rect(cx - 7, top, cx + 7, top, 'gold', 5)
    ellipse(c, cx + 0.5, top - 10, 2.6, 2.6, 'gold', lo=2, hi=5)
    c.put_ramp(cx, top - 10, 'coal', 1)
    # Windsack-Stange und Sack (weht nach links)
    c.rect(cx + 4, top - 14, cx + 4, top - 8, 'metal', 3)
    for k in range(6):
        x = cx + 3 - k * 2
        hh = 3 - k // 2
        col = (team, 3) if k % 2 == 0 else ('bone', 4)
        y0 = top - 16 + k // 2
        c.rect(x - 1, y0, x, y0 + hh, col[0], col[1])
        c.put_ramp(x - 1, y0, col[0], col[1] + 1)
    c.outline()
    return c


def gas_tank(team='teamA'):
    """Gasflasche: weiss-blau mit Teamband und goldenem Ventil, 11 x 24"""
    c = Canvas(11, 24)
    round_rect(c, 1, 5, 9, 22, 'fur', lo=1, hi=5, radius=3)
    c.rect(1, 11, 9, 13, team, 3)
    c.rect(1, 11, 9, 11, team, 4)
    c.rect(1, 13, 9, 13, team, 2)
    c.rect(4, 2, 6, 5, 'gold', 4)
    c.rect(4, 2, 4, 5, 'gold', 5)
    c.rect(3, 1, 7, 2, 'gold', 3)
    c.put_ramp(8, 3, 'metal', 3)
    c.put_ramp(9, 3, 'metal', 4)
    c.rect(1, 21, 9, 22, 'metal', 2)
    c.outline()
    return c


def cloud_banner():
    """Wolkenbanner: weisse Wolke auf blauem Tuch (Luft frei), 14 x 22"""
    c = Canvas(14, 22)
    c.rect(1, 1, 12, 1, 'wood', 4)
    for y in range(2, 19):
        for x in range(2, 12):
            idx = 3 if x < 6 else 2
            if y > 14:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'sky', idx)
    for (x, y) in ((4, 18), (5, 19), (6, 20), (7, 19), (8, 18), (9, 19)):
        c.put_ramp(x, y, 'sky', 2)
    puff(c, 7, 10, 4.2, 2.4, 'fur', lo=3, hi=5)
    puff(c, 5, 9, 2.2, 2.0, 'fur', lo=3, hi=5)
    puff(c, 9, 9, 2.4, 2.2, 'fur', lo=3, hi=5)
    c.outline()
    return c


def landing_ring():
    """Landekreis auf dem Boden: Ring und Kreuz, Draufsicht (Bodendekor), 38 x 38"""
    c = Canvas(38, 38)
    cx = cy = 18.5
    for y in range(38):
        for x in range(38):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
            if 15.0 < d <= 17.5:
                if int((ang + 3.2) * 5.5) % 2 == 0 or d < 16:
                    c.put_ramp(x, y, 'bone', 4 if (x + y) % 2 else 5)
            elif 8.5 < d <= 10.0:
                c.put_ramp(x, y, 'sky', 4 if (x + y) % 2 else 3)
    for k in range(-13, 14):
        if abs(k) > 6 or abs(k) < 3:
            c.put_ramp(int(cx + k), int(cy), 'bone', 4)
            c.put_ramp(int(cx), int(cy + k), 'bone', 4)
    c.rect(17, 17, 20, 20, 'teamA', 3)
    c.rect(17, 17, 18, 18, 'teamA', 4)
    return c


def hazard_strip(w, h=6):
    """Warnstreifen (gold/dunkel schraeg) als Bodendekor"""
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            if (x + y) % 8 < 4:
                c.put_ramp(x, y, 'gold', 4 if y < 2 else 3)
            else:
                c.put_ramp(x, y, 'coal', 2 if y < 2 else 1)
    return c


def pilot_gnome():
    """Luftschiff-Lotse: Fliegerkappe mit Brille, langer Schal, haelt ein Tau, 18 x 24"""
    c = Canvas(18, 24)
    # Beine
    thick_line(c, 7, 17, 6, 21, 2.6, 'wood', lo=1, hi=3)
    thick_line(c, 11, 17, 11, 21, 2.6, 'wood', lo=2, hi=4)
    c.rect(4, 21, 7, 22, 'coal', 2)
    c.rect(9, 21, 13, 22, 'coal', 3)
    c.rect(4, 22, 13, 22, 'coal', 1)
    # Lederjacke
    round_rect(c, 5, 10, 12, 18, 'wood', lo=1, hi=4, radius=2)
    c.rect(8, 11, 8, 17, 'wood', 5)
    c.rect(5, 17, 12, 17, 'wood', 1)
    c.put_ramp(10, 13, 'gold', 4)
    # Arme nach oben (haelt das Tau)
    thick_line(c, 12, 11, 14, 5, 2.0, 'wood', lo=3, hi=4)
    c.rect(14, 3, 15, 5, 'skin', 4)
    thick_line(c, 5, 11, 8, 5, 2.0, 'wood', lo=1, hi=3)
    c.rect(8, 3, 9, 5, 'skin', 3)
    # Kopf
    ellipse(c, 9, 9, 3.8, 3.4, 'skin', lo=2, hi=5)
    c.put_ramp(11, 9, 'coal', 1)
    c.rect(8, 11, 10, 11, 'skin', 1)
    # Kappe und Brille
    ellipse(c, 9, 6.2, 4.6, 3.2, 'wood', lo=0, hi=3, clip=lambda x, y: y <= 7)
    c.rect(5, 7, 13, 7, 'wood', 1)
    c.rect(9, 5, 12, 6, 'gold', 4)
    c.put_ramp(10, 5, 'ice', 5)
    c.put_ramp(11, 5, 'ice', 4)
    c.rect(5, 6, 8, 6, 'coal', 1)
    # Schal in Teamfarbe flattert nach links hinten
    c.rect(6, 11, 11, 12, 'teamA', 3)
    c.rect(6, 11, 11, 11, 'teamA', 4)
    for k in range(6):
        c.put_ramp(5 - k, 11 - (1 if k > 2 else 0) + (k % 2), 'teamA', 4 if k < 3 else 3)
        c.put_ramp(5 - k, 12 - (1 if k > 2 else 0) + (k % 2), 'teamA', 2)
    c.outline()
    return c


def furnish_airdock(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    P = ctx.P
    cx = X0 + W // 2
    ctx.floor_deco(landing_ring(), cx - 12, Y0 + 20)
    ctx.floor_deco(hazard_strip(30), X0 + 6, Y0 + H - 26)
    ctx.floor_deco(hazard_strip(30), X0 + W - 36, Y0 + H - 26)
    ctx.prop(mooring_mast(), X0 + W - 30, Y0 + 32 - 56 + 8)
    ctx.prop(gas_tank(), X0 + 6, Y0 + 20)
    ctx.prop(gas_tank(), X0 + 17, Y0 + 24)
    ctx.prop(P['crate'], X0 + W - 20, Y0 + 36)


THEME_AIRDOCK = {'floor': tile_planks(23, 32, tone=(3, 4, 4)).px[:, :, :3].copy(), 'furnish': furnish_airdock, 'low': False}
