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
* bartas:   Bomb Berserker Bartas atmet und blinzelt, hinter ihm steigt Glut auf.
* gon:      Gon, the Frostbringer: Schnee rieselt um ihn, auf der gefrorenen Seite blitzen Eiskristalle,
            er atmet und blinzelt.
* ida:      Ida, the Adept of Destruction steht in einer lodernden Flammenaura (Farbfolge fest, nur
            die Form lodert), Funken stieben, sie atmet und blinzelt.
* vacarn:   Vacarn kichert (Mund auf und zu), seine roten Augen glühen, um ihn steigen Seelen auf.
* solrym:   Sol Rym schwebt auf seiner Gewitterwolke: sie wallt (Bäusche quellen oben und unten auf
            und sinken zusammen, innen rollt sie), zweimal zuckt ein Blitz heraus, er blinzelt.
* dajan:    Legendary Explorer Dajan atmet und blinzelt, das Licht in seiner Hand flackert.
* omikron:  Omikron, the Faceless Illusionist: links und rechts flackern Trugbilder mit rot glühenden
            Augen auf und vergehen.
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
    'bartas': dict(slug='bomb-berserker-bartas', knee=19, pads=(4, 4, 8, 1),
                   blink=eyes([(4, 4, 5, 6), (9, 9, 5, 6)], 'f6bd7b')),
    'gon': dict(slug='gon-the-frostbringer', knee=20, pads=(5, 5, 4, 1),
                blink={'halb': [((11, 8), 'd5a464')], 'zu': [((11, 8), '311700'), ((10, 8), '311700')]}),
    'ida': dict(slug='ida-the-adept-of-destruction', knee=21, pads=(5, 5, 7, 1),
                blink=eyes([(8, 9, 6, 7), (12, 13, 6, 7)], 'f6cd8b')),
    'vacarn': dict(slug='vacarn-the-dark-goblin-necromancer', knee=18, pads=(4, 4, 10, 1),
                   blink={'halb': [((7, 5), '2f312e'), ((14, 5), '2f312e')],
                          'zu': [((x, 5), '000200') for x in (7, 8, 13, 14)]}),
    'solrym': dict(slug='sol-rym-the-thunder-djinn', pads=(2, 2, 4, 12),
                   blink={'halb': [((38, 8), '000000'), ((42, 8), '000000')],
                          'zu': [((x, 8), '000000') for x in (38, 39, 42, 43)]}),
    'dajan': dict(slug='legendary-explorer-dajan', knee=20, pads=(3, 5, 5, 1),
                  blink=eyes([(8, 9, 8, 9), (12, 13, 8, 9)], 'd9ba8d', line='170f14')),
    'omikron': dict(slug='omikron-the-faceless-illusionist', knee=20, pads=(10, 10, 2, 1)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'alex')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load() if V != 'solrym' else None
if SRC is None:                                         # Sol Rym: Djinn + Wolke deckungsgleich
    SRC = load('body')
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
    st = BLINK.get(i)                                   # das durch die Lupe riesige Auge (x 6–9, Zeilen 10–13)
    if st:                                              # blinzelt: das Lid kommt von oben
        for y in range(10, 14 if st == 'zu' else 12):
            for x in range(6, 10):
                last = y == (13 if st == 'zu' else 11)
                s[y, x] = rgb('35566b' if last else ('d9c6aa' if (x + y) % 3 else 'cbb89c'))
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


