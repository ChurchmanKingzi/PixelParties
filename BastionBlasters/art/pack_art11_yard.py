"""pack_art11: Hof-Bauteile und Tuerme (Eilgang, Rutschbahn, Rueckholportal, Schildkuppel, Fangnetz, Dunstkamin, Blitzableiter)."""
from __future__ import annotations

from pack_art11_util import *
from pack_art11_util import _lut, _code
from pack_art11_chars import *


# =========================================================================== Zahnrad


def cog(r=5, teeth=8, ramp='gold', phase=0.0, hub=True):
    """Zahnrad (Draufsicht/Vorderansicht, schattiert), Durchmesser ~ 2r + 4"""
    d = int(r * 2 + 5)
    c = Canvas(d, d)
    cx = cy = (d - 1) / 2.0
    for y in range(d):
        for x in range(d):
            dx, dy = x - cx, y - cy
            rr = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            tooth = 0.5 + 0.5 * math.cos(ang * teeth + phase)
            rad = r - 0.6 + (1.5 if tooth > 0.5 else 0.0)
            if rr > rad:
                continue
            nx, ny = dx / (r + 1.5), dy / (r + 1.5)
            L = 0.55 - 0.5 * (nx * 0.55 + ny * 0.65) + (0.12 if rr > r - 1.5 else 0.0)
            c.put_ramp(x, y, ramp, quant(max(0.0, min(1.0, L)), 1, 5, x, y))
    if hub:
        hr = max(1.2, r * 0.36)
        for y in range(d):
            for x in range(d):
                if math.hypot(x - cx, y - cy) <= hr:
                    c.put_ramp(x, y, 'coal', 1)
        c.put_ramp(int(cx), int(cy), 'metal', 4)
    c.outline()
    return c


# =========================================================================== Eilgang (BU-06)


def conveyor_base(cells=3):
    """Rollband (Draufsicht): Nordschiene, Band mit Pfeilen, Endwalzen. Breite 32 * cells + 4, Hoehe 27"""
    W, H = 32 * cells + 4, 27
    c = Canvas(W, H)
    # Nordschiene (Draufsicht, Licht oben)
    for y, idx in enumerate((5, 4, 4, 3, 2, 1)):
        for x in range(4, W - 4):
            c.put_ramp(x, y, 'metal', idx)
    for x in range(8, W - 8, 12):
        rivet(c, x, 2)
    # Band
    by0, by1 = 6, 25
    for y in range(by0, by1 + 1):
        for x in range(6, W - 6):
            seg = (x - 6) // 3
            idx = 2 if seg % 2 == 0 else 1
            if y <= by0 + 1:
                idx = 0
            if y >= by1:
                idx = 1
            c.put_ramp(x, y, 'coal', idx)
    # Pfeile (Chevrons nach rechts)
    for x0 in range(10, W - 12, 14):
        for dy in range(-7, 8):
            xx = x0 + 7 - abs(dy)
            yy = (by0 + by1) // 2 + dy + 1
            c.put_ramp(xx, yy, 'gold', 4)
            c.put_ramp(xx - 1, yy, 'gold', 3)
            c.put_ramp(xx + 1, yy, 'gold', 2)
    # Endwalzen (Zylinder quer, Licht links)
    for xs in (0, W - 7):
        for y in range(1, 27):
            for k in range(7):
                x = xs + k
                L = 0.92 - 0.14 * k
                if k == 0 or k == 6:
                    L -= 0.3
                c.put_ramp(x, y, 'metal', quant(max(0.0, L), 1, 5, x, y))
        for y in range(3, 26, 4):
            c.rect(xs + 1, y, xs + 5, y, 'metal', 1)
    c.outline()
    return c


def conveyor_front(cells=3):
    """Suedseite (Vorderansicht): Blechfront mit Zahnraedern, Beine, Nieten (Breite 32 * cells + 4, Hoehe 17)"""
    W, H = 32 * cells + 4, 17
    c = Canvas(W, H)
    for x in range(1, W - 1):
        c.put_ramp(x, 0, 'metal', 5)
        c.put_ramp(x, 1, 'metal', 4)
    for y in range(2, 14):
        for x in range(1, W - 1):
            L = 0.72 - 0.035 * (y - 2)
            c.put_ramp(x, y, 'metal', quant(L, 1, 3, x, y))
    for x in range(1, W - 1):
        c.put_ramp(x, 13, 'metal', 1)
    # Zahnraeder auf der Front (gross + klein, gegenlaeufig)
    for k, x0 in enumerate(range(10, W - 24, 28)):
        c.blit(cog(3, 6, 'gold', 0.4 + k), x0, 2)
        c.blit(cog(2, 6, 'gold', 1.0), x0 + 10, 5)
    for x in range(6, W - 6, 14):
        rivet(c, x, 1)
    # Beine
    for x0 in (4, W - 9):
        c.rect(x0, 13, x0 + 4, 16, 'metal', 2)
        c.rect(x0, 13, x0, 16, 'metal', 4)
    c.outline()
    return c


