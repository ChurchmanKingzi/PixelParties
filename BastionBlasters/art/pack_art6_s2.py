"""pack_art6, Sprites Teil 2: Gruft-Gaertnerin, Orakel-Kroete, Regenmacher-Schamane, Matrone Grosselfe, Schrott-Rudi, Opa Philosophenstein.
Alle Figuren blicken nach rechts. Nur 'idle' ist ausgearbeitet (f = Bewegungsphase)."""
from __future__ import annotations

from pack_art6_kit import *


# =========================================================================== UZ-14 Gruft-Gaertnerin (40 x 36)


def spr_crypt_gardener(anim='idle', f=0):
    c = Canvas(40, 36)
    bob = [0, -1][f % 2]
    # Schuhe + langer dunkler Rock
    for (x0, x1) in ((6, 11), (14, 19)):
        c.rect(x0, 34, x1, 35, 'coal', 2)
    robe(c, 13, 18 + bob, 33, 5.5, 9.5, 'coal', lo=1, hi=4, hem=False)
    for y in range(26, 33):
        c.put_ramp(9, y, 'coal', 2 if y % 2 else 1)
        c.put_ramp(16, y, 'coal', 1)
    # Schuerze (Gruen) mit Tasche und Kelle
    poly(c, [(9, 20 + bob), (17, 20 + bob), (18, 31), (8, 31)], 'leaf', lo=1, hi=4)
    c.rect(11, 25, 15, 27, 'leaf', 2)
    c.rect(11, 25, 15, 25, 'leaf', 4)
    c.rect(14, 22, 14, 25, 'metal', 4)
    c.put_ramp(14, 21, 'metal', 5)
    for x in range(9, 18):
        c.put_ramp(x, 21 + bob, 'leaf', 1)
    # Zopf + Haar
    thick_line(c, 9, 12 + bob, 6, 24 + bob, 2.8, 'coal', lo=1, hi=3)
    c.put_ramp(6, 22 + bob, 'leaf', 4)
    c.put_ramp(7, 22 + bob, 'leaf', 3)
    ellipse(c, 8.5, 10 + bob, 3.4, 3.8, 'coal', lo=1, hi=4)
    # Kopf: blass
    ellipse(c, 14.5, 12 + bob, 4.4, 4.4, 'bone', lo=3, hi=5)
    eye(c, 16, 11 + bob)
    c.put_ramp(17, 14 + bob, 'bone', 2)
    c.put_ramp(18, 14 + bob, 'bone', 2)
    # Hut: schwarz, breite Krempe, Rose
    ellipse(c, 14, 8 + bob, 10.2, 2.8, 'coal', lo=1, hi=4)
    ellipse(c, 14, 8 + bob, 5.6, 5.6, 'coal', lo=1, hi=4, clip=lambda x, y: y <= 7 + bob)
    for x in range(9, 20):
        c.put_ramp(x, 6 + bob, 'leaf', 2 if x % 2 else 1)
    ellipse(c, 9.5, 5 + bob, 2.0, 2.0, 'teamA', lo=2, hi=5)
    c.put_ramp(9, 4 + bob, 'teamA', 5)
    c.put_ramp(10, 5 + bob, 'teamA', 1)
    c.put_ramp(7, 6 + bob, 'leaf', 4)
    c.put_ramp(8, 7 + bob, 'leaf', 3)
    # Schaedel-Giesskanne: Schaedel als Kannenkoerper, Henkel oben, lange Tuelle
    thick_line(c, 18, 21 + bob, 23, 17 + bob, 3.4, 'coal', lo=1, hi=4)
    sx, sy = 27, 22 + bob
    thick_line(c, 31, 25 + bob, 36, 28 + bob, 2.4, 'metal', lo=1, hi=4)
    ellipse(c, 37, 29 + bob, 2.4, 1.8, 'metal', lo=2, hi=5)
    ellipse(c, sx, sy, 6.4, 5.8, 'bone', lo=2, hi=5, ambient=0.3)
    c.rect(sx - 4, sy + 4, sx + 3, sy + 7, 'bone', 3)
    for x in range(sx - 4, sx + 4):
        c.put_ramp(x, sy + 7, 'bone', 1)
        if x % 2 == 0:
            c.put_ramp(x, sy + 5, 'bone', 1)
    for (ex, ey) in ((sx - 3, sy - 1), (sx + 1, sy - 1)):
        c.rect(ex, ey, ex + 2, ey + 2, 'coal', 1)
    c.put_ramp(sx - 1, sy + 2, 'coal', 1)
    c.put_ramp(sx, sy + 2, 'coal', 1)
    thick_line(c, sx - 5, sy - 3, sx - 3, sy - 8, 1.4, 'metal', lo=2, hi=4)
    thick_line(c, sx - 3, sy - 8, sx + 2, sy - 8, 1.4, 'metal', lo=2, hi=4)
    thick_line(c, sx + 2, sy - 8, sx + 4, sy - 4, 1.4, 'metal', lo=2, hi=4)
    hand(c, 22, 15 + bob, 'bone', 4)
    for (x, y) in ((38, 31), (37, 33), (39, 34), (36, 35)):
        c.put_ramp(x, y + bob, 'ice', 4)
        c.put_ramp(x, y + 1 + bob, 'ice', 3)
    c.outline()
    return c


