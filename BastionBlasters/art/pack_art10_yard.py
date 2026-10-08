"""pack_art10: Bunkerlafette (BP-05) und Alarmglocke (BU-04): Hof-Bauteile ohne Waende."""
from __future__ import annotations

from pack_art10_kit import *


# =========================================================================== Bunkerlafette


def garden_gnome():
    """Gartenzwerg aus Keramik: rote Zipfelmuetze, weisser Bart, blaue Jacke, Angel, 16 x 24"""
    c = Canvas(16, 24)
    # Stiefel
    c.rect(3, 21, 6, 22, 'coal', 2)
    c.rect(9, 21, 12, 22, 'coal', 3)
    c.rect(3, 22, 12, 22, 'coal', 1)
    # Hose und Jacke
    c.rect(4, 17, 6, 21, 'wood', 3)
    c.rect(9, 17, 11, 21, 'wood', 2)
    round_rect(c, 3, 10, 12, 18, 'sky', lo=1, hi=4, radius=2)
    c.rect(3, 15, 12, 15, 'wood', 2)
    c.put_ramp(7, 15, 'gold', 5)
    c.put_ramp(5, 11, 'sky', 5)
    # Arme
    thick_line(c, 3, 11, 1, 16, 2.0, 'sky', lo=1, hi=3)
    thick_line(c, 12, 11, 14, 14, 2.0, 'sky', lo=3, hi=4)
    c.put_ramp(14, 14, 'skin', 4)
    c.put_ramp(1, 17, 'skin', 3)
    # Bart
    poly(c, [(4, 8), (11, 8), (10, 16), (8, 18), (5, 16)], 'bone', lo=3, hi=5)
    # Kopf: Nase und Auge
    ellipse(c, 8, 7, 3.4, 3.0, 'skin', lo=2, hi=5)
    c.put_ramp(9, 7, 'coal', 1)
    ellipse(c, 11, 8, 1.6, 1.4, 'skin', lo=3, hi=5)
    c.put_ramp(11, 8, 'fire', 4)
    # Muetze
    poly(c, [(4, 6), (12, 6), (9, 0), (7, -1), (6, 1)], 'teamA', lo=1, hi=4)
    c.rect(4, 5, 12, 6, 'teamA', 3)
    c.rect(4, 5, 12, 5, 'teamA', 4)
    c.outline()
    return c


