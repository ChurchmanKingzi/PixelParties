"""pack_art10: Tempel der Heiterkeit (BF-09) und Chaoskabinett (BF-10): Sprites und Raum-Themen."""
from __future__ import annotations

from pack_art10_kit import *


# =========================================================================== Tempel der Heiterkeit


def statue_smile(flip=False):
    """laechelnde Marmorstatue auf Sockel, Arme hoch, Heiligenschein, 24 x 46"""
    c = Canvas(24, 46)
    # Sockel
    round_rect(c, 2, 36, 21, 45, 'stone', lo=2, hi=5, radius=1)
    c.rect(1, 35, 22, 36, 'stone', 5)
    c.rect(1, 36, 22, 36, 'stone', 4)
    c.rect(9, 39, 14, 41, 'gold', 4)
    c.rect(9, 39, 14, 39, 'gold', 5)
    c.rect(2, 44, 21, 45, 'stone', 1)
    # Robe mit Falten
    poly(c, [(7, 35), (17, 35), (19, 21), (5, 21)], 'bone', lo=2, hi=5)
    for x, y0 in ((10, 24), (14, 22), (17, 26)):
        c.rect(x, y0, x, 34, 'bone', 2)
    c.rect(6, 28, 18, 28, 'gold', 3)
    c.rect(6, 28, 12, 28, 'gold', 4)
    # Arme (Hurra)
    thick_line(c, 6, 23, 2, 12, 2.8, 'bone', lo=2, hi=5)
    thick_line(c, 18, 23, 22, 12, 2.8, 'bone', lo=1, hi=4)
    ellipse(c, 2.5, 10.5, 2.0, 2.0, 'bone', lo=3, hi=5)
    ellipse(c, 21.5, 10.5, 2.0, 2.0, 'bone', lo=2, hi=4)
    # Hals und Kopf
    c.rect(10, 19, 14, 22, 'bone', 3)
    c.rect(10, 20, 14, 21, 'bone', 2)
    ellipse(c, 12, 14, 6.0, 5.8, 'bone', lo=2, hi=5)
    for (x, y) in ((8, 14), (9, 13), (10, 14), (14, 14), (15, 13), (16, 14)):     # frohe Augenboegen
        c.put_ramp(x, y, 'stone', 1)
    for x in range(9, 16):                                                      # breites Laecheln
        c.put_ramp(x, 17 if 10 <= x <= 14 else 16, 'stone', 1)
    # Heiligenschein
    for a in range(0, 360, 10):
        x = 12 + math.cos(math.radians(a)) * 6.5
        y = 5 + math.sin(math.radians(a)) * 2.0
        c.put_ramp(int(round(x)), int(round(y)), 'gold', 5 if a < 200 else 4)
    c.outline()
    return c.flipped() if flip else c


def piggy():
    """Sparschwein (Kollekte) mit Muenze im Schlitz, 24 x 18"""
    c = Canvas(24, 18)
    # Beine
    c.rect(6, 13, 8, 16, 'skin', 2)
    c.rect(15, 13, 17, 16, 'skin', 1)
    ellipse(c, 11.5, 10.5, 9.6, 6.4, 'skin', lo=2, hi=5)
    ellipse(c, 20, 10.5, 3.4, 3.0, 'skin', lo=3, hi=5)              # Schnauze
    c.put_ramp(19, 10, 'skin', 1)
    c.put_ramp(21, 10, 'skin', 1)
    poly(c, [(13, 4), (17, 5), (16, 9)], 'skin', lo=1, hi=4)        # Ohr
    c.put_ramp(17, 8, 'coal', 1)                                    # Auge
    c.put_ramp(17, 7, 'coal', 1)
    c.rect(7, 6, 12, 6, 'coal', 0)                                  # Muenzschlitz
    # Ringelschwanz
    c.put_ramp(1, 9, 'skin', 3)
    c.put_ramp(0, 8, 'skin', 3)
    c.put_ramp(1, 7, 'skin', 3)
    c.put_ramp(2, 8, 'skin', 2)
    # Muenze im Schlitz
    ellipse(c, 9.5, 3.0, 3.2, 3.0, 'gold', lo=3, hi=5)
    c.put_ramp(8, 2, 'gold', 5)
    c.put_ramp(9, 2, 'gold', 5)
    c.rect(10, 3, 11, 4, 'gold', 2)
    c.outline()
    return c


