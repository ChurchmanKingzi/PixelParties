"""pack_art11: kleine Figuren (Rollschuh-Gnom, Papagei, Frosch, Panik-Buerger, Schreiber, Schauer-Buerger ...).
Alle blicken nach rechts. Gesichter bewusst schlicht (1-2 px Augen)."""
from __future__ import annotations

from pack_art11_util import *


# =========================================================================== Rollschuh-Gnom (Eilgang)


def _skate(c, x, y, tone=3):
    """Rollschuh: Stiefel + zwei Raeder (x, y = linke obere Ecke des Stiefels)"""
    round_rect(c, x, y, x + 6, y + 3, 'wood', lo=1, hi=tone + 1, radius=1)
    c.rect(x, y + 4, x + 6, y + 4, 'metal', 2)
    for wx in (x + 1, x + 5):
        ellipse(c, wx + 0.5, y + 6.2, 1.9, 1.9, 'metal', lo=1, hi=5)
        c.put_ramp(wx, y + 6, 'metal', 0)


def spr_gnome_skater(anim='idle', f=0, tunic='ice', hat='teamA', pose='glide'):
    """Gnom auf Rollschuhen (22 x 32). pose: glide (vorgebeugt, Arme hinten) | ring (rechter Arm hoch, Klingel)"""
    c = Canvas(22, 32)
    o = 5
    # Beine + Rollschuhe
    thick_line(c, 8, o + 15, 5, o + 19, 2.6, tunic, lo=1, hi=3)
    _skate(c, 2, o + 19, 3)
    thick_line(c, 12, o + 15, 14, o + 19, 2.6, tunic, lo=2, hi=4)
    _skate(c, 11, o + 19, 4)
    # Koerper
    round_rect(c, 7, o + 8, 16, o + 17, tunic, lo=1, hi=4, radius=2)
    for x in range(7, 17):
        c.put_ramp(x, o + 14, 'gold', 2 if x % 2 else 1)
    c.put_ramp(11, o + 14, 'gold', 5)
    c.put_ramp(12, o + 14, 'gold', 4)
    # Arme
    if pose == 'ring':
        thick_line(c, 16, o + 10, 19, o + 4, 2.0, 'skin', lo=3, hi=5)
        c.put_ramp(19, o + 3, 'skin', 5)
        c.put_ramp(20, o + 3, 'skin', 4)
        thick_line(c, 8, o + 11, 4, o + 14, 2.0, 'skin', lo=1, hi=4)
    else:
        thick_line(c, 8, o + 10, 3, o + 12, 2.0, 'skin', lo=1, hi=4)
        c.put_ramp(2, o + 12, 'skin', 3)
        thick_line(c, 16, o + 10, 19, o + 12, 2.0, 'skin', lo=3, hi=5)
        c.put_ramp(20, o + 12, 'skin', 4)
    # Kopf mit Bart
    ellipse(c, 12.5, o + 5.5, 4.4, 4.0, 'skin', lo=2, hi=5)
    poly(c, [(8, o + 7), (17, o + 7), (16, o + 12), (12.5, o + 15), (9, o + 12)], 'bone', lo=3, hi=5)
    c.put_ramp(11, o + 12, 'bone', 3)
    c.put_ramp(13, o + 13, 'bone', 3)
    ellipse(c, 17.2, o + 6.3, 1.7, 1.5, 'skin', lo=3, hi=5)
    c.put_ramp(17, o + 6, 'fire', 4)
    c.rect(15, o + 4, 15, o + 5, 'coal', 1)
    # Muetze: spitz, nach hinten wehend
    poly(c, [(8, o + 4), (17, o + 4), (13, o), (2, o - 2), (9, o - 3)], hat, lo=1, hi=4)
    c.rect(8, o + 3, 17, o + 4, hat, 1)
    for x in range(8, 17):
        c.put_ramp(x, o + 3, hat, 4 if x < 13 else 3)
    c.put_ramp(2, o - 3, 'gold', 5)
    c.put_ramp(1, o - 2, 'gold', 4)
    c.outline()
    return c