# ---------------------------------------------------------------- aufsteigende Partikel (Glut, Seelen, Schnee)
def rising(base_fn, count, seed, pal, life=(9, 15), vy=(0.7, 1.1), region=None, fall=False, wob=(0.5, 1.0), tail=False):
    """Partikel, die die Figur nie berühren (Vereinigung aller Frames + 1-px-Rand): steigen auf (oder
    fallen, fall=True), wackeln seitlich und laufen durch die Palette pal (Anfang -> Ende)."""
    fig = np.zeros((H, W), bool)
    for k in range(N):
        fig |= base_fn(k)[:, :, 3] > 0
    fig |= ring8(fig)
    rng = np.random.default_rng(seed)
    res, tries = [], 0
    while len(res) < count and tries < 30000:
        tries += 1
        e = int(rng.integers(N))
        L = int(rng.integers(*life))
        v, ph, wb = rng.uniform(*vy), rng.uniform(0, 6.3), rng.uniform(*wob)
        x0 = rng.uniform(1, W - 2)
        y0 = rng.uniform(1, H * 0.5) if fall else rng.uniform(H * 0.3, H - 2)
        steps, ok = [], True
        for a in range(L):
            x = int(round(x0 + wb * math.sin(0.6 * a + ph)))
            y = int(round(y0 + v * a)) if fall else int(round(y0 - v * a))
            if not (1 <= x < W - 1 and 1 <= y < H - 2) or fig[y, x] or (tail and fig[y + 1, x]) or \
                    (region is not None and not region[y, x]):
                ok = False
                break
            c = pal[min(len(pal) - 1, int(len(pal) * a / L))]
            px = {(x, y): c}
            if tail:                                     # Seele: Kopf mit blassem Schweif darunter
                px[(x, y + 1)] = [c[0], c[1], c[2], int(c[3] * 0.5)]
            steps.append(px)
        if not ok:
            continue
        if sum(1 for r in res if min((e - r[0]) % N, (r[0] - e) % N) <= 1) >= 3:
            continue
        res.append((e, steps))
    return res


def draw_parts(out, system, i):
    for e, steps in system:
        a = (i - e) % N
        if a < len(steps):
            for (x, y), c in steps[a].items():
                out[y, x] = c


EMBERS = [rgb('f7f5b8'), rgb('f6e70e'), rgb('f47b22'), rgb('ca2c29')]
FLAME = ('ca2c29', 'f47b22', 'f6e70e', 'f7f5b8')
SYSTEM = None


# ---------------------------------------------------------------- Bartas
def bartas_base(i):
    s = SRC.copy()
    blink(s, i)
    return bounce_frame(s, B24[i % 24])


def f_bartas(i):
    global SYSTEM
    if SYSTEM is None:
        SYSTEM = rising(bartas_base, 26, 31, EMBERS)
    out = bartas_base(i)
    draw_parts(out, SYSTEM, i)
    return out


# ---------------------------------------------------------------- Gon
SNOW = [rgb('ffffff'), rgb('eef4ff'), rgb('d6e2ff', 220), rgb('c4d2f4', 170)]
FROST = {'8988cc', 'dfe0f6', '9a99e5', 'a3a2f2', 'c1c1e6', 'b3b2ec', 'd6d5f4'}


def gon_base(i):
    s = SRC.copy()
    blink(s, i)
    return bounce_frame(s, B24[i % 24])


def f_gon(i):
    global SYSTEM
    if SYSTEM is None:
        SYSTEM = rising(gon_base, 30, 41, SNOW, life=(14, 22), vy=(0.45, 0.7), fall=True, wob=(0.6, 1.2))
    out = gon_base(i)
    b = B24[i % 24]
    frost = [(y, x) for y, x in zip(*np.nonzero(SRC[:, :, 3])) if hexc(SRC[y, x]) in FROST]
    rng = np.random.default_rng(5)
    stars = [frost[k] for k in rng.choice(len(frost), 4, replace=False)]
    for k, (y, x) in enumerate(stars):                  # Eiskristalle auf der gefrorenen Seite blitzen
        for (xx, yy), c in sparkle_pixels(i, N, [(x + PL, y + PT + b, 6 + 12 * k)], rgb('ffffff'), rgb('d6e2ff')).items():
            dot(out, xx, yy, c)
    draw_parts(out, SYSTEM, i)
    return out


# ---------------------------------------------------------------- Ida
def fire_aura(out, fig, i, reach=3.2):
    """Flammenaura hinter der Figur: Zungen steigen nach oben, Farbfolge fest (außen rot, dann
    orange, gelb, innen fast weiß), nur die Form lodert."""
    w = 2 * math.pi * i / N
    Hh, Ww = fig.shape
    fy, fx = np.nonzero(fig)
    for y in range(1, Hh - 1):
        for x in range(1, Ww - 1):
            if fig[y, x] or out[y, x, 3]:
                continue
            m = (np.abs(fx - x) <= reach + 1) & (fy >= y - 3) & (fy <= y + 10)
            if not m.any():
                continue
            dyv = fy[m] - y
            ab = dyv > 0
            d_up = np.min(np.hypot(fx[m][ab] - x, dyv[ab] * 0.38)) if ab.any() else 99.0
            d_any = np.min(np.hypot(fx[m] - x, dyv))
            nz = 0.5 * math.sin(1.25 * x + 0.35 * y + 6 * w) + 0.5 * math.sin(0.8 * x - 0.25 * y + 4 * w + 1.7)
            h = max(1 - d_up / reach, 0.5 * (1 - d_any / 1.6)) + 0.35 * nz
            c = FLAME[3] if h > 1.05 else FLAME[2] if h > 0.8 else FLAME[1] if h > 0.5 else FLAME[0] if h > 0.2 else None
            if c:
                out[y, x] = rgb(c)


