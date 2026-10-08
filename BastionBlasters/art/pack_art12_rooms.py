"""pack_art12: Moebel, Boeden und Raum-Themen der Chaos-Raeume (Schunkelsaal, Huepfhalle, Teesalon, Brutkasten, Schwerkraft-Umkehrer)."""
from __future__ import annotations

import math
import random

import numpy as np

from pixl import *
from assets_env import tile_planks, tile_cobble
from scenekit import shadow
from pack_art12_kit import hline, vline, vflip, disc, dither_rect


def _tile(fn):
    """32x32-Boden aus Zeichenfunktion fn(Canvas)"""
    c = Canvas(32, 32)
    fn(c)
    return c.px[:, :, :3].copy()


# =========================================================================== BC-04 Schunkelsaal


def floor_dance():
    """dunkle Tanzflaeche: 8x8-Felder in Violett/Kohle mit Glanzkante"""
    def draw(c):
        for ty in range(4):
            for tx in range(4):
                dark = (tx + ty) % 2 == 0
                base = ('purple', 1) if dark else ('coal', 2)
                for y in range(8):
                    for x in range(8):
                        X, Y = tx * 8 + x, ty * 8 + y
                        idx = base[1]
                        if x == 0 or y == 0:
                            idx += 1
                        if x == 7 or y == 7:
                            idx = max(0, idx - 1)
                        if x in (2, 3) and y in (2, 3) and dark:
                            idx += 1
                        c.put_ramp(X, Y, base[0], idx)
    return _tile(draw)