# =========================================================================== Papagei auf Stange


def spr_parrot(anim='idle', f=0):
    """Papagei auf Sitzstange, Schnabel offen (er ruft) (22 x 30)"""
    c = Canvas(22, 30)
    # Staender
    c.rect(10, 20, 11, 28, 'wood', 3)
    c.rect(10, 20, 10, 28, 'wood', 4)
    c.rect(6, 28, 15, 29, 'wood', 2)
    c.rect(6, 28, 15, 28, 'wood', 3)
    c.rect(4, 19, 17, 20, 'wood', 4)
    c.rect(4, 20, 17, 20, 'wood', 2)
    # Schwanz
    thick_line(c, 9, 17, 5, 25, 2.6, 'leaf', lo=1, hi=3)
    thick_line(c, 10, 17, 8, 26, 2.4, 'ice', lo=1, hi=4)
    c.put_ramp(8, 26, 'gold', 4)
    # Koerper
    ellipse(c, 11.5, 12.5, 5.2, 6.8, 'fire', lo=1, hi=5, ambient=0.22)
    # Fluegel
    ellipse(c, 9.5, 13.5, 3.2, 5.2, 'ice', lo=1, hi=4)
    c.line(8, 12, 7, 17, 'ice', 5)
    c.put_ramp(9, 18, 'gold', 4)
    # Bauch
    for y in range(11, 18):
        c.put_ramp(14, y, 'fire', 5 if y % 2 else 4)
    # Kopf
    ellipse(c, 13.5, 6.0, 4.2, 3.9, 'fire', lo=2, hi=5)
    c.put_ramp(11, 3, 'fire', 5)
    c.put_ramp(12, 2, 'fire', 4)
    c.put_ramp(13, 2, 'fire', 5)
    c.rect(11, 5, 12, 6, 'bone', 4)
    c.put_ramp(12, 6, 'coal', 1)
    c.put_ramp(11, 6, 'coal', 2)
    # Schnabel offen (Ober- und Unterschnabel)
    poly(c, [(16, 3), (20, 5), (18, 7), (16, 7)], 'gold', lo=3, hi=5)
    poly(c, [(16, 8), (19, 9), (20, 11), (16, 10)], 'gold', lo=2, hi=4)
    c.put_ramp(17, 8, 'fire', 1)
    c.put_ramp(18, 8, 'fire', 2)
    c.put_ramp(16, 9, 'fire', 2)
    # Krallen
    c.put_ramp(10, 19, 'gold', 3)
    c.put_ramp(13, 19, 'gold', 3)
    c.outline()
    return c


# =========================================================================== Frosch (Fangnetz)


