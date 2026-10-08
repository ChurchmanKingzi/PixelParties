"""Bauteil-Sprites für die ersten Karten: Pfeilturm, Puddingwand, Fallgrube, Feldlazarett.
Gleiche Perspektive wie überall: Boden Draufsicht, Hohes als Südansicht (Fußpunkt = Unterkante)."""
from __future__ import annotations

import math
import random

from pixl import *


def arrow_tower(team='teamA'):
    """Wackeliger Holzturm, Köcher als Dach, der Schütze winkt (36 x 62, Fußpunkt unten)"""
    c = Canvas(36, 62)
    # Streben
    for (x0, x1) in ((7, 9), (26, 28)):
        c.rect(x0, 38, x1, 59, 'wood', 3)
        c.rect(x0, 38, x0, 59, 'wood', 4)
        c.rect(x1, 38, x1, 59, 'wood', 1)
    thick_line(c, 9, 41, 26, 57, 2.2, 'wood', lo=1, hi=3)
    thick_line(c, 26, 41, 9, 57, 2.2, 'wood', lo=2, hi=4)
    c.rect(6, 49, 29, 50, 'wood', 2)
    c.rect(5, 59, 11, 60, 'wood', 1)
    c.rect(24, 59, 30, 60, 'wood', 1)
    # Leiter
    for y in range(41, 59, 3):
        c.rect(15, y, 20, y, 'wood', 4)
    c.rect(15, 38, 15, 59, 'wood', 2)
    c.rect(20, 38, 20, 59, 'wood', 1)
    # Plattformboden
    round_rect(c, 3, 34, 32, 38, 'wood', lo=1, hi=4, radius=1)
    # Hütte
    round_rect(c, 6, 18, 29, 35, 'wood', lo=1, hi=4, radius=1)
    for y in range(21, 35, 3):
        for x in range(6, 30):
            c.put_ramp(x, y, 'wood', 1 if x % 2 else 2)
    for x in (10, 25):
        c.rect(x, 18, x, 35, 'wood', 1)
    # Fenster mit Schütze
    c.rect(13, 23, 22, 31, 'coal', 0)
    ellipse(c, 17.5, 27.5, 3.1, 3.0, 'skin', lo=2, hi=5)
    c.rect(15, 26, 16, 27, 'coal', 1)                 # Auge
    poly(c, [(13, 25), (22, 25), (21, 22), (14, 22)], 'metal', lo=1, hi=5)   # Topfhelm
    # winkender Arm
    thick_line(c, 23, 30, 27, 24, 2.2, 'skin', lo=2, hi=5)
    c.put_ramp(27, 23, 'skin', 5)
    c.put_ramp(28, 22, 'skin', 4)
    # Bogen
    for k in range(0, 9):
        x = 11 - int(2.2 * math.sin(math.pi * k / 8))
        c.put_ramp(x, 23 + k, 'wood', 4)
    c.line(11, 23, 11, 31, 'bone', 4)
    # Geländer
    c.rect(3, 33, 32, 33, 'wood', 5)
    # Dach: großer Köcher
    poly(c, [(4, 18), (31, 18), (28, 9), (8, 9)], 'dirt', lo=1, hi=5)
    for x in range(5, 31, 4):
        c.line(x, 17, x + 1, 10, 'dirt', 2)
    c.rect(8, 9, 28, 10, 'dirt', 5)
    c.rect(5, 15, 30, 16, 'dirt', 1)
    c.rect(16, 14, 19, 17, 'gold', 4)                 # Schnalle
    c.put_ramp(17, 15, 'gold', 5)
    # Pfeile im Köcher
    for k, (x, top) in enumerate(((11, 1), (17, 0), (23, 2))):
        c.rect(x, top + 4, x, 9, 'wood', 4)
        poly(c, [(x - 1, top + 5), (x + 1, top + 5), (x, top + 1)], 'metal', lo=2, hi=5)
        c.put_ramp(x - 1, 8, team, 4)
        c.put_ramp(x + 1, 8, team, 3)
        c.put_ramp(x - 1, 7, team, 3)
        c.put_ramp(x + 1, 6, team, 3)
    c.outline()
    return c


