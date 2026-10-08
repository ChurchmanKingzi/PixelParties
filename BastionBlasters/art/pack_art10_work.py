"""pack_art10: Kantine 'Zum Taumelnden Troll' (BU-02) und Reparaturwerkstatt (BU-03): Sprites und Raum-Themen."""
from __future__ import annotations

from pack_art10_kit import *


# =========================================================================== Kantine


def troll():
    """schunkelnder Troll: grosser Bauch, Schuerze, Humpen, Hauer, Schwindelsterne. Blick nach rechts, 40 x 46"""
    c = Canvas(40, 46)
    # Beine (breit, taumelnd)
    thick_line(c, 14, 31, 10, 41, 6.4, 'slime', lo=1, hi=3)
    thick_line(c, 24, 31, 30, 41, 6.4, 'slime', lo=2, hi=4)
    ellipse(c, 9, 43, 5.4, 2.6, 'slime', lo=0, hi=3)
    ellipse(c, 31, 43, 6.0, 2.6, 'slime', lo=2, hi=4)
    for x in (5, 8, 11):
        c.put_ramp(x, 44, 'bone', 3)
    for x in (28, 31, 34):
        c.put_ramp(x, 44, 'bone', 4)
    # Lendenschurz
    poly(c, [(11, 30), (28, 30), (30, 36), (9, 36)], 'wood', lo=1, hi=3)
    # Bauch und Brust
    ellipse(c, 19.5, 24, 12.5, 10.5, 'slime', lo=1, hi=4)
    # Schuerze mit Suppenflecken
    poly(c, [(12, 17), (27, 17), (28, 31), (11, 31)], 'bone', lo=2, hi=5)
    c.rect(12, 17, 27, 17, 'bone', 5)
    for (x, y, w_, col, i) in ((14, 21, 3, 'fire', 3), (21, 24, 4, 'gold', 3), (16, 27, 3, 'fire', 2), (24, 20, 2, 'leaf', 3), (19, 18, 2, 'dirt', 3)):
        c.rect(x, y, x + w_ - 1, y + 1, col, i)
    c.rect(18, 30, 24, 30, 'bone', 2)
    # Nabel-Knopf
    c.put_ramp(19, 22, 'gold', 5)
    # rechter Arm hoch mit Humpen
    thick_line(c, 28, 21, 33, 12, 5.0, 'slime', lo=2, hi=4)
    round_rect(c, 31, 1, 39, 12, 'wood', lo=1, hi=4, radius=1)
    c.rect(31, 4, 39, 4, 'metal', 3)
    c.rect(31, 9, 39, 9, 'metal', 2)
    c.rect(37, 3, 40, 3, 'wood', 4)
    c.rect(40, 3, 40, 9, 'wood', 3)
    for (x, y) in ((32, 0), (34, 0), (36, 0), (38, 0), (33, 1), (35, 1), (37, 1)):      # Schaum
        c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(31, 12, 'slime', 4)
    ellipse(c, 33, 13, 2.6, 2.4, 'slime', lo=2, hi=5)
    # linker Arm mit Kelle
    thick_line(c, 10, 21, 5, 29, 5.0, 'slime', lo=1, hi=3)
    thick_line(c, 5, 29, 3, 17, 1.6, 'wood', lo=2, hi=4)
    ellipse(c, 3, 15.5, 3.0, 2.6, 'metal', lo=1, hi=5)
    c.put_ramp(3, 16, 'fire', 3)
    # Kopf
    ellipse(c, 21, 10, 7.4, 6.4, 'slime', lo=2, hi=5)
    poly(c, [(14, 8), (7, 3), (15, 13)], 'slime', lo=1, hi=3)           # Ohr
    c.put_ramp(9, 5, 'skin', 3)
    ellipse(c, 28.5, 12, 3.2, 2.8, 'slime', lo=3, hi=5)                 # Knollennase
    c.put_ramp(29, 12, 'slime', 1)
    c.put_ramp(30, 12, 'slime', 1)
    # schlaefriges Auge + Schwindel
    c.rect(24, 8, 25, 9, 'coal', 1)
    c.put_ramp(24, 8, 'bone', 5)
    c.rect(23, 7, 26, 7, 'slime', 1)
    for x in range(21, 29):                                              # Mund (schief)
        c.put_ramp(x, 15 if x < 26 else 14, 'coal', 1)
    # Hauer
    c.rect(24, 14, 25, 17, 'bone', 5)
    c.put_ramp(24, 17, 'bone', 3)
    c.rect(21, 14, 21, 16, 'bone', 4)
    # Haarsträhnen
    for (x, y) in ((17, 3), (20, 2), (23, 3)):
        c.rect(x, y, x, y + 1, 'coal', 2)
    c.outline()
    return c


