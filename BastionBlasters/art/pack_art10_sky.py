"""pack_art10: Sternwarte (BP-03), Wolkenanker (BP-04), Schwebende Festung (BP-06): Turm- und Insel-Sprites."""
from __future__ import annotations

from pack_art10_kit import *


def _cyl_idx(x, y, x0, x1, lo=1, hi=4, dw=0.18):
    """Zylinder-Schattierung (Licht links oben) fuer Pixel x in x0..x1"""
    u = (x - x0 + 0.5) / (x1 - x0 + 1)
    nn = u * 2 - 1
    nz = math.sqrt(max(0.0, 1 - nn * nn))
    dot = nn * LIGHT[0] + nz * LIGHT[2]
    L = 0.16 + 0.84 * max(0.0, dot)
    return quant(L, lo, hi, x, y, dw=dw)


# =========================================================================== Sternwarte


def observatory_tower(team='teamA'):
    """Kuppelturm: Steinsockel mit Kristallband und Sternkarte, Balkon, violette Kuppel mit Spalt, Teleskop. 52 x 82"""
    W, H = 52, 82
    c = Canvas(W, H)
    cx = 25
    # --- Sockel (Zylinder y 46..78)
    bx0, bx1 = cx - 15, cx + 14
    for y in range(46, 79):
        for x in range(bx0, bx1 + 1):
            idx = _cyl_idx(x, y, bx0, bx1)
            row, yy = (y - 46) // 6, (y - 46) % 6
            if yy == 5:
                idx = max(1, idx - 1)
            elif ((x + (7 if row % 2 else 0)) % 14) == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'stone', idx)
    # Kristallband (Eis-Facetten)
    for y in range(60, 65):
        for x in range(bx0, bx1 + 1):
            u = (x - bx0) / float(bx1 - bx0)
            f = (x // 5) % 2
            idx = 4 if (f == 0 and y < 62) else (3 if f == 0 else (2 if y < 62 else 1))
            if u > 0.8:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'ice', idx)
    for x in range(bx0 + 2, bx1, 5):
        c.put_ramp(x, 60, 'ice', 5)
    # Tor
    poly(c, [(cx - 4, 78), (cx + 4, 78), (cx + 4, 70), (cx, 66), (cx - 4, 70)], 'wood', lo=1, hi=4)
    c.rect(cx, 67, cx, 78, 'wood', 0)
    c.put_ramp(cx + 2, 74, 'gold', 5)
    # Sternkarte (Scheibe an der Wand)
    for y in range(47, 60):
        for x in range(cx - 7, cx + 7):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - 53.5)
            if d <= 6.6:
                c.put_ramp(x, y, 'bone' if d > 5.6 else 'ice', 4 if d > 5.6 else (2 if (x + y) % 5 else 1))
    for (x, y) in ((cx - 3, 50), (cx, 52), (cx + 3, 51), (cx - 2, 56), (cx + 2, 56), (cx + 4, 54), (cx - 4, 54)):
        c.put_ramp(x, y, 'gold', 5)
    c.line(cx - 3, 50, cx, 52, 'gold', 3)
    c.line(cx, 52, cx + 3, 51, 'gold', 3)
    c.line(cx - 2, 56, cx + 2, 56, 'gold', 3)
    # --- Trommel y 30..46
    dx0, dx1 = cx - 12, cx + 11
    for y in range(31, 47):
        for x in range(dx0, dx1 + 1):
            idx = _cyl_idx(x, y, dx0, dx1)
            c.put_ramp(x, y, 'stone', idx)
    for wx in (cx - 7, cx + 1, cx + 7):
        c.rect(wx, 35, wx + 1, 42, 'gold', 4)
        c.put_ramp(wx, 34, 'gold', 4)
        c.put_ramp(wx, 35, 'gold', 5)
        c.rect(wx + 1, 38, wx + 1, 42, 'gold', 3)
    # Balkon
    c.rect(bx0 - 4, 44, bx1 + 4, 46, 'stone', 4)
    c.rect(bx0 - 4, 44, bx1 + 4, 44, 'stone', 5)
    c.rect(bx0 - 4, 46, bx1 + 4, 46, 'stone', 2)
    c.rect(bx0 - 4, 47, bx1 + 4, 47, 'stone', 0)
    for x in range(bx0 - 3, bx1 + 5, 4):
        c.rect(x, 41, x, 43, 'ice', 4)
    c.rect(bx0 - 4, 40, bx1 + 4, 40, 'ice', 5)
    # --- Kuppel (violett) y 10..31
    kx0, kx1, ky = cx - 14, cx + 13, 31
    for y in range(9, 32):
        t = (31 - y) / 22.0
        half = 14.2 * math.sqrt(max(0.0, 1 - t * t))
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half)) / (2 * half + 0.01)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot = nn * LIGHT[0] + (1 - t) * 0.2 + nz * LIGHT[2] * (0.8 + 0.2 * t) - 0.35 * t * LIGHT[1] * -1
            L = 0.2 + 0.8 * max(0.0, min(1.0, dot * 1.1 + 0.1 * (1 - t)))
            c.put_ramp(x, y, 'purple', quant(L, 1, 5, x, y, dw=0.16))
    # Rippen
    for rx in (cx - 8, cx - 3):
        for y in range(13, 31):
            t = (31 - y) / 22.0
            half = 14.2 * math.sqrt(max(0.0, 1 - t * t))
            if abs(rx - cx) < half - 1:
                c.put_ramp(rx, y, 'purple', 1)
    c.rect(kx0, 30, kx1, 31, 'ice', 3)
    c.rect(kx0, 30, kx1, 30, 'ice', 5)
    # Spalt rechts: dunkler Himmel mit Sternen
    for y in range(11, 31):
        for x in range(cx + 3, cx + 9):
            t = (31 - y) / 22.0
            half = 14.2 * math.sqrt(max(0.0, 1 - t * t))
            if x < cx + half - 0.5 and y >= 12 + (x - cx - 3) // 2:
                c.put_ramp(x, y, 'coal', 0 if (x + y) % 3 else 1)
    for (x, y) in ((cx + 4, 18), (cx + 6, 24), (cx + 7, 15), (cx + 5, 28)):
        c.put_ramp(x, y, 'gold', 5)
    # Kristallspitze
    poly(c, [(cx - 3, 12), (cx + 1, 12), (cx - 1, 2)], 'ice', lo=2, hi=5)
    c.put_ramp(cx - 2, 8, 'ice', 5)
    c.put_ramp(cx - 1, 5, 'ice', 5)
    # --- Teleskop: ragt aus dem Spalt nach rechts oben
    thick_line(c, cx + 1, 29, cx + 22, 8, 6.0, 'metal', lo=1, hi=5)
    thick_line(c, cx + 3, 27, cx + 20, 10, 2.0, 'metal', lo=4, hi=5)
    for k in (0.2, 0.55):
        px_, py_ = cx + 1 + 21 * k, 29 - 21 * k
        c.rect(int(px_) - 1, int(py_) - 1, int(px_) + 2, int(py_) + 2, 'gold', 4)
    ellipse(c, cx + 22.5, 7.5, 3.4, 3.4, 'gold', lo=1, hi=5)
    ellipse(c, cx + 23, 7, 2.0, 2.0, 'ice', lo=3, hi=5)
    # Stuetze
    c.rect(cx + 2, 29, cx + 4, 33, 'metal', 2)
    c.outline()
    return c


