# -*- coding: utf-8 -*-
"""Idle-Animationen für die letzten Skins (Sprites aus assemble_skins_last.py).

Aufruf: python3 skins_last.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* bill:      Bills Worst Nightmare federt und blinzelt, die roten Augen der Bärenhaube glühen, die Krone
             funkelt, der rote Umhang flattert leicht.
* semi:      Creepy Villager Girl Semi schwebt, ihre Flügelchen schlagen, die Haare bewegen sich leicht,
             sie blinzelt.
* doq:       Non-Believer Doq federt (die Hand mit der Lupe geht ganz mit), das riesige Auge hinter der Lupe
             blinzelt wie beim Standard-Doq, über das Glas wandert ein Glanz.
* thundergod: Thunder God Sol Rym steigt samt Gewitterwolke auf und ab (die Wolke wallt wie bei Sol Rym),
             die Trommeln seines Kranzes werden reihum geschlagen (sie hüpfen, Funken), er spricht und
             blinzelt; aus der Wolke zucken Blitze.
* inya:      Ultimate Despair Inya und ihr Bär bewegen sich unabhängig: sie lacht (der Mund), ihre
             Zöpfe wehen; der Bär watschelt (kippt hin und her), sein rotes Auge blitzt.
* johanna:   Mega-Priestess Johanna federt, ein Glanz läuft über die goldene Rüstung, der Umhang weht.
* nao:       Student Council President Nao federt, ihre Engelsflügel schlagen, ihr Haar weht, die Spitze
             ihres Stabs funkelt, sie blinzelt.
* rhabi:     RhaBi the Human Hunter federt, die vier abgetrennten Arme fliegen erratisch zu ihm hin und weg,
             das blaue Auge flackert.
* kasperov:  Kasperov the King of the East: der Shogi-Stein wippt und hüpft, die Schellen der Narrenkappe
             klingeln (bimmeln hin und her, Funkeln).
"""
import math
import os
import sys
import numpy as np
import cv2
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, sparkle_pixels
from flap_common import shear_flap

N = 48
OUT = os.environ.get('L4_OUT', '.')
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'bill': dict(slug='bills-worst-nightmare', knee=24, pads=(2, 1, 2, 1)),
    'semi': dict(slug='creepy-villager-girl-semi', pads=(1, 1, 3, 3)),
    'doq': dict(slug='non-believer-doq', knee=20, pads=(1, 1, 2, 2)),
    'thundergod': dict(slug='thunder-god-sol-rym', pads=(1, 1, 6, 8)),
    'inya': dict(slug='ultimate-despair-inya', pads=(1, 1, 2, 1)),
    'johanna': dict(slug='mega-priestess-johanna', knee=22, pads=(1, 1, 2, 1)),
    'nao': dict(slug='student-council-president-nao', knee=18, pads=(3, 1, 2, 4)),
    'rhabi': dict(slug='rhabi-the-human-hunter', knee=21, pads=(6, 6, 3, 1)),
    'kasperov': dict(slug='kasperov-the-king-of-the-east', pads=(2, 2, 2, 1)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'bill')
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


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def lighten(c, f):
    return [min(255, int(c[k] + (255 - c[k]) * f)) for k in range(3)] + [int(c[3])]


def blink(s, i, table):
    st = BLINK.get(i % N)
    if st:
        for (x, y), c in table[st]:
            s[y, x] = rgb(c)


def paste(out, a, ox, oy):
    for y, x in zip(*np.nonzero(a[:, :, 3])):
        dot(out, x + ox, y + oy, a[y, x])


def sweep(s, i, colors, period=24, width=2.5, strength=0.55, slope=0.8):
    """Glanzlinie läuft schräg über alle Pixel mit den Farben `colors`."""
    t = (i % period) / period
    pos = -6 + t * (SW + SH * slope + 12)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in colors:
            d = abs(x + y * slope - pos)
            if d < width:
                s[y, x] = lighten(s[y, x], strength * (1 - d / width))


