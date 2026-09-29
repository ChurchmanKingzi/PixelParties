# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveIndia-Heroes.

Aufruf: python3 india.py <tag> [ms] <variante>

Frame 0 ist immer das Originalbild.

* madaga:   Madaga, the Forsaken Seafarer: die vier Tentakel winden sich (die oberen wogen mit einer
            nach außen laufenden Welle auf und ab, die unteren krümmen sich in der Mitte zum Körper
            hin, Ansatz und Fußspitze bleiben); er blinzelt mit dem echten Auge, das Glasauge blitzt
            zweimal je Loop auf.
* logan:    Logan, the Investment Monkee: federt gemächlich, aus der Zigarre steigt eine sich
            kräuselnde Rauchfahne (nach oben verblassend), die Glut glimmt beim Ziehen auf; über die
            Sonnenbrille huscht hin und wieder ein Glanzlicht, dann blitzt ein Stern auf; auch die
            Goldkette und die goldenen Schuhe blitzen (Lichtstreif und Goldsterne).
* trifecta / triad: Tri Fecta und Tri Ad wippen mit dem Kopf, die Schellen an den Mützenzipfeln
            pendeln, sie blinzeln (auch das halb geschlossene Auge); an ihren Händen hängen kurze Puppenfäden, die hin- und herschwingen.
* zamorin:  Zamorin, the Spice Rajah: federt, aus dem Glasgefäß in seiner Hand steigt Dampf in
            Schwaden auf, der Sack in der anderen Hand pendelt; er blinzelt.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, sparkle_pixels, draw_bounce

N = 48
OUT = os.environ.get('IN_OUT', '.')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'madaga': dict(slug='madaga-the-forsaken-seafarer', pads=(2, 2, 3, 1),
                   blink={'halb': [((x, 6), '000000') for x in (11, 12)],       # rechts (vom Betrachter)
                          'zu': [((x, 6), 'ffd5a4') for x in (11, 12)] +           # das Glasauge – blinzelt nicht
                                [((x, 7), '000000') for x in (11, 12)]}),
    'logan': dict(slug='logan-the-investment-monkee', knee=17, pads=(1, 3, 6, 2)),
    'trifecta': dict(slug='tri-fecta-the-puppet-master', knee=15, pads=(2, 2, 2, 5),
                     tips=(2, 21), bells=(14, 17), hands=[(6, 21), (8, 21), (14, 20), (16, 20)],
                     blink={'halb': [((13, 8), '000000'), ((14, 8), '000000'), ((9, 9), 'c8b8b8')],
                            'zu': [((13, 7), '9f6161'), ((14, 7), '9f6161'), ((13, 8), '000000'),
                                   ((14, 8), '000000'), ((14, 9), 'b18b8b'), ((9, 9), 'b18b8b')]}),
    'triad': dict(slug='tri-ad-the-puppet-mistress', knee=15, pads=(2, 2, 2, 5),
                  tips=(3, 24), bells=(16, 19), hands=[(9, 20), (11, 20), (17, 21), (19, 21)],
                  blink={'halb': [((11, 8), '000000'), ((12, 8), '000000'), ((16, 9), 'c8b8b8')],
                         'zu': [((11, 7), 'd8936a'), ((12, 7), 'd8936a'), ((11, 8), '000000'),
                                ((12, 8), '000000'), ((11, 9), 'b18b8b'),
                                ((15, 7), 'd8936a'), ((16, 7), 'd8936a'), ((16, 9), 'b18b8b')]}),
    'zamorin': dict(slug='zamorin-the-spice-rajah', knee=21, pads=(5, 2, 12, 1),
                    blink={'halb': [((9, 6), '526475'), ((14, 6), '526475')],
                           'zu': [((9, 6), '5e84b0'), ((14, 6), '5e84b0')] +
                                 [((x, 7), '0b0706') for x in (9, 10, 13, 14)]}),
}
V = next((v for v in sys.argv[2:] if v in V_), 'madaga')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load('body') if V == 'zamorin' else load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR


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


def over(out, x, y, c):
    """Halbtransparenten Pixel über out legen (nur dort, wo noch nichts deckt)."""
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1] and not out[y, x, 3]:
        out[y, x] = c


# ---------------------------------------------------------------- Madaga
TENT = {'381631', '583944', '876774', 'bda5ad'}


def clamp_chain(vals):
    """Aufeinanderfolgende Versätze höchstens um 1 springen lassen (die Kontur reißt nicht)."""
    out = [vals[0]]
    for v in vals[1:]:
        out.append(max(out[-1] - 1, min(out[-1] + 1, v)))
    return out


GLASS_FLASH = (8, 30)


