"""pack_art7: gemeinsame Helfer und kleine Sprites (Effekte, Tiere, Gegner-Zustände) für die Bau-Dioramen.
Nur Master-Palette, deterministisch, alle Figuren blicken nach rechts."""
from __future__ import annotations

from cards_art import *

# --------------------------------------------------------------------------- Welt-Helfer


def wpx(world, x, y, ramp, idx, key=9000):
    """ein Pixel direkt in die Welt (liegt über allem mit kleinerem Schlüssel)"""
    x, y = int(x), int(y)
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][max(0, min(5, idx))]
        world.depth[y, x] = key


def wline(world, x0, y0, x1, y1, ramp, idx, key=9000, dash=0):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for k in range(n + 1):
        if dash and (k // dash) % 2:
            continue
        wpx(world, round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), ramp, idx, key)


def wdisc(world, cx, cy, r, ramp, idx, key=9000, chk=False):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and (not chk or (x + y) % 2 == 0):
                wpx(world, x, y, ramp, idx, key)


def burst(world, x, y, big=False, ramp='gold', key=9100):
    """kleiner Treffer-Stern"""
    pts = [(0, 0, 5), (-1, 0, 5), (1, 0, 5), (0, -1, 5), (0, 1, 5), (-2, 0, 4), (2, 0, 4), (0, -2, 4), (0, 2, 4)]
    if big:
        pts += [(-3, 0, 3), (3, 0, 3), (0, -3, 3), (0, 3, 3), (-2, -2, 4), (2, 2, 4), (-2, 2, 4), (2, -2, 4)]
    else:
        pts += [(-1, -1, 3), (1, 1, 3), (-1, 1, 3), (1, -1, 3)]
    for (dx, dy, i) in pts:
        wpx(world, x + dx, y + dy, ramp, i, key)


def star_sprite(ramp='gold'):
    c = Canvas(5, 5)
    for (x, y, i) in ((2, 2, 5), (1, 2, 4), (3, 2, 4), (2, 1, 4), (2, 3, 4), (0, 2, 3), (4, 2, 3), (2, 0, 3), (2, 4, 3)):
        c.put_ramp(x, y, ramp, i)
    return c


def dizzy(world, cx, cy, rx=8, ry=3, n=3, phase=0.0, key=9200):
    """Verwirrt: Sterne kreisen um den Kopf"""
    st = star_sprite()
    for k in range(n):
        a = phase + k * 2 * math.pi / n
        x = cx + math.cos(a) * rx
        y = cy + math.sin(a) * ry
        world.draw(st, int(x) - 2, int(y) - 2, key + k)


def speed_lines(world, x, y, n=3, ln=6, ramp='bone', idx=4, key=9000):
    for k in range(n):
        wline(world, x - ln, y + k * 3, x, y + k * 3, ramp, idx - (k % 2), key)


def tint_ramp(spr, ramp, shift=0):
    """alle Rampen-Pixel auf denselben Tonindex von `ramp` abbilden (Einfrieren, Verschleimen ...)"""
    lut = {}
    for name, cols in RAMPS.items():
        for i, col in enumerate(cols):
            lut.setdefault(tuple(col), (name, i))
    out = spr.copy()
    for y in range(spr.h):
        for x in range(spr.w):
            if out.px[y, x, 3]:
                col = tuple(int(v) for v in out.px[y, x, :3])
                if col in lut:
                    i = max(0, min(5, lut[col][1] + shift))
                    out.px[y, x, :3] = RAMPS[ramp][i]
                    out.rid[y, x] = RAMP_ID[ramp]
                else:
                    out.px[y, x, :3] = RAMPS[ramp][0]
    return out


def splotches(spr, spots, ramp='slime', idx=4):
    """Flecken auf einen Sprite setzen (nur auf deckenden Pixeln), spots = [(x, y, r)]"""
    out = spr.copy()
    for (sx, sy, r) in spots:
        for y in range(int(sy - r - 1), int(sy + r + 2)):
            for x in range(int(sx - r - 1), int(sx + r + 2)):
                if out.alpha(x, y) and (x - sx) ** 2 + (y - sy) ** 2 <= r * r:
                    out.put_ramp(x, y, ramp, idx if (x - sx) ** 2 + (y - sy) ** 2 > r * r * 0.4 else idx + 1)
    return out


# --------------------------------------------------------------------------- kleine Sprites