def bunker(team='teamA'):
    """Betonbunker mit Schiessscharte, Rohr, Sandsaecken und Gartenzwerg auf dem Dach, 72 x 70"""
    W, H = 72, 70
    c = Canvas(W, H)
    x0, x1 = 6, 65
    ty0, ty1 = 24, 31         # Dachflaeche
    fy0, fy1 = 32, 56         # Vorderseite
    # Vorderseite (Beton, Plattenfugen, Nieten)
    for y in range(fy0, fy1 + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / float(x1 - x0)
            v = (y - fy0) / float(fy1 - fy0)
            L = 0.72 - 0.34 * u - 0.2 * v + (0.1 if x < x0 + 2 else 0)
            idx = quant(max(0.0, min(1.0, L)), 1, 4, x, y)
            if (x - x0) % 20 == 0 or y == fy1:
                idx = 1
            elif (x - x0) % 20 == 1 and idx < 4:
                idx += 1
            if texture_noise(x, y, 5) > 0.93:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'stone', idx)
    for xx in range(x0 + 4, x1, 20):
        for yy in (fy0 + 3, fy1 - 4):
            c.put_ramp(xx, yy, 'metal', 5)
            c.put_ramp(xx + 1, yy + 1, 'stone', 0)
    # Dach
    for y in range(ty0, ty1 + 1):
        for x in range(x0 - 2, x1 + 3):
            u = (x - x0) / float(x1 - x0)
            L = 0.95 - 0.35 * u - 0.1 * (y - ty0) / 8.0
            c.put_ramp(x, y, 'stone', quant(max(0.0, min(1.0, L)), 3, 5, x, y))
    c.rect(x0 - 2, ty1, x1 + 2, ty1, 'stone', 2)
    c.rect(x0 - 2, ty0, x1 + 2, ty0, 'stone', 5)
    # Dachluke
    ellipse(c, 24.5, 28, 5.2, 2.4, 'metal', lo=1, hi=4)
    c.rect(23, 27, 26, 27, 'metal', 5)
    # Periskop-Rohr auf dem Dach
    c.rect(13, 16, 15, 25, 'metal', 3)
    c.rect(13, 16, 13, 25, 'metal', 5)
    c.rect(15, 16, 15, 25, 'metal', 1)
    c.rect(13, 14, 19, 16, 'metal', 3)
    c.rect(13, 14, 19, 14, 'metal', 5)
    c.rect(17, 15, 19, 15, 'ice', 4)
    # Grasbueschel (Tarnung) auf dem Dach
    for (gx, gy) in ((12, 26), (15, 28), (50, 25), (57, 28), (59, 26), (35, 29)):
        c.put_ramp(gx, gy, 'leaf', 4)
        c.put_ramp(gx - 1, gy + 1, 'leaf', 3)
        c.put_ramp(gx + 1, gy + 1, 'leaf', 3)
        c.put_ramp(gx, gy - 1, 'leaf', 5)
    # Schiessscharte: dunkler Schlitz mit Sturz und heller Unterkante
    sx0, sx1, sy0, sy1 = 20, 52, 37, 45
    c.rect(sx0 - 1, sy0 - 2, sx1 + 1, sy0 - 1, 'stone', 5)
    c.rect(sx0, sy0, sx1, sy1, 'coal', 0)
    chk(c, sx0, sy0 + 1, sx1, sy1 - 1, 'coal', 1, phase=1)
    c.rect(sx0 - 1, sy1 + 1, sx1 + 1, sy1 + 2, 'stone', 5)
    c.rect(sx0 - 1, sy0 - 2, sx0 - 1, sy1 + 2, 'stone', 4)
    c.rect(sx1 + 1, sy0, sx1 + 1, sy1 + 2, 'stone', 1)
    # Rohr: schaut aus der Scharte schraeg nach vorn rechts
    thick_line(c, 33, 41, 49, 53, 7.4, 'metal', lo=0, hi=4)
    thick_line(c, 33, 39, 47, 50, 2.0, 'metal', lo=4, hi=5)
    for (rx_, ry_) in ((38, 44), (43, 48)):
        c.rect(rx_, ry_ - 1, rx_ + 1, ry_ + 2, 'metal', 5)
    ellipse(c, 50.5, 54.5, 4.8, 4.4, 'metal', lo=1, hi=5)
    ellipse(c, 51, 55, 2.6, 2.4, 'coal', lo=0, hi=0)
    # Tuer (eiserne Luke links)
    round_rect(c, 9, 44, 17, 56, 'metal', lo=1, hi=4, radius=1)
    c.put_ramp(15, 50, 'gold', 5)
    c.rect(9, 49, 17, 49, 'metal', 1)
    # Sandsaecke vor dem Sockel
    for k, sx in enumerate((4, 12, 20, 53, 61)):
        yb = 63 if k % 2 == 0 else 62
        ellipse(c, sx + 4.5, yb - 0.5, 5.4, 3.0, 'dirt', lo=1, hi=4)
        c.line(sx + 1, yb - 1, sx + 8, yb - 1, 'dirt', 2)
        c.put_ramp(sx + 3, yb - 2, 'dirt', 5)
    for sx in (8, 16):
        ellipse(c, sx + 4.5, 59.5, 5.0, 2.8, 'dirt', lo=2, hi=5)
        c.put_ramp(sx + 3, 58, 'dirt', 5)
    c.outline()
    return c


def smoke_puff():
    c = Canvas(14, 10)
    for (x, y, r) in ((4, 6, 3.6), (8, 4, 3.4), (10, 7, 2.6)):
        ellipse(c, x, y, r, r * 0.9, 'bone', lo=2, hi=5, ambient=0.3)
    chk(c, 0, 0, 13, 9, 'bone', 3, phase=0) if False else None
    c.outline()
    return c


# =========================================================================== Alarmglocke


