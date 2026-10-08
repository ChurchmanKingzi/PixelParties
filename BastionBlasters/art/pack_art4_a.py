"""pack_art4 - Verteidiger-Sprites Teil A: UV-02 Kauz-Gargoyle, UV-03 Schleimschnecke, UV-04 Schildkroeten-Zwerge,
UV-05 Tuersteher-Troll, UV-06 Ton-Golem. Alle Figuren blicken nach rechts."""
from __future__ import annotations

import math
import random

from pixl import *


def _ring(c, cx, cy, r_out, r_in, ramp, lo, hi, ambient=0.3):
    """schattierter Ring (Brillenglas-Rand, Henkel); Innenflaeche bleibt unberuehrt"""
    rid = RAMP_ID[ramp]
    for y in range(int(cy - r_out - 1), int(cy + r_out + 2)):
        for x in range(int(cx - r_out - 1), int(cx + r_out + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r_out or d < r_in:
                continue
            L = ambient + (1 - ambient) * max(0.0, min(1.0, 0.55 - 0.45 * (dx + dy) / (r_out * 1.4)))
            c.put(x, y, RAMPS[ramp][quant(L, lo, hi, x, y)], rid)


# =========================================================================== UV-02 Kauz-Gargoyle


def spr_owl_gargoyle(anim='idle', f=0):
    """Steinerne Eule auf Sockel, Brille, Moosmuetze. anim 'awake': Augen glimmen, Fluegel leicht offen."""
    awake = anim == 'awake'
    c = Canvas(40, 44)
    bob = 0
    # Sockel: Oberseite + Front
    round_rect(c, 3, 36, 36, 43, 'stone', lo=1, hi=4, radius=1)
    for x in range(4, 36):
        c.put_ramp(x, 36, 'stone', 5 if x % 5 else 4)
        c.put_ramp(x, 37, 'stone', 4)
    for x in range(4, 36):
        c.put_ramp(x, 43, 'stone', 0)
    for (x, y) in ((9, 40), (10, 41), (11, 41), (26, 39), (27, 40), (28, 40), (29, 41)):
        c.put_ramp(x, y, 'stone', 1)
    # Bemoostes Eck
    for (x, y, i) in ((4, 37, 3), (5, 37, 3), (4, 38, 2), (33, 37, 3), (34, 37, 3), (35, 38, 2), (6, 38, 2), (32, 38, 2)):
        c.put_ramp(x, y, 'leaf', i)
    # Fluegel (hinter dem Koerper)
    wing_dx = 3 if awake else 0
    # Gargoyle-Fluegelspitzen ragen ueber die Schultern
    poly(c, [(9, 24), (1 - wing_dx, 10), (5 - wing_dx, 9), (14, 17)], 'stone', lo=0, hi=3)
    poly(c, [(31, 24), (39 + wing_dx, 10), (35 + wing_dx, 9), (26, 17)], 'stone', lo=1, hi=4)
    c.put_ramp(1 - wing_dx, 10, 'stone', 4)
    c.put_ramp(39 + wing_dx, 10, 'stone', 5)
    ellipse(c, 8 - wing_dx, 25, 5.4, 12.5, 'stone', lo=0, hi=3, ambient=0.2)
    ellipse(c, 31 + wing_dx, 25, 5.4, 12.5, 'stone', lo=1, hi=4, ambient=0.2)
    # Koerper
    ellipse(c, 20, 25, 11.5, 12.5, 'stone', lo=1, hi=5, ambient=0.18, flatness=0.1)
    # Bauchfeder-Winkel
    for (cy_, ww) in ((22, 3), (26, 4), (30, 5)):
        for k in range(ww + 1):
            c.put_ramp(20 - k, cy_ + k // 2, 'stone', 2)
            c.put_ramp(20 + k, cy_ + k // 2, 'stone', 2)
    # Fluegelfedern vorn: Reihen
    for side, x0 in ((-1, 9 - wing_dx), (1, 31 + wing_dx)):
        for k, y in enumerate((22, 25, 28, 31, 34)):
            for dx in range(-3, 4):
                xx = x0 + dx
                if c.alpha(xx, y + abs(dx) // 3):
                    c.put_ramp(xx, y + abs(dx) // 3, 'stone', 1 if side < 0 else 2)
    # Krallen
    for fx in (13, 22):
        for k in range(3):
            c.rect(fx + k * 2, 34, fx + k * 2 + 1, 36, 'stone', 4 if k == 0 else 3)
            c.put_ramp(fx + k * 2, 36, 'stone', 5)
            c.put_ramp(fx + k * 2 + 1, 37, 'stone', 1)
    # Kopf (breit, eulenhaft) + Ohrbueschel
    ellipse(c, 20, 12, 12.5, 8.2, 'stone', lo=2, hi=5, ambient=0.2, flatness=0.1)
    poly(c, [(8, 9), (7, 1), (13, 6)], 'stone', lo=2, hi=5)
    poly(c, [(32, 9), (33, 1), (27, 6)], 'stone', lo=1, hi=4)
    # Moosmuetze
    def cap(x, y):
        return y <= 8
    ellipse(c, 20, 9.5, 10.8, 6.4, 'leaf', lo=1, hi=4, clip=cap, ambient=0.2)
    for (x, y, i) in ((12, 3, 4), (13, 2, 5), (15, 1, 4), (18, 1, 5), (21, 0, 4), (24, 1, 4), (27, 3, 4), (26, 2, 5), (16, 3, 5), (22, 3, 3)):
        c.put_ramp(x, y, 'leaf', i)
    for x in range(10, 31):
        c.put_ramp(x, 8, 'leaf', 1 if x % 2 else 2)
    for x in (11, 14, 17, 23, 26, 29):
        c.put_ramp(x, 9, 'leaf', 2)
    # Gesicht: Brille (zwei Glaeser), Schnabel
    for (lx, ly) in ((14, 13), (26, 13)):
        ellipse(c, lx, ly, 4.0, 4.0, 'stone', lo=0, hi=2, ambient=0.3)
        for dy in (-1, 0, 1):
            pass
        _ring(c, lx, ly, 4.4, 3.0, 'gold', 2, 5)
        # Glas
        for y in range(ly - 3, ly + 4):
            for x in range(lx - 3, lx + 4):
                if math.hypot(x + 0.5 - lx, y + 0.5 - ly) <= 3.0:
                    c.put_ramp(x, y, 'sky' if not awake else 'gold', 4 if (x + y) % 4 else 3)
        # Pupille 2x2
        c.rect(lx, ly - 1, lx + 1, ly, 'coal', 1)
        c.put_ramp(lx - 1, ly - 2, 'bone', 5)
        if awake:
            c.rect(lx, ly - 1, lx + 1, ly, 'fire', 5)
    c.rect(18, 12, 22, 12, 'gold', 3)               # Brueckenbuegel
    poly(c, [(18, 14), (22, 14), (20, 19)], 'bone', lo=3, hi=5)
    c.put_ramp(20, 19, 'stone', 1)
    # Moos am Rand
    for (x, y, i) in ((9, 28, 3), (10, 29, 2), (30, 30, 3), (29, 31, 2), (17, 34, 3), (16, 35, 2)):
        c.put_ramp(x, y, 'leaf', i)
    c.outline()
    return c


# =========================================================================== UV-03 Schleimschnecke


def spr_slime_snail(anim='idle', f=0):
    """Fette Schnecke, deren 'Haus' ein Rundschild mit Spirale ist. Augenstiele, glaenzender Schleim."""
    c = Canvas(52, 40)
    sway = [0, 1][f % 2] if anim == 'idle' else 0
    cx, cy, R = 20, 18, 15
    # Schild-Haus: Metallrand, Teamfarben-Flaeche, Spirale, Buckel
    _ring(c, cx, cy, R, R - 3.6, 'metal', 0, 4, ambient=0.2)
    ellipse(c, cx, cy, R - 3.4, R - 3.4, 'teamA', lo=1, hi=4, ambient=0.28, flatness=0.15)
    pts = []
    n = 120
    for k in range(n + 1):
        t = k / n
        th = t * 4.2 * math.pi
        r = 2.4 + t * (R - 6.2)
        pts.append((cx + math.cos(th) * r, cy + math.sin(th) * r * 0.98))
    for (x, y) in pts:
        c.put_ramp(int(x), int(y), 'gold', 4 if (x + y) < cx + cy + 2 else 3)
    for (x, y) in pts[::5]:
        c.put_ramp(int(x) - 1, int(y) - 1, 'gold', 5)
    ellipse(c, cx, cy, 2.8, 2.8, 'gold', lo=2, hi=5, ambient=0.3)
    c.put_ramp(cx - 1, cy - 1, 'gold', 5)
    for k in range(8):
        a = k * math.pi / 4 + 0.3
        c.put_ramp(int(cx + math.cos(a) * (R - 1.8)), int(cy + math.sin(a) * (R - 1.8)), 'metal', 5 if k < 4 else 3)
    # Fuss (langer fetter Koerper) ueberlappt den Schild unten
    ellipse(c, 25, 33.5, 23, 5.6, 'slime', lo=1, hi=4, ambient=0.2)
    poly(c, [(1, 37), (10, 29), (13, 38)], 'slime', lo=1, hi=3)
    for x in range(4, 46):
        c.put_ramp(x, 38, 'slime', 0 if x % 2 else 1)
    # Hals und Kopf
    ellipse(c, 41, 28, 6.6, 8.8, 'slime', lo=2, hi=5, ambient=0.22)
    ellipse(c, 44, 20.5, 6.6, 5.6, 'slime', lo=2, hi=5, ambient=0.2)
    # Augenstiele
    thick_line(c, 40, 17, 38 - sway, 7, 2.6, 'slime', lo=2, hi=5)
    thick_line(c, 46, 16, 48 + sway, 6, 2.6, 'slime', lo=3, hi=5)
    for (ex, ey) in ((38 - sway, 5), (48 + sway, 4)):
        ellipse(c, ex, ey, 3.2, 3.2, 'bone', lo=3, hi=5)
        c.rect(ex + 1, ey, ex + 2, ey + 1, 'coal', 1)
    # Mund + Schleimglanz
    for x in range(47, 51):
        c.put_ramp(x, 24, 'slime', 0)
    c.put_ramp(50, 23, 'slime', 0)
    for (x, y) in ((40, 22), (41, 22), (36, 29), (37, 29), (14, 33), (15, 33), (16, 33), (28, 32), (29, 32), (6, 36), (7, 36)):
        c.put_ramp(x, y, 'slime', 5)
    for (x, y) in ((42, 18), (43, 18), (44, 18), (30, 31)):
        c.put_ramp(x, y, 'bone', 5)
    c.outline()
    return c


# =========================================================================== UV-04 Schildkroeten-Zwerge


def _hex_scutes(c, cx, top_y, rim_y, rx, R, rid):
    """Sechseck-Platten auf der Panzerkuppel (nur auf Panzerpixeln, ueber dem Rand)"""
    hw = R * math.sqrt(3.0)
    pts_edges = []
    for row in range(-1, 4):
        for col in range(-4, 5):
            hx = cx + col * hw + (row % 2) * hw / 2.0
            hy = top_y + 3 + row * R * 1.5
            vs = [(hx + R * math.cos(math.radians(60 * k - 30)), hy + R * math.sin(math.radians(60 * k - 30))) for k in range(6)]
            for k in range(6):
                pts_edges.append((vs[k], vs[(k + 1) % 6], hx, hy))
    for (a, b, hx, hy) in pts_edges:
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) * 2) + 1
        for i in range(n + 1):
            t = i / n
            x = int(round(a[0] + (b[0] - a[0]) * t))
            y = int(round(a[1] + (b[1] - a[1]) * t))
            if 0 <= x < c.w and 0 <= y < rim_y - 1 and c.px[y, x, 3] and c.rid[y, x] == rid:
                c.put_ramp(x, y, 'leaf', 0)
    # Mitten der Platten aufhellen (Glanz oben links in jeder Platte)
    for row in range(-1, 4):
        for col in range(-4, 5):
            hx = cx + col * hw + (row % 2) * hw / 2.0
            hy = top_y + 3 + row * R * 1.5
            x, y = int(round(hx - 1)), int(round(hy - 1))
            if 0 <= x < c.w and 0 <= y < rim_y - 2 and c.px[y, x, 3] and c.rid[y, x] == rid:
                c.put_ramp(x, y, 'leaf', 5)
                c.put_ramp(x + 1, y, 'leaf', 4)


def _turtle_dwarf(c, cx, by, rx, ry, beard, flag=False):
    """Ein Zwerg unter dem Panzer: Kopf mit Bart und Helm schaut vorn (rechts) heraus wie ein Schildkroetenkopf.
    by = Unterkante des Panzerrands."""
    # hintere Stiefel (unter dem Panzer)
    for dx in (-rx * 0.62, -rx * 0.12):
        x0 = int(cx + dx)
        c.rect(x0, by + 1, x0 + 4, by + 4, 'wood', 3)
        c.rect(x0, by + 1, x0 + 1, by + 4, 'wood', 4)
        c.rect(x0, by + 5, x0 + 5, by + 5, 'wood', 1)
        c.rect(x0 + 4, by + 2, x0 + 4, by + 4, 'wood', 2)
    # Schatten unter dem Panzer
    for x in range(int(cx - rx) + 2, int(cx + rx) - 1):
        c.put_ramp(x, by + 1, 'coal', 1)
        if x % 2 == 0:
            c.put_ramp(x, by + 2, 'coal', 1)
    # Panzerkuppel
    def clip(x, y):
        return y <= by - 1
    ellipse(c, cx, by - 1, rx, ry, 'leaf', lo=1, hi=5, ambient=0.16, clip=clip)
    rid = RAMP_ID['leaf']
    _hex_scutes(c, cx, by - 1 - ry, by - 1, rx, 4.4, rid)
    for x in range(int(cx - rx) + 1, int(cx + rx)):
        if c.alpha(x, by - 1):
            c.put_ramp(x, by - 1, 'dirt', 4 if x < cx else 3)
        if c.alpha(x, by):
            c.put_ramp(x, by, 'dirt', 2 if x < cx else 1)
    poly(c, [(cx - rx - 3, by), (cx - rx + 1, by - 6), (cx - rx + 2, by - 2)], 'leaf', lo=1, hi=3)
    # Kopf mit Helm und Bart ragt vorn heraus
    hx, hy = int(cx + rx + 1), by - 4
    # vordere Stiefel
    x0 = hx - 3
    c.rect(x0, by + 1, x0 + 4, by + 4, 'wood', 3)
    c.rect(x0, by + 1, x0 + 1, by + 4, 'wood', 4)
    c.rect(x0, by + 5, x0 + 6, by + 5, 'wood', 1)
    c.rect(x0 + 4, by + 2, x0 + 4, by + 4, 'wood', 2)
    c.rect(x0 + 5, by + 4, x0 + 6, by + 4, 'wood', 3)
    ellipse(c, hx, hy, 4.8, 4.4, 'skin', lo=2, hi=5)
    c.rect(hx + 1, hy - 1, hx + 2, hy, 'coal', 1)                      # Auge
    ellipse(c, hx + 4.6, hy + 0.6, 1.8, 1.7, 'skin', lo=3, hi=5)         # Knollennase
    poly(c, [(hx - 5, hy + 1), (hx + 5, hy + 1), (hx + 5, hy + 5), (hx + 3, by + 8), (hx - 1, by + 9), (hx - 4, by + 6)], beard, lo=2, hi=5)
    for k in range(3):
        c.put_ramp(hx - 2 + k * 3, hy + 4 + k, beard, 1)
        c.put_ramp(hx - 2 + k * 3, hy + 5 + k, beard, 1)
    c.rect(hx - 3, hy + 1, hx + 4, hy + 1, beard, 1)
    ellipse(c, hx - 0.5, hy - 4.2, 5.4, 3.2, 'metal', lo=1, hi=5, clip=lambda x, y: y <= hy - 3)
    for x in range(hx - 5, hx + 5):
        c.put_ramp(x, hy - 3, 'metal', 1 if x % 2 else 2)
    c.put_ramp(hx, hy - 8, 'metal', 5)
    c.put_ramp(hx, hy - 7, 'metal', 4)
    if flag:
        c.rect(cx - 2, by - 1 - ry - 7, cx - 2, by - ry + 2, 'wood', 3)
        poly(c, [(cx - 1, by - 1 - ry - 7), (cx + 6, by - 1 - ry - 5), (cx - 1, by - 1 - ry - 3)], 'teamA', lo=2, hi=4)


def spr_turtle_dwarves(anim='idle', f=0):
    """Zwei Zwerge unter Schildkroetenpanzern, Koepfe schauen heraus wie Schildkroetenkoepfe (Schildwand / Panzerkuppel)"""
    c = Canvas(64, 44)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    _turtle_dwarf(c, 44, 29 + bob, 12, 12, 'bone', flag=True)
    _turtle_dwarf(c, 17, 37, 13, 13, 'fire')
    c.outline()
    return c


# =========================================================================== UV-05 Tuersteher-Troll


def spr_bouncer_troll(anim='idle', f=0, skin='purple'):
    """Riesiger Troll im Smoking mit Sonnenbrille und Klemmbrett (Fliege + Kummerbund in Teamfarbe)"""
    c = Canvas(52, 54)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    cx = 21
    # Schuhe + Hosenbeine
    for (x0, x1, lo, hi) in ((9, 19, 1, 3), (24, 34, 2, 4)):
        round_rect(c, x0 + 1, 40 + bob, x1 - 1, 49, 'coal', lo=0, hi=2, radius=1)
        round_rect(c, x0 - 1, 49, x1 + 1, 53, 'coal', lo=lo, hi=hi + 1, radius=2)
        c.put_ramp(x0 + 1, 50, 'metal', 3)
        c.put_ramp(x0 + 2, 50, 'metal', 4)
    # Rumpf: breiter Smoking
    round_rect(c, 7, 17 + bob, 36, 44 + bob, 'coal', lo=1, hi=4, radius=5, ambient=0.2)
    # Schultern
    ellipse(c, 9, 22 + bob, 6.8, 6.4, 'coal', lo=1, hi=4)
    ellipse(c, 35, 22 + bob, 6.8, 6.4, 'coal', lo=1, hi=4)
    # Hemd (V) + Revers
    poly(c, [(15, 18 + bob), (29, 18 + bob), (24, 38 + bob), (20, 38 + bob)], 'bone', lo=3, hi=5)
    for k in range(5):
        c.put_ramp(21, 25 + k * 3 + bob, 'gold', 4)
    for y in range(18, 38):
        t = (y - 18) / 20.0
        c.put_ramp(int(15 + t * 5.4), y + bob, 'coal', 4)
        c.put_ramp(int(29 - t * 5.4), y + bob, 'coal', 2)
    # Kummerbund + Fliege
    c.rect(8, 36 + bob, 35, 39 + bob, 'teamA', 3)
    c.rect(8, 36 + bob, 35, 36 + bob, 'teamA', 4)
    c.rect(8, 39 + bob, 35, 39 + bob, 'teamA', 1)
    for x in range(10, 35, 3):
        c.put_ramp(x, 37 + bob, 'teamA', 2)
        c.put_ramp(x, 38 + bob, 'teamA', 2)
    c.rect(21, 36 + bob, 22, 39 + bob, 'gold', 4)
    poly(c, [(18, 19 + bob), (22, 21 + bob), (18, 24 + bob)], 'teamA', lo=2, hi=4)
    poly(c, [(26, 19 + bob), (22, 21 + bob), (26, 24 + bob)], 'teamA', lo=1, hi=3)
    c.rect(21, 20 + bob, 23, 22 + bob, 'teamA', 4)
    # Einstecktuch + Nelke
    poly(c, [(11, 25 + bob), (15, 25 + bob), (15, 28 + bob)], 'bone', lo=3, hi=5)
    c.put_ramp(31, 26 + bob, 'fire', 4)
    c.put_ramp(32, 26 + bob, 'fire', 3)
    c.put_ramp(31, 27 + bob, 'leaf', 3)
    # linker Arm (haengt) mit Faust
    thick_line(c, 7, 24 + bob, 4, 38 + bob, 6.2, 'coal', lo=1, hi=4)
    c.rect(2, 37 + bob, 6, 38 + bob, 'bone', 4)
    ellipse(c, 4, 42 + bob, 4.6, 4.6, skin, lo=1, hi=4)
    for k in range(3):
        c.put_ramp(3 + k, 43 + bob, skin, 1)
    # rechter Arm: Unterarm hoch, haelt Klemmbrett
    thick_line(c, 36, 24 + bob, 41, 33 + bob, 6.4, 'coal', lo=1, hi=4)
    thick_line(c, 41, 33 + bob, 43, 25 + bob, 5.6, 'coal', lo=2, hi=4)
    c.rect(40, 25 + bob, 46, 26 + bob, 'bone', 4)
    # Klemmbrett
    round_rect(c, 40, 9 + bob, 51, 25 + bob, 'wood', lo=1, hi=4, radius=1)
    c.rect(42, 12 + bob, 49, 23 + bob, 'bone', 4)
    c.rect(42, 12 + bob, 42, 23 + bob, 'bone', 5)
    c.rect(42, 23 + bob, 49, 23 + bob, 'bone', 3)
    c.rect(44, 8 + bob, 47, 10 + bob, 'metal', 4)
    c.rect(45, 8 + bob, 46, 8 + bob, 'metal', 5)
    for (x, y, w) in ((43, 14, 4), (43, 17, 5), (43, 20, 3)):
        c.rect(x, y + bob, x + w, y + bob, 'coal', 2)
    c.put_ramp(48, 14 + bob, 'leaf', 3)
    c.put_ramp(48, 17 + bob, 'leaf', 3)
    ellipse(c, 42.5, 26.5 + bob, 4.4, 3.4, skin, lo=1, hi=4)      # Hand vor dem Brett
    # Kopf: breite Schaedelkuppel, schwerer Unterkiefer, Hauer
    ellipse(c, 21, 9, 10.2, 8.0, skin, lo=1, hi=4, ambient=0.3)
    ellipse(c, 21.5, 15, 10.4, 5.4, skin, lo=1, hi=3, ambient=0.35)
    for (ex, lo, hi) in ((10, 1, 3), (32, 2, 5)):
        ellipse(c, ex, 10 + bob, 2.4, 3.4, skin, lo=lo, hi=hi)
    c.put_ramp(10, 10 + bob, skin, 1)
    c.put_ramp(32, 10 + bob, skin, 1)
    # Sonnenbrille: dunkler Balken mit Glanz
    c.rect(12, 7 + bob, 31, 11 + bob, 'coal', 0)
    c.rect(13, 8 + bob, 20, 11 + bob, 'coal', 1)
    c.rect(23, 8 + bob, 30, 11 + bob, 'coal', 1)
    c.rect(21, 7 + bob, 22, 8 + bob, 'coal', 0)
    for (gx, gy) in ((14, 8), (24, 8)):
        c.put_ramp(gx, gy + bob, 'metal', 4)
        c.put_ramp(gx + 1, gy + bob, 'metal', 3)
        c.put_ramp(gx, gy + 1 + bob, 'metal', 3)
    # Nase: dicke Knolle, Nasenloecher
    ellipse(c, 22, 13.5 + bob, 3.2, 2.5, skin, lo=2, hi=4)
    c.put_ramp(21, 14 + bob, skin, 0)
    c.put_ramp(24, 14 + bob, skin, 0)
    # Mund: Strich, Unterbiss mit Hauern
    for x in range(14, 30):
        c.put_ramp(x, 17 + bob, skin, 0)
    poly(c, [(14, 17 + bob), (18, 17 + bob), (17, 12 + bob)], 'bone', lo=3, hi=5)
    poly(c, [(25, 17 + bob), (29, 17 + bob), (27, 12 + bob)], 'bone', lo=3, hi=5)
    c.put_ramp(14, 17 + bob, 'bone', 2)
    c.put_ramp(28, 17 + bob, 'bone', 2)
    # Hals + Kragen
    c.rect(15, 19 + bob, 27, 19 + bob, 'bone', 4)
    # Ohrhoerer-Kabel
    for k in range(7):
        c.put_ramp(33, 13 + k + bob, 'metal', 4 if k % 2 else 3)
    c.outline()
    return c


# =========================================================================== UV-06 Ton-Golem


def _crack(c, pts, glow=True, dark=0):
    """Riss als Linienzug: dunkle Fuge, glimmendes Brennofen-Feuer daneben"""
    path = []
    for (a, b) in zip(pts[:-1], pts[1:]):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for i in range(n + 1):
            path.append((int(round(a[0] + (b[0] - a[0]) * i / n)), int(round(a[1] + (b[1] - a[1]) * i / n))))
    for k, (x, y) in enumerate(path):
        if c.alpha(x, y):
            c.put_ramp(x, y, 'coal', dark)
    if glow:
        for k, (x, y) in enumerate(path):
            if k % 2 == 0 and c.alpha(x + 1, y) and c.rid[y, x + 1] != RAMP_ID['coal']:
                c.put_ramp(x + 1, y, 'fire', 4 if k % 4 else 5)


def spr_clay_golem(anim='idle', f=0, clay='wood'):
    """Toepfer-Golem: Amphoren-Bauch mit Maeanderband, Topfkopf mit Deckel und Henkeln, Risse mit Brennofenglut"""
    c = Canvas(56, 60)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Fuesse
    for (x0, x1, l_, h_) in ((11, 24, 1, 4), (31, 44, 2, 5)):
        round_rect(c, x0, 51, x1, 59, clay, lo=l_ + 1, hi=h_, radius=2)
        for x in range(x0 + 1, x1):
            c.put_ramp(x, 59, clay, 0)
        c.rect(x0 + 1, 58, x1 - 1, 58, clay, 1)
    # linker Arm (hinten, haengend) mit klobiger Faust
    thick_line(c, 11, 31 + bob, 7, 46, 9.0, clay, lo=1, hi=4)
    round_rect(c, 2, 44, 12, 54, clay, lo=1, hi=4, radius=3)
    for x in (4, 7, 10):
        c.put_ramp(x, 54, clay, 0)
        c.put_ramp(x, 53, clay, 1)
    # Bauch / Koerper: Amphore
    ellipse(c, 28, 40 + bob, 19.0, 16.0, clay, lo=1, hi=5, ambient=0.16)
    ellipse(c, 28, 29 + bob, 13, 7, clay, lo=2, hi=5, ambient=0.3)
    # Maeanderband (Toepferei-Muster) quer ueber den Bauch
    key = ["#####.", "#...#.", "#.###."]
    for x in range(10, 47):
        dx = (x + 0.5 - 28) / 19.0
        if abs(dx) >= 0.98:
            continue
        yb = int(40 + bob + 3.4 * dx * dx)
        for k in range(5):
            y = yb - 2 + k
            if not c.alpha(x, y):
                continue
            if k == 0:
                c.put_ramp(x, y, clay, 5)
            elif k == 4:
                c.put_ramp(x, y, clay, 0)
            else:
                lit = key[k - 1][(x - 10) % 6] == '#'
                c.put_ramp(x, y, clay, 5 if lit else 0)
    # Glasurguertel (blau) unter dem Band mit Tropfen
    for x in range(10, 47):
        dx = (x + 0.5 - 28) / 19.0
        if abs(dx) >= 0.98:
            continue
        yb = int(46 + bob + 3.6 * dx * dx)
        for k in range(3):
            y = yb + k
            if c.alpha(x, y):
                c.put_ramp(x, y, 'ice', (4 if k == 0 else (3 if (x + k) % 2 == 0 else 2)))
    for (x, ln) in ((14, 4), (23, 3), (33, 5), (41, 3)):
        dx = (x + 0.5 - 28) / 19.0
        y0 = int(46 + bob + 3.6 * dx * dx) + 3
        for k in range(ln):
            if c.alpha(x, y0 + k):
                c.put_ramp(x, y0 + k, 'ice', 2 if k < ln - 1 else 4)
    # rechter Arm (vorn)
    thick_line(c, 41, 32 + bob, 48, 42 + bob, 9.4, clay, lo=2, hi=5)
    round_rect(c, 43, 43 + bob, 54, 54 + bob, clay, lo=2, hi=5, radius=3)
    for k in range(3):
        c.put_ramp(45 + k * 3, 53 + bob, clay, 1)
        c.put_ramp(45 + k * 3, 52 + bob, clay, 2)
    # Naehte zwischen Armen und Rumpf
    for k in range(13):
        c.put_ramp(14 - k // 6, 33 + k + bob, clay, 1)
    for k in range(13):
        c.put_ramp(41 + k // 5, 34 + k + bob, clay, 1)
    # Glanzlichter im Ton
    for (x, y) in ((15, 33), (16, 33), (15, 34), (22, 27), (23, 27), (34, 36)):
        if c.alpha(x, y + bob):
            c.put_ramp(x, y + bob, clay, 5)
    # Topfkopf mit Henkeln (senkrechte D-Schlaufen vom Rand zur Schulter)
    for (hx, lo_, hi_) in ((13, 1, 4), (43, 2, 5)):
        _loop(c, hx, 16 + bob, 4.2, 9.4, 2.3, clay, lo_, hi_)
    ellipse(c, 28, 17 + bob, 10.2, 9.6, clay, lo=2, hi=5, ambient=0.2)
    # Deckel mit Knauf
    ellipse(c, 28, 8 + bob, 11.4, 3.6, clay, lo=1, hi=5, ambient=0.28)
    ellipse(c, 28, 4.4 + bob, 3.4, 3.0, clay, lo=2, hi=5, ambient=0.25)
    c.put_ramp(27, 3 + bob, clay, 5)
    for x in range(18, 39):
        if c.alpha(x, 10 + bob) and c.rid[10 + bob, x] == RAMP_ID[clay]:
            c.put_ramp(x, 10 + bob, clay, 1)
    # Gesicht: zwei Glutschlitze, gezackter Mund
    for ex in (22, 30):
        c.rect(ex, 15 + bob, ex + 3, 17 + bob, 'coal', 0)
        c.rect(ex + 1, 16 + bob, ex + 2, 16 + bob, 'fire', 5)
        c.put_ramp(ex + 1, 15 + bob, 'fire', 3)
    for k in range(9):
        c.put_ramp(23 + k, 22 + bob + (1 if k % 2 else 0), 'coal', 0)
    # Risse mit Glut
    _crack(c, [(20, 33 + bob), (22, 37 + bob), (19, 42 + bob), (22, 49 + bob)], dark=0)
    _crack(c, [(35, 29 + bob), (33, 34 + bob), (36, 39 + bob), (32, 46 + bob), (34, 52 + bob)], dark=0)
    _crack(c, [(33, 11 + bob), (34, 15 + bob), (33, 19 + bob)])
    _crack(c, [(49, 39 + bob), (51, 44 + bob)], glow=False)
    rnd = random.Random(5)
    for _ in range(26):
        x, y = rnd.randint(8, 48), rnd.randint(24, 54)
        if c.alpha(x, y) and c.rid[y, x] == RAMP_ID[clay]:
            c.put_ramp(x, y, clay, 1 if rnd.random() < 0.6 else 4)
    c.outline()
    return c


def _loop(c, cx, cy, rx_out, ry_out, thick, ramp, lo, hi):
    """senkrechter Henkel: elliptischer Ring"""
    rid = RAMP_ID[ramp]
    for y in range(int(cy - ry_out - 1), int(cy + ry_out + 2)):
        for x in range(int(cx - rx_out - 1), int(cx + rx_out + 2)):
            dx, dy = (x + 0.5 - cx) / rx_out, (y + 0.5 - cy) / ry_out
            d = dx * dx + dy * dy
            din = ((x + 0.5 - cx) / (rx_out - thick)) ** 2 + ((y + 0.5 - cy) / (ry_out - thick)) ** 2
            if d > 1.0 or din < 1.0:
                continue
            L = 0.5 - 0.4 * dx - 0.2 * dy
            c.put(x, y, RAMPS[ramp][quant(max(0.0, min(1.0, L)), lo, hi, x, y)], rid)
