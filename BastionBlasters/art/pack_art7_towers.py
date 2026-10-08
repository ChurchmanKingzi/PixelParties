"""pack_art7: sieben Turm-Sprites (BT-02 .. BT-08), jeder mit eigener Silhouette. Südansicht, Fußpunkt = Unterkante.
Alle blicken/zielen nach rechts (der Renderer kann spiegeln)."""
from __future__ import annotations

from cards_art import *
from pack_art7_fx import *


def _blob_tier(c, cx, cy, rx, ry, ramp='slime', lo=1, hi=5, wob=0.0, seed=0):
    """gewölbte, wabbelige Stufe (Puddingturm)"""
    rid = RAMP_ID[ramp]
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 3), int(cx + rx + 4)):
            w = 1.0 + wob * math.sin((y - cy) * 0.55 + seed)
            nx = (x + 0.5 - cx) / (rx * w)
            ny = (y + 0.5 - cy) / ry
            L = sphere_L(nx, ny, 0.22)
            if L is None:
                continue
            c.put(x, y, RAMPS[ramp][quant(L, lo, hi, x, y)], rid)


def gloop_tower():
    """Gloop-Turm: grüner Schleimturm aus wabbeligen Stufen, Messing-Gießkanne als Kanone, tropft (46 x 66)"""
    c = Canvas(46, 66)
    # Pfütze am Fuß
    ellipse(c, 19, 63, 19.5, 2.8, 'slime', lo=1, hi=4, ambient=0.3)
    # Stufen von unten nach oben (jede dünner), leicht wabbelnd
    tiers = [(19, 52, 15.5, 11, 0.04), (19, 38, 12.5, 9.5, 0.05), (19, 26, 10.0, 8.0, 0.06), (19, 15.5, 7.5, 7.0, 0.07)]
    for k, (cx, cy, rx, ry, wob) in enumerate(tiers):
        _blob_tier(c, cx, cy, rx, ry, 'slime', 1, 5, wob, k * 1.7)
    # Glanzstreifen (durchscheinend) und Blasen
    for (x, y, ln) in ((9, 46, 8), (12, 33, 6), (14, 22, 5), (15, 12, 4)):
        for k in range(ln):
            c.put_ramp(x + k // 3, y + k, 'slime', 5)
            if k % 2 == 0:
                c.put_ramp(x + 1 + k // 3, y + k, 'bone', 5)
    for (x, y, r) in ((24, 48, 2), (14, 56, 1.5), (27, 36, 1.6), (19, 41, 1.2), (21, 24, 1.3), (24, 55, 1.2)):
        ellipse(c, x, y, r, r, 'slime', lo=3, hi=5, ambient=0.5)
        c.put_ramp(int(x), int(y), 'bone', 5)
    # Schießscharte (dunkle Mulde) in Stufe 2
    c.rect(18, 36, 20, 40, 'slime', 0)
    c.rect(19, 36, 19, 40, 'coal', 0)
    # zwei kleine Augen auf der unteren Stufe
    c.rect(14, 50, 14, 51, 'coal', 0)
    c.rect(22, 50, 22, 51, 'coal', 0)
    c.put_ramp(17, 55, 'coal', 1)
    c.put_ramp(18, 56, 'coal', 1)
    c.put_ramp(19, 56, 'coal', 1)
    c.put_ramp(20, 55, 'coal', 1)
    # Tropfen: kurze Fäden mit Tropfenkopf (nicht bis zum Boden)
    for (x, y0, ln) in ((9, 56, 3), (28, 58, 2), (31, 55, 4), (14, 47, 3), (26, 45, 4), (13, 32, 3), (23, 34, 3), (12, 22, 2), (27, 28, 3)):
        for k in range(ln):
            c.put_ramp(x, y0 + k, 'slime', 4 if k < ln - 1 else 3)
            c.put_ramp(x + 1, y0 + k, 'slime', 2)
        ellipse(c, x + 0.5, y0 + ln + 0.8, 1.5, 1.7, 'slime', lo=2, hi=5, ambient=0.4)
    # Zinnen aus Schleim oben (drei Beulen)
    for (x, y) in ((13, 6), (19, 4), (24, 7)):
        ellipse(c, x, y + 2.5, 3.2, 3.4, 'slime', lo=2, hi=5, ambient=0.25)
    # Gießkanne (Messing) auf dem Turm: Bügelgriff links, Tülle mit Brause nach rechts oben
    for (a_, b_) in (((19, 10), (15, 12)), ((15, 12), (14, 16)), ((14, 16), (16, 20)), ((16, 20), (19, 21))):
        thick_line(c, a_[0], a_[1], b_[0], b_[1], 2.2, 'gold', lo=1, hi=4)
    poly(c, [(19, 9), (32, 9), (33, 21), (18, 21)], 'gold', lo=1, hi=5)
    for x in range(19, 33):
        c.put_ramp(x, 21, 'gold', 1)
        c.put_ramp(x, 20, 'gold', 2)
        c.put_ramp(x, 14, 'gold', 2 if x > 24 else 4)       # Band
    for y in range(10, 20):
        c.put_ramp(19, y, 'gold', 5)
    ellipse(c, 25.5, 9.5, 6.4, 2.2, 'gold', lo=2, hi=5)         # Kannenrand
    ellipse(c, 25.5, 9.8, 4.6, 1.4, 'coal', lo=0, hi=1)
    c.put_ramp(21, 12, 'bone', 5)
    thick_line(c, 31, 19, 39, 9, 3.0, 'gold', lo=1, hi=5)
    thick_line(c, 31, 19, 39, 9, 1.0, 'gold', lo=4, hi=5)
    poly(c, [(38, 5), (43, 8), (41, 13), (37, 10)], 'gold', lo=1, hi=5)         # Brause
    for (x, y) in ((41, 7), (40, 9), (41, 11)):
        c.put_ramp(x, y, 'coal', 0)
    c.outline()
    return c


def gloop_ball(big=True):
    """Schleimball (10 x 10) mit Glanz"""
    c = Canvas(10, 10)
    ellipse(c, 5, 5, 4.4, 4.4, 'slime', lo=1, hi=5, ambient=0.2)
    c.put_ramp(3, 3, 'bone', 5)
    c.put_ramp(4, 3, 'slime', 5)
    c.put_ramp(3, 4, 'slime', 5)
    c.outline()
    return c


def _snow_puffs(c, specs, lo=3, hi=5, ramp='fur'):
    for (x, y, rx, ry) in specs:
        ellipse(c, x, y, rx, ry, ramp, lo=lo, hi=hi, ambient=0.28)


def frost_flue():
    """Frostschlot: Backstein-Schornstein, aus dem Schnee quillt, Eiszapfenbart (40 x 72)"""
    c = Canvas(40, 72)
    # Sockel
    for y in range(62, 71):
        for x in range(8, 33):
            u = (x - 8) / 24.0
            idx = quant(0.85 - 0.5 * u - 0.1 * ((y - 62) / 8.0), 1, 4, x, y)
            c.put_ramp(x, y, 'stone', idx)
    for x in range(8, 33):
        c.put_ramp(x, 62, 'fur', 5)
        c.put_ramp(x, 70, 'stone', 0)
    for y in range(63, 70):
        if y % 3 == 0:
            for x in range(8, 33):
                if (x + y) % 8 == 0:
                    c.put_ramp(x, y, 'stone', 1)
    # Schaft: Eisbacksteine
    for y in range(27, 62):
        for x in range(11, 29):
            row = (y - 27) // 5
            yy = (y - 27) % 5
            off = 4 if row % 2 else 0
            bx = (x - 11 + off) % 9
            u = (x - 11) / 17.0
            base = 3 if u < 0.25 else (3 if u < 0.7 else 2)
            if u > 0.82:
                base = 1
            if yy == 4 or bx == 8:
                idx = 1 if u < 0.82 else 0
            elif yy == 0:
                idx = min(5, base + 1)
            else:
                idx = base
            c.put_ramp(x, y, 'ice', idx)
    for x in range(11, 29):                               # Frostbeschlag unten und oben
        for y in range(54, 62):
            if (x + y) % 2 == 0 and texture_noise(x, y, 7) > 0.35:
                c.put_ramp(x, y, 'fur', 4)
    for y in range(27, 62):
        c.put_ramp(11, y, 'ice', 5 if y % 3 else 4)
    # Kragen (Eis-Sims) und Zapfenbart
    for y in range(37, 40):
        for x in range(9, 31):
            c.put_ramp(x, y, 'ice', 5 if y == 37 else (4 if y == 38 else 3))
    for x in range(9, 31):
        c.put_ramp(x, 40, 'ice', 2)
    for (x, ln) in ((10, 6), (13, 9), (16, 5), (19, 11), (22, 7), (25, 10), (28, 5)):
        for k in range(ln):
            w_ = 2 if k < ln * 0.55 else 1
            c.put_ramp(x, 40 + k, 'fur', 5 if k < ln - 1 else 4)
            if w_ == 2:
                c.put_ramp(x + 1, 40 + k, 'ice', 3)
        c.put_ramp(x, 40 + ln, 'ice', 5)
    # Augen
    for ex in (15, 23):
        c.rect(ex, 31, ex, 33, 'coal', 0)
        c.put_ramp(ex + 1, 31, 'bone', 4)
    # Kranz: zwei Stufen, oben dunkle Esse
    for (y0, y1, hw) in ((24, 27, 11), (20, 23, 13)):
        for y in range(y0, y1 + 1):
            for x in range(20 - hw, 20 + hw):
                u = (x - (20 - hw)) / (2.0 * hw)
                idx = quant(0.92 - 0.55 * u - 0.1 * ((y - y0) / 4.0), 1, 4, x, y)
                c.put_ramp(x, y, 'stone', idx)
        for x in range(20 - hw, 20 + hw):
            c.put_ramp(x, y0, 'stone', 5 if x < 20 else 4)
            c.put_ramp(x, y1, 'stone', 0)
    ellipse(c, 20, 21.5, 8.5, 2.2, 'coal', lo=0, hi=1)
    # Schneeschicht auf dem Kranz und Schneewolke, die aus der Esse quillt
    _snow_puffs(c, [(8, 21, 2.6, 2.0), (32, 21, 2.6, 2.0), (12, 24, 2.0, 1.4)], lo=4, hi=5)
    _snow_puffs(c, [(20, 18, 4.6, 3.2), (15, 14, 5.2, 4.6), (25, 12, 6.2, 5.6), (20, 7, 6.0, 5.0), (31, 8, 4.4, 4.0), (11, 9, 3.6, 3.6)], lo=3, hi=5)
    for (x, y) in ((12, 7), (30, 5), (35, 11), (6, 9), (21, 2), (4, 3)):
        c.put_ramp(x, y, 'fur', 5)
        c.put_ramp(x - 1, y, 'ice', 5)
        c.put_ramp(x + 1, y, 'ice', 5)
        c.put_ramp(x, y - 1, 'ice', 5)
        c.put_ramp(x, y + 1, 'ice', 5)
    c.outline()
    return c


def _shear(src, k, y_base, new_w):
    """Zeilen nach rechts verschieben (schiefer Turm): Verschiebung = (y_base - y) * k"""
    out = Canvas(new_w, src.h)
    for y in range(src.h):
        sh = max(0, int(round((y_base - y) * k)))
        for x in range(src.w):
            if src.px[y, x, 3] and 0 <= x + sh < new_w:
                out.px[y, x + sh] = src.px[y, x]
                out.rid[y, x + sh] = src.rid[y, x]
    return out


def chirp_spire():
    """Zirp-Zauberturm: schiefer Kristallturm mit schlaffem Spitzhut, die Fenster blinzeln (48 x 72)"""
    c = Canvas(40, 72)
    cx = 20
    # Sockel aus schiefen Steinen
    for y in range(62, 71):
        for x in range(7, 34):
            u = (x - 7) / 26.0
            idx = quant(0.85 - 0.5 * u - 0.1 * ((y - 62) / 8.0), 1, 4, x, y)
            if (x + (y // 3) * 5) % 9 == 0:
                idx = 1
            c.put_ramp(x, y, 'stone', idx)
    for x in range(7, 34):
        c.put_ramp(x, 62, 'stone', 5)
        c.put_ramp(x, 70, 'stone', 0)
    # Körper: Zylinder mit Backsteinfugen
    for y in range(34, 63):
        for x in range(10, 31):
            u = (x - 10 + 0.5) / 21.0
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            L = 0.16 + 0.84 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
            idx = quant(L, 1, 4, x, y, dw=0.18)
            row = (y - 34) // 5
            yy = (y - 34) % 5
            if yy == 4:
                idx = max(1, idx - 1)
            elif (x + (6 if row % 2 else 0)) % 12 == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'stone', idx)
    # Kristalladern im Mauerwerk
    for (x, y) in ((13, 56), (24, 52), (17, 60), (27, 58), (12, 44)):
        c.put_ramp(x, y, 'purple', 5)
        c.put_ramp(x, y + 1, 'purple', 3)
        c.put_ramp(x + 1, y + 1, 'purple', 2)
        c.put_ramp(x - 1, y + 1, 'purple', 4)
    # Fenster = Augen: links offen (schaut nach rechts), rechts blinzelt (Lid halb zu)
    for (wx, blink) in ((14, False), (22, True)):
        for y in range(40, 49):
            for x in range(wx, wx + 6):
                dx = (x + 0.5 - (wx + 3.0)) / 3.0
                if y < 43 and dx * dx + ((y + 0.5 - 43.0) / 3.0) ** 2 > 1.0:
                    continue
                c.put_ramp(x, y, 'gold', 5 if y < 44 else 4)
        c.rect(wx + 3, 43, wx + 4, 45, 'coal', 0)                 # Pupille schaut nach rechts
        for x in range(wx - 1, wx + 7):
            c.put_ramp(x, 49, 'stone', 4)
            c.put_ramp(x, 50, 'stone', 1)
        c.put_ramp(wx - 1, 43, 'stone', 4)
        c.put_ramp(wx + 6, 43, 'stone', 1)
        if blink:
            for y in range(40, 45):
                for x in range(wx - 1, wx + 7):
                    c.put_ramp(x, y, 'stone', 3 if y < 44 else 1)
            for x in range(wx, wx + 6):
                c.put_ramp(x, 44, 'coal', 0)
    # Hutkrempe
    for y in range(28, 36):
        for x in range(3, 38):
            dx = (x + 0.5 - 20.5) / 17.5
            dy = (y + 0.5 - 32.0) / 4.0
            if dx * dx + dy * dy <= 1.0:
                u = (x - 3) / 35.0
                idx = quant(0.95 - 0.55 * u - 0.25 * ((y - 28) / 8.0), 1, 4, x, y)
                c.put_ramp(x, y, 'purple', idx)
    # Hutkegel: gebogene Mittellinie, Spitze knickt nach rechts
    for y in range(3, 31):
        t = (30 - y) / 27.0
        mx = 20 + 11.0 * t ** 2.1
        hw = 12.5 * (1 - t) ** 0.95 + 0.7
        for x in range(int(mx - hw) - 1, int(mx + hw) + 2):
            if abs(x + 0.5 - mx) <= hw:
                u = (x + 0.5 - (mx - hw)) / (2 * hw)
                nn = u * 2 - 1
                nz = math.sqrt(max(0.0, 1 - nn * nn))
                L = 0.14 + 0.86 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
                idx = quant(L, 1, 4, x, y, dw=0.18)
                c.put_ramp(x, y, 'purple', idx)
    # Hutband und Sterne
    for y in range(26, 30):
        t = (30 - y) / 27.0
        mx = 20 + 11.0 * t ** 2.1
        hw = 12.5 * (1 - t) ** 0.95 + 0.7
        for x in range(int(mx - hw) - 1, int(mx + hw) + 2):
            if abs(x + 0.5 - mx) <= hw:
                c.put_ramp(x, y, 'gold', 4 if (y == 27 or y == 28) else 3)
    for (sx, sy) in ((15, 20), (22, 13), (19, 9)):
        for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
            c.put_ramp(sx + dx, sy + dy, 'gold', i)
    ellipse(c, 33.5, 3.5, 2.2, 2.2, 'gold', lo=3, hi=5)
    sp = _shear(c, 0.125, 66, 52)
    sp.outline()
    return sp


def hornet_tower():
    """Hornissenturm: Papierwespennest als Turm auf einem Holzpfosten, Eingangsloch mit roten Augen, Lanzen-Wimpel (44 x 72)"""
    c = Canvas(44, 72)
    cx = 21.5
    # Pfosten mit Wurzelfuß und Kreuzstreben
    for y in range(52, 71):
        hw = 5 + (3 if y > 64 else 0) + (2 if y > 68 else 0)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x - (cx - hw)) / (2.0 * hw + 1)
            idx = 4 if u < 0.25 else (3 if u < 0.55 else (2 if u < 0.85 else 1))
            if texture_noise(x, y // 2, 3) > 0.82:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
    for (x0, y0, x1, y1) in ((8, 68, 17, 58), (35, 68, 26, 58)):
        thick_line(c, x0, y0, x1, y1, 3.0, 'wood', lo=1, hi=4)
    for y in (57, 61):                                           # Seilwicklung
        for x in range(int(cx - 5), int(cx + 6)):
            c.put_ramp(x, y, 'bone', 3 if x % 2 else 2)
    # Nest: Tropfenform, übereinanderliegende Papierschalen mit Girlandenkante (von unten nach oben gemalt)
    def half_w(y):
        t = (y - 5) / 52.0
        if t < 0 or t > 1:
            return 0.0
        return 5.5 + 15.0 * (math.sin(math.pi * min(1.0, t * 1.10)) ** 0.8) * (1.0 - 0.12 * t) - 3.0 * t ** 3
    nb = 9
    for b_ in range(nb - 1, -1, -1):
        yt = 4 + 6 * b_
        ramp = 'dirt' if b_ % 3 == 1 else 'bone'
        for x in range(0, 44):
            yb = yt + 7 + int(round(1.6 * math.cos((x - cx) * 0.78 + b_ * 2.1)))
            for y in range(yt, yb + 1):
                hw = half_w(y)
                if hw <= 0.5 or abs(x + 0.5 - cx) > hw:
                    continue
                u = (x + 0.5 - (cx - hw)) / (2 * hw)
                nn = u * 2 - 1
                nz = math.sqrt(max(0.0, 1 - nn * nn))
                L = 0.16 + 0.84 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
                L += 0.10 * (1 - (y - yt) / 8.0)
                if y >= yb - 1:
                    L -= 0.34
                idx = quant(max(0.0, min(1.0, L)), 1, 4 if ramp == 'bone' else 4, x, y, dw=0.16)
                if y == yb:
                    idx = 1
                elif y == yt and b_ > 0:
                    idx = min(5, idx + 1)
                c.put_ramp(x, y, ramp, idx)
    # Papier-Maserung (helle Flecken)
    for (x, y) in ((14, 20), (28, 26), (18, 33), (26, 38), (13, 40), (24, 15), (20, 50), (29, 44)):
        if c.alpha(x, y):
            c.put_ramp(x, y, 'bone', 5)
            c.put_ramp(x + 1, y, 'bone', 4)
    # Eingangsloch mit zwei roten Augen
    ellipse(c, 22, 44, 5.4, 3.6, 'dirt', lo=0, hi=2, ambient=0.2)
    ellipse(c, 22, 44.5, 4.2, 2.8, 'coal', lo=0, hi=1)
    c.put_ramp(20, 44, 'fire', 4)
    c.put_ramp(24, 44, 'fire', 4)
    c.put_ramp(20, 43, 'fire', 5)
    c.put_ramp(24, 43, 'fire', 5)
    ellipse(c, 12, 28, 2.4, 1.8, 'coal', lo=0, hi=1)                 # kleines Nebenloch
    # Lanze mit Wimpel obenauf
    c.rect(22, 0, 22, 6, 'wood', 4)
    c.put_ramp(22, 0, 'metal', 5)
    c.put_ramp(22, 1, 'metal', 4)
    poly(c, [(23, 1), (29, 3), (23, 5)], 'teamA', lo=2, hi=4)
    c.outline()
    return c


def storm_spike():
    """Gewitterspitze: Eisensockel mit Warnstreifen, Eisenspitze mit Kupferspulen, Gewitterwolke obendrauf (40 x 72)"""
    c = Canvas(40, 72)
    cx = 19.5
    # Sockel: Front 24 x 17 plus Oberseite
    x0, x1 = 7, 32
    for y in range(52, 71):
        for x in range(x0, x1 + 1):
            u = (x - x0) / float(x1 - x0)
            v = (y - 52) / 18.0
            L = 0.80 - 0.40 * u - 0.12 * v
            idx = quant(max(0.0, min(1.0, L)), 1, 4, x, y)
            c.put_ramp(x, y, 'metal', idx)
    for y in range(66, 71):                                         # Warnstreifen (Gold/Kohle, schräg)
        for x in range(x0, x1 + 1):
            if ((x + y) // 3) % 2 == 0:
                c.put_ramp(x, y, 'gold', 4 if y < 69 else 2)
            else:
                c.put_ramp(x, y, 'coal', 1)
    for x in range(x0, x1 + 1):
        c.put_ramp(x, 66, 'metal', 5)
        c.put_ramp(x, 70, 'coal', 0)
    for y in range(52, 71):
        c.put_ramp(x0, y, 'metal', 5 if y < 66 else 3)
        c.put_ramp(x1, y, 'metal', 1)
    for y in range(47, 52):                                         # Oberseite
        for x in range(x0 + 1, x1):
            v = (y - 47) / 4.0
            c.put_ramp(x, y, 'metal', quant(0.9 - 0.3 * v - 0.2 * ((x - x0) / 25.0), 3, 5, x, y))
    for x in range(x0 + 1, x1):
        c.put_ramp(x, 47, 'metal', 5)
    for (rx, ry) in ((10, 54), (28, 54), (10, 62), (28, 62)):       # Nieten
        ellipse(c, rx, ry, 1.7, 1.7, 'metal', lo=2, hi=5, ambient=0.3, spec=(rx - 1, ry - 1, 5))
    c.rect(15, 57, 24, 58, 'metal', 1)                              # Blitz-Wappen: ein kleiner Zickzack
    for (x, y) in ((22, 56), (21, 57), (20, 58), (21, 58), (20, 59), (19, 60), (18, 61)):
        c.put_ramp(x, y, 'gold', 5)
    # Spitze: schlanker Kegel, links hell, rechts dunkel
    for y in range(8, 49):
        t = (y - 8) / 40.0
        hw = 0.9 + 3.6 * t
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            if abs(x + 0.5 - cx) <= hw:
                u = (x + 0.5 - (cx - hw)) / (2 * hw)
                idx = 5 if u < 0.28 else (4 if u < 0.5 else (2 if u < 0.8 else 1))
                if (y % 6 == 5):
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'metal', idx)
    # Kupferspulen
    for (y, hw) in ((42, 5.6), (35, 4.8), (28, 4.0), (21, 3.2)):
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x - (cx - hw)) / (2 * hw)
            c.put_ramp(x, y, 'gold', 5 if u < 0.3 else (4 if u < 0.7 else 2))
            c.put_ramp(x, y + 1, 'gold', 3 if u < 0.7 else 1)
    # Gewitterwolke: dunkel, oben heller
    puffs = [(20, 9, 9.5, 6.5), (10, 11, 6.5, 5.0), (30, 11, 6.5, 5.0), (15, 5, 6.0, 4.5), (26, 5, 6.5, 4.8), (20, 14, 12, 3.8)]
    for (px_, py_, rx, ry) in puffs:
        ellipse(c, px_, py_, rx, ry, 'fur', lo=0, hi=2, ambient=0.25)
    for (px_, py_, rx, ry) in ((14, 3.0, 3.6, 2.2), (25, 2.5, 4.0, 2.2), (20, 6.0, 5, 2.6)):
        ellipse(c, px_, py_, rx, ry, 'fur', lo=1, hi=3, ambient=0.35)
    for x in range(8, 33):                                          # Wolkenunterseite dunkler
        for y in range(14, 18):
            if c.alpha(x, y):
                c.put_ramp(x, y, 'fur', 0 if (x + y) % 2 else 1)
    for (x, y) in ((11, 8), (28, 9), (20, 11), (17, 13), (24, 14)):  # Funken
        c.put_ramp(x, y, 'gold', 5)
    c.put_ramp(20, 16, 'gold', 4)
    c.put_ramp(19, 15, 'gold', 5)
    c.outline()
    return c


def pelican(open_beak=True):
    """Pelikan (Brust-Oberkörper) im Nest: weiß, graue Flügel, großer Schnabel mit Kehlsack (46 x 34), blickt nach rechts"""
    c = Canvas(46, 34)
    # Schwanz
    poly(c, [(2, 20), (11, 18), (12, 27), (4, 28)], 'fur', lo=1, hi=3)
    c.line(3, 22, 11, 22, 'fur', 0)
    # Körper
    ellipse(c, 18.5, 22.5, 10.5, 8.0, 'bone', lo=2, hi=5, ambient=0.22)
    # Flügel (grau-blau) mit Federkante
    ellipse(c, 14.5, 22.5, 7.5, 5.2, 'fur', lo=1, hi=4, ambient=0.25)
    for x in range(8, 20):
        c.put_ramp(x, 26 + (1 if x % 3 == 0 else 0), 'fur', 0)
    # Hals (S-Kurve) und Kopf
    thick_line(c, 25, 18, 28, 11, 4.4, 'bone', lo=2, hi=5)
    thick_line(c, 28, 11, 28, 7, 4.0, 'bone', lo=3, hi=5)
    ellipse(c, 28.5, 6.2, 3.6, 3.3, 'bone', lo=3, hi=5)
    c.put_ramp(30, 5, 'coal', 0)
    c.put_ramp(30, 4, 'coal', 1)
    # Schnabel: Oberschnabel + Kehlsack
    poly(c, [(31, 4), (44, 7), (43, 9), (31, 8)], 'gold', lo=2, hi=5)
    c.put_ramp(44, 7, 'fire', 3)
    c.put_ramp(44, 8, 'fire', 2)
    if open_beak:
        poly(c, [(31, 9), (42, 11), (38, 17), (30, 13)], 'gold', lo=1, hi=4)
        for (x, y) in ((33, 12), (36, 13), (35, 15)):
            c.put_ramp(x, y, 'gold', 5)
        c.line(31, 9, 42, 10, 'coal', 1)
    else:
        poly(c, [(31, 8), (41, 9), (38, 14), (30, 12)], 'gold', lo=1, hi=4)
    c.outline()
    return c


def pelican_nest():
    """Pelikan-Flaknest: Pfahl mit Leiter, Reisignest, Pelikan, der Fische schleudert (46 x 72)"""
    c = Canvas(46, 72)
    rnd = random.Random(31)
    # Pfahl (Stamm mit Rindenrillen) und Wurzelfuß
    for y in range(38, 71):
        hw = 5 + (2 if y > 63 else 0) + (3 if y > 68 else 0)
        for x in range(int(22 - hw), int(22 + hw) + 1):
            u = (x - (22 - hw)) / (2.0 * hw + 1)
            idx = 4 if u < 0.25 else (3 if u < 0.55 else (2 if u < 0.85 else 1))
            if (x + y // 7) % 4 == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
    # Leiter links am Pfahl
    for y in range(40, 70):
        c.put_ramp(10, y, 'wood', 3)
        c.put_ramp(11, y, 'wood', 1)
        c.put_ramp(15, y, 'wood', 3)
        c.put_ramp(16, y, 'wood', 1)
    for y in range(43, 69, 4):
        for x in range(10, 17):
            c.put_ramp(x, y, 'wood', 4)
        for x in range(10, 17):
            c.put_ramp(x, y + 1, 'wood', 2)
    for y in (40, 52):                                         # Seilbunde
        for x in range(16, 28):
            c.put_ramp(x, y, 'bone', 3 if x % 2 else 2)
    # Fisch-Eimer am Fuß
    # Nest-Rückseite (Hinterer Rand)
    for k in range(40):
        a = rnd.uniform(math.pi * 1.05, math.pi * 1.95)
        x0 = 22 + math.cos(a) * 19
        y0 = 34 + math.sin(a) * 4.5
    # Pelikan sitzt im Nest (zuerst, dann der vordere Nestrand davor)
    c.blit(pelican(True), 0, 6)
    # Nest: Schale aus Reisig
    for y in range(28, 44):
        for x in range(1, 45):
            dx = (x + 0.5 - 22.5) / 21.5
            dy = (y + 0.5 - 33.0) / 9.0
            d = dx * dx + dy * dy
            if d <= 1.0 and y >= 31 + 1.8 * (1 - math.sqrt(max(0.0, 1 - dx * dx))) * 3:
                idx = 3 if rnd.random() < 0.5 else 2
                if (x * 3 + y * 5) % 7 == 0:
                    idx = 4
                if y > 38:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'dirt' if (x + y) % 3 else 'wood', idx)
    for k in range(70):                                        # Reisigstäbe quer
        x0 = rnd.randint(2, 40)
        y0 = rnd.randint(30, 42)
        ang = rnd.uniform(-0.5, 0.5)
        ln = rnd.randint(6, 11)
        for t in range(ln):
            x = int(x0 + math.cos(ang) * t)
            y = int(y0 + math.sin(ang) * t + (t % 3 == 2) * 0)
            dx = (x + 0.5 - 22.5) / 21.5
            dy = (y + 0.5 - 33.0) / 9.0
            if dx * dx + dy * dy <= 1.0 and y >= 33:
                c.put_ramp(x, y, 'wood' if k % 3 else 'dirt', 4 if t < 2 else 3)
    for k in range(9):                                         # abstehende Äste
        a = rnd.uniform(0, 2 * math.pi)
        x0 = 22.5 + math.cos(a) * 20 * (1 if abs(math.cos(a)) > 0.3 else 0.6)
        y0 = 34 + math.sin(a) * 6
        if 1 <= x0 <= 44:
            x1 = x0 + math.cos(a) * 4
            y1 = y0 + math.sin(a) * 3 - 2
            c.line(int(x0), int(y0), int(x1), int(y1), 'wood', 3)
    c.outline()
    return c


RAINBOW = [('fire', 4), ('gold', 5), ('leaf', 4), ('ice', 4), ('purple', 4)]


def gull(f=0):
    """kleine Möwe (Wetterfahne), 10 x 6, blickt nach rechts"""
    c = Canvas(10, 6)
    ellipse(c, 4.6, 3.4, 3.8, 2.0, 'bone', lo=3, hi=5, ambient=0.3)
    poly(c, [(0, 2), (4, 0), (7, 3), (3, 4)], 'fur', lo=2, hi=4)
    ellipse(c, 7.8, 2.0, 1.7, 1.6, 'bone', lo=4, hi=5)
    c.put_ramp(8, 1, 'coal', 0)
    c.put_ramp(9, 2, 'gold', 4)
    c.outline()
    return c


def confusion_beacon():
    """Leuchtfeuer der Verwirrung: rot-weißer Leuchtturm, Regenbogen-Kristall in der Laterne, Möwe als Wetterfahne (44 x 80)"""
    c = Canvas(44, 80)
    cx = 21.5
    # Sockel
    for y in range(70, 79):
        for x in range(7, 37):
            u = (x - 7) / 29.0
            idx = quant(0.85 - 0.5 * u - 0.1 * ((y - 70) / 8.0), 1, 4, x, y)
            if (x + (y // 3) * 5) % 9 == 0:
                idx = 1
            c.put_ramp(x, y, 'stone', idx)
    for x in range(7, 37):
        c.put_ramp(x, 70, 'stone', 5)
        c.put_ramp(x, 78, 'stone', 0)
    # Turmkörper: Kegelstumpf mit Streifen
    y_top, y_bot = 36, 69
    for y in range(y_top, y_bot + 1):
        t = (y - y_top) / float(y_bot - y_top)
        hw = 8.6 + 4.2 * t
        band = (y - y_top) // 8
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            if abs(x + 0.5 - cx) > hw:
                continue
            u = (x + 0.5 - (cx - hw)) / (2 * hw)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            L = 0.12 + 0.88 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
            red = band % 2 == 0
            idx = quant(L, 1, 4, x, y, dw=0.18)
            if (y - y_top) % 8 == 7:
                idx = max(1, idx - 1)
            if red:
                c.put_ramp(x, y, 'teamA', idx)
            else:
                c.put_ramp(x, y, 'bone', min(5, idx + 1))
    # Tür und Schlitzfenster
    for y in range(60, 70):
        for x in range(19, 25):
            dx = (x + 0.5 - 22.0) / 3.0
            if y < 62 and dx * dx + ((y + 0.5 - 62.0) / 2.5) ** 2 > 1.0:
                continue
            c.put_ramp(x, y, 'wood', 3 if x < 22 else 2)
    c.put_ramp(23, 65, 'gold', 5)
    for y in range(66, 71):
        c.put_ramp(18, y, 'stone', 5)
        c.put_ramp(25, y, 'stone', 1)
    for (wy) in (45, 53):
        c.rect(21, wy, 22, wy + 3, 'coal', 0)
    # Galerie: runde Plattform + Geländer
    for y in range(31, 37):
        for x in range(9, 35):
            dx = (x + 0.5 - 22.0) / 13.0
            dy = (y + 0.5 - 34.0) / 3.4
            if dx * dx + dy * dy <= 1.0:
                u = (x - 9) / 26.0
                idx = quant(0.95 - 0.5 * u - 0.3 * ((y - 31) / 6.0), 0, 4, x, y)
                c.put_ramp(x, y, 'metal', idx)
    for x in range(10, 34):
        c.put_ramp(x, 31, 'metal', 5)
    for x in range(10, 34, 3):                                  # Geländerpfosten
        c.rect(x, 25, x, 31, 'gold', 3)
    for x in range(10, 34):
        c.put_ramp(x, 25, 'gold', 5 if x < 24 else 4)
    # Laterne: Kristall mit Regenbogen-Facetten
    for y in range(12, 26):
        for x in range(14, 30):
            c.put_ramp(x, y, 'ice', 2 if (x + y) % 2 else 3)
    for y in range(13, 25):                                     # Leuchthof
        for x in range(15, 29):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y, 'ice', 5)
    for k, (ramp, i) in enumerate(RAINBOW):
        x0 = 16 + k * 2
        for y in range(13, 25):
            hw = 1.0
            top = 13 + abs(k - 2) * 1.6
            if y < top:
                continue
            for x in (x0, x0 + 1):
                c.put_ramp(x, y, ramp, i if x == x0 else i - 1)
    c.put_ramp(17, 14, 'bone', 5)
    c.put_ramp(18, 13, 'bone', 5)
    c.put_ramp(21, 15, 'bone', 5)
    for x in (14, 21, 28, 29):                                  # Rahmenstreben
        c.rect(x, 12, x, 25, 'metal', 4 if x < 22 else 2)
    for x in range(14, 30):
        c.put_ramp(x, 12, 'metal', 5)
    # Dach: Kegel in Teamfarbe mit Zierrand
    for y in range(7, 12):
        hw = 1.5 + (y - 7) * 2.1
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            if abs(x + 0.5 - cx) > hw:
                continue
            u = (x + 0.5 - (cx - hw)) / (2 * hw)
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            L = 0.14 + 0.86 * max(0.0, nn * LIGHT[0] + nz * LIGHT[2])
            c.put_ramp(x, y, 'teamA', quant(L, 1, 4, x, y))
    for x in range(8, 36):
        c.put_ramp(x, 11, 'teamA', 1)
    for x in range(10, 34):
        c.put_ramp(x, 12, 'gold', 4 if x < 24 else 2)
    # Wetterfahne: Mast mit Möwe
    c.rect(22, 5, 22, 7, 'metal', 4)
    c.blit(gull(), 17, 0)
    c.outline()
    return c
