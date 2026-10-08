"""pack_art3, Teil B: Sprites US-16 .. US-19 (Wirrwarr-Lehrling, Spaghetti-Wuerger, Blutsauger-Schwarm, Drachenreiter-Zwerg)."""
from __future__ import annotations

from pack_art3_lib import *


# =========================================================================== US-16 Wirrwarr-Lehrling (46 x 42)


def spr_muddle_apprentice(anim='idle', f=0):
    c = Canvas(46, 42)
    bob = [0, -1][f % 2]
    sw = [0, 1, 2, 1][f % 4]
    # Robe: viel zu lang, schleift hinten ueber den Boden (Hem mit Zickzack)
    hem = [(32, 38), (29, 40), (25, 39), (21, 41), (17, 40), (13, 41), (9, 40), (5, 41), (1, 39 + sw // 2)]
    poly(c, [(14, 23 + bob), (27, 23 + bob)] + hem + [(8, 30)], 'ice', lo=1, hi=4)
    for (x0, y0, x1, y1) in ((19, 31, 17, 40), (23, 30, 23, 39), (27, 30, 29, 38), (15, 29, 10, 38)):
        c.line(x0, y0, x1, y1, 'ice', 1)
    for y in range(30, 38):
        c.put_ramp(15 + (y - 30) // 3, y, 'ice', 4)
    # Saum in teamA
    for x in range(2, 32):
        yb = max([y for y in range(0, 42) if c.alpha(x, y)] or [-1])
        if yb > 30 and x % 4 != 3:
            c.put_ramp(x, yb - 1, 'teamA', 3)
            c.put_ramp(x, yb - 2, 'teamA', 4 if x < 18 else 2)
    # Guertel
    for x in range(13, 28):
        c.put_ramp(x, 29, 'gold', 4 if x % 3 else 5)
        c.put_ramp(x, 30, 'gold', 2)
    c.rect(19, 29, 20, 31, 'gold', 5)
    # Stiefelspitze guckt vorn heraus (stolpert)
    ellipse(c, 32.5, 38.4, 3.6, 1.9, 'wood', lo=1, hi=4)
    # Aermel hinten: zu lang, schlenkert
    thick_line(c, 14, 25 + bob, 7, 31 + bob - sw, 5, 'ice', lo=1, hi=3)
    ellipse(c, 6, 32 + bob - sw, 3.2, 3.2, 'ice', lo=1, hi=4)
    c.rect(3, 32 + bob - sw, 8, 33 + bob - sw, 'teamA', 3)
    # Kopf unter der Krempe: nur Nase und ein Auge
    ellipse(c, 20.5, 20 + bob, 4.4, 3.7, 'skin', lo=2, hi=5)
    ellipse(c, 25.4, 21 + bob, 1.9, 1.6, 'skin', lo=3, hi=5)
    c.put_ramp(25, 21 + bob, 'fire', 3)
    c.put_ramp(23, 19 + bob, 'coal', 1)
    c.put_ramp(23, 20 + bob, 'coal', 1)
    # Riesenhut: breite Krempe, Kegel, abgeknickte Spitze
    ellipse(c, 20, 16.5 + bob, 12, 3.4, 'ice', lo=1, hi=4)
    poly(c, [(12, 16 + bob), (28, 16 + bob), (24.5, 8 + bob), (19.5, 4 + bob)], 'ice', lo=1, hi=4)
    cone(c, (21, 6 + bob), (35, 13 + bob), 7.4, 'ice', 1, 4)
    for x in range(11, 30):
        for y in (14 + bob, 15 + bob):
            if c.alpha(x, y):
                c.put_ramp(x, y, 'gold', 4 if y == 14 + bob else 2)
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
        c.put_ramp(17 + dx, 10 + dy + bob, 'gold', i)
    c.put_ramp(27, 8 + bob, 'gold', 4)
    # Arm vorn: Riesenaermel, Zauberstab raucht
    thick_line(c, 25, 25 + bob, 32, 22 + bob, 5, 'ice', lo=2, hi=5)
    ellipse(c, 33.5, 21.5 + bob, 3.4, 3.6, 'ice', lo=2, hi=5)
    c.rect(31, 20 + bob, 36, 21 + bob, 'teamA', 3)
    c.rect(36, 20 + bob, 37, 21 + bob, 'skin', 4)
    thick_line(c, 36, 21 + bob, 44, 12 + bob, 1.7, 'wood', lo=2, hi=4)
    c.outline()
    # Funke und Rauch (ohne Umriss) am Stabende
    rnd = random.Random(5 + f)
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
        c.put_ramp(44 + dx, 11 + dy + bob, 'fire' if (dx or dy) else 'gold', 4 if (dx or dy) else 5)
    for k, (x, y, r) in enumerate(((43, 6, 2.0), (40, 3, 2.4), (44, 1, 1.6))):
        ellipse(c, x, y - (f % 2) * (k % 2), r, r * 0.8, 'bone', lo=2, hi=5, ambient=0.3)
    return c


# =========================================================================== US-17 Spaghetti-Wuerger (58 x 44)


def _noodle_arm(c, pts, w0=4.2, w1=2.2):
    strand_taper(c, pts, w0, w1, 'gold', lo=2, hi=5, ambient=0.25)
    # Strang-Struktur: dunkle Linie entlang des Arms
    for k in range(0, len(pts) - 1, 2):
        c.put_ramp(int(pts[k][0]) + 1, int(pts[k][1]) + 1, 'gold', 2)
    ex, ey = pts[-1]
    c.put_ramp(int(ex), int(ey), 'gold', 5)


def spr_spaghetti_strangler(anim='idle', f=0):
    c = Canvas(60, 46)
    ph = f % 3
    # Tentakel (hinter dem Knaeuel), mit Ringelspitzen
    arms = [
        bezier((38, 24), (47, 8 + ph), (55, 22), (57, 10 + ph * 2), 14),
        bezier((40, 31), (50, 28 - ph), (57, 34), (58, 26 + ph), 14),
        bezier((33, 20), (35, 4), (47, 0 + ph), (52, 8), 14),
    ]
    for pts in arms:
        _noodle_arm(c, pts)
    # Knaeuel
    ellipse(c, 23, 31, 21.5, 12.5, 'gold', lo=2, hi=4, ambient=0.2)
    rnd = random.Random(11)
    for k in range(40):
        cx, cy = rnd.randint(4, 40), rnd.randint(21, 41)
        r = rnd.randint(4, 10)
        a0 = rnd.randint(0, 300)
        a1 = a0 + rnd.randint(80, 160)
        rim_arc(c, cx, cy, r, r * 0.7, 'gold', 1 if k % 3 == 0 else 2, a0, a1)
        rim_arc(c, cx - 1, cy - 1, r, r * 0.7, 'gold', 5, a0 + 4, a1 - 6)
    # Tomatensauce oben + Tropfen + Parmesan
    ellipse(c, 21, 21.5, 11.5, 4.6, 'fire', lo=2, hi=5, ambient=0.2)
    for (x, ln) in ((12, 4), (16, 6), (27, 4), (31, 5), (21, 3)):
        for k in range(ln):
            c.put_ramp(x, 24 + k, 'fire', 3 if k < ln - 1 else 4)
    for (x, y) in ((15, 20), (19, 19), (24, 21), (28, 22), (22, 24)):
        c.put_ramp(x, y, 'bone', 5)
        c.put_ramp(x + 1, y, 'bone', 4)
    # Fleischbaellchen-Augen (braune Kugeln mit weissem Auge)
    for (ex, ey) in ((29, 27), (40, 27)):
        ellipse(c, ex, ey, 5.2, 5.0, 'wood', lo=1, hi=4, ambient=0.2)
        for (dx, dy) in ((-3, -2), (2, -3), (-2, 3), (3, 2)):
            c.put_ramp(ex + dx, ey + dy, 'dirt', 4)
        ellipse(c, ex + 1.5, ey, 2.8, 2.9, 'bone', lo=3, hi=5, ambient=0.4)
        c.rect(ex + 2, ey, ex + 3, ey + 1, 'coal', 1)
    # Maul mit Gabel als Zahn
    ellipse(c, 35, 37.5, 9.0, 3.6, 'coal', lo=0, hi=2, ambient=0.4)
    for x in range(28, 42):
        c.put_ramp(x, 34, 'gold', 2)
    for tx in (31, 33, 35, 37):
        for y in range(32, 39):
            c.put_ramp(tx, y, 'metal', 5 if tx == 31 else 4 if tx < 36 else 3)
        c.put_ramp(tx, 31, 'metal', 5)
    for x in range(31, 38):
        c.put_ramp(x, 38, 'metal', 3 if x % 2 else 2)
    c.rect(33, 39, 35, 42, 'metal', 3)
    c.rect(33, 39, 33, 42, 'metal', 5)
    # Nudelsaum unten
    for x in range(4, 44, 2):
        c.put_ramp(x, 42, 'gold', 1)
        c.put_ramp(x + 1, 43, 'gold', 2)
    for (x, y0) in ((6, 40), (15, 41), (42, 39), (26, 42)):
        strand(c, bezier((x, y0), (x - 3, y0 + 2), (x + 3, y0 + 3), (x, y0 + 4), 5), 2, 'gold', lo=2, hi=4)
    c.outline()
    return c


# =========================================================================== US-18 Blutsauger-Schwarm (60 x 42)


def _bat(c, cx, cy, s, ph, mono=False):
    ty = {0: -8.0, 1: -2.0, 2: 6.0}[ph]
    tx = 12.5
    for side in (-1, 1):
        def P(x, y):
            return (cx + side * x * s, cy + y * s)
        wing = [P(2, -1.5), P(tx * 0.5, ty * 0.95 - 3.0), P(tx, ty), P(tx * 0.82, ty + 4.5), P(tx * 0.6, ty + 3.0),
                P(tx * 0.4, ty + 6.5), P(2, 4)]
        poly(c, wing, 'purple', lo=1, hi=4)
        for q in (wing[2], wing[3], wing[5]):
            a = P(2, -1)
            c.line(int(a[0]), int(a[1]), int(q[0]), int(q[1]), 'purple', 1)
    # Koerper
    ellipse(c, cx, cy + 1.8 * s, 2.6 * s, 3.6 * s, 'coal', lo=1, hi=4, ambient=0.2)
    ellipse(c, cx, cy - 2.6 * s, 3.0 * s, 2.8 * s, 'coal', lo=2, hi=5, ambient=0.2)
    for side in (-1, 1):
        ex = cx + side * 2.6 * s
        poly(c, [(ex - 1.2 * s, cy - 4 * s), (ex + 1.2 * s, cy - 4 * s), (ex + side * 0.6 * s, cy - 7.4 * s)], 'coal', lo=1, hi=4)
        c.put_ramp(int(cx + side * 1.4 * s - (1 if side < 0 else 0)), int(cy - 2.8 * s), 'fire', 4)
        c.put_ramp(int(cx + side * 1.0 * s - (1 if side < 0 else 0)), int(cy - 0.2 * s), 'bone', 5)
    if mono:
        mx, my = int(cx + 1.4 * s), int(cy - 2.8 * s)
        for (dx, dy) in ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)):
            c.put_ramp(mx + dx, my + dy, 'gold', 4 if dy < 1 else 3)
        for (dx, dy) in ((2, 2), (2, 3), (3, 4), (3, 5)):
            c.put_ramp(mx + dx, my + dy, 'gold', 3)


def spr_bloodsucker_swarm(anim='idle', f=0):
    c = Canvas(68, 48)
    p = f % 3
    # kleine Fledermaeuse hinten, grosse mit Monokel vorn
    _bat(c, 11, 12, 0.66, (p + 1) % 3)
    _bat(c, 56, 9, 0.8, (p + 2) % 3, mono=True)
    _bat(c, 10, 37, 0.9, (p + 2) % 3)
    _bat(c, 58, 36, 0.7, p)
    _bat(c, 34, 24, 1.28, p, mono=True)
    c.outline()
    return c


# =========================================================================== US-19 Drachenreiter-Zwerg (64 x 48)


def spr_dragon_rider_dwarf(anim='idle', f=0):
    c = Canvas(64, 48)
    fl = [0, 1, 2, 1][f % 4]
    # Fluegel (hinter Drache und Reiter)
    W = (19, 12 + 4 * fl)
    tipA, tipB, tipC = (6, 6 + 5 * fl), (4, 17 + 3 * fl), (9, 26 + 2 * fl)
    wing = [(27, 29), W, tipA, (10, 15 + 4 * fl), tipB, (9, 21 + 3 * fl), tipC, (19, 32)]
    poly(c, wing, 'purple', lo=1, hi=4)
    for q in (tipA, tipB, tipC):
        c.line(W[0], W[1], q[0], q[1], 'goblin', 1)
    thick_line(c, 26, 29, W[0], W[1], 2.4, 'goblin', lo=1, hi=4)
    # Schwanz mit Spaten-Spitze
    tail = bezier((18, 34), (9, 40), (3, 33), (7, 26), 10)
    strand(c, tail, 4.2, 'goblin', lo=1, hi=4)
    poly(c, [(3, 23), (10, 23), (7.5, 29.5)], 'goblin', lo=2, hi=5)
    # Hinterbein + Vorderbein (angezogen)
    thick_line(c, 22, 39, 19, 44, 3.4, 'goblin', lo=1, hi=3)
    for (x, y) in ((16, 45), (18, 46), (20, 46)):
        c.put_ramp(x, y, 'bone', 4)
    # Koerper
    ellipse(c, 27, 34, 11.5, 6.6, 'goblin', lo=1, hi=5, ambient=0.15)
    ellipse(c, 29, 37.5, 9.5, 3.4, 'gold', lo=2, hi=5, clip=lambda x, y: y >= 36)
    for x in range(21, 37, 3):
        c.line(x, 36, x + 1, 40, 'gold', 2)
    thick_line(c, 31, 40, 35, 45, 3.4, 'goblin', lo=2, hi=5)
    for (x, y) in ((33, 46), (35, 47), (37, 47)):
        c.put_ramp(x, y, 'bone', 5)
    # Hals + Kopf
    strand(c, bezier((35, 32), (41, 30), (43, 26), (45, 23), 8), 6.4, 'goblin', lo=2, hi=5)
    ellipse(c, 48, 23, 6.2, 4.8, 'goblin', lo=2, hi=5)
    ellipse(c, 54, 25, 4.2, 3.2, 'goblin', lo=2, hi=5)
    ellipse(c, 52.5, 27.6, 3.6, 1.8, 'goblin', lo=1, hi=3)
    c.rect(52, 25, 57, 26, 'coal', 1)
    c.put_ramp(56, 23, 'coal', 1)
    c.rect(48, 20, 49, 21, 'gold', 5)
    c.put_ramp(49, 21, 'coal', 1)
    cone(c, (46, 20), (37, 17), 3.4, 'bone', 2, 5)
    cone(c, (49, 18), (42, 13), 2.8, 'bone', 3, 5)
    for k in range(4):
        c.put_ramp(37 + k * 2, 28 + (k < 2) * 0 - 0, 'gold', 4)
    # kleines Flaemmchen am Maul
    for (dx, dy, i) in ((0, 0, 5), (1, 0, 4), (2, -1, 4), (2, 1, 3), (3, 0, 4)):
        c.put_ramp(58 + dx, 26 + dy, 'fire', i)
    # Sattel + Satteldecke (teamA)
    ellipse(c, 27, 29.5, 9.2, 3.0, 'teamA', lo=2, hi=4)
    ellipse(c, 27, 28, 6.4, 2.2, 'wood', lo=1, hi=4)
    # Zwerg: Beine, Rumpf, Bart, Helm
    thick_line(c, 25, 27, 32, 30, 3.6, 'wood', lo=1, hi=4)
    ellipse(c, 33.5, 31, 2.8, 2.0, 'dirt', lo=1, hi=4)
    round_rect(c, 22, 16, 30, 27, 'metal', lo=1, hi=4, radius=2)
    for y in range(17, 27):
        c.put_ramp(26, y, 'teamA', 3)
        c.put_ramp(27, y, 'teamA', 2)
    for x in range(22, 31):
        c.put_ramp(x, 25, 'gold', 4 if x % 2 else 3)
    # Bart (rot) weht nach hinten
    strand(c, bezier((25, 19), (19, 19), (14, 23), (9, 20), 8), 5.0, 'fire', lo=2, hi=4)
    ellipse(c, 25.5, 19.5, 4.8, 4.6, 'fire', lo=2, hi=5)
    # Kopf + Helm
    ellipse(c, 27.5, 13.5, 4.6, 4.2, 'skin', lo=2, hi=5)
    ellipse(c, 31.3, 14.6, 1.9, 1.6, 'skin', lo=3, hi=5)
    c.put_ramp(31, 14, 'fire', 3)
    c.put_ramp(29, 13, 'coal', 1)
    c.put_ramp(29, 12, 'coal', 1)
    ellipse(c, 27, 11.5, 6.2, 5.2, 'metal', lo=1, hi=5, clip=lambda x, y: y <= 12)
    for x in range(21, 34):
        c.put_ramp(x, 12, 'gold', 4 if x % 2 else 3)
    cone(c, (22, 10), (16, 7), 3.0, 'bone', 3, 5)
    cone(c, (32, 10), (37, 7), 3.0, 'bone', 3, 5)
    # Arm vorn haelt die Zuegel
    thick_line(c, 29, 20, 35, 24, 3.0, 'metal', lo=2, hi=5)
    c.rect(35, 23, 36, 24, 'skin', 4)
    strand(c, bezier((36, 24), (41, 30), (46, 29), (52, 27), 10), 1.4, 'wood', lo=1, hi=3)
    c.outline()
    return c
