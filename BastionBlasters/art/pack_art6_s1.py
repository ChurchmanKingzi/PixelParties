"""pack_art6, Sprites Teil 1: Segens-Nonne, Traenkebrauer, Fallensteller-Koboldin, Imkerin, Jongleur-Clown, Brieftauben-Bote.
Alle Figuren blicken nach rechts. Nur 'idle' ist ausgearbeitet (f = Bewegungsphase)."""
from __future__ import annotations

from pack_art6_kit import *


# =========================================================================== UZ-08 Segens-Nonne (36 x 34)


def spr_blessing_nun(anim='idle', f=0):
    c = Canvas(36, 34)
    bob = [0, -1][f % 2]
    # Schuhe + Habit (schwarze Kutte, Saum faechert unten auf)
    for (x0, x1) in ((7, 11), (15, 19)):
        c.rect(x0, 32, x1, 33, 'wood', 1)
        c.rect(x0, 32, x0 + 1, 32, 'wood', 3)
    robe(c, 13, 16 + bob, 31, 5, 9.5, 'coal', lo=1, hi=4, hem=False)
    # Falten
    for y in range(24, 31):
        c.put_ramp(10, y, 'coal', 1)
        c.put_ramp(16, y, 'coal', 2)
    # weisser Kragen (Skapulier) + goldenes Kreuz + Strick
    ellipse(c, 13, 18 + bob, 6.4, 3.2, 'bone', lo=2, hi=5, clip=lambda x, y: y <= 20 + bob)
    c.rect(12, 21 + bob, 13, 25 + bob, 'gold', 4)
    c.rect(10, 22 + bob, 15, 23 + bob, 'gold', 4)
    c.put_ramp(12, 22 + bob, 'gold', 5)
    for x in range(8, 19):
        c.put_ramp(x, 27, 'bone', 3 if x % 2 else 2)
    for k in range(4):
        c.put_ramp(17, 28 + k, 'bone', 3 if k % 2 else 4)
    # linker Aermel (angewinkelt, haelt Zipfel)
    thick_line(c, 8, 18 + bob, 9, 24 + bob, 3.4, 'coal', lo=1, hi=3)
    hand(c, 9, 24 + bob)
    # Kopf: Haube (weiss), Gesicht, Schleier
    ellipse(c, 13, 10 + bob, 6.4, 6.6, 'bone', lo=2, hi=5)
    ellipse(c, 14.5, 11 + bob, 3.8, 4.0, 'skin', lo=3, hi=5)
    eye(c, 16, 10 + bob)
    c.put_ramp(17, 14 + bob, 'skin', 2)
    ellipse(c, 13, 7 + bob, 7.4, 5.6, 'coal', lo=1, hi=4, clip=lambda x, y: y <= 7 + bob)
    poly(c, [(5, 7 + bob), (10, 6 + bob), (10, 17 + bob), (6, 16 + bob)], 'coal', lo=1, hi=3)
    for x in range(9, 19):
        c.put_ramp(x, 8 + bob, 'bone', 5 if x % 3 else 4)
    # rechter Aermel erhoben + Heiligenschein-Frisbee
    ring(c, 27, 9 + bob, 8.0, 3.8, 0.40, 'gold', lo=2, hi=5, ang=-14)
    for (x, y) in ((22, 12), (31, 7), (33, 8)):
        c.put_ramp(x, y + bob, 'gold', 5)
    thick_line(c, 18, 19 + bob, 23, 14 + bob, 3.4, 'coal', lo=1, hi=4)
    hand(c, 23, 12 + bob)
    sparkle(c, 31, 2 + bob, 'gold', big=False)
    c.outline()
    return c


# =========================================================================== UZ-09 Traenkebrauer (36 x 34)