# =========================================================================== UZ-15 Orakel-Kroete (36 x 32)


def spr_oracle_toad(anim='idle', f=0):
    c = Canvas(36, 32)
    sh = [0, -1][f % 2]
    # Hinterbeine (zusammengekauert) + Schwimmfuesse
    ellipse(c, 6.5, 26, 5.6, 4.2, 'leaf', lo=1, hi=3)
    for x in (1, 3, 5):
        c.rect(x, 29, x + 1, 30, 'leaf', 2)
    ellipse(c, 20, 27, 5.0, 3.2, 'leaf', lo=1, hi=3)
    for x in (22, 24, 26):
        c.rect(x, 29, x + 1, 30, 'leaf', 3)
    # Koerper + Bauch
    ellipse(c, 14.5, 23, 11.0, 7.6, 'leaf', lo=1, hi=4, ambient=0.15)
    ellipse(c, 18, 26.5, 6.4, 3.6, 'bone', lo=2, hi=4, ambient=0.3)
    for (x, y) in ((8, 21), (12, 19), (6, 25), (16, 21), (10, 24), (20, 22)):
        c.put_ramp(x, y, 'leaf', 4)
        c.put_ramp(x + 1, y, 'leaf', 3)
        c.put_ramp(x, y + 1, 'leaf', 1)
    for (x, y) in ((9, 22), (14, 23), (5, 22)):
        c.put_ramp(x, y, 'dirt', 3)
    # Kopf: flach und breit, Glubschaugen
    ellipse(c, 16.5, 16.5, 9.4, 5.8, 'leaf', lo=2, hi=5, ambient=0.2)
    for x in range(8, 26):
        yy = 19 + (1 if x < 10 or x > 23 else 0) - (1 if 14 < x < 20 else 0)
        c.put_ramp(x, yy + 1, 'leaf', 0)
    c.put_ramp(8, 19, 'leaf', 0)
    c.put_ramp(25, 19, 'leaf', 0)
    for (ex, ey) in ((12, 12 + sh), (21, 12 + sh)):
        ellipse(c, ex, ey, 3.6, 3.6, 'leaf', lo=2, hi=5)
        c.rect(ex - 1, ey, ex + 1, ey + 1, 'gold', 4)
        c.put_ramp(ex + 1, ey, 'coal', 1)
        c.put_ramp(ex + 1, ey + 1, 'coal', 1)
        c.rect(ex - 2, ey - 1, ex + 2, ey - 1, 'leaf', 1)      # schweres Lid
    # Turban: Wickel, Edelstein, Feder
    ellipse(c, 16.5, 5 + sh, 8.4, 5.2, 'teamA', lo=1, hi=4, ambient=0.2)
    for k in range(5):
        c.line(8 + k * 3, 8 + sh, 12 + k * 3, 1 + sh, 'teamA', 1 if k % 2 else 4)
    for x in range(8, 25):
        c.put_ramp(x, 9 + sh, 'teamA', 1)
    c.rect(8, 8 + sh, 24, 8 + sh, 'teamA', 3)
    ellipse(c, 16.5, 7.5 + sh, 2.2, 2.0, 'gold', lo=3, hi=5)
    c.put_ramp(16, 7 + sh, 'ice', 5)
    c.put_ramp(17, 8 + sh, 'ice', 4)
    for (x, y, i) in ((18, 4, 5), (19, 2, 5), (20, 1, 4), (21, 0, 5), (22, 0, 4), (22, 1, 3)):
        c.put_ramp(x, y + sh, 'bone', i)
    # Kristallkugel auf goldenem Sockel
    ellipse(c, 28, 29.5, 5.0, 2.0, 'gold', lo=2, hi=4)
    c.rect(24, 28, 31, 28, 'gold', 3)
    bx, by = 28, 22
    ellipse(c, bx, by, 7.2, 7.2, 'ice', lo=1, hi=5, ambient=0.2)
    for (x, y, i) in ((26, 20, 'purple'), (27, 21, 'purple'), (28, 22, 'purple'), (29, 23, 'purple'), (30, 24, 'purple')):
        c.put_ramp(x, y, i, 3 if (x + y) % 2 else 4)
    ellipse(c, 28.5, 23, 2.4, 2.4, 'purple', lo=3, hi=5)
    c.put_ramp(28, 22, 'bone', 5)
    for (x, y) in ((24, 18), (25, 17), (24, 17), (23, 19)):
        c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(31, 25, 'ice', 5)
    c.put_ramp(32, 24, 'ice', 5)
    # Vorderpfoten auf der Kugel
    for (hx, hy) in ((21, 24), (22, 28)):
        thick_line(c, 17, 25, hx, hy, 2.8, 'leaf', lo=2, hi=4)
        c.rect(hx, hy - 1, hx + 2, hy + 1, 'leaf', 4)
        c.put_ramp(hx + 3, hy, 'leaf', 3)
    c.outline()
    return c