def spr_frog(anim='idle', f=0, throw=True):
    """Frosch, wirft einen Ball (hinter dem Kopf gehalten) (28 x 26)"""
    c = Canvas(28, 26)
    cx = 11
    # Hinterbeine (zusammengekauert)
    ellipse(c, cx - 5, 20.5, 4.6, 3.2, 'slime', lo=1, hi=3)
    ellipse(c, cx + 5, 21, 4.6, 3.2, 'slime', lo=2, hi=4)
    c.rect(cx - 9, 23, cx - 4, 23, 'slime', 1)
    c.rect(cx + 3, 24, cx + 9, 24, 'slime', 2)
    # Rumpf
    ellipse(c, cx, 16.5, 7.6, 6.6, 'slime', lo=1, hi=5, ambient=0.2)
    ellipse(c, cx + 0.5, 18.5, 4.8, 3.8, 'bone', lo=3, hi=5)
    for x in range(cx - 3, cx + 5):
        if x % 2:
            c.put_ramp(x, 19, 'bone', 3)
    # Kopf (flach, breit) mit Glubschaugen oben
    ellipse(c, cx + 1, 10.5, 8.2, 5.2, 'slime', lo=2, hi=5)
    for ex in (cx - 4, cx + 6):
        ellipse(c, ex, 5.2, 3.3, 3.1, 'slime', lo=2, hi=5)
        c.rect(ex, 4, ex + 1, 6, 'bone', 5)
        c.put_ramp(ex + 1, 5, 'coal', 1)
        c.put_ramp(ex + 1, 6, 'coal', 0)
    # Maul: breiter Strich, Mundwinkel hoch
    for x in range(cx - 5, cx + 9):
        c.put_ramp(x, 12, 'slime', 0)
    c.put_ramp(cx - 6, 11, 'slime', 0)
    c.put_ramp(cx + 9, 11, 'slime', 0)
    # Stirnband in Teamfarbe
    c.rect(cx - 6, 8, cx + 8, 8, 'teamA', 3)
    c.rect(cx - 6, 7, cx + 8, 7, 'teamA', 4)
    c.put_ramp(cx - 7, 8, 'teamA', 2)
    c.put_ramp(cx - 8, 9, 'teamA', 2)
    c.put_ramp(cx - 9, 10, 'teamA', 1)
    # Vorderarm (vorn, stuetzt), Wurfarm mit Ball hinter dem Kopf
    thick_line(c, cx - 5, 17, cx - 8, 22, 2.4, 'slime', lo=1, hi=4)
    if throw:
        thick_line(c, cx + 6, 15, cx + 12, 9, 2.6, 'slime', lo=2, hi=5)
        thick_line(c, cx + 12, 9, cx + 15, 4, 2.2, 'slime', lo=3, hi=5)
        ellipse(c, cx + 16, 3.2, 3.2, 3.2, 'stone', lo=0, hi=5)
    else:
        thick_line(c, cx + 6, 17, cx + 12, 22, 2.6, 'slime', lo=2, hi=5)
    c.outline()
    return c


# =========================================================================== Panik-Raum: Buerger


def _head(c, cx, cy, rx=3.8, ry=3.5, ramp='skin'):
    ellipse(c, cx, cy, rx, ry, ramp, lo=2, hi=5)


def spr_scared_citizen(anim='idle', f=0, kind='cloth', teddy=True):
    """verschreckter Buerger, drueckt einen Teddy an die Brust, Mund ein O, Schweisstropfen (16 x 22)"""
    c = Canvas(18, 22)
    o = 2
    thick_line(c, 7, o + 15, 6, o + 19, 2.2, 'wood', lo=1, hi=3)
    thick_line(c, 11, o + 15, 12, o + 19, 2.2, 'wood', lo=2, hi=4)
    round_rect(c, 5, o + 9, 12, o + 16, kind, lo=1, hi=4, radius=2)
    c.rect(5, o + 13, 12, o + 13, 'gold', 2)
    # Teddy vor der Brust
    if teddy:
        ellipse(c, 9.5, o + 12.2, 3.6, 3.4, 'dirt', lo=2, hi=5)
        ellipse(c, 7.2, o + 9.6, 1.5, 1.5, 'dirt', lo=2, hi=4)
        ellipse(c, 11.8, o + 9.6, 1.5, 1.5, 'dirt', lo=3, hi=5)
        c.put_ramp(9, o + 11, 'coal', 1)
        c.put_ramp(11, o + 11, 'coal', 1)
        c.put_ramp(10, o + 12, 'coal', 2)
    # Arme umklammern
    thick_line(c, 5, o + 10, 8, o + 14, 1.8, 'skin', lo=1, hi=4)
    thick_line(c, 12, o + 10, 10, o + 14, 1.8, 'skin', lo=3, hi=5)
    # Kopf, wilde Haare, offener Mund
    _head(c, 8.5, o + 6)
    c.put_ramp(10, o + 5, 'coal', 1)
    c.put_ramp(10, o + 6, 'coal', 1)
    c.put_ramp(6, o + 5, 'coal', 1)
    c.put_ramp(6, o + 6, 'coal', 1)
    c.rect(8, o + 8, 9, o + 8, 'coal', 1)
    for (x, y, i) in ((4, o + 1, 2), (5, o + 0, 3), (7, o - 1, 2), (9, o - 1, 3), (11, o + 0, 2), (12, o + 1, 3), (13, o + 2, 2)):
        c.put_ramp(x, max(0, y), 'wood', i)
    c.rect(5, o + 2, 12, o + 2, 'wood', 2)
    # Schweiss
    c.put_ramp(14, o + 3, 'ice', 5)
    c.put_ramp(14, o + 4, 'ice', 4)
    c.put_ramp(3, o + 4, 'ice', 5)
    c.outline()
    return c


