"""Verteidiger UV-12..UV-17 (breit, gross, stabil). Alle Figuren blicken nach rechts."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art5_kit import *


# =========================================================================== UV-12 Zahnrad-Zenturio (56 x 48)


def spr_cogwheel_centurion(anim='idle', f=0):
    c = Canvas(56, 48)
    # Stuetzraeder + Achsen
    thick_line(c, 6, 43, 19, 38, 3.0, 'metal', lo=0, hi=3)
    thick_line(c, 19, 38, 34, 43, 3.0, 'metal', lo=0, hi=3)
    for wx in (6, 34):
        ellipse(c, wx, 43.5, 4.0, 4.0, 'metal', lo=0, hi=4)
        ellipse(c, wx, 43.5, 1.6, 1.6, 'gold', lo=2, hi=4)
    # grosse Walze (Seitenansicht = Kreis) mit Nietenring und Zahnrad-Nabe
    ellipse(c, 19, 38, 9.4, 9.4, 'metal', lo=0, hi=4, ambient=0.15)
    ellipse(c, 19, 38, 6.4, 6.4, 'metal', lo=0, hi=3, ambient=0.25, bias=-0.1)
    for a in range(0, 360, 45):
        r = math.radians(a)
        c.put_ramp(int(19 + math.cos(r) * 8.2 - 0.5), int(38 + math.sin(r) * 8.2 - 0.5), 'metal', 5 if a in (180, 225, 270) else 2)
    gear(c, 19, 38, 3.6, 'gold', lo=2, hi=5, teeth=8, rot=0.4)
    # Pteruges (Lederstreifenrock) in Teamfarbe
    for k, x in enumerate(range(10, 28, 3)):
        c.rect(x, 29, x + 1, 32 + (k % 2), 'teamA', 3)
        c.put_ramp(x, 29, 'teamA', 4)
        c.put_ramp(x + 1, 31 + (k % 2), 'teamA', 2)
        c.put_ramp(x + 1, 32 + (k % 2), 'teamA', 2)
    hline(c, 10, 28, 28, 'gold', 3)
    hline(c, 10, 28, 27, 'gold', 4)
    # Rumpf
    round_rect(c, 9, 14, 28, 28, 'metal', lo=1, hi=4, radius=3)
    dither_box(c, 22, 15, 27, 27, 'metal', 1, 2)
    hline(c, 10, 27, 19, 'metal', 1)
    hline(c, 10, 27, 25, 'metal', 1)
    for (x, y) in ((11, 16), (26, 16), (11, 26), (26, 26)):
        c.put_ramp(x, y, 'metal', 5)
    gear(c, 18, 22, 3.7, 'gold', lo=2, hi=5, teeth=8, rot=0.0)
    # Schulterplatten
    ellipse(c, 9.5, 16.5, 3.8, 3.4, 'metal', lo=1, hi=5)
    ellipse(c, 28.0, 16.5, 3.4, 3.0, 'metal', lo=0, hi=3)
    # Kopf mit Visier (blickt nach rechts unten auf die Zeitung)
    round_rect(c, 11, 5, 26, 14, 'metal', lo=1, hi=5, radius=3)
    c.rect(15, 8, 26, 11, 'coal', 0)
    c.put_ramp(23, 10, 'gold', 5)
    c.put_ramp(24, 10, 'gold', 4)
    c.put_ramp(25, 10, 'gold', 5)
    c.put_ramp(23, 9, 'gold', 3)
    hline(c, 15, 26, 12, 'metal', 0)
    hline(c, 12, 25, 13, 'metal', 0)
    vline(c, 15, 12, 14, 'metal', 4)
    # Zenturio-Kamm quer ueber die Kuppel (Seitenansicht: lang, vorn und hinten spitz)
    for x in range(10, 28):
        t = (x - 10) / 17.0
        h = int(round(5.2 * math.sin(math.pi * (0.04 + 0.92 * t)) ** 0.7))
        for y in range(5 - h, 6):
            lit = y - (5 - h)
            tone = 4 if lit <= 1 else (3 if lit <= 3 else 2)
            if x % 3 == 0:
                tone -= 1
            c.put_ramp(x, y, 'teamA', max(1, tone))
    hline(c, 11, 26, 6, 'metal', 4)
    # Gatling vor der Brust (Arm + Gehaeuse + drei Laeufe)
    thick_line(c, 28, 19, 33, 24, 4.0, 'metal', lo=1, hi=4)
    round_rect(c, 30, 21, 40, 30, 'metal', lo=0, hi=3, radius=1)
    for k in range(3):
        y0 = 21 + k * 3
        c.rect(40, y0, 52, y0 + 1, 'metal', 3 if k != 1 else 2)
        hline(c, 41, 51, y0, 'metal', 5 if k != 1 else 4)
    c.rect(52, 21, 54, 29, 'metal', 1)
    c.rect(47, 21, 47, 29, 'coal', 2)
    for y in (21, 24, 27):
        c.rect(54, y, 55, y + 1, 'coal', 0)
    c.put_ramp(33, 27, 'gold', 4)
    c.put_ramp(35, 27, 'gold', 4)
    # Zeitung: grosse Seite, hochgehalten, mit Falz, Schlagzeile, Foto und Textzeilen
    thick_line(c, 27, 18, 32, 19, 3.2, 'metal', lo=0, hi=3)
    for y in range(2, 20):
        for x in range(31, 47):
            u = (x - 31) / 15.0
            tone = 5 if u < 0.2 else (4 if u < 0.7 else 3)
            if y >= 18:
                tone = max(2, tone - 1)
            c.put_ramp(x, y, 'bone', tone)
    for k in range(18):                              # Falz in der Mitte
        c.put_ramp(39, 2 + k, 'bone', 2)
    hline(c, 33, 45, 4, 'coal', 2)
    hline(c, 33, 45, 5, 'coal', 2)
    c.rect(33, 7, 38, 12, 'sky', 3)
    c.rect(33, 7, 35, 8, 'sky', 4)
    c.rect(36, 10, 38, 12, 'sky', 2)
    for y in (7, 9, 11):
        for x in range(40, 46):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y, 'stone', 2)
    for y in (14, 16):
        for x in range(33, 46):
            if (x + y) % 2 == 0 and x != 39:
                c.put_ramp(x, y, 'stone', 2)
    # Daumen vorn am Rand
    c.rect(31, 18, 32, 20, 'metal', 3)
    # Patronenkasten unter der Gatling und Gurt
    round_rect(c, 31, 29, 38, 33, 'gold', lo=1, hi=4, radius=1)
    for (x, y) in ((39, 31), (40, 32), (41, 32), (42, 31), (41, 30)):
        c.put_ramp(x, y, 'gold', 4)
    c.outline()
    return c


# =========================================================================== UV-13 Paladin-Pinguin (44 x 48)


def spr_paladin_penguin(anim='idle', f=0):
    c = Canvas(44, 48)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Pfuetze + Eisscholle
    ellipse(c, 22, 43, 20.5, 4.4, 'sky', lo=1, hi=3, ambient=0.3, flatness=0.5)
    for y in range(36, 45):
        for x in range(5, 40):
            dx = (x + 0.5 - 22) / 16.5
            dy = (y + 0.5 - 40) / 4.6
            if dx * dx + dy * dy <= 1.0 and y >= 40:
                tone = 3 if x < 17 else 2
                if (x + y) % 2 == 0 and x > 26:
                    tone = 1
                if y >= 43:
                    tone = 1 if (x + y) % 2 else 2
                c.put_ramp(x, y, 'ice', tone)
    ellipse(c, 22, 40, 16.5, 4.6, 'ice', lo=2, hi=5, ambient=0.3, flatness=0.45)
    for (x, y) in ((11, 41), (12, 41), (13, 42), (30, 40), (31, 41), (16, 38), (28, 38)):
        c.put_ramp(x, y, 'ice', 5)
    for (x, y) in ((29, 42), (30, 42), (31, 43), (18, 43)):
        c.put_ramp(x, y, 'ice', 1)
    # Fuesse
    for fx in (16, 24):
        poly(c, [(fx, 36), (fx + 6, 36), (fx + 8, 40), (fx - 1, 40)], 'fire', lo=2, hi=4)
        c.put_ramp(fx + 3, 40, 'fire', 1)
    # Schwert (hinterer Fluegel hebt es), links hinter dem Koerper
    thick_line(c, 7, 24 + bob, 5, 6 + bob, 2.4, 'metal', lo=2, hi=5)
    c.line(5, 7 + bob, 5, 24 + bob, 'metal', 5)
    c.rect(2, 24 + bob, 9, 25 + bob, 'gold', 4)
    c.put_ramp(2, 24 + bob, 'gold', 5)
    c.put_ramp(9, 25 + bob, 'gold', 2)
    c.rect(4, 26 + bob, 6, 27 + bob, 'wood', 3)
    c.put_ramp(5, 28 + bob, 'gold', 4)
    # Koerper: dunkles Federkleid
    ellipse(c, 20, 24 + bob, 10.6, 14.2, 'coal', lo=0, hi=3, ambient=0.3)
    ellipse(c, 23, 27 + bob, 6.6, 10.5, 'fur', lo=2, hi=5, ambient=0.35)
    # Brustpanzer
    poly(c, [(15, 19 + bob), (29, 19 + bob), (30, 28 + bob), (26, 35 + bob), (18, 35 + bob), (14, 28 + bob)], 'metal', lo=1, hi=5)
    hline(c, 15, 29, 19 + bob, 'gold', 4)
    hline(c, 14, 30, 20 + bob, 'gold', 2)
    hline(c, 17, 27, 34 + bob, 'gold', 3)
    dither_box(c, 22, 21 + bob, 29, 33 + bob, 'metal', 1, 2)
    # Kreuz
    c.rect(21, 24 + bob, 22, 30 + bob, 'gold', 5)
    c.rect(18, 26 + bob, 25, 27 + bob, 'gold', 5)
    c.put_ramp(22, 25 + bob, 'gold', 4)
    # Schulterplatte
    ellipse(c, 15.5, 20 + bob, 4.2, 3.4, 'metal', lo=1, hi=5)
    ellipse(c, 28.5, 20 + bob, 3.8, 3.2, 'metal', lo=0, hi=3)
    # vorderer Fluegel mit Schild
    thick_line(c, 29, 22 + bob, 33, 28 + bob, 3.6, 'coal', lo=0, hi=3)
    poly(c, [(29, 25 + bob), (41, 25 + bob), (41, 33 + bob), (35, 41 + bob), (29, 33 + bob)], 'teamA', lo=1, hi=4)
    hline(c, 29, 41, 25 + bob, 'gold', 4)
    vline(c, 29, 25 + bob, 33 + bob, 'gold', 3)
    c.rect(34, 27 + bob, 35, 37 + bob, 'gold', 5)
    c.rect(31, 30 + bob, 39, 31 + bob, 'gold', 5)
    # Kopf
    ellipse(c, 21, 12 + bob, 8.0, 7.4, 'coal', lo=0, hi=3, ambient=0.3)
    ellipse(c, 24.2, 14.2 + bob, 4.6, 4.2, 'fur', lo=3, hi=5, ambient=0.4)
    c.put_ramp(26, 12 + bob, 'coal', 0)
    c.put_ramp(26, 13 + bob, 'coal', 0)
    c.put_ramp(27, 12 + bob, 'coal', 0)
    # Schnabel
    poly(c, [(27, 13 + bob), (35, 15 + bob), (27, 18 + bob)], 'fire', lo=2, hi=5)
    c.line(28, 16 + bob, 34, 16 + bob, 'fire', 2)
    # Helm: Kuppel mit Nasensteg und Teamfeder
    def cap(x, y):
        return y <= 10 + bob
    ellipse(c, 21, 10 + bob, 8.4, 6.6, 'metal', lo=1, hi=5, clip=cap)
    hline(c, 13, 29, 10 + bob, 'metal', 0)
    hline(c, 14, 28, 9 + bob, 'gold', 3)
    c.rect(26, 10 + bob, 27, 14 + bob, 'metal', 3)
    for k in range(7):
        x = 15 - k
        y = 3 + bob - k // 3 + int(1.2 * math.sin(k * 0.8))
        c.put_ramp(x, y, 'teamA', 4)
        c.put_ramp(x, y + 1, 'teamA', 3)
        c.put_ramp(x, y + 2, 'teamA', 2)
    c.put_ramp(18, 4 + bob, 'teamA', 4)
    # Heiligenschein
    for ang in range(0, 360, 14):
        a = math.radians(ang)
        x = 21 + math.cos(a) * 7.5
        y = 1.6 + bob * 0 + math.sin(a) * 2.0
        c.put_ramp(int(round(x)), int(round(y)), 'gold', 5 if ang < 180 else 4)
    c.outline()
    return c


# =========================================================================== UV-14 Riesen-Butler (46 x 64)


def spr_giant_butler(anim='idle', f=0):
    c = Canvas(46, 64)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Frackschoesse (hinten links)
    poly(c, [(9, 38 + bob), (17, 40 + bob), (15, 58), (7, 56), (4, 50)], 'coal', lo=0, hi=3)
    poly(c, [(5, 44 + bob), (12, 42 + bob), (13, 58), (6, 58)], 'coal', lo=0, hi=2)
    vline(c, 9, 46, 57, 'coal', 0)
    # hinterer Arm mit Serviette ueber dem Unterarm
    thick_line(c, 10, 25 + bob, 6, 40 + bob, 6.0, 'coal', lo=0, hi=3)
    poly(c, [(2, 38 + bob), (10, 38 + bob), (10, 47 + bob), (3, 47 + bob)], 'bone', lo=3, hi=5)
    vline(c, 6, 39 + bob, 46 + bob, 'bone', 2)
    hline(c, 3, 9, 46 + bob, 'bone', 2)
    ellipse(c, 6.5, 50 + bob, 3.0, 2.8, 'bone', lo=3, hi=5)
    # Beine mit Nadelstreifen
    for (x0, x1, base) in ((12, 19, 1), (24, 31, 2)):
        round_rect(c, x0, 44, x1, 60, 'coal', lo=base, hi=base + 2, radius=2)
        for x in range(x0 + 1, x1, 3):
            vline(c, x, 46, 59, 'stone', 2, only_filled=True)
    # Schuhe (Lack)
    for (x0, w) in ((9, 11), (22, 12)):
        round_rect(c, x0, 59, x0 + w, 63, 'coal', lo=0, hi=3, radius=2)
        hline(c, x0 + 2, x0 + w - 3, 59, 'stone', 4)
        c.put_ramp(x0 + 3, 60, 'bone', 5)
    # Frack-Rumpf: breite Schultern, schmale Taille
    poly(c, [(8, 21 + bob), (34, 21 + bob), (32, 34 + bob), (29, 46 + bob), (14, 46 + bob), (11, 34 + bob)], 'coal', lo=0, hi=4)
    dither_box(c, 26, 24 + bob, 33, 45 + bob, 'coal', 0, 1)
    # Hemdbrust (V) + Revers
    poly(c, [(15, 21 + bob), (27, 21 + bob), (23, 37 + bob), (19, 37 + bob)], 'bone', lo=3, hi=5)
    poly(c, [(14, 21 + bob), (18, 21 + bob), (19, 36 + bob), (16, 28 + bob)], 'coal', lo=3, hi=4)
    poly(c, [(28, 21 + bob), (24, 21 + bob), (23, 36 + bob), (26, 28 + bob)], 'coal', lo=1, hi=3)
    vline(c, 21, 26 + bob, 36 + bob, 'bone', 3)
    for y in (28, 31, 34):
        c.put_ramp(21, y + bob, 'gold', 5)
    c.put_ramp(20, 28 + bob, 'gold', 3)
    # Kragen + Fliege (Teamfarbe)
    hline(c, 15, 27, 20 + bob, 'bone', 5)
    hline(c, 16, 26, 19 + bob, 'bone', 4)
    poly(c, [(21, 23 + bob), (15, 20 + bob), (15, 26 + bob)], 'teamA', lo=2, hi=4)
    poly(c, [(21, 23 + bob), (27, 20 + bob), (27, 26 + bob)], 'teamA', lo=1, hi=3)
    c.put_ramp(21, 22 + bob, 'teamA', 4)
    c.put_ramp(21, 23 + bob, 'teamA', 3)
    c.put_ramp(21, 24 + bob, 'teamA', 2)
    # Schulter-Rundung
    ellipse(c, 10.5, 25 + bob, 4.4, 4.6, 'coal', lo=1, hi=4)
    ellipse(c, 33, 25 + bob, 4.2, 4.4, 'coal', lo=0, hi=3)
    # Silbertablett als Schild (vorne rechts), Arm dahinter
    thick_line(c, 33, 25 + bob, 31, 36 + bob, 6.2, 'coal', lo=0, hi=3)
    ellipse(c, 35, 36 + bob, 10.4, 12.4, 'metal', lo=2, hi=5, ambient=0.3, flatness=0.55)
    for ang in range(0, 360, 10):
        a = math.radians(ang)
        x = 35 + math.cos(a) * 9.8
        y = 36 + bob + math.sin(a) * 11.6
        lit = (math.cos(a) * -0.55 + math.sin(a) * -0.65) > 0
        c.put_ramp(int(round(x - 0.5)), int(round(y - 0.5)), 'bone', 5 if lit else 3)
    ellipse(c, 35, 36 + bob, 6.6, 8.4, 'metal', lo=2, hi=4, ambient=0.5, flatness=0.8)
    for k in range(6):                                  # Glanzstreifen
        c.put_ramp(29 + k // 2, 29 + bob + k, 'bone', 5)
    c.put_ramp(31, 28 + bob, 'bone', 5)
    c.put_ramp(30, 28 + bob, 'bone', 4)
    for (x, y) in ((38, 40), (39, 41), (40, 40)):       # Delle
        c.put_ramp(x, y + bob, 'metal', 1)
    # Teetasse klebt auf dem Tablett (Dienst ist Dienst)
    c.rect(33, 33 + bob, 37, 36 + bob, 'bone', 5)
    c.rect(33, 34 + bob, 33, 36 + bob, 'bone', 4)
    c.rect(36, 34 + bob, 37, 36 + bob, 'bone', 3)
    hline(c, 33, 37, 33 + bob, 'wood', 3)
    c.put_ramp(38, 34 + bob, 'bone', 4)
    c.put_ramp(38, 35 + bob, 'bone', 3)
    hline(c, 32, 38, 37 + bob, 'bone', 4)
    c.put_ramp(34, 31 + bob, 'bone', 5)
    c.put_ramp(35, 30 + bob, 'bone', 4)
    c.put_ramp(35, 28 + bob, 'bone', 5)
    # weisser Handschuh am Rand
    ellipse(c, 27.5, 36 + bob, 3.0, 3.2, 'bone', lo=3, hi=5)
    # Kopf: kahl, Haarkranz hinten, Monokel
    c.rect(18, 16 + bob, 24, 20 + bob, 'skin', 2)
    hline(c, 18, 24, 18 + bob, 'skin', 1)
    ellipse(c, 21, 11 + bob, 6.8, 7.4, 'skin', lo=2, hi=5)
    ellipse(c, 14.5, 12 + bob, 3.2, 4.6, 'fur', lo=2, hi=4, clip=lambda x, y: x <= 15)
    ellipse(c, 14, 7 + bob, 2.2, 2.2, 'fur', lo=3, hi=5)
    ellipse(c, 13.5, 15 + bob, 2.0, 2.4, 'fur', lo=2, hi=4)
    ellipse(c, 15.5, 12 + bob, 1.9, 2.4, 'skin', lo=1, hi=3)               # Ohr
    poly(c, [(27, 10 + bob), (31, 12 + bob), (27, 14 + bob)], 'skin', lo=3, hi=5)   # lange Nase
    c.rect(24, 10 + bob, 25, 11 + bob, 'coal', 1)
    for (x, y) in ((22, 10), (23, 9), (24, 9), (25, 9), (26, 10), (26, 11), (26, 12), (25, 12), (24, 12), (23, 12), (22, 11)):
        c.put_ramp(x, y + bob, 'gold', 4)
    c.put_ramp(22, 13 + bob, 'gold', 3)
    c.put_ramp(22, 14 + bob, 'gold', 3)
    c.put_ramp(22, 15 + bob, 'gold', 3)
    hline(c, 24, 27, 16 + bob, 'skin', 1)
    c.outline()
    return c


# =========================================================================== UV-15 Zahntuer (36 x 52)


def spr_tooth_door(anim='idle', f=0):
    """lebende Tuer: Holztuer im Steinrahmen, Augen unter Holzbrauen, Tuerklopfer-Nase, Zahnreihen, Holzfuesse.
    anim='gulp': zwei Stiefelbeine eines geschluckten Feindes ragen aus dem Maul."""
    c = Canvas(36, 52)
    cx = 17.5
    # Steinrahmen (Bogen + Pfosten)
    def in_frame(x, y):
        if x < 0 or x > 35 or y < 0 or y > 47:
            return False
        if y < 17:
            dx, dy = (x + 0.5 - cx - 0.5), (y + 0.5 - 17)
            return dx * dx + dy * dy <= 17.6 ** 2
        return True
    for y in range(0, 48):
        for x in range(0, 36):
            if in_frame(x, y):
                u = x / 35.0
                L = 0.9 - 0.55 * u - 0.12 * (y / 48.0)
                tone = quant(L, 1, 4, x, y)
                if (y // 5 + (x // 9)) % 2 == 0 and (x + y) % 5 == 0:
                    tone = max(1, tone - 1)
                c.put_ramp(x, y, 'stone', tone)
    for y in range(0, 48, 6):                              # Fugen
        for x in range(0, 36):
            if in_frame(x, y) and (x < 5 or x > 30 or y < 8) and (x + y // 6) % 3:
                if c.alpha(x, y) and (x < 5 or x > 30):
                    c.put_ramp(x, y, 'stone', 1)
    # Tuerblatt (Rundbogen)
    def in_door(x, y):
        if x < 5 or x > 30 or y > 45:
            return False
        if y < 17:
            dx, dy = (x + 0.5 - cx - 0.5), (y + 0.5 - 17)
            return dx * dx + dy * dy <= 12.8 ** 2
        return True
    for y in range(0, 47):
        for x in range(0, 36):
            if in_door(x, y):
                u = (x - 5) / 26.0
                plank = (x - 5) % 7
                L = 0.85 - 0.5 * u - 0.1 * (y / 48.0)
                tone = quant(L, 1, 4, x, y)
                if plank == 0:
                    tone = 1
                elif plank == 1:
                    tone = min(5, tone + 1)
                if texture_noise(x // 2, y, 5) > 0.93:
                    tone = max(1, tone - 1)
                c.put_ramp(x, y, 'wood', tone)
    # Eisenbaender, Nieten, Scharniere
    for y0 in (14, 41):
        for x in range(5, 31):
            if in_door(x, y0):
                c.put_ramp(x, y0, 'metal', 4 if x < 18 else 3)
                c.put_ramp(x, y0 + 1, 'metal', 2)
        for x in (7, 28):
            c.put_ramp(x, y0, 'metal', 5)
    for y in (9, 43):
        poly(c, [(5, y), (15, y + 1), (15, y + 2), (5, y + 3)], 'metal', lo=1, hi=4)
        c.put_ramp(14, y + 1, 'metal', 5)
        c.put_ramp(7, y + 1, 'metal', 5)
        c.put_ramp(10, y + 2, 'metal', 5)
    # Augen: dunkle Hoehlen mit gelbem Glimmen unter schweren Brauen
    for ex in (9, 22):
        c.rect(ex, 17, ex + 4, 21, 'coal', 0)
        c.rect(ex + 1, 18, ex + 2, 19, 'gold', 5)
        c.put_ramp(ex + 3, 19, 'gold', 4)
    hline(c, 8, 14, 15, 'wood', 0)
    hline(c, 8, 14, 16, 'wood', 1)
    c.put_ramp(8, 16, 'wood', 0)
    hline(c, 21, 27, 15, 'wood', 0)
    hline(c, 21, 27, 16, 'wood', 1)
    c.put_ramp(14, 14, 'wood', 0)
    c.put_ramp(21, 14, 'wood', 0)
    # Maul
    my0, my1 = 28, 40
    def in_mouth(x, y):
        if y < my0 or y > my1 or x < 7 or x > 28:
            return False
        t = (x - 17.5) / 11.5
        top = my0 + 2.0 * (t * t)
        bot = my1 - 5.0 * (t * t)
        return top <= y <= bot
    for y in range(my0, my1 + 1):
        for x in range(7, 29):
            if in_mouth(x, y):
                c.put_ramp(x, y, 'fire', 0 if y < my0 + 6 else 1)
    # Zunge
    for y in range(34, 43):
        for x in range(13, 25):
            if in_mouth(x, y) or (y >= 38 and 15 <= x <= 22 and y <= 43):
                dx = (x - 18.5) / 5.5
                dy = (y - 39) / 4.5
                if dx * dx + dy * dy <= 1.0:
                    c.put_ramp(x, y, 'fire', 3 if (x + y) % 2 == 0 or dy > 0 else 2)
    c.line(18, 37, 19, 42, 'fire', 1)
    # geschluckter Feind (nur 'gulp'): Beine ragen aus dem Maul
    if anim == 'gulp':
        for (x0, x1, k) in ((14, 10, 0), (20, 25, 1)):
            thick_line(c, x0, 33, x1, 44, 3.6, 'leaf', lo=1, hi=4)
            for y in range(36, 44, 3):
                c.put_ramp(x0 + (x1 - x0) * (y - 33) // 11, y, 'leaf', 5)
            round_rect(c, x1 - 3, 44, x1 + 2, 47, 'coal', lo=0, hi=3, radius=1)
            hline(c, x1 - 3, x1 + 2, 47, 'bone', 3)
    # Zahnreihen (oben nach unten, unten nach oben, versetzt)
    def yt(x):
        return my0 + int(round(2.0 * ((x - 17.5) / 11.5) ** 2))
    def yb(x):
        return my1 - int(round(5.0 * ((x - 17.5) / 11.5) ** 2))
    for cxu in (9, 13, 17, 21, 25):
        for k, half in enumerate((1, 1, 1, 0)):
            for xx in range(cxu - half, cxu + half + 1):
                y = yt(xx) + k
                if 7 <= xx <= 28:
                    tone = 5 if xx <= cxu else 4
                    if k == 3:
                        tone = 4
                    c.put_ramp(xx, y, 'bone', tone)
    for cxl in (11, 15, 19, 23, 27):
        for k, half in enumerate((1, 1, 0)):
            for xx in range(cxl - half, cxl + half + 1):
                y = yb(xx) - k
                if 8 <= xx <= 27:
                    tone = 5 if xx <= cxl else 3
                    if k == 2:
                        tone = 4
                    c.put_ramp(xx, y, 'bone', tone)
    # Lippen (Holzwulst)
    for x in range(6, 30):
        t = (x - 17.5) / 11.5
        yt = my0 + int(round(2.0 * t * t))
        yb = my1 - int(round(5.0 * t * t))
        if abs(t) <= 1.05:
            c.put_ramp(x, yt - 1, 'wood', 1)
            c.put_ramp(x, yt - 2, 'wood', 3 if x < 18 else 2)
            c.put_ramp(x, yb + 1, 'wood', 1)
    # Nase = Tuerklopfer: Messingknauf + Ring
    ellipse(c, 17.5, 24.5, 3.6, 3.4, 'gold', lo=1, hi=5)
    c.put_ramp(14, 24, 'coal', 1) if False else None
    c.put_ramp(16, 25, 'coal', 1)
    c.put_ramp(19, 25, 'coal', 1)                          # Nasenloecher
    for ang in range(0, 360, 20):
        a = math.radians(ang)
        x = 17.5 + math.cos(a) * 3.8
        y = 31.5 + math.sin(a) * 3.8
        lit = (math.cos(a) * -0.55 + math.sin(a) * -0.65) > 0
        c.put_ramp(int(round(x - 0.5)), int(round(y - 0.5)), 'gold', 5 if lit else 3)
        c.put_ramp(int(round(x - 0.5)) + 1, int(round(y - 0.5)), 'gold', 4 if lit else 2)
    c.put_ramp(17, 27, 'gold', 2)
    c.put_ramp(18, 27, 'gold', 2)
    # Holzfuesse
    for (x0, x1) in ((6, 15), (21, 30)):
        round_rect(c, x0, 46, x1, 50, 'wood', lo=1, hi=4, radius=2)
        hline(c, x0 + 1, x1 - 2, 46, 'wood', 5)
        c.rect(x1 - 2, 48, x1 - 1, 49, 'wood', 2)
    c.outline()
    return c


# =========================================================================== UV-16 Sir Reginald, der Letzte Ritter (46 x 62)


def spr_sir_reginald(anim='idle', f=0):
    c = Canvas(46, 62)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Umhang (Teamfarbe) hinter dem Ritter
    poly(c, [(14, 23 + bob), (20, 24 + bob), (16, 40), (11, 56), (3, 58), (5, 46), (8, 32)], 'teamA', lo=0, hi=3)
    for (x0, y0, x1, y1) in ((7, 34, 5, 55), (10, 30, 9, 56)):
        c.line(x0, y0, x1, y1, 'teamA', 1)
    hline(c, 3, 11, 58, 'gold', 2)
    # Beine: Schienen, Knieplatten
    for (x0, x1, base) in ((13, 19, 1), (22, 28, 2)):
        round_rect(c, x0, 44, x1, 57, 'metal', lo=base, hi=base + 3, radius=2)
        hline(c, x0 + 1, x1 - 1, 51, 'metal', 1)
        ellipse(c, (x0 + x1) / 2.0 + 0.5, 46, 3.6, 3.2, 'metal', lo=base + 1, hi=5)
    # Schuhe (Eisenschuhe, Spitze rechts)
    for x0 in (11, 21):
        poly(c, [(x0, 56), (x0 + 8, 56), (x0 + 12, 60), (x0 + 11, 61), (x0, 61)], 'metal', lo=0, hi=4)
        hline(c, x0 + 1, x0 + 7, 56, 'metal', 5)
    # Wappenrock
    poly(c, [(11, 31 + bob), (30, 31 + bob), (30, 46), (28, 49), (13, 49), (11, 46)], 'teamA', lo=1, hi=4)
    for x in range(12, 30, 3):
        c.put_ramp(x, 46, 'teamA', 1)
        c.put_ramp(x + 1, 47, 'teamA', 1)
    hline(c, 12, 29, 48, 'gold', 3)
    hline(c, 13, 28, 49, 'gold', 2)
    vline(c, 20, 33 + bob, 47, 'gold', 4)
    vline(c, 21, 33 + bob, 47, 'gold', 3)
    # Brustpanzer mit Beulen
    poly(c, [(9, 21 + bob), (32, 21 + bob), (31, 33 + bob), (27, 36 + bob), (14, 36 + bob), (10, 33 + bob)], 'metal', lo=1, hi=5)
    dither_box(c, 24, 23 + bob, 31, 35 + bob, 'metal', 1, 2)
    hline(c, 11, 30, 33 + bob, 'gold', 3)
    for (x, y) in ((14, 26), (15, 27), (14, 28), (25, 25), (26, 25)):
        c.put_ramp(x, y + bob, 'metal', 1)
    c.line(17, 23 + bob, 19, 28 + bob, 'metal', 0)                 # Riss
    c.put_ramp(20, 29 + bob, 'metal', 0)
    # Schulterpanzer
    ellipse(c, 9.5, 24 + bob, 5.4, 4.6, 'metal', lo=1, hi=5)
    ellipse(c, 32.5, 24 + bob, 5.0, 4.4, 'metal', lo=0, hi=3)
    hline(c, 6, 13, 27 + bob, 'gold', 3)
    hline(c, 29, 36, 27 + bob, 'gold', 2)
    # Schwert: Spitze im Boden, Hand auf dem Knauf
    poly(c, [(37, 37 + bob), (40, 37 + bob), (39, 61), (38, 61)], 'metal', lo=2, hi=5, flat=None)
    vline(c, 37, 38 + bob, 59, 'metal', 5)
    vline(c, 39, 38 + bob, 58, 'metal', 2)
    c.rect(32, 35 + bob, 44, 36 + bob, 'gold', 4)
    c.put_ramp(32, 35 + bob, 'gold', 5)
    c.put_ramp(44, 36 + bob, 'gold', 2)
    c.put_ramp(32, 36 + bob, 'gold', 3)
    c.rect(37, 30 + bob, 40, 34 + bob, 'wood', 3)
    ellipse(c, 38.5, 28.5 + bob, 2.6, 2.6, 'gold', lo=3, hi=5)
    # Arme zu den Haenden
    thick_line(c, 31, 26 + bob, 36, 31 + bob, 4.4, 'metal', lo=0, hi=4)
    ellipse(c, 38, 31 + bob, 3.2, 3.0, 'metal', lo=1, hi=5)
    # Helm (Kuebelhelm) mit Sehschlitz und leuchtendem Schnurrbart
    round_rect(c, 14, 8 + bob, 29, 23 + bob, 'metal', lo=1, hi=5, radius=4)
    dither_box(c, 24, 10 + bob, 28, 22 + bob, 'metal', 1, 2)
    c.rect(15, 13 + bob, 28, 18 + bob, 'coal', 0)
    hline(c, 15, 28, 12 + bob, 'metal', 5)
    hline(c, 15, 28, 19 + bob, 'metal', 1)
    for x in (22, 23):
        c.put_ramp(x, 14 + bob, 'bone', 5)
    c.put_ramp(26, 14 + bob, 'bone', 5)
    c.put_ramp(27, 14 + bob, 'bone', 4)
    mo = [(16, 15), (16, 16), (17, 17), (18, 17), (19, 16), (20, 16), (21, 16), (22, 16), (23, 16), (24, 16), (25, 16), (26, 17), (27, 17), (28, 16), (28, 15)]
    for (x, y) in mo:
        c.put_ramp(x, y + bob, 'gold', 5)
    for (x, y) in ((17, 16), (19, 17), (26, 16), (21, 17), (24, 17)):
        c.put_ramp(x, y + bob, 'gold', 3)
    # Nietenreihe
    for x in (16, 20, 24, 27):
        c.put_ramp(x, 21 + bob, 'metal', 5)
    # Pudelmuetze: Locken-Wolke auf dem Helm + zwei Ohr-Puschel
    for (bx, by, rx, ry) in ((21.5, 4, 8.0, 5.2), (14.5, 5, 4.6, 4.0), (28.5, 5, 4.6, 4.0), (21.5, 0.8, 4.4, 3.4)):
        ellipse(c, bx, by + bob, rx, ry, 'bone', lo=2, hi=5, ambient=0.32)
    for (bx, by) in ((11, 14), (32, 14)):
        ellipse(c, bx, by + bob, 3.6, 4.4, 'bone', lo=2, hi=5, ambient=0.32)
        ellipse(c, bx - 0.5 if bx < 20 else bx + 0.5, by + 5.5 + bob, 2.2, 2.2, 'bone', lo=2, hi=5, ambient=0.32)
    for (x, y) in ((13, 3), (14, 3), (14, 4), (19, 1), (20, 1), (20, 2), (25, 3), (26, 3), (26, 4), (17, 6), (18, 6), (23, 6), (24, 6), (10, 13), (10, 14), (31, 13), (32, 13), (32, 14)):
        c.put_ramp(x, y + bob, 'bone', 3)
    for (x, y) in ((15, 2), (21, 0), (26, 3), (10, 12), (31, 12)):
        c.put_ramp(x, y + bob, 'bone', 5)
    hline(c, 14, 29, 8 + bob, 'bone', 2)
    c.outline()
    return c


# =========================================================================== UV-17 Hausmeister-Koloss (66 x 64)


def _key(c, x, y, length, ramp):
    """grosser Schluessel, haengt nach unten: Ring-Griff oben, Schaft, zwei Baerte"""
    for (dx, dy, t) in ((1, 0, 5), (2, 0, 4), (0, 1, 4), (3, 1, 3), (0, 2, 3), (3, 2, 2), (1, 3, 3), (2, 3, 2)):
        c.put_ramp(x + dx, y + dy, ramp, t)
    c.rect(x + 1, y + 4, x + 2, y + 4 + length, ramp, 3)
    vline(c, x + 1, y + 4, y + 4 + length, ramp, 4)
    c.rect(x + 3, y + 5 + length - 4, x + 4, y + 5 + length - 3, ramp, 4)
    c.rect(x + 3, y + 5 + length - 1, x + 4, y + 5 + length, ramp, 3)


def spr_janitor_colossus(anim='idle', f=0):
    c = Canvas(66, 64)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    sweep = [0, 1, 0][f % 3] if anim == 'sweep' else 0
    # Stiefel + Kolbenbeine
    for (x0, x1, base) in ((16, 25, 1), (32, 41, 2)):
        round_rect(c, x0 + 1, 46, x1 - 1, 58, 'metal', lo=base, hi=base + 2, radius=1)
        for y in range(49, 57, 3):
            hline(c, x0 + 1, x1 - 1, y, 'metal', 1)
        toe = 3 if x0 < 20 else 8
        poly(c, [(x0 - 3, 56), (x1 + 2, 56), (x1 + toe, 60), (x1 + toe, 63), (x0 - 3, 63)], 'coal', lo=1, hi=4)
        hline(c, x0 - 2, x1 + 2, 56, 'coal', 5)
        for x in range(x0 - 3, x1 + toe):
            if (x // 3) % 2 == 0:
                c.put_ramp(x, 63, 'gold', 3)
    # Schluesselbund an der linken Huefte
    for ang in range(0, 360, 20):
        a = math.radians(ang)
        x = 8 + math.cos(a) * 3.8
        y = 49 + math.sin(a) * 3.8
        lit = (math.cos(a) * -0.55 + math.sin(a) * -0.65) > 0
        c.put_ramp(int(round(x - 0.5)), int(round(y - 0.5)), 'gold', 5 if lit else 3)
        c.put_ramp(int(round(x - 0.5)) + 1, int(round(y - 0.5)), 'gold', 4 if lit else 2)
    _key(c, 1, 52, 5, 'gold')
    _key(c, 6, 53, 7, 'metal')
    _key(c, 10, 52, 4, 'gold')
    # Rumpf: Overall (blau) auf Metallrahmen
    round_rect(c, 12, 18 + bob, 45, 46, 'metal', lo=0, hi=3, radius=4)
    round_rect(c, 14, 20 + bob, 43, 43, 'ice', lo=1, hi=4, radius=3)
    dither_box(c, 36, 22 + bob, 42, 42, 'ice', 1, 2)
    hline(c, 15, 42, 35 + bob, 'ice', 1)
    vline(c, 28, 36 + bob, 43, 'ice', 1)
    for (x, y) in ((16, 22), (41, 22), (16, 41), (41, 41)):
        c.put_ramp(x, y + bob, 'metal', 5)
    # Brusttasche mit Putzlappen + Lichtertafel
    round_rect(c, 17, 25 + bob, 27, 33 + bob, 'ice', lo=2, hi=4, radius=1)
    hline(c, 17, 27, 25 + bob, 'ice', 5)
    c.rect(19, 21 + bob, 21, 26 + bob, 'bone', 4)
    c.rect(23, 22 + bob, 25, 26 + bob, 'bone', 3)
    c.rect(33, 25 + bob, 41, 31 + bob, 'coal', 1)
    for k, col in enumerate(('slime', 'gold', 'fire')):
        c.rect(34 + k * 3, 27 + bob, 35 + k * 3, 29 + bob, col, 5 if k != 2 else 4)
    # Gurt mit Warnstreifen und Schnalle
    for x in range(12, 46):
        for y in range(39, 46):
            if (x + y) // 3 % 2 == 0:
                c.put_ramp(x, y, 'gold', 4 if y < 43 else 3)
            else:
                c.put_ramp(x, y, 'coal', 1)
    round_rect(c, 25, 38, 33, 46, 'metal', lo=1, hi=5, radius=1)
    c.rect(27, 40, 31, 44, 'coal', 1)
    c.rect(28, 41, 30, 43, 'gold', 4)
    # hinterer Arm
    thick_line(c, 10, 28 + bob, 7, 40 + bob, 8.0, 'metal', lo=0, hi=3)
    ellipse(c, 7, 42 + bob, 4.2, 3.6, 'metal', lo=1, hi=5)
    # Schulterpanzer mit Warnstreifen
    ellipse(c, 12, 24 + bob, 6.4, 5.8, 'metal', lo=1, hi=5)
    ellipse(c, 45.5, 24 + bob, 6.0, 5.6, 'metal', lo=0, hi=3)
    for x in range(7, 17):
        if (x // 2) % 2:
            c.put_ramp(x, 25 + bob, 'gold', 4)
    # vorderer Arm + Besen: schraeg nach vorn, Borsten am Boden
    thick_line(c, 46, 27 + bob, 48, 38 + bob, 8.0, 'metal', lo=1, hi=4)
    ex, ey = 57 + sweep, 58
    thick_line(c, 45, 24 + bob, ex, ey, 2.8, 'wood', lo=1, hi=5)
    hx, hy = 49, 40 + bob
    ellipse(c, hx, hy, 4.4, 4.2, 'metal', lo=1, hi=5)
    c.rect(hx - 1, hy - 1, hx + 1, hy + 1, 'coal', 1)
    # Besenkopf: breiter Holzblock + ausgestellte Borsten
    poly(c, [(ex - 8, ey - 2), (ex + 7, ey - 5), (ex + 8, ey)], 'metal', lo=1, hi=5)
    poly(c, [(ex - 9, ey - 1), (ex + 8, ey - 2), (ex + 10, ey + 6), (ex - 11, ey + 6)], 'dirt', lo=2, hi=5)
    for k in range(-10, 11, 2):
        c.line(ex + k, ey + 2, ex + k + (1 if k > 0 else -1), ey + 5, 'dirt', 2)
    hline(c, ex - 10, ex + 9, ey + 1, 'wood', 3)
    hline(c, ex - 10, ex + 9, ey, 'wood', 4)
    # Kopf: eckig, ein grosses Linsenauge, Lueftungsschlitze, Warnleuchte
    round_rect(c, 20, 6 + bob, 38, 19 + bob, 'metal', lo=1, hi=5, radius=3)
    dither_box(c, 34, 8 + bob, 37, 18 + bob, 'metal', 1, 2)
    ellipse(c, 31.5, 12 + bob, 4.8, 4.8, 'coal', lo=0, hi=2)
    ellipse(c, 32.0, 12 + bob, 3.4, 3.4, 'gold', lo=2, hi=5, ambient=0.5)
    c.rect(32, 11 + bob, 33, 12 + bob, 'coal', 1)
    for y in (17, 18):
        for x in range(23, 36):
            if x % 2 == 0:
                c.put_ramp(x, y + bob, 'coal', 1)
    c.put_ramp(21, 9 + bob, 'metal', 5)
    c.put_ramp(21, 16 + bob, 'metal', 5)
    # Schirmmuetze (flach, sitzt oben auf dem Kopf)
    poly(c, [(19, 6 + bob), (38, 6 + bob), (42, 8 + bob), (42, 9 + bob), (19, 9 + bob)], 'ice', lo=1, hi=5)
    hline(c, 19, 41, 6 + bob, 'ice', 5)
    hline(c, 19, 41, 9 + bob, 'ice', 1)
    # Warnleuchte oben
    c.rect(27, 3 + bob, 31, 5 + bob, 'metal', 2)
    ellipse(c, 29, 2.5 + bob, 3.0, 2.6, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 3 + bob)
    c.put_ramp(28, 1 + bob, 'gold', 5)
    c.outline()
    return c
