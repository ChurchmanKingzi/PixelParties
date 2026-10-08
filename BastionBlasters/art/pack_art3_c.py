"""pack_art3, Teil C: Sprites US-20 .. US-23 (Waschbaer-Assassine, Huegelriese, Kuchenfeuer, Spiegel-Zwilling)."""
from __future__ import annotations

from pack_art3_lib import *


# =========================================================================== US-20 Waschbaer-Assassine (48 x 38)


def spr_raccoon_assassin(anim='idle', f=0):
    c = Canvas(48, 38)
    bob = [0, -1][f % 2]
    run = [3, 0, -3, 0][f % 4]
    # Ringelschwanz (hinten, buschig)
    pts = bezier((13, 27 + bob), (1, 28 + bob), (0, 12 + bob), (9, 8 + bob), 16)
    for i in range(len(pts) - 1):
        ring = (i // 2) % 2
        a, b = pts[i], pts[i + 1]
        if ring == 0:
            thick_line(c, a[0], a[1], b[0], b[1], 7.2, 'stone', lo=2, hi=5)
        else:
            thick_line(c, a[0], a[1], b[0], b[1], 7.2, 'coal', lo=1, hi=3)
    ellipse(c, pts[-1][0], pts[-1][1], 3.4, 3.4, 'bone', lo=2, hi=5)
    # Hinterbein
    thick_line(c, 15, 29 + bob, 11 - run, 35, 3.6, 'stone', lo=0, hi=3)
    ellipse(c, 10 - run, 35.5, 3.6, 1.9, 'coal', lo=1, hi=3)
    # Koerper (geduckt)
    ellipse(c, 21, 26 + bob, 11, 7, 'stone', lo=1, hi=5, ambient=0.15)
    ellipse(c, 24, 29.5 + bob, 7.6, 3.4, 'bone', lo=3, hi=5, clip=lambda x, y: y >= 28 + bob)
    # Vorderbein
    thick_line(c, 26, 29 + bob, 29 + run, 35, 3.6, 'stone', lo=2, hi=5)
    ellipse(c, 30 + run, 35.5, 3.8, 1.9, 'coal', lo=2, hi=4)
    # Muelleimerdeckel-Schild vorn
    cx, cy = 18.5, 27 + bob
    ellipse(c, cx, cy, 8.2, 8.2, 'metal', lo=0, hi=3, ambient=0.3)
    ellipse(c, cx, cy, 7.0, 7.0, 'metal', lo=2, hi=5, ambient=0.28, flatness=0.3)
    rim_arc(c, cx, cy, 5.2, 5.2, 'metal', 2, 0, 360)
    rim_arc(c, cx, cy, 5.2, 5.2, 'metal', 5, 190, 290)
    ellipse(c, cx, cy, 2.2, 2.0, 'metal', lo=1, hi=5)
    c.put_ramp(int(cx) - 1, int(cy) - 1, 'metal', 5)
    for (x, y) in ((int(cx) + 4, int(cy) + 3), (int(cx) - 5, int(cy) + 2), (int(cx) + 2, int(cy) - 5)):
        c.put_ramp(x, y, 'metal', 1)
    # Kopf
    hx, hy = 32, 19 + bob
    poly(c, [(27, hy - 4), (30, hy - 4), (28.5, hy - 9)], 'stone', lo=1, hi=4)
    poly(c, [(33, hy - 4), (36, hy - 4), (35.5, hy - 9)], 'stone', lo=2, hi=5)
    c.put_ramp(29, hy - 6, 'skin', 3)
    c.put_ramp(35, hy - 6, 'skin', 3)
    ellipse(c, hx, hy, 7.4, 6.0, 'stone', lo=2, hi=5)
    ellipse(c, hx + 5.6, hy + 2.2, 4.4, 3.2, 'bone', lo=3, hi=5)
    c.rect(hx + 8, hy + 1, hx + 9, hy + 2, 'coal', 1)             # Nase
    # Waschbaer-Maske (dunkel) um das Auge + Ninja-Stirnband (teamA)
    c.rect(hx - 2, hy - 1, hx + 6, hy + 1, 'coal', 1)
    c.rect(hx + 1, hy - 1, hx + 2, hy, 'bone', 5)                  # Auge
    for x in range(hx - 7, hx + 7):
        if c.alpha(x, hy - 3):
            c.put_ramp(x, hy - 3, 'teamA', 4 if x < hx else 3)
            c.put_ramp(x, hy - 4, 'teamA', 3)
    # Stirnband-Enden flattern
    strand(c, bezier((hx - 6, hy - 3), (hx - 11, hy - 6), (hx - 14, hy - 2), (hx - 19, hy - 5 - (f % 2)), 8), 2.0, 'teamA', lo=2, hi=4)
    strand(c, bezier((hx - 6, hy - 2), (hx - 11, hy - 1), (hx - 15, hy + 2), (hx - 19, hy + 1 + (f % 2)), 8), 2.0, 'teamA', lo=1, hi=3)
    # Dolch-Arm vorn
    thick_line(c, 27, 24 + bob, 33, 25 + bob, 3.0, 'stone', lo=2, hi=5)
    ellipse(c, 34, 25.2 + bob, 2.2, 2.2, 'coal', lo=2, hi=4)
    blade(c, (35, 25 + bob), (44, 20 + bob), 2.4, 'metal', 3, 5)
    c.rect(34, 22 + bob, 35, 28 + bob, 'gold', 3)
    c.outline()
    return c


# =========================================================================== US-21 Huegelriese (64 x 64)


def _tiny_person(c, x, y, col, wave=0):
    """winziger Bewohner (ca. 3 x 6 px) - winkt"""
    c.put_ramp(x, y, 'skin', 4)
    c.put_ramp(x, y + 1, col, 3)
    c.put_ramp(x, y + 2, col, 2)
    c.put_ramp(x, y + 3, 'wood', 2)
    if wave:
        c.put_ramp(x + 1, y, 'skin', 4)
        c.put_ramp(x + 1, y - 1, 'skin', 5)
        c.put_ramp(x - 1, y + 1, 'skin', 3)
    else:
        c.put_ramp(x - 1, y + 1, 'skin', 4)
        c.put_ramp(x + 1, y + 1, 'skin', 3)


def spr_hill_giant(anim='idle', f=0):
    c = Canvas(72, 64)
    st = [3, 0, -3, 0][f % 4]
    bob = [0, -1, 0, -1][f % 4]
    # Bein hinten + Stiefel
    thick_line(c, 24, 46 + bob, 19 - st, 58, 10, 'skin', lo=0, hi=3)
    ellipse(c, 18 - st, 60.5, 8.0, 3.4, 'wood', lo=1, hi=3)
    # Rueckenarm (haengt)
    thick_line(c, 21, 30 + bob, 15, 44 + bob, 7.4, 'skin', lo=0, hi=3)
    ellipse(c, 14, 47 + bob, 4.4, 4.4, 'skin', lo=0, hi=3)
    # Wiesenhuegel auf dem Ruecken
    ellipse(c, 17, 24 + bob, 16.5, 11.5, 'grass', lo=1, hi=4, ambient=0.2)
    rnd = random.Random(21)
    for k in range(40):
        x, y = rnd.randint(3, 32), rnd.randint(14, 34)
        if c.alpha(x, y + bob):
            c.put_ramp(x, y + bob, 'grass', rnd.choice((2, 5, 5)))
    for (x, y, col) in ((4, 28, 'gold'), (28, 22, 'fire'), (9, 33, 'bone'), (26, 31, 'gold')):
        c.put_ramp(x, y + bob, col, 5)
        c.put_ramp(x + 1, y + 1 + bob, 'leaf', 3)
    # Koerper
    ellipse(c, 30, 37 + bob, 14, 13.4, 'skin', lo=1, hi=4, ambient=0.18)
    # Grasrock mit Zackensaum
    for x in range(20, 42):
        zig = 3 if (x % 4 < 2) else 0
        for y in range(45 + bob, 50 + bob + zig):
            c.put_ramp(x, y, 'grass', 3 if (x + y) % 3 else 4)
    for x in range(21, 41):
        c.put_ramp(x, 45 + bob, 'wood', 2)
    # Haeuschen auf dem Ruecken
    hx0, hy0 = 4, 6 + bob
    c.rect(hx0, hy0 + 7, hx0 + 15, hy0 + 17, 'wood', 3)
    for y in range(hy0 + 9, hy0 + 17, 4):
        for x in range(hx0, hx0 + 16):
            c.put_ramp(x, y, 'wood', 2)
    c.rect(hx0, hy0 + 7, hx0, hy0 + 17, 'wood', 4)
    c.rect(hx0 + 6, hy0 + 11, hx0 + 9, hy0 + 17, 'wood', 1)       # Tuer
    c.rect(hx0 + 2, hy0 + 9, hx0 + 4, hy0 + 11, 'sky', 4)         # Fenster
    c.rect(hx0 + 11, hy0 + 9, hx0 + 13, hy0 + 11, 'sky', 3)
    poly(c, [(hx0 - 3, hy0 + 8), (hx0 + 18, hy0 + 8), (hx0 + 12, hy0 - 1), (hx0 + 3, hy0 - 1)], 'teamA', lo=1, hi=4)
    for x in range(hx0 - 2, hx0 + 18):
        c.put_ramp(x, hy0 + 8, 'teamA', 1)
    c.rect(hx0 + 12, hy0 - 4, hx0 + 14, hy0 + 1, 'stone', 3)      # Schornstein
    c.rect(hx0 + 12, hy0 - 4, hx0 + 14, hy0 - 4, 'stone', 5)
    puff(c, hx0 + 18, hy0 - 8 - (f % 2), 2.6, 'bone', lo=3, hi=5, seed=2)
    # Bewohner winken
    _tiny_person(c, hx0 + 6, hy0 - 6, 'fire', 1)
    c.line(hx0 + 6, hy0 - 2, hx0 + 6, hy0 - 1, 'wood', 3)
    _tiny_person(c, hx0 - 2, hy0 + 15, 'leaf', 1)
    _tiny_person(c, hx0 + 20, hy0 + 15, 'gold', 1)
    # Bein vorn + Stiefel
    thick_line(c, 37, 46 + bob, 43 + st, 58, 10.5, 'skin', lo=1, hi=4)
    ellipse(c, 45 + st, 60.5, 9.0, 3.6, 'wood', lo=1, hi=4)
    for x in range(37 + st, 53 + st):
        c.put_ramp(x, 61, 'wood', 1)
    # Kopf mit Wiesenhaar
    ellipse(c, 41, 16 + bob, 10, 9.4, 'skin', lo=2, hi=5, ambient=0.18)
    ellipse(c, 49.8, 19.5 + bob, 3.8, 3.4, 'skin', lo=3, hi=5)
    c.put_ramp(50, 19 + bob, 'fire', 3)
    c.put_ramp(51, 20 + bob, 'fire', 2)
    ellipse(c, 32.5, 18 + bob, 2.2, 3.2, 'skin', lo=1, hi=4)
    c.rect(46, 14 + bob, 47, 15 + bob, 'coal', 1)
    for x in range(43, 51):
        c.put_ramp(x, 12 + bob, 'skin', 1)
        c.put_ramp(x, 13 + bob, 'skin', 1 if x > 44 else 2)
    for x in range(45, 51):
        c.put_ramp(x, 23 + bob, 'coal', 2)
    c.put_ramp(46, 24 + bob, 'bone', 5)
    for (hxx, hyy, hw) in ((35, 8, 3.4), (40, 6, 4.2), (45, 7.5, 3.6), (38, 4.5, 2.8)):
        ellipse(c, hxx, hyy + bob, hw, 2.8, 'grass', lo=2, hi=5)
    c.put_ramp(42, 3 + bob, 'gold', 5)
    c.put_ramp(43, 3 + bob, 'gold', 4)
    c.put_ramp(42, 2 + bob, 'bone', 5)
    # Vorderarm mit Baumstamm-Keule (Nagelbesetzt)
    cone(c, (65, 9 + bob), (53, 39 + bob), 11.5, 'wood', 1, 4)
    ellipse(c, 65, 9 + bob, 5.6, 2.4, 'wood', lo=3, hi=5)
    for (x, y) in ((63, 14), (67, 16), (62, 20), (65, 23), (60, 27)):
        c.put_ramp(x, y + bob, 'metal', 4)
        c.put_ramp(x + 1, y + 1 + bob, 'metal', 2)
    for (x, y) in ((61, 12), (66, 20), (58, 25)):
        c.put_ramp(x, y + bob, 'wood', 0)
        c.put_ramp(x, y + 1 + bob, 'wood', 0)
    thick_line(c, 40, 28 + bob, 50, 38 + bob, 8.6, 'skin', lo=2, hi=5)
    ellipse(c, 52, 40 + bob, 5.6, 5.2, 'skin', lo=2, hi=5)
    for (x, y) in ((50, 37), (53, 37), (54, 41)):
        c.put_ramp(x, y + bob, 'skin', 1)
    c.outline()
    return c


# =========================================================================== US-22 Kuchenfeuer (68 x 56)


def spr_cakefire(anim='idle', f=0):
    c = Canvas(72, 62)
    fl = [0, 1, 2, 1][f % 4]
    # Fluegel (Marzipan-rosa)
    W = (27, 20 + 4 * fl)
    tips = [(10, 13 + 5 * fl), (6, 27 + 3 * fl), (12, 38 + 2 * fl)]
    wing = [(34, 40), W, tips[0], (15, 23 + 4 * fl), tips[1], (12, 33 + 3 * fl), tips[2], (24, 44)]
    poly(c, wing, 'cloth', lo=1, hi=5)
    for q in tips:
        c.line(W[0], W[1], q[0], q[1], 'skin', 1)
    thick_line(c, 33, 40, W[0], W[1], 2.6, 'skin', lo=1, hi=4)
    # Schwanz mit Sahnetuepfel und Kirsche
    tail = bezier((22, 48), (12, 56), (4, 50), (7, 42), 12)
    strand(c, tail, 5.4, 'skin', lo=1, hi=4)
    for (x, y) in ((6, 39), (8, 37), (4, 38), (7, 36)):
        ellipse(c, x, y, 2.0, 1.8, 'bone', lo=3, hi=5)
    ellipse(c, 6, 34, 1.8, 1.8, 'fire', lo=2, hi=5)
    c.put_ramp(7, 32, 'leaf', 3)
    # Beine
    thick_line(c, 27, 53, 24, 58, 4.2, 'skin', lo=1, hi=3)
    for (x, y) in ((22, 59), (24, 60), (26, 60)):
        c.put_ramp(x, y, 'bone', 4)
    # Rumpf: dick wie ein Kuchenstueck, Sahne-Bauch
    ellipse(c, 34, 47, 14.5, 9.8, 'skin', lo=1, hi=5, ambient=0.15)
    ellipse(c, 36, 51.5, 12, 4.8, 'bone', lo=3, hi=5, clip=lambda x, y: y >= 50)
    for x in range(26, 46, 3):
        c.line(x, 51, x + 1, 55, 'cloth', 3)
    thick_line(c, 39, 53, 43, 58, 4.2, 'skin', lo=2, hi=5)
    for (x, y) in ((41, 59), (43, 60), (45, 60)):
        c.put_ramp(x, y, 'bone', 5)
    # Hals
    strand(c, bezier((42, 42), (49, 41), (50, 36), (52, 29), 10), 8.0, 'skin', lo=2, hi=5)
    # Zuckerguss-Wellen auf dem Ruecken
    for k in range(6):
        x = 25 + k * 3
        y = 38 + (0 if k < 3 else -2 * (k - 2))
        c.put_ramp(x, y, 'bone', 5)
        c.put_ramp(x + 1, y + 1, 'bone', 5)
        c.put_ramp(x, y + 1, 'bone', 4)
    # Kopf mit Hoernern; Maul weit auf (Gebruell)
    cone(c, (50, 24), (44, 15), 4.4, 'bone', 2, 5)
    ellipse(c, 55, 27, 8.4, 6.2, 'skin', lo=2, hi=5)
    ellipse(c, 62, 30, 5.2, 3.2, 'skin', lo=2, hi=5)
    ellipse(c, 60.5, 35.5, 5.6, 2.4, 'skin', lo=1, hi=4)
    poly(c, [(58, 31), (67, 31), (66, 34), (58, 35)], 'coal', flat=1)
    for x in range(59, 67, 3):
        c.rect(x, 31, x + 1, 32, 'bone', 5)
    for x in range(60, 66, 3):
        c.rect(x, 33, x + 1, 34, 'bone', 4)
    ellipse(c, 62, 33.6, 2.8, 1.0, 'fire', lo=2, hi=4)
    c.rect(55, 25, 56, 26, 'gold', 5)
    c.put_ramp(56, 26, 'coal', 1)
    c.put_ramp(65, 29, 'coal', 1)
    for x in range(53, 59):
        c.put_ramp(x, 24, 'skin', 1)
    # Papierkrone (gelb, drei Zacken) auf dem Kopf, darauf die Kerzen
    cr = [(49, 22), (61, 21), (61, 15), (58, 18), (55, 14), (52, 18), (49, 15)]
    poly(c, cr, 'gold', lo=2, hi=5)
    for (x, y, col, i) in ((51, 20, 'teamA', 3), (55, 19, 'ice', 4), (59, 20, 'leaf', 4)):
        c.rect(x, y, x + 1, y + 1, col, i)
    for (x, y, col) in ((49, 15, 'ice'), (55, 14, 'cloth'), (61, 15, 'leaf')):
        c.rect(x, y - 5, x + 1, y, col, 4)
        c.rect(x, y - 5, x, y, 'bone', 5)
    c.outline()
    # Flammen der Kerzen (ohne Umriss), wippend
    for (x, y) in ((49, 10), (55, 9), (61, 10)):
        c.put_ramp(x, y - 1, 'gold', 5)
        c.put_ramp(x + 1, y - 1, 'gold', 5)
        c.put_ramp(x, y - 2, 'gold', 4)
        c.put_ramp(x + 1, y - 2, 'gold', 5)
        c.put_ramp(x, y - 3, 'fire', 4)
        c.put_ramp(x + 1, y - 3, 'fire', 4)
        c.put_ramp(x + (f % 2), y - 4, 'fire', 3)
    # Streusel
    rnd = random.Random(9)
    for k in range(16):
        x, y = rnd.randint(22, 46), rnd.randint(40, 53)
        if c.alpha(x, y) and (x + y) % 2 == 0:
            c.put_ramp(x, y, rnd.choice(('gold', 'ice', 'leaf', 'cloth')), 5)
            c.put_ramp(x + 1, y, 'bone', 5)
    return c


# =========================================================================== US-23 Spiegel-Zwilling (40 x 46)


def _glint(c, x, y, ln, ramp='fur', idx=5):
    for k in range(ln):
        c.put_ramp(x + k, y + k, ramp, idx)


def spr_mirror_twin(anim='idle', f=0):
    c = Canvas(42, 46)
    st = [3, 0, -3, 0][f % 4]
    bob = [0, -1, 0, -1][f % 4]
    # Beine (Spiegelglas) + Schuhe
    thick_line(c, 16, 34 + bob, 13 - st, 43, 4.4, 'metal', lo=1, hi=4)
    ellipse(c, 12 - st, 44, 4.4, 1.9, 'metal', lo=2, hi=5)
    # Arm hinten
    thick_line(c, 13, 19 + bob, 7, 28 + bob, 3.2, 'metal', lo=1, hi=4)
    # Rumpf: schmaler ovaler Goldrahmen mit Spiegelglas
    gcx, gcy = 19, 26 + bob
    ellipse(c, gcx, gcy, 7.8, 13.2, 'gold', lo=1, hi=5, ambient=0.16)
    grx, gry = 5.6, 11.0
    for y in range(int(gcy - gry) - 1, int(gcy + gry) + 2):
        for x in range(int(gcx - grx) - 1, int(gcx + grx) + 2):
            d = ((x + 0.5 - gcx) / grx) ** 2 + ((y + 0.5 - gcy) / gry) ** 2
            if d <= 1.0:
                t = (y - (gcy - gry)) / (2 * gry)
                if t < 0.30:
                    ramp, idx = 'sky', (5 if (x + y) % 2 == 0 else 4)
                elif t < 0.56:
                    ramp, idx = 'sky', 3
                elif t < 0.62:
                    ramp, idx = 'metal', 5
                else:
                    ramp, idx = 'metal', (3 if (x + y) % 2 else 2)
                c.put_ramp(x, y, ramp, idx)
    # zwei breite Glanzdiagonalen (Spiegel-Signal)
    for k in range(9):
        for w in (0, 1):
            x, y = 15 + k + w, int(gcy - 9) + k
            if ((x - gcx) / grx) ** 2 + ((y - gcy) / gry) ** 2 < 0.9:
                c.put_ramp(x, y, 'fur', 5)
    for k in range(5):
        x, y = 19 + k, int(gcy - 3) + k
        if ((x - gcx) / grx) ** 2 + ((y - gcy) / gry) ** 2 < 0.9:
            c.put_ramp(x, y, 'fur', 5)
    # Rahmenzier: Krone oben, Fuss unten
    for (x, y, i) in ((19, 12, 5), (18, 13, 4), (20, 13, 4), (17, 14, 3), (21, 14, 3)):
        c.put_ramp(x, y + bob, 'gold', i)
    ellipse(c, 19, 12 + bob, 1.8, 1.8, 'gold', lo=3, hi=5)
    c.put_ramp(19, 12 + bob, 'fire', 4)
    # Bein vorn
    thick_line(c, 23, 35 + bob, 26 + st, 43, 4.4, 'metal', lo=2, hi=5)
    ellipse(c, 27 + st, 44, 4.6, 1.9, 'metal', lo=3, hi=5)
    # Kopf: spiegelnde Glatze mit Sprung
    ellipse(c, 20, 8 + bob, 5.8, 6.4, 'metal', lo=2, hi=5, ambient=0.3)
    for y in range(3, 10):
        c.put_ramp(21 + (y - 3) // 3, y + bob, 'sky', 4 if y < 7 else 3)
    _glint(c, 16, 4 + bob, 4, 'fur', 5)
    c.line(24, 4 + bob, 23, 8 + bob, 'metal', 1)
    c.line(23, 8 + bob, 25, 11 + bob, 'metal', 1)
    c.rect(22, 8 + bob, 22, 9 + bob, 'coal', 1)
    c.rect(25, 8 + bob, 25, 9 + bob, 'coal', 1)
    # Arm vorn mit Spiegelscherbe als Schwert
    thick_line(c, 26, 19 + bob, 33, 22 + bob, 3.2, 'metal', lo=2, hi=5)
    blade(c, (33, 22 + bob), (39, 10 + bob), 3.8, 'metal', 3, 5)
    _glint(c, 35, 16 + bob, 3, 'fur', 5)
    c.outline()
    # Funkeln
    for (x, y) in ((3, 12), (37, 33), (2, 38)):
        for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
            c.put_ramp(x + dx, y + dy, 'ice', i)
    return c