# ---------------------------------------------------------------- Bills Worst Nightmare
BI_EYES = {'halb': [((6, 11), '111216'), ((10, 11), '111216')],
           'zu': [((x, 11), '111216') for x in (5, 6, 9, 10)] + [((x, 10), '1f1f23') for x in (5, 6, 9, 10)]}
BI_CAPE = [0x5c0400, 0x440000, 0x7b0815, 0x6b0712, 0x300901]
def f_bill(i):
    """Er federt (die Knie federn, nicht der Gürtel) und blinzelt, die roten Augen der Haube glühen, die
    Krone funkelt, der rote Umhang flattert leicht an den Seiten."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    reds = [(y, x) for y, x in zip(*np.nonzero(s[:, :, 3])) if y < 14 and s[y, x, 0] > 180 and s[y, x, 1] < 80]
    g = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)   # die roten Augen der Haube glühen
    for y, x in reds:
        s[y, x] = lighten(s[y, x], 0.5 * g)
    blink(s, i, BI_EYES)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    cape = (s[:, :, 3] > 0) & ((_xs <= 2) | (_xs >= SW - 5)) & (_ys >= 12) & (_ys <= 24) & \
        np.isin(s[:, :, 0] * 65536 + s[:, :, 1] * 256 + s[:, :, 2], BI_CAPE)
    rest = s.copy()
    rest[cape] = 0
    draw_bounce(out, rest, b, KNEE, PT, PL)
    for y, x in zip(*np.nonzero(cape)):                   # Umhang flattert: unten stärker, außen nach außen
        u = (y - 11) / 13
        dx = round(1.1 * u * (0.5 + 0.5 * math.sin(4 * t - 0.7 * y))) * (-1 if x <= 2 else 1)
        bb = b if y < KNEE else 0
        dot(out, x + PL + dx, y + PT + bb, s[y, x])
    gold = [(x, y) for y, x in zip(*np.nonzero(s[:, :, 3])) if y < 10 and s[y, x, 0] > 200 and s[y, x, 1] > 150]
    if gold:
        gx, gy = gold[len(gold) // 2]
        for (x, y), c in sparkle_pixels(i, N, [(gx + PL, gy + PT + b, 6), (gx + PL - 2, gy + PT + b + 2, 30)],
                                        rgb('fffbd0'), rgb('ffd700')).items():
            dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Creepy Villager Girl Semi
SE_EYES = {'halb': [((x, 10), '1f1f1f') for x in (14, 15)],
           'zu': [((x, 10), 'fce7d6') for x in (10, 11, 14, 15)] + [((x, 11), '1f1f1f') for x in (10, 11, 14, 15)]}


def f_semi(i):
    """Sie schwebt, die grauen Flügelchen an den Seiten schlagen (Spitzen auf und ab), sie blinzelt."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    blink(s, i, SE_EYES)
    dy = -round(1.5 * math.sin(t))
    flap = [0, -1, -1, 0, 1, 1][(i // 2) % 6]
    out = np.zeros((H, W, 4), int)
    hair = lambda c: int(c[1]) > int(c[0]) + 20 and int(c[1]) > int(c[2])      # grünes Haar
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        c = s[y, x]
        wing = (x <= 5 or x >= SW - 6) and 6 <= y <= 13 and abs(int(c[0]) - int(c[1])) < 12 and c[0] > 90
        ddy = flap * (1 if (x <= 2 or x >= SW - 3) else 0) if wing else 0
        dx = 0
        if hair(c) and (y <= 2 or x <= 8 or x >= 17):     # die Haarsträhnen bewegen sich leicht
            dx = round(0.9 * math.sin(3 * t - 0.5 * y + (0 if x < SW / 2 else 1.5)))
        dot(out, x + PL + dx, y + PT + dy + ddy, c)
    return out


# ---------------------------------------------------------------- Non-Believer Doq
GLASS = None


def f_doq(i):
    """Sie federt; die Hand mit der Lupe geht ganz mit (auch der Griff), das durch die Lupe riesige Auge
    blinzelt (das Lid kommt von oben, wie beim Standard-Doq), über das Glas wandert ein Glanz."""
    global GLASS
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for y in range(8, 12 if st == 'zu' else 10):
            for x in range(6, 10):
                last = y == (11 if st == 'zu' else 9)
                s[y, x] = rgb('35566b' if last else ('d0c2ae' if (x + y) % 3 else 'beb6a4'))
    if GLASS is None:
        GLASS = {hexc(s[y, x]) for y, x in zip(*np.nonzero(s[:, :, 3]))
                 if s[y, x, 2] > 150 and s[y, x, 2] > s[y, x, 0] + 30}
    sweep(s, i, GLASS, period=16, width=2.2, strength=0.7, slope=-0.9)
    b = B24[i % 24]
    carry = ((_ys >= KNEE) & (_ys <= 21) & (_xs >= 4) & (_xs <= 7)) | ((_ys >= KNEE) & (_xs >= 16))
    carry &= s[:, :, 3] > 0                               # untere Hand und Lupengriff gehen mit
    rest = s.copy()
    rest[carry] = 0
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, rest, b, KNEE, PT, PL)
    for y, x in zip(*np.nonzero(carry)):
        dot(out, x + PL, y + PT + b, s[y, x])
    return out


# ---------------------------------------------------------------- Thunder God Sol Rym
TG_EYES = {'halb': [((x, 14), 'cbadad') for x in (38, 39, 42, 43)], 'zu': [((x, 14), '270805') for x in (38, 39, 42, 43)]}
TG_SPEAK = [0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0,
            0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]
TG_BOLTS = {9: 0, 10: 0, 11: 1, 30: 2, 31: 2, 32: 3}
PUFFS = [(10, 1, 0.0), (24, 2, 1.1), (38, 1, 2.3), (52, 3, 0.7), (66, 2, 1.9), (18, 3, 2.9), (60, 1, 4.1)]
CLOUD = None
DRUMS = None


def cloud_frame(i):
    """Die Wolke wallt wie bei Sol Rym (motive.py): Bäusche quellen oben und unten auf, innen rollt sie."""
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
            if k % 2 == 0:
                for y in range(top, mid + 1):
                    if 0 <= y - bump:
                        out[y - bump, x] = base[y, x]
            else:
                for y in range(bot, mid - 1, -1):
                    if y + bump < ch:
                        out[y + bump, x] = base[y, x]
    return out


def tg_bolt(out, k, oy):
    rng = np.random.default_rng(100 + k)
    x = PL + int(rng.integers(12, 70))
    y = oy
    for _ in range(int(rng.integers(8, 12))):
        dot(out, x, y, rgb('fffbd0'))
        if 0 <= x + 1 < W:
            dot(out, x + 1, y, rgb('f6e70e', 200))
        y += 1
        x += int(rng.choice([-1, 0, 1]))


def f_thundergod(i):
    global DRUMS
    s = load('body')
    blink(s, i, TG_EYES)
    if not TG_SPEAK[i]:                                   # Mund zu (sonst offen)
        s[16, 40] = s[16, 41] = rgb('cbadad')
        s[17, 40] = s[17, 41] = rgb('cbadad')
    if DRUMS is None:                                     # die vier Trommeln des Kranzes (ohne die blaue Schnur)
        m = (s[:, :, 3] > 0) & (_ys <= 16) & ~np.isin(s[:, :, 0] * 65536 + s[:, :, 1] * 256 + s[:, :, 2],
                                                        [0x799ce0, 0x96c7ed]) & ((_xs <= 36) | (_xs >= 45))
        n, lab = cv2.connectedComponents(m.astype(np.uint8), connectivity=8)
        DRUMS = [lab == k for k in range(1, n) if (lab == k).sum() > 10]
    cloud = cloud_frame(i)
    k = TG_BOLTS.get(i)
    if k is not None:                                     # Wetterleuchten um den Blitz
        bx = int(np.random.default_rng(100 + k).integers(12, 70))
        for y, x in zip(*np.nonzero(cloud[:, :, 3])):
            d = math.hypot((x - bx) / 2.2, y - 30)
            if d < 9 and hexc(cloud[y, x]) != '000000':
                cloud[y, x] = lighten(cloud[y, x], 0.4 * (1 - d / 9))
    out = np.zeros((H, W, 4), int)
    hv = -round(2 * math.sin(2 * math.pi * i / N))
    for y, x in zip(*np.nonzero(cloud[:, :, 3])):
        out[y + PT + hv, x + PL] = cloud[y, x]
    if k is not None:
        tg_bolt(out, k, PT + hv + 32)
    hit = (i // 3) % 4                                    # reihum wird eine Trommel geschlagen
    drum_px = np.zeros((SH, SW), bool)
    for d in DRUMS:
        drum_px |= d
    for y, x in zip(*np.nonzero(s[:, :, 3] & ~drum_px)):
        out[y + PT + hv, x + PL] = s[y, x]
    for n_, d in enumerate(DRUMS):
        up = -1 if (n_ == hit and i % 3 < 2) else 0
        for y, x in zip(*np.nonzero(d)):
            out[y + PT + hv + up, x + PL] = s[y, x]
        if n_ == hit and i % 3 == 0:                      # Funke am geschlagenen Fell
            ys, xs = np.nonzero(d)
            cx, cy = int(xs.mean()) + PL, int(ys.min()) + PT + hv - 2
            for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1)):
                if not out[cy + dy, cx + dx, 3]:
                    dot(out, cx + dx, cy + dy, rgb('fffbd0' if (dx, dy) == (0, 0) else 'f6e70e'))
    return out