def altar_sun(w=34):
    """Altar mit goldener lachender Sonne, w x 26"""
    c = Canvas(w, 26)
    round_rect(c, 1, 10, w - 2, 24, 'stone', lo=2, hi=5, radius=1)
    c.rect(0, 5, w - 1, 10, 'bone', 4)
    c.rect(0, 5, w - 1, 6, 'bone', 5)
    c.rect(0, 10, w - 1, 10, 'stone', 2)
    c.rect(1, 24, w - 2, 25, 'stone', 1)
    # Sonne mit Gesicht
    cx, cy = w // 2, 17
    for a_ in range(0, 360, 30):
        x = cx + math.cos(math.radians(a_)) * 6.8
        y = cy + math.sin(math.radians(a_)) * 6.0
        c.rect(int(x) - 1 if abs(math.cos(math.radians(a_))) > 0.5 else int(x), int(y), int(x), int(y) + 1, 'gold', 4)
    ellipse(c, cx + 0.5, cy + 0.5, 4.8, 4.6, 'gold', lo=3, hi=5)
    c.put_ramp(cx - 2, cy - 1, 'fire', 2)
    c.put_ramp(cx + 2, cy - 1, 'fire', 2)
    for x in range(cx - 2, cx + 3):
        c.put_ramp(x, cy + 2 if abs(x - cx) < 2 else cy + 1, 'fire', 2)
    c.outline()
    return c


def pew(w=30):
    """Kirchenbank von vorn (Rueckenlehne, Sitz, Beine), Koepfe kommen separat, w x 14"""
    c = Canvas(w, 16)
    # Lehne
    round_rect(c, 0, 0, w - 1, 7, 'wood', lo=1, hi=4, radius=1)
    c.rect(0, 0, w - 1, 0, 'wood', 5)
    for x in range(4, w - 3, 6):
        c.rect(x, 2, x, 6, 'wood', 1)
    # Sitzbrett
    c.rect(0, 8, w - 1, 10, 'wood', 3)
    c.rect(0, 8, w - 1, 8, 'wood', 5)
    c.rect(0, 10, w - 1, 10, 'wood', 1)
    # Beine
    for x in (1, w - 4):
        c.rect(x, 11, x + 2, 15, 'wood', 2)
        c.rect(x, 11, x, 15, 'wood', 3)
    c.outline()
    return c


def head_back(hair='wood', hair_idx=3, skin_idx=4, hat=None):
    """Kopf von hinten (Besucher schaut zum Altar), 10 x 9"""
    c = Canvas(10, 9)
    ellipse(c, 5, 5.2, 4.2, 3.9, hair, lo=max(0, hair_idx - 2), hi=min(5, hair_idx + 1))
    c.rect(1, 6, 2, 8, 'skin', 3)             # Ohren
    c.rect(7, 6, 8, 8, 'skin', skin_idx)
    c.rect(2, 8, 7, 8, 'skin', 2)             # Nacken
    if hat:
        c.rect(2, 1, 7, 2, hat, 3)
    c.outline()
    return c


def rose_window():
    """Rosenfenster mit lachender Sonne, 24 x 22 (haengt an der Nordwand)"""
    c = Canvas(24, 22)
    cx, cy, R = 12, 11, 10.2
    cols = (('ice', 3), ('gold', 4), ('teamA', 3), ('leaf', 3), ('purple', 3), ('gold', 3), ('ice', 4), ('teamA', 2))
    for y in range(22):
        for x in range(24):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > R:
                continue
            ang = (math.atan2(dy, dx) + math.pi) / (2 * math.pi)
            k = int(ang * 8) % 8
            ramp, idx = cols[k]
            if d > R - 1.6:
                c.put_ramp(x, y, 'stone', 4 if dx + dy < 0 else 2)
            elif abs(((ang * 8) % 1.0) - 0.0) < 0.06 and d > 4.2:
                c.put_ramp(x, y, 'stone', 1)
            else:
                c.put_ramp(x, y, ramp, idx + (1 if d < 5 else 0))
    ellipse(c, cx + 0.5, cy + 0.5, 4.6, 4.6, 'gold', lo=3, hi=5)
    c.put_ramp(cx - 2, cy - 1, 'fire', 1)
    c.put_ramp(cx + 2, cy - 1, 'fire', 1)
    for x in range(cx - 2, cx + 3):
        c.put_ramp(x, cy + 2 if abs(x) < 3 and abs(x - cx) < 2 else cy + 1, 'fire', 1)
    c.outline()
    return c