def f_madaga(i):
    s = SRC.copy()
    blink(s, i)
    op = s[:, :, 3] > 0
    tent = np.array([[op[y, x] and hexc(s[y, x]) in TENT for x in range(SW)] for y in range(SH)])
    ys, xs = np.mgrid[0:SH, 0:SW]
    upper = tent & (ys <= 12) & ((xs <= 7) | (xs >= 20))
    lower = tent & (ys >= 16) & ((xs <= 8) | (xs >= 19))
    body = s.copy()
    body[upper | lower] = 0
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        out[y + PT, x + PL] = body[y, x]
    t = 2 * math.pi * 2 * i / N                         # zwei Wellen je Loop
    # obere Tentakel: senkrechter Versatz je Spalte, Welle läuft vom Ansatz zur Spitze
    for side, cols, ph in ((-1, range(7, -1, -1), 0.0), (1, range(20, SW), 1.9)):
        dys = clamp_chain([round(2.2 * (k / 7) * (math.sin(t - 0.55 * k + ph) - math.sin(ph - 0.55 * k)))
                          for k, _ in enumerate(cols)])
        for (k, x), dy in zip(enumerate(cols), dys):
            for y in np.nonzero(upper[:, x])[0]:
                out[y + PT + dy, x + PL] = s[y, x]
    # untere Tentakel: waagrechter Versatz je Zeile zum Körper hin, Ansatz (16) und Fuß (24) fest
    for side, per in ((-1, 1.5), (1, 2.0)):
        v = 0.5 - 0.5 * math.cos(t * per)
        dxs = [round(2.0 * v * math.sin(math.pi * (y - 16) / 8)) for y in range(16, SH)]
        for y, dx in zip(range(16, SH), dxs):
            sel = (xs[y] <= 8) if side < 0 else (xs[y] >= 19)
            for x in np.nonzero(lower[y] & sel)[0]:
                out[y + PT, x + PL - side * dx] = s[y, x]
    for st in GLASS_FLASH:                              # das Glasauge blitzt auf
        if 1 <= (i - st) % N <= 3:
            for x, y in ((15, 6), (16, 6), (15, 7), (16, 7)):
                out[y + PT, x + PL] = rgb('ffffff' if (x, y) in ((15, 6), (16, 7)) or (i - st) % N == 2 else 'd8ecff')
    for (x, y), c in sparkle_pixels(i, N, [(16 + PL, 6 + PT, st) for st in GLASS_FLASH],
                                    rgb('d8ecff'), rgb('acd5ff')).items():
        dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Logan
SMOKE = {'e1dacd', 'd0c3af'}
EMBER = [((18, 10), 'faae86', 'fff0c8'), ((18, 11), 'c94e31', 'ff7a3c')]
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]  # gemächlich: ein Federn je 24 Frames


def smoke(out, x0, y0, i, hmax=14, col=('efe8dc', 'd0c3af'), drift=0.12, amp=1.4, gap=8, seed=0.0, alpha=230):
    """Kräuselnde Rauch-/Dampffahne ab (x0, y0) nach oben: die Welle und die Lücken zwischen den
    Schwaden wandern mit 0,5 px/Frame hoch (loopt in 48 Frames), die Fahne verblasst nach oben."""
    for h in range(1, hmax + 1):
        if ((h + 0.5 * i) % gap) >= gap * 0.72:        # Lücke zwischen zwei Schwaden
            continue
        a = min(1.0, h / 5) * amp
        x = x0 + round(a * math.sin(0.5 * h - 2 * math.pi * 2 * i / N + seed) + drift * h)
        f = 1 - (h - 1) / hmax
        c = rgb(col[0] if h < hmax * 0.45 else col[1], int(alpha * (0.35 + 0.65 * f)))
        over(out, x, y0 - h, c)
        if h > hmax * 0.4:                              # oben wird die Fahne breiter
            over(out, x + (1 if math.sin(0.5 * h - 2 * math.pi * 2 * i / N + seed) < 0 else -1), y0 - h,
                 rgb(col[1], int(alpha * 0.5 * f)))


LENS = {'000000', '393939', '3f3f3f', '5f5f5f'}
GOLD = {'fad54a', 'f29a3e', 'f7f7ad', 'ee6428'}      # Goldkette und goldene Schuhe
GOLD_STARS = [(8, 14, 6), (5, 20, 31), (10, 20, 35), (11, 12, 44)]