def moon_face():
    """Mond-Sichel mit Gesicht, schaut nach links (guckt zurueck), 24 x 26"""
    c = Canvas(24, 26)
    cx, cy, R = 13.0, 13.0, 11.6
    for y in range(26):
        for x in range(24):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            d2 = math.hypot(x + 0.5 - (cx - 6.4), y + 0.5 - (cy - 1.2))
            if d <= R and d2 > 10.4:
                u = (x + 0.5 - (cx - R)) / (2 * R)
                c.put_ramp(x, y, 'bone', quant(0.45 + 0.6 * u - 0.25 * (y - 2) / 22.0 + 0.12, 2, 5, x, y))
    # Gesicht auf der Sichel: Auge (gross, schaut nach links), Nase, Laecheln
    c.rect(11, 9, 13, 11, 'coal', 1)
    c.put_ramp(11, 9, 'bone', 5)
    c.rect(11, 8, 14, 8, 'bone', 2)
    c.rect(10, 14, 11, 15, 'bone', 2)
    for (x, y) in ((10, 19), (11, 20), (12, 20), (13, 20), (14, 19)):
        c.put_ramp(x, y, 'coal', 1)
    c.rect(13, 16, 14, 16, 'skin', 4)
    c.rect(14, 15, 15, 15, 'skin', 3)
    c.outline()
    return c


