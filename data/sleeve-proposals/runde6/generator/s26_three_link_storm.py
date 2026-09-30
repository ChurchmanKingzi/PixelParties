# -*- coding: utf-8 -*-
"""26 Three-Link Storm – Gegner „Lightning Caller“ (sample-Structure Deck Lightning Caller),
Held: Sol Rym, the Thunder Djinn.

Idee (Action, Nachtgewitter über dem Meer): Sol Rym thront – wie auf seiner Base-Karte – auf seiner schwarzen
Gewitterwolke, die als Wolkenbank quer über den Himmel liegt. Unter ihm springt ein einziger Kettenblitz
(Cover-Karte Chain Lightning, die er unabhängig von ihrem Level wirken darf) dreimal über die Oberfläche der
nächtlichen See: 200 – 150 – 100 Schaden, der Blitz wird von Sprung zu Sprung dünner. An den Einschlägen
spritzt das Wasser auf, Glanzringe und Spiegelungen liegen auf dem Meer. Kein Lampen-/Teppichmotiv (vgl. „Djinn's Lamp“).

Quellen:
  Motive.xcf    Ebene 1509 „Sol Rym“ + 1519 „Ebene #639“ (seine Gewitterwolke) – Base-Karte, geprüft gegen die
                Kartenszene Sichtbar #162 (Ebene 372, Kartenausschnitt Lage 208,68; 1509 ist dort zu 96 % deckungsgleich,
                Wolke unter ihm wie auf der Karte). Der Kartenblitz 1502 wird nicht übernommen (seine Ebene enthält
                die getroffenen Figuren der Karte); der Kettenblitz ist in genau dessen Farben gezeichnet
                (Kern 255,255,255 / Saum 255,255,122).
  MotiveGN.xcf  Ebene 353 „Klippe #1“ – zwei dunkle Gewitterwolken-Sprites (x 183–252/y 155–172, x 248–317/y 148–155)
                als ferne Wolken hoch am Himmel (keine dunklen Schemen am Horizont).
Selbst gezeichnet: Nachthimmel, Meer mit Wellenlinien und Spiegelungen, Einschlagspritzer und Glanzringe, Kettenblitz mit kleinen
Verästelungen, Einschlagglühen.

Skalierung:
  Hintergrund (Himmel, ferne Wolken, Meer, Einschläge, Blitze, Glühen)       – 2× (Raster 125×175)
  Vordergrund (Sol Rym + seine Wolke, 81×31 → 405×155, seitlich angeschnitten) – 5× (Raster 50×70)
"""
import math, random
import numpy as np
from ekit_25_30 import *  # noqa

rnd = random.Random(26)
sol = sprite('o26_sol_rym_cloud', 'Motive', [1509, 1519])        # Sol Rym auf seiner Wolke
clouds353 = layer('MotiveGN', 353)
far1 = crop_alpha(clouds353[155:173, 183:253].copy())
far2 = crop_alpha(clouds353[148:156, 248:318].copy())

# ================================================================ 2×-Ebene
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
HOR = 106                                   # Horizont (Canvas 212)
vgrad(bg, 0, 0, bw, HOR, [(6, 8, 22), (10, 14, 34), (16, 24, 52), (26, 38, 72), (40, 56, 92)])
put(bg, darken_rgba(far2, .7, (10, 14, 34)), 2, 16)
put(bg, darken_rgba(far1, .75, (10, 14, 34)), 70, 24)
# Meer
vgrad(bg, 0, HOR, bw, bh, [(22, 34, 62), (16, 26, 50), (10, 18, 38), (6, 12, 28)])
for y in range(HOR + 2, bh, 1):
    t = (y - HOR) / (bh - HOR)
    step = max(3, int(3 + t * 9))
    for x in range((y * 7) % step, bw, step * 2):
        L = 1 + int(t * 3)
        for i in range(L):
            if rnd.random() < .7:
                setp(bg, x + i, y, (34, 50, 84) if t < .5 else (26, 40, 70))

# Einschlagstellen im Meer (x, Wasserlinie, Größe): vorn groß, nach hinten kleiner
STACKS = [(38, 150, 150, 1.0), (94, 142, 142, .75), (64, 137, 137, .5)]     # (x, Einschlag, Wasserlinie, Größe)
for cx, top, base, sz in STACKS:
    rx = 7 * sz + 2
    for x in range(int(cx - rx) - 1, int(cx + rx) + 2):          # flacher Glanzring auf dem Wasser
        for y in range(base - 2, base + 3):
            d = math.hypot((x + .5 - cx) / rx, (y + .5 - base) / (1.6 * sz + .6))
            if .7 < d < 1.05:
                setp(bg, x, y, (170, 190, 210) if y <= base else (110, 130, 170))
            elif d <= .7 and bay(x, y) < .5:
                setp(bg, x, y, (210, 220, 200))
    for i in range(int(10 * sz) + 3):                             # Einschlagspritzer
        dx = rnd.uniform(-1, 1) * (3 * sz + 1)
        h_ = rnd.uniform(1, 6 * sz + 2) * (1 - abs(dx) / (3 * sz + 2))
        setp(bg, int(round(cx + dx)), int(round(base - h_)), (230, 240, 250) if rnd.random() < .6 else (150, 180, 220))