def bell_post(ring=False):
    """Pfosten mit Messingglocke am Ausleger, Zugschnur (16 x 38)"""
    c = Canvas(16, 38)
    c.rect(2, 12, 4, 36, 'wood', 3)
    c.rect(2, 12, 2, 36, 'wood', 4)
    c.rect(4, 12, 4, 36, 'wood', 1)
    c.rect(0, 35, 7, 37, 'wood', 2)
    c.rect(0, 35, 7, 35, 'wood', 4)
    # Ausleger
    c.rect(2, 11, 13, 12, 'wood', 3)
    c.rect(2, 11, 13, 11, 'wood', 5)
    c.line(4, 18, 9, 12, 'wood', 2)
    # Glocke
    poly(c, [(8, 14), (14, 14), (15, 20), (7, 20)], 'gold', lo=2, hi=5)
    ellipse(c, 11, 14.5, 3.0, 3.2, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 15)
    c.rect(7, 20, 15, 20, 'gold', 3)
    c.put_ramp(11, 22, 'wood', 4)
    c.put_ramp(11, 21, 'gold', 4)
    c.put_ramp(9, 15, 'gold', 5)
    c.put_ramp(9, 16, 'gold', 5)
    # Zugschnur
    for y in range(13, 30):
        c.put_ramp(6, y, 'bone', 3)
    c.put_ramp(6, 30, 'teamA', 3)
    c.put_ramp(6, 31, 'teamA', 2)
    c.outline()
    return c


def ding(world, x, y):
    """Klingel-Klang: zwei kleine Bogen und ein Stern"""
    for (dx, dy, i) in ((3, -2, 5), (4, -1, 4), (4, 0, 4), (4, 1, 4), (3, 2, 5), (7, -4, 4), (8, -3, 3), (8, -1, 3), (8, 1, 3), (7, 3, 4)):
        px_at(world, x + dx, y + dy, 'gold', i, 9500)
    star(world, x - 3, y - 5, 'gold', False)


# =========================================================================== Rutschbahn (BU-07)


def spr_slider(anim='idle', f=0, kind='cloth', species='human'):
    """Rutscher in Rutschhaltung: Arme hoch, Mund weit offen (Jauchzen); species goblin = Feind mit Beutesack (22 x 22)"""
    c = Canvas(22, 22)
    gob = species == 'goblin'
    skin = 'goblin' if gob else 'skin'
    # Beine nach vorn (rechts), leicht angewinkelt
    thick_line(c, 8, 15, 15, 17, 2.8, 'wood', lo=1, hi=3)
    thick_line(c, 9, 16, 16, 19, 2.8, 'wood', lo=2, hi=4)
    c.rect(15, 16, 18, 17, 'wood', 2)
    c.rect(16, 18, 19, 19, 'wood', 3)
    # Rumpf
    round_rect(c, 3, 8, 11, 17, kind, lo=1, hi=4, radius=2)
    c.rect(3, 13, 11, 13, 'gold', 2)
    if gob:
        ellipse(c, 2.6, 12, 3.2, 3.6, 'dirt', lo=1, hi=4)
    # Arme in die Luft
    thick_line(c, 5, 10, 2, 3, 2.0, skin, lo=1, hi=4)
    thick_line(c, 10, 10, 14, 3, 2.0, skin, lo=3, hi=5)
    c.put_ramp(1, 2, skin, 3)
    c.put_ramp(15, 2, skin, 5)
    # Kopf mit weit offenem Mund
    ellipse(c, 8, 6, 4.0, 3.7, skin, lo=2, hi=5)
    if gob:
        poly(c, [(4, 5), (0, 3), (4, 8)], 'goblin', lo=1, hi=4)
        poly(c, [(12, 5), (16, 3), (12, 8)], 'goblin', lo=2, hi=5)
    c.put_ramp(10, 5, 'coal', 1)
    c.put_ramp(7, 5, 'coal', 1)
    c.rect(8, 8, 10, 8, 'coal', 1)
    c.put_ramp(9, 9, 'coal', 1)
    # flatternde Haare / Muetze
    if gob:
        pass
    else:
        for (x, y, i) in ((4, 2, 2), (5, 1, 3), (7, 1, 2), (3, 3, 1), (2, 4, 2), (1, 5, 1)):
            c.put_ramp(x, y, 'wood', i)
        c.rect(5, 3, 10, 3, 'wood', 2)
    c.outline()
    return c