def stage(w=52):
    c = Canvas(w, 24)
    # Oberflaeche (Holz)
    for y in range(0, 13):
        for x in range(w):
            idx = 3 if (y // 4) % 2 == 0 else 2
            if y == 0:
                idx = 5
            elif y % 4 == 3:
                idx = 1
            if (x + (y // 4) * 9) % 17 == 0:
                idx = 1
            c.put_ramp(x, y, 'wood', idx)
    # Vorderseite: Samtrock, Gold, Lampenreihe
    for y in range(13, 22):
        for x in range(w):
            fold = (x // 4) % 2
            idx = 3 if fold == 0 else 2
            if x % 4 == 0:
                idx = 4
            if y > 19:
                idx -= 1
            c.put_ramp(x, y, 'teamA', idx)
    hline(c, 0, w - 1, 13, 'gold', 4)
    hline(c, 0, w - 1, 14, 'gold', 2)
    hline(c, 0, w - 1, 22, 'coal', 1)
    for k, x in enumerate(range(3, w - 2, 6)):
        col, i = (('gold', 5), ('ice', 5), ('fire', 5))[k % 3]
        c.put_ramp(x, 13, col, i)
        c.put_ramp(x + 1, 13, col, i)
    c.outline()
    return c


def speaker():
    c = Canvas(18, 28)
    round_rect(c, 1, 1, 16, 26, 'coal', lo=1, hi=3, radius=1)
    ellipse(c, 8.5, 9, 4.6, 4.6, 'metal', lo=0, hi=3, ambient=0.2)
    ellipse(c, 8.5, 9, 2.2, 2.2, 'stone', lo=1, hi=4)
    ellipse(c, 8.5, 20, 6.2, 6.2, 'metal', lo=0, hi=4, ambient=0.2)
    ellipse(c, 8.5, 20, 3.4, 3.4, 'stone', lo=0, hi=3)
    ellipse(c, 8.5, 20, 1.6, 1.6, 'gold', lo=2, hi=5)
    c.put_ramp(6, 18, 'metal', 5)
    c.put_ramp(6, 7, 'metal', 5)
    for (x, y) in ((3, 3), (14, 3), (3, 24), (14, 24)):
        c.put_ramp(x, y, 'metal', 4)
    c.put_ramp(8, 2, 'gold', 4)
    c.outline()
    return c


def disco_ball():
    """haengende Spiegelkugel (18 x 30), Kette oben"""
    c = Canvas(18, 30)
    for y in range(0, 11):
        c.put_ramp(9, y, 'metal', 3 if y % 2 else 2)
    ellipse(c, 9, 19.5, 8.4, 8.4, 'metal', lo=1, hi=5, ambient=0.15)
    # Facetten
    for y in range(11, 29):
        for x in range(1, 18):
            if c.alpha(x, y):
                if x % 3 == 0 or y % 3 == 0:
                    c.put_ramp(x, y, 'metal', 1)
                elif (x // 3 + y // 3) % 3 == 0:
                    c.put_ramp(x, y, 'ice', 4)
                elif (x // 3 + y // 3) % 3 == 1:
                    c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(6, 15, 'bone', 5)
    c.put_ramp(7, 15, 'bone', 5)
    c.put_ramp(6, 16, 'bone', 5)
    c.outline()
    return c


def light_spots(w=88, h=44, seed=3):
    """Lichtflecken der Discokugel als Bodendekor (Schachbrett-Dither = durchscheinend)"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    cols = [('gold', 4), ('ice', 4), ('teamA', 3), ('slime', 4), ('purple', 4)]
    for _ in range(16):
        cx, cy = rnd.randint(4, w - 5), rnd.randint(3, h - 4)
        col, i = rnd.choice(cols)
        r = rnd.choice([2, 3, 3])
        for y in range(-r, r + 1):
            for x in range(-r, r + 1):
                if abs(x) + abs(y) <= r and (cx + x + cy + y) % 2 == 0:
                    c.put_ramp(cx + x, cy + y, col, i)
        c.put_ramp(cx, cy, 'bone', 5)
    return c


def music_note(col='gold', variant=0):
    c = Canvas(8, 11)
    for y in range(1, 8):
        c.put_ramp(5, y, col, 4)
    ellipse(c, 3.2, 8.4, 2.2, 1.7, col, lo=2, hi=5)
    if variant == 0:
        c.put_ramp(6, 1, col, 5)
        c.put_ramp(7, 2, col, 4)
        c.put_ramp(6, 3, col, 4)
    else:
        for y in (1, 2):
            c.put_ramp(6, y, col, 5)
            c.put_ramp(7, y + 1, col, 4)
    c.outline()
    return c


def karaoke_screen():
    """Wandbildschirm mit Hopfball ueber Balken (kein Text), 30 x 20"""
    c = Canvas(30, 20)
    round_rect(c, 0, 0, 29, 19, 'metal', lo=0, hi=3, radius=1)
    for y in range(2, 18):
        for x in range(2, 28):
            c.put_ramp(x, y, 'purple', 1 if y < 11 else 2)
    # Textzeilen als Balken (Karaoke), davon eine hervorgehoben
    for k, (x0, x1, y) in enumerate(((4, 20, 6), (4, 24, 10), (4, 16, 14))):
        hline(c, x0, x1, y, 'bone', 4 if k != 1 else 5)
        hline(c, x0, x1, y + 1, 'bone', 2)
    hline(c, 4, 14, 10, 'gold', 5)
    hline(c, 4, 14, 11, 'gold', 3)
    # hopfender Ball
    ellipse(c, 15.5, 4.0, 1.8, 1.8, 'teamA', lo=2, hi=5)
    # Notensymbol rechts
    for y in range(3, 8):
        c.put_ramp(26, y, 'ice', 4)
    c.put_ramp(25, 8, 'ice', 5)
    c.put_ramp(24, 8, 'ice', 4)
    c.put_ramp(25, 7, 'ice', 3)
    c.outline()
    return c


# =========================================================================== BC-07 Huepfhalle


def floor_rubber():
    """weiche Gummimatte: 16x16-Pufferfliesen in Rot/Gelb/Gruen/Blau"""
    def draw(c):
        cols = [['ice', 'slime'], ['slime', 'ice']]
        for ty in range(2):
            for tx in range(2):
                col = cols[ty][tx]
                for y in range(16):
                    for x in range(16):
                        X, Y = tx * 16 + x, ty * 16 + y
                        # gewoelbte Pufferkante
                        e = min(x, y, 15 - x, 15 - y)
                        if e == 0:
                            idx = 1
                        elif x < 2 or y < 2:
                            idx = 4
                        elif x > 13 or y > 13:
                            idx = 2
                        else:
                            idx = 3
                            if x < 5 and y < 5 and (x + y) % 2 == 0:
                                idx = 4
                        if col in ('gold', 'ice') and idx == 4:
                            idx = 5
                        c.put_ramp(X, Y, col, idx)
    return _tile(draw)


def beach_ball(r=7, cols=('teamA', 'bone', 'ice', 'bone')):
    d = r * 2 + 2
    c = Canvas(d, d)
    cx = cy = d / 2.0
    for y in range(d):
        for x in range(d):
            nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
            L = sphere_L(nx, ny, 0.22)
            if L is None:
                continue
            ang = math.asin(max(-1.0, min(1.0, nx)))
            seg = int((ang + math.pi / 2) / (math.pi / 4.0)) % len(cols)
            col = cols[seg]
            lo, hi = (1, 5) if col != 'bone' else (2, 5)
            c.put_ramp(x, y, col, quant(L, lo, hi, x, y))
    c.put_ramp(int(cx - r * 0.35), int(cy - r * 0.45), 'bone', 5)
    c.outline()
    return c


def ball_pit(w=44, h=28):
    c = Canvas(w, h)
    rnd = random.Random(9)
    # gepolsterter Rand (Rueckwand + Seiten)
    round_rect(c, 0, 0, w - 1, h - 1, 'teamB', lo=1, hi=4, radius=3)
    round_rect(c, 3, 3, w - 4, h - 4, 'coal', lo=0, hi=1, radius=2)
    cols = ['teamA', 'gold', 'ice', 'slime', 'purple', 'fire']
    pts = []
    for yy in range(6, h - 4, 3):
        for xx in range(6, w - 4, 4):
            pts.append((xx + rnd.randint(-1, 1) + (2 if (yy // 3) % 2 else 0), yy + rnd.randint(-1, 1)))
    pts.sort(key=lambda p: p[1])
    for (x, y) in pts:
        if 5 <= x <= w - 6:
            ellipse(c, x, y, 3.2, 3.2, rnd.choice(cols), lo=1, hi=5, ambient=0.15)
            c.put_ramp(x - 1, y - 1, 'bone', 5)
    # Vorderkante (Polster) ueber die Baelle
    round_rect(c, 0, h - 8, w - 1, h - 1, 'teamB', lo=1, hi=4, radius=3)
    for x in range(5, w - 3, 8):
        c.put_ramp(x, h - 5, 'gold', 5)
    c.outline()
    return c


def bounce_pad(w=58, h=26):
    """Sprungfeld im Boden (Bodendekor): Ringe + Pfeilspitzen nach oben"""
    c = Canvas(w, h)
    cx, cy = w / 2.0, h / 2.0
    for y in range(h):
        for x in range(w):
            nx, ny = (x + 0.5 - cx) / (w / 2.0), (y + 0.5 - cy) / (h / 2.0)
            d = nx * nx + ny * ny
            if d > 1.0:
                continue
            if d > 0.86:
                idx = 1
            elif d > 0.72:
                idx = 5 if (x + y) % 2 == 0 else 4
            elif d > 0.64:
                idx = 2
            else:
                idx = 3
                ring = (math.sqrt(d) * 8) % 2
                if ring < 0.5:
                    idx = 2
            c.put_ramp(x, y, 'teamA', idx)
    # Pfeilspitzen (Chevron) nach oben
    for k, (yy, col) in enumerate(((int(cy) + 3, 3), (int(cy), 4), (int(cy) - 3, 5))):
        for dx in range(0, 6):
            c.put_ramp(int(cx) - dx, yy + dx // 2, 'gold', col)
            c.put_ramp(int(cx) + dx - 1, yy + dx // 2, 'gold', col)
    return c


def padded_wall(w=86):
    """Polsterung an der Nordwand: bunte Kissen mit Knoepfen (86 x 17)"""
    c = Canvas(w, 17)
    cols = ['teamA', 'gold', 'slime', 'ice', 'purple', 'fire']
    n = w // 14
    for k in range(n):
        x0 = k * 14 + 1
        col = cols[k % len(cols)]
        round_rect(c, x0, 1, x0 + 12, 15, col, lo=1, hi=5, radius=3)
        for (x, y) in ((x0 + 3, 4), (x0 + 9, 4), (x0 + 3, 11), (x0 + 9, 11)):
            c.put_ramp(x, y, 'bone', 5)
            c.put_ramp(x + 1, y + 1, 'bone', 2)
        c.put_ramp(x0 + 6, 8, 'bone', 4)
    c.outline()
    return c


def springboard():
    """kleines Sprungbrett mit Spiralfeder (24 x 16)"""
    c = Canvas(24, 16)
    for k in range(3):
        x = 6 + k * 6
        for y in range(8, 14):
            c.put_ramp(x, y, 'metal', 4 if y % 2 else 2)
            c.put_ramp(x + 1, y, 'metal', 2 if y % 2 else 3)
    poly(c, [(1, 8), (22, 5), (22, 8), (1, 10)], 'teamA', lo=2, hi=5)
    c.rect(2, 13, 21, 14, 'wood', 2)
    c.outline()
    return c


# =========================================================================== BC-08 Teesalon


def floor_salon():
    """Schachbrett aus Pflaume und Creme, edel"""
    def draw(c):
        for ty in range(4):
            for tx in range(4):
                light = (tx + ty) % 2 == 0
                col, base = ('bone', 3) if light else ('cloth', 2)
                for y in range(8):
                    for x in range(8):
                        idx = base
                        if x == 0 or y == 0:
                            idx += 1
                        if x == 7 or y == 7:
                            idx = max(0, idx - 1)
                        c.put_ramp(tx * 8 + x, ty * 8 + y, col, idx)
    return _tile(draw)


def tea_table():
    """runder Tisch mit langer Spitzendecke, Teekanne, Kuchenetagere (46 x 30), Fusspunkt unten"""
    c = Canvas(46, 30)
    cx = 23
    # Decke bis zum Boden (Zylinder), Plisseefalten
    for y in range(12, 28):
        for x in range(4, 43):
            nx = (x + 0.5 - cx) / 19.5
            nz = math.sqrt(max(0.0, 1 - nx * nx))
            dot_ = nx * LIGHT[0] + nz * LIGHT[2]
            L = 0.25 + 0.8 * max(0.0, dot_)
            idx = quant(L, 1, 4, x, y)
            if (x % 4) == 0:
                idx = max(0, idx - 1)
            ybot = 26 + 3.5 * math.sqrt(max(0.0, 1 - nx * nx))
            if y <= ybot:
                c.put_ramp(x, y, 'cloth', idx)
    # Spitzensaum unten (Zackenreihe)
    for x in range(4, 43):
        nx = (x + 0.5 - cx) / 19.5
        yb = int(26 + 3.5 * math.sqrt(max(0.0, 1 - nx * nx)))
        c.put_ramp(x, yb, 'bone', 5 if x % 2 else 4)
        if x % 4 in (0, 1):
            c.put_ramp(x, yb - 1, 'bone', 4)
    # goldene Borte
    for x in range(4, 43):
        nx = (x + 0.5 - cx) / 19.5
        yb = int(21 + 2.5 * math.sqrt(max(0.0, 1 - nx * nx)))
        c.put_ramp(x, yb, 'gold', 4 if x % 3 else 5)
    # Platte (Ellipse) mit weisser Spitzendecke
    ellipse(c, cx, 11.5, 20.5, 7.4, 'bone', lo=2, hi=5, ambient=0.4, flatness=0.55)
    # Spitzenrand-Punkte
    for k in range(0, 360, 20):
        a = math.radians(k)
        x = int(round(cx + 18.5 * math.cos(a)))
        y = int(round(11.5 + 6.4 * math.sin(a)))
        c.put_ramp(x, y, 'bone', 3)
    c.outline()
    return c


def teapot():
    c = Canvas(18, 14)
    ellipse(c, 8, 8, 6.2, 4.8, 'teamB', lo=1, hi=5, ambient=0.2)
    hline(c, 3, 13, 8, 'gold', 4)
    # Tuelle (rechts, nach oben gebogen)
    thick_line(c, 12, 9, 16, 4, 1.8, 'teamB', lo=2, hi=4)
    c.put_ramp(16, 3, 'teamB', 4)
    # Henkel links
    for (x, y) in ((1, 6), (0, 8), (1, 10), (2, 11)):
        c.put_ramp(x, y, 'teamB', 2)
    # Deckel + Knauf
    ellipse(c, 8, 4.3, 3.6, 1.8, 'teamB', lo=2, hi=5)
    c.put_ramp(8, 2, 'gold', 5)
    c.put_ramp(8, 1, 'gold', 4)
    c.put_ramp(6, 7, 'bone', 5)
    c.outline()
    return c


def teacup(steam=True):
    """Tasse auf Untertasse, mit Dampf (12 x 13)"""
    c = Canvas(12, 13)
    ellipse(c, 6, 10.5, 5.2, 1.8, 'bone', lo=2, hi=5)
    # Tasse: Halbkugel
    ellipse(c, 6, 6.8, 3.8, 3.8, 'bone', lo=3, hi=5, clip=lambda x, y: y >= 6)
    c.rect(2, 6, 9, 6, 'gold', 4)
    c.rect(3, 7, 8, 7, 'teamB', 3)
    c.put_ramp(10, 7, 'bone', 3)
    c.put_ramp(11, 8, 'bone', 3)
    c.put_ramp(10, 9, 'bone', 3)
    if steam:
        for (x, y, i) in ((5, 4, 4), (6, 3, 3), (5, 2, 4), (6, 1, 3), (7, 0, 2)):
            c.put_ramp(x, y, 'bone', i)
    c.outline()
    return c


def cake_stand():
    c = Canvas(14, 18)
    c.rect(6, 5, 7, 15, 'gold', 3)
    c.rect(6, 5, 6, 15, 'gold', 5)
    ellipse(c, 6.5, 16, 5.0, 1.6, 'gold', lo=2, hi=5)
    for (y, rx, col) in ((13, 6.0, 'bone'), (7, 4.4, 'bone')):
        ellipse(c, 6.5, y, rx, 1.8, col, lo=3, hi=5)
    # Toertchen
    for (x, y, col) in ((3, 11, 'teamA'), (8, 11, 'gold'), (6, 5, 'teamA')):
        c.rect(x, y, x + 2, y + 1, col, 3)
        c.put_ramp(x + 1, y - 1, 'bone', 5)
    c.outline()
    return c


def salon_chair():
    """Stuhl mit hoher Lehne, Pflaumenkissen, von vorn (16 x 24)"""
    c = Canvas(16, 24)
    # Lehne
    round_rect(c, 2, 0, 13, 12, 'wood', lo=1, hi=4, radius=2)
    round_rect(c, 4, 2, 11, 10, 'cloth', lo=2, hi=4, radius=1)
    c.put_ramp(7, 5, 'gold', 5)
    c.put_ramp(8, 5, 'gold', 4)
    # Sitz
    round_rect(c, 1, 12, 14, 16, 'cloth', lo=2, hi=5, radius=2)
    hline(c, 1, 14, 17, 'wood', 2)
    # Beine
    for x in (2, 12):
        c.rect(x, 17, x + 1, 23, 'wood', 3)
        c.put_ramp(x, 17, 'wood', 4)
    c.outline()
    return c


def wall_clock():
    """Standuhr-Front: Zifferblatt bleibt stehen, Pendel haengt schief, Frostkristalle (20 x 24)"""
    c = Canvas(20, 24)
    round_rect(c, 2, 0, 17, 23, 'wood', lo=1, hi=4, radius=3)
    ellipse(c, 9.5, 8.5, 6.4, 6.4, 'gold', lo=1, hi=5)
    ellipse(c, 9.5, 8.5, 4.9, 4.9, 'bone', lo=3, hi=5, ambient=0.5, flatness=0.7)
    for k in range(12):
        a = math.radians(k * 30)
        c.put_ramp(9 + int(round(math.cos(a) * 4.0)), 8 + int(round(math.sin(a) * 4.0)), 'coal', 1)
    thick_line(c, 9.5, 8.5, 9.5, 5, 1.2, 'coal', lo=0, hi=2)
    thick_line(c, 9.5, 8.5, 12, 10, 1.2, 'coal', lo=0, hi=2)
    # Pendelkasten
    c.rect(6, 16, 13, 22, 'coal', 0)
    c.line(9, 16, 11, 20, 'metal', 4)
    ellipse(c, 11, 20.5, 2.1, 2.1, 'gold', lo=2, hi=5)
    # Frost
    for (x, y) in ((5, 4), (6, 4), (14, 6), (13, 13), (4, 11)):
        c.put_ramp(x, y, 'ice', 5)
    c.put_ramp(5, 3, 'ice', 4)
    c.put_ramp(3, 1, 'ice', 5)
    c.put_ramp(16, 2, 'ice', 5)
    c.outline()
    return c


def teaspill_stream(h=12):
    """haengende Teetropfen (Zeit steht still), 5 x h"""
    c = Canvas(5, h)
    for y in range(0, h, 1):
        if y % 4 != 3:
            c.put_ramp(2, y, 'wood', 5 if y % 4 == 0 else 4)
            if y % 4 == 1:
                c.put_ramp(3, y, 'wood', 3)
    c.put_ramp(1, h - 3, 'wood', 4)
    c.put_ramp(4, 4, 'wood', 4)
    return c


# =========================================================================== BC-05 Schwerkraft-Umkehrer


def floor_gravity():
    """Metallplatten mit Nieten, dunkel"""
    def draw(c):
        for ty in range(2):
            for tx in range(2):
                for y in range(16):
                    for x in range(16):
                        idx = 2
                        if x == 0 or y == 0:
                            idx = 3
                        if x == 15 or y == 15:
                            idx = 0
                        if x in (2, 13) and y in (2, 13):
                            idx = 4
                        if (x + y) % 7 == 0 and idx == 2:
                            idx = 1 if (tx + ty) % 2 else 2
                        c.put_ramp(tx * 16 + x, ty * 16 + y, 'metal', max(0, idx - 1) if (tx + ty) % 2 else idx)
    return _tile(draw)


def gravity_plate(w=60, h=30):
    """Bodenplatte mit Ring und Aufwaertspfeilen (Bodendekor)"""
    c = Canvas(w, h)
    cx, cy = w / 2.0, h / 2.0
    for y in range(h):
        for x in range(w):
            nx, ny = (x + 0.5 - cx) / (w / 2.0), (y + 0.5 - cy) / (h / 2.0)
            d = nx * nx + ny * ny
            if d > 1.0:
                continue
            if d > 0.84:
                idx = 4 if (x + y) % 2 == 0 else 3
                c.put_ramp(x, y, 'purple', idx)
            elif d > 0.72:
                c.put_ramp(x, y, 'coal', 1)
            else:
                c.put_ramp(x, y, 'purple', 1 if (x + y) % 2 else 0)
    # Pfeile nach oben (Norden)
    for k, ax in enumerate((-12, 0, 12)):
        x0 = int(cx) + ax
        yb = int(cy) + 4
        for dy in range(0, 7):
            c.put_ramp(x0, yb - dy, 'purple', 5 if dy % 2 == 0 else 4)
        for dx in range(0, 4):
            c.put_ramp(x0 - dx, yb - 7 + dx, 'purple', 5)
            c.put_ramp(x0 + dx, yb - 7 + dx, 'purple', 5)
    return c


def inverter_machine():
    """Gravitations-Umkehrer: Metallschrank mit Spulen, schwebender Kristall, Pfeile nach oben (34 x 54)"""
    c = Canvas(34, 54)
    # Sockel + Schrank
    round_rect(c, 3, 34, 30, 52, 'metal', lo=0, hi=4, radius=2)
    for y in (39, 46):
        hline(c, 4, 29, y, 'metal', 1)
    # Warnstreifen
    for x in range(4, 30):
        if ((x + 2) // 3) % 2 == 0:
            c.put_ramp(x, 50, 'gold', 4)
            c.put_ramp(x, 51, 'gold', 3)
        else:
            c.put_ramp(x, 50, 'coal', 1)
            c.put_ramp(x, 51, 'coal', 1)
    # Anzeigen
    for k, col in enumerate(('slime', 'gold', 'teamA')):
        ellipse(c, 9 + k * 8, 43, 2.2, 2.2, col, lo=2, hi=5)
    # Spulen (gestapelte Ringe)
    for k in range(3):
        y = 31 - k * 4
        ellipse(c, 16.5, y, 9.0 - k * 0.5, 2.8, 'metal', lo=1, hi=5, ambient=0.3, flatness=0.3)
        ellipse(c, 16.5, y, 5.5, 1.5, 'purple', lo=0, hi=2, ambient=0.3)
    # Kristall
    poly(c, [(16, 2), (22, 10), (16, 18), (10, 10)], 'purple', lo=1, hi=5)
    poly(c, [(16, 2), (16, 18), (10, 10)], 'purple', lo=2, hi=5)
    vline(c, 16, 4, 16, 'purple', 5)
    c.put_ramp(13, 8, 'purple', 5)
    c.put_ramp(14, 6, 'purple', 5)
    c.outline()
    return c


def up_arrow(col='purple', big=False):
    """Pfeil nach oben, 9 x 12"""
    c = Canvas(9, 12)
    for dy in range(0, 9):
        c.put_ramp(4, 3 + dy, col, 5 if dy % 2 == 0 else 4)
    for dx in range(0, 5):
        c.put_ramp(4 - dx, dx, col, 5)
        c.put_ramp(4 + dx, dx, col, 4)
    return c


def flying_carpet(w=46, h=18, team='teamA'):
    """schwebender Teppich: wellige Kante, Fransen haengen nach unten"""
    c = Canvas(w, h)
    for x in range(w):
        wob = int(round(2.0 * math.sin(x / 6.0)))
        top = 3 + wob
        bot = 11 + wob
        for y in range(top, bot + 1):
            edge = min(y - top, bot - y, x, w - 1 - x)
            if edge == 0:
                idx = 1
            elif edge == 1:
                idx = 4
            elif edge in (2, 3):
                idx = 3 if (x + y) % 2 == 0 else 2
            else:
                idx = 2 if ((x // 3 + y // 3) % 2 == 0) else 3
            c.put_ramp(x, y, team, idx)
        # Fransen
        if x % 2 == 0:
            for k in range(1, 4):
                c.put_ramp(x, bot + k, 'bone', 4 if k < 3 else 3)
    c.outline()
    return c


# =========================================================================== BC-03 Brutkasten


def floor_hay():
    """dunkle warme Dielen, einzelne Strohhalme"""
    def draw(c):
        pl = tile_planks(17, 32, tone=(1, 2, 2))
        c.px[:] = pl.px
        c.rid[:] = pl.rid
        rnd = random.Random(21)
        for _ in range(7):
            x, y = rnd.randint(1, 27), rnd.randint(1, 30)
            ln = rnd.randint(3, 5)
            for k in range(ln):
                c.put_ramp(x + k, y + (k // 3), 'gold', 3)
            c.put_ramp(x + ln, y + (ln // 3), 'dirt', 2)
    return _tile(draw)


def dragon_egg_nest(w=48, h=44):
    """grosses Nest aus Stroh mit lila Drachenei, Tapferkeitsmedaille und Schnarchblase"""
    c = Canvas(w, h)
    cx = w // 2
    # Nest hinten (Strohkranz)
    ellipse(c, cx, 34, 22, 9.0, 'dirt', lo=1, hi=4, ambient=0.3, flatness=0.3)
    ellipse(c, cx, 33, 17, 5.6, 'dirt', lo=0, hi=2, ambient=0.3, flatness=0.5)
    rnd = random.Random(3)
    straw = []
    for _ in range(64):
        a = rnd.uniform(0, math.pi * 2)
        r = rnd.uniform(0.8, 1.05)
        x = int(round(cx + math.cos(a) * 21 * r))
        y = int(round(34 + math.sin(a) * 8.2 * r))
        ln = rnd.randint(3, 5)
        dx = 1 if rnd.random() > 0.5 else -1
        col = [rnd.choice([3, 4, 5]) for _ in range(ln)]
        straw.append((x, y, ln, dx, col))
    for (x, y, ln, dx, col) in straw:
        if y < 34:                                   # Strohhalme hinter dem Ei
            for k in range(ln):
                c.put_ramp(x + k * dx, y - (k // 2), 'gold', col[k])
    # Ei (rundlich, nach oben leicht verjuengt)
    ex, ey, hh, ww = cx, 19.5, 15.0, 11.8
    for y in range(0, 36):
        for x in range(cx - 13, cx + 14):
            t = (y + 0.5 - ey) / hh
            if abs(t) >= 1.0:
                continue
            half = math.sqrt(1 - t * t) * ww * (1.0 + 0.08 * t)
            nx = (x + 0.5 - ex)
            if abs(nx) > half:
                continue
            u = nx / max(0.5, half)
            nz = math.sqrt(max(0.0, 1 - u * u))
            dot_ = u * LIGHT[0] + t * LIGHT[1] + nz * LIGHT[2]
            L = 0.18 + 0.82 * max(0.0, dot_)
            c.put_ramp(x, y, 'purple', quant(L, 1, 5, x, y))
    # goldene Flecken (Drachen-Zeichnung) + Zickzackband
    for (sx, sy, r) in ((cx - 5, 8, 2.4), (cx + 5, 11, 2.0), (cx - 8, 25, 2.2), (cx + 8, 25, 2.2), (cx + 1, 4, 1.6)):
        ellipse(c, sx, sy, r, r * 0.9, 'slime', lo=2, hi=5)
    for k in range(-5, 6):
        x = cx + k * 2
        y = 21 + (1 if k % 2 else 0)
        if c.alpha(x, y):
            c.put_ramp(x, y, 'purple', 1)
            c.put_ramp(x, y + 1, 'purple', 2)
    # Augen geschlossen (Schlaf), kleiner Mund
    for dx in (-6, 2):
        c.put_ramp(cx + dx, 15, 'coal', 1)
        c.put_ramp(cx + dx + 1, 16, 'coal', 1)
        c.put_ramp(cx + dx + 2, 16, 'coal', 1)
        c.put_ramp(cx + dx + 3, 15, 'coal', 1)
    c.rect(cx - 1, 19, cx + 1, 19, 'coal', 1)
    # Schnarchblase rechts oben
    ellipse(c, cx + 13, 9, 3.6, 3.6, 'ice', lo=3, hi=5)
    c.put_ramp(cx + 12, 8, 'bone', 5)
    c.put_ramp(cx + 10, 13, 'ice', 4)
    c.put_ramp(cx + 9, 15, 'ice', 3)
    # Strohhalme vor dem Ei
    for (x, y, ln, dx, col) in straw:
        if y >= 34:
            for k in range(ln):
                c.put_ramp(x + k * dx, y - (k // 2), 'gold', col[k])
    # Medaille am roten Band (vor dem Stroh)
    for k in range(7):
        c.rect(cx - 6 + k, 21 + k, cx - 5 + k, 21 + k, 'teamA', 4)
        c.rect(cx + 5 - k, 21 + k, cx + 6 - k, 21 + k, 'teamA', 3)
    ellipse(c, cx, 31.5, 4.2, 4.2, 'gold', lo=2, hi=5)
    ellipse(c, cx, 31.5, 2.6, 2.6, 'gold', lo=1, hi=3)
    c.put_ramp(cx, 30, 'teamA', 4)
    c.put_ramp(cx - 1, 31, 'teamA', 4)
    c.put_ramp(cx, 31, 'teamA', 5)
    c.put_ramp(cx + 1, 31, 'teamA', 4)
    c.put_ramp(cx, 32, 'teamA', 4)
    c.put_ramp(cx - 2, 29, 'bone', 5)
    c.outline()
    return c


def heat_lamp():
    """Waermelampe auf Stativ mit Kegelschirm (20 x 40)"""
    c = Canvas(20, 40)
    # Stativ
    c.rect(9, 12, 10, 37, 'metal', 3)
    c.rect(9, 12, 9, 37, 'metal', 5)
    poly(c, [(4, 38), (15, 38), (12, 35), (7, 35)], 'metal', lo=1, hi=4)
    # Schirm (Kegel nach unten rechts gerichtet)
    poly(c, [(3, 5), (16, 5), (19, 14), (0, 14)], 'metal', lo=1, hi=5)
    c.rect(2, 13, 17, 14, 'gold', 3)
    c.rect(2, 13, 17, 13, 'gold', 5)
    # Gluehbirne
    ellipse(c, 9.5, 15.5, 3.2, 2.6, 'gold', lo=3, hi=5)
    c.put_ramp(8, 15, 'bone', 5)
    c.put_ramp(9, 15, 'bone', 5)
    c.put_ramp(9, 2, 'metal', 4)
    c.rect(8, 2, 11, 5, 'metal', 3)
    c.outline()
    return c


def warm_beam(w=34, h=24):
    """Waermekegel als Dither (Bodendekor): oben schmal, unten breit"""
    c = Canvas(w, h)
    for y in range(h):
        half = 3 + y * (w / 2 - 4) / h
        for x in range(w):
            if abs(x + 0.5 - w / 2.0) < half:
                t = abs(x + 0.5 - w / 2.0) / half
                if (x + y) % 2 == 0 and t < 0.9:
                    c.put_ramp(x, y, 'gold', 4 if t < 0.5 else 3)
    return c


def thermometer():
    """Riesenthermometer an der Wand (10 x 21)"""
    c = Canvas(10, 21)
    round_rect(c, 3, 0, 6, 15, 'bone', lo=3, hi=5, radius=1)
    ellipse(c, 4.5, 17.5, 3.4, 3.4, 'bone', lo=3, hi=5)
    c.rect(4, 4, 5, 15, 'teamA', 3)
    ellipse(c, 4.5, 17.5, 2.2, 2.2, 'teamA', lo=2, hi=5)
    c.put_ramp(4, 16, 'bone', 5)
    for y in range(2, 14, 3):
        c.put_ramp(7, y, 'coal', 2)
        c.put_ramp(8, y, 'coal', 2)
    c.outline()
    return c


def pressure_gauge():
    """Manometer an der Wand (14 x 14)"""
    c = Canvas(14, 14)
    ellipse(c, 7, 7, 6.4, 6.4, 'gold', lo=1, hi=5)
    ellipse(c, 7, 7, 4.8, 4.8, 'bone', lo=3, hi=5, ambient=0.5, flatness=0.7)
    for k in range(7):
        a = math.radians(150 + k * 40)
        c.put_ramp(7 + int(round(math.cos(a) * 4)), 7 + int(round(math.sin(a) * 4)), 'coal', 1)
    thick_line(c, 7, 7, 10, 4, 1.0, 'teamA', lo=2, hi=4)
    c.put_ramp(7, 7, 'coal', 0)
    c.outline()
    return c


def blanket_rug(w=60, h=30):
    """warmer Teppich (Bodendekor) unter dem Nest: Ringe in Orange/Gelb, gedaempft"""
    c = Canvas(w, h)
    cx, cy = w / 2.0, h / 2.0
    for y in range(h):
        for x in range(w):
            nx, ny = (x + 0.5 - cx) / (w / 2.0), (y + 0.5 - cy) / (h / 2.0)
            d = nx * nx + ny * ny
            if d > 1.0:
                continue
            ring = int(math.sqrt(d) * 8)
            col, idx = (('teamA', 2), ('fire', 2), ('teamA', 1), ('gold', 2))[ring % 4]
            if d > 0.9:
                col, idx = 'teamA', 1
            elif (x + y) % 2 == 0 and ring % 4 == 3:
                idx = 1
            c.put_ramp(x, y, col, idx)
    return c


def hay_bale(w=24, h=16):
    c = Canvas(w, h)
    round_rect(c, 1, 2, w - 2, h - 2, 'dirt', lo=2, hi=5, radius=2)
    rnd = random.Random(8)
    for _ in range(40):
        x, y = rnd.randint(2, w - 4), rnd.randint(3, h - 4)
        for k in range(3):
            c.put_ramp(x + k, y - (k // 2), 'gold', rnd.choice([3, 4, 5]))
    for x in (7, w - 8):
        c.rect(x, 2, x, h - 2, 'wood', 2)
        c.rect(x + 1, 2, x + 1, h - 2, 'wood', 1)
    for x in range(3, w - 3, 2):
        c.put_ramp(x, 2, 'gold', 5)
    c.outline()
    return c