def f_logan(i):
    s = SRC.copy()
    op = s[:, :, 3] > 0
    for y, x in zip(*np.nonzero(op)):
        if x >= 18 and hexc(s[y, x]) in SMOKE:
            s[y, x] = 0
    puff = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)           # Glut glimmt beim Ziehen auf
    for (x, y), c0, c1 in EMBER:
        a, b_ = np.array(rgb(c0)), np.array(rgb(c1))
        s[y, x] = (a + (b_ - a) * max(0.0, puff * 1.4 - 0.4)).astype(int)
    # Glanzlicht über die Gläser (Frames 18–23), danach ein Stern
    sweep = i - 18
    if 0 <= sweep < 6:
        for y in range(7, 10):
            for x in range(2, 15):
                if op[y, x] and hexc(SRC[y, x]) in LENS:
                    d = (x + y) - (9 + 2.6 * sweep)
                    if abs(d) < 0.8:
                        s[y, x] = rgb('f4f4f4')
                    elif -2 < d < 0:
                        s[y, x] = rgb('8a8a8a')
    # Goldglanz: ein Lichtstreif läuft schräg über Kette und Schuhe (Frames 27–34)
    g = i - 27
    if 0 <= g < 8:
        for y, x in zip(*np.nonzero(op)):
            if y >= 11 and x < 18 and hexc(SRC[y, x]) in GOLD:
                d = (x - 0.6 * y) - (-12 + 3.2 * g)
                if abs(d) < 0.9:
                    s[y, x] = rgb('fffbe6')
                elif -2.5 < d < 0:
                    s[y, x] = rgb('fff29a')
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    for (x, y), c in sparkle_pixels(i, N, [(13 + PL, 7 + PT, 23), (5 + PL, 7 + PT, 42)],
                                    rgb('c8c8c8'), rgb('a0a0a0')).items():
        dot(out, x, y + b, c)
    for gx, gy, st in GOLD_STARS:                       # Goldsterne auf Kette und Schuhen
        gb = b if gy < KNEE else 0
        for (x, y), c in sparkle_pixels(i, N, [(gx + PL, gy + PT, st)], rgb('fff0a0'), rgb('ffd54a')).items():
            dot(out, x, y + gb, c)
    smoke(out, 19 + PL, 10 + PT + b, i)
    return out


# ---------------------------------------------------------------- Tri Fecta / Tri Ad
STRING = ('c4c4cc', '8a8a94')                           # Fäden grau gestrichelt wie auf der Karte


def f_tri(i):
    s = SRC.copy()
    blink(s, i)
    b = B24[i % 24]
    t0, t1 = C['tips']
    by0, by1 = C['bells']
    sw = math.sin(2 * math.pi * 2 * i / N + 1.2)          # Schellen pendeln
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        tip = x <= t0 or x >= t1
        dy = b if (y < KNEE or tip) else 0
        dx = 0
        if tip and y >= by0 + 2:
            dx = round(1.2 * sw)
        out[y + PT + dy, x + PL + dx] = s[y, x]
    if b < 0:                                           # Naht über dem Knie schließen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and s[KNEE, x, 3] and not out[y + PT, x + PL, 3] and not (x <= t0 or x >= t1):
                out[y + PT, x + PL] = s[y, x]
    L = 7
    for k, (hx, hy) in enumerate(C['hands']):
        ph = 2 * math.pi * 2 * i / N + (0.0, 0.7, 2.6, 3.3)[k]
        amp = 2.0 if k % 2 == 0 else 1.6
        for r in range(L):
            x = hx + round(amp * (r / (L - 1)) * math.sin(ph - 0.25 * r))
            c = STRING[(r + (i // 3)) % 2 if r else 0]
            dot(out, x + PL, hy + r + PT, rgb(c))
    return out


# ---------------------------------------------------------------- Zamorin
SACK = None
BOWL = None


def f_zamorin(i):
    global SACK, BOWL
    if SACK is None:
        SACK, BOWL = load('sack'), load('bowl')
    s = SRC.copy()
    blink(s, i)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    sw = math.sin(2 * math.pi * 2 * i / N)              # Sack pendelt unter dem Knoten
    for y, x in zip(*np.nonzero(SACK[:, :, 3])):
        dx = round(1.3 * sw * max(0, y - 10) / 5)
        out[y + PT + b, x + PL + dx] = SACK[y, x]
    for y, x in zip(*np.nonzero(BOWL[:, :, 3])):
        out[y + PT + b, x + PL] = BOWL[y, x]
    fig = out[:, :, 3] > 0
    steam = np.zeros((H, W), float)
    for k in range(12):                                 # alle 4 Frames steigt eine Dampfschwade auf
        age = (i - 4 * k) % N
        if age >= 26:
            continue
        x0 = (3, 5, 2, 4, 6, 3, 4, 2, 5, 3, 6, 4)[k]
        h = 0.5 * age
        cx = x0 + 0.9 * math.sin(0.45 * h + 1.7 * k) - 0.15 * h
        cy = 4 - h
        r = min(1.6, 0.3 + age / 10)
        a = 235 * (1 - age / 26) * min(1.0, (age + 1) / 3)
        for yy in range(math.floor(cy - r), math.ceil(cy + r) + 1):
            for xx in range(math.floor(cx - r), math.ceil(cx + r) + 1):
                d = math.hypot(xx - cx, yy - cy)
                if d <= r:
                    steam[yy + PT + b, xx + PL] = max(steam[yy + PT + b, xx + PL], a * (1 - 0.35 * d / max(r, 0.01)))
    for y, x in zip(*np.nonzero(steam >= 18)):
        if not fig[y, x]:
            out[y, x] = rgb('fbfcff' if steam[y, x] > 120 else 'e6e9f4', int(steam[y, x]))
    return out


FRAME = dict(madaga=f_madaga, logan=f_logan, trifecta=f_tri, triad=f_tri, zamorin=f_zamorin)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