def slide_sprite():
    """Wellblech-Rutschbahn mit Leiterturm, Wasserfilm und Pfuetze am Ende (92 x 58). Fusspunkt unten."""
    W, H = 92, 58
    c = Canvas(W, H)
    gy = H - 4                      # Bodenlinie
    # --- Pfuetze am Ende (Boden)
    ellipse(c, 78, gy - 1, 14, 4.2, 'ice', lo=2, hi=5, ambient=0.4, flatness=0.5)
    for (x, y) in ((70, gy - 2), (73, gy), (79, gy - 3), (84, gy), (88, gy - 2)):
        c.put_ramp(x, y, 'bone', 5)
        c.put_ramp(x + 1, y, 'bone', 4)
    # --- Strebe unter der Rutsche
    for x in (50, 68):
        t = (x - 28) / 46.0
        y_s = int(22 + t * 26)
        c.rect(x, y_s + 4, x + 1, gy, 'wood', 3)
        c.rect(x, y_s + 4, x, gy, 'wood', 4)
    # --- Turm
    for (x0, x1) in ((3, 6), (24, 27)):
        c.rect(x0, 18, x1, gy, 'wood', 3)
        c.rect(x0, 18, x0, gy, 'wood', 5)
        c.rect(x1, 18, x1, gy, 'wood', 1)
        c.rect(x0 - 1, gy - 1, x1 + 1, gy, 'wood', 2)
    thick_line(c, 6, 22, 24, 52, 2.0, 'wood', lo=1, hi=3)
    # Leiter
    for x in (11, 19):
        c.rect(x, 22, x, gy - 1, 'wood', 4 if x < 15 else 2)
    for y in range(25, gy - 1, 5):
        c.rect(11, y, 19, y, 'wood', 5)
        c.rect(11, y + 1, 19, y + 1, 'wood', 1)
    # Plattform + Gelaender
    round_rect(c, 0, 14, 30, 19, 'wood', lo=1, hi=4, radius=1)
    c.rect(1, 14, 29, 14, 'wood', 5)
    for x in (2, 14, 28):
        c.rect(x, 5, x + 1, 14, 'wood', 3)
        c.rect(x, 5, x, 14, 'wood', 5)
    c.rect(2, 5, 29, 6, 'wood', 4)
    c.rect(2, 5, 29, 5, 'wood', 5)
    # Fahne in Teamfarbe
    c.rect(2, 0, 2, 5, 'wood', 3)
    for k in range(7):
        c.put_ramp(3 + k, 0 + (k // 3), 'teamA', 4)
        c.put_ramp(3 + k, 1 + (k // 3), 'teamA', 3)
        if k < 5:
            c.put_ramp(3 + k, 2 + (k // 3), 'teamA', 2)
    # --- Rutsche (Band, Streifen laengs der Neigung) ---
    x_a, y_a = 28, 22            # Start (Plattformkante), Suedkante der Oberflaeche
    x_b, y_b = 74, 48            # Ende
    wd = 8                       # sichtbare Breite (Nordkante liegt hoeher)
    slope = (y_b - y_a) / float(x_b - x_a)
    for x in range(x_a, x_b + 1):
        ys = y_a + (x - x_a) * slope
        for k in range(wd + 1):
            y = int(round(ys - k))
            stripe = (k // 2) % 2
            idx = 4 if stripe == 0 else 3
            if k == 0:
                idx = 1
            elif k == wd:
                idx = 5
            elif (x // 3 + k) % 7 == 0:
                idx = 2
            c.put_ramp(x, y, 'metal', idx)
        # Vorderwand (Suedseite) der Rutsche
        for k in range(1, 4):
            c.put_ramp(x, int(round(ys)) + k, 'metal', 2 if k < 3 else 0)
    # Auslauf (flach)
    for x in range(x_b + 1, x_b + 12):
        ys = y_b + (x - x_b) * 0.15
        for k in range(wd + 1):
            y = int(round(ys - k))
            idx = 4 if (k // 2) % 2 == 0 else 3
            if k == 0:
                idx = 1
            elif k == wd:
                idx = 5
            c.put_ramp(x, y, 'metal', idx)
        for k in range(1, 3):
            c.put_ramp(x, int(round(ys)) + k, 'metal', 2 if k < 2 else 0)
    # Wasserfilm mittig (flimmernd) + Nieten
    for x in range(x_a + 3, x_b + 8):
        ys = y_a + (min(x, x_b) - x_a) * slope + max(0, x - x_b) * 0.15
        y = int(round(ys - 4))
        c.put_ramp(x, y, 'ice', 5 if x % 3 else 4)
        if x % 2 == 0:
            c.put_ramp(x, y - 1, 'ice', 4)
        elif x % 4 == 1:
            c.put_ramp(x, y + 1, 'sky', 3)
    for x in range(x_a + 6, x_b, 12):
        ys = y_a + (x - x_a) * slope
        rivet(c, x, int(round(ys)) + 1)
    # Wasserrohr am Turm, spritzt auf den Start
    c.rect(26, 7, 33, 8, 'metal', 3)
    c.put_ramp(33, 9, 'metal', 2)
    for (x, y) in ((33, 11), (34, 14), (35, 17), (33, 13), (36, 19)):
        c.put_ramp(x, y, 'ice', 5)
    c.outline()
    return c


def splash_drops(world, cx, cy, key=9100):
    """Wasserspritzer ueber der Pfuetze"""
    pts = [(-9, -6, 5), (-6, -11, 4), (-2, -14, 5), (3, -12, 5), (7, -8, 4), (10, -4, 5), (0, -7, 4), (-4, -4, 5), (5, -3, 5)]
    for (dx, dy, i) in pts:
        px_at(world, cx + dx, cy + dy, 'bone' if i == 5 else 'ice', 5 if i == 5 else 4, key)
        px_at(world, cx + dx, cy + dy + 1, 'ice', 4, key)


# =========================================================================== Rueckholportal (BU-09)


def portal_sprite():
    """Aufrechter Torus-Ring aus Metall mit Rune-Punkten, Wirbel im Inneren, Zahnraeder und Kristall-Sockel (68 x 62)"""
    from pack_art11_rooms import crystal_pylon
    W, H = 68, 62
    c = Canvas(W, H)
    cx, cy = 34.0, 28.0
    R_out, R_in = 21.0, 14.5
    # Sockel (flache Scheibe, Draufsicht)
    ellipse(c, cx, 55, 29, 6.0, 'stone', lo=1, hi=4, ambient=0.35, flatness=0.3)
    ellipse(c, cx, 54, 21, 4.2, 'stone', lo=2, hi=5, ambient=0.3, flatness=0.3)
    # Kristall-Pylone links und rechts (hinter dem Ring)
    for (px_, py_) in ((0, 34), (54, 34)):
        c.blit(crystal_pylon(26), px_, py_)
    # Wirbel im Inneren (Spirale, dithert)
    for y in range(int(cy - R_in) - 1, int(cy + R_in) + 2):
        for x in range(int(cx - R_in) - 1, int(cx + R_in) + 2):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            rr = math.hypot(dx, dy)
            if rr > R_in + 0.5:
                continue
            a = math.atan2(dy, dx)
            s = (a + rr * 0.34) * 3.0 / math.pi
            band = s - math.floor(s)
            t = rr / R_in
            if t < 0.16:
                idx, ramp = 5, 'bone'
            elif t < 0.34:
                ramp = 'ice'
                idx = 5 if band < 0.5 else 4
            else:
                ramp = 'purple'
                idx = 4 if band < 0.3 else (3 if band < 0.65 else 2)
                if t > 0.82:
                    idx = max(1, idx - 1)
                if (x + y) % 2 == 0 and 0.3 < band < 0.4:
                    idx = min(5, idx + 1)
            c.put_ramp(x, y, ramp, idx)
    # Ring (Torus, schattiert)
    for y in range(int(cy - R_out) - 2, int(cy + R_out) + 3):
        for x in range(int(cx - R_out) - 2, int(cx + R_out) + 3):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            rr = math.hypot(dx, dy)
            if rr < R_in or rr > R_out:
                continue
            tt = (rr - R_in) / (R_out - R_in)           # 0 innen, 1 aussen
            nn = tt * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            ox, oy = dx / rr, dy / rr
            dot = nz * LIGHT[2] + nn * (ox * LIGHT[0] + oy * LIGHT[1])
            L = 0.2 + 0.8 * max(0.0, dot)
            c.put_ramp(x, y, 'metal', quant(L, 1, 5, x, y))
    # goldene Runenpunkte auf dem Ring
    for k in range(16):
        a = math.radians(k * 22.5 + 11)
        rr = (R_in + R_out) / 2.0
        x, y = int(cx + math.cos(a) * rr), int(cy + math.sin(a) * rr)
        c.put_ramp(x, y, 'gold', 5 if k % 2 else 4)
        if k % 2 == 0:
            c.put_ramp(x + 1, y, 'gold', 3)
    # Zahnraeder am Ring (vor den Pylonen)
    for (r, teeth, gx, gy, ph, ramp) in ((6, 9, 54, 42, 0.2, 'gold'), (4, 7, 14, 44, 0.9, 'metal'), (5, 8, 54, 12, 0.5, 'metal'), (3, 6, 12, 10, 0.1, 'gold')):
        g = cog(r, teeth, ramp, ph)
        c.blit(g, gx - g.w // 2, gy - g.h // 2)
    # Funken am Ring
    for (x, y) in ((28, 5), (46, 8), (56, 26), (12, 28)):
        c.put_ramp(x, y, 'ice', 5)
        c.put_ramp(x + 1, y, 'ice', 3)
        c.put_ramp(x, y + 1, 'ice', 3)
    c.outline()
    return c


def portal_sign():
    """Wegweiser: Pfosten, Schild mit Koffer und Pfeil nach rechts (Text-frei) (26 x 36)"""
    c = Canvas(26, 36)
    c.rect(12, 12, 14, 34, 'wood', 3)
    c.rect(12, 12, 12, 34, 'wood', 4)
    c.rect(11, 32, 15, 34, 'wood', 1)
    round_rect(c, 1, 2, 24, 16, 'wood', lo=1, hi=4, radius=1)
    c.rect(3, 4, 22, 14, 'coal', 1)
    c.rect(3, 4, 22, 4, 'coal', 2)
    # Koffer
    c.rect(5, 8, 10, 12, 'dirt', 3)
    c.rect(5, 8, 10, 8, 'dirt', 5)
    c.rect(5, 12, 10, 12, 'dirt', 1)
    c.rect(7, 6, 8, 7, 'dirt', 2)
    c.rect(5, 10, 10, 10, 'gold', 3)
    # Pfeil nach rechts
    c.rect(13, 8, 18, 10, 'gold', 4)
    poly(c, [(18, 6), (22, 9), (18, 12)], 'gold', lo=3, hi=5)
    c.outline()
    return c


def dissolve_sprite(spr, rng, x_start, strength=1.0):
    """Teleport-Aufloesung: rechts von x_start wird der Sprite zunehmend verstreut (zeigt nach rechts)"""
    out = Canvas(spr.w, spr.h)
    parts = []
    for y in range(spr.h):
        for x in range(spr.w):
            if spr.px[y, x, 3] == 0:
                continue
            if x < x_start:
                out.px[y, x] = spr.px[y, x]
                out.rid[y, x] = spr.rid[y, x]
                continue
            t = min(1.0, (x - x_start) / float(spr.w - x_start))
            if rng.random() < (0.15 + 0.85 * t) * strength:
                if rng.random() < 0.75:
                    parts.append((x, y, t))
            else:
                out.px[y, x] = spr.px[y, x]
                out.rid[y, x] = spr.rid[y, x]
    return out, parts


def bandaged_skeleton(f=2):
    """verletztes Skelett (Rueckzug): Kopfverband, Armschlinge (32 x 32, nach rechts)"""
    c = skeleton('walk', f)
    # Kinn-Kopf-Verband
    for (x, y) in ((13, 10), (13, 11), (13, 12), (13, 13), (13, 14), (14, 15), (15, 15), (16, 15), (17, 15), (18, 15), (19, 15), (20, 15), (21, 14), (21, 13), (21, 12), (21, 11), (21, 10)):
        c.put_ramp(x, y, 'bone', 5 if (x + y) % 2 else 4)
    # Verband am Arm und Rumpf
    for (x, y) in ((11, 18), (12, 19), (13, 18), (11, 20), (12, 21), (13, 20), (14, 22), (15, 22)):
        c.put_ramp(x, y, 'bone', 5)
    return c


# =========================================================================== Schildkuppel-Generator (BA-01)


def dome_generator():
    """Generator: Steinsockel, Messing-Saeule mit Spulen, schwebender Kristall mit Funkenbogen (36 x 50)"""
    W, H = 36, 50
    c = Canvas(W, H)
    cx = 17
    # Sockel
    ellipse(c, cx + 0.5, 45, 16, 5.0, 'stone', lo=1, hi=4, ambient=0.3, flatness=0.3)
    round_rect(c, 7, 36, 28, 46, 'stone', lo=1, hi=5, radius=2)
    c.rect(8, 36, 27, 36, 'stone', 5)
    for x in range(9, 27, 3):
        c.put_ramp(x, 41, 'stone', 2)
    # Saeule (Zylinder, Licht links)
    for y in range(17, 37):
        for x in range(11, 24):
            u = (x - 11 + 0.5) / 13.0
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            L = 0.2 + 0.8 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
            c.put_ramp(x, y, 'gold', quant(L, 1, 4, x, y))
    for y in (20, 26, 32):
        c.rect(10, y, 24, y + 1, 'metal', 2)
        c.rect(10, y, 24, y, 'metal', 4)
    # Kristallhalter (drei Zinken)
    for (x0, x1) in ((11, 8), (17, 17), (23, 26)):
        c.line(x0, 17, x1, 11, 'gold', 4)
        c.line(x0 + 1, 17, x1 + 1, 11, 'gold', 2)
    # Spulen-Kugeln links/rechts mit Funkenbogen
    for (ox, oy) in ((3, 24), (31, 24)):
        c.line(ox + (4 if ox < 10 else -4), oy, 11 if ox < 10 else 24, oy + 2, 'gold', 3)
        ellipse(c, ox, oy, 3.2, 3.2, 'metal', lo=1, hi=5)
        c.put_ramp(ox - 1, oy - 1, 'metal', 5)
    # Kristall (Prisma, schwebt)
    top, bot = 0, 15
    L1, L2, R1, R2 = (9, 5), (9, 11), (25, 5), (25, 11)
    poly(c, [(17, top), L1, L2, (17, bot), (17, 8)], 'ice', lo=2, hi=5, flat=None)
    poly(c, [(17, top), (17, 8), (17, bot), R2, R1], 'purple', lo=1, hi=4, flat=None)
    poly(c, [(17, top), L1, (13, 6), (17, 3)], 'ice', flat=5)
    c.put_ramp(14, 8, 'ice', 5)
    c.put_ramp(14, 9, 'ice', 5)
    c.outline()
    return c


def dome_overlay(world, cx, cy, rx, ry, impact=None, key=9800):
    """Seifenblasen-Kuppel ueber die fertige Szene legen: Fresnel-Rand mit Regenbogenfarben, leichter Schimmer, Glanzlichter.
    impact = (x, y): Einschlag mit Wellenringen"""
    H, W = world.h, world.w
    Y, X = np.mgrid[0:H, 0:W]
    d = np.hypot((X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry)
    ang = np.arctan2((Y + 0.5 - cy) / ry, (X + 0.5 - cx) / rx)
    inside = d < 1.0
    chk = ((X + Y) % 2 == 0)
    # leichter Schimmer im Inneren: nahe dem Rand heller
    m1 = inside & (d > 0.62) & chk
    shade_mask(world, m1, 1)
    m2 = inside & (d > 0.82)
    shade_mask(world, m2, 1)
    # Regenbogen-Rand
    ring = inside & (d > 0.915)
    cols = (('ice', 5), ('purple', 4), ('cloth', 5), ('slime', 5), ('gold', 5), ('ice', 4))
    sub = world.px
    for (y, x) in zip(*np.nonzero(ring)):
        a = ang[y, x]
        t = (a + math.pi) / (2 * math.pi) * len(cols) * 1.5 + d[y, x] * 6
        i = int(t) % len(cols)
        if d[y, x] > 0.965 and (x + y) % 2:
            i = (i + 1) % len(cols)
        ramp, idx = cols[i]
        if d[y, x] <= 0.945 and (x + y) % 2:
            continue                      # innerer Rand nur halb gefuellt (transparenter)
        sub[y, x, :3] = RAMPS[ramp][idx]
        world.depth[y, x] = max(int(world.depth[y, x]), key)
    # heller Aussenrand (Kontur)
    edge = inside & (d > 0.985)
    for (y, x) in zip(*np.nonzero(edge)):
        sub[y, x, :3] = RAMPS['bone'][5]
        world.depth[y, x] = max(int(world.depth[y, x]), key)
    # Glanzlichter (oben links), Reflex unten rechts
    for k in range(0, 34):
        a = math.radians(196 + k * 1.9)
        for (rr, ramp, idx) in ((0.80, 'bone', 5), (0.76, 'ice', 5)):
            if rr == 0.76 and k % 3:
                continue
            x = int(cx + math.cos(a) * rx * rr)
            y = int(cy + math.sin(a) * ry * rr)
            px_at(world, x, y, ramp, idx, key)
    for k in range(0, 10):
        a = math.radians(24 + k * 2.4)
        x = int(cx + math.cos(a) * rx * 0.82)
        y = int(cy + math.sin(a) * ry * 0.82)
        px_at(world, x, y, 'ice', 5, key)
    # Boden-Kontaktlinie (untere Haelfte) leicht leuchten lassen
    # Einschlag mit Wellenringen
    if impact:
        ix, iy = impact
        for k, r in enumerate((4, 8, 12, 16)):
            for t in range(0, 360, 6 if r < 10 else 4):
                a = math.radians(t)
                x = int(round(ix + math.cos(a) * r * 1.15))
                y = int(round(iy + math.sin(a) * r * 0.9))
                if not (0 <= x < W and 0 <= y < H) or d[y, x] >= 1.0:
                    continue
                if (t // 6 + k) % 2 == 0 and k >= 2:
                    continue
                px_at(world, x, y, 'bone' if k < 2 else 'ice', 5 if k < 2 else 4, key + 10)


# =========================================================================== Fangnetz-Schleuder (BA-03)


def net_launcher(ball=True):
    """Riesiges Fliegennetz: Holzreifen mit Maschen (durchsichtig), Stiel auf Drehsockel mit Spannfeder, gefangene Kugel (50 x 72)"""
    W, H = 50, 72
    c = Canvas(W, H)
    cx, cy = 25.0, 22.0
    R_out, R_in = 20.5, 17.5
    # Sockel: Holzplattform auf zwei Kufen
    for x in (3, 38):
        c.rect(x, 66, x + 8, 70, 'wood', 2)
        c.rect(x, 66, x + 8, 66, 'wood', 4)
    round_rect(c, 2, 61, 47, 67, 'wood', lo=1, hi=4, radius=1)
    c.rect(3, 61, 46, 61, 'wood', 5)
    for x in range(6, 46, 7):
        c.put_ramp(x, 64, 'wood', 1)
        c.put_ramp(x, 63, 'wood', 5)
    # Drehscheibe + Spannfeder
    ellipse(c, 25, 60, 9, 3.2, 'metal', lo=1, hi=5)
    # Stiel (leicht geneigt)
    thick_line(c, 25, 41, 25, 60, 4.4, 'wood', lo=1, hi=5)
    c.rect(24, 42, 24, 59, 'wood', 5)
    # Spannfeder (Zickzack) links vom Stiel
    for k in range(8):
        x = 15 if k % 2 == 0 else 21
        y0 = 62 - k * 3
        c.line(x, y0, 36 - x, y0 - 3, 'metal', 4 if k % 2 else 3)
    c.line(15, 62, 11, 62, 'metal', 3)
    c.line(25, 37, 25, 40, 'metal', 3)
    c.line(36, 40, 25, 52, 'bone', 3)
    # Maschen (nur Linien, Loecher durchsichtig)
    for y in range(int(cy - R_in) - 1, int(cy + R_in) + 2):
        for x in range(int(cx - R_in) - 1, int(cx + R_in) + 2):
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) >= R_in + 0.2:
                continue
            u, v = x - int(cx), y - int(cy)
            if (u + v) % 5 == 0 or (u - v) % 5 == 0:
                c.put_ramp(x, y, 'bone', 4 if (u + v) % 10 else 5)
            elif (u + v + 1) % 5 == 0 and (x + y) % 2 == 0:
                c.put_ramp(x, y, 'bone', 2)
    # gefangene Kugel (beulte das Netz aus), Maschen darueber
    if ball:
        bx, by = 28.5, 23.5
        ellipse(c, bx, by, 8.0, 8.0, 'stone', lo=0, hi=5)
        for (x, y) in ((25, 20), (26, 20), (25, 21)):
            c.put_ramp(x, y, 'bone', 5)
        for y in range(int(by - 9), int(by + 10)):
            for x in range(int(bx - 9), int(bx + 10)):
                if c.alpha(x, y) and math.hypot(x + 0.5 - bx, y + 0.5 - by) < 8.0:
                    u, v = x - int(cx), y - int(cy)
                    if (u + v) % 4 == 0 or (u - v) % 4 == 0:
                        c.put_ramp(x, y, 'bone', 3 if (x + y) % 2 else 4)
    # Reifen (Holz, Torus)
    for y in range(int(cy - R_out) - 2, int(cy + R_out) + 3):
        for x in range(int(cx - R_out) - 2, int(cx + R_out) + 3):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            rr = math.hypot(dx, dy)
            if rr < R_in or rr > R_out:
                continue
            tt = (rr - R_in) / (R_out - R_in)
            nn = tt * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            ox, oy = dx / rr, dy / rr
            dot = nz * LIGHT[2] + nn * (ox * LIGHT[0] + oy * LIGHT[1])
            L = 0.25 + 0.75 * max(0.0, dot)
            c.put_ramp(x, y, 'wood', quant(L, 1, 5, x, y))
    # Beschlag am Stiel
    c.rect(22, 39, 28, 42, 'metal', 3)
    c.rect(22, 39, 28, 39, 'metal', 5)
    c.rect(22, 42, 28, 42, 'metal', 1)
    rivet(c, 23, 40)
    rivet(c, 26, 40)
    c.outline()
    return c


# =========================================================================== Dunstkamin (BA-02)


def chimney_tower():
    """Rauchiger Backstein-Turm: Steinsockel mit glimmender Feuertuer, schlanker Schlot mit Eisenbaendern (40 x 60)"""
    W, H = 40, 60
    c = Canvas(W, H)
    # Sockel (Quader-Front, leicht rund gelichtet)
    bx0, bx1 = 4, 35
    for y in range(31, 58):
        for x in range(bx0, bx1 + 1):
            u = (x - bx0 + 0.5) / (bx1 - bx0 + 1)
            L = 0.7 - 0.35 * u - 0.012 * (y - 31)
            idx = quant(max(0.0, L), 1, 4, x, y)
            row = (y - 31) // 6
            yy = (y - 31) % 6
            off = 8 if row % 2 else 0
            if yy == 5:
                idx = max(0, idx - 1)
            elif (x + off) % 16 == 0:
                idx = max(0, idx - 1)
            elif yy == 0:
                idx = min(5, idx + 1)
            c.put_ramp(x, y, 'stone', idx)
    # Russ am oberen Sockelrand
    for x in range(bx0, bx1 + 1):
        if texture_noise(x, 1, 7) > 0.35:
            c.put_ramp(x, 31, 'coal', 2)
        if texture_noise(x, 2, 8) > 0.6:
            c.put_ramp(x, 32, 'coal', 2)
    # Sockelkante
    c.rect(bx0 - 1, 56, bx1 + 1, 57, 'stone', 1)
    c.rect(bx0 - 1, 30, bx1 + 1, 30, 'stone', 5)
    # Feuertuer mit Glut
    for y in range(40, 58):
        for x in range(13, 27):
            dx = (x + 0.5 - 20) / 7.0
            if y < 47 and dx * dx + ((y - 47) / 7.0) ** 2 > 1.0:
                continue
            d = abs(dx)
            idx = 5 if (d < 0.35 and y > 50) else (4 if d < 0.6 else (3 if d < 0.85 else 2))
            if (x + y) % 2 and d > 0.5:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'fire', idx)
    c.rect(12, 47, 12, 57, 'coal', 1)
    c.rect(27, 47, 27, 57, 'coal', 1)
    for x in range(14, 26):
        c.put_ramp(x, 40 + (1 if 17 < x < 23 else 2), 'stone', 5)
    c.rect(15, 54, 25, 56, 'coal', 0)
    for x in (16, 19, 22):
        c.rect(x, 54, x, 57, 'metal', 3)
    # Schlot: Backstein-Zylinder, verjuengt sich
    for y in range(6, 31):
        t = (y - 6) / 24.0
        half = 6.5 + t * 2.5
        x0, x1 = int(20 - half), int(20 + half)
        for x in range(x0, x1 + 1):
            u = (x - x0 + 0.5) / (x1 - x0 + 1)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            L = 0.15 + 0.85 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
            idx = quant(L, 1, 3, x, y)
            row = (y - 6) // 4
            yy = (y - 6) % 4
            off = 4 if row % 2 else 0
            if yy == 3:
                idx = max(1, idx - 1)
            elif (x + off) % 8 == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'skin', idx)
    # Eisenbaender
    for y in (12, 22):
        t = (y - 6) / 24.0
        half = 6.5 + t * 2.5 + 0.8
        for x in range(int(20 - half), int(20 + half) + 1):
            c.put_ramp(x, y, 'metal', 3 if x < 20 else 2)
            c.put_ramp(x, y + 1, 'metal', 1)
        c.put_ramp(int(20 - half), y, 'metal', 5)
    # Steigeisen rechts
    for y in range(8, 30, 4):
        c.rect(26, y, 29, y, 'metal', 3)
        c.put_ramp(29, y, 'metal', 5)
    # Kopf des Schlots: Steinkranz, innen dunkel
    ellipse(c, 20, 6, 10, 3.2, 'stone', lo=2, hi=5)
    ellipse(c, 20, 6, 7, 2.0, 'coal', lo=0, hi=2)
    c.put_ramp(14, 5, 'stone', 5)
    c.put_ramp(15, 4, 'stone', 5)
    # Ruessstreifen
    for (x, y0, ln) in ((15, 8, 6), (23, 9, 4), (26, 13, 5)):
        for k in range(ln):
            c.put_ramp(x, y0 + k, 'coal', 2 if k % 2 == 0 else 1)
    c.outline()
    return c


def tint_pink(world, mask, bump=0):
    """Maske rosa einfaerben: jede Bodenfarbe wird auf den gleichen Rampenindex der 'cloth'-Rampe (Rosa) gelegt"""
    where, _pal = _lut()
    sub = world.px
    ys, xs = np.nonzero(mask)
    for (y, x) in zip(ys, xs):
        col = sub[y, x, :3]
        code = _code(col)
        if code not in where:
            continue
        name, i = where[code]
        sub[y, x, :3] = RAMPS['cloth'][max(1, min(5, i + bump))]


def smog_puffs(world, specs, key=9400, ramp='cloth', seed=3):
    """rosa Rauchwolken: specs = [(cx, cy, r)]; jede Wolke ist ein Blumenkohl aus Teilkugeln, Rand ausgeduennt, Glanz oben links"""
    rng = random.Random(seed)
    for (cx, cy, r) in specs:
        d = int(r * 3.2 + 8)
        cv = Canvas(d, d)
        mid = d / 2.0
        subs = [(0.0, 0.0, 1.0)]
        for k in range(6):
            a = math.radians(k * 60 + rng.randint(0, 40))
            subs.append((math.cos(a) * 0.62, math.sin(a) * 0.5, 0.58 + 0.12 * rng.random()))
        for (ox, oy, sc) in sorted(subs, key=lambda t: -t[1]):
            ellipse(cv, mid + ox * r, mid + oy * r, r * sc, r * sc * 0.9, ramp, lo=2, hi=5, ambient=0.3)
        for (ox, oy, sc) in subs:
            hx, hy = int(mid + ox * r - r * sc * 0.35), int(mid + oy * r - r * sc * 0.4)
            if cv.alpha(hx, hy):
                cv.put_ramp(hx, hy, 'skin', 5)
                cv.put_ramp(hx + 1, hy, 'bone', 5)
        # Rand ausduennen (Schachbrett), damit es halb durchsichtig wirkt
        a_ = cv.px[:, :, 3] > 0
        for y in range(d):
            for x in range(d):
                if a_[y, x] and (x + y) % 2:
                    nb = sum(1 for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < d and 0 <= y + dy < d and a_[y + dy, x + dx])
                    if nb < 4:
                        cv.clear_pixel(x, y)
        world.draw(cv, int(cx - mid), int(cy - mid), key)


# =========================================================================== Blitzableiter (BA-04)


def rod_tower():
    """Metall-Turm mit Kupferspitze: Nietenzylinder, Isolatoren, Kupferkugel mit Gesicht (Haare zu Berge), Nadel (44 x 74)"""
    W, H = 44, 74
    c = Canvas(W, H)
    cx = 22
    # Koerper: genieteter Metallzylinder
    bx0, bx1 = 7, 36
    for y in range(40, 70):
        for x in range(bx0, bx1 + 1):
            u = (x - bx0 + 0.5) / (bx1 - bx0 + 1)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            L = 0.12 + 0.88 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
            idx = quant(L, 1, 4, x, y, dw=0.18)
            if (y - 40) % 10 in (0, 1):
                idx = max(0, idx - 1) if (y - 40) % 10 else min(5, idx + 1)
            c.put_ramp(x, y, 'metal', idx)
    for y in range(41, 70, 10):
        for x in range(bx0 + 2, bx1 - 1, 5):
            c.put_ramp(x, y + 3, 'metal', 5)
            c.put_ramp(x + 1, y + 4, 'metal', 1)
    # Sockelring
    c.rect(bx0 - 2, 68, bx1 + 2, 71, 'metal', 2)
    c.rect(bx0 - 2, 68, bx1 + 2, 68, 'metal', 4)
    c.rect(bx0 - 2, 71, bx1 + 2, 71, 'metal', 0)
    # Kupferband (Mitte) mit Wappen-Blitz
    c.rect(bx0, 52, bx1, 56, 'wood', 3)
    c.rect(bx0, 52, bx1, 52, 'wood', 5)
    c.rect(bx0, 56, bx1, 56, 'wood', 1)
    c.line(24, 52, 20, 55, 'gold', 5)
    c.line(20, 55, 23, 55, 'gold', 5)
    # Deckplatte mit vier Isolatoren
    ellipse(c, cx, 40, 17.5, 4.2, 'metal', lo=1, hi=5, ambient=0.3, flatness=0.2)
    for ix in (9, 16, 28, 35):
        c.rect(ix - 1, 33, ix + 1, 38, 'bone', 3)
        c.rect(ix - 1, 33, ix - 1, 38, 'bone', 5)
        c.rect(ix - 2, 38, ix + 2, 39, 'bone', 2)
        c.put_ramp(ix, 32, 'bone', 4)
    # Kupferstange
    c.rect(cx - 1, 24, cx + 1, 38, 'wood', 3)
    c.rect(cx - 1, 24, cx - 1, 38, 'wood', 5)
    c.rect(cx + 1, 24, cx + 1, 38, 'wood', 1)
    # Spitze
    c.rect(cx, 0, cx, 10, 'metal', 4)
    c.put_ramp(cx, 0, 'metal', 5)
    c.put_ramp(cx + 1, 6, 'metal', 2)
    c.put_ramp(cx - 1, 10, 'wood', 4)
    c.put_ramp(cx + 1, 10, 'wood', 2)
    # Kupferkugel mit Gesicht
    ellipse(c, cx, 18, 7.4, 7.4, 'wood', lo=1, hi=5, ambient=0.2)
    for (x, y) in ((cx - 4, 14), (cx - 3, 13), (cx - 4, 15)):
        c.put_ramp(x, y, 'wood', 5)
    # Patina
    for (x, y) in ((cx + 5, 14), (cx + 6, 15), (cx + 5, 15), (cx + 6, 13)):
        c.put_ramp(x, y, 'leaf', 3)
    # Gesicht: grosse Augen, grosses Grinsen
    c.rect(cx - 4, 16, cx - 3, 18, 'bone', 5)
    c.rect(cx + 1, 16, cx + 2, 18, 'bone', 5)
    c.rect(cx - 3, 17, cx - 3, 18, 'coal', 1)
    c.rect(cx + 2, 17, cx + 2, 18, 'coal', 1)
    for x in range(cx - 4, cx + 4):
        c.put_ramp(x, 21, 'coal', 1)
    c.put_ramp(cx - 5, 20, 'coal', 1)
    c.put_ramp(cx + 4, 20, 'coal', 1)
    c.put_ramp(cx - 2, 22, 'bone', 5)
    c.put_ramp(cx, 22, 'bone', 5)
    c.put_ramp(cx + 2, 22, 'bone', 5)
    # Haare zu Berge: Funken-Strahlen ueber der Kugel
    for (x, y, i) in ((cx - 6, 10, 4), (cx - 4, 9, 5), (cx + 4, 9, 5), (cx + 6, 10, 4), (cx - 7, 13, 3), (cx + 7, 13, 3)):
        c.put_ramp(x, y, 'gold', i)
    c.outline()
    return c


def bolt_points(x0, y0, x1, y1, rng, jag=7, steps=7):
    pts = [(x0, y0)]
    for k in range(1, steps):
        t = k / float(steps)
        pts.append((x0 + (x1 - x0) * t + rng.randint(-jag, jag), y0 + (y1 - y0) * t))
    pts.append((x1, y1))
    return pts


def draw_bolt(world, pts, key=9600, thick=False):
    """Blitz: Kern bone/gold, Leuchtrand ice (Linien 1 px, Rand versetzt); thick = 2 px Kern"""
    segs = []
    for (a, b) in zip(pts[:-1], pts[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for k in range(n + 1):
            t = k / float(n)
            segs.append((int(round(a[0] + (b[0] - a[0]) * t)), int(round(a[1] + (b[1] - a[1]) * t))))
    for (x, y) in segs:
        for dx in (-2 if thick else -1, 2 if thick else 1):
            px_at(world, x + dx, y, 'ice', 4, key)
        px_at(world, x, y - 1, 'ice', 3, key)
    for (x, y) in segs:
        px_at(world, x, y, 'bone', 5, key + 1)
        if thick:
            px_at(world, x + 1, y, 'bone', 5, key + 1)
            px_at(world, x - 1, y, 'ice', 5, key + 1)
    for (x, y) in segs[::3]:
        px_at(world, x, y, 'gold', 5, key + 2)