def astronomer():
    """kleiner Sterngucker mit Sternenhut, schaut mit Fernrohr nach oben, 18 x 24"""
    c = Canvas(18, 24)
    thick_line(c, 7, 17, 6, 21, 2.6, 'purple', lo=1, hi=3)
    thick_line(c, 11, 17, 11, 21, 2.6, 'purple', lo=2, hi=4)
    c.rect(4, 21, 7, 22, 'wood', 2)
    c.rect(9, 21, 13, 22, 'wood', 3)
    poly(c, [(5, 11), (13, 11), (14, 19), (4, 19)], 'purple', lo=1, hi=4)
    c.put_ramp(8, 14, 'gold', 5)
    c.put_ramp(10, 16, 'gold', 4)
    # Arm mit Fernrohr
    thick_line(c, 12, 12, 14, 7, 2.0, 'purple', lo=2, hi=4)
    thick_line(c, 13, 8, 17, 1, 2.4, 'metal', lo=2, hi=5)
    c.put_ramp(14, 8, 'skin', 4)
    thick_line(c, 5, 12, 4, 16, 2.0, 'purple', lo=1, hi=3)
    # Kopf, Bart
    ellipse(c, 9, 8, 3.8, 3.4, 'skin', lo=2, hi=5)
    c.put_ramp(11, 7, 'coal', 1)
    c.rect(6, 10, 11, 13, 'bone', 4)
    c.rect(7, 13, 10, 14, 'bone', 3)
    # Sternenhut
    poly(c, [(4, 6), (14, 6), (11, 0), (9, -2), (7, 1)], 'purple', lo=1, hi=4)
    c.rect(3, 5, 15, 6, 'purple', 3)
    c.put_ramp(9, 3, 'gold', 5)
    c.put_ramp(8, 4, 'gold', 4)
    c.outline()
    return c


# =========================================================================== Wolkenanker


def _cloud_body(c, spec, ramp_lo=1):
    for (cx, cy, rx, ry) in spec:
        ellipse(c, cx, cy, rx, ry, 'fur', lo=ramp_lo, hi=5, ambient=0.3, flatness=0.1)