def spr_cookie_citizen(anim='idle', f=0, kind='dirt'):
    """gelassener Buerger, mampft einen Keks, Kruemel (16 x 22)"""
    c = Canvas(18, 22)
    o = 2
    thick_line(c, 7, o + 15, 6, o + 19, 2.2, 'wood', lo=1, hi=3)
    thick_line(c, 11, o + 15, 12, o + 19, 2.2, 'wood', lo=2, hi=4)
    round_rect(c, 5, o + 9, 12, o + 16, kind, lo=1, hi=4, radius=2)
    c.rect(5, o + 13, 12, o + 13, 'gold', 2)
    thick_line(c, 5, o + 10, 4, o + 14, 1.8, 'skin', lo=1, hi=4)
    thick_line(c, 12, o + 10, 14, o + 7, 1.8, 'skin', lo=3, hi=5)
    ellipse(c, 15, o + 5.5, 2.6, 2.6, 'wood', lo=2, hi=5)
    for (x, y) in ((14, o + 4), (16, o + 5), (15, o + 7)):
        c.put_ramp(x, y, 'wood', 0)
    _head(c, 8.5, o + 6)
    c.put_ramp(10, o + 5, 'coal', 1)
    c.put_ramp(10, o + 6, 'coal', 1)
    c.rect(9, o + 8, 11, o + 8, 'coal', 1)
    for x in range(5, 13):
        c.put_ramp(x, o + 2, 'wood', 2 if x > 7 else 1)
    c.put_ramp(6, o + 1, 'wood', 3)
    c.put_ramp(7, o + 1, 'wood', 3)
    c.put_ramp(11, o + 11, 'wood', 4)
    c.put_ramp(4, o + 17, 'wood', 4)
    c.put_ramp(13, o + 18, 'wood', 4)
    c.outline()
    return c


# =========================================================================== Schreiber (Werbebuero), sitzt hinter dem Schreibtisch


def spr_clerk(anim='idle', f=0):
    """Werber / Schreiber: nur Oberkoerper, Schirmmuetze, Feder in der Hand (20 x 20)"""
    c = Canvas(20, 20)
    round_rect(c, 4, 10, 15, 19, 'leaf', lo=1, hi=4, radius=2)
    c.rect(4, 17, 15, 19, 'leaf', 1)
    c.rect(9, 10, 10, 14, 'bone', 4)
    c.put_ramp(9, 15, 'teamA', 3)
    c.put_ramp(10, 15, 'teamA', 2)
    thick_line(c, 15, 12, 18, 16, 2.0, 'skin', lo=3, hi=5)
    c.line(18, 15, 18, 9, 'bone', 5)
    c.put_ramp(18, 8, 'bone', 4)
    c.put_ramp(19, 8, 'bone', 3)
    _head(c, 9.5, 6.5, 4.0, 3.8)
    c.put_ramp(12, 6, 'coal', 1)
    c.put_ramp(12, 7, 'coal', 1)
    c.rect(10, 9, 12, 9, 'coal', 2)
    # Schirmmuetze (Teamfarbe) + Papier-Schild-Streifen
    ellipse(c, 9.5, 3.3, 5.2, 2.4, 'teamA', lo=1, hi=4)
    c.rect(5, 4, 14, 4, 'teamA', 1)
    c.rect(11, 4, 17, 4, 'teamA', 2)
    c.rect(12, 5, 17, 5, 'teamA', 1)
    c.put_ramp(9, 2, 'gold', 5)
    c.put_ramp(10, 2, 'gold', 4)
    c.outline()
    return c