def puff(w=14, h=10, seed=1, ramp='bone', lo=3, hi=5):
    """kleine Wolke / Dampfwolke aus Kugeln"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    k = max(3, w // 4)
    for i in range(k):
        cx = 3 + (w - 6) * i / max(1, k - 1) + rnd.uniform(-1, 1)
        cy = h * 0.58 + rnd.uniform(-1.4, 1.4) - (2 if 0 < i < k - 1 else 0)
        r = h * 0.36 + rnd.uniform(0, 1.5)
        ellipse(c, cx, cy, r * 1.15, r, ramp, lo=lo, hi=hi, ambient=0.25)
    return c


def flame(h=10, seed=0):
    """eine Flamme (Spitze oben)"""
    w = max(5, h * 2 // 3)
    c = Canvas(w, h)
    cx = (w - 1) / 2.0
    for y in range(h):
        t = y / (h - 1.0)
        hw = (0.15 + 0.85 * math.sin(min(1.0, t * 1.15) * math.pi * 0.62 + 0.2)) * w / 2.0
        hw *= (0.55 + 0.45 * t) if t < 0.9 else 0.8
        sway = math.sin(seed + t * 4.0) * (1 - t) * 1.1
        for x in range(w):
            d = abs(x - cx - sway)
            if d <= hw:
                v = d / max(hw, 0.1)
                if t > 0.62 and v < 0.45:
                    idx = 5
                elif t > 0.38 and v < 0.7:
                    idx = 4
                elif v > 0.82:
                    idx = 2
                else:
                    idx = 3
                c.put_ramp(x, y, 'fire', idx)
    c.put_ramp(int(cx), h - 2, 'gold', 5)
    return c


def dog():
    """kleiner mutiger Hund, bellt (21 x 15), blickt nach rechts"""
    c = Canvas(21, 15)
    for (x, hi) in ((3, 3), (6, 3), (12, 4), (15, 4)):
        c.rect(x, 10, x + 1, 13, 'dirt', 2 if x < 10 else 3)
        c.rect(x, 14, x + 2, 14, 'bone', 3)
    thick_line(c, 3, 9, 0, 3, 2.4, 'dirt', lo=2, hi=5)               # Schwanz hoch
    ellipse(c, 9.5, 9.0, 7.4, 3.9, 'dirt', lo=2, hi=5, ambient=0.25)
    ellipse(c, 15.5, 5.2, 3.3, 3.0, 'dirt', lo=2, hi=5)
    poly(c, [(13, 0), (15, 1), (14, 5), (12, 4)], 'dirt', lo=1, hi=3)   # Ohr
    ellipse(c, 18.6, 6.6, 2.2, 1.5, 'bone', lo=3, hi=5)
    c.put_ramp(20, 5, 'coal', 1)
    c.rect(17, 4, 17, 5, 'coal', 1)                                # Auge
    c.rect(17, 8, 19, 8, 'fire', 2)                                # Maul offen
    c.rect(11, 7, 12, 11, 'teamA', 3)                              # Halstuch
    c.put_ramp(11, 7, 'teamA', 4)
    c.outline()
    return c


def hat():
    """einsamer Hut, von oben (14 x 9)"""
    c = Canvas(14, 9)
    ellipse(c, 7, 5, 6.4, 3.4, 'wood', lo=1, hi=4, ambient=0.25)
    ellipse(c, 6.5, 4.0, 3.6, 2.4, 'wood', lo=2, hi=5, ambient=0.3)
    for x in range(3, 11):
        c.put_ramp(x, 5, 'teamA', 3 if x % 2 else 2)
    c.put_ramp(4, 3, 'wood', 5)
    c.outline()
    return c


def swim_duck():
    """Ente mit Schwimmreifen (18 x 14), blickt nach rechts"""
    c = Canvas(18, 14)

    def ring(front):
        for y in range(14):
            for x in range(18):
                dx = (x + 0.5 - 8.5) / 8.0
                dy = (y + 0.5 - 9.6) / 3.2
                d = dx * dx + dy * dy
                inner = ((x + 0.5 - 8.5) / 5.0) ** 2 + ((y + 0.5 - 9.2) / 1.5) ** 2
                if d <= 1.0 and inner >= 1.0 and ((y + 0.5 > 9.6) == front):
                    stripe = ((x + 1) // 3) % 2
                    lit = 0.9 - 0.45 * (y - 7) / 6.0
                    idx = quant(max(0.0, min(1.0, lit)), 2, 5, x, y)
                    c.put_ramp(x, y, 'bone' if stripe else 'teamA', idx if stripe else max(2, idx - 1))
    ring(False)
    ellipse(c, 8.0, 6.0, 5.0, 3.6, 'gold', lo=3, hi=5, ambient=0.25)
    poly(c, [(2, 3), (5, 5), (3, 8)], 'gold', lo=2, hi=4)           # Schwanz
    ellipse(c, 12.5, 3.4, 2.7, 2.6, 'gold', lo=3, hi=5)
    c.rect(15, 3, 17, 4, 'fire', 4)
    c.put_ramp(13, 2, 'coal', 1)
    ring(True)
    c.outline()
    return c


def bat(flap=0):
    """Fledermaus-Flieger (30 x 20), blickt nach rechts"""
    c = Canvas(30, 20)
    up = flap % 2 == 0
    # Flügel (hinterer links, vorderer rechts), Bahnen zwischen Fingern
    if up:
        wl = [(13, 10), (2, 2), (1, 8), (5, 7), (6, 12), (10, 12)]
        wr = [(17, 10), (28, 1), (27, 7), (23, 6), (22, 12), (19, 12)]
    else:
        wl = [(13, 10), (1, 12), (3, 18), (6, 15), (9, 18), (11, 13)]
        wr = [(17, 10), (28, 11), (27, 17), (24, 14), (21, 17), (19, 13)]
    poly(c, wl, 'cloth', lo=1, hi=3)
    poly(c, wr, 'cloth', lo=2, hi=4)
    for (a, b) in ((wl[0], wl[1]), (wl[0], wl[2]), (wl[0], wl[4])):
        c.line(a[0], a[1], b[0], b[1], 'coal', 1)
    for (a, b) in ((wr[0], wr[1]), (wr[0], wr[2]), (wr[0], wr[4])):
        c.line(a[0], a[1], b[0], b[1], 'coal', 1)
    ellipse(c, 15.5, 11.5, 3.6, 4.6, 'cloth', lo=2, hi=5, ambient=0.25)
    ellipse(c, 17.0, 6.5, 3.4, 3.0, 'cloth', lo=2, hi=5)
    poly(c, [(14, 3), (16, 0), (17, 5)], 'cloth', lo=1, hi=3)
    poly(c, [(17, 4), (20, 1), (20, 6)], 'cloth', lo=2, hi=4)
    c.put_ramp(19, 6, 'fire', 5)
    c.put_ramp(20, 8, 'bone', 5)
    c.put_ramp(18, 8, 'bone', 5)
    c.outline()
    return c


def fish(angle_down=False):
    """Fisch (11 x 6), Kopf rechts"""
    c = Canvas(11, 6)
    ellipse(c, 5.2, 3.0, 4.2, 2.2, 'metal', lo=2, hi=5, ambient=0.3)
    poly(c, [(0, 0), (3, 3), (0, 6)], 'metal', lo=1, hi=3)
    c.put_ramp(8, 2, 'coal', 0)
    c.put_ramp(9, 3, 'fire', 3)
    for x in range(4, 8):
        c.put_ramp(x, 4, 'bone', 4)
    c.outline()
    return c


def hornet(f=0):
    """Hornisse mit Miniatur-Lanze (16 x 11), blickt nach rechts"""
    c = Canvas(16, 11)
    wy = 1 if f % 2 else 0
    ellipse(c, 6.0, 2.6 - wy * 0.5, 3.4, 2.0, 'ice', lo=4, hi=5, ambient=0.5)        # Flügel
    # Hinterleib (gestreift), Brust, Kopf
    for x in range(1, 8):
        for y in range(4, 9):
            dx = (x + 0.5 - 4.2) / 3.8
            dy = (y + 0.5 - 6.4) / 2.7
            if dx * dx + dy * dy <= 1.0:
                if (x // 2) % 2 == 0:
                    c.put_ramp(x, y, 'gold', 4 if y < 6 else 2)
                else:
                    c.put_ramp(x, y, 'coal', 2 if y < 6 else 1)
    c.put_ramp(0, 7, 'coal', 3)
    ellipse(c, 9.4, 6.0, 2.2, 2.4, 'coal', lo=2, hi=4)
    ellipse(c, 12.0, 5.6, 2.0, 1.9, 'fire', lo=2, hi=4)
    c.put_ramp(12, 5, 'coal', 0)
    c.put_ramp(13, 5, 'bone', 5)
    # Lanze
    c.line(9, 8, 15, 8, 'wood', 4)
    c.put_ramp(14, 8, 'metal', 5)
    c.put_ramp(15, 8, 'bone', 5)
    c.put_ramp(14, 7, 'metal', 4)
    c.outline()
    return c


def swim_duck_small():
    """kleine Ente mit Schwimmreifen (14 x 11), blickt nach rechts"""
    c = Canvas(14, 11)

    def ring(front):
        for y in range(11):
            for x in range(14):
                dx = (x + 0.5 - 6.5) / 6.6
                dy = (y + 0.5 - 7.6) / 2.9
                inner = ((x + 0.5 - 6.5) / 4.0) ** 2 + ((y + 0.5 - 7.3) / 1.2) ** 2
                if dx * dx + dy * dy <= 1.0 and inner >= 1.0 and ((y + 0.5 > 7.6) == front):
                    stripe = ((x + 1) // 3) % 2
                    c.put_ramp(x, y, 'bone' if stripe else 'teamA', 4 if front else 3)
    ring(False)
    ellipse(c, 6.2, 5.0, 4.2, 3.0, 'gold', lo=3, hi=5, ambient=0.25)
    poly(c, [(1, 2), (3, 4), (2, 6)], 'gold', lo=2, hi=4)
    ellipse(c, 9.6, 2.8, 2.3, 2.2, 'gold', lo=3, hi=5)
    c.rect(11, 3, 13, 3, 'fire', 4)
    c.put_ramp(10, 2, 'coal', 1)
    ring(True)
    c.outline()
    return c


# --------------------------------------------------------------------------- Strahlen, Kegel, Flugbahnen


def parabola(p0, p1, height, n):
    """n+1 Punkte einer Wurfparabel von p0 nach p1 (height = Scheitel über der Sehne)"""
    pts = []
    for k in range(n + 1):
        t = k / float(n)
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t - 4.0 * height * t * (1 - t)
        pts.append((x, y))
    return pts


def dither_fill(world, pts, colors, key=5000, mode='check'):
    """Polygon halbdurchsichtig füllen (Schachbrett); colors(x, y) -> (ramp, idx) oder None"""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(world.h, int(max(ys)) + 1)):
        for x in range(max(0, int(min(xs))), min(world.w, int(max(xs)) + 1)):
            if not point_in_poly(x + 0.5, y + 0.5, pts):
                continue
            col = colors(x, y)
            if col is None:
                continue
            if mode == 'check' and (x + y) % 2:
                continue
            wpx(world, x, y, col[0], col[1], key)


def zigzag(x0, y0, x1, y1, n, amp, seed=0):
    """Blitz-Zickzack zwischen zwei Punkten"""
    rnd = random.Random(seed)
    pts = [(x0, y0)]
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    for k in range(1, n):
        t = k / float(n)
        off = amp * (1 if k % 2 else -1) * (0.6 + 0.4 * rnd.random())
        pts.append((x0 + dx * t + nx * off, y0 + dy * t + ny * off))
    pts.append((x1, y1))
    return pts


def draw_bolt(world, pts, key=9300, core='bone', glow='gold', thick=True):
    """Blitz entlang eines Linienzugs: goldener Mantel, heller Kern"""
    for (a, b) in zip(pts, pts[1:]):
        wline(world, round(a[0]), round(a[1]), round(b[0]), round(b[1]), glow, 4, key)
        wline(world, round(a[0]) + 1, round(a[1]), round(b[0]) + 1, round(b[1]), glow, 3, key)
        wline(world, round(a[0]), round(a[1]), round(b[0]), round(b[1]), core, 5, key + 1)


def ghostly(spr, ramp='fur'):
    """halbdurchsichtige Geisterfassung (Schachbrett-Alpha), Farbton auf `ramp`"""
    out = tint_ramp(spr, ramp, 1)
    for y in range(out.h):
        for x in range(out.w):
            if (x + y) % 2:
                out.px[y, x, 3] = 0
                out.rid[y, x] = -1
    return out


def smiling_bolt():
    """lächelnder Blitz (Figur), 14 x 21: dicker Zickzack mit zwei Augen und Lächeln"""
    c = Canvas(14, 21)
    body = [(3, 0), (12, 0), (9, 9), (13, 9), (4, 20), (6, 12), (1, 12)]
    poly(c, body, 'gold', lo=3, hi=5)
    for x in range(4, 11):
        c.put_ramp(x, 0, 'gold', 5)
    c.rect(5, 3, 5, 4, 'coal', 0)
    c.rect(9, 3, 9, 4, 'coal', 0)
    c.put_ramp(5, 7, 'coal', 1)
    c.put_ramp(6, 8, 'coal', 1)
    c.put_ramp(7, 8, 'coal', 1)
    c.put_ramp(8, 8, 'coal', 1)
    c.put_ramp(9, 7, 'coal', 1)
    c.outline()
    return c