def cloud_anchor_tower(team='teamA'):
    """schwebende Gewitterwolke mit zwei Geschuetzplaetzen an Ankerkette; Anker im Boden. 72 x 84"""
    W, H = 72, 84
    c = Canvas(W, H)
    # Anker unten (Fussbereich): Schaft, Stock, Arme
    ax = 36
    c.rect(ax - 1, 60, ax + 1, 80, 'metal', 2)
    c.rect(ax - 1, 60, ax - 1, 80, 'metal', 4)
    c.rect(ax + 1, 60, ax + 1, 80, 'metal', 1)
    c.rect(ax - 7, 65, ax + 7, 66, 'metal', 3)               # Stock
    c.rect(ax - 7, 65, ax + 7, 65, 'metal', 5)
    ellipse(c, ax + 0.5, 59.5, 3.0, 3.0, 'metal', lo=0, hi=4)
    ellipse(c, ax + 0.5, 59.5, 1.4, 1.4, 'coal', lo=0, hi=1)
    # Arme (Bogen unten)
    for k in range(0, 14):
        t = k / 13.0
        x = ax - 12 * math.sin(t * math.pi * 0.5)
        y = 80 - 8 * (1 - math.cos(t * math.pi * 0.5))
        c.rect(int(x), int(y) - 1, int(x) + 1, int(y), 'metal', 3 if k % 2 else 4)
        x2 = ax + 12 * math.sin(t * math.pi * 0.5)
        c.rect(int(x2), int(y) - 1, int(x2) + 1, int(y), 'metal', 2 if k % 2 else 1)
    poly(c, [(ax - 15, 77), (ax - 10, 80), (ax - 13, 73)], 'metal', lo=2, hi=5)
    poly(c, [(ax + 15, 77), (ax + 10, 80), (ax + 13, 73)], 'metal', lo=1, hi=4)
    # Ankerkette von der Wolke herab
    chain_line(c, ax, 40, ax, 57)
    for y in range(40, 57):
        if y % 3 != 2:
            c.put_ramp(ax + 1, y, 'metal', 1)
    # Regen unter der Wolke
    for (x, y) in ((16, 48), (24, 52), (50, 50), (58, 46), (44, 56), (12, 58)):
        c.put_ramp(x, y, 'ice', 4)
        c.put_ramp(x, y + 1, 'ice', 3)
        c.put_ramp(x - 1, y + 3, 'ice', 3) if False else None
    # Wolkenkoerper
    spec = [(14, 32, 12, 8), (58, 32, 12, 8), (24, 24, 13, 11), (47, 24, 14, 11), (36, 22, 12, 11), (36, 33, 22, 7), (14, 26, 8, 6), (60, 26, 8, 6)]
    for (cx, cy, rx, ry) in spec:
        ellipse(c, cx, cy, rx, ry, 'fur', lo=2, hi=5, ambient=0.34, flatness=0.1)
    # Gewitter-Unterseite: dunkel mit Dither
    for y in range(31, 42):
        for x in range(2, 70):
            if c.alpha(x, y):
                depth = (y - 31) / 10.0
                if depth > 0.55:
                    c.put_ramp(x, y, 'stone', 2 if (x + y) % 2 else 1)
                elif depth > 0.25 and (x + y) % 2 == 0:
                    c.put_ramp(x, y, 'stone', 3)
    for (x, y) in ((16, 32), (30, 34), (54, 33), (44, 35)):
        c.put_ramp(x, y, 'stone', 4)
    # Blitz
    poly(c, [(51, 38), (56, 38), (53, 44), (57, 44), (49, 53), (51, 46), (48, 46)], 'gold', lo=3, hi=5)
    # zwei Geschuetzplaetze oben auf der Wolke (flache Platten)
    for px_ in (22, 50):
        ellipse(c, px_ + 0.5, 15.5, 8.0, 2.6, 'stone', lo=1, hi=4)
        ellipse(c, px_ + 0.5, 15, 6.0, 1.7, 'metal', lo=2, hi=4)
    c.outline()
    return c


def rain_cannon():
    """kleine Kanone auf der Wolke, schiesst einen Regentropfen, 26 x 18"""
    c = Canvas(26, 18)
    ellipse(c, 6, 14, 3.4, 3.4, 'wood', lo=1, hi=4)
    ellipse(c, 6, 14, 1.4, 1.4, 'wood', lo=0, hi=2)
    round_rect(c, 3, 9, 12, 13, 'wood', lo=1, hi=4, radius=1)
    poly(c, [(3, 6), (3, 12), (19, 10), (19, 4)], 'metal', lo=0, hi=4)
    c.rect(18, 3, 20, 11, 'metal', 4)
    c.rect(20, 5, 20, 9, 'coal', 0)
    ellipse(c, 2.5, 8.5, 2.2, 2.2, 'metal', lo=1, hi=4)
    # Regentropfen als Kugel
    drop_c = Canvas(8, 9)
    drop(drop_c, 4, 1, 'ice', True)
    c.blit(drop_c, 19, 0)
    c.outline()
    return c


def rain_mortar():
    """kleiner Moerser, der einen Tropfen nach oben spuckt, 18 x 20"""
    c = Canvas(18, 20)
    round_rect(c, 3, 11, 14, 18, 'wood', lo=1, hi=4, radius=2)
    poly(c, [(5, 4), (12, 4), (14, 12), (3, 12)], 'metal', lo=0, hi=4)
    c.rect(4, 3, 13, 4, 'metal', 4)
    c.rect(5, 3, 12, 3, 'coal', 0)
    d = Canvas(8, 9)
    drop(d, 4, 1, 'ice', True)
    c.blit(d, 5, -4 + 4 - 4) if False else None
    c.outline()
    return c


# =========================================================================== Schwebende Festung