def spr_frozen_citizen(anim='idle', f=0):
    """Buerger mitten im Schritt eingefroren (Eis-Ton), haelt eine schwebende Tasse (20 x 22)"""
    c = Canvas(20, 22)
    o = 2
    thick_line(c, 8, o + 15, 4, o + 19, 2.4, 'ice', lo=1, hi=3)
    c.rect(2, o + 19, 6, o + 19, 'ice', 2)
    thick_line(c, 11, o + 15, 14, o + 19, 2.4, 'ice', lo=2, hi=4)
    c.rect(12, o + 19, 16, o + 19, 'ice', 3)
    round_rect(c, 6, o + 9, 13, o + 16, 'ice', lo=1, hi=4, radius=2)
    c.rect(6, o + 13, 13, o + 13, 'ice', 5)
    thick_line(c, 6, o + 10, 3, o + 13, 1.8, 'ice', lo=2, hi=4)
    thick_line(c, 13, o + 10, 16, o + 7, 1.8, 'ice', lo=3, hi=5)
    ellipse(c, 10, o + 6, 3.8, 3.5, 'ice', lo=3, hi=5)
    c.put_ramp(12, o + 5, 'coal', 1)
    c.put_ramp(12, o + 6, 'coal', 1)
    c.put_ramp(11, o + 8, 'coal', 2)
    for x in range(6, 14):
        c.put_ramp(x, o + 2, 'ice', 2 if x > 8 else 1)
    c.put_ramp(7, o + 1, 'ice', 3)
    c.put_ramp(8, o + 1, 'ice', 3)
    for (x, y) in ((8, o + 12), (11, o + 14), (9, o + 5)):
        c.put_ramp(x, y, 'ice', 5)
    c.outline()
    return c


def spr_duster_citizen(anim='idle', f=0, kind='teamA'):
    """Buerger mit grosser Kappe und Staubwedel (20 x 22)"""
    c = Canvas(20, 22)
    o = 2
    thick_line(c, 7, o + 15, 6, o + 19, 2.2, 'wood', lo=1, hi=3)
    thick_line(c, 11, o + 15, 12, o + 19, 2.2, 'wood', lo=2, hi=4)
    round_rect(c, 5, o + 9, 12, o + 16, kind, lo=1, hi=4, radius=2)
    c.rect(5, o + 15, 12, o + 16, 'bone', 3)
    c.rect(5, o + 13, 12, o + 13, 'gold', 2)
    thick_line(c, 5, o + 10, 4, o + 14, 1.8, 'skin', lo=1, hi=4)
    thick_line(c, 12, o + 10, 15, o + 6, 1.8, 'skin', lo=3, hi=5)
    # Staubwedel: Stiel + Federn
    c.line(15, o + 6, 17, o + 0, 'wood', 3)
    for (x, y, i) in ((16, o - 1, 4), (17, o - 1, 5), (18, o + 0, 4), (15, o + 0, 3), (18, o + 1, 3), (19, o + 2, 3), (14, o + 1, 2)):
        c.put_ramp(x, max(0, y), 'gold', i)
    _head(c, 8.5, o + 6)
    c.put_ramp(10, o + 5, 'coal', 1)
    c.put_ramp(10, o + 6, 'coal', 1)
    c.rect(9, o + 8, 10, o + 8, 'coal', 1)
    # Kopftuch
    for x in range(4, 13):
        c.put_ramp(x, o + 2, kind, 3)
        c.put_ramp(x, o + 3, kind, 2)
    c.put_ramp(3, o + 4, kind, 2)
    c.put_ramp(3, o + 5, kind, 1)
    c.put_ramp(6, o + 1, kind, 4)
    c.put_ramp(7, o + 1, kind, 4)
    c.put_ramp(8, o + 1, kind, 3)
    c.outline()
    return c