def swirl_stars(c, cx, cy, r=9, n=3):
    for k in range(n):
        a = k * 2 * math.pi / n
        sparkle(c, int(cx + math.cos(a) * r), int(cy + math.sin(a) * r * 0.45), 'gold')


def soup_barrel():
    """Suppenfass mit Zapfhahn, offener Deckel, dampfend, 20 x 28"""
    c = Canvas(20, 28)
    round_rect(c, 1, 8, 18, 26, 'wood', lo=1, hi=4, radius=4)
    ellipse(c, 9.5, 8.5, 8.4, 3.0, 'wood', lo=0, hi=2)
    ellipse(c, 9.5, 8.5, 7.0, 2.2, 'fire', lo=2, hi=4)              # Suppe
    for (x, y) in ((6, 8), (9, 9), (12, 8)):
        c.put_ramp(x, y, 'gold', 5)
    for y in (13, 21):
        for x in range(1, 19):
            c.put_ramp(x, y, 'metal', 2 if x > 9 else 3)
            c.put_ramp(x, y + 1, 'metal', 1)
    # Zapfhahn
    c.rect(17, 17, 19, 18, 'metal', 4)
    c.rect(19, 18, 19, 20, 'metal', 3)
    c.put_ramp(19, 21, 'fire', 3)
    # Dampf
    for (x, y) in ((6, 3), (7, 2), (7, 4), (8, 1), (12, 4), (13, 3), (13, 5), (12, 1)):
        c.put_ramp(x, y, 'bone', 4 if (x + y) % 2 else 5)
    c.outline()
    return c


def counter(w=64):
    """Tresen von vorn: Platte, Holzfront, Fussleiste, w x 18"""
    c = Canvas(w, 18)
    c.rect(0, 0, w - 1, 5, 'wood', 4)
    c.rect(0, 0, w - 1, 1, 'wood', 5)
    c.rect(0, 5, w - 1, 5, 'wood', 2)
    for x in range(w):
        for y in range(6, 17):
            idx = 3 if y < 12 else 2
            if x % 8 == 0:
                idx = 1
            elif x % 8 == 1:
                idx += 1
            c.put_ramp(x, y, 'wood', min(5, idx))
    c.rect(0, 17, w - 1, 17, 'wood', 0)
    c.rect(0, 14, w - 1, 14, 'metal', 3)
    c.outline()
    return c


def mug_row():
    """drei Humpen mit Schaum und eine Schale auf dem Tresen, 30 x 11"""
    c = Canvas(30, 11)
    for k, x in enumerate((1, 9, 15)):
        h_ = 8 if k != 1 else 6
        y0 = 10 - h_
        round_rect(c, x, y0 + 1, x + 5, 10, 'wood', lo=1, hi=4, radius=1)
        c.rect(x, y0 + 4, x + 5, y0 + 4, 'metal', 3)
        c.rect(x, y0, x + 5, y0 + 1, 'bone', 5)
        c.put_ramp(x + 1, y0 - 1, 'bone', 5)
        c.put_ramp(x + 3, y0 - 1, 'bone', 4)
        c.rect(x + 6, y0 + 3, x + 7, y0 + 4, 'wood', 3)
        c.put_ramp(x + 7, y0 + 5, 'wood', 3)
    ellipse(c, 25, 7.5, 4.6, 2.8, 'bone', lo=2, hi=4)
    ellipse(c, 25, 6.8, 3.4, 1.8, 'fire', lo=2, hi=4)
    c.outline()
    return c