def ida_base(i):
    s = SRC.copy()
    blink(s, i)
    return bounce_frame(s, B24[i % 24])


def f_ida(i):
    global SYSTEM
    if SYSTEM is None:
        SYSTEM = rising(ida_base, 18, 13, EMBERS)
    fig = ida_base(i)
    out = np.zeros_like(fig)
    fire_aura(out, fig[:, :, 3] > 0, i)
    m = fig[:, :, 3] > 0
    out[m] = fig[m]
    for e, steps in SYSTEM:                             # Funken nur, wo keine Flamme ist
        a = (i - e) % N
        if a < len(steps):
            for (x, y), c in steps[a].items():
                if not out[y, x, 3]:
                    out[y, x] = c
    return out


# ---------------------------------------------------------------- Vacarn
SOULS = [rgb('f0ecff'), rgb('d0c8ff', 230), rgb('a89cf0', 200), rgb('7a6cc8', 150)]
CACKLE = [0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]


def vacarn_base(i):
    s = SRC.copy()
    blink(s, i)
    if not CACKLE[i]:                                   # sonst Mund zu
        s[7, 10] = s[7, 11] = rgb('7570b8')
        s[8, 10] = s[8, 11] = rgb('2f312e')
    glow = 0.5 - 0.5 * math.cos(2 * math.pi * 3 * i / N)
    if not BLINK.get(i):
        for x in (8, 13):                               # die roten Augen glühen
            s[5, x] = lighten(s[5, x], 0.55 * glow)
    return bounce_frame(s, B24[i % 24])


def f_vacarn(i):
    global SYSTEM
    if SYSTEM is None:
        SYSTEM = rising(vacarn_base, 22, 7, SOULS, life=(12, 18), vy=(0.5, 0.8), wob=(0.8, 1.4), tail=True)
    out = vacarn_base(i)
    draw_parts(out, SYSTEM, i)
    return out


# ---------------------------------------------------------------- Sol Rym
CLOUD = None
BOLTS = {9: 0, 10: 0, 11: 1, 30: 2, 31: 2, 32: 3}


PUFFS = [(10, 1, 0.0), (24, 2, 1.1), (38, 1, 2.3), (52, 3, 0.7), (66, 2, 1.9), (18, 3, 2.9), (60, 1, 4.1)]


def cloud_frame(i):
    """Die Wolke wallt: an Ober- und Unterseite quellen Bäusche auf und sinken wieder zusammen
    (die Spalte wächst dort über ihren Rand hinaus, die Wolke liegt darunter – nichts reißt), die
    Bäusche wandern langsam; innen rollen die Zeilen leicht gegeneinander."""
    global CLOUD
    if CLOUD is None:
        CLOUD = load('cloud')
    t = 2 * math.pi * i / N
    ch, cw = CLOUD.shape[:2]
    op = CLOUD[:, :, 3] > 0
    dxs = [round(0.8 * (math.sin(0.55 * y + 2 * t) - math.sin(0.55 * y))) for y in range(ch)]
    base = np.zeros_like(CLOUD)
    for y in range(ch):
        for x in range(cw):
            sx = x - dxs[y]
            if 0 <= sx < cw and op[y, sx]:
                base[y, x] = CLOUD[y, sx]
    out = base.copy()
    for k, (cx, m, ph) in enumerate(PUFFS):
        amp = math.sin(math.pi * m * i / N) ** 2 * (2.4 if k % 2 == 0 else 1.6)
        c = cx + 4 * math.sin(t + ph)
        for x in range(cw):
            bump = int(round(amp * math.exp(-((x - c) / 4.5) ** 2)))
            if not bump:
                continue
            col = np.nonzero(base[:, x, 3])[0]
            if not len(col):
                continue
            top, bot = col.min(), col.max()
            mid = (top + bot) // 2
            if k % 2 == 0:                              # Bausch oben: obere Hälfte hebt sich
                for y in range(top, mid + 1):
                    if 0 <= y - bump:
                        out[y - bump, x] = base[y, x]
            else:                                       # Bausch unten: untere Hälfte senkt sich
                for y in range(bot, mid - 1, -1):
                    if y + bump < ch:
                        out[y + bump, x] = base[y, x]
    return out