# Kettenblitz (Farben des Kartenblitzes): Wolke → Einschlag 1 → 2 → 3 über die Wasseroberfläche, von Sprung zu Sprung dünner
CORE, EDGE = (255, 255, 255), (255, 255, 122)


def bolt(p0, p1, width, seed, branches=2, core=None, edge=None):
    CORE_, EDGE_ = core or CORE, edge or EDGE
    r = random.Random(seed)
    (x0, y0), (x1, y1) = p0, p1
    n = max(4, int(math.hypot(x1 - x0, y1 - y0) / 5))
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        jx = r.choice((-3, -2, -1, 1, 2, 3)) if 0 < i < n else 0
        pts.append((round(x0 + (x1 - x0) * t + jx), round(y0 + (y1 - y0) * t + r.choice((-1, 0, 1)))))
    pts.append((x1, y1))
    segs = list(zip(pts, pts[1:]))
    for (a, b) in segs:
        k = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for s in range(k + 1):
            px = round(a[0] + (b[0] - a[0]) * s / k); py = round(a[1] + (b[1] - a[1]) * s / k)
            if width >= 3:
                for dx in (-1, 1): setp(bg, px + dx, py, EDGE_)
                setp(bg, px, py, CORE_)
            elif width == 2:
                setp(bg, px + 1, py, EDGE_); setp(bg, px, py, CORE_)
            else:
                setp(bg, px, py, EDGE_)
    for bi in range(branches):                       # kurze Verästelungen
        a, b = segs[r.randrange(1, len(segs) - 1)]
        dx = r.choice((-1, 1)); x, y = a
        for s in range(r.randrange(3, 6)):
            x += dx * r.choice((1, 1, 2)); y += r.choice((1, 1, 0))
            setp(bg, x, y, EDGE_)


HITS = [(c, t) for c, t, b_, h_ in STACKS]
# Einschlagglühen + Spiegelungen im Wasser
for (hx, hy), s in zip(HITS, (.6, .45, .3)):
    glow(bg, hx + .5, hy + .5, 9 * s + 4, 7 * s + 3, (255, 250, 170), s * .8, steps=2)
for (cx, top, base, sz_), s in zip(STACKS, (.5, .38, .26)):
    for y in range(base + 3, min(bh, base + 3 + int(40 * s))):
        for x in range(cx - 1, cx + 2):
            if rnd.random() < s * (1 - (y - base) / (40 * s + 4)):
                setp(bg, x + rnd.choice((-1, 0, 1)), y, (200, 200, 130))
# weitere Blitze der Gewitterwolke: ferne (blass, 1 Pixel) bis zum Horizont, mittlere (2 Pixel) bis aufs Wasser
FAR_B = [((8, 76), (4, HOR)), ((20, 80), (27, HOR)), ((104, 80), (97, HOR)), ((117, 76), (121, HOR)),
         ((86, 86), (80, HOR + 1))]
for i, (a_, b_) in enumerate(FAR_B):
    bolt(a_, b_, 1, 50 + i, 1, core=(200, 210, 190), edge=(140, 150, 120))
    glow(bg, b_[0] + .5, b_[1] + .5, 6, 3, (200, 210, 170), .35, steps=2)
for i, (a_, b_) in enumerate((((10, 78), (16, 158)), ((114, 80), (108, 162)))):
    glow(bg, b_[0] + .5, b_[1], 7, 3, (230, 230, 170), .45, steps=2)
    bolt(a_, b_, 2, 60 + i, 3)
bolt((62, 86), HITS[0], 3, 1, 3)
bolt(HITS[0], HITS[1], 2, 2, 2)
bolt(HITS[1], HITS[2], 1, 3, 1)

# ================================================================ 5×-Ebene: Sol Rym auf seiner Wolke
fw, fh = grid(5)                              # 50×70
fg = rgba(fw, fh)
# Sol Rym (Spalten 35–46 des Sprites) genau mittig: Sprite-Spalte 40.5 → Raster 25
SX = 25 - 41
put(fg, sol, SX, 5)

print(finish([(bg, 2), (fg, 5)], '26_three_link_storm.png'))
