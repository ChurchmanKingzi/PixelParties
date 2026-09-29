# -*- coding: utf-8 -*-
"""Idle-Animationen für die Heroes und Skins aus Motive.xcf.

Aufruf: python3 motive.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* alex:     Alex, Trainer of Heroes federt (der verschränkte Unterarm geht als Einheit mit) und blinzelt.
* doq:      Great Detective Doq federt; das durch die Lupe riesige Auge blinzelt, über das Glas huscht
            ein Glanzlicht, dann blitzt ein Stern am Rand.
* grisgar:  Grisgar schlägt langsam mit den riesigen Dämonenflügeln (spaltentreue Scherung) und
            schwebt dabei auf und ab; der Heiligenschein schwingt nach und glüht, er blinzelt.
* nieht:    Nieht, the Blitz Blade: an den Klingen knistern Blitze, die Funkelsterne neben ihm
            pulsieren, Capezipfel und Haarspitzen wehen, er federt und blinzelt; zweimal je Loop ist
            er blitzschnell weg (Tempolinien, Staub) und taucht von der anderen Seite wieder auf.
* kohta:    Kohta, the Silent Observer sitzt, redet (der Mund geht auf und zu) und hebt ab und zu
            sein Glas; Glas und Flasche sprudeln, über die Flasche läuft ein Glanz.
* bill:     Bill, the Angry Auctioneer brüllt (Mund), schüttelt abwechselnd die Fäuste, ihm steigt
            Dampf aus dem Kopf; er blinzelt.
* sabrina:  Sabrina, the Psychic Witch: ihre grünen Augen glühen auf, psychische Lichtkugeln
            umkreisen sie (hinter ihr verschwinden sie ganz), sie atmet und blinzelt.
* mizune:   Silent Water Mizune spricht; um ihn steigen viele Wasserblasen auf, wachsen und platzen;
            er atmet und blinzelt.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, sparkle_pixels, draw_bounce, ring8
from flap_common import shear_flap

N = 48
OUT = os.environ.get('MO_OUT', '.')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]  # gemächlich: ein Federn je 24 Frames


def eyes(blocks, skin, line='000000'):
    """Augen aus Blöcken (x0, x1, y_oben, y_unten): halb = obere Zeile dunkel, zu = obere Zeile Haut,
    untere Zeile als dunkle Linie."""
    halb, zu = [], []
    for x0, x1, yt, yb in blocks:
        for x in range(x0, x1 + 1):
            halb.append(((x, yt), line))
            zu += [((x, yt), skin), ((x, yb), line)]
    return {'halb': halb, 'zu': zu}


V_ = {
    'alex': dict(slug='alex-trainer-of-heroes', knee=22, pads=(2, 2, 3, 1),
                 blink=eyes([(6, 7, 9, 10), (10, 11, 9, 10)], 'f6bd7b')),
    'doq': dict(slug='great-detective-doq', knee=20, pads=(3, 2, 3, 1)),
    'grisgar': dict(slug='grisgar-emissary-of-the-demon-lord', pads=(2, 2, 14, 14),
                    blink={'halb': [((86, 34), '110f08'), ((89, 34), '110f08')],
                           'zu': [((x, 34), '110f08') for x in (85, 86, 89, 90)]}),
    'nieht': dict(slug='nieht-the-blitz-blade', knee=20, pads=(4, 4, 3, 1),
                  blink=eyes([(19, 20, 10, 11), (23, 24, 10, 11)], 'fde1d2')),
    'kohta': dict(slug='kohta-the-silent-observer', knee=19, pads=(2, 2, 3, 1)),
    'bill': dict(slug='bill-the-angry-auctioneer', knee=16, pads=(6, 6, 13, 1),
                 blink=eyes([(5, 5, 5, 6), (10, 10, 5, 6)], 'b45f3d')),
    'sabrina': dict(slug='sabrina-the-psychic-witch', knee=19, pads=(8, 8, 4, 2),
                    blink=eyes([(7, 8, 7, 8), (11, 12, 7, 8)], 'cc9d7c')),
    'mizune': dict(slug='silent-water-mizune', knee=19, pads=(6, 6, 8, 1),
                   blink=eyes([(6, 7, 9, 10), (10, 11, 9, 10)], 'f5ce88')),
}
V = next((v for v in sys.argv[2:] if v in V_), 'alex')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def blink(s, i):
    st = BLINK.get(i)
    if st and 'blink' in C:
        for (x, y), c in C['blink'][st]:
            s[y, x] = rgb(c)


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def lighten(c, f):
    return [int(c[k] + (255 - c[k]) * f) for k in range(3)] + [int(c[3])]


def bounce_frame(s, b):
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    return out


def sweep(s, mask, i, start, dur=6, slope=1.0, width=0.8, col='ffffff', trail='d8e8f0'):
    """Glanzlicht: ein schräger Streifen läuft von links nach rechts über die Pixel in mask."""
    g = i - start
    if not 0 <= g < dur:
        return
    ys, xs = np.nonzero(mask)
    lo, hi = (xs - slope * ys).min(), (xs - slope * ys).max()
    c = lo - 1 + (hi - lo + 3) * g / (dur - 1)
    for y, x in zip(ys, xs):
        d = (x - slope * y) - c
        if abs(d) < width:
            s[y, x] = rgb(col)
        elif -2.2 < d < 0:
            s[y, x] = rgb(trail)


# ---------------------------------------------------------------- Alex
def f_alex(i):
    s = SRC.copy()
    blink(s, i)
    return bounce_frame(s, B24[i % 24])


# ---------------------------------------------------------------- Doq
LENS = {'a8c9e6', 'b5bbb7', 'c5c7b2', 'd1cdb7', 'a3b3aa', 'e4d38b', 'e2c27f', 'a0917a', 'e4d58d', 'e0d28c',
        '8b8a7a', 'e2cdb3', 'e9d2b5', 'aa987d', 'a1927b', '586875', '4a6174', '4d626f', '405c6b', '97a49b',
        '516474', '556675', '4e6373', '35566b', 'cec0a9', 'e6d1b6', 'ab977b', '9f9079'}


RIM = {'001f5e', '0353b8', '033277', '023c85'}


def f_doq(i):
    s = SRC.copy()
    st = BLINK.get(i)                                   # das durch die Lupe riesige Auge blinzelt
    if st:
        for y in range(8, 14 if st == 'zu' else 11):
            for x in range(5, 11):
                if s[y, x, 3] and hexc(s[y, x]) not in RIM:
                    s[y, x] = rgb('35566b' if (st == 'zu' and y == 13) or (st == 'halb' and y == 10) else ('d9c6aa' if (x + y) % 3 else 'cbb89c'))
    lens = np.array([[SRC[y, x, 3] > 0 and hexc(SRC[y, x]) in LENS and x <= 12 and y <= 15
                      for x in range(SW)] for y in range(SH)])
    sweep(s, lens, i, 4, dur=7, slope=-0.8, col='ffffff', trail='e8f4ff')
    sweep(s, lens, i, 28, dur=7, slope=-0.8, col='ffffff', trail='e8f4ff')
    b = B24[i % 24]
    out = bounce_frame(s, b)
    for (x, y), c in sparkle_pixels(i, N, [(10 + PL, 4 + PT + b, 10), (2 + PL, 12 + PT + b, 34)],
                                    rgb('e8f4ff'), rgb('a8c9e6')).items():
        dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Grisgar
WING_L, WING_R = 81, 96                                 # Flügelwurzeln (links bis 81, rechts ab 96)
HALO_ROWS = (20, 24)


def f_grisgar(i):
    s = SRC.copy()
    blink(s, i)
    t = 2 * math.pi * 2 * i / N                         # zwei langsame Schläge je Loop
    lift = 0.12 * math.sin(t)
    squeeze = 1.0 - 0.08 * max(0.0, math.sin(t))
    hover = -round(2.0 * math.sin(t - 0.9)) if i else 0  # der Abschlag trägt ihn nach oben
    op = s[:, :, 3] > 0
    halo = op & (_ys >= HALO_ROWS[0]) & (_ys < HALO_ROWS[1]) & (_xs > WING_L) & (_xs < WING_R)
    wl = op & (_xs <= WING_L)
    wr = op & (_xs >= WING_R)
    body = op & ~wl & ~wr & ~halo
    out = np.zeros((H, W, 4), int)
    wings = np.zeros_like(out)
    shear_flap(s, wl, WING_L, -1, lift, squeeze, wings, (PL, PT + hover), curve=1.3)
    shear_flap(s, wr, WING_R, 1, lift, squeeze, wings, (PL, PT + hover), curve=1.3)
    m = wings[:, :, 3] > 0
    out[m] = wings[m]
    for y, x in zip(*np.nonzero(body)):
        out[y + PT + hover, x + PL] = s[y, x]
    lag = -round(2.0 * math.sin(t - 1.8)) if i else 0   # der Heiligenschein schwingt nach und glüht
    glow = 0.5 - 0.5 * math.cos(2 * math.pi * 3 * i / N)
    for y, x in zip(*np.nonzero(halo)):
        out[y + PT + lag, x + PL] = lighten(s[y, x], 0.45 * glow)
    return out


# ---------------------------------------------------------------- Nieht
CROSSES = [(6, 12, 0), (42, 12, 5)]                     # Funkelsterne (Mitte, Phase)
BLADES = [(0, 17, 'l'), (31, 39, 'r')]                  # Klingen: Spalten, Zeilen 16–17
ZAPS = {5: (3, 1), 6: (4, 1), 18: (33, 2), 19: (34, 2), 29: (8, 3), 30: (9, 3), 41: (36, 4), 42: (35, 4)}


def cross(out, cx, cy, arm, ox, oy):
    dot(out, cx + ox, cy + oy, rgb('ffffff'))
    for k in range(1, arm + 1):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            dot(out, cx + dx + ox, cy + dy + oy, rgb('ffffff' if k < arm else 'dadace'))


BLADE_COLS = {'7a7975', 'ccccc4', 'f6f6f6', 'dadace'}


def cape_flutter(out, s, i, b):
    """Die Capezipfel links und rechts flattern: je Zeile schiebt sich die Spitze nach außen und zurück
    (eine Welle läuft von oben nach unten), das Cape selbst bleibt darunter liegen – nichts reißt."""
    t = 2 * math.pi * i / N
    env = 0.5 - 0.5 * math.cos(2 * t)
    for side, xs in ((-1, range(0, 13)), (1, range(32, SW))):
        for y in list(range(11, 16)) + [18, 19]:
            dx = round(2.2 * env * (0.5 + 0.5 * math.sin(6 * t - 0.9 * (y - 11) + (0 if side < 0 else 1.7))))
            if not dx:
                continue
            for x in xs:
                if s[y, x, 3] and hexc(s[y, x]) not in BLADE_COLS:
                    xx = x + side * dx + PL
                    if 0 <= xx < W and (not out[y + PT + b, xx, 3] or hexc(out[y + PT + b, xx]) not in BLADE_COLS):
                        out[y + PT + b, xx] = s[y, x]


GONE = {5: 'streak', 6: 'dust', 7: 'dust', 8: 'dust', 9: 'none', 10: 'back',
        27: 'streak', 28: 'dust', 29: 'dust', 30: 'dust', 31: 'none', 32: 'none', 33: 'back'}
STREAK_ROWS = [3, 8, 12, 16, 20, 23]


def nieht_hair(s, i):
    """Die Haarspitzen (Zeilen 0–5) wiegen sich: je Zeile ein Versatz, oben am stärksten."""
    t = 2 * math.pi * i / N
    raw = [round(1.6 * (6 - y) / 6 * math.sin(3 * t - 0.5 * y) * (0.5 - 0.5 * math.cos(2 * t) if i else 0))
           for y in range(6, -1, -1)]
    dxs = clamp_chain(raw)[::-1]                      # Zeile 6 bleibt, darüber höchstens 1 px je Zeile
    out = s.copy()
    for y in range(0, 6):
        if dxs[y]:
            row = s[y].copy()
            out[y] = 0
            for x in np.nonzero(row[:, 3])[0]:
                if 0 <= x + dxs[y] < SW:
                    out[y, x + dxs[y]] = row[x]
    return out


def clamp_chain(vals):
    out = [vals[0]]
    for v in vals[1:]:
        out.append(max(out[-1] - 1, min(out[-1] + 1, v)))
    return out


def streaks(out, b, side, alpha):
    """Tempolinien, wo er eben noch war (side: -1 = zur linken Seite hin, +1 = zur rechten)."""
    for k, y in enumerate(STREAK_ROWS):
        L = 10 + 4 * (k % 3)
        x0 = PL + SW // 2 + (2 if side > 0 else -2 - L) + (k % 2) * 3 * side
        for x in range(x0, x0 + L):
            a = alpha * (1 - abs((x - x0) - L / 2) / (L / 2 + 1))
            if 0 <= x < W and not out[y + PT + b, x, 3]:    # hinter der Figur
                out[y + PT + b, x] = rgb('f4f2e4', int(a))


def f_nieht(i):
    s = nieht_hair(SRC.copy(), i)
    blink(s, i)
    b = B24[i % 24]
    for cx, cy, _ in CROSSES:                           # die Sterne selbst malt cross()
        for yy in range(cy - 2, cy + 3):
            for xx in range(cx - 2, cx + 3):
                if s[yy, xx, 3] and hexc(s[yy, xx]) in ('ffffff', 'dadace'):
                    s[yy, xx] = 0
    gone = GONE.get(i)
    if gone in ('streak', 'dust', 'none'):             # Ninja: blitzschnell weg …
        out = np.zeros((H, W, 4), int)
        if gone == 'streak':
            streaks(out, b, 1, 230)
        if gone == 'dust':
            a = (i - 6) % 22 if i < 20 else i - 28
            for k, dx in enumerate((-3, -1, 2, 4)):
                x, y = PL + SW // 2 + dx + (k - 1) * a, PT + SH - 1 - a - (k % 2)
                dot(out, x, y, rgb('c8c0a0', 200 - 60 * a))
        return out
    out = bounce_frame(s, b)
    cape_flutter(out, s, i, b)
    if gone == 'back':                                  # … und von links wieder da
        streaks(out, b, -1, 170)
    for cx, cy, ph in CROSSES:
        arm = [2, 2, 2, 1, 1, 0, 1, 2][((i // 2) + ph) % 8]
        cross(out, cx, cy, arm, PL, PT + b)
    z = ZAPS.get(i)
    if z:                                               # Blitz knistert an der Klinge entlang
        x0, seed = z
        rng = np.random.default_rng(seed)
        y = 15 if seed % 2 else 18
        for k in range(6):
            x = x0 + k
            yy = y + (int(rng.integers(0, 2)) * (1 if y == 18 else -1))
            if not out[yy + PT + b, x + PL, 3]:
                out[yy + PT + b, x + PL] = rgb('fff7a0' if k % 2 else 'ffffff')
    return out


# ---------------------------------------------------------------- Kohta
TALK = [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0,
        0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0]
SIP = {k: -1 for k in range(20, 30)}                    # er hebt das Glas
GLASS = (7, 12, 9, 15)                                  # Glas mit Hand: x0, x1, y0, y1
BOTTLE = (0, 4, 7, 19)


LIQUID = {'b59631', 'ad8a29', 'cea652', 'deb263', 'd6c7bd', 'a59684'}
BOTTLE_BUB = [(1, 0), (2, 5), (3, 10), (2, 15), (1, 19)]  # (Spalte, Startframe) – Bläschen in der Flasche
GLASS_FIZZ = [(8, 0), (9, 3), (10, 6), (8, 9), (9, 12), (10, 15), (9, 18), (8, 21)]


def fizz(out, i, b):
    """Kohlensäure: in der Flasche steigen Bläschen durch das Getränk, über dem Glas perlen winzige
    Tröpfchen hoch und zerplatzen."""
    for x, st in BOTTLE_BUB:
        a = (i - st) % 24
        y = 18 - a // 2
        if 12 <= y <= 18 and hexc(SRC[y, x]) in LIQUID:
            out[y + PT, x + PL] = rgb('fff3c0')
        elif y < 12 and a // 2 in (7, 8):                # oben im Hals kurz sichtbar
            out[y + PT, x + PL] = rgb('fff7d8', 220)
    for x, st in GLASS_FIZZ:
        a = (i - st) % 24
        if a < 5:
            y = 8 - a                                     # über dem Glasrand (Zeile 9)
            if not out[y + PT + b, x + PL, 3]:
                out[y + PT + b, x + PL] = rgb('fffbe8', 230 - 40 * a)


def f_kohta(i):
    s = SRC.copy()
    if TALK[i]:                                         # Mund zu
        s[8, 16] = s[8, 17] = rgb('f6cd8b')
        s[9, 16] = s[9, 17] = rgb('580000')
    bot = np.zeros((SH, SW), bool)
    bot[BOTTLE[2]:BOTTLE[3] + 1, BOTTLE[0]:BOTTLE[1] + 1] = True
    bot &= np.array([[hexc(SRC[y, x]) in ('94aaad', '6b926b', '526d52', 'd6c7bd', 'a59684') and SRC[y, x, 3] > 0
                      for x in range(SW)] for y in range(SH)])
    sweep(s, bot, i, 30, dur=6, slope=0.0, col='f6ffff', trail='c8dcdc')
    b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0][i % 24]
    b_ = b if i % 48 < 24 else 0
    out = np.zeros((H, W, 4), int)
    fig = s.copy()
    fig[:, :5] = 0
    draw_bounce(out, fig, b_, KNEE, PT, PL)
    for y, x in zip(*np.nonzero(s[:, :5, 3])):          # die Flasche steht fest
        out[y + PT, x + PL] = s[y, x]
    fizz(out, i, b_)
    lift = SIP.get(i, 0)
    if lift:
        x0, x1, y0, y1 = GLASS
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if s[y, x, 3]:
                    out[y + PT + b_ + lift, x + PL] = s[y, x]
    return out


# ---------------------------------------------------------------- Bill
YELL = [0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0,
        0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]
FIST_L = (0, 3, 7, 13)
FIST_R = (12, 15, 7, 13)
STEAM = [(3, 0), (12, 5), (3, 12), (12, 18), (3, 25), (12, 30), (3, 37), (12, 42)]   # (Spalte, Startframe)


def steam(out, x0, st, i, b):
    """Dampfwolke: quillt seitlich oben aus dem Kopf, wächst, steigt schräg nach außen und verblasst."""
    a = (i - st) % N
    if a >= 14:
        return
    side = -1 if x0 < 8 else 1
    x = x0 + PL + side * (1 + a // 3)
    y = PT + b - 1 - (a * 2) // 3
    al = int(240 * (1 - a / 15))
    core, rim = rgb('ffffff', al), rgb('d8d8e0', int(al * 0.8))
    if a < 3:
        pts = {(0, 0): core}
    elif a < 7:
        pts = {(0, 0): core, (side, 0): rim, (0, -1): rim}
    else:
        pts = {(0, 0): core, (side, 0): core, (0, -1): rim, (side, -1): rim, (-side, 0): rim, (0, 1): rim}
    for (dx, dy), c in pts.items():
        dot(out, x + dx, y + dy, c)


VEIN = [(11, 1), (12, 1), (11, 2), (13, 2), (12, 3)]    # Zornesader auf der Stirn (rechts oben)


def f_bill(i):
    s = SRC.copy()
    blink(s, i)
    if not YELL[i]:                                     # Mund zu (sonst weit offen)
        s[9, 7] = s[9, 8] = rgb('292829')
        s[10, 7] = s[10, 8] = rgb('933c18')
    b = B24[i % 24]
    out = bounce_frame(s, b)
    shake = (i // 2) % 2 if YELL[i] else 0              # Fäuste abwechselnd hoch
    for (x0, x1, y0, y1), up in ((FIST_L, shake), (FIST_R, 1 - shake if YELL[i] else 0)):
        if not up:
            continue
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if s[y, x, 3]:
                    out[y + PT + b - 1, x + PL] = s[y, x]
    for x0, st in STEAM:
        steam(out, x0, st, i, b)
    if YELL[i] and (i // 3) % 2 == 0:                   # die Zornesader pocht
        for x, y in VEIN:
            dot(out, x + PL + 2, y + PT + b - 3, rgb('ff2020'))
    return out


# ---------------------------------------------------------------- Sabrina
ORBS = [  # (Phase, Umläufe je Loop, Radius x-Zusatz, Radius y, Höhe, Farbe innen, Farbe außen)
    (0.0, 2, 4.0, 3.0, 12, 'c8ffd0', '20ff3d'), (1.3, 2, 4.0, 3.0, 12, 'ece4ff', '9d8fff'),
    (2.6, 2, 4.0, 3.0, 12, 'c8ffd0', '20ff3d'), (3.9, 2, 4.0, 3.0, 12, 'ece4ff', '9d8fff'),
    (5.2, 2, 4.0, 3.0, 12, 'c8ffd0', '20ff3d'), (0.7, -1, 6.0, 2.0, 18, 'ece4ff', '9d8fff'),
    (3.8, -1, 6.0, 2.0, 18, 'c8ffd0', '20ff3d'), (2.2, 1, 5.0, 2.0, 6, 'ece4ff', '9d8fff')]


def f_sabrina(i):
    s = SRC.copy()
    blink(s, i)
    glow = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    if not BLINK.get(i):
        for y, x in zip(*np.nonzero((s[:, :, 3] > 0))):
            if hexc(s[y, x]) == '20ff3d':
                s[y, x] = lighten(s[y, x], 0.7 * glow)
    b = B24[i % 24]
    out = bounce_frame(s, b)
    fig = out[:, :, 3] > 0
    ring = ring8(fig) | fig
    cx = PL + SW / 2 - 0.5
    for ph, k, rx, ry, hy, c1, c2 in ORBS:
        a = 2 * math.pi * k * i / N + ph
        a0 = a - 2 * math.pi * k / N * 1.2               # Nachleuchten knapp dahinter
        pos = lambda q: (int(round(cx + (SW / 2 + rx) * math.cos(q))), int(round(PT + hy + ry * math.sin(q))))
        x, y = pos(a)
        tx, ty = pos(a0)
        pts = {(tx, ty): rgb(c2, 110)}
        pts.update({(x, y): rgb(c1), (x - 1, y): rgb(c2, 180), (x + 1, y): rgb(c2, 180), (x, y - 1): rgb(c2, 180),
                    (x, y + 1): rgb(c2, 180)})
        behind = math.sin(a) < 0
        if behind and any(ring[yy, xx] for (xx, yy) in pts if 0 <= yy < H and 0 <= xx < W):
            continue                                    # hinter ihr: ganz verdeckt
        if any(fig[yy, xx] for (xx, yy) in pts if 0 <= yy < H and 0 <= xx < W):
            continue
        for (xx, yy), c in pts.items():
            dot(out, xx, yy, c)
    return out


# ---------------------------------------------------------------- Mizune
BUBBLES = None


def bubble_px(a, L):
    ed, hl, core = rgb('9fd4f0', 230), rgb('ffffff'), rgb('d8f2ff', 200)
    u = a / L
    if a == L - 1:
        return {(-1, -1): hl, (3, -1): hl, (-1, 3): ed, (3, 3): ed}
    if u < 0.3:
        return {(1, 1): core}
    if u < 0.65:
        return {(0, 0): hl, (1, 0): ed, (0, 1): ed, (1, 1): ed}
    return {(1, 0): ed, (0, 1): ed, (2, 1): ed, (1, 2): ed, (0, 0): hl}


MTALK = [0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0,
         0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]


def mizune_base(i):
    s = SRC.copy()
    blink(s, i)
    if not MTALK[i]:                                    # Mund zu (sonst offen): nur Haut, wie bei Sabrina
        s[12, 9] = s[12, 10] = rgb('f8bc77')
        s[13, 9] = s[13, 10] = rgb('f8bc77')
    return bounce_frame(s, B24[i % 24])


def f_mizune(i):
    global BUBBLES
    if BUBBLES is None:
        fig = np.zeros((H, W), bool)
        for k in range(N):
            fig |= mizune_base(k)[:, :, 3] > 0
        fig |= ring8(fig)
        rng = np.random.default_rng(23)
        BUBBLES, tries = [], 0
        while len(BUBBLES) < 38 and tries < 20000:
            tries += 1
            L = int(rng.integers(14, 21))
            e = int(rng.integers(N))
            x0, y0 = rng.uniform(1, W - 4), rng.uniform(10, H - 3)
            v, ph = rng.uniform(0.7, 1.0), rng.uniform(0, 6.3)
            path, ok = [], True
            for a in range(L):
                bx, by = int(round(x0 + 0.7 * math.sin(0.6 * a + ph))), int(round(y0 - v * a))
                for (dx, dy) in bubble_px(a, L):
                    x, y = bx + dx, by + dy
                    if not (1 <= x < W - 1 and 1 <= y < H - 1) or fig[y, x]:
                        ok = False
                path.append((bx, by))
            if ok and sum(1 for r in BUBBLES if min((e - r[0]) % N, (r[0] - e) % N) <= 1) < 3:
                BUBBLES.append((e, L, path))
    out = mizune_base(i)
    for e, L, path in BUBBLES:
        a = (i - e) % N
        if a < L:
            bx, by = path[a]
            for (dx, dy), c in bubble_px(a, L).items():
                out[by + dy, bx + dx] = c
    return out


FRAME = dict(alex=f_alex, doq=f_doq, grisgar=f_grisgar, nieht=f_nieht, kohta=f_kohta, bill=f_bill,
             sabrina=f_sabrina, mizune=f_mizune)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
