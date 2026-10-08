"""pack_art12: Hof-Bauten und Turm der Chaos-Karten (Trampolin-Dach, Spiegel, Wunschbrunnen, Kuckucksuhr, Truhe, Roter Knopf)."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art12_kit import hline, vline, vflip, disc, dither_rect
from pack_art12_units import spr_cuckoo


# =========================================================================== BA-05 Trampolin-Dach (72 x 52)


def trampoline_roof() -> Canvas:
    """Haeuschen aus Stein, dessen Dach eine gespannte Pudding-Matte mit Federn ist (76 x 60)"""
    W, H = 76, 60
    c = Canvas(W, H)
    cx, my, ry_m, rx = 38, 15, 8.4, 34.0          # Matte: Mitte, y, Halbachsen
    fy = 25                                         # Federring 10 px tiefer
    # --- Mauerwerk (Vorderseite)
    x0, x1, y0, y1 = 11, 65, 33, 58
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            row = (y - y0) // 6
            yy = (y - y0) % 6
            off = 8 if row % 2 else 0
            t_ = 3 if ((x + off) // 16 + row) % 2 == 0 else 2
            idx = t_
            if yy == 5:
                idx = 1
            elif (x + off) % 16 == 0:
                idx = 1
            elif yy == 0:
                idx = min(5, t_ + 1)
            if x == x0:
                idx = 5
            if x >= x1 - 1:
                idx = max(0, idx - 1)
            if y > y1 - 3:
                idx = max(0, idx - 1)
            c.put_ramp(x, y, 'stone', idx)
    # Tuer (Rundbogen) mit Messingklinke
    for y in range(41, y1 + 1):
        for x in range(31, 46):
            dx = (x + 0.5 - 38.5) / 7.5
            if y < 48 and dx * dx + ((y - 48) / 7.0) ** 2 > 1.0:
                continue
            bx = (x - 31) % 5
            idx = 3 if bx else 2
            if y > y1 - 3:
                idx = 1
            c.put_ramp(x, y, 'wood', idx)
    vline(c, 38, 42, y1, 'wood', 1)
    vline(c, 39, 42, y1, 'wood', 4)
    c.put_ramp(35, 51, 'gold', 5)
    c.put_ramp(41, 51, 'gold', 5)
    # runde Fensterchen
    for wx in (21, 55):
        ellipse(c, wx, 46, 4.4, 4.4, 'wood', lo=1, hi=4)
        ellipse(c, wx, 46, 3.0, 3.0, 'sky', lo=2, hi=5, ambient=0.4)
        c.put_ramp(wx - 1, 45, 'sky', 5)
    # --- hinterer Ring
    for k in range(0, 181, 3):
        a = math.radians(180 + k)
        c.put_ramp(int(round(cx + rx * math.cos(a))), int(round(fy + ry_m * math.sin(a))), 'metal', 1)
    # --- Federn: gespreizte Spiralen zwischen Matte und Ring (vorn)
    for k in range(14, 170, 19):
        a = math.radians(k)
        x = int(round(cx + rx * 0.95 * math.cos(a)))
        ya = int(round(my + ry_m * 0.95 * math.sin(a))) + 2
        yb = int(round(fy + ry_m * 0.95 * math.sin(a)))
        for i, y in enumerate(range(ya, yb + 1)):
            if i % 3 == 0:
                c.rect(x - 1, y, x + 2, y, 'metal', 4)
                c.put_ramp(x - 1, y, 'metal', 5)
            elif i % 3 == 1:
                c.put_ramp(x, y, 'metal', 2)
                c.put_ramp(x + 1, y, 'metal', 1)
            else:
                c.rect(x - 1, y, x + 2, y, 'metal', 3)
    # --- Federring vorn
    for k in range(0, 181, 2):
        a = math.radians(k)
        x = int(round(cx + rx * math.cos(a)))
        y = int(round(fy + ry_m * math.sin(a)))
        c.put_ramp(x, y, 'metal', 5 if x < cx else 4)
        c.put_ramp(x, y + 1, 'metal', 3)
        c.put_ramp(x, y + 2, 'metal', 1)
    # --- Matte: Sahnepolster + Pudding
    ellipse(c, cx, my + 1, rx + 0.6, ry_m + 1.2, 'bone', lo=2, hi=5, ambient=0.3, flatness=0.45)
    ellipse(c, cx, my, rx - 2.2, ry_m - 1.4, 'teamA', lo=2, hi=5, ambient=0.3, flatness=0.7)
    # Einsenkung (weiches Dithern)
    for y in range(int(my - 5), int(my + 7)):
        for x in range(cx - 26, cx + 8):
            dx = (x - (cx - 9)) / 17.0
            dy = (y - (my + 1)) / 4.2
            d = dx * dx + dy * dy
            if d < 1.0 and c.alpha(x, y):
                if d < 0.3 or (d < 0.7 and (x + y) % 2 == 0):
                    c.put_ramp(x, y, 'teamA', 2 if d < 0.3 else 3)
    # Glanz
    for (x, y) in ((14, 13), (15, 12), (16, 12), (17, 12), (56, 20), (57, 20), (58, 19)):
        c.put_ramp(x, y, 'teamA', 5)
    # Kirsche als Zielmarke (Pudding!)
    c.outline()
    return c


# =========================================================================== BA-06 Standspiegel (36 x 62)


def _mirror_body() -> Canvas:
    W, H = 36, 62
    c = Canvas(W, H)
    cx, cy, rx, ry = 18, 27, 15.0, 25.0
    # Standfuesse + Pfosten (Schwenkspiegel)
    c.rect(2, 22, 4, 56, 'gold', 2)
    c.rect(2, 22, 2, 56, 'gold', 4)
    c.rect(31, 22, 33, 56, 'gold', 1)
    c.rect(31, 22, 31, 56, 'gold', 3)
    for (x0, x1) in ((0, 8), (27, 35)):
        c.rect(x0, 56, x1, 59, 'gold', 2)
        c.rect(x0, 56, x1, 56, 'gold', 5)
        c.rect(x0 + 1, 59, x1 - 1, 60, 'gold', 1)
    c.rect(8, 57, 27, 58, 'gold', 1)
    for (x, y) in ((3, 20), (32, 20)):
        disc(c, x, y, 2.2, 'gold', 2, 5)
    # Rahmen: Ellipsenring mit Licht von links oben
    for y in range(0, 56):
        for x in range(0, W):
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            d = nx * nx + ny * ny
            if d > 1.0:
                continue
            if d >= 0.64:
                ang = math.atan2(ny, nx)
                lit = 0.5 + 0.5 * math.cos(ang - math.radians(-135))
                v = (d - 0.64) / 0.36
                L = 0.25 + 0.55 * lit + (0.2 if 0.35 < v < 0.65 else 0.0)
                idx = quant(max(0.0, min(1.0, L)), 1, 5, x, y)
                # Perlenband im Rahmen
                if 0.4 < v < 0.6 and (int(ang * 9) % 2 == 0):
                    idx = min(5, idx + 1)
                c.put_ramp(x, y, 'gold', idx)
    # Glas
    for y in range(0, 56):
        for x in range(0, W):
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            if nx * nx + ny * ny < 0.62:
                L = 0.62 - 0.22 * ((x - cx) / rx) - 0.28 * ((y - cy) / ry)
                c.put_ramp(x, y, 'ice', quant(max(0.0, min(1.0, L)), 2, 4, x, y))
    # diagonale Glanzstreifen
    for y in range(6, 50):
        for x in range(0, W):
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            if nx * nx + ny * ny < 0.58:
                t = (x + y * 0.55) - 28
                if 0 <= t < 3:
                    c.put_ramp(x, y, 'ice', 5)
                elif 5 <= t < 6:
                    c.put_ramp(x, y, 'ice', 5)
    disc(c, 18, 51, 2.0, 'teamA', 2, 5)
    disc(c, 3, 27, 1.8, 'ice', 3, 5)
    disc(c, 33, 27, 1.8, 'ice', 2, 5)
    return c


def mirror_face() -> Canvas:
    """Spiegelbild: blasses Gesicht mit Bommelmuetze streckt die Zunge raus (17 x 19), in Eis-Blau getoent"""
    c = Canvas(17, 19)
    ellipse(c, 8.5, 9.6, 7.3, 6.8, 'fur', lo=2, hi=5, ambient=0.25)
    # Bommelmuetze
    ellipse(c, 8.5, 5.0, 7.0, 3.6, 'metal', lo=1, hi=4, clip=lambda x, y: y <= 5)
    hline(c, 2, 14, 5, 'metal', 2)
    ellipse(c, 8.5, 1.6, 2.0, 1.8, 'fur', lo=3, hi=5)
    # Augen: zwei zugekniffene Striche
    c.rect(3, 8, 6, 8, 'metal', 1)
    c.rect(10, 8, 13, 8, 'metal', 1)
    c.put_ramp(3, 7, 'metal', 1)
    c.put_ramp(13, 7, 'metal', 1)
    # Mund + Zunge
    hline(c, 4, 12, 12, 'metal', 1)
    c.put_ramp(3, 11, 'metal', 1)
    c.put_ramp(13, 11, 'metal', 1)
    ellipse(c, 9.0, 14.8, 3.0, 3.2, 'teamA', lo=2, hi=5, clip=lambda x, y: y >= 12)
    c.put_ramp(9, 13, 'teamA', 1)
    c.put_ramp(9, 14, 'teamA', 1)
    c.put_ramp(8, 14, 'teamA', 5)
    return c


def standing_mirror() -> Canvas:
    c = Canvas(36, 66)
    c.blit(_mirror_body(), 0, 4)
    c.blit(mirror_face(), 10, 21)
    # Krone oben und Edelstein
    poly(c, [(13, 7), (23, 7), (25, 3), (11, 3)], 'gold', lo=2, hi=5)
    disc(c, 18, 7, 2.6, 'teamA', 2, 5, spec=(17, 6, 5))
    for (x, y) in ((12, 4), (18, 2), (24, 4)):
        c.put_ramp(x, y, 'gold', 5)
    c.outline()
    return c


# =========================================================================== BC-01 Wunschbrunnen (50 x 64)


def wishing_well() -> Canvas:
    W, H = 50, 64
    c = Canvas(W, H)
    cx, ry_r = 25, 8
    rim_y = 38
    # Pfosten + Querbalken (hinter dem Rand)
    for x in (7, 40):
        c.rect(x, 12, x + 2, 40, 'wood', 2)
        c.rect(x, 12, x, 40, 'wood', 4)
        c.rect(x + 2, 12, x + 2, 40, 'wood', 1)
    # Brunnenkoerper (Zylinder, Steinquader)
    rx = 20.0
    for y in range(rim_y, 58):
        t = (y - rim_y) / 20.0
        half = rx * (1.0 if t < 0.75 else math.sqrt(max(0.0, 1.0 - ((t - 0.75) / 0.25) ** 2 * 0.0)))
        for x in range(int(cx - rx), int(cx + rx) + 1):
            u = (x + 0.5 - (cx - rx)) / (2 * rx)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot_ = nn * LIGHT[0] + nz * LIGHT[2]
            L = 0.16 + 0.84 * max(0.0, dot_)
            idx = quant(L, 1, 4, x, y, dw=0.18)
            row = (y - rim_y) // 6
            yy = (y - rim_y) % 6
            if yy == 5:
                idx = max(0, idx - 2)
            else:
                off = 8 if row % 2 else 0
                if (x + off) % 16 == 0:
                    idx = max(0, idx - 1)
            # untere Rundung: Ellipse
            ybot = 56 + ry_r * 0.9 * math.sqrt(max(0.0, 1 - ((x + 0.5 - cx) / rx) ** 2))
            if y <= ybot:
                c.put_ramp(x, y, 'stone', idx)
    # Rand-Oberseite (Ring)
    ellipse(c, cx, rim_y, rx + 1.5, ry_r + 1.0, 'stone', lo=2, hi=5, ambient=0.3, flatness=0.5)
    # Inneres: Wand hinten dunkel
    ellipse(c, cx, rim_y + 0.5, rx - 4.0, ry_r - 2.4, 'stone', lo=0, hi=1, ambient=0.3, flatness=0.8)
    # Muenzhaufen
    ellipse(c, cx, rim_y + 1.0, rx - 5.2, ry_r - 3.3, 'gold', lo=2, hi=5, ambient=0.3, flatness=0.35)
    rnd = random.Random(12)
    for _ in range(26):
        x = rnd.randint(cx - 13, cx + 13)
        y = rnd.randint(rim_y - 3, rim_y + 4)
        nx = (x - cx) / 14.0
        ny = (y - rim_y - 1) / 4.8
        if nx * nx + ny * ny < 0.9:
            c.put_ramp(x, y, 'gold', 5)
            c.put_ramp(x + 1, y, 'gold', 4)
            c.put_ramp(x, y + 1, 'gold', 2)
            c.put_ramp(x + 1, y + 1, 'gold', 1)
    for (x, y) in ((cx - 5, rim_y - 1), (cx + 6, rim_y + 1)):
        c.put_ramp(x, y, 'bone', 5)
    # Dach: lila Schindeln mit Sternenzeichen
    poly(c, [(0, 17), (49, 17), (25, 2)], 'purple', lo=1, hi=4)
    for yy in range(5, 17, 3):
        for x in range(int(25 - (yy - 2) * 1.6), int(25 + (yy - 2) * 1.6)):
            if 0 <= x < W and c.alpha(x, yy):
                c.put_ramp(x, yy, 'purple', 1 if (x // 3 + yy // 3) % 2 else 2)
    hline(c, 1, 48, 17, 'purple', 0)
    c.rect(4, 17, 45, 18, 'wood', 3)
    c.rect(4, 17, 45, 17, 'wood', 5)
    c.rect(4, 19, 45, 19, 'wood', 1)
    # Stern am Giebel
    for (x, y, i) in ((25, 7, 5), (24, 8, 4), (26, 8, 4), (25, 8, 5), (25, 9, 4)):
        c.put_ramp(x, y, 'gold', i)
    c.put_ramp(24, 8, 'gold', 5)
    c.put_ramp(26, 8, 'gold', 5)
    # Eimer an Seil (links vom Zentrum)
    vline(c, 14, 20, 27, 'bone', 2)
    c.rect(11, 28, 17, 33, 'wood', 3)
    c.rect(11, 28, 11, 33, 'wood', 4)
    c.rect(17, 28, 17, 33, 'wood', 1)
    hline(c, 11, 17, 30, 'metal', 3)
    hline(c, 11, 17, 33, 'wood', 1)
    c.outline()
    return c


# =========================================================================== BC-02 Kuckucksuhr (Turm, 52 x 80)


def _clock_case() -> Canvas:
    W, H = 52, 80
    c = Canvas(W, H)
    cx = 26
    # Sockel aus Stein
    round_rect(c, 4, 68, 47, 78, 'stone', lo=1, hi=4, radius=2)
    for x in range(6, 46, 8):
        vline(c, x, 70, 77, 'stone', 1)
    hline(c, 4, 47, 73, 'stone', 1)
    # Gewichte (Tannenzapfen an Ketten) rechts + links des Gehaeuses
    for gx in (6, 45):
        for y in range(48, 62, 2):
            c.put_ramp(gx, y, 'metal', 3)
            c.put_ramp(gx, y + 1, 'metal', 1)
        poly(c, [(gx - 4, 62), (gx + 4, 62), (gx + 3, 70), (gx, 73), (gx - 3, 70)], 'wood', lo=1, hi=4)
        for yy in (64, 67, 70):
            for xx in range(gx - 3, gx + 4):
                if (xx + yy) % 3 == 0:
                    c.put_ramp(xx, yy, 'wood', 1)
                elif (xx + yy) % 3 == 1:
                    c.put_ramp(xx, yy, 'wood', 4)
    # Gehaeuse
    round_rect(c, 9, 22, 42, 68, 'wood', lo=1, hi=4, radius=2)
    # Maserung
    rnd = random.Random(4)
    for _ in range(26):
        x, y = rnd.randint(11, 40), rnd.randint(24, 66)
        c.put_ramp(x, y, 'wood', 2)
        c.put_ramp(x + 1, y, 'wood', 2)
    # Schnitzrahmen
    for x in range(12, 40):
        c.put_ramp(x, 25, 'wood', 5)
        c.put_ramp(x, 26, 'wood', 1)
        c.put_ramp(x, 64, 'wood', 1)
    for y in range(26, 65):
        c.put_ramp(12, y, 'wood', 5)
        c.put_ramp(13, y, 'wood', 1)
        c.put_ramp(39, y, 'wood', 1)
    # Zifferblatt
    ellipse(c, cx, 42, 13.5, 13.5, 'gold', lo=1, hi=5, ambient=0.2)
    ellipse(c, cx, 42, 10.8, 10.8, 'bone', lo=3, hi=5, ambient=0.5, flatness=0.7)
    for k in range(12):
        a = math.radians(k * 30)
        x = cx + int(round(math.cos(a) * 9.0))
        y = 42 + int(round(math.sin(a) * 9.0))
        c.put_ramp(x, y, 'coal', 1)
        if k % 3 == 0:
            xx = cx + int(round(math.cos(a) * 8.0))
            yy = 42 + int(round(math.sin(a) * 8.0))
            c.put_ramp(xx, yy, 'coal', 1)
    thick_line(c, cx, 42, cx - 3, 36, 1.4, 'coal', lo=0, hi=2)
    thick_line(c, cx, 42, cx + 7, 38, 1.4, 'coal', lo=0, hi=2)
    c.put_ramp(cx, 42, 'teamA', 4)
    # kleine Schnitzblaetter links/rechts
    for (x, y) in ((16, 31), (35, 31), (16, 56), (35, 56)):
        c.put_ramp(x, y, 'leaf', 3)
        c.put_ramp(x + 1, y + 1, 'leaf', 4)
        c.put_ramp(x - 1, y + 1, 'leaf', 2)
    # Pendel hinter Fensterchen
    c.rect(20, 58, 31, 66, 'coal', 0)
    vline(c, cx, 58, 63, 'metal', 4)
    ellipse(c, cx, 63, 3.4, 3.2, 'gold', lo=2, hi=5)
    return c


def cuckoo_clock_tower(team='teamA') -> Canvas:
    """Kuckucksuhr als Turm: Steinsockel, Gehaeuse mit Zifferblatt, Dach mit Kuckuck-Boxer (56 x 90)"""
    W, H = 56, 84
    c = Canvas(W, H)
    cx = 28
    case = _clock_case()
    keep = [y for y in range(case.h) if not (73 <= y <= 76)]       # Sockel kuerzen
    sq = Canvas(case.w, len(keep))
    sq.px[:] = case.px[keep]
    sq.rid[:] = case.rid[keep]
    c.blit(sq, 2, 8)
    # Dach (Giebel), Kante in Teamfarbe
    base = 32
    poly(c, [(1, base), (54, base), (cx, 1)], 'wood', lo=0, hi=3)
    for yy in range(6, base, 3):
        half = (yy - 1) * 0.78 + 1
        for x in range(int(cx - half), int(cx + half) + 1):
            if 0 <= x < W and c.alpha(x, yy):
                c.put_ramp(x, yy, 'wood', 0 if (x // 3 + yy // 3) % 2 else 1)
    c.rect(0, base, 55, base + 1, team, 3)
    c.rect(0, base, 55, base, team, 4)
    c.rect(1, base + 2, 54, base + 2, team, 1)
    # Bogentuer fuer den Kuckuck, goldener Rahmen
    for y in range(11, base):
        for x in range(14, 43):
            dx = (x + 0.5 - cx) / 13.4
            arch = dx * dx + ((y - 24) / 13.0) ** 2
            if y < 24 and arch > 1.0:
                continue
            if y < 24 and arch > 0.82:
                c.put_ramp(x, y, 'gold', 4 if x < cx else 2)
            elif y >= 24 and (x == 14 or x == 42):
                c.put_ramp(x, y, 'gold', 4 if x < cx else 2)
            else:
                c.put_ramp(x, y, 'coal', 0)
    # Tuerfluegel (offen)
    c.rect(9, 17, 13, base - 1, 'wood', 4)
    c.rect(9, 17, 9, base - 1, 'wood', 5)
    c.rect(13, 17, 13, base - 1, 'wood', 2)
    c.put_ramp(11, 24, 'gold', 5)
    c.rect(43, 19, 46, base - 1, 'wood', 3)
    c.rect(43, 19, 43, base - 1, 'wood', 2)
    c.rect(46, 19, 46, base - 1, 'wood', 1)
    c.put_ramp(45, 24, 'gold', 4)
    # Zierspitze
    for k, i in enumerate((5, 4, 3)):
        c.put_ramp(cx, k, 'gold', i)
    c.put_ramp(cx - 1, 2, 'leaf', 4)
    c.put_ramp(cx + 1, 2, 'leaf', 3)
    # Kuckuck: steht in der Tuer, Boxhandschuh weit vorgestreckt
    ck = spr_cuckoo(True)
    c.blit(ck, 17, base - 18)
    c.outline()
    return c


# =========================================================================== BC-06 Lebende Schatztruhe (38 x 36)


def living_chest() -> Canvas:
    W, H = 38, 36
    c = Canvas(W, H)
    # Fuesschen
    for x0 in (5, 28):
        c.rect(x0, 30, x0 + 4, 34, 'wood', 1)
        c.rect(x0, 30, x0 + 4, 30, 'wood', 3)
        c.put_ramp(x0, 34, 'bone', 4)
        c.put_ramp(x0 + 2, 34, 'bone', 4)
        c.put_ramp(x0 + 4, 34, 'bone', 3)
    # Korpus
    round_rect(c, 2, 17, 35, 31, 'wood', lo=1, hi=4, radius=2)
    for x in range(3, 35):
        c.put_ramp(x, 21, 'wood', 1 if x % 2 else 2)
        c.put_ramp(x, 26, 'wood', 1 if x % 2 else 2)
    for x in (9, 27):
        c.rect(x, 17, x + 2, 31, 'metal', 2)
        c.rect(x, 17, x, 31, 'metal', 4)
    # Schloss (Nase)
    c.rect(17, 24, 20, 29, 'gold', 3)
    c.rect(17, 24, 20, 24, 'gold', 5)
    c.rect(18, 26, 19, 27, 'coal', 1)
    # Maul: dunkler Spalt
    c.rect(3, 13, 34, 18, 'coal', 0)
    hline(c, 3, 34, 17, 'fire', 1)
    # Goldmuenzen im Maul
    for k, x in enumerate(range(6, 32, 4)):
        c.rect(x, 16, x + 2, 17, 'gold', 4 if k % 2 else 3)
        c.put_ramp(x, 16, 'gold', 5)
    # untere Zaehne (Koerperrand)
    for x in range(4, 34, 4):
        c.put_ramp(x, 17, 'bone', 5)
        c.put_ramp(x + 1, 17, 'bone', 4)
        c.put_ramp(x, 16, 'bone', 5)
        c.put_ramp(x + 1, 16, 'bone', 4)
        c.put_ramp(x, 15, 'bone', 5)
    for x in (6, 22):
        c.put_ramp(x, 14, 'bone', 5)
    # Deckel (angehoben, Kuppel)
    ellipse(c, 18.5, 8.0, 17.4, 8.6, 'wood', lo=1, hi=5, ambient=0.18, clip=lambda x, y: y <= 12)
    for y in (6, 10):
        for x in range(2, 36):
            if c.alpha(x, y) and (x % 2 == 0):
                c.put_ramp(x, y, 'wood', 1)
    c.rect(9, 0, 11, 12, 'metal', 2)
    c.rect(9, 0, 9, 12, 'metal', 4)
    c.rect(26, 0, 28, 12, 'metal', 1)
    c.rect(26, 0, 26, 12, 'metal', 3)
    # obere Zaehne (haengen vom Deckelrand)
    for x in range(5, 34, 4):
        c.put_ramp(x, 13, 'bone', 5)
        c.put_ramp(x + 1, 13, 'bone', 4)
        c.put_ramp(x, 14, 'bone', 4)
        c.put_ramp(x + 1, 14, 'bone', 3)
        c.put_ramp(x, 15, 'bone', 3)
    # Augen auf dem Deckel
    for (ex, ey) in ((14, 5), (23, 5)):
        c.rect(ex, ey, ex + 2, ey + 3, 'gold', 5)
        c.rect(ex, ey, ex + 2, ey, 'bone', 5)
        c.rect(ex + 1, ey + 1, ex + 1, ey + 3, 'coal', 0)
    # Brauen
    c.line(12, 3, 16, 4, 'wood', 0)
    c.line(25, 4, 29, 3, 'wood', 0)
    # Zunge: haengt aus dem Maul ueber die Front, rollt sich am Ende ein
    pts = []
    for y in range(13, 29):
        x0 = 21 + int(round(2.2 * math.sin((y - 13) / 5.0)))
        pts.append((x0, y))
    for (x0, y) in pts:
        w_ = 5 if y < 24 else 6
        for x in range(x0 - w_ // 2, x0 - w_ // 2 + w_):
            u = (x - (x0 - w_ // 2)) / float(w_)
            c.put_ramp(x, y, 'teamA', 4 if u < 0.3 else 3 if u < 0.7 else 2)
        c.put_ramp(x0, y, 'teamA', 1 if y % 2 else 2)         # Mittelrille
    x0, y = pts[-1]
    ellipse(c, x0 + 0.5, 28.5, 3.6, 3.0, 'teamA', lo=2, hi=5)
    c.put_ramp(x0, 29, 'teamA', 1)
    c.put_ramp(x0 - 1, 27, 'teamA', 5)
    c.put_ramp(x0 + 1, 31, 'ice', 4)       # Sabber
    c.put_ramp(x0 + 1, 32, 'ice', 5)
    c.outline()
    return c


# =========================================================================== BC-09 Der Rote Knopf (36 x 50)


def red_button() -> Canvas:
    W, H = 36, 50
    c = Canvas(W, H)
    cx, py = 18, 28
    rx, ry = 15.0, 5.5
    # Sockel: Zylinder (Metall) mit Warnstreifen
    for y in range(py, 45):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            u = (x + 0.5 - (cx - rx)) / (2 * rx)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot_ = nn * LIGHT[0] + nz * LIGHT[2]
            L = 0.15 + 0.85 * max(0.0, dot_)
            idx = quant(L, 1, 4, x, y, dw=0.18)
            ybot = 43 + ry * math.sqrt(max(0.0, 1 - ((x + 0.5 - cx) / rx) ** 2))
            if y > ybot:
                continue
            if 33 <= y <= 38:
                stripe = ((x + y) // 3) % 2 == 0
                c.put_ramp(x, y, 'gold' if stripe else 'coal', max(1, min(4, idx)) if stripe else max(0, idx - 2))
            else:
                c.put_ramp(x, y, 'metal', idx)
    # Deckplatte
    ellipse(c, cx, py, rx + 1.0, ry + 0.8, 'metal', lo=2, hi=5, ambient=0.3, flatness=0.45)
    ellipse(c, cx, py, rx - 2.5, ry - 1.5, 'metal', lo=1, hi=3, ambient=0.3, flatness=0.7)
    # Knopf: roter Pilz
    for y in range(18, py + 1):
        for x in range(cx - 8, cx + 9):
            if abs(x + 0.5 - cx) <= 7.5 and y >= 23:
                u = (x - (cx - 7.5)) / 15.0
                c.put_ramp(x, y, 'teamA', quant(0.85 - 0.6 * u, 1, 4, x, y))
    ellipse(c, cx, 23, 8.0, 6.2, 'teamA', lo=1, hi=5, ambient=0.15)
    c.put_ramp(14, 20, 'bone', 5)
    c.put_ramp(15, 19, 'bone', 5)
    c.put_ramp(14, 21, 'teamA', 5)
    c.put_ramp(15, 20, 'teamA', 5)
    c.outline()
    # Glasglocke: Kuppel, nur Rand + Glanz (nach der Outline gemalt, damit das Innere durchsichtig bleibt)
    for y in range(2, py + 1):
        for x in range(cx - 16, cx + 17):
            nx = (x + 0.5 - cx) / 12.8
            ny = (y + 0.5 - 28.5) / 25.0
            d = nx * nx + ny * ny
            if d <= 1.0 and y <= py:
                if d > 0.80:
                    ang = math.atan2(ny, nx)
                    lit = 0.5 + 0.5 * math.cos(ang - math.radians(-135))
                    c.put_ramp(x, y, 'ice', quant(0.2 + 0.8 * lit, 1, 5, x, y))
                elif (x % 4 == 1 and y % 4 == 1) and d > 0.2:
                    c.put_ramp(x, y, 'ice', 4)
            elif d <= 1.22 and y <= py and not c.alpha(x, y):
                c.put_ramp(x, y, 'ice', 0)
    # Glanzstreifen links
    for k in range(10):
        c.put_ramp(7 + k // 3, 9 + k, 'bone', 5)
        if k % 2 == 0:
            c.put_ramp(8 + k // 3, 9 + k, 'ice', 5)
    c.put_ramp(11, 6, 'bone', 5)
    c.put_ramp(12, 5, 'ice', 5)
    # Scharnier am Glas
    c.rect(cx + 12, py - 2, cx + 14, py + 1, 'gold', 4)
    c.put_ramp(cx + 13, py - 1, 'gold', 5)
    return c


def warning_sign() -> Canvas:
    """Dreieckschild mit Ausrufezeichen (kein Text), 20 x 30"""
    c = Canvas(20, 30)
    c.rect(9, 12, 11, 28, 'wood', 3)
    c.rect(9, 12, 9, 28, 'wood', 4)
    c.rect(11, 12, 11, 28, 'wood', 1)
    c.rect(7, 27, 13, 28, 'wood', 1)
    poly(c, [(1, 16), (19, 16), (10, 1)], 'coal', flat=1)
    poly(c, [(3.5, 15), (16.5, 15), (10, 4)], 'gold', lo=2, hi=5)
    c.rect(10, 7, 10, 11, 'coal', 1)
    c.rect(9, 7, 9, 11, 'coal', 2)
    c.put_ramp(10, 13, 'coal', 1)
    c.put_ramp(9, 13, 'coal', 2)
    c.outline()
    return c


def coin_pile(w=22, h=12, seed=1) -> Canvas:
    """Haeufchen Goldmuenzen mit Edelstein (Koeder)"""
    c = Canvas(w, h)
    ellipse(c, w / 2.0, h - 4.5, w / 2.0 - 1.5, 4.8, 'gold', lo=1, hi=5, ambient=0.2, flatness=0.2,
            clip=lambda x, y: y <= h - 3)
    ellipse(c, w / 2.0 - 1, h - 7, w / 3.0, 3.6, 'gold', lo=2, hi=5, ambient=0.25)
    rnd = random.Random(seed)
    for _ in range(9):
        x, y = rnd.randint(3, w - 5), rnd.randint(h - 9, h - 4)
        if c.alpha(x, y):
            c.put_ramp(x, y, 'gold', 5)
            c.put_ramp(x + 1, y, 'gold', 4)
            c.put_ramp(x, y + 1, 'gold', 2)
    gx = w - 7
    poly(c, [(gx, 4), (gx + 3, 2), (gx + 5, 4), (gx + 3, 7)], 'ice', lo=2, hi=5)
    c.put_ramp(gx + 2, 3, 'bone', 5)
    c.outline()
    return c