def pudding_wall(segments=3, team='teamA'):
    """Puddingwand aus `segments` Segmenten à 32 px; Südansicht, Oberseite 8 px, Front 22 px"""
    W = 32 * segments + 8
    H = 44
    c = Canvas(W, H)
    top_y0, top_y1 = 14, 21
    front_y0, front_y1 = 22, 43
    rid = RAMP_ID[team]
    for x in range(W):
        wob = int(round(1.2 * math.sin(x / 5.0)))
        for y in range(top_y0 + wob, front_y1 + 1):
            u = (x % 32) / 32.0
            # Wölbung je Segment (mehr Licht links oben)
            bulge = 0.5 + 0.5 * math.cos((u - 0.38) * math.pi * 1.7)
            if y <= top_y1 + wob:
                L = 0.86 - 0.12 * u + 0.1 * bulge
            else:
                v = (y - front_y0) / float(front_y1 - front_y0)
                L = 0.30 + 0.34 * bulge + 0.26 * (1 - v) - 0.10 * u
            L = max(0.0, min(1.0, L))
            if x < 2 or x >= W - 2:
                L = min(L, 0.25)
            c.put(x, y, RAMPS[team][quant(L, 1, 5, x, y)], rid)
    # Glanzstreifen (durchscheinend wirkend)
    for s in range(segments):
        x0 = 6 + s * 32
        for k in range(12):
            c.put_ramp(x0 + (k // 3), front_y0 + 3 + k, team, 5)
            if k % 2 == 0:
                c.put_ramp(x0 + 2 + (k // 3), front_y0 + 3 + k, 'bone', 5)
    # Blasen
    rnd = random.Random(7)
    for _ in range(18):
        x, y = rnd.randint(4, W - 5), rnd.randint(front_y0 + 3, front_y1 - 3)
        c.put_ramp(x, y, team, 5)
    # Sahnehäubchen und Kirschen
    for s in range(segments):
        cx = 17 + s * 32
        ellipse(c, cx, 12, 6.5, 3.6, 'bone', lo=3, hi=5)
        ellipse(c, cx - 1, 8, 3.2, 3.2, team, lo=0, hi=3, spec=(cx - 2, 7, 5))
        c.line(cx, 5, cx + 2, 2, 'leaf', 3)
        c.put_ramp(cx + 3, 2, 'leaf', 4)
    c.outline()
    return c


def pit():
    """Fallgrube in der Draufsicht (Kreis!), Pflasterrand, Spieße, Warnschild (32 x 32)"""
    c = Canvas(32, 32)
    cx, cy = 14.5, 19.0
    # Rand aus Steinen
    for y in range(32):
        for x in range(32):
            d = math.hypot((x + 0.5 - cx) / 1.12, y + 0.5 - cy)
            if 10.0 < d <= 13.2:
                ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
                L = 0.8 - 0.35 * ((x + y) / 60.0) + (0.12 if int((ang + 3.2) * 4.0) % 2 else -0.05)
                c.put_ramp(x, y, 'stone', quant(max(0.0, min(1.0, L)), 2, 5, x, y))
    # Loch (innen dunkel, oben links tiefer Schatten)
    for y in range(32):
        for x in range(32):
            d = math.hypot((x + 0.5 - cx) / 1.12, y + 0.5 - cy)
            if d <= 10.0:
                v = d / 10.0
                idx = 0 if v < 0.82 else 1
                if idx == 0 and ((x + y) % 2 == 0) and v > 0.55:
                    idx = 1
                c.put_ramp(x, y, 'coal', idx)
    # Spieße (Spitzen von oben gesehen: heller Punkt + kurzer Schatten)
    for (x, y) in ((10, 16), (14, 14), (18, 17), (12, 20), (17, 22), (21, 20), (8, 21)):
        c.put_ramp(x, y, 'bone', 5)
        c.put_ramp(x + 1, y + 1, 'metal', 2)
        c.put_ramp(x, y + 1, 'metal', 3)
    # Schild (Südansicht): Pfosten + Brett mit Ausrufezeichen
    c.rect(26, 8, 27, 20, 'wood', 3)
    c.rect(26, 8, 26, 20, 'wood', 4)
    round_rect(c, 21, 2, 31, 9, 'gold', lo=2, hi=5, radius=1)
    c.rect(26, 3, 26, 6, 'coal', 1)
    c.put_ramp(26, 8, 'coal', 1)
    c.outline()
    return c


def field_tent(team='teamA'):
    """Flickenzelt mit Kreuz-Flagge (34 x 38, Südansicht)"""
    c = Canvas(34, 38)
    # Seile und Heringe
    c.line(2, 34, 8, 30, 'bone', 3)
    c.line(31, 34, 25, 30, 'bone', 3)
    c.put_ramp(2, 35, 'wood', 3)
    c.put_ramp(31, 35, 'wood', 3)
    # Zeltkörper
    poly(c, [(3, 34), (31, 34), (23, 12), (11, 12)], 'bone', lo=2, hi=5)
    poly(c, [(11, 12), (23, 12), (17, 4)], 'bone', lo=3, hi=5)
    # Eingang
    poly(c, [(13, 34), (21, 34), (17, 20)], 'coal', lo=0, hi=1)
    c.rect(14, 32, 20, 34, 'cloth', 2)                  # Kissen / Decke
    c.rect(15, 32, 17, 33, 'bone', 5)
    # Flicken
    patches = [(6, 28, 4, 4, 'gold'), (24, 26, 5, 4, 'leaf'), (9, 21, 4, 3, team), (22, 18, 4, 4, 'ice'), (26, 31, 3, 3, 'purple')]
    for (x, y, w, h, col) in patches:
        c.rect(x, y, x + w - 1, y + h - 1, col, 3)
        c.rect(x, y, x + w - 1, y, col, 4)
        for k in range(0, w, 2):
            c.put_ramp(x + k, y + h, 'wood', 2)               # Nähte
    # Mittelnaht und Nähte
    c.line(17, 4, 11, 34, 'bone', 2)
    c.line(17, 4, 23, 34, 'bone', 4)
    # Fahnenmast und Flagge mit Kreuz
    c.rect(17, 0, 17, 5, 'wood', 3)
    poly(c, [(18, 0), (27, 1), (25, 3), (27, 5), (18, 5)], 'bone', lo=3, hi=5)
    c.rect(22, 1, 22, 4, 'leaf', 4)
    c.rect(20, 2, 24, 3, 'leaf', 4)
    c.outline()
    return c