# =========================================================================== UZ-16 Regenmacher-Schamane (38 x 40)


def spr_rainmaker_shaman(anim='idle', f=0):
    c = Canvas(38, 40)
    hop = [0, -1][f % 2]
    # Standbein links (gerade) und Tanzbein rechts (Knie hoch)
    thick_line(c, 14, 29, 13, 36, 3.2, 'dirt', lo=1, hi=3)
    thick_line(c, 19, 29, 29, 28 + hop, 3.4, 'dirt', lo=2, hi=4)
    thick_line(c, 29, 28 + hop, 26, 34 + hop, 3.0, 'dirt', lo=2, hi=4)
    shoes(c, 22, 29, 35 + hop, 'wood', 4)
    shoes(c, 9, 15, 37, 'wood', 3)
    for (x, y) in ((30, 37), (32, 36), (33, 38)):
        c.put_ramp(x, y, 'dirt', 4)
    # Federrock (gold-orange Fransen)
    for k in range(9):
        x = 9 + k * 2
        L = 30 + (k % 2) * 2
        thick_line(c, x, 27, x - 1 + (k // 4), L, 2.0, 'gold', lo=2 if k % 2 else 1, hi=4 if k % 2 else 3)
    # Poncho mit Zickzack
    poly(c, [(8, 16 + hop), (24, 16 + hop), (26, 28 + hop), (6, 28 + hop)], 'fire', lo=1, hi=4)
    for x in range(7, 26):
        c.put_ramp(x, 23 + hop, 'bone', 5 if x % 4 < 2 else 3)
        c.put_ramp(x, 24 + hop, 'bone', 3 if x % 4 < 2 else 4)
    for x in range(7, 26, 2):
        c.put_ramp(x, 28 + hop, 'fire', 4)
    c.put_ramp(16, 20 + hop, 'gold', 5)
    c.put_ramp(15, 21 + hop, 'gold', 4)
    c.put_ramp(17, 21 + hop, 'gold', 4)
    # Arme hoch: links Rassel, rechts Regenstab
    thick_line(c, 9, 18 + hop, 4, 12 + hop, 2.6, 'dirt', lo=1, hi=3)
    ellipse(c, 3.5, 8 + hop, 3.0, 3.8, 'gold', lo=2, hi=5)
    c.put_ramp(3, 6 + hop, 'gold', 5)
    c.rect(3, 12 + hop, 4, 13 + hop, 'wood', 2)
    thick_line(c, 23, 18 + hop, 29, 12 + hop, 2.6, 'dirt', lo=2, hi=4)
    thick_line(c, 27, 14 + hop, 34, 5 + hop, 2.6, 'wood', lo=2, hi=5)
    for k in range(4):
        c.put_ramp(30 + k * 2 - 1, 11 - k * 2 + 1 + hop, 'wood', 1)
    c.put_ramp(35, 3 + hop, 'ice', 5)
    c.put_ramp(36, 5 + hop, 'ice', 4)
    # Kopf: Gesichtsbemalung, Federband, Wolkenhut
    ellipse(c, 16, 14 + hop, 4.2, 4.0, 'dirt', lo=2, hi=5)
    c.line(16, 14 + hop, 19, 16 + hop, 'bone', 5)
    c.put_ramp(19, 14 + hop, 'fire', 3)
    eye(c, 18, 12 + hop)
    for x in range(11, 22):
        c.put_ramp(x, 10 + hop, 'fire', 3 if x % 2 else 2)
    for (x, y, r, i) in ((10, 11, 'leaf', 4), (9, 12, 'leaf', 3), (8, 13, 'leaf', 3), (11, 12, 'fire', 4)):
        c.put_ramp(x, y + hop, r, i)
    # Wolke: aufgeplusterte Haufenwolke, dunkle Unterseite
    for (cx, cy, rx, ry, lo, hi) in ((8, 7.5, 4.6, 3.6, 1, 4), (25, 7.5, 5.0, 3.8, 1, 4), (12, 4.5, 5.0, 3.6, 2, 5),
                                      (20, 4, 5.4, 3.8, 2, 5), (16.5, 7.5, 8.4, 3.4, 1, 4)):
        ellipse(c, cx, cy + hop, rx, ry, 'stone', lo=lo, hi=hi, ambient=0.18)
    for (x, y) in ((10, 2), (11, 2), (12, 3), (19, 1), (20, 1), (7, 6), (8, 6), (24, 6)):
        c.put_ramp(x, y + hop, 'fur', 5 if (x + y) % 2 else 4)
    for x in range(5, 29):
        c.put_ramp(x, 10 + hop, 'stone', 0 if x % 2 else 1)
        if x % 3 == 0:
            c.put_ramp(x, 11 + hop, 'stone', 0)
    # Regentropfen
    for (x, y) in ((6, 15), (29, 17), (11, 20), (31, 22), (3, 22), (33, 11), (5, 30)):
        c.put_ramp(x, y + (f % 2) * 2, 'sky', 4)
        c.put_ramp(x, y + 1 + (f % 2) * 2, 'sky', 5)
    c.outline()
    return c


# =========================================================================== UZ-17 Matrone Grosselfe (36 x 36)


def spr_granny_elf(anim='idle', f=0):
    c = Canvas(36, 36)
    bob = [0, -1][f % 2]
    # Wollknaeuel am Boden mit Faden
    ellipse(c, 29, 31.5, 3.8, 3.8, 'teamA', lo=1, hi=5, ambient=0.25)
    for (x, y) in ((27, 30), (28, 33), (30, 31), (31, 33)):
        c.put_ramp(x, y, 'teamA', 2)
    c.line(27, 29, 30, 34, 'teamA', 2)
    # Schuhe + weiter gruener Rock
    for (x0, x1) in ((6, 11), (14, 20)):
        c.rect(x0, 34, x1, 35, 'wood', 2)
        c.rect(x0, 34, x0 + 1, 34, 'wood', 4)
    robe(c, 13, 18 + bob, 33, 6.5, 10.5, 'leaf', lo=1, hi=4, hem=False)
    for y in range(24, 33):
        c.put_ramp(8, y, 'leaf', 1)
        c.put_ramp(14, y, 'leaf', 2 if y % 2 else 1)
    # Schuerze + Tasche
    poly(c, [(9, 22 + bob), (18, 22 + bob), (19, 33), (8, 33)], 'bone', lo=3, hi=5)
    c.rect(11, 27, 16, 30, 'bone', 3)
    c.rect(11, 27, 16, 27, 'bone', 5)
    for x in range(8, 20):
        c.put_ramp(x, 33, 'bone', 2)
    # Schultertuch (Karmin) + Quaste
    poly(c, [(6, 17 + bob), (20, 17 + bob), (13, 25 + bob)], 'teamA', lo=1, hi=4)
    for k in range(5):
        c.put_ramp(8 + k * 3, 20 + bob - (k % 2), 'teamA', 4)
    c.put_ramp(13, 26 + bob, 'gold', 4)
    # Kopf, lange Elfenohren, Dutt, Brille
    poly(c, [(11, 10 + bob), (0, 4 + bob), (1, 7 + bob), (11, 13 + bob)], 'skin', lo=2, hi=5)
    c.put_ramp(4, 6 + bob, 'skin', 1)
    c.put_ramp(5, 7 + bob, 'skin', 1)
    ellipse(c, 15, 11 + bob, 4.4, 4.4, 'skin', lo=3, hi=5)
    ellipse(c, 12, 10 + bob, 3.6, 4.2, 'fur', lo=2, hi=4)
    ellipse(c, 14, 7 + bob, 5.0, 3.0, 'fur', lo=3, hi=5, clip=lambda x, y: y <= 8 + bob)
    ellipse(c, 12.5, 4 + bob, 3.0, 2.8, 'fur', lo=3, hi=5)
    c.put_ramp(12, 3 + bob, 'fur', 5)
    c.put_ramp(11, 4 + bob, 'fur', 5)
    c.put_ramp(14, 5 + bob, 'metal', 4)
    c.put_ramp(15, 5 + bob, 'metal', 3)
    c.rect(17, 10 + bob, 19, 12 + bob, 'metal', 4)
    c.put_ramp(18, 11 + bob, 'skin', 4)
    c.put_ramp(18, 11 + bob, 'coal', 1)
    for x in range(14, 17):
        c.put_ramp(x, 11 + bob, 'metal', 3)
    c.put_ramp(17, 15 + bob, 'skin', 2)
    c.put_ramp(18, 15 + bob, 'skin', 2)
    # Strickzeug: zwei Nadeln kreuzen, Strickstueck haengt herab
    for x in range(21, 28):
        for y in range(22 + bob, 33):
            idx = 3 if (x + y) % 2 == 0 else 2
            if (y - bob) % 3 == 0:
                idx = 1 if (x % 2) else 4
            c.put_ramp(x, y, 'teamA', idx)
    c.rect(21, 22 + bob, 27, 22 + bob, 'bone', 4)
    thick_line(c, 14, 26 + bob, 29, 12 + bob, 1.4, 'wood', lo=3, hi=5)
    thick_line(c, 15, 15 + bob, 29, 24 + bob, 1.4, 'bone', lo=3, hi=5)
    for (x, y) in ((30, 11), (31, 10), (30, 25)):
        c.put_ramp(x, y + bob, 'gold', 4)
    c.put_ramp(31, 11 + bob, 'gold', 5)
    c.put_ramp(30, 25 + bob, 'gold', 5)
    thick_line(c, 9, 19 + bob, 15, 26 + bob, 3.0, 'teamA', lo=1, hi=3)
    thick_line(c, 15, 19 + bob, 16, 16 + bob, 3.0, 'teamA', lo=2, hi=4)
    hand(c, 15, 26 + bob, 'skin', 4)
    hand(c, 15, 14 + bob, 'skin', 4)
    c.outline()
    return c


# =========================================================================== UZ-18 Schrott-Rudi (40 x 40)


def spr_scrap_rudy(anim='idle', f=0):
    c = Canvas(40, 40)
    bob = [0, -1][f % 2]
    # Beine: links Spiralfeder, rechts Farbeimer; grosse Rostplatten als Fuesse
    for k in range(8):
        y = 30 + k
        x = 10 + (3 if k % 2 else -3)
        c.line(11, y, x + 1, y, 'metal', 3 if k % 2 else 2)
        c.line(x + 1, y, 11, y + 1, 'metal', 4 if k % 2 else 1)
    c.rect(6, 37, 15, 38, 'dirt', 2)
    c.rect(6, 37, 15, 37, 'dirt', 4)
    c.rect(6, 39, 15, 39, 'dirt', 1)
    round_rect(c, 17, 30, 24, 37, 'metal', lo=1, hi=4, radius=1)
    c.rect(17, 31, 24, 31, 'metal', 5)
    for y in (33, 35):
        c.rect(17, y, 24, y, 'metal', 1)
    c.put_ramp(24, 31, 'metal', 2)
    c.rect(15, 37, 26, 38, 'dirt', 3)
    c.rect(15, 37, 26, 37, 'dirt', 5)
    c.rect(15, 39, 26, 39, 'dirt', 1)
    # Rumpf: verbeulte Muelltonne mit Rippen, Rost, Manometer
    round_rect(c, 8, 16 + bob, 24, 31, 'metal', lo=1, hi=4, radius=2)
    for x in (11, 14, 17, 20):
        for y in range(18 + bob, 30):
            c.put_ramp(x, y, 'metal', 1 if y % 2 else 2)
    c.rect(7, 15 + bob, 25, 17 + bob, 'metal', 4)
    c.rect(7, 15 + bob, 25, 15 + bob, 'metal', 5)
    c.rect(8, 17 + bob, 25, 17 + bob, 'metal', 1)
    dither(c, 8, 26, 14, 31, 'dirt', 2, 3)
    dither(c, 19, 28, 24, 31, 'dirt', 1, 2, 1)
    for (x, y) in ((16, 19), (18, 24), (12, 22)):
        c.put_ramp(x, y + bob, 'metal', 5)
    ellipse(c, 15.5, 22.5 + bob, 3.2, 3.2, 'bone', lo=3, hi=5)
    c.line(15, 23 + bob, 17, 21 + bob, 'fire', 3)
    c.put_ramp(14, 22 + bob, 'coal', 1)
    # Auspuff mit Rauch
    c.rect(5, 12 + bob, 8, 16 + bob, 'metal', 2)
    c.rect(4, 11 + bob, 9, 12 + bob, 'metal', 3)
    for (x, y, i) in ((5, 8, 4), (6, 7, 5), (4, 5, 3), (5, 4, 4), (7, 2, 3), (8, 1, 4)):
        c.put_ramp(x, y + bob, 'bone', i)
        c.put_ramp(x + 1, y + bob, 'bone', i - 1)
    # Kopf: Blechkasten mit Augenlampen, Stahlwolle-Brauen und Schnurrbart
    round_rect(c, 10, 5 + bob, 22, 14 + bob, 'metal', lo=2, hi=5, radius=2)
    c.rect(12, 8 + bob, 21, 11 + bob, 'coal', 2)
    for (ex, ey) in ((14, 9), (19, 9)):
        c.rect(ex, ey + bob, ex + 2, ey + 1 + bob, 'gold', 4)
        c.put_ramp(ex, ey + bob, 'bone', 5)
    for x in range(13, 21):
        c.put_ramp(x, 7 + bob, 'bone', 4 if x % 2 else 3)
        if x % 3 == 0:
            c.put_ramp(x, 6 + bob, 'bone', 5)
    for x in range(14, 23):
        c.put_ramp(x, 12 + bob, 'bone', 4 if x % 2 else 5)
        c.put_ramp(x, 13 + bob, 'bone', 3 if x % 2 else 2)
    c.put_ramp(23, 13 + bob, 'bone', 4)
    for (x, y) in ((11, 6), (21, 6), (11, 13), (21, 13)):
        c.put_ramp(x, y + bob, 'gold', 5)
    # Muelleimer-Deckel schief als Hut + Antenne
    ellipse(c, 16, 4 + bob, 9.0, 2.6, 'metal', lo=2, hi=5)
    c.rect(14, 1 + bob, 18, 2 + bob, 'metal', 4)
    c.rect(14, 1 + bob, 18, 1 + bob, 'metal', 5)
    c.put_ramp(12, 3 + bob, 'dirt', 3)
    c.put_ramp(20, 5 + bob, 'dirt', 2)
    thick_line(c, 22, 5 + bob, 26, 1 + bob, 1.0, 'metal', lo=3, hi=4)
    ellipse(c, 27, 1 + bob, 1.6, 1.6, 'fire', lo=3, hi=5)
    # Arme: linker Schlauch mit Klaue, rechter Schlauch mit riesigem Maulschluessel
    for k in range(6):
        c.put_ramp(8 - k // 2, 20 + k + bob, 'coal', 3 if k % 2 else 2)
        c.put_ramp(9 - k // 2, 20 + k + bob, 'coal', 2)
    thick_line(c, 7, 26 + bob, 5, 30 + bob, 2.6, 'metal', lo=1, hi=4)
    c.put_ramp(3, 31 + bob, 'metal', 4)
    c.put_ramp(4, 32 + bob, 'metal', 3)
    c.put_ramp(6, 32 + bob, 'metal', 3)
    for k in range(5):
        c.put_ramp(24 + k, 20 + k // 2 + bob, 'coal', 3 if k % 2 else 2)
        c.put_ramp(24 + k, 21 + k // 2 + bob, 'coal', 2)
    thick_line(c, 29, 22 + bob, 34, 11 + bob, 2.6, 'metal', lo=2, hi=5)
    ellipse(c, 35, 9 + bob, 3.6, 3.6, 'metal', lo=2, hi=5)
    c.rect(34, 5 + bob, 35, 8 + bob, 'coal', 1)
    c.put_ramp(35, 9 + bob, 'coal', 1)
    c.rect(28, 22 + bob, 31, 24 + bob, 'metal', 3)
    c.outline()
    return c


# =========================================================================== UZ-19 Opa Philosophenstein (40 x 42)


def steam_hair(base, bob, f):
    """Haare aus Dampf: Schwaden-Fluegel links und rechts wie wilde Haare, drei Dampf-Wellen steigen darueber auf.
    Eigene Ebene mit weicher grauer Outline, damit der Dampf leicht wirkt. Liefert die Figur um 7 px nach unten versetzt."""
    dy = 7
    c = Canvas(base.w, base.h + dy)
    c.blit(base, 0, dy)
    st = Canvas(c.w, c.h)
    for (x, y, r) in ((8, 9, 3.0), (6, 5, 2.4), (9, 3, 2.0), (22, 8, 2.8), (24, 4, 2.4), (21, 2, 1.9)):
        ellipse(st, x, y + dy + bob + (1 if (x + f) % 2 else 0), r, r * 0.92, 'bone', lo=3, hi=5, ambient=0.35)
    ellipse(st, 15, 5 + dy + bob, 5.4, 3.0, 'bone', lo=3, hi=5, ambient=0.35)
    for (x0, ln, ph) in ((11, 11, 0.0), (15, 14, 2.1), (19, 11, 4.2)):
        ph += f * 0.6
        for k in range(ln):
            xx = x0 + math.sin(k * 0.8 + ph) * 1.8
            yy = 8 + dy - k * 0.9 + bob
            if k >= ln - 3 and k % 2:
                continue
            xi = int(round(xx))
            st.put_ramp(xi, int(round(yy)), 'bone', 5)
            st.put_ramp(xi + 1, int(round(yy)), 'bone', 4)
    st.outline(dark=2, lit=3)
    for y in range(c.h):
        for x in range(c.w):
            if st.px[y, x, 3] and not c.px[y, x, 3]:
                c.px[y, x] = st.px[y, x]
                c.rid[y, x] = st.rid[y, x]
    return c


def spr_grandpa_philosopher(anim='idle', f=0):
    c = Canvas(40, 42)
    bob = [0, -1][f % 2]
    # Schuhe + langes blaues Gewand mit Goldsaum
    for (x0, x1) in ((6, 12), (15, 21)):
        c.rect(x0, 40, x1, 41, 'wood', 2)
        c.rect(x0, 40, x0 + 2, 40, 'wood', 4)
    robe(c, 14, 20 + bob, 39, 6.5, 11.5, 'ice', lo=1, hi=4, hem=False)
    for x in range(3, 26):
        c.put_ramp(x, 38, 'gold', 4 if x % 2 else 3)
        c.put_ramp(x, 39, 'gold', 2)
    for y in range(28, 38):
        c.put_ramp(9, y, 'ice', 1)
        c.put_ramp(17, y, 'ice', 2 if y % 2 else 1)
    for (x, y) in ((8, 30), (19, 33), (12, 35)):
        c.put_ramp(x, y, 'gold', 5)
        c.put_ramp(x - 1, y, 'gold', 3)
        c.put_ramp(x + 1, y, 'gold', 3)
        c.put_ramp(x, y - 1, 'gold', 3)
        c.put_ramp(x, y + 1, 'gold', 3)
    # Schultern
    ellipse(c, 14, 21 + bob, 8.0, 3.4, 'ice', lo=2, hi=4)
    # langer weisser Bart
    poly(c, [(9, 15 + bob), (21, 15 + bob), (20, 26 + bob), (15, 33 + bob), (10, 26 + bob)], 'bone', lo=3, hi=5)
    for (x, y) in ((12, 22), (15, 26), (17, 20), (13, 29), (18, 24), (11, 18)):
        c.put_ramp(x, y + bob, 'bone', 2)
    # Kopf: Nase, buschige Braue
    ellipse(c, 15, 11 + bob, 4.6, 4.4, 'skin', lo=2, hi=5)
    ellipse(c, 19.5, 12 + bob, 1.8, 1.7, 'skin', lo=3, hi=5)
    c.put_ramp(20, 12 + bob, 'skin', 2)
    c.rect(17, 9 + bob, 20, 9 + bob, 'bone', 5)
    c.put_ramp(16, 10 + bob, 'bone', 4)
    eye(c, 18, 10 + bob, 1)
    c.put_ramp(18, 11 + bob, 'coal', 1)
    for x in range(14, 21):
        c.put_ramp(x, 14 + bob, 'bone', 5 if x % 2 else 4)
    # Dampf-Haare werden nach der Outline als weiche Schwaden gemalt (kein dunkler Rand)
    # Arme + gläserne Kugel mit rotem Stein
    thick_line(c, 20, 21 + bob, 26, 28 + bob, 3.6, 'ice', lo=2, hi=4)
    c.rect(25, 27 + bob, 27, 28 + bob, 'gold', 4)
    thick_line(c, 8, 22 + bob, 10, 29 + bob, 3.4, 'ice', lo=1, hi=3)
    ox, oy = 31, 26 + bob
    ellipse(c, ox, oy, 8.2, 8.0, 'ice', lo=3, hi=5, ambient=0.25)
    for (x, y) in ((27, 21), (28, 20), (26, 22), (27, 20)):
        c.put_ramp(x, y, 'bone', 5)
    for k in range(10):
        a = math.radians(40 + k * 14)
        x, y = int(round(ox + math.cos(a) * 6.5)), int(round(oy + math.sin(a) * 6.3))
        c.put_ramp(x, y, 'ice', 2)
    # roter Stein (Raute mit Facetten) im Glas
    poly(c, [(ox, oy - 4), (ox + 3, oy), (ox, oy + 4), (ox - 3, oy)], 'fire', lo=1, hi=4, flat=2)
    poly(c, [(ox, oy - 4), (ox, oy + 4), (ox - 3, oy)], 'fire', flat=3)
    poly(c, [(ox, oy - 4), (ox - 1, oy - 1), (ox - 3, oy)], 'fire', flat=4)
    c.put_ramp(ox - 1, oy - 2, 'gold', 5)
    c.line(ox, oy - 4, ox, oy + 4, 'fire', 1)
    sparkle(c, ox + 6, oy - 8, 'gold', big=False)
    c.rect(ox - 4, oy + 7, ox + 4, oy + 8, 'gold', 3)
    c.outline()
    return steam_hair(c, bob, f)