def spr_potion_brewer(anim='idle', f=0):
    c = Canvas(36, 34)
    bob = [0, -1][f % 2]
    # Stiefel + Beine
    thick_line(c, 12, 26, 11, 30, 3.2, 'wood', lo=1, hi=3)
    thick_line(c, 18, 26, 19, 30, 3.2, 'wood', lo=2, hi=4)
    shoes(c, 8, 13, 30, 'wood', 3)
    shoes(c, 17, 23, 30, 'wood', 4)
    # Labormantel
    round_rect(c, 9, 14 + bob, 21, 28, 'bone', lo=2, hi=5, radius=2)
    for y in range(18, 28):
        c.put_ramp(15, y, 'bone', 1)
    for y in (20, 24):
        c.put_ramp(14, y, 'metal', 4)
    # Bandelier mit Fläschchen
    for k in range(12):
        c.put_ramp(10 + k, 16 + bob + k * 8 // 12 + 1, 'wood', 3 if k % 2 else 2)
    for (x, y, r) in ((11, 19, 'fire'), (14, 22, 'slime'), (17, 25, 'purple')):
        c.rect(x, y + bob, x + 1, y + 2 + bob, r, 4)
        c.put_ramp(x, y + bob, 'bone', 5)
    # linker Arm haengt
    thick_line(c, 9, 17 + bob, 7, 23 + bob, 2.6, 'bone', lo=1, hi=4)
    hand(c, 6, 23 + bob, 'dirt', 3)
    # grosser Kolben im erhobenen Arm
    thick_line(c, 20, 17 + bob, 25, 13 + bob, 3.0, 'bone', lo=2, hi=5)
    hand(c, 25, 12 + bob, 'dirt', 4)
    fx, fy = 29, 8 + bob
    c.rect(fx - 1, fy - 8, fx + 1, fy - 3, 'ice', 4)
    c.rect(fx - 1, fy - 8, fx - 1, fy - 3, 'ice', 5)
    c.rect(fx - 2, fy - 9, fx + 2, fy - 9, 'wood', 4)
    ellipse(c, fx, fy, 5.8, 5.4, 'ice', lo=3, hi=5, ambient=0.3)
    # Trank im Kolben: unten Fluessigkeit, oben Blasen
    for y in range(fy - 1, fy + 6):
        for x in range(fx - 5, fx + 6):
            if c.alpha(x, y) and math.hypot(x + 0.5 - fx, y + 0.5 - fy) < 5.0 and y >= fy:
                c.put_ramp(x, y, 'purple', 3 if (x + y) % 2 else 4)
    c.put_ramp(fx - 2, fy + 3, 'purple', 5)
    for (x, y) in ((fx - 2, fy - 1), (fx + 1, fy - 3), (fx + 2, fy - 6)):
        c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(fx - 3, fy - 2, 'bone', 5)
    c.put_ramp(fx - 3, fy - 1, 'bone', 5)
    # Kopf + Haare + Reagenzglas-Brille
    ellipse(c, 15, 10 + bob, 4.8, 4.5, 'skin', lo=2, hi=5)
    for (pts, i) in (([(10, 8), (7, 2), (13, 6)], 3), ([(12, 6), (14, 0), (17, 6)], 4), ([(15, 6), (20, 1), (20, 8)], 3),
                     ([(10, 11), (5, 8), (11, 7)], 2)):
        poly(c, [(x, y + bob) for (x, y) in pts], 'fire', lo=1, hi=4, flat=None)
    ellipse(c, 15, 6.5 + bob, 5.6, 3.0, 'fire', lo=2, hi=4, clip=lambda x, y: y <= 7 + bob)
    # Brille: Riemen + zwei Reagenzglaeser (Kork vorn)
    for x in range(10, 18):
        c.put_ramp(x, 9 + bob, 'wood', 2 if x % 2 else 3)
    c.rect(17, 7 + bob, 24, 8 + bob, 'ice', 4)          # hinteres Glas
    c.rect(17, 7 + bob, 24, 7 + bob, 'ice', 5)
    c.rect(18, 8 + bob, 22, 8 + bob, 'fire', 3)
    c.rect(25, 7 + bob, 26, 8 + bob, 'wood', 4)
    c.rect(18, 10 + bob, 25, 12 + bob, 'ice', 3)        # vorderes Glas
    c.rect(18, 10 + bob, 25, 10 + bob, 'ice', 5)
    c.rect(19, 11 + bob, 24, 12 + bob, 'slime', 3)
    c.put_ramp(20, 11 + bob, 'slime', 5)
    c.rect(26, 10 + bob, 27, 12 + bob, 'wood', 4)
    c.put_ramp(26, 10 + bob, 'wood', 5)
    c.put_ramp(17, 11 + bob, 'coal', 1)                # Auge hinter dem Glas
    c.put_ramp(17, 12 + bob, 'coal', 1)
    for x in range(14, 18):
        c.put_ramp(x, 14 + bob, 'skin', 1)
    c.outline()
    return c


# =========================================================================== UZ-10 Fallensteller-Koboldin (36 x 34)


def spr_trapper_kobold(anim='idle', f=0):
    c = Canvas(36, 34)
    bob = [0, -1][f % 2]
    # Schwanz (J-Kurve) mit Quaste
    for (a, b) in (((10, 27), (6, 28)), ((6, 28), (3, 25)), ((3, 25), (3, 20))):
        thick_line(c, a[0], a[1], b[0], b[1], 2.2, 'dirt', lo=1, hi=3)
    ellipse(c, 3.5, 18.5, 2.2, 2.8, 'fire', lo=2, hi=5)
    # Beine + Stiefel
    thick_line(c, 13, 27, 12, 30, 3.2, 'dirt', lo=1, hi=3)
    thick_line(c, 19, 27, 20, 30, 3.2, 'dirt', lo=2, hi=4)
    for (x0, x1, i) in ((9, 15, 3), (18, 24, 4)):
        for x in range(x0, x1 + 1):
            c.put_ramp(x, 30, 'wood', i if x < x1 - 1 else i - 1)
            c.put_ramp(x, 31, 'wood', 1)
    # hinterer Arm
    thick_line(c, 10, 19 + bob, 8, 25, 2.4, 'dirt', lo=1, hi=3)
    # Koerper: blaue Latzhose, Messingknoepfe, rotes Halstuch mit flatterndem Zipfel
    round_rect(c, 10, 17 + bob, 21, 28, 'ice', lo=1, hi=4, radius=2)
    c.rect(12, 18 + bob, 19, 22, 'ice', 3)
    c.rect(12, 18 + bob, 12, 22, 'ice', 4)
    for (x, y) in ((12, 20), (19, 20)):
        c.rect(x, y + bob, x + 1, y + 1 + bob, 'gold', 4)
        c.put_ramp(x, y + bob, 'gold', 5)
    for x in range(10, 22):
        c.put_ramp(x, 23, 'ice', 1)
    c.rect(14, 24, 17, 26, 'ice', 2)
    c.rect(10, 16 + bob, 21, 18 + bob, 'teamA', 3)
    c.rect(10, 16 + bob, 21, 16 + bob, 'teamA', 4)
    poly(c, [(10, 17 + bob), (4, 19 + bob), (5, 22 + bob), (10, 20 + bob)], 'teamA', lo=1, hi=4)
    # Kopf: Schnauze, Schlappohr, Auge
    poly(c, [(11, 9 + bob), (5, 10 + bob), (4, 17 + bob), (10, 14 + bob)], 'dirt', lo=2, hi=4)
    c.put_ramp(6, 12 + bob, 'skin', 2)
    c.put_ramp(6, 13 + bob, 'skin', 2)
    ellipse(c, 16, 11 + bob, 5.0, 4.6, 'dirt', lo=3, hi=5)
    ellipse(c, 22, 12.5 + bob, 3.4, 2.4, 'dirt', lo=4, hi=5)
    c.rect(24, 11 + bob, 25, 12 + bob, 'coal', 1)
    for x in range(19, 23):
        c.put_ramp(x, 14 + bob, 'dirt', 1)
    c.put_ramp(22, 15 + bob, 'bone', 5)
    eye(c, 18, 9 + bob)
    # Mausefallen-Hut: helles Brett, Federbuegel, Kaese
    thick_line(c, 10, 7 + bob, 22, 5 + bob, 3.0, 'bone', lo=3, hi=5)
    c.rect(11, 8 + bob, 21, 8 + bob, 'bone', 2)
    c.rect(10, 6 + bob, 12, 7 + bob, 'metal', 2)
    thick_line(c, 12, 6 + bob, 12, 1 + bob, 1.4, 'metal', lo=3, hi=5)
    thick_line(c, 12, 1 + bob, 18, 1 + bob, 1.4, 'metal', lo=3, hi=5)
    thick_line(c, 18, 1 + bob, 18, 5 + bob, 1.4, 'metal', lo=3, hi=5)
    poly(c, [(19, 5 + bob), (25, 5 + bob), (25, 2 + bob)], 'gold', lo=3, hi=5)
    c.put_ramp(22, 4 + bob, 'gold', 2)
    c.put_ramp(24, 4 + bob, 'gold', 2)
    # vorderer Arm + Baerenfalle auf Holzbrett (Zaehne!)
    thick_line(c, 20, 19 + bob, 24, 24, 2.6, 'dirt', lo=2, hi=5)
    ellipse(c, 28, 26, 7.0, 4.6, 'wood', lo=1, hi=3)
    ring(c, 28, 26, 7.6, 4.8, 0.30, 'metal', lo=1, hi=4)
    for x in range(23, 34, 2):
        dy = 3.1 * math.sqrt(max(0.0, 1 - ((x - 28) / 5.1) ** 2))
        c.put_ramp(x, int(round(26 - dy)), 'bone', 5)
        c.put_ramp(x, int(round(26 - dy)) + 1, 'bone', 3)
        c.put_ramp(x, int(round(26 + dy)) - 1, 'bone', 4)
        c.put_ramp(x, int(round(26 + dy)), 'bone', 2)
    c.rect(27, 25, 29, 27, 'metal', 3)
    c.put_ramp(28, 26, 'gold', 5)
    c.put_ramp(35, 24, 'metal', 3)
    c.put_ramp(35, 25, 'metal', 2)
    hand(c, 23, 24, 'dirt', 4)
    c.outline()
    return c


# =========================================================================== UZ-11 Imkerin (36 x 36)


def _bee(c, x, y, dir_=1):
    c.put_ramp(x + 1, y, 'bone', 5)
    c.put_ramp(x, y + 1, 'gold', 4)
    c.put_ramp(x + 1, y + 1, 'coal', 1)
    c.put_ramp(x + 2, y + 1, 'gold', 5)
    c.put_ramp(x + 2, y, 'bone', 4)


def spr_beekeeper(anim='idle', f=0):
    c = Canvas(36, 36)
    bob = [0, -1][f % 2]
    # Stiefel, Beine im weissen Anzug
    thick_line(c, 12, 27, 11, 32, 3.6, 'bone', lo=2, hi=4)
    thick_line(c, 18, 27, 19, 32, 3.6, 'bone', lo=3, hi=5)
    for (x0, x1, i) in ((8, 14, 3), (17, 23, 4)):
        for x in range(x0, x1 + 1):
            c.put_ramp(x, 33, 'wood', i if x < x1 - 1 else i - 1)
            c.put_ramp(x, 34, 'wood', 1)
            c.put_ramp(x, 35, 'wood', 1)
    # Anzug (weit, bauschig)
    round_rect(c, 8, 17 + bob, 22, 30, 'bone', lo=2, hi=5, radius=4, ambient=0.5)
    c.rect(8, 24, 22, 24, 'wood', 3)
    c.rect(8, 25, 22, 25, 'wood', 1)
    c.put_ramp(15, 24, 'gold', 5)
    c.put_ramp(16, 24, 'gold', 4)
    c.rect(14, 26, 15, 30, 'bone', 2)
    # linker Arm: Handschuh
    thick_line(c, 8, 20 + bob, 6, 26, 3.6, 'bone', lo=2, hi=4)
    c.rect(5, 26, 7, 28, 'dirt', 3)
    # Honigwabe im Rahmen (gross, rechts)
    fx0, fy0, fx1, fy1 = 22, 11 + bob, 33, 27 + bob
    c.rect(fx0, fy0, fx1, fy1, 'wood', 3)
    c.rect(fx0, fy0, fx1, fy0, 'wood', 5)
    c.rect(fx0, fy0, fx0, fy1, 'wood', 4)
    c.rect(fx1, fy0, fx1, fy1, 'wood', 1)
    c.rect(fx0, fy1, fx1, fy1, 'wood', 1)
    for y in range(fy0 + 2, fy1 - 1):
        for x in range(fx0 + 2, fx1 - 1):
            hexrow = (y - fy0) % 4
            hexcol = (x - fx0 + (2 if ((y - fy0) // 4) % 2 else 0)) % 4
            if hexrow == 0 or (hexrow == 1 and hexcol in (0, 3)) or (hexrow == 3 and hexcol in (0, 3)):
                idx = 2
            else:
                idx = 4 if (x + y) % 2 else 3
            c.put_ramp(x, y, 'gold', idx)
    for (x, y) in ((24, 13), (29, 14)):
        c.put_ramp(x + 0, y + bob, 'gold', 5)
    for (x, ln) in ((25, 4), (28, 6), (31, 3)):
        for k in range(ln):
            c.put_ramp(x, fy1 + 1 + k, 'gold', 4 if k < ln - 1 else 5)
    # rechter Arm greift den Rahmen
    thick_line(c, 21, 20 + bob, 24, 22 + bob, 3.6, 'bone', lo=3, hi=5)
    c.rect(23, 21 + bob, 25, 24 + bob, 'dirt', 4)
    # Kopf mit Schleier, grosser Strohhut
    ellipse(c, 15, 12 + bob, 4.8, 5.0, 'skin', lo=2, hi=5)
    eye(c, 18, 11 + bob)
    c.put_ramp(18, 14 + bob, 'skin', 1)
    c.put_ramp(19, 14 + bob, 'skin', 1)
    # Schleier: Dither ueber Gesicht, Netz faellt bis auf die Schultern
    for y in range(10 + bob, 17 + bob):
        t = (y - 10 - bob) / 6.0
        left, right = int(round(9.5 - t * 0.6)), int(round(20.5 + t * 0.8))
        for x in range(left, right + 1):
            if c.alpha(x, y) and c.rid[y, x] == RAMP_ID['skin']:
                if (x + y) % 2 == 0:
                    c.put_ramp(x, y, 'bone', 4)
            elif not c.alpha(x, y) or y >= 14 + bob:
                c.put_ramp(x, y, 'bone', 4 if (x + y) % 2 == 0 else 3)
    # Hut
    ellipse(c, 15, 9 + bob, 11.0, 3.4, 'gold', lo=2, hi=5)
    ellipse(c, 15, 9 + bob, 6.6, 6.2, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 8 + bob)
    for x in range(9, 22):
        c.put_ramp(x, 7 + bob, 'wood', 2)
        c.put_ramp(x, 6 + bob, 'wood', 3 if x % 2 else 2)
    for k in range(5):
        c.put_ramp(11 + k * 2, 3 + bob + (k % 2), 'gold', 3)
    # Bienenaura
    for (x, y) in ((2, 8), (4, 22), (31, 5), (14, 1), (33, 30), (0, 14)):
        _bee(c, x, y + (bob if x % 2 else 0))
    c.outline()
    return c


# =========================================================================== UZ-12 Jongleur-Clown (36 x 38)


def _club(c, x0, y0, x1, y1, ramp):
    """Keule: Griff von (x0,y0) nach (x1,y1), dicker Kolben am Ende"""
    thick_line(c, x0, y0, x1, y1, 1.6, 'bone', lo=3, hi=5)
    dx, dy = x1 - x0, y1 - y0
    bx, by = x0 + dx * 1.35, y0 + dy * 1.35
    thick_line(c, x1, y1, bx, by, 3.4, ramp, lo=2, hi=5)
    c.put_ramp(int(x1), int(y1), 'gold', 5)


def spr_juggler_clown(anim='idle', f=0):
    c = Canvas(40, 38)
    bob = [0, -1][f % 2]
    ph = f % 3
    # Riesenschuhe (breiter Stand, Spitzen nach oben)
    for (x0, x1, i) in ((3, 15, 3), (17, 29, 4)):
        for y in range(34, 38):
            for x in range(x0, x1 + 1):
                t = (x - x0) / (x1 - x0)
                if y == 34 and t < 0.55:
                    continue
                if y == 33:
                    continue
                c.put_ramp(x, y, 'fire', 4 if y == 34 else (3 if y == 35 else 2 if y == 36 else 1))
        c.rect(x1 - 1, 32, x1, 34, 'fire', 4)
        c.put_ramp(x1, 31, 'fire', 5)
        c.put_ramp(x1 - 1, 32, 'fire', 5)
        c.rect(x0 + 2, 35, x0 + 3, 35, 'bone', 5)
        c.put_ramp(x1 - 2, 33, 'gold', 5)
    # Beine
    thick_line(c, 10, 29, 9, 34, 3.4, 'gold', lo=1, hi=3)
    thick_line(c, 19, 29, 22, 34, 3.4, 'gold', lo=2, hi=4)
    # Bauschiger Anzug mit Punkten
    round_rect(c, 6, 17 + bob, 23, 31, 'purple', lo=1, hi=4, radius=5)
    for (x, y) in ((9, 22), (16, 21), (12, 27), (20, 26), (8, 28), (21, 31 - 3)):
        c.rect(x, y + bob, x + 1, y + 1 + bob, 'gold', 4)
        c.put_ramp(x, y + bob, 'gold', 5)
    c.rect(14, 23 + bob, 15, 24 + bob, 'fire', 4)
    c.rect(14, 27 + bob, 15, 28 + bob, 'fire', 3)
    # Kragen + Fliege
    ellipse(c, 14.5, 18 + bob, 8.0, 2.8, 'bone', lo=2, hi=5)
    for x in range(8, 22, 2):
        c.put_ramp(x, 20 + bob, 'bone', 1)
    # Arme nach oben, weisse Handschuhe
    thick_line(c, 8, 20 + bob, 3, 13 + bob, 3.0, 'purple', lo=1, hi=3)
    thick_line(c, 22, 20 + bob, 28, 13 + bob, 3.0, 'purple', lo=2, hi=4)
    c.rect(2, 11 + bob, 4, 13 + bob, 'bone', 4)
    c.rect(2, 11 + bob, 2, 11 + bob, 'bone', 5)
    c.rect(27, 11 + bob, 29, 13 + bob, 'bone', 4)
    c.rect(27, 11 + bob, 27, 11 + bob, 'bone', 5)
    # Kopf: Wollhaar seitlich (gruen), Nase, Grinsen
    ellipse(c, 6, 11 + bob, 4.4, 4.4, 'leaf', lo=2, hi=5)
    ellipse(c, 23, 9 + bob, 4.0, 4.2, 'leaf', lo=1, hi=4)
    ellipse(c, 15, 5 + bob, 5.2, 3.6, 'leaf', lo=2, hi=5)
    ellipse(c, 14.5, 12 + bob, 6.4, 5.6, 'bone', lo=3, hi=5)
    ellipse(c, 15, 13 + bob, 2.5, 2.5, 'fire', lo=1, hi=4, ambient=0.3)
    c.put_ramp(14, 12 + bob, 'bone', 5)
    for ex in (11, 18):
        c.put_ramp(ex, 9 + bob, 'coal', 1)
        c.put_ramp(ex, 10 + bob, 'coal', 1)
    for (x, y) in ((10, 14), (11, 15), (12, 16), (13, 17), (14, 17), (15, 17), (16, 17), (17, 16), (18, 15), (19, 14)):
        c.put_ramp(x, y + bob, 'fire', 3)
    c.rect(9, 12 + bob, 10, 13 + bob, 'skin', 3)
    c.rect(20, 12 + bob, 21, 13 + bob, 'skin', 2)
    # Keulen im Wurf (drei Phasen)
    pos = [((8, 8), (5, 3), 'ice'), ((15, 2), (20, 0), 'fire'), ((27, 6), (31, 2), 'gold')]
    pos = pos[ph:] + pos[:ph]
    for ((ax, ay), (bx, by), col) in pos:
        pass
    clubs = [((8, 9), (3, 3), 'ice'), ((19, 4), (14, 0), 'fire'), ((31, 9), (35, 4), 'gold')]
    for (a, b, col) in clubs:
        _club(c, a[0], a[1], b[0], b[1], col)
    c.outline()
    return c


# =========================================================================== UZ-13 Brieftauben-Bote (36 x 32)


def spr_pigeon_courier(anim='idle', f=0):
    c = Canvas(36, 32)
    up = f % 2 == 0
    # Schwanz (schmaler Faecher)
    poly(c, [(9, 18), (1, 15), (0, 19), (2, 23), (9, 22)], 'stone', lo=1, hi=3)
    for (x0, y0, x1, y1) in ((1, 17, 8, 19), (1, 21, 8, 20)):
        c.line(x0, y0, x1, y1, 'stone', 1)
    # hinterer Fluegel (dunkler)
    if up:
        poly(c, [(15, 17), (11, 1), (15, 4), (19, 2), (23, 6), (22, 15)], 'stone', lo=0, hi=2)
    else:
        poly(c, [(15, 19), (10, 29), (15, 28), (19, 30), (23, 26), (22, 21)], 'stone', lo=0, hi=2)
    # Koerper: Brust nach vorn gewoelbt
    ellipse(c, 14, 19.5, 9.4, 5.6, 'stone', lo=2, hi=5, ambient=0.2)
    ellipse(c, 20, 18, 5.6, 5.2, 'stone', lo=3, hi=5, ambient=0.25)
    for x in range(8, 20):
        c.put_ramp(x, 24, 'stone', 1)
    # Fluegel vorn mit Fingerfedern
    if up:
        poly(c, [(11, 17), (3, 6), (4, 3), (8, 4), (9, 1), (13, 3), (16, 1), (19, 4), (20, 15)], 'stone', lo=2, hi=5)
        for (x0, y0, x1, y1) in ((5, 5, 11, 13), (9, 3, 14, 12), (13, 3, 17, 12)):
            c.line(x0, y0, x1, y1, 'stone', 1)
        for (x, y) in ((6, 7), (10, 5), (14, 5), (17, 6)):
            c.put_ramp(x, y, 'stone', 5)
        c.rect(9, 13, 19, 14, 'bone', 4)
    else:
        poly(c, [(11, 21), (4, 29), (8, 31), (10, 28), (13, 31), (17, 29), (21, 22)], 'stone', lo=2, hi=5)
        for (x0, y0, x1, y1) in ((6, 29, 11, 23), (10, 29, 14, 23), (14, 29, 17, 23)):
            c.line(x0, y0, x1, y1, 'stone', 1)
        c.rect(9, 21, 19, 22, 'bone', 4)
    # schillernder Halsring + Kopf
    ellipse(c, 23, 15, 4.2, 4.2, 'slime', lo=2, hi=4)
    for (x, y) in ((21, 14), (22, 16), (24, 17), (23, 13)):
        c.put_ramp(x, y, 'purple', 3)
    c.put_ramp(21, 13, 'slime', 5)
    ellipse(c, 25.5, 11, 3.8, 3.6, 'stone', lo=3, hi=5)
    c.rect(28, 11, 29, 12, 'bone', 4)
    c.put_ramp(29, 11, 'bone', 5)
    c.put_ramp(27, 10, 'coal', 1)
    c.put_ramp(27, 11, 'coal', 1)
    c.put_ramp(26, 10, 'fire', 4)
    # Mini-Muetze (rot, Schirm, Knopf, Feder)
    ellipse(c, 25, 8.4, 3.4, 3.0, 'teamA', lo=1, hi=4, clip=lambda x, y: y <= 8)
    c.rect(22, 8, 28, 8, 'teamA', 1)
    c.rect(27, 8, 30, 8, 'teamA', 3)
    c.put_ramp(25, 5, 'gold', 5)
    c.put_ramp(22, 5, 'bone', 5)
    c.put_ramp(21, 4, 'bone', 5)
    c.put_ramp(21, 3, 'bone', 4)
    # Brief im Schnabel
    ex, ey = 28, 13
    c.rect(ex, ey, ex + 8, ey + 6, 'bone', 4)
    c.rect(ex, ey, ex + 8, ey, 'bone', 5)
    c.rect(ex, ey, ex, ey + 6, 'bone', 5)
    c.rect(ex + 8, ey, ex + 8, ey + 6, 'bone', 2)
    c.rect(ex, ey + 6, ex + 8, ey + 6, 'bone', 2)
    for k in range(5):
        c.put_ramp(ex + 1 + k, ey + 1 + k // 2, 'bone', 2)
        c.put_ramp(ex + 7 - k, ey + 1 + k // 2, 'bone', 2)
    c.rect(ex + 3, ey + 3, ex + 5, ey + 4, 'teamA', 3)
    c.put_ramp(ex + 3, ey + 3, 'teamA', 5)
    # Fuesse
    c.put_ramp(13, 25, 'skin', 3)
    c.put_ramp(14, 26, 'skin', 3)
    c.put_ramp(17, 25, 'skin', 3)
    c.put_ramp(18, 26, 'skin', 3)
    c.outline()
    return c