def bell_frame(swing=2):
    """Glockenstuhl: Holzbock mit Bronzeglocke, schwingt nach rechts, Seil mit Knoten. 64 x 66"""
    W, H = 64, 66
    c = Canvas(W, H)
    # Sockel aus Stein
    round_rect(c, 4, 56, 59, 64, 'stone', lo=1, hi=4, radius=2)
    c.rect(4, 56, 59, 56, 'stone', 5)
    # Pfosten (A-Gestell)
    thick_line(c, 10, 57, 18, 8, 5.0, 'wood', lo=1, hi=4)
    thick_line(c, 53, 57, 45, 8, 5.0, 'wood', lo=0, hi=3)
    thick_line(c, 12, 44, 51, 44, 2.4, 'wood', lo=1, hi=3)           # Querstrebe
    # Querbalken oben
    round_rect(c, 14, 4, 49, 10, 'wood', lo=1, hi=4, radius=1)
    c.rect(14, 4, 49, 4, 'wood', 5)
    c.rect(15, 8, 48, 8, 'wood', 1)
    for x in (18, 44):
        c.rect(x, 5, x + 1, 9, 'metal', 4)
    # Glocke (schwingend): Joch, Haube, ausgestellter Rand
    bx = 31 + swing
    c.rect(bx - 1, 10, bx + 1, 13, 'metal', 3)
    for y in range(13, 40):
        t = (y - 13) / 26.0
        half = 5.0 + 11.0 * (t ** 1.6) + (2.2 if y > 36 else 0)
        sh = int(round(swing * t * 0.6))
        for x in range(int(bx + sh - half), int(bx + sh + half) + 1):
            u = (x - (bx + sh - half)) / (2 * half + 0.01)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot = nn * LIGHT[0] + nz * LIGHT[2]
            L = 0.18 + 0.82 * max(0.0, dot)
            idx = quant(L, 1, 5, x, y, dw=0.15)
            if y in (36, 37):
                idx = min(5, idx + 1)
            c.put_ramp(x, y, 'gold', idx)
    # Rand und Klöppel
    sh = int(round(swing * 0.6))
    for x in range(int(bx + sh - 16), int(bx + sh + 17)):
        c.put_ramp(x, 39, 'gold', 1)
        c.put_ramp(x, 38, 'gold', 2)
    ellipse(c, bx + sh - 5 + 0.5, 42.5, 2.6, 2.6, 'metal', lo=0, hi=4)
    # Glanzstreifen
    for k in range(8):
        c.put_ramp(bx - 5 + k // 4, 19 + k * 2, 'gold', 5)
    # Zierband
    for x in range(int(bx + 1 - 11), int(bx + 1 + 12)):
        c.put_ramp(x, 33, 'gold', 5 if x % 2 else 3)
    c.outline()
    return c


def bell_gnome():
    """Glocken-Zwerg haengt mit beiden Haenden am Seil und schwingt mit, schreit, 20 x 28"""
    c = Canvas(20, 28)
    # Seil
    c.rect(9, 0, 9, 8, 'dirt', 4)
    c.rect(10, 0, 10, 8, 'dirt', 2)
    # Arme nach oben
    thick_line(c, 6, 10, 8, 4, 2.2, 'skin', lo=1, hi=4)
    thick_line(c, 13, 10, 11, 4, 2.2, 'skin', lo=3, hi=5)
    c.rect(8, 2, 11, 5, 'skin', 4)
    # Beine baumeln (schwingend)
    thick_line(c, 8, 19, 5, 25, 3.0, 'ice', lo=1, hi=3)
    thick_line(c, 12, 19, 14, 26, 3.0, 'ice', lo=2, hi=4)
    c.rect(2, 25, 6, 26, 'wood', 2)
    c.rect(13, 26, 17, 27, 'wood', 3)
    # Koerper
    round_rect(c, 5, 10, 14, 20, 'teamA', lo=1, hi=4, radius=2)
    c.rect(5, 16, 14, 16, 'wood', 2)
    c.put_ramp(9, 16, 'gold', 5)
    # Kopf (Mund weit offen)
    ellipse(c, 10, 9, 4.0, 3.6, 'skin', lo=2, hi=5)
    c.put_ramp(8, 8, 'coal', 1)
    c.put_ramp(12, 8, 'coal', 1)
    c.rect(9, 11, 11, 12, 'coal', 0)
    c.rect(6, 11, 14, 13, 'bone', 4) if False else None
    # Zipfelmuetze weht nach hinten
    poly(c, [(5, 7), (15, 7), (12, 2), (16, 0), (18, 1), (9, 3)], 'fire', lo=2, hi=4)
    c.rect(5, 6, 15, 7, 'fire', 3)
    c.outline()
    return c


def mark_arrow():
    """roter Markierungspfeil ueber einem Eindringling, 9 x 11"""
    c = Canvas(9, 11)
    poly(c, [(0, 0), (8, 0), (4, 8)], 'fire', lo=2, hi=5)
    c.rect(3, 8, 5, 9, 'fire', 3)
    c.put_ramp(1, 0, 'fire', 5)
    c.put_ramp(2, 1, 'fire', 5)
    c.outline()
    return c


def sound_arcs(c, cx, cy, side=1, n=3):
    """Schallwellen als Kreisbogen-Stuecke (Pixel), side = -1 links / +1 rechts"""
    for k in range(n):
        r = 7 + k * 5
        for a in range(-38, 39, 3):
            x = cx + side * math.cos(math.radians(a)) * r
            y = cy + math.sin(math.radians(a)) * r
            c.put_ramp(int(round(x)), int(round(y)), 'bone', 5 if k < 2 else 4)
            c.put_ramp(int(round(x)), int(round(y)) + 1, 'bone', 3)