# ---------------------------------------------------------------- Ultimate Despair Inya
IN_LAUGH = [0, 0, 0, 0, 0, 0, 1, -1, 1, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, -1, 1, -1,
            1, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
def f_inya(i):
    """Sie lacht (der offene Mund geht in Lachstößen weiter auf und zu), ihre Zöpfe wehen; der Bär watschelt für sich (kippt hin und her, hebt ab), sein rotes Auge blitzt."""
    t = 2 * math.pi * i / N
    girl, bear = load('girl'), load('bear')
    out = np.zeros((H, W, 4), int)
    wb = [0, 0, 1, 1, 0, 0, -1, -1][(i // 3) % 8]
    hop = -1 if (i // 3) % 4 in (1, 3) else 0
    bys = np.nonzero(bear[:, :, 3])[0]
    btop, bbot = bys.min(), bys.max()
    for y, x in zip(*np.nonzero(bear[:, :, 3])):
        u = (bbot - y) / max(1, bbot - btop)
        dot(out, x + PL + round(wb * u), y + PT + hop, bear[y, x])
    eye = [(y, x) for y, x in zip(*np.nonzero(bear[:, :, 3])) if bear[y, x, 0] > 180 and bear[y, x, 1] < 80]
    if eye and (i % 16) in (6, 7):
        y, x = eye[0]
        u = (bbot - y) / max(1, bbot - btop)
        for dx, dy in ((0, 0), (1, -1), (-1, 1)):
            dot(out, x + PL + round(wb * u) + dx, y + PT + hop + dy, rgb('ff6060' if (dx, dy) == (0, 0) else 'ffd0d0'))
    laugh = IN_LAUGH[i]
    if laugh == 1:                                        # Mund weit auf
        for x in (15, 16):
            girl[13, x] = rgb('250000')
    elif laugh == -1:                                     # Mund fast zu
        for x in (15, 16):
            girl[12, x] = rgb('ecbcbc')
    cx = 15.5
    for y, x in zip(*np.nonzero(girl[:, :, 3])):
        d = abs(x - cx)
        dy = 0
        if d > 7 and y <= 17:                             # die Zöpfe wehen: außen weiter als innen
            u = min(1.0, (d - 7) / 8)
            dy += round(1.3 * u * math.sin(3 * t - 0.4 * d + (0 if x > cx else 1.6)))
        dot(out, x + PL, y + PT + dy, girl[y, x])
    return out


# ---------------------------------------------------------------- Mega-Priestess Johanna
GOLDS = None


def f_johanna(i):
    """Sie federt, ein Glanz läuft über die goldene Rüstung, der rote Umhang weht an den Zipfeln."""
    global GOLDS
    t = 2 * math.pi * i / N
    s = SRC.copy()
    if GOLDS is None:
        GOLDS = {hexc(s[y, x]) for y, x in zip(*np.nonzero(s[:, :, 3]))
                 if s[y, x, 0] > 150 and s[y, x, 1] > 120 and s[y, x, 2] < 120}
    sweep(s, i, GOLDS, period=24, width=2.5, strength=0.6)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    cape = (s[:, :, 3] > 0) & (s[:, :, 0] > 120) & (s[:, :, 1] < 60) & (_ys >= 16)
    rest = s.copy()
    rest[cape] = 0
    draw_bounce(out, rest, b, KNEE, PT, PL)
    for y, x in zip(*np.nonzero(cape)):
        u = (y - 16) / max(1, SH - 16)
        dx = round(1.2 * u * math.sin(3 * t - 0.5 * y) * (1 if x > SW / 2 else -1))
        bb = b if y < KNEE else 0
        if not out[y + PT + bb, x + PL + dx, 3] or dx:
            dot(out, x + PL + dx, y + PT + bb, s[y, x])
    return out


# ---------------------------------------------------------------- Student Council President Nao
NA_EYES = {'halb': [((17, 8), '150000'), ((22, 8), '150000')],
           'zu': [((17, 8), 'ffe6d5'), ((22, 8), 'ffe6d5')] + [((x, 9), '150000') for x in (17, 18, 21, 22)]}


def f_nao(i):
    """Sie federt und blinzelt, ihr langes Haar weht, die goldene Spitze ihres Stabs funkelt."""
    t = 2 * math.pi * i / N
    s = load('body')
    blink(s, i, NA_EYES)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    wings = load('wings')                                 # die Engelsflügel schlagen (hinter ihr)
    lift = 0.35 * math.sin(2 * math.pi * 3 * i / N)
    wm = wings[:, :, 3] > 0
    shear_flap(wings, wm & (_xs < 20), 20, -1, lift, 1 - 0.15 * abs(lift) / 0.35, out, (PL, PT + b), curve=1.3)
    shear_flap(wings, wm & (_xs >= 20), 20, 1, lift, 1 - 0.15 * abs(lift) / 0.35, out, (PL, PT + b), curve=1.3)
    hair = (s[:, :, 3] > 0) & (s[:, :, 2] > s[:, :, 1] + 15) & (s[:, :, 0] > 90) & (_ys >= 6)
    rest = s.copy()
    rest[hair & ((_xs <= 15) | (_xs >= 24))] = 0
    draw_bounce(out, rest, b, KNEE, PT, PL)
    for y, x in zip(*np.nonzero(hair & ((_xs <= 15) | (_xs >= 24)))):
        u = min(1.0, (y - 5) / 12)
        dx = round(1.1 * u * (0.5 + 0.5 * math.sin(3 * t - 0.6 * y))) * (1 if x >= 24 else -1)
        bb = b if y < KNEE else 0
        dot(out, x + PL + dx, y + PT + bb, s[y, x])
    tip = [(x, y) for y, x in zip(*np.nonzero(s[:, :, 3])) if x <= 6 and s[y, x, 0] > 200 and s[y, x, 1] > 180]
    if tip:
        tx, ty = min(tip)
        bb = b if ty < KNEE else 0
        for (x, y), c in sparkle_pixels(i, N, [(tx + PL, ty + PT + bb, 10), (tx + PL + 2, ty + PT + bb, 34)],
                                        rgb('fffbd0'), rgb('ffd700')).items():
            dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- RhaBi the Human Hunter
RH_ARMS = [('arml', 11), ('armr', 23), ('arml2', 37), ('armr2', 53)]   # (Teil, Zufallssaat)
RH_KEYS = {}


def rh_keys(seed):
    """Erratischer Flugplan eines Arms: Zielpunkte (Frame, weg vom Körper, quer), dazwischen hält er."""
    if seed not in RH_KEYS:
        rng = np.random.default_rng(seed)
        keys, f = [(0, 0, 0)], 0
        while True:
            f += int(rng.integers(4, 9))
            if f >= N - 3:
                break
            keys.append((f, int(rng.integers(-3, 6)), int(rng.integers(-2, 3))))
        keys.append((N, 0, 0))
        RH_KEYS[seed] = keys
    return RH_KEYS[seed]


def rh_pos(i, seed):
    keys = rh_keys(seed)
    for (fa, ra, pa), (fb, rb, pb) in zip(keys, keys[1:]):
        if fa <= i < fb:
            if i < fb - 2:                                # hält still …
                return ra, pa
            u = (i - (fb - 2) + 1) / 3                    # … und schießt in zwei Frames zum nächsten Punkt
            return ra + (rb - ra) * u, pa + (pb - pa) * u
    return 0, 0


def f_rhabi(i):
    """Er federt, das blaue Auge flackert; die vier abgetrennten Arme fliegen erratisch und unabhängig
    voneinander immer wieder schnell zu ihm hin und von ihm weg."""
    body = load('body')
    if (i % 12) in (3, 4, 9):
        for y, x in zip(*np.nonzero(body[:, :, 3])):
            if hexc(body[y, x]) == '01ffff':
                body[y, x] = rgb('b0ffff' if (i % 12) != 9 else '008c8c')
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    ys, xs = np.nonzero(body[:, :, 3])
    cx, cy = xs.mean(), ys.mean()
    for part, seed in RH_ARMS:                            # die Arme fliegen hinter ihm
        arm = load(part)
        ays, axs = np.nonzero(arm[:, :, 3])
        vx, vy = axs.mean() - cx, ays.mean() - cy
        n = math.hypot(vx, vy)
        vx, vy = vx / n, vy / n
        r, p = rh_pos(i, seed)
        paste(out, arm, PL + round(vx * r - vy * p), PT + round(vy * r + vx * p))
    draw_bounce(out, body, b, KNEE, PT, PL)
    return out


# ---------------------------------------------------------------- Kasperov the King of the East
def f_kasperov(i):
    """Der Shogi-Stein wippt und hüpft; die Schellen der Narrenkappe bimmeln und funkeln."""
    s = SRC.copy()
    rock = [0, 0, 1, 1, 0, 0, -1, -1][(i // 3) % 8]
    hop = -1 if (i % 24) in (10, 11, 12) else 0
    out = np.zeros((H, W, 4), int)
    ys = np.nonzero(s[:, :, 3])[0]
    bot = ys.max()
    bells = (s[:, :, 3] > 0) & (_ys >= 8) & (_ys <= 12) & ((_xs <= 2) | (_xs >= SW - 3))
    ring = round(0.9 * math.sin(2 * math.pi * 4 * i / N))
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        u = (bot - y) / bot
        dx = round(rock * u)
        dy = hop
        if bells[y, x]:
            dy += ring
        dot(out, x + PL + dx, y + PT + dy, s[y, x])
    for (x, y), c in sparkle_pixels(i, N, [(PL + 1, PT + 10 + hop, 8), (PL + SW - 2, PT + 10 + hop, 32)],
                                    rgb('fffbd0'), rgb('ffd700')).items():
        dot(out, x, y, c)
    return out


FRAME = dict(bill=f_bill, semi=f_semi, doq=f_doq, thundergod=f_thundergod, inya=f_inya, johanna=f_johanna,
             nao=f_nao, rhabi=f_rhabi, kasperov=f_kasperov)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
