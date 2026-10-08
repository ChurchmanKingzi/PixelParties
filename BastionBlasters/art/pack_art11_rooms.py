"""pack_art11: Raum-Moebel und Themen (Panic Room, Recruiting Office, Curio Stockroom, Chrono Shrine)."""
from __future__ import annotations

from pack_art11_util import *
from pack_art11_chars import *


# =========================================================================== Panic Room (BU-05)


def vault_door():
    """Bunkertuer an der Nordwand: Stahlplatte im Steinrahmen, Sehschlitz mit zwei Augen, Handrad, Scharniere (26 x 28)"""
    c = Canvas(26, 28)
    # Steinrahmen
    round_rect(c, 0, 0, 25, 27, 'stone', lo=1, hi=4, radius=2)
    c.rect(0, 0, 25, 0, 'stone', 5)
    # Warnstreifen im Sturz
    for x in range(2, 24):
        on = (x // 3) % 2 == 0
        c.put_ramp(x, 2, 'gold' if on else 'coal', 4 if on else 1)
        c.put_ramp(x, 3, 'gold' if on else 'coal', 3 if on else 0)
    # Stahlplatte
    for y in range(5, 27):
        for x in range(2, 24):
            u = (x - 2) / 21.0
            v = (y - 5) / 21.0
            L = 0.78 - 0.30 * u - 0.28 * v
            idx = quant(max(0.0, min(1.0, L)), 1, 4, x, y)
            c.put_ramp(x, y, 'metal', idx)
    c.rect(2, 5, 23, 5, 'metal', 5)
    c.rect(2, 5, 2, 26, 'metal', 4)
    c.rect(23, 5, 23, 26, 'metal', 1)
    c.rect(2, 26, 23, 26, 'metal', 0)
    # Nieten
    for (x, y) in ((4, 7), (20, 7), (4, 23), (20, 23)):
        rivet(c, x, y)
    # Scharniere links
    for y in (8, 15, 22):
        c.rect(0, y, 3, y + 2, 'metal', 2)
        c.rect(0, y, 3, y, 'metal', 4)
        c.put_ramp(1, y + 1, 'metal', 5)
    # Sehschlitz mit Augen
    c.rect(7, 8, 18, 10, 'coal', 0)
    c.rect(7, 8, 18, 8, 'metal', 0)
    c.rect(7, 11, 18, 11, 'metal', 5)
    c.rect(10, 9, 11, 10, 'bone', 5)
    c.rect(15, 9, 16, 10, 'bone', 5)
    c.put_ramp(11, 10, 'coal', 1)
    c.put_ramp(16, 10, 'coal', 1)
    # Handrad
    cx, cy = 13, 18
    ellipse(c, cx, cy, 5.2, 5.2, 'metal', lo=1, hi=5)
    ellipse(c, cx, cy, 3.1, 3.1, 'metal', lo=0, hi=2, ambient=0.4)
    for (dx, dy) in ((-5, 0), (5, 0), (0, -5), (0, 5)):
        c.put_ramp(cx + dx, cy + dy, 'gold', 4)
    c.rect(cx - 3, cy, cx + 2, cy, 'metal', 4)
    c.rect(cx, cy - 3, cx, cy + 2, 'metal', 3)
    c.put_ramp(cx, cy, 'gold', 5)
    c.outline()
    return c


def alarm_lamp():
    """rote Alarmleuchte mit Lichtstrahlen (10 x 12)"""
    c = Canvas(10, 12)
    c.rect(3, 9, 6, 10, 'metal', 2)
    round_rect(c, 2, 3, 7, 9, 'fire', lo=2, hi=5, radius=2)
    c.rect(4, 4, 4, 6, 'gold', 5)
    c.put_ramp(3, 4, 'fire', 5)
    c.put_ramp(0, 5, 'fire', 4)
    c.put_ramp(9, 5, 'fire', 3)
    c.put_ramp(1, 2, 'fire', 4)
    c.put_ramp(8, 2, 'fire', 3)
    c.put_ramp(5, 0, 'fire', 4)
    c.outline()
    return c


def _teddy(c, x, y):
    """Teddy (Mitte x, Fuss y), ca. 11 x 12, sitzend"""
    ellipse(c, x, y - 4.2, 4.0, 4.0, 'dirt', lo=2, hi=5)
    ellipse(c, x, y - 4.0, 2.2, 2.4, 'dirt', lo=4, hi=5)
    ellipse(c, x, y - 9.5, 3.2, 3.0, 'dirt', lo=2, hi=5)
    ellipse(c, x - 2.6, y - 11.8, 1.3, 1.3, 'dirt', lo=1, hi=4)
    ellipse(c, x + 2.6, y - 11.8, 1.3, 1.3, 'dirt', lo=2, hi=5)
    ellipse(c, x + 0.5, y - 8.3, 1.4, 1.1, 'dirt', lo=4, hi=5)
    c.put_ramp(int(x - 1), int(y - 10), 'coal', 1)
    c.put_ramp(int(x + 2), int(y - 10), 'coal', 1)
    c.put_ramp(int(x), int(y - 8), 'coal', 2)
    c.put_ramp(int(x - 3), int(y - 5), 'dirt', 1)
    c.put_ramp(int(x + 3), int(y - 5), 'dirt', 3)
    c.rect(int(x - 1), int(y - 6), int(x + 1), int(y - 6), 'teamA', 3)
    c.put_ramp(int(x), int(y - 5), 'teamA', 2)


def _cookie(c, x, y, r=2.6):
    ellipse(c, x, y, r, r, 'wood', lo=2, hi=5)
    c.put_ramp(int(x - 1), int(y - 1), 'coal', 1)
    c.put_ramp(int(x + 1), int(y), 'coal', 1)
    c.put_ramp(int(x - 1), int(y + 1), 'coal', 2)


def supply_shelf():
    """Regal mit Notvorrat: oben Teddy + Keksdose, Mitte Konserven, unten Wasserkanister (32 x 30)"""
    c = Canvas(32, 30)
    # Pfosten
    for x in (1, 29):
        c.rect(x, 2, x + 1, 29, 'wood', 2)
        c.rect(x, 2, x, 29, 'wood', 4)
    # Boeden
    for y in (10, 19, 28):
        c.rect(1, y, 30, y + 1, 'wood', 3)
        c.rect(1, y, 30, y, 'wood', 5)
        if y < 28:
            c.rect(1, y + 2, 30, y + 2, 'wood', 1)
    # Rueckwand-Schatten
    for y in (3, 12, 21):
        for x in range(3, 29):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y + 3, 'wood', 1)
    # oben: Teddy + Keksdose
    _teddy(c, 8, 10)
    round_rect(c, 15, 1, 22, 9, 'sky', lo=2, hi=5, radius=2)
    c.rect(15, 1, 22, 2, 'metal', 3)
    for (cx_, cy_) in ((18, 6), (20, 5), (17, 4), (20, 8)):
        _cookie(c, cx_, cy_, 1.6)
    c.put_ramp(16, 3, 'bone', 5)
    c.rect(25, 3, 27, 9, 'cloth', 3)         # Marmeladenglas
    c.rect(25, 3, 27, 3, 'metal', 3)
    c.put_ramp(25, 5, 'bone', 5)
    # Mitte: Konserven
    for k, (x, col) in enumerate(((4, 'leaf'), (9, 'fire'), (14, 'gold'), (19, 'ice'))):
        c.rect(x, 12, x + 3, 18, 'metal', 3)
        c.rect(x, 12, x, 18, 'metal', 5)
        c.rect(x + 3, 12, x + 3, 18, 'metal', 1)
        c.rect(x, 14, x + 3, 16, col, 3)
        c.rect(x, 14, x, 16, col, 5)
        c.rect(x, 12, x + 3, 12, 'metal', 5)
    c.rect(24, 13, 28, 18, 'dirt', 3)
    c.rect(24, 13, 28, 13, 'dirt', 5)
    c.rect(26, 14, 26, 17, 'dirt', 1)
    # unten: Kanister + Keksschachteln
    for x in (4, 10):
        round_rect(c, x, 21, x + 4, 27, 'sky', lo=2, hi=5, radius=1)
        c.rect(x + 1, 20, x + 3, 20, 'metal', 2)
    for (x, w) in ((17, 6), (24, 5)):
        round_rect(c, x, 22, x + w, 27, 'wood', lo=2, hi=4, radius=1)
        _cookie(c, x + w / 2.0 + 0.5, 24.5, 1.7)
    c.outline()
    return c


