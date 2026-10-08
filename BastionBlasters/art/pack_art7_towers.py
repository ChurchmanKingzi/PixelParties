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
    # Tropfen: senkrechte Fäden mit Tropfenkopf
    for (x, y0, ln) in ((6, 55, 6), (10, 60, 3), (29, 58, 4), (32, 54, 7), (14, 46, 3), (26, 44, 5), (13, 31, 4), (23, 33, 3), (12, 21, 3)):
        for k in range(ln):
            c.put_ramp(x, y0 + k, 'slime', 4 if k < ln - 1 else 3)
            c.put_ramp(x + 1, y0 + k, 'slime', 2)
        ellipse(c, x + 0.5, y0 + ln + 0.8, 1.5, 1.7, 'slime', lo=2, hi=5, ambient=0.4)
    # Sockel-Zinnen aus Schleim oben (drei Beulen)
    for (x, y) in ((13, 6), (19, 4), (25, 6)):
        ellipse(c, x, y + 2.5, 3.2, 3.4, 'slime', lo=2, hi=5, ambient=0.25)
    # Gießkanne (Messing) oben rechts, Tülle zeigt nach rechts oben
    # Handgriff (Bügel)
    for k in range(11):
        a = math.pi * (0.05 + 0.9 * k / 10.0)
        x = 20.5 + math.cos(a) * 5.5 * -1
        y = 8.0 - math.sin(a) * 6.0
        c.put_ramp(int(x), int(y), 'gold', 3)
        c.put_ramp(int(x), int(y) + 1, 'gold', 2)
    round_rect(c, 20, 6, 33, 20, 'gold', lo=1, hi=5, radius=4)
    for x in range(21, 33):                                  # Bänder
        c.put_ramp(x, 10, 'gold', 5 if x < 26 else 4)
        c.put_ramp(x, 16, 'gold', 2)
    c.put_ramp(22, 8, 'bone', 5)
    c.put_ramp(23, 8, 'gold', 5)
    c.rect(26, 12, 28, 13, 'coal', 1)                        # Schraubenloch / Auge
    # Tülle + Brause
    thick_line(c, 32, 15, 40, 8, 3.0, 'gold', lo=1, hi=5)
    thick_line(c, 32, 15, 40, 8, 1.0, 'gold', lo=4, hi=5)
    poly(c, [(38, 4), (43, 7), (42, 11), (38, 10)], 'gold', lo=1, hi=5)
    for (x, y) in ((42, 6), (42, 8), (41, 10)):
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