def floating_island(team='teamA'):
    """Felsinsel mit Zinnenmauer, zwei Tuermen, Teich und Kanonen; Unterseite als haengender Fels mit Kristallen. 124 x 92"""
    W, H = 124, 86
    c = Canvas(W, H)
    rnd = random.Random(21)
    cx = 62
    # ---------------- Felsunterseite (haengender Kegel)
    def edge(x):                      # Tiefe der Felsunterkante in Abhaengigkeit von x
        t = abs(x - cx) / 58.0
        base = 40 + 40 * (1 - t ** 1.15)
        wob = 4 * math.sin(x * 0.55) + 3 * math.sin(x * 1.3 + 1.0)
        return base + wob * (0.4 + 0.6 * (1 - t))
    for x in range(4, 120):
        yb = int(edge(x))
        t = (x - 4) / 116.0
        for y in range(36, min(H - 1, yb) + 1):
            depth = (y - 36) / max(1.0, (yb - 36))
            L = 0.88 - 0.55 * t - 0.45 * depth * 0.6 + (0.1 if (x + y) % 7 == 0 else 0)
            # Gesteinsschichten
            if y % 9 == 0:
                L -= 0.15
            if texture_noise(x // 2, y // 2, 3) > 0.86:
                L -= 0.14
            c.put_ramp(x, y, 'stone', quant(max(0.0, min(1.0, L)), 0, 4, x, y))
        # Erdrand oben
        for y in range(36, 41):
            c.put_ramp(x, y, 'dirt', 4 if y < 38 else (3 if y < 40 else 2))
        if texture_noise(x, 4, 9) > 0.5:
            for k in range(2 + int(3 * texture_noise(x, 7, 9))):
                c.put_ramp(x, 41 + k, 'dirt', 2)
    # Wurzeln und Grasbaerte am Rand
    for x in range(4, 120, 3):
        if texture_noise(x, 1, 5) > 0.4:
            c.put_ramp(x, 41, 'leaf', 3)
            c.put_ramp(x, 42, 'leaf', 2)
    # Kristalle an der Unterseite
    for (x, y, h_, ramp) in ((46, 66, 8, 'ice'), (54, 72, 11, 'purple'), (74, 70, 9, 'ice'), (64, 76, 8, 'purple'), (86, 60, 7, 'ice')):
        poly(c, [(x - 2, y), (x + 2, y), (x + 1, y + h_), (x - 1, y + h_ + 1)], ramp, lo=2, hi=5)
        c.put_ramp(x - 1, y + 1, ramp, 5)
    # ---------------- Oberflaeche: Gras-Plateau (Ellipse)
    ellipse(c, cx, 36, 59, 9, 'grass', lo=1, hi=4, ambient=0.32, flatness=0.5)
    # Zinnenmauer (Vorderseite, Suedansicht)
    wx0, wx1, wy0, wy1 = 30, 94, 28, 40
    for y in range(wy0, wy1 + 1):
        for x in range(wx0, wx1 + 1):
            row = (y - wy0) // 4
            off = 8 if row % 2 else 0
            idx = 3 if y > wy0 + 1 else 5
            if (y - wy0) % 4 == 3:
                idx = 1
            elif (x - wx0 + off) % 16 == 0:
                idx = 1
            elif x < wx0 + 2:
                idx = 4
            if y == wy0:
                idx = 5
            if x > wx1 - 2:
                idx = 1
            c.put_ramp(x, y, 'stone', idx)
    # Zinnen (Zaehne) mit Gesichtern
    for k in range(0, 6):
        mx = wx0 + 3 + k * 11
        c.rect(mx, wy0 - 6, mx + 6, wy0, 'stone', 4)
        c.rect(mx, wy0 - 6, mx + 6, wy0 - 6, 'stone', 5)
        c.rect(mx + 6, wy0 - 5, mx + 6, wy0, 'stone', 2)
        c.rect(mx, wy0 - 5, mx, wy0, 'stone', 5)
        c.put_ramp(mx + 2, wy0 - 3, 'stone', 1)
        c.put_ramp(mx + 4, wy0 - 3, 'stone', 1)
        c.put_ramp(mx + 2, wy0 - 1, 'stone', 1)
        c.put_ramp(mx + 3, wy0 - 1, 'stone', 1)
        c.put_ramp(mx + 4, wy0 - 1, 'stone', 1)
    # Tor
    poly(c, [(cx - 5, wy1), (cx + 5, wy1), (cx + 5, wy0 + 6), (cx, wy0 + 2), (cx - 5, wy0 + 6)], 'wood', lo=0, hi=3)
    c.rect(cx, wy0 + 3, cx, wy1, 'wood', 0)
    # Kanonenrohre hinter den Zinnen
    for gx in (39, 83):
        thick_line(c, gx, wy0 - 3, gx + 9, wy0 - 11, 4.4, 'coal', lo=0, hi=4)
        ellipse(c, gx + 9.5, wy0 - 11.5, 2.8, 2.8, 'coal', lo=0, hi=2)
        c.put_ramp(gx + 3, wy0 - 8, 'coal', 5)
    # Tuerme links und rechts
    for tx in (22, 102):
        tx0, tx1 = tx - 8, tx + 8
        for y in range(18, 42):
            for x in range(tx0, tx1 + 1):
                idx = _cyl_idx(x, y, tx0, tx1)
                if (y - 18) % 5 == 4:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'stone', idx)
        # Zinnenkranz
        for k in range(0, 4):
            mx = tx0 + k * 5
            c.rect(mx, 14, mx + 2, 18, 'stone', 4 if k < 2 else 3)
            c.put_ramp(mx, 14, 'stone', 5)
        c.rect(tx0, 18, tx1, 19, 'stone', 5)
        # Dach: Kegel in Teamfarbe
        for y in range(2, 14):
            t = (y - 2) / 11.0
            half = 1.5 + t * 8.5
            for x in range(int(tx - half), int(tx + half) + 1):
                u = (x - (tx - half)) / (2 * half + 0.01)
                nn = u * 2 - 1
                nz = math.sqrt(max(0.0, 1 - nn * nn))
                dot = nn * LIGHT[0] + nz * LIGHT[2]
                L = 0.18 + 0.82 * max(0.0, dot)
                idx = quant(L, 1, 4, x, y)
                if (y - 2) % 4 == 3:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, team, idx)
        c.rect(tx, 0, tx, 3, 'wood', 3)
        poly(c, [(tx + 1, 0), (tx + 7, 1), (tx + 1, 3)], 'gold', lo=3, hi=5)
        c.rect(tx - 1, 26, tx + 1, 31, 'coal', 0)
        c.put_ramp(tx - 1, 25, 'coal', 1)
        c.put_ramp(tx, 25, 'coal', 1)
        c.put_ramp(tx + 1, 25, 'coal', 1)
    c.outline()
    return c


