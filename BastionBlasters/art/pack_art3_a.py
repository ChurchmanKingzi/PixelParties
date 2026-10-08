"""pack_art3, Teil A: Sprites US-11 .. US-15 (Schneemann-Krieger, Gummi-Golem, Sporenlaeufer, Tick-Tack-Trooper, Wanderkiste)."""
from __future__ import annotations

from pack_art3_lib import *


# =========================================================================== US-11 Schneemann-Krieger (42 x 36)


def spr_snowman_warrior(anim='idle', f=0):
    c = Canvas(42, 36)
    bob = [0, -1][f % 2]
    flap = [0, 1, 2, 1][f % 4]
    # Arm hinten (Zweig) mit Astgabel
    thick_line(c, 9, 19 + bob, 3, 13 + bob, 1.8, 'wood', lo=0, hi=3)
    for (x, y) in ((1, 10), (2, 11), (4, 10), (5, 11), (2, 13), (1, 14)):
        c.put_ramp(x, y + bob, 'wood', 2)
    # Schneekugeln, nach vorn gekippt (der Angriff laeuft)
    ellipse(c, 12.5, 28.6, 9.4, 7.3, 'fur', lo=2, hi=5, ambient=0.2)
    ellipse(c, 15, 19.4 + bob, 6.8, 6.2, 'fur', lo=2, hi=5, ambient=0.2)
    rim_arc(c, 15, 19.4 + bob, 6.8, 6.2, 'fur', 1, 15, 165)
    rim_arc(c, 15, 19.8 + bob, 6.8, 6.2, 'fur', 2, 25, 155)
    for (x, y) in ((16, 17), (17, 21)):
        c.rect(x, y + bob, x + 1, y + 1 + bob, 'coal', 2)
    for (x, y) in ((8, 27), (10, 32), (16, 32), (18, 28), (12, 16), (11, 21)):
        yy = y + (bob if y < 24 else 0)
        c.put_ramp(x, yy, 'fur', 5)
        c.put_ramp(x + 1, yy, 'fur', 4)
    # Schal (teamA) mit flatterndem Ende
    for x in range(12, 23):
        c.put_ramp(x, 15 + bob, 'teamA', 4 if x < 17 else 3)
        c.put_ramp(x, 16 + bob, 'teamA', 3 if x < 19 else 2)
    for (x, y) in [(11, 16), (9, 16 - (flap > 0)), (7, 15 - flap // 2), (5, 15 - flap), (3, 14 - flap)]:
        c.put_ramp(x, y + bob, 'teamA', 3)
        c.put_ramp(x, y + 1 + bob, 'teamA', 2)
    c.put_ramp(2, 13 - flap + bob, 'teamA', 4)
    # Kopf
    ellipse(c, 17.5, 10.6 + bob, 5.4, 5.0, 'fur', lo=2, hi=5, ambient=0.2)
    rim_arc(c, 17.5, 10.6 + bob, 5.4, 5.0, 'fur', 1, 20, 160)
    for ex in (16, 20):
        c.rect(ex, 11 + bob, ex + 1, 12 + bob, 'coal', 1)
    for (x, y) in ((16, 14), (17, 15), (18, 15), (19, 15), (20, 14)):
        c.put_ramp(x, y + bob, 'coal', 2)
    # Eimerhelm (Boden oben, Rand unten)
    poly(c, [(15, 1), (20.5, 1), (24, 9), (11, 9)], 'metal', lo=1, hi=4)
    for x in range(11, 25):
        c.put_ramp(x, 8 + bob, 'metal', 4 if x < 18 else 3)
        c.put_ramp(x, 9 + bob, 'metal', 2 if x < 18 else 1)
    for x in range(15, 21):
        c.put_ramp(x, 1 + bob, 'metal', 5 if x < 18 else 4)
    for (x, y, i) in ((15, 3, 5), (15, 4, 4), (14, 5, 4), (20, 4, 1), (21, 5, 1), (12, 3, 3), (11, 4, 3), (11, 5, 3), (12, 6, 3)):
        c.put_ramp(x, y + bob, 'metal', i)
    # Karottenlanze: Spitze nach vorn-oben, Blattschopf hinten
    A, B = (5.0, 30.0), (41.0, 18.0)
    cone(c, A, B, 5.4, 'fire', 2, 5)
    for k in range(5):
        t = 0.12 + 0.17 * k
        x = int(A[0] + (B[0] - A[0]) * t)
        y = int(A[1] + (B[1] - A[1]) * t)
        c.put_ramp(x, y, 'fire', 2)
        c.put_ramp(x, y + 1, 'fire', 2)
    for (x0, y0, x1, y1) in ((4, 29, 0, 27), (4, 30, 0, 31), (4, 31, 1, 34)):
        c.line(x0, y0, x1, y1, 'leaf', 3)
        c.line(x0, y0 + 1, x1, y1 + 1, 'leaf', 2)
    c.put_ramp(0, 27, 'leaf', 5)
    c.put_ramp(0, 31, 'leaf', 5)
    # Arm vorn (Zweighand um die Lanze)
    thick_line(c, 19, 19 + bob, 25, 22 + bob, 2.2, 'wood', lo=1, hi=4)
    for (x, y) in ((24, 20), (26, 20), (24, 25), (26, 25)):
        c.put_ramp(x, y, 'wood', 3)
    c.outline()
    # Schneestaub hinter dem Rutsch
    for (x, y, i) in ((1, 35, 4), (3, 34, 5), (5, 35, 4), (0, 33, 3)):
        c.put_ramp(x, y, 'fur', i)
    return c


# =========================================================================== US-12 Gummi-Golem (44 x 44)


def _crease(c, cx, cy, rx, ry, ramp='cloth', a0=15, a1=165):
    """Gummi-Falte: dunkle Bogenlinie mit hellem Saum darunter"""
    rim_arc(c, cx, cy, rx, ry, ramp, 1, a0, a1)
    rim_arc(c, cx, cy + 1, rx, ry, ramp, 5, a0 + 12, a1 - 12)


def spr_rubber_golem(anim='idle', f=0):
    c = Canvas(44, 44)
    if anim == 'hop':
        pose = f % 3          # 0 Anlauf (gestaucht), 1 Luft (gestreckt), 2 Landung
    else:
        pose = 3 + (f % 2)    # idle: leichtes Wippen
    sq = {0: 3, 1: -3, 2: 4, 3: 0, 4: 1}[pose]          # >0 = flacher und breiter
    foot = 43
    # Beine (Stummel) + Fuesse
    if pose == 1:
        for (x, d, lo_) in ((14, -2, 1), (27, 2, 2)):
            thick_line(c, x, 33, x + d, 38, 5, 'cloth', lo=lo_, hi=lo_ + 3)
            ellipse(c, x + d - 1, 39.5, 5, 2.6, 'cloth', lo=lo_, hi=lo_ + 3)
    else:
        for (x, lo_) in ((13, 1), (26, 2)):
            thick_line(c, x, 36 - sq // 2, x + (1 if x > 20 else -1), foot - 4, 5.5, 'cloth', lo=lo_, hi=lo_ + 3)
            ellipse(c, x + (3 if x > 20 else -2), foot - 2, 6.2 + sq * 0.2, 3.0, 'cloth', lo=lo_, hi=lo_ + 3, ambient=0.25)
    # Arm hinten (haengt / schlenkert) mit Gummifalte
    if pose == 1:
        thick_line(c, 9, 22, 3, 14, 5.5, 'cloth', lo=1, hi=4)
        ellipse(c, 3, 12, 4.4, 4.2, 'cloth', lo=1, hi=4, ambient=0.2)
    else:
        thick_line(c, 9, 24, 4, 33 - sq, 5.5, 'cloth', lo=1, hi=4)
        ellipse(c, 4, 35 - sq, 4.6, 4.4, 'cloth', lo=1, hi=4, ambient=0.2)
    # Koerper: dicke Birne, Kopf verschmilzt mit dem Rumpf
    by = 25 + sq * 0.4
    brx, bry = 12.4 + sq * 0.9, 12 - sq * 0.9 + (2 if pose == 1 else 0)
    ellipse(c, 19, by, brx, bry, 'cloth', lo=2, hi=5, ambient=0.14)
    hy = by - 13 + sq * 0.8
    ellipse(c, 21, hy, 8.6 + sq * 0.4, 6.4, 'cloth', lo=2, hi=5, ambient=0.16)
    # Gummifalten (Reifen-Look) und Naht
    _crease(c, 19, by - 2, brx - 0.5, 3.0)
    _crease(c, 19, by + 4, brx - 1.5, 3.4)
    rim_arc(c, 21, hy + 1.5, 8.2 + sq * 0.4, 3.0, 'cloth', 1, 20, 160)
    # Glanzstreifen
    for (x, y, i) in ((11, int(by - 5), 5), (12, int(by - 6), 5), (13, int(by - 7), 5), (11, int(by - 4), 4), (12, int(by - 3), 4),
                      (15, int(hy - 3), 5), (16, int(hy - 4), 5), (14, int(hy - 2), 4)):
        if c.alpha(x, y):
            c.put_ramp(x, y, 'cloth', i)
    # Ventil auf dem Kopf (wie bei einem Aufblasspielzeug)
    vx, vy = 20, int(hy - 5.6)
    c.rect(vx - 1, vy - 2, vx + 2, vy, 'gold', 3)
    c.rect(vx - 1, vy - 2, vx - 1, vy, 'gold', 5)
    c.rect(vx, vy - 4, vx + 1, vy - 2, 'metal', 3)
    c.rect(vx - 1, vy - 5, vx + 2, vy - 4, 'metal', 4)
    c.put_ramp(vx - 1, vy - 5, 'metal', 5)
    # Arm vorn: wuchtige Faust, nach vorn geschwungen
    if pose == 1:
        thick_line(c, 29, 20, 37, 10, 5.8, 'cloth', lo=2, hi=5)
        ellipse(c, 38, 8.5, 5, 4.8, 'cloth', lo=2, hi=5, ambient=0.2)
        _crease(c, 34, 14, 3.4, 1.8, a0=-10, a1=190)
    else:
        thick_line(c, 29, 23 - sq // 2, 36, 19 + sq // 2, 5.8, 'cloth', lo=2, hi=5)
        ellipse(c, 38, 18 + sq // 2, 5, 4.8, 'cloth', lo=2, hi=5, ambient=0.2)
        c.put_ramp(36, 16 + sq // 2, 'cloth', 5)
    # Das eine Glibber-Auge
    ex, ey = 24, int(hy + 0.5)
    ellipse(c, ex, ey, 5.2, 4.8, 'bone', lo=3, hi=5, ambient=0.3)
    ellipse(c, ex + 1.4, ey + 0.4, 2.8, 2.8, 'slime', lo=1, hi=4, ambient=0.25)
    c.rect(ex + 2, ey, ex + 3, ey + 1, 'coal', 1)
    c.put_ramp(ex + 1, ey - 1, 'bone', 5)
    # Glibber-Traene
    for k in range(5):
        c.put_ramp(ex - 1, ey + 5 + k, 'slime', 4 if k < 3 else 3)
    c.put_ramp(ex - 2, ey + 8, 'slime', 3)
    c.put_ramp(ex - 1, ey + 10, 'slime', 5)
    c.outline()
    return c


# =========================================================================== US-13 Sporenlaeufer (38 x 34)


def spr_spore_runner(anim='idle', f=0):
    c = Canvas(38, 34)
    st = [4, 0, -4, 0][f % 4]
    bob = [0, -1, 0, -1][f % 4]
    # Beine: duenne Pilzstiele, Laufschritt
    thick_line(c, 16, 25 + bob, 16 - st - 4, 31, 2.4, 'bone', lo=0, hi=3)
    c.rect(16 - st - 8, 31, 16 - st - 4, 32, 'dirt', 2)
    c.rect(16 - st - 8, 32, 16 - st - 3, 32, 'dirt', 1)
    thick_line(c, 20, 25 + bob, 21 + st + 3, 30, 2.4, 'bone', lo=2, hi=5)
    c.rect(21 + st + 1, 30, 21 + st + 6, 31, 'dirt', 3)
    c.rect(21 + st + 1, 31, 21 + st + 6, 31, 'dirt', 1)
    # Arm hinten (pumpend)
    thick_line(c, 15, 20 + bob, 9, 23 + bob - st // 2, 1.8, 'bone', lo=0, hi=3)
    # Stiel-Koerper (bauchig) mit Manschette
    ellipse(c, 18, 22 + bob, 5.6, 5.2, 'bone', lo=2, hi=5, ambient=0.2)
    round_rect(c, 14, 16 + bob, 22, 22 + bob, 'bone', lo=2, hi=5, radius=2)
    for x in range(12, 25):
        c.put_ramp(x, 19 + bob, 'bone', 5 if x < 18 else 4)
        c.put_ramp(x, 20 + bob, 'bone', 2)
    thick_line(c, 21, 20 + bob, 27, 18 + bob + st // 3, 1.8, 'bone', lo=2, hi=5)
    # Gesicht: zwei Pixelaugen unter dem Hutrand, offener Mund
    c.rect(17, 17 + bob, 17, 18 + bob, 'coal', 1)
    c.rect(21, 17 + bob, 21, 18 + bob, 'coal', 1)
    c.put_ramp(19, 21 + bob, 'coal', 1)
    # Schirmkappe (violett mit gruenen Giftflecken), leicht nach vorn gekippt
    def cap_clip(x, y):
        return y <= 14 + bob
    ellipse(c, 19, 14 + bob, 16.5, 11.5, 'purple', lo=1, hi=4, ambient=0.16, clip=cap_clip)
    for (x, y, i) in ((9, 4, 4), (10, 4, 4), (8, 5, 4), (15, 2, 4), (16, 2, 4), (22, 2, 3)):
        c.put_ramp(x, y + bob, 'purple', i)
    for x in range(3, 36):
        if c.alpha(x, 14 + bob):
            c.put_ramp(x, 14 + bob, 'bone', 2 if x % 2 else 1)
    for x in range(5, 34, 2):
        c.put_ramp(x, 15 + bob, 'bone', 1)
    for (sx, sy, r) in ((9, 8, 2.8), (19, 4.5, 2.6), (27, 9, 2.4), (14, 11.5, 1.8), (23, 12, 1.6)):
        ellipse(c, sx, sy + bob, r, r * 0.8, 'slime', lo=2, hi=5, ambient=0.3)
    c.outline()
    # Sporen (ohne Umriss)
    rnd = random.Random(7 + f)
    for k in range(10):
        c.put_ramp(rnd.randint(0, 9), rnd.randint(8, 24), 'slime', rnd.choice((3, 4, 5)))
    for k in range(5):
        c.put_ramp(rnd.randint(8, 30), rnd.randint(16, 22), 'slime', rnd.choice((4, 5)))
    return c


# =========================================================================== US-14 Tick-Tack-Trooper (40 x 38)


def spr_tick_tock_trooper(anim='idle', f=0):
    c = Canvas(40, 38)
    st = [3, 0, -3, 0][f % 4]
    bob = [0, -1, 0, -1][f % 4]
    key = f % 3
    # Bein hinten: Stahlkolben mit Messingschuh
    thick_line(c, 15, 28 + bob, 12 - st, 35, 3.4, 'metal', lo=0, hi=3)
    c.rect(8 - st, 35, 14 - st, 36, 'gold', 2)
    c.rect(8 - st, 37, 14 - st, 37, 'gold', 1)
    c.rect(8 - st, 36, 14 - st, 36, 'gold', 1)
    # Aufzugsschluessel (hinten): Schaft + zwei Ringfluegel, dreht sich
    thick_line(c, 12, 22 + bob, 7, 22 + bob, 2.2, 'metal', lo=1, hi=4)
    sp = [3.0, 1.6, 3.0][key]
    for dy in (-1, 1):
        cy = 22 + bob + dy * (sp + 1.4)
        ellipse(c, 5.5, cy, 2.8, 2.6, 'gold', lo=1, hi=5, ambient=0.2)
        c.put_ramp(5, int(cy), 'gold', 0)
    # Rumpf: Messing, Zahnrad im Bauch, Guertel (teamA)
    round_rect(c, 12, 16 + bob, 26, 29 + bob, 'gold', lo=2, hi=5, radius=3)
    gear(c, 19, 22 + bob, 3.6, 'metal', lo=1, hi=5, teeth=8, phase=0.4 * f)
    for x in range(12, 27):
        c.put_ramp(x, 26 + bob, 'teamA', 3 if x % 5 else 5)
        c.put_ramp(x, 27 + bob, 'teamA', 2)
        c.put_ramp(x, 28 + bob, 'gold', 1)
    for y in range(17, 26):
        c.put_ramp(12, y + bob, 'gold', 5)
    # Bein vorn
    thick_line(c, 21, 28 + bob, 25 + st, 35, 3.4, 'metal', lo=2, hi=5)
    c.rect(22 + st, 35, 29 + st, 36, 'gold', 4)
    c.rect(22 + st, 37, 29 + st, 37, 'gold', 1)
    c.rect(22 + st, 36, 29 + st, 36, 'gold', 2)
    c.put_ramp(22 + st, 35, 'gold', 5)
    # Arm hinten
    thick_line(c, 13, 19 + bob, 9, 25 + bob, 2.6, 'metal', lo=1, hi=3)
    ellipse(c, 8.5, 26.5 + bob, 2.4, 2.4, 'gold', lo=1, hi=4)
    # Arm vorn mit Uhrzeiger-Schwert
    thick_line(c, 25, 19 + bob, 30, 17 + bob, 2.8, 'metal', lo=2, hi=5)
    thick_line(c, 30, 17 + bob, 31, 13 + bob, 2.6, 'metal', lo=2, hi=5)
    ellipse(c, 31, 12.5 + bob, 2.2, 2.2, 'gold', lo=2, hi=5)
    ellipse(c, 28.6, 16.8 + bob, 1.8, 1.8, 'gold', lo=2, hi=5)           # Gegengewicht des Zeigers
    blade(c, (31, 11 + bob), (37, 1 + bob), 2.2, 'metal', 3, 5)
    poly(c, [(34, 3 + bob), (37, 6.5 + bob), (34, 10 + bob), (31, 6.5 + bob)], 'metal', lo=3, hi=5)
    c.put_ramp(34, 5 + bob, 'bone', 5)
    c.put_ramp(35, 4 + bob, 'bone', 5)
    # Uhrkopf: Wecker mit zwei Glocken und Feder (teamA)
    ellipse(c, 19, 10 + bob, 7.6, 7.6, 'gold', lo=1, hi=5, ambient=0.2)
    ellipse(c, 19.5, 10.5 + bob, 5.8, 5.8, 'bone', lo=3, hi=5, ambient=0.4, flatness=0.9)
    for (x, y) in ((20, 5), (20, 16), (14, 10), (25, 10)):
        c.put_ramp(x, y + bob, 'coal', 2)
    c.line(20, 10 + bob, 20, 6 + bob, 'coal', 1)             # grosser Zeiger
    c.line(20, 10 + bob, 23, 12 + bob, 'coal', 1)            # kleiner Zeiger
    c.put_ramp(20, 10 + bob, 'fire', 3)
    for (bx, d) in ((13.5, -1), (24.5, 1)):
        ellipse(c, bx, 3.4 + bob, 2.9, 2.7, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 4 + bob)
        c.put_ramp(int(bx), 1 + bob, 'gold', 5)
    c.rect(18, 1 + bob, 20, 2 + bob, 'metal', 3)
    for k, (x, y) in enumerate(((19, 0), (19, -1), (20, -2))):
        pass
    c.outline()
    # Funken (Ueberspannung)
    if anim == 'charged':
        for (x, y) in ((1, 10), (36, 22), (3, 30)):
            for (dx, dy) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                c.put_ramp(x + dx, y + dy, 'gold', 5 if dx == dy == 0 else 4)
    return c


# =========================================================================== US-15 Wanderkiste (42 x 38)


def spr_walking_crate(anim='idle', f=0):
    c = Canvas(42, 38)
    st = [3, 0, -3, 0][f % 4]
    bob = [0, -1, 0, -1][f % 4]
    top, bot = 23 + bob, 32 + bob
    # Beinchen
    thick_line(c, 12, 31, 9 - st, 35, 3, 'wood', lo=0, hi=3)
    c.rect(5 - st, 35, 11 - st, 36, 'gold', 2)
    c.rect(5 - st, 37, 11 - st, 37, 'gold', 1)
    c.rect(5 - st, 36, 11 - st, 36, 'gold', 1)
    thick_line(c, 27, 31, 30 + st, 35, 3, 'wood', lo=2, hi=5)
    c.rect(27 + st, 35, 34 + st, 36, 'gold', 4)
    c.rect(27 + st, 37, 34 + st, 37, 'gold', 1)
    c.rect(27 + st, 36, 34 + st, 36, 'gold', 2)
    # Deckel-Geometrie (Scharnier hinten links, klappt wie ein Kiefer nach rechts oben auf)
    hx, hy = 8.0, float(top)
    ang = math.radians(-34 - (4 if f % 2 else 0))
    ca, sa = math.cos(ang), math.sin(ang)

    def rot(sx, sy):
        return (hx + sx * ca - sy * sa, hy + sx * sa + sy * ca)
    L_, T_ = 27, 8
    # Mauldunkel + Goldhaufen im Maul
    poly(c, [rot(0, 0), rot(L_, 0), (32, top), (8, top)], 'coal', flat=1)
    ellipse(c, 19, top - 0.5, 9.5, 3, 'gold', lo=2, hi=5, ambient=0.3)
    for (x, y) in ((14, -2), (19, -3), (24, -2)):
        c.put_ramp(x, top + y, 'gold', 5)
    # Truhenkoerper
    round_rect(c, 7, top, 32, bot, 'wood', lo=1, hi=4, radius=2)
    for y in (top + 4, top + 7):
        for x in range(8, 32):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y, 'wood', 1)
    for x in (10, 11, 28, 29):
        for y in range(top, bot + 1):
            c.put_ramp(x, y, 'gold', 4 if x in (10, 28) else 2)
    for (x, y) in ((10, top + 2), (10, bot - 2), (28, top + 2), (28, bot - 2)):
        c.put_ramp(x, y, 'gold', 5)
    # Schlossplatte = Nase
    c.rect(18, top + 3, 21, top + 7, 'gold', 4)
    c.rect(18, top + 3, 21, top + 3, 'gold', 5)
    c.rect(18, top + 7, 21, top + 7, 'gold', 2)
    c.put_ramp(19, top + 5, 'coal', 1)
    c.put_ramp(20, top + 5, 'coal', 1)
    c.put_ramp(19, top + 6, 'coal', 1)
    # Zaehne unten (am Truhenrand, zeigen nach oben)
    for k in range(4):
        x = 17 + k * 4
        poly(c, [(x, top), (x + 2.6, top), (x + 1.2, top - 3.4)], 'bone', flat=5)
        c.put_ramp(x + 2, top - 1, 'bone', 3)
    c.put_ramp(14, top - 1, 'gold', 5)             # Goldzahn
    c.put_ramp(14, top - 2, 'gold', 4)
    c.put_ramp(15, top - 1, 'gold', 5)
    # Zunge haengt ueber die Vorderkante
    strand(c, bezier((29, top - 1), (36, top - 1), (38, top + 5), (34, top + 9), 8), 3.4, 'skin', lo=1, hi=4)
    c.put_ramp(34, top + 8, 'skin', 4)
    c.put_ramp(33, top + 5, 'skin', 1)
    c.put_ramp(34, top + 6, 'skin', 1)
    # Deckel
    poly(c, [rot(0, 0), rot(L_, 0), rot(L_, -T_), rot(0, -T_)], 'wood', lo=1, hi=5)
    for (s0, s1) in ((4, 7), (14, 17)):
        poly(c, [rot(s0, 0), rot(s1, 0), rot(s1, -T_), rot(s0, -T_)], 'gold', lo=2, hi=4)
    # obere Zaehne (Deckelkante, zeigen zur Truhe)
    for k in range(4):
        s0 = 11 + k * 4.2
        poly(c, [rot(s0, 0), rot(s0 + 2.8, 0), rot(s0 + 1.4, 3.6)], 'bone', flat=5)
    # zwei Augen auf der Deckelflanke
    for sx in (21, 25.5):
        x, y = rot(sx, -4)
        x, y = int(x), int(y)
        c.rect(x, y, x + 1, y + 1, 'bone', 5)
        c.put_ramp(x + 1, y + 1, 'coal', 1)
    c.outline()
    return c




# =========================================================================== Nebenfigur: die Kiste als Koeder (zu US-15)


def spr_crate_loot(anim='idle', f=0):
    """Geschlossene Truhe, wirkt wie harmlose Beute - nur ein Auge blinzelt aus dem Deckelspalt"""
    c = Canvas(34, 26)
    round_rect(c, 1, 11, 32, 24, 'wood', lo=1, hi=4, radius=2)
    ellipse(c, 16.5, 12, 15.5, 8.4, 'wood', lo=2, hi=5, clip=lambda x, y: y <= 14)
    for x in range(2, 32):
        c.put_ramp(x, 14, 'gold', 3 if x % 2 else 2)
    for x in (6, 7, 26, 27):
        for y in range(5, 25):
            if c.alpha(x, y):
                c.put_ramp(x, y, 'gold', 4 if x in (6, 26) else 2)
    c.rect(15, 12, 18, 17, 'gold', 4)
    c.rect(15, 12, 18, 12, 'gold', 5)
    c.put_ramp(16, 15, 'coal', 1)
    c.put_ramp(17, 15, 'coal', 1)
    c.put_ramp(16, 16, 'coal', 1)
    for (x, y) in ((8, 19), (24, 19), (12, 21), (21, 21)):
        c.put_ramp(x, y, 'wood', 1)
    # Spalt mit blinzelndem Auge
    for x in range(21, 27):
        c.put_ramp(x, 15, 'coal', 0)
    c.put_ramp(23, 15, 'gold', 5)
    c.put_ramp(24, 15, 'gold', 4)
    c.outline()
    return c