def sausage_string():
    """Wuerstchen an Fadenschlaufen (Wanddeko), 28 x 22"""
    c = Canvas(28, 22)
    # zwei Haken, Faden hängt durch
    c.put_ramp(2, 1, 'metal', 4)
    c.put_ramp(25, 1, 'metal', 4)
    rope(c, 2, 2, 25, 2, sag=4, ramp='bone', hi=3, lo=2)
    for k, x in enumerate((6, 11, 16, 21)):
        y0 = 2 + int(4 * 4 * ((x - 2) / 23.0) * (1 - (x - 2) / 23.0)) + 1
        c.rect(x, y0, x, y0 + 2, 'bone', 3)
        ln = 8 if k % 2 == 0 else 10
        round_rect(c, x - 1, y0 + 2, x + 2, y0 + 2 + ln, 'fire', lo=1, hi=4, radius=1)
        c.put_ramp(x - 1, y0 + 3, 'fire', 5)
        c.put_ramp(x, y0 + 3, 'fire', 4)
        c.rect(x - 1, y0 + 2 + ln // 2, x + 2, y0 + 2 + ln // 2, 'fire', 1)
    c.outline()
    return c


def tavern_sign():
    """Wirtshausschild: Trollkopf mit Schwindelaugen, haengt am Ausleger, 26 x 24"""
    c = Canvas(26, 24)
    c.rect(0, 1, 25, 2, 'wood', 3)
    c.rect(0, 1, 25, 1, 'wood', 5)
    chain_line(c, 4, 3, 4, 6)
    chain_line(c, 21, 3, 21, 6)
    round_rect(c, 2, 6, 23, 22, 'wood', lo=1, hi=4, radius=2)
    ellipse(c, 12.5, 14.5, 7.4, 6.8, 'slime', lo=2, hi=5)
    # Spiralaugen
    for ex in (9, 16):
        c.rect(ex - 1, 12, ex + 1, 14, 'bone', 5)
        c.put_ramp(ex, 13, 'coal', 1)
        c.put_ramp(ex - 1, 12, 'coal', 1)
        c.put_ramp(ex + 1, 14, 'coal', 1)
    c.rect(9, 18, 16, 18, 'coal', 1)
    c.put_ramp(10, 19, 'bone', 5)
    c.put_ramp(15, 19, 'bone', 5)
    c.put_ramp(12, 16, 'slime', 1)
    c.put_ramp(13, 16, 'slime', 1)
    c.outline()
    return c


def round_table():
    """Rundtisch mit Suppenschuesseln, 34 x 22"""
    c = Canvas(34, 22)
    c.rect(15, 11, 18, 19, 'wood', 2)
    c.rect(15, 11, 15, 19, 'wood', 3)
    c.rect(10, 19, 23, 20, 'wood', 1)
    ellipse(c, 17, 9, 15.4, 6.4, 'wood', lo=2, hi=5)
    for (bx, by) in ((9, 8), (18, 10), (25, 7)):
        ellipse(c, bx + 0.5, by + 0.5, 4.2, 2.2, 'bone', lo=2, hi=4)
        ellipse(c, bx + 0.5, by, 3.1, 1.4, 'fire', lo=2, hi=4)
    c.line(21, 5, 24, 1, 'metal', 4)                 # Loeffel
    c.put_ramp(24, 0, 'metal', 5)
    c.outline()
    return c


def stool():
    c = Canvas(12, 12)
    ellipse(c, 6, 4, 5.2, 2.6, 'wood', lo=2, hi=5)
    c.rect(2, 5, 3, 10, 'wood', 2)
    c.rect(8, 5, 9, 10, 'wood', 1)
    c.rect(5, 6, 6, 11, 'wood', 3)
    c.outline()
    return c


def diner():
    """hungriger Gast am Tisch (nur Kopf und Schultern), 14 x 12"""
    c = Canvas(14, 12)
    round_rect(c, 2, 7, 11, 11, 'cloth', lo=1, hi=4, radius=2)
    ellipse(c, 7, 5, 3.6, 3.4, 'skin', lo=2, hi=5)
    c.put_ramp(9, 5, 'coal', 1)
    c.rect(5, 1, 10, 2, 'goblin', 3)
    c.line(11, 7, 13, 4, 'metal', 4)
    c.outline()
    return c


def furnish_canteen(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    P = ctx.P
    ctx.decor(sausage_string(), X0 + 20)
    ctx.decor(tavern_sign(), X0 + W // 2 + 4)
    ctx.decor(sausage_string(), X0 + W - 18)
    ctx.prop(counter(52), X0 + 40, Y0 + 2)
    ctx.prop(mug_row(), X0 + 46, Y0 - 6, key_add=1)
    ctx.prop(soup_barrel(), X0 + 6, Y0 + 3)
    ctx.prop(soup_barrel(), X0 + 22, Y0 + 7)
    ctx.floor_deco(P['rug'], X0 + 32, Y0 + H - 38)
    ctx.prop(round_table(), X0 + W - 40, Y0 + 28)
    ctx.prop(stool(), X0 + W - 16, Y0 + 40)


THEME_CANTEEN = {'floor': tile_planks(31, 32, tone=(2, 3, 4)).px[:, :, :3].copy(), 'furnish': furnish_canteen, 'low': False}


# =========================================================================== Reparaturwerkstatt


def pegboard():
    """Lochwand mit Werkzeug-Umrissen (Hammer, Zange, Schraubenschluessel, Saege), 34 x 20"""
    c = Canvas(34, 20)
    round_rect(c, 0, 0, 33, 19, 'wood', lo=1, hi=3, radius=1)
    for y in range(3, 18, 4):
        for x in range(3, 32, 4):
            c.put_ramp(x, y, 'wood', 0)
    # Hammer
    c.rect(4, 4, 4, 14, 'wood', 4)
    c.rect(2, 3, 7, 5, 'metal', 4)
    c.rect(2, 3, 7, 3, 'metal', 5)
    # Zange
    thick_line(c, 12, 4, 15, 15, 1.6, 'metal', lo=2, hi=4)
    thick_line(c, 16, 4, 13, 15, 1.6, 'metal', lo=1, hi=3)
    c.rect(12, 3, 16, 5, 'metal', 4)
    # Schluessel
    c.rect(22, 7, 22, 16, 'metal', 4)
    c.rect(21, 4, 24, 7, 'metal', 3)
    c.put_ramp(22, 5, 'wood', 0)
    c.put_ramp(23, 5, 'wood', 0)
    # Saege
    poly(c, [(27, 5), (31, 5), (31, 15), (27, 12)], 'metal', lo=2, hi=5)
    for y in range(5, 15, 2):
        c.put_ramp(31, y, 'metal', 5)
    c.rect(27, 3, 31, 4, 'wood', 4)
    c.outline()
    return c


def workbench():
    """Werkbank mit Schraubstock, Zange und Hammer, 40 x 24"""
    c = Canvas(40, 24)
    # Beine
    for x in (3, 34):
        c.rect(x, 10, x + 2, 22, 'wood', 2)
        c.rect(x, 10, x, 22, 'wood', 3)
    c.rect(3, 17, 36, 18, 'wood', 2)
    # Platte
    c.rect(0, 6, 39, 11, 'wood', 4)
    c.rect(0, 6, 39, 7, 'wood', 5)
    c.rect(0, 11, 39, 11, 'wood', 2)
    # Schraubstock
    c.rect(4, 1, 10, 6, 'metal', 3)
    c.rect(4, 1, 10, 1, 'metal', 5)
    c.rect(4, 5, 10, 6, 'metal', 1)
    c.rect(11, 3, 15, 3, 'metal', 4)
    c.put_ramp(15, 2, 'metal', 5)
    c.put_ramp(15, 4, 'metal', 5)
    # Hammer liegt quer
    c.rect(18, 4, 28, 5, 'wood', 4)
    c.rect(18, 4, 28, 4, 'wood', 5)
    c.rect(27, 1, 30, 5, 'metal', 4)
    c.rect(27, 1, 30, 1, 'metal', 5)
    # Zange
    thick_line(c, 31, 5, 37, 2, 1.4, 'metal', lo=2, hi=4)
    thick_line(c, 31, 3, 37, 5, 1.4, 'metal', lo=1, hi=3)
    c.outline()
    return c


def wheelbarrow():
    """Schubkarre mit Ziegeln, Rad vorne rechts, 32 x 20"""
    c = Canvas(32, 20)
    # Griffe
    thick_line(c, 1, 8, 12, 12, 1.8, 'wood', lo=2, hi=4)
    # Wanne
    poly(c, [(8, 5), (27, 5), (24, 14), (11, 14)], 'metal', lo=1, hi=4)
    c.rect(8, 5, 27, 5, 'metal', 5)
    # Ziegel
    for k, x in enumerate(range(10, 26, 5)):
        c.rect(x, 1, x + 3, 4, 'fire', 3 if k % 2 else 2)
        c.rect(x, 1, x + 3, 1, 'fire', 4)
    for x in (8, 13, 18):
        c.rect(x + 2, 3, x + 5, 5, 'fire', 2)
    c.rect(9, 5, 26, 5, 'metal', 4)
    # Rad
    ellipse(c, 26.5, 14.5, 4.4, 4.4, 'wood', lo=0, hi=2)
    ellipse(c, 26.5, 14.5, 2.4, 2.4, 'metal', lo=2, hi=4)
    # Staender
    c.rect(10, 14, 11, 19, 'wood', 2)
    c.outline()
    return c


def mortar_bucket():
    """Moertelkuebel mit Gesicht, ueberquellender Moertel, Kelle, 18 x 20"""
    c = Canvas(18, 20)
    # Kelle
    c.line(14, 1, 11, 7, 'wood', 4)
    poly(c, [(11, 7), (16, 4), (15, 1)], 'metal', lo=2, hi=5)
    # Eimer
    poly(c, [(2, 8), (15, 8), (14, 18), (3, 18)], 'wood', lo=1, hi=4)
    c.rect(2, 11, 15, 11, 'metal', 3)
    c.rect(3, 16, 14, 16, 'metal', 2)
    # Moertel
    ellipse(c, 8.5, 8, 7.4, 3.0, 'stone', lo=2, hi=5)
    c.rect(4, 8, 5, 12, 'stone', 4)
    c.put_ramp(4, 13, 'stone', 3)
    # Gesicht
    for ex in (6, 11):
        c.rect(ex, 12, ex + 1, 13, 'bone', 5)
        c.put_ramp(ex + 1, 13, 'coal', 1)
    for x in range(6, 12):
        c.put_ramp(x, 16 if 7 <= x <= 10 else 15, 'coal', 1)
    c.outline()
    return c


def big_hammer():
    """lehnender Riesenhammer, 16 x 34 (zur Wand geneigt)"""
    c = Canvas(16, 34)
    thick_line(c, 3, 33, 9, 8, 2.8, 'wood', lo=1, hi=4)
    poly(c, [(2, 6), (13, 0), (15, 6), (9, 12)], 'metal', lo=1, hi=5)
    c.line(3, 6, 13, 1, 'metal', 5)
    c.outline()
    return c


def ladder(h=40):
    c = Canvas(16, h)
    for x in (2, 12):
        c.rect(x, 0, x + 1, h - 1, 'wood', 3)
        c.rect(x, 0, x, h - 1, 'wood', 4)
        c.rect(x + 1, 0, x + 1, h - 1, 'wood', 1)
    for y in range(4, h - 2, 6):
        c.rect(3, y, 12, y + 1, 'wood', 4)
        c.rect(3, y + 1, 12, y + 1, 'wood', 2)
    c.outline()
    return c


def fixer_gnome():
    """Bau-Zwerg mit Bauhelm und Schweissbrille, hebt den Hammer, 20 x 24"""
    c = Canvas(20, 24)
    thick_line(c, 7, 17, 6, 21, 2.8, 'ice', lo=1, hi=3)
    thick_line(c, 12, 17, 12, 21, 2.8, 'ice', lo=2, hi=4)
    c.rect(4, 21, 8, 22, 'wood', 2)
    c.rect(10, 21, 14, 22, 'wood', 3)
    round_rect(c, 5, 10, 13, 18, 'ice', lo=1, hi=4, radius=2)
    for x in (7, 11):
        c.rect(x, 10, x, 14, 'teamA', 3)
    c.put_ramp(7, 14, 'gold', 5)
    c.put_ramp(11, 14, 'gold', 5)
    # Arme: rechts hoch mit Hammer
    thick_line(c, 13, 11, 16, 5, 2.2, 'skin', lo=3, hi=5)
    thick_line(c, 16, 5, 17, 0, 1.4, 'wood', lo=2, hi=4)
    c.rect(15, 0, 19, 1, 'metal', 4)
    c.rect(15, 0, 19, 0, 'metal', 5)
    thick_line(c, 5, 11, 3, 16, 2.2, 'skin', lo=1, hi=4)
    # Kopf mit Helm
    ellipse(c, 9, 7.5, 4.2, 3.8, 'skin', lo=2, hi=5)
    c.put_ramp(11, 7, 'coal', 1)
    c.rect(8, 10, 10, 10, 'bone', 4)                # Bart
    c.rect(7, 10, 11, 11, 'bone', 3)
    ellipse(c, 9, 4.6, 5.0, 3.2, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 5)
    c.rect(4, 5, 14, 5, 'gold', 2)
    c.rect(10, 5, 12, 6, 'ice', 5)                  # Brille hochgeschoben
    c.outline()
    return c


def brick_pile():
    """Ziegelstapel, 22 x 14"""
    c = Canvas(22, 14)
    rows = [(1, 11, 4), (2, 10, 3), (3, 9, 2), (4, 8, 1)]
    y = 12
    for r in range(4):
        n = 4 - r
        x0 = 2 + r * 3
        for k in range(n):
            x = x0 + k * 5 + (2 if r % 2 else 0)
            c.rect(x, y - 2, x + 4, y, 'fire', 3 if (k + r) % 2 else 2)
            c.rect(x, y - 2, x + 4, y - 2, 'fire', 4)
        y -= 3
    c.outline()
    return c


def wall_repair(w=40, h=22):
    """Mauerreparatur (Overlay auf der Nordwand): frisches Ziegelfeld in Lehmrot, Mauerriss, Kellenschlag-Funken"""
    c = Canvas(w, h)
    # Riss oberhalb des Flickens
    pts = [(w - 12, 0), (w - 13, 4), (w - 11, 8), (w - 13, 12), (w - 11, 16), (w - 12, 20)]
    for (a, b) in zip(pts[:-1], pts[1:]):
        c.line(a[0], a[1], b[0], b[1], 'stone', 0)
    c.line(w - 12, 8, w - 7, 11, 'stone', 1)
    c.line(w - 13, 12, w - 18, 14, 'stone', 1)
    # Flicken: rote Ziegel im Verband
    x0, x1, y0, y1 = 5, w - 17, 6, h - 2
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            row = (y - y0) // 4
            off = 5 if row % 2 else 0
            idx = 3 if ((x - x0 + off) % 10) != 0 else 1
            if (y - y0) % 4 == 3:
                idx = 1
            elif (y - y0) % 4 == 0:
                idx = 4
            if x == x0 or y == y0:
                idx = 4
            c.put_ramp(x, y, 'fire', idx)
    # Moertelfugen heller
    for y in range(y0 + 3, y1, 4):
        for x in range(x0, x1 + 1):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y, 'bone', 3)
    c.outline()
    return c


def furnish_repair(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.decor(pegboard(), X0 + W // 2)
    ctx.prop(workbench(), X0 + 14, Y0 + 12)
    ctx.prop(big_hammer(), X0 + 3, Y0 + 5)
    ctx.prop(wheelbarrow(), X0 + 4, Y0 + H - 38)
    ctx.prop(mortar_bucket(), X0 + W - 24, Y0 + H - 36)


THEME_REPAIR = {'floor': tile_planks(41, 32, tone=(2, 3, 3)).px[:, :, :3].copy(), 'furnish': furnish_repair, 'low': False}
