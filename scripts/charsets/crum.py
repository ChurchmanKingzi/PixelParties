# -*- coding: utf-8 -*-
"""Crum (Eulen-Pinguin mit Fisch) — 28x26, größer als die 24 px einer RM2003-Zelle, daher Zelle 32x32.

Mitte vorn = Original 1:1. Rücken: Gesicht/Bauch werden mit Gefieder-Navy übermalt und das Bild gespiegelt
(Fisch wandert auf die andere Seite). Profil: Rumpf als geschattete Ellipse aus den Navy-Tönen des Originals,
Gesichtsscheibe, Auge, Schnabel, Bauch und Füße aus den Original-Pixeln; die nahe Flosse samt Fisch ist eine
eigene Ebene und schwingt beim Gehen.
"""
from figure import make, front_rows, sub, build, patched
from rig import G, flip

CRUM_PAL = {'a': 'c9c189', 'b': '31364b', 'c': 'ffffff', 'd': '303e5f', 'e': '505d8a', 'f': '6d82b9',
            'g': 'dad9da', 'h': '604431', 'i': '002d5f', 'j': 'b3896d', 'k': '674b38', 'l': '205d89',
            'm': '2686ac', 'n': '67a6d1', 'o': 'c2ba7d', 'p': 'eee9bf', 'q': '918861', 'r': '403537',
            's': '000000', 't': 'adadad', 'u': '251f1e', 'v': '6d6251', 'w': 'a89f6e', 'x': '372e2f'}
F = front_rows('Crum', CRUM_PAL)
W, H = len(F[0]), len(F)


def repaint(rows, box, letters, pattern):
    """Flicken über `box` (x0, x1, y0, y1; exklusiv): jedes Pixel, dessen Buchstabe in `letters` liegt, wird durch
    ein Gefieder-Navy aus `pattern(x, y)` ersetzt; alles andere bleibt ('.')."""
    x0, x1, y0, y1 = box
    out = []
    for y in range(y0, y1):
        r = ''
        for x in range(x0, x1):
            r += pattern(x, y) if rows[y][x] in letters else '.'
        out.append(r)
    return out, x0, y0


def shade(x, y, x0=9, x1=24, y1=22):
    """Gefieder-Navy als diagonaler Verlauf (Licht von links oben): f -> e -> d -> b, wie im Original."""
    v = 0.6 * (x - x0) / (x1 - x0) + 0.4 * y / y1
    if v < 0.16:
        return 'f'
    if v < 0.32:
        return 'e'
    if v < 0.78:
        return 'd'
    return 'b'


feathers = shade


# ── Rückansicht: Gesichtsscheibe, Augen, Schnabel und Bauch durch Gefieder ersetzen (wird danach gespiegelt) ──
CRUM_BACK = [repaint(F, (12, 21, 3, 22), set('cgtopqahjkrs'), feathers)]

# ── Profil (nach rechts): Ellipse aus Navy-Tönen ──────────────────────────────
#  Zeile: (x_links, x_rechts) der äußeren Kontur
SIL = {0: (13, 18), 1: (12, 19), 2: (11, 20), 3: (10, 21), 4: (9, 22), 5: (9, 22), 6: (9, 23), 7: (8, 23),
       8: (8, 23), 9: (7, 23), 10: (7, 23), 11: (6, 23), 12: (6, 23), 13: (6, 23), 14: (6, 23), 15: (6, 23),
       16: (6, 23), 17: (7, 23), 18: (7, 23), 19: (8, 22), 20: (8, 22), 21: (9, 21), 22: (13, 17)}


def body_color(x, y, x0, x1):
    if y == 0 or x == x0 or x == x1 or y == 22:
        return 'b'
    return shade(x, y, 6, 23)


def profile_base():
    g = [['.'] * W for _ in range(H)]
    for y, (x0, x1) in SIL.items():
        for x in range(x0, x1 + 1):
            g[y][x] = body_color(x, y, x0, x1)
    # Horn (linkes Horn des Originals, dahinter kein zweites)
    horn = sub(F, 8, 13, 0, 3)
    for j, r in enumerate(horn):
        for i, c in enumerate(r):
            if c != '.':
                g[j][8 + i] = c
    # Gesichtsscheibe (hell) im vorderen Kopfteil, Auge, Schnabel
    for y in range(3, 11):
        x1 = SIL[y][1]
        wdt = {3: 3, 4: 4, 5: 5, 6: 5, 7: 5, 8: 5, 9: 4, 10: 3}[y]
        for x in range(x1 - wdt, x1):
            g[y][x] = 'g'
    g[5][19] = 'h'
    g[6][19] = 'j'
    g[6][20] = 'k'
    for (x, y, c) in [(23, 7, 'o'), (24, 7, 'p'), (23, 8, 'o'), (24, 8, 'p'), (25, 8, 'q'), (23, 9, 'q'), (24, 9, 'q')]:
        g[y][x] = c
    # Bauch (weiß, grauer Rand) an der Vorderseite
    for y, wdt in zip(range(11, 21), (3, 5, 6, 6, 6, 6, 6, 5, 4, 3)):
        x1 = SIL[y][1]
        for x in range(x1 - wdt, x1 + 1):
            g[y][x] = 't' if (x == x1 - wdt or x == x1 or y == 20) else 'c'
    # Schwanz (kleine Spitze hinten unten)
    for (x, y, c) in [(5, 19, 'b'), (4, 20, 'b'), (5, 20, 'd'), (6, 20, 'd'), (5, 21, 'b'), (6, 21, 'b'), (7, 21, 'd')]:
        g[y][x] = c
    return [''.join(r) for r in g]


CRUM_PROFILE = profile_base()
# Füße: rechter Fuß des Originals (Zehen nach rechts) als nahe Fußform; fernes Fußstück dahinter
FOOT_NEAR = sub(F, 19, 26, 22, 26)
FOOT_FAR = sub(F, 19, 26, 22, 26)
CRUM_SIDE_BODY = build(W, H, [(CRUM_PROFILE, 0, 0), (FOOT_FAR, 11, 22), (FOOT_NEAR, 14, 22)])
WING = sub(F, 22, 28, 8, 17)                       # rechte Flosse des Originals (7 breit, 9 hoch)
FISH = sub(F, 0, 12, 5, 22)                        # der Fisch (12 breit, 17 hoch)
ARM_FISH = (build(24, 20, [(FISH, 0, 0), (WING, 14, 3)]), 0, 5)     # Fisch hinten, Flosse davor
ARM_WING = (WING, 12, 9)

CAST = {}
CAST['Crum'] = make(
    'Crum', CRUM_PAL, x0=2, legs_top=23, split_x=16, cell=(32, 32), sway=1, back=CRUM_BACK,
    side=dict(body=CRUM_SIDE_BODY, arm=ARM_FISH, legs_top=22, stride=3, arm_swing=1,
              shifts_front=[1, 2, 2, 2], shifts_back=[-1, -2, -2, -2], far_shade={}),
    left=dict(body=CRUM_SIDE_BODY, arm=ARM_WING, legs_top=22, stride=3, arm_swing=1,
              shifts_front=[1, 2, 2, 2], shifts_back=[-1, -2, -2, -2], far_shade={}))