def cookie_crates():
    """zwei uebereinander gestapelte Kisten, oben offen und voller Kekse (22 x 24)"""
    c = Canvas(22, 24)
    # unten
    round_rect(c, 1, 11, 20, 22, 'wood', lo=1, hi=4, radius=1)
    for x in range(2, 20):
        c.put_ramp(x, 11, 'wood', 5)
    c.line(2, 13, 19, 21, 'wood', 2)
    c.line(19, 13, 2, 21, 'wood', 2)
    # oben, offen
    round_rect(c, 3, 3, 18, 11, 'wood', lo=1, hi=4, radius=1)
    c.rect(4, 3, 17, 5, 'dirt', 3)
    for (x, y) in ((6, 4), (9, 3), (12, 4), (15, 3), (8, 5), (14, 5)):
        _cookie(c, x, y, 2.3)
    c.rect(4, 8, 17, 8, 'wood', 1)
    c.outline()
    return c


def bedroll():
    """Schlafmatte in der Draufsicht (Bodendekor), Kissen links (26 x 12)"""
    c = Canvas(26, 12)
    for y in range(12):
        for x in range(26):
            e = min(x, y, 25 - x, 11 - y)
            if e == 0 and (x in (0, 25)) and (y in (0, 11)):
                continue
            if e == 0:
                idx = 1
            else:
                idx = 3 if ((x // 4 + y // 4) % 2 == 0) else 2
                if y < 3 or x < 3:
                    idx += 1
            c.put_ramp(x, y, 'teamA', min(5, idx))
    round_rect(c, 2, 2, 8, 9, 'bone', lo=3, hi=5, radius=2)
    c.rect(9, 1, 9, 10, 'teamA', 1)
    return c


def hazard_frame(w=54, h=30):
    """Warnstreifen-Rahmen auf dem Boden (Mitte frei) = Sicherheitszone"""
    c = Canvas(w, h)
    t = 3
    for y in range(h):
        for x in range(w):
            e = min(x, y, w - 1 - x, h - 1 - y)
            if e < t:
                on = ((x + y) // 3) % 2 == 0
                if on:
                    c.put_ramp(x, y, 'gold', 4 if e > 0 else 3)
                else:
                    c.put_ramp(x, y, 'coal', 1)
    return c


def furnish_panic(ctx):
    P = ctx.P
    ctx.decor(vault_door(), ctx.X0 + ctx.W // 2)
    ctx.decor(alarm_lamp(), ctx.X0 + 22)
    ctx.decor(alarm_lamp(), ctx.X0 + ctx.W - 22)
    ctx.prop(supply_shelf(), ctx.X0 + 4, ctx.Y0 + 10)
    ctx.prop(cookie_crates(), ctx.X0 + ctx.W - 26, ctx.Y0 + 20)
    ctx.floor_deco(hazard_frame(56, 28), ctx.X0 + 20, ctx.Y0 + 24)
    ctx.floor_deco(bedroll(), ctx.X0 + 26, ctx.Y0 + 30)


THEME_PANIC = {'floor': flat_floor('steel', 5), 'furnish': furnish_panic, 'low': False}


# =========================================================================== Recruiting Office (BU-08)


def poster_join():
    """Werbeplakat ohne Text: roter Grund, grosser Topfhelm, goldenes Ausrufezeichen, Sterne (18 x 26)"""
    c = Canvas(18, 26)
    # weisses Papier + roter Grund
    for y in range(1, 25):
        for x in range(1, 17):
            c.put_ramp(x, y, 'bone', 5 if (x < 3 or y < 3) else 4)
    for y in range(3, 23):
        for x in range(3, 15):
            u = (x - 3) / 12.0
            v = (y - 3) / 20.0
            c.put_ramp(x, y, 'teamA', quant(0.85 - 0.35 * u - 0.30 * v, 2, 4, x, y))
    # Sterne
    for (x, y) in ((5, 5), (12, 5)):
        c.put_ramp(x, y, 'gold', 5)
        c.put_ramp(x - 1, y, 'gold', 4)
        c.put_ramp(x + 1, y, 'gold', 4)
        c.put_ramp(x, y - 1, 'gold', 4)
        c.put_ramp(x, y + 1, 'gold', 4)
    # Topfhelm
    ellipse(c, 8.5, 12.0, 5.2, 4.6, 'metal', lo=1, hi=5, clip=lambda x, y: y <= 12)
    c.rect(3, 12, 14, 12, 'metal', 2)
    c.rect(2, 12, 15, 12, 'metal', 2)
    c.put_ramp(2, 11, 'metal', 4)
    c.put_ramp(15, 11, 'metal', 2)
    c.put_ramp(8, 7, 'metal', 4)
    c.put_ramp(9, 7, 'metal', 3)
    # goldenes Ausrufezeichen
    c.rect(7, 15, 9, 19, 'gold', 4)
    c.rect(7, 15, 7, 19, 'gold', 5)
    c.rect(9, 15, 9, 19, 'gold', 3)
    c.rect(7, 21, 9, 22, 'gold', 4)
    c.rect(7, 21, 7, 22, 'gold', 5)
    # Nagel-Ecken
    for (x, y) in ((2, 2), (15, 2), (2, 23), (15, 23)):
        c.put_ramp(x, y, 'metal', 3)
    c.outline()
    return c


def notice_board():
    """Pinnwand mit Zetteln (20 x 16)"""
    c = Canvas(20, 16)
    round_rect(c, 0, 0, 19, 15, 'wood', lo=1, hi=4, radius=1)
    for y in range(2, 14):
        for x in range(2, 18):
            c.put_ramp(x, y, 'dirt', 3 if (x + y) % 2 else 4)
    for (x, y, w, h, col) in ((3, 3, 5, 6, 'bone'), (10, 4, 5, 4, 'bone'), (8, 9, 6, 4, 'ice'), (3, 10, 4, 3, 'gold')):
        c.rect(x, y, x + w - 1, y + h - 1, col, 4)
        c.rect(x, y, x + w - 1, y, col, 5)
        c.put_ramp(x + w // 2, y, 'fire', 3)
    c.outline()
    return c


def office_desk():
    """Schreibtisch mit Papierstapel, Tintenfass + Feder, Klingel und Stempel (40 x 26)"""
    c = Canvas(40, 26)
    # Beine / Korpus
    c.rect(2, 11, 4, 24, 'wood', 2)
    c.rect(35, 11, 37, 24, 'wood', 2)
    round_rect(c, 1, 8, 38, 24, 'wood', lo=1, hi=4, radius=1)
    for x in range(2, 38):
        c.put_ramp(x, 8, 'wood', 5)
        c.put_ramp(x, 9, 'wood', 4)
    # zwei Schubladen
    for x0 in (6, 22):
        c.rect(x0, 12, x0 + 11, 19, 'wood', 2)
        c.rect(x0, 12, x0 + 11, 12, 'wood', 1)
        c.rect(x0, 19, x0 + 11, 19, 'wood', 1)
        c.rect(x0 + 5, 15, x0 + 6, 16, 'gold', 5)
    c.rect(2, 23, 37, 24, 'wood', 1)
    # Papierstapel mit Siegel
    c.rect(4, 4, 12, 7, 'bone', 4)
    c.rect(4, 4, 12, 4, 'bone', 5)
    c.rect(4, 7, 12, 7, 'bone', 2)
    c.rect(5, 2, 10, 3, 'bone', 5)
    c.put_ramp(8, 5, 'teamA', 3)
    c.put_ramp(9, 5, 'teamA', 2)
    # Tintenfass + Feder
    c.rect(18, 5, 21, 7, 'coal', 2)
    c.rect(18, 5, 18, 7, 'coal', 4)
    c.line(20, 5, 26, 0, 'bone', 5)
    c.line(21, 5, 27, 1, 'bone', 4)
    c.put_ramp(26, 0, 'teamA', 4)
    c.put_ramp(27, 0, 'teamA', 3)
    # Handklingel
    ellipse(c, 31.5, 5.0, 3.2, 2.6, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 5)
    c.rect(28, 6, 35, 7, 'gold', 3)
    c.rect(28, 6, 35, 6, 'gold', 4)
    c.put_ramp(31, 1, 'gold', 5)
    c.put_ramp(32, 1, 'gold', 4)
    c.outline()
    return c


def spr_recruit(anim='idle', f=0):
    """Rekrut: Buerger-Groesse, Topfhelm viel zu gross, Kochloeffel statt Schwert (18 x 22)"""
    c = Canvas(18, 22)
    o = 2
    thick_line(c, 7, o + 15, 6, o + 19, 2.2, 'wood', lo=1, hi=3)
    thick_line(c, 11, o + 15, 12, o + 19, 2.2, 'wood', lo=2, hi=4)
    round_rect(c, 5, o + 9, 12, o + 16, 'cloth', lo=1, hi=4, radius=2)
    c.rect(5, o + 13, 12, o + 13, 'gold', 2)
    thick_line(c, 5, o + 10, 3, o + 14, 1.8, 'skin', lo=1, hi=4)
    thick_line(c, 12, o + 10, 15, o + 11, 1.8, 'skin', lo=3, hi=5)
    # Kochloeffel
    thick_line(c, 15, o + 11, 16, o + 4, 1.4, 'wood', lo=2, hi=4)
    ellipse(c, 16, o + 2.5, 1.9, 2.4, 'wood', lo=2, hi=5)
    ellipse(c, 8.5, o + 6.5, 3.4, 3.2, 'skin', lo=2, hi=5)
    c.put_ramp(10, o + 7, 'coal', 1)
    c.rect(8, o + 9, 9, o + 9, 'coal', 1)
    # Topfhelm: bedeckt die Augen
    ellipse(c, 8.5, o + 4.0, 6.6, 5.0, 'metal', lo=1, hi=5, clip=lambda x, y: y <= o + 5)
    c.rect(2, o + 5, 15, o + 5, 'metal', 2)
    c.put_ramp(1, o + 4, 'metal', 4)
    c.put_ramp(16, o + 4, 'metal', 2)
    c.put_ramp(8, o - 1, 'metal', 4)
    c.put_ramp(9, o - 1, 'metal', 3)
    c.outline()
    return c


def furnish_office(ctx):
    P = ctx.P
    X0, Y0 = ctx.X0, ctx.Y0
    ctx.decor(poster_join(), X0 + 17)
    ctx.decor(notice_board(), X0 + 52)
    ctx.floor_deco(rug(38, 12, 'teamA'), X0 + 4, Y0 + 38)
    ctx.prop(spr_clerk(), X0 + 12, Y0 + 5)
    ctx.prop(office_desk(), X0 + 2, Y0 + 14)
    ctx.prop(spr_parrot(), X0 + 40, Y0 + 16)


def _plank_floor(seed, tone):
    return tile_planks(seed, 32, tone=tone).px[:, :, :3].copy()


THEME_OFFICE = {'floor': _plank_floor(21, (3, 4, 4)), 'furnish': furnish_office, 'low': False}


# =========================================================================== Curio Stockroom (BU-10)


def _curio_item(c, kind, x, yb):
    """kleines Kuriosum, (x, yb) = linke untere Ecke"""
    if kind == 'bottle':
        c.rect(x + 1, yb - 7, x + 3, yb, 'slime', 3)
        c.rect(x + 1, yb - 7, x + 1, yb, 'slime', 5)
        c.rect(x + 2, yb - 9, x + 2, yb - 8, 'slime', 4)
        c.put_ramp(x + 2, yb - 10, 'wood', 3)
        c.put_ramp(x + 3, yb - 4, 'bone', 5)
    elif kind == 'flask':
        ellipse(c, x + 3.5, yb - 3.0, 3.6, 3.2, 'fire', lo=2, hi=5)
        c.rect(x + 3, yb - 9, x + 4, yb - 5, 'bone', 4)
        c.put_ramp(x + 3, yb - 10, 'wood', 3)
        c.put_ramp(x + 4, yb - 10, 'wood', 2)
    elif kind == 'skull':
        ellipse(c, x + 3.5, yb - 4.2, 3.7, 3.6, 'bone', lo=2, hi=5)
        c.rect(x + 2, yb - 1, x + 5, yb, 'bone', 3)
        c.put_ramp(x + 2, yb - 4, 'coal', 1)
        c.put_ramp(x + 5, yb - 4, 'coal', 1)
        c.put_ramp(x + 3, yb - 2, 'coal', 2)
    elif kind == 'globe':
        c.rect(x + 3, yb - 1, x + 4, yb, 'wood', 3)
        c.rect(x + 1, yb, x + 6, yb, 'wood', 2)
        ellipse(c, x + 3.5, yb - 5.0, 3.9, 3.9, 'ice', lo=1, hi=5)
        c.put_ramp(x + 2, yb - 6, 'leaf', 4)
        c.put_ramp(x + 3, yb - 6, 'leaf', 3)
        c.put_ramp(x + 4, yb - 4, 'leaf', 3)
        c.put_ramp(x + 5, yb - 4, 'leaf', 2)
    elif kind == 'crystal':
        c.rect(x + 1, yb - 1, x + 6, yb, 'gold', 3)
        ellipse(c, x + 3.5, yb - 5.0, 3.7, 3.7, 'purple', lo=1, hi=5)
        c.put_ramp(x + 2, yb - 6, 'purple', 5)
        c.put_ramp(x + 3, yb - 6, 'purple', 5)
    elif kind == 'vase':
        ellipse(c, x + 3.5, yb - 3.5, 3.6, 3.6, 'ice', lo=1, hi=4)
        c.rect(x + 3, yb - 9, x + 4, yb - 6, 'ice', 3)
        c.rect(x + 2, yb - 10, x + 5, yb - 9, 'ice', 4)
        c.rect(x + 1, yb - 4, x + 6, yb - 3, 'gold', 4)
    elif kind == 'books':
        for k, (w, col) in enumerate(((7, 'teamA'), (6, 'leaf'), (7, 'purple'))):
            c.rect(x, yb - 2 - k * 3, x + w - 1, yb - k * 3, col, 3)
            c.rect(x, yb - 2 - k * 3, x + w - 1, yb - 2 - k * 3, col, 5)
            c.put_ramp(x + w - 1, yb - 1 - k * 3, 'bone', 4)
    elif kind == 'mask':
        poly(c, [(x, yb - 8), (x + 6, yb - 8), (x + 5, yb - 1), (x + 3, yb), (x + 1, yb - 1)], 'goblin', lo=1, hi=5)
        c.rect(x + 1, yb - 6, x + 2, yb - 5, 'coal', 1)
        c.rect(x + 4, yb - 6, x + 5, yb - 5, 'coal', 1)
        c.put_ramp(x + 3, yb - 2, 'coal', 1)
    elif kind == 'egg':
        ellipse(c, x + 3.5, yb - 4.0, 3.2, 4.2, 'bone', lo=3, hi=5)
        for (dx, dy) in ((2, -5), (4, -3), (3, -6), (5, -5)):
            c.put_ramp(x + dx, yb + dy, 'leaf', 3)
        c.rect(x + 1, yb - 1, x + 6, yb, 'wood', 2)
    elif kind == 'teapot':
        ellipse(c, x + 3.5, yb - 3.0, 3.6, 3.0, 'gold', lo=2, hi=5)
        c.rect(x + 2, yb - 7, x + 4, yb - 6, 'gold', 3)
        c.put_ramp(x + 3, yb - 8, 'gold', 5)
        c.line(x + 7, yb - 5, x + 8, yb - 3, 'gold', 3)
        c.put_ramp(x - 1, yb - 4, 'gold', 4)
        c.put_ramp(x - 1, yb - 3, 'gold', 2)


def curio_shelf(seed=1, flip=False):
    """hohes Regal voller Dinge, steht an der Nordwand (28 x 34)"""
    c = Canvas(28, 34)
    rnd = random.Random(seed)
    # Rueckwand
    for y in range(1, 33):
        for x in range(2, 26):
            c.put_ramp(x, y, 'wood', 1 if (x + y) % 2 else 0)
    for x in (0, 26):
        c.rect(x, 0, x + 1, 33, 'wood', 3)
        c.rect(x, 0, x, 33, 'wood', 5)
    c.rect(0, 0, 27, 1, 'wood', 4)
    c.rect(0, 0, 27, 0, 'wood', 5)
    boards = (11, 22, 33)
    kinds = ['bottle', 'flask', 'skull', 'globe', 'crystal', 'vase', 'books', 'mask', 'egg', 'teapot']
    rnd.shuffle(kinds)
    k = 0
    for bi, y in enumerate(boards):
        c.rect(0, y, 27, y + 0, 'wood', 5)
        if y < 33:
            c.rect(0, y + 1, 27, y + 1, 'wood', 3)
            c.rect(2, y + 2, 25, y + 2, 'wood', 0)
        x = 3
        while x < 21:
            kind = kinds[k % len(kinds)]
            k += 1
            _curio_item(c, kind, x, y - 1)
            x += 8 + rnd.randint(0, 1)
    c.outline()
    return c.flipped() if flip else c


def octopus_jar():
    """Krake im Glas auf Holzstaender: grosse Augen, Saugnaepfe am Glas (24 x 34)"""
    c = Canvas(24, 34)
    # Staender
    round_rect(c, 2, 27, 21, 33, 'wood', lo=1, hi=4, radius=1)
    c.rect(3, 27, 20, 27, 'wood', 5)
    # Glas (Koerper)
    round_rect(c, 3, 7, 20, 28, 'sky', lo=2, hi=4, radius=4, ambient=0.5)
    for y in range(8, 28):
        for x in range(4, 20):
            if c.px[y, x, 3] and (x + y) % 2 == 0:
                c.put_ramp(x, y, 'slime', 2 if y > 14 else 3)
    # Deckel + Kork
    c.rect(5, 5, 18, 7, 'metal', 3)
    c.rect(5, 5, 18, 5, 'metal', 5)
    c.rect(5, 7, 18, 7, 'metal', 1)
    c.rect(9, 2, 14, 4, 'wood', 3)
    c.rect(9, 2, 14, 2, 'wood', 5)
    # Krake: Kopf-Kuppel
    ellipse(c, 11.5, 14.5, 6.6, 5.8, 'cloth', lo=2, hi=5)
    for (x, y) in ((8, 11), (9, 10), (13, 11)):
        c.put_ramp(x, y, 'cloth', 5)
    # grosse Augen (2x2 weiss mit Pupille)
    c.rect(8, 15, 10, 17, 'bone', 5)
    c.rect(13, 15, 15, 17, 'bone', 5)
    c.rect(9, 16, 10, 17, 'coal', 1)
    c.rect(14, 16, 15, 17, 'coal', 1)
    # Tentakel (an der Scheibe)
    for (x0, y0, dx) in ((6, 19, -1), (9, 20, 0), (13, 20, 0), (17, 19, 1)):
        for k in range(7):
            x = x0 + dx * (k // 3) + (1 if (k // 2) % 2 and dx == 0 else 0)
            c.put_ramp(x, y0 + k, 'cloth', 3 if k % 2 else 4)
        c.put_ramp(x0 + dx * 2, y0 + 7, 'skin', 5)
    # Glanz am Glas
    c.rect(5, 10, 5, 22, 'sky', 5)
    c.put_ramp(6, 9, 'sky', 5)
    c.rect(18, 12, 18, 14, 'sky', 4)
    c.outline()
    return c


def skull_hat():
    """Totenkopf mit Zylinder und Monokel, auf kleinem Buecherstapel (16 x 24)"""
    c = Canvas(16, 24)
    # Buecherstapel
    for k, (x0, w, col) in enumerate(((1, 14, 'leaf'), (2, 12, 'teamA'))):
        y0 = 21 - k * 3
        c.rect(x0, y0, x0 + w - 1, y0 + 2, col, 3)
        c.rect(x0, y0, x0 + w - 1, y0, col, 5)
        c.rect(x0 + w - 1, y0 + 1, x0 + w - 1, y0 + 2, 'bone', 4)
    # Schaedel
    ellipse(c, 8, 14.5, 5.8, 5.2, 'bone', lo=2, hi=5)
    c.rect(5, 18, 11, 19, 'bone', 3)
    for x in range(5, 12, 2):
        c.put_ramp(x, 19, 'bone', 5)
    c.rect(4, 13, 6, 15, 'coal', 1)
    c.rect(9, 13, 11, 15, 'coal', 1)
    c.put_ramp(8, 16, 'coal', 2)
    # Monokel
    ellipse(c, 10, 14, 2.6, 2.6, 'gold', lo=2, hi=5)
    c.put_ramp(10, 14, 'coal', 1)
    c.line(12, 15, 14, 19, 'gold', 3)
    # Zylinder
    c.rect(1, 9, 14, 9, 'coal', 3)
    c.rect(1, 10, 14, 10, 'coal', 1)
    c.rect(4, 1, 11, 9, 'coal', 2)
    c.rect(4, 1, 5, 9, 'coal', 4)
    c.rect(4, 1, 11, 1, 'coal', 4)
    c.rect(4, 6, 11, 7, 'teamA', 3)
    c.put_ramp(10, 6, 'gold', 5)
    c.put_ramp(11, 6, 'gold', 4)
    c.outline()
    return c


def mounted_puffer():
    """ausgestopfter Kugelfisch als Wandtrophaee (16 x 14)"""
    c = Canvas(16, 14)
    for (x, y) in ((8, 0), (4, 1), (12, 1), (1, 5), (15, 5), (4, 11), (12, 11), (8, 12)):
        c.put_ramp(x, y, 'bone', 4)
    ellipse(c, 8, 6.5, 6.0, 5.0, 'gold', lo=2, hi=5)
    for (x, y) in ((3, 3), (6, 1), (10, 2), (13, 5), (2, 7), (13, 9)):
        c.put_ramp(x, y, 'bone', 5)
    c.rect(11, 5, 12, 6, 'coal', 1)
    c.rect(11, 5, 11, 5, 'bone', 5)
    c.rect(13, 8, 14, 8, 'coal', 1)
    poly(c, [(1, 5), (-1, 3), (-1, 10), (1, 8)], 'gold', lo=2, hi=4)
    c.outline()
    return c


def furnish_curio(ctx):
    P = ctx.P
    X0, Y0 = ctx.X0, ctx.Y0
    ctx.decor(mounted_puffer(), X0 + ctx.W // 2)
    ctx.prop(curio_shelf(2), X0 + 2, Y0 + 8)
    ctx.prop(curio_shelf(5, flip=True), X0 + ctx.W - 30, Y0 + 8)
    ctx.prop(octopus_jar(), X0 + 17, Y0 + 13)
    ctx.prop(skull_hat(), X0 + 43, Y0 + 24)


THEME_CURIO = {'floor': flat_floor('checker', 8), 'furnish': furnish_curio, 'low': False}


# =========================================================================== Chrono Shrine (BU-11)


def melting_clock():
    """Wanduhr mit Gesicht, das Zifferblatt tropft (30 x 34)"""
    c = Canvas(30, 34)
    cx, cy = 15, 13
    # Zifferblatt
    ellipse(c, cx, cy, 11.4, 11.0, 'gold', lo=1, hi=5)
    ellipse(c, cx, cy, 9.0, 8.6, 'bone', lo=3, hi=5, ambient=0.35)
    # Tropfen am unteren Rand: Gold + Zifferblatt laufen herunter
    for (x, ln_g, ln_b) in ((8, 6, 4), (12, 11, 8), (17, 8, 5), (21, 5, 3)):
        for k in range(ln_g):
            c.put_ramp(x, cy + 9 + k, 'gold', 4 if k < ln_g - 1 else 3)
            c.put_ramp(x + 1, cy + 9 + k, 'gold', 3 if k < ln_g - 1 else 2)
        c.put_ramp(x, cy + 9 + ln_g, 'gold', 4)
        c.put_ramp(x + 1, cy + 9 + ln_g, 'gold', 3)
        for k in range(ln_b):
            c.put_ramp(x, cy + 6 + k, 'bone', 4)
            c.put_ramp(x + 1, cy + 6 + k, 'bone', 3)
    # Markierungen
    for (dx, dy) in ((0, -7), (7, 0), (-7, 0), (0, 7)):
        c.put_ramp(cx + dx, cy + dy, 'gold', 3)
    for (dx, dy) in ((5, -5), (-5, -5), (5, 5), (-5, 5)):
        c.put_ramp(cx + dx, cy + dy, 'bone', 2)
    # Zeiger
    c.line(cx, cy, cx + 4, cy - 4, 'coal', 1)
    c.line(cx, cy, cx - 3, cy + 1, 'coal', 2)
    c.put_ramp(cx, cy, 'coal', 0)
    # Gesicht: zwei Augen, Mund
    c.rect(cx - 5, cy - 3, cx - 4, cy - 2, 'coal', 1)
    c.rect(cx + 3, cy - 3, cx + 4, cy - 2, 'coal', 1)
    c.rect(cx - 3, cy + 3, cx + 2, cy + 3, 'coal', 1)
    c.put_ramp(cx - 4, cy + 2, 'coal', 1)
    c.put_ramp(cx + 3, cy + 2, 'coal', 1)
    # Tropfen faellt
    c.rect(12, 32, 13, 33, 'bone', 4)
    c.put_ramp(12, 31, 'bone', 5)
    c.outline()
    return c


def hourglass(h=22, glass='sky', sand_frac=0.5, stream=True):
    """Sanduhr mit Goldkappen, Glas durchscheinend (Breite = h * 0.55)"""
    w = max(8, int(h * 0.55))
    if w % 2:
        w += 1
    c = Canvas(w, h)
    cx = (w - 1) / 2.0
    cap = 2
    # Glas (zwei Kegel)
    half_h = (h - 2 * cap) / 2.0
    for y in range(cap, h - cap):
        t = (y - cap) / float(h - 2 * cap - 1)
        d = abs(t - 0.5) * 2.0            # 1 oben/unten, 0 in der Mitte
        hw = 1.0 + d * (w / 2.0 - 2.2)
        for x in range(int(cx - hw), int(cx + hw) + 2):
            if abs(x - cx) <= hw + 0.2:
                edge = abs(abs(x - cx) - hw) < 0.9
                if edge:
                    c.put_ramp(x, y, glass, 5 if x < cx else 3)
                else:
                    c.put_ramp(x, y, glass, 4 if (x + y) % 2 else 3)
    # Sand oben (Fuellstand) und unten (Haeufchen)
    top_lvl = cap + 1 + int(half_h * (1 - sand_frac))
    for y in range(top_lvl, cap + int(half_h)):
        t = (y - cap) / float(h - 2 * cap - 1)
        hw = 1.0 + abs(t - 0.5) * 2.0 * (w / 2.0 - 2.2) - 1.0
        for x in range(int(cx - hw), int(cx + hw) + 2):
            if abs(x - cx) <= hw + 0.3:
                c.put_ramp(x, y, 'gold', 4 if x <= cx else 3)
    bot0 = h - cap - 1 - int(half_h * sand_frac * 0.9)
    for y in range(bot0, h - cap):
        t = (y - bot0) / float(max(1, h - cap - bot0))
        hw = 1.0 + t * (w / 2.0 - 2.5)
        for x in range(int(cx - hw), int(cx + hw) + 2):
            if abs(x - cx) <= hw + 0.3:
                c.put_ramp(x, y, 'gold', 5 if x < cx else 4)
    if stream:
        for y in range(cap + int(half_h) - 1, bot0):
            c.put_ramp(int(cx), y, 'gold', 5)
    # Kappen
    for y0, y1 in ((0, cap - 1), (h - cap, h - 1)):
        c.rect(0, y0, w - 1, y1, 'wood', 3)
        c.rect(0, y0, w - 1, y0, 'wood', 5)
        c.rect(0, y1, w - 1, y1, 'wood', 1)
    c.rect(1, 0, w - 2, 0, 'gold', 5)
    c.rect(1, h - 2, w - 2, h - 2, 'gold', 4)
    c.outline()
    return c


def crystal_pylon(h=34):
    """hoher Zeit-Kristall auf Steinsockel (14 x h)"""
    w = 14
    c = Canvas(w, h)
    cx = 7
    # Sockel
    round_rect(c, 1, h - 7, 12, h - 1, 'stone', lo=1, hi=4, radius=1)
    c.rect(2, h - 7, 11, h - 7, 'stone', 5)
    # Kristall (Sechskantprisma, Spitzen)
    top, bot = 1, h - 8
    L1, L2 = (2, top + 8), (2, bot - 5)
    R1, R2 = (11, top + 8), (11, bot - 5)
    M1, M2 = (cx - 0.5, top + 11), (cx - 0.5, bot - 2)
    poly(c, [(cx - 0.5, top), L1, L2, (cx - 0.5, bot), M2, M1], 'ice', lo=2, hi=5)
    poly(c, [(cx - 0.5, top), M1, M2, (cx - 0.5, bot), R2, R1], 'ice', lo=0, hi=3)
    c.rect(cx - 1, top + 11, cx - 1, bot - 3, 'ice', 5)
    for k in range(6):
        c.put_ramp(4, top + 9 + k, 'ice', 5)
    c.outline()
    return c


def floor_clock(r=21):
    """Zifferblatt-Ring auf dem Boden (Bodendekor, keine Zahlen): Ring, 12 Markierungen, zwei Zeiger"""
    d = r * 2 + 3
    c = Canvas(d, d)
    cx = cy = d // 2
    for y in range(d):
        for x in range(d):
            rr = math.hypot(x - cx, y - cy)
            if r - 1.2 <= rr <= r + 0.4:
                c.put_ramp(x, y, 'ice', 3 if (x + y) % 2 else 4)
            elif r - 2.5 <= rr < r - 1.2 and (x + y) % 2 == 0:
                c.put_ramp(x, y, 'purple', 3)
    for k in range(12):
        a = math.radians(k * 30 - 90)
        big = k % 3 == 0
        r0 = r - (6 if big else 4)
        for s in range(int(r0), r - 2):
            c.put_ramp(int(round(cx + math.cos(a) * s)), int(round(cy + math.sin(a) * s)), 'gold', 5 if big else 3)
    # Zeiger (zeigen auf kurz vor zwoelf)
    c.line(cx, cy, cx + 2, cy - 12, 'gold', 4)
    c.line(cx, cy, cx - 6, cy + 2, 'gold', 3)
    c.put_ramp(cx, cy, 'gold', 5)
    return c


def floating_mug():
    """schwebende Tasse mit eingefrorenen Tropfen (12 x 12)"""
    c = Canvas(12, 12)
    round_rect(c, 1, 5, 7, 10, 'bone', lo=2, hi=5, radius=2)
    c.rect(2, 5, 6, 5, 'wood', 3)
    c.put_ramp(8, 7, 'bone', 3)
    c.put_ramp(9, 7, 'bone', 3)
    c.put_ramp(9, 8, 'bone', 2)
    c.put_ramp(8, 9, 'bone', 3)
    for (x, y) in ((3, 2), (6, 0), (1, 3), (8, 3)):
        c.put_ramp(x, y, 'wood', 4)
        c.put_ramp(x, y + 1, 'wood', 3)
    c.outline()
    return c


def furnish_chrono(ctx):
    P = ctx.P
    X0, Y0 = ctx.X0, ctx.Y0
    clk = melting_clock()
    ctx.world.draw(clk, X0 + ctx.W // 2 - clk.w // 2, Y0 - 19, Y0 + 5)
    ctx.floor_deco(floor_clock(21), X0 + ctx.W // 2 - 22, Y0 + 5)
    ctx.prop(crystal_pylon(36), X0 + 4, Y0 + 10)
    ctx.prop(crystal_pylon(36), X0 + ctx.W - 18, Y0 + 10)


THEME_CHRONO = {'floor': flat_floor('crystal', 11), 'furnish': furnish_chrono, 'low': False}