def banner_sun():
    """Sonnen-Banner (gold, lachend), 12 x 22"""
    c = Canvas(12, 22)
    c.rect(1, 1, 10, 1, 'wood', 4)
    for y in range(2, 19):
        for x in range(2, 10):
            c.put_ramp(x, y, 'gold', 4 if x < 6 else 3)
    for (x, y) in ((3, 19), (4, 19), (5, 19), (6, 20), (7, 19), (8, 19), (9, 19), (5, 20)):
        c.put_ramp(x, y, 'gold', 3)
    ellipse(c, 6, 9, 3.2, 3.2, 'fire', lo=3, hi=5)
    c.put_ramp(5, 8, 'coal', 1)
    c.put_ramp(7, 8, 'coal', 1)
    c.rect(5, 10, 7, 10, 'coal', 1)
    for (x, y) in ((6, 4), (6, 14), (2, 9), (10, 9)):
        c.put_ramp(x, y, 'fire', 3)
    c.outline()
    return c


def runner(h=60):
    """Laeufer-Teppich (Bodendekor), 18 x h"""
    c = Canvas(18, h)
    for y in range(h):
        for x in range(18):
            edge = min(x, 17 - x)
            if edge == 0:
                idx, ramp = 1, 'teamA'
            elif edge == 1:
                idx, ramp = 4, 'gold'
            elif edge == 2:
                idx, ramp = 2, 'teamA'
            else:
                idx, ramp = (3 if ((x + y // 3) % 2 == 0) else 2), 'teamA'
            c.put_ramp(x, y, ramp, idx)
    for y in range(4, h - 3, 9):
        for k in range(-2, 3):
            c.put_ramp(9 + k, y + 2 - abs(k), 'gold', 4)
        c.put_ramp(9, y + 2, 'gold', 5)
    return c


def light_pool(rx=15, ry=9):
    """Lichtfleck auf dem Boden (Schachbrett-Dither), Bodendekor"""
    w, h = rx * 2 + 3, ry * 2 + 3
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            d = ((x + 0.5 - w / 2) / rx) ** 2 + ((y + 0.5 - h / 2) / ry) ** 2
            if d < 0.35:
                c.put_ramp(x, y, 'gold', 5 if (x + y) % 2 == 0 else 4)
            elif d < 1.0 and (x + y) % 2 == 0:
                c.put_ramp(x, y, 'bone', 5)
    return c


def light_beam(x_top, x_bot, y0, y1, half_top=6, half_bot=15):
    """Lichtstrahl als Schraegstreifen im Raum, spaerlich gedithert (Sprite, Ursprung oben links)"""
    xs = [x_top - half_top, x_top + half_top, x_bot + half_bot, x_bot - half_bot]
    x0, x1 = int(min(xs)), int(max(xs)) + 1
    c = Canvas(x1 - x0 + 2, y1 - y0 + 1)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, (y1 - y0))
        xc = x_top + (x_bot - x_top) * t
        hw = half_top + (half_bot - half_top) * t
        for x in range(int(xc - hw), int(xc + hw) + 1):
            u = (x - (xc - hw)) / max(1.0, 2 * hw)
            if (x + 2 * y) % 6 == 0 or (u < 0.08 and (x + y) % 3 == 0):
                c.put_ramp(x - x0, y - y0, 'gold', 5 if u < 0.3 else 4)
    return c, x0


def nun():
    """Segens-Nonne: violette Tracht, weisse Haube, wirft ihren Heiligenschein wie ein Frisbee, 20 x 24"""
    c = Canvas(20, 24)
    thick_line(c, 7, 19, 7, 22, 2.6, 'coal', lo=2, hi=3)
    thick_line(c, 11, 19, 11, 22, 2.6, 'coal', lo=2, hi=4)
    c.rect(5, 22, 8, 23, 'coal', 2)
    c.rect(10, 22, 13, 23, 'coal', 3)
    poly(c, [(5, 11), (13, 11), (16, 22), (2, 22)], 'purple', lo=1, hi=4)
    c.rect(2, 21, 16, 22, 'purple', 1)
    poly(c, [(7, 11), (11, 11), (9, 18)], 'bone', lo=3, hi=5)           # Latz
    c.rect(8, 13, 9, 15, 'gold', 4)
    c.rect(7, 14, 10, 14, 'gold', 4)
    # Arme: rechts ausgestreckt (Wurf)
    thick_line(c, 12, 12, 17, 8, 2.4, 'purple', lo=2, hi=4)
    c.rect(17, 7, 18, 8, 'skin', 4)
    thick_line(c, 6, 13, 4, 17, 2.2, 'purple', lo=1, hi=3)
    # Kopf mit Haube
    ellipse(c, 9, 7.5, 3.9, 3.8, 'skin', lo=2, hi=5)
    c.put_ramp(11, 8, 'coal', 1)
    poly(c, [(4, 11), (14, 11), (14, 5), (9, 2), (4, 5)], 'bone', lo=3, hi=5)
    ellipse(c, 9.5, 8.5, 2.7, 2.7, 'skin', lo=2, hi=5)
    c.put_ramp(10, 8, 'coal', 1)
    c.put_ramp(11, 8, 'coal', 1)
    c.put_ramp(9, 11, 'skin', 1)
    c.outline()
    return c


def halo_disc():
    """fliegender Heiligenschein (Frisbee), 12 x 6"""
    c = Canvas(12, 6)
    ellipse(c, 6, 3, 5.4, 2.4, 'gold', lo=3, hi=5)
    ellipse(c, 6, 3, 2.8, 1.0, 'gold', lo=0, hi=1)
    c.outline()
    return c


def furnish_temple(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    cx = X0 + W // 2
    ctx.decor(rose_window(), cx)
    ctx.decor(banner_sun(), X0 + 14)
    ctx.decor(banner_sun(), X0 + W - 14)
    ctx.floor_deco(runner(H - 38), cx - 9, Y0 + 30)
    ctx.floor_deco(light_pool(), cx - 18, Y0 + 28)
    ctx.prop(altar_sun(34), cx - 17, Y0 + 12)
    ctx.prop(piggy(), cx - 12, Y0 + 12 - 12, key_add=4)
    ctx.prop(statue_smile(), X0 + 4, Y0 + 2)
    ctx.prop(statue_smile(flip=True), X0 + W - 28, Y0 + 2)
    ctx.prop(pew(26), X0 + 8, Y0 + 56)
    ctx.prop(pew(26), X0 + W - 34, Y0 + 56)


THEME_TEMPLE = {'floor': tile_checker('sky', 2, 'sky', 3, cell=8, seed=3), 'furnish': furnish_temple, 'low': False}


# =========================================================================== Chaoskabinett


def tile_chaos(seed=5):
    """wild gemusterter Boden: Schachbrett in schiefen Farben"""
    c = Canvas(32, 32)
    rnd = random.Random(seed)
    cols = [('purple', 2), ('purple', 3), ('cloth', 2), ('teamB', 2), ('purple', 1), ('gold', 3), ('slime', 2), ('teamA', 2)]
    wts = [4, 4, 3, 2, 3, 1, 1, 1]
    pool = [c_ for c_, w in zip(cols, wts) for _ in range(w)]
    for gy in range(4):
        for gx in range(4):
            ramp, idx = rnd.choice(pool)
            for yy in range(8):
                for xx in range(8):
                    i = idx
                    if xx == 0 or yy == 0:
                        i = min(5, idx + 1)
                    elif xx == 7 or yy == 7:
                        i = max(0, idx - 1)
                    elif (xx + yy) % 4 == 0 and rnd.random() < 0.2:
                        i = max(0, idx - 1)
                    c.put_ramp(gx * 8 + xx, gy * 8 + yy, ramp, i)
    return c.px[:, :, :3].copy()


def chaos_cabinet():
    """Schrank mit drei offenen Tueren (links, rechts, Klappe oben); es lugt heraus: Augen, Frosch, Nudeln, Clownsschuh. 52 x 56"""
    c = Canvas(52, 56)
    # linke Tuer (weit nach aussen aufgeschwungen)
    poly(c, [(11, 12), (1, 6), (1, 46), (11, 52)], 'purple', lo=1, hi=4)
    c.rect(1, 6, 1, 46, 'purple', 5)
    c.rect(3, 12, 8, 14, 'purple', 3)
    c.put_ramp(3, 30, 'gold', 5)
    c.put_ramp(4, 30, 'gold', 4)
    # rechte Tuer
    poly(c, [(41, 12), (51, 6), (51, 46), (41, 52)], 'purple', lo=0, hi=2)
    c.rect(51, 6, 51, 46, 'purple', 1)
    c.put_ramp(48, 30, 'gold', 4)
    # Korpus
    round_rect(c, 10, 11, 42, 52, 'wood', lo=1, hi=3, radius=1)
    # Innenraum (dunkel)
    c.rect(13, 14, 39, 49, 'coal', 0)
    chk(c, 13, 14, 39, 49, 'coal', 1, phase=1)
    # Regalbretter
    for y in (28, 40):
        c.rect(13, y, 39, y + 1, 'wood', 3)
        c.rect(13, y, 39, y, 'wood', 4)
    # Klappe oben (nach oben aufgeklappt)
    poly(c, [(11, 11), (41, 11), (38, 3), (14, 3)], 'purple', lo=2, hi=5)
    c.rect(14, 3, 38, 3, 'purple', 5)
    c.rect(24, 6, 28, 8, 'gold', 4)
    c.put_ramp(26, 7, 'gold', 5)
    # Kronenleiste
    c.rect(10, 11, 42, 12, 'wood', 4)
    c.rect(10, 52, 42, 55, 'wood', 1)
    c.rect(10, 52, 42, 52, 'wood', 2)
    # --- Inhalt: grosse Augen im Dunkeln (blicken verschieden)
    for (ex, ey, px_, py_) in ((20, 19, 1, 0), (29, 18, -1, 1)):
        ellipse(c, ex + 0.5, ey + 0.5, 3.6, 3.6, 'bone', lo=3, hi=5)
        c.rect(ex + px_, ey + py_ - 1, ex + px_ + 1, ey + py_ + 1, 'coal', 1)
        c.put_ramp(ex + px_, ey + py_ - 1, 'bone', 5)
    c.rect(18, 15, 32, 15, 'coal', 0)
    # Frosch auf dem mittleren Brett
    ellipse(c, 33.5, 35.5, 5.2, 4.0, 'leaf', lo=1, hi=4)
    for ex in (30, 36):
        ellipse(c, ex + 0.5, 31.5, 2.0, 2.0, 'leaf', lo=2, hi=5)
        c.put_ramp(ex, 31, 'gold', 5)
        c.put_ramp(ex + 1, 31, 'coal', 1)
    c.rect(31, 36, 37, 36, 'coal', 1)
    c.put_ramp(31, 35, 'coal', 1)
    c.put_ramp(37, 35, 'coal', 1)
    # Nudeln quellen aus dem unteren Fach heraus und haengen ueber die Kante
    for k, x in enumerate((16, 19, 22, 25)):
        for y in range(41, 58):
            xx = x + int(round(1.6 * math.sin((y + k * 3) / 2.2)))
            c.put_ramp(xx, y, 'gold', 5 if (y + k) % 3 else 4)
            c.put_ramp(xx + 1, y, 'gold', 3)
    c.rect(18, 43, 19, 44, 'fire', 3)
    c.put_ramp(24, 49, 'fire', 3)
    # roter Clownsschuh ragt heraus
    ellipse(c, 33.5, 47.5, 5.4, 2.8, 'teamA', lo=2, hi=5)
    c.rect(28, 44, 31, 46, 'teamA', 3)
    c.put_ramp(37, 46, 'gold', 5)
    c.outline()
    return c


def clown():
    """Jongleur-Clown mit Riesenschuhen, Regenbogen-Perücke und roter Nase, 22 x 28"""
    c = Canvas(22, 28)
    # Riesenschuhe
    ellipse(c, 6.5, 25.5, 5.6, 2.4, 'fire', lo=1, hi=4)
    ellipse(c, 15.5, 25.5, 5.6, 2.4, 'fire', lo=2, hi=5)
    c.rect(2, 26, 19, 26, 'fire', 1)
    # Beine (gestreift)
    thick_line(c, 8, 20, 7, 24, 3.0, 'leaf', lo=1, hi=3)
    thick_line(c, 14, 20, 15, 24, 3.0, 'leaf', lo=2, hi=4)
    # Koerper: weiter Anzug mit Punkten
    round_rect(c, 5, 12, 17, 21, 'gold', lo=2, hi=5, radius=3)
    for (x, y) in ((7, 15), (10, 18), (13, 14), (15, 18), (8, 20)):
        c.rect(x, y, x + 1, y + 1, 'teamA', 3)
    c.rect(5, 13, 17, 13, 'purple', 3)                  # Kragen
    for x in range(5, 18, 2):
        c.put_ramp(x, 12, 'bone', 5)
    # Arme jonglieren (nach oben)
    thick_line(c, 5, 14, 2, 9, 2.4, 'gold', lo=1, hi=4)
    thick_line(c, 17, 14, 20, 9, 2.4, 'gold', lo=3, hi=5)
    c.rect(1, 7, 2, 8, 'bone', 5)
    c.rect(19, 7, 20, 8, 'bone', 4)
    # Kopf
    ellipse(c, 11, 8, 4.4, 4.2, 'bone', lo=3, hi=5)
    c.put_ramp(9, 7, 'coal', 1)
    c.put_ramp(13, 7, 'coal', 1)
    ellipse(c, 11.5, 9.2, 1.7, 1.7, 'fire', lo=3, hi=5)
    for x in range(8, 15):
        c.put_ramp(x, 11, 'teamA', 3 if 9 <= x <= 13 else 2)
    # Perücke in Regenbogenfarben
    for (cxp, cyp, col) in ((5.5, 6.5, 'fire'), (8, 3.5, 'gold'), (14, 3.5, 'leaf'), (16.5, 6.5, 'ice'), (11, 2.5, 'purple')):
        ellipse(c, cxp, cyp, 2.8, 2.8, col, lo=2, hi=5)
    c.outline()
    return c


def frog_small():
    """kleiner huepfender Frosch, 14 x 11"""
    c = Canvas(14, 11)
    thick_line(c, 3, 8, 1, 9, 2.0, 'leaf', lo=1, hi=3)
    c.rect(0, 9, 3, 10, 'leaf', 2)
    ellipse(c, 7.5, 6.5, 5.4, 3.6, 'leaf', lo=1, hi=5)
    c.rect(10, 9, 13, 10, 'leaf', 3)
    for ex in (9, 12):
        ellipse(c, ex + 0.5, 3.2, 1.9, 1.9, 'leaf', lo=2, hi=5)
        c.put_ramp(ex, 3, 'bone', 5)
        c.put_ramp(ex + 1, 3, 'coal', 1)
    c.rect(9, 7, 13, 7, 'coal', 1)
    c.outline()
    return c


def wonky_clock():
    """Uhr mit zu vielen Zeigern, 14 x 14 (Wanddeko)"""
    c = Canvas(14, 14)
    ellipse(c, 7, 7, 6.2, 6.2, 'gold', lo=2, hi=5)
    ellipse(c, 7, 7.5, 4.6, 4.6, 'bone', lo=3, hi=5)
    for (dx, dy) in ((0, -4), (4, 0), (0, 4), (-4, 0), (3, -3), (-3, 3), (3, 3)):
        c.put_ramp(7 + dx, 7 + dy, 'coal', 2)
    c.line(7, 7, 7, 3, 'coal', 1)
    c.line(7, 7, 10, 9, 'coal', 1)
    c.line(7, 7, 4, 10, 'fire', 3)
    c.put_ramp(7, 7, 'coal', 0)
    c.outline()
    return c


def crooked_painting():
    """auf dem Kopf haengendes Bild (Sonne unten, Himmel oben), 16 x 16"""
    c = Canvas(16, 16)
    round_rect(c, 0, 0, 15, 15, 'gold', lo=2, hi=5, radius=1)
    for y in range(2, 14):
        for x in range(2, 14):
            c.put_ramp(x, y, 'leaf' if y < 7 else 'sky', 3 if y < 7 else 4)
    ellipse(c, 8, 10, 2.6, 2.6, 'gold', lo=3, hi=5)
    c.rect(6, 5, 9, 6, 'leaf', 4)
    c.put_ramp(7, 10, 'coal', 1)
    c.put_ramp(9, 10, 'coal', 1)
    c.outline()
    return c


def furnish_chaos(ctx):
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    cx = X0 + W // 2
    ctx.decor(wonky_clock(), X0 + 14)
    ctx.decor(crooked_painting(), X0 + W - 14)
    ctx.prop(chaos_cabinet(), cx - 26, Y0 - 19)


THEME_CHAOS = {'floor': tile_chaos(5), 'furnish': furnish_chaos, 'low': False}