def upward_waterfall(h=34, w=14, phase=0):
    """Wasserfall, der nach oben fliesst: Wasserband mit aufwaerts laufenden Schaumstreifen, unten Gischt, oben Nebelwolke. Fuss unten"""
    cwid = w + 20
    c = Canvas(cwid, h + 14)
    cx = cwid // 2
    for y in range(8, h + 12):
        t = (y - 8) / float(h + 4)                # 0 oben .. 1 unten
        half = w / 2.0 * (0.62 + 0.5 * t)
        wob = 1.2 * math.sin(y / 4.0 + phase)
        for x in range(int(cx - half + wob), int(cx + half + wob) + 1):
            u = (x - (cx - half + wob)) / (2 * half + 0.01)
            idx = 4 if u < 0.2 else (3 if u < 0.6 else 2)
            if (x + y // 2) % 4 == 0:
                idx = min(5, idx + 1)
            if ((x * 3 + y) % 9) == 0:
                idx = 5
            c.put_ramp(x, y, 'ice', idx)
        if y % 5 == 0:
            xs = int(cx - half + wob + 1)
            c.put_ramp(xs, y, 'bone', 5)
            c.put_ramp(xs + 1, y - 1, 'bone', 5)
            c.put_ramp(xs + 2, y - 2, 'bone', 4)
    # Aufwaerts-Gischt
    for (dx, y) in ((-9, 30), (10, 22), (-8, 14), (11, 32), (-11, 22), (9, 12)):
        c.put_ramp(cx + dx, y, 'bone', 5)
        c.put_ramp(cx + dx, y + 1, 'ice', 4)
    # Gischt am Fuss
    for (dx, dy, i) in ((-8, 0, 4), (-6, -1, 5), (7, -1, 5), (9, 0, 4), (-4, 0, 5), (5, 0, 4)):
        c.put_ramp(cx + dx, h + 12 + dy, 'bone', i)
    # Wolke oben
    for (x, y, rx, ry) in ((cx - 7, 6, 6, 4), (cx + 6, 5, 7, 4), (cx, 3, 6, 3.4)):
        ellipse(c, x, y, rx, ry, 'fur', lo=2, hi=5, ambient=0.3)
    c.outline()
    return c