def bolt(out, k, oy):
    """Blitz unter der Wolke (Zickzack nach unten)."""
    rng = np.random.default_rng(100 + k)
    x = PL + int(rng.integers(12, 70))
    y = oy
    for _ in range(int(rng.integers(8, 12))):
        dot(out, x, y, rgb('fffbd0'))
        if 0 <= x + 1 < W:
            dot(out, x + 1, y, rgb('f6e70e', 200))
        y += 1
        x += int(rng.choice([-1, 0, 1]))


def f_solrym(i):
    s = SRC.copy()
    blink(s, i)
    cloud = cloud_frame(i)
    k = BOLTS.get(i)
    if k is not None:                                   # Wetterleuchten um den Blitz herum
        bx = int(np.random.default_rng(100 + k).integers(12, 70))
        for y, x in zip(*np.nonzero(cloud[:, :, 3])):
            d = math.hypot((x - bx) / 2.2, y - 27)
            if d < 9 and hexc(cloud[y, x]) != '000000':
                cloud[y, x] = lighten(cloud[y, x], 0.4 * (1 - d / 9))
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(cloud[:, :, 3])):
        out[y + PT, x + PL] = cloud[y, x]
    if k is not None:
        bolt(out, k, PT + 27)
    b = [0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0][i % 24]  # er schwebt
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if 0 <= y + PT + b < H:
            out[y + PT + b, x + PL] = s[y, x]
    return out


# ---------------------------------------------------------------- Dajan
LAMP = {'d8c386', 'fdfcb7', 'fcfbb6', 'fefdb8'}


def f_dajan(i):
    s = SRC.copy()
    blink(s, i)
    fl = [0.0, 0.4, 0.15, 0.6, 0.25, 0.0, 0.5, 0.2][i % 8] if i else 0.0   # die Laterne flackert
    lamp = [(y, x) for y, x in zip(*np.nonzero(SRC[:, :, 3])) if hexc(SRC[y, x]) in LAMP and x >= 15]
    for y, x in lamp:
        s[y, x] = lighten(s[y, x], 0.6 * fl)
    b = B24[i % 24]
    out = bounce_frame(s, b)
    m = np.zeros((SH, SW), bool)
    for y, x in lamp:
        m[y, x] = True
    halo = ring8(m)
    for y, x in zip(*np.nonzero(halo)):                 # warmer Lichtschein um die Laterne
        if not out[y + PT + b, x + PL, 3]:
            out[y + PT + b, x + PL] = rgb('fff4b0', int(70 + 110 * fl))
    return out


# ---------------------------------------------------------------- Omikron
ILLU = [(-9, 0.0), (9, math.pi)]                        # Trugbilder links und rechts


def f_omikron(i):
    s = SRC.copy()
    b = B24[i % 24]
    fig = bounce_frame(s, b)
    out = np.zeros_like(fig)
    t = 2 * math.pi * i / N
    for dx, ph in ILLU:                                 # Trugbilder flackern auf und vergehen
        a = max(0.0, math.sin(2 * t + ph)) if i else 0.0
        if a < 0.08:
            continue
        for y, x in zip(*np.nonzero(fig[:, :, 3])):
            xx = x + dx
            if 0 <= xx < W and not out[y, xx, 3]:
                c = fig[y, x]
                out[y, xx] = [c[0], c[1], c[2], int(c[3] * 0.55 * a)]
        for ex in (8, 13):                              # rot glühende Augen im Nebel
            dot(out, ex + PL + dx, 10 + PT + b, rgb('ff2020', int(255 * a)))
    m = fig[:, :, 3] > 0
    out[m] = fig[m]
    return out


FRAME = dict(alex=f_alex, doq=f_doq, grisgar=f_grisgar, nieht=f_nieht, kohta=f_kohta, bill=f_bill,
             sabrina=f_sabrina, mizune=f_mizune, bartas=f_bartas, gon=f_gon, ida=f_ida, vacarn=f_vacarn,
             solrym=f_solrym, dajan=f_dajan, omikron=f_omikron)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
